import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
const root=new URL('../',import.meta.url);
const current=fs.readFileSync(new URL('js/tank-view.js',root),'utf8');
const previous=process.env.MASK_BEFORE?fs.readFileSync(process.env.MASK_BEFORE,'utf8'):execFileSync('git',['show','HEAD:js/tank-view.js'],{cwd:root,encoding:'utf8'});
const defs={rock:{solid:Array.from({length:240},(_,i)=>[i%20*.5,Math.floor(i/20)*.5]),behind:[[0,0],[.5,0]],front:[[0,.5],[.5,.5]]},rect:{solid:[3,2]},empty:{}};
function load(s){const ctx=vm.createContext({TANK_DECOR:defs});vm.runInContext(s.slice(s.indexOf('const DCELL='),s.indexOf('function ptKey('))+'\nthis.api={decorCellSet,decorSolidSet};',ctx);return ctx.api;}
const before=load(previous),after=load(current),rocks=Array.from({length:18},(_,i)=>({key:i%3?'rock':'rect',fx:i*.5,fy:i*.25,flip:i%4}));
const sorted=s=>Array.from(s).sort();let cases=0;
function verify(){assert.deepEqual(sorted(after.decorSolidSet(rocks)),sorted(before.decorSolidSet(rocks)));for(const r of rocks)for(const n of ['front','behind'])assert.deepEqual(sorted(after.decorCellSet(r,n)),sorted(before.decorCellSet(r,n)));cases++;}
verify();const cached=after.decorSolidSet(rocks);for(let i=0;i<30;i++)assert.equal(after.decorSolidSet(rocks),cached);
for(const flip of [0,1,2,3]){rocks[0].flip=flip;rocks[1].flip=flip;verify();}
rocks[1].fx+=.5;verify();rocks[2].fy-=1;verify();rocks.reverse();verify();rocks.push({key:'empty',fx:0,fy:0});verify();rocks.pop();verify();rocks[0].key='rect';verify();
defs.rock.solid=[[0,0],[.5,0],[1,0]];verify();defs.rock.front=[[0,0]];verify();defs.rect.solid[0]=4;verify();
rocks.length=0;verify();rocks.push({key:'rock',fx:0,fy:0,flip:1});verify();
defs.rock.solid=Array.from({length:240},(_,i)=>[i%20*.5,Math.floor(i/20)*.5]);
const scene=Array.from({length:18},(_,i)=>({key:'rock',fx:i,fy:i*.5,flip:i%4}));
const cost={};for(const [name,api] of [['before',before],['after',after]]){
 const samples=[];for(let i=0;i<220;i++){const t=performance.now();api.decorSolidSet(scene);for(const d of scene){api.decorCellSet(d,'front');api.decorCellSet(d,'behind');}if(i>=20)samples.push(performance.now()-t);}
 samples.sort((a,b)=>a-b);cost[name]={p50:samples[100],p95:samples[190]};
}
console.log(JSON.stringify({passed:true,cases,cost,cacheReused:true}));
