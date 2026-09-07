/* ตลาดโลก — ระบบซื้อขายแยกอิสระจากเคาน์เตอร์ปกติ (เข้าผ่านคอมพิวเตอร์ร้าน)
 *  - เทรน: สุ่มค่ายีน "เป้า" ครบทุกยีน 1 ชุด เปลี่ยนใหม่ทุก 3 ชม. (เวลาจริง)
 *  - ลิสต์ทากขายได้สูงสุด 10 ตัว (ตัวไหนก็ได้) ทยอยขายทีละตัวตามเวลา
 *    ยิ่งยีนใกล้เป้ารวมทุกยีน → ราคาสูง + ขายเร็ว · ทุกตัวขายออกภายใน 3 ชม.
 *  - โชว์ตัวอย่าง 3 ตัว (ดึง 3-5 ยีนจากเป้ามาเป็นหลัก ที่เหลือสุ่ม) เป็นไกด์ราคา
 * ค่าปรับได้: ด้านล่างสุด · ใช้: makeSlug/slugSprite/SlugEngine (config), toast/saveGame/syncHUD, G, totalShopSlugs (trade.js) */
(function () {
  'use strict';

  /* ===== ค่าปรับได้ ===== */
  const REFRESH_MS = 3 * 60 * 60 * 1000;  // เทรนเปลี่ยนทุก 3 ชม.
  const SELL_MS    = 3 * 60 * 60 * 1000;  // ทากทุกตัวขายออกภายใน 3 ชม.
  const MAX_LIST   = 10;
  const BASE_PRICE = 150;                 // ราคาพื้นฐาน
  const BONUS_MAX  = 2850;                // โบนัสสูงสุดตามความใกล้เป้า (รวม ~3000)
  const GENE_RANGE = { bodyDepth:100, gillDepth:100, mainC:400, accC:400, len:100, girth:100, gillLen:100, tentLen:100, vigor:100, gillN:100, spotN:100 };
  const GENE_KEYS  = Object.keys(GENE_RANGE);
  /* ===================== */

  const now = () => Date.now();
  function randGene() {
    if (typeof SlugEngine !== 'undefined' && SlugEngine.randGene) return SlugEngine.randGene();
    const g = {}; for (const k of GENE_KEYS) g[k] = Math.round(Math.random() * GENE_RANGE[k]); return g;
  }
  // คะแนนความใกล้เป้า 0..1 (เฉลี่ยระยะห่างทุกยีน หารด้วยช่วงยีนนั้น)
  function matchScore(genes, target) {
    let sum = 0, n = 0;
    for (const k of GENE_KEYS) { const r = GENE_RANGE[k] || 100; sum += Math.abs((+genes[k] || 0) - (+target[k] || 0)) / r; n++; }
    return Math.max(0, 1 - sum / Math.max(1, n));
  }
  const priceFor = score => Math.round(BASE_PRICE + Math.pow(Math.max(0, Math.min(1, score)), 1.5) * BONUS_MAX);
  // ใกล้เป้า=ขายเร็ว, ไกล=ช้า (แต่ไม่เกิน 3 ชม.)
  const sellDelay = score => Math.round(Math.max(0.02, Math.min(1, 0.03 + (1 - score) * 0.9 + Math.random() * 0.07)) * SELL_MS);

  /* ---------- state ---------- */
  function market() {
    let m = G.market;
    if (!m || typeof m !== 'object' || !m.trend || !m.trend.target) m = G.market = { trend: null, listings: [] };
    if (!Array.isArray(m.listings)) m.listings = [];
    refreshTrend(m);
    return m;
  }
  function genShowcase(target) {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const g = randGene();
      const keys = GENE_KEYS.slice().sort(() => Math.random() - .5).slice(0, 3 + Math.floor(Math.random() * 3)); // 3-5 ยีนหลัก
      for (const k of keys) g[k] = target[k];
      out.push({ genes: g, price: priceFor(matchScore(g, target)) });
    }
    return out;
  }
  function refreshTrend(m) {
    if (m.trend && m.trend.refreshAt > now()) return false;
    const target = randGene();
    m.trend = { target, refreshAt: now() + REFRESH_MS, showcase: genShowcase(target) };
    return true;
  }

  /* ---------- listing ---------- */
  function totalShopSlugsSafe() { return typeof totalShopSlugs === 'function' ? totalShopSlugs() : 99; }
  function availableSlugs() {
    const out = [];
    for (const o of [...(G.objs || []), ...(G.shelter || [])]) {
      if (o.type !== 'tank') continue;
      for (const s of (o.slugs || [])) {
        if (s.breedZone) continue;
        if (typeof heldSlug !== 'undefined' && heldSlug === s) continue;
        if (typeof TRADE_OFFERS !== 'undefined' && TRADE_OFFERS.some(t => t.slug === s)) continue;
        out.push({ slug: s, tank: o });
      }
    }
    for (const s of (G.inv || [])) out.push({ slug: s, tank: null });
    return out;
  }
  function removeSlug(entry) {
    if (entry.tank) { const a = entry.tank.slugs, i = a.indexOf(entry.slug); if (i >= 0) a.splice(i, 1); }
    else { const i = (G.inv || []).indexOf(entry.slug); if (i >= 0) G.inv.splice(i, 1); }
  }
  function listSlug(entry) {
    const m = market();
    if (m.listings.length >= MAX_LIST) { toast('ลิสต์ตลาดโลกได้สูงสุด ' + MAX_LIST + ' ตัว', 'bad'); return false; }
    if (totalShopSlugsSafe() <= 2) { toast('ต้องเหลือทากในร้านอย่างน้อย 2 ตัว', 'bad'); return false; }
    const s = entry.slug, score = matchScore(s.genes, m.trend.target);
    removeSlug(entry);
    m.listings.push({ id: s.id, genes: s.genes, name: s.id, price: priceFor(score), score: score, listedAt: now(), sellAt: now() + sellDelay(score) });
    if (typeof saveGame === 'function') saveGame();
    if (typeof syncHUD === 'function') syncHUD();
    renderMarket();
    return true;
  }

  /* ---------- ขายตามเวลา ---------- */
  function tick() {
    if (typeof G === 'undefined') return;
    const m = market(); let sold = 0, changed = false;
    for (let i = m.listings.length - 1; i >= 0; i--) {
      const L = m.listings[i];
      if (now() >= L.sellAt) { m.listings.splice(i, 1); G.coin += L.price; if (G.stats) G.stats.sold = (G.stats.sold || 0) + 1; sold += L.price; changed = true; }
    }
    if (changed) {
      if (typeof toast === 'function') toast('🌐 ตลาดโลกขายทากได้ +' + sold + ' เหรียญ', 'good');
      if (typeof syncHUD === 'function') syncHUD();
      if (typeof saveGame === 'function') saveGame();
    }
    if (marketDialog && marketDialog.open) renderMarket();
  }

  /* ---------- display helpers ---------- */
  function dispSlug(genes) { try { return makeSlug(Object.assign(randGene(), genes)); } catch (e) { return null; } }
  function fmtLeft(ms) {
    ms = Math.max(0, ms); const s = Math.ceil(ms / 1000);
    if (s < 60) return s + ' วิ';
    const m = Math.ceil(s / 60); return m >= 60 ? Math.floor(m / 60) + ' ชม. ' + (m % 60) + ' น.' : m + ' นาที';
  }

  /* ---------- UI ---------- */
  const marketDialog = document.createElement('dialog');
  marketDialog.id = 'worldMarket';
  marketDialog.style.cssText = 'width:min(720px,94vw);max-height:86vh;overflow:auto;padding:22px;background:#172b2e;color:#e5dcc4;border:1px solid #b59859;border-radius:14px;color-scheme:dark';
  document.body.append(marketDialog);
  marketDialog.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); marketDialog.close(); } }, true);

  let _availCache = [];
  function renderMarket() {
    const m = market();
    const t = m.trend;
    const showHtml = t.showcase.map((c, i) =>
      `<div style="flex:1;min-width:120px;padding:8px;border:1px solid #47605f;border-radius:8px;text-align:center">
        <canvas data-mk-show="${i}" width="120" height="84" style="width:100%;height:auto;background:#0f1e22;border-radius:6px"></canvas>
        <div style="margin-top:4px"><b>${c.price.toLocaleString()}</b> เหรียญ</div></div>`).join('');

    const listHtml = m.listings.length
      ? m.listings.slice().sort((a, b) => a.sellAt - b.sellAt).map(L =>
        `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid #2c3a3a">
          <canvas data-mk-list="${L.id}" width="90" height="60" style="width:70px;height:auto;background:#0f1e22;border-radius:6px"></canvas>
          <div style="flex:1"><b>${L.price.toLocaleString()} เหรียญ</b><br><small style="opacity:.8">ขายใน ~${fmtLeft(L.sellAt - now())}</small></div></div>`).join('')
      : '<p style="font-size:12px;opacity:.7">ยังไม่มีทากในตลาด — เลือกจากด้านล่างมาลงขายได้เลย</p>';

    _availCache = availableSlugs().map(e => ({ ...e, price: priceFor(matchScore(e.slug.genes, t.target)) })).sort((a, b) => b.price - a.price);
    const full = m.listings.length >= MAX_LIST;
    const availHtml = _availCache.length
      ? _availCache.slice(0, 60).map((e, i) =>
        `<div style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid #202b2b">
          <canvas data-mk-avail="${i}" width="80" height="54" style="width:56px;height:auto;background:#0f1e22;border-radius:6px"></canvas>
          <div style="flex:1;font-size:12px">${e.slug.id}<br><b>${e.price.toLocaleString()}</b> เหรียญ</div>
          <button class="tbtn" data-list="${i}" ${full ? 'disabled' : ''}>ลงขาย</button></div>`).join('')
        + (_availCache.length > 60 ? '<p style="font-size:11px;opacity:.6">…แสดง 60 ตัวแรก</p>' : '')
      : '<p style="font-size:12px;opacity:.7">ไม่มีทากที่ลงขายได้ (ตัวที่กำลังผสม/ถือ/มีข้อเสนอ จะลงไม่ได้)</p>';

    marketDialog.innerHTML =
      `<div style="display:flex;align-items:center;justify-content:space-between"><b>🌐 ตลาดโลก</b><button class="tbtn" data-close>✕</button></div>
      <p style="font-size:12px;opacity:.85">เทรนตอนนี้ (เปลี่ยนใน ~${fmtLeft(t.refreshAt - now())}) — ยิ่งยีนใกล้เทรน ยิ่งแพงและขายเร็ว · ลงขายได้สูงสุด ${MAX_LIST} ตัว ทยอยขายภายใน 3 ชม.</p>
      <h3 style="margin:10px 0 6px">ทากตัวอย่างที่ตลาดต้องการตอนนี้</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${showHtml}</div>
      <h3 style="margin:16px 0 6px">กำลังขายในตลาด (${m.listings.length}/${MAX_LIST})</h3>
      <div>${listHtml}</div>
      <h3 style="margin:16px 0 6px">เลือกทากลงขาย</h3>
      <div style="max-height:34vh;overflow:auto;border:1px solid #33403f;border-radius:8px">${availHtml}</div>`;

    // วาดรูปทาก
    t.showcase.forEach((c, i) => { const cv = marketDialog.querySelector(`[data-mk-show="${i}"]`); if (cv) { c._disp ||= dispSlug(c.genes); if (c._disp) drawSlugPortrait(cv, c._disp); } });
    for (const L of m.listings) { const cv = marketDialog.querySelector(`[data-mk-list="${L.id}"]`); if (cv) { L._disp ||= dispSlug(L.genes); if (L._disp) drawSlugPortrait(cv, L._disp); } }
    _availCache.slice(0, 60).forEach((e, i) => { const cv = marketDialog.querySelector(`[data-mk-avail="${i}"]`); if (cv) drawSlugPortrait(cv, e.slug); });

    marketDialog.querySelector('[data-close]').onclick = () => marketDialog.close();
    marketDialog.querySelectorAll('[data-list]').forEach(b => b.onclick = () => { const e = _availCache[+b.dataset.list]; if (e) listSlug(e); });
  }

  window.openWorldMarket = function () { renderMarket(); if (!marketDialog.open) marketDialog.showModal(); };
  window.WorldMarket = { market, listSlug, tick, matchScore, priceFor };

  setInterval(tick, 1000);
})();
