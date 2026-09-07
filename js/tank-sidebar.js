// Side tools share the canvas area; collapsed controls don't reduce tank height.
(()=>{
 const style=document.createElement('style');style.textContent=`
 #ov .ov-body{overflow:hidden}
 .tank-side{position:absolute;top:14px;z-index:5;width:190px;display:flex;flex-direction:column;gap:9px;max-height:calc(100% - 28px);overflow:auto;scrollbar-width:thin;pointer-events:auto}
 .tank-side.left{left:12px}.tank-side.right{right:12px}
 .tank-side .tbtn{white-space:normal;width:100%;text-align:left;padding:10px 12px}
 .tank-side details,.tank-side>.tbtn{background:rgba(15,28,31,.93);border:1px solid #536365;border-radius:10px;box-shadow:0 3px 14px #0003}
 .tank-side summary{cursor:pointer;padding:11px 12px;color:#e9ddc4;font-size:13px;user-select:none}
 #ov #foodBar{padding:10px!important;background:transparent!important;gap:7px!important;border-top:1px solid #ffffff15}
 #foodBar select{max-width:100%;width:100%;padding:6px;background:#24383b;color:#eee;border:1px solid #607477;border-radius:5px}
 #foodBar>span:first-of-type{display:none}#foodBar>img{width:35px!important;height:35px!important}
 #foodInfo{line-height:1.6;color:#abbabd;white-space:pre-line}#foodCancel{font-size:12px}
 #foodChoose[aria-pressed="true"]{border-color:#e6c173;background:#3d4a38;color:#f3d99a}
 #ov #breederPanel{background:transparent!important;padding:10px!important;max-height:none!important;border-top:1px solid #ffffff15!important;line-height:1.8;font-size:12px!important}
 #ov #breederPanel>div:first-child{overflow-wrap:anywhere;color:#b9c9c9}
 #ov #ovDecor{padding:8px;background:rgba(15,28,31,.95);max-height:55vh;overflow:auto;flex-direction:column;border-radius:8px}
 #ov #ovDecor:not([hidden]){display:flex}#ovDecor .dpal{flex-wrap:wrap}#ovDecor .dlabel{display:none}
 #ov .ov-bottom{display:none!important}
 @media(max-width:800px){.tank-side{width:145px;top:8px}.tank-side.left{left:6px}.tank-side.right{right:6px}.tank-side .tbtn,.tank-side summary{font-size:12px;padding:8px}}
 `;document.head.append(style);
 const body=ov.querySelector('.ov-body'),left=document.createElement('aside'),right=document.createElement('aside');left.className='tank-side left';right.className='tank-side right';left.setAttribute('aria-label','จัดการทาก');right.setAttribute('aria-label','เครื่องมือในตู้');body.append(left,right);
 const disclosure=(label,parent)=>{const d=document.createElement('details'),s=document.createElement('summary');s.textContent=label;d.append(s);parent.append(d);return d;};
 left.append(document.getElementById('ovAdd'));
 const breed=disclosure('🥚 การผสมพันธุ์',left);breed.append(breederPanel);
 const food=disclosure('🌸 ให้อาหาร',right);food.append(document.getElementById('foodBar'));
 right.append(document.getElementById('ovBuild'),document.getElementById('ovDecor'));
 const updateBreed=()=>{breed.hidden=breederPanel.hidden;if(!breed.hidden){const b=breederState(curTank);breed.querySelector('summary').textContent=b.phase==='mating'?'🥚 ผสม · '+Math.ceil(b.left)+' วิ':b.phase==='eggs'?'🥚 รอฟัก · '+Math.ceil(b.left)+' วิ':b.phase==='hatching'?'🥚 พร้อมฟัก':'🥚 ผสมพันธุ์';}};
 new MutationObserver(updateBreed).observe(breederPanel,{attributes:true,childList:true,subtree:true});updateBreed();
 /* ยุบแผงให้เห็นตู้เฉพาะตอน "เปิด" โหมด — ตอนปิดโหมดปล่อยให้แผงคาไว้ จะได้เลือกอาหารต่อได้ */
 document.getElementById('foodChoose').addEventListener('click',()=>{if(foodMode)food.open=false;});
 document.getElementById('foodCancel').addEventListener('click',()=>{food.open=false;food.querySelector('summary').textContent='🌸 ให้อาหาร';});
 document.getElementById('ovBuild').addEventListener('click',()=>{food.open=false;});
 tankCv.addEventListener('pointerup',()=>{if(!foodChoice)food.querySelector('summary').textContent='🌸 ให้อาหาร';});
 const originalGeneCard=drawGeneCard;drawGeneCard=function(slug,x,y){const r=left.getBoundingClientRect(),c=tankCv.getBoundingClientRect();return originalGeneCard(slug,x,Math.max(y,r.bottom-c.top+10));};
 const originalEnter=enterTank;enterTank=function(...args){food.open=false;breed.open=false;if(typeof foodModeSet==='function')foodModeSet(false);originalEnter(...args);renderBreederUI();updateBreed();};
})();
