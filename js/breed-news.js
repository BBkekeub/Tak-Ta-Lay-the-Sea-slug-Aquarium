/* ระบบแจ้งข่าวผสมพันธุ์ทาก — เด้งบนคอม (Notification API) + แผงข่าวในเกม
 * อ่านสถานะจาก breederState() ที่ breeding.js สร้างไว้ แล้วตรวจจับ "การเปลี่ยนสเตจ"
 * ในทุกตู้เพาะพันธุ์ (รวมตู้ในที่พักพิง) แม้ผู้เล่นจะไม่ได้เปิดดูตู้นั้นอยู่
 * โหลดหลัง breeding.js / shop-floor.js เพราะใช้ G, isBreeder, breederState, toast */
(function () {
  'use strict';

  var ICON = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E%3Ctext%20y='.9em'%20font-size='90'%3E%F0%9F%90%9A%3C/text%3E%3C/svg%3E";
  var LOG = [];
  var MAX = 60;
  var unread = 0;
  var BN = { log: LOG };
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

  /* ---------- desktop notification ---------- */
  function canNotify() { return typeof Notification !== 'undefined'; }
  function notifyDesktop(title, body, tag) {
    if (!canNotify() || Notification.permission !== 'granted') return;
    try { new Notification(title, { body: body, tag: tag, icon: ICON }); } catch (e) {}
  }
  function requestPerm() {
    if (!canNotify() || Notification.permission !== 'default') return;
    try {
      var r = Notification.requestPermission(function () { updatePermUI(); });
      if (r && typeof r.then === 'function') r.then(updatePermUI);
    } catch (e) {}
  }

  /* ---------- push a news item ---------- */
  function push(icon, text, opt) {
    opt = opt || {};
    LOG.unshift({ t: Date.now(), icon: icon, text: text });
    if (LOG.length > MAX) LOG.length = MAX;
    if (!panelOpen) { unread++; syncBell(); }
    if (typeof toast === 'function' && opt.toast !== false) {
      toast(icon + ' ' + text, opt.kind || 'good');
    }
    if (opt.desktop !== false) {
      notifyDesktop('ร้านทากทะเล — ข่าวผสมพันธุ์', icon + ' ' + text, opt.tag);
    }
    renderPanel();
  }
  BN.push = push;

  /* ---------- ตรวจจับการเปลี่ยนสเตจ ---------- */
  var snap = {}; // id ตู้ -> { phase, eggs, ready }
  function readyStuck(b) {
    return (b.larvae || []).filter(function (l) { return l.ready; }).length;
  }
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

      // idle -> mating : ผู้เล่นเพิ่งกดเริ่มเอง → ลงแผงข่าวอย่างเดียว
      if (prev.phase !== 'mating' && cur.phase === 'mating')
        push('💞', nm + ' เริ่มผสมพันธุ์แล้ว', { desktop: false, toast: false, tag: 'mate' + id });

      // -> eggs : วางไข่
      if (prev.phase !== 'eggs' && cur.phase === 'eggs')
        push('🥚', nm + ' วางไข่แล้ว ' + cur.eggs + ' ฟอง — รอฟักอีกสักครู่', { tag: 'eggs' + id });

      // -> hatching : พร้อมฟัก (สำคัญ ต้องกดฟักเอง)
      if (prev.phase !== 'hatching' && cur.phase === 'hatching')
        push('🐣', nm + ' ไข่พร้อมฟักแล้ว! เปิดตู้แล้วกดฟักได้เลย', { kind: 'good', tag: 'hatch' + id });

      // hatching -> idle : ฟักครบรอบ
      if (prev.phase === 'hatching' && cur.phase === 'idle')
        push('✅', nm + ' ฟักไข่ครบรอบแล้ว', { tag: 'done' + id });

      // ตัวอ่อนโตเต็มวัยแต่โซนเลี้ยงเต็ม (จำนวน ready เพิ่มขึ้น)
      if (cur.ready > prev.ready)
        push('📦', nm + ' มีตัวอ่อนโตเต็มวัยแล้ว แต่โซนเลี้ยงเต็ม — ย้าย/ขายทากเพื่อเปิดพื้นที่', { kind: 'bad', tag: 'grown' + id });

      snap[id] = cur;
    }
  }

  /* ---------- UI: ปุ่มกระดิ่ง + แผงข่าว ---------- */
  var panelOpen = false, bell, badge, panel;
  function timeStr(t) {
    try { return new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }
  function escapeText(s) {
    return String(s).replace(/[&<>]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m];
    });
  }
  function buildUI() {
    // ปุ่มลอยมุมขวาบน — เห็นชัดตลอด ไม่หลุดออกนอกจอเหมือนตอนแปะบนแถบเครื่องมือ
    bell = document.createElement('button');
    bell.id = 'breedNewsBell';
    bell.type = 'button';
    bell.title = 'ข่าวผสมพันธุ์';
    bell.style.cssText = 'position:fixed;top:54px;right:14px;z-index:9000;height:34px;padding:0 12px;border-radius:17px;border:1px solid #50605f;background:#141c20;color:#e6dfcd;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.4);display:flex;align-items:center;gap:5px';
    bell.textContent = '🔔 ข่าว';

    badge = document.createElement('span');
    badge.style.cssText = 'position:absolute;top:-7px;right:-7px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#d9534f;color:#fff;font-size:11px;font-weight:600;display:none;align-items:center;justify-content:center;line-height:18px;box-sizing:border-box';
    bell.appendChild(badge);
    document.body.appendChild(bell);

    panel = document.createElement('div');
    panel.id = 'breedNewsPanel';
    panel.hidden = true;
    panel.style.cssText = 'position:fixed;top:96px;right:14px;z-index:9000;width:320px;max-width:92vw;max-height:64vh;overflow:auto;background:#141c20;border:1px solid #50605f;border-radius:10px;color:#e6dfcd;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.45)';
    document.body.appendChild(panel);

    bell.addEventListener('click', function (ev) {
      ev.stopPropagation();
      panelOpen = !panelOpen;
      panel.hidden = !panelOpen;
      if (panelOpen) { unread = 0; syncBell(); requestPerm(); renderPanel(); }
    });
    // คลิกนอกแผง = ปิด
    document.addEventListener('click', function (ev) {
      if (!panelOpen) return;
      if (panel.contains(ev.target) || bell.contains(ev.target)) return;
      panelOpen = false; panel.hidden = true;
    });

    renderPanel();
  }
  function syncBell() {
    if (!badge) return;
    if (unread > 0) { badge.style.display = 'flex'; badge.textContent = unread > 9 ? '9+' : String(unread); }
    else badge.style.display = 'none';
  }
  function permLabel() {
    if (!canNotify()) return 'เบราว์เซอร์นี้ไม่รองรับแจ้งเตือนบนคอม';
    if (Notification.permission === 'granted') return '🔔 แจ้งเตือนบนคอม: เปิดอยู่';
    if (Notification.permission === 'denied') return '🔕 แจ้งเตือนบนคอมถูกบล็อก — เปิดได้ที่ไอคอน 🔒 หน้าเว็บ';
    return '';
  }
  function updatePermUI() { syncBell(); renderPanel(); }
  BN.updatePermUI = updatePermUI;
  function renderPanel() {
    if (!panel) return;
    var needEnable = canNotify() && Notification.permission === 'default';
    var perm = permLabel();
    var html = '<div style="padding:10px 12px;border-bottom:1px solid #2c3a3a;display:flex;align-items:center;gap:8px">'
      + '<b style="flex:1">ข่าวผสมพันธุ์ทาก</b>'
      + '<button id="bnClear" class="tbtn" style="font-size:11px;padding:2px 8px">ล้าง</button></div>';
    if (needEnable)
      html += '<div style="padding:8px 12px;border-bottom:1px solid #2c3a3a"><button id="bnEnable" class="tbtn" style="width:100%">🔔 เปิดแจ้งเตือนบนคอม</button></div>';
    else if (perm)
      html += '<div style="padding:6px 12px;border-bottom:1px solid #2c3a3a;font-size:11px;opacity:.8">' + perm + '</div>';
    if (!LOG.length)
      html += '<div style="padding:16px 12px;opacity:.7;text-align:center">ยังไม่มีข่าว — เริ่มผสมพันธุ์ทากแล้วสถานะจะมาแจ้งที่นี่</div>';
    else
      html += LOG.map(function (it) {
        return '<div style="padding:8px 12px;border-bottom:1px solid #202b2b;display:flex;gap:8px;align-items:flex-start">'
          + '<span style="font-size:16px;line-height:1.2">' + it.icon + '</span>'
          + '<div style="flex:1"><div>' + escapeText(it.text) + '</div>'
          + '<div style="font-size:11px;opacity:.55;margin-top:2px">' + timeStr(it.t) + '</div></div></div>';
      }).join('');
    panel.innerHTML = html;
    var c = panel.querySelector('#bnClear');
    if (c) c.onclick = function () { LOG.length = 0; unread = 0; syncBell(); renderPanel(); };
    var e = panel.querySelector('#bnEnable');
    if (e) e.onclick = function () { requestPerm(); };
  }

  /* ---------- start ---------- */
  function start() { buildUI(); syncBell(); setInterval(scan, 700); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
