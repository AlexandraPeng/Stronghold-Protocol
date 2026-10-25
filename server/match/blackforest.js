import { UNITE_TUNING } from '../../shared/uniteTuning.js';
import { relicSelectionWeight } from '../../shared/relicTuning.js';
import { RELICS, RELIC_KEY, relicOfItem, relicItemId, recruitment, adaptedDescription } from '../../shared/blackforestRelics.js';
import { createRng, deriveSeed } from '../sim/rng.js';
import { addPersonalShield } from './personalShield.js';

export function bindRelic(ps, r, uid, token) {
  ps.effects.push({id:`blackforest:${token}`,key:RELIC_KEY,name:r.name,desc:adaptedDescription(r),
    iconKind:'item',iconId:relicItemId(r.id),battle:true,params:{relicId:r.id,...(uid!=null?{boundUid:uid}:{})}});
  ps.dirty();
}

/** Consume only after a valid same-tier offer has been constructed. No fallback to a different tier. */
export function useRelic(ps,item) {
  const r=relicOfItem(item.id);
  if (!ps.m.uniteStacking || !r) return false;
  const recruit=recruitment(r);
  if (recruit) {
    const ids=[];
    for(let i=0;i<3;i++) {
      const id=ps.m.pool.roll(ps.m.rngShop,{tier:ps.shop.level,extra:ps.diyStockEntries(),filter:id=>{
        const c=ps.gd.chess(id);
        return !!c && !ids.includes(id) && (!recruit.profession || c.profession?.toLowerCase()===recruit.profession)
          && (!recruit.elite || !!ps.gd.goldenIdOf(id));
      }});
      if(id) ids.push(id);
    }
    if(!ids.length) return false;
    const offer=ps.pushRewardOffer('blackforest',{ids:ids.map(id=>recruit.elite?ps.gd.goldenIdOf(id):id),tier:ps.shop.level,label:r.name});
    if(!offer) return false;
    for(const s of offer.slots) s.price=0;
    if(recruit.bind) offer.blackforest={relicId:r.id,token:item.uid};
  } else {
    for(const b of r.buffs) {
      const p=b.params;
      if(b.key==='immediate_reward') {
        if(['rogue_6_population','rogue_6_gold'].includes(p.id)) ps.addFunds(p.count,{reason:'blackforest'});
        if(p.id==='rogue_6_shield') addPersonalShield(ps,p.count);
        // Objective LP has no separate heal cap in this mode; max-HP gains raise its current pool.
        if(['rogue_6_hpmax','rogue_6_hp'].includes(p.id)) ps.lp+=p.count;
      }
      if(b.key==='level_char_limit_add') ps.deployCapBonus+=p.value;
    }
    bindRelic(ps,r,null,item.uid);
  }
  ps.dirty();
  return true;
}

/** Queue earned loot until there is a regular bench slot. Overflow is never discarded by prep's temp cleanup. */
export function deliverRelics(ps) {
  if(!ps.m.uniteStacking) return;
  while(ps.relicQueue?.length && ps.hand.some(p=>!p)) {
    const id=ps.relicQueue.shift();
    if(!ps.acquireItem(id,{source:'blackforest',requirePool:false})) {ps.relicQueue.unshift(id);break;}
  }
  ps.dirty();
}

/** Server-produced kill receipts, once per round/card across normal + support fields. */
export function settleRelics(m,ps,...results) {
  if(!m.uniteStacking) return;
  m._paidRelics ??= new Set();
  for(const result of results) {
    if(!result || result.synthetic) continue;
    for(const kill of result.relicKills || []) {
      const key=`${m.round}:${kill.id}`;
      if(m._paidRelics.has(key) || !Number.isInteger(kill.count) || kill.count<1 || kill.count>3) continue;
      m._paidRelics.add(key);
      const rng=createRng(deriveSeed(m.seed,`blackforest:${key}`));
      ps.relicQueue ??= [];
      for(let i=0;i<kill.count;i++) ps.relicQueue.push(relicItemId(rng.weighted(RELICS,r=>relicSelectionWeight(r.id,UNITE_TUNING)).id));
    }
  }
  deliverRelics(ps);
}
