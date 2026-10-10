---
name: custom-editor-build
description: Custom.html (โต๊ะประกอบร่าง) ต้อง build แล้วก๊อปไปราก repo · เทสต์ check-*.mjs เขียนทับ PNG ที่ track · check-gene-preview เทียบกับเกม
metadata:
  node_type: memory
  type: project
  originSessionId: 51716e7e-0a17-487f-82e1-35c56738a827
  modified: 2026-09-26T06:01:21.004Z
---

ผู้ใช้เปิด `Custom.html` ที่ **ราก repo** (ไฟล์ untracked) แต่ `node tools/custom-editor/build-custom.mjs` เขียนแค่ `tools/custom-editor/Custom.html`
→ หลังแก้ `tools/custom-editor/*-features.js` ต้อง build แล้ว `cp tools/custom-editor/Custom.html Custom.html` เสมอ (ก่อนก๊อปเช็ก `cmp` ว่าสองไฟล์เดิมตรงกัน)

- node ไม่อยู่ใน PATH: ใช้ `C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe` (playwright อยู่ใน node_modules ข้าง ๆ)
- `check-animation/bones/custom/surface-transform.mjs` เซฟสกรีนช็อตทับ `tools/custom-editor/*-preview.png` ที่ track อยู่ → รันแล้ว `git checkout --` คืน
- `check-heavy-scene.mjs` กับ `check-shortcuts.mjs` พังอยู่แล้วตั้งแต่ก่อน 2026-09-26 (สุ่มจุดลาก + อ้างตัวแปรผิด / รอ download ไม่มา) อย่าเข้าใจว่าเป็นบั๊กใหม่
- `check-gene-preview.mjs` = หลักฐานว่าพรีวิวยีนตรงเกม: ตาราง/กฎเทียบ `js/slug-engine.js` + เทียบภาพกับ `SlugEngine.drawSlug` ระดับโทน

- `check-own-species.mjs` = กฎทากพันธุ์ใหม่ (รูปหงอน/ลายของตัวเอง): หงอน 9 ก้านลดตาม CREST_KEEP (ลำดับทากเดิม) · ลายของตัวเองหาย 100→0 ทีละดวงแบบหด+จาง

**Why:** 2026-09-26 แก้พรีวิวยีนให้ครบ 11 ยีนและตรงเกม ([[editor-must-match-game]]) — ถ้าลืมก๊อป ผู้ใช้จะเปิดของเก่า
**How to apply:** ทุกงานที่แตะ tools/custom-editor ปิดท้ายด้วย build → copy → รัน check-gene-preview + check ที่เกี่ยว → คืน PNG
