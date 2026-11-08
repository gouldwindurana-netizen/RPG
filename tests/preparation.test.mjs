import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const context=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../src/combat.js',import.meta.url),'utf8')+'\nthis.API={AveluneRPG,AVELUNE_GEAR,AVELUNE_TOWN_SPELLS,AVELUNE_SPELLS,AVELUNE_ITEMS,AVELUNE_JOBS};',context);
const {AveluneRPG,AVELUNE_GEAR,AVELUNE_TOWN_SPELLS,AVELUNE_SPELLS,AVELUNE_ITEMS,AVELUNE_JOBS}=context.API;
const plain=value=>JSON.parse(JSON.stringify(value));
const rich=()=>{const r=new AveluneRPG(null,{seed:42});r.gold=50000;return r;};
const fight=r=>r.startBattle({enemies:[{id:'dummy',name:'Practice foe',hp:9999,attack:1,speed:1}]});
const unchanged=(r,action)=>{const before=JSON.stringify(r.snapshot());assert.equal(action().ok,false);assert.equal(JSON.stringify(r.snapshot()),before);};

test('outfitters offer complete weapon and armor tiers with usable, priced stock',()=>{
  assert.equal(Object.keys(AVELUNE_GEAR).length,30);
  for(const family of ['sword','wraps','bow','rapier','staff','rod','plate','mail','leather','robe']) {
    let previous=0;
    for(const tier of [1,2,3]) {
      const gear=AVELUNE_GEAR[family+'_'+tier];
      assert.equal(gear.tier,tier);assert.ok(gear.price>previous);previous=gear.price;
      assert.ok(gear.jobs.length&&gear.jobs.every(job=>Object.hasOwn(AVELUNE_JOBS,job)));
      assert.ok(gear.slot==='weapon'?gear.attack>0&&gear.defense===0:gear.defense>0&&gear.attack===0);
    }
  }
  assert.equal(Object.keys(AVELUNE_TOWN_SPELLS).length,8);
  for(const spell of Object.values(AVELUNE_TOWN_SPELLS)) {
    assert.ok(spell.price>0&&spell.jobs.length);assert.equal(spell.name,AVELUNE_SPELLS[spell.id].name);
  }
});

test('equipment inventory accounts for each worn copy and cannot sell or equip it twice',()=>{
  const r=rich(),gold=r.gold;
  assert.equal(r.buyGear('sword_2',2).ok,true);
  assert.equal(r.gold,gold-AVELUNE_GEAR.sword_2.price*2);
  const preview=r.quoteGear(1,'sword_2');
  assert.equal(preview.ok,true);assert.equal(preview.available,2);
  assert.equal(r.equipGear(1,'weapon','sword_2').ok,true);
  assert.equal(r.party[1].attack,preview.attack);
  assert.equal(r.equipGear(0,'weapon','sword_2').ok,true);
  assert.equal(r.quoteGear(0,'sword_2').available,0);
  unchanged(r,()=>r.sellGear('sword_2'));
  unchanged(r,()=>r.equipGear(2,'weapon','sword_2'));
  unchanged(r,()=>r.equipGear(0,'armor','sword_2'));
  assert.equal(r.equipGear(0,'weapon',null).ok,true);
  assert.equal(r.sellGear('sword_2').ok,true);
  assert.equal(r.gearOwned.sword_2,1);assert.equal(r.party[1].equippedGear.weapon,'sword_2');
  unchanged(r,()=>r.sellGear('sword_2'));
});

test('changing jobs safely returns incompatible gear without destroying owned ranks',()=>{
  const r=rich();
  for(let n=0;n<5;n++)assert.equal(r.upgrade(1,'armor').ok,true);
  r.buyGear('plate_3');r.equipGear(1,'armor','plate_3');
  const gearedDefense=r.party[1].defense;
  r.party[1].hp=1;r.assignJob(1,'blackmage');
  assert.equal(r.party[1].equippedGear.armor,null);assert.equal(r.gearOwned.plate_3,1);
  assert.equal(r.party[1].equipment.armor,5);assert.equal(r.quoteUpgrade(1,'armor').rank,2);
  assert.equal(r.quoteGear(1,'plate_3').ok,false);assert.equal(r.party[1].hp,1);
  r.assignJob(1,'vanguard');r.equipGear(1,'armor','plate_3');
  assert.equal(r.party[1].defense,gearedDefense);
});

test('bulk purchases and sales reject invalid, unaffordable and overflowing transactions atomically',()=>{
  const r=rich();
  for(const quantity of [0,-1,1.5,100,NaN,Infinity]) {
    unchanged(r,()=>r.buy('potion',quantity));unchanged(r,()=>r.sell('potion',quantity));
    unchanged(r,()=>r.buyGear('bow_1',quantity));unchanged(r,()=>r.sellGear('bow_1',quantity));
  }
  for(const id of ['__proto__','constructor','missing']) {
    unchanged(r,()=>r.buy(id));unchanged(r,()=>r.sell(id));
    unchanged(r,()=>r.buyGear(id));unchanged(r,()=>r.sellGear(id));
  }
  r.inventory.potion=98;unchanged(r,()=>r.buy('potion',2));
  r.gearOwned.bow_1=99;unchanged(r,()=>r.buyGear('bow_1'));
  const gold=r.gold;assert.equal(r.sell('potion',3).ok,true);
  assert.equal(r.inventory.potion,95);assert.equal(r.gold,gold+Math.floor(AVELUNE_ITEMS.potion.price/2)*3);
  r.gold=0;unchanged(r,()=>r.buy('ether'));unchanged(r,()=>r.buyGear('sword_3'));
});

test('field healing spends only the correct charge on a useful prepared spell',()=>{
  const r=rich(),healer=r.party[2],target=r.party[1];
  target.hp-=30;
  const charges=healer.charges[0];
  assert.equal(r.castField(2,'mend',1).ok,true);assert.equal(target.hp,target.maxHp);
  assert.equal(healer.charges[0],charges-1);
  unchanged(r,()=>r.castField(2,'mend',1));
  unchanged(r,()=>r.castField(2,'mend',99));
  unchanged(r,()=>r.castField(0,'spark',1));
  target.hp=0;unchanged(r,()=>r.castField(2,'mend',1));
  healer.hp=0;unchanged(r,()=>r.castField(2,'mend',0));
});

test('field tier II magic revives fallen allies and restores all standing allies',()=>{
  const r=rich();r.gainXP(r.xpForLevel(5));
  const healer=r.party[2],tierOne=healer.charges[0],tierTwo=healer.charges[1];
  r.party[1].hp=0;
  assert.equal(r.castField(2,'raise',1).ok,true);
  assert.equal(r.party[1].hp,Math.floor(r.party[1].maxHp/2));
  assert.equal(healer.charges[1],tierTwo-1);assert.equal(healer.charges[0],tierOne);
  unchanged(r,()=>r.castField(2,'raise',1));
  r.party[0].hp-=20;
  assert.equal(r.castField(2,'renewal').ok,true);
  assert.equal(r.party[0].hp,r.party[0].maxHp);
  assert.equal(healer.charges[1],tierTwo-2);
  r.party[0].hp-=1;unchanged(r,()=>r.castField(2,'renewal'));
});

test('inns restore standing allies while chapel revival requires an offering and further healing',()=>{
  const r=rich(),fallen=r.party[2];
  fallen.hp=0;fallen.charges=[0,0];r.party[0].hp=10;r.party[0].charges=[0,0];
  const gold=r.gold;assert.equal(r.restAtInn(12).ok,true);
  assert.equal(r.gold,gold-12);assert.equal(r.party[0].hp,r.party[0].maxHp);
  assert.equal(fallen.hp,0);assert.deepEqual(plain(fallen.charges),[0,0]);
  assert.equal(r.reviveAtClinic(2,30).ok,true);assert.equal(fallen.hp,1);
  assert.deepEqual(plain(fallen.charges),[0,0]);assert.equal(r.gold,gold-42);
  unchanged(r,()=>r.reviveAtClinic(2,30));
  assert.equal(r.restAtInn(12).ok,true);assert.equal(fallen.hp,fallen.maxHp);
  assert.deepEqual(plain(fallen.charges),plain(fallen.maxCharges));
  fallen.hp=0;r.gold=0;unchanged(r,()=>r.reviveAtClinic(2,30));
  assert.equal(r.rest(0).ok,true);assert.equal(fallen.hp,fallen.maxHp);
});

test('camping supplies require outdoor use, preserve fallen allies, and never waste full stock',()=>{
  const r=rich();r.gainXP(r.xpForLevel(5));r.buy('tent',2);r.buy('cottage');
  unchanged(r,()=>r.useFieldSupply('tent',{outdoors:true}));
  r.party[0].hp=1;r.party[0].charges=[0,0];r.party[2].hp=0;
  unchanged(r,()=>r.useFieldSupply('tent',{}));unchanged(r,()=>r.useItem(0,'tent'));
  fight(r);unchanged(r,()=>r.useFieldSupply('tent',{outdoors:true}));r.battle=null;
  assert.equal(r.useFieldSupply('tent',{outdoors:true}).ok,true);
  assert.equal(r.inventory.tent,1);assert.equal(r.party[2].hp,0);
  assert.ok(r.party[0].hp>1&&r.party[0].hp<r.party[0].maxHp);
  assert.deepEqual(plain(r.party[0].charges),[1,1]);
  assert.equal(r.useFieldSupply('cottage',{camp:true}).ok,true);
  assert.equal(r.inventory.cottage,0);assert.equal(r.party[2].hp,0);
  assert.equal(r.party[0].hp,r.party[0].maxHp);
  assert.deepEqual(plain(r.party[0].charges),plain(r.party[0].maxCharges));
  unchanged(r,()=>r.useFieldSupply('tent',{outdoors:true}));
});

test('new healing consumables restore their advertised amount with normal battle inventory checks',()=>{
  const r=rich();r.gainXP(r.xpForLevel(25));r.buy('hipotion',2);r.party[1].hp=1;
  assert.equal(r.useItem(1,'hipotion').amount,180);assert.equal(r.party[1].hp,181);
  r.party[1].hp=0;unchanged(r,()=>r.useItem(1,'hipotion'));
  r.party[1].hp=1;fight(r);
  const result=r.resolveRound([{type:'guard'},{type:'item',item:'hipotion',target:1},{type:'guard'},{type:'guard'}]);
  assert.equal(r.inventory.hipotion,0);assert.ok(result.events.some(event=>event.kind==='heal'&&event.amount===180));
});

test('magic purchases enforce job, tier and payment while preparation has three distinct slots',()=>{
  const r=rich(),hero=r.party[0];
  unchanged(r,()=>r.learnSpell(2,'comet'));unchanged(r,()=>r.learnSpell(3,'comet'));
  const gold=r.gold;hero.charges=[0,0];assert.equal(r.learnSpell(0,'gale').ok,true);
  assert.equal(r.gold,gold-AVELUNE_TOWN_SPELLS.gale.price);assert.ok(hero.learnedSpells.includes('gale'));
  assert.ok(hero.knownSpells.includes('gale'));unchanged(r,()=>r.learnSpell(0,'gale'));
  assert.equal(r.prepareSpells(0,1,['mend','gale','ward']).ok,true);
  assert.deepEqual(plain(hero.spells),['mend','gale','ward']);assert.deepEqual(plain(hero.charges),[0,0]);
  for(const ids of [['mend','mend'],['mend','gale','ward','spark'],['comet'],['raise']]) unchanged(r,()=>r.prepareSpells(0,1,ids));
  r.gainXP(r.xpForLevel(5));assert.equal(r.learnSpell(3,'comet').ok,true);
  assert.equal(r.prepareSpells(3,2,['comet']).ok,true);
  r.gold=0;unchanged(r,()=>r.learnSpell(2,'greatermend'));
});

test('learned magic, job-specific loadouts, equipment, promotion and formation survive save round trips',()=>{
  const r=rich();r.gainXP(r.xpForLevel(5));r.learnSpell(0,'gale');r.prepareSpells(0,1,['mend','gale']);
  r.assignJob(0,'blackmage');r.prepareSpells(0,1,['gale','bolt']);r.assignJob(0,'redmage');
  assert.deepEqual(plain(r.party[0].preparedSpells[1]),['mend','gale']);
  r.buyGear('rapier_2');r.equipGear(0,'weapon','rapier_2');r.promote(0,true);
  assert.equal(r.moveHero(1,0).ok,true);
  const saved=plain(r.snapshot()),restored=new AveluneRPG(saved);
  assert.deepEqual(plain(restored.snapshot()),saved);
  assert.deepEqual(plain(restored.party.map(h=>h.id)),['mara','roadkeeper','iven','sella']);
  assert.equal(restored.party[1].equippedGear.weapon,'rapier_2');assert.equal(restored.party[1].promoted,true);
  restored.assignJob(1,'blackmage');assert.deepEqual(plain(restored.party[1].preparedSpells[1]),['gale','bolt']);
  unchanged(restored,()=>restored.moveHero(0,0));unchanged(restored,()=>restored.moveHero(-1,2));
});

test('promotion requires the story milestone, level and gold and cannot refill or farm resources',()=>{
  const r=rich();unchanged(r,()=>r.promote(0,true));
  r.gainXP(r.xpForLevel(5));unchanged(r,()=>r.promote(0));unchanged(r,()=>r.promote(0,'yes'));
  const hero=r.party[0];hero.hp=17;hero.charges=[0,0];
  const ratio=hero.hp/hero.maxHp,attack=hero.attack,gold=r.gold;
  assert.equal(r.promote(0,true).ok,true);assert.equal(hero.role,'Spellblade');assert.ok(hero.attack>attack);
  assert.ok(hero.hp/hero.maxHp<=ratio);assert.deepEqual(plain(hero.charges),[0,0]);assert.equal(r.gold,gold-120);
  unchanged(r,()=>r.promote(0,true));
  r.party[2].hp=0;assert.equal(r.promote(2,true).ok,true);assert.equal(r.party[2].hp,0);
  r.gold=0;unchanged(r,()=>r.promote(1,true));
  r.assignJob(0,'vanguard');assert.equal(hero.role,'Knight');assert.equal(hero.promoted,true);
});

test('legacy and malformed saves cannot mint gear, spell licenses, duplicate copies or new supplies',()=>{
  const old=new AveluneRPG({version:1,gold:80,inventory:{potion:2,ether:1,revive:0},party:[{id:'roadkeeper',job:'redmage',equipment:{weapon:2,armor:1},hp:9,charges:[1,0]}]});
  assert.equal(old.inventory.hipotion,0);assert.equal(old.inventory.tent,0);assert.equal(old.inventory.cottage,0);
  assert.equal(old.party[0].equipment.weapon,2);assert.ok(old.party[0].spells.includes('mend'));
  const save=plain(old.snapshot());save.gearOwned.sword_1=1;
  save.party[0].equippedGear.weapon='sword_1';save.party[1].equippedGear.weapon='sword_1';
  save.party[0].learnedSpells=['gale','gale','missing','__proto__'];
  save.party[0].spellLoadouts={redmage:{1:['gale','gale','mend','ward','spark','__proto__'],2:['comet']}};
  const restored=new AveluneRPG(save);
  assert.equal(restored.party.filter(h=>h.equippedGear.weapon==='sword_1').length,1);
  assert.deepEqual(plain(restored.party[0].learnedSpells),['gale']);
  assert.deepEqual(plain(restored.party[0].preparedSpells[1]),['gale','mend','ward']);
  assert.deepEqual(plain(restored.party[0].preparedSpells[2]),[]);
  assert.equal(restored.gold,80);
});

test('all preparation transactions are disabled while a battle owns the party',()=>{
  const r=rich();r.gainXP(r.xpForLevel(5));r.buyGear('sword_1');r.buy('tent');r.party[1].hp=0;fight(r);
  for(const action of [()=>r.buy('potion'),()=>r.sell('potion'),()=>r.buyGear('bow_1'),()=>r.sellGear('sword_1'),()=>r.equipGear(0,'weapon','sword_1'),()=>r.learnSpell(0,'gale'),()=>r.prepareSpells(0,1,['mend']),()=>r.castField(0,'mend',0),()=>r.restAtInn(10),()=>r.reviveAtClinic(1,10),()=>r.moveHero(0,1),()=>r.promote(0,true),()=>r.useFieldSupply('tent',{outdoors:true})]) unchanged(r,action);
});
