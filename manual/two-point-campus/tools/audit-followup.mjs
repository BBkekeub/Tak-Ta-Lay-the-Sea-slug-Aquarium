import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.resolve(root,'../..');
const read=f=>fs.readFileSync(path.join(repo,f),'utf8');
function extract(f,start,end){const s=read(f),a=s.indexOf(start),b=s.indexOf(end,a+start.length);if(a<0||b<0)throw Error('Source boundary changed: '+f);return s.slice(a,b);}
// Execute actual functions with minimal DOM stubs. Counts are not browser timings.
let questWrites=0,questBindings=0;
const card={style:{},set innerHTML(v){questWrites++;}};
const qctx={card,G:{questDone:false,questIndex:0},QUESTS:[{t:'same',h:'same',reward:{coin:1}}],questCollapsed:false,updateQuestGlow(){},clearGlow(){},setPointer(){},questHeader:s=>s,bindToggle(){questBindings++;}};
vm.createContext(qctx);vm.runInContext(extract('js/quests.js','function renderCard(){','/* รางวัลเควส'),qctx);
for(let i=0;i<60;i++)vm.runInContext('renderCard()',qctx);
let shopWrites=0;
const sctx={slugShopDialog:{set innerHTML(v){shopWrites++;},querySelectorAll:()=>[],querySelector:()=>({})},slugBoxStock:()=>({n:1}),SLUG_BOXES:[],G:{coin:100},slugDeliveries:()=>[],SLUG_BOX_MAX:10,slugBoxWaitText:()=>'',slugDeliveryReady:()=>false};
vm.createContext(sctx);vm.runInContext(extract('js/slug-box-shop.js','function renderSlugShop(){','function openSlugShopDialog'),sctx);
for(let i=0;i<60;i++)vm.runInContext('renderSlugShop()',sctx);
const peopleSource=read('js/people.js');
const timePrefix=extract('js/people.js','function stepPeople(){','crowdRouteBudget=2;')+'}';
let now=1000;const tctx={performance:{now:()=>now},_pLast:1000,peopleOn:true,_peopleT:0};vm.createContext(tctx);vm.runInContext(timePrefix,tctx);
for(let i=0;i<100;i++){now+=100;vm.runInContext('stepPeople()',tctx);}
const files=['js/quests.js','js/slug-box-shop.js','js/tank-hygiene.js','js/people.js','js/shop-floor.js','js/decor-glb.js','js/play-table.js','js/slug-crowd.js'];
const evidence=files.map(file=>{const source=read(file);return {file,sha256:crypto.createHash('sha256').update(source).digest('hex'),anchors:source.split(/\r?\n/).flatMap((text,i)=>/function renderCard|function renderSlugShop|setInterval|function rebuildAlgaeSurface|No coloured texture|if\(dt > 0.05\)|function fillDepth|if\(!a\|\||function updateShopOcclusion|function frame\(now\)|visibilitychange|crowdGlass/.test(text)?[{line:i+1,text:text.slice(0,260)}]:[])};});
const report={capturedAt:new Date().toISOString(),scope:'Source review and isolated function invocation; no whole-game FPS or hardware emulation',checks:{unchangedQuest:{calls:60,innerHTMLWrites:questWrites,bindToggleCalls:questBindings},unchangedEmptyBoxShop:{calls:60,innerHTMLWrites:shopWrites},peopleTimeAt100msCadence:{elapsedSeconds:10,simulatedSeconds:tctx._peopleT,scope:'Actual stepPeople time prefix only; 100ms is configured fallback cadence, not a measured browser interval'}},evidence};
if(questWrites!==60||shopWrites!==60||Math.abs(tctx._peopleT-5)>1e-8)throw Error('Observed behavior changed; reassess report');
fs.writeFileSync(path.join(root,'evidence/followup-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.checks,null,2));
