/* Replacement for the base editor's renderLayers() — build-custom.mjs swaps it into Custom.html.
   The original deleted every stage node and created new <img src="data:…"> for all layers on EVERY call
   (every pointer move while dragging). With multi-MB embedded art (Oreo crest 2.3 MB, imported body 1 MB) the
   browser re-parsed those URLs each time: 40–80 ms per move on the user's machine.
   Now each layer keeps its node and <img>; only transform/visibility change, and src is set only when the art changes.
   Wrappers (warp/bones/surface canvases, colour preview) still replace the node's child afterwards as before. */
const LY_NODES=new Map();   // layer id → {d, im, src}
function renderLayers(){
  const world=$('world'),alive=new Set();let prev=$('paper');
  doc.layers.forEach(L=>{
    const P=PARTS[L.part]; if(!P) return;
    let n=LY_NODES.get(L.id);
    if(!n){const d=document.createElement('div');d.className='ly';d.dataset.id=L.id;const im=document.createElement('img');im.draggable=false;n={d,im,src:null};LY_NODES.set(L.id,n);}
    const {d,im}=n,src=SRC[P.img];
    if(n.src!==src){im.src=src;n.src=src;}
    if(im.width!==P.w)im.width=P.w; if(im.height!==P.h)im.height=P.h;
    im.style.marginLeft=(-P.ax*P.w)+'px'; im.style.marginTop=(-P.ay*P.h)+'px';
    d.style.left=L.x+'px'; d.style.top=L.y+'px';
    d.style.transform='rotate('+L.rot+'deg) scale('+(L.s*P.nat*EX(L)*(L.fx?-1:1))+','+(L.s*P.nat*EY(L)*(L.fy?-1:1))+')';
    d.style.opacity=L.op; d.style.display=effVis(L)?'':'none';
    if(d.childNodes.length!==1||d.firstChild!==im)d.replaceChildren(im);
    const next=prev?prev.nextSibling:world.firstChild;if(next!==d)world.insertBefore(d,next);prev=d;alive.add(L.id);
  });
  for(const [id,n] of LY_NODES)if(!alive.has(id)){n.d.remove();LY_NODES.delete(id);}
}
