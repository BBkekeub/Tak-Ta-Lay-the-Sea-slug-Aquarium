import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const read=n=>fs.readFileSync(new URL('js/slug-'+n+'.js',root),'utf8');
const tug=read('tug');
const settle=tug.slice(tug.indexOf(' function settle(won){'),tug.indexOf(' function complete(){'));
let cases=0;
for(const size of [1,2,3])for(const won of [false,true])for(const mode of ['normal','practice','tour']){
 const active={rope:0,settled:false,entry:300*size,prizePot:500*size,me:{bot:true},practice:mode==='practice',tour:mode==='tour'};
 const ctx=vm.createContext({state:{active},WIN:150,ENTRY:300,PRIZE:500,coin:5000,
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),saveGame(){},syncHUD(){},setTimeout(){}});
 vm.runInContext('function addCoin(n){coin+=n;}'+settle,ctx);
 assert.equal(ctx.coin,5000);
 vm.runInContext(`settle(${won})`,ctx);
 const expected=mode==='normal'?(won?500*size:-300*size):0;
 assert.equal(ctx.coin,5000+expected,`${size} ${won} ${mode}`);
 // Saving/reloading a finished match must not apply the payment again.
 ctx.state.active=JSON.parse(JSON.stringify(ctx.state.active));
 vm.runInContext(`settle(${won});settle(${won})`,ctx);
 assert.equal(ctx.coin,5000+expected);cases++;
}
const start=tug.slice(tug.indexOf('   start.onclick=()=>{'),tug.indexOf('   drawCards();refresh();'));
assert.ok(start.includes('state.active=')&&!start.includes('addCoin('),'No debit when accepting tug challenge');
for(const name of ['race','tug']){
 const src=read(name),at=src.indexOf(' function tourRegister(mailId){');
 assert.ok(at>=0&&src.slice(at,at+650).includes('addCoin(-TOUR_ENTRY)'),'Tournament registration still charges '+name);
}
for(const name of ['race','eat','throw','sumo']){
 const src=read(name);
 assert.ok(!/addCoin\(\s*-\s*wager\s*\)/.test(src),'No up-front wager debit: '+name);
 assert.ok(src.includes('addCoin(a.delta)'),'Settlement handles net winnings/losses: '+name);
}
console.log(JSON.stringify({passed:true,settlementCases:cases,repeatAndReload:true,tournamentUpfront:true}));
