import { enemyIconUrl } from '../js/ui/assetUrls.js';
import { mountRoundReference } from './round-reference.js';
import { mountRoutes } from './wave-routes.js';
import { BASE_RELICS, editableRelicParams, assignDefaults, relicParamBounds, relicWeight, relicDrops } from '../../shared/relicTuning.js';
import { mountFormulaGuide } from './tuning-formulas.js';
import { UNITE_TUNING } from '../../shared/uniteTuning.js';
import { validateUniteTuning } from '../../shared/uniteTuningSchema.js';
import { t } from '../../shared/i18n.js';
import { initLang } from '../js/ui/lang.js';

const STORAGE = 'sp.workshop.uniteTuning.v1';
const root = document.getElementById('editor');
const node = (tag, text, cls) => { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n; };
const link = (text, href) => { const a=node('a',text);a.href=href;return a; };
const button = (text, action) => {const b=node('button',text);b.type='button';b.onclick=()=>{try { action(); }catch(e){status(e.message,true);}};return b;};
const table = (head) => {const wrap=node('div',undefined,'scroll'),tbl=node('table'),tr=node('tr');head.forEach(h=>tr.append(node('th',h)));tbl.append(tr);wrap.append(tbl);return {wrap,tbl};};
const cell = value => {const td=node('td');td.append(value instanceof Node?value:document.createTextNode(String(value)));return td;};
const row = (tbl,values) => {const tr=node('tr');values.forEach(v=>tr.append(cell(v)));tbl.append(tr);};
let config=structuredClone(UNITE_TUNING), enemies={}, waves={}, catalog={}, choices={}, bosses={}, stages={}, assets={}, refreshRound=null, dirty=false, statusNode;
function status(message,error=false){statusNode.textContent=message;statusNode.className=`status${error?' error':''}`;}
function changed(){dirty=true;status(t('有未保存的修改'));refreshRound?.();}
function number(value,onChange,min=0,max=600,step='1',label=''){const e=node('input');e.type='number';e.value=value;e.min=min;e.max=max;e.step=step;e.setAttribute('aria-label',label);e.oninput=()=>{onChange(e.value===''?NaN:Number(e.value));changed();};return e;}
function section(id,title){const s=node('section');s.id=id;s.append(node('h2',title));root.append(s);return s;}
function name(key){return enemies[key]?.name||catalog.enemies?.[key]?.name||key;}
function enemyLabel(key){const box=node('div',undefined,'enemy-identity'),art=node('span',name(key).slice(0,1),'enemy-portrait'),info=node('div');const url=enemyIconUrl(assets,key);if(url){const img=node('img');img.src=url;img.alt=name(key);img.loading='lazy';img.onerror=()=>img.remove();art.append(img);}info.append(node('div',name(key)),node('code',key));const wiki=catalog.enemies?.[key]?.wiki;if(/^https:\/\/prts\.wiki\//.test(wiki||'')){const a=link('Wiki',wiki);a.target='_blank';a.rel='noreferrer';info.append(a);}box.append(art,info);return box;}

function check(){return validateUniteTuning(config,enemies,waves,choices,stages);}
function safeReplace(value){const valid=validateUniteTuning(value,enemies,waves,choices,stages);if(dirty&&!confirm(t('放弃未保存的修改？')))return;config=valid;dirty=false;render();}
function exportJson(){const doc=check(),blob=new Blob([JSON.stringify(doc,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=link('',url);a.download='unite-tuning.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status(t('已导出；使用应用命令后生效'));}
function render(){
 root.replaceChildren();refreshRound=null;
 const head=node('header'),brand=node('div');brand.append(node('small','STRONGHOLD PROTOCOL / FIELD ARCHIVE'),node('h1',t('波次与悬赏编辑器')));head.append(brand,link(t('返回游戏'),'/'),link(t('创意工坊'),'/workshop/index.html'));root.append(head);
 const nav=node('nav');[[t('每回合参考'),'round-reference'],[t('悬赏概率与资金'),'bounty'],[t('群系与波次'),'waves'],[t('收藏品数值与概率'),'relics'],[t('计算公式与示例'),'formulas'],[t('Wiki 原始资料（只读）'),'wiki'],[t('保存与应用'),'apply']].forEach(([s,id])=>nav.append(link(s,`#${id}`)));root.append(nav);
 statusNode=node('div',t('当前显示仓库配置；草稿不会自动应用到对局'),'status');statusNode.setAttribute('role','status');root.append(statusNode);
 const bar=node('div',undefined,'toolbar');bar.append(button(t('保存草稿'),()=>{localStorage.setItem(STORAGE,JSON.stringify(check()));dirty=false;status(t('草稿已保存到当前浏览器'));}),button(t('读取草稿'),()=>{const value=localStorage.getItem(STORAGE);if(!value)throw new Error(t('没有本地草稿'));safeReplace(JSON.parse(value));status(t('已读取草稿'));}),button(t('导出配置'),exportJson),button(t('恢复仓库配置'),()=>safeReplace(UNITE_TUNING)));
 const file=node('label',t('导入配置'),'file'),input=node('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{const f=input.files[0];if(!f)return;if(f.size>1024*1024)throw new Error(t('文件过大'));safeReplace(JSON.parse(await f.text()));status(t('导入成功；尚未应用到游戏'));}catch(e){status(e.message,true);}finally{input.value='';}};file.append(input);bar.append(file);root.append(bar);
 const roundPanel=section('round-reference',t('每回合参考'));bountySection();waveSection();refreshRound=mountRoundReference(roundPanel,{config,waves,enemyLabel,openTemplate:id=>{const select=root.querySelector('[aria-label="'+t('各回合波次模板')+'"]');select.value=id;select.onchange();select.scrollIntoView({block:'start'});}});relicSection();mountFormulaGuide(section,config,enemies);wikiSection();applySection();
 root.append(node('footer','STRONGHOLD / LOCAL EDITOR · v1'));
}
function bountySection(){
 const s=section('bounty',t('悬赏概率与资金'));
 s.append(node('p',t('每回合九选一；先抽资金档位，再抽敌人。同一敌人不重复，已抽空的档位会重新归一化。'),'hint'));
 const {wrap,tbl}=table([t('回合'),...Array.from({length:6},(_,i)=>`${i} ${t('资金')} (%)`),t('合计')]);
 config.probabilities.forEach((weights,i)=>{const total=node('span',`${weights.reduce((a,b)=>a+b,0)}%`,'gold');row(tbl,[['1–3','4–6','7–15'][i],...weights.map((v,j)=>{const n=number(v,x=>{weights[j]=x;total.textContent=`${weights.reduce((a,b)=>a+b,0)}%`;},0,100,'0.1',`${i+1}/${j}`);n.disabled=j>(i===0?2:i===1?3:5);return n;}),total]);});s.append(wrap);
 s.append(node('p',t('藏品数量与单件掉落概率可在收藏品区域修改；0 资金候选仍为最低档敌人。'),'hint'));
 const bt=table([t('自定义悬赏敌人'),t('击杀资金'),t('藏品数量')]);
 config.bounties.forEach(b=>{const drops=node('span',String(relicDrops(b.coins,config)));drops.dataset.bountyKey=b.enemyKey;row(bt.tbl,[enemyLabel(b.enemyKey),b.enemyKey==='enemy_2028_syevil'?t('随配对敌人结算'):number(b.coins,x=>{b.coins=x;drops.textContent=String(relicDrops(x,config));},1,5,'1',name(b.enemyKey)),drops]);});s.append(bt.wrap);
 const detail=node('details');detail.append(node('summary',t('基础悬赏资金')));const base=table([t('敌人'),t('资金'),t('数量')]);(choices.cards?.bounty||[]).filter(c=>c.payout==='kill'&&c.coin>=1&&c.coin<=2&&c.rounds===1&&c.count===1).filter((c,i,a)=>a.findIndex(x=>x.enemyKey===c.enemyKey)===i).forEach(c=>row(base.tbl,[enemyLabel(c.enemyKey),number(config.baseCoins[c.enemyKey]??c.coin,x=>config.baseCoins[c.enemyKey]=x,1,5,'1',name(c.enemyKey)),c.count]));detail.append(base.wrap);s.append(detail);
}
function waveSection(){
 const s=section('waves',t('群系与波次'));s.append(node('p',t('只影响终极难度·联防可叠层。常规敌人来自同一群系；飞行路线筛选与战力折算继续生效。'),'hint'));
 const grid=node('div',undefined,'grid');
 config.groups.forEach(g=>{const c=node('div',undefined,'card');c.append(node('h3',`${g.id} · ${g.type} · ${g.halves.join(' / ')}`));for(const field of ['keys','lateKeys']){const label=node('label',field==='keys'?t('群系敌人编号（每行一个）'):t('第 8 回合起追加的敌人'));const area=node('textarea');area.value=(g[field]||[]).join('\n');area.onchange=()=>{g[field]=area.value.split(/\s+/).filter(Boolean);changed();};label.append(area);c.append(label);}c.append(node('p',g.keys.map(name).join(' / '),'hint'));grid.append(c);});s.append(grid);
 const limits=table([t('敌人'),t('最早回合'),t('单条波次数量上限')]);
 [...new Set([...config.groups.flatMap(g=>[...g.keys,...g.lateKeys]),...Object.keys(config.minRound),...Object.keys(config.maxActionCount)])].forEach(key=>row(limits.tbl,[enemyLabel(key),number(config.minRound[key]??1,x=>config.minRound[key]=x,1,15,'1',`${name(key)} min`),number(config.maxActionCount[key]??5,x=>config.maxActionCount[key]=x,1,5,'1',`${name(key)} max`)]));s.append(limits.wrap);
 s.append(node('h3',t('各回合波次模板')));
 const select=node('select'),body=node('div');select.setAttribute('aria-label',t('各回合波次模板'));
 Object.values(waves).filter(w=>w.usedBy?.some(u=>u.modeId==='mode_multi_abyss')).sort((a,b)=>Math.min(...a.usedBy.map(u=>u.round))-Math.min(...b.usedBy.map(u=>u.round))).forEach(w=>{const o=node('option',`${[...new Set(w.usedBy.filter(u=>u.modeId==='mode_multi_abyss').map(u=>u.round))].join('/')} · ${w.id} · ${w.bossId?bosses[w.bossId]?.name||w.bossId:w.kind}`);o.value=w.id;select.append(o);});
 const draw=()=>{body.replaceChildren();const w=waves[select.value];if(!w)return;const tb=table([t('模板敌人'),t('基础数量'),t('出现时间'),t('间隔'),t('路线')]);w.spawns.forEach((a,i)=>{const locked=!!(a.tag||a.unharmful),patch=config.templates[w.id]?.[i]||{},fields=['count','time','interval'].map(k=>{if(locked)return a[k]??(k==='count'?1:0);return number(patch[k]??a[k]??(k==='count'?1:0),v=>{config.templates[w.id]??={};config.templates[w.id][i]??={};config.templates[w.id][i][k]=v;},k==='count'?1:0,k==='count'?50:600,k==='count'?'1':'0.1',`${i} ${k}`);});row(tb.tbl,[enemyLabel(a.key),...fields,`${a.routeIndex} · ${w.routes[a.routeIndex]?.motion} ${locked?'🔒':''}`]);});body.append(tb.wrap);mountRoutes(body,w,config,stages,changed);};select.onchange=draw;draw();s.append(select,body,node('p',t('这里编辑基础模板，不是最终出怪数；最终数量仍按敌人战力、路线与上限折算。领袖本体和部件只读。'),'hint'));
}
function relicSection(){
 const s=section('relics',t('收藏品数值与概率'));
 s.append(node('p',t('仅开放已适配藏品。权重为 0 表示不掉落；每件独立抽取，可重复。原始说明只读，数值字段为实际生效参数。招募券固定招募一人，不开放无效的券数量编辑。'),'hint'));
 const dt=table([t('悬赏资金'),t('击杀掉落件数')]);
 for(let coin=0;coin<6;coin++) row(dt.tbl,[coin,number(relicDrops(coin,config),v=>{config.relicDrops??=[1,1,1,2,3,3];config.relicDrops[coin]=v;for(const el of root.querySelectorAll('[data-bounty-key]')){const b=config.bounties.find(b=>b.enemyKey===el.dataset.bountyKey);el.textContent=String(relicDrops(b.coins,config));}},0,3,'1',`drops ${coin}`)]);
 s.append(dt.wrap);
 const search=node('input');search.type='search';search.placeholder=t('搜索收藏品名称 / 编号');search.setAttribute('aria-label',search.placeholder);
 const result=node('div'),summary=node('p',undefined,'gold');s.append(search,summary,result);
 const probabilities=[];
 function refresh(){const total=BASE_RELICS.reduce((n,r)=>n+relicWeight(r.id,config),0);summary.textContent=`${t('总权重')}: ${total}`;for(const [id,el] of probabilities) el.textContent=total>0?`${(100*relicWeight(id,config)/total).toFixed(4)}%`:'—';}
 const edit=id=>{config.relics??={};return config.relics[id]??={};};
 function draw(){result.replaceChildren();probabilities.length=0;const q=search.value.trim().toLowerCase();
 for(const r of BASE_RELICS.filter(r=>`${r.name} ${r.id}`.toLowerCase().includes(q))){
  const card=node('details',undefined,'card'),title=node('summary',`${r.name} · ${r.rarity}`);card.append(title,node('code',r.id),node('p',r.baseUsage,'hint'));
  if(/^https:\/\/prts\.wiki\//.test(r.source||'')){const a=link(t('打开 PRTS Wiki'),r.source);a.target='_blank';a.rel='noreferrer';card.append(a);}
  const chance=node('span');probabilities.push([r.id,chance]);const tb=table([t('参数'),t('原始值'),t('自定义值')]);
  row(tb.tbl,[t('掉落权重'),1,number(relicWeight(r.id,config),v=>{edit(r.id).weight=v;refresh();},0,10000,'0.01',`${r.name} weight`)]);
  row(tb.tbl,[t('每件抽取概率'),`${(100/BASE_RELICS.length).toFixed(4)}%`,chance]);
  for(const param of editableRelicParams(r)) {const [lo,hi]=relicParamBounds(param.param);row(tb.tbl,[`${param.key} / ${r.buffs[Number(param.path.split('.')[0])].params.id||r.buffs[Number(param.path.split('.')[0])].params.key||''} / ${param.param}`,param.value,number(config.relics?.[r.id]?.params?.[param.path]??param.value,v=>{edit(r.id).params??={};edit(r.id).params[param.path]=v;},lo,hi,'any',`${r.name} ${param.path}`)]);}
  for(const [key,value] of Object.entries(assignDefaults(r.id))) {const [lo,hi]=relicParamBounds(key);row(tb.tbl,[`${t('绑定干员效果')} / ${key}`,value,number(config.relics?.[r.id]?.adapter?.[key]??value,v=>{edit(r.id).adapter??={};edit(r.id).adapter[key]=v;},lo,hi,['revives','maxCasts'].includes(key)?'1':'any',`${r.name} ${key}`)]);}
  card.append(tb.wrap);result.append(card);
 }refresh();}
 search.oninput=draw;draw();
}
function wikiSection(){
 const s=section('wiki',t('Wiki 原始资料（只读）'));s.append(node('p',t('资料来自已有客户端数据快照，PRTS 链接用于核对；不是实时抓取，也不代表所有技能已完整实现。'),'hint'));
 const search=node('input');search.type='search';search.placeholder=t('搜索敌人名称 / 编号');search.setAttribute('aria-label',search.placeholder);const pick=node('select'),info=node('div'),line=node('div',undefined,'inline');pick.setAttribute('aria-label',t('敌人'));line.append(search,pick);s.append(line,info);
 function show(){info.replaceChildren();const e=catalog.enemies[pick.value];if(!e)return;info.append(node('h3',e.name));if(/^https:\/\/prts\.wiki\//.test(e.wiki||'')){const a=link(t('打开 PRTS Wiki'),e.wiki);a.target='_blank';a.rel='noreferrer';info.append(a);}const tb=table([t('等级'),'HP','ATK','DEF','RES',t('移动方式')]);e.levels.forEach(l=>row(tb.tbl,[l.level,l.stats.maxHp,l.stats.atk,l.stats.def,l.stats.res,l.stats.motion]));info.append(tb.wrap);const details=node('details');details.append(node('summary',t('原始属性与技能参数')),node('pre',JSON.stringify(e.levels,null,2)));info.append(details);const boss=Object.values(bosses).find(b=>b.enemyKey===e.key);if(boss){const d=node('details');d.append(node('summary',t('游戏领袖参数（只读）')),node('pre',JSON.stringify(boss,null,2)));info.append(d);}}
 function filter(){pick.replaceChildren();const q=search.value.trim().toLowerCase();Object.values(catalog.enemies).filter(e=>!q||`${e.name} ${e.key}`.toLowerCase().includes(q)).slice(0,150).forEach(e=>{const o=node('option',`${e.name} · ${e.key}`);o.value=e.key;pick.append(o);});show();}search.oninput=filter;pick.onchange=show;filter();
}
function applySection(){const s=section('apply',t('保存与应用'));s.append(node('p',t('保存草稿只保存在当前浏览器；导出后先校验，再应用到本地仓库。服务器版本不会自动修改。'),'hint'),node('pre','node tools/apply-unite-tuning.mjs "unite-tuning.json"\nnode tools/apply-unite-tuning.mjs "unite-tuning.json" --write'),node('p',t('应用命令会备份旧配置。重启本地服务器并刷新客户端后生效。'),'hint'),node('pre','shared/uniteTuning.js\nshared/uniteWaveDesign.js\nserver/match/uniteExpansion.js\nserver/match/waves.js\ndata/waves.json · data/enemies.json · data/bosses.json (read-only)'));
}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
try {
 await initLang();
 const load=async path=>{const res=await fetch(path);if(!res.ok)throw new Error(`${path}: ${res.status}`);return res.json();};
 [enemies,waves,catalog,choices,bosses,stages]=await Promise.all(['/data/enemies.json','/data/waves.json','/data/workshop-enemies.json','/data/choices.json','/data/bosses.json','/data/stages.json'].map(load));
 try{assets=await load('/data/assets.json');}catch{assets={};}
 check();render();document.title=t('波次与悬赏编辑器');
} catch(e){root.append(node('pre',`${t('加载失败')}\n${e.message}`));}
