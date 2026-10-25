import { RELICS, RELICS_BY_ID, RELIC_KEY, relicItemId } from '../../../shared/blackforestRelics.js';
import { passiveBuff } from './support/index.js';


export function registerMeta(reg) {
  for(const r of RELICS) reg.register(`item:${relicItemId(r.id)}`,{onEquip(ctx,ev){
    if(!ctx.useBlackforest(ev.item)) {ev.error='BAD_TARGET';ev.detail='no same-tier recruit or mode unavailable';}
  }});
}
const flat={atk:'atkFlat',def:'defFlat',max_hp:'hpFlat',magic_resistance:'resFlat',attack_speed:'aspd',hp_recovery_per_sec:'hpRegen',hp_recovery_per_sec_by_max_hp_ratio:'hpRegenRatio'};
const pct={atk:'atkPct',def:'defPct',max_hp:'hpPct'};
function matches(u,p) {
  const profession=p['selector.profession'];
  if(profession && !profession.toUpperCase().split('|').includes(u.def.profession)) return false;
  const sub=p['selector.sub_profession'];
  if(sub && !sub.split('|').includes(u.def.subProfession)) return false;
  const tile=p['selector.buildable'];
  return !tile || u.def.position===tile.toUpperCase();
}
export function install(b) {
  const entries=[];
  for(const ps of b.players) for(const ref of ps.playerEffects||[]) {
    const r=ref.key===RELIC_KEY && RELICS_BY_ID[ref.params?.relicId];
    if(r) entries.push({ps,ref,r});
  }
  for(const {ps,ref,r} of entries) {
    const key=ref.id, bound=ref.params?.boundUid;
    const own=u=>u?.side==='ally' && u.ownerId===ps.playerId && (bound==null || u.uid===bound);
    const chosen=u=>own(u) && u.kind==='op';
    for(const effect of r.buffs) {
      const p=effect.params;
      if(effect.key==='level_init_cost_add') ps.dp=Math.min(b.flags.dpMax,ps.dp+p.value);
      if(effect.key==='global_buff_stack_base_one') {
        const mod={phy:'physTakenMul',mag:'artsTakenMul',pure:'trueTakenMul'}[p.key.match(/\[(.+)\]/)?.[1]];
        b.on('enemySpawn',({enemy})=>{if(mod) passiveBuff(b,enemy,key,{[mod]:p.damage_scale});});
      }
      const applied=new WeakSet();
      const applyUnit=u=>{
          if(!own(u) || !matches(u,p) || applied.has(u)) return;
          applied.add(u);
          const mods={};
          if(effect.key==='char_attribute_mul' || effect.key==='char_attribute_add') {
            const mul=effect.key==='char_attribute_mul';
            for(const [attr,n] of Object.entries(p)) {
              if(attr==='cost') u.base.cost=Math.max(0,mul?u.base.cost*(1+n):u.base.cost+n);
              else if((mul?pct:flat)[attr]) mods[(mul?pct:flat)[attr]]=n;
            }
          }
          if(effect.key==='global_buff_stack' && p.key==='modify_sp_recover[normal]' && u.skill?.spType==='time') mods.spRecoveryFlat=p.sp_recovery_per_sec;
          if(effect.key==='char_skill_cost_mul' && u.skill) u.skill.spCostMul*=p.scale;
          if(effect.key==='layer_char_attribute_add') mods.aspd=p.attack_speed*Math.floor((ps.input.blackforestSpent||0)/p.stack_by_res_cnt);
          if(Object.keys(mods).length) passiveBuff(b,u,`${key}:${r.buffs.indexOf(effect)}`,mods);
      };
      b.on('battleStart',()=>{for(const u of b.allyUnits) applyUnit(u);});
      b.on('deploy',({unit})=>applyUnit(unit));
      if(effect.key==='global_buff_stack' && p.key==='modify_sp[born]') b.on('deploy',({unit})=>{
        if(own(unit) && matches(unit,p)) unit.skill?.gainSp(p.sp);
      });
    }
    // Recruitment effects are attached to a single piece UID, including after a merge.
    const n=bound==null?0:Number(r.id.match(/_assign_(\d+)$/)?.[1]);
    if(!n) continue;
    const a=r.adapter;
    let casts=0, revived=0, deployed=0;
    b.on('battleStart',()=>{for(const u of b.allyUnits) if(chosen(u)) {
      const mods={};
      if(n===5) mods.defIgnorePct=a.defIgnorePct;
      if(n===7) mods.redeployMul=a.redeployMul;
      if(n===9 || n===10) mods.aspd=a.aspd;
      if(n===10) {mods.atkPct=a.atkPct;if(u.skill) u.skill.noSkill=true;}
      if(n===11) mods.atkPct=a.atkPct;
      if(n===12) {mods.aspd=a.aspd;mods.atkPct=a.atkPct;}
      if(n===13 && u.skill) {u.skill.spCostMul*=a.spCostMul;u.skill.setTrigger('SP_FULL');}
      passiveBuff(b,u,key,mods);
    }});
    if(n===11) b.on('deploy',({unit})=>{if(chosen(unit) && ++deployed>1) b.removeBuff(unit,key);});
    if(n===1) b.on('skillStart',({unit})=>{if(chosen(unit)) passiveBuff(b,unit,key,{atkPct:a.atkPerCast*Math.min(a.maxCasts,++casts)});});
    if(n===2) b.on('hit',({source,target,dmg})=>{if(chosen(source) && target.side==='enemy' && dmg?.isAttack) {
      const old=target.findBuff(key);passiveBuff(b,target,key,{resFlat:-Math.min(a.resCap,a.resPerHit-(old?.mods.resFlat||0))});
    }});
    if(n===3) b.on('fatal',e=>{if(chosen(e.unit) && revived<a.revives){revived++;e.prevented=true;e.unit.hp=e.unit.s.maxHp;}});
    if(n===4) b.on('damaged',({target,dmg,amount})=>{if(chosen(target) && amount>0 && dmg?.isAttack) target.skill?.gainSp(a.spOnHit);});
    if(n===6) b.on('heal',({source,target,opts})=>{if(chosen(source) && !opts.regen) target.skill?.gainSp(a.spOnHeal);});
    if(n===8 || n===14) b.every(a.interval,()=>{
      for(const u of b.allyUnits) if(chosen(u) && u.alive && u.deployed) {
        if(n===14) for(const a of b.alliesInGrid(u)) a.skill?.gainSp(r.adapter.sp);
        else for(const e of b.unitsInGrid(u)) {b.addBuff(e,{key,duration:a.duration,mods:{defMul:a.defMul,resMul:a.resMul}});}
      }
    });
  }
}
