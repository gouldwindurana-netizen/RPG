import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function renderer({reduced=false, width=1096, height=540, pixelArt=true}={}) {
  const heroes=[], draws=[];
  const context=vm.createContext({
    matchMedia:()=>({matches:reduced}),
    ...(pixelArt ? {AvelunePixelArt:{drawHero:(...args)=>heroes.push(args)}} : {}),
  });
  vm.runInContext(fs.readFileSync(new URL('../src/view.js',import.meta.url),'utf8'),context);
  const View=vm.runInContext('AveluneView',context);
  const ctx={globalAlpha:1,save(){},restore(){},fillRect(){},drawImage(...args){draws.push(args);}};
  const canvas={width:0,height:0,clientWidth:width,clientHeight:height,style:{},
    parentElement:{clientWidth:width,clientHeight:height},getContext:()=>ctx};
  const art={motion:{clips:{walk_south:{frames:['a','b','c','d'],anchor:[8,24],period:.4,art_width:16,art_height:24}},
    rects:{a:[0,0,16,24],b:[16,0,16,24],c:[32,0,16,24],d:[48,0,16,24]}}};
  const view=new View(canvas,art,16);
  view.motionAtlas={id:'one-consistent-sheet'};
  return {view,canvas,ctx,heroes,draws};
}

test('idle and every walking pose retain one character, foot anchor and native size',()=>{
  const {view,ctx,heroes}=renderer();
  const hero={x:40.2,y:80.4,moving:false,facing:'south'};
  view.actor(ctx,hero,0);
  view.actor(ctx,hero,100);
  hero.moving=true;
  for (let step=0;step<4;step++) {
    hero.x+=6;
    view.actor(ctx,hero,step*1000);
  }
  assert.deepEqual(heroes.map(([,id])=>id),Array(6).fill('roadkeeper'));
  assert.deepEqual(heroes.map(([, , ,frame])=>frame),[0,0,1,2,3,0]);
  assert.ok(heroes.every(args=>args.length===6),'No width or height scaling is supplied to the 16×24 artist');
  for (const [i,args] of heroes.entries()) {
    assert.equal(args[4],i<2?40:40+(i-1)*6);
    assert.equal(args[5],80,'The bottom-center anchor never bobs or breathes');
  }
});

test('footsteps follow actual distance at walking and running speeds, independent of frame count',()=>{
  function traverse(increments) {
    const {view}=renderer();
    const hero={x:0,y:0,moving:true,facing:'east'};
    view.animateActor(hero);
    for (const distance of increments) {hero.x+=distance;view.animateActor(hero);}
    return view.animateActor(hero);
  }
  const walk=traverse(Array(12).fill(1));
  const run=traverse([6,6]);
  assert.equal(walk.frame,2);
  assert.equal(run.frame,walk.frame);
  assert.equal(walk.x,run.x);
  assert.equal(traverse(Array(500).fill(0)).frame,0,'A blocked or waiting actor does not take steps');
});

test('turns, stopping, area entry and teleporting restart at the new direction’s neutral pose',()=>{
  const {view}=renderer();
  const hero={x:0,y:0,moving:true,facing:'south'};
  view.animateActor(hero);
  hero.x=12;
  assert.equal(view.animateActor(hero).frame,2);
  hero.facing='north';
  assert.equal(view.animateActor(hero).frame,0);
  hero.y=6;
  assert.equal(view.animateActor(hero).frame,1);
  hero.moving=false;
  assert.equal(view.animateActor(hero).frame,0);
  hero.moving=true;hero.y=12;
  assert.equal(view.animateActor(hero).frame,1);
  hero.y=100;
  assert.equal(view.animateActor(hero).frame,0);
  view.lastFoot=null;hero.y=106;
  assert.equal(view.animateActor(hero).frame,0);
  hero.facing='invalid';
  assert.equal(view.animateActor(hero).direction,'down');
});

test('reduced motion keeps the same character and anchor while movement still updates position',()=>{
  const {view,ctx,heroes}=renderer({reduced:true});
  const hero={x:10,y:50,moving:false,facing:'east'};
  view.actor(ctx,hero,0);
  hero.moving=true;hero.x=22;
  view.actor(ctx,hero,2000);
  assert.deepEqual(heroes.map(([,id,dir,frame,x,y])=>[id,dir,frame,x,y]),[
    ['roadkeeper','right',0,10,50],['roadkeeper','right',0,22,50],
  ]);
});

test('fallback idle and walking share the same atlas, crop size and fixed baseline',()=>{
  const {view,ctx,draws}=renderer({pixelArt:false});
  const hero={x:20,y:50,moving:false,facing:'south'};
  view.actor(ctx,hero,0);
  hero.moving=true;hero.x+=6;
  view.actor(ctx,hero,100);
  assert.equal(draws.length,2);
  assert.equal(draws[0][0],draws[1][0]);
  assert.deepEqual(draws.map(args=>args.slice(3)),[
    [16,24,12,26,16,24],[16,24,18,26,16,24],
  ]);
  view.motion(ctx,'not-a-clip',0,0,0);
  view.motion(ctx,'walk_south',-.1,20,50);
  assert.equal(draws.length,3,'Missing clips are ignored and negative time resolves to a valid pose');
});

test('canvas uses square integer pixels and the same scale in interiors and outdoors',()=>{
  const {view,canvas}=renderer();
  view.size();
  assert.deepEqual([canvas.width,canvas.height,canvas.style.width,canvas.style.height],[544,224,'1088px','448px']);
  view.indoor=true;
  view.bounds={left:-30,top:-20,right:1300,bottom:1000};
  view.size();
  assert.deepEqual([canvas.width,canvas.height,canvas.style.width,canvas.style.height],[544,224,'1088px','448px']);
  assert.equal(view.ctx.imageSmoothingEnabled,false);
  canvas.parentElement={clientWidth:1095,clientHeight:539};
  view.size();
  assert.deepEqual([canvas.style.left,canvas.style.top,canvas.style.transform],['3px','45px','none'],
    'Odd letterbox margins never place a source pixel on a half display pixel');
  canvas.parentElement={clientWidth:1096,clientHeight:388};
  view.size();
  assert.deepEqual([canvas.width,canvas.height,canvas.style.width,canvas.style.height],[544,192,'1088px','384px']);
  canvas.parentElement={clientWidth:362,clientHeight:312};
  view.size();
  assert.deepEqual([canvas.width,canvas.height,canvas.style.width,canvas.style.height],[352,224,'352px','224px']);
});
