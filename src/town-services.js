/* Physical service counters live indoors; town directories point to real doors. */
const AVELUNE_TOWN_KINDS = new Set(['village', 'town', 'port', 'market']);
const AVELUNE_REFUGE_KINDS = new Set(['camp', 'shrine', 'hearth', 'landing']);
const AVELUNE_SERVICE_TIERS = Object.freeze({ alderreach: 1, veyra: 2, kharad: 3, sereva: 3, isles: 3, ordel: 4, edrin: 5 });
const AVELUNE_SERVICE_PLACEMENTS = new WeakMap();
const AVELUNE_TOWN_RUMORS = Object.freeze({
  alderreach: 'The orchard roads lead to Oakmere. Carry provisions, and look for a blue inn sign before setting out.',
  veyra: 'The ferry crews watch the lock intake. Keep your evacuation papers for the hearing beyond North Lock.',
  kharad: 'Bram knows the buried road. All three mine supports must hold before the lift can carry a party.',
  sereva: 'The herd follows water beneath the salt. Three irrigation valves feed the crossing into the roots.',
  isles: 'Ask Sella about the charts. The Skiff needs an engine, a lens, and a coil from three different shores.',
  ordel: 'The bells and the archive tell different stories. Copy the records before taking the maintenance descent.',
  edrin: 'Mother Ever knows the fixed ledges through the Pale. Carry the Seal to Courier’s Gate, and tend the garden lamps.'
});

class AveluneTownServices {
  static tier(area, world) {
    const trade = world?.has?.('ending') ? 5 : world?.has?.('keeping') ? 4 : world?.has?.('veyra') ? 2 : 1;
    return Math.min(5, Math.max(AVELUNE_SERVICE_TIERS[area?.region] || 1, trade));
  }

  static rumor(area, world) {
    if (world?.has?.('ending')) return 'The south causeway joins Oakmere and Vesperholm again. The roads are open; old trials still await a willing party.';
    if (world?.has?.('keeping')) return 'The relay plans are public now. Six regional anchors share the work; repair each before returning to the seventh Hearth.';
    if (area.id === 'alderreach_01') return world?.has?.('depart')
      ? 'Tilda keeps rooms beside the smithy. The orchard lane leaves east; Mara is tending the bridge beyond it.'
      : 'Wyla will mend more than a mailbag. Her cottage is west of the square; Tilda’s inn and smithy are east. The northern milestone is waiting.';
    return AVELUNE_TOWN_RUMORS[area.region] || 'Rest, stock your bag, and speak with the roadkeepers before leaving the shelter.';
  }

  static forArea(area, world) {
    if (!area?.collision || !Array.isArray(area.spawn)) return [];
    const specs = this.specs(area);
    if (!specs.length) return [];
    // Placements depend on gates, never the player's animation frame or position.
    const gateKey = (area.barriers || []).map(b => Number(!!world?.has?.(b.gate))).join('');
    let variants = AVELUNE_SERVICE_PLACEMENTS.get(area);
    if (!variants) AVELUNE_SERVICE_PLACEMENTS.set(area, variants = new Map());
    if (!variants.has(gateKey)) variants.set(gateKey, this.place(area, specs, world));
    const stockTier = this.tier(area, world);
    return variants.get(gateKey).map(service => ({ ...service, at: [...service.at], catalogs: [...service.catalogs],
      stockTier, scene:area.id, rumor: service.type === 'rumor' ? this.rumor(area.parent&&world?.layout?.areas[area.parent]||area, world) : undefined }));
  }

  static directory(area, world) {
    if(!area?.serviceEntrances)return this.forArea(area,world);
    const layout=world?.layout||(typeof LAYOUT!=='undefined'?LAYOUT:null);
    if(!layout)return [];
    return area.serviceEntrances.flatMap(entrance=>{
      const target=layout.areas[entrance.scene];
      const service=this.forArea(target,world).find(counter=>counter.type===entrance.type);
      return service?[{...service,scene:target.id,source:entrance.source||service.source,
        entrance:{scene:area.id,at:[...entrance.at],routeId:entrance.routeId,stopId:entrance.stopId}}]:[];
    });
  }

  static near(world) {
    if (!world?.area) return null;
    const distance = at => typeof world.distance === 'function' ? world.distance(at)
      : Math.hypot((at[0] + .5) * (world.tile || 16) - world.x, (at[1] + .5) * (world.tile || 16) - world.y);
    // A nearby story interaction keeps priority, including its unmet-prerequisite explanation.
    if ((world.area.events || []).some(event => !world.flags?.has(event.id) && distance(event.at) <= 28)) return null;
    return this.forArea(world.area, world).filter(service => distance(service.at) <= 24)
      .sort((a, b) => distance(a.at) - distance(b.at) || a.id.localeCompare(b.id))[0] || null;
  }

  static specs(area) {
    if(area.indoor)return (area.serviceCounters||[]).map(counter=>({free:false,catalogs:[],...counter}));
    if(!AVELUNE_REFUGE_KINDS.has(area.kind))return [];
    return [{key:'camp',type:'camp',name:area.kind==='landing'?'Mooring campsite':'Roadkeeper’s campsite',label:'CAMP',
      description:'Use a Tent or Cottage from your bag to recover living companions’ HP and MP. Fallen allies need revival first.',
      free:false,catalogs:[],offset:[-4,4],source:'Sheltered campsite',match:/campfire|shelter|hearth|bell|gantry|arch/i}];
  }

  static place(area, specs, world) {
    const open = (x, y) => area.collision[y]?.[x] === '.' && (area.barriers || []).every(({rect, gate}) =>
      world?.has?.(gate) || x < rect[0] || x > rect[2] || y < rect[1] || y > rect[3]);
    const key = at => at.join(',');
    const reachable = new Set(), queue = [];
    if (open(...area.spawn)) { queue.push(area.spawn); reachable.add(key(area.spawn)); }
    for (let i = 0; i < queue.length; i++) for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const at = [queue[i][0] + dx, queue[i][1] + dy];
      if (open(...at) && !reachable.has(key(at))) { reachable.add(key(at)); queue.push(at); }
    }
    const objects = area.objects || [];
    const buildings = objects.filter(o => o.name && o.width >= 54 && !/^(Inspect|Repair|Resolve|Stabilize|Clear|Receive|Assemble|Copy|Meet|Help|Read|Speak|Present|Collect|Brace)\b/.test(o.name));
    const protectedPoints = [...(area.events || []).map(e => e.at), ...(area.stops || []).flatMap(s => [s.at, s.arrival].filter(Boolean)), area.spawn];
    const occupied = new Set(objects.map(o => key([o.x, o.y])));
    const placed = [];
    for (let index = 0; index < specs.length; index++) {
      const spec = specs[index];
      const matches = Array.isArray(spec.match) ? spec.match : [spec.match];
      const frontage = area.serviceSpots?.[spec.type];
      const nearestBuilding = frontage && [...buildings].sort((a,b) =>
        (a.x-frontage[0])**2+(a.y-frontage[1])**2-((b.x-frontage[0])**2+(b.y-frontage[1])**2))[0];
      const anchor = nearestBuilding || matches.map(match => buildings.find(o => match?.test(`${o.name || ''} ${o.asset}`))
        || objects.find(o => match?.test(`${o.name || ''} ${o.asset}`) && !(area.events || []).some(event => event.at[0] === o.x && event.at[1] - 1 === o.y))).find(Boolean)
        || buildings[index % Math.max(1, buildings.length)] || {x:area.spawn[0],y:area.spawn[1]-5,name:'Sheltered road'};
      const preferred = frontage || spec.preferred || [anchor.x + (spec.offset?.[0] || 0), anchor.y + (spec.offset?.[1] || 3)];
      let at = null, bestDistance = Infinity;
      for (const candidate of queue) {
        const distance = (candidate[0]-preferred[0]) ** 2 + (candidate[1]-preferred[1]) ** 2;
        if (distance > bestDistance || occupied.has(key(candidate))
          || protectedPoints.some(point => (point[0]-candidate[0]) ** 2 + (point[1]-candidate[1]) ** 2 < 4)
          || placed.some(point => (point.at[0]-candidate[0]) ** 2 + (point.at[1]-candidate[1]) ** 2 < 9)) continue;
        if (distance < bestDistance || !at || candidate[1] < at[1] || candidate[1] === at[1] && candidate[0] < at[0]) {
          at = candidate; bestDistance = distance;
        }
      }
      if (!at) continue;
      placed.push({id:`${area.id}:service:${spec.key}`, type:spec.type, name:spec.name, label:spec.label,
        at:[...at], asset:`service_${spec.type}`, catalogs:spec.catalogs, description:spec.description,
        free:spec.free, interior:spec.interior, source:spec.source || anchor.name || anchor.asset, solid:false});
    }
    return placed;
  }
}

if (typeof module !== 'undefined') module.exports = { AveluneTownServices };
