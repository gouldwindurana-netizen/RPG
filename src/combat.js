/*
 * Avelune combat and party model. No renderer or browser globals are required.
 * Global API: AveluneRPG, AVELUNE_JOBS, AVELUNE_SPELLS, AVELUNE_ITEMS,
 * AVELUNE_GEAR, AVELUNE_TOWN_SPELLS.
 * Commands: {type:'attack'|'guard'|'spell'|'item'|'flee',target:index,spell:id,item:id}.
 * One command per party slot is collected before resolveRound(commands).
 * startBattle(spec) -> {ok,battle}; resolveRound -> {events,outcome,round,rewards}.
 * finishBattle() pays rewards once, clears battle, and returns a summary.
 * Save only outside a battle: snapshot intentionally contains no encounter state.
 * Jobs can change outside combat. The caller restricts retraining to safe towns.
 * Retraining retains level/XP and rounds HP/charge ratios down; it never refills them.
 */
const AVELUNE_SPELLS = Object.freeze({
  spark: {name:'Ember',description:'A focused flame. Strong against ember-weak foes.',tier:1,target:'enemy',kind:'damage',element:'ember',power:26},
  frost: {name:'Frost',description:'A shard of winter. Strong against frost-weak foes.',tier:1,target:'enemy',kind:'damage',element:'frost',power:26},
  bolt: {name:'Bolt',description:'A crack of lightning. Strong against bolt-weak foes.',tier:1,target:'enemy',kind:'damage',element:'bolt',power:26},
  smite: {name:'Starlight',description:'A ray of the seven stars strikes one foe.',tier:1,target:'enemy',kind:'damage',element:'starlight',power:23},
  mend: {name:'Mend',description:'Restore one living ally’s HP.',tier:1,target:'ally',kind:'heal',power:32},
  ward: {name:'Ward',description:'Reduce damage to the party for the rest of this round.',tier:1,target:'allAllies',kind:'ward',power:0},
  flare: {name:'Emberstorm',description:'Flames strike every foe.',tier:2,target:'allEnemies',kind:'damage',element:'ember',power:35},
  tempest: {name:'Tempest',description:'Gale winds strike every foe.',tier:2,target:'allEnemies',kind:'damage',element:'gale',power:33},
  deluge: {name:'Deluge',description:'A tide strikes every foe.',tier:2,target:'allEnemies',kind:'damage',element:'tide',power:33},
  quake: {name:'Quake',description:'Stone and earth strike every foe.',tier:2,target:'allEnemies',kind:'damage',element:'stone',power:33},
  renewal: {name:'Renewal',description:'Restore HP to every living ally.',tier:2,target:'allAllies',kind:'heal',power:30},
  raise: {name:'Rekindle',description:'Revive one fallen ally at half HP.',tier:2,target:'ally',kind:'revive',power:0},
  salve: {name:'Salve',description:'Restore more HP to one living ally.',tier:1,target:'ally',kind:'heal',power:55},
  halo: {name:'Halo',description:'Starlight strikes every foe.',tier:1,target:'allEnemies',kind:'damage',element:'starlight',power:18},
  gale: {name:'Gale',description:'A cutting wind strikes one foe.',tier:1,target:'enemy',kind:'damage',element:'gale',power:26},
  stone: {name:'Stone',description:'A shard of earth strikes one foe.',tier:1,target:'enemy',kind:'damage',element:'stone',power:26},
  greatermend: {name:'Greater Mend',description:'Restore a great deal of HP to one living ally.',tier:2,target:'ally',kind:'heal',power:130},
  sunburst: {name:'Sunburst',description:'Brilliant starlight strikes every foe.',tier:2,target:'allEnemies',kind:'damage',element:'starlight',power:42},
  comet: {name:'Comet',description:'A powerful aether strike against one foe.',tier:2,target:'enemy',kind:'damage',element:'aether',power:100},
  shelter: {name:'Shelter',description:'Spend a tier II charge to protect the party this round.',tier:2,target:'allAllies',kind:'ward',power:0},
});

const AVELUNE_JOBS = Object.freeze({
  vanguard: {id:'vanguard',name:'Vanguard',description:'Heavy armor and reliable strength. The front rank draws attacks.',color:'#d59b66',hp:52,hpGrowth:10,attack:13,attackGrowth:2.4,defense:5,defenseGrowth:1.2,speed:7,speedGrowth:.25,weapon:'Sword',armor:'Plate',weaponCap:5,armorCap:5,spells:[],passive:'Iron guard: guarding reduces damage by 65%.'},
  monk: {id:'monk',name:'Monk',description:'An unarmed striker whose fists grow with experience.',color:'#d2ab75',hp:46,hpGrowth:9,attack:12,attackGrowth:2.8,defense:2,defenseGrowth:.8,speed:10,speedGrowth:.4,weapon:'Handwraps',armor:'Cloth',weaponCap:3,armorCap:2,spells:[],passive:'Focused strike: critical hits deal double damage.'},
  ranger: {id:'ranger',name:'Ranger',description:'A quick scout with a high critical rate and reliable escapes.',color:'#9ebd7b',hp:40,hpGrowth:8,attack:10,attackGrowth:2.3,defense:3,defenseGrowth:.9,speed:13,speedGrowth:.5,weapon:'Bow',armor:'Leather',weaponCap:5,armorCap:3,spells:[],passive:'Keen eye: 18% critical chance; improves party escape odds.'},
  redmage: {id:'redmage',name:'Red Mage',description:'A versatile sword bearer with healing and elemental magic.',color:'#d77c85',hp:40,hpGrowth:8,attack:9,attackGrowth:2,defense:3,defenseGrowth:.9,speed:9,speedGrowth:.35,weapon:'Rapier',armor:'Mail',weaponCap:4,armorCap:4,spells:['spark','frost','bolt','mend','ward','tempest','deluge'],passive:'Versatile: combines martial equipment with both schools of magic.'},
  whitemage: {id:'whitemage',name:'White Mage',description:'A healer who restores allies and calls down starlight.',color:'#e9d9b4',hp:34,hpGrowth:7,attack:6,attackGrowth:1.8,defense:2,defenseGrowth:.7,speed:8,speedGrowth:.3,weapon:'Staff',armor:'Robe',weaponCap:3,armorCap:2,spells:['mend','smite','ward','renewal','raise'],passive:'Mercy: healing is 20% stronger; one extra charge per unlocked tier.'},
  blackmage: {id:'blackmage',name:'Black Mage',description:'A fragile caster with broad elemental coverage.',color:'#9e9cd7',hp:30,hpGrowth:7,attack:6,attackGrowth:1.8,defense:1,defenseGrowth:.7,speed:8,speedGrowth:.3,weapon:'Rod',armor:'Robe',weaponCap:3,armorCap:2,spells:['spark','frost','bolt','flare','tempest','deluge','quake'],passive:'Aethercraft: damage magic is 15% stronger; one extra charge per unlocked tier.'},
});

const AVELUNE_ITEMS = Object.freeze({
  potion: {id:'potion',name:'Potion',price:25,description:'Restore 70 HP to one living ally.',target:'ally'},
  ether: {id:'ether',name:'Ether',price:65,description:'Restore two charges in each unlocked spell tier.',target:'ally'},
  revive: {id:'revive',name:'Dawn feather',price:90,description:'Revive one fallen ally at half HP.',target:'ally'},
  hipotion: {id:'hipotion',name:'High potion',price:100,description:'Restore 180 HP to one living ally.',target:'ally'},
  tent: {id:'tent',name:'Tent',price:60,description:'Outdoors: restore half of living allies’ maximum HP and one charge per tier. Cannot revive.',target:'party',fieldOnly:true},
  cottage: {id:'cottage',name:'Cottage kit',price:220,description:'Outdoors: fully restore living allies’ HP and magic. Cannot revive.',target:'party',fieldOnly:true},
});

// Named equipment is shared inventory. Owned counts include worn copies; changing
// jobs removes incompatible equipment without destroying it or its rank upgrades.
const AVELUNE_GEAR = Object.freeze(Object.fromEntries([
  ['sword','Sword','weapon',['vanguard','redmage'],['Bronze sword','Iron sword','Starforged sword'],[35,210,760]],
  ['wraps','Handwraps','weapon',['monk'],['Linen wraps','Iron knuckles','Dawn knuckles'],[30,180,680]],
  ['bow','Bow','weapon',['ranger'],['Ash bow','Yew bow','Moon bow'],[35,210,760]],
  ['rapier','Rapier','weapon',['redmage'],['Copper rapier','Silver rapier','Sun rapier'],[35,210,760]],
  ['staff','Staff','weapon',['whitemage','redmage'],['Willow staff','Ivory staff','Aurora staff'],[30,190,700]],
  ['rod','Rod','weapon',['blackmage','redmage'],['Oak rod','Crystal rod','Astral rod'],[30,190,700]],
  ['plate','Plate','armor',['vanguard'],['Bronze plate','Iron plate','Dawn plate'],[45,250,880]],
  ['mail','Mail','armor',['vanguard','redmage'],['Ring mail','Chain mail','Silver mail'],[40,230,820]],
  ['leather','Leather','armor',['vanguard','ranger','redmage'],['Leather vest','Ranger coat','Moonhide vest'],[30,180,680]],
  ['robe','Cloth','armor',['monk','redmage','whitemage','blackmage'],['Linen robe','Runic robe','Starlight robe'],[25,160,620]],
].flatMap(([family,label,slot,jobs,names,prices])=>names.map((name,i)=>{
  const tier=i+1,id=family+'_'+tier,attack=slot==='weapon'?[2,5,9][i]:0,defense=slot==='armor'?[1,3,6][i]:0;
  return [id,Object.freeze({id,name,slot,tier,price:prices[i],jobs:Object.freeze(jobs),attack,defense,description:label+' · '+(slot==='weapon'?'ATK +'+attack:'DEF +'+defense)})];
}))));

const AVELUNE_TOWN_SPELLS = Object.freeze(Object.fromEntries([
  ['salve',90,['redmage','whitemage'],'white'],['halo',110,['whitemage'],'white'],
  ['gale',100,['redmage','blackmage'],'black'],['stone',100,['redmage','blackmage'],'black'],
  ['greatermend',300,['redmage','whitemage'],'white'],['sunburst',400,['whitemage'],'white'],
  ['comet',420,['blackmage'],'black'],['shelter',260,['redmage','whitemage'],'white'],
].map(([id,price,jobs,school])=>[id,Object.freeze({id,...AVELUNE_SPELLS[id],price,jobs:Object.freeze(jobs),school})])));

const AVELUNE_ADVANCED_ROLES = Object.freeze({vanguard:'Knight',monk:'Master',ranger:'Wayfarer',redmage:'Spellblade',whitemage:'Luminary',blackmage:'Arcanist'});

class AveluneRPG {
  constructor(save, options={}) {
    const data=save && typeof save==='object' && !Array.isArray(save) ? save : {};
    this.seed=this._int(options.seed ?? data.seed,1,0xffffffff,0x6176656c)>>>0;
    this.xp=this._int(data.xp,0,this.xpForLevel(30),0);
    this.gold=this._int(data.gold,0,9999999,120);
    this.inventory={};
    for (const id of Object.keys(AVELUNE_ITEMS)) this.inventory[id]=this._int(data.inventory?.[id],0,99,id==='potion'?5:id==='ether'?2:id==='revive'?1:0);
    this.gearOwned={};
    for(const id of Object.keys(AVELUNE_GEAR)) this.gearOwned[id]=this._int(data.gearOwned?.[id],0,99,0);
    this.campaignRewards=new Set(Array.isArray(data.campaignRewards)?data.campaignRewards.filter(s=>typeof s==='string'&&s.length<=100).slice(0,500):[]);
    this.battlesWon=this._int(data.battlesWon,0,999999,0);
    const cast=[['roadkeeper','Roadkeeper','redmage'],['mara','Mara','vanguard'],['iven','Iven','whitemage'],['sella','Sella','blackmage']];
    this.party=cast.map(([id,name,defaultJob],index)=>{
      const old=Array.isArray(data.party)?data.party.find(h=>h&&h.id===id)??data.party[index]:null;
      const job=Object.hasOwn(AVELUNE_JOBS,old?.job)?old.job:defaultJob;
      const hero={id,name,job,promoted:old?.promoted===true,equipment:{weapon:this._int(old?.equipment?.weapon,0,5,0),armor:this._int(old?.equipment?.armor,0,5,0)},equippedGear:{weapon:null,armor:null},learnedSpells:[],spellLoadouts:{}};
      hero.learnedSpells=Array.isArray(old?.learnedSpells)?[...new Set(old.learnedSpells.filter(key=>Object.hasOwn(AVELUNE_TOWN_SPELLS,key)))]:[];
      for(const jobId of Object.keys(AVELUNE_JOBS)) {
        const saved=old?.spellLoadouts?.[jobId];
        if(!saved||typeof saved!=='object') continue;
        const loadout={};
        for(const tier of [1,2]) if(Array.isArray(saved[tier])) loadout[tier]=[...new Set(saved[tier].filter(key=>this._knowsSpell(hero,key,jobId)&&AVELUNE_SPELLS[key].tier===tier))].slice(0,3);
        hero.spellLoadouts[jobId]=loadout;
      }
      for(const slot of ['weapon','armor']) {
        const key=old?.equippedGear?.[slot],gear=AVELUNE_GEAR[key];
        if(gear?.slot===slot&&gear.jobs.includes(job)) hero.equippedGear[slot]=key;
      }
      this._stats(hero);
      hero.hp=this._int(old?.hp,0,hero.maxHp,hero.maxHp);
      hero.charges=hero.maxCharges.map((max,tier)=>this._int(old?.charges?.[tier],0,max,max));
      return hero;
    });
    const order=Array.isArray(data.party)?data.party.map(h=>h?.id):[];
    this.party.sort((a,b)=>{const ai=order.indexOf(a.id),bi=order.indexOf(b.id);return (ai<0?99:ai)-(bi<0?99:bi);});
    const worn={};
    for(const hero of this.party) for(const slot of ['weapon','armor']) {
      const id=hero.equippedGear[slot];
      if(id&&((worn[id]||0)>=this.gearOwned[id])) hero.equippedGear[slot]=null;
      else if(id) worn[id]=(worn[id]||0)+1;
      this._stats(hero);
    }
    // An invalid or abandoned save must still have a recoverable party.
    if (this.party.every(h=>h.hp===0)) this.party[0].hp=1;
    this.battle=null;
  }

  _int(value,min,max,fallback) { return Number.isFinite(value)?Math.min(max,Math.max(min,Math.floor(value))):fallback; }
  get level() { let level=1; while(level<30 && this.xp>=this.xpForLevel(level+1)) level++; return level; }
  xpForLevel(level) { return 18*(level-1)*level; }
  get nextLevelXP() { return this.level===30?this.xp:this.xpForLevel(this.level+1); }
  _random() { let x=this.seed||1;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return this.seed/4294967296; }
  _element(value) { return ({fire:'ember',ice:'frost',lightning:'bolt',light:'starlight',water:'tide',wind:'gale',earth:'stone'})[String(value).toLowerCase()]||String(value||'').toLowerCase().slice(0,24); }
  _knowsSpell(hero,id,jobId=hero.job) {
    return Object.hasOwn(AVELUNE_SPELLS,id)&&(AVELUNE_JOBS[jobId].spells.includes(id)||(hero.learnedSpells.includes(id)&&AVELUNE_TOWN_SPELLS[id]?.jobs.includes(jobId)));
  }
  _stats(hero) {
    const job=AVELUNE_JOBS[hero.job],level=this.level;
    const promoted=hero.promoted?1.1:1,weapon=AVELUNE_GEAR[hero.equippedGear?.weapon],armor=AVELUNE_GEAR[hero.equippedGear?.armor];
    hero.level=level;hero.xp=this.xp;hero.role=hero.promoted?AVELUNE_ADVANCED_ROLES[hero.job]:job.name;
    hero.maxHp=Math.round((job.hp+(level-1)*job.hpGrowth)*promoted);
    // Ranks are owned investments. A job's proficiency limits their current effect,
    // without destroying upgrades when the player experiments with another job.
    hero.attack=Math.round((job.attack+(level-1)*job.attackGrowth+Math.min(hero.equipment.weapon,job.weaponCap)*3+(weapon?.jobs.includes(hero.job)?weapon.attack:0))*promoted);
    hero.defense=Math.round((job.defense+(level-1)*job.defenseGrowth+Math.min(hero.equipment.armor,job.armorCap)*2+(armor?.jobs.includes(hero.job)?armor.defense:0))*promoted);
    hero.speed=Math.round(job.speed+(level-1)*job.speedGrowth);
    const bonus=(['whitemage','blackmage'].includes(hero.job)?1:0)+(hero.promoted?1:0);
    hero.maxCharges=job.spells.length?[3+Math.floor((level-1)/3)+bonus,level>=5?1+Math.floor((level-5)/4)+bonus:0]:[0,0];
    hero.knownSpells=[...new Set([...job.spells,...hero.learnedSpells])].filter(id=>this._knowsSpell(hero,id)&&(AVELUNE_SPELLS[id].tier===1||level>=5));
    const loadout=hero.spellLoadouts[hero.job]||{};
    hero.preparedSpells={};
    for(const tier of [1,2]) hero.preparedSpells[tier]=(loadout[tier]??job.spells).filter(id=>hero.knownSpells.includes(id)&&AVELUNE_SPELLS[id].tier===tier);
    hero.spells=[...hero.preparedSpells[1],...hero.preparedSpells[2]];
  }

  snapshot() {
    return {version:1,seed:this.seed,xp:this.xp,gold:this.gold,inventory:{...this.inventory},gearOwned:{...this.gearOwned},battlesWon:this.battlesWon,campaignRewards:[...this.campaignRewards],party:this.party.map(h=>({id:h.id,job:h.job,promoted:h.promoted,hp:h.hp,charges:[...h.charges],equipment:{...h.equipment},equippedGear:{...h.equippedGear},learnedSpells:[...h.learnedSpells],spellLoadouts:Object.fromEntries(Object.entries(h.spellLoadouts).map(([job,tiers])=>[job,Object.fromEntries(Object.entries(tiers).map(([tier,ids])=>[tier,[...ids]]))]))}))};
  }

  assignJob(index,jobId) {
    if (this.battle) return {ok:false,text:'Jobs cannot change during battle.'};
    const hero=this.party[index];
    if (!hero||!Object.hasOwn(AVELUNE_JOBS,jobId)) return {ok:false,text:'Choose a party member and a valid job.'};
    if (hero.job===jobId) return {ok:false,text:hero.name+' already follows this calling.'};
    const alive=hero.hp>0,hpRatio=hero.hp/hero.maxHp,ratios=hero.maxCharges.map((n,i)=>n?hero.charges[i]/n:0);
    hero.job=jobId;
    for(const slot of ['weapon','armor']) if(hero.equippedGear[slot]&&!AVELUNE_GEAR[hero.equippedGear[slot]].jobs.includes(jobId)) hero.equippedGear[slot]=null;
    this._stats(hero);
    hero.hp=alive?Math.max(1,Math.floor(hero.maxHp*hpRatio)):0;
    hero.charges=hero.maxCharges.map((n,i)=>Math.floor(n*ratios[i]));
    return {ok:true,text:hero.name+' is now a '+hero.role+'. Rest to replenish magic.'};
  }

  gainXP(amount) {
    if (!Number.isFinite(amount)||amount<0) return {ok:false,text:'Invalid experience reward.',levels:[]};
    const from=this.level;
    this.xp=Math.min(this.xpForLevel(30),this.xp+Math.floor(amount));
    const levels=[];
    for (const hero of this.party) {
      const maxHp=hero.maxHp,charges=[...hero.maxCharges],alive=hero.hp>0;
      this._stats(hero);
      if (this.level>from) {
        if (alive) hero.hp=Math.min(hero.maxHp,hero.hp+hero.maxHp-maxHp);
        hero.charges=hero.charges.map((n,i)=>Math.min(hero.maxCharges[i],n+hero.maxCharges[i]-charges[i]));
        levels.push({name:hero.name,from,to:this.level});
      }
    }
    return {ok:true,amount:Math.floor(amount),levels,text:levels.length?'The party reached level '+this.level+'.':Math.floor(amount)+' experience gained.'};
  }

  rest(cost=0) {
    if(this.battle) return {ok:false,text:'You cannot rest during battle.'};
    if(!Number.isInteger(cost)||cost<0||this.gold<cost) return {ok:false,text:'Not enough gold for a room.'};
    this.gold-=cost;
    this._restore();
    return {ok:true,text:'HP and all spell charges restored.'};
  }
  restAtInn(cost=0) {
    if(this.battle) return {ok:false,text:'You cannot rest during battle.'};
    if(!Number.isInteger(cost)||cost<0||this.gold<cost) return {ok:false,text:'Not enough gold for a room.'};
    if(!this.party.some(h=>h.hp>0&&(h.hp<h.maxHp||h.charges.some((n,i)=>n<h.maxCharges[i])))) return {ok:false,text:'Every standing ally is already rested. Visit the chapel for fallen allies.'};
    this.gold-=cost;
    for(const h of this.party) if(h.hp>0){h.hp=h.maxHp;h.charges=[...h.maxCharges];}
    return {ok:true,cost,text:'Standing allies recover all HP and magic. The chapel can revive fallen allies.'};
  }
  _restore() { for(const h of this.party){h.hp=h.maxHp;h.charges=[...h.maxCharges];} }

  reviveAtClinic(index,cost=30) {
    if(this.battle) return {ok:false,text:'Visit the chapel outside battle.'};
    const h=this.party[index];
    if(!h||!Number.isInteger(cost)||cost<0) return {ok:false,text:'Choose a fallen ally and a valid offering.'};
    if(h.hp>0) return {ok:false,text:h.name+' is already standing.'};
    if(this.gold<cost) return {ok:false,text:'Not enough gold for the chapel offering.'};
    this.gold-=cost;h.hp=1;
    return {ok:true,cost,amount:1,text:h.name+' returns with 1 HP. Rest at the inn to recover strength and magic.'};
  }

  useFieldSupply(itemId,context={}) {
    if(this.battle) return {ok:false,text:'Camping supplies cannot be used during battle.'};
    if(!['tent','cottage'].includes(itemId)) return {ok:false,text:'Choose a camping supply.'};
    if(context?.outdoors!==true&&context?.camp!==true) return {ok:false,text:'Camping supplies can only be used outdoors or at a campsite.'};
    const item=Object.hasOwn(AVELUNE_ITEMS,itemId)?AVELUNE_ITEMS[itemId]:null;
    if(this.inventory[itemId]<1) return {ok:false,text:'No '+item.name+' remaining.'};
    const living=this.party.filter(h=>h.hp>0);
    if(!living.some(h=>h.hp<h.maxHp||h.charges.some((n,i)=>n<h.maxCharges[i]))) return {ok:false,text:'No standing ally needs to recover. Camping cannot revive fallen allies.'};
    let amount=0;
    for(const h of living) {
      const healed=itemId==='cottage'?h.maxHp-h.hp:Math.min(h.maxHp-h.hp,Math.ceil(h.maxHp/2));
      h.hp+=healed;amount+=healed;
      h.charges=h.charges.map((n,i)=>itemId==='cottage'?h.maxCharges[i]:Math.min(h.maxCharges[i],n+1));
    }
    this.inventory[itemId]--;
    return {ok:true,amount,text:item.name+' used. Standing allies recover HP and magic; fallen allies need the chapel.'};
  }

  castField(index,spellId,targetIndex) {
    if(this.battle) return {ok:false,text:'Choose magic through the battle commands.'};
    const h=this.party[index],spell=AVELUNE_SPELLS[spellId];
    if(!h||!spell||!h.spells.includes(spellId)) return {ok:false,text:'That ally has not prepared this spell.'};
    if(h.hp===0) return {ok:false,text:h.name+' must be revived before casting.'};
    if(!['heal','revive'].includes(spell.kind)) return {ok:false,text:spell.name+' is used in battle.'};
    if(h.charges[spell.tier-1]<1) return {ok:false,text:'No tier '+spell.tier+' charges remaining.'};
    const targets=spell.target==='allAllies'?this.party.filter(p=>p.hp>0):[this.party[targetIndex]].filter(Boolean);
    const affected=targets.filter(p=>spell.kind==='revive'?p.hp===0:p.hp>0&&p.hp<p.maxHp);
    if(!affected.length) return {ok:false,text:spell.kind==='revive'?'Choose a fallen ally.':'No chosen ally needs healing.'};
    h.charges[spell.tier-1]--;
    let amount=0;
    for(const target of affected) {
      const healed=spell.kind==='revive'?Math.max(1,Math.floor(target.maxHp/2)):Math.min(target.maxHp-target.hp,Math.round((spell.power+this.level*4)*(h.job==='whitemage'?1.2:1)));
      target.hp+=healed;amount+=healed;
    }
    return {ok:true,amount,targets:affected.map(p=>p.id),text:h.name+' casts '+spell.name+'. '+amount+' HP restored.'};
  }

  moveHero(index,destination) {
    if(this.battle) return {ok:false,text:'Formation cannot change during battle.'};
    if(!Number.isInteger(index)||!Number.isInteger(destination)||index<0||destination<0||index>=this.party.length||destination>=this.party.length||index===destination) return {ok:false,text:'Choose a different party position.'};
    const [hero]=this.party.splice(index,1);this.party.splice(destination,0,hero);
    return {ok:true,text:hero.name+' moves to position '+(destination+1)+'. Front ranks draw more enemy attacks.'};
  }

  promote(index,eligible=false) {
    if(this.battle) return {ok:false,text:'Advancement is unavailable during battle.'};
    const h=this.party[index];
    if(!h) return {ok:false,text:'Choose a party member.'};
    if(h.promoted) return {ok:false,text:h.name+' has already advanced.'};
    if(eligible!==true||this.level<5) return {ok:false,text:'Reach level 5 and restore the Alderreach hearth before advancing.'};
    if(this.gold<120) return {ok:false,text:'Advancement requires 120 gold.'};
    const alive=h.hp>0,hpRatio=h.hp/h.maxHp,ratios=h.maxCharges.map((n,i)=>n?h.charges[i]/n:0);
    this.gold-=120;h.promoted=true;this._stats(h);
    h.hp=alive?Math.max(1,Math.floor(h.maxHp*hpRatio)):0;
    h.charges=h.maxCharges.map((n,i)=>Math.floor(n*ratios[i]));
    return {ok:true,cost:120,text:h.name+' advances to '+h.role+'. Rest to replenish magic.'};
  }

  buy(itemId,quantity=1) {
    if(this.battle) return {ok:false,text:'Shopping is unavailable during battle.'};
    const item=Object.hasOwn(AVELUNE_ITEMS,itemId)?AVELUNE_ITEMS[itemId]:null;
    if(!item||!Number.isInteger(quantity)||quantity<1||quantity>99) return {ok:false,text:'Choose a valid item quantity.'};
    if(this.inventory[itemId]+quantity>99) return {ok:false,text:'You can carry at most 99 of each item.'};
    const cost=item.price*quantity;
    if(this.gold<cost) return {ok:false,text:'Not enough gold.'};
    this.gold-=cost;this.inventory[itemId]+=quantity;
    return {ok:true,text:quantity+' × '+item.name+' purchased.',cost};
  }

  sell(itemId,quantity=1) {
    if(this.battle) return {ok:false,text:'Shopping is unavailable during battle.'};
    const item=Object.hasOwn(AVELUNE_ITEMS,itemId)?AVELUNE_ITEMS[itemId]:null;
    if(!item||!Number.isInteger(quantity)||quantity<1||quantity>99) return {ok:false,text:'Choose a valid item quantity.'};
    if(this.inventory[itemId]<quantity) return {ok:false,text:'You do not have enough '+item.name+'.'};
    const value=Math.floor(item.price/2)*quantity;
    this.inventory[itemId]-=quantity;this.gold=Math.min(9999999,this.gold+value);
    return {ok:true,value,text:quantity+' × '+item.name+' sold for '+value+' gold.'};
  }

  _wornGear(id) { return this.party.reduce((n,h)=>n+Object.values(h.equippedGear).filter(key=>key===id).length,0); }
  quoteGear(index,gearId) {
    const h=this.party[index],gear=Object.hasOwn(AVELUNE_GEAR,gearId)?AVELUNE_GEAR[gearId]:null;
    if(!h||!gear) return {ok:false,text:'Choose a party member and equipment.'};
    const compatible=gear.jobs.includes(h.job);
    const preview={...h,equippedGear:{...h.equippedGear,[gear.slot]:gearId}};
    this._stats(preview);
    const {attack,defense}=preview;
    return {ok:compatible,text:compatible?'':AVELUNE_JOBS[h.job].name+' cannot use '+gear.name+'.',attack,defense,attackDelta:attack-h.attack,defenseDelta:defense-h.defense,equipped:h.equippedGear[gear.slot]===gearId,available:this.gearOwned[gearId]-this._wornGear(gearId),cost:gear.price};
  }
  buyGear(gearId,quantity=1) {
    if(this.battle) return {ok:false,text:'Shopping is unavailable during battle.'};
    const gear=Object.hasOwn(AVELUNE_GEAR,gearId)?AVELUNE_GEAR[gearId]:null;
    if(!gear||!Number.isInteger(quantity)||quantity<1||quantity>99) return {ok:false,text:'Choose valid equipment and quantity.'};
    if(this.gearOwned[gearId]+quantity>99) return {ok:false,text:'You can carry at most 99 copies of each piece.'};
    const cost=gear.price*quantity;
    if(this.gold<cost) return {ok:false,text:'Not enough gold.'};
    this.gold-=cost;this.gearOwned[gearId]+=quantity;
    return {ok:true,cost,text:quantity+' × '+gear.name+' purchased. Equip it from the outfitter or party menu.'};
  }
  sellGear(gearId,quantity=1) {
    if(this.battle) return {ok:false,text:'Shopping is unavailable during battle.'};
    const gear=Object.hasOwn(AVELUNE_GEAR,gearId)?AVELUNE_GEAR[gearId]:null;
    if(!gear||!Number.isInteger(quantity)||quantity<1||quantity>99) return {ok:false,text:'Choose valid equipment and quantity.'};
    if(this.gearOwned[gearId]-this._wornGear(gearId)<quantity) return {ok:false,text:'Unequip worn copies before selling them.'};
    const value=Math.floor(gear.price/2)*quantity;
    this.gearOwned[gearId]-=quantity;this.gold=Math.min(9999999,this.gold+value);
    return {ok:true,value,text:quantity+' × '+gear.name+' sold for '+value+' gold.'};
  }
  equipGear(index,slot,gearId) {
    if(this.battle) return {ok:false,text:'Equipment cannot change during battle.'};
    const h=this.party[index];
    if(!h||!['weapon','armor'].includes(slot)) return {ok:false,text:'Choose a valid party member and slot.'};
    if(gearId!==null) {
      const gear=Object.hasOwn(AVELUNE_GEAR,gearId)?AVELUNE_GEAR[gearId]:null;
      if(!gear||gear.slot!==slot||!gear.jobs.includes(h.job)) return {ok:false,text:'This job cannot use that equipment.'};
      if(h.equippedGear[slot]===gearId) return {ok:false,text:gear.name+' is already equipped.'};
      if(this.gearOwned[gearId]-this._wornGear(gearId)<1) return {ok:false,text:'No unworn copy is available.'};
    } else if(h.equippedGear[slot]===null) return {ok:false,text:'That slot is already empty.'};
    h.equippedGear[slot]=gearId;this._stats(h);
    return {ok:true,text:h.name+(gearId?' equips '+AVELUNE_GEAR[gearId].name: ' removes their '+slot)+'.'};
  }

  quoteSpell(index,spellId) {
    const h=this.party[index],spell=Object.hasOwn(AVELUNE_TOWN_SPELLS,spellId)?AVELUNE_TOWN_SPELLS[spellId]:null;
    if(!h||!spell) return {ok:false,text:'Choose a party member and spell.',known:false,eligible:false};
    const known=h.learnedSpells.includes(spellId),eligible=spell.jobs.includes(h.job)&&(spell.tier===1||this.level>=5);
    return {ok:eligible&&!known,cost:spell.price,known,eligible,text:known?h.name+' already knows '+spell.name+'.':!spell.jobs.includes(h.job)?'This job cannot learn '+spell.name+'.':!eligible?'Reach level 5 to learn tier II magic.':''};
  }
  learnSpell(index,spellId) {
    if(this.battle) return {ok:false,text:'Magic cannot be learned during battle.'};
    const quote=this.quoteSpell(index,spellId);
    if(!quote.ok) return quote;
    if(this.gold<quote.cost) return {ok:false,text:'Not enough gold.'};
    const h=this.party[index],spell=AVELUNE_TOWN_SPELLS[spellId],active=h.preparedSpells[spell.tier];
    this.gold-=quote.cost;h.learnedSpells.push(spellId);
    if(active.length<3) {
      h.spellLoadouts[h.job]??={};h.spellLoadouts[h.job][spell.tier]=[...active,spellId];
    }
    this._stats(h);
    return {ok:true,cost:quote.cost,prepared:h.spells.includes(spellId),text:h.name+' learns '+spell.name+'.'+(h.spells.includes(spellId)?'':' Prepare it in a set of up to three spells per tier.')};
  }
  prepareSpells(index,tier,ids) {
    if(this.battle) return {ok:false,text:'Spells cannot be prepared during battle.'};
    const h=this.party[index];
    if(!h||![1,2].includes(tier)||!Array.isArray(ids)||ids.length>3||new Set(ids).size!==ids.length) return {ok:false,text:'Prepare up to three distinct spells per tier.'};
    if(ids.some(id=>!h.knownSpells.includes(id)||AVELUNE_SPELLS[id].tier!==tier)) return {ok:false,text:'Choose known, unlocked spells from this tier.'};
    h.spellLoadouts[h.job]??={};h.spellLoadouts[h.job][tier]=[...ids];this._stats(h);
    return {ok:true,text:h.name+' prepares '+ids.length+' tier '+tier+' spell'+(ids.length===1?'':'s')+'.'};
  }

  quoteUpgrade(index,slot) {
    const h=this.party[index];
    if(!h||!['weapon','armor'].includes(slot)) return {ok:false,text:'Choose an equipment slot.'};
    const j=AVELUNE_JOBS[h.job],ownedRank=h.equipment[slot],maxRank=j[slot+'Cap'],rank=Math.min(ownedRank,maxRank);
    return {ok:ownedRank<maxRank,cost:60*(ownedRank+1)*(ownedRank+1),rank,ownedRank,maxRank,label:j[slot],text:ownedRank>=maxRank?'This job’s equipment is fully upgraded.':''};
  }
  upgrade(index,slot) {
    if(this.battle) return {ok:false,text:'Equipment cannot change during battle.'};
    const q=this.quoteUpgrade(index,slot);
    if(!q.ok) return q;
    if(this.gold<q.cost) return {ok:false,text:'Not enough gold.'};
    this.gold-=q.cost;this.party[index].equipment[slot]++;this._stats(this.party[index]);
    return {ok:true,cost:q.cost,text:this.party[index].name+'’s '+q.label.toLowerCase()+' improved to rank '+(q.rank+1)+'.'};
  }

  useItem(index,itemId) {
    if(this.battle) return {ok:false,text:'Choose items through the battle commands.'};
    return this._applyItem(index,itemId);
  }
  _applyItem(index,itemId) {
    const h=this.party[index],item=Object.hasOwn(AVELUNE_ITEMS,itemId)?AVELUNE_ITEMS[itemId]:null;
    if(!h||!item) return {ok:false,text:'Choose a valid ally and item.'};
    if(item.fieldOnly) return {ok:false,text:item.name+' must be used outdoors through the camping supplies menu.'};
    if(this.inventory[itemId]<1) return {ok:false,text:'No '+item.name+' remaining.'};
    let amount=0;
    if(itemId==='revive') {
      if(h.hp>0) return {ok:false,text:h.name+' is already standing.'};
      amount=h.hp=Math.max(1,Math.floor(h.maxHp/2));
    } else {
      if(h.hp===0) return {ok:false,text:h.name+' needs a Dawn feather first.'};
      if(itemId==='potion'||itemId==='hipotion') {
        amount=Math.min(itemId==='hipotion'?180:70,h.maxHp-h.hp);
        if(!amount) return {ok:false,text:h.name+' is already at full HP.'};
        h.hp+=amount;
      } else {
        amount=h.maxCharges.reduce((sum,max,i)=>sum+Math.min(2,max-h.charges[i]),0);
        if(!amount) return {ok:false,text:h.name+' has no missing spell charges.'};
        h.charges=h.charges.map((n,i)=>Math.min(h.maxCharges[i],n+2));
      }
    }
    this.inventory[itemId]--;
    return {ok:true,amount,text:itemId==='ether'?h.name+' recovers spell charges.':h.name+' recovers '+amount+' HP.'};
  }

  startBattle(spec) {
    if(this.battle) return {ok:false,text:'An encounter is already in progress.'};
    if(!spec||!Array.isArray(spec.enemies)||!spec.enemies.length) return {ok:false,text:'This encounter has no foes.'};
    if(this.party.every(h=>h.hp===0)) return {ok:false,text:'The party needs to recover first.'};
    const enemies=spec.enemies.slice(0,9).map((raw,i)=>{
      const e=raw&&typeof raw==='object'?raw:{};
      const maxHp=this._int(e.maxHp??e.hp,1,99999,30);
      return {id:String(e.id||'enemy-'+i).slice(0,80),name:String(e.name||'Wickling').slice(0,80),sprite:String(e.sprite||'wickling').slice(0,80),maxHp,hp:maxHp,attack:this._int(e.attack,1,999,8),defense:this._int(e.defense,0,999,2),speed:this._int(e.speed,1,999,6),element:this._element(e.element),weakness:this._element(e.weakness),resistance:this._element(e.resistance),xp:this._int(e.xp,0,99999,15),gold:this._int(e.gold,0,99999,12),intent:'Strike'};
    });
    this.battle={name:String(spec.name||'Wild encounter').slice(0,100),boss:!!spec.boss,enemies,round:1,outcome:null,log:[],rewards:{xp:enemies.reduce((n,e)=>n+e.xp,0),gold:enemies.reduce((n,e)=>n+e.gold,0)}};
    return {ok:true,battle:this.battle};
  }

  resolveRound(commands) {
    const b=this.battle;
    if(!b) return {events:[],outcome:null,round:0,error:'No active encounter.'};
    if(b.outcome) return {events:[],outcome:b.outcome,round:b.round,rewards:b.outcome==='victory'?{...b.rewards}:null};
    const events=[],round=b.round;
    const emit=(text,extra={})=>{const event={kind:'info',text,...extra};events.push(event);return event;};
    const selected=this.party.map((h,i)=>commands?.[i]&&typeof commands[i]==='object'?commands[i]:{type:'guard'});
    const guards=new Set();
    for(let i=0;i<this.party.length;i++) if(this.party[i].hp>0&&selected[i].type==='guard') guards.add(i);
    let ward=false,fleeAttempted=false;
    const aliveEnemy=(index)=>b.enemies[index]?.hp>0?index:b.enemies.findIndex(e=>e.hp>0);
    const aliveAlly=(index)=>this.party[index]?.hp>0?index:this.party.findIndex(h=>h.hp>0);
    const fallenAlly=(index)=>this.party[index]?.hp===0?index:this.party.findIndex(h=>h.hp===0);
    const outcome=()=>{
      if(b.enemies.every(e=>e.hp===0)) b.outcome='victory';
      else if(this.party.every(h=>h.hp===0)) b.outcome='defeat';
      return b.outcome;
    };
    const queue=[...this.party.map((h,index)=>({side:'party',index,speed:h.speed+this._random()*6})),...b.enemies.map((e,index)=>({side:'enemy',index,speed:e.speed+this._random()*6}))].sort((a,c)=>c.speed-a.speed);
    for(const action of queue) {
      if(outcome()) break;
      if(action.side==='party') {
        const i=action.index,h=this.party[i],c=selected[i];
        if(h.hp===0) continue;
        const actor={actor:h.id,actorSide:'party',actorIndex:i};
        if(c.type==='guard') {emit(h.name+' braces for the next blow.',{kind:'guard',...actor});continue;}
        if(c.type==='flee') {
          if(fleeAttempted) continue;
          fleeAttempted=true;
          if(b.boss) {emit('The guardian bars the escape route.',{kind:'flee',...actor});continue;}
          const ranger=this.party.some(p=>p.hp>0&&p.job==='ranger');
          const chance=.68+(ranger?.18:0)+Math.min(.1,(round-1)*.04);
          if(this._random()<chance) {b.outcome='fled';emit('The party escapes along the road.',{kind:'flee',...actor});break;}
          emit('The escape route is blocked!',{kind:'flee',...actor});continue;
        }
        if(c.type==='item') {
          const ti=c.item==='revive'?fallenAlly(c.target):aliveAlly(c.target);
          const result=this._applyItem(ti,c.item);
          emit(result.text,{kind:result.ok?'heal':'miss',...actor,target:this.party[ti]?.id,targetSide:'party',targetIndex:ti,amount:result.amount||0});
          continue;
        }
        if(c.type==='spell') {
          const s=AVELUNE_SPELLS[c.spell];
          if(!s||!h.spells.includes(c.spell)) {emit(h.name+' cannot cast that spell.',{kind:'miss',...actor});continue;}
          if(h.charges[s.tier-1]<1) {emit(h.name+' has no tier '+s.tier+' charges left.',{kind:'miss',...actor});continue;}
          let targets=[];
          if(s.target==='enemy') targets=[aliveEnemy(c.target)];
          if(s.target==='allEnemies') targets=b.enemies.flatMap((e,index)=>e.hp>0?[index]:[]);
          if(s.target==='ally') targets=[s.kind==='revive'?fallenAlly(c.target):aliveAlly(c.target)];
          if(s.target==='allAllies') targets=this.party.flatMap((p,index)=>p.hp>0?[index]:[]);
          targets=targets.filter(t=>t>=0);
          if(!targets.length) {emit(s.name+' has no valid target.',{kind:'miss',...actor});continue;}
          if(s.kind==='heal'&&targets.every(t=>this.party[t].hp===this.party[t].maxHp)) {emit('No ally needs '+s.name+'.',{kind:'miss',...actor});continue;}
          h.charges[s.tier-1]--;
          if(s.kind==='ward') {ward=true;emit(h.name+' casts '+s.name+'. The party is protected this round.',{kind:'spell',...actor});continue;}
          for(const ti of targets) {
            if(s.kind==='damage') {
              const e=b.enemies[ti];
              const weak=this._element(e.weakness)===s.element,resist=this._element(e.resistance)===s.element;
              const damage=Math.max(1,Math.round((s.power+this.level*4)*(h.job==='blackmage'?1.15:1)*(.93+this._random()*.14)*(weak?1.6:resist?.6:1)-e.defense*.15));
              e.hp=Math.max(0,e.hp-damage);
              emit(h.name+' casts '+s.name+' on '+e.name+': '+damage+(weak?' — weakness!':resist?' — resisted.':'.'),{kind:'spell',...actor,target:e.id,targetSide:'enemy',targetIndex:ti,amount:damage,weak,element:s.element});
            } else {
              const target=this.party[ti];
              const amount=s.kind==='revive'?Math.max(1,Math.floor(target.maxHp/2)):Math.min(target.maxHp-target.hp,Math.round((s.power+this.level*4)*(h.job==='whitemage'?1.2:1)));
              target.hp+=amount;
              emit(h.name+' casts '+s.name+'. '+target.name+' recovers '+amount+' HP.',{kind:'heal',...actor,target:target.id,targetSide:'party',targetIndex:ti,amount});
            }
          }
          continue;
        }
        const ti=aliveEnemy(c.target);
        if(ti<0) continue;
        const e=b.enemies[ti],critical=this._random()<(h.job==='ranger'?.18:.08);
        const damage=Math.max(1,Math.round((h.attack*(.85+this._random()*.3)-e.defense*.55)*(critical?(h.job==='monk'?2:1.6):1)));
        e.hp=Math.max(0,e.hp-damage);
        emit(h.name+' strikes '+e.name+' for '+damage+(critical?' — critical!':'.'),{kind:'attack',...actor,target:e.id,targetSide:'enemy',targetIndex:ti,amount:damage,critical});
      } else {
        const e=b.enemies[action.index];
        if(e.hp===0) continue;
        // Classic front-rank targeting: weights 4, 2, 1, 1 among living allies.
        const available=this.party.flatMap((h,index)=>h.hp>0?[{index,weight:[4,2,1,1][index]}]:[]);
        let roll=this._random()*available.reduce((sum,h)=>sum+h.weight,0),ti=available.at(-1).index;
        for(const target of available){roll-=target.weight;if(roll<0){ti=target.index;break;}}
        const h=this.party[ti],heavy=round%3===0;
        const guardMultiplier=guards.has(ti)?(h.job==='vanguard'?.35:.45):1;
        const damage=Math.max(1,Math.round((e.attack*(.85+this._random()*.3)*(heavy?1.7:1)-h.defense*.55)*guardMultiplier*(ward?.65:1)));
        h.hp=Math.max(0,h.hp-damage);
        emit(e.name+(heavy?' unleashes a heavy strike on ':' strikes ')+h.name+' for '+damage+(guards.has(ti)?' (guarded).':'.'),{kind:'attack',actor:e.id,actorSide:'enemy',actorIndex:action.index,target:h.id,targetSide:'party',targetIndex:ti,amount:damage,heavy});
        if(h.hp===0) emit(h.name+' falls. A Dawn feather can revive them.',{kind:'down',target:h.id,targetSide:'party',targetIndex:ti});
      }
    }
    outcome();
    if(b.outcome==='victory') emit('Victory! The road is clear.',{kind:'victory'});
    else if(b.outcome==='defeat') emit('The party falls. Roadkeepers will carry you back to safety.',{kind:'defeat'});
    else if(!b.outcome) {
      b.round++;
      for(const e of b.enemies) e.intent=b.round%3===0?'Heavy strike':'Strike';
      if(b.round%3===0) emit('The enemy gathers strength. A heavy strike is coming — consider Guard.',{kind:'telegraph'});
    }
    b.log.push(...events);if(b.log.length>120)b.log.splice(0,b.log.length-120);
    return {events,outcome:b.outcome,round,rewards:b.outcome==='victory'?{...b.rewards}:null};
  }

  finishBattle() {
    const b=this.battle;
    if(!b?.outcome) return {ok:false,text:b?'The battle is not over.':'No battle rewards to collect.'};
    let result;
    if(b.outcome==='victory') {
      const gain=this.gainXP(b.rewards.xp);
      this.gold=Math.min(9999999,this.gold+b.rewards.gold);this.battlesWon++;
      result={ok:true,outcome:'victory',xp:b.rewards.xp,gold:b.rewards.gold,levels:gain.levels,text:'Victory! '+b.rewards.xp+' XP and '+b.rewards.gold+' gold gained.'};
    } else if(b.outcome==='defeat') {
      const loss=Math.min(this.gold,200,Math.max(5,Math.floor(this.gold*.1)));
      this.gold-=loss;this._restore();
      result={ok:true,outcome:'defeat',xp:0,gold:0,loss,levels:[],text:'The party recovers at a safe haven. '+loss+' gold paid for rescue.'};
    } else result={ok:true,outcome:'fled',xp:0,gold:0,levels:[],text:'The party escaped. No rewards gained.'};
    this.battle=null;
    return result;
  }
}
