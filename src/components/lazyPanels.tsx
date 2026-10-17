import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import type { FranchisePanelProps } from "./FranchisePanel";
import type { LeaguePanel as LeaguePanelType } from "./LeaguePanel";
import type { PlayoffPanel as PlayoffPanelType } from "./PlayoffPanel";
import type { LocalLeagueMode as LocalLeagueModeType } from "./LocalLeagueMode";

/**
 * Splits a heavy panel out of the main bundle. Once its chunk has loaded the
 * panel renders synchronously, so later mounts never flash a fallback.
 */
function splitPanel<P extends object>(
  load: () => Promise<ComponentType<P>>,
  label: string,
) {
  let loaded: ComponentType<P> | undefined;
  let pending: Promise<ComponentType<P>> | undefined;
  const preload = () =>
    (pending ??= load().then(
      (component) => (loaded = component),
      (error) => {
        pending = undefined;
        throw error;
      },
    ));
  const Lazy = lazy(() =>
    preload().then((component) => ({ default: component })),
  );
  function SplitPanel(props: P): ReactNode {
    if (loaded) {
      const Loaded = loaded;
      return <Loaded {...props} />;
    }
    const Pending = Lazy as unknown as ComponentType<P>;
    return (
      <Suspense
        fallback={
          <p className="panel-loading" role="status">
            Loading {label}…
          </p>
        }
      >
        <Pending {...props} />
      </Suspense>
    );
  }
  return Object.assign(SplitPanel, { preload });
}

export const FranchisePanel = splitPanel<FranchisePanelProps>(
  () => import("./FranchisePanel").then((m) => m.FranchisePanel),
  "franchise",
);
export const LeaguePanel = splitPanel<Parameters<typeof LeaguePanelType>[0]>(
  () => import("./LeaguePanel").then((m) => m.LeaguePanel),
  "league standings",
);
export const PlayoffPanel = splitPanel<Parameters<typeof PlayoffPanelType>[0]>(
  () => import("./PlayoffPanel").then((m) => m.PlayoffPanel),
  "playoffs",
);
export const LocalLeagueMode = splitPanel<
  Parameters<typeof LocalLeagueModeType>[0]
>(
  () => import("./LocalLeagueMode").then((m) => m.LocalLeagueMode),
  "local league",
);

/** Warms every split panel, e.g. when the browser is idle or before tests. */
export const preloadPanels = () =>
  Promise.all(
    [FranchisePanel, LeaguePanel, PlayoffPanel, LocalLeagueMode].map((panel) =>
      panel.preload(),
    ),
  );
