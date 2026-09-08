/* ============================================================
   config.js — ค่าปรับเกมทั้งหมด + สถานะเกม + ตัวช่วยเรื่องทาก
   แก้ไฟล์นี้เพื่อปรับบาลานซ์ (ราคา, ขนาดพื้นที่, ขนาดตู้/ความจุ ฯลฯ)
   ============================================================ */

/* ---- กริด + สเกลจริง ----
   1 ช่องใหญ่ = 50 cm · 10×10 ช่องเล็ก = 1 ช่องใหญ่ → 1 ช่องเล็ก = 5 cm */
const SUB        = 10;     // ช่องเล็กต่อช่องใหญ่ (10×10)
const CM_PER_BIG = 50;     // 1 ช่องใหญ่ = 50 ซม.
const CM_PER_CELL= CM_PER_BIG / SUB;   // = 5 ซม. ต่อช่องเล็ก
const START_BW   = 8;      // พื้นที่เริ่มต้น กว้าง (ช่องใหญ่) = 4 เมตร
const START_BH   = 6;      // พื้นที่เริ่มต้น ลึก (ช่องใหญ่) = 3 เมตร
const MAX_B      = 32;     // ขยายได้ถึง 32×32 ช่องใหญ่ (16×16 เมตร)
const TW         = 26;     // ครึ่งกว้างช่องเล็กบนจอ (ไอโซเมตริก)
const TH         = 13;     // ครึ่งสูงช่องเล็กบนจอ

/* ---- เศรษฐกิจ ---- */
/* เงินเริ่มต้น: พอซื้อตู้เล็ก 1 ใบ + กล่องทากปกติ 1 กล่อง + อาหารสองสามชิ้น
   เดิม 30,000 = ซื้อพื้นที่ครึ่งแผนที่ได้ตั้งแต่วินาทีแรก */
const START_COIN  = 1000;

/* ---- อัตราลูกค้าที่ "อยากซื้อ" (ตัวคูมรายได้หลักของเกม) ----
   ลูกค้ายังเดินเข้าร้านเท่าเดิม แค่คนที่ตั้งใจมาซื้อน้อยลง → การขายแต่ละครั้งมีความหมาย
   คนเดี่ยว/คู่: ต่อคน · ครอบครัว: คูณเข้ากับสูตรเดิมใน familyPurchaseChance() */
const BUY_CHANCE = 0.10;          // อัตราพื้นปลายเกม (เดิม 0.04)
const BUY_FAMILY_SCALE = 0.4;     // เดิม 1
/* ---- อัตราขอซื้อช่วงแรกสูง แล้วค่อยลดหาอัตราพื้น (ช่วยผู้เล่นตั้งตัว) ----
   นับจาก "จำนวนทากที่ขายไปแล้ว" (G.stats.sold) ไม่ใช่เวลา/เหรียญ
   → ทุนก้อนจากเควสไม่ทำให้ช่วงแรกหมดเร็ว · ขายครบ BUY_EARLY_UNTIL_SOLD ตัว = ลงมาที่ BUY_CHANCE */
const EARLY_BUY_CHANCE     = 0.30;   // อัตราช่วงแรก (ยังไม่เคยขาย)
const BUY_EARLY_UNTIL_SOLD = 15;     // ขายครบกี่ตัวถึงจบช่วงแรก
function buyChance(){
  const sold=(G.stats&&G.stats.sold)||0;
  const t=Math.min(1, sold/BUY_EARLY_UNTIL_SOLD);
  return EARLY_BUY_CHANCE + (BUY_CHANCE - EARLY_BUY_CHANCE)*t;   // 0.30 → 0.10 เชิงเส้น
}

/* ---- ค่าอาหาร / ของตกแต่งในตู้ (เดิมฟรีทั้งคู่) ---- */
const FOOD_COST_PER_SAT = 0.1;    // ราคา = ค่าอิ่ม × จำนวนคำ × ค่านี้ (สาหร่าย Lv3 = 40×15×0.1 = 60)
const DECOR_COST_PER_CM = 2;      // ราคาของตกแต่งในตู้ = ความกว้างจริง (ซม.) × ค่านี้

/* ---- กล่องสุ่มทาก: จำกัดเป็น "สต็อก" ไม่ใช่ราคา ---- */
const SLUG_BOX_REFILL_MS = 3600000;   // เติมสต็อก 1 กล่องต่อ 1 ชั่วโมง (นับเวลาจริง แม้ปิดเกม)
const SLUG_BOX_MAX = 3;               // ค้างสต็อกได้สูงสุด 3 → ไม่ซื้อรัวทีละสิบตัว
const SLUG_DELIVERY_MS = 60000;       // สั่งกล่องทากแล้วหน่วงส่ง ~1 นาที (เวลาจริง) ค่อยมาถึงเคาน์เตอร์

/* ---- ทิศแสง (ชุดเดียวคุมทั้งฉาก) ----
   แสงมาจากมุมบนซ้าย 45° · เงา/ด้านมืดทอดไปล่างขวา 45°
   LIGHT = เวกเตอร์จากพื้นผิว "ชี้ไปหาแหล่งแสง" (บนซ้าย) */
const LIGHT = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };   // (-0.707, -0.707) = บนซ้าย 45°

/* ---- พฤติกรรมทากในตู้ (จำลองสิ่งมีชีวิต) ---- */
const SLUG_SPEED_CM = 0.72;                      // cozy pace — คลานเอื่อย ไม่รีบตัดฉาก
const SLUG_SPEED    = SLUG_SPEED_CM / CM_PER_CELL;// แปลงเป็นช่องพื้น/วินาที
const SLUG_TURN     = 1.6;                        // ความไวในการหันหัว (สูง=หันไว)
const REST_MIN=5.0, REST_MAX=11.0;                // เว้นช่องว่างระหว่างกิจกรรมให้ฉากหายใจ
const WALK_MIN=4.0, WALK_MAX=8.0;
const SLEEP_MIN=10.0, SLEEP_MAX=20.0;
const WAKE_TIME=2.25;
const INSPECT_TIME=4.2;
const GREET_TIME=2.8;
const STARTLE_TIME=1.20;
const STRETCH_TIME=2.75;
const SNEEZE_TIME=1.85;
const FOLLOW_TIME=10.0;
const DASH_CHARGE_TIME=1.15;                      // ชาร์จช้าให้เห็นว่าหดตัวเต็มที่ก่อนดีด
const DASH_TIME=1.30;
const DASH_SPEED=17.0;                            // ระยะรวมราว 3 ช่องพื้น (~16 ซม.) ถ้าไม่ชนอะไร
const FLEE_MIN=2.8, FLEE_MAX=4.6;
const FLEE_SPEED=1.38;
/* ---- เกาะกระจก ----
   กำแพงคือ "พื้นอีกผืนที่ตั้งฉาก" ทากเดินบนนั้นด้วย SLUG_SPEED ตัวเดียวกับบนพื้น
   จึงไม่มีค่าเวลาไต่/เวลาเกาะค้างของตัวเองอีกแล้ว (เดิมมี CLIMB_RISE/CLIMB_HOLD/CLIMB_DRIFT
   ซึ่งทำให้ไต่เร็วกว่าเดินจริง 6 เท่า และ "ไหลไปด้านข้าง" ตอนขึ้นถึงยอด) */
const CLIMB_MAX_CM=18;                            // เพดานความสูงที่ไต่ขึ้นไปได้ (ซม. จากพื้นตู้)
const CLIMB_MAX=CLIMB_MAX_CM/CM_PER_CELL;         // แปลงเป็นหน่วยช่อง (z)

/* ขนาดตัวจริงจากยีน girth: 0→6cm · 50→8cm · 100→10cm */
function slugCm(g){ return 6 + (g.girth/100)*4; }
/* ---- ขยายร้าน: ราคาต่อช่องแพงขึ้นตามขนาดร้าน (เดิมคงที่ 60 ทุกช่อง) ----
   ราคาช่องถัดไป = EXPAND_BASE × (พื้นที่ปัจจุบัน ÷ พื้นที่เริ่มต้น) ^ EXPAND_EXP
   ช่องแรก 600 → ช่องสุดท้าย ~4,380 · รวมทั้งแผนที่ ~2,700,000 เหรียญ
   จำลองแล้วได้ราว 780 ชม. ถึงเต็ม 32×32 (เล่นวันละ 2 ชม. = 1.07 ปี)
   รู้สึกช้า/เร็วไป: ขยับ EXPAND_BASE อย่างเดียวพอ (ทั้งเส้นขยับตาม)

   200 → 600 เมื่อเพิ่มตลาดโลก (2026-09-07): เส้นเดิมจูนบนรายได้ 1,150 เหรียญ/ชม.
   จากเคาน์เตอร์ทางเดียว · ตลาดโลก 5 ช่อง (ขายเร็วสุด 30 น.) เติมอีก ~2,600 หักค่าอาหาร
   ~290 (ทากกิน 50 หน่วยอิ่ม/ชม. × 0.1 เหรียญ/หน่วย) → สุทธิ ~3,470 = 3.02 เท่าของเดิม
   สูตร: EXPAND_BASE = 200 × (รายได้จริง ÷ 1,150) · วัดรายได้จริงได้จาก js/econ-stats.js */
const EXPAND_BASE = 600;
const EXPAND_EXP  = 0.65;
const START_AREA  = START_BW * START_BH;
function expandTileCost(area){ return Math.round(EXPAND_BASE*Math.pow(Math.max(1,area)/START_AREA, EXPAND_EXP)); }
function expandCost(n, area){ let s=0; for(let i=0;i<n;i++) s+=expandTileCost(area+i); return s; }
const DECO_REFUND = 0.5;   // เก็บของตกแต่งคืนได้กี่ % ของราคา

/* ---- การเรนเดอร์ตู้ในหน้าร้าน ---- */
const STAND_H = 30;        // ความสูงขาตั้ง (โลก px)
const TANK_H  = 26;        // ความสูงตัวตู้แก้ว (โลก px)

/* ---- สัดส่วนความสูงของตู้ (แหล่งความจริงเดียว ใช้ทั้งหน้าร้านและโหมดดูตู้) ----
   สูงกระจก = ความยาว "ด้านสั้น" ของฐาน (ด้านลึก) → หน้าตัดข้างเป็นจัตุรัสพอดี
     50×50 → 50 · 100×50 → 50 · 100×100 → 100 · 150×100 → 100
   ตู้ไหนอยากล็อกเป็นเลขอื่น ใส่ glassCm ลงใน CATALOG ตัวนั้นได้เลย
   ขาตั้ง = สูงเท่ากันทุกตู้ (ความสูงโต๊ะ) ปากตู้ในร้านจะได้เรียงเป็นแนวเดียวกัน */
const TANK_STAND_CM = 35;
function tankGlassCm(def){
  if(def.glassCm) return def.glassCm;                      // ระบุเองในแคตตาล็อกได้
  return Math.min(def.w,def.h)*CM_PER_CELL;
}
const tankGlassCells = def => tankGlassCm(def)/CM_PER_CELL;   // หน่วยช่องเล็ก
const tankStandCells = ()  => TANK_STAND_CM/CM_PER_CELL;

/* ---- กติกาความจุ ----
   ทาก 1 ตัวใช้พื้นที่ 20×20 ซม. = 400 ตร.ซม. (คิดแบบพื้นที่รวม)
   ความจุตู้ = พื้นที่ตู้ (ตร.ซม.) ÷ 400
     50×50=6 · 100×50=12 · 100×100=25 · 150×100=37                             */
const SLUG_AREA_CM  = 20*20;                        // พื้นที่ต่อทาก 1 ตัว = 400 ตร.ซม.
const SLUG_LEN_CELLS = 20 / CM_PER_CELL;            // 4 ช่อง (ใช้วาดกริดอ้างอิง 20 ซม.)
const SLUG_WID_CELLS = 20 / CM_PER_CELL;            // 4 ช่อง

/* ---- สินค้า ----
   ตู้: w,h = footprint (ช่องเล็ก) — เป็นพื้นในตู้ด้วย · glass = สีน้ำ
   ขนาดตู้อิงเป็น "ช่องใหญ่" (1 ช่องใหญ่ = SUB ช่องเล็ก = 50cm)
     ตู้เล็ก  = 1×1 ช่องใหญ่ = 50×50 cm
     ตู้กลาง = 2×1 ช่องใหญ่ = 100×50 cm
     ตู้ใหญ่  = 2×2 ช่องใหญ่ = 100×100 cm
     ตู้ยักษ์ = 3×2 ช่องใหญ่ = 150×100 cm
   ของตกแต่ง: w,h = footprint · col = สี                                        */
const TANK_GLASS_COLOR='#9fd0f0';                  // ทุกขนาดใช้น้ำ/กระจกสีเดียวกัน
const CATALOG = {
  tank_breed:{kind:'tank',name:'ตู้เพาะพันธุ์ 3 ส่วน',icon:'🥚',price:1200,w:3*SUB,h:SUB,glass:TANK_GLASS_COLOR,breeder:true},
  counter: {kind:'deco',name:'เคาน์เตอร์แมวขายทาก',icon:'🐱',price:0,w:2*SUB,h:2*SUB,col:'#826448'},
  tank_s:  {kind:'tank', name:'ตู้เล็ก',  icon:'🐚', price:120,  w:1*SUB, h:1*SUB, glass:TANK_GLASS_COLOR},
  tank_m:  {kind:'tank', name:'ตู้กลาง', icon:'🪸', price:300,  w:2*SUB, h:1*SUB, glass:TANK_GLASS_COLOR},
  tank_l:  {kind:'tank', name:'ตู้ใหญ่',  icon:'🌊', price:560,  w:2*SUB, h:2*SUB, glass:TANK_GLASS_COLOR},
  tank_xl: {kind:'tank', name:'ตู้ยักษ์', icon:'🐋', price:980,  w:3*SUB, h:2*SUB, glass:TANK_GLASS_COLOR},
  rock:    {kind:'deco', name:'หินตกแต่ง', icon:'🪨', price:30, w:2, h:2, col:'#5b6b6f', attr:3},
  plant:   {kind:'deco', name:'สาหร่าย',   icon:'🌿', price:24, w:1, h:1, col:'#3f8f5e', attr:2},
  sign:    {kind:'deco', name:'ป้ายร้าน',  icon:'🪧', price:40, w:2, h:1, col:'#9a7b45', attr:5},
};
/* ความจุตู้: พื้นที่ตู้ (ตร.ซม.) ÷ พื้นที่ต่อตัว (400) */
function tankCap(def){
  const areaCm = ((def.breeder?20:def.w)*CM_PER_CELL) * (def.h*CM_PER_CELL);
  return Math.max(1, Math.floor(areaCm / SLUG_AREA_CM));
}

/* ============================================================
   สถานะเกม (state)
   ============================================================ */
const G = {
  coin: START_COIN,
  boxStock: null,
  stats: {earned:0,spent:0,sec:0,sold:0,fed:0,cleaned:0,bred:0,ordered:0},   // สถิติเศรษฐกิจ (econ-stats.js)               // สต็อกกล่องสุ่มทาก {n, at} — ดู slug-box-shop.js
  bw: START_BW, bh: START_BH,   // พื้นที่ปัจจุบัน (ช่องใหญ่)
  objs: [],                     // ของที่วางบนพื้น {id,type,_key,cx,cy,def,slugs:[]}
  shelf: null,                  // ชั้นวางติดผนัง {side,offset} — ทากที่ลงขายตลาดโลกไปโชว์บนนี้ (wall-shelf.js)
  shelter: [],                  // ตู้ที่ถอดมาพักชั่วคราว
  inv: [],                      // ทากในคลัง (ยังไม่ลงตู้)
  seq: 1,
};
const cam = { x:0, y:0, zoom:1 };          // กล้อง: x,y = จุดโลกกลางจอ
const cellsW = () => G.bw * SUB;           // ช่องเล็กแนวกว้างทั้งหมด
const cellsH = () => G.bh * SUB;

/* ============================================================
   ยีน & ทาก — ผูกกับ SlugEngine (เอนจินยีนตัวจริงจากเกมผสมพันธุ์)
   ยีน 9 ตัว: mainC accC len girth gillLen tentLen vigor gillN spotN
   ============================================================ */
const rgb   = a => 'rgb('+a.map(v=>Math.round(Math.max(0,Math.min(255,v)))).join(',')+')';
const rgbaA = (a,al) => 'rgba('+a.map(v=>Math.round(Math.max(0,Math.min(255,v)))).join(',')+','+al+')';

let engineReady = false;
SlugEngine.ready.then(()=>{ engineReady = true; });

/* สไปรต์ทาก (gradient-map) แพงมาก — แคชต่อตัว (ยีนไม่เปลี่ยน) เรียกสร้างครั้งเดียว
   เดิม slugParts มีแคชในตัวแต่จำได้แค่ 60 → ทากเกิน 60 ตัวจะสร้างใหม่ทุกเฟรม = กระตุก */
function slugPartsOf(s){
  // Aura is derived from vigor; there is no separate aura gene.
  const displayGenes=typeof foodGenes==='function'?foodGenes(s):s.genes;
  const key=SlugEngine.GENES.map(g=>displayGenes[g.k]).join('|');
  if(s._partsKey!==key){ s._parts=null; s._sprite=null; s._auC=null; s._ts=null; s._partsKey=key; }
  if(!s._parts && engineReady) s._parts = SlugEngine.slugParts(displayGenes, 100);
  return s._parts;
}

/* หน้าร้าน: ทากตัวเล็กมาก + มีเยอะ → คอมโพสิตทุกชิ้น(ตัว+หงอน+หนวด+หน้า)ทุกเฟรมไม่ไหว
   เรนเดอร์เป็นสไปรต์นิ่ง 1 รูปต่อตัว (ครั้งเดียว) แล้ว blit ทีเดียว = เร็วขึ้นสิบเท่า
   (ในตู้ยังคงอนิเมชันเต็ม เพราะตัวใหญ่+น้อย) */
function slugHasAura(s){ const P=slugPartsOf(s); return !!(P && P.D.aura>0); }  // สีเหงือกสุดขั้ว(≈100/0)=โลหะเต็ม→เรือง
function slugSprite(s){
  const P=slugPartsOf(s); if(!P) return null;
  if(s._sprite) return s._sprite;
  const aura=P.D.aura>0, pad=aura?26:6;                          // เผื่อขอบให้ออร่าไม่โดนตัด
  const w=Math.ceil(P.w)+pad*2, h=Math.ceil(P.h)+pad*2;
  const c=document.createElement('canvas'); c.width=Math.round(w*DPR); c.height=Math.round(h*DPR);
  const cc=c.getContext('2d'); cc.setTransform(DPR,0,0,DPR,0,0);
  const prev=SlugEngine.ANIM; SlugEngine.ANIM=false;                  // โพสนิ่ง
  SlugEngine.drawSlug(cc, P, w/2, h/2, false, 0, 1, aura, false);     // อบออร่าเข้าไปในสไปรต์ถ้ามี
  SlugEngine.ANIM=prev;
  return (s._sprite={ c, w, h });
}

/* ===== ของตกแต่งในตู้ (billboard หน้าตรง) =====
   wCm     = ความกว้างภาพจริง (ซม.) · anchor = จุดฐานสัมผัสทราย (สัดส่วนในภาพ จาก alpha)
   solid   = ฐานกันชน (ช่อง w×h) ที่ทากเดินผ่านไม่ได้ (เดินอ้อม/ไปหลังได้) ให้ดูมีความหนา */
/* ⚠️ ชิ้นที่ทำผ่านเครื่องมือ "Dec grid" อยู่ใน js/decor-defs.js — เครื่องมือเขียนไฟล์นั้นให้เอง
   ห้ามแก้ที่นี่ ตรงนี้เหลือไว้เฉพาะฟอร์แมตเก่า (rect) ที่ยังไม่ได้ทำผ่านเครื่องมือ */
/* ไม่มีของตกแต่งติดมากับเกมแล้ว — ทุกชิ้นมาจาก decor-defs.js ที่สร้างด้วย Dec grid
   (ยังรองรับฟอร์แมต rect เก่า solid:[w,h] อยู่ ถ้าวันหลังอยากใส่มือ) */
const TANK_DECOR_LEGACY = {};
/* decor-defs.js ทับของเก่าเสมอ — คีย์ซ้ำ ให้ไฟล์จากเครื่องมือชนะ */
const TANK_DECOR = Object.assign({}, TANK_DECOR_LEGACY,
  (typeof DECOR_DEFS !== 'undefined' ? DECOR_DEFS : {}));

/* ราคาของตกแต่งในตู้ — คิดจากความกว้างจริงของชิ้นนั้น */
function decorPrice(key){ const d=TANK_DECOR[key]; return Math.max(20, Math.round((d&&d.wCm||20)*DECOR_COST_PER_CM)); }

const _decorImg = {};
function decorImg(key){
  let e=_decorImg[key];
  if(!e){ e={img:new Image(), ok:false}; e.img.onload=()=>{ e.ok=true; };
    e.img.onerror=()=>{ console.warn('[decor] โหลดรูปไม่ได้:', key, '→', TANK_DECOR[key].src,
      '· ถ้าเป็น path ให้ก็อป PNG ไปไว้ที่ shop_floor/assets/decor/ ชื่อตรงเป๊ะ'); };
    /* ห้ามเซ็ต src เป็นค่าว่าง/undefined เด็ดขาด — เบราว์เซอร์จะตีความว่า "โหลดตัวหน้าเว็บเอง"
       แล้วขึ้น Unsafe attempt to load URL ... (file: ทุกไฟล์ถือเป็นคนละ origin) */
    const _u = TANK_DECOR[key] && TANK_DECOR[key].src;
    if(_u) e.img.src=_u; else console.warn('[decor] ไม่มี src ให้โหลด:', key);
    _decorImg[key]=e; }
  return e;
}
/* ไม่พรีโหลดทั้งหมดแล้ว — ของตกแต่งอาจมีเป็นร้อยชิ้น ยิงร้อย request ตอนเปิดเกมไม่ไหว
   decorImg() โหลดรูปตอนถูกใช้ครั้งแรกเอง (แถบเลือกของ + ตอนวาดในตู้) */

function slugBaseHex(g){ return SlugEngine.hex(SlugEngine.derived(g).base); }  // สีลำตัวจริงจากยีน
function slugAccHex(g){  return SlugEngine.hex(SlugEngine.derived(g).acc);  }  // สีหงอนเหงือกจริง
function gillCount(g){   return SlugEngine.derived(g).nGill; }                 // จำนวนหงอนจริง
function spotCount(g){   return SlugEngine.derived(g).nSpot; }                 // จำนวนลายจริง

/* ============================================================
   นิสัยประจำตัว (เอกลักษณ์) — บางส่วนมาจากยีน บางส่วนสุ่มติดตัว
   ยีน vigor → พลัง/ความกล้า · tentLen → ความช่างสำรวจ
   ค่าทุกตัว 0..1 เอาไปคุม "ความน่าจะเป็น" ของพฤติกรรมใน tank-view.js
   ============================================================ */
function slugTraits(g){
  const R=Math.random, cl=v=>Math.max(0,Math.min(1,v));
  const vig=(g.vigor??50)/100, tnt=(g.tentLen??50)/100;
  const energy = cl(0.20 + vig*0.65 + R()*0.15);            // คึก/ขยับเยอะ (จาก vigor)
  const bold   = cl(0.12 + vig*0.45 + R()*0.38);            // กล้า/ชอบดีดพุ่ง+ไต่
  const curious= cl(0.18 + tnt*0.42 + R()*0.40);            // ชอบสำรวจหิน (จากหนวด)
  const social = cl(0.10 + R()*0.85);                       // เข้าหาเพื่อน/ทักทาย
  const shy    = cl(0.12 + R()*0.72*(1-energy*0.45));       // ขี้ตกใจหนี
  const sleepy = cl(0.15 + (1-energy)*0.5 + R()*0.28);      // ชอบนอน
  return {energy,bold,curious,social,shy,sleepy};
}
const SLUG_NICKS=['ปุ๊กปิ๊ก','ตุ๊กติ๊ก','น้องวุ้น','เจ้าจุด','ฟองเต้าหู้','มะนาว','ข้าวปั้น','เต่าหอย','ป๋องแป๋ง','ดุ๊กดิ๊ก','หมึกกรอบ','ซูชิ','วาซาบิ','เยลลี่','บ๊วย','ลูกตาล','งับงับ','จิ๋ว','อ้วนกลม','สาหร่าย','ต้มจืด','ไข่ดาว'];
function slugNick(s){ let h=0; const id=''+s.id; for(let i=0;i<id.length;i++) h=(h*31+id.charCodeAt(i))>>>0; return SLUG_NICKS[h%SLUG_NICKS.length]; }
function slugPersona(t){
  if(!t) return 'เรื่อยเปื่อย';
  const items=[['จอมพลัง',t.energy*(0.6+t.bold*0.8)],['นักผจญภัย',t.bold],['นักสำรวจ',t.curious],
               ['เจ้าสังคม',t.social],['ขี้อาย',t.shy],['ขี้เซา',t.sleepy]];
  items.sort((a,b)=>b[1]-a[1]);
  return items[0][1] < 0.5 ? 'เรื่อยเปื่อย' : items[0][0];
}
function makeSlug(genes){
  const g = genes || SlugEngine.randGene();
  const traits = slugTraits(g);
  return {
    id:'s'+(G.seq++), genes: g,
    fx:1, fy:1,                                  // ตำแหน่งบนพื้นเอียงในตู้ (ช่องพื้น)
    dir: Math.random()*6.283, ph: Math.random()*6.283, spd: 0.5 + Math.random()*0.6,
    state:'rest', stt:REST_MIN+Math.random()*(REST_MAX-REST_MIN),
    traits, personality: traits.shy,             // personality เดิม = ความขี้อาย (โค้ดเก่ายังใช้ได้)
    climbZ:0
  };
}
function placeOnFloor(s, t){
  // พื้นในตู้ = ขนาด footprint ของตู้ (w×h ช่องเล็ก)
  if(s._meal){delete s._meal.food.reserved[s.id];s._meal=null;}delete s._foodZoneLo;delete s._foodZoneHi;delete s._zoneTank;delete s._breedVisual;delete s._breedScale;
  if(t.def.breeder&&s.breedZone){s.fx=22.5;s.fy=2+Math.random()*6;return;}
  s.fx = 0.8 + Math.random()*((t.def.breeder?20:t.def.w)-1.6);
  s.fy = 0.5 + Math.random()*(t.def.h-1);
}

/* เพาะทากเริ่มต้นในคลัง (จำลองว่ามาจากระบบผสมพันธุ์ — จุดนี้ต่อเข้ากับ roster จริงได้) */
/* เริ่มเกม: ทากค่ากลางทุกยีน (=50) แค่ 2 ตัว = "คู่พ่อแม่" ตั้งต้น
   ต้องเพาะให้ได้ลูกก่อนถึงมีตัวเหลือขาย/ส่งออเดอร์ (กันไม่ให้ขายคู่ผสมทิ้งจนตัน) */
for(let i=0;i<2;i++){const gm=Object.fromEntries(SlugEngine.GENES.map(g=>[g.k,50]));gm.mainC=200;gm.accC=200;/* สี 200 = ขาว (ดีฟอลต์) ทั้งตัวและหงอน */ G.inv.push(makeSlug(gm));}
