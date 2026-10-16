import { useMemo, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import { useLocalLeague } from "../hooks/useLocalLeague";
import {
  localLeagueTeams,
  localLeagueRun,
  pickLocalPlayer,
  rankLocalManagers,
  swapLocalSlots,
  updateLocalCoaching,
  type LocalLeague,
} from "../game/localLeague";
import {
  DEFENSE_LABELS,
  DEFENSE_SCHEMES,
  ROTATIONS,
  ROSTER_SLOTS,
  SLOT_NAMES,
  TACTICS,
  TACTIC_LABELS,
} from "../game/types";
import type { StorageLike } from "../game/persistence";
import { LocalLeagueSetup } from "./LocalLeagueSetup";
import { LocalLeagueDraft } from "./LocalLeagueDraft";
import { LeaguePanel } from "./LeaguePanel";
import { PlayoffPanel } from "./PlayoffPanel";
import { MatchupLab } from "./MatchupLab";
import { ConfirmDialog } from "./ConfirmDialog";
import { Portrait } from "./Portrait";
import { SpriteContext } from "./SpriteControls";
import "../localLeague.css";

function ReviewTeams({
  draft,
  change,
  disabled,
}: {
  draft: LocalLeague;
  change: (next: (draft: LocalLeague) => LocalLeague) => void;
  disabled: boolean;
}) {
  const [teamId, setTeamId] = useState(draft.managers[0].teamId);
  const teams = useMemo(() => localLeagueTeams(draft), [draft]);
  const team = teams[teamId];
  return (
    <section className="local-panel" aria-label="Review friends' teams">
      <div className="local-review-heading">
        <div>
          <span className="eyebrow">DRAFT COMPLETE</span>
          <h2>Set your lineup. Settle the debate.</h2>
          <p>
            Every friend can adjust their lineup and coaching before the season.
          </p>
        </div>
        <label>
          Review friend
          <select
            value={teamId}
            disabled={disabled}
            onChange={(e) => setTeamId(Number(e.target.value))}
          >
            {draft.managers.map((m) => (
              <option key={m.teamId} value={m.teamId}>
                {m.name} · {teams[m.teamId].name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset disabled={disabled} className="local-review-fieldset">
        <legend className="sr-only">Lineup and coaching for {team.name}</legend>
        <div className="local-review-roster">
          {ROSTER_SLOTS.map((slot) => {
            const mon = POKEMON_BY_ID.get(team.roster[slot]!)!;
            return (
              <label className="local-review-player" key={slot}>
                <span aria-hidden="true">
                  <Portrait mon={mon} />
                </span>
                <span>
                  {slot} · {SLOT_NAMES[slot]}
                  <select
                    aria-label={`${slot} player`}
                    value={mon.id}
                    onChange={(e) => {
                      const other = ROSTER_SLOTS.find(
                        (s) => team.roster[s] === Number(e.target.value),
                      )!;
                      change((current) =>
                        swapLocalSlots(current, teamId, slot, other),
                      );
                    }}
                  >
                    {ROSTER_SLOTS.map((s) => (
                      <option key={s} value={team.roster[s]!}>
                        {POKEMON_BY_ID.get(team.roster[s]!)!.name}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            );
          })}
        </div>
        <div className="local-coaching">
          <label>
            Offense
            <select
              value={team.tactic}
              onChange={(e) =>
                change((current) =>
                  updateLocalCoaching(current, teamId, {
                    ...current.coaching[teamId],
                    tactic: e.target.value as typeof team.tactic,
                  }),
                )
              }
            >
              {TACTICS.map((t) => (
                <option key={t} value={t}>
                  {TACTIC_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Defense
            <select
              value={team.defense}
              onChange={(e) =>
                change((current) =>
                  updateLocalCoaching(current, teamId, {
                    ...current.coaching[teamId],
                    defense: e.target.value as typeof team.defense,
                  }),
                )
              }
            >
              {DEFENSE_SCHEMES.map((d) => (
                <option key={d} value={d}>
                  {DEFENSE_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rotation
            <select
              value={team.rotation}
              onChange={(e) =>
                change((current) =>
                  updateLocalCoaching(current, teamId, {
                    ...current.coaching[teamId],
                    rotation: e.target.value as typeof team.rotation,
                  }),
                )
              }
            >
              {ROTATIONS.map((r) => (
                <option key={r} value={r}>
                  {r === "balanced"
                    ? "Balanced minutes"
                    : r === "starters"
                      ? "Lean on starters"
                      : "Use the bench"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
    </section>
  );
}

export function LocalLeagueMode({
  onExit,
  storage,
}: {
  onExit: () => void;
  storage?: StorageLike;
}) {
  const {
    draft,
    change,
    reset,
    result,
    simulate,
    playoffs,
    advancePlayoffs,
    busy,
    progress,
    notice,
    error,
  } = useLocalLeague(storage);
  const [confirm, setConfirm] = useState(false);
  const league = result?.league;
  const rankings = draft && league ? rankLocalManagers(draft, league) : [];
  const ready = draft?.picks.length === 240;
  return (
    <SpriteContext.Provider value="pixel">
      <div className="app-shell local-league">
        <header className="local-header">
          <div>
            <span className="eyebrow">POKÉMON BASKETBALL</span>
            <h1>Local league</h1>
            <p>Draft with friends. Chase the championship.</p>
          </div>
          <div className="local-header-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={onExit}
            >
              Back to game
            </button>
            {draft && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => setConfirm(true)}
              >
                New local league
              </button>
            )}
          </div>
        </header>
        <main>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          {(!draft || draft.version === 2) && <MatchupLab />}
          {!draft ? (
            <LocalLeagueSetup onStart={change} />
          ) : !ready ? (
            <LocalLeagueDraft
              key={draft.picks.length}
              draft={draft}
              onPick={(id, slot) =>
                change((current) => pickLocalPlayer(current, id, slot))
              }
            />
          ) : !league ? (
            <>
              <ReviewTeams
                draft={draft}
                change={change}
                disabled={busy || draft.completed}
              />
              <section className="local-simulate local-panel">
                <div>
                  <h3>
                    {draft.completed
                      ? "Restoring your season"
                      : "82 games for every team"}
                  </h3>
                  <p>
                    One shared schedule. The same basketball simulation as the
                    original game.
                  </p>
                </div>
                {busy ? (
                  <div className="local-progress" role="status">
                    <span>
                      {draft.completed ? "Restoring" : "Simulating"} season ·{" "}
                      {progress.completed.toLocaleString()} /{" "}
                      {progress.total.toLocaleString()} games
                    </span>
                    <progress
                      value={progress.completed}
                      max={progress.total}
                      aria-label="Local season progress"
                    />
                  </div>
                ) : (
                  <button
                    className="button primary"
                    onClick={() => void simulate()}
                  >
                    {draft.completed
                      ? "Retry restoring season"
                      : "Simulate local season"}
                  </button>
                )}
              </section>
            </>
          ) : (
            <>
              <section
                className="local-panel local-results"
                aria-label="Friends season results"
              >
                <span className="eyebrow">REGULAR-SEASON BRAGGING RIGHTS</span>
                <h2>
                  {rankings[0].manager.name} finishes first among friends.
                </h2>
                <p>
                  {rankings[0].standing.wins}–{rankings[0].standing.losses} · #
                  {rankings[0].leagueRank} in the full league
                </p>
                <div
                  className="results-table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label="Scrollable friends leaderboard"
                >
                  <table className="results-table">
                    <caption className="sr-only">Friends leaderboard</caption>
                    <thead>
                      <tr>
                        <th scope="col">FRIEND / TEAM</th>
                        <th scope="col">LEAGUE RANK</th>
                        <th scope="col">W</th>
                        <th scope="col">L</th>
                        <th scope="col">DIFF / GAME</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankings.map(
                        ({ manager, standing, leagueRank }, index) => (
                          <tr
                            key={manager.teamId}
                            className={index === 0 ? "league-user-team" : ""}
                          >
                            <th scope="row">
                              <strong>{manager.name}</strong>
                              <small>{league.teams[manager.teamId].name}</small>
                            </th>
                            <td>#{leagueRank}</td>
                            <td>{standing.wins}</td>
                            <td>{standing.losses}</td>
                            <td>
                              {(
                                (standing.pointsFor - standing.pointsAgainst) /
                                82
                              ).toFixed(1)}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="stat-legend">
                  Ranked by wins, then point differential, then team ID,
                  matching the league standings. The top 16 teams advance to the
                  playoffs below.
                </p>
              </section>
              <PlayoffPanel
                league={league}
                seasonSeed={localLeagueRun(draft).seasonSeed}
                playoffs={playoffs}
                managers={draft.managers}
                onAdvance={(mode) => void advancePlayoffs(mode)}
                simulating={busy}
                progress={progress}
              />
              <LeaguePanel league={league} />
            </>
          )}
        </main>
        <footer className="local-footer">
          Saved in this browser separately from your solo game. Share the
          computer for each friend's turn.
        </footer>
        {confirm && (
          <ConfirmDialog
            title="Start a new local league?"
            description="This replaces this local draft, season results and playoff bracket. Your solo game and franchise stay saved."
            confirmLabel="Replace local league"
            onCancel={() => setConfirm(false)}
            onConfirm={() => {
              reset();
              setConfirm(false);
            }}
          />
        )}
      </div>
    </SpriteContext.Provider>
  );
}
