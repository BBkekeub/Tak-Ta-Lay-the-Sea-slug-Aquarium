/* ตัววัดเศรษฐกิจ — ไว้ดูว่ารายได้จริงต่อชั่วโมงเท่าไหร่ จะได้จูน EXPAND_BASE ใน config.js ได้โดยไม่ต้องเดา
   ทำงานด้วยการอ่าน G.coin ทุกวินาทีแล้วดูส่วนต่าง จึงไม่ต้องแก้ไฟล์อื่นเลย
   นับเวลาเฉพาะตอนแท็บเปิดอยู่ · ลบไฟล์นี้ (และ <script> ใน index.html) ทิ้งได้ ไม่กระทบเกม */
(()=>{
 const line=document.createElement('p');line.style.cssText='font-size:12px;line-height:1.6;opacity:.85';
 let last=null;
 function panel(){const p=document.querySelector('[data-panel="settings"]');if(p&&!line.parentNode)p.append(line);}
 setInterval(()=>{
  const s=G.stats||(G.stats={earned:0,spent:0,sec:0});
  if(last===null)last=G.coin;
  const d=G.coin-last;last=G.coin;
  if(d>0)s.earned+=d;else if(d<0)s.spent-=d;
  if(document.visibilityState==='visible')s.sec++;
  if(typeof checkFiveMinuteMail==='function')checkFiveMinuteMail();
  panel();
  const hours=s.sec/3600,rate=hours>0.02?Math.round(s.earned/hours):0;
  line.textContent='เล่นมา '+hours.toFixed(1)+' ชม. · รับ '+s.earned.toLocaleString()+' · จ่าย '+s.spent.toLocaleString()
   +' · รายได้เฉลี่ย '+rate.toLocaleString()+' เหรียญ/ชม.'
   +' · พื้นที่ '+floorArea()+'/'+(MAX_B*MAX_B)+' ช่อง · ช่องถัดไป '+expandTileCost(floorArea()).toLocaleString();
 },1000);
})();
