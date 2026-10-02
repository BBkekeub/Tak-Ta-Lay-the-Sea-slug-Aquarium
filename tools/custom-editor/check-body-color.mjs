// Imported body art counts as the body reference, and changing a colour recolours the stage even if the preview toggle was off.
import {createRequire} from 'node:module';import path from 'node:path';import fs from 'node:fs';import os from 'node:os';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'body-')),art=path.join(tmp,'body-white-side-v2.png');fs.copyFileSync('assets/oreo2d/body-white-v1.png',art);
const b=await chromium.launch({channel:'chrome',headless:true});
try{const p=await b.newPage({viewport:{width:1460,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
await p.goto(pathToFileURL(path.resolve('tools/custom-editor/Custom.html')).href,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>IMG.oreo_horn_white&&doc.layers.length&&doc.species);
// the user's situation: legacy body removed, imported side-view body + Oreo pieces, preview off
await p.evaluate(()=>{doc.layers=doc.layers.filter(L=>L.part!=='body');afterChange()});
assert.match(await p.textContent('#status'),/ยังไม่มีลำตัว/);
const n=await p.evaluate(()=>Object.keys(doc.parts).length);await p.locator('#cInput').setInputFiles(art);await p.waitForFunction(k=>Object.keys(doc.parts).length>k,n);
const bodyId=await p.evaluate(()=>{const k=Object.keys(doc.parts).find(k=>/body-white-side-v2/.test(PARTS[k]?.th||doc.parts[k].th||''))||Object.keys(doc.parts).at(-1);const L=doc.layers.find(l=>l.part===k)||addLayer(k,{x:500,y:420});afterChange();return L.id});
const st=await p.textContent('#status');assert.match(st,/กล่องลำตัว/,'imported body is the reference: '+st);
assert.equal(await p.evaluate(()=>bodyLayer()?.name),await p.evaluate(id=>byId(id).name,bodyId));
assert.equal(await p.evaluate(()=>document.getElementById('genePreviewOn').checked),false);
// change a colour without touching the toggle → preview switches on and the body is recoloured
await p.evaluate(()=>document.getElementById('railOpenAll').click());
await p.locator('#geneRows input[data-gene="mainC"]').fill('100');await p.waitForTimeout(300);
assert.equal(await p.evaluate(()=>document.getElementById('genePreviewOn').checked),true);
const px=await p.evaluate(id=>{const n=document.querySelector('.ly[data-id="'+id+'"]').firstElementChild;if(n.tagName!=='CANVAS')return null;return[...n.getContext('2d').getImageData(Math.floor(n.width/2),Math.floor(n.height*.55),1,1).data].slice(0,3)},bodyId);
assert.ok(px&&px[0]>px[2]+30,'body turned wine-red '+px);
// a path-referenced piece that can't be read is reported in the card (not only a toast)
await p.evaluate(()=>{doc.parts.pathpiece={src:'../../assets/oreo2d/rhinophore-white-v1.png',th:'หนวดจากพาธ',nat:.3,ax:.5,ay:.96,species:'oreo'};});await p.evaluate(()=>refreshCustomParts()).catch(()=>{});
await p.evaluate(()=>{if(PARTS.pathpiece){addLayer('pathpiece',{x:700,y:300});afterChange()}});await p.waitForTimeout(600);
const warn=await p.textContent('#geneWarn');
assert.match(warn,/ย้อมไม่ได้ 1 ชิ้น/);console.log(JSON.stringify({bodyReference:true,autoPreview:true,bodyPixel:px,blockedNotice:warn,errors}));assert.equal(errors.length,0)}finally{await b.close();fs.rmSync(tmp,{recursive:true,force:true})}
