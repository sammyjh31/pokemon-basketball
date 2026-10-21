import type { CSSProperties } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import type { rankLocalManagers } from "../game/localLeague";
import {
  BENCH_SLOTS,
  POSITIONS,
  type LeagueTeam,
  type Roster,
  type RosterSlot,
} from "../game/types";
import { Portrait, TYPE_COLORS } from "./Portrait";

/** The actual roster, using the same half-court geometry as the solo lineup. */
export function DraftRosterBoard({
  roster,
  lockedSlots,
}: {
  roster: Roster;
  lockedSlots: readonly RosterSlot[];
}) {
  return (
    <div className="draft-roster-board">
      <div className="roster-court">
        <svg
          className="roster-court-lines"
          viewBox="0 0 600 450"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M22 0v424h556V0M215 0v160h170V0M215 160a85 85 0 0 0 170 0M215 160a85 85 0 0 1 170 0" />
          <path d="M54 0v48a246 246 0 0 0 492 0V0M245 424a55 55 0 0 1 110 0" />
          <path d="M270 25h60M300 25v9" />
          <ellipse cx="300" cy="44" rx="17" ry="9" />
        </svg>
        <ol aria-label="Your starting five" className="roster-court-five">
          {POSITIONS.map((slot) => {
            const mon = POKEMON_BY_ID.get(roster[slot] ?? -1);
            return (
              <li
                key={slot}
                className={`roster-court-player slot-${slot} ${mon ? "is-filled" : "is-empty"}`}
              >
                <b>{slot}</b>
                {mon && <Portrait key={mon.id} mon={mon} />}
                <span>{mon?.name ?? "Open"}</span>
                {lockedSlots.includes(slot) && <small>Locked</small>}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="roster-bench-label">
        <span>THE BENCH</span>
        <span>3 reserves</span>
      </div>
      <ol aria-label="Your reserves" className="roster-bench">
        {BENCH_SLOTS.map((slot) => {
          const mon = POKEMON_BY_ID.get(roster[slot] ?? -1);
          return (
            <li key={slot}>
              <b>{slot}</b>
              {mon && <Portrait key={mon.id} mon={mon} />}
              <span>{mon?.name ?? "Open"}</span>
              {lockedSlots.includes(slot) && <small>Locked</small>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function LeagueHeroArt({ ids }: { ids: number[] }) {
  return (
    <div className="league-hero-art" aria-hidden="true">
      {ids.slice(0, 3).map((id, index) => {
        const mon = POKEMON_BY_ID.get(id);
        return mon ? (
          <Portrait
            key={id}
            mon={mon}
            className={`hero-player hero-player-${index}`}
          />
        ) : null;
      })}
    </div>
  );
}

export function LeagueFriendCards({
  rankings,
  teams,
}: {
  rankings: ReturnType<typeof rankLocalManagers>;
  teams: LeagueTeam[];
}) {
  return (
    <div className="league-friend-cards">
      {rankings.map(({ manager, standing, leagueRank }, index) => {
        const team = teams.find((t) => t.id === manager.teamId)!;
        const mons = POSITIONS.flatMap((slot) => {
          const mon = POKEMON_BY_ID.get(team.roster[slot] ?? -1);
          return mon ? [mon] : [];
        });
        const games = standing.wins + standing.losses;
        const rate = games ? (standing.wins / games) * 100 : 0;
        const color = TYPE_COLORS[mons[0]?.types[0] ?? "water"];
        return (
          <article
            className={`league-friend-card ${index === 0 ? "is-leading" : ""}`}
            aria-label={`${manager.name} season summary`}
            key={manager.teamId}
            style={{ "--club-color": color } as CSSProperties}
          >
            <div className="friend-card-top">
              <span>
                {index === 0 ? "FRIENDS LEADER" : `FRIEND RANK ${index + 1}`}
              </span>
              <b>#{leagueRank} in league</b>
            </div>
            <div className="friend-card-players">
              {mons.slice(0, 3).map((mon) => (
                <Portrait key={mon.id} mon={mon} />
              ))}
            </div>
            <div className="friend-card-identity">
              <h3>{manager.name}</h3>
              <p>{team.name}</p>
            </div>
            <div className="friend-card-record">
              <strong>
                {standing.wins}
                <small>W</small>
              </strong>
              <span>—</span>
              <strong>
                {standing.losses}
                <small>L</small>
              </strong>
            </div>
            <div className="friend-card-rate">
              <span>WIN RATE</span>
              <b>{rate.toFixed(1)}%</b>
            </div>
            <meter
              min={0}
              max={games || 1}
              value={standing.wins}
              aria-label={`${manager.name} win rate`}
            />
          </article>
        );
      })}
    </div>
  );
}
