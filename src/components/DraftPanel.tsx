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
  ROSTER_SLOTS,
  type RosterSlot,
  type Position,
  type Run,
  type Records,
} from "../game/types";
import { SpriteControls, type SpriteStyle } from "./SpriteControls";
import { ScoutReport } from "./ScoutReport";
import { PokemonCard } from "./PokemonCard";
export function DraftPanel({
  run,
  pending,
  inspectId,
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
  inspectId?: number | null;
  onPick: (id: number) => void;
  onPlace: (p: RosterSlot) => void;
  onReroll: () => void;
  onLegends: (include: boolean) => void;
  records: Records;
  spriteStyle: SpriteStyle;
  onSpriteStyle: (style: SpriteStyle) => void;
  tools: ReactNode;
}) {
  const [search, setSearch] = useState(""),
    [type, setType] = useState("");
  const [sort, setSort] = useState("dex");
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
  if (run.mode === "free" && sort !== "dex")
    candidates.sort((a, b) => {
      const score = (mon: typeof a) =>
        POSITIONS.includes(sort as Position)
          ? positionRating(mon, sort as Position)
          : attributes(mon)[sort as "threePoint" | "stamina" | "rebounding"];
      return score(b) - score(a) || a.id - b.id;
    });
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
            ? "Build your eight-player rotation. Pick a Pokémon, then choose its position on the court."
            : "Eight picks. Two re-rolls. Draft your team and chase the perfect 82-game season."}
        </p>
      </div>
      {tools}
      <div className="draft-heading">
        <div>
          <span className="eyebrow">
            {run.result
              ? "IN THE BOOKS"
              : count === 8
                ? "LINEUP COMPLETE"
                : `PICK ${count + 1} OF 8`}
          </span>
          <h2>
            {run.result
              ? "What a season."
              : count === 8
                ? "Ready for tip-off"
                : run.mode === "free"
                  ? "Pick a Pokémon"
                  : "Choose your next player"}
          </h2>
        </div>
        {run.mode === "spin" && !run.result && count < 8 && (
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
      {!run.result && run.mode === "free" && (
        <label className="scout-sort">
          Scout by
          <select
            aria-label="Sort Pokémon by"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="dex">Pokédex number</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p} position fit
              </option>
            ))}
            <option value="threePoint">Three-point shooting</option>
            <option value="rebounding">Rebounding</option>
            <option value="stamina">Stamina</option>
          </select>
        </label>
      )}
      {run.result ? (
        <div className="draft-finished">
          <span className="finish-ball" aria-hidden="true">
            ✦
          </span>
          <h3>
            {(run.result?.modelVersion ?? 1) >= 2
              ? "Your eight. Your story."
              : "Your five. Your story."}
          </h3>
          <p>
            Every legend starts with a lineup.
            <br />
            Check your results below, then run it back.
          </p>
          <a className="button secondary" href="#season">
            View season recap <span aria-hidden="true">↓</span>
          </a>
        </div>
      ) : count === 8 && run.mode === "spin" ? (
        <div className="draft-finished">
          <span className="finish-ball" aria-hidden="true">
            ✓
          </span>
          <h3>The squad is assembled.</h3>
          <p>
            Eight Pokémon. Eighty-two games.
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
              : `${candidates.length} available Pokémon · Gen 1 + 2`}
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
            {ROSTER_SLOTS.map((p) => (
              <button
                key={p}
                disabled={run.mode === "spin" && run.roster[p] !== null}
                onClick={() => onPlace(p)}
                aria-label={`Place ${chosen.name} at ${p}`}
              >
                <span>{p}</span>
                <strong>
                  {Math.round(
                    p.startsWith("B")
                      ? Math.max(
                          ...POSITIONS.map((pos) =>
                            positionRating(chosen, pos),
                          ),
                        )
                      : positionRating(chosen, p as Position),
                  )}
                </strong>
              </button>
            ))}
          </div>
          <ScoutReport mon={chosen} />
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
      {!pending && inspectId && POKEMON_BY_ID.has(inspectId) && (
        <ScoutReport mon={POKEMON_BY_ID.get(inspectId)!} />
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
            : "Choose from 251 Pokémon across Gen 1 and 2. Swap positions by selecting two players on the court. Randomize for a fresh team."}{" "}
          Fill five starting positions and three bench slots, then play your
          season.
        </p>
      </div>
    </section>
  );
}
