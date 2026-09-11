/* ============================================================
   tile-paint.js — ทาสีพื้น/กำแพงแบบลากคลุมหลายช่องพร้อมกัน
   ============================================================ */

/* --- edge-scroll state ที่ต้องเข้าถึงได้จากทั้ง TilePaint และ IIFE ด้านล่าง --- */
let _edgeRaf=null, _edgeX=0, _edgeY=0, _edgeLast=0;
function _stopEdgeScroll(){ if(_edgeRaf){ cancelAnimationFrame(_edgeRaf); _edgeRaf=null; } }

/* ============================================================ */
window.TilePaint = (function(){
  let kind=null, matId=null;
  function isOn(){ return !!kind; }
  function stop(){
    kind=null; matId=null;
    cv.classList.remove('placing');
    _stopEdgeScroll();   // ใช้ได้แล้ว เพราะอยู่ module scope ด้านบน
  }
  registerMode('paint','floor',isOn,stop);

  function pick(k,id){
    if(kind===k && matId===id){ stop(); return; }
    kind=k; matId=id;
    enterExclusiveMode('paint');
    cv.classList.add('placing');
    toast(k==='floor'
      ? 'เลือกลายพื้นแล้ว · คลิกหรือลากครอบช่องพื้นที่ต้องการทาสี'
      : 'เลือกลายกำแพงแล้ว · คลิกช่องกำแพงที่ต้องการทาสี', 'good');
  }
  function current(k){ return kind===k ? matId : null; }
  function brush(){ return kind ? {kind,id:matId} : null; }

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
  let _paintDrag=false, _lastTile=null;
  let _hoverTile=null, _hoverWall=null;

  /* ---------- helpers ---------- */
  function northEdge(x,y){ return ownsTile(x,y)&&!ownsTile(x,y-1); }
  function westEdge(x,y){  return ownsTile(x,y)&&!ownsTile(x-1,y); }

  function tileUnder(clientX,clientY){
    const r=cv.getBoundingClientRect();
    const p=pick(clientX-r.left, clientY-r.top);
    return [Math.floor(p.cx/SUB), Math.floor(p.cy/SUB)];
  }

  function wallSegmentAt(sx,sy){
    let best=null;
    for(const [x,y] of allFloorTiles()){
      for(const side of [0,1]){
        if(side===0?!northEdge(x,y):!westEdge(x,y)) continue;
        const a=side===0?[x*SUB,y*SUB]:[x*SUB,(y+1)*SUB];
        const b=side===0?[(x+1)*SUB,y*SUB]:[x*SUB,y*SUB];
        const q=[P(a[0],a[1],ROOM_H),P(b[0],b[1],ROOM_H),P(b[0],b[1],0),P(a[0],a[1],0)];
        if(_inConvex(q,sx,sy)&&(!best||x+y>best.x+best.y))
          best={x,y,side,key:wallKey(x,y,side)};
      }
    }
    return best;
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
      if(TilePaint.brush()?.kind==='floor'){
        const [nx,ny]=tileUnder(_edgeX,_edgeY);
        if(_lastTile) _paintLineTile(_lastTile[0],_lastTile[1],nx,ny);
        else _paintLineTile(nx,ny,nx,ny);
        _lastTile=[nx,ny];
      }
    }
    _edgeRaf=requestAnimationFrame(_edgeStep);
  }

  /* ---------- drag paint ---------- */
  function _paintLineTile(tx0,ty0,tx1,ty1){
    const dx=tx1-tx0, dy=ty1-ty0, n=Math.max(Math.abs(dx),Math.abs(dy));
    for(let i=0;i<=n;i++){
      const tx=Math.round(tx0+dx*i/n), ty=Math.round(ty0+dy*i/n);
      if(tx<0||ty<0||tx>=MAX_B||ty>=MAX_B||!ownsTile(tx,ty)) continue;
      paintFloorTile(tx,ty,TilePaint.brush().id);
    }
  }

  /* ---------- hover overlay ---------- */
  window.addEventListener('load',()=>{
    const base=drawFloor;
    drawFloor=function(){
      base();
      if(!TilePaint.isOn()||typeof tankMode!=='undefined'&&tankMode) return;
      const b=TilePaint.brush(); if(!b) return;
      if(b.kind==='floor'&&_hoverTile){
        const [hx,hy]=_hoverTile;
        if(ownsTile(hx,hy))
          drawBigDiamond(hx,hy,1,1,'rgba(220,180,60,0.30)','rgba(255,215,80,0.85)',false);
      }
      if(b.kind==='wall'&&_hoverWall){
        const {x,y,side}=_hoverWall;
        const a=side===0?[x*SUB,y*SUB]:[x*SUB,(y+1)*SUB];
        const bb=side===0?[(x+1)*SUB,y*SUB]:[x*SUB,y*SUB];
        const q=[P(a[0],a[1],ROOM_H),P(bb[0],bb[1],ROOM_H),P(bb[0],bb[1],0),P(a[0],a[1],0)];
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
    _paintDrag=false; _lastTile=null;
    const b=TilePaint.brush();
    if(b.kind==='floor'){
      _paintDrag=true;
      _edgeX=e.clientX; _edgeY=e.clientY;
      const [bx,by]=tileUnder(e.clientX,e.clientY);
      _lastTile=[bx,by];
      _paintLineTile(bx,by,bx,by);
      _startEdgeScroll();
    }
  },true);

  cv.addEventListener('pointermove',e=>{
    if(!TilePaint.isOn()) return;
    const b=TilePaint.brush();
    if(b.kind==='floor'){
      _hoverTile=tileUnder(e.clientX,e.clientY); _hoverWall=null;
    } else {
      _hoverTile=null; const {sx,sy}=screenXY(e); _hoverWall=wallSegmentAt(sx,sy)||null;
    }
    if(!_paintDrag) return;
    e.preventDefault(); e.stopImmediatePropagation();
    _edgeX=e.clientX; _edgeY=e.clientY;
    if(b.kind==='floor'){
      const [nx,ny]=tileUnder(e.clientX,e.clientY);
      if(_lastTile) _paintLineTile(_lastTile[0],_lastTile[1],nx,ny);
      else _paintLineTile(nx,ny,nx,ny);
      _lastTile=[nx,ny];
    }
  },true);

  cv.addEventListener('pointerup',e=>{
    if(!TilePaint.isOn()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    try{ cv.releasePointerCapture(e.pointerId); }catch(_){}
    _stopEdgeScroll();
    const b=TilePaint.brush();
    if(b.kind==='wall'){
      const {sx,sy}=screenXY(e), seg=wallSegmentAt(sx,sy);
      if(!seg) toast('ต้องคลิกบนกำแพง','bad');
      else { paintWallTile(seg.key,b.id); toast('ทาสีกำแพงช่องนี้แล้ว','good'); }
    }
    _paintDrag=false; _lastTile=null;
  },true);

  cv.addEventListener('pointercancel',()=>{
    _paintDrag=false; _lastTile=null; _stopEdgeScroll();
  },true);

  for(const type of ['mousedown','mousemove','mouseup','click'])
    cv.addEventListener(type,e=>{ if(TilePaint.isOn()){ e.preventDefault(); e.stopImmediatePropagation(); } },true);

  cv.addEventListener('pointerleave',()=>{ _hoverTile=null; _hoverWall=null; });
})();
