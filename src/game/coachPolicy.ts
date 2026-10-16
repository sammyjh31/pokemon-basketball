import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile, type PlayerProfile } from "./playerProfile";
import { getCoach, type TrainerCoach } from "./trainerCoaches";
import {
  ROSTER_SLOTS,
  type LeagueTeam,
  type Tactic,
  type DefenseScheme,
  type RotationStyle,
} from "./types";
export interface CoachPlan {
  tactic: Tactic;
  defense: DefenseScheme;
  rotation: RotationStyle;
  reason: string;
}
export interface CoachObservation {
  minute: number;
  margin: number;
  energy: number;
  opponentAttempts: number;
  opponentThrees: number;
  opponentRim: number;
}
export function coachGamePlan(
  team: LeagueTeam,
  opponent?: LeagueTeam,
): CoachPlan {
  const coach = getCoach(team.coach?.id ?? "");
  if (!coach)
    return {
      tactic: team.tactic,
      defense: team.defense,
      rotation: team.rotation,
      reason: "Existing team instructions.",
    };
  const profiles = ROSTER_SLOTS.flatMap((slot) => {
    const mon = POKEMON_BY_ID.get(team.roster[slot]!);
    return mon ? [playerProfile(mon, team.development?.[mon.id])] : [];
  });
  const avg = (key: keyof PlayerProfile["attributes"]) =>
    profiles.reduce((n, p) => n + p.attributes[key], 0) /
    Math.max(1, profiles.length);
  const fit: Record<Tactic, number> = {
    balanced: (avg("passing") + avg("composure")) / 2,
    pace: (avg("speed") + avg("stamina") + avg("ballHandling")) / 3,
    perimeter: (avg("threePoint") * 2 + avg("passing")) / 3,
    interior: (avg("finishing") + avg("strength") + avg("rebounding")) / 3,
    defense: (avg("perimeterDefense") + avg("interiorDefense")) / 2,
  };
  fit[coach.tactic] += 22 - 12 * coach.adaptability;
  const tactic = (Object.keys(fit) as Tactic[]).sort(
    (a, b) => fit[b] - fit[a],
  )[0];
  let defense = coach.defense;
  if (opponent && coach.adaptability >= 0.8) {
    const opponents = Object.values(opponent.roster).flatMap((id) => {
      const m = POKEMON_BY_ID.get(id!);
      return m ? [playerProfile(m, opponent.development?.[m.id])] : [];
    });
    const shooting =
      opponents.reduce((n, p) => n + p.attributes.threePoint, 0) /
      Math.max(1, opponents.length);
    if (shooting > 75 && avg("speed") > 55) defense = "switch";
    else if (avg("speed") < 48 && defense === "press") defense = "zone";
  }
  return {
    tactic,
    defense,
    rotation: coach.rotation,
    reason: `${coach.name}: ${coach.style}. Roster fit favors ${tactic}; ${coach.rotation === "bench" ? "share the workload" : coach.rotation === "starters" ? "lean on the strongest rotation" : "balance starters and reserves"}.`,
  };
}
/** Deterministic observations from play, never from optional reporting or future results. */
export function coachAdjustment(
  coach: TrainerCoach,
  o: CoachObservation,
): { tactic?: Tactic; defense?: DefenseScheme; reason: string } {
  if (o.minute >= 43 && o.margin <= -5)
    return {
      tactic: "perimeter",
      defense: coach.risk >= 0.4 ? "press" : "switch",
      reason: `Trailing by ${-o.margin} late: seek threes and increase ball pressure.`,
    };
  if (o.energy < 58 + coach.rest * 10)
    return {
      tactic: "balanced",
      defense: coach.rest >= 0.65 ? "zone" : "man",
      reason: `Floor energy ${Math.round(o.energy)}: reduce pace and defensive workload.`,
    };
  if (o.minute >= 44 && o.margin >= 7)
    return {
      tactic: "balanced",
      defense: "man",
      reason: `Ahead by ${o.margin} late: protect possession and avoid gambling.`,
    };
  if (o.opponentAttempts >= Math.round(16 - coach.adaptability * 9)) {
    if (o.opponentThrees / o.opponentAttempts >= 0.42)
      return {
        defense: "switch",
        reason: `Opponent took ${o.opponentThrees} of ${o.opponentAttempts} shots from three: stay attached to shooters.`,
      };
    if (o.opponentRim / o.opponentAttempts >= 0.5)
      return {
        defense: "zone",
        reason: `Opponent attacked the rim on ${o.opponentRim} of ${o.opponentAttempts} shots: protect the paint.`,
      };
  }
  return { reason: "Keep the current plan while gathering opponent evidence." };
}
/** Preference changes selection, never the player's underlying skill. */
export function coachPlayerPreference(
  coach: TrainerCoach,
  p: PlayerProfile,
): number {
  const a = p.attributes;
  const fit = {
    balanced: (a.passing + a.composure) / 2,
    pace: (a.speed + a.stamina) / 2,
    perimeter: (a.threePoint + p.traits.offBall) / 2,
    interior: (a.strength + a.rebounding + a.finishing) / 3,
    defense: (a.perimeterDefense + a.interiorDefense) / 2,
  };
  return (fit[coach.tactic] - 60) * 0.14;
}

/** Allocate 240 minutes by ability, stamina and style, independent of roster-slot labels. */
export function coachRotationMinutes(team: LeagueTeam) {
  const coach = getCoach(team.coach!.id)!;
  const candidates = ROSTER_SLOTS.map((slot) => {
    const mon = POKEMON_BY_ID.get(team.roster[slot]!)!;
    const p = playerProfile(mon, team.development?.[mon.id]);
    return {
      slot,
      score:
        Math.max(...Object.values(p.positions)) +
        coachPlayerPreference(coach, p) +
        p.attributes.stamina * 0.08,
    };
  }).sort((a, b) => b.score - a.score);
  const minutes = Object.fromEntries(ROSTER_SLOTS.map((s) => [s, 0])) as Record<
    import("./types").RosterSlot,
    number
  >;
  const weights = candidates.map(
    (p, i) =>
      (p.score / 75) ** (2.6 - coach.rest * 1.6) *
      (i < 5 ? 1.3 - coach.rest * 0.15 : 0.75 + coach.rest * 0.35),
  );
  for (let n = 0; n < 240; n++) {
    let best = -1,
      value = -Infinity;
    candidates.forEach((p, i) => {
      const priority = weights[i] / (minutes[p.slot] + 1);
      if (minutes[p.slot] < 40 && priority > value) {
        best = i;
        value = priority;
      }
    });
    minutes[candidates[best].slot]++;
  }
  return minutes;
}
