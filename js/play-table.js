/* Play table: 50×50 cm footprint, 30×30 cm aquarium; one real slug per visit. */
const PlayTableLogic=(()=>{
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function create(){return {x:.5,y:.58,flip:false,pet:0,happy:0,poke:0,bite:0,walking:false,age:0};}
 function step(s,dt,input,satiety,head=.12,headY=0,halfWidth=.22,halfHeight=.22){
  dt=clamp(dt,0,.1);s.age+=dt;s.happy=Math.max(0,s.happy-dt);s.poke=Math.max(0,s.poke-dt);s.bite=Math.max(0,s.bite-dt);s.walking=false;
  if(!input.held||satiety>=100||s.happy>0)return false;
  const tx=clamp(input.x,.12,.88),ty=clamp(input.y,.3,.78);
  if(Math.abs(tx-s.x)>head+.025)s.flip=tx>s.x;
  const targetX=clamp(tx+(s.flip?-head:head),halfWidth,1-halfWidth),targetY=clamp(ty-headY,halfHeight,1-halfHeight),dx=targetX-s.x,dy=targetY-s.y,dist=Math.hypot(dx,dy);
  if(dist>.015){const amount=Math.min(dist,.18*dt);s.x+=dx/dist*amount;s.y+=dy/dist*amount;s.walking=true;return false;}
  if(s.bite===0){s.bite=1;return true;}return false;
 }
 function stroke(s,distance){if(s.happy>0)return false;s.pet=clamp(s.pet+Math.min(distance,35)/400,0,1);if(s.pet<1)return false;s.pet=0;s.happy=2.5;return true;}
 function poke(s){if(s.happy===0)s.poke=.45;}
 return {create,step,stroke,poke,clamp};
})();

// Static world geometry is cached by layout, including rotation; pan/zoom reuse it.
const playTableModels=new WeakMap();
function playTableModel(o){
 const key=[o.cx,o.cy,o.rot].join('|'),old=playTableModels.get(o);if(old?.key===key)return old.boxes;
 const boxes=[];
 function box(x,y,w,h,z,height,top,right,front){
  const points=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(p=>counterLocal(o.def,o.rot,...p));
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const b={x:o.cx+Math.min(...xs),y:o.cy+Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),z:z*ZUNIT,height:height*ZUNIT,top,right,front};boxes.push(b);
 }
 for(const [x,y] of [[.6,.6],[8.6,.6],[.6,8.6],[8.6,8.6]])box(x,y,.8,.8,0,12,'#bd9365','#64452c','#896040');
 box(.2,.2,9.6,9.6,10.5,1,'#bb9060','#775037','#986d46');
 box(0,0,10,10,12,.65,'#ead4ae','#9d7049','#c2996a');
 box(.25,.25,6,6,12.65,.25,'#dbbd85','#a99370','#b6a37e'); // 30×30 cm main tank
 box(.25,.25,6,6,12.9,4.4,'rgba(169,224,230,.22)','rgba(120,193,204,.33)','rgba(185,235,235,.32)');
 box(.25,.25,6,.12,17.3,.15,'#d9efea','#a7c7c4','#c1dfd8');
 box(.25,6.13,6,.12,17.3,.15,'#d9efea','#a7c7c4','#c1dfd8');
 box(.25,.25,.12,6,17.3,.15,'#d9efea','#a7c7c4','#c1dfd8');
 box(6.13,.25,.12,6,17.3,.15,'#d9efea','#a7c7c4','#c1dfd8');
 box(6.8,.4,2.7,3.4,12.65,.25,'#e4c68b','#8b7757','#b9a477');
 for(const [x,y,z] of [[7.2,1,1.5],[8.2,1.2,2.1],[7.7,2.1,1.7]]){box(x,y,.7,.7,12.9,z,'#ebb65e','#aa653f','#cf874c');box(x+.16,y+.16,.3,.3,12.9+z,.03,'#835236','#835236','#835236');}
 box(6.8,.4,2.7,3.4,12.9,2.9,'rgba(167,228,217,.18)','rgba(125,198,195,.3)','rgba(178,232,218,.22)');
 box(6.6,5.1,3,3.7,12.65,.18,'#e4ded0','#8d9290','#b8beb8');
 box(6.8,5.3,2.6,3.3,12.83,.05,'#8aa5a0','#78918b','#78918b');
 for(const [x,y] of [[7,5.7],[8.1,5.7],[7.3,6.7]])box(x,y,.7,.6,12.9,.35,'#e8b15e','#af7439','#c99048');
 // Two silver arms, resting on the tray's near edge.
 box(6.8,8,.12,1.45,13,.08,'#eff7ed','#83928e','#bacac3');
 box(7.1,8,.12,1.45,13,.08,'#eff7ed','#83928e','#bacac3');
 box(6.8,9.3,.42,.12,13,.08,'#eff7ed','#83928e','#bacac3');
 boxes.sort((a,b)=>(a.z-b.z)||(a.x+a.y+(a.w+a.h)/2)-(b.x+b.y+(b.w+b.h)/2));
 playTableModels.set(o,{key,boxes});return boxes;
}
function drawPlayTable(o){
 if(document.hidden||!onScreen(o))return;
 for(const b of playTableModel(o))isoBox(b.x,b.y,b.w,b.h,b.z,b.height,b.top,b.right,b.front);
}
function playTableHit(x,y){
 let best=null;
 for(const o of G.objs){if(!o.def.playTable)continue;const w=oW(o),h=oH(o),pts=[];
  for(const z of [0,18*ZUNIT])for(const [dx,dy]of [[0,0],[w,0],[w,h],[0,h]])pts.push(P(o.cx+dx,o.cy+dy,z));
  if(_inConvex(_hull(pts),x,y)&&(!best||o.cx+o.cy>best.cx+best.cy))best=o;
 }return best;
}

const PlayTable=(()=>{
 const dialog=document.createElement('dialog');dialog.id='playTableView';dialog.setAttribute('aria-label','เล่นกับทาก');
 dialog.innerHTML='<header><div><small>เวลาอยู่ด้วยกัน</small><h2>โต๊ะเล่นกับทาก</h2></div><button class="tbtn" data-close>กลับหน้าร้าน</button></header><div class="playLayout"><div class="playScene"><canvas aria-label="พื้นที่เล่นกับทาก ใช้ที่คีบอาหารหรือลูบตัว" tabindex="0"></canvas><div class="playGreeting">เลือกทากมาเล่นด้วยกัน</div></div><aside class="playControls"><label>เพื่อนตัวน้อย<select aria-label="เลือกทาก"></select></label><div class="playSat"><span>ความอิ่ม</span><output>0 / 100</output><progress max="100" value="0"></progress></div><div class="playToolRow"><button class="tbtn on" data-mode="feed">คีบอาหาร</button><button class="tbtn" data-mode="pet">ลูบ / จิ้ม</button></div><p class="playHelp">กดค้างเพื่อคีบฟองน้ำ แล้วเลื่อนให้น้องเดินตาม</p><div class="playAffection"><span>ความพอใจ</span><progress max="1" value="0"></progress></div><p class="playStatus" role="status"></p></aside></div>';
 document.body.append(dialog);
 const style=document.createElement('style');style.textContent=`
 #playTableView{width:min(1140px,96vw);height:min(780px,94dvh);max-width:96vw;max-height:94dvh;padding:0;border:1px solid #b29a69;border-radius:20px;background:#152c30;color:#f0e8d7;overflow:hidden;box-shadow:0 24px 80px #0008}
 #playTableView::backdrop{background:#09171bd9}#playTableView header{height:76px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:12px 24px;background:#1c3639;border-bottom:1px solid #d8bd7a38}
 #playTableView h2{margin:0;font-size:22px;font-weight:600}#playTableView small{color:#c2ac80;font-size:11px}#playTableView .playLayout{display:flex;height:calc(100% - 76px)}
 #playTableView .playScene{position:relative;flex:1;min-width:0;min-height:0;background:#193e43}#playTableView canvas{width:100%;height:100%;display:block;touch-action:none;cursor:crosshair}
 #playTableView .playControls{width:230px;box-sizing:border-box;padding:22px 18px;display:flex;flex-direction:column;gap:22px;background:#142b2e}
 #playTableView label{display:grid;gap:8px;font-size:12px;color:#c6d8ce}#playTableView select{width:100%;padding:10px 8px;border:1px solid #617971;border-radius:8px;color:#f4e6c7;background:#233f40;font:inherit}
 #playTableView progress{display:block;width:100%;height:8px;margin-top:10px;accent-color:#8ecea8}#playTableView output{float:right;color:#e9c77d;font-size:12px}.playSat,.playAffection{font-size:12px;color:#cedbd0}
 #playTableView .playToolRow{display:flex;gap:8px}#playTableView .playToolRow button{flex:1;white-space:nowrap;padding:10px 6px}#playTableView button.on{background:#d7ba79;color:#1c302c;border-color:#efd49a}
 #playTableView p{margin:0;font-size:13px;line-height:1.7;color:#afc6be}#playTableView .playStatus{color:#e9c77d;min-height:44px}
 #playTableView .playGreeting{position:absolute;top:24px;left:24px;right:24px;text-align:center;color:#e0f0df;font-size:15px;pointer-events:none}
 @media(max-width:700px){#playTableView{height:94dvh}#playTableView .playLayout{flex-direction:column}#playTableView header{padding:10px 14px}#playTableView h2{font-size:18px}#playTableView .playControls{width:100%;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px 16px}#playTableView .playScene{min-height:200px}#playTableView .playHelp,#playTableView .playStatus{font-size:11px}#playTableView .playGreeting{top:12px;font-size:12px}}
 `;document.head.append(style);
 const canvas=dialog.querySelector('canvas'),x=canvas.getContext('2d'),picker=dialog.querySelector('select'),output=dialog.querySelector('output'),satBar=dialog.querySelector('.playSat progress'),petBar=dialog.querySelector('.playAffection progress'),status=dialog.querySelector('.playStatus'),greeting=dialog.querySelector('.playGreeting');
 let table=null,slug=null,session=PlayTableLogic.create(),mode='feed',input={held:false,x:.5,y:.5},pointer=null,lastPoint=null,moved=0,options=[],raf=0,last=0,w=0,h=0,bg=null,sprites=null,spriteKey='',headOffset={x:-.3,y:.25},lastUI='',lastSave=0,nextCheck=0;
 const metrics={frames:0,spriteBuilds:0,backgroundBuilds:0};
 function available(){
  const all=[...(G.inv||[]),...[...G.objs,...G.shelter].flatMap(o=>o.slugs||[])];
  return [...new Set(all)].filter(s=>!s.breedZone&&!G.objs.concat(G.shelter).some(o=>o.breeding?.parents?.includes(s))&&!TRADE_OFFERS.some(o=>o.slug===s));
 }
 function pickSlug(){slug=options[Number(picker.value)]||null;session=PlayTableLogic.create();input.held=false;pointer=null;spriteKey='';releaseSprites();lastUI='';status.textContent='';refresh();}
 function releaseSprites(){if(sprites)for(const c of Object.values(sprites)){c.width=0;c.height=0;}sprites=null;}
 function refresh(){
  const sat=Math.min(100,Math.max(0,slug?.satiety??0)),key=[slug?.id,Math.ceil(sat),Math.floor(session.pet*100),mode,session.happy>0].join('|');if(key===lastUI)return;lastUI=key;
  output.textContent=Math.round(sat)+' / 100';satBar.value=sat;petBar.value=session.pet;
  if(slug&&picker.selectedOptions[0])picker.selectedOptions[0].textContent=slug.id+' · อิ่ม '+Math.round(sat);
  greeting.textContent=slug?(session.happy>0?'ชอบที่สุดเลย!':sat>=100&&mode==='feed'?'อิ่มแล้ว มาเล่นด้วยกันต่อสิ':slug.id):'เลือกทากมาเล่นด้วยกัน';
  dialog.querySelector('.playAffection').hidden=mode!=='pet';
  for(const b of dialog.querySelectorAll('[data-mode]'))b.classList.toggle('on',b.dataset.mode===mode);
 }
 function bakeSprites(){
  if(!slug)return;const genes=foodGenes(slug),resolution=Math.min(640,Math.max(360,Math.round(Math.min(w*.46,h*.56)*Math.min(2,devicePixelRatio||1)))),key=JSON.stringify(genes)+'|'+resolution;if(key===spriteKey&&sprites)return;
  releaseSprites();const parts=SlugEngine.slugParts(genes,resolution),bw=Math.ceil(parts.w+24),bh=Math.ceil(parts.h+24),old=SlugEngine.ANIM;
  const eyes=SlugEngine.FACE.eyes,ex=eyes.reduce((v,e)=>v+e.u,0)/eyes.length,ey=eyes.reduce((v,e)=>v+e.v,0)/eyes.length;
  headOffset={x:(ex*parts.bw-(parts.L+parts.R)/2)*parts.s/bw,y:(ey*parts.bh-(parts.T+parts.B)/2)*parts.s/bh};
  try{SlugEngine.ANIM=false;sprites={};for(const happy of [false,true]){
   const c=document.createElement('canvas');c.width=bw;c.height=bh;const cx=c.getContext('2d');
   SlugEngine.drawSlug(cx,parts,bw/2,bh/2,false,0,1,true,false,{noBob:true,noEyes:happy});
   if(happy){cx.save();cx.translate(bw/2,bh/2);cx.scale(parts.s,parts.s);cx.translate(-(parts.L+parts.R)/2,-(parts.T+parts.B)/2);cx.strokeStyle='#172326';cx.lineWidth=Math.max(2,parts.bh*.018);cx.lineCap='round';cx.lineJoin='round';
    SlugEngine.FACE.eyes.forEach((e,i)=>{const ex=e.u*parts.bw,ey=e.v*parts.bh,r=e.hR*parts.bh*.42,side=i===0?-1:1;cx.beginPath();cx.moveTo(ex-side*r*.65,ey-r);cx.lineTo(ex+side*r*.65,ey);cx.lineTo(ex-side*r*.65,ey+r);cx.stroke();});cx.restore();
   }sprites[happy?'happy':'normal']=c;
  }spriteKey=key;metrics.spriteBuilds++;
  }finally{SlugEngine.ANIM=old;}
 }
 function resizeScene(){if(!dialog.open||document.hidden)return;const r=canvas.getBoundingClientRect();if(r.width<1||r.height<1)return;w=r.width;h=r.height;const ratio=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);x.setTransform(ratio,0,0,ratio,0,0);bg=null;}
 function background(){
  if(bg)return bg;bg=document.createElement('canvas');bg.width=canvas.width;bg.height=canvas.height;const b=bg.getContext('2d'),r=bg.width/w;b.scale(r,r);
  const g=b.createLinearGradient(0,0,0,h);g.addColorStop(0,'#163f49');g.addColorStop(.65,'#4e8889');g.addColorStop(1,'#c9bb91');b.fillStyle=g;b.fillRect(0,0,w,h);
  const glow=b.createRadialGradient(w*.45,h*.28,0,w*.45,h*.28,w*.7);glow.addColorStop(0,'#e3f7d82b');glow.addColorStop(1,'#e3f7d800');b.fillStyle=glow;b.fillRect(0,0,w,h);
  b.fillStyle='#d6c397';b.beginPath();b.ellipse(w*.5,h*.92,w*.75,h*.22,0,0,Math.PI*2);b.fill();
  // Static tray, sponge pieces and glass nursery at the edges of the close-up tank.
  b.fillStyle='#e2dcc8';b.beginPath();b.roundRect(w*.72,h*.84,w*.23,h*.105,10);b.fill();
  for(let i=0;i<3;i++)sponge(b,w*(.755+i*.06),h*.885,Math.min(w*.027,15));
  b.fillStyle='#aedbd34a';b.strokeStyle='#d2ece28c';b.lineWidth=2;b.beginPath();b.roundRect(w*.035,h*.64,w*.13,h*.25,8);b.fill();b.stroke();
  sponge(b,w*.08,h*.81,Math.min(w*.026,18));sponge(b,w*.12,h*.78,Math.min(w*.021,15));
  metrics.backgroundBuilds++;return bg;
 }
 function sponge(c,px,py,r){c.fillStyle='#d8a15b';c.beginPath();c.roundRect(px-r,py-r,r*2,r*1.65,r*.35);c.fill();c.fillStyle='#96613e';for(const [dx,dy]of [[-.4,-.3],[.35,-.45],[.05,.2]]){c.beginPath();c.arc(px+dx*r,py+dy*r,r*.15,0,7);c.fill();}}
 function dimensions(){if(!sprites)return {width:w*.4,height:h*.45};const c=sprites.normal,scale=Math.min(w*(w<500?.68:.46)/c.width,h*.56/c.height);return {width:c.width*scale,height:c.height*scale};}
 function hit(p){if(!slug||!sprites)return false;const d=dimensions();return Math.abs(p.x*w-session.x*w)<d.width*.42&&Math.abs(p.y*h-session.y*h)<d.height*.36;}
 function foodPoint(){const d=dimensions(),hy=headOffset.y*d.height/h,halfH=d.height/h*.5+.01;return {x:PlayTableLogic.clamp(input.x,.12,.88),y:PlayTableLogic.clamp(input.y,Math.max(.3,halfH+hy),Math.min(.78,1-halfH+hy))};}
 function draw(){
  x.clearRect(0,0,w,h);x.drawImage(background(),0,0,w,h);
  if(slug&&sprites){const d=dimensions(),happy=session.happy>0||(mode==='feed'&&input.held&&slug.satiety<100),c=happy?sprites.happy:sprites.normal;
   const wiggle=session.happy>0?Math.sin(session.age*34)*.045:session.poke>0?Math.sin(session.age*28)*.02:0;
   const stretch=session.walking?1+Math.sin(session.age*7)*.025:1;
   x.save();x.translate(session.x*w,session.y*h);x.rotate(wiggle);x.scale(session.flip?-stretch:stretch,session.poke>0?.96:1);x.drawImage(c,-d.width/2,-d.height/2,d.width,d.height);x.restore();
   if(session.happy>0){x.fillStyle='#f19eb3';x.font='28px sans-serif';x.textAlign='center';x.fillText('♥',session.x*w,session.y*h-d.height*.48-(2.5-session.happy)*15);x.fillText('♥',session.x*w+d.width*.15,session.y*h-d.height*.45-(2.5-session.happy)*20);}
  }
  if(mode==='feed'&&input.held&&slug&&slug.satiety<100){const p=foodPoint(),px=p.x*w,py=p.y*h;x.lineCap='round';x.strokeStyle='#dcece3';x.lineWidth=4;x.beginPath();x.moveTo(px+38,py-68);x.lineTo(px-3,py-6);x.moveTo(px+43,py-65);x.lineTo(px+7,py-5);x.stroke();sponge(x,px,py,9);}
  metrics.frames++;
 }
 function frame(now){raf=0;if(!dialog.open||document.hidden)return;if(now-last<1000/30){raf=requestAnimationFrame(frame);return;}const dt=Math.min(.1,(now-(last||now))/1000);last=now;
  if(now>=nextCheck){nextCheck=now+1000;if(slug&&!available().includes(slug)){slug=null;releaseSprites();status.textContent='ทากตัวนี้ไม่ว่างแล้ว กรุณาเลือกตัวอื่น';}if(slug)bakeSprites();}
  if(slug){if(!sprites)bakeSprites();const d=dimensions(),bite=PlayTableLogic.step(session,dt,{...foodPoint(),held:mode==='feed'&&input.held},slug.satiety,Math.abs(headOffset.x)*d.width/w,headOffset.y*d.height/h,d.width/w*.5+.01,d.height/h*.5+.01);
   if(bite){const before=slug.satiety;applyFood(slug,{type:'sponge',level:1,spec:FOOD_TYPES.sponge.levels[0],eaten:[]});if(slug.satiety>before){G.stats.fed=(G.stats.fed||0)+1;saveGame();status.textContent=slug.satiety>=100?'อิ่มเต็ม 100 แล้ว':'ง่ำ… อร่อยจัง';}}
  }
  refresh();draw();if(now-lastSave>5000){lastSave=now;if(slug)saveGame();}raf=requestAnimationFrame(frame);
 }
 function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};}
 canvas.addEventListener('pointerdown',e=>{if(pointer!==null||!slug)return;e.preventDefault();pointer=e.pointerId;canvas.setPointerCapture(pointer);input={...point(e),held:true};lastPoint=point(e);moved=0;if(mode==='pet'&&!hit(lastPoint))input.held=false;});
 canvas.addEventListener('pointermove',e=>{const p=point(e);input.x=p.x;input.y=p.y;if(pointer!==e.pointerId||!lastPoint)return;
  const distance=Math.hypot((p.x-lastPoint.x)*w,(p.y-lastPoint.y)*h);moved+=distance;
  if(mode==='pet'&&input.held&&hit(p)&&hit(lastPoint)){if(PlayTableLogic.stroke(session,distance)){status.textContent='น้องพอใจแล้ว!';if(typeof playNotificationSound==='function')playNotificationSound('success');}}lastPoint=p;
 });
 function release(e){if(e&&pointer!==e.pointerId)return;if(mode==='pet'&&input.held&&moved<8&&lastPoint&&hit(lastPoint)){PlayTableLogic.poke(session);status.textContent='จิ้มเบา ๆ… น้องขยับหนวดทักทาย';}input.held=false;pointer=null;lastPoint=null;}
 canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',()=>{input.held=false;pointer=null;lastPoint=null;});canvas.addEventListener('lostpointercapture',()=>{input.held=false;pointer=null;lastPoint=null;});
 for(const b of dialog.querySelectorAll('[data-mode]'))b.onclick=()=>{mode=b.dataset.mode;input.held=false;pointer=null;status.textContent='';dialog.querySelector('.playHelp').textContent=mode==='feed'?'กดค้างเพื่อคีบฟองน้ำ แล้วเลื่อนให้น้องเดินตาม':'กดแล้วลูบไปมาบนตัว หรือแตะเบา ๆ เพื่อจิ้ม';canvas.style.cursor=mode==='pet'?'pointer':'crosshair';refresh();};
 picker.onchange=pickSlug;
 function close(){if(!dialog.open)return;input.held=false;pointer=null;cancelAnimationFrame(raf);raf=0;saveGame();dialog.close();table=null;slug=null;releaseSprites();bg=null;document.body.classList.remove('playing-slug');last=0;cv.focus();}
 dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 new ResizeObserver(()=>resizeScene()).observe(canvas);
 document.addEventListener('visibilitychange',()=>{input.held=false;pointer=null;if(document.hidden){cancelAnimationFrame(raf);raf=0;if(dialog.open)saveGame();}else if(dialog.open){last=0;resizeScene();raf=requestAnimationFrame(frame);}});
 window.addEventListener('blur',()=>{input.held=false;pointer=null;});window.addEventListener('pagehide',()=>{if(dialog.open)saveGame();});
 // The borrowed slug stays in its source collection; only its own movement pauses.
 const oldStep=stepTankSlugs;stepTankSlugs=function(slugs,...args){return oldStep(dialog.open&&slug?slugs.filter(s=>s!==slug):slugs,...args);};
 function open(o){if(!o?.def.playTable||!G.objs.includes(o)||dialog.open)return;table=o;options=available();picker.replaceChildren();
  if(!options.length){const op=document.createElement('option');op.textContent='ยังไม่มีทากว่าง';picker.append(op);}
  options.forEach((s,i)=>{const op=document.createElement('option');op.value=i;op.textContent=s.id+' · อิ่ม '+Math.round(s.satiety??50);picker.append(op);});
  picker.disabled=!options.length;dialog.showModal();document.body.classList.add('playing-slug');pickSlug();resizeScene();last=0;lastSave=performance.now();raf=requestAnimationFrame(frame);
 }
 return {open,close,isOpen:()=>dialog.open,get slug(){return slug;},metrics};
})();
function openPlayTable(o){PlayTable.open(o);}
