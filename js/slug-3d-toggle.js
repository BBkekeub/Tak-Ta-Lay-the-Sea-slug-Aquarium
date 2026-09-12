/* ปุ่มสลับทาก 3D ↔ 2D — โหลดหลัง DOM มีปุ่มแล้ว (วางไว้ท้าย body)

   ทำไมสลับได้ทั้งที่เป็นคนละเอนจิน: shop-floor.js กับ tank-view.js เรียก
   Slug3D.draw() ก่อนเสมอ ถ้ามันคืน false ค่อยตกไปวาดสไปรต์ 2D ของ slug-engine.js
   ปิด Slug3D.enabled = draw() คืน false ทันที → ได้ 2D ครบทุกจุดโดยไม่ต้องรีโหลด

   ปิดแล้วคืนหน่วยความจำโมเดลด้วย (release) ตาม AGENTS.md ที่ห้ามแบกของที่ไม่ได้ใช้ */
(function () {
  var KEY = 'slug3dEnabled';
  var btn = document.getElementById('bSlug3D');
  if (!btn) return;

  var on = true;
  try { var v = localStorage.getItem(KEY); if (v !== null) on = (v === '1'); } catch (e) {}

  function label() {
    var s = window.Slug3D;
    if (s && s.error) {                       // โหลดโมเดลไม่ได้ (เช่นเปิดจากไฟล์โดยไม่ผ่าน PLAY.bat)
      btn.textContent = '🐌 ทาก: 2D';
      btn.title = 'โหลดโมเดล 3D ไม่ได้: ' + s.error;
      btn.disabled = true;
      return;
    }
    btn.textContent = '🐌 ทาก: ' + (on ? '3D' : '2D');
    btn.title = on ? 'กดเพื่อกลับไปใช้ทากแบบ 2D' : 'กดเพื่อใช้โมเดล 3D';
  }

  function apply() {
    var s = window.Slug3D;
    if (s) {
      s.enabled = on;
      if (!on && s.release) { try { s.release(new Set()); } catch (e) {} }
    }
    label();
  }

  btn.onclick = function () {
    on = !on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    apply();
  };

  window.addEventListener('slug3dready', apply);
  window.addEventListener('slug3derror', label);
  apply();                                    // ตอนนี้ Slug3D อาจยังไม่มี — ตั้งป้ายไว้ก่อน

  /* กันป้ายโกหก: ถ้าโมดูล slug-3d.js ตายตั้งแต่ตอน resolve import (เช่น importmap ชี้ไป
     vendor/ ที่ไม่ได้ push ขึ้นไปด้วย) จะไม่มีโค้ดในนั้นรันเลย → ไม่มีทั้ง Slug3D และ
     อีเวนต์ slug3derror เกมวาด 2D อยู่แต่ปุ่มยังขึ้น "3D" อยู่ดี จึงเช็คซ้ำเองว่า
     ผ่านไปแล้วยังไม่มี Slug3D โผล่มา = 3D ใช้ไม่ได้จริง บอกตามนั้นแล้วปิดปุ่ม */
  setTimeout(function () {
    if (window.Slug3D) return;
    btn.textContent = '🐌 ทาก: 2D';
    btn.title = 'โหลดเอนจิน 3D ไม่สำเร็จ — ดู Console';
    btn.disabled = true;
  }, 15000);
})();
