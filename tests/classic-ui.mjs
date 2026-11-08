import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';

// Build first. Keep screenshots outside tracked source by default.
const output=path.resolve(process.env.UI_OUTPUT||'test-results/classic-ui');
const port=Number(process.env.UI_PORT||3108);
await fs.mkdir(output,{recursive:true});
const server=spawn(process.execPath,['tools/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('UI server stopped: '+code)))});
const results=[],errors=[],metrics=[];let browser;
const pass=name=>{results.push({name,status:'passed'});console.log('PASS',name)};
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
function observe(page,label){page.on('pageerror',e=>errors.push(label+': '+e.message));page.on('response',r=>{if(r.status()>=400)errors.push(label+': '+r.status()+' '+r.url())})}
async function bounds(page,label){
 const data=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,panels:[...document.querySelectorAll('#game-shell > :not([hidden]),#dialog:not([hidden]),.battle-window')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.className,left:r.left,right:r.right,width:r.width}})}));
 assert.ok(data.scrollWidth<=data.width,label+' has no page overflow');assert.ok(data.bodyWidth<=data.width,label+' has no body overflow');
 for(const p of data.panels)assert.ok(p.left>=-.1&&p.right<=data.width+.1,label+' panel fits: '+p.id);
 metrics.push({label,...data});
}
async function snapshot(page,label){await settle(page);await bounds(page,label);await page.screenshot({path:path.join(output,label+'.png'),fullPage:label.startsWith('field-')})}
async function checkField(page,width){
 const appearance=await page.evaluate(()=>{
  const style=getComputedStyle(document.querySelector('.field-nav')),name=getComputedStyle(document.querySelector('.mini-name'));
  const nav=document.querySelector('.field-nav').getBoundingClientRect(),party=document.querySelector('.party-strip').getBoundingClientRect();
  return{borderStyle:style.borderTopStyle,borderColor:style.borderTopColor,background:style.backgroundImage,font:name.fontFamily,nav:{left:nav.left,right:nav.right,top:nav.top},party:{left:party.left,right:party.right,top:party.top},text:[...document.querySelectorAll('.party-mini')].map(e=>({hp:e.querySelector('.hp-line span').textContent,magic:e.querySelector('.mp-line span').textContent})),state:__avelune.rpg.party.map(h=>({hp:h.hp+' / '+h.maxHp,magic:h.charges.join(' / ')})),clipping:[...document.querySelectorAll('.mini-name,.hp-line,.mp-line,.field-nav button')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>({class:e.className,text:e.textContent,scroll:e.scrollWidth,width:e.clientWidth}))};
 });
 assert.equal(appearance.borderStyle,'double');assert.ok(appearance.background.includes('gradient'));assert.ok(appearance.font.includes('VT323'));assert.deepEqual(appearance.text,appearance.state);
 if(width>760){assert.ok(appearance.nav.right<appearance.party.left,'Command window left of party table');assert.ok(Math.abs(appearance.nav.top-appearance.party.top)<2)}
 assert.deepEqual(appearance.clipping,[],'Party status and commands do not clip');
 const cursor=await page.locator('#open-party').evaluate(e=>{e.focus();return getComputedStyle(e,'::before').content});assert.ok(['""','none'].includes(cursor),'Arrow is decorative, not spoken text');
 if(width<=600){for(const selector of ['.field-nav button','.town-strip button','#close-dialog']){if(selector==='#close-dialog')continue;const heights=await page.locator(selector).evaluateAll(els=>els.filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().height));assert.ok(heights.every(h=>h>=44),selector+' provides44px touch targets')}}
}
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const [width,height]of[[1440,1000],[1280,900],[390,844],[320,724]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:width<=600,hasTouch:width<=600,reducedMotion:'reduce'});observe(page,width);
  await page.goto('http://localhost:'+port+'/?test=1');await page.waitForFunction(()=>window.__avelune?.state.ready);
  await snapshot(page,'title-'+width);
  await page.locator('#new-game').click();await page.locator('#dialog-content button').click();await settle(page);
  await checkField(page,width);await snapshot(page,'field-'+width);
  pass(width+'px title and exploration use classic windows, readable numeric status and no overflow');

  await page.locator('#open-party').click();assert.equal(await page.locator('.job-card').count(),6);
  const position=await page.evaluate(()=>({x:__avelune.world.x,y:__avelune.world.y}));
  await page.keyboard.press('ArrowDown');await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>({x:__avelune.world.x,y:__avelune.world.y})),position,'Modal input does not move the world');
  assert.notEqual(await page.evaluate(()=>document.activeElement.id),'close-dialog','Arrow keys navigate visible commands');
  if(width<=600){const close=await page.locator('#close-dialog').boundingBox();assert.ok(close.height>=44&&close.width>=44,'Close dialog has44px target')}
  await snapshot(page,'status-'+width);await page.keyboard.press('Escape');assert.equal(await page.locator('#veil').isHidden(),true);

  await page.evaluate(()=>{__avelune.rpg.gold=500;__avelune.syncLocation()});
  await page.getByRole('button',{name:'Item shop',exact:true}).click();await page.waitForFunction(()=>__avelune.state.dialogKind==='town-service',null,{timeout:15000});
  const inventory=await page.evaluate(()=>__avelune.rpg.inventory.potion),gold=await page.evaluate(()=>__avelune.rpg.gold);
  await page.locator('.town-row').filter({has:page.locator('.town-row-info > strong',{hasText:/^Potion ·/})}).getByRole('button',{name:/^Buy/}).click();
  assert.equal(await page.evaluate(()=>__avelune.rpg.inventory.potion),inventory+1);assert.equal(await page.evaluate(()=>__avelune.rpg.gold),gold-25);
  await snapshot(page,'shop-'+width);await page.locator('#close-dialog').click();

  await page.evaluate(()=>{__avelune.rpg.party[1].hp=1;__avelune.syncLocation()});await page.locator('#open-magic').click();await page.getByRole('button',{name:'Iven',exact:true}).click();await snapshot(page,'magic-'+width);
  const charges=await page.evaluate(()=>__avelune.rpg.party[2].charges[0]);await page.getByRole('button',{name:/^Cast on Mara/}).click();assert.ok(await page.evaluate(()=>__avelune.rpg.party[1].hp>1));assert.equal(await page.evaluate(()=>__avelune.rpg.party[2].charges[0]),charges-1);await page.locator('#close-dialog').click();
  pass(width+'px status, merchant purchase and field magic remain functional with modal input isolation');

  await page.evaluate(()=>__avelune.startBattle({name:'Bramble Boar',boss:false,enemies:[{id:'boar',name:'Bramble Boar',hp:60,attack:8,defense:2,speed:5,xp:10,gold:5,sprite:'boar',weakness:'ember'}]}));await settle(page);
  const battle=await page.evaluate(()=>{
   const c=document.querySelector('#battle-canvas'),r=c.getBoundingClientRect(),command=document.querySelector('.battle-command-panel').getBoundingClientRect(),party=document.querySelector('.battle-party').getBoundingClientRect(),win=document.querySelector('.battle-window').getBoundingClientRect();
   return{scaleX:r.width/c.width,scaleY:r.height/c.height,smoothing:c.getContext('2d').imageSmoothingEnabled,command:{left:command.left,right:command.right},party:{left:party.left,right:party.right},window:{top:win.top,bottom:win.bottom},buttons:[...document.querySelectorAll('#battle-options button')].map(e=>e.getBoundingClientRect().height)};
  });
  metrics.push({label:'battle-fit-'+width,height,...battle});assert.ok(battle.window.top>=0&&battle.window.bottom<=height,'Battle window fits the viewport vertically');assert.equal(battle.scaleX,battle.scaleY);assert.equal(battle.scaleX,Math.floor(battle.scaleX));assert.equal(battle.smoothing,false);assert.ok(battle.command.right<=battle.party.left+1,'Battle commands stand beside party status');
  if(width<=600)assert.ok(battle.buttons.every(h=>h>=44),'Battle commands have44px touch targets');
  await snapshot(page,'battle-'+width);await page.locator('#battle-options').getByRole('button',{name:/^Attack/}).click();await page.locator('#battle-options').getByRole('button',{name:/^Bramble Boar/}).click();assert.equal(await page.evaluate(()=>__avelune.battle.commands[0].type),'attack');await page.locator('.battle-hero').first().click();await page.locator('#battle-options').getByRole('button',{name:/^Magic/}).click();await snapshot(page,'battle-spells-'+width);await page.locator('#battle-options').getByRole('button',{name:/^Ember/}).click();await page.locator('#battle-options').getByRole('button',{name:/^Bramble Boar/}).click();assert.equal(await page.evaluate(()=>__avelune.battle.commands[0].type),'spell');
  pass(width+'px battle has classic command/status windows and working target selection');
  await page.close();
 }
 assert.deepEqual(errors,[]);pass('No browser JavaScript errors or failed resources');
 await fs.writeFile(path.join(output,'classic-ui-report.json'),JSON.stringify({date:new Date().toISOString(),browser:await browser.version(),results,errors,metrics},null,2));
}catch(error){await fs.writeFile(path.join(output,'classic-ui-failure.json'),JSON.stringify({message:error.message,stack:error.stack,results,errors,metrics},null,2));throw error}finally{await browser?.close();server.kill('SIGTERM')}
