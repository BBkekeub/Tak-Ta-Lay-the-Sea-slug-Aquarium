/* ============================================================
   save.js — เซฟ/โหลดเกมด้วย localStorage (คงตู้/ทาก/บัฟ/เหรียญ ข้ามการรีเฟรช)
   โหลดหลัง main.js เสมอ: main วางตู้เริ่มต้นไว้ก่อน ถ้ามีเซฟค่อยเขียนทับ
   * ทุกค่าตัวเลขที่โหลดกลับถูก "ล้างให้เป็นตัวเลขจริง" เสมอ — กัน undefined/NaN
     หลุดเข้าไปในการฉายภาพ (ไม่งั้น createLinearGradient จะ throw ทั้งเฟรม = จอค้าง)
   ============================================================ */
const SAVE_KEY = 'taktale_shop_save_v1';
let _saveOK = true;               // ถ้า localStorage ใช้ไม่ได้ (เช่นโหมดส่วนตัว) จะปิดเงียบ ๆ

const _NUM = (v, d)=>{ const n=+v; return Number.isFinite(n) ? n : d; };
const DEFAULT_GENE = { bodyDepth:45, gillDepth:45, mainC:200, accC:200, len:50, girth:50, gillLen:50, tentLen:50, vigor:50, gillN:50, spotN:50 };

/* ---- เก็บเฉพาะข้อมูลที่ "จำเป็น" — ตัดแคชแคนวาส/ตัวชี้ runtime ออกหมด ---- */
function _saveSlug(s){
  return {
    id:s.id, breedZone:!!s.breedZone, breedLife:s.breedLife??50, genes:s.genes, traits:s.traits, personality:s.personality,
    fx:Number.isFinite(s.fx)?s.fx:s._lastGoodFx, fy:Number.isFinite(s.fy)?s.fy:s._lastGoodFy, dir:s.dir, ph:s.ph, spd:s.spd,
    state:s.state, stt:s.stt, flip:!!s.flip, wall:s.wall||null,
    satiety:s.satiety, foodBuffs:s.foodBuffs, climbZ:s.climbZ
  };
}
function _saveObj(o){
  const t={ id:o.id, type:o.type, _key:o._key, cx:o.cx, cy:o.cy, rot:heldRotations.has(o)?heldRotations.get(o):(o.rot|0) };
  if(o._key==='counter'&&o.showcase)t.showcase={slugId:o.showcase.slugId||null,decorKey:o.showcase.decorKey||''};
  if(o.type==='tank'){
    t.slugs=(o.slugs||[]).map(_saveSlug);
    if(o.hygiene)t.hygiene={cleaned:o.hygiene.cleaned,erases:o.hygiene.erases||[]};
    if(isBreeder(o))t.breeding=saveBreeder(o);
    t.decor=(o.decor||[]).map(d=>({key:d.key, fx:d.fx, fy:d.fy, flip:d.flip|0}));
    t.foods=(o.foods||[]).map(f=>({id:f.id, type:f.type, level:f.level, fx:f.fx, fy:f.fy, eaten:f.eaten||[]}));
  }
  return t;
}
let resettingShop=false;
function saveGame(){
  if(resettingShop)return;
  if(!_saveOK) return;
  try{
    const data={
      v:1, computerInbox:G.computerInbox||[], computerLog:G.computerLog||[], market:G.market||null, decorCredit:G.decorCredit||0, floorTiles:G.floorTiles||null, coin:G.coin, boxStock:G.boxStock||null, slugDeliveries:G.slugDeliveries||[], rep:G.rep||0, questOrderVersion:G.questOrderVersion||0, questCompleted:G.questCompleted||[], questIndex:G.questIndex||0, questDone:!!G.questDone, questBase:G.questBase||null, welcomeGiftAt:G.welcomeGiftAt||0, welcomeGiftDone:!!G.welcomeGiftDone, mailSent:G.mailSent||{}, claimed:G.claimed||{}, larvaDeaths:G.larvaDeaths||0, rivalDeathMailSent:!!G.rivalDeathMailSent, rival100MailSent:!!G.rival100MailSent, stats:G.stats||null, bw:G.bw, bh:G.bh, seq:G.seq, door:G.door||null, shopOpen:peopleOn,
      objs:(G.objs||[]).map(_saveObj),
      shelter:(G.shelter||[]).map(_saveObj),
      inv:(G.inv||[]).map(_saveSlug)
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }catch(e){ _saveOK=false; console.warn('[save] เซฟไม่ได้ (localStorage?)', e); }
}

/* ---- โหลดกลับ: ใส่ def/spec คืน + ล้างทุกตัวเลขให้ finite เสมอ ---- */
function _cleanGenes(raw){
  const g={}, src=(raw && typeof raw==='object') ? raw : {};
  for(const k in DEFAULT_GENE) g[k]=_NUM(src[k], DEFAULT_GENE[k]);   // 9 ยีนหลัก ต้องเป็นเลขจริงเสมอ
  for(const [key,legacy] of [['bodyDepth','deep'],['gillDepth','gdeep']]){
    const value=Number.isFinite(src[key])?src[key]:Number.isFinite(src[legacy])?src[legacy]*100:DEFAULT_GENE[key];
    g[key]=Math.max(0,Math.min(100,value));
  }
  return g;
}
function _cleanBuffs(raw){
  if(!Array.isArray(raw)) return [];
  const out=[];
  for(const b of raw){
    if(!b || typeof b!=='object' || !Number.isFinite(+b.until)) continue;
    const delta={};
    if(b.delta && typeof b.delta==='object')
      for(const k in b.delta) if(Number.isFinite(+b.delta[k])) delta[k]=+b.delta[k];
    out.push({ type:b.type, level:_NUM(b.level,1), delta, until:+b.until });
  }
  return out;
}
function _loadSlug(o){
  o=o||{};
  const genes=_cleanGenes(o.genes);
  const traits=(o.traits && typeof o.traits==='object') ? o.traits
             : (typeof slugTraits==='function' ? slugTraits(genes) : {});
  return {
    id:o.id || ('s'+(G.seq++)), breedZone:!!o.breedZone, breedLife:_NUM(o.breedLife,50), genes, traits,
    personality:_NUM(o.personality, _NUM(traits.shy, 0.5)),
    fx:_NUM(o.fx,1), fy:_NUM(o.fy,1),
    dir:_NUM(o.dir,0), ph:_NUM(o.ph,0), spd:_NUM(o.spd,1),
    // Navigation and feeding targets are runtime-only and are not in the save.
    state:['seekDecor','seekNap','seekClimb','follow','seekFood','eat'].includes(o.state)?'rest':(o.state||'rest'),
    stt:['seekDecor','seekNap','seekClimb','follow','seekFood','eat'].includes(o.state)?REST_MIN:_NUM(o.stt,1), flip:!!o.flip,
    satiety:_NUM(o.satiety,50),
    foodBuffs:_cleanBuffs(o.foodBuffs),
    /* เกาะกระจกอยู่ไหม — ต้องเซฟด้วย ไม่งั้นโหลดกลับมาจะกลายเป็นทากลอยกลางอากาศ
       (climbZ ยังอยู่ แต่ระบบคิดว่าอยู่บนพื้น) */
    wall:(o.wall==='left'||o.wall==='right')?o.wall:null,
    climbSide:(o.wall==='left'||o.wall==='right')?o.wall:null,
    climbZ:(o.wall==='left'||o.wall==='right')?_NUM(o.climbZ,0):0
  };
}
function _loadObj(o){
  o=o||{};
  const def=(typeof CATALOG!=='undefined') ? CATALOG[o._key] : null;
  if(!def) return null;                         // ของที่ไม่รู้จักแล้ว = ข้าม
  const t={ id:o.id, type:o.type, _key:o._key, def,
            cx:_NUM(o.cx,0), cy:_NUM(o.cy,0), rot:(_NUM(o.rot,0)|0), slugs:[] };
  if(o._key==='counter'&&o.showcase)t.showcase={slugId:typeof o.showcase.slugId==='string'?o.showcase.slugId:null,decorKey:typeof o.showcase.decorKey==='string'?o.showcase.decorKey:''};
  if(o.type==='tank'){
    t.slugs=(o.slugs||[]).map(_loadSlug);
    if(o.hygiene&&Array.isArray(o.hygiene.cleaned)&&o.hygiene.cleaned.length===144)t.hygiene={cleaned:o.hygiene.cleaned.map(v=>Number.isFinite(v)?v:Date.now()),erases:(Array.isArray(o.hygiene.erases)?o.hygiene.erases:[]).filter(e=>e&&['face','cx','cy','ax','ay','bx','by','at'].every(k=>Number.isFinite(e[k]))&&e.face>=0&&e.face<3)};
    if(isBreeder(t)){t.breeding=loadBreeder(o.breeding);if(t.breeding)t.breeding.parents=t.breeding.parents.map(p=>{let existing=t.slugs.find(s=>s.id===p.id);if(!existing){existing=p;t.slugs.push(existing);}existing.breedZone=true;return existing;});}
    t.decor=(o.decor||[])
      .filter(d=>d && d.key)
      .map(d=>({ key:d.key, fx:_NUM(d.fx,0.5), fy:_NUM(d.fy,0.5), flip:(_NUM(d.flip,0)|0) }));
    t.foods=(o.foods||[]).map(f=>{
      if(!f) return null;
      const ft=(typeof FOOD_TYPES!=='undefined')?FOOD_TYPES[f.type]:null; if(!ft) return null;
      const spec=ft.levels[(_NUM(f.level,1)|0)-1]; if(!spec) return null;
      return { id:f.id, type:f.type, level:(_NUM(f.level,1)|0), spec,
               fx:_NUM(f.fx,0.5), fy:_NUM(f.fy,0.5), eaten:Array.isArray(f.eaten)?f.eaten:[], reserved:{} };
    }).filter(Boolean);
  }
  return t;
}
function loadGame(){
  let raw=null;
  try{ raw=localStorage.getItem(SAVE_KEY); }catch(e){ _saveOK=false; return false; }
  if(!raw) return false;
  try{
    const d=JSON.parse(raw); if(!d || d.v!==1) return false;
    G.computerInbox=Array.isArray(d.computerInbox)?d.computerInbox.filter(m=>m&&typeof m.id==='string'&&['quest','online'].includes(m.type)&&typeof m.title==='string').map(m=>({id:m.id,type:m.type,title:m.title,body:String(m.body||''),read:!!m.read,claimed:!!m.claimed})):[];
    /* บันทึกทากในร้าน — กล่องแยก เก็บได้ COMPUTER_LOG_MAX ฉบับ ตัดฉบับเก่าสุดทิ้งตอนโหลดด้วย
       (เผื่อเซฟเก่าที่ค่านั้นเคยตั้งไว้สูงกว่า หรือไฟล์เซฟถูกแก้มือ) */
    let _LOGMAX=20; try{ if(typeof COMPUTER_LOG_MAX==='number')_LOGMAX=COMPUTER_LOG_MAX; }catch(e){}
    G.computerLog=(Array.isArray(d.computerLog)?d.computerLog:[])
      .filter(m=>m&&typeof m.id==='string'&&m.type==='log'&&typeof m.title==='string')
      .map(m=>({id:m.id,type:'log',title:m.title,body:String(m.body||''),at:_NUM(m.at,Date.now()),read:!!m.read}))
      .slice(-_LOGMAX);
    G.market=(d.market&&typeof d.market==='object')?d.market:null;
    G.decorCredit=_NUM(d.decorCredit,0)|0;
    G.coin=_NUM(d.coin, G.coin);
    if(d.stats&&Number.isFinite(d.stats.sec))G.stats={earned:_NUM(d.stats.earned,0),spent:_NUM(d.stats.spent,0),sec:_NUM(d.stats.sec,0),sold:_NUM(d.stats.sold,0),fed:_NUM(d.stats.fed,0),cleaned:_NUM(d.stats.cleaned,0),bred:_NUM(d.stats.bred,0),ordered:_NUM(d.stats.ordered,0)};
    G.questOrderVersion=_NUM(d.questOrderVersion,0); G.questCompleted=Array.isArray(d.questCompleted)?d.questCompleted.filter(id=>typeof id==='string'):[];
    G.rep=_NUM(d.rep,0); G.questIndex=Math.max(0,_NUM(d.questIndex,0)|0); G.questDone=!!d.questDone; G.questBase=(d.questBase&&typeof d.questBase==='object')?d.questBase:null;
    G.welcomeGiftAt=_NUM(d.welcomeGiftAt,0); G.welcomeGiftDone=!!d.welcomeGiftDone;
    /* ledger จดหมาย 'ส่งครั้งเดียวตลอดกาล' + สถานะกดรับของ — ต้องคงข้ามรีโหลด ไม่งั้นจดหมายที่ลบไปจะถูกส่งใหม่ / กดรับซ้ำ */
    G.mailSent=(d.mailSent&&typeof d.mailSent==='object')?d.mailSent:{};
    G.claimed=(d.claimed&&typeof d.claimed==='object')?d.claimed:{};
    G.larvaDeaths=_NUM(d.larvaDeaths,0)|0; G.rivalDeathMailSent=!!d.rivalDeathMailSent; G.rival100MailSent=!!d.rival100MailSent;
    G.boxStock=(d.boxStock&&Number.isFinite(d.boxStock.n)&&Number.isFinite(d.boxStock.at))
      ?{n:Math.max(0,Math.min(SLUG_BOX_MAX,d.boxStock.n|0)),at:d.boxStock.at}:null;
    G.slugDeliveries=Array.isArray(d.slugDeliveries)?d.slugDeliveries.filter(x=>x&&typeof x.id==='string'&&Number.isFinite(+x.readyAt)&&x.genes&&typeof x.genes==='object').map(x=>({id:x.id,boxIndex:_NUM(x.boxIndex,0)|0,name:String(x.name||''),readyAt:+x.readyAt,genes:_cleanGenes(x.genes),alerted:!!x.alerted})):[];
    G.bw=Math.max(1, _NUM(d.bw, G.bw)|0);
    G.bh=Math.max(1, _NUM(d.bh, G.bh)|0);
    G.floorTiles=Array.isArray(d.floorTiles)&&d.floorTiles.length?d.floorTiles.filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isInteger)&&p[0]>=0&&p[1]>=0&&p[0]<G.bw&&p[1]<G.bh):null;floorRevision++;
    G.seq=Math.max(1, _NUM(d.seq, G.seq)|0);
    G.door=entranceRect(d.door||null)?{side:d.door.side,offset:d.door.offset}:null;
    G.objs   =(Array.isArray(d.objs)?d.objs:[]).map(_loadObj).filter(Boolean);
    G.shelter=(Array.isArray(d.shelter)?d.shelter:[]).map(_loadObj).filter(Boolean);
    G.inv    =(Array.isArray(d.inv)?d.inv:[]).map(_loadSlug);
    return true;
  }catch(e){ console.warn('[load] เซฟเสีย อ่านไม่ได้ เริ่มใหม่', e); return false; }
}

/* ล้างเซฟแล้วเริ่มใหม่ (เรียกจากคอนโซล: resetGame()) */
window.resetGame = function(){
 for(const question of ['ยืนยันรีเซตร้าน? (1/3)','ทาก ตู้ ของ เหรียญ และพื้นที่ร้านจะกลับไปเริ่มต้น ยืนยัน? (2/3)','ยืนยันครั้งสุดท้าย ล้างเซฟร้านนี้และเริ่มใหม่ทันที? (3/3)'])if(!confirm(question))return false;
 try{resettingShop=true;localStorage.removeItem(SAVE_KEY);}catch(e){resettingShop=false;toast('ล้างเซฟไม่สำเร็จ','bad');return false;}
 location.reload();return true;
};

/* ---- บูต: ถ้ามีเซฟให้เขียนทับตู้เริ่มต้นของ main.js แล้วรีเฟรช UI ---- */
(function(){
  let ok=false;
  try{ ok=loadGame(); }catch(e){ console.warn('[load] ล้มเหลว เริ่มใหม่', e); ok=false; }
  if(ok){
    if(typeof syncHUD==='function') syncHUD();
    if(typeof fitCamera==='function') fitCamera();
  } else {
    saveGame();                          // รันครั้งแรก: เซฟสถานะเริ่มต้นไว้เลย
  }
  // Keep an explicitly opened shop open across refreshes, after validating its layout.
  try{
    const saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
    if(saved&&saved.shopOpen===true&&!peopleOn){document.getElementById('bPeople').click();}
  }catch(e){console.warn('[shop] Restore open state failed',e);}
  /* เซฟอัตโนมัติ: ทุก 3 วิ + ตอนจะปิด/สลับแท็บ (กันข้อมูลหายถ้าปิดกะทันหัน) */
  setInterval(saveGame, 3000);
  window.addEventListener('beforeunload', saveGame);
  window.addEventListener('pagehide', saveGame);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) saveGame(); });
})();


