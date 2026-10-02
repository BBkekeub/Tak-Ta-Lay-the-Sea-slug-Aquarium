// Integration test in a fresh browser context + ephemeral localhost origin.
// Never reads or modifies the player's browser profile or save.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const runtime=process.env.CODEX_NODE_MODULES||'C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(runtime,'playwright'));
const natural=process.argv.includes('--natural'),packDir=natural?'natural-v1':process.argv.includes('--complex')?'complex-v1':'variants-v1';
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/decor/driftwood',packDir);
const manifest=JSON.parse(fs.readFileSync(path.join(out,natural?'recipes.json':'manifest.json'))),report={passed:false,profile:'isolated',items:[]},errors=[];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.mp3':'audio/mpeg'};
let browser,server;
async function main(){
 server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://local'),pathname=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>{if(r.url().includes('cdn.jsdelivr.net'))report.externalDependencyFailure=r.failure()?.errorText;});
 const ready=()=>page.waitForFunction(()=>!window.BOOTING&&typeof engineReady!=='undefined'&&engineReady,null,{timeout:45000});
 try{
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await ready();
  assert.ok(await page.evaluate(ids=>ids.every(id=>!!TANK_DECOR['sprite_driftwood_'+id]),manifest.map(x=>x.id)));
  const tankId=await page.evaluate(()=>{const t=G.objs.filter(o=>o.type==='tank'&&!isBreeder(o)).sort((a,b)=>b.def.w*b.def.h-a.def.w*a.def.h)[0];if(!t)throw Error('No tank');t.decor=[];t.slugs=[];addCoin(10000);saveGame();return t.id;});
  const enter=async()=>{
   await page.evaluate(id=>{const t=G.objs.find(o=>o.id===id);enterTank(t);fitTankZoom();centerTankCam();},tankId);
   if(!await page.evaluate(()=>tankBuildMode))await page.locator('#ovBuild').click();
   await page.getByRole('tab',{name:natural?'ขอนไม้ Blender':'ขอนไม้ · 4 มุม',exact:true}).click();
  };
  await enter();
  for(const item of manifest){
   const key='sprite_driftwood_'+item.id;
   await page.locator(`[data-key="${key}"]`).click();
   const placement=await page.evaluate(key=>{
    const fx=curTank.def.w/2,fy=curTank.def.h/2,issue=decorPlaceIssue(key,fx,fy,0);if(issue)throw Error(issue);
    const p=S(fx,fy,SAND_CELLS),r=tankCv.getBoundingClientRect();return{x:r.left+p.x,y:r.top+p.y,coin:G.coin,price:decorPrice(key)};
   },key);
   await page.mouse.click(placement.x,placement.y);
   await page.waitForFunction(key=>curTank.decor.some(d=>d.key===key),key,{timeout:8000});
   assert.equal(await page.evaluate(()=>G.coin),placement.coin-placement.price);
   await page.keyboard.press('Escape');
   await page.evaluate(key=>{selDecor=curTank.decor.find(d=>d.key===key);syncDecorBar();},key);
   for(let r=0;r<4;r++){
    assert.equal(await page.evaluate(()=>selDecor.flip||0),r);
    // Wait on actual image decode, not an arbitrary screenshot delay.
    await page.evaluate(async({key,r})=>{const f=SpriteDecor.frame(key,r),i=new Image();i.src=f.src;await i.decode();},{key,r});
    if(r===1){
     await page.evaluate(()=>{
      const o=selDecor,box=()=>drawDecorAt(o.key,o.fx,o.fy,1,o.flip);
      let b=box();tankCam.zoom*=Math.min(1,TCW*.6/b.w,TCH*.7/b.h);b=box();
      tankCam.ox+=TCW*.5-b.x-b.w/2;tankCam.oy+=TCH*.52-b.y-b.h/2;
     });
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     await page.locator('#tankCv').screenshot({path:path.join(out,item.id,'game-tank-90.png')});
    }
    await page.locator('#dFlip').click();
   }
   await page.evaluate(()=>saveGame());await page.reload();await ready();await enter();
   const restored=await page.evaluate(key=>curTank.decor.filter(d=>d.key===key),key);assert.equal(restored.length,1);assert.equal(restored[0].flip||0,0);
   await page.evaluate(key=>{selDecor=curTank.decor.find(d=>d.key===key);syncDecorBar();},key);await page.locator('#dRemove').click();
   assert.equal(await page.evaluate(key=>G.decorCredit[key],key),1);
   report.items.push({id:item.id,bought:true,rotations:4,savedAndReloaded:true,removedToCredit:true});
   console.log('PASS browser: '+item.id);
  }
  await page.evaluate(()=>exitTank());
  report.errors=errors;assert.deepEqual(errors,[]);report.passed=true;
 }catch(e){report.error=String(e);await page.screenshot({path:path.join(out,'browser-test-failure.png')}).catch(()=>{});throw e;}
 finally{fs.writeFileSync(path.join(out,'browser-test-report.json'),JSON.stringify(report,null,2));}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.close();});
