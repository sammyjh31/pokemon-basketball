import { coachMoves } from "./movePolicy";
import { movesEnabled } from "./basketballMoves";
import { POKEMON_BY_ID } from "../data/pokemon";
import {
  abilitiesEnabled,
  speciesAbility,
  validateAbilityActivations,
  type AbilityBox,
} from "./abilities";
import { masteryGameXpCap, masteryLevel } from "./masteryMath";
import { playerPersonality, personalityReactions } from "./playerPersonality";
import { getCoach } from "./trainerCoaches";
import { nextRandom } from "./random";
import type { LeagueTeam } from "./types";
import type { PlayerTrainingPlan } from "./franchiseFeatures";
export type MasteryRoster = Record<number, number>;
export type MasteryBanks = Record<number, MasteryRoster>;
export interface MasteryFixture {
  home: number[];
  away: number[];
}
export interface MasteryTeam {
  roster: LeagueTeam["roster"];
  coach?: LeagueTeam["coach"];
  abilityVersion?: 1;
  abilityMasteryVersion?: 1;
  movesetVersion?: import("./moveTypes").MovesetVersion;
  tactic?: import("./types").Tactic;
  development?: LeagueTeam["development"];
  abilityMastery?: MasteryRoster;
  personalityVersion?: 1;
  engineRules?: { abilities: boolean };
  courtVersion?: import("./courtTypes").CourtVersion;
}
export interface MasteryPlayerReport {
  pokemonId: number;
  before: number;
  after: number;
  gained: number;
  levelBefore: string;
  levelAfter: string;
}
export interface MasteryGameReport {
  home: MasteryPlayerReport[];
  away: MasteryPlayerReport[];
}
export interface MasteryMilestone extends MasteryPlayerReport {
  teamId: number;
}
export interface MasteryTrainingChange extends MasteryMilestone {
  focus: PlayerTrainingPlan["focus"];
  breakthrough: boolean;
  reasons: string[];
}
type Box = AbilityBox & { pokemonId: number; minutes: number };
type Match = { homeBox: Box[]; awayBox: Box[]; overtimePeriods: number };
const round = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, n));
const ids = (team: MasteryTeam) =>
  Object.values(team.roster)
    .filter((id): id is number => id != null)
    .sort((a, b) => a - b);
function fullRoster(team: MasteryTeam): number[] {
  const all = ids(team);
  if (
    all.length !== 8 ||
    new Set(all).size !== 8 ||
    all.some((id) => !POKEMON_BY_ID.has(id))
  )
    throw new Error("Ability mastery requires eight distinct roster players.");
  return all;
}
export function masteryXp(team: MasteryTeam, id: number): number {
  return team.abilityMasteryVersion === 1
    ? (team.abilityMastery?.[id] ?? 0)
    : 0;
}
export function validateMasteryRoster(
  raw: unknown,
  team: MasteryTeam,
): MasteryRoster {
  const all = fullRoster(team);
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Object.keys(raw).length !== 8 ||
    Object.keys(raw).some(
      (key) => String(Number(key)) !== key || !all.includes(Number(key)),
    )
  )
    throw new Error("Invalid ability mastery roster.");
  return Object.fromEntries(
    all.map((id) => {
      const value = (raw as Record<number, unknown>)[id];
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1000 ||
        Math.abs(value - round(value)) > 1e-7
      )
        throw new Error("Invalid ability mastery XP.");
      return [id, value];
    }),
  );
}
function rules(home: MasteryTeam, away: MasteryTeam): boolean {
  if (
    home.abilityMasteryVersion !== away.abilityMasteryVersion ||
    (home.abilityMasteryVersion !== undefined &&
      home.abilityMasteryVersion !== 1) ||
    (home.abilityMasteryVersion === 1 &&
      (home.abilityVersion !== 1 || away.abilityVersion !== 1))
  )
    throw new Error(
      "Both teams must use matching ability mastery rules with abilities enabled.",
    );
  return home.abilityMasteryVersion === 1;
}
export function snapshotMastery(
  home: MasteryTeam,
  away: MasteryTeam,
): MasteryFixture | undefined {
  if (!rules(home, away)) return undefined;
  const side = (team: MasteryTeam) =>
    fullRoster(team).map((id) => masteryXp(team, id));
  return { home: side(home), away: side(away) };
}
export function applyMasterySnapshot<T extends MasteryTeam>(
  team: T,
  values: number[],
): T {
  const all = fullRoster(team);
  if (
    team.abilityMasteryVersion !== 1 ||
    !Array.isArray(values) ||
    values.length !== 8
  )
    throw new Error("Invalid pregame ability mastery snapshot.");
  return {
    ...team,
    abilityMastery: validateMasteryRoster(
      Object.fromEntries(all.map((id, i) => [id, values[i]])),
      team,
    ),
  };
}
export function initialMasteryBanks<T extends MasteryTeam & { id: number }>(
  teams: readonly T[],
): MasteryBanks | undefined {
  if (!teams.length) return undefined;
  for (const team of teams) rules(teams[0], team);
  return teams[0].abilityMasteryVersion === 1
    ? Object.fromEntries(
        teams.map((team) => [
          team.id,
          Object.fromEntries(
            fullRoster(team).map((id) => [id, masteryXp(team, id)]),
          ),
        ]),
      )
    : undefined;
}
export function teamsWithMastery<T extends MasteryTeam & { id: number }>(
  teams: T[],
  banks: MasteryBanks | undefined,
): T[] {
  return banks
    ? teams.map((t) =>
        t.abilityMasteryVersion === 1
          ? {
              ...t,
              abilityMastery: validateMasteryRoster(
                banks[t.id] ?? t.abilityMastery,
                t,
              ),
            }
          : t,
      )
    : teams;
}
/** XP is credited after a completed official fixture; opportunity caps prevent farming a stat category. */
export function advanceMastery(
  team: MasteryTeam,
  boxes: readonly Box[],
  overtimePeriods = 0,
): MasteryRoster {
  const all = fullRoster(team);
  if (
    !Number.isInteger(overtimePeriods) ||
    overtimePeriods < 0 ||
    boxes.length !== 8 ||
    new Set(boxes.map((b) => b.pokemonId)).size !== 8 ||
    boxes.some(
      (b) =>
        !all.includes(b.pokemonId) ||
        !Number.isFinite(b.minutes) ||
        b.minutes < 0 ||
        b.minutes > 48 + 5 * overtimePeriods + 0.05,
    )
  )
    throw new Error("Invalid ability mastery game minutes.");
  const coach = getCoach(team.coach?.id ?? ""),
    duration = 48 / (48 + 5 * overtimePeriods),
    gameCap = masteryGameXpCap(team.courtVersion),
    pace = gameCap / 1.5;
  return Object.fromEntries(
    all.map((id) => {
      const box = boxes.find((b) => b.pokemonId === id)!,
        before = masteryXp(team, id);
      const stats = box.abilityActivations
        ? validateAbilityActivations(box.abilityActivations)
        : undefined;
      if (
        team.abilityMasteryVersion !== 1 ||
        !abilitiesEnabled(team) ||
        box.minutes === 0
      )
        return [id, before];
      const p = stats?.physical;
      const uses =
        ((stats?.offense ?? 0) +
          (stats?.support ?? 0) +
          (stats?.defense ?? 0)) *
        duration;
      const contacts = ((p?.screens ?? 0) + (p?.rebounds ?? 0)) * duration;
      const motion =
        ((p?.movement ?? 0) / 20 + (p?.energySaved ?? 0) / 5) * duration;
      const learning =
        1 +
        (coach?.adaptability ?? 0) * 0.1 +
        (team.personalityVersion === 1
          ? playerPersonality(id).coachability
          : 50) *
          0.001;
      const gained = clamp(
        ((Math.min(box.minutes * duration, 48) / 30) * 0.35 +
          Math.min(uses, 24) * 0.015 +
          Math.min(contacts, 20) * 0.01 +
          Math.min(motion, 10) * 0.01 +
          (team.movesetVersion === 1
            ? Math.min(
                8,
                Object.values(stats?.moves?.uses ?? {}).reduce(
                  (n, v) => n + v!,
                  0,
                ),
              ) * 0.025
            : 0)) *
          learning *
          pace,
        0,
        gameCap,
      );
      return [id, round(Math.min(1000, before + gained))];
    }),
  );
}
function row(id: number, before: number, after: number): MasteryPlayerReport {
  return {
    pokemonId: id,
    before,
    after,
    gained: round(after - before),
    levelBefore: masteryLevel(before).name,
    levelAfter: masteryLevel(after).name,
  };
}
export function masteryGameReport(
  home: MasteryTeam,
  away: MasteryTeam,
  match: Match,
): MasteryGameReport | undefined {
  if (!rules(home, away)) return undefined;
  const side = (team: MasteryTeam, boxes: Box[]) => {
    const next = advanceMastery(team, boxes, match.overtimePeriods);
    return fullRoster(team).map((id) => row(id, masteryXp(team, id), next[id]));
  };
  return { home: side(home, match.homeBox), away: side(away, match.awayBox) };
}
export function masteryMilestones(
  home: MasteryTeam & { id: number },
  away: MasteryTeam & { id: number },
  match: Match,
): MasteryMilestone[] {
  const report = masteryGameReport(home, away, match);
  return report
    ? [
        ...report.home.map((p) => ({ ...p, teamId: home.id })),
        ...report.away.map((p) => ({ ...p, teamId: away.id })),
      ].filter((p) => p.levelBefore !== p.levelAfter)
    : [];
}
export function recordMasteryGame(
  banks: MasteryBanks | undefined,
  home: MasteryTeam & { id: number },
  away: MasteryTeam & { id: number },
  match: Match,
): void {
  if (!banks) return;
  banks[home.id] = advanceMastery(home, match.homeBox, match.overtimePeriods);
  banks[away.id] = advanceMastery(away, match.awayBox, match.overtimePeriods);
}
export function retainMastery<T extends MasteryTeam>(
  team: T,
): Omit<T, "abilityMasteryVersion" | "abilityMastery"> & {
  abilityMasteryVersion: 1;
  abilityMastery: MasteryRoster;
} {
  return {
    ...team,
    abilityMasteryVersion: 1,
    abilityMastery: Object.fromEntries(
      fullRoster(team).map((id) => [id, masteryXp(team, id)]),
    ),
  };
}
export function withRosterMastery<T extends MasteryTeam>(
  team: T,
  previous: MasteryTeam,
  sources: readonly MasteryTeam[],
  kind: "trade" | "rookie" | "free-agent",
  incoming: MasteryRoster = {},
): T {
  if (team.abilityMasteryVersion !== 1) return team;
  const old = ids(previous),
    abilityMastery = Object.fromEntries(
      fullRoster(team).map((id) => {
        if (old.includes(id)) return [id, masteryXp(previous, id)];
        if (kind === "rookie") return [id, 0];
        const source = sources.find((t) => ids(t).includes(id));
        return [id, source ? masteryXp(source, id) : (incoming[id] ?? 0)];
      }),
    );
  return {
    ...team,
    abilityMastery: validateMasteryRoster(abilityMastery, team),
  };
}
/** Independent camp stream: never consume ordinary development or match RNG. */
export function trainMastery(
  team: MasteryTeam & { id: number },
  assignments: Record<number, { plan: PlayerTrainingPlan }>,
  year: number,
  seasonSeed: number,
): { mastery: MasteryRoster; changes: MasteryTrainingChange[] } {
  const all = fullRoster(team),
    coach = getCoach(team.coach?.id ?? "");
  if (!Number.isInteger(year) || year < 1 || !Number.isFinite(seasonSeed))
    throw new Error("Invalid mastery training season.");
  const changes = all.map((id) => {
    const before = masteryXp(team, id),
      plan = assignments[id]?.plan,
      focus = plan?.focus ?? "balanced",
      enabled = team.abilityMasteryVersion === 1 && abilitiesEnabled(team);
    const coachability =
      team.personalityVersion === 1 ? playerPersonality(id).coachability : 50;
    const compatibility =
      team.personalityVersion === 1
        ? personalityReactions(team, id).coachCompatibility
        : 50;
    const movePlan = team.tactic
      ? coachMoves({ ...team, tactic: team.tactic }, id)
      : undefined;
    const movePractice = !!movePlan?.moves.length && focus === movePlan.focus;
    const aligned = focus === speciesAbility(id).training;
    const seed =
      (seasonSeed ^
        Math.imul(year, 0x45d9f3b) ^
        Math.imul(id, 0x119de1f3) ^
        0x6b89a27d) >>>
      0;
    const breakthrough =
      enabled &&
      before < 1000 &&
      nextRandom(seed).value < 0.08 + (coach?.risk ?? 0.3) * 0.12;
    const practice = coach
      ? 16 + coach.adaptability * 8 + coachability * 0.08 + compatibility * 0.05
      : 12;
    const workload =
      plan?.intensity === "aggressive"
        ? 1.08
        : plan?.intensity === "steady"
          ? 0.96
          : 1;
    const gained = enabled
      ? clamp(
          (practice + (aligned ? 8 : 0) + (movePractice ? 8 : 0)) * workload +
            (breakthrough ? 15 : 0),
          0,
          65,
        )
      : 0;
    const after = round(Math.min(1000, before + gained));
    return {
      ...row(id, before, after),
      teamId: team.id,
      focus,
      breakthrough,
      reasons: [
        enabled
          ? `${coach?.name ?? "Team staff"} directs ${focus} practice${aligned ? ", matching this ability's training focus" : ""}.`
          : "Abilities are disabled; stored mastery is retained without earning XP.",
        `Coachability ${coachability}/100 and trainer compatibility ${compatibility.toFixed(0)}/100 shape learning; ${plan?.intensity ?? "standard"} workload respects the assigned training plan.`,
        ...(movePlan?.moves.length
          ? [
              `Automatic move practice: ${movePlan.moves.map((m) => m.name).join(", ")}; ${movePractice ? "aligned practice earns eight additional XP before workload and caps" : "team-focused practice retains existing learning"}. Specialization follows the coach’s pregame assignment; stored XP stays with the player.`,
            ]
          : []),
        breakthrough
          ? "A recorded training breakthrough adds extra mastery experience."
          : before >= 1000
            ? "Maximum mastery reached; experience remains capped at 1,000."
            : "Regular practice builds on official game experience; no experience is retroactively awarded.",
      ],
    };
  });
  return {
    mastery: Object.fromEntries(changes.map((p) => [p.pokemonId, p.after])),
    changes,
  };
}
