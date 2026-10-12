import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec,checkInvariants} from '../helpers/battleHarness.js';
import {unitTuple} from '../../server/sim/snapshot.js';
const G='chess_char_5_13_a';
function setup(){
 const h=makeBattle({autoFinish:false,timeLimit:60,defs:{chess:{devourer_a:chessRec({id:'devourer_a',bonds:['egirShip'],stats:{maxHp:100000,atk:100,def:0,blockCnt:2}})}},
 units:[{uid:1,chessId:'devourer_a',row:10,col:3,dir:'RIGHT'},{uid:2,chessId:G,row:10,col:4,dir:'RIGHT',skillIndex:1,carryState:{sp:7}},{uid:3,chessId:'devourer_a',row:11,col:3,dir:'RIGHT'}],
 bonds:{egirShip:{count:3,active:true,tier:1,layers:0}}});h.step();return {h,g:h.unit(2)};
}
test('devoured Specter shows a draining substitute bar while actual skill SP remains held, then restores SP display',()=>{
 const {h,g}=setup();assert.ok(g.alive&&g.trait.doll,'devour triggers substitute');
 assert.ok(h.eventsOf('fx').some(e=>e[1]==='devour'&&e[4]?.id===g.id));
 const sp=g.skill.sp;const first=unitTuple(g,h.b.time);h.run(10);const mid=unitTuple(g,h.b.time);
 assert.equal(g.skill.sp,sp,'substitute blocks real SP gain');
 assert.ok(mid[5]<first[5],'display timer drains during substitute');
 assert.equal(first[6],21);assert.ok(mid[5]>10&&mid[5]<12);
 // Reconnecting gets the remaining timer from a fresh snapshot, without needing the original FX event.
 assert.equal(h.b.snapshot().units.find(x=>x[0]===g.id)[5],mid[5]);
 h.run(12);assert.equal(g.trait.doll,false);const normal=unitTuple(g,h.b.time);
 assert.equal(normal[5],Math.round(g.skill.sp*10)/10);assert.equal(normal[6],g.skill.spCost);
 checkInvariants(h.b);assert.deepEqual(h.b.errors,[]);
});
