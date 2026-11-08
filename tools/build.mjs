import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve('.');const read=(p)=>fs.readFile(path.join(root,p),'utf8');
const layout=JSON.parse(await read('src/world.json'));
for(const area of Object.values(layout.areas))for(const key of ['lanes','crossings','watercourses'])delete area[key];
const art=JSON.parse(await read('src/art.json'));
const fontRoot='node_modules/@fontsource/';
await fs.copyFile(fontRoot+'vt323/files/vt323-latin-400-normal.woff2','public/assets/pixel.woff2');
await fs.copyFile(fontRoot+'cinzel/files/cinzel-latin-400-normal.woff2','public/assets/heading.woff2');
const style=await read('src/style.css')+'\n'+await read('src/battle.css');
const tokens={STYLE:style,LAYOUT:JSON.stringify(layout),ART:JSON.stringify(art),MODEL:await read('src/model.js'),VIEW:await read('src/view.js'),COMBAT:await read('src/combat.js'),CAMPAIGN:await read('src/campaign.js'),ENEMY:await read('src/enemy-art.js'),BATTLE:await read('src/battle-ui.js'),APP:await read('src/app.js')};
let html=await read('src/shell.html');for(const [key,value]of Object.entries(tokens)){if(!html.includes('@@'+key+'@@'))throw Error('Missing token '+key);html=html.replace('@@'+key+'@@',()=>key==='STYLE'?value:value.replaceAll('</script','<\\/script'));}
await fs.mkdir('dist',{recursive:true});await fs.cp('public/assets','dist/assets',{recursive:true});await fs.writeFile('dist/index.html',html);
if(process.argv.includes('--standalone')){
 const embed=async(value)=>{if(typeof value==='string'&&value.startsWith('assets/')){const data=await fs.readFile('public/'+value);const type=value.endsWith('.webp')?'image/webp':value.endsWith('.woff2')?'font/woff2':'image/png';return 'data:'+type+';base64,'+data.toString('base64')}if(Array.isArray(value))return Promise.all(value.map(embed));if(value&&typeof value==='object'){const out={};for(const [k,v]of Object.entries(value))out[k]=await embed(v);return out}return value};
 const inline=await embed(art);let portable=html.replace(JSON.stringify(art),()=>JSON.stringify(inline));
 for(const file of ['pixel.woff2','heading.woff2'])portable=portable.replaceAll('assets/'+file,'data:font/woff2;base64,'+(await fs.readFile('public/assets/'+file)).toString('base64'));
 await fs.mkdir('release',{recursive:true});await fs.writeFile('release/Avelune.html',portable);
 console.log('Offline HTML:',(Buffer.byteLength(portable)/1024/1024).toFixed(2),'MiB');
}
console.log('Built',Object.keys(layout.areas).length,'areas,',layout.events.length,'events.');
