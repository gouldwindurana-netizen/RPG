import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';

const output=process.env.TRAVEL_OUTPUT||'test-results/travel';await fs.mkdir(output,{recursive:true});
const port=3106,server=spawn(process.execPath,['tools/serve.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port)},stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server stopped: '+code)))});
const results=[],errors=[];let browser;
const pass=name=>{results.push({name,status:'passed'});console.log('PASS',name)};
const dimensions=page=>page.locator('#world').evaluate(c=>({width:c.width,height:c.height,displayWidth:c.getBoundingClientRect().width}));
async function leaveTown(page){
  const key=await page.evaluate(async()=>{const a=__avelune.world.area,s=a.stops.find(s=>s.id.endsWith('_world'));await __avelune.visit(a.id,s.arrival);__avelune.closeDialog();const dx=s.at[0]-s.arrival[0],dy=s.at[1]-s.arrival[1];return Math.abs(dx)>Math.abs(dy)?dx>0?'ArrowRight':'ArrowLeft':dy>0?'ArrowDown':'ArrowUp'});
  await page.keyboard.down(key);
  await page.waitForFunction(()=>__avelune.world.area.kind==='overworld'&&!__avelune.state.transition,null,{timeout:5000});
  await page.keyboard.up(key);
}
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
  await page.goto('http://localhost:'+port+'/?test=1');await page.waitForFunction(()=>window.__avelune?.state.ready);
  await page.locator('#new-game').click();await page.locator('#begin-adventure').click();await page.locator('#dialog-content button').click();
  const town=await dimensions(page);assert.equal(await page.evaluate(()=>__avelune.world.area.classicTown),true);
  assert.ok(await page.getByRole('button',{name:'Revive',exact:true}).isVisible());
  await page.screenshot({path:output+'/compact-town.png'});pass('Compact starting town has signed services and a paid clinic');
  await page.evaluate(async()=>{__avelune.rpg.recruit('mara');__avelune.rpg.gold=0;__avelune.rpg.party[1].hp=0;__avelune.rpg.party[0].hp=1;const d=__avelune.townServices().find(s=>s.type==='chapel');await __avelune.visit(d.scene);__avelune.servicesUI.open(__avelune.townServices().find(s=>s.type==='chapel'))});
  assert.equal(await page.getByRole('button',{name:/^Receive care/}).count(),0);
  const fallen=page.locator('.town-row').filter({has:page.locator('.town-row-info > strong',{hasText:/^Mara ·/})});
  assert.equal(await fallen.getByRole('button',{name:/^Revive · 30 G/}).isDisabled(),true);
  await page.evaluate(()=>{__avelune.rpg.gold=30;__avelune.servicesUI.open(__avelune.townServices().find(s=>s.type==='chapel'))});
  await fallen.getByRole('button',{name:/^Revive · 30 G/}).click();
  assert.deepEqual(await page.evaluate(()=>[__avelune.rpg.gold,__avelune.rpg.party[1].hp,__avelune.rpg.party[0].hp]),[0,1,1]);
  await page.locator('#close-dialog').click();pass('Clinic refuses zero gold and revives only one ally for30G');
  await page.evaluate(async()=>{await __avelune.visit('alderreach_01');__avelune.closeDialog()});await leaveTown(page);
  const world=await dimensions(page);assert.ok(world.width>town.width&&world.height>town.height,'Overworld shows a wider area');
  assert.match(await page.locator('#region').textContent(),/OVERWORLD/);
  assert.equal(await page.locator('#town-strip').isVisible(),false);
  await page.screenshot({path:output+'/overworld.png'});pass('Walking through the geographically aligned town gate automatically opens a separate wider overworld');
  const before=await page.evaluate(()=>[__avelune.world.x,__avelune.world.y]);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(180);await page.keyboard.up('ArrowRight');
  assert.ok(await page.evaluate(p=>__avelune.world.x>p[0],before));pass('Overworld movement uses real collision and walking input');
  const entranceKey=await page.evaluate(async()=>{const w=__avelune.world,s=w.area.stops.find(s=>s.title==='Brackenwell');await __avelune.visit(w.id,s.arrival);const dx=s.at[0]-s.arrival[0],dy=s.at[1]-s.arrival[1];return Math.abs(dx)>Math.abs(dy)?dx>0?'ArrowRight':'ArrowLeft':dy>0?'ArrowDown':'ArrowUp'});
  await page.keyboard.down(entranceKey);await page.waitForFunction(()=>__avelune.world.id==='alderreach_01'&&!__avelune.state.transition,null,{timeout:5000});await page.keyboard.up(entranceKey);
  assert.deepEqual(await dimensions(page),town);pass('Walking onto the town miniature restores the local town view');
  await leaveTown(page);const save=await page.evaluate(()=>{__avelune.save();return __avelune.state.save});
  await page.reload();await page.waitForFunction(()=>window.__avelune?.state.ready);await page.locator('#continue-game').click();
  assert.equal(await page.evaluate(()=>__avelune.world.id),save.world.scene);assert.equal(await page.evaluate(()=>__avelune.world.area.kind),'overworld');pass('Continue restores a journal saved on the overworld');
  // Later-town fixtures isolate all four gate directions without replaying the campaign.
  const gates=await page.evaluate(()=>{
    for(const event of __avelune.world.layout.events)__avelune.world.flags.add(event.id);
    const towns=Object.values(__avelune.world.layout.areas).filter(a=>a.classicTown);
    return ['north','south','east','west'].map(side=>({side,id:towns.find(a=>a.worldEntranceSide===side)?.id}));
  });
  assert.ok(gates.every(g=>g.id),'The town layouts use all four geographically aligned gate directions');
  for(const gate of gates){
    await page.evaluate(async id=>{await __avelune.visit(id);__avelune.closeDialog()},gate.id);await leaveTown(page);
    const miniature=await page.evaluate(id=>{const w=__avelune.world,node=w.area.mapNodes.find(n=>n.id===id);return{side:node.entranceSide,shore:node.waterfront,expectedShore:w.layout.areas[id].geography?.waterfront||null}},gate.id);
    assert.equal(miniature.side,gate.side);assert.equal(miniature.shore,miniature.expectedShore);
    const key=await page.evaluate(async id=>{const w=__avelune.world,s=w.area.stops.find(s=>s.links.includes('OW_'+id));await __avelune.visit(w.id,s.arrival);const dx=s.at[0]-s.arrival[0],dy=s.at[1]-s.arrival[1];return Math.abs(dx)>Math.abs(dy)?dx>0?'ArrowRight':'ArrowLeft':dy>0?'ArrowDown':'ArrowUp'},gate.id);
    await page.keyboard.down(key);await page.waitForFunction(id=>__avelune.world.id===id&&!__avelune.state.transition,gate.id,{timeout:5000});await page.keyboard.up(key);
    assert.equal(await page.evaluate(()=>__avelune.world.crossedExit()===undefined),true,'Returning through '+gate.side+' gate does not bounce back outside');
    await page.screenshot({path:output+'/town-gate-'+gate.side+'.png'});
  }
  pass('North, south, east and west town gates match their miniatures and allow safe exit/entry round trips');
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});mobile.on('pageerror',e=>errors.push('Mobile: '+e.message));
  await mobile.goto('http://localhost:'+port+'/?test=1');await mobile.waitForFunction(()=>window.__avelune?.state.ready);await mobile.locator('#new-game').click();await mobile.locator('#begin-adventure').click();await mobile.locator('#dialog-content button').click();await leaveTown(mobile);
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const mobileCanvas=await dimensions(mobile);assert.ok(mobileCanvas.width>=352);
  await mobile.screenshot({path:output+'/mobile-overworld.png'});pass('Mobile overworld remains readable with no horizontal overflow');
  assert.deepEqual(errors,[]);pass('No browser JavaScript errors or missing assets');
  await fs.writeFile(output+'/travel-report.json',JSON.stringify({date:new Date().toISOString(),browser:await browser.version(),town,world,results,errors},null,2));
}catch(error){await fs.writeFile(output+'/travel-failure.json',JSON.stringify({message:error.message,stack:error.stack,results,errors},null,2));throw error}finally{await browser?.close();server.kill('SIGTERM')}
