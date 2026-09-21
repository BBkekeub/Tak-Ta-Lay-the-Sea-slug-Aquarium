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
/* ⚠️ 2026-09-20 ผู้เล่น: "สีเริ่มต้นของผนังให้เป็นสีขาว และพื้นให้เป็นสีขาว · ฝังลงไฟล์เกมเลยจะได้โหลดไว"
   วัสดุตัวนี้ไม่มีไฟล์ภาพ — ใช้ color เติมสีเรียบ ๆ ตรง ๆ
   เดิมค่าเริ่มต้นคือ แกรนิตดำ (พื้น) + หินอ่อนขาว (ผนัง) ซึ่งเป็น .jpg ทั้งคู่
   เท่ากับเปิดเกมมาต้องรอโหลด 2 ไฟล์ก่อนถึงจะเห็นห้องเป็นรูปเป็นร่าง
   ตอนนี้ค่าเริ่มต้นวาดได้ทันทีตั้งแต่เฟรมแรก ไม่มี fetch ไม่มี decode
   ⚠️ ตัวที่มี color ต้องไม่ถูกส่งเข้า matImage()/createPattern() — ฝั่งที่วาดเช็ก .color ก่อนเสมอ
      (shop-floor.js floorMatPatFor/wallMatPatFor · tank-view.js roomPat · tank-decor-ui.js ปุ่มตัวอย่าง)
   ลายอื่นทั้งหมดยังอยู่ครบ ผู้เล่นทาทับได้เหมือนเดิม เปลี่ยนแค่ "ค่าเริ่มต้น" */
const PLAIN_WHITE = {id:'plain-white', label:'ขาวล้วน (ไม่มีลาย)', color:'#ffffff', cm:120};

// พื้น: ขาวล้วนเป็นค่าเริ่มต้น (ตัวแรก) แล้วตามด้วยลายอื่นๆ ทั้งหมด
const FLOOR_MATERIALS = [
  PLAIN_WHITE,
  ...ALL_MORE_TEXTURES
];

// กำแพง: ขาวล้วนเป็นค่าเริ่มต้น (ตัวแรก) แล้วตามด้วยลายอื่นๆ ทั้งหมด
const WALL_MATERIALS = [
  PLAIN_WHITE,
  ...ALL_MORE_TEXTURES
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
/* ---- ค่าทาสี (ผู้เล่นกำหนด 2026-09-21) ----
   พื้น  : 200 ต่อ "ช่องใหญ่" 1 ช่อง (50×50 ซม.) — หน่วยเดียวกับที่ paintFloorTile รับ
   กำแพง:  50 ต่อ "ช่องกำแพง" 1 ช่อง = กว้าง 1 ช่องใหญ่ × สูง WALL_LAYER_CM (20 ซม.)
           ⚠️ ไม่ใช่ช่องเล็ก 5×5 ซม. — กำแพงไม่ได้แบ่งเป็นช่องเล็ก หน่วยที่คลิกได้จริงคือ 50×20 ซม.
              (ถ้าคิดต่อช่องเล็กจริง 1 คลิก = 40 ช่อง = 2,000 ซึ่งแพงกว่าพื้นช่องใหญ่ 10 เท่า)
   ⚠️ เก็บเงินที่นี่จุดเดียว เพราะทุกเส้นทาง (คลิกเดี่ยว · ลากเป็นเส้น · เลื่อนขอบจอแล้วทาต่อ)
      วิ่งผ่านสองฟังก์ชันนี้หมด ถ้าไปเก็บที่ tile-paint.js จะหลุดทางใดทางหนึ่งแน่นอน */
const PAINT_FLOOR_COST=200, PAINT_WALL_COST=50;
let _paintWarnAt=0;
function _paintAfford(cost){
  if((G.coin||0)>=cost) return true;
  /* ลากทีเดียวเรียกหลายสิบครั้ง — เตือนได้ไม่เกิน 1 ครั้งต่อ 1.2 วิ ไม่งั้น toast ท่วมจอ */
  const now=Date.now();
  if(now-_paintWarnAt>1200){ _paintWarnAt=now; if(typeof toast==='function') toast('เหรียญไม่พอทาสี (ต้องการ '+cost+')','bad'); }
  return false;
}
function paintFloorTile(x,y,id){
  if(!FLOOR_MATERIALS.some(m=>m.id===id)) return false;
  if(floorMatIdAt(x,y)===id) return false;        // สีเดิมอยู่แล้ว = ไม่เปลี่ยนอะไร ไม่คิดเงิน
  if(!_paintAfford(PAINT_FLOOR_COST)) return false;
  if(typeof addCoin==='function') addCoin(-PAINT_FLOOR_COST);
  /* เด้งกลางช่องที่ทา · ลากยาว ๆ CostPop จะรวมยอดให้เองถ้าช่องติดกัน ไม่เด้งทีละช่องจนรกจอ */
  if(typeof CostPop!=='undefined') CostPop.at(x*SUB+SUB/2, y*SUB+SUB/2, -PAINT_FLOOR_COST);
  G.floorPaint||(G.floorPaint={});
  const k=x+','+y;
  if(id===FLOOR_MATERIALS[0].id) delete G.floorPaint[k]; else G.floorPaint[k]=id;
  paintRevision++;
  if(typeof syncHUD==='function') syncHUD();
  if(typeof saveGame==='function') saveGame();
  return true;
}
function paintWallTile(key,id){
  if(!WALL_MATERIALS.some(m=>m.id===id)) return false;
  if(wallMatIdAt(key)===id) return false;         // สีเดิมอยู่แล้ว = ไม่คิดเงิน
  if(!_paintAfford(PAINT_WALL_COST)) return false;
  if(typeof addCoin==='function') addCoin(-PAINT_WALL_COST);
  /* คีย์กำแพงคือ "x,y,side[:layer]" — ดึง x,y ออกมาเด้งตรงช่องพื้นที่ติดผนังบานนั้น
     ผนังอยู่ขอบช่อง ไม่ใช่กลางช่อง จึงเด้งที่มุมช่องฝั่งที่ผนังตั้งอยู่ */
  if(typeof CostPop!=='undefined'){
    const p=String(key).split(':')[0].split(',');
    const wx=+p[0], wy=+p[1], side=+p[2];
    if(Number.isFinite(wx)&&Number.isFinite(wy))
      CostPop.at(wx*SUB+(side===0?SUB/2:0), wy*SUB+(side===0?0:SUB/2), -PAINT_WALL_COST);
  }
  G.wallPaint||(G.wallPaint={});
  /* key ทีละชั้น (มี ":layer" ต่อท้าย) ต้องเขียนค่าเสมอ ห้ามลบแม้เลือกวัสดุเริ่มต้น (marble) —
     ถ้าลบ แล้ว wallMatIdAt() ตกไปหา key ทั้งผนังแบบเก่า (ไม่มี ":") ซึ่งอาจยังมีสีเก่าค้างอยู่
     (เช่นเคยทาทั้งบานเป็นสีขาวไว้ก่อนมีระบบแบ่งชั้น) กลายเป็นเลือก marble แล้วโผล่สีขาวเก่าแทน
     key ทั้งผนังแบบเดิม (ไม่มี ":") ยังลบทิ้งได้ตามปกติเมื่อกลับไปใช้ค่าเริ่มต้น */
  if(!String(key).includes(':') && id===WALL_MATERIALS[0].id) delete G.wallPaint[key];
  else G.wallPaint[key]=id;
  paintRevision++;
  if(typeof syncHUD==='function') syncHUD();
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