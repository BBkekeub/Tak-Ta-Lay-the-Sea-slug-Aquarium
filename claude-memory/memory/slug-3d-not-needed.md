---
name: slug-3d-not-needed
description: "ทาก 3D ถูกลบออกจาก repo ทั้งหมดแล้ว 2026-09-29 (ผู้ใช้สั่ง \"ลบออกไปเลย จะได้ไม่รก\") — ทากทุกตัว 2D จาก slug-engine.js"
metadata:
  node_type: memory
  type: project
  originSessionId: c5613bca-585b-4c3b-bf05-421595a986de
  modified: 2026-09-29T07:12:27.737Z
---

2026-09-29 ผู้ใช้สั่งเอาระบบ 3D ออก "เฉพาะส่วนของทาก" แล้วสั่งต่อว่า "ลบออกไปเลย จะได้ไม่รก · คอมเมนต์ก็เอาออก"
ลบแล้ว (ยังกู้ได้จากประวัติ git): js/decor-glb.js, slug-3d.js, slug-3d-toggle.js, slug-crowd.js, slug-skin.js, slug-surface.js, slug-view-math.js, file-mode.js · assets/slug3d/ · assets/3D Model/ · tools/leaf-sheep/ · test-leaf-study.mjs · test-slug-glass.mjs
- index.html ไม่มี three.js/importmap/script module แล้ว · ไม่มีปุ่มสลับ 2D/3D
- decor-glb.js เคยเป็นตัวเรนเดอร์ WebGL ของทาก 3D ล้วน — คนในร้านวาดด้วย WebGL ของ people.js เอง (ไม่เกี่ยว)
- PLAY.bat ยังใช้โปรไฟล์ `%LocalAppData%\TakTaLay3D\browser-profile` — เซฟผู้เล่นอยู่ในนั้น ห้ามเปลี่ยนพาธแม้ชื่อมี 3D
- ตรวจการวาดทาก: tools/test-slug-render.mjs (หน้าร้าน/ตู้/UI/ซ้อมกินจุ+ดันวง)

**Why:** 3D ทำงานซ้ำทุกพันธุ์ใหม่ ([[species-pipeline]]), ตามผังจากโต๊ะไม่ได้, ภาพปน 2D/3D, หนักเครื่อง
**How to apply:** อย่าเสนอ/สร้างงาน 3D ให้ทาก · ทากใหม่ทำ 2D จากโต๊ะประกอบร่างเท่านั้น · เทสต์ที่รอเกมพร้อมให้รอ `engineReady`
