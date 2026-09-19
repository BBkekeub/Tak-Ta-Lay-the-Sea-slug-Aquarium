/* ============================================================
   access-ui.js — หน้าตั้งค่า "ใครผ่านได้" ของประตูกับเคาน์เตอร์ + ไอคอนเตือนมุมขวาล่าง
   ผู้เล่นสั่ง 2026-09-20:
     · ประตู  — กำหนดได้ว่าเป็นทางเข้า/ทางออก และให้ใครผ่านได้บ้าง
                ถ้าไม่มีทางออกเลย ต้องเตือนว่า "จะใช้ประตูนี้ออกแทน"
     · เคาน์เตอร์ — กำหนดได้ว่าใครเข้ามาติดต่อได้
     · ไม่มีเคาน์เตอร์ที่เปิดให้ลูกค้าเลยสักตัว → ขึ้นสัญลักษณ์เตือน (รูปคน + เครื่องหมายตกใจ) มุมขวาล่าง

   เจ้าของข้อมูล: d.dir/d.allow บนประตู (entrance.js · เซฟใน save.js)
                  o.allow บนเคาน์เตอร์ (วัตถุใน G.objs · เซฟใน save.js)
   ไฟล์นี้ไม่ถือ state ของตัวเอง นอกจากตัวชี้ว่ากำลังเปิดหน้าไหนอยู่

   ⚠️ ไม่เพิ่ม "โหมด" ใหม่ (ดู js/modes.js) — เป็นแค่ <dialog> โมดอล
      การคลิกบนแคนวาสจึงไม่เปลี่ยนความหมาย ไม่ต้องลงทะเบียนกับ APP_MODES
   ============================================================ */
(()=>{
 'use strict';

 /* ---------- โครงหน้าต่าง (สร้างครั้งเดียวตอนโหลด ไม่สร้างใหม่ทุกครั้งที่เปิด) ---------- */
 const dlg=document.createElement('dialog');
 dlg.id='accessDialog';dlg.className='access-dialog';
 const head=document.createElement('header');
 const title=document.createElement('h2');title.id='accessTitle';
 const close=document.createElement('button');close.type='button';close.className='tbtn';
 close.textContent='✕';close.setAttribute('aria-label','ปิด');close.onclick=()=>dlg.close();
 head.append(title,close);
 const body=document.createElement('div');body.className='access-body';
 const note=document.createElement('p');note.className='access-note';note.setAttribute('role','status');
 const foot=document.createElement('div');foot.className='access-foot';
 dlg.append(head,body,note,foot);
 dlg.setAttribute('aria-labelledby','accessTitle');
 document.body.append(dlg);

 let target=null,mode='';                     // วัตถุที่กำลังตั้งค่า + ชนิด ('door' | 'counter')

 const el=(tag,cls,text,parent)=>{const e=document.createElement(tag);if(cls)e.className=cls;
   if(text!=null)e.textContent=text;if(parent)parent.append(e);return e;};

 /* ---------- แถวติ๊ก "ใครผ่านได้" ----------
    ⚠️ กฎ UI: อัปเดตเฉพาะ field ที่เปลี่ยน ห้ามสร้าง DOM ใหม่ทั้งก้อนตอนติ๊ก
       ไม่งั้น focus หลุดจากช่องที่เพิ่งกด (อ่านไม่ออกด้วยคีย์บอร์ด/สกรีนรีดเดอร์) */
 function allowRows(host,rule,kinds,onChange){
  for(const a of kinds){
   const row=el('label','access-row',null,host);
   const box=document.createElement('input');box.type='checkbox';box.checked=accessAllows(rule,a.k);
   const text=el('span','access-row-text',null,row);
   el('strong',null,a.icon+' '+a.label,text);
   el('small',null,a.desc,text);
   box.onchange=()=>{rule[a.k]=box.checked;onChange();};
   row.prepend(box);
  }
 }

 /* ---------- หน้าตั้งค่าประตู ---------- */
 function renderDoor(){
  const d=target;
  title.textContent='ประตู · กำแพง'+(d.side==='north'?'เหนือ':'ตะวันตก')+' ช่องที่ '+(d.offset/SUB+1);
  body.replaceChildren();foot.replaceChildren();

  el('h3','access-head','ประตูนี้ใช้ทำอะไร',body);
  const ways=el('div','access-ways',null,body);
  const wayButtons=[];
  for(const [key,label] of DOOR_WAYS){
   const b=el('button','tbtn access-way',label,ways);b.type='button';
   b.setAttribute('aria-pressed',String(doorWay(d)===key));
   b.onclick=()=>{
    d.dir=key;doorRevision++;
    for(const q of wayButtons)q.el.setAttribute('aria-pressed',String(q.key===key));
    commit();
   };
   wayButtons.push({key,el:b});
  }

  el('h3','access-head','ใครเดินผ่านประตูนี้ได้',body);
  d.allow=d.allow||accessAll();
  allowRows(body,d.allow,ACCESS_KINDS,commit);

  const move=el('button','tbtn','🚪 ย้ายประตูบานนี้',foot);move.type='button';
  move.onclick=()=>{
   /* ย้าย = เก็บบานเดิมแบบคืนเงินเต็มจำนวนที่จ่ายมา แล้วเข้าโหมดวางใหม่
      คืนเต็มเพราะผู้เล่นไม่ได้ "ขายทิ้ง" แค่ย้ายที่ — หักครึ่งจะกลายเป็นค่าปรับที่ไม่มีใครสั่ง */
   const a=doorList(),i=a.indexOf(d);if(i<0)return;
   const refund=d.paid||0;a.splice(i,1);doorRevision++;
   if(refund)addCoin(refund);
   dlg.close();saveGame();syncHUD();placeEntrance();
  };
  const del=el('button','tbtn access-danger','🗑 เก็บประตู',foot);del.type='button';
  del.onclick=()=>{const keep=d;dlg.close();removeEntrance(keep);};
 }

 /* ---------- หน้าตั้งค่าเคาน์เตอร์ ---------- */
 function renderCounter(){
  const o=target;
  title.textContent='เคาน์เตอร์ · ใครเข้ามาติดต่อได้';
  body.replaceChildren();foot.replaceChildren();
  el('h3','access-head','เปิดรับใครบ้าง',body);
  o.allow=o.allow||accessAll();
  allowRows(body,o.allow,ACCESS_KINDS.filter(a=>a.counter),commit);
  const hint=el('p','access-hint',null,body);
  hint.textContent='ผู้ท้าแข่งไม่เข้าคิวเคาน์เตอร์ — พวกนั้นตรงไปที่ตู้แข่ง ตั้งสิทธิ์ของพวกเขาที่ประตูแทน';

  const move=el('button','tbtn','✋ ยกเคาน์เตอร์ไปวางที่อื่น',foot);move.type='button';
  move.onclick=()=>{
   dlg.close();
   if(peopleOn){toast('ปิดร้านก่อนย้ายของ','bad');return;}
   moving=o;movingByClick=true;grab=null;cv.classList.add('placing');
   toast('ยก'+o.def.name+' — คลิกอีกครั้งเพื่อวาง · R หมุน · Esc ยกเลิก','good');
  };
  const del=el('button','tbtn access-danger','🗑 เก็บเคาน์เตอร์',foot);del.type='button';
  del.onclick=()=>{const keep=o;dlg.close();removeObj(keep);};
 }

 /* ---------- ข้อความเตือนใต้หน้าต่าง ---------- */
 function refreshNote(){
  const lines=[];
  if(mode==='door'){
   const d=target;
   const blocked=ACCESS_KINDS.filter(a=>!accessAllows(d.allow,a.k));
   if(blocked.length===ACCESS_KINDS.length)lines.push('⚠️ ประตูนี้ไม่ให้ใครผ่านเลย — เท่ากับกำแพงทึบ');
   /* คำเตือนที่ผู้เล่นสั่งไว้ตรง ๆ: ตั้งเป็นทางเข้าอย่างเดียว แต่ทั้งร้านไม่มีทางออกให้คนกลุ่มนั้น
      ระบบจะไม่ขังคนไว้ — doorsFor() จะถอยมาใช้บานที่มีอยู่เป็นทางออกแทน ต้องบอกให้รู้ */
   const stuck=ACCESS_KINDS.filter(a=>accessAllows(d.allow,a.k)&&lacksExitFor(a.k));
   if(stuck.length)lines.push('⚠️ ไม่มีประตูบานไหนเป็นทางออกสำหรับ '+stuck.map(a=>a.label).join(' · ')+
     ' — ระบบจะใช้ประตูนี้เป็นทางออกแทน เพื่อไม่ให้ติดค้างอยู่ในร้าน');
   if(!doorsFor('cust','in').length)lines.push('⚠️ ตอนนี้ไม่มีประตูบานไหนให้ลูกค้าเข้าร้านได้เลย');
  }else if(mode==='counter'){
   if(noCounterForCustomers())lines.push('⚠️ ไม่มีเคาน์เตอร์ตัวไหนเปิดให้ลูกค้าเลย — ลูกค้าจะเสนอซื้อทากไม่ได้');
   if(!countersFor('peddler').length)lines.push('· ไม่มีที่ให้พ่อค้าเร่ยื่นขายทาก');
   if(!countersFor('wholesale').length)lines.push('· ไม่มีที่ให้พ่อค้าส่งมารับซื้อยกล็อต');
  }
  const text=lines.join('\n');
  if(note.textContent!==text)note.textContent=text;          // ข้อความเดิม = ไม่แตะ DOM
  note.hidden=!text;
 }

 function commit(){refreshNote();saveGame();syncAccessWarning();if(typeof syncPeopleBtn==='function')syncPeopleBtn();}

 function open(kind,obj){
  if(!obj)return;
  target=obj;mode=kind;
  if(kind==='door')renderDoor();else renderCounter();
  refreshNote();
  if(!dlg.open)dlg.showModal();
 }
 dlg.addEventListener('close',()=>{target=null;mode='';syncAccessWarning();});

 window.openDoorSettings   =d=>open('door',d);
 window.openCounterSettings=o=>open('counter',o);

 /* ============================================================
    สัญลักษณ์เตือนมุมขวาล่าง — รูปคน + เครื่องหมายตกใจ
    ขึ้นเมื่อ "ลูกค้าเข้ามาใช้บริการไม่ได้" ซึ่งมีได้สองสาเหตุ
      · ไม่มีเคาน์เตอร์ตัวไหนเปิดให้ลูกค้า
      · ไม่มีประตูบานไหนให้ลูกค้าเข้า
    ⚠️ เป็น SVG ฝังในหน้า ไม่ใช่อิโมจิ — อิโมจิคนละแบบในแต่ละเครื่อง
       และไม่มีอิโมจิตัวไหนที่เป็น "คน + ตกใจ" ในตัวเดียว
    ⚠️ กฎประสิทธิภาพ: ไม่ตรวจทุกเฟรม เรียกจาก syncHUD()/ปิดหน้าต่าง/เปิด-ปิดร้าน เท่านั้น
       และเขียน DOM เฉพาะตอนข้อความเปลี่ยนจริง
    ============================================================ */
 const badge=document.createElement('button');
 badge.type='button';badge.id='accessWarn';badge.className='access-warn';badge.hidden=true;
 badge.innerHTML=
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
  +'<circle cx="9" cy="5.2" r="3.1"/>'
  +'<path d="M3.3 21v-4.6A5.7 5.7 0 0 1 9 10.7a5.7 5.7 0 0 1 5.7 5.7V21z"/>'
  +'<rect class="bang" x="17.4" y="6" width="3.2" height="9.2" rx="1.6"/>'
  +'<circle class="bang" cx="19" cy="19" r="1.9"/>'
  +'</svg>';
 document.body.append(badge);

 let warnText='';
 function accessProblems(){
  const out=[];
  if(typeof doorsFor==='function'&&doorList().length&&!doorsFor('cust','in').length)
   out.push('ไม่มีประตูบานไหนเปิดให้ลูกค้าเข้าร้าน');
  if(typeof noCounterForCustomers==='function'&&noCounterForCustomers())
   out.push('ไม่มีเคาน์เตอร์ตัวไหนเปิดให้ลูกค้าเข้ามาเสนอซื้อ');
  return out;
 }
 function syncAccessWarning(){
  let problems=[];
  try{problems=accessProblems();}catch(e){console.warn('[access] ตรวจสิทธิ์ไม่สำเร็จ',e);return;}
  const text=problems.join(' · ');
  if(text===warnText)return;                                  // ไม่เปลี่ยน = ไม่แตะ DOM เลย
  warnText=text;
  badge.hidden=!text;
  if(text){
   const label='ลูกค้าเข้าใช้บริการไม่ได้: '+text;
   badge.title=label;badge.setAttribute('aria-label',label);
  }
 }
 badge.onclick=()=>{
  const problems=accessProblems();
  if(!problems.length){syncAccessWarning();return;}
  toast('ลูกค้าใช้บริการไม่ได้ — '+problems.join(' · ')+' (แตะประตู/เคาน์เตอร์ในโหมดก่อสร้างเพื่อเปิดสิทธิ์)','bad');
 };
 window.syncAccessWarning=syncAccessWarning;
 window.addEventListener('load',syncAccessWarning);
})();
