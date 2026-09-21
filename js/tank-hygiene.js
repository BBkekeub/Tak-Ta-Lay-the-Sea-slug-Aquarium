const ALGAE_STEP=5*60*1000,ALGAE_GRACE=15*60*1000,ALGAE_FULL=5*3600000,ALGAE_CELLS=144;
const algaeAlphaBytes=new Map();let algaeAlphaContext=null;
function algaeAlphaByte(level){
 if(algaeAlphaBytes.has(level))return algaeAlphaBytes.get(level);
 // Browser CSS alpha quantization is not always Math.round(level * 255).
 // Sample each distinct level once with one reusable pixel, not three full masks.
 if(!algaeAlphaContext){const c=document.createElement('canvas');c.width=c.height=1;algaeAlphaContext=c.getContext('2d',{willReadFrequently:true});}
 const x=algaeAlphaContext;x.clearRect(0,0,1,1);x.fillStyle='rgba(255,255,255,'+level+')';x.fillRect(0,0,1,1);
 const value=x.getImageData(0,0,1,1).data[3];if(algaeAlphaBytes.size>=128)algaeAlphaBytes.clear();algaeAlphaBytes.set(level,value);return value;
}
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
 // Untouched surfaces have equal-area cells: simulation needs only their alpha
 // average. Build the full masks lazily for drawing or the first brush stroke.
 if(!(h.erases||[]).some(e=>now-e.at<ALGAE_FULL)){
  if(h.naturalLevels!==h.levels){h.naturalLevels=h.levels;h.naturalDirt=h.levels.reduce((sum,level)=>sum+algaeAlphaByte(level),0)/(255*ALGAE_CELLS);}
  h.dirt=h.naturalDirt;
  return h;
 }
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
/* ⚠️ 2026-09-21 ผู้เล่น: "มือถือแลคตอนทำความสะอาด"
   เดิมรอยแปรงถูกวาดลงแคนวาสมาสก์ แล้วอ่านกลับด้วย getImageData เพื่อรู้ว่าลบไปเท่าไร
   ลากนิ้วหนึ่งครั้งแตกเป็นจุดย่อยได้ถึง 10 จุด × 3 หน้า = อ่านกลับ 30 ครั้งในเฟรมเดียว
   (getImageData คือการรอ GPU→CPU ซึ่งบนมือถือแพงกว่าบนคอมมาก)
   ตอนนี้เก็บ coverage เป็น Uint8Array แล้วคิดรอยลบด้วยสูตรตรง ๆ — ไม่มีแคนวาสมาสก์ ไม่มีการอ่านกลับเลย
   โปรไฟล์เดียวกับ radial gradient เดิมเป๊ะ: ทึบเต็มถึง r=0.76 แล้วจางเป็นเส้นตรงจนหมดที่ r=1
   และ destination-out คือ dst×(1−src) ตามสเปกแคนวาส */
function algaeEraseBox(e){
 const rx=Math.hypot(e.ax,e.bx),ry=Math.hypot(e.ay,e.by);
 return {x0:Math.max(0,Math.floor(e.cx-rx)-1),y0:Math.max(0,Math.floor(e.cy-ry)-1),
         x1:Math.min(ALGAE_TEXTURE,Math.ceil(e.cx+rx)+1),y1:Math.min(ALGAE_TEXTURE,Math.ceil(e.cy+ry)+1)};
}
function applyAlgaeErase(coverage,e,strength=1){
 const box=algaeEraseBox(e),det=e.ax*e.by-e.ay*e.bx;
 if(box.x1<=box.x0||box.y1<=box.y0||Math.abs(det)<1e-8)return 0;
 let removed=0;
 for(let y=box.y0;y<box.y1;y++){
  const py=y+.5-e.cy,row=y*ALGAE_TEXTURE;
  for(let x=box.x0;x<box.x1;x++){
   const i=row+x,old=coverage[i];if(!old)continue;
   const px=x+.5-e.cx,u=(px*e.by-py*e.bx)/det,v=(-px*e.ay+py*e.ax)/det,r=Math.hypot(u,v);
   if(r>=1)continue;
   const src=strength*(r<=.76?1:(1-r)/.24),next=Math.round(old*(1-src));
   if(next<old){removed+=old-next;coverage[i]=next;}
  }
 }
 return removed;
}
/* กรอบ "ส่วนที่เพิ่งเปลี่ยน" ต่อหน้า — ใช้อัปเดตเท็กซ์เจอร์เฉพาะสี่เหลี่ยมนั้น ไม่ใช่ทั้งผืน */
const algaeEmptyBox=()=>({x0:ALGAE_TEXTURE,y0:ALGAE_TEXTURE,x1:0,y1:0});
const algaeFullBox=()=>({x0:0,y0:0,x1:ALGAE_TEXTURE,y1:ALGAE_TEXTURE});
function growAlgaeBox(box,add){
 if(add.x0<box.x0)box.x0=add.x0;if(add.y0<box.y0)box.y0=add.y0;
 if(add.x1>box.x1)box.x1=add.x1;if(add.y1>box.y1)box.y1=add.y1;
}
function algaeNextChange(h,now){let next=h.nextUpdate;for(const e of h.erases||[]){const age=now-e.at;next=Math.min(next,age<ALGAE_GRACE?e.at+ALGAE_GRACE:e.at+ALGAE_GRACE+(Math.floor((age-ALGAE_GRACE)/ALGAE_STEP)+1)*ALGAE_STEP);}return next;}
function rebuildAlgaeSurface(o,h,now){
 let cache=algaeSurfaceCache.get(o);
 if(cache&&cache.revision===(h.eraseRevision||0)&&cache.levels===h.levels&&now<cache.next){h.dirt=cache.dirt;return cache;}
 h.erases=(h.erases||[]).filter(e=>now-e.at<ALGAE_FULL);
 cache={revision:h.eraseRevision||0,levels:h.levels,next:algaeNextChange(h,now),faces:[],coverage:[],boxes:[],dirty:new Set(),dirt:0};
 // No coloured texture is allocated for offscreen tanks. Coverage is only rebuilt
 // when cleanliness actually changes, because breeding/attraction need that value.
 for(let face=0;face<3;face++){
  const coverage=new Uint8Array(ALGAE_TEXTURE*ALGAE_TEXTURE);
  /* หนึ่งหน้า = 8×6 ช่อง (ช่องละ 24×32 พิกเซล) ความเข้มคงที่ทั้งช่อง — เติมเป็นแถวด้วย fill() */
  for(let i=0;i<48;i++){
   const a=algaeAlphaByte(h.levels[face*48+i]);if(!a)continue;
   const bx=i%8*24,by=Math.floor(i/8)*32;
   for(let y=by;y<by+32;y++)coverage.fill(a,y*ALGAE_TEXTURE+bx,y*ALGAE_TEXTURE+bx+24);
  }
  for(const e of h.erases)if(e.face===face){const strength=algaeEraseStrength(e,now);if(strength>0)applyAlgaeErase(coverage,e,strength);}
  let sum=0;for(let i=0;i<coverage.length;i++)sum+=coverage[i];
  cache.coverage.push(coverage);cache.boxes.push(algaeFullBox());
  cache.dirt+=sum/(255*ALGAE_TEXTURE*ALGAE_TEXTURE*3);cache.dirty.add(face);
 }
 h.dirt=cache.dirt;algaeSurfaceCache.set(o,cache);return cache;
}
function eraseAlgaeRegion(cache,e){
 const removed=applyAlgaeErase(cache.coverage[e.face],e);
 if(!removed)return false;
 cache.dirt=Math.max(0,cache.dirt-removed/(255*ALGAE_TEXTURE*ALGAE_TEXTURE*3));
 growAlgaeBox(cache.boxes[e.face],algaeEraseBox(e));cache.dirty.add(e.face);return true;
}
/* อัปเดตเท็กซ์เจอร์เฉพาะสี่เหลี่ยมที่เพิ่งเปลี่ยน — เดิมสร้าง ImageData ใหม่ทั้งผืน 192×192 ต่อหน้าทุกเฟรม
   (110,592 พิกเซล + อัปโหลด 3 ใบ/เฟรม) ทั้งที่แปรงแตะแค่วงเล็ก ๆ */
function flushAlgaeTextures(cache){
 if(!cache.dirty.size)return;
 const tint=algaePalette();
 for(const face of cache.dirty){
  let canvas=cache.faces[face];
  if(!canvas){canvas=document.createElement('canvas');canvas.width=canvas.height=ALGAE_TEXTURE;cache.faces[face]=canvas;cache.boxes[face]=algaeFullBox();}
  const box=cache.boxes[face],w=box.x1-box.x0,h=box.y1-box.y0;
  if(w<=0||h<=0)continue;
  const x=canvas.getContext('2d'),img=x.createImageData(w,h),coverage=cache.coverage[face],data=img.data;
  for(let y=0;y<h;y++){
   let src=((box.y0+y)*ALGAE_TEXTURE+box.x0)*4,cov=(box.y0+y)*ALGAE_TEXTURE+box.x0,dst=y*w*4;
   for(let i=0;i<w;i++,src+=4,cov++,dst+=4){
    data[dst]=tint[src];data[dst+1]=tint[src+1];data[dst+2]=tint[src+2];data[dst+3]=coverage[cov]*tint[src+3];
   }
  }
  x.putImageData(img,box.x0,box.y0);
  cache.boxes[face]=algaeEmptyBox();
 }
 cache.dirty.clear();
}

function drawTankHygiene(o){if(document.hidden||!tankMode||o!==curTank)return;const now=Date.now(),h=tankHygiene(o,now);if(h.dirt<=0)return;const cache=rebuildAlgaeSurface(o,h,now);flushAlgaeTextures(cache);tctx.save();
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
 if(!added.length)return false;const cache=rebuildAlgaeSurface(o,h,now),effective=added.filter(e=>eraseAlgaeRegion(cache,e));
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

