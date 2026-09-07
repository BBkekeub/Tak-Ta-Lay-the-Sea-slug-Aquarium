/* แจ้งเตือนเรื่องทาก/ผสมพันธุ์ → เข้า "คอมพิวเตอร์ร้าน" ในเกม (กล่องจดหมายเดียวกับเควส/ออนไลน์)
 * ตรวจทุกตู้เพาะพันธุ์เบื้องหลัง (รวมตู้ในที่พักพิง) แม้ผู้เล่นไม่ได้เปิดดูตู้นั้นอยู่
 *  - โผล่เป็นข้อความในคอมพิวเตอร์ร้าน + มีไฟ !! เตือนที่จอคอมในเกม
 *  - เด้ง Windows notification ด้วย (ถ้าอนุญาต)
 *  - เด้ง toast ในเกม
 * ใช้: receiveComputerMessage (cat-seller.js), toast (shop-floor.js), G/isBreeder/breederState (breeding.js)
 * โหลดหลังไฟล์เหล่านั้น */
(function () {
  'use strict';

  var ICON = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E%3Ctext%20y='.9em'%20font-size='90'%3E%F0%9F%90%9A%3C/text%3E%3C/svg%3E";
  var BN = {};
  window.BreedNews = BN;

  /* ---------- ชื่อตู้แบบอ่านง่าย ---------- */
  function breederName(o) {
    if (o._newsName) return o._newsName;
    var base = (o.def && o.def.name) || 'ตู้เพาะพันธุ์';
    var n = 1;
    try {
      var all = [].concat(G.objs || [], G.shelter || [])
        .filter(function (x) { return typeof isBreeder === 'function' && isBreeder(x); });
      var idx = all.indexOf(o);
      n = idx >= 0 ? idx + 1 : 1;
    } catch (e) {}
    o._newsName = base + ' #' + n;
    return o._newsName;
  }

  /* ---------- Windows desktop notification (เสริม) ---------- */
  function canNotify() { return typeof Notification !== 'undefined'; }
  function notifyDesktop(title, body, tag) {
    if (!canNotify() || Notification.permission !== 'granted') return;
    try { new Notification(title, { body: body, tag: tag, icon: ICON }); } catch (e) {}
  }
  // ขอสิทธิ์แจ้งเตือน Windows ครั้งเดียว ตอนผู้เล่นคลิกครั้งแรก (ต้องมี user gesture)
  function armPermission() {
    if (!canNotify() || Notification.permission !== 'default') return;
    var ask = function () { try { Notification.requestPermission(); } catch (e) {} document.removeEventListener('pointerdown', ask, true); };
    document.addEventListener('pointerdown', ask, true);
  }

  /* ---------- ยิงแจ้งเตือน 1 รายการ ---------- */
  // เข้าคอมพิวเตอร์ร้าน (หน้าหลัก) + เด้ง Windows + toast
  function announce(icon, title, detail, opt) {
    opt = opt || {};
    if (typeof receiveComputerMessage === 'function') {
      receiveComputerMessage({
        id: 'breed-' + (opt.tag || 'x') + '-' + Date.now(),
        type: 'online',
        title: icon + ' ' + title,
        body: detail,
        repeating: true   // แจ้งเตือนสถานะผสมพันธุ์ = ภารกิจวนซ้ำ (เด้งได้ทุกรอบ ไม่ติด ledger)
      });
    }
    if (opt.desktop !== false) notifyDesktop('ร้านทากทะเล — ' + title, detail, opt.tag);
    if (typeof toast === 'function' && opt.toast !== false) toast(icon + ' ' + detail, opt.kind || 'good');
    if (typeof saveGame === 'function') saveGame();
  }
  // ให้โมดูลอื่น (เช่น rival-mail) เด้ง Windows + toast ได้ โดยไม่ยิงเข้าคอมซ้ำ
  BN.push = function (icon, text, opt) {
    opt = opt || {};
    notifyDesktop('ร้านทากทะเล', icon + ' ' + text, opt.tag);
    if (typeof toast === 'function' && opt.toast !== false) toast(icon + ' ' + text, opt.kind || 'good');
  };
  BN.announce = announce;

  /* ---------- ตรวจจับการเปลี่ยนสเตจผสมพันธุ์ ---------- */
  var snap = {}; // id ตู้ -> { phase, eggs, ready }
  function readyStuck(b) { return (b.larvae || []).filter(function (l) { return l.ready; }).length; }
  function scan() {
    if (typeof G === 'undefined' || typeof isBreeder !== 'function' || typeof breederState !== 'function') return;
    var tanks = [].concat(G.objs || [], G.shelter || []).filter(isBreeder);
    for (var i = 0; i < tanks.length; i++) {
      var o = tanks[i];
      var b = breederState(o);
      var id = o.id;
      var cur = { phase: b.phase, eggs: (b.eggs || []).length, ready: readyStuck(b) };
      var prev = snap[id];
      if (!prev) { snap[id] = cur; continue; } // ครั้งแรกที่เห็น: จดไว้เฉย ๆ ไม่แจ้ง
      var nm = breederName(o);

      // -> eggs : วางไข่
      if (prev.phase !== 'eggs' && cur.phase === 'eggs')
        announce('🥚', 'ทากวางไข่แล้ว', nm + ' วางไข่แล้ว ' + cur.eggs + ' ฟอง — อีกสักครู่จะพร้อมฟัก', { tag: 'eggs' + id });

      // -> hatching : พร้อมฟัก (สำคัญ ต้องกดฟักเอง)
      if (prev.phase !== 'hatching' && cur.phase === 'hatching')
        announce('🐣', 'ไข่พร้อมฟักแล้ว!', nm + ' ไข่พร้อมฟักแล้ว เปิดตู้แล้วกดฟักไข่ได้เลย', { tag: 'hatch' + id });

      // hatching -> idle : ฟักครบรอบ
      if (prev.phase === 'hatching' && cur.phase === 'idle')
        announce('✅', 'ฟักไข่ครบรอบ', nm + ' ฟักไข่ครบทุกฟองแล้ว', { tag: 'done' + id });

      // ตัวอ่อนโตเต็มวัยแต่โซนเลี้ยงเต็ม (จำนวน ready เพิ่มขึ้น)
      if (cur.ready > prev.ready)
        announce('📦', 'ตัวอ่อนรอพื้นที่', nm + ' ตัวอ่อนโตเต็มวัยแล้ว แต่โซนเลี้ยงเต็ม — ย้าย/ขายทากเพื่อเปิดพื้นที่รับตัวใหม่', { kind: 'bad', tag: 'grown' + id });

      snap[id] = cur;
    }
  }

  /* ---------- start ---------- */
  function start() { armPermission(); setInterval(scan, 700); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
