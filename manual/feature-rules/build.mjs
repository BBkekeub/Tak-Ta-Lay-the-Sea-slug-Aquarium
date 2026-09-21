import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
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

const css='body{margin:0;background:#f3f6f2;color:#203833;font:17px/1.85 system-ui,sans-serif}header{background:#193d38;color:white;padding:24px}main{max-width:1000px;margin:24px auto;padding:32px;background:white;border-radius:14px}h1{font-size:30px}h2{font-size:23px;border-top:1px solid #dbe5dd;padding-top:26px;margin-top:36px}a{color:#176a60}li{margin:10px 0}code{background:#eff3ed;padding:2px 5px;overflow-wrap:anywhere}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:15px}th,td{border:1px solid #dbe5dd;padding:12px;text-align:left;vertical-align:top}th{background:#edf4eb}p,li{overflow-wrap:anywhere}nav{display:flex;gap:16px;flex-wrap:wrap}header a{color:white}@media(max-width:650px){main{padding:18px;margin:12px}h1{font-size:25px}}@media print{header{display:none}main{margin:0;padding:0}}';
for(const file of ['README.md','contest-tanks.md','completion-template.md']){
 const body=render(fs.readFileSync(path.join(root,file),'utf8'));
 const html='<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title(file))+'</title><style>'+css+'</style></head><body><header>ทากทาเล · กฎตรวจฟีเจอร์ใหม่<nav><a href="index.html">หนังสือกฎ</a><a href="contest-tanks.html">กฎตู้เกม</a><a href="completion-template.html">แบบฟอร์มส่งงาน</a></nav></header><main>'+body+'</main></body></html>';
 fs.writeFileSync(path.join(root,htmlFile(file)),html);
}
for(const file of ['index.html','contest-tanks.html','completion-template.html'])for(const [,url] of fs.readFileSync(path.join(root,file),'utf8').matchAll(/href="([^"]+)"/g)){if(!/^(https?:|#)/.test(url)&&!fs.existsSync(path.resolve(root,url)))throw Error('Broken link: '+url);}
console.log('Built 3 handbook pages; local links verified.');
