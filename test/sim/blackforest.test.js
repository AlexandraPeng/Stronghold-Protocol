import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec } from '../helpers/battleHarness.js';
import { RELICS, RELIC_KEY } from '../../shared/blackforestRelics.js';
const effect=(id,uid=null)=>({id:`relic:${id}`,key:RELIC_KEY,params:{relicId:`rogue_6_relic_${id}`,...(uid==null?{}:{boundUid:uid})}});
function battle(refs){return makeBattle({playerEffects:refs,units:[{chessId:'t_a',uid:1,row:9,col:3},{chessId:'t_a',uid:2,row:10,col:3}],defs:{chess:{t_a:chessRec({id:'t_a',profession:'PIONEER',stats:{atk:100,def:100,maxHp:1000,cost:0}})},enemies:{t_e:enemyRec({id:'t_e',stats:{maxHp:10000,def:0,res:0,atk:10}})}},kits:{t_a:()=>({skill:{kind:'instant',spType:'time',spCost:100,trigger:'NEVER'}})}});}
test('structured stats and automatic SP affect both own operators; bound attack speed affects only its recruit',()=>{
 const h=battle([effect('legacy_12'),effect('legacy_2'),effect('assign_9',1)]);h.step();
 assert.ok(Math.abs(h.unit(1).s.def-115)<1e-6);assert.ok(Math.abs(h.unit(2).s.def-115)<1e-6);
 assert.equal(h.unit(1).s.aspd,h.unit(2).s.aspd+50);
 const before=h.unit(1).skill.sp;h.run(2);assert.ok(Math.abs(h.unit(1).skill.sp-before-2.4)<0.01);
 assert.equal(h.b.errorCount,0);
});
test('every enabled relic can enter and run a battle without silent content errors',()=>{
 for(const r of RELICS){const h=battle([{id:r.id,key:RELIC_KEY,params:{relicId:r.id,...(r.id.includes('_assign_')?{boundUid:1}:{})}}]);h.run(4);assert.equal(h.b.errorCount,0,r.id);}
});
test('bounty receipts require an actual kill and never copy from ordinary enemies',()=>{
 const h=battle([]);h.step();const e=h.spawn('t_e',{mods:{bountyId:'round1',relicCount:3},bounty:{coins:5,ownerPlayerId:'p1'}});
 h.b.dealDamage(h.unit(1),e,{amount:1e9,type:'true'});
 assert.deepEqual(h.result().perPlayer.p1.relicKills,[{id:'round1',count:3}]);
 h.b.dealDamage(h.unit(1),e,{amount:1e9,type:'true'});assert.equal(h.result().perPlayer.p1.relicKills.length,1);
 const ordinary=h.spawn('t_e');h.b.dealDamage(h.unit(1),ordinary,{amount:1e9,type:'true'});
 assert.equal(h.result().perPlayer.p1.relicKills.length,1);
});
test('recruited vanguard stacks, medic SP, guard revival and sniper ignore are bound mechanics',()=>{
 const h=battle([effect('assign_1',1),effect('assign_3',1),effect('assign_5',1)]);h.step();
 for(let i=0;i<10;i++) h.b.emit('skillStart',{unit:h.unit(1),skill:h.unit(1).skill});
 assert.equal(h.unit(1).s.atk,160);assert.equal(h.unit(2).s.atk,100);
 assert.equal(h.unit(1).s.defIgnorePct,0.5);
 h.b.dealDamage(null,h.unit(1),{amount:1e9,type:'true'});assert.equal(h.unit(1).alive,true);assert.equal(h.unit(1).hp,h.unit(1).s.maxHp);
 h.b.dealDamage(null,h.unit(1),{amount:1e9,type:'true'});assert.equal(h.unit(1).alive,false);
 assert.equal(h.b.errorCount,0);
});


test('late summons receive global stats once; repeated deployment does not multiply costs or skill requirements',()=>{
 const h=battle([effect('legacy_12')]);h.step();
 const token=h.b.spawnToken(h.unit(1),'test_token',11,4,{def:{stats:{maxHp:1000,atk:50,def:100},rangeGrid:[[0,0]]}});
 assert.ok(token);assert.ok(Math.abs(token.s.def-115)<1e-6);
 h.b.emit('deploy',{unit:token,initial:false});assert.ok(Math.abs(token.s.def-115)<1e-6);
 const unit=h.unit(1),cost=unit.base.cost,sp=unit.skill.spCostMul;
 h.b.emit('deploy',{unit,initial:false});assert.equal(unit.base.cost,cost);assert.equal(unit.skill.spCostMul,sp);
 assert.equal(h.b.errorCount,0);
});

test('bound recruit bonuses grant SP to healed or damaged units and cap caster resistance reduction',()=>{
 const h=battle([effect('assign_2',1),effect('assign_4',1),effect('assign_6',1),effect('assign_7',1)]);h.step();
 const u=h.unit(1),v=h.unit(2),enemy=h.spawn('t_e');
 u.skill.sp=0;h.b.emit('damaged',{target:u,amount:1,dmg:{isAttack:true}});assert.equal(u.skill.sp,2);
 v.skill.sp=0;h.b.emit('heal',{source:u,target:v,opts:{regen:false}});assert.equal(v.skill.sp,2);
 h.b.emit('heal',{source:u,target:v,opts:{regen:true}});assert.equal(v.skill.sp,2);
 for(let i=0;i<10;i++) h.b.emit('hit',{source:u,target:enemy,dmg:{isAttack:true}});
 assert.equal(enemy.findBuff('relic:assign_2').mods.resFlat,-25);assert.equal(enemy.s.res,0);assert.equal(u.s.redeployMul,0.5);
 const disabled=battle([effect('assign_10',2)]);disabled.step();
 assert.equal(disabled.unit(2).skill.noSkill,true);assert.equal(disabled.unit(2).s.atk,200);
 assert.equal(h.b.errorCount,0);
});

test('zero-fund kill creates a relic receipt; leaks and repeated deaths do not',()=>{
 const h=battle([]);h.step();
 const before=h.result().perPlayer.p1.coins;assert.equal(typeof before,'number');
 const e=h.spawn('t_e',{ownerPlayerId:'p1',mods:{bountyId:'zero',relicCount:1}});
 h.b.dealDamage(h.unit(1),e,{amount:1e9,type:'true'});
 assert.deepEqual(h.result().perPlayer.p1.relicKills,[{id:'zero',count:1}]);
 assert.equal(h.result().perPlayer.p1.coins,before);
 h.b.dealDamage(h.unit(1),e,{amount:1e9,type:'true'});
 assert.equal(h.result().perPlayer.p1.relicKills.length,1);
 const leaked=h.spawn('t_e',{ownerPlayerId:'p1',mods:{bountyId:'leaked',relicCount:1}});
 h.b.leak(leaked);
 assert.equal(h.result().perPlayer.p1.relicKills.length,1);
});

test('edited numeric and recruitment adapter parameters reach the actual battle',()=>{
 const stat=RELICS.find(r=>r.id==='rogue_6_relic_legacy_12'),bound=RELICS.find(r=>r.id==='rogue_6_relic_assign_9');
 const old=structuredClone(stat.buffs),adapter={...bound.adapter};
 try{
  stat.buffs.find(b=>b.key==='char_attribute_mul').params.def=0.5;bound.adapter.aspd=80;
  const h=battle([effect('legacy_12'),effect('assign_9',1)]);h.step();
  assert.equal(h.unit(1).s.def,150);assert.equal(h.unit(2).s.def,150);
  assert.equal(h.unit(1).s.aspd-h.unit(2).s.aspd,80);assert.equal(h.b.errorCount,0);
 }finally{stat.buffs=old;bound.adapter=adapter;}
});
