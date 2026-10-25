import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DATA } from './harness.js';
import { UNITE_TUNING } from '../../shared/uniteTuning.js';
import { validateUniteTuning } from '../../shared/uniteTuningSchema.js';
import { GameData } from '../../server/match/gamedata.js';
import { buildNormalWave } from '../../server/match/waves.js';
import { createRng } from '../../server/sim/rng.js';
const stages=JSON.parse(fs.readFileSync(new URL('../../data/stages.json',import.meta.url),'utf8'));
const check=c=>validateUniteTuning(c,DATA.enemies,DATA.waves,DATA.choices,stages);
const route={start:[9,10],end:[9,2],checkpoints:[[9,9],[9,4]]};
test('route JSON validates reachable waypoints and rejects walls, bounds and protected templates',()=>{
 const c=structuredClone(UNITE_TUNING);c.routes={act1autochess_01:{0:route}};assert.deepEqual(check(c),c);
 for(const cp of [[8,8],[9,21],[10,2],[9,NaN]]){const d=structuredClone(c);d.routes.act1autochess_01[0].checkpoints=[cp];assert.throws(()=>check(d));}
 const boss=Object.values(DATA.waves).find(w=>w.kind!=='normal');const d=structuredClone(c);d.routes[boss.id]={0:route};assert.throws(()=>check(d));
});
test('real generator uses edited routes only in custom mode and preserves official source',()=>{
 const saved=UNITE_TUNING.routes,source=JSON.stringify(DATA.waves),gd=new GameData(DATA,'mode_multi_abyss');gd.uniteExpansion=true;
 try{UNITE_TUNING.routes={act1autochess_01:{0:route}};const wave=buildNormalWave(gd,createRng(3),{},1);assert.deepEqual(wave.routes[0].checkpoints,route.checkpoints);gd.uniteExpansion=false;assert.deepEqual(buildNormalWave(gd,createRng(3),{},1).routes[0],DATA.waves.act1autochess_01.routes[0]);assert.equal(JSON.stringify(DATA.waves),source);}finally{if(saved===undefined)delete UNITE_TUNING.routes;else UNITE_TUNING.routes=saved;}
});

