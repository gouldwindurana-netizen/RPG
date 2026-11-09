import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ module: { exports: {} }, Set, Map });
vm.runInContext(fs.readFileSync(new URL('../src/campaign.js', import.meta.url), 'utf8'), context);
const { AveluneCampaign: Campaign, AVELUNE_BOSSES: bosses } = context.module.exports;
const worldSource = fs.readFileSync(new URL('../src/model.js', import.meta.url), 'utf8');
const worldContext = vm.createContext({ module: { exports: {} }, Set, Map });
vm.runInContext(worldSource, worldContext);
const { AveluneWorld } = worldContext.module.exports;
const layout = JSON.parse(fs.readFileSync(new URL('../src/world.json', import.meta.url), 'utf8'));

function world() { return new AveluneWorld(layout); }
function rpg() { return { gold: 0, inventory: {}, campaignRewards: new Set(), xp: 0, gainXP(n) { this.xp += n; } }; }

test('every explicit story encounter has a concrete non-repeatable battle', () => {
  const model = world();
  for (const event of layout.events.filter(e => e.title.startsWith('Resolve'))) {
    const spec = Campaign.bossFor(event.id, rpg(), model);
    assert.ok(spec, 'missing encounter: ' + event.id);
    assert.equal(spec.boss, true);
    assert.ok(spec.enemies.length >= 1);
    assert.ok(spec.enemies.every(e => e.hp > 0 && e.attack > 0 && e.xp > 0));
    model.flags.add(event.id);
    assert.equal(Campaign.bossFor(event.id, rpg(), model), null);
  }
  assert.ok(Campaign.bossFor('alderreach', rpg(), world()), 'Hearth Warden must guard first seal');
  assert.ok(Campaign.bossFor('ending', rpg(), world()), 'finale must be a real battle');
});

test('boss mapping references only real supplied events', () => {
  const eventIds = new Set(layout.events.map(e => e.id));
  for (const id of Object.keys(bosses)) assert.ok(eventIds.has(id), id);
});

test('towns, villages, ports and haven interiors never produce random battles', () => {
  const model = world();
  for (const area of Object.values(layout.areas).filter(a => ['town', 'village', 'port', 'camp', 'shrine'].includes(a.kind))) {
    assert.equal(Campaign.isSafe(area, model), true, area.id);
    assert.equal(Campaign.encounterFor(area, rpg(), model, () => .99), null, area.id);
  }
  assert.equal(Campaign.isSafe(layout.areas.wyla_cottage), true);
  assert.equal(Campaign.isSafe(layout.areas.oakmere_clinic), true);
  assert.equal(Campaign.isSafe(layout.areas.mill_sluice), false);
});

test('weighted region formations differ and always have bounded valid stats', () => {
  const model = world();
  const names = new Set();
  for (const area of Object.values(layout.areas).filter(a => !Campaign.isSafe(a))) {
    for (const roll of [0, .5, .85, .99, 1, NaN]) {
      const spec = Campaign.encounterFor(area, rpg(), model, () => roll);
      assert.ok(spec.enemies.length >= 1 && spec.enemies.length <= 3, area.id);
      assert.equal(spec.boss, false);
      for (const enemy of spec.enemies) {
        assert.ok(Number.isFinite(enemy.hp) && enemy.hp > 0);
        assert.ok(Number.isFinite(enemy.attack) && enemy.attack > 0);
        assert.ok(enemy.weakness && enemy.sprite);
        names.add(enemy.name.replace(/ [ABC]$/, ''));
      }
    }
  }
  assert.ok(names.size >= 30, 'region roster should not collapse into one reskin');
});

test('encounter strength is fixed by region and story phase, not party level', () => {
  const model = world();
  const area = layout.areas.kharad_03;
  const first = Campaign.encounterFor(area, { level: 1 }, model, () => .5);
  const second = Campaign.encounterFor(area, { level: 30 }, model, () => .5);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(Campaign.recommendedLevel(layout.areas.edrin_07, model), 14);
  model.flags.add('keeping');
  assert.equal(Campaign.recommendedLevel(layout.areas.edrin_07, model), 18);
});

test('field rewards require a committed flag and cannot be farmed', () => {
  const model = world();
  const game = rpg();
  const event = model.events.get('cache_alderreach_10');
  assert.equal(Campaign.rewardForEvent(event, game, model).already, true);
  assert.equal(game.gold, 0);
  model.flags.add(event.id);
  const first = Campaign.rewardForEvent(event, game, model);
  const state = JSON.stringify({ gold: game.gold, inventory: game.inventory, xp: game.xp });
  assert.equal(first.already, false);
  assert.ok(first.gold > 0 && first.xp > 0);
  assert.equal(Campaign.rewardForEvent(event, game, model).already, true);
  assert.equal(JSON.stringify({ gold: game.gold, inventory: game.inventory, xp: game.xp }), state);
});

test('rewards respect inventory caps and haven recovery has a positive price', () => {
  const model = world();
  const game = rpg();
  game.inventory = { potion: 99, ether: 99, revive: 99 };
  model.flags.add('mailbag');
  Campaign.rewardForEvent(model.events.get('mailbag'), game, model);
  assert.deepEqual(game.inventory, { potion: 99, ether: 99, revive: 99 });
  const refuge = Campaign.services(layout.areas.wyla_cottage, model);
  assert.equal(refuge.inn, true);
  assert.equal(refuge.innCost, 11);
  assert.equal(refuge.jobs, false);
  assert.equal(refuge.formation, true);
  assert.equal(Campaign.services(layout.areas.mill_sluice, model).camp, true);
  assert.equal(Campaign.services(layout.areas.alderreach_02, model).jobs, false);
});

test('all required world events are still reachable through their original gates', () => {
  const model = world();
  const remaining = new Set(layout.events.filter(e => e.required).map(e => e.id));
  let iteration = 0;
  while (remaining.size && iteration++ < 150) {
    const reachable = model.reachable();
    const event = layout.events.find(e => remaining.has(e.id) && reachable.has(e.scene) && e.needs.every(g => model.has(g)));
    assert.ok(event, 'no reachable story event; remaining: ' + [...remaining].join(', '));
    model.id = event.scene;
    [model.x, model.y] = event.at.map(v => model.center(v));
    const result = model.applyEvent(event.id);
    assert.ok(result && !result.missing, event.id);
    remaining.delete(event.id);
  }
  assert.equal(remaining.size, 0);
  assert.equal(model.has('ending'), true);
  assert.ok(Object.keys(layout.areas).length >= 108);
  // Complete optional victories; their authored access gates must still resolve.
  for (const event of layout.events.filter(e => !e.required)) {
    if (event.needs.every(g => model.has(g))) model.flags.add(event.id);
  }
  assert.equal(model.has('star_trial'), true);
});
