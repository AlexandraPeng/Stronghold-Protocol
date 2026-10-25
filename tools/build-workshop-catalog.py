"""Build the workshop catalogue from client data. Data import is not mechanic implementation."""
import json,pathlib,urllib.request,urllib.parse,hashlib,re,datetime
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=ROOT/'.cache/workshop';CACHE.mkdir(parents=True,exist_ok=True)
URL='https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/'
sources=[]
def load(path):
 req=urllib.request.Request(URL+path,headers={'User-Agent':'StrongholdWorkshopCatalog/1.0'})
 blob=urllib.request.urlopen(req,timeout=60).read();(CACHE/pathlib.Path(path).name).write_bytes(blob)
 sources.append({'url':URL+path,'sha256':hashlib.sha256(blob).hexdigest()});return json.loads(blob)
db=load('levels/enemydata/enemy_database.json');hb=load('excel/enemy_handbook_table.json')
existing=json.loads((ROOT/'data/enemies.json').read_text(encoding='utf8'))
def merge(a,b):
 out=dict(a)
 for k,v in b.items():
  if isinstance(v,dict) and 'm_defined' in v:
   if v['m_defined'] or k not in out:out[k]=v
  elif isinstance(v,dict):out[k]=merge(out.get(k,{}),v)
  elif v is not None:out[k]=v
 return out
def mv(v,default=None):
 if not isinstance(v,dict):return default
 x=v.get('m_value');return default if x is None or (not v.get('m_defined') and x in [0,False,'']) else x
def bb(values):
 return {x['key']:x.get('valueStr') if x.get('valueStr') else x.get('value',0) for x in values or []}
entries={}
for row in db['enemies']:
 key=row['Key'];levels=row['Value'];base=next((x['enemyData'] for x in levels if x['level']==0),levels[0]['enemyData']);h=hb.get('enemyData',{}).get(key,{})
 variants=[]
 for lv in levels:
  d=merge(base,lv['enemyData']);a=d.get('attributes',{})
  fields={'maxHp':('maxHp',1),'atk':('atk',0),'def':('def',0),'res':('magicResistance',0),'bat':('baseAttackTime',1),'aspd':('attackSpeed',100),'moveSpeed':('moveSpeed',1),'massLevel':('massLevel',0),'hpRecoveryPerSec':('hpRecoveryPerSec',0),'elementRes':('epResistance',0),'elementDmgRes':('epDamageResistance',0),'blockCnt':('blockCnt',1),'tauntLevel':('tauntLevel',0)}
  st={k:mv(a.get(src),fallback) for k,(src,fallback) in fields.items()}
  way=mv(d.get('applyWay'),'MELEE');rng=mv(d.get('rangeRadius'),0);motion=mv(d.get('motion'),'WALK')
  dmg=next(iter(h.get('damageType') or ['PHYSIC']));st.update({'rangeRadius':max(0,rng) if way!='MELEE' else 0,'rawRangeRadius':rng,'motion':motion,'dmgType':{'PHYSIC':'phys','MAGIC':'arts','TRUE':'true','NO_DAMAGE':'none','HEAL':'heal'}.get(dmg,'phys'),'lpr':mv(d.get('lifePointReduce'),1),'immunities':{k:bool(mv(a.get(src),False)) for k,src in [('stun','stunImmune'),('silence','silenceImmune'),('sleep','sleepImmune'),('frozen','frozenImmune'),('levitate','levitateImmune')]}})
  abilities=h.get('abilityList',[]) or []
  record={'key':key,'name':mv(d.get('name'),h.get('name',key)),'level':lv['level'],'rank':mv(d.get('levelType'),'NORMAL'),'stats':st,'applyWay':way,'isFlyEnemy':motion=='FLY','talents':{'bb':{k:v for k,v in bb(d.get('talentBlackboard')).items() if not isinstance(v,str)},'bbStr':{k:v for k,v in bb(d.get('talentBlackboard')).items() if isinstance(v,str)}},'skills':[{'prefabKey':s.get('prefabKey'),'priority':s.get('priority',0),'cooldown':s.get('cooldown',0),'initCooldown':s.get('initCooldown',0),'spCost':s.get('spCost',0),'bb':{k:v for k,v in bb(s.get('blackboard')).items() if not isinstance(v,str)},'bbStr':{k:v for k,v in bb(s.get('blackboard')).items() if isinstance(v,str)}} for s in d.get('skills') or []],'abilities':abilities,'desc':h.get('description',''),'spine':mv(d.get('prefabKey'),key),'iconId':key,'tags':mv(d.get('enemyTags'),[])}
  variants.append(record)
 name=variants[0]['name'];wiki=name+'(敌方)' if name in ['W','泥岩','弑君者'] else name
 entries[key]={'key':key,'name':name,'wiki':'https://prts.wiki/w/'+urllib.parse.quote(wiki),'levels':variants,'inGame':key in existing}
out={'schemaVersion':1,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':sources,'notice':'Client-data catalogue. PRTS links are references; importing a record does not implement its skills. Coverage is reported separately.','enemies':entries}
for target in ['data/workshop-enemies.json','public/data/workshop-enemies.json']:
 (ROOT/target).write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print('catalogue',len(entries),'variants',sum(len(e['levels']) for e in entries.values()))
