// Dec grid (4-view decor tool): import, folder of 4 views, painting, rotate-copy, undo, readiness, export readable by the game.
// Isolated browser context — never touches the user's saved tool data.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),shot=process.argv[2],report={},errors=[];
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
const server=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://l').pathname),f=path.resolve(root,'.'+p);if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/Dec%20grid.html`;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true}),p=await context.newPage();
 p.on('pageerror',e=>errors.push(String(e)));p.on('dialog',d=>d.accept());
 await p.addInitScript(()=>{window.showSaveFilePicker=undefined;});
 const key=async k=>{await p.evaluate(()=>document.activeElement?.blur());await p.keyboard.press(k)};
 await p.goto(url);await p.waitForFunction(()=>document.querySelectorAll('#items .item').length>0);
 // name, copy-grid, reference-view and export controls live under the folded "ตั้งค่าเพิ่มเติม"
 await p.click('.advanced-settings > summary');
 // existing game sprite (dragon rock) is imported automatically with 4 frames
 report.imported=await p.evaluate(()=>[...document.querySelectorAll('#items .item small')].map(e=>e.textContent));
 assert.ok(report.imported.includes('sprite_dragon_rock'));
 // new item + key normalisation + duplicate rejection
 await p.click('#bNew');await p.fill('#fName',"หินทดสอบ'มีเครื่องหมาย");await p.fill('#fKey','Test Rock');await p.press('#fKey','Tab');
 assert.equal(await p.inputValue('#fKey'),'sprite_test_rock');
 await p.fill('#fKey','dragon_rock');await p.press('#fKey','Tab');assert.match(await p.textContent('#keyErr'),/มีอยู่แล้ว/);assert.equal(await p.inputValue('#fKey'),'sprite_test_rock');
 // typing digits in a text field must not switch views
 await p.focus('#fCat');await p.keyboard.press('2');assert.equal(await p.evaluate(()=>document.querySelector('.vtab.on').dataset.v),'0');await p.fill('#fCat','หินทดสอบ');await p.press('#fCat','Tab');
 // folder with 4 views → correct paths per view, top-level files preferred over thumbs/
 await p.setInputFiles('#dir','assets/decor-studies/dragon-rock-2d');
 await p.waitForFunction(()=>[...document.querySelectorAll('.vtab small')].filter(s=>/png$/.test(s.textContent)).length===4);
 report.srcs=await p.evaluate(()=>[0,1,2,3].map(i=>{document.querySelector('.vtab[data-v="'+i+'"]').click();return document.getElementById('fSrc').value}));
 assert.deepEqual(report.srcs,['front-0','right-90','back-180','left-270'].map(n=>'assets/decor-studies/dragon-rock-2d/'+n+'.png'));
 await p.waitForFunction(()=>/พบไฟล์/.test(document.getElementById('srcState').textContent));
 // auto anchor from the real pixels (ground contact near the bottom of the art)
 await key('1');await p.click('#bAuto');report.anchor=await p.evaluate(()=>[+document.getElementById('fAx').value,+document.getElementById('fAy').value]);
 assert.ok(report.anchor[1]>0.85&&report.anchor[1]<=1&&report.anchor[0]>0.3&&report.anchor[0]<0.7,'anchor '+report.anchor);
 // uniform scale: side view width follows the front view by pixel ratio
 await p.fill('#fW','30');await p.dispatchEvent('#fW','input');await key('2');
 report.sideW=+(await p.inputValue('#fW'));assert.ok(Math.abs(report.sideW-30*552/702)<0.6,'side width '+report.sideW);await key('1');
 // paint the placement area on the front view (drag with a 2×2 brush), then undo/redo
 await p.click('#mPlace');await p.selectOption('#brush','2');
 const box=await p.locator('#cv').boundingBox(),at=(fx,fy)=>p.evaluate(([x,y])=>{const r=document.getElementById('cv').getBoundingClientRect(),s=S(x,y);return{x:r.left+s.x+3,y:r.top+s.y-3}},[fx,fy]);
 const a=await at(-2,-1),b=await at(1.5,1);await p.mouse.move(a.x,a.y);await p.mouse.down();for(let i=1;i<=12;i++)await p.mouse.move(a.x+(b.x-a.x)*i/12,a.y+(b.y-a.y)*i/12);await p.mouse.up();
 const count=()=>p.evaluate(()=>Object.keys(items[cur].views[view].place).length);report.placeFront=await count();assert.ok(report.placeFront>=8,'painted '+report.placeFront);
 await p.click('#bUndo');assert.equal(await count(),0);await p.click('#bRedo');assert.equal(await count(),report.placeFront);
 await p.click('#mWalk');await p.selectOption('#brush','1');const c=await at(0,0);await p.mouse.click(c.x,c.y);
 // copy the front grid onto the other views, rotated 90° each step (cell count preserved, shape rotated)
 for(const k of ['2','3','4']){await p.keyboard.press(k);await p.click('#bCopyFront');}
 report.rotated=await p.evaluate(()=>items[cur].views.map(v=>Object.keys(v.place).length));assert.ok(report.rotated.every(n=>n===report.placeFront),'rotated counts '+report.rotated);
 report.rotCheck=await p.evaluate(()=>{const f=items[cur].views[0].place,r=items[cur].views[1].place,rot=rotMap(f,1),b0=boxOf(f),b1=boxOf(r),br=boxOf(rot),dx=b1.x0-br.x0,dy=b1.y0-br.y0;
  return{sameShape:Object.keys(rot).every(k=>{const [x,y]=k.split(',').map(Number);return r[keyc(x+dx,y+dy)]===1}),frontEdge:b1.y0===b0.y0,centred:Math.abs((b1.x0+b1.x1)/2-(b0.x0+b0.x1)/2)<=0.25}});
 assert.deepEqual(report.rotCheck,{sameShape:true,frontEdge:true,centred:true});
 // ⭐ reference view: tune the back view, then one click adjusts the other three (size, anchors, rotated grids) — one undo step
 await key('3');await p.fill('#fW','40');await p.dispatchEvent('#fW','input');
 await p.evaluate(()=>{const v=items[cur].views[2];v.place[keyc(3,3)]=1;v.state[keyc(3,3)]=1;items[cur].views[1].anchor={x:.1,y:.5}});
 const before=await p.evaluate(()=>JSON.stringify(items[cur]));await p.click('#bRef');
 report.ref=await p.evaluate(()=>{const it=items[cur];return{ref:it.ref,uniform:it.uniform,widths:[0,1,2,3].map(i=>+wCmOf(it,i).toFixed(2)),anchors:it.views.map(v=>[v.anchor.x,v.anchor.y]),
  placeMatch:it.views.every((v,i)=>JSON.stringify(Object.keys(v.place).sort())===JSON.stringify(Object.keys(transferGrid(it.views[2],(i-2+4)%4).place).sort())),tab:document.querySelector('.vtab[data-v="2"] b').textContent}});
 assert.equal(report.ref.ref,2);assert.equal(report.ref.widths[2],40);assert.ok(Math.abs(report.ref.widths[1]-40*552/702)<0.05&&report.ref.widths[0]===40);
 assert.ok(report.ref.anchors[1][1]>0.85,'side anchor re-detected '+report.ref.anchors[1]);assert.equal(report.ref.placeMatch,true);assert.match(report.ref.tab,/⭐/);
 await p.click('#bUndo');assert.equal(await p.evaluate(()=>JSON.stringify(items[cur])),before,'one undo restores everything');
 await p.evaluate(()=>{const v=items[cur].views[2];delete v.place[keyc(3,3)];delete v.state[keyc(3,3)];refresh()});
 await p.waitForFunction(()=>/พร้อมส่งออก/.test(document.getElementById('readyV').textContent));
 if(shot){await key('1');await p.click('#zFit');await p.waitForTimeout(300);await p.screenshot({path:shot});}
 // export: file evaluates like the game does and contains both items with 4 frames
 const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#bExport')]);const text=fs.readFileSync(await dl.path(),'utf8');
 const ctx={};vm.createContext(ctx);vm.runInContext(text,ctx);const D=vm.runInContext('SPRITE_DECOR_DEFS',ctx);
 report.exported=Object.keys(D);assert.ok(D.sprite_test_rock&&D.sprite_dragon_rock);
 const t=D.sprite_test_rock;assert.equal(t.name,"หินทดสอบ'มีเครื่องหมาย");assert.equal(t.frames.length,4);assert.equal(t.sprite,true);assert.equal(t.flips,'rotate');assert.equal(t.shopFrames,t.frames);
 assert.ok(t.frames.every(f=>f.place.length&&f.src.endsWith('.png')&&f.wCm>0&&f.hCm>0));assert.equal(t.src,t.frames[0].src);assert.equal(t.frames[0].solid.length,1);
 // reload keeps the work and the selection
 await p.reload();await p.waitForFunction(()=>document.querySelectorAll('#items .item').length>0);
 report.afterReload=await p.evaluate(()=>({cur,place:Object.keys(items[cur].views[2].place).length,name:items[cur].name}));assert.equal(report.afterReload.cur,'sprite_test_rock');assert.equal(report.afterReload.place,report.placeFront);
 report.errors=errors;assert.deepEqual(errors,[]);report.passed=true;
}finally{await browser.close();server.close();}
console.log(JSON.stringify(report));
