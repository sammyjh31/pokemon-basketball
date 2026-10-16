import { useCallback, useEffect, useRef, useState } from "react";
import type { ArcadeState } from "../game/arcade/types";
import type { OfficialGame } from "../game/franchiseFeatures";
import { officialGameFromArcade } from "../game/officialGame";
import {
  ROSTER_SLOTS,
  type LeagueFixture,
  type LeagueTeam,
} from "../game/types";
import { POKEMON_BY_ID } from "../data/pokemon";
import { ArcadeControlsGuide, ArcadePortrait } from "./ArcadeSetup";
import { LeagueBoxScore } from "./LeagueBoxScore";

export interface OfficialArcadeProps {
  fixture: LeagueFixture;
  teams: LeagueTeam[];
  label: string;
  onComplete: (game: OfficialGame) => Promise<void>;
}

export function OfficialArcadeSetup({
  official,
  ready,
  error,
  onStart,
  onExit,
}: {
  official: OfficialArcadeProps;
  ready: boolean;
  error: string | null;
  onStart: () => void;
  onExit: () => void;
}) {
  const user = official.teams.find((team) => team.id === 0)!;
  const opponent = official.teams.find(
    (team) =>
      team.id ===
      (official.fixture.homeTeamId === 0
        ? official.fixture.awayTeamId
        : official.fixture.homeTeamId),
  )!;
  return (
    <div className="arcade-setup">
      <div className="arcade-topline">
        <span className="arcade-wordmark">
          POKÉMON <b>HOOPS</b>
        </span>
        <button className="arcade-link" onClick={onExit}>
          ← Back to franchise
        </button>
      </div>
      <header className="arcade-hero">
        <div>
          <p className="arcade-eyebrow">
            {official.label} ·{" "}
            {official.fixture.homeTeamId === 0 ? "HOME" : "AWAY"}
          </p>
          <h1>
            PLAY FOR
            <br />
            <em>YOUR SEASON.</em>
          </h1>
          <p>
            {user.name} vs. {opponent.name}
          </p>
        </div>
        <span className="arcade-tag">OFFICIAL GAME</span>
      </header>
      {error && (
        <p className="arcade-error" role="alert">
          {error}
        </p>
      )}
      <div className="arcade-setup-grid">
        {[user, opponent].map((team) => (
          <section className="arcade-card" key={team.id}>
            <div className="arcade-section-title">
              <h2>{team.name}</h2>
              <span className="arcade-tag">
                {team.id === 0 ? "YOU" : "CPU"}
              </span>
            </div>
            <ul
              className="arcade-lineup"
              aria-label={`${team.name} official roster`}
            >
              {ROSTER_SLOTS.map((slot) => (
                <li key={slot}>
                  <span className="arcade-position">{slot}</span>
                  <ArcadePortrait id={team.roster[slot]!} />
                  <strong>{POKEMON_BY_ID.get(team.roster[slot]!)!.name}</strong>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <section className="arcade-card">
        <h2>One game. Season stakes.</h2>
        <p className="arcade-muted">
          Four one-minute quarters, with 25-second overtimes. Court scores and
          counting stats are multiplied by 12 for your official season box.
          Player minutes total 240 in regulation.
        </p>
        <p className="arcade-session-note">
          The final result records automatically. Leaving or refreshing before
          the final buzzer ends this attempt; the fixture stays pending.
        </p>
        <ArcadeControlsGuide />
        <div className="arcade-result-actions">
          <button
            className="arcade-button arcade-primary"
            onClick={onStart}
            disabled={!ready || !!error}
          >
            Tip off official game
          </button>
          <button className="arcade-button arcade-quiet" onClick={onExit}>
            Back to franchise
          </button>
        </div>
        {!ready && <p role="status">Preparing the court…</p>}
      </section>
    </div>
  );
}

export function OfficialArcadeResults({
  state,
  official,
  onExit,
}: {
  state: ArcadeState;
  official: OfficialArcadeProps;
  onExit: () => void;
}) {
  const [converted] = useState(() => {
    try {
      return {
        game: officialGameFromArcade(state, official.fixture, official.teams),
        error: "",
      };
    } catch (error) {
      return {
        game: undefined,
        error:
          error instanceof Error
            ? error.message
            : "This final result could not be verified.",
      };
    }
  });
  const [status, setStatus] = useState<"saving" | "saved" | "failed">(
    converted.game ? "saving" : "failed",
  );
  const [error, setError] = useState(converted.error);
  const [showBox, setShowBox] = useState(false);
  const attempted = useRef(false),
    inFlight = useRef(false),
    saved = useRef(false);
  const save = useCallback(async () => {
    if (!converted.game || inFlight.current || saved.current) return;
    inFlight.current = true;
    setStatus("saving");
    setError("");
    try {
      await official.onComplete(converted.game);
      saved.current = true;
      setStatus("saved");
    } catch (failure) {
      setStatus("failed");
      setError(
        failure instanceof Error
          ? failure.message
          : "The result could not be saved. Retry to keep this game.",
      );
    } finally {
      inFlight.current = false;
    }
  }, [converted.game, official.onComplete]);
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    void save();
  }, [save]);
  const home = official.teams.find(
    (team) => team.id === official.fixture.homeTeamId,
  )!;
  const away = official.teams.find(
    (team) => team.id === official.fixture.awayTeamId,
  )!;
  const game = converted.game;
  return (
    <div className="arcade-results">
      <div className="arcade-topline">
        <span className="arcade-wordmark">
          POKÉMON <b>HOOPS</b>
        </span>
        <span className="arcade-tag">OFFICIAL FINAL</span>
      </div>
      <header className="arcade-final-heading">
        <p className="arcade-eyebrow">{official.label}</p>
        <h1>
          {state.score[0] > state.score[1]
            ? "THAT’S YOUR GAME."
            : "ON TO THE NEXT."}
        </h1>
        {game && (
          <>
            <p>Official season score</p>
            <div className="arcade-final-score">
              <div>
                <span>{home.name}</span>
                <strong>{game.match.homeScore}</strong>
              </div>
              <span>—</span>
              <div>
                <span>{away.name}</span>
                <strong>{game.match.awayScore}</strong>
              </div>
            </div>
            <p>
              Court score: {game.courtScore[0]}–{game.courtScore[1]} ·{" "}
              {home.name} / {away.name} · Official scores and counting stats
              ×12.
            </p>
          </>
        )}
      </header>
      {error && (
        <p role="alert" className="arcade-error">
          {error}
        </p>
      )}
      <p role="status" className="arcade-session-note">
        {status === "saving"
          ? "Recording this game in your franchise…"
          : status === "saved"
            ? "Official result recorded. Your franchise is ready to continue."
            : game
              ? "This result has not been recorded. Keep this screen open to retry."
              : "This final could not be verified. The scheduled fixture remains pending."}
      </p>
      <div className="arcade-result-actions">
        {game ? (
          <>
            <button
              className="arcade-button arcade-primary"
              disabled={status !== "saved"}
              onClick={onExit}
            >
              Continue to franchise
            </button>
            {status === "failed" && (
              <button className="arcade-button" onClick={() => void save()}>
                Retry saving result
              </button>
            )}
            <button
              className="arcade-button arcade-quiet"
              onClick={() => setShowBox(true)}
            >
              View official box score
            </button>
          </>
        ) : (
          <button className="arcade-button" onClick={onExit}>
            Back to franchise
          </button>
        )}
      </div>
      {showBox && game && (
        <LeagueBoxScore
          game={{
            ...official.fixture,
            homeScore: game.match.homeScore,
            awayScore: game.match.awayScore,
            overtimePeriods: game.match.overtimePeriods,
          }}
          teams={official.teams}
          contextLabel={`${official.label} · Official box score`}
          match={game.match}
          onClose={() => setShowBox(false)}
        />
      )}
    </div>
  );
}
