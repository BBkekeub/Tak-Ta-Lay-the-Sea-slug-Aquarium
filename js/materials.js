/* ============================================================
   materials.js — รวมวัสดุพื้นและกำแพงจากโฟลเดอร์ assets/textures/More/
   ============================================================ */

// รายการเท็กซ์เจอร์ทั้งหมดในโฟลเดอร์ assets/textures/More/
const ALL_MORE_TEXTURES = [
  {id:'granite',                  label:'แกรนิตดำ',             file:'assets/textures/More/granite.jpg',                                  cm:90, lift:true},
  {id:'marble',                   label:'หินอ่อนขาว',            file:'assets/textures/More/marble.jpg',                                   cm:120},
  {id:'white-wall',               label:'กำแพงขาว',              file:'assets/textures/More/white-wall-textures.jpg',                     cm:120},
  {id:'clean-rough-black',        label:'กำแพงดำหยาบ',          file:'assets/textures/More/clean-rough-black-wall-pattern.jpg',           cm:120},
  {id:'solid-green',              label:'เขียวเรียบ',            file:'assets/textures/More/solid-green-wall-textured-backdrop.jpg',      cm:120},
  {id:'green-bg',                 label:'เขียวสว่าง',            file:'assets/textures/More/green-background.jpg',                        cm:120},
  {id:'black-wood',               label:'ไม้สีดำ',               file:'assets/textures/More/black-wooden-floor.jpg',                      cm:180},
  {id:'brown-wood',               label:'ไม้สีน้ำตาล',            file:'assets/textures/More/brown-wooden-textured-flooring-background.jpg', cm:180},
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
function wallMatIdAt(key){ const p=G.wallPaint; const v=p&&p[key]; return v||currentWallMat().id; }
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
  if(id===WALL_MATERIALS[0].id) delete G.wallPaint[key]; else G.wallPaint[key]=id;
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