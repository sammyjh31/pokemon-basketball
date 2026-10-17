"""Import canonical first-slot normal abilities independently of frozen ratings data."""
import csv
import hashlib
import io
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
REVISION = '5ee47a9a9c1229632ec4b473a9c1c53026e005dd'
BASE = f'https://raw.githubusercontent.com/PokeAPI/pokeapi/{REVISION}/data/v2/csv/'
sources = {}
def read(name):
    data = subprocess.check_output(['curl', '-fsSL', '--retry', '2', '--max-time', '60', BASE + name])
    sources[name] = {'url': BASE + name, 'sha256': hashlib.sha256(data).hexdigest()}
    return list(csv.DictReader(io.StringIO(data.decode())))

abilities = {r['id']: r['identifier'] for r in read('abilities.csv')}
names = {r['ability_id']: r['name'] for r in read('ability_names.csv') if r['local_language_id'] == '9'}
rows = {r['pokemon_id']: {'id': abilities[r['ability_id']], 'name': names[r['ability_id']]} for r in read('pokemon_abilities.csv') if 1 <= int(r['pokemon_id']) <= 1025 and r['slot'] == '1' and r['is_hidden'] == '0'}
assert len(rows) == 1025
(ROOT / 'src/data/species-abilities.json').write_text(json.dumps(rows, indent=2, ensure_ascii=False) + '\n')
(ROOT / 'src/data/ability-source-manifest.json').write_text(json.dumps({'revision': REVISION, 'selection': 'Default species form, non-hidden ability slot 1', 'sources': sources}, indent=2) + '\n')
