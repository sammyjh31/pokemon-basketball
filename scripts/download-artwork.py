"""Complete the local PokeAPI artwork collection using verified HTTPS downloads."""
import hashlib
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

root = Path(__file__).resolve().parents[1]
folder = root / 'public/pokemon'
folder.mkdir(parents=True, exist_ok=True)
mons = json.loads((root / 'src/data/pokemon.json').read_text())
manifest_path = folder / 'manifest.json'
existing = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}


def download(mon):
    number = str(mon['id'])
    path = folder / f'{number}.png'
    source = mon['spriteUrl']
    if path.exists() and number in existing:
        data = path.read_bytes()
        assert hashlib.sha256(data).hexdigest() == existing[number]['sha256'], f'Artwork hash mismatch: {number}'
        source = existing[number]['source']
    else:
        data = subprocess.run(
            ['curl', '-fsSL', '--retry', '2', '--max-time', '60', source],
            check=True, capture_output=True,
        ).stdout
    if not data.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError(f"Invalid PNG for {mon['name']}")
    if not path.exists() or number not in existing:
        path.write_bytes(data)
    return number, {'source': source, 'sha256': hashlib.sha256(data).hexdigest()}


manifest = dict(ThreadPoolExecutor(max_workers=8).map(download, mons))
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Bundled {len(manifest)} verified-HTTPS Pokémon portraits; retained verified local files.')
