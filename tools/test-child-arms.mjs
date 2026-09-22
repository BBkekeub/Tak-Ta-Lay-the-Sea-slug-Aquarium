// Isolated game/browser test: no player profile or save is opened.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'tools/qa/child-arms');fs.mkdirSync(out,{recursive:true});
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const current=fs.readFileSync(path.join(root,'js/people.js'),'utf8');
const previous=process.env.PEOPLE_BEFORE?fs.readFileSync(process.env.PEOPLE_BEFORE,'utf8'):current;
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
  report[mode]=await page.evaluate(mode=>carryGallery(window['carry'+mode],'female',{kid:true,hCm:115,build:1.08,bagged:false,carryTank:false,state:'walk',motion:0,phase:1,action:'jump',actionT:.5,actionDuration:1}),mode);
  await page.locator('#carryQA').screenshot({path:path.join(out,mode+'.png')});
 }

 for(const body of ['male','female','male2','female2']){
  await page.evaluate(body=>carryGallery(carryAfter,body,{kid:true,hCm:115,build:1.08,carryTank:false,accessory:'backpack',state:'walk',motion:0,phase:1,action:'jump',actionT:.5,actionDuration:1}),body);
  await page.locator('#carryQA').screenshot({path:path.join(out,body+'.png')});
 }

 report.jump=await page.evaluate(()=>{
  _personBatch=[];cam.x=0;cam.y=-100;cam.zoom=.5;let cases=0,maxLengthError=0,maxSeamGap=0;
  for(const body of ['male','female','male2','female2'])for(let frame=0;frame<=10;frame++)for(let direction=0;direction<4;direction++){
   const p=carryPerson(body,direction*Math.PI/2,{kid:true,carryTank:false,action:'jump',actionT:frame/10,actionDuration:1,state:'walk',headYaw:.4});carryAfter(p);
   for(const a of p._qa.arms){const d=(x,y)=>Math.hypot(...x.map((v,i)=>v-y[i]));maxLengthError=Math.max(maxLengthError,Math.abs(d(a.shoulder,a.elbow)-a.upper),Math.abs(d(a.elbow,a.hand)-a.lower));}
   maxSeamGap=Math.max(maxSeamGap,...p._qa.seams.map(s=>s.gap));
   if(!p._drawPose.faces.every(f=>f.v.every(v=>v.every(Number.isFinite))))throw Error('Invalid jump pose');cases++;_personBatch.length=0;
  }_personBatch=null;return {cases,maxLengthError,maxSeamGap};
 });
 assert.ok(report.jump.maxLengthError<1e-6);assert.ok(report.jump.maxSeamGap<1e-10);assert.deepEqual(errors,[]);
 report.passed=true;
}catch(e){report.failure=String(e);process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'visual-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failure:report.failure,errors}));await browser?.close();server.close();}
