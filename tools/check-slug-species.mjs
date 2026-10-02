// Game species pipeline: editor layout export → tools/build-species.mjs → SlugEngine species (g.sp)
//  1) the old slug's own layout (9 game stalks) converted as species "test" draws like the old slug (crest/body/face)
//  2) crest ladder uses CREST_KEEP subsets · spots fall 100 → 0 one at a time without popping
//  3) legacy slugs are untouched when species data is loaded
// Run from the repo root:  node tools/check-slug-species.mjs <layout-export.json> [screenshot.png]
//   (the export can be the editor's default layout — the check swaps its crest for the game's 9-stalk set)
import {createRequire} from 'node:module';import path from 'node:path';import fs from 'node:fs';import os from 'node:os';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const [src,shot]=process.argv.slice(2);if(!src){console.error('usage: node tools/check-slug-species.mjs <layout-export.json> [shot.png]');process.exit(1)}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'species-'));
// test layout: export with the crest replaced by GILL_SETS[9]; optional mirrored copy (faces right)
const eng=fs.readFileSync('js/slug-engine.js','utf8'),m=eng.match(/ {2}9: \[([\s\S]*?)\n {2}\]/);
const G=[...m[1].matchAll(/part:'(\w+)',\s+u:([\d.]+), v:([\d.]+), rot: *([-\d.]+), flip:(true|false), +hR:([\d.]+), back:(true|false), +d:(\d)/g)].map(r=>({part:r[1],u:+r[2],v:+r[3],rot:+r[4],flip:r[5]==='true',hR:+r[6],back:r[7]==='true',d:+r[8]}));
assert.equal(G.length,9,'read GILL_SETS[9]');
const o=JSON.parse(fs.readFileSync(src,'utf8'));let L=o.layers.filter(l=>l.channel!=='gill');const bi=L.findIndex(l=>l.channel==='body');
const mk=g=>({part:g.part,name:'g',channel:'gill',u:g.u,v:g.v,rot:g.rot,flipX:g.flip,hRatio:g.hR,ar:1,visible:true,species:L[bi].species});
L=[...L.slice(0,bi),...G.filter(g=>g.back).map(mk),L[bi],...G.filter(g=>!g.back).sort((a,b)=>a.d-b.d).map(mk),...L.slice(bi+1)];L.forEach((l,i)=>l.z=i);
fs.writeFileSync(path.join(tmp,'t.json'),JSON.stringify({...o,layers:L}));
const data=path.join(tmp,'data.js');execFileSync(process.execPath,['tools/build-species.mjs',path.join(tmp,'t.json'),'test','ทดสอบ'],{env:{...process.env,SPECIES_OUT:data},stdio:'pipe'});
const page=path.join(tmp,'p.html');fs.writeFileSync(page,'<!doctype html><body style="margin:0;background:#4E7076"><script src="'+pathToFileURL(data).href+'"></script><script src="'+pathToFileURL(path.resolve('js/slug-engine.js')).href+'"></script></body>');

const b=await chromium.launch({channel:'chrome',headless:true});
try{const p=await b.newPage({viewport:{width:1200,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(pathToFileURL(page).href);await p.evaluate(()=>SlugEngine.ready);
const r=await p.evaluate(()=>{const E=SlugEngine,base={bodyDepth:45,gillDepth:45,mainC:350,accC:250,len:50,girth:50,gillLen:50,tentLen:50,vigor:60,gillN:100,spotN:30};E.ANIM=false;
 const render=g=>{const P=E.slugParts(g,300),c=document.createElement('canvas');c.width=700;c.height=360;const x=c.getContext('2d');x.fillStyle='#4E7076';x.fillRect(0,0,700,360);E.drawSlug(x,P,350,180,false,0,1,true,false,{noBob:true});return{c,P}};
 const diff=(a,b)=>{const A=a.getContext('2d').getImageData(0,0,700,360).data,B=b.getContext('2d').getImageData(0,0,700,360).data;let s=0,n=0;for(let i=0;i<A.length;i+=4){const d=Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]);s+=d;if(d>60)n++}return{mean:+(s/(A.length/4)/3).toFixed(2),bad:+(n/(A.length/4)*100).toFixed(2)}};
 const out={list:E.species(),has:E.hasSpecies('test')};
 const leg=render({...base}),tst=render({...base,sp:'test',spotN:0});out.parity9=diff(leg.c,tst.c);out.stalks=[leg.P.stalks.length,tst.P.stalks.length];
 const tstS=render({...base,sp:'test',spotN:100}),legS=render({...base,spotN:70});out.paritySpots=diff(legS.c,tstS.c);
 out.ladder={};for(const v of [50,60,70,80,90,100])out.ladder[v]=E.slugParts({...base,sp:'test',gillN:v},100).stalks.map(s=>s.G);
 const G9=E.GILL_SETS[9];out.ladderIdx=Object.fromEntries(Object.entries(out.ladder).map(([v,st])=>[v,st.map(s=>G9.findIndex(g=>Math.abs(g.u-s.u)<1e-4&&Math.abs(g.v-s.v)<1e-4)).sort((a,b)=>a-b)]));delete out.ladder;
 out.spots=[];for(let v=100;v>=0;v--){const D=E.derived({...base,sp:'test',spotN:v});out.spots.push([D.nSpot,+D.spotF.toFixed(3)])}
 out.legacyKey=E.derived({...base}).mat.k;out.face=tst.P.face===E.FACE?'legacy-object':'own';
 document.body.append(leg.c,tst.c,legS.c,tstS.c);return out});
assert.ok(r.has&&r.list.some(s=>s.key==='test'),'species registered');
assert.deepEqual(r.stalks,[9,9]);assert.ok(r.parity9.mean<1&&r.parity9.bad<.5,'test species = old slug at 9 stalks, no spots '+JSON.stringify(r.parity9));
assert.ok(r.paritySpots.mean<3,'8 own spots ≈ old slug 8 circles (only the per-spot jitter order differs) '+JSON.stringify(r.paritySpots));
assert.deepEqual(r.ladderIdx,{50:[1,7],60:[1,6,7],70:[1,2,5,6,7],80:[1,2,4,5,6,7],90:[0,1,2,4,5,6,7,8],100:[0,1,2,3,4,5,6,7,8]},'crest ladder = old slug order');
for(let i=1;i<r.spots.length;i++){const [n0]=r.spots[i-1],[n1]=r.spots[i];assert.ok(n1<=n0&&n0-n1<=1,'one spot at a time')}
assert.deepEqual(r.spots[0],[8,1]);assert.equal(r.spots.at(-1)[0],0);assert.equal(r.legacyKey,'b350','legacy material key unchanged');
if(shot)await p.screenshot({path:shot,fullPage:true});
assert.deepEqual(errors,[]);console.log(JSON.stringify(r));
}finally{await b.close();fs.rmSync(tmp,{recursive:true,force:true})}
