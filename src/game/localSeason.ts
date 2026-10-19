import {
  initialMasteryBanks,
  teamsWithMastery,
  snapshotMastery,
  recordMasteryGame,
  masteryMilestones,
} from "./abilityMastery";
import {
  initialMoraleBanks,
  recordMoraleGame,
  snapshotMorale,
  teamsWithMorale,
} from "./playerMorale";
import {
  initialChemistryBanks,
  recordChemistryGame,
  snapshotChemistry,
  teamsWithChemistry,
} from "./teammateChemistry";
import { recordScouting, scoutingForMatch } from "./opponentScouting";
import type { ScoutingMemory, MatchScouting } from "./typeTacticsTypes";
import { nextRandom } from "./random";
import { addBox, leagueHonors, leaguePlayers } from "./leagueStats";
import { simulateMatch } from "./match";
import { scheduleFlow } from "./gameFlow";
import {
  localLeagueRun,
  localLeagueTeams,
  localDraftSize,
  type LocalLeague,
} from "./localLeague";
import { localSeasonSeed, restoreLocalTeams } from "./localCareer";
import { simulateSeason, simulateSeasonAsync } from "./season";
import { validateLocalFormat, type LocalFormat } from "./localFormat";
import type {
  GameResult,
  LeagueFixture,
  LeagueGameSummary,
  LeagueTeam,
  SeasonResult,
  Standing,
} from "./types";

/** Paired home/away slates keep every format balanced, including partial round robins. */
export function localSchedule(
  format: LocalFormat,
  initialSeed: number,
): LeagueFixture[] {
  validateLocalFormat(format);
  let seed = initialSeed;
  const roll = () => {
    const r = nextRandom(seed);
    seed = r.seed;
    return r.value;
  };
  const ids = Array.from({ length: format.teamCount }, (_, i) => i);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(roll() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const rounds: [number, number][][] = [];
  for (let r = 0; r < format.teamCount - 1; r++) {
    rounds.push(
      Array.from({ length: format.teamCount / 2 }, (_, i) =>
        r % 2 ? [ids.at(-i - 1)!, ids[i]] : [ids[i], ids.at(-i - 1)!],
      ),
    );
    ids.splice(1, 0, ids.pop()!);
  }
  const slates: [number, number][][] = [];
  for (let pair = 0; pair < format.gamesPerTeam / 2; pair++) {
    const slate = rounds[pair % rounds.length];
    slates.push(
      slate,
      slate.map(([h, a]) => [a, h]),
    );
  }
  return slates.flatMap((pairs, round) =>
    pairs.map(([homeTeamId, awayTeamId]) => ({
      id: `l1-r${round + 1}-${homeTeamId}-${awayTeamId}`,
      round,
      homeTeamId,
      awayTeamId,
      seed: Math.floor(roll() * 0x100000000) >>> 0,
    })),
  );
}

export function localSeasonBuilder(
  teams: LeagueTeam[],
  format: LocalFormat,
  seed: number,
) {
  const inputs = structuredClone(teams),
    fixtures = localSchedule(format, seed),
    players = leaguePlayers(inputs);
  const flows =
    inputs[0].gameFlowVersion === 1 ? scheduleFlow(fixtures) : undefined;
  const chemistryBonds = initialChemistryBanks(inputs);
  const morale = initialMoraleBanks(inputs);
  const abilityMastery = initialMasteryBanks(inputs);
  const byPlayer = new Map(players.map((p) => [p.playerId, p]));
  const standings: Standing[] = inputs.map((t) => ({
    teamId: t.id,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    homeWins: 0,
    awayWins: 0,
    streak: 0,
    lastTen: 0,
  }));
  const history = inputs.map(() => [] as boolean[]),
    games: GameResult[] = [],
    summaries: LeagueGameSummary[] = [];
  const scouting: ScoutingMemory | undefined =
    inputs[0].typeTacticsVersion === 1 ? {} : undefined;
  function play(fixture: LeagueFixture) {
    const h = fixture.homeTeamId,
      a = fixture.awayTeamId;
    if (
      (chemistryBonds || abilityMastery) &&
      fixture.id !== fixtures[summaries.length]?.id
    )
      throw new Error(
        "Chemistry games must advance the schedule exactly once in order.",
      );
    const currentTeams = teamsWithMastery(
      teamsWithMorale(teamsWithChemistry(inputs, chemistryBonds), morale),
      abilityMastery,
    );
    const chemistry = snapshotChemistry(currentTeams[h], currentTeams[a]);
    const moraleSnapshot = snapshotMorale(currentTeams[h], currentTeams[a]);
    const mastery = snapshotMastery(currentTeams[h], currentTeams[a]);
    const context = scouting ? scoutingForMatch(scouting, h, a) : undefined;
    const flow = flows?.get(fixture.id);
    const match = simulateMatch(
      currentTeams[h],
      currentTeams[a],
      fixture.seed,
      {
        scouting: context,
        chemistry,
        morale: moraleSnapshot,
        mastery,
        flow,
      },
    );
    if (scouting)
      recordScouting(scouting, currentTeams[h], currentTeams[a], match);
    if (chemistryBonds)
      recordChemistryGame(
        chemistryBonds,
        currentTeams[h],
        currentTeams[a],
        match,
      );
    recordMoraleGame(morale, currentTeams[h], currentTeams[a], match);
    recordMasteryGame(abilityMastery, currentTeams[h], currentTeams[a], match);
    const milestones = masteryMilestones(
      currentTeams[h],
      currentTeams[a],
      match,
    );
    summaries.push({
      ...fixture,
      ...(chemistry ? { chemistry } : {}),
      ...(moraleSnapshot ? { morale: moraleSnapshot } : {}),
      ...(mastery ? { mastery } : {}),
      ...(milestones.length ? { masteryMilestones: milestones } : {}),
      ...(flow ? { flow } : {}),
      ...(context ? { scouting: context } : {}),
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      overtimePeriods: match.overtimePeriods,
    });
    for (const box of [...match.homeBox, ...match.awayBox])
      addBox(byPlayer.get(box.playerId)!, box, match.playerOfGameId);
    for (const [id, score, against, home] of [
      [h, match.homeScore, match.awayScore, true],
      [a, match.awayScore, match.homeScore, false],
    ] as const) {
      const row = standings[id],
        won = score > against;
      row.wins += Number(won);
      row.losses += Number(!won);
      row.pointsFor += score;
      row.pointsAgainst += against;
      row.homeWins += Number(home && won);
      row.awayWins += Number(!home && won);
      row.streak = won
        ? Math.max(0, row.streak) + 1
        : Math.min(0, row.streak) - 1;
      history[id].push(won);
      row.lastTen = history[id].slice(-10).filter(Boolean).length;
    }
    if (h === 0 || a === 0) {
      const home = h === 0,
        teamScore = home ? match.homeScore : match.awayScore,
        opponentScore = home ? match.awayScore : match.homeScore,
        winner = byPlayer.get(match.playerOfGameId)!;
      games.push({
        index: games.length,
        opponentId: home ? a : h,
        home,
        winProbability: 0.5,
        teamScore,
        opponentScore,
        won: teamScore > opponentScore,
        overtime: match.overtimePeriods > 0,
        overtimePeriods: match.overtimePeriods,
        possessions: match.possessions,
        playerOfGameId: winner.pokemonId,
        playerOfGameTeamId: winner.teamId,
        leagueGameId: fixture.id,
        boxScore: home ? match.homeBox : match.awayBox,
        opponentBoxScore: home ? match.awayBox : match.homeBox,
      });
    }
  }
  function finish(): SeasonResult {
    const honors = leagueHonors(
        players,
        standings,
        format.gamesPerTeam,
        (inputs[0].courtVersion ?? 0) >= 3
          ? { balanced: true, seed }
          : undefined,
      ),
      mvp = honors.awards.find((a) => a.id === "mvp");
    return {
      modelVersion: 6,
      games,
      wins: standings[0].wins,
      losses: standings[0].losses,
      mvpId: mvp?.pokemonId ?? 0,
      mvpTeamId: mvp?.teamId ?? 0,
      playerStats: players.filter((p) => p.teamId === 0),
      awards: honors.awards,
      league: {
        ...(scouting ? { scouting } : {}),
        format: { ...format },
        teams: inputs,
        ...(chemistryBonds
          ? { chemistryBonds: structuredClone(chemistryBonds) }
          : {}),
        ...(morale ? { morale: structuredClone(morale) } : {}),
        ...(abilityMastery
          ? { abilityMastery: structuredClone(abilityMastery) }
          : {}),
        games: summaries,
        players,
        standings,
        ...honors,
      },
    };
  }
  return { fixtures, play, finish };
}
/** The complete inputs used for this season, independent of UI/playoff state. */
export function currentLocalSeasonInputs(draft: LocalLeague) {
  if (draft.picks.length !== localDraftSize(draft))
    throw new Error("Finish drafting every club first.");
  const archived =
    draft.career?.phase === "offseason"
      ? draft.career.history.at(-1)
      : undefined;
  return {
    teams: archived
      ? restoreLocalTeams(archived.teams)
      : localLeagueTeams(draft),
    format: draft.options!.format,
    seed: localSeasonSeed(draft),
  };
}
function currentBuilder(draft: LocalLeague) {
  const { teams, format, seed } = currentLocalSeasonInputs(draft);
  return localSeasonBuilder(teams, format, seed);
}
export function simulateLocalSeason(draft: LocalLeague): SeasonResult {
  if (!draft.options) return simulateSeason(localLeagueRun(draft));
  const job = currentBuilder(draft);
  job.fixtures.forEach(job.play);
  return job.finish();
}
export async function simulateLocalSeasonAsync(
  draft: LocalLeague,
  onProgress: (completed: number, total: number) => void = () => {},
  signal?: AbortSignal,
): Promise<SeasonResult> {
  if (!draft.options)
    return simulateSeasonAsync(localLeagueRun(draft), onProgress, signal);
  signal?.throwIfAborted();
  return simulateLocalSeasonInputsAsync(
    currentLocalSeasonInputs(draft),
    onProgress,
    signal,
  );
}

/** Runs an owned input snapshot, including across asynchronous cache lookup. */
export async function simulateLocalSeasonInputsAsync(
  { teams, format, seed }: ReturnType<typeof currentLocalSeasonInputs>,
  onProgress: (completed: number, total: number) => void = () => {},
  signal?: AbortSignal,
): Promise<SeasonResult> {
  signal?.throwIfAborted();
  const job = localSeasonBuilder(teams, format, seed),
    batch = format.teamCount / 2;
  onProgress(0, job.fixtures.length);
  for (let i = 0; i < job.fixtures.length; i += batch) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    signal?.throwIfAborted();
    job.fixtures.slice(i, i + batch).forEach(job.play);
    onProgress(Math.min(i + batch, job.fixtures.length), job.fixtures.length);
  }
  signal?.throwIfAborted();
  return job.finish();
}
