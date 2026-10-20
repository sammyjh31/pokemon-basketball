import { createEvaluationContext, evaluatePlayer } from "./teamEvaluation";
import { getCoach } from "./trainerCoaches";
import { coachPlayerPreference } from "./coachPolicy";
import { matchupPreference, type BodyProfile } from "./bodyMatchups";
import type { EngineProfile } from "./engineDepth";
import type { PlayerProfile } from "./playerProfile";
import { typeLineupBonuses } from "./typeCoaching";
import { POSITIONS, type LeagueBox, type LeagueTeam } from "./types";
import { chemistryEnabled, type ChemistryEffects } from "./lineupChemistry";
import { getMatchChemistry, refreshLineupChemistry } from "./matchChemistry";
type Side = "home" | "away";
export interface Player {
  moves?: import("./matchMoves").MoveRuntime;
  chemistry?: ChemistryEffects;
  /** Game-flow field condition: movement and energy-drain multipliers. */
  field?: { movement: number; drain: number };
  physicalAbilities?: true;
  masteryXp?: number;
  depth?: EngineProfile;
  body?: BodyProfile;
  types: readonly string[];
  typeEdges: Map<Player, number>;
  profile: PlayerProfile;
  box: LeagueBox;
  target: number;
  energy: number;
  consecutive: number;
}
export interface Team {
  combos?: import("./matchCombos").ComboRuntime;
  config: LeagueTeam;
  players: Player[];
  floor: Player[]; // Ordered PG, SG, SF, PF, C, including substitute roles.
  side: Side;
  fouls: number;
  transition: number;
  counterSubstitutions?: number;
  evaluation?: {
    tactic: string;
    defense: string;
    scores: Map<number, number[]>;
  };
}
/** Cache only within a match; refresh when an in-game scheme changes. */
function roleValue(team: Team, player: Player, role: number): number {
  if (team.config.evaluationVersion !== 1)
    return player.profile.positions[POSITIONS[role]];
  const { tactic, defense } = team.config;
  if (
    !team.evaluation ||
    team.evaluation.tactic !== tactic ||
    team.evaluation.defense !== defense
  ) {
    // Match config already contains the coach's current plan, including adjustments.
    const context = createEvaluationContext({
      ...team.config,
      coach: undefined,
    });
    team.evaluation = {
      tactic,
      defense,
      scores: new Map(
        team.players.map((p) => [
          p.box.pokemonId,
          POSITIONS.map(
            (position) =>
              evaluatePlayer(context, p.box.pokemonId, position).score,
          ),
        ]),
      ),
    };
  }
  return team.evaluation.scores.get(player.box.pokemonId)![role];
}
const ROLE_ORDER = [0, 4, 1, 3, 2];

function eligiblePlayers(team: Team): Player[] {
  const eligible = team.players.filter((p) => p.box.fouls < 6);
  if (team.config.rotationPlan) {
    const active = eligible.filter((p) => p.target > 0);
    // A zero-minute player is emergency cover only after foul-outs deplete the rotation.
    if (active.length < 5)
      active.push(
        ...eligible.filter((p) => p.target === 0).slice(0, 5 - active.length),
      );
    eligible.splice(0, eligible.length, ...active);
  }
  // Depleted-roster exception: basketball always remains five-on-five. Return
  // only the minimum disqualified players, preferring the fewest fouls. Every
  // subsequent personal foul by a returned player also incurs a technical FT.
  if (eligible.length < 5)
    eligible.push(
      ...team.players
        .filter((p) => p.box.fouls >= 6)
        .sort((a, b) => a.box.fouls - b.box.fouls || b.energy - a.energy)
        .slice(0, 5 - eligible.length),
    );
  return eligible;
}

const edge = (a: Player, b: Player) => a.typeEdges.get(b) ?? 0;
function scoutLineup(team: Team, opponents: readonly Player[]) {
  return new Map(
    team.config.typeMatchupsVersion === 1
      ? team.players.map(
          (p) =>
            [
              p,
              typeLineupBonuses(p, opponents, edge).map(
                (bonus, role) =>
                  bonus +
                  (p.body && opponents[role]?.body
                    ? Math.log(
                        matchupPreference(
                          p,
                          opponents[role],
                          role >= 3 ? "post" : "isolation",
                        ),
                      ) *
                        4 -
                      Math.log(
                        matchupPreference(
                          opponents[role],
                          p,
                          role >= 3 ? "post" : "isolation",
                        ),
                      ) *
                        4
                    : 0),
              ),
            ] as const,
        )
      : [],
  );
}

function recordCounters(
  team: Team,
  previous: Player[],
  bonuses: Map<Player, number[]>,
  opponents: readonly Player[],
) {
  if (team.counterSubstitutions === undefined) return;
  // The reported counter statistic measures typing, even when a physical
  // mismatch also influenced the coach's selection.
  const typeBonus = (p: Player, role: number) =>
    p.body
      ? (typeLineupBonuses(p, opponents, edge)[role] ?? 0)
      : (bonuses.get(p)?.[role] ?? 0);
  team.floor.forEach((p, role) => {
    if (
      !previous.includes(p) &&
      !team.floor.includes(previous[role]) &&
      typeBonus(p, role) > typeBonus(previous[role], role) + 0.5
    )
      team.counterSubstitutions!++;
  });
}

export function chooseLineup(
  team: Team,
  minute: number,
  close: boolean,
  opponents: readonly Player[] = [],
  garbage = false,
): void {
  if (chemistryEnabled(team.config)) {
    chooseChemistryLineup(team, minute, close, opponents, garbage);
    return;
  }
  const coach = getCoach(team.config.coach?.id ?? "");
  const pool = eligiblePlayers(team),
    chosen: Player[] = [];
  const bonuses = scoutLineup(team, opponents);
  const closers =
    close && team.config.rotationPlan
      ? pool.filter((p) =>
          team.config.rotationPlan!.closing.includes(p.box.slot),
        )
      : [];
  const phase = Math.min(minute / 48, 1);
  for (const role of ROLE_ORDER) {
    let best: Player | undefined,
      bestScore = -Infinity;
    for (const p of pool) {
      if (chosen.includes(p)) continue;
      // Assign every available requested closer a role before choosing foul-out cover.
      if (
        closers.some((closer) => !chosen.includes(closer)) &&
        !closers.includes(p)
      )
        continue;
      const foulPenalty = foulTroublePenalty(team, p, minute);
      const debt = p.target * phase - Math.min(p.box.minutes, 48);
      const basketballScore = garbage
        ? // Garbage time: rest the regulars and give the deepest reserves the floor.
          roleValue(team, p, role) * 0.3 +
          p.energy * 0.25 -
          p.target * 1.5 -
          foulPenalty
        : close
          ? roleValue(team, p, role) * 0.85 +
            p.energy * 0.42 +
            p.profile.attributes.composure * 0.12 -
            foulPenalty * closingFoulWeight(team)
          : roleValue(team, p, role) * 0.5 +
            p.energy * 0.22 +
            p.target * 0.8 +
            debt * 5 -
            foulPenalty -
            Math.max(0, p.consecutive - 7) * 1.2;
      const score =
        basketballScore +
        (coach
          ? (team.config.evaluationVersion === 1
              ? 0
              : coachPlayerPreference(coach, p.profile)) -
            (1 - p.energy / 100) * coach.rest * 8 -
            foulPenalty * coach.rest * 0.35
          : 0) +
        (bonuses.get(p)?.[role] ?? 0) +
        (bonuses.size && team.floor[role] === p ? 1.5 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    chosen[role] = best!;
  }
  const previous = team.floor;
  team.floor = chosen;
  if (minute > 0) recordCounters(team, previous, bonuses, opponents);
}

/** Version-2 coaches sit foul trouble ahead of minute targets, and keep a
 * five-foul player off the floor until the closing minutes. */
function foulTroublePenalty(team: Team, p: Player, minute: number) {
  const threshold = minute < 12 ? 2 : minute < 24 ? 3 : minute < 36 ? 4 : 5;
  if ((team.config.courtVersion ?? 0) >= 2)
    return (
      (minute < 43 && p.box.fouls >= threshold
        ? 60 + (p.box.fouls - threshold) * 30
        : 0) + (p.box.fouls >= 5 && minute < 46 ? 80 : 0)
    );
  return minute < 43 && p.box.fouls >= threshold
    ? 14 + (p.box.fouls - threshold) * 9
    : 0;
}
const closingFoulWeight = (team: Team) =>
  (team.config.courtVersion ?? 0) >= 2 ? 0.6 : 0.2;

/** Score each player/role once, then compare at most C(8, 5) complete units. */
function chooseChemistryLineup(
  team: Team,
  minute: number,
  close: boolean,
  opponents: readonly Player[],
  garbage = false,
) {
  const coach = getCoach(team.config.coach?.id ?? "");
  const pool = eligiblePlayers(team),
    bonuses = scoutLineup(team, opponents);
  const closers =
    close && team.config.rotationPlan
      ? pool.filter((p) =>
          team.config.rotationPlan!.closing.includes(p.box.slot),
        )
      : [];
  const phase = Math.min(minute / 48, 1);
  const scores = new Map(
    pool.map((p) => {
      const foulPenalty = foulTroublePenalty(team, p, minute);
      const debt = p.target * phase - Math.min(p.box.minutes, 48);
      return [
        p,
        POSITIONS.map((_, role) => {
          const basketball = garbage
            ? // Version-3 garbage time: rest the regulars.
              roleValue(team, p, role) * 0.3 +
              p.energy * 0.25 -
              p.target * 1.5 -
              foulPenalty
            : close
              ? roleValue(team, p, role) * 0.85 +
                p.energy * 0.42 +
                p.profile.attributes.composure * 0.12 -
                foulPenalty * closingFoulWeight(team)
              : roleValue(team, p, role) * 0.5 +
                p.energy * 0.22 +
                p.target * 0.8 +
                debt * 5 -
                foulPenalty -
                Math.max(0, p.consecutive - 7) * 1.2;
          return (
            basketball +
            (coach
              ? (team.config.evaluationVersion === 1
                  ? 0
                  : coachPlayerPreference(coach, p.profile)) -
                (1 - p.energy / 100) * coach.rest * 8 -
                foulPenalty * coach.rest * 0.35
              : 0) +
            (bonuses.get(p)?.[role] ?? 0) +
            (bonuses.size && team.floor[role] === p ? 1.5 : 0)
          );
        }),
      ] as const;
    }),
  );
  let bestScore = -Infinity,
    best = team.floor;
  const visit = (start: number, unit: Player[]) => {
    if (unit.length === 5) {
      if (closers.some((p) => !unit.includes(p))) return;
      const floor: Player[] = [];
      let score = 0;
      for (const role of ROLE_ORDER) {
        let selected: Player | undefined,
          value = -Infinity;
        for (const p of unit) {
          if (floor.includes(p)) continue;
          const candidate = scores.get(p)![role];
          if (candidate > value) {
            value = candidate;
            selected = p;
          }
        }
        floor[role] = selected!;
        score += value;
      }
      score += (getMatchChemistry(team, floor)?.value ?? 0) * 5;
      if (score > bestScore) {
        bestScore = score;
        best = floor;
      }
      return;
    }
    for (let i = start; i <= pool.length - (5 - unit.length); i++) {
      unit.push(pool[i]);
      visit(i + 1, unit);
      unit.pop();
    }
  };
  visit(0, []);
  const previous = team.floor;
  team.floor = best;
  refreshLineupChemistry(team);
  if (minute > 0) recordCounters(team, previous, bonuses, opponents);
}

export function replaceFoulOut(
  team: Team,
  opponents: readonly Player[] = [],
): void {
  const eligible = eligiblePlayers(team);
  // Most fouls need no replacement, so avoid scouting again on every whistle.
  if (team.floor.every((p) => eligible.includes(p))) return;
  const bonuses = scoutLineup(team, opponents);
  const previous = [...team.floor];
  team.floor.forEach((p, role) => {
    if (eligible.includes(p)) return;
    const available = eligible.filter(
      (candidate) => !team.floor.includes(candidate),
    );
    available.sort(
      (a, b) =>
        roleValue(team, b, role) +
        b.energy * 0.25 +
        (bonuses.get(b)?.[role] ?? 0) +
        (chemistryEnabled(team.config)
          ? (getMatchChemistry(
              team,
              team.floor.map((p, i) => (i === role ? b : p)),
            )?.value ?? 0) * 5
          : 0) -
        (roleValue(team, a, role) +
          a.energy * 0.25 +
          (bonuses.get(a)?.[role] ?? 0) +
          (chemistryEnabled(team.config)
            ? (getMatchChemistry(
                team,
                team.floor.map((p, i) => (i === role ? a : p)),
              )?.value ?? 0) * 5
            : 0)),
    );
    team.floor[role] = available[0];
  });
  recordCounters(team, previous, bonuses, opponents);
  refreshLineupChemistry(team);
}
