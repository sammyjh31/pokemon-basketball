import { useState } from "react";
import { Dialog } from "./Dialog";
import { createPortal } from "react-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  GameNavigation,
  GameScreen,
  GameScreenHeading,
} from "./GameNavigation";
import { KantoNavigation, scrollToGameSection } from "./KantoShell";

afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});
function DraftInput() {
  const [name, setName] = useState("");
  return (
    <input
      aria-label="Scout search"
      value={name}
      onChange={(e) => setName(e.target.value)}
    />
  );
}
function Room({ local = false, playoffs = false, resetKey = "run-1" }) {
  return (
    <GameNavigation
      scope={local ? "local" : "solo"}
      initial="draft"
      resetKey={resetKey}
      screens={{ draft: true, team: true, season: true, playoffs }}
    >
      <KantoNavigation team season playoffs={playoffs} />
      <main id="main-content" tabIndex={-1}>
        <GameScreenHeading />
        <GameScreen screen="draft">
          <DraftInput />
          <a href="#season">Head to the season</a>
        </GameScreen>
        <GameScreen screen="team">
          <h2>Roster room</h2>
        </GameScreen>
        <GameScreen screen="season">
          <h2>Season room</h2>
          <button onClick={() => scrollToGameSection("playoffs")}>
            View championship
          </button>
        </GameScreen>
        <GameScreen screen="playoffs">
          <h2>Championship room</h2>
        </GameScreen>
      </main>
    </GameNavigation>
  );
}
it("shows one view, preserves draft input and moves keyboard context to the view heading", () => {
  render(<Room />);
  fireEvent.change(screen.getByRole("textbox", { name: "Scout search" }), {
    target: { value: "Pikachu" },
  });
  expect(
    screen.queryByRole("heading", { name: "Roster room" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Team" }));
  expect(
    screen.getByRole("heading", { name: "Roster room" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Team", level: 1 })).toHaveFocus();
  expect(window.location.hash).toBe("#team");
  fireEvent.click(screen.getByRole("button", { name: "Draft" }));
  expect(screen.getByRole("textbox", { name: "Scout search" })).toHaveValue(
    "Pikachu",
  );
});
it("routes old in-page links and programmatic links through the same view switch", () => {
  render(<Room playoffs />);
  fireEvent.click(screen.getByRole("link", { name: "Head to the season" }));
  expect(window.location.hash).toBe("#season");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "View championship" }));
  expect(window.location.hash).toBe("#playoffs");
  expect(
    screen.getByRole("heading", { name: "Championship room" }),
  ).toBeInTheDocument();
});
it("honors direct views, handles history changes, and recovers unavailable views without altering query parameters", () => {
  window.history.replaceState(null, "", "/?lineup=25#playoffs");
  render(<Room />);
  expect(screen.getByRole("textbox")).toBeInTheDocument();
  expect(window.location.search).toBe("?lineup=25");
  act(() => {
    window.history.pushState(null, "", "?lineup=25#team");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(
    screen.getByRole("heading", { name: "Roster room" }),
  ).toBeInTheDocument();
  act(() => {
    window.history.pushState(null, "", "?lineup=25#draft");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(screen.getByRole("textbox")).toBeInTheDocument();
});
it("keeps local view identity in the URL and resets to a usable view on a new run", () => {
  window.history.replaceState(null, "", "/#local-league");
  const view = render(<Room local />);
  fireEvent.click(screen.getByRole("button", { name: "Season" }));
  expect(window.location.hash).toBe("#local-league/season");
  view.rerender(<Room local resetKey="run-2" />);
  expect(screen.getByRole("textbox")).toBeInTheDocument();
  expect(window.location.hash).toBe("#local-league/draft");
});

it("dismisses an open report when browser history moves to another screen", () => {
  function Report() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open report</button>
        {open &&
          createPortal(
            <Dialog title="Game report" onClose={() => setOpen(false)}>
              <button onClick={() => setOpen(false)}>Close</button>
            </Dialog>,
            document.body,
          )}
      </>
    );
  }
  render(
    <GameNavigation
      initial="season"
      resetKey="report"
      screens={{ season: true, team: true }}
    >
      <main id="main-content">
        <GameScreenHeading />
        <GameScreen screen="season">
          <Report />
        </GameScreen>
        <GameScreen screen="team">Team content</GameScreen>
      </main>
    </GameNavigation>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open report" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  act(() => {
    window.history.pushState(null, "", "#team");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("heading", { name: "Team", level: 1 })).toHaveFocus();
});

it("keeps skip-to-content and unknown in-page anchors within the active view", () => {
  render(<Room />);
  fireEvent.click(screen.getByRole("button", { name: "Team" }));
  act(() => {
    window.history.pushState(null, "", "#main-content");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(
    screen.getByRole("heading", { name: "Roster room" }),
  ).toBeInTheDocument();
});

it("waits for saved-season restoration before resolving a deep link", () => {
  window.history.replaceState(null, "", "/#playoffs");
  const body = (
    <>
      <GameScreenHeading />
      <GameScreen screen="draft">Fresh draft</GameScreen>
      <GameScreen screen="playoffs">Saved bracket</GameScreen>
    </>
  );
  const view = render(
    <GameNavigation
      loading
      initial="draft"
      resetKey="loading"
      screens={{ draft: true }}
    >
      {body}
    </GameNavigation>,
  );
  expect(window.location.hash).toBe("#playoffs");
  view.rerender(
    <GameNavigation
      loading={false}
      initial="season"
      resetKey="restored"
      screens={{ draft: true, season: true, playoffs: true }}
    >
      {body}
    </GameNavigation>,
  );
  expect(screen.getByText("Saved bracket")).toBeVisible();
  expect(window.location.hash).toBe("#playoffs");
});

it("canonicalizes an unavailable history destination even when already on its fallback", () => {
  render(<Room />);
  act(() => {
    window.history.pushState(null, "", "#playoffs");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.getByRole("textbox")).toBeInTheDocument();
  expect(window.location.hash).toBe("#draft");
});
