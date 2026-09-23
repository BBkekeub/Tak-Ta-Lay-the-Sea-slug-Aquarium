// ตรวจภาพปาหิน: ซูมกล้อง · ปลายเชือกถึงกลางตัว (ทากตัวเล็ก/ใหญ่) · โหมด 2 ต่อ 2 / 3 ต่อ 3 · หน้ารับคำท้า (จำนวนตัวสุ่มมากับคำท้า เลือกไม่ได้)
// โปรไฟล์ใหม่ทุกครั้ง ไม่แตะเซฟของผู้เล่น · ภาพออกที่ tools/qa/larva-cadence/
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'tools/qa/larva-cadence');fs.mkdirSync(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+(p==='/'?'/index.html':decodeURIComponent(p)));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.glb':'model/gltf-binary'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[],report={};

try{
 browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});await page.waitForFunction(()=>!window.BOOTING&&typeof stepBreederLarvae==='function');
 await page.evaluate(()=>{
  const t=G.objs.find(o=>o.type==='tank');t.def=CATALOG.tank_breed;t._key='tank_breed';t.decor=[];t.foods=[];t.slugs=[];
  const s=makeSlug(SlugEngine.randGene());Object.assign(s,{fx:27,fy:5,dir:0,turn:0,state:'walk',stt:100,satiety:100,ph:0});
  breederState(t).larvae=[{slug:s,left:1000,survives:true}];prepareBreederFoodSlugs(t);PEOPLE.length=0;peopleOn=false;
  enterTank(t);window.qaLarva=s;window.qaBreeder=t;
 });
 await page.waitForTimeout(350);
 await page.evaluate(()=>{
  tankCam.zoom=5;tankCam.ox=0;tankCam.oy=0;const p=S(qaLarva.fx,qaLarva.fy,SAND_CELLS);tankCam.ox=TCW/2-p.x;tankCam.oy=TCH/2-p.y;tankNeedFit=false;
 });
 report.motion=await page.evaluate(()=>new Promise(resolve=>{
  const samples=[];let start=performance.now();function sample(now){samples.push({t:now,x:qaLarva.fx,y:qaLarva.fy});if(now-start<1500){requestAnimationFrame(sample);return;}
  let moves=0,maxStep=0;for(let i=1;i<samples.length;i++){const d=Math.hypot(samples[i].x-samples[i-1].x,samples[i].y-samples[i-1].y);if(d>1e-8)moves++;maxStep=Math.max(maxStep,d);}resolve({samples:samples.length,moves,maxStep,zoom:tankCam.zoom});}requestAnimationFrame(sample);
 }));
 await page.screenshot({path:path.join(out,'zoom.png')});report.cost50=await page.evaluate(()=>{
 const original=qaBreeder.breeding.larvae;qaBreeder.breeding.larvae=Array.from({length:50},()=>({slug:{...qaLarva,fx:27,fy:5,stt:100},left:1000}));
 const samples=[];for(let i=0;i<80;i++){const t=performance.now();stepBreederLarvae(qaBreeder,1/60);samples.push(performance.now()-t);}qaBreeder.breeding.larvae=original;samples.sort((a,b)=>a-b);return {p50:samples[40],p95:samples[76]};
 });assert.ok(report.motion.moves>15,'Visible larva moves at frame cadence, not four times per second');assert.ok(report.motion.maxStep<.025);assert.deepEqual(errors,[]);report.passed=true;
}catch(e){report.failure=String(e);process.exitCode=1;}
finally{report.errors=errors;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser?.close();server.close();}
