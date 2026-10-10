---
name: profiling-in-browser-pane
description: วัด FPS/เฟรมไทม์ในแพเนลเบราว์เซอร์ของแอปไม่ได้ ต้องวัดที่ Chrome จริงของผู้เล่น
metadata:
  type: project
---

แพเนลเบราว์เซอร์ในแอป Claude ไม่เดิน `requestAnimationFrame` เลยตอนแพเนลถูกซ่อน
(วัดได้ 0 เฟรม/วินาที) — หน้าโหลด `boot.js` จะค้างกลางคัน และตัวเลขเฟรมไทม์ทุกตัวเชื่อไม่ได้

**Why:** เกมนี้ขับทุกอย่างด้วย rAF · ไม่มีเฟรม = ไม่มีทั้งงานวาดและการ composite
ต่อให้บังคับให้เดินด้วยการแพตช์ `requestAnimationFrame` เป็น `setTimeout` ค่า ms ต่อเฟรม
ก็แกว่ง 3–6 เท่าระหว่างรอบวัด เพราะไม่มี vsync มาคุมจังหวะและ GPU ดันกลับคนละแบบ

**How to apply:** ใช้แพเนลได้เฉพาะ "สัดส่วน" (A/B เปิด-ปิดฟีเจอร์ในรอบวัดติดกัน) ห้ามอ้างค่าสัมบูรณ์
ตัวเลขจริงเอาจาก 2 ทาง: ป้าย FPS ในเกม (`js/fps-meter.js` → เปิดในแท็บ ⚙ ตั้งค่า) อ่านด้วยสกรีนช็อต
computer-use · และ CPU/GPU ต่อโปรเซสด้วย PowerShell (`Get-Process` TotalProcessorTime,
`Get-Counter '\GPU Engine(*)\Utilization Percentage'`) โดยหา pid ของเกมจาก MainWindowTitle
ผู้เล่นเปิดเกมด้วย PLAY.bat = โปรไฟล์แยกที่ `%LocalAppData%\TakTaLay3D\browser-profile`
