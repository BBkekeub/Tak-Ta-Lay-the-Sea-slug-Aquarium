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
 await page.addInitScript(()=>{Math.random=()=>.42;window.calls=0;const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(...a){window.calls++;return draw.apply(this,a);};});
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/slug-terrain-trial.html`);await page.waitForFunction(()=>window.trialReady);
 const result=await page.evaluate(()=>{const input=document.getElementById('pos'),times=[];let startCalls=calls;for(let i=0;i<240;i++){input.value=400+i%150;const t=performance.now();input.dispatchEvent(new Event('input'));times.push(performance.now()-t);}times.sort((a,b)=>a-b);return {p50:times[120],p95:times[228],drawCalls:calls-startCalls};});console.log(JSON.stringify(result));
}finally{await browser.close();server.close();}
