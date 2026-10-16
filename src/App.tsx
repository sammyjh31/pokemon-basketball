import { RotationEditor } from "./components/RotationEditor";
import { FranchiseSchedule } from "./components/FranchiseSchedule";
import { nextFranchiseFixture } from "./game/interactiveSeason";
import { nextUserPlayoffFixture } from "./game/playoffs";
import { seasonTeams } from "./game/season";
import type { OfficialArcadeProps } from "./components/ArcadeMode";
import { lazy, Suspense, useState, useMemo } from "react";
import { POKEMON_BY_ID } from "./data/pokemon";
import { teamRatings } from "./game/ratings";
import { teamRatings as legacyTeamRatings } from "./game/legacyRatings";
import type { GameState, Mode, RosterSlot } from "./game/types";
import type { StorageLike } from "./game/persistence";
import { useGame, newSeed } from "./hooks/useGame";
import { Scoreboard } from "./components/Scoreboard";
import { Court } from "./components/Court";
import { DraftPanel } from "./components/DraftPanel";
import { SeasonPanel } from "./components/SeasonPanel";
import { RulesPanel } from "./components/RulesPanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { LineupTools } from "./components/LineupTools";
import { SpriteContext, type SpriteStyle } from "./components/SpriteControls";
import { BenchPanel } from "./components/BenchPanel";
import { emptyRoster } from "./game/types";
import { randomLineup } from "./game/lineup";
import { FranchisePanel } from "./components/FranchisePanel";
const ArcadeMode = lazy(() =>
  import("./components/ArcadeMode").then((m) => ({ default: m.ArcadeMode })),
);

export default function App({
  initial,
  storage,
}: {
  initial?: GameState;
  storage?: StorageLike;
}) {
  const {
      state,
      dispatch,
      storageNotice,
      importPending,
      resolveImport,
      simulate,
      advanceSeason,
      recordPlayoffGame,
      retrySave,
      simulating,
      progress,
      advancePlayoffs,
      playoffSimulating,
      playoffProgress,
      simulationError,
      restoring,
      restorationProgress,
    } = useGame(initial, storage),
    { run, records } = state;
  const [arcadeOpen, setArcadeOpen] = useState(false);
  const [officialGame, setOfficialGame] = useState<OfficialArcadeProps | null>(
    null,
  );
  const [pending, setPending] = useState<number | null>(null),
    [swap, setSwap] = useState<RosterSlot | null>(null);
  const [reset, setReset] = useState<{
    mode: Mode;
    includeLegends: boolean;
  } | null>(null);
  const [animatedRun, setAnimatedRun] = useState<string | null>(null),
    [announcement, setAnnouncement] = useState("");
  const archived = !!run.result && (run.result.modelVersion ?? 1) < 2;
  const development = run.leagueTeams?.[0].development;
  const ratings = archived
    ? legacyTeamRatings(run.roster)
    : teamRatings(
        run.roster,
        run.tactic,
        run.rotation,
        development,
        run.rotationPlan,
      );
  const [spriteStyle, setSpriteStyle] = useState<SpriteStyle>("pixel");
  const start = (mode: Mode, includeLegends: boolean) => {
    if (simulating || playoffSimulating || restoring) return;
    dispatch({ type: "NEW_RUN", mode, includeLegends, seed: newSeed() });
    setPending(null);
    setSwap(null);
    setReset(null);
    setAnimatedRun(null);
    setAnnouncement("New draft started. Pick your first Pokémon.");
  };
  const requestReset = (mode: Mode, includeLegends: boolean) => {
    if (simulating || playoffSimulating || restoring) return;
    if (
      Object.values(run.roster).some((id) => id != null) ||
      run.rerollsLeft < 2
    )
      setReset({ mode, includeLegends });
    else start(mode, includeLegends);
  };
  const onSlot = (position: RosterSlot) => {
    if (
      run.result ||
      (run.seasonProgress?.completedRounds ?? 0) > 0 ||
      simulating ||
      playoffSimulating ||
      restoring
    )
      return;
    if (pending !== null) {
      if (run.mode === "spin" && run.roster[position] !== null) return;
      dispatch({ type: "PLACE", pokemonId: pending, position });
      setAnnouncement(
        `${POKEMON_BY_ID.get(pending)!.name} placed at ${position}.`,
      );
      setPending(null);
      setSwap(null);
      return;
    }
    if (run.mode === "free" || state.franchise) {
      if (swap) {
        dispatch({ type: "SWAP", first: swap, second: position });
        setSwap(null);
        setAnnouncement("Positions updated.");
      } else if (run.roster[position]) setSwap(position);
    }
  };
  // Offseason trades live in the franchise; the completed run stays archived.
  const arcadeRun =
    state.franchise?.phase === "offseason"
      ? {
          ...run,
          roster: state.franchise.teams[0].roster,
          leagueTeams: state.franchise.teams,
        }
      : run;
  const playoffFixture = useMemo(
    () =>
      state.franchise?.phase === "season" && run.result?.league
        ? nextUserPlayoffFixture(
            run.result.league,
            run.seasonSeed,
            run.playoffs,
          )
        : null,
    [state.franchise?.phase, run.result?.league, run.seasonSeed, run.playoffs],
  );
  const openOfficialGame = () => {
    if (
      simulating ||
      playoffSimulating ||
      restoring ||
      state.franchise?.phase !== "season"
    )
      return;
    const source = run;
    const league = run.result?.league;
    const fixture = league ? playoffFixture : nextFranchiseFixture(run);
    if (!fixture) return;
    setOfficialGame({
      fixture,
      teams: league?.teams ?? seasonTeams(run),
      label: `Year ${state.franchise.year} · ${league ? "Playoffs" : `Game ${(run.seasonProgress?.completedRounds ?? 0) + 1} of 82`}`,
      onComplete: (game) =>
        league
          ? recordPlayoffGame(game, source)
          : advanceSeason(1, game, source),
    });
    setArcadeOpen(true);
  };
  if (arcadeOpen)
    return (
      <Suspense
        fallback={
          <main className="app-shell">
            <p role="status">Opening the arcade…</p>
          </main>
        }
      >
        {storageNotice && (
          <p className="notice" role="status">
            {storageNotice}{" "}
            {retrySave && (
              <button className="text-button" onClick={retrySave}>
                Retry saving
              </button>
            )}
          </p>
        )}
        <ArcadeMode
          run={arcadeRun}
          official={officialGame ?? undefined}
          onExit={() => {
            setArcadeOpen(false);
            setOfficialGame(null);
          }}
        />
      </Suspense>
    );
  const franchisePanel = (
    <FranchisePanel
      state={state}
      disabled={simulating || playoffSimulating || restoring}
      onProcessOffseason={() => {
        dispatch({ type: "PROCESS_OFFSEASON" });
        setAnnouncement(
          "Player development and league trades are complete. Review the offseason report before starting the next season.",
        );
      }}
      onEnterOffseason={() => {
        dispatch({ type: "ENTER_OFFSEASON" });
        setAnnouncement(
          `Year ${state.franchise?.year ?? 1} archived. Player development and league trades are complete.`,
        );
      }}
      onStartSeason={() => {
        dispatch({ type: "START_FRANCHISE_SEASON", seed: newSeed() });
        setPending(null);
        setSwap(null);
        setAnimatedRun(null);
        setAnnouncement(
          "Your next franchise season is ready. Set your rotation and coaching before tipoff.",
        );
      }}
      onTraining={(plans) => dispatch({ type: "TRAINING_PLANS", plans })}
      onTrade={(teamId, giveId, receiveId) =>
        dispatch({ type: "TRADE", teamId, giveId, receiveId })
      }
    />
  );
  return (
    <SpriteContext.Provider value={spriteStyle}>
      <a
        className="skip-link"
        href={state.franchise && !restoring ? "#franchise" : "#draft"}
      >
        {state.franchise && !restoring ? "Skip to franchise" : "Skip to draft"}
      </a>
      <div className="app-shell">
        <Scoreboard
          mode={run.mode}
          disabled={
            simulating || playoffSimulating || restoring || !!state.franchise
          }
          onMode={(mode) => {
            if (mode !== run.mode) requestReset(mode, run.includeLegends);
          }}
        />
        <main aria-busy={restoring}>
          {storageNotice && (
            <p className="notice" role="status">
              {storageNotice}{" "}
              {retrySave && (
                <button className="text-button" onClick={retrySave}>
                  Retry saving
                </button>
              )}
            </p>
          )}
          {restoring ? (
            <section
              className="season-panel"
              id="draft"
              aria-labelledby="restoration-title"
            >
              <span className="eyebrow">WELCOME BACK</span>
              <h1 id="restoration-title">Restoring your league</h1>
              <p>
                Your saved season is being verified. Your original save stays in
                place until it is ready.
              </p>
              <div className="league-simulation-progress" role="status">
                <span>
                  {restorationProgress.completed.toLocaleString("en-US")} /{" "}
                  {restorationProgress.total.toLocaleString("en-US")} games
                  restored
                </span>
                <progress
                  aria-label="Saved league restoration progress"
                  value={restorationProgress.completed}
                  max={restorationProgress.total}
                />
              </div>
            </section>
          ) : (
            <>
              <div className="mobile-title">
                <h1>
                  {state.franchise
                    ? `Franchise · Year ${state.franchise.year}`
                    : run.mode === "free"
                      ? "Lineup builder"
                      : "82–0 Challenge"}
                </h1>
                <p>Eight Pokémon. One complete team.</p>
              </div>
              {state.franchise && franchisePanel}
              {state.franchise && (
                <p className="franchise-draft-reset">
                  <button
                    className="text-button"
                    disabled={simulating || playoffSimulating}
                    onClick={() => requestReset(run.mode, run.includeLegends)}
                  >
                    End franchise / new draft
                  </button>
                </p>
              )}
              {state.franchise?.phase !== "offseason" && (
                <fieldset
                  className={`draft-layout draft-fieldset${state.franchise ? " franchise-roster-layout" : ""}`}
                  id="draft"
                  disabled={simulating || playoffSimulating || restoring}
                >
                  <div className="court-column">
                    <Court
                      run={run}
                      development={development}
                      ratings={ratings}
                      pending={pending}
                      swap={swap}
                      onSlot={onSlot}
                      onReset={() => requestReset(run.mode, run.includeLegends)}
                    />
                    {!archived && (
                      <BenchPanel
                        run={run}
                        development={development}
                        ratings={ratings}
                        pending={pending}
                        swap={swap}
                        onSlot={onSlot}
                        onAutoFill={() => {
                          dispatch({ type: "AUTO_BENCH" });
                          setPending(null);
                          setSwap(null);
                        }}
                        onDefense={(defense) =>
                          dispatch({ type: "DEFENSE", defense })
                        }
                        onTactic={(tactic) =>
                          dispatch({ type: "TACTIC", tactic })
                        }
                        onRotation={(rotation) =>
                          dispatch({ type: "ROTATION", rotation })
                        }
                      />
                    )}
                    {state.franchise && (
                      <RotationEditor
                        run={run}
                        disabled={
                          simulating ||
                          playoffSimulating ||
                          !!run.result ||
                          (run.seasonProgress?.completedRounds ?? 0) > 0
                        }
                        onChange={(plan) =>
                          dispatch({ type: "ROTATION_PLAN", plan })
                        }
                      />
                    )}
                  </div>
                  {!state.franchise && (
                    <DraftPanel
                      key={run.id}
                      run={run}
                      pending={pending}
                      inspectId={swap ? run.roster[swap] : null}
                      onPick={(id) => {
                        setPending(pending === id ? null : id);
                        setSwap(null);
                        setAnnouncement(
                          `${POKEMON_BY_ID.get(id)!.name} selected. Choose a position.`,
                        );
                      }}
                      onPlace={onSlot}
                      onReroll={() => {
                        dispatch({ type: "REROLL" });
                        setPending(null);
                        setAnnouncement("Four new draft choices are ready.");
                      }}
                      onLegends={(include) => requestReset(run.mode, include)}
                      records={records}
                      spriteStyle={spriteStyle}
                      onSpriteStyle={setSpriteStyle}
                      tools={
                        <LineupTools
                          key={run.id}
                          run={run}
                          onRandomize={() => {
                            dispatch({
                              type: "SET_LINEUP",
                              roster: randomLineup(
                                run.includeLegends,
                                newSeed(),
                              ),
                            });
                            setPending(null);
                            setSwap(null);
                            setAnnouncement(
                              "A new eight-player roster is ready.",
                            );
                          }}
                          onClear={() => {
                            dispatch({
                              type: "SET_LINEUP",
                              roster: emptyRoster(),
                            });
                            setPending(null);
                            setSwap(null);
                            setAnnouncement(
                              "All eight roster slots are cleared.",
                            );
                          }}
                        />
                      }
                    />
                  )}
                </fieldset>
              )}
              <p className="sr-only" role="status">
                {announcement}
              </p>
              <section
                id="arcade"
                className="arcade-entry"
                aria-label="Arcade basketball"
              >
                <div>
                  <span className="eyebrow">TAKE THE COURT</span>
                  <h2>Five on five. You're in control.</h2>
                  <p>
                    Bring your roster to a full-court arcade game. Turbo,
                    alley-oops, and elemental heat.
                  </p>
                </div>
                <div>
                  <button
                    className="button primary"
                    disabled={
                      simulating ||
                      playoffSimulating ||
                      restoring ||
                      importPending ||
                      Object.values(run.roster).some((id) => id === null)
                    }
                    onClick={() => {
                      setOfficialGame(null);
                      setArcadeOpen(true);
                    }}
                  >
                    Play arcade
                  </button>
                  {Object.values(run.roster).some((id) => id === null) && (
                    <p className="arcade-entry-note">
                      Fill all eight roster slots to tip off.
                    </p>
                  )}
                </div>
              </section>
              {state.franchise?.phase === "season" && !run.result ? (
                <FranchiseSchedule
                  run={run}
                  year={state.franchise.year}
                  busy={simulating || playoffSimulating}
                  progress={progress}
                  onPlay={openOfficialGame}
                  onAdvance={(rounds) => void advanceSeason(rounds)}
                />
              ) : (
                <SeasonPanel
                  key={run.id}
                  run={run}
                  ratings={ratings}
                  animate={animatedRun === run.id}
                  simulating={simulating}
                  progress={progress}
                  onPlayoffs={(mode) => void advancePlayoffs(mode)}
                  playoffSimulating={playoffSimulating}
                  playoffProgress={playoffProgress}
                  onPlayGame={playoffFixture ? openOfficialGame : undefined}
                  franchiseYear={state.franchise?.year}
                  franchiseEntry={!state.franchise ? franchisePanel : undefined}
                  onSimulate={() => {
                    setAnimatedRun(run.id);
                    setPending(null);
                    setSwap(null);
                    void simulate();
                  }}
                />
              )}
              {simulationError && (
                <p className="notice" role="alert">
                  {simulationError}
                </p>
              )}
              <RulesPanel />
            </>
          )}
        </main>
        <footer>
          <div className="footer-brand">
            82–0 <span>BUILT FOR THE LOVE OF THE GAME.</span>
          </div>
          <p>
            Unofficial fan project. Pokémon © Nintendo / Game Freak / The
            Pokémon Company.
            <br />
            Data & artwork:{" "}
            <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">
              PokéAPI
            </a>{" "}
            · Inspired by{" "}
            <a
              href="https://all22pokemon.com/"
              target="_blank"
              rel="noreferrer"
            >
              Pokémon All-22
            </a>
            .
          </p>
        </footer>
      </div>
      {reset && (
        <ConfirmDialog
          title={state.franchise ? "End this franchise?" : undefined}
          description={
            state.franchise
              ? "Starting a new draft replaces this franchise, including its career stats, trades and championship history. Your challenge records stay saved."
              : undefined
          }
          onCancel={() => setReset(null)}
          onConfirm={() => start(reset.mode, reset.includeLegends)}
        />
      )}
      {importPending && !restoring && (
        <ConfirmDialog
          title="Load shared lineup?"
          description={
            state.franchise
              ? "Loading this lineup replaces your franchise, including its career stats, trades and championship history. Your challenge records stay saved."
              : undefined
          }
          confirmLabel="Load lineup"
          onCancel={() => resolveImport(false)}
          onConfirm={() => resolveImport(true)}
        />
      )}
    </SpriteContext.Provider>
  );
}
