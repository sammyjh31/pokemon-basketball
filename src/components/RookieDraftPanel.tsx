import { EvaluationFactors } from "./EvaluationFactors";
import { useMemo, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import { cpuRulesApply } from "../game/cpuRules";
import { lotteryOrder, recordOrder } from "../game/draftLottery";
import {
  draftTurn,
  generationForDraft,
  recommendedRookiePick,
  rookieGenerationLabel,
  rookieProspects,
} from "../game/rookieDraft";
import { bestPosition, positionRating } from "../game/ratings";
import {
  POSITIONS,
  ROSTER_SLOTS,
  type GameState,
  type Position,
} from "../game/types";
import { Portrait } from "./Portrait";
import { ScoutReport } from "./ScoutReport";
import "../rookieDraft.css";

export interface RookieDraftPanelProps {
  state: GameState;
  disabled?: boolean;
  onBegin: () => void;
  onAdvance: () => void;
  onPick: (pokemonId: number, releaseId: number) => void;
  /** Model-2 drafts let the user keep their roster for a turn. */
  onPass?: () => void;
}

export function RookieDraftPanel(props: RookieDraftPanelProps) {
  const f = props.state.franchise;
  if (!f || f.phase !== "offseason") return null;
  const draft = f.rookieDrafts?.find((record) => record.year === f.year);
  return (
    <DraftRoom
      key={`${f.year}:${draft ? draftTurn(draft) : "ready"}`}
      {...props}
    />
  );
}

function DraftRoom({
  state,
  disabled,
  onBegin,
  onAdvance,
  onPick,
  onPass,
}: RookieDraftPanelProps) {
  const f = state.franchise!,
    user = f.teams[0];
  const draft = f.rookieDrafts?.find((record) => record.year === f.year);
  const generation =
    draft?.generation ?? generationForDraft(f.rookieDrafts?.length ?? 0);
  const processed = !!f.offseasons?.some((report) => report.year === f.year);
  const turn = draft ? draftTurn(draft) : 0,
    lottery = draft ? draft.modelVersion === 2 : cpuRulesApply(f);
  const userTurn = !!draft && !draft.complete && draft.order[turn % 30] === 0;
  const prospects = useMemo(
    () => rookieProspects(f, state.run.includeLegends),
    [f, state.run.includeLegends],
  );
  const recommendation = useMemo(
    () =>
      userTurn ? recommendedRookiePick(f, 0, state.run.includeLegends) : null,
    [f, state.run.includeLegends, userTurn],
  );
  const [search, setSearch] = useState(""),
    [position, setPosition] = useState<Position | "">("");
  const [selectedId, setSelectedId] = useState<number | null>(null),
    [releasedId, setReleasedId] = useState<number | null>(null);
  const chosen = prospects.find((mon) => mon.id === selectedId);
  const released = POKEMON_BY_ID.get(releasedId ?? -1);
  const candidates = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/^#/, "");
    return prospects
      .filter(
        (mon) =>
          (!query ||
            mon.name.toLowerCase().includes(query) ||
            String(mon.id) === query) &&
          (!position || bestPosition(mon) === position),
      )
      .sort(
        (a, b) =>
          positionRating(b, position || bestPosition(b)) -
            positionRating(a, position || bestPosition(a)) || a.id - b.id,
      );
  }, [prospects, search, position]);
  const season = f.history.at(-1);
  const order =
    draft?.order ??
    (lottery && season
      ? lotteryOrder(season.standings, season.seasonSeed)
      : recordOrder(season?.standings ?? []));
  const releasedSlot = ROSTER_SLOTS.find(
    (slot) => user.roster[slot] === releasedId,
  );

  return (
    <section className="rookie-draft" aria-label="Rookie draft">
      <div className="rookie-heading">
        <div>
          <span className="eyebrow">YEAR {f.year} · THE NEXT CLASS</span>
          <h3>Rookie draft</h3>
        </div>
        <span className="rookie-class">
          {rookieGenerationLabel(generation)}
        </span>
      </div>
      <p className="rookie-intro">
        Two rounds, 30 picks per round. Each rookie replaces one player on an
        eight-player roster.{" "}
        {lottery
          ? "The 14 clubs that missed the playoffs draw weighted lottery odds for the first four picks; the rest follow reverse record order in both rounds. A club may pass instead of releasing a player it values more."
          : "The worst record picks first in both rounds."}
      </p>
      {!draft ? (
        <div className="rookie-ready">
          <p>
            {prospects.length} eligible prospects. Your picks:{" "}
            {order.indexOf(0) + 1} and {order.indexOf(0) + 31}.
          </p>
          {!processed && (
            <p className="rookie-note">
              Process player development before beginning this draft.
            </p>
          )}
          <button
            className="button primary"
            disabled={disabled || !processed}
            onClick={onBegin}
          >
            Begin rookie draft
          </button>
        </div>
      ) : (
        <>
          <div className="rookie-progress" role="status" aria-live="polite">
            <strong>
              {draft.complete
                ? "Draft complete"
                : `Round ${turn < 30 ? 1 : 2} · Pick ${turn + 1} of 60`}
            </strong>
            <span>
              {draft.picks.length} of 60 picks made
              {draft.passes?.length ? ` · ${draft.passes.length} passed` : ""}
            </span>
            <progress
              max={60}
              value={draft.complete ? 60 : turn}
              aria-label="Rookie draft progress"
            />
            {!draft.complete && (
              <p>
                {userTurn
                  ? "You are on the clock."
                  : `${f.teams[draft.order[turn % 30]]?.name ?? "CPU club"} is on the clock.`}
              </p>
            )}
          </div>
          {draft.exhausted && (
            <p className="rookie-note">
              No eligible rookies remain. {60 - turn} remaining picks skipped.
              The franchise can continue.
            </p>
          )}
          {!draft.complete && (!userTurn || prospects.length === 0) && (
            <button
              className="button primary"
              disabled={disabled}
              onClick={onAdvance}
            >
              {prospects.length
                ? "Advance to your pick"
                : "Finish exhausted draft"}
            </button>
          )}
          {userTurn && prospects.length > 0 && (
            <fieldset className="rookie-controls" disabled={disabled}>
              <legend className="sr-only">
                Choose your rookie and player to release
              </legend>
              {recommendation && (
                <div className="rookie-recommendation">
                  <div>
                    <span className="eyebrow">COACH'S RECOMMENDATION</span>
                    <p>
                      <strong>
                        {POKEMON_BY_ID.get(recommendation.pokemonId)?.name}
                      </strong>{" "}
                      for {POKEMON_BY_ID.get(recommendation.releasedId)?.name}
                    </p>
                    <small>
                      Based on ability, positional fit and your rotation's
                      needs.
                    </small>
                    <EvaluationFactors factors={recommendation.factors} />
                    {recommendation.reason && (
                      <p className="muted">{recommendation.reason}</p>
                    )}
                  </div>
                  <button
                    className="button"
                    onClick={() =>
                      onPick(
                        recommendation.pokemonId,
                        recommendation.releasedId,
                      )
                    }
                  >
                    Draft recommended pick
                  </button>
                </div>
              )}
              {lottery && onPass && (
                <div className="rookie-recommendation">
                  <p>
                    Keep your current eight instead and pass this pick. The turn
                    is used and nobody is released.
                  </p>
                  <button className="button" onClick={onPass}>
                    Pass this pick
                  </button>
                </div>
              )}
              <div className="rookie-workspace">
                <div className="rookie-catalog">
                  <div className="rookie-filters">
                    <label>
                      Search prospects
                      <input
                        type="search"
                        aria-label="Search rookie prospects"
                        placeholder="Name or Pokédex number"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </label>
                    <label>
                      Best position
                      <select
                        aria-label="Rookie position"
                        value={position}
                        onChange={(event) =>
                          setPosition(event.target.value as Position | "")
                        }
                      >
                        <option value="">All positions</option>
                        {POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            {pos}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="rookie-count">
                    {candidates.length} prospects · highest fit first
                  </p>
                  <div
                    className="rookie-prospects"
                    aria-label="Available rookie prospects"
                  >
                    {candidates.map((mon) => {
                      const best = bestPosition(mon);
                      return (
                        <button
                          key={mon.id}
                          className={`rookie-prospect ${selectedId === mon.id ? "selected" : ""}`}
                          aria-label={`Scout ${mon.name}`}
                          aria-pressed={selectedId === mon.id}
                          onClick={() => setSelectedId(mon.id)}
                        >
                          <Portrait mon={mon} />
                          <span>
                            <strong>{mon.name}</strong>
                            <small>
                              #{mon.id} · {best}
                            </small>
                          </span>
                          <b>{Math.round(positionRating(mon, best))}</b>
                        </button>
                      );
                    })}
                    {!candidates.length && (
                      <p className="rookie-empty">
                        No prospects match these filters.
                      </p>
                    )}
                  </div>
                </div>
                <div className="rookie-selection">
                  {chosen ? (
                    <>
                      <div className="rookie-selected">
                        <Portrait mon={chosen} />
                        <div>
                          <span className="eyebrow">YOUR SELECTION</span>
                          <h4>{chosen.name}</h4>
                        </div>
                      </div>
                      <ScoutReport mon={chosen} />
                    </>
                  ) : (
                    <p className="rookie-empty">
                      Select a prospect to inspect their scouting report, then
                      choose the player they will replace.
                    </p>
                  )}
                  <label>
                    Player to release
                    <select
                      aria-label="Player to release"
                      value={releasedId ?? ""}
                      onChange={(event) =>
                        setReleasedId(
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                    >
                      <option value="">Choose an outgoing player</option>
                      {ROSTER_SLOTS.map((slot) => {
                        const mon = POKEMON_BY_ID.get(user.roster[slot]!);
                        return (
                          mon && (
                            <option key={slot} value={mon.id}>
                              {slot} · {mon.name}
                            </option>
                          )
                        );
                      })}
                    </select>
                  </label>
                  {chosen && released && releasedSlot && (
                    <p className="rookie-note">
                      {chosen.name} replaces {released.name} at {releasedSlot}{" "}
                      and inherits that slot's minutes. {released.name}'s career
                      records remain available.
                    </p>
                  )}
                  <button
                    className="button primary"
                    disabled={!chosen || !releasedSlot}
                    onClick={() => {
                      if (chosen && releasedId !== null && releasedSlot)
                        onPick(chosen.id, releasedId);
                    }}
                  >
                    {chosen ? `Draft ${chosen.name}` : "Choose a prospect"}
                  </button>
                </div>
              </div>
            </fieldset>
          )}
        </>
      )}
      <details className="rookie-order">
        <summary>Draft order · same order for both rounds</summary>
        <ol>
          {order.map((teamId) => (
            <li className={teamId === 0 ? "user" : ""} key={teamId}>
              {f.teams[teamId]?.name}
              {teamId === 0 ? " · You" : ""}
            </li>
          ))}
        </ol>
      </details>
      {draft && (
        <div className="rookie-board">
          <h4>Draft board</h4>
          {draft.picks.length ? (
            <div className="rookie-table-scroll">
              <table aria-label="Rookie draft board">
                <thead>
                  <tr>
                    <th>Pick</th>
                    <th>Club</th>
                    <th>Rookie</th>
                    <th>Released</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.picks.map((pick) => (
                    <tr
                      key={pick.pick}
                      className={pick.teamId === 0 ? "user" : ""}
                    >
                      <td>
                        <b>{pick.pick}</b>
                        <small>Round {pick.round}</small>
                      </td>
                      <td>{f.teams[pick.teamId]?.name}</td>
                      <td>{POKEMON_BY_ID.get(pick.pokemonId)?.name}</td>
                      <td>{POKEMON_BY_ID.get(pick.releasedId)?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rookie-empty">No selections yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
