# 82–0 Pokémon Basketball

## Goal and agreed scope

Build a browser game inspired by https://poke17-0.com/: draft Pokémon into sports positions, inspect how well they fit, and simulate a season while chasing an undefeated record. The user explicitly chose Pokémon as basketball players and a roster consisting of five starters only.

The reference was accessible on October 15, 2026. Its HTML and client logic confirm a football drafting and season simulation game, including Spin & Pick, Free Draft, position ratings, season probabilities, and local records. Our implementation will use original basketball rules and presentation rather than copy its application code.

The approved first playable version includes an 82-game regular season, the original 151 Pokémon, two drafting modes, browser-local saving, and desktop and mobile support. No accounts or backend are required. The user approved this written spec on October 15, 2026.

## Approach

1. **Recommended: draft and simulate.** A self-contained browser app, five court positions, role-based ratings, and an 82-game season. Closest to the reference and gives players a complete, replayable game quickly.
2. **Possession-by-possession coaching.** Adds tactical decisions during each game, but changes the reference's quick drafting loop and substantially expands the simulation.
3. **Arcade basketball.** Directly control Pokémon on the court. Requires movement, collision, animation, and opponent AI; a different game from the supplied reference.

This spec selects the first approach. Benches, substitutions, live movement controls, playoffs, multiplayer, accounts, and additional generations are outside this initial release.

## Main player flow

1. Open the game and see a hardwood half-court with five open slots: point guard (PG), shooting guard (SG), small forward (SF), power forward (PF), and center (C).
2. Use the default Spin & Pick mode, or switch to Free Draft.
3. Inspect a Pokémon's portrait, types, basketball attributes, and rating for each available position. Select it and place it into an open court slot.
4. Fill all five positions with distinct Pokémon. Team offense, defense, and overall ratings update after each selection. Partial-roster ratings are labeled provisional; season simulation remains disabled.
5. Simulate the season. Reveal 82 results, scores, final win–loss record, and team MVP, with an option to skip the reveal animation.
6. Copy a text recap or start a new draft. Best records and undefeated-season counts persist in the same browser.

## Draft rules

### Spin & Pick

- Each offer contains four distinct, randomly selected Pokémon from the eligible undrafted pool.
- The player chooses one Pokémon and places it into an empty position; that placement is locked for the run.
- Completing a pick generates the next offer. Unchosen Pokémon remain eligible for later offers.
- Two re-rolls are available for the entire five-pick run. Re-rolling consumes one, replaces the offer, and clears any pending selection. Never duplicate a Pokémon within an offer or roster.
- Controls explain that placements are locked before the first selection.

### Free Draft

- Search the 151-Pokémon pool by name and filter by type.
- Choose any undrafted Pokémon, replace a player, or swap two occupied court positions.
- The same Pokémon cannot occupy two slots. No salary cap applies in this first version.

Both modes offer a clearly labeled legendary/mythical inclusion toggle, enabled by default. Changing the mode or pool after drafting has begun asks before starting a new run. Canceling preserves the current run.

## Basketball model

Use official Pokémon base stats, height, and weight from a documented public Pokémon dataset. Bundle the selected records in the app so gameplay does not depend on a live API. Use Pokémon portraits from the PokeAPI sprite collection, with names and type-colored placeholders if images fail. Include source attribution and an unofficial fan-project notice.

Derive six basketball attributes on a 0–100 scale:

- **Shooting:** special attack and special defense, with a smaller speed contribution.
- **Playmaking:** special attack and speed, with special defense representing composure.
- **Finishing:** attack, speed, and a bounded height contribution.
- **Perimeter defense:** speed, defense, and special defense.
- **Interior defense:** defense, HP, and bounded size contributions.
- **Rebounding:** HP, defense, and bounded height/weight contributions.

Normalize base stats against a fixed reference range, clamp all attributes, and transform height and weight logarithmically before capping their contributions. Extremely long or heavy Pokémon must not automatically dominate every position. Publish the actual weights and normalization rules in the game's expandable rules panel, generated from the same constants the simulation uses.

Position ratings use different combinations of these attributes: PG emphasizes playmaking, SG shooting, SF versatility, PF finishing and rebounding, and C interior defense and rebounding. Speed helps guards; bulk helps interior players. Types identify Pokémon visually but do not introduce a battle-style effectiveness multiplier. Special move abilities are not part of the initial simulation.

Compute team offense and defense from the five players' attributes and positions. Opponents have reproducible offensive and defensive ratings and basketball styles. Construct a fixed 82-game schedule across 29 fictional Pokémon-themed opponents, with 41 home games and 41 away games. Show opponent identity, projected win probability, and final score for each game.

Generate outcomes from team matchup ratings, a modest home advantage, and seeded randomness. Probabilities must stay between 0 and 1 and increase monotonically when the player's relevant ratings improve. A better lineup should win more often across repeated simulations, but results are never guaranteed. The 82–0 target is a rare challenge, not a promise.

Scores must be nonnegative integers and match the sampled winner; ties trigger an overtime resolution. The MVP is determined by accumulated simulated player-of-the-game awards, weighted toward good positional fit. Do not invent detailed player box scores that the engine does not simulate.

One completed season is allowed per drafted roster. Afterward, changing the roster requires starting a new run. Refreshing preserves the completed result rather than providing another free simulation. Separate random streams for offers and games keep animation and re-roll timing from changing results.

## Presentation and accessibility

Use a dark navy scoreboard header, warm hardwood court, cream panels, and orange highlights. Pokémon portraits and the five named court positions are the main visual focus. Display offense, defense, overall rating, draft progress, and the season record prominently.

On desktop, place the court beside the draft panel and the season below. On mobile, stack the court, draft panel, and season with clear navigation back to the active selection. All actions work through buttons; dragging is optional and is not required for play.

Include visible keyboard focus, meaningful labels for portraits and positions, accessible selected states, text labels alongside type colors, and announcements for picks and results. Respect reduced-motion settings. On narrow screens, season rows remain readable without horizontal page overflow.

## Architecture and state

Use React, TypeScript, and Vite, with CSS for the court and layout. Use the available Node 24 runtime and npm with a committed lockfile.

Keep these responsibilities separate:

- Pokémon data and attribution: static records and asset references.
- Ratings: pure functions and shared, inspectable formula constants.
- Draft engine: offers, eligibility, placement rules, swaps, and re-roll accounting.
- Season engine: schedule generation, seeded random streams, matchup probabilities, scores, and awards.
- State and persistence: a versioned reducer-based state model and validated localStorage records.
- UI: court, candidate cards, free-draft browser, ratings/rules, season results, and recap controls.

Persist the current run and historical records. Validate restored data, including Pokémon IDs, duplicate players, mode, counters, seeds, and result lengths. A malformed or unsupported save should fall back to a clean run with a brief notice. If browser storage is unavailable, keep the game usable in memory and indicate that progress will not be saved.

Prevent duplicate simulation starts and repeated history updates. Resetting a run cancels pending reveal timers. Copying a recap reports success only after clipboard writing succeeds; otherwise show selectable recap text.

## Validation and acceptance

- Unit tests demonstrate unique offers and rosters, locked placements in Spin & Pick, exactly two re-rolls, valid free-draft swaps, and simulation blocking for incomplete teams.
- Ratings tests cover finite bounded values, distinct position fits, and the effects of height/weight caps.
- Simulation tests verify seed repeatability, exactly 82 games, 41 home/away games, no tied final scores, score/result agreement, and monotonically improving probabilities.
- State tests cover reloads, malformed saves, completed-season locking, and recording each season exactly once.
- Browser checks complete a full Spin & Pick run and a Free Draft run, inspect the resulting season, and exercise mobile layout and keyboard controls.
- Check production build and TypeScript, start the dev server, and make a representative local request.
- Save tested installation and service-start instructions to the cloud environment configuration. Use the existing isolated checkout; do not create a worktree unless requested.

## Delivery

The deliverable is a locally runnable first version in `/workspace/pokemon-basketball`, including project scripts, dependency lockfile, documented data sources, automated gameplay checks, and a short README. The initial review is of this design; a tested implementation follows the spec and implementation-plan review stages. No public deployment or fresh-task restoration is claimed without verification.
