/* Town merchants share the field's native pixel grid; signposts are visible before interaction. */
const AveluneServiceArt=(()=>{
 const labels={inn:'INN',camp:'REST',item:'ITEMS',weapon:'ARMS',armor:'ARMOR',magic:'MAGIC',chapel:'CLINIC',guild:'GUILD',rumor:'INFO'};
 const people={inn:'inn',camp:'wyla',item:'tavi',weapon:'bram',armor:'mara',magic:'sella',chapel:'iven',guild:'mara',rumor:'roadkeeper'};
 function draw(ctx,service,x,y){
  const p=AVELUNE_PALETTE,label=service.free&&service.type==='inn'?'FREE':labels[service.type]||'SHOP';
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#17233466';ctx.fillRect(x-7,y-1,14,3);
  AvelunePixelArt.drawHero(ctx,people[service.type]||'inn','down',0,x,y);
  const w=Math.max(24,label.length*5+8),left=Math.round(x-w/2),top=y-38;
  ctx.fillStyle=p.ink;ctx.fillRect(left-1,top-1,w+2,12);ctx.fillStyle='#1b355d';ctx.fillRect(left,top,w,10);
  ctx.fillStyle=p.gold;ctx.fillRect(left,top,w,1);ctx.fillStyle=p.cream;ctx.font='10px VT323,monospace';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText(label,x,top+8);
  ctx.restore();
 }
 return{draw};
})();
