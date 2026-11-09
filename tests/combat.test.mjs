import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const code=fs.readFileSync(new URL('../src/combat.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(code+'\nthis.API={AveluneRPG,AVELUNE_JOBS,AVELUNE_SPELLS,AVELUNE_ITEMS};',context);
const {AveluneRPG,AVELUNE_JOBS,AVELUNE_SPELLS}=context.API;
const foe=(overrides={})=>({id:'test',name:'Test foe',hp:30,attack:8,defense:2,speed:6,xp:20,gold:15,...overrides});
const attacks=()=>[0,1,2,3].map(()=>({type:'attack',target:0}));

test('victory awards once and all party members gain shared experience',()=>{
  const r=new AveluneRPG(null,{seed:1}),gold=r.gold;
  r.startBattle({enemies:[foe({hp:1,xp:40})]});
  const round=r.resolveRound(attacks());
  assert.equal(round.outcome,'victory');
  assert.equal(r.gold,gold);
  const reward=r.finishBattle();
  assert.equal(reward.xp,40);assert.equal(r.gold,gold+15);assert.equal(r.level,2);
  assert.ok(r.party.every(h=>h.level===2&&h.xp===40));
  assert.equal(r.finishBattle().ok,false);assert.equal(r.gold,gold+15);
});

test('all six jobs can be selected before the journey with distinct magic and equipment',()=>{
  assert.equal(Object.keys(AVELUNE_JOBS).length,6);
  for(const id of Object.keys(AVELUNE_JOBS)){
    const r=new AveluneRPG(null,{jobs:[id,'vanguard','whitemage','blackmage']});
    assert.equal(r.party[0].job,id);assert.equal(r.jobsLocked,true);
    assert.equal(r.party[0].maxMp>0,['redmage','whitemage','blackmage'].includes(id));
    assert.equal(r.party[0].mp,r.party[0].maxMp);
    assert.equal('charges' in r.party[0],false);
    assert.equal(r.party[0].role,AVELUNE_JOBS[id].name);
  }
});

test('jobs remain locked after creation, battle, rest and loading without resource changes',()=>{
  const r=new AveluneRPG(null,{jobs:['monk','ranger','blackmage','whitemage']});r.gainXP(600);r.party[2].hp=0;r.party[3].mp=0;
  const before=JSON.stringify(r.snapshot());
  for(const job of ['vanguard','__proto__','whitemage'])assert.equal(r.assignJob(0,job).ok,false);
  assert.equal(JSON.stringify(r.snapshot()),before);
  const restored=new AveluneRPG(r.snapshot(),{jobs:['vanguard','vanguard','vanguard','vanguard']});
  assert.equal(restored.party[0].job,'monk');assert.equal(restored.party[2].hp,0);assert.equal(restored.party[3].mp,0);
  restored.rest();assert.equal(restored.assignJob(0,'vanguard').ok,false);
  restored.startBattle({enemies:[foe()]});assert.equal(restored.assignJob(0,'vanguard').ok,false);
});

test('fixed job proficiency caps preserve owned ranks without permitting an upgrade past the cap',()=>{
  const r=new AveluneRPG({party:[{id:'mara',job:'blackmage',hp:1,equipment:{armor:5}}]});r.gold=50000;
  const hero=r.party.find(h=>h.id==='mara'),index=r.party.indexOf(hero);
  assert.equal(hero.equipment.armor,5);assert.equal(r.quoteUpgrade(index,'armor').rank,2);
  assert.equal(r.quoteUpgrade(index,'armor').ownedRank,5);assert.equal(r.upgrade(index,'armor').ok,false);
  assert.equal(hero.hp,1);assert.equal(r.assignJob(index,'vanguard').ok,false);
});

test('advanced magic unlocks at level five and every spell spends the same MP pool',()=>{
  const r=new AveluneRPG(null,{seed:1});assert.ok(!r.party[3].spells.includes('flare'));
  r.gainXP(r.xpForLevel(5));assert.ok(r.party[3].spells.includes('flare'));
  r.startBattle({enemies:[foe({hp:999,attack:1})]});
  const initial=r.party[3].mp;
  r.resolveRound([{type:'guard'},{type:'guard'},{type:'guard'},{type:'spell',spell:'flare'}]);
  assert.equal(r.party[3].mp,initial-AVELUNE_SPELLS.flare.mpCost);
  r.resolveRound([{type:'guard'},{type:'guard'},{type:'guard'},{type:'spell',spell:'bolt'}]);
  assert.equal(r.party[3].mp,initial-AVELUNE_SPELLS.flare.mpCost-AVELUNE_SPELLS.bolt.mpCost);
});

test('weakness amplifies magic and depleted spells cannot deal free damage',()=>{
  const make=(weakness)=>{
    const r=new AveluneRPG(null,{seed:22});
    r.startBattle({enemies:[foe({hp:999,attack:1,weakness})]});
    return r;
  };
  const a=make('ember'),b=make('frost');
  const commands=[{type:'spell',spell:'spark',target:0},{type:'guard'},{type:'guard'},{type:'guard'}];
  a.resolveRound(commands);b.resolveRound(commands);
  assert.ok(a.battle.enemies[0].hp<b.battle.enemies[0].hp);
  a.party[0].mp=0;const hp=a.battle.enemies[0].hp;
  const result=a.resolveRound(commands);assert.equal(a.battle.enemies[0].hp,hp);
  assert.ok(result.events.some(e=>e.text.includes('needs 4 MP')));
  assert.equal(a.party[0].mp,0);
});

test('shared item stock is validated when commands resolve',()=>{
  const r=new AveluneRPG(null,{seed:4});r.inventory.potion=1;
  r.party.forEach(h=>h.hp=10);
  r.startBattle({enemies:[foe({hp:999,attack:1})]});
  const result=r.resolveRound([0,1,2,3].map(target=>({type:'item',item:'potion',target})));
  assert.equal(r.inventory.potion,0);
  assert.equal(result.events.filter(e=>e.kind==='heal').length,1);
  assert.ok(result.events.filter(e=>e.text.includes('No Potion')).length>=2);
});

test('retargeting prevents attacks from being wasted on defeated foes',()=>{
  const r=new AveluneRPG(null,{seed:1});
  r.startBattle({enemies:[foe({id:'one',hp:1}),foe({id:'two',hp:1})]});
  assert.equal(r.resolveRound(attacks()).outcome,'victory');
});

test('guard protects from the beginning of a round, even against faster enemies',()=>{
  const make=()=>{const r=new AveluneRPG(null,{seed:9});r.party.forEach((h,i)=>{if(i>0)h.hp=0;});r.startBattle({enemies:[foe({hp:999,attack:15,speed:99})]});return r;};
  const a=make(),b=make();
  a.resolveRound([{type:'guard'}]);b.resolveRound([{type:'attack'}]);
  assert.ok(a.party[0].hp>b.party[0].hp);
});

test('heavy attacks are telegraphed one round in advance',()=>{
  const r=new AveluneRPG(null,{seed:5});r.startBattle({enemies:[foe({hp:9999,attack:1})]});
  r.resolveRound(attacks());const round=r.resolveRound(attacks());
  assert.equal(r.battle.round,3);assert.equal(r.battle.enemies[0].intent,'Heavy strike');
  assert.ok(round.events.some(e=>e.kind==='telegraph'));
  assert.ok(r.resolveRound(attacks()).events.some(e=>e.heavy));
});

test('bosses cannot be fled and defeats recover a viable party',()=>{
  const r=new AveluneRPG(null,{seed:3});r.startBattle({boss:true,enemies:[foe({hp:99999,attack:999,speed:999})]});
  r.resolveRound([0,1,2,3].map(()=>({type:'flee'})));
  assert.notEqual(r.battle.outcome,'fled');
  for(let i=0;i<10&&!r.battle.outcome;i++)r.resolveRound(attacks());
  assert.equal(r.battle.outcome,'defeat');
  const gold=r.gold,result=r.finishBattle();
  assert.equal(result.outcome,'defeat');assert.ok(r.party.every(h=>h.hp===h.maxHp));
  assert.ok(r.gold<gold);assert.equal(r.battle,null);
});

test('purchases, equipment caps, revival and invalid values are enforced',()=>{
  const r=new AveluneRPG(null,{jobs:['blackmage','vanguard','whitemage','redmage']});const gold=r.gold;
  assert.equal(r.buy('potion',-2).ok,false);assert.equal(r.gold,gold);
  assert.equal(r.buy('potion',99).ok,false);
  r.gold=50000;
  for(let n=0;n<3;n++)assert.equal(r.upgrade(0,'weapon').ok,true);
  assert.equal(r.upgrade(0,'weapon').ok,false);assert.equal(r.party[0].equipment.weapon,3);
  r.party[1].hp=0;const count=r.inventory.potion;
  assert.equal(r.useItem(1,'potion').ok,false);assert.equal(r.inventory.potion,count);
  assert.equal(r.useItem(1,'revive').ok,true);assert.ok(r.party[1].hp>0);
  assert.equal(r.rest(-100).ok,false);
});

test('saved data is validated, derived stats are rebuilt, and completed rewards persist',()=>{
  const r=new AveluneRPG({xp:NaN,gold:-2,inventory:{potion:-1,ether:999},party:[{id:'roadkeeper',job:'__proto__',hp:Infinity,attack:99999,equipment:{weapon:99,armor:-4}}],campaignRewards:['mailbag',null,3]});
  assert.equal(r.level,1);assert.equal(r.gold,0);assert.equal(r.inventory.potion,0);assert.equal(r.inventory.ether,99);
  assert.equal(r.party[0].job,'redmage');assert.ok(r.party[0].attack<100);assert.ok(Number.isFinite(r.party[0].hp));
  assert.equal(r.party[0].equipment.armor,0);assert.equal(r.campaignRewards.size,1);
  const restored=new AveluneRPG(r.snapshot());assert.equal(restored.campaignRewards.has('mailbag'),true);
  assert.equal(restored.party[0].job,'redmage');assert.equal(restored.gold,0);
});

test('identical seeds and commands produce identical combat outcomes',()=>{
  const a=new AveluneRPG(null,{seed:1234}),b=new AveluneRPG(null,{seed:1234});
  a.startBattle({enemies:[foe({hp:200})]});b.startBattle({enemies:[foe({hp:200})]});
  assert.equal(JSON.stringify(a.resolveRound(attacks())),JSON.stringify(b.resolveRound(attacks())));
});

test('mana migration conserves exhausted legacy charges and clamps malformed new values',()=>{
  const old=new AveluneRPG({version:1,party:[{id:'roadkeeper',job:'redmage',charges:[1,0]},{id:'iven',job:'whitemage',charges:[0,0]}]});
  assert.equal(old.party.find(h=>h.id==='roadkeeper').mp,8);
  assert.equal(old.party.find(h=>h.id==='iven').mp,0);
  const saved=JSON.parse(JSON.stringify(old.snapshot()));assert.equal(saved.version,2);assert.equal(saved.jobsLocked,true);
  assert.ok(saved.party.every(h=>!Object.hasOwn(h,'charges')));
  saved.party[0].mp=99999;saved.party[1].mp=-10;
  const restored=new AveluneRPG(saved);assert.equal(restored.party[0].mp,restored.party[0].maxMp);assert.equal(restored.party[1].mp,0);
});

test('multi-target spells spend mana once and Ether reports mana separately from health',()=>{
  const r=new AveluneRPG(null,{seed:4});r.gainXP(r.xpForLevel(5));r.startBattle({enemies:[foe({id:'a',hp:999,attack:1}),foe({id:'b',hp:999,attack:1})]});
  const mp=r.party[3].mp;
  const turn=r.resolveRound([{type:'guard'},{type:'guard'},{type:'guard'},{type:'spell',spell:'flare'}]);
  assert.equal(r.party[3].mp,mp-AVELUNE_SPELLS.flare.mpCost);
  assert.equal(turn.events.filter(e=>e.actor==='sella').reduce((sum,e)=>sum+(e.mpCost||0),0),AVELUNE_SPELLS.flare.mpCost);
  r.party[3].mp=0;const hp=r.party[3].hp;
  const ether=r.resolveRound([{type:'guard'},{type:'guard'},{type:'guard'},{type:'item',item:'ether',target:3}]);
  assert.equal(r.party[3].mp,24);assert.ok(r.party[3].hp<=hp);
  assert.ok(ether.events.some(e=>e.resource==='mp'&&e.amount===24));
});

test('sparse legacy saves never copy another named hero’s job or mana into a missing party slot',()=>{
  const r=new AveluneRPG({version:1,party:[{id:'roadkeeper',job:'redmage',charges:[1,0]},{id:'iven',job:'whitemage',charges:[0,0]}]});
  const mara=r.party.find(h=>h.id==='mara'),iven=r.party.find(h=>h.id==='iven');
  assert.equal(mara.job,'vanguard');assert.equal(mara.mp,0);assert.equal(iven.job,'whitemage');assert.equal(iven.mp,0);
});

test('a rejected battle healing or revival command spends no mana',()=>{
  const r=new AveluneRPG(null,{seed:4});r.gainXP(r.xpForLevel(5));
  r.startBattle({enemies:[foe({hp:9999,attack:1,speed:0})]});
  const mp=r.party[2].mp;
  const heal=r.resolveRound([{type:'guard'},{type:'guard'},{type:'spell',spell:'mend',target:1},{type:'guard'}]);
  assert.ok(heal.events.some(e=>e.kind==='miss'&&e.actor==='iven'));assert.equal(r.party[2].mp,mp);
  const revive=r.resolveRound([{type:'guard'},{type:'guard'},{type:'spell',spell:'raise',target:1},{type:'guard'}]);
  assert.ok(revive.events.some(e=>e.kind==='miss'&&e.actor==='iven'));assert.equal(r.party[2].mp,mp);
});
