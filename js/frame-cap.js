/* ============================================================
   frame-cap.js — ตัวคุมจังหวะเฟรม (ผู้เล่นขอ 2026-09-22: "30FPS ก็ได้ แค่ทำให้ลื่น
   ไม่กระตุก โทรศัพท์กากเล่นได้ก็พอ")

   ทำไมต้องมี — วัดบนเครื่องผู้เล่นได้ว่า "เกมวาด" อยู่ที่ 11–14.5 ms จากงบ 16.7 ms
   คือคาเส้นพอดี เฟรมไหนหนักนิดเดียวก็หลุด → p50 เด้งสลับ 16.9 ↔ 33.0 ms ระหว่างการอ่านสองครั้งติดกัน
   และ "การสลับไปมา" นี่แหละที่ตาอ่านว่ากระตุก — แย่กว่าอยู่ที่ 30 นิ่ง ๆ ด้วยซ้ำ
   เพราะระยะห่างระหว่างเฟรมไม่สม่ำเสมอ ภาพเลยดูสะดุดทั้งที่ค่าเฉลี่ยดูดี

   วิธีคุม — นับเป็น "จำนวนรอบจอ" ไม่ใช่มิลลิวินาที
   ถ้าวาดทุก 2 รอบจอของจอ 60Hz จะได้ 33.33 ms เป๊ะทุกเฟรม ไม่มีทางเหลื่อม
   ส่วนการเช็กด้วยนาฬิกา (now-last>=33.3) จะพลาดเป็นครั้งคราวแล้วกระโดดเป็น 50 ms
   ซึ่งคือการกระตุกที่เรากำลังจะกำจัด จึงใช้ stride เป็นจำนวนเต็มเสมอ

   ลดเองได้เมื่อเครื่องไม่ไหว — จอ 60Hz: stride 2 = 30 fps · 3 = 20 · 4 = 15
   ทุกค่าเป็นจำนวนเต็มรอบจอ จึงนิ่งเท่ากันหมด ต่างกันแค่ความถี่
   เครื่องอืด (มือถือกาก) จะไหลลงไปอยู่ 20 หรือ 15 แบบ "นิ่ง" แทนที่จะเด้งสลับ

   ⚠️ ตัดสินจาก "เวลาที่ใช้วาดจริง" เท่านั้น ห้ามใช้ระยะห่างระหว่างเฟรม
      เพราะพอล็อกเฟรมแล้ว ระยะห่างจะเท่ากับคาบเป้าหมายเสมอ เอามาตัดสินไม่ได้
   ⚠️ ไม่แตะ simulation — ทากยังเดิน ลูกค้ายังเดิน นาฬิกายังนับตามเวลาจริง
      ของพวกนั้นมีตัวจับเวลาของตัวเอง (setInterval) แยกจากการวาดอยู่แล้ว
   ============================================================ */
(()=>{
 const KEY='frameCap', MIN_FPS=15, MAX_STRIDE=4;
 let capFps=30;                                  // ค่าที่ผู้เล่นเลือก (30 = ค่าเริ่มต้นตามที่ขอ)
 try{ const v=parseInt(localStorage.getItem(KEY),10); if(v>0)capFps=v; }catch(e){}

 /* คาบรอบจอจริงของเครื่องนี้ — จอ 60Hz ได้ ~16.7 · จอ 120/144Hz ได้ ~8.3/6.9
    ⚠️ ห้ามใช้ "ค่าน้อยสุดที่เคยเห็น" — ลองแล้วพัง: ค่ามันลงได้ทางเดียว พอมีรอบที่มาไวผิดปกติ
       สักครั้ง (จิตเตอร์ของ timer หรือเบราว์เซอร์ยิงชดเชย) ค่าจะค้างต่ำถาวร แล้ว stride บวมขึ้นเรื่อย ๆ
       = เกมช้าลงกว่าที่ผู้เล่นตั้งไว้โดยไม่มีใครรู้ (เจอตอนทดสอบ: ตั้ง 30 แต่ได้ stride 3 = 20 fps)
       ตอนนี้เป็น EMA สองทาง ขยับช้า ๆ และตัดค่าที่หลุดกรอบทิ้งก่อน */
 let vsync=16.7, prev=0;
 function noteTick(now){
  if(prev){
   const d=now-prev;
   if(d>4&&d<40){ vsync+=(d-vsync)*0.05; vsync=Math.max(5,Math.min(34,vsync)); }
  }
  prev=now;
 }

 /* งานวาดจริงต่อเฟรม (EMA) — ลูปเป็นคนป้อนให้ผ่าน FrameCap.noteWork() */
 let workEMA=8, overrun=0, under=0, extra=0;      // extra = stride ที่บวกเพิ่มเองเพราะเครื่องไม่ไหว
 function baseStride(){
  if(capFps>=999)return 1;
  return Math.max(1,Math.min(MAX_STRIDE,Math.round((1000/capFps)/vsync)));
 }
 function stride(){ return Math.min(MAX_STRIDE,baseStride()+extra); }
 function slotMs(){ return stride()*vsync; }

 function noteWork(ms){
  workEMA += (Math.min(ms,200)-workEMA)*0.12;
  const slot=slotMs();
  /* เกินงบช่องเวลาติดกันหลายเฟรม = เครื่องไม่ไหวจริง ค่อยถอยลงหนึ่งขั้น (ไม่ใช่เด้งทันทีจากเฟรมหนักเฟรมเดียว)
     ว่างสบายติดกันนาน ๆ ค่อยไต่กลับขึ้น — ขาขึ้นตั้งเกณฑ์ไว้ต่ำกว่าขาลงมาก กันการสลับขึ้นลงไม่จบ */
  if(workEMA>slot*0.85){ overrun++; under=0; }
  else if(workEMA<slot*0.45){ under++; overrun=0; }
  else { overrun=0; under=0; }
  const minFpsStride=Math.max(1,Math.min(MAX_STRIDE,Math.round((1000/MIN_FPS)/vsync)));
  if(overrun>45&&baseStride()+extra<minFpsStride){ extra++; overrun=0; }
  else if(under>180&&extra>0){ extra--; under=0; }
 }

 /* ลูปเรียกทุกรอบจอ — คืน true เฉพาะรอบที่ถึงคิววาด
    แต่ละลูป (หน้าร้าน/ในตู้) นับของตัวเอง เพราะสลับโหมดแล้วต้องเริ่มนับใหม่ ไม่งั้นเฟรมแรกหลังสลับจะดีเลย์ */
 const counters=Object.create(null);
 function due(name,now){
  noteTick(now);
  const s=stride();
  if(s<=1)return true;
  const n=(counters[name]=(counters[name]||0)+1);
  if(n<s)return false;
  counters[name]=0;return true;
 }
 function reset(name){ counters[name]=0; }

 function setFps(v){
  capFps=v; extra=0; overrun=0; under=0;
  try{ localStorage.setItem(KEY,String(v)); }catch(e){}
  syncBtn();
 }

 /* ---------- ปุ่มในแท็บ ⚙ ตั้งค่า (แบบเดียวกับปุ่มทาก 3D / ตัววัด FPS) ---------- */
 const CHOICES=[30,60,999];
 function label(v){ return v>=999?'ไม่จำกัด':v+''; }
 function syncBtn(){
  const b=document.getElementById('bFrameCap'); if(!b)return;
  const auto=extra>0?' (เครื่องไม่ไหว ลดเองเหลือ ~'+Math.round(1000/slotMs())+')':'';
  b.textContent='🎞️ จำกัดเฟรม: '+label(capFps)+auto;
  b.title='วาดทุก '+stride()+' รอบจอ — จังหวะสม่ำเสมอกว่าปล่อยเต็มที่ และกินพลังน้อยลงตามส่วน';
 }
 function mount(){
  const panel=document.querySelector('[data-panel="settings"]');
  if(!panel){ setTimeout(mount,400); return; }
  if(document.getElementById('bFrameCap')){ syncBtn(); return; }
  const b=document.createElement('button');
  b.className='tbtn'; b.id='bFrameCap'; b.type='button';
  b.onclick=()=>{ const i=CHOICES.indexOf(capFps); setFps(CHOICES[(i+1)%CHOICES.length]); };
  const after=document.getElementById('bFps');
  if(after&&after.parentElement===panel)after.after(b); else panel.append(b);
  syncBtn();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);
 else mount();
 setInterval(syncBtn,2000);                      // ป้ายบอกตอนมันลดเองให้ผู้เล่นรู้ (ถูกมาก ไม่ใช่งานต่อเฟรม)

 window.FrameCap={
  due, reset, noteWork,
  get fps(){ return capFps; },
  get stride(){ return stride(); },
  get intervalMs(){ return slotMs(); },
  get workMs(){ return workEMA; },
  get vsyncMs(){ return vsync; },
  set:setFps
 };
})();
