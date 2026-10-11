import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch } from './harness.js';
import { pairPlayers } from '../../server/match/finalAssault.js';
import { validateC2S } from '../../shared/protocol.js';
import { MAX_SEATS } from '../../shared/constants.js';

test('six players pass normal combat, unite and six-card strategy draft', () => {
 const h=makeMatch({humans:6,uniteStacking:true,fake:true,seed:34,
  script:b=>b.kind==='normal'?{leaks:{p_4:1,p_5:1}}:{}}).start();
 try {
  assert.equal(MAX_SEATS,6);
  h.toPrep(1);
  assert.equal(h.m.publicView().players.length,6);
  h.toPrep(4);
  assert.equal(h.m.alivePlayers().length,6);
  assert.equal(h.m.errorCount,0);
  assert.deepEqual(pairPlayers(h.m.alivePlayers()).map(g=>g.map(p=>p.seat)),[[0,1],[2,3],[4,5]]);
  h.invariants();
 }finally{h.m.dispose();}
});
test('unite progress supports six source players while acting seat is bounded',()=>{
 assert.equal(validateC2S({t:'room.kick',seat:5,playerId:'p_5'}),null);
 assert.ok(validateC2S({t:'room.kick',seat:6,playerId:'p_6'}));
 const left=Object.fromEntries(Array.from({length:6},(_,i)=>['p_'+i,1]));
 const msg={t:'b.progress',battleId:'b',fieldId:'u',gt:1,killed:0,total:6,bossDamage:0,by:{},done:false,left};
 // Validate the actual schema fields used by the client.
 assert.equal(validateC2S(msg),null);
});
