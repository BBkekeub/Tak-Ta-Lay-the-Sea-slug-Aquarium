/* One saved appointment per shop, independent of furniture ownership.
 * Race positions are head coordinates in centimetres; all entrants use stride().
 * Racing uses the existing tank camera/renderer; only prompts and results are modal.
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
 let visitors=[],modal=null,raceUI=null,lastFrame=0,lastSave=0,cameraKey='',raceProgress=null,burstAnimations=[],raceBottom=92,raceResize=null;
 let sprites=[],lastKey=null,countNode=null,buttons=[];
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
     if(resumeReady&&!modal&&!raceUI&&!window.BOOTING)openRace();
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
   for(const animation of burstAnimations)animation.cancel();burstAnimations=[];
   modal?.close();modal?.remove();modal=null;
   raceResize?.disconnect();raceResize=null;
   raceUI?.remove();raceUI=null;document.body.classList.remove('race-in-tank');
   sprites=[];buttons=[];lastFrame=0;lastKey=null;cameraKey='';
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
   const quad=(x0,y0,x1,y1,color)=>{const pts=[project(x0,y0),project(x1,y0),project(x1,y1),project(x0,y1)];c.fillStyle=color;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();};
   c.save();
   for(let i=0;i<3;i++)quad(0,2+i*2,40,4+i*2,['#c2d5bc','#e4cea1','#c4d6db'][i]);
   // Physical strips remain visible under water and retain width at every zoom.
   for(const y of [2,4,6,8])quad(0,y-.045,40,y+.045,'#244f56');
   quad(3.94,2,4.06,8,'#18684c');
   for(let row=0;row<12;row++)for(let col=0;col<2;col++)quad(35.8+col*.2,2+row*.5,36+col*.2,2+(row+1)*.5,(row+col)%2?'#f4ebd1':'#233b40');
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
 function complete(){
   state.active=null;state.offer=null;leave();close();exitTank();saveGame();
 }
 function resultFireworks(host){
   if(document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
   const layer=element('div',null,host);layer.className='race-result-fireworks';layer.setAttribute('aria-hidden','true');
   for(let burst=0;burst<3;burst++)for(let i=0;i<10;i++){
     const spark=element('i',null,layer),angle=i*Math.PI/5,reach=35+Math.random()*50;
     spark.style.left=(20+burst*30)+'%';spark.style.top=(burst===1?20:36)+'%';spark.style.background=['#efcd72','#85d5c5','#eaa3aa'][i%3];
     const animation=spark.animate([{transform:'translate(0,0) scale(.1)',opacity:0},{offset:.12,opacity:1},{transform:'translate('+Math.cos(angle)*reach+'px,'+(Math.sin(angle)*reach+25)+'px) scale(.2)',opacity:0}],{duration:950,delay:burst*110,fill:'both',easing:'ease-out'});
     burstAnimations.push(animation);
   }
   Promise.all(burstAnimations.map(a=>a.finished.catch(()=>{}))).then(()=>layer.remove());
 }
 function showResult(){
   const a=state.active;if(!a?.settled||modal)return;
   buttons.forEach(b=>b.disabled=true);
   const d=dialog('คุณได้อันดับที่ '+a.rank);d.id='raceResult';d.classList.add('race-result');
   d.addEventListener('cancel',e=>{e.preventDefault();complete();});
   element('p',a.rank===1?'ชนะการแข่งขัน!':a.rank===2?'เข้าเส้นชัยเป็นอันดับสอง':'เข้าเป็นอันดับสุดท้าย',d).className='race-result-caption';
   const podium=element('div',null,d);podium.className='race-podium';
   // Final order at the moment the player's placing is decided.
   const ordered=a.entrants.map((r,i)=>({r,i})).sort((x,y)=>((x.r.finished??Infinity)-(y.r.finished??Infinity))||(y.r.head-x.r.head)||(y.i-x.i));
   for(const place of [2,1,3]){
     const {r,i}=ordered[place-1],step=element('div',null,podium);step.className='race-podium-step place-'+place+(i===0?' is-player':'');
     element('span',i===0?'คุณ':r.name,step).className='race-podium-name';
     const c=element('canvas',null,step);c.width=180;c.height=110;c.setAttribute('aria-label',r.name);c.setAttribute('role','img');
     const sprite=slugSprite(sprites[i]||{genes:r.genes});if(sprite){const scale=Math.min(160/sprite.c.width,100/sprite.c.height),w=sprite.c.width*scale,h=sprite.c.height*scale;c.getContext('2d').drawImage(sprite.c,(180-w)/2,(110-h)/2,w,h);}
     const block=element('div',null,step);block.className='race-podium-block';element('span',['','🥇','🥈','🥉'][place],block).className='race-medal';element('b',String(place),block);
   }
   const receipt=element('div',null,d);receipt.className='race-receipt';
   element('span','เดิมพัน '+a.wager.toLocaleString()+' ทอง',receipt);
   element('strong',(a.delta>0?'ได้รับ +':a.delta<0?'เสีย ':'ไม่เสีย ไม่ได้เพิ่ม · ')+a.delta.toLocaleString()+' ทอง',receipt);
   element('small','ทองคงเหลือ '+G.coin.toLocaleString(),receipt);
   element('p',a.rank===1?'ผู้ท้า: ฝากไว้ก่อน! คราวหน้าจะเอาคืน!':a.rank===2?'ผู้ท้า: ไว้เจอกันใหม่อีกครั้ง!':'ผู้ท้า: ฮ่า ๆ! ฝึกมาอีกหน่อยนะ!',d).className='race-taunt';
   const done=element('button','รับทราบ · กลับร้าน',d);done.className='tbtn';done.onclick=complete;done.focus();resultFireworks(d);
 }
 function isRacing(t){return !!raceUI&&!!state.active&&(!t||t.id===state.active.tankId);}
 function normalSlugs(t){return t.slugs.filter(s=>s.id!==state.active.entrants[0].id);}
 function stepNormal(slugs,dt){
   const t=G.objs.find(o=>o.id===state.active.tankId);if(!t)return;
   stepTankSlugs(slugs,t.def.w,t.def.h,dt,true,t.decor,t.def);
   for(const s of slugs){const min=8+slugCm(s.genes)/CM_PER_CELL*.55;if(s.fy<min){s.fy=min;s.state='rest';s.stt=1;}s.wall=null;s.climbZ=0;}
 }
 function updateTankFrame(now){
   if(!isRacing(curTank)||document.hidden||!countNode||!raceUI.querySelector('.race-controls'))return;
   const dt=Math.min(.05,(now-(lastFrame||now))/1000);lastFrame=now;advance(dt);
   const a=state.active,r=a.entrants[0];
   a.entrants.forEach((r,i)=>{
     const s=sprites[i],old=s.viewHead??r.head;
     s.viewHead=r.finished!==null?r.head:old+(r.head-old)*(1-Math.exp(-dt*18));
     if(Math.abs(r.head-s.viewHead)<.002)s.viewHead=r.head;
     s.creepT=((s.viewHead-START)/(CREEP_BODY_PER_CYCLE*r.length))*Math.PI*2;
     s.state=a.countdown===0&&!a.settled&&Math.abs(s.viewHead-old)>.001?'walk':'rest';
   });
   const top=60,bottom=raceBottom,usable=Math.max(90,TCH-top-bottom);
   const key=TCW+'|'+TCH+'|'+bottom;
   if(cameraKey!==key){cameraKey=key;tankCam.zoom=Math.max(.25,Math.min(1.6,(TCW-32)/(CELLW*(TCW<600?12:18)+DEPX*6),usable/(DEPY*8+80)));}
   const desiredX=TCW*.46,desiredY=top+usable*.74,z=tankCam.zoom;
   tankCam.ox=desiredX-((sprites[0].viewHead/CM_PER_CELL-curTank.def.w/2)*CELLW+(3-curTank.def.h/2)*DEPX)*z;
   tankCam.oy=desiredY+(3-curTank.def.h/2)*DEPY*z+SAND_CELLS*ZH*z;tankNeedFit=false;
   const message=a.countdown>0?String(Math.ceil(a.countdown)):a.settled?'จบการแข่งขัน':lastKey?'กด '+(lastKey==='a'?'D / ขวา':'A / ซ้าย'):'เริ่ม! กด A / D สลับกัน';
   if(countNode.textContent!==message)countNode.textContent=message;
   const distance=Math.min(160,Math.max(0,r.head-START)).toFixed(0)+' / 160 ซม.';
   if(raceProgress.textContent!==distance)raceProgress.textContent=distance;
   if(now-lastSave>1000){saveGame();lastSave=now;}
 }
 function racingItems(){return state.active.entrants.map((r,i)=>({sortY:3+i*2,kind:'race',r,i}));}
 function drawRunner(r,i){
   const s=sprites[i],parts=slugPartsOf(s);if(!parts)return;
   const p=S((s.viewHead??r.head)/CM_PER_CELL,3+i*2,SAND_CELLS),scale=r.length*depthPxPerCm()/(parts.bw*parts.s),w=parts.w*scale,h=parts.h*scale;
   if(p.x+w<0||p.x-w>TCW||p.y<0||p.y-h>TCH)return;
   const stretch=s.state==='walk'?1+Math.sin(s.creepT)*.035:1;
   const centerX=p.x-((parts.L+parts.R)/2-parts.bw/2*(1-stretch))*parts.s*scale,cy=p.y-h*.44;
   drawTankSlug(s,parts,scale,centerX,cy,false);
   drawDefaultEyes(parts,centerX,cy,true,parts.s*scale);
   if(i===0){tctx.save();tctx.font='bold 12px sans-serif';tctx.textAlign='center';tctx.fillStyle='#153c42';tctx.fillRect(p.x-r.length*depthPxPerCm()/2-20,p.y+8,40,19);tctx.fillStyle='#ffe3a0';tctx.fillText('คุณ',p.x-r.length*depthPxPerCm()/2,p.y+22);tctx.restore();}
 }
 function openRace(){
   const a=state.active,t=G.objs.find(o=>o.id===a?.tankId);if(!a||modal||raceUI||!t)return;
   spawn();sprites=a.entrants.map(r=>({genes:r.genes,viewHead:r.head,flip:true,state:'rest',ph:0,noBob:true,creepT:0}));lastKey=a.lastKey;
   // Reuse the existing aquarium canvas, furniture, water, lighting and camera.
   raceUI=element('div');raceUI.id='raceTankHUD';document.body.classList.add('race-in-tank');
   enterTank(t);ov.querySelector('.ov-body').append(raceUI);document.getElementById('ovTitle').textContent='🏁 ตู้แข่งทากทะเล';
   const banner=element('div',null,raceUI);banner.className='race-tank-banner';countNode=element('div','3',banner);countNode.className='race-count';countNode.setAttribute('role','status');raceProgress=element('small','0 / 160 ซม.',banner);
   const controls=element('div',null,raceUI);controls.className='race-controls';
   for(const [key,label] of [['a','A · ซ้าย'],['d','D · ขวา']]){
     const b=element('button',label,controls);b.type='button';b.setAttribute('aria-label','กระดึ๊บฝั่ง'+(key==='a'?'ซ้าย':'ขวา'));
     b.onpointerdown=e=>{e.preventDefault();press(key);};b.onclick=e=>{if(e.detail===0)press(key);};buttons.push(b);
   }
   raceBottom=Math.max(88,controls.offsetHeight+22);
   raceResize=new ResizeObserver(entries=>{raceBottom=Math.max(88,entries[0].contentRect.height+22);cameraKey='';});raceResize.observe(controls);
   resizeTank();lastFrame=0;cameraKey='';if(a.settled)showResult();
 }
 window.addEventListener('keydown',e=>{
   if(!raceUI||modal?.open)return;
   if(state.active){e.stopImmediatePropagation();if(['KeyA','KeyD','Space','Escape'].includes(e.code))e.preventDefault();if(!e.repeat&&(e.code==='KeyA'||e.code==='KeyD'))press(e.code==='KeyA'?'a':'d');}
 },true);
 document.addEventListener('visibilitychange',()=>{lastFrame=0;if(document.hidden)for(const a of burstAnimations)a.cancel();saveGame();});
 window.SlugRace={purchased,goal,drawTrack,drawChallengers,isOpen:()=>!!modal?.open,isRacing,normalSlugs,stepNormal,updateTankFrame,racingItems,drawRunner,stride};
 // Settled races retain their receipt; unfinished races resume, never reroll.
 if(state.active?.entrants?.length===3){
   state.active.entrants.forEach(r=>{if(r.finished===null&&state.active.settled)r.finished=Infinity;});
 }else state.active=null;
 if(owned())purchased();
 // Keep gameplay independent of the hidden shop renderer, at a bounded 20 Hz.
 setInterval(()=>{
   if((!modal?.open&&!raceUI&&!document.hidden)||window.BOOTING||!engineReady)return;
   stepPeople();
   for(const t of G.objs){
     if(t.type!=='tank'||!t.slugs.length)continue;
     if(raceUI&&t.id===state.active?.tankId){if(modal?.open||document.hidden)stepNormal(normalSlugs(t),.05);}
     else stepTankSlugs(t.slugs,t.def.w,t.def.h,.05,true,t.decor,t.def);
   }
 },50);
 resumeReady=true;setInterval(tick,1000);
})();
