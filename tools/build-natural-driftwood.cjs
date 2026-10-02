const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),{build}=require('./bake-driftwood-pack.cjs'),recipes=require('./driftwood-natural-recipes.cjs');
const sharp=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const out=path.join(root,'assets/decor/driftwood/natural-v1');
async function main(){
 for(const r of recipes.filter(r=>!process.argv[2]||r.id===process.argv[2])){
  const dir=path.join(out,r.id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'source.json'),JSON.stringify(build(r)));
  const run=cp.spawnSync('C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe',['-b','--python',path.join(__dirname,'blender-driftwood-study.py'),'--',r.id],{cwd:root,windowsHide:true,encoding:'utf8'});
  fs.writeFileSync(path.join(dir,'build.log'),run.stdout+'\n'+run.stderr);if(run.status!==0)throw Error(r.id+' Blender failed: '+run.stderr);
  console.log('Rendered '+r.id);
 }
 for(const review of [false,true]){
  const w=review?1600:1500,h=review?2000:1000,tiles=[];
  for(let i=0;i<recipes.length;i++)for(const a of review?[0,90,180,270]:[0]){
   const r=recipes[i],size=review?400:500,x=review?a/90*400:(i%3)*500,y=review?i*400:Math.floor(i/3)*500;
   const image=await sharp(path.join(out,r.id,r.id+'-'+a+'.png')).resize(size,size).png().toBuffer();tiles.push({input:image,left:x,top:y});
  }
  const labels=recipes.map((r,i)=>`<text x="${review?12:i%3*500+12}" y="${review?i*400+25:Math.floor(i/3)*500+28}" font-size="20" fill="#494538">${i+1}. ${r.name}</text>`).join('');
  tiles.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${labels}</svg>`),left:0,top:0});
  await sharp({create:{width:w,height:h,channels:4,background:'#eeeade'}}).composite(tiles).png().toFile(path.join(out,review?'review.png':'preview.png'));
 }
 fs.writeFileSync(path.join(out,'recipes.json'),JSON.stringify(recipes,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
