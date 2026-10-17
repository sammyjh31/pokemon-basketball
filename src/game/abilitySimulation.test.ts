import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import { addBox, leaguePlayers } from "./leagueStats";
import { abilityTotal } from "./abilities";
import { ROSTER_SLOTS } from "./types";
const teams = () => {
  const run = createRun("free", true, 2719);
  delete run.physicalAbilityVersion;
  run.roster = Object.fromEntries(
    ROSTER_SLOTS.map((slot, i) => [slot, [25, 92, 130, 1, 95, 81, 65, 143][i]]),
  ) as typeof run.roster;
  return createLeague(run);
};
it("enables species abilities for new solo teams and counts only recorded effects", () => {
  const [home, away] = teams();
  expect(home.abilityVersion).toBe(1);
  expect(away.abilityVersion).toBe(1);
  const game = simulateMatch(home, away, 428);
  const boxes = [...game.homeBox, ...game.awayBox];
  expect(boxes.reduce((n, b) => n + abilityTotal(b), 0)).toBeGreaterThan(0);
  const shots = game.insights!.shots;
  for (const box of boxes) {
    expect(abilityTotal(box)).toBe(
      shots.reduce(
        (n, s) =>
          n +
          (s.abilityEffects?.filter((e) => e.playerId === box.playerId)
            .length ?? 0),
        0,
      ),
    );
  }
  const compact = simulateMatch(home, away, 428, { collectInsights: false });
  expect(compact.homeBox).toEqual(game.homeBox);
  expect(compact.awayBox).toEqual(game.awayBox);
});
it("keeps legacy and explicitly disabled rules free of new ability effects", () => {
  const [home, away] = teams();
  delete home.abilityVersion;
  delete away.abilityVersion;
  const legacy = simulateMatch(home, away, 529);
  expect(legacy.homeBox.every((p) => p.abilityActivations === undefined)).toBe(
    true,
  );
  home.abilityVersion = away.abilityVersion = 1;
  for (const team of [home, away])
    team.engineRules = {
      version: 1,
      abilities: false,
      adaptiveCoaching: false,
      familiarity: 0,
    };
  const disabled = simulateMatch(home, away, 529);
  expect(
    [...disabled.homeBox, ...disabled.awayBox].every(
      (p) => p.abilityActivations === undefined,
    ),
  ).toBe(true);
});
it("aggregates all roles into season and playoff player rows without mutating boxes", () => {
  const all = teams(),
    [home, away] = all;
  const match = simulateMatch(home, away, 717);
  const players = leaguePlayers(all);
  for (const box of [...match.homeBox, ...match.awayBox]) {
    const player = players.find((p) => p.playerId === box.playerId)!;
    addBox(player, box, match.playerOfGameId);
    addBox(player, box, match.playerOfGameId);
    expect(abilityTotal(player)).toBe(abilityTotal(box) * 2);
    expect(player.abilityActivations).not.toBe(box.abilityActivations);
  }
});

it("changes simulated shot probabilities and outcomes, rather than only adding reporting", () => {
  const [home, away] = teams();
  const legacyHome = { ...home, abilityVersion: undefined },
    legacyAway = { ...away, abilityVersion: undefined };
  const enabled = simulateMatch(home, away, 428);
  const legacy = simulateMatch(legacyHome, legacyAway, 428);
  expect(enabled.insights!.shots.map((s) => s.expectedProbability)).not.toEqual(
    legacy.insights!.shots.map((s) => s.expectedProbability),
  );
  const scores = (active: boolean) =>
    [2, 5, 22, 428, 717, 999].map((seed) => {
      const g = simulateMatch(
        active ? home : legacyHome,
        active ? away : legacyAway,
        seed,
      );
      return [g.homeScore, g.awayScore];
    });
  expect(scores(true)).not.toEqual(scores(false));
  const effects = enabled.insights!.shots.flatMap(
    (s) => s.abilityEffects ?? [],
  );
  expect(effects.some((e) => e.probabilityDelta > 0)).toBe(true);
  expect(effects.some((e) => e.probabilityDelta < 0)).toBe(true);
  expect(effects.every((e) => Math.abs(e.probabilityDelta) <= 0.0300001)).toBe(
    true,
  );
  expect(
    enabled
      .insights!.shots.filter((s) => s.blocked)
      .every((s) => !s.abilityEffects),
  ).toBe(true);
});
