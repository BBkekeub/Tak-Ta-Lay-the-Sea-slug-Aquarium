/* Latest five acquisitions. Only IDs and a small birth-gene snapshot are saved.
 * Live slugs own favorites/names; portraits render once and fireworks expire.
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
 let current=null,portrait=null,flushPending=false,animations=[];
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
 function renderCard(){
   if(!current)return;stopFireworks();content.replaceChildren();
   const s=find(current.id),isBox=current.source==='box';
   title.textContent=isBox?'ได้ทากใหม่แล้ว!':'ตัวอ่อนรอดและโตแล้ว!';
   const hero=el('div',null,content);hero.className='new-slug-hero '+(isBox?'is-box':'is-grown');
   el('span',isBox?'🐚 จากกล่องสุ่ม':'🦋 ตัวอ่อนโตเต็มวัย',hero).className='new-slug-badge';
   const canvas=el('canvas',null,hero);canvas.width=560;canvas.height=260;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','รูปทาก '+name(current));
   const sprite=slugSprite(portrait);if(sprite){const scale=Math.min(460/sprite.c.width,210/sprite.c.height),w=sprite.c.width*scale,h=sprite.c.height*scale;
     canvas.getContext('2d').drawImage(sprite.c,(560-w)/2,(260-h)/2,w,h);}
   const heading=el('h3',name(current),content);heading.className='new-slug-name';
   el('p',current.id,content).className='new-slug-id';
   const controls=el('div',null,content);controls.className='new-slug-controls';
   if(s)SlugBrowser.heart(controls,s,()=>{
     current.nickname=s.nickname||'';current.favorite=!!s.favorite;saveGame();renderCard();renderTray();
   });else el('p','ทากตัวนี้ไม่อยู่ในร้านแล้ว แสดงข้อมูลเมื่อได้รับ',controls);
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
   stopFireworks();content.replaceChildren();
   if(current){const idx=G.newSlugNotices.indexOf(current);if(idx>=0){G.newSlugNotices.splice(idx,1);saveGame();}}
   current=null;portrait=null;renderTray();
 });
 card.addEventListener('keydown',e=>e.stopPropagation());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopFireworks();});
 new MutationObserver(records=>{if(records.some(r=>r.target.tagName==='DIALOG'))positionTray();})
   .observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 window.NewSlugNotices={add,open};renderTray();
})();
