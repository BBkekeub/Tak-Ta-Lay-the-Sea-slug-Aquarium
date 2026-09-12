/* โหมดเปิดไฟล์ตรง ๆ (file://) — ต้องโหลดก่อน importmap และก่อน js/slug-3d.js

   ปัญหา: ตอนดับเบิลคลิก index.html หน้าเว็บอยู่บน file:// ซึ่ง Chrome ถือว่าเป็น
   "origin ว่าง" → fetch() ไปหาไฟล์ในเครื่องถูกบล็อกเสมอ (แม้เปิดแฟล็กแล้วก็ตาม)
   slug-3d.js ใช้ fetch อ่าน behaviors.json / edited-eyes.json / slug-lod*.json
   และ GLTFLoader ของ three ก็ใช้ fetch อ่าน .glb ด้วย → โหลด 3D ไม่ขึ้น ตกไปวาด 2D

   ทางแก้: XMLHttpRequest ยัง "อ่านไฟล์ข้าง ๆ ได้" บน file:// ถ้าเปิด Chrome ด้วย
   --allow-file-access-from-files (ดู PLAY.bat) จึงสลับ fetch ที่ชี้ไป file://
   ให้ไปใช้ XHR แทน แล้วห่อผลลัพธ์กลับเป็น Response ของจริง — ทั้ง .json() .text()
   .arrayBuffer() และ .body (ReadableStream ที่ FileLoader ใช้นับ % โหลด) ใช้ได้ครบ

   บน https (GitHub Pages) ไฟล์นี้ไม่ทำอะไรเลย — fetch เดิมทำงานได้อยู่แล้ว */
(function () {
  if (location.protocol !== 'file:' || typeof window.fetch !== 'function') return;

  var realFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    var raw = typeof input === 'string' ? input
            : (input && input.url) ? input.url
            : String(input);
    var abs;
    try { abs = new URL(raw, location.href); }
    catch (e) { return realFetch(input, init); }

    // ปล่อยของที่ไม่ใช่ไฟล์ในเครื่อง (CDN, data:, blob:) ให้ fetch เดิมจัดการ
    if (abs.protocol !== 'file:') return realFetch(input, init);

    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      try { x.open('GET', abs.href); }
      catch (e) { reject(new TypeError('Failed to fetch ' + abs.href)); return; }
      x.responseType = 'arraybuffer';
      x.onload = function () {
        var buf = x.response;
        if (!buf) { reject(new TypeError('Failed to fetch ' + abs.href)); return; }
        // XHR บน file:// คืน status 0 เสมอ — Response สร้างด้วย 0 ไม่ได้ ต้องยัด 200
        resolve(new Response(buf, {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Length': String(buf.byteLength) }
        }));
      };
      x.onerror = function () { reject(new TypeError('Failed to fetch ' + abs.href)); };
      x.send();
    });
  };

  // ถ้าลืมเปิดแฟล็ก โมดูลจะโหลดไม่ขึ้นเลย → บอกให้รู้ตัวแทนที่จะงงว่าทำไมเป็น 2D
  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      if (window.Slug3D) return;
      console.warn(
        'ไม่พบ Slug3D — น่าจะเปิด index.html ตรง ๆ โดยไม่ได้ผ่าน PLAY.bat\n' +
        'ดับเบิลคลิก PLAY.bat แทน หรือเล่นบนเว็บ:\n' +
        'https://bbkekeub.github.io/Tak-Ta-Lay-the-Sea-slug-Aquarium/'
      );
    }, 3000);
  });
})();
