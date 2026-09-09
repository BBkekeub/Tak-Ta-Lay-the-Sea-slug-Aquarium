/* Play table: 50×50 cm footprint, 30×30 cm aquarium; one real slug per visit. */
const PlayTableLogic=(()=>{
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function create(){return {x:.5,y:.58,flip:false,pet:0,happy:0,poke:0,bite:0,walking:false,age:0,rest:.5,target:null,vx:0,vy:0,petTouch:0,creep:0,facing:1};}
 function step(s,dt,input,satiety,head=.12,headY=0,halfWidth=.22,halfHeight=.22){
  dt=clamp(dt,0,.1);s.age+=dt;s.happy=Math.max(0,s.happy-dt);s.poke=Math.max(0,s.poke-dt);s.bite=Math.max(0,s.bite-dt);s.walking=false;
  s.petTouch=Math.max(0,s.petTouch-dt);
  const feeding=input.held&&satiety<100;
  if(!feeding){
   s.rest=Math.max(0,s.rest-dt);
   if(!s.target&&s.rest===0)s.target={x:halfWidth+Math.random()*(1-2*halfWidth),y:halfHeight+Math.random()*(1-2*halfHeight)};
   const dx=s.target?s.target.x-s.x:0,dy=s.target?s.target.y-s.y:0,dist=Math.hypot(dx,dy),speed=s.petTouch>0||s.happy>0||s.poke>0?0:.045;
   if(s.target&&dist<.015){s.target=null;s.rest=1+Math.random()*2.5;}
   const blend=1-Math.exp(-dt*7),moving=!!s.target&&dist>.015;
   s.vx+=((moving?dx/dist*speed:0)-s.vx)*blend;s.vy+=((moving?dy/dist*speed:0)-s.vy)*blend;
   s.x=clamp(s.x+s.vx*dt,halfWidth,1-halfWidth);s.y=clamp(s.y+s.vy*dt,halfHeight,1-halfHeight);
   s.walking=Math.hypot(s.vx,s.vy)>.002;if(Math.abs(s.vx)>.006)s.flip=s.vx>0;
   s.creep+=Math.hypot(s.vx,s.vy)*dt*100;return false;
  }
  s.vx=s.vy=0;s.target=null;s.rest=.8;
  const tx=clamp(input.x,.12,.88),ty=clamp(input.y,.3,.78);
  if(Math.abs(tx-s.x)>head+.025)s.flip=tx>s.x;
  const targetX=clamp(tx+(s.flip?-head:head),halfWidth,1-halfWidth),targetY=clamp(ty-headY,halfHeight,1-halfHeight),dx=targetX-s.x,dy=targetY-s.y,dist=Math.hypot(dx,dy);
  if(dist>.015){const amount=Math.min(dist,.18*dt);s.x+=dx/dist*amount;s.y+=dy/dist*amount;s.creep+=amount*100;s.walking=true;return false;}
  if(s.bite===0){s.bite=1;return true;}return false;
 }
 function stroke(s,distance){s.petTouch=.4;if(s.happy>0)return false;s.pet=clamp(s.pet+Math.min(distance,70)/1600,0,1);if(s.pet<1||s.happy>0)return false;s.pet=0;s.happy=2.5;return true;}
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
  const b={x:o.cx+Math.min(...xs),y:o.cy+Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),z:z*ZUNIT,height:height*ZUNIT,top,right,front};boxes.push(b);return b;
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
 box(6.8,.4,2.7,3.4,12.9,2.9,'rgba(167,228,217,.18)','rgba(125,198,195,.3)','rgba(178,232,218,.22)').foodNursery=true;
 box(6.6,5.1,3,3.7,12.65,.18,'#e4ded0','#8d9290','#b8beb8');
 box(6.8,5.3,2.6,3.3,12.83,.05,'#8aa5a0','#78918b','#78918b').foodTray=true;
 // Two silver arms, resting on the tray's near edge.
 box(6.8,8,.12,1.45,13,.08,'#eff7ed','#83928e','#bacac3');
 box(7.1,8,.12,1.45,13,.08,'#eff7ed','#83928e','#bacac3');
 box(6.8,9.3,.42,.12,13,.08,'#eff7ed','#83928e','#bacac3');
 boxes.sort((a,b)=>(a.z-b.z)||(a.x+a.y+(a.w+a.h)/2)-(b.x+b.y+(b.w+b.h)/2));
 playTableModels.set(o,{key,boxes});return boxes;
}
// Share the exact table geometry with the character depth buffer.
const playTableDepthCache=new WeakMap();
function playTableDepthFaces(o){
 const boxes=playTableModel(o),cached=playTableDepthCache.get(o);if(cached?.boxes===boxes)return cached;
 const entry={boxes,opaque:[],glass:[]};
 for(const b of boxes){const x=b.x,y=b.y,w=b.w,h=b.h,lo=b.z/ZUNIT,hi=(b.z+b.height)/ZUNIT;
  const a=[x,y,lo],c=[x+w,y,lo],d=[x+w,y+h,lo],e=[x,y+h,lo],A=[x,y,hi],B=[x+w,y,hi],C=[x+w,y+h,hi],D=[x,y+h,hi];
  if(b.top.startsWith('rgba'))entry.glass.push([A,B,C,D],[c,d,C,B],[e,d,C,D]);
  else entry.opaque.push([A,B,C,D],[a,c,B,A],[c,d,C,B],[d,e,D,C],[e,a,A,D]);
 }
 playTableDepthCache.set(o,entry);return entry;
}
// One shared raster of the existing food art; never rebake on pan or zoom.
const playTableFoodArt={whole:null,pieces:[]};
function loadPlayTableFoodArt(){
 const image=new Image();image.onload=()=>{
  const whole=document.createElement('canvas');whole.width=whole.height=256;whole.getContext('2d').drawImage(image,0,0,256,256);playTableFoodArt.whole=whole;
  for(let i=0;i<3;i++){const c=document.createElement('canvas');c.width=c.height=96;const q=c.getContext('2d');q.beginPath();for(let j=0;j<20;j++){const angle=j*Math.PI/10,r=35+Math.sin(j*2.3+i)*7;const x=48+Math.cos(angle)*r,y=48+Math.sin(angle)*r;j?q.lineTo(x,y):q.moveTo(x,y);}q.closePath();q.clip();q.drawImage(image,330+i*80,360+i*65,230,230,0,0,96,96);playTableFoodArt.pieces.push(c);}
  document.dispatchEvent(new Event('play-table-art-ready'));
 };image.src='assets/food/sponge.png';
}
loadPlayTableFoodArt();
function drawPlayTableFood(o,nursery){
 const art=playTableFoodArt;if(!art.whole)return;
 const local=(x,y,z)=>{const p=counterLocal(o.def,o.rot,x,y);return P(o.cx+p[0],o.cy+p[1],z*ZUNIT);};
 if(nursery){const p=local(8.15,2.3,12.95),size=2.65*ZUNIT*cam.zoom;ctx.drawImage(art.whole,p.x-size*.5,p.y-size*.91,size,size);}
 else for(let i=0;i<3;i++){const p=local(7.2+(i%2)*1.15,5.95+Math.floor(i/2)*1.1,12.91),size=1.1*ZUNIT*cam.zoom;ctx.drawImage(art.pieces[i],p.x-size*.5,p.y-size*.7,size,size*.72);}
}
function drawPlayTable(o){
 if(document.hidden||!onScreen(o))return;
 for(const b of playTableModel(o)){
  if(b.foodNursery)drawPlayTableFood(o,true);
  isoBox(b.x,b.y,b.w,b.h,b.z,b.height,b.top,b.right,b.front);
  if(b.foodTray)drawPlayTableFood(o,false);
 }
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
 dialog.innerHTML='<header><div><small>เวลาอยู่ด้วยกัน</small><h2>โต๊ะเล่นกับทาก</h2></div><button class="tbtn" data-close>กลับหน้าร้าน</button></header><div class="playLayout"><div class="playScene"><canvas aria-label="พื้นที่เล่นกับทาก ใช้ที่คีบอาหารหรือลูบตัว" tabindex="0"></canvas><div class="playGreeting">เลือกทากมาเล่นด้วยกัน</div></div><aside class="playControls"><label>เพื่อนตัวน้อย<select aria-label="เลือกทาก"></select></label><div class="playSat"><span>ความอิ่ม</span><output>0 / 100</output><progress max="100" value="0"></progress></div><p class="playHelp">ลูบตัวน้องได้เลย หรือหยิบเศษฟองน้ำด้านขวามาป้อน</p><div class="playFoodShelf"><span>เศษฟองน้ำ · อิ่ม +3</span><canvas class="playFoodTray" aria-label="ลากเศษฟองน้ำไปให้น้อง"></canvas></div><div class="playAffection"><span>ความพอใจ</span><progress max="1" value="0"></progress></div><p class="playStatus" role="status"></p></aside></div>';
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
 const canvas=dialog.querySelector('.playScene canvas'),x=canvas.getContext('2d'),picker=dialog.querySelector('select'),output=dialog.querySelector('output'),satBar=dialog.querySelector('.playSat progress'),petBar=dialog.querySelector('.playAffection progress'),status=dialog.querySelector('.playStatus'),greeting=dialog.querySelector('.playGreeting');
 let table=null,slug=null,session=PlayTableLogic.create(),mode='feed',input={held:false,x:.5,y:.5},pointer=null,lastPoint=null,moved=0,options=[],raf=0,last=0,w=0,h=0,bg=null,sprites=null,animatedParts=null,spriteKey='',headOffset={x:-.3,y:.25},lastUI='',lastSave=0,nextCheck=0;
 const metrics={frames:0,spriteBuilds:0,backgroundBuilds:0};
 const sand=new Image(),foodImage=new Image(),crumbs=[];
 const tray=dialog.querySelector('.playFoodTray');
 style.textContent+='#playTableView .playFoodTray{height:130px;width:100%;cursor:grab;touch-action:none;background:transparent;border-radius:14px;margin-top:12px}#playTableView .playFoodShelf{font-size:12px;color:#e9c77d}#playTableView .playGreeting{color:#3f493e;text-shadow:0 1px 3px #fff}';
 sand.onload=()=>{bg=null;};sand.src='assets/sand.jpg';
 foodImage.onload=()=>{for(let i=0;i<3;i++){const c=document.createElement('canvas');c.width=c.height=96;const q=c.getContext('2d');q.beginPath();for(let j=0;j<24;j++){const a=j*Math.PI/12,r=34+(j%2?7:-5)+Math.sin(j*3+i)*5;const px=48+Math.cos(a)*r,py=48+Math.sin(a)*r;j?q.lineTo(px,py):q.moveTo(px,py);}q.closePath();q.clip();q.drawImage(foodImage,330+i*80,360+i*65,230,230,0,0,96,96);crumbs.push(c);}drawTray();bakeTool();};foodImage.src='assets/food/sponge.png';
 function drawTray(){tray.width=420;tray.height=260;const q=tray.getContext('2d');
  q.shadowColor='#0008';q.shadowBlur=16;q.shadowOffsetY=9;
  const rim=q.createLinearGradient(0,25,0,235);rim.addColorStop(0,'#faf5e8');rim.addColorStop(.4,'#c4c9bf');rim.addColorStop(1,'#727e79');
  q.fillStyle=rim;q.beginPath();q.roundRect(12,24,396,204,35);q.fill();q.shadowColor='transparent';
  q.strokeStyle='#f8ffed';q.lineWidth=3;q.stroke();
  const well=q.createLinearGradient(0,45,0,210);well.addColorStop(0,'#6d7c76');well.addColorStop(.18,'#a9b7aa');well.addColorStop(1,'#dce1ce');
  q.fillStyle=well;q.beginPath();q.roundRect(34,45,352,160,24);q.fill();q.strokeStyle='#66776e';q.lineWidth=2;q.stroke();
  q.strokeStyle='#fff8';q.beginPath();q.moveTo(54,210);q.lineTo(365,210);q.stroke();
  for(let i=0;i<crumbs.length;i++){q.save();q.translate(80+i*125,130+(i%2?-20:12));q.rotate(i*.65-.3);q.shadowColor='#2b392d80';q.shadowBlur=7;q.shadowOffsetY=5;q.drawImage(crumbs[i],-43,-43,86,86);q.restore();}
 }
 const tool=document.createElement('canvas');tool.width=240;tool.height=280;tool.setAttribute('aria-hidden','true');dialog.append(tool);
 tool.style.cssText='position:fixed;width:120px;height:140px;pointer-events:none;z-index:20;display:none;filter:drop-shadow(0 4px 3px #0009)';
 let cursorX=0,cursorY=0;
 function bakeTool(){const q=tool.getContext('2d');q.clearRect(0,0,240,280);q.save();q.scale(2,2);q.lineCap='round';q.lineJoin='round';
  const arms=()=>{q.beginPath();q.moveTo(88,16);q.quadraticCurveTo(76,42,26,113);q.moveTo(88,16);q.quadraticCurveTo(105,40,42,114);};
  arms();q.strokeStyle='#203c39';q.lineWidth=11;q.stroke();arms();q.strokeStyle='#f2e5ab';q.lineWidth=7;q.stroke();arms();q.strokeStyle='#fffbed';q.lineWidth=2;q.stroke();
  q.strokeStyle='#847748';q.lineWidth=2;for(let i=0;i<5;i++){q.beginPath();q.moveTo(76-i*3,42+i*5);q.lineTo(81-i*3,46+i*5);q.stroke();}
  if(crumbs.length)q.drawImage(crumbs[0],16,101,36,36);q.restore();
 }
 function updateTool(){const show=dialog.open&&mode==='feed'&&input.held&&slug&&slug.satiety<100;tool.style.display=show?'block':'none';if(show){tool.style.left=(cursorX-34)+'px';tool.style.top=(cursorY-119)+'px';}}


 function available(){
  const all=[...(G.inv||[]),...[...G.objs,...G.shelter].flatMap(o=>o.slugs||[])];
  return [...new Set(all)].filter(s=>!s.breedZone&&!G.objs.concat(G.shelter).some(o=>o.breeding?.parents?.includes(s))&&!TRADE_OFFERS.some(o=>o.slug===s));
 }
 function pickSlug(){slug=options[Number(picker.value)]||null;session=PlayTableLogic.create();input.held=false;pointer=null;spriteKey='';releaseSprites();lastUI='';status.textContent='';refresh();}
 function releaseSprites(){if(sprites)for(const c of Object.values(sprites)){c.width=0;c.height=0;}sprites=null;animatedParts=null;}
 function refresh(){
  const sat=Math.min(100,Math.max(0,slug?.satiety??0)),key=[slug?.id,Math.ceil(sat),Math.floor(session.pet*100),mode,session.happy>0].join('|');if(key===lastUI)return;lastUI=key;
  output.textContent=Math.round(sat)+' / 100';satBar.value=sat;petBar.value=session.pet;
  if(slug&&picker.selectedOptions[0])picker.selectedOptions[0].textContent=slug.id+' · อิ่ม '+Math.round(sat);
  greeting.textContent=slug?(session.happy>0?'ชอบที่สุดเลย!':sat>=100?'อิ่มแล้ว มาเล่นด้วยกันต่อสิ':slug.id):'เลือกทากมาเล่นด้วยกัน';
  dialog.querySelector('.playAffection').hidden=false;
  for(const b of dialog.querySelectorAll('[data-mode]'))b.classList.toggle('on',b.dataset.mode===mode);
 }
 function bakeSprites(){
  if(!slug)return;const genes=foodGenes(slug),resolution=Math.min(640,Math.max(360,Math.round(Math.min(w*.46,h*.56)*Math.min(2,devicePixelRatio||1)))),key=JSON.stringify(genes)+'|'+resolution;if(key===spriteKey&&sprites)return;
  releaseSprites();const parts=SlugEngine.slugParts(genes,resolution),bw=Math.ceil(parts.w+24),bh=Math.ceil(parts.h+24),old=SlugEngine.ANIM;
  animatedParts=parts;
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
  b.fillStyle='#e2d8c4';b.fillRect(0,0,w,h);
  if(sand.complete&&sand.naturalWidth){const pattern=b.createPattern(sand,'repeat');b.fillStyle=pattern;b.fillRect(0,0,w,h);}
  metrics.backgroundBuilds++;return bg;
 }
 function sponge(c,px,py,r){c.fillStyle='#d8a15b';c.beginPath();c.roundRect(px-r,py-r,r*2,r*1.65,r*.35);c.fill();c.fillStyle='#96613e';for(const [dx,dy]of [[-.4,-.3],[.35,-.45],[.05,.2]]){c.beginPath();c.arc(px+dx*r,py+dy*r,r*.15,0,7);c.fill();}}
 function dimensions(){if(!sprites)return {width:w*.4,height:h*.45};const c=sprites.normal,scale=Math.min(w*(w<500?.68:.46)/c.width,h*.56/c.height);return {width:c.width*scale,height:c.height*scale};}
 function hit(p){if(!slug||!sprites)return false;const d=dimensions();return Math.abs(p.x*w-session.x*w)<d.width*.42&&Math.abs(p.y*h-session.y*h)<d.height*.36;}
 function foodPoint(){const d=dimensions(),hy=headOffset.y*d.height/h,halfH=d.height/h*.5+.01;return {x:PlayTableLogic.clamp(input.x,.12,.88),y:PlayTableLogic.clamp(input.y,Math.max(.3,halfH+hy),Math.min(.78,1-halfH+hy))};}
 function draw(){
  x.clearRect(0,0,w,h);x.drawImage(background(),0,0,w,h);
  if(slug&&sprites){const d=dimensions(),happy=session.happy>0||(mode==='feed'&&input.held&&slug.satiety<100),c=happy?sprites.happy:sprites.normal;
   const envelope=session.happy>0?Math.sin(Math.PI*session.happy/2.5):0;
   const wiggle=Math.sin(session.age*18)*.045*envelope;
   x.save();x.translate(session.x*w,session.y*h);x.rotate(wiggle);
   // Reuse engine parts and their textures; animate only the selected visible slug.
   const oldAnim=SlugEngine.ANIM;SlugEngine.ANIM=true;
   try{SlugEngine.drawSlug(x,animatedParts,0,0,session.flip,0,d.width/sprites.normal.width,true,session.walking,{noBob:true,noEyes:happy,creepT:session.creep,startle:Math.sin(Math.PI*session.poke/.45)*.3,look:session.petTouch>0?.7:.15});}finally{SlugEngine.ANIM=oldAnim;}
   if(happy){const parts=animatedParts,scale=d.width/sprites.normal.width;x.save();x.scale((session.flip?-1:1)*parts.s*scale,parts.s*scale);x.translate(-(parts.L+parts.R)/2,-(parts.T+parts.B)/2);x.strokeStyle='#172326';x.lineWidth=Math.max(2,parts.bh*.018);x.lineCap='round';x.lineJoin='round';SlugEngine.FACE.eyes.forEach((e,i)=>{const ex=e.u*parts.bw,ey=e.v*parts.bh,r=e.hR*parts.bh*.42,side=i===0?-1:1;x.beginPath();x.moveTo(ex-side*r*.65,ey-r);x.lineTo(ex+side*r*.65,ey);x.lineTo(ex-side*r*.65,ey+r);x.stroke();});x.restore();}
   x.restore();
   if(session.happy>0){x.fillStyle='#f19eb3';x.font='28px sans-serif';x.textAlign='center';x.fillText('♥',session.x*w,session.y*h-d.height*.48-(2.5-session.happy)*15);x.fillText('♥',session.x*w+d.width*.15,session.y*h-d.height*.45-(2.5-session.happy)*20);}
  }
  updateTool();
  metrics.frames++;
 }
 function frame(now){raf=0;if(!dialog.open||document.hidden)return;const dt=Math.min(.1,(now-(last||now))/1000);last=now;
  if(now>=nextCheck){nextCheck=now+1000;if(slug&&!available().includes(slug)){slug=null;releaseSprites();status.textContent='ทากตัวนี้ไม่ว่างแล้ว กรุณาเลือกตัวอื่น';}if(slug)bakeSprites();}
  if(slug){if(!sprites)bakeSprites();const d=dimensions(),bite=PlayTableLogic.step(session,dt,{...foodPoint(),held:mode==='feed'&&input.held&&input.x>=0&&input.x<=1&&input.y>=0&&input.y<=1},slug.satiety,Math.abs(headOffset.x)*d.width/w,headOffset.y*d.height/h,d.width/w*.5+.01,d.height/h*.5+.01);
   if(bite){const before=slug.satiety;applyFood(slug,{type:'sponge',level:1,spec:{...FOOD_TYPES.sponge.levels[0],sat:3,cap:1},eaten:[]});if(slug.satiety>before){input.held=false;G.stats.fed=(G.stats.fed||0)+1;saveGame();status.textContent=slug.satiety>=100?'อิ่มเต็ม 100 แล้ว':'ง่ำ… อร่อยจัง';}}
  }
  refresh();draw();if(now-lastSave>5000){lastSave=now;if(slug)saveGame();}raf=requestAnimationFrame(frame);
 }
 function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};}
 function begin(e,kind){if(pointer!==null||!slug)return;e.preventDefault();mode=kind;pointer=e.pointerId;e.currentTarget.setPointerCapture(pointer);lastPoint=point(e);input={...lastPoint,held:true};moved=0;cursorX=e.clientX;cursorY=e.clientY;updateTool();}
 canvas.addEventListener('pointerdown',e=>{if(hit(point(e)))begin(e,'pet');});
 tray.addEventListener('pointerdown',e=>{if(slug&&slug.satiety<100&&crumbs.length)begin(e,'feed');});
 function move(e){if(pointer!==e.pointerId||!lastPoint)return;cursorX=e.clientX;cursorY=e.clientY;updateTool();const p=point(e);input.x=p.x;input.y=p.y;const distance=Math.hypot((p.x-lastPoint.x)*w,(p.y-lastPoint.y)*h);moved+=distance;
 if(mode==='pet'&&input.held&&hit(p)&&hit(lastPoint)&&PlayTableLogic.stroke(session,distance)){status.textContent='น้องพอใจแล้ว!';if(typeof playNotificationSound==='function')playNotificationSound('success');}lastPoint=p;}
 function release(e){if(e&&pointer!==e.pointerId)return;if(mode==='pet'&&input.held&&moved<8&&lastPoint&&hit(lastPoint)){PlayTableLogic.poke(session);status.textContent='จิ้มเบา ๆ…';}input.held=false;pointer=null;lastPoint=null;updateTool();}
 for(const surface of [canvas,tray]){surface.addEventListener('pointermove',move);surface.addEventListener('pointerup',release);for(const event of ['pointercancel','lostpointercapture'])surface.addEventListener(event,()=>{input.held=false;pointer=null;lastPoint=null;updateTool();});}
 picker.onchange=pickSlug;
 function close(){if(!dialog.open)return;input.held=false;pointer=null;cancelAnimationFrame(raf);raf=0;updateTool();saveGame();dialog.close();table=null;slug=null;releaseSprites();bg=null;document.body.classList.remove('playing-slug');last=0;cv.focus();}
 dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 new ResizeObserver(()=>resizeScene()).observe(canvas);
 document.addEventListener('visibilitychange',()=>{input.held=false;pointer=null;updateTool();if(document.hidden){cancelAnimationFrame(raf);raf=0;if(dialog.open)saveGame();}else if(dialog.open){last=0;resizeScene();raf=requestAnimationFrame(frame);}});
 window.addEventListener('blur',()=>{input.held=false;pointer=null;updateTool();});window.addEventListener('pagehide',()=>{if(dialog.open)saveGame();});
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
