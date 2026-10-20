import { publicAsset } from "../assets";
import { teamsWithMastery } from "../game/abilityMastery";
import { currentMasteryBanks } from "../game/currentMastery";
import { currentChemistryBanks } from "../game/currentChemistry";
import { teamsWithChemistry } from "../game/teammateChemistry";
import { currentMoraleBanks } from "../game/currentMorale";
import { teamsWithMorale } from "../game/playerMorale";
import { useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import { createLeague } from "../game/league";
import { validRoster } from "../game/lineup";
import {
  BENCH_SLOTS,
  POSITIONS,
  ROSTER_SLOTS,
  type LeagueTeam,
  type Roster,
  type Run,
} from "../game/types";

export function prepareArcadeTeams(run: Run): {
  teams: LeagueTeam[];
  error: string | null;
} {
  const missing = ROSTER_SLOTS.filter((slot) => run.roster[slot] == null);
  if (missing.length)
    return {
      teams: [],
      error: `Fill ${missing.join(", ")} before tipoff. Arcade needs five starters and three reserves. Return to your roster to complete an eight-player draft.`,
    };
  if (!validRoster(run.roster, run.includeLegends, 1025))
    return {
      teams: [],
      error:
        "Your roster needs eight distinct Pokémon. Return to the roster and review your lineup.",
    };
  try {
    const existing =
      run.leagueTeams ??
      run.result?.league?.teams ??
      run.seasonProgress?.result?.league?.teams;
    if (existing?.some((team) => team.id !== 0)) {
      const used = new Set(Object.values(run.roster));
      const valid = existing.every((team) => {
        if (team.id === 0) return true;
        if (
          !validRoster(team.roster, true, 1025) ||
          ROSTER_SLOTS.some((slot) => team.roster[slot] == null)
        )
          return false;
        for (const id of Object.values(team.roster)) {
          if (used.has(id)) return false;
          used.add(id);
        }
        return true;
      });
      if (valid)
        return {
          teams: teamsWithMastery(
            teamsWithMorale(
              teamsWithChemistry(existing, currentChemistryBanks(run)),
              currentMoraleBanks(run),
            ),
            currentMasteryBanks(run),
          ),
          error: null,
        };
    }
    return {
      teams: teamsWithMastery(
        teamsWithMorale(
          teamsWithChemistry(createLeague(run), currentChemistryBanks(run)),
          currentMoraleBanks(run),
        ),
        currentMasteryBanks(run),
      ),
      error: null,
    };
  } catch (error) {
    return {
      teams: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to prepare opponents. Return to your roster and try again.",
    };
  }
}

export function ArcadePortrait({
  id,
  className = "",
}: {
  id: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const mon = POKEMON_BY_ID.get(id);
  return failed ? (
    <span
      className={`arcade-sprite arcade-sprite-fallback ${className}`}
      aria-label={mon?.name ?? "Pokémon"}
    >
      #{id}
    </span>
  ) : (
    <img
      className={`arcade-sprite ${className}`}
      src={publicAsset(`/pokemon-pixel/${id}.png`)}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

export function ArcadeControlsGuide() {
  return (
    <div className="arcade-guide">
      <div>
        <kbd>WASD / LS</kbd>
        <span>Move · Left stick, D-pad or arrow keys</span>
      </div>
      <div>
        <kbd>J / X</kbd>
        <span>Hold + release to shoot · Jump / block</span>
      </div>
      <div>
        <kbd>K / A</kbd>
        <span>Pass toward movement · Steal on defense</span>
      </div>
      <div>
        <kbd>L / B</kbd>
        <span>Choose receiver · Switch defender</span>
      </div>
      <div>
        <kbd>SHIFT / RT</kbd>
        <span>Turbo · At the rim, hold + release Shoot to dunk</span>
      </div>
      <div>
        <kbd>ESC / Menu</kbd>
        <span>Pause · Manage your bench</span>
      </div>
      <div>
        <kbd>PAD MENUS</kbd>
        <span>
          Stick/D-pad to navigate · A select · B back in dialogs · Left/right to
          change options
        </span>
      </div>
    </div>
  );
}

export function ArcadeSetupScreen({
  roster,
  teams,
  error,
  opponentId,
  onOpponent,
  ready,
  onStart,
  onExit,
}: {
  roster: Roster;
  teams: LeagueTeam[];
  error: string | null;
  opponentId: number;
  onOpponent: (id: number) => void;
  ready: boolean;
  onStart: () => void;
  onExit: () => void;
}) {
  const opponent = teams.find((team) => team.id === opponentId);
  const lineup = (slots: readonly (keyof Roster)[], label: string) => (
    <ul className="arcade-lineup" aria-label={label}>
      {slots.map((slot) => {
        const id = roster[slot],
          mon = id == null ? undefined : POKEMON_BY_ID.get(id);
        return (
          <li key={slot}>
            <span className="arcade-position">{slot}</span>
            {mon ? (
              <>
                <ArcadePortrait id={mon.id} />
                <strong>{mon.name}</strong>
                <span>{mon.types[0]}</span>
              </>
            ) : (
              <>
                <span className="arcade-empty-player">?</span>
                <strong>Open spot</strong>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
  return (
    <div className="arcade-setup">
      <div className="arcade-topline">
        <span className="arcade-wordmark">
          POKÉMON <b>HOOPS</b>
        </span>
        <button className="arcade-link" onClick={onExit}>
          ← Back to roster
        </button>
      </div>
      <header className="arcade-hero">
        <div>
          <p className="arcade-eyebrow">EXHIBITION / LOCAL ARCADE</p>
          <h1>
            YOUR FIVE.
            <br />
            <em>FULL COURT.</em>
          </h1>
          <p>Take your drafted team off the page and onto the hardwood.</p>
        </div>
        <div className="arcade-badge" aria-label="Five on five">
          <span>5</span>
          <small>ON</small>
          <span>5</span>
        </div>
      </header>
      {error && (
        <p className="arcade-error" role="alert">
          {error}
        </p>
      )}
      <div className="arcade-setup-grid">
        <section className="arcade-card arcade-roster-card">
          <div className="arcade-section-title">
            <h2>Your starting five</h2>
            <span className="arcade-tag">YOU</span>
          </div>
          {lineup(POSITIONS, "Starting five")}
          <h3>The bench</h3>
          {lineup(BENCH_SLOTS, "Your bench")}
        </section>
        <section className="arcade-card arcade-matchup">
          <p className="arcade-eyebrow">NEXT ON THE COURT</p>
          <h2>Pick your opponent</h2>
          <label htmlFor="arcade-opponent">CPU team</label>
          <select
            id="arcade-opponent"
            value={opponentId}
            onChange={(event) => onOpponent(Number(event.target.value))}
            disabled={!teams.length}
          >
            {teams
              .filter((team) => team.id !== 0)
              .map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
          </select>
          <div
            className="arcade-opponent-lineup"
            aria-label="Opponent starting five"
          >
            {opponent &&
              POSITIONS.map((slot) => {
                const id = opponent.roster[slot];
                return id !== null ? (
                  <div key={slot}>
                    <ArcadePortrait id={id} />
                    <span>{POKEMON_BY_ID.get(id)?.name}</span>
                  </div>
                ) : null;
              })}
          </div>
          <div className="arcade-rules">
            <span>
              <b>4 × 1:00</b>QUARTERS
            </span>
            <span>
              <b>14 SEC</b>SHOT CLOCK
            </span>
            <span>
              <b>5 + 3</b>ROSTER
            </span>
          </div>
          <p className="arcade-muted">
            Balanced offense. Man-to-man defense. No fouls, just hoops.
          </p>
          <button
            className="arcade-button arcade-primary arcade-tipoff"
            disabled={!ready || !!error || !opponent}
            onClick={onStart}
          >
            TIP OFF <span aria-hidden="true">↗</span>
          </button>
          {!ready && !error && (
            <p className="arcade-loading" role="status">
              Getting the court ready…
            </p>
          )}
          <p className="arcade-session-note">
            Exhibition only. Match progress ends when you leave or refresh. Your
            season stays saved.
          </p>
        </section>
      </div>
      <section className="arcade-card arcade-playbook">
        <div>
          <p className="arcade-eyebrow">QUICK PLAYBOOK</p>
          <h2>Make your next move.</h2>
          <p className="arcade-muted">
            Touch controls are on court. Landscape gives you the most room.
          </p>
        </div>
        <ArcadeControlsGuide />
      </section>
    </div>
  );
}
