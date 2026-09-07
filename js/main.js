/* ============================================================
   main.js — เริ่มเกม
   ============================================================ */
function init(){
  resize();
  buildShop();
  setMode('view');           // เริ่มที่โหมดดู/เล่น (ไม่มีเงาตู้ตามเมาส์)
  // วางตู้เริ่มต้น 1 ตู้ให้เห็นภาพ
  const d=CATALOG.tank_m;
  const o={ id:'o'+(G.seq++), type:'tank', _key:'tank_m', cx:2*SUB, cy:2*SUB, def:d, slugs:Array.from({length:2},()=>makeSlug({...SlugEngine.randGene(),mainC:200})) };
  o.slugs.forEach(s=>placeOnFloor(s,o));      // กระจายตำแหน่ง ไม่ให้ซ้อนกัน
  G.objs.push(o);
  syncHUD();
  fitCamera();
  loop();
}
window.addEventListener('resize', resize);
window.addEventListener('load', ()=>{ resize(); fitCamera(); });
init();
