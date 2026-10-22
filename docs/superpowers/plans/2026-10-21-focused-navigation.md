# Focused Navigation Implementation Plan

> **For agentic workers:** Execute inline with superpowers:executing-plans. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace one long game page with focused views in solo and local leagues.
**Architecture:** A small React navigation provider owns view availability, URL/history and focus. Native hidden/inert view boundaries preserve mounted state. KantoNavigation and in-page links share this navigator. Split postseason presentation from solo SeasonPanel at the App boundary.
**Tech Stack:** Existing React/TypeScript/Vite, native history/details and Vitest.
**Spec:** docs/design/navigation-2026-10-21.md

## Global constraints
- Do not change game rules, saved formats or simulation guards.
- Preserve mounted state while changing view; preserve query parameters in URLs.
- Local routes must retain local-league identity; unavailable routes must recover.
- Keep existing retro styles, responsive navigation and reduced-motion behavior.

## Review focus
- Fresh/incomplete/archived saves and offseason views must have a visible usable fallback.
- Direct hashes, old anchors, local-mode switches and Back/Forward must agree with active navigation.
- Hidden pick docks / reports / modal triggers cannot steal focus from the visible screen.
- Choosing trainers, final draft picks, new seasons and resets must land on actionable content.
- Roster image export must capture a visible court after switching away from Draft.

## Tasks
- [x] Write failing provider and focused App interaction checks for visibility, preserved inputs, URL/history, unavailable views and local route identity.
- [x] Implement navigation provider / view boundary, active title, Kanto menu integration and same-app link handling.
- [x] Separate solo Draft, Team, Season, Playoffs, Franchise and arcade entry. Preserve next-step actions, pending picks and image export.
- [x] Separate local setup/draft, team review, season results, postseason and career management; preserve save and simulation status visibility.
- [x] Adapt affected existing interaction checks to use real view navigation; verify targeted draft, season, postseason and local handoff checks.
- [x] Check desktop/phone UI and browser Back/Forward using isolated preview data; review, fix findings, remove fixtures and production build.

## Verification and review
- Provider / focused App / Kanto navigation plus season statistics, reveal, playoff panel and local draft: 51 checks passed. Includes unavailable-history fallback and delayed saved-season deep links.
- Trainer / chemistry / arcade: 7 checks passed. Local setup, scouting, saved handoff, old completed-season playoff deep link, storage recovery and mode exit: 6 checks passed.
- Archived five-player recap accessibility: 1 check passed. Selected existing App draft interactions also passed (11 checks).
- Read-only final review identified local replay timing, draft matchup visibility, local link scope and history canonicalization; all four addressed. Additional archived recap availability fixed and verified.
- Desktop and 390px phone UI inspected. Real saved local league navigated read-only through Team, Season, Playoffs and Franchise. Solo pending pick moved Draft → Team, placed, and retained after Back/Forward. Direct Playoffs links verified. Temporary fixtures removed; dedicated QA server stopped.
- Production build with /pokemon-basketball/ base and TypeScript passed; diff whitespace check clean. Existing large-bundle warning remains.
- Full PlayoffApp integration did not run its cases: existing full-season beforeAll exceeded its 60-second limit. Full engine/save-replay suites were not rerun to completion for this UI change; targeted playoff presentation/navigation and local legacy restore checks passed. No claim of full-suite success.
- Saved locally; no publication performed in this task.
