/*
 * Avelune combat and party model. No renderer or browser globals are required.
 * Global API: AveluneRPG, AVELUNE_JOBS, AVELUNE_SPELLS, AVELUNE_ITEMS.
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
});

class AveluneRPG {
  constructor(save, options={}) {
    const data=save && typeof save==='object' && !Array.isArray(save) ? save : {};
    this.seed=this._int(options.seed ?? data.seed,1,0xffffffff,0x6176656c)>>>0;
    this.xp=this._int(data.xp,0,this.xpForLevel(30),0);
    this.gold=this._int(data.gold,0,9999999,120);
    this.inventory={};
    for (const id of Object.keys(AVELUNE_ITEMS)) this.inventory[id]=this._int(data.inventory?.[id],0,99,id==='potion'?5:id==='ether'?2:1);
    this.campaignRewards=new Set(Array.isArray(data.campaignRewards)?data.campaignRewards.filter(s=>typeof s==='string'&&s.length<=100).slice(0,500):[]);
    this.battlesWon=this._int(data.battlesWon,0,999999,0);
    const cast=[['roadkeeper','Roadkeeper','redmage'],['mara','Mara','vanguard'],['iven','Iven','whitemage'],['sella','Sella','blackmage']];
    this.party=cast.map(([id,name,defaultJob],index)=>{
      const old=Array.isArray(data.party)?data.party.find(h=>h&&h.id===id)??data.party[index]:null;
      const job=Object.hasOwn(AVELUNE_JOBS,old?.job)?old.job:defaultJob;
      const hero={id,name,job,equipment:{weapon:this._int(old?.equipment?.weapon,0,5,0),armor:this._int(old?.equipment?.armor,0,5,0)}};
      this._stats(hero);
      hero.hp=this._int(old?.hp,0,hero.maxHp,hero.maxHp);
      hero.charges=hero.maxCharges.map((max,tier)=>this._int(old?.charges?.[tier],0,max,max));
      return hero;
    });
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
  _stats(hero) {
    const job=AVELUNE_JOBS[hero.job],level=this.level;
    hero.level=level;hero.xp=this.xp;hero.role=job.name;
    hero.maxHp=Math.round(job.hp+(level-1)*job.hpGrowth);
    // Ranks are owned investments. A job's proficiency limits their current effect,
    // without destroying upgrades when the player experiments with another job.
    hero.attack=Math.round(job.attack+(level-1)*job.attackGrowth+Math.min(hero.equipment.weapon,job.weaponCap)*3);
    hero.defense=Math.round(job.defense+(level-1)*job.defenseGrowth+Math.min(hero.equipment.armor,job.armorCap)*2);
    hero.speed=Math.round(job.speed+(level-1)*job.speedGrowth);
    const bonus=['whitemage','blackmage'].includes(hero.job)?1:0;
    hero.maxCharges=job.spells.length?[3+Math.floor((level-1)/3)+bonus,level>=5?1+Math.floor((level-5)/4)+bonus:0]:[0,0];
    hero.spells=job.spells.filter(id=>AVELUNE_SPELLS[id].tier===1||level>=5);
  }

  snapshot() {
    return {version:1,seed:this.seed,xp:this.xp,gold:this.gold,inventory:{...this.inventory},battlesWon:this.battlesWon,campaignRewards:[...this.campaignRewards],party:this.party.map(h=>({id:h.id,job:h.job,hp:h.hp,charges:[...h.charges],equipment:{...h.equipment}}))};
  }

  assignJob(index,jobId) {
    if (this.battle) return {ok:false,text:'Jobs cannot change during battle.'};
    const hero=this.party[index];
    if (!hero||!Object.hasOwn(AVELUNE_JOBS,jobId)) return {ok:false,text:'Choose a party member and a valid job.'};
    if (hero.job===jobId) return {ok:false,text:hero.name+' already follows this calling.'};
    const alive=hero.hp>0,hpRatio=hero.hp/hero.maxHp,ratios=hero.maxCharges.map((n,i)=>n?hero.charges[i]/n:0);
    hero.job=jobId;
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
  _restore() { for(const h of this.party){h.hp=h.maxHp;h.charges=[...h.maxCharges];} }

  buy(itemId,quantity=1) {
    if(this.battle) return {ok:false,text:'Shopping is unavailable during battle.'};
    const item=AVELUNE_ITEMS[itemId];
    if(!item||!Number.isInteger(quantity)||quantity<1||quantity>99) return {ok:false,text:'Choose a valid item quantity.'};
    if(this.inventory[itemId]+quantity>99) return {ok:false,text:'You can carry at most 99 of each item.'};
    const cost=item.price*quantity;
    if(this.gold<cost) return {ok:false,text:'Not enough gold.'};
    this.gold-=cost;this.inventory[itemId]+=quantity;
    return {ok:true,text:quantity+' × '+item.name+' purchased.',cost};
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
    const h=this.party[index],item=AVELUNE_ITEMS[itemId];
    if(!h||!item) return {ok:false,text:'Choose a valid ally and item.'};
    if(this.inventory[itemId]<1) return {ok:false,text:'No '+item.name+' remaining.'};
    let amount=0;
    if(itemId==='revive') {
      if(h.hp>0) return {ok:false,text:h.name+' is already standing.'};
      amount=h.hp=Math.max(1,Math.floor(h.maxHp/2));
    } else {
      if(h.hp===0) return {ok:false,text:h.name+' needs a Dawn feather first.'};
      if(itemId==='potion') {
        amount=Math.min(70,h.maxHp-h.hp);
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
          if(s.kind==='ward') {ward=true;emit(h.name+' casts Ward. The party is protected this round.',{kind:'spell',...actor});continue;}
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
