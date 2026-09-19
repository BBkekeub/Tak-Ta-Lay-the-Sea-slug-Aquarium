import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

// Read-only inspection of the installed game. Writes only inside this manual.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.resolve(root,'../..');
const game=process.argv[2]||'C:/Program Files (x86)/Steam/steamapps/common/Two Point Campus';
const data=path.join(game,'TPC_Data');
const read=p=>fs.readFileSync(p);
const relative=p=>path.relative(game,p).replaceAll('\\','/');
const fingerprint=p=>({file:relative(p),bytes:fs.statSync(p).size,sha256:crypto.createHash('sha256').update(read(p)).digest('hex')});
const metadata=path.join(data,'il2cpp_data/Metadata/global-metadata.dat');
const b=read(metadata);
if(b.readUInt32LE(0)!==0xfab11baf)throw Error('Unexpected IL2CPP metadata magic');
const offset=b.readUInt32LE(24),size=b.readUInt32LE(28);
if(offset+size>b.length||offset<32)throw Error('Invalid metadata string table');
const strings=b.subarray(offset,offset+size).toString('utf8').split('\0');
const groups={
  characterCulling:/CharacterCull|IsCullingCharacters/,
  animation:/AnimationSkinningQuality|ES.*Anim|GPU.*Skin|Skin.*GPU/,
  pooling:/CharacterPrefabPool|ObjectPool|PrefabPool/,
  simulation:/^ES(Character|ExecuteTask|ApplyConstant|StatusIcon|Teleport)|TickRate/,
  navigation:/^ES.*(Navig|Path|Movement)|^(CharacterNavigation|NavigationManager|PathRequest|Pathfinding|NavMesh)/,
  burst:/BurstDirectCall.*|.*BurstDirectCall/,
};
const symbols={};
for(const [name,re] of Object.entries(groups))symbols[name]=[...new Set(strings.filter(s=>s.length<220&&re.test(s)))].sort();
const assemblies=JSON.parse(read(path.join(data,'ScriptingAssemblies.json'))).names;
const modelPath=path.join(repo,'js/people-model.js');
const model=vm.runInNewContext(read(modelPath).toString()+';PEOPLE_MODEL',{}, {timeout:2000});
const modelCounts=Object.fromEntries(Object.entries(model).map(([k,v])=>[k,{baseTriangles:Object.values(v.parts).reduce((n,p)=>n+p.t.length/3,0),baseVertices:Object.values(v.parts).reduce((n,p)=>n+p.v.length/3,0),variantGroups:Object.keys(v.variants||{})}]));
const scanFiles=['js/people.js','js/shop-floor.js','js/people-model.js'];
const anchors={};
const anchorRe=/function (paintPersonMesh|drawPerson|personOnScreen|rebuildPersonGrid|stepPeople|personRoute)|gl\.bufferData|const poseRate|cached\.faces\.map|crowdRouteBudget=2|PEOPLE\.filter\(q|drawFloorActive|document\.hidden.*drawFloor/;
for(const f of scanFiles.filter(f=>!f.includes('model')))anchors[f]=read(path.join(repo,f)).toString().split(/\r?\n/).flatMap((s,i)=>anchorRe.test(s)?[{line:i+1,text:s.slice(0,400)}]:[]);
const selectedFiles=['version.txt','TPC_Data/boot.config','TPC_Data/ScriptingAssemblies.json','TPC_Data/il2cpp_data/Metadata/global-metadata.dat','TPC_Data/Plugins/x86_64/lib_burst_generated.dll'];
const snapshot={capturedAt:new Date().toISOString(),game:'Two Point Campus',gameRoot:game,version:read(path.join(game,'version.txt')).toString().trim(),method:'IL2CPP identifier-string table only; no native method-body decompilation or runtime profiling',metadataVersion:b.readUInt32LE(4),bootConfig:read(path.join(data,'boot.config')).toString().trim(),assemblies:assemblies.filter(s=>/Burst|Jobs|Entities|Collections|RenderPipeline|Animation/.test(s)),files:selectedFiles.map(p=>path.join(game,p)).filter(p=>fs.existsSync(p)).map(fingerprint),symbolCounts:Object.fromEntries(Object.entries(symbols).map(([k,v])=>[k,v.length])),modelCounts,repoFiles:scanFiles.map(f=>({file:f,sha256:crypto.createHash('sha256').update(read(path.join(repo,f))).digest('hex')})),anchors,limits:['Names do not prove execution, frequency, algorithm, or runtime settings.','No FPS, triangle counts of Campus assets, or 1000-character benchmark was measured.','No game assets, save files, or native binaries are copied.']};
fs.mkdirSync(path.join(root,'evidence'),{recursive:true});
fs.writeFileSync(path.join(root,'evidence/local-snapshot.json'),JSON.stringify(snapshot,null,2)+'\n');
fs.writeFileSync(path.join(root,'evidence/metadata-symbols.json'),JSON.stringify(symbols,null,2)+'\n');
console.log(JSON.stringify({version:snapshot.version,metadataVersion:snapshot.metadataVersion,symbolCounts:snapshot.symbolCounts,modelCounts},null,2));
