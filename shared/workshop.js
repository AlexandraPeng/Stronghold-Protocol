// i18n-ignore-file: standalone Chinese workshop editor; its configuration labels are not game language-pack strings.
// Local workshop files contain data only. Never execute imported script or mutate live match data.
export const WORKSHOP_VERSION = 1;
export const STAT_LIMITS = Object.freeze({ maxHp: [1, 1e8], atk: [0, 1e6], def: [0, 1e6], res: [0, 100], bat: [.05, 120], aspd: [1, 1000], moveSpeed: [0, 10], blockCnt: [0, 50], massLevel: [0, 20] });
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const fail = m => { throw new Error(m); };
const number = (v, lo, hi, name, integer = false) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi || (integer && !Number.isInteger(v))) fail(`${name} 必须在 ${lo}～${hi} 之间${integer ? '且为整数' : ''}`);
  return v;
};
const text = (v, n, name) => typeof v === 'string' && v.length <= n ? v : fail(`${name} 格式不正确`);
function memberships(v = []) {
  if (!Array.isArray(v) || v.length > 16) fail('最多归属 16 个自定义盟约');
  return [...new Set(v.map(id=>text(id,80,'盟约编号')))];
}
function allianceMods(v = {}) {
  if (!object(v)) fail('盟约属性必须是对象');
  const limits={atkPct:[-.9,10],defFlat:[-1e5,1e5],resFlat:[-100,100],aspd:[-99,1000]},out={};
  for(const [k,value] of Object.entries(v)){if(!limits[k])fail(`不支持的盟约属性：${k}`);out[k]=number(value,...limits[k],k);}
  return out;
}
function safe(v, depth = 0) {
  if (depth > 16) fail('配置嵌套过深');
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
    if (['__proto__', 'prototype', 'constructor'].includes(k)) fail('配置含不允许的字段');
    safe(x, depth + 1);
  }
}
function stats(v = {}) {
  if (!object(v)) fail('属性必须是对象');
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    if (!STAT_LIMITS[k]) fail(`不支持的属性：${k}`);
    out[k] = number(x, ...STAT_LIMITS[k], k);
  }
  return out;
}
function params(v = {}) {
  if (!object(v) || Object.keys(v).length > 100) fail('技能参数格式不正确');
  const out = {};
  for (const [k, x] of Object.entries(v)) { text(k, 120, '参数名称'); out[k] = number(x, -1e6, 1e6, k); }
  return out;
}
function rules(v = []) {
  if (!Array.isArray(v) || v.length > 6) fail('每个单位最多 6 个附加技能');
  return v.map(r => {
    if (!object(r) || !['damage','heal','shield','atkBuff','defBuff','aspdBuff'].includes(r.effect)) fail('不支持的自定义技能效果');
    if (!['self','friendly','hostile'].includes(r.target)) fail('自定义技能目标不正确');
    if (!['phys','arts','true'].includes(r.damageType ?? 'arts')) fail('技能伤害类型不正确');
    return { name:text(r.name ?? '附加技能',40,'技能名称'), effect:r.effect, target:r.target,
      damageType:r.damageType ?? 'arts', amount:number(r.amount,0,1e6,'技能数值'),
      interval:number(r.interval,0.5,120,'技能间隔'), delay:number(r.delay ?? 0,0,600,'技能初始延迟'),
      radius:number(r.radius ?? 2,0,20,'技能半径'), duration:number(r.duration ?? 3,.1,120,'效果持续时间'),
      maxTargets:number(r.maxTargets ?? 1,1,30,'技能目标数',true) };
  });
}
export function validateWorkshop(input) {
  safe(input);
  if (!object(input) || input.version !== WORKSHOP_VERSION) fail('不支持的工坊文件版本');
  if (!Array.isArray(input.customAlliances ?? []) || (input.customAlliances ?? []).length > 16) fail('最多 16 个自定义盟约');
  const allianceIds=new Set();
  const customAlliances=(input.customAlliances??[]).map(b=>{
    if(!object(b))fail('自定义盟约格式不正确');const id=text(b.id,80,'盟约编号');
    if(!id || allianceIds.has(id))fail('自定义盟约编号为空或重复');allianceIds.add(id);
    return {id,name:text(b.name,60,'盟约名称'),need:number(b.need,1,300,'激活人数',true),layers:number(b.layers??0,0,10000,'盟约层数',true),mods:allianceMods(b.mods),perLayer:allianceMods(b.perLayer)};
  });
  if (!Array.isArray(input.allies) || input.allies.length > 32 || !Array.isArray(input.waves) || input.waves.length > 100) fail('最多 32 名我方单位、100 条敌方波次');
  const occupied = new Set();
  const allies = input.allies.map((u, i) => {
    if (!object(u)) fail('我方单位格式不正确');
    const row = number(u.row, 9, 12, '行', true), col = number(u.col, 2, 8, '列', true);
    const cell = `${row}:${col}`; if (occupied.has(cell)) fail(`我方位置重复：${cell}`); occupied.add(cell);
    if (!['LEFT', 'RIGHT', 'UP', 'DOWN'].includes(u.dir ?? 'RIGHT')) fail('朝向不正确');
    if (!Array.isArray(u.bonds ?? []) || (u.bonds ?? []).length > 12) fail('盟约列表不正确');
    return { chessId: text(u.chessId, 120, '干员编号'), row, col, dir: u.dir ?? 'RIGHT', skillIndex: u.skillIndex == null ? null : number(u.skillIndex, 0, 2, '技能', true), stats: stats(u.stats), skillParams: params(u.skillParams), rules:rules(u.rules), alliances:memberships(u.alliances), bonds: (u.bonds ?? []).map(b => text(b, 100, '盟约编号')), customBonds: u.customBonds === true };
  });
  let total = 0;
  const waves = input.waves.map(w => {
    if (!object(w)) fail('波次格式不正确');
    const count = number(w.count, 1, 100, '数量', true); total += count;
    return { enemyKey: text(w.enemyKey, 120, '敌人编号'), level: number(w.level ?? 0, 0, 100, '敌人级别', true), count, time: number(w.time, 0, 600, '出场时间'), interval: number(w.interval, .1, 60, '出场间隔'), lane: number(w.lane ?? 9, 9, 12, '路线行', true), faction: text(w.faction ?? '敌方', 40, '敌方阵营名称'), stats: stats(w.stats), talentParams: params(w.talentParams), skillParams: params(w.skillParams), rules:rules(w.rules), alliances:memberships(w.alliances), useCatalog: w.useCatalog === true };
  });
  if (total > 300) fail('一次试战最多安排 300 名敌人');
  for(const unit of [...allies,...waves])for(const id of unit.alliances)if(!allianceIds.has(id))fail(`不存在的自定义盟约：${id}`);
  return { version: 1, name: text(input.name ?? '未命名作品', 80, '作品名称'), stageId: text(input.stageId, 120, '地图编号'), seed: number(input.seed ?? 1, 1, 4294967295, '随机种子', true), duration: number(input.duration ?? 120, 1, 600, '试战时长'), allowIncomplete: input.allowIncomplete === true, allies, waves, customAlliances, bondLayers: params(input.bondLayers) };
}
export function parseWorkshop(value) {
  if (typeof value !== 'string' || value.length > 2 * 1024 * 1024) fail('配置文件不能超过 2 MB');
  return validateWorkshop(JSON.parse(value));
}
export function defaultWorkshop() {
  return { version: 1, name: '我的试验场', stageId: 'act2autochess_m01', seed: 1, duration: 120, allowIncomplete: false, allies: [], waves: [], customAlliances:[], bondLayers: {} };
}
