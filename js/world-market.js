/* ตลาดโลก — ผู้ขายตั้งราคาเอง ผู้ซื้อสนใจตาม "ความใกล้เทรน" + "ราคาที่ตั้ง" (เข้าผ่านคอมพิวเตอร์ร้าน)
 *  - เทรน: สุ่มค่าเป้าใหม่ทุกยีนอย่างอิสระ (แต่ละยีนคนละค่า) เปลี่ยนใหม่ทุก 3 ชม. · แสดงค่าเป้าให้เพาะตามได้
 *  - มูลค่าจริง (ราคากลาง) = ผลรวมรายยีน · ตรงเป้าทุกยีน = 2,200 · ไม่ตรงเลยทุกยีน = 44
 *      · ยีนหนึ่ง ๆ ได้ = ฐานของยีนนั้น (100) × ตัวคูณจาก MATCH_BANDS ตาม "% ตรงกับเป้า"
 *  - ผู้เล่นตั้งราคาขายเอง: ถูก = ขายไว, แพง = ช้า, แพงเกิน R_DEAD เท่าของมูลค่า = ไม่มีใครซื้อ
 *  - ผ่านครึ่งเวลา (3 ชม.) แล้วผู้ซื้อเริ่มต่อราคา ลดได้สูงสุด HAGGLE_MAX
 *  - ครบ 3 ชม. ยังไม่ขาย → ทากถูกส่งคืนเข้าคลังทาก
 * ค่าปรับได้: ด้านล่างสุดของบล็อกนี้ · ใช้: SlugEngine/slugSprite/drawSlugPortrait/_saveSlug/_loadSlug,
 *            toast/saveGame/syncHUD, G, totalShopSlugs (trade.js) */
(function () {
  'use strict';

  /* ===== ค่าปรับได้ ===== */
  const REFRESH_MS = 3 * 60 * 60 * 1000;  // เทรนเปลี่ยนทุก 3 ชม.
  const SELL_MS    = 3 * 60 * 60 * 1000;  // ลิมิตเวลาต่อการลงขาย 1 ครั้ง
  const MAX_LIST   = 6;                   // = จำนวนช่องบนชั้นวางติดผนัง (SHELF_SLOTS ใน wall-shelf.js) ทากที่ลงขายไปโผล่บนชั้นนั้น

  // มูลค่ารายยีน = ฐาน 100 เหรียญ × ตัวคูณตาม "% ตรงกับเป้า"
  //   ตรงเป๊ะทุกยีน = 11 × 100 × 2   = 2,200 เหรียญ
  //   ต่ำกว่า 50% ทุกยีน = 11 × 100 × 0.04 = 44 เหรียญ
  const GENE_BASE  = { mainC:100, accC:100, vigor:100, len:100, girth:100,
                       gillLen:100, tentLen:100, bodyDepth:100, gillDepth:100, gillN:100, spotN:100 };
  const GENE_RANGE = { bodyDepth:100, gillDepth:100, mainC:400, accC:400, len:100, girth:100,
                       gillLen:100, tentLen:100, vigor:100, gillN:100, spotN:100 };
  // [% ตรงต่ำสุดของช่วง, ตัวคูณ] — ต้องเรียง % จากมากไปน้อย
  const MATCH_BANDS = [[100,2], [98,1.8], [95,1.5], [92,1.2], [90,1], [88,0.8], [85,0.6],
                       [80,0.4], [75,0.2], [70,0.18], [65,0.16], [60,0.14], [55,0.12], [50,0.1], [0,0.04]];
  const MIN_VALUE  = 1;      // กันหารศูนย์เฉย ๆ (พื้นจริงคือ 44 จากตัวคูณ 0.04)

  // เป้าเทรน: สุ่มแยกกันทุกยีน และดันให้ไปอยู่ "โซนสุดขั้ว" (ต่ำกว่า 30% หรือสูงกว่า 70% ของช่วงยีน)
  // เป้าที่อยู่ขอบทำให้ทากสุ่มมั่วห่างจากเป้ามากขึ้น = เงินฟรีน้อยลง และทากเทรนดูโดดเด่นกว่า
  const TREND_EXTREME   = 0.70;   // โอกาสที่ยีนเป้าจะถูกดันไปโซนสุดขั้ว (ผลรวมจริง ~88% ของยีนจะอยู่โซนนี้)
  const TREND_EDGE      = 0.30;   // ความกว้างของโซนสุดขั้ว (30% ล่าง / 30% บน)
  const TREND_EDGE_BIAS = 1.4;    // >1 = ยิ่งชิดขอบสุดยิ่งบ่อย

  // พฤติกรรมผู้ซื้อ (r = ราคาที่ตั้ง ÷ มูลค่าจริง)
  const R_FAST     = 0.60;               // ตั้ง ≤ 0.6 เท่า = ขายเร็วสุด
  const R_DEAD     = 1.35;               // ตั้ง ≥ 1.35 เท่า = ไม่มีใครสนใจเลย
  const T_MIN_MS   = 30 * 60 * 1000;     // เร็วสุดที่ขายได้ (กันลงขายถูก ๆ แล้ววนรัว)
  const T_K_MS     = 40 * 60 * 1000;     // ตัวคูณความช้าเมื่อราคาสูงขึ้น
  const HAGGLE_AT  = 0.50;               // ผ่านครึ่งเวลาแล้วเริ่มโดนต่อราคา
  const HAGGLE_MAX = 0.25;               // ต่อราคาลงได้สูงสุด 25%
  const SIM_STEP   = 30 * 1000;          // ความละเอียดการจำลองเวลา
  /* ===================== */

  const GENE_KEYS  = Object.keys(GENE_BASE);
  const BASE_SUM   = GENE_KEYS.reduce((a, k) => a + GENE_BASE[k], 0);
  const FULL_VALUE = Math.round(BASE_SUM * MATCH_BANDS[0][1]);                       // ตรงเป๊ะทุกยีน
  const FLOOR_VALUE = Math.round(BASE_SUM * MATCH_BANDS[MATCH_BANDS.length - 1][1]); // ไม่ตรงเลยทุกยีน
  const now = () => Date.now();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const FALLBACK_LABEL = { bodyDepth:'ร่องสีตัว', gillDepth:'ร่องสีหงอน', mainC:'สีลำตัว', accC:'สีหงอนเหงือก',
    len:'ความยาวลำตัว', girth:'ขนาดตัวรวม', gillLen:'ความสูงหงอนเหงือก', tentLen:'ความยาวหนวด',
    vigor:'ความสมบูรณ์', gillN:'จำนวนหงอนเหงือก', spotN:'ลาย (รูปทรง+จำนวน)' };
  function label(k) {
    try { const g = SlugEngine.GENES.find(x => x.k === k); if (g && g.th) return g.th; } catch (e) {}
    return FALLBACK_LABEL[k] || k;
  }
  function geneText(k, v) {
    const n = Math.round(+v || 0);
    if ((k === 'mainC' || k === 'accC') && typeof SlugEngine !== 'undefined' && SlugEngine.colorName) {
      try { return n + ' · ' + SlugEngine.colorName(n); } catch (e) {}
    }
    return String(n);
  }

  function randGene() {
    if (typeof SlugEngine !== 'undefined' && SlugEngine.randGene) return SlugEngine.randGene();
    const g = {}; for (const k of GENE_KEYS) g[k] = Math.round(Math.random() * GENE_RANGE[k]); return g;
  }
  // เป้าเทรน — สุ่มทีละยีนอย่างอิสระ ค่าแต่ละยีนไม่เกี่ยวกัน แล้วเอียงไปทางขอบ
  function trendTarget() {
    const t = {};
    for (const k of GENE_KEYS) {
      const R = GENE_RANGE[k] || 100;
      if (Math.random() < TREND_EXTREME) {
        const u = Math.pow(Math.random(), TREND_EDGE_BIAS) * TREND_EDGE;   // 0 = สุดขอบ
        t[k] = Math.round(Math.random() < 0.5 ? u * R : R - u * R);
      } else {
        t[k] = Math.round(Math.random() * R);
      }
    }
    return t;
  }

  /* ---------- มูลค่าจริง: คิดทีละยีนแล้วบวกกัน ---------- */
  // % ตรงกับเป้า: ห่าง 0 = 100% · ห่างเต็มช่วงยีน = 0%
  function matchPct(k, mine, want) {
    const R = GENE_RANGE[k] || 100;
    return clamp(100 - Math.abs((+mine || 0) - (+want || 0)) / R * 100, 0, 100);
  }
  function multOf(pct) {
    const p = Math.floor(pct);
    for (const [lo, x] of MATCH_BANDS) if (p >= lo) return x;
    return MATCH_BANDS[MATCH_BANDS.length - 1][1];
  }
  const geneCoin = (k, mine, want) => (GENE_BASE[k] || 0) * multOf(matchPct(k, mine, want));

  function valueOf(genes, target) {
    let v = 0; for (const k of GENE_KEYS) v += geneCoin(k, genes[k], target[k]);
    return Math.max(MIN_VALUE, Math.round(v));
  }
  function breakdown(genes, target) {
    return GENE_KEYS.map(k => {
      const pct = matchPct(k, genes[k], target[k]), mul = multOf(pct);
      return {
        k, label: label(k), base: GENE_BASE[k], full: Math.round(GENE_BASE[k] * MATCH_BANDS[0][1]),
        mine: +genes[k] || 0, want: +target[k] || 0,
        off: Math.abs((+genes[k] || 0) - (+target[k] || 0)),
        pct, mul, coin: Math.round(GENE_BASE[k] * mul)
      };
    }).sort((a, b) => b.coin - a.coin || b.pct - a.pct);
  }

  /* ---------- ผู้ซื้อ: ราคา ↔ ความเร็ว ---------- */
  function timeToSell(r) {                        // r = ราคาที่ผู้ซื้อต้องจ่าย ÷ มูลค่าจริง
    if (!(r > 0)) return T_MIN_MS;
    if (r <= R_FAST) return T_MIN_MS;
    if (r >= R_DEAD) return Infinity;
    return T_MIN_MS + T_K_MS * ((r - R_FAST) / (R_DEAD - r));
  }
  const haggle = frac => frac <= HAGGLE_AT ? 0 : HAGGLE_MAX * clamp((frac - HAGGLE_AT) / (1 - HAGGLE_AT), 0, 1);

  // เดินเวลาให้ listing (รองรับการปิดเกมไปแล้วกลับมา — เดินเป็นสเต็ปคงที่)
  function advance(L, until) {
    while (L.simAt < until) {
      const to = Math.min(until, L.simAt + SIM_STEP), dt = to - L.simAt;
      const frac = (L.simAt - L.listedAt) / SELL_MS;
      if (frac >= 1) { L.simAt = to; return; }
      const offer = L.ask * (1 - haggle(frac));
      const T = timeToSell(offer / L.value) * L.jitter;
      if (isFinite(T)) L.prog += dt / T;
      L.simAt = to;
      if (L.prog >= 1) { L.soldAt = to; L.soldPrice = Math.max(1, Math.round(offer)); return; }
    }
  }
  // จำลองล่วงหน้าแบบไม่สุ่ม เพื่อบอกผู้เล่นว่า "ตั้งราคานี้แล้วจะเป็นยังไง"
  function simulate(value, ask) {
    let prog = 0;
    for (let t = 0; t < SELL_MS; t += SIM_STEP) {
      const offer = ask * (1 - haggle(t / SELL_MS));
      const T = timeToSell(offer / value);
      if (isFinite(T)) prog += SIM_STEP / T;
      if (prog >= 1) return { sold: true, at: t + SIM_STEP, price: Math.round(offer) };
    }
    return { sold: false };
  }

  /* ---------- state ---------- */
  function market() {
    let m = G.market;
    if (!m || typeof m !== 'object') m = G.market = { trend: null, listings: [] };
    if (!Array.isArray(m.listings)) m.listings = [];
    if (!m.trend || !m.trend.target) m.trend = null;
    m.listings = m.listings.filter(migrate);
    refreshTrend(m);
    return m;
  }
  // เซฟเก่า (ระบบราคาอัตโนมัติ) ยังลงขายอยู่ → แปลงให้เข้ากับระบบใหม่
  function migrate(L) {
    if (!L || typeof L !== 'object') return false;
    if (!L.genes) return false;
    L.listedAt = +L.listedAt || now();
    L.value    = Math.max(MIN_VALUE, Math.round(+L.value || +L.price || MIN_VALUE));
    L.ask      = Math.max(1, Math.round(+L.ask || +L.price || L.value));
    L.jitter   = +L.jitter > 0 ? L.jitter : 1;
    L.prog     = clamp(+L.prog || 0, 0, 1);
    L.simAt    = Math.max(L.listedAt, +L.simAt || L.listedAt);
    L.key      = L.key || L.id || ('L' + Math.random().toString(36).slice(2, 8));
    delete L._disp; delete L.price; delete L.score; delete L.sellAt;   // ค้างจากระบบเก่า/แคชรูป
    return true;
  }
  // ตัวอย่าง 3 ระดับฝีมือเพาะ: แม่นมาก / กลาง / พอใช้ (คลาดจากเป้าไม่เกินกี่ % ของช่วงยีน)
  const SHOWCASE_SPREAD = [0.02, 0.06, 0.12];
  function genShowcase(target) {
    return SHOWCASE_SPREAD.map(e => {
      const g = {};
      for (const k of GENE_KEYS)
        g[k] = clamp(Math.round(target[k] + (Math.random() * 2 - 1) * e * GENE_RANGE[k]), 0, GENE_RANGE[k]);
      return { genes: g, value: valueOf(g, target) };
    }).sort((a, b) => b.value - a.value);
  }
  let _showcase = null, _showcaseFor = -1;
  function getShowcase(m) {
    if (!_showcase || _showcaseFor !== m.trend.refreshAt) { _showcase = genShowcase(m.trend.target); _showcaseFor = m.trend.refreshAt; }
    return _showcase;
  }
  function refreshTrend(m) {
    if (m.trend && m.trend.refreshAt > now()) return false;
    const target = trendTarget();
    m.trend = { target, refreshAt: now() + REFRESH_MS };
    return true;
  }

  /* ---------- ทากที่ลงขายได้ ---------- */
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
    if (typeof selSlug !== 'undefined' && selSlug === entry.slug) selSlug = null;
  }
  const packSlug = s => typeof _saveSlug === 'function' ? _saveSlug(s)
    : { id: s.id, genes: { ...s.genes }, traits: s.traits, fx: s.fx, fy: s.fy, satiety: s.satiety };
  const unpackSlug = raw => typeof _loadSlug === 'function' ? _loadSlug(raw) : raw;

  function listSlug(entry, ask) {
    const m = market();
    if (typeof shelfRect === 'function' && !shelfRect()) {
      say('ต้องติดตั้ง "ชั้นวางติดผนัง" ก่อน — ทากที่ลงขายจะไปวางโชว์บนชั้นนั้น (โหมดก่อสร้าง)', 'bad'); return false;
    }
    if (m.listings.length >= MAX_LIST) { say('ชั้นวางเต็มแล้ว (' + MAX_LIST + ' ช่อง)', 'bad'); return false; }
    if (totalShopSlugsSafe() <= 2) { say('ต้องเหลือทากในร้านอย่างน้อย 2 ตัว', 'bad'); return false; }
    const s = entry.slug, value = valueOf(s.genes, m.trend.target);
    ask = Math.max(1, Math.round(+ask || value));
    removeSlug(entry);
    m.listings.push({
      key: 'L' + s.id + '-' + now().toString(36), id: s.id, genes: { ...s.genes }, slug: packSlug(s),
      value, ask, listedAt: now(), simAt: now(), prog: 0, jitter: 0.85 + Math.random() * 0.3
    });
    persist(); renderMarket(true);
    return true;
  }
  function unlist(key, quiet) {
    const m = market(), i = m.listings.findIndex(L => L.key === key);
    if (i < 0) return false;
    const L = m.listings[i]; m.listings.splice(i, 1);
    (G.inv ||= []).push(unpackSlug(L.slug || { id: L.id, genes: L.genes }));
    if (!quiet) say('ถอนทาก ' + L.id + ' ออกจากตลาด — กลับเข้าคลังทากแล้ว');
    persist(); renderMarket(true);
    return true;
  }

  /* กดเหรียญบนชั้นวาง = รับเงินก้อนนั้น แล้วช่องว่างลงให้ลงขายตัวใหม่ได้ */
  function collectSold(key) {
    const m = market(), i = m.listings.findIndex(L => L.key === key);
    if (i < 0) return false;
    const L = m.listings[i];
    if (!L.soldAt) return false;
    m.listings.splice(i, 1);
    G.coin += L.soldPrice;
    if (G.stats) G.stats.sold = (G.stats.sold || 0) + 1;
    say('รับเงินขายทาก ' + L.id + ' +' + L.soldPrice.toLocaleString() + ' เหรียญ', 'good');
    persist(); if (typeof syncShelfPanel === 'function') syncShelfPanel();
    if (marketDialog.open) renderMarket(true);
    return true;
  }
  function say(msg, kind) { if (typeof toast === 'function') toast(msg, kind); }
  function persist() {
    if (typeof saveGame === 'function') saveGame();
    if (typeof syncHUD === 'function') syncHUD();
    if (typeof syncShelfPanel === 'function') syncShelfPanel();   // ป้ายบอกจำนวนช่องบนชั้นวางในแผงก่อสร้าง
  }

  /* ---------- เดินเวลา ---------- */
  function tick() {
    if (typeof G === 'undefined' || !G) return;
    const m = market(), t = now();
    let coins = 0, sold = 0, back = [], changed = false;
    for (let i = m.listings.length - 1; i >= 0; i--) {
      const L = m.listings[i];
      if (L.soldAt) {
        /* ขายได้แล้วแต่ยังไม่กดรับ — ค้างไว้ในช่องบนชั้นวาง เหรียญลอยรออยู่ ไม่เข้าเงินอัตโนมัติ
           (ไม่ splice ไม่หมดอายุ ช่องนั้นถือว่ายังถูกใช้อยู่จนกว่าจะกดรับ) */
        if (!L.announced) { L.announced = true; sold++; changed = true; }
        continue;
      }
      advance(L, Math.min(t, L.listedAt + SELL_MS));
      if (L.soldAt) {
        L.announced = true; sold++; changed = true;
      } else if (t >= L.listedAt + SELL_MS) {
        m.listings.splice(i, 1);
        (G.inv ||= []).push(unpackSlug(L.slug || { id: L.id, genes: L.genes }));
        back.push(L.id); changed = true;
      }
    }
    if (sold) say('🌐 ตลาดโลกขายทากได้ ' + sold + ' ตัว — กดเหรียญบนชั้นวางเพื่อรับเงิน', 'good');
    if (back.length) say('🌐 ขายไม่ออกใน 3 ชม. — ทาก ' + back.join(', ') + ' กลับเข้าคลังทากแล้ว', 'bad');
    if (changed) persist();
    if (marketDialog.open) { changed ? renderMarket(true) : refreshLive(); }
  }

  /* ---------- display helpers ---------- */
  const dispCache = new Map();
  function dispSlug(key, genes) {
    if (dispCache.has(key)) return dispCache.get(key);
    let d = null;
    try {
      const g = {}; for (const k of GENE_KEYS) g[k] = clamp(+genes[k] || 0, 0, GENE_RANGE[k]);
      d = { id: 'wm-' + key, genes: g, traits: typeof slugTraits === 'function' ? slugTraits(g) : {} };
    } catch (e) { d = null; }
    dispCache.set(key, d);
    if (dispCache.size > 200) dispCache.delete(dispCache.keys().next().value);
    return d;
  }
  function paint(cv, key, genes) {
    if (!cv) return;
    const d = dispSlug(key, genes);
    if (d) { try { drawSlugPortrait(cv, d); } catch (e) {} }
  }
  function fmtLeft(ms) {
    if (!isFinite(ms)) return 'ไม่มีกำหนด';
    ms = Math.max(0, ms); const s = Math.ceil(ms / 1000);
    if (s < 60) return s + ' วิ';
    const m = Math.ceil(s / 60);
    return m >= 60 ? Math.floor(m / 60) + ' ชม. ' + String(m % 60).padStart(2, '0') + ' น.' : m + ' นาที';
  }
  const coin = n => Math.round(n).toLocaleString();

  /* ---------- UI ---------- */
  const marketDialog = document.createElement('dialog');
  marketDialog.id = 'worldMarket';
  marketDialog.style.cssText = 'width:min(760px,94vw);max-height:88vh;overflow:auto;padding:22px;background:#172b2e;color:#e5dcc4;border:1px solid #b59859;border-radius:14px;color-scheme:dark';
  document.body.append(marketDialog);
  marketDialog.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); marketDialog.close(); } }, true);

  /* ---------- แอนิเมชันทากตัวอย่าง + คลิกขยายดูตัวใหญ่ (เดินเฉพาะตอนหน้าต่างเปิด) ---------- */
  function drawAnimPortrait(cv, slug, phase) {
    if (!cv || !slug) return;
    let P = null; try { P = (typeof slugPartsOf === 'function') ? slugPartsOf(slug) : null; } catch (e) {}
    const ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    if (!P || typeof SlugEngine === 'undefined' || !SlugEngine.drawSlug) { try { drawSlugPortrait(cv, slug); } catch (e) {} return; }
    const pad = Math.max(10, w * 0.08);
    const scale = Math.min((w - pad * 2) / P.w, (h - pad * 2) / P.h);
    const prev = SlugEngine.ANIM; SlugEngine.ANIM = true;
    try { SlugEngine.drawSlug(ctx, P, w / 2, h / 2 + h * 0.06, false, phase, scale, false, true, slug); } catch (e) {}
    SlugEngine.ANIM = prev;
  }
  const zoom = document.createElement('div');
  zoom.id = 'wmZoom';
  zoom.style.cssText = 'position:fixed;inset:0;background:rgba(8,14,16,.85);display:none;align-items:center;justify-content:center;flex-direction:column;gap:12px;z-index:100000;cursor:zoom-out';
  zoom.innerHTML = '<canvas id="wmZoomCv" width="520" height="380" style="max-width:88vw;max-height:66vh;background:#0f1e22;border-radius:16px;border:1px solid #b59859"></canvas><div id="wmZoomLabel" style="color:#e5dcc4;font-size:15px;font-weight:600"></div><div style="color:#9fbfb5;opacity:.6;font-size:12px">แตะที่ไหนก็ได้เพื่อปิด</div>';
  document.body.append(zoom);
  let _zoomGenes = null;
  zoom.onclick = () => { zoom.style.display = 'none'; _zoomGenes = null; };
  function openZoom(genes, value) { _zoomGenes = genes; const lb = document.getElementById('wmZoomLabel'); if (lb) lb.textContent = 'ราคากลาง ' + coin(value); zoom.style.display = 'flex'; startAnim(); }
  let _animRAF = 0;
  function animLoop(ts) {
    _animRAF = 0;
    const phase = ts / 620;
    if (marketDialog.open) {
      const m = market(), sc = getShowcase(m), key = m.trend.refreshAt;
      sc.forEach((c, i) => drawAnimPortrait(marketDialog.querySelector(`[data-mk-show="${i}"]`), dispSlug('show' + i + key, c.genes), phase + i * 1.1));
    }
    if (_zoomGenes && zoom.style.display !== 'none') {
      const g = {}; for (const k of GENE_KEYS) g[k] = clamp(+_zoomGenes[k] || 0, 0, GENE_RANGE[k]);
      drawAnimPortrait(document.getElementById('wmZoomCv'), { id: 'wm-zoom', genes: g, traits: typeof slugTraits === 'function' ? slugTraits(g) : {} }, phase);
    }
    if (marketDialog.open || (_zoomGenes && zoom.style.display !== 'none')) _animRAF = requestAnimationFrame(animLoop);
  }
  function startAnim() { if (!_animRAF) _animRAF = requestAnimationFrame(animLoop); }

  let _avail = [];              // แคชแถว "เลือกทากลงขาย" ของการเรนเดอร์ล่าสุด
  const _askDraft = new Map();  // ราคาที่ผู้เล่นพิมพ์ค้างไว้ (slugId → ค่า) — กันหายตอนรีเฟรช
  let _availFilter = '';

  const UNIFORM_BASE = GENE_KEYS.every(k => GENE_BASE[k] === GENE_BASE[GENE_KEYS[0]]) ? GENE_BASE[GENE_KEYS[0]] : null;
  const bandLabel = i => i === 0 ? MATCH_BANDS[0][0] + '%'
    : MATCH_BANDS[i][0] === 0 ? (MATCH_BANDS[i - 1][0] - 1) + '% ลงไป'
    : MATCH_BANDS[i][0] + '-' + (MATCH_BANDS[i - 1][0] - 1) + '%';

  function trendTableHtml(t) {
    return `<table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="opacity:.75;text-align:left"><th style="padding:3px 6px">ยีน</th><th>ตลาดอยากได้</th><th style="text-align:right">ฐาน</th></tr>
      ${GENE_KEYS.map(k =>
        `<tr style="border-top:1px solid #2c3a3a"><td style="padding:3px 6px">${esc(label(k))}</td>
         <td><b>${esc(geneText(k, t.target[k]))}</b></td>
         <td style="text-align:right;opacity:.7">${coin(GENE_BASE[k])}</td></tr>`).join('')}
    </table>
    <p style="font-size:12px;margin:10px 0 4px">แต่ละยีนได้ <b>ฐาน × ตัวคูณ</b> ตาม % ที่ตรงกับเป้า แล้วเอามาบวกกันทั้ง ${GENE_KEYS.length} ยีน<br>
      ตรงเป๊ะทุกยีน = <b>${coin(FULL_VALUE)}</b> · ต่ำกว่า ${MATCH_BANDS[MATCH_BANDS.length - 2][0]}% ทุกยีน = <b>${coin(FLOOR_VALUE)}</b></p>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="opacity:.75;text-align:left"><th style="padding:3px 6px">% ตรง</th><th>ตัวคูณ</th>${UNIFORM_BASE ? '<th style="text-align:right">เหรียญ/ยีน</th>' : ''}</tr>
      ${MATCH_BANDS.map((b, i) =>
        `<tr style="border-top:1px solid #2c3a3a"><td style="padding:2px 6px">${bandLabel(i)}</td>
         <td>×${b[1]}</td>${UNIFORM_BASE ? `<td style="text-align:right">${coin(UNIFORM_BASE * b[1])}</td>` : ''}</tr>`).join('')}
    </table>`;
  }

  function listingRowHtml(L) {
    /* ขายได้แล้วแต่ยังไม่กดรับ — แถวนี้ยังกินช่องบนชั้นวางอยู่ ต้องไปกดเหรียญบนชั้นเท่านั้น */
    if (L.soldAt) return `<div style="display:flex;align-items:center;gap:10px;padding:9px;border-bottom:1px solid #2c3a3a">
      <canvas data-mk-list="${esc(L.key)}" width="90" height="60" style="width:70px;height:auto;background:#0f1e22;border-radius:6px"></canvas>
      <div style="flex:1;min-width:0;font-size:12px">
        <b style="font-size:13px;color:#f1c66d">ขายได้แล้ว ${coin(L.soldPrice)}</b><br>
        <span style="opacity:.8">${esc(L.id)} · กดเหรียญ ฿ เหนือตู้บนชั้นวางเพื่อรับเงิน</span>
      </div></div>`;
    const t = now(), frac = clamp((t - L.listedAt) / SELL_MS, 0, 1);
    const disc = haggle(frac), offer = Math.round(L.ask * (1 - disc));
    const r = offer / L.value, dead = r >= R_DEAD;
    const left = L.listedAt + SELL_MS - t;
    const pct = Math.round(clamp(L.prog, 0, 1) * 100);
    const state = dead ? '<span style="color:#e08b7a">ยังไม่มีใครสนใจ — ราคาสูงเกินไป</span>'
      : L.prog > .75 ? '<span style="color:#9fd39a">กำลังจะปิดการขาย</span>'
      : L.prog > .3  ? '<span style="color:#d9c98a">มีคนสนใจแล้ว</span>'
      : '<span style="opacity:.8">เริ่มมีคนเข้ามาดู</span>';
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px;border-bottom:1px solid #2c3a3a">
      <canvas data-mk-list="${esc(L.key)}" width="90" height="60" style="width:70px;height:auto;background:#0f1e22;border-radius:6px"></canvas>
      <div style="flex:1;min-width:0;font-size:12px">
        <b style="font-size:13px">ตั้งขาย ${coin(L.ask)}</b> <span style="opacity:.65">· ราคากลาง ${coin(L.value)}</span><br>
        ${state}${disc > 0 ? ` · <span style="color:#e0b07a">โดนต่อราคา −${Math.round(disc * 100)}% → จะได้ ${coin(offer)}</span>` : ''}<br>
        <span style="opacity:.75">${esc(L.id)} · เหลือเวลา ${fmtLeft(left)}</span>
        <div style="height:5px;margin-top:5px;background:#0f1e22;border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${dead ? '#7a4a42' : '#6fa08c'}"></div></div>
      </div>
      <button class="tbtn" data-unlist="${esc(L.key)}">ถอนออก</button></div>`;
  }

  function availRowHtml(e, i) {
    const draft = _askDraft.has(e.slug.id) ? _askDraft.get(e.slug.id) : e.value;
    const b = breakdown(e.slug.genes, e.target);
    return `<div style="padding:8px;border-bottom:1px solid #202b2b">
      <div style="display:flex;align-items:center;gap:8px">
        <canvas data-mk-avail="${i}" width="80" height="54" style="width:56px;height:auto;background:#0f1e22;border-radius:6px"></canvas>
        <div style="flex:1;min-width:0;font-size:12px">${esc(SlugBrowser.name(e.slug))}<br>ราคากลาง <b>${coin(e.value)}</b> <span style="opacity:.6">(${Math.round(e.value / FULL_VALUE * 100)}% ของเต็ม)</span></div>
        <label style="font-size:11px;opacity:.8">ตั้งราคา<br>
          <input data-ask="${i}" type="number" min="1" step="10" value="${Math.round(draft)}" style="width:96px;background:#0f1e22;color:#e5dcc4;border:1px solid #47605f;border-radius:6px;padding:5px"></label>
        <button class="tbtn" data-list="${i}">ลงขาย</button>
      </div>
      <div data-hint="${i}" style="font-size:11px;margin-top:5px;min-height:15px"></div>
      <details style="margin-top:4px"><summary style="font-size:11px;opacity:.7;cursor:pointer">ดูคะแนนรายยีน</summary>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:4px">
        <tr style="opacity:.7;text-align:left"><th style="padding:2px 4px">ยีน</th><th>ตัวนี้</th><th>เป้า</th><th>ตรง</th><th>คูณ</th><th style="text-align:right">เหรียญ</th></tr>
        ${b.map(x => `<tr style="border-top:1px solid #202b2b"><td style="padding:2px 4px">${esc(x.label)}</td>
          <td style="opacity:.8">${esc(geneText(x.k, x.mine))}</td>
          <td style="opacity:.8">${esc(geneText(x.k, x.want))}</td>
          <td style="color:${x.pct >= 90 ? '#9fd39a' : x.pct >= 75 ? '#d9c98a' : '#8a7f70'}">${x.pct.toFixed(0)}%</td>
          <td style="opacity:.8">×${x.mul}</td>
          <td style="text-align:right;color:${x.mul >= 1 ? '#9fd39a' : '#8a7f70'}">${coin(x.coin)} / ${coin(x.full)}</td></tr>`).join('')}
        </table></details></div>`;
  }

  function hintFor(value, ask) {
    if (!(ask > 0)) return ['#e08b7a', 'ใส่ราคาก่อน'];
    const s = simulate(value, ask);
    if (!s.sold) return ['#e08b7a', `แพงเกินไป (${(ask / value).toFixed(2)}× ราคากลาง) — ไม่มีใครซื้อ ทากจะถูกส่งคืนใน 3 ชม.`];
    const late = s.at > SELL_MS * HAGGLE_AT;
    return [late ? '#e0b07a' : '#9fd39a',
      `คาดว่าขายได้ใน ~${fmtLeft(s.at)}` + (s.price < ask ? ` แต่โดนต่อราคาเหลือ ${coin(s.price)}` : ` เต็ม ${coin(ask)}`)];
  }

  function renderMarket(full) {
    const m = market(), t = m.trend, showcase = getShowcase(m);
    if (!full && marketDialog.querySelector('[data-mk-listings]')) return refreshLive();

    let _all = availableSlugs().map(e => ({ ...e, target: t.target, value: valueOf(e.slug.genes, t.target) }))
                             .sort((a, b) => b.value - a.value);
    const _q = _availFilter.trim().toLowerCase();
    if (_q) _all = _all.filter(e => (String(e.slug.id)+' '+SlugBrowser.name(e.slug)).toLowerCase().includes(_q));
    const _total = _all.length;
    _avail = SlugBrowser.apply(_all,'market',e=>e.slug).slice(0,60);
    const listings = m.listings.slice().sort((a, b) => b.prog - a.prog);

    marketDialog.innerHTML =
      `<div style="display:flex;align-items:center;justify-content:space-between"><b>🌐 ตลาดโลก</b><button class="tbtn" data-close>✕</button></div>
      <p style="font-size:12px;opacity:.85;margin:8px 0">คุณตั้งราคาเอง — <b>ถูกกว่าราคากลาง = ขายไว</b> · <b>แพงกว่า = ช้า</b> · เกิน ${R_DEAD}× ของราคากลาง = ไม่มีใครซื้อ<br>
      ผ่านครึ่งเวลาแล้วผู้ซื้อจะเริ่มต่อราคา (ลดได้ถึง ${Math.round(HAGGLE_MAX * 100)}%) · ครบ 3 ชม. ยังไม่ขาย ทากจะกลับเข้าคลัง<br>
      เทรนเปลี่ยนใน <b data-mk-refresh>${fmtLeft(t.refreshAt - now())}</b></p>

      <h3 style="margin:14px 0 6px">ทากตัวอย่างที่ตลาดต้องการตอนนี้</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${showcase.map((c, i) =>
        `<div style="flex:1;min-width:120px;padding:8px;border:1px solid #47605f;border-radius:8px;text-align:center">
          <canvas data-mk-show="${i}" width="240" height="168" style="width:100%;height:auto;background:#0f1e22;border-radius:6px;cursor:zoom-in"></canvas>
          <div style="margin-top:4px;font-size:12px">ราคากลาง <b>${coin(c.value)}</b></div></div>`).join('')}</div>

      <h3 style="margin:16px 0 6px">บนชั้นวาง (<span data-mk-count>${listings.length}</span>/${MAX_LIST} ช่อง)</h3>
      <div data-mk-listings>${listings.length ? listings.map(listingRowHtml).join('')
        : '<p style="font-size:12px;opacity:.7">ยังไม่มีทากในตลาด — เลือกจากด้านล่างมาลงขายได้เลย</p>'}</div>

      <h3 style="margin:16px 0 6px">เลือกทากลงขาย <span style="font-size:12px;font-weight:400;opacity:.6">(แสดง ${_avail.length}/${_total})</span></h3>
      <input data-mk-filter placeholder="🔍 ค้นหาไอดีทาก..." value="${esc(_availFilter)}" style="width:100%;box-sizing:border-box;margin-bottom:6px;background:#0f1e22;color:#e5dcc4;border:1px solid #47605f;border-radius:6px;padding:7px 10px">
      <div style="max-height:38vh;overflow:auto;border:1px solid #33403f;border-radius:8px">
        ${_avail.length ? _avail.map(availRowHtml).join('')
          : '<p style="font-size:12px;opacity:.7;padding:8px">ไม่มีทากที่ลงขายได้ (ตัวที่กำลังผสม/ถือ/มีข้อเสนอ จะลงไม่ได้)</p>'}</div>`;

    SlugBrowser.mount(marketDialog,'market',()=>renderMarket(true));
    showcase.forEach((c, i) => paint(marketDialog.querySelector(`[data-mk-show="${i}"]`), 'show' + i + t.refreshAt, c.genes));
    showcase.forEach((c, i) => { const cv = marketDialog.querySelector(`[data-mk-show="${i}"]`); if (cv) cv.onclick = () => openZoom(c.genes, c.value); });
    startAnim();
    for (const L of listings) paint(marketDialog.querySelector(`[data-mk-list="${CSS.escape(L.key)}"]`), L.key, L.genes);
    _avail.forEach((e, i) => { const cv = marketDialog.querySelector(`[data-mk-avail="${i}"]`); if (cv) { try { drawSlugPortrait(cv, e.slug); SlugBrowser.heart(cv.parentElement,e.slug,()=>renderMarket(true),'market'); } catch (err) {} } });

    marketDialog.querySelector('[data-close]').onclick = () => marketDialog.close();
    bindListingButtons();
    _avail.forEach((e, i) => {
      const input = marketDialog.querySelector(`[data-ask="${i}"]`), hint = marketDialog.querySelector(`[data-hint="${i}"]`);
      const upd = () => {
        _askDraft.set(e.slug.id, input.value);
        const [c, txt] = hintFor(e.value, +input.value);
        hint.style.color = c; hint.textContent = txt;
      };
      input.oninput = upd; upd();
      marketDialog.querySelector(`[data-list="${i}"]`).onclick = () => listSlug(e, +input.value);
    });
    const _flt = marketDialog.querySelector('[data-mk-filter]');
    if (_flt) _flt.oninput = () => { _availFilter = _flt.value; renderMarket(true); const f2 = marketDialog.querySelector('[data-mk-filter]'); if (f2) { f2.focus(); const pcur = f2.value.length; try { f2.setSelectionRange(pcur, pcur); } catch (e) {} } };
  }

  function bindListingButtons() {
    marketDialog.querySelectorAll('[data-unlist]').forEach(b => b.onclick = () => unlist(b.dataset.unlist));
  }
  // อัปเดตเฉพาะส่วนที่เดินตามเวลา — ไม่แตะช่องกรอกราคาที่ผู้เล่นกำลังพิมพ์
  function refreshLive() {
    const m = market(), box = marketDialog.querySelector('[data-mk-listings]');
    if (!box) return;
    const listings = m.listings.slice().sort((a, b) => b.prog - a.prog);
    box.innerHTML = listings.length ? listings.map(listingRowHtml).join('')
      : '<p style="font-size:12px;opacity:.7">ยังไม่มีทากในตลาด — เลือกจากด้านล่างมาลงขายได้เลย</p>';
    for (const L of listings) paint(box.querySelector(`[data-mk-list="${CSS.escape(L.key)}"]`), L.key, L.genes);
    bindListingButtons();
    const cnt = marketDialog.querySelector('[data-mk-count]'); if (cnt) cnt.textContent = listings.length;
    const rf = marketDialog.querySelector('[data-mk-refresh]'); if (rf) rf.textContent = fmtLeft(m.trend.refreshAt - now());
  }

  window.openWorldMarket = function () { renderMarket(true); if (!marketDialog.open) marketDialog.showModal(); startAnim(); };
  window.WorldMarket = { market, listSlug, unlist, tick, collectSold, MAX_LIST, valueOf, breakdown, matchPct, multOf,
                         timeToSell, simulate, GENE_BASE, GENE_RANGE, MATCH_BANDS, FULL_VALUE, FLOOR_VALUE };

  setInterval(tick, 1000);
})();
