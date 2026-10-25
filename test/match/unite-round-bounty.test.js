import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA, makeMatch } from './harness.js';
import { GameData } from '../../server/match/gamedata.js';
import { roundBountyPool, grantRoundBounty, collectibleDropCount, roundBountyWeights, drawRoundBountyCards } from '../../server/match/uniteExpansion.js';
import { generateDraft } from '../../server/match/choices.js';
import { buildNormalWave, buildBossWave, bountySpawns, isFlyKey, pickRoundEntry } from '../../server/match/waves.js';
import { settleRelics } from '../../server/match/blackforest.js';
import { createRng } from '../../server/sim/rng.js';

test('personal bounty eligibility follows exact round boundaries and retains original amounts', () => {
  const gd = new GameData(DATA, 'mode_multi_abyss');
  assert.deepEqual(roundBountyPool(gd, 1), []);
  gd.uniteExpansion = true;
  for (let round = 1; round <= 15; round++) {
    const pool = roundBountyPool(gd, round);
    assert.ok(pool.length > 0, `round ${round}`);
    assert.ok(pool.every(c => c.coin >= 0 && c.coin < roundBountyWeights(round).length));
    assert.equal(new Set(pool.map(c => `${c.enemyKey}:${c.coin}`)).size, pool.length);
  }
  assert.deepEqual(new Set(roundBountyPool(gd, 1).map(c => c.coin)), new Set([0, 1, 2]));
  assert.deepEqual(new Set(roundBountyPool(gd, 7).map(c => c.coin)), new Set([0, 1, 2, 3, 4, 5]));
});

test('round entry offers nine unique bounties; only the owner can pick one, including index eight', () => {
  const h = makeMatch({ mode: 'coop', uniteStacking: true, humans: 2, fake: true }).start();
  try {
    h.toPrep(1);
    for (const ps of h.m.alivePlayers()) {
      const choice=structuredClone(ps.personalChoice);
      assert.equal(choice.cards.length,9);
      assert.equal(new Set(choice.cards.map(c=>c.enemyKey)).size,9);
      assert.equal(ps.bounties.length,0);
      const other=h.ps(ps.playerId==='p_0'?'p_1':'p_0');
      assert.equal(h.m.pickPersonalChoice(other,8,choice.id).ok,undefined);
      assert.equal(ps.privateView().personalChoice.kind,'roundBounty');
      assert.equal(ps.privateView().personalChoice.cards.length,9);
      for (let i = 0; i < 20; i++) h.m.rngMeta();
      assert.equal(grantRoundBounty(h.m, ps), null);
      assert.deepEqual(ps.personalChoice,choice);
      assert.equal(h.m.pickPersonalChoice(ps,9,choice.id).ok,undefined);
      assert.equal(h.m.pickPersonalChoice(ps,8,'wrong-choice').ok,undefined);
      assert.equal(h.m.pickPersonalChoice(ps,8,choice.id).ok,true);
      assert.equal(ps.bounties.length,1);
      assert.equal(ps.bounties[0].card.enemyKey,choice.cards[8].enemyKey);
      assert.equal(ps.bounties[0].card.roundReward,true);
      assert.equal(ps.bounties[0].card.collectibleCount,1);
      assert.equal(ps.bounties[0].roundsLeft,1);
      assert.equal(h.m.pickPersonalChoice(ps,8,choice.id).ok,undefined);
      assert.equal(ps.personalChoice,null);
    }
  } finally { h.m.dispose(); }
});

test('unselected personal bounty is resolved at prep deadline and refreshed next round',()=>{
 const h=makeMatch({mode:'coop',uniteStacking:true,humans:2,fake:true}).start();
 try {
  h.toPrep(1); const ps=h.ps('p_0'),first=ps.personalChoice.id;
  assert.equal(h.m.autoPickPersonalChoice(ps,'random').ok,true);
  assert.equal(ps.bounties.length,1); assert.equal(ps.personalChoice,null);
  h.toPrep(2);
  assert.notEqual(ps.personalChoice.id,first); assert.equal(ps.personalChoice.cards.length,9);
 }finally{h.m.dispose();}
});

test('custom bounty draft becomes supply and collectible quantity is independent of rarity', () => {
  const gd = new GameData(DATA, 'mode_multi_abyss');
  gd.uniteExpansion = true;
  assert.equal(generateDraft(gd, createRng(1), 9).family, 'supply');
  assert.deepEqual([0,1,2,3,4,5].map(collectibleDropCount), [1,1,1,2,3,3]);
});

test('nine-choice offers follow approved tier probabilities and never repeat enemy identities',()=>{
 const gd=new GameData(DATA,'mode_multi_abyss');gd.uniteExpansion=true;
 for(const round of [1,3,4,6,7,15]){
  const tally=roundBountyWeights(round).map(()=>0);
  for(let seed=1;seed<=10000;seed++){
   const cards=drawRoundBountyCards(gd,createRng(seed),round);
   assert.equal(cards.length,9);assert.equal(new Set(cards.map(c=>c.enemyKey)).size,9);
   for(const c of cards)assert.ok(c.coin>=0 && c.coin<tally.length);
   tally[cards[0].coin]++;
   if(seed===1)assert.deepEqual(cards,drawRoundBountyCards(gd,createRng(seed),round));
  }
  assert.ok(tally.every(n=>n>0));
  const expected=round<=3?[50,40,10]:round<=6?[40,30,20,10]:[20,30,30,10,5,5];
  assert.deepEqual(roundBountyWeights(round),expected);
  for(let coin=0;coin<expected.length;coin++)assert.ok(Math.abs(tally[coin]/10000-expected[coin]/100)<.02,`R${round} tier ${coin}: ${tally}`);
 }
});

test('zero-fund bounty spawns a real enemy and grants exactly one relic without adding funds',()=>{
 const h=makeMatch({mode:'coop',uniteStacking:true,humans:2,fake:true}).start();
 try{
  h.toPrep(1);const ps=h.ps('p_0');
  const zero={...roundBountyPool(h.m.gd,1).find(c=>c.coin===0),roundReward:true,collectibleCount:1};
  h.m.addBounty(ps,zero);
  const wave=buildNormalWave(h.m.gd,createRng(1),[],1);
  const spawns=bountySpawns(h.m.gd,1,wave,ps.bounties,ps.playerId);
  assert.equal(spawns.length,1);const spawn=spawns[0];
  assert.equal(spawn.enemyKey,zero.enemyKey);assert.equal(spawn.count,1);
  assert.equal(spawn.bounty,undefined);assert.equal(spawn.mods.relicCount,1);
  const funds=ps.funds,count=ps.hand.filter(Boolean).length;
  const result={relicKills:[{id:spawn.mods.bountyId,count:spawn.mods.relicCount}]};
  settleRelics(h.m,ps,result);settleRelics(h.m,ps,result);
  assert.equal(ps.funds,funds);assert.equal(ps.hand.filter(Boolean).length,count+1);
  assert.match(ps.privateView().effects.at(-1).desc,/0资金和1件藏品/);
 }finally{h.m.dispose();}
});


test('all rounds and leader templates retain bounty quantities, reward tiers and movement routes',()=>{
 const gd=new GameData(DATA,'mode_multi_abyss');gd.uniteExpansion=true;
 for(let round=1;round<=15;round++){
  const cap=round<=3?2:round<=6?3:5;
  for(let seed=1;seed<=32;seed++){
   const cards=drawRoundBountyCards(gd,createRng(seed),round);
   assert.equal(cards.length,9);assert.equal(new Set(cards.map(c=>c.enemyKey)).size,9);
   assert.ok(cards.every(c=>c.coin>=0&&c.coin<=cap&&c.collectibleCount===collectibleDropCount(c.coin)));
  }
  for(const type of ['SPECIAL','FLY'])for(const bossId of round<14?[null]:Object.keys(gd.roundCfg(round).bossTemplates))for(const solo of bossId?[false,true]:[false]){
   const picks=[];picks[round]=pickRoundEntry(gd,createRng(11),type,round);
   const wave=bossId?buildBossWave(gd,createRng(1),{picks},round,{bossId,solo}):buildNormalWave(gd,createRng(1),{picks},round);
   for(const side of bossId&&!solo?['L','R']:[null])for(const c of roundBountyPool(gd,round)){
    const card={...c,roundReward:true,collectibleCount:collectibleDropCount(c.coin)};
    const spawns=bountySpawns(gd,round,wave,[{id:'audit',card}], 'p_0',{solo,side});
    assert.deepEqual(spawns.map(s=>s.enemyKey).sort(),(card.enemyKeys||[card.enemyKey]).slice().sort());
    assert.equal(spawns.reduce((n,s)=>n+(s.mods.relicCount||0),0),card.collectibleCount);
    for(const s of spawns){
     assert.equal(s.count,1);assert.equal(s.bounty?.coins||0,card.coin);
     assert.equal(isFlyKey(gd,s.enemyKey),wave.routes[s.routeIndex].motion==='FLY');
     assert.ok(Number.isFinite(s.time)&&Number.isFinite(s.interval));
    }
   }
  }
 }
});


test('imported bounty rewards: Skullshatterer pays two, seven upgraded bosses pay four from round seven',()=>{
 const gd=new GameData(DATA,'mode_multi_abyss');gd.uniteExpansion=true;
 assert.equal(roundBountyPool(gd,1).find(c=>c.enemyKey==='enemy_1500_skulsr'&&c.coin>0).coin,2);
 assert.ok(roundBountyPool(gd,1).some(c=>c.enemyKey==='enemy_1500_skulsr'&&c.coin===0));
 const keys=['enemy_1513_dekght','enemy_1513_dekght_2','enemy_2110_dyyrzf','enemy_2114_dylbgg','enemy_2115_dylbg2','enemy_2112_dyhlgy','enemy_2113_dyhlg2'];
 for(const key of keys){
  assert.ok(!roundBountyPool(gd,6).some(c=>c.enemyKey===key));
  const c=roundBountyPool(gd,7).find(c=>c.enemyKey===key);
  assert.equal(c.coin,4,key);assert.equal(collectibleDropCount(c.coin),3,key);
 }
});
