/* ============================================================
   online-order.js — ออเดอร์ออนไลน์ (ลูกค้าเจ้ายศส่งใบสั่งทากมาทางคอมพิวเตอร์ร้าน)
   - ทุก ๆ 45–60 นาที (เวลาจริง นับต่อแม้ปิดเกม) จะมีออเดอร์ใหม่เข้ากล่อง "📬 เควส / ออเดอร์ออนไลน์"
   - แต่ละออเดอร์ล็อกยีนมา 3 ค่า ที่เหลือไม่สนใจ · แนบรูปตัวอย่างทากที่ฟิก 3 ยีนนั้น ที่เหลือสุ่ม
   - ไม่มีกำหนดส่ง · ส่งทากที่ยีนตรง (คลาดได้ ±10% ของช่วงยีน = matchPct 90) รับ 1,500 เหรียญ
   - ข้อมูลออเดอร์อยู่ใน G.orders / G.nextOrderAt (เซฟใน save.js) · จดหมายในกล่องอ้างถึงด้วย id เดียวกัน
   ใช้: SlugEngine (GENES/randGene/colorName) · drawSlugPortrait (slug-transfer.js)
        receiveComputerMessage / computerInbox / showcase (cat-seller.js) · toast/saveGame/syncHUD
   ============================================================ */
(function(){
 'use strict';

 /* ===== ค่าปรับได้ ===== */
 var GAP_MIN_MS = 45*60*1000;       // เว้นระยะออเดอร์ ต่ำสุด 45 นาที
 var GAP_MAX_MS = 60*60*1000;       // เว้นระยะออเดอร์ สูงสุด 60 นาที
 var FIRST_MS   = 60*1000;          // ออเดอร์ใบแรกของร้าน มาเร็วหน่อย (1 นาที) ให้เห็นว่าระบบทำงาน
 var REWARD     = 1500;             // ค่าตอบแทนต่อออเดอร์
 var FIXED_N    = 3;                // ล็อกยีนกี่ค่าต่อออเดอร์
 var TOL_PCT    = 10;               // คลาดได้กี่ % ของช่วงยีน (10% = ±10 ในยีน 0–100, ±40 ในยีนสี 0–400)
 var MAX_OPEN   = 3;                // ค้างพร้อมกันได้กี่ใบ (เต็มแล้วเลื่อนใบถัดไปออกไป 10 นาที)
 var RETRY_MS   = 10*60*1000;
 /* ===================== */

 var RANGE = { bodyDepth:100, gillDepth:100, mainC:400, accC:400, len:100, girth:100,
               gillLen:100, tentLen:100, vigor:100, gillN:100, spotN:100 };
 var LABEL = { bodyDepth:'ร่องสีตัว', gillDepth:'ร่องสีหงอน', mainC:'สีลำตัว', accC:'สีหงอนเหงือก',
               len:'ความยาวลำตัว', girth:'ขนาดตัวรวม', gillLen:'ความสูงหงอนเหงือก', tentLen:'ความยาวหนวด',
               vigor:'ความสมบูรณ์', gillN:'จำนวนหงอนเหงือก', spotN:'ลาย (รูปทรง+จำนวน)' };
 var KEYS = Object.keys(RANGE);

 var rangeOf = function(k){ return RANGE[k] || 100; };
 var tolOf   = function(k){ return Math.round(rangeOf(k) * TOL_PCT / 100); };
 function label(k){
  try{ var g=SlugEngine.GENES.find(function(x){return x.k===k;}); if(g&&g.th) return g.th; }catch(e){}
  return LABEL[k] || k;
 }
 function geneText(k,v){
  var n = Math.round(+v||0);
  if((k==='mainC'||k==='accC') && typeof SlugEngine!=='undefined' && SlugEngine.colorName){
   try{ return n+' · '+SlugEngine.colorName(n); }catch(e){}
  }
  return String(n);
 }
 var esc = function(s){ return String(s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };

 /* ---- คนสั่ง + ข้อความท้าทาย (สุ่มต่อออเดอร์) ---- */
 var BUYERS = [
  {name:'เสี่ยหอยทาก', taunt:'ได้ยินว่าเปิดร้านทากอยู่ใช่ไหม? พอดีอยากได้ทากสเปกนี้ แต่ถามมาสามร้านแล้วไม่มีใครเพาะออก\nจะลองสั่งดูสักตั้ง… ถ้าทำไม่ได้ก็ไม่เป็นไรนะ กูชินแล้ว'},
  {name:'นักสะสมนิรนาม', taunt:'ใบสั่งนี้เคยส่งให้ร้านใหญ่ในเมืองแล้ว เขาบอกว่า "ยาก" แล้วก็เงียบไปเลย\nลองดูไหมล่ะ เผื่อร้านเล็ก ๆ จะมีของดีซ่อนอยู่ (แต่กูไม่ค่อยหวังหรอกนะ)'},
  {name:'คุณหญิงหงอนทอง', taunt:'ฉันไม่ซื้อทากสวย ๆ ทั่วไปหรอก ฉันซื้อ "ยีน" ต่างหาก\nสามค่านี้พลาดไม่ได้ ที่เหลือฉันไม่แคร์ — เพาะให้ได้ก่อนแล้วค่อยมาคุยเรื่องเงินกัน'},
  {name:'ร้านทากข้างบ้าน', taunt:'เพื่อนบ้านครับ ผมรับออเดอร์นี้มาแต่เพาะไม่ทัน (จริง ๆ คือเพาะไม่ออก 555)\nโยนต่อให้เลยละกัน ทำได้ก็เก่งจริง ทำไม่ได้ก็… เหมือนผม'},
  {name:'ลูกค้าปากดี', taunt:'ทุกร้านชอบบอกว่า "เพาะได้ทุกแบบครับ" พอสั่งจริงก็เงียบทุกที\nคราวนี้กูสั่งเป็นตัวเลขเลย จะได้ไม่ต้องเถียงกัน เอาให้ตรงสามค่านี้มา แล้วกูจะยอมรับว่ามึงเก่ง'},
  {name:'ผู้หวังดีที่รวยกว่า', taunt:'อ้าว ยังไม่เจ๊งอีกเหรอ? ดีใจด้วยนะ\nอะ ๆ ส่งงานให้ทำ จะได้มีเงินซื้อข้าว — ทำได้ไหมล่ะ แค่สามยีนเอง ง่ายจะตาย (มั้ง)'}
 ];

 /* ---- สุ่มออเดอร์ ---- */
 function pickKeys(n){
  var pool = KEYS.slice(), out = [];
  while(out.length<n && pool.length) out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  return out;
 }
 function wantValue(k){
  var R = rangeOf(k);
  return Math.round(R * (0.08 + Math.random()*0.84));   // เลี่ยงขอบสุดที่เพาะไปไม่ถึง
 }
 function randomGenes(){
  if(typeof SlugEngine!=='undefined' && SlugEngine.randGene){ try{ return SlugEngine.randGene(); }catch(e){} }
  var g={}; for(var i=0;i<KEYS.length;i++) g[KEYS[i]]=Math.round(Math.random()*rangeOf(KEYS[i]));
  return g;
 }
 function makeOrder(){
  var keys = pickKeys(FIXED_N), want = {}, i;
  for(i=0;i<keys.length;i++) want[keys[i]] = wantValue(keys[i]);
  var genes = randomGenes();                       // ยีนที่เหลือ = สุ่ม
  for(i=0;i<keys.length;i++) genes[keys[i]] = want[keys[i]];   // 3 ค่าที่บังคับ = ฟิกตรงเป๊ะ (ใช้เป็นรูปตัวอย่าง)
  var buyer = BUYERS[Math.floor(Math.random()*BUYERS.length)];
  G.orderSeq = (G.orderSeq|0) + 1;
  return { id:'order-'+G.orderSeq, at:Date.now(), keys:keys, want:want, genes:genes,
           reward:REWARD, buyer:buyer.name, taunt:buyer.taunt, done:false, doneAt:0, slugId:'' };
 }
 function orderBody(o){
  var lines = ['ต้องการทากที่ยีน 3 ค่านี้ตรงตามสเปก:'];
  for(var i=0;i<o.keys.length;i++){
   var k=o.keys[i];
   lines.push('   • '+label(k)+' = '+geneText(k,o.want[k])+'  (คลาดได้ ±'+tolOf(k)+')');
  }
  return o.taunt+'\n\n'+lines.join('\n')
   +'\n\nยีนที่เหลือไม่สนใจ จะออกมาแบบไหนก็ได้ (รูปตัวอย่างที่แนบมาคือฟิก 3 ค่านั้น ที่เหลือสุ่มมาให้ดูเฉย ๆ)'
   +'\nไม่มีกำหนดส่ง — ว่างเมื่อไหร่ค่อยส่งมา ไม่ต้องรีบ (ถ้าทำได้จริงนะ)'
   +'\nค่าตอบแทน: '+REWARD.toLocaleString()+' เหรียญ'
   +'\n\n— '+o.buyer;
 }

 /* ---- คลังออเดอร์ ---- */
 function orders(){ if(!Array.isArray(G.orders)) G.orders=[]; return G.orders; }
 function findOrder(id){ var a=orders(); for(var i=0;i<a.length;i++) if(a[i].id===id) return a[i]; return null; }
 function inboxHas(id){
  if(typeof computerInbox!=='function') return true;
  var a=computerInbox(); for(var i=0;i<a.length;i++) if(a[i].id===id) return true;
  return false;
 }
 function openCount(){ var a=orders(),n=0; for(var i=0;i<a.length;i++) if(!a[i].done) n++; return n; }

 function sendOrder(){
  if(typeof receiveComputerMessage!=='function') return false;
  var o = makeOrder();
  var ok = receiveComputerMessage({ id:o.id, type:'online', title:'ออเดอร์ออนไลน์ · '+o.buyer, body:orderBody(o) });
  if(!ok){ G.orderSeq=(G.orderSeq|0)-1; return false; }
  orders().push(o);
  if(typeof toast==='function') toast('📬 มีออเดอร์ออนไลน์เข้ามาใหม่! เปิดคอมพิวเตอร์ที่เคาน์เตอร์ดูได้เลย','good');
  if(typeof saveGame==='function') saveGame();
  return true;
 }

 /* ---- ตัวจับเวลา (เวลาจริง เดินต่อแม้ปิดเกมไป) ---- */
 function scheduleNext(gap){
  G.nextOrderAt = Date.now() + (gap!=null ? gap : (GAP_MIN_MS + Math.random()*(GAP_MAX_MS-GAP_MIN_MS)));
 }
 function tick(){
  if(!Number.isFinite(G.nextOrderAt) || G.nextOrderAt<=0){ scheduleNext(FIRST_MS); if(typeof saveGame==='function') saveGame(); return; }
  /* ใบที่ผู้เล่นลบจดหมายทิ้ง = ปฏิเสธออเดอร์ ไม่ต้องนับว่าค้าง */
  var a=orders(), keep=[];
  for(var i=0;i<a.length;i++) if(a[i].done || inboxHas(a[i].id)) keep.push(a[i]);
  if(keep.length!==a.length) G.orders=keep;
  if(Date.now() < G.nextOrderAt) return;
  if(openCount() >= MAX_OPEN){ scheduleNext(RETRY_MS); return; }   // ค้างเยอะแล้ว ยังไม่ยัดเพิ่ม
  if(sendOrder()) scheduleNext(); else scheduleNext(RETRY_MS);
  if(typeof saveGame==='function') saveGame();
 }

 /* ---- ตรวจว่าทากตรงสเปกไหม (ใช้ยีนต้น ไม่นับบัฟอาหารชั่วคราว) ---- */
 function geneMatch(o,s){
  var g = (s && s.genes) || {}, rows = [], all = true;
  for(var i=0;i<o.keys.length;i++){
   var k=o.keys[i], mine=+g[k]||0, off=Math.abs(mine-o.want[k]), tol=tolOf(k), ok=off<=tol;
   if(!ok) all=false;
   rows.push({k:k, mine:mine, want:o.want[k], off:off, tol:tol, ok:ok});
  }
  return {ok:all, rows:rows};
 }
 function candidates(){
  var out=[], i, j;
  for(i=0;i<(G.inv||[]).length;i++) out.push({s:G.inv[i], tank:null});
  for(i=0;i<(G.objs||[]).length;i++){
   var o=G.objs[i]; if(!o || o.type!=='tank') continue;
   for(j=0;j<(o.slugs||[]).length;j++) out.push({s:o.slugs[j], tank:o});
  }
  return out.filter(function(c){
   if(typeof slugTransferLocked==='function'){ try{ return !slugTransferLocked(c.s,c.tank); }catch(e){} }
   return true;
  });
 }

 /* ---- ส่งทาก ---- */
 function submit(orderId, slugId){
  var o=findOrder(orderId);
  if(!o) { if(typeof toast==='function') toast('ไม่พบออเดอร์ใบนี้แล้ว','bad'); return false; }
  if(o.done){ if(typeof toast==='function') toast('ออเดอร์ใบนี้ส่งไปแล้ว','bad'); return false; }
  var list=candidates(), hit=null;
  for(var i=0;i<list.length;i++) if(list[i].s.id===slugId) hit=list[i];
  if(!hit){ if(typeof toast==='function') toast('ทากตัวนี้ส่งไม่ได้ (ถูกย้าย/กำลังผสม/มีข้อเสนอซื้ออยู่)','bad'); return false; }
  if(!geneMatch(o,hit.s).ok){ if(typeof toast==='function') toast('ยีนยังไม่ตรงสเปกของออเดอร์นี้','bad'); return false; }
  var src = hit.tank ? hit.tank.slugs : G.inv, at = src.indexOf(hit.s);
  if(at<0){ if(typeof toast==='function') toast('ทากตัวนี้ถูกย้ายไปแล้ว','bad'); return false; }
  src.splice(at,1);
  try{ if(typeof selSlug!=='undefined'&&selSlug===hit.s) selSlug=null; }catch(e){}
  try{ if(typeof heldSlug!=='undefined'&&heldSlug===hit.s) heldSlug=null; }catch(e){}
  o.done=true; o.doneAt=Date.now(); o.slugId=hit.s.id;
  G.coin=(G.coin||0)+o.reward;
  if(typeof syncHUD==='function') syncHUD();
  if(typeof syncOv==='function') try{ syncOv(); }catch(e){}
  if(typeof renderBreederUI==='function') try{ renderBreederUI(); }catch(e){}
  if(typeof saveGame==='function') saveGame();
  if(typeof toast==='function') toast('📦 ส่งออเดอร์ให้ '+o.buyer+' สำเร็จ · +'+o.reward.toLocaleString()+' เหรียญ','good');
  return true;
 }

 /* ---- การ์ดในกล่องจดหมาย (cat-seller.js เรียกผ่าน hook decorateInboxCard) ---- */
 function portrait(genes){
  var c=document.createElement('canvas'); c.width=260; c.height=190;
  c.style.cssText='width:150px;height:auto;background:radial-gradient(ellipse at 50% 45%,#2b4a4d,#132225);border:1px solid #4d6265;border-radius:10px';
  try{
   if(typeof drawSlugPortrait==='function')
    drawSlugPortrait(c,{id:'order-preview', genes:genes, foodBuffs:[], satiety:50, traits:{}});
  }catch(e){ console.warn('[order] วาดรูปตัวอย่างไม่ได้',e); }
  return c;
 }
 function buildCard(o){
  var box=document.createElement('div');
  box.style.cssText='margin-top:10px;padding:12px;border:1px solid #4a5f5e;border-radius:10px;background:#12242782';
  function paint(){
   box.innerHTML='';
   var head=document.createElement('div');
   head.style.cssText='display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start';
   var left=document.createElement('div');
   left.append(portrait(o.genes));
   var cap=document.createElement('div');
   cap.style.cssText='font-size:11px;opacity:.7;text-align:center;margin-top:4px;width:150px';
   cap.textContent='รูปตัวอย่าง (ฟิก 3 ยีน · ที่เหลือสุ่ม)';
   left.append(cap);
   var right=document.createElement('div'); right.style.cssText='flex:1;min-width:230px';
   var spec='<div style="font-size:13px;color:#f1cc75;font-weight:600;margin-bottom:6px">สเปกที่ต้องการ · ค่าตอบแทน '+o.reward.toLocaleString()+' เหรียญ · ไม่มีกำหนดส่ง</div><table style="font-size:12px;border-collapse:collapse;width:100%">';
   for(var i=0;i<o.keys.length;i++){ var k=o.keys[i];
    spec+='<tr><td style="padding:2px 8px 2px 0;opacity:.85">'+esc(label(k))+'</td><td style="padding:2px 0;color:#e7d6a8">'+esc(geneText(k,o.want[k]))+' <span style="opacity:.6">±'+tolOf(k)+'</span></td></tr>';
   }
   spec+='</table><div style="font-size:11px;opacity:.65;margin-top:6px">ยีนที่เหลือไม่มีผล · ใช้ยีนต้นของทาก (บัฟอาหารชั่วคราวไม่นับ)</div>';
   right.innerHTML=spec;
   head.append(left,right); box.append(head);

   if(o.done){
    var okBar=document.createElement('div');
    okBar.style.cssText='margin-top:10px;padding:8px 10px;border:1px solid #7fa86a;border-radius:8px;color:#cfe6b8;font-size:13px';
    okBar.textContent='✅ ส่งทาก '+(o.slugId||'')+' ให้ '+o.buyer+' เรียบร้อย · ได้รับ '+o.reward.toLocaleString()+' เหรียญแล้ว';
    box.append(okBar); return;
   }

   var list=candidates().map(function(c){ return {c:c, m:geneMatch(o,c.s)}; });
   list.sort(function(a,b){ return (b.m.ok-a.m.ok) || (a.m.rows.reduce(function(n,r){return n+r.off/r.tol;},0)-b.m.rows.reduce(function(n,r){return n+r.off/r.tol;},0)); });
   var okList=list.filter(function(x){return x.m.ok;});

   var title=document.createElement('div');
   title.style.cssText='margin:12px 0 6px;font-size:13px;color:#f1cc75;font-weight:600';
   title.textContent='เลือกทากที่จะส่ง · ตรงสเปก '+okList.length+' / '+list.length+' ตัว';
   box.append(title);

   if(!list.length){
    var none=document.createElement('div'); none.style.cssText='font-size:12px;opacity:.7';
    none.textContent='ยังไม่มีทากในร้านที่ส่งได้';
    box.append(none); return;
   }

   var grid=document.createElement('div');
   grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:8px;max-height:38vh;overflow:auto;padding:2px';
   var picked=null, submitBtn;
   list.forEach(function(x){
    var s=x.c.s, cell=document.createElement('button');
    cell.className='tbtn'; cell.type='button';
    cell.style.cssText='display:block;text-align:left;padding:7px;border:1px solid '+(x.m.ok?'#8fbf74':'#4c605f')+';border-radius:9px;background:#1b2f32;color:#e5dcc4;font-size:11px;cursor:pointer;opacity:'+(x.m.ok?'1':'.62');
    var pv=document.createElement('canvas'); pv.width=180; pv.height=132;
    pv.style.cssText='width:100%;height:auto;display:block';
    try{ if(typeof drawSlugPortrait==='function') drawSlugPortrait(pv,s); }catch(e){}
    cell.append(pv);
    var cap=document.createElement('div');
    cap.innerHTML='<b>'+esc(s.id)+'</b> '+(x.m.ok?'<span style="color:#a6d68a">ตรงสเปก ✓</span>':'')
      +'<br>'+x.m.rows.map(function(r){
        return '<span style="color:'+(r.ok?'#a6d68a':'#e0a37c')+'">'+esc(label(r.k))+' '+Math.round(r.mine)+'</span>';
      }).join('<br>');
    cell.append(cap);
    cell.onclick=function(ev){
     ev.preventDefault(); ev.stopPropagation();
     if(!x.m.ok){ if(typeof toast==='function') toast('ตัวนี้ยีนยังไม่ตรงสเปก','bad'); return; }
     picked=s.id;
     [].forEach.call(grid.children,function(el){ el.style.boxShadow=''; });
     cell.style.boxShadow='0 0 0 2px #f1cc75 inset';
     submitBtn.disabled=false;
     submitBtn.textContent='ส่งทาก '+s.id+' · รับ '+o.reward.toLocaleString()+' เหรียญ';
    };
    grid.append(cell);
   });
   box.append(grid);

   submitBtn=document.createElement('button');
   submitBtn.className='tbtn'; submitBtn.type='button'; submitBtn.disabled=true;
   submitBtn.style.cssText='margin-top:10px;display:block;width:100%;padding:10px;border-radius:9px';
   submitBtn.textContent='เลือกทากที่ตรงสเปกก่อน';
   submitBtn.onclick=function(ev){
    ev.preventDefault(); ev.stopPropagation();
    if(picked && submit(o.id,picked)) paint(); else paint();
   };
   box.append(submitBtn);
  }
  paint();
  return box;
 }

 /* hook ที่ cat-seller.js เรียกตอนสร้างการ์ดจดหมายแต่ละใบ */
 window.decorateInboxCard=function(card,m){
  if(!m || typeof m.id!=='string' || m.id.indexOf('order-')!==0) return;
  var o=findOrder(m.id); if(!o) return;
  card.append(buildCard(o));
 };

 /* ---- บูต ---- */
 if(!Array.isArray(G.orders)) G.orders=[];
 if(!Number.isFinite(G.orderSeq)) G.orderSeq=orders().reduce(function(n,o){
  var v=parseInt(String(o.id).slice(6),10); return Math.max(n, Number.isFinite(v)?v:0); },0);
 if(!Number.isFinite(G.nextOrderAt) || G.nextOrderAt<=0) scheduleNext(FIRST_MS);
 setInterval(tick, 5000);
 setTimeout(tick, 1200);

 window.OnlineOrders={ orders:orders, submit:submit, tick:tick, geneMatch:geneMatch, candidates:candidates,
                       forceOrder:function(){ var ok=sendOrder(); if(ok) scheduleNext(); return ok; },
                       REWARD:REWARD, TOL_PCT:TOL_PCT, tolOf:tolOf, GAP_MIN_MS:GAP_MIN_MS, GAP_MAX_MS:GAP_MAX_MS };
})();
