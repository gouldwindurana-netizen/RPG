import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';

const output=path.resolve(process.env.PARTY_MANA_OUTPUT||'test-results/party-mana');
await fs.mkdir(output,{recursive:true});
const port=Number(process.env.PARTY_MANA_PORT||3109);
const server=spawn(process.execPath,['tools/serve.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port)},stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Party/mana server stopped: '+code)))});
let browser;const results=[],errors=[];
const pass=name=>{results.push({name,status:'passed'});console.log('PASS',name)};
const chosen=['blackmage','blackmage','whitemage','ranger'];

async function boot(width=1440,height=1000,touch=false){
  const page=await browser.newPage({viewport:{width,height},isMobile:touch,hasTouch:touch,reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(width+'px: '+e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
  await page.goto('http://localhost:'+port+'/?test=1');
  await page.waitForFunction(()=>window.__avelune?.state.ready);
  return page;
}
async function chooseParty(page,jobs=chosen){
  await page.locator('#new-game').click();
  await page.waitForFunction(()=>__avelune.state.dialogKind==='party-creation');
  assert.equal(await page.evaluate(()=>__avelune.state.started),false,'Choosing a party does not start the journey');
  for(const [i,job]of jobs.entries()){
    await page.locator('#dialog button[data-hero="'+i+'"]').click();
    await page.locator('#dialog button[data-start-job="'+job+'"]').click();
  }
}
async function begin(page,jobs=chosen){
  await page.locator('#begin-adventure').click();
  await page.waitForFunction(()=>__avelune.state.started&&__avelune.state.ready&&__avelune.state.dialogKind==='notice');
  await page.locator('#dialog-content button').click();
  assert.deepEqual(await page.evaluate(()=>__avelune.rpg.roster.map(h=>h.job)),jobs);
  assert.deepEqual(await page.evaluate(()=>__avelune.rpg.party.map(h=>h.id)),['roadkeeper']);
}
async function checkManaBars(page){
  const values=await page.evaluate(()=>__avelune.rpg.party.map(h=>{
    const card=[...document.querySelectorAll('.party-mini')].find(b=>b.querySelector('[data-mana-for="'+h.id+'"]'));
    const bar=card?.querySelector('.mana-track'),fill=bar?.querySelector('i');
    return{id:h.id,mp:h.mp,maxMp:h.maxMp,text:card?.querySelector('.mp-value')?.textContent,role:bar?.getAttribute('role'),now:bar?.getAttribute('aria-valuenow'),max:bar?.getAttribute('aria-valuemax'),fill:fill?.style.width};
  }));
  for(const value of values){
    assert.equal(value.text,value.mp+' / '+value.maxMp,value.id+' has accurate mana text');
    assert.equal(value.role,'progressbar');assert.equal(Number(value.now),value.mp);assert.equal(Number(value.max),value.maxMp);
    assert.ok(Number.isFinite(parseFloat(value.fill)),value.id+' mana fill is finite');
    assert.ok(Math.abs(parseFloat(value.fill)-(value.maxMp?100*value.mp/value.maxMp:0))<.01,value.id+' mana fill matches available MP');
  }
}
async function visitService(page,type){
  await page.evaluate(async type=>{
    await __avelune.visit('alderreach_01');__avelune.closeDialog();
    const destination=__avelune.townServices().find(s=>s.type===type);if(!destination)throw Error('Missing service '+type);
    if(destination.scene&&destination.scene!==__avelune.world.id)await __avelune.visit(destination.scene);
    const counter=__avelune.townServices().find(s=>s.type===type);if(!counter)throw Error('Missing indoor counter '+type);
    __avelune.servicesUI.open(counter);
  },type);
}
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await boot();
  await chooseParty(page);await page.screenshot({path:path.join(output,'choose-party-desktop.png')});
  assert.equal(await page.locator('#dialog button[data-start-job]').count(),6);
  await begin(page);assert.equal(await page.evaluate(()=>__avelune.rpg.jobsLocked),true);
  await checkManaBars(page);await page.screenshot({path:path.join(output,'party-mana-desktop.png')});
  assert.equal(await page.locator('.party-mini').count(),1);pass('New game fixes all four future jobs but starts with only the Roadkeeper and accurate mana bars');
  await page.evaluate(()=>{for(const id of ['mara','iven','sella'])__avelune.rpg.recruit(id);__avelune.syncLocation()});

  await page.locator('#open-party').click();assert.equal(await page.locator('#dialog [data-start-job],#dialog .job-card,#dialog .town-job-grid').count(),0);
  assert.match(await page.locator('#dialog-content').textContent(),/fixed|permanent|beginning|outset|chosen at/i);
  await page.locator('#close-dialog').click();
  const locked=await page.evaluate(()=>{const before=__avelune.rpg.party.map(h=>h.job),result=__avelune.rpg.assignJob(0,'vanguard');return{before,after:__avelune.rpg.party.map(h=>h.job),ok:result.ok}});
  assert.equal(locked.ok,false);assert.deepEqual(locked.before,locked.after);
  await visitService(page,'guild');
  assert.equal(await page.getByRole('button',{name:'Callings',exact:true}).count(),0);
  assert.equal(await page.locator('.town-job-grid').count(),0);assert.ok(await page.getByRole('button',{name:'Formation',exact:true}).isVisible());
  await page.locator('#close-dialog').click();pass('Status, guild and engine reject job changes after the journey begins');

  await page.evaluate(()=>{__avelune.rpg.party[1].hp=1;__avelune.rpg.party[2].mp=10;__avelune.syncLocation()});
  await page.locator('#open-magic').click();await page.getByRole('button',{name:'Iven',exact:true}).click();
  const cast=await page.evaluate(()=>({before:__avelune.rpg.party[2].mp,cost:__avelune.rpg.spellFor(2,'mend').mpCost}));
  await page.getByRole('button',{name:/^Cast on Mara/}).click();
  assert.equal(await page.evaluate(()=>__avelune.rpg.party[2].mp),cast.before-cast.cost);assert.ok(await page.evaluate(()=>__avelune.rpg.party[1].hp>1));
  await page.locator('#close-dialog').click();await checkManaBars(page);
  await page.evaluate(()=>{const h=__avelune.rpg.party[2];h.mp=__avelune.rpg.spellFor(2,'mend').mpCost-1;__avelune.rpg.party[1].hp=1;__avelune.syncLocation();__avelune.servicesUI.magicField()});
  await page.getByRole('button',{name:'Iven',exact:true}).click();assert.equal(await page.getByRole('button',{name:/^Cast on Mara/}).isDisabled(),true);
  const rejected=await page.evaluate(()=>{const r=__avelune.rpg,before=[r.party[2].mp,r.party[1].hp],result=r.castField(2,'mend',1);return{before,after:[r.party[2].mp,r.party[1].hp],ok:result.ok}});
  assert.equal(rejected.ok,false);assert.deepEqual(rejected.before,rejected.after);await page.locator('#close-dialog').click();
  pass('Field spells spend their shared MP cost and insufficient mana cannot heal or consume resources');

  await page.evaluate(()=>{__avelune.rpg.party[2].mp=0;__avelune.rpg.inventory.ether=1;__avelune.syncLocation()});
  await page.locator('#open-bag').click();await page.locator('.info-line').filter({has:page.locator('strong',{hasText:/^Ether ×/})}).getByRole('button',{name:'Use',exact:true}).click();
  await page.getByRole('button',{name:/^Iven ·/}).click();
  assert.equal(await page.evaluate(()=>__avelune.rpg.party[2].mp),await page.evaluate(()=>Math.min(24,__avelune.rpg.party[2].maxMp)));
  assert.equal(await page.evaluate(()=>__avelune.rpg.inventory.ether),0);await page.locator('#close-dialog').click();await checkManaBars(page);
  await page.evaluate(()=>{__avelune.rpg.gold=500;__avelune.rpg.party[2].mp=1;__avelune.syncLocation()});await visitService(page,'inn');
  await page.getByRole('button',{name:/^Stay the night/}).click();await page.getByRole('button',{name:'Confirm rest',exact:true}).click();await page.waitForFunction(()=>!__avelune.state.dialogKind);
  assert.equal(await page.evaluate(()=>__avelune.rpg.party[2].mp),await page.evaluate(()=>__avelune.rpg.party[2].maxMp));assert.equal(await page.evaluate(()=>__avelune.rpg.gold),489);await checkManaBars(page);
  pass('Ether restores up to24 MP and a paid inn refills mana without exceeding its maximum');

  await page.evaluate(()=>{__avelune.rpg.party[2].mp=7;__avelune.syncLocation();__avelune.save()});
  await page.locator('#open-menu').click();await page.getByRole('button',{name:'Return to title',exact:true}).click();
  const journal=await page.evaluate(()=>localStorage.getItem('avelune-rpg-v2'));
  await chooseParty(page,['vanguard','monk','ranger','monk']);await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>localStorage.getItem('avelune-rpg-v2')),journal,'Canceling party creation preserves the existing journal');
  await page.reload();await page.waitForFunction(()=>window.__avelune?.state.ready);await page.locator('#continue-game').click();
  assert.deepEqual(await page.evaluate(()=>__avelune.rpg.roster.map(h=>h.job)),chosen);assert.equal(await page.evaluate(()=>__avelune.rpg.party[2].mp),7);assert.equal(await page.evaluate(()=>__avelune.rpg.assignJob(0,'vanguard').ok),false);await checkManaBars(page);
  pass('Canceling a new party preserves the journal; Continue retains permanent jobs and remaining MP');

  await page.evaluate(()=>{__avelune.rpg.party[0].mp=6;__avelune.startBattle({name:'Mana verification',boss:false,enemies:[{id:'mana-boar',name:'Mana Boar',hp:500,attack:1,defense:1,speed:1,xp:0,gold:0,sprite:'boar',weakness:'ember'}]});__avelune.battle.reduce=true});
  const battleBefore=await page.evaluate(()=>({mp:__avelune.rpg.party[0].mp,cost:__avelune.rpg.spellFor(0,'spark').mpCost}));
  await page.locator('#battle-options').getByRole('button',{name:/^Magic/}).click();await page.locator('#battle-options').getByRole('button',{name:/^Ember I ·/}).click();await page.locator('#battle-options').getByRole('button',{name:/^Mana Boar/}).click();
  while(await page.evaluate(()=>__avelune.battle.phase==='command'))await page.locator('#battle-options').getByRole('button',{name:/^Guard/}).click();
  await page.locator('#battle-options').getByRole('button',{name:/Resolve round/}).click();await page.waitForFunction(()=>__avelune.battle.phase!=='resolving');
  assert.equal(await page.evaluate(()=>__avelune.rpg.party[0].mp),battleBefore.mp-battleBefore.cost);
  assert.match(await page.locator('.battle-hero').first().locator('.battle-mana').textContent(),new RegExp('MP '+(battleBefore.mp-battleBefore.cost)+' / '));
  await page.locator('#battle-options').getByRole('button',{name:/^Magic/}).click();assert.equal(await page.locator('#battle-options').getByRole('button',{name:/^Ember I ·/}).isDisabled(),true);
  await page.screenshot({path:path.join(output,'battle-mana.png')});pass('Battle spells spend MP once on resolution and low mana disables an unaffordable spell');
  await page.close();

  for(const width of [390,320]){
    const mobile=await boot(width,844,true);await chooseParty(mobile);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await mobile.screenshot({path:path.join(output,'choose-party-'+width+'.png')});await begin(mobile);await checkManaBars(mobile);
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await mobile.screenshot({path:path.join(output,'party-mana-'+width+'.png')});await mobile.close();
  }
  pass('390px and320px touch layouts show complete party selection and accurate mana bars without overflow');

  const physical=await boot(390,844,true);const physicalJobs=['vanguard','monk','ranger','monk'];await chooseParty(physical,physicalJobs);await begin(physical,physicalJobs);
  assert.ok(await physical.evaluate(()=>__avelune.rpg.party.every(h=>h.maxMp===0&&h.mp===0)));await checkManaBars(physical);
  await physical.locator('#open-magic').click();assert.match(await physical.locator('#dialog-content').textContent(),/no prepared field spells|does not use magic/i);
  assert.equal(await physical.locator('#dialog [data-start-job]').count(),0);await physical.close();pass('A fully physical starting party remains valid with zero, finite mana bars and no retraining shortcut');
  assert.deepEqual(errors,[]);pass('No browser JavaScript errors or missing assets');
  await fs.writeFile(path.join(output,'party-mana-report.json'),JSON.stringify({date:new Date().toISOString(),browser:await browser.version(),results,errors},null,2));
}catch(error){await fs.writeFile(path.join(output,'party-mana-failure.json'),JSON.stringify({message:error.message,stack:error.stack,results,errors},null,2));throw error}
finally{await browser?.close();server.kill('SIGTERM')}
