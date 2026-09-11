/* ============================================================
   materials.js — รวมวัสดุพื้นและกำแพงจากโฟลเดอร์ assets/textures/More/
   ============================================================ */

// รายการเท็กซ์เจอร์ทั้งหมดในโฟลเดอร์ assets/textures/More/
const ALL_MORE_TEXTURES = [
  // --- พื้นผิวหินและทราย ---
  {id:'granite',                  label:'แกรนิตดำ',             file:'assets/textures/More/granite.jpg',                                  cm:90},
  {id:'marble',                   label:'หินอ่อนขาว',            file:'assets/textures/More/marble.jpg',                                   cm:120},
  {id:'sand',                     label:'ทรายธรรมชาติ',         file:'assets/textures/More/sand.jpg',                                     cm:90},

  // --- สีโทนเรียบ / ปูนสีใหม่ ---
  {id:'white',                    label:'ขาว (White)',           file:'assets/textures/More/White.jpg',                                    cm:120},
  {id:'off-white',                label:'ออฟไวท์ (Off White)',   file:'assets/textures/More/Off White.jpg',                                cm:120},
  {id:'light-beige',              label:'เบจสว่าง (Light Beige)',file:'assets/textures/More/Light Brige.jpg',                             cm:120},
  {id:'beige',                    label:'เบจ (Beige)',           file:'assets/textures/More/Brige.jpg',                                   cm:120},
  {id:'mint',                     label:'มิ้นต์ (Mint)',          file:'assets/textures/More/Mint.jpg',                                    cm:120},
  {id:'sage-green',               label:'เขียวเซจ (Sage Green)', file:'assets/textures/More/Sage Green.jpg',                             cm:120},
  {id:'olive-green',              label:'เขียวโอลีฟ (Olive Green)',file:'assets/textures/More/Ovlie Green.jpg',                           cm:120},
  {id:'dusty-navy',               label:'ดัสตี้เนวี่ (Dusty Navy)',file:'assets/textures/More/Dusty Narvy.jpg',                           cm:120},
  {id:'solid-brown',              label:'น้ำตาล (Brown)',         file:'assets/textures/More/Brown.jpg',                                   cm:120},
  {id:'chocolate',                label:'ช็อกโกแลต (Chocolate)',  file:'assets/textures/More/Chocolate.jpg',                               cm:120},
  {id:'burgundy',                 label:'เบอร์กันดี (Burgundy)',   file:'assets/textures/More/Burgundy.jpg',                                cm:120},
  {id:'charcoal',                 label:'ชาร์โคล (Charcoal)',     file:'assets/textures/More/Charcoal.jpg',                                cm:120},

  // --- กำแพงและผิวสัมผัส ---
  {id:'white-wall',               label:'กำแพงขาว',              file:'assets/textures/More/white-wall-textures.jpg',                     cm:120},
  {id:'clean-rough-black',        label:'กำแพงดำหยาบ',          file:'assets/textures/More/clean-rough-black-wall-pattern.jpg',           cm:120},
  {id:'solid-green',              label:'เขียวเข้มเรียบ',         file:'assets/textures/More/solid-green-wall-textured-backdrop.jpg',      cm:120},
  {id:'green-bg',                 label:'เขียวสว่าง',            file:'assets/textures/More/green-background.jpg',                        cm:120},

  // --- ลายไม้ ---
  {id:'classic-wood',             label:'ไม้คลาสสิก',            file:'assets/textures/More/wood.jpg',                                     cm:180},
  {id:'brown-wood',               label:'พื้นไม้สีน้ำตาล',        file:'assets/textures/More/brown-wooden-textured-flooring-background.jpg', cm:180},
  {id:'black-wood',               label:'พื้นไม้สีดำ',           file:'assets/textures/More/black-wooden-floor.jpg',                      cm:180},
  {id:'wooden-texture',           label:'ไม้ธรรมชาติ',           file:'assets/textures/More/wooden-textured-background.jpg',              cm:180},
  {id:'dark-timber',              label:'ไม้ลายโต๊ะเข้ม',         file:'assets/textures/More/dark-timber-desk-texture.jpg',                 cm:180},
  {id:'painted-plank',            label:'ไม้กระดานทาสี',         file:'assets/textures/More/painted-wooden-plank-textured-backdrop.jpg',   cm:160},
  {id:'retro-gray-wood',          label:'ไม้เรโทรเทา',           file:'assets/textures/More/retro-gray-wooden-textured-background.jpg',   cm:180},
];
// พื้น: ใช้แกรนิตดำเป็นลายเริ่มต้น (ตัวแรก) แล้วตามด้วยลายอื่นๆ ทั้งหมด
const FLOOR_MATERIALS = [
  ...ALL_MORE_TEXTURES
];

// กำแพง: สลับเอาหินอ่อนขาวขึ้นเป็นลายเริ่มต้น (ตัวแรก) แล้วตามด้วยลายอื่นๆ ทั้งหมด
const WALL_MATERIALS = [
  ALL_MORE_TEXTURES.find(m => m.id === 'marble'),
  ...ALL_MORE_TEXTURES.filter(m => m.id !== 'marble')
];

function floorMatDef(id){ return FLOOR_MATERIALS.find(m=>m.id===id) || FLOOR_MATERIALS[0]; }
function wallMatDef(id){ return WALL_MATERIALS.find(m=>m.id===id) || WALL_MATERIALS[0]; }

function currentFloorMat(){ return FLOOR_MATERIALS[0]; }
function currentWallMat(){ return WALL_MATERIALS[0]; }
function floorMatIdAt(x,y){ const p=G.floorPaint; const v=p&&p[x+','+y]; return v||currentFloorMat().id; }
/* key ใหม่มีรูป "x,y,side:layer" (ทาสีทีละช่องความสูง) — ถ้าช่องนั้นยังไม่เคยถูกทาสีเอง
   ให้ตกไปใช้กุญแจ "x,y,side" แบบเดิม (ทาทั้งผนัง/ค่าจากเซฟเก่าก่อนมีระบบแบ่งชั้น) แทนค่าเริ่มต้นร้าน */
function wallMatIdAt(key){
  const p=G.wallPaint; if(!p) return currentWallMat().id;
  if(p[key]) return p[key];
  const base=String(key).split(':')[0];
  if(base!==String(key) && p[base]) return p[base];
  return currentWallMat().id;
}
function floorMatAt(x,y){ return floorMatDef(floorMatIdAt(x,y)); }
function wallMatAt(key){ return wallMatDef(wallMatIdAt(key)); }

let paintRevision=0;
function paintFloorTile(x,y,id){
  if(!FLOOR_MATERIALS.some(m=>m.id===id)) return false;
  G.floorPaint||(G.floorPaint={});
  const k=x+','+y;
  if(id===FLOOR_MATERIALS[0].id) delete G.floorPaint[k]; else G.floorPaint[k]=id;
  paintRevision++;
  if(typeof saveGame==='function') saveGame();
  return true;
}
function paintWallTile(key,id){
  if(!WALL_MATERIALS.some(m=>m.id===id)) return false;
  G.wallPaint||(G.wallPaint={});
  /* key ทีละชั้น (มี ":layer" ต่อท้าย) ต้องเขียนค่าเสมอ ห้ามลบแม้เลือกวัสดุเริ่มต้น (marble) —
     ถ้าลบ แล้ว wallMatIdAt() ตกไปหา key ทั้งผนังแบบเก่า (ไม่มี ":") ซึ่งอาจยังมีสีเก่าค้างอยู่
     (เช่นเคยทาทั้งบานเป็นสีขาวไว้ก่อนมีระบบแบ่งชั้น) กลายเป็นเลือก marble แล้วโผล่สีขาวเก่าแทน
     key ทั้งผนังแบบเดิม (ไม่มี ":") ยังลบทิ้งได้ตามปกติเมื่อกลับไปใช้ค่าเริ่มต้น */
  if(!String(key).includes(':') && id===WALL_MATERIALS[0].id) delete G.wallPaint[key];
  else G.wallPaint[key]=id;
  paintRevision++;
  if(typeof saveGame==='function') saveGame();
  return true;
}

let _matGen=0;
const _matImgs = {};
function matImage(path){
  let im = _matImgs[path];
  if(!im){
    im = _matImgs[path] = new Image();
    im.addEventListener('load', ()=>{ _matGen++; }, {once:true});
    im.src = path;
  }
  return (im.complete && im.naturalWidth) ? im : null;
}
function matReady(path){
  const im = _matImgs[path];
  return !!(im && im.complete && im.naturalWidth);
}
function matGen(){ return _matGen; }