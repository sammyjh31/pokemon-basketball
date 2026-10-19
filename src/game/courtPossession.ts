import { activateMove, beginMoveSegment } from "./matchMoves";
import type { MoveEvent, MoveOpportunity } from "./moveTypes";
import { physicalPlayerEffects } from "./physicalAbilities";
import { recordPhysicalAbility } from "./abilities";
import { getCoach, type CoachAssignment } from "./trainerCoaches";
import { matchupEdges, screenLeverage } from "./bodyMatchups";
import type { Player } from "./matchLineups";
import { clamp } from "./ratings";
import type { DefenseScheme, PlayType, Tactic } from "./types";
import type {
  CourtPoint,
  CourtSequence,
  ScreenCoverage,
  CourtAction,
} from "./courtTypes";

export type Court = Map<Player, CourtPoint>;
export interface CourtContext {
  movesNow?: number;
  coach?: CoachAssignment;
  offense: Player[];
  defense: Player[];
  guards: Map<Player, Player>;
  handler: Player;
  screener: Player;
  play: PlayType;
  tactic: Tactic;
  scheme: DefenseScheme;
  shotClock: number;
  periodRemaining: number;
  putback?: Player;
  /** Version 2: rim/mid/three intent weights for whoever ends up with the shot. */
  zoneIntent?: (shooter: Player) => readonly [number, number, number];
  /** Game flow: extra seconds to advance (playoff half-court pace). */
  advanceDelta?: number;
  /** Game flow: a late after-timeout inbound starts in the frontcourt. */
  frontCourt?: boolean;
  /** Game flow on court rules v2: zone shells, off-ball reactions, post seals and shooting form. */
  depth?: PlayDepthContext;
}
export interface PlayDepthContext {
  /** Shooting form: above 1 while hot, below 1 while cold. */
  form: (player: Player) => number;
}
const basket = { x: 0, y: 5.25 };
const distance = (a: CourtPoint, b: CourtPoint) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const skill = (p: Player, key: keyof Player["profile"]["attributes"]) =>
  p.profile.attributes[key] *
  (0.72 + p.energy * 0.0028) *
  (key === "passing"
    ? (p.chemistry?.passing ?? 1)
    : key === "perimeterDefense" || key === "interiorDefense"
      ? (p.chemistry?.defense ?? 1)
      : 1) *
  (key === "passing" ? (p.moves?.effects.passing ?? 1) : 1);
const mobility = (p: Player) =>
  clamp(8 + skill(p, "speed") * 0.13 - (p.body?.inertia ?? 0.5) * 5, 5, 21);
const bounded = (p: CourtPoint): CourtPoint => ({
  x: clamp(p.x, -24, 24),
  y: clamp(p.y, 0, 47),
});
export function moveToward(
  from: CourtPoint,
  to: CourtPoint,
  player: Player,
  seconds: number,
): CourtPoint {
  const span = distance(from, to),
    speed =
      mobility(player) *
      (player.chemistry?.movement ?? 1) *
      (player.field?.movement ?? 1) *
      (player.moves?.effects.movement ?? 1),
    boost = physicalPlayerEffects(player).movement,
    fraction = Math.min(1, (speed * boost * seconds) / Math.max(0.001, span));
  const point = bounded({
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
  });
  if (boost !== 1) {
    const neutral = Math.min(1, (speed * seconds) / Math.max(0.001, span));
    const ordinary = bounded({
      x: from.x + (to.x - from.x) * neutral,
      y: from.y + (to.y - from.y) * neutral,
    });
    recordPhysicalAbility(
      player.box,
      "movement",
      Math.max(0, distance(from, point) - distance(from, ordinary)),
    );
  }
  return point;
}
const zoneAt = (p: CourtPoint): "rim" | "mid" | "three" =>
  distance(p, basket) < 9
    ? "rim"
    : Math.abs(p.x) >= 22 || distance(p, basket) >= 23.75
      ? "three"
      : "mid";
const guardSpot = (p: CourtPoint, shooter: Player, scheme: DefenseScheme) => {
  const sag = clamp(
    (70 - skill(shooter, "threePoint")) * 0.12 + (scheme === "zone" ? 3 : 1),
    0.5,
    7,
  );
  const length = Math.max(1, distance(p, basket));
  return bounded({
    x: p.x + ((basket.x - p.x) * sag) / length,
    y: p.y + ((basket.y - p.y) * sag) / length,
  });
};
/** A 2-3 shell: two top spots, two wings and a middle anchor, shifted toward the ball. */
const ZONE_SPOTS: CourtPoint[] = [
  { x: -7, y: 22 },
  { x: 7, y: 22 },
  { x: -16, y: 9 },
  { x: 16, y: 9 },
  { x: 0, y: 8 },
];
export function zoneShell(defense: readonly Player[]): Map<Player, number> {
  const remaining = [...defense];
  const take = (score: (p: Player) => number) => {
    const best = remaining.reduce((a, b) => (score(b) > score(a) ? b : a));
    remaining.splice(remaining.indexOf(best), 1);
    return best;
  };
  const anchor = take((p) => skill(p, "interiorDefense") + skill(p, "block"));
  const guard = (p: Player) => skill(p, "speed") + skill(p, "perimeterDefense");
  const tops = [take(guard), take(guard)];
  return new Map<Player, number>([
    [tops[0], 0],
    [tops[1], 1],
    [remaining[0], 2],
    [remaining[1], 3],
    [anchor, 4],
  ]);
}
const shiftedSpot = (index: number, ball: CourtPoint): CourtPoint => {
  const spot = ZONE_SPOTS[index];
  return bounded({
    x: spot.x + (ball.x - spot.x) * 0.4,
    y: spot.y + (ball.y - spot.y) * 0.25,
  });
};
/** Zone principles on top of assignments: the ball is pressured at man depth, and every
 * other defender sags from its mark toward its shifted zone area, more on the side away
 * from the ball. The paint stays crowded and weak-side closeouts start from farther away. */
function zoneTargets(
  shell: Map<Player, number>,
  ball: Player,
  ballPoint: CourtPoint,
  guards: Map<Player, Player>,
  court: Court,
): Map<Player, CourtPoint> {
  const targets = new Map<Player, CourtPoint>();
  for (const [attacker, d] of guards) {
    const index = shell.get(d);
    if (index === undefined) continue;
    const mark = guardSpot(court.get(attacker)!, attacker, "man");
    if (attacker === ball) {
      targets.set(d, mark);
      continue;
    }
    const spot = shiftedSpot(index, ballPoint),
      sag = clamp(
        0.08 + (distance(court.get(attacker)!, ballPoint) / 30) * 0.12,
        0.08,
        0.22,
      );
    targets.set(
      d,
      bounded({
        x: mark.x * (1 - sag) + spot.x * sag,
        y: mark.y * (1 - sag) + spot.y * sag,
      }),
    );
  }
  return targets;
}
/** Feet on a half court. Shooting threat determines whether off-ball players space or occupy the paint. */
export function createCourt(c: CourtContext): Court {
  const court: Court = new Map();
  court.set(c.handler, { x: 0, y: 31 });
  court.set(c.screener, { x: 8, y: c.play === "post" ? 10 : 23 });
  c.offense
    .filter((p) => p !== c.handler && p !== c.screener)
    .forEach((p, i) => {
      const space = skill(p, "threePoint") >= 57 && c.tactic !== "interior";
      court.set(
        p,
        space
          ? [
              { x: -23, y: 8 },
              { x: 23, y: 8 },
              { x: -21, y: 28 },
            ][i]
          : [
              { x: -7, y: 10 },
              { x: 7, y: 13 },
              { x: -16, y: 20 },
            ][i],
      );
    });
  for (const p of c.offense)
    court.set(c.guards.get(p)!, guardSpot(court.get(p)!, p, c.scheme));
  if (c.putback) court.set(c.putback, { x: 1, y: 7 });
  return court;
}
/** Nearest defender and lane occupancy are resolved from current positions, not nominal roster roles. */
export function courtGeometry(
  court: Court,
  shooter: Player,
  offense: Player[],
  defense: Player[],
) {
  const point = court.get(shooter)!,
    zone = zoneAt(point);
  const sorted = defense
    .map((p) => ({ p, d: distance(point, court.get(p)!) }))
    .sort((a, b) => a.d - b.d);
  const defender = sorted[0].p,
    defenderDistance = sorted[0].d;
  const paintCrowding = [...offense, ...defense].filter(
    (p) => p !== shooter && distance(court.get(p)!, basket) < 13,
  ).length;
  const shooterRim = distance(point, basket);
  const laneDefenders = defense.filter((p) => {
    const q = court.get(p)!;
    return (
      distance(q, basket) < shooterRim &&
      distance(q, point) + distance(q, basket) < shooterRim + 5
    );
  }).length;
  const help = sorted
    .slice(1)
    .find((v) => distance(court.get(v.p)!, basket) < 15)?.p;
  const spacing =
    offense
      .filter((p) => p !== shooter)
      .reduce((n, p) => n + Math.min(28, distance(point, court.get(p)!)), 0) /
    4;
  const shotLogOdds =
    clamp(
      (defenderDistance - 3) * 0.065 -
        (zone === "rim" ? paintCrowding * 0.035 : 0),
      -0.28,
      0.42,
    ) - clamp((shooterRim - 27) * 0.12, 0, 2);
  return {
    zone,
    defender,
    defenderDistance,
    paintCrowding,
    laneDefenders,
    spacing,
    helper: help,
    shotLogOdds,
  };
}
/** Automatic coverage balances the configured scheme with the actual two-player matchup. */
export function chooseScreenCoverage(c: CourtContext): {
  coverage: ScreenCoverage;
  reason: string;
} {
  const guard = c.guards.get(c.handler)!,
    big = c.guards.get(c.screener)!;
  const shooting = skill(c.handler, "threePoint"),
    decision = c.handler.profile.traits.decisionMaking;
  const switchCost =
    c.handler.body && big.body
      ? matchupEdges(c.handler, big).quickness +
        matchupEdges(c.screener, guard).contact
      : 0;
  const typeCost =
    (c.handler.typeEdges.get(big) ?? 0) +
    (c.screener.typeEdges.get(guard) ?? 0);
  const scores: Record<ScreenCoverage, number> = {
    under: (62 - shooting) * 0.16 + (c.scheme === "zone" ? 1 : 0),
    drop:
      1.5 +
      (skill(big, "interiorDefense") - skill(big, "speed")) * 0.04 +
      (c.scheme === "zone" ? 1.5 : 0),
    switch:
      (c.scheme === "switch" ? 5 : 0) +
      (skill(big, "speed") - 60) * 0.06 -
      switchCost * 2 -
      typeCost * 0.65,
    hedge: (shooting - 60) * 0.08 + (skill(big, "speed") - 55) * 0.04 + 0.5,
    trap:
      (c.scheme === "press" ? 5 : -2) +
      (shooting - 70) * 0.06 +
      (60 - decision) * 0.045 -
      (skill(c.screener, "passing") - 60) * 0.045,
  };
  const courtEffects = (player: Player) => {
    const own = physicalPlayerEffects(player);
    return {
      movement: own.movement * (player.chemistry?.movement ?? 1),
      screen:
        own.screen *
        (player.chemistry?.screen ?? 1) *
        (player.moves?.effects.screen ?? 1),
      navigation:
        own.navigation *
        (player.chemistry?.navigation ?? 1) *
        (player.moves?.effects.navigation ?? 1),
    };
  };
  const handlerAbility = courtEffects(c.handler),
    screenerAbility = courtEffects(c.screener),
    guardAbility = courtEffects(guard),
    bigAbility = courtEffects(big);
  // Strong contact favors avoiding the screen; quick bigs can show and recover.
  // These are planning scores, separate from the contact resolved below.
  scores.switch +=
    (screenerAbility.screen - 1) * 8 -
    (guardAbility.navigation - 1) * 6 +
    (bigAbility.movement - handlerAbility.movement) * 12;
  scores.hedge +=
    (bigAbility.movement - 1) * 14 + (guardAbility.navigation - 1) * 8;
  scores.drop -= (handlerAbility.movement - 1) * 10;
  scores.trap -= (handlerAbility.movement - 1) * 8;
  const physicalRead = [
    handlerAbility.movement,
    screenerAbility.screen,
    guardAbility.navigation,
    bigAbility.movement,
  ].some((v) => v !== 1);
  const coach = getCoach(c.coach?.id ?? "");
  if (coach) scores[coach.coverage] += 2.8 - coach.adaptability;
  const coverage = (Object.keys(scores) as ScreenCoverage[]).sort(
    (a, b) => scores[b] - scores[a],
  )[0];
  const reasons: Record<ScreenCoverage, string> = {
    under: "Go below the screen against the weaker pull-up threat.",
    drop: "Keep the big near the paint and concede a pull-up window.",
    switch:
      "Exchange assignments to stay connected; accept the new body/type matchups.",
    hedge: "Show at the ball, then recover to the roller.",
    trap: "Commit two defenders to pressure the handler; the roll and weak side can open.",
  };
  return {
    coverage,
    reason:
      reasons[coverage] +
      (physicalRead
        ? " Ability movement, screen contact and navigation inform this coverage."
        : "") +
      (coach?.coverage === coverage
        ? ` ${coach.name} favors this coverage when the matchup allows it.`
        : ""),
  };
}
export function applyScreenCoverage(
  court: Court,
  c: CourtContext,
  coverage: ScreenCoverage,
) {
  const ball = court.get(c.handler)!,
    guard = c.guards.get(c.handler)!,
    big = c.guards.get(c.screener)!;
  const contactAdjustment = (base: number) => {
    const screen =
        physicalPlayerEffects(c.screener).screen *
        (c.screener.moves?.effects.screen ?? 1),
      navigation =
        physicalPlayerEffects(guard).navigation *
        (guard.moves?.effects.navigation ?? 1);
    const gap =
      (((base * screen) / navigation) * (c.screener.chemistry?.screen ?? 1)) /
      (guard.chemistry?.navigation ?? 1);
    if (physicalPlayerEffects(c.screener).screen !== 1)
      recordPhysicalAbility(c.screener.box, "screens");
    if (physicalPlayerEffects(guard).navigation !== 1)
      recordPhysicalAbility(guard.box, "screens");
    return gap - base;
  };
  court.set(c.screener, { x: 6, y: 17 });
  if (coverage === "switch") {
    court.set(big, { x: ball.x + 1.5, y: ball.y - 1 });
    court.set(guard, { x: 6, y: 15 });
    c.guards.set(c.handler, big);
    c.guards.set(c.screener, guard);
  } else if (coverage === "drop") {
    court.set(guard, {
      x: ball.x + 2,
      // Keep the original addition order for archived replay precision.
      y:
        ball.y +
        2 +
        screenLeverage(c.screener, guard) * 2 +
        contactAdjustment(2 + screenLeverage(c.screener, guard) * 2),
    });
    court.set(big, { x: 3, y: 13 });
  } else if (coverage === "under") {
    court.set(guard, { x: ball.x, y: ball.y - 7 });
    court.set(big, { x: 5, y: 14 });
  } else {
    court.set(guard, { x: ball.x - 1, y: ball.y - 1 - contactAdjustment(2) });
    court.set(big, { x: ball.x + 1.5, y: ball.y - 2 });
  }
}
function laneDefenders(
  court: Court,
  from: Player,
  to: Player,
  defense: Player[],
) {
  const a = court.get(from)!,
    b = court.get(to)!,
    span = distance(a, b);
  return defense.filter(
    (p) => distance(a, court.get(p)!) + distance(court.get(p)!, b) < span + 2,
  );
}
function passRisk(court: Court, from: Player, to: Player, defense: Player[]) {
  const a = court.get(from)!,
    b = court.get(to)!,
    span = distance(a, b);
  const interceptors = laneDefenders(court, from, to, defense).length;
  const pressure = defense.filter((p) => distance(a, court.get(p)!) < 4).length;
  return clamp(
    0.012 +
      (span - 15) * 0.0006 +
      interceptors * 0.009 +
      pressure * 0.012 +
      (60 - skill(from, "passing")) * 0.0006,
    0.005,
    0.12,
  );
}
/** One shot-clock segment. Offensive rebounds are new 14-second segments in the same possession. */
export function resolveCourtPossession(
  source: CourtContext,
  random: () => number,
) {
  if (source.movesNow !== undefined)
    beginMoveSegment([...source.offense, ...source.defense]);
  const c = { ...source, guards: new Map(source.guards) },
    court = createCourt(c);
  const shell =
    c.depth && c.scheme === "zone" ? zoneShell(c.defense) : undefined;
  if (shell)
    for (const [p, point] of zoneTargets(
      shell,
      c.putback ?? c.handler,
      court.get(c.putback ?? c.handler)!,
      c.guards,
      court,
    ))
      court.set(p, point);
  let ball = c.putback ?? c.handler,
    passer: Player | undefined,
    helper: Player | undefined,
    stealer: Player | undefined;
  let clock = Math.min(c.shotClock, c.periodRemaining),
    seconds = 0;
  const initialClock = clock,
    actions: CourtAction[] = [];
  const moveEvents: MoveEvent[] = [];
  const useMove = (
    player: Player,
    opportunity: MoveOpportunity,
    receiver?: Player,
    zone?: string,
  ) => {
    if (c.movesNow === undefined) return;
    const event = activateMove(player, opportunity, c.movesNow + seconds, {
      clock,
      receiver,
      zone,
    });
    if (event) moveEvents.push(event);
  };
  let coverage: ScreenCoverage | undefined, coverageReason: string | undefined;
  let outcome: CourtSequence["outcome"] = "shot",
    kickout = false,
    droveAfterCatch = false,
    clockLimited = false;
  const spend = (
    kind: CourtAction["kind"],
    duration: number,
    target?: Player,
    recover = true,
  ) => {
    // Never complete a pass/drive/screen using time that the clock cannot supply.
    if (kind !== "shoot" && kind !== "violation" && duration + 0.6 > clock) {
      clockLimited = true;
      return false;
    }
    const used = Math.min(clock, duration);
    clock = Math.max(0, clock - used);
    seconds += used;
    if (recover && shell)
      for (const [d, target] of zoneTargets(
        shell,
        ball,
        court.get(ball)!,
        c.guards,
        court,
      ))
        court.set(d, moveToward(court.get(d)!, target, d, used * 0.24));
    else if (recover)
      for (const attacker of c.offense) {
        const d = c.guards.get(attacker)!;
        court.set(
          d,
          moveToward(
            court.get(d)!,
            guardSpot(court.get(attacker)!, attacker, c.scheme),
            d,
            used * 0.24,
          ),
        );
      }
    actions.push({
      kind,
      playerId: ball.box.playerId,
      ...(target ? { targetId: target.box.playerId } : {}),
      clock,
    });
    return true;
  };
  const pass = (target: Player, kind: "pass" | "kickout") => {
    const risk = passRisk(court, ball, target, c.defense);
    if (
      !spend(
        kind,
        1.1 + distance(court.get(ball)!, court.get(target)!) / 35,
        target,
      )
    )
      return false;
    if (c.movesNow !== undefined) useMove(ball, "pass", target);
    if (
      random() <
      (c.movesNow !== undefined
        ? passRisk(court, ball, target, c.defense)
        : risk)
    ) {
      outcome = "turnover";
      if (c.zoneIntent) {
        // Credit the defender in the passing lane, or the one pressuring the passer.
        const lane = laneDefenders(court, ball, target, c.defense);
        stealer = (lane.length ? lane : c.defense).reduce((best, p) =>
          skill(p, "steal") > skill(best, "steal") ? p : best,
        );
      }
      return false;
    }
    passer = ball;
    ball = target;
    droveAfterCatch = false;
    kickout = kind === "kickout";
    return true;
  };
  // A late after-timeout inbound starts in the frontcourt and skips the v2 half-court time.
  const advanceSeconds =
    c.frontCourt && !c.putback
      ? 1
      : (c.putback
          ? 1
          : (c.play === "transition"
              ? 3
              : c.tactic === "pace"
                ? 5.5
                : c.tactic === "defense"
                  ? 8.5
                  : 7.5) + (c.advanceDelta ?? 0)) -
        // Version 2 spends extra half-court time moving the ball and relocating.
        (c.zoneIntent && !c.putback && c.play !== "transition" ? 1 : 0);
  const rushedAdvance = !spend("advance", advanceSeconds);
  if (!rushedAdvance) for (const p of c.offense) useMove(p, "recover");
  if (rushedAdvance && !c.putback) {
    // The half-court formation assumes the offense has arrived. When the
    // period cannot supply that travel time, finish with a distant heave.
    court.set(ball, {
      x: 0,
      y: 31 + 16 * (1 - clamp((clock - 0.6) / advanceSeconds, 0, 1)),
    });
  }
  if (!clockLimited && !c.putback && c.play === "pickRoll" && clock > 4) {
    const chosen = chooseScreenCoverage(c);
    if (
      spend(
        "screen",
        2.4 + (c.screener.body?.inertia ?? 0.5),
        c.screener,
        false,
      )
    ) {
      useMove(c.screener, "screen");
      useMove(c.guards.get(c.handler)!, "navigate");
      const selection =
        c.movesNow !== undefined ? chooseScreenCoverage(c) : chosen;
      coverage = selection.coverage;
      coverageReason = selection.reason;
      applyScreenCoverage(court, c, coverage);
    }
  }
  if (!clockLimited && c.play === "post" && !c.putback && clock > 3) {
    if (c.depth) {
      // Post skill and strength decide how deep the seal is; deep seals draw a double.
      const post = c.screener,
        guard = shell
          ? [...c.defense].sort(
              (a, b) =>
                distance(court.get(a)!, { x: 5, y: 10 }) -
                distance(court.get(b)!, { x: 5, y: 10 }),
            )[0]
          : c.guards.get(post)!;
      const depth = clamp(
        (post.profile.traits.postGame - skill(guard, "interiorDefense")) *
          0.08 +
          (skill(post, "strength") - skill(guard, "strength")) * 0.05,
        -2,
        4,
      );
      const spot = { x: 5, y: Math.max(6, 10 - depth) };
      court.set(post, spot);
      court.set(guard, guardSpot(spot, post, c.scheme));
      actions.push({ kind: "seal", playerId: post.box.playerId, clock });
      if (
        pass(post, "pass") &&
        depth >= 2.5 &&
        post.profile.traits.postGame >= 65
      ) {
        const double = c.defense
          .filter((p) => p !== guard)
          .sort(
            (a, b) =>
              distance(court.get(a)!, spot) - distance(court.get(b)!, spot),
          )[0];
        helper = double;
        court.set(double, moveToward(court.get(double)!, spot, double, 1.2));
      }
    } else {
      court.set(c.screener, { x: 5, y: 10 });
      pass(c.screener, "pass");
    }
  } else if (!clockLimited && !c.putback && c.play === "spotUp" && clock > 3) {
    const target = c.offense
      .filter((p) => p !== ball)
      .sort((a, b) => skill(b, "threePoint") - skill(a, "threePoint"))[0];
    pass(target, "pass");
  }
  for (
    let step = 0;
    !clockLimited && outcome === "shot" && step < 4 && clock > 1.5;
    step++
  ) {
    const geometry = courtGeometry(court, ball, c.offense, c.defense);
    const open = geometry.defenderDistance > 5;
    const shooting = skill(
      ball,
      geometry.zone === "rim"
        ? "finishing"
        : geometry.zone === "three"
          ? "threePoint"
          : "midRange",
    );
    const read = clamp(
      0.45 +
        (ball.profile.traits.decisionMaking - 60) * 0.005 +
        (skill(ball, "passing") - 60) * 0.002,
      0.2,
      0.85,
    );
    if (
      c.putback ||
      clock < 4 ||
      (step > 0 && open && shooting > 55) ||
      (c.depth !== undefined &&
        c.depth.form(ball) > 1 &&
        geometry.defenderDistance > 3.5 &&
        shooting > 50) ||
      random() < (c.zoneIntent ? 0.08 : 0.13)
    )
      break;
    const candidates = c.offense
      .filter((p) => p !== ball)
      .map((p) => {
        const g = courtGeometry(court, p, c.offense, c.defense);
        return {
          p,
          g,
          value:
            g.defenderDistance * 0.65 +
            skill(
              p,
              g.zone === "rim"
                ? "finishing"
                : g.zone === "three"
                  ? "threePoint"
                  : "midRange",
            ) *
              0.05 -
            (g.zone === "mid" ? 0.9 : 0),
        };
      })
      .sort((a, b) => b.value - a.value);
    const best = candidates[0];
    const current = geometry.defenderDistance * 0.65 + shooting * 0.05;
    if (
      (best.value > current + (c.zoneIntent ? 0.3 : 1) ||
        (coverage === "trap" && step === 0)) &&
      random() < read
    ) {
      if (
        !pass(
          best.p,
          geometry.zone === "rim" && best.g.zone !== "rim" ? "kickout" : "pass",
        )
      )
        break;
      continue;
    }
    if (
      geometry.zone !== "rim" &&
      (c.play !== "spotUp" || shooting < 65) &&
      random() < 0.68
    ) {
      const defender = geometry.defender;
      const edges =
        ball.body && defender.body
          ? matchupEdges(ball, defender)
          : { quickness: 0, type: 0 };
      if (clock >= 3.3 + (ball.body?.inertia ?? 0.5)) useMove(ball, "drive");
      const chance = clamp(
        0.48 +
          (ball.moves?.effects.drive ?? 0) +
          edges.quickness * 0.2 +
          edges.type * 0.035 -
          geometry.laneDefenders * 0.055 +
          (geometry.spacing - 16) * 0.006,
        0.16,
        0.78,
      );
      const beat = random() < chance;
      const from = court.get(ball)!;
      const target = beat
        ? { x: from.x * 0.2, y: 8 }
        : { x: from.x * 0.55, y: 18 };
      if (!spend("drive", 2.7 + (ball.body?.inertia ?? 0.5), undefined, false))
        break;
      droveAfterCatch = true;
      court.set(ball, moveToward(from, target, ball, 2.7));
      // The beaten defender trails; nearby help can leave its assignment and open a kickout.
      court.set(
        defender,
        moveToward(
          court.get(defender)!,
          court.get(ball)!,
          defender,
          beat ? 0.3 : 1.6,
        ),
      );
      const near = c.defense
        .filter((p) => p !== defender)
        .sort(
          (a, b) =>
            distance(court.get(a)!, court.get(ball)!) -
            distance(court.get(b)!, court.get(ball)!),
        )[0];
      if (beat && distance(court.get(near)!, court.get(ball)!) < 18) {
        helper = near;
        const helperFrom = court.get(near)!;
        court.set(
          near,
          moveToward(court.get(near)!, court.get(ball)!, near, 0.65),
        );
        if (c.depth)
          reactOffBall(
            c,
            court,
            ball,
            near,
            helperFrom,
            clock,
            actions,
            random,
            shell,
            (p) => useMove(p, "cut"),
          );
      }
      if (
        random() <
        clamp(
          0.014 +
            geometry.laneDefenders * 0.012 +
            (60 - skill(ball, "ballHandling")) * 0.0005,
          0.005,
          0.075,
        )
      ) {
        outcome = "turnover";
        if (c.zoneIntent) stealer = helper ?? defender;
      }
    } else if (open || step >= 2) break;
    else spend("reset", 2.5 + random() * 2);
  }
  if (
    c.zoneIntent &&
    outcome === "shot" &&
    !c.putback &&
    !rushedAdvance &&
    !clockLimited
  )
    relocateForIntent(c, court, ball, c.zoneIntent(ball), random, spend);
  if (outcome === "shot") {
    if (
      clockLimited &&
      c.periodRemaining >= c.shotClock &&
      random() >
        clamp(0.55 + ball.profile.traits.decisionMaking * 0.004, 0.65, 0.95)
    ) {
      outcome = "violation";
      spend("violation", clock, undefined, false);
    } else {
      if (c.movesNow !== undefined) {
        const shot = courtGeometry(court, ball, c.offense, c.defense);
        useMove(ball, "shoot", undefined, shot.zone);
        useMove(shot.defender, "defend", undefined, shot.zone);
        if (shot.defender.moves?.effects.movement !== 1)
          court.set(
            shot.defender,
            moveToward(
              court.get(shot.defender)!,
              court.get(ball)!,
              shot.defender,
              0.15,
            ),
          );
      }
      spend("shoot", rushedAdvance ? clock : Math.min(clock, 0.6));
    }
  }
  if (outcome !== "shot" && actions.at(-1)?.kind !== "violation")
    actions.push({
      kind: outcome === "violation" ? "violation" : "turnover",
      playerId: ball.box.playerId,
      clock,
    });
  const geometry = courtGeometry(court, ball, c.offense, c.defense);
  const late = clock < 4 ? -clamp((4 - clock) * 0.045, 0, 0.18) : 0;
  const sequence: CourtSequence = {
    possession: 0,
    offenseTeamId: c.offense[0].box.teamId,
    defenseTeamId: c.defense[0].box.teamId,
    period: 0,
    elapsedSeconds: 0,
    initialClock,
    shotClock: clock,
    seconds,
    coverage,
    coverageReason,
    actions,
    positions: [...court].map(([p, point]) => ({
      ...point,
      playerId: p.box.playerId,
      offense: c.offense.includes(p),
    })),
    shooterId: ball.box.playerId,
    defenderId: geometry.defender.box.playerId,
    zone: geometry.zone,
    defenderDistance: geometry.defenderDistance,
    paintCrowding: geometry.paintCrowding,
    shotLogOdds:
      geometry.shotLogOdds +
      late +
      (ball.moves?.effects.shot ?? 0) -
      (geometry.defender.moves?.effects.contest ?? 0),
    ...(moveEvents.length ? { moves: moveEvents } : {}),
    outcome,
    points: 0,
  };
  return {
    sequence,
    finishPlay: (c.putback
      ? "post"
      : droveAfterCatch
        ? "isolation"
        : kickout
          ? "spotUp"
          : c.play) as PlayType,
    putback: !!c.putback && ball === c.putback && !passer,
    shooter: ball,
    stealer,
    droveAfterCatch,
    defender: geometry.defender,
    passer,
    helper:
      helper && distance(court.get(helper)!, court.get(ball)!) < 8
        ? helper
        : undefined,
    kickout,
    guards: c.guards,
    coverage,
    zone: geometry.zone,
    spacing: clamp(35 + geometry.spacing * 1.4, 35, 80),
  };
}

const zoneRadius = { rim: 4, mid: 15, three: 24.5 } as const;
/** Version 2: the shooter steps into the zone their tendencies, tactic and the
 * defense favour. Moving costs time, and the on-ball defender recovers while it
 * happens, so a relocated shot is usually more contested than the open look. */
function relocateForIntent(
  c: CourtContext,
  court: Court,
  shooter: Player,
  weights: readonly [number, number, number],
  random: () => number,
  spend: (
    kind: CourtAction["kind"],
    duration: number,
    target?: Player,
    recover?: boolean,
  ) => boolean,
) {
  const from = court.get(shooter)!,
    current = zoneAt(from),
    zones = ["rim", "mid", "three"] as const;
  // Staying put is cheaper than moving, so the current zone gets a bonus. Spaced
  // version-2 offenses lean slightly further toward the arc.
  const adjusted = zones.map(
    (zone, i) =>
      Math.max(0, weights[i]) *
      (zone === current ? 1.35 : 1) *
      (zone === "three" ? 1.15 : 1),
  );
  const total = adjusted.reduce((a, b) => a + b, 0);
  if (total <= 0) return;
  let roll = random() * total,
    desired: (typeof zones)[number] = zones[2];
  for (let i = 0; i < zones.length; i++) {
    roll -= adjusted[i];
    if (roll < 0) {
      desired = zones[i];
      break;
    }
  }
  if (desired === current) return;
  const dx = from.x - basket.x,
    dy = from.y - basket.y,
    length = Math.hypot(dx, dy) || 1;
  const ux = length > 0.5 ? dx / length : 0,
    uy = length > 0.5 ? dy / length : 1;
  const radius = zoneRadius[desired];
  let target = bounded({
    x: basket.x + ux * radius,
    y: Math.max(1, basket.y + uy * radius),
  });
  if (desired === "three" && zoneAt(target) !== "three")
    target = bounded({
      x: Math.sign(ux || 1) * 22.5,
      y: Math.max(1, target.y),
    });
  if (desired !== "three" && zoneAt(target) === "three")
    target = bounded({ x: target.x * 0.6, y: Math.min(target.y, 18) });
  if (zoneAt(target) !== desired) return;
  const duration = desired === "rim" ? 1.5 : 0.7;
  if (!spend(desired === "rim" ? "drive" : "reset", duration, undefined, false))
    return;
  court.set(shooter, target);
  // A zone's nearest defender, not a nominal assignment, follows the relocation.
  const guard =
    c.depth && c.scheme === "zone"
      ? [...c.defense].sort(
          (a, b) =>
            distance(court.get(a)!, target) - distance(court.get(b)!, target),
        )[0]
      : c.guards.get(shooter)!;
  court.set(
    guard,
    moveToward(
      court.get(guard)!,
      guardSpot(target, shooter, c.scheme),
      guard,
      duration * (desired === "rim" ? 0.55 : 0.7),
    ),
  );
}

/** On a help rotation the abandoned attacker cuts, and the nearest spacer drifts to open space. */
function reactOffBall(
  c: CourtContext,
  court: Court,
  ball: Player,
  helper: Player,
  helperFrom: CourtPoint,
  clock: number,
  actions: CourtAction[],
  random: () => number,
  shell: Map<Player, number> | undefined,
  onCut?: (player: Player) => void,
) {
  const spacer = (p: Player) =>
    zoneAt(court.get(p)!) === "three" && skill(p, "threePoint") >= 57;
  const left = shell
    ? c.offense
        .filter((p) => p !== ball)
        .sort(
          (a, b) =>
            distance(court.get(a)!, helperFrom) -
            distance(court.get(b)!, helperFrom),
        )[0]
    : c.offense.find((p) => p !== ball && c.guards.get(p) === helper);
  if (left && !spacer(left)) {
    onCut?.(left);
    const from = court.get(left)!,
      side = Math.sign(from.x) || 1;
    const chance = clamp(
      0.25 +
        ((left.moves?.effects.movement ?? 1) - 1) * 0.2 +
        (left.profile.traits.offBall - 55) * 0.012 +
        (distance(court.get(helper)!, from) > 6 ? 0.1 : 0),
      0.1,
      0.6,
    );
    court.set(
      left,
      random() < chance
        ? { x: side * 4, y: 6 }
        : { x: from.x * 0.6, y: Math.max(7, from.y * 0.8) },
    );
    actions.push({ kind: "cut", playerId: left.box.playerId, clock });
  }
  // Corners lift to the wing and wings sink to the corner, by up to six feet.
  const shooter = c.offense
    .filter((p) => p !== ball && p !== left && spacer(p))
    .sort(
      (a, b) =>
        distance(court.get(a)!, court.get(ball)!) -
        distance(court.get(b)!, court.get(ball)!),
    )[0];
  if (!shooter) return;
  const from = court.get(shooter)!,
    side = Math.sign(from.x) || 1,
    target = from.y > 9 ? { x: side * 22.5, y: 3 } : { x: side * 22.5, y: 16 },
    span = distance(from, target),
    step = Math.min(
      span,
      clamp(2 + (shooter.profile.traits.offBall - 50) * 0.1, 1, 6) *
        (shooter.moves?.effects.movement ?? 1),
    );
  if (span < 0.5) return;
  let next = bounded({
    x: from.x + ((target.x - from.x) * step) / span,
    y: from.y + ((target.y - from.y) * step) / span,
  });
  if (zoneAt(next) !== "three") return;
  // Commit a legal relocation before paying for its move. A rejected drift
  // must not consume energy/cooldown or award move experience.
  onCut?.(shooter);
  const boostedStep = Math.min(
    span,
    clamp(2 + (shooter.profile.traits.offBall - 50) * 0.1, 1, 6) *
      (shooter.moves?.effects.movement ?? 1),
  );
  if (boostedStep > step) {
    const boosted = bounded({
      x: from.x + ((target.x - from.x) * boostedStep) / span,
      y: from.y + ((target.y - from.y) * boostedStep) / span,
    });
    // Keep the spacer behind the arc when an acceleration would cross it.
    if (zoneAt(boosted) === "three") next = boosted;
  }
  court.set(shooter, next);
  actions.push({ kind: "drift", playerId: shooter.box.playerId, clock });
}
