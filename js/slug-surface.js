import * as THREE from 'three';

// One Loop subdivision on the body only, including relative morphs and skin weights.
// Generated once when loading; no subdivision work during animation.
export function softenBody(mesh){
 const g=mesh.geometry,p=g.attributes.position,unique=[],lookup=new Map(),remap=[];
 for(let i=0;i<p.count;i++){
  const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
  if(!lookup.has(key)){lookup.set(key,unique.length);unique.push(i);}remap.push(lookup.get(key));
 }
 const faces=[],edges=new Map(),neighbors=unique.map(()=>new Set()),boundary=unique.map(()=>[]);
 const key=(a,b)=>a<b?a+','+b:b+','+a;
 for(let i=0;i<(g.index?g.index.count:p.count);i+=3){
  const f=[0,1,2].map(k=>remap[g.index?g.index.getX(i+k):i+k]);if(new Set(f).size<3)continue;faces.push(f);
  for(let j=0;j<3;j++){
   const a=f[j],b=f[(j+1)%3],op=f[(j+2)%3],k=key(a,b);
   if(!edges.has(k))edges.set(k,{a,b,op:[]});edges.get(k).op.push(op);neighbors[a].add(b);neighbors[b].add(a);
  }
 }
 for(const e of edges.values())if(e.op.length===1){boundary[e.a].push(e.b);boundary[e.b].push(e.a);}
 const blends=unique.map((_,i)=>{
  if(boundary[i].length===2)return [[i,.75],...boundary[i].map(j=>[j,.125])];
  const n=neighbors[i].size;if(!n)return[[i,1]];
  const beta=n===3?3/16:3/(8*n);return[[i,1-n*beta],...[...neighbors[i]].map(j=>[j,beta])];
 });
 for(const e of edges.values()){
  e.index=blends.length;
  blends.push(e.op.length===2?[[e.a,.375],[e.b,.375],[e.op[0],.125],[e.op[1],.125]]:[[e.a,.5],[e.b,.5]]);
 }
 const idx=[];for(const [a,b,c] of faces){const ab=edges.get(key(a,b)).index,bc=edges.get(key(b,c)).index,ca=edges.get(key(c,a)).index;idx.push(a,ab,ca,b,bc,ab,c,ca,bc,ab,bc,ca);}
 const interpolate=attr=>{
  const values=new Float32Array(blends.length*attr.itemSize);
  for(let i=0;i<blends.length;i++)for(const [j,w] of blends[i])for(let k=0;k<attr.itemSize;k++)values[i*attr.itemSize+k]+=attr.array[unique[j]*attr.itemSize+k]*w;
  return new THREE.BufferAttribute(values,attr.itemSize);
 };
 const out=new THREE.BufferGeometry();out.setIndex(idx);out.setAttribute('position',interpolate(p));
 if(g.attributes.uv)out.setAttribute('uv',interpolate(g.attributes.uv));
 const ji=g.attributes.skinIndex,jw=g.attributes.skinWeight;
 const ids=new Uint16Array(blends.length*4),weights=new Float32Array(blends.length*4);
 for(let i=0;i<blends.length;i++){
  const sum=new Map();for(const [j,w] of blends[i])for(let k=0;k<4;k++){
   const id=ji.array[unique[j]*4+k],v=jw.array[unique[j]*4+k]*w;sum.set(id,(sum.get(id)||0)+v);
  }
  const best=[...sum].sort((a,b)=>b[1]-a[1]).slice(0,4),total=best.reduce((s,e)=>s+e[1],0);
  best.forEach(([j,w],k)=>{ids[i*4+k]=j;weights[i*4+k]=w/total;});
 }
 out.setAttribute('skinIndex',new THREE.BufferAttribute(ids,4));out.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));
 out.morphTargetsRelative=g.morphTargetsRelative;
 out.morphAttributes.position=(g.morphAttributes.position||[]).map(interpolate);
 out.computeVertexNormals();out.computeBoundingBox();out.computeBoundingSphere();
 mesh.geometry=out;g.dispose();
}
