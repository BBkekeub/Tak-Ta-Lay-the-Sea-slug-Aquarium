// Opt-in local diagnosis: index.html?profile=1. Does not write game/save state.
(()=>{
 if(!new URLSearchParams(location.search).has('profile'))return;
 const box=document.createElement('pre');box.id='runtimeProfile';
 box.style.cssText='position:fixed;right:8px;top:80px;z-index:99999;background:#09151fee;color:#eaf5ff;padding:12px;max-height:75vh;overflow:auto;font:12px/1.5 monospace;white-space:pre-wrap;max-width:600px';
 box.textContent='Performance capture: waiting for startup, then 20 seconds. No save changes.';document.body.append(box);
 const originals=[],stats={},stack=[],frames=[],longFrames=[];
 let start=0,last=0,active=false,raf=0;
 function hook(owner,key,label=key){
  if(!owner||typeof owner[key]!=='function')return;
  const original=owner[key],stat=stats[label]={calls:0,total:0,self:0,max:0};
  function wrapped(...args){
   if(!active)return original.apply(this,args);
   const frame={start:performance.now(),child:0};stack.push(frame);
   try{return original.apply(this,args);}finally{
    const elapsed=performance.now()-frame.start;stack.pop();
    stat.calls++;stat.total+=elapsed;stat.self+=elapsed-frame.child;stat.max=Math.max(stat.max,elapsed);
    if(stack.length)stack[stack.length-1].child+=elapsed;
   }
  }
  owner[key]=wrapped;originals.push({owner,key,original,wrapped});
 }
 let observer;
 function finish(){
  active=false;observer?.disconnect();cancelAnimationFrame(raf);
  for(const {owner,key,original,wrapped} of originals)if(owner[key]===wrapped)owner[key]=original;
  const elapsed=performance.now()-start,sorted=frames.slice().sort((a,b)=>a-b),q=t=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*t))]||0;
  const report={elapsedMs:elapsed,frames:frames.length,fps:frames.length*1000/elapsed,p50:q(.5),p95:q(.95),p99:q(.99),viewport:[innerWidth,innerHeight],people:typeof PEOPLE!=='undefined'?PEOPLE.length:null,
   stats:Object.entries(stats).map(([name,s])=>({name,calls:s.calls,selfPerFrame:s.self/frames.length,totalPerFrame:s.total/frames.length,max:s.max})).sort((a,b)=>b.selfPerFrame-a.selfPerFrame),longFrames};
  window.runtimeProfileReport=report;
  box.textContent=JSON.stringify(report,null,2);
  const button=document.createElement('button');button.textContent='Save performance report';button.onclick=()=>{
   const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='aquarium-runtime-profile.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };box.prepend(button);
 }
 function tick(now){
  if(document.hidden){finish();return;}
  if(last)frames.push(now-last);last=now;
  if(now-start>=20000){finish();return;}raf=requestAnimationFrame(tick);
 }
 function begin(){
  if(window.BOOTING){setTimeout(begin,1000);return;}
  for(const key of ['drawFloor','drawObject','drawPerson','beginPersonBatch','endPersonBatch','drawPersonBatchGL','poseVertsOf','flattenFaces','drawPersonShadow','personFurnitureFaces','personGlassFaces','personClusters','stepPeople','stepPeopleSlice','stepTankSlugs','drawTankSlug','drawCaustics','drawTankHygiene','drawWallSlug','drawCarriedSlugs','drawCatSeller','saveGame'])hook(window,key);
  for(const key of ['beginShop','endShop','queuePeople','draw'])hook(window.DecorGLB,key,'DecorGLB.'+key);
  for(const key of ['beginFrame','endFrame','draw'])hook(window.Slug3D,key,'Slug3D.'+key);
  for(const key of ['slugSprite','slugPartsOf','foodPrepare','foodStep','foodPath','foodDecay','decorSolidSet','decorCellSet','freeSpotNear','slugPoseTimers','slugFaceAndCreep'])hook(window,key);
  if(typeof SlugEngine!=='undefined')for(const key of ['drawSlug','parts','render'])hook(SlugEngine,key,'SlugEngine.'+key);
  try{observer=new PerformanceObserver(list=>{for(const f of list.getEntries())if(longFrames.length<30)longFrames.push({duration:f.duration,blockingDuration:f.blockingDuration,scripts:f.scripts?.map(s=>({source:s.sourceURL?.split('/').pop(),function:s.sourceFunctionName,duration:s.duration,forcedStyleAndLayoutDuration:s.forcedStyleAndLayoutDuration}))});});observer.observe({type:'long-animation-frame',buffered:false});}catch{}
  box.textContent='Capturing 20 seconds. Keep camera still.';start=performance.now();active=true;raf=requestAnimationFrame(tick);
 }
 setTimeout(begin,8000);
})();
