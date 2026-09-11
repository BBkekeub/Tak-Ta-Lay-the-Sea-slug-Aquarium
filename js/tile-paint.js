/* ============================================================
   tile-paint.js — ทาสีพื้น/กำแพงแบบลากคลุมหลายช่องพร้อมกัน
   ============================================================ */

/* --- edge-scroll state ที่ต้องเข้าถึงได้จากทั้ง TilePaint และ IIFE ด้านล่าง --- */
let _edgeRaf=null, _edgeX=0, _edgeY=0, _edgeLast=0;
function _stopEdgeScroll(){ if(_edgeRaf){ cancelAnimationFrame(_edgeRaf); _edgeRaf=null; } }

/* ============================================================ */
window.TilePaint = (function(){
  let matId=null;
  function isOn(){ return matId!=null; }
  function stop(){
    matId=null;
    cv.classList.remove('placing');
    _stopEdgeScroll();   // ใช้ได้แล้ว เพราะอยู่ module scope ด้านบน
  }
  registerMode('paint','floor',isOn,stop);

  function pick(id){
    if(matId===id){ stop(); return; }
    matId=id;
    enterExclusiveMode('paint');
    cv.classList.add('placing');
    toast('เลือกวัสดุแล้ว · คลิกหรือลากบนพื้นหรือกำแพงเพื่อทาสี — จะทาให้ถูกฝั่งเองตามตำแหน่งที่ชี้', 'good');
  }
  function current(){ return matId; }
  function brush(){ return matId; }

  window.addEventListener('keydown', e=>{
    if(e.key==='Escape' && isOn()){ stop(); toast('วางพู่กันแล้ว','good'); }
  });

  if(typeof window.setMode==='function'){
    const oldSetMode=window.setMode;
    window.setMode=function(m){ stop(); return oldSetMode(m); };
  }

  return {pick, current, brush, isOn, stop};
})();

/* ============================================================ */
(function(){
  const EDGE_ZONE=80, EDGE_MAX=8;
  let _paintDrag=false, _lastTile=null, _target=null;
  let _lastWallKey=null, _wallPainted=false;
  let _hoverTile=null, _hoverWall=null;

  /* ---------- helpers ---------- */
  function northEdge(x,y){ return ownsTile(x,y)&&!ownsTile(x,y-1); }
  function westEdge(x,y){  return ownsTile(x,y)&&!ownsTile(x-1,y); }

  function tileUnder(clientX,clientY){
    const r=cv.getBoundingClientRect();
    const p=pick(clientX-r.left, clientY-r.top);
    return [Math.floor(p.cx/SUB), Math.floor(p.cy/SUB)];
  }
  function validTile(tx,ty){ return tx>=0&&ty>=0&&tx<MAX_B&&ty<MAX_B&&ownsTile(tx,ty); }

  function wallSegmentAt(sx,sy){
    let best=null;
    for(const [x,y] of allFloorTiles()){
      for(const side of [0,1]){
        if(side===0?!northEdge(x,y):!westEdge(x,y)) continue;
        const a=side===0?[x*SUB,y*SUB]:[x*SUB,(y+1)*SUB];
        const b=side===0?[(x+1)*SUB,y*SUB]:[x*SUB,y*SUB];
        const q=[P(a[0],a[1],ROOM_H),P(b[0],b[1],ROOM_H),P(b[0],b[1],0),P(a[0],a[1],0)];
        if(_inConvex(q,sx,sy)&&(!best||x+y>best.x+best.y))
          best={x,y,side,a,b};
      }
    }
    if(!best) return null;
    /* เจอ "ผนังบาน" ที่คลิกโดนแล้ว — หาต่อว่าโดนช่องความสูง (20 ซม./ช่อง) ชั้นไหน */
    const n=wallLayerCount();
    let layer=n-1;
    for(let i=0;i<n;i++){
      const [z0,z1]=wallLayerZ(i);
      const q=[P(best.a[0],best.a[1],z1),P(best.b[0],best.b[1],z1),P(best.b[0],best.b[1],z0),P(best.a[0],best.a[1],z0)];
      if(_inConvex(q,sx,sy)){ layer=i; break; }
    }
    return {x:best.x,y:best.y,side:best.side,layer,key:wallKey(best.x,best.y,best.side,layer)};
  }

  /* ---------- edge-scroll loop ---------- */
  function _startEdgeScroll(){ if(!_edgeRaf){ _edgeLast=0; _edgeRaf=requestAnimationFrame(_edgeStep); } }
  function _edgeStep(ts){
    if(!TilePaint.isOn()||!_paintDrag){ _stopEdgeScroll(); return; }
    const dt=Math.min(0.1,(ts-(_edgeLast||ts))/1000);
    _edgeLast=ts;
    const r=cv.getBoundingClientRect();
    const rel=(v,lo,hi)=>{
      if(v<lo+EDGE_ZONE) return -(1-Math.max(0,v-lo)/EDGE_ZONE);
      if(v>hi-EDGE_ZONE) return  (1-Math.max(0,hi-v)/EDGE_ZONE);
      return 0;
    };
    const vx=rel(_edgeX,r.left,r.right), vy=rel(_edgeY,r.top,r.bottom);
    if(vx||vy){
      cam.x+=vx*EDGE_MAX*SUB*dt;
      cam.y+=vy*EDGE_MAX*SUB*dt;
      if(_target==='floor'){
        const [nx,ny]=tileUnder(_edgeX,_edgeY);
        if(_lastTile) _paintLineTile(_lastTile[0],_lastTile[1],nx,ny);
        else _paintLineTile(nx,ny,nx,ny);
        _lastTile=[nx,ny];
      } else if(_target==='wall'){
        _paintWallAtClient(_edgeX,_edgeY);
      }
    }
    _edgeRaf=requestAnimationFrame(_edgeStep);
  }

  /* ---------- drag paint ---------- */
  function _paintLineTile(tx0,ty0,tx1,ty1){
    const dx=tx1-tx0, dy=ty1-ty0, n=Math.max(Math.abs(dx),Math.abs(dy));
    if(n===0){ if(validTile(tx0,ty0)) paintFloorTile(tx0,ty0,TilePaint.brush()); return; }
    for(let i=0;i<=n;i++){
      const tx=Math.round(tx0+dx*i/n), ty=Math.round(ty0+dy*i/n);
      if(!validTile(tx,ty)) continue;
      paintFloorTile(tx,ty,TilePaint.brush());
    }
  }
  /* ลากทาบนกำแพง — เหมือน _paintLineTile แต่เดินตามพิกัดหน้าจอ (กำแพงไม่มีดัชนีกริดเดียวแบบพื้น) */
  function _paintWallAtClient(clientX,clientY){
    const {sx,sy}=screenXY({clientX,clientY});
    const seg=wallSegmentAt(sx,sy);
    if(!seg) return;
    if(seg.key!==_lastWallKey){
      paintWallTile(seg.key, TilePaint.brush());
      _lastWallKey=seg.key;
    }
    _wallPainted=true;
  }
  function _paintWallLineClient(x0,y0,x1,y1){
    const dist=Math.hypot(x1-x0,y1-y0), steps=Math.max(1,Math.ceil(dist/8));
    for(let i=0;i<=steps;i++) _paintWallAtClient(x0+(x1-x0)*i/steps, y0+(y1-y0)*i/steps);
  }

  /* ---------- hover overlay ---------- */
  window.addEventListener('load',()=>{
    const base=drawFloor;
    drawFloor=function(){
      base();
      if(!TilePaint.isOn()||typeof tankMode!=='undefined'&&tankMode) return;
      if(!TilePaint.brush()) return;
      if(_hoverTile){
        const [hx,hy]=_hoverTile;
        if(ownsTile(hx,hy))
          drawBigDiamond(hx,hy,1,1,'rgba(220,180,60,0.30)','rgba(255,215,80,0.85)',false);
      }
      if(_hoverWall){
        const {x,y,side,layer}=_hoverWall;
        const a=side===0?[x*SUB,y*SUB]:[x*SUB,(y+1)*SUB];
        const bb=side===0?[(x+1)*SUB,y*SUB]:[x*SUB,y*SUB];
        const [z0,z1]=wallLayerZ(layer);
        const q=[P(a[0],a[1],z1),P(bb[0],bb[1],z1),P(bb[0],bb[1],z0),P(a[0],a[1],z0)];
        ctx.save();
        ctx.beginPath();q.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
        ctx.fillStyle='rgba(255,210,60,0.22)';ctx.fill();
        ctx.strokeStyle='rgba(255,215,80,0.9)';ctx.lineWidth=2;ctx.stroke();
        ctx.restore();
      }
    };
  });

  /* ---------- event listeners ---------- */
  cv.addEventListener('pointerdown',e=>{
    if(!TilePaint.isOn()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    cv.setPointerCapture(e.pointerId);
    _paintDrag=false; _lastTile=null; _lastWallKey=null; _wallPainted=false; _target=null;
    const {sx,sy}=screenXY(e);
    const seg=wallSegmentAt(sx,sy);
    if(seg){
      _target='wall';
      _paintDrag=true;
      _edgeX=e.clientX; _edgeY=e.clientY;
      _paintWallAtClient(e.clientX,e.clientY);
      _startEdgeScroll();
    } else {
      const [bx,by]=tileUnder(e.clientX,e.clientY);
      if(validTile(bx,by)){
        _target='floor';
        _paintDrag=true;
        _edgeX=e.clientX; _edgeY=e.clientY;
        _lastTile=[bx,by];
        _paintLineTile(bx,by,bx,by);
        _startEdgeScroll();
      }
    }
  },true);

  cv.addEventListener('pointermove',e=>{
    if(!TilePaint.isOn()) return;
    const {sx,sy}=screenXY(e);
    const seg=wallSegmentAt(sx,sy);
    if(seg){ _hoverWall=seg; _hoverTile=null; }
    else { _hoverWall=null; _hoverTile=tileUnder(e.clientX,e.clientY); }
    if(!_paintDrag) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const _prevX=_edgeX, _prevY=_edgeY;
    _edgeX=e.clientX; _edgeY=e.clientY;
    if(_target==='floor'){
      const [nx,ny]=tileUnder(e.clientX,e.clientY);
      if(_lastTile) _paintLineTile(_lastTile[0],_lastTile[1],nx,ny);
      else _paintLineTile(nx,ny,nx,ny);
      _lastTile=[nx,ny];
    } else if(_target==='wall'){
      _paintWallLineClient(_prevX,_prevY,e.clientX,e.clientY);
    }
  },true);

  cv.addEventListener('pointerup',e=>{
    if(!TilePaint.isOn()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    try{ cv.releasePointerCapture(e.pointerId); }catch(_){}
    _stopEdgeScroll();
    if(_target==='wall'){
      _paintWallAtClient(e.clientX,e.clientY);
      if(_wallPainted) toast('ทาสีกำแพงแล้ว','good');
    }
    _paintDrag=false; _lastTile=null; _lastWallKey=null; _wallPainted=false; _target=null;
  },true);

  cv.addEventListener('pointercancel',()=>{
    _paintDrag=false; _lastTile=null; _lastWallKey=null; _wallPainted=false; _target=null; _stopEdgeScroll();
  },true);

  for(const type of ['mousedown','mousemove','mouseup','click'])
    cv.addEventListener(type,e=>{ if(TilePaint.isOn()){ e.preventDefault(); e.stopImmediatePropagation(); } },true);

  cv.addEventListener('pointerleave',()=>{ _hoverTile=null; _hoverWall=null; });
})();
