/* ชักเย่อทากทะเล — ตู้ 100×50 ซม. หนึ่งตู้ต่อร้าน · MVP: 1v1 แมตช์เดียว
 *
 * โครงเดียวกับ slug-race.js (ลูกค้ามาท้า → โมดอล → เข้าตู้เต็มจอ → ผลแพ้ชนะ)
 * ต่างกันที่การวาดตัวแข่ง: ที่นี่วาดเองด้วย drawSlugAt() ซึ่งลอง Slug3D ก่อนแล้วตกไป 2D
 * จึงคุมตำแหน่ง/ทิศ/ท่าได้ตรง ๆ ตามแรงดึง และได้โมเดล 3D ทั้งสองฝั่งเหมือนกัน
 * (slug-race.js ใช้สไปรต์ 2D ล้วน เพราะตอนนั้นยังไม่มีทาง 3D)
 *
 * กติกา: กด F / K สลับกันให้มีแต้มนำอีกฝั่ง WIN แต้ม (นิ้วชี้สองมือวางบนปุ่มนูน F กับ K ได้พอดี)
 *   แรงดึง  = ความสมบูรณ์ + ขนาดตัว + จำนวนหงอน   → 1..4 แต้มต่อการกด
 *   แรงต้าน = ขนาดหงอน + ขนาดตัว (ของอีกฝั่ง)      → หักได้ไม่เกิน 3
 *   ครบ CHARGE_AT แต้มที่ตัวเองสร้าง = ชาร์จ 1 ลูก · Space (คอม) / แตะปุ่มท่าไม้ตาย (มือถือ)
 *   → หยุดโลก 1 วิ ทากจาม จอสั่น ดึงเพิ่ม 10-15 แต้ม · บอทก็ใช้เป็น
 *
 * ⚠️ ต้องสลับ A↔D จริง ๆ กดปุ่มเดิมซ้ำไม่นับ — จงใจให้เหมือนตู้แข่งวิ่ง
 *    (กดปุ่มเดียวรัว ๆ เพดานอยู่ที่ความเร็วนิ้วปุ่มเดียว สองปุ่มสลับกันได้เร็วกว่าและไม่เมื่อย)
 */
(()=>{
 'use strict';
 const MINUTE=60000;
 /* WIN/CHARGE_AT เป็นสองปุ่มจูนจังหวะเกม ปรับได้อิสระจากสูตรแต้ม
    ที่ค่าแต้มใหม่ (กดละ 2-5) สองฝั่งยิงกันราว 35 แต้ม/วิ ดังนั้น
      เป้า 30  = จบใน 4 วิ (64% ของแมตช์จบไม่ถึง 5 วิ — สั้นกว่านับถอยหลังอีก)
      เป้า 150 = จบราว 25 วิ ไม่มีแมตช์ที่จบก่อน 5 วิเลย  ← เลือกอันนี้
    ชาร์จก็ต้องขยับตาม: ถ้าคงไว้ที่ 100 จะครบทุก ~3 วิ = ท่าไม้ตายกลายเป็นท่าปกติ (10 ครั้ง/แมตช์)
    250 แต้ม ทำให้ได้ราว 3-4 ครั้งต่อแมตช์ ซึ่งยังรู้สึกเป็นท่าพิเศษอยู่ */
 const WIN=150, CHARGE_AT=250, ENTRY=300, PRIZE=500;
 /* จุดยืนสองฝั่ง (ช่อง fx) · ระยะลากสูงสุด
    ⚠️ เดิม 4↔16 (12 ช่อง = 60 ซม.) เชือกยาวข้ามตู้ทั้งใบ กล้องเลยต้องถอยจนตัวทากเล็กนิดเดียว
       ย่อเหลือ 6 ช่อง (30 ซม.) แล้วให้กล้องซูมตามช่วงแข่งแทนความกว้างตู้ (ดู camera())
       ผลคือเห็นหน้าทาก เห็นเชือกตึง และรู้ทันทีว่าฝั่งไหนกำลังโดนลาก */
 const HOME=7, AWAY=13, SHIFT=1.8;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const g01=(g,k)=>clamp(Number.isFinite(g[k])?g[k]:50,0,100)/100;
 const gill01=g=>clamp((gillCount(g)-2)/7,0,1);      // nGill ∈ {2,3,5,6,8,9}

 /* แรงดึง  = กดได้ 2 แต้มแน่ ๆ ทุกครั้ง + ยีนอีก 3 ตัว ตัวละไม่เกิน 1 (ยีนเต็ม 100 = ได้เต็ม 1)
              ความสมบูรณ์ · ขนาดตัว · จำนวนหงอน                                → 2..5
    แรงต้าน = ขนาดตัว + ความยาวตัว + ขนาดหงอน ของอีกฝั่ง ตัวละไม่เกิน 1        → 0..3
    พื้น 2 แต้มห้ามโดนแรงต้านกินเด็ดขาด — กดแล้วต้องขยับเสมอ */
 const pull  =g=>2+g01(g,'vigor')+g01(g,'girth')+gill01(g);
 const resist=g=>g01(g,'girth')+g01(g,'len')+g01(g,'gillLen');
 const net=(a,b)=>Math.max(2,pull(a)-resist(b));
 /* ---- โหมดทีม 1 / 2 / 3 ตัวต่อฝั่ง ----
    แต้มต่อการกดใช้ "ค่าเฉลี่ยของทีม" (แรงดึงเฉลี่ยทีมเรา − แรงต้านเฉลี่ยทีมเขา) ไม่ใช่ผลรวม
    สองฝั่งมีจำนวนเท่ากันเสมอ ผลรวมจะแค่คูณแต้มทั้งคู่ขึ้นเท่ากัน = แมตช์จบไวขึ้นเฉย ๆ ต้องจูน WIN ใหม่ทุกโหมด
    ค่าเฉลี่ยทำให้จังหวะแมตช์เท่ากันทุกโหมด และทากตัวอ่อนในทีมดึงค่าทั้งทีมลงจริง (ต้องคัดทั้งทีม)
    ค่าสมัคร/รางวัลคูณตามจำนวนตัว */
 const MODES=[1,2,3];
 /* จำนวนตัวต่อฝั่งถูกสุ่มมากับคำท้า — ผู้เล่นเลือกเองไม่ได้ (ผู้เล่นขอ 2026-09-17)
    โอกาส: 1 ต่อ 1 = 50% · 2 ต่อ 2 = 30% · 3 ต่อ 3 = 20%  ← ปรับตัวเลขตรงนี้ได้เลย รวมกันไม่จำเป็นต้องได้ 1 */
 const MODE_CHANCE=[[1,50],[2,30],[3,20]];
 function rollSize(){
   let r=Math.random()*MODE_CHANCE.reduce((n,[,w])=>n+w,0);
   for(const [n,w] of MODE_CHANCE){if((r-=w)<0)return n;}
   return 1;
 }
 /* คำท้าจากเซฟเก่ายังไม่มี size — สุ่มให้ครั้งเดียวแล้วเก็บไว้ในคำท้า (เปิดโมดอลซ้ำต้องได้เลขเดิม ไม่สุ่มใหม่ทุกครั้ง) */
 function offerSize(r){if(!MODES.includes(r.size)){r.size=rollSize();saveGame();}return r.size;}
 const teamOf=o=>o.team&&o.team.length?o.team:[{id:o.id,genes:o.genes}];   // แมตช์จากเซฟเก่าไม่มี team = 1 ตัว
 const avg=(list,f)=>list.reduce((n,m)=>n+f(m.genes),0)/list.length;
 const teamNet=(mine,theirs)=>Math.max(2,avg(mine,pull)-avg(theirs,resist));
 /* ระยะห่างสมาชิกทีมบนเชือก (ช่อง) — ตามความยาวตัวจริงที่เห็นในตู้ ตัวถัดไปยืนต่อท้ายพอดีไม่ซ้อนกัน */
 /* ×1.6 = ความยาวที่ "เห็นบนจอ" รวมหงอน/หนวด (วัดจากภาพจริง: ตัว girth 100 ยาว ~2.3 ช่อง ขณะที่ slugCm คิดได้ 1.4)
    ถ้าใช้ slugCm ตรง ๆ ตัวใหญ่ที่ยืนติดกันจะซ้อนทับกัน และตัวท้ายแถวล้นขอบกล้อง */
 const bodyCells=g=>TANK_SLUG_VIEW_SCALE*slugCm(g)/CM_PER_CELL*1.6;
 const ROPE_LIFT=.09;   // ความสูงจุดผูกเชือก = ความยาวตัวที่เห็น × ค่านี้ (ช่อง) ≈ กลางความหนาลำตัว (ดู drawPart rope)
 const backCache=new WeakMap();                     // คิดครั้งเดียวต่อทีม (ยีนในแมตช์ถูกล็อกไว้แล้ว) ไม่สร้างอาร์เรย์ใหม่ทุกเฟรม
 function teamBack(team){
   let out=backCache.get(team);if(out)return out;
   out=[0];for(let i=1;i<team.length;i++)out.push(out[i-1]+(bodyCells(team[i-1].genes)+bodyCells(team[i].genes))/2+.15);
   /* ทีมตัวใหญ่ 3 ตัวยาวเกือบ 5 ช่อง — ฝั่งเขาถูกลากสุดที่ AWAY+SHIFT แล้วตัวท้ายจะทะลุกระจกขวา (ตู้กว้าง 20 ช่อง)
      บีบระยะให้พอดีช่องว่างฝั่งที่แคบกว่า ยอมให้ตัวเกยกันนิดหน่อย ดีกว่าหางโผล่นอกตู้ */
   const n=out.length-1,w=(tank()||{def:{w:20}}).def.w;
   const room=Math.min(HOME-SHIFT*.55,w-(AWAY+SHIFT))-bodyCells(team[n].genes)/2-.2;
   if(n&&out[n]>room){const k=Math.max(.4,room/out[n]);for(let i=1;i<=n;i++)out[i]*=k;}
   backCache.set(team,out);return out;
 }

 /* ความเร็วกดบอท 6-14 ครั้ง/วิ สุ่มตรง ๆ ไม่ปรับตามผู้เล่น
    เคยลองให้บอทปรับความเร็วตามสเตตัสทากเรา — มันลบล้างความสำคัญของยีนทิ้งหมด
    (ทากเก่งแค่ไหนบอทก็เร่งตาม สุดท้ายวัดกันที่ความเร็วนิ้วอย่างเดียว) ซึ่งผิดเจตนา
    ตอนนี้ยีนคือตัวตัดสินจริง ๆ ถ้าทากสู้ไม่ไหวให้ปฏิเสธคำท้าแล้วไปปรับปรุงทากมาใหม่ */
 const REF_CPS=10;                        // กดสองนิ้วรัว ๆ ได้ราว 8-12 ครั้ง/วิ
 const botCps=()=>6+Math.random()*8;
 /* ---- เวลาจำกัด: หมดเวลาแล้วใครนำอยู่คนนั้นชนะ ----
    ⛔ ห้ามเอา "ตัวคูณแต้มตามเวลา" กลับมาอีก (ของเดิม: หลัง 40 วิ คูณไต่ถึง 4 เท่า)
       มันคูณเฉพาะ "แต้มที่กำลังจะได้" แต่ "แต้มนำที่สะสมไว้แล้ว" ไม่ถูกคูณ
       → ใครนำมาก่อนยิ่งเสียเปรียบ เพราะฝั่งตามกดทีหลังได้แต้มแพงกว่าหลายเท่า
       ของจริงที่เจอ: นำอยู่ 140 แล้วโดนลากกลับไป −140 ภายในไม่กี่วินาที
    เวลาจำกัดแก้ปัญหา "คู่สูสียื้อไม่จบ" ได้เหมือนกัน แต่ไม่ไปยุ่งกับค่าของแต้มที่หามาแล้ว */
 const LIMIT=90;                          // วินาทีต่อแมตช์ (ไม่นับช่วงนับถอยหลังและช่วงฟรีซท่าไม้ตาย)
 const CUT_MS=1000;                       // ความยาวคัทซีนท่าไม้ตาย = ช่วงหยุดโลกพอดี (จอสั่น+ทากจาม)
 const timeLeft=a=>Math.max(0,LIMIT-(a.elapsed||0));

 const names=['เกลียวคลื่น','สมอเหล็ก','หอยงวง','เงือกน้อย','พายุใต้','ตะขอทอง','ปะการังดำ','เชือกเพชร'];
 const tank=()=>G.objs.find(o=>o.def.tug&&o!==moving);
 const owned=()=>[...G.objs,...G.shelter].some(o=>o.def.tug);
 const tankOf=()=>state.active&&G.objs.find(o=>o.id===state.active.tankId);
 const teamIds=()=>new Set(teamOf(state.active.me).map(m=>m.id));
 /* ทากทีมเราตามลำดับยืน (ตัวแรก = หัวแถวติดกลางเชือก) · ตัวไหนหายไปจากตู้ได้ undefined */
 const myTeam=()=>{if(state.active?.me?.bot)return meSprites;const t=tankOf();return t?teamOf(state.active.me).map(m=>t.slugs.find(s=>s.id===m.id)):[];};

 let state=G.tug;
 if(!state||typeof state!=='object'||!Number.isFinite(state.nextAt)||state.nextAt<0)
   state={purchased:false,nextAt:0,offer:null,active:null};
 G.tug=state;

 let visitors=[],modal=null,tugUI=null,foeSprites=[],meSprites=[],anims=[];
 let lastFrame=0,lastSave=0,cameraKey='',offerDeadline=0,resumeReady=false;
 let bar=null,marker=null,statusNode=null,scoreNode=null,chargeNode=null;
 let keyBtns={f:null,k:null},lastKey=null,controlsNode=null,bigCount=null,bigCountShown='';
 let cutNode=null,cutCanvas=null,cutUntil=0,cutSide=null,cutGenes=null;

 /* ---------- ไฟชาร์จ: ระบบอนุภาคแบบเอฟเฟกต์ในเกม ----------
    เดิมปั้นเปลวด้วยรูปทรง CSS (หยดน้ำหมุน + ไล่สี) ดูเป็นสติกเกอร์แปะ ไม่เหมือนไฟ
    ตอนนี้ใช้อนุภาคแบบที่เกมทำกันจริง:
      · เม็ดแสงลอยขึ้นจากโคน ไล่สีตามอายุ ขาวเหลือง → ส้ม → แดง → มอด (color over lifetime)
      · เบลนด์แบบบวกแสง (lighter) ตรงที่เม็ดซ้อนกันสว่างขึ้นเอง = ใจกลางไฟร้อนกว่าขอบ
      · ถูกดึงเข้าแกนขณะลอยขึ้น เม็ดจึงบีบรวมเป็น "ลิ้นไฟ" ไม่พุ่งกระจายแบบน้ำพุ
      · มีสะเก็ดไฟเม็ดเล็กพุ่งสูงกว่าเปลวและกะพริบ
    ความถี่/ขนาด/ความสูงของเปลวแปรตาม fire.level (0→1 = พลังชาร์จ) · 0 = ไม่เกิดใหม่ ของเดิมมอดลงเอง
    ต้นทุน: สไปรต์เม็ดแสงวาดครั้งเดียวเก็บไว้ (ไม่สร้าง gradient ทุกเม็ดทุกเฟรม) · พูลอนุภาคขนาดตายตัว ไม่มีขยะ GC
    ไม่มีลูปแยก — ขับจาก updateTankFrame() ซึ่งหยุดเองตอนแท็บซ่อน/ออกจากตู้ (AGENTS.md) */
 const FIRE_MAX=300;
 const FIRE_STAGES=[[255,238,170],[255,216,112],[255,148,42],[226,72,18],[128,26,8]];
 
 let fire=null,fireSprites=null;
 function fireSpriteSet(){
   if(fireSprites)return fireSprites;
   fireSprites=FIRE_STAGES.map(([r,g,b])=>{
     const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
     const gr=x.createRadialGradient(32,32,0,32,32,32);
     gr.addColorStop(0,'rgba('+r+','+g+','+b+',1)');gr.addColorStop(.38,'rgba('+r+','+g+','+b+',.5)');gr.addColorStop(1,'rgba('+r+','+g+','+b+',0)');
     x.fillStyle=gr;x.fillRect(0,0,64,64);return c;
   });
   return fireSprites;
 }
 function makeFire(cv){
   const parts=[];for(let i=0;i<FIRE_MAX;i++)parts.push({life:0,max:1,x:0,y:0,vx:0,vy:0,size:0,ember:false,seed:0,cx:0});
   return {cv,ctx:cv.getContext('2d'),parts,level:0,target:0,emit:[],w:0,h:0,key:'',acc:0,t:0};
 }
 /* วัดขนาดแคนวาส + จุดกำเนิดไฟใหม่เฉพาะตอนจอเปลี่ยนขนาด — จุดกำเนิดวัดจากตำแหน่งปุ่มจริง ไม่เดาจากเลข CSS */
 function fireLayout(f){
   /* ⚠️ เช็กขนาดหน้าต่างก่อน (ไม่แตะ layout) — เดิมเรียก getBoundingClientRect ทุกเฟรม
      ซึ่งเฟรมเดียวกัน hud() เพิ่งแก้ข้อความ/ตำแหน่งหมุด → บังคับเบราว์เซอร์คำนวณ layout ใหม่ทุกเฟรม (วัดได้ ~54ms/วิ) */
   const dpr=Math.min(devicePixelRatio||1,2),win=innerWidth+'x'+innerHeight+'@'+dpr;
   if(win===f.win&&f.key)return;
   f.win=win;
   const box=f.cv.getBoundingClientRect();
   const key=Math.round(box.width)+'x'+Math.round(box.height)+'@'+dpr;
   if(key===f.key)return;
   f.key=key;f.w=box.width;f.h=box.height;
   f.cv.width=Math.max(1,Math.round(box.width*dpr));f.cv.height=Math.max(1,Math.round(box.height*dpr));
   f.ctx.setTransform(dpr,0,0,dpr,0,0);
   /* โคนไฟอยู่ "ใต้" ปุ่ม (ในช่องว่างที่ยกแถวปุ่มขึ้นไว้) ไฟจึงเห็นตั้งแต่ยังเล็ก แล้วลุกขึ้นหลังปุ่มจนเลียพ้นขอบบน */
   f.emit=[keyBtns.f,keyBtns.k].filter(Boolean).map(b=>{const r=b.getBoundingClientRect();
     return {x:r.left+r.width/2-box.left, y:Math.min(box.height-3,r.bottom-box.top+18), w:r.width};});
 }
 function spawnFire(f,e,ember){
   const p=f.parts.find(q=>q.life<=0);if(!p)return;
   const L=f.level;
   p.ember=ember;p.seed=Math.random()*6.283;p.cx=e.x;
   /* เกิดตลอดแนวกว้างของปุ่ม (กว้างกว่าปุ่มนิดนึง) → ไฟลุกท่วมสองข้างปุ่มแล้วไปบรรจบเป็นยอดเดียวเหนือปุ่ม
      ⚠️ ปุ่มทึบแสง: เปลวต้องสูงพ้นปุ่ม (~120px จากโคน) ไม่งั้นเห็นแค่เศษไฟแลบใต้ปุ่ม — เคยพลาดมาแล้ว */
   p.x=e.x+(Math.random()-.5)*e.w*(ember?.8:1.25)*(.55+.45*L);
   p.y=e.y-Math.random()*8;
   if(ember){p.vx=(Math.random()-.5)*60;p.vy=-(190+Math.random()*150)*(.55+.55*L);p.max=.8+Math.random()*.8;p.size=1.5+Math.random()*2;}
   else{p.vx=(Math.random()-.5)*24;p.vy=-(90+Math.random()*80)*(.45+.75*L);p.max=(.6+Math.random()*.45)*(.6+.55*L);p.size=(30+Math.random()*24)*(.5+.6*L);}
   p.life=p.max;
 }
 function stepFire(f,dt){
   fireLayout(f);
   const ctx=f.ctx,L=f.level,sp=fireSpriteSet();f.t+=dt;
   ctx.clearRect(0,0,f.w,f.h);
   ctx.globalCompositeOperation='lighter';
   /* ความถี่เกิด ~0 ตอนไม่มีพลัง → ~80 เม็ด/วิ/กอง ตอนใกล้เต็ม · เต็มแล้วเร่งเพิ่มให้ดู "พร้อมปล่อยท่า" */
   if(L>.02){
     f.acc+=(8+72*L)*(L>=1?1.4:1)*dt;
     while(f.acc>=1){f.acc-=1;for(const e of f.emit)spawnFire(f,e,Math.random()<.04+.09*L);}
   }else f.acc=0;
   /* แสงเรืองที่โคน — ปุ่มด้านบนดูโดนไฟส่องจากข้างล่าง */
   /* วางให้ขอบล่างของแสงอยู่ที่โคนไฟพอดี — ถ้าล้นขอบแคนวาส จะโดนตัดเป็นเส้นตรงแข็ง ๆ ใต้ปุ่ม */
   if(L>0)for(const e of f.emit){ctx.globalAlpha=.2+.4*L;const gw=e.w*(1.3+.6*L),gh=Math.min(gw*.9,f.h);
     ctx.drawImage(sp[2],e.x-gw/2,f.h-gh,gw,gh);}
   for(const p of f.parts){
     if(p.life<=0)continue;
     p.life-=dt;if(p.life<=0)continue;
     const age=1-p.life/p.max;                                    // 0 เพิ่งเกิด → 1 กำลังมอด
     if(p.ember)p.vx+=Math.sin(f.t*9+p.seed)*70*dt;
     else{
       p.vx+=(p.cx-p.x)*2.6*dt;                                   // ดึงเข้าแกน = โคนกว้าง ปลายบีบเป็นลิ้นไฟ
       p.vx+=Math.sin(f.t*7+p.seed)*26*dt;                        // ไหวซ้าย-ขวา
       p.vy-=(70+90*L)*dt;                                        // ลอยตัว: ยิ่งสูงยิ่งเร่ง ปลายเปลวจึงยืดเรียว
     }
     p.x+=p.vx*dt;p.y+=p.vy*dt;
     if(p.ember){
       ctx.globalAlpha=Math.max(0,(1-age)*(.55+.45*Math.sin(f.t*31+p.seed*5)));
       ctx.drawImage(sp[1],p.x-p.size*2,p.y-p.size*2,p.size*4,p.size*4);
       continue;
     }
     const s=p.size*(1-age*.62);                                  // หดตามอายุ = ปลายไฟแหลม
     ctx.globalAlpha=Math.min(1,age*9)*Math.sqrt(1-age)*.9;       // โผล่เร็ว สว่างค้างนาน แล้วค่อยมอด
     /* age^1.4: อยู่ช่วงเหลือง-ส้มนานขึ้น แดงแค่ปลาย — แดงเข้มบวกแสงบนน้ำทะเลสีเขียวจะกลายเป็นสีโคลน */
     ctx.drawImage(sp[Math.min(sp.length-1,(Math.pow(age,1.4)*sp.length)|0)],p.x-s/2,p.y-s/2,s,s);
   }
   ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 }

 /* ---------- ลูกค้ามาท้า (ยกแบบมาจาก slug-race.js ทั้งดุ้น ต่างแค่คนเดียวไม่ใช่สองคน) ---------- */
 function purchased(){ if(!state.purchased){state.purchased=true;state.nextAt=Date.now()+5*MINUTE;saveGame();} }
 /* ⚙️ ช่วงเวลาที่คนมาท้าแข่ง — ตอนนี้ตั้งสั้นไว้ 5 นาทีเพื่อเทสต์จังหวะเกมหลาย ๆ รอบ
    จูนเกมเสร็จแล้วค่อยดันกลับเป็นช่วงห่างจริง (ของเดิม 30-50 นาที) */
 function gap(){ return ShopEvents.gap(); }      // 20–45 นาที ใช้ค่าเดียวกันทั้ง 4 ตู้ (config.js)
 function makeOffer(){
   return {rival:{name:names[(Math.random()*names.length)|0],genes:SlugEngine.randGene(),cps:botCps(),size:rollSize()}};
 }
 function leave(){
   for(const p of visitors){p.tugChallenger=false;p.family=null;p.tradeDone=true;p.visits=0;p.strolls=0;
     p.focus=null;p.route=[];p.routeGoal=null;p.tgt=doorSpot();p.state='leave';p.stuck=0;}
   visitors=[];offerDeadline=0;
 }
 function goal(p){
   const t=tank();
   if(!t||!(state.offer||(p.tugTour&&tourOn()))){p.tugChallenger=false;p.tugTour=false;p.visits=0;p.strolls=0;return false;}
   const spot=freeSpot(lookSpots(t),p);
   if(spot){p.focus=t;p.tgt=spot;p.state='walk';p.route=[];p.routeGoal=null;p.stuck=0;return true;}
   p.focus=null;p.tgt=strollSpot(p);p.state='walk';return true;
 }
 function spawn(){
   if(visitors.length||!peopleOn||!tank()||document.hidden||tankMode||window.BOOTING)return;
   if(!ShopEvents.ready())return;                 // ตู้อื่นเพิ่งส่งคำท้ามา รออีก 3 นาที (config.js EVENT_SPACING)
   const capacity=challengerRoom(); if(capacity<1)return;
   const previous=new Set(PEOPLE);
   if(!spawnVisitors(capacity,'tug',[{kid:false,gender:Math.random()<.5?'female':'male'}]))return;
   visitors=PEOPLE.filter(p=>!previous.has(p));ShopEvents.mark();
   if(!state.offer){state.offer=makeOffer();state.nextAt=Date.now()+gap();saveGame();}
   visitors.forEach(p=>{
     p.family=null;p.tugChallenger=true;p.wantsBuy=false;p.wantsSell=false;p.tradeDone=true;
     // carryColor = สีน้ำในตู้ (people.js วาดกระจกหลัง/ผนังข้างด้วยสีนี้) ใส่สีไม้ไม่ได้ ตู้จะกลายเป็นลังไม้
     p.carryTank=true;p.carryColor='#35707a';p.carryAccent=slugBaseHex(state.offer.rival.genes);
     if(typeof makeSlug==='function')p.carrySlug=makeSlug(state.offer.rival.genes);   // ทากคู่แข่งตัวจริงในตู้
     p.bagged=false;p.accessory='none';p.visits=1;p.strolls=0;goal(p);
   });
   offerDeadline=Date.now()+5*MINUTE;
   toast('🪢 มีคนมาท้าชักเย่อ! คลิกคนถือตู้เพื่อรับคำท้า','good');
 }
 /* ⚠️ 2026-09-18 นับเวลานัดหน้า "หลังจบเรื่องนี้" ไม่ใช่ตอนผู้ท้าเข้าร้าน (แบบเดียวกับ slug-race.js) */
 function reschedule(){state.nextAt=Date.now()+gap();}
 function dismiss(){state.offer=null;leave();close();reschedule();saveGame();}
 /* ---------- โหมดซ้อม: คู่ชักเย่อคือทากในตู้ที่ผู้เล่นเลือกเอง ไม่มีค่าสมัคร/รางวัล (slug-practice.js) ---------- */
 function practiceSync(){
   const t=tank();
   if(typeof SlugPractice==='undefined')return;
   SlugPractice.sync('tug',!!t&&tankMode&&curTank===t&&!state.active&&!modal?.open&&!tourOn(),'🪢 ซ้อมชักเย่อ',()=>{
     SlugPractice.pick({tank:t,title:'🪢 ซ้อมชักเย่อ 1 ต่อ 1',need:1,
       noteFor:s=>{const g=geneOfSlug(s);return 'ดึง '+pull(g).toFixed(1)+' · ต้าน '+resist(g).toFixed(1);},
       onStart:(mine,others)=>beginPractice(t,mine,others[0])});
   });
 }
 function beginPractice(t,s,foe){
   const mine=[{id:s.id,genes:{...geneOfSlug(s)}}],foes=[{genes:{...geneOfSlug(foe)}}];
   state.active={tankId:t.id,rope:0,countdown:3,freezeUntil:0,freezeSide:null,settled:false,won:null,practice:true,
     camX:(HOME+AWAY)/2,view:layoutAt(0),elapsed:0,size:1,entry:0,prizePot:0,
     me:{id:mine[0].id,name:slugNick(s),genes:mine[0].genes,team:mine,total:0,used:0,sneezeUntil:0},
     foe:{name:slugNick(foe),genes:foes[0].genes,team:foes,cps:botCps(),total:0,used:0,sneezeUntil:0,nextPressAt:0}};
   saveGame();close();openMatch();
 }
 function tick(){
   if(owned())purchased();
   practiceSync();
   if(!window.BOOTING)tourTick();
   if(state.active){ if(resumeReady&&!modal&&!tugUI&&!window.BOOTING)openMatch(); return; }
   if(tourOn()){ if(state.offer){state.offer=null;leave();saveGame();} return; }   // ทัวร์นาเมนต์อยู่ = ไม่มีคำท้า 1 ต่อ 1
   if(!tank()){ if(state.offer){state.offer=null;leave();if(modal)close();saveGame();} return; }
   if(visitors.length&&!visitors.every(p=>PEOPLE.includes(p)))leave();
   if(offerDeadline&&Date.now()>offerDeadline&&!modal){dismiss();return;}
   if(state.purchased&&Date.now()>=state.nextAt||state.offer)spawn();
 }

 /* ---------- DOM ---------- */
 function element(tag,text,parent){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(parent)parent.append(e);return e;}
 function track(a){anims.push(a);return a;}
 /* ใช้คลาสโมดอลของตู้แข่งซ้ำ — เป็นธีมกลางของเกม ไม่ได้ผูกกับกติกาแข่งวิ่ง */
 function dialog(title,tour=false){
   modal=element('dialog');modal.className='slug-race-dialog slug-tug-dialog';modal.setAttribute('aria-label',title);
   if(tour)modal.dataset.tour='1';
   modal.addEventListener('cancel',e=>{e.preventDefault();if(modal?.dataset.tour)return;if(!state.active)dismiss();});
   /* กดนอกกรอบ (dialog-dismiss.js) ตอนเป็นหน้ารับคำท้า = "ขอไปเตรียมทากก่อน" ไม่ใช่ไล่ผู้ท้ากลับเหมือน Esc
      เผลอกดพลาดแล้วเสียคำท้าไปเลยมันแรงเกิน · หน้าผลแข่ง (state.active) ปล่อยให้ไปทาง cancel → complete() ตามเดิม */
   modal.addEventListener('lightdismiss',e=>{if(modal?.dataset.tour){e.preventDefault();return;}if(!state.active){e.preventDefault();close();}});
   element('h2',title,modal);document.body.append(modal);modal.showModal();return modal;
 }
 function close(){
   for(const a of anims){try{a.cancel();}catch(e){}} anims=[];
   modal?.close();modal?.remove();modal=null;
   tugUI?.remove();tugUI=null;document.body.classList.remove('tug-in-tank');
   tankCv?.classList.remove('tug-shake');
   bar=marker=statusNode=scoreNode=chargeNode=null;fire=null;
   keyBtns={f:null,k:null};lastKey=null;controlsNode=bigCount=null;bigCountShown='';
   cutNode=cutCanvas=null;cutUntil=0;cutSide=null;cutGenes=null;
   foeSprites=[];meSprites=[];lastFrame=0;cameraKey='';
 }

 /* ---------- คำท้า: ป้ายเหนือหัวลูกค้า + คลิก ---------- */
 function drawChallengers(){
   if(!state.offer||!visitors.length)return;
   const n=offerSize(state.offer.rival),font='bold 13px "IBM Plex Sans Thai",sans-serif',label='🪢 ชักเย่อ '+n+' ต่อ '+n+' · คลิกรับคำท้า';
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
     ctx.fillStyle='rgba(38,26,12,.92)';ctx.fill();
     ctx.lineWidth=1.4;ctx.strokeStyle='rgba(231,198,123,'+glow+')';ctx.stroke();
     ctx.fillStyle='#ffe1a0';ctx.fillText(label,x,top+boxH/2+1);
     p._tugHit={x0:left,x1:left+boxW,y0:top,y1:top+boxH};
   });
   ctx.restore();
 }
 function hitTest(e){
   if(tankMode||appMode!=='view'||moving||buyKey||modal||!state.offer||state.active)return null;
   const {sx,sy}=screenXY(e);
   return visitors.find(p=>{const h=p._tugHit;return personOnScreen(p)&&
     (personHitTest(p,sx,sy)||(h&&sx>=h.x0&&sx<=h.x1&&sy>=h.y0&&sy<=h.y1));})||null;
 }
 let pressed=null;
 cv.addEventListener('pointerdown',e=>{const visitor=e.button===0?hitTest(e):null;pressed=visitor?{visitor,id:e.pointerId,x:e.clientX,y:e.clientY}:null;},true);
 cv.addEventListener('pointerup',e=>{
   const down=pressed;pressed=null;
   if(!down||e.pointerId!==down.id||dragMoved||Math.hypot(e.clientX-down.x,e.clientY-down.y)>DRAG_TH||hitTest(e)!==down.visitor)return;
   dragging=false;cv.classList.remove('panning','placing');e.preventDefault();e.stopImmediatePropagation();ask();
 },true);
 cv.addEventListener('pointercancel',()=>{pressed=null;},true);
 cv.addEventListener('lostpointercapture',()=>{pressed=null;},true);

 /* ---------- โมดอลรับคำท้า ---------- */
 function ask(){
   if(modal||!state.offer||!tank()||state.active)return;
   const t=tank(),r=state.offer.rival;
   /* ---- เลย์เอาต์ (จัดใหม่ 2026-09-17 ตามหลัก ลำดับความสำคัญ · จัดกลุ่ม · ข้อความเดียวต่อปัญหา · ปุ่มหลักปุ่มเดียว) ----
      ⚠️ 2026-09-17 รอบสอง ผู้เล่นขอ: ของเด่นอยู่ "กลาง" ตัวใหญ่ตามความสำคัญ · แผง VS ใหญ่และสมดุล · เลิกโชว์ค่าสมัคร/รางวัล · ปุ่มต้องดูเป็นปุ่ม
      1. หัวกลางจอ: "ท้าแข่งชักเย่อ" ตัวใหญ่ + บรรทัดรอง ชื่อผู้ท้า · ชิป "N ต่อ N"
      2. แผง VS: ทีมเรา | VS วงกลมใหญ่ | ทีมเขา — สองฝั่งสมมาตร ข้างชื่อทีมมี "พลังรวม" ดึง / ต้าน (ผลรวมของทีม)
      3. แถบผลประเมิน "ต้องกด X ครั้ง/วิ" + ป้ายสี — หรือ "คำเตือนอันเดียว" ถ้ามีเหตุที่เริ่มแข่งไม่ได้
      4. กริดเลือกทาก
      5. ปุ่มเรียงกลาง — ปุ่มหลักสีทองปุ่มเดียว ตอนเริ่มไม่ได้ "ขอไปเตรียมทาก" กลายเป็นปุ่มหลักแทน
      วิธีเล่น/กติกาไม่ต้องอธิบายตรงนี้ — เดโมปุ่ม F/K ตอนนับถอยหลังสอนเองแล้ว (ผู้เล่นขอให้ตัดออก) */
   const geneOf=s=>typeof foodGenes==='function'?foodGenes(s):s.genes;
   /* ทีมคู่แข่งสุ่มเพิ่มครั้งเดียวแล้วเก็บไว้ในคำท้า — เปิดโมดอลซ้ำก็เจอตัวเดิม ไม่ใช่สุ่มใหม่ทุกครั้ง */
   const rivalTeam=n=>{if(!Array.isArray(r.team)||!r.team.length)r.team=[r.genes];while(r.team.length<n)r.team.push(SlugEngine.randGene());return r.team.slice(0,n);};
   /* จำนวนตัวมากับคำท้า (offerSize) ผู้เล่นเปลี่ยนไม่ได้ · เลือกทากให้ครบจำนวนไว้ก่อนตามลำดับในตู้ */
   const mode=offerSize(r);let picked=t.slugs.slice(0,mode).map(s=>s.id);
   const foes=rivalTeam(mode).map(genes=>({genes})),cps=r.cps??botCps(),entry=ENTRY*mode;
   const d=dialog('ท้าแข่งชักเย่อ');d.classList.add('tug-ask');
   d.querySelector('h2').textContent='🪢 ท้าแข่งชักเย่อ';
   const sub=element('p',null,d);sub.className='tug-sub';
   element('span',r.name+' ท้ามา',sub);element('span',mode+' ต่อ '+mode,sub).className='tug-chip';

   /* ---- แผง VS ---- */
   const vs=element('section',null,d);vs.className='tug-vs';vs.setAttribute('aria-label','เทียบทีม');
   const side=(title,cls)=>{const s=element('div',null,vs);s.className='tug-side '+cls;element('h3',title,s);
     const stat=element('p',null,s);stat.className='tug-power';
     const row=element('div',null,s);row.className='tug-slots';return {row,stat};};
   /* พลังรวมของทีม = ผลรวมแรงดึง / แรงต้านทุกตัว (สองฝั่งจำนวนเท่ากัน เทียบผลรวมได้ตรงกับที่เกมคิดจากค่าเฉลี่ย) */
   const power=(el,list)=>{el.replaceChildren();
     if(!list.length){element('span','—',el);return;}
     element('span','ดึง ',el);element('b',list.reduce((n,m)=>n+pull(m.genes),0).toFixed(1),el);
     element('span',' / ต้าน ',el);element('b',list.reduce((n,m)=>n+resist(m.genes),0).toFixed(1),el);};
   const mine=side('ทีมเรา','is-me');
   element('div','VS',vs).className='tug-vs-mark';
   const theirs=side(mode>1?'ทีม'+r.name:r.name,'is-foe');
   const portrait=(host,genes,label,onClick)=>{
     const b=element(onClick?'button':'div',null,host);b.className='tug-slot';if(onClick){b.type='button';b.onclick=onClick;b.title='เอาออกจากทีม';}
     const c=element('canvas',null,b);c.width=180;c.height=112;c.setAttribute('aria-hidden','true');
     try{drawSlugPortrait(c,{genes});}catch(e){}
     if(label)element('b',label,b);return b;
   };
   for(const f of foes)portrait(theirs.row,f.genes,null,null);
   power(theirs.stat,foes);

   /* ---- ผลประเมิน / คำเตือน (ตำแหน่งเดียว ข้อความเดียว) ---- */
   const verdict=element('div',null,d);verdict.className='tug-verdict-box';verdict.setAttribute('role','status');

   /* ---- เลือกทาก ---- */
   const pickHead=element('div',null,d);pickHead.className='tug-pick-head';
   const pickTitle=element('h3','',pickHead);

   const pickGrid=element('div',null,d);pickGrid.className='tug-pick';   // 4×3 ไม่ต้องเลื่อน (slug-tug.css)
   /* คลิกตัวที่เลือกอยู่ = เอาออก · เลือกเกินจำนวน = ตัวที่เลือกไว้นานสุดหลุดออก (ลำดับที่เลือก = ลำดับยืนบนเชือก) */
   const toggle=id=>{
     if(mode===1)picked=[id];
     else if(picked.includes(id))picked=picked.filter(x=>x!==id);
     else{picked.push(id);if(picked.length>mode)picked.shift();}
   };
   const drawCards=()=>SlugHover.cards(pickGrid,{slugs:t.slugs,selected:picked,multi:true,empty:'ยังไม่มีทากในตู้ชักเย่อ',
     sub:s=>{const g=geneOf(s);return 'ดึง '+pull(g).toFixed(1)+' · ต้าน '+resist(g).toFixed(1);},
     onPick:s=>{toggle(s.id);refresh();return picked;}});

   /* ---- ปุ่ม (เรียงกลาง) · ค่าสมัครอยู่บนปุ่มหลักแล้ว ไม่ต้องมีบรรทัดเงินแยก ---- */
   const actions=element('div',null,d);actions.className='tug-actions';
   const no=element('button','ไม่แข่ง',actions);no.className='tbtn tug-quiet';no.onclick=dismiss;
   const later=element('button','ไปเตรียมทากก่อน',actions);later.className='tbtn';later.onclick=close;
   const start=element('button','จ่าย '+entry.toLocaleString()+' เริ่มแข่ง',actions);start.className='tbtn tug-primary';

   /* บอกตรง ๆ ว่าคู่นี้ต้องกดกี่ครั้ง/วิ ถึงจะเสมอ — ทากยิ่งเก่งยิ่งต้องกดน้อยลง
      ถ้าตัวเลขสูงเกินจะกดไหว ให้ปฏิเสธคำท้าแล้วไปปรับปรุงทากมาใหม่ นั่นคือทางชนะจริง */
   function setVerdict(kind,big,text){
     verdict.className='tug-verdict-box is-'+kind;verdict.replaceChildren();
     if(big)element('b',big,verdict);element('span',text,verdict);
   }
   function refresh(){
     const team=picked.map(id=>t.slugs.find(x=>x.id===id)).filter(Boolean),tg=team.map(s=>({genes:geneOf(s)}));
     /* ช่องทีมเรา: รูปตามลำดับยืน + ช่องว่างเส้นประให้เห็นว่ายังขาดกี่ตัว · คลิกรูป = เอาออก */
     mine.row.replaceChildren();
     team.forEach((s,i)=>portrait(mine.row,tg[i].genes,mode>1?String(i+1):null,()=>{toggle(s.id);drawCards();refresh();}));
     power(mine.stat,tg);
     for(let i=team.length;i<mode;i++){const e=element('div',null,mine.row);e.className='tug-slot is-empty';element('b',mode>1?String(i+1):'?',e);element('span','ว่าง',e);}
     pickTitle.textContent='เลือกทาก '+team.length+'/'+mode;
     /* เหตุที่เริ่มไม่ได้ เรียงจากเรื่องที่ต้องแก้นอกหน้านี้ก่อน — โชว์อันเดียวเสมอ ไม่ซ้ำกับบรรทัดอื่น */
     const blocker=!t.slugs.length?['ยังไม่มีทากในตู้ชักเย่อ','ย้ายทากเข้าตู้ แล้วกลับมารับคำท้า']
       :t.slugs.length<mode?['ทากไม่พอ','แมตช์นี้ต้องใช้ '+mode+' ตัว แต่ตู้ชักเย่อมีแค่ '+t.slugs.length+' ตัว — ย้ายทากเข้าตู้เพิ่มก่อน']
       :G.coin<entry?['ทองไม่พอ','ค่าสมัคร '+entry.toLocaleString()+' ทอง · มีอยู่ '+Math.floor(G.coin).toLocaleString()]
       :null;
     if(blocker)setVerdict('block',blocker[0],blocker[1]);
     else if(team.length<mode)setVerdict('todo','เลือกอีก '+(mode-team.length)+' ตัว','จากการ์ดด้านล่าง');
     else{
       const theirsPts=teamNet(foes,tg)*cps,need=theirsPts/teamNet(tg,foes);
       const kind=need<=7?'easy':need<=11?'ok':'hard';
       setVerdict(kind,'ต้องกด '+need.toFixed(1)+' ครั้ง/วิ',
         (kind==='easy'?'สบาย':kind==='ok'?'พอไหว':'หนักมาก — '+(mode>1?'ทีมนี้':'ทากตัวนี้')+'ยังสู้ไม่ไหว'));
     }
     start.disabled=!!blocker||team.length!==mode;
     /* ปุ่มหลักมีปุ่มเดียว: เริ่มได้ = "จ่าย…เริ่มแข่ง" · ติดเรื่องที่ต้องไปแก้นอกหน้านี้ = "ไปเตรียมทากก่อน" */
     later.classList.toggle('tug-primary',!!blocker);start.hidden=!!blocker;
   }
   start.onclick=()=>{
     const n=mode,team=picked.map(id=>t.slugs.find(x=>x.id===id)).filter(Boolean);
     if(team.length!==n||!G.objs.includes(t)||G.coin<entry){refresh();return;}
     addCoin(-entry);
     const mine=team.map(s=>({id:s.id,genes:{...geneOf(s)}})),foes=rivalTeam(n).map(g=>({genes:{...g}}));
     state.active={tankId:t.id,rope:0,countdown:3,freezeUntil:0,freezeSide:null,settled:false,won:null,
       camX:(HOME+AWAY)/2,view:layoutAt(0),elapsed:0,size:n,entry,prizePot:PRIZE*n,
       me:{id:mine[0].id,name:slugNick(team[0]),genes:mine[0].genes,team:mine,total:0,used:0,sneezeUntil:0},
       foe:{name:r.name,genes:foes[0].genes,team:foes,cps:r.cps??botCps(),total:0,used:0,sneezeUntil:0,nextPressAt:0}};
     syncHUD();saveGame();close();openMatch();
   };
   drawCards();refresh();
 }

 /* ---------- ตำแหน่งบนเลน ---------- */
 /* ฝั่งเรา fx น้อย · ฝั่งคู่แข่ง fx มาก · เราได้เปรียบ = ทั้งคู่ถูกลากมาทางเรา (fx ลด)
    ฝั่งชนะถอยหลังน้อยกว่าฝั่งที่ถูกลาก จึงคูณ .55 ไว้ */
 /* ⚙️ ROPE_START_BIAS: เลื่อนทาก · ผ้าแดง · เส้นชนะ/แพ้ ไปทางซ้ายเท่ากับระยะที่ผ้าแดงขยับเมื่อเรานำ N แต้ม (เส้นกลางไม่เลื่อน — ดู drawLane)
    ⚠️ 2026-09-17 ผู้เล่นดูแล้วบอกว่าตอนเริ่ม "ขยับไปทางซ้ายเหมือนเรานำอยู่ 30 นั่นแหละพอดี" · เป็นแค่ภาพ แต้ม/กติกาชนะเหมือนเดิม
    กล้องยังเล็งที่เดิม (กลางตู้) สนามจึงเยื้องซ้ายของกลางจอตามค่านี้ · เส้นทั้งสามเลื่อนตามด้วย ผ้าแดงจึงยังทับเส้นกลางตอนแต้ม 0 และถึงเส้นชนะพอดีตอนชนะ */
 const ROPE_START_BIAS=30;
 const FIELD_SHIFT=ROPE_START_BIAS/WIN*SHIFT*(1+.55)/2;   // ผ้าแดงขยับ (ถอยฝั่งเรา ×.55 + ฝั่งเขา ×1) / 2 ต่อแต้ม
 function layoutAt(rope){
   const off=(clamp(rope,-WIN,WIN)/WIN)*SHIFT, meX=HOME-off*.55-FIELD_SHIFT, foeX=AWAY-off-FIELD_SHIFT;
   return {meX,foeX,cloth:(meX+foeX)/2};
 }

 /* ---------- เริ่ม/เล่น ---------- */
 function openMatch(){
   const a=state.active,t=tankOf(); if(!a||modal||tugUI||!t)return;
   if(!a.me.bot&&!myTeam().every(Boolean)){             // ทากตัวไหนในทีมหายไประหว่างทาง
     if(a.tour){a.settled=true;a.won=false;a.forfeit=true;tourMatchDone();return;}   // ทัวร์นาเมนต์ = แพ้ฟาวล์ คู่นั้นผ่านไป
     complete();return;}                                                             // 1 ต่อ 1 = ยกเลิกแมตช์
   /* เวลาทุกตัวอิง performance.now() ซึ่งรีเซ็ตทุกครั้งที่โหลดหน้า — ต้องล้างตอนต่อเกม */
   a.freezeUntil=0;a.freezeSide=null;a.me.sneezeUntil=0;a.foe.sneezeUntil=0;a.foe.nextPressAt=0;a.me.nextPressAt=0;
   a.view=a.view||layoutAt(a.rope);
   /* id ต่างกันทุกตัว — Slug3D แยกโครงกระดูก/แอนิเมชันตาม id (ซ้ำกัน = สองตัวขยับเป็นตัวเดียว) */
   foeSprites=teamOf(a.foe).map((m,i)=>({id:'tug-foe'+(i?'-'+i:''),genes:m.genes,flip:false,state:'rest',ph:i*1.7,noBob:true}));
   meSprites=a.me.bot?teamOf(a.me).map((m,i)=>({id:'tug-left'+(i?'-'+i:''),genes:m.genes,flip:true,state:'rest',ph:i*1.3,noBob:true})):[];
   tugUI=element('div');tugUI.id='tugTankHUD';document.body.classList.add('tug-in-tank');
   enterTank(t);ov.querySelector('.ov-body').append(tugUI);
   document.getElementById('ovTitle').textContent=a.tour?'🏆 ทัวร์นาเมนต์ชักเย่อ · '+TOUR_ROUNDS[a.tour.round]:'🪢 ชักเย่อทากทะเล';

   const banner=element('div',null,tugUI);banner.className='tug-banner';
   statusNode=element('div','เตรียมตัว!',banner);statusNode.className='tug-count';statusNode.setAttribute('role','status');
   bar=element('div',null,banner);bar.className='tug-rope-bar';
   element('span',null,bar).className='tug-bar-mid';
   marker=element('i',null,bar);marker.className='tug-bar-marker';
   /* ป้ายสองข้างแถบ = คำตอบของ "ฝั่งไหนของเรา" แบบที่ไม่ต้องจำ — ซ้าย(เขียว)เรา ขวา(แดง)คู่แข่ง
      สีตรงกับเส้นชนะ/เส้นแพ้ที่วาดบนพื้นทรายใน drawLane() และกับป้าย "คุณ" ใต้ตัวทากเรา */
   const ends=element('div',null,banner);ends.className='tug-ends';
   element('span','◀ '+(a.me.bot?a.me.name:'เรา · '+a.me.name),ends).className='tug-end-me';
   element('span',a.foe.name+' ▶',ends).className='tug-end-foe';
   scoreNode=element('small','',banner);scoreNode.className='tug-score';

   /* เลขนับถอยหลังตัวใหญ่กลางจอ 3 2 1 → ดึง! (อัปเดตใน hud) · ป้ายบนมี role=status อ่านให้โปรแกรมอ่านจอแล้ว ตัวนี้เลยซ่อนจาก a11y */
   bigCount=element('div','',tugUI);bigCount.className='tug-bigcount';bigCount.hidden=true;bigCount.setAttribute('aria-hidden','true');bigCountShown='';

   /* บอทปะทะบอท (ทัวร์นาเมนต์): ไม่มีปุ่มกด มีแต่ปุ่มข้ามไปดูผล */
   if(a.me.bot){
     const skip=element('button','⏭ ข้ามไปดูผล',tugUI);skip.type='button';skip.className='tug-skip';
     skip.onclick=()=>{const x=state.active;if(!x||x.settled)return;settle(simulateWin(x.me,x.foe));};
     resizeTank();lastFrame=0;cameraKey='';
     if(a.settled)tourMatchDone();
     return;
   }
   const controls=controlsNode=element('div',null,tugUI);controls.className='tug-controls';
   /* กองไฟเป็น "ฉากหลัง" ใต้ปุ่ม F/K ไม่ใช่ปุ่มแยก — ลุกใหญ่ขึ้นเรื่อย ๆ ตามพลังที่สะสม (ดู stepFire) */
   const fireCv=element('canvas',null,controls);fireCv.className='tug-fire-cv';fireCv.setAttribute('aria-hidden','true');
   fire=makeFire(fireCv);
   const row=element('div',null,controls);row.className='tug-row';
   keyBtns.f=keyButton('f','F','◀');
   /* ปุ่มท่าไม้ตายโผล่เฉพาะตอนไฟเต็ม — ระหว่างสะสมไม่ต้องมีอะไรให้สับสน มีแต่ไฟที่ค่อย ๆ โต */
   chargeNode=element('button',null,row);chargeNode.className='tug-enter';chargeNode.type='button';
   chargeNode.setAttribute('aria-label','ท่าไม้ตาย (Space)');
   element('b','Space',chargeNode);
   element('span','ท่าไม้ตาย',chargeNode).className='tug-enter-sub';
   chargeNode.onpointerdown=e=>{e.preventDefault();useCharge('me',performance.now());};
   keyBtns.k=keyButton('k','K','▶');
   function keyButton(key,label,arrow){
     const b=element('button',null,row);b.className='tug-key';b.type='button';b.dataset.key=key;
     b.setAttribute('aria-label','ดึงเชือก ปุ่ม '+label);
     element('b',label,b);element('span',arrow,b).className='tug-key-arrow';
     b.onpointerdown=e=>{e.preventDefault();press(performance.now(),key);};
     b.onclick=e=>{if(e.detail===0)press(performance.now(),key);};   // เข้าถึงด้วยคีย์บอร์ด (Tab มาที่ปุ่มแล้วกด Enter)
     return b;
   }

   resizeTank();lastFrame=0;cameraKey='';
   if(a.settled){if(a.tour)tourMatchDone();else showResult();}
 }
 function charges(side){const o=state.active[side];return Math.floor(o.total/CHARGE_AT)-o.used;}
 /* ต้องสลับปุ่ม: กด F แล้วต้อง K ถัดไป กดซ้ำปุ่มเดิมไม่นับแต้ม (เหมือน slug-race.js)
    ปุ่มถัดไปถูกไฮไลต์ไว้ตลอดผ่าน markNextKey() ผู้เล่นจึงไม่ต้องจำเองว่าถึงคิวปุ่มไหน */
 const pullCap=makePressLimiter();
 function press(now,key){
   const a=state.active;
   if(!a||a.me.bot||a.settled||a.countdown>0||now<a.freezeUntil||document.hidden||!tugUI)return;
   if(lastKey===key)return;
   if(!pullCap())return;                            // เพดาน 20 ครั้ง/วิ (config.js) กันมาโครดึงรัว
   lastKey=key;a.lastKey=key;
   a.me.pullDir=key==='f'?1:-1;a.me.pullAt=now;     // หงอนสะบัด: F = ไปทางหาง · K = ไปทางหัว (ดู updateTankFrame)
   score('me');markNextKey();
   /* ปุ่มยุบลงแล้วเด้งกลับ + สว่างวาบ = เห็นชัดว่ากดโดน (ท่าเดียวกับเดโมตอนนับถอยหลังใน CSS tugDemoTap) */
   keyBtns[key]?.animate([{transform:'translateY(5px) scale(.93)',filter:'brightness(1.5)'},{transform:'none',filter:'none'}],{duration:160,easing:'ease-out'});
 }
 function markNextKey(){
   const next=lastKey==='f'?'k':lastKey==='k'?'f':null;   // ยังไม่เคยกด = ไฮไลต์ทั้งคู่ กดอันไหนก่อนก็ได้
   for(const k of ['f','k'])keyBtns[k]?.classList.toggle('next',!next||k===next);
 }
 function score(side){
   const a=state.active,o=a[side],foe=a[side==='me'?'foe':'me'];
   const gain=teamNet(teamOf(o),teamOf(foe));  // ค่าคงที่ตลอดแมตช์ — กดตอนไหนก็ได้แต้มเท่ากัน
   o.total+=gain; a.rope+=side==='me'?gain:-gain;
   checkEnd();
 }
 function useCharge(side,now){
   const a=state.active;
   if(!a||a.settled||a.countdown>0||now<a.freezeUntil||charges(side)<1)return false;
   const o=a[side];o.used++;
   /* แต้มจากท่าไม้ตายไม่นับเข้า total — ไม่งั้นชาร์จจะเลี้ยงตัวเองเป็นลูกโซ่ */
   const gain=10+Math.random()*5;
   a.rope+=side==='me'?gain:-gain;
   a.freezeUntil=now+CUT_MS;a.freezeSide=side;o.sneezeUntil=now+CUT_MS;
   showCutscene(side,now);                            // ขึ้นทั้งตอนเราใช้และตอนคู่แข่งใช้
   if(tankCv&&!reducedMotion()){
     tankCv.classList.remove('tug-shake');void tankCv.offsetWidth;tankCv.classList.add('tug-shake');
     setTimeout(()=>tankCv.classList.remove('tug-shake'),620);
   }
   checkEnd();return true;
 }
 function checkEnd(){
   const a=state.active;if(!a||a.settled)return;
   if(a.rope>=WIN)settle(true); else if(a.rope<=-WIN)settle(false);
 }
 function advance(now,dt){
   const a=state.active;if(!a||a.settled)return;
   if(a.countdown>0){a.countdown=Math.max(0,a.countdown-dt);return;}
   /* หยุดโลกตอนใครสักฝั่งใช้ท่าไม้ตาย — ทั้งสองฝั่งกดไม่ได้ (ตั้งใจ)
      ⚠️ ต้องเลื่อนนัดกดของบอทไปรอที่ปลายช่วงฟรีซด้วย ไม่งั้น nextPressAt ค้างอยู่ในอดีต 1 วิ
      พอฟรีซจบ ลูป while ข้างล่างจะกดชดเชยให้บอทรวดเดียว ~10 ครั้งในเฟรมเดียว = ผู้เล่นโดนกระชากทันทีหลังคัทซีน
      (ตัวกัน >2000ms ข้างล่างจับไม่ได้ เพราะฟรีซยาวแค่ 1 วิ) */
   if(now<a.freezeUntil){a.foe.nextPressAt=a.freezeUntil;if(a.me.bot)a.me.nextPressAt=a.freezeUntil;return;}
   a.elapsed=(a.elapsed||0)+dt;                       // นาฬิกาแมตช์ (ไม่เดินตอนนับถอยหลัง/ฟรีซ)
   if(a.elapsed>=LIMIT){settle(a.rope>0);return;}     // หมดเวลา = ตัดสินที่ว่าใครนำอยู่ตอนนั้น
   for(const side of a.me.bot?['me','foe']:['foe']){
     const f=a[side];
     if(!f.nextPressAt||now-f.nextPressAt>2000)f.nextPressAt=now;   // กลับมาจากแท็บที่ถูกพัก = อย่ารัวชดเชย
     let guard=0;
     while(f.nextPressAt<=now&&guard++<20){f.nextPressAt+=1000/f.cps;f.pullDir=-(f.pullDir||-1);f.pullAt=now;score(side);if(a.settled)return;}
   }
   for(const side of a.me.bot?['me','foe']:['foe'])if(charges(side)>0&&useCharge(side,now))break;   // บอทมีก็ใช้เลย (ทีละฝั่งต่อเฟรม)
 }
 function settle(won){
   const a=state.active;if(!a||a.settled)return;
   a.rope=clamp(a.rope,-WIN,WIN);a.settled=true;a.won=won;
   a.prize=a.tour?0:won?(a.prizePot??PRIZE):0;addCoin(a.prize);   // ทัวร์นาเมนต์จ่ายรางวัลตามอันดับตอนจบทั้งสาย
   saveGame();syncHUD();
   if(!a.me.bot){
     if(typeof playNotificationSound==='function')playNotificationSound(won?'tugWin':'tugLose');
     if(won)fireworks(); else smashBanner();
   }
   setTimeout(()=>{if(!state.active?.settled||modal)return;if(state.active.tour)tourMatchDone();else showResult();},a.me.bot?700:won?900:1300);
 }
 function complete(){
   const t=tankOf(),wasPractice=state.active?.practice;
   if(t)for(const s of t.slugs){delete s._tugSpot;delete s.tugLean;delete s.tugStrain;s.state='rest';s.stt=.5;}   // tugLean ค้าง = หงอนเอียงค้าง/ทากไม่เข้าโครงแชร์ (slug-3d.js)
   /* ซ้อม: ไม่ยุ่งกับคำท้าที่ค้างอยู่ ไม่รีเซ็ตนาฬิกา และอยู่ในตู้ต่อ */
   if(wasPractice){state.active=null;close();saveGame();return;}
   state.active=null;state.offer=null;leave();close();exitTank();reschedule();saveGame();
 }

 /* ---------- คัทซีนท่าไม้ตาย (สไตล์สั่งท่าโปเกม่อน) ----------
    ภาพทาก 2D ตัวใหญ่สไลด์เข้ามาชิดขอบจอ — ฝั่งเราเข้าซ้าย คู่แข่งเข้าขวา — ระหว่างช่วงฟรีซ 1 วิ
    ใช้สไปรต์ 2D เสมอแม้ตัวในตู้จะเป็นโมเดล 3D อยู่ เพราะเป็นภาพพอร์ตเทรตแยกจากฉาก
    ท่าที่วาดคือ 'sneeze' ซึ่งเอนจิน 2D มีอยู่แล้ว (สั่นหงอน+หนวดรัว ๆ ที่ slug-engine.js) */
 function showCutscene(side,now){
   if(!tugUI||document.hidden||!state.active)return;
   const a=state.active;
   cutSide=side;cutGenes=side==='me'?a.me.genes:a.foe.genes;cutUntil=now+CUT_MS;
   if(!cutNode){
     cutNode=element('div',null,tugUI);cutNode.className='tug-cut';cutNode.setAttribute('aria-hidden','true');
     cutCanvas=element('canvas',null,cutNode);cutCanvas.className='tug-cut-art';
   }
   cutNode.className='tug-cut '+(side==='me'?'from-left':'from-right');
   const box=cutNode.getBoundingClientRect(),DPR2=Math.min(devicePixelRatio||1,2);
   const w=Math.max(80,Math.round(box.width)),h=Math.max(80,Math.round(box.height));
   if(cutCanvas.width!==w*DPR2||cutCanvas.height!==h*DPR2){cutCanvas.width=w*DPR2;cutCanvas.height=h*DPR2;}
   cutCanvas.style.width=w+'px';cutCanvas.style.height=h+'px';
   drawCutscene(now);
 }
 function drawCutscene(now){
   if(!cutCanvas||!cutGenes)return;
   const P=SlugEngine.slugParts(cutGenes,220);if(!P)return;
   const x=cutCanvas.getContext('2d'),DPR2=cutCanvas.width/parseFloat(cutCanvas.style.width||1);
   x.setTransform(DPR2,0,0,DPR2,0,0);
   const w=cutCanvas.width/DPR2,h=cutCanvas.height/DPR2;
   x.clearRect(0,0,w,h);
   /* ตัวโตเต็มกรอบ หันเข้าหากลางจอเสมอ — สไปรต์ต้นฉบับหันซ้าย ฉะนั้นแผงฝั่งซ้าย (เรา) ต้องพลิก
      ไม่งั้นทากจะหันหน้าออกนอกจอ เหมือนยืนหันหลังให้คู่แข่ง */
   const scale=Math.min((w*1.02)/P.w,(h*.94)/P.h);
   x.save();x.translate(w/2,h*.52);
   if(cutSide==='me')x.scale(-1,1);
   SlugEngine.drawSlug(x,P,0,0,false,now%100000,scale,true,true,{state:'sneeze',noBob:false});
   x.restore();
 }
 /* ---------- เอฟเฟกต์ ---------- */
 /* พลุเต็มจอ (js/fireworks.js)
    ไม่ส่ง host = จังหวะชนะ ยิงชุดใหญ่ · ส่ง dialog มา = กล่องผลเพิ่งเด้ง
    ⚠️ กล่องผลเป็น <dialog> showModal() ซึ่งขึ้น top layer ทีหลังพลุ → จะทับพลุที่กำลังเล่น
       ต้องยิงซ้ำหลังเปิดกล่อง play() จะดันชั้นพลุกลับขึ้นบนสุดให้เอง */
 function fireworks(host){
   if(!window.Fireworks)return;
   Fireworks.play(host?{count:5,duration:1600}:{count:12,duration:3400});
 }
 /* แพ้ = หินหล่นใส่ป้ายจนป้ายหลุดพังไปข้างนึง */
 function smashBanner(){
   const banner=tugUI?.querySelector('.tug-banner');
   if(!banner||reducedMotion())return;
   const rock=element('i','🪨',tugUI);rock.className='tug-rock';rock.setAttribute('aria-hidden','true');
   track(rock.animate([{transform:'translate(-50%,-170px) rotate(0deg)',opacity:0},{offset:.3,opacity:1},
     {transform:'translate(-50%,4px) rotate(96deg)',opacity:1}],{duration:430,easing:'cubic-bezier(.5,0,1,1)',fill:'forwards'}));
   setTimeout(()=>{
     if(!tugUI)return;
     track(banner.animate([{transform:'translateX(-50%) rotate(0deg)'},
       {transform:'translateX(-50%) rotate(-8deg)',offset:.18},
       {transform:'translate(calc(-50% - 140px),340px) rotate(-56deg)',opacity:0}],
       {duration:950,easing:'cubic-bezier(.4,0,.85,1)',fill:'forwards'}));
     track(rock.animate([{transform:'translate(-50%,4px) rotate(96deg)'},
       {transform:'translate(calc(-50% - 52px),360px) rotate(250deg)',opacity:0}],{duration:950,fill:'forwards'}));
   },430);
 }

 /* ---------- ผลการแข่ง ---------- */
 function showResult(){
   const a=state.active;if(!a?.settled||modal)return;
   for(const k of ['f','k'])if(keyBtns[k]){keyBtns[k].disabled=true;keyBtns[k].classList.remove('next');}
   if(chargeNode)chargeNode.disabled=true;
   /* บอกระบบเควสว่าชนะแล้ว (quests.js) — ธง _qWin กันนับซ้ำ เพราะกลับเข้าตู้ตอน settled แล้วจะเรียก showResult ใหม่ */
   if(a.won&&!a._qWin){a._qWin=true;window.questContestWin?.();}
   const d=dialog(a.won?'ชนะ! 🪢':'แพ้...');d.classList.add('tug-result');
   d.addEventListener('cancel',e=>{e.preventDefault();complete();});
   element('p',a.won?a.foe.name+' ถูกลากข้ามเส้นไปเรียบร้อย':a.foe.name+' ลากเราข้ามเส้นไป',d).className='tug-result-caption';
   const row=element('div',null,d);row.className='tug-result-row';
   for(const [who,label] of [[a.me,'คุณ'],[a.foe,'คู่แข่ง']]){
     const cell=element('div',null,row);cell.className='tug-result-cell'+(who===a.me?' is-player':'');
     /* โหมดทีม: วาดทากครบทุกตัวเรียงกันในรูปเดียว (เดิมวาดแค่ตัวหัวแถว — แข่ง 2 ตัวแต่ผลขึ้นตัวเดียว) */
     const team=teamOf(who),title=team.length>1?(who===a.me?'ทีมเรา':'ทีม'+a.foe.name):who.name;
     element('span',title,cell).className='tug-result-name';
     const slotW=110,W=slotW*team.length+40,H=104,c=element('canvas',null,cell);c.width=W;c.height=H;c.setAttribute('role','img');c.setAttribute('aria-label',title);
     const cx=c.getContext('2d');
     team.forEach((m,i)=>{const sprite=slugSprite({genes:m.genes});if(!sprite)return;
       const k=Math.min((slotW-6)/sprite.c.width,(H-10)/sprite.c.height),w=sprite.c.width*k,h=sprite.c.height*k;
       cx.drawImage(sprite.c,20+slotW*i+(slotW-w)/2,(H-h)/2,w,h);});
     element('b',Math.round(who.total).toLocaleString()+' แต้ม',cell).className='tug-result-score';
   }
   const receipt=element('div',null,d);receipt.className='race-receipt';
   if(a.practice){
     element('span','โหมดซ้อม',receipt);
     element('strong','ไม่มีค่าสมัคร ไม่มีรางวัล',receipt);
     element('small','ซ้อมได้ไม่จำกัด · คำท้าจริงถึงจะมีเงินรางวัล',receipt);
   }else{
     element('span','ค่าสมัคร −'+(a.entry??ENTRY).toLocaleString()+' ทอง',receipt);
     element('strong',a.prize>0?'รางวัล +'+a.prize.toLocaleString()+' ทอง':'ไม่ได้รางวัล',receipt);
     element('small','ทองคงเหลือ '+G.coin.toLocaleString(),receipt);
   }
   element('p',a.won?'คู่แข่ง: แขนหลุดแล้ว! ไว้เจอกันใหม่':'คู่แข่ง: ยังอ่อนซ้อมนะเพื่อน',d).className='race-taunt';
   const done=element('button','รับทราบ · กลับร้าน',d);done.className='tbtn';done.onclick=complete;done.focus();
   if(a.won)fireworks(d);                              // ฉลองบนกล่องผล (top layer) ไม่ใช่แค่บนฉากที่โดนกล่องบัง
 }

 /* ---------- ผู้ชม: ทากที่เหลือไปยืนขอบตู้ หันหน้าเข้ากลาง ---------- */
 /* ผู้ชมมุงเป็นฝูงสองแถวขนาบเชือกตรงกลาง ไม่ใช่กระจายเต็มความกว้างตู้
    (เดิมกระจายทั้งตู้ ห่างจากเชือกจนอ่านเป็น "ทากเดินเล่นอยู่" ไม่ใช่ "มาดูการแข่ง")
    ⚠️ จุดยืนคิดครั้งเดียวตอนเข้าที่แล้วล็อกไว้ (_tugSpot) — ห้ามให้ขยับตามเชือก
       เคยลองให้ฝูงเลื่อนตามผ้าแดง แล้วทั้งจอขยับพร้อมกันหมดจนดูมั่ว แยกไม่ออกว่าใครแข่งอยู่ */
 const ROW_GAP=1.5;                                   // ระยะระหว่างแถว (ขอบเลน → แถวแรก → แถวสอง) หน่วยช่อง
 /* เลนอยู่หน้าสุดของตู้แล้ว (config.js TUG_LANE) คนดูจึงยืน "สองแถวหลังเลน" แทนการขนาบหน้า-หลัง
    ⚠️ ห้ามให้แถวไหนไปอยู่หน้าเลน — ตัวคนดูเองจะกลายเป็นของที่บังการแข่ง (ต้นเหตุเดียวกับที่ย้ายเลน)
    แถวหลังเยื้องครึ่งช่องจากแถวหน้า ไม่งั้นตัวหลังโดนตัวหน้าบังพอดีทุกตัว */
 const VIEW_MID=(TUG_LANE[0]+TUG_LANE[1]+ROW_GAP*2)/2;   // กลางกรอบภาพ = เลน + แถวคนดู (ใช้ใน camera)
 function rimSpot(t,i,n){
   const row=i%2,k=Math.floor(i/2),per=Math.max(1,Math.ceil(n/2));
   const spread=Math.min(3.4,1.2+per*.75),mid=(HOME+AWAY)/2;
   const off=(per<2?0:(k/(per-1)-.5)*2*spread)+(row?.5:0);
   return {x:clamp(mid+off,1.2,t.def.w-1.2), y:TUG_LANE[1]+ROW_GAP*(1+row)};
 }
 function spectatorSlugs(t){const ids=teamIds();return t.slugs.filter(s=>!ids.has(s.id));}
 function stepSpectators(slugs,dt){
   const t=tankOf(),a=state.active;if(!t||!a)return;
   const cx=(HOME+AWAY)/2,cy=TUG_LANE_MID;
   slugs.forEach((s,i)=>{
     if(!s._tugSpot)s._tugSpot=rimSpot(t,i,slugs.length);
     const sp=s._tugSpot,k=Math.min(1,dt*2.2);
     s.fx+=(sp.x-s.fx)*k; s.fy+=(sp.y-s.fy)*k;
     s.wall=null;s.climbZ=0;s.stt=1;
     /* ยังเดินเข้าที่อยู่ = ท่าเดิน · ถึงที่แล้ว = ยืนนิ่งดู (ท่า rest) */
     s.state=Math.abs(sp.x-s.fx)+Math.abs(sp.y-s.fy)>.25?'walk':'rest';
     /* 'rest'/'walk' ไม่อยู่ใน FACE_STATES → โค้ดวาดจะไม่แตะ flip และบังคับ _motionHeading=s.dir ให้เอง
        ตั้ง dir ชี้เข้ากลางเลน ทั้ง 2D และ 3D จึงหันหน้าดูการแข่งตรงกัน */
     s.dir=s.turn=Math.atan2(cy-s.fy,cx-s.fx);
     s.flip=Math.cos(s.dir)*CELLW+Math.sin(s.dir)*DEPX>0;
     s.ph=(s.ph||0)+dt*.6;
   });
 }

 /* ---------- วาด ---------- */
 /* เลนบนพื้นทราย — อยู่ในชั้นนิ่งที่ถูกแคช จึงวาดครั้งเดียวต่อการเปลี่ยนกล้อง */
 function drawLane(c,project){
   const w=(tank()||{def:{w:20}}).def.w;
   const quad=(x0,y0,x1,y1,fill)=>{const p=[project(x0,y0),project(x1,y0),project(x1,y1),project(x0,y1)];
     c.fillStyle=fill;c.beginPath();p.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.closePath();c.fill();};
   /* เส้นบาง ๆ วาดเป็น stroke ที่ "หนาอย่างน้อย minPx พิกเซลบนจอ" แทนแถบกว้างตายตัวเป็นช่อง
      ⚠️ เดิมเป็นแถบกว้าง 0.06–0.12 ช่อง — ในตู้ซูมใกล้เห็นชัด แต่หน้าร้าน (shop-floor.js ก็เรียกฟังก์ชันนี้)
         1 ช่องเหลือไม่กี่พิกเซล เส้นบางไม่ถึง 1px เลยมองไม่เห็นจากข้างนอกเลย (ผู้เล่นทัก) */
   const a0=project(0,TUG_LANE[0]),a1=project(1,TUG_LANE[0]),pxPerCell=Math.hypot(a1.x-a0.x,a1.y-a0.y);
   const line=(x0,y0,x1,y1,color,cells,minPx)=>{const p=project(x0,y0),q=project(x1,y1);
     c.strokeStyle=color;c.lineWidth=Math.max(minPx,cells*pxPerCell);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();};
   c.save();c.lineCap='butt';
   quad(0,TUG_LANE[0],w,TUG_LANE[1],'rgba(196,164,106,0.22)');                 // ตัวเลน
   for(const y of TUG_LANE)line(0,y,w,y,'rgba(120,92,44,0.55)',.09,1.2);       // ขอบเลน
   const winX=layoutAt(WIN).cloth,loseX=layoutAt(-WIN).cloth;
   line(winX,TUG_LANE[0],winX,TUG_LANE[1],'rgba(120,220,170,0.85)',.12,2);     // เส้นชนะ (ฝั่งเรา)
   line(loseX,TUG_LANE[0],loseX,TUG_LANE[1],'rgba(232,120,110,0.85)',.12,2);   // เส้นแพ้
   /* เส้นกลาง "อยู่กลางตู้เสมอ" ไม่เลื่อนตาม FIELD_SHIFT — ผู้เล่นต้องการเห็นผ้าแดงตอนเริ่มอยู่ "ซ้ายของเส้นกลาง" 30 แต้ม
      (รอบแรกเลื่อนเส้นกลางไปด้วย ระยะผ้า-เส้นเลยเท่าเดิม ผู้เล่นทักว่า "ขยับแล้วจริงปะ") · เส้นชนะ/แพ้ยังเลื่อนตาม ผ้าจึงแตะเส้นพอดีตอนแพ้ชนะจริง */
   line(w/2,TUG_LANE[0],w/2,TUG_LANE[1],'rgba(255,240,200,0.6)',.06,1.2);      // กึ่งกลาง
   c.restore();
 }
 /* ออกแรงอยู่ = เพิ่งกดดึงภายใน 0.45 วิ (กดรัว = ตา ＞＜ ค้างตลอด · หยุดกด = ตากลับเป็นปกติ)
    ⚠️ pullAt เป็นเวลา performance.now() — ต่อเกมจากเซฟแล้วค่าเพี้ยน จึงเช็กอายุติดลบด้วย */
 function strainOf(o,now){const age=now-(o.pullAt||0);return !!o.pullAt&&age>=0&&age<450&&!state.active?.settled;}
 /* ทาก 3D วาดผ่านตัวเรนเดอร์ของตู้ (DecorGLB) ชุดเดียวกับทากปกติ — ฉาก WebGL เดียว ไม่มีการก๊อปภาพ
    ⚠️ 2026-09-16 เดิมเรียก Slug3D.draw (ทาง atlas): เรนเดอร์ลงเรนเดอเรอร์แยก → drawImage ทั้ง atlas ลงแคนวาส 2D
       → ขึ้น GPU ใหม่ทุกเฟรม วัดในตู้ชักเย่อ 3 ต่อ 3: เฟรมกลาง 24ms · 99% ที่ 108ms · texSubImage2D 84ms/วิ = กระตุกชัด
    ทางนี้ต้องวาดเชือก/ผ้าไว้ในชั้นพื้นหลัง (drawUnder) ไม่งั้นเชือกบนแคนวาส 2D จะทับตัวทาก 3D */
 const glSlugs=()=>!!(engineReady&&window.DecorGLB?.ready&&window.Slug3D?.ready&&Slug3D.enabled);
 function drawSlugAt(s,fx,fy,heading){
   s._motionHeading=heading;
   if(glSlugs()){s.fx=fx;s.fy=fy;s.climbZ=0;s.wall=null;if(DecorGLB.drawSlug(s))return;}
   const len=TANK_SLUG_VIEW_SCALE*slugCm(s.genes)*depthPxPerCm();
   const p=S(fx,fy,SAND_CELLS);
   const dir={x:CELLW*Math.cos(heading)+DEPX*Math.sin(heading),y:-DEPY*Math.sin(heading)};
   if(engineReady&&window.Slug3D?.draw(tctx,s,p.x,p.y,len,false,dir))return;
   const P=slugPartsOf(s);if(!P)return;
   const scale=len/(P.bw*P.s),h=P.h*scale;
   const cx=p.x-((P.L+P.R)/2-P.bw/2)*P.s*scale, cy=p.y-h*.44;
   drawTankSlug(s,P,scale,cx,cy,false);
   /* 2D: ตา ＞＜ ใช้ drawDashFace ตัวเดียวกับท่าพุ่ง (tank-view.js) — 3D ใช้เมช EyeStrain_ แทน */
   if(s.tugStrain)drawDashFace(P,cx,cy,s.flip,P.s*scale,slugBaseHex(s.genes),0,2.2);   // 2.2 เท่า: ขนาดตาเดิมในตู้เหลือ ~3px อ่านไม่ออก
   else drawDefaultEyes(P,cx,cy,s.flip,P.s*scale);
 }
 const TUG_ITEMS_2D=[{sortY:TUG_LANE_MID+.06,kind:'tug',part:'rope'},{sortY:TUG_LANE_MID+.05,kind:'tug',part:'cloth'},
   {sortY:TUG_LANE_MID,kind:'tug',part:'foe'},{sortY:TUG_LANE_MID,kind:'tug',part:'me'}];
 const TUG_ITEMS_GL=TUG_ITEMS_2D.slice(2);
 /* ทาก 3D: เชือกกับผ้าย้ายไปวาดในชั้นพื้นหลังแล้ว (drawUnder) · ทาก 2D: เรียงลึกรวมกับของอื่นเหมือนเดิม */
 /* เส้นโค้งเชือกบนจอ (ใช้ร่วมกันระหว่างเชือกกับผ้าแดง) */
 function ropeCurve(a,v){
   const mt=teamOf(a.me),ft=teamOf(a.foe),mb=teamBack(mt),fb=teamBack(ft);
   const lift=team=>bodyCells(team[team.length-1].genes)*ROPE_LIFT;
   const A=S(v.meX-mb[mb.length-1],TUG_LANE_MID,SAND_CELLS+lift(mt)),B=S(v.foeX+fb[fb.length-1],TUG_LANE_MID,SAND_CELLS+lift(ft));
   return {A,B,mx:(A.x+B.x)/2,my:(A.y+B.y)/2+Math.max(3,7*tankCam.zoom)};   // จุดควบคุมต่ำกว่ากลาง = เชือกหย่อนนิด ๆ ให้ดูมีน้ำหนัก
 }
 function tugItems(){return glSlugs()?TUG_ITEMS_GL:TUG_ITEMS_2D;}
 function drawUnder(){if(glSlugs()){drawPart(TUG_ITEMS_2D[0]);drawPart(TUG_ITEMS_2D[1]);}}
 function drawPart(it){
   const a=state.active,v=a&&a.view;if(!a||!v)return;
   if(it.part==='rope'){
     /* ปลายเชือกอยู่ "กลางตัว" ของทากตัวท้ายแถวแต่ละฝั่ง ไม่ใช่ขอบหน้าตัวหัวแถว
        เชือกวาดก่อนทาก (sortY มากกว่า) ช่วงที่ลอดใต้ตัวจึงโดนตัวบังเอง
        ⚠️ เดิมหยุดที่ meX+.5 / foeX−.5 (ห่างกลางตัวครึ่งช่อง) — ทากตัวใหญ่ยาวเกินครึ่งช่องเลยบังรอยต่อพอดี
           แต่ตัวเล็ก (ยาว < 1 ช่องในตู้) เห็นช่องว่างระหว่างปลายเชือกกับตัว ดูเหมือนเชือกขาดก่อนถึงทาก */
     const {A,B,mx,my}=ropeCurve(a,v);
     /* ยกเชือกขึ้นมา "กลางลำตัว" ไม่ใช่ระดับทราย — ⚠️ 2026-09-17 เดิมผูกที่ SAND_CELLS
        วัดจากภาพจริง: ขอบล่างตัวทาก 3D ต่ำกว่าจุดทราย ~13px ส่วนลำตัวสูงขึ้นไป เชือกเลยวิ่งเลียขอบล่างตัว ดูไม่ตรงเส้น
        ความสูงลำตัวแปรตามขนาด จึงยกตามความยาวตัวที่เห็นจริง (bodyCells) ของตัวท้ายแถวแต่ละฝั่ง
        (คำนวณใน ropeCurve — ผ้าแดงใช้เส้นโค้งเดียวกันเพื่อเกาะเชือกพอดี) */
     tctx.save();tctx.lineCap='round';
     tctx.strokeStyle='#a9803f';tctx.lineWidth=Math.max(2.5,5*tankCam.zoom);
     tctx.beginPath();tctx.moveTo(A.x,A.y);tctx.quadraticCurveTo(mx,my,B.x,B.y);tctx.stroke();
     tctx.strokeStyle='rgba(255,226,160,.4)';tctx.lineWidth=Math.max(1,1.8*tankCam.zoom);
     tctx.beginPath();tctx.moveTo(A.x,A.y);tctx.quadraticCurveTo(mx,my-1.5,B.x,B.y);tctx.stroke();
     tctx.restore();return;
   }
   if(it.part==='cloth'){
     /* ผ้าแดงต้อง "อยู่บนเชือก" และ "อยู่บนเส้นกลาง/เส้นชนะ-แพ้" ในภาพพร้อมกัน
        ⚠️ 2026-09-17 เดิมวาดที่จุดบนทราย S(cloth) แล้วเลื่อนลง 5px — เชือกยกขึ้น+หย่อน ผ้าเลยไม่อยู่บนเชือก
           และเส้นบนทรายเป็นเส้นเฉียง (แนวลึก fy ดันภาพไปขวา DEPX/ขึ้น DEPY) พอผ้าอยู่ต่างระดับกับจุดบนทราย
           จะดูเยื้องขวาของเส้นราว 40px (= ต้องดึงอีก ~40 แต้มถึงดูตรงกลาง ผู้เล่นเจอ)
        จึงหาจุดบนเส้นโค้งเชือก แล้วเลื่อน x ไปตามแนวเฉียงของเส้นบนทรายให้ตรงระดับนั้น (วนสองรอบพอลู่เข้า) */
     const {A,B,mx,my}=ropeCurve(a,v),g=S(v.cloth,TUG_LANE_MID,SAND_CELLS),z=Math.max(4,9*tankCam.zoom);
     let x=g.x,y=g.y;
     for(let i=0;i<2;i++){
       const t=clamp((x-A.x)/((B.x-A.x)||1),0,1);
       y=(1-t)*(1-t)*A.y+2*t*(1-t)*my+t*t*B.y;
       x=g.x+(g.y-y)*DEPX/DEPY;
     }
     tctx.save();tctx.translate(x,y);
     tctx.fillStyle='#d9534a';tctx.beginPath();
     tctx.moveTo(0,-z*.35);tctx.lineTo(z*.8,0);tctx.lineTo(0,z*1.15);tctx.lineTo(-z*.8,0);
     tctx.closePath();tctx.fill();
     tctx.fillStyle='rgba(255,220,200,.45)';tctx.fillRect(-z*.12,-z*.3,z*.24,z*1.2);
     tctx.restore();return;
   }
   const now=performance.now();
   /* ทีมยืนเรียงต่อท้ายหัวแถวตามแนวเชือก ทั้งทีมออกแรง/จาม/สะบัดหงอนพร้อมกัน
      วาดตัวท้ายแถวก่อน หัวแถว (ติดกลางเชือก) วาดทีหลังสุด = ป้ายชื่อไม่โดนเพื่อนร่วมทีมทับ */
   if(it.part==='me'){
     const team=myTeam(),back=teamBack(teamOf(a.me));
     const sneeze=a.me.sneezeUntil>now,strain=!sneeze&&strainOf(a.me,now);
     for(let i=team.length-1;i>=0;i--){
       const s=team[i];if(!s)continue;
       s.state=sneeze?'sneeze':'rest';
       s.flip=true;                                   // ฝั่งเราอยู่ซ้าย หันไปทางคู่แข่ง (ขวา)
       s.tugLean=v.meLean||0;                         // หงอนสะบัดตามปุ่ม (ตัววาด 2D/3D อ่านค่านี้)
       s.tugStrain=strain;                            // ตา ＞＜ ตอนออกแรง (จามใช้ตาของท่าจามเอง)
       drawSlugAt(s,v.meX-back[i],TUG_LANE_MID,0);
     }
     nameTag(a.me.bot?a.me.name:team.length>1?'ทีมคุณ':'คุณ',v.meX-back[back.length-1]/2,a.me.bot?'#3c1a18':'#153c42',a.me.bot?'#ffc9b6':'#ffe3a0');   // ยกแบบมาจาก drawRunner() ของตู้แข่งวิ่ง
     return;
   }
   if(it.part==='foe'&&foeSprites.length){
     const back=teamBack(teamOf(a.foe)),sneeze=a.foe.sneezeUntil>now,strain=!sneeze&&strainOf(a.foe,now);
     for(let i=foeSprites.length-1;i>=0;i--){
       const f=foeSprites[i];
       f.state=sneeze?'sneeze':'rest';f.flip=false;f.tugLean=v.foeLean||0;f.tugStrain=strain;
       drawSlugAt(f,v.foeX+back[i],TUG_LANE_MID,Math.PI);
     }
     nameTag(a.tour?a.foe.name:foeSprites.length>1?'ทีมคู่แข่ง':'คู่แข่ง',v.foeX+back[back.length-1]/2,'#3c1a18','#ffc9b6');
   }
 }
 /* ป้ายชื่อใต้ตัว — ทึบพอให้อ่านออกบนทรายสว่าง กว้างตามข้อความจริง (ภาษาไทยยาวไม่เท่ากัน) */
 function nameTag(text,fx,bg,fg){
   const p=S(fx,TUG_LANE_MID,SAND_CELLS),h=Math.max(15,19*tankCam.zoom);
   tctx.save();
   tctx.font='bold '+Math.max(10,12*tankCam.zoom).toFixed(0)+'px "IBM Plex Sans Thai",sans-serif';
   tctx.textAlign='center';tctx.textBaseline='middle';
   const w=tctx.measureText(text).width+16,y=p.y+h*.6;
   tctx.fillStyle=bg;tctx.beginPath();tctx.roundRect(p.x-w/2,y,w,h,h/2);tctx.fill();
   tctx.fillStyle=fg;tctx.fillText(text,p.x,y+h/2);
   tctx.restore();
 }

 /* ---------- ลูปเฟรม ---------- */
 function hud(now){
   const a=state.active;if(!statusNode)return;
   /* บรรทัดใหญ่บอก "ต้องกดอะไรตอนนี้" อย่างเดียว — แต้มย้ายไปบรรทัดเล็กด้านล่าง
      ระหว่างนับถอยหลังบอกปุ่มไว้ล่วงหน้าด้วย จะได้วางนิ้วรอทัน ไม่ใช่เพิ่งมารู้ตอนเริ่ม */
   const next=lastKey==='f'?'K ▶':lastKey==='k'?'◀ F':'F / K สลับกัน';
   const msg=a.me.bot?(a.countdown>0?'เตรียมตัว':a.settled?(a.won?a.me.name:a.foe.name)+' ชนะ':now<a.freezeUntil?'💥 ท่าไม้ตาย!':'กำลังแข่ง')
            :a.countdown>0?'เตรียมกด F / K สลับกัน'
            :a.settled?(a.won?'ชนะ!':'แพ้')
            :now<a.freezeUntil?'💥 ท่าไม้ตาย!'
            :'กด '+next;
   if(statusNode.textContent!==msg)statusNode.textContent=msg;
   statusNode.classList.toggle('is-countdown',a.countdown>0);
   /* เลขใหญ่กลางจอ: เปลี่ยนทุกวินาที แล้วโชว์ "ดึง!" แวบเดียวตอนเริ่ม
      เล่นแอนิเมชันใหม่เฉพาะตอนตัวเลขเปลี่ยน (ถอดคลาสแล้วใส่คืน) ไม่ใช่ทุกเฟรม */
   const big=a.settled?'':a.countdown>0?String(Math.ceil(a.countdown)):(a.elapsed||0)<.8?'ดึง!':'';
   if(bigCount&&big!==bigCountShown){
     bigCountShown=big;bigCount.textContent=big;bigCount.hidden=!big;
     bigCount.classList.toggle('is-go',big==='ดึง!');
     if(big){bigCount.classList.remove('pop');void bigCount.offsetWidth;bigCount.classList.add('pop');}
   }
   /* ระหว่างนับถอยหลัง ปุ่ม F / K เล่นท่า "โดนกดสลับกัน" ให้ดูก่อนเลยว่าต้องทำอะไร */
   controlsNode?.classList.toggle('is-demo',a.countdown>0&&!a.settled);
   const lead=Math.round(a.rope),left=Math.ceil(timeLeft(a));
   const score=a.settled?'':(lead>0?(a.me.bot?a.me.name+' นำ ':'เรานำ ')+lead:lead<0?(a.me.bot?a.foe.name+' นำ ':'เขานำ ')+(-lead):'เสมอ')+' / '+WIN+' แต้ม'
     +'  ·  เหลือ '+left+' วิ';
   if(scoreNode&&scoreNode.textContent!==score)scoreNode.textContent=score;
   /* 10 วิสุดท้ายเปลี่ยนเป็นสีแดงกะพริบ — หมดเวลาแล้วตัดสินที่ใครนำอยู่ ต้องรู้ตัวว่าใกล้หมด */
   if(scoreNode)scoreNode.classList.toggle('is-urgent',!a.settled&&a.countdown<=0&&left<=10);
   /* เราอยู่ซ้าย: ดึงได้ = ผ้าวิ่งซ้ายในตู้ หมุดบนแถบต้องวิ่งซ้ายตามไปหาโซนเขียวด้วย
      (ถ้าใช้ 50+rope จะกลายเป็นวิ่งไปหาโซนแดงตอนชนะ — สวนทางกับของจริงในตู้) */
   if(marker)marker.style.left=(50-clamp(a.rope,-WIN,WIN)/WIN*50)+'%';
   /* ไฟลุกใหญ่ขึ้นตามพลังที่สะสม (0→1) เต็มเมื่อชาร์จครบ · จบเกมแล้วไฟมอด */
   const ready=charges('me'),fill=ready>0?1:(a.me.total%CHARGE_AT)/CHARGE_AT;
   if(fire)fire.target=a.settled?0:fill;
   if(chargeNode){chargeNode.classList.toggle('ready',ready>0&&!a.settled);
     chargeNode.dataset.count=ready>1?String(ready):'';}
 }
 function camera(now,dt){
   const a=state.active,t=tankOf();if(!t)return;
   const key=TCW+'|'+TCH;
   if(cameraKey!==key){cameraKey=key;
     /* กรอบภาพ = "ช่วงแข่ง" ไม่ใช่ทั้งตู้ — กว้างพอใส่สองฝั่ง+เชือก+ขอบ · สูงพอใส่แถวคนดูบน-ล่าง
        (เดิมหารด้วยความกว้างตู้ทั้งใบ ตู้ยาว 20 ช่องเลยได้ซูมต่ำสุดตลอด มองไม่เห็นรายละเอียดอะไรเลย) */
     /* ⚠️ 2026-09-16 ผู้เล่นขอซูมใกล้กว่านี้: เดิมเผื่อขอบ 6 ช่อง + 150px ตายตัว ทากเลยเล็กนิดเดียว
        ตอนนี้กรอบ = ระยะที่ทากขยับได้จริง (ฝั่งเรา meX ต่ำสุด → ฝั่งเขา foeX สูงสุด) + แถวทีม + ครึ่งตัว
        กล้องจึงเล็งกลางช่วงนั้น (CAM_X) ไม่ใช่กลางระหว่างจุดยืน เพราะฝั่งเราถอยได้น้อยกว่าฝั่งเขา (×.55) */
     const edge=team=>{const b=teamBack(team);return Math.max(...team.map((m,i)=>b[i]+bodyCells(m.genes)/2));};
     const reach=Math.max(edge(teamOf(a.me)),edge(teamOf(a.foe)))+.25;   // ปลายตัวท้ายแถว · โหมดทีมแถวยาวขึ้น กรอบภาพต้องกว้างตาม
     /* ⚠️ 2026-09-17 ผู้เล่น: "ยึดเส้นตรงกลางจากมุมมองผู้เล่น ไม่ใช่ตามพิกัด"
        เส้นกึ่งกลางต้องอยู่กลางจอพอดี กรอบภาพจึงต้องกว้างเท่ากันสองข้างของเส้นกลาง (ใช้ข้างที่ไกลกว่า) */
     const mid=(HOME+AWAY)/2,half=Math.max(mid-(HOME-SHIFT*.55),AWAY+SHIFT-mid)+reach;
     const spanX=2*half*CELLW;
     const spanY=(TUG_LANE[1]-TUG_LANE[0]+ROW_GAP*2+2.5)*DEPY+70;    // เลน + คนดูสองแถวหลังเลน + ขอบ
     tankCam.zoom=clamp(Math.min((TCW-20)/spanX,(TCH-90)/spanY),.55,3.4);}
   /* ตอนใช้ท่าไม้ตาย กล้องวิ่งไปหาฝั่งที่กด ("แสดงฉากฝั่งที่กด") แล้วค่อยกลับมาที่เส้นกลาง */
   const target=now<a.freezeUntil?(a.freezeSide==='me'?a.view.meX:a.view.foeX):(HOME+AWAY)/2;
   a.camX=(a.camX??target)+(target-(a.camX??target))*(1-Math.exp(-dt*6));
   /* แนวนอน: เล็ง "เส้นกลางตรงระดับเชือก" (แนวลึกของเลน) ให้อยู่กลางจอ
      ⚠️ เดิมเล็ง S(camX, VIEW_MID) = จุดหลังเลนที่แถวคนดู ภาพเฉียงดันจุดนั้นไปขวา (DEPX/ช่องลึก)
         เส้นกลางที่เชือกพาดผ่านเลยเยื้องซ้ายของกลางจอ 70–120px ผู้เล่นมองว่าเชือกไม่อยู่ตรงกลาง
      แนวตั้ง: ยังใช้ VIEW_MID (เลน + แถวคนดู) เหมือนเดิม */
   const px=S(a.camX,TUG_LANE_MID,SAND_CELLS),py=S(a.camX,VIEW_MID,SAND_CELLS);
   tankCam.ox+=TCW/2-px.x; tankCam.oy+=TCH*.58-py.y; tankNeedFit=false;
 }
 function updateTankFrame(now){
   const a=state.active;if(!a||!tugUI||document.hidden)return;
   /* ห้าม dt ติดลบ: ถ้าเวลาเฟรมถอยหลัง (นาฬิกาคนละตัวชนกัน) นับถอยหลังจะ "นับขึ้น" แทน */
   const dt=Math.max(0,Math.min(.05,(now-(lastFrame||now))/1000));lastFrame=now;
   advance(now,dt);
   const want=layoutAt(a.rope),v=a.view||(a.view={...want}),k=1-Math.exp(-dt*14);
   v.meX+=(want.meX-v.meX)*k; v.foeX+=(want.foeX-v.foeX)*k; v.cloth+=(want.cloth-v.cloth)*k;
   /* หงอน/หนวดสะบัดตามจังหวะกด: ทุกครั้งที่กดสะบัดสุดไปทางนั้น แล้วค่อยคืนตัว (~0.25 วิ)
      กดรัวสลับ F/K = หงอนโบกหน้า-หลังรัว ๆ พร้อมกันทั้งพุ่ม · ค่าส่งให้ตัววาดผ่าน s.tugLean ใน drawPart
      ⚠️ pullAt เป็นเวลา performance.now() — ต่อเกมจากเซฟเวลาจะเพี้ยน (ติดลบ/เก่ามาก) จึงตัดทิ้งเป็น 0 */
   const lk=1-Math.exp(-dt*28);
   const lean=o=>{const age=now-(o.pullAt||0);return o.pullAt&&age>=0&&age<1500?(o.pullDir||0)*Math.exp(-age/240):0;};
   v.meLean=(v.meLean||0)+(lean(a.me)-(v.meLean||0))*lk;
   v.foeLean=(v.foeLean||0)+(lean(a.foe)-(v.foeLean||0))*lk;
   const back=teamBack(teamOf(a.me));
   myTeam().forEach((s,i)=>{if(s){s.fx=v.meX-back[i];s.fy=TUG_LANE_MID;s.wall=null;s.climbZ=0;}});
   camera(now,dt);hud(now);
   /* ระดับไฟไล่ตามพลังแบบนุ่ม ๆ (ใช้ท่าแล้วพลังตกทันที ไฟจะยุบลงใน ~0.3 วิ ไม่ดับวูบ) */
   if(fire){fire.level+=(fire.target-fire.level)*(1-Math.exp(-dt*8));stepFire(fire,dt);}
   /* คัทซีนวาดใหม่ทุกเฟรมเฉพาะตอนที่มันโชว์อยู่ (1 วิ) หมดเวลาแล้วถอดออกจากจอ ไม่กินงานต่อ */
   if(cutNode){
     if(now<cutUntil)drawCutscene(now);
     else{cutNode.remove();cutNode=cutCanvas=null;cutGenes=null;cutSide=null;}
   }
   if(now-lastSave>1000){saveGame();lastSave=now;}
 }

 window.addEventListener('keydown',e=>{
   if(!tugUI||modal?.open)return;
   if(!state.active||state.active.me.bot)return;
   e.stopImmediatePropagation();
   /* Space ต้อง preventDefault เสมอ ไม่งั้นหน้าเลื่อน หรือไปกดปุ่มที่โฟกัสค้างอยู่ซ้ำอีกรอบ */
   if(['KeyF','KeyK','Space','Escape'].includes(e.code))e.preventDefault();
   if(e.repeat)return;                               // กดค้าง = ครั้งเดียว ไม่ให้รัวฟรี
   if(e.code==='KeyF')press(performance.now(),'f');
   else if(e.code==='KeyK')press(performance.now(),'k');
   else if(e.code==='Space')useCharge('me',performance.now());
 },true);
 document.addEventListener('visibilitychange',()=>{lastFrame=0;if(document.hidden)for(const a of anims){try{a.cancel();}catch(e){}}saveGame();});

 /* ================= ทัวร์นาเมนต์ชักเย่อ (สเปกผู้เล่น 2026-09-17) =================
    จดหมายเชิญ → สมัคร (1,000) → เตรียมตัว 1 นาที ย้ายทาก 3 ตัวลงตู้ชักเย่อ (คนของอีก 7 ทีมทยอยเข้าร้าน)
    → เลือกทีม 3 ตัว → สายแข่ง 8 ทีม 3 ต่อ 3 สุ่มลำดับ: 1v2 · 3v4 · 5v6 · 7v8 → รองชนะเลิศ → ชิงชนะเลิศ
    คู่บอทปะทะบอทแข่งจริงในตู้ (ดูเพื่อพักนิ้ว/เตรียมตัว) กดข้ามได้ · ตกรอบแล้วดูต่อจนจบ (ข้ามได้)
    รางวัลตามอันดับตอนจบ: ที่ 1 = 3,000 · ที่ 2 = 2,000 · ที่ 3–4 = 1,000 · ที่ 5–8 = 0
    ระหว่างทัวร์นาเมนต์: ลูกค้าปกติไม่เข้าใกล้ตู้ชักเย่อ (people.js ถาม SlugTug.reserved) และไม่มีคำท้า 1 ต่อ 1
    สถานะทั้งหมดอยู่ใน G.tug.tour (เซฟ/โหลดต่อได้ทุกขั้น) */
 /* ⚙️ ทดสอบ: จดหมายทุก 10 นาที · ใช้จริง: ทุก 2 ชั่วโมง (ผู้เล่นกำหนด 2026-09-18 · เดิมวันละฉบับ) */
 const TOUR_TEST=false;
 const TOUR_GAP=TOUR_TEST?10*MINUTE:120*MINUTE;
 const TOUR_ENTRY=1000, TOUR_PREP_MS=MINUTE, TOUR_PRIZE={1:3000,2:2000,3:1000};
 const TOUR_ROUNDS=['รอบ 8 ทีม','รอบรองชนะเลิศ','รอบชิงชนะเลิศ'];
 const TOUR_NAMES=['ฉลามทราย','กุ้งมังกร','หมึกยักษ์','ปูเสฉวน','ดาวทะเล','ม้าน้ำทอง','เต่าหิน','ปลาไหลไฟ','หอยมุก','แมงกะพรุน','ทากสายฟ้า','คลื่นยักษ์'];
 let tourPeople=[],tourBar=null;
 const tourOn=()=>!!state.tour&&['prep','bracket'].includes(state.tour.status);
 function geneOfSlug(s){return typeof foodGenes==='function'?foodGenes(s):s.genes;}
 const teamPower=list=>({pull:list.reduce((n,m)=>n+pull(m.genes),0),resist:list.reduce((n,m)=>n+resist(m.genes),0)});
 /* ทีมผู้เล่นใช้ยีน "ตอนนี้" ของทากในตู้ (รวมบัฟอาหาร) ทุกครั้งที่ลงแข่ง · ทีมบอทยีนตายตัวตั้งแต่สมัคร */
 function tourMembers(T){
   if(!T.player)return T.members;
   const t=tank();return (T.ids||[]).map(id=>t?.slugs.find(s=>s.id===id)).filter(Boolean).map(s=>({id:s.id,genes:{...geneOfSlug(s)}}));
 }
 function simulateWin(L,R){
   /* ข้าม = ตัดสินจากอัตราดึงจริงของสองฝั่ง (แต้ม/กด × กด/วิ) บวกดวง ±15% และแต้มที่นำอยู่ตอนกดข้าม */
   const rate=(o,x)=>teamNet(teamOf(o),teamOf(x))*o.cps*(.85+Math.random()*.3);
   const a=state.active,lead=a?a.rope/WIN:0;
   return rate(L,R)*(1+lead*.5)>=rate(R,L)*(1-lead*.5);
 }
 function tourNext(tr){
   for(let i=0;i<4;i++)if(tr.qf[i]==null)return {round:0,slot:i,a:i*2,b:i*2+1};
   for(let i=0;i<2;i++)if(tr.sf[i]==null)return {round:1,slot:i,a:tr.qf[i*2],b:tr.qf[i*2+1]};
   if(tr.final==null)return {round:2,slot:0,a:tr.sf[0],b:tr.sf[1]};
   return null;
 }
 function tourPlace(tr,i){return tr.final===i?1:tr.sf.includes(i)?2:tr.qf.includes(i)?3:5;}
 const playerIdx=tr=>tr.teams.findIndex(T=>T.player);

 /* ---- จดหมายเชิญ ---- */
 /* ⚙️ อายุจดหมายเชิญ · หมดเขตแล้วลบทิ้งเลย ไม่เก็บค้างในกล่องจดหมาย (ผู้เล่นขอ 2026-09-18) */
 const TOUR_MAIL_TTL=TOUR_TEST?3*MINUTE:30*MINUTE;
 function dropTourMail(id){
   if(!id||typeof computerInbox!=='function')return;
   const box=computerInbox(),i=box.findIndex(m=>m.id===id);
   if(i<0)return;
   box.splice(i,1);
   if(G.mailSent)delete G.mailSent[id];
   try{if(typeof renderComputer==='function')renderComputer();}catch(_){}
 }
 /* หมดเขตแล้วลบ + กวาดฉบับเก่าที่ค้างจากเซฟก่อนหน้าออกให้หมด (เหลือเฉพาะฉบับที่ยังสมัครได้/ที่สมัครไปแล้ว) */
 function expireTourMail(){
   const id=state.tourInvite,live=id&&Date.now()<(state.tourInviteUntil||0);
   if(id&&!live&&state.tour?.mailId!==id){dropTourMail(id);state.tourInvite=null;state.tourInviteUntil=0;saveGame();}
   if(typeof computerInbox!=='function')return;
   const keep=new Set([state.tour?.mailId,live?id:null].filter(Boolean));
   for(const m of computerInbox().slice())if(typeof m.id==='string'&&m.id.startsWith('tug-tour-')&&!keep.has(m.id))dropTourMail(m.id);
 }
 function tourMail(){
   if(typeof receiveComputerMessage!=='function'||!tank()||tourOn()||state.active)return;
   if(!Number.isFinite(state.tourNextAt))state.tourNextAt=Date.now()+(TOUR_TEST?MINUTE:TOUR_GAP);
   if(Date.now()<state.tourNextAt)return;
   if(state.tourInvite&&state.tour?.mailId!==state.tourInvite)dropTourMail(state.tourInvite);   // ฉบับเก่าที่ยังค้าง = ลบก่อนส่งฉบับใหม่
   state.tourSeq=(state.tourSeq|0)+1;const id='tug-tour-'+state.tourSeq;
   const ok=receiveComputerMessage({id,type:'online',repeating:true,title:'🏆 เชิญร่วมทัวร์นาเมนต์ชักเย่อ',
     body:'ทัวร์นาเมนต์ชักเย่อ 3 ต่อ 3 · 8 ทีม · แพ้คัดออก\nค่าสมัคร '+TOUR_ENTRY.toLocaleString()+' ทอง\n\nรางวัล\n  ที่ 1 — 3,000 ทอง\n  ที่ 2 — 2,000 ทอง\n  ที่ 3–4 — 1,000 ทอง\n\nสมัครแล้วมีเวลา 1 นาทีให้ย้ายทาก 3 ตัวลงตู้ชักเย่อ แล้วทีมอื่นจะทยอยมาถึงร้าน'});
   state.tourNextAt=Date.now()+TOUR_GAP;
   /* จดหมายทัวร์นาเมนต์มาแล้ว = เลื่อนคำท้า 1 ต่อ 1 ของตู้นี้ออกไปด้วย (ผู้เล่นขอ 2026-09-18) */
   if(ok)reschedule();
   if(ok){state.tourInvite=id;state.tourInviteUntil=Date.now()+TOUR_MAIL_TTL;toast('📨 จดหมายเชิญทัวร์นาเมนต์ชักเย่อมาแล้ว! เปิดดูที่คอมพิวเตอร์ (สมัครได้ '+Math.round(TOUR_MAIL_TTL/MINUTE)+' นาที)','good');}
   saveGame();
 }
 const prevDecorate=window.decorateInboxCard;
 window.decorateInboxCard=function(card,m){
   if(typeof prevDecorate==='function')prevDecorate(card,m);
   if(!m||typeof m.id!=='string'||!m.id.startsWith('tug-tour-'))return;
   const b=element('button','',card);b.className='tbtn';b.style.cssText='display:block;margin-top:10px;font-weight:700';
   const why=state.tour?.mailId===m.id?'สมัครแล้ว ✓'
     :m.id!==state.tourInvite?'หมดเขตสมัครแล้ว'
     :tourOn()||state.active?'มีการแข่งค้างอยู่ รอให้จบก่อน'
     :!tank()?'ต้องวางตู้ชักเย่อในร้านก่อน'
     :G.coin<TOUR_ENTRY?'ทองไม่พอ (ต้องมี '+TOUR_ENTRY.toLocaleString()+')':'';
   b.textContent=why||'สมัคร '+TOUR_ENTRY.toLocaleString()+' ทอง';b.disabled=!!why;
   b.onclick=e=>{e.preventDefault();e.stopPropagation();if(tourRegister(m.id)){b.textContent='สมัครแล้ว ✓';b.disabled=true;try{computerDialog?.close();}catch(_){}}};
 };
 function tourRegister(mailId){
   if(tourOn()||state.active||!tank()||G.coin<TOUR_ENTRY||mailId!==state.tourInvite)return false;
   addCoin(-TOUR_ENTRY);
   if(state.offer){state.offer=null;leave();if(modal)close();}      // คำท้า 1 ต่อ 1 ที่ค้างอยู่ยกเลิกไป
   const pool=TOUR_NAMES.slice().sort(()=>Math.random()-.5);
   const teams=pool.slice(0,7).map(name=>({name,cps:botCps(),members:[0,1,2].map(()=>({genes:SlugEngine.randGene()}))}));
   teams.splice((Math.random()*8)|0,0,{name:'ทีมเรา',player:true,ids:null});
   state.tour={mailId,status:'prep',prepUntil:Date.now()+TOUR_PREP_MS,teams,qf:[null,null,null,null],sf:[null,null],final:null,spawned:0};
   saveGame();syncHUD();tourPeople=[];
   toast('🏆 สมัครแล้ว! มีเวลา 1 นาที ย้ายทาก 3 ตัวลงตู้ชักเย่อ','good');
   renderTourBar();return true;
 }

 /* ---- คนของทีมอื่นทยอยเข้าร้าน (คิวประตูเดียวกับลูกค้า) ---- */
 function tourSpawn(){
   const tr=state.tour;if(!tr||tr.status!=='prep'&&tr.status!=='bracket')return;
   tourPeople=tourPeople.filter(p=>PEOPLE.includes(p));
   if(tourPeople.length>=7||!peopleOn||tankMode||document.hidden||window.BOOTING||!tank())return;
   const capacity=challengerRoom();if(capacity<1)return;
   const previous=new Set(PEOPLE);
   if(!spawnVisitors(capacity,'tug',[{kid:false,gender:Math.random()<.5?'female':'male'}]))return;
   const bots=tr.teams.filter(T=>!T.player),T=bots[tourPeople.length%bots.length];
   for(const p of PEOPLE.filter(q=>!previous.has(q))){
     p.family=null;p.tugChallenger=true;p.tugTour=true;p.wantsBuy=false;p.wantsSell=false;p.tradeDone=true;
     p.carryTank=true;p.carryColor='#35707a';p.carryAccent=slugBaseHex(T.members[0].genes);
     if(typeof makeSlug==='function')p.carrySlug=makeSlug(T.members[0].genes);
     p.bagged=false;p.accessory='none';p.visits=1;p.strolls=0;goal(p);tourPeople.push(p);
   }
 }
 function tourLeave(){
   for(const p of tourPeople){p.tugChallenger=false;p.tugTour=false;p.family=null;p.tradeDone=true;p.visits=0;p.strolls=0;
     p.focus=null;p.route=[];p.routeGoal=null;p.tgt=doorSpot();p.state='leave';p.stuck=0;}
   tourPeople=[];
 }

 /* ---- แถบสถานะหน้าร้าน (เตรียมตัว / ทัวร์นาเมนต์ค้างอยู่) ---- */
 function renderTourBar(){
   const tr=state.tour,show=tourOn()&&!tugUI&&!modal;
   if(!show){if(tourBar)tourBar.hidden=true;return;}
   if(!tourBar){tourBar=element('div',null,document.body);tourBar.className='tug-tour-bar';tourBar.setAttribute('role','status');}
   tourBar.hidden=false;tourBar.replaceChildren();
   const t=tank(),n=t?t.slugs.length:0;
   element('b','🏆 ทัวร์นาเมนต์ชักเย่อ',tourBar);
   if(tr.status==='prep'){
     const left=Math.max(0,Math.ceil((tr.prepUntil-Date.now())/1000));
     element('span',left>0?'เริ่มใน '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0'):'ถึงเวลาแล้ว',tourBar).className='tug-tour-time';
     element('span','ทากในตู้ชักเย่อ '+Math.min(n,3)+'/3'+(n<3?' — ย้ายลงตู้ให้ครบ':''),tourBar).className=n<3?'is-warn':'';
     const b=element('button','เลือกทีม & เริ่ม',tourBar);b.type='button';b.className='tbtn';b.disabled=n<3;b.onclick=tourPick;
   }else{
     element('span','กำลังแข่งอยู่',tourBar);
     const b=element('button','ไปที่ตู้แข่ง',tourBar);b.type='button';b.className='tbtn';b.onclick=()=>{if(t){enterTank(t);showBracket();}};
   }
 }

 /* ---- เลือกทีม 3 ตัว ---- */
 function tourPick(){
   const tr=state.tour,t=tank();if(!tr||tr.status!=='prep'||!t||modal||tugUI)return;
   const d=dialog('เลือกทีมลงทัวร์นาเมนต์',true);d.classList.add('tug-ask');
   d.querySelector('h2').textContent='🏆 เลือกทีมลงทัวร์นาเมนต์';
   const sub=element('p',null,d);sub.className='tug-sub';element('span','ทีมละ 3 ตัว ใช้ทีมนี้ทั้งทัวร์นาเมนต์',sub);element('span','3 ต่อ 3',sub).className='tug-chip';
   const verdict=element('div',null,d);verdict.className='tug-verdict-box';verdict.setAttribute('role','status');
   const pickHead=element('div',null,d);pickHead.className='tug-pick-head';const pickTitle=element('h3','',pickHead);
   const grid=element('div',null,d);grid.className='tug-pick';
   let picked=t.slugs.slice(0,3).map(s=>s.id);
   const actions=element('div',null,d);actions.className='tug-actions';
   const later=element('button','ไว้ก่อน',actions);later.className='tbtn';later.onclick=()=>{close();renderTourBar();};
   const go=element('button','ยืนยันทีม · เริ่มทัวร์นาเมนต์',actions);go.className='tbtn tug-primary';
   const refresh=()=>{
     picked=picked.filter(id=>t.slugs.some(s=>s.id===id));
     const team=picked.map(id=>t.slugs.find(s=>s.id===id)).map(s=>({genes:geneOfSlug(s)})),p=teamPower(team);
     pickTitle.textContent='เลือกทาก '+team.length+'/3';
     verdict.replaceChildren();
     if(t.slugs.length<3){verdict.className='tug-verdict-box is-block';element('b','ทากไม่พอ',verdict);element('span','ตู้ชักเย่อมีแค่ '+t.slugs.length+' ตัว — ย้ายทากลงตู้ให้ครบ 3 ตัว',verdict);}
     else if(team.length<3){verdict.className='tug-verdict-box is-todo';element('b','เลือกอีก '+(3-team.length)+' ตัว',verdict);}
     else{verdict.className='tug-verdict-box is-easy';element('b','พลังรวม ดึง '+p.pull.toFixed(1)+' / ต้าน '+p.resist.toFixed(1),verdict);}
     go.disabled=team.length!==3;
   };
   const draw=()=>SlugHover.cards(grid,{slugs:t.slugs,selected:picked,multi:true,empty:'ยังไม่มีทากในตู้ชักเย่อ',
     sub:s=>{const g=geneOfSlug(s);return 'ดึง '+pull(g).toFixed(1)+' · ต้าน '+resist(g).toFixed(1);},
     onPick:s=>{if(picked.includes(s.id))picked=picked.filter(x=>x!==s.id);else{picked.push(s.id);if(picked.length>3)picked.shift();}refresh();return picked;}});
   go.onclick=()=>{
     if(picked.length!==3)return;
     tr.teams[playerIdx(tr)].ids=picked.slice();tr.status='bracket';saveGame();
     close();renderTourBar();enterTank(t);showBracket();
   };
   draw();refresh();
 }

 /* ---- สายแข่ง + คู่ถัดไป ---- */
 function teamCard(host,T,cls){
   const s=element('div',null,host);s.className='tug-side '+cls;
   element('h3',T.player?'ทีมเรา':T.name,s);
   const list=tourMembers(T),p=teamPower(list),stat=element('p',null,s);stat.className='tug-power';
   element('span','ดึง ',stat);element('b',p.pull.toFixed(1),stat);element('span',' / ต้าน ',stat);element('b',p.resist.toFixed(1),stat);
   const row=element('div',null,s);row.className='tug-slots';
   for(const m of list){const b=element('div',null,row);b.className='tug-slot';const c=element('canvas',null,b);c.width=180;c.height=112;c.setAttribute('aria-hidden','true');try{drawSlugPortrait(c,{genes:m.genes});}catch(e){}}
 }
 function showBracket(){
   const tr=state.tour;if(!tr||tr.status!=='bracket'||modal||state.active)return;
   const t=tank();if(!t)return;
   if(!tankMode||curTank!==t)enterTank(t);
   const n=tourNext(tr);if(!n){showTourResult();return;}
   const me=playerIdx(tr),mine=n.a===me||n.b===me;
   const d=dialog('ทัวร์นาเมนต์ชักเย่อ',true);d.classList.add('tug-ask','tug-bracket');
   d.querySelector('h2').textContent='🏆 ทัวร์นาเมนต์ชักเย่อ';
   const sub=element('p',null,d);sub.className='tug-sub';element('span',TOUR_ROUNDS[n.round]+(n.round===0?' · คู่ที่ '+(n.slot+1):n.round===1?' · คู่ที่ '+(n.slot+1):''),sub);element('span','3 ต่อ 3',sub).className='tug-chip';
   /* คู่ถัดไป: ทีมเราอยู่ซ้ายเสมอ (ตรงกับตอนแข่ง) */
   let L=n.a,R=n.b;if(R===me){L=n.b;R=n.a;}
   /* จอกว้าง: ซ้าย = คู่ถัดไป + ปุ่ม · ขวา = ผังสายแข่ง (ไม่ต้องเลื่อนจอ) · จอแคบ CSS เรียงลงมาแบบย่อ */
   const main=element('div',null,d);main.className='tug-br-main';const left=element('div',null,main);left.className='tug-br-left';
   const vs=element('section',null,left);vs.className='tug-vs';
   teamCard(vs,tr.teams[L],tr.teams[L].player?'is-me':'is-foe');element('div','VS',vs).className='tug-vs-mark';teamCard(vs,tr.teams[R],'is-foe');
   const note=element('div',null,left);note.className='tug-verdict-box '+(mine?'is-ok':'is-todo');
   element('b',mine?'ถึงคิวทีมเรา':'คู่นี้ไม่มีทีมเรา',note);
   element('span',mine?'เตรียมนิ้วให้พร้อม':'ดูไว้พักนิ้ว/ดูฝีมือคู่แข่ง หรือข้ามไปก็ได้',note);
   /* ผังสายแข่งย่อ */
   const br=element('div',null,main);br.className='tug-br';
   const name=i=>i==null?'—':tr.teams[i].player?'ทีมเรา':tr.teams[i].name;
   const col=(title,pairs,winners)=>{const c=element('div',null,br);c.className='tug-br-col';element('h4',title,c);
     pairs.forEach(([x,y],k)=>{const box=element('div',null,c);box.className='tug-br-pair'+(n.round===pairs.round&&k===n.slot?' is-next':'');
       for(const i of [x,y]){const r=element('div',name(i),box);r.className='tug-br-team'+(i===me?' is-me':'')+(winners[k]!=null?(winners[k]===i?' is-win':' is-out'):'');}});};
   const qfPairs=[[0,1],[2,3],[4,5],[6,7]];qfPairs.round=0;
   const sfPairs=[[tr.qf[0],tr.qf[1]],[tr.qf[2],tr.qf[3]]];sfPairs.round=1;
   const fPairs=[[tr.sf[0],tr.sf[1]]];fPairs.round=2;
   col('รอบ 8 ทีม',qfPairs,tr.qf);col('รองชนะเลิศ',sfPairs,tr.sf);col('ชิงชนะเลิศ',fPairs,[tr.final]);
   const actions=element('div',null,left);actions.className='tug-actions';
   const pause=element('button','พักไว้ก่อน',actions);pause.className='tbtn tug-quiet';pause.onclick=()=>{close();exitTank();renderTourBar();};
   if(mine){
     const go=element('button','เริ่มแข่ง',actions);go.className='tbtn tug-primary';go.onclick=()=>startTourMatch(n,L,R);
   }else{
     const skip=element('button','⏭ ข้ามคู่นี้',actions);skip.className='tbtn';
     skip.onclick=()=>{const A=tourSide(tr.teams[L]),B=tourSide(tr.teams[R]);state.active=null;recordTour(n,simulateWin(A,B)?L:R);close();showBracket();};
     const watch=element('button','ดูการแข่ง',actions);watch.className='tbtn tug-primary';watch.onclick=()=>startTourMatch(n,L,R);
   }
 }
 function tourSide(T){
   const team=tourMembers(T);
   return T.player?{id:team[0]?.id,name:'ทีมเรา',genes:team[0]?.genes,team,total:0,used:0,sneezeUntil:0}
     :{bot:true,name:T.name,genes:team[0].genes,team:team.map(m=>({genes:m.genes})),cps:T.cps,total:0,used:0,sneezeUntil:0,nextPressAt:0};
 }
 function startTourMatch(n,L,R){
   const tr=state.tour,t=tank();if(!tr||!t)return;
   const left=tourSide(tr.teams[L]),right=tourSide(tr.teams[R]);
   if(!left.bot&&left.team.length<3){close();toast('ทีมเราหายจากตู้ชักเย่อ — แพ้ฟาวล์คู่นี้','bad');recordTour(n,R);showBracket();return;}
   state.active={tankId:t.id,rope:0,countdown:3,freezeUntil:0,freezeSide:null,settled:false,won:null,
     camX:(HOME+AWAY)/2,view:layoutAt(0),elapsed:0,size:3,tour:{round:n.round,slot:n.slot,left:L,right:R},me:left,foe:right};
   saveGame();close();openMatch();
 }
 function recordTour(n,winner){
   const tr=state.tour;if(!tr)return;
   if(n.round===0)tr.qf[n.slot]=winner;else if(n.round===1)tr.sf[n.slot]=winner;else tr.final=winner;
   saveGame();
 }
 function tourMatchDone(){
   const a=state.active,tr=state.tour;if(!a?.tour||!tr)return;
   const n={round:a.tour.round,slot:a.tour.slot};
   recordTour(n,a.won?a.tour.left:a.tour.right);
   const t=tankOf();
   if(t)for(const s of t.slugs){delete s._tugSpot;delete s.tugLean;delete s.tugStrain;s.state='rest';s.stt=.5;}
   state.active=null;close();saveGame();
   showBracket();
 }
 function showTourResult(){
   const tr=state.tour;if(!tr||modal)return;
   const me=playerIdx(tr),place=tourPlace(tr,me),prize=TOUR_PRIZE[place]||0;
   if(!tr.paid){tr.paid=true;tr.prize=prize;addCoin(prize);if(place===1)window.questTourWin?.();saveGame();syncHUD();}   // tr.paid กันนับซ้ำให้อยู่แล้ว
   const d=dialog('ผลทัวร์นาเมนต์',true);d.classList.add('tug-ask','tug-tour-result');
   d.querySelector('h2').textContent=place===1?'🏆 แชมป์ทัวร์นาเมนต์!':'🏁 จบทัวร์นาเมนต์';
   const big=element('p',place===1?'อันดับ 1':place===2?'อันดับ 2':place===3?'อันดับ 3–4':'อันดับ 5–8',d);big.className='tug-tour-place';
   element('p',(tr.prize>0?'รางวัล +'+tr.prize.toLocaleString()+' ทอง':'ไม่ได้รางวัล')+(place===1?'':' · แชมป์คือ '+tr.teams[tr.final].name),d).className='tug-sub';
   const actions=element('div',null,d);actions.className='tug-actions';
   const done=element('button','กลับร้าน',actions);done.className='tbtn tug-primary';
   /* จบทัวร์นาเมนต์แล้ว จดหมายฉบับนั้นหมดประโยชน์ = ลบทิ้งด้วย */
   done.onclick=()=>{dropTourMail(tr.mailId);if(state.tourInvite===tr.mailId){state.tourInvite=null;state.tourInviteUntil=0;}
     state.tour=null;tourLeave();close();exitTank();saveGame();renderTourBar();};
   if(place===1)fireworks(d);
 }
 function tourTick(){
   const tr=state.tour;
   expireTourMail();
   if(!tr){tourMail();renderTourBar();return;}
   if(!tank()){renderTourBar();return;}                               // ตู้ถูกเก็บ = ทัวร์นาเมนต์ค้างไว้จนกว่าจะวางคืน
   tourSpawn();
   if(tr.status==='prep'&&!tr.autoPick&&Date.now()>=tr.prepUntil&&!modal&&!tugUI&&!state.active&&!(tankMode&&curTank!==tank())){tr.autoPick=true;tourPick();}
   else if(tr.status==='bracket'&&!state.active&&!modal&&tankMode&&curTank===tank())showBracket();
   renderTourBar();
 }

 window.SlugTug={purchased,goal,drawChallengers,drawLane,isOpen:()=>!!modal?.open,
   /* ตู้ชักเย่อถูกจองระหว่างทัวร์นาเมนต์ — people.js ไม่ส่งลูกค้าปกติไปดูตู้นี้ */
   /* ผู้ท้าแข่ง (1 ต่อ 1) ยืนรออยู่ที่ตู้ หรือกำลังมีทัวร์นาเมนต์ = ตู้นี้ไม่ให้ลูกค้าปกติมาดู */
   reserved:o=>!!o?.def?.tug&&(tourOn()||visitors.some(p=>PEOPLE.includes(p))),tour:()=>state.tour,
   isPulling:t=>!!tugUI&&!!state.active&&(!t||t.id===state.active.tankId),
   spectatorSlugs,stepSpectators,tugItems,drawUnder,drawPart,updateTankFrame,pull,resist,net,botCps,REF_CPS,WIN};

 /* แมตช์ค้างจากเซฟเก่า: ต้องมีครบทั้งสองฝั่งไม่งั้นทิ้ง */
 if(!state.active||!state.active.me||!state.active.foe||!Number.isFinite(state.active.rope))state.active=null;
 if(owned())purchased();
 resumeReady=true;setInterval(tick,1000);
})();
