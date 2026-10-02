// 3D tank decor removal: saved 3D decor is refunded once, 2D + four-view sprite decor still work.
// Isolated browser profile (fresh context) — never touches the player's save.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),report={},errors=[];
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://local');let p=decodeURIComponent(url.pathname);if(p==='/')p='/index.html';const f=path.resolve(root,'.'+p);
 if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');
 if(p==='/index.html'&&url.searchParams.has('sprite')){res.end(fs.readFileSync(f,'utf8').replace('<script src="js/decor-defs.js"></script>','<script src="js/decor-defs.js"></script><script src="js/sprite-decor-defs.js"></script>'));return;}
 fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
let watch=false;page.on('pageerror',e=>{if(watch)errors.push(String(e));});
const ready=()=>page.waitForFunction(()=>!window.BOOTING&&typeof engineReady!=='undefined'&&engineReady,null,{timeout:90000});
try{
 await page.goto(base);await ready();
 report.no3dDecorAssets=await page.evaluate(()=>({defs3d:typeof DECOR3D_DEFS,tidal:typeof TidalDecor,model:Object.values(TANK_DECOR).filter(d=>d.model).length,sprite:typeof SpriteDecor}));
 assert.deepEqual(report.no3dDecorAssets,{defs3d:'undefined',tidal:'undefined',model:0,sprite:'object'});
 // plant an old-style save: 3D decor inside a tank, 3D credits, an unknown non-3D credit and a showcase pointing at 3D decor
 const setup=await page.evaluate(()=>{const t=G.objs.find(o=>o.type==='tank'&&!isBreeder(o));t.decor=[{key:'tidal_07',fx:3,fy:3,flip:0},{key:'reviewed_dragon_rock',fx:6,fy:4,flip:1}];
  G.decorCredit={tidal_01:2,mystery_2d_piece:1};const counter=G.objs.find(o=>o._key==='counter');if(counter)counter.showcase={slugId:null,decorKey:'tidal_03'};
  saveGame();return{coin:G.coin,tank:t.id,counter:!!counter};});
 await page.reload();await ready();watch=true;
 report.migrated=await page.evaluate(id=>({coin:G.coin,decor:G.objs.find(o=>o.id===id).decor.map(d=>d.key),credit:G.decorCredit,showcase:G.objs.find(o=>o._key==='counter')?.showcase?.decorKey??null}),setup.tank);
 const expected=40+48+56;   // tidal_07 20cm · reviewed_dragon_rock 24.06cm · tidal_01 14cm ×2 (×2 coin/cm, min 20)
 assert.equal(report.migrated.coin,setup.coin+expected,'refund amount');assert.deepEqual(report.migrated.decor,[]);assert.deepEqual(report.migrated.credit,{mystery_2d_piece:1});
 if(setup.counter)assert.equal(report.migrated.showcase,'');
 await page.waitForFunction(()=>/คืนเงิน 144 เหรียญ สำหรับ 4 ชิ้น/.test(document.getElementById('toast')?.textContent||''),null,{timeout:8000});report.toast=true;
 await page.reload();await ready();report.onlyOnce=await page.evaluate(()=>G.coin);assert.equal(report.onlyOnce,report.migrated.coin,'refund not repeated');
 // 2D decor still buys/places/renders in the tank
 report.decor2d=await page.evaluate(()=>{const t=G.objs.find(o=>o.type==='tank'&&!isBreeder(o));enterTank(t);fitTankZoom();centerTankCam();const key=Object.keys(TANK_DECOR).find(k=>!TANK_DECOR[k].sprite);
  t.decor.push({key,fx:t.def.w/2,fy:t.def.h/2,flip:0});return{key,count:t.decor.length}});
 await page.waitForTimeout(800);
 report.tankRender=await page.evaluate(()=>{const box=drawDecorAt(curTank.decor.at(-1).key,curTank.decor.at(-1).fx,curTank.decor.at(-1).fy,1,0);return{box:!!box}});
 assert.ok(report.tankRender.box,'2D decor renders');
 await page.evaluate(()=>exitTank());await page.waitForTimeout(800);report.shopErrors=errors.slice();
 // four-view sprite decor works on its own runtime (defs injected only for this check, as the art is still under review)
 await page.goto(base+'?sprite=1');await ready();
 report.sprite=await page.evaluate(()=>{const t=G.objs.find(o=>o.type==='tank'&&!isBreeder(o));t.decor=[{key:'sprite_dragon_rock',fx:t.def.w/2,fy:t.def.h/2,flip:0}];enterTank(t);fitTankZoom();centerTankCam();
  return{catalog:!!TANK_DECOR.sprite_dragon_rock,is:SpriteDecor.is('sprite_dragon_rock'),rotations:flipOptions('sprite_dragon_rock'),cells:decorFootprint('sprite_dragon_rock',t.def.w/2,t.def.h/2,1).size,label:decorRotationName('sprite_dragon_rock',2)}});
 assert.equal(report.sprite.catalog,true);assert.equal(report.sprite.is,true);assert.deepEqual(report.sprite.rotations,[0,1,2,3]);assert.ok(report.sprite.cells>0);
 await page.waitForFunction(()=>{const d=curTank.decor[0];return !!drawDecorAt(d.key,d.fx,d.fy,1,d.flip)},null,{timeout:15000});
 await page.evaluate(()=>exitTank());await page.waitForTimeout(800);
 report.errors=errors;assert.deepEqual(errors,[]);report.passed=true;
}finally{await browser.close();server.close();}
console.log(JSON.stringify(report));
