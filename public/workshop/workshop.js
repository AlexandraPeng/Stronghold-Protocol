import { t } from '../../shared/i18n.js';
import { defaultWorkshop, validateWorkshop, parseWorkshop, STAT_LIMITS } from '/shared/workshop.js';
import { compileWorkshop, enemyCoverage } from '/sim/workshop.js';
import { DataSource, setSimData } from '/sim/simdata.js';
import { Grid } from '/sim/grid.js';

const $ = id => document.getElementById(id);
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const labels = {maxHp:'生命',atk:'攻击',def:'防御',res:'法抗',bat:'攻击间隔',aspd:'攻速',moveSpeed:'移速',blockCnt:'阻挡数',massLevel:'重量',atkPct:'攻击比例（0.1=10%）',defFlat:'防御增量',resFlat:'法抗增量'};
const storageKey = 'stronghold.workshop.v1';
let raw, catalog, ds, doc = defaultWorkshop(), battle = null, paused = false, last = 0, accumulator = 0;
let projects = [], enemyPage = 0, savedSnapshot = null, battleSnapshot = null, assets = {}, savedLabel = '空白作品';
const pageSize = 80;
function snapshot() {
  return JSON.stringify({...doc,name:$('name').value,stageId:$('stage').value,seed:Number($('seed').value),duration:Number($('duration').value),allowIncomplete:$('incomplete').checked});
}
function overview() {
  $('allyCount').textContent=`${doc.allies.length} / 32`;
  $('enemyCount').textContent=`${doc.waves.reduce((n,w)=>n+Number(w.count||0),0)} / 300`;
  $('waveCount').textContent=`${doc.waves.length} / 100`;
  const end=Math.max(0,...doc.waves.map(w=>Number(w.time)+Math.max(0,w.count-1)*w.interval));
  $('lastSpawn').textContent=doc.waves.length?`${end.toFixed(1)} 秒`:'—';
  $('lastSpawn').classList.toggle('late-spawn',end>Number($('duration').value));
  $('lastSpawn').title=end>Number($('duration').value)?'最后出场晚于试战时限，部分敌人不会出场。':'按出场时间、间隔和数量计算';
  $('saveState').textContent=savedSnapshot===snapshot()?savedLabel:'有未保存的配置';
  $('pause').disabled=!battle||battle.finished;
  $('stop').disabled=!battle;
  $('pause').textContent=paused?'继续':'暂停';
  $('battleState').textContent=battle?(battleSnapshot!==snapshot()?'配置已修改。当前战斗仍使用启动时的配置，请重新试战应用。':battle.finished?'试战已结束，可调整配置后再次运行。':paused?'试战已暂停。':'正在使用启动时的配置进行本地试战。'):'配置预览 · 修改完成后点击开始试战。';
  const timeline=$('timeline');timeline.replaceChildren();
  for(const [i,w] of doc.waves.entries()) {
    const row=el('div',null,'timeline-row'),label=el('span',`${i+1}. ${catalog.enemies[w.enemyKey]?.name??w.enemyKey}`,'timeline-label');
    label.title=`${label.textContent} · ${w.count} 名 · 第 ${w.lane} 行`;
    label.append(el('small',`${w.count} 名 · 第 ${w.lane} 行`));
    const track=el('div',null,'timeline-track'),bar=el('div',null,'timeline-bar');
    bar.style.left=`${Math.max(0,Math.min(100,w.time/(end||1)*100))}%`;
    bar.style.width=`${Math.max(0,Math.min(100,(w.count-1)*w.interval/(end||1)*100))}%`;
    track.append(bar);row.append(label,track,el('span',`${w.time}s`,'timeline-time'));timeline.append(row);
  }
}
function empty(area,title,detail) {
  if(area.children.length)return;
  const box=el('div',null,'empty');box.append(el('strong',title),el('span',detail));area.append(box);
}
function portrait(parent, url) {
  if(!url)return;
  const image=el('img');image.src=url;image.alt='';image.className='unit-portrait';image.loading='lazy';image.onerror=()=>image.remove();parent.prepend(image);
}
function discardAllowed() {return savedSnapshot===snapshot()||confirm('当前配置尚未保存，继续会替换当前作品。是否继续？');}
function resetBattle() {battle=null;battleSnapshot=null;paused=false;accumulator=0;$('metrics').textContent='尚未开始';$('results').replaceChildren();$('warnings').textContent='';draw();overview();}

function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function act(fn) { return async (...args) => { try { await fn(...args); overview(); } catch(e) { status(e.message, true); } }; }
function option(select, value, label) { select.append(new Option(label, value)); }
function field(parent, name, value, onChange, options = {}) {
  const label = el('label', name), input = el('input'); input.type = options.type ?? 'number'; input.value = value ?? '';
  if (options.min != null) input.min = options.min; if (options.max != null) input.max = options.max;
  input.step = options.step ?? 'any'; input.onchange = () => {onChange(input.type === 'number' ? (input.value === '' ? null : Number(input.value)) : input.value);overview();};
  label.append(input); parent.append(label); return input;
}
function pick(parent, name, values, current, onChange) {
  const label = el('label', name), select = el('select'); for(const [v,t] of values) option(select,v,t); select.value = String(current); select.onchange = () => {onChange(select.value);overview();}; label.append(select); parent.append(label); return select;
}
function button(parent, text, fn) {const b=el('button',text);b.onclick=act(fn);parent.append(b);return b;}
function params(parent, title, values, defaults = {}, names = null, bounds = STAT_LIMITS) {
  const details=el('details'), summary=el('summary',title), area=el('div',null,'params'); details.append(summary,area);parent.append(details);
  for(const key of names ?? [...new Set([...Object.keys(defaults),...Object.keys(values)])]) {
    const limits=bounds[key];
    const input=field(area,labels[key] ?? key,values[key],v=>{if(v==null)delete values[key];else values[key]=v;},{min:limits?.[0],max:limits?.[1]});
    input.placeholder=String(defaults[key] ?? '默认');input.title='留空沿用默认值';
  }
  if(!area.children.length)area.append(el('p','没有可编辑的数值参数','hint'));
}
function ruleEditor(parent, unit, redraw) {
  unit.rules ??= [];
  const details=el('details'),summary=el('summary',`附加自定义技能（${unit.rules.length}/6）`);details.append(summary);parent.append(details);
  details.append(el('p','用户设计的定时技能，叠加在原技能上。数值为固定值；昏迷、沉默时暂停。每次按距离选择目标，同源增益刷新持续时间，不叠加。','hint'));
  for(const [i,r] of unit.rules.entries()){
    const card=el('div',null,'card'),row=el('div',null,'row');details.append(card);card.append(row);
    field(row,'名称',r.name,v=>r.name=v,{type:'text'});
    pick(row,'效果',[['damage','伤害'],['heal','治疗'],['shield','护盾'],['atkBuff','攻击增加'],['defBuff','防御增加'],['aspdBuff','攻速增加']],r.effect,v=>r.effect=v);
    pick(row,'目标',[['self','自身'],['friendly','同侧单位'],['hostile','对侧单位']],r.target,v=>r.target=v);
    pick(row,'伤害类型',[['phys','物理'],['arts','法术'],['true','真实']],r.damageType,v=>r.damageType=v);
    field(row,'数值',r.amount,v=>r.amount=v,{min:0,max:1e6});field(row,'间隔（秒）',r.interval,v=>r.interval=v,{min:.5,max:120});
    field(row,'初始延迟',r.delay,v=>r.delay=v,{min:0,max:600});field(row,'半径（格）',r.radius,v=>r.radius=v,{min:0,max:20});
    field(row,'持续（增益/盾）',r.duration,v=>r.duration=v,{min:.1,max:120});field(row,'最多目标',r.maxTargets,v=>r.maxTargets=v,{min:1,max:30,step:1});
    button(card,'移除附加技能',()=>{unit.rules.splice(i,1);redraw();});
  }
  if(unit.rules.length<6)button(details,'添加附加技能',()=>{unit.rules.push({name:'自定义技能',effect:'damage',target:'hostile',damageType:'arts',amount:100,interval:5,delay:1,radius:2,duration:3,maxTargets:1});redraw();});
}
function canonical() {
  doc.name=$('name').value;doc.stageId=$('stage').value;doc.seed=Number($('seed').value);doc.duration=Number($('duration').value);doc.allowIncomplete=$('incomplete').checked;
  return validateWorkshop(doc);
}
function projectList() {const s=$('projects');s.replaceChildren();for(const p of projects)option(s,p.id,p.doc.name);}
function refresh() {
  $('name').value=doc.name;$('stage').value=doc.stageId;$('seed').value=doc.seed;$('duration').value=doc.duration;$('incomplete').checked=doc.allowIncomplete;
  drawAllies();drawWaves();drawLayers();drawCustomAlliances();resetBattle();
}
function allianceMembership(parent,unit){
  unit.alliances??=[];if(!doc.customAlliances?.length)return;
  const details=el('details'),area=el('div',null,'bonds');details.append(el('summary','自定义盟约归属'),area);parent.append(details);
  for(const b of doc.customAlliances){const label=el('label',b.name),input=el('input');input.type='checkbox';input.checked=unit.alliances.includes(b.id);input.onchange=()=>{unit.alliances=input.checked?[...unit.alliances,b.id]:unit.alliances.filter(x=>x!==b.id);};label.prepend(input);area.append(label);}
}
function drawCustomAlliances(){
  const area=$('customAlliances');area.replaceChildren();
  if(!doc.customAlliances?.length)empty(area,'设计自己的阵营规则','创建盟约后，可在双方单位卡片中分配成员。');
  for(const [i,b] of (doc.customAlliances??[]).entries()){
    const card=el('div',null,'card'),row=el('div',null,'row');card.append(row);area.append(card);
    field(row,'盟约名称',b.name,v=>{b.name=v;drawAllies();drawWaves();},{type:'text'});field(row,'需要成员数',b.need,v=>b.need=v,{min:1,max:300,step:1});field(row,'初始层数',b.layers,v=>b.layers=v,{min:0,max:10000,step:1});
    const limits={atkPct:[-.9,10],defFlat:[-1e5,1e5],resFlat:[-100,100],aspd:[-99,1000]};
    params(card,'基础增益',b.mods,{},Object.keys(limits),limits);params(card,'每层增加',b.perLayer,{},Object.keys(limits),limits);
    button(card,'删除盟约',()=>{doc.customAlliances.splice(i,1);for(const u of [...doc.allies,...doc.waves])u.alliances=(u.alliances??[]).filter(id=>id!==b.id);drawCustomAlliances();drawAllies();drawWaves();});
  }
}
function allyOptions() {
  const q=$('allySearch').value.toLowerCase(),s=$('allyPick');s.replaceChildren();
  for(const [id,c] of Object.entries(raw.chess)) if(c.stats&&`${c.name} ${id}`.toLowerCase().includes(q)) option(s,id,`${c.name} · ${c.isGolden?'精锐':'普通'} · ${id}`);
  $('addAlly').disabled=!s.options.length;
}
function enemyOptions(reset = true) {
  if(reset)enemyPage=0;
  const q=$('enemySearch').value.trim().toLowerCase(),filter=$('coverageFilter').value,s=$('enemyPick');s.replaceChildren();
  const matches=Object.values(catalog.enemies).filter(e=>`${e.name} ${e.key}`.toLowerCase().includes(q)&&(!filter||enemyCoverage(e.key).state===filter));
  const pages=Math.max(1,Math.ceil(matches.length/pageSize));enemyPage=Math.min(enemyPage,pages-1);
  for(const e of matches.slice(enemyPage*pageSize,(enemyPage+1)*pageSize))option(s,e.key,`${e.name} · ${e.key}`);
  $('catalogInfo').textContent=`全目录 ${Object.keys(catalog.enemies).length} 项 · 匹配 ${matches.length} 项 · 每页 ${pageSize} 项`;
  $('enemyPage').textContent=`${enemyPage+1} / ${pages}`;
  $('enemyPrev').disabled=enemyPage===0;$('enemyNext').disabled=enemyPage>=pages-1;$('addEnemy').disabled=!matches.length;
  enemyInfo();
}
function enemyInfo() {
  const box=$('enemyInfo'),e=catalog.enemies[$('enemyPick').value];box.replaceChildren();if(!e)return;
  const c=enemyCoverage(e.key);box.append(el('h3',e.name),el('div',c.label,'badge'),el('p',c.detail,'hint'));
  portrait(box,assets.enemies?.[e.key]?.icon);
  const link=el('a','查看 PRTS 资料');link.href=e.wiki;link.target='_blank';link.rel='noreferrer';box.append(link);
}
function drawAllies() {
  const area=$('allies');area.replaceChildren();if(!doc.allies.length)empty(area,'编队等待部署','搜索干员并添加，再设置位置、技能与盟约。');
  doc.allies.forEach((a,i)=>{
    const card=el('div',null,'card'),head=el('div',null,'card-head');area.append(card);card.append(head);
    const def=ds.getChess(a.chessId,a.skillIndex==null?null:{skillIndex:a.skillIndex});head.append(el('h3',`${i+1}. ${def?.name ?? a.chessId}`));button(head,'移除',()=>{doc.allies.splice(i,1);drawAllies();draw();});
    const art=assets.chars?.[raw.chess[a.chessId]?.charId];portrait(head,art?.portrait??art?.avatar);
    const row=el('div',null,'row');card.append(row);field(row,'行',a.row,v=>{a.row=v;draw();},{min:9,max:12,step:1});field(row,'列',a.col,v=>{a.col=v;draw();},{min:2,max:8,step:1});
    pick(row,'朝向',[['RIGHT','右'],['LEFT','左'],['UP','上'],['DOWN','下']],a.dir,v=>a.dir=v);
    const skills=raw.chess[a.chessId]?.skills??[];
    pick(row,'技能',[['','默认技能'],...skills.map(s=>[s.index??s.skillIndex,`S${(s.index??s.skillIndex)+1} ${s.name}`])],a.skillIndex??'',v=>{a.skillIndex=v===''?null:Number(v);a.skillParams={};drawAllies();});
    params(card,'属性覆盖（留空使用原值）',a.stats,def?.stats,Object.keys(STAT_LIMITS));
    params(card,'当前技能的数值参数',a.skillParams,def?.skill?.bb);
    ruleEditor(card,a,drawAllies);
    allianceMembership(card,a);
    const details=el('details'),summary=el('summary','盟约归属');details.append(summary);card.append(details);
    const toggle=el('label','自定义盟约','notice'),check=el('input');check.type='checkbox';check.checked=a.customBonds;toggle.prepend(check);details.append(toggle);
    check.onchange=()=>{a.customBonds=check.checked;if(a.customBonds&&!a.bonds.length)a.bonds=[...(def?.bonds??[])];drawAllies();};
    const group=el('div',null,'bonds');details.append(group);
    for(const [id,b] of Object.entries(raw.bonds)) {const label=el('label',b.name),input=el('input');input.type='checkbox';input.checked=(a.customBonds?a.bonds:def?.bonds??[]).includes(id);input.disabled=!a.customBonds;input.onchange=()=>{a.bonds=input.checked?[...a.bonds,id]:a.bonds.filter(x=>x!==id);};label.prepend(input);group.append(label);}
  });
}
function drawWaves() {
  const area=$('waves');area.replaceChildren();if(!doc.waves.length)empty(area,'暂无敌方波次','从目录添加敌人，安排数量、路线和出场时间。');
  doc.waves.forEach((w,i)=>{
    const entry=catalog.enemies[w.enemyKey],rec=w.useCatalog?entry?.levels.find(x=>x.level===w.level):raw.enemies[w.enemyKey];
    const card=el('div',null,'card enemy'),head=el('div',null,'card-head');area.append(card);card.append(head);head.append(el('h3',`${i+1}. ${entry?.name??w.enemyKey}`));button(head,'复制',()=>{
      if(doc.waves.length>=100)throw new Error('最多 100 条波次');
      if(doc.waves.reduce((n,x)=>n+x.count,0)+w.count>300)throw new Error('一次试战最多 300 名敌人');
      doc.waves.splice(i+1,0,structuredClone(w));drawWaves();
    });button(head,'移除',()=>{doc.waves.splice(i,1);drawWaves();}).className='remove';
    portrait(head,assets.enemies?.[w.enemyKey]?.icon);
    card.append(el('div',enemyCoverage(w.enemyKey).label,'badge'));
    const row=el('div',null,'row');card.append(row);
    const sources=[...(raw.enemies[w.enemyKey]?[['game','卫戍协议数值']]:[]),...(entry?.levels??[]).map(r=>[String(r.level),`客户端 Lv.${r.level}`])];
    pick(row,'数值来源',sources,w.useCatalog?String(w.level):'game',v=>{w.useCatalog=v!=='game';w.level=v==='game'?0:Number(v);w.stats={};w.skillParams={};w.talentParams={};drawWaves();});
    field(row,'数量',w.count,v=>w.count=v,{min:1,max:100,step:1});field(row,'出场秒数',w.time,v=>w.time=v,{min:0,max:600});field(row,'间隔（秒）',w.interval,v=>w.interval=v,{min:.1,max:60});field(row,'路线行',w.lane,v=>w.lane=v,{min:9,max:12,step:1});
    field(row,'阵营分组标签',w.faction,v=>w.faction=v,{type:'text'});
    params(card,'属性覆盖',w.stats,rec?.stats,Object.keys(STAT_LIMITS));params(card,'天赋参数（需要对应行为脚本）',w.talentParams,rec?.talents?.bb);
    params(card,'技能参数（需要对应行为脚本）',w.skillParams,Object.assign({},...(rec?.skills??[]).map(s=>s.bb??{})));
    ruleEditor(card,w,drawWaves);
    allianceMembership(card,w);
  });
}
function drawLayers() {const area=$('layers');area.replaceChildren();for(const [id,b] of Object.entries(raw.bonds))field(area,b.name,doc.bondLayers[id],v=>{if(v==null)delete doc.bondLayers[id];else doc.bondLayers[id]=v;},{min:0,max:1e6,step:1});}

const canvas=$('field'),ctx=canvas.getContext('2d');
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);const size=100,x0=85,y0=28;
  const stage=ds?.getStage(doc.stageId);
  for(let r=9;r<=12;r++)for(let c=2;c<=10;c++) {
    const x=x0+(c-2)*size,y=y0+(12-r)*size;
    ctx.fillStyle=stage?.rows?.[r]?.[c]==='#'?'#34424a':'#1c323e';ctx.fillRect(x,y,size-3,size-3);ctx.fillStyle='#819ca9';ctx.font='12px system-ui';ctx.fillText(`${r},${c}`,x+5,y+17);
  }
  const units=battle?battle.units.filter(u=>u.alive&&u.deployed&&!u.hidden):doc.allies.map(a=>({name:ds?.getChess(a.chessId)?.name??a.chessId,pos:[a.row,a.col],kind:'op',hp:1,s:{maxHp:1}}));
  for(const u of units) {
    const row=u.pos?.[0]??u.y,col=u.pos?.[1]??u.x;
    if(!Number.isFinite(row)||!Number.isFinite(col))continue;
    const x=x0+(col-2+.5)*size,y=y0+(12-row+.5)*size;
    ctx.beginPath();ctx.arc(x,y,17,0,Math.PI*2);ctx.fillStyle=u.kind==='enemy'?'#f19882':'#61dbc7';ctx.fill();
    ctx.fillStyle='#071015';ctx.fillRect(x-28,y-30,56,5);ctx.fillStyle='#8ce6a0';ctx.fillRect(x-28,y-30,56*Math.max(0,Math.min(1,u.hp/u.s.maxHp)),5);
    ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.fillText(u.name??u.defId,x,y+34,96);ctx.textAlign='left';
  }
}
function frame(t) {
  const dt=Math.min((t-last)/1000,.1);last=t;
  if(battle&&!paused&&!battle.finished){
    accumulator+=dt*Number($('speed').value);
    try {while(accumulator>=1/30&&!battle.finished){battle.step();battle.drainEvents();accumulator-=1/30;}
      if(battle.errorCount)throw new Error('试战脚本出现内部错误，请查看控制台。该结果不可作为机制正确的依据。');
      $('metrics').textContent=`${battle.time.toFixed(1)} 秒 · 击败 ${battle.killed}/${battle.total}${battle.finished?' · 已结束':''}`;
      if(battle.finished){overview();const result=battle.result(),p=result.perPlayer.workshop,box=$('results');box.replaceChildren();box.append(el('p',`结束原因：${['timeLimit','timeout'].includes(result.reason)?'到达时限':result.reason==='cleared'?'波次结束':result.reason} · 漏怪 ${p?.leaked.length??0} · 尚未出场 ${result.unspawned?.length??0}`));for(const u of p?.unitStats??[])box.append(el('p',`${u.name}：伤害 ${u.dmg.toLocaleString()} / 治疗 ${u.heal.toLocaleString()} / 击败 ${u.kills}`));}
      draw();
    }catch(e){paused=true;overview();status(e.message,true);}
  }
  requestAnimationFrame(frame);
}
async function main() {
  try { const r=await fetch('/data/assets.json');if(r.ok)assets=await r.json(); } catch { /* Art is optional; configuration and trial remain usable. */ }
  const files=['chess','enemies','tokens','stages','waves','bonds','items','garrisons','bands','effects','backups'];raw={};
  await Promise.all(files.map(async n=>{const r=await fetch(`/data/${n}.json`);if(!r.ok)throw new Error(`${n} 加载失败：${r.status}`);raw[n]=await r.json();}));
  const r=await fetch('/data/workshop-enemies.json');if(!r.ok)throw new Error('敌人目录加载失败');catalog=await r.json();setSimData(raw);ds=new DataSource(raw,null);
  const counts={existing:0,basic:0,partial:0,missing:0};for(const e of Object.values(catalog.enemies))counts[enemyCoverage(e.key).state]++;
  $('coverageInfo').textContent=`已有专属脚本 ${counts.existing} · 已有基础行为 ${counts.basic} · 明确不完整 ${counts.partial} · 尚无专属脚本 ${counts.missing}。这不是完整 Wiki 机制验收结果。`;
  $('coverageExport').onclick=act(()=>{const report={generatedAt:new Date().toISOString(),sources:catalog.sources,counts,enemies:Object.values(catalog.enemies).map(e=>({key:e.key,name:e.name,wiki:e.wiki,...enemyCoverage(e.key),skillPrefabs:[...new Set(e.levels.flatMap(r=>r.skills.map(s=>s.prefabKey)))],wikiVerified:false}))};const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download='workshop-mechanic-coverage.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  for(const [id,s] of Object.entries(raw.stages))option($('stage'),id,s.name??id);
  try{const saved=JSON.parse(localStorage.getItem(storageKey)??'[]');if(!Array.isArray(saved))throw new Error();projects=saved.map(p=>({id:p.id,doc:validateWorkshop(p.doc)}));}catch{status('本机保存记录无法读取。可通过导入配置恢复。',true);}
  projectList();allyOptions();enemyOptions();refresh();
  $('enemyPrev').onclick=()=>{enemyPage--;enemyOptions(false);};
  $('enemyNext').onclick=()=>{enemyPage++;enemyOptions(false);};
  $('sortWaves').onclick=act(()=>{doc.waves.sort((a,b)=>a.time-b.time);drawWaves();});
  $('stop').onclick=()=>{resetBattle();status('已返回配置预览');};
  document.querySelector('main').addEventListener('change',()=>queueMicrotask(overview));
  for(const id of ['name','seed','duration'])$(id).addEventListener('input',overview);
  window.addEventListener('beforeunload',e=>{if(savedSnapshot!==snapshot()){e.preventDefault();e.returnValue='';}});
  $('allySearch').oninput=allyOptions;$('enemySearch').oninput=enemyOptions;$('coverageFilter').onchange=enemyOptions;$('enemyPick').onchange=enemyInfo;
  $('addAlliance').onclick=act(()=>{doc.customAlliances??=[];if(doc.customAlliances.length>=16)throw new Error('最多 16 个自定义盟约');doc.customAlliances.push({id:`custom_${Date.now()}`,name:`自定义盟约 ${doc.customAlliances.length+1}`,need:2,layers:0,mods:{atkPct:.2},perLayer:{}});drawCustomAlliances();drawAllies();drawWaves();});
  $('stage').onchange=()=>{doc.stageId=$('stage').value;resetBattle();};
  $('addAlly').onclick=act(()=>{const chessId=$('allyPick').value;if(!chessId)throw new Error('请选择干员');const def=ds.getChess(chessId);let cell=null;
    const grid=new Grid(ds.getStage($('stage').value),{r0:9,r1:12,c0:2,c1:10});
    for(let row=9;row<=12&&!cell;row++)for(let col=3;col<=8;col++)if(grid.canStand(row,col,{ranged:def.position==='RANGED'})&&!doc.allies.some(a=>a.row===row&&a.col===col)){cell={row,col};break;}
    if(!cell)throw new Error('编队位置已满');if(doc.allies.length>=32)throw new Error('最多 32 名我方单位');doc.allies.push({chessId,...cell,dir:'RIGHT',skillIndex:null,stats:{},skillParams:{},bonds:[...def.bonds],customBonds:false});drawAllies();resetBattle();});
  $('addEnemy').onclick=act(()=>{const enemyKey=$('enemyPick').value;if(!enemyKey)throw new Error('请选择敌人');if(doc.waves.length>=100||doc.waves.reduce((n,w)=>n+w.count,0)+5>300)throw new Error('最多 100 条波次、300 名敌人');doc.waves.push({enemyKey,level:catalog.enemies[enemyKey].levels[0].level,useCatalog:!raw.enemies[enemyKey],count:5,time:0,interval:2,lane:9,faction:'敌方',stats:{},talentParams:{},skillParams:{}});drawWaves();});
  $('new').onclick=act(()=>{if(!discardAllowed())return;doc=defaultWorkshop();refresh();savedSnapshot=snapshot();savedLabel='空白作品';status('已创建空白作品。添加配置后可保存到本机。');});
  $('save').onclick=act(()=>{doc=canonical();const existing=projects.find(p=>p.doc.name===doc.name);if(existing)existing.doc=structuredClone(doc);else projects.push({id:crypto.randomUUID?.()??`${Date.now()}-${Math.random()}`,doc:structuredClone(doc)});localStorage.setItem(storageKey,JSON.stringify(projects));projectList();$('projects').value=projects.find(p=>p.doc.name===doc.name).id;savedSnapshot=snapshot();savedLabel='已保存到本机';status(`已保存「${doc.name}」到本机`);});
  $('load').onclick=act(()=>{const p=projects.find(p=>p.id===$('projects').value);if(!p)throw new Error('请选择已保存作品');if(!discardAllowed())return;doc=validateWorkshop(p.doc);refresh();savedSnapshot=snapshot();savedLabel='已保存到本机';status(`已读取「${doc.name}」`);});
  $('export').onclick=act(()=>{const d=canonical(),url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download=`${d.name.replace(/[<>:"/\\|?*]/g,'_')||'workshop'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('配置已导出');});
  $('import').onchange=act(async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>2*1024*1024)throw new Error('文件不能超过 2 MB');const next=parseWorkshop(await file.text());if(!discardAllowed())return;doc=next;refresh();savedSnapshot=null;status(`已导入「${doc.name}」，可保存到本机`);});
  $('run').onclick=act(()=>{doc=canonical();const compiled=compileWorkshop(doc,ds,catalog,raw.bonds);battle=compiled.create();battleSnapshot=snapshot();paused=false;accumulator=0;$('warnings').textContent=compiled.warnings.join('\n');$('results').textContent='';status('本地试战已开始');draw();});
  $('pause').onclick=()=>{if(!battle||battle.finished)return;paused=!paused;overview();status(paused?'试战已暂停':'试战继续');};
  window.__workshop={get doc(){return doc;},get battle(){return battle;},catalog,compile:()=>compileWorkshop(canonical(),ds,catalog,raw.bonds),setDoc:d=>{doc=validateWorkshop(d);battle=null;refresh();}};
  savedSnapshot=snapshot();overview();status('工坊已就绪。先添加干员和敌方波次，再开始试战。');requestAnimationFrame(frame);
}
main().catch(e=>status(`工坊加载失败：${e.message}`,true));

const waveEditorLink = document.createElement('a');
waveEditorLink.href='./waves.html';waveEditorLink.textContent=t('波次与悬赏编辑器');
document.querySelector('.section-nav').append(waveEditorLink);
