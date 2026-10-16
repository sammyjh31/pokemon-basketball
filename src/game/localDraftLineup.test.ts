import { describe, expect, it } from "vitest";
import {
  createLocalLeague,
  currentLocalTurn,
  localLeagueTeams,
  parseLocalLeague,
  pickLocalPlayer,
  updateLocalDraftLocks,
  swapLocalSlots,
} from "./localLeague";
import { LOCAL_DEFAULT_OPTIONS } from "./localFormat";
import { emptyRoster } from "./types";

function secondRound() {
  let draft = createLocalLeague(
    Array.from({ length: 8 }, (_, teamId) => ({
      name: `Friend ${teamId}`,
      teamId,
    })),
    false,
    42,
    2,
    LOCAL_DEFAULT_OPTIONS,
  );
  for (const id of [1, 2, 3, 4, 5, 6, 7, 95])
    draft = pickLocalPlayer(draft, id, "PG");
  return draft;
}
describe("confirming a pick with lineup moves", () => {
  it("saves team-specific locks, rejects moves through them, and allows them after unlocking", () => {
    const original = secondRound();
    const saved = JSON.stringify(original);
    const teamId = currentLocalTurn(original)!.teamId;
    const draft = updateLocalDraftLocks(original, ["PG"]);
    expect(draft.positionLocks).toEqual([
      { teamId, pokemonId: 95, slot: "PG" },
    ]);
    expect(parseLocalLeague(JSON.stringify(draft)).positionLocks).toEqual(
      draft.positionLocks,
    );
    expect(JSON.stringify(original)).toBe(saved);
    expect(() => updateLocalDraftLocks(draft, ["C"])).toThrow();
    const moving = { ...emptyRoster(), PG: 65, C: 95 };
    expect(() => pickLocalPlayer(draft, 65, "PG", moving)).toThrow(/lock/i);
    const next = pickLocalPlayer(draft, 65, "C", {
      ...emptyRoster(),
      PG: 95,
      C: 65,
    });
    const nextTeam = currentLocalTurn(next)!.teamId;
    const nextLocked = updateLocalDraftLocks(next, ["PG"]);
    expect(nextLocked.positionLocks).toHaveLength(2);
    expect(
      nextLocked.positionLocks!.filter((p) => p.teamId === teamId),
    ).toEqual(draft.positionLocks);
    expect(
      nextLocked.positionLocks!.find((p) => p.teamId === nextTeam)!.pokemonId,
    ).toBe(7);
    const unlocked = updateLocalDraftLocks(draft, []);
    expect(pickLocalPlayer(unlocked, 65, "PG", moving).picks.at(-1)!.slot).toBe(
      "PG",
    );
    // Manual team management outside search clears affected draft locks.
    const swapped = swapLocalSlots(draft, teamId, "PG", "C");
    expect(swapped.positionLocks ?? []).toEqual([]);
    expect(parseLocalLeague(JSON.stringify(swapped)).picks).toEqual(
      swapped.picks,
    );
  });

  it("rejects malformed, duplicate or stale saved locks while retaining old saves", () => {
    const draft = secondRound();
    const teamId = currentLocalTurn(draft)!.teamId;
    const lock = { teamId, pokemonId: 95, slot: "PG" };
    expect(
      parseLocalLeague(JSON.stringify(draft)).positionLocks,
    ).toBeUndefined();
    for (const positionLocks of [
      null,
      {},
      [lock, lock],
      [{ ...lock, slot: "C" }],
      [{ ...lock, pokemonId: 65 }],
      [{ ...lock, teamId: 99 }],
    ])
      expect(() =>
        parseLocalLeague(JSON.stringify({ ...draft, positionLocks })),
      ).toThrow();
  });
  it("atomically applies only this friend's proposed lineup and survives save/reload", () => {
    const draft = secondRound(),
      saved = JSON.stringify(draft);
    const teamId = currentLocalTurn(draft)!.teamId;
    const lineup = { ...emptyRoster(), PG: 65, C: 95 };
    const next = pickLocalPlayer(draft, 65, "PG", lineup);
    expect(localLeagueTeams(next)[teamId].roster).toEqual(lineup);
    expect(next.picks.filter((p) => p.teamId !== teamId)).toEqual(
      draft.picks.filter((p) => p.teamId !== teamId),
    );
    expect(parseLocalLeague(JSON.stringify(next)).picks).toEqual(next.picks);
    expect(JSON.stringify(draft)).toBe(saved);
  });
  it("rejects dropped teammates, duplicates, foreign players, incorrect destinations and unknown slots", () => {
    const draft = secondRound();
    for (const lineup of [
      { ...emptyRoster(), PG: 65 },
      { ...emptyRoster(), PG: 65, C: 95, B1: 95 },
      { ...emptyRoster(), PG: 65, C: 1 },
      { ...emptyRoster(), C: 65, B1: 95 },
      { ...emptyRoster(), PG: 65, C: 95, extra: null },
    ])
      expect(() => pickLocalPlayer(draft, 65, "PG", lineup)).toThrow();
  });
});
