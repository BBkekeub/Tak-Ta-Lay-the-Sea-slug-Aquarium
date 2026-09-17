import * as THREE from 'three';
const mantlePattern=await new THREE.TextureLoader().loadAsync('assets/slug3d/mantle-pattern.png?v=5');
window.addEventListener('pagehide',()=>mantlePattern.dispose(),{once:true});

// Bind the pattern to undeformed mesh coordinates, before skinning/morphing.
// Body, rhinophores and every gill share one palette; no extra geometry or textures per frame.
export function applySlugSkin(root){
 const old=new Set();
 root.traverse(o=>{
  if(!o.isMesh)return;
  for(const m of [].concat(o.material))old.add(m);
  o.geometry.computeBoundingBox();
  const b=o.geometry.boundingBox,body=o.name==='Body',horn=o.name==='rhino_base';
  if(body)smoothSurfaceNormals(o.geometry);

  const material=body?new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.48,metalness:0,clearcoat:.8,clearcoatRoughness:.20,ior:1.36,envMapIntensity:.4}):new THREE.MeshStandardMaterial({color:0xffffff,roughness:.38,metalness:0,envMapIntensity:.3});
  material.name=body?'Pearl blue with eyes':horn?'Blue rhinophores':'Blue feather gills';
  material.userData.palette={geneBase:{value:new THREE.Color()},geneAcc:{value:new THREE.Color()},geneDark:{value:new THREE.Color()},geneLight:{value:new THREE.Color()}};
  material.onBeforeCompile=function(shader){
   Object.assign(shader.uniforms,this.userData.palette);
   if(!body){
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float gillRelief;varying float vGillRelief;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGillRelief=gillRelief;');
    shader.fragmentShader='varying float vGillRelief;\n'+shader.fragmentShader;
   }
   if(body)shader.uniforms.mantlePattern={value:mantlePattern};
   shader.uniforms.geneTraits={value:new THREE.Vector4(.5,4,0,.45)};
   shader.uniforms.skinLow={value:b.min.y};shader.uniforms.skinHigh={value:b.max.y};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 skinRest;');
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nskinRest=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 skinRest;
uniform float skinLow,skinHigh;
uniform vec3 geneBase,geneAcc,geneDark,geneLight;
uniform vec4 geneTraits;
${body?'uniform sampler2D mantlePattern;':''}
float disk(vec2 p,vec2 c,vec2 r){return 1.0-smoothstep(.86,1.0,length((p-c)/r));}
float grain(vec3 p){return sin(p.x*91.0+sin(p.z*53.0))*sin(p.y*117.0+p.z*63.0)*.5+.5;}
/* ผัง 8 ลาย (u,v,r) พอร์ตตรงจาก SPOT_SLOTS ใน slug-engine.js (สั่งจัดมือ 2026-09-02) เป๊ะ ๆ
   ห้ามแก้ตัวเลขที่นี่แยกจากไฟล์นั้น — ยีนตัวเดียวกันต้องได้ลายเดียวกันทั้ง 2D และ 3D */
vec3 spotSlot(int i){
 if(i==0)return vec3(0.2927,0.3443,0.1445);
 if(i==1)return vec3(0.4526,0.6583,0.1445);
 if(i==2)return vec3(0.5584,0.2853,0.1183);
 if(i==3)return vec3(0.6889,0.5692,0.0928);
 if(i==4)return vec3(0.3783,0.5303,0.0647);
 if(i==5)return vec3(0.4559,0.2853,0.0623);
 if(i==6)return vec3(0.6278,0.4245,0.0534);
 return vec3(0.7584,0.6416,0.0519);
}
// สูตรสุ่มคงที่เดียวกับ SPOT_SLOTS.forEach ในไฟล์ 2D เป๊ะ ๆ (i คือลำดับหลัง sort r มาก→น้อย)
float spotHash(float i,float n){float x=sin((i+1.0)*n)*43758.5453;return x-floor(x);}
vec3 skinColor(){
 vec3 pearl=geneBase,blue=geneDark,ice=geneAcc,ink=vec3(.002,.006,.009);
 vec3 p=skinRest;
 ${body?`
 vec3 c=pearl*(.90+.10*smoothstep(.02,.24,p.y));
 c*=.965+.035*grain(p);
 float edge=1.0-smoothstep(.045,.09,p.y);
 c=mix(c,ice,edge*.26);
 // Reference mantle: pale outer ribbon, dark curved border and tapered dorsal line.
 float strength=sqrt(clamp(geneTraits.w,0.,1.));
 vec2 mantleUV=vec2((p.x+.55)/1.10,1.-(p.z+.31)/.62);
 vec2 painted=texture2D(mantlePattern,mantleUV).rg;
 float topMask=smoothstep(-.008,.012,p.y);
 vec3 paleRim=mix(geneBase,vec3(.94,.97,1.),.78);
 c=mix(c,paleRim,painted.g*topMask*strength);
 vec3 stripeInk=mix(vec3(.002,.004,.012),geneBase*.055,.25);
 c=mix(c,stripeInk,painted.r*topMask*strength);
 /* ลาย 8 ดวง — ตำแหน่ง/รัศมี/มุมเอียง มาจาก SPOT_SLOTS จริงของ 2D ไม่ใช่สูตรสุ่มแยกต่างหาก
    เติมดวงใหญ่→เล็กตามลำดับเดียวกับ spotPlan() (geneTraits.y = nSpot)
    2D เห็นแค่ฝั่งเดียวเพราะกล้องคงที่ — ตัวจริงสมมาตรซ้าย-ขวา จึงพลิก z แปะอีกชุดคนละฝั่ง
    รวมเป็น nSpot*2 ดวงทั้งตัว ต่างจาก 2D ที่นับได้แค่ nSpot ดวงเดียว */
 for(int i=0;i<8;i++){
  if(float(i)>=geneTraits.y)break;
  vec3 slot=spotSlot(i);
  // (u,v) เศษส่วนของผ้าใบวาดตัว 2D → พิกัดโลคัลของเมช 3D ผ่านกรอบเดียวกับ mantleUV ด้านล่าง
  vec2 qBase=vec2(slot.x*1.10-.55,(1.0-slot.y)*.62-.31);
  float jr=spotHash(float(i),12.9898)*2.0-1.0, js=spotHash(float(i),78.233);
  float radius=slot.z*.62*1.2*(.92+js*.16);   // *1.2 = หนาขึ้นจากเดิมหน่อยตามที่สั่ง
  float tiltDeg=geneTraits.z<.5?6.0:geneTraits.z<1.5?34.0:44.0;   // SPOT_TILT ต่อรูปทรง (circle/sq/tri)
  float tilt=tiltDeg*jr*3.14159265/180.0, ct=cos(tilt), st=sin(tilt);
  for(int side=0;side<2;side++){
   vec2 q=vec2(qBase.x, side==0?qBase.y:-qBase.y);
   vec2 rel=(p.xz-q)/radius;
   vec2 uv=vec2(rel.x*ct-rel.y*st, rel.x*st+rel.y*ct);
   float metric=geneTraits.z<.5?length(uv):geneTraits.z<1.5?max(abs(uv.x),abs(uv.y)):max(abs(uv.x)*.866+uv.y*.5,-uv.y);
   float dd=metric+(grain(p*1.3)-.5)*.10;
   float spot=(1.0-smoothstep(.85,1.0,dd))*smoothstep(.075,.14,p.y);
   // สีเดียวกับหงอน (blue/ice = geneDark/geneAcc จาก accC) แค่คูณมืดลงให้เห็นชัดบนพื้นลำตัว
   c=mix(c,mix(blue*.55,ice*.55,smoothstep(.53,.75,dd)),spot*.75);
  }
 }
 // Two eyes painted onto the head surface, not floating objects.
 float front=smoothstep(.07,.115,p.y);
 float eye=disk(vec2(p.x,abs(p.z)),vec2(.435,.077),vec2(.019,.020))*front;
 c=mix(c,ink,eye*0.0);
 float gleam=disk(vec2(p.x,abs(p.z)),vec2(.438,.072),vec2(.004,.004))*front;
 c=mix(c,vec3(.94,1.,1.),gleam*0.0);
 return c;`
 :`
 float h=clamp((p.y-skinLow)/max(.001,skinHigh-skinLow),0.,1.);
 vec3 c=mix(geneBase,blue,smoothstep(.02,.4,h));
 c=mix(c,ice,smoothstep(.30,.80,h));
 float whiten=mix(.02,1.,clamp(geneTraits.w,0.,1.));
 c=mix(c,geneLight,smoothstep(.85,1.0,h)*.22*whiten);
 // Bright leaf ridges and dark recesses, derived from this part's geometry.
 float ridge=smoothstep(.02,.65,vGillRelief);
 float recess=smoothstep(.02,.50,-vGillRelief);
 vec3 paleLeaf=mix(geneAcc,vec3(.94,.97,.93),.65);
 c=mix(c,paleLeaf,(.48+recess*.30)*whiten);
 c=mix(c,mix(geneAcc*.32,geneDark,.4),ridge*.78);
 return c;`}
}

`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor *= mix(1.18,.78,geneTraits.x);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb *= skinColor();');
  };
  material.customProgramCacheKey=()=>body?'slug-pearl-eyes-v2':horn?'slug-horn-blue-v2':'slug-gill-blue-v2';
  o.material=material;
 });
 // Imported images are no longer used by this trial skin.
 const textures=new Set();for(const m of old){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}
 for(const t of textures){t.source?.data?.close?.();t.dispose();}
}

export function addSlugEyes(root,data){
 const head=root.getObjectByName('Head');
 if(!head||data.eyes.length!==2)throw new Error('Missing edited eyes or head');
 root.updateMatrixWorld(true);
 const material=new THREE.MeshPhysicalMaterial({color:0x061316,roughness:.16,clearcoat:1,clearcoatRoughness:.10,envMapIntensity:1.2});
 // Preserve the artist's mesh and world placement, then bind to the animated head.
 for(const source of data.eyes){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(source.positions,3));
  geometry.setIndex(source.indices);
  geometry.applyMatrix4(head.matrixWorld.clone().invert());
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const eye=new THREE.Mesh(geometry,material);eye.name=source.name;head.add(eye);
 }
 /* ---- ตา ＞＜ ตอนออกแรง (ชักเย่อ) — เมชใหม่เฉพาะอีเวนต์ วางทับตาจริงแต่ละข้าง ----
    สร้างจากกรอบของตาที่ศิลปินปั้นไว้ (edited-eyes.json) ตำแหน่ง/ขนาดจึงตามตาเดิมเป๊ะ ไม่ต้องเดาพิกัด
    รูป ＞ อยู่ในระนาบ x-y (x = ทางหัว, y = ขึ้น) ปลายแหลมชี้ไปทางหัว — ฝั่งเราหันขวา คู่แข่งหันซ้าย
    บนจอเลยกลายเป็น ＞＜ หันเข้าหากันพอดี
    ปกติซ่อน (slug-crowd.js ย่อเป็นศูนย์) · โผล่เฉพาะตัวที่ v.strain (slug-3d.js ← s.tugStrain) พร้อมบีบตาจริงให้แบน
    ⚠️ ชื่อต้องขึ้นต้น EyeStrain_ ไม่ใช่ Eye_ — ชื่อ Eye_ ถูกย่อตาม eyeOpen (ตากะพริบ) ใน slug-crowd.js */
 const box=(L,t,d,ang,x,y)=>{const g=new THREE.BoxGeometry(L,t,d);g.rotateZ(ang);g.translate(x,y,0);return g;};
 for(const source of data.eyes){
  const p=source.positions,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[i+k]);max[k]=Math.max(max[k],p[i+k]);}
  const sx=max[0]-min[0],sy=max[1]-min[1],sz=max[2]-min[2];
  /* ใหญ่ราว 2 เท่าของตาจริง + เส้นหนา — เทสต์แล้วขนาดเท่าตาเดิม (~3 px บนจอในตู้) มองเป็นแค่จุดดำ อ่านไม่ออกว่าเป็น ＞ */
  const a=sx*1.5,b=sy*1.05,t=sy*.34,depth=sz*2;             // ครึ่งความกว้าง · ครึ่งความสูง · ความหนาเส้น · ความลึก
  /* แขนสองข้างของ ＞ : จากปลายแหลม (a,0) ไปปลายแขน (−a,±b) — กล่องบาง ๆ หมุนตามแนวแขน */
  const arms=[1,-1].map(sgn=>{const dx=-2*a,dy=sgn*b;return box(Math.hypot(dx,dy)+t,t,depth,Math.atan2(dy,dx),a+dx/2,dy/2);});
  const n0=arms[0].attributes.position.count,geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([...arms[0].attributes.position.array,...arms[1].attributes.position.array],3));
  geometry.setIndex([...arms[0].index.array,...Array.from(arms[1].index.array,i=>i+n0)]);
  arms.forEach(g=>g.dispose());
  /* ดันออกนอกหัวนิดหน่อยตามด้านของตา (z) — ตัวใหญ่ขึ้นแล้วแขนจะจมหายเข้าไปในผิวหัวที่โค้งออก */
  const cz=(min[2]+max[2])/2;
  geometry.translate((min[0]+max[0])/2,(min[1]+max[1])/2,cz+Math.sign(cz)*sz*.3);
  geometry.applyMatrix4(head.matrixWorld.clone().invert());
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const strain=new THREE.Mesh(geometry,material);strain.name='EyeStrain_'+source.name.replace(/^Eye_/,'');head.add(strain);
 }
}

function smoothSurfaceNormals(g){
 const p=g.attributes.position,index=g.index,keys=[];
 for(let i=0;i<p.count;i++)keys.push([p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(','));
 function normals(delta){
  const sums=new Map(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
  const point=(i,v)=>{v.fromBufferAttribute(p,i);if(delta)v.add(new THREE.Vector3().fromBufferAttribute(delta,i));};
  for(let t=0;t<(index?index.count:p.count);t+=3){
   const ids=[0,1,2].map(k=>index?index.getX(t+k):t+k);point(ids[0],a);point(ids[1],b);point(ids[2],c);
   ab.subVectors(b,a);ac.subVectors(c,a);ab.cross(ac);
   for(const i of ids){if(!sums.has(keys[i]))sums.set(keys[i],new THREE.Vector3());sums.get(keys[i]).add(ab);}
  }
  for(const n of sums.values())n.normalize();
  const values=new Float32Array(p.count*3);for(let i=0;i<p.count;i++)sums.get(keys[i]).toArray(values,i*3);
  return values;
 }
 const base=normals(null);g.setAttribute('normal',new THREE.BufferAttribute(base,3));
 if(g.morphTargetsRelative&&g.morphAttributes.position)g.morphAttributes.normal=g.morphAttributes.position.map(delta=>{
  const values=normals(delta);for(let i=0;i<values.length;i++)values[i]-=base[i];return new THREE.BufferAttribute(values,3);
 });
}


export function updateSlugPalette(root,genes){
 const d=SlugEngine.derived(genes),color=rgb=>new THREE.Color(SlugEngine.hex(rgb));
 const palette={geneBase:color(d.base),geneAcc:color(d.acc),geneDark:color(d.matA.d),geneLight:color(d.matA.l)};
 root.traverse(o=>{const p=o.material?.userData?.palette;if(!p)return;for(const k of Object.keys(palette))p[k].value.copy(palette[k]);o.material.metalness=0;});
}

