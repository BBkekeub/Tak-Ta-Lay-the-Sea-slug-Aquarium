// ตรวจภาพปาหิน: ซูมกล้อง · ปลายเชือกถึงกลางตัว (ทากตัวเล็ก/ใหญ่) · โหมด 2 ต่อ 2 / 3 ต่อ 3 · หน้ารับคำท้า (จำนวนตัวสุ่มมากับคำท้า เลือกไม่ได้)
// โปรไฟล์ใหม่ทุกครั้ง ไม่แตะเซฟของผู้เล่น · ภาพออกที่ tools/qa/throw-aim/
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'tools/qa/throw-aim');fs.mkdirSync(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+(p==='/'?'/index.html':decodeURIComponent(p)));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.glb':'model/gltf-binary'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[],report={};

try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/js/slug-throw.js*',async route=>{let s=fs.readFileSync(path.join(root,'js/slug-throw.js'),'utf8');s=s.replace('window.SlugThrow={','window.SlugThrow={_qa:{camera,waveImage,updateHud},');await route.fulfill({contentType:'text/javascript',body:s});});
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
 await page.waitForFunction(()=>!window.BOOTING&&window.SlugThrow,null,{timeout:60000});
 await page.evaluate(()=>{
  const t=G.objs.find(o=>o.type==='tank');t.def=CATALOG.tank_throw;t._key='tank_throw';t.decor=[];t.foods=[];
  t.slugs=[makeSlug(SlugEngine.randGene())];PEOPLE.length=0;peopleOn=false;
  const s=t.slugs[0];G.throwing.active={tankId:t.id,wager:0,practice:true,settled:false,round:0,turn:0,phase:'boost',clock:2,ring:75,
   shot:{v:32,gain:1,angle:45,presses:20,waves:[{at:1,hit:null},{at:2,hit:null},{at:3,hit:null}],by:0,dist:28,pitch:0},
   entrants:Array.from({length:4},(_,i)=>({id:i?undefined:s.id,name:i?'คู่แข่ง '+i:'ทากของเรา',genes:{...s.genes},bot:i>0,aim:.7,shots:[]}))};
  window.qaTank=t;
 });
 await page.waitForSelector('#throwTankHUD');
 await page.evaluate(()=>{SlugThrow.updateTankFrame=()=>{SlugThrow._qa.camera(qaTank,.05);SlugThrow._qa.updateHud(G.throwing.active);};});
 
 await page.evaluate(()=>{const a=G.throwing.active;a.phase='intro';a.aimStyle='arrow1';a.clock=0;a.shot=null;SlugThrow._qa.updateHud(a);});
 await page.mouse.click(950,300);
 assert.equal(await page.evaluate(()=>G.throwing.active.phase),'angle');
 await page.evaluate(()=>{G.throwing.active.clock=.31;SlugThrow._qa.updateHud(G.throwing.active);});
 await page.mouse.click(950,300);
 const locked=await page.evaluate(()=>({phase:G.throwing.active.phase,angle:G.throwing.active.lockAngle,shot:G.throwing.active.shot}));
 assert.equal(locked.phase,'power');assert.equal(locked.shot,null);assert.ok(locked.angle>=15&&locked.angle<=75);
 await page.evaluate(()=>{G.throwing.active.clock=.32;});await page.keyboard.press('Space');
 assert.equal(await page.evaluate(()=>G.throwing.active.phase),'boost');assert.equal(await page.evaluate(()=>G.throwing.active.shot.angle),locked.angle);
 report.threeClicks=true;
 for(const width of [1280,480]){
  await page.setViewportSize({width,height:800});
  for(const phase of ['angle','power']){
   await page.evaluate(phase=>{const a=G.throwing.active;a.phase=phase;a.clock=.31;a.lockAngle=phase==='angle'?null:42;a.lockPower=null;for(let i=0;i<60;i++)SlugThrow._qa.camera(qaTank,.05);drawTankFrame();},phase);
   await page.screenshot({path:path.join(out,width+'-'+phase+'.png')});
  }
 }

 await page.evaluate(()=>{const a=G.throwing.active;a.phase='power';a.aimStyle='arrow1';a.lockAngle=42;a.lockPower=null;a.clock=.2;saveGame();});
 await page.reload({waitUntil:'load'});await page.waitForSelector('#throwTankHUD');
 report.resume=await page.evaluate(()=>({phase:G.throwing.active.phase,angle:G.throwing.active.lockAngle}));assert.equal(report.resume.phase,'power');assert.equal(report.resume.angle,42);
 await page.evaluate(()=>{SlugThrow.updateTankFrame=()=>{SlugThrow._qa.camera(G.objs.find(o=>o.id===G.throwing.active.tankId),.05);SlugThrow._qa.updateHud(G.throwing.active);};G.throwing.active.clock=.3;});
 await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>G.throwing.active.phase),'boost');
 report.checks=await page.evaluate(()=>{
  const a=G.throwing.active;a.phase='boost';a.clock=2;const v=a.shot.v;const accepted=SlugThrow.boostKey('f'),repeat=SlugThrow.boostKey('f');
  const image=SlugThrow._qa.waveImage();const samples=[];
  for(let j=0;j<80;j++){const t=performance.now();for(let i=0;i<20;i++)SlugThrow.drawItem({part:'stone'});samples.push((performance.now()-t)/20);}samples.sort((a,b)=>a-b);
  return {accepted,repeat,velocityIncreased:a.shot.v>v,cacheReused:image===SlugThrow._qa.waveImage(),bitmapPixels:image.width*image.height,drawMsP50:samples[40],drawMsP95:samples[76]};
 });
 assert.ok(report.checks.accepted&&!report.checks.repeat&&report.checks.velocityIncreased&&report.checks.cacheReused);assert.deepEqual(errors,[]);report.passed=true;
}catch(e){report.failure=String(e);process.exitCode=1;}
finally{report.errors=errors;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser?.close();server.close();}
