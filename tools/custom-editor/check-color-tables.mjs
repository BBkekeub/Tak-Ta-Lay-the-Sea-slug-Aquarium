import {createRequire} from 'node:module';import path from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const b=await chromium.launch({channel:'chrome',headless:true});
const shot=process.argv[2];
try{const p=await b.newPage({viewport:{width:1460,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
const ready=()=>p.waitForFunction(()=>IMG.oreo_horn_white&&doc.layers.length&&doc.colorTables);await p.goto(pathToFileURL(path.resolve('tools/custom-editor/Custom.html')).href,{waitUntil:'domcontentloaded'});await ready();
await p.evaluate(()=>{document.getElementById('railOpenAll').click();doc.layers=[];doc.groups=[];addLayer('oreo_body_white',{x:500,y:420});setSel([]);afterChange()});
const stripPx=v=>p.evaluate(v=>{const c=document.getElementById('ctCanvas'),x=Math.round(v/400*(c.width-1));return[...c.getContext('2d').getImageData(x,Math.round(c.height/2),1,1).data].slice(0,3)},v);
const stagePx=()=>p.evaluate(()=>{const n=document.querySelector('.ly[data-id="'+doc.layers[0].id+'"]').firstElementChild;return n.tagName==='CANVAS'?[...n.getContext('2d').getImageData(Math.floor(n.width/2),Math.floor(n.height*.55),1,1).data].slice(0,3):null});
// strip shows the in-between colour for any value
assert.equal(await p.locator('#ctMarks .ct-mark').count(),9);
const mid=await stripPx(225);assert.ok(Math.abs(mid[0]-167)<6&&Math.abs(mid[1]-204)<6&&Math.abs(mid[2]-233)<6,'225 = halfway white→blue '+mid);
// scrubbing the slider drives the stage preview through the linked gene (body table → mainC)
await p.locator('#genePreviewOn').check();await p.locator('#ctScrub').fill('300');await p.waitForTimeout(250);
assert.equal(await p.evaluate(()=>+document.querySelector('#geneRows input[data-gene="mainC"]').value),300);assert.match(await p.locator('#ctRead').textContent(),/เขียวมิ้นต์/);const green=await stagePx();assert.ok(green[1]>green[0]+20,'green stage '+green);
// dragging on the strip also scrubs
const box=await p.locator('#ctStrip').boundingBox();await p.mouse.move(box.x+box.width*.25,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width*.125,box.y+box.height/2,{steps:4});await p.mouse.up();
assert.ok(Math.abs(await p.evaluate(()=>+document.getElementById('ctScrub').value)-50)<=2,'strip drag scrubs');
// pick the colour of anchor 250 from the RGB picker
await p.locator('.ct-mark[data-k="5"]').click();assert.equal(await p.evaluate(()=>+document.getElementById('ctScrub').value),250);
await p.locator('#ctAnchor input[data-tone="M"]').fill('#ff2040');await p.waitForTimeout(250);
assert.deepEqual(await p.evaluate(()=>doc.colorTables.body.anchors[5].M),[255,32,64]);const red=await stripPx(250);assert.ok(red[0]>200&&red[1]<80,'strip anchor red '+red);
const redStage=await stagePx();assert.ok(redStage[0]>redStage[2],'stage follows edited anchor '+redStage);
const between=await stripPx(275);assert.ok(between[0]>150&&between[1]>80,'in-between blends red→mint '+between);
// auto tones, then undo back to the edited colour, then reset to default
await p.locator('#ctAuto').click();const auto=await p.evaluate(()=>doc.colorTables.body.anchors[5]);const lum=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;assert.ok(lum(auto.L)>lum(auto.M)&&lum(auto.D)<lum(auto.M),'auto tones lighter/darker '+JSON.stringify(auto));
await p.evaluate(()=>undo());assert.deepEqual(await p.evaluate(()=>doc.colorTables.body.anchors[5].L),[226,239,248]);
await p.evaluate(()=>{document.getElementById('ctPick').dispatchEvent(new Event('change'))});await p.locator('#ctReset').click();assert.deepEqual(await p.evaluate(()=>doc.colorTables.body.anchors[5].M),[123,194,244]);
await p.evaluate(()=>undo());assert.deepEqual(await p.evaluate(()=>doc.colorTables.body.anchors[5].M),[255,32,64]);
// custom table for a species pattern, usable from the species channel form
await p.locator('#ctNew').click();const tk=await p.evaluate(()=>Object.keys(doc.colorTables).find(k=>k!=='body'&&k!=='gill'));assert.ok(tk);
await p.locator('#ctName').fill('สีลายโอรีโอ');await p.locator('#ctName').press('Tab');assert.equal(await p.evaluate(k=>doc.colorTables[k].th,tk),'สีลายโอรีโอ');
await p.locator('#speciesCard [data-f="pick"]').selectOption('oreo');assert.ok(await p.locator('#speciesCard [data-f="ch.table"]').first().locator(`option[value="${tk}"]`).count());
await p.locator('#speciesCard .sp-ch[data-i="0"] [data-f="ch.table"]').selectOption(tk);assert.equal(await p.evaluate(()=>doc.species.find(s=>s.key==='oreo').channels[0].color.table),tk);
if(shot){await p.evaluate(()=>{fit()});await p.locator('#colorTables').scrollIntoViewIfNeeded();await p.screenshot({path:shot})}
// export/import and reload keep tables
const ex=await p.evaluate(()=>{exportJSON();return JSON.parse($('out').value).colorTables});assert.deepEqual(ex.body.anchors[5].M,[255,32,64]);assert.equal(ex[tk].th,'สีลายโอรีโอ');
await p.evaluate(()=>{doc.colorTables.body.anchors[5].M=[0,0,0]});await p.locator('#bImport').click();await p.waitForFunction(()=>doc.colorTables.body.anchors[5].M[0]===255);
await p.reload({waitUntil:'domcontentloaded'});await ready();assert.deepEqual(await p.evaluate(()=>doc.colorTables.body.anchors[5].M),[255,32,64]);
// deleting the custom table sends its channels back to a default table
await p.evaluate(()=>document.getElementById('railOpenAll').click());await p.locator('#ctPick').selectOption(tk);await p.locator('#ctDel').click();
assert.equal(await p.evaluate(()=>doc.species.find(s=>s.key==='oreo').channels[0].color.table),'body');assert.equal(await p.evaluate(k=>!!doc.colorTables[k],tk),false);
console.log(JSON.stringify({strip9Anchors:true,midBlend:mid,scrubDrivesPreview:green,stripDrag:true,pickAnchor:red,stageFollows:redStage,between,autoTones:true,undo:true,reset:true,customTable:tk,exportImport:true,reload:true,deleteFallback:true,errors}));assert.equal(errors.length,0)}finally{await b.close()}
