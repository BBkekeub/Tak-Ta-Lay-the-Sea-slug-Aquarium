// Heavy scene like the user's (imported side body + Oreo pack + 11 spots, colour preview on): clicks/drags must not block the page.
import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import {createRequire} from 'node:module';import path from 'node:path';import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const file='tools/custom-editor/Custom.html',tmp=fs.mkdtempSync(path.join(os.tmpdir(),'heavy-')),art=path.join(tmp,'body-white-side-v2.png');fs.copyFileSync('assets/oreo2d/body-white-v1.png',art);
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1600,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
await p.addInitScript(()=>{window.__long=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__long.push(Math.round(e.duration))}).observe({type:'longtask',buffered:true});});
await p.goto(pathToFileURL(path.resolve(file)).href,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>IMG.oreo_gill_white&&doc.layers.length);await p.waitForTimeout(800);
// build the user's scene: imported side body + Oreo gills/horns + eyes + 11 spots, preview on
const n=await p.evaluate(()=>Object.keys(doc.parts).length);await p.locator('#cInput').setInputFiles(art);await p.waitForFunction(k=>Object.keys(doc.parts).length>k,n);
await p.evaluate(()=>{const bodyKey=Object.keys(doc.parts).at(-1);doc.layers=doc.layers.filter(L=>/spot|eye/.test(L.part)||L.part==='eye');const spots=doc.layers.filter(L=>/spot/.test(L.part));while(doc.layers.filter(L=>/spot/.test(L.part)).length<11&&spots[0])addLayer(spots[0].part,{x:300+Math.random()*400,y:350+Math.random()*80});
 const B=addLayer(bodyKey,{x:500,y:430});doc.layers.unshift(doc.layers.pop());addLayer('oreo_gill_white',{x:420,y:330});addLayer('oreo_gill_white',{x:470,y:320});addLayer('oreo_horn_white',{x:690,y:330});addLayer('oreo_horn_white',{x:720,y:335});afterChange()});
await p.evaluate(()=>{const on=document.getElementById('genePreviewOn');if(on&&!on.checked){on.checked=true;on.dispatchEvent(new Event('change'))}});
await p.waitForTimeout(500);const mark=async(label,fn)=>{await p.evaluate(()=>window.__long=[]);const s=Date.now();await fn();await p.waitForTimeout(400);const long=await p.evaluate(()=>window.__long);return{label,wall:Date.now()-s-400,long}};
const box=await p.locator('#stage').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height*.55;const out=[];
out.push(await mark('click stage x5',async()=>{for(let i=0;i<5;i++)await p.mouse.click(cx+i*20,cy)}));
out.push(await mark('drag layer',async()=>{await p.mouse.move(cx,cy);await p.mouse.down();for(let i=0;i<20;i++)await p.mouse.move(cx+i*4,cy+i);await p.mouse.up()}));
out.push(await mark('fold card',async()=>{await p.locator('.card>h2.fold-h').first().click()}));
out.push(await mark('gene slider',async()=>{await p.evaluate(()=>document.getElementById('railOpenAll').click());await p.locator('#geneRows input[data-gene="mainC"]').fill('100')}));
out.push(await mark('undo',async()=>{await p.keyboard.press('Control+z')}));
console.log(JSON.stringify({out,layers:await p.evaluate(()=>doc.layers.length),docMB:await p.evaluate(()=>(JSON.stringify(doc).length/1e6).toFixed(2)),outMB:await p.evaluate(()=>($('out').value.length/1e6).toFixed(2)),errors}));
const worst=Math.max(0,...out.filter(o=>/click|drag/.test(o.label)).flatMap(o=>o.long));assert.ok(worst<100,'longest click/drag task '+worst+' ms');
const ex=await p.evaluate(()=>{exportJSON();const o=JSON.parse($('out').value);return{layers:o.layers.length,species:Array.isArray(o.species),channel:o.layers.some(l=>l.channel==='body')}});assert.deepEqual(ex,{layers:15,species:true,channel:true});
const exportBox=await p.evaluate(()=>{const n=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value'),out=document.getElementById('out');const shown=n.get.call(out),full=out.value;return{shown:shown.length,full:full.length,fullHasImage:/base64,[A-Za-z0-9+/]{5000}/.test(full),parses:!!JSON.parse(full).layers,palette:[...document.querySelectorAll('#palette img')].reduce((k,im)=>k+im.src.length,0)}});
assert.ok(exportBox.shown<200000&&exportBox.full>1000000&&exportBox.fullHasImage&&exportBox.parses,'export box '+JSON.stringify(exportBox));assert.ok(exportBox.palette<2000000,'palette thumbs '+exportBox.palette);
assert.ok(box.shown<200000&&box.full>1000000&&box.fullHasImage&&box.parses,'export box '+JSON.stringify(box));assert.ok(box.palette<2000000,'palette thumbs '+box.palette);
assert.equal(errors.length,0);await b.close();fs.rmSync(tmp,{recursive:true,force:true});
