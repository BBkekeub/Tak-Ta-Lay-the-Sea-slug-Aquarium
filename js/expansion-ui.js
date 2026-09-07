(()=>{
 const reset=document.createElement('button');reset.className='tbtn danger';reset.textContent='รีเซตร้าน';reset.onclick=()=>resetGame();document.querySelector('[data-panel="settings"]').append(reset);
 const expandButton=document.getElementById('expW');expandButton.textContent='เลือกช่องขยายร้าน';document.getElementById('expH').hidden=true;
 let active=false,drag=false,last=null;const selected=new Map();
 const controls=document.createElement('div');controls.hidden=true;controls.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-top:10px';
 const buy=document.createElement('button'),cancel=document.createElement('button');buy.className=cancel.className='tbtn';cancel.textContent='ยกเลิก';controls.append(buy,cancel);expandButton.parentElement.after(controls);
 function update(){const cost=expandCost(selected.size,floorArea());buy.textContent='ซื้อ '+selected.size+' ช่อง · '+cost.toLocaleString()+' เหรียญ';buy.disabled=!selected.size||G.coin<cost;}
 function stop(){active=false;drag=false;selected.clear();controls.hidden=true;cv.style.cursor='';update();}
 expandButton.onclick=()=>{restoreHeldRotation();active=true;placingWallDoor=false;buyKey=null;moving=null;grab=null;selected.clear();controls.hidden=false;cv.style.cursor='crosshair';update();};cancel.onclick=stop;
 document.querySelector('.rail').addEventListener('click',e=>{if(active&&e.target.closest('button')&&e.target!==expandButton&&!controls.contains(e.target))stop();},true);
 buy.onclick=()=>{const result=commitFloorTiles([...selected.values()]);if(!result.ok){toast(result.reason,'bad');return;}selected.clear();update();syncHUD();saveGame();toast('เพิ่ม '+result.count+' ช่อง −'+result.cost+' เหรียญ','good');stop();finishConstruction();};
 const oldMode=setMode;setMode=function(m){stop();return oldMode(m);};
 function tile(e){const r=cv.getBoundingClientRect(),p=pick(e.clientX-r.left,e.clientY-r.top);return [Math.floor(p.cx/SUB),Math.floor(p.cy/SUB)];}
 function add(p){const [x,y]=p;if(x>=0&&y>=0&&x<MAX_B&&y<MAX_B&&!ownsTile(x,y))selected.set(p.join(','),p);}
 cv.addEventListener('pointerdown',e=>{if(!active||e.button!==0)return;e.preventDefault();e.stopImmediatePropagation();drag=true;last=tile(e);const key=last.join(',');if(selected.has(key))selected.delete(key);else add(last);cv.setPointerCapture(e.pointerId);update();},true);
 cv.addEventListener('pointermove',e=>{if(!active)return;e.preventDefault();e.stopImmediatePropagation();if(!drag)return;const next=tile(e),dx=next[0]-last[0],dy=next[1]-last[1],n=Math.max(Math.abs(dx),Math.abs(dy));for(let i=1;i<=n;i++)add([Math.round(last[0]+dx*i/n),Math.round(last[1]+dy*i/n)]);last=next;update();},true);
 cv.addEventListener('pointerup',e=>{if(!active)return;e.preventDefault();e.stopImmediatePropagation();drag=false;if(cv.hasPointerCapture(e.pointerId))cv.releasePointerCapture(e.pointerId);},true);
 cv.addEventListener('pointercancel',()=>{drag=false;});
 for(const type of ['mousedown','mousemove','mouseup','click'])cv.addEventListener(type,e=>{if(active){e.preventDefault();e.stopImmediatePropagation();}},true);
 window.addEventListener('keydown',e=>{if(active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();stop();}},true);
 const original=drawFloor;drawFloor=function(){original();if(!active||tankMode)return;
  const candidates=new Map();for(const [x,y] of [...allFloorTiles(),...selected.values()])for(const p of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(p[0]>=0&&p[1]>=0&&p[0]<MAX_B&&p[1]<MAX_B&&!ownsTile(...p))candidates.set(p.join(','),p);
  for(const [key,[x,y]] of candidates)drawBigDiamond(x,y,1,1,selected.has(key)?'rgba(220,180,85,.5)':'rgba(90,200,190,.12)',selected.has(key)?'#e1bc6a':'#6aa7a6',true);
  for(const [key,[x,y]] of selected)if(!candidates.has(key))drawBigDiamond(x,y,1,1,'rgba(220,90,75,.35)','#e67b69',true);
 };
 const help=document.querySelector('.help-dialog');const info=document.createElement('details');info.innerHTML='<summary>ขยายร้านและเริ่มใหม่</summary><p>ก่อสร้าง → เลือกช่องขยายร้าน คลิกหรือลากเลือก แล้วกดซื้อ ช่องใหม่ต้องเชื่อมด้านข้างกับพื้นเดิม ภายในกริด 32 × 32 ช่อง ประตูและกำแพงเดิมอยู่ด้านหลังร้าน ราคาช่องถัดไป '+expandTileCost(floorArea())+' เหรียญ และแพงขึ้นเรื่อย ๆ ตามขนาดร้าน<br>ตั้งค่า → รีเซตร้าน ต้องยืนยัน 3 ครั้ง ล้างเฉพาะเซฟเกมนี้</p>';help.append(info);
})();
