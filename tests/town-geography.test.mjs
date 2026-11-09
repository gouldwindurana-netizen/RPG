import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const original=JSON.parse(fs.readFileSync(new URL('../src/world.json',import.meta.url),'utf8'));
const ctx=vm.createContext({Set,Map});
for(const file of ['world-travel','model'])vm.runInContext(fs.readFileSync(new URL('../src/'+file+'.js',import.meta.url),'utf8'),ctx);
vm.runInContext('this.api={AveluneOverworld,AveluneWorld,avelunePath}',ctx);
const {AveluneOverworld,AveluneWorld,avelunePath}=ctx.api;
const layout=AveluneOverworld.apply(structuredClone(original));
const towns=Object.values(original.areas).filter(a=>a.classicTown);
const vector={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]};
const cardinal=(dx,dy)=>Math.abs(dx)>=Math.abs(dy)?dx>=0?'east':'west':dy>=0?'south':'north';

test('town gates follow their mapped approach rather than a universal southern exit',()=>{
 assert.equal(towns.length,18);assert.equal(new Set(towns.map(a=>a.worldEntranceSide)).size,4);
 for(const town of towns){
  const approach=original.areas[town.geography.approachFrom];assert.ok(approach,town.id+' has a mapped approach');
  assert.equal(town.worldEntranceSide,cardinal(approach.x-town.x,approach.y-town.y),town.id);
  assert.equal(town.townLayoutVersion,2);assert.ok(town.note.includes(town.worldEntranceSide+' gate'),town.id+' journal names the gate');
  const [dx,dy]=vector[town.worldEntranceSide];assert.equal(town.spawn[0],town.worldExit[0]-dx*3);assert.equal(town.spawn[1],town.worldExit[1]-dy*3);
 }
 assert.ok(new Set(towns.map(a=>a.geography.districtPlan)).size>=6,'Regions have different district plans');
 assert.ok(towns.some(a=>a.geography.mirrored),'District orientation varies without rotating house façades');
});

test('waterfront towns put water and boat counters on the mapped shoreline',()=>{
 for(const town of towns.filter(a=>a.geography.waterfront)){
  const side=town.geography.waterfront,[dx,dy]=vector[side];
  const edge=side==='north'?town.terrain[0]:side==='south'?town.terrain.at(-1):town.terrain.map(row=>side==='east'?row.at(-1):row[0]).join('');
  assert.ok([...edge].filter(c=>'~='.includes(c)).length>=20,town.id+' has a real shoreline on '+side);
  for(const stop of town.stops.filter(s=>!['foot','pale_path','restored_road','door'].includes(s.mode))){
   assert.equal(town.terrain[stop.at[1]][stop.at[0]],'b',stop.id+' sits on a dock');
   assert.equal(stop.arrival[0],stop.at[0]-dx*3);assert.equal(stop.arrival[1],stop.at[1]-dy*3);
  }
 }
});

test('overworld miniatures and full towns share shore, gate, theme and entry direction',()=>{
 const flags=layout.events.map(e=>e.id);
 for(const town of towns){
  const local=layout.areas[town.id],map=layout.areas[local.overworld],node=map.mapNodes.find(n=>n.id===town.id),[dx,dy]=vector[town.worldEntranceSide];
  assert.equal(node.entranceSide,town.worldEntranceSide);assert.equal(node.waterfront,town.geography.waterfront);assert.equal(node.theme,town.theme);assert.equal(node.districtPlan,town.geography.districtPlan);
  const entrance=map.stops.find(s=>s.links.includes('OW_'+town.id));
  assert.deepEqual(Array.from(entrance.arrival),[node.at[0]+dx*3,node.at[1]+dy*3]);
  const departure=local.stops.find(s=>s.id===town.id+'_world');assert.deepEqual(Array.from(departure.arrival),[town.worldExit[0]-dx*2,town.worldExit[1]-dy*2]);
  const world=new AveluneWorld(layout,{version:2,layoutRevision:2,scene:local.id,flags});
  assert.ok(avelunePath(world,departure.at),town.id+' mapped exit is connected');
  world.id=map.id;[world.x,world.y]=entrance.arrival.map(n=>world.center(n));assert.ok(world.canStand(world.x,world.y));assert.equal(world.crossedExit(),undefined);assert.ok(avelunePath(world,entrance.at));
  if(node.waterfront){const [wx,wy]=vector[node.waterfront];assert.equal(map.terrain[node.at[1]+wy*6][node.at[0]+wx*6],'=',town.id+' miniature stands beside its mapped bay');}
 }
});
