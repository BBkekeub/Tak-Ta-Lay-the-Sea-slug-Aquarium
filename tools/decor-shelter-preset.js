// Editor-only art presets. No game catalog or player save changes.
(() => {
  const base = 'assets/decor-studies/tidal-shelter-original/';
  const views = [['front-0', 'หน้า'], ['right-90', 'ขวา'], ['back-180', 'หลัง'], ['left-270', 'ซ้าย']];
  const status = document.getElementById('shelterStatus');
  let request = 0, saveTimer = 0;
  const sizes = [[650,570],[525,568],[634,525],[566,546]];
  const pathOf = file => base + file + '-v3.png';
  const isActive = () => views.some(([file]) => pathOf(file) === document.getElementById('src').value);
  function persist() {
    clearTimeout(saveTimer);
    if (!isActive()) return true;
    const ok = saveNow(true);
    if (!ok) status.textContent = 'บันทึกไม่สำเร็จ พื้นที่เบราว์เซอร์อาจเต็ม — คัดลอก JSON เก็บไว้ก่อน';
    return ok;
  }
  function bundle() {
    const frames = views.map(([file, label], i) => {
      const src = pathOf(file);
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem('decor_' + src)); } catch (_) {}
      const d = document.getElementById('src').value === src ? curDef() : defOf(
        saved?.state || {}, saved?.place || {}, saved?.wCm ?? 28,
        saved?.ancY ?? ((sizes[i][1]-6)/sizes[i][1]), saved?.name || label,
        src, saved?.asp || sizes[i][1]/sizes[i][0], null, '');
      return {src:d.file, wCm:d.wCm, hCm:d.hCm, anchor:{x:0.5,y:d.ancY},
        solid:d.solid, front:d.front, behind:d.behind, place:d.place};
    });
    return {sprite_tidal_shelter:{name:'หินโพรงและพืช',cat:'หิน 2D · 4 มุม',
      priceCm:frames[0].wCm,cell:0.5,flips:'rotate',sprite:true,
      ...frames[0],frames,shopFrames:frames}};
  }
  const oldSyncOut = syncOut;
  syncOut = function() {
    oldSyncOut();
    if (isActive()) document.getElementById('out').value = JSON.stringify(bundle(), null, 2);
  };
  const oldDraw = draw;
  draw = function() {
    oldDraw();
    if (isActive()) { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 200); }
  };
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
  for (const id of ['name','src','wcm','anc']) document.getElementById(id).addEventListener('input', () => {
    if (isActive()) { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 200); }
  });
  const copy = document.getElementById('copy'), oldCopy = copy.onclick;
  copy.textContent = '📋 คัดลอก JSON ครบ 4 ทิศ';
  copy.onclick = async () => {
    if (!isActive()) return oldCopy();
    const saved = persist();
    const text = JSON.stringify(bundle(), null, 2);
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch (_) {
      const t = document.createElement('textarea'); t.value=text; document.body.append(t); t.select();
      try { copied=document.execCommand('copy'); } catch (_) {} t.remove();
    }
    status.textContent = copied ? 'คัดลอกครบ 4 ทิศแล้ว: หน้า → ขวา → หลัง → ซ้าย' : 'คัดลอกอัตโนมัติไม่ได้ เลือกข้อความ JSON ในช่องด้านล่างได้เลย';
    if (!saved) status.textContent += ' · บันทึกลงเบราว์เซอร์ไม่สำเร็จ';
  };
  const download = document.getElementById('dl'), oldDownload = download.onclick;
  download.textContent = '⬇︎ ดาวน์โหลดชุด 4 ทิศ';
  download.onclick = () => {
    if (!isActive()) return oldDownload();
    persist();
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle(),null,2)],{type:'application/json'}));
    const a=document.createElement('a'); a.href=url; a.download='tidal-shelter-4-views.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  };
  function loadView(file, label) {
    if (!persist()) return;
    const ticket = ++request;
    const src = base + file + '-v3.png';
    if (imgReady && document.getElementById('src').value === src) return;
    const next = new Image();
    status.textContent = 'กำลังโหลด…';
    next.onerror = () => { if (ticket === request) status.textContent = 'โหลดภาพไม่สำเร็จ ลองเปิดผ่านเว็บเซิร์ฟเวอร์ของโปรเจกต์'; };
    next.onload = () => {
      if (ticket !== request) return;
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem('decor_' + src)); } catch (_) {}
      state = saved?.state || {}; place = saved?.place || {};
      wCm = saved?.wCm ?? 28;
      ancY = saved?.ancY ?? ((next.height - 6) / next.height);
      img = next; imgReady = true; imgAsp = next.height / next.width;
      imgThumb = makeThumb(next); imgIsThumb = false; imgData = null;
      try {
        const c = document.createElement('canvas'); c.width = next.width; c.height = next.height;
        c.getContext('2d').drawImage(next, 0, 0); imgData = c.toDataURL('image/png');
      } catch (_) { /* file:// still supports path-based export */ }
      document.getElementById('name').value = saved?.name || ('หินโพรง · ' + label);
      document.getElementById('src').value = src;
      document.getElementById('fname').textContent = file + '-v3.png';
      document.getElementById('wcm').value = wCm;
      document.getElementById('wcmv').textContent = wCm;
      document.getElementById('anc').value = ancY;
      document.getElementById('ancv').textContent = ancY.toFixed(2);
      document.getElementById('flips').value = '';
      document.getElementById('embed').checked = false;
      document.getElementById('out').closest('.card').querySelector('.hint').textContent = 'JSON เป็นของชิ้นเดียว มี frames เรียง หน้า/ขวา/หลัง/ซ้าย รวมขนาด จุดฐาน และกริดของแต่ละทิศ · นำชุดนี้ไปใส่โค้ดครั้งเดียว (ทิศที่ยังไม่ปรับใช้ค่าเริ่มต้น)';
      status.textContent = 'มุม' + label + ' · บันทึกขนาด จุดฐาน และกริดอัตโนมัติ · คัดลอกครั้งเดียวได้ทั้ง 4 ทิศ';
      for (const b of document.querySelectorAll('#shelterViews button')) b.classList.toggle('on', b.dataset.view === file);
      renderSaved(); draw();
    };
    next.src = src;
  }
  for (const [file, label] of views) {
    const b = document.createElement('button'); b.textContent = label; b.dataset.view = file;
    b.onclick = () => loadView(file, label);
    document.getElementById('shelterViews').appendChild(b);
  }
  if (new URLSearchParams(location.search).get('study') === 'shelter') loadView(...views[0]);
})();
