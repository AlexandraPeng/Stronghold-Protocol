import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch, DATA } from './harness.js';
import { RELICS, RELICS_BY_ID, relicItemId } from '../../shared/blackforestRelics.js';
import { settleRelics, deliverRelics, bindRelic } from '../../server/match/blackforest.js';

const rid=n=>`rogue_6_relic_${n}`;
function setup(custom=true){const h=makeMatch({mode:'coop',uniteStacking:custom,humans:2,fake:true}).start();h.toPrep(1);const ps=h.m.alivePlayers()[0];const id=Object.values(DATA.chess).find(c=>!c.isGolden&&!c.isDiy).chessId;const unit=ps.acquireChess(id);return {h,ps,unit};}
test('relics consume into persistent effects, funds and personal shield; ordinary modes refuse them',()=>{
 for(const custom of [true,false]){const {h,ps,unit}=setup(custom);try{
   for(const [name,prop,delta] of [['legacy_45','funds',4],['legacy_48','lpShield',4]]){
    const before=ps[prop]||0, item=ps.acquireItem(relicItemId(rid(name)));
    const result=ps.equip(item.uid,unit.uid);
    assert.equal(!!result.ok,custom);assert.equal(ps[prop]||0,before+(custom?delta:0));
    assert.equal(!!ps.find(item.uid),!custom);
   }
 }finally{h.m.dispose();}}
});
test('loot quantities deduplicate phase receipts, mix rarities and preserve full-bench rewards',()=>{
 const {h,ps}=setup();try{
   const ids=[];for(let i=0;i<30;i++) ids.push({id:`b${i}`,count:i%3+1});
   ps.hand=Array.from({length:20},(_,i)=>({kind:'item',id:relicItemId(RELICS[0].id),uid:90000+i,items:[]}));
   settleRelics(h.m,ps,{relicKills:ids});assert.equal(ps.relicQueue.length,60);
   settleRelics(h.m,ps,{relicKills:ids});assert.equal(ps.relicQueue.length,60);
   assert.ok(new Set(ps.relicQueue.map(id=>RELICS_BY_ID[id.replace('blackforest_','')].rarity)).size>=3);
   ps.hand[19]=null;deliverRelics(ps);assert.equal(ps.relicQueue.length,59);assert.ok(ps.hand[19]);
   assert.equal(ps.privateView().pendingRelics,59);
 }finally{h.m.dispose();}
});
test('special recruit is free, exactly current shop tier, binds only the selected piece and survives prep deadline',()=>{
 const {h,ps,unit}=setup();try{
   ps.shop.level=3;const item=ps.acquireItem(relicItemId(rid('assign_9')));
   assert.equal(ps.equip(item.uid,unit.uid).ok,true);
   const offer=ps.offers.find(o=>o.source==='blackforest');assert.ok(offer);
   assert.ok(offer.slots.every(s=>ps.gd.chess(s.id).tier===3 && s.price===0));
   ps.endPrep();assert.ok(ps.offers.includes(offer));ps.ready=false;
   const prior=ps.effects.length;assert.equal(ps.pickReward(0).ok,true);
   assert.equal(ps.effects.length,prior+1);const ref=ps.effects.at(-1);
   assert.ok(ps.find(ref.params.boundUid));assert.notEqual(ref.params.boundUid,unit.uid);
 }finally{h.m.dispose();}
});
test('promotion recruitment offers elite operators of the matching profession and level',()=>{
 const {h,ps,unit}=setup();try{
   const c=Object.values(DATA.chess).find(c=>c.profession==='PIONEER'&&!c.isGolden&&!c.isDiy);
   ps.shop.level=c.tier;
   const item=ps.acquireItem(relicItemId(rid('assign_1')));
   assert.equal(ps.equip(item.uid,unit.uid).ok,true);
   const offer=ps.offers.find(o=>o.source==='blackforest');
   assert.ok(offer.slots.every(s=>{const c=ps.gd.chess(s.id);return c.isGolden&&c.profession==='PIONEER'&&c.tier===ps.shop.level;}));
 }finally{h.m.dispose();}
});
test('bound effects follow the surviving elite on merge and never spread to other copies',()=>{
 const {h,ps,unit}=setup();try{
   bindRelic(ps,RELICS_BY_ID[rid('assign_9')],unit.uid,'merge');
   const count=ps.gd.mergeCount(unit.id);let elite;
   for(let i=1;i<count;i++) elite=ps.acquireChess(unit.id);
   assert.equal(ps.gd.isGolden(elite.id),true);
   assert.equal(ps.effects.find(e=>e.id==='blackforest:merge').params.boundUid,elite.uid);
 }finally{h.m.dispose();}
});

test('six seats use server authority and complete a real custom-mode round with consistent views',()=>{
 const h=makeMatch({mode:'coop',uniteStacking:true,humans:6,fake:false,seed:113,clientCombat:true}).start();
 try {
   h.toPrep(1);assert.equal(h.m.clientCombat,false);
   for(const ps of h.m.alivePlayers()) assert.equal(ps.hand.length,20);
   h.toPrep(2);
   assert.equal(h.m.errorCount,0,JSON.stringify(h.logs.error));
   for(const ps of h.m.alivePlayers()) {
     assert.equal(ps.privateView().hand.length,20);
     assert.equal(ps.personalChoice.cards.length,9);
   }
 } finally {h.m.dispose();}
});


test('temporary advanced recruitment stays elite while following the current shop tier',()=>{
 const {h,ps,unit}=setup();try{
   ps.shop.level=2;
   const item=ps.acquireItem(relicItemId(rid('legacy_132')));
   assert.equal(ps.equip(item.uid,unit.uid).ok,true);
   const offer=ps.offers.find(o=>o.source==='blackforest');
   assert.ok(offer.slots.length);
   assert.ok(offer.slots.every(s=>ps.gd.chess(s.id).isGolden&&ps.gd.chess(s.id).tier===2));
 }finally{h.m.dispose();}
});
