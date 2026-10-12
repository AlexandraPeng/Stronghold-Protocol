"""Fetch PRTS avatars and client portrait cards; never use full illustration art as portrait."""
import concurrent.futures
import json
import hashlib
import struct
import pathlib
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
IDS = ['char_4217_makoto', 'char_4182_oblvns', 'char_4231_clemnt']
units = json.loads((ROOT / 'data/backups.json').read_text(encoding='utf-8'))['units']

def fetch(char_id):
    name = units[char_id]['name']
    requests = [('avatar', '', f'头像_{name}.png'), ('avatar', '_2', f'头像_{name}_2.png')]
    query = urllib.parse.urlencode(dict(action='query', titles='|'.join('文件:' + x[2] for x in requests),
                                       prop='imageinfo', iiprop='url', format='json'))
    with urllib.request.urlopen('https://prts.wiki/api.php?' + query, timeout=30) as response:
        pages = json.load(response)['query']['pages'].values()
    for kind, suffix, title in requests:
        entry = next(p for p in pages if p['title'] == '文件:' + title.replace('_', ' '))
        url = entry['imageinfo'][0]['url']
        target = ROOT / 'public/assets/char' / kind / f'{char_id}{suffix}.png'
        if target.exists() and target.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'):
            continue
        with urllib.request.urlopen(url, timeout=30) as response:
            data = response.read()
        if not data.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError(f'Not a PNG: {title}')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    # Same 180 x 360 client card source used by the other selectable operators.
    for suffix in ['_1', '_2']:
        target = ROOT / 'public/assets/char/portrait' / f'{char_id}{suffix}.png'
        old = target.read_bytes() if target.exists() else b''
        if old.startswith(b'\x89PNG\r\n\x1a\n') and len(old) >= 24 and struct.unpack('>II', old[16:24]) == (180, 360):
            continue
        url = f'https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/portrait/{char_id}{suffix}.png'
        with urllib.request.urlopen(url, timeout=30) as response:
            data = response.read()
        if not data.startswith(b'\x89PNG\r\n\x1a\n') or len(data) < 24 or struct.unpack('>II', data[16:24]) != (180, 360):
            raise ValueError(f'Not a 180x360 portrait: {url}')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return char_id

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for char_id in pool.map(fetch, IDS):
            print(f'{char_id}: four PNG images verified')

    # Revisioned URLs invalidate stale full-illustration images in browser caches.
    manifest_path = ROOT / 'data/assets.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    for char_id in IDS:
        for key, suffix in [('portrait', '_1'), ('portraitE2', '_2')]:
            file = ROOT / 'public/assets/char/portrait' / f'{char_id}{suffix}.png'
            rev = hashlib.sha256(file.read_bytes()).hexdigest()[:12]
            manifest['chars'][char_id][key] = f'/assets/char/portrait/{char_id}{suffix}.png?rev={rev}'
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
