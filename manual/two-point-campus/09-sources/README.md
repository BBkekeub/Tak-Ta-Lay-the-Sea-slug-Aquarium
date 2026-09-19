# 09 — แหล่งข้อมูลและสิ่งที่ยังไม่รู้

เข้าถึงแหล่งข้อมูลวันที่ 19 กันยายน 2026 เอกสารเอนจินทั่วไปใช้อธิบายกลไก ไม่ใช่หลักฐานว่า Campus เปิดใช้ทุกคุณสมบัติ

## แพตช์จากทีม Two Point โดยตรง

[Steam Update 10.0 และรายการอัปเดตต่อเนื่อง](https://community.twopointcounty.com/two-point-studios/two-point-campus/forums/11-release-notes/threads/1566-steam-update-10-0-release-notes)

โพสต์วันที่ 3 เมษายน 2024 บิลด์ 10.2.144722 ระบุว่าเปิด render jobs และ GPU skinning โดยรายงานว่าทั้งสองร่วมกันลด frame time 10–20% ในการทดสอบของทีม ปรับการซ่อนสิ่งของขนาดเล็กบนจอ ลด transparency ที่ไม่จำเป็นใน VFX แก้ batching ของ wall shader และปรับขนาด/การตั้งค่า texture เพื่อลด memory โดยเฉพาะ Switch/PS4

ค่าที่ทีมรายงานไม่ใช่ผล benchmark บนเครื่องผู้ใช้ และไม่ใช่คำรับรองว่าเกมเราจะเร็วขึ้นเท่ากัน ถ้าเดิมใช้เวลา T แล้วลด 10–20% จะเหลือ 0.9T–0.8T; FPS จึงเพิ่มประมาณ 11–25% เมื่อไม่มีคอขวดอื่น

หน้าเดียวกันมี character-limit toggle ในอัปเดต 10.0 แต่ไม่ได้ยืนยันจากข้อความนี้ว่าทุกเครื่องวาด 1,000 คนเต็มรายละเอียดได้ลื่น

## แหล่งแรกเริ่มอื่น

- [Unity: Multiplatform / Two Point Campus](https://unity.com/features/multiplatform) — ยืนยันการใช้ Burst, ECS, URP; ลิงก์ case study เดิม /case-study/two-point-campus เปลี่ยนปลายทางเป็นหน้ารวม resources ในวันที่ตรวจ จึงไม่อ้างเนื้อหาลึกจากบทความที่อ่านไม่ได้
- [Super Spline: Two Point Campus](https://supersplinestudios.com/portfolio/two-point-campus/) — ผู้ร่วมผลิตระบุงาน hand-key animation และ hero rigging ไม่ได้ให้จำนวนกระดูกหรือวิธี render ฝูงคน
- [NVIDIA: Animated Crowd Rendering](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-2-animated-crowd-rendering) — ตัวอย่างเทคนิค animation textures, instancing และ LOD ใช้เป็นแนวคิดทางเลือกของเรา
- [Unity: Static batching](https://docs.unity3d.com/Manual/DrawCallBatching.html) — กลไกและข้อจำกัด ไม่เท่ากับ GPU skinning หรือ instancing
- [MDN: WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) — หลักทั่วไปด้าน batching, render resolution และงาน WebGL; ไม่ใช่ benchmark ของเกมเรา
- [Intel: i3-6006U](https://www.thailand.intel.com/content/www/th/th/products/sku/91157/intel-core-i36006u-processor-3m-cache-2-00-ghz/specifications.html) — ยืนยันรุ่น CPU/GPU ของเครื่องฐานที่เสนอ

## หลักฐานในโปรเจกต์

- [local-snapshot.json](../evidence/local-snapshot.json) — เวอร์ชัน config hashes assemblies และจำนวนฐานโมเดลเรา
- [metadata-symbols.json](../evidence/metadata-symbols.json) — ชื่อที่คัดตามหัวข้อจาก string table พร้อมข้อจำกัด ไม่ใช่ source code ที่ถอดแล้ว
- [collect-evidence.mjs](../tools/collect-evidence.mjs) — วิธีอ่านและนับซ้ำ

## คำถามที่ยังเปิดอยู่

| คำถาม | สิ่งที่ต้องตรวจต่อเพื่อยืนยัน |
| --- | --- |
| Campus คนละกี่สามเหลี่ยมและกี่ bones? | อ่าน mesh/prefab ที่ระบุว่าเป็นคนและเลือก variant/LOD ให้ถูก |
| ใช้ instancing กับคนหรือไม่? | ตรวจ shader/renderer และ GPU frame capture ที่ใช้งานจริง |
| cull ตัวละครตามสูตรใด? | method body หรือ runtime trace พร้อมค่า setting |
| AI/needs อัปเดตกี่ Hz? | profiler หรือเส้นทางเรียกจริง ไม่อนุมานจากชื่อ TickRate |
| GPU skinning เปิดในเครื่องนี้ไหม? | runtime diagnostics/frame capture; patch note ยืนยันการเพิ่มคุณสมบัติเท่านั้น |
| 1,000 คนลื่นเพราะอะไรเป็นสัดส่วนเท่าไร? | วัด CPU/GPU/memory ในเซฟจริง แยกคนทั้งแผนที่กับคนบนจอ |

การศึกษารอบนี้ตอบสถาปัตยกรรมและแผนทดลองได้ แต่ไม่ใช่ reverse engineering ทั้งเกม และยังไม่มีผลวัดที่ใช้รับรอง FPS
