/* ============================================================
   dialog-dismiss.js — กดนอกกรอบป๊อปอัพ (พื้นมืดรอบ ๆ) = ปิดป๊อปอัพ ใช้กับ <dialog> แบบโมดอลทุกตัวในเกม
   ไม่ต้องไปแก้ทีละหน้า: ดักที่ document ครั้งเดียว

   ปิด "แบบเดียวกับกด Esc" — ยิงอีเวนต์ cancel ให้หน้านั้นก่อน
     · หน้าไหนมีงานเก็บกวาดตอนปิด (โต๊ะเล่นทาก, ผลแข่งชักเย่อ/วิ่ง) ผูกไว้กับ cancel อยู่แล้ว จึงทำงานครบเหมือนเดิม
     · ไม่มีใคร preventDefault → สั่ง close() เอง (cancel ที่ยิงจากสคริปต์ไม่ปิด dialog ให้อัตโนมัติ)
   หน้าที่อยากให้กดนอกกรอบทำต่างจาก Esc ให้ดัก 'lightdismiss' แล้ว preventDefault
     (ใช้ที่หน้ารับคำท้าชักเย่อ/แข่งวิ่ง: Esc = ไล่ผู้ท้ากลับ แต่เผลอกดนอกกรอบแค่ปิดไว้ก่อน ผู้ท้ายังรออยู่)
   ไม่อยากให้ปิดเลย → ใส่ data-no-light-dismiss บน <dialog>

   ⚠️ ต้องกดลง "และ" ปล่อยนอกกรอบทั้งคู่ — ลากจากในกรอบ (เลือกข้อความ, ลากอาหารในโต๊ะเล่น, ลากสไลเดอร์)
      แล้วไปปล่อยนอกกรอบ เบราว์เซอร์จะยิง click ที่ตัว <dialog> เหมือนกดพื้นหลัง ถ้าไม่เช็กจุดกดลงจะปิดโดยไม่ตั้งใจ
   ⚠️ คลิกบน ::backdrop มี target เป็นตัว <dialog> เอง — แยกกับคลิกบน padding ในกรอบด้วยพิกัดเทียบกรอบ
   ============================================================ */
(()=>{
 function backdropOf(e){
  const d=e.target;
  if(!d||d.tagName!=='DIALOG'||!d.open||d.hasAttribute('data-no-light-dismiss'))return null;
  if(typeof d.matches==='function'&&!d.matches(':modal'))return null;   // dialog แบบไม่โมดอลไม่มีพื้นหลังให้กด
  const r=d.getBoundingClientRect();
  const inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
  return inside?null:d;
 }
 let downOn=null;
 document.addEventListener('pointerdown',e=>{downOn=backdropOf(e);},true);
 document.addEventListener('click',e=>{
  const d=backdropOf(e),started=downOn;downOn=null;
  if(!d||d!==started)return;
  e.preventDefault();e.stopPropagation();
  const light=new Event('lightdismiss',{cancelable:true});
  if(!d.dispatchEvent(light))return;                      // หน้านั้นจัดการเองแล้ว
  const cancel=new Event('cancel',{cancelable:true});
  if(d.dispatchEvent(cancel)&&d.open)d.close();
 },true);
})();
