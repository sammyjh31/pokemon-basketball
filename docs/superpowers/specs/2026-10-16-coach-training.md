# Automatic trainer-led development

Coaches select individual training for every player on their team, including CPU clubs and local friend leagues. The player chooses the coach and roster; no routine training edits are necessary. Existing uncoached saves retain manual training.

A deterministic policy scores the existing training focuses from developed attributes, basketball role, useful strengths, repairable weaknesses, coaching philosophy and roster shortages. Adaptable coaches place more weight on team needs; conservative coaches favor steady training, while risk-taking coaches permit aggressive training. Heavy workloads and low stamina moderate intensity. No extra random draws or match-engine changes are introduced.

Plans feed the existing bounded development system at offseason entry. The completed season's coach oversees that camp, before offseason staff changes. Incoming coaches set the next camp's preview. Roster moves and development update previews automatically. Focus has the existing practice-budget tradeoff; intensity changes volatility, never guarantees growth.

Archive the actual coach, focus, intensity and reasons with each development result. Completed camps are immutable and processing remains idempotent. Optional metadata is validated and preserved on reload; legacy reports without it remain valid. No historical simulation inputs are changed.

Show read-only plans and clear reasons in solo Training and local friend team review. Show archived assignments in development reports and update coaching responsibility copy. Cover policy sensitivity, actual development integration, CPU parity, save round trips, legacy fallback and timing. Keep the running user game and its saves intact. Commit and push to GitHub main after verification.
