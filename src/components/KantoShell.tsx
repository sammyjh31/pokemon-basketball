import { useEffect, useState } from "react";
import { navigateGameView, useGameNavigation } from "./GameNavigation";
import { BuildingCommunity } from "pixelarticons/react/BuildingCommunity.js";
import { Users } from "pixelarticons/react/Users.js";
import { Clipboard } from "pixelarticons/react/Clipboard.js";
import { ChartBarBig } from "pixelarticons/react/ChartBarBig.js";
import { Trophy } from "pixelarticons/react/Trophy.js";

export function GameBrand({ local = false }: { local?: boolean }) {
  return (
    <a
      className="brand"
      href={local ? "#local-league" : "#draft"}
      aria-label="82–0 Pokémon Basketball"
    >
      POKÉMON <span>82–0</span>
      <small>BASKETBALL</small>
    </a>
  );
}
export function LocalMasthead({
  onExit,
  disabled = false,
  onRestart,
  restartDisabled = disabled,
}: {
  onExit: () => void;
  disabled?: boolean;
  onRestart?: () => void;
  restartDisabled?: boolean;
}) {
  return (
    <div className="kanto-masthead">
      <GameBrand local />
      <span>ONE COMPUTER. EVERY RIVALRY.</span>
      <div className="masthead-actions">
        {onRestart && (
          <button
            type="button"
            className="header-restart"
            onClick={onRestart}
            disabled={restartDisabled}
          >
            New local league
          </button>
        )}
        <button
          type="button"
          className="kanto-exit"
          onClick={onExit}
          disabled={disabled}
        >
          Back to game
        </button>
      </div>
    </div>
  );
}
export function scrollToGameSection(id: string) {
  if (navigateGameView(id)) return;
  const target =
    (id === "draft" ? document.getElementById("draft-board") : null) ??
    document.getElementById(id);
  const disclosure = target?.closest("details");
  if (disclosure instanceof HTMLDetailsElement) disclosure.open = true;
  target?.scrollIntoView?.({ block: "start", behavior: "instant" });
}
export function KantoNavigation({
  team = false,
  draft = true,
  season = false,
  playoffs = false,
  initial = "draft",
  franchise = false,
}: {
  team?: boolean;
  draft?: boolean;
  season?: boolean;
  playoffs?: boolean;
  initial?: string;
  franchise?: boolean;
}) {
  const navigation = useGameNavigation();
  const [active, setActive] = useState(initial);
  useEffect(() => setActive(initial), [initial]);
  return (
    <aside className="kanto-sidebar">
      <span className="kanto-menu-label" aria-hidden="true">
        LEAGUE MENU
      </span>
      <nav aria-label="Game sections">
        {[
          { id: "draft", label: "Draft", Icon: Clipboard, enabled: draft },
          { id: "team", label: "Team", Icon: Users, enabled: team },
          { id: "season", label: "Season", Icon: ChartBarBig, enabled: season },
          {
            id: "playoffs",
            label: "Playoffs",
            Icon: Trophy,
            enabled: playoffs,
          },
          ...(franchise
            ? [
                {
                  id: "franchise",
                  label: "Franchise",
                  Icon: BuildingCommunity,
                  enabled: true,
                },
              ]
            : []),
        ].map(({ id, label, Icon, enabled }) => (
          <button
            type="button"
            key={id}
            disabled={!enabled}
            aria-current={
              (navigation?.active ?? active) === id ? "location" : undefined
            }
            onClick={() => {
              setActive(id);
              scrollToGameSection(id);
            }}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <p>
        BUILD YOUR TEAM.
        <br />
        MAKE YOUR RUN.
      </p>
    </aside>
  );
}
