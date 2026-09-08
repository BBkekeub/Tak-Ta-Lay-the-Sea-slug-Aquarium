/* ============================================================
   slug-peddler.js — พ่อค้าเร่: คนถือตู้ทากใบเล็กเดินเข้ามา "ยื่นขาย" ทากให้ร้านเรา
   - สุ่มโผล่มาทุก 8–16 นาที (เวลาจริง) เมื่อร้านเปิด มีเคาน์เตอร์ และยังไม่มีข้อเสนอขายค้างอยู่
   - ยีนของทากสุ่มทั้งหมด · ราคาใช้ "สูตรเดียวกับตลาดโลก" แต่ยึดค่ากลาง (50 / สี 200) เป็นเกณฑ์
     ยิ่งยีนไกลจากกลาง (เข้าใกล้ 0 หรือ 100) ยิ่งแพง — ตรงกลางเป๊ะทุกยีน 132 เหรียญ · สุดขั้วทุกยีน 6,600
   - ข้อเสนอไปโผล่ในแผง "ข้อเสนอ" เดียวกับข้อเสนอซื้อ (TRADE_OFFERS) กดซื้อแล้วทากเข้าคลังทาก
   ใช้: WorldMarket (GENE_BASE/GENE_RANGE/MATCH_BANDS/multOf) · SlugEngine · makeSlug
        spawnVisitors/freeSpot/personRoute/counterFront/TRADE_OFFERS (people.js, trade.js)
   ============================================================ */
(function(){
 'use strict';

 /* ===== ค่าปรับได้ ===== */
 var GAP_MIN_MS = 8*60*1000;    // เว้นระยะพ่อค้าเร่ ต่ำสุด
 var GAP_MAX_MS = 16*60*1000;   // เว้นระยะพ่อค้าเร่ สูงสุด
 var FIRST_MS   = 90*1000;      // คนแรกของร้าน มาเร็วหน่อยให้เห็นว่ามีระบบนี้
 var PRICE_MULTIPLIER = 3;      // ราคาพ่อค้า = มูลค่ายีนเดิม × 3
 var OFFER_TTL  = 180;          // วินาทีที่ยืนรอคำตอบ (ข้อเสนอซื้อปกติ 90 — ขายให้เราต้องมีเวลาดูยีน)
 /* ===================== */

 var RANGE = { bodyDepth:100, gillDepth:100, mainC:400, accC:400, len:100, girth:100,
               gillLen:100, tentLen:100, vigor:100, gillN:100, spotN:100 };
 var BASE  = { bodyDepth:100, gillDepth:100, mainC:100, accC:100, len:100, girth:100,
               gillLen:100, tentLen:100, vigor:100, gillN:100, spotN:100 };
 var FALLBACK_LABEL = { bodyDepth:'ร่องสีตัว', gillDepth:'ร่องสีหงอน', mainC:'สีลำตัว', accC:'สีหงอนเหงือก',
   len:'ความยาวลำตัว', girth:'ขนาดตัวรวม', gillLen:'ความสูงหงอนเหงือก', tentLen:'ความยาวหนวด',
   vigor:'ความสมบูรณ์', gillN:'จำนวนหงอนเหงือก', spotN:'ลาย (รูปทรง+จำนวน)' };
 var KEYS = Object.keys(RANGE);

 function wm(){ return (typeof WorldMarket!=='undefined')?WorldMarket:null; }
 function rangeOf(k){ var M=wm(); return (M&&M.GENE_RANGE&&M.GENE_RANGE[k])||RANGE[k]||100; }
 function baseOf(k){ var M=wm(); return (M&&M.GENE_BASE&&Number.isFinite(M.GENE_BASE[k]))?M.GENE_BASE[k]:(BASE[k]||100); }
 /* ตัวคูณตาม % — ใช้ตาราง MATCH_BANDS ชุดเดียวกับตลาดโลก ไม่ตั้งตารางใหม่ */
 function multOf(pct){
  var M=wm(); if(M&&M.multOf) return M.multOf(pct);
  var bands=[[100,2],[98,1.8],[95,1.5],[92,1.2],[90,1],[88,.8],[85,.6],[80,.4],[75,.2],[70,.18],
             [65,.16],[60,.14],[55,.12],[50,.1],[0,.04]], p=Math.floor(pct);
  for(var i=0;i<bands.length;i++) if(p>=bands[i][0]) return bands[i][1];
  return .04;
 }
 function label(k){
  try{ var g=SlugEngine.GENES.find(function(x){return x.k===k;}); if(g&&g.th) return g.th; }catch(e){}
  return FALLBACK_LABEL[k]||k;
 }
 var esc=function(s){ return String(s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };

 /* ---------- ราคา: ยึด 50 (สี 200) เป็นกลาง ยิ่งไกลกลางยิ่งแพง ----------
    % ที่ป้อนเข้าตาราง = ระยะจากกลาง ÷ ครึ่งช่วง × 100
      กลางเป๊ะ = 0%  → ตัวคูณ 0.04  → 132 เหรียญเมื่อทุกยีนอยู่กลาง
      0 หรือ 100 = 100% → ตัวคูณ 2   → 6,600 เหรียญเมื่อทุกยีนสุดขั้ว          */
 function extremePct(k,v){
  var R=rangeOf(k), mid=R/2, d=Math.abs((+v||0)-mid)/(mid||1)*100;
  return Math.max(0,Math.min(100,d));
 }
 function geneCoin(k,v){ return Math.round(baseOf(k)*multOf(extremePct(k,v)))*PRICE_MULTIPLIER; }
 function peddlerValue(genes){
  var sum=0; for(var i=0;i<KEYS.length;i++) sum+=baseOf(KEYS[i])*multOf(extremePct(KEYS[i],genes[KEYS[i]]));
  return Math.max(1,Math.round(sum))*PRICE_MULTIPLIER;
 }
 function breakdown(genes){
  return KEYS.map(function(k){
   var pct=extremePct(k,genes[k]);
   return {k:k,label:label(k),mine:Math.round(+genes[k]||0),pct:pct,mul:multOf(pct),coin:geneCoin(k,genes[k]),range:rangeOf(k)};
  }).sort(function(a,b){ return b.coin-a.coin || b.pct-a.pct; });
 }

 /* ---------- สีตัวทากในตู้ที่พ่อค้าอุ้ม (ไล่สีจากตารางเดียวกับตัวเรนเดอร์ทาก) ---------- */
 function anchorHex(v,table,key){
  try{
   var T=table; if(!T||!T.length) return null;
   if(v<=T[0].g) return SlugEngine.hex(T[0][key]);
   if(v>=T[T.length-1].g) return SlugEngine.hex(T[T.length-1][key]);
   for(var i=0;i<T.length-1;i++) if(v>=T[i].g&&v<=T[i+1].g){
    var f=(v-T[i].g)/((T[i+1].g-T[i].g)||1), a=T[i][key], b=T[i+1][key];
    return SlugEngine.hex(a.map(function(c,j){ return c+(b[j]-c)*f; }));
   }
  }catch(e){}
  return null;
 }
 function slugBodyHex(genes){
  try{ return anchorHex(+genes.mainC||0, SlugEngine.BODY_ANCH, 'M') || '#d8b0d0'; }catch(e){ return '#d8b0d0'; }
 }

 /* ---------- สร้างพ่อค้าเร่ ---------- */
 function makePeddler(p){
  if(!p) return false;
  var genes=(typeof SlugEngine!=='undefined'&&SlugEngine.randGene)?SlugEngine.randGene():null;
  if(!genes||typeof makeSlug!=='function') return false;
  var slug=makeSlug(genes);
  p.wantsSell=true; p.wantsBuy=false; p.sellSlug=slug; p.sellPrice=peddlerValue(genes);
  p.carryTank=true; p.carryColor='#2f6f78'; p.carryAccent=slugBodyHex(genes);
  p.visits=1; p.strolls=0;                 // มาเพื่อยื่นขาย ไม่ได้มาเดินดูของ
  p.bagged=false; p.accessory='none';      // มือถือตู้อยู่ ไม่สะพายอะไรเพิ่ม
  return true;
 }

 /* ---------- เดินไปยื่นข้อเสนอที่เคาน์เตอร์ (คู่ขนานกับ tryCustomerOffer ใน trade.js) ---------- */
 function trySellerOffer(p){
  if(!p||!p.wantsSell||p.tradeDone||p.tradeOffer||!p.sellSlug) return false;
  if(typeof TRADE_OFFERS==='undefined'||typeof counterFront!=='function') return false;
  if(TRADE_OFFERS.some(function(o){return o.sell;})) return false;
  var counters=(G.objs||[]).filter(function(c){return c._key==='counter'&&c!==moving;});
  for(var i=0;i<counters.length;i++){
   var counter=counters[i];
   if(TRADE_OFFERS.some(function(o){return o.counter===counter;})) continue;
   var target=freeSpot([counterFront(counter)],p); if(!target) continue;
   var route=personRoute(p,target); if(!route.length) continue;
   var offer={id:++tradeSeq, p:p, counter:counter, sell:true, slug:p.sellSlug, price:p.sellPrice,
              tank:null, matched:[], timeout:OFFER_TTL, arrived:false, age:0,
              cx:counter.cx, cy:counter.cy, rot:counter.rot};
   TRADE_OFFERS.push(offer); p.tradeOffer=offer; p.tradeDone=true;
   p.focus=null; p.tgt=target; p.route=route; p.routeGoal=target; p.state='walk'; p.stuck=0; p.t=0;
   if(typeof renderTradeOffers==='function') renderTradeOffers();
   return true;
  }
  return false;
 }

 /* ---------- ตัวจับเวลา: people.js เรียกทุกเฟรมจาก stepVisitorArrivals ---------- */
 function gap(){ return GAP_MIN_MS+Math.random()*(GAP_MAX_MS-GAP_MIN_MS); }
 function stepPeddlerArrival(capacity){
  if(!Number.isFinite(G.nextPeddlerAt)||G.nextPeddlerAt<=0){ G.nextPeddlerAt=Date.now()+FIRST_MS; return false; }
  if(Date.now()<G.nextPeddlerAt) return false;
  if(!capacity||PEOPLE.length>=capacity) return false;
  if(typeof TRADE_OFFERS==='undefined') return false;
  if(!(G.objs||[]).some(function(o){return o._key==='counter'&&o!==moving;})) return false;   // ไม่มีเคาน์เตอร์ = ไม่มีที่ยื่นขาย
  if(TRADE_OFFERS.some(function(o){return o.sell;})) return false;
  if(PEOPLE.some(function(p){return p.wantsSell;})) return false;
  if(spawnVisitors(capacity-PEOPLE.length,'peddler',[{kid:false,gender:Math.random()<.5?'female':'male'}])){
   G.nextPeddlerAt=Date.now()+gap();
   if(typeof saveGame==='function') saveGame();
   return true;
  }
  return false;                                  // ประตูตัน ลองใหม่เฟรมหน้า
 }

 /* ---------- การ์ดข้อเสนอ (trade.js เรียกเมื่อ o.sell) ---------- */
 function sellOfferCard(o){
  var names={mainC:'สีตัว',accC:'สีหงอน',bodyDepth:'ร่องสีตัว',gillDepth:'ร่องสีหงอน',len:'ความยาว',girth:'ขนาดตัว',gillLen:'ความสูงหงอน',tentLen:'ความยาวหนวด',vigor:'ความสมบูรณ์',gillN:'จำนวนหงอน',spotN:'ลาย'};
  var list=KEYS.map(function(k){
   return '<div style="display:flex;justify-content:space-between;align-items:center;gap:4px;padding:6px 0;border-bottom:1px solid #ffffff12"><span style="color:#b9ceca">'
    +names[k]+'</span><b style="color:#f2eee3;white-space:nowrap">'+Math.round(+o.slug.genes[k]||0)
    +(rangeOf(k)>100?'<span style="font-size:10px;font-weight:400;color:#9fb8b3">/400</span>':'')+'</b></div>';
  }).join('');
  var remaining=Math.max(0,Math.ceil((o.timeout||OFFER_TTL)-(o.age||0)));
  return '<div class="trade-offer-card">'
   +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
   +'<canvas data-trade-slug="'+o.id+'" width="120" height="80" style="width:100px;height:66px;flex-shrink:0;background:radial-gradient(ellipse at center,#385e5b,#172e32);border:1px solid #ffffff20;border-radius:10px"></canvas>'
   +'<div style="min-width:0"><small style="color:#b9ceca">ทากจากพ่อค้า</small><div style="font-size:17px;font-weight:700;overflow-wrap:anywhere">'+esc(o.slug.id)+'</div>'
   +'<small style="color:#b9ceca">'+(o.arrived?'รอคำตอบ · '+remaining+' วิ':'กำลังเดินมา')+'</small></div></div>'
   +'<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:14px;font-size:12px;line-height:1.45;margin-bottom:14px">'+list+'</div>'
   +'<div style="display:flex;align-items:baseline;gap:5px;margin-bottom:10px"><b style="font-size:26px;line-height:1.2;color:#ffda80">'+o.price.toLocaleString()+'</b><span style="font-size:12px;color:#dfd3b6">เหรียญ</span></div>'
   +'<div class="trade-actions" style="display:flex;gap:8px"><button class="tbtn trade-accept" style="flex:1" '+(o.arrived?'':'disabled')
   +' onclick="finishTrade('+o.id+',true)">ซื้อทาก</button>'
   +'<button class="tbtn" onclick="finishTrade('+o.id+')">ปฏิเสธ</button></div></div>';
 }

 /* ---------- ซื้อจริง (trade.js เรียกจาก finishTrade) ---------- */
 function buyFromPeddler(o){
  if((G.coin||0)<o.price){ if(typeof toast==='function') toast('เหรียญไม่พอ ต้องมี '+o.price.toLocaleString()+' เหรียญ','bad'); return false; }
  G.coin-=o.price;
  (G.inv||(G.inv=[])).push(o.slug);
  /* ส่งตู้ให้เราแล้ว มือก็ต้องว่าง — ไม่งั้นเดินออกจากร้านโดยยังอุ้มทากที่ขายไปแล้ว */
  if(o.p){ o.p.carryTank=false; o.p.sellSlug=null; o.p.carryAccent=null; }
  if(typeof toast==='function') toast('ซื้อทาก '+o.slug.id+' −'+o.price.toLocaleString()+' เหรียญ · เก็บเข้าคลังทากแล้ว','good');
  if(typeof syncOv==='function'){ try{ syncOv(); }catch(e){} }
  return true;
 }

 window.makePeddler=makePeddler;
 window.trySellerOffer=trySellerOffer;
 window.stepPeddlerArrival=stepPeddlerArrival;
 window.sellOfferCard=sellOfferCard;
 window.buyFromPeddler=buyFromPeddler;
 window.SlugPeddler={ value:peddlerValue, breakdown:breakdown, extremePct:extremePct, geneCoin:geneCoin,
                      GAP_MIN_MS:GAP_MIN_MS, GAP_MAX_MS:GAP_MAX_MS, OFFER_TTL:OFFER_TTL,
                      force:function(){ G.nextPeddlerAt=1; return true; } };
})();
