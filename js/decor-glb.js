import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SlugCrowd,throwCrownTips} from './slug-crowd.js?v=glass2-throw1';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

// Visible WebGL canvas, not an atlas, snapshot, billboard or drawImage source.
// During the first acceptance gate only tidal_41 can be instantiated.
// Reports/realtime_pilot.json passed before opening this gate.
const RELEASE_ALL=true;
const api=window.DecorGLB={ready:false,error:null,viewRevision:0,stats:{fetches:0,parses:0,renders:0,reuses:0,culled:0,instances:0,drawCalls:0,triangles:0,cpuMs:0,textureCount:0,geometryCount:0},stage:RELEASE_ALL?'all-50':'single-41'};
const keys=Object.keys(TANK_DECOR).filter(k=>TANK_DECOR[k].model);
const enabled=k=>keys.includes(k)&&(RELEASE_ALL||k==='tidal_41');
const assetCache=new Map(),materialCache=new Map(),textureCache=new Map(),objects=new Map(),batches=new Map();
const ghostMaterials=new Map(),imageFingerprints=new WeakMap();
let slugCrowd=null,lastSlugRender=0,personFaces=[],furnitureKey='',peopleVersion=0,peopleFilled=-1,peopleRendered=-1,lastShopRender=0;
const loader=new GLTFLoader(),scene=new THREE.Scene(),content=new THREE.Group(),occluders=new THREE.Group();scene.add(content,occluders);
const camera=new THREE.OrthographicCamera(),thumbCamera=new THREE.PerspectiveCamera(32,1,.001,20);
let renderer,canvas,bgCanvas,bgContext,mode='',signature='',assetRevision=0,lastSize='',currentTank=null,nowFrame=0;
const v=new THREE.Vector3(),up=new THREE.Vector3(),right=new THREE.Vector3(),out=new THREE.Vector3(),ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const frustum=new THREE.Frustum(),projectionView=new THREE.Matrix4(),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion();
let shopJobs=[],slugJobs=[],thumbRecords=[],thumbDirty=true,thumbSignature='',lastTime=0;
const status=document.createElement('output');status.id='decorGLBStatus';status.setAttribute('role','status');document.querySelector('#ov .ov-body').append(status);
function fail(error){api.error=String(error.message||error);status.textContent='โหลดโมเดล 3D ไม่สำเร็จ: '+api.error+' — ไม่มีการใช้ภาพแทน';console.error('[DecorGLB]',error);}
// Match the game's original front-facing oblique projection exactly. The long
// front rim is horizontal; depth recedes by DEPX/DEPY, height uses the old ZH.
right.set(1,0,-DEPX/CELLW);up.set(0,ZH/CELLW,-DEPY/CELLW);out.crossVectors(right,up).normalize();
const cellM=CM_PER_CELL/100;
function world(fx,fy,z=0,target=v){return target.set((fx-curTank.def.w/2)*cellM,z*cellM,-(fy-curTank.def.h/2)*cellM);}
function project(fx,fy,z=0){return S(fx,fy,z);}
function updateCamera(){
 camera.matrixAutoUpdate=true;camera.matrixWorldAutoUpdate=true;
 const ppm=CELLW*tankCam.zoom/cellM;
 camera.near=.001;camera.far=100;camera.position.copy(out).multiplyScalar(20);camera.up.set(0,1,0);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 projectionView.set(2*ppm/TCW,0,-2*DEPX/CELLW*ppm/TCW,2*tankCam.ox/TCW-1,
  0,2*ZH/CELLW*ppm/TCH,-2*DEPY/CELLW*ppm/TCH,1-2*tankCam.oy/TCH,
  -.01*out.x,-.01*out.y,-.01*out.z,0,0,0,0,1);
 camera.projectionMatrix.multiplyMatrices(projectionView,camera.matrixWorld);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
 frustum.setFromProjectionMatrix(projectionView.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
}
api.projection='original-oblique';
api.projectPoint=(x,y,z)=>{updateCamera();const p=world(x,y,z,new THREE.Vector3()).project(camera);return{x:(p.x+1)*TCW/2,y:(1-p.y)*TCH/2};};
const oldFloor=tankFloorAt;tankFloorAt=function(mx,my){
 if(!api.ready||!tankMode)return oldFloor(mx,my);updateCamera();ray.setFromCamera(new THREE.Vector2(mx/TCW*2-1,1-my/TCH*2),camera);plane.constant=-SAND_CELLS*cellM;
 const hit=ray.ray.intersectPlane(plane,v);if(!hit)return{fx:0,fy:0};return{fx:THREE.MathUtils.clamp(v.x/cellM+curTank.def.w/2,0,curTank.def.w),fy:THREE.MathUtils.clamp(-v.z/cellM+curTank.def.h/2,0,curTank.def.h)};
};

async function digestTexture(texture,parser,textureIndex){
 const index=textureIndex??parser.associations.get(texture)?.textures;
 const definition=parser.json.textures?.[index],source=parser.json.images?.[definition?.source];
 if(source?.bufferView===undefined||!crypto.subtle)return null;
 let hashes=imageFingerprints.get(parser);if(!hashes){hashes=new Map();imageFingerprints.set(parser,hashes);}
 if(!hashes.has(source.bufferView))hashes.set(source.bufferView,(async()=>{
  const bytes=await parser.getDependency('bufferView',source.bufferView);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 })());
 texture.updateMatrix();
 return [await hashes.get(source.bufferView),texture.channel,texture.colorSpace,texture.wrapS,texture.wrapT,texture.flipY,texture.magFilter,texture.minFilter,...texture.matrix.elements].join('|');
}
async function loadAsset(key){
 if(!enabled(key))throw Error('โมเดลยังไม่เปิดใช้ก่อนผ่านการทดสอบชิ้นแรก: '+key);
 if(assetCache.has(key))return assetCache.get(key);
 const promise=(async()=>{
  api.stats.fetches++;const url=TANK_DECOR[key].model+'?surface=20260916pastel1';const gltf=await loader.loadAsync(url);api.stats.parses++;
  gltf.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3());
  const expected=TANK_DECOR[key].sizeCm;
  if(![size.x,size.y,size.z].every((n,i)=>Number.isFinite(n)&&Math.abs(n*100-expected[i])<.08))throw Error(key+': GLB scale does not match metric catalog');
  if(Math.abs(bounds.min.y)>.0002)throw Error(key+': bottom pivot is not on the ground');
  const meshes=[],decodedImages=new Set();gltf.scene.traverse(o=>{if(o.isMesh){meshes.push(o);for(const m of [].concat(o.material))for(const value of Object.values(m))if(value?.isTexture&&value.image)decodedImages.add(value.image);}});
  for(const mesh of meshes){
   const materials=[].concat(mesh.material),replacements=[];
   for(const mat of materials){
    // Baked unlit colours must not inherit the shared slug renderer's exposure.
    if(TANK_DECOR[key].unlit)mat.toneMapped=false;
    const md=gltf.parser.json.materials[gltf.parser.associations.get(mat)?.materials];
    const mapDefs={map:md?.pbrMetallicRoughness?.baseColorTexture,normalMap:md?.normalTexture,roughnessMap:md?.pbrMetallicRoughness?.metallicRoughnessTexture,metalnessMap:md?.pbrMetallicRoughness?.metallicRoughnessTexture,aoMap:md?.occlusionTexture};
    for(const prop of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(mat[prop]){
     const t=mat[prop],hash=await digestTexture(t,gltf.parser,mapDefs[prop]?.index);
     if(hash&&textureCache.has(hash)){mat[prop]=textureCache.get(hash);if(t!==mat[prop])t.dispose();}
     else if(hash)textureCache.set(hash,t);
    }
    const id=[mat.type,mat.name,mat.color.getHexString(),mat.emissive?.getHexString(),mat.roughness,mat.metalness,mat.vertexColors,mat.side,mat.transparent,mat.opacity,mat.alphaTest,mat.normalScale?.toArray(),...['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'].map(p=>mat[p]?.uuid)].join('|');
    if(materialCache.has(id)){replacements.push(materialCache.get(id));if(mat!==materialCache.get(id))mat.dispose();}
    else{materialCache.set(id,mat);replacements.push(mat);}
   }
   mesh.material=Array.isArray(mesh.material)?replacements:replacements[0];mesh.geometry.computeBoundingSphere();mesh.frustumCulled=true;mesh.castShadow=false;mesh.receiveShadow=false;
  }
  const retained=new Set([...textureCache.values()].map(t=>t.image));for(const mesh of meshes)for(const m of [].concat(mesh.material))for(const t of Object.values(m))if(t?.isTexture)retained.add(t.image);
  for(const bitmap of decodedImages)if(!retained.has(bitmap)&&bitmap.close)bitmap.close();
  const asset={root:gltf.scene,bounds,size,meshes,triangles:meshes.reduce((n,o)=>n+(o.geometry.index?.count||o.geometry.attributes.position.count)/3,0)};
  assetRevision++;status.textContent='';return asset;
 })();assetCache.set(key,promise);promise.catch(fail);return promise;
}
/* ---- โหลดล่วงหน้า: ของตกแต่งทุกชิ้นที่วางอยู่ในตู้ของร้าน + คอมไพล์ shader ไว้ก่อนเข้าตู้ ----
   ⚠️ 2026-09-17 เดิมโหลด GLB ตอนที่ของ "ถูกวาดครั้งแรก" เท่านั้น ตู้ที่ไม่อยู่ในจอหน้าร้านจึงไปโหลดตอนกดเข้าตู้
      วัดได้: 30 เฟรมแรกหลังเข้าตู้ใช้ 1.85 วิ (แตก GLB ทีละชิ้น + คอมไพล์ shader ~500ms บนเธรดหลัก)
   ตอนนี้ไล่โหลดทีละชิ้นตอนเบราว์เซอร์ว่าง (requestIdleCallback) แล้ว compileAsync ให้ GPU คอมไพล์ขนานไป ไม่บล็อกเฟรม
   เช็กทุก 3 วิแบบถูกมาก (ต่อสตริงคีย์) — ทำงานจริงเฉพาะตอนชุดของตกแต่งเปลี่ยน · ไม่ทำตอนแท็บซ่อน */
const idle=f=>typeof requestIdleCallback==='function'?requestIdleCallback(f,{timeout:2000}):setTimeout(f,60);
const warmedMaterials=new WeakSet();let preloadSig=null,preloading=false;
function ownedDecorKeys(){
 const set=new Set();if(typeof G==='undefined')return set;
 for(const o of G.objs||[])for(const d of o.decor||[])if(enabled(d.key))set.add(d.key);
 return set;
}
async function warmShaders(){
 const warm=new THREE.Scene(),made=[];
 for(const promise of assetCache.values()){
  const asset=await promise.catch(()=>null);if(!asset)continue;
  for(const mesh of asset.meshes){
   const mats=[].concat(mesh.material);if(mats.every(m=>warmedMaterials.has(m)))continue;
   /* ต้องเป็น InstancedMesh แบบเดียวกับ updateBatches() — โปรแกรม shader แยกตามการใช้ instancing */
   const m=new THREE.InstancedMesh(mesh.geometry,mesh.material,1);m.frustumCulled=false;warm.add(m);made.push(m);mats.forEach(x=>warmedMaterials.add(x));
  }
 }
 /* ทาก 3D ในตู้ใช้ SlugCrowd ของตัวนี้ — ถ้าหน้าร้านยังไม่เคยวาดทากสักตัว (ตู้อยู่นอกจอ) shader ของทากจะไปคอมไพล์ตอนเข้าตู้
    สร้างไว้ก่อนเลย (โครงเดียวกับ updateSlugCrowd) แล้วคอมไพล์พร้อมกัน */
 const source=window.Slug3D?.meshSource?.();let crowd=false;
 if(source&&!slugCrowd){slugCrowd=new SlugCrowd(source.template,scene,32);slugCrowd.update([],up,1);crowd=true;}
 if(made.length||crowd){
  try{
   if(made.length)await renderer.compileAsync(warm,camera,scene);   // ใช้ไฟชุดเดียวกับฉากจริง (จำนวนไฟอยู่ในคีย์ shader)
   if(crowd)await renderer.compileAsync(scene,camera);
  }catch(e){console.warn('[DecorGLB] warm shaders',e);}
 }
 for(const m of made)m.dispose();
 for(const t of textureCache.values())renderer.initTexture(t);         // ส่งเท็กซ์เจอร์ขึ้น GPU ตอนว่าง ไม่ใช่ตอนวาดเฟรมแรกในตู้
}
function preloadOwned(){
 if(!api.ready||preloading||document.hidden||window.BOOTING)return;
 const keys=ownedDecorKeys(),sig=[...keys].sort().join(',');if(sig===preloadSig)return;
 preloading=true;const list=[...keys].filter(k=>!assetCache.has(k));
 const next=()=>{
  if(document.hidden){preloading=false;return;}                     // ซ่อนแท็บกลางคัน = หยุด แล้วรอบหน้าค่อยต่อ (sig ยังไม่ถูกบันทึก)
  const key=list.shift();
  if(!key){warmShaders().finally(()=>{preloadSig=sig;preloading=false;});return;}
  loadAsset(key).catch(()=>{}).finally(()=>idle(next));
 };
 idle(next);
}
api.load=loadAsset;api.preload=preloadOwned;api.loadAll=async()=>{const remaining=keys.filter(enabled),results=[];await Promise.all(Array.from({length:4},async()=>{while(remaining.length){const key=remaining.shift();results.push(await loadAsset(key));}}));return results;};
function instance(id,key){
 let entry=objects.get(id);if(entry&&entry.key===key)return entry;
 if(entry){content.remove(entry.root);objects.delete(id);}
 if(!enabled(key))return null;
 entry={key,root:new THREE.Group(),ready:false,used:nowFrame};objects.set(id,entry);
 loadAsset(key).then(asset=>{if(objects.get(id)!==entry)return;const clone=asset.root.clone(true);entry.root.add(clone);entry.asset=asset;entry.ready=true;assetRevision++;}).catch(()=>{});return entry;
}
function prune(){for(const [id,e] of objects)if(e.used!==nowFrame){content.remove(e.root);objects.delete(id);}}
function updateBatches(){
 const groups=new Map();
 for(const [id,e] of objects){
  const translucent=id==='ghost'||(mode==='tank'&&id===dragDecor);
  if(translucent&&e.ready){
   if(!e.ghost){e.ghost=true;e.root.traverse(o=>{if(!o.isMesh)return;o.material=[].concat(o.material).map(m=>{let g=ghostMaterials.get(m);if(!g){g=m.clone();g.transparent=true;g.opacity=.45;g.depthWrite=false;ghostMaterials.set(m,g);}return g;});if(o.material.length===1)o.material=o.material[0];});}
   content.add(e.root);continue;
  }
  content.remove(e.root);
  if(!e.ready||!e.root.visible)continue;
  if(!groups.has(e.key))groups.set(e.key,[]);groups.get(e.key).push(e);
 }
 for(const [key,batch] of batches)if(!groups.has(key)){for(const m of batch.meshes){content.remove(m);m.dispose();}batches.delete(key);}
 for(const [key,entries] of groups){
  let batch=batches.get(key);
  if(!batch||batch.capacity<entries.length){
   if(batch)for(const m of batch.meshes){content.remove(m);m.dispose();}
   const capacity=2**Math.ceil(Math.log2(Math.max(1,entries.length)));
   batch={capacity,meshes:entries[0].asset.meshes.map(source=>{const m=new THREE.InstancedMesh(source.geometry,source.material,capacity);m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);content.add(m);return m;})};batches.set(key,batch);
  }
  for(let k=0;k<batch.meshes.length;k++){
   const mesh=batch.meshes[k],local=entries[0].asset.meshes[k].matrixWorld;mesh.count=entries.length;
   for(let i=0;i<entries.length;i++){matrix.multiplyMatrices(entries[i].root.matrixWorld,local);mesh.setMatrixAt(i,matrix);}
   mesh.instanceMatrix.needsUpdate=true;
  }
 }
}
function placeTank(d,id=d){const e=instance(id,d.key);if(!e)return;e.used=nowFrame;e.root.visible=e.ready;e.root.position.copy(world(d.fx,d.fy,SAND_CELLS,new THREE.Vector3()));e.root.rotation.set(0,(d.flip|0)*Math.PI/2,0);e.root.scale.setScalar(curTank.def.decorScale||1);e.root.updateMatrixWorld(true);if(e.ready){const b=e.asset.bounds.clone().applyMatrix4(e.root.matrixWorld);e.root.visible=frustum.intersectsBox(b);if(!e.root.visible)api.stats.culled++;}}
api.decorBox=(key,fx,fy,flip)=>{
 const entry=[...objects.values()].find(e=>e.key===key&&e.ready);if(!entry||!tankMode)return null;
 rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),(flip|0)*Math.PI/2);matrix.compose(world(fx,fy,SAND_CELLS,new THREE.Vector3()),rotation,new THREE.Vector3().setScalar(curTank.def.decorScale||1));
 const b=entry.asset.bounds,pts=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){v.set(x,y,z).applyMatrix4(matrix);const ppm=CELLW*tankCam.zoom/cellM;pts.push([tankCam.ox+v.dot(right)*ppm,tankCam.oy-v.dot(up)*ppm]);}
 return{x:Math.min(...pts.map(p=>p[0])),y:Math.min(...pts.map(p=>p[1])),w:Math.max(...pts.map(p=>p[0]))-Math.min(...pts.map(p=>p[0])),h:Math.max(...pts.map(p=>p[1]))-Math.min(...pts.map(p=>p[1]))};
};
const oldAt=decorAt;decorAt=function(mx,my){
 if(!api.ready||!tankMode)return oldAt(mx,my);updateCamera();ray.setFromCamera(new THREE.Vector2(mx/TCW*2-1,1-my/TCH*2),camera);
 const roots=[];for(const d of curTank.decor||[]){const e=objects.get(d);if(e?.ready){e.root.userData.decoration=d;roots.push(e.root);}}
 const hit=ray.intersectObjects(roots,true)[0];if(hit){let o=hit.object;while(o&&!o.userData.decoration)o=o.parent;return o?.userData.decoration||null;}
 const legacy=oldAt(mx,my);return legacy&&!TidalDecor.is(legacy.key)?legacy:null;
};

function viewportFor(element){const r=element.getBoundingClientRect();return{x:r.left,y:innerHeight-r.bottom,w:r.width,h:r.height};}
function setViewport(r){renderer.setViewport(r.x,r.y,r.w,r.h);renderer.setScissor(r.x,r.y,r.w,r.h);}
function sizeCanvas(){const key=innerWidth+'x'+innerHeight;if(key!==lastSize){lastSize=key;renderer.setSize(innerWidth,innerHeight,false);signature='';thumbDirty=true;}}
function clear(){renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.clear();renderer.setScissorTest(true);}
function stats(start){api.stats.renders++;api.stats.cpuMs=performance.now()-start;api.stats.drawCalls=renderer.info.render.calls;api.stats.triangles=renderer.info.render.triangles;api.stats.textureCount=renderer.info.memory.textures;api.stats.geometryCount=renderer.info.memory.geometries;api.stats.instances=objects.size;}
api.hide=()=>{if(canvas)canvas.style.display='none';if(bgCanvas)bgCanvas.style.display='none';signature='';};
function switchMode(next){if(mode!==next){mode=next;signature='';thumbDirty=true;(next==='tank'?document.querySelector('#ov .ov-body'):document.querySelector('.stage-wrap')).append(canvas);canvas.style.zIndex=next==='tank'?'9':'1';if(slugCrowd)slugCrowd.update([],up,1);}canvas.style.display=document.hidden?'none':'block';bgCanvas.style.display=next==='tank'&&!document.hidden?'block':'none';}
api.beginTank=()=>{
 if(!api.ready)return;switchMode('tank');nowFrame++;slugJobs=[];updateCamera();
 // แคชกรอบจอจาก tank-view.js (อ่าน layout ใหม่เฉพาะตอนขนาดเปลี่ยน) · เขียนสไตล์เฉพาะตอนค่าเปลี่ยน
 const r=tankCvRect(),box=r.left+'|'+r.top+'|'+r.width+'|'+r.height;
 if(bgCanvas._box!==box){bgCanvas._box=box;bgCanvas.style.left=r.left+'px';bgCanvas.style.top=r.top+'px';bgCanvas.style.width=r.width+'px';bgCanvas.style.height=r.height+'px';}
 if(bgCanvas.width!==tankCv.width||bgCanvas.height!==tankCv.height){bgCanvas.width=tankCv.width;bgCanvas.height=tankCv.height;}
 // Draw the existing tank chrome directly to its own layer: no full-frame copy.
 tctx=bgContext;
};
api.splitTankBackground=()=>{
 if(!api.ready)return;tctx=tankCv.getContext('2d');tctx.setTransform(DPR,0,0,DPR,0,0);
 tctx.clearRect(0,0,TCW,TCH);
};

// Share the game's existing animated slug mesh so decoration/slug occlusion uses real depth.
api.throwCrown=s=>{const p=throwCrownTips.get(s);return p&&curTank?{x:p.x/cellM+curTank.def.w/2,y:-p.z/cellM+curTank.def.h/2,z:p.y/cellM}:null;};
api.drawSlug=s=>{
 const source=window.Slug3D?.meshSource?.();if(!api.ready||!source||!Slug3D.enabled)return false;
 const scale=TANK_SLUG_VIEW_SCALE*(curTank.def.shopSlugScale||1)*slugCm(typeof foodGenes==='function'?foodGenes(s):s.genes)/100*(s._breedScale||1);
 const lifted=s===heldSlug;let fx=s.fx,fy=s.fy,z=SAND_CELLS+(s.climbZ||0),orient=null;
 if(s.wall&&!lifted){
  const left=s.wall!=='right',limits=slugWallLimits(s,curTank.def.w,curTank.def.h,curTank.def);fx=left?0:(curTank.def.breeder?20:curTank.def.w);z+=limits.half;
  const head=new THREE.Vector3(0,Math.sin(s.dir),-Math.cos(s.dir)),back=new THREE.Vector3(left?1:-1,0,0),side=new THREE.Vector3().crossVectors(head,back);
  orient=new THREE.Matrix4().makeBasis(head,back,side);
 }
 const p=project(fx,fy,z),len=scale*CELLW*tankCam.zoom/cellM;s._hit={x:p.x,y:p.y-len*.2,r:Math.max(20,len*.5)};
 if(p.x+len<0||p.x-len>TCW||p.y+len<0||p.y-len>TCH){api.stats.culled++;return true;}
 const pos=world(fx,fy,z,new THREE.Vector3());if(lifted)pos.addScaledVector(up,6*tankCam.zoom/(CELLW*tankCam.zoom/cellM));
 const worldMatrix=new THREE.Matrix4().makeScale(scale,scale,scale).setPosition(pos);
 slugJobs.push({s,heading:s._motionHeading??s.dir??0,basis:orient,lifted,worldMatrix});
 if(s.state==='sneeze')drawSneezeBubbles(s,p,len);
 if(!lifted&&!s.wall)drawSlugMood(s,p,len,null,p.y,1);
 if(s===selSlug){tctx.strokeStyle='#9fffdc';tctx.lineWidth=2;tctx.beginPath();tctx.ellipse(p.x,p.y,len*.5,len*.12,0,0,Math.PI*2);tctx.stroke();}
 return true;
};
function updateSlugCrowd(){
 const source=window.Slug3D?.meshSource?.();if(!source)return;
 if(!slugJobs.length&&!slugCrowd)return;
 if(!slugCrowd||slugCrowd.capacity<slugJobs.length){if(slugCrowd)slugCrowd.dispose();slugCrowd=new SlugCrowd(source.template,scene,Math.max(32,2**Math.ceil(Math.log2(Math.max(1,slugJobs.length)))));}
 /* tint ติดไปกับ job (ไม่ได้อยู่ใน worldPose) — หน้าร้านย้อมกระจก ส่วนโหมดดูตู้ไม่ส่งมา จึงไม่โดนย้อมซ้ำ */
 const jobs=slugJobs.map(j=>Object.assign(Slug3D.worldPose(j.s,j.heading,j.basis,j.lifted,j.worldMatrix),{tint:j.tint}));
 slugCrowd.update(jobs,up,1);api.stats.slugs=jobs.length;lastSlugRender=performance.now();
}
api.endTank=()=>{
 if(!api.ready||document.hidden||!tankMode)return;
 updateCamera();for(const d of curTank.decor||[])if(TidalDecor.is(d.key))placeTank(d);
 const ghost=dragDecor?dragGhost:decorHover,key=dragDecor?.key||(tankBuildMode?selDecorKey:null);
 if(ghost&&key&&enabled(key))placeTank({key,fx:ghost.fx,fy:ghost.fy,flip:dragDecor?.flip??placeFlip},'ghost');
 prune();
 const tr=tankCvRect(),r={x:tr.left,y:innerHeight-tr.bottom,w:tr.width,h:tr.height};sizeCanvas();
 /* ⚠️ 2026-09-20 ผู้เล่น: "เปลี่ยน 3D เป็น 2D แล้วตัวเก่ายังอยู่ ไม่ยอมรีเฟรช"
    ปิด 3D → slugJobs ว่าง → เงื่อนไขใช้แคชด้านล่างเป็นจริง (`!slugJobs.length`) และ sig ก็ไม่เปลี่ยน
    เพราะไม่มีอะไรในคีย์ที่บอกว่าโหมดเปลี่ยน → คืนทันทีโดยไม่เรนเดอร์ แคนวาส WebGL เลยค้าง
    เฟรมสุดท้ายที่ยังมีทาก 3D อยู่ ทับกับสไปรต์ 2D ที่เพิ่งกลับมาวาด
    (ทางกลับ 2D→3D ไม่เป็น เพราะ slugJobs กลับมามีของ เงื่อนไขแคชเลยไม่ติด)
    ใส่สถานะ 3D กับจำนวนงานลงคีย์ = พอสวิตช์แล้ว sig เปลี่ยน บังคับเรนเดอร์ล้างครั้งหนึ่ง */
 const sig=[mode,r.x,r.y,r.w,r.h,tankCam.ox,tankCam.oy,tankCam.zoom,assetRevision,(window.Slug3D?.enabled?1:0),slugJobs.length,...[...objects.values()].flatMap(e=>[e.key,...e.root.position.toArray(),e.root.rotation.y,e.root.scale.x,e.root.visible]),thumbSignature].join('|');
 if(sig===signature&&!thumbDirty&&(!slugJobs.length||performance.now()-lastSlugRender<33)){api.stats.reuses++;return;}signature=sig;
 const start=performance.now();updateBatches();updateSlugCrowd();renderer.info.reset();clear();occluders.visible=false;setViewport(r);renderer.render(scene,camera);renderThumbs();stats(start);
};

api.beginShop=()=>{if(!api.ready)return;switchMode('shop');nowFrame++;shopJobs=[];slugJobs=[];personFaces=[];};
api.queueShop=(tank,decor)=>{shopJobs.push({tank,decor});};
api.queueShowcase=(counter,key,x,y)=>{shopJobs.push({id:counter,key,position:[x*cellM,14.5*cellM,y*cellM],angle:-(counter.rot|0)*Math.PI/2});};
/* ---- ย้อมกระจกให้ทาก 3D ในหน้าร้าน ----
   ฝั่ง 2D มีชั้นกระจกทาบของในตู้อยู่แล้ว (isoBox ท้าย drawObject ของ shop-floor.js)
   แต่ทาก 3D เรนเดอร์คนละแคนวาสซึ่งซ้อนอยู่ "เหนือ" ชั้นนั้น เลยไม่โดนย้อม = คมเด่นโดดออกมาจากตู้
   ⛔ อย่าแก้ด้วยการวางระนาบกระจกลงในฉาก 3D — ลองมาแล้วพังหนัก:
      แคนวาส 3D โปร่งใสและไม่มีพื้นทราย/ตัวตู้อยู่ใน depth buffer ระนาบจะทาบลงบน "พื้นที่ว่าง" ทั้งตู้
      ไปซ้อนกับชั้นกระจก 2D อีกที = ย้อมสองชั้น ทั้งตู้จมฟ้า ทากหายไปเลย
   จึงคูณสีกระจกเข้าไปในตัวทากแทน — ไม่วาดพิกเซลเกินสักจุด และได้ความเข้มเท่าของ 2D (หน้ากระจก α .5) */
const glassTints=new Map();
function tankTint(def){
 let t=glassTints.get(def.glass);
 if(!t){
  const g=shadeRgb(hexToRgb(def.glass),-20);     // สีเดียวกับหน้ากระจกด้านหน้าที่ 2D ใช้
  /* ⚠️ 2026-09-18 amount .5 (ย้อมทับสีหลังแสงตกกระทบ) ทำให้ทากซีดขาวจนดูไม่ออกว่าตัวสีอะไร
     ชั้นกระจก 2D ในหน้าร้านใช้ alpha .32 (shop-floor.js isoBox) จึงใช้ค่าเดียวกัน ความเข้มจะได้เท่ากับของ 2D จริง ๆ */
  t={color:new THREE.Color().setRGB(g[0]/255,g[1]/255,g[2]/255,THREE.SRGBColorSpace),amount:.32};
  glassTints.set(def.glass,t);
 }
 return t;
}
/* ⚠️ รับเฉพาะทากบนพื้นทราย — ตัวที่เกาะกระจก (s.wall) คืน false ให้ shop-floor.js วาดต่อเอง
   เกมนี้มีกติกาท่าเกาะกระจกชุดเดียวใช้ทั้งเกม: slugWallPose() คิด "แกนบนจอ" (หัวไปตามแนวกำแพง
   หลังชี้เข้ากลางตู้เสมอ) แล้วให้ Slug3D หมุนในพิกัดกล้อง = ท่าด้านข้างเหมือนสไปรต์ 2D
   shop-floor.js มีทางนั้นครบอยู่แล้ว (ความสูงวัดจาก standH ถึงผิวน้ำ = หน่วยหน้าร้านถูกต้อง)
   เคยสร้าง basis "ท้องแปะกระจก" ตามฟิสิกส์ไว้ที่นี่แทน → บนกระจกฝั่งที่หันเข้ากล้องเลยโชว์ท้องเทาแบน ๆ
   มุมเพี้ยน และสูงผิดเพราะใช้ half หน่วยโหมดดูตู้ (×1.33) ตรง ๆ — บั๊กเดียวกับที่ shop-floor.js แก้ไปแล้ว
   ตัวเกาะกระจกที่ไปทางนั้นยังอยู่ใต้ชั้นกระจก 2D จึงโดนย้อมน้ำเองโดยไม่ต้องใช้ tint */
api.queueShopSlug=(tank,s)=>{
 if(!api.ready||!window.Slug3D?.ready||!Slug3D.enabled||s.wall)return false;
 const R=tank.rot|0,scale=(tank.def.shopSlugScale||1)*slugCm(typeof foodGenes==='function'?foodGenes(s):s.genes)/100*(s._breedScale||1);
 const p=localToFloor(tank.def,R,s.fx,s.fy),pos=new THREE.Vector3((tank.cx+p[0])*cellM,(tankStandH(tank.def)/ZUNIT+(s.climbZ||0))*cellM,(tank.cy+p[1])*cellM);
 const worldMatrix=new THREE.Matrix4().makeScale(scale,scale,scale).setPosition(pos);
 slugJobs.push({s,heading:(s._motionHeading??s.dir??0)-R*Math.PI/2,basis:null,lifted:false,worldMatrix,tint:tankTint(tank.def)});return true;
};
// Reuse the existing game's opaque face data for depth ONLY. These are not new
// decorations, visible primitives or substitutes for the Blender GLB meshes.
const depthMaterial=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,side:THREE.DoubleSide});
const furnitureDepth=new THREE.Mesh(new THREE.BufferGeometry(),depthMaterial),peopleDepth=new THREE.Mesh(new THREE.BufferGeometry(),depthMaterial);
furnitureDepth.renderOrder=peopleDepth.renderOrder=-10;furnitureDepth.frustumCulled=peopleDepth.frustumCulled=false;occluders.add(furnitureDepth,peopleDepth);
function fillDepth(mesh,faces){
 const needed=faces.reduce((n,f)=>n+(f.length-2)*9,0);let a=mesh.geometry.attributes.position;
 if(!a||a.array.length<needed){
  mesh.geometry.dispose();mesh.geometry=new THREE.BufferGeometry();
  const capacity=3*2**Math.ceil(Math.log2(Math.max(32,Math.ceil(needed/3))));
  a=new THREE.BufferAttribute(new Float32Array(capacity),3);a.setUsage(THREE.DynamicDrawUsage);mesh.geometry.setAttribute('position',a);
 }
 let i=0;for(const face of faces)for(let k=1;k<face.length-1;k++)for(const j of [0,k,k+1]){const p=face[j];a.array[i++]=p[0]*cellM;a.array[i++]=p[2]*cellM;a.array[i++]=p[1]*cellM;}
 mesh.geometry.setDrawRange(0,i/3);a.needsUpdate=true;mesh.visible=i>0;
}
/* ⚠️ 2026-09-22 ผู้เล่น: "เกมกระตุก แถมใช้พลังประมวลผลมากเกินไป"
   วัดได้: endShop กิน 13.6 ms/เฟรม เพราะเงื่อนไขข้ามเดิมนับ "มีคนอยู่ในจอ" เป็น "มีของอนิเมท"
   คนยืนนิ่งดูตู้เฉย ๆ จึงบังคับให้เรนเดอร์ฉาก Three.js ใหม่ทั้งฉากทุก 33 ms ตลอดเวลา
   (A/B ในฉากเดียวกัน: ปิดของที่อนิเมทแล้ว renders/reuses = 44/44 → 1/113 · drawFloor 9.08 → 3.83 ms)
   ตอนนี้ people.js ส่ง "เลขรุ่นเมชคน" มาด้วย — ขยับเฉพาะตอนท่าหรือตำแหน่งคนเปลี่ยนจริง
   เลขรุ่นอยู่ในลายเซ็นฉาก คนนิ่ง = ลายเซ็นไม่ขยับ = ข้ามได้จริง (ทาก 3D ยังคุมด้วยนาฬิกา 30Hz เหมือนเดิม) */
api.queuePeople=(groups,version)=>{personFaces=groups||[];peopleVersion=version|0;};
/* หน้าคนมาเป็นบล็อกสามเหลี่ยมสำเร็จรูปจาก people.js แล้ว (x,y,z,r,g,b ต่อจุด) พร้อมระยะเลื่อนของคนคนนั้น
   คัดลอกเฉพาะพิกัด ข้ามสี · ไม่ต้องไล่ตัดสามเหลี่ยมจากอาร์เรย์ซ้อนอาร์เรย์อีกรอบเหมือนเดิม */
function fillDepthGroups(mesh,groups){
 let needed=0;for(const g of groups)needed+=g.tris*9;
 let a=mesh.geometry.attributes.position;
 if(!a||a.array.length<needed){
  mesh.geometry.dispose();mesh.geometry=new THREE.BufferGeometry();
  const capacity=3*2**Math.ceil(Math.log2(Math.max(32,Math.ceil(needed/3))));
  a=new THREE.BufferAttribute(new Float32Array(capacity),3);a.setUsage(THREE.DynamicDrawUsage);mesh.geometry.setAttribute('position',a);
 }
 let i=0;const out=a.array;
 for(const g of groups){
  const v=g.verts,n=g.tris*3,dx=g.dx||0,dy=g.dy||0;
  for(let k=0,at=0;k<n;k++,at+=6){out[i++]=(v[at]+dx)*cellM;out[i++]=v[at+2]*cellM;out[i++]=(v[at+1]+dy)*cellM;}
 }
 mesh.geometry.setDrawRange(0,i/3);a.needsUpdate=true;mesh.visible=i>0;
}
function shopLayoutKey(){return G.objs.map(o=>[o.id,o===moving,o.cx,o.cy,o.rot,oW(o),oH(o),o.type==='tank'?tankStandH(o.def):decoH(o),!!o.def.playTable,!!o.def.researchTable]).flat().join('|');}
function updateShopOcclusion(key){
 if(key!==furnitureKey){furnitureKey=key;fillDepth(furnitureDepth,personFurnitureFaces());}
 /* เมชบังของคนเปลี่ยนเฉพาะตอนเลขรุ่นขยับ — รอบเรนเดอร์ที่เกิดจากทาก 3D ไม่ต้องยัดหน้าคนใหม่ทั้งชุด */
 if(peopleFilled!==peopleVersion){peopleFilled=peopleVersion;fillDepthGroups(peopleDepth,personFaces);}
}
function shopCamera(){
 // In world metres (x, y-up, z): floor P gives (x-z)*TW, (x+z)*TH-y*ZUNIT.
 // An exact orthographic projection matrix preserves the existing shop footprint.
 const r=viewportFor(cv),p=P(0,0,0),ppm=TW*cam.zoom/cellM;
 camera.position.set(0,0,0);camera.quaternion.identity();camera.matrixWorld.identity();camera.matrixWorldInverse.identity();
 camera.matrixAutoUpdate=false;camera.matrixWorldAutoUpdate=false;
 camera.projectionMatrix.set(2*ppm/r.w,0,-2*ppm/r.w,2*p.x/r.w-1,-2*TH/TW*ppm/r.h,2*ZUNIT/TW*ppm/r.h,-2*TH/TW*ppm/r.h,1-2*p.y/r.h,-.002,-.002,-.002,0,0,0,0,1);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
 frustum.setFromProjectionMatrix(camera.projectionMatrix);return r;
}
api.endShop=()=>{
 if(!api.ready||document.hidden||tankMode)return;
 const r=shopCamera();
 for(const job of shopJobs){const {tank,decor:d}=job,e=instance(job.id||d,job.key||d.key);if(!e)continue;e.used=nowFrame;
  if(job.position){e.root.position.fromArray(job.position);e.root.rotation.set(0,job.angle,0);e.root.scale.setScalar(1);}
  else{const p=localToFloor(tank.def,tank.rot|0,d.fx,d.fy);e.root.position.set((tank.cx+p[0])*cellM,tankStandH(tank.def)/ZUNIT*cellM,(tank.cy+p[1])*cellM);e.root.rotation.set(0,(d.flip-(tank.rot|0))*Math.PI/2,0);e.root.scale.setScalar(tank.def.decorScale||1);}
  e.root.visible=e.ready;e.root.updateMatrixWorld(true);if(e.ready){e.root.visible=frustum.intersectsBox(e.asset.bounds.clone().applyMatrix4(e.root.matrixWorld));if(!e.root.visible)api.stats.culled++;}}
 /* สถานะ 3D + จำนวนงานต้องอยู่ในคีย์ด้วย — เหตุผลเดียวกับใน endTank() ด้านบน */
 prune();sizeCanvas();const layout=shopLayoutKey(),sig=[mode,r.x,r.y,r.w,r.h,cam.x,cam.y,cam.zoom,assetRevision,layout,(window.Slug3D?.enabled?1:0),slugJobs.length,personFaces.length,...[...objects.values()].flatMap(e=>[e.key,...e.root.position.toArray(),e.root.rotation.y,e.root.visible])].join('|');
 /* แยกสองระดับให้ชัด (แก้ 2026-09-22 · ก่อนหน้านี้ใช้ "มีคนอยู่ในจอ" เป็นตัวตัดสิน = เรนเดอร์ใหม่ตลอด)
      hard = กล้อง/ผัง/ชุดโมเดลเปลี่ยน → ต้องเรนเดอร์เดี๋ยวนี้ ไม่งั้นภาพเลื่อนไม่ตรงกับแคนวาส 2D
      soft = แค่คนขยับหรือทาก 3D เดิน → เรนเดอร์ได้ แต่ไม่เกิน 30Hz (ตาเห็นเท่าเดิม ประหยัดครึ่งหนึ่ง)
      ไม่มีทั้งสองอย่าง = ข้ามจริง ๆ (ร้านนิ่ง = ศูนย์งาน ตามกฎ AGENTS.md ข้อ "ของนิ่งห้ามวาดซ้ำ") */
 const hard=sig!==signature, soft=peopleVersion!==peopleRendered||slugJobs.length>0;
 if(!hard&&(!soft||performance.now()-lastShopRender<33)){api.stats.reuses++;return;}
 signature=sig;lastShopRender=performance.now();peopleRendered=peopleVersion;const start=performance.now();updateBatches();updateSlugCrowd();updateShopOcclusion(layout);renderer.info.reset();clear();occluders.visible=true;setViewport(r);renderer.render(scene,camera);stats(start);
};

// One renderer draws visible catalog viewports directly into the WebGL canvas.
// No per-card WebGL contexts, PNG thumbnails, readback or image copies.
const thumbScene=new THREE.Scene(),thumbContent=new THREE.Group();thumbScene.add(thumbContent);
async function prepareThumb(key){if(thumbRecords.some(e=>e.key===key))return;const record={key,root:null};thumbRecords.push(record);try{const a=await loadAsset(key);record.root=a.root.clone(true);record.asset=a;thumbContent.add(record.root);record.root.visible=false;thumbDirty=true;}catch{};}
function renderThumbs(){
 const strip=document.getElementById('dpal'),clip=strip.getBoundingClientRect();
 if(!tankBuildMode||clip.width<=0||clip.height<=0){thumbDirty=false;return;}
 for(const node of document.querySelectorAll('.decorGLBPreview')){
  const key=node.dataset.modelKey;if(!enabled(key)||node.closest('[hidden]'))continue;const box=node.getBoundingClientRect();if(box.right<=clip.left||box.left>=clip.right||box.bottom<=clip.top||box.top>=clip.bottom)continue;
  prepareThumb(key);const record=thumbRecords.find(e=>e.key===key);if(!record?.root)continue;node.classList.add('ready');
  const size=record.asset.size,center=record.asset.bounds.getCenter(new THREE.Vector3()),distance=size.length()*1.65;
  thumbCamera.aspect=box.width/box.height;thumbCamera.position.copy(center).add(new THREE.Vector3(1,-.1,1).setY(.8).normalize().multiplyScalar(distance));thumbCamera.lookAt(center);thumbCamera.updateProjectionMatrix();
  const r=viewportFor(node),sc={x:Math.max(r.x,clip.left),y:r.y,w:Math.min(box.right,clip.right)-Math.max(box.left,clip.left),h:r.h};
  renderer.setViewport(r.x,r.y,r.w,r.h);renderer.setScissor(sc.x,sc.y,sc.w,sc.h);renderer.clearDepth();record.root.visible=true;renderer.render(thumbScene,thumbCamera);record.root.visible=false;
 }thumbDirty=false;
}
function markThumbs(){thumbDirty=true;thumbSignature=String(performance.now());}
document.getElementById('dpal').addEventListener('scroll',markThumbs,{passive:true});
document.getElementById('tankDecorDock')?.addEventListener('click',markThumbs);

const style=document.createElement('style');style.textContent=`
 #decorGLBCanvas{position:fixed;inset:0;pointer-events:none;z-index:1;background:transparent}
 #decorTankBackground{position:fixed;pointer-events:none;z-index:0}
 #ov #tankCv{position:relative;z-index:10;background:transparent!important}
 #ov .ov-top,#ov .tank-side,#ov .mobileTankBar,#ov .mobileTankZoom{z-index:12}
 #ov .ov-body.decor-open #tankDecorDock{z-index:8!important}
 #ov .ov-body:not(.decor-open) #tankDecorDock{z-index:12}
 #ov .ov-top{position:relative}#decorGLBStatus{position:absolute;top:60px;left:15px;z-index:8;color:#ffc9a8;background:#142b2e}
 #tankDecorDock .decorGLBPreview{display:flex;align-items:center;justify-content:center;height:54px;flex:0 0 54px;width:100%;pointer-events:none;color:#90b9ae;font-size:12px}#tankDecorDock .decorGLBPreview::after{content:'GLB · 3D'}
 #tankDecorDock .decorGLBPreview.ready::after{content:''}
 `;document.head.append(style);

// Keep all original economy/save handlers. Gate cards until the first GLB passes.
for(const b of document.querySelectorAll('#dpal .dbtn'))if(TidalDecor.is(b.dataset.key)&&!enabled(b.dataset.key)){b.disabled=true;b.title='รอทดสอบ GLB ชิ้นแรกก่อนเปิดทั้งชุด';}
const originalEnter=enterTank;enterTank=function(...args){currentTank=args[0];api.viewRevision++;signature='';return originalEnter(...args);};
const originalExit=exitTank;exitTank=function(...args){bgCanvas&&(bgCanvas.style.display='none');signature='';return originalExit(...args);};
// ovBack retains the original handler reference; observe state in beginShop too.
api.inspect=()=>({stage:api.stage,ready:api.ready,error:api.error,loaded:[...assetCache.keys()],textures:textureCache.size,materials:materialCache.size,batches:[...batches.entries()].map(([key,b])=>({key,instances:b.meshes[0]?.count,draws:b.meshes.length,capacity:b.capacity})),objects:[...objects.values()].map(e=>({key:e.key,ready:e.ready,visible:e.root.visible,position:e.root.position.toArray(),rotation:e.root.rotation.y,scale:e.root.scale.x,meshes:e.asset?.meshes.length,triangles:e.asset?.triangles})),slugGenes:slugCrowd?.parts.filter(p=>p.colors.geneBase).map(p=>({name:p.name,count:p.mesh.count,base:[...p.colors.geneBase.array.slice(0,p.mesh.count*3)],rank:p.rank,matricesFinite:p.mesh.instanceMatrix.array.every(Number.isFinite)})),stats:{...api.stats}});

try{
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false});canvas=renderer.domElement;canvas.id='decorGLBCanvas';renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.autoClear=false;renderer.info.autoReset=false;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=0.85;
 bgCanvas=document.createElement('canvas');bgCanvas.id='decorTankBackground';bgContext=bgCanvas.getContext('2d');document.querySelector('#ov .ov-body').append(bgCanvas);document.body.append(canvas);
 /* ⚠️ ไฟกับ exposure ต้องเท่ากับชุดใน slug-3d.js เสมอ — ที่นั่นคือ "ชุดอ้างอิง" ที่สีผิวทาก (slug-skin.js) ถูกจูนมา
    เดิมที่นี่ตั้ง exposure 1.1 + hemi .8 (สว่างกว่าชุดอ้างอิง ~2 เท่าเมื่อรวมกัน) พอทากถูกย้ายมาวาดด้วย
    เรนเดอร์ตัวนี้แทน atlas ของ slug-3d (queueShopSlug/drawSlug) ACES เลยดันสีขึ้นไปช่วงที่มันคายความอิ่มตัวทิ้ง
    = ทากสีพาสเทล (ยีนเริ่มต้น mainC 200 "ขาว") ออกมาขาวล้วน ผู้เล่นอ่านว่า "ยีนสีไม่แสดงผล"
    ถ้าจะแก้ความสว่างของของตกแต่ง ให้ไปแก้ที่วัสดุของมัน อย่าดันค่าสองตัวนี้ขึ้นอีก */
 const hemi=new THREE.HemisphereLight(0xdaf1f3,0x776448,.4);scene.add(hemi);thumbScene.add(hemi.clone());const light=new THREE.DirectionalLight(0xfff1df,2);light.position.set(-2,4,3);scene.add(light);thumbScene.add(light.clone());
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);scene.environment=thumbScene.environment=environment.texture;room.dispose();pmrem.dispose();
 api.ready=true;sizeCanvas();setInterval(preloadOwned,3000);idle(preloadOwned);status.textContent=RELEASE_ALL?'':'GLB real-time · ทดสอบไหโบราณแตกก่อน';
 const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');api.hardware={renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),dpr:renderer.getPixelRatio()};
 window.addEventListener('resize',()=>{signature='';thumbDirty=true;});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){canvas.style.display='none';bgCanvas.style.display='none';}else{signature='';thumbDirty=true;}});
 window.addEventListener('pagehide',()=>{slugCrowd?.dispose();furnitureDepth.geometry.dispose();peopleDepth.geometry.dispose();depthMaterial.dispose();for(const b of batches.values())for(const m of b.meshes)m.dispose();for(const m of ghostMaterials.values())m.dispose();renderer.dispose();environment.dispose();const bitmaps=new Set();for(const t of textureCache.values()){bitmaps.add(t.image);t.dispose();}for(const b of bitmaps)b?.close?.();for(const m of materialCache.values())m.dispose();for(const promise of assetCache.values())promise.then(a=>a.meshes.forEach(m=>m.geometry.dispose())).catch(()=>{});});
}catch(e){fail(e);}
