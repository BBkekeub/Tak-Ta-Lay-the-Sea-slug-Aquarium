/* hatchMin/hatchMax = โอกาสฟักต่อไข่ 1 ฟอง ไล่ตามค่าความสมบูรณ์ (vigor) เฉลี่ยของพ่อแม่
   0 → 7% · 100 → 18% · โอกาสฟักอยู่ในช่วงนี้เสมอ
   พิตี้: ต่อการวางไข่ 1 ครอก การันตีอย่างน้อย 1 ตัว (ดู hatchBreedingEgg) */
const BREEDING={mate:60,egg:60,grow:60,adultCap:12,larvaCap:50,hatchMin:.07,hatchMax:.18};
/* โอกาสฟักจริงต่อฟองตามความสมบูรณ์ — ใช้ทั้งตอนฟักและตอนโชว์ใน UI */
function breedingHatchChance(o,b){
 const base=Number.isFinite(b.hatchChance)?b.hatchChance:(b.eggs&&b.eggs[0]&&Number.isFinite(b.eggs[0].baseChance)?b.eggs[0].baseChance:BREEDING.hatchMin);
 return Math.max(BREEDING.hatchMin,Math.min(BREEDING.hatchMax,base));
}
const isBreeder=o=>!!o?.def?.breeder;
function breederState(o){return o.breeding||(o.breeding={parents:[],eggs:[],larvae:[],phase:'idle',left:0,lab:BreedingGenes.newLab(),clean:100});}
function breederReserved(o){const b=isBreeder(o)?breederState(o):null;return b?b.parents.filter(s=>!o.slugs.includes(s)).length:0;}
function breederAdultSpace(o){return o.slugs.length+breederReserved(o)<tankCap(o.def);}
function startBreeding(o,ids){
 if(!isBreeder(o))return false;const b=breederState(o);
 const parents=[...new Set(ids)].map(id=>o.slugs.find(s=>s.id===id));
 if(b.phase!=='idle'||parents.length!==2||parents.some(s=>!s)){toast('เลือกทากว่าง 2 ตัวในตู้นี้','bad');return false;}
 if(parents.some(s=>(s.breedLife??50)<5)){toast('พลังผสมพันธุ์ไม่พอ','bad');return false;}
 if(b.larvae.length>=50){toast('พื้นที่ตัวอ่อนเต็ม','bad');return false;}
 /* ทากที่มีลูกค้าเสนอซื้อค้างอยู่ เอามาผสมได้แล้ว — แต่ต้องสละข้อเสนอนั้นไป
    (ตัวมันย้ายเข้าโซนผสม ลูกค้าที่รออยู่หน้าเคาน์เตอร์ซื้อไม่ได้แล้ว) */
 if(typeof releaseSlugOffers==='function')releaseSlugOffers(parents,'เอาทากไปผสมพันธุ์');
 b.parentSatiety=parents.reduce((n,s)=>n+(s.satiety??50),0)/2;
 b.parents=parents;b.parentGenes=parents.map(s=>BreedingGenes.copyGene(s.genes));
 b.strength=parents.reduce((n,s)=>n+Math.min(100,foodGenes(s).vigor+25),0)/2;
 for(const s of parents){s.breedLife=(s.breedLife??50)-5;s.wall=null;s.climbZ=0;}
 parents.forEach(s=>{s.breedZone=true;});b.phase='mating';b.left=BREEDING.mate;b.eggs=[];
 if(parents.includes(selSlug))selSlug=null;saveGame();syncHUD();renderBreederUI();return true;
}
function hatchBreedingEgg(o,index){
 if(!isBreeder(o))return false;const b=breederState(o),egg=b.eggs[index];
 if(b.phase!=='hatching'||!egg||egg.open)return false;
 if(egg.alive&&b.larvae.length>=50){toast('ตัวอ่อนเต็ม รอพื้นที่ว่างก่อนฟัก','bad');return false;}
 if(egg.hatchRoll!==undefined){
  egg.alive=egg.hatchRoll<breedingHatchChance(o,b);
 }
  /* พิตี้เรท — ครอกหนึ่งต้องได้อย่างน้อย 1 ตัว
     ถ้านี่คือฟองสุดท้ายที่ยังไม่เปิด และทั้งครอกยังไม่มีตัวไหนรอด ให้ฟองนี้รอดแน่นอน
     (ผสมจนจบแล้วไม่ได้อะไรเลยมันใจร้ายเกินไป) */
  if(!egg.alive&&!b.eggs.some(e=>e.open&&e.alive)&&b.eggs.filter(e=>!e.open).length<=1){egg.alive=true;egg.pity=true;}
 if(egg.alive&&b.larvae.length>=50){toast('พื้นที่ตัวอ่อนเต็ม','bad');return false;}
 egg.open=true;
 if(egg.alive){const genes=BreedingGenes.breed(...b.parentGenes,b.lab,egg.seed).child;const slug=makeSlug(genes);slug.breedLife=50;slug.satiety=100;b.larvae.push({slug,left:BREEDING.grow,survives:egg.grow,growthRoll:egg.growthRoll,ready:false});}
 if(b.eggs.every(e=>e.open)){b.phase='idle';b.eggs=[];b.parentGenes=null;}
 saveGame();syncHUD();renderBreederUI();return true;
}
function tickBreeder(o,dt,rnd=Math.random){
 const b=breederState(o);b.clean=tankCleanliness(o);
 const feedingSlugs=prepareBreederFoodSlugs(o);foodPrepare(feedingSlugs,o.def.w,o.def.h,o.decor||[],null,o);
 if(b.phase==='mating'||b.phase==='eggs'){
  b.left=Math.max(0,b.left-dt);
  if(b.left===0&&b.phase==='mating'){
   b.parentSatiety=b.parents.reduce((n,s)=>n+(s.satiety??50),0)/Math.max(1,b.parents.length);b.phase='eggs';b.left=BREEDING.egg;let dead=0;const n=Math.round(5+b.strength/100*10);
   /* โอกาสฟัก 7–18% ไล่ตามความสมบูรณ์เฉลี่ยของพ่อแม่ (ค่าปัจจุบันรวมบัฟอาหาร) */
   const vig=b.parents.length?b.parents.reduce((n,s)=>n+Math.max(0,Math.min(100,foodGenes(s).vigor)),0)/b.parents.length:50;
   const chance=BREEDING.hatchMin+(vig/100)*(BREEDING.hatchMax-BREEDING.hatchMin);b.hatchChance=chance;b.hatchVigor=Math.round(vig);
   b.eggs=Array.from({length:n},(_,i)=>({alive:false,open:false,hatchRoll:rnd(),baseChance:chance,last:i===n-1,seed:(rnd()*4294967296)>>>0,growthRoll:rnd()}));
   for(const parent of b.parents){parent.breedZone=true;if(!o.slugs.includes(parent))o.slugs.push(parent);}b.parents=[];
  }else if(b.left===0&&b.phase==='eggs')b.phase='hatching';
 }
 let grownTank=0,grownInv=0,died=0;   // นับไว้สรุปลงบันทึกร้านทีเดียวท้ายรอบ (ดูท้ายฟังก์ชัน)
 for(let i=b.larvae.length-1;i>=0;i--){const larva=b.larvae[i];walkBreedingZone(larva.slug,dt);larva.left=Math.max(0,larva.left-dt);
  if(larva.left>0)continue;
  if(!larva.ready&&larva.growthRoll!==undefined)larva.survives=larva.growthRoll<.7*breedingSatietyFactor(larva.slug.satiety)*breedingCleanFactor(o);
  if(!larva.survives){if(typeof onBreedLarvaDeath==='function')onBreedLarvaDeath(o,larva);b.larvae.splice(i,1);died++;continue;}
  const newlyReady=!larva.ready;larva.ready=true;
  if(breederAdultSpace(o)){placeOnFloor(larva.slug,o);o.slugs.push(larva.slug);b.larvae.splice(i,1);grownTank++;}
  /* ⚠️ 2026-09-20 ผู้เล่น: "ทากที่เกินมาตอนมันโต ต้องเข้าไปอยู่ในคลังนะ"
     เดิมถ้าตู้เต็ม (breederAdultSpace เป็นเท็จ) ตัวอ่อนที่โตแล้วจะ "ค้างอยู่ใน b.larvae ตลอดไป"
     คือโตเต็มวัยแล้วแต่ติดอยู่ในโซนตัวอ่อน ไม่ได้เข้าตู้ ไม่ได้เข้าคลัง และไม่มีทางออก
     ตอนนี้ตู้เต็มเมื่อไหร่ให้ย้ายเข้าคลังทากแทน (เส้นทางเดียวกับปุ่ม "เก็บทากกลับคลัง")
     ⚠️ ต้องล้างธงของโซนเพาะให้หมดก่อนส่งออก ไม่งั้นตัวจะติดขนาดครึ่งเดียว (_breedScale)
        และยังจองอาหารในโซนค้างไว้ (_meal) ทั้งที่ไม่ได้อยู่ในตู้นี้แล้ว */
  else if(Array.isArray(G.inv)){
    const s=larva.slug;
    if(s._meal&&s._meal.food&&s._meal.food.reserved)delete s._meal.food.reserved[s.id];
    s._meal=null;s._breedVisual=false;s._breedScale=1;s.breedZone=false;
    s._zoneTank=null;s._foodZoneLo=undefined;s._foodZoneHi=undefined;
    s.wall=null;s.climbSide=null;s.climbZ=0;s.state='rest';s.stt=1;
    b.larvae.splice(i,1);G.inv.push(s);
    grownInv++;
    if(typeof syncHUD==='function')syncHUD();
    if(typeof saveGame==='function')saveGame();
  }
  if(newlyReady&&window.NewSlugNotices)NewSlugNotices.add(larva.slug,'grown');
 }
 /* ⚠️ 2026-09-20 ผู้เล่น: "log ของร้านไม่เห็นมีบอกเลยว่าทากที่โตแล้ว รอดหรือไม่รอด"
    เดิมบันทึกแค่ วางไข่ · พร้อมฟัก · ฟักครบรอบ · รอพื้นที่ (breed-news.js)
    ส่วน "ตัวอ่อนรอด/ไม่รอดตอนโต" ไม่เคยถูกบันทึกเลย — ตายก็แค่หายไปเงียบ ๆ
    ⚠️ สรุปรวมเป็นรายการเดียวต่อตู้ต่อรอบ ไม่ใช่ตัวละรายการ
       เพราะตัวอ่อนโตพร้อมกันได้ถึง 50 ตัว แต่บันทึกเก็บแค่ 20 ฉบับ (COMPUTER_LOG_MAX)
       ถ้าเขียนทีละตัวจะดันบันทึกเก่าหายหมดในรอบเดียว */
 if(grownTank||grownInv||died){
  const parts=[];
  if(grownTank)parts.push('โตแล้วเข้าตู้ '+grownTank+' ตัว');
  if(grownInv)parts.push('ตู้เต็ม ย้ายเข้าคลัง '+grownInv+' ตัว');
  if(died)parts.push('ไม่รอด '+died+' ตัว');
  const survived=grownTank+grownInv;
  const name=(typeof BreedNews!=='undefined'&&BreedNews.tankName)?BreedNews.tankName(o):((o.def&&o.def.name)||'ตู้เพาะพันธุ์');
  const icon=survived?(died?'⚖️':'🦋'):'💀';
  const title=survived?(died?'ตัวอ่อนโตแล้ว (มีไม่รอดด้วย)':'ตัวอ่อนโตเต็มวัย'):'ตัวอ่อนไม่รอด';
  if(typeof BreedNews!=='undefined'&&BreedNews.announce)
   BreedNews.announce(icon,title,name+' · '+parts.join(' · '),{kind:survived?'good':'bad',tag:'grown-'+o.id+'-'+Date.now()});
  else if(typeof toast==='function')toast(icon+' '+parts.join(' · '),survived?'good':'bad');
 }
}
function breederVisualSlugs(o){
 if(!isBreeder(o))return [];const b=breederState(o),out=[];
 b.parents.forEach(s=>{if(!o.slugs.includes(s)){s.breedZone=true;o.slugs.push(s);}});
 b.larvae.forEach((l,i)=>{const s=l.slug;if(!Number.isFinite(s.fx)||s.fx<25||s.fx>=30){s.fx=25.5+i%5;s.fy=.5+Math.floor(i/5);}s._breedVisual=true;s._breedScale=.5;out.push(s);});return out;
}
/* ⚠️ 2026-09-18 สายไข่เคยวาดรวมอยู่ในนี้ ซึ่งถูกเรียกหลัง DecorGLB.splitTankBackground()
   = วาดบนแคนวาสชั้นหน้า ซึ่งอยู่ "เหนือ" ทาก 3D → สายไข่ทับตัวทากในโซนผสม (ผู้เล่นทัก)
   ตอนนี้แยกเป็น drawBreederEggs() ที่ tank-view เรียกก่อนแยกชั้น (อยู่ใต้ตัวทาก แบบเชือกชักเย่อ)
   ส่วนนี้เหลือแต่ผนังกั้นกับป้ายนับตัว ซึ่งเป็น UI ควรอยู่ชั้นบนสุดตามเดิม */
function drawBreederInterior(o){
 if(!isBreeder(o))return;const b=breederState(o),sandT=SAND_CELLS;
 for(const x of [20,25]){const q=[[x,0,sandT],[x,10,sandT],[x,10,wallCells()*.9],[x,0,wallCells()*.9]].map(v=>S(...v));tctx.beginPath();q.forEach((p,i)=>i?tctx.lineTo(p.x,p.y):tctx.moveTo(p.x,p.y));tctx.closePath();tctx.fillStyle='rgba(180,224,230,.15)';tctx.fill();tctx.strokeStyle='rgba(210,244,250,.7)';tctx.stroke();}

 // Fixed-size badge at the back of the breeding compartment, above the cord.
 const occupants=new Set([...o.slugs.filter(s=>s.breedZone),...b.parents].map(s=>s.id)).size;
 const badge=S(22.5,.55,sandT+.2),label=occupants+'/2';
 tctx.save();tctx.font='600 13px sans-serif';tctx.textAlign='center';tctx.textBaseline='middle';
 tctx.fillStyle='rgba(13,32,35,.86)';tctx.strokeStyle=occupants===2?'#d9be77':'rgba(200,221,217,.6)';tctx.lineWidth=1;
 tctx.beginPath();tctx.roundRect(badge.x-23,badge.y-13,46,26,8);tctx.fill();tctx.stroke();
 tctx.fillStyle=occupants===2?'#ffe2a0':'#ecf3ed';tctx.fillText(label,badge.x,badge.y);tctx.restore();
}
/* สายไข่ต่อเนื่อง: แต่ละฟองใช้ปลายร่วมกับฟองข้าง ๆ · ไข่เม็ดเล็กอยู่ในสาย
   วาดในชั้นพื้นหลัง (ก่อน splitTankBackground) จึงอยู่ใต้ตัวทากเสมอ */
function drawBreederEggs(o){
 if(!isBreeder(o))return;const b=breederState(o),sandT=SAND_CELLS;
 const count=b.eggs.length;if(!count)return;
 const scale=depthPxPerCm(22.5,5),width=Math.max(1.8,scale*.45);
 const point=t=>{const a=t*Math.PI*2;return S(22.5+1.15*Math.sin(a*6)+.34*Math.sin(a*29+.3),2+6*t+.35*Math.cos(a*6)+.14*Math.sin(a*23),sandT+.025);};
 tctx.save();tctx.lineCap='round';tctx.lineJoin='round';
 b.eggs.forEach((egg,i)=>{
  if(egg.open){egg._hit=null;return;} const pts=Array.from({length:41},(_,j)=>point((i+j/40)/count));
  egg._hit={points:pts,r:Math.max(10,width*2)};
  const path=()=>{tctx.beginPath();pts.forEach((p,j)=>j?tctx.lineTo(p.x,p.y):tctx.moveTo(p.x,p.y));};
  const ready=b.phase==='hatching';tctx.globalAlpha=1;
  if(ready){path();tctx.strokeStyle='rgba(255,157,35,.12)';tctx.lineWidth=width+14;tctx.stroke();path();tctx.strokeStyle='rgba(255,179,46,.25)';tctx.lineWidth=width+7;tctx.stroke();}
  path();tctx.strokeStyle='rgba(87,83,64,.22)';tctx.lineWidth=width+2;tctx.stroke();
  path();tctx.strokeStyle=ready?'rgba(255,166,40,.8)':'rgba(247,243,219,.55)';tctx.lineWidth=width*1.7;tctx.stroke();
  path();tctx.strokeStyle=ready?'#ffad32':'#dedbc8';tctx.lineWidth=width;tctx.stroke();
  path();tctx.strokeStyle=ready?'#ffe8a3':'rgba(255,255,242,.65)';tctx.lineWidth=Math.max(.6,width*.24);tctx.stroke();
  if(!egg.open)for(let j=2;j<pts.length-1;j+=3){const p=pts[j];tctx.beginPath();tctx.ellipse(p.x,p.y,Math.max(.55,width*.22),Math.max(.4,width*.16),0,0,Math.PI*2);tctx.fillStyle=ready?(j%2?'#fff0b0':'#dd791b'):(j%2?'#fffbed':'#bfbba2');tctx.fill();}
 });tctx.restore();
}
function hatchAllBreeder(o){
 const b=breederState(o);if(b.phase!=='hatching'||b.autoHatch)return;
 b.autoHatch=true;
 const next=()=>{if(!G.objs.includes(o)||b.phase!=='hatching'){b.autoHatch=false;return;}const i=b.eggs.findIndex(e=>!e.open);if(i<0||!hatchBreedingEgg(o,i)){b.autoHatch=false;return;}setTimeout(next,350);};next();
}
function drawBreederPartitions(o,MAP,standH,tz){
 if(!isBreeder(o))return;
 for(const x of [20,25]){const q=[[x,0,standH],[x,10,standH],[x,10,tz],[x,0,tz]].map(([a,b,z])=>{const m=MAP(a,b);return P(o.cx+m[0],o.cy+m[1],z);});ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='rgba(180,224,230,.12)';ctx.fill();ctx.strokeStyle='rgba(204,239,244,.55)';ctx.stroke();}
}
function saveBreeder(o){const b=breederState(o);return {...b,parents:b.parents.map(_saveSlug),eggs:b.eggs.map(({_hit,...e})=>e),larvae:b.larvae.map(l=>({...l,slug:_saveSlug(l.slug)}))};}
function loadBreeder(raw){if(!raw)return null;return {...raw,autoHatch:false,parents:(raw.parents||[]).map(_loadSlug),eggs:raw.eggs||[],larvae:(raw.larvae||[]).map(l=>({...l,slug:_loadSlug(l.slug)})),lab:raw.lab||BreedingGenes.newLab(),clean:raw.clean??100};}
let breederChosen=new Set(),breederPanelKey='',breederPanelTank=null;
const breederPanel=document.createElement('div');breederPanel.id='breederPanel';breederPanel.hidden=true;breederPanel.style.cssText='padding:10px 14px;background:#141c20;border-top:1px solid #50605f;color:#e6dfcd;max-height:180px;overflow:auto;font-size:13px';document.querySelector('.ov-bottom').before(breederPanel);
function renderBreederUI(){
 if(!tankMode||!isBreeder(curTank)){breederPanel.hidden=true;breederPanelKey='';return;}
 const o=curTank,b=breederState(o);if(breederPanelTank!==o){breederChosen.clear();breederPanelTank=o;}
 breederChosen=new Set([...breederChosen].filter(id=>o.slugs.some(s=>s.id===id)));
 const key=[o.id,b.phase,Math.ceil(b.left),Math.round(breedingHatchChance(o,b)*100),o.slugs.map(s=>s.id+':'+(s.breedLife??50)).join(),b.larvae.length,b.larvae.filter(l=>l.ready).length,b.eggs.map(e=>+e.open).join(),[...breederChosen].join()].join('|');breederPanel.hidden=false;if(key===breederPanelKey)return;breederPanelKey=key;
 const state=b.phase==='idle'?'พร้อมผสม':b.phase==='mating'?'กำลังผสม '+Math.ceil(b.left)+' วิ':b.phase==='eggs'?'รอฟัก '+Math.ceil(b.left)+' วิ':'กดไข่ทีละฟองเพื่อฟัก';
 const oddsText=(b.phase==='eggs'||b.phase==='hatching')&&b.eggs.length?'　|　โอกาสฟัก '+Math.round(breedingHatchChance(o,b)*100)+'% ต่อฟอง'+(Number.isFinite(b.hatchVigor)?' (ความสมบูรณ์ '+b.hatchVigor+')':'')+' · การันตีอย่างน้อย 1 ตัวต่อครอก':'';
 breederPanel.innerHTML='<div style="margin-bottom:8px">เลี้ยงทั่วไป 100×50 ซม. · '+o.slugs.length+'/12 ตัว　|　ผสม 25×50 ซม. · '+state+'　|　ตัวอ่อน 25×50 ซม. · '+b.larvae.length+'/50 ตัว'+(b.larvae.some(l=>l.ready)?' · รอพื้นที่โซนตัวโต':'')+oddsText+'</div><div style="display:flex;gap:8px;flex-wrap:wrap">'+'<button class="tbtn" id="startBreeder" '+(b.phase!=='idle'?'disabled':'')+'>เลือกทากมาผสมพันธุ์</button></div>'+(b.phase==='hatching'?'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px"><button class="tbtn" id="hatchAllBreeder">ฟักทั้งหมด</button>'+'</div>':'');
 breederPanel.querySelectorAll('[data-parent]').forEach(el=>el.onchange=()=>{if(el.checked&&breederChosen.size<2)breederChosen.add(el.dataset.parent);else breederChosen.delete(el.dataset.parent);breederPanelKey='';renderBreederUI();});
 if(breederPanel.querySelector('#hatchAllBreeder'))breederPanel.querySelector('#hatchAllBreeder').onclick=()=>hatchAllBreeder(o);
 breederPanel.querySelector('#startBreeder').onclick=()=>openBreedingPicker(o);breederPanel.querySelectorAll('[data-egg]').forEach(el=>el.onclick=()=>hatchBreedingEgg(o,+el.dataset.egg));
}
document.getElementById('tankCv').addEventListener('pointerdown',e=>{if(!tankMode||!isBreeder(curTank))return;const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const b=breederState(curTank),i=b.eggs.findIndex(egg=>!egg.open&&egg._hit&&egg._hit.points?.some(p=>Math.hypot(x-p.x,y-p.y)<egg._hit.r));if(i>=0&&b.phase==='hatching'){e.stopImmediatePropagation();e.preventDefault();hatchBreedingEgg(curTank,i);}},true);
let breedingLast=performance.now();setInterval(()=>{const now=performance.now(),dt=Math.min(1,(now-breedingLast)/1000);breedingLast=now;if(typeof tankCleanliness!=='function')return;for(const o of [...G.objs,...G.shelter])if(isBreeder(o))tickBreeder(o,dt);renderBreederUI();},250);

function walkBreedingZone(s,dt){
 if(s===heldSlug)return;
 if(typeof foodDecay==='function')foodDecay([s],dt);
 const margin=Math.min(1.15,slugCm(s.genes)/CM_PER_CELL*.55*(s._breedScale||1)+.2),lo=(s._foodZoneLo??20)+margin,hi=(s._foodZoneHi??25)-margin;
 s.wall=null;s.climbZ=0;s.fx=Math.max(lo,Math.min(hi,Number.isFinite(s.fx)?s.fx:22.5));s.fy=Math.max(margin,Math.min(10-margin,Number.isFinite(s.fy)?s.fy:5));
 const solid=decorSolidSet(s._zoneTank?.decor||[]),oldX=s.fx,oldY=s.fy;
 if(foodStep(s,dt,s._foodZoneHi||25,10,s._zoneTank?.decor||[],solid)){s.fx=Math.max(lo,Math.min(hi,s.fx));s.fy=Math.max(margin,Math.min(10-margin,s.fy));return;}
 s._zoneUnstick=Math.max(0,(s._zoneUnstick||0)-dt);   // คูลดาวน์ของการดันออกจากหิน (ดูท้ายฟังก์ชัน)
 /* จุดตั้งต้นของเฟรม — slugFaceAndCreep() ท้ายฟังก์ชันใช้หา "ที่ขยับจริง" เพื่อตั้งหน้าและจังหวะคืบ
    ลูปตู้ปกติตั้งค่านี้ให้เอง แต่ทากโซนผสม/ตัวอ่อนไม่ได้ผ่านลูปนั้น ต้องตั้งเอง */
 s._frameX0=s.fx;s._frameY0=s.fy;
 s.stt=(s.stt||0)-dt;if(s.stt<=0){s.state=s.state==='walk'?'rest':'walk';s.stt=1+Math.random()*4;s.turn=Math.random()*Math.PI*2;}
 /* ⚠️ 2026-09-20 ผู้เล่น: "ตัวในโซนผสมพันธุ์ก็เดินแปลก ๆ แถมตัวเล็ก ๆ ก็เดินเหมือนกระตุก"
    ลูปโซนเพาะเขียนแยกจากลูปตู้ปกติ แล้วใช้คนละสูตรกันหมดทั้ง 3 จุด:
      1) ความเร็วเป็นค่าคงที่ .32 ช่อง/วิ ไม่สนขนาด/พลัง/ความหิว
         ตัวจริงในตู้เดิน SLUG_SPEED×slugPace() = 0.112–0.218 ช่อง/วิ
         → ในโซนเร็วกว่าตัวเอง 1.5 เท่า (ตัวเล็ก) ถึง 2.9 เท่า (ตัวใหญ่)
         ตัวอ่อนยิ่งเห็นชัด เพราะย่อขนาดครึ่งหนึ่ง (_breedScale .5) แต่ความเร็วเท่าตัวเต็มวัย
      2) หันหัวแบบสแนป — สุ่มทิศแล้วเซ็ต s.dir ทันที · เด้งขอบด้วย dir=π−dir ทันที
         ลูปตู้ปกติค่อย ๆ เลี้ยวด้วย SLUG_TURN และเร่ง EDGE_TURN_BOOST ตอนใกล้ขอบ
      3) จังหวะขยับตัว s.ph เดินคงที่ dt*2 ไม่ผูกกับสถานะ/พลังเหมือนลูปตู้
    โซนกว้างจริงแค่ ~2.7–3.3 ช่อง (5 ช่องลบระยะขอบสองฝั่ง) ของเร็ว + เด้งทันที
    เลยชนขอบถี่มากจนดูสั่น — ปรับทั้งสามจุดให้ใช้สูตรเดียวกับลูปตู้ปกติ */
 const pace=typeof slugPace==='function'?slugPace(s):1;
 const boost=typeof EDGE_TURN_BOOST==='number'?EDGE_TURN_BOOST:2.5;
 const edge=s.fx<lo+.45||s.fx>hi-.45||s.fy<margin+.45||s.fy>10-margin-.45;
 if(edge)s.turn=Math.atan2(5-s.fy,(lo+hi)/2-s.fx);   // ใกล้ขอบ = เล็งกลับเข้ากลางโซน แล้วค่อย ๆ เลี้ยว ไม่เด้งทันที
 if(!Number.isFinite(s.turn))s.turn=s.dir||0;
 if(!Number.isFinite(s.dir))s.dir=s.turn;
 const dd=((s.turn-s.dir+Math.PI*3)%(Math.PI*2))-Math.PI;
 s.dir+=dd*Math.min(1,dt*SLUG_TURN*(edge?boost:1));
 if(s.state==='walk'){const v=SLUG_SPEED*pace*dt;s.fx+=Math.cos(s.dir)*v;s.fy+=Math.sin(s.dir)*v;}
 s.ph=(s.ph||0)+dt*(0.8+((s.traits&&s.traits.energy)||0.5)*0.5)*(s.state==='walk'?1.45:0.62);
 s.fx=Math.max(lo,Math.min(hi,s.fx));s.fy=Math.max(margin,Math.min(10-margin,s.fy));
 /* ⚠️ 2026-09-20 ผู้เล่น: "ทากเดินติดบัคแล้วเดินเข้าออกรัวๆ"
    ของเดิมบรรทัดเดียว: ตัวทากทับหิน → ถอยกลับจุดเดิม + หันกลับหลัง (dir += π)
    ถูกเฉพาะกรณี "ก้าวนี้เพิ่งเดินชนหิน" เท่านั้น
    แต่ถ้า "จุดเดิมก็จมอยู่ในหินอยู่แล้ว" (ผู้เล่นวางหินทับตัว · โดนหนีบตอนคลampเข้าโซน ·
    ย้ายเข้าโซนแล้วตกลงบนหิน) การถอยกลับจะคืนไปที่จุดที่จมเหมือนเดิม เงื่อนไขจึงเป็นจริงทุกเฟรม
    → หันกลับหลัง 180° ทุกเฟรม ขยับ 0.000 หน่วย ไม่มีวันหลุด = สั่นเข้า-ออกรัว ๆ ค้างถาวร
    วัดได้: 600 เฟรม = กลับทิศ 600 ครั้ง ระยะที่ขยับรวม 0.000
    ⚠️ ฝั่งตู้ปกติมี nudgeSlugsOutOfSolid() คอยดันออกให้ แต่โซนเพาะพันธุ์เดินคนละลูป ไม่มีใครดันให้เลย
    แก้: แยกสองกรณี — ชนสด = ถอย+หันหนีเหมือนเดิม · จมอยู่แล้ว = ดันออกไปจุดว่างใกล้สุด */
 const bodyHits=(x,y)=>[[x,y],[x+margin*.6,y],[x-margin*.6,y],[x,y+margin*.6],[x,y-margin*.6]].some(p=>solid.has(ptKey(...p)));
 const centreHits=(x,y)=>solid.has(ptKey(x,y));
 if(bodyHits(s.fx,s.fy)){
  if(!bodyHits(oldX,oldY)){                       // ก้าวนี้เพิ่งเดินชน → ถอยกลับแล้วหันหนี
   /* ⚠️ เดิมสแนป s.dir += π ทันที — โซนตัวอ่อนกว้างแค่ ~3 ช่องและมีหินอยู่
      ตัวอ่อนจึงชนหินก้อนเดิมซ้ำ ๆ แล้วพลิกหลัง 180° ในเฟรมเดียว ~2 ครั้ง/วินาที
      (วัดได้: หันแรงสุด 3.14 rad/เฟรม · 135–175 ครั้งต่อ 90 วินาที) = อาการ "เดินกระตุก"
      ตั้งเป็นเป้าหมาย (turn) แล้วให้ค่อย ๆ เลี้ยวเหมือนทิศอื่น ๆ ในฟังก์ชันนี้
      ระหว่างเลี้ยวตัวจะถูกกันไว้ที่จุดเดิม = ดูเหมือนชะงักแล้วค่อยหันหนี ซึ่งเป็นธรรมชาติกว่า */
   s.fx=oldX;s.fy=oldY;s.turn=(s.dir||0)+Math.PI;
  }else if((s._zoneUnstick||0)<=0){               // จมอยู่ในหินตั้งแต่ต้น → ต้องดันออก ไม่ใช่กลับทิศ
   /* ⚠️ ต้องมีคูลดาวน์ ไม่งั้นดันซ้ำทุกเฟรม — รอบสองของ breedZoneFreeSpot เช็กแค่จุดกึ่งกลาง
      จุดที่ได้จึงยัง "ตัวล้ำหิน" อยู่ (bodyHits ยังจริง) เงื่อนไขนี้เลยเป็นจริงอีกในเฟรมถัดไป
      แล้ววาร์ปใหม่ไม่รู้จบ = ตัวอ่อนกระตุกเป็นชุด (วัดได้: ขยับสะสม 30+ หน่วยทั้งที่ state='rest')
      ดันทีเดียวแล้วปล่อยให้เดินเองสักพัก ถ้ายังจมจริงค่อยดันใหม่รอบหน้า */
   const free=breedZoneFreeSpot(s,bodyHits,centreHits,lo,hi,margin);
   if(free){s.fx=free.x;s.fy=free.y;}
   s._zoneUnstick=1.2;
   s.state='rest';s.stt=.5+Math.random()*.5;      // พักแป๊บ ไม่ให้เดินย้อนเข้าไปทันที
  }
 }
 /* หันหน้า + จังหวะคืบ ใช้ฟังก์ชันเดียวกับลูปตู้ปกติ (tank-view.js) — กันมูนวอล์คและก้าวไม่ตรงตัว */
 if(typeof slugFaceAndCreep==='function')slugFaceAndCreep(s,dt);
 s._lastGoodFx=s.fx;s._lastGoodFy=s.fy;
}
/* จุดว่างใกล้ตัวที่สุดในโซนเพาะพันธุ์ — เรียกเฉพาะตอนทากจมอยู่ในหินจริง ๆ ไม่ใช่ทุกเฟรม
   ไล่รัศมีทีละครึ่งช่อง รอบละ 12 ทิศ
   ⚠️ ต้องมีรอบสอง "เช็กแค่จุดกึ่งกลาง" ด้วย — โซนเพาะกว้างจริงแค่ ~2.7 ช่อง
      ตัวใหญ่ (margin 1.15) ในโซนที่มีหิน 3-4 ก้อน อาจไม่มีจุดไหนเลยที่ "ทั้งตัว" ไม่โดนหิน
      วัดแล้ว: เช็กทั้งตัวเหลือที่ว่าง 0 จุด แต่เช็กแค่จุดกลางเหลือ 67 จุด
      ถ้ามีแต่รอบแรก ทากจะค้างจมอยู่ในหินถาวร (ไม่สั่นแล้ว แต่ก็ยังไม่หลุด)
      รอบสองยอมให้ตัวล้ำหินได้นิดหน่อย แต่ได้ออกมายืนในที่ที่เดินต่อได้จริง */
function breedZoneFreeSpot(s,bodyHits,centreHits,lo,hi,margin){
 if(!(hi>lo))return null;
 for(const blocked of [bodyHits,centreHits])
  for(let r=.5;r<=6;r+=.5)for(let i=0;i<12;i++){
   const a=i*Math.PI/6;
   const x=Math.max(lo,Math.min(hi,s.fx+Math.cos(a)*r));
   const y=Math.max(margin,Math.min(10-margin,s.fy+Math.sin(a)*r));
   if(!blocked(x,y))return {x,y};
  }
 return null;
}
function setBreedingZone(o,s,inside){
 if(inside&&!s.breedZone&&o.slugs.filter(x=>x.breedZone).length>=2)return false;
 const b=breederState(o);if(!inside&&b.phase==='mating'&&b.parents.includes(s)){b.phase='idle';b.left=0;b.parents=[];b.parentGenes=null;}
 s.breedZone=inside;s.wall=null;s.climbZ=0;s.state='rest';s.stt=1;
 placeOnFloor(s,o);saveGame();return true;
}

function prepareBreederFoodSlugs(o){
 const b=breederState(o);breederVisualSlugs(o);
 const all=[...o.slugs,...b.larvae.map(l=>l.slug)];
 for(const s of all){const lo=b.larvae.some(l=>l.slug===s)?25:s.breedZone?20:0,hi=lo===25?30:lo===20?25:20;
 if(s._foodZoneLo!==lo&&s._meal){delete s._meal.food.reserved[s.id];s._meal=null;}
 s._foodZoneLo=lo;s._foodZoneHi=hi;s._zoneTank=o;
 }return all;
}
