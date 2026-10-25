// PRTS enemy pages, checked 2026-10-14. The expansion is installed separately until
// every design dependency has passed its mechanic tests; importing this file does not enable it.
import { hurt, areaAllies, targetsNear, byPriority, watchDeaths } from '../helpers.js';
import { unblockable, noAirTargets } from '../archetypes.js';

const active = e => e.alive && e.deployed && !e.hidden;
const castable = e => !e.s.flags.stun && !e.s.flags.sleep && !e.s.flags.freeze && !e.s.flags.silence;
const invincible = duration => ({ spawn(b,e) { b.addBuff(e,{key:'ux:initialInvincible',duration,flags:{invulnerable:true}}); } });

// https://prts.wiki/w/未名的荒原 — ordinary attacks add permanent -50 DEF,
// up to 999 layers. Fixed first-layer magnitude; no exponential doubling.
function wasteland() {
  return [noAirTargets(), { dealt(c,b,e) {
    b.addBuff(c.target,{key:'ux:wastelandDef',persist:true,refresh:'stack',maxStacks:999,mods:{defFlat:-50},source:e});
  } }];
}

// https://prts.wiki/w/漂泊颂偶 — source-less arts loss while not blocked.
function wanderingDoll() {
  return [{iv:1,tick(b,e) {
    if(e.blockedBy||e.hidden)return;
    for(const target of b.allies()) if(active(target)) hurt(b,null,target,100,'arts',{isSkill:false,ignoreSelect:true,tags:['ux:doll']});
  }}];
}

// https://prts.wiki/w/“雪牝” and /“霜牡”. Death and reaching the route's end
// both enrage the partner. Exactly one gain, even when several partners depart.
function frostPair(coldFirst) {
  const partner=coldFirst?'enemy_2015_csicem':'enemy_2014_csicer';
  return [{
    spawn(b,e,a) {a.raged=false;watchDeaths(b,e);},
    otherDeath(c,b,e,a) {
      if(a.raged||c.unit?.defId!==partner||!['killed','leak'].includes(c.reason))return;
      a.raged=true;b.addBuff(e,{key:'ux:frostPairRage',persist:true,mods:{aspd:100,moveMul:2}});
    },
    hitOut(c,b,e,a) {
      if((!coldFirst||a.raged)&&c.target.s.flags.freeze)c.dmg.mul*=2.5;
    },
    dealt(c,b,e,a) {
      if(!coldFirst&&!a.raged)return;
      const target=c.target;b.after(.1,()=>{if(target.alive)b.applyStatus(target,'cold',{duration:5,source:e});});
    },
  }];
}

// https://prts.wiki/w/“羽化之梦” — five hits, each an independent attack instance.
function dream() {
  return [noAirTargets(),{
    spawn(b,e){e.def={...e.def,staticBody:true};e.profile.deferHit=true;},
    attack(c,b,e){
      for(const target of c.targets)for(let i=0;i<5&&target.alive;i++){
        if(c.targetDeployments&&target.deploySeq!==c.targetDeployments.get(target))break;
        b.dealDamage(e,target,{amount:e.s.atk,type:'phys',isAttack:true,canDodge:true,tags:['ux:dreamVolley']});
      }
    },
  }];
}

// https://prts.wiki/w/小跑的斐迪庇第斯 and /狂奔的斐迪庇第斯.
// Theatre status is an explicit environment flag; absent stage effects do not slow it.
function runner() {
  return [unblockable(),{
    iv:1,spawn(b,e,a){e.profile.noAttack=true;a.fast=0;a.slow=0;},
    tick(b,e,a){
      if(e.hidden)return;
      const inTheatre=!!e.s.flags.theatreEnemy;
      if(!inTheatre&&a.fast*.1-a.slow*.2<1.5-1e-9)a.fast=Math.min(999,a.fast+1);
      if(inTheatre&&e.s.moveSpeed>.1+1e-9)a.slow=Math.min(999,a.slow+1);
      b.addBuff(e,{key:'ux:runner',persist:true,mods:{moveFlat:a.fast*.1-a.slow*.2}});
    },
  }];
}

// https://prts.wiki/w/锈锤战士 — initial 60 s invulnerability and 18 s arts skill.
function rustWarrior() {
  return [unblockable(),noAirTargets(),invincible(60),{
    spawn(b,e,a,ab){ab.immune??=new Set();ab.immune.add('sleep');},
    cd:18,left:18,
    cond(b,e,a){a.target=byPriority(e,targetsNear(b,e,e.base.rangeRadius).filter(u=>!u.isFlying))[0];return !!a.target;},
    fire(b,e,a){hurt(b,e,a.target,e.s.atk*3,'arts',{isSkill:true,canDodge:true,tags:['attack','ux:rustStrike']});},
  }];
}

// https://prts.wiki/w/好心肠老板 and /遮天面包机. The projectile caches
// the launch point and ATK; killing the caster does not erase a launched projectile.
function dropBomb({interval,delay,radius,scale,blockedCheck=false}) {
  return [{iv:interval,spawn(b,e){e.profile.noAttack=true;e.def={...e.def,staticBody:true};},tick(b,e){
    if(e.hidden||(blockedCheck&&e.blockedBy))return;
    const {x,y}=e,damage=e.s.atk*scale;
    b.fx('telegraph',{x,y,r:radius,dur:delay,kind:'ux:airBomb'});
    b.after(delay,()=>{for(const target of areaAllies(b,e,x,y,radius))if(!target.isFlying&&!target.s.flags.liftoff)hurt(b,e,target,damage,'phys',{isSkill:false,tags:['splash','ux:airBomb']});});
  }}];
}

// https://prts.wiki/w/“自由的树” — only operators currently using aerial blocking.
function freeTree() {
  return [{spawn(b,e){e.def={...e.def,staticBody:true};e.profile.canTarget=u=>!!u.s.flags.liftoff;}}];
}

export const UNITE_SIMPLE_KITS = Object.freeze({
  enemy_2151_shwolf:wasteland,
  enemy_2013_csbot:wanderingDoll,
  enemy_2014_csicer:()=>frostPair(true),
  enemy_2015_csicem:()=>frostPair(false),
  enemy_10110_mjcsdw_2:dream,
  enemy_10158_mnzeno:runner,
  enemy_10158_mnzeno_2:runner,
  enemy_2006_flsnip:rustWarrior,
  enemy_10230_agkiro:()=>dropBomb({interval:1,delay:1,radius:.45,scale:1}),
  enemy_10147_nsbomb:()=>dropBomb({interval:2.5,delay:.5,radius:1,scale:2,blockedCheck:true}),
  enemy_10152_nstree:freeTree,
});

export { active, castable };
