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
 await page.goto(`http://127.0.0.1:${server.address().port}/Dec%20Grid.html`);await page.waitForSelector('#bColorDetect');
 const original=await page.evaluate(()=>JSON.stringify(items));await page.getByText('ทำต่อจากตัวอย่าง 1–4',{exact:true}).click();await page.click('#bLearnGrids');await page.waitForFunction(()=>!document.getElementById('bLearnGrids').disabled,null,{timeout:90000});const report=await page.locator('#learnGridReport').innerText();assert.ok(report.includes('trainingAgreement'),report);assert.equal(JSON.parse(report).changed,12);const saved=JSON.parse(original);const current=await page.evaluate(()=>JSON.parse(JSON.stringify(items)));for(const key of ['sprite_driftwood','sprite_driftwood_hollow','sprite_driftwood_branch','sprite_driftwood_antler'])assert.deepEqual(current[key],saved[key]);await page.click('#bRestoreLearned');assert.equal(await page.evaluate(()=>JSON.stringify(items)),original);assert.deepEqual(errors,[]);console.log('PASS: 12 draft pieces, reference preservation, complete restore');
}finally{await browser.close();server.close();}
