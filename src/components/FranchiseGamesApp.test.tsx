import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import App from "../App";
import { createRun, placePokemon } from "../game/draft";
import {
  archiveFranchiseSeason,
  startInteractiveFranchiseSeason,
} from "../game/franchise";
import { initialState } from "../game/state";
import { simulateSeason } from "../game/season";
import { simulatePlayoffs } from "../game/playoffs";
import { ROSTER_SLOTS, type GameState } from "../game/types";
import { POKEMON_BY_ID } from "../data/pokemon";
import { officialGameFromArcade } from "../game/officialGame";
import { finishedGame } from "../game/officialGame.testUtils";
import type { OfficialArcadeProps } from "./ArcadeMode";

vi.mock("./ArcadeMode", () => ({
  ArcadeMode: ({
    official,
    onExit,
  }: {
    official: OfficialArcadeProps;
    onExit: () => void;
  }) => (
    <div>
      <h1>{official.label}</h1>
      <button
        onClick={() => {
          void official
            .onComplete(
              officialGameFromArcade(
                finishedGame(official.fixture, official.teams),
                official.fixture,
                official.teams,
              ),
            )
            .then(onExit);
        }}
      >
        Finish scheduled game
      </button>
      <button onClick={onExit}>Leave scheduled game</button>
    </div>
  ),
}));
let ready: GameState;
beforeAll(() => {
  let run = createRun("free", true, 82);
  [65, 150, 149, 68, 143, 9, 94, 59].forEach((id, index) => {
    run = placePokemon(run, id, ROSTER_SLOTS[index]);
  });
  const result = simulateSeason(run);
  const finished = {
    ...initialState(82),
    run: {
      ...run,
      result,
      playoffs: simulatePlayoffs(result.league!, run.seasonSeed),
    },
  };
  ready = startInteractiveFranchiseSeason(archiveFranchiseSeason(finished), 93);
}, 30000);

it("connects minutes, training, played fixtures, careers and historical boxes across the franchise UI", async () => {
  let value: string | null = null;
  const storage = {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
  const mounted = render(<App initial={ready} storage={storage} />);
  const firstName = POKEMON_BY_ID.get(ready.run.roster.PG!)!.name;
  fireEvent.click(screen.getByRole("button", { name: "Save rotation" }));
  expect(JSON.parse(value!).run.rotationPlan).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Training plans" }));
  fireEvent.change(
    screen.getByRole("combobox", { name: `${firstName} training focus` }),
    { target: { value: "shooting" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Save training plans" }));
  expect(
    JSON.parse(value!).franchise.trainingPlans[ready.run.roster.PG!].focus,
  ).toBe("shooting");
  fireEvent.click(screen.getByRole("button", { name: "Play next game" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Leave scheduled game" }),
  );
  expect(JSON.parse(value!).run.seasonProgress.completedRounds).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Play next game" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Finish scheduled game" }),
  );
  await screen.findByRole(
    "button",
    { name: "Play next game" },
    { timeout: 10000 },
  );
  const played = JSON.parse(value!) as GameState;
  expect(played.run.seasonProgress!.completedRounds).toBe(1);
  expect(Object.keys(played.run.seasonProgress!.playedGames)).toHaveLength(1);
  expect(played.records).toEqual(ready.records);
  expect(screen.getByRole("button", { name: "Save rotation" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Career stats" }));
  fireEvent.click(
    screen.getByRole("button", { name: `Open ${firstName} career page` }),
  );
  expect(
    screen.getByRole("dialog", { name: `${firstName} career` }),
  ).toHaveTextContent("2 · LIVE");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "History" }));
  fireEvent.click(screen.getByRole("button", { name: "View Year 1 games" }));
  const historical = screen.getByRole("dialog", {
    name: "Year 1 game archive",
  });
  const boxes = await within(historical).findAllByRole(
    "button",
    { name: /View box/ },
    { timeout: 10000 },
  );
  fireEvent.click(boxes[0]);
  expect(
    screen.getByRole("button", { name: "Close box score" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close box score" }));
  fireEvent.keyDown(historical, { key: "Escape" });
  mounted.unmount();
  render(<App storage={storage} />);
  await waitFor(
    () =>
      expect(
        screen.getByRole("region", { name: "Franchise schedule" }),
      ).toHaveTextContent("1 / 82 games complete"),
    { timeout: 15000 },
  );
  expect(
    (JSON.parse(storage.getItem()!) as GameState).run.seasonProgress!
      .playedGames,
  ).toEqual(played.run.seasonProgress!.playedGames);
  fireEvent.click(screen.getByRole("button", { name: "Simulate next game" }));
  await waitFor(
    () => expect(JSON.parse(value!).run.seasonProgress.completedRounds).toBe(2),
    { timeout: 10000 },
  );
  expect(
    Object.keys(JSON.parse(value!).run.seasonProgress.playedGames),
  ).toHaveLength(1);
  expect(JSON.parse(value!).run.seasonProgress.result.modelVersion).toBe(6);
}, 40000);

it("records a scheduled playoff game in the bracket and uses its official box", async () => {
  const regular = simulateSeason(ready.run);
  const state: GameState = {
    ...ready,
    run: {
      ...ready.run,
      result: regular,
      seasonProgress: { modelVersion: 1, completedRounds: 82, playedGames: {} },
    },
  };
  let value: string | null = null;
  const storage = {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
  render(<App initial={state} storage={storage} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Play next playoff game" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Finish scheduled game" }),
  );
  await screen.findByRole(
    "button",
    { name: "Play next playoff game" },
    { timeout: 10000 },
  );
  const after = JSON.parse(value!) as GameState;
  expect(after.run.result).toEqual(regular);
  expect(after.records).toEqual(state.records);
  const official = Object.values(after.run.playoffs!.playedGames!);
  expect(official).toHaveLength(1);
  const summary = after.run
    .playoffs!.series.flatMap((series) => series.games)
    .find((game) => game.id === official[0].fixtureId)!;
  expect(summary.homeScore).toBe(official[0].match.homeScore);
  const button = screen.getAllByRole("button", {
    name: /View playoff box score/,
  })[0];
  fireEvent.click(button);
  expect(screen.getByRole("dialog")).toHaveTextContent(
    String(official[0].match.homeScore),
  );
  expect(screen.getByRole("dialog")).toHaveTextContent(
    String(official[0].match.awayScore),
  );
}, 15000);
