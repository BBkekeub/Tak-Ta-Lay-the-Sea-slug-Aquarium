import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const entries=fs.readdirSync(root,{withFileTypes:true}).filter(e=>/^\d\d-/.test(e.name)).sort((a,b)=>a.name.localeCompare(b.name));
const files=['README.md',...entries.flatMap(e=>e.isDirectory()?[e.name+'/README.md']:e.name.endsWith('.md')?[e.name]:[])];
const htmlFile=f=>f.endsWith('README.md')?f.replace(/README\.md$/,'index.html'):f.replace(/\.md$/,'.html');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const title=f=>fs.readFileSync(path.join(root,f),'utf8').split('\n')[0].replace(/^# /,'');
const inline=s=>esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,label,url)=>`<a href="${/^https?:/.test(url)?url:htmlFile(url)}">${label}</a>`);
function render(md){
 const lines=md.split(/\r?\n/),out=[];
 for(let i=0;i<lines.length;){
  const s=lines[i];if(!s.trim()){i++;continue;}
  const heading=/^(#{1,3}) (.*)$/.exec(s);
  if(heading){out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);i++;continue;}
  if(s.startsWith('|')){const rows=[];while(i<lines.length&&lines[i].startsWith('|'))rows.push(lines[i++]);const cells=r=>r.split('|').slice(1,-1).map(x=>x.trim());out.push('<div class="table-wrap"><table><thead><tr>'+cells(rows[0]).map(x=>'<th>'+inline(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(2).map(r=>'<tr>'+cells(r).map(x=>'<td>'+inline(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');continue;}
  if(/^(- |\d+\. )/.test(s)){const ordered=/^\d/.test(s),tag=ordered?'ol':'ul',items=[];while(i<lines.length&&/^(- |\d+\. )/.test(lines[i]))items.push('<li>'+inline(lines[i++].replace(/^(- |\d+\. )/,''))+'</li>');out.push(`<${tag}>${items.join('')}</${tag}>`);continue;}
  const p=[];while(i<lines.length&&lines[i].trim()&&!/^(#|\||- |\d+\. )/.test(lines[i]))p.push(lines[i++]);out.push('<p>'+inline(p.join(' '))+'</p>');
 }return out.join('\n');
}
const css=`:root{color-scheme:light;--ink:#203332;--muted:#526966;--accent:#176a60}*{box-sizing:border-box}body{margin:0;font:17px/1.85 system-ui,sans-serif;color:var(--ink);background:#f4f6f2}header{padding:18px 28px;background:#193d38;color:white}header a{color:white;text-decoration:none}header small{display:block;color:#c5dbcf}main{max-width:1280px;margin:auto;display:grid;grid-template-columns:270px minmax(0,1fr);gap:32px;padding:30px 24px}nav{align-self:start;position:sticky;top:20px;font-size:14px}nav a{display:block;padding:8px 12px;border-radius:8px;text-decoration:none}nav a[aria-current]{background:#dceae2;font-weight:700}article{background:white;border:1px solid #dce4dc;border-radius:16px;padding:32px 40px;min-width:0}a{color:var(--accent);text-underline-offset:3px}a:focus-visible{outline:3px solid #ce7f20}h1{font-size:29px;line-height:1.5;margin:0 0 20px}h2{font-size:22px;margin-top:32px}code{font: .88em ui-monospace,monospace;background:#edf2ee;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}p,li{overflow-wrap:anywhere}li{margin-bottom:9px}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:15px}th,td{padding:12px;border:1px solid #dce4dc;text-align:left;vertical-align:top}th{background:#edf3ed}footer{font-size:13px;color:var(--muted);margin-top:36px;border-top:1px solid #dce4dc;padding-top:16px}@media(max-width:850px){main{display:block;padding:16px}nav{position:static;margin-bottom:20px}article{padding:24px 20px}h1{font-size:25px}}@media print{nav,header{display:none}main{display:block;padding:0}article{border:0}a{color:inherit}}`;
fs.writeFileSync(path.join(root,'guide.css'),css);
for(const file of files){
 const nested=file.includes('/'),prefix=nested?'../':'',name=title(file);
 const nav=files.map(f=>`<a ${f===file?'aria-current="page" ':''}href="${prefix+htmlFile(f)}">${esc(title(f).replace(/^คู่มือศึกษา /,''))}</a>`).join('');
 const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)}</title><link rel="stylesheet" href="${prefix}guide.css"></head><body><header><a href="${prefix}index.html">ทากทาเล · คู่มือวิจัย Two Point Campus</a><small>ตรวจหลักฐาน 19 กันยายน 2026 · ยังไม่มีผล benchmark 1,000 คน</small></header><main><nav aria-label="สารบัญ">${nav}</nav><article>${render(fs.readFileSync(path.join(root,file),'utf8'))}<footer><a href="README.md">อ่าน Markdown ต้นฉบับ</a> · ข้อเสนอในคู่มือยังไม่ได้เปลี่ยนระบบเกม</footer></article></main></body></html>`;
 fs.writeFileSync(path.join(root,htmlFile(file)),html.replace('href="README.md">อ่าน Markdown',`href="${path.basename(file)}">อ่าน Markdown`));
}
// Verify every local link in generated pages; source and evidence files must exist.
for(const file of files){const htmlPath=path.join(root,htmlFile(file));const html=fs.readFileSync(htmlPath,'utf8');for(const [,url]of html.matchAll(/href="([^"]+)"/g)){if(/^(https?:|#)/.test(url))continue;if(!fs.existsSync(path.resolve(path.dirname(htmlPath),url)))throw Error('Broken link '+file+': '+url);}}
console.log(`Built ${files.length} offline pages; all local links verified.`);
