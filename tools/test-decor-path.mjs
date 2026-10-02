// Slugs crawl along the branches of a mesh-derived driftwood piece in the real game.
// Fresh headless profile over http — never reads or writes the player's save.
//  sand under the resting log is solid · a slug walks to a climb point, climbs on, crawls the branch paths
//  (height/tilt follow the ridge), then climbs back down onto free sand · works at all 4 rotations
// Run from the repo root:  node tools/test-decor-path.mjs [screenshot-dir]
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),key='sprite_driftwood_talawa_sweep',shots=process.argv[2]||null,errors=[];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+(u==='/'?'/index.html':decodeURIComponent(u)));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await (await browser.newContext({viewport:{width:1400,height:900}})).newPage();
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push('console '+m.text().slice(0,200));});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForFunction(()=>!window.BOOTING&&typeof engineReady!=='undefined'&&engineReady&&typeof G!=='undefined'&&G.objs?.length,null,{timeout:120000});
 const r=await page.evaluate(k=>{
  const t=G.objs.find(o=>o.type==='tank'&&!isBreeder(o)&&!o.def.race&&!o.def.tug&&!o.def.eat&&!o.def.throwing&&!o.def.sumo);
  const s=makeSlug({...SlugEngine.randGene(),len:40,girth:40});t.slugs=[s];
  const o={key:k,fx:t.def.w/2,fy:t.def.h/2,flip:0};t.decor=[o];enterTank(t);fitTankZoom();centerTankCam();
  const out={},g=decorPathGraph(o),SOLID=decorSolidSet(t.decor),fw=t.def.w,fh=t.def.h;
  out.graph={nodes:g.n.length,entries:g.entries.length,maxZcm:+(Math.max(...g.n.map(n=>n.z))*CM_PER_CELL).toFixed(1)};
  out.solidCells=SOLID.size;
  const rad=slugCm(s.genes)/CM_PER_CELL*0.35,blk=(x,y)=>[[0,0],[rad,0],[-rad,0],[0,rad],[0,-rad]].some(([a,b])=>SOLID.has(ptKey(x+a,y+b)));
  const ok=(x,y)=>{const mg=slugEdgeMargin(s,fw);return x>mg&&y>mg&&x<fw-mg&&y<fh-mg&&!blk(x,y);};
  // (1) the AI route: walk to a climb point → arrival starts the climb
  const i=g.entries[0],aim=deckGroundPoint(g,i,rad,ok,{x:s.fx,y:s.fy});
  Object.assign(s,{fx:aim.x+.6,fy:aim.y,state:'seekDecor',stt:60,intentX:aim.x,intentY:aim.y,_deckGoal:{o,i},dir:Math.PI,turn:Math.PI,wall:null,climbZ:0});
  let frames=0;while(!s.deck&&frames++<60*60)stepTankSlugs(t.slugs,fw,fh,1/60,true,t.decor,t.def);
  out.climbedOn=!!s.deck;out.reachSeconds=+(frames/60).toFixed(1);
  // (2) crawl: phases, height, tilt, staying on the path
  const seen=new Set(),phases=new Set();let maxZ=0,maxTilt=0,off=0,sandHits=0;
  for(let f=0;f<60*90&&s.deck;f++){stepTankSlugs(t.slugs,fw,fh,1/60,true,t.decor,t.def);if(!s.deck)break;
   phases.add(s.deck.phase);seen.add(s.deck.a);maxZ=Math.max(maxZ,s._deckZ||0);maxTilt=Math.max(maxTilt,Math.abs(s._deckTilt||0));
   if(s.deck.phase==='walk'){const A=g.n[s.deck.a],B=g.n[s.deck.b];const t0=s.deck.t,x=A.x+(B.x-A.x)*t0,y=A.y+(B.y-A.y)*t0;if(Math.hypot(x-s.fx,y-s.fy)>1e-6)off++;}}
  out.crawl={phases:[...phases],nodesVisited:seen.size,maxZcm:+(maxZ*CM_PER_CELL).toFixed(1),maxTiltDeg:Math.round(maxTilt*180/Math.PI),offPath:off};
  // (3) leaving: time is up → heads to a climb point and climbs down onto free sand
  if(s.deck)s.deck.stay=0;
  frames=0;while(s.deck&&frames++<60*120)stepTankSlugs(t.slugs,fw,fh,1/60,true,t.decor,t.def);
  out.leave={off:!s.deck,z:s._deckZ||0,onSolid:SOLID.has(ptKey(s.fx,s.fy)),seconds:+(frames/60).toFixed(1)};
  // (4) the sand under the resting log stays blocked for slugs on the ground
  Object.assign(s,{state:'walk',stt:60});let into=0;
  for(let f=0;f<60*40;f++){s.turn=Math.atan2(o.fy-s.fy,o.fx-s.fx);s.state='walk';s.stt=60;delete s._deckGoal;stepTankSlugs(t.slugs,fw,fh,1/60,true,t.decor,t.def);if(!s.deck&&SOLID.has(ptKey(s.fx,s.fy)))into++;if(s.deck)break;}
  out.groundIntoSolid=into;
  // (5) every rotation has its own path; a slug placed mid-branch sits on the ridge
  out.rotations=[0,1,2,3].map(rot=>{o.flip=rot;const G2=decorPathGraph(o);const mid=G2.n.findIndex(n=>n.z*CM_PER_CELL>5);return{nodes:G2.n.length,entries:G2.entries.length,mid};});
  o.flip=0;s.deck=null;
  window.pathQA={t,s,o};
  return out;},key);
 console.log(JSON.stringify(r));
 assert.ok(r.graph.nodes>20&&r.graph.entries>0,'crawl path baked');assert.ok(r.solidCells>0,'sand under the log is solid');
 assert.ok(r.climbedOn,'walked to the climb point and climbed on');
 assert.ok(r.crawl.phases.includes('up')||r.crawl.phases.includes('walk'),'crawling');assert.ok(r.crawl.nodesVisited>5,'moved along the branches');
 assert.ok(r.crawl.maxZcm>3.5,'up on the wood');assert.equal(r.crawl.offPath,0,'stays exactly on the path');
 assert.ok(r.leave.off&&r.leave.z===0&&!r.leave.onSolid,'climbed down onto free sand');
 assert.equal(r.groundIntoSolid,0,'no walking through the log on the ground');
 assert.ok(r.rotations.every(x=>x.nodes===r.graph.nodes&&x.entries===r.graph.entries&&x.mid>=0),'all four rotations');
 if(shots){fs.mkdirSync(shots,{recursive:true});
  for(const rot of [0,1,2,3]){
   const box=await page.evaluate(rot=>{const {s,o}=pathQA;o.flip=rot;const g=decorPathGraph(o);
    // a slug mid-way along a raised branch, heading along it
    const a=g.n.findIndex((n,i)=>n.z*CM_PER_CELL>5&&g.adj[i].length===2),b=g.adj[a][0];
    s.deck={o,g,a,b,t:.2,phase:'walk',from:null,to:null,time:0,stay:1e9,rad:.3,wait:0};s._deckTilt=0;
    for(let i=0;i<40;i++)stepTankSlugs(curTank.slugs,curTank.def.w,curTank.def.h,1/60,true,curTank.decor,curTank.def);
    s.deck.stay=1e9;const p=S(o.fx,o.fy,SAND_CELLS),r=tankCv.getBoundingClientRect();return{x:r.left+p.x,y:r.top+p.y};},rot);
   await page.waitForTimeout(300);
   await page.screenshot({path:path.join(shots,`crawl-${rot*90}.png`),clip:{x:Math.max(0,box.x-420),y:Math.max(0,box.y-330),width:840,height:470}});
  }}
 assert.deepEqual(errors,[],'no page errors');
 console.log('PASS: solid sand under the log, climb on at a climb point, crawl the branch paths, climb down, 4 rotations');
}finally{await browser.close();server.close();}
