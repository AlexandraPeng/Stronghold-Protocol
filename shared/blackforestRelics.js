// Custom-mode adaptation. A relic enters the drop pool only if ALL its effects have adapters.
export const RELIC_KEY = 'effect:blackforest';
export { BASE_RELICS } from './relicTuning.js';
import { tunedRelics, assignDefaults } from './relicTuning.js';
import { UNITE_TUNING } from './uniteTuning.js';
export const RELICS = Object.freeze(tunedRelics(UNITE_TUNING));
export const RELICS_BY_ID = Object.freeze(Object.fromEntries(RELICS.map(r=>[r.id,r])));
export function relicItemId(id) { return `blackforest_${id}`; }
export function relicOfItem(id) { return RELICS_BY_ID[String(id).replace(/^blackforest_/,'')] || null; }
export function recruitment(r) {
  const ticket=r.buffs.find(b=>b.key==='immediate_reward' && /_(recruit|upgrade)_ticket_/.test(b.params.id));
  const bind=r.buffs.some(b=>b.key==='next_recruit_upgrade_char_buff') || /^rogue_6_relic_assign_/.test(r.id);
  if (!ticket && !bind) return null;
  const profession=ticket?.params.id.match(/upgrade_ticket_(\w+)_from_relic$/)?.[1] || null;
  const elite=!!ticket && (ticket.params.id.includes('_upgrade_') || ticket.params.id.endsWith('_up'));
  return { elite, profession, bind };
}
export function adaptedDescription(r) {
  if(Object.keys(r.tuningParams||{}).length || JSON.stringify(r.adapter||{})!==JSON.stringify(assignDefaults(r.id))) return `原始资料：${r.baseUsage}；自定义生效参数：${JSON.stringify({...r.tuningParams,...r.adapter})}`; // i18n-ignore: custom content data
  const recruit=recruitment(r);
  if (recruit) {
    const effect=r.baseUsage.includes('并使其：') ? r.baseUsage.split('并使其：')[1] : r.baseUsage.replace('下一个招募或进阶的干员','该干员'); // i18n-ignore: sourced custom content data
    return `特殊招募：从当前商店等级的${recruit.profession?'指定职业':''}干员中免费选择一名${recruit.elite?'精锐干员':'干员'}。${recruit.bind?effect+'；此效果仅绑定该干员。':''}`; // i18n-ignore: sourced custom content data
  }
  return r.baseUsage.replaceAll('希望','资金').replaceAll('源石锭','资金').replaceAll('护盾值','个人目标护盾值'); // i18n-ignore: sourced custom content data
}
/** Called by the data builder; never write data/items.json by hand. */
export function buildRelicItems() {
  return Object.fromEntries(RELICS.map(r=>{
    const id=relicItemId(r.id), desc=adaptedDescription(r);
    return [id,{id,baseId:id,goldenId:null,isGolden:false,trapId:'trap_1113_acarm113',iconId:id,identifier:0,
      name:r.name,itemType:'EQUIP',tier:{NORMAL:1,RARE:2,SUPER_RARE:3}[r.rarity]||3,price:0,shopSortId:0,
      hideInShop:true,shopExcluded:true,mergeable:false,upgradeNum:0,upgradeChessId:null,duration:-1,
      giveBondId:null,givePowerId:null,canGiveBond:false,requiresBondId:null,effectId:id,effectName:r.name,
      desc,descRaw:desc,buffs:[],params:{relicId:r.id},category:'ECONOMY',kind:'consume_on_equip',
      family:null,rangeGrid:[[0,0]],blackforest:true,implFormula:'structured-base',note:null}];
  }));
}
