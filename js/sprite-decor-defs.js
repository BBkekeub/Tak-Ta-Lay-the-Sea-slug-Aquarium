// Four authored views, not mirror flips. Common pixel scale and ground anchors.
// ของตกแต่ง 2D หลายมุม — config.js รวมตารางนี้เข้า TANK_DECOR · วาด/ชนโดย sprite-decor-runtime.js
var SPRITE_DECOR_DEFS=typeof SPRITE_DECOR_DEFS==='object'&&SPRITE_DECOR_DEFS?SPRITE_DECOR_DEFS:{};
(()=>{
 const dir='assets/decor-studies/dragon-rock-2d/';
 const names=['front-0','right-90','back-180','left-270'];
 const widths=[702,552,702,552], bottoms=[607,607,583,586];
 const centers=[351,308,350,312];
 const frames=names.map((name,i)=>{
  const place=[];const w=i%2?3:5,h=i%2?5:3;
  for(let x=-w/2;x<w/2;x+=.5)for(let y=-h/2;y<h/2;y+=.5)place.push([x,y]);
  return {src:dir+name+'.png',wCm:widths[i]*.04,hCm:627*.04,anchor:{x:centers[i]/widths[i],y:bottoms[i]/627},place,solid:place,front:[],behind:[]};
 });
 Object.assign(SPRITE_DECOR_DEFS,{sprite_dragon_rock:{name:'หินยอดโค้งและพืช · 4 มุม',cat:'หิน 2D · 4 มุม',priceCm:25,cell:.5,flips:'rotate',sprite:true,frames,shopFrames:frames,...frames[0]}});
})();
