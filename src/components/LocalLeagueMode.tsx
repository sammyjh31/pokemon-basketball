import { CoachOfficePanel } from "./CoachOfficePanel";
import { projectedCoaches } from "../game/coachOffice";
import { localCoachRecords } from "../game/coachCareers";
import { appointLocalCoach, reviewLocalCoaches } from "../game/coachLocal";
import { CoachDraft } from "./CoachDraft";
import { CoachSummary } from "./CoachSummary";
import { localCoachTurn, selectLocalCoach } from "../game/coachSelection";
import { useMemo, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import { useLocalLeague } from "../hooks/useLocalLeague";
import {
  localLeagueTeams,
  localDraftSize,
  pickLocalPlayer,
  rankLocalManagers,
  swapLocalSlots,
  updateLocalCoaching,
  updateLocalDraftLocks,
  type LocalLeague,
} from "../game/localLeague";
import {
  POSITIONS,
  DEFENSE_LABELS,
  DEFENSE_SCHEMES,
  ROTATIONS,
  ROSTER_SLOTS,
  SLOT_NAMES,
  TACTICS,
  TACTIC_LABELS,
} from "../game/types";
import type { StorageLike } from "../game/persistence";
import { beginLocalOffseason, localSeasonSeed } from "../game/localCareer";
import { lineupChemistry } from "../game/engineDepth";
import { playerProfile } from "../game/playerProfile";
import { LocalCareerPanel, LocalCareerHistory } from "./LocalCareerPanel";
import { LocalLeagueSetup } from "./LocalLeagueSetup";
import { LocalLeagueDraft } from "./LocalLeagueDraft";
import { LeaguePanel } from "./LeaguePanel";
import { PlayoffPanel } from "./PlayoffPanel";
import { MatchupLab } from "./MatchupLab";
import { ConfirmDialog } from "./ConfirmDialog";
import { Portrait } from "./Portrait";
import { SpriteContext } from "./SpriteControls";
import "../localLeague.css";
import "../localDraft.css";

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
  const teams = useMemo(
    () =>
      draft.career?.phase === "offseason"
        ? projectedCoaches(
            localLeagueTeams(draft),
            draft.career.coachOffice,
            draft.career.year,
          )
        : localLeagueTeams(draft),
    [draft],
  );
  const team = teams[teamId];
  return (
    <section className="local-panel" aria-label="Review friends' teams">
      <div className="local-review-heading">
        <div>
          <span className="eyebrow">
            YEAR {draft.career?.year ?? 1} · TEAM MANAGEMENT
          </span>
          <h2>Set your lineup. Settle the debate.</h2>
          <p>
            {team.coach
              ? "Your trainer manages the rotation and game plan automatically."
              : "Every friend can adjust their lineup and coaching before the season."}
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
        {team.engineRules && (
          <p className="stat-legend">
            Starting lineup chemistry: up to{" "}
            {(
              lineupChemistry(
                POSITIONS.map((slot) =>
                  playerProfile(
                    POKEMON_BY_ID.get(team.roster[slot]!)!,
                    team.development?.[team.roster[slot]!],
                  ),
                ),
                team.engineRules.familiarity,
              ) * 100
            ).toFixed(2)}{" "}
            percentage points on passing plays. Separate creators, spacers, and
            finishers combine with{" "}
            {(team.engineRules.familiarity * 100).toFixed(0)}% roster
            continuity. Keeping teammates together builds familiarity each year.
          </p>
        )}
        {team.coach ? (
          <CoachSummary
            team={team}
            nextSeason={draft.career?.phase === "offseason"}
          />
        ) : draft.career?.phase === "offseason" &&
          draft.career.teams[teamId].coach ? (
          <p className="notice">Hire a head coach in the coaching office.</p>
        ) : (
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
        )}
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
  const ready = draft ? draft.picks.length === localDraftSize(draft) : false;
  const year = draft?.career?.year ?? 1;
  const offseason = draft?.career?.phase === "offseason";
  return (
    <SpriteContext.Provider value="pixel">
      <div className="app-shell local-league">
        <header className="local-header">
          <div>
            <span className="eyebrow">POKÉMON BASKETBALL</span>
            <h1>Local league{draft?.options ? ` · Year ${year}` : ""}</h1>
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
          {draft &&
            ready &&
            !draft.coachDraftRequired &&
            draft.coaching.some((c) => c.coach) && (
              <details className="local-panel" open={offseason}>
                <summary>Coaches · hiring and career records</summary>
                <CoachOfficePanel
                  teams={localLeagueTeams(draft)}
                  office={draft.career?.coachOffice}
                  year={year}
                  offseason={offseason}
                  humans={draft.managers}
                  records={localCoachRecords(
                    draft.career,
                    localLeagueTeams(draft),
                    result,
                    playoffs,
                  )}
                  disabled={busy}
                  onReview={() => change(reviewLocalCoaches)}
                  onHire={(teamId, id) =>
                    change((current) => appointLocalCoach(current, teamId, id))
                  }
                />
              </details>
            )}
          {!draft ? (
            <LocalLeagueSetup onStart={change} />
          ) : draft.coachDraftRequired ? (
            <CoachDraft
              seed={draft.seed}
              manager={localCoachTurn(draft)?.name}
              taken={draft.coaching.flatMap((c) =>
                c.coach ? [c.coach.id] : [],
              )}
              onChoose={(id) =>
                change((current) =>
                  selectLocalCoach(
                    current,
                    localCoachTurn(current)!.teamId,
                    id,
                  ),
                )
              }
            />
          ) : !ready ? (
            <LocalLeagueDraft
              key={draft.picks.length}
              draft={draft}
              onLocksChange={(slots) =>
                change((current) => updateLocalDraftLocks(current, slots))
              }
              onPick={(id, slot, lineup) =>
                change((current) => pickLocalPlayer(current, id, slot, lineup))
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
                      : `${draft.options?.format.gamesPerTeam ?? 82} games for every team`}
                  </h3>
                  <p>
                    One shared schedule, using the basketball simulation with
                    your league’s rules.
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
              {offseason && (
                <>
                  <LocalCareerPanel draft={draft} change={change} />
                  <ReviewTeams draft={draft} change={change} disabled={busy} />
                </>
              )}
              {!offseason &&
                draft.options &&
                playoffs?.championId != null &&
                year < 50 && (
                  <section className="local-panel">
                    <h2>Keep the franchise going.</h2>
                    <p>
                      The championship is decided. Begin the offseason to
                      develop players
                      {draft.options.mode === "generational" && year < 9
                        ? ` and draft Generation ${year + 1}`
                        : ""}
                      .
                    </p>
                    <button
                      type="button"
                      className="button primary"
                      disabled={busy}
                      onClick={() =>
                        change((current) =>
                          beginLocalOffseason(current, result!, playoffs),
                        )
                      }
                    >
                      Begin offseason
                    </button>
                  </section>
                )}
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
                                (standing.wins + standing.losses || 1)
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
                  matching the league standings. The top{" "}
                  {draft.options?.format.playoffTeams ?? 16} teams advance to
                  the playoffs below.
                </p>
              </section>
              <PlayoffPanel
                league={league}
                seasonSeed={localSeasonSeed(draft)}
                playoffs={playoffs}
                managers={draft.managers}
                onAdvance={(mode) => void advancePlayoffs(mode)}
                simulating={busy}
                progress={progress}
              />
              <LeaguePanel league={league} />
            </>
          )}
          {draft?.career && <LocalCareerHistory draft={draft} />}
        </main>
        <footer className="local-footer">
          Saved in this browser separately from your solo game. Share the
          computer for each friend's turn.
        </footer>
        {confirm && (
          <ConfirmDialog
            title="Start a new local league?"
            description="This replaces this local draft, every career season, and playoff history. Your solo game and franchise stay saved."
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
