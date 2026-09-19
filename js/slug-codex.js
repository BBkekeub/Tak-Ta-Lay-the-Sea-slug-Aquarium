/* slug-codex.js — สมุดบันทึกสายพันธุ์ (แผนที่ต้นไม้ ลาก/ซูมได้)

   สายพันธุ์ = สีลำตัว × สีหงอน × ขั้นจำนวนหงอน = 9 × 9 × 6 = 486 ช่อง
   - สีใช้ "หลักสี" 9 หลักที่อาร์ตยึดอยู่แล้ว (BODY_ANCH/GILL_ANCH ทุก ๆ 50 บนสเกล 0–400)
     ยีนสีเป็นค่าต่อเนื่อง ทากที่สีคร่อมกลางระหว่างหลัก (เช่น 275) จะหมอง ไม่นับเข้าช่อง
     เกณฑ์: anchorPurity >= PURITY_MIN  (= ห่างจากหลักสีไม่เกิน ±5 จาก 400)
   - ขั้นหงอนมาจาก LADDER ใน slug-engine.js: floor(|gillN-50|/10) → [2,3,5,6,8,9]
     ⚠️ ขั้น 8 กับ 9 ต้องใช้ gillN ใกล้ 0/100 ซึ่ง "เกินช่วงของกล่องสุ่มทุกระดับ"
        (กล่องแพงสุดยัง lo:20 hi:80 — slug-box-shop.js) สองขั้นนี้จึงเพาะเองเท่านั้น

   ผังแผนที่: ไม่ใช้วงกลมสามชั้นรัศมีเท่ากัน เพราะเสียพื้นที่วงในแล้วไปเบียดกันขอบนอก
   แต่ละกิ่งเป็น "พุ่ม" กินพื้นที่รูปลิ่ม — 9 สายจัด 3 แถวลึกเข้าไป และ 6 ขั้นหงอน
   เป็นดอกล้อมรอบแต่ละสาย ถมช่องว่างระหว่างแถว
   กิ่งเรียงตามค่ายีนจริง (ดำ=0 → ทอง=400) กิ่งที่ติดกัน = ยีนใกล้กัน ใช้วางแผนเพาะได้
   เว้นช่องไว้ระหว่าง ดำ กับ ทอง เพราะอยู่คนละปลายสเกล ไม่ได้ติดกัน

   ช่องที่ปลดแล้ววาด "ทากตัวจริง" ด้วย drawSlug() จากยีนที่บันทึกไว้ ไม่ใช่ไอคอน
   ช่องที่ยังไม่เจอวาดเป็นเงาถมดำ (รูปทรงตามขั้นหงอน) — เห็นว่ามีสายอะไรให้ไปบ้าง

   เก็บใน G.codex แบบ sparse (เฉพาะช่องที่เจอ) · ต้องเพิ่มฟิลด์ใน save.js ด้วย
   บันทึกด้วยการสแกนทากที่ครอบครองเป็นรอบ ๆ ไม่ได้แปะ hook ทีละแหล่ง
   จะได้ครอบคลุมทั้งเพาะ กล่องสุ่ม พ่อค้าเร่ ของขวัญ โดยไม่ต้องแก้ไฟล์พวกนั้น */
(function(){
 if(typeof G==='undefined'||typeof SlugEngine==='undefined'){ console.warn('[codex] ไม่มี G/SlugEngine'); return; }
 if(!G.codex||typeof G.codex!=='object') G.codex={};

 const LAD=[2,3,5,6,8,9], PURITY_MIN=0.8, SCAN_MS=45000;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 /* ความ "ตรงหลักสี" — 1 ที่ตัวคูณของ 50 พอดี, 0 ตรงกึ่งกลางระหว่างหลัก (ก๊อปสูตรจาก slug-engine.js) */
 const purity=v=>{ const d=((v%50)+50)%50; return 1-Math.min(d,50-d)/25; };
 const bodyIdx=v=>Math.round(clamp(v,0,400)/50);
 const gillStep=v=>Math.min(5,Math.floor(Math.abs(v-50)/10));
 const BN=()=>SlugEngine.BODY_ANCH, GN=()=>SlugEngine.GILL_ANCH;

 /* ยีนชุดกลางไว้วาดเงาช่องที่ยังไม่เจอ — รู้แค่ขั้นหงอน ยังไม่รู้ยีนอื่นของตัวจริง */
 const GHOST_GILLN=[50,38,27,16,6,0];
 const ghostGene=k=>({bodyDepth:45,gillDepth:45,mainC:200,accC:200,len:50,girth:50,gillLen:50,tentLen:50,vigor:50,gillN:GHOST_GILLN[k],spotN:50});

 /* ยีนจากเซฟอาจเพี้ยน (NaN/Infinity/หายไปบางตัว) — drawSlug() เจอค่าแบบนั้นแล้ววาดเละหรือโยน error
    กันไว้ตรงทางเข้าทางเดียว ทั้งตอนบันทึกและตอนอ่านกลับมาวาด */
 const GKEYS=['bodyDepth','gillDepth','mainC','accC','len','girth','gillLen','tentLen','vigor','gillN','spotN'];
 function sane(g){
  const base=ghostGene(0), out={};
  for(const k of GKEYS){
   const v=Number(g&&g[k]);
   out[k]=Number.isFinite(v)?clamp(v,0,(k==='mainC'||k==='accC')?400:100):base[k];
  }
  return out;
 }

 function keyOf(s){
  const g=s&&s.genes; if(!g) return null;
  if(purity(clamp(g.mainC,0,400))<PURITY_MIN||purity(clamp(g.accC,0,400))<PURITY_MIN) return null;
  return bodyIdx(g.mainC)+'-'+bodyIdx(g.accC)+'-'+gillStep(g.gillN);
 }

 /* ---- บันทึก ----
    เก็บยีนเต็มชุดของตัวที่บันทึก เพราะต้องเอากลับมา drawSlug() ตอนเปิดสมุด
    ตัวแรกที่เจอเป็นเจ้าของช่อง (first ซึ่งคือ "ค้นพบเมื่อไหร่") ส่วนสถิติ ซม. อัปเดตได้เรื่อย ๆ */
 function ownedSlugs(){
  const out=[];
  for(const o of (G.objs||[])) if(o&&Array.isArray(o.slugs)) out.push(...o.slugs);
  for(const o of (G.shelter||[])) if(o&&Array.isArray(o.slugs)) out.push(...o.slugs);
  for(const s of (G.inv||[])) if(s) out.push(s);
  return out;
 }
 /* ⚠️ หนึ่งช่องเก็บแค่ "ตัวแรกที่เจอ" เท่านั้น — เวลาที่พบ + ยีนของมัน จบ
    ตัวที่เจอทีหลังไม่บันทึกอะไรเลย แม้จะตัวใหญ่กว่า/สวยกว่า ช่องเป็นของตัวแรกตลอดไป
    (เวอร์ชันก่อนเก็บสถิติ "ตัวใหญ่สุดที่เคยได้" กับจำนวนที่มีอยู่ด้วย = ข้อมูลของตัวอื่น ตัดทิ้งแล้ว)
    ขนาด ซม. ไม่ต้องเก็บ คำนวณสดจากยีนได้ตลอดด้วย slugRealCm() */
 const LEGACY=['seen','best','n'];
 function scan(){
  let dirty=false;
  for(const s of ownedSlugs()){
   const k=keyOf(s); if(!k||G.codex[k]) continue;
   G.codex[k]={at:Date.now(), g:sane(s.genes)};
   dirty=true;
  }
  for(const k of Object.keys(G.codex)){                     // ล้างฟิลด์ของเวอร์ชันเก่าออกจากเซฟ
   const e=G.codex[k];
   for(const f of LEGACY) if(f in e){ delete e[f]; dirty=true; }
  }
  if(dirty&&typeof saveGame==='function') saveGame();
  return dirty;
 }
 window.slugCodexScan=scan;
 window.slugCodexCount=()=>Object.keys(G.codex||{}).length;

 /* ---- ผังพุ่ม (คำนวณครั้งเดียว) ---- */
 const C=1850, HUB=300, ROW=[820,1180,1540], COL=[-13.5,0,13.5], LBL_R=1760;
 const rndS=n=>{const x=Math.sin(n*127.1)*43758.5453;return x-Math.floor(x);};
 const jit=(s,m)=>(rndS(s)-0.5)*2*m;
 const P1=[],P2=[],P3=[];
 for(let i=0;i<9;i++){
  const th=(-90+(i-4)*37.4)*Math.PI/180;
  P1.push({x:C+Math.cos(th)*HUB,y:C+Math.sin(th)*HUB,a:th}); P2.push([]); P3.push([]);
  for(let j=0;j<9;j++){
   const r=ROW[Math.floor(j/3)]+jit(i*31+j*7,58), da=(COL[j%3]+jit(i*17+j*13,2.6))*Math.PI/180;
   const x=C+Math.cos(th+da)*r, y=C+Math.sin(th+da)*r;
   P2[i].push({x,y}); P3[i].push([]);
   for(let k=0;k<6;k++){
    const ra=th+da+Math.PI+(k-2.5)*(58*Math.PI/180)+jit(i+j*3+k*11,0.09), rr=92+jit(i*5+j+k*23,13);
    P3[i][j].push({x:x+Math.cos(ra)*rr, y:y+Math.sin(ra)*rr});
   }
  }
 }

 /* ---- สไปรต์: วาดครั้งเดียวแล้วแคช ----
    ไม่สแกน bbox ต่อตัว (486 ตัว × แสนพิกเซล = ช้าเกิน) ใช้กรอบคงที่ที่เผื่อไว้แล้ว
    อัตราส่วนวัดจากอาร์ตจริง: ตัวกินราว x[-1.0H,+0.7H] y[-1.25H,0] รอบจุดยึด */
 /* ขนาดต้นฉบับตั้งให้ "ดอก" (ชั้นที่ผู้เล่นดูจริง) ไม่ต้องขยายเลยแม้ซูมสุด — ดอกกว้างสุด ~90px
    ส่วนดุม/สายเป็นตัวแทนประดับ ยอมให้ซอฟต์ได้ตอนซูมสุด แลกกับแคชที่ไม่บวม
    (แคช 1 ช่อง = 1 แคนวาส ~43KB · ต่อให้เก็บครบ 486 ช่องก็ราว 20MB และใช้ซ้ำทั้งสามชั้น) */
 const SPW=116, SPH=92, SPH_H=41, ANX=64, ANY=83;
 /* แคชมีเพดานและวิธีปล่อย (กฎหมวด 9):
      key      = 'r-<ช่อง>' สำหรับตัวจริง · 'ghost-<ขั้นหงอน>' สำหรับเงา
      invalid  = ไม่มี — ยีนของช่องถูกล็อกตอนบันทึกครั้งแรก ภาพจึงไม่เปลี่ยนอีก
      เพดาน    = CACHE_MAX ตัวจริง (LRU ทิ้งตัวที่ไม่ได้ใช้นานสุด) · เงา 6 ตัวอยู่คนละถัง ไม่โดนทิ้ง
      ปล่อย    = ตั้ง width=0 ให้เบราว์เซอร์คืนบิตแมปทันที ไม่รอ GC */
 const CACHE_MAX=220;
 const cache=new Map(), ghosts=new Map();
 function render(genes,dark){
  const c=document.createElement('canvas'); c.width=SPW; c.height=SPH;
  const x=c.getContext('2d');
  try{
   const wasAnim=SlugEngine.ANIM; SlugEngine.ANIM=false;      // สมุดเป็นภาพนิ่ง ไม่ต้องให้มันขยับ
   SlugEngine.drawSlug(x,SlugEngine.slugParts(sane(genes),SPH_H),ANX,ANY,false,0,1,true,false,{});
   SlugEngine.ANIM=wasAnim;
   if(dark){ x.globalCompositeOperation='source-in'; x.fillStyle=dark; x.fillRect(0,0,SPW,SPH); x.globalCompositeOperation='source-over'; }
  }catch(e){}
  return c;
 }
 const ghostSprite=k=>{                                            // เงาต้องเห็นว่ามีช่องอยู่ ไม่ใช่จมหายไปกับพื้น
  if(!ghosts.has(k)) ghosts.set(k,render(ghostGene(k),'#1d363c'));
  return ghosts.get(k);
 };
 function evict(){
  while(cache.size>CACHE_MAX){
   const old=cache.keys().next().value, cv0=cache.get(old);
   cache.delete(old); if(cv0) cv0.width=0;
  }
 }
 /* ⚠️ อบทากตัวหนึ่งใช้ ~45 ms (gradient-map + แสง + ประกาย — เหตุผลเดียวกับที่ boot.js ต้องอบล่วงหน้า)
    ถ้าอบทุกตัวที่เห็นตอนเปิดสมุด เซฟที่เก็บครบ 486 ช่องจะค้างเป็นสิบวินาที
    จึงคืนเงาไปก่อนแล้วทยอยอบทีละก้อนในงบ ~10 ms ต่อรอบ วาดใหม่ทุกก้อน ภาพค่อย ๆ ติดสี
    คิวรับเฉพาะตัวที่ "อยู่ในจอจริง" เพราะ draw() คัดของนอกจอทิ้งไปก่อนแล้ว */
 const pending=new Map(); let pumping=false;
 function pump(){
  if(pumping) return; pumping=true;
  const step=()=>{
   const t0=performance.now(); let did=0;
   for(const [id,g] of pending){
    pending.delete(id); cache.set(id,render(g,null)); evict(); did++;
    if(performance.now()-t0>10) break;
   }
   if(did) draw();
   if(pending.size) setTimeout(step,16); else pumping=false;
  };
  setTimeout(step,0);
 }
 function realSprite(key,e){
  const id='r-'+key;
  if(cache.has(id)){ const c=cache.get(id); cache.delete(id); cache.set(id,c); return c; }   // แตะแล้วเลื่อนไปท้ายคิว = LRU
  if(!pending.has(id)){ pending.set(id,e.g); pump(); }
  return null;                                   // ยังไม่พร้อม — ผู้เรียกจะใช้เงาไปก่อน
 }
 window.slugCodexCacheSize=()=>cache.size+ghosts.size;
 window.slugCodexPending=()=>pending.size;

 /* ---- หน้าต่าง ---- */
 let dlg=null,cv=null,ctx=null,span=3720,camx=C,camy=C,sel=null;
 const FULL=3720, MINSPAN=520;
 function build(){
  if(dlg) return;
  dlg=document.createElement('dialog'); dlg.id='slugCodex';
  dlg.style.cssText='width:min(1000px,96vw);padding:0;background:#0a1518;color:#eadcc4;border:1px solid #b59859;border-radius:14px;color-scheme:dark;overflow:hidden';
  dlg.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid #1d3439">'
   +'<b style="font-weight:600">📓 สมุดบันทึกสายพันธุ์</b>'
   +'<span data-count style="font-size:12px;color:#7d9ca1;margin-right:auto"></span>'
   +'<button class="tbtn" data-zo style="padding:2px 9px">−</button><button class="tbtn" data-zi style="padding:2px 9px">+</button>'
   +'<button class="tbtn" data-fit style="padding:2px 9px;font-size:12px">เต็มแผนที่</button>'
   +'<button class="tbtn" data-close aria-label="ปิด">✕</button></div>'
   +'<div data-wrap style="position:relative;background:#0a1518;touch-action:none;cursor:grab">'
   +'<canvas data-cv style="display:block;width:100%;height:min(66vh,560px)"></canvas>'
   +'<div data-card style="position:absolute;left:0;right:0;bottom:0;padding:8px 12px;background:linear-gradient(transparent,#0a1518 55%);font-size:12.5px;line-height:1.6;pointer-events:none;min-height:38px"></div>'
   +'</div>';
  document.body.append(dlg);
  cv=dlg.querySelector('[data-cv]'); ctx=cv.getContext('2d');
  dlg.querySelector('[data-close]').onclick=()=>dlg.close();
  dlg.querySelector('[data-zi]').onclick=()=>{span=Math.max(MINSPAN,span*0.7);draw();};
  dlg.querySelector('[data-zo]').onclick=()=>{span=Math.min(FULL,span*1.4);draw();};
  dlg.querySelector('[data-fit]').onclick=()=>{span=FULL;camx=camy=C;draw();};
  bindPointer(dlg.querySelector('[data-wrap]'));
  /* ไม่มีลูป rAF ให้หยุด — สมุดวาดเฉพาะตอนมีอินพุต (กฎ: ไม่ render ฉากที่ไม่ active)
     ⚠️ คู่กับ document.hidden ใน draw(): ถ้าสลับแท็บไปตอนสมุดเปิดอยู่ คำสั่งวาดจะถูกข้าม
     กลับมาแล้วต้องวาดซ้ำเอง ไม่งั้นเจอแคนวาสว่างจนกว่าจะขยับเมาส์ */
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&dlg&&dlg.open) draw(); });
  window.addEventListener('resize',()=>{ if(dlg.open) draw(); });
 }

 /* ⚠️ หน่วยมีสามระบบ อย่าปนกัน:
      world  = พิกัดบนแผนที่ (0..3700)
      canvas = พิกเซลจริงใน bitmap = CSS px × dpr   ← วาดด้วยระบบนี้
      CSS    = พิกเซลที่ pointer event ให้มา        ← ใช้ตอนลาก
    u = world ต่อ 1 พิกเซล canvas · K = dpr (คูณกับขนาดที่อยากให้คงที่บนจอ) */
 function fit(){
  const r=cv.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1);
  const w=Math.max(1,Math.round(r.width*dpr)), h=Math.max(1,Math.round(r.height*dpr));
  if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; }
  return {w,h,dpr,rect:r,u:span/h};
 }
 /* ขนาดหมุด: ทากเป็น "ของที่วางอยู่บนแผนที่" จึงมีขนาดคงที่ในหน่วย world แล้วโตตามการซูม
    (ซูมเข้าเพื่อดูตัวจริงชัด ๆ = จุดประสงค์ทั้งหมดของการซูม)
    minPx กันไม่ให้หายไปเลยตอนซูมออกสุด · world ตั้งจากระยะห่างจริงของชั้นนั้น
    ดอก ~80 · สาย ~300 (แต่ต้องไม่กลืนดอกที่รัศมี 92) · ดุม ~209 */
 const sizePx=(world,minPx,u,K)=>Math.max(minPx*K, world/u);
 function w2s(x,y,S){ return {x:(x-camx)/S.u+S.w/2, y:(y-camy)/S.u+S.h/2}; }

 function draw(){
  if(!dlg||!dlg.open||document.hidden) return;      // เอกสารถูกซ่อน = ไม่ต้องวาดอะไรเลย
  const S=fit(), u=S.u, K=S.dpr;
  ctx.fillStyle='#0a1518'; ctx.fillRect(0,0,S.w,S.h);
  /* คัดของนอกจอก่อนงานวาด — ซูมเข้าแล้วส่วนใหญ่ของ 577 จุดอยู่นอกกรอบ
     เผื่อขอบ MARGIN ไว้ เพราะจุดยึดอาจอยู่นอกจอแต่ตัวทากยังโผล่เข้ามา */
  const halfW=S.w*u/2, halfH=S.h*u/2, MARGIN=300;
  const vis=p=>p.x>camx-halfW-MARGIN&&p.x<camx+halfW+MARGIN&&p.y>camy-halfH-MARGIN&&p.y<camy+halfH+MARGIN;
  let drew=0;
  /* ใบโชว์ตลอด แม้ตอนซูมสุด — ทั้งผืนต้องอ่านออกว่ามีอะไรบ้างตั้งแต่เปิดมา
     worldCap ของแต่ละชั้นตั้งจากระยะห่างจริงของชั้นนั้น (ดอก ~80 · สาย ~300 · ดุม ~209) */
  const showName=span<=1500;
  const wid1=sizePx(190,15,u,K), wid2=sizePx(118,10,u,K), wid3=sizePx(74,5,u,K);
  /* เส้นโครงหรี่ไว้ อย่าให้แย่งสายตากับตัวทาก */
  ctx.lineCap='round';
  for(let i=0;i<9;i++){
   const h=P1[i], hs=w2s(h.x,h.y,S), cs=w2s(C,C,S);
   ctx.strokeStyle='#1b363b'; ctx.lineWidth=Math.max(1.4*K,0.9/u);
   ctx.beginPath(); ctx.moveTo(cs.x,cs.y); ctx.lineTo(hs.x,hs.y); ctx.stroke();
   for(let j=0;j<9;j++){
    const s=P2[i][j], ss=w2s(s.x,s.y,S), sv=vis(s);
    if(sv||vis(h)){
     ctx.lineWidth=Math.max(1*K,0.6/u);
     ctx.beginPath(); ctx.moveTo(hs.x,hs.y);
     ctx.quadraticCurveTo((hs.x+ss.x)/2+jit(i*9+j,40)/u,(hs.y+ss.y)/2+jit(i+j*9,40)/u,ss.x,ss.y); ctx.stroke();
    }
    if(!sv) continue;                                 // ก้านดอกอยู่รอบสายอยู่แล้ว สายไม่โผล่ = ดอกไม่โผล่
    for(let k=0;k<6;k++){
     const l=P3[i][j][k], ls=w2s(l.x,l.y,S);
     ctx.lineWidth=Math.max(0.8*K,0.4/u);
     ctx.beginPath(); ctx.moveTo(ss.x,ss.y); ctx.lineTo(ls.x,ls.y); ctx.stroke();
    }
   }
  }
  /* ใบ → สาย → กิ่ง (วาดจากเล็กไปใหญ่ ตัวใหญ่จะได้ทับบนสุด) */
  for(let i=0;i<9;i++){
   for(let j=0;j<9;j++) for(let k=0;k<6;k++){
    const l=P3[i][j][k]; if(!vis(l)) continue;
    const key=i+'-'+j+'-'+k, e=G.codex[key], p=w2s(l.x,l.y,S);
    blit((e&&realSprite(key,e))||ghostSprite(k), p.x, p.y, wid3, !!e, !!sel&&sel.t==='leaf'&&sel.k===key, K); drew++;
   }
   for(let j=0;j<9;j++){
    const s=P2[i][j]; if(!vis(s)) continue;
    const p=w2s(s.x,s.y,S);
    let rep=null; for(let k=0;k<6;k++){ const e=G.codex[i+'-'+j+'-'+k]; if(e){rep=[i+'-'+j+'-'+k,e];break;} }
    blit((rep&&realSprite(rep[0],rep[1]))||ghostSprite(0), p.x, p.y, wid2, !!rep, false, K); drew++;
    if(showName){
     ctx.fillStyle=rep?'#a8c2bd':'#4a686d'; ctx.font=Math.round(11*K)+'px "IBM Plex Sans Thai",system-ui,sans-serif';
     ctx.textAlign='center'; ctx.fillText(GN()[j].n, p.x, p.y-wid2*0.42-7*K);
    }
   }
   const h=P1[i], p=w2s(h.x,h.y,S);
   let rep=null,bn=0;
   for(let j=0;j<9;j++)for(let k=0;k<6;k++){ const e=G.codex[i+'-'+j+'-'+k]; if(e){ bn++; if(!rep)rep=[i+'-'+j+'-'+k,e]; } }
   if(vis(h)){ blit((rep&&realSprite(rep[0],rep[1]))||ghostSprite(0), p.x, p.y, wid1, !!rep, false, K); drew++; }
   ctx.fillStyle=bn?'#c9bda2':'#55757a'; ctx.font=Math.round(13*K)+'px "IBM Plex Sans Thai",system-ui,sans-serif';
   ctx.textAlign='center';
   /* ป้ายกิ่งวางที่ "ขอบนอกของพุ่ม" ไม่ใช่ข้างดุม — ชิดดุมแล้วทั้ง 9 ป้ายจะกองทับกันกลางจอ
      ที่รัศมีนี้แต่ละป้ายมีที่ ~1,200 หน่วย พอให้อ่านออกแม้ซูมสุด (อ่านเป็นชื่อเขตบนแผนที่) */
   const lp=w2s(C+Math.cos(h.a)*LBL_R, C+Math.sin(h.a)*LBL_R, S);
   ctx.fillText(BN()[i].n+'  '+bn+'/54', lp.x, lp.y);
  }
  const cs=w2s(C,C,S);
  blit(ghostSprite(0), cs.x, cs.y, sizePx(200,18,u,K), true, false, K);
  const n=Object.keys(G.codex).length;
  dlg.querySelector('[data-count]').textContent=n+' / 486 ช่อง'+(span>2900?' · ระดับกิ่ง':span>1400?' · เห็นครบทุกตัว':' · ระยะใกล้');
  window.__codexDrew=drew;                            // ไว้วัดผลการคัดของนอกจอตอนทดสอบ
 }
 function blit(spr,x,y,wpx,lit,hot,K){
  const w=wpx, h=w*(SPH/SPW);
  if(w<2*K){ ctx.fillStyle=lit?'#f1c66d':'#162c32'; ctx.fillRect(x-K,y-K,2*K,2*K); return; }
  if(hot){ ctx.save(); ctx.shadowColor='#f1c66d'; ctx.shadowBlur=16*K; }
  ctx.drawImage(spr, x-w*0.5, y-h*0.55, w, h);
  if(hot) ctx.restore();
 }

 /* ---- แตะเลือกช่อง: หาใบที่ใกล้ที่สุดในรัศมีที่ยอมรับ ---- */
 /* ⚠️ ต้องเช็กทั้งสามชั้น — ตอนซูมเข้า ตัวที่เด่นที่สุดบนจอคือชั้น "สาย" ไม่ใช่ "ดอก"
    ถ้าเช็กแต่ดอกไว้ ผู้เล่นจะกดตัวใหญ่ ๆ แล้วไม่มีอะไรเกิดขึ้น เหมือนสมุดเสีย
    ดอกชนะก่อนเสมอถ้าอยู่ในระยะ เพราะเป็นช่องข้อมูลจริง ส่วนสาย/ดุมเป็นตัวแทน */
 function hit(px,py){
  const S=fit(), u=S.u, K=S.dpr;
  const near=(pt,w)=>{ const p=w2s(pt.x,pt.y,S); return Math.hypot(p.x-px,p.y-py)<=w*0.55?Math.hypot(p.x-px,p.y-py):-1; };
  let best=null,bd=1e9;
  const wl=Math.max(14*K,sizePx(74,5,u,K)), ws=sizePx(118,10,u,K), wh=sizePx(190,15,u,K);
  for(let i=0;i<9;i++)for(let j=0;j<9;j++)for(let k=0;k<6;k++){
   const d=near(P3[i][j][k],wl); if(d>=0&&d<bd){ bd=d; best={t:'leaf',k:i+'-'+j+'-'+k}; }
  }
  if(best) return best;
  for(let i=0;i<9;i++)for(let j=0;j<9;j++){
   const d=near(P2[i][j],ws); if(d>=0&&d<bd){ bd=d; best={t:'sp',i,j}; }
  }
  if(best) return best;
  for(let i=0;i<9;i++){ const d=near(P1[i],wh); if(d>=0&&d<bd){ bd=d; best={t:'hub',i}; } }
  return best;
 }
 const D2=n=>String(n).padStart(2,'0');
 function card(h){
  const box=dlg.querySelector('[data-card]');
  if(!h){ box.innerHTML='<span style="color:#7d9ca1">แตะทากตัวไหนก็ได้เพื่อดูรายละเอียด · ลากเพื่อเลื่อน เลื่อนล้อเพื่อซูม · แตะดุมกิ่งเพื่อบินไปดูทั้งพุ่ม</span>'; return; }
  if(h.t==='sp'){                       // กดชั้นสาย = สรุปว่าสายนี้เก็บขั้นหงอนได้ถึงไหนแล้ว
   const rows=LAD.map((n,k)=>{ const e=G.codex[h.i+'-'+h.j+'-'+k];
    return '<span style="color:'+(e?'#f1c66d':'#5c7c80')+';margin-right:12px">'+n+' หงอน '+(e?'✓':(k<4?'—':'✕'))+'</span>'; }).join('');
   box.innerHTML='<b style="color:#f1c66d">'+BN()[h.i].n+' / '+GN()[h.j].n+'</b><br>'+rows
    +'<br><span style="color:#7d9ca1;font-size:11.5px">✕ = ขั้นที่กล่องสุ่มให้ไม่ได้ ต้องเพาะเอง</span>';
   return;
  }
  const key=h.k, [i,j,k]=key.split('-').map(Number), e=G.codex[key];
  const head='<b style="color:#f1c66d">'+BN()[i].n+' / '+GN()[j].n+' · '+LAD[k]+' หงอน</b>';
  if(!e){ box.innerHTML=head+' <span style="color:#6d8a8e">— ยังไม่เคยเจอ'
    +(k>=4?' · ขั้นนี้ไม่มีในกล่องสุ่มทุกระดับ ต้องเพาะเอง':'')+'</span>'; return; }
  const d=new Date(e.at), g=e.g, D=SlugEngine.derived(g);
  let m=null; try{ if(typeof slugRealCm==='function') m=slugRealCm({genes:g},g); }catch(err){}
  const cm=v=>Number.isFinite(v)?v.toFixed(1)+' ซม.':'—';
  box.innerHTML=head
   +' <span style="color:#8fa8a4">· พบเมื่อ '+(d.getFullYear()+543)+'-'+D2(d.getMonth()+1)+'-'+D2(d.getDate())+'</span><br>'
   +(m?'<span style="color:#cfe0dc">ยาว '+cm(m.len)+' · ตัว '+cm(m.girth)+' · หงอนสูง '+cm(m.gill)+' · หนวดยาว '+cm(m.tent)+'</span><br>':'')
   +'<span style="color:#7d9ca1;font-size:11.5px">สีตัว '+Math.round(g.mainC)+' · สีหงอน '+Math.round(g.accC)
   +' · ความสมบูรณ์ '+Math.round(g.vigor)+' · ลาย '+D.nSpot+' ดวง · ร่องตัว '+Math.round(g.bodyDepth)+' · ร่องหงอน '+Math.round(g.gillDepth)+'</span>';
 }

 function bindPointer(wrap){
  let down=null,moved=false;const pts={};
  wrap.addEventListener('pointerdown',e=>{ wrap.setPointerCapture(e.pointerId); pts[e.pointerId]={x:e.clientX,y:e.clientY};
   down={x:e.clientX,y:e.clientY,cx:camx,cy:camy}; moved=false; wrap.style.cursor='grabbing'; });
  wrap.addEventListener('pointermove',e=>{
   if(!pts[e.pointerId])return;
   const ids=Object.keys(pts);
   if(ids.length>=2){                              // หนีบสองนิ้วซูม
    const a=pts[ids[0]],b=pts[ids[1]],d0=Math.hypot(a.x-b.x,a.y-b.y);
    pts[e.pointerId]={x:e.clientX,y:e.clientY};
    const a2=pts[ids[0]],b2=pts[ids[1]],d1=Math.hypot(a2.x-b2.x,a2.y-b2.y);
    if(d0>8&&d1>8){ span=clamp(span*d0/d1,MINSPAN,FULL); moved=true; draw(); }
    return;
   }
   pts[e.pointerId]={x:e.clientX,y:e.clientY};
   if(!down)return;
   const uCss=span/Math.max(1,cv.getBoundingClientRect().height);   // pointer ให้มาเป็น CSS px ไม่ใช่ canvas px
   if(Math.abs(e.clientX-down.x)+Math.abs(e.clientY-down.y)>4) moved=true;
   camx=down.cx-(e.clientX-down.x)*uCss; camy=down.cy-(e.clientY-down.y)*uCss; draw();
  });
  const up=e=>{
   const was=pts[e.pointerId]; delete pts[e.pointerId]; down=null; wrap.style.cursor='grab';
   if(was&&!moved){
    const r=cv.getBoundingClientRect(), dpr=cv.width/r.width;
    const h=hit((e.clientX-r.left)*dpr,(e.clientY-r.top)*dpr);
    if(h&&h.t==='hub'){                       // กดดุม = บินไปดูพุ่มนั้นทั้งพุ่ม
     sel=null; camx=C+Math.cos(P1[h.i].a)*1150; camy=C+Math.sin(P1[h.i].a)*1150;
     span=Math.min(span,1600); card(null);
    } else { sel=h; card(h); }
    draw();
   }
  };
  wrap.addEventListener('pointerup',up); wrap.addEventListener('pointercancel',up);
  wrap.addEventListener('wheel',e=>{ e.preventDefault(); span=clamp(span*(e.deltaY>0?1.18:0.85),MINSPAN,FULL); draw(); },{passive:false});
 }

 window.openSlugCodex=function(){
  build(); scan();
  if(!dlg.open) dlg.showModal();
  card(sel); draw();
  /* วาดซ้ำอีกที เผื่อ dialog ยังไม่ได้ layout ตอนเรียกครั้งแรก (rect เป็น 0)
     ⚠️ ห้ามพึ่ง requestAnimationFrame อย่างเดียว — แท็บที่ถูกซ่อนอยู่จะไม่ยิง rAF เลย แล้วสมุดจะว่างเปล่า */
  setTimeout(draw,60);
 };

 /* สแกนเป็นรอบ ๆ — ครอบคลุมทุกทางที่ทากเข้าร้าน โดยไม่ต้องแปะ hook ทีละแหล่ง */
 setTimeout(scan,4000);
 setInterval(scan,SCAN_MS);
})();
