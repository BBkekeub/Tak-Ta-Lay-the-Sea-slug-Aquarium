const BREEDING={mate:60,egg:60,grow:60,adultCap:12,larvaCap:50};
const isBreeder=o=>!!o?.def?.breeder;
function breederState(o){return o.breeding||(o.breeding={parents:[],eggs:[],larvae:[],phase:'idle',left:0,lab:BreedingGenes.newLab(),clean:100});}
function breederReserved(o){const b=isBreeder(o)?breederState(o):null;return b?b.parents.filter(s=>!o.slugs.includes(s)).length:0;}
function breederAdultSpace(o){return o.slugs.length+breederReserved(o)<tankCap(o.def);}
function startBreeding(o,ids){
 if(!isBreeder(o))return false;const b=breederState(o);
 const parents=[...new Set(ids)].map(id=>o.slugs.find(s=>s.id===id));
 if(b.phase!=='idle'||parents.length!==2||parents.some(s=>!s)||(typeof TRADE_OFFERS!=='undefined'&&parents.some(s=>TRADE_OFFERS.some(x=>x.slug===s)))){toast('เลือกทากว่าง 2 ตัวในตู้นี้','bad');return false;}
 if(parents.some(s=>(s.breedLife??50)<5)){toast('พลังผสมพันธุ์ไม่พอ','bad');return false;}
 if(b.larvae.length>=50){toast('พื้นที่ตัวอ่อนเต็ม','bad');return false;}
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
 if(egg.hatchRoll!==undefined){const failed=b.eggs.filter(e=>e.open&&!e.alive).length;egg.alive=egg.hatchRoll<Math.min(1,(egg.baseChance+(egg.last?failed*.1:0))*breedingSatietyFactor(b.parentSatiety)*breedingCleanFactor(o));}
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
   b.parentSatiety=b.parents.reduce((n,s)=>n+(s.satiety??50),0)/Math.max(1,b.parents.length);b.phase='eggs';b.left=BREEDING.egg;let dead=0;const n=Math.round(5+b.strength/100*10),chance=.05+b.strength/100*.05;
   b.eggs=Array.from({length:n},(_,i)=>({alive:false,open:false,hatchRoll:rnd(),baseChance:chance,last:i===n-1,seed:(rnd()*4294967296)>>>0,growthRoll:rnd()}));
   for(const parent of b.parents){parent.breedZone=true;if(!o.slugs.includes(parent))o.slugs.push(parent);}b.parents=[];
  }else if(b.left===0&&b.phase==='eggs')b.phase='hatching';
 }
 for(let i=b.larvae.length-1;i>=0;i--){const larva=b.larvae[i];walkBreedingZone(larva.slug,dt);larva.left=Math.max(0,larva.left-dt);
  if(larva.left>0)continue;
  if(!larva.ready&&larva.growthRoll!==undefined)larva.survives=larva.growthRoll<.7*breedingSatietyFactor(larva.slug.satiety)*breedingCleanFactor(o);
  if(!larva.survives){if(typeof onBreedLarvaDeath==='function')onBreedLarvaDeath(o,larva);b.larvae.splice(i,1);continue;}
  larva.ready=true;
  if(breederAdultSpace(o)){placeOnFloor(larva.slug,o);o.slugs.push(larva.slug);b.larvae.splice(i,1);}
 }
}
function breederVisualSlugs(o){
 if(!isBreeder(o))return [];const b=breederState(o),out=[];
 b.parents.forEach(s=>{if(!o.slugs.includes(s)){s.breedZone=true;o.slugs.push(s);}});
 b.larvae.forEach((l,i)=>{const s=l.slug;if(!Number.isFinite(s.fx)||s.fx<25||s.fx>=30){s.fx=25.5+i%5;s.fy=.5+Math.floor(i/5);}s._breedVisual=true;s._breedScale=.5;out.push(s);});return out;
}
function drawBreederInterior(o){
 if(!isBreeder(o))return;const b=breederState(o),sandT=SAND_CELLS;
 for(const x of [20,25]){const q=[[x,0,sandT],[x,10,sandT],[x,10,wallCells()*.9],[x,0,wallCells()*.9]].map(v=>S(...v));tctx.beginPath();q.forEach((p,i)=>i?tctx.lineTo(p.x,p.y):tctx.moveTo(p.x,p.y));tctx.closePath();tctx.fillStyle='rgba(180,224,230,.15)';tctx.fill();tctx.strokeStyle='rgba(210,244,250,.7)';tctx.stroke();}

 // A continuous gelatinous cord: each hatchable section shares its endpoints
 // with its neighbours. Small ova sit inside the cord, without UI markers.

 // Fixed-size badge at the back of the breeding compartment, above the cord.
 const occupants=new Set([...o.slugs.filter(s=>s.breedZone),...b.parents].map(s=>s.id)).size;
 const badge=S(22.5,.55,sandT+.2),label=occupants+'/2';
 tctx.save();tctx.font='600 13px sans-serif';tctx.textAlign='center';tctx.textBaseline='middle';
 tctx.fillStyle='rgba(13,32,35,.86)';tctx.strokeStyle=occupants===2?'#d9be77':'rgba(200,221,217,.6)';tctx.lineWidth=1;
 tctx.beginPath();tctx.roundRect(badge.x-23,badge.y-13,46,26,8);tctx.fill();tctx.stroke();
 tctx.fillStyle=occupants===2?'#ffe2a0':'#ecf3ed';tctx.fillText(label,badge.x,badge.y);tctx.restore();
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
 const key=[o.id,b.phase,Math.ceil(b.left),o.slugs.map(s=>s.id+':'+(s.breedLife??50)).join(),b.larvae.length,b.larvae.filter(l=>l.ready).length,b.eggs.map(e=>+e.open).join(),[...breederChosen].join()].join('|');breederPanel.hidden=false;if(key===breederPanelKey)return;breederPanelKey=key;
 const state=b.phase==='idle'?'พร้อมผสม':b.phase==='mating'?'กำลังผสม '+Math.ceil(b.left)+' วิ':b.phase==='eggs'?'รอฟัก '+Math.ceil(b.left)+' วิ':'กดไข่ทีละฟองเพื่อฟัก';
 breederPanel.innerHTML='<div style="margin-bottom:8px">เลี้ยงทั่วไป 100×50 ซม. · '+o.slugs.length+'/12 ตัว　|　ผสม 25×50 ซม. · '+state+'　|　ตัวอ่อน 25×50 ซม. · '+b.larvae.length+'/50 ตัว'+(b.larvae.some(l=>l.ready)?' · รอพื้นที่โซนตัวโต':'')+'</div><div style="display:flex;gap:8px;flex-wrap:wrap">'+'<button class="tbtn" id="startBreeder" '+(b.phase!=='idle'?'disabled':'')+'>เลือกทากมาผสมพันธุ์</button></div>'+(b.phase==='hatching'?'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px"><button class="tbtn" id="hatchAllBreeder">ฟักทั้งหมด</button>'+'</div>':'');
 breederPanel.querySelectorAll('[data-parent]').forEach(el=>el.onchange=()=>{if(el.checked&&breederChosen.size<2)breederChosen.add(el.dataset.parent);else breederChosen.delete(el.dataset.parent);breederPanelKey='';renderBreederUI();});
 if(breederPanel.querySelector('#hatchAllBreeder'))breederPanel.querySelector('#hatchAllBreeder').onclick=()=>hatchAllBreeder(o);
 breederPanel.querySelector('#startBreeder').onclick=()=>openBreedingPicker(o);breederPanel.querySelectorAll('[data-egg]').forEach(el=>el.onclick=()=>hatchBreedingEgg(o,+el.dataset.egg));
}
document.getElementById('tankCv').addEventListener('pointerdown',e=>{if(!tankMode||!isBreeder(curTank))return;const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const b=breederState(curTank),i=b.eggs.findIndex(egg=>!egg.open&&egg._hit&&egg._hit.points?.some(p=>Math.hypot(x-p.x,y-p.y)<egg._hit.r));if(i>=0&&b.phase==='hatching'){e.stopImmediatePropagation();e.preventDefault();hatchBreedingEgg(curTank,i);}},true);
let breedingLast=performance.now();setInterval(()=>{const now=performance.now(),dt=Math.min(1,(now-breedingLast)/1000);breedingLast=now;for(const o of [...G.objs,...G.shelter])if(isBreeder(o))tickBreeder(o,dt);renderBreederUI();},250);

function walkBreedingZone(s,dt){
 if(s===heldSlug)return;
 if(typeof foodDecay==='function')foodDecay([s],dt);
 const margin=Math.min(1.15,slugCm(s.genes)/CM_PER_CELL*.55*(s._breedScale||1)+.2),lo=(s._foodZoneLo??20)+margin,hi=(s._foodZoneHi??25)-margin;
 s.wall=null;s.climbZ=0;s.fx=Math.max(lo,Math.min(hi,Number.isFinite(s.fx)?s.fx:22.5));s.fy=Math.max(margin,Math.min(10-margin,Number.isFinite(s.fy)?s.fy:5));
 const solid=decorSolidSet(s._zoneTank?.decor||[]),oldX=s.fx,oldY=s.fy;
 if(foodStep(s,dt,s._foodZoneHi||25,10,s._zoneTank?.decor||[],solid)){s.fx=Math.max(lo,Math.min(hi,s.fx));s.fy=Math.max(margin,Math.min(10-margin,s.fy));return;}
 s.stt=(s.stt||0)-dt;if(s.stt<=0){s.state=s.state==='walk'?'rest':'walk';s.stt=1+Math.random()*4;s.dir=Math.random()*Math.PI*2;s.turn=s.dir;}
 if(s.state==='walk'){const speed=.32;s.fx+=Math.cos(s.dir)*speed*dt;s.fy+=Math.sin(s.dir)*speed*dt;s.ph=(s.ph||0)+dt*2;if(s.fx<lo||s.fx>hi)s.dir=Math.PI-s.dir;if(s.fy<margin||s.fy>10-margin)s.dir=-s.dir;s.turn=s.dir;}
 s.fx=Math.max(lo,Math.min(hi,s.fx));s.fy=Math.max(margin,Math.min(10-margin,s.fy));if([[s.fx,s.fy],[s.fx+margin*.6,s.fy],[s.fx-margin*.6,s.fy],[s.fx,s.fy+margin*.6],[s.fx,s.fy-margin*.6]].some(p=>solid.has(ptKey(...p)))){s.fx=oldX;s.fy=oldY;s.dir=(s.dir||0)+Math.PI;s.turn=s.dir;}s._lastGoodFx=s.fx;s._lastGoodFy=s.fy;
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
