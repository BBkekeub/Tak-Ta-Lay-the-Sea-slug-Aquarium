/* ปาหินด้วยหงอน — ตู้ 150×50 ซม. หนึ่งตู้ต่อร้าน (สเปกผู้เล่น 2026-09-18)
 *
 * โครงเดียวกับ slug-race.js / slug-tug.js / slug-eat.js:
 *   ลูกค้ามาท้า → โมดอลเลือกทาก+เดิมพัน → เข้าตู้เต็มจอ → ผลแพ้ชนะ (ใช้หน้าตาโมดอลชุดเดียวกัน)
 *
 * ปาหนึ่งไม้มี 4 ช่วง (รอบสองของดีไซน์ — รอบแรก "กดสุดไว้ก่อนก็ชนะ" ผู้เล่นบอกว่าไม่สนุก)
 *   1. ลูกศรองศา — คลิกเริ่มเล็ง แล้วคลิกล็อกมุม · 45° ไกลสุด
 *   2. ความยาวลูกศร — คลิกเลือกแรงแล้วปา · ยิ่งยาวยิ่งแรง ไม่มีเหวี่ยงพลาด
 *   3. เร่งแรง 5 วิ — กล้องซูมตามหิน กด F / K สลับกันรัว ๆ F/K เพิ่มแรงจากการเล็ง · ถึงยอดพาราโบล่าที่ 5 วิเสมอ
 *   4. ช่วงหินตก — คลื่นซัดเข้ามาเป็นระลอก กด Space ให้ทันทุกลูก · พลาดลูกไหน หินเสียแรง ตกใกล้ลง
 *   บนลานมีวงเป้าสุ่มตำแหน่งทุกไม้ ลงเป้าได้โบนัส → ไม่ใช่ปาให้ไกลสุดอย่างเดียว
 *   คะแนน = ผลรวมระยะ 3 ไม้ + โบนัสเป้า (ทุกไม้มีความหมาย ไม่ใช่เอาไม้ที่ดีที่สุด)
 */
(()=>{
 'use strict';
 const MINUTE=60000;
 const THROWS=3;                               // ⚙️ ปาคนละกี่ไม้
 const FIELD_CM=150, START_CM=12;              // ความยาวตู้ · จุดยืนปา (ซม.)
 const MAX_CM=FIELD_CM-START_CM-6;             // ระยะไกลสุดที่ตกในตู้ได้
 /* ⚠️ 2026-09-19 ผู้เล่น: "ให้ลานอยู่ด้านหน้าสุดของตู้จะได้ไม่โดนวางของบัง"
    เดิมเลนอยู่กลางตู้ (LANE_Y=5 จากลึก 10) แล้วไม่มีกฎห้ามวางของเลย = วางหินคร่อมเลนบังหินที่ปาได้
    ตอนนี้ย้ายเลนมาชิดขอบหน้า และกันแถบ LANE_H ไว้ให้โล่งทั้งของตกแต่งและอาหาร (แบบตู้วิ่ง/ชักเย่อ/กินจุ) */
 const LANE_H=20/CM_PER_CELL, LANE_Y=LANE_H/2;
 const ANGLE_LO=0, ANGLE_HI=90, BEST_ANGLE=45;
 const SWEEP_POWER=1.15;
 const ANGLE_SPEED_BASE=.7;   // เลือกองศาก่อนความแรง
 /* F/K เพิ่มความเร็วสมมูลจากแรงแรกระหว่างไต่ขึ้น 5 วิ แล้วล็อกแรงตอนถึงยอด
    อินทิเกรตแรงโน้มถ่วง/แรงต้านทุก substep; ยืดเวลาขึ้นเป็น 5 วิ ลงตามแรงที่กระทำ
    เป็นฟิสิกส์ผสมกติกาเกม: คลื่นเปลี่ยนแรงต้าน และขอบตู้จำกัดระยะคะแนน */
 const BOOST_T=5;                              // ⚙️ ช่วงที่ยังเร่งได้ (วิ) หลังจากนี้เข้าช่วงหินตก
 /* ⚠️ แรงต้านช่วงหินตกต้องต่ำกว่าช่วงเร่ง ไม่งั้นพอถึงช่วงคลื่นหินแทบหยุดแล้ว
    การพลาดคลื่นเลยไม่มีผล (เทสต์: พลาดครบ 4 ลูกเสียระยะแค่ 1 ซม.) · ตอนนี้ช่วงคลื่นกินระยะราว 40% ของไม้ */
 const DRAG=.45, DRAG_FALL=.12;   // DRAG/ASCENT ใช้ต่อไม้เก่าที่เซฟไว้เท่านั้น
 /* ช่วงเร่งหินยังพุ่งขึ้นอยู่ ระยะราบจึงเดินแค่ ASCENT ของความเร็ว · ระยะจริงส่วนใหญ่มาตอนหินตก
    (ถ้าให้ช่วงเร่งกินระยะเยอะ การพลาดคลื่นจะแทบไม่มีผล — เทสต์แล้วเสียแค่ 8 ซม.) */
 const ASCENT=.35;
 const WAVES=4, WAVE_GAP=.85, WAVE_LEAD=1, WAVE_WINDOW=1.8/8;   // ⚙️ คลื่น (ค่ากลาง)
 /* คลื่นแต่ละลูกสุ่มจังหวะและความเร็ว: ช่องไฟ WAVE_GAP_LO–HI วิ · ความเร็ว WAVE_SPEED_LO–HI เท่า
    ยิ่งเร็ว ช่องกด (หน้าหิน→กึ่งกลาง) ยิ่งสั้น · ลูกสุดท้ายต้องมาก่อน WAVE_LAST วิ ไม่งั้นหินตกถึงพื้นก่อน */
 const WAVE_GAP_LO=.5, WAVE_GAP_HI=1.25, WAVE_SPEED_LO=.7, WAVE_SPEED_HI=1.6, WAVE_LAST=4.2;
 const waveWin=w=>w.win??WAVE_WINDOW;   // ไม้เก่าที่เซฟไว้ไม่มี win ใช้ค่าเดิม
 function rollWaves(){
   const out=[];let at=WAVE_LEAD*(.7+Math.random()*.6);
   for(let i=0;i<WAVES;i++){
     if(i)at+=WAVE_GAP_LO+Math.random()*(WAVE_GAP_HI-WAVE_GAP_LO);
     out.push({at,win:WAVE_WINDOW/(WAVE_SPEED_LO+Math.random()*(WAVE_SPEED_HI-WAVE_SPEED_LO)),hit:null});
   }
   const first=out[0].at,last=out[WAVES-1].at;
   if(last>WAVE_LAST){const k=(WAVE_LAST-first)/(last-first);for(const w of out)w.at=first+(w.at-first)*k;}
   return out;
 }
 /* Space counters a crest from first nose contact through the midpoint (0.225 s).
    Each wave stores its attempt/result in shot.waves, so resume preserves timing.
    Pitch remains a visual/drag consequence of failure, not the success condition. */
 const PITCH_PRESS=24;      // งัดหัวขึ้นต่อการกด 1 ครั้ง (องศา)
 const PITCH_WAVE=26;       // แรงคลื่น (องศา)
 const PITCH_CATCH=28;      // หัวเชิดเกินนี้ตอนคลื่นถึง = คลื่นมุดใต้ท้อง เชิดต่อ
 const PITCH_FLAT=9;        // |มุม| ไม่เกินนี้ = ยังเพรียวลม ไม่มีโทษ
 const PITCH_MAX=62, PITCH_EASE=1.6;   // มุมสูงสุด · หัวค่อย ๆ คืนสู่แนวราบ (วินาที)
 const PITCH_DRAG=5.2;      // แรงต้านสูงสุดที่มุมหัวเพิ่มให้ (เท่าของ DRAG_FALL)
 const RING_MIN=45, RING_MAX=112, RING_HALF=6, RING_BONUS=25;                 // ⚙️ วงเป้าโบนัส
 const GLASS_BONUS=10;   // ⚙️ ปาติดกระจกท้ายตู้ — น้อยกว่าเป้า ให้การเล็งเป้ายังคุ้มกว่าอัดสุดแรง
 const BOT_SPEED=2.6;                          // ⚙️ ตาบอทเดินเร็วกว่าปกติเท่านี้ (ลดเวลานั่งรอ)
 const COLORS=['#ffd36b','#ff8a7a','#7fd4ff','#c3a6ff'];
 const names=['แขนหิน','หงอนเหล็ก','พายุทราย','ปาไกล','มือฉมัง','หินลอย','สลิงทะเล','เหวี่ยงคลื่น'];

 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const g01=(g,k)=>clamp(Number.isFinite(g[k])?g[k]:50,0,100)/100;
 const gillCnt01=g=>clamp(((typeof gillCount==='function'?gillCount(g):5)-2)/7,0,1);
 /* แรงจากหงอนล้วน: ขนาดหงอน 60% + จำนวนหงอน 40% */
 const gillPower=g=>.6*g01(g,'gillLen')+.4*gillCnt01(g);
 const armMul=g=>.45+.55*gillPower(g);
 /* ความเร็วตั้งต้นจากการเล็ง */
 // cm, seconds: ballistic range/height; presentation time is remapped to 5 s ascent.
 const GRAVITY=981, FALL_T=5, THROW_BASE=175, THROW_GAIN=160, THROW_PRESS=2.4;
 const FORCE_MUL=.95;   // ⚙️ ตัวคูณแรงรวม (แรงปา + แรงกด F/K) · 2026-09-23 ลด 5% เพราะติดกระจกง่ายเกิน
 const startSpeed=(g,power,angle)=>(THROW_BASE+THROW_GAIN*armMul(g)*clamp(power,0,1))*FORCE_MUL;
 /* ระยะอ้างอิง "ถ้าเล่นดี": เล็ง 100% องศา 45° แล้วกด 8 ครั้ง/วิ ตลอดช่วงเร่ง ไม่พลาดคลื่น */
 function maxDist(g){
   const v=startSpeed(g,1,BEST_ANGLE)+THROW_PRESS*FORCE_MUL*armMul(g)*8*BOOST_T;
   return Math.min(MAX_CM,v*v/GRAVITY);
 }
 const scoreOf=e=>e.shots.reduce((n,s)=>n+s.score,0);

 let state=G.throwing;
 if(!state||typeof state!=='object'||!Number.isFinite(state.nextAt))state={purchased:false,nextAt:0,offer:null,active:null};
 G.throwing=state;
 let visitors=[],modal=null,ui=null,lastFrame=0,lastSave=0,cameraKey='',resumeReady=false,offerDeadline=0;
 let sprites=[],pops=[],hud={},lastBoostKey=null,camX=null,camZoom=null;

 const tank=()=>G.objs.find(o=>o.def.throwing&&o!==moving);
 const owned=()=>[...G.objs,...G.shelter].some(o=>o.def.throwing);
 const tankOf=()=>G.objs.find(o=>o.id===state.active?.tankId);
 const cur=()=>state.active?.entrants[state.active.turn];
 /* คนที่ยังไม่ถึงตา = ยืนรอ "หลังเลน" ไม่ยืนขวางลาน */
 const standSpot=(i,active)=>active?{x:START_CM/CM_PER_CELL,y:LANE_Y}:{x:START_CM/CM_PER_CELL-1.6,y:LANE_H+.9+i*1.1};
 /* แถบลานปาด้านหน้าตู้ต้องโล่ง — ของตกแต่ง/อาหารต้องอยู่หลัง LANE_H (tank-view.js canPlaceDecor · feeding.js) */
 function decorOk(t,keyset,bounds){
   if(!bounds||bounds.top<LANE_H)return false;
   for(const k of keyset||[])if((Number(k.split(',')[1])+.5)*DCELL<LANE_H)return false;
   return true;
 }
 const flying=a=>a&&(a.phase==='boost'||a.phase==='waves');
 const stoneHeight=a=>{
   if(a.shot?.physics>=2)return SAND_CELLS+(a.shot.height||0)/CM_PER_CELL;
   const total=BOOST_T+WAVE_LEAD+WAVES*WAVE_GAP;
   const progress=(a.phase==='boost'?a.clock:BOOST_T+a.clock)/total;
   return SAND_CELLS+(1.2+2.6*Math.sin(a.shot.angle*Math.PI/180))*Math.sin(Math.PI*clamp(progress,0,1));
 };
 let boostFlashUntil=0,waveSprite=null,stoneSprite=null;
 // One small reusable bitmap. Camera movement only scales/blits it.
 function waveImage(){
   if(waveSprite)return waveSprite;
   const c=document.createElement('canvas');c.width=128;c.height=256;const g=c.getContext('2d');
   const fill=g.createLinearGradient(0,0,128,0);
   fill.addColorStop(0,'#e7ffff');fill.addColorStop(.06,'#7ce7ee');
   fill.addColorStop(.25,'#24a7caaa');fill.addColorStop(1,'#147ba000');
   g.fillStyle=fill;g.fillRect(0,0,128,256);
   g.fillStyle='#edffff';g.fillRect(0,0,2,256);
   // Soft water ribs and foam are baked once; only translation changes per frame.
   for(let i=0;i<24;i++){
     const y=i*11;g.strokeStyle=i%3?'#b9f7fa30':'#efffff70';g.lineWidth=i%3?1:2;
     g.beginPath();g.moveTo(3,y);g.bezierCurveTo(12,y+14,22,y-11,45,y+5);g.stroke();
     g.fillStyle='#edffff66';g.beginPath();g.arc(5+i%4*3,y+4,1+i%2,0,Math.PI*2);g.fill();
   };
   waveSprite=c;return c;
 }

 // One deterministic, shaded pebble bitmap shared by the loaded and flying stone.
 function stoneImage(){
   if(stoneSprite)return stoneSprite;
   const c=document.createElement('canvas');c.width=256;c.height=160;const g=c.getContext('2d');
   g.beginPath();g.moveTo(10,85);g.bezierCurveTo(6,52,43,21,77,18);g.bezierCurveTo(117,5,162,17,187,30);
   g.bezierCurveTo(221,34,247,61,246,86);g.bezierCurveTo(251,115,210,141,174,143);
   g.bezierCurveTo(124,155,73,145,41,127);g.bezierCurveTo(20,119,7,104,10,85);g.closePath();g.clip();
   const base=g.createLinearGradient(55,18,170,153);base.addColorStop(0,'#b5b2a9');base.addColorStop(.38,'#898c87');base.addColorStop(.74,'#545e60');base.addColorStop(1,'#283238');g.fillStyle=base;g.fillRect(0,0,256,160);
   let seed=871;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   for(let i=0;i<1700;i++){const x=rnd()*256,y=rnd()*160,r=.25+rnd()*1.5;g.fillStyle=rnd()>.48?'rgba(229,223,204,.17)':'rgba(20,32,37,.16)';g.beginPath();g.ellipse(x,y,r*1.5,r,0,0,Math.PI*2);g.fill();}
   g.lineCap='round';g.strokeStyle='#d5d4c13b';g.lineWidth=2;
   for(let i=0;i<5;i++){g.beginPath();g.moveTo(20,48+i*16);g.bezierCurveTo(75,35+i*20,160,84+i*12,240,64+i*14);g.stroke();}
   const shine=g.createRadialGradient(81,40,2,96,51,107);shine.addColorStop(0,'#f2ecda45');shine.addColorStop(.5,'#dde8de10');shine.addColorStop(1,'#ffffff00');g.fillStyle=shine;g.fillRect(0,0,256,160);
   stoneSprite=c;return c;
 }
 function drawStone(p,r,angle=0){
   tctx.save();tctx.translate(p.x,p.y);tctx.rotate(angle);
   tctx.drawImage(stoneImage(),-r*1.8,-r*.95,r*3.6,r*1.9);tctx.restore();
 }
 const heldStalk=new WeakMap();   // ทาก → ก้านหงอนที่ถือหิน (ทางสำรอง 2D)
 function loadedStone(a){
   const s=sprites[a.turn],tip=s&&window.DecorGLB?.throwCrown?.(s);
   if(tip)return {x:tip.x,y:tip.y,z:tip.z+6*.8/ZH};
   const screen=s&&window.Slug3D?.throwCrownScreen?.(s);
   if(screen){const base=S(START_CM/CM_PER_CELL,LANE_Y,SAND_CELLS);return {x:START_CM/CM_PER_CELL+(screen.x-base.x)/(CELLW*tankCam.zoom),y:LANE_Y,z:SAND_CELLS+(base.y-screen.y+6*.8*tankCam.zoom)/(ZH*tankCam.zoom)};}
   if(s&&typeof slugPartsOf==='function'){
     const P=slugPartsOf(s),len=TANK_SLUG_VIEW_SCALE*slugCm(s.genes)*depthPxPerCm();
     if(P){const scale=len/(P.bw*P.s),k=P.s*scale,base=S(START_CM/CM_PER_CELL,LANE_Y,SAND_CELLS);
       const cx=base.x-((P.L+P.R)/2-P.bw/2)*k,cy=base.y-P.h*scale*.44;
       // ล็อกก้านที่ถือหินไว้ก้านเดียว เหมือนฝั่ง 3D — กันหินกระโดดข้ามก้านตอนเอียงสุด
       const held=heldStalk.get(s);let top=null,topIdx=-1;
       P.stalks.forEach((st,idx)=>{if(held!=null&&idx!==held)return;const rot=st.rot0+(s.throwLean??0),h=st.ay*.94;
         const px=st.px+Math.sin(rot)*h,py=st.py-Math.cos(rot)*h;
         const q={x:cx+(s.flip?-1:1)*(px-(P.L+P.R)/2)*k,y:cy+(py-(P.T+P.B)/2)*k};
         if(!top||q.y<top.y){top=q;topIdx=idx;}
       });
       if(s.throwLean===undefined)heldStalk.delete(s);else if(held==null&&top)heldStalk.set(s,topIdx);
       if(top)return {x:START_CM/CM_PER_CELL+(top.x-base.x)/(CELLW*tankCam.zoom),y:LANE_Y,z:SAND_CELLS+(base.y-top.y+6*.72*tankCam.zoom)/(ZH*tankCam.zoom)};
     }
   }
   const lean=(.15+aimAngle(a)/90*.8),g=cur()?.genes||{};
   return {x:START_CM/CM_PER_CELL-Math.sin(lean)*.65,y:LANE_Y,z:SAND_CELLS+1.1+g01(g,'gillLen')*.5};
 }
 /* ---------- ลูกค้ามาท้า ---------- */
 function purchased(){if(!state.purchased){state.purchased=true;state.nextAt=Date.now()+5*MINUTE;saveGame();}}
 const gap=()=>ShopEvents.gap();                // 20–45 นาที ใช้ค่าเดียวกันทั้ง 4 ตู้ (config.js)
 function reschedule(){state.nextAt=Date.now()+gap();}
 function makeOffer(){
   const pool=names.slice().sort(()=>Math.random()-.5);
   return {rivals:[0,1,2].map(i=>({name:pool[i],genes:SlugEngine.randGene(),aim:.55+Math.random()*.4}))};
 }
 function leave(){
   for(const p of visitors){p.throwChallenger=false;p.family=null;p.tradeDone=true;p.visits=0;p.strolls=0;
     p.focus=null;p.route=[];p.routeGoal=null;p.tgt=doorSpot();p.state='leave';p.stuck=0;}
   visitors=[];offerDeadline=0;
 }
 function goal(p){
   const t=tank();
   if(!t||!state.offer){p.throwChallenger=false;p.visits=0;p.strolls=0;return false;}
   const spot=freeSpot(lookSpots(t),p);
   if(spot){p.focus=t;p.tgt=spot;p.state='walk';p.route=[];p.routeGoal=null;p.stuck=0;return true;}
   p.focus=null;p.tgt=strollSpot(p);p.state='walk';return true;
 }
 function spawn(){
   if(visitors.length||!peopleOn||!tank()||document.hidden||tankMode||window.BOOTING)return;
   if(!ShopEvents.ready())return;
   const capacity=challengerRoom();if(capacity<3)return;
   const previous=new Set(PEOPLE),gender=()=>Math.random()<.5?'female':'male';
   if(!spawnVisitors(capacity,'throw',[0,1,2].map(()=>({kid:false,gender:gender()}))))return;
   visitors=PEOPLE.filter(p=>!previous.has(p));ShopEvents.mark();
   if(!state.offer){state.offer=makeOffer();state.nextAt=Date.now()+gap();saveGame();}
   visitors.forEach((p,i)=>{
     const r=state.offer.rivals[i%3];
     p.family=null;p.throwChallenger=true;p.wantsBuy=false;p.wantsSell=false;p.tradeDone=true;
     p.carryTank=true;p.carryColor='#4a6a7a';p.carryAccent=slugBaseHex(r.genes);
     if(typeof makeSlug==='function')p.carrySlug=makeSlug(r.genes);
     p.bagged=false;p.accessory='none';p.visits=1;p.strolls=0;goal(p);
   });
   offerDeadline=Date.now()+5*MINUTE;
   toast('🪨 มีคนมาท้าปาหิน! คลิกคนถือตู้เพื่อรับคำท้า','good');
 }
 function dismiss(){state.offer=null;leave();close();reschedule();saveGame();}
 function tick(){
   if(state.active&&!state.active.settled&&['intro','angle','power'].includes(state.active.phase)&&state.active.aimStyle!=='arrow1'){state.active.phase='intro';state.active.clock=0;state.active.lockPower=null;state.active.lockAngle=null;state.active.aimStyle='arrow1';}
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
   modal=element('dialog');modal.className='slug-race-dialog slug-throw-dialog';modal.setAttribute('aria-label',title);
   modal.addEventListener('cancel',e=>{e.preventDefault();if(!state.active)dismiss();});
   modal.addEventListener('lightdismiss',e=>{if(!state.active){e.preventDefault();close();}});
   element('h2',title,modal);document.body.append(modal);modal.showModal();return modal;
 }
 function close(){
   modal?.close();modal?.remove();modal=null;
   ui?.remove();ui=null;hud={};document.body.classList.remove('throw-in-tank');
   lastFrame=0;cameraKey='';pops=[];lastBoostKey=null;camX=camZoom=null;
 }

 /* ---------- ป้ายเหนือหัวผู้ท้า ---------- */
 function drawChallengers(){
   if(!state.offer||!visitors.length)return;
   const label='🪨 ปาหินแข่ง · คลิกรับคำท้า';
   ctx.save();ctx.font='bold 13px "IBM Plex Sans Thai",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   const boxW=ctx.measureText(label).width+32,boxH=31,glow=.55+.35*(.5+.5*Math.sin(performance.now()/260));
   visitors.forEach(p=>{
     if(!personOnScreen(p))return;
     const b=personScreenBounds(p),x=clamp((b.x0+b.x1)/2,boxW/2+4,CW-boxW/2-4),y=clamp(b.y0-boxH/2-10,boxH/2+4,CH-boxH/2-4);
     ctx.beginPath();ctx.roundRect(x-boxW/2,y-boxH/2,boxW,boxH,boxH/2);
     ctx.fillStyle='rgba(30,34,44,.92)';ctx.fill();ctx.lineWidth=1.4;ctx.strokeStyle='rgba(231,198,123,'+glow+')';ctx.stroke();
     ctx.fillStyle='#ffe1a0';ctx.fillText(label,x,y+1);
     p._throwHit={x0:x-boxW/2,x1:x+boxW/2,y0:y-boxH/2,y1:y+boxH/2};
   });
   ctx.restore();
 }
 function hitTest(e){
   if(tankMode||appMode!=='view'||moving||buyKey||modal||!state.offer||state.active)return false;
   const {sx,sy}=screenXY(e);
   return visitors.some(p=>{const h=p._throwHit;return personOnScreen(p)&&(personHitTest(p,sx,sy)||(h&&sx>=h.x0&&sx<=h.x1&&sy>=h.y0&&sy<=h.y1));});
 }
 let pressedVisitor=false;
 cv.addEventListener('pointerdown',e=>{if(e.button===0&&hitTest(e)){pressedVisitor=true;e.preventDefault();e.stopImmediatePropagation();}},true);
 cv.addEventListener('pointerup',e=>{if(pressedVisitor){pressedVisitor=false;e.preventDefault();e.stopImmediatePropagation();if(hitTest(e))ask();}},true);
 cv.addEventListener('pointercancel',()=>{pressedVisitor=false;},true);

 /* ---------- โมดอลรับคำท้า ---------- */
 function ask(){
   if(modal||!state.offer||!tank()||state.active)return;
   const t=tank(),rivals=state.offer.rivals;
   const d=dialog('🪨 ปาหินด้วยหงอน');
   element('p',rivals.map(r=>r.name).join(' · ')+' ขอท้าปาหิน คนละ '+THROWS+' ไม้ · รวมระยะทั้ง 3 ไม้',d);
   const row=element('div',null,d,'eat-rivals');
   for(const r of rivals){const cell=element('div',null,row,'eat-rival');const c=element('canvas',null,cell);c.width=150;c.height=90;c.setAttribute('aria-hidden','true');
     try{drawSlugPortrait(c,{genes:r.genes});}catch(_){}element('b',r.name,cell);element('small','สุดแรง '+maxDist(r.genes).toFixed(0)+' ซม.',cell);}
   element('p','คลิกบนสนามเริ่มเล็ง → คลิกล็อกองศาลูกศร → คลิกเลือกแรงแล้วปา · ลูกศรยิ่งยาวยิ่งแรง ·ใช้ Space แทนคลิกได้',d,'eat-rule');
   element('p','3) กด F / K สลับกันเพิ่มแรงจากค่าที่เล็ง หินไต่ขึ้นถึงยอดใน 5 วิเสมอ  4) ช่วงหินตกมีคลื่นซัดเข้ามา '+WAVES+' ลูก จังหวะและความเร็วสุ่มทุกไม้กด Space ตอนขอบคลื่นแตะปลายหน้าหินจนถึงกึ่งกลาง กดได้ครั้งเดียวต่อลูก กดเร็วหรือช้าไปจะเสียแรง',d,'eat-rule');
   element('p','บนลานมีวงเป้าสุ่มตำแหน่งทุกไม้ · ลงเป้าได้โบนัส +'+RING_BONUS+' แต้ม · ปาติดกระจกท้ายตู้ +'+GLASS_BONUS+' แต้ม',d,'eat-rule');
   element('p','เลือกทากในตู้ปาหิน',d);
   let picked=t.slugs[0]?.id||null;
   SlugHover.cards(element('div',null,d),{slugs:t.slugs,selected:picked,empty:'ยังไม่มีทากในตู้ปาหิน',
     sub:s=>{const g=foodGenes(s);return 'สุดแรง '+maxDist(g).toFixed(0)+' ซม. · พลังหงอน '+Math.round(gillPower(g)*100)+'%';},onPick:s=>{picked=s.id;}});
   const betLabel=element('label','เดิมพัน (ทอง) — ยังไม่หักตอนเริ่ม',d),bet=element('input',null,betLabel);
   const maxBet=Math.max(0,Math.min(1000,Math.floor(G.coin)));
   bet.type='number';bet.min='0';bet.max=String(maxBet);bet.step='1';bet.value='0';
   const quick=element('div',null,d,'race-bet-quick');
   const pickBet=v=>{bet.value=String(v);for(const b of quick.children)b.setAttribute('aria-pressed',String(+b.dataset.v===v));};
   const presets=[['ไม่เดิมพัน',0],...[100,300,500].filter(v=>v<maxBet).map(v=>[String(v),v])];
   if(maxBet>0)presets.push(['สูงสุด '+maxBet.toLocaleString(),maxBet]);
   for(const [label,v] of presets){const b=element('button',label,quick,'tbtn');b.type='button';b.dataset.v=String(v);b.setAttribute('aria-pressed',String(v===0));b.onclick=()=>pickBet(v);}
   bet.addEventListener('input',()=>{for(const b of quick.children)b.setAttribute('aria-pressed',String(+b.dataset.v===+bet.value));});
   element('p','ที่ 1 ได้ 3 เท่าของเดิมพัน · ที่ 2 ได้ 2 เท่า · ที่ 3 ไม่ได้ไม่เสีย · ที่ 4 เสียเท่าเดิมพัน',d,'eat-rule');
   const error=element('p','',d);error.setAttribute('role','alert');
   const start=element('button','เริ่มแข่ง',d,'tbtn');start.disabled=!t.slugs.length;
   if(!t.slugs.length)error.textContent='ยังไม่มีทากในตู้ปาหิน ย้ายทากเข้าตู้ก่อนรับคำท้า';
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
 /* ---------- โหมดซ้อม: คู่แข่งคือทากในตู้ที่ผู้เล่นเลือกเอง ไม่มีเดิมพัน (slug-practice.js) ---------- */
 function practiceSync(){
   const t=tank();
   if(typeof SlugPractice==='undefined')return;
   SlugPractice.sync('throw',!!t&&tankMode&&curTank===t&&!state.active&&!modal?.open,'🪨 ซ้อมปาหิน',()=>{
     SlugPractice.pick({tank:t,title:'🪨 ซ้อมปาหิน',need:3,
       noteFor:s=>'สุดแรง '+maxDist(foodGenes(s)).toFixed(0)+' ซม.',
       onStart:(mine,others)=>beginPractice(t,mine,others)});
   });
 }
 function beginPractice(t,s,others){
   const mk=o=>({shots:[],...o});
   state.active={tankId:t.id,wager:0,practice:true,settled:false,round:0,turn:0,phase:'intro',clock:0,
     power:0,lockPower:null,lockAngle:null,shot:null,ring:null,
     entrants:[mk({name:slugNick(s),id:s.id,genes:{...foodGenes(s)}}),
       ...others.map(o=>mk({name:slugNick(o),genes:{...foodGenes(o)},aim:.55+Math.random()*.4,bot:true}))]};
   newRing(state.active.entrants[0]);
   saveGame();close();openMatch();
 }
 function begin(t,s,wager){
   const mk=o=>({shots:[],...o});
   state.active={tankId:t.id,wager,settled:false,round:0,turn:0,phase:'intro',clock:0,
     power:0,lockPower:null,lockAngle:null,shot:null,ring:null,
     entrants:[mk({name:slugNick(s),id:s.id,genes:{...foodGenes(s)}}),
       ...state.offer.rivals.map(r=>mk({name:r.name,genes:{...r.genes},aim:r.aim,bot:true}))]};
   newRing();
   saveGame();close();openMatch();
 }
 /* วงเป้าสุ่มใหม่ทุกตา และอิง "ระยะสูงสุดของตัวที่กำลังปา" — ทากหงอนเล็กจะได้มีสิทธิ์เข้าเป้าเหมือนกัน */
 function newRing(e){const a=state.active,m=e?maxDist(e.genes):RING_MAX;
   a.ring=clamp(m*(.45+Math.random()*.5),RING_MIN,Math.min(RING_MAX,MAX_CM-8));}
 function openMatch(){
   const a=state.active,t=tankOf();if(!a||modal||ui)return;
   if(!t||!t.slugs.some(s=>s.id===a.entrants[0].id)){state.active=null;state.offer=null;leave();saveGame();return;}
   sprites=a.entrants.map((e,i)=>i===0?{...t.slugs.find(s=>s.id===e.id)}:{id:'throw-bot-'+i,genes:e.genes,state:'rest',ph:i*1.3,noBob:true,creepT:0});
   pops=[];camX=camZoom=null;
   ui=element('div');ui.id='throwTankHUD';document.body.classList.add('throw-in-tank');
   enterTank(t);ov.querySelector('.ov-body').append(ui);
   document.getElementById('ovTitle').textContent='🪨 ปาหินด้วยหงอน';
   buildHud(a);
   resizeTank();lastFrame=0;cameraKey='';
   if(a.settled)showResult();
 }
 function buildHud(a){
   const top=element('div',null,ui,'throw-top');
   hud.turn=element('div','',top,'throw-turn');hud.turn.setAttribute('role','status');
   hud.hint=element('div','',top,'throw-hint');
   hud.board=element('ol',null,ui,'eat-board');
   hud.rows=a.entrants.map((e,i)=>{const li=element('li',null,hud.board,i===0?'is-me':'');li.style.setProperty('--c',COLORS[i]);
     element('i',null,li);element('span',i===0?'คุณ':e.name,li);const b=element('b','0',li);return {li,b};});
   /* One arrow beside the thrower: angle first, then length = power. */
   hud.meters=element('div',null,ui,'throw-meters throw-aim-summary');
   hud.aimStep=element('strong','คลิกบนสนามเพื่อเริ่มเล็ง',hud.meters);
   hud.aimValue=element('span','องศา → ความแรง → ปา',hud.meters);
   hud.aimWarning=element('small','เส้นประ = วิถีก่อนบูสต์และคลื่น',hud.meters);
   ui.addEventListener('pointerdown',e=>{
     if(e.button!==0||e.target.closest('button')||cur()?.bot)return;
     if(['intro','angle','power'].includes(state.active?.phase)){e.preventDefault();tap();}
   });
   /* ---- ช่วงบิน: แถบเร่งแรง + แถบคลื่น ---- */
   const fly=element('div',null,ui,'throw-fly');hud.fly=fly;fly.hidden=true;
   const boost=element('div',null,fly,'throw-boost');
   const bh=element('div',null,boost,'throw-meter-head');hud.boostTitle=element('span','เร่งแรง — กด F / K สลับกัน',bh);hud.boostVal=element('b','0 ซม./วิ',bh);
   const bbar=element('div',null,boost,'throw-bar');hud.boostFill=element('i',null,bbar,'throw-fill');
   hud.boostTime=element('div','',boost,'throw-clock');
   hud.liveDist=element('div','0 ซม.',boost,'throw-live');
   const wave=element('div',null,fly,'throw-wavebox');wave.hidden=true; // ไม่แสดงแถบจังหวะคลื่นในตู้ปาหิน
   const wh=element('div',null,wave,'throw-meter-head');element('span','Space เมื่อคลื่นแตะครึ่งหน้าหิน',wh);hud.waveVal=element('b','',wh);
   hud.waveTrack=element('div',null,wave,'throw-wave-track');
   element('i',null,hud.waveTrack,'throw-wave-goal');
   /* มาตรวัดมุมหัวหิน — กลาง = ราบ/เพรียวลม · ซ้าย = หัวจม · ขวา = หัวเชิด */
   hud.pitchBox=element('div',null,wave,'throw-pitch');hud.pitchBox.hidden=true;
   element('i',null,hud.pitchBox,'throw-pitch-flat');
   hud.pitchMark=element('i',null,hud.pitchBox,'throw-pitch-mark');
   const pl=element('div',null,hud.pitchBox,'throw-pitch-labels');element('span','หัวจม',pl);element('span','ราบ',pl);element('span','หัวเชิด',pl);
   /* ---- ปุ่ม ---- */
   const controls=element('div',null,ui,'throw-controls');
   hud.keyF=element('button',null,controls,'throw-btn throw-side');hud.keyF.type='button';element('b','F',hud.keyF);
   hud.go=element('button',null,controls,'throw-btn');hud.go.type='button';
   hud.goLabel=element('b','ปา',hud.go);hud.goKey=element('small','คลิก / Space',hud.go,'throw-key');
   hud.keyK=element('button',null,controls,'throw-btn throw-side');hud.keyK.type='button';element('b','K',hud.keyK);
   hud.go.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();tap();};
   hud.keyF.onpointerdown=e=>{e.preventDefault();boostKey('f');};
   hud.keyK.onpointerdown=e=>{e.preventDefault();boostKey('k');};
   hud.skip=element('button','⏭ ข้ามตาบอท',ui,'throw-skip');hud.skip.type='button';hud.skip.hidden=true;
   hud.skip.onpointerdown=e=>{e.preventDefault();skipBot();};
 }

 /* ---------- จังหวะการเล่น ---------- */
 const sweep=(clock,speed)=>{const x=(clock*speed)%1;return x<.5?x*2:2-x*2;};
 const angleSpeed=()=>ANGLE_SPEED_BASE;
 const aimAngle=a=>a.lockAngle??(ANGLE_LO+(ANGLE_HI-ANGLE_LO)*sweep(a.clock,angleSpeed(a)));
 const aimPower=a=>a.lockPower??(a.phase==='power'||a.phase==='bot'?sweep(a.clock,SWEEP_POWER):.55);
 function projectedDirection(dx,dz){
   const p=S(0,LANE_Y,SAND_CELLS),q=S(dx,LANE_Y,SAND_CELLS+dz);
   return Math.atan2(q.y-p.y,q.x-p.x);
 }
 const aimGuide={key:'',points:new Float64Array(202),count:0,shot:{},state:{}};
 function previewTrajectory(angle,v,height=1.1*CM_PER_CELL){
   const key=angle.toFixed(2)+'|'+v.toFixed(2)+'|'+height.toFixed(2);
   if(aimGuide.key===key)return aimGuide;
   aimGuide.key=key;
   const r=angle*Math.PI/180,s=aimGuide.shot,a=aimGuide.state;
   Object.assign(s,{height,dist:0,angle,v,vx:v*Math.cos(r),vz:v*Math.sin(r),pitch:0});
   a.shot=s;a.clock=0;
   aimGuide.count=1;aimGuide.points[0]=0;aimGuide.points[1]=s.height;
   for(let i=1;i<=100;i++){
     const falling=i>40;
     if(i===41){a.clock=0;s.vz=0;s.timeScale=Math.sqrt(2*s.height/GRAVITY)/FALL_T;}
     a.clock+=.125;stepDynamicStone(a,.125,falling);
     aimGuide.points[i*2]=s.dist;aimGuide.points[i*2+1]=s.height;aimGuide.count++;
     if(falling&&s.height<=0)break;
   }
   return aimGuide;
 }
 function drawAimArrow(a){
   const loaded=loadedStone(a),origin=S(loaded.x,loaded.y,loaded.z);
   const angle=aimAngle(a),power=aimPower(a),scale=clamp(tankCam.zoom,.8,1.05)*1.6;   // ลูกศรใหญ่ให้มองง่าย
   const radians=angle*Math.PI/180;
   const length=(a.phase==='angle'?108:50+145*power)*scale,wide=12*scale;
   // Same force integrator as the stone; preview excludes future F/K and waves.
   const guide=previewTrajectory(angle,startSpeed(cur().genes,power,angle),(loaded.z-SAND_CELLS)*CM_PER_CELL);
   tctx.save();tctx.strokeStyle='rgba(220,255,244,.8)';tctx.lineWidth=2;
   tctx.setLineDash([4,6]);tctx.beginPath();
   for(let i=0;i<guide.count;i++){
     const p=S(loaded.x+guide.points[i*2]/CM_PER_CELL,loaded.y,SAND_CELLS+guide.points[i*2+1]/CM_PER_CELL);
     if(i)tctx.lineTo(p.x,p.y);else tctx.moveTo(p.x,p.y);
   }
   tctx.stroke();tctx.restore();
   tctx.save();tctx.translate(origin.x,origin.y);tctx.rotate(projectedDirection(Math.cos(radians),Math.sin(radians)));
   tctx.fillStyle='#e7ac42';tctx.strokeStyle='#a9f4e8';tctx.lineWidth=4;
   tctx.beginPath();tctx.moveTo(0,-wide*.45);tctx.lineTo(length-25*scale,-wide*.45);tctx.lineTo(length-30*scale,-wide);
   tctx.lineTo(length,0);tctx.lineTo(length-30*scale,wide);tctx.lineTo(length-25*scale,wide*.45);tctx.lineTo(0,wide*.45);tctx.closePath();tctx.fill();tctx.stroke();
   tctx.strokeStyle='#fff1be';tctx.lineWidth=2.5;tctx.beginPath();tctx.moveTo(6,0);tctx.lineTo(length-20*scale,0);tctx.stroke();
   tctx.restore();
 }
 function tap(){
   const a=state.active;if(!a||a.settled)return false;
   const e=cur();
   if(a.phase==='intro'){if(e?.bot)return false;startTurn();saveGame();return true;}
   if(e?.bot)return false;
   if(a.phase==='power'){a.lockPower=sweep(a.clock,SWEEP_POWER);launch();saveGame();return true;}
   if(a.phase==='angle'){a.lockAngle=ANGLE_LO+(ANGLE_HI-ANGLE_LO)*sweep(a.clock,angleSpeed(a));a.phase='power';a.clock=0;saveGame();return true;}
   if(a.phase==='waves'){return pitchUp(a);}
   return false;
 }
 /* กด F/K สลับกันตอนเร่งแรง (กดปุ่มเดิมซ้ำไม่นับ แบบชักเย่อ) */
 const boostCap=makePressLimiter();       // เพดาน 20 ครั้ง/วิ (config.js) กันมาโครอัดความเร็ว
 function boostKey(k){
   const a=state.active;if(!a||a.settled||a.phase!=='boost'||cur()?.bot)return false;
   if(lastBoostKey===k)return false;
   if(!boostCap())return false;
   lastBoostKey=k;boostImpulse(a.shot);
   boostFlashUntil=a.clock+.16;
   hud[k==='f'?'keyF':'keyK']?.animate([{transform:'translateY(4px) scale(.94)',filter:'brightness(1.5)'},{transform:'none',filter:'none'}],{duration:130});
   return true;
 }
 function startTurn(){
   const a=state.active,e=cur();
   a.lockPower=a.lockAngle=null;a.shot=null;a.clock=0;lastBoostKey=null;
   newRing(e);
   a.aimStyle='arrow1';a.phase=e.bot?'bot':'angle';
   if(e.bot){const miss=1-e.aim;a.botPower=clamp(1-Math.random()*miss*.3,.25,1);a.botAngle=clamp(BEST_ANGLE+(Math.random()*2-1)*miss*20,ANGLE_LO,ANGLE_HI);}
 }
 function nextTurn(){
   const a=state.active;
   a.turn++;
   if(a.turn>=a.entrants.length){a.turn=0;a.round++;}
   if(a.round>=THROWS){settle();return;}
   if(cur()?.bot)startTurn();
   else{a.phase='intro';a.clock=0;a.shot=null;a.lockAngle=null;a.lockPower=null;}
 }
 function launch(){
   const a=state.active,e=cur(),loaded=loadedStone(a);
   a.shot={physics:3,originX:loaded.x*CM_PER_CELL,originY:loaded.y,height:(loaded.z-SAND_CELLS)*CM_PER_CELL,v:startSpeed(e.genes,a.lockPower,a.lockAngle),gain:THROW_PRESS*FORCE_MUL*armMul(e.genes),
     angle:a.lockAngle,presses:0,waves:[],by:a.turn,dist:0,pitch:0};
   a.shot.waves=rollWaves();
   const r=a.shot.angle*Math.PI/180;
   a.shot.vx=a.shot.v*Math.cos(r);a.shot.vz=a.shot.v*Math.sin(r);
   a.shot.timeScale=Math.max(.01,a.shot.vz/(GRAVITY*BOOST_T));
   a.phase='boost';a.clock=0;lastBoostKey=null;boostFlashUntil=0; }
 /* เดินฟิสิกส์หินหนึ่งเฟรม: ความเร็วตกตามแรงต้าน แล้วบวกระยะที่วิ่งได้จริง */
 /* แรงต้านจากมุมหัว: ราบ (|มุม| ≤ PITCH_FLAT) = 1 เท่า · เชิด/จมสุด = 1+PITCH_DRAG เท่า */
 const pitchDrag=s=>1+PITCH_DRAG*clamp((Math.abs(s.pitch||0)-PITCH_FLAT)/(PITCH_MAX-PITCH_FLAT),0,1);
 // 2 g stone, 3 cm² cross-section, air density 1.225 kg/m³.
 // a_drag = rho * Cd * A * |v| * v / (2m); velocities stored in cm/s.
 const AIR_K=1.225*.0003/(2*.002)/100;
 function boostImpulse(s){
   s.presses++;
   if(s.physics===3){
     const r=s.angle*Math.PI/180;
     s.vx+=s.gain*Math.cos(r);s.vz+=s.gain*Math.sin(r);
     s.v=Math.hypot(s.vx,s.vz);
   }else s.v+=s.gain;
 }
 function stepDynamicStone(a,dt,falling){
   const s=a.shot,oldX=s.dist,oldZ=s.height;
   // Remap physical seconds to game seconds ONLY to preserve the requested 5 s apex.
   // Gravity, drag, position and velocity are still integrated on every substep.
   if(!falling){
     const remaining=Math.max(dt,BOOST_T-(a.clock-dt));
     s.timeScale=Math.max(.00001,s.vz/(GRAVITY*remaining));
     if(s.angle===0)s.timeScale=.03; // horizontal release has no upward component
   }
   const h=dt*s.timeScale,speed=Math.hypot(s.vx,s.vz);
   const cd=.3+3*Math.sin((s.pitch||0)*Math.PI/180)**2;
   const k=AIR_K*cd*speed;
   const vx=s.vx*Math.exp(-k*h);
   let vz=(s.vz+GRAVITY/Math.max(k,1e-12))*Math.exp(-k*h)-GRAVITY/Math.max(k,1e-12);
   if(k<1e-8)vz=s.vz-GRAVITY*h;
   if(!falling)vz=Math.max(0,vz);
   s.dist=Math.min(MAX_CM,s.dist+(s.vx+vx)*.5*h);
   s.height=Math.max(0,s.height+(s.vz+vz)*.5*h);
   s.vx=vx;s.vz=vz;s.v=Math.hypot(vx,vz);
   if(!s.glass&&s.dist>=MAX_CM&&s.height>0){   // ชนกระจกท้ายตู้ — หยุดพุ่ง ร่วงลงตรง ๆ
     s.glass=true;s.vx=0;s.v=Math.abs(s.vz);
     pops.push({x:stoneX(a)/CM_PER_CELL,y:LANE_Y,text:'ปั้ก! ติดกระจก +'+GLASS_BONUS,color:'#bfe8ff',t:0});
   }
   if(s.glass)s.vx=0;
   s.drag=AIR_K*cd*s.v*s.v;
   s.pitch=(s.pitch||0)*Math.exp(-dt/.45);
   const dx=s.dist-oldX,dz=s.height-oldZ;
   if(Math.abs(dx)+Math.abs(dz)>1e-10){s.directionX=dx;s.directionZ=dz;}
 }
 function stepStone(a,dt,falling){
   const s=a.shot;if(!s)return;
   if(s.physics===3){stepDynamicStone(a,dt,falling);return;}
   if(s.physics===2){
     const oldX=s.dist,oldZ=s.height;
     const angle=s.angle*Math.PI/180;
     if(!falling){
       // Smooth accepted impulses visually without moving the 5-second apex.
       s.displayV=(s.displayV??s.v)+(s.v-(s.displayV??s.v))*(1-Math.exp(-dt*18));
       const u=clamp(a.clock/BOOST_T,0,1),v=s.displayV;
       s.range=v*v*Math.sin(2*angle)/GRAVITY;
       s.apex=v*v*Math.sin(angle)**2/(2*GRAVITY);
       s.dist=Math.min(MAX_CM,s.range*.5*u);
       s.height=s.apex*(2*u-u*u);
     }else{
       const u=clamp(a.clock/FALL_T,0,1);
       s.height=s.apex*(1-u*u);
       // Wave control remains an arcade drag penalty, not extra propulsion.
       const drag=DRAG_FALL*(pitchDrag(s)-1);
       s.glide=(s.glide??1)*Math.exp(-drag*dt);
       s.dist=Math.min(MAX_CM,s.dist+s.range/(2*FALL_T)*s.glide*dt);
       s.pitch=(s.pitch||0)*Math.exp(-dt/PITCH_EASE);
     }
     const dx=s.dist-oldX,dz=s.height-oldZ;
     if(Math.abs(dx)+Math.abs(dz)>1e-10){s.directionX=dx;s.directionZ=dz;}
     return;
   }
   s.v=Math.max(0,s.v-s.v*(falling?DRAG_FALL*pitchDrag(s):DRAG)*dt);
   s.dist=Math.min(MAX_CM,s.dist+s.v*dt*(falling?1:ASCENT));
   if(falling)s.pitch=(s.pitch||0)*Math.exp(-dt/PITCH_EASE);   // หัวค่อย ๆ คืนแนวราบเอง ปล่อยมือแล้วพอแก้ตัวได้
 }
 /* Contact starts at the nose; the crest reaches the midpoint after WAVE_WINDOW.
    One attempt per wave prevents repeated presses from replacing timing. */
 function pitchUp(a){
   const s=a.shot;if(!s||a.phase!=='waves')return false;
   const w=s.waves.find(w=>w.hit==null&&a.clock<=w.at+waveWin(w)+1e-9);
   if(!w||w.tried)return false;
   w.tried=true;
   w.countered=a.clock>=w.at-1e-9&&a.clock<=w.at+waveWin(w)+1e-9;
   s.pitch=w.countered?0:PITCH_PRESS;
   if(w.countered)waveHits(a,w,null);
   pops.push({x:stoneX(a)/CM_PER_CELL,y:LANE_Y,text:w.countered?'ฝ่าไปได้!':'เร็วไป! รอคลื่นแตะหน้าหิน',color:w.countered?'#9fe3ee':'#ff8a7a',t:0});
   return true;
 }
 /* คลื่นถึงตัวหิน — ผลขึ้นกับมุมหัวตอนนั้น */
 function waveHits(a,w,aim){
   if(w.hit!=null)return w.hit;
   const s=a.shot;
   w.hit=!!w.countered;
   s.pitch=w.hit?0:-PITCH_WAVE;
   w.pitch=Math.round(s.pitch);
   if(s.physics===3){
     const incoming=Math.hypot(s.vx,s.vz);
     const loss=w.hit?.01:clamp(.22+Math.abs(s.pitch)/180,.22,.6);
     s.vx*=1-loss;
     if(!w.hit)s.vz-=incoming*.08;
     s.v=Math.hypot(s.vx,s.vz);
     w.speedBefore=incoming;w.speedAfter=s.v;
   }
   return w.hit;
 }
 const stoneX=a=>(a.shot?.originX??START_CM)+(a.shot?a.shot.dist:0);
 function finishShot(){
   const a=state.active,s=a.shot,e=a.entrants[s.by];
   const dist=clamp(s.dist+(s.originX??START_CM)-START_CM,0,MAX_CM);
   const onRing=Math.abs(dist-a.ring)<=RING_HALF;
   const glass=!!s.glass;
   const score=Math.round(dist)+(onRing?RING_BONUS:0)+(glass?GLASS_BONUS:0);
   e.shots.push({dist,score,ring:onRing,glass});
   pops.push({x:(START_CM+dist)/CM_PER_CELL,y:LANE_Y,text:dist.toFixed(0)+' ซม.'+(onRing?' +'+RING_BONUS+' เข้าเป้า!':'')+(glass?' +'+GLASS_BONUS+' ติดกระจก!':''),color:onRing?'#9fe3a6':glass?'#bfe8ff':COLORS[s.by],t:0});
   a.phase='land';a.clock=0;
 }
 function skipBot(){
   const a=state.active;if(!a||a.settled||!cur()?.bot)return;
   /* ข้าม: จำลองผลตาบอทตัวนี้ทันที (ใช้สูตรเดียวกับที่บอทเล่นจริง) */
   if(a.phase==='bot'){a.lockPower=a.botPower;a.lockAngle=a.botAngle;launch();}
   // Continue the current shot, including partially played turns, using the same simulation.
   for(let i=0;i<1500&&flying(a);i++)advance(1/120);
 }
 function advance(dt){
   const a=state.active;if(!a||a.settled)return;
   if(cur()?.bot&&a.phase!=='intro'&&!(a.shot?.physics>=2))dt*=BOT_SPEED;
   while(dt>1e-9){
     const end=a.phase==='boost'?BOOST_T:a.phase==='waves'&&a.shot?.physics===2?FALL_T:Infinity;
     const step=Math.min(dt,1/120,Math.max(1e-9,end-a.clock));
     advanceStep(step);dt-=step;
   }
 }
 function advanceStep(dt){
   const a=state.active;if(!a||a.settled)return;
   const e=cur(),bot=!!e?.bot;
   a.clock+=dt;
   if(a.phase==='intro'){if(bot&&a.clock>1)startTurn();return;}
   if(a.phase==='bot'){if(a.clock>1.1){a.lockPower=a.botPower;a.lockAngle=a.botAngle;launch();}return;}
   if(a.phase==='boost'){
     if(bot){                                               // บอทกด F/K ตามความแม่น (กี่ครั้ง/วิ)
       const rate=4+6*e.aim;
       a.shot._acc=(a.shot._acc||0)+rate*dt;
       while(a.shot._acc>=1){a.shot._acc--;boostImpulse(a.shot);}
     }
     stepStone(a,dt,false);
     if(a.clock>=BOOST_T-1e-9){
       if(a.shot.physics===3){
         a.shot.vz=0;
         a.shot.timeScale=Math.sqrt(2*a.shot.height/GRAVITY)/FALL_T;
         a.shot.apex=a.shot.height;
       }
       a.phase='waves';a.clock=0;
     }
     return;
   }
   if(a.phase==='waves'){
     if(bot){
       for(const w of a.shot.waves)if(w.hit==null&&!w.botTried&&a.clock>=w.at+waveWin(w)*.45){
         w.botTried=true;if(Math.random()<e.aim)pitchUp(a);
       }
     }
     for(const w of a.shot.waves){
       if(w.hit!=null||a.clock<=w.at+waveWin(w)+1e-9)continue;
       const ok=waveHits(a,w,bot?e.aim:null);
       const p=a.shot.pitch;
       pops.push({x:stoneX(a)/CM_PER_CELL,y:LANE_Y,
         text:ok?'ฝ่าไปได้!':'คลื่นซัด!',
         color:ok?'#9fe3ee':'#ff8a7a',t:0});
     }
     stepStone(a,dt,true);
     if(a.shot.physics===3?(a.shot.height<=0||a.clock>=12):a.shot.physics===2?a.clock>=FALL_T-1e-9:a.shot.waves.every(w=>w.hit!=null)&&a.clock>a.shot.waves[WAVES-1].at){a.shot.height=0;finishShot();}
     return;
   }
   if(a.phase==='land'&&a.clock>1){nextTurn();return;}
 }
 function settle(){
   const a=state.active;if(!a||a.settled)return;
   const order=a.entrants.map((e,i)=>i).sort((x,y)=>scoreOf(a.entrants[y])-scoreOf(a.entrants[x])||x-y);
   a.order=order;a.rank=order.indexOf(0)+1;a.phase='done';
   a.delta=a.practice?0:(a.rank===1?a.wager*3:a.rank===2?a.wager*2:a.rank===3?0:-a.wager)||0;   // 2026-09-23 ผู้เล่นกำหนด: 1=+3เท่า 2=+2เท่า 3=เสมอตัว 4=เสียเท่าเดิมพัน
   addCoin(a.delta);a.settled=true;saveGame();syncHUD();
   if(typeof playNotificationSound==='function')playNotificationSound(a.rank===1?'tugWin':'tugLose');
   if(a.rank===1&&window.Fireworks)Fireworks.play({count:12,duration:3400});
   setTimeout(()=>{if(state.active===a&&!modal)showResult();},1000);
 }
 function complete(){
   const a=state.active,t=tankOf(),me=a?.entrants[0];
   const s=t?.slugs.find(x=>x.id===me?.id);if(s){s.state='rest';s.stt=1;s.wall=null;s.climbZ=0;}
   /* ซ้อม: ไม่ยุ่งกับคำท้าที่ค้างอยู่ ไม่รีเซ็ตนาฬิกา และอยู่ในตู้ต่อ */
   if(a?.practice){state.active=null;close();saveGame();return;}
   state.active=null;state.offer=null;leave();close();exitTank();reschedule();saveGame();
 }
 function showResult(){
   const a=state.active;if(!a?.settled||modal)return;
   /* บอกระบบเควสว่าชนะแล้ว (quests.js) — ธง _qWin กันนับซ้ำ เพราะกลับเข้าตู้ตอน settled แล้วจะเรียก showResult ใหม่ */
   if(a.rank===1&&!a._qWin){a._qWin=true;window.questContestWin?.();}
   const titles=['','ชนะเลิศ! 🪨','ได้ที่ 2','ได้ที่ 3','ได้ที่ 4'];
   const d=dialog(titles[a.rank]);d.classList.add('race-result','eat-result');
   d.addEventListener('cancel',e=>{e.preventDefault();complete();});
   element('p',a.rank===1?'แขนหงอนที่สุดในร้าน!':'จับจังหวะคลื่นให้ครบอีกนิดเดียว',d,'race-result-caption');
   const podium=element('div',null,d,'race-podium eat-podium');
   for(const place of [2,1,3,4]){
     const i=a.order[place-1],e=a.entrants[i],step=element('div',null,podium,'race-podium-step place-'+place+(i===0?' is-player':''));
     element('span',i===0?'คุณ':e.name,step,'race-podium-name');
     const c=element('canvas',null,step);c.width=180;c.height=110;c.setAttribute('role','img');c.setAttribute('aria-label',e.name);
     const sprite=slugSprite({genes:e.genes});if(sprite){const k=Math.min(160/sprite.c.width,100/sprite.c.height),w=sprite.c.width*k,h=sprite.c.height*k;c.getContext('2d').drawImage(sprite.c,(180-w)/2,(110-h)/2,w,h);}
     const block=element('div',null,step,'race-podium-block');element('span',['','🥇','🥈','🥉','🪨'][place],block,'race-medal');element('b',scoreOf(e)+' แต้ม',block);
     element('small',e.shots.map(s=>s.dist.toFixed(0)+(s.ring?'🎯':'')+(s.glass?'🪟':'')).join(' · '),step,'throw-shots');
   }
   const receipt=element('div',null,d,'race-receipt');
   if(a.practice){
     element('span','โหมดซ้อม',receipt);
     element('strong','ไม่มีเดิมพัน',receipt);
     element('small','ซ้อมได้ไม่จำกัด · คำท้าจริงถึงจะมีเงินรางวัล',receipt);
   }else{
     element('span','เดิมพัน '+a.wager.toLocaleString()+' ทอง',receipt);
     element('strong',(a.delta>0?'ได้รับ +':a.delta<0?'เสีย ':'ไม่เสีย ไม่ได้เพิ่ม · ')+a.delta.toLocaleString()+' ทอง',receipt);
     element('small','ทองคงเหลือ '+G.coin.toLocaleString(),receipt);
     element('p',a.rank===1?'ผู้ท้า: หงอนอะไรแรงขนาดนั้น!':'ผู้ท้า: ซ้อมโต้คลื่นมาอีกหน่อยนะ',d,'race-taunt');
   }
   const done=element('button',a.practice?'จบการซ้อม':'รับทราบ · กลับร้าน',d,'tbtn');done.onclick=complete;done.focus();
   if(a.rank===1&&window.Fireworks)Fireworks.play({count:5,duration:1600});
 }

 /* ---------- วาดสนาม ---------- */
 function drawField(c,project,t){
   t=t||tank();if(!t)return;
   const y0=0,y1=LANE_H;
   const line=(x,color,lw)=>{const p=project(x,y0),q=project(x,y1);c.strokeStyle=color;c.lineWidth=lw;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();};
   c.save();
   const quad=[project(0,y0),project(t.def.w,y0),project(t.def.w,y1),project(0,y1)];
   c.fillStyle='rgba(120,150,160,.2)';c.beginPath();quad.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();
   for(let cm=25;cm<FIELD_CM;cm+=25)line((START_CM+cm)/CM_PER_CELL,'rgba(255,245,220,.55)',1.6);
   line(START_CM/CM_PER_CELL,'rgba(255,211,107,.95)',3);
   c.restore();
 }
 const glSlugs=()=>!!(engineReady&&window.DecorGLB?.ready&&window.Slug3D?.ready&&Slug3D.enabled);
 function drawSlugAt(s,x,y,heading,st){
   s.fx=x;s.fy=y;s.wall=null;s.climbZ=0;s._motionHeading=s.dir=s.turn=heading;s.state=st;
   s.flip=Math.cos(heading)*CELLW+Math.sin(heading)*DEPX>0;
   if(glSlugs()&&DecorGLB.drawSlug(s))return;
   const len=TANK_SLUG_VIEW_SCALE*slugCm(s.genes)*depthPxPerCm(),p=S(x,y,SAND_CELLS);
   const dir={x:CELLW*Math.cos(heading)+DEPX*Math.sin(heading),y:-DEPY*Math.sin(heading)};
   if(engineReady&&window.Slug3D?.draw(tctx,s,p.x,p.y,len,false,dir))return;
   const P=slugPartsOf(s);if(!P)return;
   const scale=len/(P.bw*P.s),h=P.h*scale;
   drawTankSlug(s,P,scale,p.x-((P.L+P.R)/2-P.bw/2)*P.s*scale,p.y-h*.44,false);
 }
 function nameTag(text,x,y,bg,fg){
   const p=S(x,y,SAND_CELLS),h=Math.max(14,16*tankCam.zoom);
   tctx.save();tctx.font='bold '+Math.max(10,11*tankCam.zoom).toFixed(0)+'px "IBM Plex Sans Thai",sans-serif';tctx.textAlign='center';tctx.textBaseline='middle';
   const w=tctx.measureText(text).width+14;tctx.fillStyle=bg;tctx.beginPath();tctx.roundRect(p.x-w/2,p.y+h*.5,w,h,h/2);tctx.fill();
   tctx.fillStyle=fg;tctx.fillText(text,p.x,p.y+h);tctx.restore();
 }
 function items(){
   const a=state.active;if(!a)return [];
   const out=a.entrants.map((e,i)=>({sortY:i===a.turn?LANE_Y:standSpot(i,false).y,kind:'throw',part:'slug',i}));
   out.push({sortY:-1e9,kind:'throw',part:'marks'});
   out.push({sortY:-1e9-1,kind:'throw',part:'stone'});
   return out;
 }
 function drawItem(it){
   const a=state.active;if(!a)return;
   if(it.part==='stone'&&['intro','angle','power','bot'].includes(a.phase)){
     if(a.phase!=='intro')drawAimArrow(a);
     const q=loadedStone(a);drawStone(S(q.x,q.y,q.z),Math.max(3,6*tankCam.zoom));return;
   }
   if(it.part==='slug'){
     const e=a.entrants[it.i],s=sprites[it.i];if(!s)return;
     const active=it.i===a.turn&&!a.settled,sp=standSpot(it.i,active);
     const preparing=active&&['intro','angle','power','bot'].includes(a.phase);
     s.noBob=true;
     if(preparing)s.throwLean=.15+aimAngle(a)/90*.8;
     else if(active&&a.phase==='boost'&&a.clock<.3)s.throwLean=-.25*(1-a.clock/.3);
     else delete s.throwLean;
     // 2D renderer uses its existing appendage pose; 3D uses radians directly.
     if(s.throwLean!==undefined)s.tugLean=clamp(s.throwLean/.6,-1,1);else delete s.tugLean;
     const st='rest';
     drawSlugAt(s,sp.x,sp.y,0,st);
     nameTag((it.i===0?'คุณ':e.name)+(e.shots.length?' · '+scoreOf(e):''),sp.x,sp.y,it.i===0?'#153c42':'rgba(30,20,16,.85)',COLORS[it.i]);
     return;
   }
   if(it.part==='marks'){
     /* วงเป้าโบนัสของไม้นี้ */
     if(a.ring&&!a.settled){
       const x0=(START_CM+a.ring-RING_HALF)/CM_PER_CELL,x1=(START_CM+a.ring+RING_HALF)/CM_PER_CELL;
       const q=[S(x0,0.15,SAND_CELLS),S(x1,0.15,SAND_CELLS),S(x1,LANE_H-.15,SAND_CELLS),S(x0,LANE_H-.15,SAND_CELLS)];
       tctx.save();tctx.fillStyle='rgba(159,227,166,.28)';tctx.strokeStyle='#9fe3a6';tctx.lineWidth=Math.max(1.5,2*tankCam.zoom);
       tctx.beginPath();q.forEach((p,i)=>i?tctx.lineTo(p.x,p.y):tctx.moveTo(p.x,p.y));tctx.closePath();tctx.fill();tctx.stroke();
       const c=S((x0+x1)/2,0.15,SAND_CELLS);
       tctx.font='bold '+Math.max(11,13*tankCam.zoom).toFixed(0)+'px "IBM Plex Sans Thai",sans-serif';tctx.textAlign='center';tctx.textBaseline='bottom';
       tctx.fillStyle='#d8ffd8';tctx.fillText('🎯 +'+RING_BONUS,c.x,c.y-4);tctx.restore();
     }
     /* หมุดไม้ล่าสุดของแต่ละตัว */
     a.entrants.forEach((e,i)=>{
       if(!e.shots.length)return;
       const last=e.shots[e.shots.length-1];
       const p=S((START_CM+last.dist)/CM_PER_CELL,LANE_Y+1.7,SAND_CELLS),h=Math.max(10,16*tankCam.zoom);
       tctx.save();tctx.strokeStyle=COLORS[i];tctx.lineWidth=Math.max(1.5,2*tankCam.zoom);
       tctx.beginPath();tctx.moveTo(p.x,p.y);tctx.lineTo(p.x,p.y-h);tctx.stroke();
       tctx.fillStyle=COLORS[i];tctx.beginPath();tctx.moveTo(p.x,p.y-h);tctx.lineTo(p.x+h*.5,p.y-h*.8);tctx.lineTo(p.x,p.y-h*.6);tctx.closePath();tctx.fill();
       tctx.restore();
     });
     for(const q of pops){
       const p=S(q.x,q.y,SAND_CELLS+1+q.t*1.5);
       tctx.save();tctx.globalAlpha=Math.max(0,1-q.t);tctx.textAlign='center';
       tctx.font='bold '+Math.max(14,18*tankCam.zoom).toFixed(0)+'px "IBM Plex Sans Thai",sans-serif';
       tctx.lineWidth=4;tctx.strokeStyle='#102a2e';tctx.strokeText(q.text,p.x,p.y);tctx.fillStyle=q.color;tctx.fillText(q.text,p.x,p.y);tctx.restore();
     }
     return;
   }
   if(it.part==='stone'&&flying(a)&&a.shot){
     const s=a.shot,x=stoneX(a)/CM_PER_CELL;
     const p=S(x,s.originY??LANE_Y,stoneHeight(a)),ahead=S(x+1,s.originY??LANE_Y,stoneHeight(a));
     const radians=s.angle*Math.PI/180;
     const flightAngle=s.physics>=2?projectedDirection(s.directionX??Math.cos(radians),s.directionZ??Math.sin(radians)):Math.atan2(ahead.y-p.y,ahead.x-p.x);
     const r=Math.max(3,6*tankCam.zoom);
     if(p.x<-400||p.x>TCW+400||p.y<-300||p.y>TCH+300)return;
     /* คลื่นที่กำลังซัดเข้ามาหาหิน (ช่วงหินตก) */
     if(a.phase==='waves'){
       for(const w of s.waves){
         const lead=w.at-a.clock,win=waveWin(w);if(lead<-win-.3||lead>1.6)continue;
         // Same nose-to-midpoint coordinate used by the input window, independent of zoom.
         const stoneAngle=flightAngle-(s.pitch||0)*Math.PI/180;
         const front=r*Math.hypot(1.8*Math.cos(stoneAngle),.95*Math.sin(stoneAngle));
         const distance=front*(1+lead/win),span=TCH;

         tctx.save();tctx.translate(p.x,p.y);
         tctx.globalAlpha=clamp((1.6-lead)*2,0,.7)*(w.hit===true?.32:1)*clamp((lead+win+.3)/.3,0,1);
         tctx.drawImage(waveImage(),distance,-p.y,r*7,span);tctx.restore();

       }
     }
     if(a.phase==='boost'){
       const speed=clamp(s.v/(s.physics>=2?400:40),.12,1),flash=clamp((boostFlashUntil-a.clock)/.16,0,1);
       tctx.save();tctx.translate(p.x,p.y);tctx.rotate(flightAngle);tctx.lineCap='round';
       // Eight curved water trails, no particle objects or extra animation loop.
       for(let i=0;i<8;i++){
         const travel=(a.clock*(1.5+speed*2)+i*.173)%1;
         const y=((i%4)-1.5)*r*.9,tail=-r*(2+travel*7),length=r*(1+speed*2.8);
         tctx.strokeStyle='rgba(161,229,237,'+((1-travel)*(.35+speed*.45+flash*.2)).toFixed(3)+')';
         tctx.lineWidth=(1+flash)*Math.max(1,tankCam.zoom*.45);
         tctx.beginPath();tctx.moveTo(tail,y);tctx.quadraticCurveTo(tail-length*.5,y+r*.12,tail-length,y+r*.35);tctx.stroke();
       }
       tctx.strokeStyle='rgba(235,255,255,'+(.25+flash*.65)+')';tctx.lineWidth=Math.max(1,tankCam.zoom*.5);
       tctx.beginPath();tctx.ellipse(0,0,r*2.1,r*1.05,0,-.8,.8);tctx.stroke();tctx.restore();
     }
     /* หันตามทิศการเคลื่อนที่จริง แล้วบวกมุมหัวที่ผู้เล่นประคอง */
     const pitch=a.phase==='waves'?(s.pitch||0):0;
     drawStone(p,r,flightAngle-pitch*Math.PI/180);
     if(a.phase==='waves'&&Math.abs(pitch)>PITCH_FLAT){        // ริ้วลมปะทะตอนไม่เพรียว
       tctx.save();tctx.strokeStyle='rgba(255,138,122,'+clamp(Math.abs(pitch)/PITCH_MAX,.25,.8).toFixed(2)+')';
       tctx.lineWidth=Math.max(1,1.6*tankCam.zoom);
       for(let k=-1;k<=1;k++){tctx.beginPath();tctx.moveTo(p.x+r*2.2,p.y+k*r*.7);tctx.lineTo(p.x+r*3.6,p.y+k*r*.7);tctx.stroke();}
       tctx.restore();
     }
   }
 }
 /* กล้อง: ตอนเล็ง/ประกาศผลเห็นทั้งลาน · ตอนหินลอยซูมเข้าไปเกาะหิน */
 function camera(t,dt){
   const a=state.active;
   const key=TCW+'|'+TCH;
   if(cameraKey!==key){cameraKey=key;camZoom=null;camX=null;}
   tankCam.zoom=1;tankCam.ox=0;tankCam.oy=0;
   const pts=[S(0,0,SAND_CELLS),S(t.def.w,0,SAND_CELLS),S(0,t.def.h,SAND_CELLS+3),S(t.def.w,t.def.h,SAND_CELLS+3)];
   const x0=Math.min(...pts.map(p=>p.x)),x1=Math.max(...pts.map(p=>p.x)),y0=Math.min(...pts.map(p=>p.y)),y1=Math.max(...pts.map(p=>p.y));
   const topPad=78,botPad=TCW<700?210:170;
   const fit=clamp(Math.min((TCW-24)/(x1-x0),(TCH-topPad-botPad)/(y1-y0)),.2,4);
   const aiming=a&&['intro','angle','power','bot'].includes(a.phase);
   const wantZoom=a?.phase==='boost'?clamp(fit*4.8,3.2,5):a?.phase==='waves'?clamp(fit*3.4,2.2,4.3):aiming?clamp(fit*2.5,1.7,3):fit;
   const wantX=flying(a)?stoneX(a)/CM_PER_CELL:aiming?START_CM/CM_PER_CELL+2:t.def.w/2;
   const k=1-Math.exp(-dt*6);
   camZoom=camZoom==null?wantZoom:camZoom+(wantZoom-camZoom)*k;
   camX=camX==null?wantX:camX+(wantX-camX)*k;
   tankCam.zoom=camZoom;
   const c=S(camX,LANE_Y,flying(a)&&a.shot?stoneHeight(a):SAND_CELLS+(aiming?1:0));
   tankCam.ox=TCW/2-c.x;tankCam.oy=(topPad+(TCH-botPad))/2-c.y;tankNeedFit=false;
 }
 function updateHud(a){
   const e=cur(),mine=e&&!e.bot;
   const turnText=a.settled?'จบการแข่งขัน':'ไม้ที่ '+(a.round+1)+'/'+THROWS+' · '+(mine?'ตาคุณ':'ตา'+e.name);
   if(hud.turn.textContent!==turnText)hud.turn.textContent=turnText;
   const missed=a.shot?a.shot.waves.filter(w=>w.hit===false).length:0;
   const hint=a.settled?''
     :a.phase==='intro'?'คลิกบนสนามเพื่อเริ่มเล็ง'
     :a.phase==='power'?'ลูกศรยิ่งยาวยิ่งแรง — คลิกอีกครั้งเพื่อปา'
     :a.phase==='angle'?'คลิกล็อกทิศลูกศร — 45° ไกลสุด'
     :a.phase==='bot'?e.name+' กำลังเล็ง…'
     :a.phase==='boost'?(mine?'กด F / K สลับกันรัว ๆ!':e.name+' กำลังเร่งแรง')
     :a.phase==='waves'?(mine?'กด Space เมื่อคลื่นแตะหน้าหิน ก่อนเลยครึ่งก้อน · 1 ครั้ง/ลูก':e.name+' กำลังประคองหัวหิน')
     :a.shot?a.shot.dist.toFixed(0)+' ซม.'+(missed?' · เสียทรง '+missed+' ลูก':''):'';
   if(hud.hint.textContent!==hint)hud.hint.textContent=hint;
   /* แถบเล็ง */
   const aiming=a.phase==='power'||a.phase==='angle'||a.phase==='bot'||a.phase==='intro';
   hud.meters.hidden=!aiming||a.settled;ui.classList.toggle('is-aiming',aiming&&mine&&!a.settled);
   hud.fly.hidden=!flying(a);
   if(aiming){
     const angle=aimAngle(a),power=aimPower(a);
     hud.aimStep.textContent=a.phase==='angle'?'1 · คลิกล็อกองศา':a.phase==='power'?'2 · คลิกเลือกแรงแล้วปา':a.phase==='bot'?'คู่แข่งกำลังเล็ง':'คลิกบนสนามเพื่อเริ่มเล็ง';
     hud.aimValue.textContent=a.phase==='intro'?'องศา → ความแรง → ปา':Math.round(angle)+'° · '+(a.phase==='angle'?'รอเลือกแรง':Math.round(power*100)+'%');
     hud.aimWarning.hidden=a.phase!=='power';
   }
   /* แถบบิน */
   if(flying(a)){
     const s=a.shot;
     hud.boostTitle.textContent=a.phase==='boost'?'ความเร็วจริง — F / K เพิ่มแรง':'ความเร็วจริง — แรงโน้มถ่วง + แรงต้าน';
     hud.boostFill.style.width=clamp(s.v/(s.physics>=2?400:40)*100,0,100)+'%'; // มาตรวัด ไม่ใช่เพดานแรง
     hud.boostVal.textContent=s.v.toFixed(0)+' ซม./วิ';
     hud.boostTime.textContent=a.phase==='boost'?'บูสต์ขึ้นยอดอีก '+Math.max(0,BOOST_T-a.clock).toFixed(1)+' วิ':'หินกำลังตก';
     hud.liveDist.textContent=s.dist.toFixed(0)+' ซม. · '+(s.physics===3?'แรงต้าน '+(s.drag||0).toFixed(1)+' ซม./วิ²':'กดไปแล้ว '+s.presses+' ครั้ง');
   }
   /* คะแนนรวม */
   a.entrants.forEach((x,i)=>{const s=String(scoreOf(x));if(hud.rows[i].b.textContent!==s)hud.rows[i].b.textContent=s;});
   const order=a.entrants.map((x,i)=>i).sort((p,q)=>scoreOf(a.entrants[q])-scoreOf(a.entrants[p])||p-q);
   order.forEach((i,k)=>{hud.rows[i].li.style.order=String(k);});
   /* ปุ่ม */
   const boosting=a.phase==='boost'&&mine;
   hud.keyF.hidden=hud.keyK.hidden=!boosting;
   hud.go.disabled=a.settled||!mine||!(a.phase==='intro'||a.phase==='power'||a.phase==='angle'||a.phase==='waves');
   const canCounter=a.phase==='waves'&&a.shot.waves.some(w=>w.hit==null&&!w.tried&&a.clock>=w.at&&a.clock<=w.at+waveWin(w));
   hud.go.classList.toggle('is-live',!hud.go.disabled&&(a.phase!=='waves'||canCounter));
   hud.goLabel.textContent=a.phase==='waves'?(canCounter?'กดตอนนี้!':'รอคลื่น'):a.phase==='intro'?'เริ่มเล็ง':a.phase==='angle'?'ล็อกองศา':'ปา';
   hud.skip.hidden=a.settled||!e?.bot;
 }
 function updateTankFrame(now){
   const a=state.active,t=tankOf();if(!a||!t||!ui||document.hidden)return;
   const dt=Math.max(0,Math.min(.05,(now-(lastFrame||now))/1000));lastFrame=now;
   advance(dt);
   pops=pops.filter(p=>(p.t+=dt*.8)<1);
   camera(t,dt);if(hud.turn)updateHud(a);
   if(now-lastSave>1000){saveGame();lastSave=now;}
 }
 function normalSlugs(t){const ids=new Set([state.active?.entrants[0]?.id]);return t.slugs.filter(s=>!ids.has(s.id));}
 function stepNormal(slugs,dt){
   const t=tankOf();if(!t)return;
   stepTankSlugs(slugs,t.def.w,t.def.h,dt,true,t.decor,t.def);
   for(const s of slugs){const min=LANE_H+.4;if(s.fy<min){s.fy=min;if(s.state==='walk'){s.state='rest';s.stt=1;}}s.wall=null;s.climbZ=0;}
 }

 window.addEventListener('keydown',e=>{
   if(!ui||modal?.open||!state.active||state.active.settled)return;
   e.stopImmediatePropagation();
   if(['Space','Escape','KeyF','KeyK'].includes(e.code))e.preventDefault();
   if(e.repeat)return;
   if(e.code==='Space')tap();
   else if(e.code==='KeyF')boostKey('f');
   else if(e.code==='KeyK')boostKey('k');
 },true);
 document.addEventListener('visibilitychange',()=>{lastFrame=0;saveGame();});

 window.SlugThrow={purchased,goal,drawChallengers,drawField,decorOk,LANE_H,ask,makeOffer,state:()=>state,isOpen:()=>!!modal?.open,
   reserved:o=>!!o?.def?.throwing&&visitors.some(p=>PEOPLE.includes(p)),
   isThrowing:t=>!!ui&&!!state.active&&(!t||t.id===state.active.tankId),
   items,drawItem,updateTankFrame,normalSlugs,stepNormal,skipBot,tap,boostKey,maxDist,gillPower,LANE_Y,THROWS,BOOST_T,WAVES};

 if(!state.active||!Array.isArray(state.active.entrants)||state.active.entrants.length!==4)state.active=null;
 if(owned())purchased();
 resumeReady=true;setInterval(tick,1000);
})();
