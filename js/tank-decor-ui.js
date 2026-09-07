// Event-driven decoration tray. Static image elements reuse the browser image cache.
(()=>{
 const body=ov.querySelector('.ov-body'),toggle=document.getElementById('ovBuild'),tray=document.getElementById('ovDecor'),pal=document.getElementById('dpal');
 const dock=document.createElement('aside');dock.id='tankDecorDock';dock.setAttribute('aria-label','ตกแต่งตู้');body.append(dock);dock.append(toggle,tray);
 const style=document.createElement('style');style.textContent=`
 #ov .ov-body.decor-open #tankCv{height:calc(100% - 140px)!important}
 #ov .ov-body.decor-open .tank-side{max-height:calc(100% - 160px)}
 #tankDecorDock{position:absolute;left:12px;bottom:10px;z-index:8;pointer-events:none}
 #tankDecorDock>*{pointer-events:auto}#tankDecorDock [hidden],#tankDecorDock .hint,#tankDecorDock .dlabel{display:none!important}
 #tankDecorDock #ovBuild{padding:10px 16px;border-radius:9px;background:#c6a459;color:#172b2d;border:1px solid #e2cc90;font-weight:bold}
 .decor-open #tankDecorDock{left:0;bottom:0;width:100%;height:140px;max-width:100%;background:#142b2e;border-top:1px solid #997f49;box-sizing:border-box}
 .decor-open #tankDecorDock #ovBuild{position:absolute;right:10px;top:6px;padding:5px 14px;z-index:2}
 #ov #tankDecorDock #ovDecor{position:static;width:100%;height:100%;max-height:none;box-sizing:border-box;padding:6px 10px;gap:5px;flex-direction:column;align-items:stretch;overflow:hidden;background:none;border:0;border-radius:0}
 .decorTrayHead{height:27px;flex-shrink:0;display:flex;align-items:center;gap:12px;padding-right:115px;color:#d8c492}.decorTrayHead strong{font-size:13px}.decorTrayCount{font-size:11px;color:#9eafae}.decorTrayHead output{font-size:12px;margin-left:auto}.decorTrayHead>button{display:none}
 #tankDecorDock #dpal{width:100%;max-width:100%;box-sizing:border-box;display:flex;flex:1;min-width:0;min-height:0;gap:6px;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;padding:0 32px}
 #tankDecorDock #dpal::-webkit-scrollbar{display:none}
 #tankDecorDock .dbtn{position:relative;flex:0 0 94px;width:94px;min-width:94px;height:94px;padding:4px;box-sizing:border-box;display:flex;flex-direction:column;gap:0;background:#20383a;border:1px solid #48605e;border-radius:7px;color:#e7d8b4;cursor:pointer}
 #tankDecorDock .dbtn:hover,#tankDecorDock .dbtn.on{background:#39483b;border-color:#e0bb66}
 #tankDecorDock .dbtn img{display:block;width:100%;height:65px;object-fit:contain}
 #tankDecorDock .dbtn strong,#tankDecorDock .dbtn small{display:none}
 #tankDecorDock .dbtn b{font-size:12px;line-height:18px;text-align:center;color:#e7c778}
 .decorSelection{display:flex;gap:6px;align-items:center;position:absolute;top:7px;left:125px;right:120px;height:25px;overflow:hidden}.decorSelection span{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#c8d0c7}.decorSelection .tbtn{padding:3px 8px;font-size:11px;white-space:nowrap}
 .decorNav{position:absolute;top:45px;bottom:10px;width:28px;border:0;border-radius:6px;background:#102426;color:#dcc78e;font-size:26px;cursor:pointer}.decorNav.prev{left:7px}.decorNav.next{right:7px}
 @media(max-width:700px){.decorSelection{left:110px;right:120px}.decor-open .decorTrayHead strong,.decor-open .decorTrayCount,.decor-open .decorTrayHead output{visibility:hidden}}
 .decorTabs{display:flex;gap:6px;height:27px}.decorTabs button{border:1px solid #52615a;border-radius:6px 6px 0 0;background:#20383a;color:#c3c9bd;padding:4px 16px;cursor:pointer;font-size:12px}.decorTabs button[aria-selected="true"]{color:#f0d390;background:#3b4638;border-color:#b59a5c;border-bottom:2px solid #e6c173}
 .decorCreditBadge{position:absolute;top:2px;right:2px;background:#e6c173;color:#142b2d;font-size:10px;font-weight:700;line-height:15px;min-width:15px;text-align:center;padding:0 4px;border-radius:8px;z-index:3;pointer-events:none}
 `;document.head.append(style);
 const header=document.createElement('div');header.className='decorTrayHead';header.innerHTML='<div class="decorTabs" role="tablist" aria-label="หมวดของตกแต่ง"></div>';tray.prepend(header);
 let activeCategory='Pumice';const category=key=>/^pumice/i.test(key)?'Pumice':'อื่น ๆ';
 function selectCategory(name){activeCategory=name;for(const b of header.querySelectorAll('[role="tab"]')){const on=b.textContent===name;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}for(const b of pal.querySelectorAll('.dbtn'))b.hidden=category(b.dataset.key)!==name;}
 function syncTabs(){const names=[...new Set(Object.keys(TANK_DECOR).map(category))];for(const name of names){if([...header.querySelectorAll('[role="tab"]')].some(b=>b.textContent===name))continue;const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('role','tab');b.setAttribute('aria-controls','dpal');b.onclick=()=>{selectCategory(name);pal.scrollLeft=0;};b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const tabs=[...header.querySelectorAll('[role="tab"]')],i=tabs.indexOf(b),next=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];next.click();next.focus();};header.firstChild.append(b);}selectCategory(names.includes(activeCategory)?activeCategory:names[0]);}
 pal.setAttribute('role','tabpanel');pal.setAttribute('aria-label','ของตกแต่ง');
 
 const actions=document.createElement('div');actions.className='decorSelection';const selection=document.createElement('span');actions.append(selection);tray.append(actions);
 actions.append(document.getElementById('dFlip'),document.getElementById('dRemove'));
 const cancel=document.createElement('button');cancel.className='tbtn';cancel.textContent='ยกเลิกเลือก';actions.append(cancel);cancel.onclick=()=>{selDecorKey=null;selDecor=null;decorHover=null;dragGhost=null;syncDecorBar();};
 const oldBuild=buildDecorBar;buildDecorBar=function(){oldBuild();for(const button of pal.querySelectorAll('.dbtn:not([data-preview-ready])')){
  button.dataset.previewReady='1';const key=button.dataset.key,d=TANK_DECOR[key];button.replaceChildren();
  const image=document.createElement('img');image.alt=d.name;image.loading='lazy';image.decoding='async';image.src=d.src;image.onerror=()=>{image.alt='ไม่พบภาพ';};
  const name=document.createElement('strong');name.textContent=d.name;button.title=d.name+" · กว้าง "+d.wCm+" ซม.";
  const size=document.createElement('small');size.textContent='กว้าง '+d.wCm+' ซม.';
  const price=document.createElement('b');price.textContent='● '+decorPrice(key).toLocaleString();button.append(image,name,size,price);
 }};
 for(const [dir,label] of [[-1,'เลื่อนซ้าย'],[1,'เลื่อนขวา']]){const b=document.createElement('button');b.className='decorNav '+(dir<0?'prev':'next');b.textContent=dir<0?'‹':'›';b.setAttribute('aria-label',label);b.onclick=()=>pal.scrollBy({left:dir*Math.max(100,pal.clientWidth-100),behavior:'auto'});tray.append(b);}
 let dockOpen=false;
 const oldSync=syncDecorBar;syncDecorBar=function(){oldSync();if(dockOpen!==tankBuildMode){const oldHeight=tankCv.getBoundingClientRect().height;dockOpen=tankBuildMode;body.classList.toggle('decor-open',dockOpen);resizeTank();tankCam.oy+=(TCH-oldHeight)/2;}toggle.textContent=tankBuildMode?'✓ เสร็จสิ้น':'✦ ตกแต่งตู้';toggle.setAttribute('aria-expanded',String(tankBuildMode));toggle.setAttribute('aria-controls','ovDecor');
  if(!tankBuildMode)return;syncTabs();
  {const _cr=G.decorCredit||0;for(const b of pal.querySelectorAll('.dbtn')){let bd=b.querySelector('.decorCreditBadge');if(_cr>0){if(!bd){bd=document.createElement('span');bd.className='decorCreditBadge';b.appendChild(bd);}bd.textContent='🎟️'+_cr;}else if(bd)bd.remove();}}
  const key=selDecorKey||selDecor?.key;selection.textContent=key?TANK_DECOR[key].name:'';cancel.hidden=!key;document.getElementById('dRemove').hidden=!selDecor;document.getElementById('dFlip').hidden=!key;
 };
 const oldEnter=enterTank;enterTank=function(...args){const result=oldEnter(...args);syncDecorBar();return result;};
 syncDecorBar();
})();
