/* Layer list performance.
   The base list puts every piece's FULL image (data URL, up to several MB) into innerHTML and was rebuilt on every
   pointer move while dragging a piece — ~100 ms per move with imported art. Now:
   1) the list is rebuilt only when something it shows changes (ids, names, visibility, lock, groups, selection, species);
   2) row thumbnails use a 48 px copy made once per image instead of the full-size source. */
(()=>{
const THUMB=new Map(),THUMB_MAX=200;
function thumbOf(img,size=48){const src=SRC[img];if(typeof src!=='string'||src.length<4096||!src.startsWith('data:'))return src;   // paths / small images are already cheap
 const ck=size+'|'+src;let t=THUMB.get(ck);if(t)return t;const im=IMG[img];if(!im?.naturalWidth)return src;
 try{const s=size/Math.max(im.naturalWidth,im.naturalHeight),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.naturalWidth*s));c.height=Math.max(1,Math.round(im.naturalHeight*s));c.getContext('2d').drawImage(im,0,0,c.width,c.height);t=c.toDataURL('image/png')}catch(_){return src}
 THUMB.set(ck,t);while(THUMB.size>THUMB_MAX)THUMB.delete(THUMB.keys().next().value);return t}
/* palette tiles (≈44 px tall) also got the full-size art: 8 MB of data URLs laid out on every palette rebuild */
const paletteBase=buildPalette;
buildPalette=function(){const swapped=[];for(const k of Object.keys(PARTS)){const img=PARTS[k].img;if(img==null||swapped.some(s=>s[0]===img))continue;const t=thumbOf(img,112);if(t!==SRC[img]){swapped.push([img,SRC[img]]);SRC[img]=t}}
 try{paletteBase()}finally{for(const [img,src] of swapped)SRC[img]=src}};
const listBase=renderList;let listSig=null;
renderList=function(){
 const box=$('layers');
 const sig=JSON.stringify([doc.layers.map(L=>[L.id,L.name,L.vis,L.lock,L.gid,L.part,L.species,PARTS[L.part]?.img]),doc.groups.map(g=>[g.id,g.name,g.vis,g.lock,g.collapsed]),sel,selG,typeof speciesNames==='object'?speciesNames:null]);
 if(sig===listSig&&box.childElementCount&&!box.querySelector('.dropline,.dragging'))return;   // nothing the list shows has changed
 listSig=sig;
 // swap in small thumbnails only while the base builds its HTML, then restore the real sources
 const swapped=[];for(const L of doc.layers){const img=PARTS[L.part]?.img;if(img==null||swapped.some(s=>s[0]===img))continue;const t=thumbOf(img);if(t!==SRC[img]){swapped.push([img,SRC[img]]);SRC[img]=t}}
 try{listBase()}finally{for(const [img,src] of swapped)SRC[img]=src}
};

/* Export JSON: ~9 feature layers each did JSON.parse(#out) → edit → JSON.stringify back. With embedded images the text
   is several MB, so every edit cost ~0.5 s. Now the layers hand the same object along (one real stringify at the end),
   and the rebuild waits until editing pauses. Anything that reads #out gets an up-to-date value immediately.
   Text the user types or pastes into #out is never overwritten by a pending rebuild. */
const outEl=$('out'),valueProp=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');
const exportChain=exportJSON,TOKEN='@@custom-editor-export@@';let pending=false,timer=0;
function runExport(){pending=false;clearTimeout(timer);let obj=null;const parse=JSON.parse,stringify=JSON.stringify;
 JSON.stringify=function(v,r,s){if(s===1&&r==null&&v&&typeof v==='object'&&Array.isArray(v.layers)){obj=v;return TOKEN}return stringify.apply(this,arguments)};
 JSON.parse=function(t){if(t===TOKEN&&obj)return obj;return parse.apply(this,arguments)};
 try{exportChain()}finally{JSON.stringify=stringify;JSON.parse=parse}
 if(obj&&fullText===TOKEN)outEl.value=stringify(obj,null,1)}   // through the setter below: keeps the full text + shows the short form
exportJSON=function(){pending=true;clearTimeout(timer);timer=setTimeout(runExport,250)};
/* The visible box shows a SHORT form: embedded images (MBs of base64) become a size label.
   Laying out 4 MB of text in a <textarea> cost ~400 ms every time the layout changed.
   Reading .value (copy, download, "load from box") still gets the full JSON — unless the user typed/pasted their own. */
const BIG=150000;let fullText=valueProp.get.call(outEl),userEdited=false;
const shortForm=t=>t.length<BIG?t:t.replace(/"data:([\w\/+.-]+);base64,[A-Za-z0-9+\/=]{400,}"/g,(m,type)=>'"data:'+type+';base64,…(ฝังรูป '+Math.round(m.length*.75/1024)+' KB — ใช้ปุ่มคัดลอก/ดาวน์โหลดเพื่อได้ข้อมูลเต็ม)"');
Object.defineProperty(outEl,'value',{configurable:true,
 get(){if(pending)runExport();return userEdited?valueProp.get.call(this):fullText},
 set(v){fullText=String(v);userEdited=false;showBox()}});
/* Even the short form is ~1,000 lines; a visible <textarea> that size made EVERY text change elsewhere on the page
   (status line, card headers) relayout for ~60 ms on the user's machine. So while the box is not focused it shows
   only the first lines; clicking into it shows everything. Copy/download/"load from box" always use the full text. */
const PREVIEW_LINES=40;
function showBox(){if(userEdited)return;const short=shortForm(fullText);let shown=short;
 if(document.activeElement!==outEl){const lines=short.split('\n');if(lines.length>PREVIEW_LINES)shown=lines.slice(0,PREVIEW_LINES).join('\n')+'\n… (ผังยาว '+lines.length+' บรรทัด — คลิกในช่องนี้เพื่อดูทั้งหมด · ปุ่มคัดลอก/ดาวน์โหลดได้ผังเต็มเสมอ)'}
 if(valueProp.get.call(outEl)!==shown)valueProp.set.call(outEl,shown)}
outEl.addEventListener('focus',()=>{if(pending)runExport();showBox()});
outEl.addEventListener('blur',showBox);
outEl.style.contentVisibility='auto';
outEl.addEventListener('input',()=>{pending=false;clearTimeout(timer);userEdited=true});
/* copying by hand from a shortened box would lose the images → put the full text on the clipboard instead */
outEl.addEventListener('copy',e=>{if(userEdited||fullText.length<BIG||!e.clipboardData)return;const sel=outEl.selectionEnd-outEl.selectionStart;if(sel<valueProp.get.call(outEl).length*.9)return;e.preventDefault();e.clipboardData.setData('text/plain',fullText);toast('คัดลอกผังเต็ม (รวมรูปที่ฝัง) แล้ว')});
addEventListener('pagehide',()=>{if(pending)runExport()});

/* Autosave writes the whole layout (several MB with embedded art) to localStorage: ~100 ms on the user's machine,
   after every single edit. Now it runs once editing pauses, and always before the page is hidden/closed/reloaded. */
const saveNow=save;let saveTimer=0,saveDue=false;
function flushSave(){if(!saveDue)return;saveDue=false;clearTimeout(saveTimer);saveNow()}
save=function(){saveDue=true;clearTimeout(saveTimer);saveTimer=setTimeout(flushSave,500)};
addEventListener('pagehide',flushSave);addEventListener('beforeunload',flushSave);
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushSave()});
})();
