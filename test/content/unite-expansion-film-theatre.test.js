import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expansionArena, pinEnemy } from '../helpers/uniteExpansionHarness.js';
import { UNITE_FILM_KITS } from '../../server/sim/content/enemies/uniteExpansion/film.js';
import { UNITE_THEATRE_KITS } from '../../server/sim/content/enemies/uniteExpansion/theatre.js';
const KITS={...UNITE_FILM_KITS,...UNITE_THEATRE_KITS};
const arena=opts=>expansionArena(KITS,opts);
test('recorder: new kit replaces the legacy kit, adds 20% neural only outside the filming region',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_10094_crstf'),u=h.unit('wall');
  h.b.dealDamage(e,u,{amount:1,type:'true',isAttack:true});assert.equal(u.elem.neural,70);
  h.b.flags.filmingZones=[{r0:9,r1:12,c0:0,c1:10}];h.b.dealDamage(e,u,{amount:1,type:'true',isAttack:true});assert.equal(u.elem.neural,70);
});
test('WW09 and WW11: filming enables enemy-on-enemy targeting, hero range +2, villain double attack and 5x opposing-actor damage',()=>{
  const h=arena({flags:{filmingZones:[{r0:9,r1:12,c0:0,c1:10}]}});
  const hero=pinEnemy(h,'enemy_10098_crhro',[9,8]),villain=pinEnemy(h,'enemy_10099_crvln',[9,9]);
  h.run(1);assert.equal(hero.profile.rangeRadius,hero.base.rangeRadius+2);assert.ok(hero.profile.blockFree);
  h.run(6);assert.ok(h.hooksOf('damaged').some(c=>c.source===hero&&c.target===villain));
  assert.ok(h.hooksOf('damaged').some(c=>c.source===villain&&c.target===hero));
  h.b.kill(hero);assert.ok(hero.alive);h.run(3.1);assert.equal(hero.hp,hero.s.maxHp);h.b.kill(hero);assert.equal(hero.alive,false);
  assert.equal(h.b.errorCount,0);
});
test('designer: an active camera in front reverses its directional guard only inside filming regions',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_10097_crshd'),u=h.unit('wall');h.step();
  const first=h.b.dealDamage(u,e,{amount:2000,type:'phys',canDodge:false});
  h.b.flags.filmingZones=[{r0:9,r1:12,c0:0,c1:10}];h.b.flags.filmingCameras=[{x:4,y:9}];h.step();
  const second=h.b.dealDamage(u,e,{amount:2000,type:'phys',canDodge:false});assert.ok(second>first*4.9);assert.equal(h.b.errorCount,0);
});
test('spear thrower: first missed shot restricts it to its blocker and permanently changes weapon',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_10155_mntjsd'),u=h.unit('wall');
  h.b.addBuff(u,{key:'test:dodge',persist:true,mods:{dodgePhys:1}});
  h.b.dealDamage(e,u,{amount:1000,type:'phys',isAttack:true});assert.equal(e.profile.melee,true);h.step();assert.equal(e.form,'melee');
});
test('apprentice: death heals allies by 500% ATK, silence disables it and leaking never heals',()=>{
  for(const mode of ['killed','silenced','leak']){
    const h=arena(),e=pinEnemy(h,'enemy_10156_mncrer_2'),target=pinEnemy(h,'enemy_10155_mntjsd');target.hp=1;
    if(mode==='silenced')h.b.applyStatus(e,'silence',{duration:5});
    if(mode==='leak')h.b.leak(e);else h.b.kill(e);
    assert.equal(target.hp,mode==='killed'?1801:1);assert.equal(h.b.errorCount,0);
  }
});
test('catapult: three independent projectile splashes, including after the shooter dies',()=>{
  const h=arena(),e=pinEnemy(h,'enemy_10162_mnctpt_2'),u=h.unit('wall');
  h.b.emit('attack',{attacker:e,targets:[u],isSkill:false});assert.equal(h.b.projectiles.list.length,3);h.b.kill(e);h.run(1);
  assert.equal(h.hooksOf('damaged').filter(c=>c.source===e&&c.target===u).length,3);assert.equal(h.b.errorCount,0);
});
