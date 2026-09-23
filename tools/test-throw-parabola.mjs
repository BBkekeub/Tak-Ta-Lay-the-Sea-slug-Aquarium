import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/slug-throw.js',import.meta.url),'utf8')
 .replace('window.SlugThrow={','window.SlugThrow={qa:{launch,advance,stepStone,stoneHeight,projectedDirection,pitchUp,waveHits,previewTrajectory},');
function setup(angle=45,power=.8,physics=3){
 const G={objs:[],shelter:[],throwing:{nextAt:1,active:null}};
 const ctx=vm.createContext({G,cv:{addEventListener(){}},window:{addEventListener(){}},document:{addEventListener(){}},
  makePressLimiter:()=>()=>true,setInterval(){},saveGame(){},SAND_CELLS:0,CM_PER_CELL:5,
  S:(x,y,z)=>({x:x*40+y*19,y:-y*21-z*30})});
 vm.runInContext(source,ctx);
 const api=ctx.window.SlugThrow;
 const a=G.throwing.active={phase:'power',clock:0,turn:0,ring:70,lockAngle:angle,lockPower:power,
  entrants:Array.from({length:4},()=>({genes:{gillLen:60},aim:.7,bot:false,shots:[]}))};
 api.qa.launch();if(physics===2){a.shot.physics=2;a.shot.height=0;}return {a,api};
}
const results=[];
for(const hz of [20,30,60,144])for(const angle of [0,15,45,75,90])for(const boosted of [false,true]){
 const {a,api}=setup(angle,.8,2);let oldHeight=0;
 for(let i=0;i<hz*5;i++){
  if(boosted&&i%Math.round(hz/5)===0){const key=a.shot.presses%2?'k':'f';assert.equal(api.boostKey(key),true);assert.equal(api.boostKey(key),false);}
  api.qa.advance(1/hz);
  assert.ok(a.shot.height>=oldHeight-1e-8,'Never falls before 5 seconds');oldHeight=a.shot.height;
 }
 assert.equal(a.phase,'waves');assert.ok(Math.abs(a.clock)<1e-7);
 const apex=a.shot.height,dist=a.shot.dist;
 assert.ok(Math.abs(apex-a.shot.apex)<1e-7);
 assert.equal(api.boostKey('f'),false,'Cannot boost after apex');
 // Save/load all shot state, then finish without wave penalties for the ballistic check.
 a.shot=JSON.parse(JSON.stringify(a.shot));a.shot.waves.forEach(w=>w.hit=true);
 for(let i=0;i<hz*5;i++){api.qa.advance(1/hz);assert.ok(a.shot.height<=oldHeight+1e-8);oldHeight=a.shot.height;}
 assert.equal(a.phase,'land');assert.equal(a.shot.height,0);assert.equal(a.entrants[0].shots.length,1);
 assert.ok(Math.abs(a.shot.dist-2*dist)<1e-5,'Unimpeded flight finishes at ballistic range');
 results.push({hz,angle,boosted,apex,dist:a.shot.dist});
}
for(const angle of [15,45,75]){
 const r=results.filter(r=>r.angle===angle&&!r.boosted);
 assert.ok(Math.max(...r.map(x=>x.dist))-Math.min(...r.map(x=>x.dist))<1e-6,'Frame-rate independent');
 assert.ok(results.find(r=>r.angle===angle&&r.boosted).dist>r[0].dist,'Boost increases range');
}
const {a,api}=setup();a.entrants[0].bot=true;api.qa.advance(2);api.skipBot();
assert.equal(a.phase,'land');assert.equal(a.entrants[0].shots.length,1);
api.skipBot();assert.equal(a.entrants[0].shots.length,1,'Skip cannot duplicate scoring');
for(const [clock,expected] of [[0,0],[.5/.7,90]]){
 const {a,api}=setup();a.phase='angle';a.clock=clock;api.tap();
 assert.ok(Math.abs(a.lockAngle-expected)<1e-8,'Angle selector reaches '+expected);
}
for(const angle of [15,30,45,60,75,90]){
 const {a,api}=setup(angle),r=angle*Math.PI/180;
 const aimed=api.qa.projectedDirection(Math.cos(r),Math.sin(r));
 api.qa.advance(.001);
 const actual=api.qa.projectedDirection(a.shot.directionX,a.shot.directionZ);
 assert.ok(Math.abs(actual-aimed)<.001,'Projected launch direction matches arrow at '+angle);
 api.qa.advance(5.1);
 assert.ok(a.shot.directionZ<0,'Stone and wind point down during descent');
}
function simulate(strategy,hz=120){
 const {a,api}=setup();
 for(let i=0;i<hz*5;i++)api.qa.advance(1/hz);
 assert.equal(a.phase,'waves');assert.ok(Math.abs(a.clock)<1e-7);
 assert.equal(a.shot.vz,0);
 a.shot=JSON.parse(JSON.stringify(a.shot));
 let nextTap=0,previousX=a.shot.dist;
 const startV=a.shot.vx;
 if(strategy==='once')api.qa.pitchUp(a);
 if(strategy==='clear')a.shot.waves.forEach(w=>w.hit=true);
 for(let i=0;i<hz*12&&a.phase==='waves';i++){
   if(strategy==='timed')for(const w of a.shot.waves){
     if(w.hit==null&&!w.testTapped&&a.clock>=w.at+.1){w.testTapped=true;api.qa.pitchUp(a);}
   }
   if(strategy==='spam'&&a.clock>=nextTap){api.qa.pitchUp(a);nextTap=a.clock+.17;}
   api.qa.advance(1/hz);
   assert.ok(a.shot.dist>=previousX-1e-9);previousX=a.shot.dist;
   assert.ok(Number.isFinite(a.shot.v)&&a.shot.vx>=0);
 }
 assert.equal(a.phase,'land');assert.equal(a.entrants[0].shots.length,1);
 assert.ok(a.shot.vx<startV,'Air drag changes actual horizontal velocity');
 return {dist:a.shot.dist,hits:a.shot.waves.filter(w=>w.hit).length,vx:a.shot.vx};
}
for(const [offset,hit] of [[-.001,false],[0,true],[.1125,true],[.225,true],[.226,false]]){
 const {a,api}=setup();api.qa.advance(5);a.clock=1+offset;
 api.qa.pitchUp(a);api.qa.advance(.3);
 assert.equal(a.shot.waves[0].hit,hit,'Nose-to-midpoint boundary '+offset);
 a.shot=JSON.parse(JSON.stringify(a.shot));
 assert.equal(a.shot.waves[0].hit,hit,'Contact result survives save/load');
}
const strategies=Object.fromEntries(['clear','none','once','timed','spam'].map(k=>[k,simulate(k)]));
assert.equal(strategies.once.hits,0,'A single early press cannot receive later waves');
assert.equal(strategies.timed.hits,4,'Each wave can be countered separately');
assert.ok(strategies.timed.dist>strategies.none.dist*1.15,'Missed waves materially reduce distance');
assert.ok(strategies.timed.dist>strategies.spam.dist,'Spamming loses to timed control');
for(const hz of [20,30,60,144]){
 const r=simulate('clear',hz);
 assert.ok(Math.abs(r.dist-strategies.clear.dist)<.15,'Continuous physics remains stable across FPS');
}
const dragCase=setup();dragCase.api.qa.advance(5);
const shot=dragCase.a.shot;
shot.waves.forEach(w=>w.hit=true);shot.pitch=60;
dragCase.api.qa.advance(.01);const raisedDrag=shot.drag;
shot.pitch=0;dragCase.api.qa.advance(.01);
assert.ok(raisedDrag>shot.drag*5,'Exposed face causes greater drag');
for(const angle of [0,15,45,75,90])for(const hz of [20,60,144]){
 const {a,api}=setup(angle);let height=a.shot.height;
 for(let i=0;i<5*hz;i++){
   if(i%hz===0)api.boostKey(i/hz%2?'k':'f');
   api.qa.advance(1/hz);
   assert.ok(a.shot.height>=height-1e-8,'Ascent does not turn downward early');height=a.shot.height;
 }
 assert.equal(a.phase,'waves');assert.equal(a.shot.vz,0);
 a.shot=JSON.parse(JSON.stringify(a.shot));
 for(let i=0;i<12*hz&&a.phase==='waves';i++)api.qa.advance(1/hz);
 assert.equal(a.phase,'land');
}
const guideCase=setup(),guide=guideCase.api.qa.previewTrajectory(45,200),buffer=guide.points;
assert.equal(guideCase.api.qa.previewTrajectory(45,200).points,buffer,'Guide reuses storage');
assert.equal(guide.points[(guide.count-1)*2+1],0,'Guide reaches ground');
const samples=[];
for(let i=0;i<300;i++){
 const t=performance.now();guideCase.api.qa.previewTrajectory(i%91,200+i%10);samples.push(performance.now()-t);
}
samples.sort((a,b)=>a-b);
console.log(JSON.stringify({previewMsP50:samples[150],previewMsP95:samples[285],currentPhysicsCases:15}));
console.log(JSON.stringify({passed:true,legacyTrajectoryCases:results.length,apexSeconds:5,strategies,continuousDrag:true,projectedAngles:true,resume:true}));
