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
 page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!window.BOOTING&&window.DecorGLB?.ready&&window.Slug3D?.ready,null,{timeout:60000});
 await page.evaluate(async()=>{
  const {SlugCrowd}=await import('/js/slug-crowd.js?v=glass1');
  const update=SlugCrowd.prototype.update;
  SlugCrowd.prototype.update=function(jobs,...rest){const result=update.call(this,jobs,...rest);if(jobs.some(j=>j.tint))window.glassCrowd=this;return result;};
 });
 await page.waitForFunction(()=>window.glassCrowd,null,{timeout:15000});
 const report=[];
 for(let rotation=0;rotation<4;rotation++){
  await page.evaluate(r=>{G.objs.find(o=>o.type==='tank').rot=r;},rotation);
  await page.waitForTimeout(200);
  report.push(await page.evaluate(()=>({rotation:G.objs.find(o=>o.type==='tank').rot,parts:glassCrowd.parts.length,allTinted:glassCrowd.parts.every(p=>p.glass.getW(0)===.5),finite:glassCrowd.parts.every(p=>p.mesh.instanceMatrix.array.every(Number.isFinite)),stats:{...DecorGLB.stats}})));
 }
 const checks=await page.evaluate(()=>{
  const p=glassCrowd.parts[0],shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>\n#include <skinning_pars_vertex>',fragmentShader:'#include <common>\n#include <tonemapping_fragment>\n#include <colorspace_fragment>'};
  p.mesh.material.onBeforeCompile(shader);
  return {afterOutput:shader.fragmentShader.indexOf('gl_FragColor.rgb=mix')>shader.fragmentShader.indexOf('#include <colorspace_fragment>'),geometries:glassCrowd.parts.map(p=>p.mesh.geometry.attributes.crowdGlass.count),capacity:glassCrowd.capacity};
 });
 assert(report.every(r=>r.allTinted&&r.finite));assert(checks.afterOutput);assert(checks.geometries.every(n=>n===checks.capacity));assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(root,'tools/qa/slug-glass.png')});
 console.log(JSON.stringify({report,checks,errors},null,2));
}finally{await browser?.close();server.close();}
