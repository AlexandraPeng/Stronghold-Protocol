#!/usr/bin/env node
// tools/sync-voices-manifest.mjs — Verify or synchronize public/assets/audio/voice/ with data/assets.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VOICE_DIR = path.join(ROOT, 'public', 'assets', 'audio', 'voice');
const MANIFEST_PATH = path.join(ROOT, 'data', 'assets.json');
const CACHE_STRUCTURE = path.join(ROOT, '.cache', 'bilingual_voice_structure.json');

/**
 * Collect all relative mp3 paths under a directory recursively.
 */
function walkMp3(dir, base = '') {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const full = path.join(dir, item);
    const rel = base ? `${base}/${item}` : item;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(walkMp3(full, rel));
    } else if (item.endsWith('.mp3')) {
      results.push(rel.replace(/\\/g, '/'));
    }
  }
  return results;
}

/**
 * Read-only check: verify that the active CN/JP manifests reference existing voice files.
 * Does NOT touch or write any files.
 * @returns {{ ok: boolean, diskCount: number, manifestCount: number, missing: string[] }}
 */
export function verifyVoicesManifest() {
  if (!fs.existsSync(VOICE_DIR) || !fs.existsSync(MANIFEST_PATH)) {
    return { ok: true, diskCount: 0, manifestCount: 0, missing: [] };
  }

  const diskFiles = walkMp3(VOICE_DIR);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const manifestUrls = new Set();
  function collectUrls(value) {
    if (typeof value === 'string' && value.startsWith('/assets/audio/voice/')) manifestUrls.add(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(collectUrls);
  }
  collectUrls(manifest.audio?.voice);
  collectUrls(manifest.audio?.voiceJp);
  // Only referenced files enter the game. Old cached lines need not be forced into the new named-line schema.
  const missing = [...manifestUrls].filter(url => !fs.existsSync(path.join(ROOT, 'public', url.split(/[?#]/)[0])));

  return {
    ok: missing.length === 0,
    diskCount: diskFiles.length,
    manifestCount: manifestUrls.size,
    missing,
  };
}

/**
 * Explicit sync: update data/assets.json with disk voice entries.
 * Must only be called intentionally (e.g. CLI with --write).
 * @returns {{ count: number, path: string }}
 */
export function syncVoicesManifest() {
  if (!fs.existsSync(VOICE_DIR) || !fs.existsSync(MANIFEST_PATH)) {
    return { count: 0, path: MANIFEST_PATH };
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (!manifest.audio) manifest.audio = {};

  let structure = null;
  if (fs.existsSync(CACHE_STRUCTURE)) {
    try {
      structure = JSON.parse(fs.readFileSync(CACHE_STRUCTURE, 'utf8'));
    } catch {}
  }

  if (!structure || (!structure.jp && !structure.cn)) {
    throw new Error('Named bilingual voice cache required; a flat file index cannot replace the 0.2.6 voice schema.');
  }
  manifest.audio.voice = { ...(manifest.audio.voice || {}), ...(structure.cn || {}) };
  manifest.audio.voiceJp = { ...(manifest.audio.voiceJp || {}), ...(structure.jp || {}) };
  let count = 0;
  for (const bank of [manifest.audio.voice, manifest.audio.voiceJp]) {
    for (const [id, slots] of Object.entries(bank)) {
      if (!/^char_\d+_[a-z0-9]+$/.test(id) || !slots || typeof slots !== 'object') { delete bank[id]; continue; }
      for (const value of Object.values(slots)) count += Array.isArray(value) ? value.length : 1;
    }
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest), 'utf8');
  console.log(`[sync-voices-manifest] 已将 ${count} 条双语语音清单写入 ${MANIFEST_PATH}`);
  return { count, path: MANIFEST_PATH };
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const isWrite = process.argv.includes('--write');
  if (isWrite) {
    syncVoicesManifest();
  } else {
    const res = verifyVoicesManifest();
    if (!res.ok) {
      console.error(`✘ [sync-voices-manifest] 校验失败: 发现 ${res.missing.length} 个已登记语音文件在磁盘缺失:`);
      console.error(`  缺少: ${res.missing.slice(0, 5).join(', ')}${res.missing.length > 5 ? '...' : ''}`);
      console.error(`  如需同步写入，请运行: node tools/sync-voices-manifest.mjs --write`);
      process.exit(1);
    } else {
      console.log(`✔ [sync-voices-manifest] 语音资产清单校验通过 (磁盘: ${res.diskCount} 条, 清单: ${res.manifestCount} 条)`);
    }
  }
}
