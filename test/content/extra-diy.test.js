import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, checkInvariants } from '../helpers/battleHarness.js';
import { diyPool } from '../../shared/diy.js';
import { KITTED_CHARS } from '../../server/sim/content/kits/index.js';
import { normalizeSnapshot } from '../../public/js/render/interp.js';
const data=Object.fromEntries(['chess','backups'].map(k=>[k,JSON.parse(readFileSync(new URL(`../../data/${k}.json`,import.meta.url)))]));
const choices={char_4217_makoto:['emptyShip','lateranoShip'],char_4182_oblvns:['emptyShip'],char_4231_clemnt:['emptyShip','egirShip']};
for(const [charId,bonds] of Object.entries(choices)) for(const tier of [5,6]) for(const elite of [false,true]) for(const skillIndex of [0,1,2]) {
 test(`${charId}: tier ${tier}, elite ${elite}, skill ${skillIndex+1} is selectable and simulates`,()=>{
  assert.ok(diyPool(tier,{data,kitted:KITTED_CHARS}).includes(charId));
  assert.deepEqual(data.backups.diy.operators[charId].bonds,bonds);
  const h=makeBattle({autoFinish:false,units:[{uid:1,chessId:`chess_char_${tier}_diy1_${elite?'b':'a'}`,diy:{charId,skillIndex},row:10,col:3}]});
  h.step();const u=h.unit(1);assert.equal(u.def.charId,charId);u.skill.gainSp(999,'init');u.skill.activate('test');h.run(24);
  checkInvariants(h.b);assert.deepEqual(h.b.errors,[]);
 });
}
test('Fever snapshot coexists with element gauges and clamps malformed values',()=>{
 const n=normalizeSnapshot({t:2,units:[[1,2,3,100,100,0,10,0,0]],elem:[[1,'erosion',0.5,500,3]],fever:[[1,999,99]]});
 assert.equal(n.units.get(1)[9],'erosion');assert.equal(n.units.get(1)[13],450);assert.equal(n.units.get(1)[14],20);
});
