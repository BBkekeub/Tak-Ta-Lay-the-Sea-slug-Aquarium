// Rebuild fitted accessories after changing the baked people models.
// Usage: node tools/build-people-bags.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..');
const modelContext=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'js/people-model.js'),'utf8')+'\nthis.models=PEOPLE_MODEL;',modelContext);
const personBagModels=new WeakMap();
function fittedPersonBags(model){
  if(personBagModels.has(model))return personBagModels.get(model);
  const hip=model.joints.hips,neck=model.joints.neck,torso={v:[],t:[],o:[0,0,0]};
  // Shoulder facets are split across bones in the bake. Include their bind
  // positions so a missing torso facet cannot mistake the back for the chest.
  for(const part of [model.parts.torso,model.parts.armL,model.parts.armR]){
    const base=torso.v.length/3;
    for(let i=0;i<part.v.length;i++)torso.v.push(part.v[i]+part.o[i%3]);
    torso.t.push(...part.t.map(i=>i+base));
  }
  const verts=Array.from({length:torso.v.length/3},(_,i)=>[0,1,2].map(a=>torso.v[i*3+a]+torso.o[a]));
  const triangles=[];
  for(let i=0;i<torso.t.length;i+=3){
    const [a,b,c]=torso.t.slice(i,i+3).map(j=>verts[j]);
    const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    if(Math.abs(d)>1e-10)triangles.push({a,b,c,d,minX:Math.min(a[0],b[0],c[0]),maxX:Math.max(a[0],b[0],c[0]),minZ:Math.min(a[2],b[2],c[2]),maxZ:Math.max(a[2],b[2],c[2])});
  }
  function surface(x,z,side){
    let result=side>0?-Infinity:Infinity;
    for(const tri of triangles){
      if(x<tri.minX||x>tri.maxX||z<tri.minZ||z>tri.maxZ)continue;
      const {a,b,c,d}=tri;
      const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d;
      const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
      if(u<-.00001||v<-.00001||u+v>1.00001)continue;
      const y=u*a[1]+v*b[1]+(1-u-v)*c[1];result=side>0?Math.max(result,y):Math.min(result,y);
    }
    return result;
  }
  function mesh(){return {o:hip,v:[],t:[],s:[]};}
  function quad(m,points,slot){
    const base=m.v.length/3,start=m.t.length/3;
    for(const v of points)m.v.push(...v.map((x,a)=>x-hip[a]));
    m.t.push(base,base+1,base+2,base,base+2,base+3);
    const run=m.s[m.s.length-1];if(run&&run[0]===slot)run[2]+=2;else m.s.push([slot,start,2]);
  }
  function box(m,x0,x1,y0,y1,z0,z1,slot){
    const v=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
    for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])quad(m,f.map(i=>v[i]),slot);
  }
  function shoulderTop(x){
    let top=hip[2];
    for(const xx of [x-.005,x,x+.005])for(let i=0;i<torso.t.length;i+=3)for(let j=0;j<3;j++){
      const a=verts[torso.t[i+j]],b=verts[torso.t[i+(j+1)%3]],span=b[0]-a[0];
      if(Math.abs(span)<1e-9)continue;const t=(xx-a[0])/span;
      if(t>=0&&t<=1)top=Math.max(top,a[2]+(b[2]-a[2])*t);
    }
    return top+.003;
  }
  // Fit both edges, and lift a segment only enough to clear the intervening
  // chest facets. All surface searches happen once per model, never per frame.
  function strap(m,x0,z0,x1,z1,side,endY,steps=14){
    const length=Math.hypot(x1-x0,z1-z0)||1,dx=-(z1-z0)/length*.004,dz=(x1-x0)/length*.004;
    const rows=Array.from({length:steps+1},(_,i)=>{
      const t=i/steps,x=x0+(x1-x0)*t,z=z0+(z1-z0)*t;
      return [-1,1].map(s=>{
        const xx=x+s*dx,zz=z+s*dz;let y=surface(xx,zz,side);
        if(!Number.isFinite(y)&&i===0)for(let drop=.002;drop<=.04;drop+=.002){y=surface(xx,zz-drop,side);if(Number.isFinite(y))break;}
        return [xx,Number.isFinite(y)?y+side*.0025:endY,zz];
      });
    });
    const lifts=new Float64Array(steps+1);
    for(let i=0;i<steps;i++){
      let lift=0;
      // Sample the actual two triangles (a bilinear quad can hide a diagonal dip).
      for(const tri of [[rows[i][0],rows[i][1],rows[i+1][1]],[rows[i][0],rows[i+1][1],rows[i+1][0]]])
        for(let j=0;j<=10;j++)for(let k=0;k<=10-j;k++){
          const at=[0,1,2].map(a=>tri[0][a]*(1-(j+k)/10)+tri[1][a]*j/10+tri[2][a]*k/10);
          const y=surface(at[0],at[2],side);if(Number.isFinite(y))lift=Math.max(lift,(y-at[1])*side+.0025);
        }
      lifts[i]=Math.max(lifts[i],lift);lifts[i+1]=Math.max(lifts[i+1],lift);
    }
    for(let i=0;i<rows.length;i++)for(const v of rows[i])v[1]+=side*lifts[i];
    for(let i=0;i<steps;i++)quad(m,[rows[i][0],rows[i][1],rows[i+1][1],rows[i+1][0]],'strap');
    return rows;
  }
  const bag=mesh(),backpack=mesh(),bottom=hip[2]-.035,top=hip[2]+.045;
  function torsoWidth(z){
    const count=model.parts.torso.v.length/3,body=verts.slice(0,count);
    z=Math.max(Math.min(...body.map(v=>v[2]))+.0001,Math.min(Math.max(...body.map(v=>v[2]))-.0001,z));
    let width=0;
    for(let i=0;i<model.parts.torso.t.length;i+=3)for(let j=0;j<3;j++){
      const a=verts[torso.t[i+j]],b=verts[torso.t[i+(j+1)%3]],dz=b[2]-a[2];
      if(Math.abs(dz)<1e-10)continue;const t=(z-a[2])/dz;
      if(t>=0&&t<=1)width=Math.max(width,Math.abs(a[0]+(b[0]-a[0])*t));
    }
    return width;
  }
  // The inner side touches the widest hip slice covered by the bag.
  const sideX=Math.max(...Array.from({length:9},(_,i)=>torsoWidth(bottom+(top-bottom)*i/8)))+.002;
  const bagY=0,halfDepth=.027;
  box(bag,sideX,sideX+.044,bagY-halfDepth,bagY+halfDepth,bottom,top,'bag');
  const startX=-.065,startZ=shoulderTop(startX);
  const front=strap(bag,startX,startZ,sideX+.012,top,1,bagY+halfDepth);
  const back=strap(bag,startX,startZ,sideX+.012,top,-1,bagY-halfDepth);
  quad(bag,[front[0][0],front[0][1],back[0][1],back[0][0]],'strap');
  const packBottom=hip[2]+.035,packTop=neck[2]-.065;
  const packRows=Array.from({length:6},(_,j)=>[-.055,0,.055].map(x=>{
    const z=packBottom+(packTop-packBottom)*j/5;return [x,surface(x,z,-1)-.003,z];
  }));
  const packLifts=new Map();
  for(let j=0;j<5;j++)for(let k=0;k<2;k++){
    const points=[packRows[j][k],packRows[j][k+1],packRows[j+1][k+1],packRows[j+1][k]];
    let lift=0;
    for(const tri of [[points[0],points[1],points[2]],[points[0],points[2],points[3]]])
      for(let a=0;a<=8;a++)for(let b=0;b<=8-a;b++){
        const p=[0,1,2].map(i=>tri[0][i]*(1-(a+b)/8)+tri[1][i]*a/8+tri[2][i]*b/8);
        const y=surface(p[0],p[2],-1);if(Number.isFinite(y))lift=Math.max(lift,p[1]-y+.0025);
      }
    for(const p of points)packLifts.set(p,Math.max(packLifts.get(p)||0,lift));
  }
  for(const [p,lift] of packLifts)p[1]-=lift;
  const outer=p=>[p[0],p[1]-.036,p[2]];
  for(let j=0;j<5;j++)for(let k=0;k<2;k++){
    const q=[packRows[j][k],packRows[j][k+1],packRows[j+1][k+1],packRows[j+1][k]];
    quad(backpack,q,'pants');quad(backpack,q.map(outer),'pants');
  }
  for(let j=0;j<5;j++)for(const k of [0,2]){const a=packRows[j][k],b=packRows[j+1][k];quad(backpack,[a,b,outer(b),outer(a)],'pants');}
  for(const j of [0,5])for(let k=0;k<2;k++){const a=packRows[j][k],b=packRows[j][k+1];quad(backpack,[a,b,outer(b),outer(a)],'pants');}
  for(const x of [-.065,.065]){
    const endX=Math.sign(x)*(torsoWidth(packBottom)+.006);
    const z=shoulderTop(x),f=strap(backpack,x,z,endX,packBottom,1,0,10);
    const anchorX=Math.sign(x)*.055,backTop=packRows[5][x<0?0:2],backBottom=packRows[0][x<0?0:2];
    const b=strap(backpack,x,z,anchorX,packTop,-1,backTop[1],6);
    quad(backpack,[f[0][0],f[0][1],b[0][1],b[0][0]],'strap');
    const end=b[b.length-1];quad(backpack,[end[0],end[1],[end[1][0],backTop[1],end[1][2]],[end[0][0],backTop[1],end[0][2]]],'strap');
    const lower=strap(backpack,endX,packBottom,anchorX,packBottom,-1,0,6),endL=lower[lower.length-1];
    quad(backpack,[endL[0],endL[1],[endL[1][0],backBottom[1],endL[1][2]],[endL[0][0],backBottom[1],endL[0][2]]],'strap');
  }
  const result={bag,backpack};personBagModels.set(model,result);return result;
}

const result=Object.fromEntries(Object.entries(modelContext.models).map(([name,model])=>[name,fittedPersonBags(model)]));
for(const pair of Object.values(result))for(const mesh of Object.values(pair)){
  if(!mesh.v.every(Number.isFinite))throw new Error('Invalid fitted geometry');
  mesh.v=mesh.v.map(x=>+x.toFixed(6));
  // Adjacent quads use identical corners. Share them so every pose transforms
  // each position once; triangle order/material ranges remain unchanged.
  const positions=[],indices=[],lookup=new Map();
  for(let i=0;i<mesh.v.length;i+=3){
    const p=mesh.v.slice(i,i+3),key=p.join(',');let index=lookup.get(key);
    if(index===undefined){index=positions.length/3;lookup.set(key,index);positions.push(...p);}
    indices.push(index);
  }
  mesh.v=positions;mesh.t=mesh.t.map(i=>indices[i]);
}
fs.writeFileSync(path.join(root,'js/people-bags.js'),'// Generated by tools/build-people-bags.mjs; torso-fitted bags and straps.\nconst PEOPLE_BAG_MODEL='+JSON.stringify(result)+';\n');
console.log('Built fitted bags for '+Object.keys(result).join(', '));
