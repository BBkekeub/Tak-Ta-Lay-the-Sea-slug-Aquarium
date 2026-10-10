---
name: decor-2d-only
description: ของตกแต่งในตู้เป็น 2D เท่านั้น — ผู้ใช้เลิกใช้ 3D ถาวร 2026-09-26 และให้ลบไฟล์ 3D ทั้งหมดแล้ว
metadata:
  node_type: memory
  type: project
  originSessionId: ec2012b2-a0fa-4e52-95d5-1d6839867436
  modified: 2026-09-25T18:10:48.726Z
---

2026-09-26 ผู้ใช้ตัดสินใจ **ไม่ใช้ 3D กับของตกแต่งในตู้อีก** และสั่งลบไฟล์ชุด 3D ทั้งหมด (ลบถาวรแม้ไฟล์ที่อยู่นอก git)
ของตกแต่งที่เหลือ: Dec grid 2D (`js/decor-defs.js`) และภาพ 2D หลายมุม (`js/sprite-decor-defs.js` → `SPRITE_DECOR_DEFS`, วาด/ชนด้วย `js/sprite-decor-runtime.js` → `SpriteDecor`)
`js/decor-glb.js` (window.DecorGLB) ถูกถอดพร้อมทาก 3D แล้ว 2026-09-29 ([[slug-3d-not-needed]])
เซฟเก่าที่มีของ 3D ถูกคืนเงินเต็มราคาครั้งเดียวตอนโหลด (`refundRemoved3DDecor` ใน save.js)

**Why:** ผู้ใช้เห็นว่าของ 3D ไม่เข้ากับเกม ทางที่เลือกคืออาร์ต 2D
**How to apply:** อย่าเสนอหรือสร้าง pipeline GLB/Blender สำหรับของตกแต่งอีก · ของตกแต่งใหม่ให้ทำเป็นภาพ 2D (หลายมุมได้) · ทาก 3D ไม่เกี่ยวกับการตัดสินใจนี้ ยังใช้ต่อ
