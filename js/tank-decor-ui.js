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
 #tankDecorDock .dbtn{position:relative;flex:0 0 132px;width:132px;min-width:132px;height:130px;padding:4px;box-sizing:border-box;display:flex;flex-direction:column;gap:0;background:#20383a;border:1px solid #48605e;border-radius:7px;color:#e7d8b4;cursor:pointer}
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

// Match the tank decoration tray. Build once; selection updates reuse the cards.
(()=>{
 const shop=document.getElementById('shop'),stage=document.querySelector('.stage-wrap');
 const oldSection=shop.closest('.sec');
 const dock=document.createElement('aside');dock.id='floorBuildDock';dock.setAttribute('aria-label','สร้างของในร้าน');
 dock.innerHTML='<div class="floorBuildHead"><div class="decorTabs" role="tablist" aria-label="หมวดของในร้าน"></div><button class="tbtn floorBuildTools">เครื่องมือ</button><button class="tbtn floorBuildDone">✓ เสร็จสิ้น</button></div><div class="floorBuildSelection"><span aria-live="polite">เลือกของเพื่อวาง</span><button class="tbtn floorBuildCancel" hidden>ยกเลิกเลือก</button></div>';
 dock.append(shop);stage.append(dock);oldSection.remove();
 const tabs=dock.querySelector('.decorTabs'),selection=dock.querySelector('.floorBuildSelection span'),cancel=dock.querySelector('.floorBuildCancel');
 const categories=['ตู้เลี้ยง','เพาะพันธุ์','ของตกแต่ง','เคาน์เตอร์','เล่นกับทาก'];let active='ตู้เลี้ยง';
 const category=(k,d)=>d.playTable?'เล่นกับทาก':d.breeder?'เพาะพันธุ์':d.kind==='tank'?'ตู้เลี้ยง':k==='counter'?'เคาน์เตอร์':'ของตกแต่ง';
 function selectCategory(name){active=name;for(const b of tabs.children){const on=b.textContent===name;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}for(const b of shop.children)b.hidden=category(b.dataset.k,CATALOG[b.dataset.k])!==name;}
 for(const name of categories){const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('role','tab');b.setAttribute('aria-controls','shop');b.onclick=()=>{selectCategory(name);shop.scrollLeft=0;};b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const next=tabs.children[(categories.indexOf(name)+(e.key==='ArrowRight'?1:categories.length-1))%categories.length];next.click();next.focus();};tabs.append(b);}
 shop.setAttribute('role','tabpanel');shop.setAttribute('aria-label','ของสำหรับหน้าร้าน');
 function paintProduct(canvas,key,rotation=0){
  const d=CATALOG[key],o={id:'preview-'+key,type:d.kind,_key:key,def:d,cx:0,cy:0,rot:rotation,slugs:[],decor:[]};
  const saved={ctx,CW,CH,x:cam.x,y:cam.y,zoom:cam.zoom};
  try{
   ctx=canvas.getContext('2d');CW=canvas.width;CH=canvas.height;
   const w=oW(o),h=oH(o),z=objTopZ(o);
   let width=(w+h)*TW,height=(w+h)*TH+z;
   cam.x=(w-h)*TW/2;cam.y=((w+h)*TH-z)/2;
   if(key==="plant"){width=34;height=40;cam.x=0;cam.y=-8;}
   cam.zoom=Math.min((CW-24)/Math.max(1,width),(CH-20)/Math.max(1,height));
   ctx.clearRect(0,0,CW,CH);ctx.save();
   try{drawObject(o);}finally{ctx.restore();}
  }finally{ctx=saved.ctx;CW=saved.CW;CH=saved.CH;cam.x=saved.x;cam.y=saved.y;cam.zoom=saved.zoom;}
 }
 let previewRevision=0;
 const visiblePreviews=new Set();
 function updatePreview(canvas){
  if(document.hidden||appMode!=='build'||(typeof tankMode!=='undefined'&&tankMode)||!visiblePreviews.has(canvas))return;
  if(canvas.dataset.revision===String(previewRevision))return;
  paintProduct(canvas,canvas.dataset.product);canvas.dataset.revision=String(previewRevision);
 }
 const previewObserver=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){visiblePreviews.add(e.target);updatePreview(e.target);}else visiblePreviews.delete(e.target);}}, {root:shop,threshold:.01});
 // Repaint only when the real material finishes loading; camera movement never invalidates cards.
 for(const name of ['wood','sand','granite']){
  tex(name);const material=_texs[name];
  if(!material.img.complete)material.img.addEventListener('load',()=>{previewRevision++;for(const canvas of visiblePreviews)updatePreview(canvas);},{once:true});
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)for(const canvas of visiblePreviews)updatePreview(canvas);});

 const cards=new Map();
 buildShop=function(){
  for(const [k,d] of Object.entries(CATALOG)){
   let b=cards.get(k);
   if(!b){b=document.createElement('button');b.type='button';b.className='item';b.dataset.k=k;
    const icon=document.createElement('canvas');icon.className='productImage';icon.width=256;icon.height=176;icon.dataset.product=k;icon.setAttribute('aria-hidden','true');previewObserver.observe(icon);
    const name=document.createElement('span');name.className='nm';name.textContent=d.name;
    const price=document.createElement('b');price.className='pr';price.textContent=d.price?'● '+d.price.toLocaleString():'ฟรี';b.append(icon,name,price);
    b.title=d.name+' · '+d.w*CM_PER_CELL+'×'+d.h*CM_PER_CELL+' ซม.';b.setAttribute('aria-label',b.title+' · '+(d.price?d.price+' เหรียญ':'ฟรี'));
    b.onclick=()=>{buyKey=buyKey===k?null:k;if(buyKey)enterExclusiveMode('holding');buyRot=0;if(buyKey)setTool('place');buildShop();};
    cards.set(k,b);shop.append(b);
   }
   b.classList.toggle('on',buyKey===k);b.setAttribute('aria-pressed',String(buyKey===k));
  }
  const d=CATALOG[buyKey];if(d)active=category(buyKey,d);selectCategory(active);
  selection.textContent=d?d.name+' · '+d.w*CM_PER_CELL+'×'+d.h*CM_PER_CELL+' ซม.':'เลือกของเพื่อวาง';cancel.hidden=!buyKey;
  for(const canvas of visiblePreviews)updatePreview(canvas);
 };
 shop.replaceChildren();
 dock.querySelector('.floorBuildTools').onclick=()=>toggleFloorBuildTools();
 cancel.onclick=()=>{buyKey=null;buildShop();};dock.querySelector('.floorBuildDone').onclick=()=>setMode('view');
 for(const dir of [-1,1]){const b=document.createElement('button');b.className='floorBuildNav '+(dir<0?'prev':'next');b.textContent=dir<0?'‹':'›';b.setAttribute('aria-label',dir<0?'เลื่อนซ้าย':'เลื่อนขวา');b.onclick=()=>shop.scrollBy({left:dir*Math.max(100,shop.clientWidth-100),behavior:'auto'});dock.append(b);}
 const style=document.createElement('style');style.textContent=`
 #floorBuildDock{display:none;position:absolute;left:0;bottom:0;width:100%;height:208px;box-sizing:border-box;padding:6px 10px;background:#142b2e;border-top:1px solid #997f49;z-index:8;color:#e7d8b4}
 body.mode-build:not(.inside-tank) #floorBuildDock{display:block}
 body.mode-build:not(.inside-tank) #cv{height:calc(100% - 208px)}
 body.mode-build:not(.inside-tank) .zoombar{bottom:224px}
 #floorBuildDock [hidden]{display:none!important}
 .floorBuildHead{display:flex;justify-content:space-between;align-items:center;gap:8px;height:28px}
 #floorBuildDock .decorTabs{flex:1;min-width:0;overflow-x:auto;scrollbar-width:none}
 #floorBuildDock .decorTabs button{white-space:nowrap;padding:4px 10px}
 #floorBuildDock .floorBuildDone{flex-shrink:0;padding:5px 12px;background:#c6a459;color:#172b2d;border-color:#e2cc90;font-weight:700}
 #floorBuildDock .floorBuildTools{flex-shrink:0;padding:5px 8px;font-size:11px}
 body.mode-build:not(.inside-tank) .rail{position:absolute;right:0;top:0;bottom:208px;z-index:9}
 body.mode-build .body{position:relative}
 .floorBuildSelection{display:flex;align-items:center;gap:8px;height:30px;font-size:12px;color:#c8d0c7}
 .floorBuildSelection span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .floorBuildSelection button{padding:2px 8px;white-space:nowrap;font-size:11px}
 #floorBuildDock #shop{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;padding:0 32px;box-sizing:border-box;height:134px}
 #floorBuildDock #shop::-webkit-scrollbar{display:none}
 #floorBuildDock .item{flex:0 0 94px;width:94px;min-width:94px;height:94px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px;background:#20383a;border:1px solid #48605e;border-radius:7px;color:#e7d8b4}
 #floorBuildDock .item:hover,#floorBuildDock .item.on{background:#39483b;border-color:#e0bb66}
 #floorBuildDock .productImage{display:block;width:124px;height:86px;flex-shrink:0;object-fit:contain;background:radial-gradient(ellipse at 50% 65%,#65827866,transparent 72%);cursor:pointer;touch-action:auto}
 #floorBuildDock .nm{width:100%;font-size:11px;line-height:16px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 #floorBuildDock .pr{width:100%;text-align:center;font-size:12px;line-height:21px;border-top:1px solid #ffffff14;color:#f5d990;background:#142b2e;border-radius:0 0 4px 4px}
 .floorBuildNav{position:absolute;top:66px;bottom:12px;width:28px;border:0;border-radius:6px;background:#102426;color:#dcc78e;font-size:26px;cursor:pointer}.floorBuildNav.prev{left:7px}.floorBuildNav.next{right:7px}
 `;document.head.append(style);
 buildShop();resize();
})();

