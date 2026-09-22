import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url),source=fs.readFileSync(new URL('js/feeding.js',root),'utf8');
const old=execFileSync('git',['show','HEAD:js/feeding.js'],{cwd:root,encoding:'utf8'});
function load(s,cache){const ctx=vm.createContext({slugCm:g=>g.size,CM_PER_CELL:5,ptKey:(x,y)=>Math.floor(x/.5)+','+Math.floor(y/.5)});const start=s.indexOf(cache?'const failedFoodRoutes=':'function foodPath(');vm.runInContext(s.slice(start,s.indexOf('function foodPrepare('))+'\nthis.route=foodPath;',ctx);return ctx.route;}
const before=load(old,false),after=load(source,true),plain=o=>JSON.parse(JSON.stringify(o));
let cases=0,reads=0;
const solid=new Set(Array.from({length:20},(_,i)=>'10,'+i));
const originalHas=solid.has;solid.has=function(k){reads++;return originalHas.call(this,k);};
const slug={fx:3,fy:3,genes:{size:5}};
function check(tx,ty,mask=solid){assert.deepEqual(plain(after(slug,tx,ty,10,10,mask)),plain(before(slug,tx,ty,10,10,mask)));cases++;}
check(8,8);const priorReads=reads;assert.equal(after(slug,8,8,10,10,solid),null);assert.equal(reads,priorReads,'Repeated failure avoids BFS');
for(const [x,y] of [[2,2],[3,3],[7,7],[8,2],[4,4],[0,0]]){check(x,y);check(x,y);}
slug.fx=3.3;slug.fy=3.2;check(8,8);slug.fx=6;check(8,8);
slug.genes.size=8;check(8,8);slug._breedScale=.5;check(8,8);
slug._foodZoneLo=5;slug._foodZoneHi=9;check(8,8);
const clear=new Set();check(8,8,clear);delete slug._foodZoneLo;delete slug._foodZoneHi;check(8,8,clear);
const one=after(slug,7,7,10,10,clear);if(one)one.path.length=0;
check(7,7,clear);
for(let i=0;i<160;i++)after(slug,-i-1,0,10,10,solid);
check(8,8,clear);
console.log(JSON.stringify({passed:true,cases,repeatedFailureSkipsBFS:true}));
