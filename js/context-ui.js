/* Contextual panels; retain the game controls and their existing handlers. */
(()=>{
 const rail=document.querySelector('.rail'),top=document.querySelector('.topbar');
 const sections=[...rail.querySelectorAll(':scope > .sec')];
 const help=document.createElement('dialog');help.className='help-dialog';
 help.innerHTML='<form method="dialog"><button class="tbtn" aria-label="ปิดวิธีเล่น">✕</button></form><h2>วิธีเล่น</h2>';
 const instructions=[['กล้อง','ลากพื้นเพื่อเลื่อนกล้อง · ล้อเมาส์เพื่อซูม'],['ก่อสร้าง','เลือกของแล้วคลิกวาง · R หมุน · Esc ยกเลิก · ประตูวางบนกำแพง'],['ทางเดิน','หน้าตู้ต้องมีช่วงว่างต่อเนื่อง 50 ซม. และทางเดินลึก 100 ซม.'],['ดูตู้','คลิกตู้เพื่อเข้าไปดู · คลิกทากเพื่อเลือกและดูยีน'],['จัดของในตู้','เปิดจัดของ แล้วเลือกของเพื่อวาง · R พลิก · Esc วางมือ'],['ข้อเสนอ','เลือกดูตัวทากหรือเปลี่ยนตัวที่จะขายได้ ขายเมื่อกดยอมรับเท่านั้น']];
 for(const [title,body] of instructions){const d=document.createElement('details');const summary=document.createElement('summary');summary.textContent=title;const p=document.createElement('p');p.textContent=body;d.append(summary,p);help.append(d);}
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
 function show(name){
   active=name;for(const s of rail.querySelectorAll(':scope > .sec'))s.hidden=s.dataset.panel!==name;
   rail.hidden=!name;for(const [key,b] of buttons){b.classList.toggle('on',key===name);b.setAttribute('aria-expanded',String(key===name));}
   window.dispatchEvent(new Event('resize'));
 }
 for(const [key,label] of [['inventory','คลังทาก'],['shelf','ของที่เก็บ'],['offers','ข้อเสนอ'],['settings','ตั้งค่า']]){const b=document.createElement('button');b.className='tbtn';b.textContent=label;b.onclick=()=>{if(appMode==='build')setMode('view');show(active===key?'':key);};buttons.set(key,b);nav.append(b);}
 const close=document.createElement('button');close.className='tbtn panel-close';close.textContent='✕';close.setAttribute('aria-label','ปิดแผง');close.onclick=()=>{if(appMode==='build')setMode('view');show('');};rail.prepend(close);
 const previous=setMode;setMode=function(mode){previous(mode);show(mode==='build'?'build':'');};
 const badge=buttons.get('offers');const offers=document.getElementById('tradeOffers');
 new MutationObserver(()=>{const count=typeof TRADE_OFFERS!=='undefined'?TRADE_OFFERS.length:offers.querySelectorAll('select').length;badge.textContent=count?'ข้อเสนอ ('+count+')':'ข้อเสนอ';}).observe(offers,{childList:true,subtree:true});
 const ov=document.getElementById('ov');new MutationObserver(()=>{document.body.classList.toggle('inside-tank',ov.classList.contains('on'));window.dispatchEvent(new Event('resize'));}).observe(ov,{attributes:true,attributeFilter:['class']});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!help.open&&active&&appMode!=='build')show('');});
 show(appMode==='build'?'build':'');
})();
