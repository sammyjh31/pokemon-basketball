import { clamp } from "./ratings";
import { typeMatchup } from "./typeMatchups";
import type { PlayerProfile } from "./playerProfile";
import type { DefenseScheme, PlayType, Pokemon } from "./types";
import type { ShotZone } from "./shotModel";

export interface BodyProfile {
  heightM: number;
  weightKg: number;
  /** Compressed catalog dimensions, not literal standing reach or measured anatomy. */
  reach: number;
  mass: number;
  inertia: number;
  workload: number;
}
export interface MatchupActor {
  body?: BodyProfile;
  profile: PlayerProfile;
  types: readonly string[];
  energy: number;
}
export interface BodyContext {
  /** Geometry already resolved movement; retain only contact, reach and typing. */
  resolvedCourt?: { separated: boolean };
  play: PlayType;
  zone: ShotZone;
  coverage: DefenseScheme;
  screener?: MatchupActor;
  helper?: MatchupActor;
  kickout?: boolean;
}
export interface BodyMatchup {
  advantageChance: number;
  won: boolean;
  action: "post seal" | "separation" | "containment";
  physicalLogOdds: number;
  typeLogOdds: number;
  turnoverDelta: number;
  foulDelta: number;
  blockDelta: number;
  contestChance: number;
  contact: number;
  reach: number;
  quickness: number;
  typeEdge: number;
  attackType: string | null;
  screen: number;
}
const bounded = (n: number) => clamp(n, -1, 1);
const cache = new WeakMap<Pokemon, BodyProfile>();
const neutral: BodyProfile = {
  heightM: 1.5,
  weightKg: 80,
  reach: 0.47,
  mass: 0,
  inertia: 0.4925,
  workload: 0.05,
};
export function bodyProfile(mon: Pokemon): BodyProfile {
  const prior = cache.get(mon);
  if (prior) return prior;
  const heightM = Number.isFinite(mon.heightM)
    ? clamp(mon.heightM, 0.01, 1000)
    : 1.5;
  const weightKg = Number.isFinite(mon.weightKg)
    ? clamp(mon.weightKg, 0.01, 100000)
    : 80;
  // Smooth compression prevents long serpents and very heavy species dominating by scale alone.
  const reach = Math.tanh(Math.log1p(heightM) / 1.8);
  const mass = Math.tanh(Math.log(weightKg / 80) / 2.2);
  const body = {
    heightM,
    weightKg,
    reach,
    mass,
    inertia: clamp(0.375 * (mass + 1) + 0.25 * reach, 0, 1),
    workload: 0.35 * Math.max(0, mass) + 0.1 * reach,
  };
  cache.set(mon, body);
  return body;
}
const readiness = (p: MatchupActor) => 0.72 + clamp(p.energy) * 0.0028;
// Game actors are short-lived. Cache their immutable type arrays without
// retaining completed games or repeatedly constructing string lookup keys.
const typePairs = new WeakMap<
  MatchupActor,
  WeakMap<
    MatchupActor,
    {
      attack: readonly string[];
      defense: readonly string[];
      result: ReturnType<typeof typeMatchup>;
    }
  >
>();
function matchupType(a: MatchupActor, d: MatchupActor) {
  let opponents = typePairs.get(a);
  if (!opponents) {
    opponents = new WeakMap();
    typePairs.set(a, opponents);
  }
  const prior = opponents.get(d);
  if (prior?.attack === a.types && prior.defense === d.types)
    return prior.result;
  const result = typeMatchup(a.types, d.types);
  opponents.set(d, { attack: a.types, defense: d.types, result });
  return result;
}
export function matchupEdges(a: MatchupActor, d: MatchupActor) {
  const ab = a.body ?? neutral,
    db = d.body ?? neutral;
  const aa = a.profile.attributes,
    da = d.profile.attributes;
  const attackReadiness = readiness(a),
    defenseReadiness = readiness(d);
  const skillGap = (key: "strength" | "vertical" | "speed") =>
    (aa[key] * attackReadiness - da[key] * defenseReadiness) / 100;
  return {
    contact: bounded((ab.mass - db.mass) * 0.65 + skillGap("strength") * 0.35),
    reach: bounded((ab.reach - db.reach) * 0.75 + skillGap("vertical") * 0.25),
    quickness: bounded(
      skillGap("speed") * 0.65 +
        (db.inertia - ab.inertia) * 0.35 +
        (a.energy - d.energy) * 0.001,
    ),
    type: matchupType(a, d).edge,
  };
}
/** The value of using this player against this defender, not a permanent overall rating. */
export function matchupPreference(
  a: MatchupActor,
  d: MatchupActor,
  play: PlayType,
): number {
  return preferenceFromEdges(matchupEdges(a, d), play);
}
/** Reuse one matchup snapshot while comparing plays in the same possession. */
export function preferenceFromEdges(
  e: ReturnType<typeof matchupEdges>,
  play: PlayType,
): number {
  const opportunity =
    play === "post"
      ? e.contact * 0.65 + e.reach * 0.3
      : play === "isolation" || play === "transition"
        ? e.quickness * 1.2 - Math.max(0, -e.reach) * 0.12
        : play === "spotUp"
          ? e.reach * 0.25 + e.quickness * 0.65
          : e.quickness * 0.6 + e.contact * 0.2;
  return clamp(Math.exp(opportunity * 1.5 + e.type * 0.16), 0.4, 2.5);
}
export function screenLeverage(
  screener: MatchupActor,
  guard: MatchupActor,
): number {
  const sb = screener.body ?? neutral,
    db = guard.body ?? neutral;
  return clamp(
    0.25 +
      (screener.profile.traits.screening * readiness(screener) -
        guard.profile.attributes.speed * readiness(guard)) *
        0.005 +
      (sb.mass - db.mass) * 0.18 +
      db.inertia * 0.12,
    0,
    0.7,
  );
}
/** One contest roll is shared with previews/diagnostics; helpers and kickouts use the same roll. */
export function resolveBodyMatchup(
  a: MatchupActor,
  d: MatchupActor,
  c: BodyContext,
  roll: number,
): BodyMatchup {
  const e = matchupEdges(a, d),
    rim = c.zone === "rim",
    post = c.play === "post" && rim;
  const screen =
    !c.resolvedCourt && c.play === "pickRoll" && c.screener && c.screener !== a
      ? screenLeverage(c.screener, d) *
        (c.coverage === "switch" ? 0.25 : c.coverage === "zone" ? 0.55 : 1)
      : 0;
  const helper = c.helper && c.helper !== d && rim ? c.helper : undefined;
  const help =
    !c.resolvedCourt && helper
      ? clamp(
          0.05 +
            (helper.body?.reach ?? neutral.reach) * 0.08 +
            helper.profile.attributes.interiorDefense *
              readiness(helper) *
              0.001,
          0,
          0.22,
        )
      : 0;
  const advantageChance = clamp(
    0.38 +
      (post
        ? e.contact * 0.3 + e.reach * 0.14
        : e.quickness * 0.38 + e.reach * 0.04) +
      e.type * 0.045 +
      screen * 0.23 -
      help +
      (!c.resolvedCourt && c.kickout ? 0.23 : 0),
    0.12,
    0.8,
  );
  const won = c.resolvedCourt?.separated ?? roll < advantageChance;
  const physicalLogOdds = clamp(
    (rim
      ? post
        ? e.contact * 0.34 + e.reach * 0.18
        : e.quickness * 0.28 + e.reach * 0.15 + e.contact * 0.08
      : e.reach * (c.zone === "mid" ? 0.21 : 0.12) + e.quickness * 0.18) +
      (c.resolvedCourt ? 0 : won ? 0.14 : -0.08) +
      screen * 0.1 -
      help * 0.85 +
      (!c.resolvedCourt && c.kickout ? 0.1 : 0),
    -0.55,
    0.55,
  );
  const type = matchupType(a, d);
  const helpType = helper ? matchupType(a, helper).edge : e.type;
  const typeLogOdds = clamp(
    (e.type * (helper ? 0.75 : 1) + helpType * (helper ? 0.25 : 0)) *
      (rim ? 0.09 : 0.065),
    -0.24,
    0.24,
  );
  return {
    advantageChance,
    won,
    action: won ? (post ? "post seal" : "separation") : "containment",
    physicalLogOdds,
    typeLogOdds,
    // Additional body effects only; the existing base handles dribbling skill and type pressure.
    turnoverDelta: clamp(
      -e.quickness * 0.018 - e.reach * 0.012 - (post ? e.contact * 0.009 : 0),
      -0.025,
      0.025,
    ),
    foulDelta: clamp(
      rim
        ? (won ? 0.012 : -0.006) +
            Math.max(0, post ? e.contact : e.quickness) * 0.035
        : won
          ? -0.003
          : 0,
      -0.012,
      0.045,
    ),
    blockDelta: clamp(
      -e.reach * (rim ? 0.055 : 0.018) - (won ? 0.008 : 0) + help * 0.035,
      -0.035,
      0.045,
    ),
    contestChance: clamp(
      0.78 -
        (won ? 0.3 : 0) -
        screen * 0.18 -
        e.reach * 0.08 +
        help * 0.5 -
        (!c.resolvedCourt && c.kickout ? 0.17 : 0),
      0.2,
      0.94,
    ),
    contact: e.contact,
    reach: e.reach,
    quickness: e.quickness,
    typeEdge: e.type,
    attackType: type.attackType,
    screen,
  };
}
/** Short rebounds reward reach; long rebounds involve turning and chasing, not extra mass. */
export function reboundBody(body: BodyProfile, long: boolean): number {
  return long
    ? (body.reach - 0.47) * 5 - body.inertia * 9
    : (body.reach - 0.47) * 18 + body.mass * 7;
}
export interface MatchupEvidence extends BodyMatchup {
  attackerId: string;
  defenderId: string;
  attackerHeight: number;
  defenderHeight: number;
  attackerWeight: number;
  defenderWeight: number;
  /** Sequential changes to unblocked shot accuracy, before shooting-foul resolution. */
  physicalChanceDelta: number;
  typeChanceDelta: number;
}

/** Average both contest outcomes; never sample randomness in the scouting preview. */
export function previewBodyShot(
  base: number,
  a: MatchupActor,
  d: MatchupActor,
  c: BodyContext,
) {
  const won = resolveBodyMatchup(a, d, c, 0),
    contained = resolveBodyMatchup(a, d, c, 1);
  const shift = (p: number, odds: number) =>
    1 / (1 + Math.exp(-(Math.log(p / (1 - p)) + odds)));
  const probability = clamp(base, 0.1, 0.88);
  const physical = (m: BodyMatchup) =>
    clamp(shift(probability, m.physicalLogOdds), 0.1, 0.88);
  const typed = (m: BodyMatchup) =>
    clamp(shift(physical(m), m.typeLogOdds), 0.1, 0.88);
  const average = (f: (m: BodyMatchup) => number) =>
    won.advantageChance * f(won) + (1 - won.advantageChance) * f(contained);
  return {
    advantageChance: won.advantageChance,
    probability: average(typed),
    physicalChange: average(physical) - probability,
    typeChange: average(typed) - average(physical),
    wonProbability: typed(won),
    containedProbability: typed(contained),
    edges: matchupEdges(a, d),
  };
}
