import { useEffect, useMemo, useRef, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import type { Franchise } from "../game/franchiseTypes";
import { bestPosition, positionRating } from "../game/ratings";
import {
  clubTradeProfile,
  evaluateTradePackage,
  suggestTrades,
  tradeMarketPlayers,
} from "../game/tradeMarket";
import type {
  SuggestionOptions,
  TradeMarketPlayer,
  TradePackage,
  TradeSuggestion,
} from "../game/tradeTypes";
import { POSITIONS, ROSTER_SLOTS, type LeagueTeam } from "../game/types";
import { Portrait } from "./Portrait";
import { ScoutReport } from "./ScoutReport";
import { TradeActivity } from "./OffseasonReport";
import "../tradeCenter.css";

export interface TradeCenterProps {
  franchise: Franchise;
  disabled?: boolean;
  onTrade: (offer: TradePackage) => void;
}

const nameOf = (id: number) => POKEMON_BY_ID.get(id)?.name ?? `Pokémon #${id}`;
const rosterIds = (team?: LeagueTeam) =>
  team
    ? ROSTER_SLOTS.flatMap((slot) =>
        team.roster[slot] === null ? [] : [team.roster[slot]!],
      )
    : [];
const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
const availabilityLabels = {
  available: "Available",
  listening: "Listening",
  core: "Core player",
};

function PlayerImage({ id }: { id: number }) {
  const mon = POKEMON_BY_ID.get(id);
  return mon ? (
    <span aria-hidden="true">
      <Portrait mon={mon} />
    </span>
  ) : null;
}

function PackageRoster({
  team,
  side,
  selected,
  onToggle,
  disabled,
  market,
}: {
  team: LeagueTeam;
  side: "Send" | "Receive";
  selected: number[];
  onToggle: (id: number) => void;
  disabled: boolean;
  market: Map<number, TradeMarketPlayer>;
}) {
  return (
    <ul className="trade-package-roster" aria-label={`${side} players`}>
      {ROSTER_SLOTS.map((slot) => {
        const id = team.roster[slot],
          mon = POKEMON_BY_ID.get(id ?? -1);
        if (id === null || !mon) return null;
        const development = team.development?.[id],
          position = bestPosition(mon, development);
        const entry = market.get(id);
        return (
          <li key={slot}>
            <label className={selected.includes(id) ? "selected" : ""}>
              <input
                type="checkbox"
                aria-label={`${side} ${mon.name}`}
                checked={selected.includes(id)}
                disabled={
                  disabled || (selected.length >= 3 && !selected.includes(id))
                }
                onChange={() => onToggle(id)}
              />
              <PlayerImage id={id} />
              <span className="trade-package-identity">
                <strong>{mon.name}</strong>
                <small>
                  {slot} · Best fit {position}
                  {entry ? ` · ${availabilityLabels[entry.availability]}` : ""}
                </small>
              </span>
              <b className="trade-player-rating">
                {positionRating(mon, position, development).toFixed(1)}
                <small>RATING</small>
              </b>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function TradeCenter({
  franchise,
  disabled = false,
  onTrade,
}: TradeCenterProps) {
  const partners = franchise.teams.filter((team) => team.id !== 0);
  const user = franchise.teams.find((team) => team.id === 0);
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? 1);
  const partner = partners.find((team) => team.id === partnerId) ?? partners[0];
  const [selectedGive, setSelectedGive] = useState<number[]>([]);
  const [selectedReceive, setSelectedReceive] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [sort, setSort] = useState("rating");
  const [status, setStatus] = useState("");
  const [scoutId, setScoutId] = useState<number | null>(null);
  const [searchMode, setSearchMode] = useState("outgoing");
  const [suggestionSize, setSuggestionSize] = useState("auto");
  const [suggestionScope, setSuggestionScope] = useState("all");
  const [suggestions, setSuggestions] = useState<TradeSuggestion[] | null>(
    null,
  );
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submitGuard = useRef(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const builderRef = useRef<HTMLHeadingElement>(null);
  const scoutRef = useRef<HTMLDivElement>(null);
  const previousFranchise = useRef(franchise);
  const market = useMemo(() => tradeMarketPlayers(franchise), [franchise]);
  const marketById = useMemo(
    () => new Map(market.map((entry) => [entry.pokemonId, entry])),
    [market],
  );
  const giveIds = selectedGive.filter((id) => rosterIds(user).includes(id));
  const receiveIds = selectedReceive.filter((id) =>
    rosterIds(partner).includes(id),
  );
  const latestDraft = franchise.rookieDrafts?.at(-1);
  const drafting =
    latestDraft?.year === franchise.year && !latestDraft.complete;
  const lockReason = drafting
    ? "Complete the current rookie draft before trading."
    : franchise.phase !== "offseason"
      ? "Trading opens after the season ends."
      : disabled
        ? "Trading is temporarily unavailable while the current offseason step finishes."
        : "";
  const locked = !!lockReason || searchBusy;
  const complete = giveIds.length > 0 && giveIds.length === receiveIds.length;
  const offer: TradePackage = {
    teamId: partner?.id ?? -1,
    giveIds,
    receiveIds,
  };
  const evaluation = useMemo(
    () => (complete ? evaluateTradePackage(franchise, offer) : null),
    [franchise, partner?.id, giveIds.join(","), receiveIds.join(","), complete],
  );
  const profile = useMemo(
    () => (partner ? clubTradeProfile(franchise, partner.id) : null),
    [franchise, partner?.id],
  );
  const visible = market
    .filter((entry) => {
      const club = franchise.teams.find((team) => team.id === entry.teamId);
      const text =
        `${nameOf(entry.pokemonId)} ${club?.name ?? ""}`.toLocaleLowerCase();
      return (
        text.includes(query.trim().toLocaleLowerCase()) &&
        (teamFilter === "all" || entry.teamId === Number(teamFilter)) &&
        (positionFilter === "all" || entry.position === positionFilter) &&
        (availabilityFilter === "all" ||
          entry.availability === availabilityFilter)
      );
    })
    .sort((a, b) =>
      sort === "name"
        ? nameOf(a.pokemonId).localeCompare(nameOf(b.pokemonId))
        : sort === "trend"
          ? b.trend - a.trend || b.rating - a.rating
          : b.rating - a.rating || a.pokemonId - b.pokemonId,
    );
  const currentTrades = franchise.trades.filter(
    (trade) => trade.year === franchise.year && trade.source !== "cpu",
  );
  const offerKey = `${partner?.id}:${giveIds.join(",")}:${receiveIds.join(",")}`;
  const suggestionKey = `${offerKey}:${suggestionSize}:${searchMode}:${suggestionScope}`;
  const suggestionSizeMismatch =
    searchMode === "outgoing" &&
    suggestionSize !== "auto" &&
    giveIds.length !== Number(suggestionSize);

  useEffect(() => {
    submitGuard.current = false;
    setSubmitted(false);
  }, [franchise, offerKey]);
  useEffect(() => {
    setSuggestions(null);
    setSearchBusy(false);
    setSearchError("");
    return () => {
      if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    };
  }, [franchise, suggestionKey, disabled]);

  useEffect(() => {
    if (previousFranchise.current === franchise) return;
    const previous = previousFranchise.current;
    previousFranchise.current = franchise;
    if (previous.teams !== franchise.teams) {
      setSelectedGive((ids) =>
        ids.filter((id) => rosterIds(user).includes(id)),
      );
      setSelectedReceive((ids) =>
        ids.filter((id) => rosterIds(partner).includes(id)),
      );
      setStatus(
        franchise.trades.length > previous.trades.length
          ? "Trade completed. Your roster and market are updated."
          : "Roster changed. Your selections and coach feedback are updated.",
      );
    }
  }, [franchise, user, partner]);
  useEffect(() => {
    if (scoutId === null) return;
    scoutRef.current?.focus();
    scoutRef.current?.scrollIntoView?.({
      block: "nearest",
      behavior: "smooth",
    });
  }, [scoutId]);

  function toggle(id: number, side: "give" | "receive") {
    const set = side === "give" ? setSelectedGive : setSelectedReceive;
    set((ids) =>
      ids.includes(id)
        ? ids.filter((value) => value !== id)
        : ids.length < 3
          ? [...ids, id]
          : ids,
    );
    setStatus("");
  }
  function target(entry: TradeMarketPlayer) {
    setPartnerId(entry.teamId);
    setSelectedReceive([entry.pokemonId]);
    setSearchMode("target");
    setStatus(
      `${nameOf(entry.pokemonId)} added to the offer. Select the players you would send.`,
    );
    builderRef.current?.focus();
    builderRef.current?.scrollIntoView?.({
      block: "start",
      behavior: "smooth",
    });
  }
  function findDeals() {
    if (
      locked ||
      suggestionSizeMismatch ||
      (searchMode === "target" ? !receiveIds.length : !giveIds.length)
    )
      return;
    const options: SuggestionOptions = {
      ...(suggestionSize === "auto"
        ? {}
        : { packageSize: Number(suggestionSize) as 1 | 2 | 3 }),
      ...(searchMode === "target"
        ? { targetId: receiveIds[0], teamId: partner.id }
        : {
            giveIds: [...giveIds],
            ...(suggestionScope === "partner" ? { teamId: partner.id } : {}),
          }),
      limit: 5,
    };
    setSearchBusy(true);
    setSearchError("");
    setSuggestions(null);
    searchTimer.current = setTimeout(() => {
      try {
        setSuggestions(suggestTrades(franchise, options));
      } catch {
        setSearchError(
          "The deal search could not finish. Try a different package or club.",
        );
      } finally {
        setSearchBusy(false);
        searchTimer.current = null;
      }
    }, 0);
  }
  function reviewOffer(suggestion: TradeSuggestion) {
    if (locked) return;
    if (!evaluateTradePackage(franchise, suggestion.offer).accepted) {
      setSuggestions(null);
      setStatus(
        "This offer has changed. Run Find deals again for current options.",
      );
      return;
    }
    setPartnerId(suggestion.offer.teamId);
    setSelectedGive([...suggestion.offer.giveIds]);
    setSelectedReceive([...suggestion.offer.receiveIds]);
    setStatus(
      "Offer loaded for review. Complete the trade when you are ready.",
    );
    builderRef.current?.focus();
    builderRef.current?.scrollIntoView?.({
      block: "start",
      behavior: "smooth",
    });
  }
  function completeTrade() {
    if (locked || submitGuard.current || !evaluation?.accepted) return;
    if (!evaluateTradePackage(franchise, offer).accepted) {
      setStatus(
        "The coach no longer accepts this offer. Review the updated package.",
      );
      return;
    }
    submitGuard.current = true;
    setSubmitted(true);
    setStatus("Offer submitted for final validation.");
    try {
      onTrade({ ...offer, giveIds: [...giveIds], receiveIds: [...receiveIds] });
    } catch {
      submitGuard.current = false;
      setSubmitted(false);
      setStatus(
        "The trade could not be completed. Review the package and try again.",
      );
    }
  }
  const scoutMon = POKEMON_BY_ID.get(scoutId ?? -1);
  const scoutTeam = franchise.teams.find((team) =>
    rosterIds(team).includes(scoutId ?? -1),
  );

  if (!user || !partner) return <p>No trading partners are available.</p>;
  return (
    <section className="trade-center" aria-label="Trade center">
      <header className="trade-center-heading">
        <div>
          <span className="eyebrow">THE TRADE DESK</span>
          <h3>Find the right fit.</h3>
          <p>
            Explore the league, build a package and see what each coach values.
          </p>
        </div>
        <span className="trade-rule">1-for-1 · 2-for-2 · 3-for-3</span>
      </header>
      {lockReason && (
        <p className="trade-lock-message" role="status">
          {lockReason}
        </p>
      )}
      <section className="trade-market" aria-label="Trade market">
        <div className="trade-market-heading">
          <h4>Market watch</h4>
          <span>
            {market.length} players · {partners.length} clubs
          </span>
        </div>
        <div className="trade-market-filters">
          <label className="league-field trade-search">
            Search trade market
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pokémon or club name"
            />
          </label>
          <label className="league-field">
            Filter market by team
            <select
              value={teamFilter}
              onChange={(event) => setTeamFilter(event.target.value)}
            >
              <option value="all">All clubs</option>
              {partners.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="league-field">
            Filter market by position
            <select
              value={positionFilter}
              onChange={(event) => setPositionFilter(event.target.value)}
            >
              <option value="all">All positions</option>
              {POSITIONS.map((position) => (
                <option key={position}>{position}</option>
              ))}
            </select>
          </label>
          <label className="league-field">
            Filter market by availability
            <select
              value={availabilityFilter}
              onChange={(event) => setAvailabilityFilter(event.target.value)}
            >
              <option value="all">All availability</option>
              {Object.entries(availabilityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="trade-market-toolbar">
          <p role="status">{visible.length} players match</p>
          <label className="trade-sort">
            Sort market
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="rating">Highest rating</option>
              <option value="trend">Biggest improvement</option>
              <option value="name">Pokémon name</option>
            </select>
          </label>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setQuery("");
              setTeamFilter("all");
              setPositionFilter("all");
              setAvailabilityFilter("all");
            }}
          >
            Reset market filters
          </button>
        </div>
        <p className="trade-market-key">
          Available: open to a move · Listening: needs the right fit · Core
          player: a higher asking price. Every offer gets a fair evaluation.
        </p>
        {!visible.length && (
          <p className="trade-empty">
            No players match these filters. Try another club, position or name.
          </p>
        )}
        <ul className="trade-market-list" aria-label="Trade market players">
          {visible.map((entry) => (
            <li className="trade-market-card" key={entry.pokemonId}>
              <div className="trade-market-identity">
                <PlayerImage id={entry.pokemonId} />
                <div>
                  <strong>{nameOf(entry.pokemonId)}</strong>
                  <small>
                    {
                      franchise.teams.find((team) => team.id === entry.teamId)
                        ?.name
                    }
                  </small>
                </div>
                <b className="trade-player-rating">
                  {entry.rating.toFixed(1)}
                  <small>RATING</small>
                </b>
              </div>
              <div className="trade-market-meta">
                <span className={`trade-availability ${entry.availability}`}>
                  {availabilityLabels[entry.availability]}
                </span>
                <span>
                  {entry.position} · {entry.role}
                </span>
              </div>
              <p className="trade-market-reason">{entry.reason}</p>
              <small
                className={
                  entry.trend > 0
                    ? "trade-trend gain"
                    : entry.trend < 0
                      ? "trade-trend loss"
                      : "trade-trend"
                }
              >
                Development {signed(entry.trend)}
              </small>
              <div className="trade-market-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={locked}
                  onClick={() => target(entry)}
                  aria-label={`Target ${nameOf(entry.pokemonId)}`}
                >
                  Target player
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setScoutId(entry.pokemonId)}
                  aria-label={`Scout ${nameOf(entry.pokemonId)}`}
                >
                  Scout
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {scoutMon && (
        <div className="franchise-scout" ref={scoutRef} tabIndex={-1}>
          <button
            type="button"
            className="text-button"
            onClick={() => setScoutId(null)}
          >
            Close scouting report
          </button>
          <ScoutReport
            mon={scoutMon}
            development={scoutTeam?.development?.[scoutMon.id]}
          />
        </div>
      )}
      <section className="trade-builder" aria-label="Package builder">
        <div className="trade-builder-heading">
          <div>
            <span className="eyebrow">BUILD YOUR OFFER</span>
            <h4 ref={builderRef} tabIndex={-1}>
              A deal that works for both clubs.
            </h4>
          </div>
          <button
            type="button"
            className="text-button"
            disabled={locked || (!giveIds.length && !receiveIds.length)}
            onClick={() => {
              setSelectedGive([]);
              setSelectedReceive([]);
              setStatus("");
            }}
          >
            Clear package
          </button>
        </div>
        <label className="league-field trade-partner">
          Trade partner
          <select
            value={partner.id}
            disabled={locked}
            onChange={(event) => {
              setPartnerId(Number(event.target.value));
              setSelectedReceive([]);
              setStatus("");
            }}
          >
            {partners.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        {profile && (
          <div className="trade-club-profile">
            <span className={`trade-direction ${profile.direction}`}>
              {profile.title}
            </span>
            <div>
              <strong>{partner.name}'s priorities</strong>
              <p>{profile.priorities.join(" · ")}</p>
              <p>{profile.reason}</p>
            </div>
          </div>
        )}
        <div className="trade-package-columns">
          <div>
            <div className="trade-package-title">
              <h4>You send</h4>
              <span>{giveIds.length} / 3 selected</span>
            </div>
            <PackageRoster
              team={user}
              side="Send"
              selected={giveIds}
              onToggle={(id) => toggle(id, "give")}
              disabled={locked}
              market={marketById}
            />
          </div>
          <div>
            <div className="trade-package-title">
              <h4>You receive</h4>
              <span>{receiveIds.length} / 3 selected</span>
            </div>
            <PackageRoster
              team={partner}
              side="Receive"
              selected={receiveIds}
              onToggle={(id) => toggle(id, "receive")}
              disabled={locked}
              market={marketById}
            />
          </div>
        </div>
        <section
          className={`trade-verdict ${evaluation?.accepted ? "accepted" : ""}`}
          aria-label="Coach evaluation"
        >
          <p className="trade-package-count">
            {giveIds.length} sent · {receiveIds.length} received ·{" "}
            {complete
              ? "Both clubs keep eight players."
              : "Choose the same number on each side, up to three."}
          </p>
          {evaluation ? (
            <>
              <h4>
                {evaluation.accepted
                  ? "Coach accepts this offer"
                  : "Coach declines this offer"}
              </h4>
              <p>{evaluation.reason}</p>
              <div className="trade-value-summary">
                <span>
                  {franchise.teams[0]?.evaluationVersion === 1
                    ? "Your shared team value"
                    : "Your club fit"}{" "}
                  <b>{signed(evaluation.userDelta)}</b>
                </span>
                <span>
                  {franchise.teams[0]?.evaluationVersion === 1
                    ? "Partner shared team value"
                    : "Partner club fit"}{" "}
                  <b>
                    {evaluation.partnerBefore.toFixed(1)} →{" "}
                    {evaluation.partnerAfter.toFixed(1)}
                  </b>
                </span>
              </div>
              <details className="trade-factors">
                <summary>
                  Why this coach says {evaluation.accepted ? "yes" : "no"}
                </summary>
                <ul>
                  {evaluation.factors.map((factor, index) => (
                    <li key={index}>
                      <strong>
                        {factor.label}
                        <span>{signed(factor.contribution)}</span>
                      </strong>
                      <p>{factor.detail}</p>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            <>
              <h4>Put your package on the table.</h4>
              <p>
                Select one, two or three players from each club for a live
                decision.
              </p>
            </>
          )}
          <button
            type="button"
            className="button primary"
            disabled={locked || submitted || !evaluation?.accepted}
            onClick={completeTrade}
          >
            Complete trade
          </button>
        </section>
        <p className="trade-feedback" role="status">
          {status}
        </p>
      </section>
      <section
        className="trade-suggestions"
        aria-label="Deal finder"
        aria-busy={searchBusy}
      >
        <span className="eyebrow">DEAL FINDER</span>
        <h4>Find a way to make it work.</h4>
        <p>
          Find accepted offers for a target or the players you want to move.
          Every suggestion can be reviewed before trading.
        </p>
        <div className="trade-suggestion-controls">
          <label className="league-field">
            Find deals for
            <select
              value={searchMode}
              disabled={locked}
              onChange={(event) => setSearchMode(event.target.value)}
            >
              <option value="outgoing">My outgoing package</option>
              <option value="target">My selected target</option>
            </select>
          </label>
          <label className="league-field">
            Suggestion package size
            <select
              value={suggestionSize}
              disabled={locked}
              onChange={(event) => setSuggestionSize(event.target.value)}
            >
              <option value="auto">Automatic</option>
              <option value="1">1-for-1</option>
              <option value="2">2-for-2</option>
              <option value="3">3-for-3</option>
            </select>
          </label>
          {searchMode === "outgoing" && (
            <label className="league-field">
              Search clubs
              <select
                value={suggestionScope}
                disabled={locked}
                onChange={(event) => setSuggestionScope(event.target.value)}
              >
                <option value="all">All clubs</option>
                <option value="partner">{partner.name} only</option>
              </select>
            </label>
          )}
          <button
            type="button"
            className="button secondary"
            disabled={
              locked ||
              suggestionSizeMismatch ||
              (searchMode === "target" ? !receiveIds.length : !giveIds.length)
            }
            onClick={findDeals}
          >
            {searchBusy ? "Finding deals…" : "Find deals"}
          </button>
        </div>
        <p className="trade-search-context">
          {searchMode === "target"
            ? receiveIds.length
              ? `Target: ${nameOf(receiveIds[0])}. Other package slots can change.`
              : "Choose a target from the market or select a player to receive."
            : giveIds.length
              ? `Keep in every offer: ${giveIds.map(nameOf).join(", ")}.`
              : "Select the players you would send in the package builder."}{" "}
          Automatic uses your outgoing package size, or 1-for-1 for a target.
        </p>
        {suggestionSizeMismatch && (
          <p className="trade-feedback" role="status">
            Select exactly {suggestionSize} players to send for a{" "}
            {suggestionSize}-for-{suggestionSize} search, or choose Automatic.
          </p>
        )}
        {searchBusy && (
          <p role="status">Checking packages against club priorities…</p>
        )}
        {searchError && <p role="status">{searchError}</p>}
        {suggestions?.length === 0 && (
          <p className="trade-empty" role="status">
            No accepted offers found in this search. Try a different package,
            size or target. This search checks a limited set of offers; other
            deals may still work.
          </p>
        )}
        {!!suggestions?.length && (
          <>
            <p className="trade-results-count" role="status">
              {suggestions.length} accepted offers found. Review the value for
              your club before trading.
            </p>
            <ol
              className="trade-suggestion-list"
              aria-label="Accepted trade suggestions"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={`${suggestion.offer.teamId}:${suggestion.offer.giveIds.join(",")}:${suggestion.offer.receiveIds.join(",")}`}
                >
                  <div className="trade-suggestion-heading">
                    <strong>
                      {
                        franchise.teams.find(
                          (team) => team.id === suggestion.offer.teamId,
                        )?.name
                      }
                    </strong>
                    <span>
                      {suggestion.offer.giveIds.length}-for-
                      {suggestion.offer.receiveIds.length}
                    </span>
                  </div>
                  <p>
                    <b>Send</b>{" "}
                    {suggestion.offer.giveIds.map(nameOf).join(", ")}
                  </p>
                  <p>
                    <b>Receive</b>{" "}
                    {suggestion.offer.receiveIds.map(nameOf).join(", ")}
                  </p>
                  <p>{suggestion.evaluation.reason}</p>
                  <div className="trade-suggestion-footer">
                    <span>
                      {franchise.teams[0]?.evaluationVersion === 1
                        ? "Your shared team value"
                        : "Your club fit"}{" "}
                      {signed(suggestion.evaluation.userDelta)}
                    </span>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={locked}
                      onClick={() => reviewOffer(suggestion)}
                      aria-label={`Review offer ${index + 1}`}
                    >
                      Review offer
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
      {!!currentTrades.length && (
        <details className="franchise-trade-log">
          <summary>Your trades this offseason ({currentTrades.length})</summary>
          <ol>
            {currentTrades.map((trade, index) => (
              <li key={index}>
                <TradeActivity trade={trade} teams={franchise.teams} />
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
