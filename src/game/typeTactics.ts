import { matchupEdges } from "./bodyMatchups";
import type { Player } from "./matchLineups";
import { POSITIONS, type DefenseScheme } from "./types";
import type { OpponentScouting } from "./typeTacticsTypes";

const edge = (a: Player, d: Player) => a.typeEdges.get(d) ?? 0;
const ready = (p: Player, key: "perimeterDefense" | "interiorDefense") =>
  p.profile.attributes[key] * (0.72 + p.energy * 0.0028);

/** Confidence grows with observed attempts, not with a coach's wins. */
export function scoutedThreat(
  player: Player,
  scouting: OpponentScouting,
): number {
  const row = scouting.players[player.box.pokemonId];
  if (!row?.attempts) return 1;
  return (
    1 +
    Math.min(1, row.attempts / 35) *
      Math.min(1, row.points / row.attempts / 1.5)
  );
}

function guardScore(
  attack: Player,
  defender: Player,
  scouting: OpponentScouting,
): number {
  const profileShare =
    attack.profile.attributes.finishing /
    Math.max(
      1,
      attack.profile.attributes.finishing +
        attack.profile.attributes.threePoint,
    );
  const observed = scouting.players[attack.box.pokemonId];
  const confidence = Math.min(0.65, (observed?.attempts ?? 0) / 40);
  const rimShare = observed?.attempts
    ? profileShare * (1 - confidence) +
      (observed.rimAttempts / observed.attempts) * confidence
    : profileShare;
  const body =
    attack.body && defender.body ? matchupEdges(attack, defender) : undefined;
  const physicalThreat = body
    ? 18 *
      (rimShare *
        (Math.max(0, body.contact) * 0.6 + Math.max(0, body.reach) * 0.4) +
        (1 - rimShare) * Math.max(0, body.quickness))
    : 0;
  return (
    ready(defender, "interiorDefense") * rimShare * 0.55 +
    ready(defender, "perimeterDefense") * (1 - rimShare) * 0.55 -
    Math.abs(
      attack.profile.attributes.speed - defender.profile.attributes.speed,
    ) *
      0.08 -
    Math.abs(
      attack.profile.attributes.strength - defender.profile.attributes.strength,
    ) *
      0.06 -
    edge(attack, defender) * 9 -
    physicalThreat
  );
}

/** A bijection keeps every attacker covered; pair exchanges improve the whole five. */
export function assignTypeDefenders(
  attack: Player[],
  defense: Player[],
  scouting: OpponentScouting,
): Map<Player, Player> {
  const scores = attack.map((p, role) =>
    defense.map(
      (d) =>
        (guardScore(p, d, scouting) +
          d.profile.positions[POSITIONS[role]] * 0.15) *
        scoutedThreat(p, scouting),
    ),
  );
  const roles = attack
    .map((_, i) => i)
    .sort(
      (a, b) =>
        scoutedThreat(attack[b], scouting) - scoutedThreat(attack[a], scouting),
    );
  const assigned: number[] = [],
    available = new Set(defense.map((_, i) => i));
  for (const role of roles) {
    const best = [...available].sort(
      (a, b) => scores[role][b] - scores[role][a],
    )[0];
    assigned[role] = best;
    available.delete(best);
  }
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let i = 0; i < attack.length; i++)
      for (let j = i + 1; j < attack.length; j++) {
        if (
          scores[i][assigned[j]] + scores[j][assigned[i]] >
          scores[i][assigned[i]] + scores[j][assigned[j]] + 0.01
        ) {
          [assigned[i], assigned[j]] = [assigned[j], assigned[i]];
          changed = true;
        }
      }
    if (!changed) break;
  }
  return new Map(attack.map((p, i) => [p, defense[assigned[i]]]));
}

export function shouldSwitchScreen(
  handler: Player,
  roller: Player,
  handlerGuard: Player,
  rollerGuard: Player,
  scheme: DefenseScheme,
  scouting: OpponentScouting,
): boolean {
  const handlerWeight = scoutedThreat(handler, scouting),
    rollerWeight = scoutedThreat(roller, scouting);
  const stay =
    guardScore(handler, handlerGuard, scouting) * handlerWeight +
    guardScore(roller, rollerGuard, scouting) * rollerWeight;
  const swap =
    guardScore(handler, rollerGuard, scouting) * handlerWeight +
    guardScore(roller, handlerGuard, scouting) * rollerWeight;
  return swap + (scheme === "switch" ? 5 : scheme === "zone" ? -5 : -1) > stay;
}

export function chooseTypeHelp(
  shooter: Player,
  defender: Player,
  attack: Player[],
  defense: Player[],
  guards: Map<Player, Player>,
  scouting: OpponentScouting,
  advantageWon?: boolean,
): { helper: Player; abandoned: Player } | undefined {
  const body =
    shooter.body && defender.body ? matchupEdges(shooter, defender) : undefined;
  const need =
    (advantageWon === undefined ? 0 : advantageWon ? 9 : -5) +
    (body
      ? Math.max(
          0,
          body.contact * 0.55 + body.quickness * 0.7 + body.reach * 0.25,
        ) * 24
      : 0) +
    edge(shooter, defender) * 9 +
    (scoutedThreat(shooter, scouting) - 1) * 12 +
    Math.max(
      0,
      shooter.profile.attributes.finishing - ready(defender, "interiorDefense"),
    ) *
      0.2;
  if (need < 5) return undefined;
  let best: { helper: Player; abandoned: Player } | undefined,
    bestScore = 0;
  for (const helper of defense) {
    if (helper === defender || helper.energy < 35) continue;
    const abandoned = attack.find((p) => guards.get(p) === helper);
    if (!abandoned || abandoned === shooter) continue;
    const shootingRisk =
      abandoned.profile.attributes.threePoint *
      scoutedThreat(abandoned, scouting) *
      0.18;
    const score =
      need -
      edge(shooter, helper) * 7 +
      ready(helper, "interiorDefense") * 0.1 +
      (helper.body ? helper.body.reach * 5 : 0) -
      shootingRisk -
      4;
    if (score > bestScore) {
      bestScore = score;
      best = { helper, abandoned };
    }
  }
  return best;
}

/** Match possessions are already per team, so defensive events use that denominator. */
export function scoutedCoverage(scouting: OpponentScouting) {
  const rate = (events: number) =>
    Math.min(1, events / Math.max(1, scouting.possessions));
  return {
    switches: rate(scouting.switches),
    help: rate(scouting.helpRotations),
  };
}

export function screenCoverage(
  scheme: DefenseScheme,
  switched: boolean,
): DefenseScheme {
  return scheme === "zone" || scheme === "press"
    ? scheme
    : switched
      ? "switch"
      : "man";
}
