import { expect, it } from "vitest";
import { POKEMON } from "../data/pokemon";
import { emptyBox } from "./boxscore";
import { developPlayer } from "./development";
import {
  DEVELOPMENT_SKILLS,
  type DevelopmentRatings,
} from "./developmentTypes";
import { positionRating } from "./ratings";
import { POSITIONS, type LeaguePlayer } from "./types";

const species = POKEMON.filter((p) => !p.legendary).slice(0, 240);
const best = (id: number, dev: DevelopmentRatings) =>
  Math.max(
    ...POSITIONS.map((p) =>
      positionRating(
        species.find((s) => s.id === id)!,
        p,
        dev,
      ),
    ),
  );
const sd = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};
/** A season line whose per-minute production exactly meets the player's expectation. */
function season(id: number, dev: DevelopmentRatings, minutesPerGame: number) {
  const expected = best(id, dev) * 0.75 - 12;
  return {
    ...emptyBox(id, "PG"),
    teamId: 0,
    teamName: "Test",
    playerId: `0:${id}`,
    gamesPlayed: 82,
    gamesStarted: minutesPerGame >= 28 ? 82 : 0,
    doubleDoubles: 0,
    tripleDoubles: 0,
    highPoints: 0,
    playerOfGame: 0,
    fouls: 0,
    plusMinus: 0,
    rimFgm: 0,
    rimFga: 0,
    midFgm: 0,
    midFga: 0,
    minutes: minutesPerGame * 82,
    points: Math.round((expected * minutesPerGame * 82) / 36),
  } satisfies LeaguePlayer;
}
const apply = (dev: DevelopmentRatings, changes: DevelopmentRatings) => {
  const next = { ...dev };
  for (const s of DEVELOPMENT_SKILLS) {
    const v = (next[s] ?? 0) + (changes[s] ?? 0);
    if (v) next[s] = v;
    else delete next[s];
  }
  return next;
};
/** Eight seasons for the whole league; the best five of each eight play starter minutes. */
function career(balanced: boolean) {
  const devs = new Map(species.map((s) => [s.id, {} as DevelopmentRatings]));
  const gain = { starter: 0, reserve: 0 };
  const initial = sd(species.map((s) => best(s.id, {})));
  for (let year = 1; year <= 8; year++) {
    const ranked = [...species].sort(
      (a, b) => best(b.id, devs.get(b.id)!) - best(a.id, devs.get(a.id)!),
    );
    ranked.forEach((mon, i) => {
      const starter = i % 8 < 5,
        dev = devs.get(mon.id)!,
        before = best(mon.id, dev),
        change = developPlayer(
          season(mon.id, dev, starter ? 36 : 14),
          dev,
          year,
          4040,
          undefined,
          balanced,
        );
      const next = apply(dev, change.changes);
      devs.set(mon.id, next);
      gain[starter ? "starter" : "reserve"] += best(mon.id, next) - before;
    });
  }
  return {
    initial,
    final: sd(species.map((s) => best(s.id, devs.get(s.id)!))),
    // Mean eight-season rating change per player-season group.
    starter: gain.starter / (150 * 8),
    reserve: gain.reserve / (90 * 8),
  };
}

it("keeps the league rating spread stable and minutes roughly zero-sum under version 3", () => {
  const legacy = career(false),
    balanced = career(true);
  // The legacy formula widens the league and rewards minutes on their own.
  expect(legacy.final / legacy.initial).toBeGreaterThan(1.25);
  expect(legacy.starter - legacy.reserve).toBeGreaterThan(0.8);
  expect(balanced.final / balanced.initial).toBeLessThan(1.12);
  expect(Math.abs(balanced.starter - balanced.reserve)).toBeLessThan(
    (legacy.starter - legacy.reserve) / 2,
  );
});

it("still produces breakouts and slumps under version 3", () => {
  const outcomes = species
    .slice(0, 120)
    .map(
      (mon) =>
        developPlayer(season(mon.id, {}, 30), {}, 3, 77, undefined, true)
          .outcome,
    );
  expect(outcomes.filter((o) => o === "breakout").length).toBeGreaterThan(5);
  expect(outcomes.filter((o) => o === "slump").length).toBeGreaterThan(5);
});
