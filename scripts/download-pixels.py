"""Bundle Gen V pixel sprites from PokeAPI's public artwork repository."""
import hashlib
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

folder = Path(__file__).resolve().parents[1] / 'public' / 'pokemon-pixel'
folder.mkdir(parents=True, exist_ok=True)
def download(number):
    url = f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/{number}.png'
    path = folder / f'{number}.png'
    subprocess.run(['curl', '-fsSL', '--retry', '2', '--max-time', '60', url, '-o', str(path)], check=True)
    data = path.read_bytes()
    assert data.startswith(b'\x89PNG\r\n\x1a\n'), f'Invalid PNG: {number}'
    return {'id':number, 'source':url, 'sha256':hashlib.sha256(data).hexdigest()}
manifest = list(ThreadPoolExecutor(max_workers=8).map(download, range(1, 152)))
(folder / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Bundled {len(manifest)} pixel sprites')
