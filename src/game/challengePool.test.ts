import { describe, expect, it } from "vitest";
import { createRun, placePokemon, reroll } from "./draft";
import { gameReducer, initialState } from "./state";
import { ROSTER_SLOTS } from "./types";
import { POKEMON_BY_ID } from "../data/pokemon";
import { createLeague } from "./league";
import { loadGame, saveGame } from "./persistence";
import { lineupLink, parseLineup } from "./lineup";
import { prepareArcadeTeams } from "../components/ArcadeSetup";

const cases = [
  [1, 1, 151],
  [2, 152, 251],
  [3, 252, 386],
  [4, 387, 493],
  [5, 494, 649],
  [6, 650, 721],
  [7, 722, 809],
  ["all", 1, 809],
] as const;

describe("generation-specific 82–0 drafts", () => {
  it.each(cases)(
    "keeps generation %s offers, rerolls and eight picks inside %i–%i",
    (pool, first, last) => {
      for (let seed = 0; seed < 8; seed++) {
        let run = createRun("spin", false, seed, pool);
        expect(run).toEqual(createRun("spin", false, seed, pool));
        run = reroll(reroll(run));
        for (const slot of ROSTER_SLOTS) {
          expect(run.offerIds).toHaveLength(4);
          expect(new Set(run.offerIds).size).toBe(4);
          for (const id of run.offerIds) {
            expect(id).toBeGreaterThanOrEqual(first);
            expect(id).toBeLessThanOrEqual(last);
            expect(POKEMON_BY_ID.get(id)!.legendary).toBe(false);
            expect(Object.values(run.roster)).not.toContain(id);
          }
          const id = run.offerIds[0];
          run = placePokemon(run, id, slot);
          expect(run.roster[slot]).toBe(id);
        }
        expect(run.offerIds).toEqual([]);
        expect(new Set(Object.values(run.roster)).size).toBe(8);
      }
    },
  );

  it("rejects a forged offer from outside the selected generation", () => {
    const run = {
      ...createRun("spin", true, 32, 7),
      offerIds: [25, 722, 723, 724],
    };
    expect(placePokemon(run, 25, "PG")).toBe(run);
  });

  it("resets picks and rerolls for a new pool while retaining the chosen coach and records", () => {
    let state = initialState(22);
    state.run.coach = { version: 1, id: "misty" };
    state = gameReducer(state, {
      type: "PLACE",
      position: "PG",
      pokemonId: state.run.offerIds[0],
    });
    state = gameReducer(state, { type: "REROLL" });
    const next = gameReducer(state, { type: "DRAFT_POOL", pool: 7 });
    expect(next.run.draftPool).toBe(7);
    expect(Object.values(next.run.roster).every((id) => id === null)).toBe(
      true,
    );
    expect(next.run.rerollsLeft).toBe(2);
    expect(next.run.coach).toEqual(state.run.coach);
    expect(next.run.seasonSeed).toBe(state.run.seasonSeed);
    expect(next.records).toEqual(state.records);
    expect(next.run.offerIds.every((id) => id >= 722 && id <= 809)).toBe(true);
  });

  it("keeps thirty unique eight-player teams while CPUs recruit from all seven generations", () => {
    let run = createRun("spin", false, 53, 7);
    for (const slot of ROSTER_SLOTS)
      run = placePokemon(run, run.offerIds[0], slot);
    const teams = createLeague(run);
    const ids = teams.flatMap((t) => Object.values(t.roster));
    expect(teams).toHaveLength(30);
    expect(ids).toHaveLength(240);
    expect(new Set(ids).size).toBe(240);
    expect(
      ids.every(
        (id) => id !== null && id <= 809 && !POKEMON_BY_ID.get(id)!.legendary,
      ),
    ).toBe(true);
    expect(teams[0].roster).toEqual(run.roster);
    expect(
      teams
        .slice(1)
        .some((t) => Object.values(t.roster).some((id) => id! < 722)),
    ).toBe(true);
    expect(
      teams
        .slice(1)
        .some((t) => Object.values(t.roster).some((id) => id! > 251)),
    ).toBe(true);
    expect(
      prepareArcadeTeams({
        ...run,
        leagueTeams: teams,
      }).error,
    ).toBeNull();
  });

  it.each(cases)(
    "restores generation %s drafts without replacing their offers",
    (pool) => {
      let run = createRun("spin", true, 32, pool);
      run = placePokemon(run, run.offerIds[0], "PG");
      const state = { ...initialState(32), run };
      let raw: string | null = null;
      const storage = {
        getItem: () => raw,
        setItem: (_key: string, value: string) => {
          raw = value;
        },
      };
      expect(saveGame(storage, state).saved).toBe(true);
      const loaded = loadGame(storage, 99);
      expect(loaded.notice).toBeNull();
      expect(loaded.state).toEqual(state);
      const bad = JSON.parse(raw!);
      bad.run.draftPool = 9;
      expect(
        loadGame({ getItem: () => JSON.stringify(bad), setItem: () => {} }, 99)
          .notice,
      ).not.toBeNull();
    },
  );

  it("shares a later-generation lineup without broadening old untagged links", () => {
    let run = createRun("spin", true, 32, 7);
    for (const slot of ROSTER_SLOTS)
      run = placePokemon(run, run.offerIds[0], slot);
    const link = lineupLink(
      "https://example.com/pokemon-basketball/",
      run.roster,
    );
    expect(parseLineup(new URL(link).search)).toEqual(run.roster);
    expect(parseLineup("?lineup=722,723,724,725,726,727,728,729")).toBeNull();
  });
});
