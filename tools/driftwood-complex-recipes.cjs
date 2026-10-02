// Authored skeletons for the second pack. Points: x, y, z, wood radius (cm).
// openStart/openEnd hide buried branch caps; all parts belong to one object.
module.exports=[
 {id:'root_crown',name:'ตอไม้รากแผ่',size:[20,17.5,15],seed:719,parts:[
  {points:[[-1,0,2.1,2.6],[-.7,.2,4.7,2.35],[.2,.4,8,1.85],[1.4,.7,11.4,1.15]],moss:[[.12,.14],[.4,.13]]},
  {points:[[-.8,.1,3.1,1.85],[-3.7,-1,1.8,1.35],[-7.8,-2.5,.85,.72],[-9,-4,.65,.38]],openStart:true,moss:[[.4,.18]]},
  {points:[[-.5,-.4,2.8,1.65],[.7,-3.4,1.7,1.2],[3.6,-6.4,.65,.55],[6,-7,.5,.3]],openStart:true,moss:[[.32,.17]]},
  {points:[[-.2,.4,2.8,1.7],[3.6,1.2,1.8,1.2],[7.4,3.8,.8,.67],[8.7,5.3,.6,.37]],openStart:true,moss:[[.38,.17]]},
  {points:[[-1,.6,2.7,1.65],[-3.4,3.9,1.6,1.1],[-6.5,6.6,.55,.5]],openStart:true,moss:[[.34,.16]]},
  {points:[[.25,.5,7.9,1.25],[2.5,1.1,8.8,.95],[4.4,1.6,8.4,.65]],openStart:true,moss:[]}]},
 {id:'serpentine',name:'ขอนไม้คดแตกแขนง',size:[27.5,12.5,9],seed:823,parts:[
  {points:[[-12,-2,2,1.85],[-8,1.6,2.1,2.1],[-4,3.5,2.7,1.85],[0,1.2,3.3,1.65],[4,-2.7,3.15,1.5],[8,-3.5,2.2,1.25],[12,-.4,1.7,.72]],moss:[[.15,.11],[.4,.1],[.72,.12]]},
  {points:[[-5,3.3,2.6,1.3],[-3,5.2,3.6,.9],[.4,5.7,4.1,.48]],openStart:true,moss:[[.55,.15]]},
  {points:[[3,-2,3.2,1.1],[4.7,-.1,5.4,.75],[6.9,.7,6.7,.4]],openStart:true,moss:[]},
  {points:[[-8,1.5,2.1,1.2],[-8.4,-1.3,1.1,.78],[-6.6,-4,.6,.35]],openStart:true,moss:[[.38,.15]]}]},
 {id:'hollow_roots',name:'ขอนไม้โพรงรากพัน',size:[22.5,17.5,12],seed:947,parts:[
  {points:[[-7,0,3,2.8],[-2,.2,3.5,3],[3,.9,4.4,2.75],[7,1.7,5.2,2.5]],hollow:.64,moss:[[.24,.16],[.65,.15]]},
  {points:[[-4,-2,2.5,1.2],[-4.4,-4.3,1.5,1.05],[-1.7,-6.2,.75,.58],[1.1,-6.7,.55,.32]],openStart:true,moss:[[.31,.15]]},
  {points:[[1,-1.7,3.3,1.3],[3.4,-4,2.1,1],[6.4,-5,.8,.55],[8,-4.5,.45,.3]],openStart:true,moss:[[.36,.16]]},
  {points:[[-1,2.5,3.1,1.3],[-2,5,1.9,.95],[-4.3,6.7,.75,.42]],openStart:true,moss:[[.32,.16]]},
  {points:[[3.4,3,4.2,1.1],[5.5,5,3.8,.78],[8.1,6,2.5,.38]],openStart:true,moss:[[.42,.15]]}]},
 {id:'loop_bridge',name:'ขอนไม้ห่วงซ้อน',size:[25,15,12],seed:1063,parts:[
  {points:[[-10,-2,1.5,1.6],[-7,0,3.8,1.9],[-3,2.4,7.2,1.65],[2,2.8,7.8,1.4],[7,1.2,4.4,1.8],[10,0,1.5,1.3]],moss:[[.2,.1],[.48,.13],[.77,.1]]},
  {points:[[-7.2,0,3.7,1.5],[-5,-3.8,3.4,1.1],[-1,-5.3,3.6,1.05],[3,-4.3,4.2,1.15],[6.4,.9,4.7,1.45]],openStart:true,openEnd:true,moss:[[.31,.14],[.68,.12]]},
  {points:[[-7,-.1,2.9,1.2],[-8.4,3.3,1.5,.83],[-7.3,5.1,.5,.4]],openStart:true,moss:[[.42,.16]]},
  {points:[[7,.9,3.7,1.2],[9,-2.7,1.8,.83],[10.6,-4.1,.7,.42]],openStart:true,moss:[]}]},
 {id:'antler',name:'ขอนไม้กิ่งพัด',size:[25,20,10],seed:1181,parts:[
  {points:[[-10,-1,1.9,2.05],[-6,-.6,2.2,2.15],[-1,.3,2.8,1.9],[4,1.3,3.4,1.45],[9,1.5,4.2,.7]],moss:[[.15,.12],[.42,.12],[.77,.1]]},
  {points:[[-4,-.3,2.4,1.7],[-1,-3,2.7,1.4],[3,-5.4,3.1,.9],[8,-6.8,4.2,.42]],openStart:true,moss:[[.27,.12],[.67,.15]]},
  {points:[[-3,.7,2.6,1.65],[-1,3.6,3.3,1.25],[3,6,4.7,.85],[6.7,7.6,5.6,.4]],openStart:true,moss:[[.37,.16]]},
  {points:[[2.7,5.8,4.5,.9],[1.8,8.2,5.5,.62],[.7,9.4,6.4,.32]],openStart:true,moss:[]},
  {points:[[2.8,-5.3,3,.95],[3,-8,2.5,.6],[5,-9.4,2.2,.3]],openStart:true,moss:[[.35,.18]]},
  {points:[[-7,-.7,2,1.3],[-8,1.9,1.1,.8],[-6.8,3.7,.55,.35]],openStart:true,moss:[]}]}
].map(recipe=>{
 // Compact broken limbs, not long needle-like roots. Keep both buried ends
 // of the returning loop in place; its attachment points must not separate.
 recipe.preserveProportions=true;
 recipe.parts.forEach((part,index)=>{
  part.weathered=true;
  part.phase=index*1.73+recipe.seed*.01;
  if(index===0){
   if(!part.hollow)part.points[part.points.length-1][3]=Math.max(1.05,part.points[part.points.length-1][3]);
   return;
  }
  if(part.openEnd)return;
  part.branchCollar=true;
  const base=part.points[0].slice(),shortening=recipe.id==='antler'?.62:.68;
  part.points=part.points.map((p,i)=>[
   ...p.slice(0,3).map((v,k)=>base[k]+(v-base[k])*shortening),
   Math.max(p[3],i===0?base[3]*1.28:.65)
  ]);
 });
 // These small forks attach to the shortened fan, rather than the old tips.
 if(recipe.id==='antler'){
  for(const [child,parent] of [[3,2],[4,1]]){
   const limb=recipe.parts[child],anchor=recipe.parts[parent].points[2];
   const delta=anchor.slice(0,3).map((v,k)=>v-limb.points[0][k]);
   limb.points=limb.points.map(p=>[...p.slice(0,3).map((v,k)=>v+delta[k]),p[3]]);
  }
 }
 return recipe;
});
