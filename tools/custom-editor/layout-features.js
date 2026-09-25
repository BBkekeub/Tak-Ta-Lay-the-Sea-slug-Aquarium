/* Workspace layout: full-window stage, resizable/collapsible side panel, foldable cards.
   Event-driven only (no per-frame work); UI preferences live in localStorage as a per-viewer convenience. */
(()=>{
const UI_KEY='custom-editor-ui-v1',RAIL_MIN=260,RAIL_MAX=720,RAIL_DEFAULT=360;
let ui={};try{ui=JSON.parse(localStorage.getItem(UI_KEY)||'{}')||{}}catch{ui={}}
const saveUI=()=>{try{localStorage.setItem(UI_KEY,JSON.stringify(ui))}catch{}};
ui.fold=ui.fold&&typeof ui.fold==='object'?ui.fold:{};

const css=document.createElement('style');css.textContent=`
@media (min-width:900px){
 body.app-shell{overflow:hidden}
 body.app-shell .wrap{max-width:none;height:100vh;padding:10px 12px;gap:8px}
 body.app-shell header{flex-wrap:nowrap;align-items:center}
 body.app-shell h1{font-size:19px}
 body.app-shell .eyebrow,body.app-shell .sub{display:none}
 body.app-shell .main{flex:1;min-height:0;grid-template-columns:minmax(0,1fr) 8px var(--rail-w,${RAIL_DEFAULT}px);gap:0;align-items:stretch}
 body.app-shell.rail-hidden .main{grid-template-columns:minmax(0,1fr) 0 0}
 body.app-shell.rail-hidden .rail,body.app-shell.rail-hidden .rail-split{display:none}
 body.app-shell .stage-col{display:flex;flex-direction:column;gap:8px;min-height:0}
 body.app-shell .stage-col>.card{margin-top:0!important;flex:none;max-height:45%;overflow:auto}
 body.app-shell .stage-card{flex:1;min-height:0;display:flex;flex-direction:column}
 body.app-shell .stage{flex:1;min-height:0;aspect-ratio:auto}
 body.app-shell .rail{position:static;max-height:none;height:100%;min-height:0;overflow:auto;padding:0 2px 0 0}
 body.app-shell footer{display:none}
 .rail-split{cursor:col-resize;position:relative;touch-action:none}
 .rail-split::after{content:"";position:absolute;left:3px;top:0;bottom:0;width:2px;border-radius:2px;background:var(--line-soft);transition:background .12s}
 .rail-split:hover::after,.rail-split.drag::after{background:var(--teal)}
}
@media (max-width:899px){.rail-split,#bRail{display:none}}
.shell-tools{display:flex;gap:6px;align-items:center;margin-left:auto}
.rail-head{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.rail-head input{flex:1;min-width:120px;font-family:inherit!important}
.card>h2.fold-h{cursor:pointer;user-select:none;margin-bottom:10px;justify-content:flex-start}
.card>h2.fold-h>span{margin-left:auto}
.card>h2.fold-h::before{content:"▾";font-family:system-ui;font-size:11px;color:var(--muted);margin-right:2px;transition:transform .12s}
.card>h2.fold-h:hover{color:var(--text)}
.card.folded{padding-top:9px;padding-bottom:9px}
.card.folded>h2.fold-h{margin-bottom:0}
.card.folded>h2.fold-h::before{transform:rotate(-90deg)}
.card.folded>:not(h2){display:none!important}
.card.search-miss{display:none}
.card-group{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--faint);padding:4px 4px 0}
body.app-shell .palette{max-height:var(--palette-h,260px);overflow:auto;resize:vertical;padding-right:2px}
.keys-list{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--muted)}
`;document.head.append(css);
document.body.classList.add('app-shell');

const main=document.querySelector('.main'),rail=document.querySelector('.rail'),stageCard=document.querySelector('.stage-card');
const stageCol=stageCard.parentElement===main?(()=>{const c=document.createElement('div');stageCard.replaceWith(c);c.append(stageCard);return c})():stageCard.parentElement;
stageCol.classList.add('stage-col');

/* ---------- side panel width + hide ---------- */
const split=document.createElement('div');split.className='rail-split';split.title='ลากเพื่อปรับความกว้างแผง · ดับเบิลคลิก = ค่าเดิม';rail.before(split);
const setRailW=w=>{w=Math.round(clamp(+w||RAIL_DEFAULT,RAIL_MIN,Math.min(RAIL_MAX,innerWidth*.6)));main.style.setProperty('--rail-w',w+'px');return w};
ui.railW=setRailW(ui.railW);
split.addEventListener('pointerdown',e=>{e.preventDefault();split.setPointerCapture(e.pointerId);split.classList.add('drag');const x0=e.clientX,w0=rail.getBoundingClientRect().width;
 const mv=ev=>{ui.railW=setRailW(w0+(x0-ev.clientX))};
 const up=()=>{split.classList.remove('drag');split.removeEventListener('pointermove',mv);split.removeEventListener('pointerup',up);split.removeEventListener('pointercancel',up);saveUI()};
 split.addEventListener('pointermove',mv);split.addEventListener('pointerup',up);split.addEventListener('pointercancel',up)});
split.addEventListener('dblclick',()=>{ui.railW=setRailW(RAIL_DEFAULT);saveUI()});

const tools=document.createElement('div');tools.className='shell-tools';
tools.innerHTML='<button id="bRail" class="mini" title="ซ่อน/แสดงแผงเครื่องมือ (\\)"></button>';
document.querySelector('header').append(tools);
const setRail=show=>{document.body.classList.toggle('rail-hidden',!show);$('bRail').innerHTML=show?'⇥ ซ่อนแผง':'⇤ แสดงแผง';ui.railHidden=!show;saveUI()};
$('bRail').onclick=()=>setRail(document.body.classList.contains('rail-hidden'));
setRail(!ui.railHidden);
document.addEventListener('keydown',e=>{if(e.key!=='\\'||e.ctrlKey||e.metaKey||e.altKey)return;const t=e.target;if(t.closest?.('input,textarea,select,[contenteditable="true"]'))return;e.preventDefault();$('bRail').click()});

/* ---------- card order, grouping and folding ---------- */
const cards=[...rail.querySelectorAll(':scope>.card')],title=c=>(c.querySelector(':scope>h2')?.firstChild?.textContent||'').trim();
const find=t=>cards.find(c=>title(c)===t);
const CORE=['ชิ้นส่วน','ที่เลือกอยู่','ชั้นเลเยอร์'],TOOLS=['ดัดรูปทรง / ลาย','โค้งลายหุ้มผิวกลม','กระดูก 2D','ชิ้นนี้เป็นของตัวไหน'],FILES=['ชิ้นส่วนของฉัน','ชุด Oreo สีขาว','ส่งออกผัง'];
const OPEN_BY_DEFAULT=new Set(CORE);
const head=document.createElement('div');head.className='card';head.innerHTML='<div class="rail-head"><input type="text" id="railSearch" class="thai" placeholder="ค้นหาเครื่องมือ… เช่น กระดูก" spellcheck="false"><button id="railFoldAll" class="mini" title="พับทุกการ์ด">พับหมด</button><button id="railOpenAll" class="mini" title="กางทุกการ์ด">กางหมด</button></div>';
const group=t=>{const g=document.createElement('div');g.className='card-group';g.textContent=t;return g};
const ordered=[head,group('ใช้บ่อย'),...CORE.map(find),group('เครื่องมือ'),...TOOLS.map(find),group('ไฟล์'),...FILES.map(find)].filter(Boolean);
const rest=cards.filter(c=>!ordered.includes(c));rail.replaceChildren(...ordered,...rest);

// keyboard reference moves out of the page footer into a foldable card
const footer=document.querySelector('footer');
if(footer){const k=document.createElement('div');k.className='card';k.innerHTML='<h2>คีย์ลัด</h2><div class="keys-list"></div>';k.querySelector('.keys-list').append(...footer.children);const hide=document.createElement('span');hide.innerHTML='<kbd>\\</kbd> ซ่อน/แสดงแผงเครื่องมือ';k.querySelector('.keys-list').append(hide);rail.append(k);footer.remove()}

const foldable=[...document.querySelectorAll('.rail>.card,.stage-col>.card')].filter(c=>c.querySelector(':scope>h2'));
const setFold=(c,f,persist=true)=>{c.classList.toggle('folded',f);c.querySelector(':scope>h2').setAttribute('aria-expanded',String(!f));if(persist){ui.fold[title(c)]=f;saveUI()}};
for(const c of foldable){const h=c.querySelector(':scope>h2');h.classList.add('fold-h');h.tabIndex=0;h.setAttribute('role','button');
 const t=title(c);setFold(c,t in ui.fold?!!ui.fold[t]:!OPEN_BY_DEFAULT.has(t),false);
 const toggle=e=>{if(e.target.closest('button,input,select,a'))return;setFold(c,!c.classList.contains('folded'));};
 h.addEventListener('click',toggle);h.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(e)}})}
$('railFoldAll').onclick=()=>foldable.forEach(c=>setFold(c,true));
$('railOpenAll').onclick=()=>foldable.forEach(c=>setFold(c,false));
$('railSearch').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();
 for(const c of rail.querySelectorAll(':scope>.card')){if(c===head)continue;const hit=!q||c.textContent.toLowerCase().includes(q);c.classList.toggle('search-miss',!hit);if(q&&hit)c.classList.remove('folded')}
 for(const g of rail.querySelectorAll('.card-group'))g.style.display=q?'none':'';
 if(!q)foldable.forEach(c=>{if(rail.contains(c))setFold(c,!!(title(c) in ui.fold?ui.fold[title(c)]:!OPEN_BY_DEFAULT.has(title(c))),false)})});

/* ---------- palette height is user-resizable; remember it ---------- */
const pal=$('palette');if(ui.paletteH)pal.style.setProperty('--palette-h',ui.paletteH+'px');
new ResizeObserver(()=>{if(!pal.offsetParent||!pal.style.height)return;ui.paletteH=Math.round(pal.getBoundingClientRect().height);saveUI()}).observe(pal);

/* ---------- stage fills its box: fit whole paper, keep view centred when the box resizes ---------- */
const fitView=()=>{const st=stageEl().getBoundingClientRect();if(!st.width||!st.height)return;z=clamp(Math.min(st.width/W,st.height/H)*.96,.15,6);offX=(st.width-W*z)/2;offY=(st.height-H*z)/2;applyView()};
fit=fitView;$('bFit').onclick=fitView;
let lastSize=null;
new ResizeObserver(([e])=>{const{width,height}=e.contentRect;if(!width||!height)return;
 if(lastSize){offX+=(width-lastSize.w)/2;offY+=(height-lastSize.h)/2;applyView()}lastSize={w:width,h:height}}).observe(stageEl());
if(IMG.body)fitView(); // otherwise the start-up routine calls fit() once images load
})();
