/* ============================================================
   fireworks.js — พลุฉลองเต็มจอ (ตัวเดียวใช้ร่วมกันทุกจุด)
   จรวดพุ่งจากขอบล่าง มีหางไฟ → ระเบิดกลางอากาศ 4 แบบ (ดอกกลม · วงแหวน · หลิวทองร่วงช้า · ประกายแตกซ้ำ)
   ใช้: Fireworks.play({count, duration})  ·  Fireworks.stop()

   ⚠️ ต้องอยู่ "top layer" ไม่ใช่แค่ z-index สูง — กล่องผลแข่ง/การ์ดทากใหม่เป็น <dialog> showModal()
      ซึ่งลอยเหนือ z-index ทุกค่าในหน้า พลุเวอร์ชันก่อนจึงโดนบังมิด
      ทางแก้: ห่อแคนวาสด้วย popover="manual" แล้ว showPopover() — ของใน top layer เรียงตามลำดับที่เข้า
      เรียก play() หลังเปิด dialog = พลุอยู่เหนือ dialog เสมอ (play ซ้ำระหว่างเล่นจะดันขึ้นบนสุดใหม่ให้)
   ⚠️ pointer-events:none ทั้งชั้น — คลิกทะลุไปถึงปุ่มในกล่องผลได้ตามปกติ

   ต้นทุน (AGENTS.md): สไปรต์แสงฟุ้งวาดครั้งเดียวต่อสี แล้ว drawImage ซ้ำ · พูลอนุภาคขนาดตายตัว ไม่มีขยะ GC
   ลูปทำงานเฉพาะตอนมีพลุ ดับเองทันทีที่เม็ดสุดท้ายมอด · แท็บซ่อน = หยุดและล้างทิ้งทันที
   ============================================================ */
(function(){
 'use strict';
 const MAX=1600;
 const PALETTES=[
  ['#ffd36e','#fff3c4','#ff9a3c'],   // ทอง
  ['#7ce3cd','#d8fff5','#39b8ff'],   // ฟ้าทะเล
  ['#ff8fb8','#ffe3ee','#ff4f86'],   // ชมพู
  ['#c3a2ff','#f1e6ff','#7d7bff'],   // ม่วง
  ['#b9ff7c','#f2ffd8','#4fdc8c'],   // เขียวอ่อน
  ['#ff7a5c','#ffe1c8','#ffcf4a']];  // ส้มแดง
 const KINDS=['peony','peony','ring','willow','crackle'];

 let layer=null,cv=null,ctx=null,raf=0,last=0,w=0,h=0,dpr=1,scale=1;
 const parts=[],rockets=[];let queue=[];
 for(let i=0;i<MAX;i++)parts.push({on:false,x:0,y:0,vx:0,vy:0,life:0,max:1,size:1,sprite:null,drag:.98,g:0,flicker:false,crackle:false});
 const sprites=new Map();

 /* เม็ดแสง: แกนขาวร้อน → สีของดอก → จางเป็นแสงฟุ้ง */
 function sprite(color){
  let c=sprites.get(color);if(c)return c;
  c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.16,color);g.addColorStop(.42,color+'88');g.addColorStop(1,color+'00');
  x.fillStyle=g;x.fillRect(0,0,64,64);sprites.set(color,c);return c;
 }
 function ensure(){
  if(layer)return;
  layer=document.createElement('div');layer.id='fireworksLayer';layer.setAttribute('aria-hidden','true');
  if('popover' in HTMLElement.prototype)layer.popover='manual';
  layer.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:hidden;pointer-events:none;z-index:2147483647';
  cv=document.createElement('canvas');cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
  layer.append(cv);document.body.append(layer);ctx=cv.getContext('2d');
 }
 function resize(){
  dpr=Math.min(devicePixelRatio||1,2);
  const nw=innerWidth,nh=innerHeight;
  if(nw===w&&nh===h&&cv.width===Math.round(nw*dpr))return;
  w=nw;h=nh;cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  scale=Math.max(.6,Math.min(1.6,Math.min(w,h)/760));
 }
 /* ดันขึ้นบนสุดของ top layer (ซ่อนแล้วโชว์ใหม่ = ไปต่อท้ายลำดับ) */
 function raise(){
  if(!layer.popover){layer.style.display='block';return;}
  try{if(layer.matches(':popover-open'))layer.hidePopover();layer.showPopover();}catch(e){layer.style.display='block';}
 }
 function hideLayer(){
  if(!layer)return;
  if(layer.popover){try{if(layer.matches(':popover-open'))layer.hidePopover();}catch(e){}}
  else layer.style.display='none';
 }
 function spawn(x,y,vx,vy,life,size,color,drag,g,flicker,crackle){
  const p=parts.find(q=>!q.on);if(!p)return null;
  p.on=true;p.x=x;p.y=y;p.vx=vx;p.vy=vy;p.life=p.max=life;p.size=size;p.sprite=sprite(color);
  p.drag=drag;p.g=g;p.flicker=flicker;p.crackle=crackle;return p;
 }
 function burst(x,y,pal,kind){
  const s=scale;
  spawn(x,y,0,0,.09,55*s,pal[1],1,0,false,false);                                   // แฟลชสั้น ๆ ตอนระเบิด (ใหญ่กว่านี้กลายเป็นลูกบอลขาวแสบตา)
  if(kind==='ring'){
   const n=64,v=(250+Math.random()*60)*s,tilt=.55+Math.random()*.35;
   for(let i=0;i<n;i++){const a=i/n*Math.PI*2;
    spawn(x,y,Math.cos(a)*v,Math.sin(a)*v*tilt,1.25+Math.random()*.3,15*s,pal[i%2?0:2],.965,120*s,false,false);}
   for(let i=0;i<26;i++){const a=Math.random()*Math.PI*2,r=Math.random()*v*.35;
    spawn(x,y,Math.cos(a)*r,Math.sin(a)*r,1+Math.random()*.4,11*s,pal[1],.95,90*s,true,false);}
   return;
  }
  if(kind==='willow'){
   const n=110;
   for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=(90+Math.random()*190)*s;
    spawn(x,y,Math.cos(a)*v,Math.sin(a)*v,2.4+Math.random()*1.2,13*s,Math.random()<.7?'#ffcf66':'#fff0b8',.955,140*s,true,false);}
   return;
  }
  const n=kind==='crackle'?80:120;
  for(let i=0;i<n;i++){
   const a=Math.random()*Math.PI*2,v=Math.sqrt(Math.random())*(330+Math.random()*80)*s;
   spawn(x,y,Math.cos(a)*v,Math.sin(a)*v,1.2+Math.random()*.7,(14+Math.random()*6)*s,pal[(Math.random()*3)|0],.963,160*s,Math.random()<.35,kind==='crackle');
  }
 }
 function launch(q){
  const s=scale,g=950*s,startX=q.x+(Math.random()-.5)*w*.06,startY=h+12;
  const rise=Math.max(80,startY-q.y),vy=-Math.sqrt(2*g*rise),t=-vy/g;
  rockets.push({x:startX,y:startY,vx:(q.x-startX)/t,vy,g,pal:q.pal,kind:q.kind,trail:0});
 }
 function step(now){
  raf=0;
  if(document.hidden){stop();return;}
  const dt=Math.min(.05,last?(now-last)/1000:1/60);last=now;
  /* หางไฟ: ลบภาพเฟรมก่อนออกทีละนิดแทนการล้างทั้งจอ — แคนวาสโปร่งใสจึงใช้ destination-out */
  ctx.globalCompositeOperation='destination-out';
  ctx.fillStyle='rgba(0,0,0,'+(1-Math.pow(.74,dt*60)).toFixed(3)+')';ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation='lighter';

  while(queue.length&&queue[0].at<=now)launch(queue.shift());

  for(let i=rockets.length-1;i>=0;i--){
   const r=rockets[i];
   r.vy+=r.g*dt;r.x+=r.vx*dt;r.y+=r.vy*dt;
   r.trail+=dt;
   /* หางจรวดเป็นประกายเล็กสีส้มอุ่น กระจายนิด ๆ อายุสั้น — เม็ดใหญ่อายุยาวจะเรียงเป็นสายลูกปัดขาว */
   while(r.trail>.016){r.trail-=.016;
    spawn(r.x+(Math.random()-.5)*4,r.y+3,(Math.random()-.5)*46,30+Math.random()*60,.2+Math.random()*.18,6*scale,Math.random()<.5?'#ffb566':'#ffe0a8',.88,80,true,false);}
   const head=sprite(r.pal[1]),hs=15*scale;ctx.globalAlpha=1;ctx.drawImage(head,r.x-hs/2,r.y-hs/2,hs,hs);
   if(r.vy>=-25){burst(r.x,r.y,r.pal,r.kind);rockets.splice(i,1);}
  }

  let alive=0;
  for(const p of parts){
   if(!p.on)continue;
   p.life-=dt;
   if(p.life<=0){
    p.on=false;
    if(p.crackle)for(let k=0;k<4;k++){const a=Math.random()*Math.PI*2,v=(40+Math.random()*70)*scale;
     spawn(p.x,p.y,Math.cos(a)*v,Math.sin(a)*v,.22+Math.random()*.2,10*scale,'#fffbe8',.9,30,true,false);}
    continue;
   }
   alive++;
   const k=Math.pow(p.drag,dt*60);p.vx*=k;p.vy=p.vy*k+p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
   const t=p.life/p.max;
   let a=Math.min(1,t*1.6);if(p.flicker)a*=.55+.45*Math.sin(now*.045+p.x);
   ctx.globalAlpha=Math.max(0,a);
   const sz=p.size*(.55+.45*t);
   ctx.drawImage(p.sprite,p.x-sz/2,p.y-sz/2,sz,sz);
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';

  if(!alive&&!rockets.length&&!queue.length){
   /* ปล่อยให้หางไฟจางอีกนิดแล้วค่อยปิดชั้น */
   if(!step.fadeUntil)step.fadeUntil=now+450;
   if(now>=step.fadeUntil){step.fadeUntil=0;ctx.clearRect(0,0,w,h);hideLayer();last=0;return;}
  }else step.fadeUntil=0;
  raf=requestAnimationFrame(step);
 }
 function play(opt){
  opt=opt||{};
  if(document.hidden||(typeof reducedMotion==='function'&&reducedMotion()))return;
  ensure();resize();raise();
  const count=opt.count||9,span=opt.duration||2800,now=performance.now();
  for(let i=0;i<count;i++){
   /* ลูกแรก ๆ ตามกันถี่ ให้ติดตาทันทีที่ฉลอง แล้วค่อยห่างออก */
   const at=now+(i===0?0:Math.pow(i/count,1.25)*span+Math.random()*180);
   /* ส่วนใหญ่ไประเบิดสองข้างจอ + ด้านบน ไม่ตูมทับกลางจอ ซึ่งมักเป็นข้อความ/ปุ่มในกล่องผล */
   const side=Math.random()<.8,left=Math.random()<.5;
   const x=side?(left?.06+Math.random()*.24:.7+Math.random()*.24):.3+Math.random()*.4;
   const y=side?.1+Math.random()*.4:.06+Math.random()*.14;
   queue.push({at,x:w*x,y:h*y,
    pal:PALETTES[(Math.random()*PALETTES.length)|0],kind:KINDS[(Math.random()*KINDS.length)|0]});
  }
  queue.sort((a,b)=>a.at-b.at);
  if(!raf){last=0;raf=requestAnimationFrame(step);}
 }
 function stop(){
  if(raf)cancelAnimationFrame(raf);raf=0;last=0;queue=[];rockets.length=0;
  for(const p of parts)p.on=false;
  if(ctx)ctx.clearRect(0,0,w,h);hideLayer();
 }
 addEventListener('resize',()=>{if(layer&&raf)resize();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.Fireworks={play,stop,raise:()=>{if(layer&&raf)raise();}};
})();
