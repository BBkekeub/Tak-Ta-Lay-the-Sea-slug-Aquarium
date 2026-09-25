import {createRequire} from 'node:module';import path from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const b=await chromium.launch({channel:'chrome',headless:true});
try{const p=await b.newPage({viewport:{width:1400,height:860}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
const url=pathToFileURL(path.resolve('tools/custom-editor/Custom.html')).href,ready=()=>p.waitForFunction(()=>IMG.oreo_horn_white&&doc.layers.length);await p.goto(url,{waitUntil:'domcontentloaded'});await ready();
// page fits the window, stage fills free space, paper is fitted and centred
const m=await p.evaluate(()=>{const s=stageEl().getBoundingClientRect();return{docH:document.documentElement.scrollHeight,stageH:s.height,stageW:s.width,z,offX,offY}});
assert.ok(m.docH<=860,'no page scroll');assert.ok(m.stageH>500,'stage uses the height');assert.ok(Math.abs(m.offX*2+1000*m.z-m.stageW)<2&&Math.abs(m.offY*2+740*m.z-m.stageH)<2,'fit centres paper');
// default folding: core cards open, tools folded
const fold=()=>p.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.card>h2.fold-h')].map(h=>[h.firstChild.textContent.trim(),h.parentElement.classList.contains('folded')])));
let f=await fold();assert.equal(f['ชิ้นส่วน'],false);assert.equal(f['ชั้นเลเยอร์'],false);assert.equal(f['กระดูก 2D'],true);assert.equal(f['จัดแอนิเมชัน'],true);
await p.locator('.card>h2.fold-h',{hasText:'กระดูก 2D'}).click();assert.equal((await fold())['กระดูก 2D'],false);
// splitter resize
const sp=await p.locator('.rail-split').boundingBox();const w0=await p.evaluate(()=>document.querySelector('.rail').getBoundingClientRect().width);
await p.mouse.move(sp.x+4,sp.y+200);await p.mouse.down();await p.mouse.move(sp.x-116,sp.y+200,{steps:5});await p.mouse.up();
const w1=await p.evaluate(()=>document.querySelector('.rail').getBoundingClientRect().width);assert.ok(Math.abs(w1-w0-120)<3,`rail widened ${w0}->${w1}`);
const zBefore=await p.evaluate(()=>z);assert.ok(zBefore>0);
// backslash hides panel, but not while typing
await p.locator('#fName').count();await p.locator('#railSearch').focus();await p.keyboard.press('Backslash');assert.equal(await p.evaluate(()=>document.body.classList.contains('rail-hidden')),false,'typing keeps panel');
await p.locator('#railSearch').fill('');await p.evaluate(()=>document.activeElement.blur());await p.keyboard.press('Backslash');assert.equal(await p.evaluate(()=>document.body.classList.contains('rail-hidden')),true);
const wide=await p.evaluate(()=>stageEl().getBoundingClientRect().width);assert.ok(wide>1300,'stage takes full width when panel hidden');
await p.locator('#bRail').click();assert.equal(await p.evaluate(()=>document.body.classList.contains('rail-hidden')),false);
// search opens matching card, hides others
await p.locator('#railSearch').fill('ข้อต่อ');const vis=await p.evaluate(()=>[...document.querySelectorAll('.rail>.card:not(.search-miss)')].length);assert.ok(vis>=2&&vis<6,'search filters');await p.locator('#railSearch').fill('');
// editing still works: drag a layer on stage and undo
const n=await p.evaluate(()=>doc.layers.length);await p.locator('.pbtn').first().click();assert.equal(await p.evaluate(()=>doc.layers.length),n+1);await p.keyboard.press('Control+z');assert.equal(await p.evaluate(()=>doc.layers.length),n);
// window resize keeps working and preferences survive reload
await p.setViewportSize({width:1100,height:700});await p.waitForTimeout(150);assert.ok(await p.evaluate(()=>document.documentElement.scrollHeight<=700));
await p.reload({waitUntil:'domcontentloaded'});await ready();await p.setViewportSize({width:1400,height:860});await p.waitForTimeout(150);
const w2=await p.evaluate(()=>document.querySelector('.rail').getBoundingClientRect().width);assert.ok(Math.abs(w2-w1)<3,'width remembered');assert.equal((await fold())['กระดูก 2D'],false,'fold remembered');
// narrow window falls back to scrolling single column
await p.setViewportSize({width:760,height:900});await p.waitForTimeout(150);const narrow=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,split:getComputedStyle(document.querySelector('.rail-split')).display}));assert.ok(narrow.sw<=760,'no horizontal scroll');assert.equal(narrow.split,'none');
console.log(JSON.stringify({fitsWindow:m,defaultsFolded:true,splitter:[w0,w1],hidePanel:true,typingSafe:true,search:vis,editingIntact:true,persisted:true,narrow,errors}));assert.equal(errors.length,0)}finally{await b.close()}
