import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const context=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../src/item-catalog.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../src/combat.js',import.meta.url),'utf8')+'\nthis.API={AveluneRPG,AVELUNE_GEAR,AVELUNE_TOWN_SPELLS,AVELUNE_SPELLS,AVELUNE_ITEMS,AVELUNE_JOBS};',context);
const {AveluneRPG,AVELUNE_GEAR,AVELUNE_TOWN_SPELLS,AVELUNE_SPELLS,AVELUNE_ITEMS,AVELUNE_JOBS}=context.API;
const plain=value=>JSON.parse(JSON.stringify(value));
const rich=()=>{const r=new AveluneRPG(null,{fullParty:true,seed:42});r.gold=50000;return r;};
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
  assert.equal(Object.keys(AVELUNE_TOWN_SPELLS).length,12);
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

test('fixed jobs retain their equipment and reject later retraining without altering resources',()=>{
  const r=rich();
  for(let n=0;n<5;n++)assert.equal(r.upgrade(1,'armor').ok,true);
  r.buyGear('plate_3');r.equipGear(1,'armor','plate_3');r.party[1].hp=1;
  const gearedDefense=r.party[1].defense;
  unchanged(r,()=>r.assignJob(1,'blackmage'));
  assert.equal(r.party[1].job,'vanguard');assert.equal(r.party[1].equippedGear.armor,'plate_3');
  assert.equal(r.gearOwned.plate_3,1);assert.equal(r.party[1].equipment.armor,5);
  assert.equal(r.party[1].defense,gearedDefense);assert.equal(r.party[1].hp,1);
  unchanged(r,()=>r.equipGear(3,'armor','plate_3'));
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

test('field healing spends its MP cost only on a useful prepared spell',()=>{
  const r=rich(),healer=r.party[2],target=r.party[1];
  target.hp-=30;
  const mp=healer.mp;
  assert.equal(r.castField(2,'mend',1).ok,true);assert.equal(target.hp,target.maxHp);
  assert.equal(healer.mp,mp-AVELUNE_SPELLS.mend.mpCost);
  unchanged(r,()=>r.castField(2,'mend',1));unchanged(r,()=>r.castField(2,'mend',99));
  unchanged(r,()=>r.castField(0,'spark',1));
  target.hp=0;unchanged(r,()=>r.castField(2,'mend',1));
  healer.hp=0;unchanged(r,()=>r.castField(2,'mend',0));
  healer.hp=1;healer.mp=AVELUNE_SPELLS.mend.mpCost-1;target.hp=1;
  unchanged(r,()=>r.castField(2,'mend',1));
});

test('field revival and party healing share one MP pool and reject insufficient mana',()=>{
  const r=rich();r.gainXP(r.xpForLevel(5));
  const healer=r.party[2],mp=healer.mp;r.party[1].hp=0;
  assert.equal(r.castField(2,'raise',1).ok,true);
  assert.equal(r.party[1].hp,Math.floor(r.party[1].maxHp/2));
  assert.equal(healer.mp,mp-AVELUNE_SPELLS.raise.mpCost);
  unchanged(r,()=>r.castField(2,'raise',1));
  r.party[0].hp-=20;r.party[3].hp-=10;
  assert.equal(r.castField(2,'renewal').ok,true);
  assert.equal(r.party[0].hp,r.party[0].maxHp);assert.equal(r.party[3].hp,r.party[3].maxHp);
  assert.equal(healer.mp,mp-AVELUNE_SPELLS.raise.mpCost-AVELUNE_SPELLS.renewal.mpCost);
  healer.mp=AVELUNE_SPELLS.renewal.mpCost-1;r.party[0].hp-=1;
  unchanged(r,()=>r.castField(2,'renewal'));
});

test('inns restore living allies MP while paid revival preserves depleted mana',()=>{
  const r=rich(),fallen=r.party[2];
  fallen.hp=0;fallen.mp=0;r.party[0].hp=10;r.party[0].mp=0;
  const gold=r.gold;assert.equal(r.restAtInn(12).ok,true);
  assert.equal(r.gold,gold-12);assert.equal(r.party[0].hp,r.party[0].maxHp);
  assert.equal(r.party[0].mp,r.party[0].maxMp);assert.equal(fallen.hp,0);assert.equal(fallen.mp,0);
  assert.equal(r.reviveAtClinic(2,30).ok,true);assert.equal(fallen.hp,1);assert.equal(fallen.mp,0);assert.equal(r.gold,gold-42);
  unchanged(r,()=>r.reviveAtClinic(2,30));
  assert.equal(r.restAtInn(12).ok,true);assert.equal(fallen.hp,fallen.maxHp);assert.equal(fallen.mp,fallen.maxMp);
  unchanged(r,()=>r.restAtInn(12));
  fallen.hp=0;r.gold=0;unchanged(r,()=>r.reviveAtClinic(2,30));
});

test('camping supplies restore bounded HP and MP, preserve fallen allies, and never waste stock',()=>{
  const r=rich();r.gainXP(r.xpForLevel(5));r.buy('tent',2);r.buy('cottage');
  unchanged(r,()=>r.useFieldSupply('tent',{outdoors:true}));
  r.party[0].hp=1;r.party[0].mp=0;r.party[2].hp=0;r.party[2].mp=0;
  unchanged(r,()=>r.useFieldSupply('tent',{}));unchanged(r,()=>r.useItem(0,'tent'));
  fight(r);unchanged(r,()=>r.useFieldSupply('tent',{outdoors:true}));r.battle=null;
  assert.equal(r.useFieldSupply('tent',{outdoors:true}).ok,true);
  assert.equal(r.inventory.tent,1);assert.equal(r.party[2].hp,0);assert.equal(r.party[2].mp,0);
  assert.ok(r.party[0].hp>1&&r.party[0].hp<r.party[0].maxHp);
  assert.equal(r.party[0].mp,Math.ceil(r.party[0].maxMp/4));
  assert.equal(r.useFieldSupply('cottage',{camp:true}).ok,true);
  assert.equal(r.inventory.cottage,0);assert.equal(r.party[2].hp,0);assert.equal(r.party[0].hp,r.party[0].maxHp);
  assert.equal(r.party[0].mp,r.party[0].maxMp);unchanged(r,()=>r.useFieldSupply('tent',{outdoors:true}));
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
  const gold=r.gold;hero.mp=0;assert.equal(r.learnSpell(0,'gale').ok,true);
  assert.equal(r.gold,gold-AVELUNE_TOWN_SPELLS.gale.price);assert.ok(hero.learnedSpells.includes('gale'));
  assert.ok(hero.knownSpells.includes('gale'));unchanged(r,()=>r.learnSpell(0,'gale'));
  assert.equal(r.prepareSpells(0,1,['mend','gale','ward']).ok,true);
  assert.deepEqual(plain(hero.spells),['mend','gale','ward']);assert.equal(hero.mp,0);
  for(const ids of [['mend','mend'],['mend','gale','ward','spark'],['comet'],['raise']]) unchanged(r,()=>r.prepareSpells(0,1,ids));
  r.gainXP(r.xpForLevel(5));assert.equal(r.learnSpell(3,'comet').ok,true);
  assert.equal(r.prepareSpells(3,2,['comet']).ok,true);
  r.gold=0;unchanged(r,()=>r.upgradeSpell(2,'mend'));
});

test('fixed jobs, mana, learned spells, equipment, promotion and formation survive save round trips',()=>{
  const r=rich();r.gainXP(r.xpForLevel(5));r.learnSpell(0,'gale');r.prepareSpells(0,1,['mend','gale']);
  unchanged(r,()=>r.assignJob(0,'blackmage'));assert.deepEqual(plain(r.party[0].preparedSpells[1]),['mend','gale']);
  r.buyGear('rapier_2');r.equipGear(0,'weapon','rapier_2');r.promote(0,true);r.party[0].mp=7;
  assert.equal(r.moveHero(1,0).ok,true);
  const saved=plain(r.snapshot()),restored=new AveluneRPG(saved);
  assert.deepEqual(plain(restored.snapshot()),saved);
  assert.deepEqual(plain(restored.party.map(h=>h.id)),['mara','roadkeeper','iven','sella']);
  assert.equal(restored.party[1].equippedGear.weapon,'rapier_2');assert.equal(restored.party[1].promoted,true);
  assert.equal(restored.party[1].job,'redmage');assert.equal(restored.party[1].mp,7);assert.equal(restored.jobsLocked,true);
  unchanged(restored,()=>restored.assignJob(1,'blackmage'));
  unchanged(restored,()=>restored.moveHero(0,0));unchanged(restored,()=>restored.moveHero(-1,2));
});

test('promotion requires the story milestone, level and gold and cannot refill or farm resources',()=>{
  const r=rich();unchanged(r,()=>r.promote(0,true));
  r.gainXP(r.xpForLevel(5));unchanged(r,()=>r.promote(0));unchanged(r,()=>r.promote(0,'yes'));
  const hero=r.party[0];hero.hp=17;hero.mp=0;
  const ratio=hero.hp/hero.maxHp,attack=hero.attack,gold=r.gold;
  assert.equal(r.promote(0,true).ok,true);assert.equal(hero.role,'Spellblade');assert.ok(hero.attack>attack);
  assert.ok(hero.hp/hero.maxHp<=ratio);assert.equal(hero.mp,0);assert.equal(r.gold,gold-120);
  unchanged(r,()=>r.promote(0,true));
  r.party[2].hp=0;assert.equal(r.promote(2,true).ok,true);assert.equal(r.party[2].hp,0);
  r.gold=0;unchanged(r,()=>r.promote(1,true));
  unchanged(r,()=>r.assignJob(0,'vanguard'));assert.equal(hero.role,'Spellblade');assert.equal(hero.promoted,true);
});

test('legacy and malformed saves cannot mint gear, spell licenses, duplicate copies or new supplies',()=>{
  const old=new AveluneRPG({version:1,gold:80,inventory:{potion:2,ether:1,revive:0},party:[{id:'roadkeeper',job:'redmage',equipment:{weapon:2,armor:1},hp:9,charges:[1,0]}]});
  assert.equal(old.inventory.hipotion,0);assert.equal(old.inventory.tent,0);assert.equal(old.inventory.cottage,0);
  assert.equal(old.party[0].equipment.weapon,2);assert.ok(old.party[0].spells.includes('mend'));
  old.recruit('mara');const save=plain(old.snapshot());save.gearOwned.sword_1=1;
  save.roster.find(h=>h.id==='roadkeeper').equippedGear.weapon='sword_1';save.roster.find(h=>h.id==='mara').equippedGear.weapon='sword_1';
  save.roster[0].learnedSpells=['gale','gale','missing','__proto__'];
  save.roster[0].spellLoadouts={redmage:{1:['gale','gale','mend','ward','spark','__proto__'],2:['comet']}};
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

test('Ether restores capped mana only for a living caster and never consumes stock on invalid recovery',()=>{
  const r=rich(),caster=r.party[0];
  unchanged(r,()=>r.useItem(0,'ether'));unchanged(r,()=>r.useItem(1,'ether'));
  caster.mp=caster.maxMp-5;const count=r.inventory.ether;
  assert.equal(r.useItem(0,'ether').amount,5);assert.equal(caster.mp,caster.maxMp);assert.equal(r.inventory.ether,count-1);
  caster.hp=0;caster.mp=0;unchanged(r,()=>r.useItem(0,'ether'));
  caster.hp=1;caster.mp=0;assert.equal(r.useItem(0,'ether').amount,24);assert.equal(caster.mp,24);
});

test('level growth expands mana without refilling spent reserves or reviving fallen allies',()=>{
  const r=rich(),caster=r.party[0],fallen=r.party[2];caster.mp=0;fallen.hp=0;fallen.mp=0;
  const before=caster.maxMp;r.gainXP(r.xpForLevel(2));
  assert.equal(caster.mp,caster.maxMp-before);assert.ok(caster.mp<caster.maxMp);
  assert.equal(fallen.hp,0);assert.equal(fallen.mp,0);assert.equal(r.party[1].maxMp,0);
});

test('spell family ranks have level and payment gates, replace one family entry and cap at III',()=>{
  const r=rich(),h=r.party[3];const start=r.spellFor(h,'bolt');assert.equal(start.name,'Bolt I');
  unchanged(r,()=>r.upgradeSpell(3,'bolt'));
  r.gainXP(r.xpForLevel(5));h.mp=3;const gold=r.gold,q=r.quoteSpellUpgrade(3,'bolt');
  assert.equal(q.nextRank,2);assert.equal(q.levelRequired,5);assert.equal(q.nextSpell.name,'Bolt II');assert.equal(r.upgradeSpell(3,'bolt').ok,true);assert.equal(r.gold,gold-q.cost);assert.equal(h.mp,3);
  assert.equal(r.spellFor(h,'bolt').target,'allEnemies');assert.equal(h.spells.filter(id=>id==='bolt').length,1);unchanged(r,()=>r.upgradeSpell(3,'bolt'));
  r.gainXP(r.xpForLevel(12));r.gold=0;unchanged(r,()=>r.upgradeSpell(3,'bolt'));r.gold=5000;assert.equal(r.upgradeSpell(3,'bolt').ok,true);assert.equal(r.spellFor(h,'bolt').name,'Bolt III');unchanged(r,()=>r.upgradeSpell(3,'bolt'));
  unchanged(r,()=>r.upgradeSpell(2,'ward'));assert.equal(r.spellFor(2,'ward').rankMax,1);
});

test('old overlapping spells migrate into one upgraded family while unique utilities stay separate',()=>{
  const r=new AveluneRPG({version:2,xp:18*11*12,party:[{id:'roadkeeper',job:'redmage',learnedSpells:['salve','greatermend','gale','tempest'],spellLoadouts:{redmage:{1:['mend','salve','greatermend'],2:['tempest']}}}]});
  const h=r.party[0];assert.equal(r.spellFor(h,'mend').name,'Mend III');assert.equal(r.spellFor(h,'gale').name,'Gale II');
  assert.equal(h.learnedSpells.filter(id=>id==='mend').length,1);assert.equal(h.spells.filter(id=>id==='mend').length,1);assert.ok(h.spells.every(id=>!AVELUNE_SPELLS[id].legacy));
  const full=rich();full.gainXP(full.xpForLevel(5));assert.ok(full.party[2].spells.includes('renewal'));assert.ok(full.party[2].spells.includes('raise'));
});
