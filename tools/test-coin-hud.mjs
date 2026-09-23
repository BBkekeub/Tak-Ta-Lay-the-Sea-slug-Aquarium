import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read=name=>fs.readFileSync(new URL('../js/'+name,import.meta.url),'utf8');
let label='100',writes=0;
const el={get textContent(){return label;},set textContent(v){label=v;writes++;}};
const listeners={};
const document={hidden:false,getElementById:id=>id==='hCoin'?el:null,
  addEventListener:(name,fn)=>{listeners[name]=fn;}};
const ctx=vm.createContext({G:{coin:100},START_COIN:100,document,
  console:{warn(){}},ENTRY_FEE:1,entryFeeCounts:()=>true,
  isCustomer:p=>p.customer});
vm.runInContext(read('coin-guard.js'),ctx);
const people=read('people.js');
const start=people.indexOf('    if(!p._paidEntry&&isCustomer(p)){');
const end=people.indexOf('    p.t += dt;',start);
assert.ok(start>=0&&end>start);
vm.runInContext('function enter(p){'+people.slice(start,end)+'}',ctx);
const customer={customer:true};
ctx.enter(customer);
assert.equal(ctx.G.coin,101);
assert.equal(label,'101','Entry fee appears immediately');
ctx.enter(customer);
ctx.enter({customer:false});
assert.equal(ctx.G.coin,101,'No repeated fee or merchant fee');
assert.equal(writes,1);
ctx.addCoin(-20);
assert.equal(label,'81','Spending also updates');
ctx.addCoin(NaN);
assert.equal(ctx.G.coin,81);
assert.equal(writes,2,'Unchanged balance does not write DOM');
document.hidden=true;
ctx.enter({customer:true});
assert.equal(ctx.G.coin,82);
assert.equal(label,'81','Hidden income does not render');
document.hidden=false;
listeners.visibilitychange();
assert.equal(label,'82','Returning to tab refreshes balance');
ctx.G.coin=9999;
assert.equal(ctx.G.coin,82,'Guard still rejects direct writes');
vm.runInContext('CoinGuard.load("",{coin:250},null);CoinGuard.lock();syncCoinHUD()',ctx);
assert.equal(label,'250','Loaded balance renders');
vm.runInContext('CoinGuard.load("",{coin:9999},null)',ctx);
assert.equal(ctx.G.coin,250,'Loading remains locked after boot');
console.log('PASS: entry income, repeat entry, merchant, spending, invalid delta, hidden tab, loaded balance and coin guard');
