import { describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { ROSTER_SLOTS, type GameState } from "./types";
import { gameReducer, initialState } from "./state";
import { simulateSeason } from "./season";
import { simulatePlayoffs, playoffGameCount } from "./playoffs";
import { archiveFranchiseSeason } from "./franchise";
import { processOffseason } from "./offseason";
import { advanceFranchiseSeasonAsync } from "./interactiveSeason";
import * as local from "./localLeague";
import * as career from "./localCareer";
import { simulateLocalSeason } from "./localSeason";
import type { LocalLeagueOptions } from "./localFormat";
import { SaveStorage, type SaveRecordStore } from "./saveStorage";

/** Chrome and Firefox allow about 5M UTF-16 characters per site. */
const LOCAL_STORAGE_QUOTA = 5_242_880;
const report = (label: string, length: number) =>
  process.stdout.write(
    `[save size] ${label}: ${length.toLocaleString("en-US")} characters\n`,
  );

function quotaStorage() {
  const data = new Map<string, string>();
  const records = new Map<string, string>();
  const area = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      const used = [...data].reduce(
        (sum, [k, v]) => sum + (k === key ? 0 : k.length + v.length),
        0,
      );
      if (used + key.length + value.length > LOCAL_STORAGE_QUOTA)
        throw new DOMException("full", "QuotaExceededError");
      data.set(key, value);
    },
    removeItem: (key: string) => void data.delete(key),
  };
  const store: SaveRecordStore = {
    readAll: async () => new Map(records),
    put: async (key, value) => void records.set(key, value),
    delete: async (key) => void records.delete(key),
  };
  return { area, store, records };
}

async function franchiseYearTwo() {
  const run = {
    ...createRun("free", true, 47),
    roster: Object.fromEntries(
      ROSTER_SLOTS.map((s, i) => [s, [65, 150, 149, 68, 143, 9, 94, 59][i]]),
    ) as GameState["run"]["roster"],
  };
  const result = simulateSeason(run);
  let state = processOffseason(
    archiveFranchiseSeason({
      ...initialState(47),
      records: {
        ...initialState(47).records,
        free: {
          runs: 1,
          bestWins: result.wins,
          perfectSeasons: Number(result.wins === 82),
        },
      },
      run: {
        ...run,
        result,
        playoffs: simulatePlayoffs(result.league!, run.seasonSeed),
      },
    }),
  );
  state = gameReducer(state, { type: "START_FRANCHISE_SEASON", seed: 1002 });
  const source = state.run;
  const played = await advanceFranchiseSeasonAsync(source, 82);
  state = gameReducer(state, {
    type: "APPLY_FRANCHISE_RUN",
    source,
    run: played,
  });
  state = gameReducer(state, {
    type: "APPLY_PLAYOFFS",
    source: state.run,
    playoffs: simulatePlayoffs(state.run.result!.league!, state.run.seasonSeed),
  });
  return gameReducer(state, { type: "ENTER_OFFSEASON" });
}

function localCareer(options: LocalLeagueOptions, years: number) {
  let draft = local.createLocalLeague(
    [
      { name: "Sam", teamId: 1 },
      { name: "Alex", teamId: 3 },
    ],
    true,
    42,
    2,
    options,
  );
  while (local.currentLocalTurn(draft)) {
    draft = local.advanceLocalCpu(draft);
    const turn = local.currentLocalTurn(draft);
    if (!turn) break;
    const taken = new Set(draft.picks.map((p) => p.pokemonId));
    const mon = local.localLeaguePool(draft).find((p) => !taken.has(p.id))!;
    const occupied = draft.picks
      .filter((p) => p.teamId === turn.teamId)
      .map((p) => p.slot);
    draft = local.pickLocalPlayer(
      draft,
      mon.id,
      ROSTER_SLOTS.find((s) => !occupied.includes(s))!,
    );
  }
  for (let year = 1; year <= years; year++) {
    const result = simulateLocalSeason(draft);
    const playoffs = simulatePlayoffs(
      result.league!,
      career.localSeasonSeed(draft),
    );
    const completed = {
      ...draft,
      completed: true,
      playoffGames: playoffGameCount(playoffs),
    };
    // The final season of a career ends with its playoffs.
    if (year === years) return completed;
    draft = career.beginLocalOffseason(completed, result, playoffs);
    for (
      let turn = career.currentLocalRookieTurn(draft);
      turn;
      turn = career.currentLocalRookieTurn(draft)
    ) {
      const id = career.localRookiePool(draft)[0].id;
      const release = local.localLeagueTeams(draft)[turn.teamId].roster.PG!;
      draft = career.pickLocalRookie(draft, id, release);
    }
    draft = career.startNextLocalSeason(draft);
  }
  return draft;
}
const fullPool = (
  teamCount: 8 | 30,
  playoffTeams: 8 | 16,
): LocalLeagueOptions => ({
  mode: "full-pool",
  format: { teamCount, gamesPerTeam: 14, playoffTeams, bestOf: 7 },
  engineRules: {
    version: 1,
    abilities: true,
    adaptiveCoaching: true,
    familiarity: 0,
  },
});

describe("save size budget", () => {
  it("stores a 20-season franchise beyond the localStorage quota in IndexedDB", async () => {
    const yearTwo = await franchiseYearTwo();
    const measured = JSON.stringify(yearTwo);
    report("franchise, year 2 offseason (measured)", measured.length);
    // Each archived year adds one history and one offseason report. Repeat the
    // measured second year to estimate a 20-season career's size.
    const long = structuredClone(yearTwo);
    const franchise = long.franchise!;
    const [season, offseason] = [
      franchise.history.at(-1)!,
      franchise.offseasons!.at(-1)!,
    ];
    while (franchise.history.length < 20) {
      franchise.history.push({
        ...structuredClone(season),
        year: franchise.history.length + 1,
      });
      franchise.offseasons!.push(structuredClone(offseason));
    }
    const text = JSON.stringify(long);
    report("franchise, 20 seasons (projected)", text.length);
    expect(measured.length).toBeGreaterThan(LOCAL_STORAGE_QUOTA * 0.8);
    expect(text.length).toBeGreaterThan(LOCAL_STORAGE_QUOTA);

    const { area, store, records } = quotaStorage();
    const storage = new SaveStorage(() => area);
    await storage.attach(store);
    storage.setItem("pokemon-basketball:v3", text);
    storage.setItem("pokemon-basketball:v3:backup", text);
    await storage.flush();
    expect(records.get("pokemon-basketball:v3")).toBe(text);
    const reopened = new SaveStorage(() => area);
    await reopened.attach(store);
    expect(reopened.getItem("pokemon-basketball:v3")).toBe(text);
  }, 120000);

  it("loads a 50-season local career and keeps it under the parse limit", () => {
    const draft = localCareer(fullPool(8, 8), 50);
    const text = JSON.stringify(draft);
    report("local league, 8 clubs, 50 seasons", text.length);
    expect(text.length).toBeLessThan(local.LOCAL_SAVE_MAX_LENGTH);
    expect(local.parseLocalLeague(text)).toEqual(draft);
  }, 300000);

  // About six minutes: SAVE_SIZE_FULL=1 npx vitest run src/game/saveSize.test.ts
  it.skipIf(!process.env.SAVE_SIZE_FULL)(
    "loads the largest 50-season local career (30 clubs)",
    () => {
      const draft = localCareer(fullPool(30, 16), 50);
      const text = JSON.stringify(draft);
      report("local league, 30 clubs, 50 seasons", text.length);
      expect(text.length).toBeGreaterThan(LOCAL_STORAGE_QUOTA);
      expect(text.length).toBeLessThan(local.LOCAL_SAVE_MAX_LENGTH);
      expect(local.parseLocalLeague(text)).toEqual(draft);
    },
    1800000,
  );
});
