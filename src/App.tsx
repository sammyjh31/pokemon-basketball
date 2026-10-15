import { useState } from "react";
import { POKEMON_BY_ID } from "./data/pokemon";
import { teamRatings } from "./game/ratings";
import type { GameState, Mode, Position } from "./game/types";
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
import { randomLineup } from "./game/lineup";
export default function App({
  initial,
  storage,
}: {
  initial?: GameState;
  storage?: StorageLike;
}) {
  const { state, dispatch, storageNotice, importPending, resolveImport } =
      useGame(initial, storage),
    { run, records } = state;
  const [pending, setPending] = useState<number | null>(null),
    [swap, setSwap] = useState<Position | null>(null);
  const [reset, setReset] = useState<{
    mode: Mode;
    includeLegends: boolean;
  } | null>(null);
  const [animatedRun, setAnimatedRun] = useState<string | null>(null),
    [announcement, setAnnouncement] = useState("");
  const ratings = teamRatings(run.roster);
  const [spriteStyle, setSpriteStyle] = useState<SpriteStyle>("pixel");
  const start = (mode: Mode, includeLegends: boolean) => {
    dispatch({ type: "NEW_RUN", mode, includeLegends, seed: newSeed() });
    setPending(null);
    setSwap(null);
    setReset(null);
    setAnimatedRun(null);
    setAnnouncement("New draft started. Pick your first Pokémon.");
  };
  const requestReset = (mode: Mode, includeLegends: boolean) => {
    if (ratings.filled > 0) setReset({ mode, includeLegends });
    else start(mode, includeLegends);
  };
  const onSlot = (position: Position) => {
    if (run.result) return;
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
          onMode={(mode) => {
            if (mode !== run.mode) requestReset(mode, run.includeLegends);
          }}
        />
        <main>
          {storageNotice && (
            <p className="notice" role="status">
              {storageNotice}
            </p>
          )}
          <div className="mobile-title">
            <h1>{run.mode === "free" ? "Lineup builder" : "82–0 Challenge"}</h1>
            <p>Five Pokémon. One perfect season.</p>
          </div>
          <div className="draft-layout" id="draft">
            <div className="court-column">
              <Court
                run={run}
                ratings={ratings}
                pending={pending}
                swap={swap}
                onSlot={onSlot}
                onReset={() => requestReset(run.mode, run.includeLegends)}
              />
            </div>
            <DraftPanel
              key={run.id}
              run={run}
              pending={pending}
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
                    setAnnouncement("A new starting five is ready.");
                  }}
                  onClear={() => {
                    dispatch({
                      type: "SET_LINEUP",
                      roster: {
                        PG: null,
                        SG: null,
                        SF: null,
                        PF: null,
                        C: null,
                      },
                    });
                    setPending(null);
                    setSwap(null);
                    setAnnouncement("All five positions are cleared.");
                  }}
                />
              }
            />
          </div>
          <p className="sr-only" role="status">
            {announcement}
          </p>
          <SeasonPanel
            key={run.id}
            run={run}
            ratings={ratings}
            animate={animatedRun === run.id}
            onSimulate={() => {
              setAnimatedRun(run.id);
              setPending(null);
              setSwap(null);
              dispatch({ type: "SIMULATE" });
            }}
          />
          <RulesPanel />
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
      {importPending && (
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
