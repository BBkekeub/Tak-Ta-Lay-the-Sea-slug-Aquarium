/* BGM playlist: play every track in assets/BGM, then repeat the playlist. */
const BGM_TRACKS = [
  'assets/BGM/Good night.wav',
  'assets/BGM/cozy-mornings-all-good-folks-main-version-45131-01-48.mp3',
  'assets/BGM/lazy-sunday-hybridas-main-version-38210-01-22.mp3'
];
let _bgmI = 0;
const bgm = new Audio();
bgm.loop = false;
bgm.volume = 0.35;
try{const saved=localStorage.getItem('taktale_bgm_volume');if(saved!==null&&Number.isFinite(Number(saved)))bgm.volume=Math.max(0,Math.min(1,Number(saved)));}catch(e){}
function setBgmVolume(value){
  if(!Number.isFinite(value))return;
  bgm.volume=Math.max(0,Math.min(1,Math.round(value*100)/100));
  try{localStorage.setItem('taktale_bgm_volume',String(bgm.volume));}catch(e){}
  syncBgmVolume();
}
function syncBgmVolume(){
  const label=document.getElementById('musicVolume');if(label)label.textContent=Math.round(bgm.volume*100)+'%';
  const less=document.getElementById('musicQuieter'),more=document.getElementById('musicLouder');
  if(less)less.disabled=bgm.volume<=0;if(more)more.disabled=bgm.volume>=1;
}
let musicOn = false;
const _bgmFailed = new Set();

function loadBgmTrack(){
  bgm.src = encodeURI(BGM_TRACKS[_bgmI]);
  if(musicOn) bgm.play().catch(()=>{});
}
function nextBgmTrack(){
  for(let i=0;i<BGM_TRACKS.length;i++){
    _bgmI = (_bgmI+1)%BGM_TRACKS.length;
    if(!_bgmFailed.has(_bgmI)){ loadBgmTrack(); return; }
  }
  setMusic(false);
  console.warn('[bgm] No playable tracks:', BGM_TRACKS);
}
bgm.onended = ()=>{
  _bgmFailed.clear();
  nextBgmTrack();
};
bgm.onerror = ()=>{
  _bgmFailed.add(_bgmI);
  nextBgmTrack();
};
function setMusic(on){
  musicOn = on;
  const btn = document.getElementById('bMusic');
  if(btn) btn.textContent = '🎵 เพลง: ' + (on ? 'เปิด' : 'ปิด');
  if(on){
    if(_bgmFailed.size===BGM_TRACKS.length){_bgmFailed.clear();loadBgmTrack();}
    else bgm.play().catch(()=>{});
  }else bgm.pause();
}
loadBgmTrack();
const _mbtn = document.getElementById('bMusic');
if(_mbtn) _mbtn.onclick = ()=> setMusic(!musicOn);
window.addEventListener('pointerdown', function _once(e){
  if(!(e.target && e.target.id==='bMusic') && !musicOn) setMusic(true);
  window.removeEventListener('pointerdown', _once);
});
