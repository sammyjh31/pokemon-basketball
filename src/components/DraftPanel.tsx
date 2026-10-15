import { useState } from "react";
import { POKEMON, POKEMON_BY_ID, TYPES } from "../data/pokemon";
import {
  attributes,
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  positionRating,
} from "../game/ratings";
import { POSITIONS, type Mode, type Position, type Run } from "../game/types";
import { PokemonCard } from "./PokemonCard";
export function DraftPanel({
  run,
  pending,
  onPick,
  onPlace,
  onReroll,
  onMode,
  onLegends,
}: {
  run: Run;
  pending: number | null;
  onPick: (id: number) => void;
  onPlace: (p: Position) => void;
  onReroll: () => void;
  onMode: (mode: Mode) => void;
  onLegends: (include: boolean) => void;
}) {
  const [search, setSearch] = useState(""),
    [type, setType] = useState("");
  const count = Object.values(run.roster).filter(Boolean).length;
  const chosen = POKEMON_BY_ID.get(pending ?? -1);
  const candidates =
    run.mode === "spin"
      ? run.offerIds.map((id) => POKEMON_BY_ID.get(id)!)
      : POKEMON.filter(
          (mon) =>
            !Object.values(run.roster).includes(mon.id) &&
            (run.includeLegends || !mon.legendary) &&
            mon.name.toLowerCase().includes(search.trim().toLowerCase()) &&
            (!type || mon.types.includes(type)),
        );
  return (
    <section className="draft-panel" aria-label="Draft Pokémon">
      <div className="mode-tabs">
        <button
          onClick={() => onMode("spin")}
          aria-pressed={run.mode === "spin"}
        >
          Spin & Pick
        </button>
        <button
          onClick={() => onMode("free")}
          aria-pressed={run.mode === "free"}
        >
          Free Draft
        </button>
      </div>
      <div className="draft-heading">
        <div>
          <span className="eyebrow">
            {run.result
              ? "IN THE BOOKS"
              : count === 5
                ? "LINEUP COMPLETE"
                : `PICK ${count + 1} OF 5`}
          </span>
          <h2>
            {run.result
              ? "What a season."
              : count === 5
                ? "Ready for tip-off."
                : "Who’s your next starter?"}
          </h2>
        </div>
        {run.mode === "spin" && !run.result && count < 5 && (
          <button
            className="reroll-button"
            onClick={onReroll}
            disabled={run.rerollsLeft === 0}
            aria-label={`Re-roll · ${run.rerollsLeft} left`}
          >
            <span aria-hidden="true">↻</span> Re-roll <b>{run.rerollsLeft}</b>
          </button>
        )}
      </div>
      {!run.result && (
        <label className="legend-toggle">
          <input
            type="checkbox"
            checked={run.includeLegends}
            onChange={(e) => onLegends(e.target.checked)}
          />
          <span>Include legendary Pokémon</span>
          <span className="legend-star" aria-hidden="true">
            ✦
          </span>
        </label>
      )}
      {!run.result && run.mode === "free" && (
        <div className="search-controls">
          <input
            type="search"
            aria-label="Search Pokémon"
            placeholder="Search Pokémon…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Filter by type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}
      {run.result ? (
        <div className="draft-finished">
          <span className="finish-ball" aria-hidden="true">
            ✦
          </span>
          <h3>Your five. Your story.</h3>
          <p>
            Every legend starts with a lineup.
            <br />
            Check your results below, then run it back.
          </p>
          <a className="button secondary" href="#season">
            View season recap <span aria-hidden="true">↓</span>
          </a>
        </div>
      ) : count === 5 && run.mode === "spin" ? (
        <div className="draft-finished">
          <span className="finish-ball" aria-hidden="true">
            ✓
          </span>
          <h3>The squad is assembled.</h3>
          <p>
            Five Pokémon. Eighty-two games.
            <br />
            Your perfect season starts below.
          </p>
          <a className="button secondary" href="#season">
            Head to the season <span aria-hidden="true">↓</span>
          </a>
        </div>
      ) : (
        <>
          <div
            className={`candidate-grid ${run.mode === "free" ? "free-pool" : ""}`}
          >
            {candidates.map((mon) => (
              <PokemonCard
                key={mon.id}
                mon={mon}
                selected={pending === mon.id}
                onSelect={() => onPick(mon.id)}
              />
            ))}
          </div>
          {candidates.length === 0 && (
            <p className="empty-search">
              No Pokémon match. Try another name or type.
            </p>
          )}
          <p className="draft-footnote">
            {run.mode === "spin"
              ? "Four choices. One spot on the team. Make it count."
              : `${candidates.length} available Pokémon · Original 151`}
          </p>
        </>
      )}
      {chosen && !run.result && (
        <div className="placement-preview" data-testid="placement-preview">
          <div className="preview-heading">
            <strong>Place {chosen.name}</strong>
            <span>POSITION FIT</span>
          </div>
          <div className="placement-positions">
            {POSITIONS.map((p) => (
              <button
                key={p}
                disabled={run.mode === "spin" && run.roster[p] !== null}
                onClick={() => onPlace(p)}
                aria-label={`Place ${chosen.name} at ${p}`}
              >
                <span>{p}</span>
                <strong>{Math.round(positionRating(chosen, p))}</strong>
              </button>
            ))}
          </div>
          <div className="attribute-list">
            {ATTRIBUTE_KEYS.map((key) => (
              <span key={key}>
                {ATTRIBUTE_LABELS[key]}{" "}
                <b>{Math.round(attributes(chosen)[key])}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
