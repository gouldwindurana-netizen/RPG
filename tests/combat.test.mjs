import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const code=fs.readFileSync(new URL('../src/combat.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(code+'\nthis.API={AveluneRPG,AVELUNE_JOBS,AVELUNE_SPELLS,AVELUNE_ITEMS};',context);
const {AveluneRPG,AVELUNE_JOBS}=context.API;
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

test('all six jobs have distinct roles, magic, and equipment caps',()=>{
  assert.equal(Object.keys(AVELUNE_JOBS).length,6);
  const r=new AveluneRPG();
  r.party[0].hp=15;r.party[0].charges=[1,0];
  const before=r.party[0].hp/r.party[0].maxHp;
  assert.equal(r.assignJob(0,'blackmage').ok,true);
  assert.ok(r.party[0].hp/r.party[0].maxHp<=before);
  assert.ok(r.party[0].spells.includes('bolt'));
  assert.equal(r.assignJob(0,'vanguard').ok,true);assert.equal(r.party[0].spells.length,0);
  assert.equal(r.assignJob(0,'whitemage').ok,true);assert.equal(r.party[0].charges[0],0);
  assert.ok(r.party[0].spells.includes('mend'));
  assert.ok(!r.party[0].spells.includes('bolt'));
  r.rest();assert.equal(r.party[0].charges[0],r.party[0].maxCharges[0]);
  r.startBattle({enemies:[foe()]});assert.equal(r.assignJob(0,'monk').ok,false);
});

test('job changes retain XP and never revive fallen heroes or replenish charges',()=>{
  const r=new AveluneRPG();r.gainXP(600);r.party[2].hp=0;
  r.party[0].charges=[0,0];r.assignJob(0,'blackmage');r.assignJob(0,'redmage');
  assert.deepEqual(Array.from(r.party[0].charges),[0,0]);
  r.assignJob(2,'vanguard');assert.equal(r.party[2].hp,0);assert.equal(r.party[2].xp,600);
});

test('job proficiency caps preserve purchased equipment and living heroes stay alive',()=>{
  const r=new AveluneRPG();r.gold=50000;
  for(let n=0;n<5;n++)assert.equal(r.upgrade(1,'armor').ok,true);
  const plateDefense=r.party[1].defense;
  r.party[1].hp=1;r.assignJob(1,'blackmage');
  assert.equal(r.party[1].hp,1);
  assert.equal(r.party[1].equipment.armor,5);
  assert.equal(r.quoteUpgrade(1,'armor').rank,2);
  assert.equal(r.quoteUpgrade(1,'armor').ownedRank,5);
  assert.equal(r.upgrade(1,'armor').ok,false);
  r.assignJob(1,'vanguard');assert.equal(r.party[1].defense,plateDefense);
  assert.equal(r.party[1].equipment.armor,5);assert.ok(r.party[1].hp>0);
});

test('tier two magic unlocks at level five and consumes the correct charge tier',()=>{
  const r=new AveluneRPG(null,{seed:1});assert.ok(!r.party[3].spells.includes('flare'));
  r.gainXP(r.xpForLevel(5));assert.ok(r.party[3].spells.includes('flare'));
  r.startBattle({enemies:[foe({hp:999,attack:1})]});
  const initial=Array.from(r.party[3].charges);
  r.resolveRound([{type:'guard'},{type:'guard'},{type:'guard'},{type:'spell',spell:'flare'}]);
  assert.equal(r.party[3].charges[0],initial[0]);assert.equal(r.party[3].charges[1],initial[1]-1);
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
  a.party[0].charges[0]=0;const hp=a.battle.enemies[0].hp;
  const result=a.resolveRound(commands);assert.equal(a.battle.enemies[0].hp,hp);
  assert.ok(result.events.some(e=>e.text.includes('no tier 1 charges')));
  assert.equal(a.party[0].charges[0],0);
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
  const r=new AveluneRPG();const gold=r.gold;
  assert.equal(r.buy('potion',-2).ok,false);assert.equal(r.gold,gold);
  assert.equal(r.buy('potion',99).ok,false);
  r.gold=50000;r.assignJob(0,'blackmage');
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
