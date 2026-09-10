/* Latest five acquisitions. Only IDs and a small birth-gene snapshot are saved.
 * Live slugs own favorites/names; portraits render once and fireworks expire.
 * รูปในการ์ดใช้ SlugEngine.drawSlug() สดทุกเฟรม (ไม่ใช่สไปรต์นิ่งที่อื่นในเกมใช้)
 * เพราะการ์ดนี้เปิดแค่ใบเดียวพร้อมกันเสมอ ต้นทุนอนิเมชันต่อเฟรมจึงถูกกว่าฉากในตู้มาก
 */
(()=>{
 'use strict';
 const MAX=5,genes=SlugEngine.GENES;
 const cleanGenes=g=>Object.fromEntries(genes.map(({k})=>[k,Number.isFinite(g?.[k])?g[k]:DEFAULT_GENE[k]]));
 G.newSlugNotices=(G.newSlugNotices||[]).filter(n=>n&&typeof n.id==='string'&&['box','grown'].includes(n.source))
   .slice(-MAX).map(n=>({id:n.id,source:n.source,at:Number.isFinite(n.at)?n.at:Date.now(),seen:!!n.seen,
     genes:cleanGenes(n.genes),nickname:typeof n.nickname==='string'?Array.from(n.nickname).slice(0,32).join(''):'',favorite:!!n.favorite}));
 const tray=document.createElement('aside');tray.id='newSlugTray';tray.setAttribute('aria-label','ทากใหม่ล่าสุด ไม่เกิน 5 ตัว');document.body.append(tray);
 const live=document.createElement('span');live.className='new-slug-sr';live.setAttribute('role','status');document.body.append(live);
 const card=document.createElement('dialog');card.id='newSlugCard';card.setAttribute('aria-labelledby','newSlugTitle');
 const header=document.createElement('header');
 const title=document.createElement('h2');title.id='newSlugTitle';header.append(title);
 const close=document.createElement('button');close.type='button';close.className='tbtn';close.textContent='✕';close.setAttribute('aria-label','ปิดการ์ดทากใหม่');close.onclick=()=>card.close();header.append(close);
 const content=document.createElement('div');content.className='new-slug-content';card.append(header,content);document.body.append(card);
 let current=null,portrait=null,flushPending=false,animations=[],heroRaf=null,heroCanvas=null,heroPortrait=null;
 function find(id){
   const inv=G.inv.find(s=>s.id===id);if(inv)return inv;
   for(const t of [...G.objs,...G.shelter]){
     const s=(t.slugs||[]).find(s=>s.id===id)||(t.breeding?.larvae||[]).find(l=>l.slug.id===id)?.slug;
     if(s)return s;
   }
   return null;
 }
 const name=n=>SlugBrowser.name(find(n.id)||n);
 function el(tag,text,parent){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(parent)parent.append(e);return e;}
 function positionTray(){
   // Keep icons clickable when opening a box from an existing shop dialog.
   const top=[...document.querySelectorAll('dialog[open]')].at(-1);
   tray.hidden=!G.newSlugNotices.length||card.open||!!top?.classList.contains('racing');
   const host=top&&!card.open?top:document.body;if(tray.parentElement!==host)host.append(tray);
 }
 function renderTray(){
   tray.replaceChildren();
   for(const n of [...G.newSlugNotices].reverse()){
     const b=el('button',n.source==='box'?'🐚':'🦋',tray);b.type='button';b.className='new-slug-icon';
     b.classList.toggle('unread',!n.seen);b.dataset.slugId=n.id;
     const label=(n.source==='box'?'ทากจากกล่อง: ':'ตัวอ่อนโตแล้ว: ')+name(n);
     b.title=label;b.setAttribute('aria-label',label+(n.seen?'':' ยังไม่ได้ดู'));b.onclick=()=>open(n.id);
   }
   positionTray();
 }
 function stopFireworks(){for(const a of animations)a.cancel();animations=[];content.querySelector('.new-slug-fireworks')?.remove();}
 function fireworks(hero){
   stopFireworks();if(document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
   const layer=el('div',null,hero);layer.className='new-slug-fireworks';layer.setAttribute('aria-hidden','true');
   for(let burst=0;burst<3;burst++)for(let i=0;i<10;i++){
     const spark=el('i',null,layer),angle=i*Math.PI/5,reach=34+Math.random()*35;
     spark.style.left=(20+burst*30)+'%';spark.style.top=(burst===1?24:48)+'%';
     spark.style.background=['#ffde82','#81e2d0','#f5a8cb'][i%3];
     const a=spark.animate([{transform:'translate(0,0) scale(.2)',opacity:0},{offset:.15,opacity:1},
       {transform:'translate('+Math.cos(angle)*reach+'px,'+(Math.sin(angle)*reach+18)+'px) scale(.3)',opacity:0}],
       {duration:850,delay:burst*120,easing:'cubic-bezier(.15,.7,.4,1)',fill:'both'});
     animations.push(a);
   }
   Promise.all(animations.map(a=>a.finished.catch(()=>{}))).then(()=>layer.remove());
 }
 /* ---- อนิเมชันทากในการ์ด: วาดสดด้วย SlugEngine.drawSlug ทุกเฟรม แทนสไปรต์นิ่ง ----
    ผลจากยีนตัวเดียวกัน จึงแคช "ชิ้นส่วน" (parts) ได้ผ่าน slugPartsOf ตามปกติของเกม
    แต่ห้ามใช้ slugSprite() เพราะฟังก์ชันนั้นตั้งใจบังคับ ANIM=false เพื่ออบภาพนิ่ง */
 function stopHeroAnim(){if(heroRaf){cancelAnimationFrame(heroRaf);heroRaf=null;}}
 const _heroScratch=document.createElement('canvas');
 function paintHero(canvas,who){
   const cc=canvas.getContext('2d');cc.clearRect(0,0,canvas.width,canvas.height);
   const P=typeof slugPartsOf==='function'?slugPartsOf(who):null;if(!P)return false;
   const aura=!!(P.D&&P.D.aura>0),pad=aura?26:6,w=Math.ceil(P.w)+pad*2,h=Math.ceil(P.h)+pad*2;
   if(_heroScratch.width!==w||_heroScratch.height!==h){_heroScratch.width=w;_heroScratch.height=h;}
   const oc=_heroScratch.getContext('2d');oc.clearRect(0,0,w,h);
   SlugEngine.drawSlug(oc,P,w/2,h/2,false,0,1,aura,false);
   const scale=Math.min(460/w,210/h),dw=w*scale,dh=h*scale;
   cc.drawImage(_heroScratch,(560-dw)/2,(260-dh)/2,dw,dh);
   return true;
 }
 function startHeroAnim(canvas,who){
   stopHeroAnim();heroCanvas=canvas;heroPortrait=who;
   const still=document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches;
   if(still){paintHero(canvas,who);return;}
   const loop=()=>{
     if(!current||document.hidden){heroRaf=null;return;}
     paintHero(canvas,who);heroRaf=requestAnimationFrame(loop);
   };
   heroRaf=requestAnimationFrame(loop);
 }
 function renderCard(){
   if(!current)return;stopFireworks();stopHeroAnim();content.replaceChildren();
   const s=find(current.id),isBox=current.source==='box',shown=name(current);
   title.textContent=isBox?'ได้ทากใหม่แล้ว!':'ตัวอ่อนรอดและโตแล้ว!';
   const hero=el('div',null,content);hero.className='new-slug-hero '+(isBox?'is-box':'is-grown');
   el('span',isBox?'🐚 จากกล่องสุ่ม':'🦋 ตัวอ่อนโตเต็มวัย',hero).className='new-slug-badge';
   const canvas=el('canvas',null,hero);canvas.width=560;canvas.height=260;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','รูปทาก '+shown);
   startHeroAnim(canvas,portrait);
   // ชื่อ + ปุ่มถูกใจ + ปุ่มเปลี่ยนชื่อ อยู่แถวเดียวกัน ประหยัดพื้นที่แนวตั้ง
   const titleRow=el('div',null,content);titleRow.className='new-slug-title-row';
   el('h3',shown,titleRow).className='new-slug-name';
   if(s)SlugBrowser.heart(titleRow,s,()=>{
     current.nickname=s.nickname||'';current.favorite=!!s.favorite;saveGame();renderCard();renderTray();
   });else el('span','ทากตัวนี้ไม่อยู่ในร้านแล้ว',titleRow).className='new-slug-gone';
   // เลขไอดีซ้ำกับชื่อบ่อย ๆ (ยังไม่ได้ตั้งชื่อเล่น) — โชว์เฉพาะตอนต่างกันจริง กันแถวซ้ำเปล่า ๆ
   if(shown!==current.id)el('p',current.id,content).className='new-slug-id';
   el('p','ยีนกำเนิดทั้ง 11 ค่า',content).className='new-slug-gene-heading';
   const list=el('dl',null,content);list.className='new-slug-genes';
   for(const g of genes){
     const row=el('div',null,list),value=current.genes[g.k],max=g.k==='mainC'||g.k==='accC'?400:100;
     el('dt',g.th,row);
     const dd=el('dd',null,row);dd.className='new-slug-gene-value';
     el('b',Number.isInteger(value)?String(value):value.toFixed(1),dd);el('small',' / '+max,dd);
   }
   return hero;
 }
 function open(id){
   const n=G.newSlugNotices.find(n=>n.id===id);if(!n)return;
   current=n;n.seen=true;portrait={genes:{...n.genes}};
   const hero=renderCard();if(!card.open)card.showModal();renderTray();saveGame();fireworks(hero);close.focus();
 }
 function add(s,source){
   if(!s||!['box','grown'].includes(source)||G.newSlugNotices.some(n=>n.id===s.id))return;
   G.newSlugNotices.push({id:s.id,source,at:Date.now(),seen:false,genes:cleanGenes(s.genes),nickname:s.nickname||'',favorite:!!s.favorite});
   G.newSlugNotices=G.newSlugNotices.slice(-MAX);
   if(!flushPending){flushPending=true;queueMicrotask(()=>{flushPending=false;renderTray();saveGame();live.textContent='มีทากใหม่ กดสัญลักษณ์มุมล่างขวาเพื่อดู';});}
 }
 // ปิดการ์ด = เลิกดูแล้ว → เอาสัญลักษณ์นั้นออกจากถาดไปเลย ไม่ใช่แค่ตัดจุดแดง "ยังไม่ได้ดู"
 card.addEventListener('close',()=>{
   stopFireworks();stopHeroAnim();content.replaceChildren();
   if(current){const idx=G.newSlugNotices.indexOf(current);if(idx>=0){G.newSlugNotices.splice(idx,1);saveGame();}}
   current=null;portrait=null;renderTray();
 });
 card.addEventListener('keydown',e=>e.stopPropagation());
 document.addEventListener('visibilitychange',()=>{
   if(document.hidden){stopFireworks();stopHeroAnim();}
   else if(card.open&&heroCanvas)startHeroAnim(heroCanvas,heroPortrait);
 });
 new MutationObserver(records=>{if(records.some(r=>r.target.tagName==='DIALOG'))positionTray();})
   .observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 window.NewSlugNotices={add,open};renderTray();
})();
