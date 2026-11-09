/* Original miniature world-map art, separate from the life-sized town tiles. */
const AveluneOverworldArt = (() => {
  const heroCache = new Map();
  const sea = value => value === '~' || value === '=';
  const settlements = new Set(['village', 'town', 'port', 'market']);
  const hash = (x,y) => AveluneTerrain.hash(x,y,47);

  function forest(c,x,y,p,snow=false) {
    c.fillStyle=p.wood;c.fillRect(x+3,y+7,2,3);
    c.fillStyle=p.tree;c.fillRect(x,y+4,8,4);c.fillRect(x+1,y+2,6,2);c.fillRect(x+3,y,2,2);
    c.fillStyle=snow?p.snow:p.treeLight;c.fillRect(x+2,y+3,3,2);c.fillRect(x+1,y+5,3,1);
    c.fillStyle=p.ink;c.fillRect(x+1,y+8,6,1);
  }

  function mountain(c,x,y,p,snow=false) {
    c.fillStyle=p.ink;c.fillRect(x+1,y+13,14,2);c.fillRect(x+3,y+9,10,4);c.fillRect(x+5,y+5,6,4);c.fillRect(x+7,y+2,2,3);
    c.fillStyle=p.stone;c.fillRect(x+3,y+11,10,3);c.fillRect(x+5,y+7,6,5);c.fillRect(x+7,y+4,2,6);
    c.fillStyle=snow?p.snow:p.stoneLight;c.fillRect(x+7,y+4,2,4);c.fillRect(x+5,y+8,3,4);c.fillRect(x+3,y+12,4,1);
  }

  function hills(c,x,y,p,snow=false) {
    // Low, rounded hills remain walkable; sharp stone peaks mean a barrier.
    c.fillStyle=snow?p.snowShade:p.wood;c.fillRect(x+1,y+12,14,2);c.fillRect(x+3,y+10,10,2);c.fillRect(x+5,y+8,6,2);
    c.fillStyle=snow?p.snow:p.pathDark;c.fillRect(x+4,y+10,7,2);c.fillRect(x+6,y+8,4,2);
    c.fillStyle=snow?p.cream:p.pathLight;c.fillRect(x+6,y+8,3,1);c.fillRect(x+4,y+10,2,1);
  }

  function paint(c,area) {
    const p=AveluneTerrain.palette(area.theme),rows=area.terrain;
    const read=(x,y)=>rows[y]?.[x]??'=';
    for(let y=0;y<area.height;y++)for(let x=0;x<area.width;x++) {
      const type=read(x,y),u=x*16,v=y*16,n=hash(x,y),water=sea(type);
      c.fillStyle=water?(type==='='?'#254b73':p.water):p.ground;
      c.fillRect(u,v,16,16);
      if(water) {
        if(n%5===0){c.fillStyle=p.waterLight;c.fillRect(u+3,v+7,5,1);c.fillRect(u+8,v+11,3,1);}
        for(const [dx,dy,side]of[[0,-1,0],[1,0,1],[0,1,2],[-1,0,3]])if(!sea(read(x+dx,y+dy))) {
          c.fillStyle=p.pathLight;
          if(side===0)c.fillRect(u,v,16,2);if(side===1)c.fillRect(u+14,v,2,16);if(side===2)c.fillRect(u,v+14,16,2);if(side===3)c.fillRect(u,v,2,16);
          c.fillStyle=p.waterFoam;
          if(side===0)c.fillRect(u,v+2,16,1);if(side===1)c.fillRect(u+13,v,1,16);if(side===2)c.fillRect(u,v+13,16,1);if(side===3)c.fillRect(u+2,v,1,16);
        }
      } else if(type==='^'||type==='#'||type==='%') {
        if(type==='%'){c.fillStyle=p.deep;c.fillRect(u,v,16,16);c.fillStyle=p.pale;c.fillRect(u+5,v+5,3,7);c.fillRect(u+8,v+3,2,10);}
        else if(area.collision[y]?.[x]==='.')hills(c,u,v,p,area.theme==='snow');
        else mountain(c,u,v,p,area.theme==='snow');
      } else if(type==='b') {
        c.fillStyle=p.water;c.fillRect(u,v,16,16);c.fillStyle=p.wood;c.fillRect(u,v+5,16,7);c.fillStyle=p.woodBright;c.fillRect(u,v+5,16,1);c.fillRect(u,v+10,16,1);c.fillStyle=p.ink;c.fillRect(u,v+12,16,1);
      } else if(type==='d'||type==='p'||type==='r') {
        // A world road is a narrow trail between miniature landmarks.
        c.fillStyle=p.path;c.fillRect(u+5,v+5,6,6);
        for(const [dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]])if('dprb'.includes(read(x+dx,y+dy)))c.fillRect(u+5+dx*5,v+5+dy*5,6,6);
        c.fillStyle=p.pathDark;c.fillRect(u+7,v+9,2,1);
      } else {
        if(n%9===0){c.fillStyle=p.light;c.fillRect(u+3,v+5,2,1);c.fillRect(u+10,v+12,3,1);}
        const nearNode=area.mapNodes?.some(node=>Math.abs(node.at[0]-x)<2&&Math.abs(node.at[1]-y)<2);
        if(!nearNode&&(type==='f'||(n%7===0&&!['salt','basalt','ivory','sky'].includes(area.theme)))) {
          forest(c,u+1,v+1,p,area.theme==='snow');forest(c,u+8,v+6,p,area.theme==='snow');
        } else if(area.theme==='salt'&&n%7===0) {
          c.fillStyle=p.dark;c.fillRect(u+5,v+5,2,8);c.fillRect(u+2,v+7,3,2);c.fillRect(u+8,v+4,2,4);c.fillRect(u+6,v+7,3,2);
        }
      }
    }
  }

  function bake(area) {
    const canvas=document.createElement('canvas');canvas.width=area.width*16;canvas.height=area.height*16;
    const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;paint(c,area);return canvas;
  }

  function house(c,x,y,p) {
    c.fillStyle=p.ink;c.fillRect(x,y+3,9,8);c.fillRect(x+1,y+1,7,2);
    c.fillStyle=p.wall;c.fillRect(x+1,y+6,7,4);c.fillStyle=p.roof;c.fillRect(x,y+3,9,3);c.fillRect(x+2,y+1,5,2);
    c.fillStyle=p.roofLight;c.fillRect(x+2,y+2,5,1);c.fillStyle=p.ink;c.fillRect(x+4,y+7,2,4);
  }

  function node(c,node,x,y,accessible=true) {
    const p=AVELUNE_PALETTE;
    c.save();if(!accessible)c.globalAlpha=.65;
    if(settlements.has(node.kind)) {
      // This tiny district plan repeats the full town's shore and gate direction.
      c.fillStyle=p.grassDark;c.fillRect(x-13,y-21,26,24);
      c.fillStyle=node.theme==='salt'?p.pathLight:node.theme==='snow'?p.snow:p.grass;c.fillRect(x-12,y-20,24,22);
      const shore=node.waterfront;
      if(shore){c.fillStyle='#254b73';if(shore==='north')c.fillRect(x-13,y-24,26,5);if(shore==='south')c.fillRect(x-13,y+1,26,5);if(shore==='east')c.fillRect(x+11,y-21,5,24);if(shore==='west')c.fillRect(x-16,y-21,5,24);}
      const gate={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]}[node.entranceSide||'south'];
      const gx=x+gate[0]*13,gy=y-9+gate[1]*13;
      c.fillStyle=p.pathLight;c.fillRect(gx-(gate[0]?4:1),gy-(gate[1]?4:1),gate[0]?9:3,gate[1]?9:3);
      c.fillStyle=p.stoneLight;
      if(gate[0]){c.fillRect(gx-1,gy-5,3,3);c.fillRect(gx-1,gy+3,3,3)}
      else{c.fillRect(gx-5,gy-1,3,3);c.fillRect(gx+3,gy-1,3,3)}
    }
    c.fillStyle=p.ink;c.fillRect(x-9,y-1,18,4);
    if(settlements.has(node.kind)) {
      house(c,x-10,y-14,p);house(c,x+1,y-11,p);
      if(node.kind==='town'){c.fillStyle=p.stoneLight;c.fillRect(x-2,y-18,5,11);c.fillStyle=p.gold;c.fillRect(x,y-21,4,2);c.fillStyle=p.ink;c.fillRect(x-2,y-19,5,2);}
      if(node.waterfront){const shore=node.waterfront;c.fillStyle=p.woodBright;if(shore==='east'||shore==='west'){c.fillRect(x+(shore==='east'?8:-16),y-9,9,3);c.fillRect(x+(shore==='east'?14:-16),y-12,2,9)}else{c.fillRect(x-4,y+(shore==='north'?-24:0),3,7);c.fillRect(x-7,y+(shore==='north'?-24:5),9,2)}}
      if(node.waterFeature==='oasis_pool'){c.fillStyle=p.water;c.fillRect(x+5,y-1,6,3);c.fillStyle=p.waterFoam;c.fillRect(x+6,y-1,4,1)}
      if(node.theme==='snow'){c.fillStyle=p.cream;c.fillRect(x-8,y-12,5,1);c.fillRect(x+3,y-9,5,1)}
    } else if(['dungeon','ruin','secret','postgame'].includes(node.kind)) {
      c.fillStyle=p.stone;c.fillRect(x-9,y-7,18,8);c.fillRect(x-6,y-11,12,5);c.fillStyle=p.stoneLight;c.fillRect(x-6,y-10,5,2);
      c.fillStyle=p.ink;c.fillRect(x-4,y-5,8,7);c.fillRect(x-2,y-7,4,2);
    } else if(['hearth','shrine','finale'].includes(node.kind)) {
      c.fillStyle=p.stoneLight;c.fillRect(x-6,y-6,12,7);c.fillRect(x-4,y-11,8,5);c.fillStyle=p.ink;c.fillRect(x-7,y,14,2);
      c.fillStyle=p.roofLight;c.fillRect(x-3,y-14,6,5);c.fillStyle=p.gold;c.fillRect(x-1,y-17,3,8);c.fillStyle=p.cream;c.fillRect(x,y-13,1,3);
    } else if(['camp','landing'].includes(node.kind)) {
      c.fillStyle=p.ink;c.fillRect(x-8,y-4,16,6);c.fillStyle=p.pathLight;c.fillRect(x-5,y-8,10,8);c.fillRect(x-2,y-11,4,3);c.fillStyle=p.wood;c.fillRect(x-1,y-5,3,7);
    } else if(['bridge','lock','gate'].includes(node.kind)) {
      c.fillStyle=p.stone;c.fillRect(x-9,y-8,5,10);c.fillRect(x+4,y-8,5,10);c.fillRect(x-5,y-10,10,4);c.fillStyle=p.stoneLight;c.fillRect(x-9,y-8,5,2);c.fillRect(x+4,y-8,5,2);
    } else {
      c.fillStyle=p.wood;c.fillRect(x-1,y-9,2,11);c.fillStyle=p.gold;c.fillRect(x-6,y-10,13,4);c.fillStyle=p.ink;c.fillRect(x-5,y-8,10,1);
    }
    c.restore();
    if(!accessible){c.fillStyle=p.ink;c.fillRect(x+6,y-16,7,7);c.fillStyle=p.gold;c.fillRect(x+8,y-14,3,4);c.fillRect(x+8,y-16,3,1);}
  }

  function gateway(c,x,y,open=true) {
    const p=AVELUNE_PALETTE;
    c.fillStyle=p.ink;c.fillRect(x-8,y-11,3,13);c.fillRect(x+5,y-11,3,13);c.fillRect(x-8,y-12,16,3);
    c.fillStyle=p.woodBright;c.fillRect(x-7,y-10,1,11);c.fillRect(x+6,y-10,1,11);c.fillRect(x-6,y-11,12,1);
    c.fillStyle=open?p.gold:p.roofLight;c.fillRect(x-4,y-7,7,3);c.fillRect(x+2,y-8,2,5);c.fillRect(x+4,y-6,1,1);
    if(!open){c.fillStyle=p.wood;c.fillRect(x-5,y-2,10,2);c.fillStyle=p.gold;c.fillRect(x-1,y-3,3,3);}
  }

  function hero(c,id,direction,frame,x,y) {
    const key=[id,direction,frame&3].join('|');let sprite=heroCache.get(key);
    if(!sprite){
      const source=document.createElement('canvas');source.width=16;source.height=24;
      AvelunePixelArt.drawHero(source.getContext('2d'),id,direction,frame,8,24);
      sprite=document.createElement('canvas');sprite.width=8;sprite.height=12;
      const tiny=sprite.getContext('2d');tiny.imageSmoothingEnabled=false;tiny.drawImage(source,0,0,8,12);heroCache.set(key,sprite);
    }
    c.fillStyle='#17233488';c.fillRect(Math.round(x)-4,Math.round(y),8,2);
    c.drawImage(sprite,Math.round(x)-4,Math.round(y)-12);
    return {left:Math.round(x)-4,top:Math.round(y)-12,w:8,h:12};
  }

  return Object.freeze({bake,paint,node,gateway,hero});
})();
globalThis.AveluneOverworldArt=AveluneOverworldArt;
