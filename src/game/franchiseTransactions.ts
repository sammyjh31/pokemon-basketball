import {
  POKEMON_BY_ID,
  ROOKIE_GENERATIONS,
  ROOKIE_POKEMON,
} from "../data/pokemon";
import type { OffseasonReport } from "./developmentTypes";
import type {
  Franchise,
  FranchiseSeason,
  FranchiseTrade,
} from "./franchiseTypes";
import type { RookieDraft, RookiePick } from "./rookieDraftTypes";

const fail = (): never => {
  throw new Error("Invalid saved franchise transactions");
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  return value as Record<string, unknown>;
}
function integer(value: unknown, minimum: number, maximum: number): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  )
    return fail();
  return value;
}
function matches(actual: number[][], expected: number[][]): boolean {
  return (
    actual.length === 30 &&
    actual.every(
      (roster, index) =>
        roster.length === 8 &&
        roster.every((id) => expected[index].includes(id)),
    ) &&
    new Set(actual.flat()).size === 240
  );
}
const rookies = new Map(ROOKIE_POKEMON.map((mon) => [mon.id, mon]));

/** Validate membership changes in event order, independent of editable lineup slots. */
export function validateRosterTransactions(
  value: unknown,
  history: FranchiseSeason[],
  trades: FranchiseTrade[],
  currentRosters: number[][],
  includeLegends: boolean,
  year: number,
  phase: Franchise["phase"],
  reports: OffseasonReport[] | undefined,
): { drafts?: RookieDraft[]; expected: number[][] } {
  const hasDrafts = value !== undefined;
  if (
    hasDrafts &&
    (!Array.isArray(value) || !value.length || value.length > history.length)
  )
    return fail();
  const rawDrafts = hasDrafts ? (value as unknown[]) : [];
  let previousYear: number | undefined;
  const drafts: RookieDraft[] = rawDrafts.map((value, index) => {
    const row = object(value),
      draftYear = integer(row.year, 1, history.length);
    if (
      row.modelVersion !== 1 ||
      typeof row.complete !== "boolean" ||
      row.generation !== (ROOKIE_GENERATIONS[index] ?? 0) ||
      (previousYear !== undefined && draftYear !== previousYear + 1)
    )
      return fail();
    previousYear = draftYear;
    const expectedOrder = [...history[draftYear - 1].standings]
      .sort(
        (a, b) =>
          a.wins - b.wins ||
          a.pointsFor - a.pointsAgainst - (b.pointsFor - b.pointsAgainst) ||
          a.teamId - b.teamId,
      )
      .map((standing) => standing.teamId);
    if (
      !Array.isArray(row.order) ||
      row.order.length !== 30 ||
      row.order.some((id, index) => id !== expectedOrder[index]) ||
      !Array.isArray(row.picks) ||
      row.picks.length > 60 ||
      (Object.hasOwn(row, "exhausted") && typeof row.exhausted !== "boolean")
    )
      return fail();
    const picks: RookiePick[] = row.picks.map((value, index) => {
      const pick = object(value);
      if (
        pick.pick !== index + 1 ||
        pick.round !== (index < 30 ? 1 : 2) ||
        pick.teamId !== expectedOrder[index % 30]
      )
        return fail();
      const pokemonId = integer(pick.pokemonId, 1, 1025),
        releasedId = integer(pick.releasedId, 1, 1025);
      if (!POKEMON_BY_ID.has(pokemonId) || !POKEMON_BY_ID.has(releasedId))
        return fail();
      return {
        pick: index + 1,
        round: index < 30 ? 1 : 2,
        teamId: expectedOrder[index % 30],
        pokemonId,
        releasedId,
      };
    });
    if (
      !row.complete &&
      (draftYear !== year ||
        phase !== "offseason" ||
        index !== rawDrafts.length - 1 ||
        picks.length >= 60 ||
        row.exhausted)
    )
      return fail();
    return {
      modelVersion: 1,
      year: draftYear,
      generation: row.generation as number,
      order: expectedOrder,
      picks,
      complete: row.complete,
      tradeIndex: integer(row.tradeIndex, 0, trades.length),
      ...(Object.hasOwn(row, "exhausted")
        ? { exhausted: row.exhausted as boolean }
        : {}),
    };
  });
  if (
    drafts.length &&
    (drafts.at(-1)!.year < year - 1 ||
      (phase === "season" && drafts.at(-1)!.year !== year - 1))
  )
    return fail();
  // Every franchise starts from the original Gen I–II league. Later members
  // must be accounted for by an eligible, never-before-rostered draft pick.
  if (history[0].rosters.flat().some((id) => id > 251)) return fail();
  let expected = history[0].rosters.map((roster) => [...roster]),
    tradeIndex = 0;
  const used = new Set(expected.flat());
  const applyTrade = (trade: FranchiseTrade) => {
    const from = trade.fromTeamId ?? 0,
      give = trade.giveIds ?? [trade.giveId],
      receive = trade.receiveIds ?? [trade.receiveId];
    const giveSlots = give.map((id) => expected[from].indexOf(id)),
      receiveSlots = receive.map((id) => expected[trade.teamId].indexOf(id));
    if (
      giveSlots.some((slot) => slot < 0) ||
      receiveSlots.some((slot) => slot < 0) ||
      new Set([...give, ...receive]).size !== give.length + receive.length
    )
      return fail();
    giveSlots.forEach((slot, index) => {
      expected[from][slot] = receive[index];
    });
    receiveSlots.forEach((slot, index) => {
      expected[trade.teamId][slot] = give[index];
    });
    if (new Set(expected.flat()).size !== 240) return fail();
  };
  for (const archived of history) {
    if (!matches(archived.rosters, expected)) return fail();
    expected = archived.rosters.map((roster) => [...roster]);
    const draft = drafts.find((draft) => draft.year === archived.year);
    let yearEnd = tradeIndex;
    while (trades[yearEnd]?.year === archived.year) yearEnd++;
    if (draft) {
      const report = reports?.find((report) => report.year === draft.year);
      if (
        !report ||
        draft.tradeIndex < tradeIndex ||
        draft.tradeIndex > yearEnd ||
        draft.tradeIndex < report.tradeStart + report.tradeCount
      )
        return fail();
      while (tradeIndex < draft.tradeIndex) applyTrade(trades[tradeIndex++]);
      for (const pick of draft.picks) {
        const mon = rookies.get(pick.pokemonId),
          slot = expected[pick.teamId].indexOf(pick.releasedId);
        if (
          !mon ||
          (!includeLegends && mon.legendary) ||
          (draft.generation !== 0 && mon.generation !== draft.generation) ||
          used.has(pick.pokemonId) ||
          slot < 0
        )
          return fail();
        expected[pick.teamId][slot] = pick.pokemonId;
        used.add(pick.pokemonId);
        if (new Set(expected.flat()).size !== 240) return fail();
      }
      const remaining = ROOKIE_POKEMON.some(
        (mon) =>
          (draft.generation === 0 || mon.generation === draft.generation) &&
          (includeLegends || !mon.legendary) &&
          !used.has(mon.id),
      );
      if (draft.complete) {
        if (
          draft.picks.length === 60
            ? draft.exhausted === true
            : !draft.exhausted || remaining
        )
          return fail();
      } else if (!remaining || tradeIndex !== trades.length) return fail();
    }
    while (tradeIndex < yearEnd) applyTrade(trades[tradeIndex++]);
  }
  if (tradeIndex !== trades.length || !matches(currentRosters, expected))
    return fail();
  return { ...(hasDrafts ? { drafts } : {}), expected };
}
