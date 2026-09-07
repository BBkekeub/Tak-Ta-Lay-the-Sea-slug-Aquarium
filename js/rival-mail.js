/* จดหมายจากร้านคู่แข่ง — เด้งครั้งเดียว ตอนตัวอ่อนที่ฟักจากไข่ "ตายเป็นครั้งแรก"
 * แซะผู้เล่นเรื่องโอกาสรอด 70% แล้วแถมกล่องสุ่มให้ 1 กล่อง ("ให้โอกาสรอบนึง")
 * ผูกกับ: ระบบคอมพิวเตอร์ร้าน (receiveComputerMessage ใน cat-seller.js)
 *        + ระบบกล่องสุ่ม (slugDeliveries/SLUG_BOXES/rollBoxGenes ใน slug-box-shop.js)
 * ถูกเรียกจาก hook onBreedLarvaDeath() ที่ฝังไว้ใน breeding.js */
(function () {
  'use strict';

  window.onBreedLarvaDeath = function (tank, larva) {
    try {
      if (typeof G === 'undefined') return;
      if (G.rivalDeathMailSent) return;            // เด้งครั้งเดียวพอ (เก็บในเซฟ)
      G.rivalDeathMailSent = true;

      var body =
        'หว้ายยย ทากตาย สมน้ำหน้าาา 😹\n\n' +
        'คิดว่าพอไข่ฟักออกมา ได้เลี้ยงตัวอ่อนแล้วมันจะรอดหมดเลยเหรอ? โอกาสรอดมันมีแค่ 70% เองน้า~\n\n' +
        'อัปค่าความสมบูรณ์ (vigor) ซะบ้างนะ ทากจะได้ฉลาดขึ้น เพิ่มโอกาสรอดให้ทั้งทากทั้งเจ้าของ ว้ายๆ\n\n' +
        'อ๋อ… แล้วถ้าอยากเก่งจริง เขาปล่อยให้ตู้สกปรกกันนะ ลองดูสิ ทากจะได้ตายง่ายขึ้นน 555555\n\n' +
        'ปล. ใจดีแป๊บ ให้โอกาสสักรอบละกัน — เอากล่องสุ่มไปเปิดเล่น 1 กล่อง ถือว่า…สมเพชชช 😽\n\n' +
        '— ร้านคู่แข่งที่เก่งกว่า\n(แนบ: กล่องสุ่ม 1 กล่อง ส่งไปที่เคาน์เตอร์ให้แล้ว)';

      if (typeof receiveComputerMessage === 'function') {
        receiveComputerMessage({
          id: 'rival-larva-death',
          type: 'online',
          title: 'ร้านคู่แข่งส่งมาแซะ',
          body: body
        });
      }

      grantFreeBox();  // แถมกล่องสุ่ม 1 กล่อง (กล่องปกติ) มาที่เคาน์เตอร์

      if (window.BreedNews && typeof BreedNews.push === 'function') {
        BreedNews.push('📬', 'ร้านคู่แข่งส่งจดหมายมาแซะเรื่องตัวอ่อนตาย — แถมกล่องสุ่มให้ 1 กล่อง', { tag: 'rivalmail' });
      }
      if (typeof saveGame === 'function') saveGame();
      if (typeof syncHUD === 'function') syncHUD();
    } catch (e) {}
  };

  function grantFreeBox() {
    try {
      if (typeof slugDeliveries !== 'function' || typeof SLUG_BOXES === 'undefined' || typeof rollBoxGenes !== 'function') return;
      var box = SLUG_BOXES[0]; // กล่อง "ปกติ"
      slugDeliveries().push({
        id: 'rival' + Date.now() + '_' + Math.floor(Math.random() * 10000),
        boxIndex: 0,
        name: box.name,
        readyAt: Date.now() + 1500,   // หน่วงนิดให้รู้สึกเหมือนกำลังส่งมา แล้วเด้ง "ถึงแล้ว"
        genes: rollBoxGenes(box),
        alerted: false,
        fromRival: true
      });
    } catch (e) {}
  }
})();
