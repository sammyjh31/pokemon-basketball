# Pokémon data sources

Retrieved 2026-10-15 from the public [PokeAPI dataset](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv).

- [pokemon.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv)
- [pokemon_stats.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_stats.csv)
- [pokemon_types.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_types.csv)
- [types.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/types.csv)
- [pokemon_species.csv](https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv)

Names, base stats, types, height, weight and species classification are factual source data. Basketball ratings and simulation rules are original to this project.

Portraits: [PokeAPI sprites](https://github.com/PokeAPI/sprites), official-artwork collection. Pokémon and character artwork belong to their respective owners. This is an unofficial fan project, not affiliated with Nintendo, Game Freak, or The Pokémon Company.

Regenerate with `npm run data:import`; gameplay uses the committed JSON and requires no live API.

Artwork is bundled in `public/pokemon` to avoid third-party requests during play. Source URLs and SHA-256 digests are in `public/pokemon/manifest.json`. Refresh it with `python scripts/download-artwork.py`.
