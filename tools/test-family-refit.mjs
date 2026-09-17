// ครอบครัวเดินไปที่ยืนหน้าตู้ไม่ได้ (มีคนแปลกหน้ายืนขวางจุดของสมาชิก) → ต้องขยับไปจุดอื่นของตู้เดียวกัน ไม่จองจุดเดิมค้าง
// โปรไฟล์ใหม่ ไม่แตะเซฟผู้เล่น
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=createRequire(import.meta.url)('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+(p==='/'?'/index.html':decodeURIComponent(p)));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.glb':'model/gltf-binary','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await (await browser.newContext({viewport:{width:1280,height:800}})).newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
 await page.waitForFunction(()=>!window.BOOTING,null,{timeout:90000});
 const r=await page.evaluate(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  G.door=G.door||{side:'north',offset:0};setMode('view');if(!peopleOn)document.getElementById('bPeople')?.click();
  await sleep(800);PEOPLE.length=0;stepVisitorArrivals=()=>{};           // ปิดลูกค้าสุ่ม ให้มีแต่คนในเทสต์
  const t=G.objs.find(o=>o.type==='tank');
  let ok=false;for(let i=0;i<40&&!ok;i++){ok=spawnVisitors(visitorCapacity()-PEOPLE.length,'family1');if(!ok)await sleep(100);}   // คิวประตูอาจยังไม่ว่าง
  assert(ok,'family spawn');
  const fam=PEOPLE.slice(0,3);for(const p of fam)p._enterAt=0;const g=fam[0].family;
  // รอให้วางแผนไปตู้แล้ว
  for(let i=0;i<40&&!(g.focus===t&&g.stage==='walk');i++)await sleep(100);
  function assert(c,m){if(!c)throw Error(m);}
  assert(g.focus===t,'family planned to tank (stage '+g.stage+')');
  // สมาชิกคนที่ยังอยู่ไกลจุดที่สุด "เดินไม่ได้" (ถูกตรึงตำแหน่ง 4 วิ = เหมือนติดคน/ติดของ ขยับไม่ได้เลย)
  const victim=fam.slice().sort((a,b)=>Math.hypot(b.x-b.tgt.x,b.y-b.tgt.y)-Math.hypot(a.x-a.tgt.x,a.y-a.tgt.y))[0];
  const oldGoal={...victim._familyGoal},px=victim.x,py=victim.y;
  const t0=_peopleT;let movedAt=null,allArrived=null;
  let pin=true;const hold=()=>{if(!pin)return;if(_peopleT-t0>4){pin=false;return;}victim.x=px;victim.y=py;requestAnimationFrame(hold);};hold();
  for(let i=0;i<250;i++){await sleep(100);
    const goal=victim._familyGoal;
    if(movedAt==null&&goal&&Math.hypot(goal.x-oldGoal.x,goal.y-oldGoal.y)>1){movedAt=+(_peopleT-t0).toFixed(1);window.__focusAtMove=g.focus===t;}
    (window.__log||(window.__log=[])).push([+(_peopleT-t0).toFixed(1),g.stage,g.focus===t,fam.map(p=>p.state+':'+Math.round(Math.hypot(p.x-p._familyGoal.x,p.y-p._familyGoal.y))+':'+(p._blockedFor||0).toFixed(1)).join(' ')]);
    if(movedAt!=null&&g.stage==='look'&&fam.every(p=>Math.hypot(p.x-p._familyGoal.x,p.y-p._familyGoal.y)<1.2)){allArrived=+(_peopleT-t0).toFixed(1);break;}
  }
  return {log:window.__log.filter((x,i)=>i%5===0).slice(0,40),focusAtMove:window.__focusAtMove,movedAt,allArrived,stage:g.stage,focusSame:g.focus===t,victimGoalNow:victim._familyGoal,oldGoal,
    reservedOld:PEOPLE.some(q=>q.tgt&&Math.hypot(q.tgt.x-oldGoal.x,q.tgt.y-oldGoal.y)<PERSON_GAP)};
 });
 console.log(JSON.stringify(r,null,1));
 assert.ok(r.movedAt!=null,'stuck member moved to another spot');
 assert.ok(r.movedAt<8,'moved quickly (was up to 35 s)');
 assert.ok(r.focusAtMove,'moved to another spot of the same tank');
 assert.ok(!r.reservedOld,'old spot no longer reserved by the family');
 assert.ok(r.allArrived!=null,'whole family arrived and started looking');
}finally{await browser?.close();server.close();}
if(errors.length){console.log('PAGE ERRORS',errors);process.exitCode=1;}
