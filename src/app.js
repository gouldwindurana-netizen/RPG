/* Avelune shell: authored world, independent combat, portable saves, and DOM menus. */
const $=id=>document.getElementById(id);
const STORE='avelune-rpg-v2';
const directions={ArrowUp:'north',KeyW:'north',ArrowDown:'south',KeyS:'south',ArrowLeft:'west',KeyA:'west',ArrowRight:'east',KeyD:'east'};
const regions=new Map(LAYOUT.regions.map(r=>[r.id,r]));
const modeName={foot:'Road',pale_path:'Pale path',restored_road:'Restored causeway',door:'Door',ferry:'Freshwater ferry',lockboat:'Lock boat',coastal_boat:'Coastal launch',sea_passage:'Ocean packet',caravan:'Caravan',tallowback:'Tallowback',skiff:'Skiff'};
const canvas=$('world'),view=new AveluneView(canvas,ART,LAYOUT.tile),pressed=new Set(),touch=new Map();
let model,rpg,battleUI,servicesUI,serviceGuide=null,pendingService=null,ready=false,started=false,transition=null,dialogKind='',returnFocus=null,goal=null;
let lastTarget='',lastTick=0,nextPrompt=0,lastSave=0,path=[],pendingEvent=null,lastHaven='alderreach_01',playSeconds=0,toastTimer=null;
let saved=loadSave(),settings={sound:saved?.settings?.sound===true};
let trackedGoal=typeof saved?.trackedGoal==='string'?saved.trackedGoal:null;
const startingCast=[['roadkeeper','Roadkeeper'],['mara','Mara'],['iven','Iven'],['sella','Sella']];
const startingJobs=['redmage','vanguard','whitemage','blackmage'];
let creationJobs=[...startingJobs],creationHero=0;
const danger=new AveluneDanger();
let audioContext=null;
function sound(cue='select'){
 if(!settings.sound)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const melodies={select:[523],step:[220],hit:[130,90],magic:[440,660,880],victory:[392,523,659,784],defeat:[220,196,147],heal:[523,659,784],travel:[330,440],confirm:[440,554,659]};const notes=melodies[cue]||melodies.select;notes.forEach((hz,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain(),t=audioContext.currentTime+i*.09;o.type=cue==='hit'?'sawtooth':'triangle';o.frequency.setValueAtTime(hz,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.045,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.14);o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+.16)})}catch{settings.sound=false;syncSound()}}
function syncSound(){$('sound-label').textContent=settings.sound?'On':'Off';$('sound-toggle').setAttribute('aria-label',settings.sound?'Mute sound':'Enable sound')}
function validSave(v){return !!(v&&v.version===2&&v.world&&Object.hasOwn(LAYOUT.areas,v.world.scene)&&v.rpg&&Array.isArray(v.world.flags)&&Array.isArray(v.rpg.party));}
function loadSave(){try{const v=JSON.parse(localStorage.getItem(STORE));return validSave(v)?v:null}catch{return null}}
function snapshot(){return {version:2,world:model.snapshot(),rpg:rpg.snapshot(),lastHaven,trackedGoal,playSeconds:Math.floor(playSeconds),settings:{sound:settings.sound}}}
function save(){if(!model||!ready||!started||transition||battleUI?.active)return false;try{const value=snapshot();localStorage.setItem(STORE,JSON.stringify(value));saved=value;$('save-state').textContent='◆ Journal saved';return true}catch{$('save-state').textContent='Session only · export in Menu';return false}}
function text(tag,value,className){const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e}
function button(title,action,note){const e=document.createElement('button');e.type='button';e.append(text('strong',title));if(note){e.className='menu-command';e.append(text('small',note))}e.addEventListener('click',()=>{sound();action()});return e}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3300)}
function clearMovement(){pressed.clear();touch.clear();path=[];pendingService=null;serviceGuide=null;if(model)model.moving=false}
function manaBar(hero){
 const bar=text('div','','mana-track');bar.dataset.manaFor=hero.id;
 bar.setAttribute('role','progressbar');bar.setAttribute('aria-label',hero.name+' mana');
 bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',String(hero.maxMp));bar.setAttribute('aria-valuenow',String(hero.mp));
 const fill=document.createElement('i');fill.style.width=(hero.maxMp?100*hero.mp/hero.maxMp:0)+'%';bar.append(fill);return bar;
}
function syncParty(){
 model.leaderId=rpg.party[0]?.id||'roadkeeper';
 $('gold').textContent=rpg.gold.toLocaleString()+' G';
 const heading=text('div','','status-heading');heading.setAttribute('aria-hidden','true');
 for(const label of ['PARTY / JOB','LV','HP','MP'])heading.append(text('span',label));
 $('party-strip').replaceChildren(heading,...rpg.party.map((h,i)=>{
  const b=button('',()=>partyMenu(i));b.className='party-mini'+(h.hp===0?' fallen':h.hp/h.maxHp<.3?' wounded':'');
  b.setAttribute('aria-label',h.name+', '+h.role+', level '+h.level+', '+h.hp+' of '+h.maxHp+' HP, '+h.mp+' of '+h.maxMp+' MP. Open status.');b.replaceChildren();
  const img=document.createElement('img');img.src=ART.heroes[h.id];img.alt='';
  const info=text('div','','mini-text');info.append(text('span',h.name,'mini-name'),text('span',h.role,'mini-job'));
  const hp=text('div','','hp-line');hp.append(text('small','HP'),text('span',h.hp+' / '+h.maxHp));
  const magic=text('div','','mp-line');magic.append(text('small','MP'),text('span',h.mp+' / '+h.maxMp,'mp-value'),manaBar(h));
  b.append(img,info,text('span',h.level,'mini-level'),hp,magic);return b;
 }));
}
function syncLocation(){
 $('place').textContent=model.area.name;$('region').textContent=(model.area.kind==='overworld'?'OVERWORLD · ':'')+regions.get(model.area.region).name.toUpperCase();$('chapter').textContent=model.chapter;
 $('visited').textContent=LAYOUT.locations.filter(l=>model.visited.has(l.id)).length+' / 70 places';
 const objectives=model.objectives();goal=objectives.find(item=>item.event.id===trackedGoal)??objectives[0]??null;trackedGoal=goal?.event.id??null;
 $('objective-tag').textContent=model.has('ending')?'THE WORLD RECONNECTED':'THE ROAD AHEAD';
 $('objective').textContent=goal?.event.title.replace(/^Resolve the /,'Face the ').replace(/ encounter$/,'')||(model.has('ending')?'The seven roads are open.':'Explore the world.');
 $('objective-detail').textContent=goal?(goal.hop?'Travel to '+LAYOUT.areas[goal.hop.there].name+'.':'Follow the gold marker. Press E to interact.'):'Visit the atlas to find optional challenges.';
 $('navigate').disabled=!goal;syncTown();
 syncDanger();syncParty();
}
function syncDanger(){const safe=AveluneCampaign.isSafe(model.area,model);$('danger-label').textContent=safe?'SAFE HAVEN':danger.ratio>.7?'THREAT NEARBY':danger.ratio>.35?'UNSETTLED':'QUIET ROAD';$('danger-label').style.color=safe?'var(--mint)':danger.ratio>.7?'#eda284':'var(--gold)';$('danger-fill').style.width=(safe?0:danger.ratio*100)+'%'}
function openDialog(kind,kicker,title,content,wide=false){if(battleUI?.active||transition)return;if(!dialogKind)returnFocus=document.activeElement;dialogKind=kind;clearMovement();$('dialog-kicker').textContent=kicker;$('dialog-title').textContent=title;$('dialog-content').replaceChildren(content);$('dialog').classList.toggle('wide',wide);$('veil').hidden=false;$('interact').hidden=true;$('close-dialog').focus()}
function closeDialog(){dialogKind='';$('veil').hidden=true;returnFocus?.focus?.();returnFocus=null;lastTarget=''}
function notice(kicker,title,body,missing=[]){const content=document.createElement('div');content.append(text('p',body));if(missing.length){const list=document.createElement('div');list.className='journal-grid';for(const row of missing)list.append(text('div',row,'journal-entry'));content.append(list)}content.append(button('Continue →',closeDialog));openDialog('notice',kicker,title,content)}
function journal(){
 if(dialogKind==='journal'){closeDialog();return}const panel=document.createElement('div');panel.append(text('p',model.area.note));
 panel.append(text('h3','The road ahead','journal-section'));const grid=document.createElement('div');grid.className='journal-grid';
 for(const {event,hop}of model.objectives()){const entry=button(event.title.replace(/^Resolve the /,'Face the ').replace(/ encounter$/,''),()=>{trackedGoal=event.id;goal={event,hop};$('objective').textContent=event.title;$('objective-detail').textContent=hop?'Travel to '+LAYOUT.areas[hop.there].name+'.':'Follow the gold marker.';closeDialog();navigate()},LAYOUT.areas[event.scene].name+(hop?' · via '+LAYOUT.areas[hop.there].name:''));entry.className='journal-entry';grid.append(entry)}panel.append(grid);
 panel.append(text('h3','The seven hearths','journal-section'));const chips=document.createElement('div');chips.className='chips';for(const [flag,label]of [['alderreach','Alderreach'],['veyra','Veyra'],['kharad','Kharad'],['sereva','Sereva'],['isles','Isles'],['ordel','Ordel'],['ending','Edrin'],['skiff','Skiff']])chips.append(text('span',(model.has(flag)?'◆ ':'◇ ')+label,'chip'+(model.has(flag)?' ready':'')));panel.append(chips);
 const complete=LAYOUT.events.filter(e=>model.has(e.id));if(complete.length){panel.append(text('h3','Recent entries','journal-section'));for(const e of complete.slice(-5).reverse())panel.append(text('p',e.text))}
 openDialog('journal','ROAD JOURNAL',model.chapter,panel);
}
function partyMenu(index=0){
 if(!started)return;const h=rpg.party[index],job=AVELUNE_JOBS[h.job],panel=document.createElement('div');
 const tabs=document.createElement('div');tabs.className='party-tabs';rpg.party.forEach((hero,i)=>{const b=button(hero.name,()=>partyMenu(i));b.classList.toggle('selected',i===index);tabs.append(b)});panel.append(tabs);
 const overview=text('div','','hero-overview'),img=document.createElement('img');img.src=ART.heroes[h.id];img.alt=h.name;
 const info=text('div','','status-details');info.append(text('h3',h.role+' · Level '+h.level),text('div','HP '+h.hp+'/'+h.maxHp+'   ATK '+h.attack+'   DEF '+h.defense+'   SPD '+h.speed,'stats'),text('p','MP '+h.mp+' / '+h.maxMp,'status-mana-value'),manaBar(h));overview.append(img,info);panel.append(overview);
 panel.append(text('p',job.description),text('p',job.passive),text('p','Chosen at the start: '+job.name+'. Jobs stay fixed for this journey. Promotion develops this same calling.','calling-locked'));
 panel.append(text('h3','Equipment & magic','journal-section'));panel.append(text('p',(h.equippedGear?.weapon?AVELUNE_GEAR[h.equippedGear.weapon].name:job.weapon+' +'+Math.min(h.equipment.weapon,job.weaponCap))+' · '+(h.equippedGear?.armor?AVELUNE_GEAR[h.equippedGear.armor].name:job.armor+' +'+Math.min(h.equipment.armor,job.armorCap))+'. '+(h.spells.length?h.spells.map(id=>AVELUNE_SPELLS[id].name+' ('+AVELUNE_SPELLS[id].mpCost+' MP)').join(' · '):'This job relies on physical attacks and items.')));panel.append(text('p','Party XP '+rpg.xp+' / '+rpg.nextLevelXP+' · Advanced spells unlock at level 5.','small-note'));
 panel.append(button('Equip weapons and armor',()=>servicesUI.equipmentField(index),'Choose from the equipment your party owns.'),button('Cast healing magic',()=>servicesUI.magicField(),'Recover HP using the same mana pool as battle.'));
 openDialog('party','PARTY STATUS',h.name,panel,true);
}
function bagMenu(){const panel=document.createElement('div');panel.append(text('p','Choose a supply, then the ally who needs it.'));for(const [id,item]of Object.entries(AVELUNE_ITEMS)){const row=document.createElement('div');row.className='info-line';const info=document.createElement('div');info.append(text('strong',item.name+' ×'+rpg.inventory[id]),text('small',item.description));const b=button(item.fieldOnly?'Make camp':'Use',()=>item.fieldOnly?useCampingSupply(id):itemTarget(id));b.disabled=!rpg.inventory[id];row.append(info,b);panel.append(row)}openDialog('bag','TRAVEL SUPPLIES','The mailbag',panel)}
function itemTarget(id){const panel=document.createElement('div');panel.className='actions';for(const [i,h]of rpg.party.entries())panel.append(button(h.name+' · '+h.hp+'/'+h.maxHp+' HP',()=>{const result=rpg.useItem(i,id);if(result.ok){sound('heal');syncParty();save();bagMenu();toast(result.text)}else toast(result.text)},h.role+' · MP '+h.mp+' / '+h.maxMp));panel.append(button('← Back',bagMenu));openDialog('itemtarget','USE '+AVELUNE_ITEMS[id].name.toUpperCase(),'Choose an ally',panel)}
function townServices(){
 const list=AveluneTownServices.forArea(model.area,model);
 if(!list.length&&AveluneCampaign.services(model.area,model).camp)list.push({id:model.id+':camp',type:'camp',name:'Roadkeeper’s camp',label:'REST',at:[Math.floor(model.x/16),Math.floor(model.y/16)],stockTier:1,description:'A sheltered campsite. Use a Tent or Cottage to recover before the next stretch.'});
 return list;
}
function syncTown(){
 const list=townServices(),strip=$('town-strip');strip.hidden=!list.length;$('open-services').disabled=!list.length;
 strip.replaceChildren();if(!list.length)return;
 strip.append(text('strong','TOWN SERVICES · '+model.area.name));
 for(const [types,label]of [[['inn','camp'],'Inn · Heal'],[['item'],'Item shop'],[['weapon','armor'],'Armory'],[['magic'],'Magic shop'],[['chapel'],'Revive']]){
  const service=list.find(s=>types.includes(s.type));if(!service)continue;const b=button(service.type==='camp'?'Camp · Supplies':label,()=>guideToService(service));if(types.includes('inn'))b.className='town-heal';strip.append(b);
 }
 strip.append(button('All services',()=>haven()));
}
function haven(){if(!started)return;servicesUI.directory(townServices());}
function guideToService(service){
 if(!started||!ready||transition||battleUI.active)return;
 closeDialog();clearMovement();
 const candidates=[[service.at[0],service.at[1]+1],[service.at[0]-1,service.at[1]],[service.at[0]+1,service.at[1]],[service.at[0],service.at[1]-1],service.at];
 const routes=candidates.map(at=>({at,path:avelunePath(model,at)})).filter(r=>r.path);
 routes.sort((a,b)=>a.path.length-b.path.length);
 if(!routes.length){toast('Walk closer to the '+service.name+'.');return;}
 if(!routes[0].path.length){servicesUI.open(service);return;}
 path=routes[0].path;serviceGuide=service;pendingService=service;toast('Walking to '+service.name+'. A direction key cancels.');
}
function finishServiceWalk(){if(!pendingService)return;const service=pendingService;pendingService=null;serviceGuide=null;servicesUI.open(service);}
function restAtService(service){
 if(!started||battleUI.active||transition)return{ok:false,text:'Finish the current encounter first.'};
 const cost=8+AveluneCampaign.recommendedLevel(model.area,model)*3;
 const result=service.type==='camp'?rpg.useFieldSupply(service.supply,{camp:true,outdoors:!model.area.indoor}):rpg.restAtInn(cost);
 if(result.ok){lastHaven=model.id;danger.reset();sound('heal');syncLocation();save();closeDialog();}
 return result;
}
function useCampingSupply(id){
 const camping=AveluneCampaign.services(model.area,model).camp;
 const result=rpg.useFieldSupply(id,{outdoors:!model.area.indoor&&!['dungeon','finale','postgame'].includes(model.area.kind),camp:camping});
 if(result.ok){danger.reset(10);sound('heal');syncLocation();save();bagMenu();}toast(result.text);
}

function help(){const panel=document.createElement('div');panel.className='help-grid';for(const [title,body]of [['Walk the road','Move with WASD or arrow keys; hold Shift to run. Click the ground to walk there. The gold marker shows the next objective. Follow marker walks to it; press E to interact.'],['Plan your round','Choose an order for each living hero, then execute. Attack a foe, exploit its elemental weakness, heal an ally, or guard before a heavy strike. The front of your party draws more attacks.'],['Choose your jobs','Choose all four jobs before beginning a new journey. Those jobs stay fixed. Status shows their equipment and spells; guilds arrange formation and promote the same job. Advanced spells unlock at level 5.'],['Prepare and recover','HP and mana persist between battles. Every spell has an MP cost. Inns, Ethers and camping supplies replenish mana. Use the signed INN, ITEMS, ARMS, MAGIC, CLINIC and GUILD counters in town. Town lists them, and its Walk buttons guide you there. Paid inns heal standing allies; clinics revive fallen allies. Camps require a Tent or Cottage. F opens field healing magic; tents work outdoors. A defeat returns you to your haven with a small gold loss.'],['Explore the seven kingdoms','Restore Hearths to open roads, ferries and the Skiff. The Journal lists available objectives. The Atlas shows all regions. Random encounters only build danger while you move through hostile areas.'],['Keep your journey','Your journal saves automatically outside battle and after resting. Menu → Save journal saves immediately. Use Menu to export a backup or import it on another browser. Sound is optional. Keyboard and touch are supported.']]){const e=document.createElement('div');e.append(text('h3',title),text('p',body));panel.append(e)}openDialog('help','ROADKEEPER’S HANDBOOK','How to play',panel,true)}
function pauseMenu(){if(!started)return;const panel=document.createElement('div');panel.className='actions';panel.append(text('p',model.chapter+' · '+Math.floor(playSeconds/60)+' minutes on the road'),button('Return to the road',closeDialog),button('Save journal',()=>{toast(save()?'Journal saved.':'Export a journal backup to keep this session.')}),button('How to play',help),button(settings.sound?'Mute sound':'Enable sound',()=>{settings.sound=!settings.sound;syncSound();sound('confirm');save();pauseMenu()}),button('Export journal',exportSave,'Download a portable backup of your progress.'),button('Import journal',()=>{$('import-save').value='';$('import-save').click()},'Choose a journal exported from this game.'),button('Return to title',()=>{save();closeDialog();started=false;clearMovement();$('title-screen').hidden=false;syncTitle()}));openDialog('pause','YOUR JOURNEY','Roadkeeper’s journal',panel)}
function exportSave(){save();const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Avelune-journal.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('Journal exported.')}
function confirmNew(){creationJobs=[...startingJobs];creationHero=0;partyCreation();}
function partyCreation(focus){
 const panel=text('div','','party-creation');
 panel.append(text('p','Choose one job for each companion. You may use the same job more than once. These choices stay fixed for the whole journey.','creation-intro'));
 if(saved)panel.append(text('p','Your current journal is kept until you choose Begin adventure. Export it from Menu first if you want a backup.','small-note'));
 const tabs=text('div','','creation-heroes');
 startingCast.forEach(([id,name],i)=>{const tab=button(name,()=>{creationHero=i;partyCreation({hero:i})},AVELUNE_JOBS[creationJobs[i]].name);tab.dataset.hero=String(i);tab.classList.toggle('selected',i===creationHero);tab.setAttribute('aria-pressed',String(i===creationHero));tabs.append(tab)});panel.append(tabs);
 const [id,name]=startingCast[creationHero],job=AVELUNE_JOBS[creationJobs[creationHero]],preview=text('div','','creation-preview'),portrait=document.createElement('img');portrait.src=ART.heroes[id];portrait.alt='';
 const details=text('div');details.append(text('h3',name+' · '+job.name),text('p','HP '+job.hp+' · MP '+job.mp+' · ATK '+job.attack+' · DEF '+job.defense,'stats'),text('p',job.passive,'small-note'));preview.append(portrait,details);panel.append(preview);
 const grid=text('div','','job-grid creation-jobs');
 for(const [jobId,choice]of Object.entries(AVELUNE_JOBS)){
  const card=button(choice.name,()=>{creationJobs[creationHero]=jobId;partyCreation({job:jobId})},choice.description);card.className='job-card creation-job'+(creationJobs[creationHero]===jobId?' selected':'');card.dataset.startJob=jobId;card.setAttribute('aria-pressed',String(creationJobs[creationHero]===jobId));grid.append(card);
 }panel.append(grid);
 const summary=text('div','','creation-summary');startingCast.forEach(([,heroName],i)=>summary.append(text('span',heroName+' · '+AVELUNE_JOBS[creationJobs[i]].name)));panel.append(summary);
 const actions=text('div','','creation-actions'),begin=button('Begin adventure',()=>{if(dialogKind==='party-creation')startGame(null,[...creationJobs])},'Confirm all four jobs and begin the story.');begin.id='begin-adventure';begin.classList.add('primary');actions.append(begin,button('Cancel',closeDialog));panel.append(actions);
 openDialog('party-creation','A NEW JOURNEY','Choose your party’s jobs',panel,true);
 if(focus?.job)panel.querySelector('[data-start-job="'+focus.job+'"]').focus({preventScroll:true});
 else if(focus&&Number.isInteger(focus.hero))panel.querySelector('[data-hero="'+focus.hero+'"]').focus({preventScroll:true});
}
function syncTitle(){$('continue-game').hidden=!saved;$('new-game').textContent='New game';$('new-game').classList.toggle('primary',!saved)}
async function startGame(data,jobs){trackedGoal=typeof data?.trackedGoal==='string'?data.trackedGoal:null;closeDialog();clearMovement();started=true;ready=false;model=new AveluneWorld(LAYOUT,data?.world);rpg=new AveluneRPG(data?.rpg,{jobs:data?undefined:jobs});lastHaven=Object.hasOwn(LAYOUT.areas,data?.lastHaven)?data.lastHaven:'alderreach_01';playSeconds=Number.isFinite(data?.playSeconds)?Math.max(0,data.playSeconds):0;battleUI.rpg=rpg;danger.reset();$('title-screen').hidden=true;await enterStartingArea();if(!data)notice('PROLOGUE','A road worth keeping','Grandmother Wyla has found a road that is missing from every map. First, collect the repaired mailbag from her cottage. Follow the gold marker, then press E. Your party’s jobs are fixed; spells spend MP from the blue mana bars. Town counters sell supplies, equipment and magic. Inns charge for recovery; clinics revive fallen allies. Leave by the '+(model.area.worldEntranceSide||'south')+' gate to explore the wider world.');sound('confirm')}

function anchorFor(area) {
  let anchor=area;
  while (anchor.parent) anchor=LAYOUT.areas[anchor.parent];
  const exact=LAYOUT.locations.find(loc=>loc.id===anchor.id);
  if (exact) return exact;
  const nearby=LAYOUT.locations.filter(loc=>loc.region===anchor.region);
  return nearby.reduce((a,b)=>Math.hypot(a.x-anchor.x,a.y-anchor.y)
    <=Math.hypot(b.x-anchor.x,b.y-anchor.y)?a:b);
}

function atlas() {
  if (dialogKind==='atlas') { closeDialog(); return; }
  const panel=document.createElement('div');
  panel.className='atlas-grid';
  const map=document.createElement('div');
  map.className='world-map';
  const image=document.createElement('img');
  image.src=ART.world;
  image.alt='Illustrated world map of Avelune with seven regions and the central Pale ring';
  image.width=1536; image.height=1024;
  map.append(image);
  const sidebar=document.createElement('div');
  sidebar.className='atlas-info';
  const picker=document.createElement('select');
  picker.setAttribute('aria-label','Choose a map location');
  const thumb=document.createElement('canvas');
  thumb.width=112; thumb.height=112;
  thumb.setAttribute('aria-hidden','true');
  const info=document.createElement('div');
  sidebar.append(picker,thumb,info);
  const pins=new Map();
  const here=anchorFor(model.area);
  function select(id) {
    const place=LAYOUT.locations.find(loc=>loc.id===id);
    if (!place) return;
    picker.value=id;
    for (const [key,pin] of pins) {
      pin.classList.toggle('current',key===id);
      pin.setAttribute('aria-pressed',String(key===id));
    }
    view.thumbnail(thumb,place.art.frame);
    const subtitle=place.id===here.id?'LOCAL MAP ANCHOR':model.visited.has(id)?'VISITED':'WORLD ATLAS';
    info.replaceChildren(text('p',subtitle,'eyebrow'),text('h3',place.name),
      text('p',regions.get(place.region).name),text('p',place.note));
  }
  for (const region of LAYOUT.regions) {
    const group=document.createElement('optgroup');
    group.label=region.name;
    for (const loc of LAYOUT.locations.filter(place=>place.region===region.id)) {
      const option=text('option',loc.name);
      option.value=loc.id;
      group.append(option);
      const pin=document.createElement('button');
      pin.type='button';
      pin.className='pin';
      pin.style.left=loc.x+'%'; pin.style.top=loc.y+'%';
      pin.style.setProperty('--pin',region.color);
      pin.title=loc.name;
      pin.setAttribute('aria-label',loc.name);
      pin.addEventListener('click',()=>select(loc.id));
      pins.set(loc.id,pin);
      map.append(pin);
    }
    picker.append(group);
  }
  picker.addEventListener('change',()=>select(picker.value));
  panel.append(map,sidebar);
  select(here.id);
  openDialog('atlas','TRAVEL REFERENCE','World Atlas',panel,true);
}
function commitEvent(event){const result=model.applyEvent(event.id);if(!result||result.missing||result.already)return null;const reward=AveluneCampaign.rewardForEvent(event,rpg,model);syncLocation();save();if(event.id==='ending'){ending();return result}notice('ROAD JOURNAL',event.title.replace(/^Resolve the /,'Beyond the ').replace(/ encounter$/,''),event.text+(reward.text?'\n\n'+reward.text:''));return result}
function interact(){if(!started||!ready||transition||dialogKind||battleUI.active)return;clearMovement();const target=model.target();if(!target){toast('Walk closer to a door, character, or gold marker.');return}sound('select');if(target.type==='service'){servicesUI.open(target.service);return}if(target.type==='event'){const missing=model.requirements(target.needs);if(missing.length){notice('THE ROAD AHEAD',target.title,'This work depends on a few earlier steps.',missing);return}const spec=AveluneCampaign.bossFor(target.id,rpg,model);if(spec){startBattle(spec,target);return}commitEvent(target);return}
 const options=model.stopOptions(target);if(!VesselModes.has(target.mode)){const option=options[0];if(option.open)travel(option.id);else notice('PASSAGE CLOSED',option.title,option.note||'Complete the work that opens this road.',option.missing);return}
 const panel=document.createElement('div');panel.className='actions';panel.append(text('p','Choose your next destination.'));for(const route of options){const b=button(route.title,()=>travel(route.id),route.open?'Board the '+modeName[target.mode].toLowerCase():route.missing.join(' · '));b.disabled=!route.open;panel.append(b)}openDialog('transport',modeName[target.mode].toUpperCase(),target.title,panel);
}
function startBattle(spec,event=null){save();pendingEvent=event;clearMovement();closeDialog();$('interact').hidden=true;danger.reset(10);const result=battleUI.start(spec);if(result===false){pendingEvent=null;toast('The encounter could not begin.')}sound('confirm')}
async function afterBattle(result){
 clearMovement();danger.reset(12);const event=pendingEvent;pendingEvent=null;
 if(result.outcome==='victory'&&event){commitEvent(event)}
 else if(result.outcome==='defeat'){ready=false;model.id=lastHaven;[model.x,model.y]=model.area.spawn.map(n=>model.center(n));await enterStartingArea();notice('A LIGHT STILL BURNS','Back at the haven',result.summary?.text||'Your companions carry you back to safety. You are rested and ready to try again. A little gold was lost along the way.');}
 syncLocation();save();lastTarget='';
}
function ending(){const panel=document.createElement('div');panel.className='ending-copy';panel.append(text('div','✦','ending-mark'),text('h3','The roads we keep'),text('p','The Hollow Crown falls. Seven hearths answer one another, and the burden is shared at last. From Brackenwell to Edrin, lamps are lit along a road that no longer has to be forgotten.'),text('p','Wyla’s lullaby rises from an open window. The journey has brought you home.'),text('p','THE END · '+rpg.battlesWon+' battles won · Level '+rpg.level,'kicker'),button('Return to the restored world',closeDialog,'The Unwritten, Sixfold trials, and Seventh Star await.'));sound('victory');openDialog('ending','THE SEVENTH HEARTH','The world, reconnected',panel)}
async function travel(id){if(!ready||transition||battleUI.active)return;const plan=model.planTravel(id);if(!plan)return;closeDialog();clearMovement();$('interact').hidden=true;const conveyance=VesselModes.has(plan.route.mode),duration=view.reduce?80:conveyance?850:160;transition={plan,start:performance.now(),duration};$('travel-caption').textContent=(conveyance?modeName[plan.route.mode]+' · ':'')+LAYOUT.areas[plan.to].name;$('travel-caption').hidden=false;try{const [images]=await Promise.all([view.prepare(plan.to),new Promise(r=>setTimeout(r,duration))]);model.arrive(plan);view.enter(model.area,images);danger.reset(6);if(AveluneCampaign.services(model.area,model).inn)lastHaven=model.id;syncLocation();sound('travel')}catch(error){transition=null;$('travel-caption').hidden=true;notice('PASSAGE PAUSED','Unable to load this area',error.message);return}transition=null;$('travel-caption').hidden=true;lastTarget='';save()}
function navigate(){if(!goal||dialogKind||battleUI.active||transition||!started)return;pendingService=null;serviceGuide=null;path=[];const at=goal.hop?.stop.at??goal.event.at;path=avelunePath(model,at)||[];if(!path.length){if(model.distance(at)<28)interact();else toast('The direct path is blocked. Check nearby passages.')}else toast('Following the gold marker. Press a direction to stop.')}
function walkTo(at){if(!started||dialogKind||transition||battleUI.active)return;pendingService=null;serviceGuide=null;path=avelunePath(model,at)||[];if(!path.length)toast('Choose an open part of the road.')}
function inputFrame(seconds){if(!ready||!started||dialogKind||transition||battleUI.active)return;const d=new Set([...pressed].map(key=>directions[key]).filter(Boolean));for(const value of touch.values())d.add(value);let dx=Number(d.has('east'))-Number(d.has('west')),dy=Number(d.has('south'))-Number(d.has('north'));if(dx||dy){path=[];pendingService=null;serviceGuide=null;}let run=pressed.has('ShiftLeft')||pressed.has('ShiftRight');if(!dx&&!dy&&path.length){const [px,py]=path[0].map(n=>model.center(n)),distance=Math.hypot(px-model.x,py-model.y);if(distance<4){model.x=px;model.y=py;path.shift();if(!path.length){model.moving=false;finishServiceWalk();return}}else{dx=px-model.x;dy=py-model.y;run=true}}
 const old=[model.x,model.y];model.move(dx,dy,seconds,run);const moved=Math.hypot(model.x-old[0],model.y-old[1]);if(moved){const safe=AveluneCampaign.isSafe(model.area,model);if(danger.advance(moved,safe)){const spec=AveluneCampaign.encounterFor(model.area,rpg,model);if(spec){startBattle(spec);return}}syncDanger();const stop=model.crossedExit();if(stop)travel(stop.links[0]);}
}
function refreshPrompt(){const target=!dialogKind&&!transition&&!battleUI.active&&ready&&started?model.target():null,key=target?.id??'';if(key===lastTarget)return;lastTarget=key;$('interact').hidden=!target;if(!target)return;if(target.type==='service'){$('interact-label').textContent=target.service.label+' · '+target.name;return;}$('interact-label').textContent=target.type==='event'?target.title.replace(/^Resolve the /,'Face the ').replace(/ encounter$/,''):(model.stopOptions(target).some(o=>o.open)?'':'Closed · ')+(target.mode==='door'||target.mode==='entrance'?'Enter ':WalkModes.has(target.mode)?'Toward ':'Board at ')+target.title;}
function frame(time){const seconds=Math.max(0,Math.min(.05,(time-lastTick)/1000));lastTick=time;inputFrame(seconds);if(started&&ready&&!dialogKind&&!battleUI.active)playSeconds+=seconds;if(ready&&!battleUI.active){if(transition&&VesselModes.has(transition.plan.route.mode))view.passage(transition.plan.route.mode,Math.min(1,(time-transition.start)/transition.duration));else view.frame(model,time,serviceGuide?.at??goal?.hop?.stop.at??goal?.event.at);if(time>nextPrompt){refreshPrompt();nextPrompt=time+90}if(time-lastSave>5000){save();lastSave=time}}requestAnimationFrame(frame)}
async function enterStartingArea(){$('loading').textContent='Opening the road…';$('loading').hidden=false;try{view.enter(model.area,await view.prepare(model.id));ready=true;$('loading').hidden=true;syncLocation();save()}catch(error){$('loading').textContent=error.message+'. Reload to try again.'}}
function moveMenuFocus(event,container){
 if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)||['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return false;
 const choices=[...container.querySelectorAll('button:not(:disabled),a[href]')].filter(el=>el.getClientRects().length);
 if(!choices.length)return false;
 const index=choices.indexOf(document.activeElement),step=['ArrowUp','ArrowLeft'].includes(event.code)?-1:1;
 const next=index<0?(step>0?0:choices.length-1):(index+step+choices.length)%choices.length;
 event.preventDefault();choices[next].focus();choices[next].scrollIntoView({block:'nearest'});return true;
}
window.addEventListener('keydown',event=>{
 if(battleUI?.active)return;
 const menu=dialogKind?$('dialog'):!$('title-screen').hidden?document.querySelector('.title-actions'):null;
 if(menu&&moveMenuFocus(event,menu))return;
 if(event.code==='Tab'&&dialogKind){const els=[...$('dialog').querySelectorAll('button:not(:disabled),select,input,a[href]')].filter(e=>e.getClientRects().length);if(els.length){const first=els[0],last=els.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}return}
 if(event.code==='Escape'){event.preventDefault();if(dialogKind)closeDialog();else if(started)pauseMenu();return}if(['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;if(!started||!ready||transition)return;if(dialogKind){if((event.code==='Enter'||event.code==='KeyE')&&dialogKind==='notice'){event.preventDefault();closeDialog()}return}
 const shortcuts={KeyM:atlas,KeyJ:journal,KeyP:()=>partyMenu(0),KeyI:bagMenu,KeyH:()=>haven(),KeyF:()=>servicesUI.magicField()};if(!event.repeat&&shortcuts[event.code]){event.preventDefault();shortcuts[event.code]();return}if(directions[event.code]||event.code.startsWith('Shift')){pressed.add(event.code);if(directions[event.code])event.preventDefault()}else if(!event.repeat&&(event.code==='KeyE'||(event.code==='Space'&&event.target.tagName!=='BUTTON'))){event.preventDefault();interact()}
});window.addEventListener('keyup',e=>pressed.delete(e.code));window.addEventListener('blur',()=>{clearMovement();save()});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearMovement();save()}});
for(const [id,fn]of Object.entries({'open-atlas':atlas,'open-journal':journal,'open-party':()=>partyMenu(0),'open-bag':bagMenu,'open-services':()=>haven(),'open-magic':()=>servicesUI.magicField(),'open-menu':pauseMenu,'close-dialog':closeDialog,interact,'touch-act':interact,navigate,'title-help':help,'new-game':confirmNew,'continue-game':()=>startGame(saved)}))$(id).addEventListener('click',fn);
$('brand-home').addEventListener('click',e=>{e.preventDefault();pauseMenu()});$('sound-toggle').addEventListener('click',()=>{settings.sound=!settings.sound;syncSound();sound('confirm');save()});$('veil').addEventListener('click',e=>{if(e.target===$('veil'))closeDialog()});
for(const btn of document.querySelectorAll('[data-move]')){btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);path=[];touch.set(e.pointerId,btn.dataset.move)});for(const type of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(type,e=>touch.delete(e.pointerId))}
canvas.addEventListener('pointerdown',event=>{if(!view.camera)return;const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*canvas.width+view.camera.x,y=(event.clientY-rect.top)/rect.height*canvas.height+view.camera.y;walkTo([Math.floor(x/model.tile),Math.floor(y/model.tile)])});
$('import-save').addEventListener('change',async()=>{const file=$('import-save').files[0];if(!file)return;try{if(file.size>200000)throw Error('This journal is too large.');const data=JSON.parse(await file.text());if(!validSave(data))throw Error('This is not an Avelune journal.');const panel=document.createElement('div');panel.className='actions';panel.append(text('p','Replace your current journey with the imported journal?'),button('Load imported journal',()=>startGame(data)),button('Keep current journey',closeDialog));openDialog('import','ROAD JOURNAL','Load your journey',panel)}catch(error){toast(error.message)}});
model=new AveluneWorld(LAYOUT,saved?.world);rpg=new AveluneRPG(saved?.rpg);battleUI=new AveluneBattleUI(rpg,{onEnd:afterBattle,onSound:sound});
servicesUI=new AveluneServicesUI({getRPG:()=>rpg,getWorld:()=>model,openDialog,closeDialog,onChange:()=>{syncLocation();save()},onRest:restAtService,onSound:sound,toast,navigateTo:guideToService});
if(ART.landscape)document.querySelector('.title-art').style.backgroundImage='url("'+ART.landscape+'")';syncSound();syncTitle();enterStartingArea();requestAnimationFrame(frame);
if(new URLSearchParams(location.search).has('test'))window.__avelune={get world(){return model},get rpg(){return rpg},get battle(){return battleUI},get danger(){return danger},get state(){return{started,ready,dialogKind,transition:!!transition,pathLength:path.length,goal:goal?.event.id,save:snapshot()}},startGame,interact,travel,navigate,closeDialog,syncLocation,startBattle,commitEvent,save,guideToService,townServices,get servicesUI(){return servicesUI},async visit(id,at){model.id=id;[model.x,model.y]=(at||model.area.spawn).map(n=>model.center(n));model.visited.add(id);danger.reset();await enterStartingArea()}};
