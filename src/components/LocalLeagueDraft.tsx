import { useEffect, useMemo, useRef, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import {
  currentLocalTurn,
  localDraftSize,
  localLeaguePool,
  LOCAL_TEAMS,
  type LocalLeague,
} from "../game/localLeague";
import { bestPosition, positionRating } from "../game/ratings";
import {
  emptyRoster,
  POSITIONS,
  ROSTER_SLOTS,
  SLOT_NAMES,
  type RosterSlot,
  type Position,
} from "../game/types";
import { PokemonCard } from "./PokemonCard";
import { ScoutReport } from "./ScoutReport";
import { localGeneration } from "../game/localFormat";
import { recommendRosterPicks } from "../game/draftAdvice";
import { DepthScouting } from "./DepthScouting";

export function LocalLeagueDraft({
  draft,
  onPick,
}: {
  draft: LocalLeague;
  onPick: (id: number, slot: RosterSlot) => void;
}) {
  const turn = currentLocalTurn(draft)!;
  const turnHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    turnHeading.current?.focus();
  }, []);
  const [query, setQuery] = useState("");
  const [generation, setGeneration] = useState("all");
  const [sort, setSort] = useState<"best" | Position>("best");
  const [selected, setSelected] = useState<number | null>(null);
  const [slot, setSlot] = useState<RosterSlot>("PG");
  const [limit, setLimit] = useState(24);
  const picks = draft.picks.filter((p) => p.teamId === turn.teamId);
  const vacancies = ROSTER_SLOTS.filter(
    (s) => !picks.some((p) => p.slot === s),
  );
  const pool = useMemo(() => {
    const taken = new Set(draft.picks.map((p) => p.pokemonId));
    return localLeaguePool(draft).filter(
      (p) => !taken.has(p.id) && (draft.includeLegends || !p.legendary),
    );
  }, [draft]);
  const generations = [
    ...new Set(localLeaguePool(draft).map((p) => localGeneration(p.id))),
  ];
  const tactic = draft.coaching[turn.teamId].tactic;
  const advice = useMemo(() => {
    const roster = emptyRoster();
    draft.picks
      .filter((p) => p.teamId === turn.teamId)
      .forEach((p) => {
        roster[p.slot] = p.pokemonId;
      });
    return recommendRosterPicks(pool, roster, tactic);
  }, [pool, draft.picks, turn.teamId, tactic]);
  const candidates = useMemo(
    () =>
      pool
        .filter(
          (p) =>
            generation === "all" ||
            localGeneration(p.id) === Number(generation),
        )
        .filter((p) =>
          `${p.name} ${p.id} ${p.types.join(" ")} gen ${localGeneration(p.id)}`
            .toLowerCase()
            .includes(query.toLowerCase().trim()),
        )
        .sort(
          (a, b) =>
            positionRating(b, sort === "best" ? bestPosition(b) : sort) -
              positionRating(a, sort === "best" ? bestPosition(a) : sort) ||
            a.id - b.id,
        ),
    [pool, query, sort, generation],
  );
  const mon = selected === null ? null : POKEMON_BY_ID.get(selected)!;
  const choose = (id: number) => {
    setSelected(id);
    const candidate = POKEMON_BY_ID.get(id)!;
    const starting = vacancies.filter((s) =>
      POSITIONS.includes(s as Position),
    ) as Position[];
    setSlot(
      starting.length
        ? starting.reduce((best, pos) =>
            positionRating(candidate, pos) > positionRating(candidate, best)
              ? pos
              : best,
          )
        : vacancies[0],
    );
  };
  return (
    <>
      <section className="local-clock" aria-labelledby="local-clock-title">
        <div>
          <span className="eyebrow">
            ROUND {turn.round} OF 8 · PICK {turn.pick} OF{" "}
            {localDraftSize(draft)}
          </span>
          <h2
            id="local-clock-title"
            ref={turnHeading}
            tabIndex={-1}
            aria-describedby="local-turn-detail"
          >
            On the clock: {turn.manager!.name}
          </h2>
          <p id="local-turn-detail">
            {LOCAL_TEAMS[turn.teamId].name} · {picks.length}/8 players drafted
          </p>
        </div>
        <span className="local-direction">
          {turn.round % 2 ? "→" : "←"}{" "}
          {turn.round % 2 ? "Forward round" : "Reverse round"}
        </span>
      </section>
      <div className="local-draft-layout">
        <section
          className="local-panel local-pool"
          aria-label="Available Pokémon"
        >
          <details className="local-draft-advice">
            <summary>
              Draft recommendations for {LOCAL_TEAMS[turn.teamId].name}
            </summary>
            <p>
              Based on open roles, coaching fit, and complementary skills.
              Alternatives count players available now, not who will survive
              until your next pick.
            </p>
            {advice.map((pick) => (
              <article key={pick.pokemonId}>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => choose(pick.pokemonId)}
                >
                  Scout {POKEMON_BY_ID.get(pick.pokemonId)!.name} · {pick.slot}{" "}
                  fit {pick.fit.toFixed(0)}
                </button>
                <ul>
                  {pick.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p>{pick.physical}</p>
                {!!pick.alternatives.length && (
                  <p>
                    Other options:{" "}
                    {pick.alternatives
                      .map((id) => POKEMON_BY_ID.get(id)!.name)
                      .join(", ")}
                    .
                  </p>
                )}
              </article>
            ))}
          </details>
          <div className="local-pool-controls">
            <label>
              Search available Pokémon
              <input
                type="search"
                value={query}
                placeholder="Name, number, type, or generation"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(24);
                }}
              />
            </label>
            <label>
              Filter by generation
              <select
                value={generation}
                onChange={(e) => {
                  setGeneration(e.target.value);
                  setLimit(24);
                }}
              >
                <option value="all">All generations</option>
                {generations.map((generation) => (
                  <option key={generation} value={generation}>
                    Generation {generation}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort by position
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as typeof sort);
                  setLimit(24);
                }}
              >
                <option value="best">Best available</option>
                {POSITIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="local-selection" aria-live="polite">
            {mon ? (
              <>
                <div>
                  <strong>{mon.name}</strong>
                  <span>Choose a position, then lock your pick.</span>
                </div>
                <label>
                  Draft position
                  <select
                    value={slot}
                    onChange={(e) => setSlot(e.target.value as RosterSlot)}
                  >
                    {vacancies.map((s) => (
                      <option value={s} key={s}>
                        {s} · {SLOT_NAMES[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button primary"
                  onClick={() => onPick(mon.id, slot)}
                >
                  Confirm pick: {mon.name}
                </button>
              </>
            ) : (
              <p>
                Select a Pokémon below to scout it and choose its roster
                position.
              </p>
            )}
          </div>
          {mon && (
            <details className="local-scout">
              <summary>Scout {mon.name}</summary>
              <ScoutReport mon={mon} />
              {draft.options && (
                <DepthScouting
                  mon={mon}
                  abilities={draft.options.engineRules.abilities}
                />
              )}
            </details>
          )}
          <p className="local-pool-count">
            {candidates.length} available · CPU picks happen automatically
            between friends' turns.
          </p>
          <div className="candidate-grid free-pool local-candidates">
            {candidates.slice(0, limit).map((p) => (
              <PokemonCard
                mon={p}
                key={p.id}
                selected={selected === p.id}
                onSelect={() => choose(p.id)}
              />
            ))}
          </div>
          {!candidates.length && (
            <p className="notice">No available Pokémon match that search.</p>
          )}
          {candidates.length > limit && (
            <button
              className="button secondary"
              onClick={() => setLimit(limit + 24)}
            >
              Show more Pokémon
            </button>
          )}
        </section>
        <aside className="local-draft-sidebar">
          <section className="local-panel">
            <span className="eyebrow">{turn.manager!.name}'S ROSTER</span>
            <h3>{LOCAL_TEAMS[turn.teamId].name}</h3>
            <ol className="local-roster-list">
              {ROSTER_SLOTS.map((s) => {
                const pick = picks.find((p) => p.slot === s);
                return (
                  <li key={s}>
                    <b>{s}</b>
                    <span>
                      {pick ? POKEMON_BY_ID.get(pick.pokemonId)!.name : "Empty"}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="stat-legend">
              Five starters and three reserves. You can rearrange positions
              after the draft.
            </p>
          </section>
          <section className="local-panel">
            <h3>Recent picks</h3>
            <ol className="local-recent" reversed start={draft.picks.length}>
              {draft.picks
                .slice(-8)
                .reverse()
                .map((pick, index) => (
                  <li key={draft.picks.length - index}>
                    <strong>{POKEMON_BY_ID.get(pick.pokemonId)!.name}</strong>
                    <span>
                      {draft.managers.find((m) => m.teamId === pick.teamId)
                        ?.name ?? "CPU"}{" "}
                      · {LOCAL_TEAMS[pick.teamId].name}
                    </span>
                  </li>
                ))}
            </ol>
          </section>
        </aside>
      </div>
      <details className="local-panel local-order">
        <summary>Full draft order · Round {turn.round}</summary>
        <ol>
          {(turn.round % 2 ? draft.order : [...draft.order].reverse()).map(
            (id) => (
              <li key={id} className={id === turn.teamId ? "active" : ""}>
                {LOCAL_TEAMS[id].name}
                <span>
                  {draft.managers.find((m) => m.teamId === id)?.name ?? "CPU"}
                </span>
              </li>
            ),
          )}
        </ol>
      </details>
    </>
  );
}
