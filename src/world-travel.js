/* Two exploration scales. Original routes remain the authority for story access. */
const AveluneOverworld = {
  apply(layout) {
    if (layout.overworldVersion) return layout;
    const walk = new Set(['foot','pale_path','restored_road']);
    layout.travelGraph = layout.routes.map(r => ({...r, stops:{...r.stops}}));
    const outside = Object.values(layout.areas).filter(a => !a.indoor);
    const removed = new Set(layout.routes.filter(r => walk.has(r.mode)
      && !layout.areas[r.a].indoor && !layout.areas[r.b].indoor
      && layout.areas[r.a].region === layout.areas[r.b].region).map(r => r.id));
    layout.routes = layout.routes.filter(r => !removed.has(r.id));
    for (const area of outside) {
      area.worldExit??=area.stops.find(s=>s.links.some(id=>removed.has(id)))?.at;
      area.stops = area.stops.filter(s => s.links.some(id => !removed.has(id)));
      if(!area.worldExit){
        const open=(x,y)=>area.collision[y]?.[x]==='.'&&area.barriers.every(({rect})=>x<rect[0]||x>rect[2]||y<rect[1]||y>rect[3]);
        const seen=new Set([area.spawn.join(',')]),queue=[[...area.spawn]];
        for(const [x,y]of queue)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const q=[x+dx,y+dy],key=q.join(',');if(!seen.has(key)&&open(...q)){seen.add(key);queue.push(q)}}
        const reserved=[area.spawn,...area.stops.flatMap(s=>[s.at,s.arrival]),...area.events.map(e=>e.at)];
        const candidates=queue.filter(p=>reserved.every(q=>Math.hypot(p[0]-q[0],p[1]-q[1])>=3));
        candidates.sort((a,b)=>b[1]-a[1]||Math.abs(a[0]-area.width/2)-Math.abs(b[0]-area.width/2));
        area.worldExit=candidates[0]||queue.at(-1);
      }
    }
    for (const region of layout.regions) {
      const nodes = outside.filter(a => a.region === region.id);
      const width=112,height=80, margin=12;
      const minX=Math.min(...nodes.map(a=>a.x)),maxX=Math.max(...nodes.map(a=>a.x));
      const minY=Math.min(...nodes.map(a=>a.y)),maxY=Math.max(...nodes.map(a=>a.y));
      const points=new Map();
      for(const a of nodes){
        let x=Math.round(margin+(a.x-minX)/Math.max(1,maxX-minX)*(width-margin*2));
        let y=Math.round(margin+(a.y-minY)/Math.max(1,maxY-minY)*(height-margin*2));
        for(let n=0;n<100 && [...points.values()].some(p=>Math.hypot(p[0]-x,p[1]-y)<11);n++){
          x=Math.max(5,Math.min(width-6,x+(n%2? -1:1)*(3+Math.floor(n/4))));
          y=Math.max(5,Math.min(height-6,y+(n%3?2:-3)));
        }
        points.set(a.id,[x,y]);
      }
      const localEdges=layout.travelGraph.filter(r=>removed.has(r.id)&&nodes.some(a=>a.id===r.a));
      const groups=[];const assigned=new Set();
      for(const node of nodes){if(assigned.has(node.id))continue;const ids=new Set([node.id]),queue=[node.id];assigned.add(node.id);
        for(const id of queue)for(const r of localEdges){const other=r.a===id?r.b:r.b===id?r.a:null;if(other&&!assigned.has(other)){assigned.add(other);ids.add(other);queue.push(other)}}
        groups.push(ids);
      }
      const terrain=Array.from({length:height},()=>Array(width).fill('='));
      const landByGroup=[];
      groups.forEach(ids=>{
        const cells=new Set();
        const disk=(cx,cy,r)=>{for(let y=Math.max(1,cy-r);y<Math.min(height-1,cy+r+1);y++)for(let x=Math.max(1,cx-r);x<Math.min(width-1,cx+r+1);x++)if((x-cx)**2+(y-cy)**2<=r*r)cells.add(x+','+y)};
        for(const id of ids){const[x,y]=points.get(id);disk(x,y,7);disk(x+2,y+2,6)}
        for(const r of localEdges.filter(r=>ids.has(r.a))){const a=points.get(r.a),b=points.get(r.b),n=Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]));for(let k=0;k<=n;k++)disk(Math.round(a[0]+(b[0]-a[0])*k/n),Math.round(a[1]+(b[1]-a[1])*k/n),4)}
        for(const id of ids){
          const town=layout.areas[id],shore=town.geography?.waterfront;if(!shore)continue;
          const [dx,dy]={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]}[shore],[cx,cy]=points.get(id);
          // A bay beside the miniature agrees with the full town's waterfront.
          // Its inland apron and neighboring destinations remain clear.
          for(let d=5;d<=9;d++)for(let across=-4;across<=4;across++){
            const x=cx+dx*d+dy*across,y=cy+dy*d+dx*across;
            if([...points.values()].some(p=>Math.hypot(p[0]-x,p[1]-y)<4))continue;
            cells.delete(x+','+y);
          }
        }
        for(const cell of cells){const[x,y]=cell.split(',').map(Number);terrain[y][x]='g'}
        landByGroup.push(cells);
      });
      // Small forests and mountain ranges are map symbols; entrances keep a clear apron.
      for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++)if(terrain[y][x]==='g'&&![...points.values()].some(p=>Math.hypot(p[0]-x,p[1]-y)<4)){
        const noise=(x*13+y*31+(x*y)%47)%29;if(noise<5)terrain[y][x]='f';else if(noise===9)terrain[y][x]='^';
      }
      groups.forEach((ids,index)=>{
        const worldId='world_'+region.id+(index?'_'+(index+1):'');
        const first=points.get([...ids][0]);
        const visible=terrain.map(row=>[...row]),land=landByGroup[index];
        // Separate shores need visible water, including where source coordinates
        // put independently transported islands close to the mainland.
        for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++)if(!land.has(x+','+y)
          && [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>land.has((x+dx)+','+(y+dy))))visible[y][x]='=';
        const area={id:worldId,name:region.name+' Overworld',region:region.id,kind:'overworld',theme:nodes[0].theme,feature:'continent',indoor:false,width,height,spawn:[first[0],first[1]+3],
          terrain:visible.map(row=>row.join('')),collision:Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>land.has(x+','+y)?'.':'#').join('')),
          objects:[],events:[],stops:[],barriers:[],note:'Walk the wider world. Enter a settlement or dungeon at its miniature. Ships and the Skiff connect separate shores.',
          mapNodes:nodes.map(a=>({id:a.id,name:a.name,kind:a.kind,at:points.get(a.id),entranceSide:a.worldEntranceSide||'south',waterfront:a.geography?.waterfront||null,waterFeature:a.geography?.waterFeature||null,theme:a.theme,districtPlan:a.geography?.districtPlan||null})),allowedEntries:[...ids]};
        layout.areas[worldId]=area;
        for(const id of ids){const town=layout.areas[id],point=points.get(id),routeId='OW_'+id;
          let exit=town.worldExit||town.stops.find(s=>walk.has(s.mode))?.at||town.spawn;
          exit=[...exit];
          const outward={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]}[town.worldEntranceSide||'south'];
          const localStop={id:id+'_world',mode:'foot',title:region.name+' Overworld',at:exit,arrival:[exit[0]-outward[0]*2,exit[1]-outward[1]*2],links:[routeId]};
          if(town.collision[localStop.arrival[1]]?.[localStop.arrival[0]]!=='.')localStop.arrival=[...town.spawn];
          const worldStop={id:worldId+'_'+id,mode:'entrance',title:town.name,at:point,arrival:[point[0]+outward[0]*3,point[1]+outward[1]*3],links:[routeId]};
          town.stops.push(localStop);area.stops.push(worldStop);town.overworld=worldId;
          layout.routes.push({id:routeId,a:id,b:worldId,mode:'foot',gate:'start',access:id,stops:{[id]:localStop.id,[worldId]:worldStop.id},note:'Enter from the overworld. Earlier road repairs and transport unlocks still apply.'});
        }
      });
    }
    // Regional boundaries belong to the broad map, never to a town's exit.
    const gatewayCounts=new Map();
    for(const route of layout.routes.filter(r=>walk.has(r.mode)&&!r.access)){
      const a=layout.areas[route.a],b=layout.areas[route.b];
      if(a.indoor||b.indoor||a.region===b.region)continue;
      const stops={};
      for(const local of [a,b]){
        local.stops=local.stops.filter(s=>!s.links.includes(route.id));
        const map=layout.areas[local.overworld],point=map.mapNodes.find(n=>n.id===local.id).at;
        const n=gatewayCounts.get(local.id)||0;gatewayCounts.set(local.id,n+1);
        const choices=[[5,0],[-5,0],[0,-5],[0,5]];
        const [dx,dy]=[...choices.slice(n%4),...choices.slice(0,n%4)].find(([dx,dy])=>map.collision[point[1]+dy]?.[point[0]+dx]==='.'&&!map.gateways?.some(g=>g.at[0]===point[0]+dx&&g.at[1]===point[1]+dy))||choices[n%4];
        const at=[point[0]+dx,point[1]+dy],arrival=[point[0]+Math.sign(dx)*2,point[1]+Math.sign(dy)*2];
        const other=local===a?b:a;
        const stop={id:map.id+'_'+route.id,mode:route.mode,title:layout.areas[other.overworld].name,at,arrival,links:[route.id]};
        map.stops.push(stop);stops[map.id]=stop.id;
        map.gateways??=[];map.gateways.push({at,title:'To '+layout.regions.find(r=>r.id===other.region).name,route:route.id});
      }
      route.a=a.overworld;route.b=b.overworld;route.stops=stops;
    }
    layout.overworldVersion=1;
    return layout;
  }
};
if(typeof module!=='undefined')module.exports={AveluneOverworld};
