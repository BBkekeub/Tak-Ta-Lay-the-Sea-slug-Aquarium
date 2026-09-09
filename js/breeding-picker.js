// Selection is a draft: adults only leave their zone after confirmation.
const breedingDrafts=new WeakMap();
function breedingDraft(o){return o.slugs.filter(s=>s.breedZone).map(s=>s.id);}
function canChooseParent(s){return (s.breedLife??50)>=5&&!TRADE_OFFERS.some(t=>t.slug===s);}
function chooseBreedingParent(o,s){if(!isBreeder(o)||breederState(o).phase!=='idle'||!o.slugs.includes(s)||!canChooseParent(s))return false;const ids=breedingDraft(o);if(ids.includes(s.id))return false;if(ids.length>=2)return false;setBreedingZone(o,s,true);if(breedingDraft(o).length===2)openBreedingPicker(o);return true;}
const breedingPicker=document.createElement('dialog');breedingPicker.id='breedingPicker';breedingPicker.style.cssText='width:min(700px,90vw);max-height:85vh;background:#152328;color:#eee;border:1px solid #bfa260;border-radius:14px;padding:20px';document.body.append(breedingPicker);
let breedingPickerTank=null;
function openBreedingPicker(o){
 if(!isBreeder(o))return;if(breederState(o).phase!=='idle'){toast('รอรอบผสมและฟักไข่ปัจจุบันก่อน','bad');return;}
 breedingPickerTank=o;renderBreedingPicker();if(!breedingPicker.open)breedingPicker.showModal();
}
function renderBreedingPicker(){
 const o=breedingPickerTank,ids=breedingDraft(o),ready=ids.length===2;
 breedingPicker.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">'+(ready?'ผสมพันธุ์ 2 ตัวนี้เลยไหม?':'เลือกทากมาผสมพันธุ์ · '+ids.length+'/2')+'</h3><button class="tbtn" data-close>ปิด ✕</button></div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(135px,1fr));gap:8px;margin:16px 0;max-height:48vh;overflow:auto">'+SlugBrowser.apply(o.slugs,'breeding').map(s=>'<button class="tbtn" data-parent-id="'+s.id+'" aria-pressed="'+ids.includes(s.id)+'" style="padding:10px;border-color:'+(ids.includes(s.id)?'#f1cc75':'#50696a')+';background:'+(ids.includes(s.id)?'#465044':'#203338')+'" '+(!canChooseParent(s)||ready&&!ids.includes(s.id)?'disabled':'')+'><canvas width="180" height="132" data-slug="'+s.id+'" style="width:100%;height:75px;object-fit:contain"></canvas>'+SlugBrowser.htmlName(s)+(ids.includes(s.id)?' ✓':'')+'<br>พลังผสม '+(s.breedLife??50)+(!canChooseParent(s)?'<br>ยังเลือกไม่ได้':'')+'</button>').join('')+'</div>'+(o.slugs.length?'':'<p>ยังไม่มีทากในโซนเลี้ยง</p>')+'<div style="display:flex;gap:8px"><button class="tbtn" data-confirm '+(!ready?'disabled':'')+'>เริ่มผสม · 1 นาที</button><button class="tbtn" data-cancel>ยกเลิกการเลือก</button><button class="tbtn" data-manage>นำทากเข้าตู้</button></div>';
 SlugBrowser.mount(breedingPicker,'breeding',renderBreedingPicker);
 breedingPicker.querySelectorAll('[data-slug]').forEach(c=>{const s=o.slugs.find(s=>s.id===c.dataset.slug);drawSlugPortrait(c,s);SlugBrowser.heart(c.parentElement,s,renderBreedingPicker,'breeding');});
 breedingPicker.querySelectorAll('[data-parent-id]').forEach(el=>el.onclick=()=>{const id=el.dataset.parentId,now=breedingDraft(o);if(now.includes(id))setBreedingZone(o,o.slugs.find(s=>s.id===id),false);else if(now.length<2){const s=o.slugs.find(s=>s.id===id);if(s&&canChooseParent(s))setBreedingZone(o,s,true);}renderBreedingPicker();});
 breedingPicker.querySelector('[data-confirm]').onclick=()=>{if(startBreeding(o,[...breedingDraft(o)])){breedingDrafts.delete(o);breedingPicker.close();}else renderBreedingPicker();};
 breedingPicker.querySelector('[data-cancel]').onclick=()=>{o.slugs.filter(s=>s.breedZone).forEach(s=>setBreedingZone(o,s,false));breedingPicker.close();};breedingPicker.querySelector('[data-close]').onclick=()=>breedingPicker.close();
 breedingPicker.querySelector('[data-manage]').onclick=()=>{breedingPicker.close();openSlugTransfer();};
}
breedingPicker.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();breedingPicker.close();}},true);
function overBreedingZone(e){const {mx,my}=tankXY(e),f=tankFloorAt(mx,my);return f.fx>=20&&f.fx<=25&&f.fy>=0&&f.fy<=10;}
let breedingZoneDown=null;
tankCv.addEventListener('pointerdown',e=>{breedingZoneDown=null;if(tankMode&&isBreeder(curTank)&&!tankBuildMode&&!foodChoice&&breederState(curTank).phase==='idle'&&overBreedingZone(e)&&!slugAt(tankXY(e).mx,tankXY(e).my)){breedingZoneDown={x:e.clientX,y:e.clientY};e.stopImmediatePropagation();e.preventDefault();}},true);
tankCv.addEventListener('pointerup',e=>{
 if(!tankMode||!isBreeder(curTank))return;
 if(heldSlug&&!overBreedingZone(e)&&heldSlug.breedZone){const s=heldSlug;dropHeldSlug();setBreedingZone(curTank,s,false);cancelHold();pendSlug=null;tDrag=false;e.stopImmediatePropagation();return;}
 if(heldSlug&&overBreedingZone(e)){const s=heldSlug;dropHeldSlug();cancelHold();pendSlug=null;tDrag=false;tankCv.style.cursor='';e.stopImmediatePropagation();if(!chooseBreedingParent(curTank,s))toast('เลือกตัวนี้ไม่ได้ หรือเลือกครบแล้ว','bad');return;}
 if(breedingZoneDown){const down=breedingZoneDown;breedingZoneDown=null;e.stopImmediatePropagation();if(Math.hypot(e.clientX-down.x,e.clientY-down.y)<8&&overBreedingZone(e))openBreedingPicker(curTank);}
},true);
tankCv.addEventListener('pointercancel',()=>{breedingZoneDown=null;});
