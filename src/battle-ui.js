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
    this.displayParty = null; this.displayEnemies = null; this.displayRound = null;
    this.logs = [{text: spec.boss ? 'A guardian stands across the road.' : 'Your party readies for battle.', kind:'intro'}];
    this.selectedEnemy = -1;
    this.highlight = null;
    this.focusBefore = document.activeElement;
    this.root.hidden = false;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Turn-based battle');
    this.root.innerHTML = '<div class="battle-window"><header class="battle-header"><div><p class="battle-eyebrow" id="battle-type"></p><h2 id="battle-name"></h2></div><div class="battle-round"><span id="battle-round-label"></span><button type="button" id="battle-speed" aria-label="Toggle battle animation speed">1× speed</button></div></header><div class="battle-stage"><canvas id="battle-canvas" width="320" height="144" aria-label="Enemies stand on the left and your party on the right"></canvas></div><div class="battle-roster"><div class="battle-encounter-tag" id="battle-intent"></div><div class="battle-enemy-list" id="battle-enemy-list"></div></div><div class="battle-party" id="battle-party"></div><div class="battle-bottom"><section class="battle-command-panel" aria-labelledby="battle-command-title"><div class="battle-panel-heading"><div><p id="battle-command-eyebrow"></p><h3 id="battle-command-title"></h3></div><button type="button" id="battle-back" aria-label="Go back or undo last command">← Back</button></div><div id="battle-options"></div></section><section class="battle-log-panel" aria-labelledby="battle-log-title"><p class="battle-eyebrow" id="battle-log-title">MESSAGE</p><div id="battle-log" role="log" aria-live="polite" aria-relevant="additions text"></div><p class="battle-controls">Choose every order, then resolve the round.</p></section></div></div>';
    this.canvas = this.root.querySelector('#battle-canvas');
    this.ctx = this.canvas.getContext('2d', {alpha:false});
    this.ctx.imageSmoothingEnabled = false;
    this.el('battle-speed').addEventListener('click', () => {
      this.fast = !this.fast;
      this.el('battle-speed').textContent = this.fast ? '2× speed' : '1× speed';
    });
    this.el('battle-speed').textContent = this.fast ? '2× speed' : '1× speed';
    this.el('battle-back').addEventListener('click', () => this.back());
    this.stageObserver?.disconnect();
    this.stageObserver = new ResizeObserver(() => this.fitStage());
    this.stageObserver.observe(this.canvas.parentElement);
    this.fitStage();
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

  fitStage() {
    // Keep one art pixel equal to a whole number of screen pixels at every width.
    // The battlefield gains horizontal space on wide screens instead of stretching.
    if (!this.active || !this.canvas) return;
    const available = this.canvas.parentElement.clientWidth;
    const scale = available >= 640 ? 2 : 1;
    const width = Math.max(1, Math.floor(available / scale));
    if (this.canvas.width !== width) this.canvas.width = width;
    this.canvas.height = 144;
    this.canvas.style.width = width * scale + 'px';
    this.canvas.style.height = 144 * scale + 'px';
    this.canvas.parentElement.style.height = 144 * scale + 'px';
    this.ctx.imageSmoothingEnabled = false;
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
    this.selectedEnemy = -1;
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
    this.root.classList.toggle('battle-submenu',this.phase === 'command' && this.menu !== 'main');
    this.el('battle-type').textContent = result ? 'THE ROAD CONTINUES' : this.spec.boss ? 'GUARDIAN ENCOUNTER' : 'WILDERNESS ENCOUNTER';
    this.el('battle-name').textContent = result ? {victory:'Victory',defeat:'A light still burns',fled:'A narrow escape'}[this.summary?.outcome] ?? 'The battle ends' : this.spec.name ?? 'An unexpected encounter';
    this.el('battle-round-label').textContent = 'ROUND ' + (this.displayRound ?? this.encounter?.round ?? 1);
    const heavy = this.enemies().filter(enemy => enemy.hp > 0 && /heavy|gather|charge/i.test(enemy.intent ?? ''));
    this.el('battle-intent').textContent = result ? 'ENCOUNTER COMPLETE' : heavy.length ? 'POWER GATHERS · Guard against the next strike' : this.spec.boss ? 'GUARDIAN · This road must be won' : 'ENEMIES · Select a foe to attack';
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
      card.setAttribute('aria-label', hero.name + ', ' + hero.hp + ' of ' + hero.maxHp + ' health, ' + hero.mp + ' of ' + hero.maxMp + ' MP. ' + this.commandName(this.commands[index]));
      const head = this.node('span', null, 'battle-hero-head');
      head.append(this.node('strong',hero.name), this.node('small','Lv. ' + hero.level));
      card.append(head, this.node('span', hero.role ?? hero.job ?? '', 'battle-hero-job'));
      const hp = this.node('span', null, 'battle-hero-life');
      hp.append(this.node('span','HP'),this.node('b',Math.max(0,hero.hp) + ' / ' + hero.maxHp));
      const track = this.node('span', null, 'battle-hp-track' + (hero.hp / hero.maxHp < .3 ? ' low' : ''));
      const fill = this.node('span');
      fill.style.width = Math.max(0,Math.min(100,hero.hp/hero.maxHp*100)) + '%';
      track.append(fill);
      const mana=this.node('span',null,'battle-charges battle-mana');mana.append(this.node('span','MP '+hero.mp+' / '+hero.maxMp));const manaBar=this.node('span',null,'battle-mana-bar'),manaFill=this.node('i');manaFill.style.width=(hero.maxMp?Math.max(0,Math.min(100,100*hero.mp/hero.maxMp)):0)+'%';manaBar.setAttribute('aria-hidden','true');manaBar.append(manaFill);mana.append(manaBar);
      card.append(hp,track,mana,this.node('span',hero.hp <= 0 ? 'Fallen' : this.commandName(this.commands[index]),'battle-order'));
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
      list.append(this.node('p','Your orders unfold. Watch the message window.','battle-hint'));
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
    eyebrow.textContent = 'COMMAND ' + (this.actor + 1) + ' / ' + this.rpg.party.length;
    title.textContent = hero?.name ?? 'Your party';
    if (this.menu === 'main') {
      list.classList.add('battle-main-commands');
      list.append(
        this.button('Attack', () => this.target({type:'attack'}), 'Strike one enemy'),
        this.button('Magic', () => { this.menu = 'magic'; this.render(); }, 'Cast a spell with MP', !hero?.spells?.length),
        this.button('Guard', () => this.queue({type:'guard'}), 'Reduce incoming damage'),
        this.button('Item', () => { this.menu = 'items'; this.render(); }, 'Aid an ally'),
      );
      const retreat = this.button('Retreat', () => { this.menu = 'flee'; this.render(); }, this.spec.boss ? 'Guardians seal the road' : 'The whole party attempts escape', this.spec.boss);
      retreat.classList.add('battle-retreat');
      list.append(retreat);
    } else if (this.menu === 'magic') {
      eyebrow.textContent = 'MAGIC · MP ' + hero.mp + ' / ' + hero.maxMp;
      for (const id of hero.spells ?? []) {
        const spell = this.spell(id);
        if (!spell) continue;
        const unlocked = !spell.level || hero.level >= spell.level;
        list.append(this.button(spell.name + ' · ' + spell.mpCost + ' MP', () => this.target({type:'spell',spell:id}), (hero.mp<spell.mpCost?'Not enough MP. ':'')+(spell.description || spell.element || spell.kind), !unlocked || hero.mp < spell.mpCost));
      }
    } else if (this.menu === 'items') {
      eyebrow.textContent = 'SATCHEL · SHARED BY THE PARTY';
      for (const id of Object.keys(AVELUNE_ITEMS).filter(key=>!AVELUNE_ITEMS[key].fieldOnly)) {
        const item = this.item(id);
        const reserved = this.commands.filter(command => command?.type === 'item' && command.item === id).length;
        const available = Math.max(0,(this.rpg.inventory[id] ?? 0) - reserved);
        list.append(this.button((item?.name ?? {potion:'Potion',ether:'Ether',revive:'Phoenix salve'}[id]) + ' ×' + available, () => this.target({type:'item',item:id}), item?.description ?? {potion:'Restore an ally’s health.',ether:'Restore an ally’s MP.',revive:'Return a fallen ally to battle.'}[id], available <= 0));
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
    this.displayRound = this.encounter.round;
    this.displayParty = this.rpg.party.map(hero => ({...hero}));
    this.displayEnemies = this.encounter.enemies.map(enemy => ({...enemy}));
    const round = this.rpg.resolveRound(this.commands.map(command => command ?? {type:'guard'}));
    this.encounter = this.rpg.battle ?? this.encounter;
    this.render();
    for (const event of round.events ?? []) {
      if (!this.active || run !== this.token) return;
      const duration = this.reduce ? 60 : this.fast ? 190 : 390;
      const started = performance.now();
      this.logs.push(event);
      this.highlight = {...event, started, duration, until:started + duration};
      // Resource payloads are emitted once per cast, even for party-wide spells.
      if(event.actorSide==='party'&&event.mpCost>0){const hero=this.displayParty[event.actorIndex];if(hero)hero.mp=Math.max(0,hero.mp-event.mpCost);}
      if(event.resource==='mp'&&event.targetSide==='party'){const hero=this.displayParty[event.targetIndex];if(hero)hero.mp=Math.min(hero.maxMp,Math.max(0,hero.mp+event.amount));}
      // Resource recovery never changes HP in the replay.
      if (event.targetSide && event.amount && event.resource!=='mp') {
        const target = (event.targetSide === 'party' ? this.displayParty : this.displayEnemies)?.[event.targetIndex];
        if (target) target.hp = Math.min(target.maxHp, Math.max(0, target.hp + (event.kind === 'heal' ? event.amount : -event.amount)));
      }
      if (event.kind === 'down' && event.targetSide === 'party') this.displayParty[event.targetIndex].hp = 0;
      this.renderLog();
      this.renderParty();
      this.renderEnemyList();
      this.onSound(event.kind === 'heal' ? 'heal' : event.kind === 'spell' ? 'magic' : /damage|attack|hit/.test(event.kind ?? '') ? 'hit' : 'select');
      await new Promise(resolve => setTimeout(resolve, duration));
    }
    if (!this.active || run !== this.token) return;
    this.highlight = null;
    this.displayParty = null; this.displayEnemies = null; this.displayRound = null;
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
      list.append(this.node('p','No spoils today. Your party’s health and MP carry into the next encounter.','battle-hint'));
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
    this.stageObserver?.disconnect();
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
    const w = this.canvas.width, h = this.canvas.height;
    const event = this.highlight?.until > time ? this.highlight : null;
    const progress = event ? Math.min(1, (time - event.started) / event.duration) : 0;
    this.drawBackdrop(ctx, w, h, time);
    const foes = this.enemies();
    const positions = foes.map((enemy,index) => {
      if (foes.length === 1) return {x:Math.round(w * .29), y:119};
      if (foes.length === 2) return {x:Math.round(w * (.2 + index * .19)), y:107 + index * 20};
      return {x:Math.round(w * (.17 + (index % 2) * .2)), y:91 + Math.floor(index / 2) * 35};
    });
    foes.forEach((enemy,index) => {
      const {x,y} = positions[index];
      const hit = event?.targetSide === 'enemy' && event.targetIndex === index;
      // Keep a defeated enemy present for the final strike, then remove it.
      if (enemy.hp <= 0 && !hit) return;
      const scale = this.spec.boss && foes.length === 1 ? 2 : 1;
      const selected = this.selectedEnemy === index && this.phase === 'command';
      const acting = event?.actorSide === 'enemy' && event.actorIndex === index;
      const offset = acting && !this.reduce ? 3 : 0;
      ctx.fillStyle = '#152538'; ctx.fillRect(x - 13 * scale,y - 1,26 * scale,3);
      if (selected) this.drawCursor(ctx,x - 20 * scale,y - 14 * scale,'right');
      ctx.save();
      if (hit && !this.reduce && progress > .15 && progress < .7 && Math.floor(progress * 12) % 2) ctx.globalAlpha = .42;
      if (typeof drawAveluneEnemy === 'function') drawAveluneEnemy(ctx,enemy.sprite || 'slime',x + offset,y,scale);
      else this.drawFallbackEnemy(ctx,enemy.sprite,x + offset,y,scale);
      ctx.restore();
      if (hit) this.drawHit(ctx,event,x,y - 19 * scale,progress);
    });
    (this.displayParty ?? this.rpg.party).forEach((hero,index) => {
      const x = w - 47 + (index % 2) * 8;
      const y = 49 + index * 27;
      const acting = event?.actorSide === 'party' && event.actorIndex === index;
      const hit = event?.targetSide === 'party' && event.targetIndex === index;
      const offset = acting && !this.reduce ? -4 : 0;
      ctx.fillStyle = '#152538'; ctx.fillRect(x - 7,y - 1,14,3);
      ctx.save();
      if (hero.hp <= 0 && !hit) ctx.globalAlpha = .35;
      if (hit && event.kind !== 'heal' && !this.reduce && progress > .15 && progress < .7 && Math.floor(progress * 12) % 2) ctx.globalAlpha = .45;
      const id = hero.id === 'keeper' ? 'roadkeeper' : hero.id;
      if (typeof AvelunePixelArt !== 'undefined') {
        AvelunePixelArt.drawHero(ctx,id,'left',acting && progress < .65 ? 1 : 0,x + offset,y);
      } else this.drawFallbackHero(ctx,hero,x + offset,y,index);
      ctx.restore();
      if (this.actor === index && this.phase === 'command') this.drawCursor(ctx,x + 14,y - 14,'left');
      if (hit) this.drawHit(ctx,event,x,y - 13,progress);
      if (event?.kind === 'guard' && acting) {
        ctx.strokeStyle = '#eddfb2'; ctx.lineWidth = 1; ctx.strokeRect(x - 11,y - 25,21,27);
      }
    });
  }

  drawBackdrop(ctx,w,h,time) {
    const p = typeof AVELUNE_PALETTE !== 'undefined' ? AVELUNE_PALETTE : {};
    const ink = p.ink || '#172334', blue = p.waterLight || '#487e9d';
    const grass = p.grass || '#547b48', moss = p.grassDark || '#3c6044';
    const leaf = p.grassBright || '#92ad62', cream = p.cream || '#f1e6c6';
    const stone = p.stone || '#687984', sand = p.path || '#c8ad72';
    const backdrop = this.spec.backdrop || 'orchard';
    const cave = backdrop === 'cavern';
    const pale = backdrop === 'pale';
    const snow = backdrop === 'snow';
    const desert = backdrop === 'desert';
    const water = backdrop === 'water' || backdrop === 'coast';
    const sky = cave ? ink : pale ? '#49486c' : snow ? '#9ab5c6' : desert ? '#c8ad72' : blue;
    const ground = cave ? '#62646b' : pale ? '#89939a' : snow ? (p.snow || '#cadcda') : desert ? '#c7b17a' : grass;
    ctx.fillStyle = sky; ctx.fillRect(0,0,w,h);
    // Far silhouettes and foreground share the map's small, stepped pixel shapes.
    if (cave) {
      ctx.fillStyle = '#273b50'; ctx.fillRect(0,0,w,44);
      for (let x = -8; x < w; x += 32) {
        const height = 8 + ((x + 8) / 32 % 3) * 7;
        ctx.fillStyle = '#465563'; ctx.fillRect(x,0,28,height); ctx.fillRect(x + 6,height,16,7); ctx.fillRect(x + 11,height + 7,6,7);
        ctx.fillStyle = '#273b50'; ctx.fillRect(x,27,30,18); ctx.fillRect(x + 6,20,19,12);
      }
    } else {
      ctx.fillStyle = snow ? '#b9cacc' : desert ? '#dfc48e' : pale ? '#777c9a' : '#9db69a';
      if (!pale) for (let x = 12; x < w; x += 104) {
        ctx.fillRect(x,14,24,3); ctx.fillRect(x + 5,11,12,3);
      }
      ctx.fillStyle = snow ? '#8cabb4' : desert ? '#ae8559' : pale ? '#585f7e' : moss;
      for (let x = -24, i = 0; x < w; x += 48, i++) {
        const top = 20 + i % 3 * 3;
        ctx.fillRect(x,top + 8,64,27); ctx.fillRect(x + 8,top + 3,43,8); ctx.fillRect(x + 18,top,24,4);
      }
      if (water) {
        ctx.fillStyle = p.water || '#315f85'; ctx.fillRect(0,27,w,18);
        ctx.fillStyle = p.waterFoam || '#76a9ba';
        for (let x = 9; x < w; x += 39) { ctx.fillRect(x,32,13,1); ctx.fillRect(x + 17,40,8,1); }
      }
    }
    ctx.fillStyle = ground; ctx.fillRect(0,44,w,h - 44);
    ctx.fillStyle = cave ? '#344656' : pale ? '#565e73' : snow ? '#9cb8bd' : desert ? '#af8758' : moss;
    ctx.fillRect(0,42,w,3);
    // A quiet, repeating ground texture, never a detailed illustration under actors.
    for (let y = 56; y < h; y += 16) for (let x = 4 + (y % 3) * 5; x < w; x += 32) {
      ctx.fillStyle = cave ? '#61727a' : pale ? '#9399a4' : snow ? cream : desert ? '#dfc48e' : leaf;
      ctx.fillRect(x,y,3,1); ctx.fillRect(x + 16,y + 7,2,1);
    }
    if (!cave && !desert && !snow && !pale && !water) {
      for (let x = 7; x < w; x += 38) {
        ctx.fillStyle = p.wood || '#765543'; ctx.fillRect(x + 11,24,4,21);
        ctx.fillStyle = p.tree || '#305b48'; ctx.fillRect(x + 2,12,23,17); ctx.fillRect(x + 6,5,16,9); ctx.fillRect(x,18,27,7);
        ctx.fillStyle = p.treeLight || '#4d7a50'; ctx.fillRect(x + 5,8,14,7); ctx.fillRect(x + 2,16,20,5);
        ctx.fillStyle = p.treeBright || '#769758'; ctx.fillRect(x + 8,10,8,2);
        ctx.fillStyle = p.roofLight || '#cf7755'; ctx.fillRect(x + 6,22,2,2); ctx.fillRect(x + 19,17,2,2);
      }
    }
    if (desert) for (let x = 25; x < w; x += 126) {
      ctx.fillStyle = moss; ctx.fillRect(x,23,5,22); ctx.fillRect(x - 5,32,5,4); ctx.fillRect(x - 7,27,3,9); ctx.fillRect(x + 5,29,6,3); ctx.fillRect(x + 9,23,3,9);
    }
    if (pale || this.spec.boss) {
      for (const x of [16, Math.round(w * .57), w - 18]) {
        ctx.fillStyle = ink; ctx.fillRect(x,5,9,40); ctx.fillRect(x - 3,2,15,4);
        ctx.fillStyle = stone; ctx.fillRect(x + 1,6,3,36); ctx.fillRect(x - 2,2,12,2);
        ctx.fillStyle = sand; ctx.fillRect(x + 3,17,3,6);
        ctx.fillStyle = cream; ctx.fillRect(x + 4,17,1,3);
      }
    }
    if (snow) {
      ctx.fillStyle = cream;
      for (let i = 0; i < 15; i++) ctx.fillRect((i * 37 + 13) % w, (i * 23 + 8) % 40,1,1);
    }
  }

  drawCursor(ctx,x,y,direction) {
    ctx.fillStyle = '#172334'; ctx.fillRect(x - 1,y - 4,7,9);
    ctx.fillStyle = '#f1e6c6';
    for (let row = -3; row <= 3; row++) {
      const width = 4 - Math.abs(row);
      ctx.fillRect(direction === 'right' ? x : x + 4 - width,y + row,width,1);
    }
  }

  drawHit(ctx,event,x,y,progress) {
    const healing = event.kind === 'heal';
    if (event.amount) {
      const lift = this.reduce ? 0 : Math.floor(progress * 5);
      this.drawNumber(ctx,(healing ? '+' : '') + event.amount,x,y - 14 - lift,healing ? '#92ad62' : '#f1e6c6');
    }
    if (this.reduce || progress > .72 || !event.amount) return;
    const color = healing ? '#92ad62' : event.kind === 'spell' ? '#a7c9dd' : '#f1e6c6';
    ctx.fillStyle = color;
    const radius = 3 + Math.floor(progress * 7);
    ctx.fillRect(x - radius,y,3,1); ctx.fillRect(x + radius - 2,y,3,1);
    ctx.fillRect(x,y - radius,1,3); ctx.fillRect(x,y + radius - 2,1,3);
    if (event.weak || event.critical) {
      ctx.fillRect(x - radius + 1,y - radius + 1,2,2); ctx.fillRect(x + radius - 2,y + radius - 2,2,2);
    }
  }

  drawNumber(ctx,amount,x,y,color) {
    ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3; ctx.strokeStyle = '#172334'; ctx.strokeText(String(amount),Math.round(x),Math.round(y));
    ctx.fillStyle = color; ctx.fillText(String(amount),Math.round(x),Math.round(y));
  }

  drawFallbackEnemy(ctx,key,x,y,scale) {
    ctx.fillStyle = '#172334'; ctx.fillRect(x - 11 * scale,y - 19 * scale,22 * scale,19 * scale);
    ctx.fillStyle = key === 'guardian' ? '#c8ad72' : '#92ad62'; ctx.fillRect(x - 9 * scale,y - 17 * scale,18 * scale,15 * scale);
    ctx.fillStyle = '#172334'; ctx.fillRect(x - 5 * scale,y - 12 * scale,3 * scale,3 * scale); ctx.fillRect(x + 3 * scale,y - 12 * scale,3 * scale,3 * scale);
  }

  drawFallbackHero(ctx,hero,x,y,index) {
    const colors = ['#c8ad72','#7196ab','#f1e6c6','#9292ab'];
    ctx.fillStyle = '#172334'; ctx.fillRect(x - 6,y - 23,12,23);
    ctx.fillStyle = colors[index]; ctx.fillRect(x - 5,y - 13,10,10);
    ctx.fillStyle = '#dfb780'; ctx.fillRect(x - 4,y - 20,8,7);
    ctx.fillStyle = '#705b40'; ctx.fillRect(x - 5,y - 23,10,5);
    ctx.fillStyle = '#273b50'; ctx.fillRect(x - 5,y - 3,4,3); ctx.fillRect(x + 2,y - 3,4,3);
  }
}
