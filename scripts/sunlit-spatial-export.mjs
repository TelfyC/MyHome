/** Exports the latest independent Three scene through the running local Vite. */
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd(),out=path.resolve(process.env.SPATIAL_OUTPUT||'public/concepts/spatial/sunlit/references');
const archive=path.resolve('output/imagegen/sunlit-spatial-20261102');
const base=process.env.BASE_URL||'http://localhost:5173';
function planSvg(scene,roomId){
 const parent=scene.rooms.find(r=>r.id===roomId);
 let polygon=parent?.polygon||scene.outline;
 if(roomId==='dining')polygon=[...polygon,...scene.rooms.find(r=>r.id==='balcony').polygon];
 const xs=polygon.map(p=>p[0]),zs=polygon.map(p=>p[1]);
 let left=Math.min(...xs)-.30,right=Math.max(...xs)+.30,top=Math.min(...zs)-.30,bottom=Math.max(...zs)+.30;
 const sw=right-left,sh=bottom-top,header=.48,footer=.50;
 const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
 const line=(a,b,stroke,width,extra='')=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
 const roleNames={'living-sofa':'沙发','tv-console':'电视柜','living-coffee-table':'白茶几','reading-chair':'阅读椅','reading-ottoman':'脚凳','side-table':'32cm边几','reading-lamp':'阅读灯','dining-table':'深木餐桌','dining-bench':'长凳','coffee-sideboard':'咖啡柜','master-bed':'1.8m床','master-wardrobe':'衣柜','master-dressing-cabinet':'衣帽柜','master-nightstand-left':'床头几','master-nightstand-right':'床头几','guest-bed':'1.2m床','guest-desk':'2.3m长桌','guest-wardrobe':'衣柜','guest-chair':'椅','gaming-desk':'电竞桌','gaming-chair':'椅','display-cabinet':'展示柜','north-counter':'北洗炒线','south-prep-counter':'南备餐台','east-counter':'东短台','refrigerator':'冰箱','washer':'洗衣机','basin':'台盆','toilet':'马桶','shower':'淋浴'};
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1400" viewBox="${left} ${top-header} ${sw} ${sh+header+footer}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10Z" fill="#ad593b"/></marker></defs><rect x="${left}" y="${top-header}" width="${sw}" height="${sh+header+footer}" fill="#faf9f2"/><g font-family="Noto Sans CJK SC,Noto Sans SC,sans-serif">`;
 svg+=`<text x="${left+.12}" y="${top-.19}" font-size=".20" fill="#334a3b">${esc(parent?.name||'日光花园 · 全屋结构及机位定位')}</text><text x="${right-.12}" y="${top-.19}" font-size=".105" fill="#697568" text-anchor="end">图纸上方 ↑　单位 m</text>`;
 for(const r of scene.rooms){svg+=`<path d="M${r.polygon.map(p=>p.join(',')).join(' L')}Z" fill="${r.id==='kitchen'||r.id==='bathroom'?'#ecebe1':'#efe6d5'}" stroke="#d3cbb9" stroke-width=".016"/>`;}
 for(const w of scene.walls){if(w.base>.01)continue;svg+=line(w.start,w.end,'#48554b',w.thickness);}
 for(const o of scene.openings){if(o.kind==='window'){svg+=line(o.start,o.end,'#d2e7e3',.10);svg+=line(o.start,o.end,'#508788',.025);}else if(o.kind==='retractable'){svg+=line(o.start,o.end,'#508788',.035,'stroke-dasharray=".10 .07"');}else{svg+=line(o.start,o.end,'#c39e70',.025);}}
 const furn=scene.furniture.filter(f=>!roomId||f.roomId===roomId||(roomId==='dining'&&f.roomId==='balcony'));
 for(const f of furn){if(f.wallMounted)continue;const c=f.id==='dining-table'?'#80523c':f.id==='reading-chair'?'#b3bda5':f.roomId==='kitchen'?'#d9decf':'#d8c5a4';svg+=`<g transform="rotate(${-f.rotation*180/Math.PI} ${f.x} ${f.z})"><rect x="${f.x-f.width/2}" y="${f.z-f.depth/2}" width="${f.width}" height="${f.depth}" rx=".025" fill="${c}" stroke="#7e8474" stroke-width=".016"/></g>`;svg+=`<text x="${f.x}" y="${f.z+.025}" font-size="${roomId?'.09':'.075'}" fill="${f.id==='dining-table'?'#fffaf0':'#3e4d3e'}" text-anchor="middle">${esc(roleNames[f.id]||'')}</text>`;}
 for(const c of scene.cameras){if(roomId&&c.roomId!==roomId)continue;const x=c.position[0],z=c.position[2],dx=c.target[0]-x,dz=c.target[2]-z,n=Math.hypot(dx,dz);svg+=line([x,z],[x+.55*dx/n,z+.55*dz/n],'#ad593b',.026,'marker-end="url(#arrow)"');svg+=`<circle cx="${x}" cy="${z}" r=".065" fill="#ad593b" stroke="#fff" stroke-width=".018"/><text x="${x+.09}" y="${z-.07}" font-size=".095" fill="#9b4f36">${esc(c.id)}</text>`;}
 svg+=`<text x="${left+.12}" y="${bottom+.17}" font-size=".10" fill="#566452">同版数值制图 · 墙／窗／家具占位／虚拟机位　${scene.structureHash.slice(0,12)}</text><text x="${left+.12}" y="${bottom+.34}" font-size=".085" fill="#7e8879">门窗和墙厚含推定值；并非现场实测施工图。机位不代表人体站立位置。</text></g></svg>`;return svg;
}
async function makeMaps(scene,page){
 const mapFiles=[];
 for(const id of [null,'living','dining','kitchen','master','study','guest','bathroom']){
  const name=id?id+'-map':'plan-map',svg=planSvg(scene,id);await page.setViewportSize({width:1600,height:1400});await page.setContent(`<style>html,body{margin:0;background:#faf9f2}svg{display:block}</style>${svg}`);await page.evaluate(()=>document.fonts.ready);
  const png=await page.screenshot({type:'png'});mapFiles.push({id:name,png:name+'.png',svg:name+'.svg',resolution:[1600,1400],pngSha256:crypto.createHash('sha256').update(png).digest('hex'),svgSha256:crypto.createHash('sha256').update(svg).digest('hex')});for(const dir of [out,archive]){await fs.writeFile(path.join(dir,name+'.svg'),svg);await fs.writeFile(path.join(dir,name+'.png'),png);} }
 const payload={structureHash:scene.structureHash,method:'deterministic numeric SVG plan drawn directly from frozen scene.json, rasterized by Chromium',files:mapFiles};for(const dir of [out,archive])await fs.writeFile(path.join(dir,'map-manifest.json'),JSON.stringify(payload,null,2)+'\n');
}
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}});page.setDefaultTimeout(180000);
 if(process.argv.includes('--maps-only')){await makeMaps(JSON.parse(await fs.readFile(path.join(out,'scene.json'),'utf8')),page);console.log('Plan maps written');}else{
 await page.goto(new URL('/concepts/sunlit-refined.html',base).href,{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{
  const {buildSunlitSpatialScene}=await import('/src/sunlit-spatial-scene.ts');
  const {GLTFExporter}=await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
  const home=buildSunlitSpatialScene();const data=await new GLTFExporter().parseAsync(home.root,{binary:true,onlyVisible:false});
  const bytes=new Uint8Array(data);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return {scene:home.scene,base64:btoa(binary)};
 });
 await fs.mkdir(out,{recursive:true});await fs.mkdir(archive,{recursive:true});
 const files=['src/dimensions.ts','src/plan.ts','src/model.ts','src/sunlit-spatial-scene.ts','docs/newStructure.jpg','public/references/plan.png','docs/窗边放松区与中式厨房_20261028.md'];
 const sources=await Promise.all(files.map(async file=>({path:file,sha256:crypto.createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex')})));
 const structureHash=crypto.createHash('sha256').update(JSON.stringify({walls:result.scene.walls,openings:result.scene.openings,rooms:result.scene.rooms.map(r=>({id:r.id,polygon:r.polygon})),furniture:result.scene.furniture,doorGroups:result.scene.doorGroups})).digest('hex');
 const scene={...result.scene,structureHash,sources};const sceneBytes=Buffer.from(JSON.stringify(scene,null,2)+'\n');const glb=Buffer.from(result.base64,'base64');
 const manifest={version:scene.version,created:new Date().toISOString(),structureHash,sources,scene:{path:'scene.json',sha256:crypto.createHash('sha256').update(sceneBytes).digest('hex')},model:{path:'scene.glb',bytes:glb.length,sha256:crypto.createHash('sha256').update(glb).digest('hex')},cameras:scene.cameras,status:'deterministic-reference; inferred source dimensions retained'};
 for(const dir of [out,archive]){await fs.writeFile(path.join(dir,'scene.json'),sceneBytes);await fs.writeFile(path.join(dir,'scene.glb'),glb);await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');}
 await makeMaps(scene,page);
 console.log(JSON.stringify({output:out,bytes:glb.length,structureHash,walls:scene.walls.length,windows:scene.openings.filter(o=>o.kind==='window').length,cameras:scene.cameras.length}));
 }
}finally{await browser.close();}
