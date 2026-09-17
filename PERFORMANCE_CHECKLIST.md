# Performance Checklist — Tak Ta Lay

ลิสนี้คือผลตรวจโค้ดจริง (ไม่ใช่ความตั้งใจ) เทียบกับกฎใน `AGENTS.md` ตรวจเมื่อ 2026-09-14
โดยไล่อ่าน: shop-floor.js, tank-view.js, people.js, slug-engine.js, slug-crowd.js,
floor-grid.js, wall-shelf.js, tile-paint.js, play-table.js, world-market.js, decor-defs.js

สถานะ: ✅ ทำแล้ว · ⚠️ ทำบางส่วน · ❌ ยังไม่ทำ/ผิดกฎ

**บริบทสำคัญที่เพิ่งค้นพบ:** เกมนี้ไม่ใช่ Canvas 2D ล้วน — `people.js` เรนเดอร์ลูกค้าทุกคน
ผ่าน WebGL ของตัวเอง (`_personGL`) และ `slug-crowd.js` + `slug-3d.js` ใช้ Three.js จริง
(โมเดลทาก 3D สลับได้ด้วยปุ่ม 🐌) ไม่ใช่แค่เครื่องมือ bake asset เหมือนที่เข้าใจกันตอนแรก
ข้อนี้ต้องคำนึงเวลาคุยเรื่อง pipeline 3D ต่อไป เพราะมี WebGL runtime อยู่แล้วในเกม

---

## 1. Offscreen canvas / pre-render bitmap cache
✅ ทำแล้วในเกือบทุกจุดหลัก
- ห้อง/พื้น/กำแพง → `_roomC` cache (shop-floor.js:353-369)
- เลเยอร์ตู้ (chrome/glass/caustics) → offscreen canvas (tank-view.js:44-58, 431-455)
- สไปรต์ทากต่อตัว → bake + refresh capped 20Hz (tank-view.js:125-148)
- โต๊ะเล่นเกมไม้ → bake ต่อ rotation (play-table.js:106-118)

❌ **ช่องโหว่: people.js** — ไม่มีการ cache ภาพ raster ของคนเลย ทุกครั้งที่ลูกค้ายืนนิ่งอยู่ในจอ
ก็ยัง clear+draw WebGL ใหม่ทุกรอบ refresh (773-834) ทั้งที่ท่าทางไม่เปลี่ยน — จุดนี้น่าจะได้ประโยชน์
จากการทำแบบเดียวกับทาก (bake เป็นภาพนิ่งตอนยืนเฉยๆ)

## 2. Dirty-rect vs full clear+redraw
⚠️ ไม่มี dirty-rect จริงในทั้งโปรเจกต์ — ทุกไฟล์ clear ทั้ง canvas แล้ววาดใหม่ทั้งหมดทุกเฟรม
(shop-floor.js:349, tank-view.js:1488) แต่ "แก้เกม" ด้วยการ cache ส่วน static เป็นบิตแมปแทน (ข้อ 1)
ทำให้ต้นทุนจริงต่ำแม้ไม่มี dirty-rect — เพียงพอที่จำนวนวัตถุตอนนี้ แต่จะแพงขึ้นเชิงเส้นตามจำนวน
คน/ทาก/ของตกแต่งที่ต้องวาดสดทุกเฟรม

## 3. Viewport culling
✅ มีระบบ `onScreen()` ครอบคลุมของในร้านและคนเดิน (shop-floor.js:299-308, people.js:779-783)
❌ **wall-shelf.js ไม่มี onScreen check เลย** — วาดกล่อง/เหรียญ/ป้ายทุกเฟรมแม้กำแพงนั้นเลื่อนออกนอกจอ
(ผลกระทบต่ำเพราะมีแค่ ≤6 ช่อง แต่เป็นไฟล์เดียวที่ไม่มี gate นี้)

## 4. requestAnimationFrame + หยุดตอนแท็บซ่อน
⚠️ ทุกไฟล์ใช้ rAF (ไม่มี setInterval ปนใน render loop) แต่การจัดการตอนแท็บซ่อนไม่สม่ำเสมอ
- shop-floor.js / tank-view.js: rAF ยังวิ่งต่อ แต่ข้ามการทำงานเมื่อ `document.hidden` (พึ่งพา browser throttle)
- play-table.js: ทำถูกที่สุด — ยกเลิก rAF จริงตอน hidden แล้วค่อย restart ตอนกลับมา (262, 281)

## 5. แยก simulation ออกจาก rendering (ห้ามหยุดตอนนอกจอ/แท็บซ่อน)
✅ **แก้แล้ว (2026-09-14)** — เดิมผิดกฎชัดเจนที่สุดในรายงานนี้ ตอนนี้แก้แล้ว
- เพิ่ม `stepShopSimulation()` (shop-floor.js ท้ายไฟล์ ต่อจาก `loop()`) รันด้วย `setInterval(...,100)`
  อิสระจาก rAF/`document.hidden`/`onScreen`/`tankMode` แบบเดียวกับ breeding.js/tank-hygiene.js
- ของที่เห็นในจอ+หน้าร้านเปิดอยู่ ยังใช้โค้ดเดิม (60Hz ผ่าน `drawFloor()`) ไม่แตะเลย กันรีเกรสชัน
  ตัวใหม่รับผิดชอบเฉพาะช่องว่างเดิม: ตู้ที่หลุดจอ, ตอนแท็บซ่อน, ตอนดูอยู่ในตู้อื่น, ตอนหน้าแข่งเปิด
- ตู้ที่กำลังเปิดดูอยู่ (tankMode ตอนแท็บไม่ซ่อน) ยังให้ tank-view.js เดินเองเหมือนเดิม (ละเอียดกว่า)
  กันไม่ให้เดินซ้ำสองรอบ — ถ้าสลับแท็บตอนอยู่ในตู้นั้นพอดี ตัวใหม่จะรับช่วงต่ออัตโนมัติ
- ทดสอบแล้วจริงในเบราว์เซอร์: เลื่อนกล้องให้ตู้หลุดจอ (`onScreen(o)===false`) แล้วปล่อยไว้ 4 วิ
  → ทากยังเดิน (`fx`/`fy` เปลี่ยน) และนาฬิกา `stt` นับถอยหลังต่อเนื่องตามเวลาจริง ไม่ค้าง
- ยังไม่ได้ทดสอบเคส "สลับแท็บจริง (document.hidden)" ในเบราว์เซอร์ (จำลองยาก) — ตรวจด้วยการ
  อ่านโค้ดแล้วเท่านั้นว่า path ถูกต้อง ควรลองสลับแท็บจริงตอนเล่นจริงอีกทีเพื่อความชัวร์
- ตรงข้ามกับ breeding.js, tank-hygiene.js, world-market.js ที่ใช้ `setInterval` แยกอิสระจาก
  render loop โดยสมบูรณ์อยู่แล้ว — เป็นต้นแบบที่เอามาใช้ตรงนี้

## 6. Image/asset โหลดครั้งเดียว + cache
✅ ทำแล้วทุกไฟล์ — โหลด/decode ครั้งเดียวเก็บใน module-level cache ทั้งหมด
ℹ️ หมายเหตุ (ไม่ใช่บั๊ก): slug-engine.js ฝัง art เป็น base64 ในซอร์ส ~2.8MB บรรทัดเดียว
ทำให้ parse/compile ตอนโหลดหน้าเว็บหนักกว่าที่ควร แม้ runtime cache จะถูกต้อง

## 7. Trig/math ซ้ำต่อเฟรม
✅ จุดที่เคยเป็นปัญหาถูกแก้แล้วมีคอมเมนต์ยืนยัน — people.js คำนวณ yaw/trig ครั้งเดียวต่อคน
ไม่ใช่ต่อ vertex (เดิมช้าเพราะคิดซ้ำหลักหมื่นครั้ง/เฟรม, คอมเมนต์บรรทัด 908-909)

## 8. Event listener hygiene
✅ สะอาดทุกไฟล์ —ผูก listener ครั้งเดียวตอนโหลดโมดูล ไม่มีการผูกซ้ำใน draw()/update()

## 9. Canvas resolution / devicePixelRatio
✅ cap DPR ไว้ที่ 2× ทั้ง 2 แคนวาสหลัก (shop-floor.js:15, tank-view.js) และ bound ขนาด
offscreen layer ไว้ไม่เกิน 4096px (tank-view.js:1567)
⚠️ portrait canvas เล็กๆใน wall-shelf/world-market ไม่สนใจ DPR แต่ผลกระทบแทบไม่มี (จอเล็กมาก)

## 10. ของนิ่ง/ไอดอลไม่ควรอนิเมททุกเฟรม (กฎข้อ 3)
⚠️ ทากมีระบบ budget ที่ดี (animBudget=14 ตัว/เฟรม, ต่ำกว่า 30px ไม่อนิเมท — shop-floor.js:294-295)
❌ caustics ในตู้ (shop-floor.js:173-194) กับเหรียญ "ขายแล้ว" ที่เด้งใน wall-shelf.js:184
อนิเมทต่อเนื่องไม่มีเงื่อนไขหยุด (ต้นทุนต่ำ แต่ผิดหลักการ "อนิเมทเฉพาะตอนต้องการความสนใจ")
ตัว world-market.js ก็อนิเมท portrait ต่อเนื่องตลอดเวลาที่เปิด dialog เช่นกัน

## 11. Garbage allocation ใน hot loop
⚠️ มี mitigation ที่ดี (`isoSortedObjects` memoize ด้วย signature, `crowdRouteBudget` จำกัด
การหาเส้นทาง) แต่ยังมีจุด allocate array/Set ใหม่ทุกเฟรมโดยไม่จำเป็น:
- `peopleInArea` สร้าง array ใหม่ทุกครั้งที่เรียก ถูกเรียกซ้อนใน pathfinding
- `stepFamilies`/`stepFamilyColumns` สร้าง Set ใหม่ทุก tick (~60/s)
- decor `masks` ใน tank-view.js:1622 alloc ใหม่ทุกเฟรมทั้งที่ของไม่ได้ขยับ

## 12. Layering (static canvas แยกจาก dynamic)
⚠️ ไม่ได้แยก DOM `<canvas>` จริงๆ — ใช้วิธี bake เป็นบิตแมปแล้ว blit ซ้อนกันบนแคนวาสเดียว
(ได้ผลลัพธ์ใกล้เคียง layering แต่ cache key หยาบระดับ "ทั้งห้อง" — แก้พื้น 1 ช่อง = build ใหม่ทั้ง `_roomC`)

---

## เรียงตามความสำคัญที่ควรแก้ก่อน

1. ~~แยก `stepTankSlugs` + `stepPeople` ออกจาก `document.hidden`/`onScreen` guard~~ ✅ แก้แล้ว (ดูข้อ 5)
2. **[แก้ก่อน]** เพิ่ม `onScreen()` check ให้ wall-shelf.js ก่อน draw
3. **[ควรทำ]** เพิ่ม static-raster cache ให้ people.js เวลาลูกค้ายืนนิ่ง (ตามแบบทาก)
4. **[ควรทำ]** ใส่เงื่อนไขหยุด/ชะลอ animation ให้ caustics + เหรียญเด้ง (เช่น หยุดหลัง N วิ ถ้าไม่มีใครมอง)
5. **[nice to have]** ลด allocation ต่อเฟรมใน people.js (`peopleInArea`, family Set) ด้วย object pool
6. **[nice to have]** แตกไฟล์ base64 ของ slug-engine.js ออกเป็นไฟล์ภาพจริงเพื่อลด parse cost ตอนโหลดหน้า

## หมายเหตุ: เรื่อง 3D decor ที่คุยกันไว้
เกมมี Three.js runtime อยู่แล้ว (people.js, slug-crowd.js, slug-3d.js) พร้อม pattern
"bake เป็น atlas/bitmap แล้ว blit" ที่ทำได้ดีมากใน slug-3d.js (ดูฟังก์ชัน `flush()`) —
วิธีนี้คือต้นแบบที่ควรก็อปมาใช้กับของตกแต่ง 3D หมุนได้ 4 มุมตามที่คุยไว้ก่อนหน้า
แทนที่จะสร้างระบบ WebGL ใหม่แยกต่างหาก
