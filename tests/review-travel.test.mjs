import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx=vm.createContext({Set,Map});
for(const file of ['world-travel','model'])vm.runInContext(fs.readFileSync(new URL('../src/'+file+'.js',import.meta.url),'utf8'),ctx);
vm.runInContext('this.API={AveluneOverworld,AveluneWorld,avelunePath}',ctx);
const {AveluneOverworld:Overworld,AveluneWorld:World,avelunePath}=ctx.API;
const build=()=>Overworld.apply(JSON.parse(fs.readFileSync(new URL('../src/world.json',import.meta.url),'utf8')));

test('every town mapped departure leads to its overworld rather than a regional shortcut',()=>{
  const layout=build();
  for(const town of Object.values(layout.areas).filter(a=>a.classicTown)){
    const departures=town.stops.filter(s=>['foot','pale_path','restored_road'].includes(s.mode));
    assert.equal(departures.length,1,town.id+' has one clear town exit');
    const route=layout.routes.find(r=>r.id===departures[0].links[0]);
    const to=route.a===town.id?route.b:route.a;
    assert.equal(to,town.overworld,town.id+' exits to its broad map');
    assert.equal(layout.areas[to].kind,'overworld');
  }
});

test('regional foot crossings stay gated and join usable overworld gateways',()=>{
  const layout=build(),world=new World(layout,{flags:layout.events.map(e=>e.id)});
  for(const original of layout.travelGraph.filter(r=>['foot','pale_path','restored_road'].includes(r.mode))){
    const a=layout.areas[original.a],b=layout.areas[original.b];
    if(a.indoor||b.indoor||a.region===b.region)continue;
    const route=world.routes.get(original.id);
    assert.equal(route.gate,original.gate,route.id+' retains its unlock');
    assert.equal(route.a,a.overworld);assert.equal(route.b,b.overworld);
    for(const here of [route.a,route.b]){
      world.id=here;[world.x,world.y]=world.area.spawn.map(n=>world.center(n));
      const stop=world.area.stops.find(s=>s.id===route.stops[here]);
      assert.ok(avelunePath(world,stop.at),route.id+' gateway is walkable from '+here);
      assert.ok(world.distance(stop.at)>7,'Map spawn avoids gateway');
    }
  }
});

test('each blocked overworld shore has a visible water boundary',()=>{
  const layout=build();
  for(const area of Object.values(layout.areas).filter(a=>a.kind==='overworld')){
    for(let y=1;y<area.height-1;y++)for(let x=1;x<area.width-1;x++)if(area.collision[y][x]==='.'){
      for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
        if(area.collision[y+dy][x+dx]==='#')assert.equal(area.terrain[y+dy][x+dx],'=',area.id+' has visible coast at '+[x+dx,y+dy]);
      }
    }
  }
});

test('travel arrivals never immediately trigger another walking exit',()=>{
  const layout=build(),world=new World(layout,{flags:layout.events.map(e=>e.id)});
  for(const route of layout.routes)for(const from of [route.a,route.b]){
    world.id=from;
    const stop=world.area.stops.find(s=>s.id===route.stops[from]);
    [world.x,world.y]=stop.at.map(n=>world.center(n));
    const plan=world.planTravel(route.id);assert.ok(plan,route.id+' from '+from);
    assert.equal(world.arrive(plan),true);
    assert.equal(world.crossedExit(),undefined,route.id+' arrival in '+world.id+' avoids an automatic exit');
  }
});

test('overworld guidance walks around intermediate entrances instead of entering the wrong scene',()=>{
  const layout=build(),world=new World(layout,{flags:layout.events.map(e=>e.id)});
  for(const [from,to]of [['alderreach_01','alderreach_04'],['alderreach_02','alderreach_08'],['alderreach_04','alderreach_03']]){
    const area=layout.areas[layout.areas[from].overworld];world.id=area.id;
    const entrance=id=>area.stops.find(s=>s.links.includes('OW_'+id));
    const start=entrance(from),target=entrance(to);
    [world.x,world.y]=start.arrival.map(n=>world.center(n));
    const path=avelunePath(world,target.at);assert.ok(path,from+' has a guided path to '+to);
    for(const tile of path){
      [world.x,world.y]=tile.map(n=>world.center(n));
      const crossed=world.crossedExit();
      assert.ok(!crossed||crossed.id===target.id,from+' to '+to+' must avoid intermediate '+crossed?.title);
    }
    assert.equal(world.crossedExit()?.id,target.id,'Guidance still reaches the intended entrance');
  }
});
