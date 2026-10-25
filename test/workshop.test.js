import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defaultWorkshop, parseWorkshop, validateWorkshop } from '../shared/workshop.js';
import { compileWorkshop, enemyCoverage } from '../server/sim/workshop.js';
import { DataSource, setSimData } from '../server/sim/simdata.js';
import { computeBonds } from '../server/match/bondsMeta.js';

const raw = Object.fromEntries(['chess','enemies','tokens','stages','waves','bonds','items','garrisons','bands','effects','backups'].map(n=>[n,JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)))]));
const catalog = JSON.parse(fs.readFileSync(new URL('../data/workshop-enemies.json',import.meta.url)));
setSimData(raw);
const ds = new DataSource(raw,null);
const unit = () => ({chessId:'chess_char_1_01_a',row:9,col:3,dir:'RIGHT',stats:{atk:777,maxHp:12345},skillParams:{},bonds:[],customBonds:true});
const wave = () => ({enemyKey:'enemy_1000_gopro_2',count:3,time:0,interval:1,lane:9,stats:{maxHp:2000},talentParams:{},skillParams:{}});
const scenario = () => ({...defaultWorkshop(),allies:[unit()],waves:[wave()],duration:20});

test('workshop files round trip; reject unsafe keys, invalid cells and excessive spawn counts',()=>{
  const doc=validateWorkshop(scenario());assert.deepEqual(parseWorkshop(JSON.stringify(doc)),doc);
  assert.throws(()=>parseWorkshop('{"version":1,"__proto__":{"polluted":true}}'),/不允许/);
  assert.throws(()=>validateWorkshop({...scenario(),allies:[unit(),unit()]}),/重复/);
  assert.throws(()=>validateWorkshop({...scenario(),waves:Array.from({length:4},()=>({...wave(),count:100}))}),/300/);
  assert.throws(()=>validateWorkshop({...scenario(),allies:[{...unit(),stats:{atk:Infinity}}]}),/必须/);
  assert.throws(()=>parseWorkshop(' '.repeat(2*1024*1024+1)),/2 MB/);
  assert.equal({}.polluted,undefined);
});

test('custom stats reach actual combat without changing baseline data',()=>{
  const before=JSON.stringify(raw), original=ds.getChess(unit().chessId).stats.atk;
  const compiled=compileWorkshop(scenario(),ds,catalog,raw.bonds),b=compiled.create();
  for(let i=0;i<180&&!b.finished;i++)b.step();
  assert.equal(b.errorCount,0);
  assert.equal(b.allyUnits[0].base.atk,777);
  assert.equal(b.allyUnits[0].base.maxHp,12345);
  assert.equal(b.total,3);assert.equal(b.enemies.length,3);
  assert.equal(b.enemies[0].base.maxHp,2000);
  assert.ok(b.enemies.some(e=>e.x<10),'enemies move through the actual simulator');
  assert.equal(ds.getChess(unit().chessId).stats.atk,original);assert.equal(JSON.stringify(raw),before);
});

test('special mechanisms are not silently declared supported',()=>{
  const key=Object.keys(catalog.enemies).find(k=>enemyCoverage(k).state==='missing');
  const doc={...scenario(),waves:[{...wave(),enemyKey:key,useCatalog:true,level:catalog.enemies[key].levels[0].level}]};
  assert.throws(()=>compileWorkshop(doc,ds,catalog,raw.bonds),/不完整机制/);
  const out=compileWorkshop({...doc,allowIncomplete:true},ds,catalog,raw.bonds);
  assert.ok(out.warnings.length);assert.equal(out.ds.getEnemy(key).key,key);
  assert.equal(enemyCoverage('enemy_1387_winshd').state,'partial');
});

test('invalid source references and ambiguous enemy variants fail before combat',()=>{
  assert.throws(()=>compileWorkshop({...scenario(),stageId:'missing'},ds,catalog,raw.bonds),/地图/);
  assert.throws(()=>compileWorkshop({...scenario(),waves:[wave(),{...wave(),stats:{atk:22}}]},ds,catalog,raw.bonds),/相同等级和参数/);
  assert.throws(()=>compileWorkshop({...scenario(),allies:[{...unit(),skillParams:{invented:12}}]},ds,catalog,raw.bonds),/未定义参数/);
  assert.throws(()=>compileWorkshop({...scenario(),allies:[{...unit(),bonds:['missing']}]},ds,catalog,raw.bonds),/不存在的盟约/);
  assert.throws(()=>compileWorkshop({...scenario(),bondLayers:{yanShip:-1}},ds,catalog,raw.bonds),/层数无效/);
});

test('custom skills are isolated and bond membership agrees with match rules',()=>{
  const d=ds.getChess(unit().chessId),param=Object.keys(d.skill.bb).find(k=>typeof d.skill.bb[k]==='number');
  const a={...unit(),skillParams:{[param]:99},bonds:['yanShip','maniShip','soloShip']};
  const out=compileWorkshop({...scenario(),allies:[a],bondLayers:{yanShip:7}},ds,catalog,raw.bonds);
  assert.equal(out.ds.getChess('workshop_0').skill.bb[param],99);assert.notEqual(d.skill.bb[param],99);
  const gd={bondIds:Object.keys(raw.bonds),modeInactiveBonds:new Set(),bond:id=>raw.bonds[id],chess:()=>({...d,bonds:a.bonds}),baseIdOf:()=>d.baseId,isGolden:()=>d.golden,item:()=>null};
  const expected=computeBonds(gd,{board:new Map([['cell',{id:a.chessId,kind:'chess'}]]),hand:[],layers:{yanShip:7}});
  for(const [id,b] of Object.entries(expected))for(const key of ['count','active','tier','layers'])assert.equal(out.spec.players[0].bonds[id][key],b[key],`${id}.${key}`);
});

test('user-designed skills execute in combat and do not leak into a fresh trial',()=>{
  const rule={name:'测试攻击增益',effect:'atkBuff',target:'self',amount:123,interval:1,delay:0,radius:0,duration:2,maxTargets:1};
  const doc={...scenario(),allies:[{...unit(),rules:[rule]}]};
  const b=compileWorkshop(doc,ds,catalog,raw.bonds).create();
  for(let i=0;i<60;i++)b.step();
  assert.equal(b.allyUnits[0].s.atk,900);
  assert.equal(b.errorCount,0);
  const fresh=compileWorkshop(scenario(),ds,catalog,raw.bonds).create();
  for(let i=0;i<60;i++)fresh.step();
  assert.equal(fresh.allyUnits[0].s.atk,777);
  assert.throws(()=>validateWorkshop({...doc,allies:[{...unit(),rules:[{...rule,effect:'eval'}]}]}),/不支持/);
});

test('every catalog variant normalizes into finite combat values',()=>{
  for(const [key,entry] of Object.entries(catalog.enemies))for(const rec of entry.levels){
    const source=new DataSource({enemies:{[key]:rec}},null),e=source.getEnemy(key);
    for(const stat of ['maxHp','atk','def','res','aspd','bat','moveSpeed','massLevel'])assert.ok(Number.isFinite(e[stat]),`${key} ${rec.level} ${stat}`);
  }
});

test('custom alliances activate on each side separately and scale by configured layers',()=>{
  const doc={...scenario(),allies:[{...unit(),alliances:['custom']}],waves:[{...wave(),alliances:['custom'],stats:{maxHp:100000,moveSpeed:0}}],
    customAlliances:[{id:'custom',name:'敌我独立计数',need:2,layers:3,mods:{atkPct:.2},perLayer:{atkPct:.1}}]};
  const b=compileWorkshop(doc,ds,catalog,raw.bonds).create();for(let i=0;i<95;i++)b.step();
  assert.equal(b.errorCount,0);assert.equal(b.allyUnits[0].s.atk,777,'one allied member is insufficient');
  assert.equal(b.enemies[0].s.atk,390,'enemy 260 ATK * (1 + .2 + .1*3)');
  b.kill(b.enemies[1]);b.kill(b.enemies[2]);for(let i=0;i<10;i++)b.step();
  assert.equal(b.enemies[0].s.atk,260,'falling below the threshold removes the alliance bonus');
  assert.throws(()=>validateWorkshop({...doc,customAlliances:[]}),/不存在的自定义盟约/);
  assert.throws(()=>validateWorkshop({...doc,customAlliances:[...doc.customAlliances,...doc.customAlliances]}),/重复/);
});

