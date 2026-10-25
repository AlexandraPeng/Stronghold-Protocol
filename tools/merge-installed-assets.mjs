// Preserve installed fork skins, portraits and voice files when upgrading the upstream manifest.
// Run once against a previous checkout; never copies binary artwork into Git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const previous = process.argv[2];
if (!previous) throw new Error('Usage: node tools/merge-installed-assets.mjs <previous data/assets.json>');
const source = JSON.parse(fs.readFileSync(previous, 'utf8'));
const target = JSON.parse(fs.readFileSync(path.join(root, 'data/assets.json'), 'utf8'));
function merge(a, b) {
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) { if (!a[k] || typeof a[k] !== 'object') a[k] = {}; merge(a[k], v); }
    else if (!(k in a)) a[k] = v;
  }
}
const oldAudio = source.audio;
delete source.audio;
merge(target, source);
// Older bundles mix flat file indexes and language banks under audio.voice. The 0.2.6
// player accepts a charId -> named-line map, with Japanese in audio.voiceJp.
const validBank = bank => Object.fromEntries(Object.entries(bank || {}).filter(([k, v]) => /^char_\d+_[a-z0-9]+$/.test(k) && v && typeof v === 'object' && !Array.isArray(v)));
target.audio.voice = validBank(target.audio.voice);
target.audio.voiceJp = validBank(target.audio.voiceJp);
for (const id of ['char_4217_makoto', 'char_4182_oblvns', 'char_4231_clemnt']) {
  const cn = oldAudio?.voice?.cn?.[id], jp = oldAudio?.voice?.jp?.[id];
  if (cn) target.audio.voice[id] = cn;
  if (jp) target.audio.voiceJp[id] = jp;
}
target.stats.voiceChars = Object.keys(target.audio.voice).length;
// The custom operators use the corrected headshot/portrait assets of the maintained fork.
for (const id of ['char_4217_makoto', 'char_4182_oblvns', 'char_4231_clemnt']) {
  if (source.chars?.[id]) target.chars[id] = { ...target.chars[id], ...source.chars[id] };
}
target.stats.chars = Object.keys(target.chars || {}).length;
target.stats.skills = Object.keys(target.skills || {}).length;
fs.writeFileSync(path.join(root, 'data/assets.json'), JSON.stringify(target) + '\n');
console.log('Merged installed manifest entries.');
