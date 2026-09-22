// Isolated game/browser test: no player profile or save is opened.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'tools/qa/bag-fit');fs.mkdirSync(out,{recursive:true});
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const current=fs.readFileSync(path.join(root,'js/people.js'),'utf8');
const previous=process.env.PEOPLE_BEFORE?fs.readFileSync(process.env.PEOPLE_BEFORE,'utf8'):execFileSync('git',['show','HEAD:js/people.js'],{cwd:root,encoding:'utf8'});
const drawSource=s=>s.slice(s.indexOf('function drawPerson(p){'),s.indexOf('/* ---------- ปุ่มเปิด/ปิดลูกค้า'));
function probe(s){
 return drawSource(s).replace('const _W=[];', 'const _W=[];p._qa={parts:[],arms:[]};')
 .replace('if(!part) return;','if(!part) return;const qa={name:Object.keys(MDL.parts).find(k=>MDL.parts[k]===part),vertices:[],indices:part.t};')
 .replace('_W[i]=world([vx, vy, wz]);','_W[i]=world([vx, vy, wz]);qa.vertices.push([vx,vy,wz]);')
 .replace('for(const run of part.s){','p._qa.parts.push(qa);for(const run of part.s){')
 .replace('emit(ua,shoulder,','p._qa.arms.push({side,shoulder,elbow,hand,upper:UARM,lower:FARM});emit(ua,shoulder,')
 .replace('for(const {face:f,rgb} of seamFaces){','p._qa.seams=seamPoints.map(points=>({count:points.length,gap:Math.max(0,...points.map(v=>Math.hypot(...v.map((x,a)=>x-points[0][a]))))}));for(const {face:f,rgb} of seamFaces){')
 .replace("const water=p.carryColor",'p._qa.tank={x0,x1,y0,y1,z0,z1};const water=p.carryColor');
}
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.glb':'model/gltf-binary','.json':'application/json'})[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const report={},errors=[];
try{
 browser=await chromium.launch({channel:'chrome',headless:true,timeout:20000});
 const page=await browser.newPage({viewport:{width:1200,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load',timeout:25000});
 console.log('Game page loaded; waiting for startup.');
 await page.waitForFunction(()=>typeof drawPerson==='function'&&typeof PEOPLE_MODEL!=='undefined',null,{timeout:40000});
 console.log('Game ready; checking poses.');
 report.fit=await page.evaluate(()=>{
  const results=[];
  for(const [body,model] of Object.entries(PEOPLE_MODEL)){
   const start=performance.now(),bags=fittedPersonBags(model),coldMs=performance.now()-start;
   const part=model.parts.torso,vs=Array.from({length:part.v.length/3},(_,i)=>[0,1,2].map(a=>part.o[a]+part.v[i*3+a]));
   function interval(x,z){
    const hits=[];
    for(let k=0;k<part.t.length;k+=3){
     const [a,b,c]=part.t.slice(k,k+3).map(i=>vs[i]),ux=b[0]-a[0],uz=b[2]-a[2],vx=c[0]-a[0],vz=c[2]-a[2],det=ux*vz-uz*vx;
     if(Math.abs(det)<1e-10)continue;
     const u=((x-a[0])*vz-(z-a[2])*vx)/det,v=(ux*(z-a[2])-uz*(x-a[0]))/det;
     if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)hits.push(a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]));
    }
    return [Math.min(...hits),Math.max(...hits)];
   }
   for(const [kind,mesh] of Object.entries(bags)){
    if(!mesh.v.every(Number.isFinite))throw new Error(body+' '+kind+' has invalid coordinates');
    let inside=0,maxDepth=0;const examples=[];
    for(let k=0;k<mesh.t.length;k+=3){
     const vs=mesh.t.slice(k,k+3).map(i=>[0,1,2].map(a=>mesh.v[i*3+a]+mesh.o[a]));
     for(let i=0;i<=8;i++)for(let j=0;j<=8-i;j++){
      const p=[0,1,2].map(a=>vs[0][a]*(1-(i+j)/8)+vs[1][a]*i/8+vs[2][a]*j/8),[lo,hi]=interval(p[0],p[2]);
      const depth=Math.min(p[1]-lo,hi-p[1]);
      if(depth>.0003){inside++;maxDepth=Math.max(maxDepth,depth);if(examples.length<3)examples.push({triangle:k/3,p,depth});}
     }
    }
    results.push({body,kind,inside,maxDepth,examples,triangles:mesh.t.length/3,coldMs,cacheReused:bags===fittedPersonBags(model)});
   }
  }
  return results;
 });
 await page.evaluate(({before,after,rawBefore})=>{
  window.BOOTING=true;window.requestAnimationFrame=()=>0;PEOPLE.length=0;G.objs=[];
  window.carryBefore=(0,eval)('('+before+')');window.carryAfter=(0,eval)('('+after+')');
  window.carryBeforeRaw=(0,eval)('('+rawBefore+')');
  window.carryPerson=(body='male',direction=0,extra={})=>({x:0,y:0,hCm:170,kid:false,gender:body.startsWith('female')?'female':'male',body,build:1,phase:0,idle:0,motion:0,fdx:Math.cos(direction),fdy:Math.sin(direction),state:'look',action:'watch',actionT:0,actionDuration:1,headYaw:0,skin:'#d8a476',shirt:'#8d7fa8',pants:'#3b5060',hair:'#43312a',shoe:'#23262b',outfit:'trousers',bagged:false,accessory:'none',modelHair:'Hair',facial:'Moustache',carryTank:true,carryColor:'#2f6f78',carryAccent:'#854273',...extra});
  window.carryGallery=(draw,body,extra={})=>{
   let canvas=document.getElementById('carryQA');if(!canvas){canvas=document.createElement('canvas');canvas.id='carryQA';document.body.append(canvas);canvas.style.cssText='position:fixed;inset:0;z-index:999999;width:1200px;height:1000px';}
   canvas.width=1200;canvas.height=1000;ctx=canvas.getContext('2d');CW=1200;CH=1000;
   ctx.fillStyle='#242c30';ctx.fillRect(0,0,CW,CH);cam.zoom=370/(34*ZUNIT);const persons=[];
   for(let i=0;i<4;i++){
    const p=carryPerson(body,Math.PI/4+i*Math.PI/2,extra),sx=300+(i%2)*600,sy=440+Math.floor(i/2)*490;
    cam.x=(CW/2-sx)/cam.zoom;cam.y=(CH/2-sy)/cam.zoom;
    draw(p);
    if(!draw.toString().includes('paintPersonMesh(faces,p,H);'))paintPersonMesh(p._drawPose.faces,p,p.hCm/CM_PER_CELL);
    persons.push(p);ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText(body+' / '+(45+i*90)+' deg',sx-85,sy+32);
   }
   return persons.map(p=>({arms:p._qa.arms,tank:p._qa.tank,triangles:p._drawPose.faces.length}));
  };
 },{before:probe(previous),after:probe(current),rawBefore:drawSource(previous)});
 for(const mode of ['Before','After']){
  report[mode]=await page.evaluate(mode=>carryGallery(window['carry'+mode],'female',{bagged:true,carryTank:false}),mode);
  await page.locator('#carryQA').screenshot({path:path.join(out,mode+'.png')});
 }
 report.variants=await page.evaluate(()=>{
  function intersectsTank(vertices,indices,b){
   let intersections=0;
   for(let i=0;i<indices.length;i+=3){
    let polygon=indices.slice(i,i+3).map(j=>vertices[j]);
    for(const [axis,edge,sign] of [[0,b.x0+1e-5,1],[0,b.x1-1e-5,-1],[1,b.y0+1e-5,1],[1,b.y1-1e-5,-1],[2,b.z0+1e-5,1],[2,b.z1-1e-5,-1]]){
     const clipped=[];
     for(let j=0;j<polygon.length;j++){
      const a=polygon[j],c=polygon[(j+1)%polygon.length],da=(a[axis]-edge)*sign,dc=(c[axis]-edge)*sign;
      if(da>=0)clipped.push(a);
      if((da>=0)!==(dc>=0)){const t=da/(da-dc);clipped.push(a.map((v,k)=>v+(c[k]-v)*t));}
     }
     polygon=clipped;if(polygon.length<3)break;
    }
    if(polygon.length>=3)intersections++;
   }
   return intersections;
  }
  const results=[];_personBatch=[];
  cam.zoom=.5;cam.x=0;cam.y=-100;CW=1200;CH=1000;
  for(const body of ['male','female','male2','female2'])for(const build of [.86,1,1.10])for(const motion of [0,1])for(const phase of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   const p=carryPerson(body,Math.PI/4,{build,motion,phase,state:motion?'walk':'look'});carryAfter(p);
   const q=p._qa,b=q.tank;let inside=0,trianglesInside=0,maxPalmZ=-Infinity;
   for(const part of q.parts.filter(p=>/^(hand|fore)/.test(p.name))){
    trianglesInside+=intersectsTank(part.vertices,part.indices,b);
    for(const v of part.vertices){
    if(v[0]>b.x0+1e-5&&v[0]<b.x1-1e-5&&v[1]>b.y0+1e-5&&v[1]<b.y1-1e-5&&v[2]>b.z0+1e-5&&v[2]<b.z1-1e-5)inside++;
    if(part.name.startsWith('hand'))maxPalmZ=Math.max(maxPalmZ,v[2]);
    }
   }
   const lengthError=Math.max(...q.arms.flatMap(a=>[Math.abs(Math.hypot(...a.elbow.map((v,i)=>v-a.shoulder[i]))-a.upper),Math.abs(Math.hypot(...a.hand.map((v,i)=>v-a.elbow[i]))-a.lower)]));
   results.push({body,build,motion,phase,inside,trianglesInside,palmGap:b.z0-maxPalmZ,lengthError,elbowOut:Math.max(...q.arms.map(a=>Math.abs(a.elbow[0])-Math.abs(a.shoulder[0])))});_personBatch.length=0;
  }
  _personBatch=null;return results;
 });
 for(const body of ['female','male2','female2']){
  await page.evaluate(body=>carryGallery(carryAfter,body),body);
  await page.locator('#carryQA').screenshot({path:path.join(out,body+'.png')});
 }
 report.cache=await page.evaluate(()=>{
  _personBatch=[];const p=carryPerson('female',Math.PI/4,{bagged:true,accessory:'backpack'});drawPerson(p);const first=p._drawPose;
  cam.x+=20;cam.zoom*=1.1;drawPerson(p);const reused=p._drawPose===first;
  p.x=100000;drawPerson(p);const offscreenUnchanged=p._drawPose===first;_personBatch=null;
  return{reused,offscreenUnchanged};
 });
 report.poses=await page.evaluate(()=>{
  _personBatch=[];cam.x=0;cam.y=-100;cam.zoom=.5;let cases=0;
  for(const body of ['male','female','male2','female2'])for(const build of [.86,1,1.1])for(const kid of [false,true])for(const action of ['watch','crouch','lean'])for(const direction of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   const p=carryPerson(body,direction,{build,kid,bagged:true,accessory:'backpack',carryTank:false,action,actionT:.5,actionDuration:1,motion:1,phase:Math.PI/3});
   drawPerson(p);if(!p._drawPose.faces.every(f=>f.v.every(v=>v.every(Number.isFinite))))throw new Error('Invalid accessory pose');
   cases++;_personBatch.length=0;
  }
  _personBatch=null;return {cases,finite:true};
 });
 report.seams=await page.evaluate(()=>{
  const results=[];_personBatch=[];cam.x=0;cam.y=-100;cam.zoom=.5;
  for(const body of ['male','female','male2','female2'])for(const kid of [false,true])
   for(const carryTank of [false,true])for(const motion of [0,1])for(const phase of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
    const p=carryPerson(body,Math.PI/4,{kid,carryTank,motion,phase,state:motion?'walk':'look'});carryAfter(p);
    results.push({body,kid,carryTank,motion,phase,seams:p._qa.seams.length,maxGap:Math.max(...p._qa.seams.map(s=>s.gap))});_personBatch.length=0;
   }
  _personBatch=null;return results;
 });
 for(const body of ['male','female','male2','female2'])for(const mode of ['idle','walk']){
  await page.evaluate(({body,mode})=>carryGallery(carryAfter,body,{bagged:true,carryTank:false,motion:mode==='walk'?1:0,phase:Math.PI/2,state:mode==='walk'?'walk':'look'}),{body,mode});
  await page.locator('#carryQA').screenshot({path:path.join(out,`${body}-${mode}.png`)});
 }
 for(const body of ['male','female','male2','female2'])for(const mode of ['idle','walk','crouch']){
  await page.evaluate(({body,mode})=>carryGallery(carryAfter,body,{kid:true,bagged:false,accessory:'backpack',carryTank:false,motion:mode==='walk'?1:0,phase:Math.PI/2,action:mode==='crouch'?'crouch':'watch',actionT:.5,actionDuration:1,state:'look'}),{body,mode});
  await page.locator('#carryQA').screenshot({path:path.join(out,`${body}-backpack-${mode}.png`)});
 }
 await page.evaluate(()=>carryGallery(carryAfter,'female',{bagged:true,carryTank:false,action:'crouch',actionT:.5,actionDuration:1}));
 await page.locator('#carryQA').screenshot({path:path.join(out,'female-bag-crouch.png')});
 if(process.env.BAGS_BEFORE)await page.evaluate(source=>(0,eval)(source.replace('const PEOPLE_BAG_MODEL=','window.bagsBefore=')),fs.readFileSync(process.env.BAGS_BEFORE,'utf8'));
 report.cost=await page.evaluate(()=>{
  cam.x=0;cam.y=0;cam.zoom=.4;_personBatch=[];
  const costs={};
  for(const [name,draw] of [['before',carryBeforeRaw],['after',drawPerson]]){
   for(const [body,model] of Object.entries(PEOPLE_MODEL))personBagModels.set(model,name==='before'&&window.bagsBefore?bagsBefore[body]:PEOPLE_BAG_MODEL[body]);
   const p=carryPerson('female',Math.PI/4,{bagged:true,carryTank:false,motion:1,state:'walk'}),samples=[];
   for(let i=0;i<120;i++){p.phase=i*.2;p.idle=i*.1;p._drawPose=null;_personBatch.length=0;const t=performance.now();draw(p);if(i>=20)samples.push(performance.now()-t);}
   const triangles=p._drawPose.faces.reduce((n,f)=>n+f.v.length-2,0);samples.sort((a,b)=>a-b);
   costs[name]={poseBuildMedianMs:samples[Math.floor(samples.length/2)],poseBuildP95Ms:samples[Math.floor(samples.length*.95)],triangles};
  }
  _personBatch=null;return costs;
 });
 report.geometry=await page.evaluate(()=>{
  let maxError=0;_personBatch=[];cam.x=0;cam.y=0;cam.zoom=.4;
  for(const body of ['male','female','male2','female2']){
   const model=PEOPLE_MODEL[body];
   const p=carryPerson(body,Math.PI/4,{bagged:true,accessory:'backpack',carryTank:false,motion:1,phase:1,state:'walk'});
   personBagModels.set(model,window.bagsBefore?bagsBefore[body]:PEOPLE_BAG_MODEL[body]);carryBeforeRaw(p);
   const old=p._drawPose.faces;p._drawPose=null;personBagModels.set(model,PEOPLE_BAG_MODEL[body]);drawPerson(p);
   if(old.length!==p._drawPose.faces.length)throw new Error('Triangle count changed');
   old.forEach((f,i)=>f.v.forEach((v,j)=>v.forEach((x,k)=>maxError=Math.max(maxError,Math.abs(x-p._drawPose.faces[i].v[j][k])))));
   _personBatch.length=0;
  }
  _personBatch=null;
  return {maxError,scratchReleased:Object.values(PEOPLE_MODEL).every(m=>shirtSeams(m).points.every(p=>p.length===0)&&shirtSeams(m).facePool.every(f=>f.face===null&&f.rgb===null))};
 });
 report.summary={cases:report.variants.length,verticesInside:report.variants.reduce((n,x)=>n+x.inside,0),trianglesInside:report.variants.reduce((n,x)=>n+x.trianglesInside,0),maxLengthError:Math.max(...report.variants.map(x=>x.lengthError)),maxElbowOut:Math.max(...report.variants.map(x=>x.elbowOut))};
 assert.equal(report.summary.verticesInside,0,'Hands/forearms must not enter the carried tank');
 assert.equal(report.summary.trianglesInside,0,'Complete hand/forearm triangles must clear the tank');
 assert.ok(report.summary.maxLengthError<1e-6,'Keep the existing arm lengths');
 assert.ok(report.summary.maxElbowOut<.055,'Keep the elbows near the torso');
 assert.ok(report.cache.reused&&report.cache.offscreenUnchanged);
 assert.ok(report.fit.every(r=>r.cacheReused),'Reuse fitted accessory geometry');
 assert.ok(report.fit.every(r=>r.inside===0),'Bag/strap triangle samples must clear the torso');
 if(process.env.BAGS_BEFORE){assert.ok(report.geometry.maxError<1e-9);assert.ok(report.geometry.scratchReleased);}
 assert.ok(report.seams.every(s=>s.seams>0&&s.maxGap<1e-10),'Shirt seams stay closed in adult/child idle, walking and carrying poses');
 
 assert.deepEqual(errors,[]);report.passed=true;
}catch(e){report.passed=false;report.failure=String(e);process.exitCode=1;}
finally{
 report.errors=errors;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,failure:report.failure,summary:report.summary,cache:report.cache,cost:report.cost,errors}));
 await browser?.close();server.close();
}



