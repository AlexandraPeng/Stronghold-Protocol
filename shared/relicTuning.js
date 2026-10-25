import { BLACKFOREST_CATALOG } from './blackforestSource.js';
const attrs = new Set(['atk','def','max_hp','magic_resistance','attack_speed','hp_recovery_per_sec','hp_recovery_per_sec_by_max_hp_ratio','cost']);
function supported(b) {
  const p=b.params;
  if (['char_attribute_mul','char_attribute_add'].includes(b.key)) return Object.keys(p).every(k=>k.startsWith('selector.')||attrs.has(k));
  if (b.key==='immediate_reward') return p.count>0 && /^(rogue_6_(population|gold|shield|hp|hpmax)|rogue_6_(recruit|upgrade)_ticket_.*)$/.test(p.id);
  if (b.key==='global_buff_stack') return ['modify_sp_recover[normal]','modify_sp[born]'].includes(p.key);
  if (b.key==='global_buff_stack_base_one') return /^enemy_damage_scale\[(phy|mag|pure)\]$/.test(p.key);
  if (b.key==='char_skill_cost_mul' || b.key==='level_init_cost_add' || b.key==='level_char_limit_add' || b.key==='next_recruit_upgrade_char_buff') return true;
  if (b.key==='layer_char_attribute_add') return p.stack_by_res==='rogue_6_gold';
  return false;
}
export const BASE_RELICS = Object.freeze(BLACKFOREST_CATALOG.filter(r=>r.buffs.length && r.buffs.every(supported)));
// Explicit adapter values for the fourteen single-operator recruitment relics.
export const ASSIGN_DEFAULTS = {
  1:{atkPerCast:0.1,maxCasts:6}, 2:{resPerHit:5,resCap:25}, 3:{revives:1},
  4:{spOnHit:2},5:{defIgnorePct:0.5},6:{spOnHeal:2},7:{redeployMul:0.5},
  8:{interval:0.2,duration:0.3,defMul:0.6,resMul:0.6},9:{aspd:50},
  10:{aspd:50,atkPct:1},11:{atkPct:0.5},12:{aspd:-50,atkPct:1.2},
  13:{spCostMul:0.8},14:{interval:3,sp:1}
};
export function assignDefaults(id) { return ASSIGN_DEFAULTS[Number(id.match(/_assign_(\d+)$/)?.[1])] || {}; }
export function editableRelicParams(r) {
  return r.buffs.flatMap((b,i)=>Object.entries(b.params).filter(([k,v])=>typeof v==='number' && !k.startsWith('selector.') && !(b.key==='immediate_reward' && /ticket/.test(b.params.id))).map(([k,v])=>({path:`${i}.${k}`,value:v,key:b.key,param:k})));
}
export function relicParamBounds(key) {
  if (['stack_by_res_cnt','interval','duration'].includes(key)) return [0.01,10000];
  if (['revives','maxCasts'].includes(key)) return [1,100];
  if (['defIgnorePct'].includes(key)) return [0,1];
  if (['scale','damage_scale','defMul','resMul','redeployMul','spCostMul'].includes(key)) return [0,100];
  return [-10000,10000];
}
export function tunedRelics(config) {
  return BASE_RELICS.map(source=>{
    const r=structuredClone(source), edit=config?.relics?.[r.id];
    r.tuningParams={};
    for(const {path} of editableRelicParams(source)) if(edit?.params && Object.hasOwn(edit.params,path)) {
      const [index,key]=path.split('.');if(r.buffs[index].params[key]!==edit.params[path]) r.tuningParams[path]=edit.params[path];r.buffs[index].params[key]=edit.params[path];
    }
    r.adapter={...assignDefaults(r.id),...edit?.adapter};
    return r;
  });
}
export function relicWeight(id,config) {return config?.relics?.[id]?.weight ?? 1;}
// 配置中的 weight 表示稀有度抑制值：值越大，实际抽取概率越小。
export function relicSelectionWeight(id,config) {
  const weight = Number(relicWeight(id,config));
  return weight > 0 ? 1 / weight : 0;
}
export function relicTier(r) { return ({ NORMAL: 1, RARE: 2, SUPER_RARE: 3 }[r?.rarity] || 1); }
export function relicTierProbabilities(config) {
  const values = Array.isArray(config?.relicProbabilities) ? config.relicProbabilities : [40,30,20,5,5];
  return values.length === 5 && values.some(v => Number(v) > 0) ? values.map(v => Math.max(0, Number(v) || 0)) : [40,30,20,5,5];
}
export function relicDrops(coins,config) {return config?.relicDrops?.[Math.min(5,coins)] ?? (coins<=2?1:coins===3?2:3);}
