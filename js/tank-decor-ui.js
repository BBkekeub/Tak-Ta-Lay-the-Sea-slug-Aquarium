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
 dock.innerHTML='<div class="floorBuildHead"><div class="decorTabs" role="tablist" aria-label="หมวดของในร้าน"></div><div class="floorBuildActions" role="group" aria-label="เครื่องมือก่อสร้าง"></div><button class="tbtn floorBuildDone">✓ เสร็จสิ้น</button></div><div class="floorBuildSelection"><span aria-live="polite">เลือกของเพื่อวาง</span><button class="tbtn floorBuildCancel" hidden>ยกเลิกเลือก</button></div>';
 dock.append(shop);stage.append(dock);oldSection.remove();
 const tabs=dock.querySelector('.decorTabs'),selection=dock.querySelector('.floorBuildSelection span'),cancel=dock.querySelector('.floorBuildCancel');
 // 'วัสดุ' ต่อจาก 'อุปกรณ์สำคัญ' — แท็บเลือกวัสดุพื้น/กำแพงร้าน ไม่ผูกกับ CATALOG จึงไม่มีของใน #shop ขึ้นตรงนี้ (ดูพาแนล matPanel ด้านล่าง)
 const categories=['ตู้เลี้ยง','ของตกแต่ง','อุปกรณ์สำคัญ','วัสดุ'];let active='ตู้เลี้ยง';
 const category=(k,d)=>(!d||d.playTable||k==='counter')?'อุปกรณ์สำคัญ':d.kind==='tank'?'ตู้เลี้ยง':'ของตกแต่ง';
 const navButtons=[];
 function selectCategory(name){active=name;for(const b of tabs.children){const on=b.textContent===name;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}for(const b of shop.children)b.hidden=category(b.dataset.k,CATALOG[b.dataset.k])!==name;const onMat=name==='วัสดุ';shop.hidden=onMat;matPanel.hidden=!onMat;for(const b of navButtons)b.hidden=onMat;}
 for(const name of categories){const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('role','tab');b.setAttribute('aria-controls',name==='วัสดุ'?'floorMatPanel':'shop');b.onclick=()=>{selectCategory(name);shop.scrollLeft=0;};b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const next=tabs.children[(categories.indexOf(name)+(e.key==='ArrowRight'?1:categories.length-1))%categories.length];next.click();next.focus();};tabs.append(b);}
 shop.setAttribute('role','tabpanel');shop.setAttribute('aria-label','ของสำหรับหน้าร้าน');

 // ---- แท็บ "วัสดุ": สวอตช์เลือกพื้น/กำแพงร้าน (แทน dropdown เดิม) ----
 const matPanel=document.createElement('div');matPanel.id='floorMatPanel';matPanel.className='floorMatPanel';matPanel.hidden=true;
 matPanel.setAttribute('role','tabpanel');matPanel.setAttribute('aria-label','วัสดุพื้นและกำแพงร้าน');
 const matRow=(labelText,options,getCurrent,onPick)=>{
  const group=document.createElement('div');group.className='floorMatGroup';
  const label=document.createElement('span');label.className='floorMatGroupLabel';label.textContent=labelText;group.append(label);
  const row=document.createElement('div');row.className='floorMatRow';group.append(row);
  const swatches=[];
  for(const opt of options){
   const b=document.createElement('button');b.type='button';b.className='matSwatch';b.title=opt.label;
   b.setAttribute('aria-pressed',String(opt.id===getCurrent()));
   const thumb=document.createElement('span');thumb.className='thumb';thumb.style.backgroundImage='url("'+opt.file+'")';
   const name=document.createElement('b');name.textContent=opt.label;
   b.append(thumb,name);
   b.onclick=()=>{onPick(opt.id);for(const [o,el] of swatches)el.setAttribute('aria-pressed',String(o.id===getCurrent()));if(typeof saveGame==='function')saveGame();};
   swatches.push([opt,b]);row.append(b);
  }
  matPanel.append(group);
 };
 // เลือกลาย = "หยิบพู่กัน" ไว้ก่อน ยังไม่เปลี่ยนอะไรจนกว่าจะคลิกช่องพื้น/กำแพงบนพื้นร้าน (ดู tile-paint.js)
 if(typeof FLOOR_MATERIALS!=='undefined')matRow('พื้น',FLOOR_MATERIALS,()=>TilePaint.current('floor'),id=>TilePaint.pick('floor',id));
 if(typeof WALL_MATERIALS!=='undefined')matRow('กำแพง',WALL_MATERIALS,()=>TilePaint.current('wall'),id=>TilePaint.pick('wall',id));
 shop.after(matPanel);
 function paintProduct(canvas,key,rotation=0){
  if(key==='wall-door'||key==='wall-shelf'){paintWallProduct(canvas,key);return;}
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

 document.addEventListener('play-table-art-ready',()=>{previewRevision++;for(const canvas of visiblePreviews)updatePreview(canvas);});
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

 // Move the real controls so their listeners, selected state and keyboard shortcuts survive.
 const actions=dock.querySelector('.floorBuildActions');
 for(const b of document.querySelectorAll('.rail .tool')){
  b.textContent=({place:'วาง / ย้าย',sell:'ขายทิ้ง',remove:'เก็บ'})[b.dataset.tool];
  b.addEventListener('click',()=>{exitModes('floor');setTool(b.dataset.tool);buildShop();});actions.append(b);
 }
 const rotate=document.getElementById('bRotate');rotate.style.width='';rotate.setAttribute('aria-label','กลับด้าน หมุน 90 องศา');actions.prepend(rotate);
 const hint=document.getElementById('toolHint');hint.className='floorBuildHint';dock.querySelector('.floorBuildSelection').append(hint);
 // Expansion stays inline; retain its confirmation controls and selected-cell cost.
 const expansion=document.getElementById('expW').closest('.sec');
 const expandDetails=document.createElement('details');expandDetails.className='floorBuildExpansion';
 const expandSummary=document.createElement('summary');expandSummary.textContent='ขยายร้าน';expandDetails.append(expandSummary);
 while(expansion.firstChild)expandDetails.append(expansion.firstChild);
 expansion.remove();dock.querySelector('.floorBuildSelection').append(expandDetails);
 dock.addEventListener('click',e=>{if(e.target.closest('button')&&!expandDetails.contains(e.target))expandDetails.open=false;});
 // Wall fixtures use the same product list, but never become floor CATALOG objects.
 function paintWallProduct(canvas,key){
  if(typeof drawWallShelf!=='function')return;
  const saved={ctx,CW,CH,x:cam.x,y:cam.y,zoom:cam.zoom};
  try{
   ctx=canvas.getContext('2d');CW=canvas.width;CH=canvas.height;cam.zoom=1;cam.x=0;cam.y=0;
   const shelf=key==='wall-shelf',w=shelf?SHELF_W:2*SUB,low=shelf?SHELF_Z[0]:0,high=shelf?SHELF_Z[1]+SHELF_BOX_H+SHELF_T:40*ZUNIT;
   const points=[P(0,0,low),P(w,0,low),P(0,0,high),P(w,shelf?SHELF_D:0,high)];
   const xs=points.map(p=>p.x-CW/2),ys=points.map(p=>p.y-CH/2);
   const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
   cam.x=(x0+x1)/2;cam.y=(y0+y1)/2;cam.zoom=Math.min((CW-30)/(x1-x0),(CH-28)/(y1-y0));
   ctx.clearRect(0,0,CW,CH);ctx.save();
   try{if(shelf)drawWallShelf({side:'north',offset:0});else drawDoorLeaf({side:'north',offset:0},true);}finally{ctx.restore();}
  }finally{ctx=saved.ctx;CW=saved.CW;CH=saved.CH;cam.x=saved.x;cam.y=saved.y;cam.zoom=saved.zoom;}
 }
 window.addEventListener('load',()=>{
  for(const [key,label,start]of [['wall-door','ประตู',placeEntrance],['wall-shelf','ชั้นวางติดผนัง',placeWallShelf]]){
   const b=document.createElement('button');b.type='button';b.className='item';b.dataset.k=key;
   const icon=document.createElement('canvas');icon.className='productImage';icon.width=256;icon.height=176;icon.dataset.product=key;icon.setAttribute('aria-hidden','true');
   const title=document.createElement('span');title.className='nm';title.textContent=label;
   const price=document.createElement('b');price.className='pr';price.textContent='ฟรี · ติดกำแพง';b.append(icon,title,price);
   b.onclick=()=>{setTool('place');start();selectCategory('อุปกรณ์สำคัญ');selection.textContent=label+' · แตะกำแพงเพื่อวาง';};shop.append(b);previewObserver.observe(icon);
  }
  for(const b of document.querySelectorAll('.rail button[onclick*="Entrance"],.rail button[onclick*="WallShelf"],.rail button[onclick*="TradeCounter"]'))b.remove();
  selectCategory(active);previewRevision++;for(const canvas of visiblePreviews)updatePreview(canvas);
 });
 // Pick wall fixtures on their actual wall footprint; empty wall drags still pan the camera.
 let wallPress=null;
 function wallFixtureAt(e){
  const {sx,sy}=screenXY(e);
  for(const [key,d,w,lo,hi]of [['shelf',G.shelf,typeof SHELF_W==='undefined'?0:SHELF_W,typeof SHELF_Z==='undefined'?0:SHELF_Z[0],typeof SHELF_Z==='undefined'?0:SHELF_Z[1]+SHELF_BOX_H+SHELF_T],['door',G.door,2*SUB,0,40*ZUNIT]]){
   if(!d)continue;
   const a=wallPoint(d.side,d.offset,0),b=wallPoint(d.side,d.offset+w,0),f=(sx-a.x)/(b.x-a.x);
   if(f<0||f>1)continue;
   const z=(a.y+(b.y-a.y)*f-sy)/cam.zoom;if(z>=lo&&z<=hi)return key;
  }return null;
 }
 cv.addEventListener('pointerdown',e=>{
  wallPress=null;if(appMode!=='build'||buyKey||moving||placingWallDoor||typeof placingShelf==='undefined'||placingShelf||[...APP_MODES.values()].some(m=>m.group==='floor'&&m.isOn()))return;
  const key=wallFixtureAt(e);if(key)wallPress={key,x:e.clientX,y:e.clientY};
 },true);
 cv.addEventListener('pointerup',e=>{
  const press=wallPress;wallPress=null;if(!press||Math.hypot(e.clientX-press.x,e.clientY-press.y)>6||wallFixtureAt(e)!==press.key)return;
  e.stopImmediatePropagation();dragging=false;grab=null;cv.classList.remove('panning','placing');
  if(tool==='remove'||tool==='sell'){if(press.key==='door')removeEntrance();else removeWallShelf();}
  else if(press.key==='door')placeEntrance();else placeWallShelf();
 },true);
 cv.addEventListener('pointercancel',()=>{wallPress=null;});

 cancel.onclick=()=>{buyKey=null;buildShop();};dock.querySelector('.floorBuildDone').onclick=()=>setMode('view');
 for(const dir of [-1,1]){const b=document.createElement('button');b.className='floorBuildNav '+(dir<0?'prev':'next');b.textContent=dir<0?'‹':'›';b.setAttribute('aria-label',dir<0?'เลื่อนซ้าย':'เลื่อนขวา');b.onclick=()=>shop.scrollBy({left:dir*Math.max(100,shop.clientWidth-100),behavior:'auto'});dock.append(b);navButtons.push(b);}
 const style=document.createElement('style');style.textContent=`
 #floorBuildDock{display:none;position:absolute;left:0;bottom:0;width:100%;height:250px;box-sizing:border-box;padding:6px 10px;background:#142b2e;border-top:1px solid #997f49;z-index:8;color:#e7d8b4}
 body.mode-build:not(.inside-tank) #floorBuildDock{display:block}
 body.mode-build:not(.inside-tank) #cv{height:calc(100% - 250px)}
 body.mode-build:not(.inside-tank) .zoombar{bottom:266px}
 #floorBuildDock [hidden]{display:none!important}
 .floorBuildHead{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:6px;height:88px}.floorBuildHead>.decorTabs{flex-basis:100%!important;height:36px}.floorBuildActions{display:flex;flex:1;gap:5px;min-width:0}.floorBuildActions button{min-height:40px;white-space:nowrap;padding:5px 10px!important;font-size:12px!important}.floorBuildHint{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;color:#b5c3ba}.floorBuildExpansion{margin-left:auto;position:relative;flex-shrink:0}.floorBuildExpansion summary{cursor:pointer;padding:6px 10px}.floorBuildExpansion[open]{position:absolute;right:8px;bottom:150px;width:min(360px,calc(100% - 32px));padding:12px;background:#20383a;border:1px solid #997f49;border-radius:10px;z-index:3}.floorBuildExpansion h2{display:none}.floorBuildExpansion .hint{font-size:12px}.floorBuildExpansion .toolrow{display:flex}.floorBuildExpansion button{min-height:40px}.floorBuildExpansion [hidden]{display:none!important}
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
 .floorBuildNav{position:absolute;top:126px;bottom:12px;width:28px;border:0;border-radius:6px;background:#102426;color:#dcc78e;font-size:26px;cursor:pointer}.floorBuildNav.prev{left:7px}.floorBuildNav.next{right:7px}
 #floorBuildDock .floorMatPanel{width:100%;height:134px;box-sizing:border-box;padding:4px 32px;display:flex;flex-direction:column;gap:6px;overflow:hidden}
 .floorMatGroup{display:flex;align-items:center;gap:8px;flex:1;min-height:0}
 .floorMatGroupLabel{flex:0 0 40px;font-size:11px;color:#c3c9bd}
 .floorMatRow{flex:1;min-width:0;height:100%;display:flex;align-items:center;gap:6px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
 .floorMatRow::-webkit-scrollbar{display:none}
 .matSwatch{flex:0 0 62px;width:62px;height:100%;max-height:58px;box-sizing:border-box;padding:3px;display:flex;flex-direction:column;gap:3px;background:#20383a;border:1px solid #48605e;border-radius:7px;color:#e7d8b4;cursor:pointer}
 .matSwatch:hover{background:#39483b;border-color:#e0bb66}
 .matSwatch .thumb{width:100%;flex:1;min-height:0;border-radius:5px;background-size:cover;background-position:center;border:1px solid #ffffff14}
 .matSwatch b{font-size:9px;line-height:1.2;font-weight:500;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .matSwatch[aria-pressed="true"]{background:#39483b;border-color:#e6c173}
 .matSwatch[aria-pressed="true"] .thumb{box-shadow:0 0 0 2px #e6c173}
 `;document.head.append(style);
 buildShop();resize();
})();

