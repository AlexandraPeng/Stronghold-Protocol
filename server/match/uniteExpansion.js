import { relicDrops } from '../../shared/relicTuning.js';
import { UNITE_TUNING } from '../../shared/uniteTuning.js';
// Maintainer wave design, restricted to coop + uniteStacking. No mutation of shared data.
import { UNITE_WAVE_DESIGN, UNITE_BOUNTY_DESIGN, UNITE_MIN_ROUND } from '../../shared/uniteWaveDesign.js';
import { createRng, deriveSeed } from '../sim/rng.js';

/** Maintainer-approved tier percentages, 2026-10-14. Exhausted tiers are reweighted for unique offers. */
export function roundBountyWeights(round) {
  const weights = [...UNITE_TUNING.probabilities[round <= 3 ? 0 : round <= 6 ? 1 : 2]];
  while (weights.length > 1 && weights.at(-1) === 0) weights.pop();
  return weights;
}

/** Candidate pool, including zero-fund variants of the lowest existing bounty tier. */
export function roundBountyPool(gd, round) {
  if (!gd.uniteExpansion || !Number.isInteger(round) || round < 1) return [];
  const cap=roundBountyWeights(round).length-1;
  const base = (gd.choices.cards?.bounty || []).filter(c => c.payout === 'kill'
    && c.coin >= 1 && c.coin <= 2 && c.rounds === 1 && c.count === 1 && gd.enemy(c.enemyKey));
  const early = base.map(c => {
    const coin=UNITE_TUNING.baseCoins[c.enemyKey] ?? c.coin;
    return {...c,coin,desc:unifiedBountyDescription(gd.enemy(c.enemyKey).name, coin)};
  });
  const byEnemy = new Map();
  for (const c of [...early, ...uniteBountyCards(gd)]) {
    if (c.coin>cap) continue;
    if ((c.enemyKeys || [c.enemyKey]).some(key => round < (UNITE_MIN_ROUND[key] || 1))) continue;
    if (!byEnemy.has(c.enemyKey)) byEnemy.set(c.enemyKey, c);
  }
  const positive=[...byEnemy.values()];
  // [ASSUMED] There is no authored 0-fund enemy. Keep the lowest-tier enemy's mechanics;
  // remove its fund reward and keep one relic, as requested by the maintainer.
  const zero=base.filter(c=>c.coin===1 && base.find(b=>b.enemyKey===c.enemyKey)===c && round >= (UNITE_MIN_ROUND[c.enemyKey] || 1)).map(c=>({...c,effectId:`${c.effectId}_zero`,coin:0,
    desc:unifiedBountyDescription(gd.enemy(c.enemyKey).name, 0)}));
  return [...zero,...positive];
}

/** Draw reward tier first so tiers with larger enemy pools do not dominate. Enemy identities never repeat. */
export function drawRoundBountyCards(gd, rng, round) {
  let pool=roundBountyPool(gd,round);
  const weights=roundBountyWeights(round),cards=[];
  while(cards.length<9 && pool.length){
    const tiers=weights.map((weight,coin)=>({coin,weight,entries:pool.filter(c=>c.coin===coin)})).filter(t=>t.weight > 0 && t.entries.length);
    let roll=rng()*tiers.reduce((n,t)=>n+t.weight,0);
    if (!tiers.length) break;
    const tier=tiers.find(t=>(roll-=t.weight)<0)||tiers.at(-1);
    const card=rng.pick(tier.entries);
    cards.push({...card,rounds:1,multiRound:false,roundReward:true,collectibleCount:collectibleDropCount(card.coin)});
    pool=pool.filter(c=>c.enemyKey!==card.enemyKey);
  }
  return cards;
}

export function collectibleDropCount(coins) {
  if (!Number.isInteger(coins) || coins < 0) return 0;
  return relicDrops(coins,UNITE_TUNING);
}

function unifiedBountyDescription(name, coins) {
  return `下场作战出现${name}，每名敌人被击杀后获得${coins}资金和${collectibleDropCount(coins)}件藏品。`; // i18n-ignore: custom content description
}

export function grantRoundBounty(match, ps) {
  if (!match.uniteStacking || match.round <= 1 || !ps.alive || ps._uniteBountyRound === match.round) return null;
  const rng = createRng(deriveSeed(match.seed, `unite-bounty:${match.round}:${ps.seat}`));
  const cards = drawRoundBountyCards(match.gd, rng, match.round);
  if (!cards.length) return null;
  ps.personalChoice = {id:`${match.battlePrefix}.choice.${match.nextUid()}`,round:match.round,
    sourceItemId:null,kind:'roundBounty',cards};
  ps._uniteBountyRound=match.round;
  ps.dirty();
  return ps.personalChoice.id;
}

/** Replay only the prep-end layer deltas on entering support. No second prep,
 * shop action, formation edit or replay of income/recruitment hooks occurs.
 */
export function grantUnitePrepLayers(match, ps) {
  if (!match.uniteStacking || ps._unitePrepBonusRound === match.round) return;
  ps._unitePrepBonusRound = match.round;
  for (const [bondId, count] of Object.entries(ps._lastPrepLayerGains || {})) {
    if (Number.isFinite(count) && count > 0) ps.addLayers(bondId, count, { reason: 'unite-prep' });
  }
}
export function uniteEntries(gd, type, firstHalf, round = firstHalf ? 1 : 8) {
  if (!gd.uniteExpansion) return [];
  return UNITE_WAVE_DESIGN.filter(g => g.type === type && g.halves.includes(firstHalf ? 'early' : 'late')).map(g => {
    const keys = [...g.keys, ...(firstHalf ? [] : g.lateKeys)].filter(key => gd.enemy(key) && round >= (UNITE_MIN_ROUND[key] || 1));
    return { type, key: keys[keys.length-1], firstHalf, weight: 50, N: [], E: [], uniteKeys: keys, uniteGroup: g.id };
  }).filter(g => g.key);
}
export function uniteBountyCards(gd) {
  if (!gd.uniteExpansion) return [];
  return UNITE_BOUNTY_DESIGN.filter(c => c.enemyKey !== 'enemy_2028_syevil' && gd.enemy(c.enemyKey)).map(c => {
    const pair = ['enemy_2029_symon','enemy_2030_symon2'].includes(c.enemyKey);
    const enemyKeys = pair ? ['enemy_2028_syevil',c.enemyKey] : [c.enemyKey];
    const name = enemyKeys.map(key => gd.enemy(key)?.name ?? key).join(' / ');
    return { effectId: `unite_bounty_${c.enemyKey}`, name,
      desc: unifiedBountyDescription(name, c.coins),
      tier: 3, coin: c.coins, payout: 'kill', rounds: 1, enemyKey: c.enemyKey, enemyKeys, count: 1, draft: true,
    };
  });
}
