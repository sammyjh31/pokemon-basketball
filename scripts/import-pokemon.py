"""Import official public PokeAPI facts. HTTPS verification remains enabled."""
import csv
import io
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
FILES = ['pokemon.csv', 'pokemon_stats.csv', 'pokemon_types.csv', 'types.csv', 'pokemon_species.csv']
def read(name):
    result = subprocess.run(['curl', '-fsSL', '--retry', '2', '--max-time', '60', BASE + name], check=True, capture_output=True, text=True)
    return name, list(csv.DictReader(io.StringIO(result.stdout)))
tables = dict(ThreadPoolExecutor(max_workers=5).map(read, FILES))
stats = {}; types = {}
type_names = {int(r['id']): r['identifier'] for r in tables['types.csv']}
for row in tables['pokemon_stats.csv']:
    stats.setdefault(int(row['pokemon_id']), {})[int(row['stat_id'])] = int(row['base_stat'])
for row in tables['pokemon_types.csv']:
    types.setdefault(int(row['pokemon_id']), []).append((int(row['slot']), type_names[int(row['type_id'])]))
species = {int(r['id']): r for r in tables['pokemon_species.csv']}
names = {29:'Nidoran ♀', 32:'Nidoran ♂', 83:"Farfetch’d", 122:'Mr. Mime'}
keys = ['hp','attack','defense','specialAttack','specialDefense','speed']
mons=[]
for row in tables['pokemon.csv']:
    n=int(row['id'])
    if n > 151: continue
    mons.append(dict(id=n, name=names.get(n, row['identifier'].capitalize()), types=[t for _,t in sorted(types[n])],
        stats={key:stats[n][i+1] for i,key in enumerate(keys)}, heightM=int(row['height'])/10, weightKg=int(row['weight'])/10,
        legendary=bool(int(species[n]['is_legendary']) or int(species[n]['is_mythical'])),
        spriteUrl=f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{n}.png'))
mons.sort(key=lambda p:p['id'])
assert len(mons)==151
root=Path(__file__).resolve().parents[1]
(root/'src/data/pokemon.json').write_text(json.dumps(mons,ensure_ascii=False,indent=2)+'\n')
(root/'src/data/SOURCES.md').write_text('# Pokémon data sources\n\nRetrieved '+datetime.now(timezone.utc).strftime('%Y-%m-%d')+' from the public [PokeAPI dataset](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv).\n\n'+''.join(f'- [{name}]({BASE}{name})\n' for name in FILES)+'\nNames, base stats, types, height, weight and species classification are factual source data. Basketball ratings and simulation rules are original to this project.\n\nPortraits: [PokeAPI sprites](https://github.com/PokeAPI/sprites), official-artwork collection. Pokémon and character artwork belong to their respective owners. This is an unofficial fan project, not affiliated with Nintendo, Game Freak, or The Pokémon Company.\n\nRegenerate with `npm run data:import`; gameplay uses the committed JSON and requires no live API.\n')
print('Imported',len(mons),'Pokémon')
