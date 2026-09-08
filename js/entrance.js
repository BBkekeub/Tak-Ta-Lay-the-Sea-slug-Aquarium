function inDoorWalkway(x,y){
 const r=entranceRect();if(!r)return false;
 const margin=PERSON_R;
 return x>r.cx-margin&&x<r.cx+r.w+margin&&y>r.cy-margin&&y<r.cy+r.h+margin;
}
/* One grid-aligned, two-large-cell entrance, saved independently of furniture. */
function entranceRect(d=G.door){
  if(!d||!['north','west'].includes(d.side)||!Number.isInteger(d.offset))return null;
  const horizontal=d.side==='north'||d.side==='south',length=2*SUB;
  const edge=horizontal?cellsW():cellsH();if(d.offset<0||d.offset+length>edge)return null;
  return {cx:horizontal?d.offset:d.side==='west'?0:cellsW()-length,cy:horizontal?(d.side==='north'?0:cellsH()-length):d.offset,w:length,h:length};
}
function rectHits(a,b){return a.cx<b.cx+b.w&&a.cx+a.w>b.cx&&a.cy<b.cy+b.h&&a.cy+a.h>b.cy;}
function entranceClear(objects=G.objs,d=G.door){const r=entranceRect(d);return !!r&&floorRect(r.cx,r.cy,r.w,r.h)&&!objects.some(o=>rectHits(r,{cx:o.cx,cy:o.cy,w:oW(o),h:oH(o)}));}
function chosenDoorSpot(){
  if(!entranceClear())return null;
  const r=entranceRect(),e=PERSON_EDGE+1,v=PERSON_R+Math.random()*(2*SUB-2*PERSON_R);
  const s=G.door.side;return{x:s==='west'?e:s==='east'?cellsW()-e:r.cx+v,y:s==='north'?e:s==='south'?cellsH()-e:r.cy+v};
}
// Free intervals along each tank side; obstacles and shop boundaries count as walls.
function tankSideGaps(t,objects,side,depth){
  const x=t.cx,y=t.cy,w=oW(t),h=oH(t),vertical=side<2;
  const strip=side===0?{cx:x-depth,cy:y,w:depth,h}:side===1?{cx:x+w,cy:y,w:depth,h}:side===2?{cx:x,cy:y-depth,w,h:depth}:{cx:x,cy:y+h,w,h:depth};
  if(strip.cx<0||strip.cy<0||strip.cx+strip.w>cellsW()||strip.cy+strip.h>cellsH())return [];
  const start=vertical?y:x,end=start+(vertical?h:w),blocked=[];
  if(G.floorTiles)for(let by=Math.floor(strip.cy/SUB);by<Math.ceil((strip.cy+strip.h)/SUB);by++)for(let bx=Math.floor(strip.cx/SUB);bx<Math.ceil((strip.cx+strip.w)/SUB);bx++)if(!ownsTile(bx,by))blocked.push([Math.max(start,(vertical?by:bx)*SUB),Math.min(end,((vertical?by:bx)+1)*SUB)]);
  for(const o of objects){if(o===t)continue;const r={cx:o.cx,cy:o.cy,w:oW(o),h:oH(o)};
    if(rectHits(strip,r))blocked.push([Math.max(start,vertical?r.cy:r.cx),Math.min(end,vertical?r.cy+r.h:r.cx+r.w)]);
  }
  blocked.sort((a,b)=>a[0]-b[0]);let at=start;const gaps=[];
  const required=SUB; // A continuous 50 cm opening, not the entire side.
  for(const [a,b] of blocked){if(a-at>=required)gaps.push([at,a]);at=Math.max(at,b);}
  if(end-at>=required)gaps.push([at,end]);return gaps;
}
function tankSideOpen(t,objects,side,depth){return tankSideGaps(t,objects,side,depth).length>0;}
function accessibleTankSpots(t){
  const out=[];
  for(let side=0;side<4;side++)for(const [a,b] of tankSideGaps(t,G.objs,side,2*SUB)){
    for(const g of [3.5])for(let along=a+SUB/2;along<=b-SUB/2;along+=SUB/2){
      const p=side===0?{x:t.cx-g,y:along}:side===1?{x:t.cx+oW(t)+g,y:along}:side===2?{x:along,y:t.cy-g}:{x:along,y:t.cy+oH(t)+g};
      if(!inDoorWalkway(p.x,p.y)&&!personBlocked(p.x,p.y))out.push(p);
    }
  }return out;
}
function tankAccessIssue(objects){
  for(const t of objects.filter(o=>o.type==='tank')){
    if(![0,1,2,3].some(s=>tankSideOpen(t,objects,s,2*SUB)))return 'ต้องเหลือหน้าตู้ช่วงว่างติดกัน 50 ซม. และเว้นทางจากช่วงนั้นลึก 2 ช่องใหญ่ (100 ซม.)';
  }
  return '';
}
function layoutAllowsPlacement(cx,cy,def,ignore,rot){
  const candidate={cx,cy,def,rot,type:def.kind},objects=G.objs.filter(o=>o!==ignore).concat(candidate);
  if(G.door&&!entranceClear(objects))return false;
  return !tankAccessIssue(objects);
}
function shopOpeningIssue(){
  if(!G.door)return 'ต้องวางประตูก่อนเปิดร้าน';
  if(!entranceClear())return 'ทางเข้าประตูถูกบัง ต้องเว้นพื้นที่หน้าประตู 2×2 ช่องใหญ่';
  const issue=tankAccessIssue(G.objs);if(issue)return issue;
  const from=chosenDoorSpot();
  for(const t of G.objs.filter(o=>o.type==='tank')){
    const spots=accessibleTankSpots(t);
    if(!spots.some(s=>!personBlocked(s.x,s.y)&&personRoute(from,s).length))return 'มีตู้ที่เดินจากประตูไปไม่ถึง กรุณาเปิดทางเดิน';
  }
  return '';
}
let placingWallDoor=false,wallDoorHover=null,wallDoorDown=null;
registerMode('doorPlace','floor',()=>placingWallDoor,()=>{placingWallDoor=false;wallDoorHover=null;wallDoorDown=null;});
function placeEntrance(){
  if(peopleOn){toast('ปิดร้านก่อนย้ายประตู','bad');return;}
  setMode('build');enterExclusiveMode('doorPlace');placingWallDoor=true;wallDoorHover=null;   // วางประตู = เลิกถือของ/เลิกเลือกช่องขยาย
  toast('คลิกกำแพงเพื่อวางประตู 1×2 เมตร · ใช้ 2 คอลัมน์ · Esc ยกเลิก');
}
function removeEntrance(){if(peopleOn){toast('ปิดร้านก่อนเก็บประตู','bad');return;}G.door=null;saveGame();syncPeopleBtn();finishConstruction();}
function wallPoint(side,u,z){return side==='north'?P(u,0,z):P(0,u,z);}
function wallDoorHit(sx,sy){
  for(const side of ['north','west']){
    const length=side==='north'?cellsW():cellsH(),a=wallPoint(side,0,0),b=wallPoint(side,length,0);
    const f=(sx-a.x)/(b.x-a.x);if(f<0||f>=1)continue;
    const ground=a.y+(b.y-a.y)*f,z=(ground-sy)/cam.zoom;
    if(z<0||z>ROOM_H)continue;
    const column=Math.floor(f*length/SUB),offset=column*SUB;
    return{side,offset,column,valid:offset+2*SUB<=length};
  }return null;
}
function wallQuad(side,u,width,z,height,fill,stroke){
  const q=[wallPoint(side,u,z),wallPoint(side,u+width,z),wallPoint(side,u+width,z+height),wallPoint(side,u,z+height)];
  ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
}
let doorSwing=0,doorSwingTime=0;
function stepDoorSwing(){
  const now=performance.now(),dt=Math.min(.05,(now-(doorSwingTime||now))/1000);doorSwingTime=now;
  const r=entranceRect();
  const near=r&&peopleOn&&PEOPLE.some(p=>p.x>r.cx-3&&p.x<r.cx+r.w+3&&p.y>r.cy-3&&p.y<r.cy+r.h+3);
  const target=near?1:0;doorSwing+=(target-doorSwing)*(1-Math.exp(-dt*(near?9:3)));
}
function drawDoorLeaf(d,preview=false){
  const {side,offset}=d,width=2*SUB,height=40*ZUNIT,angle=preview?0:doorSwing*Math.PI*.46;
  const hinge=offset+.8,leafWidth=width-1.6;
  // North swings toward negative Y; west swings toward negative X: both outside.
  const project=(u,z,depth=0)=>{
    const along=hinge+u*Math.cos(angle),outward=-u*Math.sin(angle)+depth;
    return side==='north'?P(along,outward,z):P(outward,along,z);
  };
  const face=(pts,fill,stroke)=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}};
  const panel=(u,v,w,h,color,stroke)=>face([project(u,v),project(u+w,v),project(u+w,v+h),project(u,v+h)],color,stroke);
  ctx.save();ctx.globalAlpha=preview?.72:1;ctx.lineWidth=Math.max(.65,cam.zoom*1.5);
  // Recess, three-dimensional jambs, and a stone threshold remain fixed to the wall.
  wallQuad(side,offset,width,0,height,'#111d20','#b6a589');
  wallQuad(side,offset,.8,0,height,'#b59a70','#e0c79c');
  wallQuad(side,offset+width-.8,.8,0,height,'#66503b','#b69a72');
  wallQuad(side,offset,width,height-1.1*ZUNIT,1.1*ZUNIT,'#a38862','#d8bc8d');
  wallQuad(side,offset,width,0,.6*ZUNIT,'#8a8273','#c5bcaa');
  // Outside leaf sections are hidden by solid masonry; only the opening and
  // portions beyond the wall silhouette remain visible from inside the shop.
  ctx.save();ctx.beginPath();ctx.rect(-CW,-CH,CW*3,CH*3);
  const cut=q=>{q.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();};
  cut([P(0,0,0),P(cellsW(),0,0),P(cellsW(),0,ROOM_H),P(0,0,ROOM_H)]);
  cut([P(0,0,0),P(0,cellsH(),0),P(0,cellsH(),ROOM_H),P(0,0,ROOM_H)]);
  cut([wallPoint(side,offset,0),wallPoint(side,offset+width,0),wallPoint(side,offset+width,height),wallPoint(side,offset,height)]);
  ctx.clip('evenodd');
  panel(0,.65*ZUNIT,leafWidth,38.1*ZUNIT,'#70472d','#b08755');
  // The leaf has a 4 cm thick edge, visible as it swings outwards.
  face([project(leafWidth,.65*ZUNIT),project(leafWidth,38.75*ZUNIT),project(leafWidth,38.75*ZUNIT,-.8),project(leafWidth,.65*ZUNIT,-.8)],'#3b281d','#9b784b');
  for(let i=1;i<18;i++){
    const u=i*leafWidth/18;const a=project(u,ZUNIT),b=project(u,38*ZUNIT);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=i%3?'rgba(218,162,96,.12)':'rgba(24,15,9,.20)';ctx.stroke();
  }
  panel(1.2,3*ZUNIT,leafWidth-2.4,12.5*ZUNIT,'#493322','#ba8a53');
  panel(1.8,3.7*ZUNIT,leafWidth-3.6,11*ZUNIT,'#68492f','#805b38');
  panel(1.2,19*ZUNIT,leafWidth-2.4,16.5*ZUNIT,'#b49b76','#d4bc93');
  panel(1.7,19.6*ZUNIT,leafWidth-3.4,15.3*ZUNIT,'#244049','#17282f');
  panel(2.1,20*ZUNIT,.55,14.5*ZUNIT,'rgba(213,238,230,.25)');
  face([project(3,20*ZUNIT),project(5,20*ZUNIT),project(leafWidth-2.3,34.5*ZUNIT),project(leafWidth-4.3,34.5*ZUNIT)],'rgba(205,234,225,.09)');
  panel(leafWidth-2.8,15.8*ZUNIT,1,3*ZUNIT,'#a8936d','#e2c899');
  const handleA=project(leafWidth-2.3,17.2*ZUNIT,.4),handleB=project(leafWidth-5,17.2*ZUNIT,.4);
  ctx.strokeStyle='#e4d4ac';ctx.lineWidth=Math.max(1.5,cam.zoom*5);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(handleA.x,handleA.y);ctx.lineTo(handleB.x,handleB.y);ctx.stroke();
  for(const z of [8,31])panel(.05,z*ZUNIT,.6,1.9*ZUNIT,'#b8a689','#302b24');
  ctx.restore();
  ctx.restore();
}

function drawEntrance(){stepDoorSwing();if(entranceRect())drawDoorLeaf(G.door);}
function drawWallDoorGrid(){
  if(!placingWallDoor)return;
  if(appMode!=='build'||peopleOn){placingWallDoor=false;return;}
  ctx.save();ctx.lineWidth=1;ctx.setLineDash([4,4]);
  for(const side of ['north','west']){
    const length=side==='north'?cellsW():cellsH();
    for(let u=0;u<length;u+=SUB)wallQuad(side,u,SUB,0,ROOM_H,'rgba(201,183,131,.025)','rgba(239,220,162,.45)');
  }
  ctx.setLineDash([]);
  if(wallDoorHover){const d=wallDoorHover,ok=d.valid&&entranceClear(G.objs,d);const length=d.side==='north'?cellsW():cellsH();
    wallQuad(d.side,d.offset,Math.min(2*SUB,length-d.offset),0,ROOM_H,ok?'rgba(103,212,163,.22)':'rgba(242,97,87,.28)',ok?'#93dfb3':'#f37a70');
    if(d.valid)drawDoorLeaf(d,true);
  }ctx.restore();
}
cv.addEventListener('pointermove',e=>{if(placingWallDoor){const {sx,sy}=screenXY(e);wallDoorHover=wallDoorHit(sx,sy);}},true);
cv.addEventListener('pointerleave',()=>{wallDoorHover=null;});
cv.addEventListener('pointerdown',e=>{if(placingWallDoor){wallDoorDown={x:e.clientX,y:e.clientY};}},true);
cv.addEventListener('pointerup',e=>{
  if(!placingWallDoor)return;
  const moved=!wallDoorDown||Math.hypot(e.clientX-wallDoorDown.x,e.clientY-wallDoorDown.y)>5;wallDoorDown=null;
  if(moved)return;
  e.stopImmediatePropagation();dragging=false;grab=null;cv.classList.remove('panning');
  const {sx,sy}=screenXY(e),d=wallDoorHit(sx,sy);
  if(!d||!d.valid){toast('เลือกกำแพงที่มีที่ว่างติดกัน 2 คอลัมน์','bad');return;}
  if(!entranceClear(G.objs,d)){toast('มีของบังหน้าประตู ต้องเว้นทางเข้า 2×2 ช่องใหญ่','bad');return;}
  G.door={side:d.side,offset:d.offset};placingWallDoor=false;wallDoorHover=null;saveGame();syncPeopleBtn();toast('วางประตู 1×2 เมตรแล้ว','good');finishConstruction();
},true);
window.addEventListener('keydown',e=>{if(e.key==='Escape'){placingWallDoor=false;wallDoorHover=null;}});
