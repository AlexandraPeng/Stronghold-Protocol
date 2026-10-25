import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch } from './harness.js';
import { pairPlayers } from '../../server/match/finalAssault.js';
import { validateC2S } from '../../shared/protocol.js';
import { createRng } from '../../server/sim/rng.js';
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
  const pairs = pairPlayers(h.m.alivePlayers(), createRng(34));
  assert.equal(pairs.length, 3);
  assert.ok(pairs.every(g => g.length === 2));
  assert.deepEqual(pairs.flat().map(p => p.seat).sort(), [0,1,2,3,4,5]);
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


test('six-player stacking mode reaches all 15 prep rounds and finishes with scripted combat',()=>{
 const h=makeMatch({mode:'coop',difficulty:'ABYSS',humans:6,uniteStacking:true,fake:true,seed:34,
  script:b=>b.kind==='boss'||b.kind==='hidden'?{bossDps:1e9}:{}}).start();
 try{
  for(let round=1;round<=15;round++){
   h.toPrep(round);
   assert.equal(h.m.alivePlayers().length,6);
   for(const ps of h.m.alivePlayers()){
    assert.equal(ps.personalChoice?.kind,'roundBounty',`R${round} ${ps.playerId}`);
    assert.equal(ps.personalChoice.cards.length,9);
    assert.equal(ps.hand.length,20);
   }
   h.invariants();assert.equal(h.m.errorCount,0);
   if(round===14)for(const ps of h.m.alivePlayers()){
    ps.bondCountBonus.yanShip=3;ps.layers.yanShip=601;ps.recompute();
   }
  }
  assert.ok(h.drive(()=>h.ended!=null));
  assert.equal(h.m.errorCount,0);
 }finally{h.m.dispose();}
});
