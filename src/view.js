/* Pixel canvas, camera, and visual-only animation. */

// Points are fractional positions in the visible source sprite.
const FixtureMotion = {
  PROP002: [['flame',.55,.865,.21,.87]],
  PROP014: [['flame',.51,.785,.23,.86]],
  PROP038: [['flame',.27,.82,.095,.72]],
  PROP039: [['flame',.39,.345,.09,.65]],
  PROP040: [['flame',.19,.39,.065,.72],['flame',.50,.24,.075,.72],['flame',.82,.39,.065,.72]],
  PROP056: [['glint',.49,.43,.16,.55]],
  PROP057: [['glint',.48,.28,.17,.60]],
  PROP058: [['glint',.48,.39,.16,.49]],
  PROP059: [['flame',.50,.55,.36,.90]],
  terrain_campfire: [['flame',.52,.71,.37,.88]],
  terrain_waterfall: [['splash',.51,.92,.46,.81]],
  terrain_luminous_pool: [['glint',.55,.48,.19,.67]],
  terrain_crystals: [['glint',.47,.34,.20,.52]],
  terrain_pale_crystal: [['glint',.49,.30,.16,.53]],
  WR114: [['smoke',.65,.18,.20,.62],['flame',.37,.83,.14,.81]],
  WR131: [['smoke',.25,.30,.18,.56]],
  WR132: [['flame',.44,.86,.16,.83]],
  WR154: [['glint',.64,.25,.17,.72]],
  WR162: [['smoke',.67,.21,.19,.56]],
  WR164: [['smoke',.64,.16,.20,.59],['flame',.48,.83,.15,.81]],
  WR342: [['splash',.53,.85,.29,.75]],
  WR344: [['splash',.60,.86,.24,.78]],
  WR352: [['glint',.49,.38,.18,.65]],
  WR372: [['flame',.55,.44,.105,.67]],
  landmarks_alderreach_hearth: [['flame',.50,.67,.18,.81]],
  landmarks_kharad_hearth: [['flame',.51,.68,.19,.81]],
  landmarks_sereva_hearth: [['flame',.51,.67,.19,.81]],
  landmarks_veyra_hearth: [['glint',.51,.55,.17,.69]],
  landmarks_isles_hearth: [['glint',.50,.56,.17,.69]],
  landmarks_seventh_hearth: [['glint',.50,.56,.19,.70]],
};
const BreathingCast = new Set([
  'party_travel_wyla','party_travel_mara_south','party_travel_iven_south',
  'party_travel_tavi_south','party_travel_bram_south','party_travel_sella_south',
]);
const WindPlants = new Set(['terrain_wheat','terrain_reeds','terrain_silver_grass','terrain_palm']);
class AveluneView {
  constructor(canvas, art, tile) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', {alpha: false});
    this.art = art;
    this.tile = tile;
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.images = new Map();
    this.groundCache = new Map();
  }

  load(key, src) {
    if (!this.images.has(key)) {
      this.images.set(key, new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Unable to open artwork for ' + key));
        image.src = src;
      }).catch(error => { this.images.delete(key); throw error; }));
    }
    return this.images.get(key);
  }

  async prepare(id) {
    if (typeof AveluneTerrain !== 'undefined' && typeof LAYOUT !== 'undefined') {
      if(!this.groundCache.has(id)){
        const area=LAYOUT.areas[id];
        this.groundCache.set(id,area.kind==='overworld'&&typeof AveluneOverworldArt!=='undefined'?AveluneOverworldArt.bake(area):AveluneTerrain.bake(area));
      }
      const ground=this.groundCache.get(id);
      if(this.groundCache.size>6)this.groundCache.delete(this.groundCache.keys().next().value);
      return [null,ground,null];
    }
    return Promise.all([this.load('sprites',this.art.sprites),this.load(id,this.art.grounds[id]),this.load('motion',this.art.motion.image)]);
  }

  enter(area, [atlas, ground, motion]) {
    this.atlas = atlas;
    this.ground = ground;
    this.motionAtlas = motion;
    this.indoor = area.indoor;
    this.area = area;
    this.overworld = area.kind === 'overworld';
    if (this.images.size > 13) {
      const oldest = [...this.images.keys()].find(key => !['sprites', 'motion', area.id].includes(key));
      if (oldest) this.images.delete(oldest);
    }
    this.lastFoot = null;
    this.stride = 0;
    this.bounds = {left:0, top:0, right:ground.width, bottom:ground.height};
    for (const item of area.objects) {
      const x = (item.x + .5) * this.tile;
      const y = (item.y + .5) * this.tile;
      for (const asset of [item.asset, item.change?.asset].filter(Boolean)) {
        const box = this.spriteBox(asset, x, y, item.width);
        this.bounds.left = Math.min(this.bounds.left, box.left);
        this.bounds.right = Math.max(this.bounds.right, box.left + box.w);
        this.bounds.top = Math.min(this.bounds.top, box.top);
        this.bounds.bottom = Math.max(this.bounds.bottom, box.top + box.h);
      }
    }
    this.water = [];
    for (let y = 0; y < area.height; y++) {
      for (let x = 0; x < area.width; x++) {
        if ('~='.includes(area.terrain[y][x]) && ((x*13 + y*23) % 17 === 0)) this.water.push([x,y]);
      }
    }
  }

  size() {
    const frame = this.canvas.parentElement || this.canvas;
    const availableWidth = Math.floor(frame.clientWidth);
    const availableHeight = Math.floor(frame.clientHeight);
    if (!availableWidth || !availableHeight) return;
    // Towns retain their life-sized tiles. The separate world map uses a wider
    // viewport and miniature landmarks, with a smaller integer display scale.
    const tile = this.tile;
    const scale = Math.max(1, Math.floor(Math.min(availableWidth / (this.overworld?640:320), availableHeight / (this.overworld?320:192))));
    const width = Math.max(tile, Math.min(this.overworld?960:576, Math.floor(availableWidth / scale / tile) * tile));
    const height = Math.max(tile, Math.min(this.overworld?480:224, Math.floor(availableHeight / scale / tile) * tile));
    if (width !== this.canvas.width || height !== this.canvas.height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    Object.assign(this.canvas.style, {
      width: width * scale + 'px', height: height * scale + 'px',
      position: 'absolute', left: Math.floor((availableWidth-width*scale)/2) + 'px',
      top: Math.floor((availableHeight-height*scale)/2) + 'px', transform: 'none',
    });
    this.ctx.imageSmoothingEnabled = false;
  }

  spriteBox(key,x,y,width,height) {
    if(typeof AvelunePixelArt!=='undefined')return AvelunePixelArt.box(key,x,y,width,{region:this.area?.region,theme:this.area?.theme,indoor:this.indoor});
    const rect=this.art.frames[key];const w=height?Math.round(height*rect[2]/rect[3]):Math.round(width),h=height?Math.round(height):Math.round(w*rect[3]/rect[2]);
    return {rect,left:Math.round(x-w/2),top:Math.round(y-h),w,h};
  }
  stamp(ctx,key,x,y,width,height) {
    if(typeof AvelunePixelArt!=='undefined'){AvelunePixelArt.draw(ctx,key,Math.round(x),Math.round(y),width,{region:this.area?.region,theme:this.area?.theme,indoor:this.indoor});return;}
    if(!this.art.frames[key])return;const{rect,left,top,w,h}=this.spriteBox(key,x,y,width,height);ctx.drawImage(this.atlas,...rect,left,top,w,h);
  }

  motion(ctx, key, seconds, x, y, width, opacity=1, height) {
    const clip = this.art.motion?.clips[key];
    if (!clip?.frames.length || !this.motionAtlas) return;
    const period = clip.period || 1;
    const elapsed = Number.isFinite(seconds) ? seconds : 0;
    const phase = this.reduce ? 0 : ((elapsed % period) + period) % period / period;
    const rect = this.art.motion.rects[clip.frames[Math.floor(phase*clip.frames.length)]];
    if (!rect) return;
    const sx = width ? width / clip.art_width : 1;
    const sy = height ? height / clip.art_height : sx;
    ctx.save();
    ctx.globalAlpha *= opacity;
    ctx.drawImage(this.motionAtlas, ...rect,
      Math.round(x-clip.anchor[0]*sx), Math.round(y-clip.anchor[1]*sy),
      Math.max(1,Math.round(rect[2]*sx)), Math.max(1,Math.round(rect[3]*sy)));
    ctx.restore();
  }

  animateActor(model) {
    const directions = {south:'down', west:'left', east:'right', north:'up'};
    const facing = directions[model.facing] ? model.facing : 'south';
    const foot = [model.x, model.y];
    const distance = this.lastFoot ? Math.hypot(foot[0]-this.lastFoot[0], foot[1]-this.lastFoot[1]) : 0;
    if (!this.lastFoot || !model.moving || this.reduce || this.actorFacing !== facing || distance > this.tile * 2) {
      this.stride = 0;
    } else {
      // A complete four-pose stride covers 24 world pixels, whether walking,
      // running, or rendering more often. Waiting never advances a footstep.
      this.stride = (this.stride + distance) % 24;
    }
    this.lastFoot = foot;
    this.actorFacing = facing;
    return {x:Math.round(foot[0]), y:Math.round(foot[1]), direction:directions[facing], facing,
      frame:model.moving && !this.reduce ? Math.floor(this.stride / 6) : 0};
  }

  actor(ctx, model, t) {
    const pose = this.animateActor(model);
    this.shadow(ctx, pose.x, pose.y+1, 14);
    if (typeof AvelunePixelArt !== 'undefined') {
      AvelunePixelArt.drawHero(ctx, model.leaderId||'roadkeeper', pose.direction, pose.frame, pose.x, pose.y);
    } else {
      const key = 'walk_' + pose.facing;
      const clip = this.art.motion?.clips[key];
      if (clip) this.motion(ctx, key, (pose.frame + .1) / clip.frames.length * clip.period,
        pose.x, pose.y, undefined, 1, 24);
    }
  }

  scenery(ctx,item,box,model,t) {
    const {asset,x,y,width}=item;
    const p=AVELUNE_PALETTE;
    const boat=asset==='ocean_packet'||asset==='party_travel_ferry_east',air=asset==='party_travel_skiff_east';
    const bob=!this.reduce&&(boat||air)?Math.round(Math.sin(t*2+(x%5))):0;
    if(!boat&&!air&&width>24)this.shadow(ctx,x,y+1,Math.min(width,box.w));
    AvelunePixelArt.draw(ctx,asset,x,y-bob,width,{region:model.area.region,theme:model.area.theme,indoor:model.area.indoor,time:this.reduce?0:t,millRunning:model.has('mill_valves')});
    if(this.reduce)return;
    if(/hearth|campfire/.test(asset)||asset==='PROP059'){
      const phase=Math.floor(t*4)%2,fx=Math.round(x),fy=Math.round(y-7);
      ctx.fillStyle=p.roofLight;ctx.fillRect(fx-3,fy-4-phase,6,5+phase);ctx.fillStyle=p.gold;ctx.fillRect(fx-1,fy-6+phase,3,6);ctx.fillStyle=p.cream;ctx.fillRect(fx,fy-2,1,2);
    }
    if(boat){ctx.fillStyle=p.waterFoam;ctx.fillRect(Math.round(x-box.w/2+3),Math.round(y+2),6,1);ctx.fillRect(Math.round(x+box.w/2-8),Math.round(y+2),5,1)}
  }

  thumbnail(canvas, key) {
    const ctx = canvas.getContext('2d');
    const rect = this.art.frames[key];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!rect) return;
    ctx.imageSmoothingEnabled = false;
    this.stamp(ctx, key, canvas.width/2, canvas.height-4, Math.min(104, 106*rect[2]/rect[3]));
  }

  shadow(ctx, x, y, w) {
    const r = Math.max(3, Math.round(w * .29));
    ctx.fillStyle = '#17233455';
    ctx.fillRect(Math.round(x-r), Math.round(y-2), r*2, 4);
    ctx.fillRect(Math.round(x-r+2), Math.round(y-4), Math.max(4, r*2-4), 2);
  }

  frame(model, time, objective) {
    if (!this.ground) return;
    if(this.overworld&&typeof AveluneOverworldArt!=='undefined'){this.worldFrame(model,time,objective);return;}
    this.size();
    const ctx = this.ctx;
    const {width:w, height:h} = this.canvas;
    const cx = this.cameraAxis(model.x, w, this.bounds.left, this.bounds.right);
    const cy = this.cameraAxis(model.y, h, this.bounds.top, this.bounds.bottom);
    this.camera = {x:cx,y:cy};
    ctx.fillStyle = '#0b1325';
    ctx.fillRect(0,0,w,h);
    ctx.save();
    ctx.translate(-cx,-cy);
    ctx.drawImage(this.ground,0,0);
    const t = this.reduce ? 0 : time / 1000;
    if(!this.reduce&&typeof AveluneTerrain!=='undefined')AveluneTerrain.waterFrame(ctx,model.area,time,{x:cx,y:cy},w,h);

    for (const gate of model.area.barriers) {
      if (model.has(gate.gate)) continue;
      const [x,y,x2,y2]=gate.rect;
      const px=x*this.tile, py=y*this.tile, ww=(x2-x+1)*this.tile, hh=(y2-y+1)*this.tile;
      ctx.fillStyle='#503734b0';
      ctx.fillRect(px,py,ww,hh);
      ctx.fillStyle='#bd8652';
      ctx.fillRect(px+ww/2-2,py,4,hh);
      for(let off=2;off<hh;off+=9) ctx.fillRect(px,py+off,ww,2);
    }
    for (const stop of model.area.stops) {
      if (!WalkModes.has(stop.mode)) continue;
      const [x,y]=stop.at.map(n=>model.center(n));
      const open=model.has(model.routes.get(stop.links[0]).gate);
      ctx.fillStyle=open?'#e4cd91':'#966455';
      if (open) ctx.fillRect(x-3,y+4,7,1);
      else {
        ctx.fillRect(x-10,y-3,21,3);
        ctx.fillRect(x-8,y-6,3,10);
        ctx.fillRect(x+6,y-6,3,10);
      }
    }
    const visible = [{player:true, y:model.y}];
    for (const obj of model.area.objects) {
      if ((obj.show && !model.has(obj.show)) || (obj.hide && model.has(obj.hide))) continue;
      const asset = obj.change && model.has(obj.change.gate) ? obj.change.asset : obj.asset;
      const x = model.center(obj.x), y = model.center(obj.y);
      const box = this.spriteBox(asset, x, y, obj.width);
      // Cull against the real footprint with a margin for attached effects.
      if (box.left + box.w < cx-18 || box.left > cx+w+18 || box.top > cy+h+26 || y < cy-12) continue;
      visible.push({asset, x, y, width:obj.width, box});
    }
    if(typeof AveluneTownServices!=='undefined')for(const service of AveluneTownServices.forArea(model.area,model)){
      const x=model.center(service.at[0]),y=model.center(service.at[1]);
      if(x<cx-30||x>cx+w+30||y<cy-12||y>cy+h+42)continue;
      visible.push({service,x,y});
    }
    visible.sort((a,b)=>a.y-b.y);
    for (const obj of visible) {
      if (obj.player) this.actor(ctx,model,t);
      else if(obj.service)AveluneServiceArt.draw(ctx,obj.service,obj.x,obj.y);
      else this.scenery(ctx,obj,obj.box,model,t);
    }
    ctx.restore();
    if (objective) this.marker(model, objective, cx, cy, w, h, t);
  }

  worldFrame(model,time,objective) {
    this.size();
    const ctx=this.ctx,{width:w,height:h}=this.canvas;
    const cx=this.cameraAxis(model.x,w,0,this.ground.width),cy=this.cameraAxis(model.y,h,0,this.ground.height);
    this.camera={x:cx,y:cy};
    ctx.fillStyle=AVELUNE_PALETTE.deep;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.translate(-cx,-cy);ctx.drawImage(this.ground,0,0);
    const t=this.reduce?0:time/1000;
    if(!this.reduce)AveluneTerrain.waterFrame(ctx,model.area,time,this.camera,w,h);
    const nodes=model.area.mapNodes||[],gateways=model.area.gateways||[];
    const labels=[...nodes.filter(node=>model.distance(node.at)<=112),...gateways.filter(gate=>model.distance(gate.at)<=64).map(gate=>({...gate,name:gate.title}))];
    const nearest=labels.sort((a,b)=>model.distance(a.at)-model.distance(b.at))[0];
    for(const node of nodes){
      const x=model.center(node.at[0]),y=model.center(node.at[1]);
      if(x<cx-24||x>cx+w+24||y<cy-24||y>cy+h+24)continue;
      const onThisShore=!model.area.allowedEntries||model.area.allowedEntries.includes(node.id);
      AveluneOverworldArt.node(ctx,node,x,y,onThisShore&&(model.canEnterArea?.(node.id)??true));
    }
    for(const gate of gateways){
      const x=model.center(gate.at[0]),y=model.center(gate.at[1]);
      if(x<cx-16||x>cx+w+16||y<cy-16||y>cy+h+16)continue;
      const route=model.routes.get(gate.route);
      AveluneOverworldArt.gateway(ctx,x,y,model.routeOpen?model.routeOpen(route):model.has(route?.gate));
    }
    const pose=this.animateActor(model);
    AveluneOverworldArt.hero(ctx,model.leaderId||'roadkeeper',pose.direction,pose.frame,pose.x,pose.y);
    if(nearest){
      const x=model.center(nearest.at[0]),y=model.center(nearest.at[1])-24;
      ctx.font='16px VT323, monospace';ctx.textAlign='center';ctx.textBaseline='bottom';
      const width=Math.ceil(ctx.measureText(nearest.name).width)+12;
      const labelX=Math.round(Math.max(cx+width/2+3,Math.min(cx+w-width/2-3,x)));
      ctx.fillStyle='#0b1325ed';ctx.fillRect(labelX-width/2,y-17,width,20);
      ctx.fillStyle=AVELUNE_PALETTE.cream;ctx.fillText(nearest.name,labelX,y);
    }
    ctx.restore();
    if(objective)this.marker(model,objective,cx,cy,w,h,t);
  }

  cameraAxis(at, view, min, max) {
    if (max-min <= view) return Math.floor((min+max-view)/2);
    return Math.round(Math.min(max-view,Math.max(min,at-view/2)));
  }

  marker(model, at, cx, cy, w, h, t) {
    const ctx=this.ctx;
    const x=model.center(at[0])-cx;
    const y=model.center(at[1])-cy-22;
    const tx=Math.min(w-15,Math.max(15,Math.round(x)));
    const ty=Math.min(h-17,Math.max(29,Math.round(y)));
    const pulse=Math.round(1.5*Math.sin(t*4));
    ctx.fillStyle='#172832';
    ctx.fillRect(tx-5,ty+pulse-5,11,11);
    ctx.fillStyle='#edc97e';
    ctx.beginPath();
    ctx.moveTo(tx,ty+pulse-5);ctx.lineTo(tx+5,ty+pulse);
    ctx.lineTo(tx,ty+pulse+5);ctx.lineTo(tx-5,ty+pulse);
    ctx.fill();
    ctx.fillStyle='#fff1c8';
    ctx.fillRect(tx-1,ty+pulse-2,3,3);
  }

  passage(mode, amount) {
    this.size();
    const ctx=this.ctx;
    const {width:w,height:h}=this.canvas;
    const air=mode==='skiff';
    const land=mode==='caravan'||mode==='tallowback';
    const progress=this.reduce ? .5 : amount;
    ctx.fillStyle=air?'#406681':land?'#a78454':'#235775';
    ctx.fillRect(0,0,w,h);
    for (let i=0;i<35;i++) {
      const x=((i*79+31-progress*w)%w+w)%w;
      const y=(i*37+22)%h;
      ctx.fillStyle=air?'#98b7c48a':land?'#c49f65':'#75b7bb';
      ctx.fillRect(Math.round(x),y,air?38:9,air?4:1);
      if (air) ctx.fillRect(Math.round(x+5),y-4,25,4);
    }
    const asset=air?'party_travel_skiff_east':mode==='sea_passage'?'ocean_packet'
      :land?'party_travel_tallowback_east':'party_travel_ferry_east';
    const x = Math.round(w*(.29+.43*progress));
    const y = h*.59 + (this.reduce ? 0 : Math.round(Math.sin(progress*14)*3));
    if (!air&&!land){ctx.fillStyle=AVELUNE_PALETTE.waterFoam;ctx.fillRect(x-40,y+3,14,1);ctx.fillRect(x-53,y+6,7,1);}
    this.stamp(ctx,asset,x,Math.round(y),air?80:64);
  }
}
