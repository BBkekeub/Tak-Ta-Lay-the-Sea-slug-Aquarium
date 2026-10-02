// In-game species flow on a fresh browser profile (never the player's save):
//  research table unlock (500 coins, two clicks) → box shop species choice → delivery carries g.sp → opened slug is that species
//  cross-species breeding refused · same-species child keeps the species · save/load keeps g.sp and the unlock
//  new species draws as its own 2D sprite
// Run from the repo root:  node tools/check-species-game.mjs <layout-export.json>
//   the export is converted to a test species under the key "oreo" (injected before js/slug-species-data.js)
import {createRequire} from 'node:module';import path from 'node:path';import fs from 'node:fs';import os from 'node:os';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const src=process.argv[2];if(!src){console.error('usage: node tools/check-species-game.mjs <layout-export.json>');process.exit(1)}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'species-game-'));
try{
 // the converter needs 9 stalks — reuse the game's 9-stalk set if the export has another count
 const o=JSON.parse(fs.readFileSync(src,'utf8'));
 if(o.layers.filter(l=>l.channel==='gill'&&l.visible!==false).length!==9){
  const eng=fs.readFileSync('js/slug-engine.js','utf8'),m=eng.match(/ {2}9: \[([\s\S]*?)\n {2}\]/);
  const G=[...m[1].matchAll(/part:'(\w+)',\s+u:([\d.]+), v:([\d.]+), rot: *([-\d.]+), flip:(true|false), +hR:([\d.]+), back:(true|false), +d:(\d)/g)].map(r=>({part:r[1],u:+r[2],v:+r[3],rot:+r[4],flip:r[5]==='true',hR:+r[6],back:r[7]==='true',d:+r[8]}));
  let L=o.layers.filter(l=>l.channel!=='gill');const bi=L.findIndex(l=>l.channel==='body');const mk=g=>({part:g.part,name:'g',channel:'gill',u:g.u,v:g.v,rot:g.rot,flipX:g.flip,hRatio:g.hR,ar:1,visible:true});
  L=[...L.slice(0,bi),...G.filter(g=>g.back).map(mk),L[bi],...G.filter(g=>!g.back).sort((a,b)=>a.d-b.d).map(mk),...L.slice(bi+1)];L.forEach((l,i)=>l.z=i);o.layers=L;
 }
 fs.writeFileSync(path.join(tmp,'l.json'),JSON.stringify(o));
 const data=path.join(tmp,'d.js');execFileSync(process.execPath,['tools/build-species.mjs',path.join(tmp,'l.json'),'oreo','โอรีโอ'],{env:{...process.env,SPECIES_OUT:data},stdio:'pipe'});
 const b=await chromium.launch({channel:'chrome',headless:true});
 try{const ctx=await b.newContext({viewport:{width:1400,height:900}}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.dismiss());
  await p.addInitScript({content:fs.readFileSync(data,'utf8')});
  await p.goto(pathToFileURL(path.resolve('index.html')).href);
  await p.waitForFunction(()=>typeof G!=='undefined'&&typeof engineReady!=='undefined'&&engineReady&&typeof Research!=='undefined'&&typeof orderSlugBox==='function',null,{timeout:60000});
  const r=await p.evaluate(async()=>{const out={};
   out.has=SlugEngine.hasSpecies('oreo');out.name=SlugEngine.speciesName('oreo');
   addCoin(10000);const c0=G.coin;
   // box shop before unlock: only the old slug
   out.choicesBefore=boxSpeciesChoices().map(o=>o.key);
   // research table: first click asks, second click pays
   Research.open();await new Promise(r=>setTimeout(r,50));
   const btn=()=>[...document.querySelectorAll('#researchView .rsSp button')][0];
   out.btn1=btn()?.textContent;btn().click();out.btn2=btn()?.textContent;out.coinAfterAsk=c0-G.coin;btn().click();
   out.paid=c0-G.coin;out.unlocked=speciesUnlocked('oreo');out.cardDone=!!document.querySelector('#researchView .rsSp.done');Research.close();
   // box shop: choose oreo, order, open
   out.choicesAfter=boxSpeciesChoices().map(o=>o.key);openSlugShopDialog();
   const spBtn=[...document.querySelectorAll('#slugShop [data-species] button')].find(b=>/โอรีโอ/.test(b.textContent));spBtn.click();
   G.boxStock={n:5,at:Date.now()};const n0=slugDeliveries().length;orderSlugBox(0);const d=slugDeliveries()[n0];out.delivery={name:d.name,sp:d.genes.sp};
   d.readyAt=0;const inv0=G.inv.length;openSlugDelivery(d.id);const s=G.inv[inv0];out.opened=slugSpecies(s);slugShopDialog.close();
   document.querySelectorAll('dialog[open]').forEach(x=>x.close());
   // sprite
   const spr=slugSprite(s);out.sprite=!!(spr&&spr.c&&spr.c.width>10);out.parts=slugPartsOf(s).species;
   // breeding
   const a=makeSlug({...s.genes}),legacy=makeSlug(SlugEngine.randGene()),tank={def:{breeder:true},slugs:[a,legacy]};
   out.cross=startBreeding(tank,[a.id,legacy.id]);
   const child=BreedingGenes.breed(BreedingGenes.copyGene(a.genes),BreedingGenes.copyGene(s.genes),BreedingGenes.newLab(),7).child;out.child=child.sp;
   const lchild=BreedingGenes.breed(BreedingGenes.copyGene(legacy.genes),BreedingGenes.copyGene(legacy.genes),BreedingGenes.newLab(),7).child;out.legacyChild=lchild.sp===undefined;
   // save/load
   const round=_loadSlug(JSON.parse(JSON.stringify(_saveSlug(s))));out.saveSp=round.genes.sp;out.bogus=_loadSlug({genes:{...s.genes,sp:'<x>'}}).genes.sp===undefined;
   saveGame();out.savedUnlock=Object.values(localStorage).some(v=>typeof v==='string'&&v.includes('"species":{"oreo":true}'));
   return out});
  assert.ok(r.has&&r.name==='โอรีโอ','species loaded');assert.deepEqual(r.choicesBefore,['legacy'],'locked before paying');
  assert.equal(r.coinAfterAsk,0,'first click only asks');assert.match(r.btn2,/ยืนยัน/);assert.equal(r.paid,500,'pays 500');assert.ok(r.unlocked&&r.cardDone);
  assert.deepEqual(r.choicesAfter,['legacy','oreo']);assert.equal(r.delivery.sp,'oreo');assert.match(r.delivery.name,/โอรีโอ/);assert.equal(r.opened,'oreo');
  assert.ok(r.sprite,'2D sprite');assert.equal(r.parts,'oreo');
  assert.equal(r.cross,false,'cross-species breeding refused');assert.equal(r.child,'oreo','child keeps species');assert.ok(r.legacyChild,'old slug child stays old');
  assert.equal(r.saveSp,'oreo');assert.ok(r.bogus,'invalid species dropped');assert.ok(r.savedUnlock,'unlock saved');
  assert.deepEqual(errors,[],'no page errors');console.log(JSON.stringify(r));
 }finally{await b.close()}
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
