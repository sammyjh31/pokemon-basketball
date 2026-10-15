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
export default function App({
  initial,
  storage,
}: {
  initial?: GameState;
  storage?: StorageLike;
}) {
  const { state, dispatch, storageNotice } = useGame(initial, storage),
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
    <>
      <a className="skip-link" href="#draft">
        Skip to draft
      </a>
      <div className="app-shell">
        <Scoreboard ratings={ratings} records={records} mode={run.mode} />
        <main>
          {storageNotice && (
            <p className="notice" role="status">
              {storageNotice}
            </p>
          )}
          <div className="draft-layout" id="draft">
            <Court
              run={run}
              ratings={ratings}
              pending={pending}
              swap={swap}
              onSlot={onSlot}
              onReset={() => requestReset(run.mode, run.includeLegends)}
            />
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
              onMode={(mode) => {
                if (mode !== run.mode) requestReset(mode, run.includeLegends);
              }}
              onLegends={(include) => requestReset(run.mode, include)}
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
            <a href="https://poke17-0.com/" target="_blank" rel="noreferrer">
              17–0 Pokémon Football
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
    </>
  );
}
