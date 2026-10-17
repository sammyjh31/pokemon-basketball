import { POKEMON_BY_ID } from "../data/pokemon";
import {
  abilitiesEnabled,
  speciesAbility,
  type AbilityMechanic,
} from "./abilities";
import { playerProfile, type PlayerProfile } from "./playerProfile";
import { clamp } from "./ratings";
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

/** Expected usefulness in the player's actual role, not just an ability-name match. */
export function coachAbilityFit(pokemonId: number, p: PlayerProfile): number {
  const a = p.attributes;
  const shooting = (a.threePoint + a.midRange) / 2;
  const creation = (a.passing + a.ballHandling + a.composure) / 3;
  const scoring = (a.finishing + shooting) / 2;
  const defense = (a.perimeterDefense + a.interiorDefense) / 2;
  const quality: Record<AbilityMechanic, number> = {
    surge: scoring,
    aerial: (a.finishing * 2 + a.vertical) / 3,
    intimidate: defense,
    perimeter: (a.perimeterDefense * 2 + p.traits.closeout) / 3,
    armor: (a.interiorDefense * 2 + a.block) / 3,
    focus: shooting,
    range: a.threePoint,
    power: a.finishing,
    tempo: (a.speed + a.ballHandling + a.finishing) / 3,
    creator: creation,
    support: creation,
    cleanup: (a.offensiveRebound * 2 + a.finishing) / 3,
    endurance: scoring,
    clutch: (scoring + a.composure) / 2,
    momentum: scoring,
    counter: scoring,
    craft: a.midRange,
    evasion: (defense + a.stamina) / 2,
    rhythm: scoring,
    gamble: (shooting + p.traits.offBall) / 2,
    fresh: (scoring + a.stamina) / 2,
  };
  const mechanic = speciesAbility(pokemonId).mechanic;
  // Infrequent conditions receive less credit; creators and defenders use their
  // own involvement skills rather than a scorer's usage.
  const frequency: Partial<Record<AbilityMechanic, number>> = {
    surge: 0.6,
    endurance: 0.7,
    clutch: 0.35,
    momentum: 0.65,
    counter: 0.65,
    rhythm: 0.5,
    fresh: 0.65,
    cleanup: 0.75,
  };
  const involvement = [
    "creator",
    "support",
    "intimidate",
    "perimeter",
    "armor",
    "evasion",
  ].includes(mechanic)
    ? 1
    : 0.7 + (p.traits.usage / 100) * 0.3;
  return (
    clamp((quality[mechanic] - 30) / 55, 0, 1) *
    involvement *
    (frequency[mechanic] ?? 1)
  );
}

function rosterAbilityFits(team: LeagueTeam, coach: TrainerCoach) {
  return ROSTER_SLOTS.flatMap((slot) => {
    const mon = POKEMON_BY_ID.get(team.roster[slot]!);
    if (!mon) return [];
    const p = playerProfile(mon, team.development?.[mon.id]);
    // Estimate involvement from the same skill/rest preferences as the rotation;
    // a weak reserve contributes less than an effective rotation player.
    const weight =
      ((Math.max(...Object.values(p.positions)) + p.attributes.stamina * 0.08) /
        75) **
      (2.6 - coach.rest * 1.6);
    return [
      {
        ability: speciesAbility(mon.id),
        profile: p,
        fit: coachAbilityFit(mon.id, p),
        weight,
      },
    ];
  });
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
  const abilityFits = abilitiesEnabled(team)
    ? rosterAbilityFits(team, coach)
    : [];
  const totalWeight = abilityFits.reduce((n, p) => n + p.weight, 0) || 1;
  for (const p of abilityFits) {
    for (const tactic of p.ability.tactics) {
      fit[tactic] +=
        ((20 * p.fit * p.weight) / totalWeight) *
        (0.65 + coach.adaptability * 0.35);
    }
  }
  fit[coach.tactic] += 22 - 12 * coach.adaptability;
  const tactic = (Object.keys(fit) as Tactic[]).sort(
    (a, b) => fit[b] - fit[a],
  )[0];
  let defense = coach.defense;
  let threatReason = "";
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
  if (
    abilityFits.length &&
    opponent &&
    abilitiesEnabled(opponent) &&
    coach.adaptability >= 0.65
  ) {
    const threats = rosterAbilityFits(
      opponent,
      getCoach(opponent.coach?.id ?? "") ?? coach,
    );
    const weight = threats.reduce((n, p) => n + p.weight, 0) || 1;
    const threat = (
      mechanics: AbilityMechanic[],
      skill: "threePoint" | "finishing",
    ) =>
      threats.reduce(
        (n, p) =>
          n +
          (mechanics.includes(p.ability.mechanic) &&
          p.profile.attributes[skill] >= 58
            ? p.fit * p.weight
            : 0),
        0,
      ) / weight;
    const perimeter = threat(["range", "focus", "gamble"], "threePoint");
    const rim = threat(["power", "aerial", "cleanup"], "finishing");
    const shooting =
      threats.reduce((n, p) => n + p.profile.attributes.threePoint, 0) /
      Math.max(1, threats.length);
    if (perimeter > 0.25 && perimeter > rim + 0.08 && avg("speed") > 55) {
      defense = "switch";
      threatReason =
        " Opponent shooting abilities favor staying attached to shooters.";
    } else if (rim > 0.25 && rim > perimeter + 0.08 && shooting <= 75) {
      defense = "zone";
      threatReason =
        " Opponent finishing abilities favor protecting the paint.";
    }
  }
  const supporting = abilityFits
    .filter((p) => p.fit > 0 && p.ability.tactics.includes(tactic))
    .sort((a, b) => b.fit * b.weight - a.fit * a.weight);
  const abilityReason = supporting.length
    ? ` Ability fit: ${[...new Set(supporting.map((p) => p.ability.name))].slice(0, 3).join(", ")} support ${tactic} through effective rotation roles.`
    : "";
  return {
    tactic,
    defense,
    rotation: coach.rotation,
    reason: `${coach.name}: ${coach.style}. Roster fit favors ${tactic}; ${coach.rotation === "bench" ? "share the workload" : coach.rotation === "starters" ? "lean on the strongest rotation" : "balance starters and reserves"}.${abilityReason}${threatReason}`,
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
  const abilityTactic = abilitiesEnabled(team)
    ? coachGamePlan(team).tactic
    : undefined;
  const candidates = ROSTER_SLOTS.map((slot) => {
    const mon = POKEMON_BY_ID.get(team.roster[slot]!)!;
    const p = playerProfile(mon, team.development?.[mon.id]);
    return {
      slot,
      score:
        Math.max(...Object.values(p.positions)) +
        coachPlayerPreference(coach, p) +
        p.attributes.stamina * 0.08 +
        (abilityTactic
          ? coachAbilityFit(mon.id, p) *
            (speciesAbility(mon.id).tactics.includes(abilityTactic) ? 5 : 1)
          : 0),
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
