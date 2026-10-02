/* Editing controls for authored game decor. Drafts use the editor's storage only. */
const gridCard=document.createElement('div');gridCard.className='card';
gridCard.innerHTML=`<h2>กำหนดพื้นที่เป็นเซนติเมตร</h2>
<label class="f">ขนาดช่องตาราง<select id="gridStep"><option value="0.1">0.5 × 0.5 ซม.</option><option value="0.2">1 × 1 ซม.</option><option value="0.5">2.5 × 2.5 ซม.</option></select></label><p class="hint">ช่องที่ไม่เป็นสีแดงเดินผ่านได้ · เปลี่ยนขนาดช่องจะจัดกริดเดิมลงช่องใหม่ ย้อนกลับได้</p>
<div class="pair"><label class="f">กว้าง (ซม.)<input id="areaW" type="number" min="2.5" max="100" step="2.5" value="10"></label><label class="f">ลึก (ซม.)<input id="areaH" type="number" min="2.5" max="100" step="2.5" value="10"></label></div>
<button id="bArea" style="margin-top:8px">สร้างพื้นที่วางและกั้นเดิน</button>
<p class="hint">แทนกริดทิศนี้ด้วยสี่เหลี่ยมกลางฐาน แล้วใช้แปรง “เดินได้” เปิดช่องทางเดิน · ย้อนกลับได้ด้วย Ctrl+Z</p>
<button id="bMasks" style="margin-top:8px">หมุนกริดนี้ไปอีก 3 ทิศ</button>
<p class="hint">คงขนาดภาพและจุดฐานเดิม ช่องหน้า/หลังควรตรวจทีละมุม</p>`;
document.querySelector('.side').prepend(gridCard);
const clearAllButton=document.createElement('button');
clearAllButton.id='bClearAllViews';clearAllButton.className='danger';
clearAllButton.textContent='ล้างทั้งหมด 4 มุม';
clearAllButton.title='ล้างพื้นที่วางและกริดเดินของชิ้นที่เลือก · Ctrl+Z คืนได้';
$('tErase').after(clearAllButton);
$('bClearAllViews').onclick=()=>{
 if(!cur)return;
 if(!it().views.some(v=>['place','state'].some(k=>Object.keys(v[k]||{}).length))){toast('ชิ้นนี้ไม่มีพื้นที่ให้ล้างแล้ว');return;}
 push();for(const v of it().views){v.place={};v.state={};}
 persistSoon(cur);refresh();toast('ล้างพื้นที่ทั้งหมด 4 มุมแล้ว — Ctrl+Z คืนได้');
};
const walkButton=document.createElement('button');walkButton.id='tWalk';walkButton.textContent='เดินได้';$('tSolid').after(walkButton);
walkButton.onclick=()=>{setMode('walk');setTool('erase');toast('ระบายเพื่อลบสิ่งกีดขวาง — พื้นที่วางยังอยู่')};
window.syncGridStep=()=>{$('gridStep').value=String(STEP);for(const id of ['areaW','areaH']){$(id).min=STEP*5;$(id).step=STEP*5;}for(const option of $('brush').options){const size=r3(Number(option.value)*STEP*5);option.textContent=size+' × '+size+' ซม.';}};
syncGridStep();
for(const cm of [.5,1]){const b=document.createElement('button');b.id=cm===.5?'bFineBrush':'bOneCmBrush';b.textContent='แปรง '+cm+' ซม.';$('brush').parentElement.after(b);b.onclick=()=>{const step=cm/5;if(STEP>step){$('gridStep').value=String(step);$('gridStep').dispatchEvent(new Event('change'));}brush=Math.round(step/STEP);$('brush').value=String(brush);draw();showStatus();toast('แปรง '+cm+' × '+cm+' ซม. — ใช้ระบายหรือลบได้');};}
$('gridStep').onchange=()=>{const next=Number($('gridStep').value),old=STEP;if(next===old)return;push();
 const convert=m=>{const result={};for(const [k,val] of Object.entries(m)){const [x,y]=k.split(',').map(Number);for(let ix=Math.floor((x+1e-7)/next);ix<Math.ceil((x+old-1e-7)/next);ix++)for(let iy=Math.floor((y+1e-7)/next);iy<Math.ceil((y+old-1e-7)/next);iy++){const key=keyc(ix*next,iy*next);if(result[key]!==1)result[key]=val;}}return result;};
 for(const v of it().views){v.place=convert(v.place);v.state=convert(v.state);}it().cell=next;persistSoon(cur);refresh();toast('เปลี่ยนเป็นช่อง '+next*5+' ซม. ทั้ง 4 ทิศแล้ว');};
$('bArea').onclick=()=>{
 const w=Number($('areaW').value),h=Number($('areaH').value);
 const cm=STEP*5;if(!Number.isFinite(w)||!Number.isFinite(h)||w<cm||h<cm||w>100||h>100){toast('กรอกขนาด '+cm+'–100 ซม.');return}
 const nx=Math.round(w/cm),ny=Math.round(h/cm);push();const v=vw();v.place={};v.state={};
 const x0=-Math.floor(nx/2)*STEP,y0=-Math.floor(ny/2)*STEP;
 for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){const k=keyc(x0+x*STEP,y0+y*STEP);v.place[k]=1;v.state[k]=1;}
 $('areaW').value=nx*cm;$('areaH').value=ny*cm;persistSoon(cur);refresh();toast('สร้างพื้นที่ '+nx*cm+' × '+ny*cm+' ซม. แล้ว');
};
const legacyTransferGrid=transferGrid;
transferGrid=function(src,turns){
 if(SPRITE_DECOR_DEFS[cur]?.shopRotationSign!==-1)return legacyTransferGrid(src,turns);
 // Authored meshes rotate around the center of their ground plane, not the
 // front edge of the silhouette. Their positive rotation is opposite legacy art.
 const n=((4-turns)%4+4)%4;return{state:rotMap(src.state,n),place:rotMap(src.place,n)};
};
$('bMasks').onclick=()=>{push();const source=JSON.parse(JSON.stringify(vw()));for(let i=0;i<4;i++)if(i!==view){const g=transferGrid(source,(i-view+4)%4);Object.assign(it().views[i],g);}persistSoon(cur);refresh();toast('หมุนกริดครบ 4 ทิศแล้ว — ตรวจช่องหน้า/หลังอีกครั้ง')};
const legacyRef=$('bRef').onclick;
$('bRef').onclick=()=>{if(SPRITE_DECOR_DEFS[cur]?.shopRotationSign===-1){$('bMasks').click();return}legacyRef();};
const saveButton=document.createElement('button');saveButton.id='bGameGrid';saveButton.className='primary';saveButton.textContent='บันทึกกริดเข้าเกม';$('bExport').before(saveButton);
const note=document.createElement('p');note.className='hint';note.textContent=location.origin==='http://127.0.0.1:8766'?'บันทึกกริดเข้าเกม → เขียนไฟล์เกมโดยตรงและสำรองไฟล์เดิม แล้วโหลดเกมใหม่':'บันทึกกริดเข้าเกม → เลือกไฟล์ js/decor-grid-overrides.js ในโฟลเดอร์เกม แล้วโหลดเกมใหม่ งานระหว่างแก้จะจำในเบราว์เซอร์อัตโนมัติ';gridCard.append(note);
// Put the independent axes within reach, instead of below image-path controls.
const shapeCard=document.createElement('div');shapeCard.className='card shape-card';shapeCard.innerHTML='<h2>ขนาดและรูปทรง</h2><p class="hint">ปรับเฉพาะรูปมุมที่เลือก · จุดฐานอยู่ที่เดิม</p>';
shapeCard.append($('fStretchW').closest('.pair'),$('bAspect'));
const shapeHelp=document.createElement('p');shapeHelp.className='hint';shapeHelp.textContent='ยืดตามสองแนวของกริดเฉียง โดยยึดจุดฐานเดิม · ปรับเฉพาะภาพ กริดที่ระบายไว้คงเดิม';shapeCard.append(shapeHelp);gridCard.before(shapeCard);
for(const [id,label] of [['fStretchW','กว้าง'],['fStretchH','สูง']]){
 const slider=document.createElement('input');slider.type='range';slider.min=1;slider.max=120;slider.step=.5;slider.id=id+'Slider';slider.setAttribute('aria-label','ยืด'+label);slider.value=$(id).value;
 $(id).after(slider);slider.oninput=()=>{$(id).value=slider.value;$(id).dispatchEvent(new Event('input'));};slider.onchange=()=>$(id).dispatchEvent(new Event('change'));
 $(id).addEventListener('input',()=>slider.value=$(id).value);
}
const originalRenderView=renderView;renderView=function(){originalRenderView();for(const id of ['fStretchW','fStretchH'])$(id+'Slider').value=$(id).value;};
const imageCard=$('fSrc').closest('.card');shapeCard.before(imageCard);
const moreSettings=document.createElement('details');moreSettings.className='advanced-settings';
const moreTitle=document.createElement('summary');moreTitle.textContent='ตั้งค่าเพิ่มเติม';
const moreHint=document.createElement('p');moreHint.className='hint';moreHint.textContent='ชื่อและราคา · คัดลอกกริด · ส่งออกแบบเดิม · คีย์ลัด';moreSettings.append(moreTitle,moreHint);
for(const card of [...document.querySelectorAll('.side > .card')])if(card!==imageCard&&card!==shapeCard&&card!==gridCard)moreSettings.append(card);
document.querySelector('.side').append(moreSettings);
const previewBar=document.createElement('div');previewBar.className='toolbar preview-toolbar';
const previewLabel=document.createElement('span');previewLabel.className='toolbar-caption';previewLabel.textContent='มุมมอง';previewBar.append(previewLabel);
for(const id of ['opa','ghost'])previewBar.append($(id).closest('label'));
const previewSpace=document.createElement('span');previewSpace.style.flex='1';previewBar.append(previewSpace);
for(const id of ['zOut','zFit','zIn'])previewBar.append($(id));
document.querySelector('.toolbar').after(previewBar);
// Collapsing only hides controls; it never changes the current asset or masks.
const foldStyle=document.createElement('style');foldStyle.textContent='.card h2 .card-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:3px 0;border:0;border-radius:3px;background:transparent;color:inherit;text-align:left;white-space:normal}.card-toggle .card-title{flex:1}.card-toggle .card-title>span{margin-left:8px}.card-body[hidden]{display:none!important}';document.head.append(foldStyle);
document.querySelectorAll('.side .card').forEach((card,index)=>{
 const header=card.querySelector('h2');if(!header)return;
 const storageKey='decor-grid-panel:'+header.textContent.trim().split(/ตอนนี้:|หน้า 0°|ขวา 90°|หลัง 180°|ซ้าย 270°/)[0],body=document.createElement('div');body.className='card-body';body.id='decor-panel-'+index;
 while(header.nextSibling)body.append(header.nextSibling);card.append(body);
 const button=document.createElement('button');button.type='button';button.className='card-toggle';button.setAttribute('aria-controls',body.id);
 const title=document.createElement('span');title.className='card-title';while(header.firstChild)title.append(header.firstChild);
 const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');button.append(title,arrow);header.append(button);
 const setFold=closed=>{body.hidden=closed;button.setAttribute('aria-expanded',String(!closed));arrow.textContent=closed?'▸':'▾';};
 let closed=false;try{closed=localStorage.getItem(storageKey)==='closed';}catch(_){}setFold(closed);
 button.onclick=()=>{setFold(!body.hidden);try{localStorage.setItem(storageKey,body.hidden?'closed':'open');}catch(_){}};
});
function buildGridOverride(){
 const D={...(typeof DECOR_GRID_OVERRIDES==='object'?DECOR_GRID_OVERRIDES:{})};
 for(const item of Object.values(items))if(DECOR_GRID_EDITABLE.has(item.key)&&isReady(item))D[item.key]=defOf(item);
 return "// Saved from Dec Grid.html. Keep after authored definitions.\nvar DECOR_GRID_OVERRIDES="+JSON.stringify(D,null,1)+";\nObject.assign(SPRITE_DECOR_DEFS,DECOR_GRID_OVERRIDES);\n";
}
saveButton.onclick=async()=>{
 const list=Object.values(items).filter(i=>DECOR_GRID_EDITABLE.has(i.key));
 if(list.some(i=>!isReady(i))){toast('ยังบันทึกไม่ได้: ตรวจความพร้อมของชิ้นในเกมให้ครบก่อน');return}
 persistNow();const text=buildGridOverride(),filename='decor-grid-overrides.js';
 if(location.origin==='http://127.0.0.1:8766'){
  saveButton.disabled=true;
  try{
   const data={...(typeof DECOR_GRID_OVERRIDES==='object'?DECOR_GRID_OVERRIDES:{})};
   for(const item of list)data[item.key]=defOf(item);
   const response=await fetch('/api/save-decor-grid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   if(!response.ok)throw Error('HTTP '+response.status);
   const result=await response.json();
   saveButton.textContent='บันทึกเข้าเกมแล้ว '+result.count+' ชิ้น';
   toast('บันทึกเข้าเกมแล้ว '+result.count+' ชิ้น พร้อมสำรองไฟล์เดิม — โหลดเกมใหม่');return;
  }catch(e){toast('บันทึกเข้าเกมไม่สำเร็จ: '+e.message);return}
  finally{saveButton.disabled=false}
 }
 if(window.showSaveFilePicker){try{const handle=await showSaveFilePicker({suggestedName:filename,types:[{description:'กริดของตกแต่งเกม',accept:{'text/javascript':['.js']}}]});const stream=await handle.createWritable();await stream.write(text);await stream.close();toast('บันทึกแล้ว — โหลดเกมใหม่เพื่อใช้กริด');return}catch(e){if(e.name==='AbortError')return;toast('บันทึกไฟล์ไม่ได้ จะดาวน์โหลดให้แทน');}}
 const url=URL.createObjectURL(new Blob([text],{type:'text/javascript'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('ดาวน์โหลดแล้ว — วางทับ js/'+filename+' แล้วโหลดเกมใหม่');
};
