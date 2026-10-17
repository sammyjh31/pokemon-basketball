# Ability mastery and league news verification

Implemented on top of `03d2f61`, retaining the court, CPU roster, save recovery and worker changes already on main.

## Coverage

- Pure progression checks cover tier boundaries, bounded effects and XP, overtime normalization, zero-minute players, disabled abilities, frozen snapshots, training seeds, roster ownership and release/re-sign carryover.
- Engine tests exercise shooting, support, defense, movement, screens, rebounds and energy. They compare compact/full simulation, frozen playable-game inputs, shared valuation and coach-managed training.
- Lifecycle checks cover chronological official fixtures, away-team orientation, duplicate credit, playoff carryover, package trades, zero-XP rookies, free agency, offseason training, old-save adoption and rejection of modified saves.
- The full franchise integration runs all 1,230 regular-season fixtures, the complete playoffs, training for 240 players, CPU transactions, year two and its first game round. It restores through the real save loader and compares current mastery and a historical box score exactly.
- News checks cover stable IDs, duplicate sources, all-team stories, actual game/transaction facts, playoff ordering, current and historical years, local season highs and invalid archived records.
- UI checks cover current playoff/regular-season banks, frozen historical game reports, official away-game inputs, and local friends managing nonzero club IDs. Desktop and 390-pixel mobile checks use isolated browser contexts, exercise filters and details, verify text contrast and horizontal overflow, and leave user saves untouched.

## Compatibility

Six existing release replay hashes and the pre-mastery match/playable-game hash remain unchanged. The original CPU-rule legacy offseason and next-season save hashes also pass without changing their expected values. Historical fixture generators explicitly omit features introduced after the release they represent.

Older active seasons keep their original rules. Mastery is introduced only for a new game or at the next franchise season boundary, without inventing earlier experience. News displays available recorded history; unsupported historical facts are not synthesized.

## Issues caught and repaired

- News facts initially made the franchise archive comparison fail. The archive source now captures facts consistently and preserves older summaries that lack them.
- Sequential official games need mastery snapshots validated against the correct game prefix, including when chemistry growth is absent.
- Disabled-ability official games retain frozen mastery metadata while applying no ability effects or XP.
- Old archives without replay inputs still receive structural validation before their news facts can be rendered.
- Incoming mastery is included in CPU trade shortlists as well as final trade evaluations.
- News cards now use the app's dark theme variables; the browser test checks readable contrast.
- Ten-year local careers exposed signed-zero morale values after rounding. Canonical zero preserves exact JSON restoration without changing numerical game results.

## Scope of validation

Final combined verification: 11 files / 26 tests passed, including the complete franchise integration and six release replay hashes. Production build passed. Separate passing batches cover 74 engine tests, 61 UI regressions, 35 repaired career/official/morale regressions, 18 market/chronology/news checks, additional focused feature checks, legacy save hashes and desktop/mobile browser checks. Batch counts overlap and should not be summed as unique tests.

Production build and targeted engine, lifecycle, UI, persistence and historical replay suites were used. The entire repository test suite was not run; selected long-running legacy cases were exercised rather than repeatedly simulating every historical fixture. Browser evidence is kept in ignored `test-results/` outputs, not in game saves.
