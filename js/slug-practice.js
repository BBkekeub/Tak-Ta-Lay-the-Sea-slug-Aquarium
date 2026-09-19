/* โหมดซ้อม — เข้าตู้แข่งแล้วกดซ้อมได้ทุกเมื่อ ไม่ต้องรอผู้ท้า (ผู้เล่นขอ 2026-09-18)
 *
 * ใช้ร่วมกันทั้ง 4 ตู้ (วิ่ง · ชักเย่อ · กินจุ · ปาหิน) — แต่ละโหมดแค่บอกว่า
 *   ต้องการคู่ซ้อมกี่ตัว และเมื่อผู้เล่นกดเริ่มให้ทำอะไรต่อ
 * คู่ซ้อม = ทากในตู้เดียวกันที่ผู้เล่นเลือกเอง (ไม่ใช่ทากสุ่มของผู้ท้า)
 * ซ้อมไม่มีเดิมพัน ไม่ได้/ไม่เสียทอง — ไว้ฝึกจังหวะและลองว่าทากตัวไหนเหมาะกับเกมไหน
 */
(()=>{
 'use strict';
 let bar=null,owner=null;
 /* แต่ละโหมดรายงานสถานะของตัวเองเข้ามาที่นี่ทุกวินาที · ปุ่มขึ้นให้โหมดที่กำลังอยู่ในตู้ของมัน
    (ตอนแรกใช้ "ใครจับจองก่อนได้ก่อน" แล้วปุ่มไม่ยอมสลับตู้ เพราะเจ้าของเดิมยังไม่ปล่อย) */
 const want=new Map();

 function element(tag,text,parent,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;if(parent)parent.append(e);return e;}
 function removeBar(){bar?.remove();bar=null;owner=null;}

 function render(){
   let pick=null;
   for(const [key,v] of want)if(v.show){pick={key,...v};break;}
   if(!pick){removeBar();return;}
   if(!bar){
     bar=element('div',null,null,'practice-bar');
     element('button','',bar,'tbtn practice-go').type='button';
     element('small','ซ้อมไม่มีเดิมพัน ไม่ได้ ไม่เสียทอง',bar);
   }
   /* วางไว้ใต้ปุ่ม "จัดการทาก" ในแถบซ้ายของตู้ (ผู้เล่นขอ 2026-09-18) · ไม่มีแถบซ้าย = ลอยไว้ล่างจอแบบเดิม */
   const add=document.getElementById('ovAdd'),side=add?.closest('.tank-side');
   const host=side||document.body;
   if(bar.parentElement!==host){host.append(bar);bar.classList.toggle('is-floating',host===document.body);}
   if(side&&add.nextSibling!==bar)side.insertBefore(bar,add.nextSibling);
   owner=pick.key;
   const b=bar.querySelector('.practice-go');
   if(b){b.textContent=pick.label;b.onclick=()=>{try{pick.onClick();}catch(e){console.warn('[practice]',e);}};}
 }
 /* เรียกทุกวินาทีจาก tick ของแต่ละโหมด: โชว์ปุ่มซ้อมเฉพาะตอนอยู่ในตู้ของโหมดนั้นและไม่มีแมตช์ค้าง */
 function sync(key,show,label,onClick){
   want.set(key,{show:!!show,label,onClick});
   render();
 }

 /* หน้าต่างเลือกทาก: ของเรา 1 ตัว + คู่ซ้อมอีก need ตัว จากตู้เดียวกัน */
 function pick({tank,title,need,noteFor,onStart}){
   if(!tank||typeof SlugHover==='undefined')return;
   const slugs=tank.slugs.slice();
   const d=element('dialog',null,document.body,'slug-race-dialog practice-dialog');
   d.setAttribute('aria-label',title);
   element('h2',title,d);
   const total=need+1;
   if(slugs.length<total){
     element('p','ตู้นี้มีทาก '+slugs.length+' ตัว · โหมดซ้อมต้องมีอย่างน้อย '+total+' ตัว (ตัวเรา 1 + คู่ซ้อม '+need+')',d);
     const close=element('button','ปิด',d,'tbtn');close.onclick=()=>{d.close();d.remove();};
     d.showModal();return;
   }
   element('p','เลือกทากของคุณ 1 ตัว แล้วเลือกคู่ซ้อมอีก '+need+' ตัวจากตู้เดียวกัน',d,'practice-note');
   let me=slugs[0].id,spar=slugs.slice(1,1+need).map(s=>s.id);
   const h1=element('h3','ทากของคุณ',d,'practice-head');
   const g1=element('div',null,d);
   const h2=element('h3','คู่ซ้อม '+need+' ตัว',d,'practice-head');
   const g2=element('div',null,d);
   const warn=element('p','',d,'practice-warn');warn.setAttribute('role','alert');
   const actions=element('div',null,d,'tug-actions');
   const cancel=element('button','ยกเลิก',actions,'tbtn');cancel.onclick=()=>{d.close();d.remove();};
   const go=element('button','เริ่มซ้อม',actions,'tbtn practice-start');
   const sub=s=>{try{return noteFor?noteFor(s):'';}catch(e){return '';}};
   const draw=()=>{
     spar=spar.filter(id=>id!==me).slice(0,need);
     SlugHover.cards(g1,{slugs,selected:me,sub,onPick:s=>{me=s.id;draw();}});
     SlugHover.cards(g2,{slugs:slugs.filter(s=>s.id!==me),selected:spar,multi:true,sub,
       onPick:s=>{if(spar.includes(s.id))spar=spar.filter(x=>x!==s.id);else{spar.push(s.id);if(spar.length>need)spar.shift();}draw();return spar;}});
     const ok=spar.length===need;
     go.disabled=!ok;
     warn.textContent=ok?'':'เลือกคู่ซ้อมอีก '+(need-spar.length)+' ตัว';
   };
   go.onclick=()=>{
     if(spar.length!==need)return;
     const mine=slugs.find(s=>s.id===me),others=spar.map(id=>slugs.find(s=>s.id===id)).filter(Boolean);
     if(!mine||others.length!==need)return;
     d.close();d.remove();
     onStart(mine,others);
   };
   d.addEventListener('cancel',()=>{d.remove();});
   d.showModal();draw();
 }

 window.SlugPractice={sync,pick,close:removeBar};
})();
