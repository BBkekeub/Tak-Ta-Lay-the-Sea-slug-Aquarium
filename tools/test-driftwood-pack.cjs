const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const runtime=process.env.CODEX_NODE_MODULES||'C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {PNG}=require(path.join(runtime,'pngjs'));
const complex=process.argv.includes('--complex'),packDir=complex?'complex-v1':'variants-v1',defsFile=complex?'driftwood-complex-defs.js':'driftwood-variants-defs.js';
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/decor/driftwood',packDir),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'))),hashes=new Set(),pictures=new Set();
assert.equal(manifest.length,5);
const html=read('index.html');assert.ok(html.includes('js/'+defsFile));assert.ok(html.indexOf('js/'+defsFile)<html.indexOf('js/config.js'));
let loads=0,draws=0,saves=0,lastSave;
const ctx={console,document:{hidden:false,addEventListener(){}},window:{},DCELL:.5,CM_PER_CELL:5,
 Image:class{set src(v){assert.ok(fs.existsSync(path.join(root,v.split('?')[0])));loads++;this.onload();}},
 drawDecorAt(){},flipOptions(){return[0,1];},decorCellSet(){return new Set();},decorSolidSet(){return new Set();},decorFootprint(){return new Set();},decorRequiredBounds(){},isBreeder(){return false;},
 nudgeSlugsOutOfSolid(){},syncDecorBar(){},toast(){},saveGame(){saves++;lastSave=JSON.stringify(ctx.curTank.decor);},
 tankBuildMode:true,selDecorKey:null,placeFlip:0,curTank:{def:{w:30,h:20},slugs:[],decor:[]},FLIP_NAME:['normal','mirror']};
vm.createContext(ctx);vm.runInContext(read('js/driftwood-decor-defs.js'),ctx);vm.runInContext(read('js/'+defsFile),ctx);
vm.runInContext('var TANK_DECOR=SPRITE_DECOR_DEFS;',ctx);vm.runInContext(read('js/sprite-decor-runtime.js'),ctx);
const tank=read('js/tank-view.js');vm.runInContext(tank.slice(tank.indexOf('function decorFitsTankWalls('),tank.indexOf('function canPlaceDecor(')),ctx);
vm.runInContext(tank.slice(tank.indexOf('function nextFlip('),tank.indexOf("window.addEventListener('keydown', e=>",tank.indexOf('function nextFlip('))),ctx);
const api=vm.runInContext('SpriteDecor',ctx),canvas={canvas:{width:1600,height:1200},save(){},restore(){},drawImage(){draws++;}};
let pngCount=0,totalBytes=0,decodedBytes=0;
for(const item of manifest){
 const report=JSON.parse(fs.readFileSync(path.join(out,item.report))),key='sprite_driftwood_'+item.id,def=ctx.SPRITE_DECOR_DEFS[key];
 assert.ok(def&&!def.model);assert.equal(def.frames.length,4);assert.equal(def.shopFrames.length,4);assert.equal(report.pixelsPerCm,32);
 assert.equal(hashes.has(report.geometryHash),false,'Duplicate geometry');hashes.add(report.geometryHash);
 for(const frames of [report.frames,report.shopFrames]){
  assert.deepEqual(frames[0].pixelSize,frames[2].pixelSize);assert.deepEqual(frames[1].pixelSize,frames[3].pixelSize);
  for(const f of frames){
   const bytes=fs.readFileSync(path.join(root,f.src)),png=PNG.sync.read(bytes),fingerprint=crypto.createHash('sha256').update(bytes).digest('hex');
   assert.equal(pictures.has(fingerprint),false,'Duplicate rendered view '+f.src);pictures.add(fingerprint);
   assert.equal(png.width,f.wCm*32);assert.equal(png.height,f.hCm*32);
   assert.ok(Math.abs(f.anchor.x*png.width-Math.round(f.anchor.x*png.width))<1e-8);assert.ok(Math.abs(f.anchor.y*png.height-Math.round(f.anchor.y*png.height))<1e-8);
   for(let x=0;x<png.width;x++){assert.equal(png.data[x*4+3],0);assert.equal(png.data[((png.height-1)*png.width+x)*4+3],0);}
   for(let y=0;y<png.height;y++){assert.equal(png.data[y*png.width*4+3],0);assert.equal(png.data[(y*png.width+png.width-1)*4+3],0);}
   const seen=new Uint8Array(png.width*png.height),components=[];
   for(let start=0;start<seen.length;start++){
    if(seen[start]||png.data[start*4+3]<32)continue;
    const q=[start];seen[start]=1;
    for(let head=0;head<q.length;head++){
     const i=q[head],x=i%png.width,y=Math.floor(i/png.width);
     for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=png.width||yy>=png.height)continue;
      const j=yy*png.width+xx;if(!seen[j]&&png.data[j*4+3]>=32){seen[j]=1;q.push(j);}
     }
    }components.push(q.length);
   }
   assert.equal(components.filter(n=>n>12).length,1,'Disconnected wood or moss: '+f.src);
   pngCount++;totalBytes+=bytes.length;decodedBytes+=png.width*png.height*4;
  }
 }
 const obj={key,fx:15,fy:10,flip:0};ctx.curTank.decor=[obj];ctx.selDecor=obj;
 for(let r=0;r<4;r++){
  const b=api.bounds(key,15,10,r);assert.equal((b.right-b.left)*5,item.sizeCm[r%2?1:0]);assert.equal((b.bottom-b.top)*5,item.sizeCm[r%2?0:1]);
  assert.equal(api.cellSet(key,15,10,r,'place').size,item.sizeCm[0]*item.sizeCm[1]/6.25);
  assert.equal(ctx.decorPlaceIssue(key,15,10,r,obj),'');assert.ok(ctx.decorPlaceIssue(key,0,0,r,obj));
  ctx.flipDecor();assert.equal(obj.flip,(r+1)%4);assert.equal(JSON.parse(lastSave)[0].flip,(r+1)%4);
  for(const shop of [false,true]){
   const box=api.draw(canvas,key,r,{x:800,y:600},10,1,shop),f=api.frame(key,r,shop);
   assert.ok(Math.abs(box.x+box.w*f.anchor.x-800)<1e-8);assert.ok(Math.abs(box.y+box.h*f.anchor.y-600)<1e-8);
  }
 }
 const before=saves;ctx.curTank.decor.push({key,fx:15,fy:10,flip:1});ctx.flipDecor();assert.equal(saves,before,'Overlapping rotation must not save');ctx.curTank.decor.pop();
}
assert.equal(loads,40);assert.equal(saves,20);const warmLoads=loads;
for(let i=0;i<200;i++)api.draw(canvas,'sprite_driftwood_'+manifest[i%5].id,i%4,{x:700+i,y:600},4+i/200,1);assert.equal(loads,warmLoads);
const warmDraws=draws;
for(const item of manifest){const key='sprite_driftwood_'+item.id;api.draw(canvas,key,0,{x:-4000,y:600},10,1);api.draw(canvas,key,0,{x:800,y:600},10,1,false,false);}
ctx.document.hidden=true;api.draw(canvas,'sprite_driftwood_'+manifest[0].id,0,{x:800,y:600},10,1);assert.equal(draws,warmDraws);
const result={passed:true,variants:5,pngCount,distinctMeshes:hashes.size,distinctImages:pictures.size,totalPngMiB:+(totalBytes/1048576).toFixed(2),allViewsDecodedMiB:+(decodedBytes/1048576).toFixed(2),rotationsSaved:saves,cacheLoads:loads,checks:['scale','ground anchors','transparent margins','connected silhouettes','wall/overlap rejection','rotation save','cache reuse during pan/zoom','hidden/inactive/offscreen culling']};
fs.writeFileSync(path.join(out,'test-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
