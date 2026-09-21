/* ============================================================
   tank-view.js — โหมดเข้าตู้ (พื้นเอียงไอโซเมตริก)
   พื้นตู้เป็นสี่เหลี่ยมเอียงมีความลึก → วางทากได้หลายตัว
   ทากเดินไปมาบนพื้น วาดด้วยเอนจินยีนจริง (SlugEngine.drawSlug)
   ============================================================ */

let tankMode=false, curTank=null, tankLoopOn=false, selSlug=null, tankLastT=0;
let tankBuildMode=false;   // โหมดจัดของในตู้ (โชว์กริด) — เตรียมไว้สำหรับของตกแต่ง
let tankNeedFit=false;     // ให้จัดกล้องใหม่ในเฟรมถัดไป (แก้ปัญหาซูมเพี้ยนตอนเปิดตู้ ถ้าขนาด canvas ยังไม่พร้อม)
let tankFocus=null;        // จุดโฟกัสตอนเข้าตู้ (interior fx,fy) — จากตำแหน่งที่กด
const ov=document.getElementById('ov');
const tankCv=document.getElementById('tankCv');
let tctx=tankCv.getContext('2d');            // สลับชั่วคราวไปวาดลงแคนวาสลูกได้ (ดู intoLayer)

/* ===== ชั้นภาพที่ไม่ขึ้นกับเวลา — วาดครั้งเดียวแล้ว blit ทุกเฟรม =====
   เคล็ดคือวาดใน "พิกัดตู้" (ox=oy=0) ลงแคนวาสเท่ากรอบตู้ แล้วค่อยแปะตามกล้อง
   → แพนกล้องไม่ต้องวาดใหม่ สร้างใหม่เฉพาะตอนซูม/เปลี่ยนตู้/จอเปลี่ยนขนาด/เท็กซ์เจอร์เพิ่งมา */
const LAY_PAD  = 72;       // เผื่อขอบรอบจอ (px) แพนในระยะนี้ใช้ชั้นเดิมได้เลย
const CAU_SCALE= 0.5;      // อบลายแสงที่ครึ่งความละเอียด (วัดแล้วค่าสถิติของภาพเท่าเดิม ตาไม่เห็นต่าง)
const CAU_FPS  = 24;       // ลายแสงอัปเดต 24 ครั้ง/วิ แต่ "แปะ" ทุกเฟรม → ลื่นเท่าเดิม ถูกลง 3 เท่า
let _lay = { key:'', box:null, chrome:null, glass:null, cau:null, cauT:0, cauF:-1 };
let _tankFrame = 0;
const texOK = im => !!(im && (im.naturalWidth || im.width));
/* พื้นที่ที่ "ต้องมีจริง ๆ" = ตัวตู้ ∩ กรอบจอ (พิกัด ox=oy=0)
   ซูมเข้าใกล้ ๆ ตู้จะใหญ่กว่าจอมาก ถ้าอบทั้งตู้ = เปลืองพิกเซลฟรี ๆ หลายเท่าจอ */
function needBox(){
  const b=tankBounds();
  return { x0:Math.max(b.minX,-tankCam.ox),      y0:Math.max(b.minY,-tankCam.oy),
           x1:Math.min(b.maxX,-tankCam.ox+TCW),  y1:Math.min(b.maxY,-tankCam.oy+TCH), b };
}
function layBox(){                                  // เผื่อขอบ LAY_PAD ไว้ แพนนิดหน่อยจะได้ไม่ต้องอบใหม่
  const n=needBox(), b=n.b;
  const x0=Math.max(Math.floor(b.minX)-2, Math.floor(n.x0-LAY_PAD));
  const y0=Math.max(Math.floor(b.minY)-2, Math.floor(n.y0-LAY_PAD));
  const x1=Math.min(Math.ceil (b.maxX)+2, Math.ceil (n.x1+LAY_PAD));
  const y1=Math.min(Math.ceil (b.maxY)+2, Math.ceil (n.y1+LAY_PAD));
  return { x:x0, y:y0, w:Math.max(1,x1-x0), h:Math.max(1,y1-y0) };
}
function layCovers(){                               // ชั้นที่อบไว้ยังครอบพื้นที่ที่ต้องใช้อยู่ไหม
  const L=_lay.box; if(!L) return false;
  const n=needBox();
  return n.x0>=L.x-0.5 && n.y0>=L.y-0.5 && n.x1<=L.x+L.w+0.5 && n.y1<=L.y+L.h+0.5;
}
function newLayer(box, sc){
  const c=document.createElement('canvas');
  c.width =Math.max(1,Math.round(box.w*DPR*sc));
  c.height=Math.max(1,Math.round(box.h*DPR*sc));
  return c;
}
/* วาดลงแคนวาสลูก: ย้ายกล้องไปมุมซ้ายบนของกรอบชั่วคราว แล้วคืนค่าเดิมเสมอ */
function intoLayer(c, box, sc, fn){
  const x=c.getContext('2d');
  x.setTransform(DPR*sc,0,0,DPR*sc,0,0);
  x.clearRect(0,0,box.w,box.h);
  const ox=tankCam.ox, oy=tankCam.oy, prev=tctx;
  tankCam.ox=-box.x; tankCam.oy=-box.y; tctx=x;
  try{ fn(x); } finally { tctx=prev; tankCam.ox=ox; tankCam.oy=oy; }
}
/* แปะชั้นลูก · rect = จำกัดเฉพาะกรอบที่ต้องใช้จริง (พิกัดจอ) จะได้ไม่ composite ทั้งผืน */
function blitLayer(c, box, rect){
  /* ⚠️ 2026-09-18 เข้าตู้ตอนหน้าต่างไม่ได้วาดภาพ (แคนวาสกว้าง/สูง 0) → drawImage โยน InvalidStateError
     ทั้งลูป drawTank ตายกลางคัน ตู้ค้างจนกว่าจะรีโหลด · กันไว้ตรงนี้ เฟรมนั้นข้ามไปเฉย ๆ */
  if(!c||!box||!c.width||!c.height||box.w<=0||box.h<=0) return;
  const dx=tankCam.ox+box.x, dy=tankCam.oy+box.y;
  if(!rect){ tctx.drawImage(c, dx, dy, box.w, box.h); return; }
  const x0=Math.max(rect.x0,dx), y0=Math.max(rect.y0,dy);
  const x1=Math.min(rect.x1,dx+box.w), y1=Math.min(rect.y1,dy+box.h);
  if(x1<=x0 || y1<=y0) return;
  const kx=c.width/box.w, ky=c.height/box.h;
  tctx.drawImage(c, (x0-dx)*kx, (y0-dy)*ky, (x1-x0)*kx, (y1-y0)*ky, x0, y0, x1-x0, y1-y0);
}
let TCW=0, TCH=0;

/* ── กล้องมองหน้าตรง (oblique) — มุมแรกสุด ──────────────────────────────────
   จุดในตู้ (fx=แนวยาว 0..fw, fy=ความลึก 0..fh, zz=ความสูง 0=พื้น) → พิกัดจอ:
     x = ox + (fx−fw/2)·CELLW·z + (fy−fh/2)·DEPX·z
     y = oy − (fy−fh/2)·DEPY·z − zz·ZH·z
   • เส้นแนวกว้าง (fy คงที่) = แนวนอนเป๊ะ → กริดตรง
   • เส้นแนวลึก  (fx คงที่) = ขนานกันทุกเส้น เยื้องขึ้น-ขวาเท่ากัน
   • เส้นแนวตั้ง = ตั้งตรง                                                     */
const CELLW      = 40;               // กว้าง/ช่อง แนวหน้า (px, แนวนอน)
const DEPX       = 19;               // เยื้องขวา/ช่องลึก (ทำให้ดู 3 มิติ)
const DEPY       = 21;               // ดันขึ้น/ช่องลึก
const ZH         = 30;               // สูง/ช่อง (px แนวตั้ง)
/* ความสูงกระจก = ต่อตู้ (ดู tankGlassCm ใน config.js) · ขาตั้ง = เท่ากันทุกตู้ */
const wallCells  = () => tankGlassCells(curTank.def);
const STAND_CELLS= tankStandCells();  // ความสูงขาตั้ง/ตู้ไม้ (ช่อง)
const SAND_CELLS = 1.3;              // ความหนาชั้นทราย (ช่อง)
const STAND_SHOW = 1/3;              // ตอนจัดกรอบ/ซูมออกสุด โชว์ฐานไม้แค่ 1/3 (ที่เหลือครอปพ้นจอล่าง)
const tankCam = { ox:0, oy:0, zoom:1 };

/* ฉาย oblique หน้าตรง — คืน x,y (จอ), s (สเกลคงที่), d (ลำดับลึก มาก=ไกล) */
function S(fx, fy, zz){
  const fw=curTank.def.w, fh=curTank.def.h, z=tankCam.zoom;
  const X=fx-fw/2, Y=fy-fh/2;
  return { x: tankCam.ox + X*CELLW*z + Y*DEPX*z,
           y: tankCam.oy - Y*DEPY*z - (zz||0)*ZH*z,
           s: z, d: fy };
}
/* สเกลพิกเซล/ซม. — oblique คงที่ทั้งฉาก (ขนาดทากเท่ากันทุกตำแหน่ง) */
function depthPxPerCm(){ return CELLW*tankCam.zoom/CM_PER_CELL; }

/* ============================================================
   สไปรต์ทากในตู้ — แยก "อัตราเฟรมของอนิเมชัน" ออกจาก "อัตราเฟรมของจอ"
   ปัญหาเดิม: ทุกเฟรมเรียก SlugEngine.drawSlug() ตรง ๆ ทุกตัว
   ตัวหนึ่งคือ drawImage ที่หมุน+ย่อจากอาร์ตใหญ่ (หงอน 251×282, ตา 220×220) ราว 15–25 ครั้ง
   33 ตัว = ~600 ครั้ง/เฟรม × 60 fps = 36,000 ครั้ง/วินาที ที่ต้องรีแซมเปิลใหม่หมด → ตาย
   แก้: เรนเดอร์ตัวทากลงแคนวาสของมันเองตามงบที่มี แล้วเฟรมที่เหลือแค่ blit ภาพเดียว
   ตำแหน่ง/การเดินยังอัปเดต 60 fps เสมอ (แค่ย้ายจุด blit) ที่ถูกลดคืออัตราเปลี่ยน "ท่า"

   งบต่อเฟรมปรับเอง (dynamic LOD): เครื่องแรง = อัดจนท่าทางลื่น 60 fps
   เครื่องอืด = ค่อย ๆ ลดอัตราเปลี่ยนท่าลง แทนที่จะปล่อยให้เฟรมตก = ภาพสะดุด
   ============================================================ */
const TSPR_FPS = 20;                    // เพดานอัตราเปลี่ยนท่า (เดิม 60 = วาดใหม่ทุกเฟรม) ตำแหน่ง/เดินยังลื่น 60fps เพราะแค่ blit
let TSPR_MAX = 24;                      // จำนวนตัวที่ยอมเรนเดอร์ใหม่ต่อเฟรม — ปรับอัตโนมัติข้างล่าง
let _tsprBudget = 0, _frameEMA = 16.7;
let _zoomBusyT = 0;      // กำลังซูมอยู่ถึงเวลานี้ — ระหว่างนี้ห้ามอบ layer/สไปรต์ใหม่ (กันกระตุก)
let _layOK = false;      // layer ที่มีอยู่ตรงกับซูมปัจจุบันไหม
/* ลูปปิด: จอ 60Hz ที่ยังไหวจะได้ระยะห่างเฟรม ~16.7ms คงที่ → ดันงบขึ้นเรื่อย ๆ จนทุกตัว
   เปลี่ยนท่าทุกเฟรม พอเครื่องเริ่มตามไม่ทันระยะห่างจะยืดเกิน 22ms → ถอยงบลง
   ผลคือเครื่องแรงได้ 60fps เต็ม เครื่องอืดค่อย ๆ ลดความถี่ "เปลี่ยนท่า" แทนที่จะเฟรมตก */
function tuneSpriteBudget(dtms){
  _frameEMA += (Math.min(dtms,120) - _frameEMA)*0.12;
  if(_frameEMA < 18.0)      TSPR_MAX = Math.min(64, TSPR_MAX+1);
  else if(_frameEMA > 22.0) TSPR_MAX = Math.max(2,  TSPR_MAX-1);
}
function tankSlugSprite(s, P, sa, walking, lifted){
  const pad = 6;                     // สไปรต์นี้คือ "ตัวทาก" ล้วน ๆ · ออร่าแปะแยกตอนวาดลงซีน
  const w = Math.max(8, Math.ceil(P.w*sa)+pad*2), h = Math.max(8, Math.ceil(P.h*sa)+pad*2);
  const now = performance.now();
  if(s._tsOff===undefined) s._tsOff = Math.random()*1000/TSPR_FPS;   // กระจายจังหวะ ไม่ให้รีเฟรชพร้อมกันทั้งฝูง
  const zb = now < _zoomBusyT;                                       // ซูมอยู่ → ใช้ของเดิมยืดเอา ไม่เรนเดอร์ใหม่
  const poseKey=s.state+'|'+Math.round((s.wake||0)*12)+'|'+Math.round((s.startle||0)*10)+'|'+(lifted?1:0)+'|'+(s._bakeEyes?1:0)+'|'+Math.round((s.tugLean||0)*8);   // tugLean: หงอนสะบัดตอนชักเย่อ ต้องรีเฟรชสไปรต์ตามจังหวะกด
  const due = !s._ts || (!zb && ((now - s._tsT) > (1000/TSPR_FPS) || s._tsWalk!==walking || s._tsPose!==poseKey));
  const sized = s._ts && (zb || Math.abs(s._tsSa - sa) < sa*0.06);   // ขนาดเพี้ยนไม่เกิน 6% ใช้ของเดิมยืดเอา
  if(due && _tsprBudget>0 || !s._ts || !sized && _tsprBudget>0){
    if(!s._ts || s._tsW!==w || s._tsH!==h){
      const c=document.createElement('canvas');
      c.width=Math.round(w*DPR); c.height=Math.round(h*DPR);
      s._ts=c; s._tsX=c.getContext('2d'); s._tsW=w; s._tsH=h;
    }
    const x=s._tsX;
    x.setTransform(DPR,0,0,DPR,0,0);
    x.clearRect(0,0,w,h);
    const pose=lifted ? Object.assign({},s,{noBob:true,noEyes:true}) : Object.assign({},s,{noEyes: !s._bakeEyes});   // ท่าปกติอบตาเข้าสไปรต์ให้ขยับตาม creep
    SlugEngine.drawSlug(x, P, w/2, h/2, false, (s.ph||0)*120, sa, false, walking, pose);
    s._tsT=now; s._tsSa=sa; s._tsWalk=walking; s._tsPose=poseKey; _tsprBudget--;
  }
  return s._ts ? {c:s._ts, w:s._tsW, h:s._tsH, sa:s._tsSa} : null;
}

/* ---- ออร่าหงอนโลหะ: อบเป็นภาพนิ่ง 1 ใบต่อตัว ----
   ตัวการตัวจริงของอาการกระตุก: drawGillAura วาด radial gradient ~90 จุด "ทุกครั้ง"
   ที่รีเฟรชสไปรต์ (โปรไฟล์: 348 gradient/เฟรม มาจากตรงนี้ล้วน ๆ)
   แต่ลายมันคงที่ (seed เดิม) และเป็นแค่แสงฟุ้ง ไม่ต้องแกว่งตามหงอนก็ไม่มีใครดูออก
   → อบครั้งเดียวต่อตัว แล้วแปะแบบ lighter ทุกเฟรม = ฟรี */
/* ความแรงออร่าในตู้ — ในเกมผสมพันธุ์ฉากหลังเป็นบ่อน้ำมืด แสงบวกเลยเด้งชัด
   แต่ในตู้ฉากหลังเป็นทรายสว่าง (ค่าความสว่าง ~155/255) บวกแสงลงไปแทบไม่ขึ้น
   เลยต้องดันแรงขึ้นเพื่อให้ "เรือง" เท่ากันในสายตา */
let AURA_HALO = 2.5;    // ความแรงของกลดแสงรอบพุ่ม (ปรับสดในคอนโซลได้: AURA_HALO=8)
let AURA_DOT  = 8.0;    // ความแรงของเม็ดประกาย
let AURA_RAD  = 0.5;   // ขยายรัศมีกลด
const _mixC =(a,b,f)=>a.map((v,i)=>v+(b[i]-v)*f);
const _rgbaC=(c,a)=>'rgba('+c.map(v=>Math.round(Math.max(0,Math.min(255,v)))).join(',')+','+a+')';
function paintGillAura(x, P){
  const D=P.D;
  let L=1e9,R=-1e9,T=1e9,B=-1e9;
  P.stalks.forEach(o=>{
    const c=Math.cos(o.rot0), si=Math.sin(o.rot0), fx=o.fx||1;
    [[-o.ax,-o.ay],[o.w-o.ax,-o.ay],[o.w-o.ax,o.h-o.ay],[-o.ax,o.h-o.ay]].forEach(([qx,qy])=>{
      const rx=qx*fx, X=o.px+rx*c-qy*si, Y=o.py+rx*si+qy*c;
      L=Math.min(L,X); R=Math.max(R,X); T=Math.min(T,Y); B=Math.max(B,Y);
    });
  });
  const cx=(L+R)/2, cy=(T+B)/2, gw=R-L, gh=B-T;
  P.auraPivot={x:cx,y:cy};
  const gcol=_mixC(D.matA.m,[255,255,255],0.25);
  x.save(); x.globalCompositeOperation='lighter';
  const rad=Math.max(gw,gh)*0.62*AURA_RAD;
  const aura=x.createRadialGradient(cx,cy,rad*0.20,cx,cy,rad);
  aura.addColorStop(0,  _rgbaC(gcol,Math.min(1,0.16*D.aura*AURA_HALO).toFixed(3)));
  aura.addColorStop(0.5,_rgbaC(gcol,Math.min(1,0.06*D.aura*AURA_HALO).toFixed(3)));
  aura.addColorStop(1,  _rgbaC(gcol,0));
  x.fillStyle=aura; x.fillRect(L-rad,T-rad,gw+rad*2,gh+rad*2);
  let seed=23; const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
  const dot=(px,py,r,a)=>{
    const g=x.createRadialGradient(px,py,0,px,py,r);
    g.addColorStop(0,  _rgbaC(gcol, a.toFixed(3)));
    g.addColorStop(0.4,_rgbaC(gcol,(a*0.5).toFixed(3)));
    g.addColorStop(1,  _rgbaC(gcol,0));
    x.fillStyle=g; x.beginPath(); x.arc(px,py,r,0,Math.PI*2); x.fill();
  };
  const N=Math.round(90*D.aura)+30;
  for(let i=0;i<N;i++){
    const angle=rnd()*Math.PI*2, radius=Math.sqrt(rnd());
    const px=cx+Math.cos(angle)*radius*gw*0.52, py=cy+Math.sin(angle)*radius*gh*0.52;
    const fade=Math.pow(1-radius*radius,1.5);
    dot(px,py, P.bw*(0.004+rnd()*rnd()*0.012), Math.min(1,(0.45+rnd()*0.55)*D.aura*AURA_DOT)*fade);
  }
  x.restore();
}
function tankAuraSprite(s, P, sa){
  if(!(P.D.aura>0)) return null;                 // ทากธรรมดาไม่มีออร่า ไม่ต้องอบ
  const pad=26, w=Math.max(8,Math.ceil(P.w*sa)+pad*2), h=Math.max(8,Math.ceil(P.h*sa)+pad*2);
  if(s._auC && (performance.now() < _zoomBusyT || Math.abs(s._auSa-sa) < sa*0.06 || _tsprBudget<=0)) return s._auC;   // ซูมอยู่/เพี้ยนนิดหน่อย → ยืดเอา
  const c=document.createElement('canvas');
  c.width=Math.round(w*DPR); c.height=Math.round(h*DPR);
  const x=c.getContext('2d'); x.setTransform(DPR,0,0,DPR,0,0);
  x.translate(w/2,h/2); x.scale(P.s*sa,P.s*sa);       // ทรานส์ฟอร์มชุดเดียวกับที่ drawSlug ใช้
  x.translate(-(P.L+P.R)/2, -(P.T+P.B)/2);
  paintGillAura(x,P);
  s._auC=c; s._auW=w; s._auH=h; s._auSa=sa;
  return c;
}
/* ตอนถูกยก เนื้อทากนิ่ม: ดัดระดับพิกเซลแล้ววาดกลับเป็นภาพเดียว
   ห้ามแบ่ง drawImage เป็นแถบ เพราะขอบ sampling/clip จะเห็นเป็นขีดบนตัวสีเข้ม */
const _sagCache=new WeakMap();
function drawSaggedSlug(img, stamp, x, y, w, h){
  let hit=_sagCache.get(img);
  if(!hit || hit.stamp!==stamp){
    const W=img.width, H=img.height, extra=Math.ceil(H*0.11);
    const out=document.createElement('canvas'); out.width=W; out.height=H+extra;
    const ox=out.getContext('2d'), ix=img.getContext('2d');
    const src=ix.getImageData(0,0,W,H), dst=ox.createImageData(W,H+extra);
    const sd=src.data, dd=dst.data, OH=H+extra;
    for(let px=0;px<W;px++){
      const u=(px+0.5)/W, edge=Math.abs(u*2-1);
      const off=Math.round(extra*Math.pow(edge,2.15));
      for(let py=0;py<H;py++){
        const si=(py*W+px)*4, di=((py+off)*W+px)*4;
        dd[di]=sd[si]; dd[di+1]=sd[si+1]; dd[di+2]=sd[si+2]; dd[di+3]=sd[si+3];
      }
    }
    ox.putImageData(dst,0,0);
    hit={stamp,c:out,ratio:OH/H}; _sagCache.set(img,hit);
  }
  tctx.drawImage(hit.c,x,y,w,h*hit.ratio);
}
/* เงาสัมผัสใต้ตัวทาก — อบครั้งเดียวต่อการรีเฟรชสไปรต์ (ไม่ใช่ต่อเฟรม)
   คีย์ = เวลาที่สไปรต์ถูกอบล่าสุด (s._tsT) + ขนาด + ความฟุ้ง · สไปรต์เปลี่ยนท่าเมื่อไหร่เงาตามเอง
   ความฟุ้งคิดใน "พิกัดของสไปรต์" แล้วค่อยยืดตามซูมตอนวาด จึงไม่ต้องอบใหม่ทุกครั้งที่ซูม */
function tankShadowSprite(s, spr, blur){
  const b=Math.max(1, Math.round(blur*2)/2), pad=Math.ceil(b*2)+2;
  const w=Math.ceil(spr.w)+pad*2, h=Math.ceil(spr.h)+pad*2;
  if(s._sh && s._shT===s._tsT && s._shW===w && s._shH===h && s._shB===b) return {c:s._sh, pad};
  if(!s._sh || s._shW!==w || s._shH!==h){
    const c=document.createElement('canvas');
    c.width=Math.round(w*DPR); c.height=Math.round(h*DPR);
    s._sh=c; s._shX=c.getContext('2d');
  }
  const x=s._shX;
  x.setTransform(DPR,0,0,DPR,0,0);
  x.clearRect(0,0,w,h);
  x.filter='brightness(0) blur('+b.toFixed(1)+'px)';
  x.drawImage(spr.c, pad, pad, spr.w, spr.h);
  x.filter='none';
  s._shT=s._tsT; s._shW=w; s._shH=h; s._shB=b;
  return {c:s._sh, pad};
}
/* แปะทาก 1 ตัวลงฉาก: ตัวทาก (source-over) แล้วค่อยทาบออร่าแบบ lighter "ลงบนซีนจริง"
   ⚠ ห้ามอบออร่าเข้าไปในสไปรต์แล้วแปะทีเดียว — ออร่าเป็นแสง "บวก" กับพื้นหลัง
   อบเข้าสไปรต์เมื่อไหร่มันจะกลายเป็นสีจาง ๆ alpha 6% ที่แปะทับพื้นทราย = แสงหายเกลี้ยง */
function drawTankSlug(s, P, sa, x, cy, lifted){
  const spr = tankSlugSprite(s, P, sa, lifted? false : (s.state==='walk'||s.state==='seekFood'||s.state==='seekDecor'||s.state==='seekNap'||s.state==='follow'||s.state==='dash'||s.state==='flee'), lifted);
  if(!spr) return;
  tctx.save(); tctx.translate(x, cy); if(s.flip) tctx.scale(-1,1);
  const k0 = sa/(spr.sa||sa), sw=spr.w*k0, sh=spr.h*k0;   // สไปรต์เก่ายืดตามซูมได้ ไม่ต้องเรนเดอร์ใหม่
  if(!lifted){
    /* เงาสัมผัส = เงาดำของตัวทากเอง เลื่อนลง ~3px แล้วตัวจริงวาดทับ
       → เหลือโผล่แค่ขอบล่าง แนบตามรูปทรงจริง ไม่มีช่องว่าง ไม่ดูลอย
       clip เฉพาะแถบล่าง กันไม่ให้เกิดขอบดำใต้พุ่มหงอน */
    const off = Math.max(2, 3*tankCam.zoom);
    const blur = Math.max(1.6, 2.6*tankCam.zoom);        // ฟุ้งให้จางปลาย ไม่เป็นเส้นการ์ตูน
    /* ⚠️ 2026-09-21 ผู้เล่น: "มือถือแลค" — เดิมบรรทัดนี้ตั้ง ctx.filter='brightness(0) blur()' แล้ววาดสด
       "ทุกตัว ทุกเฟรม" · ctx.filter บังคับให้เบราว์เซอร์แยกเรนเดอร์เป็นพาสใหม่ต่อการวาดหนึ่งครั้ง
       ตู้ที่มีทาก 20 ตัว = เบลอ 20 ครั้ง/เฟรม (slug-engine.js:1280 เคยเจอปัญหาเดียวกันแล้วเลิกใช้ filter ไปแล้ว)
       ตอนนี้อบเงาเป็นสไปรต์ตามจังหวะเดียวกับสไปรต์ตัวทาก (≤20Hz + มีงบต่อเฟรม) แล้วแปะเฉย ๆ */
    const shadow = tankShadowSprite(s, spr, blur/Math.max(.05,k0));
    tctx.save();
    tctx.beginPath(); tctx.rect(-sw/2, sh*0.12, sw, sh*0.42+off+blur*2); tctx.clip();
    tctx.globalAlpha = 0.22;                              // จางลง (เดิม 0.32 ทึบไป)
    if(shadow){
      const pad=shadow.pad*k0;
      tctx.drawImage(shadow.c, -sw/2-pad, -sh/2+off-pad, sw+pad*2, sh+pad*2);
    }else{                                                // อบไม่ทัน/ไม่ได้ = ใช้ทางเดิมไปก่อน ภาพต้องไม่หาย
      tctx.filter = 'brightness(0) blur('+blur.toFixed(1)+'px)';
      tctx.drawImage(spr.c, -sw/2, -sh/2+off, sw, sh);
    }
    tctx.restore();
  }
  if(lifted) drawSaggedSlug(spr.c,s._tsT,-sw/2,-sh/2,sw,sh);
  else tctx.drawImage(spr.c, -sw/2, -sh/2, sw, sh);
  const au = tankAuraSprite(s, P, sa);
  if(au){
    const k = sa/(s._auSa||sa), aw=s._auW*k, ah=s._auH*k;
    tctx.globalCompositeOperation='lighter';
    const phase=performance.now()/3200+(s.ph||0);
    const calm=lifted||s.state==='sleep'?0.25:1;
    tctx.globalAlpha=0.92+Math.sin(phase)*0.08*calm;
    const pivot=P.auraPivot||{x:(P.L+P.R)/2,y:(P.T+P.B)/2};
    const ax=(pivot.x-(P.L+P.R)/2)*P.s*sa, ay=(pivot.y-(P.T+P.B)/2)*P.s*sa;
    tctx.translate(ax,ay);
    tctx.rotate(Math.sin(phase)*0.055*calm);
    tctx.translate(-ax,-ay);
    tctx.drawImage(au, -aw/2, -ah/2, aw, ah);
  }
  tctx.restore();
}

/* ---- พื้นทราย: เท็กซ์เจอร์จริง ปูซ้ำให้ระนาบพื้นเอียงตามโปรเจกชัน ----
   ผืนละ SAND_TEX_CM ซม. · แปลงด้วยเวกเตอร์ฐานของพื้น ex=(CELLW,0) ey=(DEPX,-DEPY)
   เม็ดทรายจึงวิ่งไปตามแนวกริดจริง ไม่ใช่แปะแบนขนานจอ */
const SAND_TEX_CM = 40;
let _sandImg=null, _sandPat=null;

/* ---- ฉากหลังโหมดดูตู้ = ผนัง/พื้น "จริง" ของร้านรอบตู้นั้น ----
   เดิมฝังหินอ่อนดำ (assets/marble.jpg) + แกรนิต (assets/granite.jpg) ไว้ตายตัว
   พอร้านเปลี่ยนวัสดุ (ชุดใหม่ใน assets/textures/More/ + ทาสีทีละช่องใน tile-paint.js)
   เข้าตู้แล้วยังเป็นห้องหินอ่อนดำแบบเก่า ไม่ตรงกับหน้าร้าน — ตอนนี้ดึงวัสดุจากร้านจริง:
     ผนัง = บานที่อยู่ใกล้ตู้ที่สุด (ผนังที่เห็นชัดสุดข้างหลังตู้) ใช้วัสดุที่ทาเยอะสุดในบานนั้น
     พื้น = ช่องพื้นใต้กลางตู้
   ผนังเลื่อนตามกล้องแบบ parallax ช้า ๆ (0.25 เท่า) ให้รู้สึกว่าอยู่ไกลออกไปข้างหลัง */
const BG_PX_PER_CM = 520/120;     // ขนาดลายบนจอที่ซูม 1 · เทียบจากของเดิม (ลาย 120 ซม. = 520 px)
const BG_PARALLAX  = 0.25;
/* พื้นห้อง — วางที่ระดับก้นขาตั้งตู้ (z = −STAND_CELLS)
   ยืดไปข้างหลัง FLOOR_BACK ช่อง ขอบบนของมันคือเส้นบรรจบผนัง = เส้นขอบฟ้าของห้อง */
const FLOOR_SIDE = 60;
/* เส้นขอบฟ้า (ที่ผนังบรรจบพื้น) ให้ไปตรงกับ "ก้นชั้นทรายด้านหลังตู้" พอดี
   หาจากสมการ: −FLOOR_BACK·DEPY + STAND_CELLS·ZH = 0  →  FLOOR_BACK = STAND_CELLS·ZH/DEPY
   บวก FLOOR_NUDGE ถ้าอยากดันเส้นขึ้น (บวก) หรือลงมาอีก (ลบ) */
const FLOOR_NUDGE = 0;
const FLOOR_BACK  = STAND_CELLS*ZH/DEPY + FLOOR_NUDGE;
/* หาวัสดุครั้งเดียวต่อ "ตู้ + รุ่นการทาสี + รุ่นพื้น" — ไล่หาผนังทุกช่องทุกเฟรมเปลืองเปล่า ๆ
   (paintRevision ขยับทุกครั้งที่ทาสี · floorRevision ขยับตอนขยายร้าน) */
let _roomMatsKey='', _roomMats=null;
function tankRoomMats(o){
  const key=[o.id,o.cx,o.cy,o.rot|0,paintRevision,floorRevision].join('|');
  if(key===_roomMatsKey&&_roomMats) return _roomMats;
  const mx=o.cx+oW(o)/2, my=o.cy+oH(o)/2;
  let best=null, bd=Infinity;
  for(const [x,y] of allFloorTiles())for(const side of [0,1]){
    if(ownsTile(x-(side===1),y-(side===0))) continue;   // มีพื้นติดกันด้านนั้น = ไม่มีผนัง (กติกาเดียวกับ drawTileWalls)
    const wx=side===0?(x+.5)*SUB:x*SUB, wy=side===0?y*SUB:(y+.5)*SUB, d=(wx-mx)**2+(wy-my)**2;
    if(d<bd){ bd=d; best=[x,y,side]; }
  }
  let wallId=currentWallMat().id;
  if(best){                                           // ทาไม่เท่ากันทั้งบาน → เอาวัสดุที่มีหลายชั้นสุด (เสมอกันเอาชั้นล่าง)
    const count=new Map(); let top=0;
    for(let l=0;l<wallLayerCount();l++){
      const id=wallMatIdAt(wallKey(best[0],best[1],best[2],l)), n=(count.get(id)||0)+1;
      count.set(id,n); if(n>top){ top=n; wallId=id; }
    }
  }
  _roomMatsKey=key;
  return _roomMats={wall:wallMatDef(wallId), floor:floorMatAt(Math.floor(mx/SUB),Math.floor(my/SUB))};
}
const _bgPats=new Map();          // ไฟล์ภาพ → pattern (ภาพโหลดผ่าน matImage() ชุดเดียวกับหน้าร้าน ไม่โหลดซ้ำ)
function roomPat(ctx, m){
  if(m&&m.color) return {flat:m.color, m};   // วัสดุสีเรียบ (ขาวล้วน) — ไม่มีไฟล์ให้โหลด
  const img=matImage(m.file); if(!img) return null;
  let pat=_bgPats.get(m.file); if(!pat){ pat=ctx.createPattern(img,'repeat'); _bgPats.set(m.file,pat); }
  return (pat && pat.setTransform && typeof DOMMatrix!=='undefined') ? {pat,img,m} : null;
}
function drawRoomFloor(ctx){
  if(!curTank) return;
  const r=roomPat(ctx, tankRoomMats(curTank).floor); if(!r) return;
  const {pat,img,m}=r;
  const fw=curTank.def.w, fh=curTank.def.h, zf=-STAND_CELLS;
  const q=[ S(-FLOOR_SIDE, fh+FLOOR_BACK, zf), S(fw+FLOOR_SIDE, fh+FLOOR_BACK, zf),
            S(fw+FLOOR_SIDE, -FLOOR_BACK, zf), S(-FLOOR_SIDE, -FLOOR_BACK, zf) ];
  const o=S(0,0,zf);
  /* วัสดุสีเรียบ (ขาวล้วน) เติมสีตรง ๆ · วัสดุที่มีลายค่อยตั้ง pattern
     ⚠️ ไล่แสง/บัวเชิงผนังด้านล่างต้องทำงานกับทั้งสองแบบ ห้ามยกเข้ามาในสาขาใดสาขาหนึ่ง
        ไม่งั้นพื้นขาวจะแบนสนิท ไม่เข้ากับผนังที่ยังมีไล่แสงอยู่ */
  ctx.beginPath(); q.forEach((p,i)=> i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath();
  if(r.flat) ctx.fillStyle=r.flat;
  else{
    const T=img.naturalWidth/(m.cm/CM_PER_CELL);
    const ux=S(1,0,zf),uy=S(0,1,zf);
    pat.setTransform(new DOMMatrix([(ux.x-o.x)/T,(ux.y-o.y)/T,(uy.x-o.x)/T,(uy.y-o.y)/T,o.x,o.y]));
    ctx.fillStyle=pat;
  }
  ctx.fill();
  /* ไล่แสง: ไกล(บน)จมมืดกลืนกับผนัง ใกล้(ล่าง)สว่างขึ้นเล็กน้อยเหมือนมีไฟจากเพดาน */
  const gy0=Math.min(q[0].y,q[1].y), gy1=Math.max(q[2].y,q[3].y);
  const g=ctx.createLinearGradient(0,gy0,0,gy1);
  g.addColorStop(0,'rgba(0,0,0,0.30)'); g.addColorStop(0.35,'rgba(150,170,180,0.07)');
  g.addColorStop(1,'rgba(0,0,0,0.22)');
  ctx.fillStyle=g; ctx.fill();
  ctx.strokeStyle='rgba(190,205,212,0.16)'; ctx.lineWidth=1.5;   // บัวเชิงผนัง
  ctx.beginPath(); ctx.moveTo(q[0].x,q[0].y); ctx.lineTo(q[1].x,q[1].y); ctx.stroke();
}

let _bgC=null, _bgX=null, _bgKey='';
function drawTankBg(ctx){                 // แคชไว้ เปลี่ยนเฉพาะตอนกล้องขยับ/จอเปลี่ยนขนาด/วัสดุเปลี่ยน/ภาพโหลดเสร็จ
  /* ⚠️ แคนวาสกว้าง/สูง 0 (เข้าตู้ตอนหน้าต่างยังไม่จัดเลย์เอาต์ / ย่อหน้าต่างจนสุด) → drawImage โยน
     InvalidStateError แล้วลูปวาดตู้ตายทั้งเกม · กันแบบเดียวกับ blitLayer */
  if(!tankCv.width||!tankCv.height)return false;
  const mats=curTank?tankRoomMats(curTank):null;
  if(!mats || !roomPat(ctx,mats.wall)) return false;
  const k=[TCW,TCH,tankCam.zoom.toFixed(4),Math.round(tankCam.ox),Math.round(tankCam.oy),
           curTank.def.w, curTank.def.h, mats.wall.id, mats.floor.id, matGen()].join('|');
  if(k!==_bgKey){
    _bgKey=k;
    if(!_bgC){ _bgC=document.createElement('canvas'); _bgX=_bgC.getContext('2d'); }
    if(_bgC.width!==tankCv.width || _bgC.height!==tankCv.height){ _bgC.width=tankCv.width; _bgC.height=tankCv.height; }
    _bgX.setTransform(DPR,0,0,DPR,0,0); _bgX.clearRect(0,0,TCW,TCH);
    _bgPaint(_bgX);
  }
  ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(_bgC,0,0); ctx.setTransform(DPR,0,0,DPR,0,0);
  return true;
}
function _bgPaint(ctx){
  const r=curTank&&roomPat(ctx, tankRoomMats(curTank).wall); if(!r) return false;
  const {pat,img,m}=r;
  if(r.flat) ctx.fillStyle=r.flat;                    // ผนังสีเรียบ (ขาวล้วน) — ไม่มีลายให้สเกล
  else{
    const z=0.75+0.25*tankCam.zoom;                   // ผนังไกล ซูมมีผลน้อยกว่าตัวตู้
    const s=(m.cm*BG_PX_PER_CM*z)/img.naturalWidth;   // ลายใหญ่เท่าของจริง (วัสดุแต่ละตัวบอกขนาดผืนเป็น ซม.)
    pat.setTransform(new DOMMatrix([s,0,0,s, tankCam.ox*BG_PARALLAX, tankCam.oy*BG_PARALLAX]));
    ctx.fillStyle=pat;
  }
  ctx.fillRect(0,0,TCW,TCH);
  drawRoomFloor(ctx);                                 // พื้นจริงของร้านทับครึ่งล่าง = ตู้มีที่ยืน
  const g=ctx.createLinearGradient(0,0,0,TCH);        // บนสว่างอมทอง ล่างจมมืด
  g.addColorStop(0,'rgba(255,236,205,0.05)');
  /* ไล่มืดเบาลงจากเดิม (0.30/0.72) — ของเดิมจูนกับหินอ่อนดำ พอผนังเป็นวัสดุจริงของร้าน (ส่วนใหญ่สีอ่อน)
     เงาหนักขนาดนั้นกลบสีจริงจนผนังขาวกลายเป็นเทาหม่น ไม่ตรงกับที่เห็นหน้าร้าน */
  g.addColorStop(0.55,'rgba(6,14,18,0.14)');
  g.addColorStop(1,'rgba(4,10,13,0.42)');
  ctx.fillStyle=g; ctx.fillRect(0,0,TCW,TCH);
  const v=ctx.createRadialGradient(TCW/2,TCH*0.48,Math.min(TCW,TCH)*0.28,
                                   TCW/2,TCH*0.48,Math.max(TCW,TCH)*0.72);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,0.32)');   // วิกเนตต์ ดึงสายตาเข้าตู้ (เบาลงเพื่อให้สีผนังจริงยังอ่านออก)
  ctx.fillStyle=v; ctx.fillRect(0,0,TCW,TCH);
  return true;
}
function sandPattern(ctx){
  if(!_sandImg){ _sandImg=new Image(); _sandImg.src='assets/sand.jpg'; }
  if(!_sandImg.complete || !_sandImg.naturalWidth) return null;
  if(!_sandPat) _sandPat=ctx.createPattern(_sandImg,'repeat');
  return _sandPat;
}
/* เตรียมของที่ใช้เฉพาะในตู้ไว้ตอนเบราว์เซอร์ว่าง — เดิมโหลด/ถอดรหัสภาพทราย และคำนวณผืนลายแสง
   ตอนกดเข้าตู้ครั้งแรก ซ้อนกับงานวาดเฟรมแรกพอดี (ตู้กระตุกตอนเปิด) · ทำครั้งเดียวต่อการโหลดหน้า */
(window.requestIdleCallback||setTimeout)(()=>{
  if(!_sandImg){ _sandImg=new Image(); _sandImg.src='assets/sand.jpg'; }
  _sandImg.decode?.().catch(()=>{});
  (window.requestIdleCallback||setTimeout)(()=>{ try{ causticCanvas(); }catch(e){} });
});
function sandFill(ctx, ox, oy, zoom, cw, dx, dy){        // คืน pattern ที่วางแนวแล้ว (null = ใช้สีล้วนแทน)
  const pat=sandPattern(ctx);
  if(!pat || !pat.setTransform || typeof DOMMatrix==='undefined') return null;
  const T=_sandImg.naturalWidth/(SAND_TEX_CM/CM_PER_CELL);   // px เท็กซ์เจอร์ ต่อ 1 ช่องเล็ก
  if(window.DecorGLB?.ready&&tankMode&&curTank){
    const o=S(0,0,SAND_CELLS),x=S(1,0,SAND_CELLS),y=S(0,1,SAND_CELLS);
    pat.setTransform(new DOMMatrix([(x.x-o.x)/T,(x.y-o.y)/T,(y.x-o.x)/T,(y.y-o.y)/T,o.x,o.y]));
  }else pat.setTransform(new DOMMatrix([cw*zoom/T, 0, dx*zoom/T, -dy*zoom/T, ox, oy]));
  return pat;
}

/* ================= ลายแสงใต้น้ำ (caustics) =================
   ผืนเดียว ปูซ้ำได้สนิท เพราะทุกคลื่นใช้ความถี่จำนวนเต็มรอบผืน
   แล้ววาดซ้อนสองชั้น สเกล/ทิศ/ความเร็วต่างกัน — จังหวะแทรกสอดของสองชั้น
   ทำให้ลายบิดเปลี่ยนตลอดเวลาโดยไม่ต้องเรนเดอร์ใหม่ทีละเฟรม (ถูกมาก) */
const CAUSTIC_CM = 115;           // 1 ผืน = กี่ ซม. (มากขึ้น = ตาข่ายใหญ่ขึ้น เส้นห่างขึ้น)
const CAUSTIC_A  = 0.20;          // ความแรงบนพื้นทราย
const CAUSTIC_OBJ= 0.16;          // ความแรงที่ทาบบนตัวทาก/หิน (0 = ไม่ทาบ)
let _cauC=null, _cauPat=null;
function causticCanvas(){
  if(_cauC) return _cauC;
  const N=256, c=document.createElement('canvas'); c.width=c.height=N;
  const x=c.getContext('2d'), id=x.createImageData(N,N), d=id.data;
  const W=[[2,1,0.0],[-1,2,1.7],[1,-2,3.1],[3,2,2.2]];   // 4 ลูก ความถี่ต่ำ = ตาข่ายโปร่ง เส้นน้อย
  const P2=Math.PI*2;
  for(let j=0;j<N;j++){
    for(let i=0;i<N;i++){
      const u=i/N*P2, v=j/N*P2;
      let s=0; for(const w of W) s+=Math.sin(u*w[0]+v*w[1]+w[2]);
      const ridge=Math.pow(Math.max(0,1-Math.abs(s)/W.length), 11);  // เลขยิ่งสูง เส้นยิ่งบาง ยอดยิ่งไม่ฟุ้งกินพื้นที่
      let lo=0; for(let m=0;m<2;m++) lo+=Math.sin(u*(m+1)+v*(2-m)+m*2.3);
      const a=Math.min(1, ridge*(0.65+0.35*(lo/2+0.5)))*255;
      const k=(j*N+i)*4;
      d[k]=206; d[k+1]=236; d[k+2]=240; d[k+3]=a;   // ขาวอมฟ้า ไม่ใช่ขาวจัด ทรายสว่างอยู่แล้วจะได้ไม่โอเวอร์
    }
  }
  x.putImageData(id,0,0);
  return (_cauC=c);
}
/* แพตเทิร์นลายแสงที่วางบนระนาบพื้น พร้อมเลื่อนตามเวลา */
function causticPat(ctx, sc, dx, dy, zTop){
  const src=causticCanvas();
  if(!_cauPat) _cauPat=ctx.createPattern(src,'repeat');
  const pat=_cauPat;
  if(!pat || !pat.setTransform || typeof DOMMatrix==='undefined') return null;
  const z=tankCam.zoom, T=(src.width/(CAUSTIC_CM/CM_PER_CELL))*sc;
  const o=S(0,0,zTop);
  if(window.DecorGLB?.ready&&tankMode){
    const a=S(1,0,zTop),b=S(0,1,zTop),ux=a.x-o.x,uy=a.y-o.y,vx=b.x-o.x,vy=b.y-o.y;
    pat.setTransform(new DOMMatrix([ux/T,uy/T,vx/T,vy/T,o.x+dx*ux+dy*vx,o.y+dx*uy+dy*vy]));return pat;
  }
  const ox=o.x+(dx*CELLW+dy*DEPX)*z, oy=o.y-dy*DEPY*z;    // เลื่อนต้นทางไปตามระนาบพื้น
  pat.setTransform(new DOMMatrix([CELLW*z/T, 0, DEPX*z/T, -DEPY*z/T, ox, oy]));
  return pat;
}
/* เทลายแสง 2 ชั้นลง ctx ที่ให้มา (ใช้ทั้งตอนอบลงชั้นลูก และตอนวาดตรงเป็นทางสำรอง) */
function causticPaint(x, quad, amt, zTop, ms){
  x.save();
  x.globalCompositeOperation='lighter';
  const L=[ {sc:1.00, dx: ms*0.16+Math.sin(ms*0.23)*0.9, dy: ms*0.07+Math.cos(ms*0.19)*0.7, a:1.00},
            {sc:1.27, dx:-ms*0.11+Math.cos(ms*0.17)*1.1, dy: ms*0.13+Math.sin(ms*0.29)*0.8, a:0.62} ];
  for(const l of L){
    const pat=causticPat(x, l.sc, l.dx, l.dy, zTop); if(!pat) break;
    x.globalAlpha=amt*l.a; x.fillStyle=pat;
    x.beginPath(); quad.forEach((p,k)=> k?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y));
    x.closePath(); x.fill();
  }
  x.restore();
}
/* วาดลายแสงลงบนรูปสี่เหลี่ยมที่ให้มา (ต้อง clip ไว้ก่อนเรียก ถ้าไม่อยากให้ล้น)
   ⚠ จุดที่เคยกินเวลาครึ่งหนึ่งของทั้งเฟรม: เทแพตเทิร์นบิดเมทริกซ์ 2 ชั้น × 2 รอบ
   (พื้นทราย + ทาบวัตถุ) ทุกเฟรม แพตเทิร์นแบบบิดเมทริกซ์ปูซ้ำทางเร็วไม่ได้
   ตอนนี้อบลงแคนวาสลูกครึ่งความละเอียดที่ 24fps แล้ว blit ทุกเฟรม = ถูกลง ~10 เท่า */
function drawCaustics(ctx, quad, amt, zTop){
  if(amt<=0) return;
  const ms=performance.now()/1000;
  const puls=0.88+0.12*Math.sin(ms*0.62);               // หายใจช้า ๆ ให้ไม่นิ่งเป็นสติกเกอร์
  const b=_lay.box;
  if(!b || !_lay.cau || !_layOK){ causticPaint(ctx, quad, amt*puls, zTop, ms); return; }
  const now=performance.now();
  if(_lay.cauF!==_tankFrame && (!_lay.cauT || now-_lay.cauT >= 1000/CAU_FPS)){
    _lay.cauT=now; _lay.cauF=_tankFrame;
    const q=[{x:0,y:0},{x:b.w,y:0},{x:b.w,y:b.h},{x:0,y:b.h}];
    intoLayer(_lay.cau, b, CAU_SCALE, x=> causticPaint(x, q, 1, zTop, ms));
  }
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  quad.forEach(p=>{ if(p.x<x0)x0=p.x; if(p.x>x1)x1=p.x; if(p.y<y0)y0=p.y; if(p.y>y1)y1=p.y; });
  x0=Math.max(0,x0); y0=Math.max(0,y0); x1=Math.min(TCW,x1); y1=Math.min(TCH,y1);
  if(x1<=x0 || y1<=y0) return;
  ctx.save();
  ctx.beginPath(); quad.forEach((p,k)=> k?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.clip();
  ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=amt*puls;
  blitLayer(_lay.cau, b, {x0,y0,x1,y1});
  ctx.restore();
}

/* ---- ลายไม้: สร้างเองเป็นแคนวาส 256×256 ปูซ้ำได้ (ไม่มีไฟล์เท็กซ์เจอร์ไม้ให้) ----
   เสี้ยนวิ่งแนวนอน ใช้ sin ที่คาบลงตัวกับความกว้างผืน ขอบซ้าย-ขวาจึงต่อกันสนิท */
const WOOD_TEX_CM = 180;          // 1 ผืน = กี่ ซม. (มากขึ้น = ลายไม้เล็กลง)
let _woodC=null, _woodImg=null;
/* ใช้เท็กซ์เจอร์ไม้จริงถ้าโหลดได้ ถ้าไม่ได้ค่อยตกไปใช้ลายที่วาดเอง */
function woodSrc(){
  if(!_woodImg){ _woodImg=new Image(); _woodImg.src='assets/wood.jpg'; }
  if(_woodImg.complete && _woodImg.naturalWidth) return _woodImg;
  return woodCanvas();
}
function woodCanvas(){
  if(_woodC) return _woodC;
  const N=256, c=document.createElement('canvas'); c.width=c.height=N;
  const x=c.getContext('2d');
  x.fillStyle='#6a4d29'; x.fillRect(0,0,N,N);
  x.lineCap='round';
  for(let i=0;i<52;i++){
    const y0=(i+0.5)/52*N, k=1+(i*7)%3, amp=1.5+(i*11)%5, dark=(i%3===0), mid=(i%3===1);
    x.strokeStyle = dark? 'rgba(42,27,10,0.40)' : mid? 'rgba(150,113,63,0.22)' : 'rgba(96,68,34,0.30)';
    x.lineWidth  = dark? 1.7 : 1.0;
    x.beginPath();
    for(let px=0;px<=N;px++){
      const u=px/N*Math.PI*2;
      const y=y0 + Math.sin(u*k+i)*amp + Math.sin(u*(k+2)+i*2.3)*amp*0.45;
      px? x.lineTo(px,y) : x.moveTo(px,y);
    }
    x.stroke();
  }
  for(let i=0;i<3;i++){                                  // ตาไม้
    const cxk=(i*97)%N, cyk=(i*151)%N, r=5+i*3;
    for(let j=r;j>0;j-=2){
      x.strokeStyle='rgba(40,25,9,'+(0.05+0.03*j/r).toFixed(3)+')'; x.lineWidth=1.2;
      x.beginPath(); x.ellipse(cxk,cyk,j*1.9,j,0,0,6.283); x.stroke();
    }
  }
  return (_woodC=c);
}
/* pattern สำหรับ "หน้าตั้ง" (ผนังข้าง) — วางตามแนวขอบ a→b ที่ความสูง zt แล้วไล่ลงตามแกน z */
const _patCache = new Map();
function facePat(ctx, src, texCm, a, b, zt){
  if(!src || !ctx.createPattern) return null;
  let pat=_patCache.get(src);
  if(!pat){ pat=ctx.createPattern(src,'repeat'); if(pat) _patCache.set(src,pat); }
  if(!pat || !pat.setTransform || typeof DOMMatrix==='undefined') return null;
  const W = src.naturalWidth || src.width;
  const T = W/(texCm/CM_PER_CELL);                       // px เท็กซ์เจอร์ ต่อ 1 ช่องเล็ก
  const L = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1;       // ความยาวขอบ (ช่อง)
  const o = S(a[0],a[1],zt), q = S(b[0],b[1],zt);
  const down=S(a[0],a[1],zt-1);
  pat.setTransform(new DOMMatrix([(q.x-o.x)/(L*T),(q.y-o.y)/(L*T),(down.x-o.x)/T,(down.y-o.y)/T,o.x,o.y]));
  return pat;
}

/* ---- ของตกแต่ง: วาด / หาช่องพื้นจากจอ / ทดสอบคลิก ---- */
let selDecor=null, dragDecor=null, selDecorKey=null;
let dragGhost=null, decorHover=null;      // ตำแหน่งโกสต์ตอนลาก / ตอนเล็งจะวาง
let placeFlip=0;                          // ท่าของ "ชิ้นถัดไปที่จะวาง" (ปุ่ม F ตอนยังไม่ได้เลือกของในตู้)
let heldSlug=null, holdT=null, pendSlug=null;   // จิ้มค้าง/กดแล้วลาก = ยกทากขึ้นมา
let dragFood=null, dragFoodMoved=false;   // ลากย้ายอาหารที่วางไว้แล้ว (ได้ตลอดเวลา)
const HOLD_MS=180;                        // กดค้างนิ่ง ๆ นานเท่านี้ = ยกขึ้นเอง (ถ้าขยับก่อน ก็ยกทันที)
function slugAt(mx,my){
  let hit=null, hd=1e9;
  (curTank&&curTank.slugs||[]).forEach(s=>{ if(!s._hit) return;
    const d=Math.hypot(mx-s._hit.x, my-s._hit.y);
    if(d<=s._hit.r && d<hd){ hd=d; hit=s; } });
  return hit;
}
function cancelHold(){ if(holdT){ clearTimeout(holdT); holdT=null; } }
/* หน้าตอนถูกยก ＞＜ — อ่านตำแหน่งตาจากเอนจินโดยตรง
   ห้ามก๊อปพิกัดไว้ที่นี่อีก ไม่งั้นพอขยับ FACE แล้วตาท่ายกจะหลุดจากตาจริง */
function drawHeldFace(P, cx, cy, flip, k, base){
  const sgn=flip?-1:1, ox=(P.L+P.R)/2, oy=(P.T+P.B)/2;
  tctx.save(); tctx.lineCap='round'; tctx.lineJoin='round';
  (SlugEngine.FACE.eyes||[]).forEach((E,i)=>{
    const localX=E.u*P.bw;
    const u=Math.max(0,Math.min(1,(localX-P.L)/(P.R-P.L)));
    const eyeSag=k*(P.B-P.T)*0.105*Math.pow(Math.abs(u*2-1),2.15);
    const x=cx+sgn*k*(localX-ox), y=cy+k*(E.v*P.bh-oy)+eyeSag, r=k*P.bh*E.hR*0.5;
    
    
    tctx.strokeStyle='#11181b'; tctx.lineWidth=Math.max(1.1, r*0.40);
    const w=r*0.8, h=r*0.72, d=(i===0?-1:1)*sgn;          // ตาซ้าย ＞ · ตาขวา ＜ = ＞＜
    tctx.beginPath();
    tctx.moveTo(x-w*d, y-h); tctx.lineTo(x+w*d, y); tctx.lineTo(x-w*d, y+h); tctx.stroke();
  });
  tctx.restore();
}
/* ตาปิดตอนหลับ — ใช้พิกัด FACE ตัวจริงเหมือนท่าตอนยก */
function drawSleepFace(P, cx, cy, flip, k, base){
  const sgn=flip?-1:1, ox=(P.L+P.R)/2, oy=(P.T+P.B)/2;
  tctx.save(); tctx.lineCap='round'; tctx.lineJoin='round';
  (SlugEngine.FACE.eyes||[]).forEach(E=>{
    const x=cx+sgn*k*(E.u*P.bw-ox), y=cy+k*(E.v*P.bh-oy);
    const r=k*P.bh*E.hR*0.5, rw=r*(E.ar||0.68);
    
    
    tctx.strokeStyle='#11181b'; tctx.lineWidth=Math.max(1.1,r*0.28);
    tctx.beginPath();
    tctx.moveTo(x-rw*0.82,y); tctx.lineTo(x+rw*0.82,y); tctx.stroke();
  });
  tctx.restore();
}
/* หน้ามุ่งมั่นตอนหดชาร์จ/พุ่ง ＞＜ */
function drawDashFace(P, cx, cy, flip, k, base, charge, big=1){   // big = ขยาย ＞＜ (ชักเย่อใช้ 2.2 ให้อ่านออกในตู้)
  const sgn=flip?-1:1, ox=(P.L+P.R)/2, oy=(P.T+P.B)/2;
  const rise=(charge||0)*0.06;                              // หดชาร์จ = ยกตาขึ้นนิดหน่อย (ตาอยู่กับหน้าเสมอ ไม่หลุด)
  tctx.save(); tctx.lineCap='round'; tctx.lineJoin='round';
  (SlugEngine.FACE.eyes||[]).forEach((E,i)=>{
    const localX=E.u*P.bw;
    const x=cx+sgn*k*(localX-ox), y=cy+k*(E.v*P.bh-oy)-k*P.bh*rise, r=k*P.bh*E.hR*0.5*big;
    
    
    tctx.strokeStyle='#11181b'; tctx.lineWidth=Math.max(1.1,r*0.38);
    const w=r*0.8,h=r*0.66,d=(i===0?-1:1)*sgn;
    tctx.beginPath(); tctx.moveTo(x-w*d,y-h); tctx.lineTo(x+w*d,y); tctx.lineTo(x-w*d,y+h); tctx.stroke();
  });
  tctx.restore();
}
/* ตายิ้ม ⌣ — โผล่เป็นช่วง ๆ ตอนอยู่นิ่ง/ทักทาย (กลบตากลมแล้ววาดเส้นโค้งยิ้ม) */
function drawSmileFace(P, cx, cy, flip, k, base){
  const sgn=flip?-1:1, ox=(P.L+P.R)/2, oy=(P.T+P.B)/2;
  tctx.save(); tctx.lineCap='round'; tctx.lineJoin='round';
  (SlugEngine.FACE.eyes||[]).forEach(E=>{
    const x=cx+sgn*k*(E.u*P.bw-ox), y=cy+k*(E.v*P.bh-oy);
    const r=k*P.bh*E.hR*0.5, rw=r*(E.ar||0.68);
    
    
    tctx.strokeStyle='#11181b'; tctx.lineWidth=Math.max(1.1,r*0.30);
    tctx.beginPath(); tctx.arc(x,y-r*0.18,rw*1.0,0.15*Math.PI,0.85*Math.PI); tctx.stroke();  // เส้นโค้งยิ้ม
  });
  tctx.restore();
}
/* ตากลมปกติ — วาดเป็นเลเยอร์บนตัว (สไปรต์ไม่มีตาอบมาแล้ว) ให้เหมือนตาที่เอนจินเคยอบ
   ใช้รูปตาจากเอนจิน (SlugEngine.eyeImage) วางที่ตำแหน่ง FACE.eyes เดียวกับที่โค้ดเคยใช้กลบ
   พอมีแอคชั่นสลับตา ก็แค่ไม่เรียกอันนี้ (ตากลมหาย) จบแอคชั่นเรียกใหม่ = ตากลมกลับมา */
function drawDefaultEyes(P, cx, cy, flip, k){
  if(!P) return;
  const sgn=flip?-1:1, ox=(P.L+P.R)/2, oy=(P.T+P.B)/2;
  const img=(typeof SlugEngine!=='undefined')?SlugEngine.eyeImage:null;
  const ready=img && img.complete && img.naturalWidth>0;
  tctx.save(); tctx.lineCap='round'; tctx.lineJoin='round';
  (SlugEngine.FACE.eyes||[]).forEach(E=>{
    const x=cx+sgn*k*(E.u*P.bw-ox), y=cy+k*(E.v*P.bh-oy);
    const d=k*P.bh*E.hR, ew=d*(E.ar||1);
    if(ready){
      tctx.save(); tctx.translate(x,y); tctx.scale(sgn,1); tctx.rotate((E.rot||0)*Math.PI/180);
      tctx.drawImage(img, -ew/2, -d/2, ew, d); tctx.restore();
    } else {
      tctx.fillStyle='#12181b'; tctx.beginPath(); tctx.ellipse(x,y,ew*0.5,d*0.5,0,0,6.283); tctx.fill();
    }
  });
  tctx.restore();
}
/* ตาแอคชั่นตอนอยู่บนกำแพง — วาดในระบบพิกัดที่ 'หมุน/พลิก' แล้ว (เรียกก่อน restore ใน drawWallSlug)
   ใช้ flip=false เพราะสไปรต์บนกำแพงวาดท่ามาตรฐานแล้วหมุนเอา (ทิศหัวมาจาก rot ไม่ใช่ s.flip)
   กลบตากลมเดิม (ในสไปรต์) แล้ววาดตาสคริปต์ทับ · จบแอคชั่น = เฟรมถัดไปไม่วาด = ตาเดิมกลับมาเอง */
function drawWallActionFace(s,P,sa){
  if(!P) return;
  const k=P.s*sa, base=slugBaseHex(s.genes);
  if(s.state==='sleep') drawSleepFace(P,0,0,false,k,base);
  else if(s.state==='dashCharge'||s.state==='dash') drawDashFace(P,0,0,false,k,base,s.charge);
  else if((s.state==='rest'||s.state==='greet'||s.state==='wake'||s.state==='stretch') && smileNow(s)) drawSmileFace(P,0,0,false,k,base);
  else drawDefaultEyes(P,0,0,false,k);
}
/* ยิ้มไหมตอนนี้ — แต่ละตัวมีจังหวะสุ่มเป็นของตัวเอง ยิ้ม ~2.2 วิ ทุก ~14 วิ */
function smileNow(s){
  if(!Number.isFinite(s._smilePhase)){ let h=0; const id=''+(s.id||''); for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))>>>0; s._smilePhase=(h%1000)/1000*14; }
  const t=(performance.now()/1000 + s._smilePhase) % 14;
  return t < 2.2;
}
/* ฟองอากาศตอนจาม — ออกจาก "ทางหัว" แล้วลอยขึ้นเสมอ (เป็นฟองในน้ำ ไม่ได้พุ่งตามตัว)
   บนพื้นหัวชี้ซ้าย/ขวาตาม s.flip · บนกำแพงส่งทิศหัวจริงเข้ามาทาง (hx,hy) */
function drawSneezeBubbles(s, p, bodyLen, hx, hy){
  const q=s.sneeze||0;
  const ux=Number.isFinite(hx)?hx:(s.flip?1:-1), uy=Number.isFinite(hy)?hy:0;
  tctx.save(); tctx.lineWidth=Math.max(1,bodyLen*0.018);
  for(let i=0;i<3;i++){
    const z=Math.max(0,Math.min(1,q*1.65-i*0.23)); if(z<=0) continue;
    const d=bodyLen*(0.42+z*(0.16+i*0.05));
    const x=p.x+ux*d+(i-1)*bodyLen*0.02;
    const y=p.y+uy*d-bodyLen*(0.18+z*(0.24+i*0.06));
    const r=bodyLen*(0.025+i*0.009)*(0.35+Math.sin(Math.PI*z));
    tctx.globalAlpha=Math.sin(Math.PI*z)*0.82;
    tctx.strokeStyle='rgba(220,250,255,0.95)'; tctx.beginPath(); tctx.arc(x,y,r,0,6.283); tctx.stroke();
  }
  tctx.restore();
}
function drawSlugMood(s,p,bodyLen,P,cy,sa){
  if(s.state!=='greet' && s.state!=='flee') return;
  // This optional effect must not stop the tank animation if a sprite's
  // eye metrics are unavailable or a projected size is temporarily invalid.
  if(!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) ||
     !Number.isFinite(bodyLen) || bodyLen<=0) return;
  const eyes=(SlugEngine.FACE?.eyes||[]).filter(e=>e &&
    Number.isFinite(e.u) && Number.isFinite(e.v) && Number.isFinite(e.hR));
  const phase=Number.isFinite(s.ph)?s.ph:0;
  const bob=Math.sin(performance.now()/420+phase)*bodyLen*0.018;
  const direction=s.flip?-1:1;
  let x=p.x-direction*bodyLen*0.35, y=p.y-bodyLen*0.42+bob;
  if(eyes.length && P && [P.s,P.bw,P.bh,P.L,P.R,P.T,P.B,cy,sa].every(Number.isFinite)){
    const k=P.s*sa, ex=eyes.reduce((sum,e)=>sum+e.u,0)/eyes.length*P.bw;
    const ey=Math.min(...eyes.map(e=>(e.v-e.hR*0.5)*P.bh));
    const eyeX=p.x+direction*(ex-(P.L+P.R)/2)*k;
    const eyeY=cy+(ey-(P.T+P.B)/2)*k-bodyLen*0.12+bob;
    if(Number.isFinite(eyeX) && Number.isFinite(eyeY)){x=eyeX;y=eyeY;}
  }
  const gradientTop=y-bodyLen*0.07, gradientBottom=y+bodyLen*0.07;
  if(![x,y,gradientTop,gradientBottom].every(Number.isFinite)) return;
  tctx.save();
  tctx.lineWidth=Math.max(0.7,bodyLen*0.008); tctx.lineJoin='round';
  const paint=tctx.createLinearGradient(x,gradientTop,x,gradientBottom);
  if(s.state==='greet'){
    const r=Math.max(2.2,bodyLen*0.055);
    paint.addColorStop(0,'#ffe2ec'); paint.addColorStop(1,'#f59bbd');
    tctx.fillStyle=paint; tctx.strokeStyle='#d97fa3'; tctx.beginPath();
    tctx.moveTo(x,y+r*0.9); tctx.bezierCurveTo(x-r*1.5,y-r*0.1,x-r*0.9,y-r*1.2,x,y-r*0.35);
    tctx.bezierCurveTo(x+r*0.9,y-r*1.2,x+r*1.5,y-r*0.1,x,y+r*0.9); tctx.closePath(); tctx.fill(); tctx.stroke();
  } else {
    paint.addColorStop(0,'#e8fbff'); paint.addColorStop(1,'#98dbe9');
    tctx.fillStyle=paint; tctx.strokeStyle='#78b9d0'; tctx.beginPath();
    tctx.moveTo(x,y-bodyLen*0.07); tctx.quadraticCurveTo(x-bodyLen*0.06,y+bodyLen*0.03,x,y+bodyLen*0.075);
    tctx.quadraticCurveTo(x+bodyLen*0.06,y+bodyLen*0.03,x,y-bodyLen*0.07); tctx.closePath(); tctx.fill(); tctx.stroke();
  }
  tctx.restore();
}
function liftPending(){                    // เลื่อนสถานะจาก "กดค้างไว้" → "ยกขึ้นมาแล้ว"
  if(!pendSlug || heldSlug) return;
  heldSlug=pendSlug; selSlug=pendSlug; pendSlug=null;
  tDrag=false; cancelHold(); tankCv.style.cursor='grabbing';
}
function dropHeldSlug(){
  if(!heldSlug) return;
  const s=heldSlug; heldSlug=null;
  if(!curTank?.def){s.state='rest';s.stt=.8;return;}
  const SOLID=decorSolidSet(curTank&&curTank.decor);
  const mg=slugCm(s.genes)/CM_PER_CELL*0.55+0.2;
  const g=freeSpotNear(s.fx, s.fy, SOLID, isBreeder(curTank)?20:curTank.def.w, curTank.def.h, mg);
  s.fx=g.fx; s.fy=g.fy;                    // ปล่อยลงหิน → เด้งไปที่ว่างใกล้สุด
  s.state='rest'; s.stt=0.8+Math.random()*1.2;
}
/* ---- สไปรต์ย่อของของตกแต่ง ----
   เดิม drawDecorAt() สั่ง drawImage ย่อจากภาพเต็ม (อาร์ตหิน 1536×1024 · ชุด 3D 640×488)
   ลงเหลือ ~150 px ใหม่ทุกชิ้นทุกเฟรม = รีแซมเปิลภาพเดิมซ้ำ ๆ 60 ครั้ง/วินาที
   ย่อเก็บไว้ครั้งเดียวต่อขนาด แล้ว blit ตรง ๆ — วิธีเดียวกับสไปรต์ทากที่ทำไว้แล้วใน config.js
   เก็บแคชไว้บน entry ของ decorImg() จึงหายไปพร้อมกันเอง ไม่ต้องล้างเอง */
const DECOR_SPRITE_STEP=1.08;      // ขนาดต่างไม่ถึง 8% ใช้ใบเดิม (กันอบใหม่ทุกเฟรมตอนซูมลื่น ๆ)
function decorBitmap(e, w, h){
  const src=e.img, iw=src.naturalWidth||src.width;
  if(!iw||!(w>0)||!(h>0)) return src;
  if(w>iw*0.85) return src;                                  // ต้องการใหญ่พอ ๆ กับต้นฉบับ ย่อไปก็ไม่ได้อะไร
  let c=e._sprite;
  if(!c || !(w<c.width*DECOR_SPRITE_STEP && c.width<w*DECOR_SPRITE_STEP)){
    c=e._sprite=c||document.createElement('canvas');
    c.width=Math.max(1,Math.round(w)); c.height=Math.max(1,Math.round(h));
    const x=c.getContext('2d'); x.imageSmoothingQuality='high';
    x.drawImage(src,0,0,c.width,c.height);
  }
  return c;
}
/* วาดรูปของตกแต่งที่พิกัดใดก็ได้ (alpha ไว้ทำโกสต์) — คืนกล่องบนจอไว้ใช้ทดสอบคลิก */
function drawDecorAt(key, fx, fy, alpha, flip){
  const def=TANK_DECOR[key]; if(!def) return null;
  const e=decorImg(key);
  const p=S(fx, fy, SAND_CELLS);
  const w=def.wCm*(curTank?.def.decorScale||1)*depthPxPerCm();
  const h=(e.ok? w*(e.img.naturalHeight/e.img.naturalWidth) : w*0.8);
  const anc=def.anchor||{x:0.5,y:0.9};
  const ax=w*anc.x, ay=h*anc.y;
  tctx.save(); if(alpha!=null) tctx.globalAlpha=alpha;
  if(flip & 1){ tctx.translate(p.x,0); tctx.scale(-1,1); tctx.translate(-p.x,0); }        // กระจกรอบแกนที่ anchor
  if(flip & 2){ const my=p.y-ay+h/2;                                                       // กลับภาพในกรอบเดิม
    tctx.translate(0,my); tctx.scale(1,-1); tctx.translate(0,-my); }
  if(e.ok) tctx.drawImage(decorBitmap(e,w,h), p.x-ax, p.y-ay, w, h);
  else { tctx.fillStyle='rgba(90,100,105,0.5)'; tctx.fillRect(p.x-ax, p.y-ay, w, h); }
  tctx.restore();
  return { x: (flip & 1)? p.x-(w-ax) : p.x-ax, y:p.y-ay, w, h };
}
/* ระบายเซ็ตช่องพื้น (คีย์ "ix,iy") — ใช้โชว์พื้นที่ที่ถูกจอง / โกสต์ */
function paintCellSet(set, fill, stroke, lw){
  const z=SAND_CELLS+0.012;
  for(const k of set){ const c=k.split(','), x=+c[0]*DCELL, y=+c[1]*DCELL;
    fillQuad(S(x,y,z),S(x+DCELL,y,z),S(x+DCELL,y+DCELL,z),S(x,y+DCELL,z), fill, stroke, lw||1); }
}
function drawDecor(d){
  const box=drawDecorAt(d.key, d.fx, d.fy, d===dragDecor? 0.22 : null, d.flip);   // ตัวที่กำลังลาก จางไว้ โกสต์เป็นตัวนำ
  if(!box) return;
  d._hit=box;
  if(d===selDecor){
    tctx.strokeStyle='rgba(120,222,232,0.95)'; tctx.lineWidth=2; tctx.setLineDash([5,4]);
    tctx.strokeRect(box.x, box.y, box.w, box.h); tctx.setLineDash([]);
  }
}
function snapCell(v){ return Math.round(v*2)/2; }         // ยึดกริดครึ่งช่อง (ฐาน solid ตรงกริด)
function tankFloorAt(mx,my){                              // จอ → ช่องพื้น (บนผิวทราย)
  const fw=curTank.def.w, fh=curTank.def.h, z=tankCam.zoom;
  const A=(tankCam.oy - SAND_CELLS*ZH*z - my)/(DEPY*z);
  const fy=A+fh/2, fx=(mx-tankCam.ox-A*DEPX*z)/(CELLW*z)+fw/2;
  return { fx:Math.max(0,Math.min(fw,fx)), fy:Math.max(0,Math.min(fh,fy)) };
}
function decorAt(mx,my){                                  // ของหน้าสุดที่คลิกโดน
  let best=null;
  (curTank&&curTank.decor||[]).forEach(d=>{ const b=d._hit;
    if(b && mx>=b.x && mx<=b.x+b.w && my>=b.y && my<=b.y+b.h){ if(!best || d.fy<best.fy) best=d; } });
  return best;
}

/* ---- มาสก์ช่องของหิน (solid/หน้า/หลัง) หน่วยช่อง 0.5 ---- */
const DCELL=0.5;
const isCellList = arr => arr && arr.length && Array.isArray(arr[0]);
/* พลิกซ้าย-ขวารอบแกนตั้งที่ anchor — ช่องกิน [cx, cx+0.5] เมื่อพลิกจึงกลายเป็น [-cx-0.5, -cx]
   ต้อง -DCELL ด้วย ไม่งั้นมาสก์เลื่อนไปครึ่งช่องเวลาพลิก */
const fcx = (cx, flip) => (flip & 1) ? -cx-DCELL : cx;
/* flip เป็นบิต: 1 = กลับซ้าย-ขวา · 2 = กลับบน-ล่าง (บน-ล่างเป็นการกลับ "ภาพ" ในกรอบเดิม
   ฐานยังแตะพื้นที่เดิม มาสก์จึงไม่เปลี่ยน มีแต่บิต 1 เท่านั้นที่ขยับมาสก์) */
function flipOptions(key){                      // ท่าที่ชิ้นนี้อนุญาต ตามที่ตั้งไว้ใน Dec grid
  const f=(TANK_DECOR[key]||{}).flips;
  if(f===undefined || f===null) return [0,1];   // ของเก่าที่ไม่ได้ระบุ = พลิกซ้ายขวาได้
  const s=String(f).toLowerCase(), o=[0];
  if(s.includes('h')) o.push(1);
  if(s.includes('v')) o.push(2);
  if(s.includes('h') && s.includes('v')) o.push(3);
  return o;
}
function decorCellSet(o, listName){                       // เซ็ตช่องโลก (index) ของ list นั้น
  const def=TANK_DECOR[o.key], set=new Set(); if(!def) return set;
  const arr=def[listName]; if(!isCellList(arr)) return set;
  for(const [cx,cy] of arr) set.add(Math.round((o.fx+fcx(cx,o.flip))/DCELL)+','+Math.round((o.fy+cy)/DCELL));
  return set;
}
function decorSolidSet(decor){                            // รวมช่อง solid ของทุกก้อน
  const set=new Set(); if(!decor) return set;
  for(const o of decor){ const def=TANK_DECOR[o.key]; if(!def||!def.solid) continue;
    if(isCellList(def.solid)){ for(const [cx,cy] of def.solid) set.add(Math.round((o.fx+fcx(cx,o.flip))/DCELL)+','+Math.round((o.fy+cy)/DCELL)); }
    else { const w=def.solid[0],h=def.solid[1];           // rect เก่า → เติมช่อง 0.5
      for(let dx=-w/2; dx<w/2-1e-6; dx+=DCELL) for(let dy=-h/2; dy<h/2-1e-6; dy+=DCELL)
        set.add(Math.round((o.fx+dx)/DCELL)+','+Math.round((o.fy+dy)/DCELL)); }
  }
  return set;
}
function ptKey(x,y){ return Math.floor(x/DCELL)+','+Math.floor(y/DCELL); }

/* ที่ว่างใกล้สุดที่ไม่ใช่ช่อง solid — วนเป็นวงกลมออกไปทีละครึ่งช่อง
   ใช้ตอนสปอน / ตอนปล่อยทากลงหิน / ตอนวางหินทับทาก */
function freeSpotNear(fx, fy, SOLID, fw, fh, mg){
  const m = mg||0.5;
  const bad = (x,y)=> x<m||y<m||x>fw-m||y>fh-m || SOLID.has(ptKey(x,y));
  if(!bad(fx,fy)) return {fx,fy};
  for(let r=DCELL; r<=Math.max(fw,fh); r+=DCELL){
    let best=null, bd=1e9;
    for(let a=0;a<32;a++){
      const th=a/32*6.2832, x=fx+Math.cos(th)*r, y=fy+Math.sin(th)*r;
      if(bad(x,y)) continue;
      const d=(x-fx)*(x-fx)+(y-fy)*(y-fy);
      if(d<bd){ bd=d; best={fx:x, fy:y}; }
    }
    if(best) return best;
  }
  return {fx,fy};
}
/* กวาดทากทุกตัวที่ค้างอยู่ในช่อง solid ออกมาที่ว่าง — เรียกตอนเข้าตู้/วาง/ย้าย/ลบของ */
function nudgeSlugsOutOfSolid(slugs, fw, fh, decor){
  const SOLID=decorSolidSet(decor); if(!SOLID.size) return;
  slugs.forEach(s=>{
    if(s.fx===undefined || !SOLID.has(ptKey(s.fx,s.fy))) return;
    const g=freeSpotNear(s.fx, s.fy, SOLID, fw, fh, slugCm(s.genes)/CM_PER_CELL*0.55+0.2);
    s.fx=g.fx; s.fy=g.fy;
  });
}

/* ---- พื้นที่วาง (place) — ช่องที่ต้องว่างถึงจะวางของชิ้นนี้ลงไปได้ ----
   นิยามไหนยังไม่มี place → ใช้ solid แทน ของเก่าจึงวางได้เหมือนเดิม */
function decorFootprint(key, fx, fy, flip){
  const def=TANK_DECOR[key], set=new Set(); if(!def) return set;
  const arr = (def.place && def.place.length) ? def.place : def.solid;   // ยังไม่ได้ระบายเหลือง → ใช้ solid แทน
  if(!arr || !arr.length) return set;
  if(isCellList(arr)){ for(const [cx,cy] of arr) set.add(Math.round((fx+fcx(cx,flip))/DCELL)+','+Math.round((fy+cy)/DCELL)); }
  else { const w=arr[0],h=arr[1];                      // rect เก่า
    for(let dx=-w/2; dx<w/2-1e-6; dx+=DCELL) for(let dy=-h/2; dy<h/2-1e-6; dy+=DCELL)
      set.add(Math.round((fx+dx)/DCELL)+','+Math.round((fy+dy)/DCELL)); }
  return set;
}
/* วางตรงนี้ได้ไหม: ทุกช่องต้องอยู่ในพื้นตู้ และห้ามทับพื้นที่วางของชิ้นอื่น */

// Read the authored required-placement cells, before grid rounding. An anchor
// inside a compartment is insufficient: the complete required area must fit.
function decorRequiredBounds(key,fx,fy,flip){
 const def=TANK_DECOR[key];if(!def||!Number.isFinite(fx)||!Number.isFinite(fy))return null;
 const cells=def.place?.length?def.place:def.solid;if(!cells?.length)return null;
 let rectangles;
 if(isCellList(cells))rectangles=cells.map(([x,y])=>[fx+fcx(x,flip),fy+y,fx+fcx(x,flip)+DCELL,fy+y+DCELL]);
 else {const [w,h]=cells;rectangles=[[fx-w/2,fy-h/2,fx+w/2,fy+h/2]];}
 if(rectangles.some(r=>r.some(n=>!Number.isFinite(n))))return null;
 return {left:Math.min(...rectangles.map(r=>r[0])),top:Math.min(...rectangles.map(r=>r[1])),right:Math.max(...rectangles.map(r=>r[2])),bottom:Math.max(...rectangles.map(r=>r[3]))};
}
function decorFitsTankWalls(key,fx,fy,flip,tank){
 const b=decorRequiredBounds(key,fx,fy,flip);if(!b)return false;
 const eps=1e-8;if(b.left<-eps||b.top<-eps||b.right>tank.def.w+eps||b.bottom>tank.def.h+eps)return false;
 if(!isBreeder(tank))return true;
 const lo=fx<20?0:fx<25?20:25,hi=lo===0?20:lo===20?25:30;
 if(b.left<lo-eps||b.right>hi+eps)return false;
 return lo!==20||b.bottom<=1+eps||b.top>=tank.def.h-1-eps;
}

/* ⚠️ 2026-09-21 ผู้เล่น: "บอกสาเหตุเวลาวางของไม่ได้ด้วยว่าทำไมถึงวางไม่ได้"
   เหตุผลทุกข้อรวมอยู่ที่นี่ที่เดียว คืน '' = วางได้ · canPlaceDecor เป็นแค่เปลือกของฟังก์ชันนี้
   ข้อความต้องสั้นพอจะโชว์เป็นป้ายใต้เงาพรีวิวในตู้ได้ */
function decorPlaceIssue(key, fx, fy, flip, ignore){
  if(!curTank) return 'ยังไม่ได้เข้าตู้';
  const cm=n=>Math.round(n*CM_PER_CELL);
  const b=decorRequiredBounds(key,fx,fy,flip);
  if(!b) return 'ชิ้นนี้ไม่มีขนาดที่วางได้';
  const eps=1e-8;
  if(b.left<-eps||b.top<-eps||b.right>curTank.def.w+eps||b.bottom>curTank.def.h+eps)
    return 'ล้นขอบตู้ — เลื่อนเข้ามาให้ทั้งชิ้นอยู่ในตู้';
  /* เหลือแต่กฎของตู้เพาะพันธุ์: ห้ามคร่อมผนังกั้น และช่องผสมวางได้แค่แถบบน–ล่างสุด */
  if(!decorFitsTankWalls(key,fx,fy,flip,curTank))
    return 'ตู้เพาะพันธุ์: ห้ามคร่อมผนังกั้น · ช่องผสมตรงกลางวางได้แค่แถบบน–ล่างสุด';
  const NX=Math.round(curTank.def.w/DCELL), NY=Math.round(curTank.def.h/DCELL);
  const mine=decorFootprint(key,fx,fy,flip);
  if(curTank.def.race&&(fy<8||[...mine].some(k=>(Number(k.split(',')[1])*DCELL)<8)))
    return 'ลู่วิ่ง '+cm(8)+' ซม. หน้าตู้ต้องโล่ง';
  /* ตู้ชักเย่อ: แถบหน้าตู้ (ขอบหน้า → หลังเลน) ต้องโล่งเสมอ แบบตู้แข่งวิ่ง — ของที่อยู่หน้าเลนจะบังการแข่ง (config.js TUG_FRONT) */
  if(curTank.def.tug&&tugLaneBlocked(curTank.def,b.top,b.bottom))
    return 'เลนเชือก '+cm(TUG_FRONT)+' ซม. หน้าตู้ต้องโล่ง';
  /* ตู้แข่งกินจุ: แถบสนามหน้าตู้ต้องโล่งเสมอ — กันวางหินดักทางคู่แข่ง (slug-eat.js ARENA_H) */
  if(curTank.def.eat&&window.SlugEat&&!SlugEat.decorOk(curTank,mine,b))
    return 'สนามแข่งกินจุ '+cm(SlugEat.ARENA_H)+' ซม. หน้าตู้ต้องโล่ง';
  /* ตู้ปาหิน: ลานปาอยู่ชิดหน้าตู้ ต้องโล่งเหมือนกัน (ผู้เล่นขอ 2026-09-19 — slug-throw.js LANE_H) */
  if(curTank.def.throwing&&window.SlugThrow&&!SlugThrow.decorOk(curTank,mine,b))
    return 'ลานปาหิน '+cm(SlugThrow.LANE_H)+' ซม. หน้าตู้ต้องโล่ง';
  /* ตู้ดันวง: วงกลมอยู่ในแถบหน้าตู้ ต้องโล่งเหมือนกัน (slug-sumo.js ARENA_H) */
  if(curTank.def.sumo&&window.SlugSumo&&!SlugSumo.decorOk(curTank,mine,b))
    return 'สนามดันวง '+cm(SlugSumo.ARENA_H)+' ซม. หน้าตู้ต้องโล่ง';
  if(!mine.size) return '';
  if(isBreeder(curTank)){const zone=fx<20?[0,20]:fx<25?[20,25]:[25,30];for(const k of mine){const [ix,iy]=k.split(',').map(Number),x=ix*DCELL,y=iy*DCELL;
    if(x<zone[0]||x+DCELL>zone[1])return 'ตู้เพาะพันธุ์: ทั้งชิ้นต้องอยู่ในช่องเดียว ห้ามล้ำผนังกั้น';
    if(zone[0]===20&&!(fy<1?y>=0&&y+DCELL<=1:fy>=curTank.def.h-1&&y>=curTank.def.h-1&&y+DCELL<=curTank.def.h))return 'ช่องผสมพันธุ์วางของได้แค่แถบบนสุดกับล่างสุด';}}
  for(const k of mine){ const c=k.split(','), ix=+c[0], iy=+c[1];
    if(ix<0||iy<0||ix>=NX||iy>=NY) return 'ล้นขอบตู้ — เลื่อนเข้ามาให้ทั้งชิ้นอยู่ในตู้'; }
  for(const o of (curTank.decor||[])){ if(o===ignore) continue;
    for(const k of decorFootprint(o.key,o.fx,o.fy,o.flip)) if(mine.has(k))
      return 'ทับ'+(TANK_DECOR[o.key]?.name||'ของอีกชิ้น')+'อยู่ — เลื่อนไปที่ว่าง'; }
  return '';
}
function canPlaceDecor(key, fx, fy, flip, ignore){
  return !decorPlaceIssue(key, fx, fy, flip, ignore);
}
/* ป้ายเหตุผลใต้เงาพรีวิวในตู้ — ขนาดคงที่บนจอ (ไม่โตตามซูม) หนีบไม่ให้หลุดขอบแคนวาส */
function decorWhyLabel(text,fx,fy){
  const p=S(fx,fy,SAND_CELLS);
  tctx.save();
  tctx.font='600 13px "IBM Plex Sans Thai",sans-serif';tctx.textAlign='center';tctx.textBaseline='middle';
  const w=Math.min(TCW-16,tctx.measureText(text).width+20),h=24;
  const cx=Math.max(w/2+8,Math.min(TCW-w/2-8,p.x)),cy=Math.max(h/2+8,Math.min(TCH-h/2-8,p.y+28));
  tctx.fillStyle='rgba(58,20,18,.94)';tctx.beginPath();tctx.roundRect(cx-w/2,cy-h/2,w,h,h/2);tctx.fill();
  tctx.strokeStyle='rgba(255,150,136,.9)';tctx.lineWidth=1.4;tctx.stroke();
  tctx.fillStyle='#ffd9d2';tctx.fillText(text,cx,cy+1);
  tctx.restore();
}

/* กรอบจอของแคนวาสตู้ — แคชไว้ อ่านใหม่เฉพาะตอนขนาดเปลี่ยน (ResizeObserver / resize / เข้าตู้)
   ⚠️ 2026-09-16 เดิมอ่าน getBoundingClientRect ทุกเฟรม 3 ครั้ง (resizeTank + decor-glb beginTank/endTank)
      คั่นด้วย HUD/สไตล์ที่เพิ่งแก้ในเฟรมเดียวกัน = บังคับคำนวณ layout ซ้ำกลางเฟรม วัดได้ 20–60ms/วิ ในโหมดตู้ */
let tankRectCache=null;
function tankCvRect(){ return tankRectCache||(tankRectCache=tankCv.getBoundingClientRect()); }
if(typeof ResizeObserver==='function') new ResizeObserver(()=>{ tankRectCache=null; }).observe(tankCv);
addEventListener('resize',()=>{ tankRectCache=null; });
function resizeTank(){
  const r=tankCvRect(); TCW=r.width; TCH=r.height;
  const w=Math.round(TCW*DPR), h=Math.round(TCH*DPR);
  if(tankCv.width!==w || tankCv.height!==h){ tankCv.width=w; tankCv.height=h; }
}
/* กรอบพิกัดจอของตู้ทั้งหมด (ก้นขาตั้ง..ยอดกระจก) ที่ ox=oy=0 */
function tankBounds(){
  const fw=curTank.def.w, fh=curTank.def.h;
  const ox0=tankCam.ox, oy0=tankCam.oy; tankCam.ox=0; tankCam.oy=0;
  const wc=wallCells();
  const zb=-STAND_CELLS*STAND_SHOW;            // ก้นกรอบ = โชว์ฐานไม้แค่ 1/3 (ไม่ใช่ก้นขาตั้งเต็ม)
  const pts=[ S(0,0,zb),           S(fw,0,zb),
              S(0,0,wc),           S(fw,0,wc),
              S(0,fh,zb),          S(fw,fh,zb),
              S(0,fh,wc),          S(fw,fh,wc) ];
  tankCam.ox=ox0; tankCam.oy=oy0;
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  pts.forEach(p=>{ if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x; if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y; });
  return { minX,maxX,minY,maxY };
}
function centerTankCam(){
  const b=tankBounds();                       // tankBounds วัดที่ ox=oy=0 เสมอ
  tankCam.ox = TCW/2 - (b.minX+b.maxX)/2;     // จึงตั้งค่าแบบ absolute (ไม่ใช่ +=)
  tankCam.oy = TCH/2 - (b.minY+b.maxY)/2;     // ไม่งั้นเข้าตู้ซ้ำ/จัดซ้ำจะเลื่อนสะสม
}
/* กันแพนเกินขอบ: ถ้าตู้ใหญ่กว่าจอให้เต็มจอ ไม่โผล่พื้นว่าง · ถ้าเล็กกว่าให้อยู่กลาง */
function clampTankPan(){
  const b=tankBounds();                       // วัดที่ ox=oy=0
  const w=b.maxX-b.minX, h=b.maxY-b.minY;
  if(w<=TCW) tankCam.ox = TCW/2-(b.minX+b.maxX)/2;
  else       tankCam.ox = Math.min(-b.minX, Math.max(TCW-b.maxX, tankCam.ox));
  if(h<=TCH) tankCam.oy = TCH/2-(b.minY+b.maxY)/2;
  else       tankCam.oy = Math.min(-b.minY, Math.max(TCH-b.maxY, tankCam.oy));
}
/* จัดมุมมองตอนเข้าตู้: fit → ซูมเข้าอีก ~2 สเต็ป → โฟกัสจุดที่กด (ถ้ามี) · idempotent */
const ENTER_ZOOM = 3.0;                       // ซูมเข้าหนักๆ จากระดับพอดี (โฟกัสจุดที่กด)
const TANK_MAX_ZOOM = 5.0;
const TANK_SLUG_VIEW_SCALE = 0.7;             // ลดขนาดทาก "ในโหมดในตู้" ให้เข้าสัดส่วนกับที่เห็นจากนอกตู้ (1 = เท่าเดิม · เล็กลง = ค่าน้อยลง)
function applyEnterView(focus){
  if(isBreeder(curTank)||curTank.def.race||curTank.def.eat){fitTankZoom();centerTankCam();return;}
  fitTankZoom();
  const R=tankZoomRange();
  tankCam.zoom = Math.max(R.min, Math.min(Math.min(TANK_MAX_ZOOM, R.max), tankCam.zoom*ENTER_ZOOM));
  centerTankCam();
  if(focus){                                  // เลื่อนให้จุดที่กด (บนผิวทราย) มาอยู่กลางจอ
    const p=S(focus.fx, focus.fy, SAND_CELLS);
    tankCam.ox += TCW/2 - p.x; tankCam.oy += TCH/2 - p.y;
    clampTankPan();
  }
}
/* เลือกซูมให้ตู้ทั้งกว้าง+สูงพอดีจอ (กรอบสเกลเชิงเส้นกับ zoom) */
/* ซูมที่ทำให้ "ตู้ใบนี้" พอดีจอ — ขึ้นกับขนาดตู้ ไม่ใช่ค่าคงที่ (ไม่แตะกล้อง) */
function tankFitZoom(){
  const z0=tankCam.zoom; tankCam.zoom=1;
  const b=tankBounds(); tankCam.zoom=z0;
  const w=Math.max(1,b.maxX-b.minX), h=Math.max(1,b.maxY-b.minY);
  return Math.max(0.18, Math.min(4.0, Math.min(TCW*0.98/w, TCH*0.96/h)));  // เพดาน 4.0 (เดิม 2.2 กดไว้จนครอปฐานไม่ได้) — ฟิตกับกรอบที่โชว์ฐาน 1/3
}
/* เพดานซูมออก = พอดีจอ · เพดานซูมเข้า = ช่อง 5 ซม. โตได้สุด ~3.5 เท่า
   ตู้ใหญ่จะซูมออกได้น้อยกว่าตู้เล็กโดยอัตโนมัติ เพราะ fit ของมันต่ำกว่าอยู่แล้ว */
function tankZoomRange(){ const f=tankFitZoom(); return { min:f*phoneZoomOutScale(), max:Math.max(f*1.2, 3.5) }; }
function fitTankZoom(){ tankCam.zoom = tankFitZoom(); }
function enterTank(o, focus){
  if(typeof exitModes==='function') exitModes('tank');
  curTank=o; tankMode=true; selSlug=null; tankBuildMode=false; ov.classList.add('on'); tankRectCache=null;
  document.getElementById('ovBuild').textContent='🔧 จัดของ: ปิด';
  document.getElementById('ovTitle').textContent=o.def.name+' · '+(o.def.w*CM_PER_CELL)+'×'+(o.def.h*CM_PER_CELL)+'×'+tankGlassCm(o.def)+' ซม. · จุได้ '+tankCap(o.def)+' ตัว';
  resizeTank();
  o.slugs.forEach(s=> placeOnFloor(s,o));      // กระจายทากบนพื้น (ยังไม่รู้จักหิน)
  o.decor = o.decor || [];                     // รายการของตกแต่งในตู้
  nudgeSlugsOutOfSolid(o.slugs, o.def.w, o.def.h, o.decor);   // ตัวที่สุ่มลงกลางหิน ดันออกมาก่อน
  selDecor=null; selDecorKey=null; syncDecorBar();
  tankFocus = focus || null;                   // จุดที่กด (interior fx,fy) เพื่อโฟกัส
  applyEnterView(tankFocus);                   // จัดครั้งแรก (เผื่อขนาดพร้อมแล้ว)
  tankNeedFit=true;                            // จัดใหม่ในเฟรมแรกที่เลย์เอาต์นิ่ง (idempotent)
  syncOv();
  if(!tankLoopOn){ tankLoopOn=true; drawTank(); }
}
function exitTank(){ if(heldSlug)dropHeldSlug();pendSlug=null;cancelHold();if(typeof exitModes==='function') exitModes('tank');
  tankMode=false; curTank=null; ov.classList.remove('on');
  tankBuildMode=false; selDecorKey=null; selDecor=null; decorHover=null; dragGhost=null;
  const b=document.getElementById('ovBuild'); if(b) b.textContent='🔧 จัดของ: ปิด'; }
function syncOv(){ if(curTank) document.getElementById('ovCount').textContent=curTank.slugs.length; }

document.getElementById('ovBack').onclick=exitTank;
registerMode('tankDecor','tank',()=>tankBuildMode,()=>{ if(tankBuildMode) document.getElementById('ovBuild').click(); });
document.getElementById('ovBuild').onclick=()=>{
  tankBuildMode=!tankBuildMode;
  if(tankBuildMode) enterExclusiveMode('tankDecor');      // เปิดจัดของ = ปิดวางอาหาร/แปรงขัดให้เอง
  document.getElementById('ovBuild').textContent='🔧 จัดของ: '+(tankBuildMode?'เปิด':'ปิด');
  if(tankBuildMode){
    selDecorKey=null;                                  // ยังไม่เลือกของ = ยังไม่โชว์กริดวาง (เหลือง)
    toast('โหมดจัดของ: เลือกของจากแถบล่างเพื่อวาง · ลากของที่มีอยู่เพื่อย้าย · คลิกของแล้วกดลบ','good');
  } else { selDecorKey=null; selDecor=null; decorHover=null; dragGhost=null; }
  syncDecorBar();
};

/* ---------- แถบวางของตกแต่ง (โหมดจัดของ) ---------- */
let _decorBuilt=false;
function buildDecorBar(){
  if(_decorBuilt) return; _decorBuilt=true;
  const pal=document.getElementById('dpal'); if(!pal) return;
  Object.keys(TANK_DECOR).forEach(key=>{
    const b=document.createElement('button');
    b.className='dbtn'; b.dataset.key=key; b.textContent=TANK_DECOR[key].name+' · '+decorPrice(key);
    b.onclick=()=>{ selDecorKey = (selDecorKey===key? null : key);   // กดซ้ำ = วางมือ
      selDecor=null; decorHover=null; placeFlip=0; syncDecorBar(); };
    pal.appendChild(b);
  });
  const fl=document.getElementById('dFlip');
  if(fl) fl.onclick=flipDecor;
  const rm=document.getElementById('dRemove');
  if(rm) rm.onclick=()=>{
    if(!curTank || !selDecor){ toast('เลือกของในตู้ก่อน (คลิกที่ของ)','bad'); return; }
    const i=curTank.decor.indexOf(selDecor);
    if(i>=0){ const key=selDecor.key; curTank.decor.splice(i,1);
      /* เครดิตผูกกับ "ของชิ้นนี้ชนิดนี้" เท่านั้น ห้ามเป็นตั๋วฟรีใช้กับของชนิดไหนก็ได้
         (เดิมเป็นตัวเลขเดียวรวมทุกชนิด — เก็บของถูกแล้วเอาไปวางของแพงฟรีได้ เป็นช่องโหว่) */
      G.decorCredit=G.decorCredit||{}; G.decorCredit[key]=(G.decorCredit[key]||0)+1;
      toast('เก็บ'+TANK_DECOR[key].name+' · วาง'+TANK_DECOR[key].name+'ฟรีได้อีก 1 ชิ้น','good');
      if(typeof syncHUD==='function')syncHUD(); if(typeof saveGame==='function')saveGame(); if(typeof syncDecorBar==='function')syncDecorBar(); }
    selDecor=null; syncDecorBar();
  };
}
/* พลิกซ้าย-ขวา: ถ้าเลือกของในตู้อยู่ = พลิกชิ้นนั้น · ถ้าไม่ได้เลือก = พลิกทิศของชิ้นที่กำลังจะวาง */
const FLIP_NAME=['ด้านปกติ','กลับซ้าย-ขวา','กลับบน-ล่าง','กลับทั้งสองแกน'];
const FLIP_SYM =['·','↔','↕','⤢'];   // สัญลักษณ์กว้างเท่ากันทุกตัว ปุ่มจึงไม่ยืด-หด
function nextFlip(key, cur){                    // วนไปท่าถัดไปในลิสต์ที่ชิ้นนี้อนุญาต
  const o=flipOptions(key), i=o.indexOf(cur|0);
  return o[(i<0?0:i+1) % o.length];
}
function flipDecor(){
  if(!tankBuildMode) return;
  const holding = !!selDecorKey;                    // ถืออยู่ → พลิกของในมือเสมอ
  const key = holding ? selDecorKey : (selDecor && selDecor.key);
  if(!key) return;
  if(flipOptions(key).length<2){ toast(TANK_DECOR[key].name+' ตั้งไว้ว่าพลิกไม่ได้','bad'); return; }
  if(!holding && selDecor){
    const f=nextFlip(selDecor.key, selDecor.flip);
    const why=decorPlaceIssue(selDecor.key, selDecor.fx, selDecor.fy, f, selDecor);
    if(why){ toast('พลิกไม่ได้: '+why+' — ย้ายที่ก่อน','bad'); return; }
    selDecor.flip=f;
    nudgeSlugsOutOfSolid(curTank.slugs, curTank.def.w, curTank.def.h, curTank.decor);
    toast(typeof decorRotationName==='function'?decorRotationName(key,f):FLIP_NAME[f],'good');
  } else {
    placeFlip=nextFlip(selDecorKey, placeFlip);
    toast('ชิ้นที่จะวางถัดไป: '+(typeof decorRotationName==='function'?decorRotationName(key,placeFlip):FLIP_NAME[placeFlip]),'good');
  }
  syncDecorBar();
}
window.addEventListener('keydown', e=>{
  if(!tankMode || !tankBuildMode) return;
  if(e.key==='r'||e.key==='R'||e.key==='พ'){ e.preventDefault(); flipDecor(); return; }
  if(e.key==='Escape'){                            // เลิกถือ / เลิกเลือก
    if(selDecorKey){ selDecorKey=null; decorHover=null; toast('วางมือแล้ว','good'); }
    else selDecor=null;
    syncDecorBar();
  }
});
function syncDecorBar(){
  const bar=document.getElementById('ovDecor'); if(!bar) return;
  buildDecorBar();
  bar.hidden = !tankBuildMode;
  bar.querySelectorAll('.dbtn').forEach(b=> b.classList.toggle('on', b.dataset.key===selDecorKey));
  const rm=document.getElementById('dRemove'); if(rm) rm.disabled = !selDecor;
  const fl=document.getElementById('dFlip');
  if(fl){
    const key = selDecorKey || (selDecor && selDecor.key);      // ถืออยู่มาก่อน
    const cur = selDecorKey ? placeFlip : (selDecor? (selDecor.flip|0) : 0);
    const can = key ? flipOptions(key).length>1 : false;
    fl.disabled = !can;
    fl.classList.toggle('on', can && cur!==0);
    /* ความยาวข้อความต้องคงที่เป๊ะ — ถ้ายาว-สั้นสลับกัน แถบล่างจะจัดบรรทัดใหม่
       ความสูงแถบเปลี่ยน → แคนวาสเปลี่ยนขนาด → resizeTank() จัดกล้องใหม่ = ภาพกระตุกทุกครั้งที่กด R */
    fl.textContent = (typeof TidalDecor!=='undefined'&&TidalDecor.is(key))?'🔄 หมุน (R) '+cur*90+'°':'🔄 พลิก (R) ' + (can ? FLIP_SYM[cur] : '–');
  }
}
document.getElementById('ovAdd').onclick=()=>{
  if(!curTank) return;
  if(curTank.slugs.length+breederReserved(curTank)>=tankCap(curTank.def)){ toast('ตู้เต็มแล้ว (จุได้ '+tankCap(curTank.def)+' ตัว)','bad'); return; }
  if(!G.inv.length){ toast('คลังทากว่าง — สั่งซื้อกล่องสุ่มที่คอมพิวเตอร์ร้านก่อน','bad'); return; }
  const s=G.inv.shift(); placeOnFloor(s,curTank); curTank.slugs.push(s);
  toast('ใส่ทากลงตู้','good'); syncOv(); syncHUD();
};
document.getElementById('ovCollect').onclick=()=>{
  if(!curTank) return;
  if(!selSlug){ toast('คลิกเลือกทากในตู้ก่อน','bad'); return; }
  const idx=curTank.slugs.indexOf(selSlug);
  if(idx<0){ selSlug=null; return; }
  curTank.slugs.splice(idx,1);
  G.inv.push(selSlug);                       // เก็บกลับคลังทาก
  toast('เก็บทาก '+selSlug.id+' กลับคลัง','good');
  selSlug=null; syncOv(); syncHUD();
};

/* ---------- ตัวช่วยวาด ---------- */
function rrPath(c,x,y,w,h,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }

/* convex hull (monotone chain) ของชุดจุด {x,y} — ใช้หาเส้นรอบกล่องแก้วบนจอ */
function hull(pts){
  const p=pts.slice().sort((a,b)=> a.x-b.x || a.y-b.y);
  const cross=(o,a,b)=> (a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const lo=[]; for(const q of p){ while(lo.length>=2 && cross(lo[lo.length-2],lo[lo.length-1],q)<=0) lo.pop(); lo.push(q); }
  const up=[]; for(let i=p.length-1;i>=0;i--){ const q=p[i]; while(up.length>=2 && cross(up[up.length-2],up[up.length-1],q)<=0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}

function fillQuad(a,b,c,d,fill,stroke,lw){
  tctx.beginPath(); tctx.moveTo(a.x,a.y);tctx.lineTo(b.x,b.y);tctx.lineTo(c.x,c.y);tctx.lineTo(d.x,d.y);tctx.closePath();
  if(fill){ tctx.fillStyle=fill; tctx.fill(); }
  if(stroke){ tctx.strokeStyle=stroke; tctx.lineWidth=lw||1; tctx.stroke(); }
}

/* อัปเดตพฤติกรรมทากในตู้ (ใช้ร่วมกับหน้าร้าน) — เดิน↔พัก, เลี้ยวนุ่ม, แยกตัว, ชนช่อง solid ของหิน */
/* ===== ทากบนกำแพง = "พื้นอีกผืนหนึ่งที่ตั้งฉาก" =====
   พิกัดบนกำแพงคือ (fy, climbZ) — เดินได้สองแกนเหมือนพื้นทราย
   พฤติกรรมใช้ชุดเดียวกับบนพื้นทุกอย่าง (เดิน พัก หลับ ยืด จาม) ความเร็วเท่ากันเป๊ะ
   ต่างกันแค่ "โอกาสขึ้นกำแพง" กลายเป็น "โอกาสเดินลงพื้น" เมื่ออยู่บนกำแพงแล้ว
   ⚠️ เดิมเป็นสเตต climbUp/climb/climbDown ที่ขยับ climbZ ตามนาฬิกา (rise/CLIMB_RISE)
      = ไต่เร็วกว่าเดินจริง 6 เท่า และตอนเกาะค้างก็ "ไหลไปด้านข้าง" เพราะเลื่อน fy ตรง ๆ
      ตอนนี้ทุกการเคลื่อนที่ผ่านความเร็วเดินตัวเดียวกัน (SLUG_SPEED × พาซของตัวนั้น) */
function slugOnWall(s){ return !!s.wall; }
/* ---- ท่าเดิน/การหันหน้า ----
   FACE_STATES = สเตตที่ให้ "หันหน้าตามการเคลื่อนที่จริง" (รวมแรงผลักจากตัวอื่น)
   ส่วน eat/greet/inspect ตั้งหน้าไว้เองอยู่แล้ว ห้ามให้แรงผลักมาพลิกหน้า */
const FACE_STATES = ['walk','seekFood','seekDecor','seekNap','seekClimb','follow','dash','flee'];
const SEP_PUSH_MAX = 3.0;      // แรงผลักแยกตัวต่อเฟรม ไม่เกินกี่เท่าของความเร็วเดินปกติ
const EDGE_TURN_BOOST = 2.5;   // ใกล้ขอบตู้ให้หันไวขึ้นกี่เท่า (กันเดินชนขอบแล้วค้าง)
/* ระยะเผื่อจากขอบตู้ (หน่วยช่อง) — ต้องเป็น "ค่าเดียวกัน" ทั้งสามที่ ไม่งั้นทากไต่กำแพงไม่ขึ้น
   ⚠️ 2026-09-13 เคยเพี้ยนมาแล้ว: บล็อกบีบขอบท้ายเฟรมถูกขยายเป็น ×0.9+0.7 ("เผื่อเต็มความยาวลำตัว
   กันหงอนล้นกล่อง") แต่เป้าหมายของสเตต seekClimb ยังเป็น ×0.55+0.3 ของเดิม
   ห่างกัน ~0.93 ช่อง ขณะที่เกณฑ์ "ถึงแล้ว" คือ dist < 0.5 → ทากถูกบีบค้างอยู่ห่างเป้าตลอดกาล
   วัดได้: จำลอง 20 นาที ตั้งใจไปไต่ 37 ครั้ง ขึ้นกำแพงได้ 0 ครั้ง (26% ของเฟรมเดินไปหากำแพงเปล่า ๆ) */
function slugEdgeMargin(s, fw){ return Math.min(fw/2, slugCm(s.genes)/CM_PER_CELL*0.9 + 0.7); }
const CREEP_BODY_PER_CYCLE = 0.35;   // คืบหนึ่งรอบ = เคลื่อนที่กี่เท่าของความยาวตัว
const MOVE_STATES = ['walk','seekDecor','seekNap','seekClimb','follow','dash','flee','goDown'];
function slugWalking(s){ return MOVE_STATES.includes(s.state)||s.state==='seekFood'; }
/* ตัวคูณความเร็วเฉพาะตัว — แยกออกมาเพราะทั้งบนพื้นและบนกำแพงต้องใช้สูตรเดียวกันเป๊ะ
   (ก่อนหน้านี้บนกำแพงใช้นาฬิกาไต่ของตัวเอง เลยเร็วกว่าเดินจริง 6 เท่า) */
function slugPace(s){
  const t=s.traits||{};
  const em=0.70+(t.energy!=null?t.energy:0.5)*0.60;                        // คึก → เดินเร็ว
  const gm=7.5/slugCm(s.genes);                                            // ตัวใหญ่ → ช้าลง
  const hf=0.55+0.45*Math.min(1,(s.satiety==null?100:s.satiety)/60);       // หิว → เนือย
  return em*gm*hf;
}
/* ทิศบนจอของแกนกำแพง: เดินตาม fy = เฉียง (DEPX,−DEPY) · ไต่ขึ้น = ตรงขึ้น (0,−ZH)
   หันหัวไปทางที่เดิน แล้วเลือกด้านพลิกให้ "หลัง" (ฝั่งหงอน) ชี้เข้ากลางตู้เสมอ = ท้องแนบกระจก
   sgn = +1 ถ้าด้านในตู้อยู่ทางขวาของจอ (กำแพงซ้าย) · −1 ถ้าอยู่ทางซ้าย (กำแพงขวา) */
function slugWallPoseAxes(dir, ax, ay, bx, by, sgn){
  /* (ax,ay) = เวกเตอร์บนจอเมื่อเลาะไปตามกำแพง 1 ช่อง · (bx,by) = เมื่อไต่ขึ้น 1 ช่อง */
  let vx = Math.cos(dir)*ax + Math.sin(dir)*bx;
  let vy = Math.cos(dir)*ay + Math.sin(dir)*by;
  if(Math.abs(vx)+Math.abs(vy) < 1e-6){ vx=0; vy=-1; }     // ยืนนิ่งไร้ทิศ = ให้หัวชี้ขึ้น
  const a = Math.atan2(vy, vx);                 // มุมของ "ทิศที่หัวชี้" บนจอ
  const flipY = (-Math.sin(a)*sgn) <= 0;        // พลิกตามแกนลำตัว = สลับด้านหลัง-ท้อง (หัวยังชี้ทางเดิม)
  const da = a + (flipY ? -Math.PI/2 : Math.PI/2);
  return { rot:a+Math.PI, flipY,
           dx:Math.cos(da), dy:Math.sin(da),    // ทิศที่ "หลัง" ชี้ (ต้องเข้ากลางตู้เสมอ)
           hx:Math.cos(a),  hy:Math.sin(a) };   // ทิศที่ "หัว" ชี้ (ใช้วางฟองอากาศ)
}
function slugWallPose(s, sgn){
  const d = Number.isFinite(s.dir) ? s.dir : Math.PI/2;
  return slugWallPoseAxes(d, DEPX, -DEPY, 0, -ZH, sgn);
}
function slugWallLimits(s,fw,fh,def){
  const cm=slugCm(typeof foodGenes==='function'?foodGenes(s):s.genes);
  const parts=engineReady?slugPartsOf(s):null;
  const extent=parts?parts.w/(parts.bw*parts.s):1.6;
  const half=cm/CM_PER_CELL*CELLW/ZH*extent*.5+.65;
  const water=tankGlassCells(def||{w:fw,h:fh})*.88;
  const rise=Math.max(0,Math.min(CLIMB_MAX,water-SAND_CELLS-half*2-.3));
  return {half,water,rise};
}
function drawWallSlug(s,parts,sa){
  const left=s.wall!=='right', edge=left?0:(curTank.def.breeder?20:curTank.def.w), sgn=left?1:-1;
  const limits=slugWallLimits(s,curTank.def.w,curTank.def.h,curTank.def);
  const spr=tankSlugSprite(s,parts,sa,slugWalking(s),false);if(!spr)return null;
  const factor=sa/(spr.sa||sa),width=spr.w*factor,height=spr.h*factor;
  const floor=S(edge,s.fy,SAND_CELLS),water=S(edge,s.fy,limits.water);
  if(width>floor.y-water.y-2&&(curTank.def.shopSlugScale||1)===1)return null;
  const center=S(edge,s.fy,SAND_CELLS+limits.half+(s.climbZ||0));
  const pose=slugWallPose(s,sgn);
  /* ดันตัวออกจากกระจกครึ่งความหนา "ตามทิศที่หลังชี้" — ท่านอนเอียงก็ยังแนบกระจกพอดี */
  const x=center.x+pose.dx*(height/2+1), y=center.y+pose.dy*(height/2+1);
  tctx.save();tctx.translate(x,y);tctx.rotate(pose.rot);
  if(pose.flipY)tctx.scale(1,-1);
  tctx.drawImage(spr.c,-width/2,-height/2,width,height);drawWallActionFace(s,parts,sa);tctx.restore();
  s._hit={x,y,r:Math.max(20,width*.5)};
  return {x, y, hx:pose.hx, hy:pose.hy, len:width};
}
/* ทากเกาะกระจกแบบ 3D — ส่ง "แกนบนจอ" ชุดเดียวกับที่สไปรต์ 2D ใช้เข้าไปให้ Slug3D หมุนโมเดลจริง
   ต่างจาก 2D ตรงที่ไม่ต้องดันตัวออกจากกระจก เพราะจุดกำเนิดของโมเดลอยู่ที่ "ท้อง" อยู่แล้ว
   ตัวจึงงอกออกจากกระจกเข้าหากลางตู้เอง คืน null = วาดไม่ได้ ให้ตกไปใช้สไปรต์ต่อ */
function drawWallSlug3D(s,bodyLen){
  if(!(window.Slug3D&&Slug3D.ready&&Slug3D.enabled))return null;
  const left=s.wall!=='right', edge=left?0:(curTank.def.breeder?20:curTank.def.w), sgn=left?1:-1;
  const limits=slugWallLimits(s,curTank.def.w,curTank.def.h,curTank.def);
  const floor=S(edge,s.fy,SAND_CELLS),water=S(edge,s.fy,limits.water);
  if(bodyLen>floor.y-water.y-2&&(curTank.def.shopSlugScale||1)===1)return null;   // ตัวยาวเกินช่องน้ำ = ไม่วาด (เกณฑ์เดียวกับ 2D)
  const c=S(edge,s.fy,SAND_CELLS+limits.half+(s.climbZ||0));
  const pose=slugWallPose(s,sgn);
  if(!Slug3D.draw(tctx,s,c.x,c.y,bodyLen,false,null,{hx:pose.hx,hy:pose.hy,dx:pose.dx,dy:pose.dy}))return null;
  return {x:c.x, y:c.y, hx:pose.hx, hy:pose.hy, rot:pose.rot, len:bodyLen};
}

function stepTankSlugs(slugs, fw, fh, dt, doSep, obstacles, tankDef){
  if(tankDef?.breeder){slugs=slugs.filter(s=>{if(s.breedZone){walkBreedingZone(s,dt);return false;}return true;});}
  if(tankDef?.breeder)fw=20;
  if(tankDef?.noClimb)for(const s of slugs){
    if(s.wall||['seekClimb','climbUp','climb','climbDown','goDown'].includes(s.state)){
      s.wall=null;s.climbSide=null;s.climbZ=0;s.state='rest';s.stt=REST_MIN;
      delete s.intentX;delete s.intentY;delete s.climbDir;
    }
  }
  // Heal invalid runtime coordinates before feeding, steering or pair separation.
  for(const s of slugs){
    if(!Number.isFinite(s.fx)||!Number.isFinite(s.fy)){
      s.fx=Number.isFinite(s._lastGoodFx)?s._lastGoodFx:fw/2;
      s.fy=Number.isFinite(s._lastGoodFy)?s._lastGoodFy:fh/2;
      s.state='rest';s.stt=REST_MIN;s.dir=0;s.turn=0;s.climbZ=0;
    }
    if(!Number.isFinite(s.dir))s.dir=0;
    if(!Number.isFinite(s.turn))s.turn=s.dir;
    if(!Number.isFinite(s.ph))s.ph=0;
    if(!Number.isFinite(s.climbZ))s.climbZ=0;
    if(['seekDecor','seekNap','seekClimb'].includes(s.state)&&
       (!Number.isFinite(s.intentX)||!Number.isFinite(s.intentY))){
      s.state='rest';s.stt=REST_MIN;delete s.intentX;delete s.intentY;
    }
    s._lastGoodFx=s.fx;s._lastGoodFy=s.fy;
    s._frameX0=s.fx;s._frameY0=s.fy;      // ตำแหน่งต้นเฟรม — ใช้หาทิศที่ "เคลื่อนที่จริง" ตอนท้ายเฟรม
  }
  const SOLID=decorSolidSet(obstacles);
  if(typeof foodPrepare==='function')foodPrepare(slugs,fw,fh,obstacles,SOLID);
  if(typeof foodDecay==='function')foodDecay(slugs,dt);       // ความอิ่มค่อย ๆ ลดตามเวลา
  const hit=(x,y)=> SOLID.size>0 && SOLID.has(ptKey(x,y));
  /* วัดที่ "ขอบตัว" 4 ทิศ ไม่ใช่แค่จุดกึ่งกลาง — ไม่งั้นตัวทากล้ำเข้าไปในหินได้ครึ่งตัว */
  const blkAt=(x,y,r)=> hit(x,y)||hit(x+r,y)||hit(x-r,y)||hit(x,y+r)||hit(x,y-r);
  slugs.forEach(s=>{
    const rad=slugCm(s.genes)/CM_PER_CELL*0.35;
    const blk=(x,y)=>blkAt(x,y,rad);
    /* ⚠️ 2026-09-20 ผู้เล่น: "ทากยังบัคชนรัว ๆ อยู่เลย"
       ตัวหน่วง "ตัดสินใจหลบแล้วยึดไว้แป๊บนึง" — ดูจุดที่ใช้สองแห่งด้านล่าง (ชนตัวอื่น / ชนช่องตัน)
       ทั้งสองจุดเดิมสุ่มทิศหลบใหม่ทุกเฟรม ทำให้ s.turn เด้งไปมา 60 ครั้ง/วินาที
       s.dir ไล่ตามเป้าที่ขยับหนีตลอดจึงเลี้ยวไม่เคยจบ = ติดกันแล้วดันกันรัว ๆ ไม่หลุดสักที
       วัดได้: ตู้เพาะ 9 ตัว + หิน 18 ก้อน มีคู่ที่แตะกัน 2 คู่ค้างครบ 30 วินาทีเต็ม
       (ตู้เดียวกันแต่ไม่มีหิน = 0 คู่ → เป็นเคสโดนหนีบระหว่างหินกับทากอีกตัว) */
    s._avoidHold=Math.max(0,(s._avoidHold||0)-dt);
    s._solidFix=Math.max(0,(s._solidFix||0)-dt);   // คูลดาวน์ของการวาร์ปออกจากช่องตัน (ดูท้ายลูปนี้)
    if(!s.wall && typeof foodStep==='function'&&foodStep(s,dt,fw,fh,obstacles,SOLID))return;
    /* เซฟเก่า / โค้ดเก่า: สเตตไต่กำแพงแบบเดิม → ย้ายมาระบบ "กำแพงคือพื้นอีกผืน" */
    if(!s.wall && (s.state==='climbUp'||s.state==='climb'||s.state==='climbDown')){
      s.wall=s.climbSide||(s.fx<fw/2?'left':'right');
      s.state='walk'; s.stt=WALK_MIN+Math.random()*(WALK_MAX-WALK_MIN); s.dir=s.turn=Math.PI/2;
    }
    if(s.turn===undefined){ s.state=s.state||'rest'; if(s.stt===undefined) s.stt=Math.random()*REST_MAX; s.turn=s.dir||0; if(s.flip===undefined) s.flip=false; }
    s.stt-=dt;
    if(s.stt<=0){
      if(s.state==='sleep'){
        s.state='wake'; s.stt=WAKE_TIME; s.wake=0;
      } else if(s.state==='wake'){
        s.state='walk'; s.stt=WALK_MIN+Math.random()*(WALK_MAX-WALK_MIN); s.turn=Math.random()*6.283; s.wake=0;
      } else if(s.state==='dashCharge'){
        s.state='dash'; s.stt=DASH_TIME; s.charge=0;
      } else if(s.state==='dash'){
        s.state='rest'; s.stt=REST_MIN+Math.random()*(REST_MAX-REST_MIN);
      } else if(s.state==='inspect' || s.state==='greet' || s.state==='startle' || s.state==='stretch' || s.state==='sneeze' || s.state==='follow' || s.state==='flee' || s.state==='goDown'){
        s.state='rest'; s.stt=REST_MIN+Math.random()*(REST_MAX-REST_MIN);
      } else if(s.state==='walk'){
        /* โอกาสหลับหลังเดิน — ตัวขี้เซา (sleepy สูง) หลับบ่อยกว่าตัวคึก */
        const sleepy=0.18+((s.traits&&s.traits.sleepy)||0.4)*0.5;
        if(Math.random()<sleepy){
          const sleepers=s.wall?[]:slugs.filter(o=>o!==s && o.state==='sleep');
          if(sleepers.length && Math.random()<0.58){
            sleepers.sort((a,b)=>Math.hypot(a.fx-s.fx,a.fy-s.fy)-Math.hypot(b.fx-s.fx,b.fy-s.fy));
            const pal=sleepers[0], a=Math.atan2(s.fy-pal.fy,s.fx-pal.fx);
            const gap=(slugCm(s.genes)+slugCm(pal.genes))/CM_PER_CELL*0.46;
            const near=freeSpotNear(pal.fx+Math.cos(a)*gap,pal.fy+Math.sin(a)*gap,SOLID,fw,fh,rad+0.2);
            s.state='seekNap'; s.stt=8; s.intentX=near.fx; s.intentY=near.fy;
          } else { s.state='sleep'; s.stt=SLEEP_MIN+Math.random()*(SLEEP_MAX-SLEEP_MIN); }
        }
        else { s.state='rest'; s.stt=REST_MIN+Math.random()*(REST_MAX-REST_MIN); }
      } else if(s.wall){
        /* ---- อยู่บนกำแพง: กิจกรรมชุดเดียวกับบนพื้น ----
           ตัดเฉพาะอันที่ต้องเดินไปหา "ของบนพื้น" (ส่องหิน / ตามเพื่อน / นอนข้างเพื่อน)
           และ "โอกาสขึ้นกำแพง" กลายเป็น "โอกาสเดินลงพื้น" ตามที่ออกแบบไว้ */
        const t=s.traits||{}, r=Math.random();
        const pDown = 0.10 + (1-(t.bold||0.3))*0.12;     // ขี้กลัว → ลงพื้นเร็วกว่า
        let acc=0;
        if(r < (acc+=pDown)){ s.state='goDown'; s.stt=120; s.turn=-Math.PI/2; }
        else if(r < (acc+=0.12)){ s.state='stretch'; s.stt=STRETCH_TIME; s.stretch=0; }
        else if(r < (acc+=0.06)){ s.state='sneeze';  s.stt=SNEEZE_TIME;  s.sneeze=0; }
        else if(r < (acc+=0.22)){ s.state='rest';    s.stt=REST_MIN+Math.random()*(REST_MAX-REST_MIN); }
        else { s.state='walk'; s.stt=WALK_MIN+Math.random()*(WALK_MAX-WALK_MIN); s.turn=Math.random()*6.283; }
      } else {
        /* เลือกกิจกรรมถัดไป — น้ำหนักความน่าจะเป็นขึ้นกับนิสัยของตัวนั้น
           ทากคนละนิสัยจึงเลือกทำไม่เหมือนกัน = เอกลักษณ์รายตัว */
        const t=s.traits||{};
        const decor=(obstacles||[]).filter(d=>Number.isFinite(d.fx)&&Number.isFinite(d.fy));
        const friends=slugs.filter(o=>o!==s && o.state!=='sleep' && o.state!=='startle');
        const r=Math.random();
        const pDash   = 0.015 + (t.bold||0.3)*0.09;                        // กล้า → ดีดพุ่งบ่อย
        const pStretch= 0.12;
        const pSneeze = 0.06;
        const pClimb  = tankDef?.noClimb ? 0 : 0.04 + (t.bold||0.3)*0.07 + (t.curious||0.3)*0.05; // กล้า+ช่างสำรวจ → ไต่/เกาะ
        const pFollow = friends.length ? (0.08 + (t.social||0.3)*0.30) : 0;// เข้าสังคม → ตามเพื่อน
        const pDecor  = decor.length   ? (0.12 + (t.curious||0.3)*0.30) : 0;// ช่างสำรวจ → ส่องหิน
        let acc=0;
        if(r < (acc+=pDash)){
          s.state='dashCharge'; s.stt=DASH_CHARGE_TIME; s.charge=0;
        } else if(r < (acc+=pStretch)){
          s.state='stretch'; s.stt=STRETCH_TIME; s.stretch=0;
        } else if(r < (acc+=pSneeze)){
          s.state='sneeze'; s.stt=SNEEZE_TIME; s.sneeze=0;
        } else if(r < (acc+=pClimb)){
          const limits=slugWallLimits(s,fw,fh,tankDef);
          const mgW=slugEdgeMargin(s,fw);          // ต้องเท่ากับบล็อกบีบขอบเป๊ะ ไม่งั้นเดินไปเท่าไรก็ไม่ "ถึง"
          s.climbSide=s.fx<fw/2?'left':'right';
          s.intentX=s.climbSide==='left'?mgW:fw-mgW;s.intentY=s.fy;
          if(limits.rise<=0){s.state='rest';s.stt=REST_MIN;return;}
          /* ⚠️ เดิมให้เวลาคงที่ 9 วิ — ทากคลาน SLUG_SPEED 0.144 ช่อง/วิ (0.72 ซม./วิ)
             ระยะครึ่งตู้ = 10 ช่อง ต้องใช้ ~100 วิ จึงหมดเวลาก่อนถึงกำแพงทุกครั้ง
             วัดแล้ว 600 วิในตู้ M: ตั้งใจไต่ 11 ครั้ง ไปถึงกำแพง 0 ครั้ง = ไม่เคยได้ไต่เลย
             ตอนนี้ให้เวลาตามระยะจริง (เผื่อเลาะหลบหิน ~1.8 เท่า) */
          s.state='seekClimb';
          s.stt=Math.max(9, Math.min(150, Math.abs(s.intentX-s.fx)/(SLUG_SPEED*0.55)+6));
        } else if(friends.length && r < (acc+=pFollow)){
          const pal=friends[Math.floor(Math.random()*friends.length)];
          s.state='follow'; s.stt=FOLLOW_TIME; s.followId=pal.id;
        } else if(decor.length && r < (acc+=pDecor)){
          decor.sort((a,b)=>Math.hypot(a.fx-s.fx,a.fy-s.fy)-Math.hypot(b.fx-s.fx,b.fy-s.fy));
          const pick=decor[Math.min(decor.length-1,Math.floor(Math.random()*Math.min(3,decor.length)))];
          const near=freeSpotNear(pick.fx,pick.fy,SOLID,fw,fh,rad+0.25);
          s.state='seekDecor'; s.stt=9; s.intentX=near.fx; s.intentY=near.fy;
        } else {
          s.state='walk'; s.stt=WALK_MIN+Math.random()*(WALK_MAX-WALK_MIN); s.turn=Math.random()*6.283;
        }
      }
    }
    slugPoseTimers(s,dt);
    if(s.wall){
      /* ===== เดินบนกำแพง — พิกัด (fy, climbZ) ความเร็วชุดเดียวกับบนพื้นทุกอย่าง ===== */
      const margin=slugEdgeMargin(s,fw);
      s.fx=s.wall==='left'?margin:fw-margin;        // ตรึงตัวไว้กับกระจก
      s.climbSide=s.wall;                            // หน้าร้าน/เซฟรุ่นเก่ายังอ่านคีย์นี้
      delete s.climbDir;
      const lim=slugWallLimits(s,fw,fh,tankDef);
      if(lim.rise<=0){ s.wall=null; s.climbZ=0; s.state='rest'; s.stt=REST_MIN; }
      else{
        /* ⭐ บนกำแพงมีแค่ "ขึ้น" กับ "ลง" — ไม่เลาะข้าง ไม่เอียง
           ปัดทิศที่ตัวเลือกกิจกรรมสุ่มมา (0–360°) ให้เหลือสองค่าตามแกนตั้งเท่านั้น
           แล้ว "สแนป" dir = turn ทันที ไม่ค่อย ๆ เลี้ยวเหมือนบนพื้น
           ⚠️ ถ้าปล่อยให้เลี้ยวนุ่ม ตัวจะค่อย ๆ หมุนกลางกระจก = อาการ "บางตัวหมุนตัวได้"
              และถ้าปล่อยให้เดินตามแกน fy ด้วย ตัวจะเอียงตามเส้นทแยงของกำแพง = ดูแปลก */
        if(s.state==='goDown') s.turn=-Math.PI/2;
        s.turn = (Math.sin(s.turn)>=0) ? Math.PI/2 : -Math.PI/2;
        s.dir  = s.turn;
        if(MOVE_STATES.includes(s.state)){
          const mul=s.state==='dash'?DASH_SPEED:s.state==='flee'?FLEE_SPEED:1;
          const v=SLUG_SPEED*dt*mul*((s.state==='dash'||s.state==='flee')?1:slugPace(s));
          s.climbZ=(s.climbZ||0)+Math.sin(s.dir)*v;  // ขึ้น-ลงอย่างเดียว · fy คงที่ตรงจุดที่ปีนขึ้นมา
        }
        /* ชนเพดานน้ำ → กลับหัวลง */
        if(s.climbZ>lim.rise){ s.climbZ=lim.rise; s.turn=s.dir=-Math.PI/2; }
        /* ถึงก้นกระจก = ก้าวลงไปเดินบนทรายต่อ (ไม่ว่าจะตั้งใจลงหรือเดินเรื่อยเปื่อยลงมา) */
        if(s.climbZ<=0){
          s.climbZ=0; s.wall=null; s.climbSide=null;
          s.state='walk'; s.stt=WALK_MIN+Math.random()*(WALK_MAX-WALK_MIN);
          s.dir=s.turn=Math.atan2(fh/2-s.fy, fw/2-s.fx);   // หันเข้ากลางตู้แล้วเดินต่อ
          s.flip=Math.cos(s.dir)>0;
        }
      }
      if(s.wall) s.ph+=dt*(0.8+((s.traits&&s.traits.energy)||0.5)*0.5)*(MOVE_STATES.includes(s.state)?1.45:0.62);
    }else s.climbZ=0;
    if(s.state==='seekClimb'){
      const dx=s.intentX-s.fx, dy=s.intentY-s.fy, dist=Math.hypot(dx,dy);
      s.turn=Math.atan2(dy,dx);
      if(dist<0.5){ s.fx=s.intentX;s.fy=s.intentY;
        s.wall=s.climbSide=s.fx<fw/2?'left':'right'; s.climbZ=0;
        s.state='walk'; s.stt=WALK_MIN+Math.random()*(WALK_MAX-WALK_MIN);
        s.dir=s.turn=Math.PI/2;                       // เริ่มไต่ขึ้นตรง ๆ แล้วค่อยเดินเรื่อยเปื่อย
        delete s.intentX; delete s.intentY; }
    }
    if(s.state==='seekDecor'){
      const dx=s.intentX-s.fx, dy=s.intentY-s.fy, dist=Math.hypot(dx,dy);
      s.turn=Math.atan2(dy,dx);
      if(dist<1.15){
        s.state='inspect'; s.stt=INSPECT_TIME+Math.random()*1.2;
        delete s.intentX; delete s.intentY;
      }
    }
    if(s.state==='seekNap'){
      const dx=s.intentX-s.fx, dy=s.intentY-s.fy, dist=Math.hypot(dx,dy);
      s.turn=Math.atan2(dy,dx);
      if(dist<0.42){
        s.state='sleep'; s.stt=SLEEP_MIN+Math.random()*(SLEEP_MAX-SLEEP_MIN);
        delete s.intentX; delete s.intentY;
      }
    }
    if(s.state==='follow'){
      const pal=slugs.find(o=>o.id===s.followId);
      if(!pal){ s.state='rest'; s.stt=REST_MIN; delete s.followId; }
      else {
        const dx=pal.fx-s.fx, dy=pal.fy-s.fy, dist=Math.hypot(dx,dy);
        s.turn=Math.atan2(dy,dx);
        const hello=(slugCm(s.genes)+slugCm(pal.genes))/CM_PER_CELL*0.48;
        if(dist<hello){
          if(pal.state!=='greet'){
            s.state=pal.state='greet'; s.stt=pal.stt=GREET_TIME;
            pal.turn=Math.atan2(-dy,-dx); delete s.followId;
          }else{                                  // เพื่อนติดทักทายตัวอื่นอยู่ → เลิกตาม
            s.state='rest'; s.stt=REST_MIN; delete s.followId;   // เดิมเดินดันเข้าไปเรื่อย ๆ แล้วโดนแรงผลักดันถอย = มูนวอค
          }
        }
      }
    }
    /* เผื่อ "ระยะเลี้ยว" ตามความเร็วจริง — ตัวเล็กเดินเร็วกว่าตัวใหญ่ 1.7 เท่า (slugPace)
       เดิมเผื่อเท่ากันทุกตัว ตัวเล็กเลยถึงขอบก่อนหันเสร็จ → โดนบีบติดขอบ = เดินอยู่กับที่ */
    const m=slugCm(s.genes)/CM_PER_CELL*0.55 + 0.5 + SLUG_SPEED*slugPace(s)*1.6;
    const climbing = !!s.wall || s.state==='seekClimb';
    const nearEdge = !climbing && (s.fx<m||s.fx>fw-m||s.fy<m||s.fy>fh-m);
    if(nearEdge){
      s.turn=Math.atan2((fh/2)-s.fy,(fw/2)-s.fx);
      if(s.state!=='walk' && s.state!=='sleep' && s.state!=='wake' && s.state!=='startle' && s.state!=='stretch' && s.state!=='sneeze' && s.state!=='dashCharge' && s.state!=='flee'){
        s.state='walk'; s.stt=1.5+Math.random()*2; delete s.intentX; delete s.intentY;
      }
    }
    if(s.wall) return;                       // อยู่บนกำแพง = ใช้บล็อกเดินของกำแพงไปแล้ว
    let dd=((s.turn-s.dir+Math.PI*3)%(Math.PI*2))-Math.PI;
    s.dir+=dd*Math.min(1,dt*SLUG_TURN*(nearEdge?EDGE_TURN_BOOST:1));
    if(s.state==='walk' || s.state==='seekDecor' || s.state==='seekNap' || s.state==='seekClimb' || s.state==='follow' || s.state==='dash' || s.state==='flee'){
      const speedMul=s.state==='dash'?DASH_SPEED:s.state==='flee'?FLEE_SPEED:1;
      const paceMul=(s.state==='dash'||s.state==='flee')?1:slugPace(s);   // ดีด/หนีคงจังหวะเดิม
      const v=SLUG_SPEED*dt*speedMul*paceMul;
      let mvx=Math.cos(s.dir)*v, mvy=Math.sin(s.dir)*v;
      /* ---- หลบกันก่อนชน (2026-09-17 ผู้เล่น: "ทากกระตุกเวลาเดินชนกัน") ----
         เดิมเดินดันเข้าหากันเต็มก้าว แล้วแรงแยกตัวท้ายเฟรมผลักกลับได้ถึง SEP_PUSH_MAX เท่า
         → ระยะที่ขยับจริงกลับทิศไปมาทุกเฟรม · _motionHeading (หน้าของโมเดล 3D) พลิก 180° สลับกัน = กระตุก
         วัดได้: ทาก 10 ตัวเดินเข้ากลาง 20 วิ หน้าพลิก >90° 40 ครั้ง · ถอยหลัง 61 เฟรม
         ตอนนี้: ถ้าก้าวนี้พาเข้าใกล้ตัวที่อยู่ข้างหน้าในระยะชน ตัด "ส่วนที่พุ่งเข้าหา" ทิ้ง เหลือแต่ส่วนที่ไถลเลียบข้าง
         เดินอ้อมไปเองแบบลื่น ๆ · ไถลต่อไม่ได้ (ชนตรง ๆ) ค่อยเลี้ยวหลบทางขวา */
      if(!s.wall && s.state!=='dash' && s.state!=='flee'){
        for(const o of slugs){
          if(o===s||o.wall)continue;
          const ox=o.fx-s.fx, oy=o.fy-s.fy, d=Math.hypot(ox,oy)||1e-3;
          const reach=(slugCm(s.genes)+slugCm(o.genes))/CM_PER_CELL*0.42+v;
          if(d>reach)continue;
          const ux=ox/d, uy=oy/d, toward=mvx*ux+mvy*uy;
          if(toward<=0)continue;                                  // กำลังเดินออกห่างอยู่แล้ว
          mvx-=ux*toward; mvy-=uy*toward;                          // เหลือแต่ส่วนเลียบข้าง
          /* เลียบข้างได้น้อย (เดินชนเกือบตรง) = หยุดยืนแทนการไถลนิด ๆ — ไถลเศษก้าวแล้วโดนดันกลับทุกเฟรมคือต้นเหตุตัวสั่นกลางฝูง */
          if(Math.hypot(mvx,mvy)<v*0.5){
            mvx=0;mvy=0;
            /* ชนเข้า "ข้างตัว" อีกตัว = ให้ตัวนั้นเดินไปข้างหน้าหน่อยเพื่อหลบทาง (ผู้เล่นขอ 2026-09-17)
               ข้างตัว = ทิศหัวของมันเกือบตั้งฉากกับทิศที่เราเข้าหา · ไม่ปลุกตัวที่หลับ/กิน/ทักทาย/อยู่บนกระจก/ถูกยก */
            const side=Math.abs(Math.cos(o.dir)*ux+Math.sin(o.dir)*uy)<0.55;
            if(side&&!o.wall&&o!==heldSlug&&['rest','walk','inspect','stretch'].includes(o.state)){
              o.state='walk';o.stt=Math.max(o.stt||0,2.8);o.turn=o.dir;   // 2.8 วิ ≈ พ้นความยาวลำตัวของทั้งคู่ (1.2 วิเดิมได้แค่ครึ่งตัว ยังขวางอยู่)   // เดินตรงไปตามทิศที่หันอยู่ ไม่หันมาหาเรา
            }
            /* ⚠️ ต้องยึดทิศหลบไว้ _avoidHold วินาที — เดิมสุ่มใหม่ทุกเฟรม s.dir เลยไล่ตามเป้าที่ขยับหนีตลอด
               เลี้ยวไม่เคยจบ ทั้งคู่จึงดันกันอยู่กับที่ไม่หลุด (วัดได้: ค้างครบ 30 วินาทีเต็ม) */
            if(!['seekFood','follow','seekNap'].includes(s.state)&&(s._avoidHold||0)<=0){
              s.turn=s.dir-Math.PI/2*(0.6+Math.random()*0.3);   // ชนตรง ๆ = เลี้ยวขวาอ้อม (ทิศเดียวกันทุกตัว ไม่เลี้ยวชนกันซ้ำ)
              s._avoidHold=0.7;
            }
            break;
          }
        }
      }
      const nx=s.fx+mvx, ny=s.fy+mvy;
      if(!blk(nx,ny)){ s.fx=nx; s.fy=ny; }               // ชนช่อง solid → ไถลตามแกน/หันหนี
      else if(!blk(nx,s.fy)){ s.fx=nx; }
      else if(!blk(s.fx,ny)){ s.fy=ny; }
      /* ชนช่องตันทุกแกน — ยึดทิศหลบไว้เหมือนกัน ไม่งั้นสุ่มใหม่ทุกเฟรมแล้วสั่นอยู่หน้าหินไม่หลุด */
      else if((s._avoidHold||0)<=0){ s.turn=s.dir+Math.PI*(0.6+Math.random()*0.8); s.stt=Math.min(s.stt,0.5); s._avoidHold=0.7; }
    }
    /* (ทิศที่โมเดล 3D หัน `s._motionHeading` ย้ายไปตั้งท้ายเฟรมพร้อม s.flip แล้ว — ดูคอมเมนต์ตรงนั้น) */
    s.ph+=dt*(0.8+((s.traits&&s.traits.energy)||0.5)*0.5)*(s.state==='dash'?3.2:s.state==='flee'?2.35:(s.state==='walk'||s.state==='seekDecor'||s.state==='seekNap'||s.state==='seekClimb'||s.state==='follow')?1.45:s.state==='wake'?2.0:0.62);
    /* ค้างในช่อง solid → หาที่ว่างใกล้สุดแล้วย้ายไปเลย
       ⚠️ 2026-09-20 ผู้เล่น: "ทากยังบัคชนรัว ๆ อยู่เลย" — ต้นเหตุจริงอยู่บรรทัดนี้
       ระยะขอบที่ใช้ "หาที่ว่าง" กับที่ใช้ "บีบกลับเข้ากรอบ" ตอนท้ายเฟรม เป็นคนละค่า:
         freeSpotNear เดิมใช้ slugCm/CM*0.55+0.2  = 1.08 (ตัว 8 ซม.)
         ส่วน slugEdgeMargin ตอนท้ายเฟรมใช้ *0.9+0.7 = 2.14
       จุดที่หามาได้จึงอยู่นอกกรอบของตัวบีบ พอถูกบีบกลับก็ไปลงในหินอีก
       เฟรมถัดไป hit() จริงอีก → วาร์ปใหม่ → บีบกลับ → วน 60 ครั้ง/วินาทีไม่จบ
       วัดได้: ทาก 1 ตัวเดินสะสม 636 หน่วยใน 30 วินาที แต่ห่างจุดเริ่มแค่ 0.53
               กลับทิศ 1798 ครั้งจาก 1800 เฟรม (ทั้งที่สถานะเป็น "sleep")
       แก้: ใช้ระยะขอบตัวเดียวกัน แล้วลองบีบก่อนว่าจุดใหม่ยังว่างจริงถึงจะย้าย
            + คูลดาวน์กันยิงซ้ำทุกเฟรมถ้ายังหาที่ลงไม่ได้ */
    if(hit(s.fx,s.fy)&&(s._solidFix||0)<=0){
      const mg=slugEdgeMargin(s,fw), mx=Math.min(mg,fw/2), my=Math.min(mg,fh/2);
      const g=freeSpotNear(s.fx, s.fy, SOLID, fw, fh, mg);
      const gx=Math.max(mx,Math.min(fw-mx,g.fx)), gy=Math.max(my,Math.min(fh-my,g.fy));
      /* ย้ายได้จริง = ทำเลย ไม่ต้องรอคูลดาวน์ — จุดที่ได้ผ่านการบีบกรอบแล้วจึงไม่เด้งกลับ
         คูลดาวน์มีไว้สำหรับเคส "หาที่ลงไม่ได้" เท่านั้น กันไล่ค้นทั้งตู้ซ้ำทุกเฟรม */
      if(!hit(gx,gy)){ s.fx=gx; s.fy=gy; }
      else s._solidFix=0.5;
    }
  });
  if(doSep) for(let i=0;i<slugs.length;i++) for(let j=i+1;j<slugs.length;j++){
    const a=slugs[i], b2=slugs[j];
    if(slugOnWall(a)||slugOnWall(b2))continue;
    const min=(slugCm(a.genes)+slugCm(b2.genes))/CM_PER_CELL*0.42;
    let ex=a.fx-b2.fx, ey=a.fy-b2.fy, ds=Math.hypot(ex,ey)||0.001;
    if(ds<min){
      const meeting=a.state==='walk' && b2.state==='walk';
      const shy=(a.personality||0)+(b2.personality||0);
      const canFear=meeting && Math.random()<dt*(0.18+shy*0.18);
      const canGreet=meeting && !canFear && Math.random()<dt*0.9;
      if(canFear){
        const scared=Math.random()<(a.personality||0)/(shy||1) ? a : b2;
        const other=scared===a?b2:a;
        scared.state='flee'; scared.stt=FLEE_MIN+Math.random()*(FLEE_MAX-FLEE_MIN);
        scared.turn=Math.atan2(scared.fy-other.fy,scared.fx-other.fx);
      } else if(canGreet){
        a.state=b2.state='greet'; a.stt=b2.stt=GREET_TIME;
        a.turn=Math.atan2(b2.fy-a.fy,b2.fx-a.fx);
        b2.turn=Math.atan2(a.fy-b2.fy,a.fx-b2.fx);
      }
      /* เดิมดันให้พ้นกันในเฟรมเดียว = กระโดดข้างละครึ่งของระยะซ้อน (แรงกว่าก้าวเดินได้เป็นสิบเท่า)
         → เห็นเป็นตัวไถลถอยหลังทั้งที่ท่าเดินไปข้างหน้า · ตอนนี้จำกัดไม่เกิน SEP_PUSH_MAX เท่าของก้าวปกติ */
      const room=(min-ds)/2, step=Math.min(room, SLUG_SPEED*dt*SEP_PUSH_MAX), k=step/ds;
      a.fx+=ex*k; a.fy+=ey*k; b2.fx-=ex*k; b2.fy-=ey*k;
    }
  }
  // จำกัดขอบ "วัดที่ขอบตัว" — เผื่อครึ่งความยาวลำตัว (หน่วยช่อง) ไม่ให้หัว-ท้ายล้น
  slugs.forEach(s=>{
    /* เผื่อขอบเขตเดิน "เต็มความยาวลำตัว" (เดิมเผื่อแค่ครึ่งตัว 0.55 → หัว/ท้าย/หงอนล้นกล่องแล้วโดน clip) */
    const mg=slugEdgeMargin(s,fw);
    if(!Number.isFinite(s.fx)||!Number.isFinite(s.fy)){
      s.fx=s._lastGoodFx;s.fy=s._lastGoodFy;s.state='rest';s.stt=REST_MIN;s.dir=s.turn=0;
    }
    const mx=Math.min(mg,fw/2),my=Math.min(mg,fh/2);
    s.fx=Math.max(mx,Math.min(fw-mx,s.fx));
    s.fy=Math.max(my,Math.min(fh-my,s.fy));
    slugFaceAndCreep(s,dt);
    s._lastGoodFx=s.fx;s._lastGoodFy=s.fy;
  });
}
/* ---- นาฬิกาของ "ท่าทาง" ที่คิดจาก s.stt ----
   ⚠️ 2026-09-21 ผู้เล่น: "ทากในโซนผสมพันธุ์ กดแล้วหงอนไม่ค่อย ๆ ขึ้นมา"
   คลิกทาก = ตั้ง state 'startle' + startle=1 (หงอนหดเข้าตัว · slug-engine.js retract)
   แล้วค่านี้ต้องไล่ลงหา 0 ตามเวลา หงอนถึงจะค่อย ๆ ชูกลับขึ้นมา
   บล็อกนี้เคยอยู่ในลูปของ stepTankSlugs ซึ่งกรองทากโซนผสม (s.breedZone) ออกตั้งแต่ต้นฟังก์ชัน
   ทากในโซนจึงค้างที่ startle=1 ตลอดกาล = หงอนหดแล้วไม่กลับขึ้นมาอีกเลยจนกว่าจะย้ายออกจากโซน
   (บั๊กตระกูลเดียวกับ slugFaceAndCreep ด้านล่าง — โซนผสมเดินคนละลูป ต้องแชร์ฟังก์ชันกัน ไม่ก๊อปสูตร) */
function slugPoseTimers(s,dt){
  if(s.state==='wake') s.wake=Math.max(0,Math.min(1,1-s.stt/WAKE_TIME));
  if(s.state==='startle') s.startle=Math.max(0,Math.min(1,s.stt/STARTLE_TIME));
  else s.startle=0;
  s.look=Math.max(0,(s.look||0)-dt*0.75);
  s.stretch=s.state==='stretch' ? Math.sin(Math.PI*Math.max(0,1-s.stt/STRETCH_TIME)) : 0;
  s.sneeze=s.state==='sneeze' ? Math.max(0,Math.min(1,1-s.stt/SNEEZE_TIME)) : 0;
  s.charge=s.state==='dashCharge' ? Math.max(0,Math.min(1,1-s.stt/DASH_CHARGE_TIME)) : 0;
}
/* ---- หันหน้า + จังหวะคืบ ตาม "ที่ขยับจริง" ของทั้งเฟรม ----
   ⚠️ 2026-09-20 ผู้เล่น: "ทากในโซนผสมยังเดินมูนวอล์คได้อยู่ · ตัวเล็กระยะก้าวไกลไปเลยเดินกระตุก"
   ต้นเหตุเดียวกันทั้งคู่: บล็อกนี้เคยอยู่ในลูปท้าย stepTankSlugs ซึ่งทำงานกับ "slugs ที่ถูกกรองแล้ว"
   ทากในโซนผสม (s.breedZone) ถูก filter ออกตั้งแต่ต้นฟังก์ชัน และตัวอ่อนไม่ได้อยู่ใน o.slugs เลย
   สองกลุ่มนี้จึงไม่เคยได้อัปเดต s.flip / s._motionHeading / s.creepT สักครั้ง
     → s.flip กับ _motionHeading ค้างค่าเก่า = มูนวอล์คทั้ง 2D และ 3D
     → creepT ไม่เดิน = ท่าคืบไม่ขยับตามระยะที่เดินจริง
   แยกออกมาเป็นฟังก์ชันเพื่อให้ walkBreedingZone (breeding.js) เรียกใช้ชุดเดียวกันได้ */
function slugFaceAndCreep(s,dt){
    const ndx=s.fx-(s._frameX0??s.fx), ndy=s.fy-(s._frameY0??s.fy);
    /* ⚠️ กล้องในตู้เป็นภาพเฉียง: 1 ช่องลึก (fy) ดันภาพไปทางขวา DEPX=19 px ด้วย
       เดิมตัดสินหน้าจาก cos(dir) = แกน x ของ "โลก" อย่างเดียว → ช่วงมุม 90°–115.4°
       (เดินเฉียงขึ้นไปทางซ้าย) ตัวเลื่อนไปทางขวาบนจอแต่หันหน้าซ้าย = มูนวอค
       ต้องวัดจาก "การเลื่อนบนจอ" คือ ndx*CELLW + ndy*DEPX */
    const sdx=ndx*CELLW+ndy*DEPX;
    /* ⚠️ 2026-09-17 กันหน้าพลิกตอนโดนเบียด: ระยะที่ขยับ "สวนทางกับทิศที่ตั้งใจเดิน" (โดนแรงแยกตัวผลักถอย)
       ไม่ใช้ตั้งหน้า — ถ้าใช้ ตัวที่อัดกันกลางฝูงจะพลิกหน้าไป-กลับทุกเฟรม (กระตุก) · ขยับไปข้างหน้า/ข้าง ๆ ยังหันตามจริงเหมือนเดิม (กันมูนวอค) */
    const pushedBack=(ndx*Math.cos(s.dir)+ndy*Math.sin(s.dir))<-0.2*Math.hypot(ndx,ndy);
    if(!s.wall && FACE_STATES.includes(s.state) && !pushedBack && Math.abs(sdx)>SLUG_SPEED*dt*0.2*CELLW) s.flip=sdx>0;
    /* ⚠️ โมเดล 3D ไม่ได้ใช้ s.flip — มันหันตาม s._motionHeading (ดูจุดที่เรียก Slug3D.draw)
       ซึ่งเดิมตั้งไว้กลางเฟรมจาก "ก้าวเดินของตัวเอง" ก่อนแรงผลักระหว่างตัวและการบีบขอบ
       3D จึงยังมูนวอคอยู่ 4.6% ของเฟรมเดิน (เห็นชัด 2.7%) ทั้งที่สไปรต์ 2D แก้ไปตั้งแต่ 2026-09-07
       ตอนนี้วัดจาก ndx/ndy ชุดเดียวกับ s.flip · ต้องมี dead-band ด้วย ของเดิมใช้ 1e-7
       ซึ่งเล็กกว่าก้าวปกติเป็นหมื่นเท่า = สั่นระดับตามองไม่เห็นก็พลิกหน้าได้
       ใช้ระยะในโลก (ไม่ใช่แค่แกน x บนจอ) เพราะ 3D หันได้รอบตัว เดินลึกเข้าจอก็ต้องหันตาม */
    if(FACE_STATES.includes(s.state)){
      /* โมเดล 3D หันได้รอบตัว หน้าพลิกครั้งเดียวก็เห็นตัวหมุนวืบ (ผู้เล่น: "มีปัญหาโดยเฉพาะกับ 3D")
         เปลี่ยนทิศเกิน 100° ต้องขยับไปทางใหม่ต่อเนื่อง 0.25 วิก่อน ถึงยอมหันตาม · เลี้ยวปกติ (มุมน้อย) หันตามทันทีเหมือนเดิม */
      if(!pushedBack && Math.hypot(ndx,ndy)>SLUG_SPEED*dt*0.2){
        const want=Math.atan2(ndy,ndx),cur=Number.isFinite(s._motionHeading)?s._motionHeading:want;
        const diff=Math.abs(((want-cur+Math.PI*3)%(Math.PI*2))-Math.PI);
        if(diff<Math.PI*100/180){s._motionHeading=want;s._flipT=0;}
        else if((s._flipT=(s._flipT||0)+dt)>0.25){s._motionHeading=want;s._flipT=0;}
      }
    } else s._motionHeading=s.dir;                               // eat/greet/inspect ตั้งหน้าเอง
    if(!Number.isFinite(s._motionHeading)) s._motionHeading=s.dir;
    /* ---- จังหวะคืบผูกกับระยะทางที่เดินได้จริง ----
       เดิมท่าคืบวิ่งด้วยนาฬิกาจริง (sin(performance.now()/700)) รอบละ 4.4 วิเท่ากันหมด
       ตัวเล็กเดินเร็วกว่า จึงไถลไป 0.7 ช่วงตัวต่อการคืบหนึ่งรอบ (ตัวใหญ่ 0.25) = เห็นเป็นไถล/กระตุก */
    const movedCm=Math.hypot(ndx,ndy)*CM_PER_CELL;
    /* ⚠️ ต้องคูณ _breedScale ด้วย — ตัวอ่อนถูกย่อครึ่ง (_breedScale .5) ตอนวาด
       แต่ slugCm() คืนความยาว "ตอนโตเต็มวัย" เสมอ ถ้าไม่คูณ ระยะต่อการคืบหนึ่งรอบ
       จะเท่ากับ 0.35 ช่วงตัวผู้ใหญ่ = 0.7 ช่วงตัวจริงของมัน → ก้าวยาวเกินตัวสองเท่า เห็นเป็นไถล/กระตุก */
    const bodyCm=slugCm(s.genes)*(Number.isFinite(s._breedScale)?s._breedScale:1);
    if(movedCm>0&&bodyCm>0)s.creepT=(s.creepT||0)+movedCm/(CREEP_BODY_PER_CYCLE*bodyCm)*Math.PI*2;
}

/* ---------- ฉากในตู้ (มองจากด้านหน้า — ขอบหน้าตรง ไม่มีมุมแหลม) ----------
   ⚠️ 2026-09-18 เดิมต่อเฟรมถัดไป (requestAnimationFrame) ไว้ "บรรทัดสุดท้าย" ของฟังก์ชันวาด
      เฟรมไหนโยน error กลางทาง = ไม่มีใครต่อเฟรม ลูปตายถาวร · แถม tankLoopOn ยังเป็น true อยู่
      enterTank จึงไม่สตาร์ทลูปใหม่ → ตู้ค้างดำทั้งเกมจนกว่าจะรีเฟรชหน้า
      ตอนนี้แยกตัวห่อ: วาดพังก็แค่ข้ามเฟรมนั้น แล้วต่อเฟรมถัดไปเสมอ */
function drawTank(){
  try{ drawTankFrame(); }
  catch(e){ if(!drawTank._warned){drawTank._warned=true;console.warn('[tank] วาดตู้ไม่ผ่าน ข้ามเฟรมนี้',e);} }
  requestAnimationFrame(()=>{ if(tankMode) drawTank(); else tankLoopOn=false; });
}
function drawTankFrame(){
  if(document.hidden||window.SlugRace?.isOpen()){window.DecorGLB?.hide();return;}
  if(!curTank){return;}
  resizeTank();
  if(tankNeedFit){applyEnterView(tankFocus);tankNeedFit=false;}
  window.DecorGLB?.beginTank();
  window.Slug3D?.beginFrame();
  _tankFrame++;
  tctx.setTransform(DPR,0,0,DPR,0,0);
  tctx.clearRect(0,0,TCW,TCH);
  if(engineReady) SlugEngine.ANIM=true;            // ในตู้: เปิดอนิเมชันหงอน/คืบ
  if(!drawTankBg(tctx)){                           // ผนัง/พื้นจริงของร้าน · ถ้ารูปยังไม่มาใช้สีเดิมไปก่อน
    const bg=tctx.createLinearGradient(0,0,0,TCH);
    bg.addColorStop(0,'#0c3540'); bg.addColorStop(1,'#07222a');
    tctx.fillStyle=bg; tctx.fillRect(0,0,TCW,TCH);
  }
  if(window.SlugRace?.isRacing(curTank))SlugRace.updateTankFrame(performance.now());
  if(window.SlugTug?.isPulling(curTank))SlugTug.updateTankFrame(performance.now());
  if(window.SlugEat?.isEating(curTank))SlugEat.updateTankFrame(performance.now());
  if(window.SlugThrow?.isThrowing(curTank))SlugThrow.updateTankFrame(performance.now());
  if(window.SlugSumo?.isSumo(curTank))SlugSumo.updateTankFrame(performance.now());

  const fw=curTank.def.w, fh=curTank.def.h;
  const wallH=wallCells(), standH=STAND_CELLS, sandT=SAND_CELLS;   // ความสูง (หน่วยช่อง)

  // ด้านตั้ง 4 ด้านของตู้ (คู่ขอบ fx,fy) — ใช้เรียงลำดับลึกทุกส่วน
  const SIDES=[ {a:[0,0], b:[fw,0]},   // หน้า (ด้านยาว)
                {a:[fw,0],b:[fw,fh]},  // ขวา
                {a:[fw,fh],b:[0,fh]},  // หลัง
                {a:[0,fh],b:[0,0]} ];  // ซ้าย
  const face=(a,b,zb,zt)=>{ const p=[S(a[0],a[1],zt),S(b[0],b[1],zt),S(b[0],b[1],zb),S(a[0],a[1],zb)];
    return { p, d:(p[0].d+p[1].d+p[2].d+p[3].d)/4 }; };
  const qfill=(p,fill,stroke,lw)=>fillQuad(p[0],p[1],p[2],p[3],fill,stroke,lw);
  const byFar=(x,y)=>y.d-x.d;                                   // ไกล→ใกล้

  /* ---------- ชั้นนิ่ง: ขาตั้งไม้ + ผนังไกล + ชั้นทราย ----------
     ไม่มีอะไรขยับตามเวลาเลย → วาดครั้งเดียวลงแคนวาสลูก แล้ว blit ทุกเฟรม
     (เดิมเทเท็กซ์เจอร์ไม้/ทราย 8 หน้าใหม่ทุกเฟรม = งานเปล่า ๆ ที่แพงที่สุดรองจากลายแสง) */
  const drawChrome=()=>{
    const woodC=woodSrc();
    SIDES.map((s,i)=>({ ...face(s.a,s.b,-standH,0), i, s })).sort(byFar).forEach(f=>{
      const wp=facePat(tctx, woodC, WOOD_TEX_CM, f.s.a, f.s.b, 0);
      if(wp){ qfill(f.p, wp, null);
              qfill(f.p, (f.i%2? 'rgba(0,0,0,0.34)':'rgba(196,140,72,0.14)'), null); }
      else qfill(f.p, (f.i%2? '#453017':'#5b4128'), null);
    });
    SIDES.map(s=>face(s.a,s.b,sandT,wallH)).sort(byFar).slice(0,2)
         .forEach(f=> qfill(f.p,'rgba(70,120,130,0.24)','rgba(200,235,240,0.18)',1.1));
    SIDES.map((s,i)=>({ ...face(s.a,s.b,0,sandT), i, s })).sort(byFar).forEach(f=>{
      const sp=facePat(tctx, _sandImg, SAND_TEX_CM, f.s.a, f.s.b, sandT);
      if(sp){ qfill(f.p, sp, null);
              qfill(f.p, (f.i%2? 'rgba(70,46,12,0.62)':'rgba(70,46,12,0.46)'), null); }
      else qfill(f.p,'#8a6b35',null);
    });
    const a0=S(0,0,sandT),a1=S(fw,0,sandT),a2=S(fw,fh,sandT),a3=S(0,fh,sandT);
    const spat=sandFill(tctx, a0.x, a0.y, tankCam.zoom, CELLW, DEPX, DEPY);
    const gy0=Math.min(a2.y,a3.y), gy1=Math.max(a0.y,a1.y);
    let sandStyle='#d0b075';
    if(Number.isFinite(gy0) && Number.isFinite(gy1)){       // กัน NaN ทำ createLinearGradient throw = จอค้าง
      const sg=tctx.createLinearGradient(0,gy0,0,gy1);
      if(spat){ fillQuad(a0,a1,a2,a3, spat, null);
                sg.addColorStop(0,'rgba(150,112,52,0.42)'); sg.addColorStop(1,'rgba(228,190,126,0.20)'); }
      else { sg.addColorStop(0,'#c9a568'); sg.addColorStop(1,'#dcbb80'); }
      sandStyle=sg;
    } else if(spat){ fillQuad(a0,a1,a2,a3, spat, null); }
    fillQuad(a0,a1,a2,a3, sandStyle, null);
    if(curTank.def.race&&window.SlugRace)SlugRace.drawTrack(tctx,(x,y)=>S(x,y,sandT));
    if(curTank.def.tug&&window.SlugTug)SlugTug.drawLane(tctx,(x,y)=>S(x,y,sandT));
    if(curTank.def.eat&&window.SlugEat)SlugEat.drawArena(tctx,(x,y)=>S(x,y,sandT),curTank);
    if(curTank.def.throwing&&window.SlugThrow)SlugThrow.drawField(tctx,(x,y)=>S(x,y,sandT),curTank);
    if(curTank.def.sumo&&window.SlugSumo)SlugSumo.drawArena(tctx,(x,y)=>S(x,y,sandT),curTank);
  };
  /* ---------- ชั้นนิ่งที่อยู่ "หน้า" ตัวทาก: น้ำ + ผิวน้ำ + กระจกใกล้ ---------- */
  const drawGlass=(x)=>{
    const bh2=hull([S(0,0),S(fw,0),S(fw,fh),S(0,fh),S(0,0,wallH),S(fw,0,wallH),S(fw,fh,wallH),S(0,fh,wallH)]);
    x.save();
    x.beginPath(); bh2.forEach((p,k)=> k?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y)); x.closePath(); x.clip();
    x.fillStyle='rgba(64,140,150,0.10)'; x.fillRect(-1e5,-1e5,2e5,2e5);   // หนีบด้วย hull อยู่แล้ว เทกว้าง ๆ ได้
    x.restore();
    const wz=wallH*0.88;
    const v0=S(0,0,wz), v1=S(fw,0,wz), v2=S(fw,fh,wz), v3=S(0,fh,wz);
    fillQuad(v0,v1,v2,v3, 'rgba(95,180,190,0.15)', null);
    x.strokeStyle='rgba(205,242,246,0.6)'; x.lineWidth=1.6;
    x.beginPath(); x.moveTo(v0.x,v0.y); x.lineTo(v1.x,v1.y); x.lineTo(v2.x,v2.y); x.lineTo(v3.x,v3.y); x.closePath(); x.stroke();
    SIDES.map(s=>face(s.a,s.b,sandT,wallH)).sort(byFar).slice(2)
         .forEach(f=> qfill(f.p,'rgba(150,205,215,0.05)','rgba(200,235,240,0.24)',1.3));
  };
  const layKey=[window.DecorGLB?.viewRevision||0,TCW,TCH,DPR,tankCam.zoom.toFixed(4),fw,fh,wallH,!!curTank.def.race,!!curTank.def.tug,!!curTank.def.eat,!!curTank.def.throwing,!!curTank.def.sumo,
                (_sandImg&&_sandImg.naturalWidth)?1:0, texOK(woodSrc())?1:0].join('|');
  if(performance.now() >= _zoomBusyT && (_lay.key!==layKey || !layCovers())){
    const box=layBox();
    if(box.w*DPR<=4096 && box.h*DPR<=4096){
      _lay.key=layKey; _lay.box=box; _lay.cauT=0;
      _lay.chrome=newLayer(box,1); _lay.glass=newLayer(box,1); _lay.cau=newLayer(box,CAU_SCALE);
      intoLayer(_lay.chrome, box, 1, drawChrome);
      intoLayer(_lay.glass,  box, 1, drawGlass);
    } else { _lay.key=''; _lay.box=null; }
  }
  const haveLay = !!_lay.box && _lay.key===layKey;   // ซูมเปลี่ยน = layer เก่าไม่ตรง → วาดตรงแทน
  _layOK = haveLay;
  const vis={x0:0,y0:0,x1:TCW,y1:TCH};
  if(haveLay) blitLayer(_lay.chrome, _lay.box, vis); else drawChrome();

  // เส้นรอบกล่องแก้ว (convex hull ของ 8 มุม) — ใช้ clip ทาก/น้ำ ไม่ให้หลุดตู้
  const boxHull=hull([S(0,0),S(fw,0),S(fw,fh),S(0,fh),S(0,0,wallH),S(fw,0,wallH),S(fw,fh,wallH),S(0,fh,wallH)]);
  const clipHull=()=>{ tctx.beginPath(); boxHull.forEach((p,k)=> k?tctx.lineTo(p.x,p.y):tctx.moveTo(p.x,p.y)); tctx.closePath(); tctx.clip(); };
  /* กล่องเดียวกันแต่ "เปิดฝา" — ซ้าย/ขวา/ล่างยังตัดตามกระจก ส่วนบนปล่อยทะลุ
     ใช้กับของตกแต่ง+ทาก เพื่อให้หินที่สูงกว่าขอบตู้โผล่พ้นปากตู้ได้ ไม่โดนเฉือนยอด */
  const boxHullOpen=hull([S(0,0),S(fw,0),S(fw,fh),S(0,fh),
                          S(0,0,wallH+60),S(fw,0,wallH+60),S(fw,fh,wallH+60),S(0,fh,wallH+60)]);
  const clipOpen=()=>{ tctx.beginPath(); boxHullOpen.forEach((p,k)=> k?tctx.lineTo(p.x,p.y):tctx.moveTo(p.x,p.y)); tctx.closePath(); tctx.clip(); };

  // ลายแสงใต้น้ำบนพื้นทราย
  const tS0=S(0,0,sandT),tS1=S(fw,0,sandT),tS2=S(fw,fh,sandT),tS3=S(0,fh,sandT);
  drawCaustics(tctx, [tS0,tS1,tS2,tS3], CAUSTIC_A, sandT);

  // กริดพื้น — เฉพาะโหมดจัดของในตู้ (เน้นลานตัว 20×20cm)
  if(tankBuildMode){
    for(let i=1;i<fw;i++){ const p=S(i,0,sandT),q=S(i,fh,sandT), on=i%SLUG_LEN_CELLS===0;
      tctx.strokeStyle=on?'rgba(95,168,174,0.55)':'rgba(120,90,50,0.25)'; tctx.lineWidth=on?1.4:1;
      tctx.beginPath();tctx.moveTo(p.x,p.y);tctx.lineTo(q.x,q.y);tctx.stroke(); }
    for(let i=1;i<fh;i++){ const p=S(0,i,sandT),q=S(fw,i,sandT), on=i%SLUG_WID_CELLS===0;
      tctx.strokeStyle=on?'rgba(95,168,174,0.45)':'rgba(120,90,50,0.25)'; tctx.lineWidth=on?1.4:1;
      tctx.beginPath();tctx.moveTo(p.x,p.y);tctx.lineTo(q.x,q.y);tctx.stroke(); }
    /* พื้นที่ที่ถูกจองไว้แล้ว — โชว์เฉพาะตอน "กำลังจะวาง/กำลังลาก" เท่านั้น */
    if(selDecorKey || dragDecor){
      const taken=new Set();
      (curTank.decor||[]).forEach(o=>{ if(o===dragDecor) return;
        decorFootprint(o.key,o.fx,o.fy,o.flip).forEach(k=>taken.add(k)); });
      paintCellSet(taken,'rgba(240,190,60,0.22)','rgba(240,190,60,0.5)',1);
    }
  }

  /* ชักเย่อ: เชือก+ผ้าแดงต้องอยู่ "ใต้" ทาก 3D ซึ่งวาดบนแคนวาส WebGL ที่ซ้อนอยู่เหนือชั้นพื้นหลังนี้ */
  if(window.SlugTug?.isPulling(curTank))SlugTug.drawUnder();
  /* สายไข่ตู้เพาะ: ต้องวาดก่อนแยกชั้น ไม่งั้นไปอยู่บนแคนวาสชั้นหน้าแล้วทับตัวทาก 3D (breeding.js) */
  if(typeof drawBreederEggs==='function')drawBreederEggs(curTank);
  window.DecorGLB?.splitTankBackground();
  // --- delta time + พฤติกรรม ---
  const now=performance.now(); let dt=(now-(tankLastT||now))/1000; tankLastT=now; if(dt>0.05) dt=0.05;
  const racing=window.SlugRace?.isRacing(curTank);
  const pulling=!racing&&!!window.SlugTug?.isPulling(curTank);
  /* แข่งกินจุ: ผู้แข่ง 4 ตัววาด/เดินโดย slug-eat.js ทั้งหมด · ทากอื่นในตู้เดินเล่นได้แต่อยู่หลังแถบสนาม (SlugEat.stepNormal) */
  const eating=!racing&&!pulling&&!!window.SlugEat?.isEating(curTank);
  /* ปาหิน: ผู้แข่ง 4 ตัววาดโดย slug-throw.js · ทากอื่นเดินได้แต่อยู่หลังลานปา */
  const throwing=!racing&&!pulling&&!eating&&!!window.SlugThrow?.isThrowing(curTank);
  /* ดันวง: ผู้แข่ง 4 ตัววาด/เดินโดย slug-sumo.js · ทากอื่นเดินได้แต่อยู่หลังสนาม (SlugSumo.stepNormal) */
  const sumo=!racing&&!pulling&&!eating&&!throwing&&!!window.SlugSumo?.isSumo(curTank);
  /* ตัวที่ลงแข่งชักเย่อถูกคัดออกจาก slugs — ทั้งเดินและวาดจะถูกคุมโดย slug-tug.js เองทั้งหมด
     (แบบเดียวกับนักวิ่งใน slug-race.js) ที่เหลือในตู้กลายเป็นผู้ชมยืนดูขอบตู้ */
  const slugs=racing?SlugRace.normalSlugs(curTank):pulling?SlugTug.spectatorSlugs(curTank):eating?SlugEat.normalSlugs(curTank):throwing?SlugThrow.normalSlugs(curTank):sumo?SlugSumo.normalSlugs(curTank):curTank.slugs;
  tuneSpriteBudget(dt*1000);
  _tsprBudget = TSPR_MAX;                 // งบเรนเดอร์สไปรต์ต่อเฟรม ปรับตามความเร็วเครื่อง
  if(racing)SlugRace.stepNormal(slugs,dt);
  else if(pulling)SlugTug.stepSpectators(slugs,dt);
  else if(eating)SlugEat.stepNormal(slugs,dt);
  else if(throwing)SlugThrow.stepNormal(slugs,dt);
  else if(sumo)SlugSumo.stepNormal(slugs,dt);
  else stepTankSlugs(heldSlug? slugs.filter(s=>s!==heldSlug) : slugs, fw, fh, dt, true, curTank.decor, curTank.def);

  // --- วาดทาก + ของตกแต่ง รวมกัน เรียงลึก (fy มาก=ไกล วาดก่อน) · clip กล่องแก้วแบบเปิดฝา ---
  tctx.save(); clipOpen();
  if(typeof drawTankHygiene==='function')drawTankHygiene(curTank);
  drawBreederInterior(curTank);
  const masks=(curTank.decor||[]).map(d=>({ d, behind:decorCellSet(d,'behind'), front:decorCellSet(d,'front') }));
  const items=[];
  (curTank.foods||[]).forEach(f=>{if(!eating||f.fy>=SlugEat.ARENA_H)items.push({sortY:f.fy,kind:'food',f});});
  if(typeof foodGhostItem==='function'){const _g=foodGhostItem();if(_g)items.push({sortY:_g.fy,kind:'food',f:_g});}
  (curTank.decor||[]).forEach(d=> items.push({sortY:d.fy, kind:'decor', d}));
  [...slugs,...breederVisualSlugs(curTank)].forEach(s=>{ let sy=s.fy; const k=ptKey(s.fx,s.fy);   // อยู่หลังหิน→วาดก่อน(ไกล) · อยู่หน้า→วาดหลัง(ใกล้)
    for(const m of masks){ if(m.behind.has(k)){ sy=m.d.fy+0.05; break; } if(m.front.has(k)){ sy=m.d.fy-0.05; break; } }
    if(s===heldSlug) sy=-1e9;                                 // ตัวที่ยกอยู่ = หน้าสุดเสมอ
    items.push({sortY:sy, kind:'slug', s}); });
  if(racing)items.push(...SlugRace.racingItems());
  if(pulling)items.push(...SlugTug.tugItems());
  if(eating)items.push(...SlugEat.items());
  if(throwing)items.push(...SlugThrow.items());
  if(sumo)items.push(...SlugSumo.items());
  items.sort((a,b)=> b.sortY - a.sortY);
  const ghKey = dragDecor ? dragDecor.key : (tankBuildMode ? selDecorKey : null);
  const ghPos = dragDecor ? dragGhost : decorHover;
  const ghFlip= dragDecor ? dragDecor.flip : placeFlip;
  items.forEach(it=>{
    if(it.kind==='race'){SlugRace.drawRunner(it.r,it.i);return;}
    if(it.kind==='tug'){SlugTug.drawPart(it);return;}
    if(it.kind==='eat'){SlugEat.drawItem(it);return;}
    if(it.kind==='throw'){SlugThrow.drawItem(it);return;}
    if(it.kind==='sumo'){SlugSumo.drawItem(it);return;}
    if(it.kind==='food'){drawFood(it.f);return;}
    if(it.kind==='decor'){ drawDecor(it.d); return; }
    const s=it.s;
    if(window.DecorGLB?.drawSlug(s)){return;}
    const bodyLen=TANK_SLUG_VIEW_SCALE*(curTank.def.shopSlugScale||1)*slugCm(typeof foodGenes==='function'?foodGenes(s):s.genes)*depthPxPerCm(s.fx,s.fy)*(s._breedScale||1);
    const p=S(s.fx,s.fy,sandT+(s.climbZ||0));          // เกาะกระจก/หิน = ยกความสูง z ขึ้น
    const lifted = (s===heldSlug);
    if(lifted){                                        // เงาบนพื้นใต้ตัว (ตัวเองลอยอยู่ที่เคอร์เซอร์)
      const rx=bodyLen*0.34, ry=Math.max(2.5,bodyLen*0.10), gy=p.y+15*tankCam.zoom;
      tctx.save(); tctx.translate(p.x,gy); tctx.scale(1, ry/rx);
      const sg=tctx.createRadialGradient(0,0,0,0,0,rx);
      sg.addColorStop(0,'rgba(0,0,0,0.34)'); sg.addColorStop(0.6,'rgba(0,0,0,0.15)'); sg.addColorStop(1,'rgba(0,0,0,0)');
      tctx.fillStyle=sg; tctx.beginPath(); tctx.arc(0,0,rx,0,6.283); tctx.fill(); tctx.restore();
    }
    /* เกาะกระจกแบบ 3D — มาก่อนเส้นทางพื้น เพราะจุดยึด/ท่าหันคนละชุดกัน
       ตัวที่ถูกอุ้มอยู่ (lifted) ไม่นับว่าเกาะกระจก ใช้เส้นทางปกติเหมือนเดิม */
    if(engineReady&&!lifted&&slugOnWall(s)){
      const w3=drawWallSlug3D(s,bodyLen);
      if(w3){
        if(s.state==='sneeze')drawSneezeBubbles(s,{x:w3.x-w3.hx*w3.len*0.20, y:w3.y-w3.hy*w3.len*0.20},bodyLen,w3.hx,w3.hy);
        if(s===selSlug){tctx.save();tctx.strokeStyle='#9fffdc';tctx.lineWidth=2;tctx.beginPath();tctx.ellipse(w3.x,w3.y,bodyLen*.5,bodyLen*.12,w3.rot,0,Math.PI*2);tctx.stroke();tctx.restore();}   // วงเลือกหมุนตามลำตัว ไม่ใช่วงบนพื้น
        return;
      }
    }
    if(engineReady&&!slugOnWall(s)&&window.Slug3D?.draw(tctx,s,p.x,lifted?p.y-6*tankCam.zoom:p.y,bodyLen,lifted,{x:CELLW*Math.cos(s._motionHeading??s.dir??0)+DEPX*Math.sin(s._motionHeading??s.dir??0),y:-DEPY*Math.sin(s._motionHeading??s.dir??0)})){
      if(s.state==='sneeze')drawSneezeBubbles(s,p,bodyLen);
      if(!lifted)drawSlugMood(s,p,bodyLen,null,p.y,1);
      if(s===selSlug){tctx.save();tctx.strokeStyle='#9fffdc';tctx.lineWidth=2;tctx.beginPath();tctx.ellipse(p.x,p.y,bodyLen*.5,bodyLen*.12,0,0,Math.PI*2);tctx.stroke();tctx.restore();}
      return;
    }
    if(engineReady){
      const P=slugPartsOf(s);
      const sa=bodyLen/(P.bw*P.s), spriteH=P.h*sa;
      const cy = lifted ? (p.y - 6*tankCam.zoom) : (p.y - spriteH*0.44);
      s._bakeEyes=false;                                   // ค่าเริ่ม: ตัวเกาะกำแพง/ท่าพิเศษ วาดตาทับแบบเดิม
      if(!lifted&&slugOnWall(s)){
        const w=drawWallSlug(s,P,sa);
        /* ฟองออกจากหัว — จุดตั้งต้นถอยหลังนิดหน่อยเพราะบนกำแพงส่งจุด "กลางตัว" มา
           ไม่ใช่จุดเท้าเหมือนบนพื้น ไม่งั้นฟองจะไปโผล่ไกลเหนือหัวไปหนึ่งช่วงตัว */
        if(w&&s.state==='sneeze')
          drawSneezeBubbles(s,{x:w.x-w.hx*w.len*0.20, y:w.y-w.hy*w.len*0.20},bodyLen,w.hx,w.hy);
        return;
      }
      const _smiling=(s.state==='rest'||s.state==='greet'||s.state==='wake'||s.state==='stretch') && smileNow(s);
      /* ท่าปกติ = อบตาเข้าสไปรต์ (ขยับตาม creep ที่ตัวยืด/หด) · ท่าพิเศษ = วาดหน้าทับแบบเดิม */
      s._bakeEyes = !lifted && !(s.state==='sleep'||s.state==='dashCharge'||s.state==='dash'||_smiling);
      drawTankSlug(s, P, sa, p.x, cy, lifted);
      if(lifted) drawHeldFace(P, p.x, cy, s.flip, P.s*sa, slugBaseHex(s.genes));
      else if(s.state==='sleep') drawSleepFace(P, p.x, cy, s.flip, P.s*sa, slugBaseHex(s.genes));
      else if(s.state==='dashCharge'||s.state==='dash') drawDashFace(P,p.x,cy,s.flip,P.s*sa,slugBaseHex(s.genes),s.charge);
      else if(_smiling) drawSmileFace(P,p.x,cy,s.flip,P.s*sa,slugBaseHex(s.genes));
      // ท่าปกติ: ตาอยู่ในสไปรต์แล้ว (ขยับตาม creep) ไม่ต้องวาดทับ
      if(s.state==='sneeze') drawSneezeBubbles(s,p,bodyLen);
      if(!lifted) drawSlugMood(s,p,bodyLen,P,cy,sa);
      s._hit={ x:p.x, y:cy, r:Math.max(26,bodyLen*0.62) };
    } else {
      const ey = lifted ? p.y : p.y-bodyLen*0.18;
      tctx.fillStyle=slugBaseHex(s.genes);
      tctx.beginPath(); tctx.ellipse(p.x,ey, bodyLen*0.5, bodyLen*0.26, 0,0,6.283); tctx.fill();
      s._hit={ x:p.x, y:ey, r:Math.max(20,bodyLen*0.5) };
    }
  });
  if(tankBuildMode)for(const d of curTank.decor||[]){if(!decorFitsTankWalls(d.key,d.fx,d.fy,d.flip,curTank))paintCellSet(decorFootprint(d.key,d.fx,d.fy,d.flip),'rgba(232,86,86,.26)','rgba(255,130,130,.95)',2);}
  /* โกสต์: โชว์ก่อนกด ว่าจะลงตรงไหน เขียว=วางได้ แดง=วางไม่ได้ */
  let ghWhy='';
  if(ghKey && ghPos){
    ghWhy = decorPlaceIssue(ghKey, ghPos.fx, ghPos.fy, ghFlip, dragDecor||null);
    const ok=!ghWhy;
    paintCellSet(decorFootprint(ghKey, ghPos.fx, ghPos.fy, ghFlip),
      ok?'rgba(90,210,130,0.34)':'rgba(232,86,86,0.38)',
      ok?'rgba(150,255,190,0.95)':'rgba(255,130,130,0.95)', 2);
    drawDecorAt(ghKey, ghPos.fx, ghPos.fy, ok?0.62:0.4, ghFlip);
  }
  /* ทาบลายแสงทับตัวทาก/หิน — หนีบด้วย clipHull (กล่องแก้วจริง) ลายจะได้อยู่แค่ในน้ำ */
  let bx0=1e9,by0=1e9,bx1=-1e9,by1=-1e9;
  boxHull.forEach(p=>{ if(p.x<bx0)bx0=p.x; if(p.x>bx1)bx1=p.x; if(p.y<by0)by0=p.y; if(p.y>by1)by1=p.y; });
  bx0=Math.max(0,bx0); by0=Math.max(0,by0); bx1=Math.min(TCW,bx1); by1=Math.min(TCH,by1);
  if(bx1>bx0 && by1>by0){
    tctx.save(); clipHull();
    drawCaustics(tctx, [{x:bx0,y:by0},{x:bx1,y:by0},{x:bx1,y:by1},{x:bx0,y:by1}], CAUSTIC_OBJ, sandT);
    tctx.restore();
  }
  tctx.restore();

  // ---- น้ำ + ผิวน้ำ + กระจกใกล้ (ชั้นนิ่ง วาดทับตัวทาก) ----
  if(haveLay) blitLayer(_lay.glass, _lay.box, vis); else drawGlass(tctx);
  /* ป้ายบอกเหตุผลตอนวางไม่ได้ — วาดนอก clip ของกล่องแก้ว ไม่งั้นป้ายโดนตัดตอนเงาอยู่ริมตู้ */
  if(ghWhy && ghPos) decorWhyLabel(ghWhy, ghPos.fx, ghPos.fy);
  if(selSlug) drawGeneCard(selSlug, 12, 12);
  window.DecorGLB?.endTank();
}

/* ---- การ์ดยีน (ยกเครื่อง 2026-09-14) ----
   ทุกแถวขนาดแสดง "ค่าจริงเป็นเซนติเมตร (ค่ายีน)" · แถวสีโชว์ตัวอย่างสีคู่กับค่ายีน
   บัฟอาหารยุบเหลือบรรทัดเดียว รายละเอียดไปอยู่ในกล่องที่โผล่ตอนชี้/แตะ (เดิมกางเป็นแถวละบัฟ)
   ⚠️ ออร่าหงอนกับความสมบูรณ์คือยีน vigor ตัวเดียวกัน (derived(): aura = vigor/100 · README §4)
      แยกสองแถวจะได้เลขซ้ำกันเป๊ะ จึงรวมเป็นแถวเดียว */
const SPOT_SHAPE_TH={circle:'วงกลม',sq:'สี่เหลี่ยม',tri:'สามเหลี่ยม'};
/* ชื่อไทยของยีนที่อาหารบัฟได้ — ใช้ในกล่องรายละเอียดบัฟ */
const BUFF_TH={gillLen:'ขนาดหงอน',girth:'ขนาดตัว',tentLen:'ขนาดหนวด',len:'ความยาวลำตัว',
               vigor:'ความสมบูรณ์',mainC:'สีลำตัว',accC:'สีหงอนเหงือก',
               bodyDepth:'สีร่องลำตัว',gillDepth:'สีร่องหงอน',gillN:'จำนวนหงอน',spotN:'ลาย'};
/* ---- ขนาดจริงเป็นเซนติเมตร ----
   ไม้บรรทัดคือ slugCm(g) = ความยาวลำตัวที่เกมใช้จริงทุกที่ (กันชน/กินอาหาร/ชั้นวาง)
   slugParts() คืนขนาดชิ้นส่วนเป็น "หน่วยอาร์ต" (bw/bh/stalks[].h/rhinos[].h)
   bw = bodyW0 × stretch × size → ซม.ต่อหน่วยอาร์ต = slugCm × stretch ÷ bw (ตัด bodyW0×size ทิ้ง)
   ได้ความยาวลำตัว = slugCm × stretch พอดี (ยีน len 50 → stretch 1 → เท่า slugCm เป๊ะ) */
function slugRealCm(s,g){
  const P=typeof slugPartsOf==='function'?slugPartsOf(s):null;
  if(!P||!P.bw||!P.D)return null;
  const cmU=slugCm(g)*P.D.stretch/P.bw, tall=a=>a&&a.length?Math.max(...a.map(o=>o.h)):0;
  return {len:P.bw*cmU, girth:P.bh*cmU, gill:tall(P.stalks)*cmU, tent:tall(P.rhinos)*cmU};
}
const cmTxt=(v,gene)=>v==null?String(gene):v.toFixed(1)+' ซม. ('+gene+')';
function buffMinutes(b){const m=Math.ceil((b.until-Date.now())/60000);return m>=60?Math.floor(m/60)+' ชม. '+(m%60)+' น.':m+' นาที';}
/* ชื่อสั้นสำหรับบรรทัดเดียวบนการ์ด — ชื่อเต็มไปโชว์ในกล่องรายละเอียด */
const BUFF_SHORT={gillLen:'หงอน',girth:'ตัว',tentLen:'หนวด',len:'ยาว',vigor:'ออร่า',
                  mainC:'สีตัว',accC:'สีหงอน',bodyDepth:'ร่องตัว',gillDepth:'ร่องหงอน',gillN:'จำนวนหงอน',spotN:'ลาย'};
function buffKeys(s){
  const out=[];
  for(const b of s.foodBuffs||[])for(const k of Object.keys(b.delta||{}))if(BUFF_SHORT[k]&&!out.includes(k))out.push(k);
  return out;
}
/* ตัดข้อความให้พอดีความกว้างที่เหลือจริง ๆ (วัดด้วย measureText ไม่ใช่เดาจำนวนตัวอักษร)
   ⚠️ ป้ายไทยกับค่าอยู่คนละฟอนต์/ขนาด เดาความกว้างไม่ได้ เคยล้นทับป้ายมาแล้ว */
function fitText(ctx,parts,sep,max){
  let out=parts.join(sep);
  while(parts.length>1&&ctx.measureText(out).width>max){parts=parts.slice(0,-1);out=parts.join(sep)+'…';}
  return ctx.measureText(out).width>max?'…':out;
}
let geneCardBuffHit=null, geneCardRect=null, geneCardBuffOpen=false, geneCardBuffHover=false, geneCardFor=null;
/* ⚠️ 2026-09-20 ผู้เล่น: "กดที่ทากแล้วมีสแตตโผล่ด้านข้าง ให้มีไอคอนหัวใจมุมบนขวากดถูกใจได้เลย"
   การ์ดนี้วาดบนแคนวาส (tctx) ไม่ใช่ DOM จึงใช้ SlugBrowser.heart() ที่สร้าง <span> ไม่ได้
   ต้องวาดรูปหัวใจเองแล้วทำกรอบกดแยก เหมือนที่แถวบัฟใช้ geneCardBuffHit อยู่แล้ว */
let geneCardHeartHit=null, geneCardHeartHover=false;
function drawGeneCardHeart(s,x,y,w){
  const r=9, cx=x+w-r-8, cy=y+r+5;
  geneCardHeartHit={x:cx-r-3,y:cy-r-3,w:(r+3)*2,h:(r+3)*2};
  const on=!!s.favorite;
  if(geneCardHeartHover){tctx.fillStyle='rgba(95,168,174,0.18)';rrPath(tctx,geneCardHeartHit.x,geneCardHeartHit.y,geneCardHeartHit.w,geneCardHeartHit.h,5);tctx.fill();}
  /* รูปหัวใจวาดจากเส้นโค้งสองข้าง — สเกลตาม r เพื่อให้คมทุกความละเอียด */
  const k=r/12;
  tctx.save();tctx.translate(cx,cy);tctx.scale(k,k);
  tctx.beginPath();
  tctx.moveTo(0,9);
  tctx.bezierCurveTo(-11,1,-10,-7,-5,-7);
  tctx.bezierCurveTo(-2,-7,0,-4.5,0,-3.2);
  tctx.bezierCurveTo(0,-4.5,2,-7,5,-7);
  tctx.bezierCurveTo(10,-7,11,1,0,9);
  tctx.closePath();tctx.restore();
  tctx.fillStyle=on?'#E8607A':'rgba(0,0,0,0)';
  tctx.strokeStyle=on?'#F09AAB':'#9CB4B7';
  tctx.lineWidth=1.6;
  if(on)tctx.fill();
  tctx.stroke();
}
const inGeneCardHeart=(mx,my)=>inBox(geneCardHeartHit,mx,my);
/* ความกว้างมาจากแถบเครื่องมือฝั่งซ้าย (tank-sidebar.js ส่งมาให้) การ์ดจะได้เป็นคอลัมน์เดียวกับปุ่มด้านบน
   ป้ายไทยกับค่ายาวไม่เท่ากันทุกแถว แคบ ๆ แล้วชนกันได้ → ย่อฟอนต์ค่าเฉพาะแถวที่ไม่พอ (ดู VALUE_SM) */
/* แถวข้อมูลของการ์ดยีน — ใช้ร่วมกันระหว่างการ์ดบนแคนวาสในตู้ (drawGeneCard ข้างล่าง)
   กับแผงที่โผล่ตอนชี้การ์ดในหน้าเลือกทากผสมพันธุ์ (breeding-picker.js)
   อ่านจากที่เดียวกัน เพิ่มยีนใหม่ทีเดียวขึ้นครบทั้งสองที่ ไม่มีทางหลุดข้างใดข้างหนึ่ง
   {l:ป้าย · v:ค่า · k:ชนิดแถว · sw:สีตัวอย่าง · gene:คีย์ยีน(ไว้ไฮไลต์ตอนโดนบัฟ) · fit:ตัดให้พอดี} */
function geneCardRows(s){
  const g=typeof foodGenes==='function'?foodGenes(s):s.genes, D=SlugEngine.derived(g);
  const cm=slugRealCm(s,g);
  return [
    {l:'ความอิ่ม', v:Math.round(s.satiety==null?50:s.satiety)+' / 100'},
    {l:'บัฟอาหาร', v:buffKeys(s).map(k=>BUFF_SHORT[k]), k:'buff', fit:true},
    {l:'นิสัย', v:slugPersona(s.traits)},
    {l:'สีลำตัว', v:g.mainC, k:'swatch', sw:SlugEngine.hex(D.base), gene:'mainC'},
    {l:'สีหงอนเหงือก', v:g.accC, k:'swatch', sw:SlugEngine.hex(D.acc), gene:'accC'},
    {l:'สีร่องลำตัว', v:g.bodyDepth, gene:'bodyDepth'},
    {l:'สีร่องหงอน', v:g.gillDepth, gene:'gillDepth'},
    {l:'ความสมบูรณ์', v:g.vigor, gene:'vigor'},   // = ออร่าหงอนด้วย (aura = vigor/100) ไม่ต้องแยกแถว
    {l:'ความยาวลำตัว', v:cmTxt(cm&&cm.len, g.len), gene:'len'},
    {l:'ขนาดตัว', v:cmTxt(cm&&cm.girth, g.girth), gene:'girth'},
    {l:'ขนาดหงอน', v:cmTxt(cm&&cm.gill, g.gillLen), gene:'gillLen'},
    {l:'ขนาดหนวด', v:cmTxt(cm&&cm.tent, g.tentLen), gene:'tentLen'},
    {l:'จำนวนหงอน', v:D.nGill+' ต้น ('+g.gillN+')', gene:'gillN'},
    {l:'ลาย', v:D.nSpot+' '+(SPOT_SHAPE_TH[D.shape]||'')+' ('+g.spotN+')', gene:'spotN'},
  ];
}
function drawGeneCard(s, x, y, cardW){
  if(geneCardFor!==s){geneCardFor=s;geneCardBuffOpen=false;}   // เปลี่ยนตัวที่เลือก = พับรายละเอียดบัฟกลับ
  const g=typeof foodGenes==='function'?foodGenes(s):s.genes;
  const rows=geneCardRows(s);
  /* ROW = ระยะห่างบรรทัด · เคยลดเหลือ 16 ตอนบีบการ์ดให้แคบลง แล้วอ่านแล้วอึดอัด
     ที่ประหยัดที่จริง ๆ คือความกว้าง (250→206) ไม่ใช่ความถี่บรรทัด — 18 คือค่าที่หายใจออก */
  const PAD=9, ROW=18;
  const w=Math.max(176, Math.round(cardW||206)), h=24+rows.length*ROW;
  geneCardRect={x,y,w,h};
  tctx.fillStyle='rgba(12,29,34,0.92)'; tctx.strokeStyle='rgba(95,168,174,0.5)';
  rrPath(tctx,x,y,w,h,8); tctx.fill(); tctx.lineWidth=1; tctx.stroke();
  tctx.textAlign='left'; tctx.textBaseline='top';
  /* ชื่อต้องไม่ไหลไปทับหัวใจมุมบนขวา — กันพื้นที่ไว้ 26px แล้วตัดด้วย … ถ้ายาวเกิน */
  tctx.fillStyle='#D9A03C'; tctx.font='500 10px "IBM Plex Mono",monospace';
  {
    let title=slugNick(s)+' · '+s.id, room=w-PAD*2-26;
    if(tctx.measureText(title).width>room){
      while(title.length>3&&tctx.measureText(title+'…').width>room)title=title.slice(0,-1);
      title+='…';
    }
    tctx.fillText(title, x+PAD, y+7);
  }
  drawGeneCardHeart(s,x,y,w);
  geneCardBuffHit=null;
  const LABEL='400 12px "IBM Plex Sans Thai",sans-serif',
        VALUE='500 12px "IBM Plex Mono",monospace', VALUE_SM='500 10.5px "IBM Plex Mono",monospace';
  rows.forEach((r,i)=>{
    const yy=y+26+i*ROW;
    if(r.k==='buff'){
      geneCardBuffHit={x, y:yy-3, w, h:ROW};
      if(geneCardBuffHover||geneCardBuffOpen){tctx.fillStyle='rgba(95,168,174,0.14)';rrPath(tctx,x+4,yy-3,w-8,ROW,4);tctx.fill();}
    }
    tctx.font=LABEL; tctx.textAlign='left'; tctx.fillStyle='#9CB4B7'; tctx.fillText(r.l, x+PAD, yy);
    const room=w-PAD*2-tctx.measureText(r.l).width-6-(r.k==='swatch'?30:0);
    /* ยีนที่กำลังโดนบัฟ = โชว์เป็นสีทอง จะได้ไม่เข้าใจผิดว่าเป็นค่าถาวรตอนเอาไปผสมพันธุ์ */
    const buffed=r.gene&&s.genes&&g[r.gene]!==s.genes[r.gene];
    tctx.fillStyle=buffed?'#F0D08A':'#E4EDEC'; tctx.textAlign='right';
    tctx.font=r.k==='buff'?LABEL:VALUE;
    let txt=r.fit?(r.v.length?fitText(tctx,r.v.slice(),'+',room):'—'):''+r.v;
    if(!r.fit&&tctx.measureText(txt).width>room)tctx.font=VALUE_SM;   // แถวที่ยาวเกิน = ย่อฟอนต์แทนที่จะทับป้าย
    if(r.k==='buff')tctx.fillStyle=r.v.length?'#F0D08A':'#9CB4B7';
    tctx.fillText(txt, x+w-PAD, yy);
    if(r.k==='swatch'){
      tctx.fillStyle=r.sw; rrPath(tctx,x+w-PAD-tctx.measureText(txt).width-28,yy+1,22,10,3); tctx.fill();
      tctx.strokeStyle='rgba(255,255,255,0.2)'; tctx.lineWidth=1; tctx.stroke();
    }
  });
  if((geneCardBuffHover||geneCardBuffOpen)&&(s.foodBuffs||[]).length)drawBuffTip(s, geneCardRect);
}
/* กล่องรายละเอียดบัฟ — โผล่ตอนชี้/แตะแถว "บัฟอาหาร"
   ⚠️ วางข้างการ์ดได้เฉพาะตอนจอกว้างพอ · จอมือถือ (412px) กล่อง 270 ไม่เหลือที่ด้านขวา
      แล้วโดนดันมาทับกลางการ์ดจนอ่านยีนไม่ออก → ตกลงไปอยู่ "ใต้การ์ด" แทน */
function drawBuffTip(s, card){
  const lines=[];
  for(const b of s.foodBuffs){
    /* บัฟที่ไม่ใช่อาหาร (เช่น raceFatigue = เหนื่อยจากทัวร์นาเมนต์วิ่ง) ไม่มีใน FOOD_TYPES — เดิมอ่าน .icon ของ undefined แล้วการ์ดยีนพัง */
    const f=FOOD_TYPES[b.type]||(b.type==='raceFatigue'?{icon:'😮‍💨',name:'เหนื่อยจากการวิ่ง'}:{icon:'✨',name:String(b.type||'บัฟ')});
    lines.push(['head',(f.icon||'')+' '+f.name+(FOOD_TYPES[b.type]?' Lv.'+b.level:'')+' · เหลือ '+buffMinutes(b)]);
    const d=Object.entries(b.delta||{}).filter(([k,v])=>BUFF_TH[k]&&v);
    lines.push(['body',d.length?d.map(([k,v])=>BUFF_TH[k]+' '+(v>0?'+':'−')+Math.abs(Math.round(v))).join(' · '):'ไม่มีผลกับยีน (เพิ่มความอิ่มอย่างเดียว)']);
  }
  const w=Math.min(270, TCW-16), h=12+lines.length*16;
  let x=card.x+card.w+8, y=card.y+24+17;
  if(x+w>TCW-8){ x=card.x; y=card.y+card.h+8; }
  if(y+h>TCH-8) y=Math.max(8, TCH-h-8);
  if(x+w>TCW-8) x=Math.max(8, TCW-w-8);
  tctx.fillStyle='rgba(8,22,26,0.96)'; tctx.strokeStyle='rgba(217,160,60,0.55)';
  rrPath(tctx,x,y,w,h,8); tctx.fill(); tctx.lineWidth=1; tctx.stroke();
  tctx.textAlign='left'; tctx.textBaseline='top';
  lines.forEach(([kind,text],i)=>{
    tctx.fillStyle=kind==='head'?'#F0D08A':'#9CB4B7';
    tctx.font=(kind==='head'?'500 12px':'400 11px')+' "IBM Plex Sans Thai",sans-serif';
    tctx.fillText(text, x+11+(kind==='body'?8:0), y+7+i*16);
  });
}
const inBox=(r,mx,my)=>!!r&&mx>=r.x&&mx<=r.x+r.w&&my>=r.y&&my<=r.y+r.h;
const inGeneCardBuff=(mx,my)=>inBox(geneCardBuffHit,mx,my);
const inGeneCard=(mx,my)=>inBox(geneCardRect,mx,my);

/* ลากเลื่อนดู · ล้อเมาส์ซูม · คลิกเลือกทาก · โหมดจัดของ: วาง/ลาก/เลือกของตกแต่ง */
let tDrag=false, tMoved=false, tlx=0,tly=0, tdx0=0,tdy0=0;
function tankXY(e){ const r=tankCv.getBoundingClientRect(); return { mx:e.clientX-r.left, my:e.clientY-r.top }; }
tankCv.addEventListener('pointerdown', e=>{
  if(!curTank) return;
  tankCv.setPointerCapture(e.pointerId);
  tMoved=false; tlx=tdx0=e.clientX; tly=tdy0=e.clientY;
  dragDecor=null; tDrag=false; cancelHold(); pendSlug=null;
  /* กดบนการ์ดยีน = ไม่แพนจอ ไม่ยกเลิกการเลือก (เดิมกดโดนการ์ดแล้วการ์ดหายไปเลย)
     กดแถวบัฟ = สลับกางรายละเอียด — จำเป็นสำหรับจอสัมผัสที่ไม่มี hover */
  if(selSlug){const q=tankXY(e); if(inGeneCard(q.mx,q.my)){
    /* กดหัวใจมุมบนขวาการ์ด = สลับถูกใจทันที (ผู้เล่นขอ 2026-09-20) */
    if(inGeneCardHeart(q.mx,q.my)){selSlug.favorite=!selSlug.favorite;
      /* กดถูกใจทั้งที่มีลูกค้ายื่นขอซื้อค้างอยู่ = ต้องถอนข้อเสนอนั้นด้วย
         ไม่งั้น "ถูกใจแล้วจะไม่โดนซื้อ" เป็นจริงแค่กับข้อเสนอใบใหม่ ใบที่ค้างอยู่ยังกดขายได้ */
      if(selSlug.favorite&&typeof releaseSlugOffers==='function')releaseSlugOffers(selSlug,'กดถูกใจทากตัวนี้');
      if(typeof toast==='function')toast(selSlug.favorite?'♥ ถูกใจแล้ว — ทากตัวนี้จะไม่ถูกลูกค้าขอซื้อ':'เลิกถูกใจ — ลูกค้าขอซื้อได้แล้ว',selSlug.favorite?'good':'bad');
      if(typeof saveGame==='function')saveGame();return;}
    if(inGeneCardBuff(q.mx,q.my))geneCardBuffOpen=!geneCardBuffOpen; return; }}
  if(!tankBuildMode){
    const {mx,my}=tankXY(e);
    const feedMode=(typeof foodMode!=='undefined'&&foodMode);      // ย้ายอาหารได้เฉพาะตอนเปิดโหมดวางอาหาร
    const fHit=(feedMode&&typeof foodAt==='function')?foodAt(mx,my):null;   // กดโดนตัวอาหาร = ลากย้ายก่อน (อาหารมาก่อนทาก เพราะทากที่มากินบังการกดอาหารไว้)
    if(fHit){ dragFood=fHit; dragFoodMoved=false; return; }
    const s=slugAt(mx,my);                             // ไม่โดนอาหาร = กดโดนตัวทาก จองไว้ก่อน
    if(s){ pendSlug=s;                                 // ขยับเมาส์เมื่อไหร่ = ยกทันที
           holdT=setTimeout(()=>{ holdT=null; liftPending(); }, HOLD_MS);   // หรือค้างนิ่ง ๆ ก็ยกเอง
           return; }                                   // กดโดนทาก = ไม่เลื่อนกล้อง
  }
  if(tankBuildMode && !selDecorKey){                 // ไม่ได้ถืออะไร = คลิกของเดิมเพื่อเลือก/ลาก
    const {mx,my}=tankXY(e); const d=decorAt(mx,my);
    if(d){ dragDecor=d; dragGhost={fx:d.fx, fy:d.fy}; selDecor=d; return; } }
  tDrag=true;                                          // ไม่โดนของ = เลื่อนจอ
});
tankCv.addEventListener('pointermove', e=>{
  if(!curTank) return;
  /* ชี้แถว "บัฟอาหาร" ในการ์ดยีน = กางรายละเอียด (drawTank วิ่ง rAF อยู่แล้ว ตั้งค่าตัวแปรพอ) */
  {const q=tankXY(e); geneCardBuffHover=!!selSlug&&inGeneCardBuff(q.mx,q.my); geneCardHeartHover=!!selSlug&&inGeneCardHeart(q.mx,q.my);}
  if(!tankBuildMode && !heldSlug){
    const q=tankXY(e);
    let near=null, nd=1e9;
    curTank.slugs.forEach(s=>{ if(!s._hit) return; const d=Math.hypot(q.mx-s._hit.x,q.my-s._hit.y); if(d<95 && d<nd){nd=d;near=s;} });
    if(near) near.look=1;                              // ชู/กระดิกหนวดเมื่อผู้เล่นเลื่อนมาใกล้
  }
  if(Math.abs(e.clientX-tdx0)+Math.abs(e.clientY-tdy0)>4) tMoved=true;
  if(pendSlug && !heldSlug) liftPending();             // กดค้างบนทากแล้วเริ่มลาก = ยกเลย ไม่ต้องรอครบเวลา
  if(dragFood){                                        // อาหารตามนิ้ว/เมาส์
    const {mx,my}=tankXY(e), f=tankFloorAt(mx,my);
    dragFood.fx=Math.max(1,Math.min(curTank.def.w-1, f.fx));
    const _half=Math.max(14,dragFood.spec.cap*1.65)/CM_PER_CELL/2;
    /* ตู้แข่งวิ่ง/ชักเย่อ: แถบหน้าตู้เป็นสนาม ห้ามวางอาหาร → หนีบให้อยู่หลังแถบ (ชักเย่อ = หลังเลน TUG_FRONT) */
    let _ny=Math.max(curTank.def.race?8+_half:curTank.def.tug?TUG_FRONT+_half:1,Math.min(curTank.def.h-1, f.fy));
    dragFood.fy=_ny;
    dragFoodMoved=true; tankCv.style.cursor='grabbing'; return;
  }
  if(heldSlug){                                        // ทากตามนิ้ว/เมาส์ไปเลย
    const {mx,my}=tankXY(e), f=tankFloorAt(mx,my);
    const mg=slugCm(heldSlug.genes)/CM_PER_CELL*0.55+0.2;
    heldSlug.fx=Math.max(mg,Math.min((isBreeder(curTank)?25:curTank.def.w)-mg, f.fx));
    heldSlug.fy=Math.max(mg,Math.min(curTank.def.h-mg, f.fy));
    tankCv.style.cursor='grabbing'; return;
  }
  if(dragDecor){                                       // ลากเป็น "โกสต์" เท่านั้น ตัวจริงยังไม่ขยับ
    const {mx,my}=tankXY(e), f=tankFloorAt(mx,my);
    dragGhost={ fx:snapCell(Math.max(DCELL,Math.min(curTank.def.w-DCELL, f.fx))),   // snap ทีหลัง clamp เสมอ
                fy:snapCell(Math.max(DCELL,Math.min(curTank.def.h-DCELL, f.fy))) }; // ไม่งั้นหลุดกริดครึ่งช่อง
    tankCv.style.cursor='grabbing'; return;             // ตรวจว่าวางได้ไหม ทำตอนปล่อยเมาส์
  }
  if(tankBuildMode && selDecorKey && !tDrag){          // เล็งจะวางของใหม่ → โกสต์ตามเมาส์
    const {mx,my}=tankXY(e), f=tankFloorAt(mx,my);
    decorHover={ fx:snapCell(Math.max(DCELL,Math.min(curTank.def.w-DCELL, f.fx))),
                fy:snapCell(Math.max(DCELL,Math.min(curTank.def.h-DCELL, f.fy))) };
  }
  if(tDrag && tMoved){ tankCam.ox+=e.clientX-tlx; tankCam.oy+=e.clientY-tly; clampTankPan(); tankCv.style.cursor='grabbing'; }
  else if(!tankBuildMode && !tDrag){ const q=tankXY(e), feed=(typeof foodMode!=='undefined'&&foodMode);
    const onFood=feed&&typeof foodAt==='function'&&foodAt(q.mx,q.my);
    tankCv.style.cursor = onFood?'grab':feed?'crosshair':(slugAt(q.mx,q.my)?'grab':''); }
  tlx=e.clientX; tly=e.clientY;
});
tankCv.addEventListener('pointerup', e=>{
  cancelHold();
  if(dragFood){ const moved=dragFoodMoved; dragFood=null; dragFoodMoved=false; tankCv.style.cursor=''; tDrag=false; if(moved&&typeof saveGame==='function')saveGame(); return; }
  if(heldSlug){ dropHeldSlug(); tankCv.style.cursor=''; tDrag=false; pendSlug=null; syncDecorBar(); return; }
  if(pendSlug){
    selSlug=pendSlug; selDecor=null;
    selSlug.state='startle'; selSlug.stt=STARTLE_TIME; selSlug.startle=1;
    pendSlug=null; syncDecorBar(); return;
  }  // แตะสั้น ๆ = เลือก + สะดุ้ง
  tankCv.style.cursor=''; const wasDecor=dragDecor, gh=dragGhost;
  tDrag=false; dragDecor=null; dragGhost=null;
  if(wasDecor){                                        // ปล่อยแล้วค่อยคำนวณครั้งเดียว
    if(gh && (gh.fx!==wasDecor.fx || gh.fy!==wasDecor.fy)){
      const why=decorPlaceIssue(wasDecor.key, gh.fx, gh.fy, wasDecor.flip, wasDecor);
      if(!why){ wasDecor.fx=gh.fx; wasDecor.fy=gh.fy;
        nudgeSlugsOutOfSolid(curTank.slugs, curTank.def.w, curTank.def.h, curTank.decor); }
      else toast('ย้ายไปตรงนั้นไม่ได้: '+why,'bad');
    }
    selDecor=wasDecor; syncDecorBar(); return;
  }
  if(tMoved) return;                                   // เลื่อนจอ ไม่ใช่คลิก
  const {mx,my}=tankXY(e);
  if(tankBuildMode && selDecorKey){                    // วางของใหม่ตรงจุดที่กด
    const f=tankFloorAt(mx,my);
    const nx=snapCell(Math.max(DCELL,Math.min(curTank.def.w-DCELL, f.fx)));
    const ny=snapCell(Math.max(DCELL,Math.min(curTank.def.h-DCELL, f.fy)));
    const _why=decorPlaceIssue(selDecorKey,nx,ny,placeFlip,null);
    if(_why){ toast('วางตรงนี้ไม่ได้: '+_why,'bad'); return; }
    const _price=decorPrice(selDecorKey);
    let _free=false;
    if(((G.decorCredit||{})[selDecorKey]||0)>0){ G.decorCredit[selDecorKey]--; _free=true; }
    else if(G.coin<_price){ toast('เหรียญไม่พอ ('+_price+')','bad'); return; }
    else addCoin(-_price);
    toast('วาง'+TANK_DECOR[selDecorKey].name+(_free?' · ใช้เครดิต (ฟรี)':' −'+_price),'good');
    if(typeof syncDecorBar==='function')syncDecorBar();
    if(typeof syncHUD==='function')syncHUD();
    curTank.decor=curTank.decor||[];
    curTank.decor.push({ key:selDecorKey, fx:nx, fy:ny, flip:placeFlip|0 });
    nudgeSlugsOutOfSolid(curTank.slugs, curTank.def.w, curTank.def.h, curTank.decor);
    /* วางแล้วยัง "ถือ" ชิ้นเดิมอยู่ — วางรัว ๆ ได้ และกด R พลิกของในมือได้ทันที
       ไม่เด้งไปเลือกชิ้นที่เพิ่งวาง (เดิมทำแบบนั้น กด F เลยไปพลิกก้อนที่วางไปแล้วแทน) */
    selDecor=null; syncDecorBar(); return;
  }
  if(selSlug&&inGeneCard(mx,my))return;                // ปล่อยนิ้วบนการ์ดยีน = ไม่ใช่การเลือกทากใหม่
  let hit=null, hd=1e9;                                // เลือกทาก
  curTank.slugs.forEach(s=>{ if(s._hit){ const dd=Math.hypot(mx-s._hit.x,my-s._hit.y); if(dd<=s._hit.r && dd<hd){ hd=dd; hit=s; } } });
  selSlug=hit; selDecor=null; syncDecorBar();
});
tankCv.addEventListener('pointerleave', ()=>{ geneCardBuffHover=false; decorHover=null; cancelHold(); pendSlug=null; if(heldSlug) dropHeldSlug(); if(dragFood){ if(dragFoodMoved&&typeof saveGame==='function')saveGame(); dragFood=null; dragFoodMoved=false; } });
tankCv.addEventListener('wheel', e=>{
  if(!curTank) return;
  e.preventDefault();
  const rect=tankCv.getBoundingClientRect(), mx=e.clientX-rect.left, my=e.clientY-rect.top;
  const z0=tankCam.zoom, R=tankZoomRange();
  tankCam.zoom=Math.max(R.min, Math.min(R.max, z0*(e.deltaY<0?1.12:1/1.12)));
  // ทั้งภาพสเกลรอบจุด (ox,oy) เท่ากันหมด → ยึดจุดใต้เมาส์ด้วยสัดส่วนตรงๆ
  _zoomBusyT = performance.now() + 180;        // ซูมอยู่: ใช้ของแคชยืดเอา อบใหม่ตอนนิ่ง
  const r=tankCam.zoom/z0;
  tankCam.ox = mx - r*(mx - tankCam.ox);
  tankCam.oy = my - r*(my - tankCam.oy);
  clampTankPan();                               // ซูมออกสุด = ตู้เต็มจอพอดี ไม่มีที่ให้แพนหลุด
}, {passive:false});
/* สองนิ้วซูมในตู้ — เส้นทางเดียวกับล้อเมาส์ด้านบนเป๊ะ (เพดาน/พื้น · ยึดจุด · แคชตอนซูม · กันแพนหลุด) */
if(typeof PinchZoom!=='undefined')PinchZoom.attach(tankCv,{
  active:()=>!!curTank,
  zoom:()=>tankCam.zoom,
  apply:(z,mx,my)=>{
    const z0=tankCam.zoom, R=tankZoomRange();
    tankCam.zoom=Math.max(R.min, Math.min(R.max, z));
    _zoomBusyT = performance.now() + 180;
    const r=tankCam.zoom/z0;
    tankCam.ox = mx - r*(mx - tankCam.ox);
    tankCam.oy = my - r*(my - tankCam.oy);
    clampTankPan();
  }
});
