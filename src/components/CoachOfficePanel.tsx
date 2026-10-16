import { useEffect, useMemo, useState } from "react";
import { COACHES, getCoach } from "../game/trainerCoaches";
import { coachCareers, type CoachSeasonRecord } from "../game/coachCareers";
import {
  coachRosterFit,
  projectedCoaches,
  type CoachOffice,
} from "../game/coachOffice";
import { DEFENSE_LABELS, TACTIC_LABELS, type LeagueTeam } from "../game/types";
import { CoachPortrait } from "./CoachPortrait";
import { CoachSummary } from "./CoachSummary";
import "../coaches.css";

export function CoachScope() {
  return (
    <details className="coach-scope">
      <summary>What does automatic coaching control?</summary>
      <p>
        Your trainer chooses the game plan, starters, minute targets,
        substitutions and closing lineups. Their style affects offensive pace
        and shot priorities, defense, screen coverage, risk and rest.
      </p>
      <p>
        During games they respond to the score, clock, fatigue and the
        opponent’s shot mix. Lineup decisions account for role fit, matchups and
        foul trouble. The shared possession engine resolves court spacing,
        multi-action plays, screens, Pokémon types, height, weight, strength and
        speed in every simulated season and playoff game.
      </p>
      <p>
        These are coded decision rules, not a coach reasoning about every
        option. Trainer coverage preferences work with the matchup logic;
        adaptability differs by trainer. You still manage roster moves and
        individual training. Manual arcade controls remain yours.
      </p>
    </details>
  );
}
const record = (wins: number, losses: number) => `${wins}–${losses}`;
const roundName = (round: number) =>
  ["First round", "Quarterfinals", "Semifinals", "Finals"][round];
export function CoachOfficePanel({
  teams,
  office,
  year,
  offseason,
  humans,
  records,
  onHire,
  onReview,
  disabled = false,
}: {
  teams: LeagueTeam[];
  office?: CoachOffice;
  year: number;
  offseason: boolean;
  humans: { teamId: number; name: string }[];
  records: CoachSeasonRecord[];
  onHire?: (teamId: number, id: string | null) => void;
  onReview?: () => void;
  disabled?: boolean;
}) {
  const [selectedTeam, setSelectedTeam] = useState(humans[0]?.teamId ?? 0);
  const [search, setSearch] = useState("");
  const [careerId, setCareerId] = useState(
    teams[humans[0]?.teamId ?? 0]?.coach?.id ?? "ash",
  );
  const [directorySearch, setDirectorySearch] = useState("");
  const projected = offseason ? projectedCoaches(teams, office, year) : teams;
  const team =
    projected[
      humans.some((m) => m.teamId === selectedTeam)
        ? selectedTeam
        : (humans[0]?.teamId ?? 0)
    ];
  const current = getCoach(team?.coach?.id ?? "");
  const coached = teams.every((t) => t.coach);
  const reviewed =
    office?.years.find((r) => r.year === year)?.cpuProcessed ?? false;
  useEffect(() => {
    if (offseason && coached && !reviewed && !disabled) onReview?.();
  }, [offseason, coached, reviewed, disabled, onReview]);
  const careers = useMemo(() => coachCareers(records), [records]);
  const available = COACHES.filter(
    (c) => !projected.some((t) => t.coach?.id === c.id),
  )
    .map((coach) => ({ coach, fit: coachRosterFit(team, coach) }))
    .sort((a, b) => b.fit - a.fit || a.coach.name.localeCompare(b.coach.name));
  const visible = available.filter(({ coach: c }) =>
    `${c.name} ${c.identity} ${c.style}`
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  );
  const selected = careers.find((c) => c.coach.id === careerId)!;
  const club = (id: string) =>
    projected.find((t) => t.coach?.id === id)?.name ?? "Available";
  const teamName = (id: number) =>
    teams.find((t) => t.id === id)?.name ?? `Club ${id + 1}`;
  const events =
    office?.years
      .flatMap((r) =>
        r.changes.map((c, i) => ({ ...c, year: r.year, index: i })),
      )
      .slice()
      .reverse() ?? [];
  return (
    <section className="coach-office" aria-label="Coaching office">
      <header className="coach-office-heading">
        <div>
          <span className="eyebrow">
            {offseason
              ? `OFFSEASON ${year} · APPOINTMENTS FOR YEAR ${year + 1}`
              : `YEAR ${year} · COACHING`}
          </span>
          <h3>The coaching office</h3>
          <p>
            {offseason
              ? "Retain your coach, release them, or appoint an available trainer. Every coach can lead one club at a time."
              : "Follow every trainer’s record. Hiring and firing open in the offseason."}
          </p>
        </div>
        {humans.length > 1 && (
          <label>
            Manage friend’s club
            <select
              value={team.id}
              onChange={(e) => setSelectedTeam(Number(e.target.value))}
              disabled={disabled}
            >
              {humans.map((h) => (
                <option key={h.teamId} value={h.teamId}>
                  {h.name} · {teamName(h.teamId)}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {current ? (
        <>
          <CoachSummary team={team} nextSeason={offseason} />
          {offseason && onHire && (
            <button
              className="button secondary"
              disabled={disabled}
              onClick={() => onHire(team.id, null)}
            >
              Fire {current.name}
            </button>
          )}
        </>
      ) : coached && offseason ? (
        <p className="notice" role="status">
          {team.name} has no head coach. Hire a trainer before starting the next
          season.
        </p>
      ) : (
        <p className="coach-footnote">
          This legacy season has no recorded trainer. Select your first coach
          through the coach draft to begin tracking their career.
        </p>
      )}
      <CoachScope />
      {offseason && coached && onHire && (
        <section aria-label="Available coaches" className="coach-market">
          <h3>
            Available trainers{" "}
            <span className="coach-style">{available.length}</span>
          </h3>
          <p>
            Ranked by fit with {team.name}’s current roster. Hiring replaces
            your current coach immediately for next season. Completed games keep
            their original coach.
          </p>
          <label className="coach-search">
            Find an available coach
            <input
              type="search"
              value={search}
              placeholder="Name, role or coaching style"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="coach-cards">
            {visible.map(({ coach: c, fit }) => {
              const stats = careers.find((s) => s.coach.id === c.id)!;
              return (
                <article className="coach-card" key={c.id}>
                  <div className="coach-card-top">
                    <CoachPortrait coach={c} />
                    <span className="eyebrow">
                      ROSTER FIT
                      <br />
                      {fit.toFixed(1)} / 100
                    </span>
                  </div>
                  <h4>{c.name}</h4>
                  <strong className="coach-style">{c.style}</strong>
                  <p>{c.description}</p>
                  <div className="coach-tags">
                    <span>{TACTIC_LABELS[c.tactic]}</span>
                    <span>{DEFENSE_LABELS[c.defense]}</span>
                    <span>{c.coverage} coverage</span>
                  </div>
                  <p>
                    {record(stats.wins, stats.losses)} regular season ·{" "}
                    {stats.championships} titles
                  </p>
                  <p className="coach-tradeoff">
                    <b>Tradeoff</b> {c.tradeoff}
                  </p>
                  <button
                    className="button primary"
                    disabled={disabled}
                    onClick={() => onHire(team.id, c.id)}
                  >
                    Hire {c.name}
                  </button>
                </article>
              );
            })}
          </div>
          {!visible.length && <p>No available trainers match that search.</p>}
          <p className="coach-footnote">
            CPU clubs review coaching once each offseason. Results versus roster
            expectations, repeated struggles, roster fit and career success
            guide their changes. Human clubs and the two finalists keep their
            coach unless a human manager makes a change.
          </p>
          {records.some((r) => r.year === year && !r.postseasonKnown) && (
            <p className="coach-footnote">
              This older local save has no Finals matchup detail. CPU coaches
              are retained for this offseason; automatic reviews resume after
              the next season.
            </p>
          )}
        </section>
      )}
      <details className="coach-directory" open>
        <summary>Coach careers · league directory</summary>
        <label className="coach-search">
          Find a coach or club
          <input
            type="search"
            value={directorySearch}
            onChange={(e) => setDirectorySearch(e.target.value)}
            placeholder="Trainer or club name"
          />
        </label>
        <div
          className="results-table-wrap"
          role="region"
          tabIndex={0}
          aria-label="Coach career records"
        >
          <table className="results-table">
            <thead>
              <tr>
                <th>Coach</th>
                <th>{offseason ? "Next club" : "Club"}</th>
                <th>Regular W–L</th>
                <th>Playoff W–L</th>
                <th>Series W–L</th>
                <th>Titles</th>
              </tr>
            </thead>
            <tbody>
              {[...careers]
                .sort(
                  (a, b) =>
                    b.championships - a.championships ||
                    b.wins - a.wins ||
                    a.coach.name.localeCompare(b.coach.name),
                )
                .filter((c) =>
                  `${c.coach.name} ${club(c.coach.id)}`
                    .toLowerCase()
                    .includes(directorySearch.toLowerCase().trim()),
                )
                .map((c) => (
                  <tr key={c.coach.id} aria-selected={c.coach.id === careerId}>
                    <th>
                      <button
                        className="text-button"
                        aria-label={`View ${c.coach.name} career`}
                        onClick={() => setCareerId(c.coach.id)}
                      >
                        {c.coach.name}
                      </button>
                    </th>
                    <td>{club(c.coach.id)}</td>
                    <td>{record(c.wins, c.losses)}</td>
                    <td>
                      {record(c.playoffWins, c.playoffLosses)}
                      {c.missingPostseasons ? "*" : ""}
                    </td>
                    <td>{record(c.seriesWins, c.seriesLosses)}</td>
                    <td>{c.championships}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <article
          className="coach-career-detail"
          aria-label={`${selected.coach.name} career details`}
        >
          <div className="coach-identity">
            <CoachPortrait coach={selected.coach} />
            <div>
              <span className="eyebrow">COACH CAREER</span>
              <h3>{selected.coach.name}</h3>
              <p>
                {club(selected.coach.id)} · {selected.coach.style}
              </p>
            </div>
          </div>
          <div className="coach-career-totals">
            <span>
              <b>{record(selected.wins, selected.losses)}</b>Regular season
            </span>
            <span>
              <b>{record(selected.playoffWins, selected.playoffLosses)}</b>
              Playoff games
            </span>
            <span>
              <b>{selected.finalsAppearances}</b>Finals appearances
            </span>
            <span>
              <b>{selected.championships}</b>Championships
            </span>
          </div>
          <p className="coach-footnote">
            Records follow the trainer across clubs. The active season counts
            games played so far.{" "}
            {selected.missingPostseasons > 0 &&
              "* Older local saves did not store series results; playoff totals include only recorded games. Known championships are retained."}
          </p>
          {selected.seasons.length ? (
            <div className="coach-season-list">
              {selected.seasons
                .slice()
                .reverse()
                .map((s) => (
                  <details key={`${s.year}-${s.teamId}`}>
                    <summary>
                      Year {s.year} · {teamName(s.teamId)} ·{" "}
                      {record(s.wins, s.losses)} ·{" "}
                      {s.champion
                        ? "Champion"
                        : !s.complete
                          ? "In progress"
                          : !s.postseasonKnown
                            ? "Postseason detail unavailable"
                            : s.playoffSeed
                              ? `${roundName(s.rounds.at(-1)?.round ?? 0)} exit`
                              : "Missed playoffs"}
                    </summary>
                    {s.playoffSeed && <p>Playoff seed #{s.playoffSeed}</p>}
                    {s.rounds.length ? (
                      <ul>
                        {s.rounds.map((round) => (
                          <li key={round.round}>
                            {roundName(round.round)} vs{" "}
                            {teamName(round.opponentId)}: {round.result}{" "}
                            {record(round.wins, round.losses)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>
                        {s.postseasonKnown
                          ? "No playoff series recorded."
                          : "This older save has no series breakdown."}
                      </p>
                    )}
                  </details>
                ))}
            </div>
          ) : (
            <p>No games coached in this franchise yet.</p>
          )}
        </article>
      </details>
      <details className="coach-news">
        <summary>Coaching transactions · {events.length}</summary>
        {events.length ? (
          <ol>
            {events.map((c) => (
              <li key={`${c.year}-${c.index}`}>
                <b>
                  Offseason {c.year} · {teamName(c.teamId)}
                </b>
                <p>
                  {c.to
                    ? `Hired ${getCoach(c.to)!.name}${c.from ? `, replacing ${getCoach(c.from)!.name}` : ""}.`
                    : `Released ${getCoach(c.from!)!.name}.`}{" "}
                  {c.source === "cpu" ? "CPU decision." : "Manager decision."}
                </p>
                <p className="coach-footnote">{c.reason}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p>No coaching changes recorded.</p>
        )}
      </details>
    </section>
  );
}
