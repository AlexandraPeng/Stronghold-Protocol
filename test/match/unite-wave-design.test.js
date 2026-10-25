import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA, makeMatch } from './harness.js';
import { GameData } from '../../server/match/gamedata.js';
import { uniteEntries, uniteBountyCards } from '../../server/match/uniteExpansion.js';
import { UNITE_ENEMY_KEYS, UNITE_SUMMON_KEYS, UNITE_WAVE_DESIGN, UNITE_MIN_ROUND } from '../../shared/uniteWaveDesign.js';
import { UNITE_KITS } from '../../server/sim/content/enemies/uniteExpansion/index.js';
import { buildNormalWave, buildBossWave, bountySpawns, buildUniteWave, pickRoundEntry, replacedCount } from '../../server/match/waves.js';
import { createRng } from '../../server/sim/rng.js';
import { generateDraft } from '../../server/match/choices.js';
const gdOf = () => { const gd=new GameData(DATA,'mode_multi_abyss');gd.uniteExpansion=true;return gd; };
test('every requested enemy and explicit summon dependency has generated stats and an authored kit',()=>{
  for(const key of [...UNITE_ENEMY_KEYS,...UNITE_SUMMON_KEYS]){assert.ok(DATA.enemies[key],key);assert.equal(typeof UNITE_KITS[key],'function',key);}
});
test('mode gate: ordinary ultimate, solo and ordinary coop keep their original pools',()=>{
  for(const opts of [{mode:'coop',uniteStacking:false},{mode:'solo',uniteStacking:true},{mode:'coop',uniteStacking:true}]){
    const h=makeMatch({...opts,difficulty:'ABYSS',fake:true,humans:2});
    try{assert.equal(h.m.gd.uniteExpansion,opts.mode==='coop'&&opts.uniteStacking);
      assert.equal(uniteEntries(h.m.gd,'ELEMENT',false).length,opts.mode==='coop'&&opts.uniteStacking?2:0);
    }finally{h.m.dispose();}
  }
});
test('round boundaries: low rounds 1–7, high 8+, late courier boss never in low rounds',()=>{
  const gd=gdOf();
  assert.equal(uniteEntries(gd,'TIMES',true).length,1);assert.equal(uniteEntries(gd,'TIMES',false).length,0);
  assert.equal(uniteEntries(gd,'FLY',true).length,1);assert.equal(uniteEntries(gd,'FLY',false).length,2);
  assert.ok(!uniteEntries(gd,'FLY',true)[0].uniteKeys.includes('enemy_10230_agkiro'));
  assert.ok(uniteEntries(gd,'FLY',false)[0].uniteKeys.includes('enemy_10230_agkiro'));
});
test('every designed group generates bounded counts and correct ground/flying routes on every eligible round',()=>{
  const gd=gdOf();
  for(const g of UNITE_WAVE_DESIGN)for(let round=1;round<=15;round++){
    const half=round<=7;if(!g.halves.includes(half?'early':'late'))continue;
    const entry=uniteEntries(gd,g.type,half,round).find(e=>e.uniteGroup===g.id),picks=[];
    picks[round]={...entry,round,fly:g.type==='FLY',normal:null,elite:null};
    const wave=round>=14 ? buildBossWave(gd,createRng(3),{picks},round,{bossId:round===14?'boss_1':'boss_8',solo:false}) : buildNormalWave(gd,createRng(3),{picks},round);
    assert.ok(wave.spawns.length,`${g.id} R${round}`);
    for(const spawn of wave.spawns)assert.ok(round>=(UNITE_MIN_ROUND[spawn.enemyKey]||1),spawn.enemyKey);
    for(const s of wave.spawns){
      if(s.tag!=='boss' && s.tag!=='part')assert.ok(entry.uniteKeys.includes(s.enemyKey),`${g.id}: foreign ${s.enemyKey}`);
      assert.ok(s.count>=1&&s.count<=5);
      const original=gd.wave(wave.templateId).spawns[s.actionIndex];
      if(s.tag!=='boss' && s.tag!=='part') {
        assert.equal(s.count,replacedCount(gd,original.key,original.count,s.enemyKey));
        const window=original.count*(original.interval||0);
        assert.equal(s.interval,s.count>1?Math.max(window/s.count,0.05*window):0);
      }
      assert.equal(gd.enemy(s.enemyKey).isFlyEnemy,wave.routes[s.routeIndex].motion==='FLY',`${s.enemyKey} R${round}`);
    }
  }
});
test('all design groups can be selected; seed and round reproduce the composition',()=>{
  const gd=gdOf(),seen=new Set();
  for(const type of ['ELEMENT','TIMES','FLY','SPECIAL'])for(const round of [3,9])for(let seed=1;seed<=300;seed++){
    const p=pickRoundEntry(gd,createRng(seed),type,round);
    assert.deepEqual(p,pickRoundEntry(gd,createRng(seed),type,round));if(p.uniteGroup)seen.add(p.uniteGroup);
  }
  assert.deepEqual([...seen].sort(),UNITE_WAVE_DESIGN.map(g=>g.id).sort());
});
test('R9 bounty pairs pay 3 per real kill and carry their pair/reward into support waves',()=>{
  const h=makeMatch({mode:'coop',uniteStacking:true,humans:2,fake:true}).start();
  try{
    h.toPrep(1);const gd=h.m.gd,ps=h.ps('p_0');
    ps.bounties=[]; // isolate the explicit pair from the automatic round bounty
    const card=uniteBountyCards(gd).find(c=>c.enemyKey==='enemy_2029_symon');h.m.addBounty(ps,card);
    const wave=buildNormalWave(gd,createRng(1),[],9),spawns=bountySpawns(gd,9,wave,ps.bounties,ps.playerId);
    assert.deepEqual(spawns.map(s=>s.enemyKey).sort(),card.enemyKeys.slice().sort());
    const pairSpawns=spawns.filter(s=>card.enemyKeys.includes(s.enemyKey));
    assert.ok(pairSpawns.every(s=>s.bounty.coins===3&&s.mods.unitePairId===ps.bounties.find(b=>b.card.enemyKey===card.enemyKey).id));
    const alone=buildUniteWave(gd,[{...spawns[0],sourcePlayerId:ps.playerId}],1,30);
    assert.equal(alone.spawns[0].mods.unitePairTerminal,true);
    const together=buildUniteWave(gd,spawns.map(s=>({...s,sourcePlayerId:ps.playerId})),1,30);
    assert.ok(together.spawns.every(s=>!s.mods.unitePairTerminal));
    const draft=generateDraft(gd,createRng(1),9);assert.equal(draft.cards.length,6);
    assert.equal(draft.family,'supply');
  }finally{h.m.dispose();}
});

test('imported enemy unlocks respect both per-enemy minimum rounds and biome halves',()=>{
 const gd=gdOf(),expected={enemy_10156_mncrer:7,enemy_10156_mncrer_2:7,enemy_10158_mnzeno:7,enemy_10162_mnctpt:4,enemy_10162_mnctpt_2:4,enemy_2134_shrshep:7,enemy_2135_shkrbt:7,enemy_2136_shcolo:7,enemy_2137_shsdgo:7,enemy_10098_crhro:4,enemy_10099_crvln:4,enemy_10225_agpbus:4,enemy_10225_agpbus_2:7,enemy_10230_agkiro:7,enemy_10147_nsbomb:4,enemy_10150_nsheat:4};
 assert.deepEqual(UNITE_MIN_ROUND,expected);
 for(let round=1;round<=15;round++) for(const g of UNITE_WAVE_DESIGN){
  const half=round<=7?'early':'late';
  const entry=uniteEntries(gd,g.type,round<=7,round).find(e=>e.uniteGroup===g.id);
  const keys=g.halves.includes(half)?[...g.keys,...(round>=8?g.lateKeys:[])].filter(k=>round>=(expected[k]||1)):[];
  assert.deepEqual(entry?.uniteKeys||[],keys,`${g.id} R${round}`);
 }
 const first=(type,key)=>Array.from({length:15},(_,i)=>i+1).find(r=>uniteEntries(gd,type,r<=7,r).some(e=>e.uniteKeys.includes(key)));
 assert.equal(first('SPECIAL','enemy_10162_mnctpt'),4);
 assert.equal(first('FLY','enemy_10147_nsbomb'),8);
 assert.equal(first('ELEMENT','enemy_2134_shrshep'),8);
 assert.equal(first('FLY','enemy_10230_agkiro'),8);
});

test('imported flying enemy caps apply after strength conversion',()=>{
 const gd=gdOf();
 for(const [key,cap] of Object.entries({enemy_2101_dyspll:1,enemy_10225_agpbus:3,enemy_10150_nsheat:2,enemy_10147_nsbomb:3,enemy_10230_agkiro:3,enemy_10225_agpbus_2:3})){
  assert.equal(replacedCount(gd,key,50,key),cap,key);
 }
});

test('existing faction entries use one biome with movement filtering and original quantity budgets',()=>{
 const gd=gdOf();
 for(let round=1;round<=13;round++)for(const type of Object.keys(gd.factions.types))for(let seed=1;seed<=20;seed++){
  const pick=pickRoundEntry(gd,createRng(seed),type,round);if(!pick)continue;
  const picks=[];picks[round]=pick;
  const wave=buildNormalWave(gd,createRng(1),{picks},round);
  const allowed=new Set(pick.uniteKeys||[pick.normal,pick.elite,pick.key]);
  assert.ok(wave.spawns.every(s=>allowed.has(s.enemyKey)),`${type} R${round}`);
  assert.ok(wave.spawns.every(s=>gd.enemy(s.enemyKey).isFlyEnemy===(wave.routes[s.routeIndex].motion==='FLY')));
  const tpl=gd.wave(wave.templateId);
  for(const spawn of wave.spawns){
   const original=tpl.spawns[spawn.actionIndex];
   assert.equal(spawn.routeIndex,original.routeIndex);
   assert.equal(spawn.count,replacedCount(gd,original.key,original.count,spawn.enemyKey));
  }
  for(const a of wave.actions.filter(a=>!a.valid)){
   const fly=wave.routes[a.routeIndex].motion==='FLY';
   assert.ok(![...allowed].some(k=>k&&gd.enemy(k)?.isFlyEnemy===fly));
  }
 }
});


test('armour and resistance reduce custom wave counts; incompatible movement slots stay empty',()=>{
 const run=(motion,def,res)=>{
  const gd=gdOf(),enemy=gd.enemy.bind(gd);
  gd.enemy=k=>k==='test_budget'?{stats:{maxHp:1000,atk:0,def:0,res:0}}:
   k==='test_biome'?{isFlyEnemy:motion==='FLY',stats:{maxHp:1000,atk:0,def,res,motion}}:enemy(k);
  gd.wave=()=>({routes:[{motion:'WALK'},{motion:'FLY'}],spawns:[
   {key:'test_budget',count:5,interval:2,routeIndex:0},
   {key:'test_budget',count:2,interval:5,routeIndex:1}],overrides:{}});
  const picks=[];picks[2]={uniteKeys:['test_biome']};
  return buildNormalWave(gd,createRng(1),{picks},2);
 };
 const ground=run('WALK',0,0),armour=run('WALK',500,0),resistant=run('WALK',0,80),both=run('WALK',500,80),fly=run('FLY',0,0);
 assert.deepEqual([ground,armour,resistant,both,fly].map(w=>w.spawns.reduce((n,s)=>n+s.count,0)),[5,2,4,2,2]);
 for(const w of [ground,armour,resistant,both,fly]){
  assert.equal(w.spawns.length,1);assert.equal(w.actions.filter(a=>!a.valid).length,1);
  assert.equal(w.spawns[0].interval*w.spawns[0].count,10);
 }
});

test('original faction placeholder quantities agree with ordinary mode on rounds 2–13',()=>{
 const custom=gdOf(),ordinary=new GameData(DATA,'mode_multi_abyss');
 for(let r=2;r<=13;r++)for(const type of Object.keys(ordinary.factions.types))for(let seed=1;seed<=20;seed++){
  const picks=[];picks[r]=pickRoundEntry(ordinary,createRng(seed),type,r);
  const a=buildNormalWave(custom,createRng(1),{picks},r),b=buildNormalWave(ordinary,createRng(1),{picks},r);
  assert.deepEqual(a.spawns,b.spawns,`${type} R${r} seed ${seed}`);
 }
});


test('direct paper waves have one per flying action, without changing ordinary count conversion',()=>{
 const gd=gdOf(),ordinary=new GameData(DATA,'mode_multi_abyss'),paper='enemy_2101_dyspll';
 const expected=[1,2,2,5,6,6,8];
 for(let round=1;round<=7;round++){
  const entry=uniteEntries(gd,'TIMES',true,round).find(e=>e.uniteGroup==='times_1');
  for(const order of [entry.uniteKeys,entry.uniteKeys.slice().reverse()]){
   const picks=[];picks[round]={...entry,round,uniteKeys:order};
   const wave=buildNormalWave(gd,createRng(1),{picks},round);
   const papers=wave.spawns.filter(s=>s.enemyKey===paper);
   assert.equal(papers.reduce((n,s)=>n+s.count,0),expected[round-1],`R${round}`);
   assert.ok(papers.every(s=>s.count===1));
  }
 }
 assert.equal(replacedCount(ordinary,'enemy_1005_yokai',5,paper),5);
 assert.equal(replacedCount(gd,'enemy_1005_yokai',5,paper),1);
});
