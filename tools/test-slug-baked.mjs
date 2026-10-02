// Slugs climb onto and pass under a mesh-derived driftwood grid in the real game.
// Fresh headless profile: never reads or writes the player's save.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),key='sprite_driftwood_mopani_bend',shots=process.argv[2]||null,errors=[];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+(u==='/'?'/index.html':decodeURIComponent(u)));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await (await browser.newContext({viewport:{width:1400,height:900}})).newPage();page.on('pageerror',e=>{errors.push(String(e));console.log('PAGEERROR',String(e))});
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/slug-terrain-trial.html`);await page.waitForFunction(()=>window.trialReady);
 await page.evaluate(()=>{window.rigDraws=0;const draw=SlugEngine.drawSlug;SlugEngine.drawSlug=function(...args){rigDraws++;return draw(...args);};});
 await page.click('#play');await page.waitForFunction(()=>trialBakeInfo().frames===64&&!trialBakeInfo().baking);const before=await page.evaluate(()=>({draws:rigDraws,...trialBakeInfo()}));await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>rigDraws),before.draws,'playback never computes or draws rig');assert.ok(before.bytes<40*1048576);await page.click('#play');for(const [name,index] of [['reach',59],['gather',53],['settle',49]]){await page.locator('#pos').fill(String(Math.round(180+index*840/63)));await page.locator('#pos').dispatchEvent('input');await page.screenshot({path:'assets/decor/driftwood/crawl-'+name+'.png'});}await page.locator('#height').fill('80');await page.locator('#height').dispatchEvent('input');assert.equal(await page.evaluate(()=>trialBakeInfo().frames),0);assert.deepEqual(errors,[]);console.log('PASS: bake 64 frames; zero rig draws during playback; bounded memory; terrain change releases frames',before);
}finally{await browser.close();server.close();}

