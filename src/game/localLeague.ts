import { neutralMorale } from "./playerMorale";
import { createEvaluationContext, evaluatePlayer } from "./teamEvaluation";
import { validateCoach } from "./trainerCoaches";
import {
  ALL_POKEMON,
  FRANCHISE_POKEMON,
  POKEMON,
  POKEMON_BY_ID,
} from "../data/pokemon";
import { OPPONENTS } from "../data/opponents";
import { attributes, positionRating, teamRatings } from "./ratings";
import { nextRandom } from "./random";
import { createRun } from "./draft";
import {
  DEFENSE_SCHEMES,
  POSITIONS,
  ROTATIONS,
  ROSTER_SLOTS,
  TACTICS,
  emptyRoster,
  type LeagueResult,
  type LeagueTeam,
  type Roster,
  type RosterSlot,
  type Run,
} from "./types";

import { validateLocalOptions, type LocalLeagueOptions } from "./localFormat";
import { parseLocalCareer, type LocalCareer } from "./localCareer";

export const LOCAL_LEAGUE_KEY = "pokemon-basketball:local-league:v1";
export const LOCAL_TEAMS = [
  { id: 0, name: "Kanto Basketball Club" },
  ...OPPONENTS.map(({ id, name }) => ({ id, name })),
];
export interface LocalManager {
  name: string;
  teamId: number;
}
export type LocalCoaching = Pick<
  LeagueTeam,
  "tactic" | "rotation" | "defense" | "coach"
>;
export interface LocalPick {
  teamId: number;
  pokemonId: number;
  slot: RosterSlot;
}
export interface LocalLeague {
  coachDraftRequired?: true;
  version: 1 | 2;
  options?: LocalLeagueOptions;
  career?: LocalCareer;
  typeMatchupsVersion?: 1;
  typeTacticsVersion?: 1;
  abilityVersion?: 1;
  /** Physical species abilities; absent on historical seasons for exact replay. */
  physicalAbilityVersion?: 1;
  /** Active-five basketball chemistry; independent of the ability switch. */
  chemistryVersion?: 1;
  chemistryGrowthVersion?: 1;
  moraleVersion?: 1;
  evaluationVersion?: 1;
  courtVersion?: 1;
  matchupVersion?: 1;
  possessionVersion?: 1;
  seed: number;
  includeLegends: boolean;
  managers: LocalManager[];
  order: number[];
  picks: LocalPick[];
  /** Team-specific position constraints for the initial draft's lineup search. */
  positionLocks?: LocalPick[];
  coaching: LocalCoaching[];
  completed: boolean;
  /** Deterministic postseason prefix; omitted by saves made before playoffs. */
  playoffGames?: number;
}
const profiles = new Map(
  FRANCHISE_POKEMON.map((mon) => [
    mon.id,
    {
      skills: attributes(mon),
      fits: Object.fromEntries(
        POSITIONS.map((pos) => [pos, positionRating(mon, pos)]),
      ) as Record<(typeof POSITIONS)[number], number>,
    },
  ]),
);
const validTeam = (id: number) => Number.isInteger(id) && id >= 0 && id < 30;
const error = (message = "This local league save is invalid."): never => {
  throw new Error(message);
};

export function createLocalLeague(
  managers: LocalManager[],
  includeLegends: boolean,
  seed: number,
  version: 1 | 2 = 2,
  options?: LocalLeagueOptions,
): LocalLeague {
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    typeof includeLegends !== "boolean" ||
    ![1, 2].includes(version)
  )
    error();
  const configured =
    options === undefined
      ? undefined
      : validateLocalOptions(options, includeLegends);
  if (configured && version !== 2)
    error("Custom leagues require the current simulation model.");
  const count = configured?.format.teamCount ?? 30;
  if (
    !Array.isArray(managers) ||
    managers.length < 2 ||
    managers.length > count
  )
    error("Choose between 2 and 30 friends.");
  const cleaned = managers.map((m) => {
    if (
      !m ||
      typeof m.name !== "string" ||
      !m.name.trim() ||
      m.name.trim().length > 24 ||
      !validTeam(m.teamId) ||
      m.teamId >= count
    )
      error("Give every friend a name and a team.");
    return { name: m.name.trim(), teamId: m.teamId };
  });
  if (new Set(cleaned.map((m) => m.teamId)).size !== cleaned.length)
    error("Each friend needs a different team.");
  if (new Set(cleaned.map((m) => m.name.toLowerCase())).size !== cleaned.length)
    error("Use a different name for each friend.");
  const order = LOCAL_TEAMS.slice(0, count).map((t) => t.id);
  let random = seed;
  for (let i = order.length - 1; i > 0; i--) {
    const roll = nextRandom(random);
    random = roll.seed;
    const j = Math.floor(roll.value * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...(version === 2
      ? {
          typeMatchupsVersion: 1 as const,
          typeTacticsVersion: 1 as const,
          abilityVersion: 1 as const,
          physicalAbilityVersion: 1 as const,
          chemistryVersion: 1 as const,
          chemistryGrowthVersion: 1 as const,
          moraleVersion: 1 as const,
          evaluationVersion: 1 as const,
          courtVersion: 1 as const,
          matchupVersion: 1 as const,
          possessionVersion: 1 as const,
        }
      : {}),
    version,
    ...(configured ? { options: configured } : {}),
    seed,
    includeLegends,
    managers: cleaned,
    order,
    picks: [],
    completed: false,
    coaching: LOCAL_TEAMS.slice(0, count).map((t) =>
      cleaned.some((m) => m.teamId === t.id)
        ? { tactic: "balanced", rotation: "balanced", defense: "man" }
        : {
            tactic: TACTICS[t.id % TACTICS.length],
            rotation: ROTATIONS[t.id % ROTATIONS.length],
            defense: DEFENSE_SCHEMES[t.id % DEFENSE_SCHEMES.length],
          },
    ),
  };
}

export const localLeaguePool = (draft: LocalLeague) =>
  draft.options
    ? FRANCHISE_POKEMON.filter(
        (p) => draft.options!.mode === "full-pool" || p.id <= 151,
      )
    : draft.version === 1
      ? POKEMON
      : ALL_POKEMON;

export const localTeamCount = (draft: LocalLeague) =>
  draft.options?.format.teamCount ?? 30;
export const localDraftSize = (draft: LocalLeague) => localTeamCount(draft) * 8;

export function currentLocalTurn(draft: LocalLeague) {
  const index = draft.picks.length;
  const count = localTeamCount(draft);
  if (index >= count * 8) return null;
  const round = Math.floor(index / count);
  const teamId =
    draft.order[round % 2 ? count - 1 - (index % count) : index % count];
  return {
    teamId,
    round: round + 1,
    pick: index + 1,
    manager: draft.managers.find((m) => m.teamId === teamId),
  };
}

function appendPick(
  draft: LocalLeague,
  pokemonId: number,
  slot: RosterSlot,
): LocalLeague {
  if (draft.coachDraftRequired)
    return error("Choose each manager’s trainer first.");
  const turn = currentLocalTurn(draft),
    mon = POKEMON_BY_ID.get(pokemonId);
  if (!turn || draft.completed) return error("The draft is already complete.");
  if (
    !mon ||
    (draft.options
      ? !localLeaguePool(draft).some((p) => p.id === pokemonId)
      : draft.version === 1 && pokemonId > 251) ||
    (!draft.includeLegends && mon.legendary) ||
    draft.picks.some((p) => p.pokemonId === pokemonId)
  )
    error("Choose an available Pokémon.");
  if (
    !ROSTER_SLOTS.includes(slot) ||
    draft.picks.some((p) => p.teamId === turn.teamId && p.slot === slot)
  )
    error("Choose an empty roster position.");
  return {
    ...draft,
    picks: [...draft.picks, { teamId: turn.teamId, pokemonId, slot }],
  };
}

export function pickLocalPlayer(
  draft: LocalLeague,
  pokemonId: number,
  slot: RosterSlot,
  lineup?: Roster,
): LocalLeague {
  const turn = currentLocalTurn(draft);
  if (!turn?.manager) error("Wait for a friend's turn.");
  if (lineup) {
    if (
      draft.positionLocks?.some(
        (p) => p.teamId === turn!.teamId && lineup[p.slot] !== p.pokemonId,
      )
    )
      error("Unlock a player before moving them out of their locked position.");
    const owned = draft.picks.filter((p) => p.teamId === turn!.teamId);
    const expected = new Set([...owned.map((p) => p.pokemonId), pokemonId]);
    const ids = Object.values(lineup).filter((id) => id !== null);
    if (
      Object.keys(lineup).length !== ROSTER_SLOTS.length ||
      ROSTER_SLOTS.some((s) => !Object.hasOwn(lineup, s)) ||
      lineup[slot] !== pokemonId ||
      ids.length !== owned.length + 1 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !expected.has(id))
    )
      error(
        "The proposed lineup must contain exactly your current players and this pick.",
      );
    const rearranged = {
      ...draft,
      picks: draft.picks.map((p) =>
        p.teamId === turn!.teamId
          ? { ...p, slot: ROSTER_SLOTS.find((s) => lineup[s] === p.pokemonId)! }
          : p,
      ),
    };
    return appendPick(rearranged, pokemonId, slot);
  }
  return appendPick(draft, pokemonId, slot);
}

function withDraftLocks(draft: LocalLeague, locks: LocalPick[]): LocalLeague {
  const { positionLocks: _previous, ...rest } = draft;
  return locks.length ? { ...rest, positionLocks: locks } : rest;
}

/** Update only the manager on the clock; the save carries locks between turns. */
export function updateLocalDraftLocks(
  draft: LocalLeague,
  slots: readonly RosterSlot[],
): LocalLeague {
  const turn = currentLocalTurn(draft);
  if (!turn?.manager || draft.completed || draft.career)
    return error(
      "Position locks can only be changed on a friend's draft turn.",
    );
  const picks = draft.picks.filter((p) => p.teamId === turn.teamId);
  if (
    slots.some(
      (slot) =>
        !ROSTER_SLOTS.includes(slot) || !picks.some((p) => p.slot === slot),
    )
  )
    error("Only your drafted players can be locked in position.");
  return withDraftLocks(draft, [
    ...(draft.positionLocks ?? []).filter((p) => p.teamId !== turn.teamId),
    ...picks.filter((p) => slots.includes(p.slot)).map((p) => ({ ...p })),
  ]);
}

export function advanceLocalCpu(source: LocalLeague): LocalLeague {
  if (source.coachDraftRequired) return source;
  let draft = source;
  for (
    let turn = currentLocalTurn(draft);
    turn && !turn.manager;
    turn = currentLocalTurn(draft)
  ) {
    const taken = new Set(draft.picks.map((p) => p.pokemonId));
    const occupied = new Set(
      draft.picks.filter((p) => p.teamId === turn.teamId).map((p) => p.slot),
    );
    const vacancies = POSITIONS.filter((p) => !occupied.has(p));
    const tactic = draft.coaching[turn.teamId].tactic;
    const context =
      draft.evaluationVersion === 1
        ? createEvaluationContext(localLeagueTeams(draft)[turn.teamId])
        : undefined;
    const ranked = localLeaguePool(draft)
      .filter((p) => !taken.has(p.id) && (draft.includeLegends || !p.legendary))
      .map((mon) => {
        const { fits, skills: a } = profiles.get(mon.id)!;
        const positions = vacancies.length ? vacancies : [...POSITIONS];
        const position = positions.reduce((best, pos) =>
          fits[pos] > fits[best] ? pos : best,
        );
        const style =
          tactic === "pace"
            ? (a.speed + a.stamina) / 2
            : tactic === "perimeter"
              ? a.threePoint
              : tactic === "interior"
                ? (a.finishing + a.offensiveRebound) / 2
                : tactic === "defense"
                  ? (a.perimeterDefense + a.interiorDefense) / 2
                  : a.composure;
        const slot = vacancies.length
          ? position
          : ROSTER_SLOTS.find((s) => !occupied.has(s))!;
        return {
          id: mon.id,
          slot,
          value: context
            ? evaluatePlayer(context, mon.id, position).score
            : 0.85 * fits[position] + 0.15 * style,
        };
      })
      .sort((a, b) => b.value - a.value || a.id - b.id);
    const roll = nextRandom(
      (draft.seed ^ Math.imul(turn.pick, 0x9e3779b9)) >>> 0,
    );
    const choice = ranked[Math.floor(roll.value * Math.min(4, ranked.length))];
    if (!choice)
      error("There are not enough eligible Pokémon for this league.");
    draft = appendPick(draft, choice.id, choice.slot);
  }
  return draft;
}

export function localLeagueTeams(draft: LocalLeague): LeagueTeam[] {
  if (draft.career) return structuredClone(draft.career.teams);
  return LOCAL_TEAMS.slice(0, localTeamCount(draft)).map((team) => {
    const roster = emptyRoster();
    draft.picks
      .filter((p) => p.teamId === team.id)
      .forEach((p) => {
        roster[p.slot] = p.pokemonId;
      });
    const coaching = draft.coaching[team.id];
    return {
      ...team,
      ...(draft.typeMatchupsVersion === 1
        ? { typeMatchupsVersion: 1 as const }
        : {}),
      ...(draft.abilityVersion === 1 ? { abilityVersion: 1 as const } : {}),
      ...(draft.physicalAbilityVersion === 1
        ? { physicalAbilityVersion: 1 as const }
        : {}),
      ...(draft.chemistryVersion === 1 ? { chemistryVersion: 1 as const } : {}),
      ...(draft.moraleVersion === 1
        ? {
            moraleVersion: 1 as const,
            morale: Object.fromEntries(
              Object.values(roster)
                .filter((id): id is number => id !== null)
                .map((id) => [id, neutralMorale()]),
            ),
          }
        : {}),
      ...(draft.chemistryGrowthVersion === 1
        ? { chemistryGrowthVersion: 1 as const, chemistryBonds: {} }
        : {}),
      ...(draft.evaluationVersion === 1
        ? { evaluationVersion: 1 as const }
        : {}),
      ...(draft.courtVersion === 1 ? { courtVersion: 1 as const } : {}),
      ...(draft.matchupVersion === 1 ? { matchupVersion: 1 as const } : {}),
      ...(draft.possessionVersion === 1
        ? { possessionVersion: 1 as const }
        : {}),
      ...(draft.typeTacticsVersion === 1
        ? { typeTacticsVersion: 1 as const }
        : {}),
      roster,
      ...coaching,
      ...(draft.version === 2 ? { simulationVersion: 2 as const } : {}),
      ...(draft.options
        ? {
            engineRules: {
              ...draft.options.engineRules,
              adaptiveCoaching:
                draft.options.engineRules.adaptiveCoaching &&
                !draft.managers.some((m) => m.teamId === team.id),
            },
          }
        : {}),
      ratings: teamRatings(roster, coaching.tactic, coaching.rotation),
    };
  });
}

export function localLeagueRun(draft: LocalLeague): Run {
  if (draft.picks.length !== localDraftSize(draft))
    error("Finish drafting every club first.");
  if (draft.coachDraftRequired) error("Choose each manager’s trainer first.");
  const teams = localLeagueTeams(draft);
  const run = createRun("free", draft.includeLegends, draft.seed);
  delete run.typeMatchupsVersion;
  delete run.typeTacticsVersion;
  delete run.abilityVersion;
  delete run.physicalAbilityVersion;
  delete run.chemistryVersion;
  delete run.chemistryGrowthVersion;
  delete run.moraleVersion;
  delete run.evaluationVersion;
  delete run.courtVersion;
  delete run.matchupVersion;
  delete run.possessionVersion;
  return {
    ...run,
    ...(draft.typeMatchupsVersion === 1
      ? { typeMatchupsVersion: 1 as const }
      : {}),
    ...(teams[0].abilityVersion === 1 ? { abilityVersion: 1 as const } : {}),
    ...(teams[0].physicalAbilityVersion === 1
      ? { physicalAbilityVersion: 1 as const }
      : {}),
    ...(teams[0].moraleVersion === 1 ? { moraleVersion: 1 as const } : {}),
    ...(teams[0].chemistryGrowthVersion === 1
      ? { chemistryGrowthVersion: 1 as const }
      : {}),
    ...(teams[0].chemistryVersion === 1
      ? { chemistryVersion: 1 as const }
      : {}),
    ...(teams[0].evaluationVersion === 1
      ? { evaluationVersion: 1 as const }
      : {}),
    ...(draft.courtVersion === 1 ? { courtVersion: 1 as const } : {}),
    ...(draft.matchupVersion === 1 ? { matchupVersion: 1 as const } : {}),
    ...(draft.possessionVersion === 1 ? { possessionVersion: 1 as const } : {}),
    ...(draft.typeTacticsVersion === 1
      ? { typeTacticsVersion: 1 as const }
      : {}),
    roster: { ...teams[0].roster },
    ...(teams[0].evaluationVersion === 1
      ? {
          tactic: teams[0].tactic,
          rotation: teams[0].rotation,
          defense: teams[0].defense,
          ...(teams[0].coach ? { coach: teams[0].coach } : {}),
        }
      : draft.coaching[0]),
    leagueTeams: teams,
    ...(draft.version === 2 ? { simulationVersion: 2 as const } : {}),
  };
}

function requireEditableTeam(draft: LocalLeague, teamId: number) {
  if (
    (draft.completed && draft.career?.phase !== "offseason") ||
    !draft.managers.some((m) => m.teamId === teamId)
  )
    error("Only a friend's unfinished team can be edited.");
}
export function swapLocalSlots(
  draft: LocalLeague,
  teamId: number,
  first: RosterSlot,
  second: RosterSlot,
): LocalLeague {
  requireEditableTeam(draft, teamId);
  if (!ROSTER_SLOTS.includes(first) || !ROSTER_SLOTS.includes(second)) error();
  if (draft.career) {
    const teams = structuredClone(draft.career.teams);
    const team = teams[teamId];
    [team.roster[first], team.roster[second]] = [
      team.roster[second],
      team.roster[first],
    ];
    team.ratings = teamRatings(
      team.roster,
      team.tactic,
      team.rotation,
      team.development,
    );
    return { ...draft, career: { ...draft.career, teams } };
  }
  // Explicit manual moves in team management replace the old draft preference.
  if (first !== second && draft.positionLocks)
    draft = withDraftLocks(
      draft,
      draft.positionLocks.filter(
        (p) => p.teamId !== teamId || (p.slot !== first && p.slot !== second),
      ),
    );
  return {
    ...draft,
    picks: draft.picks.map((p) =>
      p.teamId !== teamId
        ? p
        : {
            ...p,
            slot:
              p.slot === first ? second : p.slot === second ? first : p.slot,
          },
    ),
  };
}
export function updateLocalCoaching(
  draft: LocalLeague,
  teamId: number,
  coaching: LocalCoaching,
): LocalLeague {
  requireEditableTeam(draft, teamId);
  if (
    !TACTICS.includes(coaching.tactic) ||
    !ROTATIONS.includes(coaching.rotation) ||
    !DEFENSE_SCHEMES.includes(coaching.defense)
  )
    error();
  const career = draft.career
    ? {
        ...draft.career,
        teams: draft.career.teams.map((team) =>
          team.id === teamId
            ? {
                ...team,
                ...coaching,
                ratings: teamRatings(
                  team.roster,
                  coaching.tactic,
                  coaching.rotation,
                  team.development,
                ),
              }
            : team,
        ),
      }
    : undefined;
  return {
    ...draft,
    ...(career ? { career } : {}),
    coaching: draft.coaching.map((c, i) =>
      i === teamId
        ? { ...coaching, ...(c.coach ? { coach: c.coach } : {}) }
        : c,
    ),
  };
}

/** Compact inputs are saved; results replay with the same seed and simulation model. */
export function parseLocalLeague(
  raw: string,
  onProgress?: (completed: number, total: number) => void,
): LocalLeague {
  if (raw.length > 5000000) error();
  const value = JSON.parse(raw);
  if (
    !value ||
    (value.abilityVersion !== undefined && value.abilityVersion !== 1) ||
    (value.physicalAbilityVersion !== undefined &&
      value.physicalAbilityVersion !== 1) ||
    (value.physicalAbilityVersion === 1 && value.abilityVersion !== 1) ||
    (value.chemistryVersion !== undefined && value.chemistryVersion !== 1) ||
    (value.chemistryGrowthVersion !== undefined &&
      value.chemistryGrowthVersion !== 1) ||
    (value.chemistryGrowthVersion === 1 && value.chemistryVersion !== 1) ||
    (value.moraleVersion !== undefined && value.moraleVersion !== 1) ||
    (value.moraleVersion === 1 && value.chemistryGrowthVersion !== 1) ||
    (value.evaluationVersion !== undefined && value.evaluationVersion !== 1) ||
    (value.courtVersion !== undefined && value.courtVersion !== 1) ||
    (value.matchupVersion !== undefined && value.matchupVersion !== 1) ||
    (value.possessionVersion !== undefined && value.possessionVersion !== 1) ||
    ![1, 2].includes(value.version) ||
    typeof value.completed !== "boolean" ||
    (value.typeMatchupsVersion !== undefined &&
      value.typeMatchupsVersion !== 1) ||
    (value.typeTacticsVersion !== undefined &&
      value.typeTacticsVersion !== 1) ||
    (value.typeTacticsVersion === 1 && value.typeMatchupsVersion !== 1) ||
    (value.matchupVersion === 1 &&
      (value.version !== 2 ||
        value.possessionVersion !== 1 ||
        value.typeTacticsVersion !== 1))
  )
    error();
  let draft = createLocalLeague(
    value.managers,
    value.includeLegends,
    value.seed,
    value.version,
    value.options,
  );
  const count = localTeamCount(draft);
  // Creation opts in; loading must retain the saved season rules.
  delete draft.typeMatchupsVersion;
  delete draft.typeTacticsVersion;
  delete draft.abilityVersion;
  delete draft.physicalAbilityVersion;
  delete draft.chemistryVersion;
  delete draft.chemistryGrowthVersion;
  delete draft.moraleVersion;
  delete draft.evaluationVersion;
  delete draft.courtVersion;
  delete draft.matchupVersion;
  delete draft.possessionVersion;
  if (value.abilityVersion === 1) draft.abilityVersion = 1;
  if (value.physicalAbilityVersion === 1) draft.physicalAbilityVersion = 1;
  if (value.chemistryVersion === 1) draft.chemistryVersion = 1;
  if (value.chemistryGrowthVersion === 1) draft.chemistryGrowthVersion = 1;
  if (value.moraleVersion === 1) draft.moraleVersion = 1;
  if (value.evaluationVersion === 1) draft.evaluationVersion = 1;
  if (value.courtVersion === 1) draft.courtVersion = 1;
  if (value.matchupVersion === 1) draft.matchupVersion = 1;
  if (value.possessionVersion === 1) draft.possessionVersion = 1;
  if (value.typeMatchupsVersion === 1) draft.typeMatchupsVersion = 1;
  if (value.typeTacticsVersion === 1) draft.typeTacticsVersion = 1;
  if (
    !Array.isArray(value.order) ||
    value.order.length !== count ||
    value.order.some((id: number, i: number) => id !== draft.order[i])
  )
    error();
  if (!Array.isArray(value.coaching) || value.coaching.length !== count)
    error();
  draft.coaching = value.coaching.map((c: LocalCoaching) => {
    if (
      !c ||
      !TACTICS.includes(c.tactic) ||
      !ROTATIONS.includes(c.rotation) ||
      !DEFENSE_SCHEMES.includes(c.defense)
    )
      error();
    const coach = c.coach === undefined ? undefined : validateCoach(c.coach);
    if (c.coach !== undefined && !coach) error();
    return {
      tactic: c.tactic,
      rotation: c.rotation,
      defense: c.defense,
      ...(coach ? { coach } : {}),
    };
  });
  const selected = draft.coaching.flatMap((c) => (c.coach ? [c.coach.id] : []));
  if (new Set(selected).size !== selected.length) error();
  if (value.coachDraftRequired !== undefined) {
    if (
      value.coachDraftRequired !== true ||
      value.completed ||
      value.career ||
      !Array.isArray(value.picks) ||
      value.picks.length
    )
      error();
    const humans = draft.order.filter((id) =>
      draft.managers.some((m) => m.teamId === id),
    );
    const firstMissing = humans.findIndex((id) => !draft.coaching[id].coach);
    if (
      firstMissing < 0 ||
      draft.coaching.some(
        (c, i) => c.coach && !humans.slice(0, firstMissing).includes(i),
      )
    )
      error();
    draft.coachDraftRequired = true;
  } else if (selected.length !== 0 && selected.length !== count) error();
  if (!Array.isArray(value.picks) || value.picks.length > count * 8) error();
  for (const pick of value.picks) {
    if (!pick || currentLocalTurn(draft)?.teamId !== pick.teamId) error();
    draft = appendPick(draft, pick.pokemonId, pick.slot);
  }
  if (value.positionLocks !== undefined) {
    if (
      !Array.isArray(value.positionLocks) ||
      value.positionLocks.length > draft.picks.length
    )
      error();
    const seen = new Set<number>();
    const locks = value.positionLocks.map((lock: LocalPick) => {
      if (
        !lock ||
        seen.has(lock.pokemonId) ||
        !draft.managers.some((m) => m.teamId === lock.teamId) ||
        !draft.picks.some(
          (p) =>
            p.teamId === lock.teamId &&
            p.pokemonId === lock.pokemonId &&
            p.slot === lock.slot,
        )
      )
        error();
      seen.add(lock.pokemonId);
      return {
        teamId: lock.teamId,
        pokemonId: lock.pokemonId,
        slot: lock.slot,
      };
    });
    draft = withDraftLocks(draft, locks);
  }
  if (value.completed && draft.picks.length !== localDraftSize(draft)) error();
  if (
    value.playoffGames !== undefined &&
    (!value.completed ||
      !Number.isInteger(value.playoffGames) ||
      value.playoffGames < 0 ||
      value.playoffGames >
        (draft.options
          ? (draft.options.format.playoffTeams - 1) *
            draft.options.format.bestOf
          : 105))
  )
    error();
  const career =
    value.career === undefined
      ? undefined
      : parseLocalCareer(
          value.career,
          draft,
          value.completed,
          value.playoffGames,
          onProgress,
        );
  return {
    ...draft,
    ...(career ? { career } : {}),
    completed: value.completed,
    ...(value.playoffGames !== undefined
      ? { playoffGames: value.playoffGames }
      : {}),
  };
}

export function rankLocalManagers(draft: LocalLeague, league: LeagueResult) {
  const standings = [...league.standings].sort(
    (a, b) =>
      b.wins - a.wins ||
      b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst) ||
      a.teamId - b.teamId,
  );
  return standings.flatMap((standing, index) => {
    const manager = draft.managers.find((m) => m.teamId === standing.teamId);
    return manager ? [{ manager, standing, leagueRank: index + 1 }] : [];
  });
}
