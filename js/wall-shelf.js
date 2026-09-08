/* ============================================================
   wall-shelf.js — ชั้นวางติดผนัง 2 ชั้น ชั้นละ 3 ช่อง (รวม 6 ช่อง)
   ทากที่ "ลงขายในตลาดโลก" จะมาโผล่เป็นตู้เล็กบนชั้นนี้ ช่องละตัว เรียงตามลำดับที่ลงขาย
   ตัวไหนขายได้ จะขึ้นเหรียญ 💰 ลอยเหนือช่องนั้น — กดเพื่อรับเงิน (ไม่เข้าเงินอัตโนมัติ)

   วางเหมือนประตู: กดปุ่มในโหมดก่อสร้าง แล้วคลิกกำแพงเหนือ/ตะวันตก (สองด้านที่กล้องเห็น)
   เก็บใน G.shelf = {side:'north'|'west', offset:คอลัมน์} — เข้าเซฟ

   หน่วย: u = ช่องเล็ก (5 ซม.) · SUB ช่องเล็ก = 1 คอลัมน์ = 40 ซม. · z = ZUNIT ต่อ 5 ซม.
   ============================================================ */

const SHELF_PER_TIER = 3;                 // กล่องต่อหนึ่งชั้น
const SHELF_TIERS    = 2;                 // จำนวนชั้น
const SHELF_SLOTS    = SHELF_PER_TIER * SHELF_TIERS;   // = 6 · ผูกกับ MAX_LIST ในตลาดโลก
/* ---- ขนาดจริงเป็นเซนติเมตร (hardcode ตามสเปก · 1 ช่องเล็ก = 5 ซม. · ZUNIT = 5 ซม. ในแกน z) ---- */
const _cm  = v => v / CM_PER_CELL;             // ซม. → ช่องเล็ก (แกน u / d)
const _cmZ = v => (v / CM_PER_CELL) * ZUNIT;   // ซม. → world-z
const SHELF_W    = _cm(120);              // แผ่นชั้นยาว 120 ซม. (ใช้เป็น footprint การวางด้วย)
const SHELF_D    = _cm(20);               // ลึก 20 ซม. (ยื่นจากผนัง)
const SHELF_T    = _cmZ(4);               // หนาแผ่นชั้น 4 ซม.
/* ระยะห่างระหว่างสองชั้น — ต้องเผื่อ "ความลึก" ด้วย ไม่ใช่แค่ความสูงกล่อง
   ในภาพไอโซ ความลึก 1 หน่วยดันภาพลงมาเท่ากับความสูงครึ่งหน่วย (ZUNIT = 2*TH)
   กล่องลึก 20 ซม. + ครึ่งความกว้าง 10 ซม. จึงกินความสูงบนจอเพิ่มอีก (20+10)/2 = 15 ซม.
   ระยะขั้นต่ำ = หนาแผ่น 4 + สูงกล่อง 20 + 15 = 39 ซม. -> ใช้ 42 เผื่อไว้
   ถ้าน้อยกว่านี้ มุมบน-หลังของกล่องชั้นล่างจะไปทับขอบล่างของแผ่นชั้นบนบนจอ */
const SHELF_GAP_CM = 42;
const SHELF_Z    = [_cmZ(140), _cmZ(140 + SHELF_GAP_CM)];   // ใต้แผ่นชั้นล่าง/บน วัดจากพื้น (ซม.)
const SHELF_BOX  = _cm(20);               // กล่องโชว์ทากลูกบาศก์ 20×20×20 ซม.
const SHELF_BOX_H = _cmZ(20);
const SLOT_U_CM  = [100, 70, 40];         // กึ่งกลางกล่องจากขอบซ้าย เรียง 'ขวา→ซ้าย' — ตัวแรกลงช่องขวาสุด (เริ่มนับจากทากขวา) ไล่เข้าหาป้ายทางซ้าย
const SIGN_U_CM  = 15;                     // กึ่งกลางป้ายจากขอบซ้าย (กว้าง 20 → 5..25 · ห่างขอบซ้าย 5 · ห่างกล่องแรก 5)
const SIGN_LEN   = _cm(20);               // ป้าย A-frame ยาว 20 ซม.
const SIGN_H     = _cmZ(11);              // ความสูงป้าย ~11 ซม.

/* ตำแหน่งบนกำแพง: u = ระยะตามแนวกำแพง · d = ระยะยื่นเข้ามาในห้อง · z = ความสูง */
function shelfPt(side, u, z, d = 0) { return side === 'north' ? P(u, d, z) : P(d, u, z); }

/* ตรวจว่าชั้นวางที่บันทึกไว้ยังอยู่ในกำแพงจริงไหม (กันเซฟเก่า/พื้นที่ร้านหดลง) */
function shelfRect(s = G.shelf) {
  if (!s || !['north', 'west'].includes(s.side) || !Number.isInteger(s.offset)) return null;
  const edge = s.side === 'north' ? cellsW() : cellsH();
  if (s.offset < 0 || s.offset + SHELF_W > edge) return null;
  return { side: s.side, offset: s.offset, w: SHELF_W };
}
function shelfSlotCount() { return shelfRect() ? SHELF_SLOTS : 0; }

/* ช่องที่ i (0..5): ชั้นล่างก่อน ซ้าย→ขวา แล้วต่อชั้นบน */
function shelfSlotAt(i) {
  const r = shelfRect(); if (!r || i < 0 || i >= SHELF_SLOTS) return null;
  const tier = Math.floor(i / SHELF_PER_TIER), col = i % SHELF_PER_TIER;
  return { side: r.side, u: r.offset + _cm(SLOT_U_CM[col]), z: SHELF_Z[tier] + SHELF_T, tier, col };
}

/* ---------- วาด ---------- */
/* หน้าสี่เหลี่ยมบนระนาบใดก็ได้ของกำแพง — รับจุดเป็น [u,z,d] */
function shelfFace(side, pts, fill, stroke) {
  ctx.beginPath();
  pts.forEach((v, i) => { const p = shelfPt(side, v[0], v[1], v[2] || 0); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
/* กล่องสี่เหลี่ยมยื่นออกจากกำแพง — วาดครบทั้ง 6 ด้าน เป็นกล่องทึบจริง ๆ
   ของเดิมวาดแค่ 3 ด้านที่ "คิดว่า" กล้องเห็น แล้วเดาปลายจาก side (north->u1 / west->u0)
   ซึ่งผิด: ในภาพไอโซนี้ความลึกบนจอคือ x+y ทั้งสองกำแพงจึงเห็นปลาย u1 เหมือนกัน
   ผนังตะวันตกเลยมีด้านโหว่ · วาดครบ 6 ด้านแล้วไม่ต้องเดา ไม่มีรูไม่ว่าหันมุมไหน
   ลำดับ ไกล->ใกล้: ล่าง · ปลาย u0 · หลัง d0 · บน · ปลาย u1 · หน้า d1 */
function shelfBox(side, u0, u1, z0, z1, d0, d1, top, front, sideCol, stroke) {
  const dim = (c, k) => {                       // ด้านที่หันหนีกล้องทำให้เข้มลง เผื่อโผล่ตรงขอบ
    if (typeof c !== 'string' || c[0] !== '#' || c.length !== 7) return c;
    const v = i => Math.max(0, Math.round(parseInt(c.substr(i, 2), 16) * k)).toString(16).padStart(2, '0');
    return '#' + v(1) + v(3) + v(5);
  };
  shelfFace(side, [[u0, z0, d0], [u1, z0, d0], [u1, z0, d1], [u0, z0, d1]], dim(top, .45), stroke);    // ล่าง
  shelfFace(side, [[u0, z1, d0], [u0, z1, d1], [u0, z0, d1], [u0, z0, d0]], dim(sideCol, .6), stroke); // ปลายไกล
  shelfFace(side, [[u0, z1, d0], [u1, z1, d0], [u1, z0, d0], [u0, z0, d0]], dim(front, .6), stroke);   // หลัง
  shelfFace(side, [[u0, z1, d0], [u1, z1, d0], [u1, z1, d1], [u0, z1, d1]], top, stroke);              // บน
  shelfFace(side, [[u1, z1, d0], [u1, z1, d1], [u1, z0, d1], [u1, z0, d0]], sideCol, stroke);          // ปลายใกล้
  shelfFace(side, [[u0, z1, d1], [u1, z1, d1], [u1, z0, d1], [u0, z0, d1]], front, stroke);            // หน้า
}

let _shelfHits = [];      // [{i, x,y,right,bottom}] สำหรับกดรับเงิน
function drawWallShelf(preview) {
  const s = preview || G.shelf, r = shelfRect(s);
  if (!r) { if (!preview) _shelfHits = []; return; }
  if (!preview) _shelfHits = [];
  const side = r.side, u0 = r.offset, u1 = r.offset + SHELF_W;
  ctx.save();
  ctx.globalAlpha = preview ? .7 : 1;
  ctx.lineWidth = Math.max(.5, cam.zoom * .9);

  for (let tier = 0; tier < SHELF_TIERS; tier++) {
    const z = SHELF_Z[tier];
    // ฉากหลังบาง ๆ ให้ชั้นดูติดผนังจริง ไม่ลอย
    shelfFace(side, [[u0, z, 0], [u1, z, 0], [u1, z + SHELF_T, 0], [u0, z + SHELF_T, 0]], 'rgba(12,16,18,.35)');
    shelfBox(side, u0, u1, z, z + SHELF_T, 0, SHELF_D, '#2a2e33', '#15181b', '#1f2327', 'rgba(0,0,0,.5)');
    /* ฉากยึดผนัง 2 ตัว — ต้อง "ซ่อนอยู่ใต้แผ่นชั้น" ไม่ใช่โผล่พ้นขอบหน้าลงมาเป็นตุ่ม
       ของเดิมลึก 12 ซม. หย่อนลง 10 ซม. -> ในภาพไอโซมันโผล่ต่ำกว่าขอบหน้าของแผ่น เห็นเป็นก้อนห้อย
       เกณฑ์: จุดต่ำสุดของฉากต้องไม่ต่ำกว่าขอบหน้า-ล่างของแผ่นบนจอ
         (u+dฉาก)*TH - หย่อน  >=  (u+SHELF_D)*TH - 0   ->   หย่อน <= (SHELF_D - dฉาก)*TH
       ฉากจึงต้องชิดผนัง (ตื้น) และหย่อนไม่เกินค่านั้น (ใช้ 85% เผื่อขอบเส้น) */
    const BR_D = _cm(5), BR_HW = _cm(1.5), BR_DROP = Math.max(0, (SHELF_D - BR_D) * TH * 0.85);
    for (const f of [0.18, 0.82]) {
      const bu = u0 + SHELF_W * f;
      shelfBox(side, bu - BR_HW, bu + BR_HW, z - BR_DROP, z, 0, BR_D, '#23272c', '#1a1d21', '#1e2126');
    }
  }
  if (preview) { ctx.restore(); return; }

  /* ตู้เล็กของทากที่ลงขายอยู่ — เรียงตามลำดับใน listings
     วาดตู้ให้ครบก่อน แล้วค่อยวาดเหรียญทั้งหมด ไม่งั้นตู้ช่องหลังจะทับเหรียญของช่องหน้า */
  const list = (typeof WorldMarket === 'object' && WorldMarket.market) ? (WorldMarket.market().listings || []) : [];
  const coins = [];
  for (let i = 0; i < Math.min(SHELF_SLOTS, list.length); i++) {
    const slot = shelfSlotAt(i); if (!slot) continue;
    if (drawShelfTank(slot, list[i], i)) coins.push([slot, list[i], i]);
  }
  for (const [slot, L, i] of coins) drawShelfCoin(slot, L, i);
  for (let tier = 0; tier < SHELF_TIERS; tier++) drawShelfSign(r, tier);   // ป้าย Online ทั้งสองชั้น (วาดท้ายสุด)
  ctx.restore();
}

const _shelfSlugCache = new Map();       // key ของ listing → ทากชั่วคราวไว้เรนเดอร์สไปรต์
function shelfSlug(L) {
  let s = _shelfSlugCache.get(L.key);
  if (!s) {
    try { s = (typeof _loadSlug === 'function' && L.slug) ? _loadSlug(L.slug) : makeSlug(L.genes); }
    catch (e) { s = null; }
    if (s) _shelfSlugCache.set(L.key, s);
  }
  if (_shelfSlugCache.size > 40) _shelfSlugCache.clear();
  return s;
}
function drawShelfTank(slot, L, i) {
  const side = slot.side, hw = SHELF_BOX / 2, z0 = slot.z, z1 = z0 + SHELF_BOX_H;
  const d0 = (SHELF_D - SHELF_BOX) / 2, d1 = d0 + SHELF_BOX;
  const sold = !!L.soldAt;
  const baseH = .6 * ZUNIT;                                  // ฐานตู้ทึบ (สูงจากพื้นชั้น)
  /* วาดของ "ทึบ" ให้ครบก่อน (ผนังหลัง + ฐาน) แล้วค่อยวางทาก ทากจะได้ไม่โดนโครงตู้/คานทับ
     ปิดท้ายด้วยกระจกหน้า+ฝาบน (โปร่งใส) ที่วางทับทากได้โดยยังเห็นทากทะลุ */
  ctx.globalAlpha = .28;
  shelfFace(side, [[slot.u - hw, z0, d0], [slot.u + hw, z0, d0], [slot.u + hw, z1, d0], [slot.u - hw, z1, d0]], '#7fc4e8');   // ผนังกระจกด้านไกล
  ctx.globalAlpha = 1;
  shelfBox(side, slot.u - hw, slot.u + hw, z0, z0 + baseH, d0, d1, '#2b3a42', '#1d282e', '#243138', 'rgba(0,0,0,.5)');        // ฐานตู้ทึบ
  // ทาก: ย่อให้พอดี "ภายในตู้" (เหนือฐาน) วางกึ่งกลาง — วาดหลังฐาน จึงไม่โดนตัดครึ่งตัว
  const s = shelfSlug(L);
  if (s && typeof slugSprite === 'function') {
    try {
      const sp = slugSprite(s);
      const innerH = (SHELF_BOX_H - baseH) * cam.zoom;                 // ความสูงภายในตู้ (px บนจอ)
      const innerW = SHELF_BOX * TW * cam.zoom * 1.7;                  // ความกว้างหน้าตู้โดยประมาณ (px)
      const scale = Math.min(innerW * .92 / sp.c.width, innerH * .92 / sp.c.height);
      const w = sp.c.width * scale, h = sp.c.height * scale;
      const c = shelfPt(side, slot.u, z0 + baseH + (SHELF_BOX_H - baseH) * .5, (d0 + d1) / 2);
      ctx.globalAlpha = sold ? .5 : 1;
      ctx.drawImage(sp.c, c.x - w / 2, c.y - h / 2, w, h);
      ctx.globalAlpha = 1;
    } catch (e) { }
  }
  // กระจกด้านหน้า + ฝาบน (โปร่งใส) — วาดหลังทาก
  ctx.globalAlpha = .20;
  shelfFace(side, [[slot.u - hw, z0, d1], [slot.u + hw, z0, d1], [slot.u + hw, z1, d1], [slot.u - hw, z1, d1]], '#cfe9f6');   // กระจกด้านหน้า
  ctx.globalAlpha = 1;
  shelfFace(side, [[slot.u - hw, z1, d0], [slot.u + hw, z1, d0], [slot.u + hw, z1, d1], [slot.u - hw, z1, d1]], 'rgba(150,200,220,.16)', 'rgba(180,220,240,.35)');   // ฝาบน

  return sold;
}
/* ขายได้แล้ว — เหรียญลอยเหนือตู้ กดเพื่อรับเงิน (วาดหลังตู้ทุกใบ จะได้ไม่โดนทับ) */
function drawShelfCoin(slot, L, i) {
  const side = slot.side, hw = SHELF_BOX / 2, z1 = slot.z + SHELF_BOX_H;
  const d0 = (SHELF_D - SHELF_BOX) / 2, d1 = d0 + SHELF_BOX;
  const p = shelfPt(side, slot.u, z1 + 3.0 * ZUNIT, (d0 + d1) / 2);
  const rad = Math.max(13, 19 * cam.zoom), pulse = Math.sin(performance.now() / 240);
  ctx.save(); ctx.translate(p.x, p.y - 3 * pulse);
  ctx.fillStyle = '#f1c66d'; ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a6a2c'; ctx.lineWidth = Math.max(1, cam.zoom); ctx.stroke();
  ctx.fillStyle = '#56352a'; ctx.font = 'bold ' + Math.max(15, 22 * cam.zoom) + 'px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('฿', 0, 1);
  ctx.restore();
  _shelfHits.push({ i, key: L.key, x: p.x - rad - 6, y: p.y - rad - 9, right: p.x + rad + 6, bottom: p.y + rad + 3 });
}

/* ป้าย A-frame สามเหลี่ยม (แบบตั้งโต๊ะสำนักงาน) ยาว 20 ซม. เขียน "Online" — วางซ้ายสุดของชั้น ทั้งสองชั้น */
function drawShelfSign(r, tier) {
  const side = r.side, uc = r.offset + _cm(SIGN_U_CM), z0 = SHELF_Z[tier] + SHELF_T;
  const u0 = uc - SIGN_LEN / 2, u1 = uc + SIGN_LEN / 2;
  const dB = 0.7, dF = SHELF_D - 0.7, dC = (dB + dF) / 2, zA = z0 + SIGN_H;
  // หน้าลาดด้านผนัง→สัน · หน้าลาดด้านกล้อง→สัน · ปลายสามเหลี่ยมสองข้าง
  shelfFace(side, [[u0, z0, dB], [u1, z0, dB], [u1, zA, dC], [u0, zA, dC]], '#7a2f2f', 'rgba(0,0,0,.35)');
  shelfFace(side, [[u0, z0, dF], [u1, z0, dF], [u1, zA, dC], [u0, zA, dC]], '#d0473f', 'rgba(0,0,0,.35)');
  shelfFace(side, [[u0, z0, dB], [u0, z0, dF], [u0, zA, dC]], '#9c3a34');
  shelfFace(side, [[u1, z0, dB], [u1, z0, dF], [u1, zA, dC]], '#9c3a34');
  /* ข้อความ Online — เอียงให้อยู่ในระนาบเดียวกับหน้าป้ายที่ลาดเอียง
     แมป unit ของหน้าป้าย (u = แนวยาว · slope = ฐาน→สัน) ลงเป็นเมทริกซ์ affine
     หน้าป้ายเป็น parallelogram บนจอ (P เป็น affine) จึงแมปตรง ๆ ได้ */
  let Au = u0, Bu = u1;
  let A = shelfPt(side, Au, z0, dF), B = shelfPt(side, Bu, z0, dF);
  if (B.x < A.x) { const t1 = Au; Au = Bu; Bu = t1; const t2 = A; A = B; B = t2; }   // ให้ตัวอักษรไล่ไปทางขวาจอเสมอ (กันกลับด้านบนกำแพงตะวันตก)
  const D = shelfPt(side, Au, zA, dC);
  const ux = B.x - A.x, uy = B.y - A.y, vx = D.x - A.x, vy = D.y - A.y;
  const Lu = Math.hypot(ux, uy) || 1, Lv = Math.hypot(vx, vy) || 1;
  const cxp = A.x + ux * .5 + vx * .5, cyp = A.y + uy * .5 + vy * .5;               // กึ่งกลางหน้าป้าย
  ctx.save();
  // local(px บนหน้าป้าย) → CSS px : แกน x = Û · แกน y = -V̂ (canvas y ลงล่าง) แล้วคูณ DPR
  ctx.setTransform(DPR * ux / Lu, DPR * uy / Lu, DPR * -vx / Lv, DPR * -vy / Lv, DPR * cxp, DPR * cyp);
  let fs = Lv * 0.6;
  ctx.font = 'bold ' + fs + 'px sans-serif';
  const tw = ctx.measureText('Online').width, maxTW = Lu * 0.86;
  if (tw > maxTW) { fs *= maxTW / tw; ctx.font = 'bold ' + fs + 'px sans-serif'; }
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Online', 0, 0);
  ctx.restore();
}

/* ---------- กดรับเงิน ---------- */
let shelfPointer = null;
cv.addEventListener('pointerdown', e => { shelfPointer = { x: e.clientX, y: e.clientY }; }, true);
cv.addEventListener('pointerup', e => {
  const down = shelfPointer; shelfPointer = null;
  if (typeof appMode !== 'undefined' && appMode !== 'view') return;
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
  if (!_shelfHits.length) return;
  const { sx, sy } = screenXY(e);
  const hit = _shelfHits.find(h => sx >= h.x && sx <= h.right && sy >= h.y && sy <= h.bottom);
  if (!hit) return;
  e.stopImmediatePropagation(); dragging = false; cv.classList.remove('panning', 'placing');
  if (typeof WorldMarket === 'object' && WorldMarket.collectSold) WorldMarket.collectSold(hit.key);
}, true);

/* ---------- วางชั้นบนกำแพง (ล้อแบบเดียวกับประตูใน entrance.js) ---------- */
let placingShelf = false, shelfHover = null, shelfDown = null;
registerMode('shelfPlace', 'floor', () => placingShelf, () => { placingShelf = false; shelfHover = null; shelfDown = null; });
function placeWallShelf() {
  setMode('build'); enterExclusiveMode('shelfPlace'); placingShelf = true; shelfHover = null;
  toast('คลิกกำแพงเพื่อวางชั้นวาง 3 คอลัมน์ (120 ซม.) · Esc ยกเลิก');
}
function removeWallShelf() {
  const list = (typeof WorldMarket === 'object' && WorldMarket.market) ? (WorldMarket.market().listings || []) : [];
  if (list.some(L => L.soldAt)) { toast('ยังมีเงินค้างบนชั้น กดรับให้หมดก่อนถึงจะเก็บชั้นได้', 'bad'); return; }
  if (list.length) { toast('ยังมีทากวางขายอยู่บนชั้น ถอนออกจากตลาดก่อน', 'bad'); return; }
  G.shelf = null; saveGame(); syncShelfPanel(); finishConstruction();
}
function shelfHit(sx, sy) {
  for (const side of ['north', 'west']) {
    const length = side === 'north' ? cellsW() : cellsH();
    const a = shelfPt(side, 0, 0), b = shelfPt(side, length, 0);
    const f = (sx - a.x) / (b.x - a.x); if (f < 0 || f >= 1) continue;
    const ground = a.y + (b.y - a.y) * f, z = (ground - sy) / cam.zoom;
    if (z < 0 || z > ROOM_H) continue;
    const column = Math.floor(f * length / SUB), offset = column * SUB;
    return { side, offset, valid: offset + SHELF_W <= length && !shelfOverlapsDoor(side, offset) };
  }
  return null;
}
/* ห้ามคร่อมประตู — ประตูก็อยู่บนกำแพงเดียวกัน */
function shelfOverlapsDoor(side, offset) {
  const d = G.door; if (!d || d.side !== side) return false;
  return offset < d.offset + 2 * SUB && d.offset < offset + SHELF_W;
}
function drawWallShelfGrid() {
  if (!placingShelf) return;
  if (appMode !== 'build') { placingShelf = false; return; }
  ctx.save(); ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  for (const side of ['north', 'west']) {
    const length = side === 'north' ? cellsW() : cellsH();
    for (let u = 0; u < length; u += SUB) wallQuad(side, u, SUB, 0, ROOM_H, 'rgba(201,183,131,.025)', 'rgba(239,220,162,.45)');
  }
  ctx.setLineDash([]);
  if (shelfHover) {
    const d = shelfHover, length = d.side === 'north' ? cellsW() : cellsH();
    wallQuad(d.side, d.offset, Math.min(SHELF_W, length - d.offset), 0, ROOM_H,
      d.valid ? 'rgba(103,212,163,.18)' : 'rgba(242,97,87,.25)', d.valid ? '#93dfb3' : '#f37a70');
    if (d.valid) drawWallShelf({ side: d.side, offset: d.offset });
  }
  ctx.restore();
}
cv.addEventListener('pointermove', e => { if (placingShelf) { const { sx, sy } = screenXY(e); shelfHover = shelfHit(sx, sy); } }, true);
cv.addEventListener('pointerleave', () => { shelfHover = null; });
cv.addEventListener('pointerdown', e => { if (placingShelf) shelfDown = { x: e.clientX, y: e.clientY }; }, true);
cv.addEventListener('pointerup', e => {
  if (!placingShelf) return;
  const moved = !shelfDown || Math.hypot(e.clientX - shelfDown.x, e.clientY - shelfDown.y) > 5; shelfDown = null;
  if (moved) return;
  e.stopImmediatePropagation(); dragging = false; cv.classList.remove('panning');
  const { sx, sy } = screenXY(e), d = shelfHit(sx, sy);
  if (!d) return;
  if (!d.valid) { toast('ต้องมีที่ว่างติดกัน 3 คอลัมน์ และห้ามทับประตู', 'bad'); return; }
  G.shelf = { side: d.side, offset: d.offset }; placingShelf = false; shelfHover = null;
  saveGame(); syncShelfPanel(); toast('ติดตั้งชั้นวาง 2 ชั้น 6 ช่องแล้ว — ลงขายในตลาดโลกได้เลย', 'good'); finishConstruction();
}, true);
window.addEventListener('keydown', e => { if (e.key === 'Escape') { placingShelf = false; shelfHover = null; } });

function syncShelfPanel() {
  const el = document.getElementById('shelfStatus'); if (!el) return;
  const r = shelfRect();
  const list = (typeof WorldMarket === 'object' && WorldMarket.market) ? (WorldMarket.market().listings || []) : [];
  el.textContent = r
    ? 'ติดตั้งแล้ว · ใช้อยู่ ' + list.length + '/' + SHELF_SLOTS + ' ช่อง' + (list.some(L => L.soldAt) ? ' · มีเงินรอกดรับ' : '')
    : 'ยังไม่ได้ติดตั้ง — ลงขายในตลาดโลกไม่ได้จนกว่าจะติดชั้น';
}
setTimeout(syncShelfPanel, 0);   // อัปเดตป้ายตอนโหลดเสร็จ (แผงก่อสร้างอาจถูกสร้างทีหลัง)
