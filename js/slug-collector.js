/* ============================================================
   slug-collector.js — "ลูกค้าใส่หมวก" (นักสะสม) ผู้เล่นออกแบบ 2026-09-22
   ปัญหาที่แก้: ช่วงแรกเงินฝืด เพราะลูกค้าทั่วไปสุ่มเงื่อนไข "กว้าง" ราคาจึงถูก
     (จำลอง 4,000 ครั้ง: ได้เฉลี่ย ~110 เหรียญต่อคนที่ขอซื้อ และ 36% ให้ราคา 0)
   ผู้เล่นไม่เอาวิธีแจกเงิน/ลดราคา — ขอเป็น "ลูกค้าที่พยายามซื้อ" แทน:
     เดินดูตู้ที่มีทากทีละตู้ → มองหาว่าทากตัวไหน "มีค่ายีนสูงที่สุด"
     → เสนอซื้อด้วยเงื่อนไขแคบ ๆ ที่ล็อกกับค่าสูงตัวนั้น = ราคาดีกว่าลูกค้าทั่วไปมาก
     → ยิ่งเพาะทากยีนสุดขั้วได้ ยิ่งได้ราคา (ตอบแทนฝีมือ ไม่ใช่แจกฟรี)
   มานาน ๆ ครั้ง (GAP_MIN–GAP_MAX) และมาได้ทีละคน

   ราคามาจากสูตรเดิมของเกม: tradeConditionPrice(lo,hi) = max(100, 1000/(1+ช่วงกว้าง/5))
   เงื่อนไขยิ่งแคบยิ่งแพง → นักสะสมจึงใช้ "ความสูงของยีน" กำหนดว่าจะยอมล็อกแคบแค่ไหน
   ============================================================ */
(function(){
 'use strict';

 /* ===== ค่าปรับได้ ===== */
 var GAP_MIN_MS = 20*60*1000;   // เว้นระยะนักสะสม ต่ำสุด (เวลาจริง)
 var GAP_MAX_MS = 40*60*1000;   // เว้นระยะนักสะสม สูงสุด
 var FIRST_MS   = 6*60*1000;    // คนแรกของร้าน มาเร็วหน่อยให้รู้ว่ามีระบบนี้
 var LOOK_TANKS = 3;            // ดูกี่ตู้ก่อนตัดสินใจ (หรือทุกตู้ที่มีทาก ถ้ามีน้อยกว่านี้)
 /* ยีนที่ "ตีราคาได้" ต้องเป็นชุดเดียวกับที่ลูกค้าทั่วไปขอ (trade.js TRADE_GENES)
    ไม่งั้นจะเสนอเงื่อนไขที่ระบบราคาไม่รู้จัก */
 var KEYS = ['bodyDepth','gillDepth','girth','len','gillLen','tentLen','vigor'];
 /* ค่ายีนสูงแค่ไหน → ยอมล็อกเงื่อนไขแคบแค่ไหน (ช่วงแคบ = ราคาสูง)
    90+ = ล็อกเป๊ะ 1,000 เหรียญ · 80+ = 500 · 70+ = 333 · 60+ = 200 · ต่ำกว่านั้น 125 */
 var BANDS = [[90,0],[80,5],[70,10],[60,20],[0,35]];
 var SECOND_MIN = 70;           // ยีนรองต้องสูงเท่านี้ขึ้นไปถึงจะขอซื้อเป็นเงื่อนไขที่สอง
 /* ===================== */

 function bandFor(v){ for(var i=0;i<BANDS.length;i++) if(v>=BANDS[i][0]) return BANDS[i][1]; return 35; }
 function tanksWithSlugs(){
  return (G.objs||[]).filter(function(o){ return o.type==='tank'&&(o.slugs||[]).some(function(s){return !s.favorite;}); });
 }
 /* จัดอันดับยีนของทากหนึ่งตัว: ค่าสูงสุดก่อน (นับเฉพาะยีนที่ตีราคาได้) */
 function rank(slug){
  return KEYS.map(function(k){ return {k:k,v:Math.round(+slug.genes[k]||0)}; })
             .sort(function(a,b){ return b.v-a.v; });
 }
 /* จำ "ตัวที่ดีที่สุดเท่าที่เดินดูมา" ไว้กับตัวนักสะสมเอง */
 function noteBest(p,tank){
  for(var i=0;i<(tank.slugs||[]).length;i++){
   var s=tank.slugs[i];
   if(s.favorite)continue;                                   // ♥ ถูกใจไว้ = ไม่ขอซื้อ (กฎเดียวกับลูกค้าทั่วไป)
   if(typeof TRADE_OFFERS!=='undefined'&&TRADE_OFFERS.some(function(o){return o.slug===s;}))continue;
   var top=rank(s)[0];
   if(!p._bestSeen||top.v>p._bestSeen.v)p._bestSeen={slug:s,tank:tank,k:top.k,v:top.v};
  }
 }
 /* สร้างเงื่อนไขซื้อจากทากที่เลือกไว้ — ล็อกรอบค่าจริงของมัน ความกว้างตามตาราง BANDS */
 function preferencesFor(slug){
  var list=rank(slug),out=[];
  function cond(entry){
   var w=bandFor(entry.v), lo=Math.max(0,Math.min(100-w,entry.v-Math.round(w/2)));
   return {key:entry.k,lo:lo,hi:lo+w};
  }
  out.push(cond(list[0]));
  if(list[1]&&list[1].v>=SECOND_MIN)out.push(cond(list[1]));   // ตัวที่เด่นสองยีนได้ราคาสองก้อน
  return out;
 }

 /* ---------- สร้างคน ---------- */
 function makeCollector(p){
  if(!p) return false;
  p.collector=true; p.wantsBuy=true; p.wantsSell=false; p.tradeDone=false;
  p.accessory='hat';                                   // หมวกนักสะสม (people.js วาดให้)
  p.visits=Math.max(LOOK_TANKS,1); p.strolls=0;        // ตั้งใจมาดูของ ไม่ได้มาเดินเล่น
  p._bestSeen=null; p._tanksSeen=0;
  return true;
 }

 /* ---------- ตัดสินใจตอนดูตู้จบ (trade.js เรียกแทน tryCustomerOffer เมื่อ p.collector) ---------- */
 function tryCollectorOffer(p,tank){
  if(!p||!p.collector||p.tradeDone||p.tradeOffer||!tank||tank.type!=='tank')return false;
  noteBest(p,tank);
  p._tanksSeen=(p._tanksSeen||0)+1;
  var need=Math.min(LOOK_TANKS,Math.max(1,tanksWithSlugs().length));
  if(p._tanksSeen<need)return false;                   // ยังดูไม่ครบ เดินไปดูตู้ต่อไปก่อน
  var best=p._bestSeen;
  if(!best||!G.objs.includes(best.tank)||!(best.tank.slugs||[]).includes(best.slug))return false;
  p.preferences=preferencesFor(best.slug);
  var bid=priceSlugOffer(best.slug,p.preferences);
  if(!bid.price)return false;
  for(var i=0;i<countersFor('cust').length;i++){
   var counter=countersFor('cust')[i];
   if(counterOfferCount(counter,true)>=COUNTER_QUEUE-1||counterOfferCount(counter)>=COUNTER_QUEUE)continue;
   var target=freeSpot(counterQueueSpots(counter),p); if(!target)continue;
   var route=personRoute(p,target); if(!route.length)continue;
   var offer={id:++tradeSeq,p:p,tank:best.tank,counter:counter,slug:best.slug,matched:bid.matched,price:bid.price,
              collector:true,arrived:false,age:0,cx:counter.cx,cy:counter.cy,rot:counter.rot};
   TRADE_OFFERS.push(offer); p.tradeOffer=offer; p.tradeDone=true;
   p.focus=null; p.tgt=target; p.route=route; p.routeGoal=target; p.state='walk'; p.stuck=0; p.t=0;
   if(typeof renderTradeOffers==='function')renderTradeOffers();
   if(typeof toast==='function')toast('🎩 นักสะสมสนใจทากตัวหนึ่งในร้าน — ดูข้อเสนอที่แผง "ข้อเสนอ"','good');
   return true;
  }
  return false;
 }

 /* ---------- ตัวจับเวลา (people.js เรียกจาก stepVisitorArrivals) ---------- */
 function gap(){ return GAP_MIN_MS+Math.random()*(GAP_MAX_MS-GAP_MIN_MS); }
 function stepCollectorArrival(capacity){
  if(!Number.isFinite(G.nextCollectorAt)||G.nextCollectorAt<=0){ G.nextCollectorAt=Date.now()+FIRST_MS; return false; }
  if(Date.now()<G.nextCollectorAt) return false;
  if(typeof traderRoom==='function'&&traderRoom()<1) return false;     // ใช้โควตา "แขกพิเศษ" ร่วมกับพ่อค้า ไม่กินที่ลูกค้า
  if(!tanksWithSlugs().length) return false;                            // ไม่มีทากให้ดู ก็ไม่ต้องมา
  if(typeof countersFor!=='function'||!countersFor('cust').length) return false;
  if(PEOPLE.some(function(p){return p.collector;})) return false;       // มาทีละคน
  if(spawnVisitors(Math.max(1,capacity),'collector',[{kid:false,gender:Math.random()<.5?'female':'male'}])){
   G.nextCollectorAt=Date.now()+gap();
   if(typeof saveGame==='function') saveGame();
   return true;
  }
  return false;                                                         // ประตูตัน ลองใหม่เฟรมหน้า
 }

 window.makeCollector=makeCollector;
 window.tryCollectorOffer=tryCollectorOffer;
 window.stepCollectorArrival=stepCollectorArrival;
 window.SlugCollector={ GAP_MIN_MS:GAP_MIN_MS, GAP_MAX_MS:GAP_MAX_MS, LOOK_TANKS:LOOK_TANKS, BANDS:BANDS,
                        preferencesFor:preferencesFor, rank:rank,
                        force:function(){ G.nextCollectorAt=1; return true; } };
})();
