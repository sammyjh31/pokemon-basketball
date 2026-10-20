# Persistent coach scouting implementation plan

> For agentic workers: use superpowers:executing-plans inline; one independent final review.

**Goal:** Coaches retain and adapt observed scouting across franchise seasons and job/roster changes.
**Architecture:** Optional annual coach books and versioned opening scouting seeds reuse existing game scouting, counter runtime and authenticated history replay.
**Tech Stack:** TypeScript/React/Vitest/Playwright; no new dependencies.
**Spec:** ../specs/2026-10-20-scouting-continuity.md

## Constraints / review focus
- Old unseeded v3 and earlier match/history inputs stay frozen.
- Keep individual player observations separate from team/paired scheme knowledge.
- Current rosters/appointments govern retention; rookies receive no fabricated knowledge.
- Coach job changes transfer personal knowledge; club reports transfer at reduced strength and never double-count.
- Annual capture uses completed evidence; seeded matches cannot see future results.
- Current offseason teams may trade/hire after their completed season: retain historical seed inputs until next boundary.
- Preserve full/cached history restoration and summary-only years without whole-history replay.

## Tasks
- [x] 1. Write failing policy/validation tests; implement scoutingContinuityTypes.ts, scoutingContinuity.ts and coachScoutingArchive.ts with aging, roster/pair/coach attenuation, trade-aware personal tendencies and strict parsing.
- [x] 2. Integrate annual capture, seeding, solo/local archives/boundaries, game/season initialization, seed chronology and cached restoration. Pin old match fingerprint; test real repeated/CPU/partial/playoff/new-year saves and trades/hiring. Commit and push.
- [ ] 3. Expose coach/box continuity explanations; verify UI/browser, full lifecycle, cold/warm loads and production build. Independent final review; fix findings, commit/push, merge exact verified head and verify automatic Pages release.

## Ledger
- Baseline48a11d4, existing managed worktree reused; primary checkout untouched.
- Ruling: use explicit versioned seed inputs rather than alter move rules v3. Unseeded historical inputs keep exact behavior.
- Ruling: keep annual books and derive latest knowledge from at most eight prior years; no duplicated growing authoritative root bank.

- Policy/engine: 44 checks across 6 files passed; additional signature attribution/zero-shot trade cases passed (7 policy checks).
- Full lifecycle: 3 checks across 3 files passed in272s, including full1230-game solo year, partial year2 cold/warm restore, two local years and mixed historical move rules v1/v2.
- UI summary: 2 checks passed. Browser/typecheck temporarily obstructed by concurrent visual-refresh JSX edits; those files are excluded from this branch commit.

- Clean attached release checkout created because the earlier checkout was concurrently used for visual refresh. Release branch `codex/scouting-continuity-release`; no foreign edits included.
- Independent review caught two P1 defects; regression RED/GREEN verifies position-swap tolerance and long-career save-size support. Rich30club/50year projected181.2M chars; reader bound256M,17M storage/routing reopen verified.
- Indexed lookup preserves facts and improves49book30club benchmark from287ms to29.9ms per boundary and9.85s to819ms across50 boundaries (reviewer measurement).
- Focused134 checks/16files passed38.4s; review-fix16checks/5files passed11.7s; typecheck passes clean checkout.
- Browser4 desktop/mobile checks passed21.4s. Production local year2 compiled worker cold5860ms/warm947ms, exact frozen history and seeds preserved; no page errors/HTTP failures.
