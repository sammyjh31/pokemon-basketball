import { CoachTrainingPanel } from "./CoachTrainingPanel";
import { CoachOfficePanel } from "./CoachOfficePanel";
import { projectedCoaches } from "../game/coachOffice";
import { franchiseCoachRecords } from "../game/coachCareers";
import { CareerDetail } from "./CareerDetail";
import { HistoricalGames } from "./HistoricalGames";
import { TrainingPanel } from "./TrainingPanel";
import { TradeCenter } from "./TradeCenter";
import { OffseasonRoster } from "./OffseasonRoster";
import { RookieDraftPanel } from "./RookieDraftPanel";
import { FreeAgentMarket } from "./FreeAgentMarket";
import type { TrainingPlans } from "../game/franchiseFeatures";
import type { TradePackage } from "../game/tradeTypes";
import type { OffseasonRosterSettings } from "../game/offseasonRoster";
import { useEffect, useMemo, useRef, useState } from "react";
import { POKEMON_BY_ID } from "../data/pokemon";
import { careerPlayers, evaluateTrade } from "../game/franchise";
import { FRANCHISE_MAX_YEARS } from "../game/franchiseTypes";
import type {
  CareerTotals,
  Franchise,
  HistoricalHonor,
} from "../game/franchiseTypes";
import {
  ROSTER_SLOTS,
  type GameState,
  type LeagueTeam,
  type Run,
} from "../game/types";
import { Portrait } from "./Portrait";
import { ScoutReport } from "./ScoutReport";
import { OffseasonReport, TradeActivity } from "./OffseasonReport";
import { bestPosition, positionRating } from "../game/ratings";
import "../league.css";
import "../franchise.css";

export interface FranchisePanelProps {
  onHireCoach?: (id: string | null) => void;
  onReviewCoaches?: () => void;
  state: GameState;
  disabled?: boolean;
  onEnterOffseason: () => void;
  onStartSeason: () => void;
  onSimulateSeason?: () => void;
  onProcessOffseason?: () => void;
  onTraining?: (plans: TrainingPlans) => void;
  onTrade: (teamId: number, giveId: number, receiveId: number) => void;
  onTradePackage?: (offer: TradePackage) => void;
  onRoster?: (settings: OffseasonRosterSettings) => void;
  onBeginDraft?: () => void;
  onAdvanceDraft?: () => void;
  onPickRookie?: (pokemonId: number, releasedId: number) => void;
  onSignFreeAgent?: (pokemonId: number, releasedId: number) => void;
  onCpuFreeAgency?: () => void;
}

const playerName = (id: number) =>
  POKEMON_BY_ID.get(id)?.name ?? `Pokémon #${id}`;
const teamName = (teams: LeagueTeam[], id: number) =>
  teams.find((team) => team.id === id)?.name ?? "Unknown team";
const rosterIds = (team: LeagueTeam) =>
  ROSTER_SLOTS.flatMap((slot) =>
    team.roster[slot] === null ? [] : [team.roster[slot]!],
  );
const finalsComplete = (run: Run) =>
  run.playoffs?.championId != null && run.playoffs.finalsMvp != null;

function PlayerPortrait({ id }: { id: number }) {
  const mon = POKEMON_BY_ID.get(id);
  return mon ? (
    <span aria-hidden="true">
      <Portrait mon={mon} />
    </span>
  ) : null;
}

function Offseason({
  state,
  franchise,
  disabled,
  onStartSeason,
  onTrade,
  onProcessOffseason,
  onReviewDevelopment,
  onTradePackage,
  onRoster,
  onBeginDraft,
  onAdvanceDraft,
  onPickRookie,
  onSignFreeAgent,
  onCpuFreeAgency,
}: Pick<
  FranchisePanelProps,
  | "state"
  | "disabled"
  | "onStartSeason"
  | "onTrade"
  | "onProcessOffseason"
  | "onTradePackage"
  | "onRoster"
  | "onBeginDraft"
  | "onAdvanceDraft"
  | "onPickRookie"
  | "onSignFreeAgent"
  | "onCpuFreeAgency"
> & {
  onReviewDevelopment: () => void;
  franchise: Franchise;
}) {
  const partners = franchise.teams.filter((team) => team.id !== 0);
  const user = franchise.teams.find((team) => team.id === 0)!;
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? 1);
  const partner = partners.find((team) => team.id === partnerId) ?? partners[0];
  const [scoutId, setScoutId] = useState<number | null>(null);
  const scoutRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scoutId === null) return;
    scoutRef.current?.focus();
    scoutRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [scoutId]);
  const scoutTeam = franchise.teams.find((team) =>
    rosterIds(team).includes(scoutId ?? -1),
  );
  const scoutMon = POKEMON_BY_ID.get(scoutId ?? -1);
  const outgoing = rosterIds(user),
    incoming = partner ? rosterIds(partner) : [];
  const [selectedGive, setSelectedGive] = useState(outgoing[0]);
  const [selectedReceive, setSelectedReceive] = useState(incoming[0]);
  const giveId = outgoing.includes(selectedGive) ? selectedGive : outgoing[0];
  const receiveId = incoming.includes(selectedReceive)
    ? selectedReceive
    : incoming[0];
  const evaluation =
    partner && giveId != null && receiveId != null
      ? evaluateTrade(franchise, partner.id, giveId, receiveId)
      : null;
  const currentTrades = franchise.trades.filter(
    (trade) => trade.year === franchise.year && trade.source !== "cpu",
  );
  const latestTrade = currentTrades.at(-1);
  const reportReady =
    franchise.offseasons?.some((report) => report.year === franchise.year) ??
    false;
  const needsDevelopment = !!onProcessOffseason && !reportReady;
  const draftEnabled = !!(onBeginDraft && onAdvanceDraft && onPickRookie);
  const currentDraft = franchise.rookieDrafts?.find(
    (draft) => draft.year === franchise.year,
  );
  const needsDraft = draftEnabled && !currentDraft?.complete;
  const needsCoach =
    franchise.teams.some((t) => t.coach) &&
    projectedCoaches(
      franchise.teams,
      franchise.coachOffice,
      franchise.year,
    ).some((t) => !t.coach);
  const [workspace, setWorkspace] = useState("roster");
  const sections = [
    ...(onRoster ? [{ id: "roster", label: "Roster & coaching" }] : []),
    ...(onTradePackage ? [{ id: "market", label: "Trade market" }] : []),
    ...(draftEnabled ? [{ id: "draft", label: "Rookie draft" }] : []),
    ...(onSignFreeAgent && onCpuFreeAgency
      ? [{ id: "free-agents", label: "Free agents" }]
      : []),
  ];
  const activeWorkspace = sections.some((section) => section.id === workspace)
    ? workspace
    : sections[0]?.id;
  return (
    <section aria-label="Franchise offseason">
      <div className="franchise-section-heading">
        <div>
          <h3>Make your next move.</h3>
          <p>
            Your eight-player roster carries forward. Shape your lineup, explore
            trades and prepare for a fresh 82-game season.
          </p>
        </div>
        <button
          className="button primary"
          type="button"
          disabled={
            disabled ||
            needsDevelopment ||
            needsDraft ||
            needsCoach ||
            franchise.year >= FRANCHISE_MAX_YEARS
          }
          onClick={onStartSeason}
        >
          Start season {franchise.year + 1}
        </button>
      </div>
      {needsCoach && (
        <p className="notice">
          Your head-coach position is vacant. Open the Coaches tab and hire a
          trainer before starting next season.
        </p>
      )}
      {needsDevelopment && (
        <div className="development-prompt">
          <p>
            Run this offseason once to discover player breakouts, slumps and CPU
            trades before starting the next year.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={onProcessOffseason}
          >
            Run offseason development
          </button>
        </div>
      )}
      {reportReady && (
        <div className="development-prompt">
          <p>
            Player development and CPU activity are ready. Review this year's
            changes before your next season.
          </p>
          <button
            type="button"
            className="button secondary"
            onClick={onReviewDevelopment}
          >
            Review development and CPU trades
          </button>
        </div>
      )}
      {franchise.year >= FRANCHISE_MAX_YEARS && (
        <p role="status">
          This franchise has reached 1,000 seasons. Your career stats and
          championship history remain available.
        </p>
      )}
      {needsDraft && !needsDevelopment && (
        <div className="franchise-section-heading">
          <p>
            Next: {currentDraft ? "finish" : "begin and complete"} this year's
            two-round rookie draft to unlock season {franchise.year + 1}.
          </p>
          {activeWorkspace !== "draft" && (
            <button
              className="button secondary"
              type="button"
              onClick={() => setWorkspace("draft")}
            >
              Open rookie draft
            </button>
          )}
        </div>
      )}
      {!!sections.length && (
        <nav className="league-navigation" aria-label="Offseason workspace">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              aria-pressed={activeWorkspace === section.id}
              onClick={() => setWorkspace(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>
      )}
      {activeWorkspace === "roster" && onRoster && (
        <OffseasonRoster
          franchise={franchise}
          disabled={disabled}
          onChange={onRoster}
        />
      )}
      {activeWorkspace === "market" && onTradePackage && (
        <TradeCenter
          franchise={franchise}
          disabled={disabled}
          onTrade={onTradePackage}
        />
      )}
      {activeWorkspace === "draft" &&
        onBeginDraft &&
        onAdvanceDraft &&
        onPickRookie && (
          <RookieDraftPanel
            state={state}
            disabled={disabled}
            onBegin={onBeginDraft}
            onAdvance={onAdvanceDraft}
            onPick={onPickRookie}
          />
        )}
      {activeWorkspace === "free-agents" &&
        onSignFreeAgent &&
        onCpuFreeAgency && (
          <FreeAgentMarket
            state={state}
            disabled={disabled}
            onSign={onSignFreeAgent}
            onCpu={onCpuFreeAgency}
          />
        )}
      {!onRoster && (
        <>
          <ul className="franchise-roster" aria-label="Your offseason roster">
            {ROSTER_SLOTS.map((slot) => {
              const id = user.roster[slot];
              return (
                id !== null && (
                  <li key={slot}>
                    <span className="franchise-roster-slot">{slot}</span>
                    <PlayerPortrait id={id} />
                    <button
                      type="button"
                      className="franchise-scout-button"
                      aria-label={`Scout ${playerName(id)}`}
                      onClick={() => setScoutId(id)}
                    >
                      {playerName(id)}
                    </button>
                    {(() => {
                      const mon = POKEMON_BY_ID.get(id);
                      const offsets = user.development?.[id];
                      return (
                        mon && (
                          <small>
                            {Math.round(
                              positionRating(
                                mon,
                                bestPosition(mon, offsets),
                                offsets,
                              ),
                            )}{" "}
                            FIT
                          </small>
                        )
                      );
                    })()}
                  </li>
                )
              );
            })}
          </ul>
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
          <p className="stat-legend">
            {franchise.teams[0].coach
              ? "Your trainer will manage next season’s rotation and game plans automatically."
              : "You can reorder your lineup and choose a trainer before next season."}
          </p>
        </>
      )}
      {!onTradePackage && (
        <section
          className="franchise-trade"
          aria-labelledby="franchise-trade-title"
        >
          <div>
            <span className="eyebrow">TRADE DESK</span>
            <h4 id="franchise-trade-title">One player in. One player out.</h4>
            <p>
              Clubs weigh player ability and roster fit before accepting your
              offer.
            </p>
          </div>
          <div className="league-controls">
            <label className="league-field">
              Trade partner
              <select
                value={partner?.id ?? ""}
                disabled={disabled}
                onChange={(event) => {
                  setPartnerId(Number(event.target.value));
                  setSelectedReceive(-1);
                }}
              >
                {partners.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="league-field">
              Player you send
              <select
                value={giveId ?? ""}
                disabled={disabled}
                onChange={(event) =>
                  setSelectedGive(Number(event.target.value))
                }
              >
                {outgoing.map((id) => (
                  <option key={id} value={id}>
                    {playerName(id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="league-field">
              Player you receive
              <select
                value={receiveId ?? ""}
                disabled={disabled}
                onChange={(event) =>
                  setSelectedReceive(Number(event.target.value))
                }
              >
                {incoming.map((id) => (
                  <option key={id} value={id}>
                    {playerName(id)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {evaluation && partner && (
            <div
              className={`franchise-trade-preview ${evaluation.accepted ? "accepted" : "rejected"}`}
              aria-label="Trade offer preview"
            >
              <div className="franchise-trade-players">
                <div>
                  <small>YOU SEND</small>
                  <strong>{playerName(giveId)}</strong>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setScoutId(giveId)}
                    aria-label={`Scout outgoing ${playerName(giveId)}`}
                  >
                    Scout player
                  </button>
                  <span>
                    Player value {evaluation.outgoingValue.toFixed(1)}
                  </span>
                </div>
                <span aria-hidden="true" className="franchise-trade-arrow">
                  ⇄
                </span>
                <div>
                  <small>YOU RECEIVE</small>
                  <strong>{playerName(receiveId)}</strong>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setScoutId(receiveId)}
                    aria-label={`Scout incoming ${playerName(receiveId)}`}
                  >
                    Scout player
                  </button>
                  <span>
                    Player value {evaluation.incomingValue.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="franchise-trade-verdict" aria-live="polite">
                <strong>
                  {evaluation.accepted ? "Offer accepted" : "Offer declined"}
                </strong>
                <p>{evaluation.reason}</p>
                <p>
                  {partner.name} roster rating:{" "}
                  {evaluation.partnerBefore.toFixed(1)} →{" "}
                  {evaluation.partnerAfter.toFixed(1)}
                </p>
              </div>
              <button
                className="button primary"
                type="button"
                disabled={disabled || !evaluation.accepted}
                onClick={() => {
                  if (evaluation.accepted && !disabled)
                    onTrade(partner.id, giveId, receiveId);
                }}
              >
                Complete trade
              </button>
            </div>
          )}
          <p className="franchise-trade-status" role="status">
            {latestTrade
              ? `Trade completed: ${playerName(latestTrade.receiveId)} joined your team; ${playerName(latestTrade.giveId)} joined ${teamName(franchise.teams, latestTrade.teamId)}.`
              : "No trades from your club completed this offseason."}
          </p>
        </section>
      )}
      {franchise.trades.length > 0 && (
        <details className="franchise-trade-log">
          <summary>Trade history ({franchise.trades.length})</summary>
          <ol>
            {[...franchise.trades].reverse().map((trade, index) => (
              <li key={`${trade.year}:${index}`}>
                <strong>
                  Year {trade.year} ·{" "}
                  {teamName(franchise.teams, trade.fromTeamId ?? 0)} ⇄{" "}
                  {teamName(franchise.teams, trade.teamId)}
                  {trade.source === "cpu" ? " · CPU trade" : ""}
                </strong>
                <TradeActivity trade={trade} teams={franchise.teams} />
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

type CareerColumn = {
  key: string;
  label: string;
  title: string;
  value: (totals: CareerTotals) => number | null;
  kind?: "count" | "percentage" | "rate";
};
const percent = (made: number, attempted: number) =>
  attempted ? (100 * made) / attempted : null;
const columns: CareerColumn[] = [
  { key: "points", label: "PTS", title: "points", value: (p) => p.points },
  {
    key: "rebounds",
    label: "REB",
    title: "rebounds",
    value: (p) => p.offensiveRebounds + p.defensiveRebounds,
  },
  { key: "assists", label: "AST", title: "assists", value: (p) => p.assists },
  {
    key: "games",
    label: "GP",
    title: "games played",
    value: (p) => p.gamesPlayed,
    kind: "count",
  },
  {
    key: "starts",
    label: "GS",
    title: "games started",
    value: (p) => p.gamesStarted,
    kind: "count",
  },
  { key: "minutes", label: "MIN", title: "minutes", value: (p) => p.minutes },
  { key: "steals", label: "STL", title: "steals", value: (p) => p.steals },
  { key: "blocks", label: "BLK", title: "blocks", value: (p) => p.blocks },
  {
    key: "turnovers",
    label: "TOV",
    title: "turnovers",
    value: (p) => p.turnovers,
  },
  {
    key: "fg",
    label: "FG%",
    title: "field goal percentage",
    value: (p) => percent(p.fgm, p.fga),
    kind: "percentage",
  },
  {
    key: "three",
    label: "3P%",
    title: "three point percentage",
    value: (p) => percent(p.threePM, p.threePA),
    kind: "percentage",
  },
  {
    key: "ft",
    label: "FT%",
    title: "free throw percentage",
    value: (p) => percent(p.ftm, p.fta),
    kind: "percentage",
  },
  {
    key: "ts",
    label: "TS%",
    title: "true shooting percentage",
    value: (p) => percent(p.points, 2 * (p.fga + 0.44 * p.fta)),
    kind: "percentage",
  },
  { key: "fgm", label: "FGM", title: "field goals made", value: (p) => p.fgm },
  {
    key: "fga",
    label: "FGA",
    title: "field goals attempted",
    value: (p) => p.fga,
  },
  {
    key: "threePM",
    label: "3PM",
    title: "three pointers made",
    value: (p) => p.threePM,
  },
  {
    key: "threePA",
    label: "3PA",
    title: "three pointers attempted",
    value: (p) => p.threePA,
  },
  { key: "ftm", label: "FTM", title: "free throws made", value: (p) => p.ftm },
  {
    key: "fta",
    label: "FTA",
    title: "free throws attempted",
    value: (p) => p.fta,
  },
  { key: "fouls", label: "PF", title: "fouls", value: (p) => p.fouls },
  {
    key: "plusMinus",
    label: "+/−",
    title: "plus minus",
    value: (p) => p.plusMinus,
  },
  {
    key: "high",
    label: "HIGH",
    title: "career high points",
    value: (p) => p.highPoints,
    kind: "count",
  },
  {
    key: "double",
    label: "DD",
    title: "double doubles",
    value: (p) => p.doubleDoubles,
    kind: "count",
  },
  {
    key: "triple",
    label: "TD",
    title: "triple doubles",
    value: (p) => p.tripleDoubles,
    kind: "count",
  },
  {
    key: "pog",
    label: "POG",
    title: "player of game awards",
    value: (p) => p.playerOfGame,
    kind: "count",
  },
];

type Honor = { year: number; teamId: number; title: string };
function honorsFor(franchise: Franchise, run: Run, pokemonId: number): Honor[] {
  const honors: Honor[] = [];
  const add = (year: number, teamId: number, title: string) =>
    honors.push({ year, teamId, title });
  for (const season of franchise.history) {
    if (season.rosters[season.championId]?.includes(pokemonId))
      add(season.year, season.championId, "Championship ring");
    for (const award of season.awards)
      if (award.pokemonId === pokemonId)
        add(season.year, award.teamId, award.title);
    for (const award of season.allLeague)
      if (award.pokemonId === pokemonId)
        add(season.year, award.teamId, "All-League");
    for (const award of season.allDefense)
      if (award.pokemonId === pokemonId)
        add(season.year, award.teamId, "All-Defense");
    if (season.finalsMvp.pokemonId === pokemonId)
      add(season.year, season.finalsMvp.teamId, "Finals MVP");
  }
  const league = run.result?.league;
  if (
    franchise.phase === "season" &&
    !franchise.history.some((season) => season.year === franchise.year) &&
    league
  ) {
    for (const award of league.awards)
      if (award.pokemonId === pokemonId)
        add(franchise.year, award.teamId, award.title);
    for (const [ids, label] of [
      [league.allLeague, "All-League"],
      [league.allDefense, "All-Defense"],
    ] as const) {
      for (const id of ids) {
        const player = league.players.find((p) => p.playerId === id);
        if (player?.pokemonId === pokemonId)
          add(franchise.year, player.teamId, label);
      }
    }
    if (finalsComplete(run)) {
      const champion = league.teams.find(
        (team) => team.id === run.playoffs!.championId,
      );
      if (champion && rosterIds(champion).includes(pokemonId))
        add(franchise.year, champion.id, "Championship ring");
      if (run.playoffs!.finalsMvp?.pokemonId === pokemonId)
        add(franchise.year, run.playoffs!.finalsMvp.teamId, "Finals MVP");
    }
  }
  return honors.sort((a, b) => b.year - a.year);
}

function Careers({ franchise, run }: { franchise: Franchise; run: Run }) {
  const careers = useMemo(
    () => careerPlayers(franchise, run),
    [franchise, run],
  );
  const [query, setQuery] = useState(""),
    [team, setTeam] = useState("all"),
    [totals, setTotals] = useState(false),
    [playoffs, setPlayoffs] = useState(false),
    [defense, setDefense] = useState(false);
  const [sort, setSort] = useState({ key: "points", descending: true });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [careerId, setCareerId] = useState<number | null>(null);
  const honorRef = useRef<HTMLElement>(null),
    openerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (selectedId !== null) honorRef.current?.focus();
  }, [selectedId]);
  const currentTeams = new Map(
    franchise.teams.flatMap((club) =>
      rosterIds(club).map((id) => [id, club] as const),
    ),
  );
  const getValue = (stats: CareerTotals, column: CareerColumn) => {
    const n = column.value(stats);
    return n === null || column.kind || totals
      ? n
      : stats.gamesPlayed
        ? n / stats.gamesPlayed
        : null;
  };
  const per36 = (value: number, minutes: number) =>
    minutes ? (value * 36) / minutes : null;
  const defenseColumns: CareerColumn[] = [
    columns.find((column) => column.key === "games")!,
    columns.find((column) => column.key === "minutes")!,
    {
      key: "defensiveRebounds",
      label: "DREB",
      title: "defensive rebounds",
      value: (p) => p.defensiveRebounds,
    },
    columns.find((column) => column.key === "steals")!,
    columns.find((column) => column.key === "blocks")!,
    {
      key: "stocks",
      label: "STL+BLK",
      title: "steals plus blocks",
      value: (p) => p.steals + p.blocks,
    },
    columns.find((column) => column.key === "fouls")!,
    {
      key: "defensiveRebounds36",
      label: "DREB/36",
      title: "defensive rebounds per 36 minutes",
      value: (p) => per36(p.defensiveRebounds, p.minutes),
      kind: "rate",
    },
    {
      key: "steals36",
      label: "STL/36",
      title: "steals per 36 minutes",
      value: (p) => per36(p.steals, p.minutes),
      kind: "rate",
    },
    {
      key: "blocks36",
      label: "BLK/36",
      title: "blocks per 36 minutes",
      value: (p) => per36(p.blocks, p.minutes),
      kind: "rate",
    },
  ];
  const visibleColumns = defense ? defenseColumns : columns;
  const sortedColumn =
    visibleColumns.find((column) => column.key === sort.key) ??
    visibleColumns[0];
  const rows = careers
    .filter((player) => {
      const club = currentTeams.get(player.pokemonId);
      return (
        (team === "all" ||
          (team === "released" ? !club : club?.id === Number(team))) &&
        `${playerName(player.pokemonId)} ${club?.name ?? "Released"}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      );
    })
    .sort((a, b) => {
      const av = getValue(playoffs ? a.playoffs : a.regular, sortedColumn),
        bv = getValue(playoffs ? b.playoffs : b.regular, sortedColumn);
      return av === null
        ? bv === null
          ? a.pokemonId - b.pokemonId
          : 1
        : bv === null
          ? -1
          : (av - bv) * (sort.descending ? -1 : 1) || a.pokemonId - b.pokemonId;
    });
  const honors =
    selectedId === null ? [] : honorsFor(franchise, run, selectedId);
  const rings = honors.filter(
    (honor) => honor.title === "Championship ring",
  ).length;
  return (
    <section aria-label="Career statistics">
      {careerId !== null && (
        <CareerDetail
          pokemonId={careerId}
          franchise={franchise}
          run={run}
          onClose={() => setCareerId(null)}
        />
      )}
      <div className="franchise-section-heading">
        <div>
          <h3>Every season adds up.</h3>
          <p>
            {rows.length} of {careers.length} players · Careers follow each
            Pokémon across trades.
          </p>
        </div>
        <div
          className="stat-mode"
          role="group"
          aria-label="Career statistics display"
        >
          <button
            type="button"
            aria-pressed={!totals}
            onClick={() => setTotals(false)}
          >
            Per game
          </button>
          <button
            type="button"
            aria-pressed={totals}
            onClick={() => setTotals(true)}
          >
            Totals
          </button>
        </div>
      </div>
      <div className="league-controls">
        <label className="league-field">
          Search career players
          <input
            type="search"
            placeholder="Player or current team"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="league-field">
          Filter career players by current team
          <select
            value={team}
            onChange={(event) => setTeam(event.target.value)}
          >
            <option value="all">All teams</option>
            <option value="released">Released players</option>
            {franchise.teams.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>
        <div className="stat-mode" role="group" aria-label="Career competition">
          <button
            type="button"
            aria-pressed={!playoffs}
            onClick={() => setPlayoffs(false)}
          >
            Regular season
          </button>
          <button
            type="button"
            aria-pressed={playoffs}
            onClick={() => setPlayoffs(true)}
          >
            Playoffs
          </button>
        </div>
      </div>
      <div className="stat-mode" role="group" aria-label="Career stat category">
        <button
          type="button"
          aria-pressed={!defense}
          onClick={() => {
            setDefense(false);
            setSort({ key: "points", descending: true });
          }}
        >
          All stats
        </button>
        <button
          type="button"
          aria-pressed={defense}
          onClick={() => {
            setDefense(true);
            setSort({ key: "stocks", descending: true });
          }}
        >
          Defense
        </button>
      </div>
      {defense && (
        <p>
          Stocks (STL+BLK) are steals plus blocks. DREB/36, STL/36 and BLK/36
          are per 36 minutes in both display modes; no minutes means no rate.
        </p>
      )}
      {selectedId !== null && (
        <section
          ref={honorRef}
          tabIndex={-1}
          className="franchise-honors"
          aria-label={`${playerName(selectedId)} career honors`}
        >
          <div className="franchise-section-heading">
            <div>
              <span className="eyebrow">CAREER HONORS</span>
              <h4>
                {playerName(selectedId)} · {rings} championship{" "}
                {rings === 1 ? "ring" : "rings"}
              </h4>
            </div>
            <button
              className="button"
              type="button"
              onClick={() => {
                setSelectedId(null);
                openerRef.current?.focus();
              }}
            >
              Close honors
            </button>
          </div>
          <button
            className="button primary"
            onClick={() => setCareerId(selectedId)}
          >
            Open {playerName(selectedId)} career page
          </button>
          {honors.length ? (
            <ul>
              {honors.map((honor, index) => (
                <li key={index}>
                  <strong>{honor.title}</strong>
                  <span>
                    Year {honor.year} ·{" "}
                    {teamName(franchise.teams, honor.teamId)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No honors earned yet.</p>
          )}
        </section>
      )}
      <div
        className="results-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Scrollable career player statistics"
      >
        <table className="results-table franchise-career-table">
          <caption className="sr-only">
            Career player statistics —{" "}
            {playoffs ? "playoffs" : "regular season"} —{" "}
            {totals ? "totals" : "per game averages"}
            {defense ? " — defense; /36 columns remain rates" : ""}
          </caption>
          <thead>
            <tr>
              <th scope="col">PLAYER / CURRENT TEAM</th>
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sort.key === column.key
                      ? sort.descending
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    aria-label={`Sort careers by ${column.title}`}
                    onClick={() =>
                      setSort({
                        key: column.key,
                        descending:
                          sort.key === column.key ? !sort.descending : true,
                      })
                    }
                  >
                    {column.label}
                    <span className="sort-direction" aria-hidden="true">
                      {sort.key === column.key
                        ? sort.descending
                          ? "↓"
                          : "↑"
                        : "↕"}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((player) => (
              <tr key={player.pokemonId}>
                <th scope="row">
                  <button
                    className="franchise-player-button"
                    type="button"
                    aria-label={`View ${playerName(player.pokemonId)} honors`}
                    onClick={(event) => {
                      openerRef.current = event.currentTarget;
                      setSelectedId(player.pokemonId);
                    }}
                  >
                    <span className="stat-player">
                      <PlayerPortrait id={player.pokemonId} />
                      <span>
                        {playerName(player.pokemonId)}
                        <small>
                          {currentTeams.get(player.pokemonId)?.name ??
                            "Released"}
                        </small>
                      </span>
                    </span>
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    aria-label={`Open ${playerName(player.pokemonId)} career page`}
                    onClick={() => setCareerId(player.pokemonId)}
                  >
                    Career page
                  </button>
                </th>
                {visibleColumns.map((column) => {
                  const value = getValue(
                    playoffs ? player.playoffs : player.regular,
                    column,
                  );
                  return (
                    <td
                      key={column.key}
                      className={
                        sort.key === column.key ? "sorted-stat" : undefined
                      }
                    >
                      {value === null
                        ? "—"
                        : column.kind === "percentage"
                          ? `${value.toFixed(1)}%`
                          : column.kind === "rate"
                            ? value.toFixed(1)
                            : column.kind === "count" || totals
                              ? value.toLocaleString("en-US", {
                                  maximumFractionDigits: 1,
                                })
                              : value.toFixed(1)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="league-empty">No players match these filters.</p>
      )}
      <p className="stat-legend">
        Includes the active season as it is played. Select a player for awards
        and championship rings; select a column to sort. GP, GS, HIGH, DD, TD
        and POG remain career counts or highs in both modes. Percentages use
        combined attempts. — means no denominator.
      </p>
    </section>
  );
}

function HistoricalSelections({
  label,
  honors,
  teams,
}: {
  label: string;
  honors: HistoricalHonor[];
  teams: LeagueTeam[];
}) {
  return (
    <section>
      <h4>{label}</h4>
      <ul className="franchise-honor-list">
        {honors.map((honor) => (
          <li key={`${honor.teamId}:${honor.pokemonId}`}>
            <strong>{playerName(honor.pokemonId)}</strong>
            <span>{teamName(teams, honor.teamId)}</span>
          </li>
        ))}
      </ul>
      {!honors.length && <p>No selections recorded.</p>}
    </section>
  );
}

function History({ franchise }: { franchise: Franchise }) {
  const [showGames, setShowGames] = useState(false);
  const [selectedYear, setSelectedYear] = useState(
    franchise.history.at(-1)?.year ?? 1,
  );
  const season =
    franchise.history.find((entry) => entry.year === selectedYear) ??
    franchise.history.at(-1);
  const yourStanding = season?.standings.find(
    (standing) => standing.teamId === 0,
  );
  return (
    <section aria-label="Season history">
      {showGames && season && (
        <HistoricalGames season={season} onClose={() => setShowGames(false)} />
      )}
      <div className="franchise-section-heading">
        <div>
          <h3>The seasons that built this team.</h3>
          <p>
            Newly archived seasons preserve player stats and every game. Older
            saves keep the history they originally recorded.
          </p>
        </div>
      </div>
      {!season ? (
        <p>
          No seasons archived yet. Finish the Finals and enter the offseason to
          save this year.
        </p>
      ) : (
        <>
          <div className="league-controls">
            <label className="league-field franchise-year-select">
              Archived season
              <select
                value={season.year}
                onChange={(event) =>
                  setSelectedYear(Number(event.target.value))
                }
              >
                {[...franchise.history].reverse().map((entry) => (
                  <option key={entry.year} value={entry.year}>
                    Year {entry.year}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="button primary" onClick={() => setShowGames(true)}>
            View Year {season.year} games
          </button>
          <div className="franchise-history-summary">
            <article>
              <span className="eyebrow">CHAMPIONS</span>
              <h4>{teamName(franchise.teams, season.championId)}</h4>
              <p>
                Defeated {teamName(franchise.teams, season.runnerUpId)} 4–
                {season.runnerUpWins}
              </p>
            </article>
            <article>
              <span className="eyebrow">FINALS MVP</span>
              <h4>{playerName(season.finalsMvp.pokemonId)}</h4>
              <p>
                {teamName(franchise.teams, season.finalsMvp.teamId)} ·{" "}
                {season.finalsMvp.value}
              </p>
            </article>
            <article>
              <span className="eyebrow">YOUR SEASON</span>
              <h4>
                {yourStanding
                  ? `${yourStanding.wins}–${yourStanding.losses}`
                  : "—"}
              </h4>
              <p>Year {season.year} regular-season record</p>
            </article>
          </div>
          <section className="franchise-championship-roster">
            <h4>Championship roster</h4>
            <ul
              className="franchise-roster"
              aria-label={`Year ${season.year} championship roster`}
            >
              {(season.rosters[season.championId] ?? []).map((id) => (
                <li key={id}>
                  <PlayerPortrait id={id} />
                  <strong>{playerName(id)}</strong>
                </li>
              ))}
            </ul>
          </section>
          <div className="franchise-archived-awards">
            <section>
              <h4>Season awards</h4>
              <ul className="franchise-honor-list">
                {season.awards.map((award) => (
                  <li key={award.id}>
                    <strong>{award.title}</strong>
                    <span>
                      {playerName(award.pokemonId)} ·{" "}
                      {teamName(franchise.teams, award.teamId)}
                    </span>
                    <small>{award.value}</small>
                  </li>
                ))}
              </ul>
            </section>
            <HistoricalSelections
              label="All-League"
              honors={season.allLeague}
              teams={franchise.teams}
            />
            <HistoricalSelections
              label="All-Defense"
              honors={season.allDefense}
              teams={franchise.teams}
            />
          </div>
          <h4>Final standings</h4>
          <div
            className="results-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Scrollable archived standings"
          >
            <table className="results-table franchise-standings">
              <caption className="sr-only">
                Year {season.year} final standings
              </caption>
              <thead>
                <tr>
                  <th scope="col">TEAM</th>
                  <th scope="col">W</th>
                  <th scope="col">L</th>
                  <th scope="col">WIN%</th>
                  <th scope="col">PPG</th>
                  <th scope="col">OPP</th>
                </tr>
              </thead>
              <tbody>
                {[...season.standings]
                  .sort(
                    (a, b) =>
                      b.wins - a.wins ||
                      b.pointsFor -
                        b.pointsAgainst -
                        (a.pointsFor - a.pointsAgainst) ||
                      a.teamId - b.teamId,
                  )
                  .map((standing, index) => (
                    <tr
                      key={standing.teamId}
                      className={
                        standing.teamId === 0 ? "league-user-team" : undefined
                      }
                    >
                      <th scope="row">
                        <span className="league-rank">{index + 1} </span>
                        {teamName(franchise.teams, standing.teamId)}
                      </th>
                      <td>{standing.wins}</td>
                      <td>{standing.losses}</td>
                      <td>
                        {(
                          (100 * standing.wins) /
                          (standing.wins + standing.losses || 1)
                        ).toFixed(1)}
                        %
                      </td>
                      <td>
                        {(
                          standing.pointsFor /
                          (standing.wins + standing.losses || 1)
                        ).toFixed(1)}
                      </td>
                      <td>
                        {(
                          standing.pointsAgainst /
                          (standing.wins + standing.losses || 1)
                        ).toFixed(1)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export function FranchisePanel({
  onHireCoach,
  onReviewCoaches,
  state,
  disabled = false,
  onEnterOffseason,
  onStartSeason,
  onTrade,
  onProcessOffseason,
  onTraining,
  onSimulateSeason,
  onTradePackage,
  onRoster,
  onBeginDraft,
  onAdvanceDraft,
  onPickRookie,
  onSignFreeAgent,
  onCpuFreeAgency,
}: FranchisePanelProps) {
  const [view, setView] = useState<
    "overview" | "careers" | "history" | "development" | "training" | "coaches"
  >("overview");
  const { franchise, run } = state;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!franchise) return;
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView?.({ block: "start" });
  }, [franchise?.year, franchise?.phase]);
  const complete = finalsComplete(run);
  if (!franchise) {
    if (run.result?.modelVersion !== 3 || !run.result.league || !complete)
      return null;
    return (
      <section
        className="franchise-panel franchise-invitation"
        id="franchise"
        aria-label="Franchise"
      >
        <div>
          <span className="eyebrow">THE NEXT CHAPTER</span>
          <h2>One season is only the beginning.</h2>
          <p>
            Keep your team and the whole league together. This season becomes
            archived Year 1, with career stats, awards and championship rings
            carried forward.
          </p>
        </div>
        <button
          className="button primary"
          type="button"
          disabled={disabled}
          onClick={onEnterOffseason}
        >
          Continue as franchise
        </button>
      </section>
    );
  }
  const trainingTeam =
    franchise.phase === "offseason"
      ? projectedCoaches(
          franchise.teams,
          franchise.coachOffice,
          franchise.year,
        )[0]
      : { ...(run.leagueTeams?.[0] ?? franchise.teams[0]), roster: run.roster };
  const trainingCoach = trainingTeam.coach ?? franchise.pendingCoach;
  const automaticTraining = !!(trainingCoach || franchise.teams[0].coach);
  return (
    <section id="franchise" className="franchise-panel" aria-label="Franchise">
      <header className="franchise-heading">
        <div>
          <span className="eyebrow">FRANCHISE MODE</span>
          <h2 ref={headingRef} tabIndex={-1}>
            Build a legacy.
          </h2>
        </div>
        <span className="franchise-phase">
          Year {franchise.year} ·{" "}
          {franchise.phase === "offseason" ? "Offseason" : "Season"}
        </span>
      </header>
      <nav
        className="league-navigation franchise-navigation"
        aria-label="Franchise views"
      >
        {(
          [
            {
              id: "overview",
              label: franchise.phase === "offseason" ? "Offseason" : "Overview",
            },
            { id: "development", label: "Development report" },
            ...(onTraining || automaticTraining
              ? [{ id: "training" as const, label: "Training plans" }]
              : []),
            { id: "coaches", label: "Coaches" },
            { id: "careers", label: "Career stats" },
            { id: "history", label: "History" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={view === tab.id}
            onClick={() => setView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {view === "overview" &&
        (franchise.phase === "offseason" ? (
          <Offseason
            key={franchise.year}
            state={state}
            franchise={franchise}
            disabled={disabled}
            onStartSeason={onStartSeason}
            onTrade={onTrade}
            onProcessOffseason={onProcessOffseason}
            onReviewDevelopment={() => setView("development")}
            onTradePackage={onTradePackage}
            onRoster={onRoster}
            onBeginDraft={onBeginDraft}
            onAdvanceDraft={onAdvanceDraft}
            onPickRookie={onPickRookie}
            onSignFreeAgent={onSignFreeAgent}
            onCpuFreeAgency={onCpuFreeAgency}
          />
        ) : (
          <section
            className="franchise-season-status"
            aria-label="Current franchise season"
          >
            <div>
              <h3>
                {complete
                  ? `Year ${franchise.year} is in the books.`
                  : `Year ${franchise.year} is yours to write.`}
              </h3>
              <p>
                {complete
                  ? "Enter the offseason to archive these results, make trades and prepare your next season."
                  : run.result
                    ? "The regular season is complete. Play through the Finals to open the next offseason."
                    : run.coach
                      ? "Your trainer handles game plans and rotations. Play or simulate scheduled games with your returning roster."
                      : run.coachDraftRequired
                        ? "Choose your trainer below before starting this season."
                        : "Set your rotation, then play or simulate scheduled games with your returning roster."}
              </p>
            </div>
            {!run.result && onSimulateSeason && (
              <div className="franchise-game-actions">
                <button
                  className="button primary"
                  type="button"
                  disabled={disabled}
                  onClick={onSimulateSeason}
                >
                  {(run.seasonProgress?.completedRounds ?? 0) > 0
                    ? `Simulate rest of season ${franchise.year}`
                    : `Simulate season ${franchise.year}`}
                </button>
                <a className="button" href="#season">
                  Play or view schedule
                </a>
              </div>
            )}
            {complete && (
              <button
                className="button primary"
                type="button"
                disabled={disabled}
                onClick={onEnterOffseason}
              >
                Enter offseason
              </button>
            )}
          </section>
        ))}
      {view === "coaches" && (
        <CoachOfficePanel
          teams={franchise.teams}
          office={franchise.coachOffice}
          year={franchise.year}
          offseason={franchise.phase === "offseason"}
          humans={[{ teamId: 0, name: "You" }]}
          records={franchiseCoachRecords(franchise, run)}
          disabled={disabled}
          onHire={onHireCoach ? (_teamId, id) => onHireCoach(id) : undefined}
          onReview={onReviewCoaches}
        />
      )}
      {view === "training" &&
        (automaticTraining ? (
          <CoachTrainingPanel
            team={{ ...trainingTeam, coach: trainingCoach }}
            players={
              franchise.phase === "season"
                ? (run.result?.league?.players ??
                  run.seasonProgress?.result?.league?.players)
                : undefined
            }
          />
        ) : onTraining ? (
          <TrainingPanel
            roster={
              franchise.phase === "offseason"
                ? franchise.teams[0].roster
                : run.roster
            }
            plans={franchise.trainingPlans}
            disabled={disabled}
            onChange={onTraining}
          />
        ) : null)}
      {view === "development" && <OffseasonReport franchise={franchise} />}
      {view === "careers" && <Careers franchise={franchise} run={run} />}
      {view === "history" && <History franchise={franchise} />}
    </section>
  );
}
