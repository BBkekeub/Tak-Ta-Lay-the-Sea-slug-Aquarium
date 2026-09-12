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
 // Irregular ring spots on the mantle, kept behind the face.
 for(int i=0;i<8;i++){
  if(float(i)>=geneTraits.y)break;
  float k=float(i);vec2 q=vec2(-.30+k*.081,sin(k*2.31)*.10);
  float radius=.019+.008*(.5+.5*sin(k*3.7));
  vec2 uv=(p.xz-q)/radius;
  float metric=geneTraits.z<.5?length(uv):geneTraits.z<1.5?max(abs(uv.x),abs(uv.y)):max(abs(uv.x)*.866+uv.y*.5,-uv.y);
  float d=metric+(grain(p*1.3)-.5)*.10;
  float spot=(1.0-smoothstep(.88,1.05,d))*smoothstep(.075,.14,p.y);
  c=mix(c,mix(blue,ice,smoothstep(.53,.75,d)),spot*.58);
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

