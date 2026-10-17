import { EvaluationFactors } from "./EvaluationFactors";
import { useEffect, useMemo, useRef, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import {
  evaluateFreeAgentSigning,
  freeAgencyReady,
  freeAgentMarket,
  userSigningsThisYear,
} from "../game/freeAgency";
import { cpuRulesApply } from "../game/cpuRules";
import {
  CPU_FREE_AGENT_SIGNINGS,
  USER_FREE_AGENT_SIGNINGS,
} from "../game/freeAgencyTypes";
import { bestPosition, positionRating } from "../game/ratings";
import {
  POSITIONS,
  ROSTER_SLOTS,
  type GameState,
  type Position,
} from "../game/types";
import { CareerDetail } from "./CareerDetail";
import { Portrait } from "./Portrait";
import { ScoutReport } from "./ScoutReport";
import "../freeAgency.css";

export interface FreeAgentMarketProps {
  state: GameState;
  disabled?: boolean;
  onSign: (pokemonId: number, releasedId: number) => void;
  onCpu: () => void;
}

const playerName = (id: number) =>
  POKEMON_BY_ID.get(id)?.name ?? `Pokémon #${id}`;
const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

export function FreeAgentMarket(props: FreeAgentMarketProps) {
  const franchise = props.state.franchise;
  if (!franchise || franchise.phase !== "offseason") return null;
  return <MarketRoom key={franchise.year} {...props} />;
}

function MarketRoom({
  state,
  disabled = false,
  onSign,
  onCpu,
}: FreeAgentMarketProps) {
  const franchise = state.franchise!;
  const user = franchise.teams.find((team) => team.id === 0);
  const ready = freeAgencyReady(franchise);
  const cpuComplete =
    franchise.freeAgency?.cpuYears.includes(franchise.year) ?? false;
  const capped = cpuRulesApply(franchise),
    signingsLeft = Math.max(
      0,
      USER_FREE_AGENT_SIGNINGS - userSigningsThisYear(franchise),
    );
  const market = useMemo(
    () => freeAgentMarket(franchise, state.run.includeLegends),
    [franchise, state.run.includeLegends],
  );
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<Position | "">("");
  const [sort, setSort] = useState("rating");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [releaseId, setReleaseId] = useState<number | null>(null);
  const [scoutId, setScoutId] = useState<number | null>(null);
  const [careerId, setCareerId] = useState<number | null>(null);
  const [activityYear, setActivityYear] = useState(franchise.year);
  const scoutRef = useRef<HTMLDivElement>(null);
  const chosen = market.find((agent) => agent.pokemonId === selectedId);
  const releasedSlot =
    user && ROSTER_SLOTS.find((slot) => user.roster[slot] === releaseId);
  const released = releasedSlot ? POKEMON_BY_ID.get(releaseId!) : undefined;
  const evaluation = useMemo(
    () =>
      chosen && released
        ? evaluateFreeAgentSigning(
            franchise,
            0,
            chosen.pokemonId,
            released.id,
            state.run.includeLegends,
          )
        : null,
    [franchise, chosen, released, state.run.includeLegends],
  );
  useEffect(() => {
    if (selectedId !== null && !chosen) setSelectedId(null);
    if (releaseId !== null && !released) setReleaseId(null);
  }, [selectedId, chosen, releaseId, released]);
  useEffect(() => {
    if (scoutId === null) return;
    scoutRef.current?.focus();
    scoutRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [scoutId]);
  const candidates = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/^#/, "");
    return market
      .map((agent) => {
        const mon = POKEMON_BY_ID.get(agent.pokemonId)!;
        const slotPosition =
          releasedSlot && POSITIONS.includes(releasedSlot as Position)
            ? (releasedSlot as Position)
            : agent.position;
        const outgoingPosition =
          released &&
          releasedSlot &&
          !POSITIONS.includes(releasedSlot as Position)
            ? bestPosition(released, user?.development?.[released.id])
            : slotPosition;
        const fitChange = released
          ? positionRating(mon, slotPosition, agent.development) -
            positionRating(
              released,
              outgoingPosition,
              user?.development?.[released.id],
            )
          : 0;
        return { ...agent, mon, fitChange };
      })
      .filter(
        (agent) =>
          (!query ||
            agent.mon.name.toLowerCase().includes(query) ||
            String(agent.pokemonId) === query) &&
          (!position || agent.position === position),
      )
      .sort(
        (a, b) =>
          (sort === "name"
            ? a.mon.name.localeCompare(b.mon.name)
            : sort === "fit" && released
              ? b.fitChange - a.fitChange
              : b.rating - a.rating) || a.pokemonId - b.pokemonId,
      );
  }, [market, search, position, sort, releasedSlot, released, user]);
  const transactions = franchise.freeAgency?.transactions ?? [];
  const years = [
    ...new Set([
      franchise.year,
      ...transactions.map((entry) => entry.year),
      ...(franchise.freeAgency?.cpuYears ?? []),
    ]),
  ].sort((a, b) => b - a);
  const viewedYear = years.includes(activityYear)
    ? activityYear
    : franchise.year;
  const activity = transactions
    .filter((entry) => entry.year === viewedYear)
    .reverse();
  const clubName = (id: number) =>
    franchise.teams.find((team) => team.id === id)?.name ?? `Club ${id + 1}`;
  const scoutMon = POKEMON_BY_ID.get(scoutId ?? -1);
  const scoutTeam = franchise.teams.find((team) =>
    Object.values(team.roster).includes(scoutId),
  );
  const scoutDevelopment =
    market.find((agent) => agent.pokemonId === scoutId)?.development ??
    scoutTeam?.development?.[scoutId ?? -1];

  return (
    <section className="free-agent-market" aria-label="Free-agent market">
      <div className="free-agent-heading">
        <div>
          <span className="eyebrow">
            YEAR {franchise.year} · ANOTHER OPPORTUNITY
          </span>
          <h3>Free agents</h3>
        </div>
        <span className="free-agent-rule">One signing. One release.</span>
      </div>
      <p className="free-agent-intro">
        Give a released player a new home. Every signing replaces one player on
        your eight-player roster; the new player takes their role and minutes.
        Ratings include saved development.
      </p>
      {!ready && (
        <p className="free-agent-notice" role="status">
          Complete this year's rookie draft and player development to sign free
          agents or run CPU free agency.
        </p>
      )}
      <div className="free-agent-cpu">
        <div>
          <h4>
            {cpuComplete
              ? "The CPU round is complete."
              : capped
                ? "CPU clubs move first."
                : "Your club gets the first move."}
          </h4>
          {capped ? (
            <p>
              When the draft closes, CPU clubs sign first, worst record first,
              up to {CPU_FREE_AGENT_SIGNINGS} each (a second only for a clear
              upgrade). You may then sign up to {USER_FREE_AGENT_SIGNINGS} per
              offseason: {signingsLeft} remaining.
            </p>
          ) : (
            <p>
              CPU clubs make up to one signing each, once per offseason. This
              runs automatically when you start the next season. You can still
              sign players after the CPU round.
            </p>
          )}
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={disabled || !ready || cpuComplete}
          onClick={() => {
            if (!disabled && ready && !cpuComplete) onCpu();
          }}
        >
          {cpuComplete ? "CPU free agency complete" : "Run CPU free agency"}
        </button>
      </div>

      <div className="free-agent-workspace">
        <div className="free-agent-board">
          <div className="free-agent-filters">
            <label className="league-field">
              Search free agents
              <input
                type="search"
                value={search}
                placeholder="Name or Pokédex number"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="league-field">
              Free-agent position
              <select
                value={position}
                onChange={(event) =>
                  setPosition(event.target.value as Position | "")
                }
              >
                <option value="">All positions</option>
                {POSITIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="league-field">
              Sort free agents
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="rating">Developed rating</option>
                <option value="fit" disabled={!released}>
                  Replacement fit
                </option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
          <p className="free-agent-count" role="status">
            {candidates.length} of {market.length} available · Position is best
            fit.
          </p>
          {!market.length ? (
            <p className="free-agent-empty">
              No released players are available. Players released in a completed
              rookie draft or signing will appear here.
            </p>
          ) : !candidates.length ? (
            <p className="free-agent-empty">
              No free agents match these filters. Try another name or position.
            </p>
          ) : (
            <ul className="free-agent-list" aria-label="Available free agents">
              {candidates.map((agent) => (
                <li
                  key={agent.pokemonId}
                  className={
                    chosen?.pokemonId === agent.pokemonId ? "selected" : ""
                  }
                >
                  <div className="free-agent-player">
                    <span aria-hidden="true">
                      <Portrait mon={agent.mon} />
                    </span>
                    <div>
                      <strong>{agent.mon.name}</strong>
                      <span>
                        #{String(agent.pokemonId).padStart(3, "0")} ·{" "}
                        {agent.position}
                      </span>
                    </div>
                    <div className="free-agent-rating">
                      <strong>{agent.rating.toFixed(1)}</strong>
                      <small>RATING</small>
                    </div>
                  </div>
                  <p className="free-agent-origin">
                    {clubName(agent.previousTeamId)} · Year {agent.releasedYear}
                    <br />
                    Released after{" "}
                    {agent.releaseSource === "draft"
                      ? "rookie draft"
                      : "free-agent signing"}
                  </p>
                  {released && (
                    <p className="free-agent-fit">
                      {signed(agent.fitChange)} replacement fit · {releasedSlot}
                    </p>
                  )}
                  <div className="free-agent-actions">
                    <button
                      type="button"
                      className="button secondary"
                      aria-label={`Select ${agent.mon.name}`}
                      aria-pressed={chosen?.pokemonId === agent.pokemonId}
                      disabled={disabled}
                      onClick={() => setSelectedId(agent.pokemonId)}
                    >
                      {chosen?.pokemonId === agent.pokemonId
                        ? "Selected"
                        : "Select"}
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      aria-label={`Scout ${agent.mon.name}`}
                      onClick={() => setScoutId(agent.pokemonId)}
                    >
                      Scout
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      aria-label={`View ${agent.mon.name} career`}
                      onClick={() => setCareerId(agent.pokemonId)}
                    >
                      Career
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <section className="free-agent-preview" aria-label="Signing preview">
          <span className="eyebrow">YOUR NEXT MOVE</span>
          <h4>Review the replacement</h4>
          <div className="free-agent-exchange">
            <small>YOU SIGN</small>
            <strong>
              {chosen ? playerName(chosen.pokemonId) : "Select a free agent"}
            </strong>
            {chosen && (
              <span>
                {chosen.position} · {chosen.rating.toFixed(1)} developed rating
              </span>
            )}
          </div>
          <label className="league-field">
            Player to release
            <select
              value={released?.id ?? ""}
              disabled={disabled || !ready}
              onChange={(event) =>
                setReleaseId(
                  event.target.value ? Number(event.target.value) : null,
                )
              }
            >
              <option value="">Choose one of your eight players</option>
              {user &&
                ROSTER_SLOTS.map((slot) => {
                  const id = user.roster[slot];
                  if (id === null) return null;
                  const mon = POKEMON_BY_ID.get(id)!;
                  const development = user.development?.[id];
                  return (
                    <option key={slot} value={id}>
                      {slot} · {mon.name} ·{" "}
                      {positionRating(
                        mon,
                        bestPosition(mon, development),
                        development,
                      ).toFixed(1)}
                    </option>
                  );
                })}
            </select>
          </label>
          <div className="free-agent-exchange outgoing">
            <small>YOU RELEASE</small>
            <strong>{released?.name ?? "No player selected"}</strong>
            {released && (
              <button
                type="button"
                className="text-button"
                onClick={() => setScoutId(released.id)}
              >
                Scout outgoing {released.name}
              </button>
            )}
          </div>
          {evaluation && (
            <div className="free-agent-evaluation" aria-live="polite">
              <p>
                {evaluation.factors ? "Shared team value" : "Team rating"}{" "}
                <strong>
                  {evaluation.teamBefore.toFixed(1)} →{" "}
                  {evaluation.teamAfter.toFixed(1)}
                </strong>
              </p>
              <p>
                Roster fit <strong>{signed(evaluation.fitChange)}</strong>
              </p>
              <p>{evaluation.reason}</p>
              <EvaluationFactors factors={evaluation.factors} />
            </div>
          )}
          <p className="free-agent-note">
            Your roster stays at eight players. The released player joins the
            market and keeps their career history.
          </p>
          <button
            type="button"
            className="button primary"
            disabled={
              disabled ||
              !ready ||
              !chosen ||
              !released ||
              !evaluation?.eligible
            }
            onClick={() => {
              if (
                disabled ||
                !ready ||
                !chosen ||
                !released ||
                !evaluation?.eligible
              )
                return;
              onSign(chosen.pokemonId, released.id);
              setSelectedId(null);
              setReleaseId(null);
            }}
          >
            Sign and release
          </button>
        </section>
      </div>

      {scoutMon && (
        <div
          className="franchise-scout free-agent-scout"
          ref={scoutRef}
          tabIndex={-1}
        >
          <button
            type="button"
            className="text-button"
            onClick={() => setScoutId(null)}
          >
            Close scouting report
          </button>
          <ScoutReport mon={scoutMon} development={scoutDevelopment} />
        </div>
      )}
      {careerId !== null && (
        <CareerDetail
          pokemonId={careerId}
          franchise={franchise}
          run={state.run}
          onClose={() => setCareerId(null)}
        />
      )}

      <section
        className="free-agent-activity"
        aria-label="Free-agency activity"
      >
        <div className="free-agent-heading">
          <h4>Free-agency activity</h4>
          <label className="league-field">
            Free-agency activity year
            <select
              value={viewedYear}
              onChange={(event) => setActivityYear(Number(event.target.value))}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  Year {year}
                  {year === franchise.year ? " · Current" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        {activity.length ? (
          <ol className="free-agent-transactions">
            {activity.map((entry, index) => (
              <li key={`${entry.year}-${index}`}>
                <span className="free-agent-source">
                  {entry.source === "cpu" ? "CPU" : "Your signing"}
                </span>
                <div>
                  <strong>
                    {clubName(entry.teamId)} signs {playerName(entry.pokemonId)}
                  </strong>
                  <p>
                    Released {playerName(entry.releasedId)} · Year {entry.year}
                  </p>
                  <p>{entry.reason}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="free-agent-empty">No signings in year {viewedYear}.</p>
        )}
        {franchise.freeAgency?.cpuYears.includes(viewedYear) && (
          <p className="free-agent-note">
            CPU round finished ·{" "}
            {activity.filter((entry) => entry.source === "cpu").length} signings
            in year {viewedYear}.
          </p>
        )}
      </section>
    </section>
  );
}
