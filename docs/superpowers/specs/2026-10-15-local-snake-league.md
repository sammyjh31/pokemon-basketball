# Local snake-draft league

Friends share one browser, each managing one of the existing 30 teams. Remaining teams draft automatically. All 30 teams participate in eight snake rounds: a seeded randomized order reverses every round. Every Pokémon can be selected only once league-wide. Legendary inclusion is selected before the draft.

Setup supports 2–30 named human managers with distinct teams. The draft shows the current manager, overall pick and round, available Pokémon, a selected player's scouting report, current roster and recent picks. CPU selections stop at the next human turn. Humans choose an empty roster position and confirm each selection. After the draft, managers can rearrange their eight players and set coaching before simulation.

Use the existing fixed-roster season simulator without changing its rules. Show a friends leaderboard ordered by wins, point differential and team ID, with overall league rank. Reuse the existing league center for all standings, team rosters, statistics, awards and game boxes. Multi-year franchise management and arcade are outside this local mode.

After the regular season, use the existing 16-team, four-round, best-of-seven playoffs. Friends can simulate a slate, finish a round or finish the tournament. Show qualification, elimination and championship status for every friend, including when team zero is CPU-controlled. Highlight friends' bracket entries and identify the winning manager or CPU team alongside the champion and Finals MVP. Keep regular-season results available. Saves created before this extension can enter playoffs without redrafting.

Store a compact, validated local draft in a separate localStorage key. Save picks, order, managers, coaching, regular-season completion and an optional playoff game count (0–105); results and the postseason prefix are reconstructed from the same seed. Only a completed regular season may have playoff progress. Save completed playoff actions atomically; interrupted actions resume from the previous completed prefix. Invalid saves remain untouched until the user explicitly starts a new local league. Failed writes show a notice. Returning to the original game preserves its existing franchise and challenge save. A replacement local league needs a discard confirmation.

No dependencies, network services, account setup or hosted deployment. Preserve ongoing changes in the checkout; implement primarily in new modules, with narrow navigation additions.
