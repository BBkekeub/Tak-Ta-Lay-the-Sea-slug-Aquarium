/* Offers are temporary; only accepted sales alter the saved collection. */
const TRADE_GENES={bodyDepth:'ร่องสีตัว',gillDepth:'ร่องสีหงอน',girth:'ขนาดตัว',len:'ความยาว',gillLen:'ความยาวเหงือก',tentLen:'ความยาวหนวด',vigor:'ความแข็งแรง'};
const TRADE_OFFERS=[];
const BASE_SELL=100; // ราคาพื้นฐานทากที่ไม่ตรงยีนผู้ซื้อ (ขายได้ทุกตัว)
function totalShopSlugs(){let n=(G.inv||[]).length;for(const o of [...(G.objs||[]),...(G.shelter||[])])if(o.type==='tank')n+=(o.slugs||[]).length;return n;}
let tradeSeq=0,tradeHudTime=0;
function tradeConditionPrice(a,b){return Math.round(Math.max(100,1000/(1+Math.abs(b-a)/5)));}
function makeBuyerPreferences(){
  const keys=Object.keys(TRADE_GENES),out=[];
  const n=1+Math.floor(Math.random()*3);
  for(let i=0;i<n;i++){
    const key=keys.splice(Math.floor(Math.random()*keys.length),1)[0];
    const width=[0,5,10,20,35,50,70][Math.floor(Math.random()*7)];
    const lo=Math.floor(Math.random()*(101-width));out.push({key,lo,hi:lo+width});
  }
  return out;
}
function priceSlugOffer(slug,conditions){
  const matched=conditions.filter(c=>Number.isFinite(slug.genes[c.key])&&slug.genes[c.key]>=Math.min(c.lo,c.hi)&&slug.genes[c.key]<=Math.max(c.lo,c.hi));
  return {matched,price:matched.reduce((sum,c)=>sum+tradeConditionPrice(c.lo,c.hi),0)};
}
function counterFront(c){
  const g=PERSON_R+2;
  // Independent of the seller renderer: routing can run during save loading.
  switch(c.rot&3){
    case 1:return {x:c.cx-g,y:c.cy+5};
    case 2:return {x:c.cx+c.def.w-5,y:c.cy-g};
    case 3:return {x:c.cx+c.def.h+g,y:c.cy+c.def.w-5};
    default:return {x:c.cx+5,y:c.cy+c.def.h+g};
  }
}
function tryCustomerOffer(p,tank){
  if(!p.wantsBuy||p.tradeDone||p.tradeOffer||!tank||tank.type!=='tank')return false;
  p.preferences ||= makeBuyerPreferences();
  let best=null;
  for(const slug of tank.slugs){
    if(TRADE_OFFERS.some(o=>o.slug===slug))continue;
    const bid=priceSlugOffer(slug,p.preferences);
    if(bid.price&&(!best||bid.price>best.price))best={slug,...bid};
  }
  if(!best){const free=tank.slugs.find(s=>!TRADE_OFFERS.some(o=>o.slug===s));if(!free)return false;best={slug:free,matched:[],price:BASE_SELL};}
  for(const counter of G.objs.filter(c=>c._key==='counter'&&c!==moving)){
    if(TRADE_OFFERS.some(o=>o.counter===counter))continue;
    const target=freeSpot([counterFront(counter)],p);if(!target)continue;
    const route=personRoute(p,target);if(!route.length)continue;
    const offer={id:++tradeSeq,p,tank,counter,...best,arrived:false,age:0,cx:counter.cx,cy:counter.cy,rot:counter.rot};
    TRADE_OFFERS.push(offer);p.tradeOffer=offer;p.tradeDone=true;
    p.focus=null;p.tgt=target;p.route=route;p.routeGoal=target;p.state='walk';p.stuck=0;p.t=0;
    renderTradeOffers();return true;
  }
  return false;
}
function finishTrade(id,accept=false){
  const o=TRADE_OFFERS.find(o=>o.id===id);if(!o)return;
  if(accept){
    if(!o.arrived||!PEOPLE.includes(o.p)||!G.objs.includes(o.counter)||o.counter===moving||o.cx!==o.counter.cx||o.cy!==o.counter.cy||o.rot!==o.counter.rot||!G.objs.includes(o.tank)||!o.tank.slugs.includes(o.slug)){finishTrade(id);return;}
    if(typeof heldSlug!=='undefined'&&heldSlug===o.slug){toast('วางทากกลับตู้ก่อน');return;}
    if(totalShopSlugs()<=2){toast('ต้องเหลือทากในร้านอย่างน้อย 2 ตัว จึงยังขายไม่ได้','bad');return;}
    const bid=priceSlugOffer(o.slug,o.p.preferences);
    const price=bid.price||BASE_SELL;
    if(price!==o.price){o.price=price;o.matched=bid.matched;renderTradeOffers(true);toast('ราคาเปลี่ยน กรุณาตรวจราคาก่อนยืนยัน','bad');return;}
    o.tank.slugs.splice(o.tank.slugs.indexOf(o.slug),1);G.coin+=o.price;if(G.stats)G.stats.sold=(G.stats.sold||0)+1;
    if(typeof selSlug!=='undefined'&&selSlug===o.slug)selSlug=null;
    toast('ขายทาก +'+o.price+' เหรียญ','good');
  }
  TRADE_OFFERS.splice(TRADE_OFFERS.indexOf(o),1);o.p.tradeOffer=null;
  if(o.p.family){o.p.family.visits--;planFamily(o.p.family);}
  else{o.p.visits--;o.p.strolls=0;nextGoal(o.p);}
  if(accept){syncHUD();if(typeof saveGame==='function')saveGame();}
  renderTradeOffers();
}
function stepTradeOffers(dt){
  for(const o of [...TRADE_OFFERS]){
    o.age+=dt;
    if(!PEOPLE.includes(o.p)||!G.objs.includes(o.tank)||!o.tank.slugs.includes(o.slug)||!G.objs.includes(o.counter)||o.counter===moving||o.cx!==o.counter.cx||o.cy!==o.counter.cy||o.rot!==o.counter.rot||o.age>90)finishTrade(o.id);
  }
  tradeHudTime+=dt;if(tradeHudTime>1){tradeHudTime=0;renderTradeOffers();}
}
function tradeEscape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function tradeAlternatives(o){
  const choices=[];
  for(const tank of G.objs){if(tank.type!=='tank'||tank===moving)continue;
    for(const slug of tank.slugs){
      if(TRADE_OFFERS.some(other=>other!==o&&other.slug===slug))continue;
      const bid=priceSlugOffer(slug,o.p.preferences);choices.push({tank,slug,matched:bid.matched,price:bid.price||BASE_SELL});
    }
  }return choices.sort((a,b)=>b.price-a.price);
}
function chooseTradeSlug(id,index){
  const o=TRADE_OFFERS.find(o=>o.id===id),choice=o?.choices?.[index];if(!o||!choice)return;
  if(!G.objs.includes(choice.tank)||!choice.tank.slugs.includes(choice.slug)||TRADE_OFFERS.some(q=>q!==o&&q.slug===choice.slug)){toast('ทากตัวนี้ไม่พร้อมขายแล้ว','bad');renderTradeOffers(true);return;}
  const bid=priceSlugOffer(choice.slug,o.p.preferences);
  o.requestedId ||= o.slug.id;
  o.slug=choice.slug;o.tank=choice.tank;o.price=bid.price||BASE_SELL;o.matched=bid.matched;
  renderTradeOffers(true);
}
function inspectTradeSlug(id){
  const o=TRADE_OFFERS.find(o=>o.id===id);if(!o||!o.tank.slugs.includes(o.slug))return;
  enterTank(o.tank,{fx:o.slug.fx,fy:o.slug.fy});selSlug=o.slug;syncOv();
}
function renderTradeOffers(force=false){
  for(const offer of TRADE_OFFERS)notifyTradeArrival(offer);
  const el=document.getElementById('tradeOffers');if(!el)return;
  // Do not replace an open native picker during the one-second countdown update.
  if(!force&&el.contains(document.activeElement)&&document.activeElement.tagName==='SELECT')return;
  const html=TRADE_OFFERS.map(o=>{
    o.requestedId ||= o.slug.id;
    o.choices=tradeAlternatives(o);
    const name=tradeEscape(o.slug.id),tank=tradeEscape(o.tank.def.name+' '+o.tank.id);
    return `<div style="margin-top:10px;padding:10px;border:1px solid #796444;border-radius:8px">
      <b>${o.price.toLocaleString()} เหรียญ</b> · ${o.arrived?'รอคำตอบ':'กำลังเดินมา'}
      <div style="display:flex;align-items:center;gap:8px;margin:8px 0"><canvas data-trade-slug="${o.id}" width="120" height="80" style="width:100px;height:66px;background:#17262b;border-radius:6px"></canvas><div><b>ขายทาก ${name}</b><br><small>${tank}<br>ลูกค้าขอเดิม: ${tradeEscape(o.requestedId)}</small></div></div>
      <button class="tbtn" onclick="inspectTradeSlug(${o.id})">ดูทาก ${name} ในตู้</button>
      <label style="display:block;margin:8px 0;font-size:12px">เลือกตัวที่จะขายแทน (ทากในตู้หน้าร้าน)
      <select style="display:block;width:100%;margin-top:5px;background:#202025;color:#eadcc4;padding:6px" onchange="chooseTradeSlug(${o.id},Number(this.value))">
      ${o.choices.map((c,i)=>`<option value="${i}" ${c.slug===o.slug?'selected':''}>${tradeEscape(c.slug.id)} · ${tradeEscape(c.tank.id)} · ${c.price} เหรียญ · ตรง ${c.matched.length}/${o.p.preferences.length}</option>`).join('')}</select></label>
      <small>ตรง ${o.matched.length}/${o.p.preferences.length} เงื่อนไข<br>${o.p.preferences.map(c=>`${o.matched.includes(c)?'✓':'—'} ยีน${TRADE_GENES[c.key]} ${Math.min(c.lo,c.hi)}–${Math.max(c.lo,c.hi)}% · ตัวนี้ ${Number(o.slug.genes[c.key]).toFixed(1)}% (${tradeConditionPrice(c.lo,c.hi)} เหรียญ)`).join('<br>')}<br>แสดงเฉพาะตัวที่ลูกค้ารับซื้อและยังไม่มีข้อเสนออื่นจอง<br>ราคาจากยีนกำเนิด · รออีก ${Math.max(0,Math.ceil(90-o.age))} วินาที</small><br>
      <button class="tbtn" ${o.arrived?'':'disabled'} onclick="finishTrade(${o.id},true)">ขาย ${name} · ${o.price} เหรียญ</button> <button class="tbtn" onclick="finishTrade(${o.id})">ปฏิเสธ</button></div>`;
  }).join('')||'<p style="font-size:12px">ยังไม่มีข้อเสนอ · เว้นทางเดินหน้าเคาน์เตอร์อย่างน้อย 1 ช่องใหญ่</p>';
  if(el.innerHTML===html)return;
  el.innerHTML=html;
  for(const canvas of el.querySelectorAll('canvas[data-trade-slug]')){
    const o=TRADE_OFFERS.find(o=>o.id===Number(canvas.dataset.tradeSlug));if(!o)continue;
    const sprite=slugSprite(o.slug);if(!sprite)continue;
    const ratio=Math.min(112/sprite.c.width,72/sprite.c.height),w=sprite.c.width*ratio,h=sprite.c.height*ratio;
    canvas.getContext('2d').drawImage(sprite.c,(120-w)/2,(80-h)/2,w,h);
  }
}

function placeTradeCounter(){setMode('build');buyKey='counter';buyRot=0;setTool('place');buildShop();toast('เคาน์เตอร์แมวตัว L · 100×100 ซม. · หมุนได้เหมือนตู้ · เว้นทางด้านหน้า');}
function drawTradeCounter(o){
  const w=oW(o),h=oH(o),z=decoH(o);
  isoBox(o.cx,o.cy,w,h,0,z-0.6*ZUNIT,'#987553','#58412e','#715337');
  isoBox(o.cx,o.cy,w,h,z-0.6*ZUNIT,0.6*ZUNIT,'#dbcba7','#8f7956','#b8a17b');
  // All details stay inside the exact 2 by 1 large-cell footprint.
  const q=localToFloor(o.def,o.rot,5,5);
  isoBox(o.cx+q[0]-1.5,o.cy+q[1]-1.5,3,3,z,ZUNIT,'#5b7878','#283d40','#3b5152');
  const front=counterFront(o),p=P((front.x+o.cx+w/2)/2,(front.y+o.cy+h/2)/2,z*.6);
  ctx.save();ctx.font=`${Math.max(10,22*cam.zoom)}px sans-serif`;ctx.textAlign='center';ctx.fillStyle='#f3dfaa';ctx.fillText('เสนอราคา',p.x,p.y);ctx.restore();
}

// Short arrival chime. Reuse one audio context; allocate voices only on an event.
let tradeAudio=null;
function unlockTradeAudio(){
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  tradeAudio ||= new Audio();
  if(tradeAudio.state==='suspended')tradeAudio.resume().catch(()=>{});
 }catch(e){}
}
document.addEventListener('pointerdown',unlockTradeAudio,{passive:true});
document.addEventListener('keydown',unlockTradeAudio,{passive:true});
function notifyTradeArrival(offer){
 if(!offer.arrived||offer.soundNotified)return;
 offer.soundNotified=true;
 const volume=typeof bgm!=='undefined'?bgm.volume:.35;
 if(volume<=0||!tradeAudio||tradeAudio.state!=='running')return;
 const start=tradeAudio.currentTime;
 for(const [offset,hz] of [[0,784],[.13,1046.5]]){
  const voice=tradeAudio.createOscillator(),gain=tradeAudio.createGain(),at=start+offset;
  voice.type='sine';voice.frequency.value=hz;
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.22*volume,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+.32);
  voice.connect(gain);gain.connect(tradeAudio.destination);
  voice.onended=()=>{voice.disconnect();gain.disconnect();};voice.start(at);voice.stop(at+.34);
 }
}
