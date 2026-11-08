import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const layout=JSON.parse(fs.readFileSync(new URL('../src/world.json',import.meta.url),'utf8'));
const c=vm.createContext({Set,Map});vm.runInContext(fs.readFileSync(new URL('../src/model.js',import.meta.url),'utf8'),c);vm.runInContext('this.api={AveluneWorld,avelunePath}',c);
const towns=Object.values(layout.areas).filter(a=>['village','town','port','market'].includes(a.kind));
const worldFor=a=>new c.api.AveluneWorld(layout,{scene:a.id});

test('every settlement is a compact town with a plaza, commercial streets and a southern overworld exit',()=>{
 assert.equal(towns.length,18);
 for(const a of towns){
  assert.equal(a.classicTown,true,a.id);assert.ok(a.width<=36&&a.height<=34,a.id);
  assert.deepEqual(a.worldExit,[Math.floor(a.width/2),a.height-2],a.id);
  assert.ok(a.terrain.some(row=>row.includes('ppppp')),a.id+' has a central paved square');
  assert.ok(a.terrain.every(row=>row.length===a.width)&&a.collision.every(row=>row.length===a.width),a.id);
  const world=worldFor(a);
  for(const point of [a.worldExit,...a.stops.flatMap(s=>[s.at,s.arrival]),...a.events.map(e=>e.at)]){
   assert.ok(world.canStand(world.center(point[0]),world.center(point[1])),a.id+' passable '+point);
   assert.ok(c.api.avelunePath(world,point),a.id+' connected '+point);
  }
 }
});

test('each compact town keeps seven distinct reachable service frontages',()=>{
 for(const a of towns){
  const points=['inn','item','weapon','magic','chapel','guild','rumor'].map(role=>a.serviceSpots[role]);
  const world=worldFor(a);assert.equal(new Set(points.map(p=>p.join(','))).size,7,a.id);
  for(const at of points){assert.ok(c.api.avelunePath(world,at),a.id+' service '+at);for(const other of points)if(at!==other)assert.ok(Math.hypot(at[0]-other[0],at[1]-other[1])>=3,a.id);}
 }
});

test('town story doors face buildings and relocated events agree with the global journal',()=>{
 for(const a of towns){
  for(const s of a.stops.filter(s=>s.mode==='door'))assert.ok(a.objects.some(o=>o.x===s.at[0]&&o.y===s.at[1]-1&&o.width===64),s.id+' has its building directly behind the door');
  for(const e of a.events){const global=layout.events.find(g=>g.id===e.id);assert.deepEqual(e.at,global.at,e.id);assert.ok(a.objects.some(o=>o.asset===e.asset&&o.x===e.at[0]&&o.y===e.at[1]-1),e.id+' has a story fixture');}
 }
 const home=layout.areas.alderreach_01;
 for(const name of ['Wyla’s cottage','Tilda’s Smithy-Inn','Festival Barn','Orchard press','Communal bakehouse'])assert.ok(home.objects.some(o=>o.name===name),name);
});
