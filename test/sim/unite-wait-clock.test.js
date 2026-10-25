import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from '../helpers/battleHarness.js';
import { FieldRunner } from '../../server/match/fields.js';
test('a cleared field continues natural SP and redeployment while waiting for teammates', () => {
  const h = makeBattle({ autoFinish:true, flags:{waitForTeam:true}, timeLimit:3,
    defs:{chess:{t_a:chessRec({id:'t_a', stats:{cost:0,respawnTime:1}})}},
    units:[{chessId:'t_a',row:9,col:3}],
    kits:{t_a:()=>({skill:{kind:'instant',spType:'time',spCost:100,trigger:'NEVER'}})},
  });
  h.step();
  const u=h.unit('t_a');
  assert.equal(h.b.clearedWaiting,true);
  assert.equal(h.b.finished,false);
  const sp=u.skill.sp;
  h.run(2);
  assert.ok(u.skill.sp>sp);
  h.b.dealDamage(null,u,{amount:1e9,type:'true'});
  assert.equal(u.alive,false);
  h.run(2);
  assert.equal(u.alive,true);
  assert.ok(h.b.time>h.b.timeLimit);
  assert.equal(h.b.finished,false,'a shorter cleared wave waits past its own timeout');
  const other={finished:false,clearedWaiting:false,step(){},snapshot(){return {};} };
  const m={markPublic(){},reportError(e){assert.fail(e);}};
  const runner=new FieldRunner(m,[{battle:h.b,live:true},{battle:other,live:true}],{onDone(){},emit:false});
  runner._emit=()=>{};
  runner._tick();
  assert.equal(h.b.finished,false);
  other.finished=true;
  runner._tick();
  assert.equal(h.b.finished,true);
  assert.equal(h.b.reason,'cleared');
});
test('ordinary cleared battles still finish immediately',()=>{
  const h=makeBattle({autoFinish:true});h.step();assert.equal(h.b.finished,true);
});
