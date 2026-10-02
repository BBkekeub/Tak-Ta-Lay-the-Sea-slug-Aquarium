// Slugs draw in the shop, the tank and the eat/sumo contests (practice matches, a new-species slug included),
// the tank UI stays clickable, and nothing logs an error. Fresh profile over http — never the player's save.
// Run from the repo root:  node tools/test-slug-render.mjs [screenshot-dir]
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),shots=process.argv[2]||null,errors=[];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.webp':'image/webp','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+(u==='/'?'/index.html':decodeURIComponent(u)));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const ready=page=>page.waitForFunction(()=>!window.BOOTING&&typeof engineReady!=='undefined'&&engineReady&&typeof G!=='undefined'&&G.objs?.length,null,{timeout:120000});
try{
 const page=await (await browser.newContext({viewport:{width:1400,height:900}})).newPage();
 page.on('pageerror',e=>errors.push('pageerror '+e));page.on('console',m=>{if(m.type()==='error')errors.push('console '+m.text().slice(0,200));});
 page.on('response',r=>{if(r.status()>=400)errors.push('http '+r.status()+' '+r.url());});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await ready(page);await page.waitForTimeout(1500);
 if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,'shop.png')});}
 const tank=await page.evaluate(async()=>{const t=G.objs.find(o=>o.type==='tank'&&!isBreeder(o)&&o.slugs.length);enterTank(t);fitTankZoom();centerTankCam();
  const cx=t.def.w/2,cy=t.def.h/2;t.slugs.forEach((s,i)=>Object.assign(s,{fx:cx+(i%2?1.4:-1.4),fy:cy,state:'sleep',stt:1e9}));
  await new Promise(r=>setTimeout(r,800));
  // the UI over the tank canvas must stay on top and clickable
  const on=id=>{const b=document.getElementById(id);if(!b||b.offsetParent===null)return 'hidden';const r=b.getBoundingClientRect(),el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return el===b||b.contains(el)?'top':'covered by '+(el?.id||el?.tagName)};
  return {slugs:t.slugs.length,hits:t.slugs.filter(s=>s._hit).length,ovBack:on('ovBack'),ovBuild:on('ovBuild')};});
 if(shots)await page.screenshot({path:path.join(shots,'tank.png')});
 await page.click('#ovBuild');await page.waitForTimeout(400);
 const build=await page.evaluate(()=>({build:tankBuildMode,dockOpen:document.querySelector('#ov .ov-body').classList.contains('decor-open')}));
 await page.click('#ovBuild');await page.evaluate(()=>exitTank());await page.waitForTimeout(500);
 const contests={};
 for(const [key,label] of [['tank_eat','ซ้อมแข่งกินจุ'],['tank_sumo','ซ้อมดันวง']]){
  await page.evaluate(key=>{const t=G.objs.find(o=>o.type==='tank');t.def=CATALOG[key];t._key=key;t.decor=[];t.foods=[];
   t.slugs=[makeSlug({...SlugEngine.randGene(),sp:'oreo'}),...[0,1,2].map(()=>makeSlug(SlugEngine.randGene()))];
   PEOPLE.length=0;peopleOn=false;enterTank(t);},key);
  await page.getByRole('button',{name:label}).click();await page.getByRole('button',{name:'เริ่มซ้อม'}).click();
  await page.waitForTimeout(4500);   // countdown, then entrants move
  contests[key]=await page.evaluate(()=>({eating:!!window.SlugEat?.isEating(),sumo:!!window.SlugSumo?.isSumo(),oreo:slugPartsOf(curTank.slugs[0]).species}));
  if(shots)await page.screenshot({path:path.join(shots,key+'.png')});
  await page.reload();await ready(page);
 }
 const report={tank,build,contests,errors};console.log(JSON.stringify(report));
 assert.ok(tank.hits===tank.slugs&&tank.slugs>0,'every slug drawn in the tank');assert.equal(tank.ovBack,'top');assert.equal(tank.ovBuild,'top');
 assert.ok(build.build&&build.dockOpen,'decor dock opens');
 assert.ok(contests.tank_eat.eating&&contests.tank_sumo.sumo,'practice matches running');assert.equal(contests.tank_eat.oreo,'oreo');
 assert.deepEqual(errors,[],'no errors');
 console.log('PASS: shop, tank and eat/sumo practice draw slugs; tank UI clickable');
}finally{await browser.close();server.close();}
