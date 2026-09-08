/* modes.js — "โหมดเดียวต่อครั้ง"
   โหมด = สถานะที่เปิดค้างไว้แล้วเปลี่ยนความหมายของการคลิกบนแคนวาส
   (จัดของในตู้ · วางอาหาร · แปรงขัดตู้ · วางประตู · เลือกช่องขยายร้าน · ถือของจะวาง)

   เดิมแต่ละโหมดไล่ปิดโหมดอื่นเองทีละคู่ ทำให้ต้องเขียน n² จุดและตกหล่นเสมอ
   (เช่น เปิดโหมดวางอาหารทับโหมดจัดของ แล้วทั้งสองโหมดเปิดค้างพร้อมกัน)
   ที่นี่รวมไว้จุดเดียว: แต่ละโหมดลงทะเบียนวิธี "เช็กว่าเปิดอยู่ไหม" กับ "สั่งปิด"
   แล้วตอนเปิดโหมดใหม่ก็เรียก enterExclusiveMode() ครั้งเดียว

   group แยกสองใบเพราะอยู่คนละหน้าจอ ไม่มีทางเปิดพร้อมกัน:
     'tank'  = โหมดที่อยู่ในหน้าตู้
     'floor' = โหมดที่อยู่บนพื้นร้าน                                          */
const APP_MODES = new Map();

function registerMode(name, group, isOn, turnOff){ APP_MODES.set(name, {group, isOn, turnOff}); }

/* เปิดโหมด name → ปิดโหมดอื่นในกลุ่มเดียวกันให้หมด
   turnOff ของบางโหมดไปกดปุ่มจริงบนหน้าจอ จึงกัน error ไม่ให้ล้มทั้งชุด */
function enterExclusiveMode(name){
  const me = APP_MODES.get(name); if(!me) return;
  for(const [key, m] of APP_MODES){
    if(key===name || m.group!==me.group) continue;
    try{ if(m.isOn()) m.turnOff(); }catch(err){ console.warn('[modes] ปิดโหมด '+key+' ไม่สำเร็จ', err); }
  }
}

/* ปิดทุกโหมดในกลุ่ม (ใช้ตอนเข้า/ออกจากตู้) — ไม่ใส่ group = ปิดหมดทุกกลุ่ม */
function exitModes(group){
  for(const [key, m] of APP_MODES){
    if(group && m.group!==group) continue;
    try{ if(m.isOn()) m.turnOff(); }catch(err){ console.warn('[modes] ปิดโหมด '+key+' ไม่สำเร็จ', err); }
  }
}
