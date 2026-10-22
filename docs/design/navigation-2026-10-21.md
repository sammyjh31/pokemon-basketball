# Focused game views

Replace scroll-only section navigation with one visible task at a time. Reuse current components, retro theme and game state. Solo: Draft (trainer selection and picks), Team (court, bench, coaching and scouting), Season (schedule, simulation and results), Playoffs (postseason only), Franchise (management when active), and the existing arcade entry from its header link. Local league uses the same main views, with career/offseason work in Franchise.

Keep view subtrees mounted while hidden so filters, pending picks, reports and background jobs survive switching. Hide inactive content from sight, focus and accessibility queries. Navigation lives outside validated saves. Preserve existing solo hashes and use #local-league/<view> for local views. Native in-app links, direct links and browser Back/Forward use the same navigator. Invalid/unavailable views fall back to the current playable phase. New runs / career phases choose an appropriate initial view. Shared links keep query strings. Save/restart/help/notices remain reachable in the shell. Existing draft, simulation and import guards remain unchanged.

Show a compact title and short purpose for the active view. Keep roster progress / next-step links in Draft and Team; completed season links to Playoffs. A pending pick may follow between Draft and Team, but must not cover Season or Playoffs. Solo roster image export first opens Team so it captures visible content. Local draft handoffs still focus the next manager's heading. Arcade play remains its existing dedicated experience.

No deployment until separately requested.
