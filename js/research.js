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
  {id:'cap', icon:'🥚', name:'ขยายเพดานตู้เพาะพันธุ์',
   note:'สำเร็จ 1 ขั้น = วางตู้เพาะพันธุ์ได้เพิ่มอีก 1 ตู้ (5 → 10 ตู้) · ราคาตู้ยังไต่ขึ้นตามสูตรเดิม',
   tiers:[
    {reward:'วางตู้เพาะพันธุ์ได้ 6 ตู้',  need:[{body:'เขียวมิ้นต์', gills:6, n:3}]},
    {reward:'วางตู้เพาะพันธุ์ได้ 7 ตู้',  need:[{body:'เลือดหมูเข้ม', gill:'เขียวมิ้นต์', n:5}]},
    {reward:'วางตู้เพาะพันธุ์ได้ 8 ตู้',  need:[{body:'ม่วงหมอง', gills:8, n:8}]},
    {reward:'วางตู้เพาะพันธุ์ได้ 9 ตู้',  need:[{body:'ดำด้าน', gill:'ม่วงหมอง', gills:9, n:10}]},
    {reward:'วางตู้เพาะพันธุ์ได้ 10 ตู้', need:[{body:'ทอง', gill:'ดำด้าน', gills:9, n:15}]}
   ]},
  {id:'price', icon:'🏷️', name:'ลดราคาของ',
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
  r.cap=clampTier(r.cap);r.price=clampTier(r.price);return r;
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
  for(const req of (tier.need||[])){
   const hits=list.filter(e=>!used.has(e.slug)&&matches(e.slug,req)).sort((a,b)=>(a.tank?1:0)-(b.tank?1:0));
   const take=hits.slice(0,req.n);
   take.forEach(e=>used.add(e.slug));
   groups.push({req,have:hits.length,take});
  }
  const take=groups.flatMap(g=>g.take);
  return {groups,take,enough:groups.every(g=>g.take.length>=g.req.n)};
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
  for(const e of p.take){
   if(e.tank){const a=e.tank.slugs,i=a.indexOf(e.slug);if(i>=0)a.splice(i,1);}
   else{const i=(G.inv||[]).indexOf(e.slug);if(i>=0)G.inv.splice(i,1);}
   if(typeof selSlug!=='undefined'&&selSlug===e.slug)selSlug=null;
   if(typeof heldSlug!=='undefined'&&heldSlug===e.slug)heldSlug=null;
  }
  st()[id]=doneCount(id)+1;
  saveGame();
  if(typeof syncHUD==='function')syncHUD();
  if(typeof buildShop==='function')buildShop();          // ป้ายราคาในแผงสร้างต้องขยับทันทีหลังได้ส่วนลด
  if(typeof playNotificationSound==='function')playNotificationSound('success');
  toast('วิจัยสำเร็จ · '+tier.reward+' (ใช้ทาก '+p.take.length+' ตัว)','good');
  return true;
 }

 /* ============================================================
    หน้าต่างโต๊ะวิจัย
    ============================================================ */
 const dialog=document.createElement('dialog');dialog.id='researchView';dialog.setAttribute('aria-label','โต๊ะวิจัย');
 document.body.append(dialog);
 document.head.append(Object.assign(document.createElement('style'),{textContent:`
 #researchView{width:min(960px,96vw);max-height:92dvh;padding:0;border:1px solid #b29a69;border-radius:18px;background:#152c30;color:#f0e8d7;overflow:hidden;box-shadow:0 24px 80px #0008}
 #researchView::backdrop{background:#09171bd9}
 #researchView header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 22px;background:#1c3639;border-bottom:1px solid #d8bd7a38}
 #researchView h2{margin:0;font-size:21px;font-weight:600}#researchView header small{display:block;color:#c2ac80;font-size:11px}
 #researchView .rsBody{padding:14px 22px 22px;overflow:auto;max-height:calc(92dvh - 64px)}
 #researchView .rsRule{font-size:12px;line-height:1.7;color:#a7bdb8;border-left:3px solid #c9a35f;padding:2px 0 2px 10px;margin-bottom:12px}
 #researchView .rsNow{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
 #researchView .rsNow b{background:#20383a;border:1px solid #4d6360;border-radius:999px;padding:5px 13px;font-size:12px;font-weight:500;color:#e9d7a6}
 #researchView .rsLine{border:1px solid #50605f;border-radius:13px;padding:13px 15px;margin-bottom:14px;background:#142b2e}
 #researchView .rsLine>h3{margin:0 0 3px;font-size:16px}
 #researchView .rsLine>p{margin:0 0 11px;font-size:12px;color:#a7bdb8;line-height:1.6}
 #researchView .rsTier{display:flex;gap:11px;align-items:flex-start;padding:9px 0;border-top:1px solid #2c4245}
 #researchView .rsStep{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;background:#22383a;border:1px solid #556966;color:#c3d2cd}
 #researchView .rsTier.done .rsStep{background:#356047;border-color:#7fc59a;color:#e8ffe9}
 #researchView .rsTier.open .rsStep{background:#4b4326;border-color:#e0bb66;color:#ffe9b0}
 #researchView .rsTier.lock{opacity:.5}
 #researchView .rsMain{flex:1;min-width:0}
 #researchView .rsReward{font-size:13px;color:#f2e2b8;margin-bottom:5px}
 #researchView .rsNeed{display:flex;flex-wrap:wrap;gap:6px}
 #researchView .rsNeed span{display:inline-flex;align-items:center;gap:6px;font-size:12px;background:#1b3134;border:1px solid #47605d;border-radius:8px;padding:4px 9px;color:#d8e4df}
 #researchView .rsNeed span.ok{border-color:#7fc59a;color:#d3f3dd}
 #researchView .rsNeed span.miss{border-color:#c07e6e;color:#f2cfc3}
 #researchView .rsDot{width:12px;height:12px;border-radius:50%;border:1px solid #0006;flex:none}
 #researchView .rsDot.ring{border-radius:50%;box-sizing:border-box;border-width:4px}
 #researchView .rsGo{flex:none;align-self:center;padding:9px 16px;border-radius:9px;border:1px solid #e2cc90;background:#c6a459;color:#172b2d;font:inherit;font-weight:700;cursor:pointer}
 #researchView .rsGo[disabled]{background:#2b3f41;border-color:#4e625f;color:#8ea09c;cursor:not-allowed}
 #researchView .rsHint{font-size:11px;color:#9fb2ae;margin-top:6px}
 #researchView .rsConfirm{margin-top:9px;border:1px solid #c9a35f;border-radius:10px;background:#1d3134;padding:11px}
 #researchView .rsConfirm h4{margin:0 0 6px;font-size:13px;color:#f0cf87}
 #researchView .rsList{max-height:150px;overflow:auto;font-size:12px;color:#cfdcd7;line-height:1.7;margin:0 0 9px;padding-left:18px}
 #researchView .rsConfirm .row{display:flex;gap:8px;flex-wrap:wrap}
 #researchView .rsConfirm button{padding:8px 15px;border-radius:8px;border:1px solid #7d8f89;background:#26403f;color:#eee;font:inherit;cursor:pointer}
 #researchView .rsConfirm button.warn{background:#a1493c;border-color:#d98a78;color:#fff;font-weight:700}
 @media(max-width:700px){#researchView .rsBody{padding:12px}#researchView .rsTier{flex-wrap:wrap}#researchView .rsGo{width:100%}}
 `}));

 let pending=null;                       // {id} = ขั้นที่กำลังรอยืนยัน

 function dot(name,gill){
  const s=document.createElement('i');s.className='rsDot';s.style.background=swatch(name,gill);
  if(gill){s.style.borderColor=swatch(name,true);s.style.background='transparent';s.style.borderWidth='4px';}
  return s;
 }
 function needChip(g){
  const el=document.createElement('span'),req=g.req;
  el.className=g.take.length>=req.n?'ok':'miss';
  if(req.body)el.append(dot(req.body,false));
  if(req.gill)el.append(dot(req.gill,true));
  /* ต้องโชว์ "เลขยีน ±10" ด้วย ไม่ใช่แค่ชื่อสี — ชื่อสีบนการ์ดยีนกว้างกว่าเกณฑ์นี้
     ถ้าโชว์แค่ "เขียวมิ้นต์" ผู้เล่นจะงงว่าทำไมตัวที่การ์ดเขียนว่าเขียวมิ้นต์กลับไม่ถูกนับ */
  const text=[];
  if(req.body)text.push('สีตัว '+req.body+' '+colorGene(req.body)+'±'+COLOR_TOL);
  if(req.gill)text.push('สีหงอน '+req.gill+' '+colorGene(req.gill)+'±'+COLOR_TOL);
  if(req.gills)text.push('หงอน '+req.gills+' ก้านเป๊ะ');
  const b=document.createElement('b');b.style.fontWeight='500';
  b.textContent=(text.join(' · ')||'ทากตัวไหนก็ได้')+' — '+Math.min(g.have,req.n)+'/'+req.n+' ตัว';
  el.append(b);return el;
 }

 function render(){
  if(!dialog.open)return;
  dialog.replaceChildren();
  const head=document.createElement('header');
  head.innerHTML='<div><small>ปลดล็อกด้วยทาก ไม่ใช้เหรียญ</small><h2>🔬 โต๊ะวิจัย</h2></div>';
  const close=document.createElement('button');close.className='tbtn';close.textContent='กลับหน้าร้าน';close.onclick=()=>hide();
  head.append(close);dialog.append(head);

  const body=document.createElement('div');body.className='rsBody';dialog.append(body);
  const rule=document.createElement('div');rule.className='rsRule';
  rule.textContent='เกณฑ์: เทียบ "ยีนกำเนิด" (ไม่รวมบัฟอาหาร) · สียอมรับ ±'+COLOR_TOL+' จากเลขหลักสี — ดูเลขได้ที่ช่องสีลำตัว/สีหงอนบนการ์ดยีน · จำนวนหงอนต้องตรงเป๊ะ · ทากที่กดถูกใจ ♥ ไม่ถูกนับและไม่ถูกใช้';
  body.append(rule);
  const now=document.createElement('div');now.className='rsNow';
  const cap=typeof breederMax==='function'?breederMax():5;
  for(const text of ['เพดานตู้เพาะพันธุ์ '+cap+' ตู้',
                     'ส่วนลดตู้เพาะพันธุ์ '+Math.round(breederDiscount()*100)+'%',
                     'ส่วนลดของทุกอย่าง '+Math.round(shopDiscount()*100)+'%']){
   const b=document.createElement('b');b.textContent=text;now.append(b);
  }
  body.append(now);

  for(const line of LINES){
   const box=document.createElement('div');box.className='rsLine';
   const h=document.createElement('h3');h.textContent=line.icon+' '+line.name+' · '+doneCount(line.id)+'/'+line.tiers.length+' ขั้น';
   const p=document.createElement('p');p.textContent=line.note;
   box.append(h,p);
   line.tiers.forEach((tier,i)=>{
    const done=i<doneCount(line.id),open=i===doneCount(line.id);
    const row=document.createElement('div');row.className='rsTier '+(done?'done':open?'open':'lock');
    const step=document.createElement('div');step.className='rsStep';step.textContent=done?'✓':String(i+1);
    const main=document.createElement('div');main.className='rsMain';
    const reward=document.createElement('div');reward.className='rsReward';reward.textContent='ขั้น '+(i+1)+' · '+tier.reward;
    const need=document.createElement('div');need.className='rsNeed';
    const p2=open?plan(tier):null;
    for(const req of tier.need)need.append(needChip(p2?p2.groups[tier.need.indexOf(req)]:{req,have:0,take:[]}));
    main.append(reward,need);
    row.append(step,main);

    if(open){
     const go=document.createElement('button');go.className='rsGo';go.textContent='เริ่มวิจัย';
     const short=!p2.enough,thin=totalSlugs()-p2.take.length<MIN_KEEP;
     go.disabled=short||thin;
     go.onclick=()=>{pending=line.id;render();};
     row.append(go);
     const hint=document.createElement('div');hint.className='rsHint';
     hint.textContent=short?'ยังไม่ครบ — เพาะเพิ่มแล้วกลับมาใหม่ (ทากที่กดถูกใจ ♥ ไม่ถูกนับและไม่ถูกใช้)'
      :thin?'ใช้แล้วร้านจะเหลือทากน้อยกว่า '+MIN_KEEP+' ตัว ทำไม่ได้'
      :'ครบแล้ว · กดเริ่มวิจัยแล้วจะมีหน้ายืนยันรายชื่อทากที่จะถูกใช้';
     main.append(hint);

     if(pending===line.id){
      const c=document.createElement('div');c.className='rsConfirm';
      const t=document.createElement('h4');t.textContent='ยืนยัน — ทาก '+p2.take.length+' ตัวนี้จะหายไปถาวร';
      const ul=document.createElement('ul');ul.className='rsList';
      for(const e of p2.take){
       const li=document.createElement('li');
       const nm=typeof SlugBrowser==='object'&&SlugBrowser.name?SlugBrowser.name(e.slug):e.slug.id;
       const g=genesOf(e.slug);
       li.textContent=nm+' — ตัว'+bodyName(e.slug)+' ('+g.mainC+') · หงอน'+gillName(e.slug)+' ('+g.accC+') '+gillCount(e.slug)+' ก้าน · '+(e.tank?e.tank.def.name:'คลังทาก');
       ul.append(li);
      }
      const row2=document.createElement('div');row2.className='row';
      const yes=document.createElement('button');yes.className='warn';yes.textContent='ยืนยัน ใช้ทาก '+p2.take.length+' ตัว';
      yes.onclick=()=>{pending=null;if(commit(line.id))render();else render();};
      const no=document.createElement('button');no.textContent='ยกเลิก';no.onclick=()=>{pending=null;render();};
      row2.append(yes,no);c.append(t,ul,row2);main.append(c);
     }
    }
    box.append(row);
   });
   body.append(box);
  }
 }

 function hide(){if(!dialog.open)return;pending=null;dialog.close();if(typeof cv!=='undefined'&&cv.focus)cv.focus();}
 function open(o){
  if(o&&!(G.objs||[]).includes(o))return;
  if(dialog.open)return;
  pending=null;dialog.showModal();render();
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();hide();});

 return {LINES,open,close:hide,isOpen:()=>dialog.open,render,
         capBonus,breederDiscount,shopDiscount,priceMul,plan,pool,nextTier,doneCount,state:st};
})();
function openResearchTable(o){Research.open(o);}
