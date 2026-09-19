// Isolated browser profile; never opens the player's save.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname.replace(/^\/$/,'/index.html'));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
 await page.route('https://fonts.googleapis.com/**',r=>r.abort());
 await page.route('https://fonts.gstatic.com/**',r=>r.abort());
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>{if(!r.url().includes('fonts.'))console.log('REQUEST FAILED',r.url(),r.failure()?.errorText);});
 page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded',timeout:60000});
 try{await page.waitForFunction(()=>!window.BOOTING&&window.DecorGLB?.ready&&window.Slug3D?.ready,null,{timeout:20000});}
 catch(e){console.log(JSON.stringify(await page.evaluate(()=>({boot:window.BOOTING,decor:window.DecorGLB?.ready,slug:window.Slug3D?.ready,body:document.body.innerText.slice(-500)}))),errors);throw e;}

 const results=await page.evaluate(async()=>{
  openSlugShopDialog();const button=slugShopDialog.querySelector('[data-order]');button.focus();for(let i=0;i<60;i++)renderSlugShop();
  const focus=document.activeElement===button&&button===slugShopDialog.querySelector('[data-order]');slugShopDialog.close();
  const tank=G.objs.find(o=>o.type==='tank');tank.hygiene={cleaned:Array(144).fill(Date.now()-3600000)};
  const hidden=tankHygiene(tank);const lazy=!algaeSurfaceCache.has(tank),dirt=hidden.dirt;
  enterTank(tank);const rotations=[];
  for(let r=0;r<4;r++){tank.rot=r;drawTankHygiene(tank);const cache=algaeSurfaceCache.get(tank);rotations.push(!!cache&&cache.faces.length===3&&Math.abs(tankHygiene(tank).dirt-dirt)<1e-10);}
  exitTank();const prior=peopleOn;peopleOn=true;_pLast=performance.now()-100;const before=_peopleT;stepPeople();const elapsed=_peopleT-before;peopleOn=prior;
  return {focus,lazy,rotations,elapsed};
 });
 assert(results.focus&&results.lazy&&results.rotations.every(Boolean)&&results.elapsed>=.099);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({results,errors},null,2));
}finally{await browser?.close();server.close();}
