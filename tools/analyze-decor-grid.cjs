// Offline authoring: derive a baked driftwood piece's 1 cm sand grid and its crawl paths
// from the real model, for each of the 4 game rotations.
// Run: node tools/analyze-decor-grid.cjs <recipe id> [--write] [--apply]
//   --write stores the result in <piece>/grid-1cm.json · --apply merges it into js/decor-grid-overrides.js
// Grid units are game cells (5 cm). A cell [x,y] covers [x,x+0.2]×[y,y+0.2].
//   place  = wood occupies the cell seen from above (other decor may not overlap)
//   solid  = the wood rests on the sand here — slugs on the sand go around
//   behind = sand the slug can use while the wood hides it (behind the piece or under a raised branch)
//   front  = sand where the slug overlaps the sprite but is closer to the camera
//   path   = crawl paths along the top ridge of each branch: n = [x, y, zCm, radiusCm] per node,
//            e = [a, b] node links, in = nodes where a slug on the sand may climb on or off
const fs=require('node:fs'),path=require('node:path');
const {rotate,project}=require('./bake-driftwood-pack.cjs');
const recipes=require('./driftwood-natural-recipes.cjs');
const root=path.resolve(__dirname,'..');
const CELL=1,RES=.25,CLEAR=2,SLUG_R=1.8,SLUG_H=1.2;
// crawl paths: node spacing, thinnest branch a slug may walk on, steepest ridge slope, sand contact for climbing on
const STEP_CM=.5,R_MIN=.45,MAX_SLOPE=Math.tan(55*Math.PI/180),ENTRY_GAP=.8,ENTRY_TOP=7,ENTRY_SPACING=2;
const depth=p=>.475*p[0]-p[1]+.7*p[2];         // same as the bake: larger = nearer the camera
const id=process.argv[2];if(!id)throw Error('usage: analyze-decor-grid.cjs <id> [--write] [--apply]');
const dir=path.join(root,'assets/decor/driftwood/natural-v1',id);
const mesh=JSON.parse(fs.readFileSync(path.join(dir,'game-mesh.json'),'utf8'));
const wood=mesh.faces.filter(f=>mesh.vertices[f[0]].material!==3),moss=mesh.faces.filter(f=>mesh.vertices[f[0]].material===3);
const raster=(pts,w,h,cb)=>{const [a,b,c]=pts,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)return;
 const X0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),X1=Math.min(w-1,Math.ceil(Math.max(a[0],b[0],c[0]))),Y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),Y1=Math.min(h-1,Math.ceil(Math.max(a[1],b[1],c[1])));
 for(let y=Y0;y<=Y1;y++)for(let x=X0;x<=X1;x++){const px=x+.5,py=y+.5,A=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/den,B=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/den,C=1-A-B;
  if(A>=-1e-4&&B>=-1e-4&&C>=-1e-4)cb(y*w+x,A,B,C);}};
// Top-down height field of the unrotated model: lowest/highest wood (+ moss on top) for each 0.25 cm sample.
function heightField(P){
 let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
 for(const f of wood)for(const i of f){x0=Math.min(x0,P[i][0]);x1=Math.max(x1,P[i][0]);y0=Math.min(y0,P[i][1]);y1=Math.max(y1,P[i][1]);}
 const M=6,gx0=Math.floor(x0)-M,gy0=Math.floor(y0)-M,gx1=Math.ceil(x1)+M,gy1=Math.ceil(y1)+M;
 const W=Math.round((gx1-gx0)/RES),H=Math.round((gy1-gy0)/RES),lo=new Float32Array(W*H).fill(Infinity),hi=new Float32Array(W*H).fill(-Infinity);
 for(const f of wood){const p=f.map(i=>P[i]);raster(p.map(q=>[(q[0]-gx0)/RES,(q[1]-gy0)/RES]),W,H,(i,A,B,C)=>{const z=A*p[0][2]+B*p[1][2]+C*p[2][2];if(z<lo[i])lo[i]=z;if(z>hi[i])hi[i]=z;});}
 for(const f of moss){const p=f.map(i=>P[i]);raster(p.map(q=>[(q[0]-gx0)/RES,(q[1]-gy0)/RES]),W,H,(i,A,B,C)=>{const z=A*p[0][2]+B*p[1][2]+C*p[2][2];if(lo[i]<Infinity&&z>hi[i])hi[i]=z;});}
 const at=(x,y)=>{const i=Math.floor((x-gx0)/RES),j=Math.floor((y-gy0)/RES);return i<0||j<0||i>=W||j>=H?-1:j*W+i;};
 return {gx0,gy0,gx1,gy1,W,H,lo,hi,at};
}
function analyse(r){
 const P=mesh.vertices.map(v=>rotate(v.p,r)),F=heightField(P),{gx0,gy0,gx1,gy1,W,lo,hi}=F;
 // Camera depth buffer in the tank projection, to decide what hides a slug standing on the sand.
 const SP=8,sx0=(gx0+.475*gy0)-2,sy0=-.525*gy1-.75*20,SW=Math.ceil(((gx1+.475*gy1)-sx0+2)*SP),SH=Math.ceil((-.525*gy0-sy0+2)*SP),zb=new Float32Array(SW*SH).fill(-Infinity);
 for(const f of [...wood,...moss]){const p=f.map(i=>P[i]),d=p.map(depth);raster(p.map(q=>{const s=project(q,false);return[(s[0]-sx0)*SP,(s[1]-sy0)*SP]}),SW,SH,(i,A,B,C)=>{const z=A*d[0]+B*d[1]+C*d[2];if(z>zb[i])zb[i]=z;});}
 const n=CELL/RES,cells=[];
 for(let cy=gy0;cy<gy1;cy+=CELL)for(let cx=gx0;cx<gx1;cx+=CELL){
  let cov=0,minZ=Infinity;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=(Math.round((cy-gy0)/RES)+j)*W+Math.round((cx-gx0)/RES)+i;if(hi[k]>-Infinity){cov++;minZ=Math.min(minZ,lo[k]);}}
  const c={x:cx,y:cy,covered:cov/(n*n)>=.25};c.ground=c.covered&&minZ<=CLEAR;
  if(!c.ground){let hidden=0,shown=0;
   for(let v=-SLUG_R;v<=SLUG_R;v+=.6)for(let u=-SLUG_R;u<=SLUG_R;u+=.6){if(u*u+v*v>SLUG_R*SLUG_R)continue;
    // body parts that would sit inside wood resting on the sand are not where the slug is
    const gi=Math.floor((cy+CELL/2+v-gy0)/RES)*W+Math.floor((cx+CELL/2+u-gx0)/RES);if(lo[gi]<=CLEAR)continue;
    for(const z of [.3,SLUG_H]){const q=[cx+CELL/2+u,cy+CELL/2+v,z],s=project(q,false),X=Math.floor((s[0]-sx0)*SP),Y=Math.floor((s[1]-sy0)*SP);
     const w=zb[Y*SW+X];if(!(w>-Infinity))continue;if(w>depth(q)+.05)hidden++;else shown++;}}
   c.hidden=hidden;c.shown=shown;}
  cells.push(c);}
 // Far behind the piece the default draw order is already right; keep occlusion cells near the wood.
 const NEAR=4,near=c=>cells.some(w=>w.covered&&Math.abs(w.x-c.x)<=NEAR&&Math.abs(w.y-c.y)<=NEAR);
 const g=v=>+(v/5).toFixed(3),out={place:[],solid:[],front:[],behind:[]};
 for(const c of cells){const k=[g(c.x),g(c.y)];
  if(c.covered)out.place.push(k);
  if(c.ground){out.solid.push(k);continue;}
  if(c.hidden>=4&&c.hidden>=c.shown&&(c.covered||c.y+CELL<=0||near(c)))out.behind.push(k);
  else if(c.shown>=4&&c.shown>c.hidden)out.front.push(k);}
 for(const list of Object.values(out))list.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);   // same order Dec Grid.html saves
 return out;
}
// ---- crawl paths, built once in the model's own space ----
// source.json is the tube mesh before Blender (same coordinates): each branch is rings of 81 vertices,
// so a ring's mean is the branch centre and its mean distance the radius.
function spines(){
 const recipe=recipes.find(r=>r.id===id);if(!recipe)throw Error('no recipe '+id);
 const src=JSON.parse(fs.readFileSync(path.join(dir,'source.json'),'utf8')),V=src.vertices,nt=80,nr=12,out=[];let at=0;
 for(const part of recipe.parts){
  const nx=Math.max(36,(part.points.length-1)*25),rings=[];
  for(let i=0;i<=nx;i++){const c=[0,0,0];for(let j=0;j<nt;j++){const p=V[at+i*(nt+1)+j].p;for(let k=0;k<3;k++)c[k]+=p[k]/nt;}
   let rad=0;for(let j=0;j<nt;j++){const p=V[at+i*(nt+1)+j].p;rad+=Math.hypot(p[0]-c[0],p[1]-c[1],p[2]-c[2])/nt;}rings.push({x:c[0],y:c[1],z:c[2],r:rad});}
  at+=(nx+1)*(nt+1)*(part.hollow?2:1);
  for(let end=0;end<2;end++)if(!((end===0&&part.openStart)||(end===1&&part.openEnd)))at+=(nr+1)*(nt+1);
  out.push(rings);
 }
 if(at!==src.woodVertices)throw Error(`ring layout mismatch: ${at} vs ${src.woodVertices} wood vertices`);
 return out;
}
function crawlPaths(){
 const F=heightField(mesh.vertices.map(v=>v.p));
 // highest surface within a slug's footprint across the ridge (0.35 cm) — the moss/wood top the slug sits on
 const topAt=(x,y)=>{let best=-Infinity;for(let v=-.35;v<=.35;v+=RES)for(let u=-.35;u<=.35;u+=RES){const i=F.at(x+u,y+v);if(i>=0&&F.hi[i]>best)best=F.hi[i];}return best;};
 const nodes=[],edges=[],parts=[];
 for(const rings of spines()){
  // resample the centre line every STEP_CM along the ground; stop where the branch gets too thin to crawl on
  const pts=[rings[0]];let acc=0;
  for(let i=1;i<rings.length;i++){acc+=Math.hypot(rings[i].x-rings[i-1].x,rings[i].y-rings[i-1].y);if(acc>=STEP_CM){pts.push(rings[i]);acc=0;}}
  const ids=[];
  for(const p of pts){if(p.r<R_MIN)break;const z=topAt(p.x,p.y);if(!(z>-Infinity))break;
   const n=nodes.length;nodes.push({x:p.x,y:p.y,z,r:p.r,bottom:p.z-p.r});
   if(ids.length){const a=nodes[ids.at(-1)],dz=Math.abs(z-a.z),dxy=Math.hypot(p.x-a.x,p.y-a.y);if(dz>dxy*MAX_SLOPE){ids.length=0;}else edges.push([ids.at(-1),n]);}
   ids.push(n);}
  parts.push(ids);
 }
 // a branch starts inside its parent: link its first node to the nearest node of another branch
 for(let k=1;k<parts.length;k++){const first=parts[k][0];if(first==null)continue;const a=nodes[first];let best=null,bd=1.6;
  for(let m=0;m<parts.length;m++)if(m!==k)for(const j of parts[m]){const b=nodes[j],d=Math.hypot(a.x-b.x,a.y-b.y);if(d<bd&&Math.abs(a.z-b.z)<=1.6){bd=d;best=j;}}
  if(best!=null)edges.push([first,best]);}
 // climbing on/off: where the wood rests on the sand and the ridge is low enough, spaced along the path
 const entries=[];for(const [i,n] of nodes.entries())if(n.bottom<=ENTRY_GAP&&n.z<=ENTRY_TOP&&entries.every(j=>Math.hypot(nodes[j].x-n.x,nodes[j].y-n.y)>=ENTRY_SPACING))entries.push(i);
 // keep only what a slug can reach from the sand
 const adj=nodes.map(()=>[]);for(const [a,b] of edges){adj[a].push(b);adj[b].push(a);}
 const keep=new Set(entries),queue=[...entries];while(queue.length){const a=queue.pop();for(const b of adj[a])if(!keep.has(b)){keep.add(b);queue.push(b);}}
 const map=new Map([...keep].sort((a,b)=>a-b).map((old,i)=>[old,i]));
 return {nodes:[...map.keys()].map(i=>nodes[i]),edges:edges.filter(([a,b])=>map.has(a)&&map.has(b)).map(([a,b])=>[map.get(a),map.get(b)]),entries:entries.map(i=>map.get(i))};
}
const paths=crawlPaths(),r3=v=>+v.toFixed(3);
const frames=[0,1,2,3].map(r=>({...analyse(r),path:{n:paths.nodes.map(n=>{const p=rotate([n.x,n.y,0],r);return[r3(p[0]/5),r3(p[1]/5),+n.z.toFixed(2),+n.r.toFixed(2)];}),e:paths.edges,in:paths.entries}}));
console.log(`path: ${paths.nodes.length} nodes · ${paths.edges.length} links · ${paths.entries.length} climb points · ridge ${Math.min(...paths.nodes.map(n=>n.z)).toFixed(1)}–${Math.max(...paths.nodes.map(n=>n.z)).toFixed(1)} cm`);
for(const [r,f] of frames.entries())console.log(`${r*90}°: place ${f.place.length} · solid ${f.solid.length} · behind ${f.behind.length} · front ${f.front.length}`);
if(process.argv.includes('--apply')){
 // Merge into js/decor-grid-overrides.js (the file Dec Grid.html saves to), keeping other entries.
 const file=path.join(root,'js/decor-grid-overrides.js'),ctx={SPRITE_DECOR_DEFS:{}},vm=require('node:vm');vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(path.join(root,'js/driftwood-natural-defs.js'),'utf8'),ctx);vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
 const key='sprite_driftwood_'+id,base=ctx.SPRITE_DECOR_DEFS[key],over=ctx.DECOR_GRID_OVERRIDES||{};
 const def=JSON.parse(JSON.stringify(base));def.cell=.2;def.gridSource='mesh-1cm-path-v1';
 def.frames=def.frames.map((f,i)=>{const {top,...rest}=f;return{...rest,...frames[i]};});
 delete def.top;Object.assign(def,def.frames[0]);
 over[key]=def;
 fs.writeFileSync(file,"// Saved from Dec Grid.html. Keep after authored definitions.\nvar DECOR_GRID_OVERRIDES="+JSON.stringify(over,null,1)+";\nObject.assign(SPRITE_DECOR_DEFS,DECOR_GRID_OVERRIDES);\n");
 console.log('applied',key,'to js/decor-grid-overrides.js');}
if(process.argv.includes('--write')){fs.writeFileSync(path.join(dir,'grid-1cm.json'),JSON.stringify({id,cell:.2,clearanceCm:CLEAR,frames}));console.log('wrote',path.relative(root,path.join(dir,'grid-1cm.json')));}
