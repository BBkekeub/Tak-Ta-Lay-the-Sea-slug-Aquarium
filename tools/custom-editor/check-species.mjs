import {createRequire} from 'node:module';import path from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const b=await chromium.launch({channel:'chrome',headless:true});
const shot=process.argv[2];
try{const p=await b.newPage({viewport:{width:1460,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
const ready=()=>p.waitForFunction(()=>IMG.oreo_horn_white&&doc.layers.length&&doc.species);await p.goto(pathToFileURL(path.resolve('tools/custom-editor/Custom.html')).href,{waitUntil:'domcontentloaded'});await ready();
await p.evaluate(()=>document.getElementById('railOpenAll').click());
// defaults
assert.deepEqual(await p.evaluate(()=>doc.species.map(s=>[s.key,s.code,s.no])),[['legacy','LOCHI',1],['oreo','OREO',2],['shared','SHARED',0]]);
// a small Oreo on stage
await p.evaluate(()=>{doc.layers=[];doc.groups=[];const B=addLayer('oreo_body_white',{x:500,y:420});addLayer('oreo_gill_white',{x:420,y:330});addLayer('oreo_horn_white',{x:700,y:330});setSel([B.id]);afterChange()});
const card=p.locator('#speciesCard'),field=f=>card.locator(`[data-f="${f}"]`).first(),setField=async(f,v)=>{await field(f).fill(v);await field(f).press('Tab')};
await field('pick').selectOption('oreo');
// invalid + duplicate values are rejected with a fixable reason
await setField('code','9bad');assert.match(await p.locator('#spErr').textContent(),/ขึ้นต้นด้วยตัวอักษร/);
await setField('code','lochi');assert.match(await p.locator('#spErr').textContent(),/ซ้ำ/);
await setField('no','1');assert.match(await p.locator('#spErr').textContent(),/ซ้ำ/);
// valid edits
await setField('code','OREO_NB');await setField('no','12');await setField('en','Jorunna oreo');
let o=await p.evaluate(()=>doc.species.find(s=>s.key==='oreo'));assert.equal(o.code,'OREO_NB');assert.equal(o.no,12);assert.equal(o.en,'Jorunna oreo');
// species gene + pattern channel that follows it
await card.locator('[data-a="addgene"]').click();await card.locator('[data-a="addch"]').click();
o=await p.evaluate(()=>doc.species.find(s=>s.key==='oreo'));const gk=o.genes[0].key,chIdx=o.channels.length-1;
await card.locator(`.sp-ch[data-i="${chIdx}"] [data-f="ch.src"]`).selectOption('gene');await card.locator(`.sp-ch[data-i="${chIdx}"] [data-f="ch.gene"]`).selectOption(gk);
o=await p.evaluate(()=>doc.species.find(s=>s.key==='oreo'));assert.equal(o.channels.at(-1).color.gene,gk);
// automatic channels for the three Oreo pieces
const autos=await p.evaluate(()=>{exportJSON();return JSON.parse($('out').value).layers.map(e=>e.channel)});assert.deepEqual(autos,['body','gill','rhino']);
// explicit channel on the gill, undo/redo
await p.evaluate(()=>{setSel([doc.layers[1].id]);syncPanel()});await p.locator('#layerChannel').selectOption(o.channels.at(-1).id);
assert.equal(await p.evaluate(()=>doc.layers[1].channel),o.channels.at(-1).id);await p.evaluate(()=>{document.activeElement.blur();undo()});assert.equal(await p.evaluate(()=>doc.layers[1].channel),undefined);await p.evaluate(()=>redo());
// preview: stage pixels follow mainC; canvases reused when nothing relevant changed
await p.locator('#genePreviewOn').check();
const px=()=>p.evaluate(()=>{const n=document.querySelector('.ly[data-id="'+doc.layers[0].id+'"]').firstElementChild;if(n.tagName!=='CANVAS')return null;return[...n.getContext('2d').getImageData(Math.floor(n.width/2),Math.floor(n.height*.55),1,1).data]});
const white=await px();assert.ok(white,'body recoloured into a canvas');
await p.locator('#geneRows input[data-gene="mainC"]').fill('250');await p.waitForTimeout(250);const blue=await px();assert.ok(blue[2]>blue[0]+30,'blue body '+blue);
const same=await p.evaluate(()=>{const id=doc.layers[0].id,before=document.querySelector('.ly[data-id="'+id+'"]').firstElementChild;renderLayers();z*=1.3;applyView();return document.querySelector('.ly[data-id="'+id+'"]').firstElementChild===before});assert.ok(same,'canvas reused across re-render and zoom');
await p.locator('#geneRows input[data-gene="bodyDepth"]').fill('100');await p.waitForTimeout(250);const deep=await px();assert.notDeepEqual(deep,blue,'groove gene changes pixels');
await p.locator('#geneRows input[data-gene="bodyDepth"]').fill('45');await p.waitForTimeout(250);
if(shot){await p.evaluate(()=>{fit();setSel([]);syncPanel()});await p.locator('#speciesCard').scrollIntoViewIfNeeded();await p.screenshot({path:shot})}
// preview off → original image back
await p.locator('#genePreviewOn').uncheck();assert.equal(await p.evaluate(()=>document.querySelector('.ly[data-id="'+doc.layers[0].id+'"]').firstElementChild.tagName),'IMG');
// export / import round trip + reload persistence
const exported=await p.evaluate(()=>{exportJSON();return JSON.parse($('out').value)});assert.equal(exported.version,5);assert.equal(exported.species.find(s=>s.key==='oreo').code,'OREO_NB');
await p.evaluate(()=>{doc.species.find(s=>s.key==='oreo').code='TEMP';doc.layers[1].channel='body'});await p.locator('#bImport').click();await p.waitForFunction(()=>doc.species.find(s=>s.key==='oreo').code==='OREO_NB');
assert.equal(await p.evaluate(()=>doc.layers[1].channel),exported.layers[1].channel);
await p.reload({waitUntil:'domcontentloaded'});await ready();o=await p.evaluate(()=>doc.species.find(s=>s.key==='oreo'));assert.equal(o.no,12);assert.equal(o.genes.length,1);
// deleting a species moves its pieces to shared, undo restores it
await p.evaluate(()=>document.getElementById('railOpenAll').click());await field('pick').selectOption('oreo');await card.locator('[data-a="del"]').click();
assert.equal(await p.evaluate(()=>doc.layers.every(L=>speciesOfLayer(L)==='shared')),true);await p.evaluate(()=>undo());assert.equal(await p.evaluate(()=>!!doc.species.find(s=>s.key==='oreo')&&speciesOfLayer(doc.layers[0])==='oreo'),true);
console.log(JSON.stringify({defaults:true,rejectsBadCode:true,rejectsDuplicates:true,edits:true,speciesGene:gk,autoChannels:autos,undoChannel:true,preview:{white,blue,deep},reuseOnRerenderZoom:true,previewOff:true,jsonRoundtrip:true,reload:true,deleteUndo:true,errors}));assert.equal(errors.length,0)}finally{await b.close()}
