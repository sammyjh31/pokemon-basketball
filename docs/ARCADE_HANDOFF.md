# Five-on-five arcade

The arcade is a local exhibition mode using the drafted eight-player roster. Open **Play arcade**, choose one of the league's CPU teams, and tip off. Arcade results never write to season, playoff, franchise, or roster state.

## Play

- WASD/arrows move; J holds/releases a timed shot or jumps/blocks on defense.
- K passes toward movement or the selected receiver; on defense it attempts a steal.
- L selects a receiver or switches defenders; Shift holds turbo.
- Turbo near the rim enables dunks; turbo passes toward a teammate at the rim attempt alley-oops.
- Escape/P pauses. Bench swaps apply at the next dead ball or before the next quarter.
- On-screen controls support simultaneous touch pointers, cancellation, and keyboard activation.

Four one-minute quarters use a 14-second possession clock. Ties play repeated 30-second overtimes. Three unanswered team baskets ignite a ten-second hot streak. Every team has five active players and three reserves. Refreshing or leaving ends the exhibition; only audio/reduced-effects preferences persist, under a separate key.

## Implementation

`src/game/arcade/` owns a seeded spatial engine with fixed steps, player movement/contact, possession, ball flight, interceptions, shot timing, rebounds, period transitions, energy, substitutions, AI, and event-derived stats. It uses existing player profiles without modifying historical simulation models.

`src/arcade/` supplies the Canvas renderer, asset fallback, Web Audio, input controller, and preferences. `useArcade` runs bounded simulation catch-up, renders independently from throttled React snapshots, pauses on focus loss, and clears held actions. The arcade bundle loads only when opened.

## Validation

Scenario tests cover roster isolation, seeded outcomes, pause cancellation, shot value at release, legal buzzer shots, shot-clock expiration, rim rebounds, boundary violations, stale charges after steals, assists, substitutions, and complete-match scoring/minutes conservation. UI tests cover setup, live entry, pause/exit, input cancellation, restored focus, settings failures, results, and preservation of an existing saved season.

Independent engine review completed 30 seeded CPU games with consistent scores, playing time, active-player counts, and ball ownership. No remaining actionable review findings. CPU games scored 12–36 combined points, with 32–65 attempts.

Final checks: 218 tests across 39 files, TypeScript, production build, and whitespace validation passed. Browser verification completed four quarters, both box scores, rematch, exit, unchanged roster, desktop/mobile layouts, keyboard/touch controls, and settings. Details are recorded in the implementation plan. Screenshots live in `docs/design/arcade-*.jpg`.

## Current limits

Single player versus CPU; no multiplayer, gamepad, player combat abilities, or playable scheduled league fixtures. Animation transforms the existing pixel sprites. Court rules intentionally omit fouls, free throws, and goaltending. Very short portrait windows can scroll to retain usable touch targets; landscape provides more court space. Frame pacing has been visually inspected but has not been measured on physical mobile hardware.

## Local delivery

Preview: `http://127.0.0.1:5179/`, running from the managed `codex/five-on-five-arcade` worktree at `/Users/sam/.codex/worktrees/five-on-five-arcade/PokeBBall`. The branch includes the committed playoff implementation. The primary checkout contains ongoing uncommitted franchise changes and has not been modified by arcade delivery; integrate this branch when that checkout is ready.
