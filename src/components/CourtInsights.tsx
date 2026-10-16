import { useState } from "react";
import type { CourtSequence, ScreenCoverage } from "../game/courtTypes";
import type { LeagueTeam } from "../game/types";
import {
  insightPlayerName as name,
  insightNumber as number,
} from "./insightFormat";
const coverages: ScreenCoverage[] = [
  "drop",
  "switch",
  "hedge",
  "trap",
  "under",
];
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const period = (value: number) => (value <= 4 ? `Q${value}` : `OT${value - 4}`);
const actionLabels = {
  advance: "Bring the ball up",
  screen: "Use a screen",
  drive: "Attack the lane",
  pass: "Pass",
  kickout: "Kick out",
  reset: "Reset the attack",
  shoot: "Shoot",
  turnover: "Lose possession",
  violation: "Shot-clock violation",
  foul: "Foul stops play",
};
export function CourtInsights({
  sequences,
  teams,
}: {
  sequences?: CourtSequence[];
  teams: LeagueTeam[];
}) {
  const [team, setTeam] = useState("all"),
    [coverage, setCoverage] = useState("all"),
    [selected, setSelected] = useState(0);
  if (!sequences?.length)
    return (
      <section className="insight-section">
        <h4>Court positioning and possession chains</h4>
        <p>
          Court positions and action sequences were not recorded for this game.
          Historical results remain unchanged.
        </p>
      </section>
    );
  const teamName = (id: number) =>
    teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
  const filtered = sequences.filter(
    (s) =>
      (team === "all" || s.offenseTeamId === Number(team)) &&
      (coverage === "all" || s.coverage === coverage),
  );
  const index = Math.min(selected, Math.max(0, filtered.length - 1)),
    current = filtered[index];
  const multi = sequences.filter(
    (s) =>
      s.actions.filter((a) =>
        ["screen", "drive", "pass", "kickout", "reset"].includes(a.kind),
      ).length >= 2,
  ).length;
  const late = sequences.filter(
    (s) => s.actions.some((a) => a.kind === "shoot") && s.shotClock <= 4,
  ).length;
  const violations = sequences.filter((s) => s.outcome === "violation").length;
  return (
    <section
      className="insight-section court-insights"
      aria-label="Court positioning and possession chains"
    >
      <h4>Court positioning and possession chains</h4>
      <p>
        Actual simulated locations affect passing lanes, help, closeouts and
        shot quality. Screen coverage is chosen for the players on the floor.
        Each attack below ends in a shot, foul or turnover; an offensive rebound
        starts another attack with 14 seconds. Clocks show the time available
        before either the shot clock or period expires.
      </p>
      <div className="court-metrics">
        <div>
          <strong>{multi}</strong>
          <span>Multi-action attacks</span>
        </div>
        <div>
          <strong>{late}</strong>
          <span>Shots with ≤4 seconds left</span>
        </div>
        <div>
          <strong>{violations}</strong>
          <span>Shot-clock turnovers</span>
        </div>
      </div>
      <div
        className="results-table-wrap"
        role="region"
        tabIndex={0}
        aria-label="Scrollable screen coverage results"
      >
        <table className="results-table">
          <caption className="sr-only">Screen coverage results</caption>
          <thead>
            <tr>
              <th scope="col">DEFENSE</th>
              {coverages.map((c) => (
                <th scope="col" key={c}>
                  {c.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id}>
                <th scope="row">{t.name}</th>
                {coverages.map((c) => (
                  <td key={c}>
                    {
                      sequences.filter(
                        (s) => s.defenseTeamId === t.id && s.coverage === c,
                      ).length
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="insight-note">
        Drop protects the paint; under concedes pull-ups; switch changes
        matchups; hedge must recover; trap commits two defenders and can expose
        a passing outlet. Counts describe choices, not proof that a coverage
        caused a win.
      </p>
      <div className="insight-controls">
        <label>
          Attack team
          <select
            value={team}
            onChange={(e) => {
              setTeam(e.target.value);
              setSelected(0);
            }}
          >
            <option value="all">Both teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Screen coverage
          <select
            value={coverage}
            onChange={(e) => {
              setCoverage(e.target.value);
              setSelected(0);
            }}
          >
            <option value="all">All attacks</option>
            {coverages.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="court-attack-select">
          Recorded attack
          <select
            value={index}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {filtered.map((s, i) => (
              <option key={i} value={i}>
                {period(s.period)} · {clock(s.elapsedSeconds)} elapsed ·{" "}
                {teamName(s.offenseTeamId)} · {s.outcome}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!current ? (
        <p>No recorded attacks match these filters.</p>
      ) : (
        <>
          <div className="court-navigation">
            <button
              type="button"
              className="insight-button"
              disabled={index === 0}
              onClick={() => setSelected(index - 1)}
            >
              Previous attack
            </button>
            <span>
              {index + 1} / {filtered.length}
            </span>
            <button
              type="button"
              className="insight-button"
              disabled={index === filtered.length - 1}
              onClick={() => setSelected(index + 1)}
            >
              Next attack
            </button>
          </div>
          <div className="insight-chart-layout">
            <figure className="insight-shot-figure court-position-figure">
              <svg
                viewBox="0 0 100 100"
                role="img"
                aria-label={`Simulated court positions: ${teamName(current.offenseTeamId)} attacking, ${current.outcome}`}
              >
                <rect
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                  className="court-line"
                />
                <path
                  d="M34,0 V40 H66 V0 M6,0 V15 A47,47 0 0 0 94,15 V0 M44,6 H56"
                  className="court-line"
                />
                <circle cx="50" cy="11.2" r="2.5" className="court-line" />
                {current.positions.map((p, i) => (
                  <g
                    key={p.playerId}
                    className={p.offense ? "court-offense" : "court-defense"}
                  >
                    <title>
                      {name(p.playerId)} · {p.offense ? "Offense" : "Defense"} ·{" "}
                      {number(p.x)} ft across, {number(p.y)} ft from baseline
                    </title>
                    {p.playerId === current.shooterId && (
                      <circle
                        cx={(p.x + 25) * 2}
                        cy={(p.y / 47) * 100}
                        r="4.5"
                        className="court-ball-ring"
                      />
                    )}
                    <circle cx={(p.x + 25) * 2} cy={(p.y / 47) * 100} r="3" />
                    <text x={(p.x + 25) * 2} y={(p.y / 47) * 100 + 1.1}>
                      {(i % 5) + 1}
                    </text>
                  </g>
                ))}
              </svg>
              <figcaption>
                Final positions in this attack. Blue: offense · red: defense ·
                gold ring: ball. Distances use a modeled half court.
              </figcaption>
            </figure>
            <div>
              <strong>
                {name(current.shooterId)} · {current.outcome} · {current.points}{" "}
                points
              </strong>
              <p>
                {number(current.seconds)} seconds used ·{" "}
                {number(current.shotClock)} seconds left to shoot · nearest
                defender {number(current.defenderDistance)} ft away.
              </p>
              {current.coverage && (
                <p>
                  <strong>{current.coverage.toUpperCase()}</strong> —{" "}
                  {current.coverageReason}
                </p>
              )}
              <ol className="court-action-list" aria-label="Possession actions">
                {current.actions.map((a, i) => (
                  <li key={i}>
                    <strong>{actionLabels[a.kind]}</strong>: {name(a.playerId)}
                    {a.targetId ? ` → ${name(a.targetId)}` : ""}
                    <small>{number(a.clock)} seconds left</small>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <ul className="court-player-key" aria-label="Players on court">
            {current.positions.map((p, i) => (
              <li key={p.playerId}>
                <span
                  className={
                    p.offense ? "court-key-offense" : "court-key-defense"
                  }
                >
                  {p.offense ? "O" : "D"}
                  {(i % 5) + 1}
                </span>{" "}
                {name(p.playerId)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
