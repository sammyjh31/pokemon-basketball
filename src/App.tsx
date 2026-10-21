import { ShinyContext } from "./components/ShinyPokemon";
import { publicAsset } from "./assets";
import { ChallengePoolPicker } from "./components/ChallengePoolPicker";
import {
  draftPoolLabel,
  inDraftPool,
  isDraftPool,
  type DraftPool,
} from "./game/draftPool";
import { RestoreProgress } from "./components/RestoreProgress";
import { MasteryPanel } from "./components/MasteryPanel";
import { teamsWithMastery } from "./game/abilityMastery";
import { currentMasteryBanks } from "./game/currentMastery";
import { projectedCoaches } from "./game/coachOffice";
import { CoachDraft } from "./components/CoachDraft";
import { CoachSummary } from "./components/CoachSummary";
import { canSelectTrainer } from "./game/coachSelection";
import { RotationEditor } from "./components/RotationEditor";
import { FranchiseSchedule } from "./components/FranchiseSchedule";
import { nextFranchiseFixture } from "./game/interactiveSeason";
import { nextUserPlayoffFixture } from "./game/playoffs";
import { seasonTeams } from "./game/season";
import { teamsWithChemistry } from "./game/teammateChemistry";
import { currentChemistryBanks } from "./game/currentChemistry";
import { currentMoraleBanks } from "./game/currentMorale";
import { teamsWithMorale } from "./game/playerMorale";
import { MoralePanel } from "./components/MoralePanel";
import type { OfficialArcadeProps } from "./components/ArcadeMode";
import { lazy, Suspense, useEffect, useState, useMemo } from "react";
import { POKEMON_BY_ID } from "./data/pokemon";
import { teamRatings } from "./game/ratings";
import { teamRatings as legacyTeamRatings } from "./game/legacyRatings";
import { MODE_LABELS } from "./components/modeLabels";
import type { GameState, Mode, RosterSlot } from "./game/types";
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
import "./gameVisual.css";
import { KantoNavigation } from "./components/KantoShell";
import { BenchPanel } from "./components/BenchPanel";
import { emptyRoster } from "./game/types";
import { randomLineup } from "./game/lineup";
import {
  FranchisePanel,
  LocalLeagueMode,
  preloadPanels,
} from "./components/lazyPanels";
import { PlayChooser } from "./components/PlayChooser";
import { GettingStarted } from "./components/GettingStarted";
import {
  browserOnboardingStorage,
  readOnboarding,
  writeOnboarding,
  type Onboarding,
  type PlayStyle,
} from "./components/onboarding";
import { SaveMenu } from "./components/SaveMenu";
const ArcadeMode = lazy(() =>
  import("./components/ArcadeMode").then((m) => ({ default: m.ArcadeMode })),
);

export default function App({
  initial,
  storage,
}: {
  initial?: GameState;
  storage?: StorageLike;
}) {
  const {
      state,
      dispatch,
      storageNotice,
      importPending,
      resolveImport,
      simulate,
      advanceSeason,
      recordPlayoffGame,
      retrySave,
      simulating,
      progress,
      advancePlayoffs,
      playoffSimulating,
      playoffProgress,
      simulationError,
      restoring,
      restorationProgress,
      rookieDraftBusy,
      rookieDraftProgress,
      rookieDraftError,
      cancelRookieDraft,
      saveControls,
    } = useGame(initial, storage),
    { run, records } = state;
  const choosingCoach =
    canSelectTrainer(state) &&
    (run.coachDraftRequired || !initial) &&
    state.franchise?.phase !== "offseason";
  const coachTeam = {
    ...(state.franchise?.phase === "offseason"
      ? state.franchise.teams[0]
      : teamsWithMastery(
          teamsWithMorale(
            teamsWithChemistry(
              run.leagueTeams ??
                run.result?.league?.teams ??
                run.seasonProgress?.result?.league?.teams ??
                [],
              currentChemistryBanks(run),
            ),
            currentMoraleBanks(run),
          ),
          currentMasteryBanks(run),
        )[0]),
    ...(state.franchise?.phase !== "offseason"
      ? {
          chemistryVersion: run.chemistryVersion,
          moraleVersion: run.moraleVersion,
          personalityVersion: run.personalityVersion,
          chemistryGrowthVersion: run.chemistryGrowthVersion,
          abilityVersion: run.abilityVersion,
          abilityMasteryVersion: run.abilityMasteryVersion,
          movesetVersion: run.movesetVersion,
          courtVersion: run.courtVersion,
          physicalAbilityVersion: run.physicalAbilityVersion,
          evaluationVersion: run.evaluationVersion,
        }
      : {}),
    id: 0,
    name: "Kanto Basketball Club",
    roster:
      state.franchise?.phase === "offseason"
        ? state.franchise.teams[0].roster
        : run.roster,
    tactic: run.tactic,
    rotation: run.rotation,
    defense: run.defense ?? "man",
    shinySeed: state.franchise?.shinySeed ?? run.shinySeed,
    ratings: teamRatings(
      run.roster,
      run.tactic,
      run.rotation,
      undefined,
      undefined,
      run.shinySeed,
    ),
    coach:
      state.franchise?.phase === "offseason"
        ? (state.franchise.pendingCoach ??
          projectedCoaches(
            state.franchise.teams,
            state.franchise.coachOffice,
            state.franchise.year,
          )[0].coach)
        : run.coach,
  };
  const [arcadeOpen, setArcadeOpen] = useState(false);
  const [localLeagueOpen, setLocalLeagueOpen] = useState(
    () => window.location.hash === "#local-league",
  );
  const [officialGame, setOfficialGame] = useState<OfficialArcadeProps | null>(
    null,
  );
  const [pending, setPending] = useState<number | null>(null),
    [swap, setSwap] = useState<RosterSlot | null>(null);
  const [confirm, setConfirm] = useState<{
    title?: string;
    description?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  // Interface preferences live beside, never inside, the validated save.
  const prefsStorage = browserOnboardingStorage;
  const [onboarding, setOnboardingState] = useState<Onboarding>(() =>
    readOnboarding(prefsStorage),
  );
  const saveOnboarding = (next: Onboarding) => {
    setOnboardingState(next);
    writeOnboarding(prefsStorage, next);
  };
  const [chooserOpen, setChooserOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [animatedRun, setAnimatedRun] = useState<string | null>(null),
    [announcement, setAnnouncement] = useState("");
  const archived = !!run.result && (run.result.modelVersion ?? 1) < 2;
  const development = run.leagueTeams?.[0].development;
  const ratings = useMemo(
    () =>
      archived
        ? legacyTeamRatings(run.roster)
        : teamRatings(
            run.roster,
            run.tactic,
            run.rotation,
            development,
            run.rotationPlan,
            run.shinySeed,
          ),
    [
      archived,
      run.roster,
      run.tactic,
      run.rotation,
      run.shinySeed,
      development,
      run.rotationPlan,
    ],
  );
  // Warm the split panels once the first screen is interactive.
  useEffect(() => {
    const warm = () => void preloadPanels().catch(() => undefined);
    const idle = window.requestIdleCallback?.(warm);
    const timer = idle === undefined ? window.setTimeout(warm, 1500) : 0;
    return () => {
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      window.clearTimeout(timer);
    };
  }, []);
  const [spriteStyle, setSpriteStyle] = useState<SpriteStyle>("pixel");
  const start = (
    mode: Mode,
    includeLegends: boolean,
    draftPool?: DraftPool,
  ) => {
    if (simulating || playoffSimulating || restoring) return;
    dispatch({
      type: "NEW_RUN",
      mode,
      includeLegends,
      draftPool,
      seed: newSeed(),
      coachDraftRequired: true,
    });
    setPending(null);
    setSwap(null);
    setConfirm(null);
    setAnimatedRun(null);
    setAnnouncement(
      `${MODE_LABELS[mode]} draft started. Choose your trainer coach.`,
    );
  };
  const busy = simulating || playoffSimulating || restoring || rookieDraftBusy;
  const hasProgress =
    Object.values(run.roster).some((id) => id != null) ||
    run.rerollsLeft < 2 ||
    !!run.result;
  /** Starts a new run, confirming with copy that names what will be lost. */
  const requestReset = (
    mode: Mode,
    includeLegends: boolean,
    reason: "new" | "mode" | "legends" = "new",
  ) => {
    if (busy) return;
    const pool =
      reason === "legends" ? run.draftPool : (run.draftPool ?? "all");
    if (!hasProgress && !state.franchise)
      return start(mode, includeLegends, pool);
    const onConfirm = () => start(mode, includeLegends, pool);
    if (state.franchise)
      return setConfirm({
        title: "End this franchise?",
        description:
          "Starting a new draft replaces this franchise, including its career stats, trades and championship history. Your challenge records stay saved.",
        confirmLabel: "End franchise",
        onConfirm,
      });
    if (reason === "mode")
      return setConfirm({
        title: `Switch to ${MODE_LABELS[mode]}?`,
        description: `Your current ${run.result ? "season and lineup" : "lineup"}${run.coach ? " and trainer" : ""} will be cleared. Completed season records stay saved.`,
        confirmLabel: `Switch to ${MODE_LABELS[mode]}`,
        onConfirm,
      });
    if (reason === "legends")
      return setConfirm({
        title: includeLegends
          ? "Add legendary Pokémon to the pool?"
          : "Remove legendary Pokémon from the pool?",
        description:
          "The 82–0 Challenge deals every pick from one fixed pool, so changing it restarts your draft. Your current picks and re-rolls will be cleared.",
        confirmLabel: "Restart draft",
        onConfirm,
      });
    setConfirm({ onConfirm });
  };
  const changeGeneration = (pool: DraftPool) => {
    if (
      busy ||
      run.result ||
      state.franchise ||
      !isDraftPool(pool) ||
      pool === run.draftPool
    )
      return;
    const apply = () => {
      dispatch({ type: "DRAFT_POOL", pool });
      setPending(null);
      setSwap(null);
      setConfirm(null);
      setAnnouncement(`${draftPoolLabel(pool)} draft ready.`);
    };
    if (run.mode === "free") {
      const removed = Object.values(run.roster).filter(
        (id): id is number => id !== null && !inDraftPool(pool, id),
      );
      if (!removed.length) return apply();
      return setConfirm({
        title: "Change lineup generation?",
        description: `This removes ${removed.map((id) => POKEMON_BY_ID.get(id)!.name).join(", ")} from your lineup. Eligible players, your coach and completed season records stay saved.`,
        confirmLabel: "Change pool",
        onConfirm: apply,
      });
    }
    if (!hasProgress) return apply();
    setConfirm({
      title: "Change draft generation?",
      description:
        "This restarts your picks and restores two re-rolls. Your chosen coach and completed season records stay saved.",
      confirmLabel: "Restart draft",
      onConfirm: apply,
    });
  };
  /** Lineup builder keeps the roster and only changes the available pool. */
  const changeLegends = (includeLegends: boolean) => {
    if (busy) return;
    if (run.mode !== "free")
      return requestReset(run.mode, includeLegends, "legends");
    const removed = includeLegends
      ? []
      : Object.values(run.roster).filter(
          (id) => id != null && POKEMON_BY_ID.get(id)?.legendary,
        );
    const apply = () => {
      dispatch({ type: "LEGENDS", includeLegends });
      setPending(null);
      setSwap(null);
      setConfirm(null);
      setAnnouncement(
        includeLegends
          ? "Legendary Pokémon added to the pool."
          : `Legendary Pokémon removed from the pool${removed.length ? ` and ${removed.length} from your lineup` : ""}.`,
      );
    };
    if (!removed.length) return apply();
    const names = removed.map((id) => POKEMON_BY_ID.get(id!)!.name);
    setConfirm({
      title: "Remove legendary Pokémon?",
      description: `${names.join(", ")} ${names.length === 1 ? "leaves" : "leave"} your lineup. Your other picks stay where they are.`,
      confirmLabel: "Remove legendaries",
      onConfirm: apply,
    });
  };
  const openLocalLeague = () => {
    setLocalLeagueOpen(true);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#local-league`,
    );
  };
  const fresh =
    !hasProgress &&
    !state.franchise &&
    records.spin.runs + records.free.runs === 0;
  const showChooser =
    chooserOpen ||
    (!onboarding.style &&
      fresh &&
      !initial &&
      !restoring &&
      !importPending &&
      !localLeagueOpen);
  const choosePlayStyle = (style: PlayStyle) => {
    saveOnboarding({ ...onboarding, style });
    setChooserOpen(false);
    if (style === "local") return openLocalLeague();
    if (state.franchise || style === "franchise") {
      setAnnouncement(
        state.franchise
          ? "Your franchise continues."
          : "Draft eight Pokémon and finish a season to start your franchise.",
      );
      return;
    }
    const mode: Mode = style === "challenge" ? "spin" : "free";
    if (mode !== run.mode) requestReset(mode, run.includeLegends, "mode");
  };
  const lineupCount = Object.values(run.roster).filter(Boolean).length;
  const anySeason = records.spin.runs + records.free.runs > 0;
  const checklist = [
    {
      label: "Draft 8 Pokémon",
      detail: choosingCoach
        ? "Choose your trainer coach, then fill five starters and three bench slots."
        : "Fill five starters and three bench slots.",
      done: lineupCount === 8 || !!run.result || !!state.franchise,
      href: choosingCoach ? undefined : "#draft",
    },
    {
      label: "Simulate the season",
      detail: "Play all 82 games and see your record.",
      done: !!run.result || anySeason || !!state.franchise,
      href: "#season",
    },
    {
      label:
        onboarding.style === "franchise"
          ? "Start your franchise"
          : "Continue: franchise or run it back",
      detail:
        onboarding.style === "franchise"
          ? "Keep this team for another year from the season recap."
          : "Keep your team as a franchise, or start a new run.",
      done: !!state.franchise || (anySeason && !run.result),
      href: "#season",
    },
  ];
  const checklistComplete = checklist.every((step) => step.done);
  useEffect(() => {
    if (checklistComplete && !onboarding.checklistDone && !restoring)
      saveOnboarding({ ...onboarding, checklistDone: true });
    // saveOnboarding is recreated each render; the flag is the only input.
  }, [checklistComplete, onboarding.checklistDone, restoring]);
  const onSlot = (position: RosterSlot) => {
    if (
      run.result ||
      (run.seasonProgress?.completedRounds ?? 0) > 0 ||
      simulating ||
      playoffSimulating ||
      restoring
    )
      return;
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
    if (run.mode === "free" || state.franchise) {
      if (swap) {
        dispatch({ type: "SWAP", first: swap, second: position });
        setSwap(null);
        setAnnouncement("Positions updated.");
      } else if (run.roster[position]) setSwap(position);
    }
  };
  // Offseason trades live in the franchise; the completed run stays archived.
  const arcadeRun =
    state.franchise?.phase === "offseason"
      ? {
          ...run,
          roster: state.franchise.teams[0].roster,
          leagueTeams: state.franchise.teams,
          // The current offseason roster already includes retained transaction state.
          // Completed-season banks refer to the archived roster.
          result: null,
          seasonProgress: undefined,
          playoffs: undefined,
        }
      : run;
  const playoffFixture = useMemo(
    () =>
      state.franchise?.phase === "season" && run.result?.league
        ? nextUserPlayoffFixture(
            run.result.league,
            run.seasonSeed,
            run.playoffs,
          )
        : null,
    [state.franchise?.phase, run.result?.league, run.seasonSeed, run.playoffs],
  );
  const openOfficialGame = () => {
    if (
      simulating ||
      playoffSimulating ||
      restoring ||
      state.franchise?.phase !== "season"
    )
      return;
    const source = run;
    const league = run.result?.league;
    const fixture = league ? playoffFixture : nextFranchiseFixture(run);
    if (!fixture) return;
    setOfficialGame({
      fixture,
      teams: teamsWithMorale(
        teamsWithChemistry(
          league?.teams ?? seasonTeams(run),
          currentChemistryBanks(run),
        ),
        currentMoraleBanks(run),
      ),
      label: `Year ${state.franchise.year} · ${league ? "Playoffs" : `Game ${(run.seasonProgress?.completedRounds ?? 0) + 1} of 82`}`,
      onComplete: (game) =>
        league
          ? recordPlayoffGame(game, source)
          : advanceSeason(1, game, source),
    });
    setArcadeOpen(true);
  };
  if (localLeagueOpen)
    return (
      <LocalLeagueMode
        storage={storage}
        onExit={() => {
          setLocalLeagueOpen(false);
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}#draft`,
          );
        }}
      />
    );
  if (arcadeOpen)
    return (
      <ShinyContext.Provider
        value={state.franchise?.shinySeed ?? run.shinySeed}
      >
        <Suspense
          fallback={
            <main className="app-shell kanto-game">
              <p role="status">Opening the arcade…</p>
            </main>
          }
        >
          {storageNotice && (
            <p className="notice" role="status">
              {storageNotice}{" "}
              {retrySave && (
                <button className="text-button" onClick={retrySave}>
                  Retry saving
                </button>
              )}
            </p>
          )}
          <ArcadeMode
            run={arcadeRun}
            official={officialGame ?? undefined}
            onExit={() => {
              setArcadeOpen(false);
              setOfficialGame(null);
            }}
          />
        </Suspense>
      </ShinyContext.Provider>
    );
  const franchisePanel = (
    <>
      {rookieDraftBusy && (
        <section
          className="notice rookie-draft-progress"
          aria-label="Rookie draft processing"
          ref={(node) => {
            if (node)
              node.scrollIntoView?.({ block: "center", behavior: "instant" });
          }}
        >
          <p role="status" aria-live="polite">
            Resolving rookie draft · {rookieDraftProgress.completed} of{" "}
            {rookieDraftProgress.total} turns.{" "}
            {rookieDraftProgress.completed === 60
              ? "Completing the offseason market…"
              : "CPU clubs are scouting their picks…"}
          </p>
          <progress
            value={rookieDraftProgress.completed}
            max={rookieDraftProgress.total}
            aria-label="Rookie draft processing progress"
          />
          <button className="button" onClick={cancelRookieDraft}>
            Cancel draft calculation
          </button>
        </section>
      )}
      {rookieDraftError && (
        <p className="notice" role="alert">
          {rookieDraftError}
        </p>
      )}
      <FranchisePanel
        key="franchise-panel"
        onHireCoach={(id) => dispatch({ type: "APPOINT_COACH", id })}
        onReviewCoaches={() => dispatch({ type: "PROCESS_CPU_COACHES" })}
        state={state}
        disabled={busy}
        onProcessOffseason={() => {
          dispatch({ type: "PROCESS_OFFSEASON" });
          setAnnouncement(
            "Player development and league trades are complete. Review the offseason report before starting the next season.",
          );
        }}
        onEnterOffseason={() => {
          dispatch({ type: "ENTER_OFFSEASON" });
          setAnnouncement(
            `Year ${state.franchise?.year ?? 1} archived. Player development and league trades are complete.`,
          );
        }}
        onStartSeason={() => {
          dispatch({ type: "START_FRANCHISE_SEASON", seed: newSeed() });
          setPending(null);
          setSwap(null);
          setAnimatedRun(null);
          setAnnouncement(
            "Your next franchise season is ready. Review your team and head coach before tipoff.",
          );
        }}
        onSimulateSeason={
          choosingCoach ? undefined : () => void advanceSeason(82)
        }
        onTraining={(plans) => dispatch({ type: "TRAINING_PLANS", plans })}
        onTradePackage={(offer) => dispatch({ type: "TRADE_PACKAGE", offer })}
        onRoster={(settings) =>
          dispatch({ type: "OFFSEASON_ROSTER", settings })
        }
        onBeginDraft={() => dispatch({ type: "BEGIN_ROOKIE_DRAFT" })}
        onSignFreeAgent={(pokemonId, releasedId) =>
          dispatch({ type: "SIGN_FREE_AGENT", pokemonId, releasedId })
        }
        onCpuFreeAgency={() => dispatch({ type: "PROCESS_CPU_FREE_AGENCY" })}
        onAdvanceDraft={() => dispatch({ type: "ADVANCE_ROOKIE_DRAFT" })}
        onPickRookie={(pokemonId, releasedId) =>
          dispatch({ type: "PICK_ROOKIE", pokemonId, releasedId })
        }
        onPassRookie={() => dispatch({ type: "PASS_ROOKIE_PICK" })}
        onTrade={(teamId, giveId, receiveId) =>
          dispatch({ type: "TRADE", teamId, giveId, receiveId })
        }
      />
    </>
  );
  return (
    <SpriteContext.Provider value={spriteStyle}>
      <ShinyContext.Provider
        value={state.franchise?.shinySeed ?? run.shinySeed}
      >
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <div className="app-shell kanto-game">
          <Scoreboard
            mode={run.mode}
            localLeagueDisabled={busy || importPending}
            onLocalLeague={openLocalLeague}
            disabled={busy}
            franchiseActive={!!state.franchise}
            onMode={(mode) => {
              if (mode !== run.mode)
                requestReset(mode, run.includeLegends, "mode");
            }}
            onGuide={() => setGuideOpen(true)}
            onHowToPlay={() => setChooserOpen(true)}
            onRestart={() => requestReset(run.mode, run.includeLegends)}
          />
          <KantoNavigation
            team={!choosingCoach && state.franchise?.phase !== "offseason"}
            draft={
              state.franchise?.phase !== "offseason" || canSelectTrainer(state)
            }
            season={!choosingCoach && ratings.complete}
            playoffs={!!run.result?.league}
            initial={run.result ? "season" : "draft"}
          />
          <main aria-busy={restoring} id="main-content" tabIndex={-1}>
            {storageNotice && (
              <p className="notice" role="status">
                {storageNotice}{" "}
                {retrySave && (
                  <button className="text-button" onClick={retrySave}>
                    Retry saving
                  </button>
                )}
              </p>
            )}
            <SaveMenu {...saveControls} />
            {restoring ? (
              <section
                className="season-panel"
                id="draft"
                aria-labelledby="restoration-title"
              >
                <span className="eyebrow">WELCOME BACK</span>
                <h1 id="restoration-title">Restoring your league</h1>
                <p>
                  Your saved season is being verified. Your original save stays
                  in place until it is ready.
                </p>
                <RestoreProgress
                  completed={restorationProgress.completed}
                  total={restorationProgress.total}
                  label="Saved league restoration progress"
                />
              </section>
            ) : (
              <>
                <div className="mobile-title">
                  <h1>
                    {state.franchise
                      ? `Franchise · Year ${state.franchise.year}`
                      : run.mode === "free"
                        ? "Lineup builder"
                        : "82–0 Challenge"}
                  </h1>
                  <p>
                    {state.franchise
                      ? "Your eight-player roster carries forward each year."
                      : "Eight Pokémon. One complete team."}
                  </p>
                </div>
                {!onboarding.checklistDone && !checklistComplete && (
                  <GettingStarted
                    steps={checklist}
                    onHide={() =>
                      saveOnboarding({ ...onboarding, checklistDone: true })
                    }
                  />
                )}
                {state.franchise && franchisePanel}
                {state.franchise && (
                  <p className="franchise-draft-reset">
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => requestReset(run.mode, run.includeLegends)}
                    >
                      End franchise / new draft
                    </button>
                  </p>
                )}
                {!state.franchise && (
                  <ChallengePoolPicker
                    mode={run.mode}
                    pool={run.draftPool}
                    includeLegends={run.includeLegends}
                    disabled={busy || !!run.result}
                    onChange={changeGeneration}
                  />
                )}
                {(choosingCoach ||
                  (state.franchise?.phase === "offseason" &&
                    canSelectTrainer(state))) && (
                  <CoachDraft
                    key={`coach-${run.id}`}
                    seed={run.seasonSeed}
                    offered={!state.franchise && run.mode === "spin"}
                    nextSeason={state.franchise?.phase === "offseason"}
                    disabled={simulating || playoffSimulating}
                    onChoose={(id) => dispatch({ type: "SELECT_COACH", id })}
                  />
                )}
                {state.franchise?.phase !== "offseason" && !choosingCoach && (
                  <fieldset
                    className={`draft-layout draft-fieldset${state.franchise ? " franchise-roster-layout" : ""}`}
                    id="draft"
                    disabled={busy}
                  >
                    <div className="court-column">
                      <Court
                        run={run}
                        development={development}
                        ratings={ratings}
                        pending={pending}
                        swap={swap}
                        onSlot={onSlot}
                        onReset={() =>
                          requestReset(run.mode, run.includeLegends)
                        }
                      />
                      {!archived && (
                        <BenchPanel
                          run={run}
                          development={development}
                          ratings={ratings}
                          pending={pending}
                          swap={swap}
                          onSlot={onSlot}
                          onAutoFill={() => {
                            dispatch({ type: "AUTO_BENCH" });
                            setPending(null);
                            setSwap(null);
                          }}
                          onDefense={(defense) =>
                            dispatch({ type: "DEFENSE", defense })
                          }
                          onTactic={(tactic) =>
                            dispatch({ type: "TACTIC", tactic })
                          }
                          onRotation={(rotation) =>
                            dispatch({ type: "ROTATION", rotation })
                          }
                        />
                      )}
                      {state.franchise && !run.coach && (
                        <RotationEditor
                          run={run}
                          disabled={
                            simulating ||
                            playoffSimulating ||
                            !!run.result ||
                            (run.seasonProgress?.completedRounds ?? 0) > 0
                          }
                          onChange={(plan) =>
                            dispatch({ type: "ROTATION_PLAN", plan })
                          }
                        />
                      )}
                    </div>
                    {!state.franchise && (
                      <DraftPanel
                        key={run.id}
                        run={run}
                        pending={pending}
                        inspectId={swap ? run.roster[swap] : null}
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
                        onLegends={changeLegends}
                        onGuide={() => setGuideOpen(true)}
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
                                roster: randomLineup(
                                  run.includeLegends,
                                  newSeed(),
                                  run.draftPool,
                                ),
                              });
                              setPending(null);
                              setSwap(null);
                              setAnnouncement(
                                "A new eight-player roster is ready.",
                              );
                            }}
                            onClear={() => {
                              dispatch({
                                type: "SET_LINEUP",
                                roster: emptyRoster(),
                              });
                              setPending(null);
                              setSwap(null);
                              setAnnouncement(
                                "All eight roster slots are cleared.",
                              );
                            }}
                          />
                        }
                      />
                    )}
                  </fieldset>
                )}
                <div className="team-hq">
                  {!coachTeam.coach && <MoralePanel team={coachTeam} />}
                  {coachTeam.abilityMasteryVersion === 1 && (
                    <MasteryPanel team={coachTeam} />
                  )}
                  {coachTeam.coach && (
                    <CoachSummary
                      team={coachTeam}
                      nextSeason={state.franchise?.phase === "offseason"}
                    />
                  )}
                </div>
                <p className="sr-only" role="status">
                  {announcement}
                </p>
                <section
                  id="arcade"
                  className="arcade-entry"
                  aria-label="Arcade basketball"
                >
                  <div>
                    <span className="eyebrow">TAKE THE COURT</span>
                    <h2>Five on five. You're in control.</h2>
                    <p>
                      Bring your roster to a full-court arcade game. Turbo,
                      alley-oops, and elemental heat.
                    </p>
                  </div>
                  <div>
                    <button
                      className="button primary"
                      disabled={
                        simulating ||
                        playoffSimulating ||
                        restoring ||
                        importPending ||
                        Object.values(run.roster).some((id) => id === null)
                      }
                      onClick={() => {
                        setOfficialGame(null);
                        setArcadeOpen(true);
                      }}
                    >
                      Play arcade
                    </button>
                    {Object.values(run.roster).some((id) => id === null) && (
                      <p className="arcade-entry-note">
                        Fill all eight roster slots to tip off.
                      </p>
                    )}
                  </div>
                </section>
                {!choosingCoach &&
                  (state.franchise?.phase === "season" && !run.result ? (
                    <FranchiseSchedule
                      run={run}
                      year={state.franchise.year}
                      busy={simulating || playoffSimulating}
                      progress={progress}
                      onPlay={openOfficialGame}
                      onAdvance={(rounds) => void advanceSeason(rounds)}
                    />
                  ) : (
                    <SeasonPanel
                      key={run.id}
                      run={run}
                      ratings={ratings}
                      animate={animatedRun === run.id}
                      simulating={simulating}
                      progress={progress}
                      onPlayoffs={(mode) => void advancePlayoffs(mode)}
                      playoffSimulating={playoffSimulating}
                      playoffProgress={playoffProgress}
                      onPlayGame={playoffFixture ? openOfficialGame : undefined}
                      franchiseYear={state.franchise?.year}
                      franchiseEntry={
                        !state.franchise ? franchisePanel : undefined
                      }
                      onSimulate={() => {
                        setAnimatedRun(run.id);
                        setPending(null);
                        setSwap(null);
                        void simulate();
                      }}
                    />
                  ))}
                {simulationError && (
                  <p className="notice" role="alert">
                    {simulationError}
                  </p>
                )}
              </>
            )}
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
              .{" "}
              <a
                href={publicAsset("/coaches/credits.html")}
                target="_blank"
                rel="noreferrer"
              >
                Coach portrait credits
              </a>
              .
            </p>
          </footer>
        </div>
        {confirm && (
          <ConfirmDialog
            title={confirm.title}
            description={confirm.description}
            confirmLabel={confirm.confirmLabel}
            onCancel={() => setConfirm(null)}
            onConfirm={confirm.onConfirm}
          />
        )}
        {guideOpen && <RulesPanel onClose={() => setGuideOpen(false)} />}
        {showChooser && !confirm && (
          <PlayChooser
            current={
              onboarding.style === "skipped" ? undefined : onboarding.style
            }
            onChoose={choosePlayStyle}
            onClose={() => {
              setChooserOpen(false);
              if (!onboarding.style)
                saveOnboarding({ ...onboarding, style: "skipped" });
            }}
          />
        )}
        {importPending && !restoring && (
          <ConfirmDialog
            title="Load shared lineup?"
            description={
              state.franchise
                ? "Loading this lineup replaces your franchise, including its career stats, trades and championship history. Your challenge records stay saved."
                : undefined
            }
            confirmLabel="Load lineup"
            onCancel={() => resolveImport(false)}
            onConfirm={() => resolveImport(true)}
          />
        )}
      </ShinyContext.Provider>
    </SpriteContext.Provider>
  );
}
