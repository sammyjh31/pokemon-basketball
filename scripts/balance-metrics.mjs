/** Season-level balance evidence: stat leaders, size correlations, margins and
 * multi-season development spread for one court engine version.
 * Reproduce: node scripts/balance-metrics.mjs --court=3 --legends=true --seasons=8 */
import { createServer } from "vite";
const arg = (name, fallback) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.split("=")[1] ??
  fallback;
const court = Number(arg("court", "3"));
const legends = arg("legends", "false") === "true";
const seasons = Number(arg("seasons", 1));
const seed = Number(arg("seed", 9824));
const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: "custom",
  logLevel: "error",
});
const r = (x, d = 1) => Number(x.toFixed(d));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const corr = (xs, ys) => {
  const mx = mean(xs),
    my = mean(ys);
  let n = 0,
    dx = 0,
    dy = 0;
  for (let i = 0; i < xs.length; i++) {
    n += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return n / Math.sqrt(dx * dy);
};
try {
  const load = (p) => server.ssrLoadModule(p);
  const { createRun } = await load("/src/game/draft.ts"),
    { createLeague } = await load("/src/game/league.ts"),
    { simulateSeason } = await load("/src/game/season.ts"),
    { developPlayer } = await load("/src/game/development.ts"),
    { positionRating, teamRatings } = await load("/src/game/ratings.ts"),
    { POKEMON_BY_ID } = await load("/src/data/pokemon.ts"),
    { POSITIONS, ROSTER_SLOTS } = await load("/src/game/types.ts"),
    { DEVELOPMENT_SKILLS } = await load("/src/game/developmentTypes.ts");
  const base = createRun("free", legends, seed);
  // A fixed ordinary user roster; with legends on, the CPU draft spreads them.
  const roster = {
    PG: 65,
    SG: 135,
    SF: 149,
    PF: 68,
    C: 143,
    B1: 121,
    B2: 6,
    B3: 131,
  };
  let teams = createLeague({ ...base, roster }).map((t) => ({
    ...t,
    courtVersion: court,
    development: Object.fromEntries(ROSTER_SLOTS.map((s) => [t.roster[s], {}])),
  }));
  const best = (id, dev) =>
    Math.max(
      ...POSITIONS.map((p) => positionRating(POKEMON_BY_ID.get(id), p, dev)),
    );
  const ratingSd = () =>
    sd(
      teams.flatMap((t) =>
        ROSTER_SLOTS.map((s) => best(t.roster[s], t.development[t.roster[s]])),
      ),
    );
  const out = { courtVersion: court, legends, seasons: [] };
  const initialSd = ratingSd();
  const drift = { starters: [], mid: [], deep: [] };
  for (let year = 1; year <= seasons; year++) {
    const seasonSeed = (seed * 7919 + year * 104729) >>> 0;
    const run = {
      ...base,
      roster: teams[0].roster,
      seasonSeed,
      leagueTeams: teams,
    };
    const result = simulateSeason(run);
    const league = result.league;
    const players = league.players.filter((p) => p.gamesPlayed > 0);
    const perGame = (p, k) => p[k] / p.gamesPlayed;
    const rpg = (p) =>
      (p.offensiveRebounds + p.defensiveRebounds) / p.gamesPlayed;
    const qualified = players.filter((p) => p.gamesPlayed >= 58);
    const height = (p) => POKEMON_BY_ID.get(p.pokemonId).heightM;
    const name = (p) => POKEMON_BY_ID.get(p.pokemonId).name;
    const top = (score, n = 5) =>
      [...qualified]
        .sort((a, b) => score(b) - score(a))
        .slice(0, n)
        .map((p) => `${name(p)} ${r(score(p))}`);
    let margin = 0,
      blowouts = 0,
      ot = 0,
      close = 0;
    for (const g of league.games) {
      const d = Math.abs(g.homeScore - g.awayScore);
      margin += d;
      blowouts += Number(d >= 20);
      close += Number(d <= 5);
      ot += Number(g.overtimePeriods > 0);
    }
    const wins = league.standings.map((s) => s.wins);
    const teamGames = league.games.length * 2;
    const sum = (k) => league.players.reduce((n, p) => n + p[k], 0);
    const row = {
      year,
      ratingSdBefore: r(ratingSd(), 2),
      topRebounders: top(rpg),
      topScorers: top((p) => perGame(p, "points")),
      mvp: league.awards.find((a) => a.id === "mvp")?.value,
      mvpName: name(
        players.find(
          (p) =>
            p.playerId === league.awards.find((a) => a.id === "mvp")?.playerId,
        ) ?? players[0],
      ),
      dpoy: name(
        players.find(
          (p) =>
            p.playerId ===
            league.awards.find((a) => a.id === "defense")?.playerId,
        ) ?? players[0],
      ),
      heightRebCorr: r(corr(qualified.map(height), qualified.map(rpg)), 2),
      heightPtsCorr: r(
        corr(
          qualified.map(height),
          qualified.map((p) => perGame(p, "points")),
        ),
        2,
      ),
      avgMargin: r(margin / league.games.length),
      blowout20Pct: r(blowouts / league.games.length, 3),
      within5Pct: r(close / league.games.length, 3),
      overtimePct: r(ot / league.games.length, 3),
      winsSd: r(sd(wins)),
      reboundsPerTeam: r(
        (sum("offensiveRebounds") + sum("defensiveRebounds")) / teamGames,
      ),
      pointsPerTeam: r(sum("points") / teamGames),
      topMinutes: top((p) => perGame(p, "minutes"), 3),
      bestRecord: Math.max(...wins),
      worstRecord: Math.min(...wins),
    };
    out.seasons.push(row);
    if (year === seasons) break;
    // Develop every player exactly as the franchise offseason does.
    const changes = new Map();
    for (const p of league.players) {
      const team = teams[p.teamId];
      const before = best(p.pokemonId, team.development[p.pokemonId]);
      const change = developPlayer(
        p,
        team.development[p.pokemonId] ?? {},
        year,
        seasonSeed,
        undefined,
        court === 3,
      );
      const next = { ...(team.development[p.pokemonId] ?? {}) };
      for (const s of DEVELOPMENT_SKILLS) {
        const v = (next[s] ?? 0) + (change.changes[s] ?? 0);
        if (v) next[s] = v;
        else delete next[s];
      }
      changes.set(p.pokemonId, next);
      const delta = best(p.pokemonId, next) - before;
      const mpg = p.minutes / Math.max(1, p.gamesPlayed);
      (mpg >= 28 ? drift.starters : mpg >= 15 ? drift.mid : drift.deep).push(
        delta,
      );
    }
    teams = teams.map((t) => {
      const development = Object.fromEntries(
        ROSTER_SLOTS.map((s) => [t.roster[s], changes.get(t.roster[s])]),
      );
      return {
        ...t,
        development,
        ratings: teamRatings(t.roster, t.tactic, t.rotation, development),
      };
    });
  }
  out.ratingSd = { initial: r(initialSd, 2), final: r(ratingSd(), 2) };
  out.largestOffsets = teams
    .flatMap((t) =>
      ROSTER_SLOTS.map((s) => {
        const id = t.roster[s],
          dev = t.development[id] ?? {};
        return {
          name: POKEMON_BY_ID.get(id).name,
          gain: r(best(id, dev) - best(id, {})),
          dev,
        };
      }),
    )
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3);
  out.meanAnnualDelta = {
    starters28: r(mean(drift.starters), 2),
    mid15to28: r(mean(drift.mid), 2),
    deepUnder15: r(mean(drift.deep), 2),
  };
  out.cumulativeDelta = Object.fromEntries(
    Object.entries(out.meanAnnualDelta).map(([k, v]) => [
      k,
      r(v * (seasons - 1), 1),
    ]),
  );
  console.log(JSON.stringify(out, null, 1));
} finally {
  await server.close();
}
