// Maintainer's 怪物设计.txt, 2026-10-14. Design data only; not an official balance table.
// Restricted to coop + uniteStacking (ABYSS). A duplicate 漂泊颂偶 line is deduplicated.
// The numbers in the source are kill rewards, not spawn counts or enemy levels.
import { UNITE_TUNING } from './uniteTuning.js';
export const UNITE_BOUNTY_DESIGN = Object.freeze(UNITE_TUNING.bounties.map(e => Object.freeze({...e})));
export const UNITE_WAVE_DESIGN = Object.freeze(UNITE_TUNING.groups.map(g => Object.freeze({ ...g, halves: Object.freeze([...g.halves]), keys: Object.freeze([...g.keys]), lateKeys: Object.freeze([...(g.lateKeys ?? [])]) })));

export const UNITE_SUMMON_KEYS = Object.freeze(['enemy_2033_syboys', 'enemy_2121_dyspl2', 'enemy_10231_agpack', 'enemy_2156_shsmok', 'enemy_2073_skzrck']);
export const UNITE_ENEMY_KEYS = Object.freeze([...new Set([
  ...UNITE_BOUNTY_DESIGN.map(e => e.enemyKey), ...UNITE_WAVE_DESIGN.flatMap(g => [...g.keys, ...g.lateKeys]),
])]);

// Maintainer-configured minimum rounds; biome half and lateKeys restrictions also apply.
export const UNITE_MIN_ROUND = Object.freeze({...UNITE_TUNING.minRound});

// [ASSUMED] Custom wave balance: paper has 12 hit-count HP, not 12 ordinary HP.
// Cap direct template spawns at one per action; skill summons and its combat stats are unchanged.
export const UNITE_MAX_ACTION_COUNT = Object.freeze({...UNITE_TUNING.maxActionCount});
