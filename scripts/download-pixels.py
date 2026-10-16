"""Complete local pixel sprites; use the default Gen V-style collection for later species."""
import hashlib
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

root = Path(__file__).resolve().parents[1]
folder = root / 'public/pokemon-pixel'
folder.mkdir(parents=True, exist_ok=True)
mons = json.loads((root / 'src/data/pokemon.json').read_text())
manifest_path = folder / 'manifest.json'
existing = {row['id']: row for row in json.loads(manifest_path.read_text())} if manifest_path.exists() else {}


def download(mon):
    number = mon['id']
    source = (f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/{number}.png'
              if number <= 649 else f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{number}.png')
    path = folder / f'{number}.png'
    if path.exists() and number in existing:
        data = path.read_bytes()
        assert hashlib.sha256(data).hexdigest() == existing[number]['sha256'], f'Pixel hash mismatch: {number}'
        source = existing[number]['source']
    else:
        data = subprocess.run(
            ['curl', '-fsSL', '--retry', '2', '--max-time', '60', source],
            check=True, capture_output=True,
        ).stdout
    assert data.startswith(b'\x89PNG\r\n\x1a\n'), f'Invalid PNG: {number}'
    if not path.exists() or number not in existing:
        path.write_bytes(data)
    return {'id': number, 'source': source, 'sha256': hashlib.sha256(data).hexdigest()}


manifest = list(ThreadPoolExecutor(max_workers=8).map(download, mons))
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Bundled {len(manifest)} pixel sprites; retained verified local files.')
