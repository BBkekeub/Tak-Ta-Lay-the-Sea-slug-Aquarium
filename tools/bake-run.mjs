import pw from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
const {chromium}=pw;
const names=fs.readdirSync('/root/work/assets/decor3d').filter(f=>f.endsWith('.glb')).sort();
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:900,height:700}});
const errs=[];page.on('pageerror',e=>errs.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
await page.goto('http://127.0.0.1:8731/tools/bake-decor3d.html',{waitUntil:'load'});
await page.waitForFunction(()=>window.bakeReady,null,{timeout:60000});
fs.mkdirSync('/root/work/assets/decor3d/png',{recursive:true});
const meta=[];
const only=process.argv[2]?names.filter(n=>n.includes(process.argv[2])):names;
for(const f of only){
  const r=await page.evaluate(f=>window.bake(f),f);
  const png=Buffer.from(r.png.split(',')[1],'base64');
  const out=f.replace('.glb','.png');
  fs.writeFileSync('/root/work/assets/decor3d/png/'+out,png);
  delete r.png; r.png=out; r.bytes=png.length;
  meta.push(r);
  console.log(f.padEnd(32), 'img',String(r.W).padStart(4)+'x'+String(r.H).padStart(4),
    'ขนาด', r.sizeCm.join('×')+' ซม.', 'wCm',String(r.wCm).padStart(7),
    'anchor',r.anchor.x.toFixed(2)+','+r.anchor.y.toFixed(2), 'solid',String(r.solid.length).padStart(3),
    'place',String(r.place.length).padStart(3), (png.length/1024).toFixed(1)+'KB');
}
fs.writeFileSync('/root/work/tools/decor3d-meta.json',JSON.stringify(meta,null,1));
console.log('errors:',errs.length?errs.slice(0,5):'ไม่มี');
await browser.close();
