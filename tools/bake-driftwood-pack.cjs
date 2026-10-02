// Offline authoring only: five distinct meshes, shared approved painted materials.
// Run: node tools/bake-driftwood-pack.cjs [--complex] [optional recipe id]
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const runtime=process.env.CODEX_NODE_MODULES||'C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sharp=require(path.join(runtime,'sharp'));
const complex=process.argv.includes('--complex'),packDir=complex?'complex-v1':'variants-v1';
const defsFile=complex?'driftwood-complex-defs.js':'driftwood-variants-defs.js';
const selectedId=process.argv.slice(2).find(a=>!a.startsWith('--'));
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/decor/driftwood',packDir);
const SCALE=32,AA=2,PAD=5,TAU=2*Math.PI;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const norm=a=>mul(a,1/(Math.hypot(...a)||1));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rotate=(v,r)=>r===0?v.slice():r===1?[-v[1],v[0],v[2]]:r===2?[-v[0],-v[1],v[2]]:[v[1],-v[0],v[2]];
const project=(p,shop)=>shop?[p[0]+p[1],.5*p[0]-.5*p[1]-p[2]]:[p[0]+.475*p[1],-.525*p[1]-.75*p[2]];
const depth=(p,shop)=>shop?p[0]-p[1]+p[2]:.475*p[0]-p[1]+.7*p[2];
// Each point is [x,y,z,radius]. All dimensions are fixed once, before moss/baking.
const basicRecipes=[
 {id:'crescent',name:'ขอนไม้โค้ง',size:[22.5,10,6],seed:173,parts:[
  {points:[[-9,-1,2,1.9],[-5,1.4,2.1,2.2],[0,3,2.35,2.1],[5,1.4,2.05,1.8],[9,-1.5,1.8,1.45]],moss:[[.17,.11],[.43,.12],[.73,.13]]}]},
 {id:'fork',name:'ขอนไม้แยกง่าม',size:[22.5,15,7],seed:251,parts:[
  {points:[[-10,-2,2.1,2.4],[-5,-1.5,2.1,2.25],[-.5,0,2.4,1.95],[4,2.6,2.5,1.5],[9,5.2,2.4,1.05]],moss:[[.16,.12],[.41,.1],[.79,.14]]},
  {points:[[-2,-.6,2.3,1.9],[1,-1.8,2.1,1.65],[4.7,-4.7,1.8,1.25],[8.3,-6.3,1.65,.88]],moss:[[.53,.14]],openStart:true}]},
 {id:'hollow',name:'ขอนไม้กลวง',size:[15,10,9],seed:359,parts:[
  {points:[[-6,0,3.2,3.2],[-2,.2,3.35,3.35],[2,-.1,3.15,3.15],[6,.2,2.9,2.9]],hollow:.66,moss:[[.18,.13],[.52,.17],[.84,.09]]}]},
 {id:'arch',name:'ขอนไม้ซุ้ม',size:[25,7.5,11],seed:463,parts:[
  {points:[[-10,0,1.7,1.8],[-7,.3,4,1.7],[-3,.6,6.5,1.5],[1,.5,7,1.45],[5,0,5.3,1.65],[10,-.2,1.6,1.8]],moss:[[.22,.11],[.53,.14],[.81,.1]]}]},
 {id:'branch',name:'ขอนไม้กิ่งข้าง',size:[22.5,12.5,8],seed:577,parts:[
  {points:[[-10,0,2,2.05],[-5,.4,2.2,2.15],[0,.3,2.35,1.9],[5,-.6,2.5,1.75],[10,-1.4,2.2,1.3]],moss:[[.16,.1],[.5,.11],[.79,.1]]},
  {points:[[-2,.2,2.3,1.7],[0,2.1,2.8,1.5],[2,4.4,3.45,1.05],[3.3,6.2,4.2,.65]],moss:[[.57,.18]],openStart:true},
  {points:[[3,-.5,2.4,1.3],[4.4,-2.2,2.8,.95],[5.3,-3.4,3.4,.6]],moss:[],openStart:true}]}
];
const recipes=complex?require('./driftwood-complex-recipes.cjs'):basicRecipes;
function curve(points,u){
 const s=clamp(u)*(points.length-1),i=Math.min(points.length-2,Math.floor(s)),t=s-i;
 const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
 return b.map((_,k)=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t));
}
function basis(part,u){
 const p=curve(part.points,u),t=norm(sub(curve(part.points,u+.0001).slice(0,3),curve(part.points,u-.0001).slice(0,3)));
 const side=norm([-t[1],t[0],0]),up=norm(cross(t,side));return{p,t,side,up};
}
function skin(part,u,a,inner=false){
 const {p,t,side,up}=basis(part,u);
 const irregular=part.weathered?1+.07*Math.sin(u*13+part.phase)+.055*Math.cos(3*a+u*5+part.phase)+.04*Math.cos(2*a-u*4):1;
 const grain=(1+.032*Math.sin(11*a+u*4)+.018*Math.sin(23*a-u*3))*irregular;
 // A broad, smoothly fading collar seats the limb into its parent trunk.
 // The outer root blends along the first part of the branch instead of
 // keeping the same narrow tube diameter right up to the intersection.
 const collar=part.branchCollar?1+.32*Math.pow(Math.max(0,1-u/.55),2):1;
 const radius=p[3]*(inner?part.hollow*(1+.015*Math.sin(9*a+u*5)):grain*collar);
 const ragged=(Math.exp(-u*38)-Math.exp(-(1-u)*38))*(.12*Math.sin(5*a)+.08*Math.cos(9*a)+(part.weathered?.28*Math.cos(a+part.phase)+.13*Math.sin(3*a+part.phase):0));
 return add(add(add(p.slice(0,3),mul(side,radius*Math.cos(a))),mul(up,radius*Math.sin(a))),mul(t,ragged));
}
function build(recipe){
 const vertices=[],faces=[],parts=recipe.parts;
 const vertex=(p,n,uv,material,col)=>{const id=vertices.length;vertices.push({p,n,uv,material,...(col?{col}:{})});return id;};
 for(const part of parts){
  const nx=Math.max(36,(part.points.length-1)*25),nt=80;
  for(const inner of part.hollow?[false,true]:[false]){
   const base=vertices.length;
   for(let i=0;i<=nx;i++)for(let j=0;j<=nt;j++){
    const u=i/nx,a=j/nt*TAU,p=skin(part,u,a,inner);
    const du=sub(skin(part,clamp(u+.0001),a,inner),skin(part,clamp(u-.0001),a,inner));
    const da=sub(skin(part,u,a+.0001,inner),skin(part,u,a-.0001,inner));
    const n=mul(norm(cross(da,du)),inner?-1:1);
    vertex(p,n,[u,j/nt],inner?4:0);
   }
   for(let i=0;i<nx;i++)for(let j=0;j<nt;j++){
    const a=base+i*(nt+1)+j,b=a+1,c=a+nt+1,d=c+1;faces.push([a,b,c],[b,d,c]);
   }
  }
  for(let end=0;end<2;end++){
   if((end===0&&part.openStart)||(end===1&&part.openEnd))continue;
   const base=vertices.length,nr=12,{p,t}=basis(part,end);
   for(let k=0;k<=nr;k++)for(let j=0;j<=nt;j++){
    const a=j/nt*TAU,r=(part.hollow||0)+(1-(part.hollow||0))*k/nr;
    const rim=skin(part,end,a),pos=add(p.slice(0,3),mul(sub(rim,p.slice(0,3)),r));
    vertex(pos,mul(t,end?1:-1),[.5+.5*r*Math.cos(a),.5+.5*r*Math.sin(a)],1);
   }
   for(let k=0;k<nr;k++)for(let j=0;j<nt;j++){
    const a=base+k*(nt+1)+j,b=a+1,c=a+nt+1,d=c+1;faces.push([a,c,b],[b,c,d]);
   }
  }
 }
 const min=[0,1,2].map(k=>vertices.reduce((m,v)=>Math.min(m,v.p[k]),Infinity));
 const max=[0,1,2].map(k=>vertices.reduce((m,v)=>Math.max(m,v.p[k]),-Infinity));
 const fit=recipe.size.map((x,k)=>x/(max[k]-min[k]));
 const factors=recipe.preserveProportions?fit.map(()=>Math.min(...fit)):fit;
 const transform=p=>p.map((x,k)=>(x-(k<2?(min[k]+max[k])/2:min[k]))*factors[k]);
 for(const v of vertices){v.p=transform(v.p);v.n=norm(v.n.map((x,k)=>x/factors[k]));}
 const woodGeometryHash=hash({vertices,faces}),woodVertices=vertices.length,woodTriangles=faces.length;
 let seed=recipe.seed,tufts=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const coverage=(part,u,v)=>{
  let c=0;for(const [cu,ru] of part.moss){const x=(u-cu)/ru,y=(v-.25)/.082;c=Math.max(c,1-x*x-y*y+.1*Math.sin(u*153+v*87));}return clamp(c);
 };
 const mossVertex=(p,c)=>vertex(p,[0,0,1],[0,0],3,c);
 for(const part of parts){
  if(!part.moss.length)continue;
  const nu=100,nv=24,grid=[];
  for(let i=0;i<=nu;i++){
   grid[i]=[];
   for(let j=0;j<=nv;j++){
    const u=.02+.96*i/nu,v=.14+.22*j/nv,c=coverage(part,u,v),p=transform(skin(part,u,v*TAU));
    p[2]+=.22*Math.sqrt(c)-.035;
    const tone=.5+.5*Math.sin(u*79+v*40)*Math.sin(v*127-u*29);
    grid[i][j]={c,id:mossVertex(p,[62+tone*23,78+tone*27,35+tone*12])};
   }
  }
  for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){
   const a=grid[i][j],b=grid[i+1][j],c=grid[i][j+1],d=grid[i+1][j+1];
   if([a,b,c,d].every(v=>v.c>.025))faces.push([a.id,b.id,c.id],[b.id,d.id,c.id]);
  }
  const steps=Math.max(35,(part.points.length-1)*22);
  for(let i=0;i<steps;i++)for(let j=0;j<19;j++){
   const u=.025+.95*(i+random())/steps,v=.14+.22*(j+random())/19,c=coverage(part,u,v);
   if(c<.055||random()>.86)continue;
   const base=transform(skin(part,u,v*TAU)),height=(.3+random()*.4)*(.65+.35*Math.sqrt(c));
   const hue=random(),color=[87+hue*36,111+hue*35,43+hue*19],offset=random()*TAU,count=5;tufts++;
   for(let leaf=0;leaf<count;leaf++){
    const angle=offset+leaf/count*TAU,dx=Math.cos(angle),dy=Math.sin(angle),length=height*(.65+random()*.4),lean=.12+random()*.19,width=.04+random()*.03,rows=[];
    for(let s=0;s<4;s++){
     const t=s/3,bend=lean*t*t,w=width*Math.sin(Math.PI*(.08+.92*t)),p=[base[0]+dx*bend,base[1]+dy*bend,base[2]+.12*Math.sqrt(c)+length*t-.035];
     const col=color.map(a=>a*(.62+.42*t));
     rows.push([mossVertex([p[0]-dy*w,p[1]+dx*w,p[2]],col),mossVertex([p[0],p[1],p[2]+w*.45],col.map(x=>x*1.06)),mossVertex([p[0]+dy*w,p[1]-dx*w,p[2]],col.map(x=>x*.94))]);
    }
    for(let s=0;s<3;s++)for(let k=0;k<2;k++)faces.push([rows[s][k],rows[s+1][k],rows[s][k+1]],[rows[s][k+1],rows[s+1][k],rows[s+1][k+1]]);
   }
  }
 }
 const extent=[0,1].map(k=>Math.ceil(vertices.reduce((m,v)=>Math.max(m,Math.abs(v.p[k])),recipe.size[k]/2)*10)/10);
 const visualHeight=Math.ceil(vertices.reduce((m,v)=>Math.max(m,v.p[2]),recipe.size[2])*10)/10;
 return{vertices,faces,woodGeometryHash,geometryHash:hash({vertices,faces}),woodVertices,woodTriangles,mossTufts:tufts,extent,visualHeight};
}
function sample(map,u,v){
 const xx=clamp(u)*(map.info.width-1),yy=clamp(v)*(map.info.height-1),x=Math.floor(xx),y=Math.floor(yy),fx=xx-x,fy=yy-y,c=[];
 for(let a=0;a<3;a++){
  const at=(ix,iy)=>map.data[(Math.min(iy,map.info.height-1)*map.info.width+Math.min(ix,map.info.width-1))*3+a];
  c.push((at(x,y)*(1-fx)+at(x+1,y)*fx)*(1-fy)+(at(x,y+1)*(1-fx)+at(x+1,y+1)*fx)*fy);
 }return c;
}
async function render(model,recipe,r,shop,maps,destination={out,packDir}){
 const {vertices,faces,extent,visualHeight}=model;
 const p=vertices.map(v=>rotate(v.p,r)),n=vertices.map(v=>rotate(v.n,r)),q=p.map(v=>project(v,shop));
 const corners=[];for(const x of [-extent[0],extent[0]])for(const y of [-extent[1],extent[1]])for(const z of [0,visualHeight])corners.push(project(rotate([x,y,z],r),shop));
 const left=Math.floor(Math.min(...corners.map(p=>p[0]))*SCALE)-PAD,top=Math.floor(Math.min(...corners.map(p=>p[1]))*SCALE)-PAD;
 const width=Math.ceil(Math.max(...corners.map(p=>p[0]))*SCALE)+PAD-left,height=Math.ceil(Math.max(...corners.map(p=>p[1]))*SCALE)+PAD-top;
 const w=width*AA,h=height*AA,rgba=Buffer.alloc(w*h*4),zbuf=new Float32Array(w*h).fill(-Infinity);
 const screen=q.map(p=>[(p[0]*SCALE-left)*AA,(p[1]*SCALE-top)*AA]),light=norm(shop?[-.35,-.5,1]:[-.4,-.7,1]);
 for(const ids of faces){
  const [a,b,c]=ids,s=ids.map(i=>screen[i]),vs=ids.map(i=>vertices[i]);
  const den=(s[1][1]-s[2][1])*(s[0][0]-s[2][0])+(s[2][0]-s[1][0])*(s[0][1]-s[2][1]);if(Math.abs(den)<1e-8)continue;
  const x0=Math.max(0,Math.floor(Math.min(...s.map(v=>v[0])))),x1=Math.min(w-1,Math.ceil(Math.max(...s.map(v=>v[0]))));
  const y0=Math.max(0,Math.floor(Math.min(...s.map(v=>v[1])))),y1=Math.min(h-1,Math.ceil(Math.max(...s.map(v=>v[1]))));
  const depths=ids.map(i=>depth(p[i],shop)),material=vs[0].material;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const px=x+.5,py=y+.5,A=((s[1][1]-s[2][1])*(px-s[2][0])+(s[2][0]-s[1][0])*(py-s[2][1]))/den;
   const B=((s[2][1]-s[0][1])*(px-s[2][0])+(s[0][0]-s[2][0])*(py-s[2][1]))/den,C=1-A-B;
   if(A<-.00001||B<-.00001||C<-.00001)continue;
   const i=y*w+x,z=A*depths[0]+B*depths[1]+C*depths[2];if(z<=zbuf[i])continue;zbuf[i]=z;
   const normal=norm([0,1,2].map(k=>A*n[a][k]+B*n[b][k]+C*n[c][k]));
   const shade=.82+.22*Math.max(0,dot(normal,light));
   let col;
   if(material===3)col=[0,1,2].map(k=>A*vs[0].col[k]+B*vs[1].col[k]+C*vs[2].col[k]);
   else{
    const uv=[0,1].map(k=>A*vs[0].uv[k]+B*vs[1].uv[k]+C*vs[2].uv[k]);
    col=sample(material===1?maps.end:maps.side,...uv);
    // Inner wall is painted wood, darkened for the occluded cavity.
    if(material===4)col=col.map(c=>c*.48);
   }
   for(let k=0;k<3;k++)rgba[i*4+k]=clamp(Math.round(col[k]*shade),0,255);rgba[i*4+3]=255;
  }
 }
 const filename=`${shop?'shop':'tank'}-${r*90}.png`,dir=path.join(destination.out,recipe.id);
 await sharp(rgba,{raw:{width:w,height:h,channels:4}}).resize(width,height).png().toFile(path.join(dir,filename));
 return{src:`assets/decor/driftwood/${destination.packDir}/${recipe.id}/${filename}`,wCm:width/SCALE,hCm:height/SCALE,anchor:{x:-left/width,y:-top/height},pixelSize:[width,height],projection:shop?'shop':'tank'};
}
function footprint(size,r){
 const w=size[r%2?1:0]/5,h=size[r%2?0:1]/5,result=[];
 for(let x=-w/2;x<w/2-1e-6;x+=.5)for(let y=-h/2;y<h/2-1e-6;y+=.5)result.push([x,y]);return result;
}
async function reviewSheets(){
 // Review-only compositing of the actual sprites; never used to make game assets.
 for(const kind of ['tank','shop']){
  const cellW=470,cellH=340,items=[];
  for(let row=0;row<recipes.length;row++)for(let r=0;r<4;r++){
   const file=path.join(out,recipes[row].id,`${kind}-${r*90}.png`);
   if(!fs.existsSync(file))return;
   const {data,info}=await sharp(file).resize({width:cellW-28,height:cellH-40,fit:'inside'}).png().toBuffer({resolveWithObject:true});
   items.push({input:data,left:r*cellW+Math.round((cellW-info.width)/2),top:row*cellH+28+Math.round((cellH-40-info.height)/2)});
  }
  const text=recipes.map((r,i)=>[0,90,180,270].map((angle,j)=>`<text x="${j*cellW+16}" y="${i*cellH+23}" font-size="17" fill="#454d38">${i+1}. ${r.id} / ${angle}°</text>`).join('')).join('');
  const svg=Buffer.from(`<svg width="${cellW*4}" height="${cellH*5}" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:Arial}</style>${text}</svg>`);
  items.push({input:svg,left:0,top:0});
  await sharp({create:{width:cellW*4,height:cellH*5,channels:4,background:'#eeeade'}}).composite(items).png().toFile(path.join(out,`review-${kind}.png`));
 }
 const cards=[];for(let i=0;i<recipes.length;i++){
  const {data,info}=await sharp(path.join(out,recipes[i].id,'shop-0.png')).resize({width:550,height:350,fit:'inside'}).png().toBuffer({resolveWithObject:true});
  cards.push({input:data,left:(i%3)*580+Math.round((580-info.width)/2),top:Math.floor(i/3)*400+35+Math.round((350-info.height)/2)});
 }
 const labels=recipes.map((r,i)=>`<text x="${i%3*580+20}" y="${Math.floor(i/3)*400+30}" fill="#47483d" font-size="22">${i+1}. ${r.id} — ${r.size.join(' × ')} cm</text>`).join('');
 cards.push({input:Buffer.from(`<svg width="1740" height="800" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:Arial}</style>${labels}</svg>`),left:0,top:0});
 await sharp({create:{width:1740,height:800,channels:4,background:'#eeeade'}}).composite(cards).png().toFile(path.join(out,'preview.png'));
}
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const input=path.join(root,'assets/decor/driftwood/consistent-v2');
 const maps={side:await sharp(path.join(input,'wood-color.png')).removeAlpha().raw().toBuffer({resolveWithObject:true}),end:await sharp(path.join(input,'wood-end-color.png')).removeAlpha().raw().toBuffer({resolveWithObject:true})};
 if(selectedId&&!recipes.some(r=>r.id===selectedId))throw new Error('Unknown recipe id');
 for(const recipe of recipes.filter(r=>!process.argv.includes('--metadata-only')&&(!selectedId||r.id===selectedId))){
  const started=Date.now(),model=build(recipe),dir=path.join(out,recipe.id);fs.mkdirSync(path.join(dir,'thumbs'),{recursive:true});
  const frames=[],shopFrames=[];
  for(let r=0;r<4;r++){
   const f=await render(model,recipe,r,false,maps),place=footprint(recipe.size,r);
   frames.push({...f,place,solid:place,front:[],behind:[]});shopFrames.push(await render(model,recipe,r,true,maps));
  }
  await sharp(path.join(dir,'tank-0.png')).resize(264,130,{fit:'inside'}).png().toFile(path.join(dir,'thumbs/tank-0.png'));
  const {vertices,faces,...meta}=model;
  fs.writeFileSync(path.join(dir,'bake.json'),JSON.stringify({id:recipe.id,name:recipe.name,sizeCm:recipe.size,pixelsPerCm:SCALE,...meta,vertices:vertices.length,triangles:faces.length,bakeMs:Date.now()-started,frames,shopFrames},null,2));
  console.log(`${recipe.id}: 8 PNGs, ${vertices.length} vertices / ${faces.length} triangles, ${((Date.now()-started)/1000).toFixed(1)}s`);
 }
 if(recipes.every(r=>fs.existsSync(path.join(out,r.id,'bake.json')))){
  const definitions={};for(const r of recipes){const b=JSON.parse(fs.readFileSync(path.join(out,r.id,'bake.json'),'utf8'));definitions['sprite_driftwood_'+r.id]={name:r.name,cat:'ขอนไม้ · 4 มุม',sizeCm:r.size,priceCm:Math.max(...r.size),cell:.5,flips:'rotate',sprite:true,shopRotationSign:-1,...b.frames[0],frames:b.frames,shopFrames:b.shopFrames};}
  if(complex)for(const def of Object.values(definitions)){
   const stamp=JSON.parse(fs.readFileSync(path.join(root,def.src.replace(/[^/]+$/,'bake.json')))).geometryHash.slice(0,12);
   for(const frame of [def,...def.frames,...def.shopFrames])frame.src+='?v='+stamp;
  }
  fs.writeFileSync(path.join(root,'js',defsFile),'// Generated by tools/bake-driftwood-pack.cjs'+(complex?' --complex':'')+'.\nvar SPRITE_DECOR_DEFS=typeof SPRITE_DECOR_DEFS===\'object\'&&SPRITE_DECOR_DEFS?SPRITE_DECOR_DEFS:{};\nObject.assign(SPRITE_DECOR_DEFS,'+JSON.stringify(definitions)+');\n');
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(recipes.map(r=>({id:r.id,name:r.name,sizeCm:r.size,recipe:r,report:r.id+'/bake.json'})),null,2));
  await reviewSheets();
 }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={recipes,build,project,rotate,footprint,render};
