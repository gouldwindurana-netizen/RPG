/* Original Avelune pixel monsters. No external game sprites are used.
 * drawAveluneEnemy(ctx, key, x, y, scale=1): bottom-center anchor; 32x32 logical pixels.
 * Keys: slime, wolf, wisp, guardian, serpent, moth, crown, boar, crow, crab, plant, bell, star. */
const AveluneEnemyArt = (() => {
  const P={o:'#172334',d:'#0b1325',s:'#687984',m:'#93a0a6',l:'#c4c4b6',w:'#f1e6c6',g:'#3c6044',v:'#709254',y:'#e2bc69',a:'#a17a54',r:'#cf7755',p:'#a597b9',b:'#315f85',c:'#76a9ba'};
  const maps={};
  function make(draw){const a=Array.from({length:32},()=>Array(32).fill('.'));const dot=(x,y,c)=>{if(x>=0&&x<32&&y>=0&&y<32)a[y][x]=c;};const rect=(x,y,w,h,c)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)dot(i,j,c);};const oval=(cx,cy,rx,ry,c)=>{for(let y=0;y<32;y++)for(let x=0;x<32;x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)dot(x,y,c);};draw({a,dot,rect,oval});return a;}
  maps.slime=make(({dot,rect,oval})=>{
    oval(16,24,12,6,'g');oval(16,21,9,8,'v');oval(14,19,6,5,'c');rect(10,15,4,2,'w');rect(8,26,18,3,'g');
    rect(11,21,3,4,'o');rect(20,21,3,4,'o');dot(12,21,'w');dot(21,21,'w');rect(15,26,5,1,'d');dot(25,22,'l');dot(6,25,'v');
  });
  maps.wolf=make(({dot,rect,oval})=>{
    rect(4,19,17,7,'s');rect(7,17,11,4,'m');rect(20,13,7,9,'m');rect(24,17,6,4,'l');rect(28,18,3,2,'o');
    rect(20,9,3,6,'s');rect(25,10,3,5,'s');rect(21,11,1,3,'r');rect(26,12,1,2,'r');rect(22,16,2,2,'y');dot(23,16,'o');
    rect(6,24,3,5,'m');rect(16,24,3,5,'m');rect(4,29,6,2,'l');rect(15,29,6,2,'l');
    rect(2,16,3,6,'s');rect(0,12,3,6,'m');rect(0,10,2,3,'l');rect(10,19,7,2,'l');rect(7,24,8,2,'d');dot(26,21,'w');
  });
  maps.wisp=make(({dot,rect,oval})=>{
    oval(16,22,8,8,'r');oval(16,21,6,8,'y');oval(15,23,4,6,'w');
    rect(12,13,4,10,'y');rect(13,10,3,6,'y');rect(15,7,2,7,'r');rect(17,3,2,5,'r');rect(20,16,3,7,'r');rect(22,12,2,5,'y');rect(8,16,2,7,'r');rect(6,13,2,5,'y');
    rect(11,21,3,2,'o');rect(19,21,3,2,'o');dot(15,25,'o');dot(16,25,'o');dot(4,25,'y');dot(27,20,'y');dot(8,7,'y');
  });
  maps.guardian=make(({dot,rect,oval})=>{
    rect(11,5,10,8,'s');rect(10,7,12,5,'m');rect(12,5,8,3,'l');rect(10,11,12,3,'d');rect(13,10,3,2,'y');rect(18,10,2,2,'y');
    rect(13,2,6,3,'a');rect(15,0,2,4,'y');rect(8,14,16,11,'s');rect(10,14,12,8,'m');rect(13,15,6,3,'y');rect(15,18,2,5,'a');
    rect(4,15,5,10,'m');rect(23,15,5,10,'s');rect(3,17,8,12,'d');rect(4,17,6,10,'b');rect(6,18,2,8,'y');rect(4,21,6,2,'y');
    rect(11,25,4,6,'s');rect(18,25,4,6,'s');rect(9,29,7,3,'m');rect(17,29,7,3,'m');rect(25,9,2,16,'a');rect(23,6,6,6,'l');rect(24,7,4,3,'s');
  });
  maps.serpent=make(({dot,rect,oval})=>{
    oval(16,27,12,4,'g');oval(18,25,8,4,'v');rect(9,26,12,3,'y');rect(21,15,5,10,'g');rect(19,12,6,10,'v');rect(15,10,8,5,'v');
    rect(7,8,12,7,'v');rect(5,10,6,5,'g');rect(6,9,9,2,'l');rect(8,12,3,2,'y');dot(9,12,'o');rect(13,13,6,2,'g');rect(6,15,5,1,'r');dot(5,16,'r');dot(5,14,'r');
    rect(18,16,4,3,'y');rect(19,20,3,3,'y');dot(25,25,'l');dot(23,18,'l');dot(14,8,'y');dot(18,10,'y');dot(8,28,'l');
  });
  maps.moth=make(({dot,rect,oval})=>{
    oval(8,13,7,9,'p');oval(23,13,7,9,'p');oval(9,23,6,6,'b');oval(22,23,6,6,'b');
    oval(8,13,4,5,'y');oval(23,13,4,5,'y');oval(8,13,2,3,'d');oval(23,13,2,3,'d');dot(8,12,'w');dot(23,12,'w');
    oval(15.5,18,2.5,10,'d');rect(14,9,4,5,'m');rect(14,10,1,2,'y');rect(17,10,1,2,'y');
    rect(12,5,2,4,'m');rect(18,5,2,4,'m');dot(11,4,'l');dot(20,4,'l');rect(14,17,4,1,'a');rect(14,21,4,1,'a');
    dot(5,24,'c');dot(26,24,'c');dot(8,26,'c');dot(23,26,'c');
  });
  maps.crown=make(({dot,rect,oval})=>{
    rect(8,11,16,7,'a');rect(6,5,3,11,'y');rect(23,5,3,11,'y');rect(14,2,4,13,'y');rect(8,9,5,7,'y');rect(19,9,5,7,'y');
    dot(7,4,'w');dot(24,4,'w');rect(15,0,2,2,'w');rect(7,15,18,3,'y');rect(10,15,2,2,'r');rect(15,15,2,2,'c');rect(20,15,2,2,'r');
    oval(16,23,10,6,'d');oval(16,23,7,5,'p');rect(9,20,14,3,'s');rect(11,22,3,2,'c');rect(18,22,3,2,'c');rect(14,26,4,1,'o');
    dot(3,19,'p');dot(28,19,'p');dot(5,26,'p');dot(26,27,'p');dot(10,30,'p');dot(21,30,'p');
  });
  maps.boar=make(({dot,rect,oval})=>{
    oval(16,21,11,8,'a');oval(13,18,8,5,'r');rect(5,14,9,9,'a');rect(2,18,9,7,'r');rect(1,20,6,4,'a');
    rect(5,10,3,7,'r');rect(10,10,3,6,'a');rect(7,18,2,2,'o');dot(7,18,'y');rect(5,23,2,4,'w');rect(3,23,3,2,'w');
    rect(9,27,4,4,'d');rect(23,26,4,5,'d');rect(13,11,3,8,'g');rect(17,10,3,9,'g');rect(21,12,3,7,'g');rect(28,18,3,2,'a');rect(29,15,2,4,'a');
  });
  maps.crow=make(({dot,rect,oval})=>{
    oval(16,21,6,8,'d');oval(16,13,5,5,'s');rect(11,11,4,5,'o');rect(20,14,7,3,'y');rect(21,17,4,1,'a');dot(18,12,'w');dot(19,12,'r');
    for(let i=0;i<5;i++){rect(1+i*2,9+i*2,4,11-i,'s');rect(23-i*2,9+i*2,4,11-i,'d');}
    rect(8,18,6,5,'p');rect(21,18,4,5,'p');rect(13,28,2,3,'a');rect(19,28,2,3,'a');rect(11,30,5,1,'y');rect(18,30,5,1,'y');
  });
  maps.crab=make(({dot,rect,oval})=>{
    oval(16,22,10,6,'r');oval(15,20,8,4,'a');rect(11,14,2,7,'r');rect(20,14,2,7,'r');rect(10,13,3,3,'w');rect(20,13,3,3,'w');dot(11,14,'o');dot(21,14,'o');
    for(let i=0;i<3;i++){rect(3,21+i*3,7,2,'r');rect(23,21+i*3,6,2,'r');rect(1+i,23+i*3,2,3,'a');rect(29-i,23+i*3,2,3,'a');}
    rect(4,14,3,7,'r');rect(25,14,3,7,'r');rect(1,8,8,6,'r');rect(23,8,8,6,'r');rect(4,7,2,5,'o');rect(26,7,2,5,'o');rect(11,24,11,2,'d');dot(15,18,'y');
  });
  maps.plant=make(({dot,rect,oval})=>{
    rect(14,12,4,17,'g');oval(9,22,6,3,'v');oval(23,25,6,3,'g');rect(9,29,14,2,'a');
    oval(10,8,5,6,'r');oval(22,8,5,6,'r');oval(16,4,5,4,'r');oval(16,12,7,6,'y');oval(16,10,6,4,'d');
    rect(11,9,2,3,'w');rect(15,8,2,3,'w');rect(20,9,2,3,'w');rect(14,13,2,2,'w');rect(18,13,2,2,'w');dot(13,5,'w');dot(21,6,'w');
  });
  maps.bell=make(({dot,rect,oval})=>{
    rect(13,1,6,3,'a');rect(11,4,10,3,'y');rect(9,7,14,5,'a');rect(7,12,18,10,'y');rect(5,21,22,4,'a');rect(3,25,26,3,'y');
    rect(10,9,3,12,'w');rect(13,8,3,12,'y');rect(19,8,3,14,'r');rect(9,16,14,2,'a');rect(14,28,4,3,'y');rect(13,30,6,2,'a');
    rect(12,20,3,2,'o');rect(19,20,3,2,'o');dot(13,20,'c');dot(20,20,'c');
  });
  maps.star=make(({dot,rect,oval})=>{
    for(let y=0;y<28;y++){const half=Math.max(1,Math.round(8-Math.abs(y-14)*.52));rect(16-half,y+1,half*2+1,1,'y');}
    for(let x=1;x<31;x++){const half=Math.max(1,Math.round(6-Math.abs(x-16)*.32));rect(x,16-half,1,half*2+1,'y');}
    oval(16,16,6,6,'p');oval(16,16,4,4,'c');rect(13,14,2,2,'w');rect(18,14,2,2,'w');rect(14,19,4,1,'d');dot(6,5,'w');dot(26,27,'c');dot(4,28,'p');
  });
  const aliases={wickling:'wisp',flame:'wisp',fire:'wisp',miller:'guardian',warden:'guardian',golem:'guardian',knight:'guardian',sentinel:'guardian',hollow:'crown',wyrm:'serpent',eel:'serpent',dragon:'serpent',bat:'moth',insect:'moth',rat:'wolf',beast:'wolf',goblin:'guardian'};
  function get(key){key=String(key||'slime').toLowerCase();return maps[key]||maps[aliases[key]]||maps[Object.keys(aliases).find(k=>key.includes(k))?aliases[Object.keys(aliases).find(k=>key.includes(k))]:'slime'];}
  return {maps,palette:P,get};
})();
function drawAveluneEnemy(ctx,key,x,y,scale=1){
  const pixels=AveluneEnemyArt.get(key),s=Math.max(.25,scale),left=Math.round(x-16*s),top=Math.round(y-32*s);
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#101824';
  for(let j=0;j<32;j++)for(let i=0;i<32;i++)if(pixels[j][i]!=='.')for(const [dx,dy] of [[0,-1],[-1,0],[1,0],[0,1]])if(!pixels[j+dy]||!pixels[j+dy][i+dx]||pixels[j+dy][i+dx]==='.')ctx.fillRect(left+(i+dx)*s,top+(j+dy)*s,s,s);
  for(let j=0;j<32;j++)for(let i=0;i<32;i++){const c=pixels[j][i];if(c!=='.'){ctx.fillStyle=AveluneEnemyArt.palette[c];ctx.fillRect(left+i*s,top+j*s,s,s);}}
  ctx.restore();
}
