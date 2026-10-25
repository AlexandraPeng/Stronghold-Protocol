// Download the enabled relic art referenced by PRTS; preserve the rest of the asset manifest.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { RELICS, relicItemId } from '../shared/blackforestRelics.js';
const root=new URL('../',import.meta.url), dir=new URL('public/assets/blackforest/',root);
await mkdir(dir,{recursive:true});
const manifest=JSON.parse(await readFile(new URL('data/assets.json',root),'utf8'));
const queue=RELICS.slice(), failed=[];
await Promise.all(Array.from({length:6},async()=>{
  while(queue.length){
    const r=queue.shift(),file=new URL(`${r.id}.png`,dir);
    try {
      if(!await stat(file).then(s=>s.size>100).catch(()=>false)) {
        const res=await fetch(`https://torappu.prts.wiki/assets/roguelike_topic_itempic/${r.id}.png`,{signal:AbortSignal.timeout(25000)});
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes=Buffer.from(await res.arrayBuffer());
        if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw new Error('not PNG');
        await writeFile(file,bytes);
      }
      manifest.items[relicItemId(r.id)]=`/assets/blackforest/${r.id}.png`;
    } catch(e){failed.push(`${r.id}: ${e.message}`);}
  }
}));
await writeFile(new URL('data/assets.json',root),JSON.stringify(manifest,null,2)+'\n');
console.log(`Relic icons: ${RELICS.length-failed.length}/${RELICS.length}`);
if(failed.length){console.error(failed.join('\n'));process.exitCode=1;}
