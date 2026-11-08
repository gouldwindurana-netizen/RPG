/* Original Avelune field art. Every shape is authored on the same logical pixel
 * grid. The source asset IDs stay stable; the paintings are never resampled into
 * the playfield. All public draw methods use a bottom-center foot anchor. */
const AVELUNE_PALETTE = Object.freeze({
  ink:'#172334',deep:'#0b1325',grass:'#547b48',grassLight:'#709254',grassBright:'#92ad62',grassDark:'#3c6044',
  path:'#c8ad72',pathDark:'#a98e5d',pathLight:'#e0c489',water:'#315f85',waterLight:'#487e9d',waterFoam:'#76a9ba',
  stone:'#687984',stoneLight:'#93a0a6',stoneBright:'#c4c4b6',wall:'#d8c895',wallShade:'#a89873',
  roof:'#a65946',roofLight:'#cf7755',roofDark:'#743c3d',tree:'#305b48',treeLight:'#4d7a50',treeBright:'#769758',
  wood:'#765543',woodLight:'#a17a54',woodBright:'#c49a64',snow:'#cadcda',snowShade:'#9ab5c6',
  pale:'#a597b9',paleLight:'#c5bed1',gold:'#e2bc69',cream:'#f1e6c6',skin:'#d8ad7c',skinShade:'#ad785a',
  blue:'#466c94',blueLight:'#7596b1',red:'#a65053',redLight:'#c97665',violet:'#72668e',violetLight:'#a392ba'
});
const AvelunePixelArt = (() => {
  'use strict';
  const P=AVELUNE_PALETTE, cache=new Map(), heroCache=new Map();
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), q=(n)=>Math.round(n/8)*8;
  const hash=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h;};
  const props={
    PROP001:'bed',PROP002:'oven',PROP003:'table',PROP005:'bookcase',PROP007:'kitchen',PROP009:'counter',
    PROP010:'stall',PROP011:'weapons',PROP012:'armor',PROP013:'anvil',PROP014:'forge',PROP015:'cart',
    PROP016:'workbench',PROP018:'planter',PROP019:'sacks',PROP020:'barrel',PROP022:'chest',PROP023:'crate',
    PROP026:'letters',PROP027:'mural',PROP028:'curtain',PROP029:'stairs',PROP031:'ladder',PROP032:'gate',
    PROP033:'valve',PROP034:'sluice',PROP035:'gears',PROP037:'bell',PROP038:'hanginglamp',PROP039:'streetlamp',
    PROP040:'candelabra',PROP045:'mirror',PROP046:'crystal',PROP048:'tent',PROP053:'desk',PROP054:'lectern',
    PROP055:'column',PROP056:'lamp',PROP057:'crystals',PROP058:'relay',PROP059:'brazier',PROP060:'bag',
    PROP061:'basin',PROP062:'post',PROP063:'rune',PROP064:'gangway'
  };
  const wr={
    WR111:'presshouse',WR112:'barn',WR114:'bakehouse',WR121:'cottage',WR122:'ferryoffice',WR123:'pavilion',WR124:'boathouse',
    WR131:'bathhouse',WR132:'forgehouse',WR133:'headframe',WR134:'guildhall',WR141:'tent',WR142:'market',WR143:'wellhouse',WR144:'clinic',
    WR151:'porthouse',WR152:'observatory',WR153:'gantry',WR154:'lighthouse',WR161:'snowhouse',WR162:'snowforge',WR163:'archive',WR164:'snowhouse',
    WR171:'clinic',WR172:'market',WR173:'lamphouse',WR174:'library',
    WR211:'produce',WR214:'breadrack',WR221:'skiffdock',WR222:'winch',WR223:'fishstall',WR224:'lumber',
    WR231:'forge',WR232:'minecart',WR233:'winch',WR234:'grindstone',WR241:'dyewell',WR242:'scales',WR243:'pottery',WR244:'carpet',
    WR251:'chart',WR252:'starchart',WR253:'ropes',WR254:'mirror',WR261:'spinningwheel',WR262:'bell',WR263:'bookrack',WR264:'snowshoes',
    WR271:'cabinet',WR272:'scales',WR273:'pottery',WR274:'mural',
    WR311:'bench',WR312:'bench',WR313:'wheel',WR314:'wheel',WR321:'dock',WR322:'dock',WR323:'reedgate',WR324:'reedgate',
    WR331:'mine',WR332:'mine',WR333:'winch',WR334:'winch',WR341:'channel',WR342:'channel',WR343:'ruin',WR344:'sluice',
    WR351:'staraltar',WR352:'staraltar',WR353:'telescope',WR354:'telescope',WR361:'fountain',WR362:'bell',WR363:'snowbank',WR364:'hatch',
    WR371:'planterlamp',WR372:'planterlamp',WR373:'fence',WR374:'fence'
  };
  const locations={
    alderreach_01:'cottage',alderreach_02:'roadarch',alderreach_03:'bridge',alderreach_04:'ruin',alderreach_05:'watermill',
    alderreach_06:'waystation',alderreach_07:'market',alderreach_08:'hearth',alderreach_09:'cottage',alderreach_10:'cache',
    veyra_01:'porthouse',veyra_02:'reedhouse',veyra_03:'ferry',veyra_04:'sluice',veyra_05:'palace',veyra_06:'shrine',
    veyra_07:'hearth',veyra_08:'guildhall',veyra_09:'reedhouse',veyra_10:'dock',
    kharad_01:'stonehouse',kharad_02:'furnace',kharad_03:'mine',kharad_04:'vault',kharad_05:'hearth',kharad_06:'stonearch',
    kharad_07:'peak',kharad_08:'forgehouse',kharad_09:'tent',sereva_01:'market',sereva_02:'dune',sereva_03:'wellhouse',
    sereva_04:'wellhouse',sereva_05:'gate',sereva_06:'forestgate',sereva_07:'hearth',sereva_08:'oasis',sereva_09:'burrow',sereva_10:'ruin',
    isles_01:'porthouse',isles_02:'observatory',isles_03:'vault',isles_04:'cave',isles_05:'lighthouse',isles_06:'hearth',
    isles_07:'skybridge',isles_08:'sanctuary',isles_09:'staraltar',isles_10:'reef',isles_11:'skiffdock',
    ordel_01:'snowhouse',ordel_02:'snowhouse',ordel_03:'cathedral',ordel_04:'archive',ordel_05:'hearth',ordel_06:'bell',
    ordel_07:'hatch',ordel_08:'snowpeak',ordel_09:'guildhall',edrin_01:'tent',edrin_02:'market',edrin_03:'roadarch',
    edrin_04:'gate',edrin_05:'palace',edrin_06:'library',edrin_07:'garden',edrin_08:'library',edrin_09:'hearth',edrin_10:'well',edrin_11:'vault'
  };
  const landmark={
    lantern_shrine:'shrine',lighthouse:'lighthouse',veyra_hearth:'hearth',seventh_hearth:'hearth',ivory_capital:'palace',
    stone_arch:'stonearch',alderreach_hearth:'hearth',bell_cathedral:'cathedral',kharad_hearth:'hearth',canal_lock:'sluice',
    drowned_palace:'palace',isles_hearth:'hearth',sereva_hearth:'hearth',furnace_city:'furnace',red_roof_village:'cottage',
    watermill:'watermill',market_town:'market',snowy_village:'snowhouse',courier_gate:'gate',garden_tallowback:'tallowback',
    mineral_mine:'mine',winter_archive:'archive',forest_gate:'forestgate',deep_vault:'vault',stoneborn_village:'stonehouse',
    brass_observatory:'observatory',sky_sanctuary:'sanctuary',mirror_ruins:'ruin',pirate_cave:'cave',covered_well:'wellhouse',
    orchard_cottage:'cottage',tent_market:'market',reed_hamlet:'reedhouse'
  };
  const small=new Set(['bed','oven','table','bookcase','kitchen','counter','stall','weapons','armor','anvil','forge','cart','workbench','planter','sacks','barrel','chest','crate','letters','mural','curtain','stairs','ladder','valve','gears','bell','hanginglamp','streetlamp','candelabra','mirror','crystal','desk','lectern','column','lamp','crystals','relay','brazier','bag','basin','post','rune','produce','breadrack','winch','fishstall','lumber','minecart','grindstone','dyewell','scales','pottery','carpet','chart','starchart','ropes','spinningwheel','bookrack','snowshoes','cabinet','bench','reedgate','channel','staraltar','telescope','fountain','hatch','planterlamp','fence','gangway']);
  const buildings=new Set(['cottage','presshouse','barn','bakehouse','ferryoffice','pavilion','boathouse','bathhouse','forgehouse','guildhall','market','wellhouse','clinic','porthouse','observatory','lighthouse','snowhouse','snowforge','archive','lamphouse','library','stonehouse','reedhouse','watermill','cathedral','palace','furnace','waystation','sanctuary','tent','vault','headframe','gantry']);
  function identify(key){
    key=String(key||'terrain_mossy_boulder');
    if(props[key])return props[key];if(wr[key])return wr[key];
    if(key.startsWith('LOC_'))return locations[key.slice(4)]||'ruin';
    if(key.startsWith('landmarks_'))return landmark[key.slice(10)]||'shrine';
    if(key.startsWith('party_travel_')){
      const who=key.slice(13);if(who==='inn')return'inn';
      if(who.includes('skiff'))return'airship';if(who.includes('ferry'))return'ferry';if(who.includes('tallowback'))return'tallowback';
      return'npc';
    }
    if(key==='ocean_packet')return'ship';
    if(key==='terrain_desert_arch')return'stonearch';
    if(key==='terrain_broken_arch')return'ruin';
    return key.replace(/^terrain_/,'');
  }
  function bounds(key,width=24,meta={}){
    const kind=identify(key), n=Number.isFinite(+width)?+width:24;
    let w=q(n),h;
    if(kind==='npc')return{w:16,h:24};
    if(buildings.has(kind)||kind==='inn'){
      w=clamp(w,32,key.startsWith('landmarks_')?96:80);h=q(w*.65)+16;
      if(['lighthouse','cathedral','observatory'].includes(kind))h+=16;
      if(kind==='tent')h=q(w*.65);if(kind==='watermill')h=q(w*.65)+8;
    }else if(['hearth','shrine','gate','forestgate','stonearch','roadarch','ruin','mine','cave','garden'].includes(kind)){
      w=clamp(w,32,80);h=q(w*.65)+8;
    }else if(['ship','ferry','airship','tallowback'].includes(kind)){
      w=clamp(w,32,80);h=q(w*(kind==='airship'?.7:kind==='ship'?.8:.45));
    }else if(kind==='sluice'||kind==='bridge'||kind==='skybridge'||kind==='dock'||kind==='skiffdock'){
      w=clamp(w,24,80);h=kind==='sluice'?32:24;
    }else if(kind==='forest_cluster'){w=40;h=40;
    }else if(['oak','orchard_tree','pine','snow_pine','bare_tree','mangrove','palm'].includes(kind)){
      w=kind==='pine'||kind==='snow_pine'?24:32;h=40;
    }else if(['peak','mineral_peak','snow_peak','snowpeak','basalt_ridge','cliff_ledge','waterfall'].includes(kind)){
      w=clamp(w,24,64);h=q(w*.65)+8;
    }else if(small.has(kind)){
      const tall=['bookcase','cabinet','ladder','column','curtain','streetlamp','hanginglamp','planterlamp','post','mirror','candelabra','bell','mural','weapons','armor','lectern','telescope','crystal','brazier'];
      w=clamp(w,16,['counter','stall','bed','table','workbench','bookcase','kitchen','desk','mural','fence','reedgate','lumber','channel','gangway'].includes(kind)?32:24);
      if(['lamp','barrel','chest','crate','bag','letters','rune','pottery'].includes(kind))w=16;
      h=tall.includes(kind)?32:kind==='fence'||kind==='channel'||kind==='gangway'?16:24;
      if(kind==='letters'||kind==='rune'||kind==='bag')h=16;
      if(kind==='staraltar')h=40;if(kind==='stall')h=32;
    }else{w=clamp(w,16,48);h=q(w*.65)+8;}
    return{w,h};
  }
  function box(key,x,y,width,meta){const {w,h}=bounds(key,width,meta);return{left:Math.round(x-w/2),top:Math.round(y-h),w,h};}
  function painter(ctx){
    const rect=(x,y,w,h,c)=>{if(w<=0||h<=0)return;ctx.fillStyle=P[c]||c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
    const pixel=(x,y,c)=>rect(x,y,1,1,c);
    const line=(x0,y0,x1,y1,c,t=1)=>{x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;let e=dx+dy;for(;;){rect(x0,y0,t,t,c);if(x0===x1&&y0===y1)break;let e2=2*e;if(e2>=dy){e+=dy;x0+=sx}if(e2<=dx){e+=dx;y0+=sy}}};
    const oval=(cx,cy,rx,ry,c)=>{for(let yy=-Math.ceil(ry);yy<=ry;yy++){const a=Math.floor(rx*Math.sqrt(Math.max(0,1-(yy/ry)**2)));rect(cx-a,cy+yy,a*2+1,1,c);}};
    const panel=(x,y,w,h,c='wood',hl='woodLight')=>{rect(x,y,w,h,'ink');rect(x+1,y+1,w-2,h-2,c);rect(x+1,y+1,w-2,1,hl);};
    return{r:rect,p:pixel,l:line,o:oval,box:panel};
  }
  function render(ctx,key,w,h,meta={}){
    const {r,p,l,o,box:B}=painter(ctx), kind=identify(key), seed=hash(key), region=meta.region||key.split('_')[1]||'alderreach';
    const snow=region==='ordel'||kind.startsWith('snow'), pale=region==='edrin', desert=region==='sereva', stone=region==='kharad';
    const roof=snow?'snow':pale?'pale':desert?'blue':stone?'stone':'roof';
    const roofLight=snow?'cream':pale?'paleLight':desert?'blueLight':stone?'stoneLight':'roofLight';
    const roofDark=snow?'snowShade':pale?'violet':desert?'water':stone?'ink':'roofDark';
    const wall=pale?'stoneBright':stone?'stoneLight':'wall',wallShade=stone?'stone':'wallShade';
    const cx=w>>1,base=h-1;
    const shadow=(x=3,y=h-3,ww=w-6)=>{r(x,y,ww,2,'ink');r(x+2,y+2,ww-4,1,'grassDark');};
    const window=(x,y,ww=6,hh=7)=>{B(x,y,ww,hh,'deep','woodBright');r(x+1,y+1,ww-2,hh-2,'water');r(x+1,y+1,ww-2,2,'waterFoam');r(x+Math.floor(ww/2),y+1,1,hh-2,'wood');r(x+1,y+Math.floor(hh/2),ww-2,1,'wood');r(x-1,y+hh,ww+2,1,'woodBright');};
    const door=(x,y,ww=8,hh=12)=>{B(x,y,ww,hh,'wood','woodBright');r(x+2,y+2,ww-4,hh-3,'woodLight');r(x+Math.floor(ww/2),y+2,1,hh-3,'wood');p(x+ww-3,y+Math.floor(hh*.6),'gold');r(x-2,y+hh,ww+4,2,'stoneLight');};
    const flame=(x,y)=>{r(x-3,y-4,7,5,'roofDark');r(x-2,y-7,3,7,'roofLight');r(x+1,y-10,2,8,'roofLight');r(x-1,y-5,4,6,'gold');r(x,y-3,2,4,'cream');p(x+3,y-6,'gold');};
    const star=(x,y,c='gold')=>{r(x,y-3,1,7,c);r(x-3,y,7,1,c);p(x-1,y-1,'cream');p(x+1,y+1,'cream');};
    const barrel=(x,y)=>{B(x,y,12,14,'wood','woodBright');r(x+2,y+2,8,1,'woodLight');r(x+2,y+5,8,1,'woodBright');r(x+1,y+4,10,2,'stone');r(x+1,y+10,10,2,'stone');r(x+4,y+2,1,11,'woodLight');r(x+8,y+2,1,11,'woodLight');};
    const chest=(x,y)=>{B(x,y+4,16,10,'wood','woodBright');B(x,y,16,7,'roofDark','woodBright');r(x+2,y+1,12,3,'woodLight');r(x+2,y+7,12,1,'gold');r(x+2,y+1,2,12,'gold');r(x+12,y+1,2,12,'gold');B(x+6,y+6,4,5,'gold','cream');p(x+7,y+8,'ink');};
    const wheel=(x,y,rr=10)=>{o(x,y,rr,rr,'ink');o(x,y,rr-1,rr-1,'wood');o(x,y,rr-3,rr-3,'deep');for(let i=0;i<8;i++){let a=i*Math.PI/4;l(x,y,x+Math.round(Math.cos(a)*(rr-2)),y+Math.round(Math.sin(a)*(rr-2)),'woodLight');}o(x,y,2,2,'woodBright');p(x,y,'gold');for(let i=0;i<8;i++){let a=i*Math.PI/4;p(x+Math.round(Math.cos(a)*(rr-1)),y+Math.round(Math.sin(a)*(rr-1)),'woodBright');}};
    const tree=(x,y,size=1,type='oak')=>{
      // Leaf clusters and trunk share one-pixel outlines, never blurred edges.
      const tx=(a,b,ww,hh,c)=>r(x+Math.round(a*size),y+Math.round(b*size),Math.max(1,Math.round(ww*size)),Math.max(1,Math.round(hh*size)),c);
      if(type==='pine'||type==='snow_pine'){
        tx(-2,-10,4,10,'ink');tx(-1,-9,2,8,'woodLight');
        for(const [yy,span] of [[-35,4],[-30,7],[-25,10],[-19,11]]){
          for(let j=0;j<8;j++){const half=Math.min(span,Math.floor(j*1.55)+1);tx(-half,yy+j,half*2+1,1,'ink');if(half>1)tx(-half+1,yy+j,half*2-1,1,snow||type==='snow_pine'?'snowShade':'tree');if(half>2)tx(-half+1,yy+j,half-1,1,snow||type==='snow_pine'?'snow':'treeLight');}
          tx(-span+2,yy+6,Math.max(2,span-2),1,snow||type==='snow_pine'?'cream':'treeBright');
        }
        tx(0,-36,1,5,'ink');tx(0,-34,1,3,snow?'snow':'treeLight');return;
      }
      tx(-3,-18,6,18,'ink');tx(-2,-16,4,15,'wood');tx(-2,-15,1,13,'woodLight');tx(-5,-2,10,2,'wood');
      if(type==='bare_tree'){
        for(const [a,b,c,d] of [[-1,-18,-8,-25],[-7,-24,-8,-31],[1,-16,9,-24],[7,-22,9,-30],[-1,-18,1,-33],[-2,-24,-5,-30]]){l(x+a,y+b,x+c,y+d,'ink',2);l(x+a,y+b,x+c,y+d,'woodLight');}return;
      }
      if(type==='palm'){
        for(const side of [-1,1]){for(let i=0;i<10;i++){tx(side*i-1,-30+Math.floor(i*i/16),4,3,'ink');tx(side*i,-30+Math.floor(i*i/16),3,1,'treeLight');}tx(side*4,-33,8,2,'ink');tx(side*5,-32,6,1,'treeBright');}tx(-2,-30,4,5,'woodBright');return;
      }
      const leaf=(xx,yy,rrx,rry)=>{o(x+xx*size,y+yy*size,rrx*size,rry*size,'ink');o(x+(xx-1)*size,y+(yy-1)*size,(rrx-1)*size,(rry-1)*size,'tree');o(x+(xx-2)*size,y+(yy-3)*size,(rrx-3)*size,(rry-3)*size,'treeLight');};
      leaf(-6,-23,8,8);leaf(7,-24,8,8);leaf(0,-30,9,8);leaf(0,-20,10,7);
      tx(-7,-30,5,2,'treeBright');tx(-3,-34,6,2,'treeBright');tx(6,-27,4,2,'treeLight');tx(-10,-23,3,1,'treeBright');tx(-2,-21,4,1,'treeBright');
      if(type==='orchard_tree'){for(const[a,b]of[[-7,-25],[5,-30],[1,-20],[9,-23]]){tx(a,b,2,2,'roofDark');tx(a,b,1,1,'roofLight');}}
      if(type==='mangrove'){for(const s of[-1,1]){l(x,y-9,x+s*9,y-1,'wood',2);p(x+s*8,y-1,'woodBright');}}
    };
    const roofedHouse=(variant=kind)=>{
      const x=variant==='watermill'?2:2,ww=variant==='watermill'?w-20:w-4;
      const y=variant==='lighthouse'?h-48:variant==='cathedral'?h-52:variant==='observatory'?h-40:Math.max(4,Math.floor(h*.23));
      const roofH=clamp(q(ww*.3),12,24),wallY=y+roofH,wallH=h-wallY-3;
      shadow();B(x+3,wallY,ww-6,wallH,wall,wallShade);r(x+4,wallY+1,ww-8,3,wallShade);
      r(x+3,h-5,ww-6,3,'stone');r(x+4,h-5,ww-8,1,'stoneLight');
      for(let yy=wallY+5;yy<h-6;yy+=6)for(let xx=x+5+(yy%12?0:5);xx<x+ww-5;xx+=12){r(xx,yy,5,1,wallShade);p(xx+5,yy-1,wallShade);}
      // The ridge, courses and eave are horizontal, with equal left/right walls.
      B(x,y,ww,roofH+2,roofDark,roofLight);r(x+2,y+2,ww-4,roofH-2,roof);r(x+3,y+1,ww-6,2,roofLight);
      for(let yy=y+5;yy<wallY;yy+=4){r(x+1,yy,ww-2,1,roofDark);for(let xx=x+3+((yy-y)%8?0:4);xx<x+ww-2;xx+=8)r(xx,yy-3,1,3,roofDark);}
      r(x,wallY,ww,2,'ink');r(x+1,wallY,ww-2,1,roofLight);
      const dx=x+Math.floor(ww/2)-4;door(dx,h-16,8,12);
      if(ww>=40){window(x+7,wallY+7,6,7);window(x+ww-13,wallY+7,6,7);}
      if(['cottage','bakehouse','inn','presshouse','snowhouse','snowforge','forgehouse','bathhouse','lamphouse'].includes(variant)){
        B(x+ww-13,y-7,7,12,'stone','stoneLight');r(x+ww-14,y-8,9,3,'ink');r(x+ww-13,y-8,7,1,'stoneBright');
      }
      if(['barn','boathouse','guildhall','stonehouse'].includes(variant)){r(dx-3,h-21,14,19,'ink');r(dx-2,h-20,12,17,'wood');r(dx+4,h-20,1,17,'woodBright');l(dx-1,h-19,dx+9,h-5,'woodLight');l(dx+9,h-19,dx-1,h-5,'woodLight');}
      if(['clinic','inn','lamphouse','ferryoffice','porthouse'].includes(variant)){
        const sx=x+ww-14;B(sx,wallY+1,12,9,'blue','gold');r(sx+3,wallY+3,6,1,'cream');r(sx+5,wallY+2,2,5,'cream');
        if(variant==='inn'){r(sx+2,wallY+4,8,2,'cream');r(sx+2,wallY+3,1,4,'cream');}
      }
      if(variant==='watermill'){wheel(w-12,h-13,11);B(w-24,h-28,7,14,'stone','stoneLight');r(w-25,h-29,9,2,'stoneBright');r(w-22,h-24,4,2,'waterFoam');}
      if(variant==='presshouse'){barrel(x+2,h-18);}
      if(variant==='snowhouse'||variant==='snowforge'){r(x+1,y+1,ww-2,3,'snow');r(x+3,y+4,5,2,'snow');r(x+ww-9,y+4,6,3,'snow');r(x+1,h-3,ww-2,2,'snowShade');}
      if(variant==='forgehouse'||variant==='snowforge'||variant==='furnace'){flame(dx+4,h-6);}
      if(variant==='library'||variant==='archive'){
        B(cx-8,wallY-7,16,9,'wood','gold');r(cx-6,wallY-5,5,5,'cream');r(cx+1,wallY-5,5,5,'wall');r(cx,wallY-5,1,6,'wood');
      }
      if(variant==='lighthouse'){
        const tw=20,tx=cx-10,ty=3;B(tx,ty+12,tw,h-15,'stoneBright','cream');r(tx+tw-6,ty+13,5,h-17,'stoneLight');
        for(let yy=ty+18;yy<h-14;yy+=8)r(tx+1,yy,tw-2,1,'stone');
        B(tx-3,ty+3,tw+6,13,'gold','cream');r(tx-1,ty+5,tw+2,8,'water');r(cx-2,ty+5,4,8,'cream');r(tx-4,ty+2,tw+8,2,'ink');r(tx-2,ty,tw+4,2,'roofDark');r(cx-4,0,8,1,'gold');door(cx-4,h-15,8,11);
      }
      if(variant==='observatory'){
        const rr=Math.min(16,Math.floor(ww*.28));o(cx,y+4,rr,rr,'ink');o(cx,y+3,rr-1,rr-1,'gold');o(cx-1,y+2,rr-3,rr-3,'blue');r(cx-1,y-rr+3,2,rr*2-4,'gold');r(cx-rr+3,y+3,rr*2-6,2,'gold');r(cx-rr,y+rr,rr*2+1,3,'ink');r(cx-rr+1,y+rr,rr*2-1,1,'gold');star(cx+6,y-4,'cream');
      }
      if(variant==='cathedral'){
        for(const tx of[2,w-18]){B(tx,9,16,h-12,'stoneLight','stoneBright');r(tx+10,10,5,h-14,'stone');B(tx-1,6,18,5,roof,roofLight);r(tx+3,2,10,5,roof);r(tx+6,0,4,3,'gold');window(tx+5,14,6,12);r(tx+3,h-5,10,3,'stoneBright');}
        B(cx-9,h-30,18,27,'stoneLight','stoneBright');B(cx-6,h-25,12,21,'deep','gold');r(cx-4,h-23,8,18,'wood');r(cx,h-23,1,18,'gold');B(cx-5,16,10,11,'blue','gold');r(cx-1,17,2,9,'gold');r(cx-4,21,8,1,'gold');
      }
      if(variant==='palace'||variant==='sanctuary'){
        for(const tx of[1,w-11]){B(tx,Math.max(1,y-8),10,h-y+6,'stoneLight','stoneBright');r(tx+6,Math.max(2,y-7),3,h-y+4,'stone');r(tx-1,Math.max(0,y-9),12,3,'gold');window(tx+3,y,4,8);}
        B(cx-7,y-9,14,10,'pale','gold');star(cx,y-4,'cream');
      }
      if(variant==='reedhouse'){r(x+1,y+1,ww-2,roofH-1,'path');for(let xx=x+3;xx<x+ww-2;xx+=3)l(xx,y+2,xx-2,wallY-1,'pathDark');r(x,wallY-1,ww,2,'wood');}
    };
    if(kind==='npc'){
      let id=key.replace('party_travel_','').replace(/_(south|north|east|west)$/,'');drawHero(ctx,id,'down',0,cx,h);return;
    }
    if(buildings.has(kind)||kind==='inn'){
      if(kind==='headframe'||kind==='gantry'){
        shadow();for(const xx of[6,w-11]){B(xx,5,5,h-6,'wood','woodBright');r(xx+1,6,1,h-8,'woodLight');}B(3,3,w-6,7,'wood','woodBright');l(11,h-6,w-12,12,'wood',3);l(w-12,h-6,11,12,'woodLight',2);wheel(cx,12,9);r(cx-1,14,1,h-30,'woodBright');B(cx-9,h-23,18,19,'ink','stoneBright');r(cx-6,h-20,12,12,'wood');r(cx-5,h-19,10,1,'woodBright');r(cx-6,h-8,12,2,'woodLight');return;
      }
      if(kind==='tent'){
        shadow();for(let yy=2;yy<h-3;yy++){const span=Math.min(cx-1,Math.floor((yy-1)/(h-5)*(w*.49)));r(cx-span,yy,span*2+1,1,'ink');if(span>1)r(cx-span+1,yy,span*2-1,1,yy%5===0?'water':desert?'blue':'roof');}
        r(cx-1,4,2,h-8,'gold');r(3,h-5,w-6,3,'gold');r(cx-5,h-17,10,14,'ink');l(cx-1,h-17,cx-7,h-4,'cream');l(cx+1,h-17,cx+7,h-4,'wallShade');p(cx,1,'gold');return;
      }
      if(kind==='market'){
        roofedHouse('market');const awY=h-24;B(0,awY,w,9,'wood','gold');for(let xx=1;xx<w-1;xx+=6)r(xx,awY+1,5,7,((xx/6)|0)%2?'cream':'blue');r(0,awY+8,w,2,'ink');r(2,awY+9,2,14,'wood');r(w-4,awY+9,2,14,'wood');B(5,h-11,w-10,8,'wood','woodBright');for(let xx=8;xx<w-7;xx+=6){r(xx,h-15,4,4,xx%12?'gold':'roofLight');p(xx+1,h-16,'tree');}return;
      }
      if(kind==='wellhouse'){
        const yy=h-15;o(cx,h-6,w*.38,6,'ink');o(cx,h-7,w*.34,5,'stoneLight');o(cx,h-9,w*.25,3,'water');r(cx-w*.3,yy,2,14,'wood');r(cx+w*.3-2,yy,2,14,'wood');r(cx-w*.3,8,2,yy-8,'woodLight');r(cx+w*.3-2,8,2,yy-8,'wood');B(2,3,w-4,10,roof,roofLight);r(4,2,w-8,2,roofLight);r(cx,11,1,h-20,'woodBright');B(cx-3,h-14,6,5,'wood','gold');return;
      }
      if(kind==='furnace'){roofedHouse('furnace');for(const xx of[5,w-13]){B(xx,1,8,h-10,'stone','stoneLight');r(xx-1,0,10,3,'ink');r(xx,0,8,1,'stoneBright');}flame(cx,h-7);return;}
      if(kind==='vault'){roofedHouse('stonehouse');B(cx-10,h-27,20,24,'ink','stoneBright');B(cx-8,h-25,16,21,'stone','gold');for(let yy=h-23;yy<h-5;yy+=4)r(cx-6,yy,12,1,'stoneLight');B(cx-4,h-18,8,8,'blue','gold');star(cx,h-14,'cream');return;}
      roofedHouse();return;
    }
    if(['oak','orchard_tree','pine','snow_pine','bare_tree','mangrove','palm','forest_cluster'].includes(kind)){
      if(kind==='forest_cluster'){tree(11,h,0.8,'pine');tree(29,h,0.8,'pine');tree(21,h,1,'oak');}else tree(cx,h,1,kind);return;
    }
    if(kind==='hearth'||kind==='shrine'||kind==='staraltar'){
      shadow();const bw=Math.min(w-6,40);B(cx-bw/2,h-8,bw,7,'stone','stoneLight');r(cx-bw/2+2,h-9,bw-4,1,'stoneBright');
      if(kind==='hearth'){
        B(cx-11,h-29,22,22,'stone','stoneLight');r(cx-8,h-25,16,17,'ink');r(cx-7,h-25,14,2,'roofDark');r(cx-12,h-31,24,4,'stoneBright');
        for(const s of[-1,1]){B(cx+s*14-2,h-24,4,18,'wood','gold');r(cx+s*14-3,h-25,6,2,'gold');}flame(cx,h-10);star(cx,h-38,'gold');
      }else{B(cx-7,h-22,14,14,'stone','gold');B(cx-5,h-20,10,10,'blue','gold');r(cx-2,h-32,5,12,'gold');r(cx-4,h-31,9,2,'gold');star(cx,h-28,'cream');if(kind==='shrine'){for(const s of[-1,1]){r(cx+s*16-2,h-23,4,15,'ink');r(cx+s*16-1,h-23,2,14,'stoneLight');r(cx+s*16-4,h-25,8,3,'gold');r(cx+s*16-3,h-29,6,4,'blue');}}}return;
    }
    if(['gate','forestgate','stonearch','roadarch','ruin'].includes(kind)){
      const ww=Math.min(w-4,64),left=cx-ww/2;shadow();
      const archStone=desert?'pathDark':'stone',archLight=desert?'path':'stoneLight',archBright=desert?'pathLight':'stoneBright';
      for(const xx of[left,left+ww-10]){B(xx,kind==='ruin'?h-25:8,10,kind==='ruin'?23:h-10,archStone,archLight);r(xx+2,kind==='ruin'?h-24:9,3,kind==='ruin'?20:h-13,archBright);for(let yy=14;yy<h-4;yy+=7)r(xx+1,yy,8,1,'ink');r(xx-2,h-4,14,3,archLight);}
      if(kind!=='ruin'){B(left-2,5,ww+4,9,archStone,archBright);r(left+2,3,ww-4,3,archLight);r(cx-6,1,12,4,archBright);B(cx-5,6,10,7,'blue','gold');star(cx,9,'gold');}
      else{B(left,h-29,ww*.43,6,'stone','stoneBright');r(cx-2,h-9,12,6,'stone');r(cx+2,h-10,6,1,'stoneBright');}
      if(kind==='forestgate'){for(let i=0;i<5;i++){r(left+i*5,12+i*4,3,4,'treeLight');r(left+ww-3-i*5,13+i*3,3,4,'tree');}}
      return;
    }
    if(['mine','cave','burrow'].includes(kind)){
      for(let yy=3;yy<h;yy++){const span=Math.min(cx-1,Math.floor(yy*.9)+4);r(cx-span,yy,span*2,1,'ink');r(cx-span+1,yy,span*2-2,1,'stone');}
      for(const [xx,yy]of[[cx-14,h-18],[cx+8,h-22],[cx-6,6],[cx+2,h-9]])r(clamp(xx,2,w-8),yy,6,2,'stoneLight');
      const dw=kind==='burrow'?12:Math.min(24,w-14),dh=kind==='burrow'?10:24;B(cx-dw/2,h-dh,dw,dh,'deep','woodBright');r(cx-dw/2+2,h-dh+3,2,dh-3,'wood');r(cx+dw/2-4,h-dh+3,2,dh-3,'wood');r(cx-dw/2+1,h-dh+1,dw-2,3,'woodLight');r(cx-dw/2,h-3,dw,2,'pathDark');if(kind==='mine'){l(cx-7,h-1,cx-5,h-17,'stoneLight');l(cx+7,h-1,cx+5,h-17,'stoneLight');}return;
    }
    if(['ship','ferry','airship','tallowback'].includes(kind)){
      if(kind==='tallowback'){
        o(cx,h-15,w*.43,11,'ink');o(cx,h-16,w*.41,9,'path');r(6,h-10,5,10,'ink');r(w-15,h-10,5,10,'ink');r(7,h-9,3,7,'wood');r(w-14,h-9,3,7,'wood');o(w-9,h-22,7,7,'ink');o(w-8,h-23,5,5,'pathLight');p(w-6,h-24,'ink');for(let i=0;i<5;i++){r(10+i*6,h-28,4,11,'tree');r(9+i*6,h-28,7,3,'treeLight');}return;
      }
      const hullY=h-12;r(3,hullY,w-6,5,'ink');r(5,hullY+5,w-10,5,'ink');r(9,h-3,w-18,3,'ink');r(4,hullY+1,w-8,3,'woodBright');r(6,hullY+5,w-12,3,'wood');r(10,h-3,w-20,2,'woodLight');r(w-10,hullY-5,7,7,'wood');r(8,hullY+5,w-16,1,'gold');
      if(kind==='airship'){
        o(cx,Math.floor(h*.27),w*.42,h*.23,'ink');o(cx-1,Math.floor(h*.27)-1,w*.4,h*.21,'path');o(cx-4,Math.floor(h*.23),w*.31,h*.12,'pathLight');r(cx-2,3,4,Math.floor(h*.45),'gold');r(5,Math.floor(h*.3),w-10,2,'woodLight');l(10,Math.floor(h*.35),17,hullY,'woodLight');l(w-10,Math.floor(h*.35),w-17,hullY,'woodLight');r(2,hullY-2,8,2,'gold');r(w-10,hullY-2,8,2,'gold');
      }else if(kind==='ship'){
        for(const [mx,my,mw,mh]of[[Math.floor(w*.35),3,Math.floor(w*.27),h-19],[Math.floor(w*.69),11,Math.floor(w*.23),h-25]]){
          r(mx,my-2,2,hullY-my+3,'ink');r(mx,my-2,1,hullY-my+3,'woodBright');r(mx+2,my,mw,mh,'ink');r(mx+3,my+1,mw-2,mh-2,'cream');r(mx+mw-3,my+2,2,mh-4,'wall');r(mx+3,my+mh-3,mw-3,2,'wallShade');r(mx-3,my-1,mw+7,1,'wood');r(mx+2,my-6,8,3,'blue');}
      }else{r(10,hullY-5,w-20,5,'woodLight');r(12,hullY-8,2,10,'wood');r(w-14,hullY-8,2,10,'wood');r(10,hullY-8,w-20,2,'woodBright');B(cx-8,hullY-12,16,10,'blue','gold');r(cx-6,hullY-10,12,6,'cream');}
      return;
    }
    if(['bridge','skybridge','dock','skiffdock','gangway'].includes(kind)){
      r(1,h-17,w-2,15,'ink');r(2,h-16,w-4,13,'wood');for(let xx=3;xx<w-2;xx+=5){r(xx,h-15,4,11,'woodLight');r(xx,h-15,4,1,'woodBright');}for(const yy of[h-18,h-5]){r(0,yy,w,2,'woodBright');r(1,yy+2,w-2,1,'wood');}for(const xx of[1,w-4]){B(xx,h-24,3,24,'wood','woodBright');}return;
    }
    if(kind==='sluice'){
      r(1,h-13,w-2,12,'water');for(let xx=4;xx<w-2;xx+=8){r(xx,h-8,5,1,'waterFoam');r(xx-2,h-3,3,1,'waterLight');}
      for(const xx of[1,w-9]){B(xx,2,8,h-3,'stone','stoneLight');r(xx+1,4,3,h-7,'stoneBright');}
      B(7,4,w-14,17,'wood','woodBright');for(let xx=10;xx<w-8;xx+=4)r(xx,5,1,15,'ink');r(7,18,w-14,2,'stone');wheel(cx,10,6);return;
    }
    if(['peak','mineral_peak','snow_peak','snowpeak','basalt_ridge','cliff_ledge','cave_rock','mossy_boulder','snow_boulder','hovering_rock','reef','ivory_rubble','broken_arch'].includes(kind)){
      const light=kind.includes('snow')?'snow':kind==='ivory_rubble'?'stoneBright':'stoneLight',body=kind.includes('snow')?'snowShade':'stone';
      const peak=['peak','mineral_peak','snow_peak','snowpeak','basalt_ridge','cliff_ledge'].includes(kind);
      for(let yy=Math.floor(peak?2:h*.4);yy<h;yy++){const half=peak?Math.min(cx-1,Math.floor(yy*.7)+1):Math.min(cx-1,Math.floor((yy-h*.35)*1.9)+4);r(cx-half,yy,half*2+1,1,'ink');if(half>1)r(cx-half+1,yy,half*2-1,1,body);}
      if(peak){
        // Broad left planes follow the silhouette; short dark ledges describe
        // the right plane without a high-contrast slash across the whole rock.
        for(let yy=5;yy<h-4;yy++){const span=Math.min(cx-2,Math.floor(yy*.7));r(cx-span+1,yy,Math.max(1,Math.floor(span*.55)),1,light);}
        r(cx+2,Math.floor(h*.54),Math.max(3,cx-8),2,body==='stone'?'ink':'snowShade');
        r(cx+5,h-9,Math.max(3,cx-10),2,body==='stone'?'ink':'snowShade');
      }else{
        r(cx-6,Math.floor(h*.43)+2,9,2,light);r(cx-10,Math.floor(h*.43)+4,9,3,light);
        r(cx-12,h-10,7,4,light);r(cx+3,h-10,Math.max(3,cx-7),2,body==='stone'?'ink':'snowShade');
        r(cx-8,h-4,7,1,light);r(cx+3,h-5,4,1,light);
      }
      if(kind==='mossy_boulder'){r(5,h*.5,w*.4,3,'treeLight');r(3,h*.5+3,w*.25,2,'tree');}if(kind==='hovering_rock'){r(cx-5,h-1,10,1,'pale');star(cx,4,'paleLight');}return;
    }
    if(['waterfall','luminous_pool','oasis','well'].includes(kind)){
      if(kind==='waterfall'){r(3,1,w-6,h-2,'ink');r(4,2,w-8,h-4,'water');for(let xx=5;xx<w-5;xx+=4){r(xx,2,2,h-6,'waterLight');r(xx+1,6,1,h-14,'waterFoam');}r(1,h-5,w-2,4,'waterFoam');r(3,h-7,w-6,2,'snow');}
      else{o(cx,h-9,w*.46,8,'ink');o(cx,h-10,w*.43,7,'stoneLight');o(cx,h-10,w*.36,5,'water');r(cx-8,h-11,13,1,'waterFoam');r(cx+2,h-8,8,1,'waterLight');if(kind==='oasis'){tree(w-9,h-13,.65,'palm');}if(kind==='well'){B(cx-4,h-28,8,12,'stone','stoneBright');star(cx,h-30,'paleLight');}}return;
    }
    if(['snowbank','snow_drift','sand_dune','dune','dry_shrub','silver_grass','wildflowers','wheat','reeds','cactus','ice_spikes','crystals','pale_crystal','salt_crystals','landing_rune','milestone','signpost','campfire','garden','cache'].includes(kind)){
      if(kind==='signpost'||kind==='milestone'){B(cx-2,h-17,4,17,kind==='milestone'?'stone':'wood','woodBright');B(cx-8,h-24,16,9,kind==='milestone'?'stoneLight':'wood','woodBright');r(cx-5,h-21,9,1,'cream');r(cx-5,h-19,5,1,'cream');}
      else if(kind==='campfire'){l(cx-6,h-2,cx+5,h-6,'ink',3);l(cx-5,h-2,cx+6,h-6,'woodLight');flame(cx,h-5);}
      else if(kind==='cache'){chest(cx-8,h-14);}
      else if(kind==='cactus'){B(cx-3,h-28,6,28,'tree','treeLight');r(cx-2,h-26,1,21,'treeBright');r(cx-10,h-20,5,11,'ink');r(cx-9,h-19,3,8,'treeLight');r(cx-7,h-13,5,3,'tree');r(cx+4,h-24,5,13,'ink');r(cx+5,h-23,3,10,'tree');r(cx+2,h-15,6,3,'treeLight');}
      else if(['crystals','pale_crystal','salt_crystals','ice_spikes'].includes(kind)){for(const [xx,hh]of[[cx-6,10],[cx+5,15],[cx,23]]){r(xx-3,h-hh,6,hh,'ink');r(xx-2,h-hh+2,4,hh-3,kind==='pale_crystal'?'pale':'waterLight');r(xx-1,h-hh+1,2,hh-4,kind==='pale_crystal'?'paleLight':'snow');p(xx,h-hh,'cream');}}
      else if(kind==='landing_rune'){o(cx,h-7,w*.42,5,'pale');o(cx,h-7,w*.34,3,'grassDark');r(cx-6,h-7,13,1,'gold');r(cx,h-11,1,9,'gold');}
      else if(['snowbank','snow_drift','sand_dune','dune'].includes(kind)){o(cx,h-5,w*.45,5,kind.includes('snow')?'snowShade':'pathDark');o(cx-2,h-7,w*.4,4,kind.includes('snow')?'snow':'path');r(cx-7,h-9,10,1,kind.includes('snow')?'cream':'pathLight');}
      else if(kind==='garden'){for(let xx=4;xx<w-3;xx+=8){B(xx,h-9,6,7,'stone','stoneLight');r(xx+2,h-19,2,11,'tree');r(xx,h-19,6,3,'treeLight');p(xx+2,h-21,'gold');p(xx+3,h-20,'cream');}}
      else{const stem=kind==='dry_shrub'?'woodLight':'tree';for(let i=0;i<5;i++){let xx=3+i*(w-6)/5,yy=h-2-(i%2)*3;l(xx,yy,xx-3,yy-9-(i%3)*2,stem);l(xx,yy,xx+2,yy-13,stem);if(['wildflowers','silver_grass'].includes(kind)){r(xx-4,yy-9,3,2,i%2?'cream':'gold');p(xx-3,yy-10,'roofLight');}if(kind==='wheat'){r(xx+1,yy-13,3,5,'gold');p(xx,yy-11,'pathLight');}if(kind==='reeds')r(xx+1,yy-16,3,6,'woodBright');}}return;
    }
    // Interior fixtures use the same wood, brass, cloth and stone as exteriors.
    shadow(2,h-2,w-4);
    switch(kind){
      case'bed':{B(2,3,w-4,h-5,'wood','woodBright');r(4,5,w-8,h-9,'blue');B(5,4,w-10,5,'cream','cream');r(4,11,w-8,2,'gold');r(2,1,3,h-1,'woodBright');r(w-5,1,3,h-1,'wood');break;}
      case'bookcase':case'cabinet':case'bookrack':{B(1,1,w-2,h-2,'wood','woodBright');for(let yy=6;yy<h-3;yy+=8){r(3,yy,w-6,1,'woodBright');for(let xx=4;xx<w-4;xx+=4){r(xx,yy-5,3,5,['roof','blue','treeLight','wall'][((xx+yy)/4|0)%4]);p(xx+1,yy-4,'gold');}}break;}
      case'barrel':barrel(cx-6,h-15);break;
      case'chest':chest(cx-8,h-15);break;
      case'crate':{B(0,h-17,16,16,'woodLight','woodBright');r(3,h-15,1,12,'wood');r(11,h-15,1,12,'wood');l(2,h-15,13,h-4,'wood');l(13,h-15,2,h-4,'woodBright');break;}
      case'sacks':{for(const[xx,yy]of[[cx-6,h-9],[cx+3,h-10]]){o(xx,yy,6,8,'ink');o(xx-1,yy-1,4,6,'path');r(xx-3,yy-8,6,2,'wood');r(xx-2,yy-6,4,1,'pathLight');}break;}
      case'table':case'desk':case'workbench':case'counter':case'kitchen':{B(1,h-16,w-2,10,'wood','woodBright');r(2,h-14,w-4,1,'woodLight');r(3,h-6,3,6,'wood');r(w-6,h-6,3,6,'wood');if(kind==='desk'){B(5,h-18,8,5,'cream','cream');r(6,h-17,5,1,'blue');B(w-10,h-20,5,5,'gold','cream');}else if(kind==='workbench'||kind==='kitchen'){r(4,h-23,w-8,1,'wood');for(let xx=5;xx<w-4;xx+=5){r(xx,h-22,1,5,'stoneLight');r(xx-1,h-20,3,2,'stone');}B(7,h-18,7,3,'woodLight','woodBright');}else{o(cx,h-17,5,2,'cream');B(w-10,h-20,4,5,'gold','cream');}break;}
      case'oven':case'forge':case'bakehouse':{B(2,h-20,w-4,19,'stone','stoneLight');r(4,h-18,w-8,2,'stoneBright');B(cx-6,h-13,12,11,'deep','wood');flame(cx,h-5);B(w-10,1,7,h-20,'stone','stoneLight');break;}
      case'anvil':{B(cx-4,h-8,8,7,'wood','woodLight');r(2,h-20,w-4,4,'ink');r(4,h-19,w-7,2,'stoneLight');r(cx-5,h-16,10,6,'stone');r(cx-3,h-14,6,7,'stoneLight');r(cx-7,h-8,14,3,'ink');break;}
      case'weapons':{B(2,3,w-4,3,'wood','woodBright');r(4,5,2,h-6,'wood');r(w-6,5,2,h-6,'wood');for(let xx=7;xx<w-5;xx+=5){r(xx,1,2,h-9,'ink');r(xx,2,1,h-12,'stoneLight');r(xx-2,h-12,5,2,'gold');r(xx,h-10,1,5,'woodBright');}break;}
      case'armor':{B(cx-5,1,10,5,'stone','stoneBright');r(cx-3,5,6,3,'ink');r(cx-7,8,14,13,'ink');r(cx-5,9,10,11,'stone');r(cx-4,9,3,8,'stoneLight');r(cx-8,9,3,7,'stoneLight');r(cx+5,9,3,7,'stone');r(cx-1,19,2,9,'wood');r(cx-6,28,12,2,'woodBright');r(cx-2,13,5,5,'blue');p(cx,14,'gold');break;}
      case'cart':case'minecart':{B(1,h-18,w-2,12,'wood','woodBright');for(let xx=4;xx<w-3;xx+=6){o(xx,h-19,3,3,'stoneLight');p(xx-1,h-21,'stoneBright');}o(5,h-4,3,3,'ink');o(w-6,h-4,3,3,'ink');p(5,h-4,'gold');p(w-6,h-4,'gold');break;}
      case'planter':case'planterlamp':{B(2,h-9,w-4,8,'wood','woodBright');for(let xx=5;xx<w-3;xx+=6){r(xx,h-17,1,9,'tree');r(xx-2,h-18,5,4,'treeLight');r(xx-1,h-20,3,3,'gold');p(xx,h-19,'cream');}if(kind==='planterlamp'){r(cx,h-31,2,23,'wood');B(cx-4,h-29,10,9,'gold','cream');r(cx-2,h-27,6,5,'cream');}break;}
      case'letters':{B(1,h-13,10,9,'wall','cream');B(7,h-10,9,8,'cream','cream');l(8,h-9,12,h-6,'wallShade');l(12,h-6,15,h-9,'wallShade');p(12,h-6,'roof');break;}
      case'mural':case'chart':case'starchart':{B(1,4,w-2,h-9,'wood','gold');r(3,6,w-6,h-13,kind==='starchart'?'blue':'cream');if(kind==='starchart'){star(cx,13,'gold');p(6,9,'cream');p(w-7,18,'cream');}else{l(4,19,cx-2,11,'waterLight',2);l(cx-2,11,w-5,17,'waterLight',2);r(8,10,3,3,'treeLight');r(w-10,19,4,2,'treeLight');}break;}
      case'curtain':{B(1,1,w-2,h-2,'deep','gold');r(3,3,5,h-5,'blue');r(w-8,3,5,h-5,'blue');r(4,3,2,h-10,'blueLight');r(w-6,3,2,h-10,'water');l(7,3,cx,7,'gold');l(w-8,3,cx,7,'gold');break;}
      case'stairs':{for(let i=0;i<5;i++)B(1+i*3,h-6-i*4,w-2-i*3,5,'stone','stoneBright');break;}
      case'ladder':{r(3,0,3,h,'wood');r(w-6,0,3,h,'wood');r(3,0,1,h,'woodBright');for(let yy=3;yy<h;yy+=6){r(3,yy,w-6,3,'ink');r(4,yy,w-8,1,'woodBright');}break;}
      case'valve':case'gears':case'wheel':case'winch':case'spinningwheel':case'grindstone':{B(1,h-7,w-2,6,'stone','stoneLight');if(kind==='winch'){B(2,h-20,w-4,14,'wood','woodBright');for(let xx=5;xx<w-4;xx+=3)r(xx,h-18,1,10,'path');wheel(w-5,h-13,5);}else{wheel(cx,kind==='gears'?h-14:h-13,Math.min(10,cx-2));if(kind==='gears')wheel(w-5,h-7,4);}break;}
      case'bell':{r(2,1,w-4,3,'ink');r(3,1,w-6,1,'woodBright');r(2,3,2,h-3,'wood');r(w-4,3,2,h-3,'wood');r(cx-1,4,2,6,'gold');B(cx-4,9,8,6,'gold','cream');r(cx-6,15,12,6,'ink');r(cx-5,15,10,4,'gold');r(cx-7,20,14,3,'gold');r(cx-2,23,4,3,'woodBright');r(cx-3,11,2,7,'cream');break;}
      case'hanginglamp':case'streetlamp':case'lamp':case'relay':case'post':{const yy=kind==='lamp'?h-18:4;r(cx-1,yy+7,3,h-yy-8,'ink');r(cx,yy+7,1,h-yy-9,'woodBright');r(cx-4,h-3,9,2,'wood');B(cx-5,yy,11,9,'gold','cream');r(cx-3,yy+2,7,5,'cream');r(cx,yy+1,1,7,'wood');r(cx-6,yy-1,13,2,'ink');r(cx-3,yy-4,7,3,'woodLight');if(kind==='relay'){r(cx-3,h-12,7,3,'blue');star(cx,h-15,'waterFoam');}if(kind==='hanginglamp'){r(cx-1,0,w/2,2,'woodBright');r(w-3,0,2,h,'wood');}break;}
      case'candelabra':{r(cx-1,8,2,h-9,'gold');r(cx-6,h-3,13,2,'gold');for(const xx of[cx-6,cx,cx+6]){r(xx,6,1,10,'gold');r(xx-1,5,3,5,'cream');r(xx,1,1,4,'roofLight');p(xx,1,'gold');}r(cx-6,15,13,2,'gold');break;}
      case'mirror':{o(cx,12,9,11,'ink');o(cx,12,8,10,'gold');o(cx,12,6,8,'waterLight');l(cx-4,15,cx+2,6,'snow');r(cx-1,23,2,6,'woodBright');r(cx-6,29,12,2,'gold');break;}
      case'crystal':{B(cx-7,h-10,14,9,'stone','stoneBright');for(let yy=1;yy<17;yy++){let span=Math.min(4,Math.floor(yy/2),Math.floor((18-yy)/2));r(cx-span,h-28+yy,span*2+1,1,'ink');if(span>0)r(cx-span+1,h-28+yy,span*2-1,1,'waterLight');if(span>1)r(cx-span+1,h-28+yy,span-1,1,'snow');}break;}
      case'lectern':{r(cx-2,h-15,4,13,'wood');r(cx-7,h-3,14,2,'woodBright');B(1,h-24,w-2,11,'wood','gold');r(3,h-22,w-6,7,'cream');r(cx,h-22,1,7,'wood');break;}
      case'column':{B(cx-5,2,10,h-5,'stone','stoneBright');r(cx-3,4,2,h-9,'stoneBright');r(cx+2,4,2,h-9,'stoneLight');r(cx-7,0,14,4,'stoneBright');r(cx-8,h-4,16,3,'stoneBright');break;}
      case'brazier':{r(cx-2,h-12,4,10,'gold');B(cx-7,h-14,14,6,'woodBright','gold');r(cx-6,h-3,12,2,'gold');flame(cx,h-16);break;}
      case'bag':{B(cx-6,h-12,12,10,'wood','woodBright');B(cx-4,h-15,8,5,'woodLight','gold');r(cx-1,h-11,3,5,'gold');p(cx,h-9,'ink');break;}
      case'basin':case'dyewell':case'fountain':{o(cx,h-7,cx-2,6,'ink');o(cx,h-8,cx-3,5,'stoneBright');o(cx,h-9,cx-5,3,'water');r(cx-4,h-10,7,1,'waterFoam');if(kind==='fountain'){r(cx-2,2,4,h-13,'stoneLight');o(cx,4,5,3,'stoneBright');r(cx,6,1,7,'waterFoam');}break;}
      case'rune':{B(cx-7,h-9,14,7,'stone','stoneLight');r(cx-4,h-13,8,5,'ink');r(cx-3,h-12,6,3,'pale');p(cx,h-12,'cream');break;}
      case'stall':{B(2,h-11,w-4,10,'wood','woodBright');r(3,6,2,h-7,'wood');r(w-5,6,2,h-7,'wood');B(0,1,w,9,'blue','gold');for(let xx=2;xx<w-2;xx+=8)r(xx,3,4,6,'cream');for(let xx=5;xx<w-4;xx+=6){r(xx,h-16,4,5,'gold');p(xx+1,h-17,'tree');}break;}
      case'produce':case'breadrack':case'fishstall':case'pottery':case'scales':case'ropes':case'snowshoes':case'carpet':case'lumber':{B(1,h-11,w-2,10,'wood','woodBright');r(3,h-16,2,6,'wood');r(w-5,h-16,2,6,'wood');r(2,h-17,w-4,2,'woodBright');
        if(kind==='scales'){r(cx,2,1,12,'gold');r(cx-7,5,15,1,'gold');for(const xx of[cx-6,cx+6]){l(xx,6,xx-3,12,'gold');l(xx,6,xx+3,12,'gold');r(xx-4,12,9,2,'gold');}}
        else if(kind==='pottery'){for(const xx of[5,cx,w-6]){o(xx,h-16,3,4,'cream');r(xx-2,h-21,4,2,'woodBright');}}
        else if(kind==='ropes'||kind==='snowshoes'){for(const xx of[7,w-8]){o(xx,h-19,4,6,'ink');o(xx,h-19,3,5,'path');o(xx,h-19,1,3,'wood');}}
        else if(kind==='carpet'){for(let xx=3;xx<w-2;xx+=4)r(xx,h-25,3,10,xx%8?'blue':'gold');}
        else if(kind==='lumber'){for(let yy=h-22;yy<h-10;yy+=5){r(3,yy,w-6,4,'woodLight');r(3,yy,w-6,1,'woodBright');}}
        else{for(let xx=4;xx<w-3;xx+=5){r(xx,h-16,4,4,kind==='fishstall'?'waterFoam':kind==='breadrack'?'pathLight':xx%10?'gold':'roofLight');p(xx,h-17,'cream');}}break;}
      case'bench':{r(1,h-19,w-2,5,'wood');r(2,h-19,w-4,1,'woodBright');r(2,h-12,w-4,4,'woodLight');r(4,h-14,2,13,'wood');r(w-6,h-14,2,13,'wood');break;}
      case'fence':case'reedgate':{for(let xx=2;xx<w-1;xx+=8){B(xx,2,4,h-2,'wood','woodBright');r(xx,0,4,3,'woodBright');}r(1,6,w-2,3,'wood');r(1,6,w-2,1,'woodBright');if(kind==='reedgate')for(let xx=4;xx<w-1;xx+=3)r(xx,8,1,7,'path');break;}
      case'channel':{r(0,4,w,h-5,'ink');r(1,5,w-2,h-7,'stone');r(3,7,w-6,h-10,'water');for(let xx=5;xx<w-4;xx+=7)r(xx,9,4,1,'waterFoam');r(0,4,w,2,'stoneBright');break;}
      case'telescope':{r(cx-1,10,3,11,'wood');l(cx,14,cx-7,22,'woodBright');l(cx+1,14,cx+8,22,'wood');for(let i=0;i<13;i++)r(4+i,12-Math.floor(i*.5),3,4,'ink');for(let i=0;i<11;i++)r(5+i,12-Math.floor(i*.5),2,2,'gold');r(17,4,3,6,'ink');r(17,5,2,4,'waterFoam');break;}
      case'hatch':{B(1,h-17,w-2,16,'stone','stoneLight');B(4,h-14,w-8,10,'wood','woodBright');r(cx-3,h-10,6,2,'gold');break;}
      default:{// A declared original stone marker is a safe visible fallback for future source IDs.
        B(cx-6,h-17,12,16,'stone','stoneLight');r(cx-3,h-14,6,2,'stoneBright');r(cx-2,h-10,4,4,'blue');p(cx,h-9,'gold');
      }
    }
  }
  function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  function draw(ctx,key,x,y,width=24,meta={}){
    const b=box(key,x,y,width,meta),region=meta.region||'',ck=key+'|'+b.w+'|'+b.h+'|'+region;
    let c=cache.get(ck);if(!c){c=canvas(b.w,b.h);render(c.getContext('2d'),String(key),b.w,b.h,meta);cache.set(ck,c);}
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(c,b.left,b.top);ctx.restore();return b;
  }
  const costumes={
    roadkeeper:{hair:'wood',hairLight:'woodLight',coat:'tree',coatLight:'treeLight',shirt:'pathLight',trim:'gold',skin:'skin',staff:true},
    mara:{hair:'ink',hairLight:'stone',coat:'red',coatLight:'redLight',shirt:'stoneLight',trim:'gold',skin:'skin',shield:true},
    iven:{hair:'stoneBright',hairLight:'cream',coat:'cream',coatLight:'wall',shirt:'blue',trim:'roofLight',skin:'skin',robe:true},
    sella:{hair:'wood',hairLight:'woodBright',coat:'blue',coatLight:'blueLight',shirt:'violet',trim:'gold',skin:'skin',hood:true},
    bram:{hair:'roofDark',hairLight:'roofLight',coat:'wood',coatLight:'woodBright',shirt:'stoneLight',trim:'gold',skin:'skinShade',beard:true},
    tavi:{hair:'roofDark',hairLight:'woodBright',coat:'roof',coatLight:'roofLight',shirt:'cream',trim:'gold',skin:'skin'},
    wyla:{hair:'stoneLight',hairLight:'cream',coat:'violet',coatLight:'violetLight',shirt:'cream',trim:'gold',skin:'skin'},
    inn:{hair:'wood',hairLight:'woodBright',coat:'tree',coatLight:'treeLight',shirt:'cream',trim:'gold',skin:'skin'}
  };
  function heroSprite(id,dir,frame){
    id=String(id||'roadkeeper').toLowerCase();if(!costumes[id])id='inn';
    const s=costumes[id],c=canvas(16,24),ctx=c.getContext('2d'),{r,p,l}=painter(ctx);
    const step=(frame&3)===1?-1:(frame&3)===3?1:0;
    const facing=typeof dir==='number'?['down','left','right','up'][dir&3]:dir;
    const back=facing==='up'||facing==='north',side=['left','right','west','east'].includes(facing);
    const right=facing==='right'||facing==='east';
    // Body, head, silhouette and baseline are identical across all walk poses.
    // Only arm/leg clusters alternate; zero rescaling or per-frame crop occurs.
    if(side&&right){ctx.translate(16,0);ctx.scale(-1,1);}
    if(side){
      r(5,20,4,4,'ink');r(9,20,3,4,'ink');r(5+step,20,3,3,'wood');r(9-step,20,2,3,'woodLight');
      r(3,10,8,11,'ink');r(4,11,6,9,s.coat);r(7,11,3,8,s.coatLight);r(4,18,6,2,'wood');r(4,19,3,2,s.shirt);
      r(4,1,8,9,'ink');r(3,3,10,5,'ink');r(4,2,7,5,s.hair);r(4,2,5,1,s.hairLight);r(3,4,4,3,s.hairLight);r(4,6,7,4,s.skin);r(3,6,3,2,s.skin);p(4,6,'ink');r(8,4,3,4,s.hair);p(5,9,'skinShade');
      r(5,11+step,3,6,'ink');r(6,12+step,2,4,s.shirt);r(5,16+step,3,2,s.skin);r(3,14,3,5,'woodBright');r(3,14,3,1,'gold');
      if(s.staff){r(1,9,1,15,'ink');r(1,10,1,12,'woodBright');r(0,7,3,3,'ink');p(1,8,'grassBright');}
      if(s.shield){r(1,12,4,8,'ink');r(2,13,2,5,'blue');p(2,14,'gold');}
      if(s.robe){r(4,18,7,4,'ink');r(5,18,5,3,s.coat);r(5,20,5,1,s.trim);}
      if(s.hood){r(5,0,6,2,'ink');r(6,1,4,1,s.coatLight);r(9,3,3,6,s.coat);r(10,4,1,4,s.coatLight);}
    }else{
      r(4,20,4,4,'ink');r(9,20,4,4,'ink');r(5,20,2,3+(step<0?1:0),'woodLight');r(10,20,2,3+(step>0?1:0),'wood');
      r(3,10,11,11,'ink');r(4,11,9,9,s.coat);r(4,11,3,8,s.coatLight);r(6,12,5,7,back?s.coat:s.shirt);
      r(2,11+step,3,7,'ink');r(12,11-step,3,7,'ink');r(3,12+step,2,4,s.coatLight);r(12,12-step,2,4,s.coat);r(3,16+step,2,2,s.skin);r(12,16-step,2,2,s.skin);
      r(4,18,9,2,'wood');p(8,18,'gold');
      r(4,1,9,9,'ink');r(3,3,11,5,'ink');r(4,2,9,4,s.hair);r(4,2,6,1,s.hairLight);r(3,3,4,2,s.hairLight);r(10,1,2,2,s.hair);r(6,0,3,2,s.hair);p(4,1,s.hair);
      if(back){r(4,4,9,5,s.hair);r(4,5,3,2,s.hairLight);r(5,10,7,3,s.coatLight);r(8,13,1,5,s.coatLight);}
      else{r(4,5,9,4,s.skin);r(5,9,7,1,'skinShade');r(5,5,1,2,'ink');r(11,5,1,2,'ink');p(6,5,'cream');p(10,5,'cream');r(7,8,3,1,'skinShade');r(4,4,3,2,s.hair);p(9,4,s.hair);}
      if(s.staff){r(1,9,1,15,'ink');r(1,10,1,12,'woodBright');r(0,7,3,3,'ink');p(1,8,'grassBright');if(!back){l(5,11,11,17,'woodBright');BeltBag();}}
      if(s.shield&&!back){r(0,12,5,8,'ink');r(1,13,3,5,'blue');r(2,13,1,5,'gold');p(1,15,'gold');}
      if(s.robe){r(4,18,9,4,'ink');r(5,18,7,3,s.coat);r(5,20,7,1,s.trim);if(!back){r(7,10,3,8,s.trim);r(8,11,1,5,'cream');}}
      if(s.hood){r(4,1,9,3,s.coat);r(6,0,5,2,s.coatLight);r(3,3,2,6,s.coat);r(12,3,2,6,s.coat);if(back){r(4,3,9,7,s.coat);r(5,3,4,3,s.coatLight);}else{p(4,4,'gold');p(12,4,'gold');}}
      if(s.beard&&!back){r(5,8,7,3,s.hair);r(7,10,3,2,s.hairLight);}
    }
    function BeltBag(){r(10,16,4,4,'ink');r(11,16,2,3,'woodBright');p(11,17,'gold');}
    return c;
  }
  function drawHero(ctx,id,dir='down',frame=0,x=8,y=24){
    const key=[id,dir,frame&3].join('|');let c=heroCache.get(key);if(!c){c=heroSprite(id,dir,frame&3);heroCache.set(key,c);}
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(c,Math.round(x-8),Math.round(y-24));ctx.restore();
    return{left:Math.round(x-8),top:Math.round(y-24),w:16,h:24};
  }
  function drawPortrait(ctx,id,x,y,size=48){
    ctx.save();ctx.imageSmoothingEnabled=false;const s=Math.max(1,Math.floor(size/24));ctx.fillStyle=P.deep;ctx.fillRect(x,y,size,size);ctx.fillStyle=P.ink;ctx.fillRect(x+2,y+2,size-4,size-4);const key=id+'|down|0';let c=heroCache.get(key);if(!c){c=heroSprite(id,'down',0);heroCache.set(key,c);}ctx.drawImage(c,x+Math.floor((size-16*s)/2),y+size-24*s,16*s,24*s);ctx.restore();
  }
  function portraitURL(id){const c=canvas(48,48);drawPortrait(c.getContext('2d'),id,0,0,48);return c.toDataURL('image/png');}
  const category=key=>{const k=identify(key);return buildings.has(k)||k==='inn'?'building':k==='npc'?'npc':['ship','ferry','airship','tallowback'].includes(k)?'vehicle':['oak','orchard_tree','pine','snow_pine','bare_tree','mangrove','palm','forest_cluster'].includes(k)?'tree':small.has(k)?'fixture':'landmark';};
  return Object.freeze({draw,box,bounds,identify,kind:identify,category,drawHero,drawPortrait,portraitURL,palette:P,version:'classic-1',clearCache:()=>{cache.clear();heroCache.clear();}});
})();
globalThis.AVELUNE_PALETTE=AVELUNE_PALETTE;
globalThis.AvelunePixelArt=AvelunePixelArt;
