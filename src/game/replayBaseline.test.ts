import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  createLocalLeague,
  currentLocalTurn,
  advanceLocalCpu,
  pickLocalPlayer,
  localLeagueRun,
} from "./localLeague";
import { POKEMON } from "../data/pokemon";
import { ROSTER_SLOTS } from "./types";
import { simulateSeason } from "./season";
import { simulatePlayoffs } from "./playoffs";

it("preserves the original local league's deterministic season and playoffs", () => {
  let draft = createLocalLeague(
    [
      { name: "Sam", teamId: 0 },
      { name: "Alex", teamId: 1 },
    ],
    false,
    42,
    1,
  );
  while (currentLocalTurn(draft)) {
    draft = advanceLocalCpu(draft);
    const turn = currentLocalTurn(draft);
    if (!turn) break;
    const mon = POKEMON.find(
      (m) => !m.legendary && !draft.picks.some((p) => p.pokemonId === m.id),
    )!;
    const slot = ROSTER_SLOTS.find(
      (s) => !draft.picks.some((p) => p.teamId === turn.teamId && p.slot === s),
    )!;
    draft = pickLocalPlayer(draft, mon.id, slot);
  }
  const run = localLeagueRun(draft),
    season = simulateSeason(run),
    playoffs = simulatePlayoffs(season.league!, run.seasonSeed);
  const digest = createHash("sha256")
    .update(JSON.stringify({ picks: draft.picks, season, playoffs }))
    .digest("hex");
  expect(digest).toBe(
    "d00658de9388ce27e835924f54bca2c27307bae160a20de4ae08c79f88c04346",
  );
}, 20000);
