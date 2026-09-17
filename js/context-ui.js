/* Contextual panels; retain the game controls and their existing handlers. */
(()=>{
 const rail=document.querySelector('.rail'),top=document.querySelector('.topbar');
 const sections=[...rail.querySelectorAll(':scope > .sec')];
 const help=document.createElement('dialog');help.className='help-dialog';
 help.innerHTML='<form method="dialog"><button class="tbtn" aria-label="ปิดวิธีเล่น">✕</button></form><h2>วิธีเล่น</h2>';
 const instructions=[['กล้อง','ลากพื้นเพื่อเลื่อนกล้อง · ล้อเมาส์เพื่อซูม'],['ก่อสร้าง','เลือกของแล้วคลิกวาง · R หมุน · Esc ยกเลิก · ประตูวางบนกำแพง'],['ทางเดิน','หน้าตู้ต้องมีช่วงว่างต่อเนื่อง 50 ซม. และทางเดินลึก 100 ซม.'],['ดูตู้','คลิกตู้เพื่อเข้าไปดู · คลิกทากเพื่อเลือกและดูยีน'],['จัดของในตู้','เปิดจัดของ แล้วเลือกของเพื่อวาง · R พลิก · Esc วางมือ'],['ข้อเสนอ','เลือกดูตัวทากหรือเปลี่ยนตัวที่จะขายได้ ขายเมื่อกดยอมรับเท่านั้น']];
 for(const [title,body] of instructions){const d=document.createElement('details');const summary=document.createElement('summary');summary.textContent=title;const p=document.createElement('p');p.textContent=body;d.append(summary,p);help.append(d);}
 
 const supportDetails = document.createElement('details');
 supportDetails.innerHTML = '<summary>💖 สนับสนุนผู้พัฒนา</summary><div style="background:#141617;border:1px solid #3b4d4b;border-radius:12px;padding:16px;text-align:center;margin-top:12px"><p style="font-size:13px;line-height:1.6;color:#c7c0b1;margin:0 0 16px">ถ้าชื่นชอบเกมร้านทากทะเล และอยากสนับสนุนค่ากาแฟหรือเติมเสบียงอาหารทากให้ผม<br>สามารถสนับสนุนได้ตามช่องทางด้านล่างนี้เลยครับ ขอบคุณที่แวะมาเล่นนะ! 🐌✨</p><img src="assets/QR PP.jpg" alt="QR Code PromptPay" style="width:100%;max-width:220px;border-radius:8px;margin-bottom:16px"><div style="background:#1e2425;border:1px solid #2a3535;border-radius:8px;padding:12px;font-size:13px;color:#c7c0b1"><p style="margin:4px 0">ธนาคารไทยพาณิชย์ (SCB)</p><p style="margin:4px 0">เลขบัญชี: <b style="color:#ffe1a0;font-size:15px;letter-spacing:1px">322-250-7470</b></p><p style="margin:4px 0">ชื่อบัญชี: นาย อัษฎา สารารัตน์</p></div></div>';
 help.append(supportDetails);

 document.body.append(help);
 window.addEventListener('keydown',e=>{if(help.open&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();help.close();}},true);
 const helpButton=document.createElement('button');helpButton.className='tbtn';helpButton.textContent='?';helpButton.setAttribute('aria-label','วิธีเล่น');helpButton.onclick=()=>help.showModal();top.append(helpButton);
 // จับคู่แต่ละ .sec เข้ากับแท็บด้วย "เนื้อหา" ไม่ใช่ดัชนีตายตัว — แทรก .sec ใหม่ (เช่น ชั้นวางติดผนัง) แล้วแท็บต้องไม่เลื่อน
 const secWith=sel=>sections.find(s=>s.querySelector(sel));
 const offersSec=secWith('#tradeOffers'),invSec=secWith('#inv'),storedSec=secWith('#shelf'),doorSec=secWith('#doorPosition');
 for(const s of sections){
  s.dataset.panel = s===offersSec?'offers' : s===invSec?'inventory' : s===storedSec?'shelf'
   : (s.classList.contains('buildonly')||s.querySelector('#doorPosition,#shelfStatus'))?'build' : 'unused';
 }
 // Placement belongs with construction, while incoming offers have their own panel.
 const counter=offersSec?.querySelector('button');if(counter&&doorSec)doorSec.append(counter);
 for(const s of sections){for(const p of s.querySelectorAll(':scope > p:not(#shopStatus):not(#doorPosition):not(#shelfStatus)'))p.hidden=true;}
 document.querySelector('.brand small')?.remove();
 const settings=document.createElement('div');settings.className='sec';settings.dataset.panel='settings';settings.innerHTML='<h2>ตั้งค่า</h2>';rail.append(settings);
 for(const id of ['bMusic','bAnim','bFit'])settings.append(document.getElementById(id));
 const volume=document.createElement('div');volume.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:10px';
 volume.innerHTML='<span>ระดับเสียงเพลง</span><button class="tbtn" id="musicQuieter" aria-label="ลดเสียงเพลง">−</button><output id="musicVolume" aria-live="polite" style="min-width:42px;text-align:center"></output><button class="tbtn" id="musicLouder" aria-label="เพิ่มเสียงเพลง">＋</button>';
 document.getElementById('bMusic').after(volume);
 document.getElementById('musicQuieter').onclick=()=>setBgmVolume(bgm.volume-.05);
 document.getElementById('musicLouder').onclick=()=>setBgmVolume(bgm.volume+.05);
 syncBgmVolume();

 const nav=document.createElement('div');nav.className='context-nav';top.insertBefore(nav,helpButton);
 let active='';const buttons=new Map();
 /* "คลังทาก" กับ "ของที่เก็บ" คือของที่เรามีอยู่เหมือนกัน — ข้างนอกเหลือปุ่มเดียว แล้วมาแยกเป็นแท็บในแผง */
 const STORAGE=['inventory','shelf'];
 const tabs=document.createElement('div');tabs.className='rail-tabs';tabs.hidden=true;
 for(const [key,label] of [['inventory','คลังทาก'],['shelf','ของที่เก็บ']]){
  const t=document.createElement('button');t.className='tbtn';t.dataset.tab=key;t.textContent=label;
  t.onclick=()=>show(key);tabs.append(t);
 }
 function show(name){
   active=name;for(const s of rail.querySelectorAll(':scope > .sec'))s.hidden=s.dataset.panel!==name;
   rail.hidden=!name;
   for(const [key,b] of buttons){const on=key===name||(key==='inventory'&&STORAGE.includes(name));b.classList.toggle('on',on);b.setAttribute('aria-expanded',String(on));}
   tabs.hidden=!STORAGE.includes(name);
   for(const t of tabs.children)t.classList.toggle('on',t.dataset.tab===name);
   window.dispatchEvent(new Event('resize'));
 }
 /* ⚠️ ตั้ง id ตรงนี้เอง ไม่ปล่อยให้ quests.js เดาจากข้อความปุ่ม เพราะผังใหม่กระจายปุ่มไปคนละมุมแล้ว
    #navOffers ถูกอ้างโดย cat-seller.js (ปุ่ม "ข้อเสนอหน้าร้าน" ในคอมพิวเตอร์ร้าน) · #navInv ถูกอ้างโดยเควส */
 for(const [key,label,id] of [['inventory','📦 คลัง','navInv'],['offers','ข้อเสนอ','navOffers'],['settings','⚙ ตั้งค่า','navSettings']]){
  const b=document.createElement('button');b.className='tbtn';b.id=id;b.textContent=label;
  b.onclick=()=>{if(appMode==='build')setMode('view');show((key==='inventory'?STORAGE.includes(active):active===key)?'':key);};
  buttons.set(key,b);nav.append(b);
 }
 const close=document.createElement('button');close.className='tbtn panel-close';close.textContent='✕';close.setAttribute('aria-label','ปิดแผง');close.onclick=()=>{if(appMode==='build')setMode('view');show('');};
 rail.prepend(tabs);rail.prepend(close);
 window.toggleFloorBuildTools=()=>show(active==='build'?'':'build');
 const previous=setMode;setMode=function(mode){previous(mode);show('');};
 /* ป้ายจำนวน + ไฟเรืองบนปุ่มข้อเสนอ
    ⚠️ เดิมใช้ MutationObserver จับการเปลี่ยน DOM ของแผง #tradeOffers — ถ้า renderTradeOffers()
    โยน error กลางทาง (ข้อเสนอรูปแบบใหม่/ข้อมูลไม่ครบ) DOM ไม่ขยับ ป้ายก็ไม่อัปเดต เงียบ ๆ
    ตอนนี้ห่อฟังก์ชันแล้วซิงก์ใน finally จึงตรงกับ TRADE_OFFERS.length เสมอไม่ว่าจะเกิดอะไรข้างใน */
 const badge=buttons.get('offers');
 function syncOffers(){
  const n=typeof TRADE_OFFERS!=='undefined'?TRADE_OFFERS.length:0;
  badge.textContent=n?'ข้อเสนอ ('+n+')':'ข้อเสนอ';
  badge.classList.toggle('has-news',n>0);
 }
 if(typeof renderTradeOffers==='function'){
  const _render=renderTradeOffers;
  window.renderTradeOffers=function(){try{return _render.apply(this,arguments);}finally{syncOffers();}};
 }
 syncOffers();

 /* ===== ผังใหม่ 2026-09-13 — แยกของตาม "หน้าที่" ไม่ใช่กองรวมบนหัว =====
      ซ้ายล่าง = ทุกอย่างที่กด (ซูม → โหมด → คลัง) · ขวาล่าง = แจ้งเตือนล้วน · บนขวา = สวิตช์ระดับเกม
    ⚠️ มือถือมีผังของตัวเองใน mobile.css อยู่แล้ว (.context-nav = แถบล่างเต็มความกว้าง) จึงย้ายเฉพาะจอใหญ่
       และย้ายกลับเองเมื่อจอเล็กลง — เงื่อนไขสื่อต้องเป็น "ส่วนเติมเต็ม" ของ mobile.css เป๊ะ */
 const zoombar=document.querySelector('.zoombar');
 const dockRow=document.createElement('div');dockRow.className='dock-row';
 const modeseg=document.querySelector('.modeseg');
 const modeSlot=document.createComment('modeseg');top.insertBefore(modeSlot,modeseg);   // จำที่เดิมไว้ ย้ายกลับตอนจอเล็ก
 const big=matchMedia('(min-width:821px) and (min-height:601px),(min-width:1001px)');
 function applyLayout(){
  if(big.matches){
   zoombar.append(dockRow);dockRow.append(modeseg,nav);
   /* ข้อเสนอ = ซื้อ-ขายทาก ไม่ใช่ของประดับ ต้องอยู่ที่เดิมที่ตาไปหาตลอด → มุมบนขวา
      เรืองแสงเองเมื่อมีข้อเสนอค้างอยู่ ผ่านคลาส .has-news ที่ MutationObserver ข้างบนติดให้ */
   top.append(buttons.get('offers'),buttons.get('settings'),helpButton);
  }else{
   modeSlot.parentNode.insertBefore(modeseg,modeSlot);
   nav.append(buttons.get('inventory'),buttons.get('offers'),buttons.get('settings'));
   top.append(nav,helpButton);
  }
  window.dispatchEvent(new Event('resize'));
 }
 applyLayout();big.addEventListener('change',applyLayout);

 /* ยุบชิปตัวเลข 6 → 3 · ย้ายเฉพาะ <b id="…"> ไม่แตะ id เดิม โค้ดที่อัปเดตตัวเลขจึงทำงานเหมือนเดิมทุกบรรทัด
    (ต้องทำก่อน mobile-ui.js ซึ่งโหลดทีหลังแล้วกวาด .stat ทั้งหมดไปใส่ .mobileStats) */
 const statOf=id=>document.getElementById(id)?.closest('.stat');
 statOf('hCoin')?.classList.add('lead');                       // เหรียญ = ตัวเดียวที่ต้องเหลือบดูตลอด
 const draw=statOf('hAttraction'),vis=statOf('hVisitors');
 if(draw&&vis){draw.append(document.createTextNode(' · ลูกค้า '),document.getElementById('hVisitors'));vis.remove();}
 const tanks=statOf('hTanks'),slugs=statOf('hSlugs'),area=statOf('hArea');
 if(tanks&&slugs&&area){
  tanks.replaceChildren(document.getElementById('hTanks'),document.createTextNode(' ตู้ · '),
                        document.getElementById('hSlugs'),document.createTextNode(' ทาก · '),
                        document.getElementById('hArea'));
  slugs.remove();area.remove();
 }
 const ov=document.getElementById('ov');new MutationObserver(()=>{document.body.classList.toggle('inside-tank',ov.classList.contains('on'));window.dispatchEvent(new Event('resize'));}).observe(ov,{attributes:true,attributeFilter:['class']});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!help.open&&active&&appMode!=='build')show('');});
 show('');
})();