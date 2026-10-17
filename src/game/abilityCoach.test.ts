import { describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { speciesAbility } from "./abilities";
import { coachGamePlan, coachRotationMinutes } from "./coachPolicy";
import { coachTrainingPlans, validateCoachTraining } from "./coachTraining";
import {
  DEVELOPMENT_SKILLS,
  type DevelopmentRatings,
} from "./developmentTypes";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { playerProfile } from "./playerProfile";
import { ROSTER_SLOTS, type LeagueTeam } from "./types";

const shooters = [12, 18, 22, 83, 107, 227, 279, 596];
const finishers = [67, 68, 217, 277, 307, 308, 533, 534];
const base = createLeague({
  ...createRun("free", true, 88),
  // These fixtures lock the original species-ability policy before shared valuation.
  evaluationVersion: undefined,
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
})[0];
function team(
  ids: number[],
  skills: DevelopmentRatings = {},
  coach = "oak",
): LeagueTeam {
  return {
    ...base,
    coach: { version: 1, id: coach },
    abilityVersion: 1,
    roster: Object.fromEntries(
      ROSTER_SLOTS.map((slot, i) => [slot, ids[i]]),
    ) as LeagueTeam["roster"],
    development: Object.fromEntries(
      ids.map((id) => {
        const a = playerProfile(POKEMON_BY_ID.get(id)!).attributes;
        return [
          id,
          Object.fromEntries(
            DEVELOPMENT_SKILLS.map((skill) => [
              skill,
              (skills[skill] ?? 65) - a[skill],
            ]),
          ),
        ];
      }),
    ),
  };
}
const legacy = (t: LeagueTeam): LeagueTeam => ({
  ...t,
  abilityVersion: undefined,
});

describe("ability-aware coaching", () => {
  it("changes a flexible coach's attack for a capable roster of range or rim abilities", () => {
    const range = team(shooters),
      rim = team(finishers);
    expect(coachGamePlan(legacy(range)).tactic).toBe("balanced");
    expect(coachGamePlan(legacy(rim)).tactic).toBe("balanced");
    expect(coachGamePlan(range).tactic).toBe("perimeter");
    expect(coachGamePlan(rim).tactic).toBe("interior");
    expect(coachGamePlan(range).reason).toContain("Compound Eyes");
    // A range label cannot make poor shooters into a perimeter roster.
    expect(
      coachGamePlan(team(shooters, { threePoint: 35, midRange: 35 })).tactic,
    ).not.toBe("perimeter");
    expect(coachGamePlan(team(shooters, {}, "ash")).tactic).toBe("pace");
  });

  it("counters credible opposing ability threats only when those rules are active", () => {
    const home = team(finishers),
      range = team(shooters),
      rim = team(finishers);
    expect(coachGamePlan(home, range).defense).toBe("switch");
    expect(coachGamePlan(home, rim).defense).toBe("zone");
    expect(
      coachGamePlan(home, team(finishers, { threePoint: 85 })).defense,
    ).toBe("switch");
    expect(coachGamePlan(home, legacy(range)).defense).toBe("man");
    expect(
      coachGamePlan(home, team(shooters, { threePoint: 35, midRange: 35 }))
        .defense,
    ).toBe("man");
    expect(coachGamePlan(legacy(home), range).defense).toBe("man");
  });

  it("gives effective ability fits more rotation time without exceeding the minute budget", () => {
    const t = team([12, 68, 65, 143, 18, 67, 279, 308], {}, "misty");
    const minutes = coachRotationMinutes(t),
      before = coachRotationMinutes(legacy(t));
    const shooterSlots = ["PG", "C", "B2"] as const;
    expect(shooterSlots.reduce((n, s) => n + minutes[s], 0)).toBeGreaterThan(
      shooterSlots.reduce((n, s) => n + before[s], 0),
    );
    expect(Object.values(minutes).reduce((a, b) => a + b, 0)).toBe(240);
    expect(Object.values(minutes).every((n) => n <= 40 && n > 0)).toBe(true);
  });

  it("uses ability synergy to select real individual training and preserves workload limits", () => {
    const t = team(shooters, {
      threePoint: 68,
      midRange: 68,
      ballHandling: 67,
    });
    const assignments = coachTrainingPlans(t),
      before = coachTrainingPlans(legacy(t));
    expect(
      Object.keys(assignments).some(
        (id) =>
          assignments[Number(id)].plan.focus !== before[Number(id)].plan.focus,
      ),
    ).toBe(true);
    expect(assignments[12].plan.focus).toBe("shooting");
    for (const [id, assignment] of Object.entries(assignments)) {
      expect(assignment.reasons.join(" ")).toContain(
        speciesAbility(Number(id)).name,
      );
      expect(validateCoachTraining(assignment, "oak")).toEqual(assignment);
    }
    const exhausted = team(shooters, { stamina: 30 }, "ash");
    expect(
      Object.values(coachTrainingPlans(exhausted)).every(
        (a) => a.plan.intensity === "steady",
      ),
    ).toBe(true);
    const capped = team(shooters, {
      threePoint: 100,
      midRange: 100,
      freeThrow: 100,
      passing: 35,
      ballHandling: 35,
      composure: 35,
    });
    expect(
      Object.values(coachTrainingPlans(capped)).every(
        (a) => a.plan.focus !== "shooting",
      ),
    ).toBe(true);
  });

  it("keeps disabled and historical coaching decisions identical and pure", () => {
    const t = team(shooters),
      opponent = team(finishers),
      before = JSON.stringify(t);
    const disabled: LeagueTeam = {
      ...t,
      engineRules: {
        version: 1,
        adaptiveCoaching: true,
        familiarity: 1,
        abilities: false,
      },
    };
    for (const decision of [
      coachGamePlan,
      coachRotationMinutes,
      coachTrainingPlans,
    ]) {
      expect(decision(disabled)).toEqual(decision(legacy(t)));
      expect(decision(t)).toEqual(decision(t));
    }
    expect(coachGamePlan(disabled, opponent)).toEqual(
      coachGamePlan(legacy(t), opponent),
    );
    expect(JSON.stringify(t)).toBe(before);
  });
});
