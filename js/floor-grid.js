// Owned 50 cm tiles. Old rectangular saves remain valid without migration.
let floorRevision=0,_floorRef=null,_floorSet=null;
function ownedFloor(){
 if(!G.floorTiles)return null;
 if(_floorRef!==G.floorTiles){_floorRef=G.floorTiles;_floorSet=new Set(G.floorTiles.map(p=>p.join(',')));}
 return _floorSet;
}
function ownsTile(x,y){const set=ownedFloor();return set?set.has(x+','+y):x>=0&&y>=0&&x<G.bw&&y<G.bh;}
function floorArea(){return G.floorTiles?G.floorTiles.length:G.bw*G.bh;}
function floorRect(x,y,w,h){
 if(x<0||y<0||x+w>cellsW()||y+h>cellsH())return false;
 for(let by=Math.floor(y/SUB);by<=Math.floor((y+h-1e-7)/SUB);by++)for(let bx=Math.floor(x/SUB);bx<=Math.floor((x+w-1e-7)/SUB);bx++)if(!ownsTile(bx,by))return false;
 return true;
}
function floorSegment(a,b,r){
 if(!G.floorTiles)return true;
 if(!floorRect(a.x-r,a.y-r,r*2,r*2)||!floorRect(b.x-r,b.y-r,r*2,r*2))return false;
 const dx=b.x-a.x,dy=b.y-a.y;
 for(let y=Math.max(0,Math.floor((Math.min(a.y,b.y)-r)/SUB));y<=Math.min(G.bh-1,Math.floor((Math.max(a.y,b.y)+r)/SUB));y++)for(let x=Math.max(0,Math.floor((Math.min(a.x,b.x)-r)/SUB));x<=Math.min(G.bw-1,Math.floor((Math.max(a.x,b.x)+r)/SUB));x++){
  if(ownsTile(x,y))continue;let lo=0,hi=1;
  for(const [v,d,min,max] of [[a.x,dx,x*SUB-r,(x+1)*SUB+r],[a.y,dy,y*SUB-r,(y+1)*SUB+r]]){
   if(Math.abs(d)<1e-9){if(v<=min||v>=max){lo=2;break;}}
   else {let t0=(min-v)/d,t1=(max-v)/d;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);}
  }if(lo<=hi)return false;
 }return true;
}
function floorRouteNodes(){
 if(!G.floorTiles)return [];const out=[],r=PERSON_R+.9;
 for(let y=1;y<G.bh;y++)for(let x=1;x<G.bw;x++){
  const n=[[x-1,y-1],[x,y-1],[x-1,y],[x,y]].filter(p=>ownsTile(...p)).length;
  if(n!==3)continue;
  for(const dx of [-r,r])for(const dy of [-r,r]){const p={x:x*SUB+dx,y:y*SUB+dy};if(floorRect(p.x-r,p.y-r,r*2,r*2)&&!personBlocked(p.x,p.y))out.push(p);}
 }return out;
}
function allFloorTiles(){return G.floorTiles||Array.from({length:G.bw*G.bh},(_,i)=>[i%G.bw,Math.floor(i/G.bw)]);}
function commitFloorTiles(tiles){
 const set=new Set(allFloorTiles().map(p=>p.join(','))),pending=new Map(tiles.map(p=>[p.join(','),p]));for(const k of set)pending.delete(k);
 for(const [k,[x,y]] of pending)if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=MAX_B||y>=MAX_B)return {ok:false,reason:'นอกขอบเขตขยายร้าน'};
 const added=[];let changed=true;while(changed){changed=false;for(const [k,[x,y]] of pending){if([[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(p=>set.has(p.join(',')))){set.add(k);pending.delete(k);added.push([x,y]);changed=true;}}}
 if(pending.size)return {ok:false,reason:'ช่องใหม่ต้องเชื่อมกับพื้นที่เดิมทางด้านข้าง'};
 if(!added.length)return {ok:false,reason:'ยังไม่ได้เลือกช่องใหม่'};
 const cost=expandCost(added.length, floorArea());   // ช่องที่ซื้อพร้อมกันคิดราคาไล่ขึ้นทีละช่องif(G.coin<cost)return {ok:false,reason:'เหรียญไม่พอ ('+cost+')'};
 G.coin-=cost;G.floorTiles=[...set].map(k=>k.split(',').map(Number));G.bw=Math.max(...G.floorTiles.map(p=>p[0]))+1;G.bh=Math.max(...G.floorTiles.map(p=>p[1]))+1;floorRevision++;
 return {ok:true,count:added.length,cost};
}
/* กุญแจของ "ช่องกำแพง" หนึ่งช่อง — side 0 = ผนังเหนือของช่อง (x,y), 1 = ผนังตะวันตกของช่อง (x,y)
   ใช้ทั้งตอนวาด (ด้านล่าง) และตอนหาว่าคลิกโดนช่องไหน (tile-paint.js) — ต้องตรงกันเป๊ะทั้งสองที่
   layer = ชั้นความสูง (0 = ชั้นล่างสุด) ไม่ใส่ layer = กุญแจ "ทั้งผนัง" แบบเดิม (เผื่อเซฟเก่า/ค่าเริ่มต้นรวม) */
function wallKey(x,y,side,layer){ return layer==null ? x+','+y+','+side : x+','+y+','+side+':'+layer; }

/* ---- แบ่งความสูงผนังเป็นช่อง ๆ (ผู้ใช้กำหนดเอง) ----
   ความยาวแนวนอนต่อช่องยังคงเดิม 50 ซม. (1 ช่องใหญ่ต่อ side) · แนวตั้งหั่นเพิ่มเป็นช่องละ 20 ซม.
   ทำให้โหมดทาสีกำแพงเลือกทาทีละ "บล็อก" 50×20 ซม. แทนที่จะทาทั้งผนังสูง ROOM_H รวดเดียว
   คำนวณจาก ROOM_H/ZUNIT/CM_PER_CELL ที่ตอนนี้เท่านั้น (ไฟล์นี้โหลดก่อน shop-floor.js ที่ประกาศ ROOM_H/ZUNIT
   จึงต้องอยู่ในฟังก์ชัน เรียกตอนรันจริงเท่านั้น ห้ามคำนวณเป็นค่าคงที่ระดับบนของไฟล์) */
const WALL_LAYER_CM = 20;
function wallLayerCount(){
  return Math.max(1, Math.round((ROOM_H/ZUNIT) / (WALL_LAYER_CM/CM_PER_CELL)));
}
function wallLayerZ(i){                    // คืน [z0,z1] หน่วย world-z px ของช่องกำแพงชั้นที่ i
  const step=(WALL_LAYER_CM/CM_PER_CELL)*ZUNIT;
  return [i*step, Math.min(ROOM_H, (i+1)*step)];
}
/* วาดผนัง 1 บาน (a→b) — รวมช่องความสูงที่ติดกันและใช้วัสดุเดียวกันให้เป็น quad เดียว
   1) กัน draw call ที่ไม่จำเป็น (ผนังส่วนใหญ่ทาสีเดียวทั้งบาน = วาดทีเดียวจบ ไม่ใช่ 12 ชิ้น)
   2) กันเส้นแตกจาก antialiasing ระหว่างช่องที่ติดกันของ texture เดียวกัน (drawWall เองก็ยึดลาย
      กับบนสุดของทั้งผนังอยู่แล้ว จึงต่อกันสนิทได้แม้วาดแยกชิ้น แต่รวมเป็นก้อนเดียวชัวร์กว่า) */
function drawWallSegment(x,y,side,a,b,tint){
  const n=wallLayerCount();
  let i=0;
  while(i<n){
    const mat=wallMatIdAt(wallKey(x,y,side,i));
    let j=i+1;
    while(j<n && wallMatIdAt(wallKey(x,y,side,j))===mat) j++;
    const z0=wallLayerZ(i)[0], z1=wallLayerZ(j-1)[1];
    drawWall(a,b,tint,wallKey(x,y,side,i),z0,z1);   // วัสดุเดียวกันทั้งกลุ่ม ใช้กุญแจของช่องแรกพอ
    i=j;
  }
}
/* เดิมใช้ได้เฉพาะร้านที่ผ่านระบบขยายแบบ "ทีละช่อง" (G.floorTiles ตั้งค่าแล้ว)
   ตอนนี้ใช้ allFloorTiles() แทน (คืนกริดสี่เหลี่ยมเต็มเมื่อยังไม่เคยขยาย) จึงวาด "ผนังทีละช่อง"
   ได้เสมอไม่ว่าร้านจะยังเป็นสี่เหลี่ยมเดิมหรือขยายมาแล้ว — จำเป็นเพื่อให้ทาสีกำแพงทีละช่องได้ทุกกรณี */
function drawTileWalls(){
 const ends=[];const north=(x,y)=>ownsTile(x,y)&&!ownsTile(x,y-1),west=(x,y)=>ownsTile(x,y)&&!ownsTile(x-1,y);
 for(const [x,y] of allFloorTiles()){
  for(const side of [0,1]){
   if(ownsTile(x-(side===1),y-(side===0)))continue;
   const a=side===0?[x*SUB,y*SUB]:[x*SUB,(y+1)*SUB],b=side===0?[(x+1)*SUB,y*SUB]:[x*SUB,y*SUB];
   drawWallSegment(x,y,side,a,b,side===0?'rgba(255,242,220,0.05)':'rgba(0,0,0,0.20)');
   const thickness=15/CM_PER_CELL;
   const dx=side===1?-thickness:0,dy=side===0?-thickness:0;
   if(side===0){
    if(!north(x+1,y))ends.push([x,y,side,b,[b[0]+dx,b[1]+dy],'rgba(0,0,0,0.36)']);
    if(!north(x-1,y)&&!west(x,y))ends.push([x,y,side,[a[0]+dx,a[1]+dy],a,'rgba(0,0,0,0.28)']);
   }else{
    if(!west(x,y+1))ends.push([x,y,side,[a[0]+dx,a[1]+dy],a,'rgba(0,0,0,0.28)']);
    if(!west(x,y-1)&&!north(x,y))ends.push([x,y,side,b,[b[0]+dx,b[1]+dy],'rgba(0,0,0,0.36)']);
   }
   const points=[a,b,[b[0]+dx,b[1]+dy],[a[0]+dx,a[1]+dy]].map(v=>P(v[0],v[1],ROOM_H));
   ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='#696354';ctx.fill();
  }
 }
 for(const [x,y,side,a,b,tint] of ends)drawWallSegment(x,y,side,a,b,tint);
}
