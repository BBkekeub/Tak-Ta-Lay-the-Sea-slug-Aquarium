import * as THREE from 'three';
// GPU instancing: one draw per mesh part, with independent skeleton matrices and colors.
export class SlugCrowd {
 constructor(template,scene,capacity=256){
  this.capacity=capacity;this.parts=[];this.scene=scene;this.width=256;
  let skeleton;template.traverse(o=>{if(o.isSkinnedMesh&&!skeleton)skeleton=o.skeleton;});this.bones=skeleton.bones.length;
  this.height=Math.ceil(capacity*this.bones*4/this.width);
  this.data=new Float32Array(this.width*this.height*4);this.texture=new THREE.DataTexture(this.data,this.width,this.height,THREE.RGBAFormat,THREE.FloatType);this.texture.needsUpdate=true;
  template.updateMatrixWorld(true);
  template.traverse(source=>{
   if(!source.isMesh)return;
   const g=source.geometry.clone(),m=source.material.clone(),skin=source.isSkinnedMesh,palette=!!source.material.userData.palette;
   if(palette&&source.name!=='Body'){
    const p=g.attributes.position,n=g.attributes.normal,ix=g.index,acc=new Float32Array(p.count),num=new Float32Array(p.count);
    const edge=(a,b)=>{const x=p.getX(a)-p.getX(b),y=p.getY(a)-p.getY(b),z=p.getZ(a)-p.getZ(b),len=Math.hypot(x,y,z);if(len<1e-7)return;acc[a]+=(x*n.getX(a)+y*n.getY(a)+z*n.getZ(a))/len;num[a]++;};
    for(let t=0;t<(ix?ix.count:p.count);t+=3){const a=ix?ix.getX(t):t,b=ix?ix.getX(t+1):t+1,c=ix?ix.getX(t+2):t+2;edge(a,b);edge(a,c);edge(b,a);edge(b,c);edge(c,a);edge(c,b);}
    const relief=new Float32Array(p.count);for(let j=0;j<p.count;j++)relief[j]=Math.max(-1,Math.min(1,acc[j]/Math.max(1,num[j])*4));
    g.setAttribute('gillRelief',new THREE.BufferAttribute(relief,1));
   }
   const original=source.material.onBeforeCompile,key=source.material.customProgramCacheKey;
   const metal=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);if(palette)g.setAttribute('crowdMetal',metal);
   const traits=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4);if(palette)g.setAttribute('aGeneTraits',traits);
   const pose=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1);g.setAttribute('crowdPose',pose);
   const colors={};if(palette)for(const k of ['geneBase','geneAcc','geneDark','geneLight']){colors[k]=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);g.setAttribute('a'+k,colors[k]);}
   m.onBeforeCompile=function(shader){
    original.call(source.material,shader);
    if(palette){
     shader.fragmentShader=shader.fragmentShader.replace('uniform vec4 geneTraits;','varying vec4 geneTraits;');
     shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 aGeneTraits;varying vec4 geneTraits;').replace('#include <begin_vertex>','#include <begin_vertex>\ngeneTraits=aGeneTraits;');
     shader.fragmentShader=shader.fragmentShader.replace('uniform vec3 geneBase,geneAcc,geneDark,geneLight;','varying vec3 geneBase,geneAcc,geneDark,geneLight;');
     shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 geneBase,geneAcc,geneDark,geneLight;\nattribute vec3 ageneBase,ageneAcc,ageneDark,ageneLight;');
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngeneBase=ageneBase;geneAcc=ageneAcc;geneDark=ageneDark;geneLight=ageneLight;');
    }
    if(skin){
     shader.uniforms.crowdBones={value:thisCrowd.texture};shader.uniforms.bindMatrix={value:source.bindMatrix};shader.uniforms.bindMatrixInverse={value:source.bindMatrixInverse};
     shader.vertexShader='#define USE_SKINNING\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <skinning_pars_vertex>',`attribute vec4 skinIndex;attribute vec4 skinWeight;attribute float crowdPose;
     uniform sampler2D crowdBones;uniform mat4 bindMatrix;uniform mat4 bindMatrixInverse;
     mat4 getBoneMatrix(const in float i){int p=int((crowdPose*${thisCrowd.bones}.0+i)*4.0);return mat4(texelFetch(crowdBones,ivec2(p%256,p/256),0),texelFetch(crowdBones,ivec2((p+1)%256,(p+1)/256),0),texelFetch(crowdBones,ivec2((p+2)%256,(p+2)/256),0),texelFetch(crowdBones,ivec2((p+3)%256,(p+3)/256),0));}`);
    }
   };
   const thisCrowd=this;m.customProgramCacheKey=()=>key.call(source.material)+'-crowd-'+skin;
   const mesh=new THREE.InstancedMesh(g,m,capacity);mesh.frustumCulled=false;if(source.morphTargetInfluences?.length)mesh.setMorphAt(0,source);mesh.count=0;scene.add(mesh);
   this.parts.push({name:source.name,mesh,pose,colors,skin,metal,traits});
  });
  this.transform=new THREE.Matrix4();this.rotation=new THREE.Matrix4();this.offset=new THREE.Matrix4();this.shape=new THREE.Matrix4();this.appendage=new THREE.Matrix4();this.anchor=new THREE.Vector3();
 }
 update(jobs,up,columns){
  for(const part of this.parts)part.mesh.count=jobs.length;
  const updated=new Set();
  jobs.forEach((job,i)=>{
   const v=job.v,root=v.poseModel||v.model;if(!updated.has(root)){root.updateMatrixWorld(true);updated.add(root);const skeletons=new Set();root.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});for(const sk of skeletons)sk.update();}
   if(!root.userData.partMap){root.userData.partMap=new Map();root.traverse(o=>{if(o.isMesh)root.userData.partMap.set(o.name,o);});}const parts=root.userData.partMap;
   const sk=[...parts.values()].find(o=>o.isSkinnedMesh).skeleton;this.data.set(sk.boneMatrices,i*this.bones*16);
   // Sample the animated underside once per shared pose, including morph targets.
   // Correct the entire rig together so eyes and gills keep their attachments.
   const body=parts.get('Body');
   if(body&&root.userData.groundStamp!==v.last){
    if(!body.userData.floorSamples){
     const p=body.geometry.attributes.position;body.geometry.computeBoundingBox();const b=body.geometry.boundingBox,cells=new Map();
     for(let k=0;k<p.count;k++){const x=Math.min(15,Math.floor((p.getX(k)-b.min.x)/Math.max(.0001,b.max.x-b.min.x)*16)),z=Math.min(5,Math.floor((p.getZ(k)-b.min.z)/Math.max(.0001,b.max.z-b.min.z)*6)),key=x+z*16,old=cells.get(key);if(old===undefined||p.getY(k)<p.getY(old))cells.set(key,k);}
     body.userData.floorSamples=[...cells.values()];
    }
    let bottom=Infinity;for(const k of body.userData.floorSamples){body.getVertexPosition(k,this.anchor);this.anchor.applyMatrix4(body.matrixWorld);bottom=Math.min(bottom,this.anchor.y);}
    root.userData.floorLift=Math.max(0,-bottom);root.userData.groundStamp=v.last;
   }
   const floorLift=job.lifted?0:(root.userData.floorLift||0);
   const genes=typeof foodGenes==='function'?foodGenes(job.s):job.s.genes;
   const d=SlugEngine.derived(genes);
   const colorKey=genes.mainC+'|'+genes.accC;
   if(v.colorKey!==colorKey){const d=SlugEngine.derived(genes),rgb=c=>new THREE.Color(SlugEngine.hex(c));v.palette={geneBase:rgb(d.base),geneAcc:rgb(d.acc),geneDark:rgb(d.matA.d),geneLight:rgb(d.matA.l)};v.bodyMetal=0;v.gillMetal=0;v.colorKey=colorKey;}
   const scale=v.sw/128,offset=up.clone().multiplyScalar(-v.sy/96*1.65-(scale-1)*.825);offset.x+=v.sx/128*2.2+(scale-1)*1.1;offset.y+=.23*(1-scale);this.offset.makeTranslation(offset.x,offset.y,offset.z);this.offset.scale(new THREE.Vector3(scale,scale,scale));this.rotation.makeRotationY(v.orientation||0);
   this.shape.makeScale(d.stretch,1,1);this.shape.setPosition(0,floorLift,0);
   for(const part of this.parts){const src=parts.get(part.name);
    this.appendage.identity();
    const appendageScale=part.name==='rhino_base'?d.tScale:part.name.startsWith('Gill')?d.gScale:1;
    if(appendageScale!==1){
     if(src.userData.geneAnchor===undefined){const p=src.geometry.attributes.position;let k=0;for(let j=1;j<p.count;j++)if(p.getY(j)<p.getY(k))k=j;src.userData.geneAnchor=k;}
     this.anchor.fromBufferAttribute(src.geometry.attributes.position,src.userData.geneAnchor);
     if(src.isSkinnedMesh)src.applyBoneTransform(src.userData.geneAnchor,this.anchor);
     this.anchor.applyMatrix4(src.matrixWorld);
     this.appendage.makeScale(1,appendageScale,1);this.appendage.setPosition(0,this.anchor.y*(1-appendageScale),0);
    }
    if(part.name.startsWith('Eye_')){
     if(!src.geometry.boundingBox)src.geometry.computeBoundingBox();
     src.geometry.boundingBox.getCenter(this.anchor);this.anchor.applyMatrix4(src.matrixWorld);
     const openness=v.eyeOpen??1;this.appendage.makeScale(1,openness,1);this.appendage.setPosition(0,this.anchor.y*(1-openness),0);
    }
    this.transform.copy(this.offset).multiply(this.rotation).multiply(this.shape).multiply(this.appendage).multiply(src.matrixWorld);
    part.traits.setXYZW(i,d.aura,d.nSpot,d.shape==='sq'?1:d.shape==='tri'?2:0,part.name==='Body'?d.deep:d.gdeep);part.mesh.setMatrixAt(i,this.transform);part.pose.setX(i,i);part.metal.setX(i,part.name==='Body'?v.bodyMetal:v.gillMetal);for(const [k,attr] of Object.entries(part.colors)){const c=v.palette[k];attr.setXYZ(i,c.r,c.g,c.b);}if(src.morphTargetInfluences?.length)part.mesh.setMorphAt(i,src);}
  });
  this.texture.needsUpdate=true;
  for(const p of this.parts){p.mesh.instanceMatrix.needsUpdate=true;p.pose.needsUpdate=true;p.metal.needsUpdate=true;p.traits.needsUpdate=true;for(const a of Object.values(p.colors))a.needsUpdate=true;if(p.mesh.morphTexture)p.mesh.morphTexture.needsUpdate=true;}
 }
 dispose(){this.texture.dispose();for(const p of this.parts){this.scene.remove(p.mesh);p.mesh.dispose();p.mesh.geometry.dispose();p.mesh.material.dispose();}}
}
