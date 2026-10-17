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
      : 1);
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
    speed = mobility(player) * (player.chemistry?.movement ?? 1),
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
      screen: own.screen * (player.chemistry?.screen ?? 1),
      navigation: own.navigation * (player.chemistry?.navigation ?? 1),
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
    const screen = physicalPlayerEffects(c.screener).screen,
      navigation = physicalPlayerEffects(guard).navigation;
    const gap =
      (((base * screen) / navigation) * (c.screener.chemistry?.screen ?? 1)) /
      (guard.chemistry?.navigation ?? 1);
    if (screen !== 1) recordPhysicalAbility(c.screener.box, "screens");
    if (navigation !== 1) recordPhysicalAbility(guard.box, "screens");
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
function passRisk(court: Court, from: Player, to: Player, defense: Player[]) {
  const a = court.get(from)!,
    b = court.get(to)!,
    span = distance(a, b);
  const interceptors = defense.filter(
    (p) => distance(a, court.get(p)!) + distance(court.get(p)!, b) < span + 2,
  ).length;
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
  const c = { ...source, guards: new Map(source.guards) },
    court = createCourt(c);
  let ball = c.putback ?? c.handler,
    passer: Player | undefined,
    helper: Player | undefined;
  let clock = Math.min(c.shotClock, c.periodRemaining),
    seconds = 0;
  const initialClock = clock,
    actions: CourtAction[] = [];
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
    if (recover)
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
    if (random() < risk) {
      outcome = "turnover";
      return false;
    }
    passer = ball;
    ball = target;
    droveAfterCatch = false;
    kickout = kind === "kickout";
    return true;
  };
  const advanceSeconds = c.putback
    ? 1
    : c.play === "transition"
      ? 3
      : c.tactic === "pace"
        ? 5.5
        : c.tactic === "defense"
          ? 8.5
          : 7.5;
  const rushedAdvance = !spend("advance", advanceSeconds);
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
      coverage = chosen.coverage;
      coverageReason = chosen.reason;
      applyScreenCoverage(court, c, coverage);
    }
  }
  if (!clockLimited && c.play === "post" && !c.putback && clock > 3) {
    court.set(c.screener, { x: 5, y: 10 });
    pass(c.screener, "pass");
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
      random() < 0.13
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
      (best.value > current + 1 || (coverage === "trap" && step === 0)) &&
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
      const chance = clamp(
        0.48 +
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
        court.set(
          near,
          moveToward(court.get(near)!, court.get(ball)!, near, 0.65),
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
      )
        outcome = "turnover";
    } else if (open || step >= 2) break;
    else spend("reset", 2.5 + random() * 2);
  }
  if (outcome === "shot") {
    if (
      clockLimited &&
      c.periodRemaining >= c.shotClock &&
      random() >
        clamp(0.55 + ball.profile.traits.decisionMaking * 0.004, 0.65, 0.95)
    ) {
      outcome = "violation";
      spend("violation", clock, undefined, false);
    } else spend("shoot", rushedAdvance ? clock : Math.min(clock, 0.6));
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
    shotLogOdds: geometry.shotLogOdds + late,
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
