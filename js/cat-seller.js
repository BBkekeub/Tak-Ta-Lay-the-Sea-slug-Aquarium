function counterLocal(def,rot,x,y){switch(rot&3){case 1:return[def.h-y,x];case 2:return[def.w-x,def.h-y];case 3:return[y,def.w-x];default:return[x,y];}}
function counterBlock(o,x,y,w,h){const pts=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(p=>counterLocal(o.def,o.rot,...p));const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return {x:o.cx+Math.min(...xs),y:o.cy+Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};}
function drawCounterWoodBlock(b){const z=14*ZUNIT,base=.6*ZUNIT;isoBox(b.x,b.y,b.w,b.h,0,z-base,'#8d7150','#574430','#705739');
 for(const f of [{a:[b.x+b.w,b.y],b:[b.x+b.w,b.y+b.h],shade:'rgba(0,0,0,.25)'},{a:[b.x+b.w,b.y+b.h],b:[b.x,b.y+b.h],shade:'rgba(12,8,4,.08)'}]){const pat=facePatShop('wood',SHOP_WOOD_CM,f.a,f.b,z-base);if(!pat)continue;const q=[P(...f.a,z-base),P(...f.b,z-base),P(...f.b,0),P(...f.a,0)];ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=pat;ctx.fill();ctx.fillStyle=f.shade;ctx.fill();}
 isoBox(b.x,b.y,b.w,b.h,z-base,base,'#453f35','#29251f','#575043');const q=[P(b.x,b.y,z),P(b.x+b.w,b.y,z),P(b.x+b.w,b.y+b.h,z),P(b.x,b.y+b.h,z)];ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();const pat=planePat('granite',50,P(0,0,z).x,P(0,0,z).y);if(pat){ctx.fillStyle=pat;ctx.fill();}
}
drawTradeCounter=function(o){
 const blocks=[counterBlock(o,0,10,20,10),counterBlock(o,10,0,10,10)],m=counterLocal(o.def,o.rot,5,5);
 const items=blocks.map(b=>({depth:b.x+b.y+(b.w+b.h)/2,draw:()=>drawCounterWoodBlock(b)}));items.sort((a,b)=>a.depth-b.depth).forEach(i=>i.draw());
 const q=counterLocal(o.def,o.rot,15,15),p=P(o.cx+q[0],o.cy+q[1],14*ZUNIT);ctx.save();ctx.fillStyle='#d0ad60';ctx.beginPath();ctx.ellipse(p.x,p.y,13*cam.zoom,7*cam.zoom,0,0,Math.PI*2);ctx.fill();ctx.restore();
};
// Upgrade the old 2x1 counter without overlapping neighbouring furniture.
for(const o of [...G.objs].filter(o=>o._key==='counter')){if(canPlace(o.cx,o.cy,o.def,o,o.rot))continue;const spots=[];for(let y=0;y<G.bh*SUB;y+=SUB)for(let x=0;x<G.bw*SUB;x+=SUB)spots.push({x,y,d:(x-o.cx)**2+(y-o.cy)**2});spots.sort((a,b)=>a.d-b.d);const spot=spots.find(p=>canPlace(p.x,p.y,o.def,o,o.rot));if(spot){o.cx=spot.x;o.cy=spot.y;}else{G.objs.splice(G.objs.indexOf(o),1);G.shelter.push(o);toast('เคาน์เตอร์ใหม่ต้องใช้ 2×2 ช่อง เก็บไว้ในคลังของแล้ว','good');}}

const catModelCache=new WeakMap();
function catModel(o){
 const key=[o.cx,o.cy,o.rot].join(),cached=catModelCache.get(o);if(cached?.key===key)return cached.faces;
 const faces=[],origin=counterLocal(o.def,o.rot,5,5),forward=counterLocal(o.def,o.rot,5,6),fx=forward[0]-origin[0],fy=forward[1]-origin[1];
 const world=v=>[o.cx+origin[0]+fy*v[0]+fx*v[1],o.cy+origin[1]-fx*v[0]+fy*v[1],v[2]];
 function face(v,color){v=v.map(world);const a=v[0],u=v[1].map((n,i)=>n-a[i]),w=v[2].map((n,i)=>n-a[i]),n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],l=Math.hypot(...n)||1,light=(-n[0]*.28+n[1]*.36+n[2]*.75)/l;faces.push({v,rgb:shadeRgb(hexToRgb(color),light*28-8)});}
 function oval(cx,cy,cz,rx,ry,rz,color,segments=18,rings=12){const p=(j,i)=>{const lat=-Math.PI/2+j*Math.PI/rings,a=i*2*Math.PI/segments;return[cx+rx*Math.cos(lat)*Math.cos(a),cy+ry*Math.cos(lat)*Math.sin(a),cz+rz*Math.sin(lat)];};for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=p(j,i),b=p(j,i+1),c=p(j+1,i+1),d=p(j+1,i);if(j===0)face([a,c,d],color);else if(j===rings-1)face([a,b,c],color);else face([a,b,c,d],color);}}
 const fur='#d2bea0',cream='#e7d8ba',dark='#99866c',teal='#365f5c';
 for(const side of [-1,1]){oval(side*1.8,0,3,1.6,1.65,3,fur);oval(side*1.8,.9,1,1.8,2.25,1, dark);}
 oval(0,0,11.4,4.15,3.2,7.6,fur);oval(0,2.65,11.7,3.15,.7,5.7,cream);
 oval(0,3.05,11.3,2.95,.43,4.7,teal);oval(0,3.45,10.5,1.45,.13,1.25,'#244742');
 for(const side of [-1,1]){oval(side*4.05,.4,13,1.35,1.5,4.5,fur);oval(side*4.2,1.25,9.5,1.55,1.4,1.6,cream);for(let i=0;i<3;i++)oval(side*4.2+(i-1)*.45,2.45,9.6,.16,.12,.35,dark,8,6);}
 oval(0,0,22.8,4.05,3.3,4.55,fur);
 // Thick padded opening surrounds the human face instead of a flat face decal.
 const hood=(i,j)=>{const a=i*Math.PI*2/36,b=j*Math.PI*2/10;return[(2.8+.45*Math.cos(b))*Math.cos(a),2.8+.6*Math.sin(b),22+(3.3+.45*Math.cos(b))*Math.sin(a)];};for(let i=0;i<36;i++)for(let j=0;j<10;j++)face([hood(i,j),hood(i+1,j),hood(i+1,j+1),hood(i,j+1)],cream);
 oval(0,3.02,22,2.35,.68,2.85,'#d6ae88');oval(0,3.25,24.05,2.2,.55,.95,'#493a2d');
 for(const side of [-1,1]){oval(side*.87,3.73,22.3,.17,.12,.25,'#352e26',10,8);oval(side*1.52,3.61,21.4,.38,.12,.19,'#bc8c75');}
 oval(0,3.85,21.65,.23,.21,.35,'#c09370');for(let i=0;i<7;i++){const t=(i-3)/3;oval(t*.55,3.7,20.75+t*t*.2,.13,.1,.07,'#845d4b',8,6);}
 for(const side of [-1,1]){
  const x=side*2.75;face([[x-1.05,-.6,25.2],[x+1.05,-.6,25.2],[x+side*.55,-.2,29.35]],fur);face([[x+1.05,-.6,25.2],[x+side*.55,-.2,29.35],[x,.95,25.3]],cream);face([[x,.95,25.3],[x+side*.55,-.2,29.35],[x-1.05,-.6,25.2]],fur);face([[x-.45,.5,26],[x+.45,.5,26],[x+side*.42,.12,28.4]],'#b18a7c');
  oval(side*1.55,2.3,26,.23,.15,.3,'#655844');
 }
 oval(0,2.85,25.6,.38,.2,.2,'#ac8778');oval(0,3.2,18.3,.45,.28,.45,'#b79c58');
 for(const side of [-1,1])oval(side*.65,3.0,18.3,.65,.25,.4,teal);
 const result={key,faces};catModelCache.set(o,result);return faces;
}
// Furniture depth masks use the real L, including its empty seller corner.
personFurnitureFaces=function(props=true){
 const out=[];
 const boxTo=(bx,by,bw,bh,top)=>{ if(!(top>0))return;
  const a=[bx,by,0],b=[bx+bw,by,0],c=[bx+bw,by+bh,0],d=[bx,by+bh,0];
  const A=[bx,by,top],B=[bx+bw,by,top],C=[bx+bw,by+bh,top],D=[bx,by+bh,top];
  out.push([A,B,C,D],[a,b,B,A],[b,c,C,B],[c,d,D,C],[d,a,A,D]);
 };
 for(const o of G.objs){
  if(o===moving)continue;
  if(o._key==='counter'){
   const top=decoH(o)/ZUNIT; // ผิวเคาน์เตอร์ (ราว 14)
   for(const q of [counterBlock(o,0,10,20,10),counterBlock(o,10,0,10,10)]) boxTo(q.x,q.y,q.w,q.h,top);
   // แมวแคชเชียร์นั่งมุมว่างของตัว L — เพิ่มกล่องบังสูงถึงหัวแมว ให้บังลูกค้าที่ยืนด้านหลัง
   if(props){ const cat=counterBlock(o,1,1,8,8); boxTo(cat.x,cat.y,cat.w,cat.h,22); }
   continue;
  }
  const top=(o.type==='tank'?tankStandH(o.def):decoH(o))/ZUNIT;
  if(!(top>0))continue;
  boxTo(o.cx,o.cy,oW(o),oH(o),top);
 }
 return out;};

const catSpriteCache=new WeakMap();
// The image includes furniture/glass occlusion, so layout changes invalidate it.
// Camera pan/zoom, time, visitors and slug movement do not change the image.
function catSceneKey(){return G.objs.filter(o=>o!==moving).map(o=>[o.id,o.cx,o.cy,o.rot,oW(o),oH(o),o.type==='tank'?tankStandH(o.def):decoH(o),o.type==='tank'?tankGlassH(o.def):0].join(',')).join(';');}
function drawCatSeller(o){
 if(document.hidden||(typeof tankMode!=='undefined'&&tankMode)||!onScreen(o))return;
 const a=counterLocal(o.def,o.rot,5,5),p={x:o.cx+a[0],y:o.cy+a[1]},key=[o.cx,o.cy,o.rot,catSceneKey()].join('|');
 let cached=catSpriteCache.get(o);
 if(!cached||cached.key!==key){
  const batch=_personBatch,bounds=_personBounds;
  try{_personBatch=null;_personBounds=null;cached={key,...paintPersonMesh(catModel(o),p,30,true)};catSpriteCache.set(o,cached);}
  finally{_personBatch=batch;_personBounds=bounds;}
 }
 if(cached.image){const at=P(p.x,p.y,0),z=cam.zoom;ctx.drawImage(cached.image,at.x+cached.x*z,at.y+cached.y*z,cached.w*z,cached.h*z);}
}

const sellerSigns=new Map();
function sellerSign(text){if(sellerSigns.has(text))return sellerSigns.get(text);const c=document.createElement('canvas');c.width=512;c.height=160;const x=c.getContext('2d');x.fillStyle='#163538';x.fillRect(0,0,512,160);x.strokeStyle='#c2a369';x.lineWidth=8;x.strokeRect(6,6,500,148);x.font='600 68px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillStyle='#f1dbab';x.fillText(text,256,81);sellerSigns.set(text,c);return c;}
function counterSign(o,text,x,y,w,z,h){const project=(x,y,z)=>{const q=counterLocal(o.def,o.rot,x,y);return P(o.cx+q[0],o.cy+q[1],z*ZUNIT);},a=project(x,y,z+h),b=project(x+w,y,z+h),d=project(x,y,z),im=sellerSign(text);ctx.save();ctx.transform((b.x-a.x)/im.width,(b.y-a.y)/im.width,(d.x-a.x)/im.height,(d.y-a.y)/im.height,a.x,a.y);ctx.drawImage(im,0,0);ctx.restore();}
const drawCounterBase=drawTradeCounter;
drawTradeCounter=function(o){if(document.hidden||(typeof tankMode!=='undefined'&&tankMode)||!onScreen(o))return;drawCounterBase(o);
 // Outline only the outside perimeter; no line across the joined worktop.
 const poly=[[0,10],[10,10],[10,0],[20,0],[20,20],[0,20]].map(p=>{const q=counterLocal(o.def,o.rot,...p);return P(o.cx+q[0],o.cy+q[1],14*ZUNIT);});ctx.save();ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.strokeStyle='rgba(206,190,155,.4)';ctx.lineWidth=Math.max(.5,cam.zoom);ctx.stroke();ctx.restore();

 const props=[{x:5,y:5,draw:()=>drawCatSeller(o)},{x:5,y:14,draw:()=>drawCashRegister(o)},{x:11.5,y:14.5,draw:()=>drawCounterPromo(o)},{x:15,y:4.5,draw:()=>drawCounterComputer(o)},{x:12,y:8,draw:()=>{if(typeof drawGiftBoxProp==='function')drawGiftBoxProp(o);}}];
 props.sort((a,b)=>{const p=counterLocal(o.def,o.rot,a.x,a.y),q=counterLocal(o.def,o.rot,b.x,b.y);return p[0]+p[1]-q[0]-q[1];}).forEach(p=>p.draw());
};

function counterPlane(o,image,a,b,d){const pt=v=>{const q=counterLocal(o.def,o.rot,v[0],v[1]);return P(o.cx+q[0],o.cy+q[1],v[2]*ZUNIT);},p=pt(a),q=pt(b),r=pt(d);ctx.save();ctx.transform((q.x-p.x)/image.width,(q.y-p.y)/image.width,(r.x-p.x)/image.height,(r.y-p.y)/image.height,p.x,p.y);ctx.drawImage(image,0,0);ctx.restore();}
let cashRegisterTexture=null;
function drawCashRegister(o){
 if(!cashRegisterTexture){const c=document.createElement('canvas');c.width=400;c.height=300;const x=c.getContext('2d');x.fillStyle='#53615f';x.fillRect(0,0,400,300);x.fillStyle='#101e22';x.fillRect(24,15,238,64);x.fillStyle='#8eccb0';x.font='44px monospace';x.textAlign='right';x.fillText('0.00',247,63);
 for(let row=0;row<4;row++)for(let col=0;col<4;col++){x.fillStyle=col===3?'#b2985c':'#d2d1bf';x.fillRect(30+col*54,97+row*44,44,33);x.fillStyle='#354341';x.font='22px sans-serif';x.textAlign='center';x.fillText(col===3?['+','−','×','='][row]:['7','8','9','4','5','6','1','2','3','0','.','C'][row*3+col],52+col*54,122+row*44);}
 x.fillStyle='#172123';x.fillRect(288,67,88,15);x.fillStyle='#f3edda';x.fillRect(298,0,69,70);x.fillStyle='#89908a';for(let i=0;i<5;i++)x.fillRect(305,10+i*10,48,2);cashRegisterTexture=c;}
 const b=counterBlock(o,2.5,12,5,4);isoBox(b.x,b.y,b.w,b.h,14*ZUNIT,1.2*ZUNIT,'#697370','#242f31','#394345');
 const project=v=>{const q=counterLocal(o.def,o.rot,v[0],v[1]);return P(o.cx+q[0],o.cy+q[1],v[2]*ZUNIT);};
 const sides=[[[2.5,12,15.2],[2.5,16,17],[2.5,16,15.2]],[[7.5,12,15.2],[7.5,16,15.2],[7.5,16,17]],[[2.5,16,15.2],[2.5,16,17],[7.5,16,17],[7.5,16,15.2]]];
 for(const face of sides){ctx.beginPath();face.map(project).forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.fillStyle='#394345';ctx.fill();}
 counterPlane(o,cashRegisterTexture,[7.5,16,17],[2.5,16,17],[7.5,12,15.2]);
 const drawer=counterBlock(o,2.8,11.82,4.4,.18);isoBox(drawer.x,drawer.y,drawer.w,drawer.h,14.35*ZUNIT,.3*ZUNIT,'#8c9590','#1d2527','#adb0a6');
}
function showcaseSlugs(){return [...G.inv,...G.objs.filter(o=>o.type==='tank').flatMap(o=>o.slugs)];}
function showcaseDecorPosition(key){const b=decorRequiredBounds(key,0,0,0);if(!b||b.right-b.left>4.8||b.bottom-b.top>4.8)return null;return {x:2.5-(b.left+b.right)/2,y:2.5-(b.top+b.bottom)/2};}
function drawCounterShowcase(o){const tray=counterBlock(o,9,12,5,5);isoBox(tray.x,tray.y,tray.w,tray.h,14*ZUNIT,.4*ZUNIT,'#cec5ab','#777361','#96907c');
 const selected=o.showcase||{},def=TANK_DECOR[selected.decorKey],pos=def&&showcaseDecorPosition(selected.decorKey);
 if(pos){const im=decorImg(selected.decorKey),q=counterLocal(o.def,o.rot,9+pos.x,12+pos.y),p=P(o.cx+q[0],o.cy+q[1],14.5*ZUNIT),w=def.wCm/CM_PER_CELL*TW*cam.zoom;if(im.ok){const h=w*im.img.naturalHeight/im.img.naturalWidth,a=def.anchor||{x:.5,y:.9};ctx.drawImage(im.img,p.x-w*a.x,p.y-h*a.y,w,h);}}
 const sample=showcaseSlugs().find(s=>s.id===selected.slugId);if(sample){const sp=slugSprite(sample),q=counterLocal(o.def,o.rot,11.5,15.2),p=P(o.cx+q[0],o.cy+q[1],15*ZUNIT),w=3.2*TW*cam.zoom,h=w*sp.c.height/sp.c.width;ctx.drawImage(sp.c,p.x-w/2,p.y-h/2,w,h);}
 isoBox(tray.x,tray.y,tray.w,tray.h,14.4*ZUNIT,4*ZUNIT,'#aacdd0','#76a4ae','#8bbac0',.18);
 const pts=[P(tray.x,tray.y,18.4*ZUNIT),P(tray.x+tray.w,tray.y,18.4*ZUNIT),P(tray.x+tray.w,tray.y+tray.h,14.4*ZUNIT),P(tray.x,tray.y+tray.h,14.4*ZUNIT)];o._showcaseHit={x:Math.min(...pts.map(p=>p.x))-8,y:Math.min(...pts.map(p=>p.y))-8,right:Math.max(...pts.map(p=>p.x))+8,bottom:Math.max(...pts.map(p=>p.y))+8};
}
const showcaseDialog=document.createElement('dialog');showcaseDialog.id='counterShowcase';showcaseDialog.style.cssText='width:min(720px,90vw);max-height:85vh;padding:20px;background:#172b2e;color:#e5dcc4;border:1px solid #b59859;border-radius:14px;color-scheme:dark';document.body.append(showcaseDialog);let showcaseCounter=null;
function openCounterShowcase(o){showcaseCounter=o;renderCounterShowcase();if(!showcaseDialog.open)showcaseDialog.showModal();}
function renderCounterShowcase(){const o=showcaseCounter,chosen=o.showcase||{};
 showcaseDialog.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><b>ตู้โชว์บนเคาน์เตอร์</b><button class="tbtn" data-close>✕</button></div><p>เลือกทากที่จะแสดง</p><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;max-height:38vh;overflow:auto">'+showcaseSlugs().map(s=>'<button class="tbtn" data-slug="'+s.id+'" style="border-color:'+(s.id===chosen.slugId?'#e2bb61':'#506363')+'"><canvas width="180" height="132" style="width:100%;height:auto" data-image="'+s.id+'"></canvas>'+s.id+(s.id===chosen.slugId?' ✓':'')+'</button>').join('')+'</div><p>ของตกแต่ง · เลือก 1 ชิ้นที่พอดีตู้</p><select data-decor style="padding:10px;width:100%"><option value="">ไม่มีของตกแต่ง</option>'+Object.entries(TANK_DECOR).map(([key,d])=>'<option value="'+key+'" '+(chosen.decorKey===key?'selected':'')+' '+(!showcaseDecorPosition(key)?'disabled':'')+'>'+d.name+(!showcaseDecorPosition(key)?' · ใหญ่เกินตู้':'')+'</option>').join('')+'</select><button class="tbtn" style="margin-top:12px" data-clear>ไม่แสดงทาก</button>';
 showcaseDialog.querySelectorAll('[data-image]').forEach(c=>drawSlugPortrait(c,showcaseSlugs().find(s=>s.id===c.dataset.image)));
 showcaseDialog.querySelectorAll('[data-slug]').forEach(el=>el.onclick=()=>{o.showcase={...o.showcase,slugId:el.dataset.slug};saveGame();renderCounterShowcase();});
 showcaseDialog.querySelector('[data-decor]').onchange=e=>{if(e.target.value&&!showcaseDecorPosition(e.target.value))return;o.showcase={...o.showcase,decorKey:e.target.value};saveGame();};
 showcaseDialog.querySelector('[data-clear]').onclick=()=>{o.showcase={...o.showcase,slugId:null};saveGame();renderCounterShowcase();};showcaseDialog.querySelector('[data-close]').onclick=()=>showcaseDialog.close();
}
showcaseDialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();showcaseDialog.close();}},true);
let showcasePointer=null;/*cv.addEventListener('pointerdown',e=>{showcasePointer={x:e.clientX,y:e.clientY};},true);
cv.addEventListener('pointerup',e=>{if(appMode!=='view'||!showcasePointer||Math.hypot(e.clientX-showcasePointer.x,e.clientY-showcasePointer.y)>5)return;const {sx,sy}=screenXY(e),o=[...G.objs].reverse().find(o=>o._key==='counter'&&o._showcaseHit&&sx>=o._showcaseHit.x&&sx<=o._showcaseHit.right&&sy>=o._showcaseHit.y&&sy<=o._showcaseHit.bottom);if(o){dragging=false;cv.classList.remove('panning','placing');e.stopImmediatePropagation();openCounterShowcase(o);}},true);

*/
// A framed, double-sided tabletop promotion sign on the counter's short arm.
let counterPromoTexture=null;
function drawCounterPromoAt(o){
 if(!counterPromoTexture){const c=document.createElement('canvas');c.width=420;c.height=320;const x=c.getContext('2d');x.fillStyle='#b79a60';x.fillRect(0,0,420,320);x.fillStyle='#efe5cf';x.fillRect(10,10,400,300);x.fillStyle='#843e35';x.fillRect(24,24,372,272);x.strokeStyle='#e5c988';x.lineWidth=2;x.strokeRect(34,34,352,252);x.textAlign='center';x.fillStyle='#fff1cc';x.font='bold 85px Georgia';x.fillText('SALE',210,154);x.fillStyle='#dfbd79';x.fillRect(110,184,200,3);x.font='22px sans-serif';x.fillText('SEA SLUGS',210,238);counterPromoTexture=c;}
 const base=counterBlock(o,11.5,3,7,3);isoBox(base.x,base.y,base.w,base.h,14*ZUNIT,.3*ZUNIT,'#aa8c57','#514735','#786344');
 const post=counterBlock(o,14.65,4.25,.7,.5);isoBox(post.x,post.y,post.w,post.h,14.3*ZUNIT,1.2*ZUNIT,'#c2a66c','#665436','#8b744b');
 const panel=counterBlock(o,11.5,4.25,7,.35);isoBox(panel.x,panel.y,panel.w,panel.h,15.3*ZUNIT,5.3*ZUNIT,'#b79a60','#715c3c','#a58955');
 const a=counterLocal(o.def,o.rot,0,0),f=counterLocal(o.def,o.rot,0,1),front=(f[0]-a[0]+f[1]-a[1])>0;
 if(front)counterPlane(o,counterPromoTexture,[11.5,4.61,20.6],[18.5,4.61,20.6],[11.5,4.61,15.3]);
 else counterPlane(o,counterPromoTexture,[18.5,4.24,20.6],[11.5,4.24,20.6],[18.5,4.24,15.3]);
}

function shiftedCounter(o,dx,dy){const a=counterLocal(o.def,o.rot,0,0),b=counterLocal(o.def,o.rot,dx,dy);return {...o,cx:o.cx+b[0]-a[0],cy:o.cy+b[1]-a[1]};}
function drawCounterPromo(o){drawCounterPromoAt(shiftedCounter(o,-3.5,10));}
function drawCounterComputer(o){const shifted=shiftedCounter(o,2,-3);shifted.rot=(o.rot+3)&3;drawCounterComputerAt(shifted,o);o._computerHit=shifted._computerHit;}
// Inbox producers supply stable IDs; receiving the same item never repeats its alert.
function computerInbox(){return G.computerInbox ||= [];}
/* บันทึกทากในร้าน (type 'log') แยกกล่องกับเควส/ออเดอร์ — เก็บได้ COMPUTER_LOG_MAX ฉบับ
   ล้นเมื่อไหร่ตัดฉบับเก่าสุดทิ้งอัตโนมัติ · ไม่ผ่าน ledger mailSent เพราะเป็นเหตุการณ์ที่เกิดซ้ำได้ */
var COMPUTER_LOG_MAX=20;   // var ไม่ใช่ const — save.js เช็ค typeof ค่านี้ตอน loadGame() ซึ่งรันก่อนไฟล์นี้ (const จะติด TDZ แล้ว throw)
function computerLog(){return G.computerLog ||= [];}
function receiveComputerMessage(message){
 if(!message||!['quest','online','log'].includes(message.type)||!message.id||!message.title)return false;
 if(message.type==='log'){
  const log=computerLog();
  // ไม่มีสถานะยังไม่อ่าน — บันทึกเป็นประวัติ ไม่ใช่จดหมายที่ต้องเด้ง !! ตาม
  log.push({id:String(message.id),type:'log',title:String(message.title),body:String(message.body||''),at:Date.now(),read:true});
  if(log.length>COMPUTER_LOG_MAX)log.splice(0,log.length-COMPUTER_LOG_MAX);
  saveGame();if(computerDialog.open)renderComputer();return true;
 }
 const _id=String(message.id),_rep=message.repeating===true;G.mailSent||={};if(!_rep&&G.mailSent[_id])return false;const items=computerInbox();if(items.some(m=>m.id===_id))return false;if(!_rep)G.mailSent[_id]=true;
 items.push({id:String(message.id),type:message.type,title:String(message.title),body:String(message.body||''),read:false});
 saveGame();if(computerDialog.open)renderComputer();return true;
}
function computerUnread(){return computerInbox().some(m=>!m.read);}   // บันทึกทากไม่นับ — ไม่ต้องเด้ง !!
let computerTexture=null;
const computerModelCache=new WeakMap();
function drawCounterComputerAt(o,actual){
 if(!computerTexture){const c=document.createElement('canvas');c.width=480;c.height=300;const x=c.getContext('2d');x.fillStyle='#17262b';x.fillRect(0,0,480,300);x.fillStyle='#24494c';x.fillRect(12,12,456,276);x.fillStyle='#b9d6cc';x.font='22px sans-serif';x.fillText('SHOP DESK',34,49);
 for(let i=0;i<3;i++){x.fillStyle=['#ccab67','#73a9a2','#aa9aab'][i];x.fillRect(35+i*148,86,116,95);x.fillStyle='#e7e4cd';x.fillRect(49+i*148,197,88,5);}x.strokeStyle='#f0e9d4';x.lineWidth=4;x.strokeRect(61,110,64,44);x.beginPath();x.moveTo(61,110);x.lineTo(93,134);x.lineTo(125,110);x.stroke();x.strokeRect(216,105,48,58);for(let i=0;i<3;i++){x.beginPath();x.moveTo(225,120+i*14);x.lineTo(253,120+i*14);x.stroke();}x.beginPath();x.arc(389,132,24,0,Math.PI*2);x.stroke();computerTexture=c;}

 // Cache solid faces in world space; depth-sort individual faces, not draw calls.
 const key=[o.cx,o.cy,o.rot].join('|');
 let model=computerModelCache.get(actual);
 if(!model||model.key!==key){
  const faces=[];
  const world=v=>{const q=counterLocal(o.def,o.rot,v[0],v[1]);return[o.cx+q[0],o.cy+q[1],v[2]];};
  const face=(v,color,texture=null)=>{const vs=v.map(world),a=vs[0],u=vs[1].map((n,i)=>n-a[i]),w=vs[2].map((n,i)=>n-a[i]);const normal=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];if(normal[0]+normal[1]+normal[2]<=0)return;faces.push({v:vs,color,texture,depth:vs.reduce((n,v)=>n+v[0]+v[1]+v[2],0)/vs.length});};
  const box=(x,y,w,h,z,height,top='#64716e',side='#303c3e')=>{
   const A=[x,y,z],B=[x+w,y,z],C=[x+w,y+h,z],D=[x,y+h,z],E=[x,y,z+height],F=[x+w,y,z+height],G=[x+w,y+h,z+height],H=[x,y+h,z+height];
   face([E,F,G,H],top);face([A,B,F,E],side);face([B,C,G,F],side);face([C,D,H,G],side);face([D,A,E,H],side);
  };
  box(9.2,12.8,5.5,2.5,14,.24,'#697572','#3a4748');
  box(11.5,13.5,.85,.65,14.24,2.1,'#6a7774','#485657');
  box(7.9,13.8,8.3,.55,16.1,5.6,'#65736f','#263538');
  face([[15.94,13.79,21.45],[8.16,13.79,21.45],[8.16,13.79,16.4],[15.94,13.79,16.4]],null,computerTexture);
  // Back panel and vents make the rear readable as a monitor too.
  for(let i=0;i<7;i++)box(9.3+i*.65,14.35,.38,.02,17.3,.06,'#111d20','#111d20');
  box(11.6,14.36,.7,.025,19.0,.25,'#85918b','#85918b');
  box(9.0,10.7,5.9,1.8,14,.20,'#566663','#293639');
  for(let r=0;r<3;r++)for(let k=0;k<9;k++)box(9.2+k*.62,10.87+r*.44,.47,.3,14.20,.065,'#a7b2a9','#6a7973');
  box(10.5,12.2,2.8,.18,14.2,.06,'#a7b2a9','#6a7973');
  box(15.3,11.0,.75,1.15,14,.26,'#929e96','#52615f');
  faces.sort((a,b)=>a.depth-b.depth);model={key,faces};computerModelCache.set(actual,model);
 }

 if(!model.image){
  const all=model.faces.flatMap(f=>f.v.map(v=>({x:(v[0]-v[1])*TW,y:(v[0]+v[1])*TH-v[2]*ZUNIT})));
  const left=Math.floor(Math.min(...all.map(p=>p.x)))-2,top=Math.floor(Math.min(...all.map(p=>p.y)))-2;
  const c=document.createElement('canvas');c.width=Math.ceil(Math.max(...all.map(p=>p.x))-left)+2;c.height=Math.ceil(Math.max(...all.map(p=>p.y))-top)+2;const x=c.getContext('2d');
  for(const face of model.faces){const pts=face.v.map(v=>({x:(v[0]-v[1])*TW-left,y:(v[0]+v[1])*TH-v[2]*ZUNIT-top}));
   if(face.texture){const [a,b,,d]=pts,im=face.texture;x.save();x.transform((b.x-a.x)/im.width,(b.y-a.y)/im.width,(d.x-a.x)/im.height,(d.y-a.y)/im.height,a.x,a.y);x.drawImage(im,0,0);x.restore();}
   else{x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y));x.closePath();x.fillStyle=face.color;x.fill();}
  }
  model.image=c;model.left=left-(o.cx-o.cy)*TW;model.top=top-(o.cx+o.cy)*TH;
 }
 const anchor=P(o.cx,o.cy,0);ctx.drawImage(model.image,anchor.x+model.left*cam.zoom,anchor.y+model.top*cam.zoom,model.image.width*cam.zoom,model.image.height*cam.zoom);

 const pts=[];for(const x of [7.9,16.2])for(const y of [10.7,15.3])for(const z of [14,21.7]){const q=counterLocal(o.def,o.rot,x,y);pts.push(P(o.cx+q[0],o.cy+q[1],z*ZUNIT));}
 o._computerHit={x:Math.min(...pts.map(p=>p.x))-8,y:Math.min(...pts.map(p=>p.y))-8,right:Math.max(...pts.map(p=>p.x))+8,bottom:Math.max(...pts.map(p=>p.y))+8};
 if(computerUnread()||TRADE_OFFERS.some(t=>t.counter===actual&&t.arrived)||(typeof slugDeliveryReadyCount==='function'&&slugDeliveryReadyCount()>0)){const q=counterLocal(o.def,o.rot,12,14),p=P(o.cx+q[0],o.cy+q[1],24*ZUNIT),pulse=Math.sin(performance.now()/260);ctx.save();ctx.translate(p.x,p.y-3*pulse);ctx.fillStyle='#f1c66d';ctx.beginPath();ctx.arc(0,0,Math.max(14,20*cam.zoom),0,Math.PI*2);ctx.fill();ctx.fillStyle='#56352a';ctx.font='bold '+Math.max(18,26*cam.zoom)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('!!',0,1);ctx.restore();}
}
let computerTab='inbox';   // แท็บที่เปิดอยู่ในคอมพิวเตอร์ร้าน: 'inbox' | 'log'
const computerDialog=document.createElement('dialog');computerDialog.id='counterComputer';computerDialog.style.cssText='width:min(640px,90vw);max-height:80vh;overflow:auto;padding:22px;background:#172b2e;color:#e5dcc4;border:1px solid #b59859;border-radius:14px;color-scheme:dark';document.body.append(computerDialog);
function openCounterComputer(){renderComputer();if(!computerDialog.open)computerDialog.showModal();}
function renderComputer(){
 const _inUnread=computerInbox().filter(m=>!m.read).length;
 /* สองแท็บใช้พื้นที่เดียวกัน ไม่แย่งที่กัน — ปุ่มแถวบนยังเป็นปุ่มสั่งงานเหมือนเดิม */
 const _tab=(key,text,badge)=>'<button class="tbtn" data-tab="'+key+'" aria-pressed="'+(computerTab===key)+'" style="border-color:'+(computerTab===key?'#f1cc75':'#50696a')+';background:'+(computerTab===key?'#3c4a44':'#203338')+'">'+text+(badge?' <span style="color:#f1cc75">'+badge+'</span>':'')+'</button>';
 computerDialog.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between"><b>คอมพิวเตอร์ร้าน</b><button class="tbtn" data-close aria-label="ปิด">✕</button></div><button class="tbtn" data-offers style="margin:16px 8px 0 0">ข้อเสนอหน้าร้าน ('+TRADE_OFFERS.length+')</button><button class="tbtn" data-orderbox style="margin:16px 0 0">🛒 สั่งซื้อกล่องทาก'+(typeof slugDeliveryReadyCount==='function'&&slugDeliveryReadyCount()?' · 📦'+slugDeliveryReadyCount():'')+'</button><button class="tbtn" data-market style="margin:16px 0 0 8px">🌐 ตลาดโลก</button>'
  +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 10px;border-bottom:1px solid #2c3a3a;padding-bottom:10px">'
  +_tab('inbox','📬 เควส / ออเดอร์ออนไลน์',_inUnread?'!!'+_inUnread:'')
  +_tab('log','🐚 บันทึกทากในร้าน ('+computerLog().length+'/'+COMPUTER_LOG_MAX+')','')
  +'</div>'
  +(computerTab==='log'
    ?'<div style="max-height:52vh;overflow:auto" data-log></div>'
      +(computerLog().length?'<button class="tbtn" data-clearlog style="margin-top:10px;font-size:12px">🗑 ล้างบันทึกทั้งหมด</button>':'')
    :'<div data-inbox></div>');
 computerDialog.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{computerTab=b.dataset.tab;renderComputer();});
 /* อัปเดตเลข !! บนหัวแท็บโดยไม่ต้อง render ใหม่ (ไม่งั้นการ์ดที่เพิ่งกางจะหุบ) */
 const syncTabBadges=()=>{
  const t1=computerDialog.querySelector('[data-tab="inbox"]'),t2=computerDialog.querySelector('[data-tab="log"]');
  const u1=computerInbox().filter(m=>!m.read).length;
  if(t1)t1.innerHTML='📬 เควส / ออเดอร์ออนไลน์'+(u1?' <span style="color:#f1cc75">!!'+u1+'</span>':'');
  if(t2)t2.innerHTML='🐚 บันทึกทากในร้าน ('+computerLog().length+'/'+COMPUTER_LOG_MAX+')';
 };
 const list=computerDialog.querySelector('[data-inbox]');
 if(list&&!computerInbox().length)list.textContent='ยังไม่มีรายการใหม่';
 /* ฝั่งบันทึก — ใหม่สุดอยู่บน · เก่าสุดถูกตัดทิ้งเองเมื่อเกิน COMPUTER_LOG_MAX */
 const logBox=computerDialog.querySelector('[data-log]');
 if(logBox&&!computerLog().length)logBox.innerHTML='<p style="font-size:12px;opacity:.7;margin:4px 0">ยังไม่มีบันทึก — ความเคลื่อนไหวของทาก (วางไข่ · พร้อมฟัก · ตัวอ่อนรอพื้นที่) จะมาโผล่ที่นี่</p>';
 for(const m of (logBox?computerLog().slice().reverse():[])){
  const card=document.createElement('details'),title=document.createElement('summary'),body=document.createElement('p');
  card.style.cssText='padding:9px 10px;margin:6px 0;border:1px solid #3b4d4b;border-radius:8px;font-size:13px';
  const when=new Date(m.at||Date.now()).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  title.textContent=when+' · '+m.title;title.style.cursor='pointer';
  body.textContent=m.body;body.style.cssText='white-space:pre-line;font-size:12px;opacity:.85;margin:6px 0 0';
  card.append(title,body);

  logBox.append(card);
 }
 const _clr=computerDialog.querySelector('[data-clearlog]');
 if(_clr)_clr.onclick=()=>{G.computerLog=[];saveGame();renderComputer();};
 for(const m of (list?computerInbox():[])){const card=document.createElement('details'),title=document.createElement('summary'),body=document.createElement('p');card.style.cssText='padding:14px;margin:8px 0;border:1px solid #526663;border-radius:8px';title.textContent=(m.read?'':'!! · ')+(m.type==='quest'?'เควส · ':'ออนไลน์ · ')+m.title;body.textContent=m.body;body.style.whiteSpace="pre-line";card.append(title,body);if(m.id==='five-minute-gift'){const claim=document.createElement('button');claim.className='tbtn';claim.dataset.claimGift='';claim.textContent=m.claimed?'รับเงินแล้ว ✓':'รับเงินแนบ 500 เหรียญ';claim.disabled=!!m.claimed;claim.onclick=()=>{if(claimFiveMinuteGift()){claim.disabled=true;claim.textContent='รับเงินแล้ว ✓';}};card.append(claim);}const _del=document.createElement('button');_del.className='tbtn';_del.textContent='🗑 ลบจดหมาย';_del.style.cssText='margin-top:8px;display:block';_del.onclick=(ev)=>{ev.preventDefault();ev.stopPropagation();const _a=computerInbox(),_i=_a.indexOf(m);if(_i>=0)_a.splice(_i,1);if(typeof saveGame==='function')saveGame();renderComputer();};card.append(_del);card.ontoggle=()=>{if(card.open&&!m.read){m.read=true;title.textContent=(m.type==='quest'?'เควส · ':'ออนไลน์ · ')+m.title;syncTabBadges();saveGame();}};list.append(card);}
 computerDialog.querySelector('[data-close]').onclick=()=>computerDialog.close();
 computerDialog.querySelector('[data-offers]').onclick=()=>{computerDialog.close();const b=[...document.querySelectorAll('.context-nav button')].find(b=>b.textContent.startsWith('ข้อเสนอ'));if(b&&b.getAttribute('aria-expanded')!=='true')b.click();renderTradeOffers(true);};
 computerDialog.querySelector('[data-orderbox]').onclick=()=>{computerDialog.close();if(typeof openSlugShopDialog==='function')openSlugShopDialog();};
 computerDialog.querySelector('[data-market]').onclick=()=>{computerDialog.close();if(typeof openWorldMarket==='function')openWorldMarket();};
}
computerDialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();computerDialog.close();}},true);
let computerPointer=null;
cv.addEventListener('pointerdown',e=>{computerPointer={x:e.clientX,y:e.clientY};},true);
cv.addEventListener('pointerup',e=>{if(appMode!=='view'||!computerPointer)return;const down=computerPointer;computerPointer=null;if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const {sx,sy}=screenXY(e),o=[...G.objs].reverse().find(o=>o._key==='counter'&&o!==moving&&o._computerHit&&sx>=o._computerHit.x&&sx<=o._computerHit.right&&sy>=o._computerHit.y&&sy<=o._computerHit.bottom);if(o){dragging=false;cv.classList.remove('panning','placing');e.stopImmediatePropagation();openCounterComputer();}},true);

// Uses the existing visible-play timer; no new interval or render loop.
function checkFiveMinuteMail(){
 if((G.stats?.sec||0)<300||computerInbox().some(m=>m.id==='five-minute-gift'))return;
 receiveComputerMessage({id:'five-minute-gift',type:'online',title:'เศษเงินจากผู้หวังดี',body:'ว้าววววววววววววววว ร้านกระจอกจริง ๆ เลย!\n\nอะ ๆ เอาเศษเงินไปพัฒนาร้านซะ อย่าให้เป็นภาระสังคัง… เอ๊ย สังคม!\n\n— ผู้หวังดีที่รวยกว่า\n\nเงินแนบ: 500 เหรียญ'});
}
function claimFiveMinuteGift(){
 const mail=computerInbox().find(m=>m.id==='five-minute-gift');if(!mail||mail.claimed)return false;G.claimed||={};if(G.claimed['five-minute-gift']){mail.claimed=true;if(typeof saveGame==='function')saveGame();return false;}G.claimed['five-minute-gift']=true;
 mail.claimed=true;mail.read=true;G.coin+=500;syncHUD();saveGame();toast('รับเงินจากผู้หวังดี +500 เหรียญ','good');return true;
}
