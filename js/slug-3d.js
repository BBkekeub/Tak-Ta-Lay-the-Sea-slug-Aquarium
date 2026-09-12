import {projectedHeading,intersectsCanvas} from './slug-view-math.js?v=direction16';
import {SlugCrowd} from './slug-crowd.js?v=eyes17';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {applySlugSkin,addSlugEyes,updateSlugPalette} from './slug-skin.js?v=face14';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {softenBody} from './slug-surface.js';
const api=window.Slug3D={ready:false,enabled:true,all:true,targetId:null,error:null,stats:{renders:0,reuses:0,culled:0,ms:0,triangles:0,drawCalls:0,instances:0,copies:0,animationHz:0},clip:null};
let farCrowd,crowd,highCrowd,atlasCamera,atlasUp,lastFlush=0;
let renderer,scene,camera,model,mixer,actions,meta,template,clips,groundY=.72;
let resolution=256,atlasW=2048,atlasH=1920,columns=8,atlasRows=10,viewMode=null;const slotsPerPage=256;
const highGeometries=new Map();
const posePool=new Map();
const instances=new Map(),pages=[],pending=new Map();let scheduled=false,slotSeq=0;const freeSlots=[];
let viewFrame=0;
api.beginFrame=()=>{viewFrame++;pending.clear();api.stats.frameCulled=0;if(!scheduled){scheduled=true;requestAnimationFrame(flush);}};
function pageFor(slot){
 const index=0;
 if(!pages[index]){const canvas=document.createElement('canvas');canvas.width=atlasW;canvas.height=atlasH;pages[index]={canvas,ctx:canvas.getContext('2d')};}
 return pages[index];
}
function instance(s){
 let v=instances.get(s.id);if(v)return v;
 const root=cloneSkeleton(template);
 const mix=new THREE.AnimationMixer(root),acts={};
 for(const c of clips){const a=mix.clipAction(c),info=meta[c.name];a.setLoop(info?.loop?THREE.LoopRepeat:THREE.LoopOnce,info?.loop?Infinity:1);a.clampWhenFinished=true;acts[c.name]=a;}
 const slot=freeSlots.length?freeSlots.pop():slotSeq++,tile=slot%slotsPerPage;
 v={model:root,mixer:mix,actions:acts,slot,page:pageFor(slot),sx:(tile%columns)*resolution,sy:Math.floor(tile/columns)*resolution*.75,last:0,state:'',current:null,retiring:[],orientation:null,held:false,dropUntil:0,valid:false};
 instances.set(s.id,v);api.stats.instances=instances.size;return v;
}
api.release=ids=>{for(const [id,v] of instances){if(ids.has(id))continue;pending.delete(id);v.mixer.stopAllAction();v.mixer.uncacheRoot(v.model);v.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});freeSlots.push(v.slot);instances.delete(id);}api.stats.instances=instances.size;};
function renderJob(job,now){
 const {s,v,lifted}=job;
 if(v.held&&!lifted)v.dropUntil=now+1200;v.held=lifted;
 const key=lifted?'held':now<v.dropUntil?'drop':v.actions[s.state]?s.state:'rest';
 if(key!==v.state){const next=v.actions[key];next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();v.retiring=v.retiring.filter(r=>r.action!==next);if(v.current&&v.current!==next){next.crossFadeFrom(v.current,key==='startle'?.07:.2,false);v.retiring.push({action:v.current,until:now+250});}v.current=next;v.state=key;v.changedAt=now;}
 v.retiring=v.retiring.filter(r=>{if(now>=r.until){r.action.stop();return false;}return true;});
 const dt=v.last?Math.min((now-v.last)/1000,.5):0,face=job.heading??v.orientation??0;
 if(v.orientation===null)v.orientation=face;
 const turnDelta=Math.atan2(Math.sin(face-v.orientation),Math.cos(face-v.orientation));
 v.orientation+=Math.max(-dt*10,Math.min(dt*10,turnDelta));v.model.rotation.y=0;
 const eyes={sleep:.07,sneeze:.08,startle:1.25,flee:1.18,held:1.12,eat:.72,dashCharge:.38,dash:.5,greet:.78,inspect:.85,mating:.65,larvaDeath:.07};
 let eyeTarget=eyes[key]??1;
 const blinkPhase=(now/1000+v.slot*.731)%4.7;if(eyeTarget===1&&blinkPhase<.16)eyeTarget=.08;
 v.eyeOpen=(v.eyeOpen??1)+(eyeTarget-(v.eyeOpen??1))*(1-Math.exp(-dt*24));
 v.poseModel=null;
 if(instances.size>24&&meta[key]?.loop&&!lifted&&now-v.changedAt>300){
  const phase=String(s.id).split('').reduce((a,c)=>a+c.charCodeAt(0),0)%8,poolKey=key+'|'+phase;
  let pose=posePool.get(poolKey);
  if(!pose){const model=cloneSkeleton(template),mixer=new THREE.AnimationMixer(model),clip=clips.find(c=>c.name===key),action=mixer.clipAction(clip);action.setLoop(THREE.LoopRepeat,Infinity).play();pose={model,mixer,clip,last:0};posePool.set(poolKey,pose);}
  if(pose.last!==now){pose.mixer.setTime(now/1000+phase*pose.clip.duration/8);pose.last=now;}
  v.poseModel=pose.model;
 }else v.mixer.update(dt);
 if(v.last)api.stats.animationHz=api.stats.animationHz*.95+1000/(now-v.last)*.05;
 v.last=now;v.valid=true;api.clip=key;api.stats.renders++;api.stats.triangles=renderer.info.render.triangles;api.stats.drawCalls=renderer.info.render.calls;
}
function flush(){
 scheduled=false;if(document.hidden||!api.enabled){pending.clear();return;}
 const start=performance.now(),now=start;
 const jobs=[...pending.values()].filter(j=>j.frame===viewFrame).sort((a,b)=>(a.v.last||-1e9)-(b.v.last||-1e9));pending.clear();
 if(now-lastFlush<33)return;
 if(!jobs.length){api.stats.visible=0;api.stats.highDetail=0;api.stats.drawCalls=0;api.stats.triangles=0;return;}
 const visible=jobs.slice(0,256).sort((a,b)=>b.size-a.size||a.v.slot-b.v.slot);
 if(!visible.length)return;
 const area=visible.reduce((n,j)=>n+j.size*j.size*.75,0),maxSize=Math.max(...visible.map(j=>j.size));
 const width=Math.min(4096,Math.max(maxSize,2**Math.ceil(Math.log2(Math.sqrt(area*1.3))))),groups=[];
 let rowX=0,rowY=0,rowH=0,index=0;
 for(const job of visible){const w=job.size,h=w*.75;if(rowX+w>width){rowX=0;rowY+=rowH;rowH=0;}if(rowY+h>4096){index++;rowX=0;rowY=0;rowH=0;}
  if(!groups[index])groups[index]={jobs:[],height:0};const group=groups[index];Object.assign(job.v,{sx:rowX,sy:rowY,sw:w,sh:h});group.jobs.push(job);group.height=Math.max(group.height,rowY+h);rowX+=w;rowH=Math.max(rowH,h);
 }
 const height=Math.ceil(Math.max(...groups.map(g=>g.height))/384)*384;
 if(atlasW!==width||atlasH!==height){atlasW=width;atlasH=height;renderer.setSize(width,height,false);atlasCamera.right=width/128*2.2-1.1;atlasCamera.bottom=.825-height/96*1.65;atlasCamera.updateProjectionMatrix();}
 let triangles=0,calls=0;
 groups.forEach((group,i)=>{
  if(!pages[i]){const canvas=document.createElement('canvas');pages[i]={canvas,ctx:canvas.getContext('2d')};}const page=pages[i];if(page.canvas.width!==width||page.canvas.height!==height){page.canvas.width=width;page.canvas.height=height;}
  const stage0=performance.now();const low=[],high=[],far=[];
  for(const job of group.jobs){job.v.page=page;renderJob(job,now);(job.size>=512?high:job.size<=128?far:low).push(job);}
  const stage1=performance.now();farCrowd.update(far,atlasUp,columns);crowd.update(low,atlasUp,columns);highCrowd.update(high,atlasUp,columns);
  const stage2=performance.now();renderer.setViewport(0,0,width,height);renderer.setScissor(0,0,width,height);renderer.clear(true,true,true);renderer.render(scene,atlasCamera);
  const stage3=performance.now();page.ctx.clearRect(0,0,width,height);page.ctx.drawImage(renderer.domElement,0,0);api.stats.copies++;api.stats.stages=[stage1-stage0,stage2-stage1,stage3-stage2,performance.now()-stage3].map(n=>+n.toFixed(1));
  triangles+=renderer.info.render.triangles;calls+=renderer.info.render.calls;
 });
 api.stats.triangles=triangles;api.stats.drawCalls=calls;api.stats.visible=visible.length;api.stats.posePools=posePool.size;api.stats.resolutions=[...new Set(visible.map(j=>j.size))].sort((a,b)=>a-b);api.stats.highDetail=visible.filter(j=>j.size>=512).length;
 lastFlush=now;

 api.stats.ms=api.stats.ms*.9+(performance.now()-start)*.1;
}

api.draw=(ctx,s,x,y,len,lifted=false,direction=null)=>{
 if(!api.ready||!api.enabled||(!api.all&&s.id!==api.targetId))return false;
 const width=len*2.2,height=width*.75,top=y-height*groundY,tr=ctx.getTransform();
 if(document.hidden||!intersectsCanvas(tr,x-width/2,top,width,height,ctx.canvas.width,ctx.canvas.height)){pending.delete(s.id);api.stats.culled++;api.stats.frameCulled++;return true;}
 const v=instance(s);const pixelWidth=width*Math.hypot(tr.a,tr.b),wanted=Math.max(64,Math.min(1024,Math.ceil(Math.max(1,pixelWidth)/64)*64));if(!v.requestSize||wanted>v.requestSize||wanted<v.requestSize-64)v.requestSize=wanted;pending.set(s.id,{s,v,len,lifted,size:v.requestSize,frame:viewFrame,heading:direction?projectedHeading(direction.x,direction.y):null});
 if(!scheduled){scheduled=true;requestAnimationFrame(flush);}
 if(v.valid){
  if(!lifted){ctx.save();ctx.translate(x,y);ctx.scale(1,.24);const r=len*.46,g=ctx.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,'rgba(0,0,0,.2)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.restore();}
  ctx.drawImage(v.page.canvas,v.sx,v.sy,v.sw,v.sh,x-width/2,top,width,height);api.stats.reuses++;
 }
 s._hit={x,y:y-len*.2,r:Math.max(26,len*.62)};return true;
};
try{
 const [gltf,data,eyes,lod,farLod]=await Promise.all([new GLTFLoader().loadAsync('assets/slug3d/slug-behaviors.glb?v=2'),fetch('assets/slug3d/behaviors.json').then(r=>r.json()),fetch('assets/slug3d/edited-eyes.json?v=1').then(r=>{if(!r.ok)throw Error('Edited eyes failed to load');return r.json();}),fetch('assets/slug3d/slug-lod.json').then(r=>r.json()),fetch('assets/slug3d/slug-lod-far.json').then(r=>r.json())]);
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false});
 renderer.setPixelRatio(1);renderer.setSize(atlasW,atlasH,false);renderer.autoClear=false;renderer.setScissorTest(true);renderer.setClearColor(0,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
 renderer.shadowMap.enabled=false;renderer.shadowMap.type=THREE.PCFShadowMap;
 scene=new THREE.Scene();model=new THREE.Group();scene.add(model);model.add(gltf.scene);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
 const environment=pmrem.fromScene(room,.025);scene.environment=environment.texture;room.dispose();pmrem.dispose();
 window.addEventListener('pagehide',()=>environment.dispose());
 softenBody(gltf.scene.getObjectByName('Body'));
 gltf.scene.traverse(o=>{if(o.isMesh)highGeometries.set(o.name,o.geometry);});
 const lowGeometries=new Map();
 function applyLOD(root,data){root.traverse(o=>{if(!o.isMesh)return;const src=data[o.name.replace(/\./g,'')];if(!src)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(src.position,3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(src.skinIndex,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(src.skinWeight,4));g.setIndex(src.index);g.morphTargetsRelative=true;if(src.morphs.length)g.morphAttributes.position=src.morphs.map(a=>new THREE.Float32BufferAttribute(a,3));g.computeVertexNormals();o.geometry=g;});}
 applyLOD(gltf.scene,lod);
 applySlugSkin(gltf.scene);
 addSlugEyes(gltf.scene,eyes);
 gltf.scene.updateMatrixWorld(true);
 const body=gltf.scene.getObjectByName('Body');
 const box=new THREE.Box3().setFromObject(body),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const scale=1/size.x;gltf.scene.scale.multiplyScalar(scale);gltf.scene.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
 gltf.scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;}});
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.2),new THREE.ShadowMaterial({opacity:.20}));
 ground.rotation.x=-Math.PI/2;ground.position.y=-.008;ground.receiveShadow=true;
 window.addEventListener('pagehide',()=>{ground.geometry.dispose();ground.material.dispose();});
 camera=new THREE.OrthographicCamera(-1.1,1.1,.825,-.825,.01,20);
 camera.position.set(0,1.12,2.5);camera.lookAt(0,.23,0);camera.updateMatrixWorld();
 groundY=(1-new THREE.Vector3(0,0,0).project(camera).y)/2;
 atlasCamera=camera.clone();atlasCamera.right=atlasW/128*2.2-1.1;atlasCamera.bottom=.825-atlasH/96*1.65;atlasCamera.updateProjectionMatrix();atlasUp=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
 scene.add(new THREE.HemisphereLight(0xc6e8ed,0x8a7865,.4));
 const light=new THREE.DirectionalLight(0xffedcf,2.2);light.position.set(-2,4,3);scene.add(light);
 light.castShadow=true;light.shadow.mapSize.set(512,512);
 Object.assign(light.shadow.camera,{left:-.9,right:.9,top:.9,bottom:-.9,near:.1,far:10});
 light.shadow.normalBias=.006;light.shadow.bias=-.0001;light.shadow.radius=3;
 const rim=new THREE.DirectionalLight(0x91d4eb,1.1);rim.position.set(2,2,-2);scene.add(rim);
 mixer=new THREE.AnimationMixer(gltf.scene);meta=Object.fromEntries(data.clips.map(c=>[c.id,c]));
 actions=Object.fromEntries(gltf.animations.map(c=>{const a=mixer.clipAction(c),m=meta[c.name];a.setLoop(m?.loop?THREE.LoopRepeat:THREE.LoopOnce,m?.loop?Infinity:1);a.clampWhenFinished=true;return[c.name,a];}));
 if(Object.keys(actions).length!==27)throw Error('Expected 27 animation clips');
 template=cloneSkeleton(model);clips=gltf.animations;scene.remove(model);crowd=new SlugCrowd(template,scene);const detailed=cloneSkeleton(template);detailed.traverse(o=>{if(o.isMesh&&highGeometries.has(o.name))o.geometry=highGeometries.get(o.name);});highCrowd=new SlugCrowd(detailed,scene);const distant=cloneSkeleton(template);applyLOD(distant,farLod);farCrowd=new SlugCrowd(distant,scene);api.stats.meshes=crowd.parts.map(p=>({name:p.name,triangles:p.mesh.geometry.index.count/3}));
 api.ready=true;api.names=Object.keys(actions);api.meta=meta;
 api.checkClips=()=>{
  const s={id:'__validation',genes:{mainC:200,accC:250,len:50,girth:50,gillLen:50,gillN:50,spotN:50,tentLen:50,vigor:50},flip:false},v=instance(s),slot=v.slot,canvas=document.createElement('canvas');canvas.width=512;canvas.height=384;const ctx=canvas.getContext('2d'),results=[];v.slot=0;v.tile=0;v.sx=0;v.sy=0;v.sw=128;v.sh=96;
  for(const c of clips){
   v.poseModel=null;v.mixer.stopAllAction();const a=v.actions[c.name];a.reset().play();v.mixer.update(c.duration*.45);v.orientation=-1.02;
   farCrowd.update([],atlasUp,columns);highCrowd.update([],atlasUp,columns);crowd.update([{s,v}],atlasUp,columns);renderer.setViewport(0,atlasH-384,512,384);renderer.setScissor(0,atlasH-384,512,384);renderer.clear(true,true,true);renderer.render(scene,camera);
   ctx.clearRect(0,0,512,384);ctx.drawImage(renderer.domElement,0,0,512,384,0,0,512,384);const pixels=ctx.getImageData(0,0,512,384).data;let alpha=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])alpha++;
   results.push({name:c.name,finite:crowd.data.every(Number.isFinite),visiblePixels:alpha});
  }
  v.slot=slot;api.release(new Set([...instances.keys()].filter(id=>id!=='__validation')));return results;
 };
 const cleanup=setInterval(()=>{if(typeof G==='undefined')return;const ids=new Set((G.objs||[]).flatMap(o=>o.slugs||[]).map(s=>s.id));api.release(ids);},10000);
 window.addEventListener('pagehide',()=>clearInterval(cleanup),{once:true});
 window.dispatchEvent(new Event('slug3dready'));
 window.addEventListener('pagehide',()=>{api.release(new Set());for(const p of posePool.values()){p.mixer.stopAllAction();p.mixer.uncacheRoot(p.model);}posePool.clear();farCrowd.dispose();crowd.dispose();highCrowd.dispose();for(const p of pages){p.canvas.width=p.canvas.height=1;}renderer.dispose();});
}catch(e){api.error=e.message;console.error('Slug3D:',e);window.dispatchEvent(new Event('slug3derror'));}
