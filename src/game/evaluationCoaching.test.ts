import * as sharedEvaluation from "./teamEvaluation";
import { expect, it, vi } from "vitest";
import { coachGamePlan, coachRotationMinutes } from "./coachPolicy";
import { coachTrainingPlans } from "./coachTraining";
import {
  createEvaluationContext,
  evaluatePlayer,
  evaluationGamePlan,
  evaluationTrainingOptions,
} from "./teamEvaluation";
import { teamRatings } from "./ratings";
import { ROSTER_SLOTS, type LeagueTeam } from "./types";
const team = (): LeagueTeam => {
  const roster = {
    PG: 65,
    SG: 135,
    SF: 149,
    PF: 68,
    C: 143,
    B1: 121,
    B2: 6,
    B3: 131,
  };
  return {
    id: 0,
    name: "Test",
    roster,
    tactic: "balanced",
    defense: "man",
    rotation: "balanced",
    ratings: teamRatings(roster),
    coach: { version: 1, id: "misty" },
    abilityVersion: 1,
    evaluationVersion: 1,
  };
};
it("uses shared scheme choices and attainable training gains", () => {
  const t = team(),
    plan = coachGamePlan(t),
    expected = evaluationGamePlan(t);
  expect(plan.tactic).toBe(expected.tactic);
  expect(plan.defense).toBe(expected.defense);
  expect(plan.reason).toMatch(/shared/i);
  const training = coachTrainingPlans(t);
  for (const id of Object.values(t.roster)) {
    const target = evaluationTrainingOptions(t, id!)[0];
    expect(training[id!]!.plan.focus).toBe(target.focus);
    expect(training[id!]!.reasons.join(" ")).toMatch(/shared team value/i);
  }
});
it("uses shared player ordering for minutes while preserving the regulation workload", () => {
  const t = team(),
    ctx = createEvaluationContext(t),
    minutes = coachRotationMinutes(t);
  expect(Object.values(minutes).reduce((n, m) => n + m, 0)).toBe(240);
  expect(Math.max(...Object.values(minutes))).toBeLessThanOrEqual(40);
  const sorted = ROSTER_SLOTS.map((slot) => ({
    slot,
    score: evaluatePlayer(ctx, t.roster[slot]!).score,
  })).sort((a, b) => b.score - a.score);
  expect(minutes[sorted[0].slot]).toBeGreaterThanOrEqual(
    minutes[sorted.at(-1)!.slot],
  );
});

import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
it("uses modern decisions in matches while isolating old rotation caches and validating rule parity", () => {
  const modern = team();
  const other = {
    ...team(),
    id: 1,
    name: "Other",
    coach: { version: 1 as const, id: "brock" },
  };
  const legacy = { ...modern, evaluationVersion: undefined };
  const legacyOther = { ...other, evaluationVersion: undefined };
  const oldGame = simulateMatch(legacy, legacyOther, 173);
  const newGame = simulateMatch(modern, other, 173);
  expect(simulateMatch(legacy, legacyOther, 173)).toEqual(oldGame);
  expect(simulateMatch(modern, other, 173)).toEqual(newGame);
  expect(newGame.homeBox).not.toEqual(oldGame.homeBox);
  expect(() => simulateMatch(modern, legacyOther, 173)).toThrow(
    /evaluation rules/,
  );
  const minutes = coachRotationMinutes({ ...modern, coach: undefined });
  expect(Object.values(minutes).reduce((sum, n) => sum + n, 0)).toBe(240);
});
it("produces several useful training focuses across a coached league", () => {
  const t = team();
  const teams = createLeague({
    ...createRun("free", true, 22),
    roster: t.roster,
    coach: t.coach,
  });
  const focuses = teams.flatMap((t) =>
    Object.values(coachTrainingPlans(t)).map((p) => p.plan.focus),
  );
  expect(new Set(focuses).size).toBeGreaterThanOrEqual(3);
});

it("enabled abilities can change a modern coach's training decision without overwhelming talent", () => {
  const base = team();
  const teams = createLeague({
    ...createRun("free", true, 22),
    roster: base.roster,
    coach: base.coach,
  });
  const changed = teams.some((t) => {
    const active = coachTrainingPlans(t),
      disabled = coachTrainingPlans({ ...t, abilityVersion: undefined });
    return Object.keys(active).some(
      (id) => active[Number(id)].plan.focus !== disabled[Number(id)].plan.focus,
    );
  });
  expect(changed).toBe(true);
});

it("updates modern training when developed skills change", () => {
  const t = { ...team(), coach: { version: 1 as const, id: "clemont" } },
    ids = Object.values(t.roster) as number[];
  const altered = (selected: number[], amount: number): LeagueTeam => ({
    ...t,
    development: Object.fromEntries(
      selected.map((id) => [
        id,
        { threePoint: amount, midRange: amount, freeThrow: amount },
      ]),
    ),
  });
  const focuses = (club: LeagueTeam) =>
    Object.values(coachTrainingPlans(club)).map((p) => p.plan.focus);
  expect(focuses(altered(ids, -30))).not.toEqual(focuses(altered(ids, 30)));
  expect(
    ids.some(
      (id) =>
        coachTrainingPlans(altered([id], -30))[id].plan.focus !==
        coachTrainingPlans(altered([id], 30))[id].plan.focus,
    ),
  ).toBe(true);
});

import { coachRosterFit } from "./coachOffice";
import { getCoach } from "./trainerCoaches";
import { evaluateTeam } from "./teamEvaluation";
it("assesses coaching hires using the same roster value", () => {
  const t = team(),
    candidate = getCoach("brock")!;
  expect(coachRosterFit(t, candidate)).toBe(
    Math.round(
      evaluateTeam({ ...t, coach: { version: 1, id: candidate.id } }).score *
        10,
    ) / 10,
  );
});

it("skips the unused fallback coaching plan when shared rotation scoring is active", () => {
  const plan = vi.spyOn(sharedEvaluation, "evaluationGamePlan");
  try {
    const minutes = coachRotationMinutes(team());
    expect(Object.values(minutes).reduce((sum, n) => sum + n, 0)).toBe(240);
    expect(plan).not.toHaveBeenCalled();
  } finally {
    plan.mockRestore();
  }
});
