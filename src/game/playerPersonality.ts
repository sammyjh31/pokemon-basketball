import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import { clamp } from "./ratings";
import { getCoach } from "./trainerCoaches";
import { pairBond, pairKey, type PairBonds } from "./teammateChemistry";
import type { MoraleTeam } from "./playerMorale";

export interface PlayerPersonality {
  readonly pokemonId: number;
  readonly archetype: string;
  readonly description: string;
  readonly ambition: number;
  readonly loyalty: number;
  readonly resilience: number;
  readonly coachability: number;
  readonly leadership: number;
  readonly leadershipStyle: "Encourager" | "Organizer" | "Challenger";
}
export interface PersonalityTeam extends MoraleTeam {
  personalityVersion?: 1;
  chemistryBonds?: PairBonds;
}
export interface PersonalityReactions {
  minutesSensitivity: number;
  resultsSensitivity: number;
  tradeSensitivity: number;
  adaptationRate: number;
  expectedMinutesDelta: number;
  coachCompatibility: number;
  coachFitDelta: number;
  updateRate: number;
}
export interface TeamLeadership {
  captainId: number;
  score: number;
  style: PlayerPersonality["leadershipStyle"];
  moraleSupport: number;
  cohesionBonus: number;
  reasons: string[];
}
const round = (value: number) => Math.round(value * 100) / 100;
const profiles = new Map<number, PlayerPersonality>();
/** Basketball personalities are stable game adaptations, independent of team, slot and match RNG. */
export function playerPersonality(id: number): PlayerPersonality {
  if (!Number.isInteger(id) || !POKEMON_BY_ID.has(id))
    throw new Error("Unknown personality species.");
  const cached = profiles.get(id);
  if (cached) return cached;
  const trait = (salt: number) => {
    let h = Math.imul(id ^ salt, 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return 20 + (((h ^ (h >>> 16)) >>> 0) % 71);
  };
  const ambition = trait(0x173a),
    loyalty = trait(0x49bf),
    resilience = trait(0x718d),
    coachability = trait(0xade3),
    leadership = trait(0x937e);
  const archetype =
    ambition >= 72 && resilience < 50
      ? "Fiery competitor"
      : loyalty >= 70
        ? "Loyal teammate"
        : coachability >= 70
          ? "Eager learner"
          : resilience >= 70
            ? "Steady professional"
            : ambition >= 65
              ? "Driven competitor"
              : coachability <= 40
                ? "Independent spirit"
                : "Team-first contributor";
  const description = {
    "Fiery competitor":
      "Wants a meaningful role and reacts quickly to setbacks; clear expectations and encouragement help.",
    "Loyal teammate":
      "Values belonging and established relationships; roster changes take longer to settle.",
    "Eager learner":
      "Responds well to a compatible trainer and adapts readily to new responsibilities.",
    "Steady professional":
      "Stays composed through setbacks and adjusts steadily to changes.",
    "Driven competitor":
      "Seeks minutes and team success; responds well to a demanding but suitable trainer.",
    "Independent spirit":
      "Needs a compatible, flexible trainer and room to work in a clear role.",
    "Team-first contributor":
      "Accepts a supporting role more readily and values a settled team environment.",
  }[archetype];
  const leadershipStyle =
    ambition >= 65 && resilience >= 45
      ? "Challenger"
      : coachability >= loyalty
        ? "Organizer"
        : "Encourager";
  const profile = Object.freeze({
    pokemonId: id,
    archetype,
    description,
    ambition,
    loyalty,
    resilience,
    coachability,
    leadership,
    leadershipStyle,
  });
  profiles.set(id, profile);
  return profile;
}
export function personalityReactions(
  team: PersonalityTeam,
  id: number,
): PersonalityReactions {
  if (team.personalityVersion !== 1)
    return {
      minutesSensitivity: 1,
      resultsSensitivity: 1,
      tradeSensitivity: 1,
      adaptationRate: 0.85,
      expectedMinutesDelta: 0,
      coachCompatibility: 50,
      coachFitDelta: 0,
      updateRate: 0.15,
    };
  const p = playerPersonality(id),
    coach = getCoach(team.coach?.id ?? "");
  const coachCompatibility = coach
    ? round(
        clamp(
          (1 - Math.abs(coach.risk - p.ambition / 100)) * 50 +
            (1 -
              Math.abs(coach.rest - (p.loyalty + 100 - p.resilience) / 200)) *
              25 +
            (p.coachability + (100 - p.coachability) * coach.adaptability) *
              0.25,
          20,
          95,
        ),
      )
    : 50;
  return {
    minutesSensitivity: round(0.6 + p.ambition * 0.009),
    resultsSensitivity: round(
      (0.7 + p.ambition * 0.004) * (1.15 - p.resilience * 0.004),
    ),
    tradeSensitivity: round(
      clamp(0.6 + p.loyalty * 0.009 - p.resilience * 0.004, 0.55, 1.4),
    ),
    adaptationRate: round(
      clamp(0.94 - p.resilience * 0.002 - p.coachability * 0.001, 0.6, 0.88),
    ),
    expectedMinutesDelta: Math.round(((p.ambition - 55) / 35) * 3),
    coachCompatibility,
    coachFitDelta: coach
      ? round(clamp((coachCompatibility - 60) * 0.22, -7, 7))
      : 0,
    updateRate: round(0.12 + (100 - p.resilience) * 0.0007),
  };
}
/** Appointments use durable qualities, not today's mood or a starter/bench slot. */
export function teamLeadership(
  team: PersonalityTeam,
): TeamLeadership | undefined {
  if (team.personalityVersion !== 1 || team.moraleVersion !== 1)
    return undefined;
  const ids = Object.values(team.roster)
    .filter((id): id is number => id != null)
    .sort((a, b) => a - b);
  if (
    ids.length !== 8 ||
    new Set(ids).size !== 8 ||
    ids.some((id) => !POKEMON_BY_ID.has(id))
  )
    return undefined;
  const candidates = ids
    .map((id) => {
      const p = playerPersonality(id),
        a = playerProfile(
          POKEMON_BY_ID.get(id)!,
          team.development?.[id],
        ).attributes;
      const compatibility = personalityReactions(team, id).coachCompatibility;
      const experience = Math.min(1, (team.morale?.[id]?.games ?? 0) / 164);
      const familiarity =
        ids
          .filter((other) => other !== id)
          .reduce(
            (sum, other) =>
              sum + pairBond(team.chemistryBonds?.[pairKey(id, other)] ?? 0),
            0,
          ) / 7;
      const score = round(
        clamp(
          p.leadership * 0.5 +
            a.composure * 0.22 +
            compatibility * 0.12 +
            p.loyalty * 0.08 +
            p.resilience * 0.08 +
            experience * 6 +
            familiarity * 4,
        ),
      );
      return { id, p, score, compatibility, experience, familiarity };
    })
    .sort((a, b) => b.score - a.score || a.id - b.id);
  const c = candidates[0],
    confidence = clamp(team.morale?.[c.id]?.score ?? 50, 0, 100);
  const coach = getCoach(team.coach?.id ?? "");
  return {
    captainId: c.id,
    score: c.score,
    style: c.p.leadershipStyle,
    moraleSupport: round(
      clamp(
        (c.score / 100) * 1.8 +
          (confidence - 50) * 0.055 * (1 - c.p.resilience / 160),
        -3,
        3,
      ),
    ),
    cohesionBonus: round(
      clamp((c.score / 100) * 1.3 + (confidence - 50) * 0.035, -2, 2),
    ),
    reasons: [
      `${coach?.name ?? "Team staff"} chooses leadership, composure and coaching compatibility rather than the highest overall rating.`,
      `Leadership ${c.p.leadership}/100; trainer compatibility ${c.compatibility.toFixed(0)}/100.`,
      `${team.morale?.[c.id]?.games ?? 0} games of experience; ${(c.familiarity * 100).toFixed(0)}/100 average teammate familiarity.`,
      `${c.p.leadershipStyle} style; current confidence ${confidence.toFixed(0)}/100 shapes the influence.`,
    ],
  };
}
export function captainMoraleSupport(
  team: PersonalityTeam,
  id: number,
  leadership = teamLeadership(team),
): number {
  if (
    !leadership ||
    id === leadership.captainId ||
    !Object.values(team.roster).includes(id)
  )
    return 0;
  const p = playerPersonality(id);
  const response =
    leadership.style === "Encourager"
      ? 0.85 + p.loyalty / 200 + (100 - p.resilience) / 400
      : leadership.style === "Organizer"
        ? 0.75 + p.coachability / 150
        : 0.5 + (p.ambition + p.resilience - 110) / 100;
  return round(clamp(leadership.moraleSupport * response, -3, 3));
}
