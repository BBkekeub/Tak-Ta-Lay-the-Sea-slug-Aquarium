/* Responsive chrome only: no per-frame work or simulation changes. */
(()=>{
 const mobile=matchMedia('(max-width:820px), (max-width:1000px) and (max-height:600px)');
 const top=document.querySelector('.topbar'),stats=document.createElement('div');stats.className='mobileStats';stats.setAttribute('aria-label','ข้อมูลร้าน เลื่อนได้');
 const counters=[...top.querySelectorAll(':scope > .stat')];if(counters.length){top.insertBefore(stats,counters[0]);stats.append(...counters);}
 const body=document.querySelector('#ov .ov-body'),left=body.querySelector('.tank-side.left'),right=body.querySelector('.tank-side.right');
 const bar=document.createElement('nav');bar.className='mobileTankBar';bar.setAttribute('aria-label','เมนูในตู้');body.append(bar);
 const zoom=document.createElement('div');zoom.className='mobileTankZoom';body.append(zoom);for(const [label,delta]of [['−',100],['＋',-100]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-label',delta>0?'ซูมตู้ออก':'ซูมตู้เข้า');b.onclick=()=>{const r=tankCv.getBoundingClientRect();tankCv.dispatchEvent(new WheelEvent('wheel',{clientX:r.left+r.width/2,clientY:r.top+r.height/2,deltaY:delta,cancelable:true}));};zoom.append(b);}
 const buttons=[];
 function closePanels(){left.classList.remove('mobile-open');right.classList.remove('mobile-open');buttons.forEach(b=>b.setAttribute('aria-expanded','false'));}
 for(const [label,panel]of [['ทาก / ผสมพันธุ์',left],['อาหาร / ดูแล',right],['ตกแต่ง',null]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-expanded','false');buttons.push(b);bar.append(b);b.onclick=()=>{const open=panel?.classList.contains('mobile-open');closePanels();if(panel){if(body.classList.contains('decor-open'))document.getElementById('ovBuild').click();if(!open){panel.classList.add('mobile-open');b.setAttribute('aria-expanded','true');}}else document.getElementById('ovBuild').click();};}
 // Native handlers still own feeding and construction; collapse only after selecting a tool.
 for(const id of ['foodChoose','tankBrush','ovAdd'])document.getElementById(id)?.addEventListener('click',()=>{if(mobile.matches)closePanels();});
 const play=document.getElementById('playTableView'),shelf=play?.querySelector('.playFoodShelf'),controls=play?.querySelector('.playControls'),help=play?.querySelector('.playHelp');
 function layout(){closePanels();if(shelf){if(mobile.matches)play.querySelector('.playLayout').append(shelf);else help.after(shelf);}window.dispatchEvent(new Event('resize'));}
 mobile.addEventListener('change',layout);
 new ResizeObserver(()=>document.documentElement.style.setProperty('--mobile-header',top.getBoundingClientRect().height+'px')).observe(top);
 const ov=document.getElementById('ov');new MutationObserver(()=>{if(!ov.classList.contains('on'))closePanels();}).observe(ov,{attributes:true,attributeFilter:['class']});
 const css=document.createElement('link');css.rel='stylesheet';css.href='css/mobile.css';css.onload=layout;document.head.append(css);
 layout();
})();
