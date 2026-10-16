# Pokémon data sources

Retrieved 2026-10-15 from the public [PokeAPI dataset](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv).

The catalog contains the 251 Generation I and II species, using current PokeAPI base stats and types. It contains 240 species that are neither legendary nor mythical and 11 that are flagged as legendary or mythical. The first 151 committed records remain unchanged so that older saved seasons keep their original simulation inputs. The Generation II import's exact source response SHA-256 hashes and retrieval time are recorded in `src/data/source-manifest.json`.

- [pokemon.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv)
- [pokemon_stats.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_stats.csv)
- [pokemon_types.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_types.csv)
- [types.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/types.csv)
- [pokemon_species.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv)
- [pokemon_species_names.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv) (English names for IDs 152–251, including Ho-Oh)

Names, base stats, types, height, weight and species classification are factual source data. Basketball ratings and simulation rules are original to this project.

Portraits: [PokeAPI sprites](https://github.com/PokeAPI/sprites), official-artwork collection. Pokémon and character artwork belong to their respective owners. This is an unofficial fan project, not affiliated with Nintendo, Game Freak, or The Pokémon Company.

Refresh Generation II facts with `npm run data:import`; the importer preserves all Generation I records and does not overwrite this attribution document. Gameplay uses the committed JSON and requires no live API.

Artwork for all 251 species is bundled in `public/pokemon` to avoid third-party requests during play. Source URLs and SHA-256 digests are in `public/pokemon/manifest.json`. Complete missing downloads with `python3 scripts/download-artwork.py`; verified existing files are retained.

Pixel sprites for all 251 species are PokeAPI's [Generation V Black/White sprites](https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/versions/generation-v/black-white), retrieved 2026-10-15. They are bundled in `public/pokemon-pixel`; each source URL and SHA-256 digest is recorded in `public/pokemon-pixel/manifest.json`. Complete missing downloads with `python3 scripts/download-pixels.py`; verified existing files are retained.

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
