import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preserveManifestEntries,parseArgs,shrinkGuard} from '../tools/fetch-assets.mjs';
test('additive asset rebuild preserves voices, custom skins, metadata and arrays while adding enemy art',()=>{
  const old={chars:{c:{skins:{custom:{portrait:'/assets/custom.png',move:null}},voice:['old1','old2']}},enemies:{a:{icon:'/assets/old.png',spine:{skel:'/assets/a.skel'}}}};
  const next={chars:{c:{voice:['new'],portrait:'/assets/c.png'}},enemies:{a:{icon:'/assets/new.png'},b:{icon:'/assets/b.png'}}};
  const before=structuredClone(old),merged=preserveManifestEntries(old,next);
  assert.deepEqual(old,before);assert.equal(merged.enemies.a.icon,'/assets/old.png');assert.deepEqual(merged.chars.c.voice,['old1','old2']);
  assert.equal(merged.enemies.b.icon,'/assets/b.png');assert.equal(merged.chars.c.portrait,'/assets/c.png');assert.equal(shrinkGuard(old,merged).write,true);
  assert.equal(parseArgs(['--preserve-existing']).preserveExisting,true);assert.throws(()=>parseArgs(['--preserve-existing','--prune']));
});
