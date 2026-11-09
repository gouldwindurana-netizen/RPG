import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';

// Build first. Screenshots and reports stay outside shipped game files.
const output=path.resolve(process.env.MENU_OUTPUT||'test-results/menu-disclosure');
const port=Number(process.env.MENU_PORT||3132);
await fs.mkdir(output,{recursive:true});
const server=spawn(process.execPath,['tools/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Menu server stopped: '+code)))});
const results=[],errors=[],metrics=[];let browser,activePage;
const pass=name=>{results.push({name,status:'passed'});console.log('PASS',name)};
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const kind=page=>page.evaluate(()=>__avelune.state.dialogKind);

async function uniquePanels(page){
  for(const id of ['field-window-storage','field-commands','party-strip','town-strip','open-commands','open-roster'])assert.equal(await page.locator('#'+id).count(),1,id+' has one live DOM node');
}
async function collapsed(page,label){
  assert.equal(await kind(page),'',label+' returns to the road');
  assert.equal(await page.locator('#veil').isVisible(),false);
  for(const id of ['field-commands','party-strip','town-strip'])assert.equal(await page.locator('#'+id).isVisible(),false,label+' hides '+id);
  for(const id of ['open-commands','open-roster']){
    assert.equal(await page.locator('#'+id).isVisible(),true);
    assert.equal(await page.locator('#'+id).getAttribute('aria-expanded'),'false');
  }
  await uniquePanels(page);
}
async function fit(page,label){
  const data=await page.evaluate(()=>{
    const dialog=document.querySelector('#dialog'),visible=!document.querySelector('#veil').hidden,r=dialog.getBoundingClientRect();
    return{width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,dialog:visible?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,scrollWidth:dialog.scrollWidth,clientWidth:dialog.clientWidth}:null,
      clipped:[...document.querySelectorAll('#dialog .mini-name,#dialog .mini-job,#dialog .hp-line,#dialog .mp-line,#dialog .field-nav button')].filter(e=>e.getClientRects().length&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)};
  });
  assert.ok(data.documentWidth<=data.width&&data.bodyWidth<=data.width,label+' has no page overflow');
  if(data.dialog){const d=data.dialog;assert.ok(d.left>=0&&d.right<=data.width+.5&&d.top>=0&&d.bottom<=data.height+.5,label+' dialog fits viewport');assert.ok(d.scrollWidth<=d.clientWidth+1,label+' dialog has no sideways scroll')}
  assert.deepEqual(data.clipped,[],label+' readable labels and status values');metrics.push({label,...data});
}
async function capture(page,label){await settle(page);await fit(page,label);await page.screenshot({path:path.join(output,label+'.png')})}
async function close(page){await page.keyboard.press('Escape');await settle(page);await collapsed(page,'Closing window')}
async function commands(page,keyboard=false){
  if(keyboard)await page.keyboard.press('c');else if(page.viewportSize().width<=600)await page.locator('#open-commands').tap();else await page.locator('#open-commands').click();
  await page.waitForFunction(()=>__avelune.state.dialogKind==='commands');
  assert.equal(await page.locator('#open-commands').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#open-roster').getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('#field-commands').isVisible(),true);
  assert.equal(await page.locator('#party-strip').isVisible(),false);
  await uniquePanels(page);
}
async function roster(page,keyboard=false){
  if(keyboard)await page.keyboard.press('p');else if(page.viewportSize().width<=600)await page.locator('#open-roster').tap();else await page.locator('#open-roster').click();
  await page.waitForFunction(()=>__avelune.state.dialogKind==='party-overview');
  assert.equal(await page.locator('#open-roster').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#open-commands').getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('#party-strip').isVisible(),true);
  assert.equal(await page.locator('#field-commands').isVisible(),false);
  const expected=await page.evaluate(()=>__avelune.rpg.party.map(h=>({id:h.id,hp:h.hp+' / '+h.maxHp,mp:h.mp+' / '+h.maxMp,now:h.mp,max:h.maxMp})));
  const actual=await page.locator('#dialog .party-mini').evaluateAll(cards=>cards.map(e=>{const bar=e.querySelector('.mana-track');return{id:bar.dataset.manaFor,hp:e.querySelector('.hp-line span').textContent,mp:e.querySelector('.mp-value').textContent,now:Number(bar.getAttribute('aria-valuenow')),max:Number(bar.getAttribute('aria-valuemax'))}}));
  assert.deepEqual(actual,expected,'Opened Characters window shows current recruited party and live HP/MP');
  for(const card of await page.locator('#dialog .party-mini').all()){assert.equal(await card.isVisible(),true);assert.equal(await card.locator('.mini-level').isVisible(),true,'Opened character cards retain levels even on a narrow phone')}
  await uniquePanels(page);
}
async function tabTrap(page){
  const first=page.locator('#close-dialog');await first.focus();await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>document.querySelector('#dialog').contains(document.activeElement)),true,'Reverse Tab stays inside modal');
  await page.keyboard.press('Tab');assert.equal(await first.evaluate(e=>e===document.activeElement),true,'Tab wraps to first modal control');
}
async function start(page){
  await page.goto('http://localhost:'+port+'/?test=1');await page.waitForFunction(()=>window.__avelune?.state.ready);
  await page.locator('#new-game').click();await page.locator('#begin-adventure').click();
  await page.waitForFunction(()=>__avelune.state.dialogKind==='notice');await page.locator('#dialog-content button').click();
  await settle(page);assert.deepEqual(await page.evaluate(()=>__avelune.rpg.party.map(h=>h.id)),['roadkeeper']);
}
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const [width,height]of [[1440,1000],[390,844],[320,724]]){
    const page=activePage=await browser.newPage({viewport:{width,height},isMobile:width<=600,hasTouch:width<=600,reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(width+'px: '+e.message));page.on('response',r=>{if(r.status()>=400)errors.push(width+'px: '+r.status()+' '+r.url())});
    await start(page);await collapsed(page,'New solo journey');await capture(page,'field-solo-'+width);
    await commands(page,true);assert.equal(await page.locator('#town-strip').isVisible(),true);await tabTrap(page);await capture(page,'commands-'+width);
    await page.locator('#open-party').click();await page.waitForFunction(()=>__avelune.state.dialogKind==='party-overview');
    assert.equal(await page.locator('#dialog .party-mini').count(),1,'Command → Characters shows only the recruited hero');
    await page.locator('#dialog .party-mini').click();await page.waitForFunction(()=>__avelune.state.dialogKind==='party');
    assert.equal(await page.locator('#dialog-title').textContent(),'Roadkeeper');assert.equal(await page.locator('.job-card').count(),0);
    assert.equal(await page.evaluate(()=>__avelune.rpg.assignJob(0,'ranger').ok),false,'Character settings cannot change a permanent job');
    await capture(page,'character-settings-'+width);await close(page);
    assert.equal(await page.locator('#open-commands').evaluate(e=>e===document.activeElement),true,'Closing nested Commands restores visible Command focus');
    await roster(page,true);await capture(page,'characters-solo-'+width);await close(page);
    assert.equal(await page.locator('#open-roster').evaluate(e=>e===document.activeElement),true,'Closing keyboard Characters restores visible Characters focus');

    await page.evaluate(()=>{for(const id of ['mara','iven','sella'])__avelune.rpg.recruit(id);__avelune.rpg.party[1].hp=1;__avelune.syncLocation()});
    await collapsed(page,'Recruitment update');await roster(page);assert.equal(await page.locator('#dialog .party-mini').count(),4);await capture(page,'characters-full-'+width);
    await page.locator('#dialog .party-mini').nth(2).click();await page.waitForFunction(()=>__avelune.state.dialogKind==='party');
    assert.equal(await page.locator('#dialog-title').textContent(),'Iven');assert.ok(await page.getByRole('button',{name:/^Equip weapons and armor/}).isVisible());
    await page.getByRole('button',{name:'← Party overview',exact:true}).click();assert.equal(await kind(page),'party-overview');assert.equal(await page.locator('#dialog .party-mini').count(),4);await uniquePanels(page);
    await close(page);
    await commands(page);await page.locator('#open-magic').click();await page.getByRole('button',{name:'Iven',exact:true}).click();
    const before=await page.evaluate(()=>({mp:__avelune.rpg.party[2].mp,cost:__avelune.rpg.spellFor(2,'mend').mpCost}));
    await page.getByRole('button',{name:/^Cast on Mara/}).click();assert.ok(await page.evaluate(()=>__avelune.rpg.party[1].hp>1));
    assert.equal(await page.evaluate(()=>__avelune.rpg.party[2].mp),before.mp-before.cost);await close(page);await roster(page);await capture(page,'characters-healed-'+width);await close(page);
    pass(width+'px Command and Characters open on demand; nested character settings preserve fixed jobs and current HP/MP');

    await commands(page);await page.locator('#open-bag').click();assert.equal(await page.locator('#field-commands').isVisible(),false);assert.equal(await page.locator('#party-strip').isVisible(),false);await close(page);
    for(const [key,expected]of [['i','bag'],['m','atlas'],['f','field-magic']]){await commands(page,true);await page.keyboard.press(key);assert.equal(await kind(page),expected,'Command advertises a working '+key.toUpperCase()+' shortcut');await close(page)}
    await commands(page,true);await page.keyboard.press('c');await collapsed(page,'C toggles Command');await roster(page,true);await page.keyboard.press('p');await collapsed(page,'P toggles Characters');
    await commands(page);await page.locator('#veil').click({position:{x:2,y:2}});await collapsed(page,'Backdrop dismissal');
    for(let i=0;i<3;i++){await commands(page);await close(page);await roster(page);await close(page)}
    if(width<=600){
      await commands(page);
      const targets=await page.locator('#dialog button:not(:disabled)').evaluateAll(els=>els.filter(e=>e.getClientRects().length).map(e=>({label:e.textContent,height:e.getBoundingClientRect().height})));
      assert.ok(targets.length>6&&targets.every(t=>t.height>=44),'Mobile window controls have 44px touch targets');await close(page);
      for(const id of ['open-commands','open-roster'])assert.ok((await page.locator('#'+id).boundingBox()).height>=44,'Mobile '+id+' has a 44px target');
    }
    pass(width+'px repeated opening, closing and switching windows keeps one copy of every panel without overflow');

    // Pick an actual open direction from the current town position, avoiding a collision-dependent test.
    const motion=await page.evaluate(()=>{
      const w=__avelune.world,candidates=[['ArrowRight',12,0],['ArrowLeft',-12,0],['ArrowDown',0,12],['ArrowUp',0,-12]];
      const next=candidates.find(([,dx,dy])=>w.canStand(w.x+dx,w.y+dy));if(!next)throw Error('No nearby open walking direction');
      return{key:next[0],x:w.x,y:w.y};
    });
    await commands(page);await page.keyboard.down(motion.key);await page.waitForTimeout(180);await page.keyboard.up(motion.key);
    assert.deepEqual(await page.evaluate(()=>({x:__avelune.world.x,y:__avelune.world.y})),{x:motion.x,y:motion.y},'Menus pause walking input');
    await close(page);await page.keyboard.down(motion.key);await page.waitForTimeout(160);await page.keyboard.up(motion.key);
    assert.ok(await page.evaluate(p=>Math.hypot(__avelune.world.x-p.x,__avelune.world.y-p.y)>1,motion),'Walking resumes after closing a window');
    await page.evaluate(()=>__avelune.save());await page.reload();await page.waitForFunction(()=>window.__avelune?.state.ready);await page.locator('#continue-game').click();await collapsed(page,'Continue');
    pass(width+'px closing menus resumes movement and Continue starts with all optional panels closed');

    await page.evaluate(async()=>{await __avelune.visit('alderreach_02');__avelune.closeDialog()});await collapsed(page,'Hostile road');
    await commands(page);assert.equal(await page.locator('#open-services').isDisabled(),true);assert.equal(await page.locator('#town-strip').isVisible(),false);await page.keyboard.press('h');assert.equal(await kind(page),'commands','Disabled Town shortcut cannot open a remote service');await close(page);
    await roster(page);
    await page.evaluate(()=>__avelune.startBattle({name:'Bramble Boar',boss:false,enemies:[{id:'boar',name:'Bramble Boar',hp:60,attack:8,defense:2,speed:5,xp:10,gold:5,sprite:'boar',weakness:'ember'}]}));await settle(page);
    assert.equal(await page.locator('#veil').isVisible(),false);assert.equal(await page.locator('#party-strip').isVisible(),false);assert.equal(await page.locator('#field-commands').isVisible(),false);assert.equal(await page.locator('.battle-party').isVisible(),true);
    for(const id of ['open-commands','open-roster'])assert.equal(await page.locator('#'+id).getAttribute('aria-expanded'),'false');
    await page.keyboard.press('c');assert.equal(await kind(page),'','Field shortcuts do not cover battle');await uniquePanels(page);await capture(page,'battle-'+width);
    pass(width+'px town shortcuts follow location and battle keeps its own party status while field windows close');
    await page.close();
  }
  assert.deepEqual(errors,[]);pass('No browser exceptions or failed game resources');
  await fs.writeFile(path.join(output,'menu-disclosure-report.json'),JSON.stringify({date:new Date().toISOString(),browser:await browser.version(),results,errors,metrics},null,2));
}catch(error){await activePage?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});await fs.writeFile(path.join(output,'menu-disclosure-failure.json'),JSON.stringify({message:error.message,stack:error.stack,results,errors,metrics},null,2));throw error}finally{await browser?.close();server.kill('SIGTERM')}
