import { useState } from "react";
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
  const [pending, setPending] = useState<number | null>(null),
    [swap, setSwap] = useState<RosterSlot | null>(null);
  const [reset, setReset] = useState<{
    mode: Mode;
    includeLegends: boolean;
  } | null>(null);
  const [animatedRun, setAnimatedRun] = useState<string | null>(null),
    [announcement, setAnnouncement] = useState("");
  const archived = !!run.result && (run.result.modelVersion ?? 1) < 2;
  const ratings = archived
    ? legacyTeamRatings(run.roster)
    : teamRatings(run.roster, run.tactic, run.rotation);
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
    if (run.result || simulating || playoffSimulating || restoring) return;
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
    if (run.mode === "free") {
      if (swap) {
        dispatch({ type: "SWAP", first: swap, second: position });
        setSwap(null);
        setAnnouncement("Positions updated.");
      } else if (run.roster[position]) setSwap(position);
    }
  };
  return (
    <SpriteContext.Provider value={spriteStyle}>
      <a className="skip-link" href="#draft">
        Skip to draft
      </a>
      <div className="app-shell">
        <Scoreboard
          mode={run.mode}
          disabled={simulating || playoffSimulating || restoring}
          onMode={(mode) => {
            if (mode !== run.mode) requestReset(mode, run.includeLegends);
          }}
        />
        <main aria-busy={restoring}>
          {storageNotice && (
            <p className="notice" role="status">
              {storageNotice}
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
                  {run.mode === "free" ? "Lineup builder" : "82–0 Challenge"}
                </h1>
                <p>Eight Pokémon. One complete team.</p>
              </div>
              <fieldset
                className="draft-layout draft-fieldset"
                id="draft"
                disabled={simulating || playoffSimulating || restoring}
              >
                <div className="court-column">
                  <Court
                    run={run}
                    ratings={ratings}
                    pending={pending}
                    swap={swap}
                    onSlot={onSlot}
                    onReset={() => requestReset(run.mode, run.includeLegends)}
                  />
                  {!archived && (
                    <BenchPanel
                      run={run}
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
                </div>
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
                          roster: randomLineup(run.includeLegends, newSeed()),
                        });
                        setPending(null);
                        setSwap(null);
                        setAnnouncement("A new eight-player roster is ready.");
                      }}
                      onClear={() => {
                        dispatch({
                          type: "SET_LINEUP",
                          roster: emptyRoster(),
                        });
                        setPending(null);
                        setSwap(null);
                        setAnnouncement("All eight roster slots are cleared.");
                      }}
                    />
                  }
                />
              </fieldset>
              <p className="sr-only" role="status">
                {announcement}
              </p>
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
                onSimulate={() => {
                  setAnimatedRun(run.id);
                  setPending(null);
                  setSwap(null);
                  void simulate();
                }}
              />
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
          onCancel={() => setReset(null)}
          onConfirm={() => start(reset.mode, reset.includeLegends)}
        />
      )}
      {importPending && !restoring && (
        <ConfirmDialog
          title="Load shared lineup?"
          confirmLabel="Load lineup"
          onCancel={() => resolveImport(false)}
          onConfirm={() => resolveImport(true)}
        />
      )}
    </SpriteContext.Provider>
  );
}
