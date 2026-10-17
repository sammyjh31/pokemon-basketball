# Physical ability effects

Abilities now need to influence the actions that create shots and possessions, not only shot probability. Use one pure, bounded effect table derived from the existing pinned species ability adaptations. Apply movement speed, screen contact/navigation, rebound contest weight, active energy drain, and recovery modifiers at their actual resolution points. Keep body, typing, skills and energy relevant. No additional random draws or global rating rewrites.

A separate `physicalAbilityVersion: 1` enables these effects alongside enabled `abilityVersion: 1`. New games use them; existing franchises adopt at their next-season boundary. Missing flags preserve prior simulations and archive replay exactly. Disabling abilities disables physical effects and valuation credit too.

Simulation and playable games share the table. Coaches consider its effects in shared evaluation, offensive/defensive plans, automatic rotations and training; screen coverages also consider navigation, speed and contact. This flows through recruiting without separate market formulas.

Keep existing shot activations unchanged. Add optional `abilityActivations.physical` with movement (extra feet actually travelled), screens (resolved affected contacts), rebounds (affected contest opportunities), energySaved (actual conserved/restored energy after caps). Report these separately; do not present passive per-frame events as shot activations. Playable-game counters remain actual, never multiplied by the official-game scoring scale.

Effects are bounded basketball adaptations, not claims about canonical Pokémon battle behavior. Neutral effects have no telemetry. Explain relevant effects in scouting and show totals in existing ability stats across box scores, season, playoffs and careers.

Verify direct mechanics, deterministic outcomes, ability-off parity, current/older frozen replays, coaches/training, save validation/aggregation, local and solo season transitions, and a complete franchise lifecycle. Preserve user saves and the running local server.
