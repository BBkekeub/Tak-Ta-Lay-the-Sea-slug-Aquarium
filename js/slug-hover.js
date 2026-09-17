/* ============================================================
   slug-hover.js — แผงข้อมูลทาก + การ์ดเลือกทาก ใช้ร่วม "ทุกหน้าเลือกทาก"
   (เดิมมีเฉพาะหน้าเลือกทากผสมพันธุ์ ย้ายออกมาเป็นของกลาง หน้าตา/พฤติกรรมจึงเหมือนกันทุกหน้า)

   · เมาส์: ชี้การ์ด = โชว์แผง · ออกจากการ์ด = ซ่อน · คีย์บอร์ด: โฟกัสการ์ด = โชว์
   · จอสัมผัส: กดค้าง HOLD_MS = โชว์แผง และ "ไม่นับเป็นการแตะเลือก" · แตะที่อื่น = ซ่อน

   วิธีใช้
     SlugHover.mark(การ์ด, ทาก)   ติดป้ายว่าการ์ดนี้คือทากตัวไหน (เรียกตอนเรนเดอร์การ์ด)
     SlugHover.attach(กล่องครอบ)  ผูกเหตุการณ์ครั้งเดียวที่กล่องนอกสุด (เรียกซ้ำได้ ไม่ผูกซ้อน)
     SlugHover.cards(กล่อง,{...})  กริดการ์ดเลือกทาก 1 ตัวสำเร็จรูป — ใช้แทน <select>
                                   (ตัวเลือกใน <select> ชี้ดูข้อมูลไม่ได้ และไม่มีรูปทาก)

   ข้อมูลในแผงมาจาก geneCardRows() ตัวเดียวกับการ์ดยีนในตู้ (tank-view.js) — ตรงกันทุกช่อง
   ⚠️ แผงต้องแปะ "ข้างใน" <dialog> ที่การ์ดอยู่ — โมดอลจาก showModal() อยู่ใน top layer
      ถ้าแปะที่ body แผงจะจมใต้โมดอล ไม่ว่าจะใส่ z-index เท่าไหร่ก็ไม่โผล่
   ⚠️ สคริปต์ธรรมดา ใช้ global scope ร่วมทุกไฟล์ — ชื่อระดับบนสุดมีแค่ SlugHover ตัวเดียว
      (เคยพลาด: ชื่อ HOLD_MS ซ้ำกับ tank-view.js แล้วทั้งไฟล์ไม่ทำงาน)
   ============================================================ */
const SlugHover=(()=>{
 const HOLD_MS=420,SLOP=10;        // เลื่อนนิ้วเกิน 10px = ตั้งใจเลื่อนรายการ ไม่ใช่กดค้าง
 const panel=document.createElement('div');
 panel.className='slug-hover';panel.hidden=true;panel.setAttribute('aria-hidden','true');
 document.head.append(Object.assign(document.createElement('style'),{textContent:`
.slug-hover{position:fixed;z-index:60;width:236px;pointer-events:none;box-sizing:border-box;
 background:rgba(12,29,34,.97);border:1px solid rgba(95,168,174,.55);border-radius:10px;padding:9px 11px;
 box-shadow:0 8px 24px #0009;font-size:12px;line-height:1.55;color:#E4EDEC;text-align:left}
.slug-hover h4{margin:0 0 5px;font:500 11px "IBM Plex Mono",monospace;color:#D9A03C;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slug-hover p{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0}
.slug-hover p>span{color:#9CB4B7;white-space:nowrap}
.slug-hover p>b{display:flex;align-items:center;gap:6px;justify-content:flex-end;
 font:500 12px "IBM Plex Mono",monospace;text-align:right;min-width:0}
.slug-hover p>b.buffed{color:#F0D08A}
.slug-hover i{flex:none;width:22px;height:10px;border-radius:3px;border:1px solid rgba(255,255,255,.2)}
/* กดค้างบนการ์ดต้องไม่ไปลากเลือกข้อความ/เด้งแถบ callout ของ iOS ขึ้นมาแทน (ช่องพิมพ์ในการ์ดยังเลือกข้อความได้ปกติ) */
[data-slug-hover]{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
[data-slug-hover] input,[data-slug-hover] textarea{-webkit-user-select:text;user-select:text}
/* ---- กริดการ์ดเลือกทาก (SlugHover.cards) — หน้าตาเดียวกับการ์ดหน้าเลือกทากผสมพันธุ์ ---- */
.slug-pick-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px;
 max-height:min(40vh,330px);overflow:auto;margin:8px 0 12px;padding:2px}
.slug-pick{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;padding:7px;
 border:1px solid #50696a;border-radius:12px;background:radial-gradient(ellipse at center,#365657,#182a2d);
 color:#e8e0cb;font:inherit;font-size:12px;line-height:1.35;cursor:pointer}
.slug-pick canvas{display:block;width:100%;height:auto;aspect-ratio:180/132}
.slug-pick b{max-width:100%;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slug-pick small{color:#bcd0c8;font-size:11px;text-align:center}
.slug-pick[aria-pressed=true]{border-color:#dfb660;background:radial-gradient(ellipse at center,#70643a,#263630)}
.slug-pick[aria-disabled=true]{opacity:.5;cursor:default}
.slug-pick:focus-visible{outline:2px solid #ffe19b;outline-offset:2px}
.slug-pick-empty{grid-column:1/-1;margin:0;padding:14px 8px;color:#c9bda2;font-size:13px}
`}));
 const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 function show(card,s){
  if(!card||!s||typeof geneCardRows!=='function')return;          // tank-view.js ยังไม่โหลด = ไม่ต้องโชว์
  const g=typeof foodGenes==='function'?foodGenes(s):s.genes;
  panel.innerHTML='<h4>'+esc(slugNick(s))+' · '+esc(s.id)+'</h4>'+geneCardRows(s).map(r=>{
    const text=r.fit?(r.v.length?r.v.join(' + '):'—'):String(r.v);
    /* ยีนที่กำลังโดนบัฟอาหารโชว์เป็นสีทอง เหมือนการ์ดยีนหน้าตู้ — กันเข้าใจผิดว่าเป็นค่าถาวร */
    const buffed=r.gene&&s.genes&&g[r.gene]!==s.genes[r.gene];
    return '<p><span>'+esc(r.l)+'</span><b'+(buffed?' class="buffed"':'')+'>'+esc(text)
      +(r.k==='swatch'?'<i style="background:'+esc(r.sw)+'"></i>':'')+'</b></p>';
  }).join('');
  const host=card.closest('dialog')||document.body;
  if(panel.parentElement!==host)host.append(panel);
  panel.hidden=false;
  const c=card.getBoundingClientRect(),w=panel.offsetWidth,h=panel.offsetHeight,pad=8;
  /* ขวาการ์ดก่อน → ซ้าย → ถ้าการ์ดกว้างเต็มแถว (เช่นรายการตลาดโลก) สองข้างไม่พอ ไปวางใต้/เหนือการ์ดแทน
     ไม่งั้นแผงจะไปทับตัวการ์ดที่กำลังชี้อยู่พอดี */
  let x=c.right+10,y=c.top;
  if(x+w>innerWidth-pad){x=c.left-w-10;
    if(x<pad){x=c.left;y=c.bottom+8+h<=innerHeight-pad?c.bottom+8:c.top-h-8;}}
  panel.style.left=Math.max(pad,Math.min(innerWidth-w-pad,x))+'px';
  panel.style.top=Math.max(pad,Math.min(innerHeight-h-pad,y))+'px';
 }
 function hide(){panel.hidden=true;}
 function mark(el,s){if(el&&s){el.setAttribute('data-slug-hover','');el._hoverSlug=s;}return el;}
 const cardOf=e=>e.target.closest?.('[data-slug-hover]');

 function attach(root){
  if(!root||root._slugHover)return root;root._slugHover=true;
  let timer=null,at=null,fired=false;
  const cancel=()=>{clearTimeout(timer);timer=null;at=null;};
  root.addEventListener('pointerover',e=>{
    if(e.pointerType==='touch')return;                              // จอสัมผัสใช้กดค้างแทน
    const c=cardOf(e);
    /* ชี้ไปที่ช่องว่างระหว่างการ์ด = ซ่อน — กันแผงค้างตอนการ์ดถูกเรนเดอร์ใหม่ใต้เมาส์ (pointerout ไม่มาจากตัวที่ถูกลบ) */
    if(c)show(c,c._hoverSlug);else hide();
  });
  root.addEventListener('pointerout',e=>{const c=cardOf(e);if(c&&!c.contains(e.relatedTarget))hide();});
  root.addEventListener('focusin',e=>{const c=cardOf(e);if(c)show(c,c._hoverSlug);});
  root.addEventListener('focusout',hide);
  root.addEventListener('scroll',hide,true);                        // เลื่อนรายการแล้วตำแหน่งแผงเพี้ยน ซ่อนไปเลย
  root.addEventListener('close',hide);
  /* จอสัมผัส: แตะเร็ว = เลือกเหมือนเดิม · กดค้าง = โชว์แผงแล้วค้างไว้จนกว่าจะแตะที่อื่น */
  root.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch')return;
    hide();
    const c=cardOf(e);if(!c)return;
    at={x:e.clientX,y:e.clientY};fired=false;clearTimeout(timer);
    timer=setTimeout(()=>{fired=true;show(c,c._hoverSlug);},HOLD_MS);
  },true);
  root.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch'&&at&&Math.hypot(e.clientX-at.x,e.clientY-at.y)>SLOP)cancel();
  },true);
  root.addEventListener('pointerup',e=>{if(e.pointerType==='touch')cancel();},true);
  root.addEventListener('pointercancel',cancel,true);
  /* กดค้างแล้วปล่อย ต้องไม่กลายเป็นการเลือก/ติ๊กทาก — ดักในเฟส capture ก่อนถึง onclick ของการ์ด */
  root.addEventListener('click',e=>{if(!fired)return;fired=false;e.preventDefault();e.stopPropagation();},true);
  /* กดค้างบนมือถือปกติจะเด้งเมนู "คัดลอก/ค้นหา" มาทับ — ปิดเฉพาะบนการ์ด */
  root.addEventListener('contextmenu',e=>{if(cardOf(e))e.preventDefault();});
  return root;
 }

 /* กริดการ์ดเลือกทาก 1 ตัว — รูปทาก + ชื่อ + บรรทัดเสริม · ชี้/กดค้าง = แผงยีน
    opts: slugs, selected (id), onPick(s), sub(s)→ข้อความใต้ชื่อ, disabled(s)→เหตุผลที่เลือกไม่ได้|'' , empty
    ตัวที่เลือกไม่ได้ใช้ aria-disabled ไม่ใช่ disabled — ปุ่ม disabled ไม่รับเหตุการณ์เมาส์ เลยชี้ดูข้อมูลไม่ได้ */
 /* multi:true = เลือกได้หลายตัว · selected เป็นอาร์เรย์ id และ onPick ต้องคืนอาร์เรย์ id ที่เลือกอยู่หลังกด */
 function cards(host,{slugs=[],selected=null,onPick=()=>{},sub=null,disabled=null,empty='ยังไม่มีทาก',multi=false}={}){
  host.classList.add('slug-pick-grid');host.replaceChildren();attach(host);
  if(!slugs.length){const p=document.createElement('p');p.className='slug-pick-empty';p.textContent=empty;host.append(p);return host;}
  const isOn=(id,sel)=>multi?(sel||[]).includes(id):id===sel;
  for(const s of slugs){
    const b=document.createElement('button');b.type='button';b.className='slug-pick';
    b.setAttribute('aria-pressed',String(isOn(s.id,selected)));
    const why=disabled?disabled(s):'';if(why)b.setAttribute('aria-disabled','true');
    const c=document.createElement('canvas');c.width=180;c.height=132;c.setAttribute('aria-hidden','true');b.append(c);
    try{if(typeof drawSlugPortrait==='function')drawSlugPortrait(c,s);}catch(e){}
    const n=document.createElement('b');n.textContent=slugNick(s);b.append(n);
    const line=why||(sub?sub(s):'');
    if(line){const m=document.createElement('small');m.textContent=line;b.append(m);}
    mark(b,s);
    b.onclick=()=>{
      if(why)return;
      if(multi){const ids=onPick(s);for(const x of host.querySelectorAll('.slug-pick'))x.setAttribute('aria-pressed',String(isOn(x._hoverSlug?.id,ids)));return;}
      for(const x of host.querySelectorAll('.slug-pick'))x.setAttribute('aria-pressed',String(x===b));
      onPick(s);
    };
    host.append(b);
  }
  return host;
 }
 return {mark,attach,show,hide,cards};
})();
