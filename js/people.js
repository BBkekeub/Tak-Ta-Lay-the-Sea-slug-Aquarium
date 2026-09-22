let personGrid=null;
function rebuildPersonGrid(){
  personGrid=new Map();
  for(const p of PEOPLE){const key=Math.floor(p.x/12)+','+Math.floor(p.y/12);let bucket=personGrid.get(key);if(!bucket)personGrid.set(key,bucket=[]);bucket.push(p);}
}
function peopleInArea(x0,y0,x1,y1){
  if(!personGrid)return PEOPLE;
  const ax=Math.floor((x0-2)/12),ay=Math.floor((y0-2)/12),bx=Math.floor((x1+2)/12),by=Math.floor((y1+2)/12);
  if((bx-ax+1)*(by-ay+1)>PEOPLE.length*2)return PEOPLE;
  const out=[];for(let x=ax;x<=bx;x++)for(let y=ay;y<=by;y++){const bucket=personGrid.get(x+','+y);if(bucket)for(const p of bucket)out.push(p);}return out;
}

/* ============================================================
   people.js — ลูกค้าเดินดูตู้ในหน้าร้าน (โมเดลคนง่าย ๆ วาดด้วยรูปทรง)
   ------------------------------------------------------------
   · คนเดินบน "พื้นร้าน" หน่วยเดียวกับของอย่างอื่น (ช่องเล็ก = 5 ซม.)
   · เข้าจากขอบหน้าร้าน → ยืนดูตู้ → เดินเล่นต่อ → ออก  (ยืนนิ่งไม่เกิน ~7 วิ)
   · วาดเป็นบิลบอร์ดหันเข้าหาจอ สูงจริงตามสเกลโลก (ZUNIT ต่อ 1 ช่อง)
   · ไล่แสงทรงกระบอก/ทรงกลม + ริมไลต์บนซ้าย + เงาทอดล่างขวา (ทิศเดียวกับ LIGHT)
   · ไม่ยุ่งกับ state เกม (G) เลย ไม่ต้องเซฟ — ปิดได้ด้วยปุ่ม 👥 ลูกค้า
   ============================================================ */

/* ---------- ค่าปรับ ---------- */
const PERSON_SPEED_CM = 82;      // ความเร็วเดินชมของ (ซม./วินาที) — ~0.88 ม./วิ เดินชิลล์ชมของ (ของเดิม 52 = 0.56 ม./วิ ช้าเป็นสโลว์โมชั่น)
/* ปรับหน้าตาท่าเดินได้จากสามตัวนี้ (ลองสดจากคอนโซลได้ ไม่ต้องรีโหลด — เป็น let ตั้งใจ)
   GAIT_NARROW_* = ดึงข้อเท้าเข้าหาแนวกลางตัว 0 = ใช้ตำแหน่งดิบของโมเดล (ข้อเท้าห่างกัน 25.4 ซม. = ขาแบะ)
   GAIT_LEAN_WALK = เอนตัวไปหน้าตอนเดิน เทียบส่วนสูง (0.021 ≈ 7° วัดจากช่วงสะโพก→อก)
   ตัวเลขที่มาของค่าเริ่มต้นอยู่ในคอมเมนต์ตรงจุดที่ใช้จริง (ค้นคำว่า "ขาแบะ") */
let GAIT_NARROW_STAND = 0.30, GAIT_NARROW_WALK = 0.30, GAIT_LEAN_WALK = 0.021;
const WALK_STEP = 0.235;       // ความยาวก้าว เทียบส่วนสูง (~40 ซม. ที่ส่วนสูง 172) — 0.30 ก้าวยาวเกิน ขากางเป็นตัว A
/* ⚠️ 2026-09-23 ผู้เล่น: "ก้าวโอเคแล้วแต่ยกขาเยอะไป" (ส่งรูปมา: เข่าหลังงอสูงเหมือนเดินสวนสนาม)
   ความสูงของเข่ามาจากสองค่านี้ และมันคูณกัน:
     GAIT_LIFT = ยกข้อเท้าขึ้นตรง ๆ ตอนเหวี่ยง
     GAIT_TUCK = ดึงข้อเท้าเข้ามาใต้ตัวกลางช่วงเหวี่ยง → ระยะสะโพก–ข้อเท้าสั้นลง → IK บังคับให้เข่างอเพิ่ม
   ตัวหลังนี่แหละที่ดัน "เข่า" ขึ้นมากกว่าตัวแรก เพราะมันย่นความยาวขาที่ IK ต้องแก้
   คนเดินจริงยกเท้าพ้นพื้นแค่ 1–2 ซม. ตอนกลางช่วงเหวี่ยง (น้อยกว่าที่คนส่วนใหญ่คิดมาก)
   ของเดิม 0.027 = 4.6 ซม. ที่คนสูง 172 คือราวสามเท่าของจริง
   ยังเหลือไว้พอให้เห็นว่าเท้าพ้นพื้น — ถ้าศูนย์เป๊ะจะดูเหมือนไถลบนน้ำแข็ง */
let GAIT_LIFT = 0.015;           // ยกเท้าสูงสุดตอนเหวี่ยง เทียบส่วนสูง (~2.6 ซม.) — ยอดอยู่ช่วงต้น = ส้นตวัดหลัง
let GAIT_TUCK = 0.010;           // ดึงเท้าเข้าใต้ตัวกลางช่วงเหวี่ยง (ยิ่งมาก เข่ายิ่งงอสูง)
const PERSON_R        = 2.5;     // รัศมีกันชนกับตู้/ของ (ช่องเล็ก ≈ 16 ซม.)
const PERSON_EDGE     = 2.0;     // เว้นจากขอบพื้นร้าน (ช่องเล็ก)
const LOOK_MIN = 5, LOOK_MAX = 5;    // ยืนดูตู้นานแค่ไหน (วินาที)
const STROLL_MIN = 1, STROLL_MAX = 2;    // เดินเล่นกี่จุดคั่นระหว่างตู้
/* ดูกี่ตู้ก่อนกลับ — 2–5 → 3–7 (2026-09-19): ลูกค้าอยู่ในร้านนานขึ้น คนเลยค้างอยู่ในฉากพร้อมกันเยอะขึ้น
   ทำให้ร้านดูคึกคักโดยไม่ต้องเร่งอัตราคนเข้าอย่างเดียว (เดินเข้า-ออกถี่ ๆ ดูวุ่นแต่ร้านโล่ง) */
const VISIT_MIN = 3,  VISIT_MAX = 7;
// Arrival timing is computed from the slugs displayed in the shop.
const PERSON_GAP = 7.0;          // ระยะห่างระหว่างคน (ช่องเล็ก = 35 ซม.) — กันยืนซ้อนกัน
/* ⚠️ ดันขึ้นเป็น 8.5 แล้วแย่ลง: แรงแยกไปชนกันชนของตู้บ่อยขึ้น ดันไม่ออก
   วัดได้ว่าเฟรมที่ "เดินอยู่แต่ไม่ขยับ" เพิ่มจาก 6 → 281 และระยะใกล้สุดกลับลดลง 6.6 → 6.29 */

/* ---------- จานสี ---------- */
const P_SKIN  = ['#e8c09a','#d8a476','#b9805a','#8e5b3c','#f2d6b8','#6d4429'];
const P_SHIRT = ['#8fb3bd','#c98d6b','#7d8fb5','#a3b189','#c9a45c','#8d7fa8','#cfd3d6','#6f9e8b','#b4676a','#5f7f8c'];
const P_PANTS = ['#3d4a56','#4a4038','#2f3b45','#54525c','#3b5060','#6b6157','#2b3138'];
const P_HAIR  = ['#241d1a','#43312a','#0f0f10','#6b503a','#8a8f94','#5a3b2e'];
const pick1 = a => a[(Math.random()*a.length)|0];

const PEOPLE = [];
let peopleOn = false;
let shopStatusReason='';
function syncShopStatus(){
  let el=document.getElementById('shopStatus');
  if(!el){el=document.createElement('p');el.id='shopStatus';el.setAttribute('role','status');el.style.cssText='padding:10px;border:1px solid #8e7751;border-radius:6px;line-height:1.6;font-size:13px';const parent=document.getElementById('doorPosition');if(!parent)return;parent.insertAdjacentElement('afterend',el);}
  const message=peopleOn?'ร้านเปิดแล้ว · ลูกค้า '+PEOPLE.length+' คน':shopStatusReason?'เปิดร้านไม่ได้: '+shopStatusReason:'ร้านยังปิดอยู่ — กด “เปิดร้าน” ที่แถบบนเพื่อรับลูกค้า';
  if(el.textContent!==message)el.textContent=message;
  el.style.color=peopleOn?'#a9e0b3':'#f2cd93';
}
let _peopleT = 0, _spawnAt = 1.0;

/* ============================================================
   ตำแหน่ง / การชน
   ============================================================ */
function personBlocked(x, y){
  const E = PERSON_EDGE;
  if(x < E || y < E || x > cellsW()-E || y > cellsH()-E) return true;
  const r = PERSON_R;
  if(!floorRect(x-r,y-r,2*r,2*r))return true;
  for(const o of G.objs){
    if(o === moving) continue;                       // ของที่ถูกยกอยู่ ไม่นับ
    const w = oW(o), h = oH(o);
    if(x > o.cx-r && x < o.cx+w+r && y > o.cy-r && y < o.cy+h+r) return true;
  }
  return false;
}
/* จุดนี้มีคนอื่นยืน/จองไว้แล้วหรือยัง — กันยืนทับกัน (เช็คทั้งตัวจริงและเป้าหมายที่จองไว้) */

// Visibility graph: plan around furniture corners with body clearance.
function personClear(a,b){
  const E=PERSON_EDGE;
  if(!a||!b||![a.x,a.y,b.x,b.y].every(Number.isFinite)||a.x<E||a.y<E||a.x>cellsW()-E||a.y>cellsH()-E||b.x<E||b.y<E||b.x>cellsW()-E||b.y>cellsH()-E)return false;
  const dx=b.x-a.x,dy=b.y-a.y,r=PERSON_R-1e-7;
  if(!floorSegment(a,b,r))return false;
  for(const o of G.objs){if(o===moving)continue;
    const x0=o.cx-r,x1=o.cx+oW(o)+r,y0=o.cy-r,y1=o.cy+oH(o)+r;
    let lo=0,hi=1;
    if(Math.abs(dx)<1e-10){if(a.x<=x0||a.x>=x1)continue;}
    else{let t0=(x0-a.x)/dx,t1=(x1-a.x)/dx;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);}
    if(Math.abs(dy)<1e-10){if(a.y<=y0||a.y>=y1)continue;}
    else{let t0=(y0-a.y)/dy,t1=(y1-a.y)/dy;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);}
    if(lo<=hi)return false;
  }return true;
}
function personRoute(a,b){
  if(!b || personBlocked(b.x,b.y)) return [];
  if(personClear(a,b)) return [b];
  const nodes=[a,b,...floorRouteNodes()], r=PERSON_R+0.8;
  for(const o of G.objs){
    if(o===moving) continue;
    for(const x of [o.cx-r,o.cx+oW(o)+r]) for(const y of [o.cy-r,o.cy+oH(o)+r])
      if(!personBlocked(x,y)) nodes.push({x,y});
  }
  const dist=nodes.map(()=>Infinity), prev=[], done=new Set(); dist[0]=0;
  for(let k=0;k<nodes.length;k++){
    let u=-1;
    for(let j=0;j<nodes.length;j++) if(!done.has(j)&&(u<0||dist[j]<dist[u])) u=j;
    if(u<0||!isFinite(dist[u])) return [];
    if(u===1){ const route=[]; for(let v=1;v!==0;v=prev[v]) route.unshift(nodes[v]); return route; }
    done.add(u);
    for(let v=0;v<nodes.length;v++) if(!done.has(v)){
      const d=dist[u]+Math.hypot(nodes[v].x-nodes[u].x,nodes[v].y-nodes[u].y);
      if(d<dist[v]&&personClear(nodes[u],nodes[v])){dist[v]=d;prev[v]=u;}
    }
  }
  return [];
}

function spotTaken(x, y, self){
  for(const q of PEOPLE){
    if(q === self) continue;
    if(Math.hypot(q.x-x, q.y-y) < PERSON_GAP) return true;
    if(q.tgt && Math.hypot(q.tgt.x-x, q.tgt.y-y) < PERSON_GAP) return true;
  }
  return false;
}
/* จุดยืนดูตู้ — อยู่ "หน้ากระจก" คือฝั่ง x มาก / y มาก (ด้านที่หันเข้าหาจอ)
   กระจายหลายจุดต่อด้าน คนหลายคนจะได้ยืนเรียงกันดูตู้ใบเดียวได้โดยไม่ทับกัน */
function lookSpots(o){
  if(o.type==='tank')return accessibleTankSpots(o).sort(()=>Math.random()-.5);
  const w = oW(o), h = oH(o), g = PERSON_R + 1 + Math.random()*2;      // ห่างตู้ 25–45 ซม.
  const out = [];
  for(let i = 0; i < 3; i++){
    const f = 0.18 + i*0.32;
    out.push({x:o.cx-g,y:o.cy+h*f},{x:o.cx+w*f,y:o.cy-g});
    out.push({x:o.cx + w + g,      y:o.cy + h*f});          // ยืนด้านขวา-หน้า
    out.push({x:o.cx + w*f,        y:o.cy + h + g});        // ยืนด้านซ้าย-หน้า
  }
  out.push({x:o.cx + w + g*0.8,    y:o.cy + h + g*0.8});    // ยืนมุมหน้า
  return out.sort(()=>Math.random()-0.5);
}
function freeSpot(list, self){
  for(const s of list) if(!inDoorWalkway(s.x,s.y)&&!personBlocked(s.x, s.y) && !spotTaken(s.x, s.y, self)) return s;
  return null;                                             // ไม่มีที่ว่างจริง ๆ = ไปทำอย่างอื่นก่อน
}
/* จุดเข้า-ออกร้าน = ขอบหน้า (ฝั่งที่ไม่มีผนัง)
   ⚠️ ต้องเป็นจุดที่ "ยืนได้จริง" — เคยไม่เช็ค แล้วคนเกิดกลางกันชนของตู้ที่วางชิดขอบหน้า
   ผลคือทุกทิศที่ก้าวไปโดนบล็อกหมด → ยืนแข็งอยู่ตรงนั้นตลอดกาล */
/* ประตูที่คนคนนี้ใช้ได้ — ประเภทคนมาจาก p.access (ตั้งตอนสปอน) หรือธงบนตัว
   way='out' ตอนจะออกจากร้าน · 'in' ตอนเดินเข้า
   ⚠️ ถ้าไม่มีบานไหนตั้งเป็นทางออกเลย doorsFor() จะคืนบานที่เหลือให้ใช้ออกแทน
      (ผู้เล่นกำหนด) — ตรงนี้จึงไม่มีทางคืน null เพราะ "ไม่มีทางออก" อีกแล้ว */
function doorSpot(p=null,way='out'){ return chosenDoorSpot(personAccessKind(p),way); }
/* คนที่ "อยู่ในของ" (โดนวางตู้ทับ / เกิดในกันชน) ต้องดันตัวเองออกมาให้ได้
   ไม่งั้นทุกก้าวโดนบล็อกหมดแล้วยืนค้างตลอดกาล

   ⚠️ 2026-09-20 ผู้เล่น: "คนติดอะไรอยู่ ทำไมไม่ออกร้านซักที" (เห็นในจอ: ยืนซ้อนอยู่ในตู้)
   ของเดิมดันออกโดย "ไม่ตรวจว่าดันแล้วหลุดจริงไหม" — พังสามทาง:
     1) ติดในซอกระหว่างของสองชิ้น ชิ้นซ้ายดันไปขวา ชิ้นขวาดันไปซ้าย ผลรวมเป็น 0 → ไม่ขยับ
     2) ด้านที่ใกล้ที่สุดของตู้ A ดันเข้าไปในตู้ B พอดี → เด้งไปมาอยู่กับที่ตลอดกาล
     3) ยืนบนช่องที่ "ไม่ใช่พื้นร้าน" (floorRect ไม่ผ่าน · ร้านรูปตัว L) — personBlocked ตีว่าติด
        แต่ตรงนี้ไม่มีโค้ดดันออกจากช่องไม่ใช่พื้นเลย ex/ey = 0 ทุกเฟรม
   แล้วตัวเฝ้าระวัง _idleWalk ก็ช่วยไม่ได้ เพราะมันนับเฉพาะ "ขยับไม่ได้เลย"
   คนที่เด้งอยู่กับที่ถือว่าขยับได้ ตัวนับถูกรีเซ็ตทุกเฟรม = ค้างถาวร
   (สมาชิกครอบครัวยิ่งหนัก เพราะ _idleWalk ข้ามคนที่มี p.family อยู่แล้ว)
   แก้: ดันแล้วต้องลงที่ว่างจริง ไม่งั้นไล่ลองทิศอื่น · ไม่รอดสักทิศ ให้ตัวนับ _stuckIn
        ใน stepPeopleSlice วาร์ปไปจุดว่างใกล้สุดแทน */
/* 16 ทิศรอบตัว ใช้ทั้งตอนดันออกและตอนหาจุดว่าง — สร้างครั้งเดียว ไม่ใช่ทุกเฟรม */
const UNSTICK_DIRS=Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return [Math.cos(a),Math.sin(a)];});
const UNSTICK_S=2.5;        // ติดต่อเนื่องเกินกี่วินาทีถึงวาร์ป
/* จุดว่างที่ใกล้ตัวที่สุด — ไล่รัศมีทีละครึ่งช่องใหญ่ เรียกเฉพาะตอนจะวาร์ป (ไม่ใช่ทุกเฟรม) */
function nearestFreeSpot(p,maxR=8*SUB){
  for(let r=PERSON_R+1;r<=maxR;r+=SUB/2)
    for(const [ux,uy] of UNSTICK_DIRS){
      const x=p.x+ux*r,y=p.y+uy*r;
      if(!personBlocked(x,y))return {x,y};
    }
  return null;
}
function escapeBlocked(p, dt){
  let ex = 0, ey = 0;
  for(const o of G.objs){
    if(o === moving) continue;
    const r = PERSON_R, x0 = o.cx-r, x1 = o.cx+oW(o)+r, y0 = o.cy-r, y1 = o.cy+oH(o)+r;
    if(p.x <= x0 || p.x >= x1 || p.y <= y0 || p.y >= y1) continue;
    const dL = p.x-x0, dR = x1-p.x, dU = p.y-y0, dD = y1-p.y;   // ออกทางด้านที่ใกล้ที่สุด
    const m = Math.min(dL, dR, dU, dD);
    if(m === dL) ex -= 1; else if(m === dR) ex += 1;
    else if(m === dU) ey -= 1; else ey += 1;
  }
  const E = PERSON_EDGE;                                        // หลุดขอบพื้นก็ดึงกลับเข้ามา
  if(p.x < E) ex += 1; else if(p.x > cellsW()-E) ex -= 1;
  if(p.y < E) ey += 1; else if(p.y > cellsH()-E) ey -= 1;
  const v = p.spd * 1.6 * dt;
  const move=(ux,uy)=>{p.x+=ux*v;p.y+=uy*v;p.motion=1;p.fdx=ux;p.fdy=uy;};   // เดินออกมาให้เห็นว่าขยับ
  const n = Math.hypot(ex, ey);
  /* ทิศที่ใกล้ที่สุดใช้ได้ก็ต่อเมื่อก้าวแล้ว "หลุดจริง" ไม่ใช่ไปโผล่ในของอีกชิ้น */
  if(n && !personBlocked(p.x+ex/n*v, p.y+ey/n*v)){ move(ex/n, ey/n); return; }
  /* ไม่หลุด (ติดซอก / ยืนบนช่องไม่ใช่พื้น) → ไล่หาทิศที่ก้าวแล้วว่างจริง */
  for(const [ux,uy] of UNSTICK_DIRS) if(!personBlocked(p.x+ux*v, p.y+uy*v)){ move(ux,uy); return; }
  /* รอบตัวตันหมดในระยะหนึ่งก้าว — ปล่อยให้ตัวนับ _stuckIn วาร์ปให้ ไม่ต้องขยับมั่ว */
}
/* แยกคนที่ตัวซ้อนกันแบบบังคับตำแหน่ง (แรงผลักอย่างเดียวสู้ความเร็วเดินไม่ทัน) */
function separatePeople(){
  const MIN = PERSON_GAP*0.8;
  for(let a = 0; a < PEOPLE.length; a++) for(let b = a+1; b < PEOPLE.length; b++){
    const p = PEOPLE[a], q = PEOPLE[b];
    let ex = p.x-q.x, ey = p.y-q.y;
    if(Math.abs(ex)>=MIN||Math.abs(ey)>=MIN)continue;
    let e = Math.hypot(ex, ey);
    if(e >= MIN) continue;
    if(e < 0.001){ ex = Math.random()-0.5; ey = Math.random()-0.5; e = Math.hypot(ex,ey)||1; }
    const c = (MIN-e)/2/e, px = ex*c, py = ey*c;
    if(!personBlocked(p.x+px, p.y+py)){ p.x += px; p.y += py; }
    if(!personBlocked(q.x-px, q.y-py)){ q.x -= px; q.y -= py; }
  }
}
/* จุดเดินเล่นกลางร้าน — ให้เห็นคน "เดิน" ไม่ใช่ยืนแช่หน้าตู้ตลอด */
function strollSpot(self){
  for(let i = 0; i < 14; i++){
    const x = PERSON_EDGE + Math.random()*(cellsW()-PERSON_EDGE*2);
    const y = PERSON_EDGE + Math.random()*(cellsH()-PERSON_EDGE*2);
    if(!inDoorWalkway(x,y)&&!personBlocked(x,y) && !spotTaken(x,y,self) && Math.hypot(x-self.x, y-self.y) > 10) return {x,y};
  }
  return doorSpot(self,'out');
}

/* ============================================================
   สร้างคน
   ============================================================ */
// A party owns its itinerary. Children never receive an independent destination.
let _partySequence=0;
function partySpots(anchor,count,party,edgeOnly=false,focus=null){
  const candidates=[anchor];
  /* ⚠️ ต้องใช้ "บานที่ถูกเลือกไว้ใน anchor" ไม่ใช่ G.door (บานแรก) — ตอนนี้ร้านมีประตูได้หลายบาน
     ถ้าอ้างบานแรกเสมอ กลุ่มที่เข้าทางบานอื่นจะถูกตีว่าอยู่นอกกรอบประตูแล้วสปอนไม่ผ่านตลอดกาล */
  const entranceDoor=edgeOnly?(anchor&&anchor.door)||G.door:null;
  const entrance=edgeOnly?entranceRect(entranceDoor):null;
  if(edgeOnly){
    if(!entrance)return null;
    // Use a compact staging area inside the selected doorway for whole parties.
    candidates.length=0;
    for(const depth of [3,11])for(const along of [5,13]){
      candidates.push(entranceDoor.side==='north'
        ?{x:entrance.cx+along,y:entrance.cy+depth}
        :{x:entrance.cx+depth,y:entrance.cy+along});
    }
    candidates.push(anchor);
  }
  if(focus){
    candidates.length=0;
    candidates.push(...accessibleTankSpots(focus).sort((a,b)=>Math.hypot(a.x-anchor.x,a.y-anchor.y)-Math.hypot(b.x-anchor.x,b.y-anchor.y)));
  }else{
    for(const radius of [7.8,11,15,19])for(let i=0;i<16;i++){
      const a=i*Math.PI/8;candidates.push({x:anchor.x+Math.cos(a)*radius,y:anchor.y+Math.sin(a)*radius});
    }
  }
  const selected=[];
  for(const s of candidates){
    if(personBlocked(s.x,s.y)||(!edgeOnly&&inDoorWalkway(s.x,s.y)))continue;
    if(edgeOnly && (s.x<entrance.cx || s.x>=entrance.cx+entrance.w || s.y<entrance.cy || s.y>=entrance.cy+entrance.h))continue;
    if(selected.some(q=>Math.hypot(q.x-s.x,q.y-s.y)<PERSON_GAP+0.3))continue;
    if(PEOPLE.some(q=>(!party||q.family!==party)&&(Math.hypot(q.x-s.x,q.y-s.y)<PERSON_GAP || q.tgt&&Math.hypot(q.tgt.x-s.x,q.tgt.y-s.y)<PERSON_GAP)))continue;
    selected.push(s);if(selected.length===count)return selected;
  }
  return null;
}
function visitorProfiles(kind){
  const adult=()=>({kid:false,gender:Math.random()<.5?'female':'male'});
  const child=()=>({kid:true,gender:Math.random()<.5?'female':'male'});
  if(kind==='couple')return [adult(),adult()];
  if(kind==='parentChild')return [adult(),child()];
  if(kind==='family1')return [adult(),adult(),child()];
  if(kind==='family2')return [adult(),adult(),child(),child()];
  return [adult()];
}
function startPersonAction(p,action,duration,partner=null){
  p.action=action;p.actionT=0;p.actionDuration=duration;p.socialPartner=partner;
}
/* ความแรงของท่าทาง 0→1→0
   ⚠️ เดิมเป็น sin(π·t/dur) ล้วน = แตะยอดแล้วลงทันที ไม่มีช่วงค้างเลย
   ท่า "จับคาง" (3.0 วิ) จึงยกมือขึ้นถึงคาง 1.5 วิ แล้วลดลงทันที ดูเหมือน
   เอาอะไรเข้าปากแล้วเอาออก ไม่ใช่ท่าครุ่นคิด · ตอนนี้เป็น ยก → ค้าง → ลด
   ท่า 3.0 วิ จะได้ค้างเต็ม 2.0 วิพอดี (ยก 0.45 + ค้าง 2.0 + ลด 0.55)
   'jump' ไม่อยู่ในลิสต์ เพราะมันคือการเด้งขึ้น-ลง ค้างกลางอากาศจะดูแปลก */
const HOLD_ACTIONS=['chin','crouch','lean','point','adjust','chat','nod'];
function personGesture(action,t,dur){
  if(action==='watch')return 0;
  const d=dur||1;
  if(!HOLD_ACTIONS.includes(action))return Math.sin(Math.PI*Math.min(1,t/d));
  const rise=Math.min(.45,d*.2), fall=Math.min(.55,d*.25), ss=v=>v*v*(3-2*v);
  if(t<rise)   return ss(Math.max(0,t/rise));
  if(t<d-fall) return 1;
  return ss(Math.max(0,Math.min(1,(d-t)/fall)));
}
function beginPersonBrowse(p){
  p.state='look';p.t=0;p.lookT=(p.raceChallenger||p.tugChallenger||p.eatChallenger||p.throwChallenger||p.sumoChallenger)?Infinity:5;p._browseActed=false;
  p.action='watch';p.actionT=0;p.actionDuration=0;p.socialPartner=null;
  p.socialCooldown=.5+Math.random()*.5;
}
function syncVisitorHUD(){
  syncShopStatus();
  const score=visitorAttraction(),capacity=visitorCapacity();
  const stats=[['hAttraction',String(score)],['hVisitors',PEOPLE.length+'/'+capacity]];
  for(const [id,value] of stats){const node=document.getElementById(id);if(node&&node.textContent!==value)node.textContent=value;}
  const node=document.getElementById('hAttraction');
  if(node){const title='ลูกค้ากลุ่มใหม่ทุก '+visitorInterval(score)+' วินาที';if(node.parentElement.title!==title)node.parentElement.title=title;}
}
function stepPersonLife(p,dt){
  p.actionT=(p.actionT||0)+dt;p.socialCooldown=Math.max(0,(p.socialCooldown||0)-dt);
  if(p.actionT>=(p.actionDuration||0)||p.state!=='look'){
    p.action='watch';p.socialPartner=null;
  }
  if(p.state==='look'&&!p._browseActed&&p.action==='watch'&&p.socialCooldown<=0){
    const companions=p.family?p.family.members.filter(q=>q!==p&&!q._browseActed&&q.state==='look'&&Math.hypot(q.x-p.x,q.y-p.y)<22&&!q.socialPartner):[];
    const partner=companions.length?pick1(companions):null;
    p._browseActed=true;
    const choice=Math.random();
    if(p.kid&&choice<.3){startPersonAction(p,'jump',1.8);}
    else if(choice<.48){startPersonAction(p,'crouch',3.2);}
    else if(choice<.7){startPersonAction(p,'chin',3.0);}
    else if(partner&&choice<.82){
      const duration=2.1+Math.random()*1.8;
      partner._browseActed=true;
      startPersonAction(p,'chat',duration,partner);startPersonAction(partner,'nod',duration,p);
      partner.socialCooldown=duration+4+Math.random()*4;
    }else if(choice<.90){startPersonAction(p,'point',2+Math.random()*1.5);}
    else if(choice<.97){startPersonAction(p,'lean',2.8+Math.random()*2);}
    else{startPersonAction(p,'adjust',1.8);}
    p.socialCooldown=5+Math.random()*5;
  }
  let target=p.socialPartner&&PEOPLE.includes(p.socialPartner)?p.socialPartner:null;
  // Glance back at a companion who is still catching up, without stopping in the aisle.
  if(!target&&p.family&&p.state!=='look')target=p.family.members.find(q=>q!==p&&Math.hypot(q.x-p.x,q.y-p.y)>18);
  let yaw=0;
  if(target){
    const angle=Math.atan2(target.y-p.y,target.x-p.x)-Math.atan2(p.fdy,p.fdx);
    yaw=Math.max(-1.05,Math.min(1.05,Math.atan2(Math.sin(angle),Math.cos(angle))));
  }
  p.headYaw=(p.headYaw||0)+(yaw-(p.headYaw||0))*(1-Math.exp(-dt*5));
}

// Floor area controls occupancy; displayed slugs control arrival frequency.
let _arrivalScore=null, _pendingParty=null, _arrivalRetryAt=0;
/* ⚠️ 2026-09-19 ผู้เล่น: "ขอให้ร้านมันดูคึกคักขึ้นมาหน่อย" — เดิม 1 คนต่อ 4 ช่อง (ร้านเริ่มต้น 48 ช่อง = 12 คน)
   ลดเหลือ 1 คนต่อ 3 ช่อง → ร้านเริ่มต้นรับได้ 16 คน · พื้นที่เท่าเดิมแต่คนแน่นขึ้นครึ่งหนึ่ง */
function visitorCapacity(){return Math.max(0,Math.floor(floorArea()/3));}
/* ---- โควตาคนในร้าน แยกกันคนละถัง (ผู้เล่นสั่ง 2026-09-19) ----
   ⚠️ เดิมผู้ท้าแข่ง 9 คน (กินจุ 3 + ปาหิน 3 + วิ่ง 2 + ชักเย่อ 1) กับพ่อค้า นับรวมโควตาเดียวกับลูกค้า
      ร้าน 48 ช่อง = ความจุ 12 → เหลือที่ให้ลูกค้าจริงแค่ 3 · ร้าน 24 ช่อง = เหลือ 0 (ลูกค้าเข้าไม่ได้เลย)
   ตอนนี้: ลูกค้าใช้ visitorCapacity() ของตัวเอง · ผู้ท้าแข่ง/พ่อค้ามีเพดานของตัวเอง ไม่แย่งที่กัน */
const isChallenger=p=>!!(p&&(p.raceChallenger||p.tugChallenger||p.eatChallenger||p.throwChallenger||p.sumoChallenger));
/* นักสะสม (ลูกค้าใส่หมวก) นับรวมโควตา "แขกพิเศษ" กับพ่อค้า ไม่กินที่ลูกค้าปกติ
   ไม่งั้นช่วงแรกที่เพดานลูกค้าแค่ 2–3 คน เขาจะแทบไม่มีโอกาสเข้าร้านเลย */
const isTrader=p=>!!(p&&(p.wantsSell||p.wholesaleBuyer||p.collector));
const isCustomer=p=>!!p&&!isChallenger(p)&&!isTrader(p);
function customerCount(){let n=0;for(const p of PEOPLE)if(isCustomer(p))n++;return n;}
function challengerCount(){let n=0;for(const p of PEOPLE)if(isChallenger(p))n++;return n;}
function traderCount(){let n=0;for(const p of PEOPLE)if(isTrader(p))n++;return n;}
const CHALLENGER_MAX=10, TRADER_MAX=2;          // เพดานของแต่ละถัง (ไม่เกี่ยวกับความจุลูกค้า)
const ENTRY_FEE=1;                              // ⚙️ ค่าเข้าร้าน ลูกค้าคนละกี่ทอง (ผู้เล่นกำหนด 2026-09-21)
/* ตอนนี้เก็บค่าเข้าได้ไหม — คอมสลับแท็บยังนับ · มือถือสลับแอป/ดับจอไม่นับ (ผู้เล่นกำหนด 2026-09-22)
   ประกาศเป็น function ไม่ใช่ const เพื่อให้เทสต์สลับเครื่องจำลองได้ (PHONE_SCREEN มาจาก shop-floor.js) */
function onPhoneScreen(){
  return typeof PHONE_SCREEN!=='undefined' ? PHONE_SCREEN
    : matchMedia('(pointer: coarse)').matches && Math.min(screen.width,screen.height)<=600;
}
function entryFeeCounts(){ return !document.hidden || !onPhoneScreen(); }
/* ---- ค่าเข้าย้อนหลังตอนไม่ได้เฝ้าร้าน (ผู้เล่นกำหนด 2026-09-22) ----
   "ปิดอยู่ 8 ชั่วโมงได้ไม่เกิน 2000 · ไม่เข้ามาใน 8 ชั่วโมงก็ไม่มีทางเกิน 2000"
   → จ่ายตามเวลาที่หายไปจริง AWAY_RATE ทอง/ชม. แต่ชนเพดาน AWAY_CAP ที่ 8 ชม. พอดี
     หายไป 2 ชม. = 500 · 8 ชม. = 2,000 · 3 วัน = 2,000 เท่าเดิม (ทิ้งไว้นานกว่านั้นไม่ได้เพิ่ม)
   นับเฉพาะตอน "เปิดร้านค้างไว้" — ปิดร้านอยู่ไม่มีลูกค้า จึงไม่มีค่าเข้าให้สะสม
   ครอบคลุมทั้งปิดเกมไปเลย และมือถือพับแอป/ดับจอ (ซึ่งไม่ได้ค่าเข้าสด)
   ส่วนคอมที่เปิดค้างไว้แล้วสลับแท็บยังได้ค่าเข้าสดอยู่ เวลาจึงไม่ถูกนับเป็น "ไม่อยู่" ซ้ำซ้อน */
const AWAY_RATE=250, AWAY_CAP=2000, AWAY_MIN_SEC=60;
function awayHours(sec){const h=sec/3600;return h>=1?h.toFixed(1)+' ชม.':Math.round(sec/60)+' นาที';}
function awayMark(){ if(peopleOn&&entryFeeCounts())G.seenAt=Date.now(); }
function awayIncomeTick(){
  const now=Date.now();
  if(!Number.isFinite(G.seenAt))G.seenAt=now;                 // เซฟเก่า/เกมใหม่ = เริ่มนับจากตอนนี้ ไม่แจกย้อนหลัง
  if(!peopleOn){G.seenAt=now;return;}                          // ปิดร้าน = ไม่สะสมเวลา
  if(!entryFeeCounts())return;                                 // มือถือพับแอปอยู่ = ปล่อยเวลาเดิน รอจ่ายตอนกลับมา
  const away=(now-G.seenAt)/1000;
  G.seenAt=now;
  if(away<AWAY_MIN_SEC)return;                                 // แวบเดียวไม่ต้องเด้งข้อความ
  const gold=Math.min(AWAY_CAP,Math.floor(away/3600*AWAY_RATE));
  if(gold<=0)return;
  addCoin(gold);
  if(typeof toast==='function')toast('🏪 ค่าเข้าร้านตอนไม่อยู่ '+awayHours(away)+' · +'+gold.toLocaleString()+' ทอง'+(gold>=AWAY_CAP?' (เต็มเพดาน '+AWAY_CAP.toLocaleString()+')':''),'good');
  if(typeof saveGame==='function')saveGame();
}
setInterval(awayIncomeTick,1000);
document.addEventListener('visibilitychange',()=>{ if(document.hidden){awayMark();if(typeof saveGame==='function')saveGame();} });
function challengerRoom(){return Math.max(0,CHALLENGER_MAX-challengerCount());}
function traderRoom(){return Math.max(0,TRADER_MAX-traderCount());}
function visitorAttraction(){const slug=G.objs.reduce((n,o)=>n+(o.type==='tank'&&Array.isArray(o.slugs)?o.slugs.length*(typeof tankAttractionFactor==='function'?tankAttractionFactor(o):1):0),0);const deco=G.objs.reduce((n,o)=>n+((o.type==='deco'&&o._key!=='counter'&&o.def&&Number.isFinite(o.def.attr))?o.def.attr:0),0);const tankDeco=G.objs.reduce((n,o)=>n+((o.type==='tank'&&Array.isArray(o.decor))?o.decor.length*0.5:0),0);return Math.round((slug+deco+tankDeco)*10)/10;}
function visitorInterval(score){return Math.max(20,60-Math.max(0,Math.ceil(Math.max(0,score)/10)-1)*5);}
/* ---- พื้น / เพดานจำนวนลูกค้า ----
   ช่วงแรกความดึงดูดต่ำ ลูกค้ามาห่างกัน 60 วิ แต่แต่ละคนอยู่ในร้านแค่ ~30-40 วิ
   ค่าเฉลี่ยจึงเหลือคนในร้านไม่ถึง 1 คน = ร้านโล่งเกือบตลอด
   แก้ที่ "อัตราการไหลเข้า" ไม่ใช่ "เวลาที่อยู่": ถ้าในร้านน้อยกว่าพื้นของช่วง
   คนถัดไปจะเข้ามาภายใน QUIET_GAP วินาที (และเลือกกลุ่มเล็กเพื่อเติมให้ไว) */
var QUIET_GAP=3;       // วินาทีระหว่างคนเข้า ตอนที่ยังไม่ถึงขั้นต่ำ
/* ⚠️ 2026-09-20 ผู้เล่น: "สูตรมันปรับซะยากไปหน่อยว่ะ"
   เลิกใช้สูตรพีระมิด (ATTR_STEP · n = (√(1+8·score/STEP)−1)/2) ที่ต้องแก้ตัวคูณ
   แล้วไล่คำนวณทั้งเส้นกว่าจะรู้ว่าได้กี่คน — เปลี่ยนเป็น "ตารางช่วง" อ่านออก แก้ทีละแถวได้
   แต่ละช่วงมีสองค่า: พื้น = เติมคนให้ถึงเร็ว ๆ · เพดาน = ห้ามเกิน
   จำนวนจริงจึงลอยอยู่ระหว่างสองค่าตามจังหวะคนเข้า-ออก = ที่ผู้เล่นเขียนว่า "2-3 คน"
   ⚠️ 2026-09-21 ผู้เล่น: "คนเยอะไปว่ะ" — ตารางใหม่ตามที่สั่ง (เพดานลดลงทุกช่วงกลาง)
     ดึงดูด   0–19   → 2–3 คน
     ดึงดูด  20–49   → 4–5 คน
     ดึงดูด  50–79   → 5–6 คน
     ดึงดูด  80–119  → 6–7 คน
     ดึงดูด 120 ขึ้นไป → ความดึงดูด ÷ VISITOR_SCORE_DIV (ปลายเกมโตตามความดึงดูด ไม่ตันที่ 7)
   ⚠️ ช่วงสุดท้ายต้องไม่ต่ำกว่าช่วงก่อนหน้า (Math.max กับ 6–7) ไม่งั้นจำนวนคนจะกลับหัวกลับหางตรงรอยต่อ
      ที่ดึงดูด 120 พอดี สูตรให้ 6 ซึ่งเท่ากับพื้นของช่วงก่อน → ต่อเนื่องกันพอดี แล้วค่อยโตทีละคนทุก 20 แต้ม
   ⚠️ นับเฉพาะ "ลูกค้า" (isCustomer) — ผู้ท้าแข่ง/พ่อค้ามีถังของตัวเอง ไม่กินโควตานี้ */
/* ปรับสดจากคอนโซลได้: ShopBusy.show() ดูตาราง · ShopBusy.set(20,5,6) แก้พื้น/เพดานของช่วงที่เริ่มที่ 20
   ค่าที่ชอบแล้วบอกมา จะได้ใส่เป็นค่าตั้งต้นถาวร (ค่านี้ไม่ถูกเซฟ รีเฟรชแล้วกลับเป็นค่าตั้งต้น) */
var VISITOR_BANDS=[[0,2,3],[20,4,5],[50,5,6],[80,6,7]];   // [ความดึงดูดที่เริ่มช่วงนี้, พื้น, เพดาน]
var VISITOR_SCORE_FROM=120, VISITOR_SCORE_DIV=20;         // ดึงดูดตั้งแต่เท่านี้ → ใช้ความดึงดูด ÷ เท่านี้แทน
function visitorBand(capacity,score=visitorAttraction()){
  const s=Math.max(0,score),top=VISITOR_BANDS[VISITOR_BANDS.length-1];
  let lo=top[1],hi=top[2];
  if(s>=VISITOR_SCORE_FROM){
    /* n = เป้าของช่วงนี้ · เว้นช่วง n-1 ถึง n ไว้เหมือนช่วงอื่น ไม่งั้นพื้น=เพดาน
       จำนวนคนจะแข็งเป๊ะไม่มีจังหวะหายใจ (และต่อเนื่องกับช่วงก่อน: ดึงดูด 120 → 6–7 พอดี) */
    const n=Math.floor(s/VISITOR_SCORE_DIV);
    lo=Math.max(lo,n-1);hi=Math.max(hi,n);
  }else{
    const b=VISITOR_BANDS.filter(b=>s>=b[0]).pop()||VISITOR_BANDS[0];
    lo=b[1];hi=b[2];
  }
  const cap=Math.max(0,capacity);
  return {lo:Math.min(cap,lo),hi:Math.min(cap,hi)};
}
/* เพดานของช่วง — ใช้เป็น "เป้า" ของชุดเปิดร้านและตัวจัดคิว */
function visitorTarget(capacity,score=visitorAttraction()){return visitorBand(capacity,score).hi;}
/* ความนิยมที่ต้องมีเพื่อให้ได้ลูกค้าพร้อมกัน n คน (ใช้โชว์ใน HUD/ดีบัก) */
function attractionForVisitors(n){const b=VISITOR_BANDS.find(b=>b[2]>=n);return b?b[0]:Math.max(VISITOR_SCORE_FROM,n*VISITOR_SCORE_DIV);}
function visitorFloor(capacity){return visitorBand(capacity).lo;}
/* คนที่กำลังเดินออก ไม่นับว่าอยู่ในร้านแล้ว — สั่งคนใหม่ตั้งแต่ตอนเขาเริ่มเดินออก
   คนใหม่จะเดินสวนเข้ามาพอดี ร้านเลยไม่มีช่วงโล่งระหว่างรอยต่อ */
function visitorPresent(){let n=0;for(const p of PEOPLE)if(p.state!=='leave'&&isCustomer(p))n++;return n;}
/* ตอนเติมให้ถึงขั้นต่ำใช้เฉพาะกลุ่มเล็ก — ครอบครัว 4 คนต้องรอที่ยืนพร้อมกัน 4 จุด ช้ากว่ามาก */
function chooseQuietKind(need,capacity){
  const room=Math.max(1,Math.min(need,capacity));
  const menu=[['solo',1,70],['couple',2,30]].filter(x=>x[1]<=room);
  if(!menu.length)return 'solo';
  let roll=Math.random()*menu.reduce((sum,x)=>sum+x[2],0);
  for(const option of menu){roll-=option[2];if(roll<0)return option[0];}
  return menu[menu.length-1][0];
}
/* ดูกี่ตู้ก่อนกลับ — ผูกกับจำนวนตู้ในร้าน
   ร้านมี 2 ตู้แล้วเดินวน 5 รอบมันประหลาด ช่วงแรกจึงเป็น "เข้ามาดู แล้วออก" */
/* ตู้ที่ถูกจองให้อีเวนต์ — มีผู้ท้าแข่งชักเย่อ/วิ่งยืนรออยู่ หรือกำลังมีทัวร์นาเมนต์ · ลูกค้าปกติไม่เดินไปดู ไม่ยื่นซื้อ */
function eventReservedTank(o){return !!(window.SlugTug?.reserved?.(o)||window.SlugRace?.reserved?.(o)||window.SlugEat?.reserved?.(o)||window.SlugThrow?.reserved?.(o)||window.SlugSumo?.reserved?.(o));}
function visitorVisits(){
  const tanks=(G.objs||[]).filter(o=>o&&o.type==='tank'&&o!==moving).length;
  const cap=Math.min(VISIT_MAX,tanks),min=Math.min(VISIT_MIN,cap);
  return min+((Math.random()*(cap-min+1))|0);
}
function chooseVisitorKind(capacity){
  const menu=[['solo',1,50],['couple',2,30],['family1',3,10],['family2',4,5],['parentChild',2,5]].filter(x=>x[1]<=capacity);
  if(!menu.length)return null;
  let roll=Math.random()*menu.reduce((sum,x)=>sum+x[2],0);
  for(const option of menu){roll-=option[2];if(roll<0)return option[0];}
  return menu[menu.length-1][0];
}
let _openingRemaining=null, _openingAt=0, _openingParty=null;
function openingVisitorCount(score,capacity){
  /* ชุดแรกตอนเปิดร้านต้องไม่ทะลุเป้าเหมือนกัน ไม่งั้นกดเปิดร้านแล้วคนพรึ่บเกินที่ตั้งไว้ */
  return Math.min(capacity,6,visitorTarget(capacity,score),2+Math.floor(Math.max(0,score-1)/20));
}
function stepOpeningVisitors(capacity,score){
  // Wait for the first real animation tick, after the saved shop has loaded.
  if(_peopleT<=0)return true;
  if(_openingRemaining===null)_openingRemaining=openingVisitorCount(score,capacity);
  if(_openingRemaining<=0)return false;
  _openingRemaining=Math.min(_openingRemaining,capacity);
  if(_openingParty&&_openingParty.profiles.length>_openingRemaining)_openingParty=null;
  if(_peopleT<_openingAt)return true;
  if(!_openingParty){const kind=chooseVisitorKind(_openingRemaining);_openingParty={kind,profiles:visitorProfiles(kind)};}
  const count=_openingParty.profiles.length;
  if(capacity-customerCount()<count)return true;
  if(spawnVisitors(capacity-customerCount(),_openingParty.kind,_openingParty.profiles)){
    _openingRemaining-=count;_openingParty=null;
    _openingAt=_peopleT+2+Math.random()*2;
    _arrivalScore=score;_spawnAt=_peopleT+visitorInterval(score);
  }else _openingAt=_peopleT+1;
  return true;
}

function stepVisitorArrivals(){
  syncVisitorHUD();
  const capacity=visitorCapacity(),score=visitorAttraction();
  if(!capacity){_pendingParty=null;_arrivalScore=null;_spawnAt=Infinity;return;}
  if(stepOpeningVisitors(capacity,score))return;
  /* พ่อค้าเร่/คนรับเหมาถือตู้ทากมาขาย (slug-peddler.js) — คิวแยกจากลูกค้าปกติ
     gate: ยังไม่ถึงเควสพ่อค้าเร่ (บทที่ 2) ยังไม่ให้มา — sellerSystemUnlocked() มาจาก quests.js */
  if(typeof stepPeddlerArrival==='function' && (typeof sellerSystemUnlocked!=='function'||sellerSystemUnlocked()) && stepPeddlerArrival(capacity))return;
  /* นักสะสมใส่หมวก (slug-collector.js) — มานาน ๆ ครั้ง เดินดูตู้แล้วเสนอราคาสูงกับทากยีนเด่น */
  if(typeof stepCollectorArrival==='function' && stepCollectorArrival(capacity))return;
  if(score!==_arrivalScore){
    if(_arrivalScore===null||!isFinite(_spawnAt))_spawnAt=_peopleT+visitorInterval(score);
    else if(!_pendingParty){
      // Preserve progress toward the next arrival when the number of slugs changes.
      const ratio=visitorInterval(score)/visitorInterval(_arrivalScore);
      _spawnAt=_peopleT+Math.max(0,_spawnAt-_peopleT)*ratio;
    }
    _arrivalScore=score;
  }
  if(_pendingParty&&_pendingParty.profiles.length>capacity){
    _pendingParty=null;_spawnAt=_peopleT+visitorInterval(score);
  }
  /* พื้น = เติมให้ถึงไว ๆ (โหมดช่วงเงียบ) · เพดาน = ห้ามเกิน — คนละค่ากัน ดูตาราง VISITOR_BANDS */
  const band=visitorBand(capacity,score),floorN=band.lo,ceilN=band.hi;
  const here=visitorPresent(),seen=customerCount(),quiet=here<floorN;
  if(quiet){
    const need=floorN-here;
    if(_pendingParty&&_pendingParty.profiles.length>Math.max(1,need))_pendingParty=null;
    if(_spawnAt>_peopleT+QUIET_GAP)_spawnAt=_peopleT+QUIET_GAP;
  }
  /* ⚠️ เพดานจริงอยู่ตรงนี้ — ก่อนหน้านี้เป้าถูกใช้เป็นแค่ "พื้น" เติมคนจนชน visitorCapacity()
     (พื้นที่ ÷ 3) ความดึงดูดจึงไม่ได้คุมจำนวนคนเลย ร้าน 48 ช่องดันไปได้ถึง 16 คน
     ⚠️ ต้องเช็กสองตัว: here (ไม่นับคนกำลังเดินออก) กับ seen (นับหมดเท่าที่ตายังเห็น)
        here อย่างเดียวไม่พอ — ตอนมีคนเดินออก 2 คน here ต่ำกว่าเป้า ระบบเลยเติมคนใหม่เข้ามาทับ
        แล้วในจอมีพร้อมกันเกินเป้าไป 2-3 คน (วัดจริงแล้ว: เป้า 6-7 แต่เห็นสูงสุด 9)
        ยอมให้ล้นได้ 1 คนพอดี = ยังมีคนเดินสวนเข้ามาแทนทันที ร้านไม่โล่งเป็นช่วง ๆ */
  if(here>=ceilN||seen>ceilN){ _spawnAt=_peopleT+1; return; }
  if(_peopleT<_spawnAt)return;
  /* ขนาดกลุ่มต้องไม่ล้นที่ว่างที่เหลือ ไม่งั้นเป้า 3 คนแต่ครอบครัว 4 คนมาทั้งก้อน = ทะลุเป้าทุกครั้ง
     ⚠️ ห้ามมี Math.max(1,…) ครอบ — นั่นแปลว่า "อย่างน้อยรับได้ 1 คนเสมอ" ซึ่งทำให้เพดานรั่วทุกรอบ */
  const room=Math.min(capacity-seen,ceilN-here,ceilN-seen+1);
  if(room<1){ _spawnAt=_peopleT+1; return; }
  if(_pendingParty&&_pendingParty.profiles.length>room)_pendingParty=null;
  if(!_pendingParty){const kind=quiet?chooseQuietKind(floorN-visitorPresent(),room):chooseVisitorKind(room);_pendingParty={kind,profiles:visitorProfiles(kind)};}
  if(room<_pendingParty.profiles.length||_peopleT<_arrivalRetryAt)return;
  if(spawnVisitors(room,_pendingParty.kind,_pendingParty.profiles)){
    _pendingParty=null;_spawnAt=_peopleT+visitorInterval(score);
  }else _arrivalRetryAt=_peopleT+1; // Entrance physically blocked: retain the same party.
}

/* ---- คิวประตู: คนเข้าร้านห่างกันอย่างน้อย DOOR_GAP วินาที/คน (ลูกค้า · พ่อค้า · ผู้ท้าแข่ง ใช้คิวเดียวกัน) ----
   เดิมทั้งกลุ่ม (และคนจากระบบอื่นที่สปอนเฟรมเดียวกัน) โผล่พร้อมกันหน้าประตู → ยืนอัดกันติดทางเข้า
   คนที่ยังไม่ถึงคิวอยู่ใน PEOPLE แล้ว (ระบบแข่ง/พ่อค้าหาตัวเจอทันที) แต่ "ยังไม่เข้าร้าน":
   ไม่ขยับ ไม่ถูกวาด คลิกไม่ได้ (personEntered → stepPeople / personOnScreen) · ยังจองจุดยืนหน้าประตูไว้ คนอื่นจึงไม่มาทับ */
const DOOR_GAP=1;
let _doorFreeAt=0;
function personEntered(p){return !(p._enterAt>_peopleT);}
/* ชนิดกลุ่มที่สปอน → ประเภทสิทธิ์ผ่านประตู · ที่ไม่อยู่ในตารางนี้คือลูกค้าปกติ
   ⚠️ พ่อค้าส่งใช้ kind 'solo' เหมือนลูกค้าเดี่ยว แยกด้วยชื่อไม่ได้
      slug-wholesaler.js จึงส่ง accessKind='wholesale' เข้ามาตรง ๆ */
const SPAWN_ACCESS={peddler:'peddler',race:'challenger',tug:'challenger',eat:'challenger',throw:'challenger',sumo:'challenger',collector:'cust'};
function spawnVisitors(capacity,requestedKind=null,requestedProfiles=null,accessKind=null){
  // คิวยังค้างเกิน 1 คน = ยังไม่รับกลุ่มใหม่ (ผู้เรียกทุกตัวลองใหม่รอบหน้าอยู่แล้ว) คิวจึงไม่ยาวสะสม
  if(_doorFreeAt>_peopleT+DOOR_GAP)return false;
  const kind=requestedKind||chooseVisitorKind(capacity);if(!kind)return false;
  const access=accessKind||SPAWN_ACCESS[kind]||'cust';
  /* ไม่มีประตูบานไหนให้คนประเภทนี้เข้าเลย = ไม่ต้องสปอน (ผู้เล่นตั้งใจปิดกั้นไว้) */
  if(!doorsFor(access,'in').length)return false;
  const profiles=requestedProfiles||visitorProfiles(kind),count=profiles.length;if(count>capacity)return false;
  for(let attempt=0;attempt<15;attempt++){
    const door=chosenDoorSpot(access,'in');if(!door)continue;
    const spots=partySpots(door,count,null,true);if(!spots)continue;
    const g=count>1?{kind,members:[],visits:visitorVisits(),stage:'new',time:0,replan:false}:null;
    const batch=[];
    for(let i=0;i<count;i++){
      const p=makePerson({...profiles[i],at:spots[i]});if(!p)break;
      p.access=access;
      p.family=g;if(g)p.spd=PERSON_SPEED_CM/CM_PER_CELL*(p.kid?1.04:.96);
      batch.push(p);
    }
    if(batch.length!==count)continue;
    if(kind==='peddler'&&typeof makePeddler==='function'&&!makePeddler(batch[0]))continue;
    if(kind==='collector'&&typeof makeCollector==='function'&&!makeCollector(batch[0]))continue;   // ลูกค้าใส่หมวก (slug-collector.js)
    const first=Math.max(_peopleT,_doorFreeAt);
    batch.forEach((p,i)=>{p._enterAt=first+i*DOOR_GAP;});
    _doorFreeAt=first+batch.length*DOOR_GAP;
    if(g){g.members=batch;assignFamilyBuyer(batch);}PEOPLE.push(...batch);_partySequence++;return true;
  }
  return false;
}
function planFamily(g){
  endFamilyColumn(g);
  for(const p of g.members){stopRegroup(p);p._yieldResume=null;p._groupViewed=false;p._routeRetryAt=0;p._pathRetryAt=0;p.crowdCooldown=0;}
  g.firstArrivedAt=null;
  const leader=g.members[0],tanks=G.objs.filter(o=>o.type==='tank'&&o!==moving&&!eventReservedTank(o));
  const leaving=g.visits<=0||!tanks.length;
  /* เดิม filter ตู้ที่เพิ่งดูทิ้งไปเลย → ถ้าในร้านเหลือตู้ที่ยืนกันได้ทั้งกลุ่มแค่ตู้นั้นตู้เดียว
     กลุ่มจะวางแผนไม่สำเร็จตลอดกาล = ยืนแข็งคาที่ ตอนนี้แค่ "ไปอยู่ท้ายคิว" ยังชอบตู้ใหม่เหมือนเดิม */
  const mkOptions=list=>list.flatMap(o=>lookSpots(o).map(spot=>({spot,focus:o}))).sort(()=>Math.random()-.5);
  const options=leaving?Array.from({length:16},()=>({spot:doorSpot(leader,'out'),focus:null})):
    [...mkOptions(tanks.filter(o=>o!==g.focus)), ...mkOptions(tanks.filter(o=>o===g.focus))];
  for(const choice of options){
    if(!choice.spot)continue;
    const spots=leaving?g.members.map(()=>({...choice.spot})):partySpots(choice.spot,g.members.length,g,leaving,choice.focus);if(!spots)continue;
    const routes=g.members.map((p,i)=>personRoute(p,spots[i]));
    if(routes.every(r=>!r.length))continue;
    g.stage=leaving?'leave':'walk';g.focus=choice.focus;g.time=0;g.replan=false;
    g.members.forEach((p,i)=>{
      p._familyGoal=spots[i];p.tgt=spots[i];p.route=routes[i];p.routeGoal=p.tgt;p.focus=choice.focus;
      p.state=routes[i].length?(leaving?'leave':'walk'):'wait';p.stuck=0;p.t=0;p.lookT=Infinity;
    });
    return true;
  }
  // A crowded shop can temporarily have no group-sized spot. Stay together and retry.
  g.stage='planning';g.time=0;g.replan=true;
  for(const p of g.members){p.state='wait';p.tgt={x:p.x,y:p.y};}
  return false;
}
function stepFamilies(dt){
  const groups=new Set(PEOPLE.map(p=>p.family).filter(Boolean));
  for(const g of groups){
    if(g.members.some(p=>p.tradeOffer))continue;
    g.time+=dt;
    /* ---- กันกลุ่ม "ยืนแข็ง" ถาวร ----
       ครอบครัว 4 คน (พ่อแม่+ลูก 2) ต้องการที่ยืนหน้าตู้ 4 จุดพร้อมกัน แต่ตู้กลางมีที่ยืนแค่ 2-3 จุด
       planFamily จึงล้มเหลวทุกครั้ง วนขอใหม่ทุก 2 วิ ไม่มีวันสำเร็จ = ทั้งกลุ่มยืนนิ่งคาประตูตลอดไป
       ทางออกไล่ระดับ: หาที่ยืนไม่ได้ 8 วิ -> เลิกดู เดินออกจากร้าน · ยังไม่ได้อีก 8 วิ -> แยกกันเดินเดี่ยว
       (คนเดียวหาที่ยืนได้เสมอ เพราะขอที่แค่จุดเดียว) */
    if(g.stage==='planning'){
      g.planFail=(g.planFail||0)+dt;
      if(g.planFail>8&&g.visits>0){g.visits=0;g.replan=true;g.time=99;}      // ออกจากร้านแทนการยืนรอ
      if(g.planFail>16){
        for(const p of g.members){p.family=null;p._familyGoal=null;p._regroup=null;p.state='walk';p.tgt=null;p.route=[];p.stuck=0;p.lookT=0;nextGoal(p);}
        g.members=[];continue;
      }
    }else g.planFail=0;
    if(g.stage==='new'||g.replan&&g.time>2&&g.firstArrivedAt==null&&g.stage!=='look'){planFamily(g);continue;}
    if(g.focus&&(!G.objs.includes(g.focus)||g.focus===moving)){planFamily(g);continue;}
    const atDestination=p=>{const goal=p._familyGoal||p.tgt;return goal&&Math.hypot(p.x-goal.x,p.y-goal.y)<1.2;};
    const ready=g.members.filter(atDestination);
    if((g.stage==='walk'||g.stage==='look')&&ready.length<g.members.length&&refitFamilyAtTank(g,atDestination))continue;
    if(g.stage==='leave'){
      if(ready.length){
        endFamilyColumn(g);
        const departed=new Set(ready);
        for(const p of ready){stopRegroup(p);p.family=null;}
        g.members=g.members.filter(p=>!departed.has(p));
        for(let i=PEOPLE.length-1;i>=0;i--)if(departed.has(PEOPLE[i]))PEOPLE.splice(i,1);
        for(const p of g.members)if(p._regroup&&departed.has(p._regroup.leader))stopRegroup(p);
      }
      if(g.members.length&&g.time>35)g.replan=true;
      continue;
    }
    if(g.stage==='walk'&&ready.length){
      if(g.firstArrivedAt==null){
        g.firstArrivedAt=g.time;g.replan=false;
        endFamilyColumn(g);for(const p of g.members)stopRegroup(p);
      }
      for(const p of ready){p.state='wait';}
      if(ready.length===g.members.length||g.time-g.firstArrivedAt>=2){
        g.stage='look';g.time=0;g.lookFor=5;
        for(const p of ready){beginPersonBrowse(p);p._groupViewed=true;p.lookT=Infinity;}
      }
    }
    if(g.stage==='look'){
      for(const p of ready)if(!p._groupViewed){beginPersonBrowse(p);p._groupViewed=true;p.lookT=Infinity;}
      if(g.time>=g.lookFor){
        if(g.members.some(p=>p._groupViewed&&p.t>=g.lookFor&&tryCustomerOffer(p,g.focus)))continue;
        g.visits--;planFamily(g);
      }
    }else if((g.stage==='walk'||g.stage==='leave')&&g.time>35&&g.firstArrivedAt==null){g.replan=true;}
  }
}

/* ---- สมาชิกครอบครัวเดินไปที่ยืนของตัวเองไม่ได้ = ขยับที่ยืนที่ตู้เดิม ----
   ⚠️ 2026-09-17 เดิมจุดยืนที่จองตอน planFamily ค้างไว้จนกว่าจะหมด 35 วิ (หรือดูจบรอบ) ทั้งที่มีคนยืนขวาง/ไม่มีทางเดิน
      คนที่ติดยืนนิ่ง และจุดนั้นก็ยังถูกนับว่า "มีคนจอง" คนอื่นใช้ไม่ได้ (ผู้เล่นทัก)
   ลำดับแก้: 1) ย้ายเฉพาะคนที่ติดไปจุดว่างอื่นของตู้เดียวกันที่เดินไปถึงได้จริง
             2) ไม่พอ → ทั้งครอบครัวเลือกชุดจุดยืนใหม่ที่ตู้เดียวกัน (คนที่ใกล้จุดไหนได้จุดนั้น ไม่เดินสลับกันไขว้)
   จุดเก่าถูกปล่อยทันทีเพราะ tgt ถูกเปลี่ยน · ลองได้ทุก 2.5 วิต่อครอบครัว กันสลับที่ไปมาทุกเฟรม */
const FAMILY_STUCK_S=2.5;
/* "เดินไม่ได้" = ระยะถึงจุดยืนไม่ลดลงเกินครึ่งช่องมา FAMILY_STUCK_S วิ (ไม่พึ่ง _blockedFor ที่วัดแค่เฟรมที่ขยับไม่ได้เลย
   คนที่โดนดันไปมา/เดินซอยเท้าอยู่กับที่ ก็นับว่าติด) · รอคิวแถวเดียว (_columnHold) หรือกำลังเดินไปรวมกลุ่ม ไม่นับ */
function familyProgress(p,atDestination){
  const goal=p._familyGoal||p.tgt;
  if(!goal||atDestination(p)||p._columnHold||p._regroup){p._progAt=_peopleT;p._progD=null;return;}
  const d=Math.hypot(p.x-goal.x,p.y-goal.y);
  if(p._progD==null||p._progGoal!==goal||d<p._progD-.5){p._progD=d;p._progAt=_peopleT;p._progGoal=goal;}
}
function refitFamilyAtTank(g,atDestination){
  for(const p of g.members)familyProgress(p,atDestination);
  if(!g.focus||g.focus.type!=='tank'||_peopleT<(g._refitAt||0))return false;
  const stuck=g.members.filter(p=>personEntered(p)&&!atDestination(p)&&!p._columnFollower&&!p._regroup&&!p.tradeOffer&&
    (_peopleT-(p._progAt??_peopleT)>FAMILY_STUCK_S||(p.state==='wait'&&!(p.route&&p.route.length))));
  if(!stuck.length)return false;
  g._refitAt=_peopleT+2.5;
  const spots=accessibleTankSpots(g.focus);
  const taken=s=>personBlocked(s.x,s.y)||inDoorWalkway(s.x,s.y)||
    PEOPLE.some(q=>q.family!==g&&(Math.hypot(q.x-s.x,q.y-s.y)<PERSON_GAP||q.tgt&&Math.hypot(q.tgt.x-s.x,q.tgt.y-s.y)<PERSON_GAP));
  const go=(p,s,route)=>{p._progAt=_peopleT;p._progD=null;p._familyGoal=s;p.tgt=s;p.route=route;p.routeGoal=s;p.state='walk';p.stuck=0;p._blockedFor=0;p._routeRetryAt=0;p._pathRetryAt=0;p.t=0;p.lookT=Infinity;p._groupViewed=false;};
  // 1) ย้ายเฉพาะคนที่ติด
  const used=g.members.filter(p=>!stuck.includes(p)).map(p=>p._familyGoal||p.tgt).filter(Boolean),moves=[];
  for(const p of stuck){
    const old=p._familyGoal||p.tgt;
    const list=spots.filter(s=>!taken(s)&&!used.some(u=>Math.hypot(u.x-s.x,u.y-s.y)<PERSON_GAP+.3)&&!(old&&Math.hypot(old.x-s.x,old.y-s.y)<PERSON_GAP))
      .sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
    let pick=null;for(const s of list){const route=personRoute(p,s);if(route.length){pick={p,s,route};break;}}
    if(!pick)break;moves.push(pick);used.push(pick.s);
  }
  if(moves.length===stuck.length){for(const m of moves)go(m.p,m.s,m.route);return true;}
  // 2) ทั้งครอบครัวขยับไปชุดจุดยืนใหม่ที่ตู้เดียวกัน
  const cx=g.members.reduce((n,p)=>n+p.x,0)/g.members.length,cy=g.members.reduce((n,p)=>n+p.y,0)/g.members.length;
  const free=spots.filter(s=>!taken(s)&&!stuck.some(p=>{const old=p._familyGoal||p.tgt;return old&&Math.hypot(old.x-s.x,old.y-s.y)<PERSON_GAP;}))
    .sort((a,b)=>Math.hypot(a.x-cx,a.y-cy)-Math.hypot(b.x-cx,b.y-cy));
  const chosen=[];for(const s of free){if(chosen.some(q=>Math.hypot(q.x-s.x,q.y-s.y)<PERSON_GAP+.3))continue;chosen.push(s);if(chosen.length===g.members.length)break;}
  if(chosen.length<g.members.length)return false;                     // ตู้นี้ไม่มีที่พอทั้งกลุ่ม = ปล่อยให้กติกาเดิม (หมดเวลาแล้ววางแผนตู้อื่น) ทำงาน
  const plan=[],left=chosen.slice();
  for(const p of g.members.slice().sort((a,b)=>stuck.includes(a)-stuck.includes(b))){   // คนที่ไม่ติดเลือกจุดก่อน = ขยับน้อยที่สุด
    left.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
    let k=left.findIndex(s=>personRoute(p,s).length||Math.hypot(s.x-p.x,s.y-p.y)<1.2);
    if(k<0)return false;
    const s=left.splice(k,1)[0];plan.push({p,s,route:personRoute(p,s)});
  }
  for(const m of plan){if(Math.hypot(m.s.x-m.p.x,m.s.y-m.p.y)<1.2){m.p._familyGoal=m.s;m.p.tgt=m.s;m.p.route=[];m.p.state='wait';m.p._blockedFor=0;}else go(m.p,m.s,m.route);}
  if(g.stage==='look'){g.stage='walk';g.firstArrivedAt=null;}           // ย้ายที่ยืนระหว่างดู = รวมตัวใหม่แล้วค่อยเริ่มดูพร้อมกัน
  return true;
}
function familyPurchaseChance(members){
  const children=members.filter(p=>p.kid);
  if(!children.length)return null;
  const women=members.filter(p=>!p.kid&&p.gender==='female').length;
  const men=members.filter(p=>!p.kid&&p.gender==='male').length;
  const base=children.some(p=>p.gender==='female')?.5:.3;
  const earlyFactor=buyChance()/BUY_CHANCE;   // ช่วงแรก ~7.5 เท่า แล้วลงมา 1 เท่า
  return Math.min(1,(base*Math.pow(.5,women)+men*.1)*BUY_FAMILY_SCALE*earlyFactor);
}
function assignFamilyBuyer(members){
  const chance=familyPurchaseChance(members);if(chance===null)return;
  for(const p of members)p.wantsBuy=false;
  const adults=members.filter(p=>!p.kid);
  if(adults.length&&Math.random()<chance)adults[Math.floor(Math.random()*adults.length)].wantsBuy=true;
}

function makePerson(options={}){
  const kid = options.kid ?? false;
  const gender = options.gender || (Math.random()<0.5?'female':'male');
  const hairCut = options.hairCut || (gender==='female'
    ? pick1(['crop','short','sidepart','quiff','curly','bob','bob','long','ponytail','bun','twintails'])
    : pick1(['crop','crop','short','sidepart','quiff','curly','bob','long','ponytail','bun','twintails']));
  const outfit = gender==='female' ? pick1(['trousers','trousers','skirt','dress']) : kid ? pick1(['shorts','trousers']) : 'trousers';
  const d = options.at || doorSpot();
  if(!d || spotTaken(d.x,d.y,null)) return null;
  return {
    x: d.x, y: d.y,
    hCm: kid ? 98 + Math.random()*30 : (gender==='female'?151:160) + Math.random()*19,
    kid, gender, hairCut, outfit, family:null,
    wantsBuy: !kid && Math.random()<SOLO_BUY_CHANCE,   // เดี่ยว/คู่: 20% คงที่ · ครอบครัว(มีเด็ก) ถูก assignFamilyBuyer() เขียนทับด้วยสูตรเดิม
    spd: (PERSON_SPEED_CM * (kid ? 1.15 : 0.9 + Math.random()*0.35)) / CM_PER_CELL,
    phase: Math.random()*6.283,
    idle: Math.random()*6.283,
    fdx: -1, fdy: -1,                    // ทิศที่หันหน้า (พิกัดพื้น)
    state: 'walk', t: 0, stuck: 0, lookT: 0,
    tgt: null, focus: null,
    visits: visitorVisits(),
    strolls: 0,
    skin: pick1(P_SKIN), hair: pick1(kid?P_HAIR.filter(c=>c!=='#8a8f94'):P_HAIR), shirt: pick1(P_SHIRT), pants: pick1(P_PANTS),
    shoe: Math.random()<0.5 ? '#23262b' : '#3a2f28',
    lean: (Math.random()<0.5?-1:1) * (0.03 + Math.random()*0.05),
    build: (kid?1.00:gender==='female'?0.86:0.94) + Math.random()*0.16,   // เด็กอวบกว่าเมื่อเทียบส่วนสูง ไม่ใช่ผอมกว่า
    hairStyle: (Math.random()*3)|0,
    accessory: kid ? pick1(['none','backpack','backpack']) : 'none',
    motion: 0, route: [], routeGoal: null,
    action: 'watch', actionT:0, actionDuration:0, headYaw:0, socialCooldown:1+Math.random()*4,
    bagged: !kid && Math.random() < 0.35,
    modelHair: gender==='female' ? pick1(['PonyTail','ShortHair_1','ShortHair_1']) : 'Hair',
    facial: (gender==='male'&&!kid) ? pick1(['none','none','none','Moustache','Beard','BeardFull']) : 'none',
    /* ร่าง = ไฟล์โมเดลที่ใช้ (ดูหัวไฟล์ people-model.js) — สุ่มเพื่อให้ฝูงลูกค้าไม่ใช่คนหน้าเดียวกันทั้งร้าน
       *2 = ชุด T-pose เมชชิ้นเดียว ผมติดหัว เสื้อผ้าคนละแบบ ไม่มีทรงผม/เคราสลับ */
    body: gender==='female' ? pick1(['female','female2']) : pick1(['male','male2']),
  };
}

/* เป้าหมายถัดไป: ตู้ → เดินเล่น → ตู้ → ... → ดูครบแล้วเดินออก */
function crowdClear(a,b,self){
  if(!personClear(a,b))return false;
  if(self&&self._angryUntil>_peopleT)return true;
  const dx=b.x-a.x,dy=b.y-a.y,ll=dx*dx+dy*dy;
  for(const q of peopleInArea(Math.min(a.x,b.x)-7,Math.min(a.y,b.y)-7,Math.max(a.x,b.x)+7,Math.max(a.y,b.y)+7)){
    if(q===self)continue;
    const start=Math.hypot(q.x-a.x,q.y-a.y);
    const t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(ll||1)));
    const distance=Math.hypot(q.x-a.x-dx*t,q.y-a.y-dy*t);
    // Allow someone already too close to step outward, never further inward.
    const sameGroup=self?.family&&self.family===q.family;
    const gap=sameGroup?5:(self?._squeezeUntil>_peopleT?2.5:3.05)+(q._squeezeUntil>_peopleT?2.5:3.05);
    if(distance<gap && !(start<gap+.1&&Math.hypot(q.x-b.x,q.y-b.y)>start+.01&&t<.01))return false;
  }
  return true;
}
let crowdRouteBudget=2;
function crowdRoute(p,target){
  if(crowdRouteBudget<=0)return [];crowdRouteBudget--;
  const nodes=[p,target,...floorRouteNodes()],r=PERSON_R+.9;
  for(const o of G.objs){if(o===moving)continue;for(const x of [o.cx-r,o.cx+oW(o)+r])for(const y of [o.cy-r,o.cy+oH(o)+r])if(!personBlocked(x,y))nodes.push({x,y});}
  const closePeople=PEOPLE.filter(q=>q!==p&&Math.hypot(q.x-p.x,q.y-p.y)<36).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)).slice(0,8);
  for(const q of closePeople){for(let i=0;i<12;i++){const a=i*Math.PI/6,s={x:q.x+Math.cos(a)*8,y:q.y+Math.sin(a)*8};if(!personBlocked(s.x,s.y))nodes.push(s);}}
  const dist=nodes.map(()=>Infinity),prev=[],done=new Set();dist[0]=0;
  for(let k=0;k<nodes.length;k++){
    let u=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(u<0||dist[i]<dist[u]))u=i;
    if(u<0||!isFinite(dist[u]))return [];
    if(u===1){if(p._regroup&&dist[u]>Math.hypot(p.x-p._regroup.leader.x,p.y-p._regroup.leader.y)*1.6+8)return [];const path=[];for(let v=1;v!==0;v=prev[v])path.unshift(nodes[v]);return path;}
    done.add(u);
    for(let v=0;v<nodes.length;v++)if(!done.has(v)){const d=dist[u]+Math.hypot(nodes[u].x-nodes[v].x,nodes[u].y-nodes[v].y);if(d<dist[v]&&crowdClear(nodes[u],nodes[v],p)){dist[v]=d;prev[v]=u;}}
  }
  return [];
}

function nextGoal(p){
  if(p.raceChallenger&&window.SlugRace&&SlugRace.goal(p))return;
  if(p.tugChallenger&&window.SlugTug&&SlugTug.goal(p))return;
  if(p.eatChallenger&&window.SlugEat&&SlugEat.goal(p))return;
  if(p.throwChallenger&&window.SlugThrow&&SlugThrow.goal(p))return;
  if(p.sumoChallenger&&window.SlugSumo&&SlugSumo.goal(p))return;
  if(p._columnFollower)return;
  if(p._yieldResume)return;
  if(p.tradeOffer)return;
  /* พ่อค้าเร่: เดินตรงไปเคาน์เตอร์เพื่อยื่นขาย ถ้ายังไปไม่ได้ (เคาน์เตอร์ไม่ว่าง/ทางตัน) ค่อยเดินเล่นรอ */
  if(p.wantsSell&&!p.tradeDone&&typeof trySellerOffer==='function'&&trySellerOffer(p))return;
  if(p.family){if(p.family.firstArrivedAt!=null||p.family.stage==='look'){p.route=[];p._routeRetryAt=_peopleT+.5;p.stuck=0;return;}p.family.replan=true;return;}
  if(p.strolls > 0){                                   // เดินเล่นคั่นก่อน
    p.strolls--; p.focus = null; p.tgt = strollSpot(p); p.state = 'walk'; p.stuck = 0; return;
  }
  const tanks = G.objs.filter(o => o.type === 'tank' && o !== moving && !eventReservedTank(o));
  if(p.visits > 0 && tanks.length){
    for(let i = 0; i < 6; i++){
      const o = tanks[(Math.random()*tanks.length)|0];
      if(o === p.focus && tanks.length > 1) continue;
      const s = freeSpot(lookSpots(o), p);
      if(s){ p.focus = o; p.tgt = s; p.state = 'walk'; p.stuck = 0; return; }
    }
    p.focus = null; p.tgt = strollSpot(p); p.state = 'walk'; p.stuck = 0; return;   // ตู้มีคนยืนเต็ม เดินเล่นรอ
  }
  p.focus = null; p.tgt = doorSpot(p,'out'); p.state = 'leave'; p.stuck = 0;
}

/* ============================================================
   อัปเดตทุกเฟรม
   ============================================================ */
let _pLast = 0;
let _peopleTimeDebt = 0;
/* ---- เพดานงานค้างของฝั่งลูกค้า ----
   ⚠️ 2026-09-20 ผู้เล่น: "กดไปดูแท็บอื่นนาน ๆ กลับมาทุกอย่างติดสปีดหนักมาก"
   ต้นเหตุ: แท็บถูกซ่อน = เบราว์เซอร์หยุดเรียก requestAnimationFrame ทั้งหมด
   _pLast ค้างอยู่ที่เวลาเก่า พอกลับมา elapsed ก้อนเดียวเป็นหลักร้อย/หลักพันวินาที
   แล้วลูปนี้ไล่ใช้หนี้รอบละ 20 สไลซ์ × 0.05 = เดินเวลาเกม 1 วินาทีต่อ 1 เฟรม
     หาย 10 นาที → หนี้ 600 วิ → ทุกคนวิ่ง 60 เท่านาน ~10 วินาทีจริง
     หาย 1 ชั่วโมง → ~60 วินาที
   แถมยังโดนคูณอีก เพราะ stepPeople() ถูกเรียกได้หลายจุดในเฟรมเดียว
   (shop-floor.js 2 จุด + slug-race.js) แต่ละจุดไล่ใช้หนี้ของตัวเองครบ 20 สไลซ์

   นโยบายที่เลือก (ตาม AGENTS.md หมวด 6 ที่ให้ "ระบุว่าจะเก็บ backlog อย่างไร"):
     ซ่อนแท็บอยู่ = ชีวิตลูกค้าหยุดไปด้วย ไม่เก็บหนี้ ไม่ไล่ชดเชย
   เหตุผล: ของในลูปนี้เป็นภาพล้วน ๆ (เดิน · ยืนดูตู้ · คิวหน้าเคาน์เตอร์)
   ไม่มีค่าที่ต้องรักษาข้ามเวลา และ "เร่ง 60 เท่า" ก็ให้ผลปลายทางเท่ากับข้ามไปเลย
   แต่ดูพังกว่ามาก · ทำแบบเดียวกับลูปอื่นทั้งเกมที่ clamp dt แล้วทิ้งส่วนเกินอยู่แล้ว
   (ทากในตู้ shop-floor.js:345 · tank-view.js:1730 · บานประตู entrance.js)
   ความอิ่มก็เดินด้วย dt จากลูปตู้ จึงหยุดพร้อมกัน สอดคล้องกันทั้งเกม
   ⚠️ ระบบที่ "ต้องเดินต่อแม้ปิดเกม" ไม่ได้อยู่ในลูปนี้เลย — เพาะพันธุ์ · พ่อค้าเร่/พ่อค้าส่ง ·
      ออเดอร์ออนไลน์ · จดหมายทัวร์นาเมนต์ ใช้ Date.now() ของตัวเอง ตามทันเองอยู่แล้ว
   เพดานนี้ยังกันเครื่องหลับ/เฟรมกระตุกยาวให้ด้วย ไม่ได้กันแค่เคสซ่อนแท็บ */
const PEOPLE_DEBT_MAX=0.5;
function stepPeople(){
  const now = performance.now();
  if(!_pLast)_peopleTimeDebt=0;
  const elapsed=Math.max(0,(now-(_pLast||now))/1000);_pLast=now;
  if(!peopleOn){_peopleTimeDebt=0;return;}
  _peopleTimeDebt=Math.min(_peopleTimeDebt+elapsed,PEOPLE_DEBT_MAX);
  // Keep elapsed time, but bound each movement step and catch-up work per call.
  // A normal 100 ms background tick takes two 50 ms steps, not one truncated step.
  for(let steps=0;steps<20&&_peopleTimeDebt>1e-8;steps++){
    const dt=Math.min(.05,_peopleTimeDebt);_peopleTimeDebt-=dt;stepPeopleSlice(dt);
  }
}
/* กลับมาที่แท็บ = เริ่มนับเวลาใหม่จากศูนย์ ไม่ใช่นับต่อจากตอนก่อนสลับออกไป
   (เพดานด้านบนก็เอาอยู่ แต่ตัดตั้งแต่ต้นทางชัดกว่า และกันเฟรมแรกสะดุด) */
if(typeof document!=='undefined')
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){_pLast=0;_peopleTimeDebt=0;}});
function stepPeopleSlice(dt){
  _peopleT += dt;

  crowdRouteBudget=2;
  stepTradeOffers(dt);
  stepVisitorArrivals();
  stepFamilyColumns(dt);
  stepGroupRegroup();
  stepFamilies(dt);
  clearDoorWaiters();
  stepVisitorYielding();
  if(PEOPLE.length>12)rebuildPersonGrid();else personGrid=null;

  for(let i = PEOPLE.length - 1; i >= 0; i--){
    const p = PEOPLE[i];
    p._stepX=p.x;p._stepY=p.y;
    if(!personEntered(p)) continue;                  // ยังไม่ถึงคิวเข้าประตู (DOOR_GAP)
    /* ค่าเข้าร้าน คนละ ENTRY_FEE ทอง จ่ายตอนเดินพ้นประตูเข้ามาจริง (ผู้เล่นกำหนด 2026-09-21)
       ธง _paidEntry กันจ่ายซ้ำ · คนหนึ่งคนจ่ายครั้งเดียวต่อการเข้าร้านหนึ่งรอบ
       นับเฉพาะ "ลูกค้า" — ผู้ท้าแข่งกับพ่อค้ามาทำธุระ ไม่ใช่คนมาเที่ยวร้าน จึงไม่เก็บ
       (รายได้ก้อนนี้เข้าสถิติเองอยู่แล้ว เพราะ econ-stats.js อ่านส่วนต่างของ G.coin)
       ⚠️ 2026-09-22 ผู้เล่น: "ตอนปิดเกมไม่เพิ่มนะ เป็นสิทธิเฉพาะคนที่เปิดเกมค้าไว้ ไม่งั้นโกงเกินไป"
                        แล้วตามด้วย "เปิดอยู่ได้ เปลี่ยนแท็บในคอมนับ แต่ในโทรศัพท์ไม่นับ"
       ลูกค้ายังเดินเข้าออกตามปกติทุกกรณี (กฎหมวด 6: ชีวิตในร้านห้ามหยุดเพราะไม่ได้มอง)
       ต่างกันแค่ "ใครได้ค่าเข้า":
         คอม  — เปิดเกมค้าไว้แล้วสลับแท็บ ยังนับ (ถือว่าเปิดร้านทิ้งไว้จริง)
         มือถือ — สลับแอป/ดับจอ ไม่นับ (ไม่งั้นเปิดทิ้งไว้เฉย ๆ ก็ได้เงิน = โกงเกินไป)
       ปิดเกมไปเลยไม่มีทางได้อยู่แล้ว เพราะไม่มีอะไรรัน และไม่มีการคำนวณย้อนหลังตอนเปิดใหม่
       คนที่เดินเข้ามาช่วงไม่นับ = ติดธงไว้เลยว่าเข้าฟรี ไม่เก็บย้อนหลังตอนกลับมาดู */
    if(!p._paidEntry&&isCustomer(p)){
      p._paidEntry=true;
      if(entryFeeCounts()){
        addCoin(ENTRY_FEE);
        /* ตัวเลขเด้ง "เหนือหัวคนที่เพิ่งเข้ามา" ไม่ใช่ที่พื้นตรงเท้า (ผู้เล่นขอ 2026-09-22)
           z = ความสูงของคนคนนั้นจริง ๆ (hCm) บวกอีกนิดให้ลอยพ้นหัว */
        /* ความสูงเดียวกับ "ขอบบนของกรอบคน" ใน personScreenBounds — ตัวเลขจึงลอยพ้นหัวพอดีทุกส่วนสูง
           (ใช้ ZUNIT เฉย ๆ ไม่พอ วัดแล้วได้แค่ ~84% ของความสูงจริงบนจอ ตัวเลขไปทับหัว) */
        if(typeof CostPop!=='undefined')CostPop.at(p.x,p.y,ENTRY_FEE,p.hCm/CM_PER_CELL*(ZUNIT+TH*.55));
      }
    }
    p.t += dt; p.idle += dt;
    stepPersonLife(p,dt);
    p.motion *= Math.exp(-dt*12);
    if(!p.tgt) nextGoal(p);
    if(!p.tgt) continue;
    if(personBlocked(p.x, p.y)){                                     // ติดอยู่ในของ → ดันออกก่อน
      /* ⚠️ ตัวนับนี้ต้องแยกจาก _idleWalk ด้านล่าง เพราะอันนั้นนับ "ระยะที่ขยับได้"
         คนที่เด้งไปมาอยู่กับที่ถือว่าขยับได้ ตัวนับนั้นจึงถูกรีเซ็ตทุกเฟรม ไม่มีวันครบ
         และ _idleWalk ข้ามสมาชิกครอบครัวทั้งหมด ซึ่งเป็นเคสที่ค้างถาวรจริง ๆ
         ดันออกไม่สำเร็จครบ UNSTICK_S วิ = วาร์ปไปจุดว่างใกล้สุด (ระยะสั้น ผู้เล่นเห็นเป็นก้าวหลบ)
         ทั้งร้านไม่มีที่ยืนเลย = เอาออกจากร้าน ดีกว่าปล่อยค้างถาวร
         ข้อเสนอที่ค้างอยู่ไม่ต้องเก็บกวาดเอง — stepTradeOffers ปิดให้เมื่อคนหลุดจาก PEOPLE */
      p._stuckIn=(p._stuckIn||0)+dt;
      if(p._stuckIn>UNSTICK_S){
        p._stuckIn=0;
        const free=nearestFreeSpot(p);
        if(free){ p.x=free.x;p.y=free.y;p.route=[];p.routeGoal=null;p._pathRetryAt=0;p.stuck=0;p._idleWalk=0; }
        else{
          if(p.family){p.family.members=p.family.members.filter(q=>q!==p);p.family=null;}
          PEOPLE.splice(i,1);continue;
        }
      }
      escapeBlocked(p, dt); continue;
    }
    p._stuckIn=0;

    if(p.state==='wait') continue;
    if(p.state === 'look'){
      if(p.focus && G.objs.indexOf(p.focus) < 0){ nextGoal(p); continue; }   // ตู้ถูกย้ายหาย
      /* ผู้ท้าแข่งมาถึงตู้ระหว่างที่ลูกค้ายืนดูอยู่ = ลูกค้าปกติเดินไปดูตู้อื่นแทน (ครอบครัวรอจบรอบดูของกลุ่มแล้วเลือกตู้ใหม่เอง) */
      if(p.focus && !p.tugChallenger && !p.raceChallenger && !p.eatChallenger && !p.throwChallenger && !p.sumoChallenger && !p.family && eventReservedTank(p.focus)){ nextGoal(p); continue; }
      if(p.focus){                                   // หันหน้าเข้าหากลางตู้
        p.fdx = (p.focus.cx + oW(p.focus)/2) - p.x;
        p.fdy = (p.focus.cy + oH(p.focus)/2) - p.y;
        const facingLength=Math.hypot(p.fdx,p.fdy)||1;p.fdx/=facingLength;p.fdy/=facingLength;
      }
      if(p.t >= p.lookT){
        if(tryCustomerOffer(p,p.focus))continue;
        p.visits--;
        p.strolls = STROLL_MIN + ((Math.random()*(STROLL_MAX-STROLL_MIN+1))|0);
        nextGoal(p); p.t = 0;
      }
      continue;
    }

    if(p._columnHold||p._yieldWaitUntil>_peopleT||p._routeRetryAt>_peopleT)continue;
    /* ---- เดิน ---- */
    const dx = p.tgt.x - p.x, dy = p.tgt.y - p.y;
    const d  = Math.hypot(dx, dy);
    if(d < 0.7){
      if(p._columnFollower)continue;
      if(p._regroup){stopRegroup(p);continue;}
      if(p._yieldResume){const resume=p._yieldResume;p._yieldResume=null;p.state=resume.state;p.lookT=resume.remaining;p.t=0;continue;}
      if(p.tradeOffer){p.state='wait';p.tradeOffer.arrived=true;const c=p.tradeOffer.counter;p.fdx=c.cx+oW(c)/2-p.x;p.fdy=c.cy+oH(c)/2-p.y;renderTradeOffers();continue;}
      if(p.family){p.state='wait';p.t=0;p.lookT=Infinity;continue;}
      if(p.state === 'leave'){ PEOPLE.splice(i,1); continue; }               // ออกจากร้าน
      if(!p.focus){ nextGoal(p); continue; }                                 // ถึงจุดเดินเล่น ไปต่อ
      beginPersonBrowse(p);
      continue;
    }
    if(p.routeGoal !== p.tgt || !p.route.length || !personClear(p,p.route[0])){
      if(p.routeGoal===p.tgt&&_peopleT<(p._pathRetryAt||0))continue;
      p.route=personRoute(p,p.tgt); p.routeGoal=p.tgt;
      p._pathRetryAt=p.route.length?0:_peopleT+1;
    }
    if(!p.route.length){ p.stuck+=dt; if(p.stuck>0.8) nextGoal(p); continue; }
    while(p.route.length>1 && Math.hypot(p.route[0].x-p.x,p.route[0].y-p.y)<0.8) p.route.shift();
    p.crowdCooldown=Math.max(0,(p.crowdCooldown||0)-dt);
    const waypoint=p.route[0], wx=waypoint.x-p.x, wy=waypoint.y-p.y, wd=Math.hypot(wx,wy);
    const ux=wx/(wd||1), uy=wy/(wd||1);
    let pace=Math.min(1,d/3+0.15);
    let wantedBoost=p._regroup?Math.min(2.1,1.3+Math.hypot(p.x-p._regroup.leader.x,p.y-p._regroup.leader.y)/40):1;
    p.catchupBoost=(p.catchupBoost||1)+(wantedBoost-(p.catchupBoost||1))*(1-Math.exp(-dt*6));
    pace*=p._angryUntil>_peopleT?Math.max(1.9,p.catchupBoost):p.catchupBoost;
    const step=Math.min(wd,p.spd*dt*pace);
    let nx=p.x+ux*step, ny=p.y+uy*step;
    if(!crowdClear(p,{x:nx,y:ny},p)){nx=p.x;ny=p.y;}
    if(Math.hypot(nx-p.x,ny-p.y)<0.01){
      p.stuck+=dt;
      if(p.stuck>8&&!p.family){nextGoal(p);p.stuck=0;}
      // Families retain their shared destination; their itinerary timer decides
      // when to move on, rather than each blocked member repeatedly changing it.
    } else p.stuck=0;

    const mvx = nx - p.x, mvy = ny - p.y, mv = Math.hypot(mvx, mvy);
    if(mv > 1e-4){ const turn=1-Math.exp(-dt*9); p.fdx+=(mvx/mv-p.fdx)*turn; p.fdy+=(mvy/mv-p.fdy)*turn; p.motion=Math.min(1,mv/(p.spd*dt||1)); }
    p.x = nx; p.y = ny;
    // Gait is finalized from actual displacement below.                            // จังหวะก้าวตามระยะที่เดินจริง
  }
  for(let i=PEOPLE.length-1;i>=0;i--){
    const p=PEOPLE[i];
    const distance=Math.hypot(p.x-(p._stepX??p.x),p.y-(p._stepY??p.y));
    updateBlockedVisitor(p,dt,distance);
    /* ---- ตัวเฝ้าระวัง "ยืนแข็ง" ของลูกค้าเดี่ยว ----
       เคสที่เจอ: เป้าหมายที่สุ่มได้ตกอยู่บนช่องที่ไม่ใช่พื้นร้าน (ร้านเป็นรูปตัว L ไม่ใช่สี่เหลี่ยมเต็ม)
       personRoute() คืนเส้นทางว่างทุกครั้ง → stuck ครบ 0.8 → nextGoal() → รีเซ็ต stuck → วนแบบนี้ตลอดกาล
       ตัวนับนี้จึงต้องแยกจาก p.stuck เพราะ nextGoal() ล้าง p.stuck ทุกรอบ
       ไล่ระดับ: ขยับไม่ได้ 10 วิ -> สั่งให้เดินออกจากร้าน · 20 วิ -> เอาออกจากร้านเลย ดีกว่ายืนค้าง
       ยกเว้นคนที่ "ตั้งใจยืน" อยู่แล้ว: กำลังดูตู้ · รอครอบครัว · รอผู้เล่นตอบข้อเสนอที่เคาน์เตอร์ */
    const walking=(p.state==='walk'||p.state==='leave')&&!p.family&&!p.tradeOffer&&!p._columnFollower;
    if(!walking||distance>1e-5)p._idleWalk=0;
    else{
      p._idleWalk=(p._idleWalk||0)+dt;
      if(p._idleWalk>20){PEOPLE.splice(i,1);continue;}
      if(p._idleWalk>10&&p.state!=='leave'){
        p.state='leave';p.focus=null;p.tgt=doorSpot(p,'out');p.route=[];p.routeGoal=null;p._pathRetryAt=0;p.stuck=0;
      }
    }
    if(distance>1e-5){
      // Walking slowly changes cadence, not leg size. Previously slow movement
      // shrank the stride/lift almost to zero while the body kept translating.
      /* หนึ่งรอบ (2π) = ก้าวสองก้าว · ก้าวหนึ่งยาว WALK_STEP เท่าของส่วนสูง
         เดิมใช้ค่าคงที่ .72 = ก้าวละ ~22 ซม. ซึ่งสั้นถี่เหมือนซอยเท้า */
      p.phase+=distance*Math.PI/Math.max(1e-3,WALK_STEP*(p.hCm/CM_PER_CELL));p.motion=1;
    }
  }
  personGrid=null;
  // Normal traffic never teleports or passively pushes standing visitors.
}

/* ลำดับความลึกของคนเทียบกับของบนพื้น
   ในไอโซเมตริก คน "อยู่หน้า" กล่องก็ต่อเมื่อเลยขอบขวา (x) หรือขอบหน้า (y) ของกล่องไปแล้ว
   คีย์ของกล่องต้องใช้สูตรเดียวกับที่ shop-floor.js เรียงของ (cx+cy+def.w+def.h) */
function personDepth(p){return p.x+p.y;}

/* Human geometry is projected through the same camera as the furniture.
   Coordinates below are fractions of height: lateral, forward, vertical. */
// A depth buffer resolves intersecting clothing, straps, hair and limbs per pixel.
let _personGL=null;
// Opaque furniture writes depth only, allowing a person to be partially hidden.
/* ---- แคชรูปทรงคงที่ของเฟอร์นิเจอร์/กระจกตู้ ----
   ⚠️ 2026-09-19 (คู่มือ Two Point Campus บท 05 + 10: "แพน/ซูมต้องไม่ rebuild geometry คงที่")
   เดิมทุกเฟรมที่วาดคน จะสร้างอาร์เรย์หน้าตัดใหม่ทั้งร้าน — ตู้/ของละ 5 หน้า × 4 จุด และกระจกตู้อีก 3 บาน
   ร้าน 20 ชิ้น = สร้างอาร์เรย์ใหม่ราว 500 ก้อนต่อเฟรม ทั้งที่รูปทรงเปลี่ยนเฉพาะตอนวาง/ย้าย/หมุน/เก็บของ
   ตอนนี้จำรูปทรงต่อชิ้นไว้ แล้วต่อเฟรมแค่หยิบชิ้นที่อยู่ในจอมาเรียง (อาร์เรย์นอกเป็นแค่ตัวชี้ ราคาถูก)
   ตรวจว่าใช้ได้จริง: PeoplePerf.geoBuilds ต้องไม่ขยับเลยระหว่างแพน/ซูม ขยับเฉพาะตอน layout เปลี่ยน */
let _geoCache=new Map(), _geoSig=null, _geoBuilds=0;
function layoutSignature(){
  let s=G.objs.length*7919;
  for(const o of G.objs)s=(s*31+(o.cx|0)*7+(o.cy|0)*13+((o.rot|0)+1)*17+(o===moving?911:0))|0;
  return s;
}
function objGeometry(o){
  let g=_geoCache.get(o);
  if(g)return g;
  g={opaque:null,glass:null};
  const x=o.cx,y=o.cy,w=oW(o),h=oH(o);
  const top=(o.type==='tank'?tankStandH(o.def):decoH(o))/ZUNIT;
  if(Number.isFinite(top)&&top>0){
    const a=[x,y,0],b=[x+w,y,0],c=[x+w,y+h,0],d=[x,y+h,0];
    const A=[x,y,top],B=[x+w,y,top],C=[x+w,y+h,top],D=[x,y+h,top];
    g.opaque=[[A,B,C,D],[a,b,B,A],[b,c,C,B],[c,d,D,C],[d,a,A,D]];
  }
  if(o.type==='tank'){
    const lo=tankStandH(o.def)/ZUNIT,hi=lo+tankGlassH(o.def)/ZUNIT;
    g.glass=[[[x,y,hi],[x+w,y,hi],[x+w,y+h,hi],[x,y+h,hi]],
             [[x+w,y,lo],[x+w,y+h,lo],[x+w,y+h,hi],[x+w,y,hi]],
             [[x,y+h,lo],[x+w,y+h,lo],[x+w,y+h,hi],[x,y+h,hi]]];
  }
  _geoCache.set(o,g);
  return g;
}
function syncGeoCache(){
  const sig=layoutSignature();
  if(sig===_geoSig)return;
  _geoSig=sig;_geoCache=new Map();_geoBuilds++;     // layout เปลี่ยน = ทิ้งทั้งชุด สร้างใหม่แบบขี้เกียจตอนถูกขอ
}
function personFurnitureFaces(cull=false){
  syncGeoCache();
  const out=[];
  for(const o of G.objs){
    if(o===moving||(cull&&!onScreen(o)))continue;
    if(o.def.playTable){out.push(...playTableDepthFaces(o).opaque);continue;}   // โต๊ะเล่นมีของบนโต๊ะเปลี่ยนตลอด ไม่แคช
    if(o.def.researchTable){out.push(...researchTableDepthFaces(o).opaque);continue;}
    const q=objGeometry(o).opaque;
    if(q)for(const v of q)out.push(v);
  }
  return out;
}
function drawPersonShadow(p){
  const b=P(p.x,p.y,0),px=p.hCm/CM_PER_CELL*ZUNIT*cam.zoom;
  ctx.save();ctx.translate(b.x,b.y);
  softShadow(ctx,px*.09,px*.04,px*.23,px*.065,.22,.45);
  softShadow(ctx,0,0,px*.095,px*.034,.40,0);ctx.restore();
}

let _personBatch=null;
const _carriedSlugs=[];   // ตู้ทากที่มีคนถืออยู่ในเฟรมนี้ (วาดตัวทากหลังเมชคนเสร็จ)

/* ⚠️ 2026-09-22 ผู้เล่น: "เกมกระตุก แถมใช้พลังประมวลผลมากเกินไป" (วัดบนเครื่องผู้เล่น: เมนเธรดเต็ม 85–96%)
   เดิมทุกเฟรม ต่อให้ไม่มีใครเปลี่ยนท่าเลย ก็ยังต้องทำงานเท่าเดิมทั้งหมด:
     1) translatePoseFaces คัดลอกจุดยอดทุกจุดของทุกคนเพื่อบวกระยะเลื่อน (คนละ ~3,000 หน้า)
     2) paintPersonMesh ไล่ตัดสามเหลี่ยมจากอาร์เรย์ซ้อนอาร์เรย์ใหม่หมด แล้ว bufferData ทั้งก้อน
   วัดได้ (ลูกค้า 2 คน): translate 1.00 ms + paint 0.50 ms ต่อเฟรม → ลูกค้า 6 คนคือ ~4.5 ms/เฟรม
   ที่แพงคือ "ทำซ้ำสิ่งที่ไม่ได้เปลี่ยน" ไม่ใช่ตัวการวาด
   ตอนนี้: ท่าถูกแปลงเป็นบล็อกสามเหลี่ยม Float32 (x,y,z,r,g,b) "ครั้งเดียวตอนสร้างท่า"
   แล้วอัปโหลดขึ้น GL buffer ของคนคนนั้นครั้งเดียว · ต่อเฟรมเหลือแค่ตั้ง uniform ระยะเลื่อน + drawArrays
   จุดยอดในบัฟเฟอร์เป็นพิกัดโลกตอนสร้างท่า การเดินจึงชดเชยด้วย off=(p.x-pose.x, p.y-pose.y) ในเชดเดอร์
   (ผลลัพธ์บนจอเท่าเดิมทุกพิกเซล — เชดเดอร์บวกค่าเดียวกับที่ translatePoseFaces เคยบวกให้ทุกจุด) */
const PERSON_STRIDE=6;                       // x,y,z,r,g,b ต่อจุดยอด
function faceTriCount(faces){let n=0;for(const f of faces)n+=(f.v||f).length-2;return n;}
/* คลี่หน้าหลายเหลี่ยม → สามเหลี่ยมเรียงต่อกันในอาร์เรย์เดียว (สูตรเดียวกับ push() เดิมเป๊ะ)
   rgb ว่าง = ใช้สีที่ส่งมา (หน้าบังของเฟอร์นิเจอร์ใช้ดำ · กระจกตู้ใช้ฟ้าจาง) */
function flattenFaces(faces,out,at,fixedR,fixedG,fixedB){
  for(const f of faces){
    const vs=f.v||f;
    let r=fixedR,g=fixedG,b=fixedB;
    if(f.rgb){r=f.rgb[0]/255;g=f.rgb[1]/255;b=f.rgb[2]/255;}
    for(let i=1;i<vs.length-1;i++){
      const a=vs[0],c=vs[i],d=vs[i+1];
      out[at++]=a[0];out[at++]=a[1];out[at++]=a[2];out[at++]=r;out[at++]=g;out[at++]=b;
      out[at++]=c[0];out[at++]=c[1];out[at++]=c[2];out[at++]=r;out[at++]=g;out[at++]=b;
      out[at++]=d[0];out[at++]=d[1];out[at++]=d[2];out[at++]=r;out[at++]=g;out[at++]=b;
    }
  }
  return at;
}
function poseVertsOf(faces){
  const tris=faceTriCount(faces),data=new Float32Array(tris*3*PERSON_STRIDE);
  flattenFaces(faces,data,0,0,0,0);
  return {verts:data,tris};
}

/* GL buffer ต่อคน — อัปโหลดเฉพาะตอนท่าเปลี่ยน (2–3 คน/เฟรม ตามโควตา) ไม่ใช่ทุกคนทุกเฟรม
   อายุทรัพยากร (กฎข้อ 9): ประทับเลขเฟรมที่ใช้ล่าสุด ใครไม่ถูกใช้เกิน POSE_BUF_TTL เฟรม = ลบบัฟเฟอร์ทิ้ง
   (คนออกจากร้าน/หลุดจอ/ปิดร้าน จะโดนเก็บกวาดเองโดยไม่ต้องไปแก้ทุกจุดที่ลบคนออกจาก PEOPLE) */
const _poseBufs=new Map(); const POSE_BUF_TTL=240; let _poseFrame=0, _poseBuilds=0, _poseWorkers=[];
function poseBufferFor(gl,p){
  let e=_poseBufs.get(p);
  if(!e){e={buf:gl.createBuffer(),cap:0,src:null};_poseBufs.set(p,e);}
  e.used=_poseFrame;
  const pose=p._drawPose;
  if(e.src!==pose.verts){                    // ท่าใหม่ = อัปโหลดใหม่ครั้งเดียว
    gl.bindBuffer(gl.ARRAY_BUFFER,e.buf);
    if(e.cap<pose.verts.length){e.cap=pose.verts.length;gl.bufferData(gl.ARRAY_BUFFER,pose.verts,gl.DYNAMIC_DRAW);}
    else gl.bufferSubData(gl.ARRAY_BUFFER,0,pose.verts);
    e.src=pose.verts;
  }
  return e;
}
function prunePoseBuffers(gl){
  for(const [p,e] of _poseBufs){
    if(_poseFrame-e.used<=POSE_BUF_TTL)continue;
    gl.deleteBuffer(e.buf);_poseBufs.delete(p);
  }
}

/* เลขรุ่นเมชคน — ขยับเฉพาะตอน "ท่าเปลี่ยน" หรือ "คนขยับ" เท่านั้น
   decor-glb.js ใช้ค่านี้ตัดสินว่าต้องเรนเดอร์ฉาก 3D ใหม่ไหม (คนยืนนิ่ง = ไม่ต้อง) */
let _peopleMeshVersion=0,_peopleMeshKey='';
function bumpPeopleMeshVersion(batch){
  let key='';
  for(const p of batch)key+=(p._drawPose?.t||0)+','+Math.round(p.x*64)+','+Math.round(p.y*64)+';';
  if(key!==_peopleMeshKey){_peopleMeshKey=key;_peopleMeshVersion++;}
  return _peopleMeshVersion;
}

function endPersonBatch(){
  const batch=_personBatch;_personBatch=null;
  if(batch&&batch.length){
    /* decor-glb ต้องรู้รูปทรงคนไว้บังโมเดล 3D — ส่งเป็นบล็อกสามเหลี่ยม + ระยะเลื่อน ไม่ต้องคัดลอกจุดยอดใหม่ */
    window.DecorGLB?.queuePeople(
      batch.map(p=>({verts:p._drawPose.verts,tris:p._drawPose.tris,dx:p.x-p._drawPose.x,dy:p.y-p._drawPose.y})),
      bumpPeopleMeshVersion(batch));
    drawPersonBatchGL(batch);
  }
  drawCarriedSlugs();
  drawVisitorAnger();
}

/* ทากในตู้ที่คนถือ (พ่อค้าเร่ · คนมาท้าแข่ง/ชักเย่อ) — วาดหลังเมชคน เพราะเมชคนเป็นสีทึบล้วน
   วาดโมเดลทากลงไปในเมชตรง ๆ ไม่ได้ จึงวาดทับลงแคนวาสทีหลัง แล้วตัดขอบให้อยู่ในช่องเปิดหน้าตู้
   ⚠️ ใช้สไปรต์ของทาก "ตัวนั้นจริง ๆ" (slugSprite — อาร์ตชุดเดียวกับโหมด 2D) ไม่ใช่ Slug3D.draw
      Slug3D.draw เป็นระบบ atlas: เฟรมแรกแค่ "จองคิว" แล้วคืน true ทั้งที่ยังไม่มีภาพ
      ของชิ้นนี้เล็ก (~50 px) และติดไปกับคนที่เดินตลอด ลองแล้วมันไม่เคยวอร์มอัปจนวาดได้จริง ตู้เลยว่างเปล่า
      สไปรต์ถูกแคชไว้ในตัวทากอยู่แล้ว (s._sprite) ค่าใช้จ่ายต่อเฟรมคือ drawImage ครั้งเดียว
   ช่องเปิดหันหนีกล้อง (คนหันหลังให้เรา) = สี่เหลี่ยมบนจอวนกลับทิศ ข้ามไปเลย ไม่งั้นทากจะโผล่ทับหลังคน
   ซูมออกจนช่องเปิดแคบกว่า 6 px ก็ไม่ต้องวาด มองไม่เห็นอยู่ดี */
function drawCarriedSlugs(){
  for(const {p,quad:world,cm} of _carriedSlugs){
    const slug=p.carrySlug;if(!slug)continue;
    const quad=world.map(v=>P(v[0],v[1],v[2]*ZUNIT));   // ฉายด้วยกล้องของเฟรมนี้ (ท่าทางคนอาจมาจากแคชเฟรมก่อน)
    let area=0;for(let i=0;i<4;i++){const a=quad[i],b=quad[(i+1)%4];area+=a.x*b.y-b.x*a.y;}
    if(area<=0)continue;
    const width=Math.hypot(quad[1].x-quad[0].x,quad[1].y-quad[0].y);
    if(width<6)continue;
    const sprite=typeof slugSprite==="function"?slugSprite(slug):null;
    const parts=typeof slugPartsOf==="function"?slugPartsOf(slug):null;
    if(!sprite||!parts||!(parts.bw*parts.s>0))continue;
    /* ขนาดตามตัวจริงของทากตัวนั้น เทียบกับความกว้างตู้ (ตู้ที่ถือกว้าง ~30 ซม.)
       ตัวหารต้องเป็นความกว้างลำตัวในสไปรต์ (bw*s) ไม่ใช่ความกว้างผืนสไปรต์ ซึ่งมีขอบเผื่อออร่าอยู่ด้วย
       สูตรเดียวกับที่หน้าร้านย่อสไปรต์ทากในตู้ (shop-floor.js) */
    const genes=typeof foodGenes==="function"?foodGenes(slug):slug.genes;
    const bodyPx=(typeof slugCm==="function"?slugCm(genes):6)*width/cm;
    const k=bodyPx/(parts.bw*parts.s);
    const lowX=(quad[2].x+quad[3].x)/2,lowY=(quad[2].y+quad[3].y)/2;
    const highX=(quad[0].x+quad[1].x)/2,highY=(quad[0].y+quad[1].y)/2;
    const t=.30,x=lowX+(highX-lowX)*t,y=lowY+(highY-lowY)*t;   // เกาะอยู่บนทราย ไม่ลอยกลางตู้
    ctx.save();
    ctx.beginPath();ctx.moveTo(quad[0].x,quad[0].y);for(let i=1;i<4;i++)ctx.lineTo(quad[i].x,quad[i].y);ctx.closePath();ctx.clip();
    ctx.drawImage(sprite.c,x-sprite.w*k/2,y-sprite.h*k/2,sprite.w*k,sprite.h*k);
    ctx.restore();
  }
  _carriedSlugs.length=0;
}
function personScreenBounds(p){
  const h=p.hCm/CM_PER_CELL,z=cam.zoom,b=P(p.x,p.y,0),rx=h*TW*z*.55;
  return{x0:b.x-rx-4,x1:b.x+rx+4,y0:b.y-h*(ZUNIT+TH*.55)*z-4,y1:b.y+h*TH*z*.55+4};
}
function personOnScreen(p){if(!personEntered(p))return false;const r=personScreenBounds(p);return r.x1>=0&&r.x0<=CW&&r.y1>=0&&r.y0<=CH;}
// The culling rectangle includes room for every arm pose. It is NOT a click
// target: at close zoom it covers neighbouring tanks and large empty areas.
// Pick the already-cached visible mesh only, on pointer events (no frame work).
function personHitTest(p,sx,sy){
  const pose=p._drawPose,b=personScreenBounds(p);
  if(!pose||sx<b.x0||sx>b.x1||sy<b.y0||sy>b.y1)return false;
  function depthAt(faces,dx=0,dy=0){
    let nearest=-Infinity;
    for(const face of faces){
      const v=face.v||face,q=v.map(a=>{const x=a[0]+dx,y=a[1]+dy,z=a[2],s=P(x,y,z*ZUNIT);return[s.x,s.y,x+y+z];});
      for(let i=1;i<q.length-1;i++){
        const a=q[0],c=q[i+1],b=q[i],den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
        if(Math.abs(den)<1e-8)continue;
        const u=((b[1]-c[1])*(sx-c[0])+(c[0]-b[0])*(sy-c[1]))/den;
        const w=((c[1]-a[1])*(sx-c[0])+(a[0]-c[0])*(sy-c[1]))/den,t=1-u-w;
        if(u>=-1e-7&&w>=-1e-7&&t>=-1e-7)nearest=Math.max(nearest,u*a[2]+w*b[2]+t*c[2]);
      }
    }
    return nearest;
  }
  const hit=depthAt(pose.faces,p.x-pose.x,p.y-pose.y);
  return Number.isFinite(hit)&&hit>=depthAt(personFurnitureFaces(true))-1e-6;
}
let _personBounds=null,_personVertexData=new Float32Array(65536),_poseBudget=3;
const POSE_STALE=2.2;   /* ท่าค้างเกินกี่เท่าของคาบ = สร้างใหม่ทันที */
/* คนยืนนิ่งขยับจาก 3 ตัวเท่านั้น: หายใจ (±0.0015 ของส่วนสูง) · เอนตัวและขยับข้างตอน state==='look' (±0.003 ทั้งคู่)
   รวมแอมพลิจูดประมาณ 0.0045 เท่าของส่วนสูง แกว่งด้วยความถี่ ~1.6 rad/s
   → ระยะที่ขยับต่อวินาทีบนจอ ≈ 1.6 × 0.0045 × ความสูงบนจอ(px)
   ตั้งคาบให้ "หนึ่งรอบสร้างท่า = ขยับประมาณ POSE_PIXEL_STEP พิกเซล" แล้วหนีบไว้ไม่เกินของเดิม
   ซูมเข้าใกล้มาก ๆ ก็ยังได้ 12 Hz เท่าเดิม · ซูมปกติ (คนสูง ~266 px) ได้ ~3.8 Hz = งานลดสามเท่า */
const POSE_IDLE_AMP=.0045, POSE_PIXEL_STEP=.5, POSE_IDLE_MIN_HZ=1;
function personIdleHz(p){
  const bodyPx=p.hCm/CM_PER_CELL*ZUNIT*cam.zoom;
  return Math.max(POSE_IDLE_MIN_HZ,Math.min(POSE_IDLE_HZ,1.6*POSE_IDLE_AMP*bodyPx/POSE_PIXEL_STEP));
}
/* ⚠️ 2026-09-22 ผู้เล่น: "คนท่าใหม่เยอะไปไหม ปรับให้ทำอะไรช้าลงกว่าเดิมหน่อยก็ได้"
   ตอนนั้นป้ายขึ้น "ท่าใหม่ 64–76/วิ" ตอนลูกค้า 6 คนเดินพร้อมกัน (ยอด "คน" พุ่งจาก 2.8 → 7.4 ms/เฟรม)
   วัดก่อนตัดสินใจ — คนเดินเต็มสปีด สูง 277 px บนจอ เทียบจุดยอดทุกจุดระหว่างสองท่าที่ห่างกัน 1 คาบ:
      36 Hz → ขยับเฉลี่ย 0.88 px (สูงสุด 14.8 ที่ปลายเท้า)
      22 Hz → 0.85 px (14.2)      ← เท่ากับ 36 Hz ทั้งที่ทำงานน้อยกว่าเกือบครึ่ง
      15 Hz → 1.46 px (31.3)
      10 Hz → 2.68 px (32.3)
       6 Hz → 5.70 px (36.9)      ← เริ่มเห็นเป็นภาพกระตุกชัด
   สรุป: เพดานเดิม 36 Hz จ่ายฟรีไปเปล่า ๆ (ไม่ได้ภาพดีกว่า 22 Hz เลย) จึงลดเพดานเหลือ 24
   และลดงบรวมลงตามที่ผู้เล่นอนุญาต — ลูกค้า 6 คนจะได้คนละ ~16 Hz แทน 21.7 Hz
   ท่าเดินจะ "หยาบขึ้นเล็กน้อย" จริงตามตัวเลขข้างบน (0.85 → ~1.4 px ต่อก้าวของการอัปเดต)
   ตำแหน่งยังเลื่อนทุกเฟรมเหมือนเดิม คนจึงยังไถลไปข้างหน้าลื่น ๆ ไม่ใช่กระตุกทั้งตัว
   ถ้ารู้สึกว่าขาแข็งไป ให้ดัน POSE_HZ_BUDGET กลับขึ้น ไม่ต้องแตะอย่างอื่น */
/* ⚠️ 2026-09-23 ผู้เล่น: "ล็อกเฟรมแล้วดูดีขึ้น เพียงแต่มันทำให้ท่าเดินคนดูกระตุก"
   ถูกต้อง — รอบก่อนผมหั่นงบเป็นเลขตายตัว (130 → 95) ซึ่งเป็นการเดาว่าเครื่องไหวแค่ไหน
   พอ frame-cap.js ทำให้มีที่ว่างเหลือเฟือ (เกมวาด 1.9–10 ms จากช่องเวลา 16.7) งบที่หั่นไว้ก็กลายเป็นการรัดคอเปล่า ๆ
   ตอนนี้งบขยับเองตาม "ที่ว่างจริงของเฟรม" แบบเดียวกับ animCap ของทาก:
     ใช้เวลาวาดไม่ถึง 55% ของช่องเวลา → เพิ่มงบ (ท่าเดินลื่นขึ้น)
     เกิน 75% → ลดงบ (ยอมให้ท่าหยาบลง ดีกว่าเฟรมตก)
   เครื่องแรงจะไต่ไปจนสุดเพดาน · มือถือกากจะไหลลงไปเอง โดยไม่ต้องมีใครมานั่งเดาเลขให้ */
let POSE_MOVE_HZ=24, POSE_HZ_BUDGET=150;
const POSE_IDLE_HZ=12, POSE_MOVE_MAX_HZ=24, POSE_MOVE_MIN_HZ=12,
      POSE_BUDGET_MIN=55, POSE_BUDGET_MAX=240;
function tunePoseBudget(){
  const cap=window.FrameCap;
  if(!cap)return;
  const slot=cap.intervalMs, work=cap.workMs;
  if(work<slot*0.55)      POSE_HZ_BUDGET=Math.min(POSE_BUDGET_MAX,POSE_HZ_BUDGET*1.04);
  else if(work>slot*0.75) POSE_HZ_BUDGET=Math.max(POSE_BUDGET_MIN,POSE_HZ_BUDGET*0.93);
}   /* งบรวมทั้งร้าน: สร้างท่าใหม่ไม่เกินกี่ครั้ง/วินาที → หารกันตามจำนวนคนในจอ (คนเยอะ = แต่ละคนช้าลง แต่ไม่มีใครค้าง) */   /* อัตราเปลี่ยนท่า: กำลังเดิน/ทำท่า vs ยืนดูเฉย ๆ */   // ท่าค้างเกินกี่เท่าของคาบ = สร้างใหม่ทันที ไม่ต้องรอคิว (กันอาการ "ค้างท่าแล้วไถล")
function beginPersonBatch(visitors){
  _personBatch=[];_personBounds=null;_carriedSlugs.length=0;
  /* โควตา "สร้างท่าใหม่" ต่อเฟรม — กันเฟรมเดียวแบกงานสร้างเมชหลายคนพร้อมกัน (ต้นเหตุ p95 พุ่ง)
     เครื่องช้า (งบอนิเมชันทากถูกหั่นแล้ว) เหลือ 2 คน/เฟรม · เครื่องปกติ 3 คน/เฟรม
     ⚠️ ต้องมากพอให้คนที่เดินอยู่ได้ 30Hz ครบทุกคน ไม่งั้นท่าจะค้างแล้วเห็นเป็นไถล */
  _poseBudget=(typeof animCap==='number'&&animCap<=4)?2:3;
  tunePoseBudget();
  POSE_MOVE_HZ=Math.max(POSE_MOVE_MIN_HZ,Math.min(POSE_MOVE_MAX_HZ,POSE_HZ_BUDGET/Math.max(1,(visitors&&visitors.length)||1)));
  /* จัดคิวตาม "ใครค้างนานที่สุด" ไม่ใช่ตามลำดับการวาด — คนท้ายแถวจะได้ไม่โดนอดซ้ำ ๆ จนท่าแข็ง */
  if(visitors&&visitors.length){
    const due=[];
    for(const p of visitors){
      p._poseAllow=false;
      if(!p._drawPose){p._poseAllow=true;continue;}              // ยังไม่เคยมีท่า = ต้องสร้างแน่นอน
      /* คาบที่ drawPerson เลือกไว้จริงเมื่อเฟรมก่อน — ใช้จัดลำดับ "ใครค้างเกินคาบของตัวเองนานสุด"
         (คำนวณคีย์ท่าใหม่ตรงนี้อีกรอบไม่คุ้ม ค่าคาบเปลี่ยนช้ากว่าเฟรมอยู่แล้ว) */
      const rate=p._poseRate||((p.motion>.05||p.action!=='watch')?POSE_MOVE_HZ:POSE_IDLE_HZ);
      const over=_peopleT-p._drawPose.t-(1+(p._poseJit||0))/rate;
      if(over>0)due.push({p:p,over:over});
    }
    due.sort(function(a,b){return b.over-a.over;});
    for(let i=0;i<due.length&&i<_poseBudget;i++)due[i].p._poseAllow=true;
  }
  if(visitors?.length){const r={x0:CW,y0:CH,x1:0,y1:0};for(const p of visitors){const b=personScreenBounds(p);r.x0=Math.min(r.x0,b.x0);r.y0=Math.min(r.y0,b.y0);r.x1=Math.max(r.x1,b.x1);r.y1=Math.max(r.y1,b.y1);}_personBounds=r;}
}
/* คอนเท็กซ์ WebGL ของเลเยอร์คน — สร้างครั้งเดียว ใช้ร่วมกันทั้งเส้นทางต่อเฟรมและเส้นทางอบภาพนิ่ง */
function personGL(){
  if(!_personGL){
    const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true});
    if(!gl)throw Error('WebGL is required for character depth rendering');
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    const program=gl.createProgram();
    /* off = ระยะที่คนเดินไปหลังจากสร้างท่า (หน่วยช่อง) — บวกให้ที่นี่แทนการคัดลอกจุดยอดทั้งตัวใน JS
       ต้องบวก "ก่อน" คิด clip ทั้งสามแกน เพราะแกน Z (ความลึก) ก็คิดจาก x+y เหมือนกัน
       ผลจึงเท่ากับ translatePoseFaces เดิมทุกประการ ทั้งภาพและลำดับการบัง */
    gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 pos;attribute vec3 color;uniform vec4 clipX;uniform vec4 clipY;uniform vec4 clipZ;uniform vec2 off;varying vec3 tint;void main(){vec4 v=vec4(pos.x+off.x,pos.y+off.y,pos.z,1.0);gl_Position=vec4(dot(v,clipX),dot(v,clipY),dot(v,clipZ),1.0);tint=color;}'));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform float opacity;varying vec3 tint;void main(){gl_FragColor=vec4(tint*opacity,opacity);}'));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    _personGL={canvas,gl,program,buffer:gl.createBuffer(),pos:gl.getAttribLocation(program,'pos'),color:gl.getAttribLocation(program,'color'),clipX:gl.getUniformLocation(program,'clipX'),clipY:gl.getUniformLocation(program,'clipY'),clipZ:gl.getUniformLocation(program,'clipZ'),opacity:gl.getUniformLocation(program,'opacity'),off:gl.getUniformLocation(program,'off')};
  }
  return _personGL;
}
/* เส้นทาง "วาดจากลิสต์หน้า" — ตอนนี้เหลือผู้ใช้เดียวคือ cat-seller.js ที่อบภาพแมวแคชเชียร์
   (ครั้งเดียวต่อการเปลี่ยนผังร้าน ไม่ใช่งานต่อเฟรม) · ลูกค้าใช้ drawPersonBatchGL แทนแล้ว */
function paintPersonMesh(faces,p,H,snapshot=false){
  if(!faces.length)return;
  const {canvas,gl,program,buffer,pos,color,clipX,clipY,clipZ,opacity,off}=personGL(),origin=snapshot?{x:0,y:0}:P(0,0,0),z=snapshot?1:cam.zoom;
  let bounds=_personBounds;
  if(!bounds){bounds={x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity};for(const f of faces)for(const v of f.v){const x=origin.x+(v[0]-v[1])*TW*z,y=origin.y+(v[0]+v[1])*TH*z-v[2]*ZUNIT*z;bounds.x0=Math.min(bounds.x0,x);bounds.x1=Math.max(bounds.x1,x);bounds.y0=Math.min(bounds.y0,y);bounds.y1=Math.max(bounds.y1,y);}}
  const x0=snapshot?Math.floor(bounds.x0)-2:Math.max(0,Math.floor(bounds.x0)-2),y0=snapshot?Math.floor(bounds.y0)-2:Math.max(0,Math.floor(bounds.y0)-2),x1=snapshot?Math.ceil(bounds.x1)+2:Math.min(CW,Math.ceil(bounds.x1)+2),y1=snapshot?Math.ceil(bounds.y1)+2:Math.min(CH,Math.ceil(bounds.y1)+2),w=x1-x0,h=y1-y0;
  if(w<=0||h<=0)return;
  const scale=snapshot?1:Math.min(2,window.devicePixelRatio||1),width=Math.ceil(w*scale),height=Math.ceil(h*scale);
  if(canvas.width<width)canvas.width=Math.ceil(width/128)*128;if(canvas.height<height)canvas.height=Math.ceil(height/128)*128;
  const blockers=personFurnitureFaces(!snapshot),glass=[];
  for(const o of G.objs){if(o===moving||(!snapshot&&!onScreen(o)))continue;
    if(o.def.playTable){glass.push(...playTableDepthFaces(o).glass);continue;}
    if(o.def.researchTable){glass.push(...researchTableDepthFaces(o).glass);continue;}
    if(o.type!=='tank')continue;
    const q=objGeometry(o).glass;                     // แคชไว้แล้ว (ดู objGeometry) ไม่สร้างใหม่ทุกเฟรม
    if(q)for(const v of q)glass.push(v);
  }
  const total=faces.reduce((n,f)=>n+(f.v.length-2)*18,0)+(blockers.length+glass.length)*36;
  if(_personVertexData.length<total)_personVertexData=new Float32Array(2**Math.ceil(Math.log2(total)));
  let at=0;const data=_personVertexData;
  /* ⚠️ 2026-09-21 เดิมบรรทัดนี้เขียน for(const j of [0,i,i+1]) = จองอาร์เรย์ใหม่ "ต่อสามเหลี่ยม"
     คนหนึ่งคนมีหลายพันหน้า → ขยะ GC หลักหมื่นชิ้นต่อเฟรม · คลี่เป็นสามจุดตรง ๆ ผลลัพธ์เท่าเดิม */
  const push=(vs,r,g,b)=>{
    for(let i=1;i<vs.length-1;i++){
      const a=vs[0],b2=vs[i],c=vs[i+1];
      data[at++]=a[0];data[at++]=a[1];data[at++]=a[2];data[at++]=r;data[at++]=g;data[at++]=b;
      data[at++]=b2[0];data[at++]=b2[1];data[at++]=b2[2];data[at++]=r;data[at++]=g;data[at++]=b;
      data[at++]=c[0];data[at++]=c[1];data[at++]=c[2];data[at++]=r;data[at++]=g;data[at++]=b;
    }
  };
  for(const vs of blockers)push(vs,0,0,0);const maskCount=at/6;
  for(const f of faces)push(f.v,f.rgb[0]/255,f.rgb[1]/255,f.rgb[2]/255);const opaqueEnd=at/6;
  for(const vs of glass)push(vs,.48,.66,.71);
  gl.viewport(0,canvas.height-height,width,height);gl.disable(gl.BLEND);gl.depthMask(true);gl.colorMask(true,true,true,true);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);gl.uniform1f(opacity,1);gl.uniform2f(off,0,0);gl.uniform4f(clipX,TW*z*2/w,-TW*z*2/w,0,(origin.x-x0)*2/w-1);gl.uniform4f(clipY,-TH*z*2/h,-TH*z*2/h,ZUNIT*z*2/h,1-(origin.y-y0)*2/h);gl.uniform4f(clipZ,-.025/H,-.025/H,-.025/H,(p.x+p.y)*.025/H);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data.subarray(0,at),gl.STREAM_DRAW);
  gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(color);gl.vertexAttribPointer(color,3,gl.FLOAT,false,24,12);
  gl.colorMask(false,false,false,false);gl.drawArrays(gl.TRIANGLES,0,maskCount);gl.colorMask(true,true,true,true);gl.drawArrays(gl.TRIANGLES,maskCount,opaqueEnd-maskCount);
  gl.depthMask(false);gl.enable(gl.BLEND);gl.uniform1f(opacity,.38);gl.blendFuncSeparate(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ZERO,gl.ONE);gl.drawArrays(gl.TRIANGLES,opaqueEnd,at/6-opaqueEnd);gl.depthMask(true);gl.disable(gl.BLEND);
  if(snapshot){
    const image=document.createElement('canvas');image.width=width;image.height=height;
    image.getContext('2d').drawImage(canvas,0,0,width,height,0,0,width,height);
    return {image,x:x0-(p.x-p.y)*TW,y:y0-(p.x+p.y)*TH,w,h};
  }
  ctx.drawImage(canvas,0,0,width,height,x0,y0,w,h);
}

/* ---------- เลเยอร์ลูกค้าต่อเฟรม ----------
   งานที่เหลือต่อเฟรมมีแค่: ยัดหน้าบัง (เฟอร์นิเจอร์+กระจกตู้ ~150 สามเหลี่ยม) ลงบัฟเฟอร์เล็กหนึ่งใบ
   แล้ววนคน → ตั้ง uniform ระยะเลื่อน → drawArrays จากบัฟเฟอร์ของคนคนนั้น (อัปโหลดไว้แล้วตอนสร้างท่า)
   ลำดับสามพาสต้องเหมือนเดิมเป๊ะ ไม่งั้นการบังเพี้ยน:
     1) หน้าบังทึบ เขียนเฉพาะความลึก (colorMask ปิด)
     2) ตัวคน ทึบ
     3) กระจกตู้ ผสมสีทับ (depthMask ปิด)
   ⚠️ บัฟเฟอร์หน้าบังยังสร้างใหม่ทุกเฟรม "โดยตั้งใจ" — โต๊ะเล่น/โต๊ะวิจัยมีของบนโต๊ะเปลี่ยนตลอด
      ของชุดนี้เล็กมากเทียบกับคน (คนเดียว ~3,000 สามเหลี่ยม) จึงยังไม่คุ้มที่จะไปแคชแยก */
/* จัดคนเป็น "กลุ่มที่กรอบบนจอซ้อนกัน" — คนที่กรอบไม่ซ้อนกันบังกันไม่ได้อยู่แล้ว จึงวาดแยกกรอบได้
   ⚠️ 2026-09-22 เดิมใช้กรอบรวมของลูกค้าทุกคน: ลูกค้ายืนคนละมุมร้าน = เลเยอร์คนกลายเป็นเกือบเต็มจอ
      (วัดได้ 766×430 px จากลูกค้าแค่ 2 คน · ของผู้เล่นมี 6 คนกระจายทั่วจอ)
      ต้นทุนจึงผูกกับ "ระยะห่างระหว่างลูกค้า" ไม่ใช่พื้นที่ที่คนกินจริง ทั้งฝั่งเรนเดอร์และฝั่ง composite
   รวมกรอบแบบทรานซิทีฟจนไม่มีคู่ไหนซ้อนกัน → กรอบที่ได้ไม่ทับกัน วาดทับลงแคนวาส 2D ได้ตรง ๆ */
function personClusters(batch){
  const boxes=[];
  for(const p of batch){
    const b=personScreenBounds(p);
    const r={x0:Math.max(0,Math.floor(b.x0)-2),y0:Math.max(0,Math.floor(b.y0)-2),
             x1:Math.min(CW,Math.ceil(b.x1)+2),y1:Math.min(CH,Math.ceil(b.y1)+2),people:[p]};
    if(r.x1<=r.x0||r.y1<=r.y0)continue;
    boxes.push(r);
  }
  for(let merged=true;merged;){
    merged=false;
    for(let i=0;i<boxes.length&&!merged;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];
      if(a.x0>=b.x1||b.x0>=a.x1||a.y0>=b.y1||b.y0>=a.y1)continue;
      a.x0=Math.min(a.x0,b.x0);a.y0=Math.min(a.y0,b.y0);
      a.x1=Math.max(a.x1,b.x1);a.y1=Math.max(a.y1,b.y1);
      for(const p of b.people)a.people.push(p);
      boxes.splice(j,1);merged=true;break;
    }
  }
  return boxes;
}
let _occVerts=new Float32Array(16384);
function drawPersonBatchGL(batch){
  const {canvas,gl,program,buffer,pos,color,clipX,clipY,clipZ,opacity,off}=personGL();
  const origin=P(0,0,0),z=cam.zoom,H=Math.max(100,cellsW()+cellsH());
  const clusters=personClusters(batch);
  if(!clusters.length)return;
  const scale=Math.min(2,window.devicePixelRatio||1);
  let maxW=0,maxH=0;
  for(const c of clusters){maxW=Math.max(maxW,Math.ceil((c.x1-c.x0)*scale));maxH=Math.max(maxH,Math.ceil((c.y1-c.y0)*scale));}
  if(canvas.width<maxW)canvas.width=Math.ceil(maxW/128)*128;
  if(canvas.height<maxH)canvas.height=Math.ceil(maxH/128)*128;

  const blockers=personFurnitureFaces(true),glass=[];
  for(const o of G.objs){if(o===moving||!onScreen(o))continue;
    if(o.def.playTable){glass.push(...playTableDepthFaces(o).glass);continue;}
    if(o.def.researchTable){glass.push(...researchTableDepthFaces(o).glass);continue;}
    if(o.type!=='tank')continue;
    const q=objGeometry(o).glass;                     // แคชไว้แล้ว (ดู objGeometry) ไม่สร้างใหม่ทุกเฟรม
    if(q)for(const v of q)glass.push(v);
  }
  const need=(faceTriCount(blockers)+faceTriCount(glass))*3*PERSON_STRIDE;
  if(_occVerts.length<need)_occVerts=new Float32Array(2**Math.ceil(Math.log2(need)));
  let at=flattenFaces(blockers,_occVerts,0,0,0,0);
  const maskCount=at/PERSON_STRIDE;
  at=flattenFaces(glass,_occVerts,at,.48,.66,.71);
  const glassCount=at/PERSON_STRIDE-maskCount;

  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(color);
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,_occVerts.subarray(0,at),gl.STREAM_DRAW);
  const bind=b=>{gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(color,3,gl.FLOAT,false,24,12);};
  _poseFrame++;

  for(const c of clusters){
    const x0=c.x0,y0=c.y0,w=c.x1-c.x0,h=c.y1-c.y0;
    const width=Math.ceil(w*scale),height=Math.ceil(h*scale);
    gl.viewport(0,canvas.height-height,width,height);
    gl.disable(gl.BLEND);gl.depthMask(true);gl.colorMask(true,true,true,true);
    gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(opacity,1);
    gl.uniform4f(clipX,TW*z*2/w,-TW*z*2/w,0,(origin.x-x0)*2/w-1);
    gl.uniform4f(clipY,-TH*z*2/h,-TH*z*2/h,ZUNIT*z*2/h,1-(origin.y-y0)*2/h);
    gl.uniform4f(clipZ,-.025/H,-.025/H,-.025/H,0);    // ชุดเดียวกับที่ endPersonBatch เคยส่ง p={x:0,y:0}

    /* หน้าบังของเฟอร์นิเจอร์ต้องวาดซ้ำในทุกกรอบ — แต่ละกรอบมี depth buffer ของตัวเอง
       ของชุดนี้เล็ก (หลักร้อยสามเหลี่ยม) เทียบกับคนคนเดียว ~3,000 จึงถูกกว่าการวาดเต็มจอมาก */
    bind(buffer);gl.uniform2f(off,0,0);
    gl.colorMask(false,false,false,false);gl.drawArrays(gl.TRIANGLES,0,maskCount);gl.colorMask(true,true,true,true);

    for(const p of c.people){
      const pose=p._drawPose;if(!pose||!pose.tris)continue;
      const e=poseBufferFor(gl,p);
      bind(e.buf);
      gl.uniform2f(off,p.x-pose.x,p.y-pose.y);
      gl.drawArrays(gl.TRIANGLES,0,pose.tris*3);
    }
    if(glassCount){
      bind(buffer);gl.uniform2f(off,0,0);
      gl.depthMask(false);gl.enable(gl.BLEND);gl.uniform1f(opacity,.38);
      gl.blendFuncSeparate(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ZERO,gl.ONE);
      gl.drawArrays(gl.TRIANGLES,maskCount,glassCount);
      gl.depthMask(true);gl.disable(gl.BLEND);
    }
    ctx.drawImage(canvas,0,0,width,height,x0,y0,w,h);
  }
  prunePoseBuffers(gl);
}

// Fixed upper-arm and forearm lengths; gestures move the joints, never stretch them.
function solvePersonArm(shoulder,wantedHand,preferredElbow,maxReach=.215,upper=maxReach/2,lower=maxReach/2){
  const delta=wantedHand.map((x,i)=>x-shoulder[i]);
  const raw=Math.hypot(...delta),distance=Math.max(.035,Math.abs(upper-lower)+1e-6,Math.min(maxReach,raw));
  const direction=raw>1e-8?delta.map(x=>x/raw):[0,0,-1];
  const hand=shoulder.map((x,i)=>x+direction[i]*distance);
  let bend=preferredElbow.map((x,i)=>x-shoulder[i]);
  const along=bend.reduce((sum,x,i)=>sum+x*direction[i],0);
  bend=bend.map((x,i)=>x-along*direction[i]);
  if(Math.hypot(...bend)<1e-6){
    const axis=Math.abs(direction[2])<.9?[0,0,-1]:[1,0,0];
    const dot=axis.reduce((sum,x,i)=>sum+x*direction[i],0);
    bend=axis.map((x,i)=>x-dot*direction[i]);
  }
  const norm=Math.hypot(...bend);bend=bend.map(x=>x/norm);
  const reach=(upper*upper-lower*lower+distance*distance)/(2*distance);
  const height=Math.sqrt(Math.max(0,upper*upper-reach*reach));
  const elbow=shoulder.map((x,i)=>x+direction[i]*reach+bend[i]*height);
  return {hand,elbow};
}

// Reuse each existing hand mesh's upper surface when placing it under a tank.
// The bake assigns whole triangles to bones, leaving duplicated seam vertices.
// Match their bind positions once; join only shirt seams when a pose is rebuilt.
// Fit once per head/hair variant; all coordinates are relative to the head joint.
const personHatFits=new WeakMap();
function fittedPersonHat(model,hair){
  const key=hair||model.parts.head;
  if(personHatFits.has(key))return personHatFits.get(key);
  const base=.085,parts=[model.parts.head,hair].filter(Boolean);
  let rx=.05,ry=.06,top=base;
  for(const part of parts)for(let i=0;i<part.v.length;i+=3){
    if(part.v[i+2]<base-.008)continue;
    rx=Math.max(rx,Math.abs(part.v[i]));ry=Math.max(ry,Math.abs(part.v[i+1]));top=Math.max(top,part.v[i+2]);
  }
  let scale=1;
  for(const part of parts)for(let i=0;i<part.v.length;i+=3){
    if(part.v[i+2]<base-.008)continue;
    scale=Math.max(scale,Math.hypot(part.v[i]/rx,part.v[i+1]/ry));
  }
  // Circumscribe the head with a ten-sided ellipse, leaving clearance at each face.
  const fit={base,rx:rx*scale/Math.cos(Math.PI/10)+.006,ry:ry*scale/Math.cos(Math.PI/10)+.006,top:top+.014};
  personHatFits.set(key,fit);return fit;
}
const personShirtSeams=new WeakMap();
function shirtSeams(model){
  if(personShirtSeams.has(model))return personShirtSeams.get(model);
  const buckets=new Map(),groups=[],byPart=new Map(),eps=.00016;
  for(const name of ['torso','armL','armR','foreL','foreR']){
    const part=model.parts[name];if(!part)continue;
    const used=new Set();
    for(const [slot,start,count] of part.s)if(slot==='shirt')
      for(let k=start*3;k<(start+count)*3;k++)used.add(part.t[k]);
    for(const i of used){
      const pos=[0,1,2].map(a=>part.v[i*3+a]+part.o[a]);
      const cell=pos.map(x=>Math.floor(x/eps));let group;
      for(let x=-1;x<=1&&!group;x++)for(let y=-1;y<=1&&!group;y++)for(let z=-1;z<=1&&!group;z++){
        const near=buckets.get([cell[0]+x,cell[1]+y,cell[2]+z].join(','));
        group=near?.find(g=>Math.hypot(...pos.map((v,a)=>v-g.pos[a]))<eps);
      }
      if(!group){group={pos,members:[]};groups.push(group);const key=cell.join(',');
        if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(group);}
      group.members.push({part,i});
    }
  }
  const seams=groups.filter(g=>new Set(g.members.map(m=>m.part)).size>1);
  seams.forEach((g,id)=>{for(const {part,i} of g.members){
    if(!byPart.has(part))byPart.set(part,new Map());byPart.get(part).set(i,id);
  }});
  for(const [part,vertices] of byPart){
    const triangles=new Uint8Array(part.t.length/3);
    for(let k=0;k<triangles.length;k++)triangles[k]=vertices.has(part.t[k*3])||vertices.has(part.t[k*3+1])||vertices.has(part.t[k*3+2]);
    byPart.set(part,{vertices,triangles});
  }
  const result={byPart,count:seams.length,points:Array.from({length:seams.length},()=>[]),facePool:[]};personShirtSeams.set(model,result);return result;
}
// Shared bind-space accessories are fitted offline by tools/build-people-bags.mjs.
// Pose them with the exact torso transform: width, sway, lean, twist and crouch.
const personBagModels=new WeakMap(Object.keys(PEOPLE_MODEL).map(name=>[PEOPLE_MODEL[name],PEOPLE_BAG_MODEL[name]]));
function fittedPersonBags(model){return personBagModels.get(model);}
const carryPalmTops=new WeakMap();
function carryPalmTop(part){
  if(!carryPalmTops.has(part)){
    let top=-Infinity;for(let i=2;i<part.v.length;i+=3)top=Math.max(top,part.v[i]);
    carryPalmTops.set(part,top);
  }
  return carryPalmTops.get(part);
}

/* ⚠️ 2026-09-21 ผู้เล่น: "มือถือแลค" — ท่าทางถูกแคชไว้แล้ว (12–30Hz) แต่ "ตำแหน่ง" ต้องเลื่อนทุกเฟรม
   เดิมเลื่อนด้วย faces.map(...v.map(...)) = สร้างอาร์เรย์ใหม่ต่อ "ทุกจุดยอดของทุกหน้า ทุกเฟรม"
   คนเดินหนึ่งคนมีหลายพันจุด → ขยะ GC กองใหญ่ทุกเฟรม ซึ่งบนมือถือคือตัวกระตุกตัวจริง
   ตอนนี้จองบัฟเฟอร์ปลายทางไว้ต่อคน แล้วเขียนทับค่าเดิม — จองใหม่เฉพาะตอนเปลี่ยนท่าเท่านั้น */
/* ⚠️ translatePoseFaces ถูกถอดออก 2026-09-22 — เดิมคัดลอกจุดยอดทุกจุดของทุกคนทุกเฟรมเพื่อบวกระยะเลื่อน
   (วัดได้ 1.00 ms ต่อคนต่อเฟรม) ตอนนี้ระยะเลื่อนถูกส่งเป็น uniform `off` ให้เชดเดอร์บวกเอง
   ผลเท่าเดิมทุกจุด แต่ฝั่ง JS เหลือศูนย์ · ถ้าต้องการจุดยอดที่เลื่อนแล้วใน JS ให้บวก dx/dy ตอนอ่าน */
function drawPerson(p){
  if(!personOnScreen(p))return;
  // Camera movement does not change a person's world-space geometry.
  // Reuse idle poses at 12 Hz and moving/gesturing poses at 30 Hz;
  // position is translated every frame so walking remains smooth.
  /* ⚠️ 2026-09-22 ผู้เล่น: "เกมกระตุก แถมใช้พลังประมวลผลมากเกินไป"
     คนยืนดูตู้เฉย ๆ เคยสร้างเมชใหม่ทั้งตัว (3,042 สามเหลี่ยม) 12 ครั้ง/วินาที ตามนาฬิกา POSE_IDLE_HZ
     วัดจริงว่าได้อะไรกลับมา (คนสูง 266 px บนจอ ยืนนิ่ง เทียบจุดยอดทุกจุด):
        ห่างกัน 1 คาบ (1/12 วิ) → จุดยอดขยับ "สูงสุด 0.053 px" เฉลี่ย 0.005 px
        ห่างกันเต็ม 1 วินาที    → สูงสุด 0.41 px
     คือจ่ายเต็มราคาเพื่อภาพที่ต่างกันไม่ถึงพิกเซล · ท่ายืนขยับจากสามตัวเท่านั้น
     (หายใจ 0.0015 · เอนตัวตอน state==='look' 0.003 · ขยับข้าง 0.003 — ทั้งหมดเทียบกับส่วนสูง)
     ตอนนี้จึงแยกคีย์เป็นสองส่วน:
       shapeKey = ทุกอย่างที่ "เห็นได้" (ท่า ทิศ หันหัว เดิน ของที่ถือ เสื้อผ้า) → เปลี่ยนเมื่อไรรีเฟรชไว
       ส่วนลมหายใจ = ผูกกับ "ระยะที่ขยับจริงบนจอ" ไม่ใช่นาฬิกา (personIdleHz)
     ผลคือคนที่หันหัว/ขยับ ยังลื่นเท่าเดิม แต่คนที่นิ่งจริงหยุดเผาเมชทิ้ง */
  const idleHz=personIdleHz(p);
  const moving=p.motion>.05||p.action!=='watch';
  const shapeKey=[p.action==='watch'?0:Math.round((p.actionT||0)*30),Math.round((p.catchupBoost||1)*10),Math.round(p.phase*20),Math.round((p.motion||0)*20),Math.round(p.fdx*100),Math.round(p.fdy*100),Math.round((p.headYaw||0)*100),p.action,p.state,p._squeezeUntil>_peopleT?1:0,p.focus?.id,['point','crouch'].includes(p.action)?Math.round(p.x*20):0,['point','crouch'].includes(p.action)?Math.round(p.y*20):0,p.hCm,p.outfit,p.hairCut,p.shirt,p.pants,p.skin,p.hair,p.bagged,p.accessory,p.modelHair,p.facial,p.body,p.carryTank?1:0,p.carryTank?p.carryColor:0,p.carryTank?p.carryAccent:0].join('|');
  /* ⚠️ 2026-09-21 ผู้เล่น: "มือถือแลค" — คอมเมนต์ข้างบนตั้งใจให้ใช้ท่าซ้ำที่ 12/30Hz
     แต่ของจริงแทบไม่เคยได้ใช้ซ้ำเลย เพราะคีย์มีค่าที่ "ไม่มีวันนิ่ง" ปนอยู่:
     headYaw กับ fdx/fdy เป็นค่าที่ไล่เข้าเป้าแบบ exponential (บรรทัด 336) จึงขยับทีละนิดตลอดกาล
     ปัดทศนิยม 2 ตำแหน่งก็ยังเปลี่ยนเกือบทุกเฟรม → คีย์เปลี่ยน → สร้างท่าใหม่ทั้งตัวทุกเฟรม
     วัดจริง: สร้างท่าใหม่ 8.16 ms/คน (3,042 หน้า) · ใช้ท่าแคช 0.54 ms · พลาดแคช 55 จาก 60 เฟรม
     ลูกค้า 5 คนบนมือถือจึงกินเวลาเกินงบเฟรมไปหลายเท่า
     แก้ด้วยการคุม "อัตราเปลี่ยนท่า" ตามเวลาจริงตามที่ตั้งใจไว้แต่แรก: คีย์เปลี่ยนก็รอให้ถึงรอบก่อน
     (ท่าที่ได้เหมือนเดิมทุกประการ แค่อัปเดตที่ 12/30Hz แทน 60Hz · ตำแหน่งยังเลื่อนทุกเฟรม เดินจึงลื่นเท่าเดิม) */
  /* ⚠️ 2026-09-22 ผู้เล่น: "รู้สึกกระตุก" · ปิดอนิเมชันทากแล้ว p95 ยังเท่าเดิม → ตัวการอยู่ฝั่งคน
     วัดได้ (ลูกค้า 4 คนในจอ): เฟรมที่ไม่มีใครสร้างท่าใหม่ 3.8 ms · เฟรมที่สร้างพร้อมกัน 4 คน 10.7 ms
     และเฟรมแบบหลังเกิด 7% = ตรงกับ p95 ที่ผู้เล่นเห็นเป๊ะ
     สาเหตุ: ทุกคนใช้คาบเดียวกัน (12/30Hz) และเข้าร้านไล่ ๆ กัน จังหวะรีเฟรชท่าเลย "ตรงกันหมด"
     (ปัญหาเดียวกับสไปรต์ทากที่แก้ไปแล้วด้วย s._tsOff — ที่นี่ยังไม่มีตัวกระจาย)
     แก้สองชั้น: สุ่มคาบให้เหลื่อมกันทุกครั้งที่สร้างท่า + จำกัดจำนวนคนที่สร้างท่าใหม่ได้ต่อเฟรม
     คนที่ไม่ได้คิวจะใช้ท่าเดิมไปอีกเฟรม (ตำแหน่งยังเลื่อนตามปกติ เดินไม่สะดุด) */
  /* ⚠️ 2026-09-22 รอบสอง ผู้เล่น: "ท่าเดินเวลามีตัวขวางค้างท่านั้นแล้วไถลไปตามทาง · ท่าเดินแข็งกว่าเดิมมาก"
     รอบแรกผมคุมด้วย "โควตาต่อเฟรม" แบบใครมาก่อนได้ก่อน (ลำดับการวาด) คนท้ายแถวจึงโดนอดคิวซ้ำ ๆ
     ท่าค้างแต่ตำแหน่งยังเลื่อน = เห็นเป็นไถล และคนที่โดนอดบ่อยก็ดูแข็ง
     ตอนนี้: จัดคิวตาม "ใครค้างนานสุด" (คิดใน beginPersonBatch) + ใครค้างเกิน POSE_STALE เท่าของคาบ
     ให้สร้างท่าใหม่ได้ทันทีไม่สนโควตา = ไม่มีใครค้างยาวจนเห็นเป็นไถลอีก */
  /* เลือกคาบจากสิ่งที่เปลี่ยนจริง ไม่ใช่จากสถานะอย่างเดียว:
       กำลังเดิน/ทำท่า          → POSE_MOVE_HZ (ลื่นเท่าเดิมทุกประการ)
       ยืนอยู่แต่รูปร่างเปลี่ยน (หันหัว มองตู้อื่น เปลี่ยนของที่ถือ) → POSE_IDLE_HZ เหมือนเดิม
       ยืนนิ่งจริง เหลือแค่ลมหายใจ → idleHz ซึ่งคิดจากระยะขยับบนจอ (ปกติ 1–4 Hz แทน 12 Hz) */
  const shapeChanged=!p._drawPose||p._drawPose.shape!==shapeKey;
  const poseRate=moving?POSE_MOVE_HZ:(shapeChanged?POSE_IDLE_HZ:idleHz);
  p._poseRate=poseRate;                                   // beginPersonBatch ใช้จัดคิว "ใครค้างนานสุด"
  const poseKey=shapeKey+'|'+Math.floor(p.idle*idleHz);
  const interval=(1+(p._poseJit||0))/poseRate, age=p._drawPose?_peopleT-p._drawPose.t:Infinity;
  const due=!p._drawPose||(p._drawPose.key!==poseKey&&age>=interval);
  const mustRefresh=age>=interval*POSE_STALE;                  // ค้างนานเกินไปแล้ว ห้ามอดอีก
  if(p._drawPose&&(!due||(!p._poseAllow&&!mustRefresh&&_poseBudget<=0))){
    const cached=p._drawPose,dx=p.x-cached.x,dy=p.y-cached.y;
    if(cached.carryQuad)_carriedSlugs.push({p,cm:cached.carryCm,
      quad:dx||dy?cached.carryQuad.map(v=>[v[0]+dx,v[1]+dy,v[2]]):cached.carryQuad});
    _personBatch?.push(p);return;                     // ใช้บล็อกจุดยอดเดิมที่อยู่บน GPU แล้ว ไม่แตะจุดยอดเลย
  }
  let carryQuad=null,carryCm=0;
  const H=p.hCm/CM_PER_CELL, b=P(p.x,p.y,0), px=H*ZUNIT*cam.zoom;
  if(px<5||b.x < -px||b.x>CW+px||b.y < -px||b.y>CH+px) return;
  const turned=p._squeezeUntil>_peopleT&&p._squeezeFacing;
  const facingX=turned?turned.x:p.fdx,facingY=turned?turned.y:p.fdy;
  const n=Math.hypot(facingX,facingY)||1, fx=facingX/n, fy=facingY/n;
  const right=[fy,-fx], faces=[], build=p.build||1;
  const skirt=p.outfit==='skirt'||p.outfit==='dress';
  const shoulderWidth=p.gender==='female'?.94:1;
  const motion=p.motion||0, phase=p.phase;
  let clearance=Infinity;for(const o of G.objs){if(o===moving)continue;const dx=Math.max(o.cx-p.x,0,p.x-o.cx-oW(o)),dy=Math.max(o.cy-p.y,0,p.y-o.cy-oH(o));clearance=Math.min(clearance,Math.hypot(dx,dy));}
  /* ---- ถ่ายน้ำหนัก + บิดตัวตอนเดิน ----
     คนจริงไม่ได้เลื่อนตัวเป็นก้อนแล้วสลับขา: สะโพกส่ายไปทับเท้าข้างที่ยืนพื้น (~2-3 ซม.)
     เชิงกรานหมุนตามขาที่ก้าวออกไป ส่วนอก/ไหล่หมุนสวนทาง (transverse rotation)
     ขาดสองอย่างนี้ ท่อนบนจะนิ่งเป็นแท่ง = ต้นเหตุหลักที่ท่าเดินดู "แข็ง" */
  const gaitAmp=motion*Math.min(1,Math.max(.25,clearance/6));
  const sway   =-Math.sin(phase)*0.0105*gaitAmp;   // เอนไปทับเท้าข้างที่ยืนพื้น (ซ้ายยืนช่วง phase 0..π จุดกลาง π/2)
  const pelvisA=-Math.cos(phase)*0.070*gaitAmp;    // เชิงกรานหมุนตามขาข้างที่ยื่นไปหน้า (ซ้ายยื่นสุดที่ phase=0)
  const thoraxA= Math.cos(phase)*0.100*gaitAmp;    // อกหมุนสวนเชิงกราน ไปทางเดียวกับแขนที่แกว่งมาหน้า
  const rotZ=(v,a)=>{const c=Math.cos(a),si=Math.sin(a);return [v[0]*c-v[1]*si, v[0]*si+v[1]*c, v[2]];};
  let bob=0;                       // ตัวขึ้น-ลงตามจังหวะก้าว คำนวณจริงหลังรู้ความยาวขา (ดูบล็อกโมเดล)
  const breath=Math.sin(p.idle*1.6)*0.0015;
  const action=p.action||'watch';
  const gesture=personGesture(action,p.actionT||0,p.actionDuration||1);
  const actionProgress=Math.min(1,(p.actionT||0)/(p.actionDuration||1));
  const jump=action==='jump'&&p.kid?Math.max(0,Math.sin(actionProgress*Math.PI*4))*.07:0;
  const crouch=!p.carryTank&&action==='crouch'?Math.min(gesture,Math.max(0,(clearance/H-.14)/.5)):0;
  // Raised arms can cross neck height; they must never inherit head transforms.
  let posedArms=false,armGeometry=false;
  function inspectPose(v){
    v=v.slice();if(!crouch)return v;
    if(v[2]>=HIPZ){
      const y=v[1],z=v[2]-HIPZ,a=crouch*1.4;
      v[1]=y*Math.cos(a)+z*Math.sin(a)-.065*crouch;
      v[2]=HIPZ+z*Math.cos(a)-y*Math.sin(a)-.04*crouch;
    }else{
      const t=Math.max(0,Math.min(1,(v[2]-.05)/(HIPZ-.05)));
      v[1]+=Math.sin(Math.PI*t)*.07*crouch-.065*crouch*t;v[2]-=.04*crouch*t;
    }return v;
  }
  /* ตรีโกณของการหันหัว/พยักหน้า คิดครั้งเดียวต่อคน — เดิมคิดใหม่ทุกเวอร์เท็กซ์ (หลักหมื่นครั้งต่อเฟรม) */
  const _yaw=-(p.headYaw||0), _yawC=Math.cos(_yaw), _yawS=Math.sin(_yaw);
  const _nodZ=(action==='nod')?Math.sin((p.actionT||0)*6)*.004*gesture:0;
  const runLean=Math.max(0,(p.catchupBoost||1)-1)*.012*motion;
  /* ⚠️ 2026-09-23 ผู้เล่น: "ไม่มีใครเดินหลังตรงขนาดนั้น"
     ของเดิมเขียนเป็น "ถ้า state==='look' ใช้ 0.012 ไม่งั้นใช้ 0.019*motion" = เลือกอย่างใดอย่างหนึ่ง
     ลูกค้าที่กำลังเดินไปดูตู้อยู่ใน state 'look' อยู่แล้ว จึงได้แค่ 0.012 (4.1°) และ "ไม่โตตามความเร็ว"
     คือยิ่งเดิน ยิ่งไม่เอนเพิ่ม → ตัวตั้งตรงเป๊ะเหมือนยืนตรงเคลื่อนที่
     ตอนนี้แยกเป็นสองส่วนแล้วบวกกัน: ท่าทางพื้นฐาน (ยืนดูตู้) + เอนตามความเร็วจริง
     เพดาน 0.026 ของส่วนสูง = ราว 8.8° วัดจากช่วงสะโพก→อก 0.168 — อยู่ในช่วงเดินปกติของคนจริง (2–10°) */
  const postureLean=p.state==='look'?0.012+Math.sin(p.idle*.65)*.003:0;
  const lean=runLean+Math.min(0.026,postureLean+GAIT_LEAN_WALK*motion)+(action==='lean'?gesture*.026:0);
  const shift=p.state==='look'?Math.sin(p.idle*.65)*.003:0;
  function world(v){
    v=[v[0]+shift*Math.min(1,v[2]/.5),v[1]+(action==='lean'?gesture*.026*Math.max(0,v[2]-.5):0),v[2]];
    if(!armGeometry&&v[2]>HEADCUT){
      const x=v[0],y=v[1]-(lean+.009);
      v[0]=x*_yawC-y*_yawS;v[1]=lean+.009+x*_yawS+y*_yawC;
      v[2]+=_nodZ;
    }
    if(!armGeometry&&!posedArms&&crouch&&v[2]>HEADCUT){const y=v[1]-lean,z=v[2]-HEADCUT,a=-.65*crouch;v[1]=lean+y*Math.cos(a)+z*Math.sin(a);v[2]=HEADCUT+z*Math.cos(a)-y*Math.sin(a);}
    if(!posedArms)v=inspectPose(v);
    /* ---- สัดส่วนเด็ก (ไม่ต้องมีโมเดลแยก) ----
       ผู้ใหญ่ในโมเดลสูงราว 5.6 หัว · เด็กวัยประถมจริงราว 4.5-5 หัว
       ของเดิมแค่ย่อขา 7% = เอาผู้ใหญ่มาย่อทั้งตัว หัวเล็กลงตามส่วนสูงด้วย เลยดูเป็นผู้ใหญ่แคระ
       ที่นี่ย่อขาแล้ว "ขยายหัว" รอบข้อต่อคอทั้งสามแกน หัวจึงโตเมื่อเทียบกับตัว */
    let vx=v[0],vy=v[1],z=v[2];
    if(p.kid){
      if(z<HIPZ) z*=KID_LEG; else z-=HIPZ*(1-KID_LEG);
      if(!armGeometry&&v[2]>HEADCUT){
        const nz=NECKZ-HIPZ*(1-KID_LEG), py=lean+.009;
        z=nz+(z-nz)*KID_HEAD; vx*=KID_HEAD; vy=py+(vy-py)*KID_HEAD;
      }
    }
    return [p.x+(right[0]*vx+fx*vy)*H,p.y+(right[1]*vx+fy*vy)*H,(z+jump)*H];
  }
  /* twoSided: หน้าที่หันหนีกล้องจะถูก "กลับด้าน" แทนที่จะถูกทิ้ง
     เมชจากไฟล์ .fbx วนหน้าคนละแบบกับทรงที่โค้ดปั้นเอง ถ้าทิ้งเลยจะเป็นรูพรุนทั้งตัว
     ตัวเรนเดอร์มี depth buffer อยู่แล้ว วาดสองด้านจึงถูกต้องและไม่เพี้ยน */
  function face(vertices,color,shade=0,twoSided=false){
    let v=vertices.map(world);
    let a=v[0],u=v[1].map((x,i)=>x-a[i]),w=v[2].map((x,i)=>x-a[i]);
    let norm=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
    const len=Math.hypot(...norm)||1;norm=norm.map(x=>x/len);
    if(norm[0]+norm[1]+norm[2]<=0){
      if(!twoSided) return;
      // Reverse the whole face: keeping only three corners opened half of a tank wall.
      v=v.slice().reverse();norm=norm.map(x=>-x);
    }
    const light=norm[0]*-.28+norm[1]*.36+norm[2]*.75;
    faces.push({v,rgb:shadeRgb(hexToRgb(color),shade+light*16-5),depth:v.reduce((s,v)=>s+v[0]+v[1]+v[2],0)/v.length});
  }
  // Elliptical cross sections preserve shoulders, waist, jaw and shoe shape.
  function rings(rows,color,sides=8){
    const rr=rows.map(([x,y,z,rx,ry])=>Array.from({length:sides},(_,i)=>{const a=i*Math.PI*2/sides;return [x+Math.cos(a)*rx,y+Math.sin(a)*ry,z];}));
    for(let j=0;j<rr.length-1;j++)for(let i=0;i<sides;i++)face([rr[j][i],rr[j][(i+1)%sides],rr[j+1][(i+1)%sides],rr[j+1][i]],color);
    face([...rr[0]].reverse(),color);face(rr[rr.length-1],color);
  }
  function limb(a,b,r0,r1,color){
    const d=b.map((v,i)=>v-a[i]),l=Math.hypot(...d)||1,t=d.map(v=>v/l);
    let u=Math.abs(t[1])>.95?[0,-t[2],t[1]]:[t[2],0,-t[0]],ul=Math.hypot(...u)||1;u=u.map(v=>v/ul);
    const v=[t[1]*u[2]-t[2]*u[1],t[2]*u[0]-t[0]*u[2],t[0]*u[1]-t[1]*u[0]];
    const rr=[a,b].map((pt,j)=>Array.from({length:8},(_,i)=>pt.map((x,k)=>x+(u[k]*Math.cos(i*Math.PI/4)+v[k]*Math.sin(i*Math.PI/4))*(j?r1:r0))));
    for(let i=0;i<8;i++)face([rr[0][i],rr[0][(i+1)%8],rr[1][(i+1)%8],rr[1][i]],color);
    face([...rr[0]].reverse(),color);face(rr[1],color);
  }
  /* ---------- ประกอบร่างจากโมเดลจริง (js/people-model.js) ----------
     โมเดลถูกเบคมาในระบบพิกัดเดียวกับ world() แล้ว (x=ข้าง y=หน้า z=สูง สูง=1)
     ที่นี่แค่หาตำแหน่งข้อต่อตามท่าทาง แล้วหมุนชิ้นส่วนไปวางตามข้อต่อนั้น
     ท่าเดิน/ชี้/ก้ม/หันหัว ยังใช้ระบบเดิมทั้งหมด แค่เปลี่ยนสิ่งที่ถูกวาดจาก "ทรงกระบอก" เป็น "เมช" */
  const MDL=PEOPLE_MODEL[(p.body&&PEOPLE_MODEL[p.body])?p.body:(p.gender==='female'?'female':'male')], JT=MDL.joints;
  const SLOTC={skin:p.skin,shirt:p.shirt,pants:p.pants,shoe:p.shoe,hair:p.hair,dark:'#2b2622',white:'#efeadd',bag:'#655844',strap:'#51463a'};
  const bw=build;                                   // อ้วน/ผอม = ขยายด้านข้าง (ความสูงคุมด้วย hCm)
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const norm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];};
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  /* เมทริกซ์หมุนที่พาแกน a ไปทับแกน b (สูตร Rodrigues) — ใช้หมุนท่อนแขน/ขาไปตามข้อต่อ */
  function axisRot(a,b){
    const d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    let kx=a[1]*b[2]-a[2]*b[1],ky=a[2]*b[0]-a[0]*b[2],kz=a[0]*b[1]-a[1]*b[0];
    const s=Math.hypot(kx,ky,kz);
    if(s<1e-7) return d>0?null:[-1,0,0,0,-1,0,0,0,1];
    kx/=s;ky/=s;kz/=s;const c=d,C=1-c;
    return [c+kx*kx*C, kx*ky*C-kz*s, kx*kz*C+ky*s,
            ky*kx*C+kz*s, c+ky*ky*C, ky*kz*C-kx*s,
            kz*kx*C-ky*s, kz*ky*C+kx*s, c+kz*kz*C];
  }
  const HIPZ=JT.hips[2],NECKZ=JT.neck[2],HEADCUT=NECKZ;
  /* ช่วงที่ลำตัว "บิด/เอน" ไล่จาก 0 ถึงเต็ม — ต้องจบที่อก ไม่ใช่คอ
     เพราะไหล่ (z≈0.78) กับโคนคอของชิ้นหัวอยู่ "ต่ำกว่าคอ" ถ้าไล่ไปจบที่คอ สองจุดนั้นจะได้ค่าไม่เต็ม
     แต่แขนกับหัวถูกยึดด้วยค่าเต็ม → ลำตัวกับไหล่/คอเสื้อเหลื่อมกันเป็นรอยต่อ
     (กายวิภาคก็ตรงกว่า: อกขึ้นไปเป็นก้อนแข็ง บิดกันที่กระดูกสันหลังช่วงล่าง) */
  const TWZ=JT.chest[2];
  const KID_LEG=0.88, KID_HEAD=1.20;
  /* ตู้ทากใบเล็กที่พ่อค้าเร่อุ้มมา (ราว 30×15×20 ซม. เทียบคนสูง 165) — พิกัดเดียวกับ world() */
  const CARRY_HW=.090, CARRY_HH=.060, CARRY_HD=.045;
  const CARRY_Z=HIPZ+(TWZ-HIPZ)*.34, CARRY_Y=.115;              // เด็ก: ขาสั้นลง 12% · หัวโตขึ้น 20%
  /* วางชิ้นส่วนหนึ่งชิ้น: หมุน → ยืดตามความยาวข้อต่อ → ย้ายไปข้อต่อ → แปลงเป็นพิกัดโลก → ปั๊มสามเหลี่ยม
     ไม่เรียก face() ทีละสามเหลี่ยมเพราะจะเรียก world() ซ้ำ 3 เท่า (เวอร์เท็กซ์หนึ่งตัวใช้ร่วมกันหลายหน้า)
     แปลงทีละเวอร์เท็กซ์ครั้งเดียวแล้วค่อยประกอบหน้า เร็วกว่า ~3 เท่า */
  const _W=[];
  const seamMap=shirtSeams(MDL),seamPoints=seamMap.points,seamFaces=seamMap.facePool;
  let seamFaceCount=0;
  function emit(part,at,rot,stretch,shear,twist,radius=1){
    if(!part) return;
    const v=part.v,t=part.t,n=v.length/3,ax=part.axis,st=(stretch&&stretch!==1&&ax)?stretch-1:0;
    const sh=shear||0, span=TWZ-HIPZ, tw=twist||null,joins=seamMap.byPart.get(part);
    for(let i=0;i<n;i++){
      let x=v[i*3],y=v[i*3+1],z=v[i*3+2];
      // Child limbs need a smaller cross section as well as shorter bones.
      // Scale around the bone axis so elbow/wrist attachment positions stay fixed.
      if(radius!==1&&ax){const d=x*ax[0]+y*ax[1]+z*ax[2],r=1-radius;x=x*radius+ax[0]*d*r;y=y*radius+ax[1]*d*r;z=z*radius+ax[2]*d*r;}
      if(st){const d=(x*ax[0]+y*ax[1]+z*ax[2])*st;x+=ax[0]*d;y+=ax[1]*d;z+=ax[2]*d;}
      if(rot){const nx=rot[0]*x+rot[1]*y+rot[2]*z,ny=rot[3]*x+rot[4]*y+rot[5]*z,nz=rot[6]*x+rot[7]*y+rot[8]*z;x=nx;y=ny;z=nz;}
      const wz=at[2]+z;
      const f=wz<=HIPZ?0:wz>=TWZ?1:(wz-HIPZ)/span;     // 0 ที่สะโพก → 1 ที่อก (ใช้ร่วมกันทั้งเอนและบิด)
      /* bw (อ้วน/ผอม) ต้องคูณ "ทั้งจุดข้อต่อและตัวเมช" ไม่ใช่เมชอย่างเดียว
         ของเดิม at[0]+x*bw → ลำตัวถูกย่อ/ขยายด้านข้าง แต่ข้อไหล่/ข้อสะโพกอยู่ที่เดิม
         build 0.94 (ค่าปกติของผู้ชาย) ทำให้ลำตัวแคบเข้า ~1 ซม. แต่แขนไม่ขยับตาม
         → เกิดรูดำที่หัวไหล่/วงแขน ซึ่งคือ 'คอเสื้อกับหัวไหล่แปลก ๆ' ที่เห็น */
      let vx=(at[0]+x)*bw, vy=at[1]+y+(sh?sh*f:0);
      if(tw){                                   // เชิงกราน→อก บิดสวนกัน ไล่ตามความสูง
        const a=tw[0]+(tw[1]-tw[0])*f, a2=a*a;
        const ca=1-a2*0.5, sa=a*(1-a2/6), nx2=vx*ca-vy*sa;vy=vx*sa+vy*ca;vx=nx2;
      }
      _W[i]=world([vx, vy, wz]);
    }
    if(joins)for(const [i,id] of joins.vertices)seamPoints[id].push(_W[i]);
    for(const run of part.s){
      const rgb0=hexToRgb(SLOTC[run[0]]||p.shirt);
      for(let k=run[1],e=run[1]+run[2];k<e;k++){
        const A=_W[t[k*3]],B=_W[t[k*3+1]],C=_W[t[k*3+2]];
        if(joins?.triangles[k]){
          const f={v:[A,B,C],rgb:null,depth:0};faces.push(f);
          const entry=seamFaces[seamFaceCount]||(seamFaces[seamFaceCount]={face:null,rgb:null});
          entry.face=f;entry.rgb=rgb0;seamFaceCount++;continue;
        }
        const ux=B[0]-A[0],uy=B[1]-A[1],uz=B[2]-A[2],wx=C[0]-A[0],wy=C[1]-A[1],wz=C[2]-A[2];
        let nx=uy*wz-uz*wy,ny=uz*wx-ux*wz,nz=ux*wy-uy*wx;
        const L=Math.hypot(nx,ny,nz)||1;nx/=L;ny/=L;nz/=L;
        let vv;
        if(nx+ny+nz<=0){vv=[A,C,B];nx=-nx;ny=-ny;nz=-nz;}else vv=[A,B,C];   // หันหนีกล้อง = กลับด้าน ไม่ทิ้ง
        faces.push({v:vv,rgb:shadeRgb(rgb0,(nx*-.28+ny*.36+nz*.75)*16-5),
                    depth:(A[0]+A[1]+A[2]+B[0]+B[1]+B[2]+C[0]+C[1]+C[2])/3});
      }
    }
  }
  /* ---- ขา: วงจรเดินจริง (ช่วงยืนพื้น / ช่วงยกเท้า) + IK เข่าสองท่อน ----
     ของเดิมเป็นไซน์ล้วน ๆ ทั้งเท้าและเข่า ผลคือ (ก) เท้าไถลไปกับพื้นเพราะไซน์เคลื่อนที่ไม่คงที่
     (ข) ขายืด-หดแทนที่จะงอเข่า เพราะสั่งตำแหน่งเข่าตรง ๆ แล้วไปยืดเมชให้ถึง
     ที่นี่: ช่วงยืนพื้นให้เท้าถอยหลังเป็นเส้นตรงเท่ากับระยะที่ตัวเดินไป (ไม่ไถล)
             ช่วงยกเท้าวาดเป็นส่วนโค้ง แล้วหาเข่าด้วย IK โดยความยาวท่อนขาคงที่ */
  const LEGL1=dist(JT.hipL,JT.kneeL), LEGL2=dist(JT.kneeL,JT.ankleL), LEGMAX=(LEGL1+LEGL2)*0.999;
  const LEGREST=JT.hipL[2]-JT.ankleL[2];
  const STEPA=WALK_STEP*0.5*motion;                 // เท้าแกว่งไป-กลับข้างละเท่านี้
  /* ก้าวยาวขึ้น = ขากางขึ้น = สะโพกต้องต่ำลงตามเรขาคณิต ไม่งั้นเท้าลอย/ขายืด
     นี่คือที่มาของการ "ยุบ-ยืด" ตามจังหวะเดินของคนจริง */
  {
    /* ระยะที่ "เท้าข้างที่ยืนพื้น" ห่างจากใต้สะโพก — เป็นสามเหลี่ยม ไม่ใช่ไซน์
       (ตอนแรกใช้ sin(phase) ซึ่งผิดเฟส 90° ทำให้จังหวะที่ขากางสุดกลับไม่ยุบตัว
        ขาเลยเอื้อมไม่ถึงพื้น ถูก clamp แล้วท่าเดินออกมาแข็ง ๆ ลอย ๆ) */
    const u=((phase%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
    const half=u<Math.PI?u/Math.PI:(u-Math.PI)/Math.PI;
    const spread=Math.abs(1-2*half)*STEPA;
    /* ยุบเพิ่มอีกนิดจากค่าต่ำสุดทางเรขาคณิต เพื่อให้เข่าข้างที่ยืนพื้น "งอนิด ๆ" ตลอด
       ขาเหยียดตึงเป๊ะทุกจังหวะจะดูแข็งเหมือนหุ่น */
    bob=Math.sqrt(Math.max(0,LEGMAX*LEGMAX-spread*spread))-LEGREST-0.013*motion;
  }
  /* IK สองท่อน: รู้สะโพกกับข้อเท้า หาเข่าโดยให้ท่อนขายาวคงที่ และงอไปข้างหน้าเสมอ */
  function legIK(a,b,L1,L2){
    let ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2];
    let d=Math.hypot(ux,uy,uz)||1e-6;
    if(d>LEGMAX){const k=LEGMAX/d;ux*=k;uy*=k;uz*=k;d=LEGMAX;}
    ux/=d;uy/=d;uz/=d;
    const t=(d*d+L1*L1-L2*L2)/(2*d), h=Math.sqrt(Math.max(0,L1*L1-t*t));
    const dp=uy;                                   // ทิศงอเข่า = ไปข้างหน้า (+y) หักส่วนที่ขนานแกนขาออก
    let nx=-ux*dp, ny=1-uy*dp, nz=-uz*dp;
    const nl=Math.hypot(nx,ny,nz);
    if(nl<1e-6){nx=0;ny=1;nz=0;}else{nx/=nl;ny/=nl;nz/=nl;}
    return [a[0]+ux*t+nx*h, a[1]+uy*t+ny*h, a[2]+uz*t+nz*h];
  }
  for(const side of [-1,1]){
    const S=side<0?'L':'R', J=k=>JT[k+S];
    let th=(phase+(side<0?Math.PI:0))%(Math.PI*2); if(th<0)th+=Math.PI*2;
    /* วงจรเท้าแบบตำราแอนิเมชัน: ถีบปลายเท้า → ส้นตวัดขึ้นหลัง (เข่างอ) → เหวี่ยงผ่านใต้ตัว → ลงส้นเท้า
       จุดยกสูงสุดอยู่ "ช่วงต้น" ของการเหวี่ยง ไม่ใช่กลางก้าว จะได้เห็นเข่างอโดยไม่ดูเหมือนยกเข่าสวนสนาม
       (ของเดิมยกสูงสุดกลางก้าวพอดี = ท่าที่ผู้ใช้บอกว่า 'ยกเข่าเยอะไป') */
    const HEELDOWN=0.20, TOEOFF=0.34;               // มุมเชิดปลายเท้ารอลงส้น / มุมถีบปลายเท้า (เรเดียน)
    let fy,fz,pitch;
    if(th<Math.PI){                                 // ช่วงเหวี่ยงขาไปข้างหน้า
      const u=th/Math.PI, e=u*u*(3-2*u);            // smoothstep: ออกตัวนุ่ม ลงนุ่ม
      fy=-STEPA+2*STEPA*e-GAIT_TUCK*motion*Math.sin(Math.PI*u);   // ดึงเท้าเข้าใต้ตัวตอนผ่าน = เข่างอเพิ่ม
      fz=GAIT_LIFT*motion*Math.sin(Math.PI*Math.pow(u,0.70)); // ยอดอยู่ราว 30% ของช่วง = ส้นตวัดไปหลัง
      pitch=(u<0.32? -TOEOFF*(1-u/0.32)                       // เพิ่งถีบเสร็จ ปลายเท้ายังชี้ลง
                   : HEELDOWN*Math.pow((u-0.32)/0.68,2))*motion;   // แล้วค่อยเชิดขึ้นรอลงส้น
    }else{                                          // ช่วงเท้าอยู่กับพื้น
      const u=(th-Math.PI)/Math.PI;
      fy=STEPA-2*STEPA*u; fz=0;
      pitch=(u<0.20? HEELDOWN*(1-u/0.20)            // ลงส้นก่อน แล้วคลี่ฝ่าเท้าลงจนราบ
            : u<0.68? 0
            : -TOEOFF*Math.pow((u-0.68)/0.32,2))*motion;      // ถีบปลายเท้าตอนจะยกขึ้น
    }
    /* หมุนเท้ารอบข้อเท้าเฉย ๆ ส้น/ปลายเท้าจะจมพื้น — ยกข้อเท้าชดเชยตามมุม
       (คนจริงก็ยกข้อเท้าขึ้นตอนถีบปลายเท้าอยู่แล้ว ไม่ใช่การโกง) */
    fz+=Math.max(0,pitch)*0.030+Math.max(0,-pitch)*0.050;
    /* เชิงกรานหมุน (ข้อสะโพกเลื่อนตามการหมุน) · ส่ายไปทับเท้าข้างที่ยืนพื้น
       · ข้างที่ยกขาเชิงกรานตกลงเล็กน้อย (pelvic drop จริงราว 4°) — เท้าไม่ส่ายตาม เพราะเหยียบพื้นอยู่ */
    const hj=rotZ(J('hip'),pelvisA), drop=(th<Math.PI?-1:1)*0.0045*gaitAmp;
    const hip=[hj[0]+sway,hj[1],hj[2]+bob+drop];
    /* ⚠️ 2026-09-23 ผู้เล่น: "ดูก้าวเท้าไปข้างหน้าเยอะเกินจนดูเหมือนเดินขาแบะ"
       ไล่ดูตัวเลขโมเดลจริง: ข้อเท้าซ้าย-ขวาห่างกัน 0.1474 เท่าของส่วนสูง = 25.4 ซม. ที่คนสูง 172
       แต่ข้อสะโพกห่างกันแค่ 0.0852 = 14.7 ซม. → ขากางออกเป็นรูป ∧ ตั้งแต่ท่ายืนเฉย ๆ
       (ความยาวก้าวไม่ได้ผิด: WALK_STEP 0.235 = 40 ซม. ซึ่งสั้นกว่าคนจริงด้วยซ้ำ
        สิ่งที่ผิดคือ "ความกว้างของฐานเท้า" ไม่ใช่ความยาวก้าว — ตาอ่านรวมกันเป็น "ขาแบะ")
       คนจริงเดินเท้าเกือบเรียงเส้นเดียว ฐานกว้างราว 8–12 ซม. และแคบลงอีกตอนเดินเร็ว
       จึงดึงข้อเท้าเข้าหาแนวกลางตัว: ยืน 30% (เหลือ ~17.8 ซม.) · เดินเต็มสปีด 60% (เหลือ ~10.2 ซม.)
       เข่ากับต้นขาเอียงตามเองผ่าน IK = การหุบขาเข้าจริง ๆ ไม่ใช่แค่ขยับเท้า */
    const narrow=GAIT_NARROW_STAND+GAIT_NARROW_WALK*motion;
    const ax=J('ankle')[0]*(1-narrow);
    const ankle=[ax,J('ankle')[1]+fy,J('ankle')[2]+fz];
    const knee=legIK(hip,ankle,LEGL1,LEGL2);
    const rl=MDL.parts['thigh'+S],cl=MDL.parts['calf'+S],fl=MDL.parts['foot'+S];
    emit(rl,hip,axisRot(rl.axis,norm(sub(knee,hip))),1);
    emit(cl,knee,axisRot(cl.axis,norm(sub(ankle,knee))),1);
    const ca=Math.cos(pitch),sa=Math.sin(pitch);
    emit(fl,ankle,[1,0,0, 0,ca,-sa, 0,sa,ca],1);    // เท้าเงย/ถีบรอบแกนข้าง
  }
  /* ---- ลำตัว + หัว ---- */
  emit(MDL.parts.torso,[JT.hips[0]+sway,JT.hips[1],JT.hips[2]+bob],null,1,lean,[pelvisA,thoraxA]);
  /* หัวนิ่งกว่าลำตัว (คนจริงตรึงสายตาไว้) — ส่ายตามแค่ ~85% และไม่หมุนตามอก ไม่งั้นหน้าจะส่ายตามทุกก้าว */
  const headAt=[JT.head[0]+sway*0.85,JT.head[1]+lean,JT.head[2]+bob+breath];
  emit(MDL.parts.head,headAt,null,1);
  const hairSet=MDL.variants.hair||{},hairKey=p.modelHair&&hairSet[p.modelHair]?p.modelHair:Object.keys(hairSet)[0];
  if(hairKey) emit(hairSet[hairKey],headAt,null,1);
  const facialSet=MDL.variants.facial||{};
  if(p.facial&&facialSet[p.facial]) emit(facialSet[p.facial],headAt,null,1);
  /* ---- แขน: ใช้ IK เดิม แต่ความยาวท่อนมาจากโมเดลจริง ---- */
  for(const side of [-1,1]){
    posedArms=false;armGeometry=true;
    const S=side<0?'L':'R', J=k=>JT[k+S];
    const KARM=p.kid?0.93:1;                       // ย่อขาแล้วต้องย่อแขนตาม ไม่งั้นมือห้อยเลยเข่า
    const L1=dist(J('shoulder'),J('elbow'))*KARM, L2=dist(J('elbow'),J('wrist'))*KARM, REACH=(L1+L2)*.985;
    /* โมเดลวางสัดส่วนแขนกลับหัว (ท่อนล่าง 0.180 ยาวกว่าท่อนบน 0.154) — คนจริงท่อนบนยาวกว่า ~0.56:0.44
       ย้ายจุดศอกให้ท่อนบนยาวขึ้น/ท่อนล่างสั้นลง โดยระยะเอื้อมรวม (REACH) เท่าเดิม ปลายมือถึงที่เดิม */
    const ARMTOT=L1+L2, UARM=ARMTOT*0.56, FARM=ARMTOT*0.44;
    /* ไหล่ติดไปกับอกที่หมุน + ส่ายตามน้ำหนัก */
    const shj=rotZ(J('shoulder'),thoraxA);
    const shoulder=[shj[0]+sway,shj[1]+lean,shj[2]+bob];
    /* แขนแกว่งสวนกับขา "ข้างเดียวกัน" — ขาซ้ายยื่นสุดที่ phase=0 แขนซ้ายจึงต้องไปหลังสุดที่ phase=0
       (ของเดิมใช้ armTh=phase ตรง ๆ แขนเลยเหลื่อมขาอยู่ 90° เดินไม่เข้าจังหวะและดูแข็ง) */
    const armTh=phase+(side<0?-Math.PI/2:Math.PI/2);
    const armDamp=Math.min(1,Math.max(.35,clearance/6));
    /* แก้อาการ "ปลายแขนสะบัด": เดิมสั่งตำแหน่งมือกับศอกแยกกัน (มือแกว่ง 1.0 ศอกแกว่ง .32)
       มุมศอกจึงเปลี่ยนเยอะทุกจังหวะ = ปลายแขนเหวี่ยง
       ที่นี่หมุนทั้งแขนรอบไหล่เป็นชิ้นเดียว แล้วงอศอกด้วยมุมที่เกือบคงที่ (แกว่งแค่ ~7°)
       ชีวกลศาสตร์: ไหล่กวาดรวม ~25-30° ศอกงอค้าง ~23° เพิ่มอีกนิดตอนแขนมาข้างหน้า */
    const armA=Math.sin(armTh)*0.205*motion*armDamp;             // มุมไหล่ หน้า(+)/หลัง(−) ~±12°
    const armE=0.36+0.11*Math.max(0,Math.sin(armTh))*motion*armDamp;  // มุมงอศอก ~21°→27°
    const cA=Math.cos(armA),sA=Math.sin(armA),cE=Math.cos(armE),sE=Math.sin(armE);
    const dirU=norm([side*0.052, sA, -cA]);                      // ต้นแขนกางออกนิดหนึ่ง ไม่แนบลำตัว
    const dirF=norm([dirU[0], dirU[1]*cE-dirU[2]*sE, dirU[1]*sE+dirU[2]*cE]);
    let elbow=[shoulder[0]+dirU[0]*UARM,shoulder[1]+dirU[1]*UARM,shoulder[2]+dirU[2]*UARM];
    let hand =[elbow[0]+dirF[0]*FARM,  elbow[1]+dirF[1]*FARM,  elbow[2]+dirF[2]*FARM];
    const interested=p.state==='look'&&side===1, pointing=interested&&action==='point';
    if(interested){hand[1]+=.070;hand[2]=shoulder[2]-(L1+L2)*.62;}
    if(pointing){hand[1]+=.090*gesture;hand[2]+=.130*gesture;}
    if(side===1&&action==='chat'){hand[1]+=.055*gesture;hand[2]+=.09*gesture;}
    if(side===-1&&action==='adjust'){hand[0]*=1-.6*gesture;hand[1]+=.065*gesture;hand[2]+=.16*gesture;}
    if(action==='chin'&&side===1){const tgt=[side*.030,lean+.060,JT.head[2]-.030+bob];for(let i=0;i<3;i++)hand[i]+=(tgt[i]-hand[i])*gesture;}
    const ua=MDL.parts['arm'+S],fa=MDL.parts['fore'+S],hd=MDL.parts['hand'+S];
    /* รองก้นตู้: ข้อมืออยู่หลังก้นตู้ นิ้วชี้ไปข้างหน้าและฝ่ามืออยู่ใต้พื้น
       ใช้ความหนามือจริง ไม่วางข้อมือกลางตู้แล้วให้นิ้วชี้ตามท่อนแขนทะลุผนัง
       pole ของ IK อยู่ใต้ไหล่ใกล้ลำตัว ไม่ชี้ออกข้างจนศอกกาง */
    if(p.carryTank){
      hand=[side*CARRY_HW*.72/bw, lean+CARRY_Y-CARRY_HD-.030, CARRY_Z-CARRY_HH-carryPalmTop(hd)-.002+bob];
      elbow=[shoulder[0]+side*.012, shoulder[1]-.015, shoulder[2]-UARM];
    }
    if(action==='jump'&&p.kid&&!p.carryTank){hand[0]+=(side*.170-hand[0])*gesture;hand[1]+=(lean+.015-hand[1])*gesture;hand[2]+=(shoulder[2]+.10-hand[2])*gesture;elbow[0]+=(side*.16-elbow[0])*gesture;}
    if(crouch){
      const sh=inspectPose(shoulder),rest=inspectPose(hand);
      const kneeT=inspectPose([side*.055,.030,JT['knee'+S][2]+.03+bob]);
      for(let i=0;i<3;i++){shoulder[i]=sh[i];hand[i]=rest[i]+(kneeT[i]-rest[i])*gesture;}
      elbow=[side*.125,shoulder[1]+.025,shoulder[2]-L1*.80];
      posedArms=true;
    }
    let pose=solvePersonArm(shoulder,hand,elbow,REACH,UARM,FARM);
    hand=pose.hand.slice();elbow=pose.elbow.slice();
    if(!crouch&&!p.carryTank)constrainVisitorArm(p,[hand],world,H,right,fx,fy);
    pose=solvePersonArm(shoulder,hand,elbow,REACH,UARM,FARM);
    hand=pose.hand.slice();elbow=pose.elbow.slice();
    if(!crouch&&!p.carryTank)constrainVisitorArm(p,[elbow],world,H,right,fx,fy);
    const axU=norm(sub(elbow,shoulder)),axF=norm(sub(hand,elbow));
    const armRadius=p.kid?.80:1,handScale=p.kid?.84:1;
    emit(ua,shoulder,axisRot(ua.axis,axU),dist(shoulder,elbow)/ua.len,0,null,armRadius);
    emit(fa,elbow,axisRot(fa.axis,axF),dist(elbow,hand)/fa.len,0,null,armRadius);
    // Orient the palms independently of the forearms: fingers forward, thumbs inward.
    emit(hd,hand,p.carryTank?[0,-side,0, side,0,0, 0,0,1]:axisRot(hd.axis,axF),handScale,0,null,handScale);
  }
  posedArms=false;armGeometry=false;

  // Faces share these arrays, so welding preserves the original triangle count.
  for(const points of seamPoints){
    if(points.length<2)continue;
    let x=0,y=0,z=0;for(const v of points){x+=v[0];y+=v[1];z+=v[2];}
    const inv=1/points.length;x*=inv;y*=inv;z*=inv;
    for(const v of points){v[0]=x;v[1]=y;v[2]=z;}
  }
  seamFaces.length=seamFaceCount;
  for(const {face:f,rgb} of seamFaces){
    const [a,b,c]=f.v,ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    const length=Math.hypot(nx,ny,nz)||1,sign=nx+ny+nz<0?-1:1;
    nx*=sign/length;ny*=sign/length;nz*=sign/length;
    if(sign<0)f.v=[a,c,b];
    f.rgb=shadeRgb(rgb,(nx*-.28+ny*.36+nz*.75)*16-5);
    f.depth=(a[0]+a[1]+a[2]+b[0]+b[1]+b[2]+c[0]+c[1]+c[2])/3;
  }
  // Reuse scratch containers without retaining obsolete poses or colors.
  for(const points of seamPoints)points.length=0;
  for(const entry of seamFaces){entry.face=null;entry.rgb=null;}

  /* ---- ตู้ทากใบเล็กในมือพ่อค้าเร่ ----
     เปิดด้านหน้า (ไม่วาดกระจกหน้า) เพื่อให้เห็นตัวทากข้างใน — เมชนี้เป็นสีทึบล้วน
     ถ้าวาดกระจกหน้าด้วยจะบังทากมิด และวาดโปร่งแสงไม่ได้ในตัวเรนเดอร์นี้ */
  if(p.carryTank){
    const cz=CARRY_Z+bob, y0=lean+CARRY_Y-CARRY_HD, y1=lean+CARRY_Y+CARRY_HD;
    const x0=-CARRY_HW, x1=CARRY_HW, z0=cz-CARRY_HH, z1=cz+CARRY_HH;
    const water=p.carryColor||'#2f6f78', frame='#20282e', sand='#c9bb95';
    const q=(a,b,c,d,col,sh=0)=>face([a,b,c,d],col,sh,true);
    q([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],water,-8);          // กระจกหลัง
    q([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],water,-3);          // ข้างซ้าย
    q([x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1],water,-3);          // ข้างขวา
    q([x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0],frame,0);           // ก้นตู้
    q([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],frame,6);           // ขอบบน
    q([x0+.006,y0+.004,z0+.010],[x1-.006,y0+.004,z0+.010],[x1-.006,y1-.006,z0+.010],[x0+.006,y1-.006,z0+.010],sand,0); // ทราย
    /* ⚠️ 2026-09-16 ตัวทากในตู้ = "โมเดลทากของจริง" ตัวเดียวกับที่หน้าร้านวาดในตู้ (Slug3D.draw → สไปรต์ 2D เป็นตัวสำรอง)
       เดิมปั้นทรงเองด้วยวงแหวน/ท่อ ออกมาเป็นก้อนกลม ๆ ดูไม่ออกว่าเป็นทาก และไม่ใช่ตัวที่เขาเอามาขาย/มาท้าจริง ๆ ด้วย
       เมชคนวาดด้วยสีทึบล้วน ยัดโมเดลเข้าไปในเมชไม่ได้ จึงจดสี่เหลี่ยม "ช่องเปิดหน้าตู้" บนจอไว้
       แล้ววาดทากทับทีหลังตอนจบ batch (drawCarriedSlugs) โดยตัดขอบไม่ให้ล้นออกนอกช่องเปิด
       คนถือกล่องเปล่ามารับซื้อ (พ่อค้ารับเหมา) ไม่มี carrySlug = ตู้ว่างตามเดิม */
    if(p.carrySlug){
      /* ⚠️ เก็บเป็น "พิกัดโลก" ไม่ใช่พิกัดจอ แล้วไปฉายตอนวาด (drawCarriedSlugs)
         เพราะท่าทางคนถูกแคช (poseKey) ใช้ซ้ำหลายเฟรม ถ้าฉายลงจอตรงนี้ ค่าจะค้างอยู่กับกล้องตอนที่สร้างท่า
         และต้องแนบไปกับ _drawPose ด้วย ไม่งั้นเฟรมที่ใช้ท่าจากแคชจะไม่มีตู้ให้วาด = ทากกระพริบ */
      carryQuad=[[x0,z1],[x1,z1],[x1,z0],[x0,z0]].map(([mx,mz])=>world([mx,y1,mz]));
      carryCm=2*CARRY_HW*p.hCm;
    }
    // โครงกรอบหน้า 4 ด้าน (เปิดโล่งตรงกลาง)
    for(const [a,b] of [[[x0,y1,z0],[x1,y1,z0]],[[x0,y1,z1],[x1,y1,z1]],[[x0,y1,z0],[x0,y1,z1]],[[x1,y1,z0],[x1,y1,z1]]])
      limb(a,b,.006,.006,frame);
  }

  if(p.bagged){
    emit(fittedPersonBags(MDL).bag,[JT.hips[0]+sway,JT.hips[1],JT.hips[2]+bob],null,1,lean,[pelvisA,thoraxA]);
  }
  /* หมวกนักสะสม — ปีกกว้างแบน ๆ + ทรงกระบอกเตี้ย วางตามตำแหน่งหัวจริง (headAt) จึงขยับตามหัวทุกท่า
     ใช้ rings() ชุดเดียวกับเป้สะพาย ไม่ได้เพิ่มโมเดลใหม่ (ทากทาเลไม่มีชิ้นส่วนหมวกในไฟล์โมเดล) */
  if(p.accessory==='hat'){
    const fit=fittedPersonHat(MDL,hairSet[hairKey]),hx=headAt[0]*bw,hy=headAt[1],hz=headAt[2];
    const rx=fit.rx*bw,ry=fit.ry,bz=hz+fit.base,tz=hz+fit.top;
    rings([[hx,hy,bz,rx,ry],[hx,hy,bz+.004,rx+.027,ry+.024],[hx,hy,bz+.011,rx+.027,ry+.024],
           [hx,hy,bz+.014,rx,ry],[hx,hy,tz-.006,rx,ry],[hx,hy,tz,rx*.96,ry*.96]],p.hatColor||'#3d3350',10);
  }
  if(p.accessory==='backpack'){
    emit(fittedPersonBags(MDL).backpack,[JT.hips[0]+sway,JT.hips[1],JT.hips[2]+bob],null,1,lean,[pelvisA,thoraxA]);
  }
  _poseBudget--;p._poseAllow=false;                 // ใช้โควตา "สร้างท่าใหม่" ของเฟรมนี้ไปหนึ่ง
  p._poseJit=(Math.random()-0.5)*0.3;                     // คาบถัดไปเหลื่อมจากคนอื่นเล็กน้อย ไม่ให้กลับมาตรงกันอีก
  /* คลี่เป็นบล็อกสามเหลี่ยม Float32 ตรงนี้ครั้งเดียว — เฟรมถัด ๆ ไปใช้บล็อกนี้ซ้ำจนกว่าท่าจะเปลี่ยน
     faces ยังเก็บไว้เพราะ hit test (ตอนคลิก) ใช้ตรวจว่าคลิกโดนตัวคนจริงไหม ไม่มีต้นทุนต่อเฟรม */
  const flat=poseVertsOf(faces);_poseBuilds++;
  p._drawPose={key:poseKey,shape:shapeKey,x:p.x,y:p.y,faces,verts:flat.verts,tris:flat.tris,carryQuad,carryCm,t:_peopleT};
  if(carryQuad)_carriedSlugs.push({p,quad:carryQuad,cm:carryCm});
  _personBatch?.push(p);
}

/* ---------- ปุ่มเปิด/ปิดลูกค้า ---------- */
function syncPeopleBtn(){
  syncVisitorHUD();
  const b = document.getElementById('bPeople'); if(!b) return;
  b.textContent = peopleOn ? '🟢 ร้านเปิดอยู่ · กดปิดร้าน' : '🔒 ร้านปิดอยู่ · กดเปิดร้าน';
  syncShopStatus();
}
(function wirePeople(){
  const b = document.getElementById('bPeople'); if(!b) return;
  b.onclick = () => {
    if(!peopleOn){const issue=shopOpeningIssue();if(issue){shopStatusReason=issue;syncShopStatus();toast(issue,'bad');return;}}
    peopleOn = !peopleOn;shopStatusReason=''; _pLast = 0;
    if(!peopleOn){PEOPLE.length = 0;_openingRemaining=0;_openingParty=null;}              // ปิดแล้วเคลียร์ทิ้ง เปิดใหม่ค่อยเดินเข้ามาใหม่
    else { _openingRemaining=null;_openingParty=null;_openingAt=0; _doorFreeAt=0; _peopleT = 0; _spawnAt = 0.3; _partySequence=0; _arrivalScore=null; _pendingParty=null; _arrivalRetryAt=0; }
    syncPeopleBtn();if(typeof saveGame==='function')saveGame();
  };
  syncPeopleBtn();
})();




let nextYieldCheck=0;
let _doorClearAt=0;
function clearDoorWaiters(){
 if(_peopleT<_doorClearAt)return;_doorClearAt=_peopleT+.5;
 for(const p of PEOPLE){
  if(!['look','wait'].includes(p.state)||p.family?.stage==='leave'||!inDoorWalkway(p.x,p.y))continue;
  const candidates=[];
  for(const radius of [8,16,24,32])for(let i=0;i<8;i++){const a=i*Math.PI/4,s={x:p.x+Math.cos(a)*radius,y:p.y+Math.sin(a)*radius};if(!inDoorWalkway(s.x,s.y)&&!personBlocked(s.x,s.y)&&!spotTaken(s.x,s.y,p))candidates.push(s);}
  for(const target of candidates){const route=personRoute(p,target);if(!route.length)continue;
   p._yieldResume={state:'wait',remaining:0};p.tgt=target;p.route=route;p.routeGoal=target;p.state='walk';p.t=0;
   p._columnHold=false;p._yieldWaitUntil=0;p._routeRetryAt=0;p._pathRetryAt=0;
   if(p.family){p._familyGoal=target;p.family.replan=true;}else{p._yieldResume=null;p.focus=null;}
   break;
  }
 }
}
function stepVisitorYielding(){
  if(_peopleT<nextYieldCheck)return;nextYieldCheck=_peopleT+.25;
  for(const p of PEOPLE){
    if(p._yieldResume&&p.t>8){const saved=p._yieldResume;p._yieldResume=null;p.state=saved.state;p.lookT=saved.remaining;p.t=0;p.tgt={x:p.x,y:p.y};}
    if(p._yieldResume||p.tradeOffer||!p.focus||!['look','wait'].includes(p.state))continue;
    const passer=PEOPLE.find(q=>q!==p&&q.state==='walk'&&q.tgt&&Math.hypot(q.x-p.x,q.y-p.y)<18&&(()=>{
      const goal=q.route?.[0]||q.tgt,dx=goal.x-q.x,dy=goal.y-q.y,t=Math.max(0,Math.min(1,((p.x-q.x)*dx+(p.y-q.y)*dy)/(dx*dx+dy*dy||1)));
      return Math.hypot(p.x-q.x-dx*t,p.y-q.y-dy*t)<6.5;
    })());
    if(!passer)continue;
    const spots=accessibleTankSpots(p.focus).filter(s=>Math.hypot(s.x-p.x,s.y-p.y)>1&&Math.hypot(s.x-passer.x,s.y-passer.y)>7).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
    for(const target of spots){
      if(spotTaken(target.x,target.y,p))continue;
      const route=personRoute(p,target);if(!route.length||!crowdClear(p,route[0],p))continue;
      p._yieldResume={state:p.state,remaining:Math.max(0,p.lookT-p.t)};
      p.tgt=target;p.route=route;p.routeGoal=target;p.state='walk';p.t=0;p.stuck=0;p.action='watch';
      // The approaching person briefly gives them room to step aside.
      passer._yieldWaitUntil=_peopleT+.45;break;
    }
  }
}

function stopRegroup(p){
  if(!p._regroup)return;
  p.tgt=p._regroup.destination;p.route=[];p.routeGoal=null;p._regroup=null;p.stuck=0;
}
function stepGroupRegroup(){
  for(const p of PEOPLE){
    const g=p.family;
    if(!g||g._column||g.firstArrivedAt!=null||g.stage!=='walk'||p._yieldResume||p.tradeOffer){stopRegroup(p);continue;}
    let leader=p._regroup?.leader;
    if(leader&&(!PEOPLE.includes(leader)||Math.hypot(leader.x-p.x,leader.y-p.y)<10)){stopRegroup(p);continue;}
    if(!leader){
      if(!p.tgt||!['walk','leave'].includes(p.state))continue;
      const dx=p.tgt.x-p.x,dy=p.tgt.y-p.y,n=Math.hypot(dx,dy)||1;
      leader=g.members.filter(q=>q!==p&&Math.hypot(q.x-p.x,q.y-p.y)>14&&((q.x-p.x)*dx+(q.y-p.y)*dy)/n>10).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
      if(!leader)continue;
    }
    if(p._regroup&&_peopleT<p._regroup.next)continue;
    const dx=leader.x-p.x,dy=leader.y-p.y,gap=Math.hypot(dx,dy);
    // Approach the nearest member, leaving room behind them, not the remote tank.
    const target={x:leader.x-dx/gap*8,y:leader.y-dy/gap*8};
    const route=personRoute(p,target);let length=0,prev=p;for(const q of route){length+=Math.hypot(q.x-prev.x,q.y-prev.y);prev=q;}
    if(!route.length||length>gap*1.6+8){stopRegroup(p);continue;}
    p._regroup ||= {leader,destination:p.tgt};p._regroup.next=_peopleT+.35;
    p.tgt=target;p.route=route;p.routeGoal=target;p.stuck=0;
  }
}




// Keep the complete hand/forearm on the visitor's side of nearby furniture.
function constrainVisitorArm(p,joints,toWorld,H,right,fx,fy){
  for(const o of G.objs){
    if(o===moving)continue;
    const x0=o.cx,x1=x0+oW(o),y0=o.cy,y1=y0+oH(o),margin=.9;
    const sides=[];
    if(p.x<=x0)sides.push({axis:0,edge:x0-margin,sign:-1,d:x0-p.x});
    if(p.x>=x1)sides.push({axis:0,edge:x1+margin,sign:1,d:p.x-x1});
    if(p.y<=y0)sides.push({axis:1,edge:y0-margin,sign:-1,d:y0-p.y});
    if(p.y>=y1)sides.push({axis:1,edge:y1+margin,sign:1,d:p.y-y1});
    sides.sort((a,b)=>a.d-b.d);const side=sides[0];if(!side||side.d>H*.35)continue;
    const tangent=side.axis===0?p.y:p.x,lo=side.axis===0?y0:x0,hi=side.axis===0?y1:x1;
    if(tangent<lo-H*.25||tangent>hi+H*.25)continue;
    const top=(o.type==='tank'?tankStandH(o.def)+tankGlassH(o.def):decoH(o))/ZUNIT;
    for(const joint of joints){const world=toWorld(joint),v=world[side.axis];
      // Do not constrain against an infinite plane outside the actual cabinet.
      if(world[2]>top+.9||world[2]<-.9||world[0]<x0-margin||world[0]>x1+margin||world[1]<y0-margin||world[1]>y1+margin)continue;
      if((v-side.edge)*side.sign>=0)continue;
      const delta=side.edge-v,dx=side.axis===0?delta:0,dy=side.axis===1?delta:0;
      joint[0]+=(dx*right[0]+dy*right[1])/H;joint[1]+=(dx*fx+dy*fy)/H;
    }
  }
}


function endFamilyColumn(g){
  const column=g._column;if(!column)return;
  for(const p of column.order){
    p._columnFollower=false;p._columnHold=false;
    if(column.goals.has(p)){p.tgt=column.goals.get(p);p.route=[];p.routeGoal=null;p.state=g.stage==='leave'?'leave':'walk';p.stuck=0;}
  }
  g._column=null;g._columnCooldown=_peopleT+2;
}
function columnPinch(p){
  if(!p.tgt)return false;
  const goal=p.route?.[0]||p.tgt,dx=goal.x-p.x,dy=goal.y-p.y,n=Math.hypot(dx,dy)||1;
  const x=p.x+dx/n*4,y=p.y+dy/n*4;
  return personBlocked(x-dy/n*8,y+dx/n*8)||personBlocked(x+dy/n*8,y-dx/n*8);
}
function stepFamilyColumns(dt){
  const groups=new Set(PEOPLE.map(p=>p.family).filter(Boolean));
  for(const g of groups){
    if(g.firstArrivedAt!=null||g.stage!=='walk'||g.members.some(p=>p.tradeOffer||p._yieldResume)){endFamilyColumn(g);continue;}
    if(!g._column){
      if(_peopleT<(g._columnCooldown||0)||!g.members.some(p=>p.stuck>.35||columnPinch(p)))continue;
      for(const p of g.members)stopRegroup(p);
      const available=g.members.slice().sort((a,b)=>Math.hypot(a.x-a.tgt.x,a.y-a.tgt.y)-Math.hypot(b.x-b.tgt.x,b.y-b.tgt.y));
      const order=[available.shift()];
      while(available.length){const ahead=order[order.length-1];available.sort((a,b)=>Math.hypot(a.x-ahead.x,a.y-ahead.y)-Math.hypot(b.x-ahead.x,b.y-ahead.y));order.push(available.shift());}
      const leader=order[0];g._column={order,goals:new Map(order.map(p=>[p,p.tgt])),trail:[{x:leader.x,y:leader.y}],clear:0};
      order.forEach((p,i)=>{p._columnFollower=i>0;p._columnHold=i>0;p.stuck=0;});
    }
    const c=g._column,leader=c.order[0],last=c.trail[c.trail.length-1];
    if(Math.hypot(leader.x-last.x,leader.y-last.y)>.7)c.trail.push({x:leader.x,y:leader.y});
    if(c.trail.length>100)c.trail.shift();
    const settled=leader.state==='wait'||Math.hypot(leader.x-c.goals.get(leader).x,leader.y-c.goals.get(leader).y)<1;
    c.clear=c.order.some(columnPinch)?0:c.clear+dt;
    if((settled&&c.order.every((p,i)=>i===0||Math.hypot(p.x-leader.x,p.y-leader.y)<9*i+3))||c.clear>2){endFamilyColumn(g);continue;}
    for(let i=1;i<c.order.length;i++){
      const p=c.order[i],ahead=c.order[i-1];let distance=0,target=null;
      for(let j=c.trail.length-1;j>0;j--){const a=c.trail[j],b=c.trail[j-1],len=Math.hypot(a.x-b.x,a.y-b.y);if(distance+len>=i*8){const f=(i*8-distance)/(len||1);target={x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};break;}distance+=len;}
      if(!target&&settled)target=c.trail[0];
      p._columnHold=!target||Math.hypot(p.x-ahead.x,p.y-ahead.y)<7;
      if(p._columnHold)continue;
      if(!p.tgt||Math.hypot(p.tgt.x-target.x,p.tgt.y-target.y)>1){
        // Following sampled footsteps preserves the leader's turns around tanks.
        const route=personRoute(p,target);if(!route.length){p._columnHold=true;continue;}
        p.tgt=target;p.route=route;p.routeGoal=target;p.state=g.stage==='leave'?'leave':'walk';p.stuck=0;
      }
    }
  }
}




// Short right-hand bypass, reconnecting to the original first segment.
function rightVisitorBypass(p,route){
  if(!route.length)return [];
  const end=route[0],dx=end.x-p.x,dy=end.y-p.y,d=Math.hypot(dx,dy);if(d<1)return [];
  const fx=dx/d,fy=dy/d,rx=fy,ry=-fx;
  for(const advance of [10,18,26])for(const width of [7,10]){
    const n=Math.min(d,advance),a={x:p.x+rx*width,y:p.y+ry*width};
    const join={x:p.x+fx*n,y:p.y+fy*n},b={x:join.x+rx*width,y:join.y+ry*width};
    if(crowdClear(p,a,p)&&crowdClear(a,b,p)&&crowdClear(b,join,p))return [a,b,join,...route];
  }return [];
}
function visitorTravelHeading(p){
  if(p._asideUntil>_peopleT&&p._asideHeading)return p._asideHeading;
  const goal=p.route?.find(v=>Math.hypot(v.x-p.x,v.y-p.y)>1)||p.tgt;
  const dx=goal?goal.x-p.x:p.fdx,dy=goal?goal.y-p.y:p.fdy,n=Math.hypot(dx,dy);
  return n>.001?{x:dx/n,y:dy/n}:{x:p.fdx||1,y:p.fdy||0};
}
function askVisitorToStepAside(p,route){
  if(!route.length||p._asideUntil>_peopleT)return false;
  const end=route[0],dx=end.x-p.x,dy=end.y-p.y,d=Math.hypot(dx,dy);if(d<1)return false;
  const fx=dx/d,fy=dy/d;
  const q=peopleInArea(p.x-14,p.y-14,p.x+14,p.y+14).find(q=>q!==p&&!(p.family===q.family&&p.family&&visitorTravelHeading(q).x*fx+visitorTravelHeading(q).y*fy>.4)&&!q.tradeOffer&&!q._yieldResume&&!q._columnFollower&&['walk','leave'].includes(q.state)&&!(q._asideUntil>_peopleT)&&Math.hypot(q.x-p.x,q.y-p.y)<12&&(q.x-p.x)*fx+(q.y-p.y)*fy>0);
  if(!q)return false;
  const heading=visitorTravelHeading(q);
  // Each visitor yields to their own right, including oncoming traffic.
  // If that side is blocked, wait rather than switch into the other lane.
  for(const width of [7,10]){
    const spot={x:q.x+heading.y*width,y:q.y-heading.x*width};
    if(!crowdClear(q,spot,q))continue;
    // Preserve the destination and existing route; turn and walk the sidestep.
    q._asideHeading=heading;q.route=[spot,...(q.route||[])];q.routeGoal=q.tgt;q._asideUntil=_peopleT+2;
    q._routeRetryAt=0;q._yieldWaitUntil=0;q._blockedRouteAt=_peopleT+1;
    p._yieldWaitUntil=_peopleT+.6;p._asideUntil=_peopleT+2;return true;
  }
  // No room for a step: stand side-on with a 25 cm collision diameter.
  q._squeezeFacing={x:heading.y,y:-heading.x};q._squeezeUntil=_peopleT+1.5;
  q._yieldWaitUntil=q._squeezeUntil;q._asideUntil=q._squeezeUntil;
  p._asideUntil=_peopleT+1.5;
  return true;
}

function followingMovingRelative(p){
  if(!p.family||!['walk','leave'].includes(p.state))return false;
  const h=visitorTravelHeading(p);
  return p.family.members.some(q=>{
    if(q===p||!['walk','leave'].includes(q.state)||!(q.motion>.1)||q._yieldWaitUntil>_peopleT)return false;
    const dx=q.x-p.x,dy=q.y-p.y,along=dx*h.x+dy*h.y;
    const other=visitorTravelHeading(q);
    return along>0&&along<7&&Math.abs(dx*h.y-dy*h.x)<4&&other.x*h.x+other.y*h.y>.6;
  });
}
function updateBlockedVisitor(p,dt,distance){
  // Let a moving family member ahead advance instead of ordering them to stop.
  if(distance<.01&&followingMovingRelative(p)){p._yieldWaitUntil=_peopleT+.15;p._blockedFor=0;return;}
  const goal=p._familyGoal||p.tgt;
  const trying=['walk','leave'].includes(p.state)&&goal&&Math.hypot(p.x-goal.x,p.y-goal.y)>1;
  if(p._angryUntil>_peopleT){p._blockedFor=0;return;}
  p._blockedFor=trying&&distance<.01?(p._blockedFor||0)+dt:0;
  if(p._blockedFor>3){
    if(p.family?._column)endFamilyColumn(p.family);
    if(p.family)p.family._columnCooldown=_peopleT+6;
    stopRegroup(p);p._columnHold=false;p._columnFollower=false;p._yieldWaitUntil=0;p._routeRetryAt=0;p._pathRetryAt=0;
    p._angryUntil=_peopleT+2;p._blockedFor=0;p.stuck=0;
    p.route=personRoute(p,p.tgt);p.routeGoal=p.tgt;return;
  }
  if(p._blockedFor>0&&_peopleT>=(p._blockedRouteAt||0)){
    p._blockedRouteAt=_peopleT+.5;
    const route=personRoute(p,p.tgt);p.routeGoal=p.tgt;p._pathRetryAt=_peopleT+.5;
    if(route.length){
      if(crowdClear(p,route[0],p)){p.route=route;return;}
      const right=rightVisitorBypass(p,route);
      if(right.length){p.route=right;return;}
      if(askVisitorToStepAside(p,route)){p.route=route;return;}
      const detour=crowdRoute(p,p.tgt);p.route=detour.length?detour:route;
    }
  }
}
function drawVisitorAnger(){
  for(const p of PEOPLE){if(!(p._angryUntil>_peopleT)||!personOnScreen(p))continue;
    const q=P(p.x,p.y,p.hCm/CM_PER_CELL*ZUNIT*1.09),size=Math.max(15,Math.min(30,p.hCm/CM_PER_CELL*ZUNIT*cam.zoom*.1));
    ctx.save();ctx.font=size+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ff645d';ctx.fillText('💢',q.x,q.y);ctx.restore();
  }
}


/* ตัวนับสำหรับตรวจแคชเรขาคณิต (คู่มือบท 10: "mesh builds ระหว่างแพน/ซูมควรเป็นศูนย์")
   ใช้จากคอนโซล: PeoplePerf.geoBuilds ก่อน/หลังแพนกล้อง ต้องเท่ากัน */
window.PeoplePerf={
  get geoBuilds(){return _geoBuilds;},
  get geoCached(){return _geoCache.size;},
  get poseBuilds(){return _poseBuilds;},      // จำนวนครั้งที่สร้างท่าใหม่ (ตัวเลขที่ป้าย FPS โชว์เป็น "ท่าใหม่ /วิ")
  get poseBuffers(){return _poseBufs.size;},  // บัฟเฟอร์จุดยอดที่ยังถือไว้ ควรเท่ากับจำนวนคนที่เพิ่งอยู่ในจอ
  get workers(){return _poseWorkers.length;}, // เธรดช่วยสร้างท่า (0 = ทำบนเมนเธรดอย่างเดียว)
  counts(){return {ทั้งหมด:PEOPLE.length,ลูกค้า:customerCount(),นักแข่ง:challengerCount(),พ่อค้า:traderCount(),
                   ในจอ:PEOPLE.filter(p=>personEntered(p)&&personOnScreen(p)).length};}
};
function _bumpGeoBuilds(){_geoBuilds++;}   // cat-seller.js เรียกเมื่อทิ้งแคชรูปทรงบัง (ตัวเดียวกับที่ PeoplePerf รายงาน)

/* ตัวหมุนความคึกคักของร้าน — ปรับสดระหว่างเล่น ไม่ต้องรีเฟรช (people.js VISITOR_BANDS)
   ShopBusy.show() ดูว่าความนิยมเท่านี้ได้กี่คน · ShopBusy.set(20,5,6) แก้พื้น/เพดานของช่วงที่เริ่มที่ 20 */
window.ShopBusy={
  get bands(){return VISITOR_BANDS.map(b=>b.slice());},
  set(from,lo,hi){
    const f=Number(from),a=Math.round(Number(lo)),b=Math.round(Number(hi));
    if(!(f>=0)||!(a>=0)||!(b>=a)){console.warn('ใช้: ShopBusy.set(ความดึงดูดที่เริ่มช่วง, พื้น, เพดาน) · เพดานต้องไม่น้อยกว่าพื้น');return this.show();}
    const row=VISITOR_BANDS.find(r=>r[0]===f);
    if(row){row[1]=a;row[2]=b;}else{VISITOR_BANDS.push([f,a,b]);VISITOR_BANDS.sort((x,y)=>x[0]-y[0]);}
    if(typeof toast==='function')toast('ความคึกคัก: ดึงดูด '+f+'+ → '+a+'-'+b+' คน','good');
    return this.show();},
  show(){const cap=visitorCapacity();
    const rows=[0,10,19,20,40,49,50,79,80,119,120,200,400].map(s=>{const g=visitorBand(1e9,s),r=visitorBand(cap,s);
      return {'ความนิยม':s,'เป้าคน':g.lo+'-'+g.hi,'ได้จริงในร้านนี้':r.lo+'-'+r.hi};});
    console.table(rows);
    return {ช่วง:this.bands,พื้นที่ร้าน:floorArea(),'สูตรช่วงท้าย':'ความดึงดูด ÷ '+VISITOR_SCORE_DIV+' (ตั้งแต่ดึงดูด '+VISITOR_SCORE_FROM+')',
            ความจุร้าน:cap,ตอนนี้มีลูกค้า:customerCount(),rows};}
};
