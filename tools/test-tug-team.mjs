// ตรวจชักเย่อ: ซูมกล้อง · ปลายเชือกถึงกลางตัว (ทากตัวเล็ก/ใหญ่) · โหมด 2 ต่อ 2 / 3 ต่อ 3 · หน้ารับคำท้า (จำนวนตัวสุ่มมากับคำท้า เลือกไม่ได้)
// โปรไฟล์ใหม่ทุกครั้ง ไม่แตะเซฟของผู้เล่น · ภาพออกที่ tools/qa/tug-team/
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'tools/qa/tug-team');fs.mkdirSync(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+(p==='/'?'/index.html':decodeURIComponent(p)));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.glb':'model/gltf-binary'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[],report={};
const only=process.argv[2];
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const scenarios=[['1v1-small',[0],[0]],['1v1-big',[1],[100]],['2v2',[0,1],[20,90]],['3v3',[2,0,1],[50,0,100]]].filter(s=>!only||s[0]===only||only==='modal'&&false);
 for(const [name,ids,foeGirth] of scenarios){
  const ctx=await browser.newContext({viewport:{width:1280,height:800}}),page=await ctx.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>errors.push(name+': '+e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
  await page.waitForFunction(()=>!window.BOOTING&&window.DecorGLB?.ready&&window.Slug3D?.ready,null,{timeout:90000});
  await page.evaluate(([ids,foeGirth])=>{
   const t=G.objs.find(o=>o.type==='tank');t.def=CATALOG.tank_tug;t._key='tank_tug';t.decor=[];t.foods=[];
   const mk=(girth,len,mainC)=>makeSlug({...SlugEngine.randGene(),girth,len,mainC,gillN:60});
   t.slugs=[mk(0,0,40),mk(100,100,200),mk(30,40,300),mk(60,60,120),mk(10,20,340),mk(80,70,20)];
   PEOPLE.length=0;peopleOn=false;G.tug.purchased=true;
   const team=ids.map(i=>({id:t.slugs[i].id,genes:{...t.slugs[i].genes}})),foes=foeGirth.map(g=>({genes:{...SlugEngine.randGene(),girth:g,len:g}}));
   G.tug.active={tankId:t.id,rope:0,countdown:0,freezeUntil:0,freezeSide:null,settled:false,won:null,camX:10,view:null,elapsed:5,size:ids.length,entry:300*ids.length,prizePot:500*ids.length,
    me:{id:team[0].id,name:'ทดสอบ',genes:team[0].genes,team,total:0,used:0,sneezeUntil:0},
    foe:{name:'บอท',genes:foes[0].genes,team:foes,cps:.001,total:0,used:0,sneezeUntil:0,nextPressAt:0}};
   window.qaTank=t;
  },[ids,foeGirth]);
  await page.waitForFunction(()=>tankMode&&document.getElementById('tugTankHUD')&&G.tug.active?.view,null,{timeout:10000});
  await page.waitForTimeout(3000);
  report[name]=await page.evaluate(()=>{const a=G.tug.active;return{zoom:+tankCam.zoom.toFixed(2),meX:+a.view.meX.toFixed(2),foeX:+a.view.foeX.toFixed(2),
   fx:a.me.team.map(m=>+qaTank.slugs.find(s=>s.id===m.id).fx.toFixed(2)),spectators:SlugTug.spectatorSlugs(qaTank).length};});
  await page.screenshot({path:path.join(out,name+'.png')});
  await ctx.close();
 }
 if(!only||only==='modal'){
  const ctx=await browser.newContext({viewport:{width:1280,height:800}}),page=await ctx.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>errors.push('modal: '+e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
  await page.waitForFunction(()=>!window.BOOTING&&window.DecorGLB?.ready,null,{timeout:90000});
  await page.evaluate(()=>{
   const t=G.objs.find(o=>o.type==='tank');t.def=CATALOG.tank_tug;t._key='tank_tug';t.decor=[];
   t.slugs=[0,100,30,60,10].map((g,i)=>makeSlug({...SlugEngine.randGene(),girth:g,len:g,mainC:40+i*70}));
   document.getElementById('questCard')?.remove();PEOPLE.length=0;peopleOn=false;G.coin=5000;G.tug.purchased=true;G.door={side:'north',offset:0};setMode('view');G.tug.offer={rival:{name:'บอท',genes:SlugEngine.randGene(),cps:9,size:3}};G.tug.nextAt=Date.now()+1e7;
  });
  // เปิดหน้ารับคำท้าผ่านทางเดียวกับผู้เล่น: คลิกคนถือตู้ — ในเทสต์เรียกผ่านคีย์ลัดไม่ได้ จึงหาปุ่มจากโมดอลหลังสร้างคนท้า
  await page.evaluate(()=>{peopleOn=true;});
  await page.waitForFunction(()=>PEOPLE.some(p=>p.tugChallenger),null,{timeout:20000});
  const box=await page.evaluate(()=>{const p=PEOPLE.find(p=>p.tugChallenger);p._enterAt=0;/* หยุด stepPeople แล้วเวลาคิวประตูไม่เดิน — ให้เข้าร้านทันที */p.x=G.objs[0].cx+6;p.y=G.objs[0].cy+6;p.state='look';p.tgt=null;stepPeople=()=>{};
   const w=worldOf(p.x,p.y);cam.x=w.X;cam.y=w.Y;return null;});
  await page.waitForFunction(()=>PEOPLE.find(p=>p.tugChallenger)?._tugHit,null,{timeout:10000});
  const hit=await page.evaluate(()=>{const h=PEOPLE.find(p=>p.tugChallenger)._tugHit,r=cv.getBoundingClientRect();return{x:r.left+(h.x0+h.x1)/2,y:r.top+(h.y0+h.y1)/2};});
  await page.mouse.click(hit.x,hit.y);
  await page.waitForSelector('dialog.slug-tug-dialog[open]');
  const modal=page.locator('dialog.slug-tug-dialog');
  // จำนวนตัวมากับคำท้า (size:3) — ต้องไม่มีปุ่มให้เลือกโหมด
  assert.equal(await modal.getByRole('button',{name:'1 ต่อ 1'}).count(),0);
  report.badge=await modal.locator('.tug-chip').textContent();assert.match(report.badge,/3 ต่อ 3/);
  report.modal3={pressed:await modal.locator('.slug-pick[aria-pressed=true]').count(),start:await modal.locator('button.tbtn').filter({hasText:'จ่าย'}).textContent(),
   disabled:await modal.locator('button.tbtn').filter({hasText:'จ่าย'}).isDisabled(),verdict:await modal.locator('.tug-verdict-box').textContent()};
  assert.equal(report.modal3.pressed,3);
  await page.screenshot({path:path.join(out,'modal-3v3.png')});
  // คลิกตัวที่เลือกอยู่ = เอาออก → ปุ่มเริ่มต้องกดไม่ได้
  await modal.locator('.slug-pick[aria-pressed=true]').first().click();
  report.modalRemove={pressed:await modal.locator('.slug-pick[aria-pressed=true]').count(),disabled:await modal.locator('button.tbtn').filter({hasText:'จ่าย'}).isDisabled()};
  assert.equal(report.modalRemove.pressed,2);assert.ok(report.modalRemove.disabled);
  await modal.locator('.slug-pick[aria-pressed=false]').last().click();
  const coinBefore=await page.evaluate(()=>G.coin);
  await modal.locator('button.tbtn').filter({hasText:'จ่าย'}).click();
  await page.waitForFunction(()=>tankMode&&document.getElementById('tugTankHUD'),null,{timeout:10000});
  report.started=await page.evaluate(()=>({size:G.tug.active.size,team:G.tug.active.me.team.length,foes:G.tug.active.foe.team.length,coin:G.coin}));
  assert.equal(report.started.team,3);assert.equal(report.started.coin,coinBefore-900);
  // กดดึงจริงให้เห็นว่าแต้มขยับ
  await page.waitForTimeout(3500);
  for(let i=0;i<10;i++){await page.keyboard.press(i%2?'KeyK':'KeyF');}
  report.afterPress=await page.evaluate(()=>({rope:G.tug.active.rope,meTotal:G.tug.active.me.total}));
  assert.ok(report.afterPress.meTotal>0);
  await page.screenshot({path:path.join(out,'match-3v3-live.png')});
  await ctx.close();
 }
 console.log(JSON.stringify(report,null,1));
}catch(e){console.log(JSON.stringify(report,null,1));throw e;}finally{await browser?.close();server.close();}
if(errors.length){console.log('PAGE ERRORS',errors);process.exitCode=1;}
