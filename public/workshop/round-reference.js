import { t } from '../../shared/i18n.js';
export function roundReference(wave,config){
 const actions=(wave.spawns||[]).map((s,i)=>({...s,...(!s.tag&&!s.unharmful?config.templates[wave.id]?.[i]:{}),index:i}));
 return {actions,walk:actions.filter(s=>!s.tag&&!s.unharmful&&wave.routes[s.routeIndex]?.motion!=='FLY').reduce((n,s)=>n+(s.count??1),0),fly:actions.filter(s=>!s.tag&&!s.unharmful&&wave.routes[s.routeIndex]?.motion==='FLY').reduce((n,s)=>n+(s.count??1),0)};
}
export function mountRoundReference(parent,{config,waves,enemyLabel,openTemplate}){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const picker=el('select'),variant=el('select'),body=el('div');picker.setAttribute('aria-label',t('参考回合'));variant.setAttribute('aria-label',t('参考模板'));
 for(let r=1;r<=15;r++){const o=el('option',`${t('回合')} ${r}`);o.value=r;picker.append(o);}
 parent.append(el('p',t('按当前草稿查看各回合。下列数量为模板基础数量，地面与飞行是候选槽位；实际出怪还受群系、战力折算和上限影响，不应直接相加作为实战总数。')),picker,variant,body);
 function draw(){body.replaceChildren();const r=Number(picker.value),wave=waves[variant.value];if(!wave)return;
  const {actions,walk,fly}=roundReference(wave,config),summary=el('div');summary.className='round-summary';
  summary.append(el('strong',`${t('地面基础数量')}: ${walk} · ${t('飞行基础数量')}: ${fly}`),el('p',`${t('战斗时限')}: ${wave.maxPlayTime??'—'} s`));
  const weights=config.probabilities[r<=3?0:r<=6?1:2];summary.append(el('p',`${t('悬赏资金与概率')}: ${weights.map((p,c)=>`${c}: ${p}%`).join(' / ')}`));body.append(summary);
  const jump=el('button',t('编辑本回合模板与路线'));jump.type='button';jump.onclick=()=>openTemplate(wave.id);body.append(jump);
  const list=el('div');list.className='round-enemies';body.append(list);
  for(const a of actions){const card=el('div');card.className='card';card.append(enemyLabel(a.key),el('p',`${t('基础数量')}: ${a.count??1} · ${t('出现时间')}: ${a.time??0}s · ${t('间隔')}: ${a.interval??0}s`),el('p',`${t('路线')}: ${a.routeIndex} · ${wave.routes[a.routeIndex]?.motion||'—'} ${a.tag?' · '+a.tag:''}`));list.append(card);}
  body.append(el('h3',t('本回合可用群系')));
  for(const g of config.groups.filter(g=>g.halves.includes(r<=7?'early':'late'))){const card=el('div');card.className='card';card.append(el('h4',g.id));const roster=el('div');roster.className='round-enemies';for(const key of [...new Set([...g.keys,...(r>=8?g.lateKeys:[])])].filter(k=>r>=(config.minRound[k]||1)))roster.append(enemyLabel(key));card.append(roster);body.append(card);}
 }
 function choose(){variant.replaceChildren();Object.values(waves).filter(w=>w.usedBy?.some(u=>u.modeId==='mode_multi_abyss'&&u.round===Number(picker.value))).forEach(w=>{const o=el('option',w.id);o.value=w.id;variant.append(o);});draw();}
 picker.onchange=choose;variant.onchange=draw;choose();return draw;
}
