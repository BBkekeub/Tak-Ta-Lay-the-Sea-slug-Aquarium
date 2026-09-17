// ทัวร์นาเมนต์ชักเย่อ ตั้งแต่ต้นจนจบ: จดหมายเชิญ → สมัคร → เตรียมตัว → เลือกทีม → สายแข่ง → ดู/ข้ามคู่บอท → คู่ของเรา → ผล/รางวัล
// โปรไฟล์ใหม่ทุกครั้ง ไม่แตะเซฟผู้เล่น · ภาพออกที่ tools/qa/tug-tournament/
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'tools/qa/tug-tournament');fs.mkdirSync(out,{recursive:true});
const {chromium}=createRequire(import.meta.url)('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+(p==='/'?'/index.html':decodeURIComponent(p)));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.glb':'model/gltf-binary','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[],report={};
const shot=async(page,name,sel)=>{if(sel){const b=await page.locator(sel).boundingBox();if(b){await page.screenshot({path:path.join(out,name+'.png'),clip:{x:Math.max(0,b.x-6),y:Math.max(0,b.y-6),width:b.width+12,height:Math.min(900-Math.max(0,b.y-6),b.height+12)}});return;}}await page.screenshot({path:path.join(out,name+'.png')});};
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await (await browser.newContext({viewport:{width:1280,height:900}})).newPage();page.setDefaultTimeout(30000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
 await page.waitForFunction(()=>!window.BOOTING&&window.DecorGLB?.ready&&window.Slug3D?.ready,null,{timeout:90000});
 await page.evaluate(()=>{
  document.getElementById('questCard')?.remove();
  const t=G.objs.find(o=>o.type==='tank');t.def=CATALOG.tank_tug;t._key='tank_tug';t.decor=[];t.foods=[];
  t.slugs=[90,80,70,20].map((g,i)=>makeSlug({...SlugEngine.randGene(),girth:g,len:g,vigor:g,gillN:90,mainC:40+i*80}));
  addCoin(5000-G.coin);G.tug.purchased=true;G.tug.offer=null;G.tug.nextAt=Date.now()+1e9;G.tug.tourNextAt=0;
  G.door=G.door||{side:'north',offset:0};setMode('view');
 });
 // 1) จดหมายเชิญมาถึง
 await page.waitForFunction(()=>(G.computerInbox||[]).some(m=>m.id.startsWith('tug-tour-')),null,{timeout:8000});
 report.mail=await page.evaluate(()=>G.computerInbox.find(m=>m.id.startsWith('tug-tour-')).title);
 // 2) เปิดคอมพิวเตอร์ → การ์ดจดหมาย → กดสมัคร
 await page.evaluate(()=>openCounterComputer());
 const card=page.locator('details',{hasText:'ทัวร์นาเมนต์ชักเย่อ'}).first();
 await card.locator('summary').click();
 const reg=card.getByRole('button',{name:/สมัคร 1,000/});
 await shot(page,'1-mail');
 const coin0=await page.evaluate(()=>G.coin);
 await reg.click();
 report.registered=await page.evaluate(()=>({status:G.tug.tour?.status,teams:G.tug.tour?.teams.length,player:G.tug.tour?.teams.findIndex(T=>T.player)}));
 assert.equal(report.registered.status,'prep');assert.equal(report.registered.teams,8);
 assert.equal(await page.evaluate(()=>G.coin),coin0-1000);
 // 3) แถบเตรียมตัวหน้าร้าน + ลูกค้าปกติไม่เลือกตู้ชักเย่อ
 await page.waitForSelector('.tug-tour-bar:not([hidden])');
 report.bar=await page.locator('.tug-tour-bar').textContent();
 report.reserved=await page.evaluate(()=>SlugTug.reserved(G.objs.find(o=>o.def.tug)));
 await shot(page,'2-prep-bar');
 // ให้หมดเวลาเตรียมตัว → หน้าเลือกทีมเด้งเอง
 await page.evaluate(()=>{G.tug.tour.prepUntil=Date.now()-1;});
 await page.waitForSelector('dialog.tug-ask[open]',{timeout:5000});
 await page.waitForTimeout(300);await shot(page,'3-pick','dialog.tug-ask');
 await page.getByRole('button',{name:/ยืนยันทีม/}).click();
 // 4) สายแข่ง
 await page.waitForSelector('dialog.tug-bracket[open]',{timeout:8000});await page.waitForTimeout(400);
 await shot(page,'4-bracket','dialog.tug-bracket');
 // วนจนจบ: คู่บอท = ดู 1 คู่แรกจริง แล้วข้ามที่เหลือ · คู่ของเรา = กดรัวจนชนะ (บังคับแต้มเพื่อความเร็ว)
 let watched=false,played=0,loops=0;
 while(loops++<12){
  if(await page.locator('dialog.tug-tour-result[open]').count())break;
  await page.waitForSelector('dialog.tug-bracket[open]',{timeout:15000});
  if(await page.getByRole('button',{name:'เริ่มแข่ง'}).count()){
   await page.getByRole('button',{name:'เริ่มแข่ง'}).click();
   await page.waitForFunction(()=>document.getElementById('tugTankHUD')&&G.tug.active&&!G.tug.active.me.bot);
   await page.waitForTimeout(3600);
   for(let i=0;i<8;i++)await page.keyboard.press(i%2?'KeyK':'KeyF');
   const pressed=await page.evaluate(()=>G.tug.active.me.total);assert.ok(pressed>0,'player presses count');
   if(!played)await shot(page,'5-our-match');
   await page.evaluate(()=>{G.tug.active.rope=149.9;});await page.keyboard.press('KeyF');await page.keyboard.press('KeyK');
   played++;
  }else if(!watched){
   await page.getByRole('button',{name:'ดูการแข่ง'}).click();
   await page.waitForFunction(()=>document.getElementById('tugTankHUD')&&G.tug.active?.me.bot);
   await page.waitForTimeout(5000);
   report.botMatch=await page.evaluate(()=>({rope:+G.tug.active.rope.toFixed(1),left:G.tug.active.me.total,right:G.tug.active.foe.total,keysHidden:!document.querySelector('.tug-key')}));
   assert.ok(report.botMatch.left>0&&report.botMatch.right>0,'both bots press');assert.ok(report.botMatch.keysHidden);
   await shot(page,'6-bot-match');
   await page.getByRole('button',{name:/ข้ามไปดูผล/}).click();watched=true;
  }else{
   await page.getByRole('button',{name:/ข้ามคู่นี้/}).click();
  }
  await page.waitForTimeout(1500);
 }
 await page.waitForSelector('dialog.tug-tour-result[open]',{timeout:15000});await page.waitForTimeout(500);
 await shot(page,'7-result','dialog.tug-tour-result');
 report.result=await page.evaluate(()=>({final:G.tug.tour.final,paid:G.tug.tour.prize,qf:G.tug.tour.qf,sf:G.tug.tour.sf,coin:G.coin}));
 report.played=played;
 const before=report.result.coin;
 await page.getByRole('button',{name:'กลับร้าน'}).click();await page.waitForTimeout(800);
 report.after=await page.evaluate(()=>({tour:G.tug.tour,tankMode,coin:G.coin,reserved:SlugTug.reserved(G.objs.find(o=>o.def.tug))}));
 assert.equal(report.after.tour,null);assert.equal(report.after.coin,before,'prize paid once only');
 console.log(JSON.stringify(report,null,1));
}catch(e){console.log(JSON.stringify(report,null,1));throw e;}finally{await browser?.close();server.close();}
if(errors.length){console.log('PAGE ERRORS',errors);process.exitCode=1;}
