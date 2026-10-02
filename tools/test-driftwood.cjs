const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
let loads=0,draws=0,saves=0,lastSave;
const ctx={console,document:{hidden:false,addEventListener(){}},window:{},DCELL:.5,CM_PER_CELL:5,
 Image:class{set src(v){this.source=v;loads++;this.onload();}},
 drawDecorAt(){},flipOptions(){return[0,1];},decorCellSet(){return new Set();},decorSolidSet(){return new Set();},
 decorFootprint(){return new Set();},decorRequiredBounds(){},isBreeder(){return false;},
 nudgeSlugsOutOfSolid(){},syncDecorBar(){},toast(){},saveGame(){saves++;lastSave=JSON.stringify(ctx.curTank.decor);},
 tankBuildMode:true,selDecorKey:null,placeFlip:0,
 curTank:{def:{w:20,h:10},slugs:[],decor:[]},FLIP_NAME:['normal','mirror']};
vm.createContext(ctx);vm.runInContext(read('js/driftwood-decor-defs.js'),ctx);
vm.runInContext('var TANK_DECOR=SPRITE_DECOR_DEFS;',ctx);
vm.runInContext(read('js/sprite-decor-runtime.js'),ctx);
const tank=read('js/tank-view.js');
vm.runInContext(tank.slice(tank.indexOf('function decorFitsTankWalls('),tank.indexOf('function canPlaceDecor(')),ctx);
vm.runInContext(tank.slice(tank.indexOf('function nextFlip('),tank.indexOf("window.addEventListener('keydown', e=>",tank.indexOf('function nextFlip('))),ctx);
const api=vm.runInContext('SpriteDecor',ctx),key='sprite_driftwood',obj={key,fx:10,fy:5,flip:0};
ctx.curTank.decor=[obj];ctx.selDecor=obj;
for(let r=0;r<4;r++){
 const f=api.frame(key,r),b=api.bounds(key,10,5,r);
 assert.equal((b.right-b.left)*5,r%2?5:20);assert.equal((b.bottom-b.top)*5,r%2?20:5);
 assert.equal(api.cellSet(key,10,5,r,'place').size,16);
 assert.equal(api.cellSet(key,10,5,r,'place'),api.cellSet(key,10,5,r,'place'));
 assert.equal(ctx.decorPlaceIssue(key,10,5,r,obj),'');assert.ok(fs.existsSync(path.join(root,f.src)));
 ctx.flipDecor();assert.equal(obj.flip,(r+1)%4);
}
assert.equal(saves,4);assert.equal(JSON.parse(lastSave)[0].flip,0);
obj.fy=.5;const before=saves;ctx.flipDecor();assert.equal(obj.flip,0);assert.equal(saves,before);
obj.fy=5;ctx.curTank.decor.push({key,fx:10,fy:6,flip:0});ctx.flipDecor();assert.equal(obj.flip,0);
ctx.curTank.decor.pop();ctx.selDecorKey=key;ctx.flipDecor();assert.equal(ctx.placeFlip,1);assert.equal(obj.flip,0);assert.equal(saves,before);
const canvas={canvas:{width:1000,height:800},save(){},restore(){},drawImage(){draws++;}};
for(let r=0;r<4;r++){
 const b=api.draw(canvas,key,r,{x:500,y:400},8,1);
 assert.ok(b.w>0&&b.h>0);const f=api.frame(key,r);
 assert.ok(Math.abs(b.x+b.w*f.anchor.x-500)<1e-9);
 assert.ok(Math.abs(b.y+b.h*f.anchor.y-400)<1e-9);
}
assert.equal(loads,4);assert.equal(draws,4);
for(let i=0;i<100;i++)api.draw(canvas,key,i%4,{x:450+i,y:400},4+i/50,1);
assert.equal(loads,4);const count=draws;
api.draw(canvas,key,0,{x:-1000,y:400},8,1);assert.equal(draws,count);
ctx.document.hidden=true;api.draw(canvas,key,0,{x:500,y:400},8,1);assert.equal(draws,count);
ctx.document.hidden=false;api.draw(canvas,key,0,{x:500,y:400},8,1,false,false);assert.equal(draws,count);
console.log('PASS: four rotations, 20x5/5x20 footprints, 16 collision cells, boundary/overlap rejection, preview isolation, immediate rotation save, stable anchors, image/cache reuse, offscreen/hidden/inactive culling.');
