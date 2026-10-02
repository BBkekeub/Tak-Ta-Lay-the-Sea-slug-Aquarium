// ผังจากโต๊ะประกอบร่าง (ปุ่ม "คัดลอกผัง" → วางเป็นไฟล์ .json) → ข้อมูลสายพันธุ์ในเกม js/slug-species-data.js
//   node tools/build-species.mjs <ผัง.json> <key> <ชื่อไทย> [ผังพันธุ์อื่น.json key ชื่อ ...]
//   ตัวอย่าง: node tools/build-species.mjs assets/oreo2d/oreo-layout.json oreo โอรีโอ
// กติกา (ตรงกับพรีวิวยีนในโต๊ะ tools/custom-editor/species-features.js):
//   · ทุกชิ้นใช้ตำแหน่ง u/v เทียบกล่องลำตัวตามผัง · ผังหันขวา (ตาอยู่ครึ่งขวา) ถูกกลับให้หันซ้ายแบบทากในเกม
//   · หงอนต้องมี 9 ก้าน = ต้นกลาง 3 + คู่ซ้าย-ขวา 3 คู่ ตามมุมเอียง (ดู crestSlots) วางลงช่อง 0–8 แล้วเรียงตามช่อง → ยีนลดก้านตามลำดับทากตัวเดิม (CREST_KEEP)
//   · ลาย: เรียงตามลำดับเติม (ใหญ่สุดก่อน แล้วดวงที่ห่างดวงที่มีอยู่มากสุด) ยีน 100 → 0 หายจากท้ายรายการ
//   · รูปที่ไม่ใช่ของเกมฝังเป็น data URL (เปิดจาก file:// ก็ย้อมสีได้ ไม่ติด tainted canvas)
import fs from 'node:fs';
const args=process.argv.slice(2);
if(args.length<3||args.length%3){console.error('usage: node tools/build-species.mjs <layout.json> <key> <th> [...]');process.exit(1)}

const ENGINE={body:'body',gill:'gill',gill2:'gill2',gill3:'gill3',rhinoA:'rhinoA',rhinoB:'rhinoB',spot:'spot',spotSq:'spot_sq',spotTri:'spot_tri',eye:'eye',mouth:'mouth'};
const CREST_KEEP={2:[1,7],3:[1,6,7],5:[1,2,5,6,7],6:[1,2,4,5,6,7],8:[0,1,2,4,5,6,7,8],9:[0,1,2,3,4,5,6,7,8]};

/* หงอน 9 ก้าน → ช่อง 0–8 (สูตรเดียวกับ crestSlots ในโต๊ะ tools/custom-editor/species-features.js)
   เรียงทั้ง 9 ก้านตามมุมเอียง: 3 ก้านกลาง = ต้นกลาง · 3 ก้านแต่ละฝั่ง = คู่ซ้าย-ขวา จับคู่จากในออกนอก
   เติมตามกฎทากตัวแรก: คู่ → ต้นกลาง → คู่ → ต้นกลาง → คู่ → ต้นกลาง
     2 = คู่ในสุด · 3 = +ต้นกลางสูงสุด · 5 = +คู่ถัดออกไป · 6 = +ต้นกลางรอง · 8 = +คู่นอกสุด · 9 = +ต้นกลางเล็กสุด
   วางลงช่องที่ CREST_KEEP เปิดตามลำดับนั้นพอดี (2:{1,7} 3:+6 5:+2,5 6:+4 8:+0,8 9:+3) · ไม่ขึ้นกับลำดับชั้นหรือหน้า/หลังตัว */
function crestSlots(items){const a=items.slice().sort((p,q)=>p.rot-q.rot||p.u-q.u),C=a.slice(3,6).sort((p,q)=>q.h-p.h||p.d-q.d),m=new Map(),K=o=>o;
 [[a[2],1],[a[6],7],[C[0],6],[a[1],2],[a[7],5],[C[1],4],[a[0],0],[a[8],8],[C[2],3]].forEach(([o,s])=>m.set(K(o),s));return m}
function spotOrder(items){   // สูตรเดียวกับ spotOrder ในโต๊ะ
 const big=Math.max(...items.map(o=>o.r))||1,left=items.slice().sort((a,b)=>b.r-a.r||a.i-b.i),out=[left.shift()];
 while(left.length){let bi=0,bs=-1;left.forEach((o,k)=>{const dmin=Math.min(...out.map(p=>Math.hypot(p.x-o.x,p.y-o.y)));const s=dmin*(.55+.45*o.r/big);if(s>bs+1e-9){bs=s;bi=k}});out.push(left.splice(bi,1)[0])}return out}
const pngSize=src=>{const b=Buffer.from(src.slice(src.indexOf(',')+1,src.indexOf(',')+200),'base64');if(b.toString('ascii',1,4)!=='PNG')throw Error('only PNG data URLs are supported');return{w:b.readUInt32BE(16),h:b.readUInt32BE(20)}};
const r4=v=>Math.round(v*1e4)/1e4;

function build(file,key,th){
 const o=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!Array.isArray(o.layers)||!o.body)throw Error(file+': not a layout export (needs layers + body)');
 const vis=o.layers.filter(L=>L.visible!==false),by=ch=>vis.filter(L=>L.channel===ch);
 const bodies=by('body');if(!bodies.length)throw Error('no layer on the "body" channel');const B=bodies.at(-1),bz=B.z;
 const eyes=by('eye').filter(L=>/eye|ตา/i.test(L.part+' '+L.name)),mirror=eyes.length?eyes.reduce((s,L)=>s+L.u,0)/eyes.length>.5:false;
 const art={},artKey=part=>{if(ENGINE[part])return ENGINE[part];const P=o.parts&&o.parts[part];if(!P||!/^data:image\/png;base64,/.test(P.src||''))throw Error('part "'+part+'" has no embedded PNG in the export');
  const k=key+'_'+part.replace(/[^A-Za-z0-9_]/g,'_');if(!art[k]){const {w,h}=pngSize(P.src);art[k]={src:P.src,meta:{w,h,ax:r4((P.ax??.5)*w),ay:r4((P.ay??.5)*h)}}}return k};
 const U=u=>r4(mirror?1-u:u),ROT=r=>r4(mirror?-(+r||0):(+r||0)),FL=f=>mirror?!f:!!f;
 const bodyArt=artKey(B.part);

 const crest=by('gill');if(crest.length!==9)throw Error('need exactly 9 crest stalks on the "gill" channel, found '+crest.length);
 const front=crest.filter(L=>L.z>bz).sort((a,b)=>a.z-b.z);
 const items=crest.map(L=>({L,u:mirror?1-L.u:L.u,v:L.v,rot:+L.rot||0,h:+L.hRatio||0,back:L.z<bz,d:L.z<bz?L.z:front.indexOf(L)+1}));
 const slot=crestSlots(items),stalks=new Array(9);
 for(const it of items){const L=it.L;stalks[slot.get(it)]={part:artKey(L.part),u:U(L.u),v:r4(L.v),rot:ROT(L.rot),flip:FL(L.flipX),hR:r4(L.hRatio),ar:r4(L.ar||1),back:it.back,d:it.d}}

 const rhinos=by('rhino').map(L=>({part:artKey(L.part),u:U(L.u),v:r4(L.v),rot:ROT(L.rot),hR:r4(L.hRatio),ar:r4(L.ar||1),flip:FL(L.flipX),back:L.z<bz}));
 const eyeArt=eyes.length?artKey(eyes[0].part):'eye',eyeMeta=ENGINE[eyes[0]?.part]?null:art[eyeArt]?.meta;
 const face=eyes.map(L=>({u:U(L.u),v:r4(L.v),hR:r4(L.hRatio),ar:r4((L.ar||1)*(eyeMeta?eyeMeta.w/eyeMeta.h:1)),rot:ROT(L.rot)}));
 const bw=o.body.w,bh=o.body.h,sp=by('spot').map((L,i)=>({L,i,x:(mirror?1-L.u:L.u)*bw,y:L.v*bh,r:L.hRatio/2}));
 const spots=sp.length?spotOrder(sp).map(({L})=>({part:artKey(L.part),u:U(L.u),v:r4(L.v),r:r4(L.hRatio/2),ar:r4(L.ar||1),rot:ROT(L.rot),flip:FL(L.flipX)})):[];

 const spec=(o.species||[]).find(s=>s.key===B.species),table=id=>{const ch=spec&&spec.channels.find(c=>c.id===id),t=ch&&ch.color&&ch.color.src==='gene'&&o.colorTables&&o.colorTables[ch.color.table];
  return t&&ch.color.table!==(id==='body'?'body':'gill')?t.anchors.map(a=>({g:a.g,n:a.n,D:a.D,M:a.M,L:a.L,...(a.P?{P:a.P}:{})})):null};
 return {key,th,body:bodyArt,bodyAR:r4(bh/bw),bodyFlip:FL(B.flipX)!==(ENGINE[B.part]?true:false)?true:false,
  stalks,keep:CREST_KEEP,rhinos,eyes:face,eye:eyeArt,spots,bodyAnch:table('body'),gillAnch:table('gill'),art,
  source:{file:file.replace(/\\/g,'/'),mirrored:mirror,layers:vis.length}};
}
const out=[];for(let i=0;i<args.length;i+=3)out.push(build(args[i],args[i+1],args[i+2]));
const dest=process.env.SPECIES_OUT||new URL('../js/slug-species-data.js',import.meta.url);   // SPECIES_OUT = เขียนที่อื่น (เทสต์)
fs.writeFileSync(dest,'/* สร้างโดย tools/build-species.mjs จากผังโต๊ะประกอบร่าง — อย่าแก้มือ แก้ผังแล้วรันใหม่ */\nwindow.SLUG_SPECIES_DATA=(window.SLUG_SPECIES_DATA||[]).concat('+JSON.stringify(out)+');\n');
console.log(out.map(s=>({key:s.key,th:s.th,mirrored:s.source.mirrored,stalks:s.stalks.length,rhinos:s.rhinos.length,eyes:s.eyes.length,spots:s.spots.length,art:Object.keys(s.art),bodyFlip:s.bodyFlip,tables:[!!s.bodyAnch,!!s.gillAnch]})));
