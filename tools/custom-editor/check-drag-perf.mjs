// Dragging bones / mesh points / preview recolour stays light: draft while dragging, full quality + colour after release.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';import path from 'node:path';import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1460,height:1000}});const errors=[];p.on('pageerror',e=>{if(!/setPointerCapture/.test(e.message))errors.push(e.message)});   // synthetic pointer ids cannot be captured
await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
await p.goto(pathToFileURL(path.resolve('tools/custom-editor/Custom.html')).href,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>IMG.oreo_gill_white&&doc.layers.length&&doc.species);
const r=await p.evaluate(async()=>{
 const G=addLayer('oreo_gill_white',{x:450,y:330}),G2=addLayer('oreo_gill_white',{x:520,y:320});G.rig=makeRig(G,3);G2.warp=[0,1,2,3,4,5,6,7,8].map(i=>({x:i%3/2,y:Math.floor(i/3)/2}));setSel([G.id]);afterChange();
 const on=document.getElementById('genePreviewOn'),st=stageEl();
 const drag=(label,step)=>{st.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:-9999,clientY:-9999}));const t=[];for(let i=0;i<30;i++){const s=performance.now();step();t.push(performance.now()-s);}
  const s=performance.now();window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));const release=performance.now()-s;t.sort((a,b)=>a-b);return{label,p50:+t[15].toFixed(1),p95:+t[28].toFixed(1),release:+release.toFixed(1)}};
 const out=[];
 for(const pv of [false,true]){if(on.checked!==pv){on.checked=pv;on.dispatchEvent(new Event('change'))}
  out.push(drag((pv?'preview ':'plain ')+'bone-drag',()=>{G.rig.pose[2].x+=.002;renderLayers();drawOverlay()}));
  out.push(drag((pv?'preview ':'plain ')+'warp-drag',()=>{G2.warp[4].x+=.001;renderLayers();drawOverlay()}));}
 const after={boneFull:!warpCache.get(G.id).draft,warpFull:!warpCache.get(G2.id).draft,recoloured:document.querySelector('.ly[data-id="'+G.id+'"]').firstElementChild!==warpCache.get(G.id).canvas};
 const s=performance.now();st.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:-9999,clientY:-9999}));renderLayers();window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));const click=performance.now()-s;
 return{out,after,clickCost:+click.toFixed(1),hitStillWorks:typeof warpCache.get(G.id).alpha[0]==='number'}});
console.log(JSON.stringify({...r,errors}));for(const o of r.out)assert.ok(o.p95<40,o.label+' p95 '+o.p95+' ms');assert.deepEqual(r.after,{boneFull:true,warpFull:true,recoloured:true});assert.equal(r.hitStillWorks,true);assert.equal(errors.length,0);await b.close();
