/* ============================================================
   research-table.js — โต๊ะวิจัย 50×100 ซม. ในหน้าร้าน (ตัวโมเดล + การคลิก)
   บนโต๊ะ: ตู้ทากเล็ก · ชั้นหลอดแก้ว + ขวดน้ำยาทดลอง · คอมพิวเตอร์
   คลิกโต๊ะในโหมดดู/เล่น = เปิดหน้าวิจัย (research.js)

   พิกัดในโมเดลเป็น "ช่องเล็ก" เหมือน play-table.js: x 0–10 (50 ซม.) · y 0–20 (100 ซม.)
   z มีหน่วยเป็น ZUNIT (≈ 1 ช่องเล็ก ≈ 5 ซม.) — ผิวโต๊ะอยู่ที่ 12.65 ≈ 63 ซม.
   ⚠️ ห้ามใช้กล่องทึบเต็มช่องเป็นพื้นที่กด (บทเรียนเดียวกับโต๊ะเล่นกับทาก)
      ใต้โต๊ะเป็นที่โล่ง ถ้ากินคลิกไปหมดจะแย่งคลิกตู้ที่ตั้งอยู่ข้างหลัง
   ============================================================ */
const RS_TOP=12.65;                       // ระดับผิวโต๊ะ
const researchTableModels=new WeakMap();
function researchTableModel(o){
 const key=[o.cx,o.cy,o.rot].join('|'),old=researchTableModels.get(o);if(old&&old.key===key)return old.boxes;
 const boxes=[];
 function box(x,y,w,h,z,height,top,right,front){
  const points=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(p=>counterLocal(o.def,o.rot,p[0],p[1]));
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const b={x:o.cx+Math.min(...xs),y:o.cy+Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),
           z:z*ZUNIT,height:height*ZUNIT,top,right,front};
  boxes.push(b);return b;
 }
 /* ---- ตัวโต๊ะ (ไม้ ใช้ลายเดียวกับโต๊ะเล่นกับทาก) ---- */
 for(const [x,y] of [[.6,.6],[8.6,.6],[.6,18.6],[8.6,18.6]])box(x,y,.8,.8,0,12,'#bd9365','#64452c','#896040');
 box(.2,.2,9.6,19.6,10.5,1,'#bb9060','#775037','#986d46');
 box(0,0,10,20,12,.65,'#ead4ae','#9d7049','#c2996a');
 for(const b of boxes)b.wood=true;

 /* ---- ตู้ทากบนโต๊ะ 44×30 ซม. (ปลายไกล) ---- */
 box(.6,.6,8.8,6,RS_TOP,.25,'#dbbd85','#a99370','#b6a37e');                                   // ทรายก้นตู้
 box(.6,.6,8.8,6,RS_TOP+.25,4.2,'rgba(169,224,230,.22)','rgba(120,193,204,.33)','rgba(185,235,235,.32)').slugTank=true;
 for(const [x,y,w,h] of [[.6,.6,8.8,.12],[.6,6.48,8.8,.12],[.6,.6,.12,6],[9.28,.6,.12,6]])
  box(x,y,w,h,RS_TOP+4.45,.15,'#d9efea','#a7c7c4','#c1dfd8');                                  // ขอบกระจก

 /* ---- ชั้นหลอดแก้ว 4 หลอด (มีน้ำยาสีอยู่ก้นหลอด) ---- */
 box(.7,7.5,4.6,1.7,RS_TOP,.35,'#5d6f74','#36474b','#465a5e');                                 // แท่นวางหลอด
 const REAGENT=[['#7fd8a0','#3e8a5e','#56a877'],['#f0c04f','#9a7620','#c2942f'],
                ['#e0708f','#8d3350','#b04a6b'],['#78b7ef','#2f6795','#4a86b8']];
 for(let i=0;i<4;i++){
  const x=.95+i*1.1,[m,d,f]=REAGENT[i];
  box(x,7.75,.6,.6,RS_TOP+.35,.9,m,d,f);                                                       // น้ำยาในหลอด
  /* ผนังหลอดต้องทึบพอให้เห็นว่าเป็น "หลอด" ไม่ใช่ลูกบาศก์สี — มีปากหลอดสว่างปิดหัวอีกที */
  box(x,7.75,.6,.6,RS_TOP+1.25,2.2,'rgba(214,240,244,.40)','rgba(146,193,201,.46)','rgba(196,231,235,.42)');
  box(x-.07,7.68,.74,.74,RS_TOP+3.45,.16,'#eaf7f6','#9dbcba','#c3dcd9');                       // ปากหลอด
 }
 /* ---- ขวดน้ำยาทดลอง 3 ใบ + จุกสี ---- */
 const BOTTLE=[[6.3,7.5,1.5,1.5,1.9,'#8fd6c2','#3f8a78','#57a693','#e2b35a'],
               [8.1,7.7,1.2,1.2,1.4,'#e3a2c0','#8c4a68','#ab6182','#dcd4c0'],
               [6.6,9.4,1.1,1.1,1.1,'#bfae7e','#6d6036','#8c7c4c','#c2564a']];
 for(const [x,y,w,h,tall,m,d,f,capCol] of BOTTLE){
  box(x,y,w,h,RS_TOP,tall,m,d,f);
  box(x+w*.3,y+h*.3,w*.4,h*.4,RS_TOP+tall,.35,capCol,'#00000040','#00000026');
 }

 /* ---- คอมพิวเตอร์ (ปลายใกล้) ---- */
 box(3.6,13.1,2.8,1,RS_TOP,.45,'#9aa5a8','#4f5a5d','#6c7679');                                 // ฐานจอ
 box(4.6,13.4,.8,.4,RS_TOP+.45,1.1,'#8b9598','#485255','#5e686b');                             // คอจอ
 box(1.9,13.2,6.2,.55,RS_TOP+1.55,4.5,'#31474b','#16272b','#0f2a31').screen=true;              // จอ (หน้าจอ = ด้านหน้า)
 box(2.4,16.3,5.2,1.7,RS_TOP,.4,'#dfe4e2','#8d9694','#b3bab7').keys=true;                      // คีย์บอร์ด
 box(8.1,16.6,.9,1.3,RS_TOP,.4,'#e6eae7','#909996','#bcc3bf');                                 // เมาส์
 box(.8,17.4,1.9,1.6,RS_TOP,.14,'#f4efdf','#b3ac96','#d6cfb8');                                // กองกระดาษ

 boxes.sort((a,b)=>(a.z-b.z)||(a.x+a.y+(a.w+a.h)/2)-(b.x+b.y+(b.w+b.h)/2));
 researchTableModels.set(o,{key,boxes});return boxes;
}
/* รูปทรงเดียวกันส่งให้บัฟเฟอร์ความลึกของคน (ไม่งั้นลูกค้าเดินทะลุโต๊ะ) */
const researchTableDepthCache=new WeakMap();
function researchTableDepthFaces(o){
 const boxes=researchTableModel(o),cached=researchTableDepthCache.get(o);if(cached&&cached.boxes===boxes)return cached;
 const entry={boxes,opaque:[],glass:[]};
 for(const b of boxes){const x=b.x,y=b.y,w=b.w,h=b.h,lo=b.z/ZUNIT,hi=(b.z+b.height)/ZUNIT;
  const a=[x,y,lo],c=[x+w,y,lo],d=[x+w,y+h,lo],e=[x,y+h,lo],A=[x,y,hi],B=[x+w,y,hi],C=[x+w,y+h,hi],D=[x,y+h,hi];
  if(String(b.top).startsWith('rgba'))entry.glass.push([A,B,C,D],[c,d,C,B],[e,d,C,D]);
  else entry.opaque.push([A,B,C,D],[a,c,B,A],[c,d,C,B],[d,e,D,C],[e,a,A,D]);
 }
 researchTableDepthCache.set(o,entry);return entry;
}

/* ทากตัวอย่างในตู้บนโต๊ะ — ยึดตัวเดิมไว้ ถ้าตัวนั้นไม่อยู่แล้วค่อยเปลี่ยน (ไม่ให้สลับตัวทุกเฟรม) */
function researchTableResident(o){
 if(typeof engineReady!=='undefined'&&!engineReady)return;
 const tanks=[...(G.objs||[]),...(G.shelter||[])].filter(t=>t&&t.type==='tank');
 const all=[...tanks.flatMap(t=>t.slugs||[]),...(G.inv||[])];
 if(!all.length){o._rsSlug=null;return;}
 if(!o._rsSlug||!all.includes(o._rsSlug))o._rsSlug=all[0];
 const spr=typeof slugSprite==='function'&&slugSprite(o._rsSlug);if(!spr)return;
 const q=counterLocal(o.def,o.rot,5,3.6),p=P(o.cx+q[0],o.cy+q[1],(RS_TOP+.3)*ZUNIT);
 const scale=Math.min(5.2*TW*cam.zoom/spr.w,2.8*ZUNIT*cam.zoom/spr.h),w=spr.w*scale,h=spr.h*scale;
 ctx.save();ctx.translate(p.x,p.y-h*.38);ctx.drawImage(spr.c,-w/2,-h/2,w,h);ctx.restore();
}
/* ภาพบนหน้าจอคอม — กราฟยีนจาง ๆ ให้รู้ว่าเป็นเครื่องวิเคราะห์ ไม่ใช่จอดำ */
function drawResearchScreen(o,b){
 const x0=b.x,y0=b.y+b.h,x1=b.x+b.w,z0=b.z,z1=b.z+b.height;
 const A=P(x0,y0,z1),B=P(x1,y0,z1),C=P(x1,y0,z0),D=P(x0,y0,z0);
 ctx.save();
 ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.lineTo(C.x,C.y);ctx.lineTo(D.x,D.y);ctx.closePath();ctx.clip();
 const g=ctx.createLinearGradient(A.x,A.y,D.x,D.y);g.addColorStop(0,'#123a45');g.addColorStop(1,'#0b2027');
 ctx.fillStyle=g;ctx.fill();
 ctx.strokeStyle='rgba(126,214,196,.75)';ctx.lineWidth=Math.max(1,1.4*cam.zoom);ctx.beginPath();
 for(let i=0;i<=8;i++){const t=i/8,px=A.x+(B.x-A.x)*t,py=A.y+(B.y-A.y)*t;
  const k=0.30+0.42*(0.5+0.5*Math.sin(i*1.7));
  const qx=px+(D.x-A.x)*k,qy=py+(D.y-A.y)*k;i?ctx.lineTo(qx,qy):ctx.moveTo(qx,qy);}
 ctx.stroke();
 ctx.restore();
}
function drawResearchTable(o){
 if(document.hidden||!onScreen(o))return;
 for(const b of researchTableModel(o)){
  if(b.slugTank)researchTableResident(o);
  isoBox(b.x,b.y,b.w,b.h,b.z,b.height,b.top,b.right,b.front);
  if(b.wood&&typeof drawPlayTableWood==='function')drawPlayTableWood(o,b);
  if(b.screen)drawResearchScreen(o,b);
 }
}
/* พื้นที่กด = รูปทรงที่วาดจริงทีละกล่อง (เช็กเฉพาะตอนคลิก ไม่ได้อยู่ในลูปวาด) */
function researchTableBoxHit(o,x,y){
 for(const b of researchTableModel(o)){
  const pts=[];
  for(const z of [b.z,b.z+b.height])for(const [dx,dy] of [[0,0],[b.w,0],[b.w,b.h],[0,b.h]])pts.push(P(b.x+dx,b.y+dy,z));
  if(_inConvex(_hull(pts),x,y))return true;
 }
 return false;
}
function researchTableHit(x,y){
 let best=null;
 for(const o of G.objs){if(!o.def.researchTable)continue;
  if(researchTableBoxHit(o,x,y)&&(!best||o.cx+o.cy>best.cx+best.cy))best=o;
 }
 return best;
}
