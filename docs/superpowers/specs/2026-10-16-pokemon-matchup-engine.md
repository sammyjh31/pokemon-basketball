# Pokémon matchup engine

The user wants typing and physical identity to change who wins and why through actual possession decisions. Existing rating conversion and bounded type odds are insufficient: additional physical effects are partly local-league-only, while play selection mostly follows generic tactic weights.

Build an opt-in, versioned matchup layer in the existing simulator. Every player receives a bounded body profile from catalog height and weight (reach, mass leverage, turning inertia, workload). Do not invent anatomical measurements or claim catalog length is literal standing reach; compression caps extreme species. Same skills with a different body must have different contextual strengths, never a universal size bonus.

Coaches use joint physical/type matchup opportunity to select plays, ball recipients, defensive assignments, switches and help. Each attacking action resolves an advantage state before the shot: post seal, separation or containment. Type resistance changes these contests as well as finishing, but never makes an outcome certain. Screens pit screener leverage against the assigned defender's mobility; help can contain an advantage but opens a kickout. Reach influences contests, block risk and passing lanes. Mass helps box-outs and contact, while inertia and workload create a perimeter/pace cost. Use bounded, deterministic game-design coefficients, not empirical basketball claims.

Replace the prior generic physical and type contributions on the new path where they overlap. Keep rating conversion stable. Preserve all basketball accounting, fouls, rotations and seeded replay. Result/insight collection must not change random draws. No changes to playable arcade mechanics in this pass.

Add shot-level and game-level matchup explanations, with actual attacker/defender pairings, measured body differences, advantages won/contained and the model's conditional probability changes. Label conditional effects clearly; do not call these a counterfactual winning margin. Include a pregame matchup explorer using the same model so scouting is actionable before simulation.

Persist `matchupVersion: 1` on new runs and clubs. Standard franchises adopt it at the next season boundary. New version-2 local leagues opt in; older local careers retain their original rules. Historical absence must preserve exact replay. Reject mixed/unknown flags; preserve flag in archives, imports, trades, drafts and development.

Verification: controlled equal-skill body/type experiments, attack-choice and coaching checks, extreme-body bounds, historical byte equality, event accounting and collection invariance, save/archive round trips, build, full suite, seeded multi-roster balance audit, browser check using separate QA save.

## Implemented tuning

The authoritative formulas are in `src/game/bodyMatchups.ts`; all dimensions use the bundled catalog. Reach is `tanh(log1p(heightM) / 1.8)`, mass is `tanh(log(weightKg / 80) / 2.2)`, and inertia is `0.375 * (mass + 1) + 0.25 * reach`. Readiness scales skills with current energy. Contact blends mass difference (65%) and strength difference (35%); reach blends compressed height (75%) and vertical (25%); quickness blends speed (65%), inertia (35%) and energy difference.

| Mechanic | Tuning / limits |
| --- | --- |
| Post opportunity | Contact × .65 + reach × .30, plus bounded type preference |
| Drive / transition opportunity | Quickness × 1.20, with a penalty against a longer defender |
| Play / recipient preference | Exponential opportunity weight, bounded .4–2.5 |
| Advantage creation | Starts at .38; post uses contact × .30 + reach × .14, other actions use quickness × .38 + reach × .04; typing, screens and help adjust it; bounded .12–.80 |
| Screen leverage | Screening versus guard speed, screener mass and guard inertia; bounded 0–.70; actual switches retain only 25% of the screen edge |
| Physical shot shift | Contextual body edges, won position (+.14 log odds), containment (−.08), screens, help and kickouts; bounded −.55 to +.55 log odds |
| Type shot shift | Actual defender plus resistant rim help when present; bounded −.24 to +.24 log odds |
| Extra turnover / foul / block probability | Bounded ±.025 / −.012…+.045 / −.035…+.045 |
| Short rebound body term | Reach × 18 and mass × 7, added to the existing pursuit model |
| Long rebound body term | Reach × 5 minus inertia × 9; no extra mass bonus |
| Workload | Positive mass × .35 + reach × .10; 1.8× with pace or press |

Pure model controls with identical basketball skills show the tradeoff: changing an attacker from 20 kg to 400 kg at the same height raises post-advantage creation from 27.1% to 50.2%, while drive-advantage creation falls from 40.8% to 34.9%. Equal-body Fire attacks create an advantage 42.5% against Grass versus 33.5% against Water. These are fictional tuning examples, not empirical basketball estimates.

The 1,000-game audit spans 30 varied rosters, five tactics and both previous/new rules. It checks exact score accounting, finite results, resolved ties and extreme scores. It is a calibration smoke test, not an exhaustive search for an optimal roster. Historical replay comparisons cover 60 fixed games across six prior model combinations and require byte-identical results.
