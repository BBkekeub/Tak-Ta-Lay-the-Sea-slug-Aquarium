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
for(const power of [.35,.65,.85,1])for(const rate of [0,4,8]){
 const {a,api}=setup(45,power);let next=0;
 for(let i=0;i<600;i++){if(rate&&a.clock>=next){api.boostKey(a.shot.presses%2?'k':'f');next+=1/rate;}api.qa.advance(1/120);}
 for(let i=0;i<1440&&a.phase==='waves';i++){for(const w of a.shot.waves)if(w.hit==null&&!w.tried&&a.clock>=w.at+.1)api.qa.pitchUp(a);api.qa.advance(1/120);}
 results.push({power,rate,dist:a.entrants[0].shots[0].dist,hits:a.shot.waves.filter(w=>w.hit).length});
}
assert.ok(results.find(r=>r.power===.85&&r.rate===8).dist>110,'Good play reaches the far end');
assert.ok(results.find(r=>r.power===1&&r.rate===8).dist<results.find(r=>r.power===.85&&r.rate===8).dist,'Overpower is still a foul');
console.log(JSON.stringify(results));
