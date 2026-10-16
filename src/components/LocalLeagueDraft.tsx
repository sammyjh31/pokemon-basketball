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
  TACTIC_LABELS,
} from "../game/types";
import {
  DraftComparison,
  DraftProspectCard,
  DraftToolBars,
  prospectTools,
} from "./DraftProspect";
import { Portrait, TypeBadges } from "./Portrait";
import { playerProfile } from "../game/playerProfile";
import { ScoutReport } from "./ScoutReport";
import { localGeneration } from "../game/localFormat";
import { recommendRosterPicks } from "../game/draftAdvice";
import { DepthScouting } from "./DepthScouting";
import { DraftTeamImpact } from "./DraftTeamImpact";
import {
  DRAFT_IMPACT_PRIORITIES,
  projectDraftImpact,
  projectDraftPool,
  rankDraftImpacts,
  type DraftImpactFocus,
} from "../game/draftImpact";
import { DraftImpactComparison } from "./DraftImpactComparison";
import { draftImpactChangeLabel } from "./draftImpactFormat";

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
  const [sort, setSort] = useState<"impact" | "fit" | "best" | Position>(
    "impact",
  );
  const [rankingSlot, setRankingSlot] = useState<RosterSlot>("PG");
  const [impactFocus, setImpactFocus] = useState<DraftImpactFocus>("balance");
  const [selected, setSelected] = useState<number | null>(null);
  const [slot, setSlot] = useState<RosterSlot>("PG");
  const [limit, setLimit] = useState(24);
  const [compared, setCompared] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [comparePosition, setComparePosition] = useState<Position>("PG");
  const selectedHeading = useRef<HTMLHeadingElement>(null);
  const boardHeading = useRef<HTMLHeadingElement>(null);
  const comparisonPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (compareOpen)
      comparisonPanel.current?.scrollIntoView?.({ block: "start" });
  }, [compareOpen]);
  useEffect(() => {
    if (selected !== null) {
      selectedHeading.current?.focus();
      selectedHeading.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [selected]);
  const picks = draft.picks.filter((p) => p.teamId === turn.teamId);
  const vacancies = ROSTER_SLOTS.filter(
    (s) => !picks.some((p) => p.slot === s),
  );
  const impactSlot = vacancies.includes(rankingSlot)
    ? rankingSlot
    : vacancies[0];
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
  const roster = useMemo(() => {
    const roster = emptyRoster();
    draft.picks
      .filter((p) => p.teamId === turn.teamId)
      .forEach((p) => {
        roster[p.slot] = p.pokemonId;
      });
    return roster;
  }, [draft.picks, turn.teamId]);
  const advice = useMemo(
    () => recommendRosterPicks(pool, roster, tactic, pool.length),
    [pool, roster, tactic],
  );
  const adviceById = useMemo(
    () => new Map(advice.map((pick) => [pick.pokemonId, pick])),
    [advice],
  );
  const rotation = draft.coaching[turn.teamId].rotation;
  const poolProjections = useMemo(
    () =>
      projectDraftPool(
        pool.map((p) => p.id),
        roster,
        impactSlot,
        tactic,
        rotation,
      ),
    [pool, roster, impactSlot, tactic, rotation],
  );
  const impactRanking = useMemo(
    () => rankDraftImpacts(poolProjections, impactFocus),
    [poolProjections, impactFocus],
  );
  const impactById = useMemo(
    () => new Map(impactRanking.map((entry) => [entry.pokemonId, entry])),
    [impactRanking],
  );
  const impactPriority = DRAFT_IMPACT_PRIORITIES.find(
    (priority) => priority.key === impactFocus,
  )!;
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
            (sort === "impact"
              ? impactById.get(b.id)!.metric.after -
                impactById.get(a.id)!.metric.after
              : sort === "fit"
                ? adviceById.get(b.id)!.score - adviceById.get(a.id)!.score
                : positionRating(b, sort === "best" ? bestPosition(b) : sort) -
                  positionRating(
                    a,
                    sort === "best" ? bestPosition(a) : sort,
                  )) || a.id - b.id,
        ),
    [pool, query, sort, generation, adviceById, impactById],
  );
  const mon = selected === null ? null : POKEMON_BY_ID.get(selected)!;
  const choose = (id: number, previewSlot?: RosterSlot) => {
    setSelected(id);
    if (selected === id) {
      selectedHeading.current?.focus();
      selectedHeading.current?.scrollIntoView?.({ block: "nearest" });
    }
    const candidate = POKEMON_BY_ID.get(id)!;
    const starting = vacancies.filter((s) =>
      POSITIONS.includes(s as Position),
    ) as Position[];
    setSlot(
      previewSlot && vacancies.includes(previewSlot)
        ? previewSlot
        : sort === "impact"
          ? impactSlot
          : POSITIONS.includes(sort as Position) &&
              vacancies.includes(sort as Position)
            ? (sort as Position)
            : starting.length
              ? starting.reduce((best, pos) =>
                  positionRating(candidate, pos) >
                  positionRating(candidate, best)
                    ? pos
                    : best,
                )
              : vacancies[0],
    );
  };
  const toggleCompare = (id: number) => {
    if (compared.includes(id) && compared.length <= 2) setCompareOpen(false);
    setCompared((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : current.length < 3
          ? [...current, id]
          : current,
    );
  };
  const impact = useMemo(
    () =>
      selected === null
        ? null
        : projectDraftImpact(
            roster,
            selected,
            slot,
            tactic,
            draft.coaching[turn.teamId].rotation,
          ),
    [roster, selected, slot, tactic, draft.coaching, turn.teamId],
  );
  const selectedAdvice = mon ? adviceById.get(mon.id)! : null;
  const selectedProfile = mon ? playerProfile(mon) : null;
  const selectedTools = mon ? prospectTools(mon) : [];
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
          <div className="draft-board-heading">
            <div>
              <span className="eyebrow">YOUR SCOUTING DESK</span>
              <h3 ref={boardHeading} tabIndex={-1}>
                Find your next difference maker
              </h3>
            </div>
            <span className="draft-style">{TACTIC_LABELS[tactic]}</span>
          </div>
          <p className="draft-board-intro">
            Team impact ranks every available Pokémon by their projected effect
            on your roster at the chosen position. Pick a priority, scout the
            tradeoffs, then compare up to three.
          </p>
          <div className="draft-open-roles" aria-label="Open roster positions">
            <span>Open roles</span>
            {vacancies.map((s) => (
              <button
                key={s}
                aria-label={`Rank for ${s}`}
                aria-pressed={sort === "impact" ? impactSlot === s : sort === s}
                onClick={() => {
                  setSort("impact");
                  setRankingSlot(s);
                  setLimit(24);
                }}
              >
                {s}
              </button>
            ))}
          </div>
          {sort === "impact" && (
            <p className="draft-impact-leaders-label">
              {impactPriority.label} at {impactSlot} · top choices from all{" "}
              {pool.length} available
            </p>
          )}
          <div
            className="draft-recommendations"
            aria-label={
              sort === "impact"
                ? "Top team impact prospects"
                : "Recommended players"
            }
          >
            {sort === "impact"
              ? impactRanking.slice(0, 3).map((entry) => (
                  <button
                    key={entry.pokemonId}
                    onClick={() => choose(entry.pokemonId)}
                    aria-label={`Scout impact leader: ${POKEMON_BY_ID.get(entry.pokemonId)!.name}`}
                  >
                    <Portrait mon={POKEMON_BY_ID.get(entry.pokemonId)!} />
                    <span>
                      <small>
                        IMPACT #{entry.rank}
                        {entry.tied ? " (TIED)" : ""} · {impactSlot}
                      </small>
                      <strong>
                        {POKEMON_BY_ID.get(entry.pokemonId)!.name}
                      </strong>
                      <small>
                        {entry.metric.delta === null
                          ? `${entry.metric.after.toFixed(1)} starting profile`
                          : `${draftImpactChangeLabel(entry.metric.delta)} vs now`}
                      </small>
                    </span>
                  </button>
                ))
              : advice.slice(0, 3).map((pick, i) => (
                  <button
                    key={pick.pokemonId}
                    onClick={() => choose(pick.pokemonId, pick.slot)}
                    aria-label={`Scout recommendation: ${POKEMON_BY_ID.get(pick.pokemonId)!.name}`}
                  >
                    <Portrait mon={POKEMON_BY_ID.get(pick.pokemonId)!} />
                    <span>
                      <small>
                        TEAM PICK {i + 1} · {pick.slot}
                      </small>
                      <strong>{POKEMON_BY_ID.get(pick.pokemonId)!.name}</strong>
                    </span>
                    <b>{Math.round(pick.fit)}</b>
                  </button>
                ))}
          </div>
          <details className="local-draft-advice">
            <summary>
              Draft recommendations for {LOCAL_TEAMS[turn.teamId].name}
            </summary>
            <p>
              Based on open roles, coaching fit, and complementary skills.
              Alternatives count players available now, not who will survive
              until your next pick.
            </p>
            {advice.slice(0, 3).map((pick) => (
              <article key={pick.pokemonId}>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => choose(pick.pokemonId, pick.slot)}
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
          <section
            className={`draft-shortlist ${compareOpen && compared.length >= 2 ? "is-open" : ""}`}
            aria-label="Comparison shortlist"
            ref={comparisonPanel}
          >
            <div className="draft-shortlist-heading">
              <strong>
                Compare players{" "}
                <span aria-live="polite">{compared.length}/3</span>
              </strong>
              <button
                className="text-button"
                disabled={compared.length < 2}
                aria-expanded={compareOpen && compared.length >= 2}
                aria-controls="draft-comparison-content"
                onClick={() => setCompareOpen(!compareOpen)}
              >
                {compareOpen && compared.length >= 2
                  ? "Hide comparison"
                  : "Compare shortlist"}
              </button>
            </div>
            <div className="draft-shortlist-chips">
              {compared.map((id) => (
                <button
                  key={id}
                  onClick={() => toggleCompare(id)}
                  aria-label={`Remove ${POKEMON_BY_ID.get(id)!.name} from comparison`}
                >
                  <Portrait mon={POKEMON_BY_ID.get(id)!} />
                  {POKEMON_BY_ID.get(id)!.name}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              {compared.length < 2 && (
                <p>
                  Add {compared.length ? "one more player" : "players"} using +
                  Compare on their cards.
                </p>
              )}
              {compared.length === 3 && (
                <p>Shortlist full. Remove a player to add another.</p>
              )}
            </div>
            <div id="draft-comparison-content">
              {compareOpen && compared.length >= 2 && (
                <>
                  <DraftImpactComparison
                    mons={compared.map((id) => POKEMON_BY_ID.get(id)!)}
                    roster={roster}
                    tactic={tactic}
                    rotation={draft.coaching[turn.teamId].rotation}
                    slot={impactSlot}
                    focus={impactFocus}
                    onSlot={(next) => {
                      setRankingSlot(next);
                      setLimit(24);
                    }}
                    onFocus={(next) => {
                      setImpactFocus(next);
                      setLimit(24);
                    }}
                    onReview={(id, previewSlot) => {
                      setCompareOpen(false);
                      choose(id, previewSlot);
                    }}
                  />
                  <details className="draft-individual-comparison">
                    <summary>
                      Compare individual skills & physical profiles
                    </summary>
                    <DraftComparison
                      mons={compared.map((id) => POKEMON_BY_ID.get(id)!)}
                      advice={adviceById}
                      position={comparePosition}
                      onPosition={setComparePosition}
                      abilities={draft.options?.engineRules.abilities ?? false}
                      onScout={(id) => {
                        setCompareOpen(false);
                        choose(id);
                      }}
                    />
                  </details>
                </>
              )}
            </div>
          </section>
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
              Rank players by
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as typeof sort);
                  setLimit(24);
                }}
              >
                <option value="impact">Team impact · projected change</option>
                <option value="fit">Team fit · open roles</option>
                <option value="best">Best available · any position</option>
                {POSITIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          {sort === "impact" && (
            <section
              className="draft-impact-ranking"
              aria-label="Team impact ranking"
            >
              <div className="draft-impact-ranking-heading">
                <div>
                  <span className="eyebrow">RANK THE WHOLE POOL</span>
                  <h4>Find the biggest upgrade</h4>
                </div>
                <span>{pool.length} eligible players</span>
              </div>
              <div className="draft-impact-compare-controls">
                <label>
                  Rank for position
                  <select
                    value={impactSlot}
                    onChange={(e) => {
                      setRankingSlot(e.target.value as RosterSlot);
                      setLimit(24);
                    }}
                  >
                    {vacancies.map((s) => (
                      <option value={s} key={s}>
                        {s} · {SLOT_NAMES[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ranking priority
                  <select
                    value={impactFocus}
                    onChange={(e) => {
                      setImpactFocus(e.target.value as DraftImpactFocus);
                      setLimit(24);
                    }}
                  >
                    {DRAFT_IMPACT_PRIORITIES.map((priority) => (
                      <option value={priority.key} key={priority.key}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p role="status">
                {impactPriority.label} at {impactSlot} ·{" "}
                {picks.length
                  ? "largest change first"
                  : "first pick: strongest starting profile first"}
                . Ranks cover all {pool.length} available players; filters
                preserve those ranks. Equal displayed scores share a rank.
              </p>
              <p className="draft-ranking-method">
                Balanced offense + defense weights them equally. A negative
                change lowers that average; a specialist may still fill a need.
                Ratings are roster estimates, not predicted wins. Position and
                priority carry into comparison.
              </p>
            </section>
          )}
          <p className="local-pool-count">
            {candidates.length} available · CPU picks happen automatically
            between friends' turns.
          </p>
          <div className="candidate-grid free-pool local-candidates">
            {candidates.slice(0, limit).map((p) => (
              <DraftProspectCard
                mon={p}
                key={p.id}
                advice={adviceById.get(p.id)!}
                selected={selected === p.id}
                compared={compared.includes(p.id)}
                compareFull={compared.length === 3}
                rankPosition={sort === "impact" ? "best" : sort}
                teamImpact={
                  sort === "impact"
                    ? {
                        entry: impactById.get(p.id)!,
                        slot: impactSlot,
                        poolSize: pool.length,
                      }
                    : undefined
                }
                onSelect={() => choose(p.id)}
                onCompare={() => toggleCompare(p.id)}
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
        {mon && selectedProfile && selectedAdvice && (
          <section
            className="local-panel draft-inspector"
            aria-label="Selected prospect"
          >
            <div className="draft-inspector-heading">
              <span className="eyebrow">ON YOUR RADAR</span>
              <button
                className="text-button"
                onClick={() => boardHeading.current?.focus()}
              >
                Back to players
              </button>
            </div>
            <div className="draft-inspector-player">
              <Portrait mon={mon} />
              <div>
                <h3 ref={selectedHeading} tabIndex={-1}>
                  {mon.name}
                </h3>
                <p>{selectedProfile.archetype}</p>
                <TypeBadges types={mon.types} />
                <p>
                  {mon.heightM} m · {mon.weightKg} kg
                </p>
              </div>
            </div>
            <div className="draft-role-verdict">
              <strong>
                {slot.startsWith("B")
                  ? `${slot} · ${selectedProfile.bestPosition} depth`
                  : `${slot} · ${SLOT_NAMES[slot]}`}
              </strong>
              <span>
                {Math.round(
                  selectedProfile.positions[
                    slot.startsWith("B")
                      ? selectedProfile.bestPosition
                      : (slot as Position)
                  ],
                )}
                <small>/100 fit</small>
              </span>
            </div>
            <div className="draft-pick-controls">
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
              {impact && (
                <DraftTeamImpact impact={impact} name={mon.name} slot={slot} />
              )}
              <button
                className="button primary"
                onClick={() => onPick(mon.id, slot)}
              >
                Confirm pick: {mon.name}
              </button>
            </div>
            <div className="draft-verdict">
              <p>
                <b>Why draft {mon.name}?</b>{" "}
                {selectedTools
                  .slice(0, 2)
                  .map((tool) => tool.helps)
                  .join(". ")}
                .
              </p>
              <p>
                <b>Tradeoff · {selectedTools.at(-1)!.label}.</b>{" "}
                {selectedTools.at(-1)!.tradeoff}
              </p>
            </div>
            <DraftToolBars mon={mon} />
            <p className="draft-rating-note">
              Ratings are 0–100 tools, not success percentages. The tradeoff is
              this player's weakest area among the eight tools shown.
            </p>
            <details className="local-scout">
              <summary>Full scouting & physical profile</summary>
              <ScoutReport mon={mon} />
              {draft.options && (
                <DepthScouting
                  mon={mon}
                  abilities={draft.options.engineRules.abilities}
                />
              )}
            </details>
          </section>
        )}
        <aside className={`local-draft-sidebar ${mon ? "has-inspector" : ""}`}>
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
