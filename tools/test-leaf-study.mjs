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

 await page.goto('http://127.0.0.1:'+server.address().port+'/tools/leaf-sheep/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.LeafStudy,{timeout:30000});
 await page.waitForTimeout(300);
 const initial=await page.evaluate(()=>({triangles:LeafStudy.triangles,builds:LeafStudy.builds,frames:LeafStudy.frames}));
 await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>LeafStudy.frames),initial.frames);
 for(let i=0;i<4;i++){await page.screenshot({path:'tools/leaf-sheep/view-'+i+'.png'});await page.locator('#turn').click();await page.waitForTimeout(80);}
 assert.equal(await page.evaluate(()=>LeafStudy.builds),initial.builds);
 for(const n of [18,42,30]){await page.selectOption('#count',String(n));await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>LeafStudy.triangles),n*16);}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({initial,final:await page.evaluate(()=>({triangles:LeafStudy.triangles,calls:LeafStudy.calls})),errors}));
}finally{await browser?.close();server.close();}

