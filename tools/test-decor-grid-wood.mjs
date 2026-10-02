import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),errors=[];const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404).end();return}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'image/png');fs.createReadStream(f).pipe(res)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1500,height:1000},acceptDownloads:true});const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.addInitScript(()=>window.showSaveFilePicker=undefined);
 await p.goto(`http://127.0.0.1:${server.address().port}/Dec%20Grid.html`);await p.waitForFunction(()=>typeof DECOR_GRID_EDITABLE!=='undefined'&&DECOR_GRID_EDITABLE.size===16&&[...DECOR_GRID_EDITABLE].every(k=>items[k].views.every(v=>v.pxW>0)));
 // a hand-authored 2.5 cm piece; mesh-derived pieces (gridSource, e.g. Talawa sweep) start at 1 cm with crawl paths
 const key='sprite_driftwood_talawa_fork';await p.click(`[data-k="${key}"]`);
 const anchors=await p.evaluate(()=>it().views.map(v=>v.anchor));const shop=await p.evaluate(()=>SPRITE_DECOR_DEFS[cur].shopFrames.map(f=>f.src));
 await p.fill('#areaW','10');await p.fill('#areaH','7.5');await p.click('#bArea');assert.equal(await p.evaluate(()=>Object.keys(vw().place).length),12);
 await p.click('#tWalk');await p.selectOption('#brush','1');
 const point=await p.evaluate(()=>{const r=cv.getBoundingClientRect(),q=S(-.25,.25);return{x:r.x+q.x,y:r.y+q.y}});await p.mouse.click(point.x,point.y);
 assert.equal(await p.evaluate(()=>vw().state['-0.5,0']),undefined);assert.equal(await p.evaluate(()=>vw().place['-0.5,0']),1);
 await p.click('#bUndo');assert.equal(await p.evaluate(()=>vw().state['-0.5,0']),1);await p.click('#bRedo');
 await p.click('#bMasks');assert.deepEqual(await p.evaluate(()=>it().views.map(v=>v.anchor)),anchors);
 const masks=await p.evaluate(()=>it().views.map(v=>({place:v.place,state:v.state})));assert.ok(masks.every(v=>Object.keys(v.place).length===12&&Object.keys(v.state).length===11));
 assert.equal(masks[1].place['-0.5,-0.5'],1);assert.equal(masks[1].state['-0.5,-0.5'],undefined,'corridor rotates around ground origin');
 await p.click('#zFit');await p.screenshot({path:'assets/decor/driftwood/natural-v1/grid-editor.png'});
 const [download]=await Promise.all([p.waitForEvent('download'),p.click('#bGameGrid')]);assert.equal(download.suggestedFilename(),'decor-grid-overrides.js');
 const text=fs.readFileSync(await download.path(),'utf8'),ctx={SPRITE_DECOR_DEFS:{}};vm.createContext(ctx);vm.runInContext(text,ctx);
 const d=ctx.SPRITE_DECOR_DEFS[key];assert.equal(Object.keys(ctx.SPRITE_DECOR_DEFS).length,16);assert.deepEqual(Array.from(d.shopFrames,f=>f.src),shop);assert.equal(d.frames[0].solid.length,11);assert.equal(d.frames[0].place.length,12);assert.equal(d.shopRotationSign,-1);
 // Use the actual game's collision adapter with exported data, not an editor-only approximation.
 Object.assign(ctx,{TANK_DECOR:ctx.SPRITE_DECOR_DEFS,DCELL:.5,document:{hidden:false,addEventListener(){}},drawDecorAt(){},flipOptions(){},decorCellSet(){},decorSolidSet(){return new Set()},decorFootprint(){},decorRequiredBounds(){}});
 vm.runInContext(fs.readFileSync('js/sprite-decor-runtime.js','utf8'),ctx);
 assert.equal(vm.runInContext(`SpriteDecor.cellSet('${key}',0,0,0,'solid').has('-1,0')`,ctx),false);
 assert.equal(vm.runInContext(`SpriteDecor.cellSet('${key}',0,0,0,'place').has('-1,0')`,ctx),true);
 assert.equal(vm.runInContext(`SpriteDecor.cellSet('${key}',0,0,1,'solid').has('-1,-1')`,ctx),false);
 await p.reload();await p.waitForFunction(()=>typeof cur!=='undefined'&&cur==='sprite_driftwood_talawa_fork');assert.equal(await p.evaluate(()=>Object.keys(vw().state).length),11);
 // Fine grid survives editor selection, undo, rotation, export and reload.
 await p.selectOption('#gridStep','0.2');assert.equal(await p.evaluate(()=>STEP),.2);
 await p.click('#bUndo');assert.equal(await p.evaluate(()=>STEP),.5);await p.click('#bRedo');assert.equal(await p.evaluate(()=>STEP),.2);
 await p.fill('#areaW','3');await p.fill('#areaH','2');await p.click('#bArea');assert.equal(await p.evaluate(()=>Object.keys(vw().place).length),6);
 await p.click('#tWalk');const finePoint=await p.evaluate(()=>{const r=cv.getBoundingClientRect(),q=S(.1,.1);return{x:r.x+q.x,y:r.y+q.y}});await p.mouse.click(finePoint.x,finePoint.y);await p.click('#bMasks');
 const fine=await p.evaluate(()=>defOf(it()));assert.equal(fine.cell,.2);assert.equal(fine.frames[0].solid.length,5);
 const original=await p.evaluate(()=>defOf(items.sprite_driftwood));assert.equal(original.cell,.5,'export uses each item resolution');
 const fineCtx={...ctx,TANK_DECOR:{fine,legacy:original}};vm.createContext(fineCtx);
 delete fineCtx.DCELL;
 const tank=fs.readFileSync('js/tank-view.js','utf8');vm.runInContext(tank.slice(tank.indexOf('const DCELL='),tank.indexOf('function flipOptions(')),fineCtx);
 vm.runInContext(fs.readFileSync('js/sprite-decor-runtime.js','utf8'),fineCtx);
 assert.equal(vm.runInContext('DCELL',fineCtx),.1);
 assert.equal(vm.runInContext("SpriteDecor.cellSet('fine',0,0,0,'solid').size",fineCtx),20);
 assert.equal(vm.runInContext("SpriteDecor.cellSet('fine',0,0,0,'solid').has('0,0')",fineCtx),false);
 assert.equal(vm.runInContext("SpriteDecor.cellSet('fine',0,0,0,'solid').has('-1,0')",fineCtx),true);
 assert.equal(vm.runInContext("(()=>{const s=new Set();addDecorMaskCell(s,0,0);return s.size})()",fineCtx),25,'legacy 2.5cm still occupies full area');
 await p.evaluate(()=>persistNow());await p.reload();await p.waitForFunction(()=>typeof STEP!=='undefined'&&STEP===.2);assert.equal(await p.inputValue('#gridStep'),'0.2');assert.equal(await p.evaluate(()=>Object.keys(vw().state).length),5);
 await p.click('#bFineBrush');assert.equal(await p.evaluate(()=>STEP),.1);assert.equal(await p.evaluate(()=>brush),1);
 await p.fill('#areaW','1');await p.fill('#areaH','1');await p.click('#bArea');assert.equal(await p.evaluate(()=>Object.keys(vw().state).length),4);
 await p.click('#tWalk');const tiny=await p.evaluate(()=>{const r=cv.getBoundingClientRect(),q=S(.05,.05);return{x:r.x+q.x,y:r.y+q.y}});await p.mouse.click(tiny.x,tiny.y);assert.equal(await p.evaluate(()=>Object.keys(vw().state).length),3,'small brush erases exactly one 0.5cm cell');
 await p.click('#bOneCmBrush');assert.equal(await p.evaluate(()=>brush),2);assert.equal(await p.evaluate(()=>STEP),.1);
 await p.evaluate(()=>persistNow());await p.reload();await p.waitForFunction(()=>typeof STEP!=='undefined'&&STEP===.1);assert.equal(await p.evaluate(()=>Object.keys(vw().state).length),3);
 const beforeClear=await p.evaluate(()=>JSON.stringify(items));
 await p.click('#bClearAllViews');assert.equal(await p.evaluate(()=>it().views.every(v=>['place','state'].every(k=>Object.keys(v[k]||{}).length===0))),true);
 const history=await p.evaluate(()=>undoStack.length);await p.click('#bClearAllViews');assert.equal(await p.evaluate(()=>undoStack.length),history,'empty clear does not replace undo');
 await p.click('#bUndo');assert.equal(await p.evaluate(()=>JSON.stringify(items)),beforeClear,'restores every layer, keeps images and other items');
 await p.click('#bRedo');await p.evaluate(()=>persistNow());await p.reload();await p.waitForFunction(()=>typeof cur!=='undefined'&&cur==='sprite_driftwood_talawa_fork');assert.equal(await p.evaluate(()=>it().views.every(v=>['place','state'].every(k=>Object.keys(v[k]||{}).length===0))),true);
 await p.screenshot({path:'assets/decor/driftwood/natural-v1/grid-editor-1cm.png'});
 assert.equal(await p.evaluate(()=>document.getElementById('bClearAllViews').previousElementSibling.id),'tErase');
 const foldedData=await p.evaluate(()=>JSON.stringify(items));await p.locator('.card-toggle').first().click();assert.equal(await p.locator('.card-body').first().isVisible(),false);assert.equal(await p.evaluate(()=>JSON.stringify(items)),foldedData);
 await p.reload();await p.waitForSelector('.card-toggle');assert.equal(await p.locator('.card-body').first().isVisible(),false);await p.locator('.card-toggle').first().focus();await p.keyboard.press('Enter');assert.equal(await p.locator('.card-body').first().isVisible(),true);
 // A point on either projected grid axis must remain on that axis after stretching.
 for(let rotation=0;rotation<4;rotation++){
  const result=await p.evaluate(r=>{const saved=JSON.stringify(it()),oldView=view;view=r;const w=wCmOf(it(),view),h=hCmOf(it(),view);delete vw().shearCm;stretchAxis('wCm',w*1.2);stretchAxis('hCm',h*1.4);const shear=vw().shearCm;
   const projectedDepthX=1.2*DEPX+(shear/h)*(-DEPY),projectedDepthY=1.4*(-DEPY);
   const ok=Math.abs(projectedDepthX-1.4*DEPX)<1e-8&&Math.abs(projectedDepthY+1.4*DEPY)<1e-8;
   refresh();fitView();window.restorePerspectiveTest=()=>{items[cur]=cleanItem(JSON.parse(saved));view=oldView;refresh()};return ok;},rotation);
  assert.equal(result,true,'projected depth direction preserved at rotation '+rotation);
  await p.screenshot({path:'assets/decor/driftwood/natural-v1/grid-perspective-'+rotation+'.png'});
  await p.evaluate(()=>window.restorePerspectiveTest());
 }
 const heightBefore=await p.evaluate(()=>hCmOf(it(),view));const otherViews=await p.evaluate(()=>JSON.stringify(it().views.slice(1)));
 await p.fill('#fStretchW','50');await p.press('#fStretchW','Tab');assert.equal(await p.evaluate(()=>wCmOf(it(),view)),50);assert.equal(await p.evaluate(()=>hCmOf(it(),view)),heightBefore);
 await p.fill('#fStretchH','35');await p.press('#fStretchH','Tab');assert.equal(await p.evaluate(()=>hCmOf(it(),view)),35);assert.equal(await p.evaluate(()=>wCmOf(it(),view)),50);assert.equal(await p.evaluate(()=>JSON.stringify(it().views.slice(1))),otherViews);
 await p.click('#bUndo');assert.equal(await p.evaluate(()=>hCmOf(it(),view)),heightBefore);await p.click('#bRedo');
 assert.equal(await p.evaluate(()=>defOf(it()).frames[view].hCm),35);await p.evaluate(()=>persistNow());await p.reload();await p.waitForSelector('#fStretchH');assert.equal(await p.inputValue('#fStretchH'),'35');assert.equal(await p.inputValue('#fStretchW'),'50');
 assert.ok(Math.abs(await p.evaluate(()=>vw().shearCm-defOf(it()).frames[view].shearCm))<.001);
 await p.click('#bAspect');assert.equal(await p.evaluate(()=>vw().shearCm||0),0);assert.ok(Math.abs(await p.evaluate(()=>hCmOf(it(),view)-wCmOf(it(),view)*vw().pxH/vw().pxW))<1e-6);
 assert.deepEqual(errors,[]);console.log('PASS: grid editing, collapsible panels, projected axes at all four rotations, undo/redo, export, reload and aspect reset');
 fs.writeFileSync('assets/decor/driftwood/natural-v1/grid-test-report.json',JSON.stringify({passed:true,assets:16,checks:['cm area','walkable brush','undo/redo','ground origin rotation','shop frames preserved','game solid/place masks','editor reload'],errors},null,2));
}finally{await browser.close();server.close();}
