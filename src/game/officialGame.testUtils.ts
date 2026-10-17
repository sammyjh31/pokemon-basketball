import { createRun } from "./draft";
import { createLeague, leagueSchedule } from "./league";
import { createGame } from "./arcade/setup";
import { emit } from "./arcade/events";
import { abilitiesEnabled } from "./abilities";
import { ROSTER_SLOTS, type LeagueFixture, type Run } from "./types";
export function officialFixture(away = false) {
  const run: Run = {
    ...createRun("free", true, 340),
    roster: Object.fromEntries(
      ROSTER_SLOTS.map((slot, i) => [
        slot,
        [65, 150, 149, 68, 143, 9, 94, 59][i],
      ]),
    ) as Run["roster"],
  };
  const teams = createLeague(run);
  const fixture = leagueSchedule(run.seasonSeed).find((f) =>
    away ? f.awayTeamId === 0 : f.homeTeamId === 0,
  )!;
  return { run: { ...run, leagueTeams: teams }, teams, fixture };
}
export function finishedGame(
  fixture: LeagueFixture,
  teams: ReturnType<typeof createLeague>,
  overtime = 0,
) {
  const opponent = teams.find(
    (t) =>
      t.id ===
      (fixture.homeTeamId === 0 ? fixture.awayTeamId : fixture.homeTeamId),
  )!;
  const state = createGame({
    official: true,
    ...(abilitiesEnabled(teams[0]) ? { abilityVersion: 1 as const } : {}),
    seed: fixture.seed,
    teams: [teams[0], opponent],
  });
  state.phase = "live";
  state.elapsed = 240 + 25 * overtime;
  state.players
    .filter((p) => p.active)
    .forEach((p) => (p.stats.seconds = state.elapsed));
  for (let period = 1; period <= 4 + overtime; period++) {
    emit(state, { kind: "shot", team: 0, player: 0, value: 2, zone: "rim" });
    emit(state, { kind: "score", team: 0, player: 0, value: 2, zone: "rim" });
    if (period < 4 + overtime) {
      emit(state, { kind: "shot", team: 1, player: 8, value: 2, zone: "mid" });
      emit(state, { kind: "score", team: 1, player: 8, value: 2, zone: "mid" });
    }
    emit(state, { kind: "period", team: 0, player: null, value: period });
  }
  state.period = 4 + overtime;
  state.clock = 0;
  state.phase = "final";
  return state;
}
