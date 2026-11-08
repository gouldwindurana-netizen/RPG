/* Town counters and field spellbook. All purchases and recovery use the RPG API. */
class AveluneServicesUI {
  constructor(options) {
    this.options=options;this.getRPG=options.getRPG;this.getWorld=options.getWorld;
    this.actions=new Map();this.sequence=0;this.message='';this.state={};this.mount=null;
  }
  _el(tag,value,className) {const el=document.createElement(tag);if(value!==undefined)el.textContent=value;if(className)el.className=className;return el;}
  _action(label,action,{note='',disabled=false,primary=false,key=''}={}) {
    const b=this._el('button',undefined,'town-button'+(primary?' town-primary':''));b.type='button';
    const id=String(++this.sequence);this.actions.set(id,action);b.dataset.uiAction=id;b.dataset.focus=key||label;b.disabled=disabled;
    b.append(this._el('strong',label));if(note)b.append(this._el('small',note));return b;
  }
  _select(label,values,value,change) {
    const wrap=this._el('label',undefined,'town-select'),select=this._el('select');wrap.append(this._el('span',label));
    for(const [id,name] of values){const o=this._el('option',name);o.value=id;select.append(o);}select.value=String(value);
    const id=String(++this.sequence);this.actions.set(id,()=>change(select.value));select.dataset.uiChange=id;select.dataset.focus=label;wrap.append(select);return wrap;
  }
  _begin(kind,kicker,title,render) {
    this.message='';this.render=render;this.mount=this._el('div',undefined,'town-ui');this.mount.dataset.serviceType=this.service?.type||kind;
    this.mount.addEventListener('click',async event=>{const b=event.target.closest('[data-ui-action]');if(!b||!this.mount.contains(b)||b.disabled)return;this.options.onSound?.('menu');await this.actions.get(b.dataset.uiAction)?.();});
    this.mount.addEventListener('change',event=>{const el=event.target.closest('[data-ui-change]');if(el)this.actions.get(el.dataset.uiChange)?.();});
    this._draw();this.options.openDialog(kind,kicker,title,this.mount,true);
  }
  _draw() {
    const focus=document.activeElement?.dataset?.focus;this.actions.clear();this.sequence=0;this.mount.replaceChildren();
    const r=this.getRPG(),head=this._el('div',undefined,'town-status');head.append(this._el('span',this.service?.label||'ROADKEEPERS'),this._el('strong',r.gold+' G','town-gold'));this.mount.append(head);
    this.render();this._frameRows();
    const feedback=this._el('p',this.message,'town-feedback'+(this.failed?' town-error':''));feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');this.mount.append(feedback);
    if(focus){const next=[...this.mount.querySelectorAll('[data-focus]')].find(el=>el.dataset.focus===focus&&!el.disabled);next?.focus({preventScroll:true});}
  }
  async _run(action,after) {
    try{const result=await action();this.failed=result?.ok===false;this.message=result?.text||(this.failed?'That action is unavailable.':'Done.');if(!this.failed){this.options.onChange?.(result);this.options.toast?.(this.message);after?.(result);}if(this.mount?.isConnected)this._draw();return result;}
    catch(error){this.failed=true;this.message=error.message||'That action is unavailable.';if(this.mount?.isConnected)this._draw();return {ok:false,text:this.message};}
  }
  _note(value,className='town-note') {return this._el('p',value,className);}
  _frameRows() {
    // Keep the existing actions in a single classic menu window, rather than
    // presenting every item as a separate card.
    const rows=[...this.mount.children];let ledger=null;
    for(const child of rows){
      if(!child.classList.contains('town-row')){ledger=null;continue;}
      if(!ledger){ledger=this._el('div',undefined,'town-ledger');const heading=this._el('div',undefined,'town-ledger-heading');heading.setAttribute('aria-hidden','true');heading.append(this._el('span',this.mount.dataset.serviceType==='town-directory'?'COUNTER':this.mount.dataset.serviceType==='field-magic'?'PARTY':'SELECTION'),this._el('span','COMMAND'));ledger.append(heading);child.before(ledger);}
      ledger.append(child);
    }
  }
  _tabs(entries,selected,change) {const tabs=this._el('div',undefined,'town-tabs');for(const [id,label]of entries){const b=this._action(label,()=>{change(id);this.message='';this._draw();});b.classList.toggle('selected',id===selected);b.setAttribute('aria-pressed',String(id===selected));tabs.append(b);}return tabs;}
  _heroes(change) {const r=this.getRPG(),tabs=this._tabs(r.party.map((h,i)=>[i,h.name]),this.state.hero,index=>{this.state.hero=index;change?.(index);});tabs.classList.add('town-heroes');return tabs;}
  _hp(hero) {const wrap=this._el('div',undefined,'town-vitals');wrap.append(this._el('span',hero.hp===0?'FALLEN':'HP '+hero.hp+' / '+hero.maxHp,hero.hp===0?'town-fallen':''));const bar=this._el('span',undefined,'town-hp');const fill=this._el('i');fill.style.width=(100*hero.hp/hero.maxHp)+'%';bar.append(fill);wrap.append(bar);return wrap;}
  _heroSummary(hero) {const box=this._el('div',undefined,'town-hero-summary');box.append(this._el('strong',hero.name+' · '+hero.role),this._hp(hero));const charges=(hero.maxCharges||[]).map((max,i)=>max?'Tier '+(i+1)+' '+hero.charges[i]+'/'+max:null).filter(Boolean).join('  ·  ');if(charges)box.append(this._el('small',charges));return box;}
  _row(title,description,action,meta='') {const row=this._el('div',undefined,'town-row'),info=this._el('div',undefined,'town-row-info'),heading=this._el('strong');const price=title.match(/^(.*?)( · )(\d+ G)$/);if(price){heading.append(this._el('span',price[1],'town-row-name'),this._el('span',price[2],'town-row-separator'),this._el('span',price[3],'town-row-price'));}else heading.textContent=title;info.append(heading);if(description)info.append(this._el('small',description));if(meta)info.append(this._el('span',meta,'town-row-meta'));row.append(info);if(action)row.append(action);return row;}
  _price() {const w=this.getWorld();if(this.service?.type==='camp')return 0;if(Number.isFinite(this.service?.cost))return Math.max(1,this.service.cost);return 8+(typeof AveluneCampaign!=='undefined'?AveluneCampaign.recommendedLevel(w.area,w):Math.max(1,this.service?.stockTier||1))*3;}
  _stock(tier) {return (this.service?.stockTier||1)>=Math.max(1,tier||1);}
  open(service) {
    this.service=service;this.state={hero:0,tab:'buy',quantity:1,slot:'weapon',school:'all',guild:'jobs',confirm:false};
    const aliases={itemshop:'item',provisions:'item',weaponshop:'weapon',armory:'weapon',armorshop:'armor',magicshop:'magic',clinic:'chapel',healer:'chapel'};
    this.type=aliases[service.type]||service.type;
    if(this.type==='armor')this.state.slot='armor';if(service.fieldOnly)this.state.tab='equip';
    const render={inn:()=>this._inn(),camp:()=>this._camp(),chapel:()=>this._chapel(),item:()=>this._items(),weapon:()=>this._gear(),armor:()=>this._gear(),magic:()=>this._magicShop(),guild:()=>this._guild(),rumor:()=>this._rumor()}[this.type]||(()=>this._rumor());
    this._begin('town-service',service.label||this.type.toUpperCase(),service.name,render);
  }
  _inn() {
    const r=this.getRPG(),price=this._price();this.mount.append(this._note(this.service.description||'A safe bed, a warm meal, and a fresh start for every traveler.'));
    const party=this._el('div',undefined,'town-party-summary');r.party.forEach(h=>party.append(this._heroSummary(h)));this.mount.append(party);
    this.mount.append(this._note('A night at the inn restores living allies’ HP and every spell charge. Take fallen allies to the clinic first. Your journey is saved here.'));
    const box=this._el('div',undefined,'town-rest');box.append(this._el('strong','A room for the party · '+price+' G'));
    if(this.state.confirm){box.append(this._note('Stay until morning?'),this._action('Confirm rest',()=>this._run(()=>this.options.onRest(this.service)),{primary:true,disabled:r.gold<price}),this._action('Not yet',()=>{this.state.confirm=false;this._draw();}));}
    else box.append(this._action('Stay the night · '+price+' G',()=>{this.state.confirm=true;this._draw();},{primary:true,disabled:r.gold<price,note:r.gold<price?'You need '+(price-r.gold)+' more G.':'Restore HP + magic · save your journey'}));
    this.mount.append(box);if(r.gold<price)this.mount.append(this._note('Use supplies already in your bag, healing magic, or sell spare items to pay for a room.'));
  }
  _camp() {
    const r=this.getRPG();this.mount.append(this._note(this.service.description||'A sheltered place to make camp. Recovery consumes a Tent or Cottage from your bag.'));
    const party=this._el('div',undefined,'town-party-summary');r.party.forEach(h=>party.append(this._heroSummary(h)));this.mount.append(party);
    this.mount.append(this._note('Camping supplies restore living allies. Take fallen companions to a clinic or use a revival item first.'));
    for(const id of ['tent','cottage']){const item=AVELUNE_ITEMS[id],owned=r.inventory[id]||0;this.mount.append(this._row(item.name+' · '+owned+' in bag',item.description,this._action('Use '+item.name,()=>this._run(()=>this.options.onRest({...this.service,supply:id})),{primary:owned>0,disabled:owned<1,note:owned?'Consumes one '+item.name+'.':'Buy camping supplies at an item shop.'})));}
  }
  _chapel() {
    const r=this.getRPG(),price=30;this.mount.append(this._note(this.service.description||'Revive a fallen companion for 30 G. They return with 1 HP; visit the inn to recover HP and magic.'));
    for(const [i,h]of r.party.entries()){const b=this._action(h.hp===0?'Revive · '+price+' G':'Standing',()=>this._run(()=>r.reviveAtClinic(i,price)),{disabled:h.hp>0||r.gold<price,primary:h.hp===0,note:h.hp===0?(r.gold<price?'Not enough gold.':'Return with 1 HP. Visit the inn afterward.'):'Visit the inn to recover HP and magic.'});const row=this._row(h.name+' · '+h.role,'HP '+h.hp+' / '+h.maxHp,b);row.classList.toggle('town-fallen-row',h.hp===0);this.mount.append(row);}
  }
  _quantity() {return this._tabs([[1,'×1'],[5,'×5'],[10,'×10']],this.state.quantity,n=>this.state.quantity=n);}
  _items() {
    const r=this.getRPG();this.mount.append(this._note(this.service.description||'Pack provisions before you set out. Items can be used from the mailbag.'),this._tabs([['buy','Buy'],['sell','Sell']],this.state.tab,n=>this.state.tab=n),this._quantity());
    const selling=this.state.tab==='sell',q=this.state.quantity;
    for(const [id,item]of Object.entries(AVELUNE_ITEMS)){const owned=r.inventory[id]||0,price=selling?Math.floor(item.price/2):item.price,cost=price*q,stock=selling||this._stock(item.tier),enough=selling?owned>=q:r.gold>=cost,room=owned+q<=99;let reason=!stock?'Available in a later town.':!enough?(selling?'Not enough in your bag.':'Need '+(cost-r.gold)+' more G.'):!selling&&!room?'Carry limit: 99.':'';
      const b=this._action((selling?'Sell ':'Buy ')+q+' · '+cost+' G',()=>this._run(()=>selling?r.sell(id,q):r.buy(id,q)),{disabled:(selling?owned<q:!stock||!enough||!room),note:reason,key:'item-'+id});this.mount.append(this._row(item.name+' · '+price+' G',item.description,b,'In bag: '+owned+' / 99'+(selling?' · sells for half price':'')));}
    this.mount.append(this._note(selling?'Equipped gear is handled at the armory.':'Tents and cottages recover living party members outdoors. Use the mailbag when you leave town.'));
  }
  _gear() {
    const r=this.getRPG(),h=r.party[this.state.hero],slot=this.state.slot,q=this.state.quantity;
    this.mount.append(this._note(this.service.description||(this.service.fieldOnly?'Change the company’s equipment before the next encounter. Visit a town armory to buy or sell gear.':'Weapons and armor for every calling. Compare the change before spending your gold.')));if(!this.service.fieldOnly)this.mount.append(this._tabs([['buy','Buy'],['equip','Equip'],['sell','Sell']],this.state.tab,n=>this.state.tab=n));
    if(this.type!=='armor')this.mount.append(this._tabs([['weapon','Weapons'],['armor','Armor']],slot,n=>this.state.slot=n));
    if(this.state.tab!=='sell'){this.mount.append(this._heroes(),this._heroSummary(h));const current=h.equippedGear?.[slot],name=current&&AVELUNE_GEAR[current]?.name;this.mount.append(this._note('Equipped '+slot+': '+(name||'Starter '+AVELUNE_JOBS[h.job][slot].toLowerCase())+' · ATK '+h.attack+' · DEF '+h.defense));}
    if(this.state.tab==='sell')this.mount.append(this._quantity());
    for(const [id,gear]of Object.entries(AVELUNE_GEAR)){if(gear.slot!==slot)continue;const owned=r.gearOwned[id]||0,quote=r.quoteGear(this.state.hero,id),stock=this._stock(gear.tier),worn=r.party.filter(hero=>hero.equippedGear?.[slot]===id).length,available=Math.max(0,owned-worn),delta=(n)=>n>0?'+'+n:String(n||0);let action,meta='Owned: '+owned+(worn?' · equipped: '+worn:'');
      if(this.state.tab==='sell'){const total=Math.floor(gear.price/2)*q;action=this._action('Sell '+q+' · '+total+' G',()=>this._run(()=>r.sellGear(id,q)),{disabled:available<q,note:available<q?'Only unequipped copies can be sold.':'Unequipped: '+available,key:'gear-'+id});}
      else {const eligible=quote.ok;meta+=' · '+(eligible?'ATK '+h.attack+' → '+quote.attack+' ('+delta(quote.attackDelta)+') · DEF '+h.defense+' → '+quote.defense+' ('+delta(quote.defenseDelta)+')':quote.text||'This job cannot use it.');
        if(this.state.tab==='buy')action=this._action('Buy · '+gear.price+' G',()=>this._run(()=>r.buyGear(id)),{disabled:!stock||r.gold<gear.price||owned>=99,note:!stock?'Sold in a later town.':r.gold<gear.price?'Need '+(gear.price-r.gold)+' more G.':!eligible?'For another party member’s calling.':'Buy first, then choose Equip.',key:'gear-'+id});
        else action=this._action(quote.equipped?'Equipped':'Equip',()=>this._run(()=>r.equipGear(this.state.hero,slot,id)),{disabled:quote.equipped||!eligible||available<1,note:quote.equipped?'Currently worn.':!eligible?'This job lacks proficiency.':available<1?'Buy a copy at the counter first.':'Change '+h.name+'’s '+slot+'.',key:'gear-'+id});}
      this.mount.append(this._row(gear.name+' · '+gear.price+' G',gear.description+' '+gear.jobs.map(j=>AVELUNE_JOBS[j].name).join(' / '),action,meta));}
    if(this.state.tab==='equip'&&h.equippedGear?.[slot])this.mount.append(this._action('Return to starter '+slot,()=>this._run(()=>r.equipGear(this.state.hero,slot,null)),{note:'Keep the removed piece in your shared equipment bag.'}));
  }
  _magicShop() {
    const r=this.getRPG(),h=r.party[this.state.hero];this.mount.append(this._note(this.service.description||'A spell is learned by one traveler. Prepare up to three spells of each tier.'),this._heroes(()=>this.state.loadouts={}),this._heroSummary(h),this._tabs([['buy','Learn spells'],['prepare','Prepare spells']],this.state.tab,n=>this.state.tab=n));
    if(this.state.tab==='prepare'){this._prepare();return;}
    this.mount.append(this._tabs([['all','All magic'],['white','White'],['black','Black']],this.state.school,n=>this.state.school=n));
    for(const [id,s]of Object.entries(AVELUNE_TOWN_SPELLS)){if(this.state.school!=='all'&&s.school!==this.state.school)continue;const quote=r.quoteSpell(this.state.hero,id),stock=this._stock(s.tier);const note=quote.known?'Already learned.':!stock?'Sold in a later town.':!quote.eligible?quote.text:r.gold<s.price?'Not enough gold.':'Learn permanently for '+h.name+'.';
      this.mount.append(this._row(s.name+' · Tier '+s.tier+' · '+s.price+' G',s.description,this._action(quote.known?'Learned':'Learn · '+s.price+' G',()=>this._run(()=>r.learnSpell(this.state.hero,id)),{disabled:quote.known||!quote.eligible||!stock||r.gold<s.price,note,key:'spell-'+id}),s.jobs.map(j=>AVELUNE_JOBS[j].name).join(' / ')));}
  }
  _prepare() {
    const r=this.getRPG(),h=r.party[this.state.hero],known=h.knownSpells||h.spells;
    if(!known.length){this.mount.append(this._note('This calling does not use magic. Change jobs at the guild to begin studying.'));return;}
    this.state.loadouts??={};
    for(const tier of [1,2]){const spells=known.filter(id=>AVELUNE_SPELLS[id]?.tier===tier);if(!spells.length)continue;const active=h.spells.filter(id=>AVELUNE_SPELLS[id].tier===tier),key=h.id+'-'+tier;
      const draft=this.state.loadouts[key]??=active.slice(),section=this._el('section',undefined,'town-spell-tier');section.append(this._el('h3','Tier '+tier+' · '+draft.length+' / 3 selected'),this._note('Choose up to three, then save this tier’s loadout. Each cast uses one shared tier '+tier+' charge.'));
      if(draft.length>3)section.append(this._note('Your original spellbook is active. Remove '+(draft.length-3)+' spell'+(draft.length-3===1?'':'s')+' to save a custom loadout.'));
      const choices=this._el('div',undefined,'town-spell-grid');for(const id of spells){const spell=AVELUNE_SPELLS[id],selected=draft.includes(id);const button=this._action((selected?'◆ ':'◇ ')+spell.name,()=>{this.state.loadouts[key]=selected?draft.filter(x=>x!==id):[...draft,id];this.message='';this._draw();},{disabled:!selected&&draft.length>=3,note:spell.description,key:'prepare-'+id});button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));choices.append(button);}
      const same=active.length===draft.length&&active.every(id=>draft.includes(id));section.append(choices,this._action('Save tier '+tier+' loadout',()=>this._run(()=>r.prepareSpells(this.state.hero,tier,draft),()=>delete this.state.loadouts[key]),{primary:true,disabled:draft.length>3||same,note:same?'This loadout is already active.':draft.length>3?'Choose no more than three spells.':draft.length+' spells will be prepared.',key:'save-loadout-'+tier}));this.mount.append(section);}
  }
  _guild() {
    const r=this.getRPG();this.mount.append(this._note(this.service.description||'Choose four callings and arrange the company before taking to the road.'),this._tabs([['jobs','Callings'],['formation','Formation'],['promotion','Promotion']],this.state.guild,n=>this.state.guild=n));
    if(this.state.guild==='formation'){this.mount.append(this._note('The front rank draws more enemy attacks. Put a sturdy ally first and protect your mages in the rear.'));r.party.forEach((h,i)=>{const controls=this._el('div',undefined,'town-inline-actions');controls.append(this._action('↑',()=>this._run(()=>r.moveHero(i,i-1)),{disabled:i===0,note:'Forward',key:'formation-up-'+h.id}),this._action('↓',()=>this._run(()=>r.moveHero(i,i+1)),{disabled:i===r.party.length-1,note:'Back',key:'formation-down-'+h.id}));this.mount.append(this._row((i+1)+'. '+h.name+' · '+h.role,i===0?'Front rank · most exposed':i===r.party.length-1?'Rear rank · most protected':'Middle rank',controls,'HP '+h.hp+' / '+h.maxHp));});return;}
    this.mount.append(this._heroes());const h=r.party[this.state.hero];this.mount.append(this._heroSummary(h));
    if(this.state.guild==='promotion'){const w=this.getWorld(),story=!!w.has?.('alderreach'),eligible=story&&r.level>=5,reason=!story?'Restore the Alderreach hearth first.':r.level<5?'Reach party level 5 first.':r.gold<120?'You need 120 G.':'Receive stronger stats and one extra charge in each unlocked magic tier.';this.mount.append(this._note('After restoring Alderreach, level 5 travelers may earn an advanced calling. Promotion follows the traveler when you change jobs.'),this._action(h.promoted?'Already promoted':'Advance '+h.name+' · 120 G',()=>this._run(()=>r.promote(this.state.hero,eligible)),{disabled:h.promoted||!eligible||r.gold<120||typeof r.promote!=='function',primary:true,note:h.promoted?h.role:reason}));return;}
    this.mount.append(this._note('Retraining is free. Equipment and learned spells stay yours; HP and magic keep their current proportions. Rest afterward to refill your charges.'));const grid=this._el('div',undefined,'town-job-grid');for(const [id,j]of Object.entries(AVELUNE_JOBS)){const b=this._action(j.name,()=>this._run(()=>r.assignJob(this.state.hero,id)),{disabled:h.job===id,note:j.description+' '+j.passive,key:'job-'+id});b.classList.toggle('selected',h.job===id);b.setAttribute('aria-pressed',String(h.job===id));grid.append(b);}this.mount.append(grid);
  }
  _rumor() {this.mount.append(this._note(this.service.description||'Travelers share news around the town.'),this._el('blockquote',this.service.rumor||'Visit the inn before a long journey. Carry healing supplies, prepare your spells, and keep your strongest defender in the front rank.','town-rumor'));}
  directory(services=[]) {
    this.service=null;this.state={};this._begin('town-directory','TOWN SERVICES','Prepare for the road',()=>{this.mount.append(this._note('Follow a sign to the counter, then press E or Interact. Inns restore HP and magic; shops prepare your party for the next journey.'));
      if(!services.length){this.mount.append(this._note('There are no town services here. Use the mailbag or field magic to heal, or return to a town.'));return;}
      const rest=services.find(s=>s.type==='inn'||s.type==='camp');if(rest){this.service=rest;const price=this._price();this.service=null;this.mount.append(this._action(rest.type==='camp'?'Make camp · supply required':'Rest at the inn · '+price+' G',()=>this.open(rest),{primary:true,note:rest.type==='camp'?'Use a Tent or Cottage from your bag.':'Recover living allies’ HP and spell charges.'}));}
      const labels={inn:'INN',camp:'CAMP',item:'ITEMS',weapon:'ARMORY',armor:'ARMOR',magic:'MAGIC',chapel:'CLINIC',guild:'GUILD',rumor:'NEWS'};for(const s of services){const label=labels[s.type]||s.type.toUpperCase();this.mount.append(this._row(label+' · '+s.name,s.description,this._action(this.options.navigateTo?'Walk to '+label:'Visit '+label,()=>this.options.navigateTo?this.options.navigateTo(s):this.open(s),{key:'directory-'+s.id}),s.type==='inn'?'Paid HP + magic recovery':s.type==='chapel'?'30 G · revive at 1 HP':s.type==='camp'?'Tent or Cottage required':''));}
    });
  }
  equipmentField(heroIndex=0) {
    this.open({id:'party-equipment',type:'weapon',name:'Party equipment',label:'EQUIPMENT',fieldOnly:true,stockTier:3});
    this.state.hero=Math.max(0,Math.min(this.getRPG().party.length-1,Math.floor(heroIndex)||0));this._draw();
  }
  magicField() {
    this.service=null;this.state={hero:Math.max(0,this.getRPG().party.findIndex(h=>h.spells.some(id=>['heal','revive'].includes(AVELUNE_SPELLS[id]?.kind)))),spell:null};
    this._begin('field-magic','FIELD MAGIC','The traveling spellbook',()=>{const r=this.getRPG(),h=r.party[this.state.hero];this.mount.append(this._note('Healing magic uses the same spell charges as battle. Rest at an inn or use an Ether when your charges run low.'),this._heroes(()=>this.state.spell=null),this._heroSummary(h));const healing=h.spells.filter(id=>['heal','revive'].includes(AVELUNE_SPELLS[id]?.kind));
      if(!healing.length){this.mount.append(this._note(h.name+' has no prepared field spells. Choose another caster or prepare healing magic at a town magic counter.'));return;}
      if(!healing.includes(this.state.spell))this.state.spell=healing[0];
      const spells=this._el('div',undefined,'town-spell-grid');for(const id of healing){const s=AVELUNE_SPELLS[id],b=this._action(s.name+' · Tier '+s.tier,()=>{this.state.spell=id;this.message='';this._draw();},{note:s.description,key:'field-spell-'+id});b.classList.toggle('selected',this.state.spell===id);b.setAttribute('aria-pressed',String(this.state.spell===id));spells.append(b);}this.mount.append(spells);const s=AVELUNE_SPELLS[this.state.spell],charges=h.charges[s.tier-1]||0;this.mount.append(this._note('Selected: '+s.name+' · '+charges+' tier '+s.tier+' charges remaining.'));
      if(s.target==='allAllies'){const valid=r.party.some(t=>t.hp>0&&t.hp<t.maxHp);this.mount.append(this._action('Cast '+s.name+' on the party',()=>this._run(()=>r.castField(this.state.hero,this.state.spell,0)),{primary:true,disabled:h.hp===0||!charges||!valid,note:h.hp===0?'A fallen ally cannot cast.':!charges?'Rest or use an Ether.':!valid?'Everyone standing has full HP.':'Uses one tier '+s.tier+' charge.'}));}
      else for(const [i,target]of r.party.entries()){const valid=s.kind==='revive'?target.hp===0:target.hp>0&&target.hp<target.maxHp;this.mount.append(this._row(target.name+' · '+target.role,'HP '+target.hp+' / '+target.maxHp,this._action('Cast on '+target.name,()=>this._run(()=>r.castField(this.state.hero,this.state.spell,i)),{primary:valid&&!!charges,disabled:h.hp===0||!charges||!valid,note:h.hp===0?'A fallen ally cannot cast.':!charges?'Rest or use an Ether.':!valid?(target.hp===0?'Needs revival first.':s.kind==='revive'?'Already standing.':'Already at full HP.'):'Uses one tier '+s.tier+' charge.',key:'field-target-'+target.id})));}
    });
  }
}
