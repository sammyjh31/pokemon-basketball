import { useState, type ReactNode } from "react";
import { POKEMON, POKEMON_BY_ID, TYPES } from "../data/pokemon";
import {
  attributes,
  ATTRIBUTE_KEYS,
  ATTRIBUTE_LABELS,
  positionRating,
} from "../game/ratings";
import {
  POSITIONS,
  type Position,
  type Run,
  type Records,
} from "../game/types";
import { SpriteControls, type SpriteStyle } from "./SpriteControls";
import { PokemonCard } from "./PokemonCard";
export function DraftPanel({
  run,
  pending,
  onPick,
  onPlace,
  onReroll,
  onLegends,
  records,
  spriteStyle,
  onSpriteStyle,
  tools,
}: {
  run: Run;
  pending: number | null;
  onPick: (id: number) => void;
  onPlace: (p: Position) => void;
  onReroll: () => void;
  onLegends: (include: boolean) => void;
  records: Records;
  spriteStyle: SpriteStyle;
  onSpriteStyle: (style: SpriteStyle) => void;
  tools: ReactNode;
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
            (mon.name.toLowerCase().includes(search.trim().toLowerCase()) ||
              (/^#?\d{1,3}$/.test(search.trim()) &&
                mon.id === Number(search.trim().replace(/^#/, "")))) &&
            (!type || mon.types.includes(type)),
        );
  return (
    <section className="draft-panel" aria-label="Draft Pokémon">
      <div className="draft-title">
        <h1>
          {run.mode === "free" ? (
            "Lineup builder"
          ) : (
            <>
              <span>82–0</span> Challenge
            </>
          )}
        </h1>
        <p>
          {run.mode === "free"
            ? "Build your dream five. Pick a Pokémon, then choose its position on the court."
            : "Five picks. Two re-rolls. Draft your team and chase the perfect 82-game season."}
        </p>
      </div>
      {tools}
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
                ? "Ready for tip-off"
                : run.mode === "free"
                  ? "Pick a Pokémon"
                  : "Choose your next starter"}
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
            placeholder="Search name or #…"
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
      <SpriteControls value={spriteStyle} onChange={onSpriteStyle} />
      <dl className="personal-records">
        <div>
          <dt>Best record</dt>
          <dd>
            {records[run.mode].runs
              ? `${records[run.mode].bestWins}–${82 - records[run.mode].bestWins}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Runs</dt>
          <dd>{records[run.mode].runs}</dd>
        </div>
        <div>
          <dt>Perfect</dt>
          <dd>{records[run.mode].perfectSeasons}</dd>
        </div>
      </dl>
      <div className="how-it-works">
        <h3>
          How it works <a href="#rules">Scouting guide →</a>
        </h3>
        <p>
          {run.mode === "spin"
            ? "Choose one of four Pokémon each round. Place it in an open position. Each pick locks in, so make it count."
            : "Choose from the original 151. Swap positions by selecting two players on the court. Randomize for a fresh team."}{" "}
          Fill all five positions, then play your season.
        </p>
      </div>
    </section>
  );
}
