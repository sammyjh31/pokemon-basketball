import { describe, expect, it } from "vitest";
import { POKEMON, POKEMON_BY_ID } from "../data/pokemon";
import { simulateSeason } from "./season";
import { ROSTER_SLOTS } from "./types";
import * as local from "./localLeague";

const managers = [
  { name: "Sam", teamId: 0 },
  { name: "Alex", teamId: 1 },
];
function finished(includeLegends = false) {
  let draft = local.createLocalLeague(managers, includeLegends, 42);
  while (draft.picks.length < 240) {
    draft = local.advanceLocalCpu(draft);
    const turn = local.currentLocalTurn(draft);
    if (!turn) break;
    const taken = new Set(draft.picks.map((p) => p.pokemonId));
    const id = POKEMON.find(
      (p) => !taken.has(p.id) && (includeLegends || !p.legendary),
    )!.id;
    const used = draft.picks
      .filter((p) => p.teamId === turn.teamId)
      .map((p) => p.slot);
    draft = local.pickLocalPlayer(
      draft,
      id,
      ROSTER_SLOTS.find((s) => !used.includes(s))!,
    );
  }
  return draft;
}

describe("local snake league", () => {
  it("expands only new drafts while retaining the original pool for old saves", () => {
    const next = local.createLocalLeague(managers, true, 42);
    expect(next.version).toBe(2);
    expect(local.localLeaguePool(next)).toHaveLength(809);
    const old = local.createLocalLeague(managers, true, 42, 1);
    expect(
      local.localLeaguePool(local.parseLocalLeague(JSON.stringify(old))),
    ).toHaveLength(251);
    const allHuman = Array.from({ length: 30 }, (_, teamId) => ({
      name: `Friend ${teamId}`,
      teamId,
    }));
    expect(() =>
      local.pickLocalPlayer(
        local.createLocalLeague(allHuman, true, 42, 1),
        448,
        "PG",
      ),
    ).toThrow();
    expect(
      local.pickLocalPlayer(
        local.createLocalLeague(allHuman, true, 42),
        448,
        "PG",
      ).picks[0].pokemonId,
    ).toBe(448);
  });
  it("reverses all 30 teams at round boundaries, including consecutive end picks", () => {
    expect(local.createLocalLeague).toBeTypeOf("function");
    let draft = local.createLocalLeague(
      Array.from({ length: 30 }, (_, teamId) => ({
        name: `Friend ${teamId + 1}`,
        teamId,
      })),
      true,
      42,
    );
    const turns: number[] = [];
    for (let i = 0; i < 61; i++) {
      turns.push(local.currentLocalTurn(draft)!.teamId);
      draft = local.pickLocalPlayer(
        draft,
        i + 1,
        ROSTER_SLOTS[Math.floor(i / 30)],
      );
    }
    expect(new Set(turns.slice(0, 30)).size).toBe(30);
    expect(turns.slice(30, 60)).toEqual([...turns.slice(0, 30)].reverse());
    expect(turns[29]).toBe(turns[30]);
    expect(turns[59]).toBe(turns[60]);
    expect(draft.order).toEqual(
      local.createLocalLeague(managers, true, 42).order,
    );
  });

  it("automates only CPU turns and fills all 240 slots without legends or duplicates", () => {
    const start = local.createLocalLeague(managers, false, 42);
    const paused = local.advanceLocalCpu(start);
    expect(
      managers.some((m) => m.teamId === local.currentLocalTurn(paused)!.teamId),
    ).toBe(true);
    expect(local.advanceLocalCpu(paused)).toBe(paused);
    const draft = finished();
    expect(draft.picks).toHaveLength(240);
    expect(new Set(draft.picks.map((p) => p.pokemonId)).size).toBe(240);
    expect(
      draft.picks.every((p) => !POKEMON_BY_ID.get(p.pokemonId)!.legendary),
    ).toBe(true);
    expect(local.currentLocalTurn(draft)).toBeNull();
    expect(
      local
        .localLeagueTeams(draft)
        .every((t) => Object.values(t.roster).every(Boolean)),
    ).toBe(true);
  });

  it("rejects invalid managers, CPU hijacks, duplicate picks, banned players and occupied slots", () => {
    expect(() =>
      local.createLocalLeague(
        [{ name: " ", teamId: 0 }, managers[1]],
        false,
        1,
      ),
    ).toThrow();
    expect(() =>
      local.createLocalLeague(
        [managers[0], { ...managers[1], teamId: 0 }],
        false,
        1,
      ),
    ).toThrow();
    expect(() =>
      local.createLocalLeague(
        [managers[0], { name: "sam", teamId: 1 }],
        false,
        1,
      ),
    ).toThrow();
    let draft = local.advanceLocalCpu(
      local.createLocalLeague(managers, false, 42),
    );
    expect(() => local.pickLocalPlayer(draft, 150, "PG")).toThrow();
    if (draft.picks.length)
      expect(() =>
        local.pickLocalPlayer(draft, draft.picks[0].pokemonId, "PG"),
      ).toThrow();
    const taken = new Set(draft.picks.map((p) => p.pokemonId));
    const available = POKEMON.filter((p) => !p.legendary && !taken.has(p.id));
    draft = local.pickLocalPlayer(draft, available[0].id, "PG");
    if (
      !managers.some((m) => m.teamId === local.currentLocalTurn(draft)?.teamId)
    ) {
      expect(() =>
        local.pickLocalPlayer(draft, available[1].id, "SG"),
      ).toThrow();
    }
  });

  it("round trips compact saves, including lineup changes, and rejects corrupt draft history", () => {
    const draft = finished();
    const changed = local.updateLocalCoaching(
      local.swapLocalSlots(draft, 1, "PG", "C"),
      1,
      { tactic: "pace", defense: "zone", rotation: "bench" },
    );
    expect(local.parseLocalLeague(JSON.stringify(changed))).toEqual(changed);
    const corrupt = structuredClone(changed);
    corrupt.picks[1].pokemonId = corrupt.picks[0].pokemonId;
    expect(() => local.parseLocalLeague(JSON.stringify(corrupt))).toThrow();
    expect(() =>
      local.parseLocalLeague(
        JSON.stringify({ ...draft, order: Array(30).fill(0) }),
      ),
    ).toThrow();
    expect(() =>
      local.parseLocalLeague(
        JSON.stringify({ ...draft, picks: draft.picks.slice(1) }),
      ),
    ).toThrow();
    expect(() =>
      local.parseLocalLeague(
        JSON.stringify({ ...draft, picks: [], completed: true }),
      ),
    ).toThrow();
    expect(() => local.parseLocalLeague('{"version":999}')).toThrow();
    expect(() =>
      local.swapLocalSlots({ ...draft, completed: true }, 1, "PG", "C"),
    ).toThrow();
  });

  it("feeds every drafted roster and coach into the existing 1230-game season", () => {
    const draft = finished();
    const run = local.localLeagueRun(draft);
    expect(run.leagueTeams).toHaveLength(30);
    const result = simulateSeason(run);
    expect(result.league!.games).toHaveLength(1230);
    expect(
      result.league!.standings.every((s) => s.wins + s.losses === 82),
    ).toBe(true);
    for (const team of result.league!.teams) {
      expect(Object.values(team.roster).sort()).toEqual(
        draft.picks
          .filter((p) => p.teamId === team.id)
          .map((p) => p.pokemonId)
          .sort(),
      );
    }
    const ranked = local.rankLocalManagers(draft, result.league!);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].standing.wins).toBeGreaterThanOrEqual(
      ranked[1].standing.wins,
    );
    expect(
      simulateSeason(
        local.localLeagueRun(
          local.parseLocalLeague(JSON.stringify({ ...draft, completed: true })),
        ),
      ),
    ).toEqual(result);
  }, 300000);

  it("preserves playoff progress and rejects counts outside a completed season", () => {
    const draft = finished();
    const saved = { ...draft, completed: true, playoffGames: 8 };
    expect(local.parseLocalLeague(JSON.stringify(saved))).toEqual(saved);
    expect(
      local.parseLocalLeague(JSON.stringify({ ...draft, completed: true })),
    ).not.toHaveProperty("playoffGames");
    for (const playoffGames of [-1, 106, 1.5, "8", null]) {
      expect(() =>
        local.parseLocalLeague(JSON.stringify({ ...saved, playoffGames })),
      ).toThrow();
    }
    expect(() =>
      local.parseLocalLeague(JSON.stringify({ ...saved, completed: false })),
    ).toThrow();
  });
});
