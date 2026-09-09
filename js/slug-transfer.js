function slugTransferLocked(s,o){return TRADE_OFFERS.some(t=>t.slug===s)||!!(o&&isBreeder(o)&&breederState(o).phase==='mating'&&breederState(o).parents.includes(s));}
function drawSlugPortrait(canvas,slug){
 const source=slugSprite(slug).c,ctx=canvas.getContext('2d'),pad=10;
 const scale=Math.min((canvas.width-pad*2)/source.width,(canvas.height-pad*2)/source.height);
 ctx.clearRect(0,0,canvas.width,canvas.height);const w=source.width*scale,h=source.height*scale;
 ctx.drawImage(source,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
}
const TRANSFER_STATS=[['bodyDepth','ร่องสีตัว',100],['gillDepth','ร่องสีหงอน',100],['mainC','สีตัว',400],['accC','สีหงอน',400],['len','ความยาว',100],['girth','ขนาดตัว',100],['gillLen','ความสูงหงอน',100],['tentLen','ความยาวหนวด',100],['vigor','ความสมบูรณ์ / ออร่าหงอน',100],['gillN','จำนวนหงอน',100],['spotN','จำนวนจุด',100]];
function matchesSlugStats(s,filters,current=true){const g=current?foodGenes(s):s.genes;return filters.every(f=>Number.isFinite(g[f.key])&&(f.min===''||g[f.key]>=Number(f.min))&&(f.max===''||g[f.key]<=Number(f.max)));}
function transferSlugs(from,to,ids){
 const valid=o=>o===null||G.objs.includes(o)&&o.type==='tank';if(from===to||!valid(from)||!valid(to))return false;
 const source=from?from.slugs:G.inv,dest=to?to.slugs:G.inv,chosen=[...new Set(ids)].map(id=>source.find(s=>s.id===id));
 if(!chosen.length||chosen.some(s=>!s||(from&&isBreeder(from)&&breederState(from).phase==='mating'&&breederState(from).parents.includes(s))||TRADE_OFFERS.some(o=>o.slug===s))){toast('บางตัวมีข้อเสนอซื้ออยู่ หรือถูกย้ายไปแล้ว','bad');return false;}
 if(to&&dest.length+breederReserved(to)+chosen.length>tankCap(to.def)){toast('พื้นที่ปลายทางไม่พอสำหรับตัวที่เลือก','bad');return false;}
 for(const s of chosen){source.splice(source.indexOf(s),1);s.breedZone=false;dest.push(s);if(to)placeOnFloor(s,to);if(selSlug===s)selSlug=null;if(heldSlug===s)heldSlug=null;}
 syncHUD();syncOv();saveGame();renderBreederUI();return true;
}
(()=>{
 const d=document.createElement('dialog');d.id='slugTransfer';d.style.cssText='width:min(1000px,94vw);max-height:90vh;box-sizing:border-box;background:#152328;color:#eee;border:1px solid #8c9b91;border-radius:14px;padding:18px';
 d.innerHTML='<div style="display:flex;justify-content:space-between"><b>จัดการทาก</b><button data-close>ปิด ✕</button></div><div style="display:flex;gap:12px;margin:12px 0;flex-wrap:wrap"><label>เทียบกับ <select data-source></select></label><label>ค่าสเตตัส <select data-values><option value="current">ค่าปัจจุบัน</option><option value="base">ยีนต้น</option></select></label><button data-filter>＋ ตัวกรอง</button><button data-clear>ล้างตัวกรอง</button></div><div data-filters></div><div data-lists style="display:grid;grid-template-columns:1fr 1fr;gap:14px"></div><div data-message role="status" style="min-height:24px;margin-top:10px"></div>';
 document.body.append(d);let tank=null,other=null,filters=[],selected=[new Set(),new Set()];const q=s=>d.querySelector(s);
 const css=document.createElement('style');css.textContent='#slugTransfer button,#slugTransfer select,#slugTransfer input{background:#263d43;color:#eee;border:1px solid #637b7e;border-radius:6px;padding:7px}#slugTransfer button{cursor:pointer}#slugTransfer button:disabled{opacity:.4;cursor:default}#slugTransfer .slug-list{height:min(42vh,400px);overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));align-content:start;gap:6px}#slugTransfer .slug-card{padding:7px;border:1px solid #496367;border-radius:8px;cursor:pointer;font-size:12px}#slugTransfer .slug-card:has(input:checked){border-color:#eac36b;background:#374238}#slugTransfer canvas{display:block;width:100%;height:65px;object-fit:contain}#slugTransfer::backdrop{background:#0009}';document.head.append(css);
 function draw(){
  SlugBrowser.mount(d,'transfer',draw);
  const sides=[tank,other],current=SlugBrowser.state('transfer').values==='current';
  const scroll=[...d.querySelectorAll('.slug-list')].map(el=>el.scrollTop);
  q('[data-lists]').innerHTML=sides.map((o,i)=>{const all=o?o.slugs:G.inv,visible=SlugBrowser.apply(all.filter(s=>matchesSlugStats(s,filters,current)),'transfer');selected[i]=new Set([...selected[i]].filter(id=>visible.some(s=>s.id===id&&!slugTransferLocked(s,o))));
   const cap=o?' / '+tankCap(o.def)+' · ว่าง '+Math.max(0,tankCap(o.def)-all.length-breederReserved(o)):'';
   const dest=sides[1-i],space=dest?Math.max(0,tankCap(dest.def)-dest.slugs.length-breederReserved(dest)):Infinity,tooMany=selected[i].size>space;
   return '<section><h3 style="margin:0 0 8px">'+(i===0?'ตู้ที่เปิดอยู่':o?'ตู้ '+o.id:'คลัง')+' · '+all.length+cap+'</h3><div style="margin-bottom:8px">พบ '+visible.length+' ตัว <button data-all="'+i+'">เลือกที่พบ</button> <button data-none="'+i+'">ล้าง</button></div><div class="slug-list">'+(visible.length?'':'<div style="padding:24px 12px;color:#9eaaa6;grid-column:1/-1">'+(all.length?'ไม่พบตัวที่ตรงกับตัวกรอง':'ยังไม่มีทาก')+'</div>')+visible.map(s=>'<label class="slug-card"><input type="checkbox" data-side="'+i+'" data-id="'+s.id+'" '+(selected[i].has(s.id)?'checked':'')+' '+(slugTransferLocked(s,o)?'disabled':'')+'> '+SlugBrowser.htmlName(s)+'<canvas data-preview="'+s.id+'" data-side="'+i+'" width="180" height="132"></canvas>สีตัว / หงอน '+(current?foodGenes(s):s.genes).mainC+' / '+(current?foodGenes(s):s.genes).accC+(slugTransferLocked(s,o)?'<br>กำลังผสม / มีข้อเสนอซื้อ':'')+'</label>').join('')+'</div><button style="width:100%;margin-top:8px" data-move="'+i+'" '+(!selected[i].size||tooMany?'disabled':'')+'>'+(i===0?'ย้ายออก →':'← นำเข้าตู้')+' '+selected[i].size+' ตัว</button>'+(tooMany?'<div role="status" style="font-size:12px;color:#ebc089;margin-top:6px">ปลายทางว่าง '+space+' ที่ · เลือกเกิน '+(selected[i].size-space)+' ตัว</div>':'')+'</section>';}).join('');
  d.querySelectorAll('.slug-list').forEach((el,i)=>el.scrollTop=scroll[i]||0);
  d.querySelectorAll('[data-preview]').forEach(c=>{const o=sides[+c.dataset.side],s=(o?o.slugs:G.inv).find(s=>s.id===c.dataset.preview);drawSlugPortrait(c,s);SlugBrowser.heart(c.parentElement,s,draw,'transfer');});
  d.querySelectorAll('input[data-id]').forEach(el=>el.onchange=()=>{const set=selected[+el.dataset.side];el.checked?set.add(el.dataset.id):set.delete(el.dataset.id);draw();});
  d.querySelectorAll('[data-all]').forEach(el=>el.onclick=()=>{const i=+el.dataset.all,o=sides[i];selected[i]=new Set(SlugBrowser.apply((o?o.slugs:G.inv).filter(s=>matchesSlugStats(s,filters,current)&&!slugTransferLocked(s,o)),'transfer').map(s=>s.id));draw();});
  d.querySelectorAll('[data-none]').forEach(el=>el.onclick=()=>{selected[+el.dataset.none].clear();draw();});
  d.querySelectorAll('[data-move]').forEach(el=>el.onclick=()=>{const i=+el.dataset.move,count=selected[i].size;if(transferSlugs(sides[i],sides[1-i],[...selected[i]])){selected=[new Set(),new Set()];q('[data-message]').textContent='ย้ายแล้ว '+count+' ตัว';draw();}else q('[data-message]').textContent='ย้ายไม่ได้ ตรวจสอบพื้นที่ว่างและข้อเสนอซื้อ';});
 }
 function renderFilters(){q('[data-filters]').innerHTML=filters.map((f,i)=>'<div style="display:flex;gap:6px;margin-bottom:8px"><select data-key="'+i+'">'+TRANSFER_STATS.map(([k,n])=>'<option value="'+k+'" '+(k===f.key?'selected':'')+'>'+n+'</option>').join('')+'</select><input aria-label="ค่าต่ำสุด" placeholder="ต่ำสุด" type="number" style="width:85px" data-min="'+i+'" value="'+f.min+'"><span>ถึง</span><input aria-label="ค่าสูงสุด" placeholder="สูงสุด" type="number" style="width:85px" data-max="'+i+'" value="'+f.max+'"><button data-remove="'+i+'">✕</button></div>').join('');
  for(const kind of ['key','min','max'])d.querySelectorAll('[data-'+kind+']').forEach(el=>el.oninput=()=>{filters[+el.dataset[kind]][kind]=el.value;draw();});d.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{filters.splice(+el.dataset.remove,1);renderFilters();draw();});}
 q('[data-filter]').hidden=true;q('[data-clear]').hidden=true;q('[data-values]').parentElement.hidden=true;
 q('[data-filter]').onclick=()=>{if(filters.length>=TRANSFER_STATS.length)return;filters.push({key:TRANSFER_STATS.find(([k])=>!filters.some(f=>f.key===k))?.[0]||'mainC',min:'',max:''});renderFilters();draw();};
 q('[data-clear]').onclick=()=>{filters=[];renderFilters();draw();};q('[data-values]').onchange=draw;
 q('[data-source]').onchange=e=>{other=G.objs.find(o=>String(o.id)===e.target.value)||null;selected=[new Set(),new Set()];draw();};q('[data-close]').onclick=()=>d.close();
 d.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();d.close();}},true);
 window.openSlugTransfer=()=>{if(!curTank)return;tank=curTank;other=null;selected=[new Set(),new Set()];q('[data-source]').innerHTML='<option value="">คลัง</option>'+G.objs.filter(o=>o.type==='tank'&&o!==tank).map(o=>'<option value="'+o.id+'">'+o.def.name+' · '+o.id+'</option>').join('');q('[data-message]').textContent='';renderFilters();draw();d.showModal();};
 document.getElementById('ovAdd').textContent='จัดการทาก';document.getElementById('ovAdd').onclick=openSlugTransfer;document.getElementById('ovCollect').hidden=true;
})();

(()=>{const css=document.createElement('style');css.textContent=`
 #slugTransfer,#breedingPicker{color:#e8e0cb!important;background:linear-gradient(145deg,#233439f5,#10191cfb 65%)!important;border:1px solid #ab8b4e!important;border-radius:18px!important;box-shadow:0 24px 90px #000b,inset 0 1px #edd29b28;padding:22px!important;color-scheme:dark}
 #slugTransfer::backdrop,#breedingPicker::backdrop{background:#020d10b3;backdrop-filter:blur(4px)}
 #slugTransfer button,#slugTransfer select,#slugTransfer input,#breedingPicker .tbtn{font:inherit;color:#e8ddc3;background:linear-gradient(#2b3a3c,#1a282b);border:1px solid #796b4c;border-radius:8px;transition:border-color .12s,background .12s}
 #slugTransfer button:hover:not(:disabled),#breedingPicker button:hover:not(:disabled){border-color:#d9b86f;background:#34433f}
 #slugTransfer input[type=checkbox]{accent-color:#d9b769;width:15px;height:15px;vertical-align:middle}
 #slugTransfer .slug-list{gap:10px;padding:2px 8px 10px 2px;scrollbar-width:thin;scrollbar-color:#88764e #122226}
 #slugTransfer .slug-card{position:relative;box-sizing:border-box;border:1px solid #53605b;border-radius:11px;padding:10px;background:radial-gradient(ellipse at 50% 38%,#35575a55,transparent 72%),linear-gradient(160deg,#263a3d,#142428);box-shadow:inset 0 1px #ffffff10,0 3px 6px #0002}
 #slugTransfer .slug-card:has(input:checked){border-color:#dfb660;background:radial-gradient(ellipse at 50% 40%,#a1863940,transparent 75%),linear-gradient(160deg,#3b4033,#202d29);box-shadow:inset 0 0 0 1px #e5c67b35,0 0 10px #d2a54316}
 #slugTransfer .slug-card canvas{width:100%;height:auto;aspect-ratio:180/132;object-fit:contain;margin:3px 0 7px;border-bottom:1px solid #c1b07f24}
 #slugTransfer [data-move]{text-align:center;min-height:44px;border-color:#a5874d}#slugTransfer [data-move]:not(:disabled){background:linear-gradient(#b89650,#86662f);color:#fff6dc;font-weight:600}
 #slugTransfer [data-lists]>section>h3{font-size:15px;color:#dfc58e;letter-spacing:.2px}
 #slugTransfer [data-message]{font-size:13px;color:#d9c297}
 #breedingPicker canvas{width:100%!important;height:auto!important;aspect-ratio:180/132}
 #breedingPicker [data-parent-id]{border-radius:12px;background:radial-gradient(ellipse at center,#365657,#182a2d)!important}
 #breedingPicker [data-parent-id][aria-pressed=true]{background:radial-gradient(ellipse at center,#70643a,#263630)!important;border-color:#dfb660!important}
 `;document.head.append(css);})();
