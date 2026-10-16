import { POKEMON_BY_ID } from "../data/pokemon";
import type { PossessionInsights } from "../game/possessionTypes";
const rate = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1) : "—");
export function PossessionInsightsPanel({
  detail,
  teams,
}: {
  detail?: PossessionInsights;
  teams: { id: number; name: string }[];
}) {
  const teamName = (id: number) =>
    teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
  if (!detail?.teams.length)
    return (
      <p className="insight-note">
        Possession and creation events were not recorded for these games. Older
        rules and manually played games may lack this detail; no estimates are
        added.
      </p>
    );
  return (
    <section className="insight-section" aria-label="Possession impact">
      <h4>Possession impact</h4>
      <p>
        Every extra chance has a cost. Interior teams send more players to the
        glass; pace and defensive lineups keep more players back. Rebound
        location, box-outs, fatigue and outlet passing shape the next attack.
      </p>
      <div
        className="results-table-wrap"
        role="region"
        tabIndex={0}
        aria-label="Scrollable possession scoring"
      >
        <table className="results-table">
          <caption className="sr-only">Possession scoring</caption>
          <thead>
            <tr>
              {[
                "TEAM",
                "GAMES",
                "POSS",
                "PTS/100",
                "BREAKS",
                "FAST-BREAK PTS",
                "2ND-CHANCE PTS",
                "OFF TOV PTS",
                "PAINT PTS",
                "CLUTCH POSS",
                "CLUTCH PTS",
              ].map((k) => (
                <th scope="col" key={k}>
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.teams.map((r) => (
              <tr key={r.teamId}>
                <th scope="row">{teamName(r.teamId)}</th>
                <td>{r.games}</td>
                <td>{r.possessions}</td>
                <td>{rate(r.points, r.possessions)}</td>
                <td>{r.transitionPossessions}</td>
                <td>{r.transitionPoints}</td>
                <td>{r.secondChancePoints}</td>
                <td>{r.pointsOffTurnovers}</td>
                <td>{r.paintPoints}</td>
                <td>{r.clutchPossessions}</td>
                <td>{r.clutchPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="insight-note">
        Points include free throws except paint points, which count rim field
        goals. Second-chance points follow an offensive rebound; points off
        turnovers belong to the next possession. These categories overlap.
        Clutch means a possession starts within five points in the last five
        minutes of the fourth quarter or overtime.
      </p>
      <h4>Shot creation and rebounding</h4>
      <div
        className="results-table-wrap"
        role="region"
        tabIndex={0}
        aria-label="Scrollable creation and rebounding"
      >
        <table className="results-table">
          <caption className="sr-only">Shot creation and rebounding</caption>
          <thead>
            <tr>
              {[
                "PLAYER",
                "GAMES",
                "POT AST",
                "AST",
                "AST PTS",
                "EXP AST PTS",
                "SCREEN AST",
                "REB CHANCES",
                "BOX-OUTS",
                "OREB",
                "DREB",
              ].map((k) => (
                <th scope="col" key={k}>
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...detail.players]
              .sort(
                (a, b) =>
                  b.assistPoints - a.assistPoints ||
                  b.reboundChances - a.reboundChances,
              )
              .map((r) => (
                <tr key={r.playerId}>
                  <th scope="row">
                    {POKEMON_BY_ID.get(Number(r.playerId.split(":").at(-1)))
                      ?.name ?? r.playerId}
                    <small>{teamName(r.teamId)}</small>
                  </th>
                  <td>{r.games}</td>
                  <td>{r.potentialAssists}</td>
                  <td>{r.assists}</td>
                  <td>{r.assistPoints}</td>
                  <td>{r.expectedAssistPoints.toFixed(1)}</td>
                  <td>{r.screenAssists}</td>
                  <td>{r.reboundChances}</td>
                  <td>{r.boxOuts}</td>
                  <td>{r.offensiveRebounds}</td>
                  <td>{r.defensiveRebounds}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="insight-note">
        A potential assist is a pass that creates an official field-goal
        attempt, including misses and blocks. AST PTS counts made field-goal
        points from those passes; EXP AST PTS uses their model chances. Screen
        assists count a teammate's basket following the screener's pick-and-roll
        action. Rebound chances count active pursuit; box-outs count successful
        seals even when a teammate collects the ball. Player games count
        appearances; all figures are totals from recorded games.
      </p>
    </section>
  );
}
