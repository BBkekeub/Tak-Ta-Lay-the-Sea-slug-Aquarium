/* Temporary food effects: base genes remain hereditary and unmodified. */
const FOOD_TYPES={
 anemone:{name:'ดอกไม้ทะเล',icon:'🌸',levels:[{sat:10,cap:5,h:3,color:5,gillAura:5,vigor:5},{sat:15,cap:8,h:5,color:10,gillAura:10,vigor:10},{sat:15,cap:10,h:10,color:15,gillAura:15,vigor:15}]},
 hydroid:{name:'ไฮดรอยด์',icon:'🌿',levels:[{sat:15,cap:10,h:2,gillLen:10,gillAura:10},{sat:25,cap:10,h:4,gillLen:20,gillAura:15}]},
 algae:{name:'สาหร่าย',icon:'🥬',levels:[{sat:30,cap:10,h:2,girth:3},{sat:40,cap:10,h:2,girth:5},{sat:40,cap:15,h:2,girth:5}]},
 sponge:{name:'ฟองน้ำทะเล',icon:'🧽',levels:[{sat:15,cap:10,h:2,gillLen:-10,gillAura:10},{sat:25,cap:10,h:4,gillLen:-20,gillAura:15}]}
};
for(const food of Object.values(FOOD_TYPES))for(const spec of food.levels){if(spec.gillAura!=null)spec.vigor=Math.max(spec.vigor||0,spec.gillAura);delete spec.gillAura;spec.cost=Math.max(1,Math.round(spec.sat*spec.cap*FOOD_COST_PER_SAT));}   // ราคา = ค่าอิ่ม × จำนวนคำ × อัตราใน config.js
const FOOD_IMAGES={};
let foodChoice=null,foodHover=null,foodSeq=0;
let foodMode=false;   // โหมดวางอาหาร: เปิดค้างไว้ วางได้เรื่อย ๆ · ย้ายอาหารเดิมได้เฉพาะตอนเปิดโหมดนี้
const foodClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/* อิ่มเกินค่านี้ = ไม่เดินไปกิน (เดิมกินทุกชิ้นแม้อิ่มเต็ม ค่าอิ่มส่วนเกินถูกทิ้ง) */
const FOOD_HUNGRY=90;
/* อาหารที่ไม่มีใครกินจะเน่าหายไปเอง — กันเศษอาหารค้างจนพื้นตู้เต็ม 8 ชิ้นแล้ววางใหม่ไม่ได้ */
const FOOD_SPOIL_MS=15*60*1000;
function foodStats(s,now=Date.now()){
 if(!Number.isFinite(s.satiety))s.satiety=50;
 if(!Array.isArray(s.foodBuffs))s.foodBuffs=[];
 s.foodBuffs=s.foodBuffs.filter(b=>b.until>now);
 return s;
}
function foodGenes(s,now=Date.now()){
 foodStats(s,now);const g={...s.genes};
 
 for(const b of s.foodBuffs){for(const [k,v] of Object.entries(b.delta))if(k!=='gillAura')g[k]=(g[k]||0)+v;if(b.delta.gillAura!=null)g.vigor+=Math.max(0,b.delta.gillAura-(b.delta.vigor||0));}
 for(const k of ['mainC','accC'])g[k]=foodClamp(g[k],0,400);
 for(const k of ['girth','gillLen','vigor'])g[k]=foodClamp(g[k],0,100);
 return g;
}
function foodDescription(spec){
 const a=[];if(spec.color)a.push('สี → จุดสีใกล้สุด 0–'+spec.color);
 for(const [k,label]of [['gillLen','ขนาดหงอน'],['vigor','ความสมบูรณ์ / ออร่าหงอน'],['girth','ขนาดตัว']])if(spec[k]!=null)a.push(label+' '+(spec.color?'0–':spec[k]>0?'+':'')+spec[k]);
 return a.join(' · ');
}
function applyFood(s,f,now=Date.now()){
 foodStats(s,now);if(f.eaten.length>=f.spec.cap||s.satiety>=100)return false;   // cap = จำนวนคำ · ตัวเดิมกินซ้ำได้จนกว่าอาหารจะหมด
 const d={},spec=f.spec;
 for(const k of ['gillLen','girth'])if(spec[k]!=null)d[k]=spec[k];
 for(const k of ['vigor'])if(spec[k]!=null)d[k]=spec.color?Math.floor(Math.random()*(spec[k]+1)):spec[k];
 if(spec.color)for(const k of ['mainC','accC']){const v=s.genes[k],target=Math.round(v/50)*50,amount=Math.floor(Math.random()*(spec.color+1));d[k]=Math.sign(target-v)*Math.min(Math.abs(target-v),amount);}
 s.foodBuffs=s.foodBuffs.filter(b=>b.type!==f.type);
 s.foodBuffs.push({type:f.type,level:f.level,delta:d,until:now+spec.h*3600000});
 s.satiety=foodClamp(s.satiety+spec.sat,0,100);f.eaten.push(s.id);
 s.state='rest';s.stt=4;s._meal=null;s._mealCooldown=now+8000;
 return true;
}
// Grid BFS respects the same five body collision samples as normal walking.
function foodPath(s,tx,ty,fw,fh,solid){
 const scale=s._breedScale||1,rad=slugCm(s.genes)/CM_PER_CELL*.35*scale,margin=slugCm(s.genes)/CM_PER_CELL*.55*scale+.2;
 const clear=(x,y)=>x>=(s._foodZoneLo||0)+margin&&x<=(s._foodZoneHi||fw)-margin&&y>=margin&&y<=fh-margin&&![[x,y],[x+rad,y],[x-rad,y],[x,y+rad],[x,y-rad]].some(p=>solid.has(ptKey(...p)));
 const start=[Math.floor(s.fx),Math.floor(s.fy)],key=(x,y)=>x+','+y;
 const q=[start],prev=new Map([[key(...start),null]]);let found=null,best=Infinity;
 for(let i=0;i<q.length;i++){
  const [x,y]=q[i],d=Math.hypot(x+0.5-tx,y+0.5-ty);
  if(clear(x+0.5,y+0.5)&&d<best){best=d;found=[x,y];}if(d<0.6)break;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(prev.has(k)||!clear(nx+0.5,ny+0.5))continue;prev.set(k,[x,y]);q.push([nx,ny]);}
 }
 if(!found||best>1.0)return null;
 const path=[];for(let p=found;p&&prev.get(key(...p));p=prev.get(key(...p)))path.push({x:p[0]+0.5,y:p[1]+0.5});
 path.reverse();return {path,end:{x:found[0]+0.5,y:found[1]+0.5}};
}
function foodPrepare(slugs,fw,fh,obstacles,sharedSolid,providedTank){
 const tank=providedTank||G.objs.find(o=>o.type==='tank'&&o.slugs.some(s=>slugs.includes(s)));
 if(tank?.def.breeder){slugs=prepareBreederFoodSlugs(tank);fw=tank.def.w;}
 if(!tank)return;const now=Date.now();
 if(now<(tank._foodScanAt||0))return;tank._foodScanAt=now+750;
 const solid=sharedSolid||decorSolidSet(obstacles);
 const kept=[];
 for(const f of (tank.foods||[])){
  if(!f._placedAt)f._placedAt=now;
  if(f.eaten.length<f.spec.cap&&now-f._placedAt<FOOD_SPOIL_MS)kept.push(f);else f._gone=true;
 }
 tank.foods=kept;
 /* ทากบนกำแพงไม่ถูกเรียก foodStep (tank-view.js) → ถ้าจองมื้อไว้จะค้างและกินโควตาอาหารทิ้ง */
 for(const s of slugs){foodStats(s,now);if(s.wall&&s._meal){delete s._meal.food.reserved[s.id];s._meal=null;}}
 for(const f of tank.foods){
  for(const id of Object.keys(f.reserved))if(!slugs.some(s=>s.id===id&&s._meal&&s._meal.food===f&&s._meal.deadline>now))delete f.reserved[id];
  const candidates=slugs.filter(s=>f.fx>=(s._foodZoneLo||0)&&f.fx<(s._foodZoneHi||fw)&&!s._meal&&!s.wall&&s.satiety<FOOD_HUNGRY&&(s._mealCooldown||0)<now&&s!==heldSlug&&!['climb','climbUp','climbDown','dash','dashCharge','flee','startle'].includes(s.state)).sort((a,b)=>Math.hypot(a.fx-f.fx,a.fy-f.fy)-Math.hypot(b.fx-f.fx,b.fy-f.fy));
  for(const s of candidates){
   if(f.eaten.length+Object.keys(f.reserved).length>=f.spec.cap)break;
   let route=null,slot=-1;
   for(let j=0;j<f.spec.cap;j++){
    if(Object.values(f.reserved).includes(j))continue;
    const angle=j*2*Math.PI/f.spec.cap,radius=tank.def.breeder&&s._foodZoneLo>=20?Math.max(.65,.9*(s._breedScale||1)):Math.max(2.2,f.spec.cap*0.22);
    route=foodPath(s,f.fx+Math.cos(angle)*radius,f.fy+Math.sin(angle)*radius,fw,fh,solid);
    if(route){slot=j;break;}
   }
   if(!route)continue;
   f.reserved[s.id]=slot;s._meal={food:f,...route,deadline:now+120000,eat:0};s.state='seekFood';
  }
 }
}
function foodStep(s,dt,fw,fh,obstacles,sharedSolid){
 foodStats(s);const m=s._meal;if(!m)return false;
 if(s===heldSlug||['startle','climb','climbUp','climbDown'].includes(s.state)||m.deadline<Date.now()||m.food._gone||m.food.eaten.length>=m.food.spec.cap){delete m.food.reserved[s.id];s._meal=null;return false;}
 if(m.path.length){
  s.state='seekFood';const p=m.path[0],dx=p.x-s.fx,dy=p.y-s.fy,d=Math.hypot(dx,dy),v=SLUG_SPEED*2.5*dt;
  const nx=s.fx+dx/Math.max(d,0.001)*Math.min(d,v),ny=s.fy+dy/Math.max(d,0.001)*Math.min(d,v);
  const solid=sharedSolid||decorSolidSet(obstacles),rad=slugCm(s.genes)/CM_PER_CELL*.35*(s._breedScale||1);
  if(nx<(s._foodZoneLo||0)||nx>(s._foodZoneHi||fw)||[[nx,ny],[nx+rad,ny],[nx-rad,ny],[nx,ny+rad],[nx,ny-rad]].some(p=>solid.has(ptKey(...p)))){delete m.food.reserved[s.id];s._meal=null;s.state='rest';s.stt=3;s._mealCooldown=Date.now()+5000;return true;}
  s.fx=nx;s.fy=ny;s.dir=s.turn=Math.atan2(dy,dx);s.flip=dx>0;s.ph=(s.ph||0)+dt*1.8;
  if(d<=Math.max(v,0.12))m.path.shift();
 }else{
  s.state='eat';s.flip=m.food.fx>s.fx;s.ph=(s.ph||0)+dt*0.5;m.eat+=dt;
  if(m.eat>=4.5){applyFood(s,m.food);delete m.food.reserved[s.id];
   if(s._meal===m){s._meal=null;s.state='rest';s.stt=3;s._mealCooldown=Date.now()+8000;}} // กันค้าง eat ถ้าโควตาเต็มพอดี
 }
 return true;
}
/* ---- รอยแทะ ----
   อาหารที่ถูกกินไปแล้วต้อง "เห็นว่าโดนแทะ" ไม่ใช่จางลง
   แคชแคนวาสต่อ (ชิ้น + จำนวนคำที่หายไป) แล้วเจาะรูด้วย destination-out
   สุ่มด้วยซีดจาก f.id → รอยเดิมอยู่ที่เดิมทุกเฟรม และรอยเก่าไม่ขยับตอนมีรอยใหม่ */
const FOOD_BITE_CACHE=new Map(),FOOD_BITE_PX=256;
function foodSeed(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function foodRnd(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
/* จุดลงรอยแทะ: อยากได้ "ขอบของรูป" จริง ๆ แต่ถ้าเปิดเกมจาก file:// แคนวาสจะถูกมองว่า tainted
   getImageData จะโยน SecurityError → เก็บ null ไว้แล้วใช้แผนสำรอง (แนวแทะไล่ลง) แทน */
const FOOD_EDGE_CACHE=new Map();
function foodEdgePts(type,x,W,H){
 if(FOOD_EDGE_CACHE.has(type))return FOOD_EDGE_CACHE.get(type);
 let pts=null;
 try{
  const d=x.getImageData(0,0,W,H).data,A=(px,py)=>(px<0||py<0||px>=W||py>=H)?0:d[(py*W+px)*4+3];pts=[];
  for(let y=0;y<H;y+=3)for(let px=0;px<W;px+=3){
   if(A(px,y)<140)continue;
   if(A(px+7,y)<40||A(px-7,y)<40||A(px,y+7)<40||A(px,y-7)<40)pts.push([px,y]);
  }
  if(pts.length<8)pts=null;
 }catch(e){pts=null;}
 FOOD_EDGE_CACHE.set(type,pts);return pts;
}
function foodBitten(f,im){
 const n=f.eaten.length,key=(f.id||f.type)+'|'+n;
 const hit=FOOD_BITE_CACHE.get(key);if(hit)return hit;
 const W=FOOD_BITE_PX,H=Math.max(1,Math.round(W*im.naturalHeight/im.naturalWidth));
 const c=document.createElement('canvas');c.width=W;c.height=H;
 const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,W,H);
 if(n){
  const pts=foodEdgePts(f.type,x,W,H),rnd=foodRnd(foodSeed(f.id||f.type));
  x.globalCompositeOperation='destination-out';
  if(pts){                                   /* อ่านพิกเซลได้ = แทะเป็นหลุม ๆ ตามขอบรูป */
   const scale=Math.max(0.6,Math.sqrt(5/Math.max(1,f.spec.cap)));
   for(let i=0;i<n;i++){
    const r=Math.min(W,H)*(0.085+rnd()*0.05)*scale,u=rnd(),v=rnd(),q=pts[Math.floor(u*pts.length)];
    x.beginPath();x.arc(q[0],q[1],r,0,7);
    for(let k=0;k<3;k++){const b=(v+k*0.37+rnd()*0.5)*Math.PI*2,rr=r*(0.45+rnd()*0.4);
     const bx=q[0]+Math.cos(b)*r*0.75,by=q[1]+Math.sin(b)*r*0.75;x.moveTo(bx+rr,by);x.arc(bx,by,rr,0,7);}
    x.fill();
   }
  }else{                                     /* แผนสำรอง: แนวแทะหยัก ๆ ไล่จากยอดลงมา + แหว่งข้าง ๆ */
   const SEG=8,wave=[];for(let i=0;i<=SEG;i++)wave.push(rnd()*2-1);   // โปรไฟล์คลื่นคงที่ต่อชิ้น ไม่เปลี่ยนตามจำนวนคำ
   const frac=Math.min(1,n/Math.max(1,f.spec.cap)),top=-0.20*H+Math.pow(frac,0.6)*0.78*H;  // คำแรก ๆ ให้เห็นชัดหน่อย · คำสุดท้ายยังเหลือตอ
   const yAt=i=>top+wave[i]*H*0.07;
   x.beginPath();x.moveTo(-8,-8);x.lineTo(W+8,-8);x.lineTo(W+8,yAt(SEG));
   for(let i=SEG;i>0;i--){const x0=-8+(W+16)*i/SEG,x1=-8+(W+16)*(i-1)/SEG;
    x.quadraticCurveTo((x0+x1)/2,(yAt(i)+yAt(i-1))/2+wave[i]*H*0.09,x1,yAt(i-1));}
   x.lineTo(-8,-8);x.closePath();x.fill();
   for(let i=0;i<Math.min(n,6);i++){                                  // รอยแหว่งกลมที่ริมแนวแทะ
    const bx=(0.12+rnd()*0.76)*W,by=top+(rnd()*0.9-0.15)*H*0.14,r=H*(0.045+rnd()*0.045);
    x.beginPath();x.arc(bx,by,r,0,7);
    for(let k=0;k<2;k++){const b=rnd()*6.283;x.moveTo(bx+Math.cos(b)*r*0.7+r*0.6,by+Math.sin(b)*r*0.7);
     x.arc(bx+Math.cos(b)*r*0.7,by+Math.sin(b)*r*0.7,r*0.6,0,7);}
    x.fill();
   }
  }
 }
 FOOD_BITE_CACHE.set(key,c);
 if(FOOD_BITE_CACHE.size>24)for(const k of FOOD_BITE_CACHE.keys()){if(FOOD_BITE_CACHE.size<=16)break;if(k!==key)FOOD_BITE_CACHE.delete(k);}
 return c;
}
function drawFood(f){
 const p=S(f.fx,f.fy,SAND_CELLS),im=FOOD_IMAGES[f.type];
 const gone=f.spec.cap?f.eaten.length/f.spec.cap:0;                        // กินไปแล้ว = ชิ้นเล็กลงด้วย
 const w=depthPxPerCm()*Math.max(14,f.spec.cap*1.65)*(1-0.12*gone),h=w;
 f._hit=f.preview?null:{x:p.x-w/2,y:p.y-h*0.88,w,h};   // กล่องคลิก/ลากอาหาร
 tctx.save();tctx.globalAlpha=f.preview?0.55:1;
 if(im&&im.complete&&im.naturalWidth)tctx.drawImage(f.preview?im:foodBitten(f,im),p.x-w/2,p.y-h*0.88,w,h);
 tctx.textAlign='center';tctx.font='12px sans-serif';tctx.fillStyle='#fff3df';
 const spoiling=Date.now()-(f._placedAt||Date.now())>FOOD_SPOIL_MS*0.7;
 tctx.fillStyle=f.preview&&f.invalid?'#ff9d8a':'#fff3df';
 tctx.fillText(f.preview?(f.invalid?'วางตรงนี้ไม่ได้':'คลิกเพื่อวาง'):'Lv.'+f.level+' · '+(f.spec.cap-f.eaten.length)+' คำ'+(spoiling?' · เริ่มเน่า':''),p.x,p.y+14);tctx.restore();
}
function foodAt(mx,my){   // อาหารหน้าสุดที่คลิกโดน (ไว้ลากย้าย)
 let best=null;
 (curTank&&curTank.foods||[]).forEach(f=>{const b=f._hit;if(b&&mx>=b.x&&mx<=b.x+b.w&&my>=b.y&&my<=b.y+b.h){if(!best||f.fy>best.fy)best=f;}});
 return best;
}
/* เช็กอย่างเดียว ไม่หักเหรียญ — ใช้ทั้งตอนวางจริงและตอนวาดโกสต์ตามเมาส์ */
function foodCanPlace(type,level,fx,fy){
 const tank=curTank; if(!tank) return {ok:false,why:'ยังไม่ได้เข้าตู้'};
 const spec=FOOD_TYPES[type].levels[level-1],solid=decorSolidSet(tank.decor);
 if(fx<1||fy<1||fx>tank.def.w-1||fy>tank.def.h-1||solid.has(ptKey(fx,fy))) return {ok:false,why:'วางอาหารบนพื้นที่ว่างในตู้ครับ'};
 /* จำนวนอาหารสูงสุดต่อตู้ ไม่เท่ากันตามขนาด (foodMax ใน CATALOG) — ตู้เก่าที่ไม่มีค่านี้ใช้ 8 เหมือนเดิม */
 const foodMax=Number.isFinite(tank.def.foodMax)?tank.def.foodMax:8;
 if((tank.foods||[]).length>=foodMax) return {ok:false,why:'ตู้นี้วางอาหารพร้อมกันได้ไม่เกิน '+foodMax+' ชิ้น'};
 if(G.coin<spec.cost) return {ok:false,why:'เหรียญไม่พอ ('+spec.cost+')'};
 return {ok:true,why:''};
}
/* โกสต์ติดเมาส์ตอนเปิดโหมด — คืนวัตถุหน้าตาเหมือนอาหารจริงให้ drawFood วาดแบบจาง */
function foodGhostItem(){
 if(!foodMode||!foodChoice||!foodHover) return null;
 return {preview:true,invalid:!foodHover.ok,type:foodChoice.type,level:foodChoice.level,
         spec:FOOD_TYPES[foodChoice.type].levels[foodChoice.level-1],fx:foodHover.fx,fy:foodHover.fy,eaten:[],reserved:{}};
}
function foodPlace(type,level,fx,fy){
 const spec=FOOD_TYPES[type].levels[level-1],tank=curTank;
 const chk=foodCanPlace(type,level,fx,fy);
 if(!chk.ok){toast(chk.why,'bad');return false;}
 G.coin-=spec.cost;toast('วาง'+FOOD_TYPES[type].name+' −'+spec.cost,'good');if(typeof syncHUD==='function')syncHUD();
 (tank.foods||(tank.foods=[])).push({id:'food'+Date.now()+'-'+foodSeq++,type,level,spec,fx,fy,eaten:[],reserved:{}});return true;
}
function foodUI(){
 const bar=document.createElement('div');bar.id='foodBar';bar.style.cssText='position:relative;flex-shrink:0;padding:10px;background:rgba(20,44,48,.94);color:#fff0db;display:flex;gap:8px;align-items:center;flex-wrap:wrap';
 bar.innerHTML='<span>อาหาร</span><select id="foodType"></select><select id="foodLevel"></select><button id="foodChoose" class="tbtn">วางอาหาร</button><button id="foodCancel" class="tbtn">ยกเลิก</button><span id="foodInfo" style="font-size:12px"></span>';
 ov.insertBefore(bar,ov.querySelector('.ov-bottom'));const type=bar.querySelector('#foodType'),level=bar.querySelector('#foodLevel'),info=bar.querySelector('#foodInfo');
 for(const [k,v]of Object.entries(FOOD_TYPES)){const op=document.createElement('option');op.value=k;op.textContent=v.icon+' '+v.name;type.appendChild(op);const im=new Image();im.src='assets/food/'+k+'.png';FOOD_IMAGES[k]=im;}
 const preview=document.createElement('img');preview.style.cssText='width:48px;height:48px;object-fit:contain';bar.prepend(preview);
 const chooseBtn=bar.querySelector('#foodChoose'),cancelBtn=bar.querySelector('#foodCancel');
 function update(){const sp=FOOD_TYPES[type.value].levels[Number(level.value)-1];preview.src='assets/food/'+type.value+'.png';
  info.textContent=(foodMode?'คลิกพื้นที่ว่างในตู้เพื่อวาง · วางต่อได้เรื่อย ๆ · ลากอาหารเดิมเพื่อย้าย · Esc ปิดโหมด\n':'')
   +sp.cost+' เหรียญ · อิ่ม +'+sp.sat+' · '+sp.cap+' คำ · '+sp.h+' ชม. · '+foodDescription(sp);}
 const syncChoice=()=>{foodChoice=foodMode?{type:type.value,level:Number(level.value)}:null;};
 function levels(){level.innerHTML='';FOOD_TYPES[type.value].levels.forEach((sp,i)=>{const op=document.createElement('option');op.value=i+1;op.textContent='ระดับ '+(i+1);level.appendChild(op);});syncChoice();update();}
 /* เปิด/ปิดโหมดวางอาหาร — ปิดแล้วอาหารในตู้จะลากย้ายไม่ได้ (กันเผลอลากตอนดูทาก) */
 function foodModeSet(on){
  if(on&&curTank) enterExclusiveMode('food');            // เปิดวางอาหาร = ปิดจัดของ/แปรงขัดให้เอง
  foodMode=!!on&&!!curTank; syncChoice(); foodHover=null;
  chooseBtn.textContent=foodMode?'✓ ปิดโหมดวางอาหาร':'🌸 เปิดโหมดวางอาหาร';
  chooseBtn.setAttribute('aria-pressed',String(foodMode));
  cancelBtn.hidden=!foodMode;
  const sum=bar.closest('details')&&bar.closest('details').querySelector('summary');
  if(sum)sum.textContent=foodMode?'🌸 กำลังวางอาหาร':'🌸 ให้อาหาร';
  if(typeof tankCv!=='undefined')tankCv.style.cursor=foodMode?'crosshair':'';
  update();
 }
 window.foodModeSet=foodModeSet;
 registerMode('food','tank',()=>foodMode,()=>foodModeSet(false));
 type.onchange=levels;level.onchange=()=>{syncChoice();update();};levels();
 chooseBtn.onclick=()=>foodModeSet(!foodMode);
 cancelBtn.onclick=()=>foodModeSet(false);
 foodModeSet(false);
 let placingPointer=false;
 tankCv.addEventListener('pointerdown',e=>{
  if(!foodMode||!foodChoice||!curTank)return;
  const q=tankXY(e);
  if(typeof foodAt==='function'&&foodAt(q.mx,q.my))return;      // กดโดนอาหารเดิม = ปล่อยให้ tank-view ลากย้าย
  placingPointer=true;e.preventDefault();e.stopImmediatePropagation();
  const p=tankFloorAt(q.mx,q.my);
  foodPlace(foodChoice.type,foodChoice.level,p.fx,p.fy);        // วางเสร็จยังอยู่ในโหมด วางต่อได้เลย
 },true);
 tankCv.addEventListener('pointerup',e=>{if(placingPointer){placingPointer=false;e.preventDefault();e.stopImmediatePropagation();}},true);
 tankCv.addEventListener('pointermove',e=>{
  if(!foodMode||!foodChoice||!curTank){foodHover=null;return;}
  const q=tankXY(e),p=tankFloorAt(q.mx,q.my),chk=foodCanPlace(foodChoice.type,foodChoice.level,p.fx,p.fy);
  foodHover={fx:p.fx,fy:p.fy,ok:chk.ok,why:chk.why};
 },true);
 tankCv.addEventListener('pointerleave',()=>{foodHover=null;});
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&foodMode){e.preventDefault();e.stopPropagation();foodModeSet(false);}},true);
}
/* ความหิว: ความอิ่มค่อย ๆ ลดตามเวลาจริง — อิ่มเต็ม 100 → 0 ใน ~5 ชม. */
const FOOD_DECAY_PER_SEC=100/(5*3600);
function foodDecay(slugs,dt){
 for(const s of slugs){foodStats(s);s.satiety=foodClamp(s.satiety-FOOD_DECAY_PER_SEC*dt,0,100);}
}
if(typeof document!=='undefined')foodUI();
