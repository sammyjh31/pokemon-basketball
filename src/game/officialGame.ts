import type { ArcadeState } from "./arcade/types";
import { playerOfGame } from "./arcade/engine";
import { emptyBox } from "./boxscore";
import { COUNTING_KEYS } from "./leagueStats";
import {
  abilitiesEnabled,
  abilityTotal,
  validateAbilityActivations,
} from "./abilities";
import type { OfficialGame } from "./franchiseFeatures";
import {
  ROSTER_SLOTS,
  type LeagueBox,
  type LeagueFixture,
  type LeagueMatch,
  type LeagueTeam,
} from "./types";

const SCALE = 12;
const fail = (): never => {
  throw new Error(
    "Invalid official game: fixture, roster or statistical arithmetic does not match.",
  );
};
const integer = (value: unknown, min = 0, max = 1_000_000): value is number =>
  Number.isInteger(value) &&
  (value as number) >= min &&
  (value as number) <= max;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** Stored scores and courtScore are always home/away; arcade side zero is always the coach. */
export function officialGameFromArcade(
  state: ArcadeState,
  fixture: LeagueFixture,
  teams: LeagueTeam[],
): OfficialGame {
  if (
    !state.official ||
    (state.abilityVersion !== undefined && state.abilityVersion !== 1) ||
    (state.abilityVersion === 1) !==
      abilitiesEnabled(teams.find((team) => team.id === 0) ?? {}) ||
    state.officialSeed !== fixture.seed ||
    state.phase !== "final" ||
    state.clock !== 0 ||
    state.pendingHorn ||
    state.score[0] === state.score[1] ||
    state.period < 4 ||
    ![fixture.homeTeamId, fixture.awayTeamId].includes(0)
  )
    fail();
  const userHome = fixture.homeTeamId === 0;
  const sideOf = (teamId: number) => (teamId === 0 ? 0 : 1);
  const overtimePeriods = state.period - 4;
  const elapsed = 240 + overtimePeriods * 25;
  if (Math.abs(state.elapsed - elapsed) > 0.001 || state.players.length !== 16)
    fail();
  const boxFor = (teamId: number): LeagueBox[] => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return fail();
    const players = state.players.filter((p) => p.team === sideOf(teamId));
    if (
      players.length !== 8 ||
      new Set(players.map((p) => p.pokemonId)).size !== 8 ||
      Math.abs(players.reduce((n, p) => n + p.stats.seconds, 0) - elapsed * 5) >
        0.01
    )
      fail();
    // Largest remainder, in eighth-minute units, retains DNPs and exact team minutes.
    const units = ROSTER_SLOTS.map((slot) => {
      const p = players.find((p) => p.pokemonId === team.roster[slot]);
      if (
        !p ||
        !Number.isFinite(p.stats.seconds) ||
        p.stats.seconds < 0 ||
        p.stats.seconds > elapsed + 0.001
      )
        return fail();
      const exact = p.stats.seconds * 1.6;
      return {
        p,
        slot,
        exact,
        units: p.stats.seconds > 0 ? Math.max(1, Math.floor(exact + 1e-8)) : 0,
      };
    });
    let remaining =
      (240 + overtimePeriods * 25) * 8 - units.reduce((n, p) => n + p.units, 0);
    const priority = [...units]
      .filter((p) => p.p.stats.seconds > 0)
      .sort(
        (a, b) => b.exact - b.units - (a.exact - a.units) || a.p.id - b.p.id,
      );
    for (let i = 0; remaining > 0; i++, remaining--)
      priority[i % priority.length].units++;
    while (remaining < 0) {
      const donor = [...units]
        .filter((p) => p.units > 1)
        .sort(
          (a, b) => a.exact - a.units - (b.exact - b.units) || a.p.id - b.p.id,
        )[0];
      if (!donor) return fail();
      donor.units--;
      remaining++;
    }
    return units.map(({ p, slot, units: minutes }) => ({
      ...emptyBox(p.pokemonId, slot),
      ...(state.abilityVersion === 1
        ? {
            abilityActivations: validateAbilityActivations(
              p.stats.abilityActivations,
            ),
          }
        : p.stats.abilityActivations !== undefined
          ? fail()
          : {}),
      teamId,
      playerId: `${teamId}:${p.pokemonId}`,
      started: !slot.startsWith("B"),
      minutes: minutes / 8,
      points: p.stats.points * SCALE,
      offensiveRebounds: p.stats.offensiveRebounds * SCALE,
      defensiveRebounds: p.stats.defensiveRebounds * SCALE,
      assists: p.stats.assists * SCALE,
      steals: p.stats.steals * SCALE,
      blocks: p.stats.blocks * SCALE,
      turnovers: p.stats.turnovers * SCALE,
      fgm: p.stats.fgm * SCALE,
      fga: p.stats.fga * SCALE,
      threePM: p.stats.threePM * SCALE,
      threePA: p.stats.threePA * SCALE,
      fouls: 0,
      plusMinus: (p.stats.plusMinus ?? NaN) * SCALE,
      rimFgm: (p.stats.rimFgm ?? NaN) * SCALE,
      rimFga: (p.stats.rimFga ?? NaN) * SCALE,
      midFgm: (p.stats.midFgm ?? NaN) * SCALE,
      midFga: (p.stats.midFga ?? NaN) * SCALE,
    }));
  };
  const periods = Array.from({ length: state.period }, () => ({
    home: 0,
    away: 0,
  }));
  let period = 0,
    homeScore = 0,
    awayScore = 0,
    leadChanges = 0,
    leader = 0;
  const largestLead = { home: 0, away: 0 };
  for (const event of state.events) {
    if (event.kind === "period") period++;
    if (event.kind !== "score") continue;
    if (!periods[period]) fail();
    const home = event.team === (userHome ? 0 : 1),
      points = (event.value ?? 2) * SCALE;
    if (home) {
      periods[period].home += points;
      homeScore += points;
    } else {
      periods[period].away += points;
      awayScore += points;
    }
    const nextLeader = Math.sign(homeScore - awayScore);
    if (nextLeader && leader && nextLeader !== leader) leadChanges++;
    if (nextLeader) leader = nextLeader;
    largestLead.home = Math.max(largestLead.home, homeScore - awayScore);
    largestLead.away = Math.max(largestLead.away, awayScore - homeScore);
  }
  const winner = playerOfGame({
      ...state,
      players: state.players.filter((player) => player.stats.seconds > 0),
    }),
    winnerTeam =
      winner.team === 0
        ? 0
        : userHome
          ? fixture.awayTeamId
          : fixture.homeTeamId;
  const courtScore: [number, number] = userHome
    ? [...state.score]
    : [state.score[1], state.score[0]];
  const match: LeagueMatch = {
    homeScore: courtScore[0] * SCALE,
    awayScore: courtScore[1] * SCALE,
    homeBox: boxFor(fixture.homeTeamId),
    awayBox: boxFor(fixture.awayTeamId),
    overtimePeriods,
    possessions:
      (state.players.reduce(
        (n, p) =>
          n + p.stats.fga + p.stats.turnovers - p.stats.offensiveRebounds,
        0,
      ) *
        SCALE) /
      2,
    periods,
    leadChanges,
    largestLead,
    plays: {
      transition: { home: 0, away: 0 },
      pickRoll: { home: 0, away: 0 },
      isolation: { home: 0, away: 0 },
      post: { home: 0, away: 0 },
      spotUp: { home: 0, away: 0 },
    },
    playerOfGameId: `${winnerTeam}:${winner.pokemonId}`,
  };
  return validateOfficialGame(
    {
      fixtureId: fixture.id,
      courtScore,
      scale: SCALE,
      match,
      ...(state.abilityVersion === 1 ? { abilityVersion: 1 as const } : {}),
    },
    fixture,
    teams,
  );
}

/** Accept only complete authoritative boxes; never repair a damaged saved result. */
export function validateOfficialGame(
  value: unknown,
  fixture: LeagueFixture,
  teams: LeagueTeam[],
): OfficialGame {
  if (
    !record(value) ||
    value.fixtureId !== fixture.id ||
    value.scale !== SCALE ||
    (value.abilityVersion !== undefined && value.abilityVersion !== 1) ||
    (value.abilityVersion === 1) !==
      abilitiesEnabled(teams.find((team) => team.id === 0) ?? {}) ||
    ![fixture.homeTeamId, fixture.awayTeamId].includes(0) ||
    fixture.homeTeamId === fixture.awayTeamId ||
    !Array.isArray(value.courtScore) ||
    value.courtScore.length !== 2 ||
    !value.courtScore.every((n) => integer(n, 0, 100_000)) ||
    !record(value.match)
  )
    fail();
  const game = value as unknown as OfficialGame,
    match = game.match;
  if (
    !integer(match.overtimePeriods, 0, 100) ||
    !integer(match.homeScore) ||
    !integer(match.awayScore) ||
    match.homeScore === match.awayScore ||
    match.homeScore !== game.courtScore[0] * SCALE ||
    match.awayScore !== game.courtScore[1] * SCALE ||
    !integer(match.possessions) ||
    !integer(match.leadChanges)
  )
    fail();
  const totalMinutes = 240 + 25 * match.overtimePeriods,
    maxMinutes = 48 + 5 * match.overtimePeriods;
  for (const [boxes, teamId, score, against] of [
    [match.homeBox, fixture.homeTeamId, match.homeScore, match.awayScore],
    [match.awayBox, fixture.awayTeamId, match.awayScore, match.homeScore],
  ] as const) {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return fail();
    if (
      !Array.isArray(boxes) ||
      boxes.length !== 8 ||
      new Set(boxes.map((b) => b?.pokemonId)).size !== 8
    )
      fail();
    for (const [i, slot] of ROSTER_SLOTS.entries()) {
      const box = boxes[i];
      if (
        !record(box) ||
        box.pokemonId !== team.roster[slot] ||
        box.slot !== slot ||
        box.teamId !== teamId ||
        box.playerId !== `${teamId}:${team.roster[slot]}` ||
        box.started !== !slot.startsWith("B") ||
        typeof box.minutes !== "number" ||
        !integer(box.minutes * 8, 0, maxMinutes * 8)
      )
        fail();
      for (const key of COUNTING_KEYS)
        if (
          key !== "minutes" &&
          (!integer(box[key], key === "plusMinus" ? -1_000_000 : 0) ||
            box[key] % SCALE !== 0)
        )
          fail();
      if (game.abilityVersion === 1) {
        const activations = validateAbilityActivations(box.abilityActivations);
        if (
          activations.offense > box.fga / SCALE ||
          (box.minutes === 0 && abilityTotal(box) !== 0)
        )
          fail();
      } else if (box.abilityActivations !== undefined) fail();
      if (
        box.fouls ||
        box.ftm ||
        box.fta ||
        box.fgm > box.fga ||
        box.threePM > box.threePA ||
        box.rimFgm > box.rimFga ||
        box.midFgm > box.midFga ||
        box.rimFgm + box.midFgm + box.threePM !== box.fgm ||
        box.rimFga + box.midFga + box.threePA !== box.fga ||
        box.points !== 2 * box.fgm + box.threePM ||
        (box.minutes === 0 &&
          (box.started || COUNTING_KEYS.some((k) => box[k] !== 0)))
      )
        fail();
    }
    if (
      boxes.reduce((n, b) => n + b.minutes, 0) !== totalMinutes ||
      boxes.reduce((n, b) => n + b.points, 0) !== score ||
      boxes.reduce((n, b) => n + b.plusMinus, 0) !== 5 * (score - against)
    )
      fail();
  }
  if (game.abilityVersion === 1) {
    for (const [own, opposing] of [
      [match.homeBox, match.awayBox],
      [match.awayBox, match.homeBox],
    ]) {
      const ownAttempts = own.reduce(
        (total, box) => total + box.fga / SCALE,
        0,
      );
      const opposingAttempts = opposing.reduce(
        (total, box) => total + box.fga / SCALE,
        0,
      );
      if (
        own.some(
          (box) =>
            box.abilityActivations!.support > ownAttempts - box.fga / SCALE,
        ) ||
        own.reduce((total, box) => total + box.abilityActivations!.support, 0) >
          ownAttempts ||
        own.reduce((total, box) => total + box.abilityActivations!.defense, 0) >
          opposingAttempts
      )
        fail();
    }
  }
  if (
    ![...match.homeBox, ...match.awayBox].some(
      (b) => b.playerId === match.playerOfGameId && b.minutes > 0,
    )
  )
    fail();
  if (
    !Array.isArray(match.periods) ||
    match.periods.length !== 4 + match.overtimePeriods
  )
    fail();
  let home = 0,
    away = 0;
  for (const [i, p] of match.periods.entries()) {
    if (
      !record(p) ||
      !integer(p.home) ||
      !integer(p.away) ||
      p.home % SCALE ||
      p.away % SCALE
    )
      fail();
    home += p.home;
    away += p.away;
    if (i >= 3 && i < match.periods.length - 1 && home !== away) fail();
  }
  if (
    home !== match.homeScore ||
    away !== match.awayScore ||
    !record(match.largestLead) ||
    !integer(match.largestLead.home, 0, match.homeScore) ||
    !integer(match.largestLead.away, 0, match.awayScore) ||
    match.largestLead.home < Math.max(0, home - away) ||
    match.largestLead.away < Math.max(0, away - home) ||
    !record(match.plays)
  )
    fail();
  for (const key of [
    "transition",
    "pickRoll",
    "isolation",
    "post",
    "spotUp",
  ] as const)
    if (
      !record(match.plays[key]) ||
      match.plays[key].home !== 0 ||
      match.plays[key].away !== 0
    )
      fail();
  return structuredClone(game);
}
