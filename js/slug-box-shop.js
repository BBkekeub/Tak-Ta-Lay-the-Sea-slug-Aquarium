/* กล่องสุ่มทาก — สั่งผ่าน "คอมพิวเตอร์ร้าน" บนเคาน์เตอร์ แล้วรอส่งเป็นกล่องของขวัญ
   - จำกัดด้วยสต็อก: เข้า 1 กล่อง/ชม. ค้างได้ SLUG_BOX_MAX (config.js)
   - สั่งแล้วหน่วง SLUG_DELIVERY_MS (~1 นาที เวลาจริง) ค่อยมาถึง
   - ของถึง = กล่องของขวัญโผล่บนเคาน์เตอร์ + ไฟเตือนที่คอม · คลิกกล่องเพื่อเปิด → ทากเข้าคลัง
   - ยีนถูกสุ่มตอน "สั่ง" (ล็อกไว้) เปิดกล่องแค่รับตัวจริงเข้าคลัง
   ค่าปรับ: SLUG_BOX_REFILL_MS · SLUG_BOX_MAX · SLUG_DELIVERY_MS (config.js) */
const SLUG_BOXES=[{name:'ปกติ',price:800,lo:40,hi:60,colorLo:150,colorHi:250},{name:'กลาง',price:1800,lo:30,hi:70,colorLo:100,colorHi:300},{name:'แพง',price:3000,lo:20,hi:80,colorLo:50,colorHi:350},{name:'แพงสุด',price:5000,lo:20,hi:80,colorLo:0,colorHi:400}];

function slugBoxStock(now=Date.now()){
 const s=G.boxStock&&Number.isFinite(G.boxStock.n)&&Number.isFinite(G.boxStock.at)?G.boxStock:(G.boxStock={n:SLUG_BOX_MAX,at:now});
 if(s.n>=SLUG_BOX_MAX){s.n=SLUG_BOX_MAX;s.at=now;return s;}
 const gained=Math.floor(Math.max(0,now-s.at)/SLUG_BOX_REFILL_MS);
 if(gained>0){s.n=Math.min(SLUG_BOX_MAX,s.n+gained);s.at=s.n>=SLUG_BOX_MAX?now:s.at+gained*SLUG_BOX_REFILL_MS;}
 return s;
}
function slugBoxWait(now=Date.now()){const s=slugBoxStock(now);return s.n>=SLUG_BOX_MAX?0:Math.max(0,s.at+SLUG_BOX_REFILL_MS-now);}
function slugBoxWaitText(){const ms=slugBoxWait();if(!ms)return 'สต็อกเต็ม';const m=Math.ceil(ms/60000);return m>=60?'อีก '+Math.floor(m/60)+' ชม. '+(m%60)+' นาที':'อีก '+m+' นาที';}

/* ---- พัสดุที่กำลังส่ง / ถึงแล้ว ---- */
function slugDeliveries(){return G.slugDeliveries ||= [];}

/* ---- แจกของฟรี "ครั้งเดียวตลอดกาล" ----
   ทุกจุดที่แจกทาก/กล่อง/เงินฟรี (ของขวัญต้อนรับ · จดหมายคู่แข่ง · รางวัลเควส) ต้องผ่านตรงนี้
   เดิมต่างคนต่างใช้ธงของตัวเอง (welcomeGiftDone · rivalDeathMailSent · questCompleted)
   ธงไหนหายหรือถูกเขียนทับ (เช่นตอนย้ายลำดับเควส) ของชิ้นนั้นก็ถูกแจกใหม่ทุกครั้งที่เข้าเกม
   สมุด G.granted เป็นชั้นสุดท้าย: คีย์ไหนติดแล้วติดตลอด ไม่มีใครลบ และเข้าเซฟด้วย
   ชั้นสำรอง: ถ้าสมุดหาย แต่พัสดุไอดีเดิมยังค้างอยู่ในคิว ก็ถือว่าแจกไปแล้ว
   (ไอดีพัสดุจึงต้องคงที่ ห้ามใช้ Date.now() ต่อท้าย) */
function grantOnce(key,fn){
 G.granted ||= {};
 if(G.granted[key]) return false;
 if(slugDeliveries().some(d=>d&&typeof d.id==='string'&&d.id.startsWith(key))){G.granted[key]=true;return false;}
 G.granted[key]=true;
 try{ fn(key); }catch(e){ console.warn('[grantOnce] '+key,e); }
 if(typeof saveGame==='function') saveGame();
 return true;
}
function slugDeliveryReady(d){return Date.now()>=d.readyAt;}
function slugDeliveryReadyCount(){return slugDeliveries().filter(slugDeliveryReady).length;}
function slugDeliveryWaitText(d){const ms=d.readyAt-Date.now();if(ms<=0)return 'ถึงแล้ว — เปิดได้';const s=Math.ceil(ms/1000);return 'ส่งถึงในอีก '+s+' วินาที';}
function rollBoxGenes(box){const g={};for(const gene of SlugEngine.GENES){const color=gene.k==='mainC'||gene.k==='accC',t=color?(1-Math.cos(Math.PI*Math.random()))/2:Math.random();g[gene.k]=Math.round((color?box.colorLo:box.lo)+t*((color?box.colorHi:box.hi)-(color?box.colorLo:box.lo)));}return g;}

function orderSlugBox(i){
 const box=SLUG_BOXES[i];if(!box)return false;
 const s=slugBoxStock();
 if(s.n<1){toast('กล่องหมดสต็อก · '+slugBoxWaitText(),'bad');return false;}
 if(G.coin<box.price){toast('เหรียญไม่พอ','bad');return false;}
 if(s.n>=SLUG_BOX_MAX)s.at=Date.now();
 s.n-=1;G.coin-=box.price;
 slugDeliveries().push({id:'d'+Date.now()+'_'+Math.floor(Math.random()*10000),boxIndex:i,name:box.name,readyAt:Date.now()+SLUG_DELIVERY_MS,genes:rollBoxGenes(box),alerted:false});
 if(typeof saveGame==='function')saveGame();if(typeof syncHUD==='function')syncHUD();
 toast('สั่งกล่อง'+box.name+' · จะส่งถึงเคาน์เตอร์ในอีก ~1 นาที','good');
 refreshSlugShop();return true;
}
function openSlugDelivery(id){
 const list=slugDeliveries(),idx=list.findIndex(d=>d.id===id);if(idx<0)return false;
 const d=list[idx];
 if(!slugDeliveryReady(d)){toast('พัสดุยังมาไม่ถึง · '+slugDeliveryWaitText(d),'bad');return false;}
 list.splice(idx,1);G.inv.push(makeSlug(d.genes));
 if(typeof saveGame==='function')saveGame();if(typeof syncHUD==='function')syncHUD();
 toast('เปิดกล่อง'+d.name+' · ทากอยู่ในคลังแล้ว','good');
 refreshSlugShop();return true;
}
function openNextReadyDelivery(){const d=slugDeliveries().find(slugDeliveryReady);if(d)return openSlugDelivery(d.id);openSlugShopDialog();return false;}

/* ---- ไดอะล็อกสั่งซื้อ (เปิดจากคอม หรือคลิกกล่องของขวัญ) ---- */
const slugShopDialog=document.createElement('dialog');slugShopDialog.id='slugShop';
slugShopDialog.style.cssText='width:min(640px,90vw);max-height:82vh;overflow:auto;padding:22px;background:#172b2e;color:#e5dcc4;border:1px solid #b59859;border-radius:14px;color-scheme:dark';
document.body.append(slugShopDialog);
function refreshSlugShop(){if(slugShopDialog.open)renderSlugShop();}
function renderSlugShop(){
 const s=slugBoxStock();
 const boxesHtml=SLUG_BOXES.map((b,i)=>'<section style="padding:12px 0;border-bottom:1px solid #ffffff22"><b>'+b.name+'</b> · สี '+b.colorLo+'–'+b.colorHi+' · ยีนอื่น '+b.lo+'–'+b.hi+'<br><button class="tbtn" data-order="'+i+'" '+(s.n<1||G.coin<b.price?'disabled':'')+'>สั่งซื้อ · '+b.price+' เหรียญ</button></section>').join('');
 const list=slugDeliveries();
 const delHtml=list.length?list.map(d=>'<div style="padding:10px;margin:6px 0;border:1px solid #526663;border-radius:8px">📦 กล่อง'+d.name+' · '+(slugDeliveryReady(d)?'<b>ถึงแล้ว</b>':slugDeliveryWaitText(d))+'<br><button class="tbtn" data-open="'+d.id+'" '+(slugDeliveryReady(d)?'':'disabled')+'>เปิดกล่อง</button></div>').join(''):'<p style="font-size:12px">ยังไม่มีพัสดุกำลังส่ง</p>';
 slugShopDialog.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><b>สั่งซื้อกล่องสุ่มทาก</b><button class="tbtn" data-close>✕</button></div>'
  +'<p style="font-size:12px">สต็อกร้าน <b>'+s.n+' / '+SLUG_BOX_MAX+'</b> กล่อง · เข้าใหม่ชั่วโมงละ 1 · '+slugBoxWaitText()+'<br>สั่งแล้วส่งถึงเคาน์เตอร์ในอีก ~1 นาที มาเป็นกล่องของขวัญให้กดเปิด</p>'
  +boxesHtml+'<h3 style="margin-top:16px">พัสดุ</h3>'+delHtml;
 slugShopDialog.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>orderSlugBox(+b.dataset.order));
 slugShopDialog.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openSlugDelivery(b.dataset.open));
 slugShopDialog.querySelector('[data-close]').onclick=()=>slugShopDialog.close();
}
function openSlugShopDialog(){renderSlugShop();if(!slugShopDialog.open)slugShopDialog.showModal();}
slugShopDialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();slugShopDialog.close();}},true);

/* ---- กล่องของขวัญบนเคาน์เตอร์ (วาดเมื่อมีพัสดุถึงแล้ว) — เรียกจาก drawTradeCounter ใน cat-seller.js ---- */
function drawGiftBoxProp(o){
 o._giftHit=null;
 if(!slugDeliveryReadyCount())return;
 const base=14*ZUNIT,bodyH=3.0*ZUNIT;
 const b=counterBlock(o,10.4,6.2,3.4,3.4);isoBox(b.x,b.y,b.w,b.h,base,bodyH,'#cf5a71','#7f2f43','#a53e56');
 const lid=counterBlock(o,10.0,5.8,4.2,4.2);isoBox(lid.x,lid.y,lid.w,lid.h,base+bodyH,0.7*ZUNIT,'#e06a80','#8a3448','#b8485f');
 const rbV=counterBlock(o,11.75,5.8,0.9,4.2);isoBox(rbV.x,rbV.y,rbV.w,rbV.h,base,bodyH+0.72*ZUNIT,'#f1da8b','#b89a4e','#d6bd6c');
 const rbH=counterBlock(o,10.0,7.55,4.2,0.9);isoBox(rbH.x,rbH.y,rbH.w,rbH.h,base,bodyH+0.72*ZUNIT,'#f1da8b','#b89a4e','#d6bd6c');
 const pts=[];for(const x of [10.0,14.2])for(const y of [5.8,10.0])for(const z of [14,17.72]){const q=counterLocal(o.def,o.rot,x,y);pts.push(P(o.cx+q[0],o.cy+q[1],z*ZUNIT));}
 o._giftHit={x:Math.min(...pts.map(p=>p.x))-8,y:Math.min(...pts.map(p=>p.y))-8,right:Math.max(...pts.map(p=>p.x))+8,bottom:Math.max(...pts.map(p=>p.y))+8};
 const q=counterLocal(o.def,o.rot,12.1,7.5),p=P(o.cx+q[0],o.cy+q[1],19*ZUNIT),pulse=Math.sin(performance.now()/260);
 ctx.save();ctx.translate(p.x,p.y-3*pulse);ctx.fillStyle='#f1c66d';ctx.beginPath();ctx.arc(0,0,Math.max(12,17*cam.zoom),0,Math.PI*2);ctx.fill();ctx.fillStyle='#56352a';ctx.font='bold '+Math.max(14,20*cam.zoom)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('!',0,1);ctx.restore();
}

/* ---- คลิกกล่องของขวัญที่เคาน์เตอร์เพื่อเปิด ---- */
let giftPointer=null;
cv.addEventListener('pointerdown',e=>{giftPointer={x:e.clientX,y:e.clientY};},true);
cv.addEventListener('pointerup',e=>{
 if(typeof appMode!=='undefined'&&appMode!=='view'){giftPointer=null;return;}
 const down=giftPointer;giftPointer=null;if(!down)return;
 if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;
 const {sx,sy}=screenXY(e);
 const o=[...G.objs].reverse().find(o=>o._key==='counter'&&o!==moving&&o._giftHit&&sx>=o._giftHit.x&&sx<=o._giftHit.right&&sy>=o._giftHit.y&&sy<=o._giftHit.bottom);
 if(o){dragging=false;cv.classList.remove('panning','placing');e.stopImmediatePropagation();openNextReadyDelivery();}
},true);

/* ---- แจ้งเตือนตอนพัสดุถึง + อัปเดตนับถอยหลังในไดอะล็อก ---- */
setInterval(()=>{
 let changed=false;
 for(const d of slugDeliveries())if(!d.alerted&&slugDeliveryReady(d)){d.alerted=true;changed=true;if(typeof toast==='function')toast('📦 พัสดุกล่อง'+d.name+' ถึงแล้ว! คลิกกล่องของขวัญที่เคาน์เตอร์เพื่อเปิด','good');}
 if(changed){if(typeof saveGame==='function')saveGame();if(typeof syncHUD==='function')syncHUD();}
 if(slugShopDialog.open)renderSlugShop();
},1000);
