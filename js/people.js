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
const WALK_STEP = 0.30;          // ความยาวก้าว เทียบส่วนสูง — จับคู่กับความเร็ว 0.88 ม./วิ ได้ cadence ~110 ก้าว/นาที (ตามตำราการเดินปกติ)
const WALK_LIFT = 0.034;         // ยกเท้าสูงสุดตอนก้าว เทียบส่วนสูง (~5.5 ซม. พ้นพื้นพอดี ยกตามก้าวที่ยาวขึ้น)
const PERSON_R        = 2.5;     // รัศมีกันชนกับตู้/ของ (ช่องเล็ก ≈ 16 ซม.)
const PERSON_EDGE     = 2.0;     // เว้นจากขอบพื้นร้าน (ช่องเล็ก)
const LOOK_MIN = 5, LOOK_MAX = 5;    // ยืนดูตู้นานแค่ไหน (วินาที)
const STROLL_MIN = 1, STROLL_MAX = 2;    // เดินเล่นกี่จุดคั่นระหว่างตู้
const VISIT_MIN = 2,  VISIT_MAX = 5;     // ดูกี่ตู้ก่อนกลับ
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
function doorSpot(){ return chosenDoorSpot(); }
/* คนที่ "อยู่ในของ" (โดนวางตู้ทับ / เกิดในกันชน) ต้องดันตัวเองออกมาให้ได้
   ไม่งั้นทุกก้าวโดนบล็อกหมดแล้วยืนค้างตลอดกาล */
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
  const n = Math.hypot(ex, ey);
  if(!n) return;
  const v = p.spd * 1.6 * dt;
  p.x += ex/n*v; p.y += ey/n*v;
  p.motion=1; p.fdx = ex; p.fdy = ey; /* Actual displacement drives gait below. */                    // เดินออกมาให้เห็นว่าขยับ
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
  return doorSpot();
}

/* ============================================================
   สร้างคน
   ============================================================ */
// A party owns its itinerary. Children never receive an independent destination.
let _partySequence=0;
function partySpots(anchor,count,party,edgeOnly=false,focus=null){
  const candidates=[anchor];
  const entrance=edgeOnly?entranceRect():null;
  if(edgeOnly){
    if(!entrance)return null;
    // Use a compact staging area inside the selected doorway for whole parties.
    candidates.length=0;
    for(const depth of [3,11])for(const along of [5,13]){
      candidates.push(G.door.side==='north'
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
function beginPersonBrowse(p){
  p.state='look';p.t=0;p.lookT=5;p._browseActed=false;
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
function visitorCapacity(){return Math.max(0,Math.floor(floorArea()/4));}
function visitorAttraction(){const slug=G.objs.reduce((n,o)=>n+(o.type==='tank'&&Array.isArray(o.slugs)?o.slugs.length*(typeof tankAttractionFactor==='function'?tankAttractionFactor(o):1):0),0);const deco=G.objs.reduce((n,o)=>n+((o.type==='deco'&&o._key!=='counter'&&o.def&&Number.isFinite(o.def.attr))?o.def.attr:0),0);const tankDeco=G.objs.reduce((n,o)=>n+((o.type==='tank'&&Array.isArray(o.decor))?o.decor.length*0.5:0),0);return Math.round((slug+deco+tankDeco)*10)/10;}
function visitorInterval(score){return Math.max(20,60-Math.max(0,Math.ceil(Math.max(0,score)/10)-1)*5);}
function chooseVisitorKind(capacity){
  const menu=[['solo',1,50],['couple',2,30],['family1',3,10],['family2',4,5],['parentChild',2,5]].filter(x=>x[1]<=capacity);
  if(!menu.length)return null;
  let roll=Math.random()*menu.reduce((sum,x)=>sum+x[2],0);
  for(const option of menu){roll-=option[2];if(roll<0)return option[0];}
  return menu[menu.length-1][0];
}
let _openingRemaining=null, _openingAt=0, _openingParty=null;
function openingVisitorCount(score,capacity){
  return Math.min(capacity,6,2+Math.floor(Math.max(0,score-1)/20));
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
  if(capacity-PEOPLE.length<count)return true;
  if(spawnVisitors(capacity-PEOPLE.length,_openingParty.kind,_openingParty.profiles)){
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
  if(_peopleT<_spawnAt)return;
  if(!_pendingParty){const kind=chooseVisitorKind(capacity);_pendingParty={kind,profiles:visitorProfiles(kind)};}
  if(capacity-PEOPLE.length<_pendingParty.profiles.length||_peopleT<_arrivalRetryAt)return;
  if(spawnVisitors(capacity-PEOPLE.length,_pendingParty.kind,_pendingParty.profiles)){
    _pendingParty=null;_spawnAt=_peopleT+visitorInterval(score);
  }else _arrivalRetryAt=_peopleT+1; // Entrance physically blocked: retain the same party.
}

function spawnVisitors(capacity,requestedKind=null,requestedProfiles=null){
  const kind=requestedKind||chooseVisitorKind(capacity);if(!kind)return false;
  const profiles=requestedProfiles||visitorProfiles(kind),count=profiles.length;if(count>capacity)return false;
  for(let attempt=0;attempt<15;attempt++){
    const door=doorSpot();if(!door)continue;
    const spots=partySpots(door,count,null,true);if(!spots)continue;
    const g=count>1?{kind,members:[],visits:2+((Math.random()*2)|0),stage:'new',time:0,replan:false}:null;
    const batch=[];
    for(let i=0;i<count;i++){
      const p=makePerson({...profiles[i],at:spots[i]});if(!p)break;
      p.family=g;if(g)p.spd=PERSON_SPEED_CM/CM_PER_CELL*(p.kid?1.04:.96);
      batch.push(p);
    }
    if(batch.length!==count)continue;
    if(g){g.members=batch;assignFamilyBuyer(batch);}PEOPLE.push(...batch);_partySequence++;return true;
  }
  return false;
}
function planFamily(g){
  endFamilyColumn(g);
  for(const p of g.members){stopRegroup(p);p._yieldResume=null;p._groupViewed=false;p._routeRetryAt=0;p._pathRetryAt=0;p.crowdCooldown=0;}
  g.firstArrivedAt=null;
  const leader=g.members[0],tanks=G.objs.filter(o=>o.type==='tank'&&o!==moving);
  const leaving=g.visits<=0||!tanks.length;
  const options=leaving?Array.from({length:16},()=>({spot:doorSpot(),focus:null})):
    (tanks.length>1?tanks.filter(o=>o!==g.focus):tanks).flatMap(o=>lookSpots(o).map(spot=>({spot,focus:o}))).sort(()=>Math.random()-.5);
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
  for(const p of g.members){p.state='wait';p.tgt={x:p.x,y:p.y};p.motion=0;}
  return false;
}
function stepFamilies(dt){
  const groups=new Set(PEOPLE.map(p=>p.family).filter(Boolean));
  for(const g of groups){
    if(g.members.some(p=>p.tradeOffer))continue;
    g.time+=dt;
    if(g.stage==='new'||g.replan&&g.time>2&&g.firstArrivedAt==null&&g.stage!=='look'){planFamily(g);continue;}
    if(g.focus&&(!G.objs.includes(g.focus)||g.focus===moving)){planFamily(g);continue;}
    const atDestination=p=>{const goal=p._familyGoal||p.tgt;return goal&&Math.hypot(p.x-goal.x,p.y-goal.y)<1.2;};
    const ready=g.members.filter(atDestination);
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
      for(const p of ready){p.state='wait';p.motion=0;}
      if(ready.length===g.members.length||g.time-g.firstArrivedAt>=2){
        g.stage='look';g.time=0;g.lookFor=5;
        for(const p of ready){beginPersonBrowse(p);p._groupViewed=true;p.lookT=Infinity;p.motion=0;}
      }
    }
    if(g.stage==='look'){
      for(const p of ready)if(!p._groupViewed){beginPersonBrowse(p);p._groupViewed=true;p.lookT=Infinity;p.motion=0;}
      if(g.time>=g.lookFor){
        if(g.members.some(p=>p._groupViewed&&p.t>=g.lookFor&&tryCustomerOffer(p,g.focus)))continue;
        g.visits--;planFamily(g);
      }
    }else if((g.stage==='walk'||g.stage==='leave')&&g.time>35&&g.firstArrivedAt==null){g.replan=true;}
  }
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
    wantsBuy: !kid && Math.random()<buyChance(),
    spd: (PERSON_SPEED_CM * (kid ? 1.15 : 0.9 + Math.random()*0.35)) / CM_PER_CELL,
    phase: Math.random()*6.283,
    idle: Math.random()*6.283,
    fdx: -1, fdy: -1,                    // ทิศที่หันหน้า (พิกัดพื้น)
    state: 'walk', t: 0, stuck: 0, lookT: 0,
    tgt: null, focus: null,
    visits: VISIT_MIN + ((Math.random()*(VISIT_MAX-VISIT_MIN+1))|0),
    strolls: 0,
    skin: pick1(P_SKIN), hair: pick1(kid?P_HAIR.filter(c=>c!=='#8a8f94'):P_HAIR), shirt: pick1(P_SHIRT), pants: pick1(P_PANTS),
    shoe: Math.random()<0.5 ? '#23262b' : '#3a2f28',
    lean: (Math.random()<0.5?-1:1) * (0.03 + Math.random()*0.05),
    build: (kid?0.87:gender==='female'?0.86:0.94) + Math.random()*0.16,
    hairStyle: (Math.random()*3)|0,
    accessory: kid ? pick1(['none','backpack','backpack']) : 'none',
    motion: 0, route: [], routeGoal: null,
    action: 'watch', actionT:0, actionDuration:0, headYaw:0, socialCooldown:1+Math.random()*4,
    bagged: !kid && Math.random() < 0.35,
    modelHair: gender==='female' ? pick1(['PonyTail','ShortHair_1','ShortHair_1']) : 'Hair',
    facial: (gender==='male'&&!kid) ? pick1(['none','none','none','Moustache','Beard','BeardFull']) : 'none',
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
  if(p._columnFollower)return;
  if(p._yieldResume)return;
  if(p.tradeOffer)return;
  if(p.family){if(p.family.firstArrivedAt!=null||p.family.stage==='look'){p.route=[];p._routeRetryAt=_peopleT+.5;p.stuck=0;return;}p.family.replan=true;return;}
  if(p.strolls > 0){                                   // เดินเล่นคั่นก่อน
    p.strolls--; p.focus = null; p.tgt = strollSpot(p); p.state = 'walk'; p.stuck = 0; return;
  }
  const tanks = G.objs.filter(o => o.type === 'tank' && o !== moving);
  if(p.visits > 0 && tanks.length){
    for(let i = 0; i < 6; i++){
      const o = tanks[(Math.random()*tanks.length)|0];
      if(o === p.focus && tanks.length > 1) continue;
      const s = freeSpot(lookSpots(o), p);
      if(s){ p.focus = o; p.tgt = s; p.state = 'walk'; p.stuck = 0; return; }
    }
    p.focus = null; p.tgt = strollSpot(p); p.state = 'walk'; p.stuck = 0; return;   // ตู้มีคนยืนเต็ม เดินเล่นรอ
  }
  p.focus = null; p.tgt = doorSpot(); p.state = 'leave'; p.stuck = 0;
}

/* ============================================================
   อัปเดตทุกเฟรม
   ============================================================ */
let _pLast = 0;
function stepPeople(){
  const now = performance.now();
  let dt = (now - (_pLast || now)) / 1000; _pLast = now;
  if(!peopleOn) return;
  if(dt > 0.05) dt = 0.05;
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
    p.t += dt; p.idle += dt;
    stepPersonLife(p,dt);
    p.motion *= Math.exp(-dt*12);
    if(!p.tgt) nextGoal(p);
    if(!p.tgt) continue;
    if(personBlocked(p.x, p.y)){ escapeBlocked(p, dt); continue; }   // ติดอยู่ในของ → ดันออกก่อน

    if(p.state==='wait') continue;
    if(p.state === 'look'){
      if(p.focus && G.objs.indexOf(p.focus) < 0){ nextGoal(p); continue; }   // ตู้ถูกย้ายหาย
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
      if(p._columnFollower){p.motion=0;continue;}
      if(p._regroup){stopRegroup(p);continue;}
      if(p._yieldResume){const resume=p._yieldResume;p._yieldResume=null;p.state=resume.state;p.lookT=resume.remaining;p.t=0;p.motion=0;continue;}
      if(p.tradeOffer){p.state='wait';p.motion=0;p.tradeOffer.arrived=true;const c=p.tradeOffer.counter;p.fdx=c.cx+oW(c)/2-p.x;p.fdy=c.cy+oH(c)/2-p.y;renderTradeOffers();continue;}
      if(p.family){p.state='wait';p.t=0;p.lookT=Infinity;p.motion=0;continue;}
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
  for(const p of PEOPLE){
    const distance=Math.hypot(p.x-(p._stepX??p.x),p.y-(p._stepY??p.y));
    updateBlockedVisitor(p,dt,distance);
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
function personFurnitureFaces(){
  const out=[];
  for(const o of G.objs){
    if(o===moving)continue;
    const x=o.cx,y=o.cy,w=oW(o),h=oH(o);
    const top=(o.type==='tank'?tankStandH(o.def):decoH(o))/ZUNIT;
    if(!Number.isFinite(top)||top<=0)continue;
    const a=[x,y,0],b=[x+w,y,0],c=[x+w,y+h,0],d=[x,y+h,0];
    const A=[x,y,top],B=[x+w,y,top],C=[x+w,y+h,top],D=[x,y+h,top];
    for(const v of [[A,B,C,D],[a,b,B,A],[b,c,C,B],[c,d,D,C],[d,a,A,D]])out.push(v);
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

function endPersonBatch(){
  const faces=_personBatch;_personBatch=null;
  if(faces&&faces.length)paintPersonMesh(faces,{x:0,y:0},Math.max(100,cellsW()+cellsH()));
  drawVisitorAnger();
}

function personScreenBounds(p){
  const h=p.hCm/CM_PER_CELL,z=cam.zoom,b=P(p.x,p.y,0),rx=h*TW*z*.55;
  return{x0:b.x-rx-4,x1:b.x+rx+4,y0:b.y-h*(ZUNIT+TH*.55)*z-4,y1:b.y+h*TH*z*.55+4};
}
function personOnScreen(p){const r=personScreenBounds(p);return r.x1>=0&&r.x0<=CW&&r.y1>=0&&r.y0<=CH;}
let _personBounds=null,_personVertexData=new Float32Array(65536);
function beginPersonBatch(visitors){
  _personBatch=[];_personBounds=null;
  if(visitors?.length){const r={x0:CW,y0:CH,x1:0,y1:0};for(const p of visitors){const b=personScreenBounds(p);r.x0=Math.min(r.x0,b.x0);r.y0=Math.min(r.y0,b.y0);r.x1=Math.max(r.x1,b.x1);r.y1=Math.max(r.y1,b.y1);}_personBounds=r;}
}
function paintPersonMesh(faces,p,H,snapshot=false){
  if(_personBatch){for(const f of faces)_personBatch.push(f);return;}
  if(!faces.length)return;
  if(!_personGL){
    const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true});
    if(!gl)throw Error('WebGL is required for character depth rendering');
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    const program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 pos;attribute vec3 color;uniform vec4 clipX;uniform vec4 clipY;uniform vec4 clipZ;varying vec3 tint;void main(){vec4 v=vec4(pos,1.0);gl_Position=vec4(dot(v,clipX),dot(v,clipY),dot(v,clipZ),1.0);tint=color;}'));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform float opacity;varying vec3 tint;void main(){gl_FragColor=vec4(tint*opacity,opacity);}'));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    _personGL={canvas,gl,program,buffer:gl.createBuffer(),pos:gl.getAttribLocation(program,'pos'),color:gl.getAttribLocation(program,'color'),clipX:gl.getUniformLocation(program,'clipX'),clipY:gl.getUniformLocation(program,'clipY'),clipZ:gl.getUniformLocation(program,'clipZ'),opacity:gl.getUniformLocation(program,'opacity')};
  }
  const {canvas,gl,program,buffer,pos,color,clipX,clipY,clipZ,opacity}=_personGL,origin=snapshot?{x:0,y:0}:P(0,0,0),z=snapshot?1:cam.zoom;
  let bounds=_personBounds;
  if(!bounds){bounds={x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity};for(const f of faces)for(const v of f.v){const x=origin.x+(v[0]-v[1])*TW*z,y=origin.y+(v[0]+v[1])*TH*z-v[2]*ZUNIT*z;bounds.x0=Math.min(bounds.x0,x);bounds.x1=Math.max(bounds.x1,x);bounds.y0=Math.min(bounds.y0,y);bounds.y1=Math.max(bounds.y1,y);}}
  const x0=snapshot?Math.floor(bounds.x0)-2:Math.max(0,Math.floor(bounds.x0)-2),y0=snapshot?Math.floor(bounds.y0)-2:Math.max(0,Math.floor(bounds.y0)-2),x1=snapshot?Math.ceil(bounds.x1)+2:Math.min(CW,Math.ceil(bounds.x1)+2),y1=snapshot?Math.ceil(bounds.y1)+2:Math.min(CH,Math.ceil(bounds.y1)+2),w=x1-x0,h=y1-y0;
  if(w<=0||h<=0)return;
  const scale=snapshot?1:Math.min(2,window.devicePixelRatio||1),width=Math.ceil(w*scale),height=Math.ceil(h*scale);
  if(canvas.width<width)canvas.width=Math.ceil(width/128)*128;if(canvas.height<height)canvas.height=Math.ceil(height/128)*128;
  const blockers=personFurnitureFaces(!snapshot),glass=[];
  for(const o of G.objs){if(o.type!=='tank'||o===moving||(!snapshot&&!onScreen(o)))continue;
    const x=o.cx,y=o.cy,w=oW(o),h=oH(o),lo=tankStandH(o.def)/ZUNIT,hi=lo+tankGlassH(o.def)/ZUNIT;
    glass.push([[x,y,hi],[x+w,y,hi],[x+w,y+h,hi],[x,y+h,hi]],[[x+w,y,lo],[x+w,y+h,lo],[x+w,y+h,hi],[x+w,y,hi]],[[x,y+h,lo],[x+w,y+h,lo],[x+w,y+h,hi],[x,y+h,hi]]);
  }
  const total=faces.reduce((n,f)=>n+(f.v.length-2)*18,0)+(blockers.length+glass.length)*36;
  if(_personVertexData.length<total)_personVertexData=new Float32Array(2**Math.ceil(Math.log2(total)));
  let at=0;const data=_personVertexData;
  const push=(vs,r,g,b)=>{for(let i=1;i<vs.length-1;i++)for(const j of [0,i,i+1]){const v=vs[j];data[at++]=v[0];data[at++]=v[1];data[at++]=v[2];data[at++]=r;data[at++]=g;data[at++]=b;}};
  for(const vs of blockers)push(vs,0,0,0);const maskCount=at/6;
  for(const f of faces)push(f.v,f.rgb[0]/255,f.rgb[1]/255,f.rgb[2]/255);const opaqueEnd=at/6;
  for(const vs of glass)push(vs,.48,.66,.71);
  gl.viewport(0,canvas.height-height,width,height);gl.disable(gl.BLEND);gl.depthMask(true);gl.colorMask(true,true,true,true);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);gl.uniform1f(opacity,1);gl.uniform4f(clipX,TW*z*2/w,-TW*z*2/w,0,(origin.x-x0)*2/w-1);gl.uniform4f(clipY,-TH*z*2/h,-TH*z*2/h,ZUNIT*z*2/h,1-(origin.y-y0)*2/h);gl.uniform4f(clipZ,-.025/H,-.025/H,-.025/H,(p.x+p.y)*.025/H);
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

// Fixed upper-arm and forearm lengths; gestures move the joints, never stretch them.
function solvePersonArm(shoulder,wantedHand,preferredElbow,maxReach=.215,upper=maxReach/2,lower=maxReach/2){
  const delta=wantedHand.map((x,i)=>x-shoulder[i]);
  const raw=Math.hypot(...delta),distance=Math.max(.035,Math.min(maxReach,raw));
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

function drawPerson(p){
  if(!personOnScreen(p))return;
  // Camera movement does not change a person's world-space geometry.
  // Reuse idle poses at 12 Hz and moving/gesturing poses at 30 Hz;
  // position is translated every frame so walking remains smooth.
  const poseRate=(p.motion>.05||p.action!=='watch')?30:12;
  const poseKey=[Math.floor(p.idle*poseRate),p.action==='watch'?0:Math.round((p.actionT||0)*30),Math.round((p.catchupBoost||1)*10),Math.round(p.phase*20),Math.round((p.motion||0)*20),Math.round(p.fdx*100),Math.round(p.fdy*100),Math.round((p.headYaw||0)*100),p.action,p.state,p._squeezeUntil>_peopleT?1:0,p.focus?.id,['point','crouch'].includes(p.action)?Math.round(p.x*20):0,['point','crouch'].includes(p.action)?Math.round(p.y*20):0,p.hCm,p.outfit,p.hairCut,p.shirt,p.pants,p.skin,p.hair,p.bagged,p.accessory,p.modelHair,p.facial].join('|');
  if(p._drawPose&&p._drawPose.key===poseKey){
    const cached=p._drawPose,dx=p.x-cached.x,dy=p.y-cached.y;
    const faces=dx||dy?cached.faces.map(f=>({rgb:f.rgb,v:f.v.map(v=>[v[0]+dx,v[1]+dy,v[2]])})):cached.faces;
    paintPersonMesh(faces,p,p.hCm/CM_PER_CELL);return;
  }
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
  const gait=Math.sin(phase)*motion*Math.min(1,Math.max(.25,clearance/6));
  let bob=0;                       // ตัวขึ้น-ลงตามจังหวะก้าว คำนวณจริงหลังรู้ความยาวขา (ดูบล็อกโมเดล)
  const breath=Math.sin(p.idle*1.6)*0.0015;
  const action=p.action||'watch';
  const gesture=action==='watch'?0:Math.sin(Math.PI*Math.min(1,(p.actionT||0)/(p.actionDuration||1)));
  const actionProgress=Math.min(1,(p.actionT||0)/(p.actionDuration||1));
  const jump=action==='jump'&&p.kid?Math.max(0,Math.sin(actionProgress*Math.PI*4))*.07:0;
  const crouch=action==='crouch'?Math.min(gesture,Math.max(0,(clearance/H-.14)/.5)):0;
  let posedArms=false;
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
  const lean=runLean+(p.state==='look'?0.012+Math.sin(p.idle*.65)*.003:0.004*motion)+(action==='lean'?gesture*.026:0);
  const shift=p.state==='look'?Math.sin(p.idle*.65)*.003:0;
  function world(v){
    v=[v[0]+shift*Math.min(1,v[2]/.5),v[1]+(action==='lean'?gesture*.026*Math.max(0,v[2]-.5):0),v[2]];
    if(v[2]>HEADCUT){
      const x=v[0],y=v[1]-(lean+.009);
      v[0]=x*_yawC-y*_yawS;v[1]=lean+.009+x*_yawS+y*_yawC;
      v[2]+=_nodZ;
    }
    if(!posedArms&&crouch&&v[2]>HEADCUT){const y=v[1]-lean,z=v[2]-HEADCUT,a=-.65*crouch;v[1]=lean+y*Math.cos(a)+z*Math.sin(a);v[2]=HEADCUT+z*Math.cos(a)-y*Math.sin(a);}
    if(!posedArms)v=inspectPose(v);
    /* เด็ก: ขาสั้นลงนิด หัวดูโตขึ้นโดยไม่ต้องมีโมเดลแยก */
    const z=p.kid?(v[2]<HIPZ?v[2]*.93:v[2]-HIPZ*.07):v[2];
    return [p.x+(right[0]*v[0]+fx*v[1])*H,p.y+(right[1]*v[0]+fy*v[1])*H,(z+jump)*H];
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
      v=[v[0],v[2],v[1]];norm=norm.map(x=>-x);
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
  const MDL=PEOPLE_MODEL[p.gender==='female'?'female':'male'], JT=MDL.joints;
  const SLOTC={skin:p.skin,shirt:p.shirt,pants:p.pants,shoe:p.shoe,hair:p.hair,dark:'#2b2622',white:'#efeadd'};
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
  /* วางชิ้นส่วนหนึ่งชิ้น: หมุน → ยืดตามความยาวข้อต่อ → ย้ายไปข้อต่อ → แปลงเป็นพิกัดโลก → ปั๊มสามเหลี่ยม
     ไม่เรียก face() ทีละสามเหลี่ยมเพราะจะเรียก world() ซ้ำ 3 เท่า (เวอร์เท็กซ์หนึ่งตัวใช้ร่วมกันหลายหน้า)
     แปลงทีละเวอร์เท็กซ์ครั้งเดียวแล้วค่อยประกอบหน้า เร็วกว่า ~3 เท่า */
  const _W=[];
  function emit(part,at,rot,stretch,shear){
    if(!part) return;
    const v=part.v,t=part.t,n=v.length/3,ax=part.axis,st=(stretch&&stretch!==1&&ax)?stretch-1:0;
    const sh=shear||0, span=NECKZ-HIPZ;
    for(let i=0;i<n;i++){
      let x=v[i*3],y=v[i*3+1],z=v[i*3+2];
      if(st){const d=(x*ax[0]+y*ax[1]+z*ax[2])*st;x+=ax[0]*d;y+=ax[1]*d;z+=ax[2]*d;}
      if(rot){const nx=rot[0]*x+rot[1]*y+rot[2]*z,ny=rot[3]*x+rot[4]*y+rot[5]*z,nz=rot[6]*x+rot[7]*y+rot[8]*z;x=nx;y=ny;z=nz;}
      const wz=at[2]+z;
      _W[i]=world([at[0]+x*bw, at[1]+y+(sh?sh*Math.max(0,wz-HIPZ)/span:0), wz]);
    }
    for(const run of part.s){
      const rgb0=hexToRgb(SLOTC[run[0]]||p.shirt);
      for(let k=run[1],e=run[1]+run[2];k<e;k++){
        const A=_W[t[k*3]],B=_W[t[k*3+1]],C=_W[t[k*3+2]];
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
    let fy,fz,pitch;
    if(th<Math.PI){                                 // ยกเท้าไปข้างหน้า
      const u=th/Math.PI, e=u*u*(3-2*u);            // smoothstep: ออกตัวนุ่ม ลงนุ่ม
      fy=-STEPA+2*STEPA*e; fz=WALK_LIFT*motion*Math.sin(Math.PI*u);
      pitch=0.20*Math.sin(Math.PI*u)*motion;        // ปลายเท้าเชิดตอนลอย
    }else{                                          // เท้าอยู่กับพื้น
      const u=(th-Math.PI)/Math.PI;
      fy=STEPA-2*STEPA*u; fz=0;
      pitch=-0.32*Math.max(0,u-0.68)/0.32*motion;   // ถีบปลายเท้าตอนจะยกขึ้น
    }
    const hip=[J('hip')[0],J('hip')[1],J('hip')[2]+bob];
    const ankle=[J('ankle')[0],J('ankle')[1]+fy,J('ankle')[2]+fz];
    const knee=legIK(hip,ankle,LEGL1,LEGL2);
    const rl=MDL.parts['thigh'+S],cl=MDL.parts['calf'+S],fl=MDL.parts['foot'+S];
    emit(rl,hip,axisRot(rl.axis,norm(sub(knee,hip))),1);
    emit(cl,knee,axisRot(cl.axis,norm(sub(ankle,knee))),1);
    const ca=Math.cos(pitch),sa=Math.sin(pitch);
    emit(fl,ankle,[1,0,0, 0,ca,-sa, 0,sa,ca],1);    // เท้าเงย/ถีบรอบแกนข้าง
  }
  /* ---- ลำตัว + หัว ---- */
  emit(MDL.parts.torso,[JT.hips[0],JT.hips[1],JT.hips[2]+bob],null,1,lean);
  emit(MDL.parts.head,[JT.head[0],JT.head[1]+lean,JT.head[2]+bob+breath],null,1);
  const hairSet=MDL.variants.hair||{},hairKey=p.modelHair&&hairSet[p.modelHair]?p.modelHair:Object.keys(hairSet)[0];
  if(hairKey) emit(hairSet[hairKey],[JT.head[0],JT.head[1]+lean,JT.head[2]+bob+breath],null,1);
  const facialSet=MDL.variants.facial||{};
  if(p.facial&&facialSet[p.facial]) emit(facialSet[p.facial],[JT.head[0],JT.head[1]+lean,JT.head[2]+bob+breath],null,1);
  /* ---- แขน: ใช้ IK เดิม แต่ความยาวท่อนมาจากโมเดลจริง ---- */
  for(const side of [-1,1]){
    posedArms=false;
    const S=side<0?'L':'R', J=k=>JT[k+S];
    const L1=dist(J('shoulder'),J('elbow')), L2=dist(J('elbow'),J('wrist')), REACH=(L1+L2)*.985;
    const shoulder=[J('shoulder')[0],J('shoulder')[1]+lean,J('shoulder')[2]+bob];
    /* แขนแกว่งสวนกับขาข้างเดียวกัน · ผูกกับ phase ของการเดินตรง ๆ ไม่ใช่ค่า gait ที่ถูกหรี่ไว้ */
    const armTh=phase+(side<0?0:Math.PI);
    const armDamp=Math.min(1,Math.max(.35,clearance/6));
    /* ไหล่แกว่งหน้า-หลังราว ±12° (เดินชมของช้า ๆ) — งานวิจัย gait ไหล่กวาดรวม ~30° */
    const swing=Math.sin(armTh)*0.058*motion*armDamp;
    const interested=p.state==='look'&&side===1, pointing=interested&&action==='point';
    /* ศอก "งอค้าง" ตลอดการเดิน (offset ~26°) แล้วงอเพิ่มตอนแกว่งมา "ข้างหน้า" (peak ~42°+)
       — คนจริงไม่เคยเหยียดแขนตรง และศอกงอมากตอนแขนมาหน้า ตรงข้ามกับท่าสวนสนามที่ดันแขนตรงไปหน้า
       ของเดิมงอตอนแขนไปหลังแล้วเหยียดตรงตอนไปหน้า → เลยดูเหมือนทหารสวนสนาม แก้ให้กลับด้าน */
    const foldBase =0.30*motion*armDamp;                               // งอค้างพื้นฐาน (แขนไม่มีทางตรง)
    const foldFront=Math.max(0,Math.sin(armTh))*0.58*motion*armDamp;   // งอเพิ่มตอนมือมาข้างหน้า
    const fold=Math.min(1,foldBase+foldFront);
    /* ต้นแขนห้อยเกือบดิ่งจากไหล่ · "มือ" นำหน้าข้อศอก → ศอกทำหน้าที่บานพับ ไม่ใช่แขนแข็งแกว่งทั้งท่อน */
    let elbow=[shoulder[0]+side*.014,shoulder[1]+swing*.34-.006,shoulder[2]-L1*(.93-.05*fold)];
    let hand =[shoulder[0]+side*.022,shoulder[1]+swing*1.18+.030*fold,shoulder[2]-(L1+L2)*(.94-.14*fold)];
    if(interested){hand[1]+=.070;hand[2]=shoulder[2]-(L1+L2)*.62;}
    if(pointing){hand[1]+=.090*gesture;hand[2]+=.130*gesture;}
    if(side===1&&action==='chat'){hand[1]+=.055*gesture;hand[2]+=.09*gesture;}
    if(side===-1&&action==='adjust'){hand[0]*=1-.6*gesture;hand[1]+=.065*gesture;hand[2]+=.16*gesture;}
    if(action==='chin'&&side===1){const tgt=[side*.030,lean+.060,JT.head[2]-.030+bob];for(let i=0;i<3;i++)hand[i]+=(tgt[i]-hand[i])*gesture;}
    if(action==='jump'&&p.kid){hand[0]+=(side*.170-hand[0])*gesture;hand[1]+=(lean+.015-hand[1])*gesture;hand[2]+=(shoulder[2]+.10-hand[2])*gesture;elbow[0]+=(side*.16-elbow[0])*gesture;}
    if(crouch){
      const sh=inspectPose(shoulder),rest=inspectPose(hand);
      const kneeT=inspectPose([side*.055,.030,JT['knee'+S][2]+.03+bob]);
      for(let i=0;i<3;i++){shoulder[i]=sh[i];hand[i]=rest[i]+(kneeT[i]-rest[i])*gesture;}
      elbow=[side*.125,shoulder[1]+.025,shoulder[2]-L1*.80];
      posedArms=true;
    }
    let pose=solvePersonArm(shoulder,hand,elbow,REACH,L1,L2);
    hand=pose.hand.slice();elbow=pose.elbow.slice();
    if(!crouch)constrainVisitorArm(p,[hand],world,H,right,fx,fy);
    pose=solvePersonArm(shoulder,hand,elbow,REACH,L1,L2);
    hand=pose.hand.slice();elbow=pose.elbow.slice();
    if(!crouch)constrainVisitorArm(p,[elbow],world,H,right,fx,fy);
    const ua=MDL.parts['arm'+S],fa=MDL.parts['fore'+S],hd=MDL.parts['hand'+S];
    const dirU=norm(sub(elbow,shoulder)),dirF=norm(sub(hand,elbow));
    emit(ua,shoulder,axisRot(ua.axis,dirU),dist(shoulder,elbow)/ua.len);
    emit(fa,elbow,axisRot(fa.axis,dirF),dist(elbow,hand)/fa.len);
    emit(hd,hand,axisRot(hd.axis,dirF),1);
  }
  posedArms=false;

  if(p.bagged){
    // Strap lies against the front and back of the body instead of floating over it.
    for(const sign of [-1,1])for(let i=0;i<14;i++){
      const strap=t=>[-.065+t*.137,lean+sign*(.065-Math.max(0,t-.4)*.018),.783+bob-t*.218];
      const a=strap(i/14),b=strap((i+1)/14);
      let vv=[[a[0]-.004,a[1],a[2]],[a[0]+.004,a[1],a[2]],[b[0]+.004,b[1],b[2]],[b[0]-.004,b[1],b[2]]];
      if(sign<0)vv.reverse();face(vv,'#51463a');
    }
    rings([[.093*build,0,.476+bob,.030,.035],[.093*build,0,.551+bob,.032,.037],[.093*build,0,.563+bob,.025,.030]],'#655844',8);
  }
  if(p.accessory==='backpack'){
    rings([[0,lean-.073,.565+bob,.055,.023],[0,lean-.081,.62+bob,.063,.031],[0,lean-.078,.727+bob,.055,.030],[0,lean-.068,.754+bob,.035,.020]],p.pants,12);
    for(const side of [-1,1])limb([side*.06,lean-.046,.77+bob],[side*.061,lean+.059,.694+bob],.007,.007,p.pants);
  }
  p._drawPose={key:poseKey,x:p.x,y:p.y,faces};
  paintPersonMesh(faces,p,H);
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
    else { _openingRemaining=null;_openingParty=null;_openingAt=0; _peopleT = 0; _spawnAt = 0.3; _partySequence=0; _arrivalScore=null; _pendingParty=null; _arrivalRetryAt=0; }
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
    if(p._yieldResume&&p.t>8){const saved=p._yieldResume;p._yieldResume=null;p.state=saved.state;p.lookT=saved.remaining;p.t=0;p.tgt={x:p.x,y:p.y};p.motion=0;}
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
  q._yieldWaitUntil=q._squeezeUntil;q._asideUntil=q._squeezeUntil;q.motion=0;
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

