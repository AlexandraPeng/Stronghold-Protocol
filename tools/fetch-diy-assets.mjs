import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { atlasInfo, normalizeAtlas } from './assets/atlas.mjs';
import { parseSkel } from './assets/skel.mjs';
import { resolveRoles } from './assets/anim-roles.mjs';
import { pngSize } from './assets/formats.mjs';

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const SKILL_DIR = path.join(PUBLIC, 'assets', 'skill');
const SPINE_DIR = path.join(PUBLIC, 'assets', 'spine', 'op');

fs.mkdirSync(SKILL_DIR, { recursive: true });
fs.mkdirSync(SPINE_DIR, { recursive: true });

const backups = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'backups.json'), 'utf8'));
const assets = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'assets.json'), 'utf8'));
const requested = process.argv.slice(2);
const pool = (backups.diy?.ownedPool || []).filter(id => !requested.length || requested.includes(id));

function downloadBuffer(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const proto = url.startsWith('https:') ? https : http;
    const req = proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location, timeoutMs).then(resolve);
      }
      if (res.statusCode !== 200) {
        return resolve(null);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function downloadWithFallbacks(urls, targetPath) {
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
    return true;
  }
  for (const u of urls) {
    const buf = await downloadBuffer(u);
    if (buf && buf.length > 0) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, buf);
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 1. Download Skills
// ---------------------------------------------------------------------------
async function downloadSkills() {
  console.log('\n=== [1/3] Downloading Skill Icons ===');
  const allSkills = new Map();
  for (const charId of pool) {
    const unit = backups.units?.[charId];
    if (!unit || !unit.forms) continue;
    for (const formKey of Object.keys(unit.forms)) {
      const f = unit.forms[formKey];
      if (!f || !f.skills) continue;
      for (const s of f.skills) {
        const skillId = s.skillId;
        const iconId = s.iconId || s.prefabId || skillId;
        if (!allSkills.has(skillId)) {
          allSkills.set(skillId, { charId, skillId, iconId, name: s.name, index: s.index });
        }
      }
    }
  }

  const skillsList = Array.from(allSkills.values());
  let successCount = 0;
  let fallbackCount = 0;

  for (let i = 0; i < skillsList.length; i += 8) {
    const batch = skillsList.slice(i, i + 8);
    await Promise.all(batch.map(async (sk) => {
      const targetFile1 = path.join(SKILL_DIR, `${sk.iconId}.png`);
      const targetFile2 = path.join(SKILL_DIR, `${sk.skillId}.png`);

      const urls = [
        `https://raw.githubusercontent.com/fexli/ArknightsResource/main/skills/skill_icon_${encodeURIComponent(sk.iconId)}.png`,
        `https://raw.githubusercontent.com/fexli/ArknightsResource/main/skill/skill_icon_${encodeURIComponent(sk.iconId)}.png`,
        `https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/skill/skill_icon_${encodeURIComponent(sk.iconId)}.png`,
        `https://cdn.jsdelivr.net/gh/fexli/ArknightsResource@main/skill/${encodeURIComponent(sk.iconId)}.png`,
        `https://cdn.jsdelivr.net/gh/yuanyan3060/ArknightsGameResource@main/skill/${encodeURIComponent(sk.iconId)}.png`,
        `https://cdn.jsdelivr.net/gh/fexli/ArknightsResource@main/skill/${encodeURIComponent(sk.skillId)}.png`,
        `https://cdn.jsdelivr.net/gh/yuanyan3060/ArknightsGameResource@main/skill/${encodeURIComponent(sk.skillId)}.png`,
        `https://raw.githubusercontent.com/fexli/ArknightsResource/main/skill/${encodeURIComponent(sk.iconId)}.png`,
        `https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/skill/${encodeURIComponent(sk.iconId)}.png`,
        `https://ghfast.top/https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/skill/${encodeURIComponent(sk.iconId)}.png`,
      ];

      const ok = await downloadWithFallbacks(urls, targetFile1);
      if (ok) {
        if (!fs.existsSync(targetFile2)) {
          try { fs.copyFileSync(targetFile1, targetFile2); } catch {}
        }
        successCount++;
      } else {
        // If not found, copy operator avatar as fallback skill icon so there's never a broken 404
        const avatarPath = path.join(PUBLIC, 'assets', 'char', 'avatar', `${sk.charId}.png`);
        if (fs.existsSync(avatarPath)) {
          fs.copyFileSync(avatarPath, targetFile1);
          if (!fs.existsSync(targetFile2)) fs.copyFileSync(avatarPath, targetFile2);
          fallbackCount++;
        }
      }

      // Register in assets.json
      if (!assets.skills) assets.skills = {};
      if (!assets.skillsById) assets.skillsById = {};
      assets.skills[sk.iconId] = `/assets/skill/${sk.iconId}.png`;
      assets.skills[sk.skillId] = `/assets/skill/${sk.skillId}.png`;
      assets.skillsById[sk.skillId] = sk.iconId;
    }));
    process.stdout.write(`\rSkills progress: ${Math.min(i + 8, skillsList.length)}/${skillsList.length}`);
  }
  console.log(`\nSkills complete. Downloaded: ${successCount}, Avatar Fallbacks: ${fallbackCount}`);
}

// ---------------------------------------------------------------------------
// 2. Download Spines
// ---------------------------------------------------------------------------
async function downloadSpines() {
  console.log('\n=== [2/3] Downloading Spine Skeletons ===');
  let okCount = 0;
  let failCount = 0;

  for (let idx = 0; idx < pool.length; idx++) {
    const charId = pool[idx];
    const opSpineDir = path.join(SPINE_DIR, charId);
    const frontDir = path.join(opSpineDir, 'front');
    const backDir = path.join(opSpineDir, 'back');

    const frontSkelPath = path.join(frontDir, `${charId}.skel`);
    const frontAtlasPath = path.join(frontDir, `${charId}.atlas`);
    const frontPngPath = path.join(frontDir, `${charId}.png`);

    const backSkelPath = path.join(backDir, `${charId}.skel`);
    const backAtlasPath = path.join(backDir, `${charId}.atlas`);
    const backPngPath = path.join(backDir, `${charId}.png`);

    const fexliFrontBase = `https://cdn.jsdelivr.net/gh/fexli/ArknightsResource@main/spine/${charId}/${charId}/Front/${charId}`;
    const fexliBackBase = `https://cdn.jsdelivr.net/gh/fexli/ArknightsResource@main/spine/${charId}/${charId}/Back/${charId}`;

    const [frontSkelOk, frontAtlasOk, frontPngOk] = await Promise.all([
      downloadWithFallbacks([
        `${fexliFrontBase}.skel`,
        `https://ghfast.top/https://raw.githubusercontent.com/fexli/ArknightsResource/main/spine/${charId}/${charId}/Front/${charId}.skel`,
        `https://raw.githubusercontent.com/fexli/ArknightsResource/main/spine/${charId}/${charId}/Front/${charId}.skel`
      ], frontSkelPath),
      downloadWithFallbacks([
        `${fexliFrontBase}.atlas`,
        `https://ghfast.top/https://raw.githubusercontent.com/fexli/ArknightsResource/main/spine/${charId}/${charId}/Front/${charId}.atlas`,
        `https://raw.githubusercontent.com/fexli/ArknightsResource/main/spine/${charId}/${charId}/Front/${charId}.atlas`
      ], frontAtlasPath),
      downloadWithFallbacks([
        `${fexliFrontBase}.png`,
        `https://ghfast.top/https://raw.githubusercontent.com/fexli/ArknightsResource/main/spine/${charId}/${charId}/Front/${charId}.png`,
        `https://raw.githubusercontent.com/fexli/ArknightsResource/main/spine/${charId}/${charId}/Front/${charId}.png`
      ], frontPngPath),
    ]);

    // Back spine (optional fallback to front if missing)
    await Promise.all([
      downloadWithFallbacks([
        `${fexliBackBase}.skel`,
        `https://ghfast.top/https://raw.githubusercontent.com/fexli/ArknightsResource/main/spine/${charId}/${charId}/Back/${charId}.skel`,
        `https://raw.githubusercontent.com/fexli/ArknightsResource/main/spine/${charId}/${charId}/Back/${charId}.skel`
      ], backSkelPath),
      downloadWithFallbacks([
        `${fexliBackBase}.atlas`,
        `https://ghfast.top/https://raw.githubusercontent.com/fexli/ArknightsResource/main/spine/${charId}/${charId}/Back/${charId}.atlas`,
        `https://raw.githubusercontent.com/fexli/ArknightsResource/main/spine/${charId}/${charId}/Back/${charId}.atlas`
      ], backAtlasPath),
      downloadWithFallbacks([
        `${fexliBackBase}.png`,
        `https://ghfast.top/https://raw.githubusercontent.com/fexli/ArknightsResource/main/spine/${charId}/${charId}/Back/${charId}.png`,
        `https://raw.githubusercontent.com/fexli/ArknightsResource/main/spine/${charId}/${charId}/Back/${charId}.png`
      ], backPngPath),
    ]);

    if (frontSkelOk && frontAtlasOk && frontPngOk) {
      okCount++;
    } else {
      failCount++;
    }
    process.stdout.write(`\rSpines progress: ${idx + 1}/${pool.length} (OK: ${okCount}, Failed: ${failCount})`);
  }
  console.log(`\nSpines download complete. Success: ${okCount}, Failed: ${failCount}`);
}

// ---------------------------------------------------------------------------
// 3. Process and Update assets.json
// ---------------------------------------------------------------------------
async function updateAssetsJson() {
  console.log('\n=== [3/3] Parsing Spine and Updating assets.json ===');
  for (const charId of pool) {
    if (!assets.chars) assets.chars = {};
    if (!assets.chars[charId]) {
      assets.chars[charId] = {
        avatar: `/assets/char/avatar/${charId}.png`,
        avatarE2: `/assets/char/avatar/${charId}_2.png`,
        portrait: `/assets/char/portrait/${charId}_1.png`,
        portraitE2: `/assets/char/portrait/${charId}_2.png`,
      };
    }

    const frontSkelPath = path.join(SPINE_DIR, charId, 'front', `${charId}.skel`);
    const frontAtlasPath = path.join(SPINE_DIR, charId, 'front', `${charId}.atlas`);
    const frontPngPath = path.join(SPINE_DIR, charId, 'front', `${charId}.png`);

    if (fs.existsSync(frontSkelPath) && fs.existsSync(frontAtlasPath) && fs.existsSync(frontPngPath)) {
      try {
        const atlasText = fs.readFileSync(frontAtlasPath, 'utf8');
        const pngBuf = fs.readFileSync(frontPngPath);
        const sz = pngSize(pngBuf);
        const sizes = new Map();
        sizes.set(`${charId}.png`, sz || { width: 1024, height: 1024 });

        const norm = normalizeAtlas(atlasText, { pageSize: (p) => sizes.get(p) || { width: 1024, height: 1024 }, pma: false });
        if (norm.changed) {
          fs.writeFileSync(frontAtlasPath, norm.text);
        }
        const info = atlasInfo(norm.text);
        const skelBuf = fs.readFileSync(frontSkelPath);
        const sk = parseSkel(skelBuf, info.regions);
        const anims = resolveRoles(sk.animations, { skillIndices: [0, 1, 2], durations: sk.durations });

        if (!assets.chars[charId].spine) assets.chars[charId].spine = {};
        assets.chars[charId].spine.front = {
          skel: `/assets/spine/op/${charId}/front/${charId}.skel`,
          atlas: `/assets/spine/op/${charId}/front/${charId}.atlas`,
          textures: [`/assets/spine/op/${charId}/front/${charId}.png`],
          pma: false,
          anims,
          animations: sk.durations,
          events: sk.events,
          hits: sk.hits,
          bounds: sk.bounds,
        };

        // Back spine if present
        const backSkelPath = path.join(SPINE_DIR, charId, 'back', `${charId}.skel`);
        const backAtlasPath = path.join(SPINE_DIR, charId, 'back', `${charId}.atlas`);
        const backPngPath = path.join(SPINE_DIR, charId, 'back', `${charId}.png`);
        if (fs.existsSync(backSkelPath) && fs.existsSync(backAtlasPath) && fs.existsSync(backPngPath)) {
          const bAtlasText = fs.readFileSync(backAtlasPath, 'utf8');
          const bInfo = atlasInfo(bAtlasText);
          const bSkelBuf = fs.readFileSync(backSkelPath);
          const bSk = parseSkel(bSkelBuf, bInfo.regions);
          const bAnims = resolveRoles(bSk.animations, { skillIndices: [0, 1, 2], durations: bSk.durations });
          assets.chars[charId].spine.back = {
            skel: `/assets/spine/op/${charId}/back/${charId}.skel`,
            atlas: `/assets/spine/op/${charId}/back/${charId}.atlas`,
            textures: [`/assets/spine/op/${charId}/back/${charId}.png`],
            pma: false,
            anims: bAnims,
            animations: bSk.durations,
            events: bSk.events,
            hits: bSk.hits,
            bounds: bSk.bounds,
          };
        }
      } catch (err) {
        console.error(`Error parsing spine for ${charId}:`, err.message);
      }
    } else {
      // If no valid spine files, remove bogus spine reference so renderer directly uses diamond fallback
      delete assets.chars[charId].spine;
    }
  }

  // Asset paths are cached for a day: change the URL when a corrected portrait replaces old art.
  for (const id of pool) for (const [key, suffix] of [['portrait', '_1'], ['portraitE2', '_2']]) {
    const file = path.join(PUBLIC, 'assets/char/portrait', `${id}${suffix}.png`);
    if (!assets.chars[id] || !fs.existsSync(file)) continue;
    const rev = createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
    assets.chars[id][key] = `/assets/char/portrait/${id}${suffix}.png?rev=${rev}`;
  }
  fs.writeFileSync(path.join(ROOT, 'data', 'assets.json'), JSON.stringify(assets, null, 2), 'utf8');
  console.log('assets.json successfully updated!');
}

async function main() {
  for (const id of pool) {
    const name = backups.units[id].name;
    const images = [['avatar', '', `头像_${name}.png`], ['avatar', '_2', `头像_${name}_2.png`]];
    // Portrait cards are client crops (180x360), not PRTS full illustrations.
    for (const suffix of ['_1', '_2']) {
      const dest = path.join(PUBLIC, 'assets/char/portrait', `${id}${suffix}.png`);
      const size = fs.existsSync(dest) ? pngSize(fs.readFileSync(dest)) : null;
      if (size?.width === 180 && size?.height === 360) continue;
      const buf = await downloadBuffer(`https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/portrait/${id}${suffix}.png`);
      const downloaded = pngSize(buf);
      if (downloaded?.width !== 180 || downloaded?.height !== 360) throw new Error(`Missing 180x360 portrait: ${id}${suffix}`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
    }
    const missing = images.filter(([kind, suffix]) => !fs.existsSync(path.join(PUBLIC, 'assets', 'char', kind, `${id}${suffix}.png`)));
    if (missing.length) {
      const params = new URLSearchParams({ action: 'query', titles: missing.map(x => '文件:' + x[2]).join('|'), prop: 'imageinfo', iiprop: 'url', format: 'json' });
      const response = await downloadBuffer(`https://prts.wiki/api.php?${params}`);
      const pages = response ? Object.values(JSON.parse(response.toString()).query?.pages || {}) : [];
      for (const [kind, suffix, title] of missing) {
        const url = pages.find(p => p.title === '文件:' + title.replaceAll('_', ' '))?.imageinfo?.[0]?.url;
        if (!url || !await downloadWithFallbacks([url], path.join(PUBLIC, 'assets', 'char', kind, `${id}${suffix}.png`)))
          throw new Error(`Missing operator image: ${title}`);
      }
    }
  }
  await downloadSkills();
  await downloadSpines();
  await updateAssetsJson();
  console.log('\nAll assets pipeline finished successfully!');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
