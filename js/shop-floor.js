// Phones can zoom out twice as far; desktop limits remain unchanged.
function phoneZoomOutScale(){return matchMedia('(pointer: coarse)').matches && Math.min(screen.width,screen.height)<=600 ? 0.5 : 1;} 
/* ============================================================
   shop-floor.js — หน้าร้าน 2.5D ไอโซเมตริก
   กริดหมากรุกช่องใหญ่ (แต่ละช่อง 8×8 ช่องเล็ก) · กล้อง pan/zoom ·
   วาง/ย้าย/เก็บตู้+ของตกแต่ง · ขยายพื้นที่ · ที่พักพิงชั่วคราว · HUD
   ============================================================ */

/* ---------- แคนวาส ---------- */
const cv = document.getElementById('cv');
let   ctx = cv.getContext('2d');          // let เพราะต้องสลับไปวาดลงแคนวาสแคชชั่วคราว
const _mainCtx = ctx;
function withCtx(c, fn){ ctx=c; try{ fn(); } finally { ctx=_mainCtx; } }
let CW=0, CH=0;
const DPR = Math.min(2, window.devicePixelRatio || 1);

function resize(){
  const r = cv.getBoundingClientRect();
  CW = r.width; CH = r.height;
  cv.width = Math.round(CW*DPR); cv.height = Math.round(CH*DPR);
  if(typeof tankMode!=='undefined' && tankMode) resizeTank();
}

/* ---------- iso ↔ screen ---------- */
function worldOf(cx,cy){ return { X:(cx-cy)*TW, Y:(cx+cy)*TH }; }
function toScreen(X,Y){ return { x:(X-cam.x)*cam.zoom + CW/2, y:(Y-cam.y)*cam.zoom + CH/2 }; }
function P(cx,cy,z=0){ const w=worldOf(cx,cy); return toScreen(w.X, w.Y - z); }   // มุมช่องเล็ก ยกสูง z
function pick(sx,sy){
  const X = (sx-CW/2)/cam.zoom + cam.x;
  const Y = (sy-CH/2)/cam.zoom + cam.y;
  return { cx:(X/TW + Y/TH)/2, cy:(Y/TH - X/TW)/2 };
}

/* ---------- สีช่วยวาดกล่อง ---------- */
function hexToRgb(h){ h=h.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function shadeRgb(a,amt){ return a.map(c=>Math.max(0,Math.min(255,c+amt))); }
function shade(hex,amt){ return rgb(shadeRgb(hexToRgb(hex),amt)); }
function rgbaCss(a,al){ return 'rgba('+a[0]+','+a[1]+','+a[2]+','+al+')'; }

/* เงานุ่มขอบฟุ้ง (rx,ry พิกเซล · rot=มุมเอียง) — แสงบนซ้าย เงาทอดล่างขวา */
function softShadow(c, px,py, rx,ry, alpha, rot){
  c.save();
  c.translate(px,py); if(rot) c.rotate(rot); c.scale(1, ry/rx);
  const g=c.createRadialGradient(0,0,0, 0,0,rx);
  g.addColorStop(0,'rgba(0,0,0,'+alpha+')');
  g.addColorStop(0.6,'rgba(0,0,0,'+(alpha*0.42).toFixed(3)+')');
  g.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=g; c.beginPath(); c.arc(0,0,rx,0,6.283); c.fill();
  c.restore();
}

/* วาดทากพร้อมแสงทิศบนซ้าย (relight ผ่าน offscreen + source-atop) */
let _lit=null, _lctx=null;
function litSlug(mainCtx, P, x, y, flip, phase, scale){
  const d=DPR, pad=16*d;
  const uw=Math.ceil(P.w*scale*d+pad*2), uh=Math.ceil(P.h*scale*d+pad*2);
  if(!_lit){ _lit=document.createElement('canvas'); _lctx=_lit.getContext('2d'); }
  if(_lit.width<uw) _lit.width=uw;
  if(_lit.height<uh) _lit.height=uh;
  const OW=_lit.width, OH=_lit.height, cx=OW/2, cy=OH/2;
  _lctx.setTransform(1,0,0,1,0,0);
  _lctx.clearRect(cx-uw/2, cy-uh/2, uw, uh);
  SlugEngine.drawSlug(_lctx, P, cx, cy, flip, phase, scale*d, false);
  _lctx.globalCompositeOperation='source-atop';       // จัดแสงเฉพาะบนตัวทาก (ทิศ LIGHT 45°)
  const R=Math.max(P.w,P.h)*scale*d*0.55;
  const g=_lctx.createLinearGradient(cx+LIGHT.x*R, cy+LIGHT.y*R, cx-LIGHT.x*R, cy-LIGHT.y*R);
  g.addColorStop(0,   'rgba(255,247,224,0.30)');       // บนซ้าย สว่างอุ่น
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1,   'rgba(10,16,38,0.34)');          // ล่างขวา มืดเย็น
  _lctx.fillStyle=g; _lctx.fillRect(cx-uw/2, cy-uh/2, uw, uh);
  _lctx.globalCompositeOperation='source-over';
  mainCtx.save(); mainCtx.setTransform(1,0,0,1,0,0);
  mainCtx.drawImage(_lit, cx-uw/2, cy-uh/2, uw, uh, x*d-uw/2, y*d-uh/2, uw, uh);
  mainCtx.restore();
}

/* ความสูงตู้/ขาตั้ง = โตตามขนาด footprint (สมส่วนกับพื้น) หน่วย world-z px */
const ZUNIT = 2*TH;                                   // 1 ช่องสูง ≈ ความสูง diamond
/* ใช้สัดส่วนเดียวกับโหมดดูตู้ (config.js) เข้าไปในตู้แล้วสูงเท่าที่เห็นจากหน้าร้าน */
function tankStandH(d){ return tankStandCells()*ZUNIT; }         // ขาตั้ง — เท่ากันทุกตู้
function tankGlassH(d){ return tankGlassCells(d)*ZUNIT; }        // ตัวตู้แก้ว
function decoH(o){ if(o._key==='counter')return 14*ZUNIT; return (o._key==='sign'?2.4:0.5)*Math.min(o.def.w,o.def.h)*ZUNIT; }

/* ---------- การหมุนของที่วางบนพื้นร้าน (0..3 = ×90°) ----------
   หมุนเลขคี่ = สลับด้านกว้างกับด้านลึกของ "รอยเท้า" บนพื้น
   ข้างในตู้ยังใช้พิกัดเดิมของมันเสมอ (เข้าไปดูก็เห็นหน้าตรงเหมือนเดิม)
   มีแค่ตอนวาดลงหน้าร้านเท่านั้นที่ต้องหมุนผังของข้างใน */
function rotW(def, rot){ return (rot&1)? def.h : def.w; }
function rotH(def, rot){ return (rot&1)? def.w : def.h; }
function oW(o){ return rotW(o.def, o.rot|0); }
function oH(o){ return rotH(o.def, o.rot|0); }
/* พิกัดในตู้ (fx,fy) → ออฟเซ็ตบนพื้นร้าน  [0..oW]×[0..oH]
   ฐาน (p,q) = (fx, LH−fy) เพราะแกนลึกของสองมุมมองชี้กลับกัน แล้วค่อยหมุนตาม rot */
function localToFloor(def, rot, fx, fy){
  const LW=def.w, LH=def.h;
  const p=Math.min(LW,Math.max(0,fx)), q=LH-Math.min(LH,Math.max(0,fy));
  switch(rot&3){
    case 1: return [LH-q, p];
    case 2: return [LW-p, LH-q];
    case 3: return [q, LW-p];
    default: return [p, q];
  }
}
/* ผกผัน: ออฟเซ็ตบนพื้นร้าน → พิกัดในตู้ (ใช้ตอนคลิกเข้าตู้เพื่อโฟกัสจุดที่กด) */
function floorToLocal(def, rot, a, b){
  const LW=def.w, LH=def.h; let p,q;
  switch(rot&3){
    case 1: p=b; q=LH-a; break;
    case 2: p=LW-a; q=LH-b; break;
    case 3: p=LW-b; q=a; break;
    default: p=a; q=b;
  }
  return [Math.max(0,Math.min(LW,p)), Math.max(0,Math.min(LH,LH-q))];
}

/* ---------- เครื่องมือ / การเลือก ---------- */
let tool = 'place';       // place | move | remove
let buyRot = 0;           // ทิศของชิ้นที่กำลังจะวาง (0..3 = ×90°) กด R หมุน
let buyKey = null;        // สินค้าที่ "ถืออยู่" — null = มือว่าง (คลิกเพื่อเข้าตู้/ลากย้ายได้ตามปกติ)
const heldRotations=new WeakMap();
function restoreHeldRotation(){if(moving&&heldRotations.has(moving)){moving.rot=heldRotations.get(moving);heldRotations.delete(moving);}}
let moving = null;        // object กำลังย้าย
let movingByClick=false;  // ยกด้วยการคลิก (ปล่อยที่คลิกถัดไป) ต่างจากลากค้าง (ปล่อยตอนปล่อยเมาส์)
let hoverCell = null;
let appMode = 'view';     // 'view' = ดู/เล่น (คลิกตู้=เข้าไปดู) · 'build' = ก่อสร้าง
let shopAnim = true;      // เปิด/ปิดการเคลื่อนไหวทากในหน้าร้าน
let floorLastT = 0;

/* ============================================================
   วาดพื้นร้าน
   ============================================================ */
function bigFill(bx,by){ return (bx+by)%2===0 ? '#123037' : '#0F2A30'; }

/* ============================================================
   ห้อง — ผนังหินอ่อนดำสองด้านตั้งขึ้นจากขอบไกลของพื้นร้าน
   ขอบไกลในไอโซเมตริกคือแนว cy=0 (ขวา-หลัง) กับ cx=0 (ซ้าย-หลัง)
   ============================================================ */
const ROOM_H      = 48*ZUNIT;   // ความสูงผนัง (หน่วย world-z px)
// ขนาดผืนพื้น/กำแพง (cm) ย้ายไปอยู่ในแต่ละรายการของ FLOOR_MATERIALS/WALL_MATERIALS (materials.js) แล้ว
const SHOP_SAND_CM = 40, SHOP_WOOD_CM = 180;      // ต้องตรงกับในโหมดดูตู้ วัสดุจะได้เป็นชิ้นเดียวกัน
const _texs={};
function tex(name){                              // โหลดครั้งเดียว ใช้ซ้ำ
  let e=_texs[name];
  if(!e){ e=_texs[name]={img:new Image(), pat:null}; e.img.src='assets/'+name+'.jpg'; }
  if(!e.img.complete || !e.img.naturalWidth) return null;
  if(!e.pat) e.pat=ctx.createPattern(e.img,'repeat');
  return e;
}
/* ปูเท็กซ์เจอร์บน "ระนาบพื้น" ของหน้าร้าน (ไปทาง cx = (TW,TH) · ไปทาง cy = (−TW,TH)) */
function planePat(name, texCm, ox, oy){
  const e=tex(name); if(!e || !e.pat.setTransform || typeof DOMMatrix==='undefined') return null;
  const T=e.img.naturalWidth/(texCm/CM_PER_CELL), z=cam.zoom;
  e.pat.setTransform(new DOMMatrix([TW*z/T, TH*z/T, -TW*z/T, TH*z/T, ox, oy]));
  return e.pat;
}
/* ============================================================
   ลายแสงใต้น้ำของหน้าร้าน — ชั้นเดียวคลุมทั้งจอ แล้ว clip ให้เหลือเฉพาะผิวน้ำของทุกตู้
   ต้นทุนคงที่ ไม่ขึ้นกับจำนวนตู้: เท pattern 2 ครั้งต่อเฟรม จบ
   (ใช้ผืนลายตัวเดียวกับในโหมดดูตู้ — causticCanvas() อยู่ใน tank-view.js)
   ============================================================ */
const SHOP_CAUSTIC_CM = 115, SHOP_CAUSTIC_A = 0.16;
let _shopCau=null;
function shopCausticPat(sc, dx, dy){
  if(typeof causticCanvas!=='function') return null;
  const src=causticCanvas();
  if(!_shopCau) _shopCau=ctx.createPattern(src,'repeat');
  if(!_shopCau || !_shopCau.setTransform || typeof DOMMatrix==='undefined') return null;
  const T=(src.width/(SHOP_CAUSTIC_CM/CM_PER_CELL))*sc, z=cam.zoom;
  const o=P(dx, dy, 0);                       // เลื่อนต้นทางไปตามระนาบพื้น = ลายไหลไปตามแนวพื้น
  _shopCau.setTransform(new DOMMatrix([TW*z/T, TH*z/T, -TW*z/T, TH*z/T, o.x, o.y]));
  return _shopCau;
}
function drawShopCaustics(list){
  const tanks=list.filter(o=>o.type==='tank' && onScreen(o));
  if(!tanks.length || typeof causticCanvas!=='function') return;
  ctx.save();
  ctx.beginPath();                             // มาสก์ = ผิวน้ำของทุกตู้รวมกัน (path เดียว)
  tanks.forEach(o=>{
    const d=o.def, sh=tankStandH(d), ew=oW(o), eh=oH(o);
    const q=[P(o.cx,o.cy,sh), P(o.cx+ew,o.cy,sh), P(o.cx+ew,o.cy+eh,sh), P(o.cx,o.cy+eh,sh)];
    ctx.moveTo(q[0].x,q[0].y); q.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.closePath();
  });
  ctx.clip();
  const ms=performance.now()/1000, puls=0.88+0.12*Math.sin(ms*0.62);
  ctx.globalCompositeOperation='lighter';
  [ {sc:1.00, dx: ms*0.16+Math.sin(ms*0.23)*0.9, dy: ms*0.07+Math.cos(ms*0.19)*0.7, a:1.00},
    {sc:1.27, dx:-ms*0.11+Math.cos(ms*0.17)*1.1, dy: ms*0.13+Math.sin(ms*0.29)*0.8, a:0.62}
  ].forEach(l=>{
    const pat=shopCausticPat(l.sc, l.dx, l.dy); if(!pat) return;
    ctx.globalAlpha=SHOP_CAUSTIC_A*l.a*puls; ctx.fillStyle=pat;
    ctx.fillRect(0,0,CW,CH);                   // เทเต็มจอครั้งเดียว clip จัดการที่เหลือ
  });
  ctx.restore();
}

/* ปูเท็กซ์เจอร์บน "หน้าตั้ง" — วางตามขอบ a→b ที่ความสูง zt แล้วไล่ลงตามแกนตั้ง */
function facePatShop(name, texCm, a, b, zt){
  const e=tex(name); if(!e || !e.pat.setTransform || typeof DOMMatrix==='undefined') return null;
  const T=e.img.naturalWidth/(texCm/CM_PER_CELL);
  const o=P(a[0],a[1],zt), q=P(b[0],b[1],zt);
  const L=Math.hypot(b[0]-a[0], b[1]-a[1])||1;
  const s=Math.hypot(q.x-o.x, q.y-o.y)/(L*T);
  e.pat.setTransform(new DOMMatrix([(q.x-o.x)/(L*T), (q.y-o.y)/(L*T), 0, s, o.x, o.y]));
  return e.pat;
}
/* ---------- วัสดุพื้น/กำแพงที่เลือกได้ (materials.js) ----------
   pattern แคชแยกต่อไฟล์ภาพ (ใช้ชุดเดียวกับ matImage() ใน materials.js
   จึงไม่โหลดภาพซ้ำกับตอนมองผ่านกระจกตู้ใน tank-view.js) */
const _floorPatCache={}, _wallPatCache={};
function floorMatPatFor(m){
  const img=matImage(m.file); if(!img) return null;
  let pat=_floorPatCache[m.file]; if(!pat) pat=_floorPatCache[m.file]=ctx.createPattern(img,'repeat');
  return {pat, img, m};
}
function wallMatPatFor(m){
  const img=matImage(m.file); if(!img) return null;
  let pat=_wallPatCache[m.file]; if(!pat) pat=_wallPatCache[m.file]=ctx.createPattern(img,'repeat');
  return {pat, img, m};
}
function floorMatPat(){ return floorMatPatFor(currentFloorMat()); }
function wallMatPat(){ return wallMatPatFor(currentWallMat()); }
let _roomC=null, _roomX=null, _roomKey='';   // แคชชั้นห้อง+พื้น
/* ปูวัสดุพื้น "ทีละช่อง" (ไม่ใช่ทั้งผืนแบบเดิม) — แต่ละช่องอาจถูกทาสีต่างกัน (tile-paint.js)
   เวกเตอร์ฐาน (ไป cx = (TW,TH)·zoom · ไป cy = (−TW,TH)·zoom) ยึดจากจุดกำเนิดร้านเสมอ (ไม่ใช่มุมช่อง)
   ลายจึงต่อเนื่องเป็นผืนเดียวข้ามช่องที่ใช้วัสดุเดียวกัน แม้จะวาดแยกทีละช่อง */
function drawFloorTile(bx,by,m){
  const r=floorMatPatFor(m), W=bx*SUB,H=by*SUB;
  const q=[P(W,H),P(W+SUB,H),P(W+SUB,H+SUB),P(W,H+SUB)];
  ctx.beginPath(); q.forEach((p,i)=> i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath();
  if(r && r.pat.setTransform && typeof DOMMatrix!=='undefined'){
    const {pat, img}=r;
    const T=img.naturalWidth/(m.cm/CM_PER_CELL), z=cam.zoom, o=P(0,0,0);
    pat.setTransform(new DOMMatrix([TW*z/T, TH*z/T, -TW*z/T, TH*z/T, o.x, o.y]));
    ctx.fillStyle=pat;
  } else ctx.fillStyle='#123037';
  ctx.fill();

  return q;
}
/* ผนังหนึ่งบาน: จากขอบ a→b บนพื้น ตั้งขึ้นสูง ROOM_H (หรือช่วง z0..z1 ถ้าระบุ — ใช้ตอนวาดทีละช่องความสูง)
   ปูวัสดุกำแพงโดยวางแนวตามขอบผนัง แล้วไล่ลงตามแกนตั้ง สเกลเท่ากันทั้งสองแกนจะได้ไม่ยืด
   จุดยึดลาย/แสง: ใช้ "บนสุดของผนังทั้งบาน" (z=ROOM_H) เสมอ ไม่ใช่มุมของช่องที่กำลังวาดตอนนี้
   ผนังถูกหั่นเป็นช่องความสูงแยกกัน (wallLayerZ) แต่ยังต้องเป็นลายเดียวกันต่อเนื่องกันทั้งบาน
   ถ้ายึดมุมของแต่ละช่องเอง ลายจะ "เริ่มนับใหม่" ทุกช่อง กลายเป็นเห็นเป็นเส้นแบ่งถี่ ๆ ทุก 20 ซม. */
function drawWall(a, b, tint, wallKeyId, z0=0, z1=ROOM_H){
  const q=[P(a[0],a[1],z1), P(b[0],b[1],z1), P(b[0],b[1],z0), P(a[0],a[1],z0)];
  ctx.beginPath(); q.forEach((p,i)=> i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath();
  const r=wallMatPatFor(wallKeyId!=null ? wallMatAt(wallKeyId) : currentWallMat());
  const top=P(a[0],a[1],ROOM_H), topE=P(b[0],b[1],ROOM_H), bottom=P(a[0],a[1],0);
  if(r && r.pat.setTransform && typeof DOMMatrix!=='undefined'){
    const {pat, img, m}=r;
    const T=img.naturalWidth/(m.cm/CM_PER_CELL);   // px เท็กซ์เจอร์ ต่อ 1 ช่องเล็ก
    const L=Math.hypot(b[0]-a[0], b[1]-a[1])||1;
    const s=Math.hypot(topE.x-top.x, topE.y-top.y)/(L*T);        // px จอ ต่อ 1 px เท็กซ์เจอร์
    pat.setTransform(new DOMMatrix([(topE.x-top.x)/(L*T), (topE.y-top.y)/(L*T), 0, s, top.x, top.y]));
    ctx.fillStyle=pat;
  } else ctx.fillStyle='#14100e';
  ctx.fill();
  /* ไล่แสง: บนสว่างกว่าล่างนิดหน่อย + ย้อมให้ผนังสองด้านต่างกันเหมือนโดนแสงคนละมุม
     ใช้บน–ล่างของ "ทั้งบาน" เป็นจุดอ้างอิงเดียวกันทุกช่อง ไม่งั้นแสงจะไล่ซ้ำ (สว่าง-มืด-สว่าง-มืด) ทุกช่อง */
  const g=ctx.createLinearGradient(0,top.y,0,bottom.y);
  g.addColorStop(0,'rgba(255,240,215,0.11)'); g.addColorStop(1,'rgba(0,0,0,0.28)');
  ctx.fillStyle=g; ctx.fill();
  if(tint){ ctx.fillStyle=tint; ctx.fill(); }
  /* บัวเชิงผนัง — เส้นสว่างบาง ๆ ตรงรอยต่อผนังกับพื้น ช่วยให้อ่านออกว่าเป็นห้อง
     วาดเฉพาะช่องความสูงชั้นล่างสุด (z0≈0) กันเส้นซ้ำที่รอยต่อของทุกชั้นเมื่อผนังถูกหั่นเป็นช่อง ๆ */
  if(z0<=0.01){
    ctx.strokeStyle='rgba(212,176,120,0.35)'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.moveTo(q[3].x,q[3].y); ctx.lineTo(q[2].x,q[2].y); ctx.stroke();
  }
}
/* 15 cm masonry extends outside the playable floor. */
function drawWallThickness(W,H){
  const t=15/CM_PER_CELL;
  // Exposed ends share the wall's marble material, with darker cut faces.
  drawWall([W,0],[W,-t],'rgba(0,0,0,0.36)');
  drawWall([-t,H],[0,H],'rgba(0,0,0,0.28)');
  const cap=(vertices,color)=>{
    const q=vertices.map(v=>P(v[0],v[1],ROOM_H));
    ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=color;ctx.fill();
  };
  cap([[-t,-t],[W,-t],[W,0],[0,0]],'#655e52');
  cap([[-t,-t],[0,0],[0,H],[-t,H]],'#4d4b44');
  ctx.save();ctx.lineWidth=1;ctx.strokeStyle='rgba(231,217,187,.45)';
  const rim=[[-t,H],[-t,-t],[W,-t],[W,0],[0,0],[0,H]];
  ctx.beginPath();rim.forEach((v,i)=>{const p=P(v[0],v[1],ROOM_H);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();ctx.restore();
}
function drawRoom(){
  drawTileWalls();   // ทีละช่อง (allFloorTiles() คืนกริดสี่เหลี่ยมเต็มเมื่อยังไม่เคยขยาย) — ทาสีกำแพงได้เสมอ
}

const ANIM_MIN_PX = 30;    // ทากบนจอสูง ≥ เท่านี้ (px) = ซูมใกล้พอ → อนิเมชันเต็ม (ไม่งั้นสไปรต์นิ่ง)
let   animBudget  = 0;     // งบตัวที่อนิเมชันได้ต่อเฟรม (กันกระตุกถ้าซูมใกล้แล้วเห็นเยอะ)

/* กรอบวัตถุบนจอ (ก้น z=0 ถึงยอด) → คัดเฉพาะที่เห็นในจอมาวาด/ขยับ (กันกระตุกตอนของเยอะ) */
function objTopZ(o){ if(o.def.playTable)return 20*ZUNIT; if(o._key==='counter')return 30*ZUNIT;return o.type==='tank' ? tankStandH(o.def)+tankGlassH(o.def) : (o.type==='deco'? decoH(o) : 0); }
function onScreen(o){
  const d=o.def, cx=o.cx, cy=o.cy, tz=objTopZ(o), M=80;
  let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
  const ew=oW(o), eh=oH(o);
  for(const z of [0,tz]) for(const [ax,ay] of [[0,0],[ew,0],[ew,eh],[0,eh]]){
    const p=P(cx+ax,cy+ay,z);
    if(p.x<minx)minx=p.x; if(p.x>maxx)maxx=p.x; if(p.y<miny)miny=p.y; if(p.y>maxy)maxy=p.y;
  }
  return maxx>=-M && minx<=CW+M && maxy>=-M && miny<=CH+M;
}

/* พื้นร้านทั้งชั้น (อยู่ในแคช) — วาดทีละช่อง เพราะแต่ละช่องอาจถูกทาวัสดุต่างกัน (tile-paint.js) */
function drawRoomFloorLayer(){
  if(G.floorTiles){ctx.save();ctx.beginPath();for(const [x,y] of G.floorTiles){const pts=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(v=>P(v[0]*SUB,v[1]*SUB));pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}ctx.clip();}
  // พื้นที่ที่ยังขยายได้ (ghost)
  drawBigDiamond(0,0, MAX_B, MAX_B, 'rgba(95,168,174,0.05)', 'rgba(95,168,174,0.10)', true);

  // ช่องใหญ่แบบหมากรุก (พื้นที่ปัจจุบัน) — แต่ละช่องปูวัสดุของตัวเอง แล้วทับด้วยลายหมากรุกจาง ๆ
  for(let by=0; by<G.bh; by++){
    for(let bx=0; bx<G.bw; bx++){
      if(!ownsTile(bx,by)) continue;
      const c0=P(bx*SUB,by*SUB), c1=P((bx+1)*SUB,by*SUB), c2=P((bx+1)*SUB,(by+1)*SUB), c3=P(bx*SUB,(by+1)*SUB);
      if(Math.max(c0.y,c1.y,c2.y,c3.y)<-40 || Math.min(c0.y,c1.y,c2.y,c3.y)>CH+40 ||
         Math.max(c0.x,c1.x,c2.x,c3.x)<-40 || Math.min(c0.x,c1.x,c2.x,c3.x)>CW+40) continue;
      drawFloorTile(bx,by, floorMatAt(bx,by));
      ctx.beginPath(); ctx.moveTo(c0.x,c0.y);ctx.lineTo(c1.x,c1.y);ctx.lineTo(c2.x,c2.y);ctx.lineTo(c3.x,c3.y);ctx.closePath();
      /* มีลายวัสดุปูอยู่แล้ว ช่องหมากรุกเหลือเป็นแค่คลื่นสว่าง-มืดบาง ๆ ให้ยังนับช่องได้ */
      ctx.fillStyle = (bx+by)%2===0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.10)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,180,190,0.16)';
      ctx.lineWidth=1; ctx.stroke();
    }
  }
  drawBigOutline(0,0,G.bw,G.bh,'rgba(95,168,174,0.55)',1.6);
  if(G.floorTiles)ctx.restore();
}

function drawFloor(){
  if(document.hidden)return;
  window.Slug3D?.beginFrame();
  // อนิเมชันหน้าร้าน (เปิด/ปิดได้) — เปิด = ทากเดินในตู้
  if(engineReady){
    SlugEngine.ANIM = shopAnim;
    if(shopAnim){
      const now=performance.now(); let dt=(now-(floorLastT||now))/1000; floorLastT=now; if(dt>0.05) dt=0.05;
      G.objs.forEach(o=>{ if(o.type==='tank' && o.slugs.length && onScreen(o)) stepTankSlugs(o.slugs, o.def.w, o.def.h, dt, o.slugs.length<=25, o.decor, o.def); });
    } else floorLastT=0;
  }
  if(typeof stepPeople==='function') stepPeople();     // ลูกค้าเดินดูตู้ (มีตัวจับเวลาของตัวเอง)
  if(typeof PlayTable!=='undefined'&&PlayTable.isOpen())return;
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,CW,CH);
  /* ---- ชั้นห้อง+พื้น: เปลี่ยนเฉพาะตอนกล้องขยับ/ร้านโต จึงแคชเป็นภาพไว้ แล้วแปะทีเดียว ----
     ก่อนหน้านี้เททั้งเท็กซ์เจอร์ผนัง+พื้นแกรนิตใหม่ทุกเฟรม 60 ครั้ง/วิ = ต้นเหตุที่กระตุก
     (การเท pattern ที่มี setTransform บนพื้นที่ใหญ่ ๆ แพงกว่าเทสีล้วนหลายสิบเท่า) */
  const rkey=[CW,CH,cam.x.toFixed(1),cam.y.toFixed(1),cam.zoom.toFixed(4),G.bw,G.bh,floorRevision,
              paintRevision, matGen()].join('|');
  if(rkey!==_roomKey){
    _roomKey=rkey;
    if(!_roomC){ _roomC=document.createElement('canvas'); _roomX=_roomC.getContext('2d'); }
    if(_roomC.width!==cv.width || _roomC.height!==cv.height){ _roomC.width=cv.width; _roomC.height=cv.height; }
    _roomX.setTransform(DPR,0,0,DPR,0,0);
    _roomX.clearRect(0,0,CW,CH);
    withCtx(_roomX, ()=>{
      const bg=ctx.createLinearGradient(0,0,0,CH);
      bg.addColorStop(0,'#0C1D22'); bg.addColorStop(1,'#081418');
      ctx.fillStyle=bg; ctx.fillRect(0,0,CW,CH);
      drawRoom();                     // ผนังห้อง — วาดก่อนพื้น ทุกอย่างจะได้ทับผนัง
      drawRoomFloorLayer();
    });
  }
  ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(_roomC,0,0); ctx.setTransform(DPR,0,0,DPR,0,0);


  drawEntrance();
  drawWallDoorGrid();
  // กริดย่อยบนช่องใหญ่ที่ hover (เฉพาะโหมดก่อสร้าง)
  if(appMode==='build' && hoverCell && (tool==='place' || moving)){
    const bx=Math.floor(hoverCell.cx/SUB), by=Math.floor(hoverCell.cy/SUB);
    if(bx>=0&&by>=0&&bx<G.bw&&by<G.bh) drawSubGrid(bx,by);
  }

  // วัตถุ (จัดลำดับความลึก)
  animBudget = 14;    // รีเซ็ตงบอนิเมชันต่อเฟรม (คุมไม่ให้กระตุกแม้ซูมใกล้เห็นเยอะ · ที่เหลือใช้สไปรต์นิ่ง)
  const list = isoSortedObjects();

  let ghost=null;
  if(appMode==='build' && hoverCell){            // เงาพรีวิว เฉพาะโหมดก่อสร้าง
    if(moving){
      const r=moving.rot|0, o=snapFootprint(hoverCell, moving.def, r);
      ghost={cx:o.cx, cy:o.cy, def:moving.def, rot:r, ok:canPlace(o.cx,o.cy,moving.def,moving,r)};
    } else if(tool==='place' && buyKey){
      const def=CATALOG[buyKey], o=snapFootprint(hoverCell,def,buyRot);
      ghost={cx:o.cx, cy:o.cy, def, rot:buyRot, ok:canPlace(o.cx,o.cy,def,null,buyRot)};
    }
  }

  // Ground shadows sit below furniture. People retain their true foot depth;
  // opaque furniture occlusion is resolved per pixel in the character renderer.
  const visitors=typeof PEOPLE!=='undefined'&&peopleOn?PEOPLE.filter(personOnScreen):[];
  visitors.forEach(drawPersonShadow);
  list.forEach(o=>{if(o!==moving&&onScreen(o))drawObject(o);});
  drawShopCaustics(list);
  // ชั้นวางติดผนังสูง 140–190 ซม. — ตู้ (สูงสุด 135 ซม.) อยู่หน้ากำแพงแต่ไม่มีทางบังชั้นได้จริง
  // จึงวาด "หลังวัตถุ" (ให้ทับตู้ที่เตี้ยกว่า) แต่ "ก่อนคน" (คนสูง 170 ซม. ยืนหน้าชั้นยังบังชั้นล่างได้ถูก)
  if(typeof drawWallShelf==='function')drawWallShelf();
  if(typeof drawWallShelfGrid==='function')drawWallShelfGrid();
  beginPersonBatch(visitors);
  try{visitors.forEach(drawPerson);}finally{endPersonBatch();}

  syncRotateBtn();
  if(ghost) drawGhost(ghost);
  drawAreaBadges();
  if(window.SlugRace)SlugRace.drawChallengers();
}

function drawBigDiamond(bx0,by0,bw,bh, fill, stroke, dashed){
  const c0=P(bx0*SUB,by0*SUB), c1=P((bx0+bw)*SUB,by0*SUB), c2=P((bx0+bw)*SUB,(by0+bh)*SUB), c3=P(bx0*SUB,(by0+bh)*SUB);
  ctx.beginPath(); ctx.moveTo(c0.x,c0.y);ctx.lineTo(c1.x,c1.y);ctx.lineTo(c2.x,c2.y);ctx.lineTo(c3.x,c3.y);ctx.closePath();
  ctx.fillStyle=fill; ctx.fill();
  if(dashed) ctx.setLineDash([6,6]);
  ctx.strokeStyle=stroke; ctx.lineWidth=1; ctx.stroke(); ctx.setLineDash([]);
}
function drawBigOutline(bx0,by0,bw,bh,col,lw){
  const c0=P(bx0*SUB,by0*SUB), c1=P((bx0+bw)*SUB,by0*SUB), c2=P((bx0+bw)*SUB,(by0+bh)*SUB), c3=P(bx0*SUB,(by0+bh)*SUB);
  ctx.beginPath(); ctx.moveTo(c0.x,c0.y);ctx.lineTo(c1.x,c1.y);ctx.lineTo(c2.x,c2.y);ctx.lineTo(c3.x,c3.y);ctx.closePath();
  ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.stroke();
}
function drawSubGrid(bx,by){
  ctx.strokeStyle='rgba(217,160,60,0.28)'; ctx.lineWidth=1;
  for(let i=0;i<=SUB;i++){
    let a=P(bx*SUB+i,by*SUB), b=P(bx*SUB+i,(by+1)*SUB);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    a=P(bx*SUB,by*SUB+i); b=P((bx+1)*SUB,by*SUB+i);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }
}

/* กล่องไอโซเมตริก: footprint (cx,cy,w,h ช่องเล็ก) ฐาน baseZ สูง boxH */
/* ---------- ลำดับความลึกแบบไอโซเมตริก ----------
   ของเดิมเรียงด้วยคะแนนเดียว (cx+cy+w+h = มุมไกลสุด) ซึ่งผิดเมื่อของสองชิ้นขนาดต่างกันมาก:
   หินตกแต่ง 2x2 ที่วางอยู่ "หน้า" เคาน์เตอร์ 20x20 ได้คะแนน 57 ส่วนเคาน์เตอร์ได้ 72
   หินจึงถูกวาดก่อนแล้วโดนเคาน์เตอร์ทับ ทั้งที่อยู่ใกล้กล้องกว่า
   และใช้ def.w/def.h ตรง ๆ โดยไม่สนการหมุน (ต้องใช้ oW/oH)

   กติกาที่ถูกต้อง: A อยู่ "หลัง" B ก็ต่อเมื่อ A จบก่อน B เริ่ม บนแกน x หรือ y แกนใดแกนหนึ่ง
   ความสัมพันธ์นี้เรียงด้วยคะแนนเดียวไม่ได้ ต้อง topological sort (ของมีไม่กี่สิบชิ้น O(n^2) ถูกมาก)
   คิดใหม่เฉพาะตอนของย้าย/เพิ่ม/ลบ (ดูลายเซ็น) — แพนกล้อง/ซูมไม่ทำให้คิดใหม่ */
let _isoOrder=null,_isoSig='';
function isoSortedObjects(){
  const objs=G.objs||[];
  let sig=objs.length+'';
  for(const o of objs) sig+='|'+o.id+','+o.cx+','+o.cy+','+(o.rot|0);
  if(sig===_isoSig&&_isoOrder) return _isoOrder;
  _isoSig=sig; _isoOrder=isoTopoSort(objs.slice());
  return _isoOrder;
}
function isoTopoSort(objs){
  const n=objs.length;
  if(n<2) return objs;
  const X2=objs.map(o=>o.cx+oW(o)), Y2=objs.map(o=>o.cy+oH(o));
  const key=i=>objs[i].cx+objs[i].cy+X2[i]+Y2[i];
  const after=Array.from({length:n},()=>[]), indeg=new Array(n).fill(0);
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    const a=objs[i],b=objs[j];
    /* บังกันได้จริงก็ต่อเมื่อช่วงบนอีกแกนหนึ่ง "ซ้อนกัน" — คู่ที่อยู่ทแยงมุมกันไม่เคยทับกันบนจอ
       ถ้าใส่เงื่อนไขให้คู่ทแยงด้วยจะเกิดวงจร (ต่างฝ่ายต่างต้องอยู่หลังอีกฝ่าย) แล้ว topo sort พัง */
    const ovX=a.cx<X2[j]&&b.cx<X2[i], ovY=a.cy<Y2[j]&&b.cy<Y2[i];
    let r;
    if(ovY&&X2[i]<=b.cx) r=-1;                    // ช่วง y ซ้อนกัน และ i จบก่อน j เริ่มบนแกน x → i อยู่หลัง
    else if(ovY&&X2[j]<=a.cx) r=1;
    else if(ovX&&Y2[i]<=b.cy) r=-1;
    else if(ovX&&Y2[j]<=a.cy) r=1;
    else r=key(i)-key(j);                          // ไม่มีใครบังใคร → เรียงด้วยคะแนนพอ
    if(r<0){after[i].push(j);indeg[j]++;}
    else if(r>0){after[j].push(i);indeg[i]++;}
  }
  const ready=[];for(let i=0;i<n;i++)if(!indeg[i])ready.push(i);
  const out=[],seen=new Array(n).fill(false);
  while(ready.length){
    ready.sort((a,b)=>key(a)-key(b));             // เสมอกันให้ตัวไกลกว่ามาก่อน ผลจะนิ่ง
    const i=ready.shift();out.push(objs[i]);seen[i]=true;
    for(const j of after[i]) if(--indeg[j]===0) ready.push(j);
  }
  if(out.length<n) for(let i=0;i<n;i++) if(!seen[i]) out.push(objs[i]);   // มีวงจร: ต่อท้ายไปตามเดิม
  return out;
}
function isoBox(cx,cy,w,h, baseZ, boxH, topCol, rightCol, frontCol, alpha){
  const tz=baseZ+boxH;
  const T1=P(cx,cy,tz), T2=P(cx+w,cy,tz), T3=P(cx+w,cy+h,tz), T4=P(cx,cy+h,tz);
  const rb1=P(cx+w,cy,baseZ), rb2=P(cx+w,cy+h,baseZ), fb1=P(cx,cy+h,baseZ);
  ctx.globalAlpha = alpha==null?1:alpha;
  ctx.beginPath(); ctx.moveTo(T2.x,T2.y);ctx.lineTo(T3.x,T3.y);ctx.lineTo(rb2.x,rb2.y);ctx.lineTo(rb1.x,rb1.y);ctx.closePath();
  ctx.fillStyle=rightCol; ctx.fill();
  ctx.beginPath(); ctx.moveTo(T3.x,T3.y);ctx.lineTo(T4.x,T4.y);ctx.lineTo(fb1.x,fb1.y);ctx.lineTo(rb2.x,rb2.y);ctx.closePath();
  ctx.fillStyle=frontCol; ctx.fill();
  ctx.beginPath(); ctx.moveTo(T1.x,T1.y);ctx.lineTo(T2.x,T2.y);ctx.lineTo(T3.x,T3.y);ctx.lineTo(T4.x,T4.y);ctx.closePath();
  ctx.fillStyle=topCol; ctx.fill();
  ctx.globalAlpha=1;
}

function drawObject(o){
  if(o.def.playTable){drawPlayTable(o);return;}
  const d=o.def, cx=o.cx, cy=o.cy;
  if(o.type==='deco'){
    if(o._key==='counter'){drawTradeCounter(o);return;}
    if(o._key==='plant'){
      const p=P(cx+0.5,cy+0.5,0);
      ctx.fillStyle='rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(p.x,p.y,TW*0.5*cam.zoom,TH*0.5*cam.zoom,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle=d.col; ctx.lineWidth=3*cam.zoom; ctx.lineCap='round';
      for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(p.x+i*5*cam.zoom,p.y); ctx.quadraticCurveTo(p.x+i*8*cam.zoom,p.y-16*cam.zoom,p.x+i*3*cam.zoom,p.y-26*cam.zoom); ctx.stroke(); }
      return;
    }
    isoBox(cx,cy,oW(o),oH(o), 0, decoH(o), rgb(shadeRgb(hexToRgb(d.col),25)), shade(d.col,-30), shade(d.col,-12));
    return;
  }
  // ---- ตู้ปลา: ขาตั้ง + พื้นทรายก้นตู้ + ทาก(ในน้ำ) + กระจกน้ำครอบ ----
  const w=oW(o), h=oH(o), R=o.rot|0;      // ขนาด "รอยเท้า" หลังหมุน · ข้างในตู้ยังเป็น d.w×d.h เสมอ
  const standH=tankStandH(d), tankH=tankGlassH(d), tz=standH+tankH;
  isoBox(cx+0.15, cy+0.15, w-0.3, h-0.3, 0, standH, '#6b5330', '#3c2f1b', '#4a3a22');   // ขาตั้ง
  {                                        // ลายไม้จริงทับสองหน้าที่มองเห็น (วัสดุเดียวกับในโหมดดูตู้)
    const bx=cx+0.15, by=cy+0.15, bw=w-0.3, bh=h-0.3;
    const faces=[ {a:[bx+bw,by], b:[bx+bw,by+bh], sh:'rgba(0,0,0,0.34)'},      // ด้านขวา
                  {a:[bx+bw,by+bh], b:[bx,by+bh], sh:'rgba(196,140,72,0.12)'} ]; // ด้านหน้า
    faces.forEach(f=>{
      const pat=facePatShop('wood', SHOP_WOOD_CM, f.a, f.b, standH); if(!pat) return;
      const q=[P(f.a[0],f.a[1],standH), P(f.b[0],f.b[1],standH), P(f.b[0],f.b[1],0), P(f.a[0],f.a[1],0)];
      ctx.beginPath(); q.forEach((p,i)=> i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath();
      ctx.fillStyle=pat; ctx.fill();
      ctx.fillStyle=f.sh; ctx.fill();
    });
  }
  // พื้นทรายก้นตู้ (บนหัวขาตั้ง)
  const s0=P(cx,cy,standH),s1=P(cx+w,cy,standH),s2=P(cx+w,cy+h,standH),s3=P(cx,cy+h,standH);
  ctx.beginPath(); ctx.moveTo(s0.x,s0.y);ctx.lineTo(s1.x,s1.y);ctx.lineTo(s2.x,s2.y);ctx.lineTo(s3.x,s3.y);ctx.closePath();
  const sandP=planePat('sand', SHOP_SAND_CM, s0.x, s0.y);
  const _gy0=Math.min(s2.y,s3.y), _gy1=Math.max(s0.y,s1.y);
  if(sandP && Number.isFinite(_gy0) && Number.isFinite(_gy1)){ ctx.fillStyle=sandP; ctx.fill();
    const sg=ctx.createLinearGradient(0,_gy0,0,_gy1);   // ย้อมอุ่น + ไล่ระยะ
    sg.addColorStop(0,'rgba(150,112,52,0.42)'); sg.addColorStop(1,'rgba(228,190,126,0.20)');
    ctx.fillStyle=sg; ctx.fill();
  } else { ctx.fillStyle='#d8bd8c'; ctx.fill(); }
  if(d.race&&window.SlugRace)SlugRace.drawTrack(ctx,(x,y)=>{const q=localToFloor(d,R,x,y);return P(cx+q[0],cy+q[1],standH);});
  // ทากอยู่ก้นตู้ (ในน้ำ) — clip ให้อยู่ในกรอบตู้ (หัวไม่ทะลุกระจก) · ขนาด = ความยาวลำตัวจริง
  const displaySlugs=[...o.slugs,...breederVisualSlugs(o)];
  const pxPerCm=TW/CM_PER_CELL, shown=window.Slug3D?.ready&&Slug3D.enabled&&Slug3D.all?displaySlugs.length:Math.min(displaySlugs.length,isBreeder(o)?70:20);   // ระยะแนวนอนต่อ 1 ช่อง (ตรงกับในตู้)
  ctx.save();
  const topZ=tz+30;                                   // เปิดฝา: หินสูงกว่าขอบตู้ให้โผล่พ้นได้ ไม่โดนเฉือน
  const q0=P(cx,cy,topZ),q1=P(cx+w,cy,topZ),q2=P(cx+w,cy,standH),q3=P(cx+w,cy+h,standH),q4=P(cx,cy+h,standH),q5=P(cx,cy+h,topZ);
  ctx.beginPath(); ctx.moveTo(q0.x,q0.y);ctx.lineTo(q1.x,q1.y);ctx.lineTo(q2.x,q2.y);ctx.lineTo(q3.x,q3.y);ctx.lineTo(q4.x,q4.y);ctx.lineTo(q5.x,q5.y);ctx.closePath(); ctx.clip();
  /* ---- ของตกแต่ง + ทาก ----
     localToFloor() กลับแกนลึก (สองมุมมองชี้กันคนละทาง) แล้วหมุนตาม o.rot
     คืนออฟเซ็ตบนพื้นร้าน [0..w]×[0..h] · "ไกล" บนพื้นร้าน = a+b น้อย → วาดก่อน */
  const MAP = (fx,fy)=> localToFloor(d, R, fx, fy);
  drawBreederPartitions(o,MAP,standH,tz);
  const decs=(o.decor||[]).filter(dd=>TANK_DECOR[dd.key]);
  const dmask=decs.map(dd=>({dd, behind:decorCellSet(dd,'behind'), front:decorCellSet(dd,'front')}));
  const dpos=new Map();
  decs.forEach(dd=>{ const m=MAP(dd.fx,dd.fy); dpos.set(dd, m); });
  const list=decs.map(dd=>({k:dpos.get(dd)[0]+dpos.get(dd)[1], dec:dd}));
  (o.foods||[]).forEach(food=>{const fm=MAP(food.fx,food.fy);list.push({k:fm[0]+fm[1],food,fm});});
  displaySlugs.slice(0,shown).forEach(s=>{
    const sm = s.fx!==undefined ? MAP(s.fx,s.fy) : [w*0.3, h*0.7];
    let key=sm[0]+sm[1];
    if(s.fx!==undefined && dmask.length){ const ck=ptKey(s.fx,s.fy);
      for(const m of dmask){ const dm=dpos.get(m.dd);
        if(m.behind.has(ck)){ key=dm[0]+dm[1]-0.05; break; }   // หลังหิน = วาดก่อน
        if(m.front.has(ck)){  key=dm[0]+dm[1]+0.05; break; } } }
    list.push({k:key, s, sm});
  });
  list.sort((a,b)=>a.k-b.k);
  list.forEach(it=>{
    if(it.food){
      const f=it.food,im=FOOD_IMAGES[f.type],p=P(cx+it.fm[0],cy+it.fm[1],standH);
      const size=Math.max(14,f.spec.cap*1.65)*pxPerCm*cam.zoom;
      if(im&&im.complete&&im.naturalWidth)ctx.drawImage(im,p.x-size/2,p.y-size*0.88,size,size);
      return;
    }
    if(it.dec){                                        // ---- หิน/ของตกแต่ง ----
      const dd=it.dec, def=TANK_DECOR[dd.key], e=decorImg(dd.key);
      const dw=def.wCm*(d.decorScale||1)*pxPerCm*cam.zoom;
      const dh=(e.ok? dw*(e.img.naturalHeight/e.img.naturalWidth) : dw*0.8);
      const anc=def.anchor||{x:0.5,y:0.9};
      const dm=dpos.get(dd), p=P(cx+dm[0], cy+dm[1], standH);
      ctx.save();
      if(dd.flip & 1){ ctx.translate(p.x,0); ctx.scale(-1,1); ctx.translate(-p.x,0); }   // ซ้าย-ขวา รอบ anchor
      if(dd.flip & 2){ const my=p.y-dh*anc.y+dh/2;                                        // บน-ล่าง ในกรอบเดิม
        ctx.translate(0,my); ctx.scale(1,-1); ctx.translate(0,-my); }
      if(e.ok) ctx.drawImage(e.img, p.x-dw*anc.x, p.y-dh*anc.y, dw, dh);
      else { ctx.fillStyle='rgba(90,100,105,0.5)'; ctx.fillRect(p.x-dw*anc.x, p.y-dh*anc.y, dw, dh); }
      ctx.restore();
      return;
    }
    const s=it.s;                                      // ---- ทาก ----
    const showcaseScale=d.shopSlugScale||1;
    const a=Math.min(w*.92,Math.max(w*.08,it.sm[0]));
    const b=Math.min(h*.92,Math.max(h*.08,it.sm[1]));
    const p=P(cx+a, cy+b, standH+1);
    const headingOrigin=MAP(s.fx||0,s.fy||0),headingTarget=MAP((s.fx||0)+Math.cos(s._motionHeading??s.dir??0),(s.fy||0)+Math.sin(s._motionHeading??s.dir??0));
    const headingPoint=P(cx+a+headingTarget[0]-headingOrigin[0],cy+b+headingTarget[1]-headingOrigin[1],standH+1);
    const heading3D={x:headingPoint.x-p.x,y:headingPoint.y-p.y};
    if(engineReady&&!slugOnWall(s)&&window.Slug3D?.draw(ctx,s,p.x,p.y,Math.min(30*pxPerCm*cam.zoom,showcaseScale*(s._breedScale||1)*slugCm(typeof foodGenes==='function'?foodGenes(s):s.genes)*pxPerCm*cam.zoom),false,heading3D))return;
    if(engineReady){
      const PP=slugPartsOf(s);
      const sa=showcaseScale*(s._breedScale||1)*slugCm(typeof foodGenes==='function'?foodGenes(s):s.genes)*pxPerCm*cam.zoom/(PP.bw*PP.s), spriteH=PP.h*sa;
      if(slugOnWall(s)){
        /* ⚠️ เดิมคิดความสูงด้วยหน่วยของ "โหมดดูตู้" — บวก SAND_CELLS (1.3 ช่อง) ทั้งที่พื้นทราย
           ในหน้าร้านอยู่ที่ standH พอดี และ half ถูกแปลงด้วย CELLW/ZH = 1.33 ทั้งที่หน้าร้าน
           1 ช่องสูง (ZUNIT 26) = 1 ช่องกว้าง (TW 26) อัตราส่วน 1
           รวมแล้วลอยสูงเกินไป ~1.7 ช่อง = โผล่พ้นผิวน้ำไปลอยอยู่นอกตู้
           แก้เป็นยึดจุดจริงบนจอแทน: ก้นตู้ = standH · ผิวน้ำ = standH+tankH*0.88
           แล้วไล่ตำแหน่งจาก "หางแตะทราย" (climbZ=0) ไป "หัวถึงผิวน้ำ" (climbZ=rise) */
        const limits=slugWallLimits(s,d.w,d.h,d), edge=s.climbSide==='right'?d.w:0;
        const point=MAP(edge,s.fy), inPt=MAP(edge?d.w-1:1, s.fy);
        const floorPoint=P(cx+point[0],cy+point[1],standH);
        const waterPoint=P(cx+point[0],cy+point[1],standH+tankH*0.88);
        const sprite=slugSprite(s), sw=sprite.w*sa, sh=sprite.h*sa;
        const span=floorPoint.y-waterPoint.y;
        if(sw<=span-2||showcaseScale>1){
          const frac=limits.rise>0?Math.max(0,Math.min(1,(s.climbZ||0)/limits.rise)):0;
          const yy=floorPoint.y-Math.min(sw,span)/2-frac*Math.max(0,span-sw);
          /* ด้านในตู้อยู่ฝั่งไหนของจอ ดูจากจุดที่ลึกเข้าไป 1 ช่อง — รองรับตู้ที่ถูกหมุน (o.rot) ไปด้วย
             หงอนหันเข้ากลางตู้เสมอ เหมือนโหมดดูตู้ · ไต่ลงสลับแค่หัว-หาง */
          const inScr=P(cx+inPt[0],cy+inPt[1],standH), sgn=(inScr.x-floorPoint.x)>=0?1:-1;
          /* หันตามทิศที่เดินจริงเหมือนในโหมดดูตู้ — แกนของกำแพงในหน้าร้านคนละชุดกับในตู้
             จึงวัดจากจอตรง ๆ: เลาะไปตามกำแพง 1 ช่อง กับ ไต่ขึ้น 1 ช่อง ได้เวกเตอร์อะไรบ้าง */
          const alongPt=MAP(edge, Math.min(d.h, s.fy+1));
          const along=P(cx+alongPt[0],cy+alongPt[1],standH);
          const upPt=P(cx+point[0],cy+point[1],standH+ZUNIT);
          const pose=slugWallPoseAxes(Number.isFinite(s.dir)?s.dir:Math.PI/2,
                       along.x-floorPoint.x, along.y-floorPoint.y,
                       upPt.x-floorPoint.x,  upPt.y-floorPoint.y, sgn);
          ctx.save();
          ctx.translate(floorPoint.x+pose.dx*(sh/2+1), yy);
          ctx.rotate(pose.rot);
          if(pose.flipY)ctx.scale(1,-1);
          ctx.drawImage(sprite.c,-sw/2,-sh/2,sw,sh);ctx.restore();
        }
        return;
      }
      if(window.Slug3D?.draw(ctx,s,p.x,p.y,Math.min(30*pxPerCm*cam.zoom,PP.bw*PP.s*sa),false,heading3D))return;
      const aura=PP.D.aMetal>0.30;
      if(shopAnim && spriteH>=ANIM_MIN_PX && animBudget>0){
        animBudget--;
        SlugEngine.drawSlug(ctx, PP, p.x, p.y - spriteH*0.44, !!s.flip, (s.ph||0)*120, sa, aura, s.state==='walk'||s.state==='seekFood'||s.state==='seekDecor'||s.state==='seekNap'||s.state==='follow'||s.state==='dash'||s.state==='flee', s);
      } else {                                                    // ไกล/ซูมออก = สไปรต์นิ่ง blit ทีเดียว (ลื่น)
        const spr=slugSprite(s), dw=spr.w*sa, dh=spr.h*sa;
        ctx.save(); ctx.translate(p.x, p.y - spriteH*0.44); if(s.flip) ctx.scale(-1,1);
        ctx.drawImage(spr.c, -dw/2, -dh/2, dw, dh); ctx.restore();
      }
    } else {
      ctx.fillStyle=slugBaseHex(s.genes);
      const r=slugCm(s.genes)*pxPerCm*cam.zoom*0.4;
      ctx.beginPath(); ctx.ellipse(p.x,p.y,r,r*0.4,0,0,6.283); ctx.fill();
    }
  });
  ctx.restore();
  // กระจกน้ำครอบ (โปร่ง) วาดทับทาก
  const glass=hexToRgb(d.glass);
  isoBox(cx, cy, w, h, standH, tankH, rgbaCss(glass,0.32), rgbaCss(shadeRgb(glass,-40),0.5), rgbaCss(shadeRgb(glass,-20),0.5));
  const T1=P(cx,cy,tz),T2=P(cx+w,cy,tz),T3=P(cx+w,cy+h,tz),T4=P(cx,cy+h,tz);
  ctx.strokeStyle='rgba(220,245,250,0.6)'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(T1.x,T1.y);ctx.lineTo(T2.x,T2.y);ctx.lineTo(T3.x,T3.y);ctx.lineTo(T4.x,T4.y);ctx.closePath(); ctx.stroke();
  // ป้ายจำนวน
  if(o.slugs.length){
    const pc=P(cx+w/2,cy+h/2,tz+10);
    ctx.font='600 '+(10*cam.zoom).toFixed(0)+'px "IBM Plex Mono",monospace';
    const txt=o.slugs.length+'/'+tankCap(d), twd=ctx.measureText(txt).width+10*cam.zoom;
    ctx.fillStyle='rgba(12,29,34,0.85)'; ctx.strokeStyle='rgba(95,168,174,0.6)'; ctx.lineWidth=1;
    roundRect(pc.x-twd/2,pc.y-9*cam.zoom,twd,15*cam.zoom,4*cam.zoom); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#cfe8ea'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(txt,pc.x,pc.y-1*cam.zoom);
  }
}
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

function drawGhost(g){
  const d=g.def, col= g.ok? 'rgba(127,200,160,' : 'rgba(224,128,108,';
  const gw=rotW(d,g.rot|0), gh=rotH(d,g.rot|0);
  const c0=P(g.cx,g.cy,0),c1=P(g.cx+gw,g.cy,0),c2=P(g.cx+gw,g.cy+gh,0),c3=P(g.cx,g.cy+gh,0);
  ctx.beginPath(); ctx.moveTo(c0.x,c0.y);ctx.lineTo(c1.x,c1.y);ctx.lineTo(c2.x,c2.y);ctx.lineTo(c3.x,c3.y);ctx.closePath();
  ctx.fillStyle=col+'0.22)'; ctx.fill(); ctx.strokeStyle=col+'0.9)'; ctx.lineWidth=1.5; ctx.stroke();
  if(d.kind==='tank'){
    const sH=tankStandH(d), tH=tankGlassH(d);
    isoBox(g.cx+0.15,g.cy+0.15,gw-0.3,gh-0.3,0,sH, col+'0.25)', col+'0.15)', col+'0.15)');
    isoBox(g.cx,g.cy,gw,gh,sH,tH, col+'0.25)', col+'0.15)', col+'0.15)');
  }
}
function drawAreaBadges(){
  const p=P(G.bw*SUB, G.bh*SUB, 6);
  ctx.fillStyle='rgba(95,168,174,0.9)'; ctx.font='500 12px "IBM Plex Mono",monospace';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(G.bw+' × '+G.bh+' ช่องใหญ่  ('+(G.bw*CM_PER_BIG/100)+'×'+(G.bh*CM_PER_BIG/100)+' ม.)', p.x, p.y+4);
}

/* ============================================================
   วางของ / เศรษฐกิจ
   ============================================================ */
function snapFootprint(cell, def, rot){ return { cx:Math.round(cell.cx-rotW(def,rot|0)/2), cy:Math.round(cell.cy-rotH(def,rot|0)/2) }; }
function inBounds(cx,cy,w,h){ return floorRect(cx,cy,w,h); }
function overlaps(cx,cy,w,h, ignore){
  for(const o of G.objs){ if(o===ignore) continue;
    if(cx<o.cx+oW(o) && cx+w>o.cx && cy<o.cy+oH(o) && cy+h>o.cy) return true; }
  return false;
}
function canPlace(cx,cy,def, ignore, rot){
  const w=rotW(def,rot|0), h=rotH(def,rot|0);
  return inBounds(cx,cy,w,h) && !overlaps(cx,cy,w,h,ignore) && layoutAllowsPlacement(cx,cy,def,ignore,rot);
}

function finishConstruction(){
  buyKey=null;moving=null;movingByClick=false;grab=null;
  if(typeof placingWallDoor!=='undefined'){placingWallDoor=false;wallDoorHover=null;}
  setMode('view');syncRotateBtn();saveGame();
}
function placeBuy(cell){
  const def=CATALOG[buyKey]; if(!def) return;
  if(G.coin<def.price){ toast('เหรียญไม่พอ ('+def.price+')','bad'); return; }
  const o=snapFootprint(cell,def,buyRot);
  if(!canPlace(o.cx,o.cy,def,null,buyRot)){ toast('วางไม่ได้: ของทับกัน บังประตู หรือเหลือทางเข้าตู้ไม่พอ','bad'); return; }
  if(def.race&&[...G.objs,...G.shelter].some(t=>t.def.race)){toast('มีตู้แข่งได้ 1 ตู้ รวมตู้ที่เก็บไว้','bad');return;}
  G.coin-=def.price;
  G.objs.push({ id:'o'+(G.seq++), type:def.kind, _key:buyKey, cx:o.cx, cy:o.cy, def, rot:buyRot, slugs:[] });
  if(def.race&&window.SlugRace)SlugRace.purchased();
  toast('วาง'+def.name+' −'+def.price,'good'); syncHUD();finishConstruction();
}
function objAt(cell){
  let best=null;
  for(const o of G.objs){
    if(cell.cx>=o.cx && cell.cx<o.cx+oW(o) && cell.cy>=o.cy && cell.cy<o.cy+oH(o)){
      if(!best || (o.cx+o.cy)>(best.cx+best.cy)) best=o;
    }
  }
  return best;
}

/* ---- ทดสอบคลิกบน "รูปทรงตู้" บนจอ (รวมกล่องกระจกที่ยกสูง) ---- */
function _hull(pts){
  const p=pts.slice().sort((a,b)=>a.x-b.x||a.y-b.y);
  const cr=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const lo=[]; for(const q of p){ while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0) lo.pop(); lo.push(q); }
  const up=[]; for(let i=p.length-1;i>=0;i--){ const q=p[i]; while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
function _inConvex(poly,x,y){
  let sign=0;
  for(let i=0;i<poly.length;i++){ const a=poly[i], b=poly[(i+1)%poly.length];
    const c=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);
    if(c!==0){ const s=c>0?1:-1; if(!sign) sign=s; else if(s!==sign) return false; } }
  return true;
}
function tankBoxPts(o){
  const d=o.def, cx=o.cx, cy=o.cy, tz=tankStandH(d)+tankGlassH(d), ew=oW(o), eh=oH(o);
  return [P(cx,cy,0),P(cx+ew,cy,0),P(cx+ew,cy+eh,0),P(cx,cy+eh,0),
          P(cx,cy,tz),P(cx+ew,cy,tz),P(cx+ew,cy+eh,tz),P(cx,cy+eh,tz)];
}
/* คืน {o, fx, fy} ของตู้หน้าสุดที่คลิกโดน (sx,sy = พิกัดในแคนวาส) หรือ null */
function tankHit(sx,sy){
  let best=null;
  for(const o of G.objs){ if(o.type!=='tank') continue;
    if(_inConvex(_hull(tankBoxPts(o)),sx,sy)){
      if(!best || (o.cx+o.cy)>(best.cx+best.cy)) best=o; } }
  if(!best) return null;
  const standH=tankStandH(best.def);                       // ฉายจุดคลิกลงบนผิวทราย (z=standH)
  const c=pick(sx, sy + standH*cam.zoom);
  return { o:best,
           ...(()=>{ const L=floorToLocal(best.def, best.rot|0, c.cx-best.cx, c.cy-best.cy);
                     return { fx:L[0], fy:L[1] }; })() };
}
function screenXY(e){ const r=cv.getBoundingClientRect(); return { sx:e.clientX-r.left, sy:e.clientY-r.top }; }
function expand(dir){
  const cur = dir==='w'? G.bw : G.bh;
  if(cur>=MAX_B){ toast('พื้นที่เต็มขนาดสูงสุดแล้ว (32×32)','bad'); return; }
  const n = dir==='w'? G.bh : G.bw, cost = expandCost(n, floorArea());   // ขยายทั้งแถว = คิดทีละช่อง
  if(G.coin<cost){ toast('เหรียญไม่พอ ('+cost.toLocaleString()+')','bad'); return; }
  G.coin-=cost; if(dir==='w') G.bw++; else G.bh++;
  toast('ขยายพื้นที่ '+n+' ช่อง −'+cost.toLocaleString(),'good'); syncHUD();
}
function toShelter(o){ G.objs=G.objs.filter(x=>x!==o); G.shelter.push(o); toast('ย้าย'+o.def.name+'ไปที่พักพิง','good'); syncHUD();finishConstruction(); }
function fromShelter(idx){
  const o=G.shelter[idx];if(!o)return;
  restoreHeldRotation();moving=null;grab=null;
  placingWallDoor=false;wallDoorHover=null;
  setMode('build');setTool('move');buyKey=null;
  // Keep ownership in shelter until a valid placement is committed.
  moving=o;movingByClick=true;hoverCell=null;
  cv.classList.add('placing');syncRotateBtn();
  toast('เลือกตำแหน่งวาง'+o.def.name+' · R หมุน · Esc ยกเลิก','good');
}
function removeObj(o){
  if(o.type==='tank'){ toShelter(o); return; }
  G.objs=G.objs.filter(x=>x!==o);
  const back=Math.round(o.def.price*DECO_REFUND); G.coin+=back;
  toast('เก็บ'+o.def.name+' +'+back,'good'); syncHUD();finishConstruction();
}
function sellObj(o){
  if(o.type==='tank'){
    const val=Math.round((o.def.price||0)*0.5);
    const n=(o.slugs||[]).length;
    if(!confirm('ขายตู้ "'+o.def.name+'" ทิ้งถาวร?'+(n?' ทาก '+n+' ตัวจะกลับเข้าคลัง.':'')+' รับคืน '+val+' เหรียญ')) return;
    (o.slugs||[]).forEach(s=>{ if(Array.isArray(G.inv)) G.inv.push(s); });
    if(o.slugs) o.slugs.length=0;
    G.objs=G.objs.filter(x=>x!==o);
    G.coin+=val; toast('ขายตู้'+o.def.name+' +'+val+' เหรียญ','good'); syncHUD(); finishConstruction();
  } else {
    G.objs=G.objs.filter(x=>x!==o);
    const back=Math.round((o.def.price||0)*DECO_REFUND); G.coin+=back;
    toast('ขายทิ้ง'+o.def.name+' +'+back+' เหรียญ','good'); syncHUD(); finishConstruction();
  }
}

/* ============================================================
   อินพุต (pan / zoom / คลิก)
   ============================================================ */
let dragging=false, dragMoved=false, lastX=0,lastY=0, downX=0,downY=0;
let grab=null;                 // ของที่กดค้างไว้ (จะกลายเป็นลากย้าย หรือคลิกเข้าตู้)
const DRAG_TH=5;               // ระยะที่ถือว่าเป็นการลาก (px)
function cellUnder(e){ const r=cv.getBoundingClientRect(); return pick(e.clientX-r.left, e.clientY-r.top); }

cv.addEventListener('pointerdown', e=>{
  cv.setPointerCapture(e.pointerId);
  dragging=true; dragMoved=false; grab=null;
  lastX=downX=e.clientX; lastY=downY=e.clientY;
  if(moving && movingByClick){ return; }                 // กำลังยกของอยู่ — รอปล่อยที่คลิกถัดไป
  restoreHeldRotation(); moving=null;
  // เตรียมลากย้าย (เฉพาะโหมดก่อสร้าง ยกเว้นเครื่องมือเก็บออก)
  if(appMode==='build' && !placingWallDoor && tool!=='remove' && tool!=='sell' && !buyKey){   // ถืออยู่ = คลิกคือวาง ไม่ใช่หยิบของเดิม
    let o=objAt(cellUnder(e));
    if(!o){ const {sx,sy}=screenXY(e); const h=tankHit(sx,sy); if(h) o=h.o; }  // กดกระจกตู้ก็จับได้
    if(o) grab=o;
  }
});
cv.addEventListener('pointermove', e=>{
  hoverCell=cellUnder(e);
  if(!dragging) return;
  const dx=e.clientX-lastX, dy=e.clientY-lastY;
  if(Math.abs(e.clientX-downX)+Math.abs(e.clientY-downY)>DRAG_TH) dragMoved=true;
  if(grab && dragMoved && !moving){ moving=grab; cv.classList.add('placing'); }  // เริ่มลากย้าย
  if(moving && !movingByClick){ /* ลากค้างอยู่ — ตู้ลอยตาม hover ไม่แพนกล้อง */ }
  else { cam.x-=dx/cam.zoom; cam.y-=dy/cam.zoom; cv.classList.add('panning'); }   // ไม่ได้ลากของ = แพนกล้อง
  lastX=e.clientX; lastY=e.clientY;
});
cv.addEventListener('pointerup', e=>{
  dragging=false; cv.classList.remove('panning','placing');
  const cell=cellUnder(e);
  // จบการลากย้าย
  if(moving){
    if(movingByClick && dragMoved){ return; }            // แค่แพนกล้องระหว่างยก ยังไม่ปล่อย
    let placed=false;
    const o=snapFootprint(cell, moving.def, moving.rot|0);
    if(canPlace(o.cx,o.cy,moving.def, moving, moving.rot|0)){ placed=true;moving.cx=o.cx; moving.cy=o.cy; heldRotations.delete(moving);
      const shelfIndex=G.shelter.indexOf(moving);
      if(shelfIndex>=0){G.shelter.splice(shelfIndex,1);G.objs.push(moving);syncHUD();saveGame();toast('วาง'+moving.def.name+'แล้ว','good');} }
    else { toast('วางตรงนี้ไม่ได้','bad'); if(movingByClick) return; }   // ยกด้วยคลิก = ยังถือไว้ ลองที่ใหม่
    restoreHeldRotation(); moving=null; movingByClick=false; grab=null;if(placed)finishConstruction(); return;
  }
  const {sx,sy}=screenXY(e);
  /* คลิกเฉย ๆ บนของ (โหมดก่อสร้างเท่านั้น — grab ถูกตั้งเฉพาะโหมดนี้)
     = "ยกขึ้นมา" คลิกอีกครั้งเพื่อวาง · ไม่เข้าตู้ ไม่งั้นจะย้ายของไม่ได้เลย */
  if(grab){
    moving=grab; movingByClick=true; grab=null; cv.classList.add('placing');
    toast('ยก'+moving.def.name+' — คลิกอีกครั้งเพื่อวาง · R หมุน · Esc ยกเลิก','good');
    return;
  }
  if(dragMoved) return;    // เป็นการแพนกล้อง
  // คลิก (ไม่ลาก) — ใช้ tankHit ก่อน (คลิกกระจกตู้ที่ยกสูงก็เข้าได้ + รู้จุดโฟกัส)
  const th=tankHit(sx,sy);
  const o=objAt(cell);
  if(appMode==='view'){ const play=typeof playTableHit==='function'?playTableHit(sx,sy):null;if(play&&(!th||play.cx+play.cy>=th.o.cx+th.o.cy)){openPlayTable(play);return;} if(th) enterTank(th.o,{fx:th.fx,fy:th.fy}); return; } // โหมดดู: คลิกตู้=เข้า
  // โหมดก่อสร้าง
  if(tool==='remove'){ if(o) removeObj(o); else if(th) removeObj(th.o); return; }
  if(tool==='sell'){ if(o) sellObj(o); else if(th) sellObj(th.o); return; }
  if(tool==='place' && buyKey){                    // ถืออยู่ = คลิกที่ไหนก็คือวาง วางแล้วยังถือต่อ
    if(!inBounds(Math.floor(cell.cx),Math.floor(cell.cy),1,1)){ toast('อยู่นอกพื้นที่','bad'); return; }
    placeBuy(cell); return;
  }
  /* โหมดก่อสร้าง "ไม่เข้าตู้" เด็ดขาด — อยากดูข้างในให้สลับไปโหมดดู/เล่นก่อน
     ไม่งั้นคลิกตู้เพื่อจะย้าย กลายเป็นหลุดเข้าไปข้างในทุกที */
  if(th || (o && o.type==='tank')){ toast('อยากเข้าไปในตู้ ให้สลับไปโหมด ดู/เล่น ก่อน','bad'); return; }
});
cv.addEventListener('pointerleave', ()=>{ hoverCell=null; });
cv.addEventListener('wheel', e=>{
  e.preventDefault();
  const before=pick(e.offsetX, e.offsetY);
  cam.zoom=Math.max(0.3*phoneZoomOutScale(), Math.min(3, cam.zoom*(e.deltaY<0?1.12:1/1.12)));
  const after=pick(e.offsetX, e.offsetY);
  const wB=worldOf(before.cx,before.cy), wA=worldOf(after.cx,after.cy);
  cam.x += wB.X-wA.X; cam.y += wB.Y-wA.Y;
}, {passive:false});

function fitCamera(){
  const c=worldOf(cellsW()/2, cellsH()/2); cam.x=c.X; cam.y=c.Y;
  const wSpan=(cellsW()+cellsH())*TW, hSpan=(cellsW()+cellsH())*TH;
  cam.zoom=Math.max(0.3*phoneZoomOutScale(), Math.min(1.6, Math.min(CW/(wSpan*1.15), CH/(hSpan*1.25))));
}

/* ============================================================
   UI ด้านขวา + HUD
   ============================================================ */
function buildShop(){
  const box=document.getElementById('shop'); box.innerHTML='';
  Object.entries(CATALOG).forEach(([k,d])=>{
    const el=document.createElement('button'); el.className='item'+(k===buyKey?' on':''); el.dataset.k=k;
    el.innerHTML='<div class="ic">'+d.icon+'</div><div class="nm">'+d.name+'</div>'+
      '<div class="pr">'+d.price+' เหรียญ</div><div class="dm">'+(d.w*CM_PER_CELL)+'×'+(d.h*CM_PER_CELL)+(d.kind==='tank'?'×'+tankGlassCm(d):'')+' ซม.'+(d.kind==='tank'?' · จุ '+tankCap(d):'')+'</div>';
    el.onclick=()=>{ buyKey = (buyKey===k? null : k);   // กดซ้ำ = วางมือ
      if(buyKey) enterExclusiveMode('holding');          // หยิบของ = เลิกวางประตู/เลิกเลือกช่องขยาย
      buyRot=0; if(buyKey) setTool('place'); buildShop(); };
    box.appendChild(el);
  });
}
function setTool(t){
  tool=t;
  if(t!=='place'){ buyKey=null; buildShop(); }        // ย้าย/เก็บออก = ต้องมือว่าง
  document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('on', b.dataset.tool===t));
  document.getElementById('toolName').textContent={place:'วาง',move:'ย้าย',sell:'ขายทิ้ง',remove:'เก็บออก'}[t];
  const hints={place:'เลือกของจากร้าน = ถือไว้ · คลิกวางได้เรื่อย ๆ · R หมุน · Esc วางมือ · มือว่าง: คลิกของเพื่อยกย้าย',
    move:'คลิกของ = ยกขึ้นมา คลิกอีกทีเพื่อวาง (หรือลากค้างก็ได้) · R หมุน · Esc ยกเลิก',
    sell:'คลิกของตกแต่ง = ขายทิ้งเอาเงิน · คลิกตู้ = ขายตู้ (ยืนยันก่อน ทากกลับเข้าคลัง) · ย้ายของ: ใช้โหมด "วาง" แล้วลาก',
    remove:'คลิกของตกแต่งเพื่อขายคืน · คลิกตู้เพื่อย้ายไปที่พักพิง'};
  document.getElementById('toolHint').textContent=hints[t];
  cv.classList.toggle('placing', t==='place');
}
/* ถือของจะวางอยู่ก็นับเป็นโหมดหนึ่ง — คลิกบนพื้นแปลว่า "วาง" ไม่ใช่ "เลือก" */
registerMode('holding','floor',()=>!!buyKey||!!moving,()=>{
  restoreHeldRotation(); moving=null; movingByClick=false; grab=null; buyKey=null;
  cv.classList.remove('placing'); if(typeof buildShop==='function') buildShop();
});
function setMode(m){
  appMode=m;
  document.body.classList.toggle('mode-view', m==='view');
  document.body.classList.toggle('mode-build', m==='build');
  document.getElementById('mView').classList.toggle('on', m==='view');
  document.getElementById('mBuild').classList.toggle('on', m==='build');
  if(m==='build'){ buyKey=null; setTool('place'); buildShop(); }   // เข้าโหมดก่อสร้างด้วยมือว่าง
  else { restoreHeldRotation(); moving=null; grab=null; cv.classList.remove('placing'); }
}
function toast(msg,kind){
  if(typeof playNotificationSound==='function')playNotificationSound(notificationKind(String(msg),kind));
  const el=document.getElementById('toast'); el.textContent=msg;
  el.className='toast on'+(kind?' '+kind:'');
  clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('on'),1600);
}
function syncHUD(){
  if(typeof syncVisitorHUD==='function')syncVisitorHUD();
  document.getElementById('hCoin').textContent=G.coin;
  document.getElementById('hTanks').textContent=G.objs.filter(o=>o.type==='tank').length + G.shelter.length;
  document.getElementById('hSlugs').textContent=G.objs.reduce((n,o)=>n+(o.slugs?o.slugs.length:0),0);
  document.getElementById('hArea').textContent=floorArea()+' ช่อง';
  document.getElementById('areaTag').textContent=G.bw+'×'+G.bh+' → สูงสุด 32×32';
  document.getElementById('expHint').textContent='ช่องถัดไป '+expandTileCost(floorArea()).toLocaleString()+' เหรียญ · แพงขึ้นตามขนาดร้าน';

  const inv=document.getElementById('inv'); inv.innerHTML='';
  document.getElementById('invTag').textContent=G.inv.length+' ตัวรอลงตู้';
  if(!G.inv.length) inv.innerHTML='<div class="empty">คลังว่าง</div>';
  SlugBrowser.mount(inv.parentElement,'inventory',syncHUD);
  const visibleInv=SlugBrowser.apply(G.inv,'inventory');if(G.inv.length&&!visibleInv.length)inv.innerHTML='<div class="empty">ไม่พบทากที่ตรงตัวกรอง</div>';
  visibleInv.forEach(s=>{
    const el=document.createElement('div'); el.className='row';
    el.innerHTML='<span class="sw" style="background:'+slugBaseHex(s.genes)+'"></span>'+
      '<div class="info"><div class="t">ทาก '+SlugBrowser.htmlName(s)+'</div><div class="s">หงอน '+gillCount(s.genes)+' · ลาย '+spotCount(s.genes)+'</div></div>';
    SlugBrowser.heart(el,s,syncHUD,'inventory');inv.appendChild(el);
  });

  const shelf=document.getElementById('shelf'); shelf.innerHTML='';
  document.getElementById('shelfTag').textContent=G.shelter.length+' ตู้';
  if(!G.shelter.length) shelf.innerHTML='<div class="empty">ยังไม่มีตู้ในที่พักพิง</div>';
  G.shelter.forEach((o,i)=>{
    const el=document.createElement('div'); el.className='row';
    el.innerHTML='<span class="sw" style="background:'+o.def.glass+'"></span>'+
      '<div class="info"><div class="t">'+o.def.name+'</div><div class="s">'+o.slugs.length+'/'+tankCap(o.def)+' ตัว</div></div>'+
      '<button class="act">วางคืน</button>';
    el.querySelector('.act').onclick=()=>fromShelter(i);
    shelf.appendChild(el);
  });
}

/* ---------- wire ปุ่ม ---------- */
document.querySelectorAll('.tool').forEach(b=> b.onclick=()=>setTool(b.dataset.tool));
document.getElementById('mView').onclick=()=>setMode('view');
document.getElementById('mBuild').onclick=()=>setMode('build');
document.getElementById('zIn').onclick=()=>{ cam.zoom=Math.min(3,cam.zoom*1.2); };
document.getElementById('zOut').onclick=()=>{ cam.zoom=Math.max(0.3*phoneZoomOutScale(),cam.zoom/1.2); };
document.getElementById('bFit').onclick=()=>{
  if(typeof tankMode!=='undefined' && tankMode){ resizeTank(); fitTankZoom(); centerTankCam(); }
  else fitCamera();
};
document.getElementById('bAnim').onclick=()=>{ shopAnim=!shopAnim; document.getElementById('bAnim').textContent='🌊 ขยับ: '+(shopAnim?'เปิด':'ปิด'); };
document.getElementById('expW').onclick=()=>expand('w');
document.getElementById('expH').onclick=()=>expand('h');

/* ---------- ลูปวาดหน้าร้าน ---------- */
/* ระหว่างหน้าโหลด (boot.js) ห้ามวาด — ไม่งั้นลูปจะไปแตะทากก่อน แล้วอบสไปรต์รวดเดียวทั้งฉาก
   = จอค้างยาว ซึ่งคือสิ่งที่หน้าโหลดตั้งใจจะเลี่ยง */
function loop(){
  if(!window.BOOTING && !document.hidden && !(typeof tankMode!=='undefined' && tankMode) && !window.SlugRace?.isOpen()) drawFloor();
  requestAnimationFrame(loop);
}


/* ---------- R = หมุนของ 90° ----------
   กำลังลากย้ายอยู่ → หมุนชิ้นนั้น · โหมดก่อสร้างและยังไม่ได้หยิบ → หมุนชิ้นที่กำลังจะซื้อวาง
   หมุนแล้ววางไม่ได้จะรู้ทันทีจากโกสต์ที่เปลี่ยนเป็นสีแดง */
window.addEventListener('keydown', e=>{
  if(typeof tankMode!=='undefined' && tankMode) return;      // อยู่ในตู้ ปล่อยให้ตู้จัดการเอง
  if(e.key==='Escape'){                                   // วางมือ / เลิกลาก
    e.preventDefault();
    if(moving){ restoreHeldRotation(); moving=null; movingByClick=false; grab=null; cv.classList.remove('placing'); toast('ยกเลิกการย้าย','good'); }
    else if(buyKey){ buyKey=null; buildShop(); toast('วางมือแล้ว','good'); }
    return;
  }
  if(e.key!=='r' && e.key!=='R' && e.key!=='พ') return;
  e.preventDefault(); rotateHeld();
});

/* หมุนของที่ "อยู่ในมือ" — กำลังยก/ลากอยู่ก็หมุนชิ้นนั้น ไม่งั้นหมุนชิ้นที่กำลังจะวาง */
function rotateHeld(){
  if(typeof tankMode!=='undefined' && tankMode) return;
  if(moving){ if(!heldRotations.has(moving))heldRotations.set(moving,moving.rot|0); moving.rot=((moving.rot|0)+1)&3; toast('หมุน'+moving.def.name,'good'); }
  else if(appMode==='build' && tool==='place' && buyKey){
    buyRot=(buyRot+1)&3;
    const d=CATALOG[buyKey];
    toast('หมุน'+d.name+' → '+rotW(d,buyRot)*CM_PER_CELL+'×'+rotH(d,buyRot)*CM_PER_CELL+' ซม.','good');
  } else { toast('ต้องถือของหรือยกของขึ้นมาก่อน','bad'); return; }
  syncRotateBtn();
}
/* ปุ่มหมุนใช้ได้เมื่อมีอะไรอยู่ในมือ · ป้ายบอกทิศ (ความยาวคงที่ ไม่ให้แถบจัดใหม่) */
const ROT_SYM=['·','↻','↺','⇵'];
let _rotLbl='';
function syncRotateBtn(){
  const b=document.getElementById('bRotate')||ensureRotateBtn(); if(!b) return;
  const holding = !!moving || (appMode==='build' && tool==='place' && !!buyKey);
  const r = moving ? (moving.rot|0) : buyRot;
  b.disabled = !holding;
  b.classList.toggle('on', holding && r!==0);
  const lbl='🔄 หมุน 90° (R) '+(holding? ROT_SYM[r] : '·');
  if(lbl!==_rotLbl){ b.textContent=_rotLbl=lbl; }
}
/* สร้างปุ่มเองถ้า index.html ที่เบราว์เซอร์แคชไว้ยังไม่มี #bRotate (กันเคสรีเฟรชไม่หมด) */
function ensureRotateBtn(){
  let b=document.getElementById('bRotate');
  if(!b){
    const anchor=document.querySelector('.sec.buildonly .toolrow');
    if(!anchor) return null;
    const row=document.createElement('div');
    row.className='toolrow'; row.style.marginTop='6px';
    b=document.createElement('button');
    b.className='tbtn'; b.id='bRotate'; b.style.width='100%'; b.disabled=true;
    b.textContent='\ud83d\udd04 \u0e2b\u0e21\u0e38\u0e19 90\u00b0 (R) \u00b7';
    row.appendChild(b); anchor.parentNode.insertBefore(row, anchor.nextSibling);
  }
  b.onclick=rotateHeld;
  return b;
}
ensureRotateBtn();

