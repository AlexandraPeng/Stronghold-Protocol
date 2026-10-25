import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expansionArena, pinEnemy } from '../helpers/uniteExpansionHarness.js';
import { UNITE_FRACTAL_KITS } from '../../server/sim/content/enemies/uniteExpansion/fractals.js';
const CHILD='enemy_2033_syboys';
const children=h=>h.b.enemies.filter(e=>e.alive&&e.defId===CHILD);
const arena=()=>expansionArena(UNITE_FRACTAL_KITS);
test('fractal: summons on the 3rd attack, inherits current HP ratio and never copies a bounty',()=>{
  const h=arena(), e=pinEnemy(h,'enemy_2031_syboy',[9,8],{bountyId:'test',bountyCoins:4}); e.hp=e.s.maxHp/2;
  for(let i=0;i<2;i++)h.b.emit('attack',{attacker:e,targets:[]}); assert.equal(children(h).length,0);
  h.b.emit('attack',{attacker:e,targets:[]}); const child=children(h)[0]; assert.ok(child); assert.equal(child.hpRatio,.5);
  assert.equal(child.mods?.bountyId,undefined); assert.equal(child.mods?.bountyCoins,undefined); assert.equal(h.b.errorCount,0);
});
test('fractal: damage counters 10/5, global cap 8, and every parent departure clears children without kills',()=>{
  for(const [key,n] of [['enemy_2031_syboy',10],['enemy_2032_syboy2',5]]){
    const h=arena(),e=pinEnemy(h,key),u=h.unit('wall');
    for(let i=0;i<n-1;i++)h.b.dealDamage(u,e,{amount:1,type:'true'});assert.equal(children(h).length,0);
    h.b.dealDamage(u,e,{amount:1,type:'true'});assert.equal(children(h).length,1);
    for(let i=0;i<100;i++)h.b.dealDamage(u,e,{amount:1,type:'true'});assert.equal(children(h).length,8);
    h.b.leak(e);assert.equal(children(h).length,0);assert.equal(h.b.killed,0);assert.equal(h.b.errorCount,0);
  }
});
test('fractal child: expires after 90 seconds without a kill or bounty settlement',()=>{
  const h=arena(),e=pinEnemy(h,CHILD);h.run(90.1);assert.equal(e.alive,false);assert.equal(e.removeReason,'expired');assert.equal(h.b.killed,0);
});
