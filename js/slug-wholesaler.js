/* ============================================================
   slug-wholesaler.js — พ่อค้ารับเหมา: มาซื้อทากจากคลังทากทีเดียวหลายตัวในราคาคงที่
   - โผล่มาทุก WHOLESALE_GAP_MS (เวลาจริง) ตายตัว เมื่อร้านเปิด มีเคาน์เตอร์ และยังไม่มีข้อเสนอรับเหมาค้างอยู่
   - รับซื้อทากจาก "คลังทาก" (G.inv) เท่านั้น ราคาคงที่ตัวละ WHOLESALE_PRICE เหรียญ ไม่ดูยีน
   - เลือกได้สูงสุด WHOLESALE_MAX ตัวต่อครั้ง ผ่านการ์ดในแผง "ข้อเสนอ" เดียวกับพ่อค้าเร่/ลูกค้าซื้อ
   - ใช้โมเดล "คนถือตู้ทาก" (carryTank) แบบเดียวกับพ่อค้าเร่ (slug-peddler.js) แต่ไม่ตั้ง carryAccent
     จึงไม่มีทากโผล่ในตู้ที่ถืออยู่ (ดู patch ใน people.js: วาด rings เฉพาะตอนมี carryAccent)
   ใช้: TRADE_OFFERS/tradeSeq/counterFront/totalShopSlugs (trade.js), freeSpot/personRoute/spawnVisitors (people.js),
        slugTransferLocked (slug-transfer.js), drawSlugPortrait (slug-transfer.js), SlugBrowser.htmlName (slug-browser.js)
   โหลดหลังไฟล์เหล่านั้นเสมอ (วางท้าย ๆ index.html ถัดจาก slug-peddler.js)
   ============================================================ */
(function(){
 'use strict';

 /* ===== ค่าปรับได้ ===== */
 var WHOLESALE_GAP_MS   = 10*60*1000;  // ทุก 10 นาทีตายตัว (ไม่สุ่มช่วงเหมือนพ่อค้าเร่)
 var WHOLESALE_FIRST_MS = 2*60*1000;   // คนแรกของร้าน มาเร็วหน่อยให้เห็นว่ามีระบบนี้
 var WHOLESALE_PRICE    = 80;          // ราคาคงที่ต่อตัว ไม่ดูยีน
 var WHOLESALE_MAX      = 10;          // ซื้อได้สูงสุดต่อครั้ง
 var WHOLESALE_TTL      = 120;         // วินาทีที่ยืนรอคำตอบ (ให้เวลาเลือกทากหลายตัว)
 var WHOLESALE_CARRY_COLOR = '#5a4a2f'; // สีกล่องที่ถือ (แยกจากตู้น้ำสีเขียวของพ่อค้าเร่)
 /* ===================== */

 /* ---------- สร้างพ่อค้ารับเหมา ---------- */
 function makeWholesaler(p){
  if(!p) return false;
  p.wantsSell=true; p.wantsBuy=false; p.wholesaleBuyer=true;
  p.carryTank=true; p.carryColor=WHOLESALE_CARRY_COLOR; p.carryAccent=null;  // กล่องเปล่า ไม่มีทากให้เห็น
  p.visits=1; p.strolls=0; p.bagged=false; p.accessory='none';
  return true;
 }

 /* ---------- เดินไปยื่นข้อเสนอที่เคาน์เตอร์ (คู่ขนานกับ trySellerOffer ใน slug-peddler.js) ---------- */
 function tryWholesalerOffer(p){
  if(!p||!p.wholesaleBuyer||p.tradeDone||p.tradeOffer) return false;
  if(typeof TRADE_OFFERS==='undefined'||typeof counterFront!=='function') return false;
  if(TRADE_OFFERS.some(function(o){return o.wholesale;})) return false;
  var counters=(G.objs||[]).filter(function(c){return c._key==='counter'&&c!==moving;});
  for(var i=0;i<counters.length;i++){
   var counter=counters[i];
   if(TRADE_OFFERS.some(function(o){return o.counter===counter;})) continue;
   var target=freeSpot([counterFront(counter)],p); if(!target) continue;
   var route=personRoute(p,target); if(!route.length) continue;
   var offer={id:++tradeSeq, p:p, counter:counter, wholesale:true, price:WHOLESALE_PRICE, max:WHOLESALE_MAX,
              picks:[], matched:[], slug:null, tank:null, timeout:WHOLESALE_TTL, arrived:false, age:0,
              cx:counter.cx, cy:counter.cy, rot:counter.rot};
   TRADE_OFFERS.push(offer); p.tradeOffer=offer; p.tradeDone=true;
   p.focus=null; p.tgt=target; p.route=route; p.routeGoal=target; p.state='walk'; p.stuck=0; p.t=0;
   if(typeof renderTradeOffers==='function') renderTradeOffers();
   return true;
  }
  return false;
 }

 /* ---------- ตัวจับเวลา: เรียกจาก stepPeddlerArrival ที่ห่อไว้ด้านล่าง ---------- */
 function stepWholesalerArrival(capacity){
  if(!Number.isFinite(G.nextWholesalerAt)||G.nextWholesalerAt<=0){ G.nextWholesalerAt=Date.now()+WHOLESALE_FIRST_MS; return false; }
  if(Date.now()<G.nextWholesalerAt) return false;
  if(!capacity||PEOPLE.length>=capacity) return false;
  if(typeof TRADE_OFFERS==='undefined') return false;
  if(!(G.objs||[]).some(function(o){return o._key==='counter'&&o!==moving;})) return false;   // ไม่มีเคาน์เตอร์ = ไม่มีที่ยื่นซื้อ
  if(TRADE_OFFERS.some(function(o){return o.wholesale;})) return false;
  if(PEOPLE.some(function(p){return p.wantsSell;})) return false;   // เว้นคิวให้พ่อค้าเร่/รับเหมาไม่ชนกัน
  if(spawnVisitors(capacity-PEOPLE.length,'solo',[{kid:false,gender:Math.random()<.5?'female':'male'}])){
   var p=PEOPLE[PEOPLE.length-1];
   makeWholesaler(p);
   G.nextWholesalerAt=Date.now()+WHOLESALE_GAP_MS;   // นับ "ทุก 10 นาที" จากรอบที่มา ไม่ใช่รอบที่คุยจบ
   if(typeof saveGame==='function') saveGame();
   return true;
  }
  return false;                                  // ประตูตัน ลองใหม่เฟรมหน้า
 }

 /* ---------- หาทากในคลัง + ตัดขาย ---------- */
 function eligibleInventory(o){
  return (G.inv||[]).filter(function(s){return !TRADE_OFFERS.some(function(t){return t!==o&&t.slug===s;});});
 }
 function sellToWholesaler(o){
  var seen={}, ids=[];
  (o.picks||[]).forEach(function(id){ if(!seen[id]){ seen[id]=true; ids.push(id); } });
  ids=ids.slice(0,o.max||WHOLESALE_MAX);
  var avail=eligibleInventory(o), picks=[];
  for(var i=0;i<ids.length;i++){
   var s=avail.find(function(s){return s.id===ids[i];});
   if(!s||typeof slugTransferLocked==='function'&&slugTransferLocked(s,null)) continue;
   picks.push(s);
  }
  if(!picks.length){ if(typeof toast==='function') toast('เลือกทากที่จะขายก่อน','bad'); return false; }
  if(typeof totalShopSlugs==='function'&&totalShopSlugs()-picks.length<2){
   if(typeof toast==='function') toast('ต้องเหลือทากในร้านอย่างน้อย 2 ตัว จึงยังขายไม่ได้','bad'); return false;
  }
  var total=0;
  for(var i=0;i<picks.length;i++){
   var s=picks[i], idx=G.inv.indexOf(s); if(idx<0) continue;
   G.inv.splice(idx,1); total+=o.price;
   if(typeof selSlug!=='undefined'&&selSlug===s) selSlug=null;
   if(typeof heldSlug!=='undefined'&&heldSlug===s) heldSlug=null;
  }
  G.coin+=total;
  if(G.stats) G.stats.sold=(G.stats.sold||0)+picks.length;
  if(typeof toast==='function') toast('ขายส่ง '+picks.length+' ตัว +'+total.toLocaleString()+' เหรียญ','good');
  return true;
 }

 /* ---------- การ์ดข้อเสนอ (trade.js เรียกเมื่อ o.wholesale) ---------- */
 var esc=function(s){ return String(s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
 function wholesaleOfferCard(o){
  var avail=eligibleInventory(o);
  o.picks=(o.picks||[]).filter(function(id){return avail.some(function(s){return s.id===id;});});
  var count=o.picks.length, remaining=Math.max(0,Math.ceil((o.timeout||WHOLESALE_TTL)-(o.age||0)));
  var rows=avail.map(function(s){
   var checked=o.picks.indexOf(s.id)>=0, full=!checked&&count>=(o.max||WHOLESALE_MAX);
   return '<label class="wholesale-slug'+(checked?' picked':'')+'">'
    +'<input type="checkbox" data-wholesale-pick="'+o.id+'" value="'+esc(s.id)+'" '+(checked?'checked':'')+(full?' disabled':'')+'>'
    +'<canvas data-wholesale-slug="'+esc(s.id)+'" width="120" height="80"></canvas>'
    +'<span>'+SlugBrowser.htmlName(s)+'</span></label>';
  }).join('');
  return '<div class="trade-offer-card">'
   +'<div class="trade-offer-heading"><b>รับเหมาซื้อทาก</b><span class="trade-status">'+(o.arrived?'รอคำตอบ · '+remaining+' วิ':'กำลังเดินมา')+'</span></div>'
   +'<p style="font-size:12px;margin:0 0 8px">รับซื้อจากคลังทาก ตัวละ <b>'+o.price+'</b> เหรียญ ไม่ดูยีน · เลือกได้สูงสุด '+(o.max||WHOLESALE_MAX)+' ตัว/ครั้ง</p>'
   +(avail.length
     ? '<div class="wholesale-actions"><button type="button" class="tbtn" onclick="wholesalePickAll('+o.id+')">เลือกสูงสุด</button><button type="button" class="tbtn" onclick="wholesalePickNone('+o.id+')">ล้างที่เลือก</button></div>'
      +'<div class="wholesale-grid">'+rows+'</div>'
     : '<p style="font-size:12px">คลังทากว่างเปล่า ไม่มีทากให้เลือกขาย</p>')
   +'<div class="trade-actions"><button class="tbtn trade-accept" '+(o.arrived&&count?'':'disabled')+' onclick="finishTrade('+o.id+',true)">ขาย '+count+' ตัว · '+(count*o.price).toLocaleString()+' เหรียญ</button> <button class="tbtn" onclick="finishTrade('+o.id+')">ปฏิเสธ</button></div></div>';
 }
 function wholesalePickAll(id){
  var o=TRADE_OFFERS.find(function(o){return o.id===id;}); if(!o||!o.wholesale) return;
  o.picks=eligibleInventory(o).slice(0,o.max||WHOLESALE_MAX).map(function(s){return s.id;});
  renderTradeOffers(true);
 }
 function wholesalePickNone(id){
  var o=TRADE_OFFERS.find(function(o){return o.id===id;}); if(!o||!o.wholesale) return;
  o.picks=[]; renderTradeOffers(true);
 }

 /* ---------- ทาสีพอร์เทรตในการ์ด + ผูกช่องติ๊กเลือก (ห่อ renderTradeOffers แทนแก้ trade.js ทั้งก้อน) ---------- */
 function paintWholesaleCanvases(){
  document.querySelectorAll('canvas[data-wholesale-slug]').forEach(function(c){
   var s=(G.inv||[]).find(function(s){return s.id===c.dataset.wholesaleSlug;});
   if(s&&typeof drawSlugPortrait==='function') drawSlugPortrait(c,s);
  });
 }
 document.addEventListener('DOMContentLoaded',bindTradeOffersList);
 if(document.readyState!=='loading') bindTradeOffersList();
 function bindTradeOffersList(){
  var el=document.getElementById('tradeOffers'); if(!el||el._wholesaleBound) return; el._wholesaleBound=true;
  el.addEventListener('change',function(e){
   var input=e.target.closest('[data-wholesale-pick]'); if(!input) return;
   var o=TRADE_OFFERS.find(function(o){return o.id===Number(input.dataset.wholesalePick);}); if(!o||!o.wholesale) return;
   o.picks=o.picks||[];
   var idx=o.picks.indexOf(input.value);
   if(input.checked){ if(idx<0){ if(o.picks.length<(o.max||WHOLESALE_MAX)) o.picks.push(input.value); else input.checked=false; } }
   else if(idx>=0) o.picks.splice(idx,1);
   renderTradeOffers(true);
  });
 }

 var css=document.createElement('style'); css.textContent=
  '.wholesale-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(94px,1fr));gap:6px;max-height:260px;overflow:auto;margin:2px 0 10px;padding:2px}'
  +'.wholesale-slug{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;border:1px solid #52685f;border-radius:8px;background:#16302fb0;font-size:11px;text-align:center;overflow-wrap:anywhere;cursor:pointer}'
  +'.wholesale-slug.picked{border-color:#f1cc75;background:#3a3a2a}'
  +'.wholesale-slug input{position:absolute;top:4px;left:4px;margin:0}'
  +'.wholesale-slug canvas{width:100%;height:52px;object-fit:contain;pointer-events:none}'
  +'.wholesale-actions{display:flex;gap:6px;margin:0 0 8px;flex-wrap:wrap}.wholesale-actions .tbtn{font-size:11px;padding:6px 10px}';
 document.head.append(css);

 /* ---------- ห่อฟังก์ชันของ slug-peddler.js แทนแก้ people.js/trade.js เพิ่ม ----------
    nextGoal() ใน people.js เรียก trySellerOffer(p) ตอน p.wantsSell เป็นจริงอยู่แล้ว
    และ stepVisitorArrivals() เรียก stepPeddlerArrival(capacity) เป็นคิวแยกจากลูกค้าปกติอยู่แล้ว
    ห่อสองจุดนี้พอ ไม่ต้องแตะไฟล์คนอื่น */
 var _origTrySellerOffer=window.trySellerOffer;
 window.trySellerOffer=function(p){
  if(p&&p.wholesaleBuyer) return tryWholesalerOffer(p);
  return typeof _origTrySellerOffer==='function'?_origTrySellerOffer(p):false;
 };
 var _origStepPeddlerArrival=window.stepPeddlerArrival;
 window.stepPeddlerArrival=function(capacity){
  if(stepWholesalerArrival(capacity)) return true;
  return typeof _origStepPeddlerArrival==='function'?_origStepPeddlerArrival(capacity):false;
 };
 /* renderTradeOffers() วาดพอร์เทรตให้เฉพาะ canvas[data-trade-slug] (ของ offer ปกติ/พ่อค้าเร่)
    ห่อเพิ่มอีกชั้นเพื่อวาด canvas[data-wholesale-slug] ของการ์ดนี้ด้วย โดยไม่แก้ trade.js */
 var _origRenderTradeOffers=window.renderTradeOffers;
 window.renderTradeOffers=function(force){
  if(typeof _origRenderTradeOffers==='function') _origRenderTradeOffers(force);
  paintWholesaleCanvases();
 };

 window.sellToWholesaler=sellToWholesaler;
 window.wholesaleOfferCard=wholesaleOfferCard;
 window.wholesalePickAll=wholesalePickAll;
 window.wholesalePickNone=wholesalePickNone;
 window.WholesaleBuyer={ price:WHOLESALE_PRICE, max:WHOLESALE_MAX, gapMs:WHOLESALE_GAP_MS,
                          force:function(){ G.nextWholesalerAt=1; return true; } };
})();
