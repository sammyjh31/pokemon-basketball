import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
} from "react";

export const GAME_VIEWS = [
  "draft",
  "team",
  "season",
  "playoffs",
  "franchise",
  "arcade",
] as const;
export type GameView = (typeof GAME_VIEWS)[number];
const COPY: Record<GameView, [string, string]> = {
  draft: ["Draft", "Choose your trainer and build your roster."],
  team: ["Team", "Your lineup, bench and coaching."],
  season: ["Season", "Play games and explore your results."],
  playoffs: ["Playoffs", "Follow the road to a championship."],
  franchise: ["Franchise", "Manage your club between seasons."],
  arcade: ["Arcade", "Take your team onto the court."],
};
const NAVIGATE = "pokebb:navigate";
const aliases: Record<string, GameView> = {
  "draft-board": "draft",
  "season-title": "season",
};
const asView = (value: string) =>
  GAME_VIEWS.includes(value as GameView) ? (value as GameView) : aliases[value];
const Context = createContext<{
  active: GameView;
  navigate: (view: GameView) => boolean;
} | null>(null);
export const useGameNavigation = () => useContext(Context);

/** Also supports the existing programmatic links without a global React store. */
export function navigateGameView(id: string) {
  const view = asView(id);
  if (!view) return false;
  const event = new CustomEvent(NAVIGATE, { detail: view, cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
export function GameNavigation({
  children,
  screens,
  initial,
  resetKey,
  scope = "solo",
  loading = false,
}: {
  children: ReactNode;
  screens: Partial<Record<GameView, boolean>>;
  initial: GameView;
  resetKey: string;
  scope?: "solo" | "local";
  loading?: boolean;
}) {
  const availableKey = GAME_VIEWS.filter((view) => screens[view]).join(",");
  const available = useMemo(
    () => availableKey.split(",") as GameView[],
    [availableKey],
  );
  const fallback = available.includes(initial)
    ? initial
    : (available[0] ?? "draft");
  const readHash = useCallback(() => {
    const hash = window.location.hash.slice(1);
    if (scope === "local")
      return hash.startsWith("local-league/")
        ? asView(hash.slice(13))
        : undefined;
    return asView(hash);
  }, [scope]);
  const hashFor = useCallback(
    (view: GameView) => `#${scope === "local" ? "local-league/" : ""}${view}`,
    [scope],
  );
  const [requested, setRequested] = useState<GameView>(
    () => readHash() ?? fallback,
  );
  const active = available.includes(requested) ? requested : fallback;
  const previousReset = useRef(resetKey);
  const waitingForLoad = useRef(loading);
  const [focusRequest, setFocusRequest] = useState(0);
  const navigate = useCallback(
    (view: GameView) => {
      if (!available.includes(view)) return false;
      setRequested(view);
      setFocusRequest((n) => n + 1);
      if (window.location.hash !== hashFor(view))
        window.history.pushState(
          null,
          "",
          `${window.location.pathname}${window.location.search}${hashFor(view)}`,
        );
      return true;
    },
    [available, hashFor],
  );
  useEffect(() => {
    if (loading) {
      waitingForLoad.current = true;
      return;
    }
    if (waitingForLoad.current) {
      waitingForLoad.current = false;
      previousReset.current = resetKey;
      const route = readHash();
      setRequested(route && available.includes(route) ? route : fallback);
      return;
    }
    if (previousReset.current !== resetKey) {
      previousReset.current = resetKey;
      setRequested(fallback);
      setFocusRequest((n) => n + 1);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${hashFor(fallback)}`,
      );
    }
  }, [resetKey, fallback, hashFor, loading, available, readHash]);
  useEffect(() => {
    // Ignore the other mode's routes; App owns crossing between solo and local.
    const sameScope = () =>
      scope === "local"
        ? window.location.hash.startsWith("#local-league")
        : !window.location.hash.startsWith("#local-league");
    const fromHistory = () => {
      if (!sameScope()) return;
      const view = readHash();
      if (
        !view &&
        window.location.hash &&
        window.location.hash !== "#local-league"
      )
        return;
      setRequested(view && available.includes(view) ? view : fallback);
      setFocusRequest((n) => n + 1);
    };
    const fromGame = (event: Event) => {
      const view = (event as CustomEvent<GameView>).detail;
      event.preventDefault(); // A recognized but unavailable screen must not scroll into hidden content.
      navigate(view);
    };
    window.addEventListener("popstate", fromHistory);
    window.addEventListener("hashchange", fromHistory);
    window.addEventListener(NAVIGATE, fromGame);
    return () => {
      window.removeEventListener("popstate", fromHistory);
      window.removeEventListener("hashchange", fromHistory);
      window.removeEventListener(NAVIGATE, fromGame);
    };
  }, [scope, available, fallback, readHash, navigate]);
  useEffect(() => {
    // Saved seasons need time to make their deep-linked views available.
    if (loading) return;
    // Canonicalize invalid / unavailable views without adding a history entry.
    const hash = window.location.hash;
    const ownScope =
      scope === "local"
        ? hash.startsWith("#local-league")
        : !hash.startsWith("#local-league");
    if (ownScope && hash !== hashFor(active))
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${hashFor(active)}`,
      );
  }, [active, hashFor, scope, loading, focusRequest]);
  useEffect(() => {
    if (!focusRequest) return;
    const heading = document.querySelector<HTMLElement>(
      "[data-game-view-heading]",
    );
    heading?.focus({ preventScroll: true });
    document
      .getElementById("main-content")
      ?.scrollIntoView?.({ block: "start", behavior: "instant" });
  }, [active, focusRequest]);
  const onLink = (event: MouseEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor = (event.target as Element).closest?.("a[href]");
    if (
      !anchor ||
      anchor.getAttribute("target") === "_blank" ||
      anchor.hasAttribute("download")
    )
      return;
    const href = anchor.getAttribute("href") ?? "";
    if (!href.startsWith("#")) return;
    const id = href.slice(1);
    const view =
      id === "local-league" && scope === "local"
        ? fallback
        : asView(id.startsWith("local-league/") ? id.slice(13) : id);
    if (!view) return;
    event.preventDefault();
    navigate(view);
  };
  return (
    <Context.Provider value={{ active, navigate }}>
      <div
        className="game-navigation-root"
        data-game-view={active}
        onClickCapture={onLink}
      >
        {children}
      </div>
    </Context.Provider>
  );
}
export function GameScreen({
  screen,
  children,
  className = "",
}: {
  screen: GameView | GameView[];
  children: ReactNode;
  className?: string;
}) {
  const nav = useGameNavigation();
  const names = Array.isArray(screen) ? screen : [screen];
  const hidden = !!nav && !names.includes(nav.active);
  return (
    <div
      className={`game-screen ${className}`}
      data-game-screen={names.join(" ")}
      hidden={hidden}
      inert={hidden}
    >
      {children}
    </div>
  );
}
export function GameScreenHeading() {
  const nav = useGameNavigation();
  if (!nav) return null;
  const [label, description] = COPY[nav.active];
  return (
    <header className="game-view-heading">
      <h1 tabIndex={-1} data-game-view-heading>
        {label}
      </h1>
      <p>{description}</p>
    </header>
  );
}

/** Portaled reports must close too; hidden view ancestors cannot hide a body portal. */
export function useCloseOnGameViewChange(onClose: () => void) {
  const active = useGameNavigation()?.active;
  const previous = useRef(active);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (previous.current !== active) {
      previous.current = active;
      close.current();
    }
  }, [active]);
}
