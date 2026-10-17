import { applyMasterySnapshot } from "./abilityMastery";
import { applyMoraleSnapshot } from "./playerMorale";
import { addSharedMinutes, applyChemistrySnapshot } from "./teammateChemistry";
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
  if (fixture.chemistry)
    teams = teams.map((team) =>
      team.id === fixture.homeTeamId
        ? applyChemistrySnapshot(team, fixture.chemistry!.home)
        : team.id === fixture.awayTeamId
          ? applyChemistrySnapshot(team, fixture.chemistry!.away)
          : team,
    );
  if (fixture.morale)
    teams = teams.map((team) =>
      team.id === fixture.homeTeamId
        ? applyMoraleSnapshot(team, fixture.morale!.home)
        : team.id === fixture.awayTeamId
          ? applyMoraleSnapshot(team, fixture.morale!.away)
          : team,
    );
  if (fixture.mastery)
    teams = teams.map((team) =>
      team.id === fixture.homeTeamId
        ? applyMasterySnapshot(team, fixture.mastery!.home)
        : team.id === fixture.awayTeamId
          ? applyMasterySnapshot(team, fixture.mastery!.away)
          : team,
    );
  const opponent = teams.find(
    (t) =>
      t.id ===
      (fixture.homeTeamId === 0 ? fixture.awayTeamId : fixture.homeTeamId),
  )!;
  const state = createGame({
    official: true,
    ...(teams[0].abilityMasteryVersion === 1
      ? { abilityMasteryVersion: 1 as const }
      : {}),
    ...(abilitiesEnabled(teams[0]) ? { abilityVersion: 1 as const } : {}),
    ...(abilitiesEnabled(teams[0]) && teams[0].physicalAbilityVersion === 1
      ? { physicalAbilityVersion: 1 as const }
      : {}),
    ...(teams[0].chemistryVersion === 1
      ? { chemistryVersion: 1 as const }
      : {}),
    ...(teams[0].chemistryGrowthVersion === 1
      ? { chemistryGrowthVersion: 1 as const }
      : {}),
    ...(teams[0].personalityVersion === 1
      ? { personalityVersion: 1 as const }
      : {}),
    ...(teams[0].moraleVersion === 1 ? { moraleVersion: 1 as const } : {}),
    seed: fixture.seed,
    teams: [teams[0], opponent],
  });
  state.phase = "live";
  state.elapsed = 240 + 25 * overtime;
  state.players
    .filter((p) => p.active)
    .forEach((p) => (p.stats.seconds = state.elapsed));
  if (state.chemistryMinutes)
    for (const side of [0, 1] as const)
      addSharedMinutes(
        state.chemistryMinutes[side === 0 ? "home" : "away"],
        state.players
          .filter((player) => player.team === side && player.active)
          .map((player) => player.pokemonId),
        state.elapsed / 60,
      );
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
