import { COACHES } from "./trainerCoaches";
import type { LeagueTeam, Standing, Run } from "./types";
import type { Playoffs } from "./playoffTypes";
import type { Franchise } from "./franchiseTypes";

export interface CoachSeriesRecord {
  round: number;
  opponentId: number;
  wins: number;
  losses: number;
  result: "won" | "lost" | "playing";
  finals: boolean;
}
export interface CoachSeasonRecord {
  year: number;
  teamId: number;
  coachId: string;
  wins: number;
  losses: number;
  playoffSeed: number | null;
  rounds: CoachSeriesRecord[];
  champion: boolean;
  complete: boolean;
  postseasonKnown: boolean;
}
export function captureCoachRecords(
  teams: Pick<LeagueTeam, "id" | "coach">[],
  standings: Standing[],
  playoffs: Playoffs | undefined,
  year: number,
): CoachSeasonRecord[] {
  const finalRound = Math.max(...(playoffs?.series.map((s) => s.round) ?? [3]));
  return teams.flatMap((team) => {
    if (!team.coach) return [];
    const row = standings.find((s) => s.teamId === team.id);
    if (!row) return [];
    const rounds: CoachSeriesRecord[] = (playoffs?.series ?? []).flatMap(
      (s) => {
        const high = s.higherSeedId === team.id;
        if (!high && s.lowerSeedId !== team.id) return [];
        const opponentId = high ? s.lowerSeedId : s.higherSeedId;
        if (opponentId === null) return [];
        return [
          {
            round: s.round,
            opponentId,
            wins: high ? s.higherSeedWins : s.lowerSeedWins,
            losses: high ? s.lowerSeedWins : s.higherSeedWins,
            result:
              s.winnerId === null
                ? "playing"
                : s.winnerId === team.id
                  ? "won"
                  : "lost",
            finals: s.round === finalRound,
          },
        ];
      },
    );
    return [
      {
        year,
        teamId: team.id,
        coachId: team.coach.id,
        wins: row.wins,
        losses: row.losses,
        playoffSeed:
          playoffs?.seeds.find((s) => s.teamId === team.id)?.seed ?? null,
        rounds,
        champion: playoffs?.championId === team.id,
        complete: playoffs?.championId != null,
        postseasonKnown: true,
      },
    ];
  });
}
export function franchiseCoachRecords(
  franchise: Franchise,
  run?: Run,
): CoachSeasonRecord[] {
  const records = franchise.history.flatMap((h) =>
    h.replay
      ? captureCoachRecords(
          h.replay.teams,
          h.standings,
          h.replay.playoffs,
          h.year,
        )
      : [],
  );
  const league = (run?.result ?? run?.seasonProgress?.result)?.league;
  if (
    franchise.phase === "season" &&
    league &&
    !franchise.history.some((h) => h.year === franchise.year)
  )
    records.push(
      ...captureCoachRecords(
        league.teams,
        league.standings,
        run?.playoffs,
        franchise.year,
      ),
    );
  return records;
}
export function coachCareers(records: CoachSeasonRecord[]) {
  return COACHES.map((coach) => {
    const seasons = records.filter((r) => r.coachId === coach.id);
    const sum = (fn: (r: CoachSeasonRecord) => number) =>
      seasons.reduce((n, r) => n + fn(r), 0);
    return {
      coach,
      seasons,
      wins: sum((r) => r.wins),
      losses: sum((r) => r.losses),
      playoffWins: sum((r) => r.rounds.reduce((n, s) => n + s.wins, 0)),
      playoffLosses: sum((r) => r.rounds.reduce((n, s) => n + s.losses, 0)),
      seriesWins: sum((r) => r.rounds.filter((s) => s.result === "won").length),
      seriesLosses: sum(
        (r) => r.rounds.filter((s) => s.result === "lost").length,
      ),
      playoffAppearances: sum((r) => Number(r.playoffSeed !== null)),
      finalsAppearances: sum((r) =>
        Number(r.rounds.some((s) => s.finals) || r.champion),
      ),
      championships: sum((r) => Number(r.champion)),
      missingPostseasons: sum((r) => Number(!r.postseasonKnown)),
    };
  });
}

/** Old local saves retain regular records and titles; do not invent missing series. */
export function localCoachRecords(
  career: import("./localCareer").LocalCareer | undefined,
  teams: LeagueTeam[],
  result?: import("./types").SeasonResult | null,
  playoffs?: Playoffs | null,
): CoachSeasonRecord[] {
  const records = (career?.history ?? []).flatMap(
    (h) =>
      h.coachRecords ??
      captureCoachRecords(h.teams, h.standings, undefined, h.year).map((r) => ({
        ...r,
        complete: true,
        champion: r.teamId === h.championId,
        postseasonKnown: false,
      })),
  );
  if (career?.phase !== "offseason" && result?.league)
    records.push(
      ...captureCoachRecords(
        teams,
        result.league.standings,
        playoffs ?? undefined,
        career?.year ?? 1,
      ),
    );
  return records;
}
export function validateCoachRecords(
  value: unknown,
  teams: Pick<LeagueTeam, "id" | "coach">[],
  standings: Standing[],
  year: number,
  championId: number,
  playoffTeams: number,
  bestOf: number,
  playoffGames: number,
  replayedSeeds?: readonly { teamId: number }[],
): CoachSeasonRecord[] {
  const fail = (): never => {
    throw new Error("Invalid saved coach season records.");
  };
  const coached = teams.filter((t) => t.coach);
  if (!Array.isArray(value) || value.length !== coached.length) return fail();
  // Modern local archives provide seeds reconstructed from their actual games.
  const seeds =
    replayedSeeds ??
    [...standings]
      .sort(
        (a, b) =>
          b.wins - a.wins ||
          b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst) ||
          a.teamId - b.teamId,
      )
      .slice(0, playoffTeams);
  const firstRound = 4 - Math.log2(playoffTeams),
    winsNeeded = Math.ceil(bestOf / 2);
  const rows: CoachSeasonRecord[] = value.map((r, i) => {
    const team = coached[i],
      standing = standings.find((s) => s.teamId === team.id)!;
    const seed = seeds.findIndex((s) => s.teamId === team.id) + 1;
    if (
      !r ||
      r.year !== year ||
      r.teamId !== team.id ||
      r.coachId !== team.coach!.id ||
      r.wins !== standing.wins ||
      r.losses !== standing.losses ||
      r.champion !== (championId === team.id) ||
      r.complete !== true ||
      r.postseasonKnown !== true ||
      r.playoffSeed !== (seed || null) ||
      !Array.isArray(r.rounds) ||
      r.rounds.length > 4 - firstRound ||
      Boolean(r.rounds.length) !== Boolean(seed)
    )
      return fail();
    const rounds: CoachSeriesRecord[] = r.rounds.map((s: any, j: number) => {
      if (
        !s ||
        s.round !== firstRound + j ||
        !Number.isInteger(s.opponentId) ||
        s.opponentId === team.id ||
        !seeds.some((t) => t.teamId === s.opponentId) ||
        !Number.isInteger(s.wins) ||
        !Number.isInteger(s.losses) ||
        s.wins < 0 ||
        s.losses < 0 ||
        !(
          (s.wins === winsNeeded && s.losses < winsNeeded) ||
          (s.losses === winsNeeded && s.wins < winsNeeded)
        ) ||
        s.result !== (s.wins === winsNeeded ? "won" : "lost") ||
        s.finals !== (s.round === 3) ||
        (j < r.rounds.length - 1 && s.result !== "won")
      )
        return fail();
      return {
        round: s.round,
        opponentId: s.opponentId,
        wins: s.wins,
        losses: s.losses,
        result: s.result,
        finals: s.finals,
      };
    });
    const last = rounds.at(-1);
    if (
      last &&
      (r.champion
        ? last.round !== 3 || last.result !== "won"
        : last.result !== "lost")
    )
      return fail();
    return {
      year,
      teamId: team.id,
      coachId: team.coach!.id,
      wins: r.wins,
      losses: r.losses,
      playoffSeed: seed || null,
      rounds,
      champion: r.champion,
      complete: true,
      postseasonKnown: true,
    };
  });
  if (rows.length) {
    if (
      rows.reduce(
        (n, r) => n + r.rounds.reduce((n, s) => n + s.wins + s.losses, 0),
        0,
      ) !==
      playoffGames * 2
    )
      return fail();
    for (let round = firstRound; round <= 3; round++)
      if (
        rows.flatMap((r) => r.rounds).filter((s) => s.round === round)
          .length !==
        2 ** (4 - round)
      )
        return fail();
    for (const r of rows)
      for (const s of r.rounds) {
        const mirror = rows
          .find((r) => r.teamId === s.opponentId)
          ?.rounds.find((other) => other.round === s.round);
        if (
          !mirror ||
          mirror.opponentId !== r.teamId ||
          mirror.wins !== s.losses ||
          mirror.losses !== s.wins
        )
          return fail();
      }
  }
  return rows;
}
