# Coach careers implementation plan

**Goal:** Offseason hiring/firing and CPU turnover with durable, correctly attributed coaching records in solo and local careers.
**Architecture:** Shared appointment/event and career-summary modules; thin solo/local adapters; shared coaching office and directory UI.
**Spec:** ../specs/2026-10-16-coach-careers-design.md
**Execution:** Native in the existing isolated worktree. User requested implementation; proceed without redundant design/permission gates.

## Global constraints
- No changes to simulated-match policy, historical inputs, roster sizes or saved coach IDs.
- CPU decisions happen once per offseason and exclude every human club.
- Preserve legacy saves; never manufacture historical coach identities or playoff detail.

## Review focus
- Fire then reload/start: a vacancy must persist and prevent starting, and rehiring must recover.
- Trainer moves between clubs: past wins/titles stay with the original trainer and year.
- Local multiple humans: CPU review cannot replace any friend's trainer or create duplicate employment.
- Repeated offseason actions/load: no repeated CPU turnover, duplicated records or lost events.
- Old archives/pending initial hire: no simulation replay changes or fabricated results.

### Task 1: Shared records and appointment market
- [x] Write/run failing tests for record attribution, partial season counting, immutable events, uniqueness, protected human/champion jobs and deterministic CPU turnover.
- [x] Implement `coachCareers.ts` and `coachOffice.ts` with versioned office types, projection, hiring/firing, CPU review and validation helpers.
- [x] Run focused tests and commit.

### Task 2: Solo and local lifecycle/persistence
- [x] Write/run integration failures for offseason changes, vacancy/start guard, next-year assignment, old-save compatibility and local round-trip/chronology.
- [x] Wire office into franchise/local types, transitions and validators. Capture local coach records, derive solo records from frozen replays.
- [x] Run focused integration/persistence tests, build and commit.

### Task 3: Hiring UI and career directory
- [x] Add shared office with current coach, available trainers, fit/record, fire/hire, CPU review/news and scope explanation.
- [x] Add searchable career directory and season/series details; wire solo/local management.
- [x] Verify user flows with focused component tests and desktop/mobile browser checks; preserve the user's live save.
- [x] Independent final code review, repair important findings, update handoff and build. Commit and push are the delivery step.

## Verification and review

- 56 focused engine/lifecycle/UI regression tests passed in the final 12-file batch, plus both full solo franchise tests (including archive/save/reload and next-season appointment restoration).
- Production build passed. Existing bundle-size warning remains.
- Browser checks: desktop fire/hire and career series disclosure; 390px mobile hire with no document overflow; fresh final preview had no browser errors. Screenshot: `docs/design/coaching-office.png` (isolated fixture preview).
- Independent review found two local compatibility/validation issues. Both were reproduced with failing tests and fixed: preserve CPU jobs when legacy Finals opponents are unknown; reject coached season boundaries with vacancies, including imported saves. A separate failing component regression fixed the offseason roster's stale prior-coach summary.
- Review tuning decision: retain the documented, deterministic performance/roster-fit heuristics. Basketball balance may need further tuning through play; no additional match-engine policy changes were made.
