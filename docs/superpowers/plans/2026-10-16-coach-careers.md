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
- [ ] Run focused tests and commit.

### Task 2: Solo and local lifecycle/persistence
- [x] Write/run integration failures for offseason changes, vacancy/start guard, next-year assignment, old-save compatibility and local round-trip/chronology.
- [x] Wire office into franchise/local types, transitions and validators. Capture local coach records, derive solo records from frozen replays.
- [ ] Run focused integration/persistence tests, build and commit.

### Task 3: Hiring UI and career directory
- [x] Add shared office with current coach, available trainers, fit/record, fire/hire, CPU review/news and scope explanation.
- [x] Add searchable career directory and season/series details; wire solo/local management.
- [ ] Verify user flows with focused component tests and desktop/mobile browser checks; preserve the user's live save.
- [ ] Independent final code review, repair important findings, update handoff, build, commit and push GitHub main.
