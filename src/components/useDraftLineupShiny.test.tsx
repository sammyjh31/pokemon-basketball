import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDraftLineup } from "./useDraftLineup";
import {
  runDraftLineupJob,
  type DraftLineupJob,
} from "../game/draftLineupJobs";
import { emptyRoster } from "../game/types";
import { isShinyPokemon } from "../game/shiny";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("keeps shiny projections when workers are unavailable", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("Worker", undefined);
  let shinySeed = 0;
  while (!isShinyPokemon(25, shinySeed)) shinySeed++;
  const job: DraftLineupJob = {
    ids: [25],
    roster: emptyRoster(),
    tactic: "balanced",
    rotation: "balanced",
    focus: "balance",
    shinySeed,
  };
  const { result } = renderHook(() => useDraftLineup(job));
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(result.current.pending).toBe(false);
  expect(result.current.projections).toEqual(runDraftLineupJob(job));
  expect(result.current.projections).not.toEqual(
    runDraftLineupJob({ ...job, shinySeed: undefined }),
  );
});
