import { createEvaluationContext, evaluatePlayer } from "./teamEvaluation";
import { COURT_VERSION } from "./courtTypes";
import { POKEMON_BY_ID } from "../data/pokemon";
import { draftPokemon, inDraftPool, type DraftPool } from "./draftPool";
import { nextRandom } from "./random";
import {
  ROSTER_SLOTS,
  BENCH_SLOTS,
  emptyRoster,
  type Mode,
  type RosterSlot,
  type Run,
} from "./types";
export function refreshOffers(run: Run): Run {
  if (run.mode === "free" || ROSTER_SLOTS.every((p) => run.roster[p] !== null))
    return { ...run, offerIds: [] };
  const taken = new Set(Object.values(run.roster));
  const ids = draftPokemon(run.draftPool)
    .filter((p) => !taken.has(p.id) && (run.includeLegends || !p.legendary))
    .map((p) => p.id);
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
  draftPool?: DraftPool,
): Run {
  return refreshOffers({
    ...(draftPool !== undefined ? { draftPool } : {}),
    id: `run-${seed >>> 0}`,
    shinySeed: (seed ^ 0x51a7e123) >>> 0,
    typeMatchupsVersion: 1,
    typeTacticsVersion: 1,
    abilityVersion: 1,
    abilityMasteryVersion: 1,
    physicalAbilityVersion: 1,
    chemistryVersion: 1,
    chemistryGrowthVersion: 1,
    moraleVersion: 1,
    personalityVersion: 1,
    evaluationVersion: 1,
    courtVersion: COURT_VERSION,
    matchupVersion: 1,
    possessionVersion: 1,
    gameFlowVersion: 1,
    movesetVersion: 4,
    mode,
    includeLegends,
    roster: emptyRoster(),
    tactic: "balanced",
    rotation: "balanced",
    defense: "man",
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
  return refreshOffers({ ...run, rerollsLeft: run.rerollsLeft - 1 });
}
export function placePokemon(
  run: Run,
  pokemonId: number,
  position: RosterSlot,
): Run {
  const mon = POKEMON_BY_ID.get(pokemonId);
  if (
    run.result ||
    !mon ||
    !inDraftPool(run.draftPool, pokemonId) ||
    !ROSTER_SLOTS.includes(position) ||
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
  return run.mode === "spin" ? refreshOffers(next) : next;
}
export function swapPositions(
  run: Run,
  first: RosterSlot,
  second: RosterSlot,
): Run {
  if (
    run.result ||
    run.mode !== "free" ||
    first === second ||
    !ROSTER_SLOTS.includes(first) ||
    !ROSTER_SLOTS.includes(second)
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

export function autoFillBench(run: Run): Run {
  if (run.mode !== "free" || run.result) return run;
  const pool = draftPokemon(run.draftPool).filter(
    (mon) =>
      !Object.values(run.roster).includes(mon.id) &&
      (run.includeLegends || !mon.legendary),
  );
  let seed = run.draftSeed;
  const roster = { ...run.roster };
  for (const slot of BENCH_SLOTS) {
    if (roster[slot] !== null) continue;
    let index: number;
    if (run.evaluationVersion === 1) {
      const context = createEvaluationContext({ ...run, roster });
      const ranked = pool
        .map((mon) => evaluatePlayer(context, mon.id))
        .sort((a, b) => b.score - a.score || a.pokemonId - b.pokemonId);
      index = pool.findIndex((mon) => mon.id === ranked[0].pokemonId);
    } else {
      const random = nextRandom(seed);
      seed = random.seed;
      index = Math.floor(random.value * pool.length);
    }
    roster[slot] = pool.splice(index, 1)[0].id;
  }
  return { ...run, roster, draftSeed: seed };
}
