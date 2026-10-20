import { POKEMON_BY_ID } from "../data/pokemon";
import type { LeaguePlayer, LeagueTeam } from "../game/types";
import { ROSTER_SLOTS } from "../game/types";
import { getCoach } from "../game/trainerCoaches";
import { Portrait } from "./Portrait";
import { CoachPortrait } from "./CoachPortrait";
import { publicAsset } from "../assets";
import { scrollToGameSection } from "./KantoShell";
import { ArrowRight } from "pixelarticons/react/ArrowRight.js";

type HubPlayer = Pick<
  LeaguePlayer,
  | "playerId"
  | "pokemonId"
  | "teamId"
  | "gamesPlayed"
  | "points"
  | "offensiveRebounds"
  | "defensiveRebounds"
  | "assists"
>;
export function KantoSeasonHub({
  team,
  players,
  wins,
  losses,
  rank,
  playoffsAvailable,
  id,
}: {
  team: LeagueTeam;
  players: HubPlayer[];
  wins: number;
  losses: number;
  rank: number | null;
  playoffsAvailable: boolean;
  id?: string;
}) {
  const played = players.filter(
    (p) => p.teamId === team.id && p.gamesPlayed > 0,
  );
  const categories = [
    {
      name: "Scoring leader",
      label: "PPG",
      value: (p: HubPlayer) => p.points / p.gamesPlayed,
    },
    {
      name: "Rebounding leader",
      label: "RPG",
      value: (p: HubPlayer) =>
        (p.offensiveRebounds + p.defensiveRebounds) / p.gamesPlayed,
    },
    {
      name: "Assists leader",
      label: "APG",
      value: (p: HubPlayer) => p.assists / p.gamesPlayed,
    },
  ];
  const leaders = categories.flatMap((category) => {
    const player = [...played].sort(
      (a, b) =>
        category.value(b) - category.value(a) ||
        a.playerId.localeCompare(b.playerId),
    )[0];
    return player ? [{ ...category, player }] : [];
  });
  const starId =
    leaders[0]?.player.pokemonId ?? team.roster.SG ?? team.roster.PG;
  const star = POKEMON_BY_ID.get(starId ?? -1);
  const coach = team.coach ? getCoach(team.coach.id) : undefined;
  return (
    <section
      className="kanto-season-hub"
      aria-label={`${team.name} season hub`}
      id={id}
    >
      <div className="kanto-season-feature">
        <div className="kanto-season-copy">
          <span className="eyebrow">YOUR SEASON. YOUR STORY.</span>
          <h2>{team.name}</h2>
          <div className="kanto-coach-record">
            {coach && (
              <div className="kanto-coach">
                <CoachPortrait coach={coach} />
                <span>
                  HEAD COACH<strong>{coach.name}</strong>
                </span>
              </div>
            )}
            <div className="kanto-record" aria-label="Season record">
              <div>
                <span>WINS</span>
                <strong>{wins}</strong>
              </div>
              <div>
                <span>LOSSES</span>
                <strong>{losses}</strong>
              </div>
              {rank !== null && (
                <div>
                  <span>LEAGUE RANK</span>
                  <strong>#{rank}</strong>
                </div>
              )}
            </div>
          </div>
          {playoffsAvailable ? (
            <button
              type="button"
              className="button primary kanto-playoffs-link"
              onClick={() => scrollToGameSection("playoffs")}
            >
              <ArrowRight aria-hidden="true" /> View playoffs
            </button>
          ) : (
            <p className="kanto-dialogue">
              Your next chapter begins on the court.
            </p>
          )}
        </div>
        <div className="kanto-season-art" aria-hidden="true">
          <img
            className="kanto-arena"
            src={publicAsset("/visual/kanto-arena.png")}
            alt=""
          />
          {star && <Portrait mon={star} className="kanto-star" />}
        </div>
      </div>
      {leaders.length > 0 && (
        <section className="kanto-leaders" aria-label="Team leaders">
          <h3>Team leaders</h3>
          <div className="kanto-leader-grid">
            {leaders.map(({ name, label, value, player }) => {
              const mon = POKEMON_BY_ID.get(player.pokemonId);
              const slot = ROSTER_SLOTS.find(
                (s) => team.roster[s] === player.pokemonId,
              );
              return (
                <article aria-label={name} key={label}>
                  <div className="kanto-leader-heading">
                    <span>{slot ?? "—"}</span>
                    <h4>{mon?.name ?? `#${player.pokemonId}`}</h4>
                  </div>
                  <div className="kanto-leader-body">
                    {mon && <Portrait mon={mon} />}
                    <div>
                      <strong>{value(player).toFixed(1)}</strong>
                      <span>{label}</span>
                      <small>{name}</small>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <div className="kanto-roster-strip">
        <div>
          <h3>Roster</h3>
          <span>{team.name}</span>
        </div>
        <ol aria-label="Team roster">
          {ROSTER_SLOTS.map((slot) => {
            const mon = POKEMON_BY_ID.get(team.roster[slot] ?? -1);
            return (
              <li key={slot}>
                {mon && <Portrait mon={mon} />}
                <strong>{mon?.name ?? "Open"}</strong>
                <span>{slot}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
