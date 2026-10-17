import { expect, it } from "vitest";
import { POKEMON, POKEMON_BY_ID } from "../data/pokemon";
import { autoFillBench, createRun } from "./draft";
import { createLeague } from "./league";
import { recommendRosterPicks } from "./draftAdvice";
import { createEvaluationContext, evaluatePlayer } from "./teamEvaluation";
import { nextRandom } from "./random";
import { emptyRoster, POSITIONS, ROSTER_SLOTS, type Roster } from "./types";
import * as local from "./localLeague";
const roster: Roster = {
  PG: 65,
  SG: 135,
  SF: 149,
  PF: 68,
  C: 143,
  B1: null,
  B2: null,
  B3: null,
};
const team = {
  roster,
  tactic: "balanced" as const,
  defense: "man" as const,
  coach: { version: 1 as const, id: "brock" },
  abilityVersion: 1 as const,
  evaluationVersion: 1 as const,
};
it("shows shared contextual scores and developed role fits in modern draft advice while preserving the legacy API", () => {
  const pool = [9, 25, 59, 121, 131].map((id) => POKEMON_BY_ID.get(id)!);
  const contextTeam = {
    ...team,
    development: { 25: { threePoint: 8, speed: 8 } },
  };
  const context = createEvaluationContext(contextTeam);
  const modern = recommendRosterPicks(pool, roster, "balanced", 5, contextTeam);
  for (const pick of modern) {
    const scored = evaluatePlayer(context, pick.pokemonId);
    expect(pick.score).toBeCloseTo(scored.score, 10);
    expect(pick.fit).toBe(scored.roleFit);
    expect(pick.reasons).toContain(scored.reasons[1]);
  }
  expect(modern.map((p) => p.score)).toEqual(
    modern.map((p) => p.score).sort((a, b) => b - a),
  );
  expect(
    recommendRosterPicks(pool, roster, "balanced", 5, {
      ...contextTeam,
      evaluationVersion: undefined,
    }),
  ).toEqual(recommendRosterPicks(pool, roster, "balanced", 5));
  const other = recommendRosterPicks(pool, roster, "balanced", 5, {
    ...contextTeam,
    coach: { version: 1, id: "ash" },
  });
  expect(other.map((p) => p.score)).not.toEqual(modern.map((p) => p.score));
});
it("assigns solo CPU trainers before the first shared draft evaluation", () => {
  for (const seedValue of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 22]) {
    const run = {
      ...createRun("free", true, seedValue),
      coach: { version: 1 as const, id: "misty" },
      roster: { ...roster, B1: 121, B2: 6, B3: 131 },
    };
    const teams = createLeague(run),
      order = teams.slice(1).map((t) => t.id);
    let seed = (run.seasonSeed ^ 0x78abc132) >>> 0;
    for (let i = order.length - 1; i > 0; i--) {
      const r = nextRandom(seed);
      seed = r.seed;
      const j = Math.floor(r.value * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const first = teams[order[0]],
      context = createEvaluationContext({ ...first, roster: emptyRoster() });
    const available = POKEMON.filter(
      (p) => !Object.values(run.roster).includes(p.id),
    );
    const ranked = available
      .map((mon) => ({ id: mon.id, ...evaluatePlayer(context, mon.id) }))
      .sort((a, b) => b.score - a.score || a.id - b.id);
    const pick = ranked[Math.floor(nextRandom(seed).value * 4)];
    expect(first.coach).toBeDefined();
    expect(first.roster[pick.role]).toBe(pick.id);
  }
});
it("uses the shared value for automatic bench fills with a fresh roster context on each pick", () => {
  let expected = { ...roster };
  for (const slot of ["B1", "B2", "B3"] as const) {
    const ctx = createEvaluationContext({ ...team, roster: expected });
    const pick = POKEMON.filter((p) => !Object.values(expected).includes(p.id))
      .map((p) => evaluatePlayer(ctx, p.id))
      .sort((a, b) => b.score - a.score || a.pokemonId - b.pokemonId)[0];
    expected = { ...expected, [slot]: pick.pokemonId };
  }
  const run = { ...createRun("free", true, 22), ...team };
  expect(autoFillBench(run).roster).toEqual(expected);
});
it("uses each local CPU's trainer and enabled rules when ranking its next pick", () => {
  let draft = local.createLocalLeague(
    [
      { name: "A", teamId: 0 },
      { name: "B", teamId: 1 },
    ],
    true,
    601,
    2,
    {
      mode: "full-pool",
      format: { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 1 },
      engineRules: {
        version: 1,
        abilities: false,
        adaptiveCoaching: true,
        familiarity: 0,
      },
    },
  );
  draft.coaching = draft.coaching.map((c) => ({
    ...c,
    coach: { version: 1, id: "brock" },
  }));
  for (let index = 0; index < 8; index++) {
    const turn = local.currentLocalTurn(draft)!;
    draft = {
      ...draft,
      picks: [
        ...draft.picks,
        {
          teamId: turn.teamId,
          pokemonId: index + 1,
          slot: ROSTER_SLOTS[Math.floor(index / 4)],
        },
      ],
    };
  }
  while (local.currentLocalTurn(draft)?.manager) {
    const t = local.currentLocalTurn(draft)!;
    const p = local
      .localLeaguePool(draft)
      .find((p) => !draft.picks.some((x) => x.pokemonId === p.id))!;
    const slot = ROSTER_SLOTS.find(
      (s) => !draft.picks.some((x) => x.teamId === t.teamId && x.slot === s),
    )!;
    draft = local.pickLocalPlayer(draft, p.id, slot);
  }
  const turn = local.currentLocalTurn(draft)!,
    club = local.localLeagueTeams(draft)[turn.teamId],
    ctx = createEvaluationContext(club);
  const vacant = POSITIONS.filter((p) => club.roster[p] === null);
  const ranked = local
    .localLeaguePool(draft)
    .filter((p) => !draft.picks.some((x) => x.pokemonId === p.id))
    .map(
      (p) =>
        vacant
          .map((role) => evaluatePlayer(ctx, p.id, role))
          .sort((a, b) => b.score - a.score)[0],
    )
    .sort((a, b) => b.score - a.score || a.pokemonId - b.pokemonId);
  const pick =
    ranked[
      Math.floor(
        nextRandom((draft.seed ^ Math.imul(turn.pick, 0x9e3779b9)) >>> 0)
          .value * 4,
      )
    ];
  const advanced = local.advanceLocalCpu(draft);
  expect(advanced.picks[draft.picks.length]).toEqual({
    teamId: turn.teamId,
    pokemonId: pick.pokemonId,
    slot: pick.role,
  });
});
