import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expansionArena, pinEnemy } from '../helpers/uniteExpansionHarness.js';
import { UNITE_ELEMENT_KITS } from '../../server/sim/content/enemies/uniteExpansion/elements.js';
import { elementView } from '../../server/sim/damage.js';
const arena=()=>expansionArena(UNITE_ELEMENT_KITS);
test('mania: gauge can be healed, bursts increase ASPD by 50, tick true damage and lock every element',()=>{
  const h=arena(),u=h.unit('wall');h.b.dealDamage(null,u,{type:'element',element:'mania',amount:300});
  assert.equal(elementView(u,h.b.time)[0],'mania');assert.equal(h.b.reduceElement(u,100),100);assert.equal(u.elem.mania,200);
  h.b.dealDamage(null,u,{type:'element',element:'mania',amount:800});assert.equal(u.s.aspd,150);
  h.b.dealDamage(null,u,{type:'element',element:'burn',amount:1000});assert.equal(u.elem.burn,0);
  const hp=u.hp;h.run(1.1);assert.equal(hp-u.hp,150);h.run(14.1);assert.equal(u.s.aspd,100);assert.equal(u.elem.mania,0);
  h.b.dealDamage(null,u,{type:'element',element:'mania',amount:1000});const hp2=u.hp;h.run(1.1);assert.equal(hp2-u.hp,200);
  assert.equal(h.b.errorCount,0);
});
test('mania: enemy burst has no extra damage or ASPD, and an operator caps at 600 damage per second',()=>{
  const h=arena(),u=h.unit('wall'),e=pinEnemy(h,'enemy_2136_shcolo');const hp=e.hp;
  h.b.dealDamage(u,e,{type:'element',element:'mania',amount:2000});h.run(1.1);assert.equal(e.hp,hp);assert.equal(e.s.aspd,100);
  u.mem.maniaBursts=999;h.b.dealDamage(null,u,{type:'element',element:'mania',amount:1000});const start=u.hp;h.run(1.1);assert.equal(start-u.hp,600);
});
test('water: taking damage blinks backward two reachable tiles, grants protection and starts 10-second cooldown',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_2134_shrshep',[9,7]);h.b.dealDamage(h.unit('wall'),e,{amount:1,type:'true'});
  assert.equal(e.x,9);assert.ok(e.s.flags.invulnerable);h.run(1.1);
  h.b.dealDamage(h.unit('wall'),e,{amount:1,type:'true'});assert.equal(e.x,9);assert.equal(h.b.errorCount,0);
});
test('earth: four-block requirement, one layer for ten HP damage hits, own bleed never feeds its counter',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_2136_shcolo'),u=h.unit('wall');assert.equal(e.blockWeight,4);
  for(let i=0;i<10;i++)h.b.dealDamage(u,e,{amount:1,type:'true'});
  const hp=e.hp;h.run(10.1);assert.equal(hp-e.hp,3000);
  const kit=e.mem.ab.list.find(a=>a.layers!=null);assert.equal(kit.layers,1);assert.equal(kit.hits,10);assert.equal(h.b.errorCount,0);
});
test('dog: sustained bite applies nonstacking accuracy loss, ignores control and returns to its original tile',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_2137_shsdgo',[9,6]),u=h.unit('wall');h.run(15.2);
  assert.equal(e.x,5);assert.equal(h.b.applyStatus(e,'stun',{duration:20}),false);h.run(1.1);
  assert.equal(u.s.accuracyPhys,.2);assert.equal(u.s.accuracyArts,.2);h.run(9);
  assert.equal(e.x,6);h.run(1.6);assert.equal(u.s.accuracyPhys,1);assert.equal(h.b.errorCount,0);
});
test('accuracy multiplier: a source with zero accuracy misses independently of target dodge',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_2136_shcolo'),u=h.unit('wall');
  h.b.addBuff(u,{key:'test:accuracy',mods:{accuracyPhysMul:0,accuracyArtsMul:0},persist:true});
  const hp=e.hp;for(const type of ['phys','arts'])h.b.dealDamage(u,e,{amount:10000,type,canDodge:true});assert.equal(e.hp,hp);
  h.b.dealDamage(u,e,{amount:100,type:'true'});assert.equal(e.hp,hp-100);assert.equal(h.b.errorCount,0);
});
