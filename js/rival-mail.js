/* จดหมายจากร้านคู่แข่ง — ผูกกับ hook onBreedLarvaDeath() ใน breeding.js
 *  - ครั้งแรกที่ตัวอ่อน (ที่ฟักจากไข่) ตาย: จดหมายแซะ + กล่องสุ่มระดับ1 (ปกติ)
 *  - ตัวอ่อนตายสะสมครบ 100 ตัว: จดหมายตั้งฉายา + กล่องสุ่มระดับ2 (กลาง)
 * ใช้: receiveComputerMessage (cat-seller.js) + slugDeliveries/SLUG_BOXES/rollBoxGenes (slug-box-shop.js) */
(function () {
  'use strict';

  var FIRST_BODY =
    'หว้ายยย ทากตาย สมน้ำหน้าาา 😹\n\n' +
    'คิดว่าพอไข่ฟักออกมา ได้เลี้ยงตัวอ่อนแล้วมันจะรอดหมดเลยเหรอ? โอกาสรอดมันมีแค่ 70% เองน้า~\n\n' +
    'อัปค่าความสมบูรณ์ (vigor) ซะบ้างนะ ทากจะได้ฉลาดขึ้น เพิ่มโอกาสรอดให้ทั้งทากทั้งเจ้าของ ว้ายๆ\n\n' +
    'อ๋อ… แล้วถ้าอยากเก่งจริง เขาปล่อยให้ตู้สกปรกกันนะ ลองดูสิ ทากจะได้ตายง่ายขึ้นน 555555\n\n' +
    'ปล. ใจดีแป๊บ ให้โอกาสสักรอบละกัน — เอากล่องสุ่มไปเปิดเล่น 1 กล่อง ถือว่า…สมเพชชช 😽\n\n' +
    '— ร้านคู่แข่งที่เก่งกว่า\n(แนบ: กล่องสุ่ม 1 กล่อง ส่งไปที่เคาน์เตอร์ให้แล้ว)';

  var HUNDRED_BODY =
    'จากคู่แข่งอันแสนยิ่งใหญ่\n\n' +
    'ยินดีด้วย เอ็งทำให้ทากตัวอ่อนตุยเย่ไปทั้ง 100 ตัวแล้ว 💀\n\n' +
    'ต่อไปนี้ ข้าจะตั้งฉายาให้ร้านนี้ว่า "ไอ้จา กอก"\n\n' +
    'หัดเลี้ยงให้มันดีกว่านี้ได้มะ จะได้มีคู่แข่งที่คู่ควรกว่านี้~\n\n' +
    'เอ๊า เอาไป ชิ้วๆ — สุ่มระดับ2 จำนวน 1 อัน (ส่งไปที่เคาน์เตอร์แล้ว)\n\n' +
    '— คู่แข่งอันแสนยิ่งใหญ่';

  window.onBreedLarvaDeath = function (tank, larva) {
    try {
      if (typeof G === 'undefined') return;
      G.larvaDeaths = (G.larvaDeaths || 0) + 1;   // นับสะสม (เก็บในเซฟ)

      // ครั้งแรก: จดหมายแซะ + กล่องสุ่มระดับ1 (ปกติ)
      if (!G.rivalDeathMailSent) {
        G.rivalDeathMailSent = true;
        sendRivalMail('rival-larva-death', 'ร้านคู่แข่งส่งมาแซะ', FIRST_BODY);
        grantBox(0);
        pushNews('📬', 'ร้านคู่แข่งส่งจดหมายมาแซะเรื่องตัวอ่อนตาย — แถมกล่องสุ่มให้ 1 กล่อง', 'rivalmail');
      }

      // ตายสะสมครบ 100 ตัว: จดหมายตั้งฉายา + กล่องสุ่มระดับ2 (กลาง)
      if (G.larvaDeaths >= 100 && !G.rival100MailSent) {
        G.rival100MailSent = true;
        sendRivalMail('rival-larva-100', 'คู่แข่งตั้งฉายาให้ร้าน 💀', HUNDRED_BODY);
        grantBox(1);
        pushNews('📬', 'ตัวอ่อนตายครบ 100 ตัว — คู่แข่งตั้งฉายาให้ร้าน แถมกล่องสุ่มระดับ2 ให้ 1 กล่อง', 'rival100');
      }

      if (typeof saveGame === 'function') saveGame();
      if (typeof syncHUD === 'function') syncHUD();
    } catch (e) {}
  };

  function sendRivalMail(id, title, body) {
    if (typeof receiveComputerMessage === 'function')
      receiveComputerMessage({ id: id, type: 'online', title: title, body: body });
  }

  /* กล่องแถมจากคู่แข่ง — ครั้งเดียวตลอดกาลต่อระดับ ผ่านสมุด grantOnce
     ธง rivalDeathMailSent/rival100MailSent อย่างเดียวไม่พอ ถ้าเซฟไม่ติดกล่องจะถูกแจกใหม่ */
  function grantBox(idx) {
    if (typeof grantOnce === 'function') { grantOnce('rival-box-' + idx, function(){ pushRivalBox(idx); }); return; }
    pushRivalBox(idx);
  }
  function pushRivalBox(idx) {
    try {
      if (typeof slugDeliveries !== 'function' || typeof SLUG_BOXES === 'undefined' || typeof rollBoxGenes !== 'function') return;
      var box = SLUG_BOXES[idx];
      if (!box) return;
      slugDeliveries().push({
        id: 'rival-box-' + idx,
        boxIndex: idx,
        name: box.name,
        readyAt: Date.now() + 1500,
        genes: rollBoxGenes(box),
        alerted: false,
        fromRival: true
      });
    } catch (e) {}
  }

  function pushNews(icon, text, tag) {
    if (window.BreedNews && typeof BreedNews.push === 'function')
      BreedNews.push(icon, text, { tag: tag });
  }
})();
