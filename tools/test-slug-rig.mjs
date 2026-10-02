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
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForFunction(()=>!window.BOOTING&&typeof enterTank==='function'&&typeof G!=='undefined'&&G.objs?.length,null,{timeout:90000});
 const result=await page.evaluate(()=>{
 const E=SlugEngine,rig=E.makeSpine(100,30);E.poseSpine(rig,{bones:[.2,-.2,.1,0,-.1]},0,false,false);
 for(let i=0;i<8;i++)if(Math.abs(Math.hypot(rig.x[i+1]-rig.x[i],rig.y[i+1]-rig.y[i])-12.5)>1e-8)throw Error('bone length');
 E.poseSpine(rig,{},0,false,false);if([...rig.angles].some(x=>x!==0))throw Error('pose leaked');
 const cv=document.createElement('canvas');cv.width=1200;cv.height=800;cv.id='rig-review';cv.style='position:fixed;inset:0;z-index:999999;background:#bed4d1';document.body.append(cv);const x=cv.getContext('2d');x.fillStyle='#bed4d1';x.fillRect(0,0,1200,800);
 const species=E.species(),list=['legacy',...species].slice(0,4),g=E.randGene();let count=0;
 for(const [row,sp] of list.entries()){const gene={...g,sp:typeof sp==='string'?sp:sp.key};const P=E.slugParts(gene,130);if(!P.rig)throw Error('missing rig');
 for(let col=0;col<3;col++){E.drawSlug(x,P,200+col*390,110+row*190,col===2,0,1,false,false,{noBob:true,bones:col===0?[0,0,0,0,0]:[-.2,-.1,.04,.15,.25]});count++;}if(E.slugParts(gene,130)!==P)throw Error('cache miss');}
 return {count,species:species.length};});
 console.log(result);assert.ok(result.count>=3);await page.locator('#rig-review').screenshot({path:'assets/decor/driftwood/rig-2d-review.png'});assert.deepEqual(errors,[]);console.log('PASS: spine lengths, reset, species rigs, cached art and posed rendering');
}finally{await browser.close();server.close();}
