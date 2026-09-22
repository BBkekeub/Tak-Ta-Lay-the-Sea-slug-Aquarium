/* ============================================================
   fps-meter.js — ป้าย FPS ในหน้าตั้งค่า (ผู้เล่นขอ 2026-09-22: "รู้สึกกระตุก")
   ⚙️ ปุ่มเปิด/ปิดอยู่ในแท็บ ⚙ ตั้งค่า · จำค่าไว้ใน localStorage (เป็นค่าของเครื่อง ไม่ใช่ของเซฟ)

   ทำไมไม่โชว์แค่ FPS เฉลี่ย: หนังสือกฎหมวด 5 บอกว่า "ห้ามตัดสินด้วย FPS สูงสุดอย่างเดียว
   ต้องดู p50/p95/p99 หรือ spike" — อาการ "กระตุก" คือเฟรมนาน ๆ แทรกเป็นครั้งคราว
   ค่าเฉลี่ยจะกลบมันมิด ป้ายนี้จึงโชว์:
     FPS    = จำนวนเฟรมจริงในวินาทีที่ผ่านมา
     p50    = เฟรมปกติใช้เวลากี่ ms (ครึ่งหนึ่งเร็วกว่านี้)
     p95/p99= เฟรมที่ช้าที่สุด 5% / 1% ใช้เวลาเท่าไร ← ตัวนี้แหละที่รู้สึกเป็นการกระตุก
     สะดุด  = จำนวนเฟรมที่ใช้เวลาเกิน JANK_MS ในช่วง 3 วินาทีล่าสุด
   สีป้าย: เขียว = ลื่น · เหลือง = เริ่มสะดุด · แดง = กระตุกชัด

   ⚠️ ปิดอยู่ = ไม่มี rAF ไม่มี DOM ไม่มีงานต่อเฟรมแม้แต่นิดเดียว (ยกเลิก rAF จริง ไม่ใช่แค่ return)
   ⚠️ แท็บซ่อน = หยุดวัด แล้วเริ่มนับใหม่ตอนกลับมา ไม่งั้นค่าที่ได้เป็นเฟรมที่เบราว์เซอร์หรี่ไว้ ไม่ใช่ของจริง
   ============================================================ */
(()=>{
 const KEY='fpsMeter', WINDOW_MS=3000, JANK_MS=50;
 let on=false, raf=0, last=0, samples=[], box=null, lastPaint=0;
 /* ⚠️ 2026-09-22 ผู้เล่นวัดแล้ว p95 ค้างที่ 33 ms ทุกครั้งแม้ลดงาน JS ลงหลายรอบ
    ต้องแยกให้ออกว่า "เกมใช้เวลาวาดเท่าไร" กับ "เฟรมห่างกันเท่าไร" — ถ้างานวาดน้อยแต่เฟรมยังห่าง
    แปลว่าคอขวดอยู่ที่ GPU/การประกอบภาพของเบราว์เซอร์ ไม่ใช่โค้ดเกม แก้คนละทางกันเลย
    ⚠️ drawFloor ถูกห่อโดย tile-paint.js ทีหลัง จึงต้องห่อ "ตอนกดเปิดตัววัด" ไม่ใช่ตอนโหลดไฟล์ */
 let work=0, wrapped=null, origDrawFloor=null, origDrawTank=null;
 /* ⚠️ 2026-09-22 รอบสอง: "เกมวาด" อย่างเดียวยังตอบไม่ได้ว่าเวลาหายไปไหน
    วัดบนเครื่องผู้เล่นได้ว่า เมนเธรดไม่ว่าง 85–96% แต่ป้ายบอกเกมวาดแค่ ~20 ms จาก 33 ms
    → ต้องแยกยอดให้เห็นว่าก้อนไหนใหญ่ ไม่งั้นแก้มั่ว · ยอดที่แยก:
      คน   = สร้างท่า + วาดเลเยอร์ลูกค้า (people.js)
      3D   = เรนเดอร์ฉาก Three.js ของของตกแต่ง/ทาก 3D (decor-glb.js)
      ของ  = วาดตู้/ของในร้านทีละชิ้น (drawObject)
      เดิน = simulation ของทากในตู้และลูกค้า
      รอคิว = ระยะเวลาจนข้อความได้รับการประมวลผล รวมเวลารอของเบราว์เซอร์ด้วย ไม่ใช่ CPU time
               วัดด้วยการส่งข้อความหาตัวเองท้ายเฟรม แล้วดูว่ากว่าจะวิ่งกลับมาใช้เวลาเท่าไร */
 const BUCKETS=[
  ['คน',  ['drawPerson','endPersonBatch','drawPersonShadow']],
  ['ของ', ['drawObject']],
  ['เดิน',['stepTankSlugs','stepPeople']]
 ];
 const BUCKET_KEYS=BUCKETS.map(b=>b[0]).concat(['3D']);
 let bucket={}, poseBuilds=0, otherMs=0, chan=null, since=0;
 const hooks=[];                                 // {owner,name,orig} — คืนของเดิมตอนปิดตัววัด
 function resetBuckets(){bucket={};for(const k of BUCKET_KEYS)bucket[k]=0;}
 function hookInto(owner,name,key){
  const fn=owner&&owner[name];
  if(typeof fn!=='function')return;
  hooks.push({owner,name,orig:fn});
  owner[name]=function(){const t=performance.now();try{return fn.apply(this,arguments);}finally{bucket[key]+=performance.now()-t;}};
 }
 function hookDraw(){
  if(wrapped)return;
  resetBuckets();
  const tag=(fn)=>function(...a){const t=performance.now();try{return fn.apply(this,a);}finally{work+=performance.now()-t;}};
  if(typeof window.drawFloor==='function'){origDrawFloor=window.drawFloor;window.drawFloor=tag(origDrawFloor);}
  if(typeof window.drawTank==='function'){origDrawTank=window.drawTank;window.drawTank=tag(origDrawTank);}
  for(const [key,names] of BUCKETS)for(const n of names)hookInto(window,n,key);
  hookInto(window.DecorGLB,'endShop','3D');
  hookInto(window.DecorGLB,'endTank','3D');
  if(!chan){chan=new MessageChannel();chan.port1.onmessage=e=>{otherMs+=performance.now()-e.data;};}
  wrapped=true;
 }
 function unhookDraw(){
  if(!wrapped)return;
  if(origDrawFloor)window.drawFloor=origDrawFloor;
  if(origDrawTank)window.drawTank=origDrawTank;
  while(hooks.length){const h=hooks.pop();h.owner[h.name]=h.orig;}
  if(chan){chan.port1.onmessage=null;chan=null;}
  origDrawFloor=origDrawTank=null;wrapped=null;
 }
 try{ on=localStorage.getItem(KEY)==='1'; }catch(e){}

 function ensureBox(){
  if(box)return box;
  box=document.createElement('div');
  box.id='fpsMeter';
  box.style.cssText='position:fixed;left:10px;bottom:10px;z-index:60;pointer-events:none;'
   +'font:600 12px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre;'
   +'padding:6px 10px;border-radius:8px;background:rgba(10,20,24,.86);border:1px solid #2f4a52;color:#dff1ea';
  document.body.append(box);
  return box;
 }
 function stop(){
  if(raf)cancelAnimationFrame(raf);
  raf=0;last=0;samples.length=0;
  box?.remove();box=null;
 }
 function pct(sorted,p){
  if(!sorted.length)return 0;
  const i=Math.min(sorted.length-1,Math.max(0,Math.round((sorted.length-1)*p)));
  return sorted[i];
 }
 function paint(now){
  const cut=now-WINDOW_MS;
  while(samples.length&&samples[0].t<cut)samples.shift();
  if(now-lastPaint<250)return;                 // อัปเดตข้อความ 4 ครั้ง/วินาทีพอ ไม่เขียน DOM ทุกเฟรม
  lastPaint=now;
  const ms=samples.map(s=>s.ms).sort((a,b)=>a-b);
  const inLastSec=samples.filter(s=>s.t>now-1000).length;
  const jank=samples.filter(s=>s.ms>JANK_MS).length;
  const p50=pct(ms,.5),p95=pct(ms,.95),p99=pct(ms,.99);
  const w=samples.map(s=>s.work).sort((a,b)=>a-b);
  const w50=pct(w,.5),w95=pct(w,.95);
  const el=ensureBox();
  /* ยอดที่แยกไว้ต้องมาจาก "หน้าต่างเดียวกับ p50" ไม่งั้นเทียบกันไม่ได้ (เคยเผลอใช้คนละช่วงแล้วยอดย่อยรวมเกินยอดใหญ่)
     จึงเก็บยอดของแต่ละเฟรมติดไปกับตัวอย่างเฟรมนั้น แล้วค่อยเฉลี่ยทั้งหน้าต่าง 3 วินาทีตอนวาดป้าย */
  const frames=Math.max(1,samples.length), secs=Math.max(.001,(now-since)/1000);
  const sum={};for(const k of BUCKET_KEYS)sum[k]=0;let otherSum=0;
  for(const s of samples){for(const k of BUCKET_KEYS)sum[k]+=s.b[k];otherSum+=s.other;}
  const per=k=>(sum[k]/frames).toFixed(1);
  const ppl=window.PeoplePerf&&window.PeoplePerf.poseBuilds;
  const builds=(typeof ppl==='number')?(ppl-poseBuilds):0;
  if(typeof ppl==='number')poseBuilds=ppl;
  const workers=(window.PeoplePerf&&window.PeoplePerf.workers)|0;
  const txt='FPS '+inLastSec
   +'   p50 '+p50.toFixed(1)+' ms\n'
   +'p95 '+p95.toFixed(1)+'   p99 '+p99.toFixed(1)+' ms\n'
   +'เกมวาด '+w50.toFixed(1)+' ms (p95 '+w95.toFixed(1)+')'
     +'  รอคิว '+(otherSum/frames).toFixed(1)+'\n'
   +'คน '+per('คน')+' · 3D '+per('3D')+' · ของ '+per('ของ')+' · เดิน '+per('เดิน')+'\n'
   +'ท่าใหม่ '+Math.round(builds/secs)+'/วิ · เธรดช่วย '+(workers||'ไม่มี')+'\n'
   +'สะดุด >'+JANK_MS+'ms: '+jank+' ครั้ง/3 วิ';
  since=now;
  if(el.textContent!==txt)el.textContent=txt;
  const color=jank>3||p95>33?'#ff8a7a':(jank>0||p95>20?'#ffd36b':'#9fe3a6');
  if(el.style.color!==color){el.style.color=color;el.style.borderColor=color+'66';}
 }
 function frame(now){
  if(!on)return;
  if(document.hidden){ last=0; samples.length=0; raf=requestAnimationFrame(frame); return; }
  if(last)samples.push({t:now,ms:now-last,work:work,b:bucket,other:otherMs});
  bucket={};for(const k of BUCKET_KEYS)bucket[k]=0;otherMs=0;   // ถังใหม่ของเฟรมถัดไป (ถังเก่าติดไปกับตัวอย่าง)
  work=0;                                   // เริ่มนับงานวาดของเฟรมถัดไป
  last=now;
  paint(now);
  /* ส่งข้อความหาตัวเองท้ายเฟรม — กว่ามันจะวิ่งกลับมาได้ เมนเธรดต้องเคลียร์งานที่คิวอยู่ก่อน
     ค่านี้คือเวลารอคิว ไม่ใช่เวลาที่ CPU ทำงาน และห้ามบวกกับเวลาวาดเพื่อสรุป main-thread utilization */
  if(chan)chan.port2.postMessage(performance.now());
  raf=requestAnimationFrame(frame);
 }
 function apply(){
  if(on){ hookDraw(); if(!raf){last=0;lastPaint=0;work=0;raf=requestAnimationFrame(frame);} }
  else { stop(); unhookDraw(); }
  const b=document.getElementById('bFps');
  if(b)b.textContent='📈 ตัววัด FPS: '+(on?'เปิด':'ปิด');
 }
 function toggle(){
  on=!on;
  try{ localStorage.setItem(KEY,on?'1':'0'); }catch(e){}
  apply();
 }
 /* ปุ่มลงไปอยู่ในแท็บตั้งค่า (context-ui.js สร้าง panel นี้ตอนโหลด) */
 function mount(){
  const panel=document.querySelector('[data-panel="settings"]');
  if(!panel){ setTimeout(mount,400); return; }
  if(document.getElementById('bFps')){ apply(); return; }
  const b=document.createElement('button');
  b.className='tbtn';b.id='bFps';b.type='button';
  b.title='โชว์ FPS และเฟรมที่ช้าที่สุด (p95/p99) ไว้หาต้นเหตุอาการกระตุก';
  b.onclick=toggle;
  /* วางต่อจากปุ่มสลับทาก 3D ถ้ามี — สองอันนี้เป็นเรื่องภาพ/ประสิทธิภาพเหมือนกัน */
  const after=document.getElementById('bSlug3D');
  if(after&&after.parentElement===panel)after.after(b);else panel.append(b);
  apply();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);
 else mount();
 document.addEventListener('visibilitychange',()=>{ if(!document.hidden){last=0;samples.length=0;} });
 window.FpsMeter={on:()=>on,toggle,show(){if(!on)toggle();},hide(){if(on)toggle();}};
})();
