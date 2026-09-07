/* quests.js — ระบบเควสสอนเล่น (ทิวทอเรียลแบบไม่บอกทุกอย่าง) + สกุลเงินชื่อเสียง (rep)
   - โพลสถานะเกมทุกวินาที เช็กเงื่อนไขเควสปัจจุบัน แล้วให้รางวัล/ไปเควสถัดไป
   - จับ "การกระทำ" ด้วยตัวนับใน G.stats (fed/cleaned/bred/ordered/sold) — sold นับใน trade.js
     ที่เหลือ monkey-patch ฟังก์ชันเดิม (ไม่แก้ไฟล์เกมหลัก)
   - รางวัล: เหรียญ + ชื่อเสียง(rep) · unlock/ความดึงดูด เป็น flavor ในข้อความ
   บาลานซ์/ลำดับ/เหตุผล: claude/quest_system_design.md
   หมายเหตุ: "ความดึงดูด" ในโค้ด = จำนวนทากในตู้ × ความสะอาด (ของตกแต่งไม่มีผล)
             เควส 4 จึงเป็น "เปิดร้านรับลูกค้า" แทน "ดันความดึงดูดถึง 20" ที่ไปไม่ถึงตอนมี 2 ตัว */
(function(){
 if(typeof G==='undefined'){ console.warn('[quests] ไม่มี G'); return; }
 if(!G.stats) G.stats={};
 for(const k of ['fed','cleaned','bred','ordered','sold','earned','spent','sec']) if(!Number.isFinite(G.stats[k])) G.stats[k]=0;
 if(!Number.isFinite(G.rep)) G.rep=0;
 if(!Number.isFinite(G.questIndex)) G.questIndex=0;
 G.questDone=!!G.questDone;
 if(!G.welcomeGiftDone && !(G.welcomeGiftAt>0)) G.welcomeGiftAt=Date.now()+180000;   // ของขวัญต้อนรับ ~3 นาทีหลังเริ่มร้าน

 const S=()=>G.stats;
 const decorCount   =()=> (G.objs||[]).filter(o=>o&&o.type==='deco'&&o._key!=='counter').length;
 const tankCount    =()=> (G.objs||[]).filter(o=>o&&o.type==='tank'&&!(typeof isBreeder==='function'&&isBreeder(o))).length;
 const breederExists=()=> (G.objs||[]).some(o=>o&&typeof isBreeder==='function'&&isBreeder(o));
 const area         =()=> (typeof floorArea==='function'?floorArea():((G.bw||0)*(G.bh||0)));
 const shopOpen     =()=> (typeof peopleOn!=='undefined' && !!peopleOn);
 const attraction    =()=> (typeof visitorAttraction==='function'?visitorAttraction():0);

 function snapshot(){ return {fed:S().fed, cleaned:S().cleaned, bred:S().bred, ordered:S().ordered, sold:S().sold, decor:decorCount(), tank:tankCount(), area:area()}; }

 const ORIGINAL_QUESTS=[
  {t:'ให้อาหารทากทะเล', h:'คลิกเข้าตู้ แล้วลองวางอาหารให้ทากสักตัว', cond:b=>S().fed>b.fed, reward:{coin:50, rep:0, txt:'ปลดล็อกอาหารที่ดีขึ้น'}, btn:'#mView'},
  {t:'ทำความสะอาดตู้', h:'ในตู้มีปุ่มทำความสะอาด ลองขัดคราบสาหร่ายให้เอี่ยม', cond:b=>S().cleaned>b.cleaned, reward:{coin:40, rep:0, txt:'ได้แปรงขัดตู้'}, btn:'#mView'},
  {t:'แต่งร้านสักหน่อย', h:'เข้าโหมดก่อสร้าง (🔧) ซื้อของตกแต่งมาวางในร้าน 1 ชิ้น', cond:b=>decorCount()>b.decor, reward:{coin:40, rep:0, txt:'ปลดล็อกชุดตกแต่งใหม่'}, btn:'#mBuild'},
  {t:'ทำประตูเข้าร้าน', h:'โหมดก่อสร้าง → ปุ่ม 🚪 ประตู เลือกตำแหน่งบนกำแพง วางประตูให้ลูกค้าเดินเข้าได้', cond:b=>!!G.door, reward:{coin:40, rep:0, txt:'ลูกค้าเดินเข้าร้านได้แล้ว'}, btn:['button[onclick^="placeEntrance"]','#mBuild']},
  {t:'เพิ่มความดึงดูดของร้าน', h:'ซื้อของตกแต่งเพิ่ม (และมีทากอยู่ในตู้) ให้ค่าความดึงดูดแตะ 6', cond:b=>attraction()>=6, reward:{coin:1200, rep:0, txt:'ร้านน่าเข้า ลูกค้าเริ่มแวะ — ได้ทุนก้อนไปเปิดตู้เพาะพันธุ์!'}, btn:'#mBuild'},
  {t:'สร้างโต๊ะเพาะพันธุ์', h:'ในร้านค้า (โหมดก่อสร้าง) มีตู้เพาะพันธุ์ 3 ส่วน วางลงไป', cond:b=>breederExists(), reward:{coin:0, rep:2, txt:'ปลดล็อกการเพาะพันธุ์'}, btn:'#mBuild'},
  {t:'ผสมพันธุ์ทากคู่แรก', h:'เข้าตู้เพาะ เลือกทากว่าง 2 ตัว แล้วเริ่มผสมพันธุ์', cond:b=>S().bred>b.bred, reward:{coin:80, rep:1, txt:'รอลูกทากตัวแรกได้เลย'}, btn:'#mView'},
  {t:'วางเคาน์เตอร์ขายทาก', h:'โหมดก่อสร้าง → วางเคาน์เตอร์ (ฟรี) ไว้ให้ลูกค้ามาเสนอราคาซื้อทาก', cond:b=>(G.objs||[]).some(o=>o&&o.type==='deco'&&o._key==='counter'), reward:{coin:0, rep:1, txt:'พร้อมขายทากแล้ว'}, btn:['button[onclick^="placeTradeCounter"]','#mBuild']},
  {t:'ขายทากให้ลูกค้า', h:'รอลูกค้าเดินมาที่เคาน์เตอร์เสนอราคา แล้วกดขาย — ขายลูกที่เพาะได้ อย่าขายคู่พ่อแม่', cond:b=>S().sold>b.sold, reward:{coin:100, rep:1, txt:'นี่คือรายได้หลักของร้าน'}, btn:'#mView'},
  {t:'ขายทากอีกตัว', h:'ทากที่ผสมจนหมดพลังก็ยังขายได้ ลองปล่อยของอีกตัว', cond:b=>S().sold>b.sold, reward:{coin:800, rep:1, txt:'ทุนก้อนไว้สั่งกล่องทากตัวต่อไป'}, btn:'#mView'},
  {t:'สั่งกล่องทากจากคอม', h:'คลิกคอมพิวเตอร์บนเคาน์เตอร์ → สั่งกล่องทาก แล้วรอส่ง ~1 นาที', cond:b=>S().ordered>b.ordered, reward:{coin:0, rep:2, txt:'ปลดล็อกกล่องยีนกว้างขึ้น'}, btn:'#mView'},
  {t:'ซื้อตู้ใหม่', h:'ทากเริ่มเยอะ ซื้อตู้เพิ่มไว้เก็บอีกใบ', cond:b=>tankCount()>b.tank, reward:{coin:150, rep:0, txt:'ปลดล็อกตู้ขนาดอื่น'}, btn:'#mBuild'},
  {t:'ขยายร้าน', h:'โหมดก่อสร้าง → เลือกช่องขยายร้าน เพิ่มพื้นที่', cond:b=>area()>b.area, reward:{coin:200, rep:0, txt:'พื้นที่มากขึ้น วางของได้เยอะขึ้น'}, btn:'#mBuild'},
  {t:'ขายทากให้ครบ 5 ตัว', h:'ระบายทากส่วนเกินที่เพาะไว้ให้ลูกค้า', cond:b=>S().sold>=b.sold+5, reward:{coin:100, rep:2, txt:'ปลดล็อกพ่อค้ารับเหมา (เร็ว ๆ นี้)'}, btn:'#mView'},
  {t:'เปิดร้านรับลูกค้า', h:'กดปุ่ม 👥 ลูกค้า ที่แถบบนขวา เพื่อเปิดร้านให้ลูกค้าเดินเข้ามาซื้อ', cond:b=>shopOpen(), reward:{coin:0, rep:1, box:0, txt:'เปิดร้านแล้ว! รับกล่องสุ่มทากไปเริ่มต้น 1 กล่อง'}, btn:'#bPeople'},
 ];

 // Stable IDs preserve earned rewards when tutorial order changes.
 ORIGINAL_QUESTS.forEach((q,i)=>q.id='tutorial-'+i);
 const QUESTS=[3,14,7,0,2,4,5,6,8,9,10,11,12,1,13].map(i=>ORIGINAL_QUESTS[i]);
 if(G.questOrderVersion!==2){
  const oldIndex=Math.max(0,Math.min(ORIGINAL_QUESTS.length,G.questIndex||0)),oldId=ORIGINAL_QUESTS[oldIndex]?.id;
  G.questCompleted=ORIGINAL_QUESTS.slice(0,G.questDone?ORIGINAL_QUESTS.length:oldIndex).map(q=>q.id);
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
 if(!Array.isArray(G.questCompleted))G.questCompleted=[];
 if(!G.questBase || typeof G.questBase!=='object') G.questBase=snapshot();

 /* ---- ชิป rep บนแถบบน ---- */
 let repEl=null;
 function ensureRepChip(){
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
 function placeCard(){ const bar=document.querySelector('.topbar'); const b=bar?Math.ceil(bar.getBoundingClientRect().bottom):48; card.style.top=(Math.max(8,b)+10)+'px'; }
 placeCard(); window.addEventListener('resize',placeCard);
 function updateCardVisibility(){ const ov=document.getElementById('ov'); card.style.display=(ov&&ov.classList.contains('on'))?'none':'block'; }
 const _ovEl=document.getElementById('ov'); if(_ovEl&&typeof MutationObserver!=='undefined') new MutationObserver(updateCardVisibility).observe(_ovEl,{attributes:true,attributeFilter:['class']});
 updateCardVisibility();
 let questCollapsed=false; try{ questCollapsed=localStorage.getItem('questCardCollapsed')==='1'; }catch(e){}
 function questHeader(label){ return '<div style="display:flex;align-items:center;gap:8px;justify-content:space-between"><span style="font-size:11px;letter-spacing:.5px;opacity:.75">'+label+'</span><button id="questToggle" title="ย่อ/ขยาย" style="all:unset;cursor:pointer;color:#f1c66d;font-weight:700;font-size:16px;line-height:1;padding:0 4px">'+(questCollapsed?'▸':'▾')+'</button></div>'; }
 function bindToggle(){ const b=card.querySelector('#questToggle'); if(b) b.onclick=()=>{ questCollapsed=!questCollapsed; try{localStorage.setItem('questCardCollapsed',questCollapsed?'1':'0');}catch(e){} renderCard(); }; }
 /* ---- ไฟกะพริบรอบปุ่มของเควสปัจจุบัน (หยุดเมื่อกดปุ่ม หรือจบเควส) ---- */
 let _glowEl=null,_glowSel=null,_glowHandler=null,_glowPressedQuest=null;
 (function(){ if(document.getElementById('questGlowCSS'))return; const st=document.createElement('style'); st.id='questGlowCSS'; st.textContent='/* วงในสำคัญกว่าวงนอก: .mbtn ไม่มี border (border-color จึงไม่มีผล) และ .modeseg มี overflow:hidden ที่ตัดเงาวงนอกทิ้งหมด — เงา inset วาดในตัวปุ่มเลย เลยไม่โดนตัดไม่ว่าปุ่มจะอยู่ในกล่องแบบไหน */@keyframes questGlowPulse{0%,100%{box-shadow:inset 0 0 0 1.5px rgba(241,198,109,.75),0 0 0 0 rgba(241,198,109,.65),0 0 8px 2px rgba(241,198,109,.5)}50%{box-shadow:inset 0 0 0 2.5px rgba(241,198,109,1),0 0 0 4px rgba(241,198,109,.12),0 0 18px 7px rgba(241,198,109,.9)}}.quest-glow{animation:questGlowPulse 1.05s ease-in-out infinite;border-color:#f1c66d !important;border-radius:8px;position:relative;z-index:6}'; document.head.appendChild(st); })();
 function clearGlow(){ if(_glowEl){ _glowEl.classList.remove('quest-glow'); if(_glowHandler)_glowEl.removeEventListener('pointerdown',_glowHandler); } _glowEl=null;_glowSel=null;_glowHandler=null; }
 /* ปุ่มเป้าหมายหลายตัวใน index.html อยู่ในแผง .buildonly ซึ่ง body.mode-view ตั้ง display:none ไว้
    querySelector ยังเจอ element (มันอยู่ใน DOM เสมอ) แต่ผู้เล่นมองไม่เห็นไฟกะพริบเลย
    จึงต้องเช็ก "มองเห็นได้จริง" แล้วถอยไปไฮไลต์ปุ่มทางผ่าน (🔧 ก่อสร้าง) แทน */
 const _visible=el=>!!el&&!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length);
 function resolveGlow(btn){ const list=Array.isArray(btn)?btn:[btn]; for(const sel of list){ const el=document.querySelector(sel); if(_visible(el)) return {el:el,sel:sel,primary:sel===list[0]}; } return null; }
 function applyGlow(btn,qid){
  const hit=resolveGlow(btn);
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
 function updateQuestGlow(){ const cq=G.questDone?null:QUESTS[G.questIndex]; if(cq&&cq.btn&&_glowPressedQuest!==cq.id) applyGlow(cq.btn,cq.id); else clearGlow(); }
 function renderCard(){
  updateQuestGlow();
  if(G.questDone){ card.innerHTML=questHeader('เควส')+(questCollapsed?'':'<div style="font-weight:600;color:#f1c66d;margin-top:3px">🎉 จบบทเรียนเริ่มต้น</div><div style="opacity:.85;margin-top:3px">เปิดร้านเพาะทากได้เต็มตัวแล้ว ลุยเลย!</div>'); bindToggle(); return; }
  const i=G.questIndex, q=QUESTS[i]; if(!q){ G.questDone=true; renderCard(); return; }
  if(questCollapsed){ card.innerHTML=questHeader('เควส '+(i+1)+' / '+QUESTS.length+' · '+q.t); bindToggle(); return; }
  const rw=[]; if(q.reward.coin) rw.push('💰'+q.reward.coin); if(q.reward.rep) rw.push('⭐'+q.reward.rep);
  card.innerHTML=questHeader('เควส '+(i+1)+' / '+QUESTS.length)
   +'<div style="font-weight:600;color:#f1c66d;margin-top:3px">'+q.t+'</div>'
   +'<div style="opacity:.9;margin-top:5px">'+q.h+'</div>'
   +(rw.length?'<div style="margin-top:7px;font-size:12px;opacity:.85">รางวัล: '+rw.join(' · ')+'</div>':'');
  bindToggle();
 }

 function grant(q){
  const r=q.reward||{};
  if(r.coin) G.coin=(G.coin||0)+r.coin;
  if(r.rep)  G.rep =(G.rep||0)+r.rep;
  if(Number.isFinite(r.box)&&typeof SLUG_BOXES!=='undefined'&&typeof rollBoxGenes==='function'){const _bx=SLUG_BOXES[r.box];if(_bx){const _has=(G.objs||[]).some(o=>o&&o._key==='counter');if(_has&&typeof slugDeliveries==='function')slugDeliveries().push({id:'quest'+Date.now()+'_'+Math.floor(Math.random()*10000),boxIndex:r.box,name:_bx.name,readyAt:Date.now()+1500,genes:rollBoxGenes(_bx),alerted:false});else if(Array.isArray(G.inv)&&typeof makeSlug==='function')G.inv.push(makeSlug(rollBoxGenes(_bx)));}}
  const parts=[]; if(r.coin)parts.push('+'+r.coin+' เหรียญ'); if(r.rep)parts.push('+'+r.rep+' ชื่อเสียง');
  if(typeof toast==='function') toast('✅ เควสสำเร็จ: '+q.t+(parts.length?' · '+parts.join(' · '):'')+(r.txt?' · '+r.txt:''),'good');
  if(typeof syncHUD==='function') syncHUD();
  syncRep();
 }
 function advance(){
  const completed=QUESTS[G.questIndex];if(completed&&!G.questCompleted.includes(completed.id))G.questCompleted.push(completed.id);
  G.questIndex++;
  while(G.questIndex<QUESTS.length&&G.questCompleted.includes(QUESTS[G.questIndex].id))G.questIndex++;
  if(G.questIndex>=QUESTS.length) G.questDone=true; else G.questBase=snapshot();
  _glowPressedQuest=null;
  if(typeof saveGame==='function') saveGame();
  renderCard();
 }

 /* ---- นับการกระทำด้วย monkey-patch ---- */
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

 /* ---- ของขวัญต้อนรับร้านใหม่ (ครั้งเดียว หลังเริ่ม ~3 นาที) ---- */
 function welcomeGift(){
  if(G.welcomeGiftDone) return; G.welcomeGiftDone=true;
  const greeting='สวัสดีเจ้าของร้านใหม่! เห็นเพิ่งเปิดร้านทากทะเล สงสารคนเปิดร้านใหม่ เลยส่งทากมาให้ 2 ตัวเป็นของขวัญต้อนรับ เผื่อช่วยตั้งตัวช่วงแรก ๆ อ่ะ ๆ ขอให้ขายดีนะ 🐚 — ร้านทากข้างบ้าน';
  if(typeof receiveComputerMessage==='function') receiveComputerMessage({type:'online', id:'welcome-gift', title:'ของขวัญต้อนรับร้านใหม่ 🎁', body:greeting});
  const box=(typeof SLUG_BOXES!=='undefined')?SLUG_BOXES[0]:null;   // ระดับ 1 (ปกติ)
  const hasCounter=(G.objs||[]).some(o=>o&&o._key==='counter');
  if(box && typeof slugDeliveries==='function' && typeof rollBoxGenes==='function' && hasCounter){
   for(let i=0;i<2;i++) slugDeliveries().push({id:'welcome_'+i+'_'+Date.now(), boxIndex:0, name:box.name+'(ของขวัญ)', readyAt:Date.now(), genes:rollBoxGenes(box), alerted:true});
   if(typeof toast==='function') toast('📬 มีคนส่งของขวัญต้อนรับมาให้! เปิดกล่องของขวัญที่เคาน์เตอร์ได้เลย','good');
  } else {
   for(let i=0;i<2;i++){ const g=(box&&typeof rollBoxGenes==='function')?rollBoxGenes(box):undefined; G.inv.push(makeSlug(g)); }
   if(typeof toast==='function') toast('📬 มีคนส่งทากต้อนรับมาให้ 2 ตัว! เก็บไว้ในคลังแล้ว','good');
  }
  if(typeof saveGame==='function') saveGame(); if(typeof syncHUD==='function') syncHUD();
 }

 /* ---- ลูปเช็ก ---- */
 syncRep(); renderCard();
 setInterval(function(){
  syncRep(); updateCardVisibility();
  if(!G.welcomeGiftDone && G.welcomeGiftAt>0 && Date.now()>=G.welcomeGiftAt) welcomeGift();
  if(G.questDone){ renderCard(); return; }
  const q=QUESTS[G.questIndex];
  if(!q){ G.questDone=true; renderCard(); return; }
  let ok=false; try{ ok=q.cond(G.questBase||{}); }catch(e){ ok=false; }
  if(ok){ grant(q); advance(); } else renderCard();
 },1000);
})();
