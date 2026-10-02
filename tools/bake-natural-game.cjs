const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/decor/driftwood/natural-v1'),{render,footprint}=require('./bake-driftwood-pack.cjs');
const sharp=require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
async function main(){
 const maps={};for(const [k,f] of [['side','wood-color.png'],['end','wood-end-color.png']])maps[k]=await sharp(path.join(root,'assets/decor/driftwood/consistent-v2',f)).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const defs={};for(const recipe of require('./driftwood-natural-recipes.cjs')){
  const dir=path.join(out,recipe.id);
  if(process.argv.includes('--resume')&&fs.existsSync(path.join(dir,'game-bake.json'))){const b=JSON.parse(fs.readFileSync(path.join(dir,'game-bake.json')));defs['sprite_driftwood_'+recipe.id]={name:recipe.name,cat:'ขอนไม้ Blender',sizeCm:b.sizeCm,priceCm:Math.max(...b.sizeCm),cell:.5,sprite:true,flips:'rotate',shopRotationSign:-1,...b.frames[0],frames:b.frames,shopFrames:b.shopFrames};continue;}
  const result=cp.spawnSync('C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe',['-b',path.join(dir,recipe.id+'.blend'),'--python',path.join(__dirname,'export-natural-mesh.py'),'--',dir],{windowsHide:true,encoding:'utf8'});
  if(result.status!==0)throw Error(result.stderr);
  const model=JSON.parse(fs.readFileSync(path.join(dir,'game-mesh.json'))),frames=[],shopFrames=[];
  const size=recipe.size.map(x=>Math.ceil(x/5)*5);
  for(let r=0;r<4;r++){
   const place=footprint(size,r);frames.push({...await render(model,recipe,r,false,maps,{out,packDir:'natural-v1'}),place,solid:place,front:[],behind:[]});
   shopFrames.push(await render(model,recipe,r,true,maps,{out,packDir:'natural-v1'}));
  }
  defs['sprite_driftwood_'+recipe.id]={name:recipe.name,cat:'ขอนไม้ Blender',sizeCm:size,priceCm:Math.max(...size),cell:.5,sprite:true,flips:'rotate',shopRotationSign:-1,...frames[0],frames,shopFrames};
  fs.writeFileSync(path.join(dir,'game-bake.json'),JSON.stringify({frames,shopFrames,sizeCm:size},null,2));console.log('Baked '+recipe.id);
 }
 fs.writeFileSync(path.join(root,'js/driftwood-natural-defs.js'),"var SPRITE_DECOR_DEFS=typeof SPRITE_DECOR_DEFS==='object'?SPRITE_DECOR_DEFS:{};\nObject.assign(SPRITE_DECOR_DEFS,"+JSON.stringify(defs)+');\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
