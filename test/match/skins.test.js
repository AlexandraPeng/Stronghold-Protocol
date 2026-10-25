import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeMatch,give,legalTileFor} from './harness.js';
import {makeBattle} from '../helpers/battleHarness.js';
import {unitInfo} from '../../server/sim/snapshot.js';
import {renderInfo} from '../../public/js/render/app/info.js';
import {spineEntry} from '../../public/js/assets.js';
import {readFileSync} from 'node:fs';
test('chosen skin survives player input, simulation metadata and renderer resolution',()=>{
 const h=makeMatch({mode:'solo',humans:1,fake:true}).start();
 try{
 h.toPrep(1);const p=h.ps('p_0');
 const manifest=JSON.parse(readFileSync(new URL('../../data/assets.json',import.meta.url)));
 const rec=Object.values(h.m.data.chess).find(r=>r.visible&&!r.isGolden&&!r.isHidden&&Object.keys(manifest.chars[r.charId]?.skins||{}).length&&legalTileFor(h.m,p,r.chessId));
 assert.ok(rec,'a real skinned operator');
 const skin=Object.keys(manifest.chars[rec.charId].skins)[0];
 p.setSkins({[rec.charId]:skin});
 const piece=give(h.m,p,rec.chessId,'board',legalTileFor(h.m,p,rec.chessId));
 const input=p.battleInput();assert.equal(input.units.find(u=>u.uid===piece.uid).skin,skin);
 const sim=makeBattle({players:[input],content:'none'});
 sim.run(1); const ally=sim.battle.allyUnits.find(u=>u.uid===piece.uid);assert.ok(ally);
 const info=unitInfo(ally);assert.equal(info.skin,skin);assert.equal(renderInfo(info).skin,skin);
 assert.deepEqual(spineEntry(manifest,rec.charId,{skin}),manifest.chars[rec.charId].skins[skin].spine.front);
 }finally{h.m.dispose();}
});

