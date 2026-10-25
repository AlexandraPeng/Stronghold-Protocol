import { useState } from '../../vendor/hooks.module.js';
import { html } from './components.js';
import { Img, RichText } from './gameComponents.js';
import { itemIconUrl } from './assetUrls.js';
import { data } from '../data.js';
import { t, tName } from '../../../shared/i18n.js';
import { RELICS, relicItemId, adaptedDescription, recruitment } from '../../../shared/blackforestRelics.js';

export function catalogRows(effects=[],pieces=[]) {
  return RELICS.map(r=>{
    const active=effects.filter(e=>e.relicId===r.id || e.iconId===relicItemId(r.id));
    const stored=pieces.filter(p=>p?.id===relicItemId(r.id));
    return {r,active,stored,owned:active.length+stored.length};
  });
}

/** Shared by the in-match collection drawer and the standalone, offline-capable catalogue. */
export function RelicCatalog({effects=[],pieces=[]}) {
  const [query,setQuery]=useState(''),[ownedOnly,setOwnedOnly]=useState(false),[rarity,setRarity]=useState('');
  const rows=catalogRows(effects,pieces);
  const shown=rows.filter(({r,owned})=>(!ownedOnly||owned>0)&&(!rarity||r.rarity===rarity)
    && `${r.name} ${adaptedDescription(r)}`.includes(query.trim()));
  const manifest=data.get('assets');
  const rarityName={NORMAL:t('普通'),RARE:t('稀有'),SUPER_RARE:t('珍贵')};
  return html`<section class="relic-catalog">
    <header class="relic-catalog__intro"><div><small>BLACKFOREST / COLLECTION</small><h2>${t('黑流树海藏品')}</h2>
      <p>${t('结构化基础数值 · 仅联防可叠层模式')}</p></div><div class="relic-catalog__total"><b>${rows.length}</b><span>${t('已适配藏品')}</span></div></header>
    <div class="relic-catalog__tools">
      <input aria-label=${t('搜索藏品')} placeholder=${t('搜索名称或效果')} value=${query} onInput=${e=>setQuery(e.currentTarget.value)} />
      <select aria-label=${t('稀有度')} value=${rarity} onChange=${e=>setRarity(e.currentTarget.value)}>
        <option value="">${t('全部稀有度')}</option>${Object.entries(rarityName).map(([k,v])=>html`<option value=${k}>${v}</option>`)}
      </select>
      <button type="button" aria-pressed=${ownedOnly} onClick=${()=>setOwnedOnly(!ownedOnly)}>${t('只看本局持有')}</button>
      <span>${t('显示 {count} 件',{count:shown.length})}</span>
    </div>
    <p class="relic-catalog__hint">${t('拖到干员上使用；全队增益永久生效，招募附加能力仅绑定选定干员。')}</p>
    <div class="relic-catalog__grid">${shown.map(({r,active,stored})=>html`<article key=${r.id} class=${`relic-card relic-card--${r.rarity.toLowerCase()}`}>
      <div class="relic-card__art"><${Img} src=${itemIconUrl(manifest,relicItemId(r.id))} alt=${r.name} fallback=${html`<span>◇</span>`}/><span>${rarityName[r.rarity]}</span></div>
      <div class="relic-card__body"><small>${recruitment(r)?t('特殊招募'):t('永久收藏')}</small><h3>${r.name}</h3><${RichText} as="p" text=${adaptedDescription(r)} />
        <div class="relic-card__status">${active.length?html`<b>${t('本局生效 ×{count}',{count:active.length})}</b>`:null}
        ${stored.length?html`<b>${t('整备区 ×{count}',{count:stored.length})}</b>`:null}
        ${active.filter(e=>e.boundUid!=null).map(e=>html`<span>${t('绑定：{name}',{name:tName(data.lookup('chess',pieces.find(p=>p?.uid===e.boundUid)?.id)?.name)||t('已绑定干员')})}</span>`)}</div>
      </div></article>`)}</div>
    ${shown.length?null:html`<p class="relic-catalog__empty">${t('没有符合条件的藏品')}</p>`}
  </section>`;
}
