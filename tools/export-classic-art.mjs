/** Render the same character source used by the world/battle into portable menu portraits. */
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage();await page.setContent('<!doctype html><html><body></body></html>');
 await page.addScriptTag({content:await fs.readFile('src/pixel-art.js','utf8')});
 const images=await page.evaluate(()=>{
  const out={};
  for(const id of ['roadkeeper','mara','iven','sella']){
   const c=document.createElement('canvas');c.width=c.height=48;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.scale(2,2);AvelunePixelArt.drawHero(ctx,id,'down',0,12,24);out['classic-'+id+'.png']=c.toDataURL('image/png');
  }
  const c=document.createElement('canvas');c.width=4*16;c.height=4*24;const ctx=c.getContext('2d');
  ['down','left','right','up'].forEach((direction,row)=>{for(let frame=0;frame<4;frame++)AvelunePixelArt.drawHero(ctx,'roadkeeper',direction,frame,frame*16+8,(row+1)*24)});
  out['classic-roadkeeper-walk.png']=c.toDataURL('image/png');return out;
 });
 for(const [name,data]of Object.entries(images))await fs.writeFile('public/assets/'+name,Buffer.from(data.split(',')[1],'base64'));
 const art=JSON.parse(await fs.readFile('src/art.json','utf8'));art.heroes=Object.fromEntries(['roadkeeper','mara','iven','sella'].map(id=>[id,'assets/classic-'+id+'.png']));await fs.writeFile('src/art.json',JSON.stringify(art));
 console.log('Exported four portraits and a directional walk sheet from the shared character artist.');
}finally{await browser.close()}
