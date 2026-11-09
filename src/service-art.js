/* Indoor keepers and exterior signs use the same native pixel vocabulary. */
const AveluneServiceArt=(()=>{
 const labels={inn:'INN',camp:'REST',item:'ITEMS',weapon:'ARMS',armor:'ARMOR',magic:'MAGIC',chapel:'CLINIC',guild:'GUILD',rumor:'INFO'};
 function sign(ctx,service,x,y){
  const p=AVELUNE_PALETTE,label=service.label||labels[service.type]||'SHOP';
  const w=Math.max(24,label.length*5+8),left=Math.round(x-w/2),top=Math.round(y-22);
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=p.ink;ctx.fillRect(left-1,top-1,w+2,12);
  ctx.fillStyle='#101a81';ctx.fillRect(left,top,w,10);ctx.fillStyle=p.cream;ctx.fillRect(left,top,w,1);
  ctx.font='10px VT323,monospace';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText(label,x,top+8);ctx.restore();
 }
 function draw(ctx,service,x,y){
  if(service.type==='camp'){sign(ctx,service,x,y);return;}
  const p=AVELUNE_PALETTE,coat={inn:p.woodBright,item:p.rust,weapon:p.stone,armor:p.stone,magic:p.violet,chapel:p.cream,guild:p.roof,rumor:p.sand}[service.type]||p.woodBright;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#17233466';ctx.fillRect(x-7,y-1,14,3);
  // Generic apron-wearing keepers are distinct from named party companions.
  ctx.fillStyle=p.ink;ctx.fillRect(x-4,y-8,3,8);ctx.fillRect(x+1,y-8,3,8);
  ctx.fillStyle=p.wood;ctx.fillRect(x-5,y-1,4,1);ctx.fillRect(x+1,y-1,4,1);
  ctx.fillStyle=coat;ctx.fillRect(x-5,y-15,10,9);ctx.fillRect(x-7,y-14,2,7);ctx.fillRect(x+5,y-14,2,7);
  ctx.fillStyle=p.skin;ctx.fillRect(x-7,y-8,2,2);ctx.fillRect(x+5,y-8,2,2);ctx.fillRect(x-4,y-22,8,7);
  ctx.fillStyle=p.wood;ctx.fillRect(x-4,y-23,8,3);ctx.fillRect(x-5,y-21,2,4);ctx.fillRect(x+3,y-21,2,4);
  ctx.fillStyle=p.ink;ctx.fillRect(x-2,y-19,1,1);ctx.fillRect(x+2,y-19,1,1);
  ctx.fillStyle=p.cream;ctx.fillRect(x-3,y-12,6,6);ctx.fillStyle=p.stoneLight;ctx.fillRect(x-3,y-7,6,1);
  ctx.restore();
 }
 return{draw,sign};
})();
