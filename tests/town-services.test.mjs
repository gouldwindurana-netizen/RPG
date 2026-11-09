import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ module: { exports: {} }, Set, Map });
for (const file of ['model.js', 'campaign.js', 'town-services.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), context);
}
const { World, Campaign, Town, path } = vm.runInContext('({World:AveluneWorld,Campaign:AveluneCampaign,Town:AveluneTownServices,path:avelunePath})', context);
const layout = JSON.parse(fs.readFileSync(new URL('../src/world.json', import.meta.url), 'utf8'));
const fullHubs = Object.values(layout.areas).filter(area => ['village','town','port','market'].includes(area.kind));
const clone = value => JSON.parse(JSON.stringify(value));
const model = (area = layout.start, flags = []) => new World(layout, {scene:area, flags});

test('every village, town, port and market has visible recovery and separate shopping frontages', () => {
  assert.ok(fullHubs.length >= 18);
  for (const area of fullHubs) {
    const world = model(area.id);
    const services = Town.forArea(area, world);
    assert.equal(services.length, 7, area.id);
    assert.deepEqual(Array.from(services, service => service.type).sort(), ['chapel','guild','inn','item','magic','rumor','weapon']);
    assert.ok(services.find(service => service.type === 'weapon').catalogs.includes('armor'), area.id);
    assert.deepEqual(Array.from(services.find(service => service.type === 'magic').catalogs), ['white','black']);
    assert.equal(Campaign.isSafe(area, world), true, area.id);
    for (const service of services) {
      assert.ok(service.id.startsWith(`${area.id}:service:`));
      assert.ok(service.label && service.description && service.source, service.id);
      assert.equal(service.solid, false, service.id);
    }
  }
});

test('service tiles are reachable, distinct, spaced from story events and authored doors', () => {
  for (const area of Object.values(layout.areas)) {
    const world = model(area.id);
    const services = Town.forArea(area, world);
    const occupied = new Set();
    const protectedPoints = [...area.events.map(event => event.at), ...area.stops.flatMap(stop => [stop.at,stop.arrival].filter(Boolean)), area.spawn];
    for (const service of services) {
      const [x,y] = service.at;
      assert.equal(world.canStand(world.center(x),world.center(y)), true, service.id);
      assert.ok(path(world,service.at), service.id);
      assert.equal(occupied.has(service.at.join(',')), false, service.id);
      occupied.add(service.at.join(','));
      assert.ok(protectedPoints.every(at => Math.hypot(at[0]-x,at[1]-y) >= 2), service.id);
      assert.ok(!area.objects.some(object => object.x === x && object.y === y), service.id);
    }
    for (let i=0;i<services.length;i++) for (let j=i+1;j<services.length;j++) {
      assert.ok(Math.hypot(services[i].at[0]-services[j].at[0],services[i].at[1]-services[j].at[1]) >= 3, area.id);
    }
  }
});

test('Brackenwell and clinic interiors keep paid inn recovery separate from paid revival', () => {
  const services = Town.forArea(layout.areas.alderreach_01, model());
  assert.match(services.find(service => service.type === 'inn').source, /Tilda/);
  assert.match(services.find(service => service.type === 'item').source, /bakehouse/);
  assert.match(services.find(service => service.type === 'weapon').source, /Tilda/);
  assert.match(services.find(service => service.type === 'magic').source, /Orchard press/);
  assert.match(services.find(service => service.type === 'guild').source, /Festival Barn/);
  assert.equal(services.find(service => service.type === 'chapel').free, false);
  const cottage = model('wyla_cottage');
  const care = Town.forArea(cottage.area, cottage).find(service => service.type === 'inn');
  assert.equal(care.free, false);
  assert.equal(care.label, 'INN');
  assert.ok(path(cottage,care.at));
  assert.equal(Town.forArea(layout.areas.smithy_inn, model('smithy_inn')).length, 2);
  assert.equal(Town.forArea(layout.areas.oakmere_armory, model('oakmere_armory')).length, 2);
  for (const id of ['oakmere_clinic','infirmary']) {
    const clinic = Town.forArea(layout.areas[id], model(id));
    assert.equal(clinic.length, 1);
    assert.equal(clinic[0].type, 'chapel');
    assert.equal(clinic[0].free, false);
    assert.match(clinic[0].description, /30 G/);
    assert.match(clinic[0].description, /1 HP/);
  }
});

test('no healing service offers free recovery and camps require supplies', () => {
  for (const area of Object.values(layout.areas)) for (const service of Town.forArea(area, model(area.id))) {
    if (['inn','chapel','camp'].includes(service.type)) {
      assert.equal(service.free, false, service.id);
      assert.doesNotMatch(service.label+' '+service.description, /free|without paying/i, service.id);
    }
    if (service.type === 'camp') assert.match(service.description, /Tent or Cottage/, service.id);
  }
});

test('services are safe-area additions and never alter source collision, events, stops, or gates', () => {
  const before = JSON.stringify(layout);
  for (const area of Object.values(layout.areas)) {
    const world = model(area.id);
    const services = Town.forArea(area, world);
    if (services.length) assert.equal(Campaign.isSafe(area,world), true, area.id);
    if (['dungeon','route','secret','finale','postgame'].includes(area.kind)) assert.equal(services.length, 0, area.id);
  }
  assert.equal(JSON.stringify(layout), before);
  assert.equal(Object.keys(layout.areas).length, 108);
  assert.equal(layout.events.length, 91);
});

test('the service directory and proximity interactions share stable places', () => {
  const world = model();
  const directory = Town.directory(world.area,world);
  const service = directory.find(item => item.type === 'item');
  [world.x,world.y] = service.at.map(value => world.center(value));
  assert.equal(Town.near(world).id, service.id);
  world.x += 25;
  assert.equal(Town.near(world), null);
  world.moving = true;
  world.facing = 'north';
  assert.deepEqual(clone(Town.directory(world.area,world)), clone(directory));
  directory[0].at[0] = -100;
  directory[0].catalogs.push('bad');
  assert.notEqual(Town.forArea(world.area,world)[0].at[0], -100);
  assert.ok(!Town.forArea(world.area,world)[0].catalogs.includes('bad'));
});

test('authored service frontage cells override legacy preferred coordinates', () => {
  const world = model();
  const original = Town.forArea(world.area, world);
  const area = {...world.area, serviceSpots:Object.fromEntries(original.map(service=>[service.type,[...service.at]]))};
  const placed = Town.forArea(area, world);
  for (const service of placed) assert.deepEqual(clone(service.at), area.serviceSpots[service.type]);
});

test('nearby pending story events retain priority over a service', () => {
  const world = model('kharad_05');
  const camp = Town.forArea(world.area,world).find(service => service.type === 'camp');
  const event = world.area.events.find(item => item.id === 'kharad');
  // The real Hearth event and refuge have overlapping interaction radii.
  [world.x,world.y] = camp.at.map((value,index) => (world.center(value) + world.center(event.at[index])) / 2);
  assert.ok(world.distance(camp.at) <= 24);
  assert.ok(world.distance(event.at) <= 28);
  assert.equal(Town.near(world), null);
  world.flags.add(event.id);
  assert.equal(Town.near(world)?.type, 'camp');
});

test('stock grows by region and the restored trade network without moving merchants', () => {
  const world = model();
  const original = Town.forArea(world.area,world);
  assert.equal(original[0].stockTier, 1);
  world.flags.add('veyra');
  assert.equal(Town.forArea(world.area,world)[0].stockTier, 2);
  world.flags.add('keeping');
  assert.equal(Town.forArea(world.area,world)[0].stockTier, 4);
  world.flags.add('ending');
  assert.equal(Town.forArea(world.area,world)[0].stockTier, 5);
  const restored = new World(layout,world.snapshot());
  assert.deepEqual(clone(Town.forArea(restored.area,restored)),clone(Town.forArea(world.area,world)));
  assert.deepEqual(clone(Town.forArea(world.area,world).map(service=>service.at)),clone(original.map(service=>service.at)));
  for (const area of fullHubs) assert.ok(Town.tier(area) >= 1 && Town.tier(area) <= 5);
  assert.equal(Town.tier(layout.areas.veyra_01), 2);
  assert.equal(Town.tier(layout.areas.kharad_02), 3);
  assert.equal(Town.tier(layout.areas.ordel_02), 4);
  assert.equal(Town.tier(layout.areas.edrin_02), 5);
});

test('placement respects an unopened barrier rather than putting a shop beyond it', () => {
  const original = layout.areas.alderreach_09;
  // A controlled split keeps this barrier check independent of mapped gate/spawn changes.
  const area = {...original,spawn:[18,29],collision:Array.from({length:original.height},()=>'.'.repeat(original.width)),
    objects:[],events:[],stops:[],serviceSpots:{inn:[4,6],item:[10,6],weapon:[16,6],magic:[22,6],chapel:[28,6],guild:[10,12],rumor:[22,12]},
    barriers:[{rect:[0,20,original.width-1,20],gate:'test-gate'}]};
  const closed = Town.forArea(area,{has:()=>false});
  assert.equal(closed.length,7);
  assert.ok(closed.every(service=>service.at[1]>20));
  const open = Town.forArea(area,{has:()=>true});
  assert.equal(open.length,7);
  assert.ok(open.some(service=>service.at[1]<20));
});
