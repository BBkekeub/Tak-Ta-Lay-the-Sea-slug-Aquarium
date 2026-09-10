/* One saved appointment per shop, independent of furniture ownership.
 * Race positions are head coordinates in centimetres; all entrants use stride().
 * The modal owns input, while the existing simulation continues separately.
 */
(()=>{
 'use strict';
 const MINUTE=60000, START=20, FINISH=180;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const gap=()=> (30+Math.random()*20)*MINUTE;
 const tank=()=>G.objs.find(o=>o.def.race&&o!==moving);
 const owned=()=>[...G.objs,...G.shelter].some(o=>o.def.race);
 const gene=(g,k)=>clamp(Number.isFinite(g[k])?g[k]:50,0,100)/100;
 function stride(g){
   // Length helps; large girth and large gills add drag. The cap is absolute.
   const length=6+8*gene(g,'len');
   const gills=(gillCount(g)-2)/7;
   const fraction=clamp(.12+.14*gene(g,'len')+.12*gene(g,'vigor')+.10*gills-.07*gene(g,'gillLen')-.06*gene(g,'girth'),.06,.4);
   return {length,step:length*fraction};
 }
 let state=G.racing;
 if(!state||!Number.isFinite(state.nextAt)||state.nextAt<0)state={purchased:false,nextAt:0,offer:null,active:null};
 G.racing=state;
 let visitors=[],modal=null,canvas=null,backdrop=null,raf=0,lastFrame=0,lastDraw=0,lastSave=0;
 let sprites=[],lastKey=null,countNode=null,resultNode=null,buttons=[];
 let resumeReady=false,offerDeadline=0;
 const names=['คลื่น','ฟอง','ปะการัง','น้ำวน','มุก','หาดทราย','ใบเรือ','เค็ม'];
 function purchased(){
   if(!state.purchased){state.purchased=true;state.nextAt=Date.now()+5*MINUTE;saveGame();}
 }
 function makeOffer(){
   const choices=names.slice().sort(()=>Math.random()-.5);
   return {rivals:[0,1].map(i=>({name:choices[i],genes:SlugEngine.randGene(),pace:2.5+Math.random()*2}))};
 }
 function leave(){
   for(const p of visitors){
     p.raceChallenger=false;p.family=null;p.tradeDone=true;p.visits=0;p.strolls=0;
     p.focus=null;p.route=[];p.routeGoal=null;p.tgt=doorSpot();p.state='leave';p.stuck=0;
   }
   visitors=[];offerDeadline=0;
 }
 function goal(p){
   const t=tank();
   if(!t||!state.offer){p.raceChallenger=false;p.visits=0;p.strolls=0;return false;}
   const spot=freeSpot(lookSpots(t),p);
   if(spot){p.focus=t;p.tgt=spot;p.state='walk';p.route=[];p.routeGoal=null;p.stuck=0;return true;}
   p.focus=null;p.tgt=strollSpot(p);p.state='walk';return true;
 }
 function spawn(){
   if(visitors.length||!peopleOn||!tank()||document.hidden||tankMode||window.BOOTING)return;
   const capacity=visitorCapacity()-PEOPLE.length;
   if(capacity<2)return;
   const previous=new Set(PEOPLE);
   if(!spawnVisitors(capacity,'race',[{kid:false,gender:Math.random()<.5?'female':'male'},{kid:false,gender:Math.random()<.5?'female':'male'}]))return;
   visitors=PEOPLE.filter(p=>!previous.has(p));
   if(!state.offer){state.offer=makeOffer();state.nextAt=Date.now()+gap();saveGame();}
   visitors.forEach((p,i)=>{
     p.family=null;p.raceChallenger=true;p.wantsBuy=false;p.wantsSell=false;p.tradeDone=true;
     p.carryTank=true;p.carryColor='#267b86';p.carryAccent=slugBaseHex(state.offer.rivals[i].genes);
     p.bagged=false;p.accessory='none';p.visits=1;p.strolls=0;goal(p);
   });
   offerDeadline=Date.now()+5*MINUTE;
   toast('🏁 ผู้ท้าสองคนมาถึงแล้ว! คลิกคนถือตู้เพื่อแข่งทาก','good');
 }
 function dismiss(){state.offer=null;leave();close();saveGame();}
 function tick(){
   if(owned())purchased();
   if(state.active){
     if(resumeReady&&!modal&&!window.BOOTING)openRace();
     return;
   }
   if(!tank()){
     if(state.offer){state.offer=null;leave();if(modal)close();saveGame();}
     return;
   }
   if(visitors.length&&!visitors.every(p=>PEOPLE.includes(p))){leave();}
   if(offerDeadline&&Date.now()>offerDeadline&&!modal){dismiss();return;}
   if(state.purchased&&Date.now()>=state.nextAt||state.offer)spawn();
 }
 function element(tag,text,parent){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(parent)parent.append(e);return e;}
 function dialog(title){
   modal=element('dialog');modal.className='slug-race-dialog';modal.setAttribute('aria-label',title);
   modal.addEventListener('cancel',e=>{e.preventDefault();if(!state.active)dismiss();});
   element('h2',title,modal);document.body.append(modal);modal.showModal();return modal;
 }
 function close(){
   cancelAnimationFrame(raf);raf=0;modal?.close();modal?.remove();modal=null;canvas=null;backdrop=null;
   sprites=[];buttons=[];lastFrame=0;lastDraw=0;lastKey=null;
 }
 function ask(){
   if(modal||!state.offer||!tank()||state.active)return;
   const d=dialog('🏁 มาแข่งทากกันไหม?'),t=tank();
   element('p',state.offer.rivals.map(r=>r.name).join(' และ ')+' ขอท้าประลอง ระยะทาง 160 ซม.',d);
   element('p','ที่ 1 ได้เพิ่ม 2 เท่าของเดิมพัน · ที่ 2 เงินเท่าเดิม · ที่ 3 เสียตามเดิมพัน',d);
   const label=element('label','เลือกทากในตู้แข่ง',d),select=element('select',null,label);
   for(const s of t.slugs){const op=element('option',slugNick(s)+' · '+s.id,select);op.value=s.id;}
   const betLabel=element('label','เดิมพัน (ทอง) — ยังไม่หักตอนเริ่ม',d),bet=element('input',null,betLabel);
   bet.type='number';bet.min='0';bet.max=String(Math.min(1000,Math.floor(G.coin)));bet.step='1';bet.value='0';
   element('p','เดิมพันได้ 0–'+bet.max+' ทอง • กด A / D สลับกัน หรือแตะปุ่มซ้าย / ขวา',d);
   const error=element('p','',d);error.setAttribute('role','alert');
   const start=element('button','เริ่มแข่ง',d);start.className='tbtn';start.disabled=!t.slugs.length;
   if(!t.slugs.length)error.textContent='ยังไม่มีทากในตู้แข่ง ย้ายทากเข้าตู้ก่อนรับคำท้า';
   start.onclick=()=>{
     const wager=Number(bet.value),s=t.slugs.find(x=>x.id===select.value);
     if(!s||!G.objs.includes(t)||!Number.isInteger(wager)||wager<0||wager>Math.min(1000,G.coin)){
       error.textContent='เลือกทากในตู้ และใส่เดิมพันเป็นจำนวนเต็มไม่เกิน 1,000 หรือทองที่มี';return;
     }
     const entrants=[{name:slugNick(s),genes:{...foodGenes(s)},id:s.id},...state.offer.rivals];
     state.active={tankId:t.id,wager,elapsed:0,countdown:3,lastKey:null,settled:false,rank:0,
       entrants:entrants.map((r,i)=>({...r,...stride(r.genes),head:START,finished:null,next:i?1/r.pace:0}))};
     // Clear the track before the countdown; normal slugs stay behind 40 cm.
     t.slugs.filter(x=>x!==s).forEach(x=>{x.fy=Math.max(8+slugCm(x.genes)/CM_PER_CELL*.55,x.fy);x.wall=null;x.climbZ=0;});
     saveGame();close();openRace();
   };
   const no=element('button','ไม่แข่ง ให้ผู้ท้ากลับ',d);no.className='tbtn';no.onclick=dismiss;
   const later=element('button','กลับไปเตรียมทาก',d);later.className='tbtn';later.onclick=close;
 }
 function drawTrack(c,project){
   c.save();c.lineWidth=1.5;c.strokeStyle='#faf1d7';
   for(const y of [2,4,6,8]){const a=project(0,y),b=project(40,y);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
   for(const x of [4,36]){const a=project(x,2),b=project(x,8);c.strokeStyle=x===4?'#45a879':'#272f39';c.lineWidth=3;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
   c.restore();
 }
 function drawChallengers(){
   if(!state.offer)return;
   ctx.save();ctx.font='bold 13px sans-serif';ctx.textAlign='center';
   visitors.forEach(p=>{if(!personOnScreen(p))return;const b=personScreenBounds(p);const x=clamp((b.x0+b.x1)/2,64,CW-64),y=clamp(b.y0-8,26,CH-12);
     ctx.fillStyle='#123e48';ctx.fillRect(x-62,y-20,124,28);ctx.fillStyle='#ffe18a';ctx.fillText('🏁 คลิกเพื่อแข่ง',x,y);
     p._raceHit={x0:x-62,x1:x+62,y0:y-20,y1:y+8};
   });ctx.restore();
 }
 function hit(e){
   if(tankMode||modal||!state.offer)return false;
   const {sx,sy}=screenXY(e);
   return visitors.some(p=>{const b=personScreenBounds(p),h=p._raceHit;return personOnScreen(p)&&
     ((sx>=b.x0&&sx<=b.x1&&sy>=b.y0&&sy<=b.y1)||(h&&sx>=h.x0&&sx<=h.x1&&sy>=h.y0&&sy<=h.y1));});
 }
 let pressedVisitor=false;
 cv.addEventListener('pointerdown',e=>{if(hit(e)){pressedVisitor=true;e.preventDefault();e.stopImmediatePropagation();}},true);
 cv.addEventListener('pointerup',e=>{if(pressedVisitor){pressedVisitor=false;e.preventDefault();e.stopImmediatePropagation();if(hit(e))ask();}},true);
 cv.addEventListener('pointercancel',()=>{pressedVisitor=false;},true);
 function finish(r,time){if(r.head>=FINISH&&r.finished===null){r.head=FINISH;r.finished=time;}}
 function advance(dt){
   const a=state.active;if(!a||a.settled)return;
   if(a.countdown>0){a.countdown=Math.max(0,a.countdown-dt);return;}
   a.elapsed+=dt;
   for(let i=1;i<3;i++){
     const r=a.entrants[i];
     while(r.finished===null&&r.next<=a.elapsed){r.head+=r.step;finish(r,r.next);r.next+=1/r.pace;}
   }
   if(a.entrants.every(r=>r.finished!==null))settle();
   // Once both opponents finish, the player's last place is certain.
   else if(a.entrants[1].finished!==null&&a.entrants[2].finished!==null&&a.entrants[0].finished===null){
     a.entrants[0].finished=Infinity;settle();
   }
 }
 function press(key){
   const a=state.active;if(!a||a.settled||a.countdown>0||document.hidden||lastKey===key||a.entrants[0].finished!==null)return;
   lastKey=key;a.lastKey=key;const r=a.entrants[0];r.head+=r.step;finish(r,a.elapsed);
   buttons.forEach((b,i)=>{b.classList.toggle('next',(key==='a'?1:0)===i);});
   const b=buttons[key==='a'?0:1];b?.animate([{transform:'scale(.9)',background:'#f4cc68'},{transform:'scale(1)',background:'#296875'}],{duration:150});
   if(r.finished!==null)settle();
 }
 function settle(){
   const a=state.active;if(!a||a.settled)return;
   a.rank=1+a.entrants.slice(1).filter(r=>r.finished!==null&&r.finished<=a.entrants[0].finished).length;
   a.delta=a.rank===1?a.wager*2:a.rank===3?-a.wager:0;
   G.coin+=a.delta;a.settled=true;saveGame();syncHUD();showResult();
 }
 function showResult(){
   const a=state.active;if(!a?.settled||!resultNode)return;
   countNode.textContent='จบการแข่งขัน';buttons.forEach(b=>b.disabled=true);
   resultNode.replaceChildren();
   element('h3','คุณเข้าอันดับที่ '+a.rank+' · '+(a.delta>0?'+':'')+a.delta.toLocaleString()+' ทอง',resultNode);
   const list=element('ul',null,resultNode);
   [a.entrants[1],a.entrants[2],a.entrants[0]].sort((x,y)=>(x.finished??Infinity)-(y.finished??Infinity)).forEach(r=>element('li',r.name+' — '+(Number.isFinite(r.finished)?r.finished.toFixed(2)+' วินาที':'ยังไม่เข้าเส้นชัย'),list));
   element('p',a.rank===1?'ผู้ท้า: ฝากไว้ก่อนเถอะ! คราวหน้าจะเอาคืนให้ได้!':a.rank===2?'ผู้ท้า: ไว้เจอกันใหม่อีกครั้ง!':'ผู้ท้า: ฮ่า ๆ! ฝึกมาอีกหน่อย ยังตามพวกเราไม่ทันหรอก!',resultNode);
   const done=element('button','กลับร้าน',resultNode);done.className='tbtn';done.onclick=()=>{state.active=null;state.offer=null;leave();close();saveGame();};
 }
 function buildBackdrop(t){
   backdrop=document.createElement('canvas');backdrop.width=1000;backdrop.height=500;const c=backdrop.getContext('2d');
   c.fillStyle='#183f47';c.fillRect(0,0,1000,500);c.fillStyle='#c6b787';c.fillRect(0,300,1000,200);
   c.fillStyle='#99c1b4';c.font='16px sans-serif';c.fillText('พื้นที่เลี้ยงทั่วไป 200 × 60 ซม.',20,30);
   drawTrack(c,(x,y)=>({x:x*25,y:500-y*25}));
   c.fillStyle='#1c4546';c.font='bold 14px sans-serif';c.fillText('เริ่ม 20 ซม.',65,482);c.fillText('เส้นชัย 180 ซม.',845,482);
   for(const f of t?.foods||[]){const im=FOOD_IMAGES[f.type],w=Math.max(14,f.spec.cap*1.65)*5;if(im?.complete&&im.naturalWidth)c.drawImage(im,f.fx*25-w/2,500-f.fy*25-w*.5,w,w);}
   for(const d of t?.decor||[]){const info=TANK_DECOR[d.key],im=decorImg(d.key);if(!im.ok)continue;const w=info.wCm*5,h=w*im.img.naturalHeight/im.img.naturalWidth;c.save();c.translate(d.fx*25,500-d.fy*25);if(d.flip&1)c.scale(-1,1);c.drawImage(im.img,-w/2,-h/2,w,h);c.restore();}
 }
 function drawSprite(c,s,x,y,length,pulse=0,head=false){
   const sp=slugSprite(s),parts=slugPartsOf(s);if(!sp||!parts)return;
   const scale=length*5/(parts.bw*parts.s),w=sp.w*scale,h=sp.h*scale;
   c.save();c.translate(x,y);c.scale(1+Math.sin(pulse)*.035,1-Math.sin(pulse)*.035);
   if(head){
     // Native art faces left. Mirror around the body head, not the sprite box;
     // gills/aura change its bounds, and must not move the measured start point.
     const headPixel=sp.w/2-(parts.L+parts.R)*parts.s/2;
     c.scale(-1,1);c.drawImage(sp.c,-headPixel*scale,-h/2,w,h);
   }else c.drawImage(sp.c,-w/2,-h/2,w,h);
   c.restore();
 }
 function render(){
   if(!canvas||document.hidden)return;
   const a=state.active,c=canvas.getContext('2d');c.drawImage(backdrop,0,0);
   const t=G.objs.find(o=>o.id===a.tankId);
   c.save();c.beginPath();c.rect(0,0,1000,300);c.clip();
   for(const s of t?.slugs||[]){if(s.id===a.entrants[0].id)continue;drawSprite(c,s,s.fx*25,500-s.fy*25,slugCm(s.genes));}
   c.restore();
   a.entrants.forEach((r,i)=>{
     const y=425-i*50;drawSprite(c,sprites[i],r.head*5,y,r.length,r.finished===null?a.elapsed*12:0,true);
     c.fillStyle=i===0?'#114f60':'#52482f';c.font='bold 12px sans-serif';c.fillText((i===0?'คุณ · ':'')+r.name,6,y-14);
   });
   if(!a.settled)countNode.textContent=a.countdown>0?String(Math.ceil(a.countdown)):a.elapsed<.7?'ไป!':'กดสลับ '+(lastKey==='a'?'D / ขวา':lastKey==='d'?'A / ซ้าย':'A / D');
 }
 function simulateRear(dt){
   const a=state.active,t=G.objs.find(o=>o.id===a.tankId);if(!t)return;
   const rest=t.slugs.filter(s=>s.id!==a.entrants[0].id);
   stepTankSlugs(rest,t.def.w,t.def.h,dt,true,t.decor,t.def);
   for(const s of rest){const min=8+slugCm(s.genes)/CM_PER_CELL*.55;if(s.fy<min){s.fy=min;s.dir=Math.abs(s.dir);s.state='rest';s.stt=1;}s.wall=null;s.climbZ=0;}
 }
 function frame(now){
   if(!modal||!state.active)return;
   const dt=Math.min(.05,(now-(lastFrame||now))/1000);lastFrame=now;
   if(!document.hidden){advance(dt);if(now-lastDraw>=1000/30){render();lastDraw=now;}}
   if(now-lastSave>1000){saveGame();lastSave=now;}
   raf=requestAnimationFrame(frame);
 }
 function openRace(){
   const a=state.active;if(!a||modal)return;
   spawn();
   const d=dialog('🏁 สนามแข่งทากทะเล');d.classList.add('racing');
   countNode=element('div','3',d);countNode.className='race-count';countNode.setAttribute('role','status');
   canvas=element('canvas',null,d);canvas.width=1000;canvas.height=500;canvas.setAttribute('aria-label','สนามสามเลน ทากทั่วไปอยู่ด้านหลังแยกจากผู้แข่ง');
   const controls=element('div',null,d);controls.className='race-controls';
   for(const [key,label] of [['a','A · ซ้าย'],['d','D · ขวา']]){
     const b=element('button',label,controls);b.type='button';b.setAttribute('aria-label','กระดึ๊บฝั่ง'+(key==='a'?'ซ้าย':'ขวา'));
     b.onpointerdown=e=>{e.preventDefault();press(key);};b.onclick=e=>{if(e.detail===0)press(key);};buttons.push(b);
   }
   element('p','กดสลับสองฝั่ง กดค้างหรือกดซ้ำฝั่งเดิมไม่ขยับ • เดิมพัน '+a.wager+' ทอง',d);
   resultNode=element('section',null,d);resultNode.setAttribute('aria-live','polite');
   sprites=a.entrants.map(r=>({genes:r.genes}));lastKey=a.lastKey;
   buildBackdrop(G.objs.find(o=>o.id===a.tankId));render();if(a.settled)showResult();raf=requestAnimationFrame(frame);
 }
 window.addEventListener('keydown',e=>{
   if(!modal?.open)return;
   if(state.active){e.stopImmediatePropagation();if(['KeyA','KeyD','Space','Escape'].includes(e.code))e.preventDefault();if(!e.repeat&&(e.code==='KeyA'||e.code==='KeyD'))press(e.code==='KeyA'?'a':'d');}
 },true);
 document.addEventListener('visibilitychange',()=>{lastFrame=0;saveGame();});
 window.SlugRace={purchased,goal,drawTrack,drawChallengers,isOpen:()=>!!modal?.open,stride};
 // Settled races retain their receipt; unfinished races resume, never reroll.
 if(state.active?.entrants?.length===3){
   state.active.entrants.forEach(r=>{if(r.finished===null&&state.active.settled)r.finished=Infinity;});
 }else state.active=null;
 if(owned())purchased();
 // Keep gameplay independent of the hidden shop renderer, at a bounded 20 Hz.
 setInterval(()=>{
   if((!modal?.open&&!document.hidden)||window.BOOTING||!engineReady)return;
   stepPeople();
   for(const t of G.objs){
     if(t.type!=='tank'||!t.slugs.length)continue;
     if(state.active&&t.id===state.active.tankId)simulateRear(.05);
     else stepTankSlugs(t.slugs,t.def.w,t.def.h,.05,true,t.decor,t.def);
   }
 },50);
 resumeReady=true;setInterval(tick,1000);
})();
