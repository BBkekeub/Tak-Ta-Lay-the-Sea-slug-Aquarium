/* ปาหินด้วยหงอน — ตู้ 150×50 ซม. หนึ่งตู้ต่อร้าน (สเปกผู้เล่น 2026-09-18)
 *
 * โครงเดียวกับ slug-race.js / slug-tug.js / slug-eat.js:
 *   ลูกค้ามาท้า → โมดอลเลือกทาก+เดิมพัน → เข้าตู้เต็มจอ → ผลแพ้ชนะ (ใช้หน้าตาโมดอลชุดเดียวกัน)
 *
 * ปาหนึ่งไม้มี 4 ช่วง (รอบสองของดีไซน์ — รอบแรก "กดสุดไว้ก่อนก็ชนะ" ผู้เล่นบอกว่าไม่สนุก)
 *   1. แถบแรง   — หมุดวิ่งไป-กลับ กด Space หยุด · เกิน FOUL_AT = เหวี่ยงพลาด เหลือครึ่ง (ดันแรงสุด = เสี่ยง)
 *   2. แถบองศา  — ยิ่งล็อกแรงไว้สูง หมุดยิ่งวิ่งเร็ว (โลภแล้วจับจังหวะยากขึ้น) · 45° ไกลสุด
 *   3. เร่งแรง 5 วิ — กล้องซูมตามหิน กด F / K สลับกันรัว ๆ ทุกครั้งที่กดหินเร่งขึ้นจริง ไม่มีเพดาน (หยุดกด = ความเร็วตก)
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
 const LANE_Y=2.6, LANE_H=5.2;
 const ANGLE_LO=15, ANGLE_HI=75, BEST_ANGLE=45;
 const SWEEP_POWER=1.15;
 const ANGLE_SPEED_BASE=.7, ANGLE_SPEED_GREED=1.0;   // ความเร็วแถบองศา = BASE + GREED × แรงที่ล็อกไว้
 const FOUL_AT=.9, FOUL_MUL=.5;                // ⚙️ โซนแดงท้ายแถบแรง
 /* ⚙️ ช่วงเร่งแรง — ⚠️ 2026-09-18 ผู้เล่น: "กดย้ำต้องดันหินไปเรื่อย ๆ ไม่ใช่แค่เก็บเกจแล้วตัน"
    หินมี "ความเร็ว" จริง (ซม./วิ) · กด F/K สลับกันหนึ่งครั้ง = อัดความเร็วเพิ่ม PRESS_GAIN (คูณพลังหงอน)
    ปล่อยมือเมื่อไหร่ความเร็วตกตามแรงต้าน DRAG · ระยะ = ระยะทางสะสมจริง ไม่มีเพดาน กดเร็ว/นานกว่า = ไปไกลกว่าเสมอ */
 const BOOST_T=5;                              // ⚙️ ช่วงที่ยังเร่งได้ (วิ) หลังจากนี้เข้าช่วงหินตก
 const V0_BASE=6, V0_GAIN=10;                  // ความเร็วตั้งต้นจากการเล็ง (ซม./วิ)
 /* ⚠️ แรงต้านช่วงหินตกต้องต่ำกว่าช่วงเร่ง ไม่งั้นพอถึงช่วงคลื่นหินแทบหยุดแล้ว
    การพลาดคลื่นเลยไม่มีผล (เทสต์: พลาดครบ 4 ลูกเสียระยะแค่ 1 ซม.) · ตอนนี้ช่วงคลื่นกินระยะราว 40% ของไม้ */
 const PRESS_GAIN=1.15, DRAG=.45, DRAG_FALL=.12;   // อัดต่อครั้ง · แรงต้านช่วงเร่ง · แรงต้านช่วงหินตก
 /* ช่วงเร่งหินยังพุ่งขึ้นอยู่ ระยะราบจึงเดินแค่ ASCENT ของความเร็ว · ระยะจริงส่วนใหญ่มาตอนหินตก
    (ถ้าให้ช่วงเร่งกินระยะเยอะ การพลาดคลื่นจะแทบไม่มีผล — เทสต์แล้วเสียแค่ 8 ซม.) */
 const ASCENT=.35;
 const WAVES=4, WAVE_GAP=.85, WAVE_LEAD=1;   // ⚙️ คลื่น
 /* ---- ช่วงหินตก = เกมทรงหัวหิน (ผู้เล่นออกแบบ 2026-09-19) ----
    หินเป็นก้อนรียาว มี "มุมหัว" (pitch) · 0° = เพรียวลม แหวกไปไม่เสียความเร็ว
      · คลื่นซัดตอนหัวราบ/หัวจม  → ตบหัวกดลง (pitch ลบ) = ท้องหินปะทะลม แรงต้านพุ่ง
      · กด Space = งัดหัวขึ้น (pitch บวก) · กดพอดีก่อนคลื่นถึง = หักล้างกันพอดี หัวกลับมาราบ = ไม่เสียความเร็ว
      · กดเร็วไป/กดรัว หัวเชิดค้างเกิน PITCH_CATCH → คลื่นมุดเข้าใต้ท้อง เชิดขึ้นไปอีก = แย่ที่สุด
    เดิมช่วงนี้เป็น "กดให้ตรงหน้าต่างเวลา" ซึ่งกดรัวทั้งช่วงก็ได้ครบทุกลูก (เทสต์แล้วกดมั่วชนะที่ 1)
    แบบใหม่การกดรัวคือทางที่แย่ที่สุด เพราะหัวเชิดค้างตลอดเวลา */
 const PITCH_PRESS=24;      // งัดหัวขึ้นต่อการกด 1 ครั้ง (องศา)
 const PITCH_WAVE=26;       // แรงคลื่น (องศา)
 const PITCH_CATCH=28;      // หัวเชิดเกินนี้ตอนคลื่นถึง = คลื่นมุดใต้ท้อง เชิดต่อ
 const PITCH_FLAT=9;        // |มุม| ไม่เกินนี้ = ยังเพรียวลม ไม่มีโทษ
 const PITCH_MAX=62, PITCH_EASE=1.6;   // มุมสูงสุด · หัวค่อย ๆ คืนสู่แนวราบ (วินาที)
 const PITCH_DRAG=5.2;      // แรงต้านสูงสุดที่มุมหัวเพิ่มให้ (เท่าของ DRAG_FALL)
 const RING_MIN=45, RING_MAX=112, RING_HALF=6, RING_BONUS=25;                 // ⚙️ วงเป้าโบนัส
 const BOT_SPEED=2.6;                          // ⚙️ ตาบอทเดินเร็วกว่าปกติเท่านี้ (ลดเวลานั่งรอ)
 const COLORS=['#ffd36b','#ff8a7a','#7fd4ff','#c3a6ff'];
 const names=['แขนหิน','หงอนเหล็ก','พายุทราย','ปาไกล','มือฉมัง','หินลอย','สลิงทะเล','เหวี่ยงคลื่น'];

 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const g01=(g,k)=>clamp(Number.isFinite(g[k])?g[k]:50,0,100)/100;
 const gillCnt01=g=>clamp(((typeof gillCount==='function'?gillCount(g):5)-2)/7,0,1);
 /* แรงจากหงอนล้วน: ขนาดหงอน 60% + จำนวนหงอน 40% */
 const gillPower=g=>.6*g01(g,'gillLen')+.4*gillCnt01(g);
 const armMul=g=>.45+.55*gillPower(g);
 /* ความเร็วตั้งต้นจากการเล็ง (ฟาวล์ = หลุดมือ ออกตัวช้ากว่าครึ่ง) */
 const startSpeed=(g,power,angle)=>V0_BASE+V0_GAIN*armMul(g)*clamp(power,0,1)*(power>FOUL_AT?FOUL_MUL:1)*Math.sin(2*angle*Math.PI/180);
 /* ระยะอ้างอิง "ถ้าเล่นดี": เล็ง 90% องศา 45° แล้วกด 8 ครั้ง/วิ ตลอดช่วงเร่ง ไม่พลาดคลื่น */
 function maxDist(g){
   let v=V0_BASE+V0_GAIN*armMul(g)*FOUL_AT,d=0;
   const dt=.05,gain=PRESS_GAIN*armMul(g);
   for(let t=0;t<BOOST_T;t+=dt){v+=gain*8*dt;v-=v*DRAG*dt;d+=v*dt*ASCENT;}
   for(let t=0;t<WAVE_LEAD+WAVES*WAVE_GAP;t+=dt){v-=v*DRAG_FALL*dt;d+=v*dt;}
   return Math.min(MAX_CM,d);
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
   element('p','1) กด Space หยุดแถบแรง — เกิน 90% เหวี่ยงพลาด เหลือครึ่ง  2) หยุดแถบองศา 45° ไกลสุด (ล็อกแรงสูง = แถบวิ่งเร็วขึ้น)',d,'eat-rule');
   element('p','3) กล้องซูมตามหิน กด F / K สลับกันรัว ๆ 5 วิ ทุกครั้งที่กดหินเร่งขึ้นจริง ไม่มีเพดาน หยุดกดความเร็วตก  4) ช่วงหินตกมีคลื่นซัดเข้ามา '+WAVES+' ลูก กด Space ให้ทันทุกลูก พลาดแล้วหินเสียแรงตกใกล้',d,'eat-rule');
   element('p','บนลานมีวงเป้าสุ่มตำแหน่งทุกไม้ · ลงเป้าได้โบนัส +'+RING_BONUS+' แต้ม',d,'eat-rule');
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
   element('p','ที่ 1 ได้ 2 เท่าของเดิมพัน · ที่ 2 เท่าทุน · ที่ 3 เสียครึ่ง · ที่ 4 เสียเต็ม',d,'eat-rule');
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
   sprites=a.entrants.map((e,i)=>i===0?t.slugs.find(s=>s.id===e.id):{id:'throw-bot-'+i,genes:e.genes,state:'rest',ph:i*1.3,noBob:true,creepT:0});
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
   /* ---- ช่วงเล็ง: แถบแรง + แถบองศา ---- */
   const meters=element('div',null,ui,'throw-meters');hud.meters=meters;
   const mk=(label,cls)=>{const box=element('div',null,meters,'throw-meter '+cls);
     const head=element('div',null,box,'throw-meter-head');element('span',label,head);const val=element('b','',head);
     const bar=element('div',null,box,'throw-bar');const zone=element('i',null,bar,'throw-zone');const mark=element('i',null,bar,'throw-mark');
     return {box,val,zone,mark};};
   hud.power=mk('แรง','is-power');
   hud.angle=mk('องศา','is-angle');
   hud.power.zone.classList.add('is-foul');      // โซนแดง = ฟาวล์
   hud.power.zone.style.left=(FOUL_AT*100)+'%';hud.power.zone.style.width=((1-FOUL_AT)*100)+'%';
   /* ---- ช่วงบิน: แถบเร่งแรง + แถบคลื่น ---- */
   const fly=element('div',null,ui,'throw-fly');hud.fly=fly;fly.hidden=true;
   const boost=element('div',null,fly,'throw-boost');
   const bh=element('div',null,boost,'throw-meter-head');element('span','เร่งแรง — กด F / K สลับกัน',bh);hud.boostVal=element('b','0 ซม./วิ',bh);
   const bbar=element('div',null,boost,'throw-bar');hud.boostFill=element('i',null,bbar,'throw-fill');
   hud.boostTime=element('div','',boost,'throw-clock');
   hud.liveDist=element('div','0 ซม.',boost,'throw-live');
   const wave=element('div',null,fly,'throw-wavebox');
   const wh=element('div',null,wave,'throw-meter-head');element('span','คลื่น — กด Space งัดหัวหินรับให้พอดี',wh);hud.waveVal=element('b','',wh);
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
   hud.goLabel=element('b','ปา',hud.go);hud.goKey=element('small','Space',hud.go,'throw-key');
   hud.keyK=element('button',null,controls,'throw-btn throw-side');hud.keyK.type='button';element('b','K',hud.keyK);
   hud.go.onpointerdown=e=>{e.preventDefault();tap();};
   hud.keyF.onpointerdown=e=>{e.preventDefault();boostKey('f');};
   hud.keyK.onpointerdown=e=>{e.preventDefault();boostKey('k');};
   hud.skip=element('button','⏭ ข้ามตาบอท',ui,'throw-skip');hud.skip.type='button';hud.skip.hidden=true;
   hud.skip.onpointerdown=e=>{e.preventDefault();skipBot();};
 }

 /* ---------- จังหวะการเล่น ---------- */
 const sweep=(clock,speed)=>{const x=(clock*speed)%1;return x<.5?x*2:2-x*2;};
 const angleSpeed=a=>ANGLE_SPEED_BASE+ANGLE_SPEED_GREED*(a.lockPower??.5);
 function tap(){
   const a=state.active;if(!a||a.settled)return false;
   const e=cur();
   if(a.phase==='intro'){startTurn();return true;}
   if(e?.bot)return false;
   if(a.phase==='power'){a.lockPower=sweep(a.clock,SWEEP_POWER);a.phase='angle';a.clock=0;return true;}
   if(a.phase==='angle'){a.lockAngle=ANGLE_LO+(ANGLE_HI-ANGLE_LO)*sweep(a.clock,angleSpeed(a));launch();return true;}
   if(a.phase==='waves'){return pitchUp(a);}
   return false;
 }
 /* กด F/K สลับกันตอนเร่งแรง (กดปุ่มเดิมซ้ำไม่นับ แบบชักเย่อ) */
 const boostCap=makePressLimiter();       // เพดาน 20 ครั้ง/วิ (config.js) กันมาโครอัดความเร็ว
 function boostKey(k){
   const a=state.active;if(!a||a.settled||a.phase!=='boost'||cur()?.bot)return false;
   if(lastBoostKey===k)return false;
   if(!boostCap())return false;
   lastBoostKey=k;a.shot.presses++;a.shot.v+=a.shot.gain;     // ทุกครั้งที่กด = อัดความเร็วเพิ่มจริง ไม่มีเพดาน
   hud[k==='f'?'keyF':'keyK']?.animate([{transform:'translateY(4px) scale(.94)',filter:'brightness(1.5)'},{transform:'none',filter:'none'}],{duration:130});
   return true;
 }
 function startTurn(){
   const a=state.active,e=cur();
   a.lockPower=a.lockAngle=null;a.shot=null;a.clock=0;lastBoostKey=null;
   newRing(e);
   a.phase=e.bot?'bot':'power';
   if(e.bot){const miss=1-e.aim;a.botPower=clamp(FOUL_AT-Math.random()*miss*.3,.25,FOUL_AT);a.botAngle=clamp(BEST_ANGLE+(Math.random()*2-1)*miss*20,ANGLE_LO,ANGLE_HI);}
 }
 function nextTurn(){
   const a=state.active;
   a.turn++;
   if(a.turn>=a.entrants.length){a.turn=0;a.round++;}
   if(a.round>=THROWS){settle();return;}
   startTurn();
 }
 function launch(){
   const a=state.active,e=cur();
   a.shot={v:startSpeed(e.genes,a.lockPower,a.lockAngle),gain:PRESS_GAIN*armMul(e.genes),
     angle:a.lockAngle,foul:a.lockPower>FOUL_AT,presses:0,waves:[],by:a.turn,dist:0,pitch:0};
   for(let i=0;i<WAVES;i++)a.shot.waves.push({at:WAVE_LEAD+i*WAVE_GAP,hit:null});
   a.phase='boost';a.clock=0;lastBoostKey=null;
   if(a.shot.foul)pops.push({x:START_CM/CM_PER_CELL+1,y:LANE_Y,text:'เหวี่ยงพลาด!',color:'#ff8a7a',t:0});
 }
 /* เดินฟิสิกส์หินหนึ่งเฟรม: ความเร็วตกตามแรงต้าน แล้วบวกระยะที่วิ่งได้จริง */
 /* แรงต้านจากมุมหัว: ราบ (|มุม| ≤ PITCH_FLAT) = 1 เท่า · เชิด/จมสุด = 1+PITCH_DRAG เท่า */
 const pitchDrag=s=>1+PITCH_DRAG*clamp((Math.abs(s.pitch||0)-PITCH_FLAT)/(PITCH_MAX-PITCH_FLAT),0,1);
 function stepStone(a,dt,falling){
   const s=a.shot;if(!s)return;
   s.v=Math.max(0,s.v-s.v*(falling?DRAG_FALL*pitchDrag(s):DRAG)*dt);
   s.dist=Math.min(MAX_CM,s.dist+s.v*dt*(falling?1:ASCENT));
   if(falling)s.pitch=(s.pitch||0)*Math.exp(-dt/PITCH_EASE);   // หัวค่อย ๆ คืนแนวราบเอง ปล่อยมือแล้วพอแก้ตัวได้
 }
 /* กด Space ช่วงหินตก = งัดหัวขึ้น */
 function pitchUp(a){
   const s=a.shot;if(!s)return false;
   s.pitch=clamp((s.pitch||0)+PITCH_PRESS,-PITCH_MAX,PITCH_MAX);
   return true;
 }
 /* คลื่นถึงตัวหิน — ผลขึ้นกับมุมหัวตอนนั้น */
 function waveHits(a,w,aim){
   const s=a.shot,p=s.pitch||0;
   if(aim!=null){                       // บอท: ความแม่นตัดสินว่างัดหัวทันหรือไม่
     s.pitch=Math.random()<aim?(Math.random()*2-1)*PITCH_FLAT:(Math.random()<.5?-PITCH_WAVE:PITCH_WAVE*1.3);
   }else if(p>=PITCH_CATCH){
     s.pitch=clamp(p+PITCH_WAVE,-PITCH_MAX,PITCH_MAX);          // เชิดค้าง = คลื่นมุดใต้ท้อง เชิดต่อ
   }else{
     s.pitch=clamp(p-PITCH_WAVE,-PITCH_MAX,PITCH_MAX);          // ปกติคลื่นตบหัวลง (งัดไว้พอดีก็กลับมาราบ)
   }
   w.hit=Math.abs(s.pitch)<=PITCH_FLAT;
   w.pitch=Math.round(s.pitch);
   return w.hit;
 }
 const stoneX=a=>START_CM+(a.shot?a.shot.dist:0);
 function finishShot(){
   const a=state.active,s=a.shot,e=a.entrants[s.by];
   const dist=s.dist;
   const onRing=Math.abs(dist-a.ring)<=RING_HALF;
   const score=Math.round(dist)+(onRing?RING_BONUS:0);
   e.shots.push({dist,score,ring:onRing});
   pops.push({x:(START_CM+dist)/CM_PER_CELL,y:LANE_Y,text:dist.toFixed(0)+' ซม.'+(onRing?' +'+RING_BONUS+' เข้าเป้า!':''),color:onRing?'#9fe3a6':COLORS[s.by],t:0});
   a.phase='land';a.clock=0;
 }
 function skipBot(){
   const a=state.active;if(!a||a.settled||!cur()?.bot)return;
   /* ข้าม: จำลองผลตาบอทตัวนี้ทันที (ใช้สูตรเดียวกับที่บอทเล่นจริง) */
   if(a.phase==='bot'){a.lockPower=a.botPower;a.lockAngle=a.botAngle;launch();}
   const e=cur(),s=a.shot;
   /* จำลองตาบอทแบบรวดเดียว: กดตามความแม่น + สุ่มพลาดคลื่น แล้วเดินฟิสิกส์ให้จบ */
   const rate=4+6*e.aim,dt=.05;
   for(let t=0,acc=0;t<BOOST_T;t+=dt){acc+=rate*dt;while(acc>=1){acc--;s.presses++;s.v+=s.gain;}stepStone(a,dt,false);}
   /* ช่วงหินตก: ปล่อยคลื่นตามจังหวะจริงสลับกับเดินฟิสิกส์ มุมหัวจะได้มีผลต่อแรงต้านเหมือนตอนเล่นเอง */
   for(let t=0;t<WAVE_LEAD+WAVES*WAVE_GAP;t+=dt){
     for(const w of s.waves)if(w.hit==null&&t>=w.at)waveHits(a,w,e.aim);
     stepStone(a,dt,true);
   }
   a.clock=WAVE_LEAD+WAVES*WAVE_GAP;finishShot();
 }
 function advance(dt){
   const a=state.active;if(!a||a.settled)return;
   const e=cur(),bot=!!e?.bot;
   if(bot&&a.phase!=='intro')dt*=BOT_SPEED;                 // ตาบอทเดินเร็วขึ้น ไม่ต้องนั่งรอนาน
   a.clock+=dt;
   if(a.phase==='intro'){if(a.clock>1)startTurn();return;}
   if(a.phase==='bot'){if(a.clock>1.1){a.lockPower=a.botPower;a.lockAngle=a.botAngle;launch();}return;}
   if(a.phase==='boost'){
     if(bot){                                               // บอทกด F/K ตามความแม่น (กี่ครั้ง/วิ)
       const rate=4+6*e.aim;
       a.shot._acc=(a.shot._acc||0)+rate*dt;
       while(a.shot._acc>=1){a.shot._acc--;a.shot.presses++;a.shot.v+=a.shot.gain;}
     }
     stepStone(a,dt,false);
     if(a.clock>=BOOST_T){a.phase='waves';a.clock=0;}
     return;
   }
   if(a.phase==='waves'){
     for(const w of a.shot.waves){
       if(w.hit!=null||a.clock<w.at)continue;
       const ok=waveHits(a,w,bot?e.aim:null);
       const p=a.shot.pitch;
       pops.push({x:stoneX(a)/CM_PER_CELL,y:LANE_Y,
         text:ok?'เพรียวลม!':p>0?'หัวเชิดเกิน!':'หัวจม!',
         color:ok?'#9fe3ee':'#ff8a7a',t:0});
     }
     stepStone(a,dt,true);
     if(a.shot.waves.every(w=>w.hit!=null)&&a.clock>a.shot.waves[WAVES-1].at)finishShot();
     return;
   }
   if(a.phase==='land'&&a.clock>1){nextTurn();return;}
 }
 function settle(){
   const a=state.active;if(!a||a.settled)return;
   const order=a.entrants.map((e,i)=>i).sort((x,y)=>scoreOf(a.entrants[y])-scoreOf(a.entrants[x])||x-y);
   a.order=order;a.rank=order.indexOf(0)+1;a.phase='done';
   a.delta=a.practice?0:(a.rank===1?a.wager*2:a.rank===2?0:a.rank===3?-Math.floor(a.wager/2):-a.wager)||0;
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
     element('small',e.shots.map(s=>s.dist.toFixed(0)+(s.ring?'🎯':'')).join(' · '),step,'throw-shots');
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
   const y0=LANE_Y-2.2,y1=LANE_Y+2.2;
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
   if(it.part==='slug'){
     const e=a.entrants[it.i],s=sprites[it.i];if(!s)return;
     const active=it.i===a.turn&&!a.settled,sp=standSpot(it.i,active);
     const st=active&&flying(a)&&a.shot?.by===it.i?'sneeze':'rest';
     drawSlugAt(s,sp.x,sp.y,0,st);
     nameTag((it.i===0?'คุณ':e.name)+(e.shots.length?' · '+scoreOf(e):''),sp.x,sp.y,it.i===0?'#153c42':'rgba(30,20,16,.85)',COLORS[it.i]);
     return;
   }
   if(it.part==='marks'){
     /* วงเป้าโบนัสของไม้นี้ */
     if(a.ring&&!a.settled){
       const x0=(START_CM+a.ring-RING_HALF)/CM_PER_CELL,x1=(START_CM+a.ring+RING_HALF)/CM_PER_CELL;
       const q=[S(x0,LANE_Y-2.1,SAND_CELLS),S(x1,LANE_Y-2.1,SAND_CELLS),S(x1,LANE_Y+2.1,SAND_CELLS),S(x0,LANE_Y+2.1,SAND_CELLS)];
       tctx.save();tctx.fillStyle='rgba(159,227,166,.28)';tctx.strokeStyle='#9fe3a6';tctx.lineWidth=Math.max(1.5,2*tankCam.zoom);
       tctx.beginPath();q.forEach((p,i)=>i?tctx.lineTo(p.x,p.y):tctx.moveTo(p.x,p.y));tctx.closePath();tctx.fill();tctx.stroke();
       const c=S((x0+x1)/2,LANE_Y-2.1,SAND_CELLS);
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
     /* คลื่นที่กำลังซัดเข้ามาหาหิน (ช่วงหินตก) */
     if(a.phase==='waves'){
       for(const w of s.waves){
         if(w.hit!=null)continue;
         const lead=w.at-a.clock;if(lead<-.2||lead>1.6)continue;
         const wx=x+lead*3.2;
         const p0=S(wx,LANE_Y-2,SAND_CELLS),p1=S(wx,LANE_Y+2,SAND_CELLS),mid=S(wx-.5,LANE_Y,SAND_CELLS+.7);
         tctx.save();tctx.strokeStyle='rgba(159,227,238,'+clamp(1-Math.abs(lead)/1.6,.2,1)+')';tctx.lineWidth=Math.max(2,3.5*tankCam.zoom);
         tctx.beginPath();tctx.moveTo(p0.x,p0.y);tctx.quadraticCurveTo(mid.x,mid.y,p1.x,p1.y);tctx.stroke();tctx.restore();
       }
     }
     const total=BOOST_T+WAVE_LEAD+WAVES*WAVE_GAP;
     const t=(a.phase==='boost'?a.clock:BOOST_T+a.clock)/total;
     const peak=1.2+2.6*Math.sin(s.angle*Math.PI/180);
     const p=S(x,LANE_Y,SAND_CELLS+peak*Math.sin(Math.PI*clamp(t,0,1)));
     /* หินก้อนรียาว เอียงตามมุมหัว — เห็นได้ทันทีว่าหัวเชิด/หัวจม (ช่วงเร่งยังไม่มีมุม วาดราบ) */
     const r=Math.max(3,6*tankCam.zoom),pitch=a.phase==='waves'?(s.pitch||0):0;
     tctx.save();tctx.translate(p.x,p.y);tctx.rotate(-pitch*Math.PI/180);
     tctx.fillStyle='#8d8373';tctx.strokeStyle='#4a443a';tctx.lineWidth=Math.max(1,1.5*tankCam.zoom);
     tctx.beginPath();tctx.ellipse(0,0,r*1.8,r*.78,0,0,Math.PI*2);tctx.fill();tctx.stroke();
     tctx.beginPath();tctx.moveTo(r*.6,-r*.12);tctx.lineTo(r*1.75,0);tctx.lineTo(r*.6,r*.14);   // ปลายหัวหิน ดูออกว่าหันทางไหน
     tctx.fillStyle='#b3a894';tctx.fill();
     tctx.restore();
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
   const wantZoom=flying(a)?fit*2.1:fit;
   const wantX=flying(a)?stoneX(a)/CM_PER_CELL:t.def.w/2;
   const k=1-Math.exp(-dt*6);
   camZoom=camZoom==null?wantZoom:camZoom+(wantZoom-camZoom)*k;
   camX=camX==null?wantX:camX+(wantX-camX)*k;
   tankCam.zoom=camZoom;
   const c=S(camX,LANE_Y,SAND_CELLS);
   tankCam.ox=TCW/2-c.x;tankCam.oy=(topPad+(TCH-botPad))/2-c.y;tankNeedFit=false;
 }
 function updateHud(a){
   const e=cur(),mine=e&&!e.bot;
   const turnText=a.settled?'จบการแข่งขัน':'ไม้ที่ '+(a.round+1)+'/'+THROWS+' · '+(mine?'ตาคุณ':'ตา'+e.name);
   if(hud.turn.textContent!==turnText)hud.turn.textContent=turnText;
   const missed=a.shot?a.shot.waves.filter(w=>w.hit===false).length:0;
   const hint=a.settled?''
     :a.phase==='intro'?'กด Space เริ่ม'
     :a.phase==='power'?'กด Space หยุดแถบแรง — โซนแดงเกิน '+(FOUL_AT*100)+'% = พลาด'
     :a.phase==='angle'?'กด Space หยุดแถบองศา (45° ไกลสุด)'
     :a.phase==='bot'?e.name+' กำลังเล็ง…'
     :a.phase==='boost'?(mine?'กด F / K สลับกันรัว ๆ!':e.name+' กำลังเร่งแรง')
     :a.phase==='waves'?(mine?(Math.abs(a.shot?.pitch||0)>PITCH_CATCH?'หัวเชิดเกินแล้ว! ปล่อยมือให้หัวคืนราบก่อน':'คลื่นมาแล้ว! กด Space งัดหัวหินรับคลื่นให้พอดี'):e.name+' กำลังประคองหัวหิน')
     :a.shot?a.shot.dist.toFixed(0)+' ซม.'+(missed?' · เสียทรง '+missed+' ลูก':''):'';
   if(hud.hint.textContent!==hint)hud.hint.textContent=hint;
   /* แถบเล็ง */
   const aiming=a.phase==='power'||a.phase==='angle'||a.phase==='bot'||a.phase==='intro';
   hud.meters.hidden=!aiming||a.settled;
   hud.fly.hidden=!flying(a);
   if(aiming){
     const pv=a.lockPower!=null?a.lockPower:(a.phase==='power'||a.phase==='bot'?sweep(a.clock,SWEEP_POWER):0);
     const av=a.lockAngle!=null?a.lockAngle:ANGLE_LO+(ANGLE_HI-ANGLE_LO)*(a.phase==='angle'||a.phase==='bot'?sweep(a.clock,angleSpeed(a)):0);
     hud.power.mark.style.left=(pv*100)+'%';hud.power.val.textContent=Math.round(pv*100)+'%';
     hud.angle.mark.style.left=((av-ANGLE_LO)/(ANGLE_HI-ANGLE_LO)*100)+'%';hud.angle.val.textContent=Math.round(av)+'°';
     hud.angle.zone.style.left=((BEST_ANGLE-5-ANGLE_LO)/(ANGLE_HI-ANGLE_LO)*100)+'%';
     hud.angle.zone.style.width=(10/(ANGLE_HI-ANGLE_LO)*100)+'%';
     hud.power.box.classList.toggle('is-live',a.phase==='power'||a.phase==='bot');
     hud.angle.box.classList.toggle('is-live',a.phase==='angle');
   }
   /* แถบบิน */
   if(flying(a)){
     const s=a.shot;
     hud.boostFill.style.width=clamp(s.v/40*100,0,100)+'%';                 // 40 ซม./วิ = เต็มแถบ (แค่มาตรวัด ไม่ใช่เพดาน)
     hud.boostVal.textContent=s.v.toFixed(0)+' ซม./วิ';
     hud.boostTime.textContent=a.phase==='boost'?'เร่งได้อีก '+Math.max(0,BOOST_T-a.clock).toFixed(1)+' วิ':'หินกำลังตก';
     hud.liveDist.textContent=s.dist.toFixed(0)+' ซม. · กดไปแล้ว '+s.presses+' ครั้ง';
     /* มาตรวัดมุมหัวหิน: ตรงกลาง = ราบ (เพรียวลม) · ขวา = หัวเชิด · ซ้าย = หัวจม */
     const pitch=s.pitch||0;
     hud.waveVal.textContent=s.waves.filter(w=>w.hit===true).length+' / '+WAVES+' ลูก · หัว '+(Math.abs(pitch)<=PITCH_FLAT?'ราบ ✓':(pitch>0?'เชิด +':'จม ')+Math.round(pitch)+'°');
     hud.pitchMark.style.left=clamp(50+pitch/PITCH_MAX*50,0,100)+'%';
     hud.pitchBox.classList.toggle('is-flat',Math.abs(pitch)<=PITCH_FLAT);
     hud.pitchBox.classList.toggle('is-bad',Math.abs(pitch)>PITCH_CATCH);
     hud.pitchBox.hidden=a.phase!=='waves';
     if(hud.waveTrack.children.length<WAVES+1)
       for(let i=hud.waveTrack.children.length-1;i<WAVES;i++)element('i',null,hud.waveTrack,'throw-wave');
     s.waves.forEach((w,i)=>{
       const el=hud.waveTrack.children[i+1];if(!el)return;
       const lead=w.at-(a.phase==='waves'?a.clock:-(BOOST_T-a.clock));
       el.style.left=clamp(88-lead*24,-10,110)+'%';
       el.className='throw-wave'+(w.hit===true?' is-hit':w.hit===false?' is-miss':'');
     });
   }
   /* คะแนนรวม */
   a.entrants.forEach((x,i)=>{const s=String(scoreOf(x));if(hud.rows[i].b.textContent!==s)hud.rows[i].b.textContent=s;});
   const order=a.entrants.map((x,i)=>i).sort((p,q)=>scoreOf(a.entrants[q])-scoreOf(a.entrants[p])||p-q);
   order.forEach((i,k)=>{hud.rows[i].li.style.order=String(k);});
   /* ปุ่ม */
   const boosting=a.phase==='boost'&&mine;
   hud.keyF.hidden=hud.keyK.hidden=!boosting;
   hud.go.disabled=a.settled||!mine||!(a.phase==='intro'||a.phase==='power'||a.phase==='angle'||a.phase==='waves');
   hud.go.classList.toggle('is-live',!hud.go.disabled);
   hud.goLabel.textContent=a.phase==='waves'?'โต้คลื่น':a.phase==='intro'?'เริ่ม':'ปา';
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
