import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';

// Build before running. This checks the actual compiled map renderer.
const output=path.resolve(process.env.OVERWORLD_VISUAL_OUTPUT||'test-results/overworld');
const port=Number(process.env.OVERWORLD_VISUAL_PORT||3105);
await fs.mkdir(output,{recursive:true});
const server=spawn(process.execPath,['tools/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Overworld server stopped: '+code)));});
let browser;const errors=[],report=[];
const pass=name=>{report.push(name);console.log('PASS',name);};
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function metrics(page){return page.locator('#world').evaluate(c=>{const r=c.getBoundingClientRect(),p=c.parentElement.getBoundingClientRect();return{width:c.width,height:c.height,scale:r.width/c.width,scaleY:r.height/c.height,cssWidth:r.width,cssHeight:r.height,frameWidth:p.width,frameHeight:p.height,smoothing:c.getContext('2d').imageSmoothingEnabled,overflow:document.documentElement.scrollWidth>innerWidth};});}
function checkScale(m){assert.equal(m.scale,m.scaleY);assert.equal(m.scale,Math.floor(m.scale));assert.ok(m.scale>=1);assert.ok(m.cssWidth<=m.frameWidth&&m.cssHeight<=m.frameHeight);assert.equal(m.smoothing,false);assert.equal(m.overflow,false);}
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.goto('http://127.0.0.1:'+port+'/?test=1');await page.waitForFunction(()=>window.__avelune?.state.ready);
  await page.evaluate(async()=>{await __avelune.startGame(null);__avelune.closeDialog();});await settle(page);
  const local=await metrics(page);checkScale(local);
  const ids=await page.evaluate(()=>Object.values(LAYOUT.areas).filter(a=>a.kind==='overworld').map(a=>a.id));assert.ok(ids.length>=7);
  const maps=[];
  for(const id of ids){await page.evaluate(async id=>{await __avelune.visit(id);__avelune.closeDialog();},id);await settle(page);const m=await metrics(page);checkScale(m);maps.push({id,...m});}
  assert.ok(maps[0].width*maps[0].height>local.width*local.height*2,'Desktop world map reveals substantially more terrain');assert.ok(maps[0].scale<local.scale);
  pass('Every overworld renders with a wider desktop camera and square integer pixels');

  const poses=await page.evaluate(()=>{
    const hash=data=>{let n=2166136261;for(const byte of data)n=Math.imul(n^byte,16777619);return n>>>0;};
    const result=[];
    for(const id of ['roadkeeper','mara','iven','sella'])for(const direction of ['down','left','right','up']){
      const frames=[];for(let frame=0;frame<4;frame++){
        const canvas=document.createElement('canvas');canvas.width=24;canvas.height=24;const ctx=canvas.getContext('2d',{willReadFrequently:true});
        const box=AveluneOverworldArt.hero(ctx,id,direction,frame,12,20);
        frames.push({box,head:hash(ctx.getImageData(8,8,8,5).data),hardEdges:ctx.getImageData(0,0,24,24).data.every((value,i)=>i%4!==3||value===0||value===255||value===136)});
      }result.push({id,direction,frames});
    }return result;
  });
  for(const pose of poses){assert.equal(new Set(pose.frames.map(f=>f.head)).size,1,'Miniature hero head stays fixed throughout a stride');for(const frame of pose.frames){assert.deepEqual(frame.box,{left:8,top:8,w:8,h:12});assert.equal(frame.hardEdges,true);}}
  pass('64 miniature hero poses preserve their head, foot anchor and hard pixel edges');

  await page.evaluate(async()=>{await __avelune.visit('world_alderreach');__avelune.closeDialog();});await settle(page);
  await page.locator('.view-frame').screenshot({path:path.join(output,'overworld-desktop.png')});
  await page.setViewportSize({width:390,height:844});await settle(page);const mobile=await metrics(page);checkScale(mobile);await page.locator('.view-frame').screenshot({path:path.join(output,'overworld-mobile.png')});
  await page.evaluate(async()=>{await __avelune.visit('alderreach_01');__avelune.closeDialog();});await settle(page);const mobileLocal=await metrics(page);checkScale(mobileLocal);assert.ok(mobile.height>mobileLocal.height,'Mobile world camera also shows a larger area');
  pass('Mobile world and town views fit the playfield without blur or horizontal overflow');
  assert.deepEqual(errors,[]);pass('No page errors or failed asset requests');
  await fs.writeFile(path.join(output,'overworld-render-report.json'),JSON.stringify({checks:report,local,maps,mobile,mobileLocal,poses,errors},null,2));
} finally {await browser?.close();server.kill();}
