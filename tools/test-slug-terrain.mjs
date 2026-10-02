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
 for(const x of [250,470,620,800,1000]){await page.locator('#pos').fill(String(x));await page.locator('#pos').dispatchEvent('input');const r=await page.evaluate(()=>{const s=trialState;return {contact:s.points.every((p,i)=>Math.abs(p.y+(s.bottom[i]-s.restY[i])*s.scale+s.lifts[i]-s.floor[i])<1e-6),lengths:s.points.slice(1).map((p,i)=>Math.hypot(p.x-s.points[i].x,p.y-s.points[i].y)),len:s.lengths};});assert.ok(r.contact);assert.ok(r.lengths.every((n,i)=>Math.abs(n-r.len[i])<.001));}
 await page.locator('#pos').fill('470');await page.locator('#pos').dispatchEvent('input');await page.screenshot({path:'assets/decor/driftwood/terrain-rig-trial.png'});assert.deepEqual(errors,[]);console.log('PASS: 8 fixed-length bones traverse flat, uphill, crest and downhill terrain');
}finally{await browser.close();server.close();}
