/* quests.js — ระบบเควสสอนเล่น (ทิวทอเรียลแบบไม่บอกทุกอย่าง) + สกุลเงินชื่อเสียง (rep)
   - โพลสถานะเกมทุกวินาที เช็กเงื่อนไขเควสปัจจุบัน แล้วให้รางวัล/ไปเควสถัดไป
   - จับ "การกระทำ" ด้วยตัวนับใน G.stats (fed/cleaned/bred/ordered/sold …) — sold นับใน trade.js
     ที่เหลือ monkey-patch ฟังก์ชันเดิม หรือ observe dialog เปิด (ไม่แก้ไฟล์เกมหลัก)
   - รางวัล: เหรียญ + ชื่อเสียง(rep) · unlock/ความดึงดูด เป็น flavor ในข้อความ

   34 เควส 5 องก์ (ลำดับที่เล่นจริงอยู่ที่ const QUESTS ไม่ใช่ลำดับใน ORIGINAL_QUESTS):
     องก์ 1 (1–5)   รู้จักทากของตัวเอง — ให้อาหาร ขัดตู้ ตกแต่งในตู้ ดูยีน ย้ายทาก (ร้านยังปิด)
     องก์ 2 (6–10)  เตรียมหน้าร้าน — แต่งร้าน ความดึงดูด ประตู เคาน์เตอร์ แล้วค่อยเปิดร้าน
     องก์ 3 (11–19) เพาะพันธุ์แล้วขาย — ตู้เพาะ ผสม ฟักไข่ ขาย คอมประจำร้าน กล่องทาก พ่อค้าเร่
     องก์ 4 (20–27) ขยายกิจการ — ตู้เพิ่ม ขยายพื้นที่ สีพื้น ชั้นวาง ตลาดโลก ออเดอร์ออนไลน์ โต๊ะเล่น
     องก์ 5 (28–34) สนามแข่ง — ตู้วิ่ง/ชักเย่อ/กินจุ/ปาหิน + โหมดซ้อม + ทัวร์นาเมนต์ 8 ทีม
   งบรางวัลรวมทั้งเกม: 5,000 เหรียญ · กล่องสุ่มระดับปกติ 6 · ระดับกลาง 2 · ระดับแพง 1
     เส้นโค้งตั้งใจให้หลังหนัก — 5 เควสแรกรวมกันแค่ 350 เหรียญ ("ยังไม่ทันทำไรก็แจกแล้ว")
     แล้วค่อยขยับเป็นเควสละ 150–250 ตั้งแต่องก์ 3 ที่ผู้เล่นลงแรงจริง
   - ไฟชี้นำ: ปุ่ม DOM ใช้ไฟกะพริบ (.quest-glow) · วัตถุบน canvas (คอม/โต๊ะเล่น/ตู้) ใช้ลูกศร ▼ ลอยชี้
     btn รับได้ทั้ง selector และโทเคน 'canvas:counter'|'canvas:playtable'|'canvas:anytank'|'canvas:breeder' (ชี้วัตถุบนพื้น) · ปุ่มในตู้ #ovFeedBtn/#ovBreedBtn/#ovAdd ชี้ต่อในโหมดตู้ได้
   - ระบบสุ่ม (ออเดอร์ออนไลน์/คำท้าแข่ง) บังคับให้โผล่ตอนถึงเควสด้วย q.force()

   บาลานซ์/ลำดับ/เหตุผล: claude/quest_system_design.md
   หมายเหตุ: "ความดึงดูด" (visitorAttraction ใน people.js) = Σ ทากในตู้ × ความสะอาดของตู้
     + Σ def.attr ของของตกแต่งบนพื้น + จำนวนของตกแต่งในตู้ × 0.5
     (คอมเมนต์เดิมเขียนว่า "ของตกแต่งไม่มีผล" — ไม่จริง ของตกแต่งนับทั้งบนพื้นและในตู้) */
(function(){
 if(typeof G==='undefined'){ console.warn('[quests] ไม่มี G'); return; }
 if(!G.stats) G.stats={};
 for(const k of ['fed','cleaned','bred','ordered','sold','earned','spent','sec','compOpen','played','transferred','sellerTrade','painted','geneSeen','practiced','contestWin','tourWin']) if(!Number.isFinite(G.stats[k])) G.stats[k]=0;
 if(!Number.isFinite(G.rep)) G.rep=0;
 if(!Number.isFinite(G.questIndex)) G.questIndex=0;
 G.questDone=!!G.questDone;
 /* ⚠️ 2026-09-19 ผู้เล่น: "ของจากผู้หวังดี กะเวลาให้ดีกว่านี้ ไม่ใช่ยังไม่ทันทำไรเลยก็แจกแล้ว"
    เดิม welcomeGiftAt = เปิดเกม + 3 นาที เฉย ๆ ไม่สนความคืบหน้า ทั้งที่จดหมายเขียนว่า "เห็นเพิ่งเปิดร้าน"
    ตอนนี้ผูกกับเควส "เปิดร้านรับลูกค้า" (tutorial-14) แล้วหน่วง 2 นาที — จดหมายมาถึงตอนเปิดร้านจริง
    และมีเคาน์เตอร์รับพัสดุแน่นอน (เควสเคาน์เตอร์อยู่ก่อนหน้า) · ตั้งค่าใน advance()
    welcomeGiftAt เหลือหน้าที่เดียวคือ "เส้นตายกัน soft-lock" เผื่อคนไม่ยอมเปิดร้าน — ขยับเป็น 30 นาที
    (ตั้งค่าจริงใน migration v7 ด้านล่าง เพราะ welcomeGiftV2 ใส่ใน save.js ไม่ได้ ฟิลด์เซฟเป็นลิสต์ตายตัว) */
 const WELCOME_DELAY_MS=120000, WELCOME_DEADLINE_MS=1800000;
 if(!G.welcomeGiftDone && !(G.welcomeGiftAt>0)) G.welcomeGiftAt=Date.now()+WELCOME_DEADLINE_MS;

 const S=()=>G.stats;
 const decorCount   =()=> (G.objs||[]).filter(o=>o&&o.type==='deco'&&o._key!=='counter').length;
 const tankCount    =()=> (G.objs||[]).filter(o=>o&&o.type==='tank'&&!(typeof isBreeder==='function'&&isBreeder(o))).length;
 const breederExists=()=> (G.objs||[]).some(o=>o&&typeof isBreeder==='function'&&isBreeder(o));
 const area         =()=> (typeof floorArea==='function'?floorArea():((G.bw||0)*(G.bh||0)));
 const shopOpen     =()=> (typeof peopleOn!=='undefined' && !!peopleOn);
 const attraction    =()=> (typeof visitorAttraction==='function'?visitorAttraction():0);
 const doneOrders    =()=> (G.orders||[]).filter(o=>o&&o.done).length;
 const marketListed  =()=> { try{ return !!(G.market&&Array.isArray(G.market.listings)&&G.market.listings.length); }catch(e){ return false; } };
 const tankDecorated =()=> (G.objs||[]).some(o=>o&&o.type==='tank'&&Array.isArray(o.decor)&&o.decor.length>0);

 /* ⚠️ สแนปช็อตต้องมี "ทุกคีย์" ที่ cond ของเควสไหนก็ตามเอาไปเทียบ — ถ้าลืมคีย์ใหม่
    เงื่อนไขจะกลายเป็น `n > undefined` = false ตลอดกาล แล้วเควสนั้นค้างถาวร (soft-lock) */
 function snapshot(){ return {fed:S().fed, cleaned:S().cleaned, bred:S().bred, ordered:S().ordered, sold:S().sold, decor:decorCount(), tank:tankCount(), area:area(),
   compOpen:S().compOpen, played:S().played, transferred:S().transferred, sellerTrade:S().sellerTrade, painted:S().painted, doneOrders:doneOrders(),
   geneSeen:S().geneSeen, practiced:S().practiced, contestWin:S().contestWin, tourWin:S().tourWin}; }

 const CH1_COUNT=15;   // จำนวนเควสบทที่ 1 (index 0–14) — ต่อท้ายบทที่ 2 โดยไม่กระทบเซฟเก่า

 const ORIGINAL_QUESTS=[
  /* ===== บทที่ 1 (0–14) — ห้ามแก้ id/ลำดับ เพื่อรักษารางวัลที่ผู้เล่นเคยรับ ===== */
  {t:'ให้อาหารทากทะเล', h:'คลิกเข้าตู้ → กดปุ่มที่ไฟกะพริบ (เปิดโหมดวางอาหาร) → คลิกพื้นที่ว่างในตู้เพื่อวางอาหาร', cond:b=>S().fed>b.fed, reward:{coin:50, rep:0, txt:'ปลดล็อกอาหารที่ดีขึ้น'}, btn:['#foodChoose','#ovFeedBtn','canvas:anytank'],
   force:()=>{ try{ if(typeof foodMode!=='undefined'&&foodMode) return; if(typeof tankMode!=='undefined'&&!tankMode) return; const det=document.getElementById('foodBar')&&document.getElementById('foodBar').closest('details'); if(det&&!det.open) det.open=true; }catch(e){} }},
  {t:'ทำความสะอาดตู้', h:'เข้าตู้ → กดปุ่มที่ไฟกะพริบ "🧹 ทำความสะอาด" แล้วลากแปรงถูคราบสาหร่ายให้หมด', cond:b=>S().cleaned>b.cleaned, reward:{coin:50, rep:0, txt:'ได้แปรงขัดตู้'}, btn:['#tankBrush','canvas:anytank'],
   /* ⚠️ 2026-09-20 ผู้เล่น: "คำสั่งให้ตะไคร่ขึ้นไม่ทำงาน"
      ตะไคร่ไม่ขึ้นเลยใน 15 นาทีแรก (ALGAE_GRACE ใน tank-hygiene.js) แล้วเควสนี้ย้ายจากอันดับ 17
      มาเป็นอันดับ 2 ซึ่งผู้เล่นถึงภายใน 1–2 นาที ตู้จึงเอี่ยมสนิท scrubTank() คืน false ทันที
      (`if(before<=.0001) return false`) ตัวนับ cleaned ไม่ขยับ = เควสค้างถาวร
      จึงเร่งอายุคราบของตู้ให้พอเห็น (~45% ของเต็ม) ตอนถึงเควสนี้เท่านั้น
      เช็ก dirt ก่อนทุกครั้ง — มีคราบอยู่แล้ว (หรือกำลังขัดค้างไว้) จะไม่ไปยุ่งซ้ำ */
   force:()=>{ try{
    if(typeof tankHygiene!=='function'||typeof ALGAE_CELLS==='undefined') return;
    const tanks=(G.objs||[]).filter(o=>o&&o.type==='tank'&&!isContest(o));
    if(!tanks.length) return;
    const now=Date.now();
    if(tanks.some(o=>tankHygiene(o,now).dirt>0.01)) return;
    tanks[0].hygiene={cleaned:Array(ALGAE_CELLS).fill(now-ALGAE_GRACE-ALGAE_STEP*20)};
    tankHygiene(tanks[0],now);
   }catch(e){} }},
  {t:'แต่งร้านสักหน่อย', h:'เข้าโหมดก่อสร้าง (🔧) ซื้อของตกแต่งมาวางในร้าน 1 ชิ้น', cond:b=>decorCount()>b.decor, reward:{coin:150, rep:0, txt:'ปลดล็อกชุดตกแต่งใหม่'}, btn:'#mBuild'},
  {t:'ทำประตูเข้าร้าน', h:'กด 🔧 ก่อสร้าง → แท็บ "อุปกรณ์สำคัญ" → เลือก 🚪 ประตู แล้วแตะบนกำแพงเพื่อวาง', cond:b=>!!G.door, reward:{coin:100, rep:0, txt:'ลูกค้าเดินเข้าร้านได้แล้ว'}, btn:['#shop .item[data-k="wall-door"]','#floorBuildDock .decorTabs [data-cat="อุปกรณ์สำคัญ"]','#mBuild']},
  {t:'เพิ่มความดึงดูดของร้าน', h:'ซื้อของตกแต่งเพิ่ม (และมีทากอยู่ในตู้) ให้ค่าความดึงดูดแตะ 6', cond:b=>attraction()>=6, reward:{coin:200, rep:0, tank:'tank_breed', txt:'รับตู้เพาะพันธุ์ฟรีในที่พักพิง แล้วนำมาวางในร้านได้เลย'}, btn:'#mBuild'},
  {t:'วางตู้เพาะพันธุ์', h:'กดปุ่ม "📦 คลัง" (มุมซ้ายล่าง) → แท็บ "ของที่เก็บ" → ลากตู้เพาะพันธุ์ฟรีที่ได้รับมาวางในร้าน', cond:b=>breederExists(), reward:{coin:100, rep:2, txt:'ปลดล็อกการเพาะพันธุ์'}, btn:['#navInv','#mBuild']},
  {t:'ผสมพันธุ์ทากคู่แรก', h:'เข้าตู้เพาะ → กดปุ่มที่ไฟกะพริบ "เลือกทากมาผสมพันธุ์" → เลือก 2 ตัว แล้วเริ่ม (จากนั้นจะเข้าสู่ช่วงรอผสม → รอไข่ → ฟักไข่)', cond:b=>S().bred>b.bred, reward:{coin:200, rep:1, box:0, txt:'รอลูกทากตัวแรกได้เลย · แถมกล่องสุ่มทาก 1 กล่อง'}, btn:['#startBreeder','#ovBreedBtn','canvas:breeder'],
   force:()=>{ try{ if(typeof tankMode!=='undefined'&&!tankMode) return; const bp=document.getElementById('breederPanel'), det=bp&&bp.closest('details'); if(det&&!det.hidden&&!det.open) det.open=true; }catch(e){} }},
  {t:'วางเคาน์เตอร์ขายทาก', h:'กด 🔧 ก่อสร้าง → แท็บ "อุปกรณ์สำคัญ" → เลือกเคาน์เตอร์แมว (ฟรี) แล้ววางในร้านให้ลูกค้ามาเสนอราคา', cond:b=>(G.objs||[]).some(o=>o&&o.type==='deco'&&o._key==='counter'), reward:{coin:100, rep:1, txt:'พร้อมขายทากแล้ว'}, btn:['#shop .item[data-k="counter"]','#floorBuildDock .decorTabs [data-cat="อุปกรณ์สำคัญ"]','#mBuild']},
  {t:'ขายทากให้ลูกค้า', h:'รอลูกค้าเดินมาที่เคาน์เตอร์เสนอราคา แล้วกดขาย — ขายลูกที่เพาะได้ อย่าขายคู่พ่อแม่', cond:b=>S().sold>b.sold, reward:{coin:150, rep:1, txt:'นี่คือรายได้หลักของร้าน'}, btn:'#mView'},
  {t:'ขายทากอีกตัว', h:'ทากที่ผสมจนหมดพลังก็ยังขายได้ ลองปล่อยของอีกตัว', cond:b=>S().sold>b.sold, reward:{coin:200, rep:1, txt:'ทากที่หมดพลังผสมแล้วก็ยังมีราคา'}, btn:'#mView'},
  {t:'สั่งกล่องทากจากคอม', h:'คลิกคอมพิวเตอร์บนเคาน์เตอร์ → สั่งกล่องทาก แล้วรอส่ง ~1 นาที', cond:b=>S().ordered>b.ordered, reward:{coin:200, rep:2, box:0, txt:'ปลดล็อกกล่องยีนกว้างขึ้น · แถมกล่องสุ่มทาก 1 กล่อง'}, btn:'#mView'},
  {t:'ซื้อตู้ใหม่', h:'ทากเริ่มเยอะ ซื้อตู้เพิ่มไว้เก็บอีกใบ', cond:b=>tankCount()>b.tank, reward:{coin:150, rep:0, txt:'ปลดล็อกตู้ขนาดอื่น'}, btn:'#mBuild'},
  {t:'ขยายร้าน', h:'โหมดก่อสร้าง → เลือกช่องขยายร้าน เพิ่มพื้นที่', cond:b=>area()>b.area, reward:{coin:200, rep:0, txt:'พื้นที่มากขึ้น วางของได้เยอะขึ้น'}, btn:'#mBuild'},
  {t:'ขายทากให้ครบ 5 ตัว', h:'ระบายทากส่วนเกินที่เพาะไว้ให้ลูกค้า', cond:b=>S().sold>=b.sold+5, reward:{coin:250, rep:2, box:0, txt:'ระบายของเก่งแล้ว · แถมกล่องสุ่มทาก 1 กล่อง'}, btn:'#mView'},
  {t:'เปิดร้านรับลูกค้า', h:'กดปุ่ม 👥 ลูกค้า ที่แถบบนขวา เพื่อเปิดร้านให้ลูกค้าเดินเข้ามาซื้อ', cond:b=>shopOpen(), reward:{coin:200, rep:1, box:0, txt:'เปิดร้านแล้ว! รับกล่องสุ่มทากไปเริ่มต้น 1 กล่อง'}, btn:'#bPeople'},

  /* ===== บทที่ 2 (15–24) — แนะนำระบบสีสันทุกตัว ===== */
  {t:'เปิดคอมพิวเตอร์ประจำร้าน', h:'คลิกคอมพิวเตอร์บนเคาน์เตอร์ (ตามลูกศรชี้) — เป็นศูนย์รวมสั่งของ ตลาดโลก และจดหมาย', cond:b=>S().compOpen>b.compOpen, reward:{coin:100, rep:1, txt:'นี่คือศูนย์บัญชาการของร้าน'}, btn:'canvas:counter'},
  {t:'ติดตั้งชั้นวางติดผนัง', h:'กด 🔧 ก่อสร้าง → แท็บ "อุปกรณ์สำคัญ" → เลือก 🧱 ชั้นวางติดผนัง แล้วแตะกำแพง (ไว้โชว์ทากที่ลงขายตลาดโลก)', cond:b=>!!G.shelf, reward:{coin:150, rep:1, txt:'พร้อมโชว์ทากบนชั้นแล้ว'}, btn:['#shop .item[data-k="wall-shelf"]','#floorBuildDock .decorTabs [data-cat="อุปกรณ์สำคัญ"]','#mBuild']},
  {t:'ลงขายทากในตลาดโลก', h:'เปิดคอม → 🌐 ตลาดโลก เลือกทากลงขายสัก 1 ตัว ทากจะไปโผล่บนชั้นติดผนัง', cond:b=>marketListed(), reward:{coin:200, rep:2, txt:'ตลาดโลกขายได้เรื่อย ๆ แม้ร้านปิด'}, btn:['[data-market]','canvas:counter']},
  {t:'รับออเดอร์ออนไลน์ใบแรก', h:'มีลูกค้าออนไลน์สั่งทากตามสเปกยีน เปิดคอม → กล่องจดหมาย เลือกทากที่ตรงสเปกแล้วกดส่ง', cond:b=>doneOrders()>b.doneOrders, reward:{coin:250, rep:2, box:1, txt:'ออเดอร์ออนไลน์ = ที่ระบายทากตรงสเปก · แถมกล่องสุ่มระดับกลาง 1 กล่อง'}, btn:['[data-tab="inbox"]','canvas:counter'],
   force:()=>{ try{ if(typeof OnlineOrders==='object'&&OnlineOrders&&typeof OnlineOrders.forceOrder==='function' && (G.orders||[]).filter(o=>o&&!o.done).length===0) OnlineOrders.forceOrder(); }catch(e){} }},
  {t:'เปลี่ยนสีพื้น/ผนังร้าน', h:'กด 🔧 ก่อสร้าง → แท็บ "วัสดุ" → เลือกลายพื้น/ผนัง แล้วลากทาบนพื้นร้าน', cond:b=>S().painted>b.painted, reward:{coin:150, rep:1, txt:'แต่งร้านให้เป็นสไตล์ของคุณ'}, btn:['#floorBuildDock .decorTabs [data-cat="วัสดุ"]','#mBuild']},
  {t:'ตกแต่งภายในตู้เลี้ยง', h:'คลิกเข้าตู้ → เปิด 🔧 จัดของ แล้ววางของตกแต่งในตู้สัก 1 ชิ้น', cond:b=>tankDecorated(), reward:{coin:50, rep:1, txt:'ของในตู้ช่วยเพิ่มความดึงดูดด้วย'}, btn:['#ovBuild','canvas:anytank']},
  {t:'ย้ายทากข้ามตู้', h:'เข้าตู้ → ปุ่ม "จัดการทาก" เลือกทากแล้วย้ายเข้า/ออกระหว่างตู้กับคลัง', cond:b=>S().transferred>b.transferred, reward:{coin:150, rep:1, txt:'จัดกลุ่มทากได้ตามใจ'}, btn:['#ovAdd','canvas:anytank']},
  {t:'วางโต๊ะเล่นแล้วเล่นกับทาก', h:'กด 🔧 ก่อสร้าง → แท็บ "อุปกรณ์สำคัญ" → ซื้อ "โต๊ะเล่นกับทาก" มาวาง แล้วคลิกที่โต๊ะ (ตามลูกศร) เพื่อเล่น', cond:b=>S().played>b.played, reward:{coin:100, rep:1, txt:'เล่นกับทากให้มันมีความสุข'}, btn:['canvas:playtable','#shop .item[data-k="play_table"]','#floorBuildDock .decorTabs [data-cat="อุปกรณ์สำคัญ"]','#mBuild']},
  {t:'ค้าขายกับพ่อค้าเร่/คนรับเหมา', h:'บางครั้งพ่อค้าเร่จะเอาทากมาขาย หรือคนรับเหมามารับซื้อทากทีละเยอะ ๆ — กดปุ่ม "ข้อเสนอ" มุมขวาบน (เรืองแสงเองทุกครั้งที่มีข้อเสนอเข้ามา) แล้วลองซื้อหรือขายสักครั้ง', cond:b=>S().sellerTrade>b.sellerTrade, reward:{coin:200, rep:2, txt:'ช่องทางซื้อ-ขายนอกหน้าร้าน'}, btn:'#navOffers'},
  {t:'ลองแข่งทากทะเล', h:'กด 🔧 ก่อสร้าง → แท็บ "ตู้เลี้ยง" → ซื้อ "ตู้แข่งทากทะเล" มาวาง เดี๋ยวจะมีคนมาท้าแข่ง — กดรับคำท้าแล้วลุยเลย!', cond:b=>!!(G.racing&&G.racing.purchased), reward:{coin:150, rep:2, box:0, txt:'ชนะแล้วมีรางวัลด้วยนะ · แถมกล่องสุ่มทาก 1 กล่อง'}, btn:['#shop .item[data-k="tank_race"]','#floorBuildDock .decorTabs [data-cat="ตู้เลี้ยง"]','#mBuild'],
   force:()=>{ try{ if(G.racing&&G.racing.purchased&&!G.racing.offer&&!G.racing.active) G.racing.nextAt=Date.now(); }catch(e){} }},

  /* ===== แทรกในลูปเพาะพันธุ์ (id 25–26) — id ต่อท้ายไว้ ไม่กระทบเซฟเก่า · จัดตำแหน่งจริงในลำดับ QUESTS ===== */
  {t:'ใส่ทากเข้าตู้เพาะพันธุ์', h:'เข้าตู้เพาะ → กดปุ่ม "จัดการทาก" (แถบซ้าย) → ย้ายทากจากคลังเข้าตู้ให้ครบอย่างน้อย 2 ตัว', cond:b=>(G.objs||[]).some(o=>o&&typeof isBreeder==='function'&&isBreeder(o)&&o.slugs&&o.slugs.length>=2), reward:{coin:100, rep:1, txt:'ต้องมี 2 ตัวในตู้ถึงจะผสมได้'}, btn:['#ovAdd','canvas:breeder']},
  {t:'ฟักไข่ทากตัวแรก', h:'หลังผสมเสร็จจะได้ไข่ → รอสักครู่จนไข่พร้อมฟัก → กดปุ่ม "ฟักทั้งหมด" หรือคลิกไข่ในตู้ (ตัวอ่อนที่ฟักจะค่อย ๆ โตเป็นทากตัวใหม่)', cond:b=>{try{return (G.objs||[]).some(o=>o&&typeof isBreeder==='function'&&isBreeder(o)&&typeof breederState==='function'&&(breederState(o).larvae||[]).length>0);}catch(e){return false;}}, reward:{coin:200, rep:1, txt:'ตัวอ่อนจะโตเป็นทากขายได้'}, btn:['#hatchAllBreeder','#ovBreedBtn','canvas:breeder'],
   force:()=>{ try{ if(typeof tankMode!=='undefined'&&!tankMode) return; const bp=document.getElementById('breederPanel'), det=bp&&bp.closest('details'); if(det&&!det.hidden&&!det.open) det.open=true; }catch(e){} }},

  /* ===== บทที่ 3 (27–33) — ยีน + สนามแข่งทั้ง 4 ชนิด · id ต่อท้ายไว้ ไม่กระทบเซฟเก่า =====
     27 แทรกไว้ต้นเกม (ก่อนเพาะพันธุ์) · 28–33 เป็นเป้าหมายปลายเกมหลังจบบทที่ 2 */
  {t:'ดูยีนของทากในตู้', h:'คลิกทากสักตัวในตู้ (ตามลูกศร) จะมีการ์ดยีนโผล่ขึ้นมา — ตัวเลขชุดนี้คือสิ่งที่ส่งต่อไปยังลูกตอนเพาะพันธุ์ ลองคลิกดูทีละตัวว่าต่างกันยังไง', cond:b=>S().geneSeen>b.geneSeen, reward:{coin:50, rep:1, txt:'ยีนคือหัวใจของการเพาะพันธุ์'}, btn:['canvas:anytank']},
  {t:'ลองโหมดซ้อมในตู้แข่ง', h:'เข้าตู้แข่งที่ซื้อไว้ → กดปุ่ม "ซ้อม" → เลือกทากของเรา 1 ตัวกับคู่ซ้อมจากตู้เดียวกัน แล้วเริ่มได้เลย · ซ้อมไม่มีเดิมพัน ไม่ได้ ไม่เสียเหรียญ', cond:b=>S().practiced>b.practiced, reward:{coin:50, rep:1, txt:'ซ้อมได้ไม่จำกัด ไว้หาว่าทากตัวไหนถนัดเกมไหน'}, btn:['canvas:contest']},
  {t:'ชนะการแข่งครั้งแรก', h:'รอผู้ท้าชิงมาเคาะประตู (ดูที่ปุ่ม "ข้อเสนอ" มุมขวาบน) แล้วคว้าที่ 1 ให้ได้สักครั้ง — ซ้อมก่อนได้ไม่จำกัด ไม่ต้องรีบรับคำท้า', cond:b=>S().contestWin>b.contestWin, reward:{coin:150, rep:2, txt:'ชนะแล้วมีเงินรางวัลติดมือด้วย'}, btn:['#navOffers','canvas:contest']},
  {t:'เปิดตู้ชักเย่อ', h:'กด 🔧 ก่อสร้าง → แท็บ "ตู้เลี้ยง" → ซื้อ 🪢 ตู้ชักเย่อ มาวาง — เกมนี้แข่ง 3 ต่อ 3 วัดพลังล้วน ๆ ทากตัวใหญ่ได้เปรียบ', cond:b=>!!(G.tug&&G.tug.purchased), reward:{coin:150, rep:2, box:0, txt:'ปลดล็อกทัวร์นาเมนต์ชักเย่อด้วย · แถมกล่องสุ่มทาก 1 กล่อง'}, btn:['#shop .item[data-k="tank_tug"]','#floorBuildDock .decorTabs [data-cat="ตู้เลี้ยง"]','#mBuild'],
   force:()=>{ try{ if(G.tug&&G.tug.purchased&&!G.tug.offer&&!G.tug.active) G.tug.nextAt=Date.now(); }catch(e){} }},
  {t:'เปิดตู้แข่งกินจุ', h:'กด 🔧 ก่อสร้าง → แท็บ "ตู้เลี้ยง" → ซื้อ 🍽️ ตู้แข่งกินจุ มาวาง — แข่ง 4 ตัว ลากอาหารกลับรัง ยิ่งชิ้นใหญ่ยิ่งได้แต้ม แต่เคี้ยวนาน', cond:b=>!!(G.eat&&G.eat.purchased), reward:{coin:150, rep:2, box:1, txt:'เกมนี้วัดความเร็ว + การเลือกชิ้น · แถมกล่องสุ่มระดับกลาง 1 กล่อง'}, btn:['#shop .item[data-k="tank_eat"]','#floorBuildDock .decorTabs [data-cat="ตู้เลี้ยง"]','#mBuild'],
   force:()=>{ try{ if(G.eat&&G.eat.purchased&&!G.eat.offer&&!G.eat.active) G.eat.nextAt=Date.now(); }catch(e){} }},
  {t:'เปิดตู้ปาหิน', h:'กด 🔧 ก่อสร้าง → แท็บ "ตู้เลี้ยง" → ซื้อ 🪨 ตู้ปาหิน มาวาง — ปาหินด้วยหงอน จับจังหวะแถบพลังกับแถบมุมให้พอดี', cond:b=>!!(G.throwing&&G.throwing.purchased), reward:{coin:150, rep:2, txt:'ทากหงอนยาวปาได้ไกลกว่า'}, btn:['#shop .item[data-k="tank_throw"]','#floorBuildDock .decorTabs [data-cat="ตู้เลี้ยง"]','#mBuild'],
   force:()=>{ try{ if(G.throwing&&G.throwing.purchased&&!G.throwing.offer&&!G.throwing.active) G.throwing.nextAt=Date.now(); }catch(e){} }},
  {t:'คว้าแชมป์ทัวร์นาเมนต์', h:'เมื่อมีตู้แข่งวิ่งหรือตู้ชักเย่อ จะมีจดหมายเชิญเข้าทัวร์นาเมนต์ 8 ทีมส่งมาที่คอมประจำร้าน — ผ่านรอบ 8 ทีม → รองชนะเลิศ → ชิงชนะเลิศ ให้ครบ', cond:b=>S().tourWin>b.tourWin, reward:{coin:200, rep:3, box:2, txt:'แชมป์แล้ว! รับกล่องสุ่มระดับแพง 1 กล่องไปเลย'}, btn:['canvas:counter','canvas:contest']},

  /* ⚠️ ต่อท้ายเท่านั้น — id ของเควสมาจากลำดับในอาร์เรย์ (tutorial-<index>) แทรกกลางแล้วรางวัลที่รับไปแล้วจะเพี้ยน */
  {t:'เปิดตู้ดันวง', h:'กด 🔧 ก่อสร้าง → แท็บ "ตู้เลี้ยง" → ซื้อ ⭕ ตู้ดันวง มาวาง — ดันคู่แข่งออกจากวงด้วยการชนเข้า "ข้างลำตัว" ตอนหัวมันชี้ออกนอกวง แล้วมันจะเดินออกไปเอง', cond:b=>!!(G.sumo&&G.sumo.purchased), reward:{coin:150, rep:2, txt:'จำนวนหงอน = ความเร็วพุ่ง · ขนาดหงอน = ระยะเวลาพุ่ง · ตัวยาวโดนแตะข้างง่าย'}, btn:['#shop .item[data-k="tank_sumo"]','#floorBuildDock .decorTabs [data-cat="ตู้เลี้ยง"]','#mBuild'],
   force:()=>{ try{ if(G.sumo&&G.sumo.purchased&&!G.sumo.offer&&!G.sumo.active) G.sumo.nextAt=Date.now(); }catch(e){} }},
 ];

 // Stable IDs preserve earned rewards when tutorial order changes.
 ORIGINAL_QUESTS.forEach((q,i)=>q.id='tutorial-'+i);
 /* ⚠️ 2026-09-19 ผู้เล่น: "เรื่องพ่อค้าเร่งภารกิจขึ้นมาหน่อย"
    เควส "ค้าขายกับพ่อค้าเร่/คนรับเหมา" (23) เคยอยู่อันดับ 26 จาก 27 = เกือบท้ายสุด
    และ sellerSystemUnlocked() ผูกกับเควสนี้ → พ่อค้าเร่/คนรับเหมาไม่โผล่มาเลยจนกว่าจะไล่เควสเกือบจบ
    ย้ายมาต่อจาก "สั่งกล่องทากจากคอม" (10) — จังหวะที่ผู้เล่นเพิ่งรู้จักการหาทากเข้าร้านพอดี
    ⚠️ กติกาที่ต้องรักษาไว้ตลอด: 23 ต้องอยู่ "ติดหลัง" 10 เสมอ ไม่ว่าจะจัดลำดับใหม่กี่รอบ */
 /* ⚠️ 2026-09-19 ผู้เล่น: "อยากเรียงลำดับเควสใหม่ สอนอย่างอื่นให้เข้าใจก่อนแล้วค่อยเปิดร้าน"
    ลำดับเดิมพาผู้เล่นไปเปิดร้านรับลูกค้าตั้งแต่ "อันดับ 2" ทั้งที่ยังไม่เคยให้อาหาร ไม่เคยขัดตู้
    ไม่เคยเพาะ ไม่เคยขาย · แถมเควส "ทำความสะอาดตู้" ไปอยู่อันดับ 17 ทั้งที่อันดับ 6 (ความดึงดูด)
    เอาความสะอาดไปคูณเป็นคะแนนอยู่แล้ว และ "เปิดคอมประจำร้าน" อยู่อันดับ 19 ทั้งที่อันดับ 13
    สั่งให้ใช้คอมไปก่อนแล้ว · ลำดับใหม่แบ่งเป็น 5 องก์:
      องก์ 1 (1–5)   รู้จักทากของตัวเองก่อน — ร้านยังปิด ไม่มีลูกค้ามากวน
      องก์ 2 (6–10)  แต่งร้าน → ความดึงดูด → ประตู → เคาน์เตอร์ → เปิดร้าน (ครบเครื่องแล้วค่อยเปิด)
      องก์ 3 (11–19) เพาะพันธุ์แล้วขาย — เปิดคอมก่อนเควสที่สั่งให้ใช้คอม
      องก์ 4 (20–27) ขยายกิจการ
      องก์ 5 (28–34) สนามแข่ง 4 ชนิด + ทัวร์นาเมนต์ (บทที่ 3 ใหม่)
    (ลำดับเปลี่ยนได้ ไม่กระทบรางวัลเก่า เพราะ questCompleted เก็บเป็น id · ดู migration v7 ด้านล่าง) */
 const QUESTS=[0,1,20,27,21, 2,4,3,7,14, 5,25,6,26,8,9,15,10,23, 11,12,19,13,16,17,18,22, 24,28,29,30,31,32,33].map(i=>ORIGINAL_QUESTS[i]);
 /* ⚠️ 2026-09-19 บั๊กใหญ่: เงื่อนไขนี้เคยเป็น `!==2` — เซฟที่ผ่าน migration ไปถึงเวอร์ชัน 3,4,5 แล้ว
    จะเข้าบล็อกนี้ "ซ้ำทุกครั้งที่โหลดเกม" แล้วสร้าง questCompleted ใหม่จาก questIndex
    ซ้ำร้ายมันไล่จาก ORIGINAL_QUESTS (ลำดับตอนเขียนโค้ด) ไม่ใช่ QUESTS (ลำดับที่เล่นจริง) ซึ่งคนละชุดกัน
    ผลคือรีเฟรชทีนึง ความคืบหน้าเควสถูกเขียนใหม่และมักถอยหลัง → เควสท้าย ๆ ไปไม่ถึงสักที
    (นี่คือสาเหตุที่พ่อค้าเร่ไม่มาเลย เพราะ sellerSystemUnlocked() รอเควสอันท้าย ๆ)
    ต้องรันเฉพาะเซฟเก่าก่อนมีระบบเวอร์ชัน (< 2) เท่านั้น */
 if((G.questOrderVersion||0)<2){
  const oldIndex=Math.max(0,Math.min(CH1_COUNT,G.questIndex||0)),oldId=ORIGINAL_QUESTS[oldIndex]?.id;
  G.questCompleted=ORIGINAL_QUESTS.slice(0,G.questDone?CH1_COUNT:oldIndex).map(q=>q.id);
  G.questIndex=QUESTS.findIndex(q=>!G.questCompleted.includes(q.id));
  G.questDone=G.questIndex<0;if(G.questDone)G.questIndex=QUESTS.length;
  else if(QUESTS[G.questIndex].id!==oldId)G.questBase=snapshot();
  G.questOrderVersion=2;
 }
 if(G.questOrderVersion===2){
  G.questIndex=QUESTS.findIndex(q=>!G.questCompleted.includes(q.id));
  G.questDone=G.questIndex<0; if(G.questDone)G.questIndex=QUESTS.length; else G.questBase=snapshot();
  G.questOrderVersion=3;
 }
 /* v4: เพิ่มบทที่ 2 — id บทที่ 1 คงเดิม เควสที่จบแล้วยังนับจบ ผู้เล่นที่จบบท 1 จะได้เล่นบท 2 ต่อ */
 if(G.questOrderVersion===3){
  if(!Array.isArray(G.questCompleted))G.questCompleted=[];
  G.questIndex=QUESTS.findIndex(q=>!G.questCompleted.includes(q.id));
  G.questDone=G.questIndex<0; if(G.questDone)G.questIndex=QUESTS.length; else G.questBase=snapshot();
  G.questOrderVersion=4;
 }
 /* v5: แทรกด่าน "ใส่ทากเข้าตู้เพาะ"(25) + "ฟักไข่"(26) ในลูปเพาะพันธุ์
    ผู้ที่เคยผสมพันธุ์แล้ว (tutorial-6 จบ) = ผ่านขั้นใส่ทาก/ฟักมาแล้ว → มาร์คจบให้ ไม่ต้องย้อน */
 if(G.questOrderVersion===4){
  if(!Array.isArray(G.questCompleted))G.questCompleted=[];
  if(G.questCompleted.includes('tutorial-6')) for(const id of ['tutorial-25','tutorial-26']) if(!G.questCompleted.includes(id)) G.questCompleted.push(id);
  G.questIndex=QUESTS.findIndex(q=>!G.questCompleted.includes(q.id));
  G.questDone=G.questIndex<0; if(G.questDone)G.questIndex=QUESTS.length; else G.questBase=snapshot();
  G.questOrderVersion=5;
 }
 /* v6: ย้ายเควสพ่อค้าเร่ขึ้นมาอันดับ 14 — คนที่เล่นค้างอยู่ให้ชี้ไปเควสแรกที่ยังไม่จบตามลำดับใหม่ */
 if(G.questOrderVersion===5){
  if(!Array.isArray(G.questCompleted))G.questCompleted=[];
  G.questIndex=QUESTS.findIndex(q=>!G.questCompleted.includes(q.id));
  G.questDone=G.questIndex<0; if(G.questDone)G.questIndex=QUESTS.length; else G.questBase=snapshot();
  G.questOrderVersion=6;
 }
 /* v7: จัดลำดับใหม่ทั้งชุด (สอนดูแลทาก/ยีน ก่อนเปิดร้าน) + เพิ่มบทที่ 3 (27–33) + รื้อบาลานซ์รางวัล
    - ลำดับ: findIndex หาเควสแรกที่ยังไม่จบตามลำดับใหม่ เหมือน v5/v6
    - คนที่จบ 27 เควสเดิมไปแล้ว questDone จะกลับเป็น false เพราะมีบทที่ 3 ต่อ — ตั้งใจให้เป็นแบบนั้น
    - รางวัลที่ปรับใหม่มีผลเฉพาะเควสที่ "ยังไม่จบ" · grantOnce('quest-'+id) กันจ่ายซ้ำของเดิมอยู่แล้ว
    - ของขวัญผู้หวังดี: เซฟเก่าเก็บ welcomeGiftAt เป็นเวลาสัมบูรณ์ที่มักเลยมาแล้ว (เปิดเกม+3 นาที)
      โหลดมาปุ๊บจะยิงทันที = อาการที่ผู้เล่นบ่นพอดี · ล้างเป็นเส้นตาย 30 นาทีนับจากนี้แทน
      ตัวกระตุ้นจริงย้ายไปอยู่ที่ advance() ตอนผ่านเควส "เปิดร้านรับลูกค้า" */
 if(G.questOrderVersion===6){
  if(!Array.isArray(G.questCompleted))G.questCompleted=[];
  if(!G.welcomeGiftDone) G.welcomeGiftAt=Date.now()+WELCOME_DEADLINE_MS;
  G.questIndex=QUESTS.findIndex(q=>!G.questCompleted.includes(q.id));
  G.questDone=G.questIndex<0; if(G.questDone)G.questIndex=QUESTS.length; else G.questBase=snapshot();
  G.questOrderVersion=7;
 }
 if(!Array.isArray(G.questCompleted))G.questCompleted=[];
 /* ⚠️ แหล่งความจริงเดียวคือ questCompleted (เก็บเป็น id) — ดัชนีเควสปัจจุบันคิดใหม่ทุกครั้งที่โหลด
    ไม่งั้นเซฟที่ questIndex ค้างค่าเก่า (หรือจากตอนลำดับเควสยังไม่เหมือนนี้) จะชี้ผิดเควสไปตลอด
    คิดใหม่แบบนี้ทำซ้ำกี่รอบก็ได้ผลเท่าเดิม ต่างจากบล็อก migration ด้านบนที่เคยเขียนทับความคืบหน้า */
 {const i=QUESTS.findIndex(q=>!G.questCompleted.includes(q.id)), was=G.questIndex;
  G.questDone=i<0; G.questIndex=i<0?QUESTS.length:i;
  if(G.questIndex!==was) G.questBase=snapshot();     // เปลี่ยนเควส = ตั้งเส้นฐานความคืบหน้าใหม่
 }
 if(!G.questBase || typeof G.questBase!=='object') G.questBase=snapshot();

 /* ---- ชิป rep บนแถบบน ----
    ⚠️ ปิดไว้ 2026-09-13 — ไล่โค้ดทั้งเกมแล้ว **ไม่มีที่ไหนอ่าน `G.rep` ไปใช้เลย**
    ไม่มีผลกับราคาขาย ลูกค้า ปลดล็อก ตลาดโลก ออเดอร์ (เพดานทั้งเกมแค่ 27)
    ชิปเลยกินที่บนแถบบนฟรี ๆ และสับสนกับ "ความดึงดูด" ซึ่งมีผลจริง (= ทากในตู้ × ความสะอาด)
    ค่ายังสะสมและเซฟตามปกติ วันไหนให้ rep มีงานทำแล้วค่อยสลับกลับเป็น true */
 const SHOW_REP_CHIP=false;
 let repEl=null;
 function ensureRepChip(){
  if(!SHOW_REP_CHIP)return;
  if(repEl&&document.body.contains(repEl))return;
  const bar=document.querySelector('.topbar'); if(!bar)return;
  const coin=document.getElementById('hCoin'), host=coin?coin.closest('.stat'):null;
  repEl=document.createElement('div'); repEl.className='stat'; repEl.innerHTML='ชื่อเสียง <b id="hRep">0</b>';
  if(host&&host.parentNode) host.parentNode.insertBefore(repEl, host.nextSibling); else bar.appendChild(repEl);
 }
 function syncRep(){ ensureRepChip(); const b=document.getElementById('hRep'); if(b) b.textContent=(G.rep||0); }

 /* ---- การ์ดเควส ---- */
 const card=document.createElement('div'); card.id='questCard';
 card.style.cssText='position:fixed;left:14px;top:58px;z-index:40;width:min(300px,78vw);background:rgba(20,40,44,.94);color:#eadcc4;border:1px solid #b59859;border-radius:12px;padding:10px 12px;font:500 13px/1.5 "IBM Plex Sans Thai",system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35)';
 document.body.appendChild(card);
 function placeCard(){ if(card._docked) return; const bar=document.querySelector('.topbar'); const b=bar?Math.ceil(bar.getBoundingClientRect().bottom):48; card.style.top=(Math.max(8,b)+10)+'px'; }
 placeCard(); window.addEventListener('resize',placeCard);
 /* ⚠️ 2026-09-20 ผู้เล่น: "โหมดดูตู้แท็บภารกิจหาย"
    เดิมซ่อนการ์ดทิ้งตอนเปิดตู้ ซึ่งเคยไม่เป็นไรเพราะเควสในตู้อยู่ท้าย ๆ ลำดับ
    แต่ลำดับใหม่ให้เควส 1–4 (ให้อาหาร ขัดตู้ ตกแต่งในตู้ ดูยีน) อยู่ในตู้ทั้งหมด
    ผู้เล่นเข้าตู้ปุ๊บคำสั่งหายพอดี — ย้ายการ์ดไปเสียบหัวแถบข้างซ้ายของตู้แทนการซ่อน
    ใช้ผังเดิมของแถบข้างเลย จึงไม่ทับปุ่มไหน และเลื่อนตามแถบได้
    (ตู้แข่งซ่อน .tank-side อยู่แล้ว การ์ดจึงหายไปพร้อมกันตอนแข่ง ซึ่งถูกต้อง) */
 function dock(inSide){
  if(card._docked===inSide) return;
  card._docked=inSide;
  if(inSide){ card.style.position='static'; card.style.width='auto'; card.style.left=''; card.style.top=''; card.style.boxShadow='none'; }
  else { card.style.position='fixed'; card.style.left='14px'; card.style.width='min(300px,78vw)'; card.style.boxShadow='0 6px 24px rgba(0,0,0,.35)'; placeCard(); }
 }
 function updateCardVisibility(){
  if(G.questDone){ card.style.display='none'; return; }
  const ov=document.getElementById('ov'), inTank=!!(ov&&ov.classList.contains('on'));
  const side=inTank?document.querySelector('#ov .tank-side.left'):null;
  if(side){ if(card.parentNode!==side) side.insertBefore(card,side.firstChild); dock(true); }
  else { if(card.parentNode!==document.body) document.body.appendChild(card); dock(false); }
  card.style.display='block';
 }
 const _ovEl=document.getElementById('ov'); if(_ovEl&&typeof MutationObserver!=='undefined') new MutationObserver(updateCardVisibility).observe(_ovEl,{attributes:true,attributeFilter:['class']});
 updateCardVisibility();
 let questCollapsed=false; try{ questCollapsed=localStorage.getItem('questCardCollapsed')==='1'; }catch(e){}
 function questHeader(label){ return '<div style="display:flex;align-items:center;gap:8px;justify-content:space-between"><span style="font-size:11px;letter-spacing:.5px;opacity:.75">'+label+'</span><button id="questToggle" title="ย่อ/ขยาย" style="all:unset;cursor:pointer;color:#f1c66d;font-weight:700;font-size:16px;line-height:1;padding:0 4px">'+(questCollapsed?'▸':'▾')+'</button></div>'; }
 function bindToggle(){ const b=card.querySelector('#questToggle'); if(b) b.onclick=()=>{ questCollapsed=!questCollapsed; try{localStorage.setItem('questCardCollapsed',questCollapsed?'1':'0');}catch(e){} renderCard(); }; }

 /* ---- ไฟกะพริบรอบปุ่มของเควสปัจจุบัน (หยุดเมื่อกดปุ่ม หรือจบเควส) ---- */
 let _glowEl=null,_glowSel=null,_glowHandler=null,_glowPressedQuest=null;
 (function(){ if(document.getElementById('questGlowCSS'))return; const st=document.createElement('style'); st.id='questGlowCSS'; st.textContent='/* วงในสำคัญกว่าวงนอก: .mbtn ไม่มี border (border-color จึงไม่มีผล) และ .modeseg มี overflow:hidden ที่ตัดเงาวงนอกทิ้งหมด — เงา inset วาดในตัวปุ่มเลย เลยไม่โดนตัดไม่ว่าปุ่มจะอยู่ในกล่องแบบไหน */@keyframes questGlowPulse{0%,100%{box-shadow:inset 0 0 0 1.5px rgba(241,198,109,.75),0 0 0 0 rgba(241,198,109,.65),0 0 8px 2px rgba(241,198,109,.5)}50%{box-shadow:inset 0 0 0 2.5px rgba(241,198,109,1),0 0 0 4px rgba(241,198,109,.12),0 0 18px 7px rgba(241,198,109,.9)}}.quest-glow{animation:questGlowPulse 1.05s ease-in-out infinite;border-color:#f1c66d !important;border-radius:8px;position:relative;z-index:6}@keyframes questPtrBob{0%,100%{transform:translate(-50%,-100%) translateY(0)}50%{transform:translate(-50%,-100%) translateY(-9px)}}#questPointer{position:fixed;z-index:39;pointer-events:none;font-size:30px;line-height:1;color:#f1c66d;text-shadow:0 0 8px rgba(241,198,109,.95),0 0 3px rgba(0,0,0,.7);transform:translate(-50%,-100%);animation:questPtrBob .9s ease-in-out infinite;display:none}'; document.head.appendChild(st); })();
 function clearGlow(){ if(_glowEl){ _glowEl.classList.remove('quest-glow'); if(_glowHandler)_glowEl.removeEventListener('pointerdown',_glowHandler); } _glowEl=null;_glowSel=null;_glowHandler=null; }
 /* ปุ่มเป้าหมายหลายตัวใน index.html อยู่ในแผง .buildonly ซึ่ง body.mode-view ตั้ง display:none ไว้
    querySelector ยังเจอ element (มันอยู่ใน DOM เสมอ) แต่ผู้เล่นมองไม่เห็นไฟกะพริบเลย
    จึงต้องเช็ก "มองเห็นได้จริง" แล้วถอยไปไฮไลต์ปุ่มทางผ่าน (🔧 ก่อสร้าง) แทน */
 const _visible=el=>!!el&&!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length);
 const _isCanvasTok=s=>typeof s==='string'&&s.slice(0,7)==='canvas:';
 function resolveGlow(list){ for(const sel of list){ if(_isCanvasTok(sel))continue; const el=document.querySelector(sel); if(_visible(el)) return {el:el,sel:sel,primary:sel===list[0]}; } return null; }
 function applyGlow(list,qid){
  const hit=resolveGlow(list);
  if(!hit){ clearGlow(); return; }
  if(hit.el===_glowEl) return;                      // ปุ่มเดิม ไม่ต้องผูกใหม่
  clearGlow();
  hit.el.classList.add('quest-glow'); _glowEl=hit.el; _glowSel=hit.sel;
  _glowHandler=function(){
   if(hit.primary) _glowPressedQuest=qid;           // กดปุ่มเป้าหมายจริง = เลิกกะพริบ
   else setTimeout(updateQuestGlow,60);             // กดปุ่มทางผ่าน = ย้ายไฟไปปุ่มถัดไปทันที
   clearGlow();
  };
  hit.el.addEventListener('pointerdown',_glowHandler,{once:true});
 }

 /* ---- ลูกศร ▼ ชี้วัตถุบน canvas (คอม/โต๊ะเล่น/ตู้) — วาดเป็น DOM overlay ไม่ยุ่งกับ cache การวาด ----
    ทับ canvas โดยแปลงพิกัด backing-store (P/CW/CH) → CSS ผ่าน rect ของ #cv จึงไม่ต้องเดา DPR
    เดิน rAF เฉพาะตอนมีเป้า canvas เท่านั้น (ไม่มีเป้า = ไม่มีลูปเลย) */
 let _ptr=null,_ptrRAF=0,_ptrTok=null;
 function ensurePtr(){ if(_ptr&&document.body.contains(_ptr))return; _ptr=document.createElement('div'); _ptr.id='questPointer'; _ptr.textContent='▼'; document.body.appendChild(_ptr); }
 function tankOverlayOn(){ const ov=document.getElementById('ov'); return !!(ov&&ov.classList.contains('on')); }
 const isContest=o=>!!(o&&o.def&&(o.def.race||o.def.tug||o.def.eat||o.def.throwing||o.def.sumo));
 function canvasTarget(tok){
  const objs=G.objs||[];
  if(tok==='counter')   return objs.find(o=>o&&o._key==='counter');
  if(tok==='playtable') return objs.find(o=>o&&o.def&&o.def.playTable);
  /* ตู้แข่งก็ type==='tank' เหมือนกัน — 'anytank' (ให้อาหาร/ขัดตู้/ดูยีน) ต้องไม่ไปชี้ตู้แข่งเข้า */
  if(tok==='anytank')   return objs.find(o=>o&&o.type==='tank'&&!isContest(o)&&!(typeof isBreeder==='function'&&isBreeder(o))) || objs.find(o=>o&&o.type==='tank'&&!isContest(o)) || objs.find(o=>o&&o.type==='tank');
  if(tok==='breeder')   return objs.find(o=>o&&typeof isBreeder==='function'&&isBreeder(o));
  if(tok==='contest')   return objs.find(o=>o&&isContest(o));
  return null;
 }
 function objScreen(o){
  if(typeof P!=='function'||!o) return null;
  let fw=0,fh=0; try{ if(typeof oW==='function')fw=oW(o); if(typeof oH==='function')fh=oH(o); }catch(e){}
  const z=(typeof objTopZ==='function')?objTopZ(o):0;
  try{ return P(o.cx+fw/2, o.cy+fh/2, z); }catch(e){ return null; }
 }
 function ptrTick(){
  _ptrRAF=0;
  if(!_ptrTok){ if(_ptr)_ptr.style.display='none'; return; }
  const cv=document.getElementById('cv');
  const o=tankOverlayOn()?null:canvasTarget(_ptrTok);
  const p=o?objScreen(o):null;
  if(p&&cv){
   const r=cv.getBoundingClientRect(), W=(typeof CW!=='undefined'&&CW)||cv.width||1, H=(typeof CH!=='undefined'&&CH)||cv.height||1;
   const x=r.left+(p.x/W)*r.width, y=r.top+(p.y/H)*r.height;
   if(x>=r.left-4&&x<=r.right+4&&y>=r.top-40&&y<=r.bottom+4){ ensurePtr(); _ptr.style.left=x+'px'; _ptr.style.top=(y-16)+'px'; _ptr.style.display='block'; }
   else if(_ptr){ _ptr.style.display='none'; }
  } else if(_ptr){ _ptr.style.display='none'; }
  _ptrRAF=requestAnimationFrame(ptrTick);
 }
 function setPointer(tok){ if(tok===_ptrTok)return; _ptrTok=tok; if(tok){ ensurePtr(); if(!_ptrRAF)_ptrRAF=requestAnimationFrame(ptrTick); } else if(_ptr){ _ptr.style.display='none'; } }

 /* เดินตาม btn ตามลำดับที่เขียน: เป้า canvas ที่ "มีจริง" (และไม่ได้อยู่ในตู้) หรือปุ่ม DOM ที่ "มองเห็น" อันแรกชนะ */
 function updateQuestGlow(){
  const cq=G.questDone?null:QUESTS[G.questIndex];
  if(!cq||!cq.btn||_glowPressedQuest===cq.id){ clearGlow(); setPointer(null); return; }
  const list=Array.isArray(cq.btn)?cq.btn:[cq.btn];
  const ovOn=tankOverlayOn();
  for(const entry of list){
   if(typeof entry!=='string')continue;
   if(_isCanvasTok(entry)){
    if(!ovOn && canvasTarget(entry.slice(7))){ clearGlow(); setPointer(entry.slice(7)); return; }
   } else if(_visible(document.querySelector(entry))){
    setPointer(null); applyGlow(list,cq.id); return;
   }
  }
  clearGlow(); setPointer(null);
 }

 /* ชื่อระดับกล่อง — เผื่อ slug-box-shop.js ยังไม่โหลด/ระดับหลุดช่วง ก็ยังโชว์ "🎁 กล่องสุ่มทาก" เปล่า ๆ ได้ */
 function boxLabel(i){ try{ const b=(typeof SLUG_BOXES!=='undefined')&&SLUG_BOXES[i]; return b?' ('+b.name+')':''; }catch(e){ return ''; } }

 function setQuestCardHTML(html){
  if(card._questHTML===html)return;
  card.innerHTML=html;card._questHTML=html;bindToggle();
 }
 function renderCard(){
  updateQuestGlow();
  if(G.questDone){ card.style.display='none'; clearGlow(); setPointer(null); return; }
  const i=G.questIndex, q=QUESTS[i]; if(!q){ G.questDone=true; renderCard(); return; }
  if(questCollapsed){ setQuestCardHTML(questHeader('เควส '+(i+1)+' / '+QUESTS.length+' · '+q.t)); return; }
  const rw=[]; if(q.reward.tank)rw.push('🥚 ตู้เพาะพันธุ์ 1 ตู้'); if(q.reward.coin) rw.push('💰'+q.reward.coin); if(Number.isFinite(q.reward.box)) rw.push('🎁 กล่องสุ่มทาก'+boxLabel(q.reward.box)); if(q.reward.rep) rw.push('⭐'+q.reward.rep);
  setQuestCardHTML(questHeader('เควส '+(i+1)+' / '+QUESTS.length)
   +'<div style="font-weight:600;color:#f1c66d;margin-top:3px">'+q.t+'</div>'
   +'<div style="opacity:.9;margin-top:5px">'+q.h+'</div>'
   +(rw.length?'<div style="margin-top:7px;font-size:12px;opacity:.85">รางวัล: '+rw.join(' · ')+'</div>':''));
 }

 /* รางวัลเควสต้องได้ครั้งเดียวต่อเควส แม้ questIndex จะถูกย้อน/ย้ายลำดับ */
 function grant(q){
  if(typeof grantOnce!=='function'){ grantReward(q); return; }
  if(!grantOnce('quest-'+q.id, ()=>grantReward(q))) return;
 }
 function grantReward(q){
  const r=q.reward||{};
  if(r.tank){const def=CATALOG[r.tank];G.shelter.push({id:'o'+(G.seq++),type:def.kind,_key:r.tank,cx:0,cy:0,def,rot:0,slugs:[]});}
  if(r.coin) addCoin(r.coin);
  if(r.rep)  G.rep =(G.rep||0)+r.rep;
  if(Number.isFinite(r.box)&&typeof SLUG_BOXES!=='undefined'&&typeof rollBoxGenes==='function'){const _bx=SLUG_BOXES[r.box];if(_bx){const _has=(G.objs||[]).some(o=>o&&o._key==='counter');if(_has&&typeof slugDeliveries==='function')slugDeliveries().push({id:'quest-'+q.id+'-box',boxIndex:r.box,name:_bx.name,readyAt:Date.now()+1500,genes:rollBoxGenes(_bx),alerted:false});else if(Array.isArray(G.inv)&&typeof makeSlug==='function')G.inv.push(makeSlug(rollBoxGenes(_bx)));}}
  const parts=[]; if(r.tank)parts.push('ตู้เพาะพันธุ์ฟรี 1 ตู้'); if(r.coin)parts.push('+'+r.coin+' เหรียญ'); if(Number.isFinite(r.box))parts.push('กล่องสุ่มทาก'+boxLabel(r.box)+' 1 กล่อง'); if(r.rep)parts.push('+'+r.rep+' ชื่อเสียง');
  if(typeof toast==='function') toast('✅ เควสสำเร็จ: '+q.t+(parts.length?' · '+parts.join(' · '):'')+(r.txt?' · '+r.txt:''),'good');
  if(typeof syncHUD==='function') syncHUD();
  syncRep();
 }
 function advance(){
  const completed=QUESTS[G.questIndex];if(completed&&!G.questCompleted.includes(completed.id))G.questCompleted.push(completed.id);
  /* ผู้หวังดีนัดมาตอน "เปิดร้านรับลูกค้า" จริง ๆ แล้วหน่วง 2 นาที — ไม่ใช่นับถอยหลังจากตอนเปิดเกม
     เอาอันที่มาถึงก่อนระหว่างนัดนี้กับเส้นตาย 30 นาที (เส้นตายมีไว้กันคนที่ไม่ยอมเปิดร้านเลย) */
  if(completed&&completed.id==='tutorial-14'&&!G.welcomeGiftDone){
   const at=Date.now()+WELCOME_DELAY_MS;
   if(!(G.welcomeGiftAt>0)||at<G.welcomeGiftAt) G.welcomeGiftAt=at;
  }
  G.questIndex++;
  while(G.questIndex<QUESTS.length&&G.questCompleted.includes(QUESTS[G.questIndex].id))G.questIndex++;
  if(G.questIndex>=QUESTS.length) G.questDone=true; else G.questBase=snapshot();
  _glowPressedQuest=null;
  if(typeof saveGame==='function') saveGame();
  renderCard();
 }

 /* ---- นับการกระทำด้วย monkey-patch (ฟังก์ชันที่โหลดก่อน quests.js) ---- */
 function bump(k){ if(!G.stats)G.stats={}; G.stats[k]=(G.stats[k]||0)+1; }
 if(typeof foodPlace==='function'){ const _f=foodPlace; foodPlace=function(){ const r=_f.apply(this,arguments); if(r) bump('fed'); return r; }; }
 if(typeof startBreeding==='function'){ const _b=startBreeding; startBreeding=function(){ const r=_b.apply(this,arguments); if(r) bump('bred'); return r; }; }
 if(typeof orderSlugBox==='function'){ const _o=orderSlugBox; orderSlugBox=function(){ const r=_o.apply(this,arguments); if(r) bump('ordered'); return r; }; }
 if(typeof scrubTank==='function'){ const _s=scrubTank; scrubTank=function(o){
   const d0=(typeof tankHygiene==='function'&&o)?tankHygiene(o).dirt:null;
   const r=_s.apply(this,arguments);
   const d1=(typeof tankHygiene==='function'&&o)?tankHygiene(o).dirt:null;
   if(d0!=null&&d1!=null&&d1<d0-1e-6) bump('cleaned');
   return r;
 }; }
 /* ย้ายทาก + ทาสีพื้น/ผนัง (ฟังก์ชัน global โหลดก่อน quests.js) */
 if(typeof transferSlugs==='function'){ const _t=transferSlugs; transferSlugs=function(){ const r=_t.apply(this,arguments); if(r) bump('transferred'); return r; }; }
 if(typeof paintFloorTile==='function'){ const _pf=paintFloorTile; paintFloorTile=function(){ const r=_pf.apply(this,arguments); bump('painted'); return r; }; }
 if(typeof paintWallTile==='function'){ const _pw=paintWallTile; paintWallTile=function(){ const r=_pw.apply(this,arguments); bump('painted'); return r; }; }
 /* พ่อค้าเร่/รับเหมา: finishTrade รับ (id, accept) — ตรวจว่าเป็นข้อเสนอ o.sell/o.wholesale ก่อนเรียกของเดิม */
 if(typeof finishTrade==='function'){ const _ft=finishTrade; finishTrade=function(id,accept){
   let seller=false; try{ if(accept&&typeof TRADE_OFFERS!=='undefined'){ const o=TRADE_OFFERS.find(o=>o&&o.id===id); if(o&&(o.sell||o.wholesale)) seller=true; } }catch(e){}
   const r=_ft.apply(this,arguments); if(seller) bump('sellerTrade'); return r;
 }; }

 /* ---- hook ที่ต้องรอไฟล์โหลดทีหลัง (เรียกซ้ำได้ ไม่ผูกซ้ำ) ---- */
 const _hooks={};
 function observeDialogOpen(id,stat){
  const el=document.getElementById(id); if(!el)return false; if(el._questObs)return true; el._questObs=true;
  try{ new MutationObserver(()=>{ if(el.open) bump(stat); }).observe(el,{attributes:true,attributeFilter:['open']}); }catch(e){}
  return true;
 }
 function installHooks(){
  if(!_hooks.comp) _hooks.comp=observeDialogOpen('counterComputer','compOpen');   // เปิดคอมประจำร้าน (cat-seller.js สร้าง dialog ตอนโหลด — โหลดก่อน quests.js)
  if(!_hooks.play && typeof openPlayTable==='function'){ const _p=openPlayTable; openPlayTable=function(){ const r=_p.apply(this,arguments); bump('played'); return r; }; _hooks.play=true; }   // เปิดโต๊ะเล่น (play-table.js โหลดหลัง quests.js)
  /* โหมดซ้อม (slug-practice.js โหลดหลัง quests.js) — นับตอน "กดเริ่มซ้อม" จริง ไม่ใช่แค่เปิดหน้าต่างเลือกทาก
     จึงห่อ onStart ที่ตู้แต่ละโหมดส่งเข้ามา แทนที่จะห่อ pick เฉย ๆ */
  if(!_hooks.practice && typeof SlugPractice==='object' && SlugPractice && typeof SlugPractice.pick==='function'){
   const _pk=SlugPractice.pick;
   SlugPractice.pick=function(opt){
    if(opt&&typeof opt.onStart==='function'){ const _os=opt.onStart; opt=Object.assign({},opt,{onStart:function(){ bump('practiced'); return _os.apply(this,arguments); }}); }
    return _pk.call(this,opt);
   };
   _hooks.practice=true;
  }
  /* ติด id ให้ปุ่ม nav (context-ui.js สร้างไม่มี id) เพื่อชี้ glow ได้ — ข้อความปุ่มอาจมี "(n)" ต่อท้าย จึงใช้ startsWith */
  if(!_hooks.navtag){ try{ const map=[[/^ของที่เก็บ/,'navShelf'],[/^ข้อเสนอ/,'navOffers'],[/^คลังทาก/,'navInv']]; const bs=[...document.querySelectorAll('.context-nav button')]; if(bs.length){ for(const b of bs){ const m=map.find(x=>x[0].test(b.textContent||'')); if(m&&!b.id)b.id=m[1]; } _hooks.navtag=true; } }catch(e){} }
  /* ติด data-cat ให้แท็บหมวดในด็อคก่อสร้าง (tank-decor-ui.js โหลดหลัง quests.js) เพื่อชี้ glow ทีละสเต็ป */
  if(!_hooks.tabtag){ try{ const tb=document.querySelectorAll('#floorBuildDock .decorTabs button'); if(tb.length){ tb.forEach(b=>{ if(!b.dataset.cat)b.dataset.cat=(b.textContent||'').trim(); }); _hooks.tabtag=true; } }catch(e){} }
  /* ติด id ให้หัวแผงพับในตู้ (tank-sidebar.js) เพื่อชี้ glow ต่อเข้าไปในโหมดตู้ */
  if(!_hooks.feedtag){ try{ const fb=document.getElementById('foodBar'), fs=fb&&fb.closest('details')&&fb.closest('details').querySelector('summary'); if(fs){ if(!fs.id)fs.id='ovFeedBtn'; _hooks.feedtag=true; } }catch(e){} }
  if(!_hooks.breedtag){ try{ const bp=document.getElementById('breederPanel'), bs=bp&&bp.closest('details')&&bp.closest('details').querySelector('summary'); if(bs){ if(!bs.id)bs.id='ovBreedBtn'; _hooks.breedtag=true; } }catch(e){} }
 }
 /* ---- การ์ดยีน: สำรวจเอาในลูปวินาที ----
    การ์ดวาดลงบน canvas ไม่ใช่ DOM และ geneCardFor เป็น let ระดับไฟล์ใน tank-view.js
    (patch ไม่ได้ ดักอีเวนต์ก็ไม่มี) จึงอ่านค่ามันตรง ๆ แทน
    ⚠️ นับ "ทุกครั้งที่เปลี่ยนตัวที่เลือก" ไม่ใช่นับครั้งเดียวตลอดกาล — ไม่งั้นคนที่เผลอคลิกทากดู
    ก่อนจะมาถึงเควสนี้ จะได้ questBase.geneSeen=1 เท่ากับค่าปัจจุบัน แล้วเงื่อนไขค้างถาวร */
 let _geneLast=null;
 function pollGeneCard(){
  try{
   const s=(typeof geneCardFor!=='undefined')?geneCardFor:null, id=(s&&s.id)||null;
   if(!id){ _geneLast=null; return; }
   if(id!==_geneLast){ _geneLast=id; bump('geneSeen'); }
  }catch(e){}
 }

 /* ---- ผลการแข่ง: ให้ตู้แข่งบอกกลับมาเอง ----
    ฝั่ง slug-race/tug/eat/throw.js เก็บผลไว้ใน a.won / a.rank ซึ่งเป็นตัวแปรภายใน IIFE
    มองจากตรงนี้ไม่เห็นเลย จึงเติมบรรทัดเรียกกลับในไฟล์พวกนั้นแทนการพยายามดักเอง
    ชนะทัวร์นาเมนต์นับเป็น "ชนะการแข่ง" ด้วย เพราะแมตช์ในสายไม่ได้ผ่าน showResult() ปกติ */
 window.questContestWin=function(){ bump('contestWin'); if(typeof saveGame==='function')saveGame(); };
 window.questTourWin   =function(){ bump('tourWin'); bump('contestWin'); if(typeof saveGame==='function')saveGame(); };

 /* พ่อค้าเร่/คนรับเหมา: ปลดล็อกเมื่อถึงเควส "ค้าขายกับพ่อค้าเร่" (tutorial-23) เป็นต้นไป — people.js เช็กก่อน spawn */
 window.sellerSystemUnlocked=function(){
  try{
   if(G.questDone) return true;
   if(Array.isArray(G.questCompleted)&&G.questCompleted.includes('tutorial-23')) return true;
   const cq=QUESTS[G.questIndex];
   return !!(cq&&cq.id==='tutorial-23');
  }catch(e){ return true; }   // พลาดก็ปล่อยมาปกติ กัน soft-lock
 };

 /* ---- ของขวัญต้อนรับร้านใหม่ (ครั้งเดียว หลังเริ่ม ~3 นาที) ---- */
 function welcomeGift(){
  if(G.welcomeGiftDone) return;
  if(typeof grantOnce==='function' && !grantOnce('welcome-gift',()=>giveWelcomeGift())) { G.welcomeGiftDone=true; return; }
  if(typeof grantOnce==='function'){ G.welcomeGiftDone=true; if(typeof saveGame==='function')saveGame(); return; }
  giveWelcomeGift();
 }
 function giveWelcomeGift(){
  G.welcomeGiftDone=true;
  const greeting='สวัสดีเจ้าของร้านใหม่! เห็นเพิ่งเปิดร้านทากทะเล สงสารคนเปิดร้านใหม่ เลยส่งทากมาให้ 2 ตัวเป็นของขวัญต้อนรับ เผื่อช่วยตั้งตัวช่วงแรก ๆ อ่ะ ๆ ขอให้ขายดีนะ 🐚 — ร้านทากข้างบ้าน';
  if(typeof receiveComputerMessage==='function') receiveComputerMessage({type:'online', id:'welcome-gift', title:'ของขวัญต้อนรับร้านใหม่ 🎁', body:greeting});
  const box=(typeof SLUG_BOXES!=='undefined')?SLUG_BOXES[0]:null;   // ระดับ 1 (ปกติ)
  const hasCounter=(G.objs||[]).some(o=>o&&o._key==='counter');
  if(box && typeof slugDeliveries==='function' && typeof rollBoxGenes==='function' && hasCounter){
   for(let i=0;i<2;i++) slugDeliveries().push({id:'welcome-gift-'+i, boxIndex:0, name:box.name+'(ของขวัญ)', readyAt:Date.now(), genes:rollBoxGenes(box), alerted:true});
   if(typeof toast==='function') toast('📬 มีคนส่งของขวัญต้อนรับมาให้! เปิดกล่องของขวัญที่เคาน์เตอร์ได้เลย','good');
  } else {
   for(let i=0;i<2;i++){ const g=(box&&typeof rollBoxGenes==='function')?rollBoxGenes(box):undefined; G.inv.push(makeSlug(g)); }
   if(typeof toast==='function') toast('📬 มีคนส่งทากต้อนรับมาให้ 2 ตัว! เก็บไว้ในคลังแล้ว','good');
  }
  if(typeof saveGame==='function') saveGame(); if(typeof syncHUD==='function') syncHUD();
 }

 /* ---- ลูปเช็ก ---- */
 installHooks(); syncRep(); renderCard();
 setInterval(function(){
  installHooks(); pollGeneCard();
  syncRep(); updateCardVisibility();
  if(!G.welcomeGiftDone && G.welcomeGiftAt>0 && Date.now()>=G.welcomeGiftAt) welcomeGift();
  if(G.questDone){ renderCard(); return; }
  const q=QUESTS[G.questIndex];
  if(!q){ G.questDone=true; renderCard(); return; }
  if(typeof q.force==='function'){ try{ q.force(); }catch(e){} }   // บังคับระบบสุ่มให้โผล่ตอนถึงเควสนี้
  let ok=false; try{ ok=q.cond(G.questBase||{}); }catch(e){ ok=false; }
  if(ok){ grant(q); advance(); } else renderCard();
 },1000);
})();
