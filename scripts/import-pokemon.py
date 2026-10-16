"""Append PokeAPI species through Generation VII without changing existing replay inputs.

HTTPS certificate verification remains enabled. The committed source-manifest.json
records the exact response hashes; this script leaves the human-written SOURCES.md alone.
"""
import csv
import hashlib
import io
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
FILES = ['pokemon.csv', 'pokemon_stats.csv', 'pokemon_types.csv', 'types.csv',
         'pokemon_species.csv', 'pokemon_species_names.csv']
ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'src/data/pokemon.json'


def read(name):
    raw = subprocess.run(
        ['curl', '-fsSL', '--retry', '2', '--max-time', '60', BASE + name],
        check=True, capture_output=True,
    ).stdout
    return name, list(csv.DictReader(io.StringIO(raw.decode()))), {
        'source': BASE + name, 'sha256': hashlib.sha256(raw).hexdigest(),
    }


existing = json.loads(TARGET.read_text())
# Every committed fact is a replay contract. Refreshes only append missing species.
mons = list(existing)
preserved_count = len(mons)
assert 251 <= preserved_count <= 809
assert [mon['id'] for mon in mons] == list(range(1, preserved_count + 1))
responses = list(ThreadPoolExecutor(max_workers=6).map(read, FILES))
tables = {name: rows for name, rows, _ in responses}
stats = {}
types = {}
type_names = {int(row['id']): row['identifier'] for row in tables['types.csv']}
for row in tables['pokemon_stats.csv']:
    stats.setdefault(int(row['pokemon_id']), {})[int(row['stat_id'])] = int(row['base_stat'])
for row in tables['pokemon_types.csv']:
    types.setdefault(int(row['pokemon_id']), []).append((int(row['slot']), type_names[int(row['type_id'])]))
species = {int(row['id']): row for row in tables['pokemon_species.csv']}
names = {int(row['pokemon_species_id']): row['name']
         for row in tables['pokemon_species_names.csv'] if row['local_language_id'] == '9'}
keys = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed']
for row in tables['pokemon.csv']:
    number = int(row['id'])
    if not preserved_count < number <= 809:
        continue
    assert int(species[number]['generation_id']) <= 7
    mons.append(dict(
        id=number, name=names[number], types=[name for _, name in sorted(types[number])],
        stats={key: stats[number][index + 1] for index, key in enumerate(keys)},
        heightM=int(row['height']) / 10, weightKg=int(row['weight']) / 10,
        legendary=bool(int(species[number]['is_legendary']) or int(species[number]['is_mythical'])),
        spriteUrl=f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{number}.png',
    ))
mons.sort(key=lambda mon: mon['id'])
assert [mon['id'] for mon in mons] == list(range(1, 810))
assert mons[:preserved_count] == existing, 'Saved-season replay facts changed'
TARGET.write_text(json.dumps(mons, ensure_ascii=False, indent=2) + '\n')
if preserved_count < 809:
 (ROOT / 'src/data/source-manifest.json').write_text(json.dumps({
    'retrieved': datetime.now(timezone.utc).isoformat(),
    'importedIds': [preserved_count + 1, 809],
    'preservedIds': [1, preserved_count],
    'files': {name: source for name, _, source in responses},
}, indent=2) + '\n')
print(f'Catalog: {len(mons)} Pokémon; preserved {preserved_count} existing records; {sum(not m["legendary"] for m in mons)} nonlegendary/nonmythical.')
