# Verified franchise loading

The user wants long careers to reopen without replaying their entire history, with identical results, complete retained history, and continued GitHub updates. Extend the existing browser save/worker paths; do not change simulation rules, source save formats, or history retention.

## Approach

Use an optional, browser-local verification cache in a separate IndexedDB database. Whole-save-only caching would miss whenever the user progresses; storing every reconstructed season would duplicate large histories. Instead retain small verification certificates for solo archives, compact replay evidence for local archives, and at most two active-season snapshots per format.

Cache keys include the namespace, exact serialized inputs, and an automatic engine/data/validator source fingerprint. Authenticate each cached payload with a browser-generated, non-extractable HMAC key stored in that database. Source save files never contain certificates or keys. Imported saves receive normal verification unless the exact data has already been verified on this browser. Clearing storage removes the optimization, not history from an exported/source save.

## Loading and publishing

- Solo: cheaply parse the original source as today. Authenticate certificates against each complete raw archived-year object and includeLegends. Replay only uncertified archives; use existing latest-year reuse. Reuse an authenticated active replay snapshot only for the exact raw run. Continue all structural, career, ownership, coach, transaction, mastery, morale, and chemistry chronology validation. Certified archive content may skip only its already-completed game replay comparisons.
- Publish certificates and active replay material only after the entire load succeeds without a notice or preserveSource. Failed validation never certifies its partial work. Check cancellation before publishing and before returning; valid cache-only writes already underway do not change source saves or UI state.
- Retain certificates/snapshots for both original and successfully normalized save serialization when they differ, so the next normal autosave remains warm. Cached archive player rows preserve the exact authenticated engine order; cheap structural parsing still checks their values.
- Local: key each year by its complete raw archive and game format. Reuse only the compact evidence consumed by the existing archive replay block (postgame team banks and playoff seeds; news facts and players remain in the authenticated source). Keep roster baselines, coach chronology, development, training, rookie picks and recorded trades on their existing validation path. Publish evidence only after the full parser succeeds. Cache current local-season worker output under its exact game inputs, captured before any asynchronous lookup; keep playoff and historical box reconstruction unchanged.
- Existing/imported data incurs one cold verification. Subsequent opens skip games for certified years. Changed active games require only the current prefix; a new completed year requires only that year. Key order/whitespace normalization may produce conservative misses, never false matches.

## Cache lifecycle and limits

The cache is disposable, cannot be the authoritative save, and never writes the save/backup/quarantine slots. Missing, corrupt, invalid-signature, wrong-revision, unavailable/blocked storage, and quota errors are cache misses. Existing replay, cancellation and recovery behavior remains available. No UI-thread historical fallback is added for local careers.

Use one private HMAC key with atomic create-if-absent handling across tabs/workers. Sign namespace, engine revision, input digest and payload together. Bound individual payloads at 8 MiB, total approximate payload/record storage at 32 MiB, and active snapshot counts at two per format. Evict older large cache records before small historical certificates using metadata indexes. Eviction never deletes source history. Build/dev revision generation hashes production game/data sources and relevant build dependencies, excludes tests, and invalidates after relevant hot updates.

Warm progress reports games actually replayed (zero when fully cached); display opening/verification wording instead of a 0/0 games counter. Normal game simulation and historical boxes retain all existing seeds and engine flags.

## Verification

Use real WebCrypto and a durable in-memory record adapter for unit tests, plus real IndexedDB/worker reloads in browser checks. Cover store reopening, cross-instance reuse, forged payload/signature/input, wrong revision, cache failures/eviction, cancellation and exact cold/warm output equality. Prove older years remain reusable after changing offseason state and advancing the active year, while modified archive data is reverified and rejected if inconsistent. Exercise multi-year local chronology. Benchmark the unchanged generated two-year save cold and warm and compare complete output hashes. Run build, full regressions, desktop/mobile browser checks, and an independent final review before merging.

No external accounts, services, keys, dependencies, save migration, automatic history deletion, or changes to gameplay are required.
