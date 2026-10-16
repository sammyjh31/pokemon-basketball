import { POKEMON_BY_ID } from "../data/pokemon";
import {
  MAX_FREE_AGENT_SIGNINGS,
  type FreeAgency,
  type FreeAgentSigning,
} from "./freeAgencyTypes";

const fail = (): never => {
  throw new Error("Invalid saved free agency");
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  return value as Record<string, unknown>;
}
function integer(value: unknown, min: number, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    return fail();
  return value;
}

/** Parse bounded event data. Ownership and draft boundaries are replayed separately. */
export function validateFreeAgency(
  value: unknown,
  historyCount: number,
  tradeCount: number,
  includeLegends: boolean,
): FreeAgency {
  const row = object(value);
  if (
    row.modelVersion !== 1 ||
    !Array.isArray(row.transactions) ||
    row.transactions.length > MAX_FREE_AGENT_SIGNINGS ||
    !Array.isArray(row.cpuYears) ||
    row.cpuYears.length > historyCount
  )
    return fail();
  const cpuYears = row.cpuYears.map((year, index, years) =>
    integer(year, index ? (years[index - 1] as number) + 1 : 1, historyCount),
  );
  let previousYear = 1,
    previousTrade = 0;
  const cpuTeams = new Set<string>(),
    closedCpuYears = new Set<number>();
  const cpuTradeIndices = new Map<number, number>();
  let last: FreeAgentSigning | undefined;
  const transactions: FreeAgentSigning[] = row.transactions.map((value) => {
    const entry = object(value),
      year = integer(entry.year, previousYear, historyCount),
      tradeIndex = integer(entry.tradeIndex, previousTrade, tradeCount);
    previousYear = year;
    previousTrade = tradeIndex;
    const source = entry.source;
    if (source !== "cpu" && source !== "user") return fail();
    const teamId = integer(
      entry.teamId,
      source === "cpu" ? 1 : 0,
      source === "cpu" ? 29 : 0,
    );
    const pokemonId = integer(entry.pokemonId, 1, 1025),
      releasedId = integer(entry.releasedId, 1, 1025);
    if (
      pokemonId === releasedId ||
      [pokemonId, releasedId].some(
        (id) =>
          !POKEMON_BY_ID.has(id) ||
          (!includeLegends && POKEMON_BY_ID.get(id)!.legendary),
      ) ||
      typeof entry.reason !== "string" ||
      !entry.reason.length ||
      entry.reason.length > 1000
    )
      return fail();
    if (last?.source === "cpu" && (source !== "cpu" || year !== last.year))
      closedCpuYears.add(last.year);
    if (source === "cpu") {
      const key = `${year}:${teamId}`;
      if (
        !cpuYears.includes(year) ||
        cpuTeams.has(key) ||
        closedCpuYears.has(year) ||
        (cpuTradeIndices.has(year) && cpuTradeIndices.get(year) !== tradeIndex)
      )
        return fail();
      cpuTeams.add(key);
      cpuTradeIndices.set(year, tradeIndex);
    }
    last = {
      year,
      teamId,
      pokemonId,
      releasedId,
      tradeIndex,
      source,
      reason: entry.reason,
    };
    return last;
  });
  return { modelVersion: 1, transactions, cpuYears };
}
