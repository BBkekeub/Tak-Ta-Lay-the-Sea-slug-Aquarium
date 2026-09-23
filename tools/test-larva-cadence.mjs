import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../js/breeding.js',import.meta.url),'utf8');
const code=src.slice(src.indexOf('function breederLarvaeInView'),src.indexOf('function breederVisualSlugs'))+
 src.slice(src.indexOf('function walkBreedingZone'),src.indexOf('/* จุดว่างใกล้ตัวที่สุด'));
function setup(){
 const s={fx:27,fy:5,dir:0,turn:0,state:'walk',stt:100,genes:{},_breedScale:.5,_foodZoneLo:25,_foodZoneHi:30};
 const o={def:{breeder:true,w:30,h:10},decor:[],slugs:[],breeding:{phase:'idle',larvae:[{slug:s,left:60}]}};
 const c=vm.createContext({s,o,curTank:o,tankMode:true,document:{hidden:false},window:{},heldSlug:null,SLUG_SPEED:.2,SLUG_TURN:3,CM_PER_CELL:5,
  isBreeder:o=>o.def.breeder,breederState:o=>o.breeding,tankCleanliness:()=>100,prepareBreederFoodSlugs:()=>[],foodPrepare(){},foodStep:()=>false,
  slugCm:()=>5,decorSolidSet:()=>new Set(),ptKey:(x,y)=>x+','+y,decay:0,foodDecay(a,dt){this;},G:{inv:[]}});
 vm.runInContext(code,c);return c;
}
for(const hz of [20,30,60]){
 const c=setup();let changed=0,old=c.s.fx,maxStep=0;
 for(let i=0;i<hz;i++){
  vm.runInContext(`stepBreederLarvae(o,${1/hz});`,c);
  const d=c.s.fx-old;if(d>0)changed++;maxStep=Math.max(maxStep,d);old=c.s.fx;
 }
 for(let i=0;i<4;i++)vm.runInContext('tickBreeder(o,.25)',c);
 assert.equal(changed,hz);assert.ok(Math.abs(c.s.fx-27.2)<1e-9);assert.ok(maxStep<=.2/hz+1e-9);
 assert.equal(c.o.breeding.larvae[0].left,59,'Growth keeps elapsed seconds, no per-frame double count');
 c.document.hidden=true;vm.runInContext('stepBreederLarvae(o,.25);tickBreeder(o,.25)',c);
 assert.ok(Math.abs(c.s.fx-27.25)<1e-9,'Hidden motion transfers to timer once');
 c.document.hidden=false;c.tankMode=false;vm.runInContext('stepBreederLarvae(o,.25);tickBreeder(o,.25)',c);
 assert.ok(Math.abs(c.s.fx-27.3)<1e-9,'Closed tank still moves on timer');
 c.tankMode=true;c.heldSlug=c.s;vm.runInContext('stepBreederLarvae(o,.05)',c);assert.ok(Math.abs(c.s.fx-27.3)<1e-9,'Held larva does not move');
}
console.log('Passed: 20/30/60 Hz continuous motion; no double stepping; growth, hidden/closed tank and held larva.');
