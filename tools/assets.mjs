/** Reproducible runtime optimization. Source archives remain untouched. */
import sharp from 'sharp';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SOURCE=process.env.AVELUNE_SOURCE || '/workspace/work/source/Avelune_World_Layout_Project';
const OUT=path.join(ROOT,'public/assets');
const LANDSCAPE=process.env.AVELUNE_LANDSCAPE || '/workspace/generated_images/exec-5b64d136-fe1c-4fb5-a842-9ba027dff3ac.png';
await mkdir(path.join(OUT,'grounds'),{recursive:true});
const readJSON=async p=>JSON.parse(await readFile(p,'utf8'));
async function pixelPNG(image,colours=32){
 const {data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let n=3;n<data.length;n+=4){data[n]=data[n]>=128?255:0;if(!data[n])data[n-1]=data[n-2]=data[n-3]=0;}
 return sharp(data,{raw:info}).png({palette:true,colours,dither:0,compressionLevel:9}).toBuffer();
}
const frames=await readJSON(path.join(SOURCE,'data/sprite_rects.json'));
const layout=await readJSON(path.join(SOURCE,'data/world_layout.json'));
const motion=await readJSON(path.join(SOURCE,'data/animations.json'));
const sourceAtlas=await readFile(path.join(SOURCE,'assets/sprites.webp'));
const decodedAtlas=await sharp(sourceAtlas).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const atlasImage=()=>sharp(decodedAtlas.data,{raw:decodedAtlas.info});
const atlasWidth=768,padding=3,newFrames={},composites=[];
let x=padding,y=padding,rowHeight=0;
let before=sourceAtlas.byteLength,after=0;
for (const [key,[left,top,width,height]] of Object.entries(frames)) {
 const max=key.startsWith('party_')?40:64;
 const ratio=Math.min(1,max/Math.max(width,height));
 const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
 if(x+w+padding>atlasWidth){x=padding;y+=rowHeight+padding;rowHeight=0;}
 const input=await pixelPNG(atlasImage().extract({left,top,width,height}).resize(w,h,{kernel:'nearest'}));
 newFrames[key]=[x,y,w,h];composites.push({input,left:x,top:y});
 x+=w+padding;rowHeight=Math.max(rowHeight,h);
}
await sharp({create:{width:atlasWidth,height:y+rowHeight+padding,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composites).png({palette:true,colours:96,dither:0,compressionLevel:9}).toFile(path.join(OUT,'sprites.png'));
after+=(await stat(path.join(OUT,'sprites.png'))).size;
const grounds={};
for(const id of Object.keys(layout.areas)){
 const source=path.join(SOURCE,'assets/grounds',id+'.webp');
 const m=await sharp(source).metadata();before+=(await stat(source)).size;
 const small=await sharp(source).resize(Math.ceil(m.width/2),Math.ceil(m.height/2),{kernel:'nearest'}).png({palette:true,colours:24,dither:0}).toBuffer();
 const dest=path.join(OUT,'grounds',id+'.png');
 await sharp(small).resize(m.width,m.height,{kernel:'nearest'}).png({palette:true,colours:24,dither:0,compressionLevel:9}).toFile(dest);
 grounds[id]='assets/grounds/'+id+'.png';after+=(await stat(dest)).size;
}
const animationSource=path.join(SOURCE,'assets/animation/animation_atlas.png');
before+=(await stat(animationSource)).size;
await writeFile(path.join(OUT,'animation.png'),await pixelPNG(sharp(animationSource),48));
after+=(await stat(path.join(OUT,'animation.png'))).size;
motion.image='assets/animation.png';
const worldSource=path.join(SOURCE,'assets/avelune_world.webp');
before+=(await stat(worldSource)).size;
await sharp(worldSource).resize(1152,768,{kernel:'nearest'}).webp({quality:77,effort:6}).toFile(path.join(OUT,'world.webp'));
after+=(await stat(path.join(OUT,'world.webp'))).size;
const heroes={};
for(const name of ['roadkeeper','mara','iven','sella']){
 const [left,top,width,height]=frames['party_travel_'+name+'_south'];
 const scale=35/height,w=Math.round(width*scale),h=35;
 const body=await pixelPNG(atlasImage().extract({left,top,width,height}).resize(w,h,{kernel:'nearest'}),24);
 const target=path.join(OUT,'party_'+name+'.png');
 await sharp({create:{width:48,height:48,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:body,left:Math.floor((48-w)/2),top:44-h}]).png({palette:true,colours:24,dither:0,compressionLevel:9}).toFile(target);
 heroes[name]='assets/party_'+name+'.png';
}
let landscape=null;
try{
 const land=await sharp(LANDSCAPE).resize(768,512,{kernel:'nearest'}).png({palette:true,colours:64,dither:0,compressionLevel:9}).toBuffer();
 await sharp(land).webp({lossless:true,effort:6}).toFile(path.join(OUT,'landscape.webp'));
 landscape='assets/landscape.webp';
}catch(error){console.warn('Optional generated landscape not available:',error.message);}
const art={motion,sprites:'assets/sprites.png',world:'assets/world.webp',grounds,frames:newFrames,heroes,landscape};
await writeFile(path.join(ROOT,'src/art.json'),JSON.stringify(art));
const report={source:'Three accessible user-supplied archives',spriteFrames:Object.keys(frames).length,groundAreas:Object.keys(grounds).length,originalRuntimeImageBytes:before,optimizedRuntimeImageBytes:after,reductionPercent:Number((100*(1-after/before)).toFixed(2)),generatedLandscape:landscape,notes:['Runtime image byte comparison includes atlas, all grounds, animation and world map.','Generated landscape and four new hero crops are additions, excluded from like-for-like comparison.','Sprite frames are repacked with three transparent pixels of padding.','Ground dimensions, animation anchors and collision data remain unchanged.']};
await writeFile(path.join(ROOT,'docs/asset-metrics.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
