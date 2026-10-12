#!/usr/bin/env node
// Targeted extension of the existing DIY catalogue; never rebuild unrelated seasonal data.
// Inputs: official CN excel tables in .cache/new-operators (Kengxxiao/ArknightsGameData).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { interpolateAttrs, statsFrom, immunitiesOf, rangeGrid, traitRecord, buildSkill, resolveTrigger,
  baseTalentList, mergeTalentChanges, splitModuleParts, bestCandidate, moduleAttr, moduleTalentChanges } from './build-data.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = resolve(root, process.argv[2] || '.cache/new-operators');
const read = async (name) => JSON.parse(await readFile(resolve(cache, name + '.json'), 'utf8'));
const ctx = { charTable: await read('character_table'), skillTable: await read('skill_table'),
  rangeTable: await read('range_table'), uniequip: await read('uniequip_table'), battleEquip: await read('battle_equip_table'), ac: {} };
// This fork's existing catalogue uses full potential. Let the shared last-unlocked-candidate
// builder see all potential candidates, preserving their original order and level gates.
function unlockPotential(value) {
  if (!value || typeof value !== 'object') return;
  if ('requiredPotentialRank' in value) value.requiredPotentialRank = 0;
  for (const child of Object.values(value)) unlockPotential(child);
}
unlockPotential(ctx.charTable); unlockPotential(ctx.battleEquip);
const choices = { char_4217_makoto: ['emptyShip', 'lateranoShip'], char_4182_oblvns: ['emptyShip'], char_4231_clemnt: ['emptyShip', 'egirShip'] };
const statuses = [{ phase: 2, level: 1, skillLevel: 4, equipLevel: 0 },
  { phase: 2, level: 60, skillLevel: 7, equipLevel: 1 }, { phase: 2, level: 60, skillLevel: 7, equipLevel: 3 }];
const out = JSON.parse(await readFile(resolve(root, 'data/backups.json'), 'utf8'));
for (const [id, bonds] of Object.entries(choices)) {
  const c = ctx.charTable[id];
  if (!c || c.isNotObtainable) throw new Error(`Missing playable character ${id}`);
  const moduleNames = {}, forms = {};
  for (const mid of ctx.uniequip.charEquip[id] || []) {
    const m = ctx.uniequip.equipDict[mid];
    moduleNames[mid] = { name: m.uniEquipName, typeName: `${m.typeName1}${m.typeName2 ? '-' + m.typeName2 : ''}` };
  }
  for (const status of statuses) {
    const { phase, level, skillLevel, equipLevel } = status;
    const a = interpolateAttrs(c, phase, level), base = traitRecord(ctx, c, phase, level, [], id);
    const attrKeys = { ATK: 'atk', COST: 'cost', RESPAWN_TIME: 'respawnTime' };
    for (const rank of c.potentialRanks || []) for (const m of rank.buff?.attributes?.attributeModifiers || []) {
      if (m.formulaItem !== 'ADDITION' || !attrKeys[m.attributeType]) throw new Error(`Unhandled potential modifier ${id}`);
      a[attrKeys[m.attributeType]] += m.value;
    }
    const skills = c.skills.map((s, index) => {
      const rec = buildSkill(ctx, s.skillId, skillLevel, null, id);
      return { ...rec, index, overrideTokenKey: s.overrideTokenKey || null,
        trigger: resolveTrigger(ctx, c, id, index, rec, { operator: true }) };
    });
    const modules = [];
    if (equipLevel) for (const mid of ctx.uniequip.charEquip[id] || []) {
      const m = ctx.uniequip.equipDict[mid];
      if (m.type === 'INITIAL') continue;
      const p = ctx.battleEquip[mid]?.phases?.find(p => p.equipLevel === equipLevel);
      if (!p) throw new Error(`Missing module phase ${mid}/${equipLevel}`);
      const { op } = splitModuleParts(p);
      modules.push({ uniEquipId: mid, ...moduleNames[mid], typeIcon: m.typeIcon, icon: m.uniEquipIcon || mid, level: equipLevel,
        attr: moduleAttr(p), traitOverride: op.some(p => bestCandidate(p.overrideTraitDataBundle?.candidates, phase, level))
          ? traitRecord(ctx, c, phase, level, op, id).trait : null,
        talentChanges: moduleTalentChanges(ctx, op, phase, level, id) });
    }
    const rangeId = c.phases[phase].rangeId;
    forms[`${phase}/${level}/${skillLevel}/${equipLevel}`] = { status, stats: statsFrom(a), immunities: immunitiesOf(a),
      rangeId, rangeGrid: rangeGrid(ctx, rangeId), ...base.classify, trait: base.trait, skills,
      talents: mergeTalentChanges(baseTalentList(ctx, c, phase, level, id), []), displayTokens: [], tokens: [],
      ...(equipLevel ? { modules } : {}) };
  }
  out.units[id] = { charId: id, name: c.name, appellation: c.appellation, rarity: Number(c.rarity.slice(-1)),
    profession: c.profession, subProfessionId: c.subProfessionId,
    subProfessionName: ctx.uniequip.subProfDict[c.subProfessionId]?.subProfessionName,
    position: c.position, nationId: c.nationId, isNotObtainable: false,
    assets: { avatar: id, avatarGolden: `${id}_2`, portrait: `${id}_1`, portraitGolden: `${id}_2`, spine: id, subProfIcon: `sub_${c.subProfessionId}_icon` }, moduleNames, forms };
  if (!out.diy.ownedPool.includes(id)) out.diy.ownedPool.push(id);
  out.diy.operators[id] = { charId: id, name: c.name, rarity: 6, profession: c.profession,
    subProfessionId: c.subProfessionId, isNotObtainable: false, powers: [c.nationId, c.groupId, c.teamId].filter(Boolean), bonds };
}
await writeFile(resolve(root, 'data/backups.json'), JSON.stringify(out) + '\n');
console.log('Updated three DIY operators, all skills and three training forms.');
