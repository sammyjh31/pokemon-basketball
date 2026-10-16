import { ALL_POKEMON, POKEMON, POKEMON_BY_ID } from "../data/pokemon";
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
  type RosterSlot,
  type Run,
} from "./types";

export const LOCAL_LEAGUE_KEY = "pokemon-basketball:local-league:v1";
export const LOCAL_TEAMS = [
  { id: 0, name: "Kanto Basketball Club" },
  ...OPPONENTS.map(({ id, name }) => ({ id, name })),
];
export interface LocalManager {
  name: string;
  teamId: number;
}
export type LocalCoaching = Pick<LeagueTeam, "tactic" | "rotation" | "defense">;
export interface LocalPick {
  teamId: number;
  pokemonId: number;
  slot: RosterSlot;
}
export interface LocalLeague {
  version: 1 | 2;
  seed: number;
  includeLegends: boolean;
  managers: LocalManager[];
  order: number[];
  picks: LocalPick[];
  coaching: LocalCoaching[];
  completed: boolean;
  /** Deterministic postseason prefix; omitted by saves made before playoffs. */
  playoffGames?: number;
}
const profiles = new Map(
  ALL_POKEMON.map((mon) => [
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
): LocalLeague {
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    typeof includeLegends !== "boolean" ||
    ![1, 2].includes(version)
  )
    error();
  if (!Array.isArray(managers) || managers.length < 2 || managers.length > 30)
    error("Choose between 2 and 30 friends.");
  const cleaned = managers.map((m) => {
    if (
      !m ||
      typeof m.name !== "string" ||
      !m.name.trim() ||
      m.name.trim().length > 24 ||
      !validTeam(m.teamId)
    )
      error("Give every friend a name and a team.");
    return { name: m.name.trim(), teamId: m.teamId };
  });
  if (new Set(cleaned.map((m) => m.teamId)).size !== cleaned.length)
    error("Each friend needs a different team.");
  if (new Set(cleaned.map((m) => m.name.toLowerCase())).size !== cleaned.length)
    error("Use a different name for each friend.");
  const order = LOCAL_TEAMS.map((t) => t.id);
  let random = seed;
  for (let i = order.length - 1; i > 0; i--) {
    const roll = nextRandom(random);
    random = roll.seed;
    const j = Math.floor(roll.value * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    version,
    seed,
    includeLegends,
    managers: cleaned,
    order,
    picks: [],
    completed: false,
    coaching: LOCAL_TEAMS.map((t) =>
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
  draft.version === 1 ? POKEMON : ALL_POKEMON;

export function currentLocalTurn(draft: LocalLeague) {
  const index = draft.picks.length;
  if (index >= 240) return null;
  const round = Math.floor(index / 30);
  const teamId = draft.order[round % 2 ? 29 - (index % 30) : index % 30];
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
  const turn = currentLocalTurn(draft),
    mon = POKEMON_BY_ID.get(pokemonId);
  if (!turn || draft.completed) return error("The draft is already complete.");
  if (
    !mon ||
    (draft.version === 1 && pokemonId > 251) ||
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
): LocalLeague {
  if (!currentLocalTurn(draft)?.manager) error("Wait for a friend's turn.");
  return appendPick(draft, pokemonId, slot);
}

export function advanceLocalCpu(source: LocalLeague): LocalLeague {
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
          value: 0.85 * fits[position] + 0.15 * style,
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
  return LOCAL_TEAMS.map((team) => {
    const roster = emptyRoster();
    draft.picks
      .filter((p) => p.teamId === team.id)
      .forEach((p) => {
        roster[p.slot] = p.pokemonId;
      });
    const coaching = draft.coaching[team.id];
    return {
      ...team,
      roster,
      ...coaching,
      ...(draft.version === 2 ? { simulationVersion: 2 as const } : {}),
      ratings: teamRatings(roster, coaching.tactic, coaching.rotation),
    };
  });
}

export function localLeagueRun(draft: LocalLeague): Run {
  if (draft.picks.length !== 240) error("Finish drafting all 30 teams first.");
  const teams = localLeagueTeams(draft);
  return {
    ...createRun("free", draft.includeLegends, draft.seed),
    roster: { ...teams[0].roster },
    ...draft.coaching[0],
    leagueTeams: teams,
    ...(draft.version === 2 ? { simulationVersion: 2 as const } : {}),
  };
}

function requireEditableTeam(draft: LocalLeague, teamId: number) {
  if (draft.completed || !draft.managers.some((m) => m.teamId === teamId))
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
  return {
    ...draft,
    coaching: draft.coaching.map((c, i) =>
      i === teamId ? { ...coaching } : c,
    ),
  };
}

/** Compact inputs are saved; results replay with the same seed and simulation model. */
export function parseLocalLeague(raw: string): LocalLeague {
  if (raw.length > 100000) error();
  const value = JSON.parse(raw);
  if (
    !value ||
    ![1, 2].includes(value.version) ||
    typeof value.completed !== "boolean"
  )
    error();
  let draft = createLocalLeague(
    value.managers,
    value.includeLegends,
    value.seed,
    value.version,
  );
  if (
    !Array.isArray(value.order) ||
    value.order.length !== 30 ||
    value.order.some((id: number, i: number) => id !== draft.order[i])
  )
    error();
  if (!Array.isArray(value.coaching) || value.coaching.length !== 30) error();
  draft.coaching = value.coaching.map((c: LocalCoaching) => {
    if (
      !c ||
      !TACTICS.includes(c.tactic) ||
      !ROTATIONS.includes(c.rotation) ||
      !DEFENSE_SCHEMES.includes(c.defense)
    )
      error();
    return { tactic: c.tactic, rotation: c.rotation, defense: c.defense };
  });
  if (!Array.isArray(value.picks) || value.picks.length > 240) error();
  for (const pick of value.picks) {
    if (!pick || currentLocalTurn(draft)?.teamId !== pick.teamId) error();
    draft = appendPick(draft, pick.pokemonId, pick.slot);
  }
  if (value.completed && draft.picks.length !== 240) error();
  if (
    value.playoffGames !== undefined &&
    (!value.completed ||
      !Number.isInteger(value.playoffGames) ||
      value.playoffGames < 0 ||
      value.playoffGames > 105)
  )
    error();
  return {
    ...draft,
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
