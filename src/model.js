/* Simulation, gate checks, collision, and portable save data. */
const WalkModes = new Set(['foot', 'pale_path', 'restored_road']);
const VesselModes = new Set(['ferry', 'lockboat', 'sea_passage', 'coastal_boat', 'caravan', 'tallowback', 'skiff']);

class AveluneWorld {
  constructor(layout, save) {
    this.layout = layout;
    this.tile = layout.tile;
    this.routes = new Map(layout.routes.map(route => [route.id, route]));
    this.events = new Map(layout.events.map(event => [event.id, event]));
    this.flags = new Set(Array.isArray(save?.flags) ? save.flags.filter(flag => this.events.has(flag)) : []);
    this.visited = new Set(Array.isArray(save?.visited) ? save.visited.filter(id => Object.hasOwn(layout.areas,id)) : []);
    this.id = layout.areas[save?.scene]?.id ?? layout.start;
    this.facing = ['north', 'south', 'east', 'west'].includes(save?.facing) ? save.facing : 'south';
    this.moving = false;
    this.x = Number.isFinite(save?.x) ? save.x : this.center(this.area.spawn[0]);
    this.y = Number.isFinite(save?.y) ? save.y : this.center(this.area.spawn[1]);
    if (!this.canStand(this.x, this.y) || this.area.classicTown && ((save?.version||1)<2 || (save?.layoutRevision||1)<(this.area.townLayoutVersion||1))) [this.x, this.y] = this.area.spawn.map(n => this.center(n));
    this.visited.add(this.id);
  }

  get area() { return this.layout.areas[this.id]; }
  center(value) { return (value + 0.5) * this.tile; }

  accessibleAreas() {
    const key=[...this.flags].sort().join(',');
    if(this.accessCache?.key===key)return this.accessCache.ids;
    const ids=new Set([this.layout.start]),queue=[this.layout.start];
    for(const id of queue)for(const route of this.layout.travelGraph||this.layout.routes){
      const to=route.a===id?route.b:route.b===id?route.a:null;
      if(to&&!ids.has(to)&&this.has(route.gate)){ids.add(to);queue.push(to)}
    }
    this.accessCache={key,ids};return ids;
  }

  canEnterArea(id) { return this.accessibleAreas().has(id); }
  routeOpen(route) { return !!route&&this.has(route.gate)&&(!route.access||this.id===route.access||this.canEnterArea(route.access)); }
  routeMissing(route) {
    if(!route.access||this.canEnterArea(route.access))return this.requirements([route.gate]);
    const reached=this.accessibleAreas();
    const frontier=(this.layout.travelGraph||[]).filter(r=>reached.has(r.a)!==reached.has(r.b));
    return [...new Set(frontier.flatMap(r=>this.requirements([r.gate])))];
  }

  has(gate) {
    if (!gate) return true;
    const group = this.layout.gates[gate];
    return group ? group.every(flag => this.has(flag)) : this.flags.has(gate);
  }

  missing(gate) {
    if (this.has(gate)) return [];
    const group = this.layout.gates[gate];
    return group ? [...new Set(group.flatMap(flag => this.missing(flag)))] : [gate];
  }

  requirements(needs) {
    return [...new Set(needs.flatMap(gate => this.missing(gate)))].map(flag => {
      const event = this.events.get(flag);
      return event ? event.title + ' · ' + this.layout.areas[event.scene].name : flag;
    });
  }

  tileOpen(x, y) {
    if (this.area.collision[y]?.[x] !== '.') return false;
    return this.area.barriers.every(({rect, gate}) =>
      this.has(gate) || x < rect[0] || x > rect[2] || y < rect[1] || y > rect[3]);
  }

  canStand(x, y) {
    const radius = 4;
    return [[-radius,-radius], [radius,-radius], [-radius,radius], [radius,radius]]
      .every(([dx,dy]) => this.tileOpen(Math.floor((x+dx)/this.tile), Math.floor((y+dy)/this.tile)));
  }

  move(dx, dy, seconds, run) {
    const length = Math.hypot(dx, dy);
    this.moving = false;
    if (!length || seconds <= 0) return;
    const speed = run ? 145 : 84;
    const elapsed = Math.min(seconds, .04);
    this.facing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
    const x = this.x + dx / length * elapsed * speed;
    const y = this.y + dy / length * elapsed * speed;
    if (this.canStand(x, this.y)) {
      this.moving ||= x !== this.x;
      this.x = x;
    }
    if (this.canStand(this.x, y)) {
      this.moving ||= y !== this.y;
      this.y = y;
    }
  }

  distance(at) { return Math.hypot(this.center(at[0]) - this.x, this.center(at[1]) - this.y); }

  target() {
    const options = [
      ...this.area.events.filter(event => !this.flags.has(event.id)).map(event => ({ ...event, type: 'event' })),
      ...this.area.stops.map(stop => ({ ...stop, type: 'stop' })),
    ];
    const normal=options.filter(item => this.distance(item.at) <= 28)
      .sort((a,b)=>this.distance(a.at)-this.distance(b.at))[0];
    const service=typeof AveluneTownServices!=='undefined'?AveluneTownServices.near(this):null;
    if(service&&(!normal||normal.type!=='event'&&this.distance(service.at)<this.distance(normal.at)))
      return {...service,type:'service',serviceType:service.type,service};
    return normal;
  }

  crossedExit() {
    return this.area.stops.find(stop => (WalkModes.has(stop.mode)||stop.mode==='entrance')
      && this.distance(stop.at) <= 7 && this.routeOpen(this.routes.get(stop.links[0])));
  }

  applyEvent(id) {
    const event = this.events.get(id);
    if (!event || event.scene !== this.id || this.distance(event.at) > 28) return null;
    const missing = this.requirements(event.needs);
    if (missing.length) return {event, missing};
    const already = this.flags.has(id);
    this.flags.add(id);
    return {event, already};
  }

  stopOptions(stop) {
    return stop.links.map(id => {
      const route = this.routes.get(id);
      const to = route.a === this.id ? route.b : route.a;
      return {id, mode: route.mode, to, title: this.layout.areas[to].name,
              open: this.routeOpen(route), missing: this.routeMissing(route), note: route.note};
    });
  }

  planTravel(id) {
    const route = this.routes.get(id);
    const from = route?.stops[this.id];
    const stop = this.area.stops.find(item => item.id === from);
    if (!stop || !this.routeOpen(route) || this.distance(stop.at) > 30) return null;
    const to = route.a === this.id ? route.b : route.a;
    const area = this.layout.areas[to];
    const arrival = area.stops.find(item => item.id === route.stops[to]);
    return {route, from: this.id, to, arrival};
  }

  arrive(travel) {
    if (this.id !== travel.from) return false;
    this.id = travel.to;
    this.visited.add(this.id);
    [this.x, this.y] = travel.arrival.arrival.map(value => this.center(value));
    if (!this.canStand(this.x, this.y)) [this.x, this.y] = this.area.spawn.map(value => this.center(value));
    const [x,y] = travel.arrival.arrival;
    const [ax,ay] = travel.arrival.at;
    this.facing = Math.abs(x-ax) > Math.abs(y-ay) ? (x > ax ? 'east' : 'west') : (y < ay ? 'north' : 'south');
    this.moving = false;
    return true;
  }

  reachable() {
    const seen = new Map([[this.id, null]]);
    const queue = [this.id];
    for (const here of queue) {
      for (const stop of this.layout.areas[here].stops) {
        for (const link of stop.links) {
          const route = this.routes.get(link);
          const there = route.a === here ? route.b : route.a;
          if (seen.has(there) || !this.has(route.gate) || route.access&&!this.canEnterArea(route.access)&&here!==route.access) continue;
          seen.set(there, seen.get(here) ?? {stop, there});
          queue.push(there);
        }
      }
    }
    return seen;
  }

  objectives() {
    const seen = this.reachable();
    const pending = this.layout.events.filter(event => event.required
      && !this.flags.has(event.id) && event.needs.every(gate => this.has(gate)) && seen.has(event.scene));
    const currentRegion = this.area.region;
    pending.sort((a,b) => Number(this.layout.areas[b.scene].region === currentRegion)
      - Number(this.layout.areas[a.scene].region === currentRegion));
    return pending.map(event => ({event, hop:seen.get(event.scene)}));
  }

  get chapter() {
    if (this.has('ending')) return 'The Roads Restored';
    if (this.has('keeping')) return 'Act V · The Roads We Keep';
    if (this.has('ember')) return 'Act IV · The Keeping';
    if (this.has('ordel')) return 'Act III · Crossing the Pale';
    if (this.has('alderreach')) return 'Act II · The Pilgrimage';
    return this.has('depart') ? 'Act I · A Road Worth Keeping' : 'Prologue · Brackenwell';
  }

  snapshot() {
    return {version: 2, layoutRevision:this.area.townLayoutVersion||1, scene: this.id, x: this.x, y: this.y, facing: this.facing,
            flags: [...this.flags], visited: [...this.visited]};
  }
}

if (typeof module !== 'undefined') module.exports = {AveluneWorld, WalkModes, VesselModes};

// Distance-based encounters: frame rate and blocked input cannot create steps.
class AveluneDanger {
  constructor(seed=9137) { this.seed=seed>>>0; this.distance=0; this.steps=0; this.grace=8; this.threshold=this.roll(); }
  roll() { this.seed=(1664525*this.seed+1013904223)>>>0; return 24+(this.seed%17); }
  reset(grace=8) { this.distance=0; this.steps=0; this.grace=grace; this.threshold=this.roll(); }
  advance(distance,safe=false) {
    if(safe){this.steps=0;this.distance=0;return false;}
    if(!Number.isFinite(distance)||distance<=0)return false;
    this.distance+=distance;
    while(this.distance>=16-1e-9){this.distance=Math.max(0,this.distance-16);if(this.grace>0)this.grace--;else this.steps++;}
    if(this.steps>=this.threshold){this.reset(10);return true;}return false;
  }
  get ratio(){return Math.min(1,this.steps/this.threshold);}
}

function avelunePath(world,to) {
  const start=[Math.floor(world.x/world.tile),Math.floor(world.y/world.tile)];
  const entrances=new Set(world.area.kind==='overworld'?world.area.stops
    .filter(stop=>WalkModes.has(stop.mode)||stop.mode==='entrance').map(stop=>stop.at.join(',')):[]);
  const key=p=>p.join(',');const todo=[start], prev=new Map([[key(start),null]]);
  for(let i=0;i<todo.length;i++){const p=todo[i];if(p[0]===to[0]&&p[1]===to[1]){const path=[];let q=p;while(prev.get(key(q))){path.unshift(q);q=prev.get(key(q));}return path;}
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const q=[p[0]+dx,p[1]+dy];if(prev.has(key(q))||entrances.has(key(q))&&(q[0]!==to[0]||q[1]!==to[1])||!world.canStand(world.center(q[0]),world.center(q[1])))continue;prev.set(key(q),p);todo.push(q);}}return null;
}
