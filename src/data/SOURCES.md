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
