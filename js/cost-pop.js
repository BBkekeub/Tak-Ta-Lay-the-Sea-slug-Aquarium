/* ============================================================
   cost-pop.js — ตัวเลขเงินลอยขึ้นตรงจุดที่ทำรายการ (ผู้เล่นสั่ง 2026-09-21)
   "มีเอฟเฟค -ราคาสีเหลืองตรงที่ที่วางของด้วย"

   ใช้กับ: วางของ/ตู้ · ทาสีพื้น · ทาสีกำแพง · เก็บของคืนเงิน
   เรียก  : CostPop.at(cellX, cellY, -200)      พิกัดเป็น "ช่องเล็ก" ของพื้นร้าน
            CostPop.at(cellX, cellY, +150)      บวก = สีเขียว (ได้เงิน)

   ⚠️ กฎประสิทธิภาพ (AGENTS.md ข้อ 5): ตอนไม่มีตัวเลขค้างอยู่ ลิสต์ว่าง
      draw() จึง return ทันที ไม่มีงานต่อเฟรมเพิ่มเลยตอนเล่นปกติ
   ⚠️ ไม่ใช้ DOM/setTimeout — วาดบนแคนวาสเดียวกับร้าน จะได้เลื่อน/ซูมตามกล้องไปด้วย
      (ถ้าเป็น <div> ลอยทับ พอแพนกล้องแล้วตัวเลขจะค้างที่เดิม ไม่ติดกับพื้นที่วางของ)
   ⚠️ ทาสีลากทีเดียวได้หลายสิบช่อง — ถ้าปล่อยให้เด้งทุกช่องจะรกจอและกินเฟรม
      จึงรวมยอดให้เองถ้าจุดใกล้กัน (MERGE_CELL) ภายในเวลาสั้น ๆ
   ============================================================ */
const CostPop = (() => {
  const LIFE = 1.0;        // วินาทีที่ตัวเลขอยู่บนจอ
  const RISE = 34;         // ลอยขึ้นกี่พิกเซล (จอ) ตลอดอายุ
  const MAX  = 24;         // กันล้นตอนลากทาสียาว ๆ
  /* ⚠️ หน่วยเป็น "ช่องเล็ก" — ช่องใหญ่ติดกันห่างกัน SUB (10) ช่องเล็ก
     ถ้าตั้งน้อยกว่า 10 จะไม่มีวันรวมกันเลยตอนลากทาสีทีละช่อง (เคยพลาดมาแล้ว) */
  const MERGE_CELL = 18;   // ≈ 1.8 ช่องใหญ่ — ลากต่อเนื่องรวมเป็นก้อนเดียว คลิกคนละมุมยังแยกกัน
  const MERGE_T = 0.45;    // ตัวเดิมต้องอายุไม่เกินเท่านี้ถึงจะรวมได้

  const items = [];
  let last = 0;

  function at(cx, cy, amount, z = 0) {
    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(amount) || !amount) return;
    for (const it of items) {
      if (it.t < MERGE_T && Math.abs(it.cx - cx) < MERGE_CELL && Math.abs(it.cy - cy) < MERGE_CELL
          && Math.sign(it.amount) === Math.sign(amount)) {
        /* รวมยอด + ย้ายมาที่ช่องล่าสุด → เห็นเป็นตัวเลขเดียววิ่งตามพู่กันแล้วนับเพิ่มขึ้นเรื่อย ๆ
           (ถ้าไม่ย้าย ตัวเลขจะค้างที่ช่องแรกแล้วดูเหมือนไม่เกี่ยวกับที่กำลังทาอยู่) */
        it.amount += amount; it.cx = cx; it.cy = cy; it.z = z; it.t = 0;
        return;
      }
    }
    items.push({ cx, cy, z, amount, t: 0 });
    if (items.length > MAX) items.splice(0, items.length - MAX);
  }

  function draw() {
    if (!items.length) return;                       // ไม่มีอะไรค้าง = ไม่มีงานต่อเฟรม
    const now = performance.now();
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.t += dt;
      if (it.t >= LIFE) { items.splice(i, 1); continue; }
      const k = it.t / LIFE;
      /* ขึ้นเร็วตอนแรกแล้วค่อย ๆ ช้าลง (ease-out) · จางหายในช่วง 35% สุดท้าย */
      const rise = RISE * (1 - Math.pow(1 - k, 2));
      const alpha = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
      const p = P(it.cx, it.cy, it.z);
      const text = (it.amount < 0 ? '−' : '+') + Math.abs(Math.round(it.amount)).toLocaleString();
      const size = Math.max(13, Math.min(22, 15 * cam.zoom));
      ctx.font = 'bold ' + size.toFixed(1) + 'px "IBM Plex Sans Thai",sans-serif';
      ctx.globalAlpha = alpha;
      /* ขอบเข้มรอบตัวอักษร — พื้นร้านเป็นสีขาวแล้ว ตัวเหลืองล้วนจะอ่านไม่ออก */
      ctx.lineWidth = Math.max(3, size * 0.26);
      ctx.strokeStyle = 'rgba(12,22,26,0.85)';
      ctx.lineJoin = 'round';
      ctx.strokeText(text, p.x, p.y - rise);
      ctx.fillStyle = it.amount < 0 ? '#FFD34E' : '#8BE59B';   // จ่าย = เหลือง · ได้รับ = เขียว
      ctx.fillText(text, p.x, p.y - rise);
    }
    ctx.restore();
  }

  /* ตอนไม่มีตัวเลขค้าง ต้องรีเซ็ตนาฬิกา ไม่งั้นครั้งถัดไป dt จะเป็นก้อนใหญ่ (หายไปทันทีที่เด้ง) */
  function idle() { if (!items.length) last = 0; }

  return { at, draw, idle, get count() { return items.length; } };
})();
