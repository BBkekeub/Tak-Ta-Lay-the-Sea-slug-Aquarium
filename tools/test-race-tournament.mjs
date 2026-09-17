// แข่งวิ่ง: (1) แข่งปกติต้องรอทุกตัวเข้าเส้นชัยก่อนขึ้นผล (2) ทัวร์นาเมนต์วิ่งตั้งแต่จดหมายเชิญจนรับรางวัล
// โปรไฟล์ใหม่ทุกครั้ง ไม่แตะเซฟผู้เล่น · ภาพออกที่ tools/qa/race-tournament/
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'tools/qa/race-tournament');fs.mkdirSync(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+(p==='/'?'/index.html':decodeURIComponent(p)));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.glb':'model/gltf-binary','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[],report={};
const shot=async(page,name,sel)=>{if(sel){const b=await page.locator(sel).boundingBox();if(b){await page.screenshot({path:path.join(out,name+'.png'),clip:{x:Math.max(0,b.x-6),y:Math.max(0,b.y-6),width:b.width+12,height:Math.min(900-Math.max(0,b.y-6),b.height+12)}});return;}}await page.screenshot({path:path.join(out,name+'.png')});};
const boot=async()=>{
 const page=await (await browser.newContext({viewport:{width:1280,height:900}})).newPage();page.setDefaultTimeout(30000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
 await page.waitForFunction(()=>!window.BOOTING&&window.DecorGLB?.ready&&window.Slug3D?.ready,null,{timeout:90000});
 await page.evaluate(()=>{
  document.getElementById('questCard')?.remove();
  const key=Object.keys(CATALOG).find(k=>CATALOG[k].race),t=G.objs.find(o=>o.type==='tank');t.def=CATALOG[key];t._key=key;t.decor=[];t.foods=[];
  t.slugs=[95,85,75,20].map((g,i)=>makeSlug({...SlugEngine.randGene(),len:g,vigor:g,girth:100-g,gillLen:100-g,gillN:90,mainC:40+i*80}));
  addCoin(5000-G.coin);G.racing.purchased=true;G.racing.offer=null;G.racing.nextAt=Date.now()+1e9;G.racing.tourNextAt=Date.now()+1e9;
  G.tug.tourNextAt=Date.now()+1e9;G.door=G.door||{side:'north',offset:0};setMode('view');
 });
 return page;
};
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 /* (1) แข่งปกติ: เราเข้าเส้นชัยก่อน → ยังไม่ขึ้นผล จนบอททั้งสองเข้า */
 {
  const page=await boot();
  await page.evaluate(()=>{const t=G.objs.find(o=>o.def.race),s=t.slugs[0];
   const rivals=[{name:'ก',genes:SlugEngine.randGene(),pace:6},{name:'ข',genes:SlugEngine.randGene(),pace:6}];
   G.racing.active={tankId:t.id,wager:0,elapsed:0,countdown:0,lastKey:null,settled:false,rank:0,
    entrants:[{name:'เรา',genes:{...s.genes},id:s.id},...rivals].map((r,i)=>({...r,...SlugRace.stride(r.genes),head:20,finished:null,next:i?1/r.pace:0}))};});
  await page.waitForFunction(()=>document.getElementById('raceTankHUD'));await page.waitForTimeout(600);
  await page.evaluate(()=>{const r=G.racing.active.entrants[0];r.head=179.99;});
  await page.keyboard.press('KeyA');await page.keyboard.press('KeyD');await page.waitForTimeout(700);
  report.normalAfterWeFinish=await page.evaluate(()=>({meFinished:G.racing.active.entrants[0].finished!=null,botsFinished:G.racing.active.entrants.slice(1).filter(r=>r.finished!=null).length,settled:G.racing.active.settled,resultOpen:!!document.querySelector('#raceResult[open]'),status:document.querySelector('.race-count')?.textContent}));
  assert.ok(report.normalAfterWeFinish.meFinished&&!report.normalAfterWeFinish.settled&&!report.normalAfterWeFinish.resultOpen,'must wait for others');
  await page.waitForSelector('#raceResult[open]',{timeout:40000});
  report.normalEnd=await page.evaluate(()=>({all:G.racing.active.entrants.every(r=>r.finished!=null&&r.finished!==Infinity),rank:G.racing.active.rank}));
  assert.ok(report.normalEnd.all,'everyone crossed before result');assert.equal(report.normalEnd.rank,1);
  await page.context().close();
 }
 /* (2) ทัวร์นาเมนต์วิ่ง */
 const page=await boot();
 await page.evaluate(()=>{G.racing.tourNextAt=0;});
 await page.waitForFunction(()=>(G.computerInbox||[]).some(m=>m.id.startsWith('race-tour-')),null,{timeout:8000});
 await page.evaluate(()=>openCounterComputer());
 const card=page.locator('details',{hasText:'ทัวร์นาเมนต์วิ่ง'}).first();await card.locator('summary').click();
 const coin0=await page.evaluate(()=>G.coin);
 await card.getByRole('button',{name:/สมัคร 1,000/}).click();
 report.registered=await page.evaluate(()=>({status:G.racing.tour?.status,teams:G.racing.tour?.teams.length,reserved:SlugRace.reserved(G.objs.find(o=>o.def.race))}));
 assert.equal(report.registered.status,'prep');assert.equal(await page.evaluate(()=>G.coin),coin0-1000);assert.ok(report.registered.reserved);
 await page.waitForSelector('.race-tour-bar:not([hidden])');await shot(page,'1-prep-bar');
 await page.evaluate(()=>{G.racing.tour.prepUntil=Date.now()-1;});
 await page.waitForSelector('dialog.tug-ask[open]',{timeout:5000});await page.waitForTimeout(300);await shot(page,'2-pick','dialog.tug-ask');
 await page.getByRole('button',{name:/ยืนยันทีม/}).click();
 await page.waitForSelector('dialog.tug-bracket[open]',{timeout:8000});await page.waitForTimeout(300);await shot(page,'3-bracket','dialog.tug-bracket');
 let watched=false,heatsPlayed=0,loops=0;
 while(loops++<60){
  if(await page.locator('dialog.tug-tour-result[open]').count())break;
  await page.waitForSelector('dialog[open]',{timeout:15000});
  const has=async n=>(await page.getByRole('button',{name:n}).count())>0;
  if(await has('เริ่มคู่นี้')){await page.getByRole('button',{name:'เริ่มคู่นี้'}).click();}
  else if(!watched&&await has('ดูการแข่ง')){await page.getByRole('button',{name:'ดูการแข่ง'}).click();}
  else if(await has('เริ่มเที่ยวนี้')){
   if(!heatsPlayed)await shot(page,'4-heat-pick','dialog.race-series');
   await page.getByRole('button',{name:'เริ่มเที่ยวนี้'}).click();
   await page.waitForFunction(()=>document.getElementById('raceTankHUD')&&G.racing.active&&!G.racing.active.botOnly);
   await page.waitForTimeout(3300);
   for(let i=0;i<6;i++)await page.keyboard.press(i%2?'KeyD':'KeyA');
   const id=await page.evaluate(()=>G.racing.active.entrants[0].id);
   if(!heatsPlayed)await shot(page,'5-our-heat');
   await page.evaluate(()=>{const a=G.racing.active;a.entrants[0].head=179.99;a.entrants[1].head=20;});
   await page.keyboard.press('KeyA');await page.keyboard.press('KeyD');
   // บอทยังไม่ถึง → ต้องไม่ขึ้นผลเที่ยว ให้บอทเข้าเส้นแบบเร็ว
   await page.waitForTimeout(400);
   report.heatWait=report.heatWait??await page.evaluate(()=>({settled:G.racing.active?.settled,status:document.querySelector('.race-count')?.textContent}));
   await page.evaluate(()=>{const b=G.racing.active?.entrants[1];if(b)b.head=179.9;});
   await page.waitForFunction(()=>!document.getElementById('raceTankHUD'),null,{timeout:20000});
   report.fatigue=report.fatigue??await page.evaluate(id=>{const s=G.objs.find(o=>o.def.race).slugs.find(x=>x.id===id);return{buffs:s.foodBuffs.filter(b=>b.type==='raceFatigue').length,vigorNow:foodGenes(s).vigor,vigorBase:s.genes.vigor};},id);
   heatsPlayed++;
  }else if(await has('ดูเที่ยวนี้')&&!watched){
   await page.getByRole('button',{name:'ดูเที่ยวนี้'}).click();
   await page.waitForFunction(()=>document.getElementById('raceTankHUD')&&G.racing.active?.botOnly);
   await page.waitForTimeout(5500);
   report.botHeat=await page.evaluate(()=>({heads:G.racing.active.entrants.map(r=>+r.head.toFixed(1)),noKeys:!document.querySelector('.race-controls button:not(.race-skip)')}));
   assert.ok(report.botHeat.heads.every(h=>h>20),'both bots run');assert.ok(report.botHeat.noKeys);
   await shot(page,'6-bot-heat');
   await page.getByRole('button',{name:/ข้ามไปดูผล/}).click();watched=true;
   await page.waitForFunction(()=>!document.getElementById('raceTankHUD'),null,{timeout:20000});
  }else if(await has('⏭ ข้ามคู่นี้')){await page.getByRole('button',{name:'⏭ ข้ามคู่นี้'}).click();}
  else if(await has('⏭ ข้ามทั้งคู่')){await page.getByRole('button',{name:'⏭ ข้ามทั้งคู่'}).click();}
  await page.waitForTimeout(600);
 }
 await page.waitForSelector('dialog.tug-tour-result[open]',{timeout:15000});await page.waitForTimeout(400);await shot(page,'7-result','dialog.tug-tour-result');
 report.result=await page.evaluate(()=>({final:G.racing.tour.final,prize:G.racing.tour.prize,player:G.racing.tour.teams.findIndex(T=>T.player),coin:G.coin}));
 report.heatsPlayed=heatsPlayed;
 const coinBefore=report.result.coin;
 await page.getByRole('button',{name:'กลับร้าน'}).click();await page.waitForTimeout(800);
 report.after=await page.evaluate(()=>({tour:G.racing.tour,coin:G.coin,reserved:SlugRace.reserved(G.objs.find(o=>o.def.race))}));
 assert.equal(report.after.tour,null);assert.equal(report.after.coin,coinBefore);assert.equal(report.result.prize,3000);
 assert.ok(report.heatWait&&!report.heatWait.settled,'heat waits for opponent');assert.ok(report.botHeat,'watched a bot heat');
 assert.ok(report.fatigue.buffs>=1&&report.fatigue.vigorNow<=report.fatigue.vigorBase-10,'fatigue applied');
 console.log(JSON.stringify(report,null,1));
}catch(e){console.log(JSON.stringify(report,null,1));console.log("PAGE ERRORS SO FAR",errors);try{const pg=browser.contexts().at(-1)?.pages()[0];if(pg)console.log(JSON.stringify(await pg.evaluate(()=>({active:G.racing.active&&{settled:G.racing.active.settled,settleAt:G.racing.active._settleAt,elapsed:G.racing.active.elapsed,heads:G.racing.active.entrants.map(r=>[r.head,r.finished,r.step,r.pace])},match:G.racing.tour?.match,hud:!!document.getElementById("raceTankHUD"),hidden:document.hidden}))));}catch(_){}throw e;}finally{await browser?.close();server.close();}
if(errors.length){console.log('PAGE ERRORS',errors);process.exitCode=1;}
