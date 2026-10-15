"""Bundle the attributed PokeAPI artwork using verified HTTPS downloads."""
import hashlib
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
root=Path(__file__).resolve().parents[1]
folder=root/'public/pokemon';folder.mkdir(parents=True,exist_ok=True)
mons=json.loads((root/'src/data/pokemon.json').read_text())
def download(mon):
    path=folder/f"{mon['id']}.png"
    data=subprocess.run(['curl','-fsSL','--retry','2','--max-time','60',mon['spriteUrl']],check=True,capture_output=True).stdout
    if not data.startswith(b'\x89PNG\r\n\x1a\n'): raise ValueError(f"Invalid PNG for {mon['name']}")
    path.write_bytes(data)
    return str(mon['id']),{'source':mon['spriteUrl'],'sha256':hashlib.sha256(data).hexdigest()}
manifest=dict(ThreadPoolExecutor(max_workers=8).map(download,mons))
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Bundled {len(manifest)} verified-HTTPS Pokémon portraits.')
