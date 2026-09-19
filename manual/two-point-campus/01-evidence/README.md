# 01 — หลักฐานจากเกมที่ติดตั้ง

## ตรวจอะไรไปแล้ว

พบเกมจาก Steam libraryfolders.vdf ใน `C:/Program Files (x86)/Steam/steamapps/common/Two Point Campus` และอ่าน version.txt ได้เวอร์ชัน 10.3.169253+2024-12-06.1241

อ่าน boot.config, ScriptingAssemblies.json, รายการปลั๊กอิน และตารางชื่อใน IL2CPP global-metadata.dat รุ่น metadata 27 ตรวจ magic และขอบเขตตารางก่อนอ่าน เก็บ fingerprint และรายการหลักฐานใน [local-snapshot.json](../evidence/local-snapshot.json) และ [metadata-symbols.json](../evidence/metadata-symbols.json)

## ผลตรวจ

| หลักฐาน | สิ่งที่ยืนยัน | สิ่งที่ยังยืนยันไม่ได้ |
| --- | --- | --- |
| GameAssembly.dll และ il2cpp_data | บิลด์มีโครงสร้าง IL2CPP | ความเร็วเหนือ JavaScript กี่เท่า |
| Unity.Entities.dll, Unity.Entities.Hybrid.dll | มีแพ็กเกจ ECS ในรายการ assemblies | ทุกระบบเกมเป็น ECS |
| Unity.Burst.dll, lib_burst_generated.dll | มี runtime และผลคอมไพล์ Burst | ทุก method ใช้ Burst หรือทำงานหลายเธรด |
| Unity.Jobs.dll | มีส่วนประกอบ Job System | ทุกงานถูก schedule ไป worker |
| URP runtime/shader assemblies | มีองค์ประกอบ URP | ค่าแสง เงา และ SRP Batcher ขณะเล่น |
| gfx-enable-gfx-jobs=1 และ gfx-enable-native-gfx-jobs=1 | ไฟล์บูตเปิดสองตัวเลือก | driver/runtime เปิดใช้ได้สำเร็จในทุกเครื่อง |
| gc-max-time-slice=3 | มีค่าตั้งชื่อดังกล่าวเท่ากับ 3 | GC ใช้เวลา 3 ms ทุกเฟรม หรือไม่มีการหยุดยาว |

## รายละเอียดที่พบในตารางชื่อ

CharacterCullManager, CharacterCullMin/Max, CharacterCullBias, CharacterPrefabPool และ AnimationSkinningQuality_Low/High เป็นชื่อที่ชี้ว่ามีโครงสร้างรองรับด้านนั้น ไม่ใช่การอ่านตัว method จึงยังไม่รู้สูตร ระยะ เพดาน pool หรือค่าที่ใช้จริง

ชื่อ ESCharacterClusterMovement, ESCharacterModifier_Attribute_ModifierJob และกลุ่ม ESExecuteTask แสดงการแยกระบบเชิงหน้าที่ ส่วน ESNavPathPreUpdateSync/Update/PostUpdateSync ชี้ว่ามีขั้นตอนเกี่ยวกับเส้นทางแยกกัน แต่ไม่บอก thread หรืออัลกอริทึม

พบ 196 ชื่อที่เข้าตัวกรอง BurstDirectCall ในรอบตรวจนี้ ตัวเลขนี้คือจำนวนชื่อที่ regex พบ ไม่ใช่จำนวนงานต่อเฟรม บางชื่อมี RunWithoutJobSystem จึงยิ่งไม่ควรแปลว่า Burst เท่ากับ multithreading

## ไม่ได้ทำในรอบนี้

ไม่ได้ถอด native method bodies, แตก asset bundles เพื่อนับโมเดล, เปิดเซฟทดสอบฝูงคน หรือจับ GPU frame จึงไม่มีค่าจำนวนเหลี่ยม กระดูก draw calls และ FPS ของ Campus จริง มีเพียงรายการ bundles ที่พบ 159 ไฟล์ภายใต้ StreamingAssets/aa ไม่ตีความว่าจำนวนนี้เท่ากับจำนวนโมเดล

การอ่านโฟลเดอร์ LocalLow ของ Two Point และข้อมูลฮาร์ดแวร์ผ่าน CIM ถูกระบบปฏิเสธสิทธิ์ ไม่จำเป็นต่อข้อค้นพบในคู่มือนี้ จึงไม่ได้ใช้ข้อมูลเซฟหรืออ้างว่าสเปคเครื่องผู้ใช้เป็นสเปคฐานทดสอบ

## หลักฐานจากผู้พัฒนาที่สำคัญกว่าเดาชื่อ

แพตช์ Steam วันที่ 3 เมษายน 2024 บิลด์ 10.2.144722 ยืนยัน render jobs, GPU skinning และการปรับประสิทธิภาพงานภาพหลายด้าน ดูข้อสรุปแบบย่อและลิงก์ต้นฉบับที่ [09 แหล่งข้อมูล](../09-sources/README.md) บิลด์ติดตั้งใหม่กว่าแพตช์นี้ แต่ไม่ได้แปลว่าทุก setting เปิดเหมือนกันในทุกแพลตฟอร์ม
