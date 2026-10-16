import { projectedCoaches } from "../game/coachOffice";
import { useEffect, useRef, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import {
  applyLocalTrade,
  currentLocalRookieTurn,
  evaluateLocalTrade,
  localRookiePool,
  pickLocalRookie,
  recommendedLocalRookie,
  replayLocalHistoryAsync,
  startNextLocalSeason,
} from "../game/localCareer";
import { type LocalLeague } from "../game/localLeague";
import type { SeasonResult } from "../game/types";
import type { Playoffs } from "../game/playoffTypes";
import { LeaguePanel } from "./LeaguePanel";
import { PlayoffPanel } from "./PlayoffPanel";
import { ScoutReport } from "./ScoutReport";
import { DepthScouting } from "./DepthScouting";

type Props = {
  draft: LocalLeague;
  change: (next: (draft: LocalLeague) => LocalLeague) => void;
};
const name = (id: number) => POKEMON_BY_ID.get(id)?.name ?? `#${id}`;

function RookiePick({ draft, change }: Props) {
  const turn = currentLocalRookieTurn(draft)!;
  const turnHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    turnHeading.current?.focus();
  }, []);
  const team = draft.career!.teams[turn.teamId];
  const pool = localRookiePool(draft);
  const suggestion = recommendedLocalRookie(draft)!;
  const [pokemonId, setPokemonId] = useState(suggestion.pokemonId);
  const [releaseId, setReleaseId] = useState(suggestion.releasedId);
  const mon = POKEMON_BY_ID.get(pokemonId)!;
  return (
    <section aria-label="Rookie draft" className="local-panel">
      <span className="eyebrow">
        GENERATION {turn.generation} · ROUND {turn.round} OF 2 · PICK{" "}
        {turn.pick}
      </span>
      <h3 ref={turnHeading} tabIndex={-1}>
        On the clock: {turn.manager?.name ?? "CPU"}
      </h3>
      <p>
        {team.name} adds one rookie and releases one player to keep an
        eight-player roster. The lowest-ranked teams pick first in both rounds.
        CPU picks happen between friends’ turns.
      </p>
      <div className="local-settings">
        <label>
          Available rookie
          <select
            value={pokemonId}
            onChange={(e) => setPokemonId(Number(e.target.value))}
          >
            {pool.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Player to release
          <select
            value={releaseId}
            onChange={(e) => setReleaseId(Number(e.target.value))}
          >
            {Object.values(team.roster).map((id) => (
              <option key={id} value={id!}>
                {name(id!)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>
        Roster-fit suggestion: {name(suggestion.pokemonId)} for{" "}
        {name(suggestion.releasedId)}. You can choose a different pairing.
      </p>
      {suggestion.reason && <p>{suggestion.reason}</p>}
      <details>
        <summary>Scout rookie: {mon.name}</summary>
        <ScoutReport mon={mon} />
        <DepthScouting
          mon={mon}
          abilities={draft.options!.engineRules.abilities}
        />
      </details>
      <button
        type="button"
        className="button primary"
        onClick={() =>
          change((current) => pickLocalRookie(current, pokemonId, releaseId))
        }
      >
        Draft {mon.name} and release {name(releaseId)}
      </button>
    </section>
  );
}

function Trades({ draft, change }: Props) {
  const teams = draft.career!.teams;
  const [fromId, setFromId] = useState(draft.managers[0].teamId);
  const [toId, setToId] = useState(teams.find((t) => t.id !== fromId)!.id);
  const [giveId, setGiveId] = useState(teams[fromId].roster.PG!);
  const [receiveId, setReceiveId] = useState(teams[toId].roster.PG!);
  const [accepted, setAccepted] = useState<number[]>([]);
  const evaluation = evaluateLocalTrade(draft, fromId, toId, giveId, receiveId);
  const update = (fn: () => void) => {
    fn();
    setAccepted([]);
  };
  return (
    <details className="local-panel">
      <summary>Offseason player trades</summary>
      <p>
        Swap one player for one player. Each friend involved must agree. CPU
        clubs evaluate roster fit, player value, and learned rival matchups.
      </p>
      <div className="local-settings">
        <label>
          Offering team
          <select
            value={fromId}
            onChange={(e) =>
              update(() => {
                const id = Number(e.target.value);
                setFromId(id);
                setGiveId(teams[id].roster.PG!);
                if (id === toId) {
                  const next = teams.find((t) => t.id !== id)!.id;
                  setToId(next);
                  setReceiveId(teams[next].roster.PG!);
                }
              })
            }
          >
            {draft.managers.map((m) => (
              <option key={m.teamId} value={m.teamId}>
                {m.name} · {teams[m.teamId].name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trade partner
          <select
            value={toId}
            onChange={(e) =>
              update(() => {
                const id = Number(e.target.value);
                setToId(id);
                setReceiveId(teams[id].roster.PG!);
              })
            }
          >
            {teams
              .filter((t) => t.id !== fromId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {draft.managers.some((m) => m.teamId === t.id)
                    ? " · Friend"
                    : " · CPU"}
                </option>
              ))}
          </select>
        </label>
        <label>
          Offer player
          <select
            value={giveId}
            onChange={(e) => update(() => setGiveId(Number(e.target.value)))}
          >
            {Object.values(teams[fromId].roster).map((id) => (
              <option key={id} value={id!}>
                {name(id!)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Receive player
          <select
            value={receiveId}
            onChange={(e) => update(() => setReceiveId(Number(e.target.value)))}
          >
            {Object.values(teams[toId].roster).map((id) => (
              <option key={id} value={id!}>
                {name(id!)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p role="status">{evaluation.reason}</p>
      {evaluation.requiresAcceptance.map((id) => (
        <label key={id} className="local-legend-option">
          <input
            type="checkbox"
            checked={accepted.includes(id)}
            onChange={(e) =>
              setAccepted((current) =>
                e.target.checked
                  ? [...current, id]
                  : current.filter((value) => value !== id),
              )
            }
          />
          {draft.managers.find((m) => m.teamId === id)!.name} agrees to this
          trade
        </label>
      ))}
      <button
        type="button"
        className="button secondary"
        disabled={
          !evaluation.accepted ||
          evaluation.requiresAcceptance.some((id) => !accepted.includes(id))
        }
        onClick={() =>
          change((current) =>
            applyLocalTrade(current, fromId, toId, giveId, receiveId, accepted),
          )
        }
      >
        Complete player trade
      </button>
    </details>
  );
}

export function LocalCareerPanel({ draft, change }: Props) {
  const career = draft.career!;
  const archive = career.history.at(-1)!;
  const turn = currentLocalRookieTurn(draft);
  const needsCoach =
    career.teams.some((t) => t.coach) &&
    projectedCoaches(career.teams, career.coachOffice, career.year).some(
      (t) => !t.coach,
    );
  return (
    <section aria-label="Local offseason" className="local-career">
      <div className="local-panel">
        <span className="eyebrow">YEAR {career.year} COMPLETE</span>
        <h2>Build your next contender.</h2>
        <p>
          {draft.options!.mode === "full-pool"
            ? "All generations were available in the opening draft. Future seasons have player development and no rookie draft."
            : career.year < 9
              ? `The next class is Generation ${career.year + 1}. Complete two rookie rounds before starting year ${career.year + 1}.`
              : "Every bundled generation has entered the league. Continue with player development and no further rookie drafts."}
        </p>
        <details>
          <summary>
            Offseason development · {archive.development.length} players
            evaluated
          </summary>
          <p>
            Season performance produces small, bounded skill changes. Changes
            below are rating points, already applied once for this offseason.
          </p>
          <div
            className="results-table-wrap"
            role="region"
            tabIndex={0}
            aria-label="Offseason development"
          >
            <table className="results-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Player</th>
                  <th>Skill changes</th>
                </tr>
              </thead>
              <tbody>
                {archive.development.map((row) => (
                  <tr key={`${row.teamId}-${row.pokemonId}`}>
                    <th>{career.teams[row.teamId].name}</th>
                    <td>{name(row.pokemonId)}</td>
                    <td>
                      {Object.entries(row.changes)
                        .filter(([, value]) => value)
                        .map(
                          ([skill, value]) =>
                            `${skill.replace(/([A-Z])/g, " $1")} ${value! > 0 ? "+" : ""}${value}`,
                        )
                        .join(", ") || "No change"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
      {turn ? (
        <RookiePick key={turn.pick} draft={draft} change={change} />
      ) : (
        <>
          <Trades key={archive.trades.length} draft={draft} change={change} />
          <div className="local-panel">
            <h3>Ready for year {career.year + 1}</h3>
            {needsCoach && (
              <p className="notice">
                Every club needs a head coach. Fill vacant jobs in the coaching
                office above.
              </p>
            )}
            <p>
              Review your lineups and coaching below, then start the next
              season. Your past standings, champion, games, and player
              statistics remain available in career history.
            </p>
            <button
              className="button primary"
              type="button"
              disabled={needsCoach}
              onClick={() => change(startNextLocalSeason)}
            >
              Start year {career.year + 1}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function LocalCareerHistory({ draft }: { draft: LocalLeague }) {
  const [opened, setOpened] = useState<{
    year: number;
    result: SeasonResult;
    playoffs: Playoffs;
  } | null>(null);
  const [loading, setLoading] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  const load = async (year: number) => {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setLoading(year);
    setOpened(null);
    setError("");
    try {
      const replay = await replayLocalHistoryAsync(
        draft,
        year,
        (done, total) => setProgress(Math.round((done / total) * 100)),
        active.signal,
      );
      if (!active.signal.aborted) setOpened({ year, ...replay });
    } catch (e) {
      if (!active.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Could not restore this season.",
        );
    } finally {
      if (controller.current === active) {
        controller.current = null;
        setLoading(null);
      }
    }
  };
  if (!draft.career?.history.length) return null;
  return (
    <section
      className="local-panel local-career-history"
      aria-label="Career history"
    >
      <h2>Career history</h2>
      <p>Reopen any season with its original rosters and game results.</p>
      <div
        className="results-table-wrap"
        role="region"
        tabIndex={0}
        aria-label="Career seasons"
      >
        <table className="results-table">
          <thead>
            <tr>
              <th>Season</th>
              <th>Champion</th>
              <th>Manager</th>
              <th>Finals MVP</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {draft.career.history.map((year) => (
              <tr key={year.year}>
                <th>Year {year.year}</th>
                <td>{year.teams[year.championId].name}</td>
                <td>
                  {draft.managers.find((m) => m.teamId === year.championId)
                    ?.name ?? "CPU"}
                </td>
                <td>{name(year.finalsMvp.pokemonId)}</td>
                <td>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void load(year.year)}
                    disabled={loading !== null}
                  >
                    Open year {year.year}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading !== null && (
        <div role="status">
          <p>
            Restoring year {loading} · {progress}%
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              controller.current?.abort();
              setLoading(null);
            }}
          >
            Cancel history replay
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {opened && (
        <div>
          <h3>Year {opened.year} archive</h3>
          <button
            type="button"
            className="text-button"
            onClick={() => setOpened(null)}
          >
            Close archived season
          </button>
          <PlayoffPanel
            league={opened.result.league!}
            seasonSeed={
              draft.career.history.find((h) => h.year === opened.year)!
                .seasonSeed
            }
            playoffs={opened.playoffs}
            managers={draft.managers}
            onAdvance={() => {}}
          />
          <LeaguePanel league={opened.result.league!} />
        </div>
      )}
    </section>
  );
}
