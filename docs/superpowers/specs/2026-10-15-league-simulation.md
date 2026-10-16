# Pokémon basketball league simulation

User outcome: all thirty teams have eight Pokémon, all games generate individual stats, awards compare the entire league, and scouting/coaching decisions produce richer basketball. User chose Gen2 expansion and league-wide unique species: 251 species, 240 rostered players, no repeats anywhere. Five starters plus three reserves remains fixed. Excluding legendary/mythical species leaves exactly240 eligible species.

Implement a seeded round-robin league with82games/team,41home/41away,1,230unique games. AI rosters use a seeded snake draft with position and coaching fit. User roster is reserved first; other teams never reuse those species. Standings and player totals aggregate both sides of the same games. Use team-qualified IDs to keep statistics explicit.

The new shared match engine treats both teams identically: five actual players per side, minute-based substitution decisions, stamina recovery/fatigue, role matchups, screening/pick-and-roll, isolation/post/spot-up/transition choices, shot zones, fouls/and-ones/bonus, rebounds after field goals and final free throws, defensive man/switch/zone/press schemes, closing lineups and overtime. Track personal fouls, plus/minus, shot-zone production, period scores and lead changes. Keep event arithmetic coherent. Use a documented depleted-roster exception if fewer than five non-disqualified players remain. No injuries/career simulation in this pass.

All league results drive standings, sortable leaders, team roster/stat browsing, player comparison, and both-team box scores. MVP/DPOY/Sixth Player and scoring/assist/rebound leaders are league-wide, with qualification rules, runner-ups and All-League/All-Defense selections. Avoid fabricated Rookie/MIP awards without history. Existing v2 team honors remain attached to archived v2 results; do not relabel them league awards.

Season model3 and savekeyv3 preserve v1/v2 results using frozen validators/simulators. Save league summaries/aggregates and user's detailed games; replay other game boxes deterministically from stored match seeds so saves stay under localStorage quota. Yield between round batches during live simulation, show progress, prevent edits and duplicate submissions while running. Completed-season reload validates deterministic output.

Keep existing visual direction, responsive scrollable stat tables, keyboard dialogs, local assets/fonts, no accounts/secrets. Update playbook, source provenance, handoff, tests and screenshot evidence. Commit and push main for cloud continuation.
