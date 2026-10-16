import { describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { emptyRoster } from "./types";
import { recommendRosterPicks } from "./draftAdvice";
const pool = (...ids: number[]) => ids.map((id) => POKEMON_BY_ID.get(id)!);
describe("draft advice", () => {
  it("fills the actual vacant role and gives inspectable physical and roster reasons", () => {
    const roster = { ...emptyRoster(), PG: 65, SG: 135, SF: 6, PF: 68 };
    const picks = recommendRosterPicks(pool(143, 25, 65), roster, "interior");
    expect(picks[0].pokemonId).toBe(143);
    expect(picks[0].slot).toBe("C");
    expect(picks[0].reasons.join(" ")).toMatch(/C.*vacan/);
    expect(picks[0].physical).toContain("2.1 m");
    expect(picks[0].alternatives).not.toContain(143);
    expect(picks.some((p) => p.pokemonId === 65)).toBe(false);
    expect(picks.every((p) => Number.isFinite(p.score))).toBe(true);
  });
  it("returns bench advice when starters are filled and nothing for full rosters", () => {
    const roster = { ...emptyRoster(), PG: 65, SG: 135, SF: 6, PF: 68, C: 143 };
    const picks = recommendRosterPicks(pool(25, 59, 9), roster, "perimeter");
    expect(picks).toHaveLength(3);
    expect(picks.every((p) => p.slot === "B1")).toBe(true);
    expect(
      recommendRosterPicks(
        pool(94),
        { ...roster, B1: 25, B2: 59, B3: 9 },
        "balanced",
      ),
    ).toEqual([]);
    expect(recommendRosterPicks([], roster, "balanced")).toEqual([]);
  });
});
