/* ของตกแต่ง 2D แบบภาพหลายมุม (sprite: true + frames[4]) — วาด ชน และหมุนทีละ 90°
   นิยามอยู่ใน js/sprite-decor-defs.js (SPRITE_DECOR_DEFS) · ใช้ระบบซื้อ/เครดิต/เซฟเดิมของ decor ทั้งหมด
   ภาพโหลดครั้งเดียวต่อไฟล์ ข้ามการวาดเมื่ออยู่นอกจอหรือแท็บซ่อน */
const SpriteDecor=(()=>{
 const cells=new Map(),MAX_CELLS=128,images=new Map();
 const is=key=>!!(TANK_DECOR[key]?.sprite&&TANK_DECOR[key].frames);
 const frame=(key,rotation=0,shop=false)=>TANK_DECOR[key]?.[shop?'shopFrames':'frames']?.[(rotation|0)&3];
 function trim(map,max){while(map.size>max)map.delete(map.keys().next().value);}
 function draw(context,key,rotation,p,pxPerCm,alpha,shop=false,enabled=true){
  if(!is(key)||!enabled||document.hidden)return null;
  const f=frame(key,rotation,shop);if(!f)return null;
  const w=f.wCm*pxPerCm,h=f.hCm*pxPerCm,x=p.x-w*f.anchor.x,y=p.y-h*f.anchor.y;
  const shear=(f.shearCm||0)*pxPerCm,dx0=-shear*f.anchor.y,dx1=shear*(1-f.anchor.y);
  const box={x:x+Math.min(dx0,dx1),y,w:w+Math.abs(shear),h};
  if(box.x+box.w<0||y+h<0||box.x>context.canvas.width||y>context.canvas.height)return box;
  let e=images.get(f.src);
  if(!e){e={img:new Image(),ok:false};e.img.onload=()=>{e.ok=true;};e.img.src=f.src;images.set(f.src,e);}
  if(e.ok){context.save();if(alpha!=null)context.globalAlpha=alpha;context.translate(p.x,p.y);context.transform(1,0,h?shear/h:0,1,0,0);context.drawImage(e.img,-w*f.anchor.x,-h*f.anchor.y,w,h);context.restore();}
  return box;
 }
 function cellSet(key,fx,fy,rotation,name){
  const id=[key,fx,fy,(rotation|0)&3,name].join('|');let set=cells.get(id);
  if(set)return set;
  const f=frame(key,rotation),list=f?.[name]||[];
  set=new Set();const size=TANK_DECOR[key].cell||.5;
  for(const [x,y] of list)for(let ix=Math.round((fx+x)/DCELL);ix<Math.round((fx+x+size)/DCELL);ix++)for(let iy=Math.round((fy+y)/DCELL);iy<Math.round((fy+y+size)/DCELL);iy++)set.add(ix+','+iy);
  cells.set(id,set);trim(cells,MAX_CELLS);return set;
 }
 function bounds(key,fx,fy,rotation){
  const f=frame(key,rotation);if(!f||!Number.isFinite(fx)||!Number.isFinite(fy))return null;
  if(!f._bounds){const a=f.place,size=TANK_DECOR[key].cell||.5;f._bounds={left:Math.min(...a.map(c=>c[0])),right:Math.max(...a.map(c=>c[0]))+size,top:Math.min(...a.map(c=>c[1])),bottom:Math.max(...a.map(c=>c[1]))+size};}
  const b=f._bounds;return{left:fx+b.left,right:fx+b.right,top:fy+b.top,bottom:fy+b.bottom};
 }
 return{is,frame,draw,cellSet,bounds};
})();

// ระบบซื้อ เครดิต การวาง การเลือก และเซฟเดิมยังเป็นตัวหลัก — ตรงนี้แค่แทนการวาด/ชนของชิ้นหลายมุม
{
 const oldDraw=drawDecorAt;drawDecorAt=function(key,fx,fy,alpha,flip){
  if(!SpriteDecor.is(key))return oldDraw(key,fx,fy,alpha,flip);
  return SpriteDecor.draw(tctx,key,flip,S(fx,fy,SAND_CELLS),depthPxPerCm()*(curTank?.def.decorScale||1),alpha);
 };
 const oldOptions=flipOptions;flipOptions=key=>SpriteDecor.is(key)?[0,1,2,3]:oldOptions(key);
 const oldCells=decorCellSet;decorCellSet=(o,name)=>SpriteDecor.is(o.key)?SpriteDecor.cellSet(o.key,o.fx,o.fy,o.flip,name):oldCells(o,name);
 const oldSolid=decorSolidSet;decorSolidSet=function(decor){
  if(!decor?.some(o=>SpriteDecor.is(o.key)))return oldSolid(decor);
  const result=oldSolid(decor.filter(o=>!SpriteDecor.is(o.key)));
  for(const o of decor)if(SpriteDecor.is(o.key))for(const k of decorCellSet(o,'solid'))result.add(k);return result;
 };
 const oldFootprint=decorFootprint;decorFootprint=(key,x,y,r)=>SpriteDecor.is(key)?SpriteDecor.cellSet(key,x,y,r,'place'):oldFootprint(key,x,y,r);
 const oldBounds=decorRequiredBounds;decorRequiredBounds=(key,x,y,r)=>SpriteDecor.is(key)?SpriteDecor.bounds(key,x,y,r):oldBounds(key,x,y,r);
}
function decorRotationName(key,r){return SpriteDecor.is(key)?'หมุน '+((r|0)&3)*90+'°':FLIP_NAME[r];}

document.addEventListener('DOMContentLoaded',()=>{
 const style=document.createElement('style');style.textContent=`
 #tankDecorDock .dbtn[data-key^="sprite_"]{height:94px}
 #tankDecorDock .dbtn[data-key^="sprite_"] img{height:54px}
 #tankDecorDock .dbtn[data-key^="sprite_"] strong{display:block;font-size:10px;line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;width:100%}
 #tankDecorDock .dbtn[data-key^="sprite_"] b{line-height:16px}
 #tankDecorDock .decorSelection #dFlip{min-width:116px}
 @media(max-width:820px),(max-width:1000px) and (max-height:600px){
  #ov #tankDecorDock #ovDecor{flex-wrap:nowrap!important;min-width:0}
  #ov .ov-body.decor-open #tankCv{height:calc(100% - 225px)!important}
  #tankDecorDock .decorTrayHead{display:flex!important;width:100%;max-width:100%;min-width:0;box-sizing:border-box;height:90px!important;min-height:90px;flex-wrap:wrap;gap:2px;align-content:start;padding-right:0!important}
  #tankDecorDock .decorTabs{flex:0 0 100%;height:44px!important}
  #tankDecorDock .decorTabs button{padding:4px 10px}
  #tankDecorDock .decorSelection{flex:0 0 100%;height:42px!important}
  #tankDecorDock .decorSelection span{display:none}
  #tankDecorDock .dbtn[data-key^="sprite_"]{height:98px!important}
  #tankDecorDock .dbtn[data-key^="sprite_"] img{height:54px!important;flex:0 0 54px}
  #tankDecorDock .dbtn[data-key^="sprite_"] strong{flex:0 0 14px}
  #tankDecorDock .dbtn[data-key^="sprite_"] b{flex:0 0 16px}
 }
 `;document.head.append(style);
 for(const b of document.querySelectorAll('#dpal .dbtn')){
  const key=b.dataset.key,d=TANK_DECOR[key];if(!SpriteDecor.is(key))continue;
  b.title=d.name+' · '+d.cat+' · '+(d.sizeCm?.join(' × ')||d.priceCm)+' ซม. · '+decorPrice(key)+' เหรียญ · คลิกเลือกแล้ววางในตู้เพื่อซื้อ';
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
