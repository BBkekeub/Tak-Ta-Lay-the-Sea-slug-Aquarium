/* แข่งกินจุ 4 ตัว — ตู้ 100×100 ซม. หนึ่งตู้ต่อร้าน (สเปกผู้เล่น 2026-09-17)
 *
 * โครงเดียวกับ slug-race.js / slug-tug.js: ลูกค้า 3 คนมาท้า → โมดอลเลือกทาก+เดิมพัน → เข้าตู้เต็มจอ → ผลแพ้ชนะ
 *
 * กติกา
 *   สนาม = แถบหน้าตู้ 100×60 ซม. (ARENA_H) ห้ามวางของตกแต่ง · หลังสนามเหลือไว้แต่งตู้ / ทากตัวอื่นเดินเล่น
 *   ฐานของแต่ละตัว = สี่เหลี่ยม 4×4 ช่องเล็ก (20×20 ซม.) ที่มุมสนาม · พื้นที่ให้อาหาร = 4×4 ช่องกลางสนาม
 *   WASD เดิน (ทิศตามจอ) · Space แดช (พุ่งติดพื้น เลี้ยวได้) · F คาบ/วาง (ทีละชิ้น) · มือถือ = จอย + ปุ่มคาบ/แดช
 *   ลากกลับถึงฐาน = วางลงจานของเรา · อยู่ในฐานแล้วกด F / K สลับกัน = เคี้ยว ครบจำนวนเคี้ยวได้คะแนน
 *   หมดเวลา = นับคะแนนเฉพาะชิ้นที่กินหมดแล้ว
 *
 * ความเร็ว (อยากให้ตัวเล็กมีที่ยืน — เกมอื่นตัวใหญ่ได้เปรียบหมด)
 *   ตัวเล็กเร็ว · หงอนใหญ่ช้า · หงอนเยอะเร็ว
 *   แดชใช้เกจ ตัวใหญ่ใช้เยอะ
 *   ลากของ: ของใหญ่ช้าลงตามตาราง SIZES แต่ตัวใหญ่ลากของได้ดีกว่า (โดนหักน้อยกว่า)
 *
 * ชนิดอาหาร: คะแนน × ตัวคูณ + บัฟชั่วคราวตอนกินหมดชิ้น (บัฟซ้อนกันได้ ชนิดเดียวกันก็ซ้อน)
 */
(()=>{
 'use strict';
 const MINUTE=60000;
 const LIMIT=90, COUNTDOWN=3;                  // ⚙️ เวลาแข่ง (วินาที)
 /* ⚙️ ขนาดอาหาร — ผู้เล่นกำหนด pen/pts/chew · cm = ขนาดที่วาด (พื้นที่ให้อาหารกว้างแค่ 20 ซม. จึงวาดเล็ก) */
 const SIZES={
   S: {pen:.10,pts:10,chew:10, cm:7},
   M: {pen:.20,pts:15,chew:20, cm:9},
   L: {pen:.30,pts:25,chew:50, cm:12},
   XL:{pen:.50,pts:40,chew:100,cm:15},
 };
 /* ⚙️ ชนิดอาหาร — ตัวคูณคะแนน + บัฟ (ผู้เล่นกำหนด 2026-09-17)
    buff: speed = เดินเร็ว +20%/ชั้น · size = ตัวใหญ่ +10%/ชั้น · gill = หงอนใหญ่ +20%/ชั้น */
 const KINDS={
   algae:      {mult:.8},
   neopetrosia:{mult:.7, buff:{k:'speed',sec:20}},
   hydroid:    {mult:1},
   sponge:     {mult:1.1,buff:{k:'size', sec:15}},
   anemone:    {mult:1.2,buff:{k:'gill', sec:10}},
 };
 const BUFF_STEP={speed:.2,size:.1,gill:.2};
 const BUFF_ICON={speed:'⚡',size:'⬆',gill:'🌿'};
 const BUFF_NAME={speed:'วิ่งเร็ว',size:'ตัวใหญ่',gill:'หงอนใหญ่'};
 const FOOD_KINDS=Object.keys(KINDS);
 /* ⚙️ สนามแข่ง = แถบหน้าตู้ กว้างเต็มตู้ (20 ช่อง = 100 ซม.) ลึก ARENA_H ช่อง ชิดกระจกหน้า (fy 0 → ARENA_H)
    ⚠️ 2026-09-17 เดิมใช้ทั้งตู้ 100×100 แล้วผู้เล่นวางหินดักทางบอทได้ · ตอนนี้แบบเดียวกับตู้แข่งวิ่ง/ชักเย่อ:
       สนามห้ามวางของตกแต่ง ด้านหลังสนามเหลือไว้แต่งตู้ · ระหว่างแข่งไม่ใช้ของตกแต่งเป็นสิ่งกีดขวางเลย (ยุติธรรมทุกฝั่ง)
    สนามเล็กลง ระยะฐาน→กลางเฉลี่ยสั้นลงราว 20% จึงสเกลความเร็วเดินลงเท่ากัน (ARENA_SCALE) จังหวะเกมเท่าเดิม */
 const ARENA_H=12;                             // 60 ซม. · หลังสนามเหลือ 40 ซม. ให้วางของ
 const ARENA_SCALE=.8;
 const WALK=2.4*ARENA_SCALE;                   // ช่อง/วิ ที่ตัวคูณ 1 (เดิม 2.4 = 12 ซม./วิ ในสนามเต็มตู้)
 const DASH_T=.4, DASH_MUL=2.5, GAUGE_REGEN=22;
 /* ⚙️ ความเร็วเคี้ยวของบอท (ครั้ง/วิ สุ่มต่อตัว 6–10) × ตัวคูณนี้
    ⚠️ 2026-09-17 ผู้เล่นแพ้ตลอด ขอให้บอทกินช้าลง 5% → 0.95 (ใช้กับคำท้าเก่าในเซฟด้วย เพราะคูณตอนใช้ ไม่ได้คูณตอนสุ่ม) */
 const BOT_CHEW_MUL=.95;
 const HALF=2;                                 // ฐาน/พื้นที่อาหาร = 4×4 ช่องเล็ก → ครึ่งละ 2
 /* ⚙️ ตำแหน่งฐาน: 'corners' = 4 มุมสนาม · 'sides' = กลางขอบสนาม 4 ด้าน */
 const BASE_AT='corners';
 const WAVE_EVERY=10, WAVE_FILL=8;             // ทุก 10 วิ เติมพื้นที่อาหารจนมี 8 ชิ้น (ผู้เล่นขอ 2026-09-17 · เดิม 20 วิ)
 const MARKER_T=2.5;        // ลูกศร "คุณอยู่ตรงนี้" กะพริบตลอดนับถอยหลัง + 2.5 วิแรก
 const COLORS=['#ffd36b','#ff8a7a','#7fd4ff','#c3a6ff'];
 const names=['ปากกว้าง','ท้องยุ้ง','เคี้ยวไว','ฟันขูด','หิวโหย','กินเก่ง','ชามโต','อิ่มยาก'];

 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const g01=(g,k)=>clamp(Number.isFinite(g[k])?g[k]:50,0,100)/100;
 const gill01=g=>clamp(((typeof gillCount==='function'?gillCount(g):5)-2)/7,0,1);
 const NO_MODS={speed:1,size:1,gill:1};
 const foodPts=f=>Math.round(SIZES[f.size].pts*(KINDS[f.type]?.mult??1));
 const kindName=type=>typeof FOOD_TYPES!=='undefined'&&FOOD_TYPES[type]?FOOD_TYPES[type].name:type;
 /* ขนาดตัว 0..1 จากยีน (ความยาว 6–10 ซม.) · บัฟตัวใหญ่ดันเกิน 1 ได้ */
 const size01=(g,m)=>clamp((slugCm(g)*m.size-6)/4,0,1.4);
 /* ตัวคูณเดิน: ตัวเล็กเร็ว · หงอนใหญ่ช้า · หงอนเยอะเร็ว → 0.4 … 1.6 แล้วคูณบัฟวิ่งเร็ว */
 const speedMul=(g,m=NO_MODS)=>clamp(1.35-.6*size01(g,m)-.3*Math.min(1.4,g01(g,'gillLen')*m.gill)+.25*gill01(g),.4,1.6)*m.speed;
 /* ลากของ: ตัวเล็กสุดโดนหัก ×1.3 ของตาราง · ตัวใหญ่สุด ×0.7 */
 const carryMul=(size,g,m=NO_MODS)=>Math.max(.3,1-SIZES[size].pen*(1.3-.6*Math.min(1,size01(g,m))));
 const dashCost=(g,m=NO_MODS)=>25+35*Math.min(1.2,size01(g,m));   // 25 … 67 จากเกจ 100
 const bodyCells=(g,m=NO_MODS)=>TANK_SLUG_VIEW_SCALE*slugCm(g)*m.size/CM_PER_CELL*1.6;
 const radius=(g,m=NO_MODS)=>Math.min(1,bodyCells(g,m)*.32);

 let state=G.eat;
 if(!state||typeof state!=='object'||!Number.isFinite(state.nextAt))state={purchased:false,nextAt:0,offer:null,active:null};
 G.eat=state;
 let visitors=[],modal=null,ui=null,lastFrame=0,lastSave=0,cameraKey='',resumeReady=false,offerDeadline=0;
 let sprites=[],brains=[],pops=[];
 let keys=new Set(),joy={x:0,y:0,id:null},lastChewKey=null;
 let hud={};

 const tank=()=>G.objs.find(o=>o.def.eat&&o!==moving);
 const owned=()=>[...G.objs,...G.shelter].some(o=>o.def.eat);
 const tankOf=()=>G.objs.find(o=>o.id===state.active?.tankId);
 /* ลำดับ: [0] = เรา (ใกล้กล้อง) · 1 ขวาหน้า/ซ้าย · 2 หลังซ้าย/ขวา · 3 หลัง */
 function bases(t){
   const w=t.def.w,h=ARENA_H;
   return BASE_AT==='sides'?[{x:w/2,y:HALF},{x:HALF,y:h/2},{x:w-HALF,y:h/2},{x:w/2,y:h-HALF}]
     :[{x:HALF,y:HALF},{x:w-HALF,y:HALF},{x:HALF,y:h-HALF},{x:w-HALF,y:h-HALF}];
 }
 const pileOf=t=>({x:t.def.w/2,y:ARENA_H/2});
 const inSquare=(x,y,c,pad=0)=>Math.abs(x-c.x)<=HALF+pad&&Math.abs(y-c.y)<=HALF+pad;
 const inBase=(e,t)=>inSquare(e.x,e.y,bases(t)[e.slot]);
 /* ของตกแต่งห้ามอยู่ในแถบสนาม (ขอบหน้าตู้ → ARENA_H) · bounds = decorRequiredBounds (top = fy น้อยสุด) (tank-view.js canPlaceDecor) */
 function decorOk(t,keyset,bounds){
   if(!bounds||bounds.top<ARENA_H)return false;
   for(const k of keyset||[])if((Number(k.split(',')[1])+.5)*DCELL<ARENA_H)return false;
   return true;
 }
 /* ทากที่ไม่ได้ลงแข่ง: เดินเล่นตามปกติแต่อยู่หลังสนามเท่านั้น (แบบผู้ชมตู้แข่งวิ่ง slug-race.js stepNormal) */
 function normalSlugs(t){const id=state.active?.entrants?.[0]?.id;return t.slugs.filter(s=>s.id!==id);}
 function stepNormal(slugs,dt){
   const t=tankOf();if(!t)return;
   stepTankSlugs(slugs,t.def.w,t.def.h,dt,true,t.decor,t.def);
   for(const s of slugs){const min=ARENA_H+slugCm(s.genes)/CM_PER_CELL*.55;if(s.fy<min){s.fy=min;if(s.state==='walk'){s.state='rest';s.stt=1;}}s.wall=null;s.climbZ=0;}
 }
 /* ---------- บัฟ (นับเวลาด้วยนาฬิกาแมตช์ a.elapsed → เซฟ/โหลดต่อได้ ไม่เพี้ยน) ---------- */
 function buffCount(e,k){const now=state.active?.elapsed??0;return (e.buffs||[]).filter(b=>b.k===k&&b.until>now).length;}
 function mods(e){return {speed:1+BUFF_STEP.speed*buffCount(e,'speed'),size:1+BUFF_STEP.size*buffCount(e,'size'),gill:1+BUFF_STEP.gill*buffCount(e,'gill')};}

 /* ---------- ลูกค้ามาท้า (ยกแบบ slug-race.js — ที่นี่ 3 คน) ---------- */
 function purchased(){if(!state.purchased){state.purchased=true;state.nextAt=Date.now()+5*MINUTE;saveGame();}}
 const gap=()=>5*MINUTE;                        // ⚙️ ทดสอบ: ทุก 5 นาที (ใช้จริงค่อยยืดเหมือนตู้แข่งวิ่ง)
 function makeOffer(){
   const pool=names.slice().sort(()=>Math.random()-.5);
   return {rivals:[0,1,2].map(i=>({name:pool[i],genes:SlugEngine.randGene(),cps:6+Math.random()*4,greed:Math.random(),dashUse:.2+Math.random()*.5}))};
 }
 function leave(){
   for(const p of visitors){p.eatChallenger=false;p.family=null;p.tradeDone=true;p.visits=0;p.strolls=0;
     p.focus=null;p.route=[];p.routeGoal=null;p.tgt=doorSpot();p.state='leave';p.stuck=0;}
   visitors=[];offerDeadline=0;
 }
 function goal(p){
   const t=tank();
   if(!t||!state.offer){p.eatChallenger=false;p.visits=0;p.strolls=0;return false;}
   const spot=freeSpot(lookSpots(t),p);
   if(spot){p.focus=t;p.tgt=spot;p.state='walk';p.route=[];p.routeGoal=null;p.stuck=0;return true;}
   p.focus=null;p.tgt=strollSpot(p);p.state='walk';return true;
 }
 function spawn(){
   if(visitors.length||!peopleOn||!tank()||document.hidden||tankMode||window.BOOTING)return;
   const capacity=visitorCapacity()-PEOPLE.length;if(capacity<3)return;
   const previous=new Set(PEOPLE),gender=()=>Math.random()<.5?'female':'male';
   if(!spawnVisitors(capacity,'eat',[0,1,2].map(()=>({kid:false,gender:gender()}))))return;
   visitors=PEOPLE.filter(p=>!previous.has(p));
   if(!state.offer){state.offer=makeOffer();state.nextAt=Date.now()+gap();saveGame();}
   visitors.forEach((p,i)=>{
     const r=state.offer.rivals[i%3];
     p.family=null;p.eatChallenger=true;p.wantsBuy=false;p.wantsSell=false;p.tradeDone=true;
     p.carryTank=true;p.carryColor='#35707a';p.carryAccent=slugBaseHex(r.genes);
     if(typeof makeSlug==='function')p.carrySlug=makeSlug(r.genes);
     p.bagged=false;p.accessory='none';p.visits=1;p.strolls=0;goal(p);
   });
   offerDeadline=Date.now()+5*MINUTE;
   toast('🍽️ มีคนมาท้าแข่งกินจุ! คลิกคนถือตู้เพื่อรับคำท้า','good');
 }
 function dismiss(){state.offer=null;leave();close();saveGame();}
 function tick(){
   if(owned())purchased();
   if(state.active){if(resumeReady&&!modal&&!ui&&!window.BOOTING)openMatch();return;}
   if(!tank()){if(state.offer){state.offer=null;leave();if(modal)close();saveGame();}return;}
   if(visitors.length&&!visitors.every(p=>PEOPLE.includes(p)))leave();
   if(offerDeadline&&Date.now()>offerDeadline&&!modal){dismiss();return;}
   if(state.purchased&&Date.now()>=state.nextAt||state.offer)spawn();
 }

 /* ---------- DOM ---------- */
 function element(tag,text,parent,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;if(parent)parent.append(e);return e;}
 function dialog(title){
   modal=element('dialog');modal.className='slug-race-dialog slug-eat-dialog';modal.setAttribute('aria-label',title);
   modal.addEventListener('cancel',e=>{e.preventDefault();if(!state.active)dismiss();});
   modal.addEventListener('lightdismiss',e=>{if(!state.active){e.preventDefault();close();}});
   element('h2',title,modal);document.body.append(modal);modal.showModal();return modal;
 }
 function close(){
   modal?.close();modal?.remove();modal=null;
   ui?.remove();ui=null;hud={};document.body.classList.remove('eat-in-tank');
   keys.clear();joy={x:0,y:0,id:null};lastChewKey=null;lastFrame=0;cameraKey='';pops=[];
 }

 /* ---------- ป้าย "คลิกเพื่อแข่ง" เหนือหัวผู้ท้า ---------- */
 function drawChallengers(){
   if(!state.offer||!visitors.length)return;
   const label='🍽️ แข่งกินจุ 4 ตัว · คลิกรับคำท้า';
   ctx.save();ctx.font='bold 13px "IBM Plex Sans Thai",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   const boxW=ctx.measureText(label).width+32,boxH=31,glow=.55+.35*(.5+.5*Math.sin(performance.now()/260));
   visitors.forEach(p=>{
     if(!personOnScreen(p))return;
     const b=personScreenBounds(p),x=clamp((b.x0+b.x1)/2,boxW/2+4,CW-boxW/2-4),y=clamp(b.y0-boxH/2-10,boxH/2+4,CH-boxH/2-4);
     ctx.beginPath();ctx.roundRect(x-boxW/2,y-boxH/2,boxW,boxH,boxH/2);
     ctx.fillStyle='rgba(44,30,14,.92)';ctx.fill();ctx.lineWidth=1.4;ctx.strokeStyle='rgba(231,198,123,'+glow+')';ctx.stroke();
     ctx.fillStyle='#ffe1a0';ctx.fillText(label,x,y+1);
     p._eatHit={x0:x-boxW/2,x1:x+boxW/2,y0:y-boxH/2,y1:y+boxH/2};
   });
   ctx.restore();
 }
 function hitTest(e){
   if(tankMode||appMode!=='view'||moving||buyKey||modal||!state.offer||state.active)return false;
   const {sx,sy}=screenXY(e);
   return visitors.some(p=>{const h=p._eatHit;return personOnScreen(p)&&(personHitTest(p,sx,sy)||(h&&sx>=h.x0&&sx<=h.x1&&sy>=h.y0&&sy<=h.y1));});
 }
 let pressedVisitor=false;
 cv.addEventListener('pointerdown',e=>{if(e.button===0&&hitTest(e)){pressedVisitor=true;e.preventDefault();e.stopImmediatePropagation();}},true);
 cv.addEventListener('pointerup',e=>{if(pressedVisitor){pressedVisitor=false;e.preventDefault();e.stopImmediatePropagation();if(hitTest(e))ask();}},true);
 cv.addEventListener('pointercancel',()=>{pressedVisitor=false;},true);

 /* ---------- โมดอลรับคำท้า ---------- */
 const cmPerSec=g=>(WALK*speedMul(g)*CM_PER_CELL).toFixed(1);
 function ask(){
   if(modal||!state.offer||!tank()||state.active)return;
   const t=tank(),rivals=state.offer.rivals;
   const d=dialog('🍽️ แข่งกินจุ 4 ตัว');
   element('p',rivals.map(r=>r.name).join(' · ')+' ขอท้าแข่ง '+LIMIT+' วินาที',d);
   const row=element('div',null,d,'eat-rivals');
   for(const r of rivals){const cell=element('div',null,row,'eat-rival');const c=element('canvas',null,cell);c.width=150;c.height=90;c.setAttribute('aria-hidden','true');
     try{drawSlugPortrait(c,{genes:r.genes});}catch(_){}element('b',r.name,cell);element('small',cmPerSec(r.genes)+' ซม./วิ',cell);}
   element('p','ลากอาหารจากกลางตู้กลับฐาน แล้วกด F / K สลับกันเพื่อกิน · ตัวเล็กเดินเร็ว ตัวใหญ่ลากของหนักเก่ง',d,'eat-rule');
   element('p','🥬 สาหร่าย ×0.8 · 🌿 ไฮดรอยด์ ×1 · 🧽 ฟองน้ำ ×1.1 ตัวใหญ่ +10% 15 วิ · 🌸 ดอกไม้ทะเล ×1.2 หงอนใหญ่ +20% 10 วิ · 🧽 นีโอเปโทรเซีย ×0.7 วิ่งเร็ว +20% 20 วิ · บัฟซ้อนกันได้',d,'eat-rule');
   element('p','เลือกทากในตู้แข่งกิน',d);
   let picked=t.slugs[0]?.id||null;
   SlugHover.cards(element('div',null,d),{slugs:t.slugs,selected:picked,empty:'ยังไม่มีทากในตู้แข่งกิน',
     sub:s=>{const g=foodGenes(s);return 'เดิน '+cmPerSec(g)+' ซม./วิ · แดชใช้เกจ '+Math.round(dashCost(g));},onPick:s=>{picked=s.id;}});
   const betLabel=element('label','เดิมพัน (ทอง) — ยังไม่หักตอนเริ่ม',d),bet=element('input',null,betLabel);
   const maxBet=Math.max(0,Math.min(1000,Math.floor(G.coin)));
   bet.type='number';bet.min='0';bet.max=String(maxBet);bet.step='1';bet.value='0';
   const quick=element('div',null,d,'race-bet-quick');
   const pickBet=v=>{bet.value=String(v);for(const b of quick.children)b.setAttribute('aria-pressed',String(+b.dataset.v===v));};
   const presets=[['ไม่เดิมพัน',0],...[100,300,500].filter(v=>v<maxBet).map(v=>[String(v),v])];
   if(maxBet>0)presets.push(['สูงสุด '+maxBet.toLocaleString(),maxBet]);
   for(const [label,v] of presets){const b=element('button',label,quick,'tbtn');b.type='button';b.dataset.v=String(v);b.setAttribute('aria-pressed',String(v===0));b.onclick=()=>pickBet(v);}
   bet.addEventListener('input',()=>{for(const b of quick.children)b.setAttribute('aria-pressed',String(+b.dataset.v===+bet.value));});
   element('p','ที่ 1 ได้ 2 เท่าของเดิมพัน · ที่ 2 เท่าทุน · ที่ 3 เสียครึ่ง · ที่ 4 เสียเต็ม',d,'eat-rule');
   const error=element('p','',d);error.setAttribute('role','alert');
   const start=element('button','เริ่มแข่ง',d,'tbtn');start.disabled=!t.slugs.length;
   if(!t.slugs.length)error.textContent='ยังไม่มีทากในตู้แข่งกิน ย้ายทากเข้าตู้ก่อนรับคำท้า';
   start.onclick=()=>{
     const wager=Number(bet.value),s=t.slugs.find(x=>x.id===picked);
     if(!s||!G.objs.includes(t)||!Number.isInteger(wager)||wager<0||wager>Math.min(1000,G.coin)){
       error.textContent='เลือกทากในตู้ และใส่เดิมพันเป็นจำนวนเต็มไม่เกิน 1,000 หรือทองที่มี';return;}
     begin(t,s,wager);
   };
   element('button','ไม่แข่ง ให้ผู้ท้ากลับ',d,'tbtn').onclick=dismiss;
   element('button','กลับไปเตรียมทาก',d,'tbtn').onclick=close;
 }

 /* ---------- เริ่มแมตช์ ---------- */
 function randomFood(t,a,size){
   const P=pileOf(t),spread=HALF-.4;
   for(let k=0;k<30;k++){
     const x=P.x+(Math.random()*2-1)*spread,y=P.y+(Math.random()*2-1)*spread;
     if(a.foods.some(f=>Math.hypot(f.x-x,f.y-y)<.7)&&k<25)continue;   // พื้นที่แคบ ซ้อนกันได้บ้างถ้าหาที่ว่างไม่เจอ
     return {id:'ef'+(a.seq=(a.seq|0)+1),size,type:FOOD_KINDS[(Math.random()*FOOD_KINDS.length)|0],x,y};
   }
   return null;
 }
 function rollSize(){const r=Math.random();return r<.4?'S':r<.7?'M':r<.9?'L':'XL';}
 function wave(t,a,first){
   const list=first?['S','S','S','M','M','L','L','XL']:[];
   if(!first)while(a.foods.length+list.length<WAVE_FILL)list.push(rollSize());
   for(const size of list){const f=randomFood(t,a,size);if(f)a.foods.push(f);}
 }
 function begin(t,s,wager){
   const b=bases(t),g={...foodGenes(s)};
   const entrant=(slot,o)=>({slot,x:b[slot].x,y:b[slot].y,dir:Math.atan2(pileOf(t).y-b[slot].y,pileOf(t).x-b[slot].x),
     carry:null,stash:[],buffs:[],score:0,gauge:100,dashT:0,dashX:0,dashY:0,...o});
   const a={tankId:t.id,wager,elapsed:0,countdown:COUNTDOWN,nextWave:WAVE_EVERY,settled:false,foods:[],seq:0,
     entrants:[entrant(0,{name:slugNick(s),id:s.id,genes:g}),
       ...state.offer.rivals.map((r,i)=>entrant(i+1,{name:r.name,genes:{...r.genes},cps:r.cps,greed:r.greed,dashUse:r.dashUse,bot:true}))]};
   wave(t,a,true);
   state.active=a;saveGame();close();openMatch();
 }
 function openMatch(){
   const a=state.active,t=tankOf();if(!a||modal||ui)return;
   if(!t||!t.slugs.some(s=>s.id===a.entrants[0].id)){state.active=null;state.offer=null;leave();saveGame();return;}   // ทากเราหายไประหว่างทาง = ยกเลิก
   for(const e of a.entrants)if(!Array.isArray(e.buffs))e.buffs=[];
   brains=a.entrants.map(()=>({path:[],target:null,think:0}));pops=[];lastChewKey=null;
   sprites=a.entrants.map((e,i)=>i===0?t.slugs.find(s=>s.id===e.id):{id:'eat-bot-'+i,genes:e.genes,state:'rest',ph:i*1.3,noBob:true,creepT:0});
   ui=element('div');ui.id='eatTankHUD';document.body.classList.add('eat-in-tank');
   enterTank(t);ov.querySelector('.ov-body').append(ui);
   document.getElementById('ovTitle').textContent='🍽️ แข่งกินจุ';
   buildHud(a);
   resizeTank();lastFrame=0;cameraKey='';
   if(a.settled)showResult();
 }
 function buildHud(a){
   const top=element('div',null,ui,'eat-top');
   hud.time=element('div','',top,'eat-time');hud.time.setAttribute('role','timer');
   hud.status=element('div','',top,'eat-status');hud.status.setAttribute('role','status');
   hud.board=element('ol',null,ui,'eat-board');
   hud.rows=a.entrants.map((e,i)=>{const li=element('li',null,hud.board,i===0?'is-me':'');li.style.setProperty('--c',COLORS[i]);
     element('i',null,li);element('span',i===0?'คุณ':e.name,li);const b=element('b','0',li);return {li,b};});
   hud.buffs=element('div',null,ui,'eat-buffs');hud.buffs.setAttribute('aria-live','polite');
   hud.big=element('div','',ui,'eat-bigcount');hud.big.setAttribute('aria-hidden','true');
   hud.plate=element('div',null,ui,'eat-plate');hud.plate.hidden=true;
   hud.plateLabel=element('span','',hud.plate);const bar=element('div',null,hud.plate,'eat-plate-bar');hud.plateFill=element('i',null,bar);
   hud.hint=element('div','WASD เดิน · Space แดช · F คาบ/วาง · ถึงฐานแล้วกด F / K สลับกันเพื่อกิน',ui,'eat-hint');
   const controls=element('div',null,ui,'eat-controls');
   const stick=element('div',null,controls,'eat-stick');hud.knob=element('i',null,stick);
   stick.setAttribute('aria-hidden','true');
   bindStick(stick);
   const right=element('div',null,controls,'eat-buttons');
   hud.dash=element('button',null,right,'eat-btn eat-dash');hud.dash.type='button';element('b','แดช',hud.dash);element('small','Space',hud.dash,'eat-key');hud.dashFill=element('i',null,hud.dash);
   hud.dash.onpointerdown=e=>{e.preventDefault();dash(0,null);};
   hud.bite=element('button',null,right,'eat-btn eat-bite');hud.bite.type='button';hud.biteLabel=element('b','คาบ',hud.bite);element('small','F',hud.bite,'eat-key');
   hud.bite.onpointerdown=e=>{e.preventDefault();bite(0);};
   /* ปุ่มกิน F / K กลางจอ (มือถือแตะสลับ · คอมกดคีย์) โผล่ทันทีที่อยู่ในฐานและมีของในจาน */
   hud.chew=element('div',null,ui,'eat-chew-keys');hud.chew.hidden=true;hud.chew.setAttribute('role','group');hud.chew.setAttribute('aria-label','กด F และ K สลับกันเพื่อกิน');
   element('div','🍽️ ถึงฐานแล้ว! กด F / K สลับกันเพื่อกิน',hud.chew,'eat-chew-title');
   const chewRow=element('div',null,hud.chew,'eat-chew-row');
   hud.chewBtn={};
   for(const k of ['f','k']){if(k==='k')element('span','⇄',chewRow);const b=element('button',null,chewRow,'eat-btn eat-chew');b.type='button';b.dataset.key=k;
     b.setAttribute('aria-label','เคี้ยว ปุ่ม '+k.toUpperCase());element('b',k.toUpperCase(),b);element('small','กิน',b);
     b.onpointerdown=e=>{e.preventDefault();chewKey(k);};hud.chewBtn[k]=b;}
 }
 function bindStick(stick){
   const move=e=>{const r=stick.getBoundingClientRect(),R=r.width/2,dx=e.clientX-(r.left+R),dy=e.clientY-(r.top+R),d=Math.hypot(dx,dy),k=d>R?R/d:1;
     joy.x=dx*k/R;joy.y=dy*k/R;hud.knob.style.transform='translate('+(joy.x*R*.6)+'px,'+(joy.y*R*.6)+'px)';};
   stick.addEventListener('pointerdown',e=>{e.preventDefault();joy.id=e.pointerId;stick.setPointerCapture(e.pointerId);move(e);});
   stick.addEventListener('pointermove',e=>{if(e.pointerId===joy.id)move(e);});
   const end=e=>{if(e.pointerId!==joy.id)return;joy={x:0,y:0,id:null};hud.knob.style.transform='';};
   stick.addEventListener('pointerup',end);stick.addEventListener('pointercancel',end);
 }

 /* ---------- ฟิสิกส์ ---------- */
 /* ชนแค่ขอบสนาม — ของตกแต่งไม่มีทางอยู่ในสนาม (decorOk) และไม่ถูกใช้เป็นสิ่งกีดขวาง */
 const blocked=(t,x,y,r)=>x<r||y<r||x>t.def.w-r||y>ARENA_H-r;
 function speedOf(e){const m=mods(e);return WALK*speedMul(e.genes,m)*(e.carry?carryMul(e.carry.size,e.genes,m):1)*(e.dashT>0?DASH_MUL:1);}
 /* ทิศบนจอ → ทิศบนพื้นตู้ (ภาพเฉียง: เดินลึกเข้าไป = ขึ้นขวาบนจอ) กด W จึงขึ้นตรง ๆ บนจอจริง */
 function screenToFloor(sx,sy){
   const Y=-sy/DEPY,X=(sx-Y*DEPX)/CELLW,d=Math.hypot(X,Y);
   return d>1e-6?{x:X/d,y:Y/d,m:Math.min(1,Math.hypot(sx,sy))}:{x:0,y:0,m:0};
 }
 function moveEntrant(t,e,vx,vy,dt){
   const r=radius(e.genes,mods(e));let moved=0;
   const nx=e.x+vx*dt,ny=e.y+vy*dt;
   if(!blocked(t,nx,ny,r)){moved=Math.hypot(nx-e.x,ny-e.y);e.x=nx;e.y=ny;}
   else if(!blocked(t,nx,e.y,r)){moved=Math.abs(nx-e.x);e.x=nx;}
   else if(!blocked(t,e.x,ny,r)){moved=Math.abs(ny-e.y);e.y=ny;}
   if(vx||vy){const want=Math.atan2(vy,vx),turn=Math.atan2(Math.sin(want-e.dir),Math.cos(want-e.dir));e.dir+=turn*Math.min(1,dt*12);}
   return moved;
 }
 function dash(i,dir){
   const a=state.active;if(!a||a.settled||a.countdown>0)return false;
   const e=a.entrants[i],cost=dashCost(e.genes,mods(e));
   if(e.dashT>0||e.gauge<cost)return false;
   const d=dir||{x:Math.cos(e.dir),y:Math.sin(e.dir)};
   e.gauge-=cost;e.dashT=DASH_T;e.dashX=d.x;e.dashY=d.y;
   return true;
 }
 function reach(e,f){const m=mods(e);return radius(e.genes,m)+bodyCells(e.genes,m)*.25+SIZES[f.size].cm/CM_PER_CELL*.35+.3;}
 function nearestFood(a,e){
   let best=null,bd=Infinity;
   for(const f of a.foods){const d=Math.hypot(f.x-e.x,f.y-e.y);if(d<reach(e,f)&&d<bd){bd=d;best=f;}}
   return best;
 }
 /* F (คาบ): ถือของอยู่ = วางลงตรงนั้น · มือว่าง = งับชิ้นที่ใกล้สุดในระยะ · ถึงฐานแล้วของถูกวางลงจานเอง */
 function bite(i){
   const a=state.active,t=tankOf();if(!a||!t||a.settled||a.countdown>0)return false;
   const e=a.entrants[i];
   if(e.carry){
     if(inBase(e,t)){e.stash.push({size:e.carry.size,type:e.carry.type,chews:0});e.carry=null;return true;}
     a.foods.push({...e.carry,x:e.x+Math.cos(e.dir)*.6,y:e.y+Math.sin(e.dir)*.6});e.carry=null;return true;
   }
   const f=nearestFood(a,e);
   if(f){a.foods.splice(a.foods.indexOf(f),1);e.carry={id:f.id,size:f.size,type:f.type};return true;}
   return false;
 }
 /* F / K ต้องสลับกัน กดปุ่มเดิมซ้ำไม่นับ (แบบเดียวกับชักเย่อ) */
 function chewKey(k){
   if(k===lastChewKey)return false;
   if(!chew(0))return false;
   lastChewKey=k;hud.chewBtn?.[k]?.animate([{transform:'translateY(4px) scale(.93)',filter:'brightness(1.4)'},{transform:'none',filter:'none'}],{duration:140});
   return true;
 }
 function chew(i){
   const a=state.active,t=tankOf();if(!a||!t||a.settled||a.countdown>0)return false;
   const e=a.entrants[i];if(!e.stash.length||!inBase(e,t))return false;
   const item=e.stash[0];item.chews++;e.chewAt=performance.now();
   if(item.chews>=SIZES[item.size].chew){
     e.stash.shift();const pts=foodPts(item);e.score+=pts;
     const buff=KINDS[item.type]?.buff;
     if(buff){e.buffs=(e.buffs||[]).filter(b=>b.until>a.elapsed);e.buffs.push({k:buff.k,until:a.elapsed+buff.sec});}
     pops.push({x:e.x,y:e.y,text:'+'+pts+(buff?' '+BUFF_ICON[buff.k]:''),color:COLORS[i],t:0});
   }
   return true;
 }

 /* ---------- บอท ---------- */
 function gridPath(t,e,tx,ty){
   const W=t.def.w,H=ARENA_H,r=radius(e.genes,mods(e)),key=(x,y)=>x+','+y;
   const clearCell=(x,y)=>!blocked(t,x+.5,y+.5,r);
   const start=[clamp(Math.floor(e.x),0,W-1),clamp(Math.floor(e.y),0,H-1)],goal=[clamp(Math.floor(tx),0,W-1),clamp(Math.floor(ty),0,H-1)];
   const prev=new Map([[key(...start),null]]),q=[start];let found=null;
   for(let i=0;i<q.length;i++){
     const [x,y]=q[i];if(x===goal[0]&&y===goal[1]){found=q[i];break;}
     for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
       const nx=x+dx,ny=y+dy,k=key(nx,ny);if(nx<0||ny<0||nx>=W||ny>=H||prev.has(k)||!clearCell(nx,ny))continue;
       if(dx&&dy&&(!clearCell(x+dx,y)||!clearCell(x,y+dy)))continue;
       prev.set(k,[x,y]);q.push([nx,ny]);
     }
   }
   if(!found)return [{x:tx,y:ty}];
   const cells=[];for(let p=found;p;p=prev.get(key(...p)))cells.push({x:p[0]+.5,y:p[1]+.5});
   cells.reverse();cells[cells.length-1]={x:tx,y:ty};
   /* ตัดจุดที่มองเห็นกันตรง ๆ ทิ้ง เดินเป็นเส้นตรงแทนหยักตามกริด */
   const sight=(p,q)=>{const n=Math.ceil(Math.hypot(q.x-p.x,q.y-p.y)/.25);for(let k=1;k<n;k++){const x=p.x+(q.x-p.x)*k/n,y=p.y+(q.y-p.y)*k/n;if(blocked(t,x,y,r))return false;}return true;};
   const out=[];let from={x:e.x,y:e.y},i=0;
   while(i<cells.length){let j=cells.length-1;while(j>i&&!sight(from,cells[j]))j--;out.push(cells[j]);from=cells[j];i=j+1;}
   return out;
 }
 function chooseFood(t,a,e){
   const home=bases(t)[e.slot],left=LIMIT-a.elapsed,m=mods(e);let best=null,bv=-1;
   for(const f of a.foods){
     const Z=SIZES[f.size],go=Math.hypot(f.x-e.x,f.y-e.y)/(WALK*speedMul(e.genes,m));
     const back=Math.hypot(home.x-f.x,home.y-f.y)/(WALK*speedMul(e.genes,m)*carryMul(f.size,e.genes,m));
     const total=go+back+Z.chew/(e.cps*BOT_CHEW_MUL)+.6;
     if(total>left)continue;
     const taken=a.entrants.some(o=>o!==e&&o.bot&&brains[o.slot]?.target===f.id);
     const v=Math.pow(foodPts(f),.6+e.greed*.8)/total*(taken?.55:1)*(.85+Math.random()*.3);
     if(v>bv){bv=v;best=f;}
   }
   return best;
 }
 function stepBot(t,a,e,dt){
   const br=brains[e.slot],home=bases(t)[e.slot];
   /* อยู่ในฐานและมีของในจาน = นั่งเคี้ยวให้หมดก่อน */
   if(!e.carry&&e.stash.length&&inBase(e,t)){
     br.chewAcc=(br.chewAcc||0)+dt*e.cps*BOT_CHEW_MUL;
     while(br.chewAcc>=1){br.chewAcc--;chew(e.slot);}
     return {vx:0,vy:0};
   }
   br.think-=dt;
   let goal=null;
   if(e.carry){br.target=null;goal=home;}
   else{
     let f=a.foods.find(x=>x.id===br.target);
     if(!f||br.think<=0){const pick=chooseFood(t,a,e);if(pick?.id!==br.target){br.target=pick?.id||null;br.path=[];}f=pick;br.think=.8+Math.random()*.6;}
     if(f){goal=f;if(Math.hypot(f.x-e.x,f.y-e.y)<reach(e,f)*.9){bite(e.slot);br.target=null;br.path=[];return {vx:0,vy:0};}}
     else goal=home;
   }
   if(!br.path.length||br.goalX!==goal.x||br.goalY!==goal.y||br.replan<=0){br.path=gridPath(t,e,goal.x,goal.y);br.goalX=goal.x;br.goalY=goal.y;br.replan=1.5;}
   br.replan-=dt;
   let wp=br.path[0];
   while(wp&&Math.hypot(wp.x-e.x,wp.y-e.y)<.3&&br.path.length>1){br.path.shift();wp=br.path[0];}
   if(!wp)return {vx:0,vy:0};
   const dx=wp.x-e.x,dy=wp.y-e.y,d=Math.hypot(dx,dy);
   if(d<.05)return {vx:0,vy:0};
   const remain=br.path.reduce((s,p,i)=>s+Math.hypot(p.x-(i?br.path[i-1].x:e.x),p.y-(i?br.path[i-1].y:e.y)),0);
   if(remain>4&&d>2.5&&e.gauge>=dashCost(e.genes,mods(e))+8&&Math.random()<e.dashUse*dt*2)dash(e.slot,{x:dx/d,y:dy/d});
   return {vx:dx/d,vy:dy/d};
 }

 /* ---------- เดินเกม ---------- */
 function inputDir(){
   let sx=0,sy=0;
   if(keys.has('KeyA')||keys.has('ArrowLeft'))sx--;if(keys.has('KeyD')||keys.has('ArrowRight'))sx++;
   if(keys.has('KeyW')||keys.has('ArrowUp'))sy--;if(keys.has('KeyS')||keys.has('ArrowDown'))sy++;
   if(joy.id!=null&&Math.hypot(joy.x,joy.y)>.18){sx=joy.x;sy=joy.y;}
   return screenToFloor(sx,sy);
 }
 function advance(t,a,dt){
   if(a.settled)return;
   if(a.countdown>0){a.countdown=Math.max(0,a.countdown-dt);return;}
   a.elapsed+=dt;
   if(a.elapsed>=LIMIT){a.elapsed=LIMIT;settle();return;}
   if(a.elapsed>=a.nextWave){a.nextWave+=WAVE_EVERY;wave(t,a,false);}
   a.entrants.forEach((e,i)=>{
     e.gauge=Math.min(100,e.gauge+GAUGE_REGEN*dt);
     if(e.buffs.length&&e.buffs.some(b=>b.until<=a.elapsed))e.buffs=e.buffs.filter(b=>b.until>a.elapsed);
     let v;
     if(e.bot)v=stepBot(t,a,e,dt);
     else{const d=inputDir();v={vx:d.x*d.m,vy:d.y*d.m};}
     /* แดช = พุ่งเร็วไปข้างหน้าบนพื้น (ไม่กระโดด) · ผู้เล่นยังเลี้ยวตามปุ่มเดินได้ระหว่างพุ่ง ไม่เสียจังหวะ */
     if(e.dashT>0){
       e.dashT=Math.max(0,e.dashT-dt);
       const len=Math.hypot(v.vx,v.vy);
       if(len>.2){e.dashX=v.vx/len;e.dashY=v.vy/len;}
       v={vx:e.dashX,vy:e.dashY};
     }
     const sp=speedOf(e);
     e._moved=moveEntrant(t,e,v.vx*sp,v.vy*sp,dt);
     /* ถือของเดินเข้าฐาน = วางลงจานเอง (บอทก็ใช้ทางเดียวกัน) */
     if(e.carry&&inBase(e,t))bite(i);
   });
   /* ทากชนกันเบา ๆ ไม่ให้ซ้อนทับเป็นตัวเดียว */
   for(let i=0;i<a.entrants.length;i++)for(let j=i+1;j<a.entrants.length;j++){
     const p=a.entrants[i],q=a.entrants[j],rp=radius(p.genes,mods(p)),rq=radius(q.genes,mods(q));
     const min=(rp+rq)*.9,dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy);
     if(d>0&&d<min){const push=(min-d)/2,ux=dx/d,uy=dy/d;
       if(!blocked(t,p.x-ux*push,p.y-uy*push,rp)){p.x-=ux*push;p.y-=uy*push;}
       if(!blocked(t,q.x+ux*push,q.y+uy*push,rq)){q.x+=ux*push;q.y+=uy*push;}}
   }
 }
 function settle(){
   const a=state.active;if(!a||a.settled)return;
   const progress=e=>e.stash.reduce((n,s)=>n+s.chews/SIZES[s.size].chew,0);
   const order=a.entrants.map((e,i)=>i).sort((x,y)=>(a.entrants[y].score-a.entrants[x].score)||(progress(a.entrants[y])-progress(a.entrants[x]))||(x-y));
   a.order=order;a.rank=order.indexOf(0)+1;
   a.delta=(a.rank===1?a.wager*2:a.rank===2?0:a.rank===3?-Math.floor(a.wager/2):-a.wager)||0;   // ||0 กัน "-0 ทอง" ตอนไม่เดิมพัน
   addCoin(a.delta);a.settled=true;saveGame();syncHUD();
   if(typeof playNotificationSound==='function')playNotificationSound(a.rank===1?'tugWin':'tugLose');
   if(a.rank===1&&window.Fireworks)Fireworks.play({count:12,duration:3400});
   setTimeout(()=>{if(state.active===a&&!modal)showResult();},1100);
 }
 function complete(){
   const t=tankOf(),me=state.active?.entrants[0];
   const s=t?.slugs.find(x=>x.id===me?.id);if(s){s.state='rest';s.stt=1;s.wall=null;s.climbZ=0;delete s._breedScale;}
   state.active=null;state.offer=null;leave();close();exitTank();saveGame();
 }
 function showResult(){
   const a=state.active;if(!a?.settled||modal)return;
   const titles=['','ชนะเลิศ! 🍽️','ได้ที่ 2','ได้ที่ 3','ได้ที่ 4'];
   const d=dialog(titles[a.rank]);d.classList.add('race-result','eat-result');
   d.addEventListener('cancel',e=>{e.preventDefault();complete();});
   element('p',a.rank===1?'กินจุที่สุดในตู้!':'อีกนิดเดียว ลองเลือกชิ้นให้คุ้มกว่านี้',d,'race-result-caption');
   const podium=element('div',null,d,'race-podium eat-podium');
   for(const place of [2,1,3,4]){
     const i=a.order[place-1],e=a.entrants[i],step=element('div',null,podium,'race-podium-step place-'+place+(i===0?' is-player':''));
     element('span',i===0?'คุณ':e.name,step,'race-podium-name');
     const c=element('canvas',null,step);c.width=180;c.height=110;c.setAttribute('role','img');c.setAttribute('aria-label',e.name);
     const sprite=slugSprite({genes:e.genes});if(sprite){const k=Math.min(160/sprite.c.width,100/sprite.c.height),w=sprite.c.width*k,h=sprite.c.height*k;c.getContext('2d').drawImage(sprite.c,(180-w)/2,(110-h)/2,w,h);}
     const block=element('div',null,step,'race-podium-block');element('span',['','🥇','🥈','🥉','🍴'][place],block,'race-medal');element('b',e.score+' คะแนน',block);
   }
   const receipt=element('div',null,d,'race-receipt');
   element('span','เดิมพัน '+a.wager.toLocaleString()+' ทอง',receipt);
   element('strong',(a.delta>0?'ได้รับ +':a.delta<0?'เสีย ':'ไม่เสีย ไม่ได้เพิ่ม · ')+a.delta.toLocaleString()+' ทอง',receipt);
   element('small','ทองคงเหลือ '+G.coin.toLocaleString(),receipt);
   element('p',a.rank===1?'ผู้ท้า: ท้องทำด้วยอะไรเนี่ย!':a.rank===4?'ผู้ท้า: ฮ่า ๆ ยังไม่อิ่มเลยเหรอ?':'ผู้ท้า: ไว้มากินกันใหม่!',d,'race-taunt');
   const done=element('button','รับทราบ · กลับร้าน',d,'tbtn');done.onclick=complete;done.focus();
   if(a.rank===1&&window.Fireworks)Fireworks.play({count:5,duration:1600});
 }

 /* ---------- วาด ---------- */
 /* ฐาน 4×4 + พื้นที่อาหาร 4×4 บนพื้นทราย — อยู่ในชั้นนิ่งที่แคช (tank-view.js drawChrome) และหน้าร้าน (shop-floor.js) */
 function drawArena(c,project,t){
   t=t||tank();if(!t)return;
   const square=(z,fill,stroke,lw)=>{const pts=[project(z.x-HALF,z.y-HALF),project(z.x+HALF,z.y-HALF),project(z.x+HALF,z.y+HALF),project(z.x-HALF,z.y+HALF)];
     c.beginPath();pts.forEach((p,k)=>k?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();
     if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}};
   c.save();
   /* แถบสนามหน้าตู้ + เส้นขอบหลังสนาม (หลังเส้นนี้ = ที่วางของตกแต่ง) */
   const q=[project(0,0),project(t.def.w,0),project(t.def.w,ARENA_H),project(0,ARENA_H)];
   c.beginPath();q.forEach((p,k)=>k?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle='rgba(196,164,106,.16)';c.fill();
   c.beginPath();c.moveTo(q[3].x,q[3].y);c.lineTo(q[2].x,q[2].y);c.strokeStyle='rgba(120,92,44,.7)';c.lineWidth=2;c.stroke();
   square(pileOf(t),'rgba(120,86,40,.2)','rgba(255,236,190,.6)',1.5);
   bases(t).forEach((b,i)=>square(b,COLORS[i]+'40',COLORS[i]+'d0',2));
   c.restore();
 }
 function foodImage(type){const im=typeof FOOD_IMAGES!=='undefined'&&FOOD_IMAGES[type];return im&&im.complete&&im.naturalWidth?im:null;}
 function drawFoodAt(f,x,y,z,label,scale=1){
   const p=S(x,y,SAND_CELLS+(z||0)),w=depthPxPerCm()*SIZES[f.size].cm*scale,im=foodImage(f.type);
   if(im)tctx.drawImage(im,p.x-w/2,p.y-w*.85,w,w);
   else{tctx.fillStyle='#7cc36b';tctx.beginPath();tctx.ellipse(p.x,p.y-w*.3,w*.45,w*.3,0,0,Math.PI*2);tctx.fill();}
   if(label){
     const fs=Math.max(9,10*tankCam.zoom);tctx.font='bold '+fs.toFixed(0)+'px "IBM Plex Sans Thai",sans-serif';tctx.textAlign='center';tctx.textBaseline='middle';
     const tw=tctx.measureText(f.size).width+8;tctx.fillStyle='rgba(20,40,44,.82)';tctx.beginPath();tctx.roundRect(p.x-tw/2,p.y+1,tw,fs+4,(fs+4)/2);tctx.fill();
     tctx.fillStyle='#ffe7ae';tctx.fillText(f.size,p.x,p.y+3+fs/2);
   }
   return p;
 }
 const glSlugs=()=>!!(engineReady&&window.DecorGLB?.ready&&window.Slug3D?.ready&&Slug3D.enabled);
 function drawSlug(s,e,hop,m){
   s.fx=e.x;s.fy=e.y;s.wall=null;s.climbZ=hop;s._motionHeading=s.dir=s.turn=e.dir;
   s._breedScale=m.size;                         // บัฟตัวใหญ่: ตัววาด 3D/2D อ่านสเกลนี้อยู่แล้ว (ช่องเดียวกับตู้เพาะ)
   s.flip=Math.cos(e.dir)*CELLW+Math.sin(e.dir)*DEPX>0;
   if(glSlugs()&&DecorGLB.drawSlug(s))return;
   const len=TANK_SLUG_VIEW_SCALE*slugCm(s.genes)*m.size*depthPxPerCm(),p=S(e.x,e.y,SAND_CELLS+hop);
   const dir={x:CELLW*Math.cos(e.dir)+DEPX*Math.sin(e.dir),y:-DEPY*Math.sin(e.dir)};
   if(engineReady&&window.Slug3D?.draw(tctx,s,p.x,p.y,len,false,dir))return;
   const P=slugPartsOf(s);if(!P)return;
   const scale=len/(P.bw*P.s),h=P.h*scale;
   drawTankSlug(s,P,scale,p.x-((P.L+P.R)/2-P.bw/2)*P.s*scale,p.y-h*.44,false);
 }
 function nameTag(text,x,y,bg,fg){
   const p=S(x,y,SAND_CELLS),h=Math.max(15,17*tankCam.zoom);
   tctx.save();tctx.font='bold '+Math.max(10,11*tankCam.zoom).toFixed(0)+'px "IBM Plex Sans Thai",sans-serif';tctx.textAlign='center';tctx.textBaseline='middle';
   const w=tctx.measureText(text).width+14;tctx.fillStyle=bg;tctx.beginPath();tctx.roundRect(p.x-w/2,p.y+h*.5,w,h,h/2);tctx.fill();
   tctx.fillStyle=fg;tctx.fillText(text,p.x,p.y+h);tctx.restore();
 }
 function items(){
   const a=state.active,t=tankOf();if(!a||!t)return [];
   const out=a.foods.map(f=>({sortY:f.y,kind:'eat',part:'food',f}));
   bases(t).forEach((b,i)=>out.push({sortY:b.y+HALF*.4,kind:'eat',part:'stash',i}));
   a.entrants.forEach((e,i)=>out.push({sortY:e.y,kind:'eat',part:'slug',i}));
   out.push({sortY:-1e9,kind:'eat',part:'pops'});
   out.push({sortY:-1e9-1,kind:'eat',part:'marker'});
   return out;
 }
 /* ลูกศรกะพริบเหนือหัวเรา "คุณอยู่ตรงนี้" — ตลอดนับถอยหลังและช่วงแรกหลังเริ่ม */
 function drawMarker(a){
   if(a.settled||a.countdown<=0&&a.elapsed>MARKER_T)return;
   const e=a.entrants[0],now=performance.now();
   if(Math.floor(now/260)%2)return;
   const m=mods(e),p=S(e.x,e.y,SAND_CELLS+bodyCells(e.genes,m)*.55+1.1),bounce=Math.sin(now/120)*4*tankCam.zoom;
   const w=Math.max(16,22*tankCam.zoom),h=w*1.05,y=p.y+bounce;
   tctx.save();
   tctx.fillStyle=COLORS[0];tctx.strokeStyle='#3b2a0c';tctx.lineWidth=Math.max(2,3*tankCam.zoom);tctx.lineJoin='round';
   tctx.beginPath();tctx.moveTo(p.x-w/5,y-h*1.75);tctx.lineTo(p.x+w/5,y-h*1.75);tctx.lineTo(p.x+w/5,y-h*1.05);tctx.lineTo(p.x+w/2,y-h*1.05);tctx.lineTo(p.x,y);tctx.lineTo(p.x-w/2,y-h*1.05);tctx.lineTo(p.x-w/5,y-h*1.05);tctx.closePath();
   tctx.stroke();tctx.fill();
   tctx.font='bold '+Math.max(12,14*tankCam.zoom).toFixed(0)+'px "IBM Plex Sans Thai",sans-serif';tctx.textAlign='center';tctx.textBaseline='bottom';
   tctx.lineWidth=4;tctx.strokeText('คุณ',p.x,y-h*1.85);tctx.fillText('คุณ',p.x,y-h*1.85);
   tctx.restore();
 }
 function drawItem(it){
   const a=state.active,t=tankOf();if(!a||!t)return;
   if(it.part==='food'){drawFoodAt(it.f,it.f.x,it.f.y,0,true);return;}
   if(it.part==='marker'){drawMarker(a);return;}
   if(it.part==='stash'){
     const e=a.entrants[it.i],b=bases(t)[it.i],P=pileOf(t);
     /* จานวางด้านที่หันเข้ากลางตู้ ในกรอบฐาน 4×4 */
     const sx=Math.sign(P.x-b.x),sy=Math.sign(P.y-b.y);
     e.stash.forEach((s,k)=>{
       const x=b.x+sx*(1.1-k*.35)+(sx?0:(k-1)*.5),y=b.y+sy*(1.1-k*.2)+(sy?0:(k-1)*.5);
       const p=drawFoodAt(s,x,y,0,false,k?.8:1);
       if(!k&&s.chews>0){const R=Math.max(7,9*tankCam.zoom);tctx.save();tctx.lineWidth=Math.max(3,3.5*tankCam.zoom);
         tctx.strokeStyle='rgba(0,0,0,.45)';tctx.beginPath();tctx.arc(p.x,p.y-R*2.2,R,0,Math.PI*2);tctx.stroke();
         tctx.strokeStyle=COLORS[it.i];tctx.beginPath();tctx.arc(p.x,p.y-R*2.2,R,-Math.PI/2,-Math.PI/2+Math.PI*2*s.chews/SIZES[s.size].chew);tctx.stroke();tctx.restore();}
     });
     return;
   }
   if(it.part==='slug'){
     const e=a.entrants[it.i],s=sprites[it.i];if(!s)return;
     const now=performance.now(),chewing=now-(e.chewAt||0)<260,m=mods(e);
     const hop=0;                                 // แดชติดพื้น ไม่ยกตัว (ท่า 'dash' ของโมเดลเป็นท่ากระโดด จึงใช้ท่าเดินแทน)
     s.state=chewing?'eat':e._moved>.001?'walk':'rest';
     if(e._moved)s.creepT=(s.creepT||0)+e._moved*CM_PER_CELL/(CREEP_BODY_PER_CYCLE*slugCm(e.genes)*m.size)*Math.PI*2;
     s.ph=(s.ph||0)+.02;
     drawSlug(s,e,hop,m);
     if(e.carry){const L=bodyCells(e.genes,m)*.45;drawFoodAt(e.carry,e.x+Math.cos(e.dir)*L,e.y+Math.sin(e.dir)*L,hop+.35,false,.9);}
     nameTag(it.i===0?'คุณ':e.name,e.x,e.y,it.i===0?'#153c42':'rgba(30,20,16,.85)',COLORS[it.i]);
     /* ไอคอนบัฟเหนือหัว (⚡ ⬆ 🌿 ×จำนวนชั้น) */
     const icons=['speed','size','gill'].map(k=>{const n=buffCount(e,k);return n?BUFF_ICON[k]+(n>1?'×'+n:''):'';}).filter(Boolean).join(' ');
     if(icons){const q=S(e.x,e.y,SAND_CELLS+bodyCells(e.genes,m)*.55+.5);tctx.save();tctx.font=Math.max(11,13*tankCam.zoom).toFixed(0)+'px sans-serif';
       tctx.textAlign='center';tctx.textBaseline='bottom';tctx.lineWidth=3;tctx.strokeStyle='#102a2e';tctx.strokeText(icons,q.x,q.y);tctx.fillStyle='#fff3c4';tctx.fillText(icons,q.x,q.y);tctx.restore();}
     return;
   }
   if(it.part==='pops'){
     tctx.save();tctx.textAlign='center';tctx.font='bold '+Math.max(14,18*tankCam.zoom).toFixed(0)+'px "IBM Plex Sans Thai",sans-serif';
     for(const p of pops){const q=S(p.x,p.y,SAND_CELLS+1.2+p.t*1.4);tctx.globalAlpha=Math.max(0,1-p.t);tctx.lineWidth=4;tctx.strokeStyle='#102a2e';tctx.strokeText(p.text,q.x,q.y);tctx.fillStyle=p.color;tctx.fillText(p.text,q.x,q.y);}
     tctx.restore();
   }
 }
 function camera(t){
   const key=TCW+'|'+TCH;if(cameraKey===key)return;cameraKey=key;
   /* กรอบภาพ = ซูมเข้าเฉพาะสนาม (แถบหน้าตู้) + เผื่อหัวจอ (ป้ายเวลา) และล่างจอ (ปุ่ม) · ความสูง +2 เผื่อตัวทาก/ลูกศรแถวหลัง */
   tankCam.zoom=1;tankCam.ox=0;tankCam.oy=0;
   const pts=[S(0,0,SAND_CELLS),S(t.def.w,0,SAND_CELLS),S(0,ARENA_H,SAND_CELLS+2),S(t.def.w,ARENA_H,SAND_CELLS+2)];
   const x0=Math.min(...pts.map(p=>p.x)),x1=Math.max(...pts.map(p=>p.x)),y0=Math.min(...pts.map(p=>p.y)),y1=Math.max(...pts.map(p=>p.y));
   const topPad=70,botPad=TCW<700?150:40;
   const z=clamp(Math.min((TCW-24)/(x1-x0),(TCH-topPad-botPad)/(y1-y0)),.2,4);
   tankCam.zoom=z;tankCam.ox=TCW/2-(x0+x1)/2*z;tankCam.oy=topPad+(TCH-topPad-botPad)/2-(y0+y1)/2*z;tankNeedFit=false;
 }
 function updateHud(t,a){
   const left=Math.max(0,Math.ceil(LIMIT-a.elapsed)),me=a.entrants[0];
   const time=a.countdown>0?'เตรียมตัว':Math.floor(left/60)+':'+String(left%60).padStart(2,'0');
   if(hud.time.textContent!==time)hud.time.textContent=time;
   hud.time.classList.toggle('is-urgent',a.countdown<=0&&!a.settled&&left<=10);
   const base=inBase(me,t),near=!me.carry&&nearestFood(a,me),chewable=base&&me.stash.length>0;
   const nextKey=lastChewKey==='f'?'K':lastChewKey==='k'?'F':'F / K';
   const msg=a.settled?'หมดเวลา!':a.countdown>0?'ลูกศรกะพริบ = ทากของคุณ · ฐานสีเหลือง'
     :chewable?'กด '+nextKey+' สลับกันเพื่อกิน!'
     :me.carry?'ลาก '+kindName(me.carry.type)+' '+me.carry.size+' กลับฐาน'
     :near?'กด F คาบ '+kindName(near.type)+' '+near.size+' (+'+foodPts(near)+')':'ไปที่พื้นที่อาหารกลางตู้';
   if(hud.status.textContent!==msg)hud.status.textContent=msg;
   const big=a.settled?'':a.countdown>0?String(Math.ceil(a.countdown)):a.elapsed<.8?'กิน!':'';
   if(hud.big.textContent!==big){hud.big.textContent=big;hud.big.classList.remove('pop');void hud.big.offsetWidth;if(big)hud.big.classList.add('pop');}
   a.entrants.forEach((e,i)=>{const s=String(e.score);if(hud.rows[i].b.textContent!==s)hud.rows[i].b.textContent=s;});
   const order=a.entrants.map((e,i)=>i).sort((x,y)=>a.entrants[y].score-a.entrants[x].score||x-y);
   order.forEach((i,k)=>{hud.rows[i].li.style.order=String(k);});
   /* ชิปบัฟของเรา: ไอคอน + ชื่อ + วินาทีที่เหลือของชั้นที่หมดช้าสุด */
   const chips=['speed','size','gill'].map(k=>{const list=me.buffs.filter(b=>b.k===k&&b.until>a.elapsed);if(!list.length)return '';
     const pct=Math.round(BUFF_STEP[k]*list.length*100),sec=Math.ceil(Math.max(...list.map(b=>b.until))-a.elapsed);
     return BUFF_ICON[k]+' '+BUFF_NAME[k]+' +'+pct+'% · '+sec+' วิ';}).filter(Boolean);
   const chipKey=chips.join('|');
   if(hud.buffs.dataset.k!==chipKey){hud.buffs.dataset.k=chipKey;hud.buffs.replaceChildren(...chips.map(c=>element('span',c,null,'eat-buff')));}
   const item=me.stash[0];hud.plate.hidden=!item;
   if(item){const Z=SIZES[item.size],txt='จาน: '+kindName(item.type)+' '+item.size+' · เคี้ยว '+item.chews+'/'+Z.chew+' · +'+foodPts(item)+(me.stash.length>1?' · รออีก '+(me.stash.length-1):'');
     if(hud.plateLabel.textContent!==txt)hud.plateLabel.textContent=txt;hud.plateFill.style.width=(item.chews/Z.chew*100)+'%';
     hud.plate.classList.toggle('is-away',!base);}
   const m=mods(me),cost=dashCost(me.genes,m);
   hud.dashFill.style.height=me.gauge+'%';hud.dash.classList.toggle('ready',me.gauge>=cost&&me.dashT<=0);
   hud.bite.disabled=!(me.carry||near);const bl=me.carry?'วาง':'คาบ';if(hud.biteLabel.textContent!==bl)hud.biteLabel.textContent=bl;
   hud.chew.hidden=!chewable;
   for(const k of ['f','k'])hud.chewBtn[k].classList.toggle('next',chewable&&lastChewKey!==k);
 }
 function updateTankFrame(now){
   const a=state.active,t=tankOf();if(!a||!t||!ui||document.hidden)return;
   const dt=Math.max(0,Math.min(.05,(now-(lastFrame||now))/1000));lastFrame=now;
   advance(t,a,dt);
   pops=pops.filter(p=>(p.t+=dt*1.1)<1);
   camera(t);if(ui&&hud.time)updateHud(t,a);
   if(now-lastSave>1000){saveGame();lastSave=now;}
 }

 /* ---------- คีย์บอร์ด ---------- */
 const MOVE_KEYS=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
 function canChew(){const a=state.active,t=tankOf(),me=a?.entrants[0];return !!(me&&t&&!me.carry&&me.stash.length&&inBase(me,t));}
 window.addEventListener('keydown',e=>{
   if(!ui||modal?.open||!state.active||state.active.settled)return;
   e.stopImmediatePropagation();
   if([...MOVE_KEYS,'Space','Escape','KeyF','KeyK'].includes(e.code))e.preventDefault();
   /* ⚠️ 2026-09-17 เดิมแดช = กดทิศเดิมซ้ำ → ต้องปล่อยปุ่มเดิน จังหวะเดินขาด (ผู้เล่นทัก) · ตอนนี้ Space แดช · F คาบ */
   if(MOVE_KEYS.includes(e.code))keys.add(e.code);
   else if(e.repeat)return;                     // กดค้าง = ครั้งเดียว ไม่ให้รัวฟรี
   else if(e.code==='Space')dash(0,null);
   else if(e.code==='KeyF'){if(canChew())chewKey('f');else bite(0);}   // อยู่ในฐานมีของในจาน = F ใช้เคี้ยว · นอกนั้น = คาบ/วาง
   else if(e.code==='KeyK')chewKey('k');
 },true);
 window.addEventListener('keyup',e=>{if(MOVE_KEYS.includes(e.code))keys.delete(e.code);},true);
 window.addEventListener('blur',()=>keys.clear());
 document.addEventListener('visibilitychange',()=>{lastFrame=0;keys.clear();saveGame();});

 /* ask: เปิดหน้ารับคำท้าได้จากคอนโซลตอนเทสต์ — SlugEat.state().offer=SlugEat.makeOffer(); SlugEat.ask() */
 window.SlugEat={purchased,goal,drawChallengers,drawArena,decorOk,ask,makeOffer,state:()=>state,isOpen:()=>!!modal?.open,
   reserved:o=>!!o?.def?.eat&&visitors.some(p=>PEOPLE.includes(p)),
   isEating:t=>!!ui&&!!state.active&&(!t||t.id===state.active.tankId),
   items,drawItem,updateTankFrame,normalSlugs,stepNormal,ARENA_H,speedMul,carryMul,dashCost,mods,SIZES,KINDS};

 /* แมตช์ค้างจากเซฟ: ต้องมีผู้แข่งครบ 4 ไม่งั้นทิ้ง */
 if(!state.active||!Array.isArray(state.active.entrants)||state.active.entrants.length!==4||!Array.isArray(state.active.foods))state.active=null;
 if(owned())purchased();
 resumeReady=true;setInterval(tick,1000);
})();
