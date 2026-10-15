import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { canOccupy } from '../src/navigation.mjs';

const url=process.env.BASE_URL||'http://localhost:5173';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const diag=()=>page.evaluate(()=>window.__homeDiagnostics());
const settled=()=>page.waitForFunction(()=>!window.__homeDiagnostics().transitioning,{timeout:30000});
await fs.mkdir('artifacts',{recursive:true});
try {
 await page.goto(url);await page.waitForFunction(()=>window.__homeDiagnostics,{timeout:90000});
 await page.waitForSelector('#loading',{state:'detached',timeout:90000});
 const data=await diag();
 assert.equal(data.mode,'orbit');assert.equal(data.room,'all');assert.ok(data.triangles>100000,'real furnished geometry renders');assert.ok(data.meshes<350,'static batching keeps draw calls manageable');
 assert.ok(data.spawnChecks.every(r=>r.valid),'every room arrival point is collision-free');
 // Flood-fill the actual runtime collision layout: every room must connect to the entrance.
 const {rooms,outline,colliders}=data,step=.08,minX=-.4,minZ=-1.2,w=164,h=154;
 const free=new Uint8Array(w*h),visited=new Uint8Array(w*h);
 for(let iz=0;iz<h;iz++)for(let ix=0;ix<w;ix++)free[iz*w+ix]=Number(canOccupy(minX+ix*step,minZ+iz*step,outline,colliders));
 const index=([x,z])=>Math.round((z-minZ)/step)*w+Math.round((x-minX)/step);
 const start=index(rooms.find(r=>r.id==='entry').spawn),queue=[start];visited[start]=1;
 for(let n=0;n<queue.length;n++) {
  const i=queue[n],ix=i%w;
  const neighbors=[i-w,i+w];if(ix>0)neighbors.push(i-1);if(ix<w-1)neighbors.push(i+1);
  for(const next of neighbors)if(next>=0&&next<w*h&&free[next]&&!visited[next]){visited[next]=1;queue.push(next);}
 }
 for(const r of rooms)assert.equal(visited[index(r.spawn)],1,`${r.id} must be reachable on foot from the entry`);
 await page.screenshot({path:'artifacts/desktop.png'});
 await page.locator('[data-nav="study"]').click();await settled();assert.equal((await diag()).room,'study');
 await page.locator('#enter-btn').click();assert.equal((await diag()).mode,'walk');
 const before=(await diag()).position;
 await page.keyboard.down('w');await page.waitForFunction(p=>{const a=window.__homeDiagnostics().position;return Math.hypot(a.x-p.x,a.z-p.z)>.08},before,{timeout:30000});await page.keyboard.up('w');
 const moved=(await diag()).position;assert.ok(Math.hypot(moved.x-before.x,moved.z-before.z)>.05,'keyboard moves camera');assert.ok(moved.x<6.1,'fixed glass blocks eastward walking');
 await page.locator('#curtain-btn').click();assert.equal((await diag()).curtain,true);await page.locator('#curtain-btn').click();assert.equal((await diag()).curtain,false);
 await page.keyboard.press('Escape');await settled();assert.equal((await diag()).mode,'orbit');
 for(const r of rooms) {
  await page.locator(`[data-nav="${r.id}"]`).click();if((await diag()).mode!=='walk')await page.locator('#enter-btn').click();
  const state=await diag();assert.equal(state.mode,'walk');assert.equal(state.room,r.id);assert.ok(canOccupy(state.position.x,state.position.z,outline,colliders));
 }
 await page.locator('[data-nav="living"]').click();await page.screenshot({path:'artifacts/living.png'});
 // Drag-look also works without pointer lock or browser-specific permissions.
 const canvas=page.locator('#viewport>canvas'),bounds=await canvas.boundingBox();
 const yaw=(await diag()).yaw;await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+70,bounds.y+bounds.height/2+10,{steps:6});await page.mouse.up();assert.notEqual((await diag()).yaw,yaw);
 await page.locator('#night-btn').click();assert.equal((await diag()).night,true);await page.screenshot({path:'artifacts/night-interior.png'});
 await page.locator('[data-mode="orbit"]').click();await settled();await page.screenshot({path:'artifacts/night-overview.png'});
 await page.locator('#day-btn').click();assert.equal((await diag()).night,false);
 await page.locator('#cutaway-btn').click();assert.equal((await diag()).cutaway,true);await page.screenshot({path:'artifacts/cutaway.png'});
 await page.locator('[data-mode="plan"]').click();await settled();assert.equal((await diag()).mode,'plan');
 await page.locator('[data-map="guest"]').click();await settled();assert.equal((await diag()).room,'guest');
 await page.locator('#labels-btn').click();await page.locator('.room-label').first().waitFor({state:'hidden'});assert.equal(await page.locator('.room-label:visible').count(),0);await page.locator('#labels-btn').click();
 await page.locator('#reference-btn').click();assert.equal(await page.locator('#reference-modal').evaluate(d=>d.open),true);
 await page.locator('[data-ref="night"]').click();assert.match(await page.locator('#reference-image').getAttribute('src'),/night.png$/);await page.keyboard.press('Escape');
 await page.locator('#help-btn').click();await page.locator('#help-start').click();assert.equal(await page.locator('#help-modal').evaluate(d=>d.open),false);
 const downloadPromise=page.waitForEvent('download');await page.locator('#capture-btn').click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/\.png$/);
 await page.locator('#reset-btn').click();await settled();assert.equal((await diag()).room,'all');
 // Responsive layout and touch controls.
 await page.setViewportSize({width:390,height:844});await page.locator('#reset-btn').click();await settled();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile has no horizontal overflow');
 await page.screenshot({path:'artifacts/mobile.png'});
 await page.locator('#mobile-menu').click();await page.locator('[data-nav="kitchen"]').click();assert.equal((await diag()).room,'kitchen');assert.equal(await page.locator('#sidebar').evaluate(s=>s.classList.contains('mobile-open')),false);
 await page.locator('#enter-btn').click();assert.equal((await diag()).mode,'walk');assert.equal(await page.locator('#walk-pad').isVisible(),true);
 const touchBefore=(await diag()).position;
 const pad=await page.locator('[data-key="KeyS"]').boundingBox();await page.mouse.move(pad.x+pad.width/2,pad.y+pad.height/2);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();
 const touchAfter=(await diag()).position;assert.ok(Math.hypot(touchBefore.x-touchAfter.x,touchBefore.z-touchAfter.z)>.01,'on-screen directions move camera');
 assert.deepEqual(errors,[],'no browser runtime errors');
 console.log('PASS: rendered 3D, all 9 room spawns and entrance paths, fixed-glass collision, keyboard/drag/touch navigation, all views, day/night, curtain, minimap, reference dialogs, PNG export, mobile layout; no browser errors.');
} catch(error) { const d=await diag();console.error('Last browser state:',JSON.stringify({mode:d.mode,room:d.room,keys:d.keys,frame:d.frame,position:d.position}));throw error; } finally {await browser.close();}
