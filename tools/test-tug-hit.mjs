// Real UI regression in a fresh origin/profile; never opens the player's save.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'tools/qa/tug-hit');fs.mkdirSync(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+(new URL(req.url,'http://local').pathname==='/'?'/index.html':decodeURIComponent(new URL(req.url,'http://local').pathname)));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.glb':'model/gltf-binary'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,page;const report={},errors=[];
try{
 browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1440,height:1050}});page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});await page.waitForFunction(()=>!window.BOOTING&&window.DecorGLB?.ready,null,{timeout:70000});
 await page.evaluate(()=>{const t=G.objs.find(o=>o.type==='tank');t.def=CATALOG.tank_tug;t._key='tank_tug';t.cx=20;t.cy=20;t.rot=0;t.decor=[];G.objs=[t];G.door={side:'north',offset:0};PEOPLE.length=0;peopleOn=true;stepPeople=()=>{};setMode('view');G.tug.purchased=true;G.tug.nextAt=0;G.tug.active=null;G.tug.offer=null;});
 console.log('FIXTURE_READY');await page.waitForFunction(()=>PEOPLE.some(p=>p.tugChallenger));console.log('CHALLENGER_SPAWNED');
 await page.evaluate(()=>{
  const p=PEOPLE.find(p=>p.tugChallenger);PEOPLE.splice(0,PEOPLE.length,p);stepPeople=()=>{};
  p.x=43;p.y=27;p.state='look';p.action='watch';p.idle=0;p.motion=0;p.fdx=-1;p.fdy=-1;p.hCm=170;p.headYaw=0;p.build=1;
  window.hitQA={p,t:G.objs[0],camera:()=>{cam.zoom=.63;const w=worldOf(p.x,p.y);cam.x=w.X-(CW*.68-CW/2)/cam.zoom;cam.y=w.Y-(CH*.90-CH/2)/cam.zoom;}};hitQA.camera();
 });
 await page.waitForFunction(()=>hitQA.p._drawPose&&hitQA.p._tugHit);
 const targets=await page.evaluate(()=>{
  const p=hitQA.p,b=personScreenBounds(p),h=p._tugHit,r=cv.getBoundingClientRect(),result={};
  const inLabel=(x,y)=>h&&x>=h.x0&&x<=h.x1&&y>=h.y0&&y<=h.y1;
  for(let y=Math.max(10,b.y0+10);y<Math.min(CH-10,b.y1);y+=22)for(let x=Math.max(10,b.x0+10);x<Math.min(CW-10,b.x1);x+=22){
   if(inLabel(x,y))continue;const body=personHitTest(p,x,y),tank=tankHit(x,y),point={x:x+r.left,y:y+r.top};
   if(body&&!result.person)result.person=point;
   if(!body&&tank&&!result.tank)result.tank=point;
   if(!body&&!tank&&!result.empty)result.empty=point;
   if(result.person&&result.tank&&result.empty)return{...result,coarseBounds:b};
  }return result;
 });
 assert.ok(targets.person&&targets.tank&&targets.empty,JSON.stringify(targets));report.targets=targets;
 const click=pt=>page.mouse.click(pt.x,pt.y);
 await click(targets.empty);assert.equal(await page.evaluate(()=>SlugTug.isOpen()||tankMode),false);report.emptyInsideOldHitbox=true;
 await click(targets.tank);await page.waitForFunction(()=>tankMode&&curTank===hitQA.t);assert.equal(await page.evaluate(()=>SlugTug.isOpen()),false);report.tankOpensManagement=true;
 await page.locator('#ovAdd').click();await page.waitForFunction(()=>document.getElementById('slugTransfer').open);
 const before=await page.evaluate(()=>({tank:curTank.slugs.length,inv:G.inv.length}));assert.ok(before.tank>0);
 await page.locator('#slugTransfer input[data-side="0"]').first().check();await page.locator('#slugTransfer [data-move="0"]').click();
 assert.equal(await page.evaluate(()=>curTank.slugs.length),before.tank-1);assert.equal(await page.evaluate(()=>G.inv.length),before.inv+1);
 await page.locator('#slugTransfer input[data-side="1"]').last().check();await page.locator('#slugTransfer [data-move="1"]').click();
 assert.equal(await page.evaluate(()=>curTank.slugs.length),before.tank);report.transferOutAndBack=true;
 await page.locator('#slugTransfer [data-close]').click();await page.evaluate(()=>{exitTank();hitQA.camera();});await page.waitForTimeout(150);
 await click(targets.person);await page.waitForFunction(()=>SlugTug.isOpen());report.personOpensChallenge=true;await page.screenshot({path:path.join(out,'challenge.png')});
 await page.getByRole('button',{name:'ขอไปเตรียมทากก่อน',exact:true}).click();assert.equal(await page.evaluate(()=>SlugTug.isOpen()),false);
 await click(targets.tank);await page.waitForFunction(()=>tankMode);await page.evaluate(()=>{exitTank();hitQA.camera();});await page.waitForTimeout(150);
 await page.mouse.move(targets.person.x,targets.person.y);await page.mouse.down();await page.mouse.move(targets.person.x+65,targets.person.y+25,{steps:5});await page.mouse.up();assert.equal(await page.evaluate(()=>SlugTug.isOpen()||tankMode),false);report.dragDoesNotChallenge=true;
 await page.evaluate(()=>{hitQA.camera();setMode('build');});await page.waitForTimeout(100);await click(targets.person);assert.equal(await page.evaluate(()=>SlugTug.isOpen()),false);report.buildModeDoesNotChallenge=true;
 // Current-camera projection and cached pose are reused, not mesh rebuilding.
 report.geometryChecks=await page.evaluate(()=>{
  setMode('view');const p=hitQA.p,pose=p._drawPose,faces=pose.faces;let hits=0;const started=performance.now();
  for(const zoom of [.3,.6,1.1])for(let orientation=0;orientation<4;orientation++){
   cam.zoom=zoom;p.fdx=Math.cos(orientation*Math.PI/2);p.fdy=Math.sin(orientation*Math.PI/2);drawPerson(p);
   const snapshot=p._drawPose,some=snapshot.faces.find(f=>{const a=f.v.reduce((a,b)=>a.map((x,i)=>x+b[i]),[0,0,0]).map(x=>x/f.v.length),q=P(a[0],a[1],a[2]*ZUNIT);return personHitTest(p,q.x,q.y);});
   if(some)hits++;if(p._drawPose!==snapshot)throw Error('hit test rebuilt geometry');
  }
  return{orientationsAndZooms:hits,elapsedMs:performance.now()-started};
 });assert.equal(report.geometryChecks.orientationsAndZooms,12);assert.deepEqual(errors,[]);report.passed=true;
}catch(e){report.passed=false;report.failure=String(e);report.debug=await page?.evaluate(()=>({peopleOn,tankMode,hidden:document.hidden,people:PEOPLE.map(p=>({x:p.x,y:p.y,tug:p.tugChallenger,pose:!!p._drawPose,label:!!p._tugHit})),tug:G.tug,capacity:visitorCapacity(),issue:shopOpeningIssue()})).catch(()=>null);process.exitCode=1;}
finally{report.errors=errors;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser?.close();server.close();}
