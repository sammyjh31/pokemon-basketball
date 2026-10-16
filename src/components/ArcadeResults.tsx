import { emptyStats } from "../game/arcade/setup";
import type {
  ArcadePlayer,
  ArcadeState,
  ArcadeStats,
} from "../game/arcade/types";
import { ArcadePortrait } from "./ArcadeSetup";
const minutes = (seconds: number) =>
  `${Math.floor(Math.round(seconds) / 60)}:${String(Math.round(seconds) % 60).padStart(2, "0")}`;
function StatCells({ stats: s }: { stats: ArcadeStats }) {
  return (
    <>
      <td>{minutes(s.seconds)}</td>
      <td className="arcade-points">{s.points}</td>
      <td>
        {s.fgm}–{s.fga}
      </td>
      <td>
        {s.fgm - s.threePM}–{s.fga - s.threePA}
      </td>
      <td>
        {s.threePM}–{s.threePA}
      </td>
      <td>{s.offensiveRebounds}</td>
      <td>{s.defensiveRebounds}</td>
      <td>{s.offensiveRebounds + s.defensiveRebounds}</td>
      <td>{s.assists}</td>
      <td>{s.steals}</td>
      <td>{s.blocks}</td>
      <td>{s.turnovers}</td>
    </>
  );
}
export function ArcadeResults({
  state,
  mvp,
  onRematch,
  onChangeOpponent,
  onExit,
}: {
  state: ArcadeState;
  mvp: ArcadePlayer;
  onRematch: () => void;
  onChangeOpponent: () => void;
  onExit: () => void;
}) {
  const winner = state.score[0] > state.score[1] ? 0 : 1;
  return (
    <div className="arcade-results">
      <div className="arcade-topline">
        <span className="arcade-wordmark">
          POKÉMON <b>HOOPS</b>
        </span>
        <span className="arcade-tag">EXHIBITION FINAL</span>
      </div>
      <header className="arcade-final-heading">
        <p className="arcade-eyebrow">
          {state.period > 4 ? `FINAL / ${state.period - 4} OT` : "FINAL BUZZER"}
        </p>
        <h1>{winner === 0 ? "THAT’S YOUR GAME." : "RUN IT BACK."}</h1>
        <p>{state.names[winner]} win the exhibition.</p>
        <div className="arcade-final-score">
          <div>
            <span>{state.names[0]}</span>
            <strong>{state.score[0]}</strong>
          </div>
          <span>—</span>
          <div>
            <span>{state.names[1]}</span>
            <strong>{state.score[1]}</strong>
          </div>
        </div>
      </header>
      <section className="arcade-mvp">
        <ArcadePortrait id={mvp.pokemonId} />
        <div>
          <p className="arcade-eyebrow">
            PLAYER OF THE GAME / {state.names[mvp.team]}
          </p>
          <h2>{mvp.name}</h2>
          <p>
            {mvp.stats.points} PTS <span>·</span>{" "}
            {mvp.stats.offensiveRebounds + mvp.stats.defensiveRebounds} REB{" "}
            <span>·</span> {mvp.stats.assists} AST
          </p>
        </div>
      </section>
      <div className="arcade-result-actions">
        <button className="arcade-button arcade-primary" onClick={onRematch}>
          Rematch
        </button>
        <button className="arcade-button" onClick={onChangeOpponent}>
          Change opponent
        </button>
        <button className="arcade-button arcade-quiet" onClick={onExit}>
          Back to roster
        </button>
      </div>
      {[0, 1].map((side) => {
        const players = state.players.filter((player) => player.team === side),
          totals = emptyStats();
        for (const player of players)
          for (const key of Object.keys(totals) as (keyof ArcadeStats)[])
            totals[key] += player.stats[key];
        return (
          <section className="arcade-card arcade-box-card" key={side}>
            <div className="arcade-section-title">
              <h2>{state.names[side]}</h2>
              <span className="arcade-tag">{side === 0 ? "YOU" : "CPU"}</span>
            </div>
            <div
              className="arcade-table-scroll"
              role="region"
              aria-label={`${state.names[side]} scrollable box score`}
              tabIndex={0}
            >
              <table aria-label={`${state.names[side]} exhibition box score`}>
                <thead>
                  <tr>
                    {[
                      "Player",
                      "MIN",
                      "PTS",
                      "FG M–A",
                      "2P M–A",
                      "3P M–A",
                      "OR",
                      "DR",
                      "REB",
                      "AST",
                      "STL",
                      "BLK",
                      "TO",
                    ].map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player.id}>
                      <th scope="row">
                        <ArcadePortrait id={player.pokemonId} />
                        <span>
                          {player.name}
                          <small>{player.slot}</small>
                        </span>
                      </th>
                      <StatCells stats={player.stats} />
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Team totals</th>
                    <StatCells stats={totals} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        );
      })}
      <p className="arcade-session-note">
        This exhibition is separate from your season. Your roster, standings,
        and records are unchanged.
      </p>
    </div>
  );
}
