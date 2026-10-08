import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, checkInvariants } from '../helpers/battleHarness.js';

const egir = { count: 5, active: true, tier: 2, layers: 0 };
const coords = [[9,3],[10,3],[11,3],[12,3],[9,6],[10,6]];
function setup(kind = 'normal', down = false, count = 5) {
  const ids = ['a','b','c','d','e','h'];
  const chess = Object.fromEntries(ids.map(id => [id, chessRec({id, bonds:[id === 'h' ? 'maniShip' : 'egirShip'], skill:null, stats:{maxHp:10000}})]));
  const h = makeBattle({kind,defs:{chess},autoFinish:false,timeLimit:120,hooks:['deploy','death'],
    units:ids.map((chessId,i)=>({chessId,row:coords[i][0],col:coords[i][1],dir:'RIGHT',...(down && i===0?{carryState:{down:true}}:{})})),
    bonds:{egirShip:{...egir,count,tier:count>=5?2:1},maniShip:{count:1,active:true,tier:1,layers:0}}});
  h.b.start(); return h;
}
const kill = (h,id) => {const u=h.unit(id);h.b.dealDamage(null,u,{amount:1e9,type:'true'});return u;};
for(const kind of ['normal','unite']) test(`${kind}: actual deaths get 3 slots, harmony counts, survivors reserve none, repeated death gets none`,()=>{
  const h=setup(kind);
  for(const id of ['e','h']) assert.equal(kill(h,id).alive,true,id);
  assert.equal(kill(h,'e').alive,false,'second death cannot spend another slot');
  assert.equal(kill(h,'d').alive,true,'third distinct victim revives');
  assert.equal(kill(h,'a').alive,false,'pool exhausted');
  assert.equal(h.unit('b').alive,true,'untouched member never reserved a slot');
  assert.equal(h.hooksOf('deploy').filter(c=>!c.initial).length,3);
  checkInvariants(h.b); assert.deepEqual(h.b.errors,[]);
});
test('unite: forced exit spends nothing; after redeployment its first kill can revive',()=>{
 const h=setup('unite',true);assert.equal(h.unit('a').alive,false);
 assert.equal(kill(h,'e').alive,true);assert.equal(kill(h,'h').alive,true);
 assert.equal(h.b.redeploy(h.unit('a'),{free:true}),true);
 assert.equal(kill(h,'a').alive,true);assert.equal(kill(h,'d').alive,false);
 assert.deepEqual(h.b.errors,[]);
});
test('3 members: no five-member revive',()=>{const h=setup('normal',false,3);assert.equal(kill(h,'a').alive,false);});
for(const kind of ['normal','unite']) test(`${kind}: screenshot formation revives devoured Gladia, Mizuki and Specter`,()=>{
 const layout=[['chess_char_1_04_a',9,3],['chess_char_4_12_a',9,4],['chess_char_4_09_a',9,5],['chess_char_1_15_a',10,4],['chess_char_2_07_a',10,5],['chess_char_5_05_a',11,5]];
 const h=makeBattle({kind,autoFinish:false,timeLimit:120,hooks:['deploy','death'],units:layout.map(([chessId,row,col])=>({chessId,row,col,dir:'RIGHT'})),bonds:{egirShip:{...egir,layers:46},maniShip:{count:1,active:true,tier:1,layers:0}}});
 h.b.start();
 for(const id of ['chess_char_4_12_a','chess_char_4_09_a','chess_char_2_07_a']){
  const u=h.unit(id);assert.equal(u.alive,true,id);
  assert.equal(h.hooksOf('death').filter(c=>c.unit===u&&c.reason==='killed').length,1,'pending devour marks must not kill revived target twice');
  assert.equal(h.hooksOf('deploy').filter(c=>c.unit===u&&!c.initial).length,1,id);
 }
 assert.equal(h.hooksOf('deploy').filter(c=>!c.initial).length,3);
 assert.ok(h.unit('chess_char_1_04_a').buffs.some(b=>b.key==='bond:egir:devour'));
 assert.deepEqual(h.b.errors,[]);checkInvariants(h.b);
});
