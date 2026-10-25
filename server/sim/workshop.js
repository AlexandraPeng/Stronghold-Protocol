import { hypot } from './detmath.js';
// Isolated local sandbox. The compiler never writes to the game's shared data maps.
import { validateWorkshop } from '../../shared/workshop.js';
import { DataSource, toDataSource } from './simdata.js';
import { buildBattleSpec, createBattleFromSpec } from './spec.js';
import { Grid } from './grid.js';
import { KITS, STATS_ONLY } from './content/enemies.js';
import { BOSS_KITS } from './content/bosses.js';

export function enemyCoverage(key) {
  if (BOSS_KITS[key]) return { state: 'partial', label: '领袖脚本 · 试验场适配待核对', detail: '部分脚本依赖正式对局的共享生命池、地图和阶段；本地波次不等于完整原关卡。' };
  if (KITS[key]) return { state: 'existing', label: '已有专属脚本', detail: '复用卫戍实现，尚未逐项核对全部 PRTS 机制与等级。' };
  const reason = STATS_ONLY[key];
  if (reason && !/absent|same|bond summon/.test(reason)) return { state: 'basic', label: '已有基础行为', detail: reason };
  return { state: reason ? 'partial' : 'missing', label: reason ? '机制不完整' : '尚无专属脚本', detail: reason || '仅能进行属性、移动和普通攻击试验；特殊技能、阶段与召唤尚未实现。' };
}

function bondState(defs, catalog, layers) {
  const sets = {}, variants = {}, counts = {};
  for (const d of defs) for (const id of d.bonds) {
    (sets[id] ??= new Set()).add(d.baseId);
    (variants[id] ??= new Set()).add(`${d.baseId}|${d.golden}`);
  }
  const tierOf = (b, n) => b.thresholdTemplate === 'count_threshold_downward'
    ? +(n >= (b.thresholds?.[0] ?? 1) && n <= (b.maxCount ?? 1))
    : (b.thresholds ?? [b.activeCount ?? 1]).filter(t => n >= t).length;
  for (const [id, b] of Object.entries(catalog)) counts[id] = b.countsGoldenOnly ? defs.filter(d => d.golden).length : (sets[id]?.size ?? 0);
  const harmony = catalog.maniShip && tierOf(catalog.maniShip, counts.maniShip) > 0;
  const result = {};
  for (const [id, b] of Object.entries(catalog)) {
    const count = counts[id] + (harmony && b.isCore && sets[id]?.size ? 1 : 0);
    let tier = tierOf(b, count);
    if (id === 'deputShip' && tier) tier = Math.max(1, tierOf(b, variants[id]?.size ?? 0));
    result[id] = { count, tier, active: tier > 0, layers: layers[id] ?? 0 };
  }
  return result;
}

export function compileWorkshop(input, source, catalog, bonds = {}) {
  const doc = validateWorkshop(input), base = toDataSource(source);
  const stage = base.getStage(doc.stageId);
  if (!stage) throw new Error(`地图不存在：${doc.stageId}`);
  const rect = { r0: 9, r1: 12, c0: 2, c1: 10 }, grid = new Grid(stage, rect);
  const definitions = new Map(), warnings = [], enemyRecords = { ...base.raw.enemies };
  const selected = new Map();
  const routes = [], spawns = [];
  for (const w of doc.waves) {
    const entry = catalog.enemies[w.enemyKey];
    const record = w.useCatalog ? entry?.levels.find(x => x.level === w.level) : base.raw.enemies[w.enemyKey];
    if (!record) throw new Error(`找不到敌人或等级：${w.enemyKey} Lv.${w.level}`);
    const coverage = enemyCoverage(w.enemyKey);
    if (coverage.state === 'partial' || coverage.state === 'missing') {
      const message = `${entry?.name ?? w.enemyKey}：${coverage.label}。${coverage.detail}`;
      if (!doc.allowIncomplete) throw new Error(`${message} 请明确开启“允许不完整机制试战”。`);
      warnings.push(message);
    }
    const signature = JSON.stringify([w.level, w.useCatalog, w.stats, w.talentParams, w.skillParams]);
    if (selected.has(w.enemyKey) && selected.get(w.enemyKey) !== signature) throw new Error('同一敌人编号在一次试战中需要使用相同等级和参数');
    selected.set(w.enemyKey, signature);
    const rec = structuredClone(record);
    Object.assign(rec.stats, w.stats);
    for (const name of Object.keys(w.talentParams)) if (!Object.hasOwn(rec.talents?.bb ?? {}, name)) throw new Error(`敌人天赋未定义参数：${name}`);
    rec.talents ??= { bb: {} }; rec.talents.bb = { ...rec.talents.bb, ...w.talentParams };
    if (Object.keys(w.skillParams).length) {
      if (!rec.skills?.length) throw new Error(`${rec.name} 没有可覆盖的技能参数`);
      for (const [name, value] of Object.entries(w.skillParams)) {
        const matches = rec.skills.filter(s => Object.hasOwn(s.bb ?? {}, name));
        if (!matches.length) throw new Error(`敌人技能未定义参数：${name}`);
        for (const s of matches) s.bb[name] = value;
      }
    }
    enemyRecords[w.enemyKey] = rec;
    routes.push({ motion: rec.stats.motion ?? 'WALK', start: [w.lane, 10], end: [w.lane, 2], checkpoints: [] });
    spawns.push({ enemyKey: w.enemyKey, time: w.time, count: w.count, interval: w.interval, routeIndex: routes.length - 1, tag: `workshop_wave_${routes.length - 1}` });
  }
  const ds = new DataSource({ ...base.raw, enemies: enemyRecords }, base);
  const units = doc.allies.map((a, i) => {
    const original = base.getChess(a.chessId, a.skillIndex == null ? null : { skillIndex: a.skillIndex });
    if (!original) throw new Error(`找不到干员：${a.chessId}`);
    const d = structuredClone(original);
    if (a.skillIndex != null && d.skill?.index !== a.skillIndex) throw new Error(`${d.name} 不支持该技能`);
    Object.assign(d.stats, a.stats);
    if (a.customBonds) d.bonds = [...new Set(a.bonds)];
    for (const id of d.bonds) if (!bonds[id]) throw new Error(`不存在的盟约：${id}`);
    if (!grid.canStand(a.row, a.col, { ranged: d.position === 'RANGED' })) throw new Error(`${d.name} 不能部署在 (${a.row}, ${a.col})`);
    for (const [key, value] of Object.entries(a.skillParams)) {
      if (!d.skill || !Object.hasOwn(d.skill.bb, key)) throw new Error(`${d.name} 的技能未定义参数：${key}`);
      d.skill.bb[key] = value;
    }
    const alias = `workshop_${i}`;
    definitions.set(alias, d);
    return { uid: alias, kind: 'chess', chessId: alias, row: a.row, col: a.col, dir: a.dir };
  });
  for (const [id, layers] of Object.entries(doc.bondLayers)) if (!bonds[id] || !Number.isInteger(layers) || layers < 0) throw new Error(`盟约层数无效：${id}`);
  const getChess = ds.getChess.bind(ds);
  ds.getChess = (id, loadout) => definitions.get(id) ?? getChess(id, loadout);
  const spec = buildBattleSpec({ fieldId: 'workshop', seed: doc.seed, kind: 'normal', stageId: doc.stageId, rect,
    timeLimit: doc.duration, players: [{ playerId: 'workshop', side: 'L', units, bonds: bondState([...definitions.values()], bonds, doc.bondLayers) }], routes, spawns });
  return { doc, spec, ds, warnings: [...new Set(warnings)], create: () => {
    const battle = createBattleFromSpec(spec, ds, { quiet: true });
    installWorkshopRules(battle, doc);
    installWorkshopAlliances(battle, doc);
    return battle;
  } };
}

function workshopSource(u,doc) {
  const i=Number(String(u.kind==='enemy'?u.tag:u.uid).replace(u.kind==='enemy'?'workshop_wave_':'workshop_',''));
  return u.kind==='enemy'?doc.waves[i]:u.kind==='op'?doc.allies[i]:null;
}

// Custom alliances count living deployed units on each side independently. They affect members only.
export function installWorkshopAlliances(battle,doc) {
  if(!doc.customAlliances.length)return;
  let next=0;
  battle.on('tick',()=>{
    if(battle.time+1e-9<next)return;next=battle.time+.25;
    for(const alliance of doc.customAlliances)for(const enemy of [false,true]){
      const members=battle.units.filter(u=>u.alive&&u.deployed&&(u.kind==='enemy')===enemy&&workshopSource(u,doc)?.alliances.includes(alliance.id));
      const key=`workshopAlliance:${alliance.id}:${enemy}`;
      if(members.length<alliance.need){for(const u of members)battle.removeBuff(u,key);continue;}
      const mods={...alliance.mods};for(const [k,v] of Object.entries(alliance.perLayer))mods[k]=(mods[k]??0)+v*alliance.layers;
      for(const u of members)battle.addBuff(u,{key,mods,duration:.5,refresh:'replace',visible:true});
    }
  });
}

// Declarative user-designed skills. These are explicitly separate from the enemy's Wiki mechanics.
// No executable code, eval, recursive attack triggers, or persistent global edits are accepted.
export function installWorkshopRules(battle, doc) {
  const active = new Map();
  battle.on('deploy', ({ unit: u }) => {
    const index = u.kind === 'enemy' ? Number(String(u.tag).replace('workshop_wave_', '')) : Number(String(u.uid).replace('workshop_', ''));
    const source = u.kind === 'enemy' ? doc.waves[index] : u.kind === 'op' ? doc.allies[index] : null;
    if (!source?.rules?.length) return;
    active.set(u.id, { u, rules:source.rules, due:source.rules.map(r => battle.time + r.delay) });
  });
  battle.on('tick', () => {
    for (const [id, state] of active) {
      const {u,rules,due} = state;
      if (!u.alive || !u.deployed) { active.delete(id); continue; }
      if (u.hidden || !u.canAct || u.s.flags.silence) continue;
      rules.forEach((r, i) => {
        if (battle.time + 1e-9 < due[i]) return;
        due[i] = battle.time + r.interval;
        const same = x => (x.kind === 'enemy') === (u.kind === 'enemy');
        const candidates = r.target === 'self' ? [u] : battle.units.filter(x => x.alive && x.deployed && !x.hidden &&
          (r.target === 'friendly' ? same(x) : !same(x)) && hypot(x.x-u.x,x.y-u.y) <= r.radius);
        candidates.sort((a,b) => hypot(a.x-u.x,a.y-u.y)-hypot(b.x-u.x,b.y-u.y) || a.id-b.id);
        for (const t of candidates.slice(0,r.maxTargets)) {
          if (r.effect === 'damage') battle.dealDamage(u,t,{amount:r.amount,type:r.damageType,isSkill:true,tags:['workshopSkill']});
          else if (r.effect === 'heal') battle.heal(u,t,r.amount,{isSkill:true});
          else {
            const buff = {key:`workshop:${u.id}:${i}`,duration:r.duration,refresh:'replace',visible:true};
            if (r.effect === 'shield') buff.shield = r.amount;
            else buff.mods = {[{atkBuff:'atkFlat',defBuff:'defFlat',aspdBuff:'aspd'}[r.effect]]:r.amount};
            battle.addBuff(t,buff);
          }
        }
      });
    }
  });
}
