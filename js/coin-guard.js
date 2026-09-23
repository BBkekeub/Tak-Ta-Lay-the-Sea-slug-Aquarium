/* ============================================================
   coin-guard.js — กันโกงเงิน (โหลดต่อจาก config.js ทันที ก่อนไฟล์ไหนจะแตะเงิน)

   ⚠️ นี่คือ "ทำให้โกงยาก" ไม่ใช่กันได้ 100% — เกมรันในเครื่องผู้เล่นล้วน ไม่มีเซิร์ฟเวอร์
      คนที่นั่งอ่านโค้ดไฟล์นี้ออกยังเรียก addCoin() เอง หรือคำนวณลายเซ็นเซฟใหม่ได้
      ถ้าวันไหนต้องกันจริงจัง (มีลีดเดอร์บอร์ด/ของแลกเงินจริง) ต้องย้ายเงินไปเก็บที่เซิร์ฟเวอร์

   1) G.coin อ่านได้อย่างเดียว — ค่าจริงอยู่ในตัวแปรปิด (closure) ไม่มีใครแตะได้นอกไฟล์นี้
      · พิมพ์ G.coin=999999 ในคอนโซล → ถูกเมิน (มี console.warn)
      · defineProperty ทับก็ไม่ได้ เพราะตั้ง configurable:false ไว้
      โค้ดเกมเปลี่ยนเงินผ่าน addCoin(ส่วนต่าง) ที่เดียวเท่านั้น
      ⚠️ ห้ามเขียน G.coin=… / G.coin+=… / G.coin-=… ในไฟล์ไหนอีก — เงินจะไม่ขยับเลย (เงียบ ๆ แค่มี warn)

   2) เซฟมีลายเซ็น (แฮชทั้งไฟล์ เก็บแยกคีย์ SAVE_KEY+'_sig') + สำเนาเงินพร้อมตราประทับในเซฟ (ck)
      แก้ไฟล์เซฟนอกเกมแล้วลายเซ็นไม่ตรง → ย้อนเงินกลับเป็นค่าใน ck (ค่าที่เกมเซฟไว้จริง) + เตือน
      · ck พังด้วย (แก้ทั้งคู่แต่คำนวณตราไม่เป็น) → ไม่รู้ค่าจริง ใช้เงินเริ่มเกม START_COIN
      · ลายเซ็นไม่ตรงแต่เงินไม่ได้ถูกแก้ (เช่น เปิดสองแท็บเซฟสลับกัน) → เงินเท่าเดิม แค่ขึ้นเตือน
      · เซฟรุ่นก่อนมีระบบนี้ (ไม่มีทั้งลายเซ็นและ ck) → เชื่อตามเซฟหนึ่งครั้ง แล้วเซฟรอบถัดไปจะติดลายเซ็นเอง

   สถิติรับ/จ่าย (บัญชีเงิน) ยังนับที่ econ-stats.js จากส่วนต่างของ G.coin ทุกวินาทีเหมือนเดิม
   ============================================================ */
const CoinGuard=(()=>{
  let coin=Number.isFinite(G.coin)?G.coin:START_COIN;
  let loading=true,tampered=false;
  Object.defineProperty(G,'coin',{enumerable:true,configurable:false,
    get:()=>coin,
    set:()=>console.warn('[coin] แก้ G.coin ตรง ๆ ไม่ได้ — โค้ดเกมต้องใช้ addCoin()')});

  const SALT='tak-ta-lay|ทากทะเล|c01n';
  /* FNV-1a + murmur-mix สองสาย = ~64 บิต พอจับการแก้ไฟล์ (ไม่ใช่การเข้ารหัสจริง) */
  function sign(str){
    let a=0x811c9dc5,b=0x9747b28c;const s=SALT+str;
    for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);
      a=Math.imul(a^c,16777619);b=Math.imul(b^c,0x5bd1e995);b^=b>>>15;}
    return (a>>>0).toString(36)+'.'+(b>>>0).toString(36);
  }
  const ck=()=>String(coin)+'~'+sign('ck|'+coin);
  function unpack(v){
    if(typeof v!=='string')return null;
    const i=v.lastIndexOf('~'),t=v.slice(0,i),n=+t;
    return i>0&&Number.isFinite(n)&&sign('ck|'+t)===v.slice(i+1)?n:null;
  }
  /* ใช้ได้เฉพาะตอนบูต (save.js เรียกตอนโหลดเซฟ แล้วปิดด้วย lock()) — หลังจากนั้นเรียกจากคอนโซลก็ไม่มีผล */
  function load(raw,d,sig){
    if(!loading)return;
    const saved=Number.isFinite(+d.coin)?+d.coin:coin;
    if(sig==null&&d.ck==null){coin=saved;return;}             // เซฟรุ่นเก่า ก่อนมีระบบนี้
    if(sig===sign(raw)){coin=saved;return;}
    const back=unpack(d.ck);
    coin=back??START_COIN;tampered=true;
    console.warn('[coin] เซฟถูกแก้นอกเกม — ย้อนเงินกลับเป็น',coin,'(ในเซฟเขียนไว้',saved+')');
  }
  function lock(){
    loading=false;
    if(tampered)setTimeout(()=>{if(typeof toast==='function')toast('⚠️ ไฟล์เซฟถูกแก้นอกเกม — ย้อนเงินกลับเป็นค่าที่ถูกต้องแล้ว','bad');},1500);
  }
  function add(delta){
    if(!Number.isFinite(delta)){console.warn('[coin] addCoin ได้ค่าที่ไม่ใช่ตัวเลข',delta);return coin;}
    coin+=delta;return coin;
  }
  return {add,ck,sign,load,lock};
})();
/* ช่องทางเดียวที่โค้ดเกมใช้เปลี่ยนเงิน · บวก = ได้เงิน ลบ = จ่าย */
function addCoin(delta){
  const coin=CoinGuard.add(delta);
  syncCoinHUD();
  return coin;
}
/* เงินเปลี่ยนได้โดยไม่เรียก syncHUD ทั้งหน้า เช่น ค่าเข้าร้านของลูกค้า */
function syncCoinHUD(){
  if(document.hidden)return;
  const el=document.getElementById('hCoin'),value=String(G.coin);
  if(el&&el.textContent!==value)el.textContent=value;
}
document.addEventListener('visibilitychange',syncCoinHUD);
