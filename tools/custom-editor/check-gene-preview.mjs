// Gene preview = the game: every gene of SlugEngine.GENES is testable, the rules/tables equal js/slug-engine.js,
// and the stage (default layout, colour + shape preview) matches SlugEngine.drawSlug pixel-for-pixel at tone level.
// Also: shape preview never edits the layout, stage is click-select only while it is on, pan/zoom reuse canvases.
// Run from the repo root:  node tools/custom-editor/check-gene-preview.mjs [screenshot.png]
import {createRequire} from 'node:module';import path from 'node:path';import fs from 'node:fs';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const shot=process.argv[2];const b=await chromium.launch({channel:'chrome',headless:true});
try{const p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());
await p.goto(pathToFileURL(path.resolve('tools/custom-editor/Custom.html')).href,{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>typeof IMG!=='undefined'&&IMG.oreo_horn_white&&doc.layers.length&&window.GenePreview);await p.waitForTimeout(300);
await p.addScriptTag({path:path.resolve('js/slug-engine.js')});await p.evaluate(()=>SlugEngine.ready);
await p.evaluate(()=>{document.getElementById('railOpenAll').click();if(showGuide)$('bGuide').click();bgMode=1;stageEl().dataset.bg='mid';setSel([]);syncPanel()});

// 1) the card has every gene the game reads, with the game's ranges and defaults
const genes=await p.evaluate(()=>{const d=GenePreview.defs(),base=d.filter(g=>['color','finish','shape','count'].includes(g.grp));
 return{keys:base.map(g=>g.key).sort(),engine:SlugEngine.GENES.map(G=>G.k).sort(),ranges:base.every(g=>{const R=SlugEngine.gr(g.key);return g.min===R.min&&g.max===R.max}),
  rows:[...document.querySelectorAll('#geneRows input[data-gene]')].map(i=>i.dataset.gene).sort(),defaults:Object.fromEntries(base.map(g=>[g.key,g.def]))}});
assert.deepEqual(genes.keys,genes.engine,'card genes = SlugEngine.GENES');assert.ok(genes.ranges,'ranges = SlugEngine.gr');assert.deepEqual(genes.rows,genes.engine,'a slider per gene');

// 2) tables and derived rules equal the engine's
const rules=await p.evaluate(defaults=>{const R=GenePreview.rules,E=SlugEngine,out={};
 const strip=T=>T.map(a=>({g:a.g,n:a.n,D:a.D,M:a.M,L:a.L,P:a.P}));out.body=JSON.stringify(strip(R.BODY_ANCH))===JSON.stringify(strip(E.BODY_ANCH));out.gill=JSON.stringify(strip(R.GILL_ANCH))===JSON.stringify(strip(E.GILL_ANCH));
 const gs=S=>Object.fromEntries(Object.entries(S).map(([k,v])=>[k,v.map(G=>[G.part||'gill',G.u,G.v,G.rot,!!G.flip,G.hR,!!G.back,G.d])]));out.sets=JSON.stringify(gs(R.GILL_SETS))===JSON.stringify(gs(E.GILL_SETS));
 const D0=E.derived();out.defaults=['size','stretch','gScale','tScale','nGill','nSpot','shape'].every(k=>{const m=GenePreview.morph();return k==='nSpot'||k==='shape'?true:Math.abs(m[k]-D0[k])<1e-9})&&defaults.mainC===200&&defaults.accC===200&&defaults.bodyDepth===45&&defaults.gillDepth===45;
 const bad=[];const base={bodyDepth:45,gillDepth:45,mainC:200,accC:200,len:50,girth:50,gillLen:50,tentLen:50,vigor:50,gillN:50,spotN:50};
 for(let v=0;v<=100;v++){const g={...base,gillN:v,spotN:v,len:v,girth:100-v,gillLen:v,tentLen:100-v},D=E.derived(g);GenePreview.set(g);const m=GenePreview.morph(),sp=R.spotPlan(v,8);
  if(m.nGill!==D.nGill||sp.n!==D.nSpot||sp.shape!==D.shape||['size','stretch','gScale','tScale'].some(k=>Math.abs(m[k]-D[k])>1e-9))bad.push(v)}
 out.derivedMismatch=bad;return out},genes.defaults);
assert.ok(rules.body&&rules.gill,'colour tables = engine');assert.ok(rules.sets,'GILL_SETS = engine');assert.ok(rules.defaults,'defaults = engine');assert.deepEqual(rules.derivedMismatch,[],'derived() parity for 0..100');

// 3) stage vs game at tone level: both are averaged down to a ~100 px frame, so the game's softer (smaller) textures do not count as a difference
await p.evaluate(()=>{GenePreview.colour(true);GenePreview.shape(true)});
const parity=[];
for(const g of [{},{mainC:50,accC:350,vigor:100},{mainC:400,accC:0,vigor:0,len:100,girth:0},{mainC:150,accC:50,gillN:20,spotN:10,gillLen:20,tentLen:90},{mainC:300,accC:250,gillN:100,spotN:90,girth:100}]){
 const full={bodyDepth:45,gillDepth:45,mainC:200,accC:200,len:50,girth:50,gillLen:50,tentLen:50,vigor:50,gillN:50,spotN:50,...g};
 await p.evaluate(full=>{GenePreview.set(full);const d=GenePreview.display(),B=d.info.box,st=stageEl().getBoundingClientRect(),top=B.y-B.h*1.9,bot=B.y+B.h*1.35,left=B.x-B.w*.12,right=B.x+B.w*1.12;
  z=Math.min(st.width/(right-left),st.height/(bot-top));offX=(st.width-(right-left)*z)/2-left*z;offY=(st.height-(bot-top)*z)/2-top*z;applyView();for(const el of document.querySelectorAll('.gene-banner'))el.style.visibility='hidden'},full);
 await p.waitForTimeout(500);const box=await p.locator('#stage').boundingBox(),png=(await p.screenshot({clip:box})).toString('base64');
 parity.push(await p.evaluate(async([png,full])=>{const ed=await new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.src='data:image/png;base64,'+png});
  const B=GenePreview.display().info.box,p0=S(B.x,B.y),p1=S(B.x+B.w,B.y+B.h),eb={x:p0[0],y:p0[1],w:p1[0]-p0[0],h:p1[1]-p0[1]};
  SlugEngine.ANIM=false;const P=SlugEngine.slugParts(full,600),c=document.createElement('canvas');c.width=ed.naturalWidth;c.height=ed.naturalHeight;const x=c.getContext('2d');x.fillStyle='#4E7076';x.fillRect(0,0,c.width,c.height);
  const k=eb.w/P.bw;SlugEngine.drawSlug(x,P,eb.x+k*(P.L+P.R)/2,eb.y+k*(P.T+P.B)/2,false,0,k/P.s,true,false,{noBob:true});
  // 700 px frame, then 7×7 block means (true area average): colour/tone differences count, texture sharpness does not
  const OW=700,BS=7,fx0=eb.x-eb.w*.08,fy0=eb.y-eb.h*1.75,fw=eb.w*1.16,fh=eb.h*3,OH=Math.round(OW*fh/fw/BS)*BS,px=src=>{const o=document.createElement('canvas');o.width=OW;o.height=OH;o.getContext('2d').drawImage(src,fx0,fy0,fw,fh,0,0,OW,OH);return o.getContext('2d').getImageData(0,0,OW,OH).data};
  const a=px(ed),q=px(c),reg={crest:[0,0,1,.58],body:[.25,.58,1,1],head:[0,.3,.25,1]},m={};for(const k2 in reg)m[k2]=[0,0];
  for(let by=0;by<OH/BS;by++)for(let bx=0;bx<OW/BS;bx++){const A=[0,0,0],Q=[0,0,0];for(let yy=by*BS;yy<by*BS+BS;yy++)for(let xx=bx*BS;xx<bx*BS+BS;xx++){const i=(yy*OW+xx)*4;for(let k3=0;k3<3;k3++){A[k3]+=a[i+k3]/(BS*BS);Q[k3]+=q[i+k3]/(BS*BS)}}
   const bg=d=>Math.abs(d[0]-78)+Math.abs(d[1]-112)+Math.abs(d[2]-118)<6;if(bg(A)&&bg(Q))continue;const u=(bx+.5)*BS/OW,v=(by+.5)*BS/OH;
   for(const [k2,[x0,y0,x1,y1]] of Object.entries(reg))if(u>=x0&&u<x1&&v>=y0&&v<y1){m[k2][0]+=(Math.abs(A[0]-Q[0])+Math.abs(A[1]-Q[1])+Math.abs(A[2]-Q[2]))/3;m[k2][1]++}}
  return{genes:full,crest:+(m.crest[0]/m.crest[1]).toFixed(2),body:+(m.body[0]/m.body[1]).toFixed(2),head:+(m.head[0]/m.head[1]).toFixed(2)}},[png,full]))}
for(const r of parity){assert.ok(r.body<4&&r.head<5&&r.crest<7,'stage differs from the game '+JSON.stringify(r))}
await p.evaluate(()=>{fit();for(const el of document.querySelectorAll('.gene-banner'))el.style.visibility=''});
if(shot){await p.waitForTimeout(300);await p.screenshot({path:shot})}

// 4) shape preview: counts, geometry, layout untouched
const beforeLayout=await p.evaluate(()=>{exportJSON();return JSON.parse($('out').value).layers.map(L=>[L.part,L.x,L.y,L.scale,L.rot])});
const geo=await p.evaluate(()=>{const base={bodyDepth:45,gillDepth:45,mainC:200,accC:200,len:50,girth:50,gillLen:50,tentLen:50,vigor:50,gillN:50,spotN:50},bb=bboxOf(bodyLayer()),out={};
 GenePreview.set({...base,len:100,girth:0});const bx=GenePreview.display().info.box;out.w=+(bx.w/bb.w).toFixed(4);out.h=+(bx.h/bb.h).toFixed(4);out.bottom=Math.abs(bx.y+bx.h-(bb.y+bb.h))<1e-6;
 GenePreview.set({...base,gillN:100});out.ghosts9=document.querySelectorAll('#world .ly[data-id^="-"]').length;
 GenePreview.set({...base,gillN:50});out.ghosts2=document.querySelectorAll('#world .ly[data-id^="-"]').length;
 GenePreview.set({...base,spotN:90});const d=GenePreview.display();out.spots=d.layers.filter(L=>L.role==='spot'&&L.vis).map(L=>L.part);
 GenePreview.set({...base,spotN:50});out.spots50=GenePreview.display().layers.filter(L=>L.role==='spot'&&L.vis).length;
 GenePreview.set({...base,gillLen:100,tentLen:0});const d2=GenePreview.display(),real=Object.fromEntries(doc.layers.map(L=>[L.id,L]));
 out.crestScale=d2.layers.filter(L=>L.role==='gill').map(L=>+(L.s/real[L.id].s).toFixed(4));out.rhinoScale=d2.layers.filter(L=>L.role==='rhino').map(L=>+(L.s/real[L.id].s).toFixed(4));
 out.rhinoAnchored=d2.layers.filter(L=>L.role==='rhino').every(L=>Math.abs(L.x-real[L.id].x)<1e-6&&Math.abs(L.y-real[L.id].y)<1e-6);return out});
assert.deepEqual([geo.w,geo.h,geo.bottom],[.9216,.72,true],'len/girth stretch the body box around the belly line');
assert.equal(geo.ghosts9,9,'gillN 100 = 9 stalks from GILL_SETS');assert.equal(geo.ghosts2,0,'gillN 50 = the layout\'s own 2 stalks');
assert.deepEqual(geo.spots,Array(6).fill('spotSq'),'spotN 90 = 6 squares');assert.equal(geo.spots50,4,'spotN 50 = 4 circles');
assert.deepEqual([...new Set(geo.crestScale)],[1.38],'gillLen 100 = ×1.38');assert.deepEqual([...new Set(geo.rhinoScale)],[.62],'tentLen 0 = ×0.62');assert.ok(geo.rhinoAnchored,'rhinophores scale around their base');
assert.deepEqual(await p.evaluate(()=>{exportJSON();return JSON.parse($('out').value).layers.map(L=>[L.part,L.x,L.y,L.scale,L.rot])}),beforeLayout,'preview never edits the layout');

// 5) while shape preview is on the stage selects but does not drag; banner button returns to editing
await p.evaluate(()=>{GenePreview.set({len:100,girth:30});fit()});await p.waitForTimeout(200);
const target=await p.evaluate(()=>{const d=GenePreview.display(),L=d.layers.find(L=>L.part==='eye'),r=stageEl().getBoundingClientRect(),q=S(L.x,L.y);return{id:L.id,x:r.left+q[0],y:r.top+q[1],real:[byId(L.id).x,byId(L.id).y]}});
await p.mouse.move(target.x,target.y);await p.mouse.down();await p.mouse.move(target.x+60,target.y+30,{steps:5});await p.mouse.up();
const lock=await p.evaluate(id=>({sel:sel.slice(),pos:[byId(id).x,byId(id).y],banner:!document.querySelector('.gene-banner').hidden}),target.id);
assert.deepEqual(lock.sel,[target.id],'click selects the piece under the pointer (shown geometry)');assert.deepEqual(lock.pos,target.real,'drag does not move pieces in shape preview');assert.ok(lock.banner,'banner visible');
await p.locator('.gene-banner [data-a="layout"]').click();
assert.deepEqual(await p.evaluate(()=>({shape:document.getElementById('geneShapeOn').checked,ghosts:document.querySelectorAll('#world .ly[data-id^="-"]').length,banner:document.querySelector('.gene-banner').hidden})),{shape:false,ghosts:0,banner:true});

// 6) colour preview: one aura for the whole crown; pan/zoom never rebuild canvases
const reuse=await p.evaluate(()=>{GenePreview.set({vigor:80,gillN:50});const aura=document.querySelectorAll('.gene-aura'),nodes=[...document.querySelectorAll('#world .ly')].map(n=>n.firstElementChild),ac=aura[0]?.firstElementChild,w0=ac?.width;
 z*=1.4;offX-=120;applyView();z/=1.4;offX+=120;applyView();
 const same=[...document.querySelectorAll('#world .ly')].every((n,i)=>n.firstElementChild===nodes[i]);const out={auras:aura.length,inWorld:!!document.querySelector('#world .gene-aura'),same,auraSame:document.querySelector('.gene-aura')?.firstElementChild===ac&&ac.width===w0,follows:document.querySelector('.gene-aura').style.transform===$('world').style.transform};
 GenePreview.set({vigor:0});out.noAuraAtZero=!document.querySelector('.gene-aura');return out});
assert.deepEqual(reuse,{auras:1,inWorld:false,same:true,auraSame:true,follows:true,noAuraAtZero:true});
// 7) imported crest (Oreo white gill) is lit like the game's หงอนแบบ 3 before dyeing: same brightness distribution, bright rims, no white axis
const relit=await p.evaluate(async()=>{const load=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=src});const rel=await load(GenePreview.relit('oreo_gill_white'));
 const read=im=>{const W=im.naturalWidth,H=im.naturalHeight,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,W,H).data,L=[],edge=[],core=[];
  const solid=i=>i>=0&&i<W*H&&d[i*4+3]>128;for(let y=2;y<H-2;y++)for(let x0=2;x0<W-2;x0++){const i=y*W+x0;if(!solid(i))continue;const v=(d[i*4]*.2126+d[i*4+1]*.7152+d[i*4+2]*.0722)/255;L.push(v);let r=0;for(let k=1;k<=6&&!r;k++)if(!solid(i-k)||!solid(i+k)||!solid(i-k*W)||!solid(i+k*W))r=k;(r&&r<=2?edge:r===0?core:[]).push(v)}
  L.sort((a,b)=>a-b);const q=f=>L[Math.floor(f*(L.length-1))],m=a=>a.reduce((s,v)=>s+v,0)/a.length;return{q:[.05,.25,.5,.75,.95].map(q),edge:m(edge),core:m(core)}};
 return{oreo:read(rel),raw:read(IMG.oreo_gill_white),gill3:read(IMG.gill3)}});
assert.ok(relit.oreo.q.every((v,i)=>Math.abs(v-relit.gill3.q[i])<.02),'relit Oreo brightness distribution = หงอนแบบ 3 '+JSON.stringify(relit));
assert.ok(relit.raw.edge<relit.raw.core&&relit.gill3.edge>relit.gill3.core&&relit.oreo.edge>relit.oreo.core,'rims brighter than cores, like หงอนแบบ 3 '+JSON.stringify(relit));
console.log(JSON.stringify({genes:genes.keys.length,rules,parity,geo,lock,reuse,relit,errors}));assert.equal(errors.length,0)}finally{await b.close()}
