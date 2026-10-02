/* Species registry + colour channels + gene preview.
   The preview covers EVERY gene the game reads (SlugEngine.GENES in js/slug-engine.js) with the game's own formulas:
   · colour — BODY_ANCH/GILL_ANCH gradient maps + grooves · rhinophore two-tone, tip mask from the art's saturation (rhinoPre)
     · crest glow/rim/sparkle (paintGill) + per-stalk shade (shadeGill) + one aura over the whole crown (drawGillAura)
     · body vigor sparkle (bodySparkle) · spots baked at the game's texture size (paintBody)
   · shape/count — len · girth · gillLen · tentLen · gillN (LADDER + GILL_SETS) · spotN (spotPlan + slot jitter/tilt)
   Recoloured images are cached per (source, material, per-layer context) and only rebuilt when those change — pan/zoom reuse them.
   The shape preview renders a transformed copy of the layout; the saved layout (doc) is never modified by it. */
(()=>{
/* ---------- colour tables (copied from js/slug-engine.js — keep in sync; check-gene-preview.mjs compares them) ---------- */
const BODY_ANCH=[{g:0,n:'ดำด้าน',D:[4,4,6],M:[22,22,26],L:[92,92,100]},{g:50,n:'ม่วงหมอง',D:[12,6,20],M:[66,38,94],L:[133,96,169]},{g:100,n:'เลือดหมูเข้ม',D:[22,3,6],M:[114,29,43],L:[182,93,108]},{g:150,n:'ชมพูพาสเทล',D:[152,22,74],M:[241,126,172],L:[248,226,235]},{g:200,n:'ขาว',D:[120,122,132],M:[212,214,222],L:[250,250,254]},{g:250,n:'ฟ้าพาสเทล',D:[17,98,156],M:[123,194,244],L:[226,239,248]},{g:300,n:'เขียวมิ้นต์',D:[24,139,82],M:[125,232,179],L:[227,247,237]},{g:350,n:'ส้มพาสเทล',D:[165,81,9],M:[252,189,126],L:[249,237,226]},{g:400,n:'ทอง',D:[99,67,3],M:[253,194,33],L:[247,235,201]}];
const GILL_ANCH=[{g:0,D:[10,10,12],M:[42,42,48],L:[138,138,148],P:[232,232,240]},{g:50,D:[87,35,139],M:[158,105,211],L:[242,239,245],P:[204,171,237]},{g:100,D:[147,26,46],M:[221,95,116],L:[246,238,240],P:[242,166,179]},{g:150,D:[165,9,71],M:[240,76,142],L:[247,237,241],P:[252,156,194]},{g:200,D:[154,156,166],M:[230,232,240],L:[255,255,255],P:[255,255,255]},{g:250,D:[4,100,169],M:[71,173,245],L:[237,243,248],P:[153,212,255]},{g:300,D:[17,156,87],M:[85,231,158],L:[238,247,242],P:[161,247,204]},{g:350,D:[173,87,0],M:[250,158,66],L:[248,242,237],P:[255,204,153]},{g:400,D:[173,127,0],M:[255,203,61],L:[249,245,236],P:[255,228,153]}];
const BODY_STOPS=[[0,'d'],[.5,'m'],[1,'l']],GILL_STOPS=[[0,'s'],[.22,'d'],[.55,'m'],[.88,'p'],[1,'l']];
const lerpC=(a,b,f)=>a.map((v,i)=>v+(b[i]-v)*f),mixC=lerpC,scaleC=(a,f)=>a.map(v=>v*f),lumOf=c=>(c[0]*.2126+c[1]*.7152+c[2]*.0722)/255;
function anchorAt(v,T){v=clamp(+v||0,T[0].g,T.at(-1).g);for(let i=0;i<T.length-1;i++)if(v<=T[i+1].g){const a=T[i],b=T[i+1],f=(v-a.g)/(b.g-a.g);return{D:lerpC(a.D,b.D,f),M:lerpC(a.M,b.M,f),L:lerpC(a.L,b.L,f),P:lerpC(a.P||a.L,b.P||b.L,f),n:f<.5?a.n:b.n}}return T[0]}
/* colour tables are editable and live in doc.colorTables (defaults = the game's tables) */
GILL_ANCH.forEach((a,i)=>a.n=BODY_ANCH[i].n);
const DEFAULT_TABLES=()=>({body:{th:'ตารางสีลำตัว',kind:'body',anchors:JSON.parse(JSON.stringify(BODY_ANCH))},gill:{th:'ตารางสีหงอน',kind:'gill',anchors:JSON.parse(JSON.stringify(GILL_ANCH))}});
const rgbOk=c=>Array.isArray(c)&&c.length===3?c.map(v=>clamp(Math.round(+v||0),0,255)):null;
function cleanTable(t,fallback){const kind=t?.kind==='gill'?'gill':'body',base=DEFAULT_TABLES()[kind].anchors;return{th:String(t?.th||fallback||'ตาราง').slice(0,40),kind,anchors:base.map((b,i)=>{const a=Array.isArray(t?.anchors)?t.anchors[i]:null;return{g:b.g,n:String(a?.n||b.n).slice(0,24),D:rgbOk(a?.D)||b.D,M:rgbOk(a?.M)||b.M,L:rgbOk(a?.L)||b.L,...(kind==='gill'?{P:rgbOk(a?.P)||b.P}:{})}})}}
function ensureTables(){if(doc.colorTables&&doc.colorTables.body&&doc.colorTables.gill)return;doc.colorTables=Object.assign(DEFAULT_TABLES(),doc.colorTables||{})}
const tableOf=id=>{ensureTables();return doc.colorTables[id]||doc.colorTables.body};
const tableChoices=()=>{ensureTables();return Object.fromEntries(Object.entries(doc.colorTables).map(([k,t])=>[k,t.th]))};
const matBody=(v,id='body')=>{const a=anchorAt(v,tableOf(id).anchors);return{d:a.D,m:a.M,l:a.L}};
const matGill=(v,id='gill')=>{const a=anchorAt(v,tableOf(id).anchors);return{d:a.D,m:a.M,l:a.L,p:a.P,s:a.D.map(c=>c*.34)}};
const metalOf=v=>Math.pow(Math.min(1,Math.abs(v-200)/200),.85);
function inkOf(v){const M=matBody(v),amt=metalOf(v),dark={d:scaleC(M.d,.35),m:scaleC(M.m,.30),l:scaleC(M.l,.48)},lite={d:mixC(M.d,M.m,.5),m:mixC(M.m,M.l,.55),l:M.l};let w=(lumOf(M.m)-.3)/.3;w=clamp(w,0,1);w=w*w*(3-2*w);return{d:mixC(M.d,mixC(lite.d,dark.d,w),amt),m:mixC(M.m,mixC(lite.m,dark.m,w),amt),l:mixC(M.l,mixC(lite.l,dark.l,w),amt)}}
const hexToRgb=h=>/^#[0-9a-f]{6}$/i.test(h)?[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)):[128,128,128];
const colorName=(v,id='body')=>anchorAt(v,tableOf(id).anchors).n;

/* ---------- shape/count rules (copied from js/slug-engine.js derived()/GILL_SETS/spotPlan — keep in sync) ---------- */
const BODY_W0=520,LADDER=[2,3,5,6,8,9],CREST_MID=.51,RHINO_GAMMA=1+.45*1.8;
const GS=(part,u,v,rot,flip,hR,back,d)=>({part,u,v,rot,flip:!!flip,hR,back:!!back,d});
const GILL_SETS={   // ผังหงอนของเกมแยกตามจำนวนก้าน (u/v เทียบกล่องลำตัว · hR เทียบความสูงลำตัว)
 2:[GS('gill2',.4620,.0965,-10.5,1,1.3433,1,1),GS('gill2',.5271,.0989,14.6,0,1.3433,0,1)],
 3:[GS('gill2',.4620,.0965,-10.5,1,1.3433,1,1),GS('gill2',.4839,.0747,14.6,1,1.3433,0,1),GS('gill3',.5153,.1160,26.4,0,1.3433,0,2)],
 5:[GS('gill2',.4620,.0965,-10.5,1,1.3433,1,1),GS('gill3',.5575,.0842,21.5,1,1.3433,1,2),GS('gill3',.5850,.1029,41.3,0,1.3433,0,1),GS('gill2',.4839,.0747,10.9,1,1.3433,0,2),GS('gill3',.5153,.1160,26.4,0,1.3433,0,3)],
 6:[GS('gill2',.4620,.0965,-10.5,1,1.3433,1,1),GS('gill3',.5575,.0842,21.5,1,1.3433,1,2),GS('gill2',.5964,.1281,30.2,0,1.3433,0,1),GS('gill3',.5850,.1029,41.3,0,1.3433,0,2),GS('gill2',.4839,.0747,10.9,1,1.3433,0,3),GS('gill3',.5153,.1160,26.4,0,1.3433,0,4)],
 8:[GS('gill3',.4542,.0783,-43.5,1,1.1090,1,1),GS('gill2',.4450,.0505,-12.7,1,1.4205,1,2),GS('gill3',.5575,.0842,21.5,1,1.3433,1,3),GS('gill2',.5964,.1281,16.6,0,1.4602,0,1),GS('gill3',.5850,.1029,41.3,0,1.3433,0,2),GS('gill2',.4958,.0804,7.7,1,1.6174,0,3),GS('gill3',.5272,.0872,17.2,0,1.3017,0,4),GS('gill3',.4932,.0808,-29.3,1,.9918,0,5)],
 9:[GS('gill3',.4542,.0783,-42.6,1,1.0458,1,1),GS('gill2',.4450,.0505,-3.7,1,1.4205,1,2),GS('gill3',.5575,.0842,21.5,1,1.3433,1,3),GS('gill',.5804,.1071,22.4,0,1.6936,0,1),GS('gill2',.5964,.1281,11.5,0,1.4602,0,2),GS('gill3',.5850,.1029,39.9,0,1.2743,0,3),GS('gill2',.5027,.0977,3.7,1,1.7238,0,4),GS('gill3',.5272,.0872,17.2,0,1.3017,0,5),GS('gill3',.4932,.0808,-29.3,1,.9918,0,6)]};
const GILL_KEYS=Object.keys(GILL_SETS).map(Number).sort((a,b)=>a-b);
function gillSet(n){if(GILL_SETS[n])return GILL_SETS[n];let k=GILL_KEYS[0];GILL_KEYS.forEach(x=>{if(x<=n)k=x});const base=GILL_SETS[k];return n<=base.length?base.slice(0,n):base.concat(GILL_SETS[GILL_KEYS.at(-1)].slice(base.length,n))}
const SPOT_TILT={circle:6,sq:34,tri:44},SPOT_PART={circle:'spot',sq:'spotSq',tri:'spotTri'},SPOT_TH={circle:'วงกลม',sq:'สี่เหลี่ยม',tri:'สามเหลี่ยม'},SPOT_ART=new Set(Object.values(SPOT_PART));
/* N = จำนวนช่องลายในผัง (เกมใช้จำนวนช่องที่จัดมือไว้เป็นยอดสูงสุด) */
function spotPlan(v,N){const p=v>70?{shape:'sq',n:Math.round(1+((v-70)/30)*(N-1))}:v<30?{shape:'tri',n:Math.round(((30-v)/30)*N)}:{shape:'circle',n:Math.round(((v-30)/40)*N)};p.n=clamp(p.n,0,N);return p}
/* เอียง/ย่อ-ขยายสุ่มคงที่ของช่องลายลำดับที่ i (เรียงดวงใหญ่→เล็ก) — สูตรเดียวกับ SPOT_SLOTS.forEach ในเกม */
function slotJitter(i){const h=n=>{const x=Math.sin((i+1)*n)*43758.5453;return x-Math.floor(x)};return{jr:h(12.9898)*2-1,js:h(78.233)}}

/* ---------- ทากพันธุ์ใหม่ (ลำตัวไม่ใช่ของทากตัวเดิม — ดู newSpecies) ----------
   หงอน: ผังจัดครบ 9 ก้าน → ยีนลดจำนวนก้านตามลำดับเดียวกับทากตัวเดิม (ใช้ตำแหน่งที่จัดเองทุกก้าน ไม่ย้ายไปผังเกม)
     ชุดของเกมแต่ละขั้นเป็นเซตย่อยซ้อนกันของชุด 9 ก้าน (จับคู่ตำแหน่ง/มุมกับ GILL_SETS[9] — check-gene-preview ตรวจซ้ำ):
     9 → 8 ตัดก้านสูงกลางหน้า(3) · → 6 ตัดหลังซ้ายนอก(0)+หน้าซ้าย(8) · → 5 ตัดหน้าขวาหลัง(4) · → 3 ตัดหลังขวา(2)+หน้าขวา(5) · → 2 ตัดหน้าซ้ายใน(6)
   ลาย: ยีน 100 = ครบทุกดวง → 0 = ไม่มีลาย ลดต่อเนื่อง ดวงที่กำลังจะหายหดลง+จางลงก่อนหายจริง (ไม่โผล่/หายพรวด)
     ลำดับหาย = กลับด้านของลำดับเติม: เติมดวงใหญ่สุดก่อน แล้วเติมดวงที่อยู่ห่างดวงที่มีแล้วมากที่สุด (ถ่วงด้วยขนาด)
     → ลายบางลงทั่วตัวอย่างสม่ำเสมอ ไม่โล่งเป็นหย่อม และดวงเล็กหายก่อนดวงใหญ่ */
const CREST_KEEP={2:[1,7],3:[1,6,7],5:[1,2,5,6,7],6:[1,2,4,5,6,7],8:[0,1,2,4,5,6,7,8],9:[0,1,2,3,4,5,6,7,8]};
/* หงอน 9 ก้าน → ช่อง 0–8 (สูตรเดียวกับ crestSlots ใน tools/build-species.mjs)
   เรียงทั้ง 9 ก้านตามมุมเอียง: 3 ก้านกลาง = ต้นกลาง · 3 ก้านแต่ละฝั่ง = คู่ซ้าย-ขวา จับคู่จากในออกนอก
   เติมตามกฎทากตัวแรก: คู่ → ต้นกลาง → คู่ → ต้นกลาง → คู่ → ต้นกลาง
     2 = คู่ในสุด · 3 = +ต้นกลางสูงสุด · 5 = +คู่ถัดออกไป · 6 = +ต้นกลางรอง · 8 = +คู่นอกสุด · 9 = +ต้นกลางเล็กสุด
   วางลงช่องที่ CREST_KEEP เปิดตามลำดับนั้นพอดี (2:{1,7} 3:+6 5:+2,5 6:+4 8:+0,8 9:+3) · ไม่ขึ้นกับลำดับชั้นหรือหน้า/หลังตัว */
function crestSlots(items){const a=items.slice().sort((p,q)=>p.rot-q.rot||p.u-q.u),C=a.slice(3,6).sort((p,q)=>q.h-p.h||p.d-q.d),m=new Map(),K=o=>o.id;
 [[a[2],1],[a[6],7],[C[0],6],[a[1],2],[a[7],5],[C[1],4],[a[0],0],[a[8],8],[C[2],3]].forEach(([o,s])=>m.set(K(o),s));return m}
/* ลำดับเติมลาย (ดวงแรก = อยู่ถึงยีนต่ำสุด) */
function spotOrder(items){const big=Math.max(...items.map(o=>o.r))||1,left=items.slice().sort((a,b)=>b.r-a.r||a.i-b.i),out=[left.shift()];
 while(left.length){let bi=0,bs=-1;left.forEach((o,k)=>{const dmin=Math.min(...out.map(p=>Math.hypot(p.x-o.x,p.y-o.y)));const s=dmin*(.55+.45*o.r/big);if(s>bs+1e-9){bs=s;bi=k}});out.push(left.splice(bi,1)[0])}return out}
/* ยีนลาย → จำนวนดวงแบบต่อเนื่อง (t) · n = ดวงที่ยังเห็น · f = ความเต็มของดวงสุดท้าย */
const fadePlan=(v,N)=>{const t=clamp(+v||0,0,100)/100*N,full=Math.floor(t+1e-6),f=t-full;return{shape:'fade',n:f>.02?full+1:full,full,f,N}};

/* ---------- species data (lives in doc → undo, autosave and JSON export include it) ---------- */
const SHAPES={1:'ดอริด (ตัวแบนระบายขอบ)',2:'ตัวอ้วนกลมยาว',3:'กระต่ายทะเล'};
/* ยีนทั้ง 11 ตัวที่เกมอ่าน (SlugEngine.GENES) ชื่อ/ช่วงเดียวกับในเกม · grp = หมวดในการ์ดพรีวิว
   ยีนสีเดินได้ทีละ 1 (การผสมในเกมขยับทีละ ≤5 หน่วย สีระหว่างหลักจึงเกิดได้จริง) */
const BASE_GENES=[
 {key:'mainC',grp:'color',th:'สีลำตัว',min:0,max:400,step:1,def:200,hint:'ผิวลำตัว + โคนหนวด + สีลาย (ลายตัดกับสีตัวเสมอ)'},
 {key:'accC',grp:'color',th:'สีหงอนเหงือก',min:0,max:400,step:1,def:200,hint:'หงอนเหงือก + ปลายหนวด + ออร่ารอบพุ่มหงอน'},
 {key:'bodyDepth',grp:'finish',th:'ร่องสีตัว',min:0,max:100,step:1,def:45,hint:'ร่องลึกลำตัว: gamma = 1 + ค่า/100×1.8'},
 {key:'gillDepth',grp:'finish',th:'ร่องสีหงอน',min:0,max:100,step:1,def:45,hint:'ร่องลึกหงอน: gamma = 1 + ค่า/100×1.8'},
 {key:'vigor',grp:'finish',th:'ความสมบูรณ์',min:0,max:100,step:1,def:50,hint:'เม็ดประกายบนตัว · แสง/ขอบเรือง/เม็ดวาว/เงาบนหงอน · ออร่ารอบพุ่มหงอน'},
 {key:'len',grp:'shape',th:'ความยาวลำตัว',min:0,max:100,step:1,def:50,hint:'ยืดลำตัวด้านข้างอย่างเดียว ×0.72–1.28 ชิ้นอื่นเลื่อนตามตำแหน่งบนตัว'},
 {key:'girth',grp:'shape',th:'ขนาดตัวรวม',min:0,max:100,step:1,def:50,hint:'ใหญ่ขึ้นทั้งตัว ทั้งกว้าง สูง และทุกชิ้นที่ติดตัว ×0.72–1.28'},
 {key:'gillLen',grp:'shape',th:'ความสูงหงอนเหงือก',min:0,max:100,step:1,def:50,hint:'ความสูงก้านหงอน ×0.62–1.38 ย่อ/ขยายรอบโคน'},
 {key:'tentLen',grp:'shape',th:'ความยาวหนวด',min:0,max:100,step:1,def:50,hint:'ความยาวหนวด ×0.62–1.38 ย่อ/ขยายรอบโคน'},
 {key:'gillN',grp:'count',th:'จำนวนหงอนเหงือก',min:0,max:100,step:1,def:50,hint:'ห่างจาก 50 ทุก 10 = ขึ้นขั้น: 2 · 3 · 5 · 6 · 8 · 9 ก้าน'},
 {key:'spotN',grp:'count',th:'ลาย (รูปทรง+จำนวน)',min:0,max:100,step:1,def:50,hint:'ต่ำกว่า 30 สามเหลี่ยม · 30–70 วงกลม · เกิน 70 สี่เหลี่ยม · จำนวนไต่ตามค่า เติมดวงใหญ่ก่อน'}];
const COLOR_SRC={gene:'ตามยีน',ink:'ลาย: ตัดกับสีตัว',fixed:'สีคงที่',none:'ไม่ย้อม (สีรูปเดิม)'};
const GROOVE_SRC={gene:'ตามยีน',fixed:'ค่าคงที่',none:'ไม่มีร่อง'};
const defaultChannels=()=>[
 {id:'body',th:'ลำตัว',color:{src:'gene',gene:'mainC',table:'body'},groove:{src:'gene',gene:'bodyDepth'}},
 {id:'gill',th:'หงอน',color:{src:'gene',gene:'accC',table:'gill'},groove:{src:'gene',gene:'gillDepth'}},
 {id:'rhino',th:'หนวด',color:{src:'gene',gene:'accC',table:'gill'},groove:{src:'fixed',value:45}},
 {id:'spot',th:'ลาย',color:{src:'ink'},groove:{src:'none'}},
 {id:'eye',th:'ตา / ไม่ย้อม',color:{src:'none'},groove:{src:'none'}}];
const DEFAULT_SPECIES=[
 {key:'legacy',code:'LOCHI',no:1,th:'ตัวเดิม',en:'Lochi',shape:1},
 {key:'oreo',code:'OREO',no:2,th:'โอรีโอ',en:'Oreo nudibranch',shape:1},
 {key:'shared',code:'SHARED',no:0,th:'ใช้ร่วมกัน / ยังไม่ระบุ',en:'',shape:1}];
const CODE_RE=/^[A-Za-z][A-Za-z0-9_-]{0,23}$/,GENE_RE=/^[a-z][A-Za-z0-9]{1,15}$/;
const cleanChannel=c=>({id:String(c.id).slice(0,24),th:String(c.th||c.id).slice(0,40),
 color:{src:COLOR_SRC[c.color?.src]?c.color.src:'none',gene:String(c.color?.gene||'mainC').slice(0,16),table:/^[A-Za-z][A-Za-z0-9_]{0,23}$/.test(c.color?.table)?c.color.table:'body',
  d:/^#[0-9a-f]{6}$/i.test(c.color?.d)?c.color.d:'#3a2a22',m:/^#[0-9a-f]{6}$/i.test(c.color?.m)?c.color.m:'#8a6a52',l:/^#[0-9a-f]{6}$/i.test(c.color?.l)?c.color.l:'#f2e6da'},
 groove:{src:GROOVE_SRC[c.groove?.src]?c.groove.src:'none',gene:String(c.groove?.gene||'bodyDepth').slice(0,16),value:clamp(+c.groove?.value||0,0,100)}});
function cleanSpecies(s){return{key:String(s.key),code:CODE_RE.test(s.code)?s.code:String(s.key).toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,24)||'SP',no:Number.isInteger(+s.no)?clamp(+s.no,0,9999):0,
 th:String(s.th||s.key).slice(0,60),en:String(s.en||'').slice(0,60),shape:SHAPES[s.shape]?+s.shape:1,
 channels:(Array.isArray(s.channels)&&s.channels.length?s.channels:defaultChannels()).filter(c=>c&&c.id).slice(0,24).map(cleanChannel),
 genes:(Array.isArray(s.genes)?s.genes:[]).filter(g=>g&&GENE_RE.test(g.key)).slice(0,12).map(g=>({key:g.key,th:String(g.th||g.key).slice(0,40),min:0,max:400,step:50,def:clamp(+g.def||200,0,400)}))}}
function ensureSpecies(){if(Array.isArray(doc.species)&&doc.species.length)return;doc.species=DEFAULT_SPECIES.map(cleanSpecies)}
const specByKey=k=>doc.species.find(s=>s.key===k);
const displayName=s=>s.th+(s.en?' / '+s.en:'');

/* keep the older ownership card (speciesNames/selects) in step with the registry */
let namesSig='';
function syncNames(){ensureSpecies();const sig=JSON.stringify(doc.species.map(s=>[s.key,s.th,s.en,s.code]));if(sig===namesSig)return;namesSig=sig;
 for(const k of Object.keys(speciesNames))delete speciesNames[k];for(const s of doc.species)speciesNames[s.key]=displayName(s);
 for(const [id,all] of [['importSpecies',false],['layerSpecies',false],['paletteSpecies',true]]){const el=$(id);if(!el)continue;const v=el.value;el.innerHTML=speciesOptions(all);el.value=[...el.options].some(o=>o.value===v)?v:(all?'all':'shared')}}

/* ---------- which channel paints a layer ---------- */
function guessChannel(L){const P=PARTS[L.part]||{},t=(L.part+' '+(P.th||'')+' '+(L.name||'')).toLowerCase();
 if(/eye|ตา|mouth|ปาก/.test(t))return'eye';if(/spot|ลาย|pattern/.test(t))return'spot';if(/gill|หงอน|เหงือก/.test(t))return'gill';if(/rhino|horn|tent|หนวด/.test(t))return'rhino';if(/body|ลำตัว|ตัว/.test(t))return'body';return'eye'}
function channelOf(L){const s=specByKey(speciesOfLayer(L))||specByKey('shared');if(!s)return null;return s.channels.find(c=>c.id===L.channel)||s.channels.find(c=>c.id===guessChannel(L))||null}

/* ---------- ลำตัวอ้างอิง: ชิ้นบนสุดที่ใช้ช่องสี "ลำตัว" (ของเดิม ชุด Oreo หรือรูปที่นำเข้าเอง) ---------- */
if(typeof bodyLayer==='function'){try{bodyLayer=()=>{ensureSpecies();const vis=doc.layers.filter(l=>effVis(l)&&PARTS[l.part]);return vis.filter(l=>channelOf(l)?.id==='body').slice(-1)[0]||vis.filter(l=>l.part==='body').slice(-1)[0]||null}}catch(e){console.warn('bodyLayer is not replaceable',e)}}

/* ---------- preview genes (per-viewer convenience, not part of the layout) ---------- */
const GKEY='custom-editor-genes-v1';let preview={on:false,shape:false,genes:{}};try{preview=Object.assign(preview,JSON.parse(localStorage.getItem(GKEY)||'{}'))}catch{}
if(!preview.genes||typeof preview.genes!=='object')preview.genes={};
const saveGenes=()=>{try{localStorage.setItem(GKEY,JSON.stringify(preview))}catch{}};
const geneDefs=()=>{const seen=new Map(BASE_GENES.map(g=>[g.key,g]));for(const s of doc.species||[])for(const g of s.genes)if(!seen.has(g.key))seen.set(g.key,{...g,grp:'color',step:1,th:g.th+' ('+s.th+')'});return[...seen.values()]};
const geneVal=k=>{const d=geneDefs().find(g=>g.key===k);const v=preview.genes[k];return Number.isFinite(v)?(d?clamp(v,d.min,d.max):v):(d?d.def:200)};
const shapeOn=()=>!!preview.shape;
/* derived() ในเกม: ขนาด/ยืด/ความสูงหงอน/ความยาวหนวด/จำนวนหงอน จากยีน (ยีน 50 = ×1 ทุกตัว, หงอน 2 ก้าน) */
function morphOf(){const g=k=>geneVal(k);return{size:.72+g('girth')/100*.56,stretch:.72+g('len')/100*.56,gScale:.62+g('gillLen')/100*.76,tScale:.62+g('tentLen')/100*.76,nGill:LADDER[Math.min(5,Math.floor(Math.abs(g('gillN')-50)/10))],spotV:g('spotN')}}

function materialOf(ch){const c=ch.color;if(c.src==='none')return null;let M,stops=BODY_STOPS,opt={};
 if(c.src==='ink'){M=inkOf(geneVal('mainC'))}
 else if(c.src==='fixed'){M={d:hexToRgb(c.d),m:hexToRgb(c.m),l:hexToRgb(c.l)}}
 else{const v=geneVal(c.gene);if(tableOf(c.table).kind==='gill'){M=matGill(v,c.table in doc.colorTables?c.table:'gill');stops=GILL_STOPS;opt={sub:.18,div:.74}}else M=matBody(v,c.table)}
 const g=ch.groove,deep=g.src==='gene'?clamp(geneVal(g.gene),0,100)/100:g.src==='fixed'?g.value/100:0;
 opt.gamma=1+deep*1.8;
 /* สูตรเดียวกับเกม (js/slug-engine.js):
    ลำตัว = ย้อม + เม็ดประกายตามยีน vigor (bodySparkle: A = min(1.2, 0.2+vigor×1.6)×0.30)
    หงอน  = ย้อม + แสงเรือง/ขอบเรือง/เม็ดวาว (paintGill) + เงาไล่ตามตำแหน่งก้าน (shadeGill) — ออร่ารอบพุ่มวาดแยกเป็นชั้นเดียวทั้งพุ่ม
    หนวด  = 2 สี: ปลาย = เงาเข้ม→สีกลางของหงอน · โคน = สีกลาง→สีสว่างของลำตัว · ร่องคงที่ 45 */
 const vig=clamp(geneVal('vigor'),0,100)/100;let style='plain',extra=null;
 if(ch.id==='body'){style='body';extra={spark:+(Math.min(1.2,.2+vig*1.6)*.30).toFixed(4)}}
 if(c.src==='gene'&&ch.id==='gill'&&tableOf(c.table).kind==='gill'){style='gill';extra={shine:vig}}
 if(c.src==='gene'&&ch.id==='rhino'){style='rhino';extra={tip:matGill(geneVal(c.gene),tableOf(c.table).kind==='gill'&&c.table in doc.colorTables?c.table:'gill'),base:matBody(geneVal('mainC')),gamma:RHINO_GAMMA}}
 const key=JSON.stringify([M,stops.length,opt,style,extra]);return{M,stops,opt,key,style,extra}}
function lutOf(M,stops){const ST=stops.map(([p,k])=>[p,M[k]||M.l]),lut=new Uint8ClampedArray(768);for(let i=0;i<256;i++){const t=i/255;let a=ST[0],b=ST.at(-1);for(let q=0;q<ST.length-1;q++)if(t>=ST[q][0]&&t<=ST[q+1][0]){a=ST[q];b=ST[q+1];break}const f=(t-a[0])/((b[0]-a[0])||1);for(let k=0;k<3;k++)lut[i*3+k]=a[1][k]+(b[1][k]-a[1][k])*f}return lut}

const cv=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c};
const rgbaC=(c,a)=>'rgba('+c.map(v=>Math.round(clamp(v,0,255))).join(',')+','+a+')',rgbC=c=>'rgb('+c.map(v=>Math.round(clamp(v,0,255))).join(',')+')';
const RC=new Map(),RC_MAX=48,tainted=new Set();   // recoloured bitmaps, LRU-bounded
/* cx = บริบทต่อชิ้น: tone (เกลี่ยโทนรูปที่นำเข้า) · cap (เพดานตารางหงอนนำเข้า) · k (เงาก้านหงอน) · fx/fy (ทิศเม็ดประกายลำตัว) · size (ขนาดอบ) */
const stats={recolour:0,shade:0,ms:0},keep=(ck,c)=>{RC.set(ck,c);while(RC.size>RC_MAX)RC.delete(RC.keys().next().value);return c};
function recolour(src,srcKey,mat,cx){const ck=srcKey+'|'+mat.key+'|'+cx.key,hit=RC.get(ck);if(hit){RC.delete(ck);RC.set(ck,hit);return hit}
 /* หงอน: ขั้นแพง (ย้อม + แสง/ขอบ/เม็ดวาว) ไม่ขึ้นกับตำแหน่ง แคชแยก · เงาตามตำแหน่งก้าน (k) ทาทับทีหลังซึ่งถูกมาก
    ลากหงอนหรือลำตัวจน k เปลี่ยน จึงไม่ต้องย้อมรูปหงอนใหม่ทั้งรูป */
 if(mat.style==='gill'&&cx.k!=null){const bx={...cx,k:null};bx.key=ctxKey(bx);const base=recolour(src,srcKey,mat,bx);if(!base)return null;const t0=performance.now(),c=cv(base.width,base.height),x=c.getContext('2d');x.drawImage(base,0,0);
  crestShade(x,c.width,c.height,src,mat.M,mat.extra.shine,cx.k);stats.shade++;stats.ms+=performance.now()-t0;return keep(ck,c)}
 const t0=performance.now(),w0=src.naturalWidth||src.width,h0=src.naturalHeight||src.height,sc=Math.min(1,1200/Math.max(w0,h0));
 const W=cx.size?cx.size[0]:Math.max(1,Math.round(w0*sc)),H=cx.size?cx.size[1]:Math.max(1,Math.round(h0*sc));
 let art=src,artKey=srcKey;if(cx.relight){const r=relitCrest(src,srcKey,W,H);if(r){art=r;artKey=srcKey+'|relit'}}   // หงอนที่นำเข้า: ลงแสงแบบหงอนแบบ 3 ก่อนย้อม
 const c=cv(W,H),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(art,0,0,W,H);let id;try{id=x.getImageData(0,0,W,H)}catch{return null}
 const p=id.data;
 if(cx.tone){const tm=toneMap(toneOf(p,srcKey),GAME_TONE[cx.tone]);if(tm)for(let i=0;i<p.length;i+=4){if(!p[i+3])continue;const L=(p[i]*.2126+p[i+1]*.7152+p[i+2]*.0722)/255,n=tm[(L*255)|0],r=L>1e-4?n/L:0;p[i]=Math.min(255,p[i]*r);p[i+1]=Math.min(255,p[i+1]*r);p[i+2]=Math.min(255,p[i+2]*r)}}
 if(mat.style==='rhino')rhinoMap(p,W,H,srcKey,mat);
 else{const lut=lutOf(mat.M,mat.stops),{gamma=1,sub=0,div=1}=mat.opt;for(let i=0;i<p.length;i+=4){if(!p[i+3])continue;let t=((p[i]*.2126+p[i+1]*.7152+p[i+2]*.0722)/255-sub)/div;t=t<0?0:t>1?1:t;if(gamma!==1)t=Math.pow(t,gamma);const L=(t*255)|0;p[i]=lut[L*3];p[i+1]=lut[L*3+1];p[i+2]=lut[L*3+2]}}
 x.putImageData(id,0,0);
 if(mat.style==='gill'&&mat.extra.shine>.01)crestLight(x,W,H,art,artKey,mat.M,mat.extra.shine);   // เงาก้าน (shadeGill) ทาในขั้นบน
 if(mat.style==='body')bodySparkle(x,W,H,src,mat.M,mat.extra.spark,cx.fx,cx.fy);
 stats.recolour++;stats.ms+=performance.now()-t0;return keep(ck,c)}

/* หนวด = rhinoPre + paintRhino ของเกม: มาสก์ "ปลาย" จากความอิ่มสีของรูป (ปลายม่วง โคนซีด) เบลอแล้วตัดครึ่งล่างทิ้ง
   เฉดยืดคอนทราสต์แยกโซนปลาย/โคน (เปอร์เซ็นไทล์ 3–97) แล้วไล่ 2 สี · ขั้นที่ไม่ขึ้นกับสีเก็บแคชต่อรูป (เหมือน RHPRE)
   รูปขาวล้วนที่นำเข้าเอง (ไม่มีสีบอกว่าปลายอยู่ไหน) ใช้ตำแหน่งแทน: ส่วนบนของรูป = ปลาย
   มาสก์ใส่อัลฟาของรูปก่อนเบลอ = เบลอเฉพาะเนื้อหนวด (แคนวาสเบลอแบบ premultiplied) — เดิมอัลฟาทึบทั้งแผ่น
   พื้นโปร่งใสรอบรูปนับเป็น "ไม่อิ่มสี" แล้วถูกเบลอกินขอบปลาย ขอบบนหนวดจึงกลายเป็นสีตัว */
const RHP=new Map();
function rhinoPrep(p,W,H,srcKey){const ck=srcKey+'|'+W+'x'+H;let r=RHP.get(ck);if(r)return r;const n=W*H,lum=new Float32Array(n),sat=new Uint8ClampedArray(n*4);let tipPx=0,solid=0;
 for(let j=0;j<n;j++){const R=p[j*4],G=p[j*4+1],B=p[j*4+2],hi=Math.max(R,G,B),lo=Math.min(R,G,B),s=hi>1?(hi-lo)/hi:0,v=clamp((s-.10)/.28,0,1)*255;lum[j]=(R*.2126+G*.7152+B*.0722)/255;sat[j*4]=sat[j*4+1]=sat[j*4+2]=v;sat[j*4+3]=p[j*4+3];if(p[j*4+3]>=32){solid++;if(v>178)tipPx++}}
 const t=new Uint8ClampedArray(n),bySat=tipPx>solid*.02;
 if(bySat){const m=cv(W,H);m.getContext('2d').putImageData(new ImageData(sat,W,H),0,0);const b=cv(W,H),bx=b.getContext('2d',{willReadFrequently:true});bx.filter='blur('+(H*.022).toFixed(1)+'px)';bx.drawImage(m,0,0);bx.filter='none';const bd=bx.getImageData(0,0,W,H).data;for(let j=0;j<n;j++)t[j]=bd[j*4]}
 else{const ss=q=>{q=q<0?0:q>1?1:q;return q*q*(3-2*q)};for(let y=0;y<H;y++){const f=y/H;t.fill(Math.round((f<=.62?.5+.5*ss((.62-f)/.30):.5*ss((.92-f)/.30))*255),y*W,y*W+W)}}
 const tl=[],bl=[];for(let j=0;j<n;j++){if(p[j*4+3]<32)continue;if(t[j]>178.5)tl.push(lum[j]);else if(t[j]<76.5)bl.push(lum[j])}
 const pct=(a,q,dv)=>{if(!a.length)return dv;a.sort((x,y)=>x-y);return a[Math.max(0,Math.min(a.length-1,Math.floor(q*a.length)))]};
 const tLo=pct(tl,.03,.15),tHi=pct(tl,.97,.65),bLo=pct(bl,.03,.78),bHi=pct(bl,.97,1),nz=(v,a,b)=>Math.round(clamp((v-a)/((b-a)||1),0,1)*255);
 const st=new Uint8ClampedArray(n),sb=new Uint8ClampedArray(n);for(let j=0;j<n;j++){st[j]=nz(lum[j],tLo,tHi);sb[j]=nz(lum[j],bLo,bHi)}
 r={st,sb,t,bySat};RHP.set(ck,r);while(RHP.size>12)RHP.delete(RHP.keys().next().value);return r}
function rhinoMap(p,W,H,srcKey,mat){const {st,sb,t}=rhinoPrep(p,W,H,srcKey),lutT=lutOf(mat.extra.tip,[[0,'d'],[1,'m']]),lutB=lutOf(mat.extra.base,[[0,'m'],[1,'l']]),g=mat.extra.gamma,pw=new Uint8Array(256);
 for(let i=0;i<256;i++)pw[i]=(Math.pow(i/255,g)*255)|0;
 for(let j=0;j<W*H;j++){const i=j*4;if(!p[i+3])continue;const a=pw[st[j]],b=pw[sb[j]],tip=Math.max(0,(t[j]/255-.5)/.5);for(let k=0;k<3;k++)p[i+k]=lutB[b*3+k]+(lutT[a*3+k]-lutB[b*3+k])*tip}}

/* หงอน — paintGill ของเกม: แสงเรืองกลางพุ่ม + ขอบเรือง (ตัดโคนแบบเดียวกับเกม) + เม็ดวาวบนเนื้อกิ่ง */
function crestLight(x,w,h,art,srcKey,M,amt){const lit=lumOf(M.d)>lumOf(M.l)?M.d:M.l;
 const g=x.createRadialGradient(w*.5,h*.58,0,w*.5,h*.58,w*.8);g.addColorStop(0,rgbaC(lit,(.10*amt).toFixed(3)));g.addColorStop(1,rgbaC(lit,0));
 x.globalCompositeOperation='lighter';x.fillStyle=g;x.fillRect(0,0,w,h);x.globalCompositeOperation='destination-in';x.drawImage(art,0,0,w,h);
 const r=cv(w,h),rx=r.getContext('2d');rx.fillStyle=rgbaC(lit,(.95*amt*.20).toFixed(3));rx.fillRect(0,0,w,h);rx.globalCompositeOperation='destination-in';rx.drawImage(art,0,0,w,h);
 rx.globalCompositeOperation='destination-out';rx.filter='blur('+Math.max(1.2,Math.min(w,h)*.012).toFixed(2)+'px)';rx.drawImage(art,0,0,w,h);rx.filter='none';
 const fg=rx.createLinearGradient(0,h*.66,0,h);fg.addColorStop(0,'rgba(0,0,0,1)');fg.addColorStop(1,'rgba(0,0,0,0)');rx.globalCompositeOperation='destination-in';rx.fillStyle=fg;rx.fillRect(0,h*.66,w,h*.34);
 x.globalCompositeOperation='lighter';x.drawImage(r,0,0);
 const col=mixC(M.m,[255,255,255],.5),s=cv(w,h),sx=s.getContext('2d');let seed=19;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff};
 const dot=(px,py,rr,a)=>{const gg=sx.createRadialGradient(px,py,0,px,py,rr);gg.addColorStop(0,rgbaC(col,(a*amt).toFixed(3)));gg.addColorStop(.45,rgbaC(col,(a*amt*.45).toFixed(3)));gg.addColorStop(1,rgbaC(col,0));sx.fillStyle=gg;sx.fillRect(px-rr,py-rr,rr*2,rr*2)};
 for(let i=0;i<110;i++)dot(rnd()*w,rnd()*rnd()*h*.98,w*(.006+rnd()*rnd()*.020),.50+rnd()*.40);
 dot(w*.50,h*.20,w*.13,.34);dot(w*.74,h*.32,w*.09,.26);dot(w*.28,h*.28,w*.09,.24);
 const lg=sx.createLinearGradient(0,0,0,h*.55);lg.addColorStop(0,rgbaC(col,(.30*amt).toFixed(3)));lg.addColorStop(1,rgbaC(col,0));sx.fillStyle=lg;sx.fillRect(0,0,w,h*.55);
 const bm=brightMask(art,srcKey,w,h);if(bm){sx.globalCompositeOperation='destination-in';sx.drawImage(bm,0,0)}
 x.globalCompositeOperation='source-over';x.drawImage(s,0,0);x.globalCompositeOperation='destination-in';x.drawImage(art,0,0,w,h);x.globalCompositeOperation='source-over'}
/* มาสก์ "เนื้อสว่าง" ของรูป (gillBright): อัลฟาตามความสว่าง เม็ดวาวจึงเกาะเนื้อกิ่ง ไม่เกาะเส้นขอบ — แคชต่อรูป+ขนาด */
const BM=new Map();
function brightMask(art,srcKey,w,h){const ck=srcKey+'|'+w+'x'+h;if(BM.has(ck))return BM.get(ck);const b=cv(w,h),bx=b.getContext('2d',{willReadFrequently:true});bx.drawImage(art,0,0,w,h);
 try{const d=bx.getImageData(0,0,w,h),q=d.data;for(let i=0;i<q.length;i+=4){const L=(q[i]*.2126+q[i+1]*.7152+q[i+2]*.0722)/255;q[i]=q[i+1]=q[i+2]=255;q[i+3]=q[i+3]*Math.pow(L,1.8)}bx.putImageData(d,0,0)}catch{return null}
 BM.set(ck,b);while(BM.size>16)BM.delete(BM.keys().next().value);return b}
/* shadeGill ของเกม: ก้านที่ห่างกลางพุ่ม (u 0.51) จมเข้า k = 1 → 0.38 ปัดทีละ 0.25 · ปลายหงอน (บน) เข้มลง */
function crestShade(x,w,h,art,M,amt,k){const dk=(1-k)*amt;x.globalCompositeOperation='multiply';
 if(dk>.01){x.globalAlpha=dk*.85;x.fillStyle=rgbC(M.d);x.fillRect(0,0,w,h);x.globalAlpha=1}
 const g=x.createLinearGradient(0,0,0,h*.62);g.addColorStop(0,rgbaC(M.d,(.45*amt).toFixed(3)));g.addColorStop(1,rgbaC(M.d,0));x.fillStyle=g;x.fillRect(0,0,w,h*.62);
 x.globalCompositeOperation='destination-in';x.drawImage(art,0,0,w,h);x.globalCompositeOperation='source-over'}
/* bodySparkle ของเกม: เม็ดประกาย seed คงที่ บวกแสงแบบ lighter แล้วตัดตามรูปลำตัว
   ตำแหน่งเม็ดคิดตามภาพที่เห็นบนจอ (รูปที่กลับด้านไว้ → กลับเม็ดตาม จะได้ตรงกับในเกม) */
function bodySparkle(x,w,h,art,M,Av,fx,fy){if(!(Av>.02))return;const gc=lerpC(M.l,[255,255,255],.3),cs=al=>'rgba('+gc.map(v=>Math.round(v)).join(',')+','+al+')';
 let seed=41;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff};const N=Math.round(70*Av)+20;x.globalCompositeOperation='lighter';
 for(let i=0;i<N;i++){let px=rnd()*w,py=rnd()*h;const r=w*(.003+rnd()*rnd()*.010),al=(.4+rnd()*.6)*Av;if(fx)px=w-px;if(fy)py=h-py;
  const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,cs(al.toFixed(3)));g.addColorStop(.4,cs((al*.5).toFixed(3)));g.addColorStop(1,cs(0));x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fill()}
 x.globalCompositeOperation='destination-in';x.drawImage(art,0,0,w,h);x.globalCompositeOperation='source-over'}

/* โทนรูปของเกม: ความสว่างที่เปอร์เซ็นไทล์ 5/25/50/75/95 ของอาร์ตนิวทรัลใน js/slug-engine.js (วัด 2026-09-26)
   อาร์ตที่นำเข้าเอง (เช่นชุด Oreo สีขาว) สว่างกว่ามาก → ถ้าย้อมตรง ๆ จะตกไปปลายโทนอ่อนของตาราง = ซีดกว่าในเกม
   จึงเกลี่ยความสว่างให้กระจายเหมือนอาร์ตของเกมก่อนย้อม (เปิด/ปิดได้ในการ์ดพรีวิว)
   ⚠️ ใช้กับรูปที่นำเข้าเท่านั้น — รูปของเกมเองย้อมตรงเหมือนในเกม (เดิมเกลี่ยทุกรูป หงอนแบบ 2/3 และหนวดของเกมเลยเพี้ยน)
   หนวดไม่ต้องเกลี่ย: สูตรหนวดยืดคอนทราสต์แยกโซนเองอยู่แล้ว */
const GAME_TONE={body:[.753,.843,.872,.897,.955]};   // หงอนที่นำเข้าใช้การลงแสงแบบหงอนแบบ 3 แทน (relitCrest)
const TONE=new Map();   // srcKey → source quantiles (computed once per image)
function toneOf(p,srcKey){let q=TONE.get(srcKey);if(q)return q;const L=[];for(let i=0;i<p.length;i+=16)if(p[i+3]>128)L.push((p[i]*.2126+p[i+1]*.7152+p[i+2]*.0722)/255);
 if(L.length<20)return null;L.sort((a,b)=>a-b);q=[.05,.25,.5,.75,.95].map(f=>L[Math.floor(f*(L.length-1))]);TONE.set(srcKey,q);if(TONE.size>64)TONE.delete(TONE.keys().next().value);return q}
function toneMap(src,dst){if(!src||!dst)return null;const xs=[0,...src,1],ys=[0,...dst,1],lut=new Float32Array(256);
 for(let i=0;i<256;i++){const t=i/255;let k=0;while(k<xs.length-2&&t>xs[k+1])k++;const span=xs[k+1]-xs[k];lut[i]=span>1e-6?ys[k]+(ys[k+1]-ys[k])*(t-xs[k])/span:ys[k]}return lut}
let gameArtSet=null;const GAME_ART=()=>gameArtSet||(gameArtSet=new Set(BUILTIN.filter(k=>!/^oreo_/.test(k)).map(k=>PARTS[k]?.img).filter(Boolean)));

/* ---------- หงอนที่นำเข้าเอง: ลงแสงแบบ "หงอนแบบ 3" ของเกมก่อนย้อม ----------
   วัด 2026-09-26 (ความสว่างเฉลี่ยตามระยะจากขอบรูป ขอบ → ใน):
     หงอนแบบ 3 ของเกม 0.79 → 0.66 = ขอบ/ปลายใบสว่าง ด้านในมืดลง มีร่องมืดระหว่างใบ
     เหงือกขาว Oreo   0.66 → 0.93 = กลับด้าน ขอบมืด กลางกิ่งสว่าง
   ย้อมตรง ๆ Oreo จึงได้แกนกิ่งขาว (ผู้ใช้ทัก) และถ้าตัดช่วงตารางไว้ 80% (วิธีเดิม) ก็ทึบเป็นสีเดียว ไม่มีไฮไลต์อ่อนแบบหงอนแบบ 3 (ผู้ใช้ทักอีกรอบ)
   วิธีนี้แก้ที่การลงแสง ไม่แตะรูป: ความสว่างใหม่ = โปรไฟล์ขอบ→ใน ของหงอนแบบ 3 (เทียบระยะกับขนาดกิ่งของรูปเอง)
   + ผิวละเอียดของรูปเดิม ในสัดส่วนเดียวกับหงอนแบบ 3 แล้วเกลี่ยทั้งรูปให้กระจายความสว่างเท่าหงอนแบบ 3
   → ไฮไลต์อ่อนไปอยู่ขอบ/ปลายใบ แกนกิ่งไม่ขาว สัดส่วนสีเท่าหงอนแบบ 3 แล้วเข้าสูตรย้อมหงอนเดิมทุกขั้น
   คิดครั้งเดียวต่อรูป+ขนาด (แคช) · ปิดได้ที่ช่อง "ปรับรูปที่นำเข้าเอง" ในการ์ดพรีวิว (ปิด = ย้อมจากรูปดิบ) */
const CREST_REF='gill3';
/* ระยะจากขอบ (Euclidean distance transform แบบ Felzenszwalb) ของพิกเซลในรูปถึงพิกเซลโปร่งที่ใกล้สุด */
function edt(mask,W,H){const INF=1e20,g=new Float64Array(W*H),N=Math.max(W,H),f=new Float64Array(N),d=new Float64Array(N),v=new Int32Array(N),z=new Float64Array(N+1);
 for(let i=0;i<W*H;i++)g[i]=mask[i]?INF:0;
 const pass=n=>{let k=0;v[0]=0;z[0]=-INF;z[1]=INF;for(let q=1;q<n;q++){let s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);while(s<=z[k]){k--;s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k])}k++;v[k]=q;z[k]=s;z[k+1]=INF}
  k=0;for(let q=0;q<n;q++){while(z[k+1]<q)k++;const r=v[k];d[q]=(q-r)*(q-r)+f[r]}};
 for(let x=0;x<W;x++){for(let y=0;y<H;y++)f[y]=g[y*W+x];pass(H);for(let y=0;y<H;y++)g[y*W+x]=d[y]}
 for(let y=0;y<H;y++){for(let x=0;x<W;x++)f[x]=g[y*W+x];pass(W);for(let x=0;x<W;x++)g[y*W+x]=Math.sqrt(d[x])}return g}
/* สถิติการลงแสงของรูปหงอน · dn = ระยะจากขอบ ÷ ค่ากลางของระยะ (≈ รัศมีใบทั่วไป: ใบเล็ก/ก้านใหญ่ได้แถบขอบกว้างเท่ากัน)
   · prof = ความสว่างเฉลี่ยตาม dn (แสงขอบ→ใน) · hp = ผิวละเอียด = เบลอเล็ก (~22% ใบ ตัดเม็ด/ผิวทรายของรูปที่ขยายแล้วเป็นเม็ดหยาบ)
     − เบลอใหญ่ (~60% ใบ ตัดแสงระดับใบ เช่น กลางใบสว่าง/ขอบมืดของ Oreo) เหลือแค่ร่องและปุ่มเล็ก ๆ */
function crestStats(p,W,H){const n=W*H,mask=new Uint8Array(n),lum=new Float32Array(n);let solid=0;
 for(let j=0;j<n;j++){lum[j]=(p[j*4]*.2126+p[j*4+1]*.7152+p[j*4+2]*.0722)/255;if(p[j*4+3]>128){mask[j]=1;solid++}}
 if(solid<64)return null;const d=edt(mask,W,H);let dmax=0;for(let j=0;j<n;j++)if(mask[j]&&d[j]>dmax)dmax=d[j];if(!(dmax>0)||dmax>W+H)return null;
 const HB=2048,hd=new Uint32Array(HB);for(let j=0;j<n;j++)if(mask[j])hd[Math.min(HB-1,(d[j]/dmax*HB)|0)]++;let acc=0,d50=dmax;for(let i=0;i<HB;i++){acc+=hd[i];if(acc>=solid*.5){d50=(i+1)/HB*dmax;break}}
 const dn=new Float32Array(n);for(let j=0;j<n;j++)dn[j]=mask[j]?d[j]/d50:0;
 const NB=16,TOP=4,sum=new Float64Array(NB),cnt=new Float64Array(NB);for(let j=0;j<n;j++)if(mask[j]){const b=Math.min(NB-1,(dn[j]/TOP*NB)|0);sum[b]+=lum[j];cnt[b]++}
 const prof=new Float32Array(NB);let last=-1;for(let b=0;b<NB;b++)if(cnt[b]){prof[b]=sum[b]/cnt[b];if(last<0)for(let q=0;q<b;q++)prof[q]=prof[b];last=b}else if(last>=0)prof[b]=prof[last];
 const at=x=>{const t=clamp(x/TOP*NB-.5,0,NB-1),i=Math.floor(t),f=t-i;return prof[i]+(prof[Math.min(NB-1,i+1)]-prof[i])*f};
 const qs=blurInside(lum,mask,W,H,Math.max(.8,d50*.22)),ql=blurInside(lum,mask,W,H,Math.max(1,d50*.6)),hp=new Float32Array(n);let h2=0;
 for(let j=0;j<n;j++){hp[j]=qs[j]-ql[j];if(mask[j])h2+=hp[j]*hp[j]}
 return{mask,lum,dn,at,hp,hpStd:Math.sqrt(h2/solid),solid,d50}}
/* ค่าเบลอเฉพาะในรูป = เบลอ(ค่า×มาสก์) ÷ เบลอ(มาสก์) — ขอบรูปไม่ถูกดึงไปหาพื้นโปร่ง
   เบลอกล่อง 3 รอบ (ใกล้เคียงเกาส์ σ=r) ใน JS: เวลาไม่ขึ้นกับรัศมี และไม่ต้องอ่านพิกเซลกลับจากแคนวาส */
function blurInside(val,mask,W,H,r){const n=W*H,a=new Float32Array(n),m=new Float32Array(n),t=new Float32Array(n);for(let j=0;j<n;j++)if(mask[j]){a[j]=val[j];m[j]=1}
 const wI=Math.sqrt(4*r*r+1);let wl=Math.floor(wI);if(wl%2===0)wl--;const mI=Math.round((12*r*r-3*wl*wl-12*wl-9)/(-4*wl-4)),sizes=[0,1,2].map(i=>i<mI?wl:wl+2);
 const pass=(src,dst,rad,horiz)=>{const len=horiz?W:H,lines=horiz?H:W,step=horiz?1:W,stride=horiz?W:1,inv=1/(2*rad+1),last=len-1;
  for(let l=0;l<lines;l++){const o=l*stride,first=src[o],end=src[o+last*step];let acc=first*(rad+1);for(let k=1;k<=rad;k++)acc+=src[o+Math.min(k,last)*step];
   for(let i=0;i<len;i++){dst[o+i*step]=acc*inv;const ai=i+rad+1,ri=i-rad;acc+=(ai<=last?src[o+ai*step]:end)-(ri>=0?src[o+ri*step]:first)}}};
 for(const arr of [a,m])for(const s of sizes){const rad=Math.max(0,(s-1)>>1);if(!rad)continue;pass(arr,t,rad,true);pass(t,arr,rad,false)}
 const out=new Float32Array(n);for(let j=0;j<n;j++)out[j]=m[j]>.01?a[j]/m[j]:val[j];return out}
let refCrestStats=null;
function refCrest(){if(refCrestStats)return refCrestStats;const im=IMG[PARTS[CREST_REF]?.img];if(!im?.naturalWidth)return null;const W=im.naturalWidth,H=im.naturalHeight,c=cv(W,H),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);
 let p;try{p=x.getImageData(0,0,W,H).data}catch{return null}const s=crestStats(p,W,H);if(!s)return null;const L=[];for(let j=0;j<W*H;j++)if(s.mask[j])L.push(s.lum[j]);L.sort((a,b)=>a-b);s.sorted=Float32Array.from(L);return refCrestStats=s}
const RELIT=new Map(),RELIT_MAX=480;   // แสงเป็นค่าเรียบ ๆ คิดที่ด้านยาว ≤480 px แล้วขยายกลับ (เร็วกว่าความละเอียดเต็ม ~6 เท่า) · อัลฟาใช้ของเดิมความละเอียดเต็ม
function relitCrest(src,srcKey,W,H){const ck=srcKey+'|'+W+'x'+H;if(RELIT.has(ck))return RELIT.get(ck);const ref=refCrest();if(!ref)return null;
 const t0=performance.now(),k=Math.min(1,RELIT_MAX/Math.max(W,H)),w=Math.max(8,Math.round(W*k)),h=Math.max(8,Math.round(H*k));
 const sm=cv(w,h),sx=sm.getContext('2d',{willReadFrequently:true});sx.drawImage(src,0,0,w,h);let sd;try{sd=sx.getImageData(0,0,w,h)}catch{return null}const s=crestStats(sd.data,w,h);if(!s)return null;
 // แสงขอบ→ใน ของหงอนแบบ 3 (เกลี่ยนิดหน่อยให้ไม่เห็นรอยแกนกลาง/วงระยะในก้านหนา) + ผิวละเอียดของรูปเดิม ความแรงเท่าผิวละเอียดของหงอนแบบ 3
 // ขอบนอกสุดไม่เอาผิวเดิม (ขอบรูปเดิมมืด จะกลายเป็นเส้นขอบดำ) ให้เป็นแสงขอบของหงอนแบบ 3 ล้วน
 const n=w*h,raw=new Float32Array(n);for(let j=0;j<n;j++)raw[j]=ref.at(s.dn[j]);const base=blurInside(raw,s.mask,w,h,Math.max(1,s.d50*.35)),kTex=clamp(ref.hpStd/Math.max(1e-4,s.hpStd),.4,3),v=new Float32Array(n);
 for(let j=0;j<n;j++){let r=(s.dn[j]-.05)/.4;r=r<0?0:r>1?1:r;v[j]=base[j]+kTex*s.hp[j]*r*r*(3-2*r)}
 // เกลี่ยทั้งรูปให้กระจายความสว่างเท่าหงอนแบบ 3 (จับคู่ฮิสโทแกรมเต็ม)
 let lo=1e9,hi=-1e9;for(let j=0;j<n;j++)if(s.mask[j]){if(v[j]<lo)lo=v[j];if(v[j]>hi)hi=v[j]}const NB=1024,span=(hi-lo)||1,hist=new Float64Array(NB);
 for(let j=0;j<n;j++)if(s.mask[j])hist[Math.min(NB-1,((v[j]-lo)/span*NB)|0)]++;const map=new Float32Array(NB),R=ref.sorted;let acc=0;
 for(let i=0;i<NB;i++){const mid=acc+hist[i]/2;acc+=hist[i];map[i]=R[Math.min(R.length-1,Math.floor(mid/s.solid*R.length))]}
 // ภาพเทาทึบ (นอกรูปเป็นค่าแสงขอบ ขยายแล้วขอบไม่ดำ) → ขยายกลับเป็น W×H แล้วใช้อัลฟาเดิม
 const gd=sx.createImageData(w,h);for(let j=0;j<n;j++){const g=Math.round(map[clamp(((v[j]-lo)/span*NB)|0,0,NB-1)]*255);gd.data[j*4]=gd.data[j*4+1]=gd.data[j*4+2]=g;gd.data[j*4+3]=255}sx.putImageData(gd,0,0);
 const c=cv(W,H),x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(sm,0,0,W,H);x.globalCompositeOperation='destination-in';x.drawImage(src,0,0,W,H);x.globalCompositeOperation='source-over';   // ขยาย + อัลฟาเดิม ด้วยงานของแคนวาส ไม่วนพิกเซลความละเอียดเต็ม
 stats.relightK=+kTex.toFixed(3);stats.relightMs=Math.round(performance.now()-t0);stats.relight=(stats.relight||0)+1;RELIT.set(ck,c);while(RELIT.size>8)RELIT.delete(RELIT.keys().next().value);return c}

/* ---------- ยีนรูปร่าง/จำนวน: สร้าง "ผังที่เห็น" จากผังจริง (ผังจริงไม่ถูกแก้) ----------
   ตำแหน่งทุกชิ้นคิดเป็น u/v บนกล่องลำตัว แล้วกล่องยืดตาม len×girth (ยึดกลางท้อง = เส้นพื้น)
   หงอน ×girth×gillLen · หนวด ×girth×tentLen ย่อ/ขยายรอบโคน · ชิ้นอื่น (ตา ลาย) ×girth รอบจุดกลางของมัน
   gillN: ผังมีหงอนเท่าจำนวนนั้นพอดี = ใช้ผังของคุณ · จำนวนอื่นใช้ตำแหน่งหงอนของเกม (GILL_SETS) ด้วยรูปหงอนในผัง
   spotN: ชิ้นช่องสี "ลาย" เรียงดวงใหญ่→เล็ก เติมตามจำนวน · ลายวงกลม/สี่เหลี่ยม/สามเหลี่ยมของเกมเปลี่ยนรูปตามยีน · เอียง/ขนาดสุ่มคงที่ต่อช่องแบบเกม */
const boxH=L=>{const P=PARTS[L.part];return P.h*P.nat*L.s*EY(L)};
/* พันธุ์ใหม่ = ลำตัวไม่ใช่รูปลำตัวของทากตัวเดิม → ใช้กฎพันธุ์ใหม่ (เหมือน tools/build-species.mjs ที่แปลงผังเข้าเกม)
   ไม่ดูว่าหงอน/ลายเป็นรูปของเกมหรือไม่ — ผังพันธุ์ใหม่ใช้หงอนแบบ 3 / ลายวงกลมของเกมได้ */
const newSpecies=()=>{const B=bodyLayer();return !!B&&B.part!=='body'};
/* ผังหันขวา (ตาอยู่ครึ่งขวาของลำตัว) — ตัวแปลงเข้าเกมกลับให้หันซ้าย จึงต้องจับคู่ช่องหงอน/เงาก้านด้วย u ที่กลับแล้วเหมือนกัน */
function facesRight(){const B=bodyLayer();if(!B)return false;const bb=bboxOf(B),E=doc.layers.filter(L=>PARTS[L.part]&&effVis(L)&&L!==B&&channelOf(L)?.id==='eye'&&/eye|ตา/i.test(L.part+' '+(L.name||'')));
 return E.length?E.reduce((a,L)=>a+(L.x-bb.x)/bb.w,0)/E.length>.5:false}
function displayDoc(real){const B=bodyLayer();if(!B)return null;const Mo=morphOf(),bb=bboxOf(B),ax=bb.x+bb.w/2,ay=bb.y+bb.h,kx=Mo.stretch*Mo.size,ky=Mo.size;
 const box={x:ax-bb.w*kx/2,y:ay-bb.h*ky,w:bb.w*kx,h:bb.h*ky},info={box,morph:Mo,crest:null,spots:null};
 let layers=real.layers.map(L=>{const P=PARTS[L.part];if(!P)return L;const role=L===B?'body':channelOf(L)?.id||'eye',D={...L,role,ref:L===B};D.x=ax+(L.x-ax)*kx;D.y=ay+(L.y-ay)*ky;
  if(role==='body'){D.ex=EX(L)*kx;D.ey=EY(L)*ky;return D}
  const f=Mo.size*(role==='gill'?Mo.gScale:role==='rhino'?Mo.tScale:1);
  if((role==='gill'||role==='rhino')&&P.ay<.9){const b=warpWorld(D,{x:P.ax,y:1});D.x=b[0]+(D.x-b[0])*f;D.y=b[1]+(D.y-b[1])*f}   // ชิ้นที่ไม่ได้ยึดที่โคน: ย่อ/ขยายรอบขอบล่าง (ชิ้นยึดโคนหมุน/ย่อรอบจุดยึดอยู่แล้ว)
  D.s=L.s*f;return D});
 const spots=layers.filter(L=>L.role==='spot'&&effVis(L));
 if(spots.length&&newSpecies()){const N=spots.length,plan=fadePlan(Mo.spotV,N);info.spots={...plan,N};
  const items=spots.map((L,i)=>{const b=bboxOf(L);return{L,i,x:b.x+b.w/2,y:b.y+b.h/2,r:boxH(L)}});
  spotOrder(items).forEach((o,rank)=>{const L=o.L;if(rank>=plan.n){L.vis=false;return}const j=slotJitter(rank);L.s*=.92+j.js*.16;L.rot=(+L.rot||0)+SPOT_TILT.circle*j.jr;
   if(rank===plan.full){const e=plan.f*plan.f*(3-2*plan.f);L.s*=.45+.55*e;L.op=(L.op??1)*e}})}
 else if(spots.length){const N=spots.length,plan=spotPlan(Mo.spotV,N);info.spots={...plan,N};
  spots.map((L,i)=>({L,i,h:boxH(L)})).sort((a,b)=>b.h-a.h||a.i-b.i).forEach((o,rank)=>{const L=o.L;if(rank>=plan.n){L.vis=false;return}const j=slotJitter(rank),np=SPOT_PART[plan.shape];
   if(SPOT_ART.has(L.part)&&L.part!==np&&PARTS[np]){const P0=PARTS[L.part],P1=PARTS[np];L.s*=P0.h*P0.nat/(P1.h*P1.nat);L.part=np}
   L.s*=.92+j.js*.16;L.rot=(+L.rot||0)+SPOT_TILT[plan.shape]*j.jr})}
 const crest=layers.filter(L=>L.role==='gill'&&effVis(L)),k=crest.length;
 const ownArt=k===9&&CREST_KEEP[Mo.nGill]&&newSpecies(),fr=facesRight();
 if(ownArt){const bi=layers.findIndex(L=>L.ref),items=crest.map(L=>({id:L.id,u:fr?1-(L.x-box.x)/box.w:(L.x-box.x)/box.w,v:(L.y-box.y)/box.h,rot:+L.rot||0,h:PARTS[L.part].h*L.s*PARTS[L.part].nat*(typeof EY==='function'?EY(L):(L.ey||1)),back:layers.indexOf(L)<bi,d:layers.indexOf(L)})),slot=crestSlots(items),keepS=new Set(CREST_KEEP[Mo.nGill]);
  for(const L of crest){L.slot=slot.get(L.id);if(!keepS.has(L.slot))L.vis=false}
  info.crest={n:Mo.nGill,k,game:false,own:true,slots:crest.map(L=>L.slot)}}
 else if(k){info.crest={n:Mo.nGill,k,game:Mo.nGill!==k};
  if(Mo.nGill!==k){const tpl=crest[0],builtin=crest.every(L=>/^gill[23]?$/.test(L.part)),chId=channelOf(tpl)?.id||'gill',bi=layers.findIndex(L=>L.ref);
   const set=gillSet(Mo.nGill).map((G,i)=>{const part=builtin?(G.part||'gill'):tpl.part,P=PARTS[part];return{...tpl,id:-1-i,part,name:'หงอน (ยีน) '+(i+1),channel:chId,gid:null,x:box.x+G.u*box.w,y:box.y+G.v*box.h,s:box.h*G.hR*Mo.gScale/(P.h*P.nat),ex:G.ar||1,ey:1,rot:G.rot,fx:G.flip,fy:false,op:1,vis:true,lock:true,warp:null,rig:null,surface:null,animationKeys:null,role:'gill',ghost:true,back:G.back,d:G.d}});
   const back=set.filter(G=>G.back),front=set.filter(G=>!G.back).sort((a,b)=>a.d-b.d),drop=new Set(crest),firstBack=crest.find(L=>layers.indexOf(L)<bi),lastFront=[...crest].reverse().find(L=>layers.indexOf(L)>bi);
   const out=[];let backDone=false;for(const L of layers){if(!backDone&&(L===firstBack||(!firstBack&&L.ref))){out.push(...back);backDone=true}if(!drop.has(L))out.push(L);if(L===lastFront)out.push(...front)}
   if(!backDone)out.unshift(...back);if(!lastFront)out.push(...front);layers=out}}
 const d={...real,layers};Object.defineProperty(d,'_gene',{value:info});return d}

/* ลายในเกมอบเป็นภาพเล็กครั้งเดียวต่อตัว (paintBody: กว้าง = รัศมีดวงใหญ่สุด×2×1.25 หน่วยเกม เช่น 56 px) แล้วขยายวาง
   ลายจุดละเอียดในรูปจึงเกลี่ยจนนวลกว่ารูปดิบ — อบขนาดเดียวกับเกมถึงจะเห็นสีลายเท่าในเกม */
function spotTexWidth(box){if(!box)return 0;let r=0;const bhE=BODY_W0*box.h/box.w*(shapeOn()?morphOf().stretch*morphOf().size:1);
 for(const L of doc.layers)if(PARTS[L.part]&&effVis(L)&&channelOf(L)?.id==='spot')r=Math.max(r,boxH(L)/box.h/2*bhE);return r*2*1.25}
const crestK=(L,box)=>{if(!box)return 1;let u=(L.x-box.x)/box.w;if(newSpecies()&&facesRight())u=1-u;return Math.round((1-.62*Math.min(1,Math.abs(u-CREST_MID)/.15))*4)/4};
function layerCtx(L,P,ch,mat,pad,box,spotW){const cx={},game=GAME_ART().has(P.img);
 if(!game&&preview.matchTone!==false){if(ch.id==='gill')cx.relight=1;else if(GAME_TONE[ch.id])cx.tone=ch.id}
 if(mat.style==='gill'&&mat.extra.shine>.01)cx.k=crestK(L,box);
 if(mat.style==='body'){cx.fx=!!L.fx;cx.fy=!!L.fy}
 if(ch.id==='spot'&&spotW>0){const tw=clamp(Math.round(spotW),16,P.w),f=tw/P.w;cx.size=[Math.max(1,Math.round(P.w*f*(1+2*pad))),Math.max(1,Math.round(Math.max(16,P.h*f)*(1+2*pad)))]}
 cx.key=ctxKey(cx);return cx}
const ctxKey=cx=>[cx.tone||'',cx.relight?'R':'',cx.k==null?'':cx.k,cx.fx?1:0,cx.fy?1:0,cx.size?cx.size.join('x'):''].join(',');

const shown=new Map();   // layer id → {key, canvas}: reuse the on-stage canvas while nothing relevant changed
function colourPass(box){if(!preview.on){shown.clear();showBlocked([]);return}
 const alive=new Set(),blocked=[],spotW=spotTexWidth(box);
 for(const L of doc.layers){const P=PARTS[L.part];if(!P||!effVis(L))continue;const ch=channelOf(L);if(!ch)continue;const mat=materialOf(ch);if(!mat)continue;
  const node=$('world').querySelector('.ly[data-id="'+L.id+'"]'),child=node?.firstElementChild;if(!child)continue;
  let src,srcKey,pad=0;if(child.tagName==='CANVAS'){const w=warpCache.get(L.id);src=child;pad=w?.pad||0;srcKey='w'+L.id+'|'+(w?.key||'')+(w?.draft?'|d':'')}else{src=IMG[P.img];srcKey='p'+P.img}
  if(!src)continue;if(tainted.has(srcKey)){blocked.push(L.name);continue}
  const cx=layerCtx(L,P,ch,mat,pad,box,spotW),key=srcKey+'|'+mat.key+'|'+cx.key;let entry=shown.get(L.id);
  if(entry?.key!==key&&child.tagName==='CANVAS'&&warpDraft){if(entry)shown.delete(L.id);continue}   // ลากอยู่: โชว์สีดิบไปก่อน ย้อมตอนปล่อย (endWarpDraft วาดใหม่)
  if(entry?.key!==key){const rc=recolour(src,srcKey,mat,cx);if(!rc){tainted.add(srcKey);blocked.push(L.name);continue}
   const c=entry?.canvas||document.createElement('canvas');c.width=rc.width;c.height=rc.height;c.getContext('2d').drawImage(rc,0,0);entry={key,canvas:c};shown.set(L.id,entry)}
  const c=entry.canvas;c.style.cssText=child.style.cssText;c.style.width=(child.tagName==='IMG'?P.w+'px':child.style.width);c.style.height=(child.tagName==='IMG'?P.h+'px':child.style.height);c.style.display='block';c.style.pointerEvents='none';
  node.replaceChildren(c);alive.add(L.id)}
 for(const id of shown.keys())if(!alive.has(id))shown.delete(id);showBlocked(blocked)}

/* ---------- ออร่า + ประกายอนูรอบพุ่มหงอน (drawGillAura ในเกม) ----------
   เกมวาดครั้งเดียวคลุมทั้งพุ่ม (กรอบรวมของทุกก้าน) แบบ lighter ไม่ตัดตามรูป — เดิมเครื่องมือนี้วาดแยกในกรอบของแต่ละชิ้น
   จึงเห็นเป็นแท่งสี่เหลี่ยมเรืองด้านหลังหงอน · ตอนนี้เป็นชั้นเดียวทั้งพุ่ม ผสมแบบ plus-lighter (บวกแสงเหมือน lighter)
   วางเหนือโลกของเวที (ไม่ใช่ใน #world ที่แยกกลุ่มผสมสี) จึงบวกแสงลงพื้นเวทีได้เหมือนเกมบวกลงพื้นตู้/การ์ด
   สร้างใหม่เฉพาะตอนกรอบพุ่ม/สี/ยีนเปลี่ยน — แพน/ซูมแค่ขยับ transform ตาม #world */
let auraNode=null,auraKey='';
function dropAura(){if(auraNode){auraNode.remove();auraNode=null;auraKey=''}}
const syncAuraView=()=>{if(auraNode)auraNode.style.transform=$('world').style.transform};
const applyViewBeforeAura=applyView;applyView=function(){applyViewBeforeAura();syncAuraView()};
function auraPass(box){const amt=clamp(geneVal('vigor'),0,100)/100;if(!preview.on||!box||!(amt>.01)){dropAura();return}
 const crest=doc.layers.filter(L=>PARTS[L.part]&&effVis(L)&&channelOf(L)?.id==='gill'),mat=crest.length?materialOf(channelOf(crest[0])):null;if(!mat){dropAura();return}
 let L0=1e9,R0=-1e9,T0=1e9,B0=-1e9;for(const L of crest)for(const [qx,qy] of corners(L)){L0=Math.min(L0,qx);R0=Math.max(R0,qx);T0=Math.min(T0,qy);B0=Math.max(B0,qy)}
 const cx=(L0+R0)/2,cy=(T0+B0)/2,gw=R0-L0,gh=B0-T0,rad=Math.max(gw,gh)*.62,X=L0-rad,Y=T0-rad,AW=gw+rad*2,AH=gh+rad*2,res=Math.min(1.5,1600/Math.max(AW,AH)),gcol=mixC(mat.M.m,[255,255,255],.25);
 const key=[X,Y,AW,AH,box.w].map(v=>v.toFixed(1)).join(',')+'|'+gcol.map(Math.round)+'|'+amt;
 if(!auraNode){auraNode=document.createElement('div');auraNode.className='gene-aura';auraNode.style.cssText='position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;mix-blend-mode:plus-lighter';auraNode.append(document.createElement('canvas'))}
 if(key!==auraKey){auraKey=key;const c=auraNode.firstChild;c.width=Math.max(1,Math.round(AW*res));c.height=Math.max(1,Math.round(AH*res));c.style.cssText='position:absolute;display:block;left:'+X+'px;top:'+Y+'px;width:'+AW+'px;height:'+AH+'px';
  const x=c.getContext('2d');x.setTransform(res,0,0,res,-X*res,-Y*res);x.globalCompositeOperation='lighter';
  const au=x.createRadialGradient(cx,cy,rad*.25,cx,cy,rad);au.addColorStop(0,rgbaC(gcol,(.16*amt).toFixed(3)));au.addColorStop(.5,rgbaC(gcol,(.06*amt).toFixed(3)));au.addColorStop(1,rgbaC(gcol,0));x.fillStyle=au;x.fillRect(L0-rad,T0-rad,gw+rad*2,gh+rad*2);
  let seed=23;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff};const N=Math.round(90*amt)+30;
  for(let i=0;i<N;i++){const ang=rnd()*Math.PI*2,rr=Math.sqrt(rnd()),px=cx+Math.cos(ang)*rr*gw*.72,py=cy+Math.sin(ang)*rr*gh*.72,r=box.w*(.004+rnd()*rnd()*.012),a=(.45+rnd()*.55)*amt*(1-rr*rr);
   const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,rgbaC(gcol,a.toFixed(3)));g.addColorStop(.4,rgbaC(gcol,(a*.5).toFixed(3)));g.addColorStop(1,rgbaC(gcol,0));x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fill()}}
 if(!auraNode.isConnected)stageEl().insertBefore(auraNode,$('ovl'));syncAuraView()}

const beforeSpeciesRender=renderLayers;let lastInfo=null;
renderLayers=function(){ensureSpecies();ensureTables();syncNames();const real=doc,disp=shapeOn()?displayDoc(real):null;lastInfo=disp?disp._gene:null;
 if(disp)doc=disp;   // วาดผังที่เห็นแทนชั่วคราว (hit test / ส่งออก / บันทึก ยังใช้ผังจริงเสมอ)
 try{beforeSpeciesRender();const B=bodyLayer(),box=B?bboxOf(B):null;colourPass(box);auraPass(box)}finally{doc=real}
 syncBanner()};
function showBlocked(list){const el=document.getElementById('geneWarn');if(!el)return;const t=list.length?'ย้อมไม่ได้ '+list.length+' ชิ้น: '+[...new Set(list)].slice(0,4).join(', ')+(list.length>4?' …':'')+' — เป็นรูปที่อ้างพาธไฟล์ และหน้านี้เปิดแบบดับเบิลคลิก เบราว์เซอร์จึงไม่ให้อ่านสี · แก้ได้โดยนำเข้ารูปนั้นใหม่ด้วยปุ่ม “เลือกไฟล์…” (ฝังรูปในผัง) หรือเปิดหน้านี้ผ่านเซิร์ฟเวอร์':'';if(el.textContent!==t)el.textContent=t}

/* ---------- export / import ---------- */
const beforeSpeciesExport=exportJSON;
exportJSON=function(){ensureSpecies();beforeSpeciesExport();const o=JSON.parse($('out').value);o.version=5;ensureTables();o.species=doc.species;o.colorTables=doc.colorTables;o.layers.forEach((e,i)=>{const L=doc.layers[i],ch=L&&channelOf(L);e.channel=ch?ch.id:null});$('out').value=JSON.stringify(o,null,1)};
const beforeSpeciesImport=$('bImport').onclick;
$('bImport').onclick=async()=>{let o;try{o=JSON.parse($('out').value)}catch{return beforeSpeciesImport()}
 await beforeSpeciesImport();if(!o||!Array.isArray(o.layers))return;
 if(Array.isArray(o.species)&&o.species.length){const keys=new Set();doc.species=o.species.filter(s=>s&&typeof s.key==='string'&&!keys.has(s.key)&&keys.add(s.key)).map(cleanSpecies);if(!specByKey('shared'))doc.species.push(cleanSpecies(DEFAULT_SPECIES[2]))}
 if(o.colorTables&&typeof o.colorTables==='object'){const t={};for(const [k,v] of Object.entries(o.colorTables).slice(0,24))if(/^[A-Za-z][A-Za-z0-9_]{0,23}$/.test(k))t[k]=cleanTable(v,k);doc.colorTables=Object.assign(DEFAULT_TABLES(),t)}
 const kept=o.layers.filter(e=>PARTS[e.part]);kept.forEach((e,i)=>{const L=doc.layers[i];if(L&&typeof e.channel==='string')L.channel=e.channel});
 afterChange();renderSpeciesCard()};

/* ---------- UI: species card ---------- */
const css=document.createElement('style');css.textContent=`
.sp-grid{display:grid;grid-template-columns:78px 1fr;gap:6px 8px;align-items:center}
.sp-grid label{font-size:12px;color:var(--muted)}
.sp-grid select,.sp-ch select,.sp-ch input[type=text],.gene-row select{width:100%;font:inherit;font-size:12px;padding:4px 6px;border:1px solid var(--line);border-radius:7px;background:var(--panel-2);color:var(--text)}
.sp-sec{font-size:11px;letter-spacing:.08em;color:var(--faint);margin:12px 0 6px;display:flex;justify-content:space-between;align-items:center}
.sp-ch{border:1px solid var(--line-soft);border-radius:9px;padding:7px;margin-bottom:6px;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:5px 8px;background:var(--panel-2)}
.sp-ch .r{display:flex;flex-direction:column;gap:2px;font-size:11px;color:var(--muted);min-width:0}
.sp-ch .top{display:flex;gap:6px;align-items:center;grid-column:1/-1}.sp-ch .top input{flex:1}
.sp-sw{display:flex;gap:4px}.sp-sw input[type=color]{width:34px;height:24px;padding:0;border:1px solid var(--line);border-radius:5px;background:none}
.sp-err{color:var(--danger);font-size:11.5px;min-height:1em;margin:4px 0 0}
.gene-row{display:grid;grid-template-columns:86px 1fr 74px;gap:6px;align-items:center;font-size:12px;color:var(--muted);margin-bottom:4px}
.gene-row output{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--text);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gene-chip{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px;border:1px solid var(--line)}
`;document.head.append(css);
const esc2=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=(map,v)=>Object.entries(map).map(([k,t])=>'<option value="'+k+'"'+(k===v?' selected':'')+'>'+esc2(t)+'</option>').join('');

const card=document.createElement('div');card.className='card';card.id='speciesCard';
card.innerHTML='<h2>สายพันธุ์ <span>ชื่อ · code · หมายเลข · ช่องสี</span></h2><div id="spBody"></div>';
const ownership=[...document.querySelectorAll('.rail>.card')].find(c=>c.querySelector('#layerSpecies'));if(ownership)ownership.after(card);else document.querySelector('.rail').append(card);
let editing='oreo';
function renderSpeciesCard(){ensureSpecies();syncNames();if(!specByKey(editing))editing=doc.species[0].key;const s=specByKey(editing),f=document.activeElement,fid=card.contains(f)?f.dataset.f:null,fi=f?.closest?.('[data-i]')?.dataset.i,fg=f?.closest?.('[data-g]')?.dataset.g;
 const geneChoices=Object.fromEntries(geneDefs().filter(g=>g.grp==='color').map(g=>[g.key,g.th])),grooveChoices=Object.fromEntries(geneDefs().filter(g=>g.grp==='finish'&&g.key!=='vigor').map(g=>[g.key,g.th]).concat(s.genes.map(g=>[g.key,g.th])));
 $('spBody').innerHTML='<div class="btnrow" style="margin-bottom:8px"><select data-f="pick" style="flex:1;min-width:0">'+doc.species.map(x=>'<option value="'+esc2(x.key)+'"'+(x.key===editing?' selected':'')+'>#'+x.no+' '+esc2(displayName(x))+'</option>').join('')+'</select><button class="mini" data-a="new">＋ ใหม่</button><button class="mini" data-a="copy">ทำสำเนา</button><button class="mini dz" data-a="del"'+(s.key==='shared'?' disabled title="ช่องกลางลบไม่ได้"':'')+'>ลบ</button></div>'+
 '<div class="sp-grid"><label>ชื่อไทย</label><input type="text" class="thai" data-f="th" value="'+esc2(s.th)+'"><label>ชื่ออังกฤษ</label><input type="text" class="thai" data-f="en" value="'+esc2(s.en)+'"><label>Code</label><input type="text" data-f="code" value="'+esc2(s.code)+'" spellcheck="false"><label>หมายเลข</label><input type="number" data-f="no" min="0" max="9999" step="1" value="'+s.no+'"><label>รูปร่าง</label><select data-f="shape">'+opts(SHAPES,String(s.shape))+'</select></div><p class="sp-err" id="spErr"></p>'+
 '<div class="sp-sec">ช่องสี — ชิ้นแต่ละชิ้นเลือกช่องสีได้ในการ์ดนี้<button class="mini" data-a="addch">＋ ช่องสี</button></div>'+
 s.channels.map((c,i)=>'<div class="sp-ch" data-i="'+i+'"><div class="top"><input type="text" class="thai" data-f="ch.th" value="'+esc2(c.th)+'" title="ชื่อช่องสี"><code style="font-size:10.5px;color:var(--faint)">'+esc2(c.id)+'</code><button class="mini icon dz" data-a="delch" title="ลบช่องสี">×</button></div>'+
  '<div class="r"><span>สี</span><select data-f="ch.src">'+opts(COLOR_SRC,c.color.src)+'</select></div>'+
  (c.color.src==='gene'?'<div class="r"><span>ยีน</span><select data-f="ch.gene">'+opts(geneChoices,c.color.gene)+'</select></div><div class="r"><span>ตาราง</span><select data-f="ch.table">'+opts(tableChoices(),c.color.table)+'</select></div>':'')+
  (c.color.src==='fixed'?'<div class="r"><span>เข้ม/กลาง/อ่อน</span><div class="sp-sw"><input type="color" data-f="ch.d" value="'+c.color.d+'"><input type="color" data-f="ch.m" value="'+c.color.m+'"><input type="color" data-f="ch.l" value="'+c.color.l+'"></div></div>':'')+
  (c.color.src!=='none'?'<div class="r"><span>ร่อง</span><select data-f="ch.gsrc">'+opts(GROOVE_SRC,c.groove.src)+'</select></div>'+(c.groove.src==='gene'?'<div class="r"><span>ยีนร่อง</span><select data-f="ch.ggene">'+opts(grooveChoices,c.groove.gene)+'</select></div>':'')+(c.groove.src==='fixed'?'<div class="r"><span>ความลึก</span><input type="range" data-f="ch.gval" min="0" max="100" step="5" value="'+c.groove.value+'"></div>':''):'')+'</div>').join('')+
 '<div class="sp-sec">ยีนเฉพาะพันธุ์ (เช่น สีลาย)<button class="mini" data-a="addgene">＋ ยีน</button></div>'+
 (s.genes.length?s.genes.map((g,i)=>'<div class="sp-ch" data-g="'+i+'"><div class="top"><input type="text" class="thai" data-f="g.th" value="'+esc2(g.th)+'" title="ชื่อยีน"><code style="font-size:10.5px;color:var(--faint)">'+esc2(g.key)+'</code><button class="mini icon dz" data-a="delgene" title="ลบยีน">×</button></div></div>').join(''):'<p class="note" style="margin:0">ยังไม่มี — เพิ่มเมื่อพันธุ์นี้มีลายที่สีเปลี่ยนตามยีนของตัวเอง แล้วตั้งช่องสีลายให้ “ตามยีน” → ยีนนี้</p>')+
 '<div class="sp-sec">ชิ้นที่เลือก</div><div class="sp-grid"><label>ช่องสี</label><select data-f="layerch" id="layerChannel"></select></div><p class="note" id="layerChHint"></p>';
 syncLayerChannel();
 if(fid){const scope=fi!=null?$('spBody').querySelector('[data-i="'+fi+'"]'):fg!=null?$('spBody').querySelector('[data-g="'+fg+'"]'):$('spBody');scope?.querySelector('[data-f="'+fid+'"]')?.focus()}}
function syncLayerChannel(){const sel2=$('layerChannel');if(!sel2)return;const L=one(),s=L&&specByKey(speciesOfLayer(L));
 if(!L||!s){sel2.innerHTML='<option>— เลือกชิ้นเดียว —</option>';sel2.disabled=true;$('layerChHint').textContent='';return}
 const cur=channelOf(L);sel2.disabled=effLock(L);sel2.innerHTML='<option value="">อัตโนมัติ ('+esc2(s.channels.find(c=>c.id===guessChannel(L))?.th||'ไม่ย้อม')+')</option>'+s.channels.map(c=>'<option value="'+esc2(c.id)+'">'+esc2(c.th)+'</option>').join('');
 sel2.value=L.channel&&s.channels.some(c=>c.id===L.channel)?L.channel:'';$('layerChHint').textContent=L.name+' ใช้ช่อง “'+(cur?cur.th:'ไม่ย้อม')+'” ของ '+s.th+(s.key!==editing?' · (การ์ดนี้กำลังแก้ '+specByKey(editing).th+')':'')}
const err=m=>{const e=$('spErr');if(e)e.textContent=m||''};
const uid=(base,taken)=>{let i=1,k=base;while(taken.has(k))k=base+(++i);return k};
function commit(fn){push();fn();afterChange();renderSpeciesCard()}
card.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b||b.disabled)return;const s=specByKey(editing),a=b.dataset.a;
 if(a==='new'||a==='copy'){const taken=new Set(doc.species.map(x=>x.key)),key=uid('sp'+(doc.species.length),taken),codes=new Set(doc.species.map(x=>x.code.toUpperCase())),no=Math.max(0,...doc.species.map(x=>x.no))+1;
  const base=a==='copy'?JSON.parse(JSON.stringify(s)):{th:'พันธุ์ใหม่',en:'',shape:1};commit(()=>{doc.species.push(cleanSpecies({...base,key,no,code:uid(a==='copy'?s.code+'_2':'SP'+no,codes),th:a==='copy'?s.th+' (สำเนา)':base.th}));editing=key});toast(a==='copy'?'ทำสำเนาพันธุ์แล้ว':'เพิ่มพันธุ์ใหม่แล้ว — ตั้งชื่อและ code ได้เลย')}
 else if(a==='del'){if(s.key==='shared')return;const used=doc.layers.filter(L=>speciesOfLayer(L)===s.key).length;commit(()=>{doc.species=doc.species.filter(x=>x!==s);for(const L of doc.layers)if(L.species===s.key)L.species='shared';for(const p of Object.values(doc.parts))if(p.species===s.key)p.species='shared';editing='shared'});toast('ลบ '+s.th+' แล้ว'+(used?' · '+used+' ชิ้นย้ายไป “ใช้ร่วมกัน”':'')+' — กด Ctrl+Z เพื่อคืน')}
 else if(a==='addch'){const ids=new Set(s.channels.map(c=>c.id));commit(()=>s.channels.push(cleanChannel({id:uid('pattern',ids),th:'ลายเฉพาะ',color:{src:'fixed'},groove:{src:'none'}})))}
 else if(a==='delch'){const i=+b.closest('[data-i]').dataset.i,c=s.channels[i];commit(()=>{s.channels.splice(i,1);for(const L of doc.layers)if(L.channel===c.id&&speciesOfLayer(L)===s.key)delete L.channel})}
 else if(a==='addgene'){const taken=new Set(geneDefs().map(g=>g.key));commit(()=>s.genes.push({key:uid(s.code.toLowerCase().replace(/[^a-z0-9]/g,'')+'PatC',taken).replace(/^[^a-z]+/,'p'),th:'สีลาย '+s.th,min:0,max:400,step:50,def:200}));renderGenes()}
 else if(a==='delgene'){const i=+b.closest('[data-g]').dataset.g,g=s.genes[i];commit(()=>{s.genes.splice(i,1);for(const c of s.channels){if(c.color.gene===g.key)c.color.gene='mainC';if(c.groove.gene===g.key)c.groove.gene='bodyDepth'}});renderGenes()}});
card.addEventListener('change',e=>{const n=e.target,f=n.dataset.f;if(!f)return;const s=specByKey(editing);err('');
 if(f==='pick'){editing=n.value;renderSpeciesCard();return}
 if(f==='layerch'){const L=one();if(!L||effLock(L))return;commit(()=>{if(n.value)L.channel=n.value;else delete L.channel});return}
 if(f==='code'){const v=n.value.trim();if(!CODE_RE.test(v)){err('Code ต้องขึ้นต้นด้วยตัวอักษรอังกฤษ ใช้ A–Z 0–9 _ - ได้ ยาวไม่เกิน 24 ตัว');n.value=s.code;return}
  const dup=doc.species.find(x=>x!==s&&x.code.toUpperCase()===v.toUpperCase());if(dup){err('Code '+v+' ซ้ำกับ '+dup.th+' — เปลี่ยนเป็นค่าอื่น');n.value=s.code;return}commit(()=>s.code=v);return}
 if(f==='no'){const v=+n.value;if(!Number.isInteger(v)||v<0||v>9999){err('หมายเลขต้องเป็นจำนวนเต็ม 0–9999');n.value=s.no;return}const dup=doc.species.find(x=>x!==s&&x.no===v);if(dup){err('หมายเลข '+v+' ซ้ำกับ '+dup.th+' — ใช้เลขอื่น');n.value=s.no;return}commit(()=>s.no=v);return}
 if(f==='th'||f==='en'){const v=n.value.trim().slice(0,60);if(f==='th'&&!v){err('ชื่อไทยว่างไม่ได้');n.value=s.th;return}commit(()=>s[f]=v);return}
 if(f==='shape'){commit(()=>s.shape=+n.value);return}
 if(f.startsWith('g.')){const g=s.genes[+n.closest('[data-g]').dataset.g];commit(()=>g.th=n.value.trim().slice(0,40)||g.key);renderGenes();return}
 const c=s.channels[+n.closest('[data-i]')?.dataset.i];if(!c)return;
 commit(()=>{if(f==='ch.th')c.th=n.value.trim().slice(0,40)||c.id;else if(f==='ch.src')c.color.src=n.value;else if(f==='ch.gene')c.color.gene=n.value;else if(f==='ch.table')c.color.table=n.value;
  else if(/^ch\.[dml]$/.test(f))c.color[f.slice(3)]=n.value;else if(f==='ch.gsrc')c.groove.src=n.value;else if(f==='ch.ggene')c.groove.gene=n.value;else if(f==='ch.gval')c.groove.value=+n.value})});

/* ---------- UI: gene preview card — every gene the game reads, grouped; values shown as the game derives them ---------- */
const css3=document.createElement('style');css3.textContent=`
.gene-toggles{display:flex;flex-wrap:wrap;gap:4px 14px;margin-bottom:6px}
.gene-sec{font-size:10.5px;letter-spacing:.08em;color:var(--faint);margin:10px 0 4px}
#geneRows .gene-row{grid-template-columns:84px minmax(60px,1fr) 106px}
#geneRows .gene-row>output{overflow:visible}
#geneRows .gene-row>span{line-height:1.25}
#geneRows .gene-row.idle>span,#geneRows .gene-row.idle>output{opacity:.5}
.gene-banner{position:absolute;left:10px;bottom:10px;z-index:4;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;max-width:calc(100% - 20px);padding:6px 7px 6px 11px;border:1px solid var(--accent);border-radius:9px;background:var(--panel);box-shadow:var(--shadow);font-size:12px;color:var(--muted);cursor:default;user-select:none}
.gene-banner b{color:var(--text);font-weight:600}
`;document.head.append(css3);
const gcard=document.createElement('div');gcard.className='card';gcard.id='genePreview';
gcard.innerHTML='<h2>พรีวิวยีน <span>ทุกยีนที่เกมใช้ · สูตรเดียวกับเกม</span></h2>'+
 '<div class="gene-toggles"><label class="chk"><input type="checkbox" id="genePreviewOn"> ย้อมสี + ประกายตามยีน</label><label class="chk"><input type="checkbox" id="geneShapeOn"> รูปร่าง + จำนวนตามยีน</label></div>'+
 '<div class="btnrow" style="margin-bottom:8px"><button class="mini" id="geneReset">ค่ากลาง</button><button class="mini" id="geneRandom">สุ่มยีน</button></div>'+
 '<label class="chk" style="margin:-2px 0 8px"><input type="checkbox" id="geneTone"> รูปที่นำเข้าเอง: ลงแสงแบบรูปในเกมก่อนย้อม (หงอน = แบบหงอนแบบ 3 · ลำตัว = โทนลำตัวเกม)</label>'+
 '<div id="geneRows"></div><p class="note" id="geneInfo"></p><p class="note" id="geneWarn" style="color:var(--danger)"></p>'+
 '<p class="note">ภาพเท่ากับทาก 2D ตัวใหญ่ในเกม (สมุดบันทึก/การ์ด): ตาราง 9 สี + ร่อง · หนวด 2 สี · แสง เงาก้าน และออร่ารอบพุ่มหงอน · เม็ดประกายบนตัว · ลายอบขนาดเดียวกับเกม — ในตู้ทากตัวเล็กเกมไม่วาดออร่า · โหมด 3D ในเกมใช้สูตรอื่น สีจะต่าง · ค่าพรีวิวไม่ถูกบันทึกลงผัง</p>';
card.after(gcard);
const GROUPS=[['color','สี'],['finish','ร่อง · ประกาย'],['shape','รูปร่าง'],['count','จำนวน']];
const layoutCount=id=>doc.layers.filter(L=>PARTS[L.part]&&effVis(L)&&channelOf(L)?.id===id).length;
const ownSpots=()=>newSpecies();
const linkedTableOf=k=>{if(k==='accC')return'gill';for(const s of doc.species||[])for(const c of s.channels)if(c.color.src==='gene'&&c.color.gene===k&&doc.colorTables?.[c.color.table])return c.color.table;return'body'};
function geneOut(g,v){const x=n=>'×'+n.toFixed(2);
 if(g.grp==='color'){const t=linkedTableOf(g.key),a=anchorAt(v,tableOf(t).anchors);return'<span class="gene-chip" style="background:rgb('+a.M.map(Math.round)+')"></span>'+v+' '+esc2(a.n)}
 if(g.key==='len')return x(.72+v/100*.56);if(g.key==='girth')return x(.72+v/100*.56);
 if(g.key==='gillLen'||g.key==='tentLen')return x(.62+v/100*.76);
 if(g.key==='gillN')return LADDER[Math.min(5,Math.floor(Math.abs(v-50)/10))]+' ก้าน';
 if(g.key==='spotN'){const N=layoutCount('spot');if(N&&ownSpots()){const p=fadePlan(v,N);return'ค่อย ๆ หาย '+(p.full+p.f).toFixed(1)+'/'+N}const p=spotPlan(v,N);return N?SPOT_TH[p.shape]+' '+p.n+'/'+N:SPOT_TH[p.shape]}
 return String(v)}
let geneTimer=0;
function renderGenes(){$('genePreviewOn').checked=!!preview.on;$('geneShapeOn').checked=shapeOn();const defs=geneDefs();
 $('geneRows').innerHTML=GROUPS.map(([grp,th])=>{const list=defs.filter(g=>g.grp===grp);return list.length?'<div class="gene-sec">'+th+'</div>'+list.map(g=>'<div class="gene-row" data-grp="'+grp+'"><span title="'+esc2(g.hint||g.key)+'">'+esc2(g.th)+'</span><input type="range" data-gene="'+esc2(g.key)+'" min="'+g.min+'" max="'+g.max+'" step="'+g.step+'" value="'+geneVal(g.key)+'" title="'+esc2(g.key)+'"><output>'+geneOut(g,geneVal(g.key))+'</output></div>').join(''):''}).join('');
 geneStatus()}
/* จางแถวที่ยังไม่มีผลบนเวที · สรุปว่ายีนจำนวนใช้ผังของใคร (อัปเดตเฉพาะข้อความที่เปลี่ยน) */
function geneStatus(){for(const row of $('geneRows').querySelectorAll('.gene-row')){const shape=row.dataset.grp==='shape'||row.dataset.grp==='count',idle=shape?!shapeOn():!preview.on;row.classList.toggle('idle',idle)}
 const sp=$('geneRows').querySelector('input[data-gene="spotN"]');if(sp){const o=sp.nextElementSibling,t=geneOut(geneDefs().find(g=>g.key==='spotN'),+sp.value);if(o.innerHTML!==t)o.innerHTML=t}
 const k=layoutCount('gill'),s=layoutCount('spot'),n=morphOf().nGill,B=bodyLayer();let t='';
 if(!B)t='ยังไม่มีลำตัวอ้างอิง — ยีนรูปร่างต้องมีชิ้นที่ใช้ช่องสี “ลำตัว”';
 else{t='ผังนี้มีหงอน '+k+' ชิ้น · ลาย '+s+' ดวง';if(!k)t+=' — ไม่มีชิ้นช่องสี “หงอน” ยีนจำนวนหงอนจึงไม่มีผล';else if(k===9&&lastInfo?.crest?.own)t+=' — หงอนลดตามลำดับทากตัวเดิม ใช้ตำแหน่งที่จัดไว้';else if(n!==k)t+=' — หงอน '+n+' ก้านใช้ตำแหน่งหงอนของเกม (ผังนี้จัดไว้ '+k+' ก้าน)';if(!s)t+=' · ไม่มีชิ้นช่องสี “ลาย”'}
 const el=$('geneInfo');if(el.textContent!==t)el.textContent=t}
gcard.addEventListener('input',e=>{const k=e.target.dataset.gene;if(!k)return;const g=geneDefs().find(x=>x.key===k);if(!g)return;const v=+e.target.value;
 if(g.grp==='shape'||g.grp==='count')ensureShape();else ensurePreview();
 preview.genes[k]=v;e.target.nextElementSibling.innerHTML=geneOut(g,v);
 clearTimeout(geneTimer);geneTimer=setTimeout(()=>{saveGenes();renderLayers();drawOverlay();geneStatus()},60)});
$('genePreviewOn').onchange=e=>{preview.on=e.target.checked;saveGenes();renderLayers();drawOverlay();geneStatus()};
$('geneShapeOn').onchange=e=>setShape(e.target.checked);
$('geneTone').checked=preview.matchTone!==false;$('geneTone').onchange=e=>{preview.matchTone=e.target.checked;saveGenes();shown.clear();renderLayers()};
function ensurePreview(){if(preview.on)return false;preview.on=true;$('genePreviewOn').checked=true;saveGenes();renderLayers();geneStatus();toast('เปิด “ย้อมสี + ประกายตามยีน” ให้แล้ว — ปิดได้ในการ์ดพรีวิวยีน');return true}
function setShape(on){on=!!on;if(on===shapeOn()){$('geneShapeOn').checked=on;return}preview.shape=on;$('geneShapeOn').checked=on;saveGenes();renderLayers();drawOverlay();geneStatus()}
function ensureShape(){if(shapeOn())return false;setShape(true);toast('เปิด “รูปร่าง + จำนวนตามยีน” ให้แล้ว — ระหว่างนี้คลิกเลือกชิ้นได้แต่ลากไม่ได้ · ปิดที่ปุ่มบนเวที');return true}
$('geneReset').onclick=()=>{preview.genes={};saveGenes();renderGenes();renderLayers();drawOverlay()};
$('geneRandom').onclick=()=>{for(const g of geneDefs())preview.genes[g.key]=g.grp==='color'?Math.round(Math.random()*80)*5:Math.round(g.min+Math.random()*(g.max-g.min));
 preview.on=true;preview.shape=true;saveGenes();renderGenes();renderLayers();drawOverlay();toast('สุ่มยีนแล้ว — เปิดทั้งสีและรูปร่างตามยีน')};

/* ---------- เวทีระหว่างดูรูปร่างตามยีน ----------
   ภาพบนเวทีเป็นผังที่แปลงแล้ว ส่วนแฮนเดิล/การลากอิงผังจริง → ถ้าปล่อยให้ลาก ชิ้นจะไม่ตามเมาส์
   จึงให้แค่คลิกเลือก (ทดสอบกับภาพที่เห็น) · แพน/ซูม/ลูกศร/แผงคุณสมบัติใช้ได้ตามปกติ · แถบบนเวทีบอกค่าและปุ่มกลับไปจัดผัง */
const banner=document.createElement('div');banner.className='gene-banner';banner.hidden=true;stageEl().append(banner);
banner.addEventListener('pointerdown',e=>e.stopPropagation());
banner.addEventListener('click',e=>{if(e.target.closest('[data-a="layout"]'))setShape(false)});
function syncBanner(){if(!shapeOn()){if(!banner.hidden)banner.hidden=true;return}const i=lastInfo,f=n=>'×'+n.toFixed(2);let t;
 if(!i)t='<b>รูปร่างตามยีน</b><span>ยังไม่มีลำตัวอ้างอิง</span>';
 else{const m=i.morph;t='<b>รูปร่างตามยีน</b><span>ยาว '+f(m.stretch)+' · ขนาด '+f(m.size)+' · หงอนสูง '+f(m.gScale)+' · หนวด '+f(m.tScale)+(i.crest?' · หงอน '+i.crest.n+' ก้าน'+(i.crest.game?' (ผังเกม)':i.crest.own?' (ลำดับทากเดิม)':''):'')+(i.spots?' · ลาย'+(i.spots.shape==='fade'?' '+(i.spots.full+i.spots.f).toFixed(1):SPOT_TH[i.spots.shape]+' '+i.spots.n)+'/'+i.spots.N:'')+'</span>'}
 t+='<button class="mini" data-a="layout" title="ปิด “รูปร่าง + จำนวนตามยีน” แล้วกลับไปลาก/จัดชิ้นได้">กลับไปจัดผัง</button>';
 if(banner.innerHTML!==t)banner.innerHTML=t;if(banner.hidden)banner.hidden=false}
let lockToast=0;
window.addEventListener('pointerdown',e=>{if(!shapeOn())return;const st=stageEl();if(!st.contains(e.target)||e.target.closest?.('.gene-banner'))return;if(panMode||spaceDown||e.button===1)return;
 e.stopImmediatePropagation();e.preventDefault();if(e.button!==0)return;
 const disp=displayDoc(doc);if(disp){const r=st.getBoundingClientRect(),[wx,wy]=Wr(e.clientX-r.left,e.clientY-r.top);let got=null;
  for(let i=disp.layers.length-1;i>=0;i--){const L=disp.layers[i];if(PARTS[L.part]&&effVis(L)&&!effLock(L)&&hit(L,wx,wy)){got=L;break}}
  if(got&&!got.ghost&&byId(got.id))setSel(e.shiftKey?sel.concat(got.id):[got.id]);else if(!got&&!e.shiftKey)setSel([]);syncPanel()}
 const now=Date.now();if(now-lockToast>5000){lockToast=now;toast('กำลังดูรูปร่างตามยีน — คลิกเลือกชิ้นได้ แต่ลาก/ย่อ/หมุนไม่ได้ · กด “กลับไปจัดผัง” บนเวทีเพื่อจัดชิ้น')}},true);
window.addEventListener('keydown',e=>{if(!shapeOn()||e.ctrlKey||e.metaKey||e.altKey||isTyping())return;if(e.code==='KeyR'||e.code==='KeyS'){e.preventDefault();e.stopImmediatePropagation();toast('ปิด “รูปร่าง + จำนวนตามยีน” ก่อนหมุน/ย่อขยายด้วยคีย์ลัด')}},true);
/* ไกด์กล่องลำตัวและกรอบชิ้นที่เลือกวาดตามภาพที่เห็น (ไม่มีแฮนเดิล เพราะลากไม่ได้ระหว่างนี้) */
const overlayBeforeGenes=drawOverlay;
drawOverlay=function(){const disp=shapeOn()?displayDoc(doc):null;if(!disp)return overlayBeforeGenes();const real=doc,realSel=sel;doc=disp;sel=[];
 try{overlayBeforeGenes()}finally{doc=real;sel=realSel}
 let s='';for(const L of disp.layers)if(realSel.includes(L.id)&&PARTS[L.part]&&effVis(L)){const q=corners(L).map(p=>S(p[0],p[1]));s+='<polygon points="'+q.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="6 4"/>'}
 if(s)$('ovl').insertAdjacentHTML('beforeend',s)};

/* undo/redo swap the whole doc; the async parts refresh comes later, so sync species names right away
   (otherwise pieces briefly read as "shared") */
for(const nm of ['undo','redo']){const base=nm==='undo'?undo:redo,w=function(){base.apply(this,arguments);ensureSpecies();ensureTables();syncNames()};if(nm==='undo'){undo=w;$('bUndo').onclick=()=>undo()}else{redo=w;$('bRedo').onclick=()=>redo()}}
/* keep cards in step with undo/redo, loads and selection */
let cardSig='';
const beforeSpeciesPanel=syncPanel;
// the saved layout can arrive after start-up, so both stage renders and panel syncs check it (small JSON compare)
function refreshCards(){ensureSpecies();ensureTables();const sig=JSON.stringify([doc.species,doc.colorTables]);if(sig===cardSig)return false;cardSig=sig;renderTables();if(!card.contains(document.activeElement)||document.activeElement.tagName==='BUTTON')renderSpeciesCard();renderGenes();return true}
syncPanel=function(){beforeSpeciesPanel();if(!refreshCards())syncLayerChannel()};
let statusBody;   // imported body art can finish loading after the first status line was drawn — refresh it when the reference changes
const beforeCardsRender=renderLayers;renderLayers=function(){beforeCardsRender();refreshCards();geneStatus();const b=bodyLayer()?.id??null;if(b!==statusBody){statusBody=b;status()}};
/* ---------- UI: colour table editor — long strip 0–400, scrub to see in-between colours, pick each anchor's colours ---------- */
const hexOf=c=>'#'+c.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
const css2=document.createElement('style');css2.textContent=`
.ct-strip{position:relative;margin:10px 0 2px;cursor:crosshair;touch-action:none}
.ct-strip canvas{display:block;width:100%;height:64px;border-radius:8px;border:1px solid var(--line)}
.ct-cursor{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:var(--text);border-radius:2px;pointer-events:none;box-shadow:0 0 0 1px var(--panel)}
.ct-marks{position:relative;height:30px;margin-top:4px}
.ct-mark{position:absolute;top:0;width:22px;height:22px;margin-left:-11px;padding:0;border-radius:50%;border:2px solid var(--panel);box-shadow:0 0 0 1px var(--line);cursor:pointer}
.ct-mark.sel{box-shadow:0 0 0 2px var(--accent)}
.ct-mark:hover{transform:scale(1.12)}
.ct-read{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);flex-wrap:wrap}
.ct-read b{font-family:"IBM Plex Mono",monospace;color:var(--text);font-weight:500}
.ct-sw{display:inline-flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}.ct-sw i{width:22px;height:18px;display:block}
.ct-anchor{margin-top:10px;border:1px solid var(--line-soft);border-radius:9px;padding:8px;background:var(--panel-2);display:grid;gap:7px}
.ct-tones{display:grid;grid-template-columns:repeat(auto-fit,minmax(64px,1fr));gap:6px}
.ct-tones label{display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--muted)}
.ct-tones input[type=color]{width:100%;height:32px;padding:0;border:1px solid var(--line);border-radius:7px;background:none;cursor:pointer}
`;document.head.append(css2);
const tcard=document.createElement('div');tcard.className='card';tcard.id='colorTables';
tcard.innerHTML='<h2>ตารางสีหลัก <span>ค่า 0–400 · จุดหลักทุก 50</span></h2>'+
 '<div class="btnrow"><select id="ctPick" style="flex:1;min-width:0;font:inherit;font-size:12px;padding:4px 6px;border:1px solid var(--line);border-radius:7px;background:var(--panel-2);color:var(--text)"></select><button class="mini" id="ctNew" title="สร้างตารางใหม่จากตารางนี้ เช่น สีลายเฉพาะพันธุ์">＋ ตารางใหม่</button><button class="mini dz" id="ctDel">ลบ</button></div>'+
 '<div class="sp-grid" style="margin-top:8px"><label>ชื่อตาราง</label><input type="text" class="thai" id="ctName"></div>'+
 '<div class="ct-strip" id="ctStrip"><canvas id="ctCanvas" width="800" height="64"></canvas><div class="ct-cursor" id="ctCursor"></div></div>'+
 '<div class="ct-marks" id="ctMarks"></div>'+
 '<input type="range" id="ctScrub" min="0" max="400" step="1" value="200" aria-label="เลื่อนดูสีระหว่างทาง">'+
 '<div class="ct-read" id="ctRead"></div>'+
 '<div class="ct-anchor" id="ctAnchor"></div>'+
 '<p class="note">แถบบน = โทนอ่อน · กลาง = สีหลัก · ล่าง = โทนเข้ม (ร่อง/เงา) · ลากบนแถบหรือเลื่อนขีดเพื่อดูสีระหว่างทาง คลิกวงกลมเพื่อเลือกสีของจุดหลักนั้น · ถ้าเปิดพรีวิว เวทีจะย้อมตามค่าที่เลื่อน</p>';
card.after(tcard);
let tableId='body',anchorIdx=4,scrubV=200,tablePush=true,stripRaf=0;
const linkedGene=id=>{if(id==='body')return'mainC';if(id==='gill')return'accC';for(const s of doc.species||[])for(const c of s.channels)if(c.color.src==='gene'&&c.color.table===id)return c.color.gene;return tableOf(id).kind==='gill'?'accC':'mainC'};
function drawStrip(){stripRaf=0;const T=tableOf(tableId),cv2=$('ctCanvas'),x=cv2.getContext('2d'),W2=cv2.width,H2=cv2.height,gill=T.kind==='gill';
 for(let px=0;px<W2;px++){const a=anchorAt(px/(W2-1)*400,T.anchors);x.fillStyle=hexOf(a.L);x.fillRect(px,0,1,H2*.25);x.fillStyle=hexOf(a.M);x.fillRect(px,H2*.25,1,H2*.5);x.fillStyle=hexOf(a.D);x.fillRect(px,H2*.75,1,H2*.25);if(gill){x.fillStyle=hexOf(a.P);x.fillRect(px,H2*.22,1,H2*.06)}}
 x.fillStyle='rgba(0,0,0,.25)';for(const a of T.anchors){const px=Math.round(a.g/400*(W2-1));x.fillRect(px,0,1,H2*.12);x.fillRect(px,H2*.88,1,H2*.12)}
 $('ctMarks').innerHTML=T.anchors.map((a,i)=>'<button class="ct-mark'+(i===anchorIdx?' sel':'')+'" data-k="'+i+'" style="left:'+(a.g/4)+'%;background:'+hexOf(a.M)+'" title="'+a.g+' · '+esc2(a.n)+'"></button>').join('')}
const queueStrip=()=>{if(!stripRaf)stripRaf=requestAnimationFrame(drawStrip)};
function showScrub(){const T=tableOf(tableId),a=anchorAt(scrubV,T.anchors),near=T.anchors.reduce((b,x)=>Math.abs(x.g-scrubV)<Math.abs(b.g-scrubV)?x:b);
 $('ctScrub').value=scrubV;$('ctCursor').style.left=(scrubV/4)+'%';
 $('ctRead').innerHTML='ค่า <b>'+scrubV+'</b> <span class="ct-sw"><i style="background:'+hexOf(a.D)+'" title="เข้ม"></i><i style="background:'+hexOf(a.M)+'" title="หลัก"></i><i style="background:'+hexOf(a.L)+'" title="อ่อน"></i>'+(T.kind==='gill'?'<i style="background:'+hexOf(a.P)+'" title="ปลายเรือง"></i>':'')+'</span> <b>'+hexOf(a.M)+'</b> · '+(near.g===scrubV?'จุดหลัก “'+esc2(near.n)+'”':'ระหว่าง จุดใกล้สุด “'+esc2(near.n)+'” ('+near.g+')')}
function renderAnchor(){const T=tableOf(tableId),a=T.anchors[anchorIdx],base=DEFAULT_TABLES()[T.kind].anchors[anchorIdx];
 $('ctAnchor').innerHTML='<div class="sp-grid"><label>จุดหลัก '+a.g+'</label><input type="text" class="thai" id="ctAName" value="'+esc2(a.n)+'"></div>'+
 '<div class="ct-tones">'+[['M','สีหลัก'],['L','โทนอ่อน'],['D','โทนเข้ม']].concat(T.kind==='gill'?[['P','ปลายเรือง']]:[]).map(([k,t])=>'<label>'+t+'<input type="color" data-tone="'+k+'" value="'+hexOf(a[k])+'"></label>').join('')+'</div>'+
 '<div class="btnrow"><button class="mini" id="ctAuto" title="คิดโทนอ่อน/เข้มจากสีหลักให้">ไล่โทนจากสีหลัก</button><button class="mini" id="ctReset"'+(JSON.stringify([a.D,a.M,a.L,a.P])===JSON.stringify([base.D,base.M,base.L,base.P])&&a.n===base.n?' disabled':'')+'>คืนค่าตั้งต้น</button></div>'}
function renderTables(){ensureTables();if(!doc.colorTables[tableId])tableId='body';const T=tableOf(tableId);anchorIdx=clamp(anchorIdx,0,T.anchors.length-1);
 $('ctPick').innerHTML=Object.entries(doc.colorTables).map(([k,t])=>'<option value="'+esc2(k)+'"'+(k===tableId?' selected':'')+'>'+esc2(t.th)+(k==='body'||k==='gill'?'':' (เพิ่มเอง)')+'</option>').join('');
 $('ctDel').disabled=tableId==='body'||tableId==='gill';if(document.activeElement!==$('ctName'))$('ctName').value=T.th;
 drawStrip();showScrub();if(!$('ctAnchor').contains(document.activeElement))renderAnchor()}
let previewTimer=0;
const previewScrub=()=>{ensurePreview();preview.genes[linkedGene(tableId)]=scrubV;clearTimeout(previewTimer);previewTimer=setTimeout(()=>{saveGenes();renderLayers();renderGenes()},60)};
const liveChange=()=>{ensurePreview();clearTimeout(previewTimer);previewTimer=setTimeout(()=>{renderLayers();renderGenes();exportJSON();save();upButtons()},90)};
$('ctPick').onchange=e=>{tableId=e.target.value;renderTables()};
$('ctScrub').oninput=e=>{scrubV=+e.target.value;showScrub();previewScrub()};
const stripAt=e=>{const r=$('ctStrip').getBoundingClientRect();scrubV=Math.round(clamp((e.clientX-r.left)/r.width,0,1)*400);showScrub();previewScrub()};
$('ctStrip').addEventListener('pointerdown',e=>{$('ctStrip').setPointerCapture(e.pointerId);stripAt(e);const mv=ev=>stripAt(ev),up=()=>{$('ctStrip').removeEventListener('pointermove',mv);$('ctStrip').removeEventListener('pointerup',up);$('ctStrip').removeEventListener('pointercancel',up)};$('ctStrip').addEventListener('pointermove',mv);$('ctStrip').addEventListener('pointerup',up);$('ctStrip').addEventListener('pointercancel',up)});
$('ctMarks').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b)return;anchorIdx=+b.dataset.k;scrubV=tableOf(tableId).anchors[anchorIdx].g;drawStrip();showScrub();renderAnchor();previewScrub()});
$('ctName').onchange=e=>{const v=e.target.value.trim().slice(0,40);if(!v){e.target.value=tableOf(tableId).th;return}push();tableOf(tableId).th=v;afterChange();renderTables();renderSpeciesCard()};
$('ctNew').onclick=()=>{const src=tableOf(tableId),taken=new Set(Object.keys(doc.colorTables));let k='table2',i=2;while(taken.has(k))k='table'+(++i);push();doc.colorTables[k]=cleanTable({...JSON.parse(JSON.stringify(src)),th:src.th+' (สำเนา)'});tableId=k;afterChange();renderTables();renderSpeciesCard();toast('สร้างตารางใหม่แล้ว — ตั้งชื่อ แล้วเลือกใช้ในช่องสีของพันธุ์ได้')};
$('ctDel').onclick=()=>{if(tableId==='body'||tableId==='gill')return;const k=tableId,th=tableOf(k).th;let used=0;push();for(const s of doc.species)for(const c of s.channels)if(c.color.table===k){c.color.table=tableOf(k).kind;used++}delete doc.colorTables[k];tableId='body';afterChange();renderTables();renderSpeciesCard();toast('ลบ '+th+' แล้ว'+(used?' · '+used+' ช่องสีกลับไปใช้ตารางตั้งต้น':'')+' — Ctrl+Z เพื่อคืน')};
$('ctAnchor').addEventListener('focusin',()=>{tablePush=true});
$('ctAnchor').addEventListener('input',e=>{const k=e.target.dataset.tone;if(!k)return;if(tablePush){push();tablePush=false}tableOf(tableId).anchors[anchorIdx][k]=hexToRgb(e.target.value);queueStrip();showScrub();liveChange()});
$('ctAnchor').addEventListener('change',e=>{if(e.target.id==='ctAName'){const v=e.target.value.trim().slice(0,24);if(!v){e.target.value=tableOf(tableId).anchors[anchorIdx].n;return}push();tableOf(tableId).anchors[anchorIdx].n=v;afterChange();drawStrip();showScrub()}else if(e.target.dataset.tone){tablePush=true;afterChange();renderAnchor()}});
$('ctAnchor').addEventListener('click',e=>{const T=tableOf(tableId),a=T.anchors[anchorIdx];
 if(e.target.id==='ctAuto'){const[h,s2,l]=toHSL(a.M);push();a.L=fromHSL(h,s2*.55,l+(100-l)*.82).map(Math.round);a.D=fromHSL(h,Math.min(100,s2*1.1),l*.42).map(Math.round);if(T.kind==='gill')a.P=fromHSL(h,s2*.9,l+(100-l)*.5).map(Math.round);afterChange();drawStrip();showScrub();renderAnchor()}
 else if(e.target.id==='ctReset'){const b=DEFAULT_TABLES()[T.kind].anchors[anchorIdx];push();T.anchors[anchorIdx]=JSON.parse(JSON.stringify(b));afterChange();drawStrip();showScrub();renderAnchor()}});
function toHSL([r,g,b]){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s2=0;if(mx!==mn){const d=mx-mn;s2=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h/=6}return[h*360,s2*100,l*100]}
function fromHSL(h,s2,l){h=((h%360)+360)%360;s2=clamp(s2,0,100)/100;l=clamp(l,0,100)/100;const c=(1-Math.abs(2*l-1))*s2,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;const[r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return[(r+m)*255,(g+m)*255,(b+m)*255]}

/* read-only handle for tools/custom-editor/check-gene-preview.mjs (and the console): compares the rules with js/slug-engine.js */
window.GenePreview={defs:()=>geneDefs().map(g=>({key:g.key,grp:g.grp,th:g.th,min:g.min,max:g.max,def:g.def,value:geneVal(g.key)})),
 set(o){for(const [k,v] of Object.entries(o||{}))preview.genes[k]=+v;saveGenes();renderGenes();renderLayers();drawOverlay()},
 colour(on){preview.on=!!on;saveGenes();renderGenes();renderLayers();drawOverlay()},shape:setShape,
 display:()=>{const d=shapeOn()?displayDoc(doc):null;return d?{info:d._gene,layers:d.layers.map(L=>({id:L.id,part:L.part,role:L.role,x:L.x,y:L.y,s:L.s,ex:EX(L),ey:EY(L),rot:L.rot,fx:!!L.fx,vis:effVis(L),ghost:!!L.ghost}))}:null},
 relit(part){const P=PARTS[part],im=P&&IMG[P.img];if(!im)return null;const sc=Math.min(1,1200/Math.max(im.naturalWidth,im.naturalHeight)),c=relitCrest(im,'p'+P.img,Math.round(im.naturalWidth*sc),Math.round(im.naturalHeight*sc));return c?c.toDataURL():null},
 morph:morphOf,stats,rules:{BODY_ANCH,GILL_ANCH,GILL_SETS,LADDER,SPOT_TILT,spotPlan,slotJitter,CREST_KEEP,fadePlan}};
})();
