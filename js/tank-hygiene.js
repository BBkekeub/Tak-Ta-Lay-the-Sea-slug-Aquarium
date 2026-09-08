const ALGAE_STEP=5*60*1000,ALGAE_GRACE=15*60*1000,ALGAE_FULL=5*3600000,ALGAE_CELLS=144;
function tankHygiene(o,now=Date.now()){
 if(!o.hygiene||!Array.isArray(o.hygiene.cleaned)||o.hygiene.cleaned.length!==ALGAE_CELLS)o.hygiene={cleaned:Array(ALGAE_CELLS).fill(now)};
 const h=o.hygiene;
 if(h.bucket!=='test-15m-5m'||now>=h.nextUpdate){
  h.bucket='test-15m-5m';h.nextUpdate=Infinity;
  h.levels=h.cleaned.map(t=>{const age=Math.max(0,now-t);
   if(age<ALGAE_GRACE){h.nextUpdate=Math.min(h.nextUpdate,t+ALGAE_GRACE);return 0;}
   if(age>=ALGAE_FULL)return 1;
   const steps=Math.floor((age-ALGAE_GRACE)/ALGAE_STEP);
   h.nextUpdate=Math.min(h.nextUpdate,t+ALGAE_GRACE+(steps+1)*ALGAE_STEP,t+ALGAE_FULL);
   return .15+.85*Math.min(1,steps*ALGAE_STEP/(ALGAE_FULL-ALGAE_GRACE));
  });h.dirt=h.levels.reduce((a,b)=>a+b,0)/ALGAE_CELLS;
 }
 if(h.levels.every(v=>v===0)){h.dirt=0;algaeSurfaceCache.delete(o);return h;}
 rebuildAlgaeSurface(o,h,now);return h;
}
function tankCleanliness(o,now=Date.now()){return 100*(1-tankHygiene(o,now).dirt);}
function tankAttractionFactor(o){return 1-.75*tankHygiene(o).dirt;}
function breedingSatietyFactor(value){return Math.max(0,Math.min(1,(Number.isFinite(value)?value:50)/90));}
function breedingCleanFactor(o){return .25+.75*tankCleanliness(o)/100;}
function algaeCell(o,i){
 const face=Math.floor(i/48),u=(i%8)/8,v=Math.floor(i%48/8)/6,du=1/8,dv=1/6,w=o.def.w,h=o.def.h,z=SAND_CELLS,top=wallCells()*.9;
 const at=(a,b)=>face===0?S(a*w,b*h,z+.03):face===1?S(a*w,0,z+b*(top-z)):S(0,a*h,z+b*(top-z));
 return {q:[at(u,v),at(u+du,v),at(u+du,v+dv),at(u,v+dv)],center:at(u+du/2,v+dv/2)};
}

const algaeSurfaceCache=new WeakMap(),ALGAE_TEXTURE=192;
function algaeFace(o,face){const w=o.def.w,h=o.def.h,z=SAND_CELLS,top=wallCells()*.9;const at=(u,v)=>face===0?S(u*w,v*h,z+.03):face===1?S(u*w,0,z+v*(top-z)):S(0,u*h,z+v*(top-z));return [at(0,0),at(1,0),at(0,1)];}
// Colour/grain is immutable; generate it once, not for every brush sample.
let algaeTint=null;
function algaePalette(){
 if(algaeTint)return algaeTint;algaeTint=new Float32Array(ALGAE_TEXTURE*ALGAE_TEXTURE*4);
 for(let y=0;y<ALGAE_TEXTURE;y++)for(let x=0;x<ALGAE_TEXTURE;x++){const i=(y*ALGAE_TEXTURE+x)*4,cloud=(Math.sin(x*.049+Math.sin(y*.035)*2)+Math.sin(y*.073-x*.027)+2)/4,grain=((x*73+y*151+(x*y)%137)%97)/97;algaeTint[i]=76+cloud*24;algaeTint[i+1]=101+cloud*24;algaeTint[i+2]=57+cloud*15;algaeTint[i+3]=.09+.18*cloud+.04*grain;}
 return algaeTint;
}
function algaeEraseStrength(e,now){const age=Math.max(0,now-e.at);return age<ALGAE_GRACE?1:Math.max(0,1-(.15+.85*Math.floor((age-ALGAE_GRACE)/ALGAE_STEP)*ALGAE_STEP/(ALGAE_FULL-ALGAE_GRACE)));}
function stampAlgaeMask(c,e,strength=1){c.save();c.globalCompositeOperation='destination-out';c.setTransform(e.ax,e.ay,e.bx,e.by,e.cx,e.cy);const g=c.createRadialGradient(0,0,.76,0,0,1);g.addColorStop(0,'rgba(0,0,0,'+strength+')');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();}
function algaeNextChange(h,now){let next=h.nextUpdate;for(const e of h.erases||[]){const age=now-e.at;next=Math.min(next,age<ALGAE_GRACE?e.at+ALGAE_GRACE:e.at+ALGAE_GRACE+(Math.floor((age-ALGAE_GRACE)/ALGAE_STEP)+1)*ALGAE_STEP);}return next;}
function rebuildAlgaeSurface(o,h,now){
 let cache=algaeSurfaceCache.get(o);
 if(cache&&cache.revision===(h.eraseRevision||0)&&cache.levels===h.levels&&now<cache.next){h.dirt=cache.dirt;return cache;}
 h.erases=(h.erases||[]).filter(e=>now-e.at<ALGAE_FULL);
 cache={revision:h.eraseRevision||0,levels:h.levels,next:algaeNextChange(h,now),faces:[],masks:[],coverage:[],dirty:new Set(),dirt:0};
 // No coloured texture is allocated for offscreen tanks. Masks are only rebuilt
 // when cleanliness actually changes, because breeding/attraction need that value.
 for(let face=0;face<3;face++){
  const c=document.createElement('canvas');c.width=c.height=ALGAE_TEXTURE;const x=c.getContext('2d',{willReadFrequently:true});
  for(let i=0;i<48;i++){x.fillStyle='rgba(255,255,255,'+h.levels[face*48+i]+')';x.fillRect(i%8*24,Math.floor(i/8)*32,24,32);}
  for(const e of h.erases)if(e.face===face){const strength=algaeEraseStrength(e,now);if(strength>0)stampAlgaeMask(x,e,strength);}
  const pixels=x.getImageData(0,0,ALGAE_TEXTURE,ALGAE_TEXTURE).data,coverage=new Uint8Array(ALGAE_TEXTURE*ALGAE_TEXTURE);let sum=0;
  for(let i=0;i<coverage.length;i++){coverage[i]=pixels[i*4+3];sum+=coverage[i];}
  cache.masks.push(x);cache.coverage.push(coverage);cache.dirt+=sum/(255*ALGAE_TEXTURE*ALGAE_TEXTURE*3);cache.dirty.add(face);
 }
 h.dirt=cache.dirt;algaeSurfaceCache.set(o,cache);return cache;
}
function eraseAlgaeRegion(cache,e){
 const rx=Math.hypot(e.ax,e.bx),ry=Math.hypot(e.ay,e.by),left=Math.max(0,Math.floor(e.cx-rx)-1),top=Math.max(0,Math.floor(e.cy-ry)-1),right=Math.min(ALGAE_TEXTURE,Math.ceil(e.cx+rx)+1),bottom=Math.min(ALGAE_TEXTURE,Math.ceil(e.cy+ry)+1);
 if(right<=left||bottom<=top)return false;
 const x=cache.masks[e.face],old=cache.coverage[e.face];stampAlgaeMask(x,e);
 const w=right-left,h=bottom-top,pixels=x.getImageData(left,top,w,h).data;let removed=0;
 for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){const i=(top+y)*ALGAE_TEXTURE+left+xx,a=pixels[(y*w+xx)*4+3];removed+=old[i]-a;old[i]=a;}
 if(!removed)return false;cache.dirt=Math.max(0,cache.dirt-removed/(255*ALGAE_TEXTURE*ALGAE_TEXTURE*3));cache.dirty.add(e.face);return true;
}
function flushAlgaeTextures(cache){
 const tint=algaePalette();for(const face of cache.dirty){let canvas=cache.faces[face];if(!canvas){canvas=document.createElement('canvas');canvas.width=canvas.height=ALGAE_TEXTURE;cache.faces[face]=canvas;}const x=canvas.getContext('2d'),pixels=x.createImageData(ALGAE_TEXTURE,ALGAE_TEXTURE),coverage=cache.coverage[face];for(let i=0;i<coverage.length;i++){const k=i*4;pixels.data[k]=tint[k];pixels.data[k+1]=tint[k+1];pixels.data[k+2]=tint[k+2];pixels.data[k+3]=coverage[i]*tint[k+3];}x.putImageData(pixels,0,0);}cache.dirty.clear();
}

function drawTankHygiene(o){if(document.hidden||!tankMode||o!==curTank)return;const h=tankHygiene(o);if(h.dirt<=0)return;const cache=algaeSurfaceCache.get(o);flushAlgaeTextures(cache);tctx.save();
 cache.faces.forEach((canvas,face)=>{const [p,a,b]=algaeFace(o,face);tctx.save();tctx.transform((a.x-p.x)/ALGAE_TEXTURE,(a.y-p.y)/ALGAE_TEXTURE,(b.x-p.x)/ALGAE_TEXTURE,(b.y-p.y)/ALGAE_TEXTURE,p.x,p.y);tctx.drawImage(canvas,0,0);tctx.restore();});tctx.restore();}
let tankBrush=false,brushDown=false,brushPoint=null;
function scrubTank(o,x,y,now=Date.now()){
 const h=tankHygiene(o,now),before=h.dirt;if(before<=.0001)return false;
 const added=[];
 for(let face=0;face<3;face++){const [p,a,b]=algaeFace(o,face),ux=(a.x-p.x)/ALGAE_TEXTURE,uy=(a.y-p.y)/ALGAE_TEXTURE,vx=(b.x-p.x)/ALGAE_TEXTURE,vy=(b.y-p.y)/ALGAE_TEXTURE,det=ux*vy-uy*vx;if(Math.abs(det)<1e-8)continue;
  const cx=(vy*(x-p.x)-vx*(y-p.y))/det,cy=(-uy*(x-p.x)+ux*(y-p.y))/det,ax=85*vy/det,ay=-85*uy/det,bx=-85*vx/det,by=85*ux/det;
  if(cx+Math.hypot(ax,bx)<0||cy+Math.hypot(ay,by)<0||cx-Math.hypot(ax,bx)>ALGAE_TEXTURE||cy-Math.hypot(ay,by)>ALGAE_TEXTURE)continue;
  added.push({face,cx,cy,ax,ay,bx,by,at:now});
 }
 if(!added.length)return false;const cache=algaeSurfaceCache.get(o),effective=added.filter(e=>eraseAlgaeRegion(cache,e));
 if(!effective.length)return false;h.erases.push(...effective);h.eraseRevision=(h.eraseRevision||0)+1;cache.revision=h.eraseRevision;cache.next=Math.min(cache.next,now+ALGAE_GRACE);h.dirt=cache.dirt;
 const baseline=h.levels.reduce((a,b)=>a+b,0)/ALGAE_CELLS;
 if(before/Math.max(.0001,baseline)<.05){h.cleaned.fill(now);h.erases=[];h.eraseRevision++;delete h.bucket;tankHygiene(o,now);}
 return true;
}
(()=>{
 const button=document.createElement('button');button.className='tbtn';button.id='tankBrush';document.querySelector('.tank-side.right').append(button);
 const cursor=document.createElement('div');cursor.style.cssText='position:absolute;pointer-events:none;z-index:4;width:170px;height:170px;border:2px solid #e5d9b799;border-radius:50%;background:#d5edc012;box-sizing:border-box;display:none';ov.querySelector('.ov-body').append(cursor);
 const update=()=>{if(curTank){const text=(tankBrush?'✓ เก็บแปรง':'🧹 ทำความสะอาด')+' · '+Math.round(tankCleanliness(curTank))+'%';if(button.textContent!==text)button.textContent=text;}};
 function stop(){tankBrush=false;brushDown=false;brushPoint=null;cursor.style.display='none';update();}
 registerMode('brush','tank',()=>tankBrush,stop);
 button.onclick=()=>{if(tankBrush){stop();return;}enterExclusiveMode('brush');tankBrush=true;cancelHold();pendSlug=null;update();};   // เปิดแปรง = ปิดจัดของ/วางอาหารให้เอง
 function brush(e){const p=tankXY(e);cursor.style.display='block';cursor.style.left=(p.mx-85)+'px';cursor.style.top=(p.my-85)+'px';if(brushDown){const prev=brushPoint||p,n=Math.max(1,Math.ceil(Math.hypot(p.mx-prev.mx,p.my-prev.my)/35));for(let i=1;i<=n;i++)scrubTank(curTank,prev.mx+(p.mx-prev.mx)*i/n,prev.my+(p.my-prev.my)*i/n);brushPoint=p;update();}}
 ov.querySelector('.ov-body').addEventListener('pointerdown',e=>{if(!tankBrush||e.target!==tankCv)return;e.stopImmediatePropagation();e.preventDefault();brushDown=true;brushPoint=null;tankCv.setPointerCapture(e.pointerId);brush(e);},true);
 ov.querySelector('.ov-body').addEventListener('pointermove',e=>{if(!tankBrush||e.target!==tankCv)return;e.stopImmediatePropagation();brush(e);},true);
 ov.querySelector('.ov-body').addEventListener('pointerup',e=>{if(!tankBrush||e.target!==tankCv)return;e.stopImmediatePropagation();brush(e);brushDown=false;brushPoint=null;saveGame();},true);
 ov.querySelector('.ov-body').addEventListener('pointercancel',()=>{brushDown=false;brushPoint=null;});
 document.getElementById('ovAdd').addEventListener('click',stop);   // ใส่ทากลงตู้ไม่ใช่โหมด แต่ต้องเก็บแปรงก่อน
 window.addEventListener('keydown',e=>{if(e.key==='Escape')stop();});
 setInterval(()=>{for(const o of [...G.objs,...G.shelter])if(o.type==='tank')tankHygiene(o);update();},1000);update();
})();

