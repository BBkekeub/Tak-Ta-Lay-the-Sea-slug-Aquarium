// New-species gene rules (a layout with its own crest/spot art):
//  · 9 own crest stalks → by angle: 3 centres + 3 left-right pairs; gillN keeps pair → centre → pair … like the first slug (2 = inner pair); CREST_KEEP re-derived from js/slug-engine.js
//  · own spots → spotN 100 = all, 0 = none, the next spot to go shrinks+fades first (no popping), thinning spreads evenly
//  · the saved layout is never edited
// Run from the repo root:  node tools/custom-editor/check-own-species.mjs [screenshot-prefix]
import {createRequire} from 'node:module';import path from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const shot=process.argv[2];const b=await chromium.launch({channel:'chrome',headless:true});
try{const p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
await p.goto(pathToFileURL(path.resolve('tools/custom-editor/Custom.html')).href,{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>typeof IMG!=='undefined'&&IMG.oreo_gill_white&&doc.layers.length&&window.GenePreview);await p.waitForTimeout(300);
await p.addScriptTag({path:path.resolve('js/slug-engine.js')});await p.evaluate(()=>SlugEngine.ready);

// 1) CREST_KEEP = each hand-laid game set matched onto the 9-stalk set (position/angle/back), and the sets nest
const keep=await p.evaluate(()=>{const S=SlugEngine.GILL_SETS,G=S[9],out={};
 for(const n of Object.keys(S).map(Number)){const set=S[n];let best=1e9,pick=null;const cur=[],used=new Set();
  (function rec(i,c){if(c>=best)return;if(i===set.length){best=c;pick=cur.slice();return}for(let j=0;j<9;j++){if(used.has(j))continue;const a=set[i],g=G[j];
   const d=Math.hypot((a.u-g.u)*2,a.v-g.v)+Math.abs(a.rot-g.rot)/400+(!!a.back!==!!g.back?.05:0)+((a.part||'gill')!==(g.part||'gill')?.01:0);used.add(j);cur.push(j);rec(i+1,c+d);cur.pop();used.delete(j)}})(0,0);
  out[n]=pick.slice().sort((a,b)=>a-b)}return{derived:out,editor:GenePreview.rules.CREST_KEEP}});
assert.deepEqual(keep.editor,keep.derived,'CREST_KEEP = GILL_SETS matched to the 9-stalk set');
const K=Object.keys(keep.editor).map(Number).sort((a,b)=>a-b);for(let i=1;i<K.length;i++)assert.ok(keep.editor[K[i-1]].every(s=>keep.editor[K[i]].includes(s)),'crest sets nest '+K[i-1]+'⊂'+K[i]);

// 2) test layout (never the user's save — a fresh page profile): Oreo body (= new species), 9 Oreo stalks on the game's 9 slots, 11 game circle spots (shape must not change)
const setup=await p.evaluate(()=>{const B0=bodyLayer();B0.part='oreo_body_white';B0.species='oreo';const B=bodyLayer(),bb=bboxOf(B),bi=doc.layers.indexOf(B),P=PARTS.oreo_gill_white,S=SlugEngine.GILL_SETS[9];
 const drop=new Set(doc.layers.filter(L=>/^gill[23]?$/.test(L.part)||/^spot/.test(L.part)));const keepL=doc.layers.filter(L=>!drop.has(L));
 const mk=(G,i)=>({id:1000+i,part:'oreo_gill_white',name:'crest '+i,gid:null,x:bb.x+G.u*bb.w,y:bb.y+G.v*bb.h,s:bb.h*G.hR/(P.h*P.nat),ex:1,ey:1,rot:G.rot,fx:!!G.flip,fy:false,op:1,vis:true,lock:false,channel:'gill',slotWant:i});
 const back=S.map((G,i)=>G.back?mk(G,i):null).filter(Boolean),front=S.map((G,i)=>G.back?null:[G.d,mk(G,i)]).filter(Boolean).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
 const R=PARTS.spot,spots=[[.20,.45,.16],[.34,.62,.13],[.46,.40,.15],[.58,.63,.12],[.70,.45,.14],[.82,.60,.09],[.27,.30,.07],[.52,.24,.08],[.40,.78,.06],[.64,.28,.07],[.76,.76,.05]]
  .map(([u,v,r],i)=>({id:2000+i,part:'spot',name:'spot '+i,gid:null,x:bb.x+u*bb.w,y:bb.y+v*bb.h,s:bb.h*r*2/(R.h*R.nat),ex:1,ey:1,rot:0,fx:false,fy:false,op:1,vis:true,lock:false,channel:'spot'}));
 const bIdx=keepL.indexOf(B);doc.layers=[...keepL.slice(0,bIdx),...back,B,...spots,...front,...keepL.slice(bIdx+1)];renderLayers();
 GenePreview.colour(false);GenePreview.shape(true);return{crest:doc.layers.filter(L=>L.channel==='gill').length,spots:spots.length}});
assert.deepEqual(setup,{crest:9,spots:11});
const before=await p.evaluate(()=>JSON.stringify(doc.layers));

// 3) gillN: every ladder step shows exactly the old slug's subset, on the stalks as laid out (no ghost copies, no moves)
const base={bodyDepth:45,gillDepth:45,mainC:200,accC:200,len:50,girth:50,gillLen:50,tentLen:50,vigor:50,gillN:50,spotN:100};
const crest=await p.evaluate(base=>{const out={};for(const v of [50,60,70,80,90,100,40,0]){GenePreview.set({...base,gillN:v});const d=GenePreview.display(),want=Object.fromEntries(doc.layers.map(L=>[L.id,L.slotWant]));
  const g=d.layers.filter(L=>L.role==='gill');out[v]={n:d.info.crest.n,own:!!d.info.crest.own,ghosts:g.filter(L=>L.ghost).length,shown:g.filter(L=>L.vis).map(L=>want[L.id]).sort((a,b)=>a-b),
   moved:g.some(L=>{const R=doc.layers.find(x=>x.id===L.id);return Math.abs(L.x-R.x)>1e-6||Math.abs(L.y-R.y)>1e-6})}}return out},base);
/* 9 stalks sorted by angle: middle 3 = centres, 3 each side = left-right pairs (inside → out); grown like the first slug: pair → centre → pair → centre → pair → centre
   this layout (labels = GILL_SETS[9] slot) by rot: 0 -42.6 · 8 -29.3 · 1 -3.7 | 6 3.7 · 4 11.5 · 7 17.2 | 2 21.5 · 3 22.4 · 5 39.9
   pairs in→out: (1,2) (8,3) (0,5) · centres tall→small by hR: 6 1.72 · 4 1.46 · 7 1.30
   2 = inner pair · 3 = +tallest centre · 5 = +next pair · 6 = +2nd centre · 8 = +outer pair · 9 = +smallest centre */
const ROWS_WANT={2:[1,2],3:[1,2,6],5:[1,2,3,6,8],6:[1,2,3,4,6,8],8:[0,1,2,3,4,5,6,8],9:[0,1,2,3,4,5,6,7,8]};
for(const [v,r] of Object.entries(crest)){assert.ok(r.own&&!r.ghosts&&!r.moved,'gillN '+v+' uses the laid-out stalks '+JSON.stringify(r));assert.deepEqual(r.shown,ROWS_WANT[r.n],'gillN '+v+' = pair/centre ladder for '+r.n)}

// 4) spotN 100→0: count falls one by one, the leaving spot shrinks+fades, total "ink" never jumps
const sp=await p.evaluate(base=>{const rows=[];for(let v=100;v>=0;v--){GenePreview.set({...base,gillN:100,spotN:v});const L=GenePreview.display().layers.filter(L=>L.role==='spot'&&L.vis);rows.push({v,n:L.length,ids:L.map(x=>x.id)})}return rows},base);
// ink = on-stage area × opacity of the spot nodes (display() does not list opacity)
const ink=await p.evaluate(base=>{const out=[];for(let v=100;v>=0;v--){GenePreview.set({...base,gillN:100,spotN:v});let s=0;
  for(const el of document.querySelectorAll('#world .ly')){const id=+el.dataset.id;if(id<2000||id>2010||el.style.display==='none')continue;const r=el.getBoundingClientRect();s+=r.width*r.height*(+el.style.opacity||0)}out.push(+s.toFixed(1))}return out},base);
const shapes=await p.evaluate(base=>[95,80,50,20,5].map(v=>{GenePreview.set({...base,spotN:v});return[...new Set(GenePreview.display().layers.filter(L=>L.role==='spot'&&L.vis).map(L=>L.part))]}),base);
assert.ok(shapes.every(s=>s.every(x=>x==='spot')),'new species keeps the layout\'s spot art at every value (no square/triangle zones) '+JSON.stringify(shapes));
assert.equal(sp[0].n,11,'spotN 100 = all 11');assert.equal(sp.at(-1).n,0,'spotN 0 = none');
for(let i=1;i<sp.length;i++){assert.ok(sp[i].n<=sp[i-1].n&&sp[i-1].n-sp[i].n<=1,'one spot at a time at '+sp[i].v);assert.ok(sp[i].ids.every(id=>sp[i-1].ids.includes(id)),'a spot never comes back while falling ('+sp[i].v+')')}
const jumps=ink.slice(1).map((s,i)=>ink[i]-s),maxJump=Math.max(...jumps),total=ink[0];
assert.ok(jumps.every(j=>j>=-total*.02),'ink falls monotonically (±jitter) '+JSON.stringify(ink));assert.ok(maxJump<total*.1,'no spot pops out: largest step '+maxJump.toFixed(0)+' of '+total.toFixed(0));
const orderOut=[];for(let i=1;i<sp.length;i++)for(const id of sp[i-1].ids)if(!sp[i].ids.includes(id))orderOut.push(id-2000);
assert.equal(orderOut.at(-1),0,'the biggest spot stays longest');

assert.equal(await p.evaluate(()=>JSON.stringify(doc.layers)),before,'preview never edits the layout');
if(shot){for(const [g,s] of [[100,100],[70,60],[50,25]]){await p.evaluate(([base,g,s])=>{GenePreview.set({...base,gillN:g,spotN:s});fit()},[base,g,s]);await p.waitForTimeout(250);await p.screenshot({path:shot+'-g'+g+'-s'+s+'.png',clip:await p.locator('#stage').boundingBox()})}}
assert.deepEqual(errors,[]);
console.log(JSON.stringify({keep:keep.editor,crest,spotsLeaveOrder:orderOut,ink:[ink[0],ink[25],ink[50],ink[75],ink[100]],maxJump:+maxJump.toFixed(1)}));
}finally{await b.close()}
