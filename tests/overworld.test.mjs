import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx=vm.createContext({Set,Map});
for(const file of ['world-travel','model'])vm.runInContext(fs.readFileSync(new URL('../src/'+file+'.js',import.meta.url),'utf8'),ctx);
vm.runInContext('this.API={AveluneOverworld,AveluneWorld,avelunePath}',ctx);
const {AveluneOverworld:Overworld,AveluneWorld:World,avelunePath}=ctx.API;
function layout(){return Overworld.apply(JSON.parse(fs.readFileSync(new URL('../src/world.json',import.meta.url),'utf8')))}
function walk(world,to){
  const path=avelunePath(world,to);assert.ok(path,'Collision-free path in '+world.id+' to '+to);
  for(const [x,y]of path){
    const px=world.center(x),py=world.center(y);let ticks=0;
    while(Math.hypot(px-world.x,py-world.y)>.01){const dx=px-world.x,dy=py-world.y;world.move(dx,dy,Math.min(.04,Math.hypot(dx,dy)/145),true);assert.ok(++ticks<12,'Movement reaches tile in '+world.id)}
  }
}
function travelTo(world,id){
  let trips=0;
  while(world.id!==id){
    const hop=world.reachable().get(id);assert.ok(hop,world.id+' reaches '+id);
    walk(world,hop.stop.at);
    const option=world.stopOptions(hop.stop).find(o=>o.open&&o.to===hop.there);assert.ok(option,'Open onward route');
    const plan=world.planTravel(option.id);assert.ok(plan);assert.equal(world.arrive(plan),true);assert.ok(++trips<80,'Travel remains finite');
  }
}

test('town exit enters a separate wider overworld, then its miniature returns to town',()=>{
  const data=layout(),world=new World(data),town=world.area;
  assert.equal(town.classicTown,true);assert.ok(town.width<=40&&town.height<=40);
  const exit=town.stops.find(s=>s.id.endsWith('_world'));assert.ok(exit);
  walk(world,exit.at);assert.equal(world.crossedExit()?.id,exit.id);
  const plan=world.planTravel(exit.links[0]);assert.ok(plan);world.arrive(plan);
  assert.equal(world.area.kind,'overworld');assert.ok(world.area.width>town.width*2);
  assert.ok(world.area.mapNodes.some(n=>n.id===town.id));
  const entrance=world.area.stops.find(s=>s.links.includes(exit.links[0]));
  assert.ok(world.distance(entrance.at)>28,'Arrival has room to walk before re-entering');
  walk(world,entrance.at);assert.equal(world.crossedExit()?.id,entrance.id);world.arrive(world.planTravel(exit.links[0]));
  assert.equal(world.id,town.id);assert.equal(world.crossedExit(),undefined,'Return position does not bounce back outside');
});

test('overworld entrances preserve road story gates and do not replace transport links',()=>{
  const data=layout(),world=new World(data);
  assert.equal(world.canEnterArea('alderreach_02'),false);
  world.flags.add('depart');assert.equal(world.canEnterArea('alderreach_02'),true);
  assert.equal(world.canEnterArea('alderreach_04'),false);
  world.flags.add('bridge');assert.equal(world.canEnterArea('alderreach_04'),true);
  for(const route of data.travelGraph.filter(r=>['ferry','lockboat','sea_passage','coastal_boat','caravan','tallowback','skiff'].includes(r.mode))){
    const live=data.routes.find(r=>r.id===route.id);assert.ok(live,'Transport retained: '+route.id);assert.equal(live.gate,route.gate);
  }
  assert.notEqual(data.areas.isles_01.overworld,data.areas.isles_02.overworld,'Island towns keep their boat crossing');
});

test('every world entrance and departure arrival has a usable collision path',()=>{
  const data=layout(),flags=data.events.map(e=>e.id);
  for(const area of Object.values(data.areas).filter(a=>a.kind==='overworld')){
    const world=new World(data,{version:2,scene:area.id,flags});
    assert.ok(world.canStand(world.x,world.y),area.id+' spawn');
    for(const stop of area.stops){assert.ok(avelunePath(world,stop.at),area.id+' to '+stop.title);assert.ok(world.canStand(...stop.arrival.map(n=>world.center(n))),stop.id+' arrival')}
  }
});

test('old town saves migrate safely and overworld journals preserve position and progression',()=>{
  const data=layout(),old={version:1,scene:data.start,x:400,y:300,flags:['mailbag'],visited:[data.start]};
  const migrated=new World(data,old);assert.equal(migrated.x,migrated.center(migrated.area.spawn[0]));assert.equal(migrated.has('mailbag'),true);
  const exit=migrated.area.stops.find(s=>s.id.endsWith('_world'));walk(migrated,exit.at);migrated.arrive(migrated.planTravel(exit.links[0]));
  const save=migrated.snapshot(),restored=new World(data,save);
  assert.equal(JSON.stringify(restored.snapshot()),JSON.stringify(save));assert.equal(restored.area.kind,'overworld');
});

test('the complete authored story remains reachable through towns, overworlds, doors and transport',()=>{
  const data=layout(),world=new World(data);let count=0;
  while(count<data.events.length){
    const seen=world.reachable();
    const event=world.objectives()[0]?.event||data.events.find(e=>!world.has(e.id)&&seen.has(e.scene)&&e.needs.every(g=>world.has(g)));
    assert.ok(event,'Every remaining story event is reachable after '+count+' events');
    travelTo(world,event.scene);walk(world,event.at);
    const applied=world.applyEvent(event.id);assert.ok(applied&&!applied.missing&&!applied.already,event.id);count++;
  }
  assert.equal(world.has('ending'),true);assert.equal(world.has('seventh_star'),true);
  assert.equal(world.reachable().size,Object.keys(data.areas).length);
});
