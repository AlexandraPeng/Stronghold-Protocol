// Local audit from the actual custom-mode wave generator, not a duplicate balance table.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { getData } from '../server/data.js';
import { GameData } from '../server/match/gamedata.js';
import { buildNormalWave, buildBossWave, replacedCount, isFlyKey } from '../server/match/waves.js';
import { roundBountyWeights, uniteEntries } from '../server/match/uniteExpansion.js';
import { UNITE_MIN_ROUND } from '../shared/uniteWaveDesign.js';
import { createRng } from '../server/sim/rng.js';

const output=path.resolve(process.argv[2]||'.cache/unite-round-audit');
const gd=new GameData(getData({log:{info(){},warn(){},error(){}}}),'mode_multi_abyss');
const ordinary=new GameData(gd.raw,'mode_multi_abyss');
gd.uniteExpansion=true;
const rows=[],groups=[];
let checkedWaves=0;
function* permutations(keys) {
 if(!keys.length){yield [];return;}
 for(let i=0;i<keys.length;i++)for(const tail of permutations(keys.filter((_,j)=>j!==i)))yield [keys[i],...tail];
}
function verify(w) {
 checkedWaves++;
 const tpl=gd.wave(w.templateId),allowed=new Set(w.pick.uniteKeys||[w.pick.normal,w.pick.elite,w.pick.key]);
 assert.ok(w.spawns.length,`empty R${w.pick.round}`);
 for(const s of w.spawns){
  const src=tpl.spawns[s.actionIndex];
  assert.ok(Number.isInteger(s.count)&&s.count>0);
  assert.ok(Number.isFinite(s.time)&&Number.isFinite(s.interval)&&s.interval>=0);
  if(s.tag==='boss'||s.tag==='part'||src.unharmful){assert.equal(s.enemyKey,src.key);assert.equal(s.count,src.count||1);continue;}
  assert.ok(allowed.has(s.enemyKey),s.enemyKey);
  assert.ok(w.pick.round >= (UNITE_MIN_ROUND[s.enemyKey]||1),s.enemyKey);
  assert.equal(isFlyKey(gd,s.enemyKey),w.routes[s.routeIndex].motion==='FLY');
  assert.equal(s.routeIndex,src.routeIndex);
  assert.equal(s.count,replacedCount(gd,src.key,src.count,s.enemyKey));
  assert.equal(s.interval,s.count>1?Math.max(src.count*(src.interval||0)/s.count,0.05*src.count*(src.interval||0)):0);
 }
 for(const a of w.actions.filter(a=>!a.valid))assert.ok(![...allowed].some(k=>k&&isFlyKey(gd,k)===(w.routes[a.routeIndex].motion==='FLY')));
}
const sum=(spawns,fn=()=>true)=>spawns.filter(fn).reduce((n,s)=>n+s.count,0);
const range=values=>[Math.min(...values),Math.max(...values)];
const keys=list=>(list||[]).map(x=>typeof x==='string'?x:x.key);
const pack=(round,pick)=>{const picks=[];picks[round]=pick;return {picks};};
const generate=(data,round,pick,bossId,solo=false)=>bossId
 ?buildBossWave(data,createRng(1),pack(round,pick),round,{bossId,solo})
 :buildNormalWave(data,createRng(1),pack(round,pick),round);
for(let round=1;round<=15;round++){
 const baseline=[];
 for(const e of Object.values(ordinary.factions.entries)){
  if(!!e.firstHalf!==(round<=7)||ordinary.inactiveEnemies.has(e.key)||!ordinary.enemy(e.key)||e.key==='enemy_9012_acloon')continue;
  for(const normal of keys(e.N).length?keys(e.N):[null])for(const elite of keys(e.E).length?keys(e.E):[null])baseline.push({...e,round,normal,elite});
 }
 const compositions=baseline.slice();
 for(const type of Object.keys(gd.factions.types))for(const e of uniteEntries(gd,type,round<=7,round)){
  for(const order of permutations(e.uniteKeys))compositions.push({...e,round,normal:null,elite:null,uniteKeys:order});
 }
 for(const bossId of round<14?[null]:Object.keys(gd.roundCfg(round).bossTemplates))for(const solo of bossId?[false,true]:[false]){
  const originals=baseline.map(p=>generate(ordinary,round,p,bossId,solo));
  const waves=compositions.map(p=>generate(gd,round,p,bossId,solo));
  const w=waves[0],byGroup=new Map();
  for(const v of waves){
   verify(v);
   const id=v.pick.uniteGroup||v.pick.key;
   if(!byGroup.has(id))byGroup.set(id,[]);
   byGroup.get(id).push(v);
  }
  rows.push({round,leader:bossId?(gd.raw.bosses[bossId]?.name||bossId):'常规波次',field:bossId?(solo?'单人领袖战场':'双人共享战场'):'每人战场',solo,template:w.templateId,
   originalTotal:range(originals.map(v=>sum(v.spawns))),regular:range(waves.map(v=>sum(v.spawns,s=>s.tag!=='boss'&&s.tag!=='part'))),
   boss:sum(w.spawns,s=>s.tag==='boss'),parts:sum(w.spawns,s=>s.tag==='part'),total:range(waves.map(v=>sum(v.spawns))),compositions:waves.length});
  for(const [id,vs] of byGroup){
   const v=vs[0];
   groups.push({round,bossId,solo,id,name:v.pick.uniteGroup||gd.enemy(v.pick.key)?.name||id,type:v.pick.type,
    total:range(vs.map(x=>sum(x.spawns))),compositions:vs.length});
  }
 }
}
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const probabilities=[1,4,7].map(r=>({rounds:r===1?'1–3':r===4?'4–6':'7–15',weights:roundBountyWeights(r)}));
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'counts.json'),JSON.stringify({mode:'uniteStacking',method:'Exhaustive eligible original normal/elite combinations and all permutations of custom group keys, rounds 1–15, all single/shared leader templates. Ranges exclude bounties, summons and leaks.',checkedWaves,rows,groups,probabilities},null,2)+'\n');
await fs.writeFile(path.join(output,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>联防叠层 · 每回合出怪量</title>
<style>body{margin:0;background:#111b18;color:#e0e8df;font:16px/1.7 system-ui,sans-serif}main{max-width:1100px;margin:40px auto;padding:0 24px}h1{color:#d4ce8c}p{color:#adc0b0}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{text-align:left;border-bottom:1px solid #3b5044;padding:10px}th{background:#22372d}tr:hover{background:#21332a}code{font-size:12px}.scroll{overflow:auto}b{color:#8fe0ba}</style>
<main><h1>联防叠层 · 每回合出怪量</h1><p>根据当前本地生成器直接统计。普通波次只取本回合选中的一个群系，按原版战斗效能换算数量；跳过不匹配的地面／飞行槽位，保持每批出怪时间窗。</p>
<p><b>不含额外悬赏、技能召唤物和其他玩家漏怪。</b>第 14–15 回合分别列出单人及双人共享战场，领袖部件单列。</p>
<p>已核对 ${checkedWaves.toLocaleString()} 个波次组合，覆盖 1–15 回合及全部单人／双人领袖模板。范围枚举全部可选群系、普通／精英组合，以及新增群系的全部敌人排列；为当前生成规则下的最小／最大值。新群系敌人的强度与原有群系不同，因此数量范围也可能不同。首回合固定源石虫在叠层模式中也替换为同群系敌人；纯飞行群系跳过该地面槽位。</p><p>数量取决于生命、攻击、防御、法抗及 beFactor，单批限制 1–5 只，便符因受击次数生命机制单独限制为每批 1 张（自定义平衡）；先随机群系，再换算数量，不直接随机总数。取整和最少 1 只可能使小幅属性变化不改变数量。</p><div class="scroll"><table><thead><tr><th>回合</th><th>战场 / 领袖</th><th>原版总量范围</th><th>叠层常规怪（完整枚举）</th><th>领袖</th><th>机制部件</th><th>总出场量</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.round}</td><td>${esc(r.leader)}<br><small>${r.field}</small></td><td>${r.originalTotal.join("–")}</td><td>${r.regular.join("–")}</td><td>${r.boss}</td><td>${r.parts}</td><td><b>${r.total.join("–")}</b></td></tr>`).join('')}</tbody></table></div>
<details><summary>展开每回合各群系的数量（完整枚举）</summary><table><tr><th>回合</th><th>群系</th><th>类型</th><th>领袖</th><th>总量</th></tr>${groups.map(g=>`<tr><td>${g.round}</td><td>${esc(g.name)}</td><td>${esc(g.type)}</td><td>${esc(g.bossId?(g.bossId+(g.solo?' 单人':' 双人')):'—')}</td><td>${g.total.join('–')}</td></tr>`).join('')}</table></details>
<h2>九选一悬赏 · 资金档位权重</h2><p>先按权重抽资金档位，再等概率抽该档敌人；九张卡敌人不重复。某档候选被抽空后，其余档位重新归一化，因此每组九张不保证固定比例。</p>
<table><thead><tr><th>回合</th><th>0 资金起各档权重</th><th>首抽概率（按档位顺序）</th></tr></thead><tbody>${probabilities.map(p=>`<tr><td>${p.rounds}</td><td>${p.weights.join(' : ')}</td><td>${p.weights.map(w=>(100*w/p.weights.reduce((a,b)=>a+b,0)).toFixed(1)+'%').join(' / ')}</td></tr>`).join('')}</tbody></table>
<p><b>0 档：最低档敌人，0 资金 + 1 件藏品。</b>0–2 资金掉 1 件，3 资金掉 2 件，4–5 资金掉 3 件；稀有度混合随机。只有真实击杀结算，逃脱不掉落。</p>
<p>新手祭司学徒、见习祭司学徒、小跑的斐迪庇第斯、自制投石机、翻新投石机均从第 7 回合起进入常规群系池。</p></main></html>`);
console.log(JSON.stringify({output,checkedWaves,templates:rows.length,normalCounts:rows.filter(r=>r.round<14).map(r=>({round:r.round,original:r.originalTotal,custom:r.total}))},null,2));
