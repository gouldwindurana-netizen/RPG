/* Battle presentation only. Engine and world state remain outside this class.
 * new AveluneBattleUI(rpg, {onEnd, onSound}); start(spec).
 * onEnd receives {outcome, rewards:{xp,gold}, summary, spec} after dismissal.
 * The UI owns finishBattle(), exactly once per encounter. Replace .rpg after load.
 */
class AveluneBattleUI {
  constructor(rpg, {onEnd = () => {}, onSound = () => {}} = {}) {
    this.rpg = rpg;
    this.onEnd = onEnd;
    this.onSound = onSound;
    this.root = document.getElementById('battle-screen');
    this.active = false;
    this.images = new Map();
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.fast = false;
    this.frameId = 0;
    this.token = 0;
    this.keyHandler = event => this.key(event);
    window.addEventListener('keydown', this.keyHandler, true);
  }

  node(tag, text, cls) {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }

  button(label, action, note = '', disabled = false) {
    const el = this.node('button', null, 'battle-option');
    el.type = 'button';
    el.append(this.node('span', label, 'battle-option-name'));
    if (note) el.append(this.node('small', note));
    el.disabled = disabled;
    el.addEventListener('click', action);
    return el;
  }

  start(spec) {
    if (this.active) return false;
    const start = this.rpg.startBattle(spec);
    if (!this.rpg.battle || start?.ok === false) return false;
    this.spec = spec;
    this.encounter = this.rpg.battle;
    this.active = true;
    this.token++;
    this.commands = this.rpg.party.map(() => null);
    this.actor = this.rpg.party.findIndex(hero => hero.hp > 0);
    this.phase = 'command';
    this.menu = 'main';
    this.pending = null;
    this.summary = null;
    this.displayParty = null; this.displayEnemies = null;
    this.logs = [{text: spec.boss ? 'A guardian stands across the road.' : 'Your party readies for battle.', kind:'intro'}];
    this.selectedEnemy = -1;
    this.highlight = null;
    this.focusBefore = document.activeElement;
    this.root.hidden = false;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Turn-based battle');
    this.root.innerHTML = '<div class="battle-window"><header class="battle-header"><div><p class="battle-eyebrow" id="battle-type"></p><h2 id="battle-name"></h2></div><div class="battle-round"><span id="battle-round-label"></span><button type="button" id="battle-speed" aria-label="Toggle battle animation speed">1× speed</button></div></header><div class="battle-stage"><canvas id="battle-canvas" width="640" height="236" aria-label="Enemies stand on the left and your party on the right"></canvas><div class="battle-encounter-tag" id="battle-intent"></div><div class="battle-enemy-list" id="battle-enemy-list"></div></div><div class="battle-party" id="battle-party"></div><div class="battle-bottom"><section class="battle-command-panel" aria-labelledby="battle-command-title"><div class="battle-panel-heading"><div><p id="battle-command-eyebrow"></p><h3 id="battle-command-title"></h3></div><button type="button" id="battle-back" aria-label="Go back or undo last command">← Back</button></div><div id="battle-options"></div></section><section class="battle-log-panel" aria-labelledby="battle-log-title"><p class="battle-eyebrow" id="battle-log-title">FIELD CHRONICLE</p><div id="battle-log" role="log" aria-live="polite" aria-relevant="additions text"></div><p class="battle-controls">Choose every order, then resolve the round.</p></section></div></div>';
    this.canvas = this.root.querySelector('#battle-canvas');
    this.ctx = this.canvas.getContext('2d', {alpha:false});
    this.ctx.imageSmoothingEnabled = false;
    this.el('battle-speed').addEventListener('click', () => {
      this.fast = !this.fast;
      this.el('battle-speed').textContent = this.fast ? '2× speed' : '1× speed';
    });
    this.el('battle-speed').textContent = this.fast ? '2× speed' : '1× speed';
    this.el('battle-back').addEventListener('click', () => this.back());
    this.loadImages();
    this.render();
    this.onSound('battle');
    const animate = time => {
      if (!this.active) return;
      this.draw(time);
      this.frameId = requestAnimationFrame(animate);
    };
    this.frameId = requestAnimationFrame(animate);
    return true;
  }

  el(id) { return this.root.querySelector('#' + id); }

  loadImages() {
    if (typeof ART !== 'undefined' && ART.landscape && !this.images.has('landscape')) {
      const landscape = new Image();
      landscape.src = ART.landscape;
      this.images.set('landscape',landscape);
    }
    for (const hero of this.rpg.party) {
      const id = hero.id === 'keeper' ? 'roadkeeper' : hero.id;
      const url = typeof ART !== 'undefined' && ART.heroes ? ART.heroes[id] : null;
      if (!url || this.images.has(id)) continue;
      const img = new Image();
      img.src = url;
      this.images.set(id, img);
    }
  }

  alive() { return this.rpg.party.map((hero,index) => hero.hp > 0 ? index : -1).filter(index => index >= 0); }
  enemies() { return this.displayEnemies ?? this.encounter?.enemies ?? []; }
  spell(id) { return typeof AVELUNE_SPELLS !== 'undefined' ? AVELUNE_SPELLS[id] : null; }
  item(id) { return typeof AVELUNE_ITEMS !== 'undefined' ? AVELUNE_ITEMS[id] : null; }

  commandName(command) {
    if (!command) return 'Awaiting order';
    if (command.type === 'spell') return this.spell(command.spell)?.name ?? command.spell;
    if (command.type === 'item') return this.item(command.item)?.name ?? command.item;
    return {attack:'Attack', guard:'Guard', flee:'Retreat'}[command.type] ?? command.type;
  }

  queue(command) {
    if (this.phase !== 'command' || this.actor < 0) return;
    this.commands[this.actor] = command;
    this.pending = null;
    this.menu = 'main';
    this.actor = this.rpg.party.findIndex((hero,index) => hero.hp > 0 && !this.commands[index]);
    if (this.actor < 0) this.phase = 'ready';
    this.onSound('select');
    this.render();
  }

  edit(index) {
    if (!['command', 'ready'].includes(this.phase) || this.rpg.party[index].hp <= 0) return;
    this.actor = index;
    this.commands[index] = null;
    this.phase = 'command';
    this.menu = 'main';
    this.pending = null;
    this.render();
  }

  back() {
    if (!this.active || !['command','ready'].includes(this.phase)) return;
    if (this.menu !== 'main') {
      this.menu = this.pending?.type === 'spell' ? 'magic' : this.pending?.type === 'item' ? 'items' : 'main';
      this.pending = null;
      this.render();
      return;
    }
    for (let index = this.commands.length - 1; index >= 0; index--) {
      if (this.commands[index]) { this.edit(index); return; }
    }
  }

  target(command) {
    let target = 'enemy';
    if (command.type === 'spell') target = this.spell(command.spell)?.target ?? 'enemy';
    if (command.type === 'item') target = 'ally';
    if (target === 'allEnemies' || target === 'allAllies') {
      this.queue({...command, target:0});
      return;
    }
    this.pending = {...command};
    this.targetSide = target === 'ally' ? 'party' : 'enemy';
    this.menu = 'target';
    this.render();
  }

  chooseTarget(index) {
    if (this.phase !== 'command' || this.menu !== 'target') return;
    this.queue({...this.pending, target:index});
  }

  render() {
    if (!this.active) return;
    const result = this.phase === 'result';
    this.el('battle-type').textContent = result ? 'THE ROAD CONTINUES' : this.spec.boss ? 'GUARDIAN ENCOUNTER' : 'WILDERNESS ENCOUNTER';
    this.el('battle-name').textContent = result ? {victory:'Victory',defeat:'A light still burns',fled:'A narrow escape'}[this.summary?.outcome] ?? 'The battle ends' : this.spec.name ?? 'An unexpected encounter';
    this.el('battle-round-label').textContent = 'ROUND ' + (this.encounter?.round ?? 1);
    const heavy = this.enemies().filter(enemy => enemy.hp > 0 && /heavy|gather|charge/i.test(enemy.intent ?? ''));
    this.el('battle-intent').textContent = result ? '' : heavy.length ? '⚠ Power gathers · Guard against the next strike' : this.spec.boss ? 'A guardian blocks the way. Escape is impossible.' : 'Victory opens the road. Retreat is possible.';
    this.el('battle-intent').classList.toggle('battle-danger', heavy.length > 0);
    this.renderEnemyList();
    this.renderParty();
    this.renderCommands();
    this.renderLog();
  }

  renderEnemyList() {
    const list = this.el('battle-enemy-list');
    list.replaceChildren();
    this.enemies().forEach((enemy, index) => {
      const card = this.node('button', null, 'battle-enemy' + (enemy.hp <= 0 ? ' fallen' : ''));
      card.type = 'button';
      card.disabled = enemy.hp <= 0;
      card.setAttribute('aria-label', enemy.name + ', ' + Math.max(0,enemy.hp) + ' health, weak to ' + (enemy.weakness || 'no known element'));
      card.append(this.node('strong', enemy.name), this.node('small', enemy.hp <= 0 ? 'Defeated' : (enemy.weakness ? 'Weak: ' + enemy.weakness : 'No known weakness')));
      const meter = this.node('span', null, 'battle-enemy-hp');
      const fill = this.node('span');
      fill.style.width = Math.max(0,Math.min(100,enemy.hp/(enemy.maxHp || enemy.hp || 1)*100)) + '%';
      meter.append(fill);
      card.append(meter);
      card.addEventListener('mouseenter', () => { this.selectedEnemy = index; });
      card.addEventListener('mouseleave', () => { this.selectedEnemy = -1; });
      card.addEventListener('focus', () => { this.selectedEnemy = index; });
      card.addEventListener('blur', () => { this.selectedEnemy = -1; });
      card.addEventListener('click', () => {
        if (this.menu === 'target' && this.targetSide === 'enemy') this.chooseTarget(index);
        else if (this.phase === 'command' && this.menu === 'main') this.queue({type:'attack',target:index});
      });
      list.append(card);
    });
  }

  renderParty() {
    const list = this.el('battle-party');
    list.replaceChildren();
    (this.displayParty ?? this.rpg.party).forEach((hero,index) => {
      const current = this.phase === 'command' && index === this.actor;
      const card = this.node('button', null, 'battle-hero' + (current ? ' current' : '') + (hero.hp <= 0 ? ' fallen' : '') + (this.commands[index] ? ' ordered' : ''));
      card.type = 'button';
      card.disabled = !['command','ready'].includes(this.phase);
      card.setAttribute('aria-label', hero.name + ', ' + hero.hp + ' of ' + hero.maxHp + ' health. ' + this.commandName(this.commands[index]));
      const head = this.node('span', null, 'battle-hero-head');
      head.append(this.node('strong',hero.name), this.node('small','Lv. ' + hero.level));
      card.append(head, this.node('span', hero.role ?? hero.job ?? '', 'battle-hero-job'));
      const hp = this.node('span', null, 'battle-hero-life');
      hp.append(this.node('span','HP'),this.node('b',Math.max(0,hero.hp) + ' / ' + hero.maxHp));
      const track = this.node('span', null, 'battle-hp-track' + (hero.hp / hero.maxHp < .3 ? ' low' : ''));
      const fill = this.node('span');
      fill.style.width = Math.max(0,Math.min(100,hero.hp/hero.maxHp*100)) + '%';
      track.append(fill);
      const charges = hero.charges ?? [0,0];
      card.append(hp,track,this.node('span','I ' + charges[0] + '   /   II ' + charges[1], 'battle-charges'),this.node('span',hero.hp <= 0 ? 'Fallen' : this.commandName(this.commands[index]),'battle-order'));
      card.addEventListener('click', () => {
        if (this.menu === 'target' && this.targetSide === 'party') {
          if (this.validAllyTarget(hero)) this.chooseTarget(index);
        } else this.edit(index);
      });
      list.append(card);
    });
  }

  validAllyTarget(hero) {
    const revive = this.pending?.item === 'revive' || (this.pending?.spell && this.spell(this.pending.spell)?.kind === 'revive');
    return revive ? hero.hp <= 0 : hero.hp > 0;
  }

  renderCommands() {
    const list = this.el('battle-options');
    const title = this.el('battle-command-title');
    const eyebrow = this.el('battle-command-eyebrow');
    const back = this.el('battle-back');
    list.replaceChildren();
    list.className = 'battle-options';
    back.hidden = !['command','ready'].includes(this.phase) || (this.menu === 'main' && !this.commands.some(Boolean));
    if (this.phase === 'resolving') {
      eyebrow.textContent = 'ORDERS COMMITTED';
      title.textContent = 'The round unfolds…';
      list.append(this.node('p','Your party acts in initiative order. Watch the chronicle for damage, healing, and enemy intent.','battle-hint'));
      return;
    }
    if (this.phase === 'result') {
      this.renderResult(list, title, eyebrow);
      return;
    }
    if (this.phase === 'ready') {
      eyebrow.textContent = 'ALL ORDERS READY';
      title.textContent = 'Make your stand';
      list.append(this.node('p','Orders can be changed by selecting a party member.','battle-hint'));
      const go = this.button('Resolve round  →', () => this.resolve(), 'Your orders and enemy actions will unfold together.');
      go.classList.add('battle-primary');
      list.append(go);
      this.focusOption();
      return;
    }
    const hero = this.rpg.party[this.actor];
    eyebrow.textContent = 'CHOOSE AN ORDER · ' + (this.actor + 1) + ' / ' + this.rpg.party.length;
    title.textContent = hero?.name ?? 'Your party';
    if (this.menu === 'main') {
      list.classList.add('battle-main-commands');
      list.append(
        this.button('Attack', () => this.target({type:'attack'}), 'Strike one enemy'),
        this.button('Magic', () => { this.menu = 'magic'; this.render(); }, 'Use a spell charge', !hero?.spells?.length),
        this.button('Guard', () => this.queue({type:'guard'}), 'Reduce incoming damage'),
        this.button('Item', () => { this.menu = 'items'; this.render(); }, 'Aid an ally'),
      );
      const retreat = this.button('Retreat', () => { this.menu = 'flee'; this.render(); }, this.spec.boss ? 'Guardians seal the road' : 'The whole party attempts escape', this.spec.boss);
      retreat.classList.add('battle-retreat');
      list.append(retreat);
    } else if (this.menu === 'magic') {
      eyebrow.textContent = 'MAGIC · CHARGES I ' + (hero.charges?.[0] ?? 0) + ' / II ' + (hero.charges?.[1] ?? 0);
      for (const id of hero.spells ?? []) {
        const spell = this.spell(id);
        if (!spell) continue;
        const unlocked = !spell.level || hero.level >= spell.level;
        list.append(this.button(spell.name + ' · ' + (spell.tier === 2 ? 'II' : 'I'), () => this.target({type:'spell',spell:id}), spell.description || spell.element || spell.kind, !unlocked || (hero.charges?.[spell.tier - 1] ?? 0) <= 0));
      }
    } else if (this.menu === 'items') {
      eyebrow.textContent = 'SATCHEL · SHARED BY THE PARTY';
      for (const id of ['potion','ether','revive']) {
        const item = this.item(id);
        const reserved = this.commands.filter(command => command?.type === 'item' && command.item === id).length;
        const available = Math.max(0,(this.rpg.inventory[id] ?? 0) - reserved);
        list.append(this.button((item?.name ?? {potion:'Potion',ether:'Ether',revive:'Phoenix salve'}[id]) + ' ×' + available, () => this.target({type:'item',item:id}), item?.description ?? {potion:'Restore an ally’s health.',ether:'Restore an ally’s spell charges.',revive:'Return a fallen ally to battle.'}[id], available <= 0));
      }
    } else if (this.menu === 'target') {
      const label = this.commandName(this.pending);
      eyebrow.textContent = label.toUpperCase() + ' · CHOOSE A TARGET';
      const targets = this.targetSide === 'party' ? this.rpg.party : this.enemies();
      targets.forEach((target,index) => {
        const valid = this.targetSide === 'party' ? this.validAllyTarget(target) : target.hp > 0;
        if (!valid) return;
        const note = 'HP ' + Math.max(0,target.hp) + '/' + (target.maxHp || target.hp) + (this.targetSide === 'enemy' && target.weakness ? ' · Weak: ' + target.weakness : '');
        const button = this.button(target.name, () => this.chooseTarget(index), note);
        if (this.targetSide === 'enemy') {
          button.addEventListener('focus', () => { this.selectedEnemy = index; });
          button.addEventListener('mouseenter', () => { this.selectedEnemy = index; });
        }
        list.append(button);
      });
      if (!list.children.length) list.append(this.node('p','There is no valid target for this action. Choose Back to select a different order.','battle-hint'));
    } else if (this.menu === 'flee') {
      eyebrow.textContent = 'PARTY ORDER';
      title.textContent = 'Leave this battle?';
      list.append(this.node('p','Everyone will attempt to escape. If the attempt fails, the enemies still take their turn.','battle-hint'));
      list.append(this.button('Attempt escape', () => {
        this.commands = this.rpg.party.map(hero => hero.hp > 0 ? {type:'flee'} : null);
        this.resolve();
      }, 'Uses this round for the entire party'));
    }
    this.focusOption();
  }

  focusOption() {
    queueMicrotask(() => {
      if (!this.active || this.phase === 'resolving') return;
      const target = this.el('battle-options')?.querySelector('button:not(:disabled)') ?? this.el('battle-back');
      if (target && !target.hidden) target.focus({preventScroll:true});
    });
  }

  renderLog() {
    const log = this.el('battle-log');
    log.replaceChildren();
    for (const event of this.logs.slice(-5)) {
      log.append(this.node('p',event.text,'battle-log-line ' + (event.kind || '')));
    }
    log.scrollTop = log.scrollHeight;
  }

  async resolve() {
    if (!this.active || !['ready','command'].includes(this.phase)) return;
    if (this.alive().some(index => !this.commands[index])) return;
    this.phase = 'resolving';
    this.menu = 'main';
    this.selectedEnemy = -1;
    const run = this.token;
    this.displayParty = this.rpg.party.map(hero => ({...hero, charges:[...hero.charges]}));
    this.displayEnemies = this.encounter.enemies.map(enemy => ({...enemy}));
    const round = this.rpg.resolveRound(this.commands.map(command => command ?? {type:'guard'}));
    this.encounter = this.rpg.battle ?? this.encounter;
    this.render();
    for (const event of round.events ?? []) {
      if (!this.active || run !== this.token) return;
      this.logs.push(event);
      this.highlight = {...event, until:performance.now() + 290};
      this.renderLog();
      this.onSound(event.kind === 'heal' ? 'heal' : event.kind === 'spell' ? 'magic' : /damage|attack|hit/.test(event.kind ?? '') ? 'hit' : 'select');
      await new Promise(resolve => setTimeout(resolve,this.reduce ? 60 : this.fast ? 160 : 330));
      if (event.targetSide && event.amount) {
        const target=(event.targetSide==='party'?this.displayParty:this.displayEnemies)?.[event.targetIndex];
        if(target) target.hp=Math.min(target.maxHp,Math.max(0,target.hp+(event.kind==='heal'?event.amount:-event.amount)));
      }
      if(event.kind==='down' && event.targetSide==='party')this.displayParty[event.targetIndex].hp=0;
      this.renderParty(); this.renderEnemyList();
    }
    this.highlight = null;
    this.displayParty=null; this.displayEnemies=null;
    if (!this.active || run !== this.token) return;
    if (round.outcome) {
      this.summary = this.rpg.finishBattle();
      this.summary.outcome = this.summary.outcome ?? round.outcome;
      this.phase = 'result';
      this.onSound(round.outcome === 'victory' ? 'victory' : round.outcome === 'defeat' ? 'defeat' : 'select');
      if (this.summary.text) this.logs.push({kind:round.outcome,text:this.summary.text});
    } else {
      this.commands = this.rpg.party.map(() => null);
      this.actor = this.rpg.party.findIndex(hero => hero.hp > 0);
      this.phase = 'command';
    }
    this.render();
  }

  renderResult(list, title, eyebrow) {
    const summary = this.summary;
    eyebrow.textContent = summary.outcome === 'victory' ? 'ENCOUNTER COMPLETE' : 'YOUR JOURNEY IS NOT OVER';
    title.textContent = {victory:'Well fought, roadkeepers.',defeat:'Return to a safe haven.',fled:'The road is yours again.'}[summary.outcome] ?? 'Continue your journey.';
    if (summary.outcome === 'victory') {
      const rewards = this.node('div',null,'battle-rewards');
      rewards.append(this.node('span','+' + (summary.xp ?? 0) + ' XP'),this.node('span','+' + (summary.gold ?? 0) + ' GOLD'));
      list.append(rewards);
      for (const level of summary.levels ?? []) list.append(this.node('p',level.name + ' reaches level ' + level.to + '.','battle-level-up'));
    } else if (summary.outcome === 'defeat') {
      list.append(this.node('p','The party will recover at a safe haven. Your completed story milestones remain intact.','battle-hint'));
    } else {
      list.append(this.node('p','No spoils today. Your party’s health and spell charges carry into the next encounter.','battle-hint'));
    }
    const go = this.button(summary.outcome === 'defeat' ? 'Return to haven  →' : 'Return to the road  →', () => this.finish());
    go.classList.add('battle-primary');
    list.append(go);
    this.focusOption();
  }

  finish() {
    if (!this.active || this.phase !== 'result') return;
    this.active = false;
    this.token++;
    cancelAnimationFrame(this.frameId);
    this.root.hidden = true;
    const result = {outcome:this.summary.outcome,rewards:{xp:this.summary.xp ?? 0,gold:this.summary.gold ?? 0},summary:this.summary,spec:this.spec};
    this.focusBefore?.focus?.({preventScroll:true});
    this.onEnd(result);
  }

  key(event) {
    if (!this.active) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); this.back(); return;
    }
    const buttons = [...this.root.querySelectorAll('button:not(:disabled)')].filter(button => !button.hidden && button.getClientRects().length);
    if (event.key === 'Tab') {
      const index = buttons.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); buttons.at(-1)?.focus(); }
      else if (!event.shiftKey && index === buttons.length - 1) { event.preventDefault(); buttons[0]?.focus(); }
      return;
    }
    if (['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation();
      const index = buttons.indexOf(document.activeElement);
      const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
      buttons[(index + direction + buttons.length) % buttons.length]?.focus();
      return;
    }
    if (['1','2','3','4'].includes(event.key) && this.phase === 'command' && this.menu === 'main') {
      event.preventDefault(); event.stopImmediatePropagation();
      this.el('battle-options').querySelectorAll('button')[Number(event.key) - 1]?.click();
    }
  }

  draw(time) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = 640, h = 236;
    const boss = this.spec.boss;
    const backdrop = this.spec.backdrop || 'orchard';
    const palettes = {orchard:['#233d49','#42616a','#78908a','#3b6161','#425e40','#4f6c46','#354f38','#638056'],water:['#173447','#32596b','#71a8ab','#295a6e','#2c6074','#387588','#204958','#689fa6'],coast:['#263d63','#547c94','#a7c9c1','#487884','#67765b','#879574','#536550','#c3c79a'],desert:['#4f4b70','#aa8991','#dcc59e','#ad8e78','#a98255','#ba9863','#8c6b49','#d9b777'],snow:['#253d5b','#5a7893','#b8d3d9','#728c9f','#92acb5','#bfd0ce','#7796aa','#e2e5d4'],cavern:['#131c2f','#283349','#505369','#373e53','#3e4651','#4e5361','#303a48','#77808a'],pale:['#292743','#595471','#a397b5','#76677f','#626775','#7d8291','#4f586e','#aba8be']};
    const colors=palettes[backdrop]||palettes.orchard;
    const phase = this.reduce ? 0 : time / 1000;
    ctx.fillStyle = boss ? '#15192d' : colors[0]; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = boss ? '#283650' : colors[1]; ctx.fillRect(0,45,w,76);
    ctx.fillStyle = boss ? '#46516b' : colors[2]; ctx.fillRect(0,97,w,24);
    // Deliberate stepped silhouettes keep the battlefield on the same pixel grid.
    for (let i = 0; i < 11; i++) {
      const x = i * 69 - 29;
      const rise = 26 + (i * 17) % 33;
      ctx.fillStyle = boss ? '#303e57' : colors[3];
      for (let step = 0; step < 7; step++) ctx.fillRect(x + step * 5, 112 - rise + step * 4, 70 - step * 8, rise - step * 4 + 4);
    }
    ctx.fillStyle = boss ? '#30383e' : colors[4]; ctx.fillRect(0,121,w,h-121);
    ctx.fillStyle = boss ? '#39454d' : colors[5]; ctx.fillRect(0,139,w,28);
    ctx.fillStyle = boss ? '#263039' : colors[6]; ctx.fillRect(0,189,w,47);
    for (let i = 0; i < 85; i++) {
      const x = (i * 97 + 17) % w;
      const y = 132 + ((i * 41) % 102);
      ctx.fillStyle = i % 3 ? (boss ? '#46515a' : colors[7]) : (boss ? '#222d35' : '#263f32');
      ctx.fillRect(x,y,3 + i%4,1);
    }
    const landscape = this.images.get('landscape');
    if (!boss && backdrop==='orchard' && landscape?.complete && landscape.naturalWidth) {
      const sourceHeight = Math.round(landscape.naturalWidth*h/w);
      const sourceY = Math.min(landscape.naturalHeight-sourceHeight,Math.round(landscape.naturalHeight*.32));
      ctx.drawImage(landscape,0,sourceY,landscape.naturalWidth,sourceHeight,0,0,w,h);
      ctx.fillStyle='#12292c30';ctx.fillRect(0,0,w,h);
    }
    if(!boss && ['water','coast'].includes(backdrop)){ctx.fillStyle='#9ac1bd';for(let i=0;i<24;i++)ctx.fillRect((i*47+Math.round(phase)*3)%640,130+(i*29)%90,13,1);}
    if(!boss && backdrop==='pale'){ctx.strokeStyle='#b4a0cb';ctx.lineWidth=3;ctx.beginPath();ctx.arc(300,80,62,Math.PI,Math.PI*2);ctx.stroke();}
    if (!boss && backdrop==='snow'){ctx.fillStyle='#e9e8d8';for(let i=0;i<45;i++)ctx.fillRect((i*53)%640,(i*41+Math.round(phase*3))%236,2,2);}
    if (boss) {
      for (const x of [30,280,603]) {
        ctx.fillStyle='#1a2533';ctx.fillRect(x,60,12,76);
        ctx.fillStyle='#596575';ctx.fillRect(x-4,57,20,5);
        ctx.fillStyle='#cfaf6e';ctx.fillRect(x+4,78,4,10);
        ctx.fillStyle='#efe1a3';ctx.fillRect(x+5,78,2,5);
      }
    }
    const foes = this.enemies();
    foes.forEach((enemy,index) => {
      const count = foes.length;
      let x, y;
      if (count === 1) { x=190; y=188; }
      else if (count === 2) { x=112 + index*133; y=165 + index*29; }
      else { x=97 + (index%2)*128; y=151 + Math.floor(index/2)*48; }
      if (enemy.hp <= 0) return;
      const pulse = this.reduce ? 0 : Math.round(Math.sin(phase*2 + index)*1);
      const selected = this.selectedEnemy === index;
      const struck = this.highlight?.targetSide === 'enemy' && this.highlight.targetIndex === index && this.highlight.until > time;
      ctx.fillStyle = '#101d2790';ctx.fillRect(x-21,y-2,42,5);
      if (selected) {
        ctx.fillStyle='#f1d591';ctx.fillRect(x-25,y+7,50,2);
        ctx.fillRect(x-28,y+4,3,5);ctx.fillRect(x+25,y+4,3,5);
      }
      ctx.save();
      if (struck && Math.floor(time/60)%2) ctx.globalAlpha=.55;
      if (typeof drawAveluneEnemy === 'function') drawAveluneEnemy(ctx,enemy.sprite || 'slime',x,y+pulse,boss ? 3 : 2);
      else this.drawFallbackEnemy(ctx,enemy.sprite,x,y+pulse,boss ? 3 : 2);
      ctx.restore();
      if (struck && this.highlight.amount) this.drawNumber(ctx,this.highlight.amount,x,y-45,this.highlight.kind === 'heal' ? '#9aefbc' : '#fff0c6');
    });
    (this.displayParty ?? this.rpg.party).forEach((hero,index) => {
      const x=464+(index%2)*42;
      const y=102+index*33;
      const highlighted = this.highlight?.actorSide === 'party' && this.highlight.actorIndex === index && this.highlight.until > time;
      const hurt = this.highlight?.targetSide === 'party' && this.highlight.targetIndex === index && this.highlight.until > time;
      const offset = highlighted && !this.reduce ? -9 : 0;
      const id=hero.id === 'keeper' ? 'roadkeeper' : hero.id;
      const img=this.images.get(id);
      ctx.fillStyle='#111e2990';ctx.fillRect(x-13,y-1,26,4);
      ctx.save();
      if (hero.hp <= 0) ctx.globalAlpha=.3;
      if (hurt && Math.floor(time/60)%2) ctx.globalAlpha=.45;
      if (img?.complete && img.naturalWidth) {
        const size=53;
        ctx.drawImage(img,x-size/2+offset,y-size,size,size);
      } else this.drawFallbackHero(ctx,hero,x+offset,y,index);
      ctx.restore();
      if (this.actor === index && this.phase === 'command') {
        ctx.fillStyle='#f2d892';
        ctx.fillRect(x+27,y-26,6,2);ctx.fillRect(x+24,y-25,5,4);ctx.fillRect(x+27,y-21,6,2);
      }
      if (hurt && this.highlight.amount) this.drawNumber(ctx,this.highlight.amount,x,y-37,this.highlight.kind === 'heal' ? '#9aefbc' : '#fff0c6');
    });
    ctx.fillStyle='#b3c1b6';ctx.font='8px monospace';ctx.textAlign='left';
    ctx.fillText('ENEMIES',20,20);ctx.textAlign='right';ctx.fillText('ROADKEEPERS',620,20);
  }

  drawNumber(ctx, amount, x, y, color) {
    ctx.font='bold 13px monospace';ctx.textAlign='center';ctx.fillStyle='#142331';ctx.fillText(String(amount),x+1,y+1);ctx.fillStyle=color;ctx.fillText(String(amount),x,y);
  }

  drawFallbackEnemy(ctx,key,x,y,scale) {
    ctx.fillStyle='#24323e';ctx.fillRect(x-10*scale,y-17*scale,20*scale,17*scale);
    ctx.fillStyle=key === 'guardian' ? '#9c8c68' : '#8baf7a';ctx.fillRect(x-8*scale,y-15*scale,16*scale,13*scale);
    ctx.fillStyle='#192c36';ctx.fillRect(x-5*scale,y-10*scale,3*scale,2*scale);ctx.fillRect(x+2*scale,y-10*scale,3*scale,2*scale);
    ctx.fillStyle='#f0c683';ctx.fillRect(x-4*scale,y-10*scale,scale,scale);ctx.fillRect(x+3*scale,y-10*scale,scale,scale);
  }

  drawFallbackHero(ctx,hero,x,y,index) {
    const palette=['#c7ad70','#7e9dba','#e2dfbc','#a68dba'];
    ctx.fillStyle='#172737';ctx.fillRect(x-8,y-31,16,28);
    ctx.fillStyle=palette[index];ctx.fillRect(x-7,y-20,14,16);
    ctx.fillStyle='#d9b18a';ctx.fillRect(x-5,y-29,10,10);
    ctx.fillStyle='#4b3c36';ctx.fillRect(x-6,y-32,12,6);
    ctx.fillStyle='#283b4b';ctx.fillRect(x-7,y-4,5,5);ctx.fillRect(x+2,y-4,5,5);
  }
}
