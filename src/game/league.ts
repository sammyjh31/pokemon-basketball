import { createEvaluationContext, evaluatePlayer } from "./teamEvaluation";
import { assignLeagueCoaches } from "./trainerCoaches";
import { POKEMON } from "../data/pokemon";
import { OPPONENTS } from "../data/opponents";
import { nextRandom } from "./random";
import {
  attributes,
  bestPosition,
  positionRating,
  teamRatings,
} from "./ratings";
import { validRoster } from "./lineup";
import {
  DEFENSE_SCHEMES,
  POSITIONS,
  ROTATIONS,
  ROSTER_SLOTS,
  TACTICS,
  emptyRoster,
  type LeagueFixture,
  type LeagueTeam,
  type Position,
  type Run,
} from "./types";

export function createLeague(run: Run): LeagueTeam[] {
  if (
    !validRoster(run.roster, run.includeLegends) ||
    Object.values(run.roster).some((id) => id === null)
  )
    throw new Error("Draft eight distinct players first.");
  const taken = new Set(Object.values(run.roster));
  const pool = POKEMON.filter(
    (p) => !taken.has(p.id) && (run.includeLegends || !p.legendary),
  );
  if (pool.length < 232)
    throw new Error("The league needs at least 240 eligible Pokémon.");
  let seed = (run.seasonSeed ^ 0x78abc132) >>> 0;
  const roll = () => {
    const r = nextRandom(seed);
    seed = r.seed;
    return r.value;
  };
  let teams: LeagueTeam[] = [
    {
      id: 0,
      name: "Kanto Basketball Club",
      roster: { ...run.roster },
      tactic: run.tactic,
      rotation: run.rotation,
      defense: run.defense ?? "man",
      ratings: teamRatings(run.roster, run.tactic, run.rotation),
    },
    ...OPPONENTS.map((op, i) => ({
      id: op.id,
      name: op.name,
      roster: emptyRoster(),
      tactic: TACTICS[i % TACTICS.length],
      rotation: ROTATIONS[i % ROTATIONS.length],
      defense: DEFENSE_SCHEMES[i % DEFENSE_SCHEMES.length],
      ratings: teamRatings(emptyRoster()),
    })),
  ];
  // Modern recruiting uses the coach who will actually lead this club.
  // The historical path assigns trainers after drafting to preserve old seeds.
  if (run.evaluationVersion === 1) {
    teams = teams.map((team) => ({
      ...team,
      evaluationVersion: 1,
      ...(run.abilityVersion === 1 ? { abilityVersion: 1 as const } : {}),
      ...(run.physicalAbilityVersion === 1
        ? { physicalAbilityVersion: 1 as const }
        : {}),
    }));
    if (run.coach)
      teams = assignLeagueCoaches(
        teams,
        run.seasonSeed,
        new Map([[0, run.coach]]),
      );
  }
  const profiles = new Map(
    pool.map((mon) => [
      mon.id,
      {
        a: attributes(mon),
        best: bestPosition(mon),
        fits: Object.fromEntries(
          ["PG", "SG", "SF", "PF", "C"].map((pos) => [
            pos,
            positionRating(mon, pos as Position),
          ]),
        ),
      },
    ]),
  );
  const order = teams.slice(1);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(roll() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Snake rounds spread the strongest picks; team identities prefer different skills.
  ROSTER_SLOTS.forEach((slot, round) => {
    const drafting = round % 2 ? [...order].reverse() : order;
    for (const team of drafting) {
      const vacancies = POSITIONS.filter(
        (position) => team.roster[position] === null,
      );
      const context =
        team.evaluationVersion === 1
          ? createEvaluationContext(team)
          : undefined;
      const ranked = pool
        .map((mon) => {
          const profile = profiles.get(mon.id)!,
            a = profile.a,
            pos =
              round < 5
                ? vacancies.reduce(
                    (best, position) =>
                      profile.fits[position] > profile.fits[best]
                        ? position
                        : best,
                    vacancies[0],
                  )
                : profile.best;
          if (context)
            return {
              mon,
              pos,
              value: evaluatePlayer(context, mon.id, pos).score,
            };
          const style =
            team.tactic === "pace"
              ? (a.speed + a.stamina) / 2
              : team.tactic === "perimeter"
                ? a.threePoint
                : team.tactic === "interior"
                  ? (a.finishing + a.offensiveRebound) / 2
                  : team.tactic === "defense"
                    ? (a.perimeterDefense + a.interiorDefense) / 2
                    : a.composure;
          return { mon, pos, value: 0.85 * profile.fits[pos] + 0.15 * style };
        })
        .sort((a, b) => b.value - a.value || a.mon.id - b.mon.id);
      const pick = ranked[Math.floor(roll() * Math.min(4, ranked.length))];
      team.roster[round < 5 ? pick.pos : slot] = pick.mon.id;
      pool.splice(
        pool.findIndex((mon) => mon.id === pick.mon.id),
        1,
      );
    }
  });
  for (const team of teams) {
    team.ratings = teamRatings(team.roster, team.tactic, team.rotation);
    if (run.typeMatchupsVersion === 1) team.typeMatchupsVersion = 1;
    if (run.typeTacticsVersion === 1) team.typeTacticsVersion = 1;
    if (run.abilityVersion === 1) team.abilityVersion = 1;
    if (run.physicalAbilityVersion === 1) team.physicalAbilityVersion = 1;
    if (run.evaluationVersion === 1) team.evaluationVersion = 1;
    if (run.courtVersion === 1) team.courtVersion = 1;
    if (run.matchupVersion === 1) team.matchupVersion = 1;
    if (run.possessionVersion === 1) team.possessionVersion = 1;
  }
  return run.coach && run.evaluationVersion !== 1
    ? assignLeagueCoaches(teams, run.seasonSeed, new Map([[0, run.coach]]))
    : teams;
}

/** Double round robin (58 games), then 12 additional home-and-away pairings. */
export function leagueSchedule(seed: number): LeagueFixture[] {
  const teams = Array.from({ length: 30 }, (_, i) => i);
  const roll = () => {
    const r = nextRandom(seed);
    seed = r.seed;
    return r.value;
  };
  for (let i = 29; i > 0; i--) {
    const j = Math.floor(roll() * (i + 1));
    [teams[i], teams[j]] = [teams[j], teams[i]];
  }
  const rounds: [number, number][][] = [];
  for (let r = 0; r < 29; r++) {
    rounds.push(
      Array.from({ length: 15 }, (_, i) =>
        r % 2 === 0 ? [teams[i], teams[29 - i]] : [teams[29 - i], teams[i]],
      ),
    );
    teams.splice(1, 0, teams.pop()!);
  }
  const mirror = (round: [number, number][]) =>
    round.map(([h, a]) => [a, h] as [number, number]);
  const season = [
    ...rounds,
    ...rounds.map(mirror),
    ...rounds.slice(0, 12),
    ...rounds.slice(0, 12).map(mirror),
  ];
  return season.flatMap((pairs, round) =>
    pairs.map(([homeTeamId, awayTeamId]) => ({
      id: `r${round + 1}-${homeTeamId}-${awayTeamId}`,
      round,
      homeTeamId,
      awayTeamId,
      seed: Math.floor(roll() * 0x100000000) >>> 0,
    })),
  );
}
