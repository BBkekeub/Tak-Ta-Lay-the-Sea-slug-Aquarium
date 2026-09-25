import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),out=path.join(root,'Decor/TextureStudy/ReferencePair/DragonRock'),report={},errors=[];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png'};
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+(new URL(req.url,'http://local').pathname==='/'?'/index.html':decodeURIComponent(new URL(req.url,'http://local').pathname)));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
page.on('pageerror',e=>{errors.push(String(e));console.log('PAGEERROR',String(e));});page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,300));});page.on('requestfailed',r=>console.log('FAILED',r.url(),r.failure()?.errorText));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForFunction(()=>!window.BOOTING&&window.DecorGLB?.ready,null,{timeout:60000});
 report.catalog=await page.evaluate(()=>Object.keys(TANK_DECOR).filter(k=>TANK_DECOR[k].model));assert.equal(report.catalog.length,5);await page.evaluate(()=>DecorGLB.loadAll());
 await page.evaluate(()=>{let t=G.objs.find(o=>o.type==='tank'&&!isBreeder(o));t.decor=[];t.slugs=[];G.coin=1000;G.decorCredit={};enterTank(t);fitTankZoom();centerTankCam();});
 await page.locator('#ovBuild').click();await page.getByRole('tab',{name:'หินที่ปรับแล้ว',exact:true}).click();await page.locator('[data-key="reviewed_dragon_rock"]').click();
 const p=await page.evaluate(()=>{const p=S(curTank.def.w/2,curTank.def.h/2,SAND_CELLS),r=tankCv.getBoundingClientRect();return{x:r.left+p.x,y:r.top+p.y,price:decorPrice('reviewed_dragon_rock')};});
 await page.mouse.click(p.x,p.y);
 await page.waitForFunction(()=>curTank.decor.length===1&&DecorGLB.inspect().objects.some(o=>o.key==='reviewed_dragon_rock'&&o.ready),null,{timeout:60000});
 assert.equal(await page.evaluate(()=>G.coin),1000-p.price);report.price=p.price;
 await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>curTank.decor.length),1);assert.equal(await page.evaluate(()=>G.coin),1000-p.price);report.overlapRejected=true;
 await page.keyboard.press('Escape');
 for(let i=0;i<4;i++){
  await page.evaluate(()=>{selDecor=curTank.decor[0];syncDecorBar();});
  await page.screenshot({path:path.join(out,`game-rotation-${i}.png`)});
  await page.locator('#dFlip').click();
 }
 report.render=await page.evaluate(()=>({error:DecorGLB.error,stats:DecorGLB.stats,inspection:DecorGLB.inspect()}));assert.equal(report.render.error,null);
 await page.evaluate(()=>saveGame());await page.reload();await page.waitForFunction(()=>!window.BOOTING&&window.DecorGLB?.ready);
 report.reload=await page.evaluate(()=>({coin:G.coin,decor:G.objs.flatMap(o=>o.decor||[]).filter(d=>d.key==='reviewed_dragon_rock')}));assert.equal(report.reload.decor.length,1);assert.equal(report.reload.coin,1000-p.price);
 await page.evaluate(()=>{enterTank(G.objs.find(o=>o.decor?.some(d=>d.key==='reviewed_dragon_rock')));fitTankZoom();centerTankCam();});
 await page.locator('#ovBuild').click();await page.evaluate(()=>{selDecor=curTank.decor[0];syncDecorBar();});await page.locator('#dRemove').click();
 report.remove=await page.evaluate(()=>({count:curTank.decor.length,credit:G.decorCredit.reviewed_dragon_rock,coin:G.coin}));assert.equal(report.remove.count,0);assert.equal(report.remove.credit,1);assert.equal(report.remove.coin,1000-p.price);
 report.items=[];
 for(const key of report.catalog){
  await page.evaluate(()=>{curTank.decor=[];G.decorCredit={};G.coin=1000;selDecorKey=null;selDecor=null;syncDecorBar();});
  await page.getByRole('tab',{name:'หินที่ปรับแล้ว',exact:true}).click();await page.locator(`[data-key="${key}"]`).click();
  const target=await page.evaluate(()=>{const p=S(curTank.def.w/2,curTank.def.h/2,SAND_CELLS),r=tankCv.getBoundingClientRect();return{x:r.left+p.x,y:r.top+p.y};});
  await page.mouse.click(target.x,target.y);await page.waitForFunction(k=>curTank.decor.some(d=>d.key===k)&&DecorGLB.inspect().objects.some(o=>o.key===k&&o.ready),key);
  const item=await page.evaluate(k=>({key:k,coin:G.coin,price:decorPrice(k),error:DecorGLB.error}),key);assert.equal(item.coin,1000-item.price);assert.equal(item.error,null);
  await page.keyboard.press('Escape');
  for(let i=0;i<4;i++){await page.evaluate(()=>{selDecor=curTank.decor[0];syncDecorBar();});await page.locator('#dFlip').click();}
  await page.screenshot({path:path.join(out,`game-${key}.png`)});report.items.push(item);
 }
 report.errors=errors;assert.deepEqual(errors,[]);report.passed=true;
}catch(e){console.log('STATE',await page.evaluate(()=>({boot:window.BOOTING,glb:window.DecorGLB?.error,ready:window.DecorGLB?.ready})));await page.screenshot({path:path.join(out,'game-test-failure.png')});throw e;}finally{fs.writeFileSync(path.join(out,'game-integration-test.json'),JSON.stringify(report,null,2));await browser.close();server.close();}
console.log(JSON.stringify(report,null,2));

