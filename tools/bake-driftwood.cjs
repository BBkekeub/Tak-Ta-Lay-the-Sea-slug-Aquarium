// Offline only. One fixed, textured mesh -> four tank and four shop PNGs.
// No per-view stretching, AI geometry, live mesh, or sprite-sheet cropping.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const runtime=process.env.CODEX_NODE_MODULES||'C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sharp=require(path.join(runtime,'sharp'));
const root=path.resolve(__dirname,'..'),dir=path.join(root,'assets/decor/driftwood/consistent-v2');
const TAU=Math.PI*2,NX=160,NT=128,SCALE=32,AA=2,PAD=4;
const vertices=[],faces=[];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
function surface(u,t){
 const left=-10+2.7*Math.pow((Math.sin(t)+1)/2,9)+.18*Math.sin(7*t);
 const right=10-.25*(1+Math.sin(5*t+.3));
 const x=left+(right-left)*u;
 const profile=.86+.085*Math.sin(u*7+.4)+.04*Math.cos(u*15);
 const grain=1+.027*Math.sin(13*t+u*2)+.017*Math.sin(29*t+Math.sin(u*8))+.009*Math.cos(53*t+u*4);
 const knot=.13*Math.exp(-Math.pow((u-.64)/.065,2)-Math.pow(Math.atan2(Math.sin(t-4.1),Math.cos(t-4.1))/.36,2));
 const r=profile*grain+knot;
 return [x,2.5*r*Math.cos(t)+.13*Math.sin(u*9),3+3*r*Math.sin(t)+.22*Math.sin(u*7)];
}
for(let i=0;i<=NX;i++)for(let j=0;j<=NT;j++){
 const u=i/NX,t=j/NT*TAU,p=surface(u,t),du=sub(surface(u+.0001,t),surface(u-.0001,t)),dt=sub(surface(u,t+.0001),surface(u,t-.0001));
 vertices.push({p,n:norm(cross(dt,du)),uv:[u,j/NT],material:0});
}
for(let i=0;i<NX;i++)for(let j=0;j<NT;j++){
 const a=i*(NT+1)+j,b=a+1,c=a+NT+1,d=c+1;faces.push([a,b,c],[b,d,c]);
}
// Recessed, ragged broken end and a solid opposite end. End faces share the rim.
for(let end=0;end<2;end++){
 const base=vertices.length,ringCount=18;
 for(let k=0;k<=ringCount;k++)for(let j=0;j<=NT;j++){
  const r=k/ringCount,t=j/NT*TAU,rim=surface(end,t),center=[end?9.2:-7.1,0,3];
  const p=rim.map((v,a)=>center[a]+(v-center[a])*r);
  p[0]+=.035*Math.sin(12*r+3*t)*r*(1-r);
  vertices.push({p,n:[end?1:-1,0,0],uv:[.5+.5*r*Math.cos(t),.5+.5*r*Math.sin(t)],material:end?2:1});
 }
 for(let k=0;k<ringCount;k++)for(let j=0;j<NT;j++){
  const a=base+k*(NT+1)+j,b=a+1,c=a+NT+1,d=c+1;faces.push([a,c,b],[b,c,d]);
 }
}
// Normalize ONCE in object coordinates, never independently in screen space.
const min=[0,1,2].map(a=>Math.min(...vertices.map(v=>v.p[a]))),max=[0,1,2].map(a=>Math.max(...vertices.map(v=>v.p[a])));
const factors=[20,5,6].map((s,a)=>s/(max[a]-min[a]));
for(const v of vertices){v.p=v.p.map((x,a)=>(x-min[a])*factors[a]-(a===0?10:a===1?2.5:0));v.n=norm(v.n.map((x,a)=>x/factors[a]));}
const woodGeometryHash=crypto.createHash('sha256').update(JSON.stringify({vertices,faces})).digest('hex');
const woodVertexCount=vertices.length,woodTriangleCount=faces.length;
// Moss is real object-space foliage during OFFLINE baking. Its leaves grow up,
// rather than following the log's UV stretch. The game still loads only PNGs.
let seed=9027;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const colonies=[[.10,.245,.105,.080],[.35,.262,.105,.075],[.59,.23,.115,.085],[.855,.26,.12,.08]];
function mossCoverage(u,v){
 let cover=0;
 for(const [cu,cv,ru,rv] of colonies){
  const x=(u-cu)/ru,y=(v-cv)/rv;
  const edge=1-x*x-y*y+.13*Math.sin(u*173+v*49)+.09*Math.sin(v*193-u*67);
  cover=Math.max(cover,edge);
 }return clamp(cover,0,1);
}
function mossRoot(u,v){
 return surface(u,v*TAU).map((x,a)=>(x-min[a])*factors[a]-(a===0?10:a===1?2.5:0));
}
function foliageVertex(p,col,n=[0,0,1]){
 const i=vertices.length;vertices.push({p,n,uv:[0,0],material:3,col});return i;
}
function addMoss(){
 let tufts=0;
 // Small domed cushions anchor every leaf into the wood; no floating billboards.
 const nu=180,nv=36,grid=[];
 for(let i=0;i<=nu;i++){
  grid[i]=[];
  for(let j=0;j<=nv;j++){
   const u=.018+i/nu*.964,v=.13+j/nv*.24,c=mossCoverage(u,v),p=mossRoot(u,v);
   p[2]+=.28*Math.sqrt(c)-.035;
   const tone=.5+.5*Math.sin(u*79+v*40)*Math.sin(v*127-u*29);
   grid[i][j]={id:foliageVertex(p,[62+tone*23,78+tone*27,35+tone*12]),c};
  }
 }
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){
  const cell=[grid[i][j],grid[i+1][j],grid[i][j+1],grid[i+1][j+1]];
  if(cell.every(v=>v.c>.015))faces.push([cell[0].id,cell[1].id,cell[2].id],[cell[1].id,cell[3].id,cell[2].id]);
 }
 // Deterministic tufts share positions in every rotation. Blades have thickness
 // in their folded cross-section, a curved tip, and several radial directions.
 for(let i=0;i<128;i++)for(let j=0;j<24;j++){
  const u=.025+(i+random())/128*.95,v=.135+(j+random())/24*.23,c=mossCoverage(u,v);
  if(c<.04||random()>.82)continue;
  const root=mossRoot(u,v),cushion=.28*Math.sqrt(c),h=(.37+random()*.43)*(.65+.35*Math.sqrt(c));
  const hue=random(),color=[87+hue*36,111+hue*35,43+hue*19];
  const count=5+Math.floor(random()*3),offset=random()*TAU;tufts++;
  for(let k=0;k<count;k++){
   const angle=offset+k/count*TAU+(random()-.5)*.4,dx=Math.cos(angle),dy=Math.sin(angle);
   const length=h*(.6+random()*.5),lean=.12+random()*.23,width=.04+random()*.035;
   const rows=[];
   for(let s=0;s<4;s++){
    const t=s/3,bend=lean*t*t,w=width*Math.sin(Math.PI*(.08+.92*t));
    const p=[root[0]+dx*bend,root[1]+dy*bend,root[2]+cushion*.55+length*t-.035];
    const tone=.62+.42*t;
    const col=color.map(a=>a*tone),n=norm([dx*.2,dy*.2,1]);
    rows.push([
     foliageVertex([p[0]-dy*w,p[1]+dx*w,p[2]],col,n),
     foliageVertex([p[0],p[1],p[2]+w*.45],col.map(a=>a*1.06),n),
     foliageVertex([p[0]+dy*w,p[1]-dx*w,p[2]],col.map(a=>a*.94),n)
    ]);
   }
   for(let s=0;s<3;s++)for(let side=0;side<2;side++){
    faces.push([rows[s][side],rows[s+1][side],rows[s][side+1]],
     [rows[s][side+1],rows[s+1][side],rows[s+1][side+1]]);
   }
  }
 }
 return tufts;
}
const mossTufts=addMoss();
const visualHeight=Math.ceil(vertices.reduce((m,v)=>Math.max(m,v.p[2]),6)*10)/10;
const rotate=(v,r)=>r===0?v.slice():r===1?[-v[1],v[0],v[2]]:r===2?[-v[0],-v[1],v[2]]:[v[1],-v[0],v[2]];
const project=(p,shop)=>shop?[p[0]+p[1],.5*p[0]-.5*p[1]-p[2]]:[p[0]+.475*p[1],-.525*p[1]-.75*p[2]];
const depth=(p,shop)=>shop?p[0]-p[1]+p[2]:.475*p[0]-p[1]+.7*p[2];
let tex,endTex;
function sampleTexture(map,u,v){
 const xx=clamp(u,0,1)*(map.info.width-1),yy=clamp(v,0,1)*(map.info.height-1);
 const x=Math.floor(xx),y=Math.floor(yy),fx=xx-x,fy=yy-y,c=[];
 for(let a=0;a<3;a++){
  const at=(ix,iy)=>map.data[(Math.min(iy,map.info.height-1)*map.info.width+Math.min(ix,map.info.width-1))*3+a];
  c.push((at(x,y)*(1-fx)+at(x+1,y)*fx)*(1-fy)+(at(x,y+1)*(1-fx)+at(x+1,y+1)*fx)*fy);
 }return c;
}
function texture(u,v,material){
 // Painted end grain matches the side's brushwork. Both ends use planar UVs;
 // growth rings and drying cracks are never stretched around the cylinder.
 if(material)return sampleTexture(endTex,u,v).map(c=>c*(material===1?.96:1));
 return sampleTexture(tex,u,((v%1+1)%1));
}
async function bake(r,shop){
 const p=vertices.map(v=>rotate(v.p,r)),n=vertices.map(v=>rotate(v.n,r)),q=p.map(v=>project(v,shop));
 // Bounds are from the SAME world-space box projected with the same scale.
 const box=[];for(const x of [-10,10])for(const y of [-2.5,2.5])for(const z of [0,visualHeight])box.push(project(rotate([x,y,z],r),shop));
 const left=Math.floor(Math.min(...box.map(v=>v[0]))*SCALE)-PAD,top=Math.floor(Math.min(...box.map(v=>v[1]))*SCALE)-PAD;
 const width=Math.ceil(Math.max(...box.map(v=>v[0]))*SCALE)+PAD-left,height=Math.ceil(Math.max(...box.map(v=>v[1]))*SCALE)+PAD-top;
 const w=width*AA,h=height*AA,zbuf=new Float32Array(w*h).fill(-Infinity),rgba=Buffer.alloc(w*h*4);
 const screen=q.map(v=>[(v[0]*SCALE-left)*AA,(v[1]*SCALE-top)*AA]);
 const light=norm(shop?[-.35,-.5,1]:[-.4,-.7,1]);
 for(const ids of faces){
  const [a,b,c]=ids,s=ids.map(i=>screen[i]);
  const den=(s[1][1]-s[2][1])*(s[0][0]-s[2][0])+(s[2][0]-s[1][0])*(s[0][1]-s[2][1]);if(Math.abs(den)<1e-8)continue;
  const x0=Math.max(0,Math.floor(Math.min(...s.map(v=>v[0])))),x1=Math.min(w-1,Math.ceil(Math.max(...s.map(v=>v[0]))));
  const y0=Math.max(0,Math.floor(Math.min(...s.map(v=>v[1])))),y1=Math.min(h-1,Math.ceil(Math.max(...s.map(v=>v[1]))));
  const depths=ids.map(i=>depth(p[i],shop)),vs=ids.map(i=>vertices[i]);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const px=x+.5,py=y+.5,A=((s[1][1]-s[2][1])*(px-s[2][0])+(s[2][0]-s[1][0])*(py-s[2][1]))/den;
   const B=((s[2][1]-s[0][1])*(px-s[2][0])+(s[0][0]-s[2][0])*(py-s[2][1]))/den,C=1-A-B;
   if(A<-.00001||B<-.00001||C<-.00001)continue;
   const idx=y*w+x,z=A*depths[0]+B*depths[1]+C*depths[2];if(z<=zbuf[idx])continue;zbuf[idx]=z;
   const uv=[0,1].map(k=>A*vs[0].uv[k]+B*vs[1].uv[k]+C*vs[2].uv[k]);
   const normal=norm([0,1,2].map(k=>A*n[a][k]+B*n[b][k]+C*n[c][k]));
   const shade=.82+.22*Math.max(0,normal.reduce((s,v,k)=>s+v*light[k],0));
   const col=vs[0].material===3?[0,1,2].map(k=>A*vs[0].col[k]+B*vs[1].col[k]+C*vs[2].col[k]):texture(...uv,vs[0].material),base=idx*4;
   for(let k=0;k<3;k++)rgba[base+k]=clamp(Math.round(col[k]*shade),0,255);rgba[base+3]=255;
  }
 }
 const file=`${shop?'shop':'tank'}-${r*90}.png`;
 await sharp(rgba,{raw:{width:w,height:h,channels:4}}).resize(width,height).png().toFile(path.join(dir,file));
 return {src:'assets/decor/driftwood/consistent-v2/'+file,wCm:width/SCALE,hCm:height/SCALE,anchor:{x:-left/width,y:-top/height},pixelSize:[width,height],projection:shop?'shop':'tank'};
}
(async()=>{
 fs.mkdirSync(path.join(dir,'thumbs'),{recursive:true});
 const textureFile=path.join(dir,'wood-color.png');if(process.argv[2])fs.copyFileSync(process.argv[2],textureFile);
 tex=await sharp(textureFile).removeAlpha().raw().toBuffer({resolveWithObject:true});
 endTex=await sharp(path.join(dir,'wood-end-color.png')).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const frames=[],shopFrames=[];for(let r=0;r<4;r++){frames.push(await bake(r,false));shopFrames.push(await bake(r,true));console.log('Baked rotation '+r*90);}
 await sharp(path.join(dir,'tank-0.png')).resize(264,130,{fit:'inside'}).png().toFile(path.join(dir,'thumbs/tank-0.png'));
 const geometryHash=crypto.createHash('sha256').update(JSON.stringify({vertices,faces})).digest('hex');
 const report={sizeCm:[20,5,6],visualHeightCm:visualHeight,pixelsPerCm:SCALE,woodGeometryHash,geometryHash,woodVertices:woodVertexCount,woodTriangles:woodTriangleCount,mossTufts,vertices:vertices.length,triangles:faces.length,frames,shopFrames};
 fs.writeFileSync(path.join(dir,'bake.json'),JSON.stringify(report,null,2));
 fs.writeFileSync(path.join(root,'js/driftwood-decor-defs.js'),`// Generated by tools/bake-driftwood.cjs. One mesh, fixed projection and scale.\nvar SPRITE_DECOR_DEFS=typeof SPRITE_DECOR_DEFS==='object'&&SPRITE_DECOR_DEFS?SPRITE_DECOR_DEFS:{};\n(()=>{\n const frames=${JSON.stringify(frames)};\n const shopFrames=${JSON.stringify(shopFrames)};\n frames.forEach((f,i)=>{const w=i%2?1:4,h=i%2?4:1,place=[];for(let x=-w/2;x<w/2;x+=.5)for(let y=-h/2;y<h/2;y+=.5)place.push([x,y]);Object.assign(f,{place,solid:place,front:[],behind:[]});});\n SPRITE_DECOR_DEFS.sprite_driftwood={name:'ขอนไม้',cat:'ขอนไม้ · 4 มุม',sizeCm:[20,5,6],priceCm:20,cell:.5,flips:'rotate',sprite:true,shopRotationSign:-1,frames,shopFrames,...frames[0]};\n})();\n`);
 console.log('One geometry hash for all eight images: '+geometryHash);
})();
