const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const runtime=process.env.CODEX_NODE_MODULES||'C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {PNG}=require(path.join(runtime,'pngjs'));
const root=path.resolve(__dirname,'..'),dir=path.join(root,'assets/decor/driftwood/consistent-v2');
const report=JSON.parse(fs.readFileSync(path.join(dir,'bake.json')));
assert.deepEqual(report.sizeCm,[20,5,6]);assert.equal(report.pixelsPerCm,32);
for(const f of [...report.frames,...report.shopFrames]){
 const p=PNG.sync.read(fs.readFileSync(path.join(root,f.src)));
 assert.equal(p.width/f.wCm,32);assert.equal(p.height/f.hCm,32);
 const seen=new Uint8Array(p.width*p.height),sizes=[];
 for(let start=0;start<seen.length;start++){
  if(seen[start]||p.data[start*4+3]<32)continue;
  const q=[start];seen[start]=1;
  for(let head=0;head<q.length;head++){
   const i=q[head],x=i%p.width,y=Math.floor(i/p.width);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,yy=y+dy;if(xx<0||xx>=p.width||yy<0||yy>=p.height)continue;
    const j=yy*p.width+xx;if(!seen[j]&&p.data[j*4+3]>=32){seen[j]=1;q.push(j);}
   }
  }sizes.push(q.length);
 }
 assert.equal(sizes.filter(n=>n>8).length,1,'Foreign fragment: '+f.src);
 for(let x=0;x<p.width;x++){assert.equal(p.data[x*4+3],0);assert.equal(p.data[((p.height-1)*p.width+x)*4+3],0);}
 for(let y=0;y<p.height;y++){assert.equal(p.data[(y*p.width)*4+3],0);assert.equal(p.data[(y*p.width+p.width-1)*4+3],0);}
}
assert.deepEqual(report.frames[0].pixelSize,report.frames[2].pixelSize);
assert.deepEqual(report.frames[1].pixelSize,report.frames[3].pixelSize);
console.log('PASS: all 8 PNGs use exactly 32 px/cm, paired projected bounds match, transparent padding is intact, one connected log per image, no neighbouring fragments.');
