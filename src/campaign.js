/*
 * Campaign adapter for the supplied Avelune world.
 * AveluneCampaign is a global in the offline bundle. No DOM or timers.
 * World flags are committed by the caller ONLY after a scripted victory.
 * rewardForEvent must be called after that commit; its receipt is persisted by RPG.
 * All numbers below are original streamlined balance, not Final Fantasy data.
 */
const AVELUNE_REGIONS = Object.freeze({
  alderreach: { name: 'Alderreach', level: 1, color: '#a8c16a', field: 'orchard',
    lore: 'Orchards, warm ovens, and the first road beyond the map.' },
  veyra: { name: 'Veyra', level: 5, color: '#6fc4ca', field: 'water',
    lore: 'Follow the freshwater ferries to a capital beneath the water.' },
  kharad: { name: 'Kharad', level: 8, color: '#d99b69', field: 'cavern',
    lore: 'A buried road carries a rhythm the mines have not forgotten.' },
  sereva: { name: 'Sereva', level: 8, color: '#dcca80', field: 'desert',
    lore: 'Moving gardens keep the salt roads alive.' },
  isles: { name: 'Lantern Isles', level: 8, color: '#82c4df', field: 'coast',
    lore: 'Three assemblies, one impossible ship, and a way into the sky.' },
  ordel: { name: 'Ordel', level: 12, color: '#b5c6e6', field: 'snow',
    lore: 'The seventh bell was silenced. Its records remain.' },
  edrin: { name: 'Edrin', level: 14, color: '#bc9ed8', field: 'pale',
    lore: 'The roads meet at the kingdom the old maps left out.' },
});

// name, visual family, weakness, own element, role. Names are from the supplied catalog.
const AVELUNE_FORMATIONS = Object.freeze({
  alderreach: [
    ['Wickling', 'wickling', 'ember', 'tide', 'swift'],
    ['Crow Flock', 'crow', 'frost', 'gale', 'swift'],
    ['Bramble Boar', 'boar', 'ember', 'stone', 'brute'],
    ['Mill Wraith', 'wisp', 'bolt', 'frost', 'caster'],
    ['Scarecrow Knight', 'knight', 'ember', 'stone', 'armored'],
  ],
  veyra: [
    ['Canal Eel', 'eel', 'bolt', 'tide', 'swift'],
    ['Lantern Wisp', 'wisp', 'frost', 'ember', 'caster'],
    ['Tidewalker Crab', 'crab', 'bolt', 'tide', 'armored'],
    ['Barge Golem', 'golem', 'starlight', 'stone', 'brute'],
    ['Reed Cutthroat', 'knight', 'ember', 'gale', 'swift'],
  ],
  kharad: [
    ['Echo Bat', 'crow', 'ember', 'gale', 'swift'],
    ['Cinder Lizard', 'wyrm', 'frost', 'ember', 'brute'],
    ['Rockback Beetle', 'crab', 'gale', 'stone', 'armored'],
    ['Pickwraith', 'wisp', 'frost', 'hollow', 'caster'],
    ['Living Monument', 'golem', 'bolt', 'stone', 'armored'],
  ],
  sereva: [
    ['Dust Devil', 'wisp', 'frost', 'gale', 'caster'],
    ['Burr Wolf', 'boar', 'ember', 'stone', 'swift'],
    ['Cactus Jester', 'plant', 'ember', 'gale', 'caster'],
    ['Salt Scorpion', 'crab', 'frost', 'stone', 'armored'],
    ['Thornback', 'plant', 'ember', 'gale', 'brute'],
  ],
  isles: [
    ['Gull Pirate', 'crow', 'frost', 'gale', 'swift'],
    ['Wreck Drone', 'golem', 'bolt', 'stone', 'armored'],
    ['Star Jelly', 'wisp', 'bolt', 'starlight', 'caster'],
    ['Lighthouse Phantom', 'wisp', 'starlight', 'hollow', 'caster'],
    ['Pearl Manta', 'eel', 'bolt', 'tide', 'swift'],
  ],
  ordel: [
    ['Frost Wolf', 'boar', 'ember', 'frost', 'swift'],
    ['Bell Wraith', 'bell', 'bolt', 'hollow', 'caster'],
    ['Ice Golem', 'golem', 'ember', 'frost', 'armored'],
    ['Winter Wyrm', 'wyrm', 'starlight', 'frost', 'brute'],
    ['Brass Sentinel', 'knight', 'bolt', 'stone', 'armored'],
  ],
  edrin: [
    ['Lullaby Moth', 'moth', 'ember', 'hollow', 'swift'],
    ['Pale Wanderer', 'wisp', 'starlight', 'hollow', 'caster'],
    ['Ledger Wyrm', 'wyrm', 'bolt', 'hollow', 'brute'],
    ['Edrin Guardian', 'knight', 'bolt', 'stone', 'armored'],
    ['Crown Shard', 'crown', 'starlight', 'hollow', 'caster'],
  ],
});

// event: [name, level, sprite, weakness, element, intent, victory note]
const AVELUNE_BOSSES = Object.freeze({
  barn_wickling: ['Barn Wickling', 1, 'wickling', 'ember', 'tide', 'The wick flares. Guard before its next burst.', 'The frightened Wickling scatters into harmless candlelets.'],
  miller: ['The Miller’s Pale Shell', 3, 'golem', 'ember', 'stone', 'The mill gears wind up for a crushing strike.', 'The shell shatters. Corwin is alive; Ellie leads him to safety.'],
  alderreach: ['Hearth Warden', 4, 'knight', 'bolt', 'ember', 'The Warden raises its hammer for Oath Slam.', 'The lockdown ends, and Alderreach’s Hearth burns steadily.'],
  eel_nest: ['Lock-Intake Eel', 5, 'eel', 'bolt', 'tide', 'The eel gathers a bright charge beneath the water.', 'The intake clears. The ferry crew can work safely again.'],
  chorister: ['Drowned Chorister', 6, 'wisp', 'bolt', 'tide', 'A silent breath gathers into the Drowned Dirge.', 'The last note fades. The palace’s pressure begins to fall.'],
  orrun: ['Humming Elder', 9, 'golem', 'tide', 'stone', 'The regulator hum deepens. Stone Shower is coming.', 'Orrun survives. Bram quiets the regulator beside him.'],
  greenwraith: ['Greenwraith', 9, 'plant', 'ember', 'gale', 'The siphon-roots open for a thorn-storm bloom.', 'The roots release the stolen water. Ysennel can breathe.'],
  engine: ['Clockwork Spider', 7, 'crab', 'bolt', 'stone', 'The clock-engine spins up its defensive legs.', 'The engine is intact and ready for the Skiff.'],
  lens: ['Observatory Automaton', 8, 'golem', 'bolt', 'starlight', 'Its lens focuses a narrow, burning beam.', 'The vault releases the star-glass lens.'],
  coil: ['Beacon Phantom', 8, 'wisp', 'starlight', 'hollow', 'A cold light gathers around the beacon coil.', 'The beacon coil is safe to carry to the mooring.'],
  watcher: ['Watcher Between', 10, 'star', 'bolt', 'starlight', 'A falling star hangs still. Comet follows next.', 'Auriel’s recording confirms the seventh beacon.'],
  bell_mother: ['Bell Mother', 12, 'bell', 'ember', 'frost', 'The great bell draws back for a terrible peal.', 'The seventh bell’s dismantling is documented.'],
  ledger: ['Ledger Wyrm', 14, 'wyrm', 'bolt', 'hollow', 'Pages rise like scales as the Wyrm coils to strike.', 'Ottoline releases the Closure Oath and the original plans.'],
  ember: ['Caelan’s Conduit', 15, 'crown', 'bolt', 'hollow', 'The escape relay flashes. Guard against the surge.', 'The conduit breaks. The party escapes with the Seventh Ember.'],
  relief: ['Unmoored Hearth', 16, 'golem', 'frost', 'tide', 'Water pulls back toward the open floodgate.', 'The flood is contained. Relief boats reach the drained steps.'],
  keeping: ['Hesper Orm', 17, 'bell', 'bolt', 'hollow', 'The Last Keeping gathers in the broken bell.', 'Hesper surrenders the relay plans. The six anchors can be repaired.'],
  ending: ['Hollow Crown', 19, 'crown', 'starlight', 'hollow', 'The Crown draws the seven roads inward. Guard for Fracture.', 'The Crown falls. All seven Hearths share the load; the road home is restored.'],
  well_west: ['Western Fracture Ward', 20, 'golem', 'ember', 'stone', 'The ward-stone gathers a fracture pulse.', 'The western ward is quiet.'],
  well_north: ['Northern Fracture Ward', 20, 'wisp', 'bolt', 'tide', 'The ward-stone gathers a fracture pulse.', 'The northern ward is quiet.'],
  well_east: ['Eastern Fracture Ward', 20, 'knight', 'frost', 'ember', 'The ward-stone gathers a fracture pulse.', 'The eastern ward is quiet.'],
  unwritten: ['The Unwritten', 22, 'wyrm', 'ember', 'hollow', 'The rift narrows to a point of absolute stillness.', 'The Unwritten’s ward gives way. A road to the Seventh Star remains.'],
  trial_1: ['Ember Warden', 20, 'knight', 'tide', 'ember', 'An Ember Wave gathers behind its shield.', 'The Ember portal rests.'],
  trial_2: ['Tide Warden', 20, 'eel', 'bolt', 'tide', 'A Tide Wave gathers behind its shield.', 'The Tide portal rests.'],
  trial_3: ['Stone Warden', 20, 'golem', 'gale', 'stone', 'A Stone Wave gathers behind its shield.', 'The Stone portal rests.'],
  trial_4: ['Gale Warden', 20, 'crow', 'stone', 'gale', 'A Gale Wave gathers behind its shield.', 'The Gale portal rests.'],
  trial_5: ['Frost Warden', 20, 'wyrm', 'ember', 'frost', 'A Frost Wave gathers behind its shield.', 'The Frost portal rests.'],
  trial_6: ['Starlight Warden', 20, 'star', 'bolt', 'starlight', 'A Starlight Wave gathers behind its shield.', 'The Starlight portal rests.'],
  sixfold: ['Sixfold Warden', 23, 'knight', 'bolt', 'starlight', 'The six elements align for a single wave.', 'The six trials are complete. The court falls silent.'],
  seventh_star: ['Seventh Star Between', 24, 'star', 'bolt', 'starlight', 'The Seventh Star rises. A final Comet approaches.', 'Ysaudre’s recording ends, and Caelan waits at the landing.'],
});

class AveluneCampaign {
  static region(area) { return AVELUNE_REGIONS[area?.region] || AVELUNE_REGIONS.alderreach; }

  static recommendedLevel(area, world) {
    if (!area) return 1;
    if (area.id === 'seventh_chamber' || area.id === 'edrin_09') return 19;
    if (area.kind === 'postgame') return area.id === 'isles_09' ? 24 : 20;
    if (['keeping_bell', 'keeping_choir', 'keeping_cloister'].includes(area.id)) return 17;
    if (area.id === 'veyra_10') return 16;
    if (area.region === 'edrin' && world?.has?.('keeping')) return 18;
    if (area.region === 'alderreach') {
      if (['first_shutters', 'alderreach_08'].includes(area.id)) return 4;
      if (['alderreach_04', 'alderreach_05', 'mill_loft', 'mill_sluice'].includes(area.id) || area.id.startsWith('thistle_')) return 3;
      if (area.id === 'alderreach_06' || area.id === 'alderreach_10') return 3;
      if (area.id === 'alderreach_02' || area.id === 'drainage_tunnel') return 2;
    }
    return this.region(area).level;
  }

  static isSafe(area, world) {
    if (!area) return true;
    if (['village', 'town', 'port', 'camp', 'shrine', 'market', 'landing', 'bridge', 'water', 'hearth', 'event', 'lock'].includes(area.kind)) return true;
    if (['north_road', 'south_causeway'].includes(area.id)) return true;
    if (area.indoor) {
      const hostile = new Set(['drainage_tunnel', 'mill_loft', 'mill_sluice', 'first_shutters', 'palace_chamber',
        'support_rooms', 'orrun_lift', 'ysennel_roots', 'star_glass_vault', 'engine_cave', 'beacon_chamber',
        'cathedral_nave', 'keeping_bell', 'keeping_choir', 'keeping_cloister', 'ledger_vault', 'quiet_stacks',
        'hall_of_seven', 'lullaby_stairs', 'seventh_chamber']);
      return !hostile.has(area.id);
    }
    return false;
  }

  static services(area, world) {
    const haven = !!area && (['village', 'town', 'port', 'camp', 'shrine', 'market', 'landing', 'hearth'].includes(area.kind)
      || ['wyla_cottage', 'smithy_inn', 'oakmere_clinic', 'oakmere_armory', 'ferry_theater', 'infirmary'].includes(area.id));
    const bosses = area?.events?.filter(e => AVELUNE_BOSSES[e.id] && !world?.has?.(e.id)) || [];
    const sanctuary = ['camp', 'shrine', 'hearth'].includes(area?.kind)
      || ['wyla_cottage', 'infirmary', 'oakmere_clinic'].includes(area?.id);
    return {
      shop: haven && !['hearth', 'shrine'].includes(area.kind),
      inn: haven,
      jobs: false,
      formation: haven,
      camp: sanctuary || bosses.length > 0,
      innCost: 8 + this.recommendedLevel(area, world) * 3,
      name: sanctuary ? 'Wayside refuge' : 'Roadkeeper’s provisions',
    };
  }

  static bossFor(eventId, rpg, world) {
    const row = AVELUNE_BOSSES[eventId];
    if (!row || world?.has?.(eventId)) return null;
    const [name, level, sprite, weakness, element, intent, victory] = row;
    const event = world?.events?.get(eventId);
    const area = event ? world.layout.areas[event.scene] : world?.area;
    const enemy = {
      id: eventId, name, level, sprite, weakness, element,
      hp: Math.round((80 + 55 * level + level * level) * (eventId === 'barn_wickling' ? 1 : eventId === 'ending' ? 1.4 : 1.6)),
      attack: Math.round(9 + 2.25 * level), defense: Math.round(3 + .7 * level), speed: Math.round(5 + .5 * level),
      xp: eventId === 'barn_wickling' ? 36 : Math.round(35 * level), gold: Math.round(25 + 18 * level),
      intent, boss: true,
    };
    return { name, boss: true, eventId, level, region: area?.region || 'alderreach',
      backdrop: this.region(area).field, intent, victory, enemies: [enemy] };
  }

  static encounterFor(area, rpg, world, rng = Math.random) {
    if (this.isSafe(area, world)) return null;
    const pool = AVELUNE_FORMATIONS[area.region] || AVELUNE_FORMATIONS.alderreach;
    const level = this.recommendedLevel(area, world);
    // A bounded sampler tolerates test stubs and faulty custom RNGs without corrupt specs.
    const roll = () => { const n = Number(rng()); return Number.isFinite(n) ? Math.max(0, Math.min(.999999, n)) : 0; };
    const formation = roll();
    let indices;
    if (formation < .45) indices = [0, 0];
    else if (formation < .8) indices = [1, 2];
    else if (formation < .95) indices = [2, 3];
    else indices = [4, 0, 1];
    if (level <= 2 && formation < .65) indices = [formation < .35 ? 0 : 2];
    const enemies = indices.map((index, slot) => {
      const [name, sprite, weakness, element, role] = pool[index];
      const hpMod = role === 'brute' ? 1.4 : role === 'caster' ? .85 : 1;
      const attackMod = role === 'brute' ? 1.1 : role === 'armored' ? .9 : 1;
      const duplicate = indices.filter(i => i === index).length > 1;
      return { id: area.region + '-' + index + '-' + slot, name: name + (duplicate ? ' ' + String.fromCharCode(65 + slot) : ''),
        sprite, element, weakness, level,
        hp: Math.round((12 + 9 * level + .25 * level * level) * hpMod),
        attack: Math.round((6 + 1.7 * level) * attackMod),
        defense: Math.round(1 + .65 * level + (role === 'armored' ? level * .6 : 0)),
        speed: Math.round(6 + level * .45 + (role === 'swift' ? 5 : role === 'brute' ? -2 : 0)),
        xp: 8 + 7 * level, gold: 6 + 5 * level,
      };
    });
    return { name: area.name + ' · encounter', boss: false, level, region: area.region,
      backdrop: this.region(area).field, enemies };
  }

  static rewardForEvent(event, rpg, world) {
    const empty = { gold: 0, xp: 0, items: {}, text: '', already: true };
    if (!event?.id || !rpg || !world?.has?.(event.id)) return empty;
    if (!(rpg.campaignRewards instanceof Set)) rpg.campaignRewards = new Set(Array.isArray(rpg.campaignRewards) ? rpg.campaignRewards : []);
    if (rpg.campaignRewards.has(event.id)) return empty;
    rpg.campaignRewards.add(event.id);
    const area = world.layout?.areas?.[event.scene] || world.area;
    const level = this.recommendedLevel(area, world);
    const reward = { gold: 0, xp: 0, items: {}, text: '', already: false };
    if (event.id.startsWith('cache_')) {
      reward.gold = 45 + level * 25;
      reward.items = { potion: 2, ether: 1, revive: 1 };
      reward.xp = 12 + level * 6;
    } else if (event.id === 'mailbag') {
      reward.gold = 40;
      reward.items = { potion: 3, ether: 1, revive: 1 };
      reward.text = 'Wyla packed three potions, an ether, a phoenix plume, and 40 gold for the road.';
    } else if (['alderreach', 'veyra', 'kharad', 'sereva', 'isles', 'ordel'].includes(event.id)) {
      reward.gold = 40 + level * 12;
      reward.items = { potion: 3, ether: 2, revive: 1 };
      reward.xp = 20 + level * 8;
      reward.text = 'The Hearth keepers refill your travel supplies.';
    } else if (event.id.startsWith('rescue_')) {
      reward.items = { potion: 2 };
      reward.xp = 40;
      reward.text = 'The relief crew shares two potions in thanks.';
    } else if (['depart', 'iven', 'bram', 'tavi', 'sella', 'skiff', 'edrin_seal'].includes(event.id)) {
      reward.items = { potion: 1, ether: 1 };
      reward.xp = 20 + level * 6;
    } else if (!AVELUNE_BOSSES[event.id]) {
      reward.gold = 5 + level * 3;
      reward.xp = 6 + level * 6;
      if (event.id.startsWith('anchor_')) reward.items = { ether: 1 };
    }
    rpg.gold = Math.min(999999, Math.max(0, Number(rpg.gold) || 0) + reward.gold);
    if (!rpg.inventory || typeof rpg.inventory !== 'object') rpg.inventory = {};
    for (const [item, amount] of Object.entries(reward.items)) {
      rpg.inventory[item] = Math.min(99, Math.max(0, Number(rpg.inventory[item]) || 0) + amount);
    }
    if (reward.xp && typeof rpg.gainXP === 'function') rpg.gainXP(reward.xp);
    const parts = [];
    if (reward.gold) parts.push(reward.gold + ' gold');
    if (reward.xp) parts.push(reward.xp + ' XP');
    for (const [item, amount] of Object.entries(reward.items)) parts.push(amount + ' ' + ({ potion: 'potion', ether: 'ether', revive: 'phoenix plume' }[item]) + (amount > 1 ? 's' : ''));
    reward.text = [reward.text, parts.length ? 'Received ' + parts.join(', ') + '.' : ''].filter(Boolean).join(' ');
    return reward;
  }
}

if (typeof module !== 'undefined') module.exports = { AveluneCampaign, AVELUNE_BOSSES, AVELUNE_REGIONS, AVELUNE_FORMATIONS };
