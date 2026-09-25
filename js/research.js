/* ============================================================
   research.js — ระบบวิจัยบนโต๊ะวิจัย (ปลดล็อกด้วย "ทาก" ไม่ใช่เงิน)

   สองสายวิจัย สายละ 5 ขั้น ทำไล่จากขั้น 1 เท่านั้น (ข้ามไม่ได้):
     · cap   — ขยายเพดานตู้เพาะพันธุ์ 5 → 10 ตู้ (ขั้นละ +1)
     · price — ส่วนลดราคาของ (3 ขั้นแรกลดเฉพาะตู้เพาะพันธุ์ · 2 ขั้นท้ายลดของทุกอย่าง)

   ⚠️ กดวิจัย = "ทากที่ใช้หายไปจริง" (ผู้เล่นกำหนด 2026-09-21) มีหน้ายืนยันรายชื่อก่อนเสมอ
   ⚠️ ทากที่กดถูกใจ ♥ ไม่ถูกหยิบไปใช้เด็ดขาด — กันเผลอกินตัวเก่งของผู้เล่น
   ⚠️ เทียบ "ยีนกำเนิด" (s.genes) ไม่ใช่ยีนที่รวมบัฟอาหาร (foodGenes)
      ไม่งั้นป้อนอาหารดันหงอนขึ้นชั่วคราวแล้วเคลมรางวัลได้
   ⚠️ ชื่อสีมาจาก SlugEngine.colorName() ตัวเดียวกับที่การ์ดยีน/ตลาดโลกโชว์
      ผู้เล่นเห็น "เขียวมิ้นต์" บนการ์ดตัวไหน ตัวนั้นใช้ได้ที่นี่แน่นอน
   ============================================================ */
const Research=(()=>{
 /* ---------- ผลของแต่ละขั้น (ดัชนี = จำนวนขั้นที่ทำสำเร็จ) ----------
    ส่วนลดคิดแบบ "บวกสะสม" ตามที่ผู้เล่นกำหนด 2026-09-21
      ตู้เพาะพันธุ์: 10 → 30 → 60%  ·  ของทุกอย่าง: 10 → 50%
    ตู้เพาะพันธุ์โดนทั้งสองส่วนลดคูณกัน (ครบทุกขั้น = 0.4 × 0.5 = จ่าย 20% ของราคาเต็ม) */
 const BREEDER_DISC=[0,0.10,0.30,0.60,0.60,0.60];
 const SHOP_DISC   =[0,0,0,0,0.10,0.50];

 /* ---------- โจทย์ของแต่ละขั้น ----------
    need = กลุ่มเงื่อนไข (ต้องครบทุกกลุ่ม) · ทาก 1 ตัวนับให้กลุ่มเดียว
      body  ชื่อสีลำตัว (ไม่ใส่ = สีอะไรก็ได้)
      gill  ชื่อสีหงอนเหงือก
      gills จำนวนก้านหงอน (2/3/5/6/8/9 เท่านั้น — ดู LADDER ใน slug-engine.js)
      n     จำนวนตัว                                                            */
 const LINES=[
  {id:'cap', icon:'🥚', color:'#6fd0a8', name:'ขยายเพดานตู้เพาะพันธุ์',
   note:'สำเร็จ 1 ขั้น = วางตู้เพาะพันธุ์ได้เพิ่มอีก 1 ตู้ (5 → 10 ตู้) · ราคาตู้ยังไต่ขึ้นตามสูตรเดิม',
   tiers:[
    {reward:'วางตู้เพาะพันธุ์ได้ 6 ตู้',  need:[{body:'เขียวมิ้นต์', gills:6, n:3}]},
    {reward:'วางตู้เพาะพันธุ์ได้ 7 ตู้',  need:[{body:'เลือดหมูเข้ม', gill:'เขียวมิ้นต์', n:5}]},
    {reward:'วางตู้เพาะพันธุ์ได้ 8 ตู้',  need:[{body:'ม่วงหมอง', gills:8, n:8}]},
    {reward:'วางตู้เพาะพันธุ์ได้ 9 ตู้',  need:[{body:'ดำด้าน', gill:'ม่วงหมอง', gills:9, n:10}]},
    {reward:'วางตู้เพาะพันธุ์ได้ 10 ตู้', need:[{body:'ทอง', gill:'ดำด้าน', gills:9, n:15}]}
   ]},
  {id:'price', icon:'🏷️', color:'#e8b65a', name:'ลดราคาของ',
   note:'สามขั้นแรกลดเฉพาะตู้เพาะพันธุ์ · สองขั้นท้ายลดของทุกชิ้นในแผงสร้าง (รวมของตกแต่งในตู้และประตู)',
   tiers:[
    {reward:'ตู้เพาะพันธุ์ถูกลง 10%',            need:[{body:'ขาว', gill:'เลือดหมูเข้ม', n:10}]},
    {reward:'ตู้เพาะพันธุ์ถูกลงอีก 20% (รวม 30%)', need:[{body:'ขาว', gill:'ม่วงหมอง', n:30}]},
    {reward:'ตู้เพาะพันธุ์ถูกลงอีก 30% (รวม 60%)', need:[{body:'ขาว', gill:'ดำด้าน', n:50}]},
    {reward:'ของทุกอย่างในร้านถูกลง 10%', need:[
      {body:'ขาว', gill:'ทอง', n:10},{body:'ขาว', gill:'ดำด้าน', n:20},
      {body:'ขาว', gill:'ฟ้าพาสเทล', n:10},{body:'ขาว', gill:'ส้มพาสเทล', n:10}]},
    {reward:'ของทุกอย่างในร้านถูกลง 50%', need:[
      {body:'ขาว', gill:'ทอง', gills:9, n:10},{body:'ขาว', gill:'ดำด้าน', gills:9, n:20},
      {body:'ขาว', gill:'ฟ้าพาสเทล', gills:9, n:10},{body:'ขาว', gill:'ส้มพาสเทล', gills:9, n:10}]}
   ]}
 ];
 const MIN_KEEP=2;            // ต้องเหลือทากในร้านอย่างน้อยเท่านี้เสมอ (กฎเดียวกับตลาดโลก)

 /* ---------- สถานะ ---------- */
 const clampTier=v=>Math.max(0,Math.min(5,Math.round(+v||0)));
 function st(){
  const r=G.research&&typeof G.research==='object'?G.research:(G.research={});
  r.cap=clampTier(r.cap);r.price=clampTier(r.price);
  if(!r.dep||typeof r.dep!=='object')r.dep={};
  return r;
 }
 /* ---------- ทากที่ "ส่งเข้าไปก่อน" ----------
    ⚠️ 2026-09-24 ผู้เล่น: "ทำปุ่มให้เลือกทากที่จะเอาเข้าไปใส่ ส่งเข้าไปก่อนได้ เผื่อคนไม่ค่อยมีพื้นที่จะได้ผสมไปส่งไป"
    G.research.dep[สาย][กลุ่มโจทย์] = จำนวนที่ส่งแล้ว ของ "ขั้นถัดไป" ของสายนั้นเท่านั้น (ทากที่ส่ง = หายจากร้านทันที)
    วิจัยขั้นนั้นสำเร็จ → ล้างเป็นศูนย์ · ส่งครบทุกกลุ่ม = วิจัยสำเร็จเองทันที */
 function tierOwner(tier){for(const l of LINES){const i=l.tiers.indexOf(tier);if(i>=0)return {id:l.id,i};}return null;}
 function sentFor(tier,k){
  const o=tierOwner(tier);if(!o||o.i!==doneCount(o.id))return 0;
  const v=(st().dep[o.id]||[])[k];return Math.max(0,Math.min(tier.need[k].n,Math.floor(+v||0)));
 }
 function removeSlug(s){
  for(const o of [...(G.objs||[]),...(G.shelter||[])]){if(!o||o.type!=='tank')continue;const i=(o.slugs||[]).indexOf(s);if(i>=0){o.slugs.splice(i,1);break;}}
  const j=(G.inv||[]).indexOf(s);if(j>=0)G.inv.splice(j,1);
  if(typeof selSlug!=='undefined'&&selSlug===s)selSlug=null;
  if(typeof heldSlug!=='undefined'&&heldSlug===s)heldSlug=null;
 }
 const capBonus=()=>st().cap;
 const breederDiscount=()=>BREEDER_DISC[st().price];
 const shopDiscount=()=>SHOP_DISC[st().price];
 /* ตัวคูณราคา — 'breeder' โดนทั้งสองส่วนลด · 'shop' โดนเฉพาะส่วนลดรวม */
 function priceMul(kind){
  const shop=1-shopDiscount();
  return kind==='breeder'?(1-breederDiscount())*shop:shop;
 }

 /* ---------- อ่านลักษณะทากจากยีนกำเนิด ----------
    ⚠️ 2026-09-21 ผู้เล่นกำหนด: สีต้องเข้าเป้า ±COLOR_TOL "ไม่ใช่ชื่อสีตรงกันก็พอ"
       เดิมตัดสินด้วย SlugEngine.colorName() ซึ่งปัดเข้าหาหลักสีที่ใกล้สุด (หลักห่างกัน 50)
       = ยอมรับกว้างถึง ±25 · ทาก 278 กับ 322 ชื่อ "เขียวมิ้นต์" เหมือนกันแต่สีต่างกันชัด
       ตอนนี้เทียบ "ตัวเลขยีน" ตรง ๆ กับหลักสี (ดำ 0 · ม่วง 50 · แดง 100 … ทอง 400)
       ตัวเลขนี้คือค่าเดียวกับช่อง "สีลำตัว / สีหงอนเหงือก" บนการ์ดยีน ผู้เล่นเทียบเองได้
    ⚠️ จำนวนหงอนต้องตรงเป๊ะ (ผู้เล่นย้ำ 2026-09-21) — nGill เป็นค่าไม่ต่อเนื่อง 2/3/5/6/8/9 อยู่แล้ว */
 const COLOR_TOL=10;
 const genesOf=s=>(s&&s.genes)||{};
 const _colorGene={};
 function colorGene(name){                       // ชื่อสี → เลขยีนของหลักสีนั้น (อ่านจากตารางของเอนจิน ไม่ฮาร์ดโค้ดซ้ำ)
  if(name in _colorGene)return _colorGene[name];
  const a=((SlugEngine&&SlugEngine.BODY_ANCH)||[]).find(x=>x.n===name);
  return (_colorGene[name]=a?a.g:null);
 }
 const nearColor=(v,name)=>{const g=colorGene(name);return g!=null&&Number.isFinite(v)&&Math.abs(v-g)<=COLOR_TOL;};
 function bodyName(s){try{return SlugEngine.colorName(genesOf(s).mainC);}catch(e){return '';}}
 function gillName(s){try{return SlugEngine.colorName(genesOf(s).accC);}catch(e){return '';}}
 function gillCount(s){try{return SlugEngine.derived(genesOf(s)).nGill;}catch(e){return null;}}
 const matches=(s,req)=>(!req.body||nearColor(genesOf(s).mainC,req.body))
                      &&(!req.gill||nearColor(genesOf(s).accC,req.gill))
                      &&(!req.gills||gillCount(s)===req.gills);

 /* สีตัวอย่างสำหรับป้ายสี — ใช้โทนกลาง (M) จากตารางเดียวกับที่เอนจินย้อมทากจริง */
 function swatch(name,gill){
  const table=(gill?SlugEngine.GILL_ANCH:SlugEngine.BODY_ANCH)||[];
  const a=table.find(x=>x.n===name);
  return a?'rgb('+a.M.join(',')+')':'#7d8a88';
 }

 /* ---------- คลังทากที่ "หยิบมาใช้ได้" ---------- */
 function pool(){
  const tanks=[...(G.objs||[]),...(G.shelter||[])].filter(o=>o&&o.type==='tank');
  const out=[];
  for(const o of tanks)for(const s of (o.slugs||[]))out.push({slug:s,tank:o});
  for(const s of (G.inv||[]))out.push({slug:s,tank:null});
  return out.filter(e=>{
   const s=e.slug;if(!s)return false;
   if(s.favorite)return false;                                                   // ♥ = ห้ามแตะ
   if(s.breedZone)return false;                                                  // อยู่ในโซนผสมพันธุ์
   if(e.tank&&e.tank.breeding&&(e.tank.breeding.parents||[]).includes(s))return false;
   if(typeof TRADE_OFFERS!=='undefined'&&TRADE_OFFERS.some(t=>t&&t.slug===s))return false;   // ลูกค้ากำลังขอซื้ออยู่
   if(typeof PlayTable==='object'&&PlayTable&&PlayTable.isOpen&&PlayTable.isOpen()&&PlayTable.slug===s)return false;
   return true;
  });
 }
 /* ทากทั้งร้าน (รวมตัวที่หยิบไม่ได้) — ใช้เช็กกฎ "ต้องเหลืออย่างน้อย 2 ตัว" */
 function totalSlugs(){
  const tanks=[...(G.objs||[]),...(G.shelter||[])].filter(o=>o&&o.type==='tank');
  return tanks.reduce((n,o)=>n+((o.slugs||[]).length),0)+((G.inv||[]).length);
 }

 /* จับคู่ทากเข้ากับโจทย์ทีละกลุ่ม — ตัวหนึ่งนับให้กลุ่มเดียว
    เรียง "ตัวในคลังก่อน แล้วค่อยตัวในตู้" เพื่อไม่ไปรื้อตู้ที่จัดไว้สวย ๆ ถ้าไม่จำเป็น */
 function plan(tier){
  const list=pool(),used=new Set(),groups=[];
  (tier.need||[]).forEach((req,k)=>{
   const sent=sentFor(tier,k),left=req.n-sent;                     // ส่งเข้าไปก่อนแล้ว = ต้องการจากร้านน้อยลง
   const hits=list.filter(e=>!used.has(e.slug)&&matches(e.slug,req)).sort((a,b)=>(a.tank?1:0)-(b.tank?1:0));
   const take=hits.slice(0,left);
   take.forEach(e=>used.add(e.slug));
   groups.push({req,have:hits.length,take,sent,left,hits});
  });
  const take=groups.flatMap(g=>g.take);
  return {groups,take,enough:groups.every(g=>g.take.length>=g.left)};
 }

 function lineOf(id){return LINES.find(l=>l.id===id);}
 const doneCount=id=>st()[id];
 const nextTier=id=>{const l=lineOf(id),n=doneCount(id);return n<l.tiers.length?l.tiers[n]:null;};

 /* ---------- ลงมือวิจัย ---------- */
 function commit(id){
  const line=lineOf(id),tier=nextTier(id);
  if(!tier)return false;
  const p=plan(tier);
  if(!p.enough){toast('ทากยังไม่ครบตามโจทย์','bad');return false;}
  if(totalSlugs()-p.take.length<MIN_KEEP){toast('ต้องเหลือทากในร้านอย่างน้อย '+MIN_KEEP+' ตัว','bad');return false;}
  const sent=p.groups.reduce((n,g)=>n+g.sent,0);
  for(const e of p.take)removeSlug(e.slug);
  st()[id]=doneCount(id)+1;
  st().dep[id]=[];                                       // ของที่ส่งไว้ถูกใช้กับขั้นนี้หมดแล้ว
  saveGame();
  if(typeof syncHUD==='function')syncHUD();
  if(typeof buildShop==='function')buildShop();          // ป้ายราคาในแผงสร้างต้องขยับทันทีหลังได้ส่วนลด
  if(typeof playNotificationSound==='function')playNotificationSound('success');
  toast('วิจัยสำเร็จ · '+tier.reward+' (ใช้ทาก '+(p.take.length+sent)+' ตัว)','good');
  return true;
 }
 /* ส่งทากที่เลือกเข้ากลุ่มโจทย์ k ของขั้นถัดไป — ตรวจซ้ำทุกตัว (ต้องอยู่ในคลังที่หยิบได้ + ตรงโจทย์ + ไม่เกินที่ขาด) */
 function deposit(id,k,slugs){
  const tier=nextTier(id);if(!tier||!tier.need[k])return false;
  const req=tier.need[k],left=req.n-sentFor(tier,k);
  const ok=new Set(pool().map(e=>e.slug));
  const list=[...new Set(slugs)].filter(s=>ok.has(s)&&matches(s,req)).slice(0,left);
  if(!list.length){toast('ไม่มีทากที่ส่งได้','bad');return false;}
  if(totalSlugs()-list.length<MIN_KEEP){toast('ต้องเหลือทากในร้านอย่างน้อย '+MIN_KEEP+' ตัว','bad');return false;}
  for(const s of list)removeSlug(s);
  const d=st().dep[id]||(st().dep[id]=[]);d[k]=sentFor(tier,k)+list.length;
  if(tier.need.every((r,j)=>sentFor(tier,j)>=r.n))return commit(id);   // ส่งครบทุกกลุ่ม = สำเร็จเลย
  saveGame();
  if(typeof syncHUD==='function')syncHUD();
  toast('ส่งทากเข้าวิจัยแล้ว '+list.length+' ตัว · กลุ่มนี้เหลืออีก '+(req.n-sentFor(tier,k))+' ตัว','good');
  return true;
 }

 /* ============================================================
    หน้าต่างโต๊ะวิจัย
    ============================================================ */
 const dialog=document.createElement('dialog');dialog.id='researchView';dialog.setAttribute('aria-label','โต๊ะวิจัย');
 document.body.append(dialog);
 /* ---------- หน้าตา: "แผนที่วิจัย" ----------
    ⚠️ 2026-09-24 ผู้เล่น: "ออกแบบ UI โต๊ะวิจัยใหม่ทั้งหมด ให้ดูเป็นแมพ แบ่งเป็นสายชัดเจน"
       + "ไม่จำเป็นต้องฟิตในหน้าเดียว เลื่อนได้ สายไปทางขวา"
    แต่ละสาย = เลนแนวนอนสีของตัวเอง · แต่ละขั้น = สถานีบนเส้นทาง ต่อกันด้วยราง (ผ่านแล้ว = รางสีเต็ม)
    ป้ายชื่อสายติดซ้าย (sticky) ตอนเลื่อนแผนที่ไปทางขวา · กดสถานี = รายละเอียด + ปุ่มวิจัยด้านล่างแผนที่
    วาดใหม่เฉพาะตอนกด/เปิด (DOM ล้วน ไม่มีลูปทุกเฟรม ไม่มีแอนิเมชันค้าง) */
 document.head.append(Object.assign(document.createElement('style'),{textContent:`
 #researchView{width:min(1080px,96vw);max-height:92dvh;padding:0;border:1px solid #b29a69;border-radius:18px;background:#10252a;color:#f0e8d7;overflow:hidden;box-shadow:0 24px 80px #0008}
 #researchView::backdrop{background:#09171bd9}
 #researchView header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 22px;background:#1c3639;border-bottom:1px solid #d8bd7a38}
 #researchView h2{margin:0;font-size:21px;font-weight:600}#researchView header small{display:block;color:#c2ac80;font-size:11px}
 #researchView .rsBody{padding:14px 22px 22px;overflow:auto;max-height:calc(92dvh - 64px)}
 #researchView .rsNow{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
 #researchView .rsNow b{background:#20383a;border:1px solid #4d6360;border-radius:999px;padding:5px 13px;font-size:12px;font-weight:500;color:#e9d7a6}
 #researchView .rsMap{position:relative;overflow-x:auto;overflow-y:hidden;border:1px solid #3c5553;border-radius:14px;
   background:radial-gradient(circle at 18% 30%,#1d4046 0,transparent 55%),radial-gradient(circle at 80% 85%,#1a3a36 0,transparent 50%),
   radial-gradient(circle,#ffffff10 1px,transparent 1.5px) 0 0/22px 22px,#0d2126;scrollbar-color:#5b726e #0d2126}
 #researchView .rsMapHint{font-size:11px;color:#8fa6a2;margin:0 0 6px;text-align:right}
 #researchView .rsLanes{display:grid;gap:4px;width:max-content;min-width:100%;padding:10px 0}
 #researchView .rsLane{display:flex;align-items:stretch;--lane:#6fd0a8}
 #researchView .rsLane+.rsLane{border-top:1px dashed #ffffff1c}
 #researchView .rsLaneHead{position:sticky;left:0;z-index:2;flex:none;width:190px;box-sizing:border-box;padding:14px 14px 14px 16px;
   background:#0d2126;display:flex;flex-direction:column;justify-content:center;gap:4px}
 #researchView .rsLaneHead::after{content:"";position:absolute;left:100%;top:0;bottom:0;width:26px;background:linear-gradient(90deg,#0d2126,#0d212600);pointer-events:none}
 #researchView .rsLaneHead .ico{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-size:21px;background:color-mix(in srgb,var(--lane) 22%,#10252a);border:1px solid var(--lane)}
 #researchView .rsLaneHead b{font-size:14px;font-weight:600;color:#f3ead4;line-height:1.35}
 #researchView .rsLaneHead small{font-size:11px;color:var(--lane)}
 #researchView .rsLaneHead .bar{height:5px;border-radius:9px;background:#ffffff14;overflow:hidden}
 #researchView .rsLaneHead .bar i{display:block;height:100%;background:var(--lane)}
 #researchView .rsStops{display:flex;align-items:center;gap:46px;list-style:none;margin:0;padding:16px 30px 16px 14px}
 #researchView .rsStop{position:relative;flex:none}
 #researchView .rsStop+.rsStop::before{content:'';position:absolute;right:100%;top:50%;width:46px;height:4px;margin-top:-2px;
   background:repeating-linear-gradient(90deg,#5d736f 0 7px,transparent 7px 12px)}
 #researchView .rsStop.reached::before{background:var(--lane);box-shadow:0 0 8px color-mix(in srgb,var(--lane) 60%,transparent)}
 #researchView .rsStop>.rsCard{display:flex;flex-direction:column;gap:6px;width:218px;min-height:132px;box-sizing:border-box;text-align:left;padding:11px 12px 11px;border-radius:14px;
   border:1px solid #4a605d;background:#16302f;color:#dfe8e4;font:inherit;cursor:pointer;transition:transform .12s,border-color .12s}
 #researchView .rsTop{display:flex;align-items:center;gap:8px}
 #researchView .rsBadge{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;background:#22383a;border:2px solid #5a6e6b;color:#c3d2cd}
 #researchView .rsStepNo{font-size:11px;color:#98aca8}
 #researchView .rsState{margin-left:auto;font-size:10.5px;padding:2px 8px;border-radius:999px;background:#ffffff10;color:#aebfbb;white-space:nowrap}
 #researchView .rsStopReward{font-size:13.5px;font-weight:600;line-height:1.4;color:#f2e2b8}
 #researchView .rsMini{display:flex;flex-wrap:wrap;gap:5px;margin-top:auto}
 #researchView .rsMini>span{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 7px;border-radius:7px;background:#0f2427;border:1px solid #3d5552;color:#cfdcd7}
 #researchView .rsStop.done>.rsCard{background:color-mix(in srgb,var(--lane) 14%,#16302f);border-color:color-mix(in srgb,var(--lane) 55%,#4a605d)}
 #researchView .rsStop.done .rsBadge{background:var(--lane);border-color:var(--lane);color:#10252a}
 #researchView .rsStop.done .rsState{background:color-mix(in srgb,var(--lane) 25%,transparent);color:#eafff3}
 #researchView .rsStop.open>.rsCard{border:2px solid var(--lane);background:#1b3a38;box-shadow:0 0 0 4px color-mix(in srgb,var(--lane) 18%,transparent),0 10px 24px #0006}
 #researchView .rsStop.open .rsBadge{border-color:var(--lane);color:var(--lane);background:#10252a}
 #researchView .rsStop.open.ready .rsState{background:#c6a459;color:#172b2d;font-weight:700}
 #researchView .rsStop.lock>.rsCard{opacity:.55;border-style:dashed}
 #researchView .rsStop.sel>.rsCard{outline:2px solid #f0cf87;outline-offset:3px}
 #researchView .rsDot{width:12px;height:12px;border-radius:50%;border:1px solid #0006;flex:none;box-sizing:border-box}
 #researchView .rsSlug{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:3px;object-fit:contain;pointer-events:none}
 /* สถานี: โจทย์หลายกลุ่มเรียงแถวเดียว การ์ดยืดกว้างตาม (แผนที่เลื่อนขวาได้อยู่แล้ว) */
 #researchView .rsStop>.rsCard{width:auto;min-width:218px}
 #researchView .rsMini{flex-wrap:nowrap}
 #researchView .rsMini>span{padding:2px 7px 2px 3px;cursor:help}
 #researchView .rsMini>span b{font-size:12px;color:#f2e2b8}
 #researchView .rsMini>.full{border-color:#7fc59a}#researchView .rsMini>.full b{color:#9fe6b5}
 #researchView .rsTip{position:fixed;z-index:10;max-width:280px;padding:8px 11px;border-radius:9px;background:#0a1a1d;border:1px solid #c9a35f;color:#f0e8d7;
   font-size:12px;line-height:1.6;white-space:pre-line;pointer-events:none;box-shadow:0 8px 22px #0009}
 #researchView .rsReqBar{display:flex;height:6px;border-radius:9px;background:#ffffff12;overflow:hidden}
 #researchView .rsReqBar .sent{background:var(--lane)}#researchView .rsReqBar .have{background:color-mix(in srgb,var(--lane) 35%,transparent)}
 #researchView .rsPickList{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px;max-height:240px;overflow:auto;padding-right:2px}
 #researchView .rsPickItem{display:flex;align-items:center;gap:8px;padding:4px 8px;border:1px solid #3d5552;border-radius:9px;background:#10252a;cursor:pointer}
 #researchView .rsPickItem.on{border-color:var(--lane);background:color-mix(in srgb,var(--lane) 12%,#10252a)}
 #researchView .rsPickItem input{accent-color:#c6a459;flex:none}
 #researchView .rsPickItem span{display:grid;min-width:0}#researchView .rsPickItem b{font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 #researchView .rsPickItem small{font-size:10.5px;color:#98aca8}
 #researchView .rsThumb{flex:none;width:48px;height:30px}
 #researchView .rsPickMore{grid-column:1/-1;color:#98aca8;font-size:11px}
 #researchView .rsSlug.sm{width:46px;height:30px;margin:-2px 0 -2px 0}
 #researchView .rsSlug.lg{width:80px;height:51px;margin:-6px 0 -6px -5px}
 #researchView .rsStop>.rsCard{cursor:default}
 #researchView .rsCardHint{font-size:10.5px;color:#98aca8}
 /* ชิปรูปทากที่กดได้ (ขั้นที่เปิดอยู่) */
 #researchView .rsMini .rsChip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 3px;border-radius:8px;border:1px solid var(--lane);
   background:color-mix(in srgb,var(--lane) 12%,#0f2427);color:inherit;font:inherit;font-size:11px;cursor:pointer;transition:transform .12s,background .12s}
 #researchView .rsMini .rsChip:hover{transform:translateY(-1px);background:color-mix(in srgb,var(--lane) 26%,#0f2427)}
 #researchView .rsMini .rsChip:focus-visible{outline:2px solid #f0cf87;outline-offset:2px}
 #researchView .rsMini .rsChip b{font-size:12px;color:#f2e2b8}
 /* หน้าเลือกทาก เด้งทับแผนที่ */
 #researchView .rsOverlay{position:fixed;inset:0;z-index:8;display:grid;place-items:center;padding:16px;background:#061114b3}
 #researchView .rsPick{width:min(640px,100%);max-height:min(620px,86dvh);display:flex;flex-direction:column;border:1px solid var(--lane);border-radius:16px;background:#132b2e;box-shadow:0 24px 70px #000a;overflow:hidden}
 #researchView .rsPickTop{display:flex;align-items:center;gap:12px;padding:14px 14px 12px 12px;border-bottom:1px solid #ffffff14;background:color-mix(in srgb,var(--lane) 10%,#132b2e)}
 #researchView .rsPickInfo{flex:1;min-width:0;display:grid;gap:4px}
 #researchView .rsPickInfo small{font-size:11px;color:var(--lane)}
 #researchView .rsPickInfo b{font-size:14px;font-weight:600;color:#f3ead4}
 #researchView .rsPickInfo>span{font-size:11.5px;color:#a7bdb8}
 #researchView .rsReqBar{display:flex;height:6px;border-radius:9px;background:#ffffff12;overflow:hidden}
 #researchView .rsReqBar .sent{background:var(--lane)}#researchView .rsReqBar .have{background:color-mix(in srgb,var(--lane) 40%,transparent)}
 #researchView .rsX{flex:none;align-self:flex-start;width:32px;height:32px;border-radius:9px;border:1px solid #5b706c;background:#10252a;color:#dfe8e4;font:inherit;cursor:pointer}
 #researchView .rsPickTools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px 6px}
 #researchView .rsPickTools span{font-size:12px;color:#a7bdb8;margin-right:auto}
 #researchView .rsPick button:not(.rsX){padding:7px 13px;border-radius:8px;border:1px solid #7d8f89;background:#26403f;color:#eee;font:inherit;font-size:12.5px;cursor:pointer}
 #researchView .rsPick button.warn{background:#a1493c;border-color:#d98a78;color:#fff;font-weight:700}
 #researchView .rsPick button[disabled]{opacity:.5;cursor:not-allowed}
 #researchView .rsPick .rsPickList{flex:1;min-height:80px;max-height:none;padding:6px 14px 10px}
 #researchView .rsEmpty{margin:0;padding:22px 16px;font-size:12.5px;color:#c9d6d2;line-height:1.7}
 #researchView .rsPickFoot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid #ffffff14;background:#10252a}
 #researchView .rsPickFoot small{flex:1;min-width:200px;font-size:11px;color:#9fb2ae}
 @media(prefers-reduced-motion:reduce){#researchView .rsMini .rsChip{transition:none}#researchView .rsMini .rsChip:hover{transform:none}}
 @media(max-width:700px){#researchView .rsBody{padding:12px}#researchView .rsLaneHead{width:128px;padding:12px 10px}#researchView .rsLaneHead b{font-size:12.5px}
   #researchView .rsStop>.rsCard{min-width:188px}#researchView .rsStops{gap:34px}#researchView .rsStop+.rsStop::before{width:34px}
   #researchView .rsOverlay{padding:8px}#researchView .rsPickList{grid-template-columns:1fr}}
 #researchView .rsRule{font-size:11.5px;line-height:1.7;color:#8fa6a2;border-left:3px solid #c9a35f55;padding:2px 0 2px 10px;margin-top:14px}
 `}));


 let sel=null;                           // {id,i} = สถานีที่เลือกดูอยู่
 let picking=null;                       // {id,k,chosen:Set} = กำลังเลือกทากส่งเข้ากลุ่มโจทย์ k

 function dot(name,gill){
  const s=document.createElement('i');s.className='rsDot';s.style.background=swatch(name,gill);
  if(gill){s.style.borderColor=swatch(name,true);s.style.background='transparent';s.style.borderWidth='4px';}
  s.title=(gill?'สีหงอน ':'สีตัว ')+name;
  return s;
 }
 /* ---------- รูปทากจริงของโจทย์ ----------
    ⚠️ 2026-09-24 ผู้เล่น: "ไอคอนเอาเป็นรูปทากจริงไหม จะได้เข้าใจง่ายกว่าเดิม" (เดิมเป็นจุดสี)
    วาดด้วย drawSlug() ตัวเดียวกับเกม: สีตัว/สีหงอนตรงหลักสี · จำนวนหงอนตามโจทย์ · ยีนอื่นกลาง ๆ
    ⚠️ อบ 1 ตัว ~45 ms — ห้ามอบทั้งหมดตอนเปิดหน้าต่าง: คืนจุดสีไปก่อน แล้วทยอยอบทีละตัวทุก 16 ms
       ครบคิวแล้ววาดหน้าต่างใหม่ครั้งเดียว · แคชเป็น dataURL ตามคีย์โจทย์ (โจทย์ตายตัว ~16 แบบ เพดาน ICON_MAX) */
 /* กรอบพอดีตัว: อาร์ตกินราว x ±0.83H · y -0.61H..+0.44H (วัดไว้ใน slug-codex.js) ที่ H=ICON_S */
 const ICON_S=62,ICON_W=Math.ceil(ICON_S*1.8),ICON_H=Math.ceil(ICON_S*1.14),ICON_MAX=40;
 const iconCache=new Map(),iconQueue=new Map();let iconPumping=false;
 const iconKey=req=>[req.body||'',req.gill||'',req.gills||''].join('|');
 function iconGenes(req){
  const body=req.body?colorGene(req.body):200;
  const gill=req.gill?colorGene(req.gill):body;                       // ไม่กำหนดสีหงอน = ใช้สีเดียวกับตัว
  const idx=req.gills?Math.max(0,SlugEngine.LADDER?SlugEngine.LADDER.indexOf(req.gills):[2,3,5,6,8,9].indexOf(req.gills)):0;
  return {bodyDepth:45,gillDepth:45,mainC:body,accC:gill,len:55,girth:50,gillLen:60,tentLen:50,vigor:60,
          gillN:Math.min(100,55+idx*10),spotN:30};                   // floor(|gillN-50|/10) = ขั้นใน LADDER
 }
 function bakeIcon(req){
  const c=document.createElement('canvas');c.width=ICON_W;c.height=ICON_H;
  try{
   const was=SlugEngine.ANIM;SlugEngine.ANIM=false;
   /* จุดยึดกลางภาพ — อาร์ตปัจจุบันวาด "รอบ" จุดยึด (บทเรียนจากสมุดบันทึก slug-codex.js) */
   SlugEngine.drawSlug(c.getContext('2d'),SlugEngine.slugParts(iconGenes(req),ICON_S),ICON_W/2,Math.round(ICON_S*.64),false,0,1,true,false,{});
   SlugEngine.ANIM=was;
  }catch(e){}
  return c.toDataURL();
 }
 function pumpIcons(){
  if(iconPumping)return;iconPumping=true;
  const step=()=>{
   const it=iconQueue.entries().next();
   if(it.done){iconPumping=false;if(dialog.open)render();return;}
   const [k,req]=it.value;iconQueue.delete(k);
   iconCache.set(k,bakeIcon(req));
   while(iconCache.size>ICON_MAX)iconCache.delete(iconCache.keys().next().value);
   setTimeout(step,16);
  };
  setTimeout(step,0);
 }
 function slugIcon(req,cls){
  const k=iconKey(req),url=iconCache.get(k);
  if(url){const img=document.createElement('img');img.className='rsSlug '+cls;img.src=url;img.alt='';img.draggable=false;return img;}
  if(!iconQueue.has(k)){iconQueue.set(k,req);pumpIcons();}
  const ph=document.createElement('span');ph.className='rsSlug rsSlugWait '+cls;   // ระหว่างรอ: จุดสีเดิม
  if(req.body)ph.append(dot(req.body,false));
  if(req.gill)ph.append(dot(req.gill,true));
  return ph;
 }
 /* ป้ายย่อบนสถานี: รูปทากตามโจทย์ + "ยังขาดกี่ตัว" — จำนวนก้านดูจากรูปได้แล้ว ไม่ต้องเขียนซ้ำ
    ⚠️ 2026-09-24 ผู้เล่น: "กินพื้นที่มากไป หลายตัวใส่แถวเดียวกันได้" + "ลดจำนวนในรูปลงไปด้วย" (= ส่งแล้วเลขลด) */
 /* ข้อความ hover — ⚠️ 2026-09-24 ผู้เล่น: "hover แล้วแสดงข้อมูลว่าต้องการอะไร" */
 function tipText(req,g){
  const lines=[specText(req),'ต้องการ '+req.n+' ตัว'];
  if(g)lines.push('ส่งแล้ว '+g.sent+' · ขาดอีก '+g.left+' · ในร้านมีตัวที่ใช้ได้ '+g.have);
  else lines.push('ยังไม่ถึงขั้นนี้ — นับจำนวนตอนปลดล็อก');
  return lines.join('\n');
 }
 /* ชิปของขั้นที่เปิดอยู่เป็น "ปุ่ม" — กดแล้วเด้งหน้าเลือกทากส่งเข้ากลุ่มนั้นเลย
    ⚠️ 2026-09-24 ผู้เล่น: ไม่เอาการ์ดรายละเอียดใต้แผนที่ "ให้กดที่ปุ่มทากแล้วจะเด้งหน้าเลือกทากได้เลย" */
 function miniChip(req,g,line,k){
  const left=g?g.left:req.n,live=!!(g&&left>0);
  const el=document.createElement(live?'button':'span');
  el.dataset.tip=tipText(req,g)+(live?'\nกดเพื่อเลือกทากส่งเข้าไป':'');
  if(live){el.type='button';el.className='rsChip';el.onclick=()=>{picking={id:line.id,k,chosen:new Set()};render();};}
  else el.tabIndex=-1;
  if(left<=0)el.classList.add('full');
  el.append(slugIcon(req,'sm'));
  const t=document.createElement('b');t.style.fontWeight='600';
  t.textContent=left<=0?'✓':'×'+left;
  el.append(t);return el;
 }
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
 function defaultSel(){
  const l=LINES.find(l=>doneCount(l.id)<l.tiers.length)||LINES[0];
  return {id:l.id,i:Math.min(doneCount(l.id),l.tiers.length-1)};
 }

 function renderMap(body,plans){
  const hint=el('p','rsMapHint','เลื่อนแผนที่ไปทางขวาเพื่อดูขั้นถัดไป →');
  const map=el('div','rsMap'),lanes=el('div','rsLanes');
  map.append(lanes);
  for(const line of LINES){
   const done=doneCount(line.id),total=line.tiers.length;
   const lane=el('section','rsLane');lane.style.setProperty('--lane',line.color);
   lane.setAttribute('aria-label','สาย'+line.name);
   const head=el('div','rsLaneHead');
   const ico=el('span','ico',line.icon);
   const bar=el('div','bar'),fill=el('i');fill.style.width=(done/total*100)+'%';bar.append(fill);
   head.append(ico,el('b',null,line.name),el('small',null,done+'/'+total+' ขั้น'+(done>=total?' · ครบแล้ว':'')),bar);
   const stops=el('ol','rsStops');
   line.tiers.forEach((tier,i)=>{
    const isDone=i<done,isOpen=i===done,p=isOpen?plans[line.id]:null;
    const li=el('li','rsStop '+(isDone?'done':isOpen?'open':'lock'));
    if(i<=done)li.classList.add('reached');
    if(isOpen&&p.enough)li.classList.add('ready');
    if(sel&&sel.id===line.id&&sel.i===i)li.classList.add('sel');
    const b=el('div','rsCard');
    const top=el('div','rsTop');
    top.append(el('span','rsBadge',isDone?'✓':isOpen?String(i+1):'🔒'),el('span','rsStepNo','ขั้น '+(i+1)),
     el('span','rsState',isDone?'สำเร็จแล้ว':isOpen?(p.enough?'ทากในร้านพอแล้ว':'ยังขาดทาก'):'ล็อกอยู่'));
    const mini=el('div','rsMini');tier.need.forEach((req,k)=>mini.append(miniChip(req,isOpen?p.groups[k]:null,line,k)));
    b.append(top,el('b','rsStopReward',tier.reward),mini);
    if(isOpen)b.append(el('small','rsCardHint','กดรูปทากเพื่อเลือกทากส่งเข้าไป'));
    li.append(b);stops.append(li);
   });
   lane.append(head,stops);lanes.append(lane);
  }
  body.append(hint,map);
  return map;
 }

 /* ---------- ส่งทากเข้าไปก่อน: แถวโจทย์ + ตัวเลือกทาก ---------- */
 function specText(req){
  const t=[];
  if(req.body)t.push('สีตัว '+req.body+' '+colorGene(req.body)+'±'+COLOR_TOL);
  if(req.gill)t.push('สีหงอน '+req.gill+' '+colorGene(req.gill)+'±'+COLOR_TOL);
  if(req.gills)t.push('หงอน '+req.gills+' ก้านเป๊ะ');
  return t.join(' · ')||'ทากตัวไหนก็ได้';
 }
 function thumb(s){
  const c=document.createElement('canvas');c.width=64;c.height=40;c.className='rsThumb';
  try{const spr=typeof slugSprite==='function'&&slugSprite(s);
   if(spr&&spr.c){const k=Math.min(60/spr.c.width,38/spr.c.height),w=spr.c.width*k,h=spr.c.height*k;c.getContext('2d').drawImage(spr.c,(64-w)/2,(40-h)/2,w,h);}}catch(e){}
  return c;
 }
 /* หน้าเลือกทาก (เด้งทับแผนที่) — เปิดจากชิปรูปทากของขั้นที่เปิดอยู่ · ส่งแล้วนับเข้ากลุ่มนั้นทันที
    ⚠️ ส่งครบทุกกลุ่ม = วิจัยสำเร็จเอง (deposit → commit) จึงไม่มีปุ่ม "เริ่มวิจัย" แยกอีกแล้ว */
 function pickerOverlay(plans){
  const line=lineOf(picking.id),tier=nextTier(picking.id),p=plans[picking.id];
  if(!line||!tier||!p||!p.groups[picking.k]||p.groups[picking.k].left<=0){picking=null;return null;}
  const k=picking.k,g=p.groups[k],req=g.req,max=g.left,chosen=picking.chosen;
  /* ผู้สมัครคิดใหม่จากคลังทั้งหมด (ไม่ใช่ g.hits ที่ plan กันตัวไว้ให้กลุ่มอื่นแล้ว) — ผู้เล่นเลือกเองได้ทุกตัวที่ตรงโจทย์ */
  const cands=pool().filter(e=>matches(e.slug,req)).sort((a,b)=>(a.tank?1:0)-(b.tank?1:0));
  for(const s of [...chosen])if(!cands.some(e=>e.slug===s))chosen.delete(s);
  const shade=el('div','rsOverlay');shade.style.setProperty('--lane',line.color);
  shade.onclick=e=>{if(e.target===shade){picking=null;render();}};
  const box=el('section','rsPick');box.setAttribute('role','dialog');box.setAttribute('aria-label','เลือกทากส่งเข้าวิจัย');
  const head=el('div','rsPickTop');
  const info=el('div','rsPickInfo');
  info.append(el('small',null,line.icon+' '+line.name+' · ขั้น '+(doneCount(line.id)+1)+' · '+tier.reward),el('b',null,specText(req)));
  const bar=el('div','rsReqBar'),a=el('i','sent'),h=el('i','have');
  a.style.width=(g.sent/req.n*100)+'%';h.style.width=(Math.min(max,chosen.size)/req.n*100)+'%';bar.append(a,h);
  info.append(bar,el('span',null,'ส่งแล้ว '+g.sent+'/'+req.n+' · เลือกอยู่ '+chosen.size+' · ขาดอีก '+max+' ตัว'));
  const x=el('button','rsX','✕');x.type='button';x.setAttribute('aria-label','ปิด');x.onclick=()=>{picking=null;render();};
  head.append(slugIcon(req,'lg'),info,x);box.append(head);

  if(!cands.length){
   box.append(el('p','rsEmpty','ยังไม่มีทากที่ตรงโจทย์ในร้าน (ทากที่กดถูกใจ ♥ / อยู่ในโซนผสม / ลูกค้ากำลังขอซื้อ ไม่นับ) — เพาะเพิ่มแล้วกลับมาใหม่'));
  }else{
   const tools=el('div','rsPickTools');
   const auto=el('button',null,'เลือกให้ '+Math.min(max,cands.length)+' ตัว (คลังก่อน)');auto.type='button';
   auto.onclick=()=>{chosen.clear();cands.slice(0,max).forEach(e=>chosen.add(e.slug));render();};
   const clear=el('button',null,'ล้าง');clear.type='button';clear.disabled=!chosen.size;clear.onclick=()=>{chosen.clear();render();};
   tools.append(el('span',null,'มีตัวที่ตรงโจทย์ '+cands.length+' ตัว'),auto,clear);box.append(tools);
   const list=el('div','rsPickList');
   for(const e of cands.slice(0,120)){
    const on=chosen.has(e.slug),item=el('label','rsPickItem'+(on?' on':''));
    const cb=el('input');cb.type='checkbox';cb.checked=on;cb.disabled=!on&&chosen.size>=max;
    cb.onchange=()=>{cb.checked?chosen.add(e.slug):chosen.delete(e.slug);render();};
    const gn=genesOf(e.slug),nm=typeof SlugBrowser==='object'&&SlugBrowser.name?SlugBrowser.name(e.slug):String(e.slug.id);
    const txt=el('span');txt.append(el('b',null,nm),el('small',null,'ตัว '+Math.round(gn.mainC)+' · หงอน '+Math.round(gn.accC)+' · '+gillCount(e.slug)+' ก้าน · '+(e.tank?e.tank.def.name:'คลังทาก')));
    item.append(cb,thumb(e.slug),txt);list.append(item);
   }
   if(cands.length>120)list.append(el('small','rsPickMore','แสดง 120 ตัวแรก จาก '+cands.length+' ตัว'));
   box.append(list);
  }
  const thin=totalSlugs()-chosen.size<MIN_KEEP;
  const foot=el('div','rsPickFoot');
  const finish=chosen.size>=max&&tier.need.every((r,j)=>j===k||p.groups[j].left<=0);
  const send=el('button','warn',finish?'ส่ง '+chosen.size+' ตัว · วิจัยสำเร็จ':'ส่ง '+chosen.size+' ตัว');send.type='button';send.disabled=!chosen.size||thin;
  send.onclick=()=>{const list=[...chosen];picking=null;
   if(deposit(line.id,k,list))sel={id:line.id,i:Math.min(doneCount(line.id),line.tiers.length-1)};render(true);};
  const no=el('button',null,'ยกเลิก');no.type='button';no.onclick=()=>{picking=null;render();};
  foot.append(el('small',null,thin?'ส่งแล้วร้านจะเหลือทากน้อยกว่า '+MIN_KEEP+' ตัว ทำไม่ได้'
   :'ทากที่ส่งจะหายจากร้านถาวร (ได้ที่ว่างคืน) และนับเข้าขั้นนี้'+(finish?' · ครบทุกกลุ่มแล้ว วิจัยสำเร็จทันที':'')),no,send);
  box.append(foot);shade.append(box);
  return shade;
 }

 function render(scrollToSel=false){
  if(!dialog.open)return;
  if(!sel||!lineOf(sel.id))sel=defaultSel();
  const keepX=dialog.querySelector('.rsMap')?.scrollLeft||0,keepY=dialog.querySelector('.rsBody')?.scrollTop||0;
  dialog.replaceChildren();
  const head=document.createElement('header');
  head.innerHTML='<div><small>ปลดล็อกด้วยทาก ไม่ใช้เหรียญ</small><h2>🔬 แผนที่วิจัย</h2></div>';
  const close=el('button','tbtn','กลับหน้าร้าน');close.onclick=()=>hide();
  head.append(close);dialog.append(head);

  const body=el('div','rsBody');dialog.append(body);
  const now=el('div','rsNow');
  const cap=typeof breederMax==='function'?breederMax():5;
  for(const text of ['เพดานตู้เพาะพันธุ์ '+cap+' ตู้',
                     'ส่วนลดตู้เพาะพันธุ์ '+Math.round(breederDiscount()*100)+'%',
                     'ส่วนลดของทุกอย่าง '+Math.round(shopDiscount()*100)+'%'])now.append(el('b',null,text));
  body.append(now);

  /* plan() ไล่ทากทั้งร้าน — คิดครั้งเดียวต่อสายต่อการวาด ใช้ร่วมกันทั้งแผนที่และการ์ดรายละเอียด */
  const plans={};for(const l of LINES){const t=nextTier(l.id);if(t)plans[l.id]=plan(t);}
  const map=renderMap(body,plans);
  if(picking){const ov=pickerOverlay(plans);if(ov)dialog.append(ov);}
  body.append(el('div','rsRule','เกณฑ์: เทียบ "ยีนกำเนิด" (ไม่รวมบัฟอาหาร) · สียอมรับ ±'+COLOR_TOL+' จากเลขหลักสี — ดูเลขได้ที่ช่องสีลำตัว/สีหงอนบนการ์ดยีน · จำนวนหงอนต้องตรงเป๊ะ · ทากที่กดถูกใจ ♥ ไม่ถูกนับและไม่ถูกใช้'));

  /* เปิดมา = เลื่อนให้สถานีที่เลือกอยู่ถัดจากป้ายชื่อสาย (ป้ายติดซ้ายบังของใต้มัน)
     ตั้งซ้ำหลังเฟรมแรกด้วย เพราะ showModal() โฟกัสปุ่มแล้วเบราว์เซอร์เลื่อนแผนที่เอง */
  const toSel=()=>{const s=map.querySelector('.rsStop.sel'),h=map.querySelector('.rsLaneHead');
   if(s)map.scrollLeft=Math.max(0,s.offsetLeft-(h?h.offsetWidth:0)-20);};
  if(scrollToSel){toSel();setTimeout(toSel,0);}
  else{map.scrollLeft=keepX;body.scrollTop=keepY;}
 }

 function hide(){if(!dialog.open)return;picking=null;tip.hidden=true;dialog.close();if(typeof cv!=='undefined'&&cv.focus)cv.focus();}
 function open(o){
  if(o&&!(G.objs||[]).includes(o))return;
  if(dialog.open)return;
  picking=null;sel=defaultSel();dialog.showModal();render(true);
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();if(picking){picking=null;render();}else hide();});   // Esc ปิดหน้าเลือกทากก่อน
 /* ป้าย hover ลอยตัวเดียว (แผนที่ตัดของที่ล้นขอบ จึงใช้ ::after ในชิปไม่ได้) · ย้ายตามชิปที่ชี้ ไม่มีลูปทุกเฟรม */
 const tip=el('div','rsTip');tip.setAttribute('role','tooltip');tip.hidden=true;
 function showTip(t){
  const s=t&&t.closest&&t.closest('[data-tip]');
  if(!s||!dialog.contains(s)){tip.hidden=true;return;}
  if(tip.parentNode!==dialog)dialog.append(tip);                 // render() ล้างลูกทั้งหมด ต้องแปะกลับ
  tip.textContent=s.dataset.tip;tip.hidden=false;
  const r=s.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
  const x=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2));
  const y=r.top-h-8<8?r.bottom+8:r.top-h-8;
  tip.style.left=x+'px';tip.style.top=y+'px';
 }
 dialog.addEventListener('pointerover',e=>showTip(e.target));
 dialog.addEventListener('pointerleave',()=>{tip.hidden=true;});
 dialog.addEventListener('focusin',e=>showTip(e.target));
 dialog.addEventListener('scroll',()=>{tip.hidden=true;},true);

 return {LINES,open,close:hide,isOpen:()=>dialog.open,render,
         capBonus,breederDiscount,shopDiscount,priceMul,plan,pool,nextTier,doneCount,state:st};
})();
function openResearchTable(o){Research.open(o);}
