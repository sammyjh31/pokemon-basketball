import { POKEMON_BY_ID } from "../data/pokemon";
import {
  moraleAssessment,
  type MoraleAssessment,
  type MoraleGameReport,
  type MoralePlayerReport,
} from "../game/playerMorale";
import { teamLeadership, type TeamLeadership } from "../game/playerPersonality";
import { PersonalityDetails } from "./PersonalityDetails";
import { ROSTER_SLOTS, type LeagueTeam } from "../game/types";
import "../morale.css";

const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
function CaptainSummary({ captain }: { captain?: TeamLeadership }) {
  if (!captain) return null;
  return (
    <div className="morale-captain">
      <div className="morale-player-heading">
        <strong>
          Appointed captain:{" "}
          {POKEMON_BY_ID.get(captain.captainId)?.name ??
            `Pokémon ${captain.captainId}`}
        </strong>
        <span>{captain.style}</span>
      </div>
      <p>
        Chosen automatically from the whole roster. Leadership supplies{" "}
        {signed(captain.moraleSupport)} morale target support before each
        teammate’s response, capped at ±3; the captain never boosts their own
        morale.
      </p>
      <p>
        On court: {signed(captain.cohesionBonus)} cohesion points only while the
        captain is in the active five.
      </p>
      <details>
        <summary>Why this captain?</summary>
        <ul className="morale-reasons">
          {captain.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
function MoraleRows({
  rows,
  historical = false,
}: {
  rows: (MoraleAssessment | MoralePlayerReport)[];
  historical?: boolean;
}) {
  return (
    <ul className="morale-roster">
      {rows.map((row) => (
        <li className="morale-player" key={row.pokemonId}>
          <div className="morale-player-heading">
            <strong>
              {POKEMON_BY_ID.get(row.pokemonId)?.name ??
                `Pokémon ${row.pokemonId}`}
            </strong>
            <span
              className={`morale-status morale-${row.score < 40 ? "low" : row.score >= 65 ? "high" : "steady"}`}
            >
              {row.status} <b>{row.score.toFixed(0)} / 100</b>
            </span>
          </div>
          {historical && "before" in row && (
            <p className="morale-game-change">
              This game: {row.before.toFixed(1)} → {row.after.toFixed(1)}{" "}
              <strong>({signed(row.after - row.before)})</strong>
            </p>
          )}
          <p className="morale-response">
            <strong>Automatic response:</strong> {row.actionLabel}
          </p>
          {row.personality && (
            <div className="morale-personality-summary">
              <strong>{row.personality.archetype}</strong> ·{" "}
              {row.personality.leadershipStyle}
            </div>
          )}
          <details>
            <summary>
              Morale factors ·{" "}
              {POKEMON_BY_ID.get(row.pokemonId)?.name ?? row.pokemonId}
            </summary>
            <dl className="morale-factors">
              <div>
                <dt>Expected minutes</dt>
                <dd>{row.expectedMinutes.toFixed(0)} per game</dd>
              </div>
              <div>
                <dt>Recent minutes</dt>
                <dd>{row.recentMinutes.toFixed(1)} per game</dd>
              </div>
              <div>
                <dt>Coach fit</dt>
                <dd>{row.fit.toFixed(0)} / 100</dd>
              </div>
              <div>
                <dt>Recent team success</dt>
                <dd>{row.success.toFixed(0)}%</dd>
              </div>
              <div>
                <dt>Transition</dt>
                <dd>{signed(row.disruption)}</dd>
              </div>
              <div>
                <dt>Temporary execution</dt>
                <dd>{signed(row.skillDelta)} skill points</dd>
              </div>
            </dl>
            {row.personality && (
              <PersonalityDetails personality={row.personality} />
            )}
            {row.coachCompatibility !== undefined && (
              <p>
                Personality compatibility with coach:{" "}
                {row.coachCompatibility.toFixed(0)} / 100.
              </p>
            )}
            {row.captainSupport !== undefined && (
              <p>
                Captain influence: {signed(row.captainSupport)} morale target
                points
                {row.captainId === row.pokemonId
                  ? " (captain does not self-boost)"
                  : ""}
                .
              </p>
            )}
            <p>
              Rotation support: {signed(row.minuteAdjustment)} target minutes
              before balancing the team’s 240-minute budget.
            </p>
            <ul className="morale-reasons">
              {row.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}

export function MoralePanel({ team }: { team: LeagueTeam }) {
  if (team.moraleVersion !== 1) return null;
  const captain = teamLeadership(team);
  const rows = ROSTER_SLOTS.flatMap((slot) =>
    team.roster[slot] == null
      ? []
      : [moraleAssessment(team, team.roster[slot]!, captain)],
  );
  if (!rows.length) return null;
  return (
    <section className="morale-panel" aria-label="Player morale">
      <div className="morale-heading">
        <h3>Player morale</h3>
        <span>Managed automatically</span>
      </div>
      <p>
        Minutes, team results, roster changes and coach fit shape confidence
        over time. Morale affects temporary execution by up to 3 skill points
        and the active five’s cohesion by up to 4 points. Base ratings and
        permanent development stay unchanged.
      </p>
      <p className="morale-note">
        Role expectations follow developed talent
        {team.personalityVersion === 1 ? " and ambition" : ""}. Recent minutes
        and results are weighted across games; overtime minutes are normalized.
        Your coach balances support, opportunities and recovery.
      </p>
      <CaptainSummary captain={captain} />
      <MoraleRows rows={rows} />
    </section>
  );
}

export function GameMoraleReport({
  report,
  home,
  away,
}: {
  report?: MoraleGameReport;
  home: LeagueTeam;
  away: LeagueTeam;
}) {
  if (!report) return null;
  return (
    <section
      className="morale-panel morale-game"
      aria-label="Game morale report"
    >
      <h3>Morale through this game</h3>
      <p>
        Pregame factors and automatic responses are frozen for this fixture. The
        before → after scores include this result and actual playing time; they
        describe this game’s history.
      </p>
      {[
        { team: away, rows: report.away, captain: report.captains?.away },
        { team: home, rows: report.home, captain: report.captains?.home },
      ].map(({ team, rows, captain }) => (
        <details key={team.id}>
          <summary>{team.name} · Morale changes</summary>
          <CaptainSummary captain={captain} />
          <MoraleRows rows={rows} historical />
        </details>
      ))}
    </section>
  );
}
