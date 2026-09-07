// Genetics copied from the current Genemix; independent lab state per tank.
const BreedingGenes=(()=>{const GENES=SlugEngine.GENES,gr=SlugEngine.gr,derived=SlugEngine.derived;
const BREED_CFG = {
  min: 0, max: 100,
  zeroW:   [0.30, 0.34, 0.24, 0.12],  // น้ำหนักของ "จำนวนยีนที่ไม่ขยับ" = 0,1,2,3 ตัว
  spread:  1.15,    // >1 = จำนวน + ต่อรอบเกาะกลุ่มรอบครึ่ง ๆ มากขึ้น
  bias:    0.95,    // แรงดึงกลับของยีนที่ดริฟต์ทางเดียว (0 = ปิดกลไกนี้)
  decay:   0.86,    // ความจำของบัญชีหนี้
  debtCap: 3.5,     // หนี้เท่านี้ = ดึงกลับเต็มแรง
  pitySoft: 12,     // ครั้งที่เริ่มมีโอกาสยกแถว
  pityHard: 20,     // ครั้งที่การันตี
  dad: 0.5, mom: 0.5, // (เลิกใช้แล้วในโหมดตู้เพาะ — ดู copyChance ด้านล่าง)
  /* ---- ประตูก่อนบวกลบ (ผู้ใช้เพิ่มเอง 2026-08-28) ----
     ก่อนจะไปทางบวกลบปกติ ยีนแต่ละตัวทอยกันก่อนว่าจะ "ก็อปฝั่งพ่อแม่มาเต็ม ๆ" ไหม
       · copyChance ของโอกาส → ก็อปค่าพ่อแม่มาตรง ๆ (หาร 50/50 ว่าพ่อหรือแม่) ไม่ผ่านบวกลบ
       · ที่เหลือ            → เส้นทางเดิม: เฉลี่ยพ่อแม่ แล้วค่อยบวกลบ
     ผลที่ตั้งใจ: ยีนแรร์มีทาง "รอด" ข้ามรุ่นได้ 10% ต่อยีน ไม่ไหลกลับเข้ากลางเสมอไป */
  copyChance: 0.10  // 1/10 = 10%
};
const BKEYS = GENES.map(G => G.k);

/* ตัวสุ่มแบบมีเมล็ด — ผสมซ้ำด้วยเมล็ดเดิมได้ผลเดิมเป๊ะ ตรวจสอบย้อนหลังได้ */
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(str){
  let h = 2166136261 >>> 0;
  for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/* ---------- ตัวสุ่มระดับ "รัน" ----------
   เดิมทีปุ่มสุ่มพ่อแม่กับเมล็ดของการผสมแต่ละครั้ง ดึงจาก Math.random() ตรง ๆ
   แปลว่า "ไม่ได้ผูกกับอะไรเลย" — เปิดหน้าใหม่ได้คนละชุด ย้อนกลับมาดูซ้ำไม่ได้
   ตอนนี้ทุกจุดที่สุ่มวิ่งผ่าน rnd0() จุดเดียว
   · ปล่อยว่าง       → Math.random() เหมือนเดิม (สุ่มจริง ไม่ซ้ำ)
   · ใส่เมล็ดรัน     → ทั้งพ่อแม่ที่สุ่ม และลูกทุกตัวตามลำดับ ออกมาเหมือนเดิมทุกครั้ง
     ใช้ตอนอยากแก้ค่าใน BREED_CFG แล้วเทียบว่าผลต่างมาจากค่าที่แก้ ไม่ใช่มาจากดวง */
let RUNSEED = null, RUNRND = null;
function runSeedSet(v){
  const t = (v==null) ? '' : String(v).trim();
  RUNSEED = t==='' ? null : hashStr(t);
  RUNRND  = RUNSEED==null ? null : mulberry32(RUNSEED);
  return t;
}
function rnd0(){ return RUNRND ? RUNRND() : Math.random(); }

function newLab(){ const L = {debt:{}, since:0, count:0}; BKEYS.forEach(k => L.debt[k]=0); return L; }

function pickW(rnd, w){
  let s=0; for(const x of w) s+=x;
  let r = rnd()*s;
  for(let i=0;i<w.length;i++){ r-=w[i]; if(r<0) return i; }
  return w.length-1;
}
function gumbel(rnd){ return -Math.log(-Math.log(rnd()+1e-12)+1e-12); }
function binom(n,k){ let r=1; for(let i=1;i<=k;i++) r = r*(n-k+i)/i; return r; }

/* ==================== ขนาดก้าวตามช่วงค่า (ผู้ใช้กำหนดเอง 2026-08-27) ====================
   ก้าวไม่ได้คงที่ ±1/±2 อีกแล้ว — ขึ้นกับว่ายีนนั้นอยู่ห่างจาก 50 แค่ไหน และกำลังจะไปทางไหน
   "ออก" = ห่างจาก 50 มากขึ้น (ไปหา 0 หรือ 100) · "เข้า" = กลับเข้าหา 50

   | ค่ายีน            | ระยะจาก 50 | ก้าวออกได้ | ก้าวเข้าได้ |
   |-------------------|-----------|-----------|------------|
   | 40–60             | ≤10       | 0–4       | 0–4        |
   | 30–40 · 60–70     | ≤20       | 0–3       | 0–4        |
   | 20–30 · 70–80     | ≤30       | 0–2       | 0–3        |
   | 10–20 · 80–90     | ≤40       | 0–2       | 0–4        |
   | 0–10 · 90–100     | ≤50       | 0–2       | 0–5        |

   ผลรวม: ยิ่งไกลจากกลาง ยิ่งดันออกยาก และยิ่งถูกดึงกลับแรง — เป็นหนังยางรัด
   ค่าสุดขั้วจึงหายาก + อยู่ไม่ทน ซึ่งตรงกับที่ราคาขายให้ค่าสุดขั้วแพงที่สุด          */
const STEP_BANDS = [
  {d:10, out:4, in:4},
  {d:20, out:3, in:4},
  {d:30, out:2, in:3},
  {d:40, out:2, in:4},
  {d:50, out:2, in:5}
];
/* ยีนสี mainC/accC ใช้สเกล 0–400 (กลาง 200) ยีนอื่น 0–100 (กลาง 50)
   ทุกอย่างคิดใน "หน่วยปกติ" (ระยะจากกลาง ÷ gscale) แล้วคูณกลับ
   → ความยากในการดันสีถึงสุดขั้ว เท่ากับยีนอื่นเป๊ะ ไม่ได้ยากขึ้นเพราะสเกลกว้างขึ้น */
const gscale = k => (gr(k).max - gr(k).mid)/50;
function stepCap(v, sgn, k){
  if(k==='mainC'||k==='accC')return 5; // Fixed raw color units at every tier.
  const R=gr(k), sc=gscale(k);
  const d = Math.abs(v - R.mid)/sc;
  const B = STEP_BANDS.find(b => d <= b.d) || STEP_BANDS[STEP_BANDS.length - 1];
  const away = (v >= R.mid) ? 1 : -1;       // ที่จุดกลางพอดี ให้บวกนับเป็น "ออก"
  return (sgn === away ? B.out : B.in) * sc;
}
/* ขนาดก้าวจริง — สุ่มเต็มจำนวน 0..cap · minOne = บังคับให้ขยับ (ใช้ในรอบยกแถว) */
function stepMag(rnd, v, sgn, minOne, k){
  if(k==='mainC'||k==='accC')return minOne?1+Math.floor(rnd()*5):Math.floor(rnd()*6);
  const sc = gscale(k), cap = stepCap(v, sgn, k)/sc;
  if(cap <= 0) return 0;
  return (minOne ? 1 + Math.floor(rnd()*cap) : Math.floor(rnd()*(cap+1))) * sc;
}

/* จำนวนยีนที่ได้ + ในรอบนี้ — บังคับอยู่ใน 1..m−1 จึงยกแถวโดยบังเอิญไม่ได้ */
function upCount(rnd, m){
  if(m < 2) return m;
  const w=[]; for(let i=1;i<=m-1;i++) w.push(Math.pow(binom(m,i), BREED_CFG.spread));
  return 1 + pickW(rnd, w);
}

function rollDeltas(rnd, L, base){
  const C = BREED_CFG, n = BKEYS.length;
  L.since++;
  let p = 0;
  if(L.since >= C.pitySoft) p = (L.since - C.pitySoft + 1)/(C.pityHard - C.pitySoft + 1);
  const jackpot = L.since >= C.pityHard ? true : (rnd() < p);

  const d = {}; let dir = 0;
  if(jackpot){
    dir = rnd() < 0.5 ? 1 : -1;
    BKEYS.forEach(k => d[k] = dir * stepMag(rnd, base[k], dir, true, k));   // ห้ามมีตัวไหนเป็น 0
    L.since = 0;
  } else {
    /* 1) ตัวที่ไม่ขยับ — เอนไปหายีนที่หนี้ใกล้ศูนย์อยู่แล้ว */
    const nz = Math.min(pickW(rnd, C.zeroW), n - 2);
    const zr = BKEYS.map(k => ({k, s: -Math.abs(L.debt[k])/C.debtCap*0.8 + gumbel(rnd)}))
                    .sort((a,b) => b.s - a.s);
    const zero = new Set(zr.slice(0, nz).map(o => o.k));
    zero.forEach(k => d[k] = 0);
    /* 2) ที่เหลือ — เรียงด้วย (แรงดึงกลับ + สุ่ม) แล้วผ่าเป็นฝั่ง + กับฝั่ง − */
    const act = BKEYS.filter(k => !zero.has(k)).map(k => {
      const q = Math.max(-1, Math.min(1, L.debt[k]/C.debtCap));
      return {k, s: -C.bias*q + gumbel(rnd)};
    }).sort((a,b) => b.s - a.s);
    const up = upCount(rnd, act.length);
    /* เครื่องหมายมาจากระบบเดิม (บังคับมีทั้ง + และ − · ถ่วงด้วยบัญชีหนี้)
       แต่ "ขนาด" มาจากตารางช่วงค่า จึงอาจออกมาเป็น 0 ได้ = เลือกทางแล้วแต่ไม่ขยับ */
    act.forEach((o,i) => { const sgn = i<up ? 1 : -1;
      d[o.k] = sgn * stepMag(rnd, base[o.k], sgn, false, o.k); });
  }
  return {d, jackpot, dir};
}

/* คืน {v, copied}
   · copied=true  → ก็อปค่าพ่อแม่มาเต็ม ๆ (50/50) จะไม่โดนบวกลบทีหลัง
   · copied=false → จุดกึ่งกลางพ่อแม่ ไว้ให้บวกลบต่อตามเดิม */
function inheritOne(rnd, a, b){
  if(rnd() < BREED_CFG.copyChance){
    return { v: rnd() < 0.5 ? a : b, copied: true };   // ลง 10% → หาร พ่อ50/แม่50
  }
  return { v: Math.round((a+b)/2), copied: false };    // 90% → เฉลี่ยพ่อแม่
}

function breed(dad, mom, L, seed){
  dad=copyGene(dad);mom=copyGene(mom);
  for(const k of BKEYS)if(!Number.isFinite(L.debt[k]))L.debt[k]=0;
  const C = BREED_CFG;
  const s = (seed==null) ? (rnd0()*4294967296)>>>0 : (seed>>>0);
  const rnd = mulberry32(s);
  const base = {}, copied = {};
  BKEYS.forEach(k => { const o = inheritOne(rnd, dad[k], mom[k]); base[k] = o.v; copied[k] = o.copied; });
  const roll = rollDeltas(rnd, L, base);   /* ขนาดก้าวขึ้นกับค่าฐานของยีนนั้น */
  const child = {}, applied = {}, capped = [];
  BKEYS.forEach(k => {
    if(copied[k]){                         /* ก็อปมาเต็ม ๆ → ไม่ขยับ ข้ามบวกลบ */
      child[k] = base[k]; applied[k] = 0;
      return;
    }
    const R=gr(k);
    const v = Math.max(R.min, Math.min(R.max, base[k] + roll.d[k]));
    child[k] = v; applied[k] = v - base[k];
    if(applied[k] !== roll.d[k]) capped.push(k);
  });
  /* บัญชีหนี้จดเฉพาะที่ขยับจริง ตัวที่ชนขอบจึงไม่ถูกจดเกินจริง */
  BKEYS.forEach(k => L.debt[k] = L.debt[k]*C.decay + applied[k]);
  L.count++;
  return {child, base, delta:roll.d, applied, capped,
          jackpot:roll.jackpot, dir:roll.dir, seed:s, no:L.count, pity:L.since};
}


function copyGene(o){
  o=o||{};const r={};for(const k of BKEYS){
    const legacy=k==='bodyDepth'?'deep':k==='gillDepth'?'gdeep':null;
    const fallback=legacy?(Number.isFinite(o[legacy])?o[legacy]*100:45):gr(k).mid;
    r[k]=Number.isFinite(o[k])?o[k]:fallback;
    r[k]=Math.max(gr(k).min,Math.min(gr(k).max,r[k]));
  }return r;
}
return {breed,newLab,copyGene};})();
