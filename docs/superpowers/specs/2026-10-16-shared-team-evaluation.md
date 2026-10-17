# Shared team evaluation

Build one deterministic, explainable basketball evaluation used by coaches, recruiting, trading, rotations, and training. A player retains universal positional ratings; contextual team value is separate. Height, weight and typing already feed those ratings and traits. Species ability usefulness is bounded, conditional on enabled rules, and cannot replace basketball talent.

## Model and boundaries

The pure `teamEvaluation.ts` layer imports profiles, trainer definitions, abilities and training skill definitions, never consumers. Context contains a roster snapshot, developed profiles, coach-aware offense/defense and team needs. Player value has named talent, role, scheme, ability and needs contributions. Roster value also rewards coverage at all five positions. The same before/after roster comparison powers transactions. No consumer duplicates scheme or ability weights for modern evaluations.

Coaches use the common scheme assessment; rotations and actual substitutions use the same player value plus existing minute, rest, matchup and foul constraints. Training ranks attainable improvement in the shared player objective using the actual focus skill redistribution; workload and risk still control intensity. Trade fairness, availability, club direction, continuity, eligibility and rival-specific counter scouting remain explicit constraints/context, not alternative ability formulas.

Solo CPU drafts, local CPU drafts and local human recommendations use this model. Rookie and free-agent decisions use developed ratings and compare the complete affected roster. Scores and factors are shown in coach/scouting and existing decision explanations. Universal OVR is unchanged.

## Compatibility

`evaluationVersion: 1` opts new runs and leagues into the model. Absent flags preserve all preceding policies and seeded results, including the coached species-ability release. Parsers validate consistent flags, preserve old archives, and never silently change active or recorded seasons. Existing franchises adopt at an explicit next-season boundary; historical transaction validation uses the flags stored on that season. Local careers adopt per season independently of their original draft version. No user saves are modified by development or testing.

## Acceptance

All six systems use the shared module when enabled; changing coach, development or roster composition changes evaluation deterministically without stale caches. Eight-player unique rosters, 240 regulation minutes, prospect eligibility and trade safeguards persist. Old replay fingerprints remain exact. Focused policy, lifecycle, market and UI tests and production build pass. Commit and push verified work to origin/main as requested.
