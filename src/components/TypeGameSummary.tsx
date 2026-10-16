import { POKEMON_BY_ID } from "../data/pokemon";
import type { LeagueMatch, LeagueTeam } from "../game/types";
export function TypeGameSummary({
  match,
  home,
  away,
}: {
  match: LeagueMatch;
  home: LeagueTeam;
  away: LeagueTeam;
}) {
  if (!match.typeMatchups) return null;
  const rows = [
    [
      "Advantaged attacks",
      (s: "home" | "away") => match.typeMatchups![s].advantaged,
    ],
    [
      "Resisted attacks",
      (s: "home" | "away") => match.typeMatchups![s].resisted,
    ],
    ["Neutral attacks", (s: "home" | "away") => match.typeMatchups![s].neutral],
    [
      "Average shot chance change",
      (s: "home" | "away") => {
        const q = match.typeMatchups![s];
        if (!q.shotAttempts) return "—";
        const value = (q.shotChanceDelta / q.shotAttempts) * 100;
        return `${value >= 0 ? "+" : ""}${value.toFixed(1)} pp`;
      },
    ],
  ] as const;
  return (
    <section className="type-game-summary" aria-label="Type matchup report">
      <h4>Pokémon type interactions</h4>
      <div
        className="results-table-wrap"
        role="region"
        tabIndex={0}
        aria-label="Scrollable type interactions"
      >
        <table className="results-table">
          <caption className="sr-only">Pokémon type interactions</caption>
          <thead>
            <tr>
              <th scope="col">MATCHUP</th>
              <th scope="col">{away.name}</th>
              <th scope="col">{home.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, get]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{get("away")}</td>
                <td>{get("home")}</td>
              </tr>
            ))}
            {match.typeMatchups.home.counterSubstitutions !== undefined &&
              match.typeMatchups.away.counterSubstitutions !== undefined && (
                <tr>
                  <th scope="row">Substitutions improving type coverage</th>
                  <td>{match.typeMatchups.away.counterSubstitutions}</td>
                  <td>{match.typeMatchups.home.counterSubstitutions}</td>
                </tr>
              )}
            {match.typeTactics &&
              (
                [
                  ["Previous meetings scouted", "priorMeetings"],
                  ["Cross-match assignments", "crossMatches"],
                  ["Screens set", "screens"],
                  ["Screens switched / stayed", "coverage"],
                  ["Roller attacks", "rolls"],
                  ["Help rotations", "helpRotations"],
                  ["Passes out of help", "kickouts"],
                ] as const
              ).map(([label, key]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  {(["away", "home"] as const).map((side) => (
                    <td key={side}>
                      {key === "coverage"
                        ? `${match.typeTactics![side].switches} / ${match.typeTactics![side].stays}`
                        : match.typeTactics![side][key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {match.typeTactics && (
        <div className="type-coaching-notes">
          {(["away", "home"] as const).map((side) => {
            const report = match.typeTactics![side],
              team = side === "home" ? home : away;
            const threat = report.priorityThreatId
              ? POKEMON_BY_ID.get(report.priorityThreatId)
              : undefined;
            return (
              <div key={side}>
                <h5>{team.name} · Coaching adjustments</h5>
                {threat && <p>Scouted scoring priority: {threat.name}.</p>}
                <ul>
                  {report.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            );
          })}
          <p className="stat-legend">
            Cross-matches count assignments away from the corresponding
            offensive role when coverage is reassessed. Screens, rolls and
            passes out of help are offensive decisions; switches and help
            rotations are defensive decisions. Scouting uses only completed
            meetings, gives recent games more weight, and carries into each
            playoff series.
          </p>
        </div>
      )}
      <p className="stat-legend">
        Attacks use the chosen scorer’s type against the actual defender,
        including switches and zone assignments. Counts include turnovers, foul
        continuations and second chances. Shot chance change averages the type
        adjustment on non-foul attempts, before blocks; it is not points caused
        by typing. Defensive types also influence pressure and blocks.
        {match.typeMatchups.home.counterSubstitutions !== undefined &&
          " Counter substitutions count direct bench replacements with better attacking coverage and resistance in that court role, against the opposing five at that moment. Role rearrangements are excluded. Fatigue and role fit also influence these choices."}
      </p>
    </section>
  );
}
