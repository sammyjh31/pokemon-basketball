"""Import official PokeAPI Gen III–IX facts and optionally bundle their artwork.

Uses pinned upstream commits and verified HTTPS; never rewrites Gen I–II inputs.
Run python3 scripts/import-rookies.py [--assets].
"""
import argparse
import csv
import hashlib
import io
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FACTS_COMMIT = '81d20919845b6a445969b9265aab5cec6b04cece'
SPRITES_COMMIT = 'ba403973fdf9d0ac59175813861e6a1f8ed5020c'
BASE = f'https://raw.githubusercontent.com/PokeAPI/pokeapi/{FACTS_COMMIT}/data/v2/csv/'
SPRITES = f'https://raw.githubusercontent.com/PokeAPI/sprites/{SPRITES_COMMIT}/sprites/pokemon/'
FILES = ['pokemon.csv', 'pokemon_stats.csv', 'pokemon_types.csv', 'types.csv',
         'pokemon_species.csv', 'pokemon_species_names.csv', 'generations.csv']


def fetch(url):
    return subprocess.run(['curl', '-fsSL', '--retry', '2', '--max-time', '60', url],
                          check=True, capture_output=True).stdout


def read(name):
    raw = fetch(BASE + name)
    return name, list(csv.DictReader(io.StringIO(raw.decode()))), {
        'source': BASE + name, 'sha256': hashlib.sha256(raw).hexdigest(),
    }


def import_facts():
    responses = list(ThreadPoolExecutor(max_workers=7).map(read, FILES))
    tables = {name: rows for name, rows, _ in responses}
    stats, types = {}, {}
    type_names = {int(row['id']): row['identifier'] for row in tables['types.csv']}
    for row in tables['pokemon_stats.csv']:
        stats.setdefault(int(row['pokemon_id']), {})[int(row['stat_id'])] = int(row['base_stat'])
    for row in tables['pokemon_types.csv']:
        types.setdefault(int(row['pokemon_id']), []).append((int(row['slot']), type_names[int(row['type_id'])]))
    species = {int(row['id']): row for row in tables['pokemon_species.csv']}
    names = {int(row['pokemon_species_id']): row['name']
             for row in tables['pokemon_species_names.csv'] if row['local_language_id'] == '9'}
    keys = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed']
    mons = []
    for row in tables['pokemon.csv']:
        number, species_id = int(row['id']), int(row['species_id'])
        source = species[species_id]
        if source['generation_id'] not in ['3', '4', '5', '6', '7', '8', '9'] or row['is_default'] != '1':
            continue
        assert number == species_id, 'Review new default-form ID mapping before import'
        mons.append(dict(
            id=number, generation=int(source['generation_id']), name=names[number],
            types=[name for _, name in sorted(types[number])],
            stats={key: stats[number][index + 1] for index, key in enumerate(keys)},
            heightM=int(row['height']) / 10, weightKg=int(row['weight']) / 10,
            legendary=bool(int(source['is_legendary']) or int(source['is_mythical'])),
            spriteUrl=f'{SPRITES}other/official-artwork/{number}.png',
        ))
    mons.sort(key=lambda mon: mon['id'])
    assert [mon['id'] for mon in mons] == list(range(252, 1026))
    (ROOT / 'src/data/rookie-pokemon.json').write_text(json.dumps(mons, ensure_ascii=False, indent=2) + '\n')
    (ROOT / 'src/data/rookie-source-manifest.json').write_text(json.dumps({
        'retrieved': datetime.now(timezone.utc).isoformat(),
        'factsCommit': FACTS_COMMIT, 'spritesCommit': SPRITES_COMMIT,
        'importedIds': [252, 1025], 'preservedIds': [1, 251],
        'generations': {str(g): [min(m['id'] for m in mons if m['generation'] == g),
                               max(m['id'] for m in mons if m['generation'] == g)] for g in range(3, 10)},
        'files': {name: source for name, _, source in responses},
    }, indent=2) + '\n')
    return mons


def import_assets(mons):
    for folder, suffix in [('pokemon', 'other/official-artwork/'), ('pokemon-pixel', '')]:
        target = ROOT / 'public' / folder
        target.mkdir(parents=True, exist_ok=True)
        manifest_path = target / 'rookie-manifest.json'
        previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

        def download(mon):
            number = str(mon['id'])
            pixel_style = 'versions/generation-v/black-white/' if folder == 'pokemon-pixel' and mon['id'] <= 649 else suffix
            source = f'{SPRITES}{pixel_style}{number}.png'
            path = target / f'{number}.png'
            if number in previous and previous[number]['source'] == source and path.exists():
                raw = path.read_bytes()
                assert hashlib.sha256(raw).hexdigest() == previous[number]['sha256']
                return number, previous[number]
            raw = fetch(source)
            assert raw.startswith(b'\x89PNG\r\n\x1a\n'), f'Invalid PNG: {source}'
            path.write_bytes(raw)
            return number, {'source': source, 'sha256': hashlib.sha256(raw).hexdigest()}

        manifest = dict(ThreadPoolExecutor(max_workers=12).map(download, mons))
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
        print(f'Bundled {len(manifest)} {folder} rookie images.', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--assets', action='store_true')
    args = parser.parse_args()
    roster = import_facts()
    print(f'Imported {len(roster)} rookies; Gen I–II untouched.', flush=True)
    if args.assets:
        import_assets(roster)
