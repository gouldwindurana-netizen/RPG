/* Original 16px terrain vocabulary. All maps use the same material ramps and edge rules. */
const AveluneTerrain=(()=>{
 const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
 const water=c=>c==='~'||c==='=';
 const solid=c=>c==='#'||c==='^'||c==='%';
 function palette(theme){const p=AVELUNE_PALETTE;const variants={
  orchard:{ground:p.grass,light:p.grassLight,bright:p.grassBright,dark:p.grassDark,path:p.path,pathDark:p.pathDark,pathLight:p.pathLight},
  marsh:{ground:'#4d7862',light:'#6b9471',bright:'#8eaf83',dark:'#355b50',path:'#b6a16e',pathDark:'#93845e',pathLight:'#d2bd86'},
  basalt:{ground:'#62646b',light:'#7d7d80',bright:'#9a9690',dark:'#454a57',path:'#a3947a',pathDark:'#85765f',pathLight:'#c1ae8c'},
  salt:{ground:'#c7b17a',light:'#dbc78f',bright:'#eee0b0',dark:'#a18d65',path:'#b59867',pathDark:'#947851',pathLight:'#d1b57e'},
  forest:{ground:'#426a4b',light:'#5c8759',bright:'#83a46b',dark:'#294d3d',path:p.path,pathDark:p.pathDark,pathLight:p.pathLight},
  island:{ground:'#668a55',light:'#84a365',bright:'#a6ba78',dark:'#40694b',path:'#d6be89',pathDark:'#b2996c',pathLight:'#eddaa9'},
  snow:{ground:p.snow,light:'#e0e8db',bright:p.cream,dark:p.snowShade,path:'#a6b8bb',pathDark:'#829aa8',pathLight:'#c6d3ce'},
  ivory:{ground:'#89939a',light:'#a4ada9',bright:'#c4c7ba',dark:'#657382',path:'#bcb5a6',pathDark:'#9b968e',pathLight:'#ddd3ba'},
  sky:{ground:'#8c8da7',light:'#acaac1',bright:'#d0c8d3',dark:'#656780',path:'#b9afbb',pathDark:'#95899d',pathLight:'#d9cbd6'},
 };return{...p,...(variants[theme]||variants.orchard)};}
 function hash(x,y,salt=0){let n=(Math.imul(x+17,374761393)^Math.imul(y+31,668265263)^Math.imul(salt+7,1597334677))>>>0;n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0;}
 function edge(ctx,x,y,side,size,color){ctx.fillStyle=color;if(side===0)ctx.fillRect(x,y,16,size);if(side===1)ctx.fillRect(x+16-size,y,size,16);if(side===2)ctx.fillRect(x,y+16-size,16,size);if(side===3)ctx.fillRect(x,y,size,16);}
 function bake(area){const canvas=document.createElement('canvas');canvas.width=area.width*16;canvas.height=area.height*16;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;paint(c,area);return canvas;}
 function paint(c,area){const p=palette(area.theme),rows=area.terrain;const read=(x,y,fallback='~')=>rows[y]?.[x]??fallback;
  for(let y=0;y<area.height;y++)for(let x=0;x<area.width;x++){
   const k=read(x,y),u=x*16,v=y*16,n=hash(x,y),adj=dirs.map(([dx,dy])=>read(x+dx,y+dy,k));
   if(k==='g'){
    c.fillStyle=p.ground;c.fillRect(u,v,16,16);
    if(area.theme==='salt'){if(n%3===0){c.fillStyle=p.light;c.fillRect(u+3,v+10,7,1);c.fillRect(u+7,v+8,5,1)}}
    else if(area.theme==='snow'){if(n%5===0){c.fillStyle=p.dark;c.fillRect(u+3,v+11,3,1);c.fillStyle=p.light;c.fillRect(u+2,v+10,3,1)}}
    else if(n%3===0){const a=3+n%8,b=4+(n>>>5)%8;c.fillStyle=p.dark;c.fillRect(u+a,v+b,1,2);c.fillRect(u+a+3,v+b-1,1,2);c.fillStyle=p.light;c.fillRect(u+a+1,v+b-2,1,2)}
    if(area.theme==='ivory'&&n%7===0){c.fillStyle=p.light;c.fillRect(u+6,v+10,3,1);c.fillRect(u+7,v+8,1,3)}
   }else if(water(k)){
    c.fillStyle=k==='='?'#2b5078':p.water;c.fillRect(u,v,16,16);
    for(let side=0;side<4;side++)if(!water(adj[side])&&adj[side]!=='b'){
     edge(c,u,v,side,4,p.waterLight);edge(c,u,v,side,2,p.waterFoam);edge(c,u,v,side,1,p.pathDark);
     c.fillStyle=p.waterFoam;const b=(x+y)%2*5+4;if(side===0)c.fillRect(u+b,v+2,4,1);if(side===2)c.fillRect(u+b,v+13,4,1);if(side===1)c.fillRect(u+13,v+b,1,4);if(side===3)c.fillRect(u+2,v+b,1,4);
    }
    if(n%4===0){c.fillStyle=p.waterLight;c.fillRect(u+3,v+8,5,1);c.fillRect(u+7,v+10,3,1)}
   }else if(k==='d'){
    c.fillStyle=p.path;c.fillRect(u,v,16,16);
    for(let side=0;side<4;side++)if(adj[side]==='g'){
     edge(c,u,v,side,2,p.ground);c.fillStyle=p.pathDark;
     if(side===0)c.fillRect(u+2+(x%3)*3,v+2,6,1);if(side===2)c.fillRect(u+4,v+13,6,1);if(side===1)c.fillRect(u+13,v+3,1,6);if(side===3)c.fillRect(u+2,v+5,1,5);
    }
    if(n%4===0){c.fillStyle=p.pathDark;c.fillRect(u+4,v+10,2,1);c.fillStyle=p.pathLight;c.fillRect(u+9,v+5,2,1)}
   }else if(k==='b'){
    c.fillStyle=p.wood;c.fillRect(u,v,16,16);for(let i=0;i<16;i+=4){c.fillStyle=p.woodLight;c.fillRect(u,v+i,16,3);c.fillStyle=p.woodBright;c.fillRect(u+1,v+i,14,1)}
    for(let side=0;side<4;side++)if(water(adj[side])){edge(c,u,v,side,2,p.ink);edge(c,u,v,side,1,p.woodBright)}
    c.fillStyle=p.wood;c.fillRect(u+3,v+1,1,2);c.fillRect(u+11,v+9,1,2);
   }else if(k==='i'||k==='p'||k==='r'||k==='a'){
    const wooden=k==='i'&&['home','inn','barn','work'].includes(area.feature);
    const base=wooden?p.woodLight:k==='a'?p.pale:p.stoneLight,shade=wooden?p.wood:p.stone,high=wooden?p.woodBright:p.stoneBright;
    c.fillStyle=base;c.fillRect(u,v,16,16);
    for(let row=0;row<2;row++){const yy=v+row*8;c.fillStyle=shade;c.fillRect(u,yy+7,16,1);const xx=u+((y*8+row*8)%16);if(!wooden||(x+y+row)%2===0)c.fillRect(xx,yy,1,8);c.fillStyle=high;c.fillRect(u+1,yy,14,1)}
    if(k==='r'&&n%3===0){c.fillStyle=p.stone;c.fillRect(u+7,v+4,1,5);c.fillRect(u+5,v+8,3,1)}
    if(k==='a'&&x%2===0&&y%2===0){c.fillStyle=p.paleLight;c.fillRect(u+7,v+3,2,10);c.fillRect(u+3,v+7,10,2);c.fillStyle=p.gold;c.fillRect(u+7,v+7,2,2)}
    for(let side=0;side<4;side++)if(adj[side]==='#')edge(c,u,v,side,2,p.ink);
   }else if(k==='#'){
    c.fillStyle=p.deep;c.fillRect(u,v,16,16);
    // Readable stone walls around room floors, on their authored blocking cells.
    if(adj.some(t=>'iprabd'.includes(t))){c.fillStyle=p.stone;c.fillRect(u,v+2,16,14);c.fillStyle=p.stoneLight;c.fillRect(u,v+2,16,2);c.fillStyle=p.ink;c.fillRect(u,v+9,16,1);c.fillRect(u+((x+y)%2?4:11),v+3,1,6);c.fillRect(u+((x+y)%2?11:4),v+10,1,6)}
   }else if(k==='^'){
    c.fillStyle=p.dark;c.fillRect(u,v,16,16);c.fillStyle=p.stone;c.fillRect(u+3,v+6,10,8);c.fillRect(u+5,v+3,6,3);c.fillStyle=p.stoneLight;c.fillRect(u+5,v+5,2,7);c.fillRect(u+7,v+3,2,4);c.fillStyle=p.ink;c.fillRect(u+2,v+14,12,2);c.fillRect(u+11,v+7,2,6);if(area.theme==='snow'){c.fillStyle=p.snow;c.fillRect(u+5,v+3,6,3);c.fillRect(u+3,v+6,10,2)}
   }else if(k==='%'){
    c.fillStyle=p.deep;c.fillRect(u,v,16,16);if(n%7===0){c.fillStyle=p.pale;c.fillRect(u+6,v+9,1,1)}
    for(let side=0;side<4;side++)if(!solid(adj[side])&&!water(adj[side])){edge(c,u,v,side,4,p.stone);edge(c,u,v,side,2,p.stoneLight);edge(c,u,v,side,1,p.stoneBright)}
   }else{c.fillStyle=p.ground;c.fillRect(u,v,16,16)}
  }
  details(c,area,p);
 }
 function details(c,area,p){
  const occupied=(x,y)=>area.objects.some(o=>Math.abs(o.x-x)<3&&Math.abs(o.y-y)<2)||[...area.stops,...area.events].some(o=>Math.abs(o.at[0]-x)<2&&Math.abs(o.at[1]-y)<2);
  for(const o of area.objects){
   if(o.width<64||AvelunePixelArt.category(o.asset)!=='building')continue;
   const x=(o.x+.5)*16,y=(o.y+.5)*16,w=AvelunePixelArt.bounds(o.asset,o.width,{region:area.region,theme:area.theme}).w;
   // Grounding every building in a small common foundation joins walls to the road.
   c.fillStyle=area.theme==='snow'?p.snowShade:p.pathDark;c.fillRect(x-w/2-3,y-4,w+6,8);c.fillStyle=p.path;c.fillRect(x-9,y+4,18,9);c.fillStyle=p.stone;c.fillRect(x-8,y+5,16,2);c.fillStyle=p.stoneLight;c.fillRect(x-8,y+4,16,1);
  }
  if(area.indoor){
   if(['home','inn','archive','cathedral'].includes(area.feature)){
    const ww=area.feature==='archive'?48:112,hh=area.feature==='cathedral'?144:64;
    const x=Math.floor((area.width*16-ww)/32)*16,y=Math.max(64,Math.floor((area.height*16-hh)/32)*16-16);
    const cloth=area.feature==='archive'?p.water:p.roofDark;
    c.fillStyle=p.ink;c.fillRect(x-1,y-1,ww+2,hh+2);c.fillStyle=p.gold;c.fillRect(x,y,ww,hh);c.fillStyle=cloth;c.fillRect(x+3,y+3,ww-6,hh-6);
    c.fillStyle=p.pathLight;for(let q=5;q<ww-4;q+=8){c.fillRect(x+q,y-2,2,2);c.fillRect(x+q,y+hh,2,2)}
    for(const [xx,yy]of [[x+7,y+7],[x+ww-11,y+7],[x+7,y+hh-11],[x+ww-11,y+hh-11]]){c.fillStyle=p.gold;c.fillRect(xx,yy,4,4);c.fillStyle=p.cream;c.fillRect(xx+1,yy+1,2,2)}
    const cx=x+ww/2,cy=y+hh/2;c.fillStyle=p.gold;c.fillRect(cx-1,cy-8,2,16);c.fillRect(cx-8,cy-1,16,2);c.fillStyle=p.cream;c.fillRect(cx-2,cy-2,4,4);
   }
   return;
  }
  for(let y=1;y<area.height-1;y++)for(let x=1;x<area.width-1;x++){
   if(area.terrain[y][x]!=='g'||area.collision[y][x]!=='.'||occupied(x,y))continue;
   const n=hash(x,y,area.id.length);if(n%37!==0)continue;
   const u=x*16,v=y*16;const edgeRoad=dirs.some(([dx,dy])=>'dp'.includes(area.terrain[y+dy]?.[x+dx]||''));
   if(edgeRoad&&['orchard','forest','island','marsh'].includes(area.theme)){
    // Low flowers and grassy verges add detail while remaining walkable.
    c.fillStyle=p.dark;c.fillRect(u+3,v+9,1,3);c.fillRect(u+10,v+7,1,3);c.fillStyle=n%2?p.cream:p.roofLight;c.fillRect(u+2,v+7,3,2);c.fillRect(u+9,v+5,3,2);c.fillStyle=p.gold;c.fillRect(u+3,v+7,1,1);
   }else if(['salt','basalt'].includes(area.theme)){c.fillStyle=p.dark;c.fillRect(u+6,v+9,4,2);c.fillStyle=p.light;c.fillRect(u+6,v+8,3,1)}
  }
 }
 function waterFrame(c,area,time,camera,w,h){
  const p=palette(area.theme),phase=Math.floor(time/650)%4;
  for(let y=Math.max(0,Math.floor(camera.y/16));y<Math.min(area.height,Math.ceil((camera.y+h)/16));y++)for(let x=Math.max(0,Math.floor(camera.x/16));x<Math.min(area.width,Math.ceil((camera.x+w)/16));x++)if(water(area.terrain[y][x])&&hash(x,y)%11===0){const u=x*16+3+phase,v=y*16+7;c.fillStyle=p.waterLight;c.fillRect(u,v,5,1);c.fillStyle=p.waterFoam;c.fillRect(u+1,v+2,2,1)}
 }
 return{palette,hash,bake,paint,waterFrame};
})();
