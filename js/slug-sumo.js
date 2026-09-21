/* ตู้ดันวง (ซูโม่ทาก) 4 ตัว — ตู้ 100×100 ซม. หนึ่งตู้ต่อร้าน (สเปกผู้เล่น 2026-09-21)
 *
 * โครงเดียวกับ slug-race.js / slug-tug.js / slug-eat.js / slug-throw.js:
 *   ลูกค้า 3 คนมาท้า → โมดอลเลือกทาก+เดิมพัน → เข้าตู้เต็มจอ → ผลแพ้ชนะ
 *   (กฎร่วมของตู้เกมทุกใบอยู่ที่ manual/feature-rules/contest-tanks.md)
 *
 * หัวใจของเกม = ยืม "กฎหลบทาง" ของ tank-view.js มาเป็นกติกาตรง ๆ
 *   ในโลกปกติ ทากที่โดนแตะข้างลำตัวจะเดินตรงไปตามทิศหัวของมันเองเพื่อหลบทาง
 *   ที่นี่จึงชนะด้วยการ "อ่านทิศหัวคู่ต่อสู้ แล้วแตะข้างตอนหัวมันชี้ออกนอกวง" — มันเดินออกไปเอง
 *   แตะตอนหัวมันชี้เข้ากลาง = เท่ากับช่วยมันกลับเข้าวง เสียจังหวะฟรี
 *
 * กติกา
 *   สนาม = แถบหน้าตู้ 100×75 ซม. (ARENA_H) ห้ามวางของตกแต่ง/อาหาร · ในนั้นมีวงกลม Ø65 ซม.
 *   จุดกึ่งกลางตัวพ้นเส้นวงค้าง OUT_GRACE วิ = ตกรอบ · เหลือตัวสุดท้าย = ชนะ
 *   ครบ LIMIT (3 นาที) ยังไม่จบ = คนที่ตกไปแล้วแพ้เรียงตามลำดับที่ตก คนที่ยังอยู่ในวงเสมอกันหมด
 *   WASD/จอย เดิน · Space (หรือปุ่มบนจอ) กดค้าง = ตั้งท่าชาร์จ ปล่อย = พุ่ง
 *
 * ชน 3 แบบ ต่างกันชัด
 *   ข้างลำตัว (|cos| < SIDE_COS แบบเดียวกับ tank-view.js) → เหยื่อ "ยอมหลบ" เดินตรงตามทิศหัวตัวเอง คุมไม่ได้
 *   หัว/ท้าย → ดันกันเฉย ๆ ไม่มีใครเสียการควบคุม
 *   ชนตอนชาร์จ → เวลายอมหลบยาวขึ้น CHARGE_YIELD_MUL เท่า + มีแรงดันทันที
 *
 * ยีน (ตามสเปกผู้เล่น)
 *   จำนวนหงอน → ความเร็วพุ่ง · ขนาดหงอน → ระยะเวลาพุ่ง (และค่าเกจ)
 *   ตัวยาว = ด้านข้างยาว โดนแตะง่าย (ชนวัดจากแกนลำตัวแบบแคปซูล ไม่ใช่วงกลม)
 *   แลกกับมวลมาก โดนดันไปน้อย · ตัวเล็กเดินเร็ว โดนยาก แต่โดนทีเดียวปลิวไกล
 *   หงอนใหญ่พุ่งนาน = เลี้ยวไม่ทัน เสี่ยงพุ่งตกเวทีเอง (ตัวถ่วงไม่ให้หงอนใหญ่กินรวบ)
 */
(()=>{
 'use strict';
 const MINUTE=60000;
 const LIMIT=180, COUNTDOWN=3;                 // ⚙️ เวลาแข่ง (วินาที) · หมดเวลา = คนในวงเสมอกัน
 /* ⚙️ สนาม — แถบหน้าตู้แบบเดียวกับตู้แข่งกินจุ (ห้ามวางของ) · หลังสนามเหลือ 25 ซม. ไว้แต่งตู้
    วงกลมรัศมี RING_R ช่อง (1 ช่อง = 5 ซม.) จุดศูนย์กลางอยู่กลางความกว้างตู้ ที่ความลึก RING_CY */
 const ARENA_H=15, RING_R=6.5, RING_CY=7.5;
 const OUT_GRACE=.4;                           // ⚙️ พ้นเส้นค้างกี่วินาทีถึงตกรอบ (มีจังหวะเฉียดขอบให้ลุ้น)
 const WALK=3.0;                               // ช่อง/วิ ที่ตัวคูณ 1 (= 15 ซม./วิ · ข้ามวงราว 4 วิ)
 const TURN_WALK=11, TURN_CHARGE=1.5;          // ความไวเลี้ยวพื้นฐาน — ตอนพุ่งแทบเลี้ยวไม่ได้ (ตัวเล็กเลี้ยวไวกว่า ดู turnRate)
 const WIND_T=.55, WIND_SLOW=.38;              // ตั้งท่าเต็มที่กี่วินาที · ตอนตั้งท่าเดินช้าลงเหลือเท่านี้
 const CHARGE_SPD_MIN=1.7, CHARGE_SPD_MAX=3.2; // ⚙️ ตัวคูณความเร็วพุ่ง ← จำนวนหงอน
 const CHARGE_T_MIN=.35, CHARGE_T_MAX=1.0;     // ⚙️ ระยะเวลาพุ่ง (วิ) ← ขนาดหงอน
 const GAUGE_REGEN=17, COST_MIN=26, COST_MAX=46;
 /* ⚙️ ยอมหลบ = เดินตรงตามทิศหัวตัวเอง คุมตัวไม่ได้กี่วินาที
    ปรับตามมวล: ตัวใหญ่ชนตัวเล็ก = ยาว · ตัวเล็กชนตัวใหญ่ = สั้น */
 const YIELD_BASE=1.0, YIELD_MIN=.4, YIELD_MAX=3.0, CHARGE_YIELD_MUL=1.9, YIELD_SPD=1.25;
 const YIELD_GRACE=.3;                         // พ้นสภาพยอมหลบแล้วกันโดนซ้ำทันทีอีกเท่านี้
 const SHOVE=.42;                              // ระยะดันทันที (ช่อง) เฉพาะตอนผู้ชนกำลังพุ่ง
 const SIDE_COS=.55;                           // เกณฑ์ "โดนแตะข้าง" — ค่าเดียวกับ tank-view.js
 const HEAD_AT=.58;                            // จุดสัมผัสต้องอยู่ค่อนไปทางหัวของผู้ชน (0 ท้าย … 1 หัว)
 const HIT_GAP=.42;                            // คูลดาวน์ต่อคู่ กันนับชนซ้ำทุกเฟรม
 const MARKER_T=2.5;                           // ลูกศร "คุณอยู่ตรงนี้" กะพริบตลอดนับถอยหลัง + 2.5 วิแรก
 const COLORS=['#ffd36b','#ff8a7a','#7fd4ff','#c3a6ff'];
 const names=['ดันสู้','ล้มยักษ์','เบียดขอบ','เขาชน','หงอนเหล็ก','ตีนติดพื้น','ลมกรด','ผลักเก่ง'];

 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const g01=(g,k)=>clamp(Number.isFinite(g[k])?g[k]:50,0,100)/100;
 const gillCnt01=g=>clamp(((typeof gillCount==='function'?gillCount(g):5)-2)/7,0,1);
 const size01=g=>clamp((slugCm(g)-6)/4,0,1);
 /* ตัวคูณเดิน: ตัวเล็กเร็ว · หงอนใหญ่ช้า · หงอนเยอะเร็ว (ทิศทางเดียวกับตู้แข่งกินจุ)
    ⚠️ 2026-09-21 จำลอง 6 แมตช์แล้วตัวใหญ่ชนะรวด (ผู้ชนะยาว 8.7–10.0 ซม. จากพิสัย 6–10)
       ช่องว่างความเร็วเดิม (1.30−0.45) แคบเกินกว่าจะชดเชย "โดนดันไปน้อยเพราะหนัก" ได้ */
 const speedMul=g=>clamp(1.45-.60*size01(g)-.25*g01(g,'gillLen')+.30*gillCnt01(g),.5,1.7);
 /* ตัวเล็กเลี้ยวไว = หันหนีจากขอบวงและหันหัวหนีการโดนแตะข้างได้ทันกว่า (อีกทางให้ตัวเล็กมีที่ยืน) */
 const turnRate=g=>TURN_WALK*(1.3-.55*size01(g));
 const chargeSpeed=g=>CHARGE_SPD_MIN+(CHARGE_SPD_MAX-CHARGE_SPD_MIN)*gillCnt01(g);
 const chargeTime=g=>CHARGE_T_MIN+(CHARGE_T_MAX-CHARGE_T_MIN)*g01(g,'gillLen');
 /* ค่าเกจ: หงอนใหญ่ (พุ่งนาน) แพงกว่า · ตัวใหญ่แบกน้ำหนักมากก็แพงกว่า ตัวเล็กจึงชาร์จได้ถี่กว่า */
 const chargeCost=g=>Math.round((COST_MIN+(COST_MAX-COST_MIN)*g01(g,'gillLen'))*(.85+.3*size01(g)));
 const mass=g=>.55+.95*size01(g);
 /* ความยาวที่วาดจริง (ช่อง) — ใช้เป็นแกนลำตัวสำหรับการชนด้วย ตัวยาวจึงมีด้านข้างให้แตะยาวกว่า */
 const bodyCells=g=>TANK_SLUG_VIEW_SCALE*slugCm(g)/CM_PER_CELL*1.6;
 const halfLen=g=>bodyCells(g)*.40;
 const halfWid=g=>.24+.14*size01(g);
 const cmPerSec=g=>(WALK*speedMul(g)*CM_PER_CELL).toFixed(1);

 let state=G.sumo;
 if(!state||typeof state!=='object'||!Number.isFinite(state.nextAt))state={purchased:false,nextAt:0,offer:null,active:null};
 G.sumo=state;
 let visitors=[],modal=null,ui=null,lastFrame=0,lastSave=0,cameraKey='',resumeReady=false,offerDeadline=0;
 let sprites=[],pops=[];
 let keys=new Set(),joy={x:0,y:0,id:null},holding=false;
 let hud={};

 const tank=()=>G.objs.find(o=>o.def.sumo&&o!==moving);
 const owned=()=>[...G.objs,...G.shelter].some(o=>o.def.sumo);
 const tankOf=()=>G.objs.find(o=>o.id===state.active?.tankId);
 const ringC=t=>({x:t.def.w/2,y:RING_CY});
 const distC=(t,e)=>Math.hypot(e.x-t.def.w/2,e.y-RING_CY);
 /* จุดเริ่ม 4 ตัว = สี่ทิศรอบวง ห่างจากศูนย์กลาง 62% ของรัศมี · [0] = เรา อยู่หน้าสุดใกล้กล้อง */
 function starts(t){
   const c=ringC(t),r=RING_R*.62;
   return [{x:c.x,y:c.y-r},{x:c.x+r,y:c.y},{x:c.x,y:c.y+r},{x:c.x-r,y:c.y}];
 }
 /* ของตกแต่งห้ามอยู่ในแถบสนาม (ขอบหน้าตู้ → ARENA_H) — bounds = decorRequiredBounds (tank-view.js canPlaceDecor) */
 function decorOk(t,keyset,bounds){
   if(!bounds||bounds.top<ARENA_H)return false;
   for(const k of keyset||[])if((Number(k.split(',')[1])+.5)*DCELL<ARENA_H)return false;
   return true;
 }
 /* ทากที่ไม่ได้ลงแข่ง: เดินเล่นตามปกติแต่อยู่หลังสนามเท่านั้น (แบบตู้แข่งกินจุ) */
 function normalSlugs(t){const id=state.active?.entrants?.[0]?.id;return t.slugs.filter(s=>s.id!==id);}
 function stepNormal(slugs,dt){
   const t=tankOf();if(!t)return;
   stepTankSlugs(slugs,t.def.w,t.def.h,dt,true,t.decor,t.def);
   for(const s of slugs){const min=ARENA_H+slugCm(s.genes)/CM_PER_CELL*.55;if(s.fy<min){s.fy=min;if(s.state==='walk'){s.state='rest';s.stt=1;}}s.wall=null;s.climbZ=0;}
 }

 /* ---------- ลูกค้ามาท้า (ยกแบบ slug-eat.js — ที่นี่ 3 คน) ---------- */
 function purchased(){if(!state.purchased){state.purchased=true;state.nextAt=Date.now()+5*MINUTE;saveGame();}}
 const gap=()=>ShopEvents.gap();                // 20–45 นาที ใช้ค่าเดียวกันทุกตู้ (config.js)
 function makeOffer(){
   const pool=names.slice().sort(()=>Math.random()-.5);
   return {rivals:[0,1,2].map(i=>({name:pool[i],genes:SlugEngine.randGene(),aggr:.35+Math.random()*.5,care:.25+Math.random()*.6}))};
 }
 function leave(){
   for(const p of visitors){p.sumoChallenger=false;p.family=null;p.tradeDone=true;p.visits=0;p.strolls=0;
     p.focus=null;p.route=[];p.routeGoal=null;p.tgt=doorSpot();p.state='leave';p.stuck=0;}
   visitors=[];offerDeadline=0;
 }
 function goal(p){
   const t=tank();
   if(!t||!state.offer){p.sumoChallenger=false;p.visits=0;p.strolls=0;return false;}
   const spot=freeSpot(lookSpots(t),p);
   if(spot){p.focus=t;p.tgt=spot;p.state='walk';p.route=[];p.routeGoal=null;p.stuck=0;return true;}
   p.focus=null;p.tgt=strollSpot(p);p.state='walk';return true;
 }
 function spawn(){
   if(visitors.length||!peopleOn||!tank()||document.hidden||tankMode||window.BOOTING)return;
   if(!ShopEvents.ready())return;                 // ตู้อื่นเพิ่งส่งคำท้ามา รออีกพัก (config.js EVENT_SPACING)
   const capacity=challengerRoom();if(capacity<3)return;
   const previous=new Set(PEOPLE),gender=()=>Math.random()<.5?'female':'male';
   if(!spawnVisitors(capacity,'sumo',[0,1,2].map(()=>({kid:false,gender:gender()}))))return;
   visitors=PEOPLE.filter(p=>!previous.has(p));ShopEvents.mark();
   if(!state.offer){state.offer=makeOffer();state.nextAt=Date.now()+gap();saveGame();}
   visitors.forEach((p,i)=>{
     const r=state.offer.rivals[i%3];
     p.family=null;p.sumoChallenger=true;p.wantsBuy=false;p.wantsSell=false;p.tradeDone=true;
     p.carryTank=true;p.carryColor='#6a4f7a';p.carryAccent=slugBaseHex(r.genes);
     if(typeof makeSlug==='function')p.carrySlug=makeSlug(r.genes);
     p.bagged=false;p.accessory='none';p.visits=1;p.strolls=0;goal(p);
   });
   offerDeadline=Date.now()+5*MINUTE;
   toast('⭕ มีคนมาท้าดันวง! คลิกคนถือตู้เพื่อรับคำท้า','good');
 }
 /* นับนัดหน้า "หลังจบเรื่องนี้" ไม่ใช่ตอนผู้ท้าเข้าร้าน (กฎร่วมของทุกตู้) */
 function reschedule(){state.nextAt=Date.now()+gap();}
 function dismiss(){state.offer=null;leave();close();reschedule();saveGame();}
 function tick(){
   if(owned())purchased();
   practiceSync();
   if(state.active){if(resumeReady&&!modal&&!ui&&!window.BOOTING)openMatch();return;}
   if(!tank()){if(state.offer){state.offer=null;leave();if(modal)close();saveGame();}return;}
   if(visitors.length&&!visitors.every(p=>PEOPLE.includes(p)))leave();
   if(offerDeadline&&Date.now()>offerDeadline&&!modal){dismiss();return;}
   if(state.purchased&&Date.now()>=state.nextAt||state.offer)spawn();
 }

 /* ---------- DOM ---------- */
 function element(tag,text,parent,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;if(parent)parent.append(e);return e;}
 function dialog(title){
   modal=element('dialog');modal.className='slug-race-dialog slug-sumo-dialog';modal.setAttribute('aria-label',title);
   modal.addEventListener('cancel',e=>{e.preventDefault();if(!state.active)dismiss();});
   modal.addEventListener('lightdismiss',e=>{if(!state.active){e.preventDefault();close();}});
   element('h2',title,modal);document.body.append(modal);modal.showModal();return modal;
 }
 function close(){
   modal?.close();modal?.remove();modal=null;
   ui?.remove();ui=null;hud={};document.body.classList.remove('sumo-in-tank');
   keys.clear();joy={x:0,y:0,id:null};holding=false;lastFrame=0;cameraKey='';pops=[];
 }

 /* ---------- ป้าย "คลิกเพื่อแข่ง" เหนือหัวผู้ท้า ---------- */
 function drawChallengers(){
   if(!state.offer||!visitors.length)return;
   const label='⭕ ดันวง 4 ตัว · คลิกรับคำท้า';
   ctx.save();ctx.font='bold 13px "IBM Plex Sans Thai",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   const boxW=ctx.measureText(label).width+32,boxH=31,glow=.55+.35*(.5+.5*Math.sin(performance.now()/260));
   visitors.forEach(p=>{
     if(!personOnScreen(p))return;
     const b=personScreenBounds(p),x=clamp((b.x0+b.x1)/2,boxW/2+4,CW-boxW/2-4),y=clamp(b.y0-boxH/2-10,boxH/2+4,CH-boxH/2-4);
     ctx.beginPath();ctx.roundRect(x-boxW/2,y-boxH/2,boxW,boxH,boxH/2);
     ctx.fillStyle='rgba(38,26,44,.92)';ctx.fill();ctx.lineWidth=1.4;ctx.strokeStyle='rgba(231,198,123,'+glow+')';ctx.stroke();
     ctx.fillStyle='#ffe1a0';ctx.fillText(label,x,y+1);
     p._sumoHit={x0:x-boxW/2,x1:x+boxW/2,y0:y-boxH/2,y1:y+boxH/2};
   });
   ctx.restore();
 }
 function hitTest(e){
   if(tankMode||appMode!=='view'||moving||buyKey||modal||!state.offer||state.active)return false;
   const {sx,sy}=screenXY(e);
   return visitors.some(p=>{const h=p._sumoHit;return personOnScreen(p)&&(personHitTest(p,sx,sy)||(h&&sx>=h.x0&&sx<=h.x1&&sy>=h.y0&&sy<=h.y1));});
 }
 let pressedVisitor=false;
 cv.addEventListener('pointerdown',e=>{if(e.button===0&&hitTest(e)){pressedVisitor=true;e.preventDefault();e.stopImmediatePropagation();}},true);
 cv.addEventListener('pointerup',e=>{if(pressedVisitor){pressedVisitor=false;e.preventDefault();e.stopImmediatePropagation();if(hitTest(e))ask();}},true);
 cv.addEventListener('pointercancel',()=>{pressedVisitor=false;},true);

 /* ---------- โมดอลรับคำท้า ---------- */
 const slugNote=g=>'เดิน '+cmPerSec(g)+' ซม./วิ · พุ่ง ×'+chargeSpeed(g).toFixed(1)+' นาน '+chargeTime(g).toFixed(2)+' วิ';
 function ask(){
   if(modal||!state.offer||!tank()||state.active)return;
   const t=tank(),rivals=state.offer.rivals;
   const d=dialog('⭕ ดันวง 4 ตัว');
   element('p',rivals.map(r=>r.name).join(' · ')+' ขอท้าดันวง ยาวสุด '+(LIMIT/60)+' นาที',d);
   const row=element('div',null,d,'sumo-rivals');
   for(const r of rivals){const cell=element('div',null,row,'sumo-rival');const c=element('canvas',null,cell);c.width=150;c.height=90;c.setAttribute('aria-hidden','true');
     try{drawSlugPortrait(c,{genes:r.genes});}catch(_){}element('b',r.name,cell);element('small',slugNote(r.genes),cell);}
   element('p','ชนเข้า "ข้างลำตัว" คู่ต่อสู้ = มันจะเดินตรงไปตามทิศหัวของมันเอง คุมตัวไม่ได้ชั่วครู่ — แตะตอนหัวมันชี้ออกนอกวง มันจะเดินออกไปเอง · ชนหัวชนท้าย = ดันกันเฉย ๆ',d,'sumo-rule');
   element('p','กด Space ค้าง = ตั้งท่าชาร์จ ปล่อย = พุ่ง · จำนวนหงอนกำหนดความเร็วพุ่ง ขนาดหงอนกำหนดระยะเวลาพุ่ง · ระหว่างพุ่งเลี้ยวแทบไม่ได้ ระวังพุ่งตกเวทีเอง',d,'sumo-rule');
   element('p','จุดกึ่งกลางตัวพ้นเส้นวงค้าง '+OUT_GRACE+' วิ = ตกรอบ · หมดเวลาแล้วคนที่ยังอยู่ในวงเสมอกัน',d,'sumo-rule');
   element('p','เลือกทากในตู้ดันวง',d);
   let picked=t.slugs[0]?.id||null;
   SlugHover.cards(element('div',null,d),{slugs:t.slugs,selected:picked,empty:'ยังไม่มีทากในตู้ดันวง',
     sub:s=>slugNote(foodGenes(s)),onPick:s=>{picked=s.id;}});
   const betLabel=element('label','เดิมพัน (ทอง) — ยังไม่หักตอนเริ่ม',d),bet=element('input',null,betLabel);
   const maxBet=Math.max(0,Math.min(1000,Math.floor(G.coin)));
   bet.type='number';bet.min='0';bet.max=String(maxBet);bet.step='1';bet.value='0';
   const quick=element('div',null,d,'race-bet-quick');
   const pickBet=v=>{bet.value=String(v);for(const b of quick.children)b.setAttribute('aria-pressed',String(+b.dataset.v===v));};
   const presets=[['ไม่เดิมพัน',0],...[100,300,500].filter(v=>v<maxBet).map(v=>[String(v),v])];
   if(maxBet>0)presets.push(['สูงสุด '+maxBet.toLocaleString(),maxBet]);
   for(const [label,v] of presets){const b=element('button',label,quick,'tbtn');b.type='button';b.dataset.v=String(v);b.setAttribute('aria-pressed',String(v===0));b.onclick=()=>pickBet(v);}
   bet.addEventListener('input',()=>{for(const b of quick.children)b.setAttribute('aria-pressed',String(+b.dataset.v===+bet.value));});
   element('p','ที่ 1 ได้ 2 เท่าของเดิมพัน · ที่ 2 เท่าทุน · ที่ 3 เสียครึ่ง · ที่ 4 เสียเต็ม · เสมอ = เท่าทุน',d,'sumo-rule');
   const error=element('p','',d);error.setAttribute('role','alert');
   const start=element('button','เริ่มแข่ง',d,'tbtn');start.disabled=!t.slugs.length;
   if(!t.slugs.length)error.textContent='ยังไม่มีทากในตู้ดันวง ย้ายทากเข้าตู้ก่อนรับคำท้า';
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
 function makeEntrant(t,slot,o){
   const p=starts(t)[slot],c=ringC(t);
   return {slot,x:p.x,y:p.y,dir:Math.atan2(c.y-p.y,c.x-p.x),gauge:100,windT:0,dashT:0,yieldT:0,graceT:0,
     outT:0,out:false,outAt:null,think:0,...o};
 }
 function newMatch(t,list,extra){
   return {tankId:t.id,elapsed:0,countdown:COUNTDOWN,settled:false,outOrder:[],hits:{},wager:0,...extra,
     entrants:list};
 }
 /* ---------- โหมดซ้อม: คู่ซ้อมคือทากในตู้ที่ผู้เล่นเลือกเอง ไม่มีเดิมพัน (slug-practice.js) ---------- */
 function practiceSync(){
   const t=tank();
   if(typeof SlugPractice==='undefined')return;
   SlugPractice.sync('sumo',!!t&&tankMode&&curTank===t&&!state.active&&!modal?.open,'⭕ ซ้อมดันวง',()=>{
     SlugPractice.pick({tank:t,title:'⭕ ซ้อมดันวง',need:3,
       noteFor:s=>slugNote(foodGenes(s)),
       onStart:(mine,others)=>beginPractice(t,mine,others)});
   });
 }
 function botBrain(){return {bot:true,aggr:.35+Math.random()*.5,care:.25+Math.random()*.6};}
 function beginPractice(t,s,others){
   const list=[makeEntrant(t,0,{name:slugNick(s),id:s.id,genes:{...foodGenes(s)}}),
     ...others.map((o,i)=>makeEntrant(t,i+1,{name:slugNick(o),genes:{...foodGenes(o)},...botBrain()}))];
   state.active=newMatch(t,list,{practice:true});saveGame();close();openMatch();
 }
 function begin(t,s,wager){
   const list=[makeEntrant(t,0,{name:slugNick(s),id:s.id,genes:{...foodGenes(s)}}),
     ...state.offer.rivals.map((r,i)=>makeEntrant(t,i+1,{name:r.name,genes:{...r.genes},bot:true,aggr:r.aggr,care:r.care}))];
   state.active=newMatch(t,list,{wager});saveGame();close();openMatch();
 }
 function openMatch(){
   const a=state.active,t=tankOf();if(!a||modal||ui)return;
   if(!t||!t.slugs.some(s=>s.id===a.entrants[0].id)){state.active=null;state.offer=null;leave();saveGame();return;}   // ทากเราหายไประหว่างทาง = ยกเลิก
   pops=[];
   sprites=a.entrants.map((e,i)=>i===0?t.slugs.find(s=>s.id===e.id):{id:'sumo-bot-'+i,genes:e.genes,state:'rest',ph:i*1.3,noBob:true,creepT:0});
   ui=element('div');ui.id='sumoTankHUD';document.body.classList.add('sumo-in-tank');
   enterTank(t);ov.querySelector('.ov-body').append(ui);
   document.getElementById('ovTitle').textContent='⭕ ดันวง';
   buildHud(a);
   resizeTank();lastFrame=0;cameraKey='';
   if(a.settled)showResult();
 }
 function buildHud(a){
   const top=element('div',null,ui,'sumo-top');
   hud.time=element('div','',top,'sumo-time');hud.time.setAttribute('role','timer');
   hud.status=element('div','',top,'sumo-status');hud.status.setAttribute('role','status');
   hud.board=element('ol',null,ui,'sumo-board');
   hud.rows=a.entrants.map((e,i)=>{const li=element('li',null,hud.board,i===0?'is-me':'');li.style.setProperty('--c',COLORS[i]);
     element('i',null,li);element('span',i===0?'คุณ':e.name,li);const b=element('b','',li);return {li,b};});
   hud.big=element('div','',ui,'sumo-bigcount');hud.big.setAttribute('aria-hidden','true');
   hud.hint=element('div','WASD เดิน · Space กดค้างตั้งท่า ปล่อยเพื่อพุ่ง · แตะข้างลำตัวคู่ต่อสู้ตอนหัวมันชี้ออกนอกวง',ui,'sumo-hint');
   const controls=element('div',null,ui,'sumo-controls');
   const stick=element('div',null,controls,'sumo-stick');hud.knob=element('i',null,stick);
   stick.setAttribute('aria-hidden','true');
   bindStick(stick);
   const right=element('div',null,controls,'sumo-buttons');
   hud.charge=element('button',null,right,'sumo-btn sumo-charge');hud.charge.type='button';
   element('b','ชาร์จ',hud.charge);element('small','Space',hud.charge,'sumo-key');hud.chargeFill=element('i',null,hud.charge);
   hud.charge.onpointerdown=e=>{e.preventDefault();hud.charge.setPointerCapture?.(e.pointerId);windStart(0);};
   const up=e=>{e.preventDefault();windRelease(0);};
   hud.charge.onpointerup=up;hud.charge.onpointercancel=up;hud.charge.onpointerleave=e=>{if(state.active?.entrants[0]?.windT)windRelease(0);};
 }
 function bindStick(stick){
   const move=e=>{const r=stick.getBoundingClientRect(),R=r.width/2,dx=e.clientX-(r.left+R),dy=e.clientY-(r.top+R),d=Math.hypot(dx,dy),k=d>R?R/d:1;
     joy.x=dx*k/R;joy.y=dy*k/R;hud.knob.style.transform='translate('+(joy.x*R*.6)+'px,'+(joy.y*R*.6)+'px)';};
   stick.addEventListener('pointerdown',e=>{e.preventDefault();joy.id=e.pointerId;stick.setPointerCapture(e.pointerId);move(e);});
   stick.addEventListener('pointermove',e=>{if(e.pointerId===joy.id)move(e);});
   const end=e=>{if(e.pointerId!==joy.id)return;joy={x:0,y:0,id:null};hud.knob.style.transform='';};
   stick.addEventListener('pointerup',end);stick.addEventListener('pointercancel',end);
 }

 /* ---------- ท่าชาร์จ ---------- */
 const chargeCap=makePressLimiter();        // เพดาน 20 ครั้ง/วิ (config.js) กันมาโครรัวท่าชาร์จ
 function windStart(i){
   const a=state.active;if(!a||a.settled||a.countdown>0)return false;
   const e=a.entrants[i];if(!e||e.out||e.windT>0||e.dashT>0||e.yieldT>0)return false;
   if(e.gauge<chargeCost(e.genes))return false;
   if(!e.bot&&!chargeCap())return false;
   e.windT=.0001;return true;
 }
 function windRelease(i){
   const a=state.active;if(!a)return false;
   const e=a.entrants[i];if(!e||!e.windT)return false;
   const power=Math.min(1,e.windT/WIND_T);e.windT=0;
   if(power<.22)return false;                                  // แตะเบา ๆ = ยกเลิก ไม่เสียเกจ
   const cost=chargeCost(e.genes);
   if(e.out||e.yieldT>0||e.gauge<cost)return false;
   e.gauge-=cost;e.dashT=chargeTime(e.genes)*(.5+.5*power);e.dashMax=e.dashT;
   return true;
 }

 /* ---------- ฟิสิกส์ ---------- */
 /* ทิศบนจอ → ทิศบนพื้นตู้ (ภาพเฉียง) — จอยมือถือใช้ทิศบนจอ ส่วนปุ่มผูกกับแกนพื้นตรง ๆ (แบบ slug-eat.js) */
 function screenToFloor(sx,sy){
   const Y=-sy/DEPY,X=(sx-Y*DEPX)/CELLW,d=Math.hypot(X,Y);
   return d>1e-6?{x:X/d,y:Y/d,m:Math.min(1,Math.hypot(sx,sy))}:{x:0,y:0,m:0};
 }
 function inputDir(){
   if(joy.id!=null&&Math.hypot(joy.x,joy.y)>.18)return screenToFloor(joy.x,joy.y);
   let fx=0,fy=0;
   if(keys.has('KeyA')||keys.has('ArrowLeft'))fx--;if(keys.has('KeyD')||keys.has('ArrowRight'))fx++;
   if(keys.has('KeyW')||keys.has('ArrowUp'))fy++;if(keys.has('KeyS')||keys.has('ArrowDown'))fy--;
   const d=Math.hypot(fx,fy);
   return d>1e-6?{x:fx/d,y:fy/d,m:1}:{x:0,y:0,m:0};
 }
 /* กันเฉพาะขอบสนาม — ของตกแต่งไม่มีทางอยู่ในสนาม (decorOk) และไม่ถูกใช้เป็นสิ่งกีดขวางระหว่างแข่ง
    ⚠️ เส้นวงไม่ใช่กำแพง ทุกตัวเดินออกนอกวงได้ นั่นคือทั้งหมดของเกมนี้ */
 const bandBlocked=(t,x,y,r)=>x<r||y<r||x>t.def.w-r||y>ARENA_H-r;
 function moveEnt(t,e,vx,vy,dt){
   const r=halfWid(e.genes)+.05,nx=e.x+vx*dt,ny=e.y+vy*dt;
   let mx=e.x,my=e.y;
   if(!bandBlocked(t,nx,ny,r)){mx=nx;my=ny;}
   else if(!bandBlocked(t,nx,e.y,r))mx=nx;
   else if(!bandBlocked(t,e.x,ny,r))my=ny;
   e._vx=(mx-e.x)/Math.max(dt,1e-4);e._vy=(my-e.y)/Math.max(dt,1e-4);
   e._moved=Math.hypot(mx-e.x,my-e.y);e.x=mx;e.y=my;
 }
 function shoveTo(t,e,x,y){
   const r=halfWid(e.genes)+.05;
   if(!bandBlocked(t,x,e.y,r))e.x=x;
   if(!bandBlocked(t,e.x,y,r))e.y=y;
 }
 function steer(e,want,dt,rate){
   const turn=Math.atan2(Math.sin(want-e.dir),Math.cos(want-e.dir));
   e.dir+=turn*Math.min(1,dt*rate);
 }
 function speedOf(e){
   const v=WALK*speedMul(e.genes);
   /* ⚠️ ตอนยอมหลบใช้ความเร็วกลางของสนาม ไม่ใช่ความเร็วของตัวเอง
      ไม่งั้นตัวเล็ก (เดินเร็ว) จะถูกดันไปไกลกว่าตัวใหญ่ทั้งที่โดนแรงเท่ากัน = โดนลงโทษซ้ำสอง */
   if(e.yieldT>0)return WALK*YIELD_SPD;
   if(e.dashT>0)return v*chargeSpeed(e.genes);
   if(e.windT>0)return v*WIND_SLOW;
   return v;
 }
 /* แกนลำตัว (ท้าย → หัว) — ตัวยาวได้แกนยาวกว่า จึงมีด้านข้างให้แตะมากกว่า */
 function axis(e){
   const h=halfLen(e.genes),cx=Math.cos(e.dir)*h,cy=Math.sin(e.dir)*h;
   return {ax:e.x-cx,ay:e.y-cy,bx:e.x+cx,by:e.y+cy};
 }
 /* ระยะสั้นสุดระหว่างแกนลำตัวสองตัว + ตำแหน่งจุดสัมผัสบนแต่ละแกน (0 = ท้าย, 1 = หัว) */
 function axisGap(p,q){
   const ux=p.bx-p.ax,uy=p.by-p.ay,vx=q.bx-q.ax,vy=q.by-q.ay,wx=p.ax-q.ax,wy=p.ay-q.ay;
   const a=ux*ux+uy*uy,b=ux*vx+uy*vy,c=vx*vx+vy*vy,d=ux*wx+uy*wy,ee=vx*wx+vy*wy,D=a*c-b*b;
   let s,tt;
   if(D<1e-9){s=0;tt=c>1e-9?ee/c:0;}
   else{s=(b*ee-c*d)/D;tt=(a*ee-b*d)/D;}
   s=clamp(s,0,1);tt=clamp(tt,0,1);
   const px=p.ax+ux*s,py=p.ay+uy*s,qx=q.ax+vx*tt,qy=q.ay+vy*tt;
   return {d:Math.hypot(qx-px,qy-py),s,t:tt,px,py,qx,qy};
 }
 /* ผู้ชน (atk) เอาหัวแตะเข้าที่ตัว vic — คืน true ถ้าทำให้ vic "ยอมหลบ" ได้
    ux,uy = ทิศจากจุดสัมผัสของ atk ไปหาจุดสัมผัสของ vic */
 function tryBump(t,a,atk,vic,ux,uy,headAt){
   if(headAt<HEAD_AT)return false;                                   // จุดสัมผัสไม่ใช่ด้านหัวของผู้ชน
   if(vic.yieldT>0||vic.graceT>0)return false;
   if(((atk._vx||0)*ux+(atk._vy||0)*uy)<=.05)return false;            // ไม่ได้เคลื่อนเข้าหา = แค่ถูกตัวกัน
   const side=Math.abs(Math.cos(vic.dir)*ux+Math.sin(vic.dir)*uy);
   const charging=atk.dashT>0;
   if(side>=SIDE_COS){                                                // ชนหัว/ท้าย = ดันกันเฉย ๆ
     if(charging)pops.push({x:vic.x,y:vic.y,text:'กันไว้ได้!',color:'#cfe3d8',t:0});
     return false;
   }
   const ratio=clamp(Math.sqrt(mass(atk.genes)/mass(vic.genes)),.72,1.45);   // เพดานความได้เปรียบของตัวหนัก
   vic.yieldT=clamp(YIELD_BASE*ratio*(charging?CHARGE_YIELD_MUL:1),YIELD_MIN,YIELD_MAX);
   vic.windT=0;                                                       // โดนดันแล้วท่าชาร์จหลุด
   if(charging)shoveTo(t,vic,vic.x+ux*SHOVE*ratio,vic.y+uy*SHOVE*ratio);
   const out=Math.cos(vic.dir)*(vic.x-t.def.w/2)+Math.sin(vic.dir)*(vic.y-RING_CY);
   pops.push({x:vic.x,y:vic.y,text:charging?'ชาร์จเข้าข้าง!':'แตะข้าง!',color:COLORS[atk.slot],t:0});
   if(out>0&&distC(t,vic)>RING_R*.55)pops.push({x:vic.x,y:vic.y,text:'หัวชี้ออก!',color:'#ff8a7a',t:.25});
   return true;
 }
 function contacts(t,a){
   const list=a.entrants.filter(e=>!e.out);
   for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
     const A=list[i],B=list[j],near=axisGap(axis(A),axis(B));
     const gap=halfWid(A.genes)+halfWid(B.genes);
     if(near.d>gap)continue;
     let ux=near.qx-near.px,uy=near.qy-near.py,dd=Math.hypot(ux,uy);
     if(dd<1e-4){ux=B.x-A.x;uy=B.y-A.y;dd=Math.hypot(ux,uy)||1e-4;}
     ux/=dd;uy/=dd;
     /* แยกตัวไม่ให้ซ้อนกัน คนละครึ่งของระยะที่ทับ */
     const push=(gap-near.d)/2;
     shoveTo(t,A,A.x-ux*push,A.y-uy*push);
     shoveTo(t,B,B.x+ux*push,B.y+uy*push);
     const key=A.slot+'-'+B.slot;
     if((a.hits[key]||0)>a.elapsed)continue;
     if(tryBump(t,a,A,B,ux,uy,near.s)||tryBump(t,a,B,A,-ux,-uy,near.t))a.hits[key]=a.elapsed+HIT_GAP;
   }
 }

 /* ---------- บอท ----------
    ใช้กฎเดียวกับผู้เล่นทุกข้อ (เดิน เลี้ยว ตั้งท่า ปล่อยพุ่ง เกจ) ต่างกันแค่ค่านิสัย aggr/care */
 function botAim(t,a,e){
   const c=ringC(t),mine=distC(t,e);
   if(mine>RING_R*(.60+.22*e.care))return {x:c.x,y:c.y,mode:'home'};   // ใกล้ขอบเกิน = กลับเข้ากลางก่อน
   let best=null,bv=-Infinity;
   for(const o of a.entrants){
     if(o===e||o.out)continue;
     const d0=Math.hypot(o.x-c.x,o.y-c.y)||1e-4,ox=(o.x-c.x)/d0,oy=(o.y-c.y)/d0;
     const facingOut=Math.cos(o.dir)*ox+Math.sin(o.dir)*oy;
     const v=facingOut*1.3+(d0/RING_R)*1.5-Math.hypot(o.x-e.x,o.y-e.y)*.22+(o.slot===0?.25:0);
     if(v>bv){bv=v;best=o;}
   }
   if(!best)return {x:c.x,y:c.y,mode:'home'};
   /* เล็งไปที่ "ข้างลำตัว" ฝั่งที่เราอยู่ — เข้าตรงหัวมันไม่มีผล */
   const px=-Math.sin(best.dir),py=Math.cos(best.dir);
   const sgn=((e.x-best.x)*px+(e.y-best.y)*py)>=0?1:-1;
   const off=halfWid(best.genes)+halfWid(e.genes)+.25;
   return {x:best.x+px*sgn*off,y:best.y+py*sgn*off,mode:'hunt',slot:best.slot};
 }
 function stepBot(t,a,e,dt){
   e.think-=dt;
   if(e.think<=0||!e.aim){e.think=.16+Math.random()*.18;e.aim=botAim(t,a,e);}
   const aim=e.aim,want=Math.atan2(aim.y-e.y,aim.x-e.x);
   if(aim.mode==='hunt'&&!e.windT&&!e.dashT&&e.yieldT<=0){
     const o=a.entrants[aim.slot],c=ringC(t);
     if(o&&!o.out){
       const d0=Math.hypot(o.x-c.x,o.y-c.y)||1e-4;
       const facingOut=Math.cos(o.dir)*(o.x-c.x)/d0+Math.sin(o.dir)*(o.y-c.y)/d0;
       const cross=Math.abs(Math.cos(o.dir)*Math.cos(e.dir)+Math.sin(o.dir)*Math.sin(e.dir));
       const reach=WALK*speedMul(e.genes)*chargeSpeed(e.genes)*chargeTime(e.genes);
       const endX=e.x+Math.cos(e.dir)*reach,endY=e.y+Math.sin(e.dir)*reach;
       const safe=Math.hypot(endX-c.x,endY-c.y)<RING_R*(.95-.15*e.care);
       /* ⚠️ 2026-09-21 เกณฑ์ชุดแรกเข้มไป จำลองแล้วบอททั้งสนามใช้ท่าชาร์จรวมกันแค่ 0–3 ครั้งต่อแมตช์
          ทั้งที่เป็นท่าหลักของเกม · ตอนนี้ยอมให้เข้าชาร์จจากไกลขึ้นและมุมกว้างขึ้น แต่ยังตรวจ "พุ่งแล้วไม่ตกเวทีเอง" เหมือนเดิม */
       if(Math.hypot(o.x-e.x,o.y-e.y)<3.6&&facingOut>-.1&&cross<.8&&safe&&
          e.gauge>=chargeCost(e.genes)+5&&Math.random()<e.aggr*dt*9){
         e.windT=.0001;e.botHold=WIND_T*(.65+.35*Math.random());
       }
     }
   }
   return want;
 }

 /* ---------- เดินเกม ---------- */
 function advance(t,a,dt){
   if(a.settled)return;
   if(a.countdown>0){a.countdown=Math.max(0,a.countdown-dt);return;}
   if(!a.hits)a.hits={};
   a.elapsed+=dt;
   for(const e of a.entrants){
     if(e.out)continue;
     e.gauge=Math.min(100,e.gauge+GAUGE_REGEN*dt);
     e.graceT=Math.max(0,(e.graceT||0)-dt);
     let want=null;
     if(e.yieldT>0){
       /* ยอมหลบ: เดินตรงตามทิศหัวของตัวเอง คุมไม่ได้ เลี้ยวไม่ได้ (กฎเดียวกับ tank-view.js) */
       e.yieldT=Math.max(0,e.yieldT-dt);
       if(e.yieldT<=0)e.graceT=YIELD_GRACE;
       e.windT=0;
     }else{
       if(e.bot)want=stepBot(t,a,e,dt);
       else{const d=inputDir();if(d.m>0)want=Math.atan2(d.y,d.x);}
       if(e.windT>0){
         e.windT+=dt;
         if(e.bot){if(e.windT>=(e.botHold||WIND_T))windRelease(e.slot);}
         else if(e.windT>WIND_T*2.4)windRelease(e.slot);          // กดค้างนานเกิน = ปล่อยให้เอง
       }
       if(want!=null)steer(e,want,dt,e.dashT>0?TURN_CHARGE:turnRate(e.genes));
     }
     if(e.dashT>0)e.dashT=Math.max(0,e.dashT-dt);
     if(e.yieldT>0||e.dashT>0||want!=null){
       const sp=speedOf(e);
       moveEnt(t,e,Math.cos(e.dir)*sp,Math.sin(e.dir)*sp,dt);
     }else{e._vx=0;e._vy=0;e._moved=0;}
   }
   contacts(t,a);
   /* ตกวง: จุดกึ่งกลางตัวพ้นเส้นค้างครบ OUT_GRACE วิ */
   for(const e of a.entrants){
     if(e.out)continue;
     if(distC(t,e)>RING_R){
       e.outT=(e.outT||0)+dt;
       if(e.outT>=OUT_GRACE){
         e.out=true;e.outAt=a.elapsed;e.windT=0;e.dashT=0;e.yieldT=0;a.outOrder.push(e.slot);
         pops.push({x:e.x,y:e.y,text:(e.slot===0?'คุณ':e.name)+' ตกวง!',color:COLORS[e.slot],t:0});
       }
     }else e.outT=0;
   }
   if(a.entrants.filter(e=>!e.out).length<=1||a.elapsed>=LIMIT){
     if(a.elapsed>LIMIT)a.elapsed=LIMIT;
     settle();
   }
 }
 function settle(){
   const a=state.active;if(!a||a.settled)return;
   const alive=a.entrants.filter(e=>!e.out).map(e=>e.slot);
   /* ตกทีหลัง = อันดับดีกว่า · คนที่ยังอยู่ในวงตอนหมดเวลาเสมอกันหมด (สเปกผู้เล่น) */
   a.order=[...alive,...a.outOrder.slice().reverse()];
   a.draw=alive.length>1;
   a.rank=a.order.indexOf(0)+1;
   const me=a.entrants[0],tie=a.draw&&!me.out;
   a.delta=a.practice?0:tie?0:(a.rank===1?a.wager*2:a.rank===2?0:a.rank===3?-Math.floor(a.wager/2):-a.wager)||0;
   addCoin(a.delta);a.settled=true;saveGame();syncHUD();
   const won=a.rank===1&&!a.draw;
   if(typeof playNotificationSound==='function')playNotificationSound(won?'tugWin':'tugLose');
   if(won&&window.Fireworks)Fireworks.play({count:12,duration:3400});
   setTimeout(()=>{if(state.active===a&&!modal)showResult();},1100);
 }
 function complete(){
   const a=state.active,t=tankOf(),me=a?.entrants[0];
   const s=t?.slugs.find(x=>x.id===me?.id);if(s){s.state='rest';s.stt=1;s.wall=null;s.climbZ=0;}
   if(a?.practice){state.active=null;close();saveGame();return;}
   state.active=null;state.offer=null;leave();close();exitTank();reschedule();saveGame();
 }
 function showResult(){
   const a=state.active;if(!a?.settled||modal)return;
   const me=a.entrants[0],tie=a.draw&&!me.out;
   if(a.rank===1&&!a.draw&&!a._qWin){a._qWin=true;window.questContestWin?.();}
   const title=tie?'เสมอ · ยังยืนอยู่ในวง':a.rank===1?'ชนะเลิศ! ⭕':'ได้ที่ '+a.rank;
   const d=dialog(title);d.classList.add('race-result','sumo-result');
   d.addEventListener('cancel',e=>{e.preventDefault();complete();});
   element('p',tie?'หมดเวลา 3 นาที คนที่ยังอยู่ในวงเสมอกัน':a.rank===1?'ยืนอยู่ในวงคนสุดท้าย!':'โดนแตะข้างตอนหัวชี้ออก ลองอ่านทิศหัวคู่ต่อสู้ก่อนเข้าชน',d,'race-result-caption');
   const board=element('ol',null,d,'sumo-result-board');
   a.order.forEach((slot,k)=>{
     const e=a.entrants[slot],li=element('li',null,board,slot===0?'is-me':'');
     li.style.setProperty('--c',COLORS[slot]);
     const place=a.draw&&!e.out?'เสมอ':'#'+(k+1);
     element('span',place,li,'sumo-place');
     element('b',slot===0?'คุณ':e.name,li);
     element('small',e.out?'ตกวงนาทีที่ '+Math.floor(e.outAt/60)+':'+String(Math.floor(e.outAt%60)).padStart(2,'0'):'ยังอยู่ในวง',li);
   });
   const receipt=element('div',null,d,'race-receipt');
   if(a.practice){
     element('span','โหมดซ้อม',receipt);
     element('strong','ไม่มีเดิมพัน',receipt);
     element('small','ซ้อมได้ไม่จำกัด · คำท้าจริงถึงจะมีเงินรางวัล',receipt);
   }else{
     element('span','เดิมพัน '+a.wager.toLocaleString()+' ทอง',receipt);
     element('strong',(a.delta>0?'ได้รับ +':a.delta<0?'เสีย ':'ไม่เสีย ไม่ได้เพิ่ม · ')+a.delta.toLocaleString()+' ทอง',receipt);
     element('small','ทองคงเหลือ '+G.coin.toLocaleString(),receipt);
   }
   if(!a.practice)element('p',tie?'ผู้ท้า: ไม่มีใครยอมใครเลยนี่!':a.rank===1?'ผู้ท้า: ดันไม่ไหวเลย!':'ผู้ท้า: ไว้มาดันกันใหม่นะ',d,'race-taunt');
   const done=element('button',a.practice?'จบการซ้อม':'รับทราบ · กลับร้าน',d,'tbtn');done.onclick=complete;done.focus();
   if(a.rank===1&&!a.draw&&window.Fireworks)Fireworks.play({count:5,duration:1600});
 }

 /* ---------- วาดสนาม (ชั้นภาพนิ่งที่แคชไว้ — tank-view.js drawChrome + shop-floor.js) ---------- */
 function ringPath(c,project,t,r){
   const cc=ringC(t),N=44;
   c.beginPath();
   for(let k=0;k<=N;k++){const th=k/N*Math.PI*2,p=project(cc.x+Math.cos(th)*r,cc.y+Math.sin(th)*r);
     if(k)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);}
   c.closePath();
 }
 function drawArena(c,project,t){
   t=t||tank();if(!t)return;
   c.save();
   const q=[project(0,0),project(t.def.w,0),project(t.def.w,ARENA_H),project(0,ARENA_H)];
   c.beginPath();q.forEach((p,k)=>k?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();
   c.fillStyle='rgba(196,164,106,.12)';c.fill();
   c.beginPath();c.moveTo(q[3].x,q[3].y);c.lineTo(q[2].x,q[2].y);
   c.strokeStyle='rgba(120,92,44,.7)';c.lineWidth=2;c.stroke();
   ringPath(c,project,t,RING_R);c.fillStyle='rgba(238,210,150,.20)';c.fill();
   c.strokeStyle='rgba(255,238,196,.92)';c.lineWidth=3.2;c.stroke();
   ringPath(c,project,t,RING_R-.3);c.strokeStyle='rgba(120,92,44,.45)';c.lineWidth=1.4;c.stroke();
   /* จุดกลางวง — ใช้กะระยะว่าใครถูกดันไปไกลแค่ไหนแล้ว */
   ringPath(c,project,t,.5);c.strokeStyle='rgba(120,92,44,.4)';c.lineWidth=1.2;c.stroke();
   c.restore();
 }

 /* ---------- วาดตัวแข่ง ---------- */
 const glSlugs=()=>!!(engineReady&&window.DecorGLB?.ready&&window.Slug3D?.ready&&Slug3D.enabled);
 function drawSlug(s,e){
   s.fx=e.x;s.fy=e.y;s.wall=null;s.climbZ=0;s._motionHeading=s.dir=s.turn=e.dir;
   s.flip=Math.cos(e.dir)*CELLW+Math.sin(e.dir)*DEPX>0;
   if(glSlugs()&&DecorGLB.drawSlug(s))return;
   const len=TANK_SLUG_VIEW_SCALE*slugCm(s.genes)*depthPxPerCm(),p=S(e.x,e.y,SAND_CELLS);
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
   const out=a.entrants.map((e,i)=>({sortY:e.y,kind:'sumo',part:'slug',i}));
   out.push({sortY:-1e9,kind:'sumo',part:'pops'});
   out.push({sortY:-1e9-1,kind:'sumo',part:'marker'});
   return out;
 }
 function drawMarker(a){
   if(a.settled||a.countdown<=0&&a.elapsed>MARKER_T)return;
   const e=a.entrants[0],now=performance.now();
   if(Math.floor(now/260)%2)return;
   const p=S(e.x,e.y,SAND_CELLS+bodyCells(e.genes)*.55+1.1),bounce=Math.sin(now/120)*4*tankCam.zoom;
   const w=Math.max(16,22*tankCam.zoom),h=w*1.05,y=p.y+bounce;
   tctx.save();
   tctx.fillStyle=COLORS[0];tctx.strokeStyle='#3b2a0c';tctx.lineWidth=Math.max(2,3*tankCam.zoom);tctx.lineJoin='round';
   tctx.beginPath();tctx.moveTo(p.x-w/5,y-h*1.75);tctx.lineTo(p.x+w/5,y-h*1.75);tctx.lineTo(p.x+w/5,y-h*1.05);tctx.lineTo(p.x+w/2,y-h*1.05);tctx.lineTo(p.x,y);tctx.lineTo(p.x-w/2,y-h*1.05);tctx.lineTo(p.x-w/5,y-h*1.05);tctx.closePath();
   tctx.stroke();tctx.fill();
   tctx.font='bold '+Math.max(12,14*tankCam.zoom).toFixed(0)+'px "IBM Plex Sans Thai",sans-serif';tctx.textAlign='center';tctx.textBaseline='bottom';
   tctx.lineWidth=4;tctx.strokeText('คุณ',p.x,y-h*1.85);tctx.fillText('คุณ',p.x,y-h*1.85);
   tctx.restore();
 }
 /* วงแหวนใต้ตัว: ตอนตั้งท่า = เกจสีทองวิ่ง · ตอนยอมหลบ = วงแดงกะพริบ (รู้ทันทีว่าใครคุมตัวไม่ได้) */
 function drawRingUnder(e,i){
   const charging=e.windT>0,yielding=e.yieldT>0;
   if(!charging&&!yielding&&e.dashT<=0)return;
   const p=S(e.x,e.y,SAND_CELLS),R=Math.max(10,(halfLen(e.genes)+.3)*CELLW*tankCam.zoom*.6);
   tctx.save();tctx.lineWidth=Math.max(2.5,3.5*tankCam.zoom);
   if(yielding){
     tctx.strokeStyle='rgba(255,138,122,'+(.5+.4*Math.sin(performance.now()/90)).toFixed(2)+')';
     tctx.beginPath();tctx.ellipse(p.x,p.y,R,R*.5,0,0,Math.PI*2);tctx.stroke();
   }else{
     const power=charging?Math.min(1,e.windT/WIND_T):1;
     tctx.strokeStyle='rgba(0,0,0,.35)';tctx.beginPath();tctx.ellipse(p.x,p.y,R,R*.5,0,0,Math.PI*2);tctx.stroke();
     tctx.strokeStyle=e.dashT>0?'#9fe3ee':COLORS[i];
     tctx.beginPath();tctx.ellipse(p.x,p.y,R,R*.5,0,-Math.PI/2,-Math.PI/2+Math.PI*2*power);tctx.stroke();
   }
   tctx.restore();
 }
 function drawItem(it){
   const a=state.active,t=tankOf();if(!a||!t)return;
   if(it.part==='marker'){drawMarker(a);return;}
   if(it.part==='slug'){
     const e=a.entrants[it.i],s=sprites[it.i];if(!s)return;
     s.state=e.out?'rest':e._moved>.001?'walk':'rest';
     if(e._moved)s.creepT=(s.creepT||0)+e._moved*CM_PER_CELL/(CREEP_BODY_PER_CYCLE*slugCm(e.genes))*Math.PI*2;
     s.ph=(s.ph||0)+.02;
     if(!e.out)drawRingUnder(e,it.i);
     tctx.save();if(e.out)tctx.globalAlpha=.5;
     drawSlug(s,e);
     tctx.restore();
     nameTag(it.i===0?'คุณ':e.name,e.x,e.y,it.i===0?'#2c2140':'rgba(30,20,16,.85)',e.out?'#9fb2b0':COLORS[it.i]);
     return;
   }
   if(it.part==='pops'){
     tctx.save();tctx.textAlign='center';tctx.font='bold '+Math.max(14,18*tankCam.zoom).toFixed(0)+'px "IBM Plex Sans Thai",sans-serif';
     for(const p of pops){const q=S(p.x,p.y,SAND_CELLS+1.2+Math.max(0,p.t)*1.4);tctx.globalAlpha=Math.max(0,1-Math.max(0,p.t));
       tctx.lineWidth=4;tctx.strokeStyle='#102a2e';tctx.strokeText(p.text,q.x,q.y);tctx.fillStyle=p.color;tctx.fillText(p.text,q.x,q.y);}
     tctx.restore();
   }
 }
 function camera(t){
   const key=TCW+'|'+TCH;if(cameraKey===key)return;cameraKey=key;
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
   hud.time.classList.toggle('is-urgent',a.countdown<=0&&!a.settled&&left<=15);
   const alive=a.entrants.filter(e=>!e.out).length;
   const edge=distC(t,me)/RING_R;
   const msg=a.settled?(a.draw?'หมดเวลา · คนในวงเสมอกัน':'จบแมตช์!')
     :a.countdown>0?'ลูกศรกะพริบ = ทากของคุณ · ห้ามให้กึ่งกลางตัวพ้นเส้นวง'
     :me.out?'คุณตกวงแล้ว · ดูจนจบเพื่อรู้อันดับ'
     :me.yieldT>0?'⚠️ โดนแตะข้าง! คุมตัวไม่ได้ชั่วครู่'
     :edge>.86?'⚠️ ชิดขอบวงแล้ว รีบหันกลับเข้ากลาง'
     :me.windT>0?'ตั้งท่าอยู่… ปล่อยเพื่อพุ่ง'
     :me.dashT>0?'พุ่ง! เลี้ยวไม่ได้แล้ว'
     :'เหลือในวง '+alive+' ตัว · เข้าแตะข้างตอนหัวคู่ต่อสู้ชี้ออกนอกวง';
   if(hud.status.textContent!==msg)hud.status.textContent=msg;
   const big=a.settled?'':a.countdown>0?String(Math.ceil(a.countdown)):a.elapsed<.8?'ดัน!':'';
   if(hud.big.textContent!==big){hud.big.textContent=big;hud.big.classList.remove('pop');void hud.big.offsetWidth;if(big)hud.big.classList.add('pop');}
   a.entrants.forEach((e,i)=>{
     /* ตัวเลข = เหลือระยะถึงเส้นวงกี่ ซม. (เข้าใจทันทีว่าใครกำลังจะตก) ไม่ใช่เปอร์เซ็นต์ลอย ๆ */
     const txt=e.out?'ตกวง':e.yieldT>0?'เสียหลัก':Math.max(0,Math.round((RING_R-distC(t,e))*CM_PER_CELL))+' ซม.';
     if(hud.rows[i].b.textContent!==txt)hud.rows[i].b.textContent=txt;
     hud.rows[i].li.classList.toggle('is-out',!!e.out);
   });
   const cost=chargeCost(me.genes);
   hud.chargeFill.style.height=me.gauge+'%';
   hud.charge.classList.toggle('ready',!me.out&&me.gauge>=cost&&me.dashT<=0&&me.yieldT<=0);
   hud.charge.classList.toggle('winding',me.windT>0);
   hud.charge.disabled=!!me.out;
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
 window.addEventListener('keydown',e=>{
   if(!ui||modal?.open||!state.active||state.active.settled)return;
   e.stopImmediatePropagation();
   if([...MOVE_KEYS,'Space','Escape'].includes(e.code))e.preventDefault();
   if(MOVE_KEYS.includes(e.code)){keys.add(e.code);return;}
   if(e.repeat)return;                       // กดค้าง Space = ตั้งท่าครั้งเดียว ไม่รัวฟรี
   if(e.code==='Space'&&!holding){holding=true;windStart(0);}
 },true);
 window.addEventListener('keyup',e=>{
   if(MOVE_KEYS.includes(e.code)){keys.delete(e.code);return;}
   if(e.code==='Space'&&holding){holding=false;if(ui&&state.active&&!state.active.settled)windRelease(0);}
 },true);
 window.addEventListener('blur',()=>{keys.clear();holding=false;});
 document.addEventListener('visibilitychange',()=>{lastFrame=0;keys.clear();holding=false;saveGame();});

 /* ask: เปิดหน้ารับคำท้าได้จากคอนโซลตอนเทสต์ — SlugSumo.state().offer=SlugSumo.makeOffer(); SlugSumo.ask() */
 window.SlugSumo={purchased,goal,drawChallengers,drawArena,decorOk,ask,makeOffer,state:()=>state,isOpen:()=>!!modal?.open,
   reserved:o=>!!o?.def?.sumo&&visitors.some(p=>PEOPLE.includes(p)),
   isSumo:t=>!!ui&&!!state.active&&(!t||t.id===state.active.tankId),
   items,drawItem,updateTankFrame,normalSlugs,stepNormal,ARENA_H,RING_R,RING_CY,speedMul,chargeSpeed,chargeTime,chargeCost};

 /* แมตช์ค้างจากเซฟ: ต้องมีผู้แข่งครบ 4 ไม่งั้นทิ้ง (ทิ้งเฉพาะแมตช์ ไม่แตะเซฟอย่างอื่น) */
 if(!state.active||!Array.isArray(state.active.entrants)||state.active.entrants.length!==4||!Array.isArray(state.active.outOrder))state.active=null;
 if(owned())purchased();
 resumeReady=true;setInterval(tick,1000);
})();
