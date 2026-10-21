import { shinyPokemon } from "./shiny";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile, type PlayerProfile } from "./playerProfile";
import { getCoach } from "./trainerCoaches";
import { clamp } from "./ratings";
import type { LeagueTeam, LeagueBox, Attributes } from "./types";
import type { PairBonds } from "./teammateChemistry";
import {
  playerPersonality,
  personalityReactions,
  teamLeadership,
  captainMoraleSupport,
  type PlayerPersonality,
  type TeamLeadership,
} from "./playerPersonality";

/** Current feelings travel with a species; they are never attached to a roster slot. */
export interface PlayerMorale {
  score: number;
  minutes: number;
  success: number;
  disruption: number;
  games: number;
}
export type MoraleRoster = Record<number, PlayerMorale>;
export type MoraleBanks = Record<number, MoraleRoster>;
export interface MoraleFixture {
  home: number[];
  away: number[];
}
export interface MoraleTeam {
  shinySeed?: LeagueTeam["shinySeed"];
  roster: LeagueTeam["roster"];
  coach?: LeagueTeam["coach"];
  development?: LeagueTeam["development"];
  moraleVersion?: 1;
  morale?: MoraleRoster;
  personalityVersion?: 1;
  chemistryBonds?: PairBonds;
}
export type MoraleAction =
  | "settling-in"
  | "role-support"
  | "recovery"
  | "encouragement"
  | "challenge"
  | "steady-role";
export interface MoraleAssessment {
  pokemonId: number;
  score: number;
  status: string;
  expectedMinutes: number;
  recentMinutes: number;
  fit: number;
  success: number;
  disruption: number;
  action: MoraleAction;
  actionLabel: string;
  minuteAdjustment: number;
  skillDelta: number;
  reasons: string[];
  personality?: PlayerPersonality;
  coachCompatibility?: number;
  captainSupport?: number;
  captainId?: number;
}
export interface MoralePlayerReport extends MoraleAssessment {
  before: number;
  after: number;
}
export interface MoraleGameReport {
  home: MoralePlayerReport[];
  away: MoralePlayerReport[];
  captains?: { home: TeamLeadership; away: TeamLeadership };
}
type Box = Pick<LeagueBox, "pokemonId" | "minutes">;
type MoraleMatch = {
  homeScore: number;
  awayScore: number;
  homeBox: Box[];
  awayBox: Box[];
  overtimePeriods: number;
};
const round = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
};
const fields = ["score", "minutes", "success", "disruption", "games"] as const;
const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
export const neutralMorale = (): PlayerMorale => ({
  score: 50,
  minutes: 0,
  success: 50,
  disruption: 0,
  games: 0,
});
const rosterIds = (team: MoraleTeam) =>
  Object.values(team.roster)
    .filter((id): id is number => id != null)
    .sort((a, b) => a - b);
const fullRoster = (team: MoraleTeam) => {
  const ids = rosterIds(team);
  if (
    ids.length !== 8 ||
    new Set(ids).size !== 8 ||
    ids.some((id) => !POKEMON_BY_ID.has(id))
  )
    throw new Error("Morale requires eight distinct roster players.");
  return ids;
};
export function moraleState(team: MoraleTeam, id: number): PlayerMorale {
  return team.moraleVersion === 1
    ? (team.morale?.[id] ?? neutralMorale())
    : neutralMorale();
}
export function moraleScores(
  team: MoraleTeam,
): Record<number, number> | undefined {
  return team.moraleVersion === 1
    ? Object.fromEntries(
        rosterIds(team).map((id) => [id, moraleState(team, id).score]),
      )
    : undefined;
}
export function moraleSkillDelta(team: MoraleTeam, id: number): number {
  return team.moraleVersion === 1
    ? round(clamp((moraleState(team, id).score - 50) * 0.06, -3, 3))
    : 0;
}
const executionSkills: (keyof Attributes)[] = [
  "shooting",
  "playmaking",
  "finishing",
  "threePoint",
  "midRange",
  "freeThrow",
  "ballHandling",
  "passing",
  "composure",
  "perimeterDefense",
  "interiorDefense",
  "steal",
  "block",
];
/** Temporary execution only. Base positional ratings and physical attributes remain intact. */
export function moraleProfile(
  profile: PlayerProfile,
  team: MoraleTeam,
  id: number,
): PlayerProfile {
  const delta = moraleSkillDelta(team, id);
  if (!delta) return profile;
  const attributes = { ...profile.attributes };
  for (const key of executionSkills)
    attributes[key] = clamp(attributes[key] + delta);
  return {
    ...profile,
    attributes,
    traits: {
      ...profile.traits,
      decisionMaking: clamp(profile.traits.decisionMaking + delta),
      discipline: clamp(profile.traits.discipline + delta),
    },
  };
}
function expectations(team: MoraleTeam, id: number): number {
  const ranked = rosterIds(team)
    .map((pokemonId) => {
      const mon = POKEMON_BY_ID.get(pokemonId)!;
      return {
        id: pokemonId,
        value: Math.max(
          ...Object.values(
            playerProfile(
              shinyPokemon(mon, team.shinySeed),
              team.development?.[pokemonId],
            ).positions,
          ),
        ),
      };
    })
    .sort((a, b) => b.value - a.value || a.id - b.id);
  const rank = ranked.findIndex((p) => p.id === id);
  const base = [34, 32, 30, 28, 26, 20, 16, 12][Math.max(0, rank)] ?? 12;
  return round(
    clamp(base + personalityReactions(team, id).expectedMinutesDelta, 9, 37),
  );
}
function coachFit(team: MoraleTeam, id: number): number {
  const coach = getCoach(team.coach?.id ?? ""),
    mon = POKEMON_BY_ID.get(id);
  if (!coach || !mon) return 50;
  const a = playerProfile(
    shinyPokemon(mon, team.shinySeed),
    team.development?.[id],
  ).attributes;
  const offense = {
    balanced: mean([a.passing, a.composure]),
    pace: mean([a.speed, a.stamina, a.ballHandling]),
    perimeter: (a.threePoint * 2 + a.passing) / 3,
    interior: mean([a.finishing, a.strength, a.rebounding]),
    defense: mean([a.perimeterDefense, a.interiorDefense]),
  };
  const defense = {
    man: mean([a.perimeterDefense, a.interiorDefense, a.composure]),
    switch:
      Math.min(a.perimeterDefense, a.interiorDefense) * 0.6 + a.speed * 0.4,
    zone: mean([a.interiorDefense, a.block, a.defensiveRebound]),
    press: mean([a.speed, a.steal, a.stamina]),
  };
  const preferred = offense[coach.tactic] * 0.6 + defense[coach.defense] * 0.4;
  // Adaptable coaches can find a useful job for a player outside their preferred scheme.
  return round(
    clamp(
      preferred * (1 - coach.adaptability * 0.25) +
        Math.max(...Object.values(offense)) * coach.adaptability * 0.25,
    ),
  );
}
export function moraleAssessment(
  team: MoraleTeam,
  id: number,
  leadership = teamLeadership(team),
): MoraleAssessment {
  const reaction = personalityReactions(team, id);
  const state = moraleState(team, id),
    expected = expectations(team, id),
    fit = round(clamp(coachFit(team, id) + reaction.coachFitDelta));
  const coach = getCoach(team.coach?.id ?? ""),
    mon = POKEMON_BY_ID.get(id);
  const stamina = mon
    ? playerProfile(shinyPokemon(mon, team.shinySeed), team.development?.[id])
        .attributes.stamina
    : 60;
  const ratio = state.games ? state.minutes / expected : 1;
  let action: MoraleAction = "steady-role",
    actionLabel = "Maintain a clear role",
    minuteAdjustment = 0;
  if (
    state.games &&
    (state.minutes >= 37 || (state.minutes >= 33 && stamina < 55))
  ) {
    action = "recovery";
    actionLabel = "Ease the workload and emphasize recovery";
    minuteAdjustment = -2;
  } else if (state.disruption < -2) {
    action = "settling-in";
    actionLabel = "Help the new group settle in";
    minuteAdjustment = 1;
  } else if (state.games && ratio < 0.8) {
    action = "role-support";
    actionLabel = "Create more opportunities in the rotation";
    minuteAdjustment = round(
      clamp((1 - ratio) * 4 * reaction.minutesSensitivity, 1, 3),
    );
  } else if (state.success < 42 || state.score < 42) {
    action = "encouragement";
    actionLabel = "Rebuild confidence with a steady role";
    minuteAdjustment = 0.5;
  } else if (state.score >= 65 && fit >= 65) {
    action = "challenge";
    actionLabel = "Build on confidence without overloading";
  }
  if (!coach) minuteAdjustment = 0;
  const reasons = [
    state.games
      ? `Recent ${state.minutes.toFixed(1)} MPG against a ${expected}-minute role expectation.`
      : `No games yet; a ${expected}-minute role expectation based on developed ability.`,
    `Recent team success: ${state.success.toFixed(0)}% (weighted results).`,
    coach
      ? `Fit with ${coach.name}'s style: ${fit.toFixed(0)}/100.`
      : "Coaching fit is neutral without an assigned trainer.",
    state.disruption < 0
      ? `Roster changes: ${state.disruption.toFixed(1)} adjustment pressure, easing as games are played.`
      : "The roster situation is settled.",
  ];
  if (team.personalityVersion === 1) {
    reasons.push(
      `${playerPersonality(id).archetype}: role expectations and reactions reflect this player's personality.`,
    );
    if (coach)
      reasons.push(
        `Personality compatibility with ${coach.name}: ${reaction.coachCompatibility.toFixed(0)}/100.`,
      );
    if (leadership)
      reasons.push(
        id === leadership.captainId
          ? `Team captain: ${leadership.style.toLowerCase()} leadership; influence depends on confidence and teammates' personalities.`
          : `Captain's support: ${captainMoraleSupport(team, id, leadership).toFixed(1)} to the postgame morale target.`,
      );
  }
  return {
    pokemonId: id,
    score: state.score,
    status:
      state.score >= 65
        ? "Confident"
        : state.score < 40
          ? "Unsettled"
          : "Steady",
    expectedMinutes: expected,
    recentMinutes: state.minutes,
    fit,
    success: state.success,
    disruption: state.disruption,
    action,
    actionLabel,
    minuteAdjustment,
    skillDelta: moraleSkillDelta(team, id),
    reasons,
    ...(team.personalityVersion === 1
      ? {
          personality: playerPersonality(id),
          coachCompatibility: reaction.coachCompatibility,
          captainSupport: captainMoraleSupport(team, id, leadership),
          ...(leadership ? { captainId: leadership.captainId } : {}),
        }
      : {}),
  };
}
/** Complete a fixture once; overtime is normalized so extra periods don't inflate role satisfaction. */
export function advanceMorale(
  team: MoraleTeam,
  boxes: readonly Box[],
  won: boolean,
  overtimePeriods = 0,
): MoraleRoster {
  const ids = fullRoster(team);
  if (
    !Number.isInteger(overtimePeriods) ||
    overtimePeriods < 0 ||
    boxes.length !== 8 ||
    new Set(boxes.map((b) => b.pokemonId)).size !== 8 ||
    boxes.some(
      (b) =>
        !ids.includes(b.pokemonId) ||
        !Number.isFinite(b.minutes) ||
        b.minutes < 0 ||
        b.minutes > 48 + 5 * overtimePeriods + 0.05,
    )
  )
    throw new Error("Invalid morale game minutes.");
  const coach = getCoach(team.coach?.id ?? ""),
    leadership = teamLeadership(team);
  return Object.fromEntries(
    ids.map((id) => {
      const prior = moraleState(team, id),
        assessment = moraleAssessment(team, id, leadership),
        reaction = personalityReactions(team, id);
      const actual = clamp(
        (boxes.find((b) => b.pokemonId === id)!.minutes * 48) /
          (48 + 5 * overtimePeriods),
        0,
        48,
      );
      const minutes = round(
        prior.games ? prior.minutes * 0.8 + actual * 0.2 : actual,
      );
      const success = round(prior.success * 0.88 + (won ? 100 : 0) * 0.12);
      const time = clamp(
        (minutes / assessment.expectedMinutes - 1) * 20,
        -22,
        10,
      );
      const fit = coach ? clamp((assessment.fit - 60) * 0.25, -7, 7) : 0;
      const support = coach
        ? assessment.action === "steady-role" ||
          assessment.action === "challenge"
          ? 1
          : 2.5 + coach.adaptability
        : 0;
      const target = clamp(
        50 +
          time * reaction.minutesSensitivity +
          (success - 50) * 0.2 * reaction.resultsSensitivity +
          fit +
          prior.disruption +
          support *
            (team.personalityVersion === 1
              ? 0.7 + reaction.coachCompatibility * 0.006
              : 1) +
          (assessment.captainSupport ?? 0),
        20,
        85,
      );
      return [
        id,
        {
          score: round(
            clamp(
              prior.score + (target - prior.score) * reaction.updateRate,
              20,
              85,
            ),
          ),
          minutes,
          success,
          disruption: round(
            prior.disruption *
              (team.personalityVersion === 1
                ? clamp(
                    reaction.adaptationRate -
                      (coach?.adaptability ?? 0) * 0.08 -
                      Math.max(0, assessment.captainSupport ?? 0) * 0.01,
                    0.55,
                    0.88,
                  )
                : coach && prior.disruption < -2
                  ? 0.7
                  : 0.85),
          ),
          games: Math.min(10000, prior.games + 1),
        },
      ];
    }),
  );
}
export function moraleGameReport(
  home: MoraleTeam,
  away: MoraleTeam,
  match: MoraleMatch,
): MoraleGameReport | undefined {
  if (home.moraleVersion !== away.moraleVersion)
    throw new Error("Mixed morale rules.");
  if (home.moraleVersion !== 1) return undefined;
  if (home.personalityVersion !== away.personalityVersion)
    throw new Error("Mixed personality rules.");
  const side = (team: MoraleTeam, boxes: Box[], won: boolean) => {
    const next = advanceMorale(team, boxes, won, match.overtimePeriods);
    const leadership = teamLeadership(team);
    return fullRoster(team).map((id) => ({
      ...moraleAssessment(team, id, leadership),
      before: moraleState(team, id).score,
      after: next[id].score,
    }));
  };
  const homeCaptain = teamLeadership(home),
    awayCaptain = teamLeadership(away);
  return {
    home: side(home, match.homeBox, match.homeScore > match.awayScore),
    away: side(away, match.awayBox, match.awayScore > match.homeScore),
    ...(homeCaptain && awayCaptain
      ? { captains: { home: homeCaptain, away: awayCaptain } }
      : {}),
  };
}
export function validateMoraleRoster(
  raw: unknown,
  team: MoraleTeam,
): MoraleRoster {
  const ids = fullRoster(team);
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Object.keys(raw).length !== 8 ||
    Object.keys(raw).some(
      (id) => !ids.includes(Number(id)) || String(Number(id)) !== id,
    )
  )
    throw new Error("Invalid player morale roster.");
  return Object.fromEntries(
    ids.map((id) => {
      const value = (raw as Record<number, unknown>)[id];
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).length !== 5 ||
        Object.keys(value).some(
          (k) => !fields.includes(k as (typeof fields)[number]),
        )
      )
        throw new Error("Invalid player morale record.");
      const p = value as PlayerMorale;
      if (
        fields.some(
          (k) =>
            typeof p[k] !== "number" ||
            !Number.isFinite(p[k]) ||
            Math.abs(p[k] - round(p[k])) > 1e-7,
        ) ||
        p.score < 0 ||
        p.score > 100 ||
        p.minutes < 0 ||
        p.minutes > 48 ||
        p.success < 0 ||
        p.success > 100 ||
        p.disruption < -10 ||
        p.disruption > 10 ||
        !Number.isInteger(p.games) ||
        p.games < 0 ||
        p.games > 10000
      )
        throw new Error("Invalid player morale values.");
      return [
        id,
        Object.fromEntries(
          fields.map((k) => [k, p[k]]),
        ) as unknown as PlayerMorale,
      ];
    }),
  );
}
export function snapshotMorale(
  home: MoraleTeam,
  away: MoraleTeam,
): MoraleFixture | undefined {
  if (home.moraleVersion !== away.moraleVersion)
    throw new Error("Mixed morale rules.");
  if (home.moraleVersion !== 1) return undefined;
  const side = (t: MoraleTeam) =>
    fullRoster(t).flatMap((id) => fields.map((k) => moraleState(t, id)[k]));
  return { home: side(home), away: side(away) };
}
export function applyMoraleSnapshot<T extends MoraleTeam>(
  team: T,
  values: number[],
): T {
  const ids = fullRoster(team);
  if (
    team.moraleVersion !== 1 ||
    !Array.isArray(values) ||
    values.length !== 40
  )
    throw new Error("Invalid pregame morale snapshot.");
  const morale = Object.fromEntries(
    ids.map((id, i) => [
      id,
      Object.fromEntries(fields.map((k, j) => [k, values[i * 5 + j]])),
    ]),
  );
  return { ...team, morale: validateMoraleRoster(morale, team) };
}
export function initialMoraleBanks(
  teams: readonly (MoraleTeam & { id: number })[],
): MoraleBanks | undefined {
  const enabled = teams[0]?.moraleVersion === 1;
  if (teams.some((t) => (t.moraleVersion === 1) !== enabled))
    throw new Error("Mixed morale rules.");
  return enabled
    ? Object.fromEntries(
        teams.map((t) => [
          t.id,
          Object.fromEntries(
            fullRoster(t).map((id) => [id, { ...moraleState(t, id) }]),
          ),
        ]),
      )
    : undefined;
}
export function teamsWithMorale<T extends MoraleTeam & { id: number }>(
  teams: T[],
  banks: MoraleBanks | undefined,
): T[] {
  return banks
    ? teams.map((t) =>
        t.moraleVersion === 1
          ? { ...t, morale: validateMoraleRoster(banks[t.id] ?? t.morale, t) }
          : t,
      )
    : teams;
}
export function recordMoraleGame(
  banks: MoraleBanks | undefined,
  home: MoraleTeam & { id: number },
  away: MoraleTeam & { id: number },
  match: MoraleMatch,
): void {
  if (!banks) return;
  // Use the fixture's immutable pregame teams, never an already-updated bank.
  banks[home.id] = advanceMorale(
    home,
    match.homeBox,
    match.homeScore > match.awayScore,
    match.overtimePeriods,
  );
  banks[away.id] = advanceMorale(
    away,
    match.awayBox,
    match.awayScore > match.homeScore,
    match.overtimePeriods,
  );
}
export function withRosterMorale<T extends MoraleTeam>(
  team: T,
  previous: MoraleTeam,
  sources: readonly MoraleTeam[],
  kind: "trade" | "rookie" | "free-agent",
): T {
  if (team.moraleVersion !== 1) return team;
  const old = rosterIds(previous),
    ids = fullRoster(team),
    departures = old.filter((id) => !ids.includes(id)).length;
  if (!departures && ids.every((id) => old.includes(id))) return team;
  const morale = Object.fromEntries(
    ids.map((id) => {
      const sensitivity = personalityReactions(team, id).tradeSensitivity;
      if (old.includes(id)) {
        const state = moraleState(previous, id);
        return [
          id,
          {
            ...state,
            score: round(
              clamp(state.score - departures * 0.5 * sensitivity, 0, 100),
            ),
            disruption: round(
              clamp(state.disruption - departures * sensitivity, -10, 10),
            ),
          },
        ];
      }
      const source =
        kind === "trade"
          ? sources.find((t) => rosterIds(t).includes(id))
          : undefined;
      const state = source ? moraleState(source, id) : neutralMorale();
      return [
        id,
        {
          ...state,
          score: round(
            clamp(
              state.score - (kind === "trade" ? 4 : 0) * sensitivity,
              0,
              100,
            ),
          ),
          disruption: round(
            clamp(
              state.disruption -
                (kind === "trade" ? 6 : kind === "rookie" ? 4 : 2) *
                  sensitivity,
              -10,
              10,
            ),
          ),
        },
      ];
    }),
  );
  return { ...team, morale };
}
export function retainMorale<T extends MoraleTeam>(
  team: T,
): Omit<T, "moraleVersion" | "morale"> & {
  moraleVersion: 1;
  morale: MoraleRoster;
} {
  const morale = Object.fromEntries(
    fullRoster(team).map((id) => {
      const p = moraleState(team, id);
      return [
        id,
        {
          score: round(50 + (p.score - 50) * 0.5),
          minutes: p.minutes,
          success: round(50 + (p.success - 50) * 0.5),
          disruption: round(p.disruption * 0.5),
          games: p.games,
        },
      ];
    }),
  );
  return { ...team, moraleVersion: 1, morale };
}
