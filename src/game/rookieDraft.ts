import { withRosterMorale } from "./playerMorale";
import { createRivalStrategy } from "./rivalRosterStrategy";
import { compareTeamEvaluation } from "./teamEvaluation";
import type { TradeFactor } from "./tradeTypes";
import { projectedCoaches } from "./coachOffice";
import { cpuRulesApply } from "./cpuRules";
import { lotteryOrder, recordOrder } from "./draftLottery";
import { processCpuFreeAgency } from "./freeAgency";
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

/** Zero-based turn: picks made plus turns passed. */
export function draftTurn(draft: RookieDraft): number {
  return draft.picks.length + (draft.passes?.length ?? 0);
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
  return withRosterMorale(
    {
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
    },
    team,
    [team],
    "rookie",
  );
}

/** A deterministic shortlist combines ability, vacant-slot fit, coaching and rotation needs. */
export function recommendedRookiePick(
  franchise: Franchise,
  teamId: number,
  includeLegends: boolean,
): {
  pokemonId: number;
  releasedId: number;
  /** Club's own valuation of the swap; at or below zero it would not help. */
  score: number;
  rivalGain?: number;
  reason?: string;
  sharedDelta?: number;
  factors?: TradeFactor[];
} | null {
  if (!ready(franchise) || currentDraft(franchise)?.complete) return null;
  const actualTeam = franchise.teams.find((club) => club.id === teamId);
  const team =
    actualTeam?.evaluationVersion === 1
      ? projectedCoaches(
          franchise.teams,
          franchise.coachOffice,
          franchise.year,
        ).find((club) => club.id === teamId)
      : actualTeam;
  if (!team) return null;
  const strategy = createRivalStrategy(
    team,
    franchise.teams,
    franchise.history,
    franchise.year,
  );
  const prospects = rookieProspects(franchise, includeLegends);
  if (!prospects.length) return null;
  const roster = ROSTER_SLOTS.flatMap((slot) => {
    const mon = POKEMON_BY_ID.get(team.roster[slot] ?? -1);
    return mon ? [{ slot, mon, profile: profile(mon, team.development) }] : [];
  });
  if (roster.length !== 8) return null;
  if (team.evaluationVersion === 1) {
    // Compare every eligible replacement. A legacy raw-skill shortlist could
    // otherwise discard the best coach/ability fit before the shared model runs.
    const choices = prospects
      .flatMap((mon) =>
        roster.map((row) => {
          const evaluation = compareTeamEvaluation(
            team,
            replacedTeam(team, row.slot, mon.id),
          );
          const rivalGain = strategy.change([row.mon.id], [mon.id]);
          return {
            pokemonId: mon.id,
            releasedId: row.mon.id,
            evaluation,
            rivalGain,
            score: evaluation.delta + rivalGain,
          };
        }),
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.pokemonId - b.pokemonId ||
          a.releasedId - b.releasedId,
      );
    const best = choices[0];
    return {
      pokemonId: best.pokemonId,
      releasedId: best.releasedId,
      score: best.score,
      sharedDelta: best.evaluation.delta,
      factors: best.evaluation.factors,
      ...(strategy.active ? { rivalGain: best.rivalGain } : {}),
      reason: `Shared team value ${best.evaluation.delta >= 0 ? "+" : ""}${best.evaluation.delta.toFixed(2)}. ${[
        ...best.evaluation.factors,
      ]
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
        .slice(0, 2)
        .map(
          (factor) =>
            `${factor.label} ${factor.contribution >= 0 ? "+" : ""}${factor.contribution.toFixed(2)}`,
        )
        .join(
          "; ",
        )}.${strategy.active ? ` ${strategy.explanation} Rival coverage change: ${best.rivalGain.toFixed(2)}.` : ""}`,
    };
  }
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
        (need(incoming.a) - need(outgoing.a)) * 0.1 +
        strategy.change([row.mon.id], [mon.id]);
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
    ? {
        pokemonId: best.pokemonId,
        releasedId: best.releasedId,
        score: best.score,
        ...(strategy.active
          ? {
              rivalGain: strategy.change([best.releasedId], [best.pokemonId]),
              reason: `${strategy.explanation} Rival coverage change: ${strategy.change([best.releasedId], [best.pokemonId]).toFixed(2)}. Ability and rotation fit remain part of the recommendation.`,
            }
          : {}),
      }
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
  const draft = currentDraft(franchise)!,
    turn = draftTurn(draft);
  const teamId = draft.order[turn % 30],
    team = franchise.teams[teamId];
  const slot = ROSTER_SLOTS.find((key) => team.roster[key] === releasedId)!;
  const updated = replaceDraft(franchise, {
    ...draft,
    picks: [
      ...draft.picks,
      {
        pick: turn + 1,
        round: turn < 30 ? 1 : 2,
        teamId,
        pokemonId,
        releasedId,
      },
    ],
    complete: turn === 59,
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

/** Model-2 drafts only: the club on the clock keeps its roster unchanged. */
function recordPass(franchise: Franchise): Franchise {
  const draft = currentDraft(franchise)!,
    turn = draftTurn(draft);
  return replaceDraft(franchise, {
    ...draft,
    passes: [...(draft.passes ?? []), turn + 1],
    complete: turn === 59,
  });
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
  const season = f.history.at(-1)!,
    lottery = cpuRulesApply(f);
  const order = lottery
    ? lotteryOrder(season.standings, season.seasonSeed)
    : recordOrder(season.standings);
  if (
    order.length !== 30 ||
    new Set(order).size !== 30 ||
    order.some((id) => !f.teams[id])
  )
    return state;
  const draft: RookieDraft = {
    modelVersion: lottery ? 2 : 1,
    year: f.year,
    generation: generationForDraft(f.rookieDrafts?.length ?? 0),
    order,
    picks: [],
    complete: false,
    tradeIndex: f.trades.length,
    ...(lottery ? { passes: [] } : {}),
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
    const teamId = draft.order[draftTurn(draft) % 30];
    if (teamId === 0) break;
    const pick = recommendedRookiePick(f, teamId, state.run.includeLegends);
    if (!pick) break;
    // Model-2 clubs pass rather than release a player they value more.
    f =
      draft.modelVersion === 2 && pick.score <= 0
        ? recordPass(f)
        : recordPick(f, pick.pokemonId, pick.releasedId);
  }
  const next = f === state.franchise ? state : { ...state, franchise: f };
  // Under CPU rules v1, clubs sign free agents as soon as the market opens,
  // before the user's own moves.
  return cpuRulesApply(f) && currentDraft(f)?.complete
    ? processCpuFreeAgency(next)
    : next;
}

/** The user's turn in a model-2 draft: keep the current roster. */
export function passRookiePick(state: GameState): GameState {
  const f = state.franchise,
    draft = f && currentDraft(f);
  if (
    !f ||
    !ready(f) ||
    !draft ||
    draft.complete ||
    draft.modelVersion !== 2 ||
    draft.order[draftTurn(draft) % 30] !== 0
  )
    return state;
  return advanceRookieDraft({ ...state, franchise: recordPass(f) });
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
    draft.order[draftTurn(draft) % 30] !== 0 ||
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
