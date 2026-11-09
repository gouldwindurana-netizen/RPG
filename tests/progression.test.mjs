import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx=vm.createContext({Set,Map});
for(const name of ['model','combat','campaign','town-services'])vm.runInContext(fs.readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),ctx);
vm.runInContext('this.API={AveluneWorld,AveluneRPG,AveluneCampaign,AVELUNE_SPELLS,avelunePath,AveluneDanger,AveluneTownServices}',ctx);
const {AveluneWorld,AveluneRPG,AveluneCampaign:C,AVELUNE_SPELLS:spells,avelunePath,AveluneDanger,AveluneTownServices:T}=ctx.API;
const layout=JSON.parse(fs.readFileSync(new URL('../src/world.json',import.meta.url),'utf8'));

function walkTo(world,to){
 const path=avelunePath(world,to);assert.ok(path,'A collision-free path to '+to+' in '+world.id);
 for(const [x,y]of path){const tx=world.center(x),ty=world.center(y);let loops=0;while(Math.hypot(tx-world.x,ty-world.y)>.02){const dx=tx-world.x,dy=ty-world.y;world.move(dx,dy,Math.min(.04,Math.hypot(dx,dy)/145),true);assert.ok(++loops<12,'Movement must reach tile in '+world.id);}}
}
function travelTo(world,id){
 let trips=0;while(world.id!==id){const hop=world.reachable().get(id);assert.ok(hop,world.id+' can reach '+id);walkTo(world,hop.stop.at);const option=world.stopOptions(hop.stop).find(o=>o.open&&o.to===hop.there);assert.ok(option);const plan=world.planTravel(option.id);assert.ok(plan);assert.equal(world.arrive(plan),true);assert.ok(++trips<60,'Route does not loop');}return trips;
}
function nextAvailable(world){const reachable=world.reachable();return layout.events.find(e=>!world.has(e.id)&&reachable.has(e.scene)&&e.needs.every(g=>world.has(g)));}

// Deterministic, publicly observable tactical choices. Never edits battle HP, XP or gold.
function commandsFor(rpg){
 const b=rpg.battle,alive=b.enemies.map((e,i)=>({e,i})).filter(({e})=>e.hp>0),enemy=alive[0];
 const plannedHp=rpg.party.map(h=>h.hp),stock={...rpg.inventory},commands=[];
 for(const [i,h]of rpg.party.entries()){
  if(h.hp<=0){commands.push({type:'guard'});continue;}
  const castable=h.spells.filter(id=>h.mp>=spells[id].mpCost);
  const fallen=plannedHp.findIndex(hp=>hp<=0);
  if(fallen>=0&&castable.includes('raise')){commands.push({type:'spell',spell:'raise',target:fallen});plannedHp[fallen]=rpg.party[fallen].maxHp/2;continue;}
  if(fallen>=0&&stock.revive){commands.push({type:'item',item:'revive',target:fallen});stock.revive--;plannedHp[fallen]=rpg.party[fallen].maxHp/2;continue;}
  const hurt=rpg.party.map((p,index)=>({index,ratio:plannedHp[index]/p.maxHp,missing:p.maxHp-plannedHp[index]})).filter(p=>plannedHp[p.index]>0).sort((a,c)=>a.ratio-c.ratio)[0];
  if(hurt?.ratio<.6&&castable.includes('mend')){commands.push({type:'spell',spell:'mend',target:hurt.index});plannedHp[hurt.index]+=Math.round((32+rpg.level*4)*(h.job==='whitemage'?1.2:1));continue;}
  if(hurt?.ratio<.35&&stock.potion){commands.push({type:'item',item:'potion',target:hurt.index});stock.potion--;plannedHp[hurt.index]+=70;continue;}
  if(h.spells.length&&h.mp<4&&stock.ether){commands.push({type:'item',item:'ether',target:i});stock.ether--;continue;}
  const damage=castable.filter(id=>spells[id].kind==='damage').sort((a,c)=>((spells[c].power+rpg.level*4)*(spells[c].element===enemy.e.weakness?1.6:1))-((spells[a].power+rpg.level*4)*(spells[a].element===enemy.e.weakness?1.6:1)))[0];
  if(b.round%3===0&&h.hp<enemy.e.attack*1.7-h.defense*.55){commands.push({type:'guard'});continue;}
  if(damage){commands.push({type:'spell',spell:damage,target:enemy.i});continue;}
  commands.push({type:'attack',target:enemy.i});
 }
 return commands;
}
function provision(rpg){
 // Buy only earned supplies, retaining a small inn/clinic reserve.
 for(const [item,minimum]of [['potion',5],['ether',2],['revive',1],['tent',2]])while(rpg.inventory[item]<minimum&&rpg.gold>=({potion:25,ether:65,revive:90,tent:60}[item])+30&&rpg.buy(item).ok){}
 if(rpg.level>=5&&rpg.inventory.cottage<1&&rpg.gold>=280)rpg.buy('cottage');
 for(const [hero,slot]of [[0,'armor'],[1,'weapon'],[1,'armor'],[0,'weapon']]){const q=rpg.quoteUpgrade(hero,slot);if(q.ok&&rpg.gold>=q.cost+150)rpg.upgrade(hero,slot);}
}
function recover(rpg,services){
 for(const [i,h]of rpg.party.entries())if(h.hp===0){
  if(services.inn&&rpg.gold>=30)rpg.reviveAtClinic(i,30);
  else if(rpg.inventory.revive)rpg.useItem(i,'revive');
  else {const caster=rpg.party.findIndex(p=>p.hp>0&&p.spells.includes('raise')&&p.mp>=spells.raise.mpCost);if(caster>=0)rpg.castField(caster,'raise',i)}
 }
 if(services.inn)rpg.restAtInn(services.innCost);
 if(services.camp){
  if(rpg.inventory.cottage)rpg.useFieldSupply('cottage',{camp:true});
  else for(let i=0;i<2&&rpg.inventory.tent;i++)if(rpg.party.some(h=>h.hp>0&&(h.hp<h.maxHp*.8||h.mp<h.maxMp*.5)))rpg.useFieldSupply('tent',{camp:true});
 }
}

function fight(rpg,spec){assert.equal(rpg.startBattle(spec).ok,true);let rounds=0;while(!rpg.battle.outcome&&rounds++<90)rpg.resolveRound(commandsFor(rpg));const result=rpg.finishBattle();return {event:spec.eventId,partyLevel:rpg.level,foeLevel:spec.level,rounds,outcome:result.outcome,gold:rpg.gold,xp:rpg.xp};}

export function simulateCriticalPath(seed=2026,includePostgame=false,options={}){
 const world=new AveluneWorld(layout),rpg=new AveluneRPG(null,{seed,jobs:options.jobs}),battles=[];
 let events=0,trips=0;
 while(!world.has(includePostgame?'seventh_star':'ending')){
  const event=world.objectives()[0]?.event||nextAvailable(world);assert.ok(event,'Available objective before finale');
  trips+=travelTo(world,event.scene);walkTo(world,event.at);
  const listed=T.forArea(world.area,world),services={...C.services(world.area,world),inn:listed.some(s=>s.type==='inn')};if(services.inn)recover(rpg,{inn:true,innCost:services.innCost});if(listed.some(s=>s.type==='item'))provision(rpg);
  const spec=C.bossFor(event.id,rpg,world);
  if(spec){
   const multiplier=typeof options.bossMultiplier==='function'?options.bossMultiplier(spec):options.bossMultiplier||1;
   spec.enemies.forEach(enemy=>enemy.hp=Math.round(enemy.hp*multiplier));
   // Camp recovery consumes purchased stock; there is no free-refill fixture.
   if(services.camp)recover(rpg,services);
   const result=fight(rpg,spec);battles.push(result);if(result.outcome!=='victory')return {world,rpg,battles,events,trips,failed:event.id};
  }
  const applied=world.applyEvent(event.id);assert.ok(applied&&!applied.missing&&!applied.already,event.id);C.rewardForEvent(event,rpg,world);events++;
  assert.ok(events<=layout.events.length,'Progression event loop is finite');
 }
 return {world,rpg,battles,events,trips,failed:null};
}

test('real collision movement reaches ending, all postgame events, and every area',()=>{
 const world=new AveluneWorld(layout);let events=0,trips=0;
 while(events<layout.events.length){const event=world.objectives()[0]?.event||nextAvailable(world);assert.ok(event,'Every remaining event is reachable');trips+=travelTo(world,event.scene);walkTo(world,event.at);const applied=world.applyEvent(event.id);assert.ok(applied&&!applied.missing&&!applied.already,event.id);events++;const restored=new AveluneWorld(layout,world.snapshot());assert.equal(JSON.stringify(restored.snapshot()),JSON.stringify(world.snapshot()));}
 assert.equal(world.has('seventh_star'),true);assert.equal(world.reachable().size,108);
 for(const area of Object.values(layout.areas)){trips+=travelTo(world,area.id);for(const stop of area.stops)assert.ok(avelunePath(world,stop.at),area.id+' to '+stop.id);}
 assert.equal(world.visited.size,108);assert.ok(trips>100);
});

test('default party can finish main campaign with earned rewards, legal camps and no random grinding',()=>{
 for(const seed of [1,42,2026,123456]){const result=simulateCriticalPath(seed);assert.equal(result.failed,null,JSON.stringify(result.battles));assert.equal(result.world.has('ending'),true);assert.ok(result.battles.length>=15);assert.ok(result.battles.every(b=>b.rounds<=30),'Every boss ends within 30 rounds');}
});

test('encounter danger uses traveled distance, never blocked time or frame count',()=>{
 const a=new AveluneDanger(44),b=new AveluneDanger(44);
 for(let i=0;i<1000;i++)assert.equal(a.advance(0),false);
 for(let step=0;step<20;step++)a.advance(16);
 for(let step=0;step<200;step++)b.advance(1.6);
 assert.equal(a.steps,b.steps);assert.equal(a.grace,b.grace);assert.equal(a.ratio,b.ratio);
 assert.equal(a.advance(10000,true),false);assert.equal(a.steps,0);
 a.reset(10);for(let step=0;step<10;step++)assert.equal(a.advance(16),false);assert.equal(a.steps,0);
});

test('custom physical and magical job parties can finish with earned supplies',()=>{
 for(const jobs of [['vanguard','monk','ranger','monk'],['vanguard','monk','ranger','whitemage'],['blackmage','blackmage','blackmage','blackmage']])for(const seed of [42,2026]){
  const result=simulateCriticalPath(seed,false,{jobs});
  assert.equal(result.failed,null,JSON.stringify({jobs,seed,battles:result.battles}));
  assert.ok(result.battles.every(b=>b.rounds<=30));
 }
});

test('default party can complete the optional Seventh Star path without grinding',()=>{
 const result=simulateCriticalPath(2026,true);
 assert.equal(result.failed,null,JSON.stringify(result.battles));
 assert.equal(result.world.has('seventh_star'),true);
 assert.equal(result.battles.length,29);
});
