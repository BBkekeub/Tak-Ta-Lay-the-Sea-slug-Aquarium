/* Gameplay metadata adapter. Rendering is exclusively in decor-glb.js.
   The old frame records supply collision cells only, NEVER artwork. */
const TidalDecor=(()=>{
 const cells=new Map(),MAX_CELLS=128;
 const is=key=>!!TANK_DECOR[key]?.frames;
 const frame=(key,rotation=0,shop=false)=>TANK_DECOR[key]?.[shop?'shopFrames':'frames']?.[(rotation|0)&3];
 function trim(map,max){while(map.size>max)map.delete(map.keys().next().value);}
 function draw(context,key,rotation,p,pxPerCm,alpha,shop=false,enabled=true){
  // No image fallback. Missing WebGL/GLB is reported explicitly by DecorGLB.
  return null;
 }
 function cellSet(key,fx,fy,rotation,name){
  const id=[key,fx,fy,(rotation|0)&3,name].join('|');let set=cells.get(id);
  if(set)return set;
  const f=frame(key,rotation),list=f?.[name]||[];
  set=new Set(list.map(([x,y])=>Math.round((fx+x)/DCELL)+','+Math.round((fy+y)/DCELL)));
  cells.set(id,set);trim(cells,MAX_CELLS);return set;
 }
 function bounds(key,fx,fy,rotation){
  const f=frame(key,rotation);if(!f||!Number.isFinite(fx)||!Number.isFinite(fy))return null;
  if(!f._bounds){const a=f.place;f._bounds={left:Math.min(...a.map(c=>c[0])),right:Math.max(...a.map(c=>c[0]))+DCELL,top:Math.min(...a.map(c=>c[1])),bottom:Math.max(...a.map(c=>c[1]))+DCELL};}
  const b=f._bounds;return{left:fx+b.left,right:fx+b.right,top:fy+b.top,bottom:fy+b.bottom};
 }
 return{is,frame,draw,cellSet,bounds};
})();

// Existing purchase, credit, placement, selection and save paths remain authoritative.
{
 const oldDraw=drawDecorAt;drawDecorAt=function(key,fx,fy,alpha,flip){
  if(!TidalDecor.is(key))return oldDraw(key,fx,fy,alpha,flip);
  return window.DecorGLB?.decorBox(key,fx,fy,flip)||null;
 };
 const oldOptions=flipOptions;flipOptions=key=>TidalDecor.is(key)?[0,1,2,3]:oldOptions(key);
 const oldCells=decorCellSet;decorCellSet=(o,name)=>TidalDecor.is(o.key)?TidalDecor.cellSet(o.key,o.fx,o.fy,o.flip,name):oldCells(o,name);
 const oldSolid=decorSolidSet;decorSolidSet=function(decor){
  if(!decor?.some(o=>TidalDecor.is(o.key)))return oldSolid(decor);
  const result=oldSolid(decor.filter(o=>!TidalDecor.is(o.key)));
  for(const o of decor)if(TidalDecor.is(o.key))for(const k of decorCellSet(o,'solid'))result.add(k);return result;
 };
 const oldFootprint=decorFootprint;decorFootprint=(key,x,y,r)=>TidalDecor.is(key)?TidalDecor.cellSet(key,x,y,r,'place'):oldFootprint(key,x,y,r);
 const oldBounds=decorRequiredBounds;decorRequiredBounds=(key,x,y,r)=>TidalDecor.is(key)?TidalDecor.bounds(key,x,y,r):oldBounds(key,x,y,r);
}
function decorRotationName(key,r){return TidalDecor.is(key)?'หมุน '+((r|0)&3)*90+'°':FLIP_NAME[r];}

document.addEventListener('DOMContentLoaded',()=>{
 const style=document.createElement('style');style.textContent=`
 #tankDecorDock .dbtn[data-key^="tidal_"]{height:94px}
 #tankDecorDock .dbtn[data-key^="tidal_"] img{height:54px}
 #tankDecorDock .dbtn[data-key^="tidal_"] strong{display:block;font-size:10px;line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;width:100%}
 #tankDecorDock .dbtn[data-key^="tidal_"] b{line-height:16px}
 #tankDecorDock .decorSelection #dFlip{min-width:116px}
 @media(max-width:820px),(max-width:1000px) and (max-height:600px){
  #ov #tankDecorDock #ovDecor{flex-wrap:nowrap!important;min-width:0}
  #ov .ov-body.decor-open #tankCv{height:calc(100% - 225px)!important}
  #tankDecorDock .decorTrayHead{display:flex!important;width:100%;max-width:100%;min-width:0;box-sizing:border-box;height:90px!important;min-height:90px;flex-wrap:wrap;gap:2px;align-content:start;padding-right:0!important}
  #tankDecorDock .decorTabs{flex:0 0 100%;height:44px!important}
  #tankDecorDock .decorTabs button{padding:4px 10px}
  #tankDecorDock .decorSelection{flex:0 0 100%;height:42px!important}
  #tankDecorDock .decorSelection span{display:none}
  #tankDecorDock .dbtn[data-key^="tidal_"]{height:98px!important}
  #tankDecorDock .dbtn[data-key^="tidal_"] img{height:54px!important;flex:0 0 54px}
  #tankDecorDock .dbtn[data-key^="tidal_"] strong{flex:0 0 14px}
  #tankDecorDock .dbtn[data-key^="tidal_"] b{flex:0 0 16px}
 }
 `;document.head.append(style);
 for(const b of document.querySelectorAll('#dpal .dbtn')){
  const key=b.dataset.key,d=TANK_DECOR[key];if(!TidalDecor.is(key))continue;
  b.title=d.name+' · '+d.cat+' · '+d.sizeCm.join(' × ')+' ซม. · '+decorPrice(key)+' เหรียญ · คลิกเลือกแล้ววางในตู้เพื่อซื้อ';
  b.setAttribute('aria-label',d.name+' ราคา '+decorPrice(key)+' เหรียญ');
 }
 const oldSync=syncDecorBar;
 syncDecorBar=function(){
  oldSync();
  if(tankBuildMode){
   const tab=document.querySelector('#tankDecorDock [aria-selected="true"]');
   if(tab){const strip=tab.parentElement,r=tab.getBoundingClientRect(),s=strip.getBoundingClientRect();if(r.left<s.left)strip.scrollLeft+=r.left-s.left;else if(r.right>s.right)strip.scrollLeft+=r.right-s.right;}
  }
 };
});
