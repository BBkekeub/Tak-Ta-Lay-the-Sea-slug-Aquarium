// Four-view sprite decor in the real game (fresh profile, never the player's save):
// buy from its tab → place → overlap refused → rotate 4 views → save/reload → remove gives a credit back.
// Uses a piece that is in the game's catalog (the dragon-rock study stays withheld in index.html).
// Run from the repo root:  node tools/test-sprite-decor.mjs   (screenshots: tools/qa/sprite-decor/)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),out=path.join(root,'tools/qa/sprite-decor'),report={},errors=[];fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+(new URL(req.url,'http://local').pathname==='/'?'/index.html':decodeURIComponent(new URL(req.url,'http://local').pathname)));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
page.on('pageerror',e=>{errors.push(String(e));console.log('PAGEERROR',String(e));});page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,300));});page.on('requestfailed',r=>console.log('FAILED',r.url(),r.failure()?.errorText));
const ready=()=>page.waitForFunction(()=>!window.BOOTING&&typeof engineReady!=='undefined'&&engineReady,null,{timeout:60000});
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await ready();
 report.catalog=await page.evaluate(()=>Object.keys(TANK_DECOR).filter(k=>TANK_DECOR[k].sprite));assert.ok(report.catalog.length>0,'sprite decor in the catalog');
 const key=report.catalog.includes('sprite_driftwood')?'sprite_driftwood':report.catalog[0];report.key=key;
 const cat=await page.evaluate(k=>TANK_DECOR[k].cat,key);
 await page.evaluate(()=>{let t=G.objs.find(o=>o.type==='tank'&&!isBreeder(o));t.decor=[];t.slugs=[];G.coin=1000;G.decorCredit={};enterTank(t);fitTankZoom();centerTankCam();});
 await page.locator('#ovBuild').click();await page.getByRole('tab',{name:cat,exact:true}).click();await page.locator(`[data-key="${key}"]`).click();
 const p=await page.evaluate(k=>{const p=S(curTank.def.w/2,curTank.def.h/2,SAND_CELLS),r=tankCv.getBoundingClientRect();return{x:r.left+p.x,y:r.top+p.y,price:decorPrice(k)};},key);
 await page.mouse.click(p.x,p.y);
 await page.waitForFunction(()=>curTank.decor.length===1,null,{timeout:60000});
 assert.equal(await page.evaluate(()=>G.coin),1000-p.price);report.price=p.price;await page.waitForTimeout(500);
 await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>curTank.decor.length),1);assert.equal(await page.evaluate(()=>G.coin),1000-p.price);report.overlapRejected=true;
 await page.keyboard.press('Escape');
 report.rotations=[];
 for(let i=0;i<4;i++){
  report.rotations.push(await page.evaluate(()=>{selDecor=curTank.decor[0];syncDecorBar();return curTank.decor[0].flip|0;}));
  await page.screenshot({path:path.join(out,`game-rotation-${i}.png`)});
  await page.locator('#dFlip').click();
 }
 assert.deepEqual([...report.rotations].sort(),[0,1,2,3],'four views');
 await page.evaluate(()=>saveGame());await page.reload();await ready();
 report.reload=await page.evaluate(k=>({coin:G.coin,decor:G.objs.flatMap(o=>o.decor||[]).filter(d=>d.key===k)}),key);assert.equal(report.reload.decor.length,1);assert.equal(report.reload.coin,1000-p.price);
 await page.evaluate(k=>{enterTank(G.objs.find(o=>o.decor?.some(d=>d.key===k)));fitTankZoom();centerTankCam();},key);
 await page.locator('#ovBuild').click();await page.evaluate(()=>{selDecor=curTank.decor[0];syncDecorBar();});await page.locator('#dRemove').click();
 report.remove=await page.evaluate(k=>({count:curTank.decor.length,credit:G.decorCredit[k],coin:G.coin}),key);assert.equal(report.remove.count,0);assert.equal(report.remove.credit,1);assert.equal(report.remove.coin,1000-p.price);
 report.errors=errors;assert.deepEqual(errors,[]);report.passed=true;
}catch(e){console.log('STATE',await page.evaluate(()=>({boot:window.BOOTING,engine:typeof engineReady!=='undefined'&&engineReady})));await page.screenshot({path:path.join(out,'game-test-failure.png')});throw e;}finally{fs.writeFileSync(path.join(out,'game-integration-test.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
console.log(JSON.stringify(report,null,2));
