# Pokémon data sources

Retrieved 2026-10-15 (Generations I–II) and 2026-10-16 (Generations III–VII) from the public [PokeAPI dataset](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv).

The full catalog contains 809 Generation I–VII species: 739 are neither legendary nor mythical, and 70 have one of those flags in PokeAPI. New local leagues use this pool. Solo modes and existing local leagues retain the original 251-species pool. All first 251 factual records remain exactly unchanged, preserving saved-season simulation inputs. The expansion's exact source response SHA-256 hashes and retrieval time are recorded in `src/data/source-manifest.json`. Only base species are included; alternate and regional forms are not separate draft picks.

- [pokemon.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv)
- [pokemon_stats.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_stats.csv)
- [pokemon_types.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_types.csv)
- [types.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/types.csv)
- [pokemon_species.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv)
- [pokemon_species_names.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv) (English names for added species)

Names, base stats, types, height, weight and species classification are factual source data. Basketball ratings and simulation rules are original to this project.

Portraits: [PokeAPI sprites](https://github.com/PokeAPI/sprites), official-artwork collection. Pokémon and character artwork belong to their respective owners. This is an unofficial fan project, not affiliated with Nintendo, Game Freak, or The Pokémon Company.

Append missing facts through Generation VII with `npm run data:import`; the importer preserves every existing record and does not overwrite this attribution document. Re-running it with the full catalog leaves source provenance unchanged. Gameplay uses committed JSON and requires no live API.

Artwork for all 809 species is bundled in `public/pokemon` to avoid third-party requests during play. Source URLs and SHA-256 digests are in `public/pokemon/manifest.json`. Complete missing downloads with `python3 scripts/download-artwork.py`; verified existing files are retained.

Pixel sprites for IDs 1–649 use PokeAPI's [Generation V Black/White collection](https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/versions/generation-v/black-white). Later species use its [default Gen V-style collection](https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon), including community contributions credited by that repository. All 809 are bundled in `public/pokemon-pixel`; source URLs and hashes are recorded in its manifest. Complete missing downloads with `python3 scripts/download-pixels.py`; verified existing files are retained. Expansion assets were retrieved 2026-10-16.

Inter and Roboto Condensed are bundled through the `@fontsource/inter` and `@fontsource/roboto-condensed` npm packages under the SIL Open Font License. Their license texts are retained in those installed packages. The UI uses the Latin 400/500/600 Inter and 700/800 Roboto Condensed subsets.

The [Pokémon All-22](https://all22pokemon.com/) reference was inspected on 2026-10-15 for layout, typography, pixel-sprite presentation, and builder interactions. Basketball court geometry, components, and styles are maintained in this repository; no reference-site source code was imported.
# Rookie franchise catalog

The original `pokemon.json`, source manifest, artwork and pixel manifests remain
unchanged. Rookie drafts use `rookie-pokemon.json`, imported separately from the
official [PokeAPI CSV database](https://github.com/PokeAPI/pokeapi/tree/81d20919845b6a445969b9265aab5cec6b04cece/data/v2/csv)
at commit `81d20919845b6a445969b9265aab5cec6b04cece`.
`rookie-source-manifest.json` records each input's SHA-256 digest and the import time.
Generation assignments come from `pokemon_species.csv`; `generations.csv` lists
Generation IX as the latest generation in this pinned snapshot. The bundled ranges
are III 252–386, IV 387–493, V 494–649, VI 650–721, VII 722–809, VIII 810–905,
and IX 906–1025. Legendary and mythical flags both use the existing legendary toggle.

Each species uses its default form's six base stats, metric height and weight,
ordered types and English species name. These are factual inputs to this project's
fictional basketball ratings. `POKEMON` remains the initial 251-player catalog;
`FRANCHISE_POKEMON` and `POKEMON_BY_ID` additionally expose franchise rookies.

Rookie portraits and pixels are bundled under the existing `/pokemon/{id}.png`
and `/pokemon-pixel/{id}.png` paths. Their separate `rookie-manifest.json` files
record the source URL and SHA-256 for every image, pinned to the official
[PokeAPI sprites repository](https://github.com/PokeAPI/sprites/tree/ba403973fdf9d0ac59175813861e6a1f8ed5020c)
at commit `ba403973fdf9d0ac59175813861e6a1f8ed5020c`. Generations III–V use the Generation V pixel collection; later generations use
the repository's default sprite collection because the Generation V game did not
contain those species. No runtime network request is needed to load these images.

Reproduce the separate import with `python3 scripts/import-rookies.py --assets`.
Verified HTTPS stays enabled, existing rookie images are checked against their
manifest, and the script never writes the original 251 facts or asset manifests.

# Species ability catalog

`species-abilities.json` contains the first non-hidden normal ability for each
species 1–1025, independently of frozen ratings data. The source is PokéAPI's
[pinned CSV database](https://github.com/PokeAPI/pokeapi/tree/5ee47a9a9c1229632ec4b473a9c1c53026e005dd/data/v2/csv)
(`pokemon_abilities.csv`, `abilities.csv`, and English `ability_names.csv`).
`ability-source-manifest.json` records the revision, selection rule and response
SHA-256 hashes. Reproduce it with `python3 scripts/import-abilities.py`.

Canonical ability names and species assignments are source facts. Their 21
conditional basketball adaptations, training affinities and tactical roles in
`src/game/abilities.ts` are original game rules, not canonical Pokémon battle
mechanics. Alternate abilities, hidden abilities and alternate forms are not
randomly selected. Version 1 uses this fixed catalog without runtime networking.
