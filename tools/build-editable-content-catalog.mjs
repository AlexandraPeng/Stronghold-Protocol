import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLACKFOREST_CATALOG } from '../shared/blackforestSource.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const enemies = readJson('data/enemies.json');
const bosses = readJson('data/bosses.json');

const monsters = Object.values(enemies)
  .map((enemy) => ({
    id: enemy.key,
    name: enemy.name,
    rank: enemy.rank,
    isBoss: enemy.rank === 'BOSS',
    category: enemy.acType,
    flying: enemy.isFlyEnemy === true,
    description: enemy.desc,
  }));

const bossList = Object.values(bosses).map((boss) => ({
  id: boss.bossId,
  name: boss.name,
  enemyId: boss.enemyKey,
  hidden: boss.hidden === true,
  weight: boss.weight,
  abilities: boss.abilities,
  modes: Object.fromEntries(Object.entries(boss.templates).map(([modeId, value]) => [modeId, {
    round: value.round,
    template: value.template,
  }])),
}));

const relics = BLACKFOREST_CATALOG.map((relic) => ({
  id: relic.id,
  name: relic.name,
  rarity: relic.rarity,
  effect: relic.baseUsage,
  source: relic.source,
  status: relic.status,
  buffs: relic.buffs,
}));

const catalog = {
  version: 1,
  title: '卫戍协议：盟约内容编辑目录',
  instructions: [
    '可编辑 name、description、effect、abilities、weight 和 buffs。',
    'id、enemyId、bossId、modeId、template 是程序映射键，除非同步修改代码，否则不要改名。',
    '本文件是编辑目录，不会自动覆盖 data/ 或 shared/ 的运行时数据。确认修改后再同步到对应源文件。',
  ],
  monsters,
  bosses: bossList,
  relics,
};

const output = path.join(root, 'docs/content-editable.json');
fs.writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`写入 ${path.relative(root, output)}：${monsters.length} 个怪物、${bossList.length} 个 Boss、${relics.length} 个藏品`);
