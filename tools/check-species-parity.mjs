// A new-species slug works wherever the old slug works, in the real game over http,
// on a fresh profile — never the player's save.
//  tank: both species drawn, each with its own art
//  slugPartsOf redraws when the species changes · overlay eyes use the species' eye positions
//  world market listings draw the species, not the old slug
// Run from the repo root:  node tools/check-species-parity.mjs [screenshot.png]
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),shot=process.argv[2]||null,errors=[];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.webp':'image/webp'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+(u==='/'?'/index.html':decodeURIComponent(u)));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await (await browser.newContext({viewport:{width:1400,height:900}})).newPage();
 page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.dismiss());
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForFunction(()=>!window.BOOTING&&typeof engineReady!=='undefined'&&engineReady&&typeof G!=='undefined'&&G.objs?.length,null,{timeout:120000});
 const r=await page.evaluate(async()=>{
  const out={has:SlugEngine.hasSpecies('oreo')};
  const t=G.objs.find(o=>o.type==='tank'&&!isBreeder(o)&&!o.def.race&&!o.def.tug&&!o.def.eat&&!o.def.throwing&&!o.def.sumo);
  const legacy=makeSlug(SlugEngine.randGene()),oreo=makeSlug({...SlugEngine.randGene(),sp:'oreo'});
  const cx=t.def.w/2,cy=t.def.h/2;
  Object.assign(legacy,{fx:cx-3,fy:cy,state:'rest',stt:1e9,dir:0,turn:0,_motionHeading:0,flip:true});
  Object.assign(oreo,{fx:cx+3,fy:cy,state:'rest',stt:1e9,dir:0,turn:0,_motionHeading:0,flip:true});
  t.slugs=[legacy,oreo];t.decor=[];enterTank(t);fitTankZoom();centerTankCam();
  await new Promise(r=>setTimeout(r,600));
  out.oreoHit=!!oreo._hit;out.oreoParts=slugPartsOf(oreo).species;out.legacyParts=slugPartsOf(legacy).species;
  // overlay eyes (tank/contests) sit at the species' own eye positions, same drawing path as the old slug
  out.eyes=(slugPartsOf(oreo).face?.eyes||[]).length;
  out.legacyHit=!!legacy._hit;
  return out;});
 if(shots()){   // old slug left, new species right, held still for the picture
  await page.evaluate(()=>{const cx=curTank.def.w/2,cy=curTank.def.h/2;curTank.slugs.forEach((s,i)=>Object.assign(s,{fx:cx+(i?1.4:-1.4),fy:cy,state:'sleep',stt:1e9,dir:0,turn:0,_motionHeading:0,flip:true}));});
  await page.waitForTimeout(600);const box=await page.evaluate(()=>{const p=S(curTank.def.w/2,curTank.def.h/2,SAND_CELLS),r=tankCv.getBoundingClientRect();return{x:r.left+p.x,y:r.top+p.y}});
  await page.screenshot({path:shot,clip:{x:Math.max(0,box.x-380),y:Math.max(0,box.y-260),width:760,height:360}});}
 Object.assign(r,await page.evaluate(async()=>{const out={},oreo=curTank.slugs[1];
  // cached parts follow a species change
  const s2=makeSlug(SlugEngine.randGene());out.before=slugPartsOf(s2).species;s2.genes.sp='oreo';out.after=slugPartsOf(s2).species;
  // world market: a listed new-species slug is drawn as that species
  const seen=[],orig=window.drawSlugPortrait;window.drawSlugPortrait=(cv,d)=>{seen.push(d?.genes?.sp||'legacy');return orig(cv,d);};
  const m=WorldMarket.market(),L={key:'Lspecies-test',id:oreo.id,genes:{...oreo.genes},slug:_saveSlug(oreo),value:100,ask:100,listedAt:Date.now(),simAt:Date.now(),prog:0,jitter:1};
  m.listings.push(L);openWorldMarket();await new Promise(r=>setTimeout(r,100));
  out.marketDrew=seen;document.getElementById('worldMarket').close();m.listings.splice(m.listings.indexOf(L),1);window.drawSlugPortrait=orig;
  return out;}));
 console.log(JSON.stringify(r));
 assert.ok(r.has,'species data loaded');
 assert.ok(r.oreoHit,'new species drawn (2D) in the tank');assert.equal(r.oreoParts,'oreo');assert.equal(r.legacyParts,'legacy');
 assert.ok(r.eyes>0,'species eye positions');
 assert.equal(r.before,'legacy');assert.equal(r.after,'oreo','parts cache follows species');
 assert.ok(r.marketDrew.includes('oreo'),'market listing drawn as the species');
 assert.ok(r.legacyHit,'old slug drawn in the tank');
 assert.deepEqual(errors,[],'no page errors');console.log('PASS: both species drawn, parts cache, eyes, market');
}finally{await browser.close();server.close();}
function shots(){return !!shot;}
