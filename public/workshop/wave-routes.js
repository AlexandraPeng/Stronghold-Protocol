import { t } from '../../shared/i18n.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function mountRoutes(parent,w,config,stages,changed){
 const box=el('div');box.className='route-editor';box.id='routes';parent.append(box);
 box.append(el('h3',t('路线展示与编辑')),el('p',t('坐标从 0 开始，行号向上增加。虚线连接途经点，不代表实际寻路；地面敌人会绕过障碍。保存时检查所有适用地图的可达性。')));
 const select=el('select'),mapSelect=el('select'),content=el('div');select.setAttribute('aria-label',t('选择路线'));mapSelect.setAttribute('aria-label',t('预览地图'));
 w.routes.forEach((r,i)=>{const o=el('option',`${i} · ${r.motion}`);o.value=i;select.append(o);});
 Object.values(stages).filter(s=>s.active&&s.modes?.includes('mode_multi_abyss')).forEach(s=>{const o=el('option',s.name||s.id);o.value=s.id;mapSelect.append(o);});
 box.append(select,mapSelect,content);
 let selected=0;
 const draw=()=>{
  content.replaceChildren();const index=Number(select.value),original=w.routes[index];if(!original)return;
  const route=config.routes?.[w.id]?.[index]||original;
  const editable=w.kind==='normal' && (original.checkpoints||[]).every(p=>Array.isArray(p)&&typeof p[0]==='number');
  const points=[route.start,...route.checkpoints,route.end];selected=Math.min(selected,points.length-1);
  const save=()=>{config.routes??={};config.routes[w.id]??={};config.routes[w.id][index]={start:points[0].slice(),end:points.at(-1).slice(),checkpoints:points.slice(1,-1).map(p=>p.slice())};changed();draw();};
  if(!editable)content.append(el('p',t('领袖或特殊事件路线只读')));
  const stage=stages[mapSelect.value],svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',editable?'50 250 550 300':'0 0 1050 950');svg.setAttribute('aria-label',t('路线坐标图'));svg.classList.add('route-map');
  const shape=(tag,attrs,text)=>{const n=document.createElementNS(svg.namespaceURI,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;svg.append(n);return n;};
  for(let r=0;r<19;r++)for(let c=0;c<21;c++){
   const tile=stage?.tiles[stage.rows[r]?.[c]],allowed=r>=9&&r<=12&&c>=2&&c<=10;
   const cell=shape('rect',{x:c*50,y:(18-r)*50,width:48,height:48,fill:tile?.groundPassable?'#29463f':'#111c20',stroke:allowed?'#557b68':'#263235'});
   if(editable&&allowed){cell.style.cursor='crosshair';cell.onclick=()=>{points[selected]=[r,c];save();};}
  }
  const pos=p=>Array.isArray(p)&&typeof p[0]==='number'?p:null;
  const valid=points.map(pos).filter(Boolean);
  shape('polyline',{points:valid.map(p=>`${p[1]*50+24},${(18-p[0])*50+24}`).join(' '),fill:'none',stroke:'#f6cb66','stroke-width':4,'stroke-dasharray':'8 5','pointer-events':'none'});
  points.forEach((p,i)=>{if(!pos(p))return;shape('circle',{cx:p[1]*50+24,cy:(18-p[0])*50+24,r:14,fill:i===0?'#ed635b':i===points.length-1?'#57b4f4':'#e6bf62',stroke:i===selected?'white':'none','stroke-width':4,'pointer-events':'none'});shape('text',{x:p[1]*50+24,y:(18-p[0])*50+29,'text-anchor':'middle',fill:'#101a19','font-size':16,'pointer-events':'none'},String(i));});
  for(let r=9;r<=12;r++)shape('text',{x:60,y:(18-r)*50+29,fill:'#b2c8bf','font-size':16},String(r));
  for(let c=2;c<=10;c++)shape('text',{x:c*50+24,y:525,fill:'#b2c8bf','text-anchor':'middle','font-size':16},String(c));
  content.append(svg,el('p',t('红色为出生点，蓝色为终点，黄色为途经点。先选择一个点，再点击地图修改坐标。')));
  const list=el('div');list.className='route-points';content.append(list);
  points.forEach((p,i)=>{const row=el('div'),radio=el('button',`${i} · ${i===0?t('出生点'):i===points.length-1?t('终点'):t('途经点')}`);radio.type='button';radio.onclick=()=>{selected=i;draw();};radio.className=i===selected?'selected':'';row.append(radio);
   if(editable)for(let axis=0;axis<2;axis++){const label=el('label',axis===0?t('行'):t('列')),input=el('input');input.type='number';input.min=axis===0?9:2;input.max=axis===0?12:10;input.step=1;input.value=p[axis];input.setAttribute('aria-label',`${i} ${axis===0?t('行'):t('列')}`);input.onchange=()=>{p=p.slice();p[axis]=input.value===''?NaN:Number(input.value);points[i]=p;save();};label.append(input);row.append(label);}
   else row.append(el('code',JSON.stringify(p)));
   if(editable&&i>0&&i<points.length-1){for(const [text,delta] of [[t('上移'),-1],[t('下移'),1]]){const b=el('button',text);b.type='button';b.disabled=i+delta<1||i+delta>=points.length-1;b.onclick=()=>{[points[i],points[i+delta]]=[points[i+delta],points[i]];selected=i+delta;save();};row.append(b);}const del=el('button',t('删除'));del.type='button';del.onclick=()=>{points.splice(i,1);save();};row.append(del);}list.append(row);
  });
  if(editable){const add=el('button',t('添加途经点')),reset=el('button',t('恢复此路线'));add.type=reset.type='button';add.disabled=points.length>=34;add.onclick=()=>{points.splice(points.length-1,0,points.at(-2).slice());selected=points.length-2;save();};reset.onclick=()=>{if(config.routes?.[w.id])delete config.routes[w.id][index];changed();draw();};content.append(add,reset);}
 };
 select.onchange=()=>{selected=0;draw();};mapSelect.onchange=draw;draw();
}

