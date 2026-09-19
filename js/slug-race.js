/* One saved appointment per shop, independent of furniture ownership.
 * Race positions are head coordinates in centimetres; all entrants use stride().
 * Racing uses the existing tank camera/renderer; only prompts and results are modal.
 */
(()=>{
 'use strict';
 /* ⚠️ 2026-09-18 ผู้เล่น: "ช่วงวิ่งสั้น น่าเบื่อ" → วิ่งไป-กลับ
    head = ระยะที่วิ่งมาแล้วนับจากจุดเริ่ม (START → GOAL) ไม่ใช่ตำแหน่งในตู้ตรง ๆ แล้ว
    ตำแหน่งจริงในตู้ = trackX(head): ไปถึง TURN (กระจกฝั่งไกล) แล้ววิ่งย้อนกลับมาเข้าเส้นที่จุดเริ่ม · ไม่ต้องกดอะไรเพิ่มตอนกลับตัว */
 const MINUTE=60000, START=20, TURN=180, GOAL=START+2*(TURN-START), TRACK_CM=GOAL-START;
 const trackX=d=>d<=TURN?d:2*TURN-d;
 /* ⚙️ เกจพลัง (ผู้เล่นกำหนด 2026-09-18): กด A/D สะสม · เต็มแล้วเลือก J = บล็อคคู่แข่งทุกตัว 2 วิ (กดแล้วไม่ขยับ) · K = วิ่งเร็วขึ้นเอง 2 วิ
    บอทก็ใช้ · เวลาทั้งหมดนับด้วย a.elapsed จึงเซฟ/โหลดต่อได้ */
 const CHARGE_AT=30, POWER_T=2, BOOST_MUL=1.6;
 /* บล็อค = กำแพงโผล่ขวางหน้าคู่แข่ง "ทุกตัว" (โหมด 3 ตัวโดนทั้งคู่) ห่างหัวออกไป WALL_GAP ซม.
    ยังกดเดินต่อได้จนชนกำแพง (ผู้เล่นขอ "เผื่อระยะกดด้วย" 2026-09-18) ครบ POWER_T วิ กำแพงหาย */
 const WALL_GAP=10;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const gap=()=> ShopEvents.gap();      // 20–45 นาที ใช้ค่าเดียวกันทั้ง 4 ตู้ (config.js)
 const tank=()=>G.objs.find(o=>o.def.race&&o!==moving);
 const owned=()=>[...G.objs,...G.shelter].some(o=>o.def.race);
 const gene=(g,k)=>clamp(Number.isFinite(g[k])?g[k]:50,0,100)/100;
 /* ⚙️ 2026-09-18 ผู้เล่น: "ง่ายไป จบไวไป" → ก้าวต่อการกดสั้นลงเหลือ STEP_SCALE ของเดิม
    ใช้กับทุกตัว (เราและบอท) เท่ากัน สูตรเลือกทากยังเหมือนเดิม แค่ต้องกดต่อเนื่องนานขึ้น */
 const STEP_SCALE=.65;
 function stride(g){
   // Length helps; large girth and large gills add drag. The cap is absolute.
   const length=6+8*gene(g,'len');
   const gills=(gillCount(g)-2)/7;
   const fraction=clamp(.12+.14*gene(g,'len')+.12*gene(g,'vigor')+.10*gills-.07*gene(g,'gillLen')-.06*gene(g,'girth'),.06,.4);
   return {length,step:length*fraction*STEP_SCALE};
 }
 let state=G.racing;
 if(!state||!Number.isFinite(state.nextAt)||state.nextAt<0)state={purchased:false,nextAt:0,offer:null,active:null};
 G.racing=state;
 let visitors=[],modal=null,raceUI=null,lastFrame=0,lastSave=0,cameraKey='',raceProgress=null,burstAnimations=[],raceBottom=92,raceResize=null;
 let sprites=[],lastKey=null,countNode=null,buttons=[],powerUI=null;
 let resumeReady=false,offerDeadline=0;
 const names=['คลื่น','ฟอง','ปะการัง','น้ำวน','มุก','หาดทราย','ใบเรือ','เค็ม'];
 function purchased(){
   if(!state.purchased){state.purchased=true;state.nextAt=Date.now()+5*MINUTE;saveGame();}
 }
 /* ความเร็วกดของบอท (ครั้ง/วิ) — ⚠️ 2026-09-17 เดิม 2.5–4.5 ครั้ง/วิ แต่คนกด A/D สลับได้ 8–12 ครั้ง/วิ
    = ผู้เล่นเร็วกว่า 2–4 เท่า ส่งทากตัวไหนลงก็ชนะเฉย ๆ (ผู้เล่นบ่น) · ตอนนี้บอทกดเร็วใกล้คน
    แพ้ชนะจึงขึ้นกับ "ก้าวต่อครั้ง" จากยีน (stride) + ความเร็วนิ้วจริง · ช่วงเดียวกับบอทชักเย่อ (slug-tug.js botCps) */
 const PACE_MIN=8,PACE_MAX=15;          // ผู้เล่นกำหนด 2026-09-18: 8–15 ครั้ง/วิ (เดิม 6–14 · ยังชนะง่ายไป)
 const botPace=()=>PACE_MIN+Math.random()*(PACE_MAX-PACE_MIN);
 function makeOffer(){
   const choices=names.slice().sort(()=>Math.random()-.5);
   return {rivals:[0,1].map(i=>({name:choices[i],genes:SlugEngine.randGene(),pace:botPace()}))};
 }
 /* คำท้าค้างในเซฟจากก่อนแก้ยังเป็นบอทช้า — สุ่มความเร็วใหม่ตอนโหลด */
 if(state.offer?.rivals)for(const r of state.offer.rivals)if(!(r.pace>=PACE_MIN))r.pace=botPace();
 function leave(){
   for(const p of visitors){
     p.raceChallenger=false;p.family=null;p.tradeDone=true;p.visits=0;p.strolls=0;
     p.focus=null;p.route=[];p.routeGoal=null;p.tgt=doorSpot();p.state='leave';p.stuck=0;
   }
   visitors=[];offerDeadline=0;
 }
 function goal(p){
   const t=tank();
   if(!t||!(state.offer||(p.raceTour&&tourOn()))){p.raceChallenger=false;p.raceTour=false;p.visits=0;p.strolls=0;return false;}
   const spot=freeSpot(lookSpots(t),p);
   if(spot){p.focus=t;p.tgt=spot;p.state='walk';p.route=[];p.routeGoal=null;p.stuck=0;return true;}
   p.focus=null;p.tgt=strollSpot(p);p.state='walk';return true;
 }
 function spawn(){
   if(visitors.length||!peopleOn||!tank()||document.hidden||tankMode||window.BOOTING)return;
   if(!ShopEvents.ready())return;                 // ตู้อื่นเพิ่งส่งคำท้ามา รออีก 3 นาที (config.js EVENT_SPACING)
   const capacity=challengerRoom();
   if(capacity<2)return;
   const previous=new Set(PEOPLE);
   if(!spawnVisitors(capacity,'race',[{kid:false,gender:Math.random()<.5?'female':'male'},{kid:false,gender:Math.random()<.5?'female':'male'}]))return;
   visitors=PEOPLE.filter(p=>!previous.has(p));ShopEvents.mark();
   if(!state.offer){state.offer=makeOffer();state.nextAt=Date.now()+gap();saveGame();}
   visitors.forEach((p,i)=>{
     p.family=null;p.raceChallenger=true;p.wantsBuy=false;p.wantsSell=false;p.tradeDone=true;
     p.carryTank=true;p.carryColor='#267b86';p.carryAccent=slugBaseHex(state.offer.rivals[i].genes);
     if(typeof makeSlug==='function')p.carrySlug=makeSlug(state.offer.rivals[i].genes);   // ทากคู่แข่งตัวจริงในตู้
     p.bagged=false;p.accessory='none';p.visits=1;p.strolls=0;goal(p);
   });
   offerDeadline=Date.now()+5*MINUTE;
   toast('🏁 ผู้ท้าสองคนมาถึงแล้ว! คลิกคนถือตู้เพื่อแข่งทาก','good');
 }
 /* ⚠️ 2026-09-18 นับเวลานัดหน้า "หลังจบเรื่องนี้" ไม่ใช่ตอนผู้ท้าเข้าร้าน
    เดิมตั้งตอนสปอว์น → ระหว่างรับคำท้า + แข่ง + อ่านผล เวลาก็เดินหมดไปแล้ว พอกลับถึงร้านคนใหม่มายืนรออยู่เลย */
 function reschedule(){state.nextAt=Date.now()+gap();}
 function dismiss(){state.offer=null;leave();close();reschedule();saveGame();}
 function tick(){
   if(owned())purchased();
   practiceSync();
   if(!window.BOOTING)tourTick();
   if(state.active){
     if(resumeReady&&!modal&&!raceUI&&!window.BOOTING)openRace();
     return;
   }
   if(!tank()){
     if(state.offer){state.offer=null;leave();if(modal)close();saveGame();}
     return;
   }
   if(tourOn()){if(state.offer){state.offer=null;leave();saveGame();}return;}   // ทัวร์นาเมนต์อยู่ = ไม่มีคำท้าปกติ
   if(visitors.length&&!visitors.every(p=>PEOPLE.includes(p))){leave();}
   if(offerDeadline&&Date.now()>offerDeadline&&!modal){dismiss();return;}
   if(state.purchased&&Date.now()>=state.nextAt||state.offer)spawn();
 }
 function element(tag,text,parent){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(parent)parent.append(e);return e;}
 function dialog(title){
   modal=element('dialog');modal.className='slug-race-dialog';modal.setAttribute('aria-label',title);
   modal.addEventListener('cancel',e=>{e.preventDefault();if(modal?.dataset.tour)return;if(!state.active)dismiss();});
   /* กดนอกกรอบ (dialog-dismiss.js) ตอนเป็นหน้ารับคำท้า = "กลับไปเตรียมทาก" ไม่ใช่ไล่ผู้ท้ากลับเหมือน Esc
      หน้าผลแข่ง (state.active) ปล่อยให้ไปทาง cancel → complete() ตามเดิม */
   modal.addEventListener('lightdismiss',e=>{if(modal?.dataset.tour){e.preventDefault();return;}if(!state.active){e.preventDefault();close();}});
   element('h2',title,modal);document.body.append(modal);modal.showModal();return modal;
 }
 function close(){
   for(const animation of burstAnimations)animation.cancel();burstAnimations=[];
   modal?.close();modal?.remove();modal=null;
   raceResize?.disconnect();raceResize=null;
   raceUI?.remove();raceUI=null;document.body.classList.remove('race-in-tank');
   sprites=[];buttons=[];powerUI=null;lastFrame=0;lastKey=null;cameraKey='';
 }
 function ask(){
   if(modal||!state.offer||!tank()||state.active)return;
   const d=dialog('🏁 มาแข่งทากกันไหม?'),t=tank();
   element('p',state.offer.rivals.map(r=>r.name).join(' และ ')+' ขอท้าประลอง วิ่งไป-กลับ '+TRACK_CM+' ซม.',d);
   element('p','กดจนเกจพลังเต็ม แล้วเลือก J บล็อคคู่แข่ง 2 วิ หรือ K วิ่งเร็ว 2 วิ',d);
   element('p','ที่ 1 ได้เพิ่ม 2 เท่าของเดิมพัน · ที่ 2 เงินเท่าเดิม · ที่ 3 เสียตามเดิมพัน',d);
   /* เลือกทากเป็นการ์ดรูปทาก + แผงยีนตอนชี้/กดค้าง เหมือนหน้าเลือกทากผสมพันธุ์ (slug-hover.js) */
   element('p','เลือกทากในตู้แข่ง',d);
   let picked=t.slugs[0]?.id||null;
   const stepOf=s=>stride(foodGenes(s)).step;
   SlugHover.cards(element('div',null,d),{slugs:t.slugs,selected:picked,empty:'ยังไม่มีทากในตู้แข่ง',
     sub:s=>'ก้าวละ '+stepOf(s).toFixed(1)+' ซม.',onPick:s=>{picked=s.id;rate();}});
   /* บอกตรง ๆ ว่าทากตัวที่เลือกต้องกดกี่ครั้ง/วิ ถึงจะแซงคู่แข่งที่เร็วที่สุด — ก้าวยาว = กดน้อยลง
      (แบบเดียวกับบรรทัดประเมินของชักเย่อ) ทำให้การเลือกทากมีผลจริง ไม่ใช่กดรัวอย่างเดียว */
   const verdict=element('p','',d);verdict.className='race-verdict';
   const rate=()=>{
     const s=t.slugs.find(x=>x.id===picked);if(!s){verdict.textContent='';return;}
     const fastest=Math.max(...state.offer.rivals.map(r=>stride(r.genes).step*r.pace)),need=fastest/stepOf(s);
     verdict.textContent='คู่แข่งที่เร็วสุดวิ่ง '+fastest.toFixed(0)+' ซม./วิ → ทากตัวนี้ต้องกด '+need.toFixed(1)+' ครั้ง/วิ ถึงจะชนะ'
       +(need<=7?' (สบาย)':need<=11?' (พอไหว)':' (หนักมาก — ลองตัวที่ก้าวยาวกว่านี้)');
   };
   rate();
   const betLabel=element('label','เดิมพัน (ทอง) — ยังไม่หักตอนเริ่ม',d),bet=element('input',null,betLabel);
   const maxBet=Math.max(0,Math.min(1000,Math.floor(G.coin)));
   bet.type='number';bet.min='0';bet.max=String(maxBet);bet.step='1';bet.value='0';
   /* ปุ่มเลือกเดิมพันด่วน — "สูงสุด" = 1,000 ถ้ามีทองเกิน ไม่งั้นเท่าที่มี · ปุ่มที่เกินทองที่มีกดไม่ได้ */
   const quick=element('div',null,d);quick.className='race-bet-quick';
   const pickBet=v=>{bet.value=String(v);for(const b of quick.children)b.setAttribute('aria-pressed',String(+b.dataset.v===v));};
   const presets=[['ไม่เดิมพัน',0],...[100,300,500].filter(v=>v<maxBet).map(v=>[String(v),v])];   // ต่ำกว่าสูงสุดเท่านั้น ไม่ซ้ำปุ่มสูงสุด
   if(maxBet>0)presets.push(['สูงสุด '+maxBet.toLocaleString(),maxBet]);
   for(const [label,v] of presets){
     const b=element('button',label,quick);b.type='button';b.className='tbtn';b.dataset.v=String(v);b.setAttribute('aria-pressed',String(v===0));b.onclick=()=>pickBet(v);
   }
   bet.addEventListener('input',()=>{for(const b of quick.children)b.setAttribute('aria-pressed',String(+b.dataset.v===+bet.value));});
   element('p','เดิมพันได้ 0–'+maxBet.toLocaleString()+' ทอง • กด A / D สลับกัน หรือแตะปุ่มซ้าย / ขวา',d);
   const error=element('p','',d);error.setAttribute('role','alert');
   const start=element('button','เริ่มแข่ง',d);start.className='tbtn';start.disabled=!t.slugs.length;
   if(!t.slugs.length)error.textContent='ยังไม่มีทากในตู้แข่ง ย้ายทากเข้าตู้ก่อนรับคำท้า';
   start.onclick=()=>{
     const wager=Number(bet.value),s=t.slugs.find(x=>x.id===picked);
     if(!s||!G.objs.includes(t)||!Number.isInteger(wager)||wager<0||wager>Math.min(1000,G.coin)){
       error.textContent='เลือกทากในตู้ และใส่เดิมพันเป็นจำนวนเต็มไม่เกิน 1,000 หรือทองที่มี';return;
     }
     const entrants=[{name:slugNick(s),genes:{...foodGenes(s)},id:s.id},...state.offer.rivals];
     state.active={tankId:t.id,wager,elapsed:0,countdown:3,lastKey:null,settled:false,rank:0,
       entrants:entrants.map((r,i)=>({...r,...stride(r.genes),head:START,finished:null,next:i?1/r.pace:0}))};
     // Clear the track before the countdown; normal slugs stay behind 40 cm.
     t.slugs.filter(x=>x!==s).forEach(x=>{x.fy=Math.max(8+slugCm(x.genes)/CM_PER_CELL*.55,x.fy);x.wall=null;x.climbZ=0;});
     saveGame();close();openRace();
   };
   const no=element('button','ไม่แข่ง ให้ผู้ท้ากลับ',d);no.className='tbtn';no.onclick=dismiss;
   const later=element('button','กลับไปเตรียมทาก',d);later.className='tbtn';later.onclick=close;
 }
 /* ---------- โหมดซ้อม: คู่แข่งคือทากในตู้ที่ผู้เล่นเลือกเอง ไม่มีเดิมพัน (slug-practice.js) ---------- */
 function practiceSync(){
   const t=tank();
   if(typeof SlugPractice==='undefined')return;
   SlugPractice.sync('race',!!t&&tankMode&&curTank===t&&!state.active&&!modal?.open&&!tourOn(),'🏁 ซ้อมวิ่ง',()=>{
     SlugPractice.pick({tank:t,title:'🏁 ซ้อมวิ่งทาก',need:2,
       noteFor:s=>'ก้าวละ '+stride(foodGenes(s)).step.toFixed(1)+' ซม.',
       onStart:(mine,others)=>beginPractice(t,mine,others)});
   });
 }
 function beginPractice(t,s,others){
   const entrants=[{name:slugNick(s),genes:{...foodGenes(s)},id:s.id},
     ...others.map(o=>({name:slugNick(o),genes:{...foodGenes(o)},pace:botPace()}))];
   state.active={tankId:t.id,wager:0,practice:true,elapsed:0,countdown:3,lastKey:null,settled:false,rank:0,
     entrants:entrants.map((r,i)=>({...r,...stride(r.genes),head:START,finished:null,next:i?1/r.pace:0}))};
   t.slugs.filter(x=>x!==s).forEach(x=>{x.fy=Math.max(8+slugCm(x.genes)/CM_PER_CELL*.55,x.fy);x.wall=null;x.climbZ=0;});
   saveGame();close();openRace();
 }
 function drawTrack(c,project){
   const quad=(x0,y0,x1,y1,color)=>{const pts=[project(x0,y0),project(x1,y0),project(x1,y1),project(x0,y1)];c.fillStyle=color;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();};
   c.save();
   for(let i=0;i<3;i++)quad(0,2+i*2,40,4+i*2,['#c2d5bc','#e4cea1','#c4d6db'][i]);
   // Physical strips remain visible under water and retain width at every zoom.
   for(const y of [2,4,6,8])quad(0,y-.045,40,y+.045,'#244f56');
   /* วิ่งไป-กลับ: เส้นเริ่ม = เส้นชัย (ธงตาหมากรุกที่ 20 ซม.) · ปลายทางฝั่งไกล = เส้นกลับตัวสีส้ม + ลูกศรย้อน */
   const T=TURN/CM_PER_CELL,F=START/CM_PER_CELL;
   for(let row=0;row<12;row++)for(let col=0;col<2;col++)quad(F-.2+col*.2,2+row*.5,F+col*.2,2+(row+1)*.5,(row+col)%2?'#f4ebd1':'#233b40');
   quad(T-.08,2,T+.08,8,'#e08a2e');
   for(let lane=0;lane<3;lane++){const y=3+lane*2,pts=[project(T-.3,y-.45),project(T-1.3,y),project(T-.3,y+.45)];
     c.fillStyle='rgba(224,138,46,.55)';c.beginPath();pts.forEach((p,k)=>k?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();}
   c.restore();
 }
 function drawChallengers(){
   if(!state.offer)return;
   /* ป้ายเดิมใช้ textBaseline ปริยาย ('alphabetic') แต่กล่องกำหนดสูง/ตำแหน่งตายตัวแยกกัน
      สระบน-ล่างของภาษาไทยเลยหลุดกรอบ/ลอยไม่ตรงกล่อง — ที่นี่จัดกลางทั้งแนวตั้ง-นอนจริง
      และวัดความกว้างตัวอักษรจริงแทนเลข 124 ตายตัว กล่องจึงพอดีข้อความเสมอ
      โทนสี/ขอบทองอิงป้าย .race-tank-banner ในตู้แข่ง ให้เข้าธีมเดียวกับเกมทั้งหมด */
   const font='bold 13px "IBM Plex Sans Thai",sans-serif',label='🏁 คลิกเพื่อแข่ง';
   ctx.save();ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';
   const padX=16,padY=9,textW=ctx.measureText(label).width,boxW=textW+padX*2,boxH=13+padY*2,radius=boxH/2;
   const glow=.55+.35*(.5+.5*Math.sin(performance.now()/260));
   visitors.forEach(p=>{
     if(!personOnScreen(p))return;
     const b=personScreenBounds(p);
     const x=clamp((b.x0+b.x1)/2,boxW/2+4,CW-boxW/2-4),y=clamp(b.y0-boxH/2-10,boxH/2+4,CH-boxH/2-4);
     const left=x-boxW/2,top=y-boxH/2;
     ctx.beginPath();
     ctx.moveTo(left+radius,top);
     ctx.arcTo(left+boxW,top,left+boxW,top+boxH,radius);
     ctx.arcTo(left+boxW,top+boxH,left,top+boxH,radius);
     ctx.arcTo(left,top+boxH,left,top,radius);
     ctx.arcTo(left,top,left+boxW,top,radius);
     ctx.closePath();
     ctx.fillStyle='rgba(15,45,50,.92)';ctx.fill();
     ctx.lineWidth=1.4;ctx.strokeStyle='rgba(231,198,123,'+glow+')';ctx.stroke();
     ctx.fillStyle='#ffe1a0';ctx.fillText(label,x,top+boxH/2+1);
     p._raceHit={x0:left,x1:left+boxW,y0:top,y1:top+boxH};
   });
   ctx.restore();
 }
 /* ⚠️ 2026-09-17 ผู้เล่น: "ต้องกดที่ผู้เข้าแข่งเท่านั้น" — เดิมใช้ personScreenBounds ซึ่งเป็นกรอบตัดจอหยาบ ๆ
    (เผื่อท่าแขนทุกท่า ซูมใกล้แล้วคลุมตู้ข้าง ๆ/พื้นว่างกว้างมาก) กดตู้แข่งหรือพื้นแถวนั้นก็เด้งหน้าท้าแข่ง
    ตอนนี้นับเฉพาะ "ตัวคนจริง" (personHitTest ตัวเดียวกับชักเย่อ) หรือป้าย "คลิกเพื่อแข่ง" เหนือหัว */
 function hit(e){
   if(tankMode||modal||!state.offer||appMode!=='view'||moving||buyKey)return false;
   const {sx,sy}=screenXY(e);
   return visitors.some(p=>{const h=p._raceHit;return personOnScreen(p)&&
     (personHitTest(p,sx,sy)||(h&&sx>=h.x0&&sx<=h.x1&&sy>=h.y0&&sy<=h.y1));});
 }
 let pressedVisitor=false;
 cv.addEventListener('pointerdown',e=>{if(hit(e)){pressedVisitor=true;e.preventDefault();e.stopImmediatePropagation();}},true);
 cv.addEventListener('pointerup',e=>{if(pressedVisitor){pressedVisitor=false;e.preventDefault();e.stopImmediatePropagation();if(hit(e))ask();}},true);
 cv.addEventListener('pointercancel',()=>{pressedVisitor=false;},true);
 function finish(r,time){if(r.head>=GOAL&&r.finished===null){r.head=GOAL;r.finished=time;}}
 const walled=(r,time)=>time<(r.blockUntil||0)&&Number.isFinite(r.wallAt);
 /* ก้าวหนึ่งครั้ง (ทั้งคนกดและบอท) — มีกำแพงอยู่ = เดินได้ถึงหน้ากำแพงแล้วติด · บัฟเร็ว = ก้าวยาวขึ้น · ทุกก้าวสะสมเกจพลัง
    ⚠️ 2026-09-18 ผู้เล่น: "ติดกำแพงแล้วเกจไม่ขึ้น กดกำแพงรัว ๆ ก็ล็อกคู่แข่งได้ตลอด ไม่ควร"
       เดิมชนกำแพงแล้ว return ก่อนบวกเกจ = คนโดนบล็อคทั้งเดินไม่ออกทั้งชาร์จไม่ได้ ไม่มีทางสู้กลับ
       ตอนนี้ติดกำแพง = "ออกแรงดันอยู่กับที่" ยังสะสมเกจเต็มอัตรา แค่ไม่ขยับ → กำแพงหายก็มีพลังสวนกลับได้ */
 function stepOnce(r,time){
   const stuck=walled(r,time)&&r.head>=r.wallAt;
   if(!stuck){
     let next=r.head+r.step*(time<(r.boostUntil||0)?BOOST_MUL:1);
     if(walled(r,time))next=Math.min(next,r.wallAt);
     r.head=next;
   }
   r.charge=Math.min(CHARGE_AT,(r.charge|0)+1);
   if(!stuck)finish(r,time);
   return true;
 }
 function usePower(i,kind){
   const a=state.active;if(!a||a.settled||a.countdown>0)return false;
   const r=a.entrants[i];if(!r||r.finished!==null||(r.charge|0)<CHARGE_AT)return false;
   r.charge=0;r.aiAt=null;
   if(kind==='block')a.entrants.forEach((o,j)=>{if(j===i||o.finished!==null)return;
     if(!walled(o,a.elapsed))o.wallAt=Math.min(GOAL,o.head+WALL_GAP);   // กำแพงเดิมยังอยู่ = คงตำแหน่งเดิม แค่ต่อเวลา
     o.blockUntil=Math.max(o.blockUntil||0,a.elapsed+POWER_T);});
   else r.boostUntil=a.elapsed+POWER_T;
   r.lastPower={kind,at:a.elapsed};
   return true;
 }
 /* บอท: เกจเต็มแล้วรอแป๊บ (0.3–1.5 วิ) ค่อยใช้ · มีคนนำอยู่ = ชอบบล็อค · นำอยู่เอง = ชอบวิ่งเร็ว */
 function botPower(a,i){
   const r=a.entrants[i];if(r.finished!==null||(r.charge|0)<CHARGE_AT)return;
   if(r.aiAt==null){r.aiAt=a.elapsed+.3+Math.random()*1.2;return;}
   if(a.elapsed<r.aiAt)return;
   const ahead=a.entrants.some((o,j)=>j!==i&&o.finished===null&&o.head>r.head);
   usePower(i,(ahead?Math.random()<.65:Math.random()<.35)?'block':'boost');
 }
 /* ⚠️ 2026-09-17 ผู้เล่นขอ: "รอให้เข้าครบก่อน" — เดิมตัดจบทันทีที่เราเข้าเส้นชัย หรือทันทีที่คู่แข่งสองตัวเข้าหมด
    ตอนนี้จบเมื่อทุกตัวเข้าเส้นชัยจริง · กันค้าง: บอทเข้าครบแล้วเราไม่กดต่อ รอ RACE_GRACE วิ ก่อนนับว่าเราไม่ถึงเส้น */
 const RACE_GRACE=25;
 const RUSH=2;                               // ⚙️ ตัวคูณความเร็วคู่แข่งหลังเราเข้าเส้นชัย
 function advance(dt){
   const a=state.active;if(!a||a.settled)return;
   if(a.countdown>0){a.countdown=Math.max(0,a.countdown-dt);return;}
   a.elapsed+=dt;
   /* เราเข้าเส้นชัยแล้ว = ตัวที่เหลือกดเร็วขึ้น RUSH เท่า จะได้ไม่ต้องนั่งรอนาน (ผู้เล่นขอ 2026-09-18)
      อันดับยังตัดสินที่ "เวลาเข้าเส้น" เหมือนเดิม ของเราเข้าไปก่อนแล้วจึงไม่มีทางโดนแซงย้อนหลัง */
   const rush=(!a.botOnly&&a.entrants[0].finished!==null)?RUSH:1;
   for(let i=a.botOnly?0:1;i<a.entrants.length;i++){
     const r=a.entrants[i];
     while(r.finished===null&&r.next<=a.elapsed){stepOnce(r,r.next);r.next+=1/(r.pace*rush);}
     botPower(a,i);
   }
   if(a.entrants.every(r=>r.finished!==null)){settleSoon();return;}
   const bots=a.botOnly?a.entrants:a.entrants.slice(1);
   if(!a.botOnly&&bots.every(r=>r.finished!==null)&&a.entrants[0].finished===null&&a.elapsed-Math.max(...bots.map(r=>r.finished))>RACE_GRACE){
     a.entrants[0].finished=Infinity;settleSoon();
   }
 }
 /* เว้นจังหวะให้เห็นตัวสุดท้ายแตะเส้นก่อนเด้งกล่องผล */
 function settleSoon(){const a=state.active;if(!a||a.settled||a._settleAt)return;a._settleAt=a.elapsed+.9;}
 const stepCap=makePressLimiter();        // เพดาน 20 ครั้ง/วิ (config.js) กันมาโครกดวิ่ง/ปั๊มกำแพง
 function press(key){
   const a=state.active;if(!a||a.botOnly||a.settled||a.countdown>0||document.hidden||lastKey===key||a.entrants[0].finished!==null)return;
   if(!stepCap())return;
   const r=a.entrants[0];
   /* ⚠️ 2026-09-18 เดิม return ตรงนี้ตอนชนกำแพง = ปุ่มไม่ถูกนับเลย เกจเลยไม่ขึ้นด้วย
      ตอนนี้ปล่อยให้กดต่อได้ stepOnce จะไม่ขยับตัวแต่ยังสะสมเกจให้ (ดู stepOnce) */
   lastKey=key;a.lastKey=key;stepOnce(r,a.elapsed);   // เข้าเส้นชัยแล้วไม่จบทันที รอตัวอื่น (advance)
   buttons.forEach((b,i)=>{b.classList.toggle('next',(key==='a'?1:0)===i);});
   const b=buttons[key==='a'?0:1];b?.animate([{transform:'scale(.9)',background:'#f4cc68'},{transform:'scale(1)',background:'#296875'}],{duration:150});
 }
 function settle(){
   const a=state.active;if(!a||a.settled)return;
   if(a.tour){a.settled=true;saveGame();tourHeatDone();return;}
   a.rank=1+a.entrants.slice(1).filter(r=>r.finished!==null&&r.finished<=a.entrants[0].finished).length;
   a.delta=a.practice?0:a.rank===1?a.wager*2:a.rank===3?-a.wager:0;
   addCoin(a.delta);a.settled=true;saveGame();syncHUD();showResult();
 }
 function complete(){
   /* ซ้อม: ไม่ยุ่งกับคำท้าที่ค้างอยู่ ไม่รีเซ็ตนาฬิกา และอยู่ในตู้ต่อ */
   if(state.active?.practice){state.active=null;close();saveGame();return;}
   state.active=null;state.offer=null;leave();close();exitTank();reschedule();saveGame();
 }
 /* พลุเต็มจอ (js/fireworks.js) — เรียกหลังเปิดกล่องผล พลุจึงอยู่เหนือกล่องใน top layer */
 function resultFireworks(){if(window.Fireworks)Fireworks.play({count:10,duration:3000});}
 function showResult(){
   const a=state.active;if(!a?.settled||modal)return;
   buttons.forEach(b=>b.disabled=true);
   /* บอกระบบเควสว่าชนะแล้ว (quests.js) — ธง _qWin กันนับซ้ำ เพราะกลับเข้าตู้ตอน settled แล้วจะเรียก showResult ใหม่ */
   if(a.rank===1&&!a._qWin){a._qWin=true;window.questContestWin?.();}
   const d=dialog('คุณได้อันดับที่ '+a.rank);d.id='raceResult';d.classList.add('race-result');
   d.addEventListener('cancel',e=>{e.preventDefault();complete();});
   element('p',a.rank===1?'ชนะการแข่งขัน!':a.rank===2?'เข้าเส้นชัยเป็นอันดับสอง':'เข้าเป็นอันดับสุดท้าย',d).className='race-result-caption';
   const podium=element('div',null,d);podium.className='race-podium';
   // Final order at the moment the player's placing is decided.
   const ordered=a.entrants.map((r,i)=>({r,i})).sort((x,y)=>((x.r.finished??Infinity)-(y.r.finished??Infinity))||(y.r.head-x.r.head)||(y.i-x.i));
   for(const place of [2,1,3]){
     const {r,i}=ordered[place-1],step=element('div',null,podium);step.className='race-podium-step place-'+place+(i===0?' is-player':'');
     element('span',i===0?'คุณ':r.name,step).className='race-podium-name';
     const c=element('canvas',null,step);c.width=180;c.height=110;c.setAttribute('aria-label',r.name);c.setAttribute('role','img');
     const sprite=slugSprite(sprites[i]||{genes:r.genes});if(sprite){const scale=Math.min(160/sprite.c.width,100/sprite.c.height),w=sprite.c.width*scale,h=sprite.c.height*scale;c.getContext('2d').drawImage(sprite.c,(180-w)/2,(110-h)/2,w,h);}
     const block=element('div',null,step);block.className='race-podium-block';element('span',['','🥇','🥈','🥉'][place],block).className='race-medal';element('b',String(place),block);
   }
   const receipt=element('div',null,d);receipt.className='race-receipt';
   if(a.practice){
     element('span','โหมดซ้อม',receipt);
     element('strong','ไม่มีเดิมพัน',receipt);
     element('small','ซ้อมได้ไม่จำกัด · คำท้าจริงถึงจะมีเงินรางวัล',receipt);
   }else{
     element('span','เดิมพัน '+a.wager.toLocaleString()+' ทอง',receipt);
     element('strong',(a.delta>0?'ได้รับ +':a.delta<0?'เสีย ':'ไม่เสีย ไม่ได้เพิ่ม · ')+a.delta.toLocaleString()+' ทอง',receipt);
     element('small','ทองคงเหลือ '+G.coin.toLocaleString(),receipt);
     element('p',a.rank===1?'ผู้ท้า: ฝากไว้ก่อน! คราวหน้าจะเอาคืน!':a.rank===2?'ผู้ท้า: ไว้เจอกันใหม่อีกครั้ง!':'ผู้ท้า: ฮ่า ๆ! ฝึกมาอีกหน่อยนะ!',d).className='race-taunt';
   }
   const done=element('button','รับทราบ · กลับร้าน',d);done.className='tbtn';done.onclick=complete;done.focus();resultFireworks(d);
 }
 function isRacing(t){return !!raceUI&&!!state.active&&(!t||t.id===state.active.tankId);}
 function normalSlugs(t){const id=state.active.botOnly?null:state.active.entrants[0].id;return t.slugs.filter(s=>s.id!==id);}
 function stepNormal(slugs,dt){
   const t=G.objs.find(o=>o.id===state.active.tankId);if(!t)return;
   stepTankSlugs(slugs,t.def.w,t.def.h,dt,true,t.decor,t.def);
   for(const s of slugs){const min=8+slugCm(s.genes)/CM_PER_CELL*.55;if(s.fy<min){s.fy=min;s.state='rest';s.stt=1;}s.wall=null;s.climbZ=0;}
 }
 function updateTankFrame(now){
   if(!isRacing(curTank)||document.hidden||!countNode||!raceUI.querySelector('.race-controls'))return;
   const dt=Math.min(.05,(now-(lastFrame||now))/1000);lastFrame=now;advance(dt);
   const a=state.active,r=a.entrants[0];
   /* ⚠️ settle() ของทัวร์นาเมนต์ปิด HUD + ล้าง sprites ทันที (tourHeatDone) ต้องหยุดเฟรมนี้ตรงนี้
      ไม่งั้นโค้ดข้างล่างอ่าน sprites[i] ที่ว่างแล้วพัง → ลูปวาดตู้ (drawTank) ตายทั้งลูป เที่ยวถัดไปค้างที่นับถอยหลัง */
   if(a._settleAt!=null&&!a.settled&&a.elapsed>=a._settleAt){settle();if(state.active!==a||!raceUI)return;}
   if(a._settleAt!=null&&!a.settled)a.elapsed+=dt;               // นับเวลาต่อระหว่างเว้นจังหวะ (advance หยุดนับเมื่อทุกตัวเข้าเส้นแล้ว)
   a.entrants.forEach((r,i)=>{
     const s=sprites[i],old=s.viewHead??r.head;
     s.viewHead=r.finished!==null?r.head:old+(r.head-old)*(1-Math.exp(-dt*18));
     if(Math.abs(r.head-s.viewHead)<.002)s.viewHead=r.head;
     s.creepT=((s.viewHead-START)/(CREEP_BODY_PER_CYCLE*r.length))*Math.PI*2;
     s.state=a.countdown===0&&!a.settled&&Math.abs(s.viewHead-old)>.001?'walk':'rest';
   });
   const top=60,bottom=raceBottom,usable=Math.max(90,TCH-top-bottom);
   const key=TCW+'|'+TCH+'|'+bottom;
   /* กล้องตาม "ตำแหน่งในตู้" ของตัวที่นำ (ขากลับตำแหน่งจะวิ่งย้อนกลับมาทางซ้าย) */
   const lead=trackX(a.botOnly?sprites.reduce((m,x)=>Math.max(m,x.viewHead??START),START):sprites[0].viewHead);
   if(cameraKey!==key){cameraKey=key;tankCam.zoom=Math.max(.25,Math.min(1.6,(TCW-32)/(CELLW*(TCW<600?12:18)+DEPX*6),usable/(DEPY*8+80)));}
   const desiredX=TCW*.46,desiredY=top+usable*.74,z=tankCam.zoom;
   tankCam.ox=desiredX-((lead/CM_PER_CELL-curTank.def.w/2)*CELLW+(3-curTank.def.h/2)*DEPX)*z;
   tankCam.oy=desiredY+(3-curTank.def.h/2)*DEPY*z+SAND_CELLS*ZH*z;tankNeedFit=false;
   const message=a.countdown>0?String(Math.ceil(a.countdown)):a.settled||a._settleAt!=null?'จบการแข่งขัน'
     :a.botOnly?'กำลังแข่ง'
     :r.finished!==null?'เข้าเส้นชัยแล้ว! ตัวอื่นกำลังเร่งเข้าเส้น ⏩'
     :walled(r,a.elapsed)?(r.head>=r.wallAt?'🧱 ชนกำแพง! กดต่อไปเพื่อชาร์จเกจ · อีก '+Math.ceil(r.blockUntil-a.elapsed)+' วิ':'🧱 มีกำแพงข้างหน้า!')
     :(r.charge|0)>=CHARGE_AT?'⚡ พลังเต็ม! J บล็อค · K วิ่งเร็ว'
     :lastKey?'กด '+(lastKey==='a'?'D / ขวา':'A / ซ้าย'):'เริ่ม! กด A / D สลับกัน';
   if(countNode.textContent!==message)countNode.textContent=message;
   const leg=x=>x.head>=TURN?' (ขากลับ)':'';
   const distance=a.botOnly?a.entrants.map(x=>x.name+' '+Math.min(TRACK_CM,Math.max(0,x.head-START)).toFixed(0)+leg(x)).join(' · ')+' / '+TRACK_CM+' ซม.'
     :Math.min(TRACK_CM,Math.max(0,r.head-START)).toFixed(0)+' / '+TRACK_CM+' ซม.'+leg(r);
   if(raceProgress.textContent!==distance)raceProgress.textContent=distance;
   if(powerUI){
     const full=(r.charge|0)>=CHARGE_AT&&r.finished===null&&!a.settled&&a.countdown<=0;
     powerUI.fill.style.width=((r.charge|0)/CHARGE_AT*100)+'%';
     powerUI.box.classList.toggle('is-full',full);
     powerUI.block.disabled=powerUI.boost.disabled=!full;
     powerUI.boost.classList.toggle('is-on',a.elapsed<(r.boostUntil||0));
   }
   if(now-lastSave>1000){saveGame();lastSave=now;}
 }
 /* กำแพงบล็อค: แผ่นหินตั้งขวางเลนของตัวนั้นที่ตำแหน่ง wallAt · โผล่ขึ้นจากพื้นช่วงแรก และกะพริบก่อนหาย 0.4 วิสุดท้าย */
 function drawWall(r,i){
   const a=state.active;if(!walled(r,a.elapsed))return;
   const left=r.blockUntil-a.elapsed,age=POWER_T-left;
   if(left<.4&&Math.floor(left*12)%2)return;
   const x=trackX(r.wallAt)/CM_PER_CELL,y0=3+i*2-.8,y1=3+i*2+.8,t=.25,rise=Math.min(1,age/.18),H=1.6*rise;
   const face=(ax,ay,bx,by,fill)=>{const p=[S(ax,ay,SAND_CELLS),S(bx,by,SAND_CELLS),S(bx,by,SAND_CELLS+H),S(ax,ay,SAND_CELLS+H)];
     tctx.fillStyle=fill;tctx.beginPath();p.forEach((q,k)=>k?tctx.lineTo(q.x,q.y):tctx.moveTo(q.x,q.y));tctx.closePath();tctx.fill();
     tctx.strokeStyle='rgba(40,24,16,.6)';tctx.lineWidth=1;tctx.stroke();};
   tctx.save();
   face(x-t/2,y1,x+t/2,y1,'#6d5a48');                          // ด้านหลัง
   face(x+t/2,y0,x+t/2,y1,'#8a735c');                          // ด้านข้างขวา
   face(x-t/2,y0,x-t/2,y1,'#9c8468');                          // ด้านข้างซ้าย
   const top=[S(x-t/2,y0,SAND_CELLS+H),S(x+t/2,y0,SAND_CELLS+H),S(x+t/2,y1,SAND_CELLS+H),S(x-t/2,y1,SAND_CELLS+H)];
   tctx.fillStyle='#c9b08a';tctx.beginPath();top.forEach((q,k)=>k?tctx.lineTo(q.x,q.y):tctx.moveTo(q.x,q.y));tctx.closePath();tctx.fill();
   face(x-t/2,y0,x+t/2,y0,'#b39673');                          // ด้านหน้า (ใกล้กล้อง)
   const c=S(x,y0,SAND_CELLS+H+.15);tctx.font='bold '+Math.max(12,14*tankCam.zoom).toFixed(0)+'px sans-serif';tctx.textAlign='center';tctx.textBaseline='bottom';
   tctx.fillText('🧱 '+Math.ceil(left),c.x,c.y);
   tctx.restore();
 }
 function racingItems(){return state.active.entrants.map((r,i)=>({sortY:3+i*2,kind:'race',r,i}));}
 function drawRunner(r,i){
   const s=sprites[i],parts=slugPartsOf(s);if(!parts)return;
   drawWall(r,i);
   const d=s.viewHead??r.head,out=d<TURN,side=out?1:-1;   // ขาไปหันขวา · ขากลับหันซ้าย (หัวนำเสมอ)
   s.flip=out;
   const p=S(trackX(d)/CM_PER_CELL,3+i*2,SAND_CELLS),scale=r.length*depthPxPerCm()/(parts.bw*parts.s),w=parts.w*scale,h=parts.h*scale;
   if(p.x+w<0||p.x-w>TCW||p.y<0||p.y-h>TCH)return;
   const stretch=s.state==='walk'?1+Math.sin(s.creepT)*.035:1;
   const centerX=p.x-side*((parts.L+parts.R)/2-parts.bw/2*(1-stretch))*parts.s*scale,cy=p.y-h*.44;
   drawTankSlug(s,parts,scale,centerX,cy,false);
   drawDefaultEyes(parts,centerX,cy,s.flip,parts.s*scale);
   const a=state.active,bodyX=p.x-side*r.length*depthPxPerCm()/2;
   const tag=a.tour?(i===0&&!a.botOnly?'ทีมเรา':r.name):i===0?'คุณ':null;
   if(tag){tctx.save();tctx.font='bold 12px sans-serif';tctx.textAlign='center';const tw=Math.max(40,tctx.measureText(tag).width+14),mine=i===0&&!a.botOnly;
     tctx.fillStyle=mine?'#153c42':'#3c1a18';tctx.fillRect(bodyX-tw/2,p.y+8,tw,19);tctx.fillStyle=mine?'#ffe3a0':'#ffc9b6';tctx.fillText(tag,bodyX,p.y+22);tctx.restore();}
   /* สถานะพลังเหนือตัว: ⚡ วิ่งเร็ว · 💥 แวบเดียวตอนเพิ่งกดบล็อค (กำแพงวาดแยกใน drawWall) */
   const fx=['',a.elapsed<(r.boostUntil||0)?'⚡':'',r.lastPower?.kind==='block'&&a.elapsed-r.lastPower.at<.6?'💥':''].join('');
   if(fx){tctx.save();tctx.font=Math.max(16,22*tankCam.zoom).toFixed(0)+'px sans-serif';tctx.textAlign='center';tctx.textBaseline='bottom';tctx.fillText(fx,bodyX,p.y-h*.95);tctx.restore();}
 }
 function openRace(){
   const a=state.active,t=G.objs.find(o=>o.id===a?.tankId);if(!a||modal||raceUI||!t)return;
   if(!a.tour)spawn();sprites=a.entrants.map(r=>({genes:r.genes,viewHead:r.head,flip:true,state:'rest',ph:0,noBob:true,creepT:0}));lastKey=a.lastKey;
   // Reuse the existing aquarium canvas, furniture, water, lighting and camera.
   raceUI=element('div');raceUI.id='raceTankHUD';document.body.classList.add('race-in-tank');
   enterTank(t);ov.querySelector('.ov-body').append(raceUI);document.getElementById('ovTitle').textContent=a.tour?'🏆 ทัวร์นาเมนต์วิ่ง · '+TOUR_ROUNDS[a.tour.round]+' · เที่ยวที่ '+(a.tour.heat+1):'🏁 ตู้แข่งทากทะเล';
   const banner=element('div',null,raceUI);banner.className='race-tank-banner';countNode=element('div','3',banner);countNode.className='race-count';countNode.setAttribute('role','status');raceProgress=element('small','0 / '+TRACK_CM+' ซม.',banner);
   const controls=element('div',null,raceUI);controls.className='race-controls';
   if(a.botOnly){
     const skip=element('button','⏭ ข้ามไปดูผล',controls);skip.type='button';skip.className='race-skip';
     skip.onclick=()=>{const x=state.active;if(!x||x.settled||x._settleAt!=null)return;const w=simulateHeat(x.entrants[0],x.entrants[1]);
       x.entrants.forEach((r,i)=>{r.head=GOAL;r.finished=i===w?x.elapsed:x.elapsed+.01;});settleSoon();};
     buttons=[];
   }else
   for(const [key,label] of [['a','A · ซ้าย'],['d','D · ขวา']]){
     const b=element('button',label,controls);b.type='button';b.setAttribute('aria-label','กระดึ๊บฝั่ง'+(key==='a'?'ซ้าย':'ขวา'));
     b.onpointerdown=e=>{e.preventDefault();press(key);};b.onclick=e=>{if(e.detail===0)press(key);};buttons.push(b);
     /* เกจพลัง + ปุ่ม J / K อยู่กลางระหว่างปุ่ม A กับ D */
     if(key==='a'){
       const box=element('div',null,controls);box.className='race-powers';
       const bar=element('div',null,box);bar.className='race-power-bar';const fill=element('i',null,bar);
       const row=element('div',null,box);row.className='race-power-row';
       const mk=(k,icon,text,kind)=>{const pb=element('button',null,row);pb.type='button';pb.className='race-power race-power-'+kind;
         element('b',k,pb);element('span',icon+' '+text,pb);pb.setAttribute('aria-label',text+' (ปุ่ม '+k+')');
         pb.onpointerdown=e=>{e.preventDefault();usePower(0,kind);};pb.onclick=e=>{if(e.detail===0)usePower(0,kind);};return pb;};
       powerUI={box,fill,block:mk('J','🛑','บล็อค 2 วิ','block'),boost:mk('K','⚡','วิ่งเร็ว 2 วิ','boost')};
     }
   }
   raceBottom=Math.max(88,controls.offsetHeight+22);
   raceResize=new ResizeObserver(entries=>{raceBottom=Math.max(88,entries[0].contentRect.height+22);cameraKey='';});raceResize.observe(controls);
   resizeTank();lastFrame=0;cameraKey='';if(a.settled){if(a.tour)tourHeatDone();else showResult();}
 }

 /* ================= ทัวร์นาเมนต์วิ่ง (สเปกผู้เล่น 2026-09-17) =================
    โครงเดียวกับทัวร์นาเมนต์ชักเย่อ (slug-tug.js): จดหมายเชิญ → สมัคร 1,000 → เตรียมตัว 1 นาที → เลือกทีม 3 ตัว
    → สายแข่ง 8 ทีม สุ่มลำดับ 1v2 · 3v4 · 5v6 · 7v8 → รองชนะเลิศ → ชิงชนะเลิศ · รางวัล 3,000 / 2,000 / 1,000 (ที่ 3–4)
    ต่างกัน: แต่ละคู่แข่ง "ชนะ 2 ใน 3 เที่ยว" · เที่ยวละ 1 ต่อ 1 · เราเลือกว่าจะส่งตัวไหนก่อนทุกเที่ยว
    ตัวที่วิ่งไปแล้วความสมบูรณ์ −10 นาน 1 ชั่วโมง (ทากเรา = บัฟ raceFatigue ใน foodBuffs · ทีมบอท = นับรอบวิ่งตลอดทัวร์นาเมนต์)
    สถานะอยู่ใน G.racing.tour (เซฟ/โหลดต่อได้ทุกขั้น รวมกลางคู่) · ใช้หน้าตาหน้าต่างชุดเดียวกับชักเย่อ (css/slug-tug.css) */
 /* ⚙️ ทดสอบ: จดหมายทุก 10 นาที · ใช้จริง: ทุก 2 ชั่วโมง (ผู้เล่นกำหนด 2026-09-18 · เดิมวันละฉบับ)
    ทัวร์นาเมนต์ชักเย่อก็ 2 ชั่วโมงเหมือนกัน แต่ฉบับแรกเหลื่อมกัน 1 ชั่วโมง (ดูบรรทัด tourNextAt) จะได้ไม่มาพร้อมกัน */
 const TOUR_TEST=false;
 const TOUR_GAP=TOUR_TEST?10*MINUTE:120*MINUTE;
 const TOUR_ENTRY=1000,TOUR_PREP_MS=MINUTE,TOUR_PRIZE={1:3000,2:2000,3:1000},FATIGUE_VIGOR=10,FATIGUE_MS=60*MINUTE;
 const TOUR_ROUNDS=['รอบ 8 ทีม','รอบรองชนะเลิศ','รอบชิงชนะเลิศ'];
 const TOUR_NAMES=['ม้าน้ำสายฟ้า','ปลาบินฟ้า','กุ้งเดินเร็ว','หอยพายุ','ทากสปรินต์','ปูวิ่งข้าง','ดาวตก','ปลากระเบนราบ','หมึกพ่นควัน','ฉลามครีบเงิน','คลื่นลม','เต่าเทอร์โบ'];
 let tourPeople=[],tourBar=null;
 const tourOn=()=>!!state.tour&&['prep','bracket'].includes(state.tour.status);
 const otherTourOn=()=>{const x=window.SlugTug?.tour?.();return !!x&&['prep','bracket'].includes(x.status);};
 function tourElement(tag,cls,text,parent){const e=element(tag,text,parent);if(cls)e.className=cls;return e;}
 function applyFatigue(s){
   /* บัฟติดลบ ใช้ช่องเดียวกับบัฟอาหาร → foodGenes()/stride()/การ์ดยีน เห็นผลทันที · วิ่งหลายเที่ยว = ซ้อนกันได้ (แต่ละอันนับ 1 ชม. ของตัวเอง) */
   if(!s)return;if(!Array.isArray(s.foodBuffs))s.foodBuffs=[];
   s.foodBuffs.push({type:'raceFatigue',level:1,delta:{vigor:-FATIGUE_VIGOR},until:Date.now()+FATIGUE_MS});
 }
 const botGenes=m=>({...m.genes,vigor:Math.max(0,(m.genes.vigor??50)-FATIGUE_VIGOR*(m.runs|0))});
 function tourMembers(T){
   if(!T.player)return T.members.map(m=>({genes:botGenes(m),pace:m.pace,member:m}));
   const t=tank();return (T.ids||[]).map(id=>t?.slugs.find(s=>s.id===id)).filter(Boolean).map(s=>({id:s.id,slug:s,genes:{...foodGenes(s)}}));
 }
 const avgStep=list=>list.length?list.reduce((n,m)=>n+stride(m.genes).step,0)/list.length:0;
 function simulateHeat(a,b){
   const rate=r=>r.step*(r.pace||botPace())*(.85+Math.random()*.3);
   return rate(a)>=rate(b)?0:1;
 }
 function tourNext(tr){
   for(let i=0;i<4;i++)if(tr.qf[i]==null)return {round:0,slot:i,a:i*2,b:i*2+1};
   for(let i=0;i<2;i++)if(tr.sf[i]==null)return {round:1,slot:i,a:tr.qf[i*2],b:tr.qf[i*2+1]};
   if(tr.final==null)return {round:2,slot:0,a:tr.sf[0],b:tr.sf[1]};
   return null;
 }
 const tourPlace=(tr,i)=>tr.final===i?1:tr.sf.includes(i)?2:tr.qf.includes(i)?3:5;
 const playerIdx=tr=>tr.teams.findIndex(T=>T.player);
 function recordTour(round,slot,winner){const tr=state.tour;if(round===0)tr.qf[slot]=winner;else if(round===1)tr.sf[slot]=winner;else tr.final=winner;tr.match=null;saveGame();}

 /* ---- จดหมายเชิญ ---- */
 /* ⚙️ จดหมายเชิญมีอายุเท่านี้ · หมดอายุแล้วลบจดหมายทิ้งเลย ไม่เก็บค้างในกล่องจดหมาย (ผู้เล่นขอ 2026-09-18) */
 const TOUR_MAIL_TTL=TOUR_TEST?3*MINUTE:30*MINUTE;
 function dropTourMail(id){
   if(!id||typeof computerInbox!=='function')return;
   const box=computerInbox(),i=box.findIndex(m=>m.id===id);
   if(i<0)return;
   box.splice(i,1);
   if(G.mailSent)delete G.mailSent[id];
   try{if(typeof renderComputer==='function')renderComputer();}catch(_){}
 }
 /* เรียกทุกวินาทีจาก tourTick: จดหมายที่หมดเขตและยังไม่ได้สมัคร = ลบทิ้ง
    แล้วกวาดฉบับเก่าที่ค้างจากเซฟก่อนหน้าออกให้หมดด้วย (เหลือไว้เฉพาะฉบับที่ยังสมัครได้/ที่สมัครไปแล้ว) */
 function expireTourMail(){
   const id=state.tourInvite,live=id&&Date.now()<(state.tourInviteUntil||0);
   if(id&&!live&&state.tour?.mailId!==id){dropTourMail(id);state.tourInvite=null;state.tourInviteUntil=0;saveGame();}
   if(typeof computerInbox!=='function')return;
   const keep=new Set([state.tour?.mailId,live?id:null].filter(Boolean));
   for(const m of computerInbox().slice())if(typeof m.id==='string'&&m.id.startsWith('race-tour-')&&!keep.has(m.id))dropTourMail(m.id);
 }
 function tourMail(){
   if(typeof receiveComputerMessage!=='function'||!tank()||tourOn()||state.active)return;
   if(!Number.isFinite(state.tourNextAt))state.tourNextAt=Date.now()+(TOUR_TEST?MINUTE:TOUR_GAP/2);   // ฉบับแรกของสายวิ่งมาก่อนชักเย่อ 1 ชม.
   if(Date.now()<state.tourNextAt)return;
   if(state.tourInvite&&state.tour?.mailId!==state.tourInvite)dropTourMail(state.tourInvite);   // ฉบับเก่าที่ยังค้าง = ลบก่อนส่งฉบับใหม่
   state.tourSeq=(state.tourSeq|0)+1;const id='race-tour-'+state.tourSeq;
   const ok=receiveComputerMessage({id,type:'online',repeating:true,title:'🏆 เชิญร่วมทัวร์นาเมนต์วิ่งทาก',
     body:'ทัวร์นาเมนต์วิ่ง ทีมละ 3 ตัว · 8 ทีม · แพ้คัดออก\nแต่ละคู่แข่งเที่ยวละ 1 ต่อ 1 ใครชนะ 2 ใน 3 เที่ยวผ่านรอบ\nตัวที่วิ่งแล้วความสมบูรณ์ −10 นาน 1 ชั่วโมง\nค่าสมัคร '+TOUR_ENTRY.toLocaleString()+' ทอง\n\nรางวัล\n  ที่ 1 — 3,000 ทอง\n  ที่ 2 — 2,000 ทอง\n  ที่ 3–4 — 1,000 ทอง\n\nสมัครแล้วมีเวลา 1 นาทีให้ย้ายทาก 3 ตัวลงตู้แข่งวิ่ง แล้วทีมอื่นจะทยอยมาถึงร้าน'});
   state.tourNextAt=Date.now()+TOUR_GAP;
   /* จดหมายทัวร์นาเมนต์มาแล้ว = เลื่อนคำท้า 1 ต่อ 1 ของตู้นี้ออกไปด้วย (ผู้เล่นขอ 2026-09-18)
      ไม่งั้นกำลังจะลงทัวร์นาเมนต์ แต่มีผู้ท้าธรรมดามายืนแย่งตู้เดียวกันพอดี */
   if(ok)reschedule();
   if(ok){state.tourInvite=id;state.tourInviteUntil=Date.now()+TOUR_MAIL_TTL;toast('📨 จดหมายเชิญทัวร์นาเมนต์วิ่งมาแล้ว! เปิดดูที่คอมพิวเตอร์ (สมัครได้ '+Math.round(TOUR_MAIL_TTL/MINUTE)+' นาที)','good');}
   saveGame();
 }
 const prevDecorate=window.decorateInboxCard;
 window.decorateInboxCard=function(card,m){
   if(typeof prevDecorate==='function')prevDecorate(card,m);
   if(!m||typeof m.id!=='string'||!m.id.startsWith('race-tour-'))return;
   const b=element('button','',card);b.className='tbtn';b.style.cssText='display:block;margin-top:10px;font-weight:700';
   const why=state.tour?.mailId===m.id?'สมัครแล้ว ✓'
     :m.id!==state.tourInvite?'หมดเขตสมัครแล้ว'
     :tourOn()||state.active||otherTourOn()?'มีการแข่งค้างอยู่ รอให้จบก่อน'
     :!tank()?'ต้องวางตู้แข่งวิ่งในร้านก่อน'
     :G.coin<TOUR_ENTRY?'ทองไม่พอ (ต้องมี '+TOUR_ENTRY.toLocaleString()+')':'';
   b.textContent=why||'สมัคร '+TOUR_ENTRY.toLocaleString()+' ทอง';b.disabled=!!why;
   b.onclick=e=>{e.preventDefault();e.stopPropagation();if(tourRegister(m.id)){b.textContent='สมัครแล้ว ✓';b.disabled=true;try{computerDialog?.close();}catch(_){}}};
 };
 function tourRegister(mailId){
   if(tourOn()||state.active||otherTourOn()||!tank()||G.coin<TOUR_ENTRY||mailId!==state.tourInvite)return false;
   addCoin(-TOUR_ENTRY);
   if(state.offer){state.offer=null;leave();if(modal)close();}
   const pool=TOUR_NAMES.slice().sort(()=>Math.random()-.5);
   const teams=pool.slice(0,7).map(name=>({name,members:[0,1,2].map(()=>({genes:SlugEngine.randGene(),pace:botPace(),runs:0}))}));
   teams.splice((Math.random()*8)|0,0,{name:'ทีมเรา',player:true,ids:null});
   state.tour={mailId,status:'prep',prepUntil:Date.now()+TOUR_PREP_MS,teams,qf:[null,null,null,null],sf:[null,null],final:null,match:null};
   saveGame();syncHUD();tourPeople=[];
   toast('🏆 สมัครแล้ว! มีเวลา 1 นาที ย้ายทาก 3 ตัวลงตู้แข่งวิ่ง','good');
   renderTourBar();return true;
 }

 /* ---- คนของทีมอื่นทยอยเข้าร้าน ---- */
 function tourSpawn(){
   const tr=state.tour;if(!tourOn())return;
   tourPeople=tourPeople.filter(p=>PEOPLE.includes(p));
   if(tourPeople.length>=7||!peopleOn||tankMode||document.hidden||window.BOOTING||!tank())return;
   const capacity=challengerRoom();if(capacity<1)return;
   const previous=new Set(PEOPLE);
   if(!spawnVisitors(capacity,'race',[{kid:false,gender:Math.random()<.5?'female':'male'}]))return;
   const bots=tr.teams.filter(T=>!T.player),T=bots[tourPeople.length%bots.length];
   for(const p of PEOPLE.filter(q=>!previous.has(q))){
     p.family=null;p.raceChallenger=true;p.raceTour=true;p.wantsBuy=false;p.wantsSell=false;p.tradeDone=true;
     p.carryTank=true;p.carryColor='#267b86';p.carryAccent=slugBaseHex(T.members[0].genes);
     if(typeof makeSlug==='function')p.carrySlug=makeSlug(T.members[0].genes);
     p.bagged=false;p.accessory='none';p.visits=1;p.strolls=0;goal(p);tourPeople.push(p);
   }
 }
 function tourLeave(){
   for(const p of tourPeople){p.raceChallenger=false;p.raceTour=false;p.family=null;p.tradeDone=true;p.visits=0;p.strolls=0;
     p.focus=null;p.route=[];p.routeGoal=null;p.tgt=doorSpot();p.state='leave';p.stuck=0;}
   tourPeople=[];
 }

 /* ---- แถบสถานะหน้าร้าน ---- */
 function renderTourBar(){
   const tr=state.tour,show=tourOn()&&!raceUI&&!modal;
   if(!show){if(tourBar)tourBar.hidden=true;return;}
   if(!tourBar){tourBar=element('div',null,document.body);tourBar.className='tug-tour-bar race-tour-bar';tourBar.setAttribute('role','status');}
   tourBar.hidden=false;tourBar.replaceChildren();
   const t=tank(),n=t?t.slugs.length:0;
   element('b','🏆 ทัวร์นาเมนต์วิ่ง',tourBar);
   if(tr.status==='prep'){
     const left=Math.max(0,Math.ceil((tr.prepUntil-Date.now())/1000));
     tourElement('span','tug-tour-time',left>0?'เริ่มใน '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0'):'ถึงเวลาแล้ว',tourBar);
     tourElement('span',n<3?'is-warn':'','ทากในตู้แข่งวิ่ง '+Math.min(n,3)+'/3'+(n<3?' — ย้ายลงตู้ให้ครบ':''),tourBar);
     const b=element('button','เลือกทีม & เริ่ม',tourBar);b.type='button';b.className='tbtn';b.disabled=n<3;b.onclick=tourPick;
   }else{
     element('span','กำลังแข่งอยู่',tourBar);
     const b=element('button','ไปที่ตู้แข่ง',tourBar);b.type='button';b.className='tbtn';b.onclick=()=>{if(t){enterTank(t);showRaceBracket();}};
   }
 }

 /* ---- หน้าต่างชุดทัวร์นาเมนต์ (Esc/คลิกนอกกรอบปิดไม่ได้ ใช้หน้าตาชุดเดียวกับชักเย่อ) ---- */
 function tourDialog(title,extra=''){
   const d=dialog(title);d.dataset.tour='1';d.classList.add('slug-tug-dialog','tug-ask');if(extra)d.classList.add(...extra.split(' '));
   d.addEventListener('cancel',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
   d.addEventListener('lightdismiss',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
   return d;
 }
 function sub(d,text,chip){const p=tourElement('p','tug-sub',null,d);element('span',text,p);if(chip)tourElement('span','tug-chip',chip,p);return p;}
 function note(host,kind,big,small){const n=tourElement('div','tug-verdict-box is-'+kind,null,host);element('b',big,n);if(small)element('span',small,n);return n;}
 function portrait(host,genes,label){const b=tourElement('div','tug-slot',null,host);const c=element('canvas',null,b);c.width=180;c.height=112;c.setAttribute('aria-hidden','true');try{drawSlugPortrait(c,{genes});}catch(e){}if(label)element('b',label,b);return b;}

 /* ---- เลือกทีม 3 ตัว ---- */
 function tourPick(){
   const tr=state.tour,t=tank();if(!tr||tr.status!=='prep'||!t||modal||raceUI)return;
   const d=tourDialog('เลือกทีมลงทัวร์นาเมนต์วิ่ง');d.querySelector('h2').textContent='🏆 เลือกทีมลงทัวร์นาเมนต์วิ่ง';
   sub(d,'ทีมละ 3 ตัว ใช้ทีมนี้ทั้งทัวร์นาเมนต์','3 ตัว');
   const verdict=tourElement('div','tug-verdict-box',null,d);
   const head=tourElement('div','tug-pick-head',null,d),title=element('h3','',head);
   const grid=tourElement('div','tug-pick',null,d);
   let picked=t.slugs.slice(0,3).map(s=>s.id);
   const actions=tourElement('div','tug-actions',null,d);
   const later=element('button','ไว้ก่อน',actions);later.className='tbtn';later.onclick=()=>{close();renderTourBar();};
   const go=element('button','ยืนยันทีม · เริ่มทัวร์นาเมนต์',actions);go.className='tbtn tug-primary';
   const refresh=()=>{
     picked=picked.filter(id=>t.slugs.some(s=>s.id===id));
     const team=picked.map(id=>t.slugs.find(s=>s.id===id)).map(s=>({genes:foodGenes(s)}));
     title.textContent='เลือกทาก '+team.length+'/3';verdict.replaceChildren();
     if(t.slugs.length<3){verdict.className='tug-verdict-box is-block';element('b','ทากไม่พอ',verdict);element('span','ตู้แข่งวิ่งมีแค่ '+t.slugs.length+' ตัว — ย้ายทากลงตู้ให้ครบ 3 ตัว',verdict);}
     else if(team.length<3){verdict.className='tug-verdict-box is-todo';element('b','เลือกอีก '+(3-team.length)+' ตัว',verdict);}
     else{verdict.className='tug-verdict-box is-easy';element('b','ก้าวเฉลี่ย '+avgStep(team).toFixed(1)+' ซม.',verdict);}
     go.disabled=team.length!==3;
   };
   const draw=()=>SlugHover.cards(grid,{slugs:t.slugs,selected:picked,multi:true,empty:'ยังไม่มีทากในตู้แข่งวิ่ง',
     sub:s=>'ก้าวละ '+stride(foodGenes(s)).step.toFixed(1)+' ซม.',
     onPick:s=>{if(picked.includes(s.id))picked=picked.filter(x=>x!==s.id);else{picked.push(s.id);if(picked.length>3)picked.shift();}refresh();return picked;}});
   go.onclick=()=>{if(picked.length!==3)return;tr.teams[playerIdx(tr)].ids=picked.slice();tr.status='bracket';saveGame();close();renderTourBar();enterTank(t);showRaceBracket();};
   draw();refresh();
 }

 /* ---- การ์ดทีม (ใช้ในหน้าสายแข่ง) ---- */
 function teamCard(host,T,cls,wins){
   const s=tourElement('div','tug-side '+cls,null,host);
   element('h3',(T.player?'ทีมเรา':T.name)+(wins!=null?' · '+wins:''),s);
   const list=tourMembers(T),stat=tourElement('p','tug-power',null,s);
   element('span','ก้าวเฉลี่ย ',stat);element('b',avgStep(list).toFixed(1),stat);element('span',' ซม.',stat);
   const row=tourElement('div','tug-slots',null,s);for(const m of list)portrait(row,m.genes);
 }
 function bracketMini(host,tr,n,me){
   const br=tourElement('div','tug-br',null,host);
   const name=i=>i==null?'—':tr.teams[i].player?'ทีมเรา':tr.teams[i].name;
   const col=(title,pairs,winners,round)=>{const c=tourElement('div','tug-br-col',null,br);element('h4',title,c);
     pairs.forEach(([x,y],k)=>{const box=tourElement('div','tug-br-pair'+(n&&n.round===round&&k===n.slot?' is-next':''),null,c);
       for(const i of [x,y])tourElement('div','tug-br-team'+(i===me?' is-me':'')+(winners[k]!=null?(winners[k]===i?' is-win':' is-out'):''),name(i),box);});};
   col('รอบ 8 ทีม',[[0,1],[2,3],[4,5],[6,7]],tr.qf,0);
   col('รองชนะเลิศ',[[tr.qf[0],tr.qf[1]],[tr.qf[2],tr.qf[3]]],tr.sf,1);
   col('ชิงชนะเลิศ',[[tr.sf[0],tr.sf[1]]],[tr.final],2);
 }

 /* ---- สายแข่ง: เลือกคู่ถัดไป ---- */
 function showRaceBracket(){
   const tr=state.tour;if(!tr||tr.status!=='bracket'||modal||state.active)return;
   const t=tank();if(!t)return;
   if(!tankMode||curTank!==t)enterTank(t);
   if(tr.match){showSeries();return;}
   const n=tourNext(tr);if(!n){showTourResult();return;}
   const me=playerIdx(tr),mine=n.a===me||n.b===me;
   let L=n.a,R=n.b;if(R===me){L=n.b;R=n.a;}
   const d=tourDialog('ทัวร์นาเมนต์วิ่ง','tug-bracket');d.querySelector('h2').textContent='🏆 ทัวร์นาเมนต์วิ่ง';
   sub(d,TOUR_ROUNDS[n.round]+(n.round<2?' · คู่ที่ '+(n.slot+1):''),'ชนะ 2 ใน 3');
   const main=tourElement('div','tug-br-main',null,d),left=tourElement('div','tug-br-left',null,main);
   const vs=tourElement('section','tug-vs',null,left);
   teamCard(vs,tr.teams[L],tr.teams[L].player?'is-me':'is-foe');tourElement('div','tug-vs-mark','VS',vs);teamCard(vs,tr.teams[R],'is-foe');
   note(left,mine?'ok':'todo',mine?'ถึงคิวทีมเรา':'คู่นี้ไม่มีทีมเรา',mine?'เลือกตัวที่จะวิ่งก่อนทุกเที่ยว':'ดูไว้พักนิ้ว/ดูฝีมือคู่แข่ง หรือข้ามไปก็ได้');
   bracketMini(main,tr,n,me);
   const actions=tourElement('div','tug-actions',null,left);
   const pause=element('button','พักไว้ก่อน',actions);pause.className='tbtn tug-quiet';pause.onclick=()=>{close();exitTank();renderTourBar();};
   const begin=()=>{tr.match={round:n.round,slot:n.slot,L,R,wins:[0,0],heat:0};saveGame();close();showSeries();};
   if(mine){const go=element('button','เริ่มคู่นี้',actions);go.className='tbtn tug-primary';go.onclick=begin;}
   else{
     const skip=element('button','⏭ ข้ามคู่นี้',actions);skip.className='tbtn';
     skip.onclick=()=>{tr.match={round:n.round,slot:n.slot,L,R,wins:[0,0],heat:0};while(tr.match){simulateSeriesHeat();}close();showRaceBracket();};
     const watch=element('button','ดูการแข่ง',actions);watch.className='tbtn tug-primary';watch.onclick=begin;
   }
 }
 /* ตัวที่บอทส่งลงเที่ยวนี้ = ตัวที่วิ่งน้อยที่สุดในทัวร์นาเมนต์ (เท่ากันเลือกตามลำดับ) */
 function botRunner(T){let best=0;T.members.forEach((m,i)=>{if((m.runs|0)<(T.members[best].runs|0))best=i;});return best;}
 function entrantOf(T,member){
   if(T.player){const s=member;return {name:slugNick(s),genes:{...foodGenes(s)},id:s.id,...stride(foodGenes(s)),head:START,finished:null,next:0};}
   const m=T.members[member],g=botGenes(m);return {name:T.name,genes:g,pace:m.pace,member,...stride(g),head:START,finished:null,next:1/m.pace};
 }
 function simulateSeriesHeat(){
   const tr=state.tour,mt=tr.match,A=tr.teams[mt.L],B=tr.teams[mt.R];
   const ea=entrantOf(A,botRunner(A)),eb=entrantOf(B,botRunner(B));
   finishHeat(simulateHeat(ea,eb),ea,eb);
 }
 function finishHeat(w,ea,eb){
   const tr=state.tour,mt=tr.match;
   for(const [T,e] of [[tr.teams[mt.L],ea],[tr.teams[mt.R],eb]]){
     if(T.player)applyFatigue(tank()?.slugs.find(s=>s.id===e.id));
     else if(e.member!=null)T.members[e.member].runs=(T.members[e.member].runs|0)+1;
   }
   mt.wins[w]++;mt.heat++;mt.last={winner:w,names:[ea.name,eb.name]};
   if(mt.wins[w]>=2)recordTour(mt.round,mt.slot,w===0?mt.L:mt.R);else saveGame();
 }

 /* ---- ก่อนแต่ละเที่ยว: เราเลือกตัววิ่ง / คู่บอทดูหรือข้าม ---- */
 function showSeries(){
   const tr=state.tour,mt=tr?.match;if(!mt||modal||state.active)return;
   const t=tank();if(!t)return;
   const A=tr.teams[mt.L],B=tr.teams[mt.R],mine=A.player;
   const d=tourDialog('ทัวร์นาเมนต์วิ่ง','tug-bracket race-series');d.querySelector('h2').textContent='🏁 เที่ยวที่ '+(mt.heat+1);
   sub(d,(A.player?'ทีมเรา':A.name)+' '+mt.wins[0]+' – '+mt.wins[1]+' '+B.name,TOUR_ROUNDS[mt.round]);
   if(mt.last)note(d,mt.last.winner===0&&mine?'easy':mt.last.winner===1&&mine?'hard':'todo','เที่ยวที่แล้ว: '+mt.last.names[mt.last.winner]+' ชนะ',null);
   const foeIdx=botRunner(B),foe=entrantOf(B,foeIdx);
   const vs=tourElement('section','tug-vs',null,d);
   const leftSide=tourElement('div','tug-side is-me',null,vs);element('h3',mine?'ตัววิ่งของเรา':A.name,leftSide);
   const leftStat=tourElement('p','tug-power',null,leftSide),leftRow=tourElement('div','tug-slots',null,leftSide);
   tourElement('div','tug-vs-mark','VS',vs);
   const rightSide=tourElement('div','tug-side is-foe',null,vs);element('h3',B.name,rightSide);
   const rs=tourElement('p','tug-power',null,rightSide);element('span','ก้าวละ ',rs);element('b',foe.step.toFixed(1),rs);element('span',' ซม. · วิ่งมาแล้ว '+(B.members[foeIdx].runs|0),rs);
   portrait(tourElement('div','tug-slots',null,rightSide),foe.genes);
   const actions=tourElement('div','tug-actions',null,d);
   if(mine){
     const verdict=tourElement('div','tug-verdict-box',null,d);d.insertBefore(verdict,actions);
     const head=tourElement('div','tug-pick-head',null,d);d.insertBefore(head,actions);element('h3','เลือกตัวที่จะวิ่งเที่ยวนี้',head);
     const grid=tourElement('div','tug-pick',null,d);d.insertBefore(grid,actions);
     const team=(A.ids||[]).map(id=>t.slugs.find(s=>s.id===id)).filter(Boolean);
     let picked=team.slice().sort((x,y)=>stride(foodGenes(y)).step-stride(foodGenes(x)).step)[0]?.id||null;
     const fatigue=s=>(s.foodBuffs||[]).filter(b=>b.type==='raceFatigue'&&b.until>Date.now()).length;
     const refresh=()=>{
       const s=team.find(x=>x.id===picked);leftStat.replaceChildren();leftRow.replaceChildren();verdict.replaceChildren();
       if(!s){verdict.className='tug-verdict-box is-block';element('b','ทีมเราหายจากตู้',verdict);element('span','ย้ายทากในทีมกลับลงตู้แข่งวิ่ง',verdict);go.disabled=true;return;}
       const e=entrantOf(A,s);
       element('span','ก้าวละ ',leftStat);element('b',e.step.toFixed(1),leftStat);element('span',' ซม.'+(fatigue(s)?' · เหนื่อย −'+fatigue(s)*FATIGUE_VIGOR:''),leftStat);
       portrait(leftRow,e.genes);
       const need=foe.step*foe.pace/e.step,kind=need<=7?'easy':need<=11?'ok':'hard';
       verdict.className='tug-verdict-box is-'+kind;element('b','ต้องกด '+need.toFixed(1)+' ครั้ง/วิ',verdict);element('span',kind==='easy'?'สบาย':kind==='ok'?'พอไหว':'หนักมาก',verdict);
       go.disabled=false;
     };
     const pause=element('button','พักไว้ก่อน',actions);pause.className='tbtn tug-quiet';pause.onclick=()=>{close();exitTank();renderTourBar();};
     var go=element('button','เริ่มเที่ยวนี้',actions);go.className='tbtn tug-primary';
     go.onclick=()=>{const s=team.find(x=>x.id===picked);if(!s)return;startHeat(entrantOf(A,s),foe,false);};
     SlugHover.cards(grid,{slugs:team,selected:picked,sub:s=>'ก้าวละ '+stride(foodGenes(s)).step.toFixed(1)+' ซม.'+(fatigue(s)?' · เหนื่อย':''),onPick:s=>{picked=s.id;refresh();}});
     refresh();
   }else{
     const la=botRunner(A),ea=entrantOf(A,la);
     const ls=leftStat;element('span','ก้าวละ ',ls);element('b',ea.step.toFixed(1),ls);element('span',' ซม. · วิ่งมาแล้ว '+(A.members[la].runs|0),ls);portrait(leftRow,ea.genes);
     const all=element('button','⏭ ข้ามทั้งคู่',actions);all.className='tbtn tug-quiet';
     all.onclick=()=>{while(tr.match)simulateSeriesHeat();close();showRaceBracket();};
     const skip=element('button','⏭ ข้ามเที่ยวนี้',actions);skip.className='tbtn';
     skip.onclick=()=>{simulateSeriesHeat();close();showRaceBracket();};
     const watch=element('button','ดูเที่ยวนี้',actions);watch.className='tbtn tug-primary';watch.onclick=()=>startHeat(ea,foe,true);
   }
 }
 function startHeat(ea,eb,botOnly){
   const tr=state.tour,mt=tr.match,t=tank();if(!mt||!t)return;
   state.active={tankId:t.id,wager:0,elapsed:0,countdown:3,lastKey:null,settled:false,rank:0,botOnly,
     tour:{round:mt.round,slot:mt.slot,heat:mt.heat},entrants:[ea,eb]};
   t.slugs.filter(x=>x.id!==ea.id).forEach(x=>{x.fy=Math.max(8+slugCm(x.genes)/CM_PER_CELL*.55,x.fy);x.wall=null;x.climbZ=0;});
   saveGame();close();openRace();
 }
 function tourHeatDone(){
   const a=state.active,tr=state.tour;if(!a?.tour||!tr?.match)return;
   const [ea,eb]=a.entrants,w=(eb.finished??Infinity)<(ea.finished??Infinity)?1:0;
   state.active=null;close();
   finishHeat(w,ea,eb);
   showRaceBracket();
 }
 function showTourResult(){
   const tr=state.tour;if(!tr||modal)return;
   const me=playerIdx(tr),place=tourPlace(tr,me),prize=TOUR_PRIZE[place]||0;
   if(!tr.paid){tr.paid=true;tr.prize=prize;addCoin(prize);if(place===1)window.questTourWin?.();saveGame();syncHUD();}   // tr.paid กันนับซ้ำให้อยู่แล้ว
   const d=tourDialog('ผลทัวร์นาเมนต์วิ่ง','tug-tour-result');
   d.querySelector('h2').textContent=place===1?'🏆 แชมป์ทัวร์นาเมนต์วิ่ง!':'🏁 จบทัวร์นาเมนต์วิ่ง';
   tourElement('p','tug-tour-place',place===1?'อันดับ 1':place===2?'อันดับ 2':place===3?'อันดับ 3–4':'อันดับ 5–8',d);
   tourElement('p','tug-sub',(tr.prize>0?'รางวัล +'+tr.prize.toLocaleString()+' ทอง':'ไม่ได้รางวัล')+(place===1?'':' · แชมป์คือ '+tr.teams[tr.final].name),d);
   const actions=tourElement('div','tug-actions',null,d);
   const done=element('button','กลับร้าน',actions);done.className='tbtn tug-primary';
   /* จบทัวร์นาเมนต์แล้ว จดหมายฉบับนั้นหมดประโยชน์ = ลบทิ้งด้วย */
   done.onclick=()=>{dropTourMail(tr.mailId);if(state.tourInvite===tr.mailId){state.tourInvite=null;state.tourInviteUntil=0;}
     state.tour=null;tourLeave();close();exitTank();saveGame();renderTourBar();};
   if(place===1)resultFireworks();
 }
 function tourTick(){
   const tr=state.tour;
   expireTourMail();
   if(!tr){tourMail();renderTourBar();return;}
   if(!tank()){renderTourBar();return;}
   tourSpawn();
   if(tr.status==='prep'&&!tr.autoPick&&Date.now()>=tr.prepUntil&&!modal&&!raceUI&&!state.active&&!(tankMode&&curTank!==tank())){tr.autoPick=true;tourPick();}
   else if(tr.status==='bracket'&&!state.active&&!modal&&tankMode&&curTank===tank())showRaceBracket();
   renderTourBar();
 }

 window.addEventListener('keydown',e=>{
   if(!raceUI||modal?.open)return;
   if(state.active&&!state.active.botOnly){e.stopImmediatePropagation();if(['KeyA','KeyD','KeyJ','KeyK','Space','Escape'].includes(e.code))e.preventDefault();if(e.repeat)return;
     if(e.code==='KeyA'||e.code==='KeyD')press(e.code==='KeyA'?'a':'d');
     else if(e.code==='KeyJ')usePower(0,'block');
     else if(e.code==='KeyK')usePower(0,'boost');}
 },true);
 document.addEventListener('visibilitychange',()=>{lastFrame=0;if(document.hidden)for(const a of burstAnimations)a.cancel();saveGame();});
 /* ผู้ท้าแข่งยืนรออยู่ที่ตู้แข่ง = ลูกค้าปกติไม่มาดูตู้นี้ (people.js eventReservedTank) */
 window.SlugRace={reserved:o=>!!o?.def?.race&&(tourOn()||visitors.some(p=>PEOPLE.includes(p))),tour:()=>state.tour,purchased,goal,drawTrack,drawChallengers,isOpen:()=>!!modal?.open,isRacing,normalSlugs,stepNormal,updateTankFrame,racingItems,drawRunner,stride};
 // Settled races retain their receipt; unfinished races resume, never reroll.
 if(state.active?.entrants?.length===3||(state.active?.tour&&state.active?.entrants?.length===2)){
   state.active.entrants.forEach(r=>{if(r.finished===null&&state.active.settled)r.finished=Infinity;});
 }else state.active=null;
 if(owned())purchased();
 // Keep gameplay independent of the hidden shop renderer, at a bounded 20 Hz.
 setInterval(()=>{
   if((!modal?.open&&!raceUI&&!document.hidden)||window.BOOTING||!engineReady)return;
   stepPeople();
   for(const t of G.objs){
     if(t.type!=='tank'||!t.slugs.length)continue;
     if(raceUI&&t.id===state.active?.tankId){if(modal?.open||document.hidden)stepNormal(normalSlugs(t),.05);}
     else stepTankSlugs(t.slugs,t.def.w,t.def.h,.05,true,t.decor,t.def);
   }
 },50);
 resumeReady=true;setInterval(tick,1000);
})();
