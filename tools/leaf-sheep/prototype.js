import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const $=id=>document.getElementById(id),view=$('view');
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));view.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#eff3e8');
const camera=new THREE.PerspectiveCamera(35,1,.01,30);camera.position.set(1.05,.72,1.6);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.18,0);controls.minDistance=.65;controls.maxDistance=4;controls.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight(0xffffff,0x9aa67b,2));const light=new THREE.DirectionalLight(0xfff4dd,2.5);light.position.set(0,3,3);scene.add(light);
const group=new THREE.Group();scene.add(group);let leaves,raf=0,visible=true,builds=0,ready=false;
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.68});
material.onBeforeCompile=s=>{s.uniforms.leafTime={value:0};s.uniforms.leafMotion={value:0};material.userData.shader=s;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float leafTime;uniform float leafMotion;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z += leafMotion * .009 * sin(leafTime*1.8+position.x*13.0) * smoothstep(.12,.48,position.y);');};
function draw(t=0){raf=0;if(document.hidden||!visible)return;const s=material.userData.shader;if(s){s.uniforms.leafTime.value=t/1000;s.uniforms.leafMotion.value=$('motion').checked?1:0;}renderer.render(scene,camera);if(ready)$('stats').textContent=`${$('count').value} ใบ · ${leaves.geometry.index.count/3} สามเหลี่ยมใบ · 1 เมชใบ / วาด ${renderer.info.render.calls} ครั้งรวมตัว`;if($('motion').checked)requestDraw();}
function requestDraw(){if(!raf&&!document.hidden&&visible)raf=requestAnimationFrame(draw);}
const resize=new ResizeObserver(()=>{const w=view.clientWidth,h=view.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();requestDraw();});resize.observe(view);
const observer=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(!visible){cancelAnimationFrame(raf);raf=0;}else requestDraw();});observer.observe(view);
controls.addEventListener('change',requestDraw);document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);raf=0;requestDraw();});
try{
 const [gltf,lod,eyes]=await Promise.all([new GLTFLoader().loadAsync('../../assets/slug3d/slug-behaviors.glb'),fetch('../../assets/slug3d/slug-lod.json').then(r=>r.json()),fetch('../../assets/slug3d/edited-eyes.json').then(r=>r.json())]);
 const root=gltf.scene;root.updateMatrixWorld(true);const bodySource=root.getObjectByName('Body');const bodyBox=new THREE.Box3().setFromObject(bodySource),center=bodyBox.getCenter(new THREE.Vector3()),scale=1/(bodyBox.max.x-bodyBox.min.x);
 const normalization=new THREE.Matrix4().makeScale(scale,scale,scale);normalization.setPosition(-center.x*scale,-bodyBox.min.y*scale,-center.z*scale);
 const white=new THREE.MeshStandardMaterial({color:0xfff9eb,roughness:.65});let body;
 root.traverse(o=>{if(!o.isMesh||/gill|eye/i.test(o.name))return;const src=lod[o.name.replace(/\./g,'')];let g;if(src){g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(src.position,3));g.setIndex(src.index);}else g=o.geometry.clone();g.applyMatrix4(o.matrixWorld).applyMatrix4(normalization);g.computeVertexNormals();const mesh=new THREE.Mesh(g,white);mesh.name=o.name;group.add(mesh);if(o===bodySource)body=mesh;});
 const eyeMat=new THREE.MeshStandardMaterial({color:0x142326,roughness:.3});for(const e of eyes.eyes){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(e.positions,3));g.setIndex(e.indices);g.applyMatrix4(normalization);g.computeVertexNormals();group.add(new THREE.Mesh(g,eyeMat));}
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),yAxis=new THREE.Vector3(0,1,0);
 function build(){const positions=[],colors=[],indices=[],green=new THREE.Color($('color').value),cream=new THREE.Color('#fff4cf'),dark=green.clone().multiplyScalar(.65);const count=+$('count').value,pairs=count/2,factor=+$('length').value/100;
  group.updateMatrixWorld(true);body.updateMatrixWorld(true);
  // Coordinates are normalized body space; cast before display rotation.
  const saved=group.rotation.y;group.rotation.y=0;group.updateMatrixWorld(true);
  for(let i=0;i<pairs;i++)for(const side of [-1,1]){const u=i/(pairs-1),x=-.37+u*.62,z=side*(.045+.085*Math.sin(Math.PI*u))*(i%2?.65:1);ray.set(new THREE.Vector3(x,1,z),down);const hit=ray.intersectObject(body)[0];const base=hit?hit.point.y-.012:.1;
   const height=(.14+.105*Math.sin(Math.PI*u)) *factor,width=.045+.016*Math.sin(Math.PI*u),lean=new THREE.Quaternion().setFromUnitVectors(yAxis,new THREE.Vector3(-.25,.92,side*(i%2?.28:.62)).normalize());const offset=positions.length/3;
   const points=[new THREE.Vector3(0,0,0)];for(let k=0;k<8;k++){const a=k*Math.PI/4;points.push(new THREE.Vector3(Math.cos(a)*width,height*.48,Math.sin(a)*width*.50));}points.push(new THREE.Vector3(0,height,0));
   points.forEach((p,k)=>{p.applyQuaternion(lean).add(new THREE.Vector3(x,base,z));positions.push(p.x,p.y,p.z);const c=k===0?dark:k===9?cream:green;colors.push(c.r,c.g,c.b);});
   for(let k=0;k<8;k++){const a=offset+1+k,b=offset+1+(k+1)%8;indices.push(offset,a,b,offset+9,b,a);}
  }
  group.rotation.y=saved;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();if(leaves){leaves.geometry.dispose();leaves.geometry=g;}else{leaves=new THREE.Mesh(g,material);leaves.name='LeafCrown';group.add(leaves);}builds++;requestDraw();
 }
 build();ready=true;window.LeafStudy={get builds(){return builds},get triangles(){return leaves.geometry.index.count/3},get calls(){return renderer.info.render.calls},get frames(){return renderer.info.render.frame},group,leaves,requestDraw};
 for(const id of ['count','length','color'])$(id).addEventListener('input',build);
 $('wire').onchange=()=>{material.wireframe=$('wire').checked;requestDraw();};$('motion').onchange=requestDraw;
 $('turn').onclick=()=>{group.rotation.y+=Math.PI/2;requestDraw();};$('reset').onclick=()=>{group.rotation.y=0;camera.position.set(1.05,.72,1.6);controls.target.set(0,.18,0);controls.update();requestDraw();};
 // Source assets are no longer needed after the static body is extracted.
 const disposed=new Set();root.traverse(o=>{if(!o.isMesh)return;o.geometry.dispose();for(const m of [].concat(o.material)){if(disposed.has(m))continue;disposed.add(m);for(const v of Object.values(m))if(v?.isTexture&&!disposed.has(v)){disposed.add(v);v.dispose();}m.dispose();}});
 controls.update();requestDraw();
}catch(e){$('error').textContent='โหลดต้นแบบไม่สำเร็จ: '+e.message;console.error(e);}
addEventListener('pagehide',()=>{cancelAnimationFrame(raf);resize.disconnect();observer.disconnect();controls.dispose();const materials=new Set();group.traverse(o=>{if(o.isMesh){o.geometry.dispose();materials.add(o.material);}});for(const m of materials)m.dispose();renderer.dispose();});
