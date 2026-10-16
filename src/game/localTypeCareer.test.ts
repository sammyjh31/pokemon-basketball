import { describe, it, expect } from "vitest";
import {
  createLocalLeague,
  advanceLocalCpu,
  currentLocalTurn,
  pickLocalPlayer,
  localLeaguePool,
  parseLocalLeague,
} from "./localLeague";
import {
  beginLocalOffseason,
  localSeasonSeed,
  replayLocalHistory,
  startNextLocalSeason,
} from "./localCareer";
import { simulateLocalSeason } from "./localSeason";
import { simulatePlayoffs, playoffGameCount } from "./playoffs";
import { ROSTER_SLOTS } from "./types";

describe("local depth and type rules together", () => {
  for (const typed of [false, true])
    it(`preserves ${typed ? "typed" : "untyped"} frozen career rules through reload and year two`, () => {
      let draft = createLocalLeague(
        [
          { name: "Sam", teamId: 0 },
          { name: "Alex", teamId: 1 },
        ],
        true,
        42,
        2,
        {
          mode: "full-pool",
          format: {
            teamCount: 4,
            gamesPerTeam: 14,
            playoffTeams: 4,
            bestOf: 1,
          },
          engineRules: {
            version: 1,
            abilities: true,
            adaptiveCoaching: true,
            familiarity: 0,
          },
        },
      );
      if (!typed) delete draft.typeMatchupsVersion;
      if (!typed) delete draft.matchupVersion;
      if (!typed) delete draft.typeTacticsVersion;
      draft = advanceLocalCpu(draft);
      while (currentLocalTurn(draft)) {
        const turn = currentLocalTurn(draft)!;
        const mon = localLeaguePool(draft).find(
          (p) => !draft.picks.some((pick) => pick.pokemonId === p.id),
        )!;
        const slot = ROSTER_SLOTS.find(
          (slot) =>
            !draft.picks.some(
              (pick) => pick.teamId === turn.teamId && pick.slot === slot,
            ),
        )!;
        draft = advanceLocalCpu(pickLocalPlayer(draft, mon.id, slot));
      }
      const result = simulateLocalSeason(draft),
        playoffs = simulatePlayoffs(result.league!, localSeasonSeed(draft));
      draft = beginLocalOffseason(
        { ...draft, completed: true, playoffGames: playoffGameCount(playoffs) },
        result,
        playoffs,
      );
      const restored = parseLocalLeague(JSON.stringify(draft));
      expect(
        restored.career!.teams.every(
          (t) => t.typeMatchupsVersion === (typed ? 1 : undefined),
        ),
      ).toBe(true);
      expect(replayLocalHistory(restored, 1).result).toEqual(result);
      expect(
        simulateLocalSeason(
          parseLocalLeague(JSON.stringify(startNextLocalSeason(restored))),
        ).league!.teams.every(
          (t) => t.typeMatchupsVersion === (typed ? 1 : undefined),
        ),
      ).toBe(true);
      const broken = structuredClone(draft);
      broken.career!.teams[0].typeMatchupsVersion = typed ? undefined : 1;
      expect(() => parseLocalLeague(JSON.stringify(broken))).toThrow();
    });
});
