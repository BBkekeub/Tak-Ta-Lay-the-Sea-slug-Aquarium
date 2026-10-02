const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
http.createServer((req, res) => {
  if (req.url === '/api/save-decor-grid' && req.method === 'POST') {
    if (req.headers.origin !== 'http://127.0.0.1:8766' || req.headers['content-type'] !== 'application/json') {
      res.writeHead(403).end(); return;
    }
    let body = '', oversized = false;
    req.on('data', chunk => { body += chunk; if (body.length > 16000000) { oversized = true; req.destroy(); } });
    req.on('end', () => {
      if (oversized) return;
      try {
        const data = JSON.parse(body), keys = Object.keys(data);
        if (!keys.length || keys.some(k => !/^sprite_[a-z0-9_]+$/.test(k) || !Array.isArray(data[k].frames) || data[k].frames.length !== 4)) throw Error('Invalid decor data');
        const target = path.join(root, 'js/decor-grid-overrides.js');
        const backupDir = path.join(root, '.local-backups');
        fs.mkdirSync(backupDir, {recursive:true});
        const backup = path.join(backupDir, 'decor-grid-overrides-' + Date.now() + '.js');
        if (fs.existsSync(target)) fs.copyFileSync(target, backup);
        const text = '// Saved from Dec Grid.html. Keep after authored definitions.\nvar DECOR_GRID_OVERRIDES=' + JSON.stringify(data,null,1) + ';\nObject.assign(SPRITE_DECOR_DEFS,DECOR_GRID_OVERRIDES);\n';
        const temp = target + '.tmp'; fs.writeFileSync(temp,text); fs.renameSync(temp,target);
        res.writeHead(200, {'Content-Type':'application/json'}).end(JSON.stringify({count:keys.length,backup}));
      } catch(e) { res.writeHead(400, {'Content-Type':'application/json'}).end(JSON.stringify({error:e.message})); }
    });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end(); return;
  }
  res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'})[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(8766, '127.0.0.1', () => console.log('http://127.0.0.1:8766/Dec%20grid.html'));
