import { expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import {
  draftRosterProfile,
  projectDraftImpact,
  projectDraftPool,
} from "./draftImpact";
import { createLineupDraftProjector } from "./draftLineup";
import { runDraftLineupJob } from "./draftLineupJobs";
import { recommendRosterPicks } from "./draftAdvice";
import { runDraftPoolJob } from "./draftPoolJobs";
import { teamRatingProfile } from "./ratings";
import { isShinyPokemon, shinyPokemon } from "./shiny";
import { emptyRoster } from "./types";

const candidate = POKEMON_BY_ID.get(25)!;
let shinySeed = 0;
while (!isShinyPokemon(candidate.id, shinySeed)) shinySeed++;

it("uses shiny skills in the current team baseline and each fixed-slot candidate", () => {
  const roster = { ...emptyRoster(), PG: 25 };
  const expected = teamRatingProfile(
    roster,
    "balanced",
    "balanced",
    undefined,
    undefined,
    shinySeed,
  );
  const profile = draftRosterProfile(roster, "balanced", "balanced", shinySeed);
  expect(profile.offense).toBe(expected.ratings.offense);
  expect(profile.offense).toBeGreaterThan(
    draftRosterProfile(roster, "balanced", "balanced").offense,
  );
  const plain = projectDraftImpact(
    emptyRoster(),
    25,
    "PG",
    "balanced",
    "balanced",
  )!;
  const boosted = projectDraftImpact(
    emptyRoster(),
    25,
    "PG",
    "balanced",
    "balanced",
    shinySeed,
  )!;
  expect(
    boosted.metrics.find((m) => m.key === "offense")!.after,
  ).toBeGreaterThan(plain.metrics.find((m) => m.key === "offense")!.after);
  expect(
    runDraftPoolJob({
      kind: "fixed",
      ids: [25],
      roster: emptyRoster(),
      position: "PG",
      tactic: "balanced",
      rotation: "balanced",
      shinySeed,
    }),
  ).toEqual(
    projectDraftPool(
      [25],
      emptyRoster(),
      "PG",
      "balanced",
      "balanced",
      shinySeed,
    ),
  );
});

it("optimizes and reports lineup projections using the same shiny seed", () => {
  const roster = { ...emptyRoster(), C: 95 };
  const result = createLineupDraftProjector(
    roster,
    "balanced",
    "balanced",
    "balance",
    ["C"],
    shinySeed,
  )(25)!;
  const expected = draftRosterProfile(
    result.lineup!.after,
    "balanced",
    "balanced",
    shinySeed,
  );
  expect(result.metrics.find((m) => m.key === "offense")!.after).toBe(
    Math.round(expected.offense * 10) / 10,
  );
  const plain = createLineupDraftProjector(
    roster,
    "balanced",
    "balanced",
    "balance",
    ["C"],
  )(25)!;
  expect(
    result.metrics.find((m) => m.key === "balance")!.after,
  ).toBeGreaterThan(plain.metrics.find((m) => m.key === "balance")!.after);
  expect(result.lineup!.after.C).toBe(95);
  const job = {
    ids: [25],
    roster,
    tactic: "balanced" as const,
    rotation: "balanced" as const,
    focus: "balance" as const,
    lockedSlots: ["C"] as const,
    shinySeed,
  };
  expect(runDraftLineupJob(job)).toEqual([result]);
  expect(runDraftLineupJob({ ...job, shinySeed: undefined })).toEqual([plain]);
});

it.each([undefined, 1] as const)(
  "scores seeded advice consistently with pre-boosted profiles (evaluation version %s)",
  (evaluationVersion) => {
    const roster = emptyRoster();
    const team = {
      roster,
      tactic: "balanced" as const,
      ...(evaluationVersion ? { evaluationVersion } : {}),
    };
    const plain = recommendRosterPicks(
      [candidate],
      roster,
      "balanced",
      1,
      team,
    );
    const seeded = recommendRosterPicks(
      [candidate],
      roster,
      "balanced",
      1,
      team,
      shinySeed,
    );
    expect(seeded[0].score).toBeGreaterThan(plain[0].score);
    expect(
      recommendRosterPicks([candidate], roster, "balanced", 1, {
        ...team,
        shinySeed,
      }),
    ).toEqual(seeded);
    if (!evaluationVersion)
      expect(seeded).toEqual(
        recommendRosterPicks(
          [shinyPokemon(candidate, shinySeed)],
          roster,
          "balanced",
          1,
          team,
        ),
      );
    expect(
      runDraftPoolJob({
        kind: "advice",
        pool: [candidate],
        roster,
        tactic: "balanced",
        team,
        shinySeed,
      }),
    ).toEqual(seeded);
  },
);

it("preserves unseeded draft projections and advice", () => {
  const roster = { ...emptyRoster(), PG: 65 };
  expect(
    projectDraftPool(
      [25],
      roster,
      "best-open",
      "balanced",
      "balanced",
      undefined,
    ),
  ).toEqual(
    projectDraftPool([25], roster, "best-open", "balanced", "balanced"),
  );
  expect(
    createLineupDraftProjector(
      roster,
      "balanced",
      "balanced",
      "balance",
      [],
      undefined,
    )(25),
  ).toEqual(
    createLineupDraftProjector(roster, "balanced", "balanced", "balance")(25),
  );
});
