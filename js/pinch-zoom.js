/* ============================================================
   pinch-zoom.js — ซูมด้วยสองนิ้วบนจอสัมผัส (ผู้เล่นสั่ง 2026-09-20)
   "ในโทรศัพท์ทำให้ซูมหรือขยายได้โดยที่ไม่ต้องกด + − ใช้สองนิ้วซูมเอา"

   ใช้ร่วมกันทั้ง 3 ที่ที่ซูมได้: หน้าร้าน (cv) · ในตู้ (tankCv) · สมุดบันทึกสายพันธุ์
   ทั้งสามเก็บค่าซูมคนละตัวแปรและคนละสูตร จึงรับเป็น callback ไม่ใช่ไปยุ่งกับตัวแปรตรง ๆ

   วิธีใช้
     PinchZoom.attach(element, {
       active : ()=>boolean   ไม่ส่ง = เปิดตลอด (เช่นในตู้ต้องเช็กว่ามี curTank ก่อน)
       zoom   : ()=>number    อ่านค่าซูมปัจจุบัน
       apply  : (z,cx,cy)=>{} ตั้งค่าซูมใหม่ โดยยึดจุด (cx,cy) ซึ่งเป็นพิกัดในกรอบ element
       pan    : (dx,dy)=>{}   ไม่ส่ง = สองนิ้วซูมอย่างเดียวเหมือนเดิม
                              ส่งมา = เลื่อนสองนิ้วพร้อมกันก็เลื่อนฉากได้ด้วย (dx,dy = จุดกึ่งกลางขยับไปเท่าไร)
     })
   ⚠️ หน้าร้านต้องมี pan เพราะตอนถือของบนมือถือ นิ้วเดียว = ขยับโกส (shop-floor.js ghostDrag)
      ถ้าไม่มีทางเลื่อนฉากด้วยสองนิ้ว จะเล็งจุดวางที่อยู่นอกจอไม่ได้เลย

   ⚠️ ต้องดักในเฟส capture และ stopImmediatePropagation ตอนมีสองนิ้ว
      ไม่งั้นตัวจัดการ "ลากเลื่อนจอ" เดิมของแต่ละหน้าจะทำงานพร้อมกัน แล้วภาพจะสะบัดตามนิ้ว
   ⚠️ ต้องตั้ง touch-action ของ element เป็น none ด้วย (ทำให้ใน attach เลย)
      ไม่งั้นเบราว์เซอร์กินท่าสองนิ้วไปซูมทั้งหน้าเว็บแทน
   ⚠️ ปล่อยนิ้วกลับมาเหลือหนึ่ง = ต้องกลืนอีเวนต์ต่อจนปล่อยครบ ไม่งั้นนิ้วที่เหลือ
      จะถูกตีความเป็น "ลากเลื่อนจอ" กระโดดไปไกล ๆ ทันทีที่ยกนิ้วแรกออก
   ============================================================ */
const PinchZoom=(()=>{
 const MIN_START=18;         // ระยะสองนิ้วขั้นต่ำตอนเริ่ม (px) — ต่ำกว่านี้อัตราส่วนจะแกว่งจนภาพกระตุก

 function attach(el,opt){
  if(!el||el._pinchZoom)return el;el._pinchZoom=true;
  const pts=new Map();
  let base=0,baseZoom=1,pinching=false,swallow=0,mid=null;

  const spread=()=>{
   const [a,b]=[...pts.values()];
   return {d:Math.hypot(a.x-b.x,a.y-b.y),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};
  };
  const local=e=>{const r=el.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
  const on=()=>!opt.active||opt.active();

  el.addEventListener('pointerdown',e=>{
   if(e.pointerType!=='touch'||!on())return;
   pts.set(e.pointerId,local(e));
   if(pts.size===2){
    const s=spread();
    if(s.d>=MIN_START){pinching=true;base=s.d;baseZoom=opt.zoom();mid={x:s.cx,y:s.cy};}
   }
   if(pinching)stop(e);
  },true);

  el.addEventListener('pointermove',e=>{
   if(e.pointerType!=='touch'||!pts.has(e.pointerId))return;
   pts.set(e.pointerId,local(e));
   if(!pinching||pts.size<2)return;
   stop(e);
   const s=spread();
   /* เลื่อนก่อน ค่อยซูม — เลื่อนสองนิ้วพร้อมกันระยะห่างไม่เปลี่ยน opt.apply() จะไม่ขยับอะไรเลย */
   if(opt.pan&&mid)opt.pan(s.cx-mid.x,s.cy-mid.y);
   mid={x:s.cx,y:s.cy};
   if(!(s.d>0)||!(base>0))return;
   opt.apply(baseZoom*(s.d/base),s.cx,s.cy);
  },true);

  const release=e=>{
   if(e.pointerType!=='touch')return;
   if(!pts.delete(e.pointerId))return;
   if(!pinching)return;
   /* ยังเหลือนิ้วอยู่บนจอ = กลืนอีเวนต์ต่อ กันนิ้วที่เหลือกลายเป็นการลากเลื่อนจอ */
   if(pts.size>0){swallow=pts.size;stop(e);return;}
   pinching=false;swallow=0;mid=null;stop(e);
  };
  el.addEventListener('pointerup',release,true);
  el.addEventListener('pointercancel',release,true);
  /* นิ้วที่ค้างอยู่หลังจบการซูม — กลืนทั้ง move และ up จนยกครบ */
  el.addEventListener('pointermove',e=>{if(swallow&&e.pointerType==='touch')stop(e);},true);

  el.style.touchAction='none';
  return el;
 }
 return {attach};
})();
