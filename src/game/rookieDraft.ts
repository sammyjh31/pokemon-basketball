import {
  POKEMON_BY_ID,
  ROOKIE_GENERATIONS,
  ROOKIE_POKEMON,
} from "../data/pokemon";
import type { Franchise } from "./franchiseTypes";
import type { RookieDraft } from "./rookieDraftTypes";
import {
  attributes,
  positionRating,
  rotationMinutes,
  teamRatings,
} from "./ratings";
import {
  POSITIONS,
  ROSTER_SLOTS,
  type Attributes,
  type GameState,
  type LeagueTeam,
  type Pokemon,
  type Position,
  type RosterSlot,
} from "./types";

/** Zero-based draft count; zero means the remaining undrafted Gen III–IX pool. */
export function generationForDraft(index: number): number {
  return ROOKIE_GENERATIONS[index] ?? 0;
}

export function rookieGenerationLabel(generation: number): string {
  return generation === 0
    ? "Remaining prospects"
    : `Generation ${["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][generation] ?? generation}`;
}

function currentDraft(franchise: Franchise): RookieDraft | undefined {
  const draft = franchise.rookieDrafts?.at(-1);
  return draft?.year === franchise.year ? draft : undefined;
}

function ready(franchise: Franchise): boolean {
  return (
    franchise.phase === "offseason" &&
    franchise.history.length === franchise.year &&
    franchise.history.at(-1)?.year === franchise.year &&
    !!franchise.offseasons?.some((report) => report.year === franchise.year)
  );
}

/** Released players stay ineligible: a rookie must never have joined this league. */
export function rookieProspects(
  franchise: Franchise,
  includeLegends: boolean,
): Pokemon[] {
  const generation =
    currentDraft(franchise)?.generation ??
    generationForDraft(franchise.rookieDrafts?.length ?? 0);
  const used = new Set<number>([
    ...franchise.teams.flatMap((team) =>
      Object.values(team.roster).filter((id): id is number => id !== null),
    ),
    ...franchise.history.flatMap((season) => season.rosters.flat()),
    ...franchise.careers.map((career) => career.pokemonId),
    ...(franchise.rookieDrafts ?? []).flatMap((draft) =>
      draft.picks.flatMap((pick) => [pick.pokemonId, pick.releasedId]),
    ),
  ]);
  return ROOKIE_POKEMON.filter(
    (mon) =>
      (generation === 0 || mon.generation === generation) &&
      (includeLegends || !mon.legendary) &&
      !used.has(mon.id),
  );
}

type Profile = {
  a: Attributes;
  fits: Record<Position, number>;
  ability: number;
};
function profile(
  mon: Pokemon,
  development?: LeagueTeam["development"],
): Profile {
  const offsets = development?.[mon.id],
    fits = Object.fromEntries(
      POSITIONS.map((position) => [
        position,
        positionRating(mon, position, offsets),
      ]),
    ) as Record<Position, number>;
  return {
    a: attributes(mon, offsets),
    fits,
    ability: Math.max(...Object.values(fits)),
  };
}
// Prospect facts never change; amortize their attribute conversion across all clubs.
const prospectProfiles = new Map<number, Profile>();
function prospectProfile(mon: Pokemon): Profile {
  let result = prospectProfiles.get(mon.id);
  if (!result) {
    result = profile(mon);
    prospectProfiles.set(mon.id, result);
  }
  return result;
}

function replacedTeam(
  team: LeagueTeam,
  slot: RosterSlot,
  pokemonId: number,
): LeagueTeam {
  const releasedId = team.roster[slot]!,
    roster = { ...team.roster, [slot]: pokemonId };
  const development = Object.fromEntries(
    Object.values(roster).map((id) => [
      id!,
      id === pokemonId ? {} : { ...(team.development?.[id!] ?? {}) },
    ]),
  );
  return {
    ...team,
    roster,
    development,
    ratings: teamRatings(
      roster,
      team.tactic,
      team.rotation,
      development,
      team.rotationPlan,
    ),
  };
}

/** A deterministic shortlist combines ability, vacant-slot fit, coaching and rotation needs. */
export function recommendedRookiePick(
  franchise: Franchise,
  teamId: number,
  includeLegends: boolean,
): { pokemonId: number; releasedId: number } | null {
  if (!ready(franchise) || currentDraft(franchise)?.complete) return null;
  const team = franchise.teams.find((club) => club.id === teamId);
  if (!team) return null;
  const prospects = rookieProspects(franchise, includeLegends);
  if (!prospects.length) return null;
  const roster = ROSTER_SLOTS.flatMap((slot) => {
    const mon = POKEMON_BY_ID.get(team.roster[slot] ?? -1);
    return mon ? [{ slot, mon, profile: profile(mon, team.development) }] : [];
  });
  if (roster.length !== 8) return null;
  const minutes = rotationMinutes(
    team.roster,
    team.rotation,
    team.development,
    team.rotationPlan,
  );
  const average = (key: keyof Attributes) =>
    roster.reduce((sum, row) => sum + row.profile.a[key], 0) / 8;
  const need = (a: Attributes) =>
    (a.threePoint * Math.max(0, 70 - average("threePoint"))) / 70 +
    (a.playmaking * Math.max(0, 70 - average("playmaking"))) / 70 +
    (a.interiorDefense * Math.max(0, 70 - average("interiorDefense"))) / 70;
  const scheme = (a: Attributes) => {
    const offense =
      team.tactic === "perimeter"
        ? a.threePoint
        : team.tactic === "interior"
          ? (a.finishing + a.strength) / 2
          : team.tactic === "pace"
            ? (a.speed + a.stamina) / 2
            : team.tactic === "defense"
              ? (a.perimeterDefense + a.interiorDefense) / 2
              : (a.shooting + a.playmaking + a.finishing) / 3;
    const defense =
      team.defense === "zone"
        ? a.interiorDefense
        : team.defense === "press"
          ? (a.speed + a.steal + a.stamina) / 3
          : team.defense === "switch"
            ? Math.min(a.perimeterDefense, a.interiorDefense)
            : (a.perimeterDefense + a.interiorDefense) / 2;
    return (offense + defense) / 2;
  };
  const options: {
    pokemonId: number;
    releasedId: number;
    slot: RosterSlot;
    score: number;
  }[] = [];
  for (const mon of prospects) {
    const incoming = prospectProfile(mon);
    for (const row of roster) {
      const outgoing = row.profile;
      const fit = (p: Profile) =>
        POSITIONS.includes(row.slot as Position)
          ? p.fits[row.slot as Position]
          : p.ability;
      const score =
        (fit(incoming) - fit(outgoing)) * (0.5 + minutes[row.slot] / 60) +
        (incoming.ability - outgoing.ability) * 0.45 +
        (scheme(incoming.a) - scheme(outgoing.a)) * 0.2 +
        (need(incoming.a) - need(outgoing.a)) * 0.1;
      options.push({
        pokemonId: mon.id,
        releasedId: row.mon.id,
        slot: row.slot,
        score,
      });
    }
  }
  const compare = (a: (typeof options)[number], b: (typeof options)[number]) =>
    b.score - a.score ||
    a.pokemonId - b.pokemonId ||
    a.releasedId - b.releasedId;
  options.sort(compare);
  const finalists = options
    .slice(0, 8)
    .map((option) => ({
      ...option,
      score:
        option.score +
        2 *
          (replacedTeam(team, option.slot, option.pokemonId).ratings.overall -
            team.ratings.overall),
    }))
    .sort(compare);
  const best = finalists[0];
  return best
    ? { pokemonId: best.pokemonId, releasedId: best.releasedId }
    : null;
}

function replaceDraft(franchise: Franchise, draft: RookieDraft): Franchise {
  return {
    ...franchise,
    rookieDrafts: [...franchise.rookieDrafts!.slice(0, -1), draft],
  };
}

function recordPick(
  franchise: Franchise,
  pokemonId: number,
  releasedId: number,
): Franchise {
  const draft = currentDraft(franchise)!;
  const teamId = draft.order[draft.picks.length % 30],
    team = franchise.teams[teamId];
  const slot = ROSTER_SLOTS.find((key) => team.roster[key] === releasedId)!;
  const updated = replaceDraft(franchise, {
    ...draft,
    picks: [
      ...draft.picks,
      {
        pick: draft.picks.length + 1,
        round: draft.picks.length < 30 ? 1 : 2,
        teamId,
        pokemonId,
        releasedId,
      },
    ],
    complete: draft.picks.length === 59,
  });
  return {
    ...updated,
    teams: franchise.teams.map((club) =>
      club.id === teamId ? replacedTeam(club, slot, pokemonId) : club,
    ),
    ...(teamId === 0 && franchise.trainingPlans
      ? {
          trainingPlans: Object.fromEntries(
            Object.entries(franchise.trainingPlans).filter(
              ([id]) => Number(id) !== releasedId,
            ),
          ),
        }
      : {}),
  };
}

export function beginRookieDraft(state: GameState): GameState {
  const f = state.franchise;
  if (
    !f ||
    !ready(f) ||
    currentDraft(f) ||
    f.rookieDrafts?.some((draft) => !draft.complete)
  )
    return state;
  const standings = f.history.at(-1)!.standings;
  const order = [...standings]
    .sort(
      (a, b) =>
        a.wins - b.wins ||
        a.pointsFor - a.pointsAgainst - (b.pointsFor - b.pointsAgainst) ||
        a.teamId - b.teamId,
    )
    .map((row) => row.teamId);
  if (
    order.length !== 30 ||
    new Set(order).size !== 30 ||
    order.some((id) => !f.teams[id])
  )
    return state;
  const draft: RookieDraft = {
    modelVersion: 1,
    year: f.year,
    generation: generationForDraft(f.rookieDrafts?.length ?? 0),
    order,
    picks: [],
    complete: false,
    tradeIndex: f.trades.length,
  };
  return advanceRookieDraft({
    ...state,
    franchise: {
      ...f,
      modelVersion: 3,
      rookieDrafts: [...(f.rookieDrafts ?? []), draft],
    },
  });
}

/** At most sixty iterations, and normally at most 29 CPU picks before the user chooses. */
export function advanceRookieDraft(state: GameState): GameState {
  let f = state.franchise;
  if (!f || !ready(f)) return state;
  for (let step = 0; step < 60; step++) {
    const draft = currentDraft(f);
    if (!draft || draft.complete) break;
    if (!rookieProspects(f, state.run.includeLegends).length) {
      f = replaceDraft(f, { ...draft, complete: true, exhausted: true });
      break;
    }
    const teamId = draft.order[draft.picks.length % 30];
    if (teamId === 0) break;
    const pick = recommendedRookiePick(f, teamId, state.run.includeLegends);
    if (!pick) break;
    f = recordPick(f, pick.pokemonId, pick.releasedId);
  }
  return f === state.franchise ? state : { ...state, franchise: f };
}

export function selectRookie(
  state: GameState,
  pokemonId: number,
  releasedId: number,
): GameState {
  const f = state.franchise,
    draft = f && currentDraft(f);
  if (
    !f ||
    !ready(f) ||
    !draft ||
    draft.complete ||
    draft.order[draft.picks.length % 30] !== 0 ||
    !Object.values(f.teams[0].roster).includes(releasedId) ||
    !rookieProspects(f, state.run.includeLegends).some(
      (mon) => mon.id === pokemonId,
    )
  )
    return state;
  return advanceRookieDraft({
    ...state,
    franchise: recordPick(f, pokemonId, releasedId),
  });
}
