import { POKEMON, POKEMON_BY_ID } from "../data/pokemon";
import { nextRandom } from "./random";
import { POSITIONS, type Mode, type Position, type Run } from "./types";
function offer(run: Run): Run {
  if (run.mode === "free" || POSITIONS.every((p) => run.roster[p] !== null))
    return { ...run, offerIds: [] };
  const taken = new Set(Object.values(run.roster));
  const ids = POKEMON.filter(
    (p) => !taken.has(p.id) && (run.includeLegends || !p.legendary),
  ).map((p) => p.id);
  let seed = run.draftSeed;
  for (let i = ids.length - 1; i > 0; i--) {
    const roll = nextRandom(seed);
    seed = roll.seed;
    const j = Math.floor(roll.value * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return { ...run, offerIds: ids.slice(0, 4), draftSeed: seed };
}
export function createRun(
  mode: Mode,
  includeLegends: boolean,
  seed: number,
): Run {
  return offer({
    id: `run-${seed >>> 0}`,
    mode,
    includeLegends,
    roster: { PG: null, SG: null, SF: null, PF: null, C: null },
    offerIds: [],
    rerollsLeft: 2,
    draftSeed: (seed ^ 0xa341316c) >>> 0,
    seasonSeed: (seed ^ 0xc8013ea4) >>> 0,
    result: null,
  });
}
export function reroll(run: Run): Run {
  if (
    run.result ||
    run.mode !== "spin" ||
    run.rerollsLeft <= 0 ||
    run.offerIds.length === 0
  )
    return run;
  return offer({ ...run, rerollsLeft: run.rerollsLeft - 1 });
}
export function placePokemon(
  run: Run,
  pokemonId: number,
  position: Position,
): Run {
  const mon = POKEMON_BY_ID.get(pokemonId);
  if (
    run.result ||
    !mon ||
    !POSITIONS.includes(position) ||
    (!run.includeLegends && mon.legendary) ||
    Object.values(run.roster).includes(pokemonId)
  )
    return run;
  if (
    run.mode === "spin" &&
    (run.roster[position] !== null || !run.offerIds.includes(pokemonId))
  )
    return run;
  const next = { ...run, roster: { ...run.roster, [position]: pokemonId } };
  return run.mode === "spin" ? offer(next) : next;
}
export function swapPositions(
  run: Run,
  first: Position,
  second: Position,
): Run {
  if (
    run.result ||
    run.mode !== "free" ||
    first === second ||
    !POSITIONS.includes(first) ||
    !POSITIONS.includes(second)
  )
    return run;
  return {
    ...run,
    roster: {
      ...run.roster,
      [first]: run.roster[second],
      [second]: run.roster[first],
    },
  };
}
