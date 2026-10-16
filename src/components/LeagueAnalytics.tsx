import { useMemo, useState } from "react";
import { teamAnalysis, boxComparison } from "../game/teamAnalytics";
import type { LeagueResult, LeagueMatch, LeagueTeam } from "../game/types";
import "../teamAnalytics.css";
const fmt = (n: number | null | undefined, suffix = "") =>
  n == null ? "—" : `${n.toFixed(1)}${suffix}`;
const metrics = [
  {
    key: "offensiveRating",
    label: "PTS / 100",
    suffix: "",
    help: "Points per 100 estimated possessions. Higher means more efficient scoring.",
  },
  {
    key: "efg",
    label: "eFG%",
    suffix: "%",
    help: "Effective field-goal percentage gives made threes 50% more credit than made twos.",
  },
  {
    key: "ts",
    label: "TS%",
    suffix: "%",
    help: "True shooting includes points from free throws, using a free-throw possession estimate.",
  },
  {
    key: "turnoverRate",
    label: "TOV%",
    suffix: "%",
    help: "Turnovers as a share of shooting and turnover opportunities. Lower is better.",
  },
  {
    key: "freeThrowRate",
    label: "FTA / 100 FGA",
    suffix: "",
    help: "Free-throw attempts per 100 field-goal attempts. Drawing fouls creates scoring chances.",
  },
  {
    key: "threeShare",
    label: "3PA SHARE",
    suffix: "%",
    help: "The share of field-goal attempts taken from three-point range.",
  },
  {
    key: "offensiveReboundsPerGame",
    label: "OREB / GAME",
    suffix: "",
    help: "Offensive rebounds create second chances. This is a count, not rebound percentage.",
  },
  {
    key: "benchPointsPerGame",
    label: "BENCH PPG",
    suffix: "",
    help: "Scoring from the three roster reserve slots. More minutes also create more opportunity.",
  },
] as const;

export function LeagueAnalytics({ league }: { league: LeagueResult }) {
  const rows = useMemo(() => teamAnalysis(league), [league]);
  const [selected, setSelected] = useState(league.teams[0]?.id ?? 0);
  const [sort, setSort] =
    useState<(typeof metrics)[number]["key"]>("offensiveRating");
  const team = rows.find((r) => r.team.id === selected) ?? rows[0];
  if (!team) return null;
  const ranked = [...rows].sort((a, b) =>
    sort === "turnoverRate"
      ? (a[sort] ?? Infinity) - (b[sort] ?? Infinity)
      : (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity),
  );
  return (
    <section className="team-analysis" aria-label="Team analysis">
      <div className="results-section-heading">
        <div>
          <h4>What drives your results?</h4>
          <p>
            Compare efficiency, possessions and shot selection across the
            league.
          </p>
        </div>
      </div>
      <div className="league-controls">
        <label className="league-field">
          Analyze team
          <select
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {league.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="analysis-cards">
        {metrics.map((m) => {
          const values = rows
              .map((r) => r[m.key])
              .filter((v): v is number => v !== null),
            average = values.length
              ? values.reduce((a, b) => a + b, 0) / values.length
              : null;
          return (
            <article key={m.key}>
              <span className="eyebrow">{m.label}</span>
              <strong>{fmt(team[m.key], m.suffix)}</strong>
              <small>League team average {fmt(average, m.suffix)}</small>
              <p>{m.help}</p>
            </article>
          );
        })}
      </div>
      <p className="stat-legend">
        {team.team.name}: {fmt(team.pointsPerGame)} points scored and{" "}
        {fmt(team.pointsAgainstPerGame)} allowed per game. Shot mix:{" "}
        {fmt(team.rimShare, "%")} rim · {fmt(team.midShare, "%")} midrange ·{" "}
        {fmt(team.threeShare, "%")} threes. Assists/turnover:{" "}
        {fmt(team.assistTurnover)}.
      </p>
      <label className="league-field">
        Rank teams by
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          {metrics.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <div
        className="results-table-wrap"
        role="region"
        tabIndex={0}
        aria-label="Scrollable team efficiency"
      >
        <table className="results-table">
          <caption className="sr-only">Team efficiency comparison</caption>
          <thead>
            <tr>
              <th scope="col">TEAM</th>
              <th scope="col">W</th>
              {metrics.map((m) => (
                <th scope="col" key={m.key} title={m.help}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr
                key={r.team.id}
                className={r.team.id === selected ? "league-user-team" : ""}
              >
                <th scope="row">{r.team.name}</th>
                <td>{r.wins}</td>
                {metrics.map((m) => (
                  <td key={m.key}>{fmt(r[m.key], m.suffix)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="analysis-guide">
        <summary>How to use these numbers</summary>
        <p>
          Low eFG%: compare shooting and shot selection. Space &amp; shoot seeks
          more threes; skilled passers and good spacing also help finishers.
          High TOV%: prioritize handling, passing and decision making against
          pressure. Few offensive rebounds: examine rebound ratings, size and
          the lineups on court. A shallow bench or low stamina can hurt
          late-game shooting.
        </p>
        <p>
          Pokémon base stats, types, height and weight already shape basketball
          ratings. Types give small skill adjustments; elemental type weaknesses
          do not directly multiply basketball damage. The matchup explorer shows
          how those skills and physical matchups affect a shot.
        </p>
        <p>
          Estimated possessions = FGA − OREB + TOV + 0.44 × FTA. TOV% = TOV /
          (FGA + 0.44 × FTA + TOV). TS% = PTS / [2 × (FGA + 0.44 × FTA)]. These
          are estimates, not counts of engine possessions. Season averages
          describe results; they do not prove one stat caused a win. Use
          individual game comparisons to see actual opposing rebound
          opportunities.
        </p>
      </details>
    </section>
  );
}

export function GameAnalytics({
  match,
  home,
  away,
}: {
  match: LeagueMatch;
  home: LeagueTeam;
  away: LeagueTeam;
}) {
  const comparison = boxComparison(match.homeBox, match.awayBox);
  const rows: [
    string,
    (side: typeof comparison.home) => number | null,
    string,
  ][] = [
    ["Effective FG%", (s) => s.efg, "%"],
    ["Turnover rate", (s) => s.turnoverRate, "%"],
    ["Offensive rebound share", (s) => s.offensiveReboundShare, "%"],
    ["FTA per 100 FGA", (s) => s.freeThrowRate, ""],
    ["True shooting", (s) => s.ts, "%"],
    ["Rim attempt share", (s) => s.rimShare, "%"],
    ["Midrange attempt share", (s) => s.midShare, "%"],
    ["Three-point attempt share", (s) => s.threeShare, "%"],
  ];
  return (
    <section className="game-analysis" aria-label="Game efficiency">
      <h3>Where the game was won</h3>
      <div
        className="results-table-wrap"
        role="region"
        tabIndex={0}
        aria-label="Scrollable game efficiency"
      >
        <table className="results-table">
          <caption className="sr-only">Game efficiency comparison</caption>
          <thead>
            <tr>
              <th scope="col">METRIC</th>
              <th scope="col">{away.name}</th>
              <th scope="col">{home.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, get, suffix]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{fmt(get(comparison.away), suffix)}</td>
                <td>{fmt(get(comparison.home), suffix)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {match.shotQuality && (
        <div className="analysis-cards">
          {(["away", "home"] as const).map((side) => {
            const q = match.shotQuality![side];
            return (
              <article key={side}>
                <span className="eyebrow">
                  {side === "home" ? home.name : away.name}
                </span>
                <strong>
                  {q.points} / {q.expectedPoints.toFixed(1)}
                </strong>
                <small>Actual / expected shot points</small>
                <p>
                  {q.attempts} non-foul attempts. Expected points sum the
                  model's make and block probabilities. Free throws and shots on
                  shooting fouls are excluded. Differences reflect finishing
                  variance, not a guarantee of future results.
                </p>
              </article>
            );
          })}
        </div>
      )}
      <p className="stat-legend">
        eFG% credits threes; lower turnover rate protects possessions; offensive
        rebound share uses this opponent's defensive rebounds. These describe
        opportunities and outcomes, not a complete explanation of causation.
      </p>
    </section>
  );
}
