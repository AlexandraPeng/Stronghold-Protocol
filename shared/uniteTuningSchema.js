import { BASE_RELICS, editableRelicParams, assignDefaults, relicParamBounds, relicWeight } from './relicTuning.js';
// Strict schema for local editor exports. No executable content or official-data writes.
export function validateUniteTuning(input, enemies, waves, choices, stages) {
  const fail = (path) => { throw new Error(`Invalid configuration: ${path}`); };
  const obj = (v, keys, path) => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k))) fail(path);
  };
  const num = (v, lo, hi, path, integer = true) => {
    if (!Number.isFinite(v) || v < lo || v > hi || (integer && !Number.isInteger(v))) fail(path);
  };
  const enemy = key => { if (typeof key !== 'string' || !Object.hasOwn(enemies, key)) fail(`enemy ${key}`); };
  const keys = (list, path, empty = false) => {
    if (!Array.isArray(list) || (!empty && !list.length) || list.length > 50 || new Set(list).size !== list.length) fail(path);
    list.forEach(enemy);
  };
  obj(input, ['version','baseCoins','probabilities','bounties','groups','minRound','maxActionCount','templates','relics','relicDrops','relicProbabilities','routes'], 'root');
  if (input.version !== 1) fail('version');
  if (!Array.isArray(input.probabilities) || input.probabilities.length !== 3) fail('probabilities');
  input.probabilities.forEach((row, i) => {
    if (!Array.isArray(row) || row.length !== 6) fail(`probabilities.${i}`);
    row.forEach(v => num(v, 0, 100, `probabilities.${i}`, false));
    if (Math.abs(row.reduce((a,b)=>a+b,0)-100) > 0.00001) fail(`probabilities.${i}: sum must be 100`);
    if (row.slice(i===0?3:i===1?4:6).some(v=>v!==0)) fail(`probabilities.${i}: round cap`);
  });
  if (!Array.isArray(input.bounties) || !input.bounties.length || input.bounties.length > 200) fail('bounties');
  if (!input.baseCoins || typeof input.baseCoins !== 'object' || Array.isArray(input.baseCoins)) fail('baseCoins');
  for (const [key,v] of Object.entries(input.baseCoins)) { enemy(key); num(v,1,5,'baseCoins'); }
  const seen = new Set();
  input.bounties.forEach(b => {
    obj(b,['enemyKey','coins'],'bounty'); enemy(b.enemyKey); num(b.coins,1,5,'coins');
    if (seen.has(b.enemyKey)) fail('duplicate bounty'); seen.add(b.enemyKey);
  });
  if (!Array.isArray(input.groups) || !input.groups.length || input.groups.length > 30) fail('groups');
  const ids = new Set();
  input.groups.forEach(g => {
    obj(g,['id','type','halves','keys','lateKeys'],'group');
    if (!/^[a-z][a-z0-9_]{0,49}$/.test(g.id) || ids.has(g.id)) fail('group id'); ids.add(g.id);
    if (!['ELEMENT','TIMES','FLY','SPECIAL'].includes(g.type)) fail('group type');
    if (!Array.isArray(g.halves) || !g.halves.length || g.halves.length>2 || new Set(g.halves).size!==g.halves.length || g.halves.some(x=>!['early','late'].includes(x))) fail('halves');
    keys(g.keys,'keys'); keys(g.lateKeys,'lateKeys',true);
  });
  for (const field of ['minRound','maxActionCount']) {
    const map = input[field];
    if (!map || typeof map !== 'object' || Array.isArray(map)) fail(field);
    for (const [key,value] of Object.entries(map)) { enemy(key); num(value,1,field==='minRound'?15:5,field); }
  }
  if (!input.templates || typeof input.templates !== 'object' || Array.isArray(input.templates)) fail('templates');
  for (const [id, actions] of Object.entries(input.templates)) {
    if (!Object.hasOwn(waves,id) || !actions || typeof actions !== 'object' || Array.isArray(actions)) fail(`template ${id}`);
    for (const [index, patch] of Object.entries(actions)) {
      if (!/^(0|[1-9]\d*)$/.test(index)) fail('action index');
      const source = waves[id].spawns?.[index];
      if (!source || source.tag || source.unharmful) fail('protected action');
      obj(patch,['count','time','interval'],'action');
      for (const [k,v] of Object.entries(patch)) num(v,k==='count'?1:0,k==='count'?50:600,k,k==='count');
    }
  }
  if (input.routes !== undefined) {
    if (!input.routes || typeof input.routes !== 'object' || Array.isArray(input.routes)) fail('routes');
    for (const [id, edits] of Object.entries(input.routes)) {
      const wave = waves[id];
      if (!wave || wave.kind !== 'normal') fail('routes: protected template');
      obj(edits, wave.routes.map((_,i)=>String(i)), 'routes.'+id);
      for (const [index, route] of Object.entries(edits)) {
        if (!(wave.routes[index].checkpoints || []).every(p=>Array.isArray(p)&&typeof p[0]==='number')) fail('protected event route');
        obj(route,['start','end','checkpoints'],'route');
        const point = p => { if (!Array.isArray(p) || p.length!==2) fail('route point'); num(p[0],9,12,'route row'); num(p[1],2,10,'route col'); };
        point(route.start); point(route.end);
        if (!Array.isArray(route.checkpoints) || route.checkpoints.length>32) fail('route checkpoints');
        route.checkpoints.forEach(point);
        if (!stages) fail('route validation requires stages');
        for (const stage of Object.values(stages).filter(s=>s.active && s.modes?.includes('mode_multi_abyss'))) {
          const fly=wave.routes[index].motion==='FLY';
          const pass=(r,c)=>r>=9&&r<=12&&c>=2&&c<=10&&!!stage.tiles[stage.rows[r]?.[c]]?.[fly?'flyPassable':'groundPassable'];
          const points=[route.start,...route.checkpoints,route.end];
          for (const p of points) if (!pass(...p)) fail(`route blocked: ${stage.id} [${p}]`);
          if (!fly) for (let i=1;i<points.length;i++) {
            const queue=[points[i-1]],seen=new Set([String(queue[0])]);
            for(let k=0;k<queue.length;k++) for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
              const q=[queue[k][0]+dr,queue[k][1]+dc];
              if(pass(...q)&&!seen.has(String(q))) {seen.add(String(q));queue.push(q);}
            }
            if(!seen.has(String(points[i]))) fail('route disconnected: '+stage.id);
          }
        }
      }
    }
  }
  if (choices) {
    const base = new Map();
    for (const c of choices.cards?.bounty || []) if (c.payout==='kill' && c.coin>=1 && c.coin<=2 && c.rounds===1 && c.count===1 && enemies[c.enemyKey] && !base.has(c.enemyKey)) base.set(c.enemyKey,c.coin);
    for (const key of Object.keys(input.baseCoins)) if (!base.has(key)) fail(`baseCoins ${key}`);
    for (const b of input.bounties) if (base.has(b.enemyKey)) fail(`bounties: use baseCoins for ${b.enemyKey}`);
    for (let round=1;round<=15;round++) {
      const weights=input.probabilities[round<=3?0:round<=6?1:2], available=new Set();
      for(const [key,coin] of base) if(round>=(input.minRound[key]||1) && (weights[input.baseCoins[key]??coin]>0 || coin===1&&weights[0]>0)) available.add(key);
      for(const b of input.bounties) {
        const paired=['enemy_2029_symon','enemy_2030_symon2'].includes(b.enemyKey);
        if(b.enemyKey!=='enemy_2028_syevil' && round>=(input.minRound[b.enemyKey]||1) && (!paired || round>=(input.minRound.enemy_2028_syevil||1)) && weights[b.coins]>0) available.add(b.enemyKey);
      }
      if(available.size<9) fail(`round ${round}: fewer than 9 distinct eligible bounty enemies`);
    }
  }
  if(input.relicDrops !== undefined) {
    if(!Array.isArray(input.relicDrops) || input.relicDrops.length!==6) fail('relicDrops');
    input.relicDrops.forEach(v=>num(v,0,3,'relicDrops'));
  }
  if (input.relicProbabilities !== undefined) {
    if (!Array.isArray(input.relicProbabilities) || input.relicProbabilities.length !== 5) fail('relicProbabilities');
    input.relicProbabilities.forEach(v => num(v, 0, 100, 'relicProbabilities', false));
    if (Math.abs(input.relicProbabilities.reduce((a,b)=>a+b,0)-100) > 0.00001) fail('relicProbabilities: sum must be 100');
  }
  if(input.relics !== undefined) {
    obj(input.relics,BASE_RELICS.map(r=>r.id),'relics');
    for(const [id,edit] of Object.entries(input.relics)) {
      obj(edit,['weight','params','adapter'],id);
      if(edit.weight!==undefined) num(edit.weight,0,10000,id+'.weight',false);
      const r=BASE_RELICS.find(r=>r.id===id);
      for(const [field,entries] of [['params',Object.fromEntries(editableRelicParams(r).map(p=>[p.path,p.param]))],['adapter',Object.fromEntries(Object.keys(assignDefaults(id)).map(k=>[k,k]))]]) {
        if(edit[field]===undefined) continue;
        obj(edit[field],Object.keys(entries),id+'.'+field);
        for(const [key,v] of Object.entries(edit[field])) {
          const bounds=relicParamBounds(entries[key]);
          num(v,...bounds,id+'.'+field+'.'+key,['revives','maxCasts'].includes(entries[key]));
          if(entries[key]==='count' && (!Number.isInteger(v) || v<0)) fail(id+'.count');
        }
      }
    }
    if(!BASE_RELICS.some(r=>relicWeight(r.id,input)>0)) fail('relics: empty drop pool');
  }
  return JSON.parse(JSON.stringify(input));
}
