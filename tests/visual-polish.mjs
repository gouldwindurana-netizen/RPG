import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';

// Build first. Artifacts deliberately live outside the source repository.
const output=path.resolve(process.env.VISUAL_OUTPUT||'test-results/visual');
const port=Number(process.env.VISUAL_PORT||3102);
const layout=JSON.parse(await fs.readFile('src/world.json','utf8'));
await fs.mkdir(output,{recursive:true});
const server=spawn(process.execPath,['tools/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
await new Promise((resolve,reject)=>{
  server.stdout.once('data',resolve);
  server.once('error',reject);
  server.once('exit',code=>reject(Error('Visual test server stopped: '+code)));
});
const results=[],errors=[],maps=[],scales=[];
const pass=name=>{results.push({name,status:'passed'});console.log('PASS',name);};
let browser;

function observe(page,label) {
  page.on('pageerror',error=>errors.push(label+': '+error.message));
  page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url());});
}

async function boot(options,label) {
  const page=await browser.newPage({...options,deviceScaleFactor:1,reducedMotion:'no-preference'});
  observe(page,label);
  await page.goto('http://127.0.0.1:'+port+'/?test=1');
  await page.waitForFunction(()=>window.__avelune?.state.ready);
  await page.evaluate(async()=>{await __avelune.startGame(null);__avelune.closeDialog();});
  await settle(page);
  return page;
}

async function settle(page) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}

async function visit(page,id) {
  await page.evaluate(async id=>{await __avelune.visit(id);__avelune.closeDialog();},id);
  await settle(page);
  assert.equal(await page.evaluate(()=>__avelune.world.id),id);
  assert.equal(await page.locator('#loading').isHidden(),true,'Area must finish loading: '+id);
}

async function viewport(page,label) {
  const metrics=await page.evaluate(()=>{
    const canvas=document.getElementById('world'),rect=canvas.getBoundingClientRect();
    const frame=canvas.parentElement.getBoundingClientRect();
    return {width:canvas.width,height:canvas.height,cssWidth:rect.width,cssHeight:rect.height,
      scaleX:rect.width/canvas.width,scaleY:rect.height/canvas.height,
      left:rect.left,top:rect.top,frameWidth:frame.width,frameHeight:frame.height,
      smoothing:canvas.getContext('2d').imageSmoothingEnabled,
      overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.equal(metrics.scaleX,metrics.scaleY,label+' uses square pixels');
  assert.equal(metrics.scaleX,Math.floor(metrics.scaleX),label+' uses integer scaling');
  assert.ok(metrics.scaleX>=1);
  assert.equal(metrics.smoothing,false);
  assert.equal(metrics.overflow,false,label+' has no horizontal overflow');
  assert.ok(metrics.cssWidth<=metrics.frameWidth&&metrics.cssHeight<=metrics.frameHeight,label+' fits the playfield');
  scales.push({label,...metrics});
  return metrics;
}

try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage']});
  const desktop=await boot({viewport:{width:1440,height:1000}},'Desktop');
  const heroMetrics=await desktop.evaluate(()=>{
    const hash=data=>{let value=2166136261;for(const byte of data)value=Math.imul(value^byte,16777619);return(value>>>0).toString(16);};
    const bounds=(data,w)=>{
      let left=w,right=-1,top=data.length/4/w,bottom=-1;
      for(let i=0;i<data.length;i+=4)if(data[i+3]){const x=(i/4)%w,y=Math.floor(i/4/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      return {left,right,top,bottom};
    };
    const metrics=[];
    for(const id of ['roadkeeper','mara','iven','sella'])for(const direction of ['down','left','right','up']) {
      const poses=[];
      for(let frame=0;frame<4;frame++) {
        const canvas=document.createElement('canvas');canvas.width=32;canvas.height=40;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        const box=AvelunePixelArt.drawHero(ctx,id,direction,frame,16,32);
        const image=ctx.getImageData(0,0,32,40),head=ctx.getImageData(8,8,16,10);
        poses.push({frame,box,bounds:bounds(image.data,32),head:hash(head.data),pixels:hash(image.data),
          hardEdges:image.data.every((value,i)=>i%4!==3||value===0||value===255)});
      }
      metrics.push({id,direction,poses});
    }
    const sheet=document.createElement('canvas');sheet.width=96;sheet.height=128;
    const ctx=sheet.getContext('2d');ctx.fillStyle=AVELUNE_PALETTE.deep;ctx.fillRect(0,0,96,128);
    ['down','left','right','up'].forEach((direction,row)=>{for(let frame=0;frame<4;frame++)AvelunePixelArt.drawHero(ctx,'roadkeeper',direction,frame,frame*24+12,row*32+28);});
    const preview=document.createElement('canvas');preview.width=384;preview.height=512;
    const previewCtx=preview.getContext('2d');previewCtx.imageSmoothingEnabled=false;previewCtx.drawImage(sheet,0,0,384,512);
    const actorCanvas=document.createElement('canvas');actorCanvas.width=160;actorCanvas.height=64;
    const actorContext=actorCanvas.getContext('2d',{willReadFrequently:true});
    const actorView=new AveluneView(actorCanvas,ART,16);actorView.reduce=false;
    const model={x:20,y:36,facing:'south',moving:false},actorHeads=[],actorPoses=[];
    for(const [i,time]of [0,.5,1,2,4,8,16].entries()) {
      if(i>=3){model.moving=true;model.x+=6;}
      actorContext.clearRect(0,0,160,64);actorView.actor(actorContext,model,time);
      actorHeads.push(hash(actorContext.getImageData(model.x-8,model.y-24,16,10).data));
      actorPoses.push(hash(actorContext.getImageData(model.x-8,model.y-24,16,24).data));
    }
    return {metrics,actorHeads,actorPoses,sheet:preview.toDataURL('image/png')};
  });
  for(const {id,direction,poses}of heroMetrics.metrics) {
    const name=id+' '+direction;
    assert.equal(new Set(poses.map(p=>p.head)).size,1,name+' head is identical across idle and walking poses');
    assert.equal(new Set(poses.map(p=>JSON.stringify(p.box))).size,1,name+' keeps a 16×24 anchor cell');
    assert.equal(new Set(poses.map(p=>JSON.stringify(p.bounds))).size,1,name+' never changes silhouette bounds');
    assert.ok(poses.every(p=>p.bounds.bottom===31),name+' feet stay on the same baseline');
    assert.ok(poses.every(p=>p.hardEdges),name+' has no resampled translucent edges');
    assert.ok(new Set(poses.map(p=>p.pixels)).size>=2,name+' has distinct walking poses');
  }
  await fs.writeFile(path.join(output,'walk-contact-sheet.png'),Buffer.from(heroMetrics.sheet.split(',')[1],'base64'));
  await fs.writeFile(path.join(output,'hero-metrics.json'),JSON.stringify(heroMetrics.metrics,null,2));
  pass('Four party identities × four directions × four poses keep a fixed head, 16×24 cell and foot baseline');
  assert.equal(new Set(heroMetrics.actorHeads).size,1,'The actual actor renderer retains its head through waiting and walking');
  assert.ok(new Set(heroMetrics.actorPoses).size>=2,'The actual actor renderer advances the walking poses');
  pass('Actual actor renderer keeps the same head and body scale from idle through a complete stride');

  const outside=await viewport(desktop,'desktop-field');
  await desktop.screenshot({path:path.join(output,'desktop-field.png')});
  await visit(desktop,'wyla_cottage');
  const inside=await viewport(desktop,'desktop-interior');
  assert.equal(inside.scaleX,outside.scaleX,'Entering a room never shrinks the hero');
  assert.equal(inside.width,outside.width);assert.equal(inside.height,outside.height);
  await desktop.screenshot({path:path.join(output,'desktop-interior.png')});
  pass('1440×1000 field and interior use the same integer pixel scale');

  const representatives=new Map([
    ['alderreach_01','orchard'],['veyra_01','marsh'],['kharad_01','basalt'],['sereva_01','salt'],
    ['sereva_06','forest'],['isles_01','island'],['isles_08','sky'],['ordel_01','snow'],['edrin_05','ivory'],
  ]);
  for(const area of Object.values(layout.areas)) {
    await visit(desktop,area.id);
    const appearance=await desktop.evaluate(()=>{
      const canvas=document.getElementById('world'),ctx=canvas.getContext('2d',{willReadFrequently:true});
      const {data}=ctx.getImageData(0,0,canvas.width,canvas.height),colors=new Set();
      for(let i=0;i<data.length;i+=4)colors.add(data[i]+','+data[i+1]+','+data[i+2]+','+data[i+3]);
      return {colors:colors.size,complete:__avelune.state.ready};
    });
    assert.equal(appearance.complete,true,area.id+' is ready');
    assert.ok(appearance.colors>8,area.id+' renders terrain and objects rather than a blank canvas');
    maps.push({id:area.id,name:area.name,theme:area.theme,indoor:area.indoor,...appearance});
    if(representatives.has(area.id))await desktop.locator('.view-frame').screenshot({path:path.join(output,'theme-'+representatives.get(area.id)+'.png')});
    assert.deepEqual(errors,[],area.id+' introduces no JavaScript or resource errors');
  }
  assert.equal(maps.length,Object.keys(layout.areas).length);
  pass('All '+maps.length+' authored and service maps render after area travel without JavaScript or resource errors');

  const mobile=await boot({viewport:{width:390,height:844},isMobile:true,hasTouch:true},'Mobile');
  const mobileOutside=await viewport(mobile,'mobile-field');
  await mobile.screenshot({path:path.join(output,'mobile-field.png')});
  await visit(mobile,'wyla_cottage');
  const mobileInside=await viewport(mobile,'mobile-interior');
  assert.equal(mobileInside.scaleX,mobileOutside.scaleX,'Mobile room entry preserves sprite scale');
  assert.equal(mobileInside.width,mobileOutside.width);assert.equal(mobileInside.height,mobileOutside.height);
  await mobile.screenshot({path:path.join(output,'mobile-interior.png')});
  pass('390×844 mobile field and interior preserve square pixels, sprite scale and page width');
  await mobile.evaluate(async()=>{const door=__avelune.world.layout.areas.alderreach_01.stops.find(s=>s.mode==='door');await __avelune.visit('alderreach_01',door.at);__avelune.closeDialog();});
  await mobile.locator('#interact:not([hidden])').waitFor({state:'visible'});
  const action=await mobile.locator('#interact').boundingBox(),badge=await mobile.locator('#danger-chip').boundingBox();
  assert.ok(action&&badge);
  assert.ok(action.x+action.width<=badge.x||badge.x+badge.width<=action.x||action.y+action.height<=badge.y||badge.y+badge.height<=action.y,'The action prompt and danger badge never overlap');
  await mobile.screenshot({path:path.join(output,'mobile-door.png')});
  pass('Mobile doorway action prompt and danger badge occupy separate clear HUD positions');
  assert.deepEqual(errors,[]);
  const report={date:new Date().toISOString(),browser:await browser.version(),results,errors,scales,maps,
    artifacts:['walk-contact-sheet.png','hero-metrics.json','desktop-field.png','desktop-interior.png','mobile-field.png','mobile-interior.png',
      ...[...representatives.values()].map(theme=>'theme-'+theme+'.png')]};
  await fs.writeFile(path.join(output,'visual-report.json'),JSON.stringify(report,null,2));
  console.log('Visual artifacts:',output);
} catch(error) {
  await fs.writeFile(path.join(output,'visual-failure.json'),JSON.stringify({message:error.message,stack:error.stack,results,errors,scales,maps},null,2));
  throw error;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
