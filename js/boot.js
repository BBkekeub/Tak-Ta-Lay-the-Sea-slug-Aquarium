/* ============================================================
   boot.js — หน้าโหลด: อบอาร์ตให้เสร็จก่อนค่อยเข้าเกม
   โหลด "ท้ายสุด" (หลัง save.js) เพราะต้องรู้ก่อนว่าเซฟมีทากกี่ตัว/ของตกแต่งอะไร

   ปัญหาที่แก้ — ตอนเข้าเกมค้างเป็นวินาที
   ทาก 1 ตัวต้องระบาย gradient-map + แสง + ประกาย ≈ 95 ms และงานนี้ทำ
   "ตอนถูกวาดครั้งแรก" ฉาก 60 ตัวจึงยิงรวดเดียวในเฟรมเดียว = จอค้าง ~5.7 วินาที (วัดแล้ว)
   ทางแก้ไม่ใช่ทำให้เร็วขึ้น แต่ย้ายมาทำ "ก่อนเข้าเกม" แล้วซอยเป็นก้อนละ ~24 ms
   คั่นด้วย requestAnimationFrame — หน้าโหลดจึงยังขยับและเดินแถบความคืบหน้าได้

   ⚠️ ระหว่างนี้ `window.BOOTING = true` และ `loop()` ใน shop-floor.js จะข้ามการวาด
      ไม่งั้นลูปจะไปแตะทากก่อนแล้วอบทีเดียวรวดเหมือนเดิม
   ============================================================ */
window.BOOTING = true;

(function(){
  const box  = document.getElementById('boot');
  if(!box){ window.BOOTING = false; return; }              // ไม่มี overlay = เข้าเกมตามปกติ
  const fill = document.getElementById('bootFill');
  const tx   = document.getElementById('bootTx');

  let done = 0, total = 1;
  const draw = msg => {
    if(fill) fill.style.width = Math.min(100, Math.round(done/Math.max(1,total)*100)) + '%';
    if(msg && tx) tx.textContent = msg;
  };
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));

  /* โหลดรูปให้ "ถอดรหัสเสร็จจริง" ไม่ใช่แค่ดาวน์โหลดจบ — ถ้าไม่เรียก decode()
     ต้นทุนถอดรหัส (PNG อาหารใบละ ~1 MB) จะไปโผล่ที่เฟรมแรกที่วาดมันแทน */
  const loadImg = src => new Promise(res => {
    const im = new Image();
    const fin = () => (im.decode ? im.decode() : Promise.resolve()).catch(()=>{}).then(res);
    im.onload = fin; im.onerror = () => res();
    im.src = src;
  });

  function allSlugs(){
    const out = [];
    (G.objs||[]).concat(G.shelter||[]).forEach(o => { if(o && o.slugs) out.push(...o.slugs); });
    (G.inv||[]).forEach(s => out.push(s));
    return out;
  }

  async function run(){
    const t0 = performance.now();
    try{
      draw('กำลังโหลดอาร์ตทาก…');
      await SlugEngine.ready;                       // อาร์ตในเอนจิน (data URI ~2.8 MB)

      /* รูปพื้นผิว + รูปอาหาร · ของตกแต่งปล่อยให้ decorImg() ตัวเดิมโหลด แค่สั่งให้เริ่มก่อน */
      const urls = ['assets/sand.jpg','assets/wood.jpg','assets/marble.jpg','assets/granite.jpg'];
      if(typeof FOOD_TYPES === 'object')
        Object.keys(FOOD_TYPES).forEach(k => urls.push('assets/food/' + k + '.png'));
      const dkeys = new Set();
      (G.objs||[]).concat(G.shelter||[]).forEach(o => (o.decor||[]).forEach(d => dkeys.add(d.key)));
      dkeys.forEach(k => { try{ decorImg(k); }catch(_){} });

      const list = allSlugs();
      total = urls.length + list.length + 1;
      done  = 1; draw('กำลังโหลดพื้นผิวและรูปประกอบ…');
      for(const u of urls){ await loadImg(u); done++; draw(); }

      /* ก้อนที่แพงจริง — อบทีละตัว ยอมพักทุก ~24 ms ให้หน้าโหลดได้หายใจ */
      let t = performance.now(), i = 0;
      draw('กำลังอบสไปรต์ทาก 0/' + list.length + '…');
      for(const s of list){
        try{ slugPartsOf(s); slugSprite(s); }catch(_){}
        done++; i++;
        if(performance.now() - t > 24){
          draw('กำลังอบสไปรต์ทาก ' + i + '/' + list.length + '…');
          await frame(); t = performance.now();
        }
      }
      done = total; draw('พร้อมแล้ว');
      console.log('[boot] พร้อมใน ' + Math.round(performance.now()-t0) + ' ms · ทาก ' + list.length + ' ตัว');
    }catch(e){
      console.warn('[boot] อบไม่ครบ เข้าเกมเลย', e);      // พังตรงไหนก็ต้องเข้าเกมได้เสมอ
    }
    await frame();
    window.BOOTING = false;
    if(typeof fitCamera === 'function') fitCamera();
    box.classList.add('gone');
    setTimeout(() => box.remove(), 420);
  }

  if(document.readyState === 'complete') run();
  else window.addEventListener('load', run);
})();
