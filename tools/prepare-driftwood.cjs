// Isolate each connected sprite BEFORE cropping: neighbouring views overlap crop rectangles.
const fs=require('node:fs'),path=require('node:path');
const runtime=process.env.CODEX_NODE_MODULES || 'C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sharp=require(path.join(runtime,'sharp'));
const root=path.resolve(__dirname,'..'),dir=path.join(root,'assets/decor/driftwood');
const crops=[
 {left:25,top:252,width:735,height:200},
 {left:739,top:110,width:486,height:521},
 {left:29,top:821,width:741,height:175},
 {left:763,top:678,width:478,height:503}
];
function components(data,width,height){
 const labels=new Int32Array(width*height),queue=new Int32Array(width*height);
 let label=0;
 for(let start=0;start<labels.length;start++){
  if(labels[start]||!data[start*4+3])continue;
  label++;let head=0,tail=1;queue[0]=start;labels[start]=label;
  while(head<tail){
   const p=queue[head++],x=p%width,y=Math.floor(p/width);
   // Eight neighbours preserve diagonal antialiased edges and narrow splinters.
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,yy=y+dy;if(xx<0||xx>=width||yy<0||yy>=height)continue;
    const n=yy*width+xx;
    if(!labels[n]&&data[n*4+3]){labels[n]=label;queue[tail++]=n;}
   }
  }
 }
 return labels;
}
(async()=>{
 fs.mkdirSync(path.join(dir,'thumbs'),{recursive:true});
 const source=process.argv[2];if(!source)throw Error('Pass the generated four-view PNG path');
 const sheet=path.join(dir,'source-sheet.png');
 if(path.resolve(source)!==path.resolve(sheet))fs.copyFileSync(source,sheet);
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const labels=components(data,info.width,info.height),selected=new Set();
 for(let i=0;i<4;i++){
  const c=crops[i],counts=new Map();
  for(let y=c.top;y<c.top+c.height;y++)for(let x=c.left;x<c.left+c.width;x++){
   const label=labels[y*info.width+x];if(label)counts.set(label,(counts.get(label)||0)+1);
  }
  const target=[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0];
  if(!target||selected.has(target))throw Error('Could not identify four distinct log sprites');
  selected.add(target);
  const isolated=Buffer.alloc(c.width*c.height*4);let removed=0;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
   const p=(y+c.top)*info.width+x+c.left,label=labels[p];
   if(label===target)data.copy(isolated,(y*c.width+x)*4,p*4,p*4+4);
   else if(label)removed++;
  }
  await sharp(isolated,{raw:{width:c.width,height:c.height,channels:4}}).png().toFile(path.join(dir,`view-${i*90}.png`));
  console.log(`View ${i*90}: removed ${removed} neighbouring-view pixels; canvas and retained RGBA unchanged.`);
 }
 await sharp(path.join(dir,'view-0.png')).resize(264,130,{fit:'inside'}).png().toFile(path.join(dir,'thumbs/view-0.png'));
 console.log('Packaged four original views and palette thumbnail in '+dir);
})();
