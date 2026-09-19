# 05 — การวาดภาพ Culling, LOD และ Batching

## หลักฐานและข้อจำกัด

boot.config เปิด graphics jobs สองรายการ และพบ CharacterCullManager พร้อมค่าชื่อ Min/Max/Bias ส่วนแพตช์ผู้พัฒนาพูดถึงการปรับ LOD ของสิ่งของตามขนาดบนจอ ไม่ควรขยายความว่าโมเดลตัวละครทุกตัวมี LOD กี่ระดับ ดู [หลักฐานแพตช์](../09-sources/README.md)

Culling คือไม่ส่งงานวาดบางวัตถุ ส่วน LOD คือเลือกรายละเอียดตามความสำคัญบนจอ ทั้งสองอย่างไม่ควรยกเลิกการจำลองชีวิตของคน การเห็นชื่อ CharacterCullManager ยังไม่บอกว่าใช้ frustum, ระยะ, จำนวนคน หรือกฎผสม

## Batching มีหลายแบบ

รวม draw calls, ใช้ geometry ร่วม, instancing และลดการเปลี่ยน shader state ไม่ใช่สิ่งเดียวกัน การพบ Unity หรือ URP ไม่ได้พิสูจน์ว่าใช้ทุกวิธี

ตัวอย่างข้อจำกัดจาก Unity: static batching ใช้กับวัตถุคงที่ ไม่รองรับ Skinned Mesh Renderer และความโปร่งใสจำกัดการรวมงานเพราะต้องรักษาลำดับ [เอกสาร Unity](https://docs.unity3d.com/Manual/DrawCallBatching.html)

## เกมเราทำดีอยู่แล้ว

beginPersonBatch/flushPersonBatch รวบคนก่อนวาด paintPersonMesh มี pass สำหรับตัวบัง คน และกระจก จึงไม่ควรเสนอว่าแก้ได้ด้วยการรวม draw calls อย่างเดียว เกมเราเริ่มรวมแล้ว

personOnScreen ตัดคนนอกจอ และ drawPerson แคชท่าที่ 12 Hz สำหรับยืนดูหรือ 30 Hz สำหรับเคลื่อนไหว การแพนไม่เปลี่ยนพิกัดโลกจึง reuse ท่าได้ นี่ควรเก็บไว้

## จุดที่ยังมีค่าใช้จ่าย

รอบวาดยังประกอบ float buffer และเรียก gl.bufferData แบบ STREAM_DRAW มีการถ่ายภาพจาก WebGL canvas ไป Canvas2D ผ่าน drawImage และขนาด render target ใช้ devicePixelRatio สูงสุด 2 การถ่ายข้าม canvas มีต้นทุนที่ต้องวัด ไม่ใช่ฟันธงว่าเป็น readback CPU เสมอ

คนเดินในเส้นทาง cache ยัง map faces และ vertices เพื่อเลื่อนตำแหน่ง ทำให้มี allocation แม้ไม่ได้สร้างท่าใหม่ทุกเฟรม

## แนวทางทดลองตามลำดับ

เริ่มจาก reuse typed buffers กับตัวนับจำนวน active และใช้ transform ใน shader คง geometry ไว้บน GPU ตรวจว่าการแพนไม่เพิ่ม mesh builds จากนั้นค่อยพิจารณา instancing ตามกลุ่มเมช/วัสดุถ้า draw submission ยังหนัก

ทดลองโหมดต่ำ render scale 1 เทียบกับ 2 โดยแยก CSS size ออกจากขนาด buffer การเพิ่มทั้งกว้างและสูงสองเท่าเพิ่มจำนวนพิกเซลเป็นสี่เท่า แต่ไม่ใช่รับประกันว่าเวลา GPU เพิ่มสี่เท่า

รักษา depth กับกระจกตู้ ทั้งคนอยู่หน้าตู้ หลังตู้ และถือของ อย่ารวมทุกอย่างเป็นภาพแบนจนบังผิด ย้าย renderer ต้องตรวจ screenshot สี่มุมรวมเงา ป้าย และ hit test

## ข้อเสนอ LOD ของเรา

ใช้ขนาดตัวละครบนจอเป็นตัวควบคุม พร้อม hysteresis กันสลับไปมาขณะซูม เริ่มทดลอง 5,000/2,500/1,000 สามเหลี่ยมเป็นตัวเลือก ไม่ใช่ข้อบังคับหรือค่าจาก Campus เลือก threshold หลังดูความต่างของภาพและ frame time จริง
