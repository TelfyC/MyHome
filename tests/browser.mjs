import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { canOccupy, moveWithCollision } from '../src/navigation.mjs';

const modelUrl=new URL(process.env.BASE_URL||'http://localhost:5173');
modelUrl.searchParams.set('view','model');
const url=modelUrl.href;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
// Software WebGL screenshots may need longer than Playwright's default.

const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
page.setDefaultTimeout(90000);
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const diag=()=>page.evaluate(()=>window.__homeDiagnostics());
const settled=()=>page.waitForFunction(()=>!window.__homeDiagnostics().transitioning,{timeout:30000});
await fs.mkdir('artifacts',{recursive:true});
try {
 await page.goto(url);await page.waitForFunction(()=>window.__homeDiagnostics,{timeout:90000});
 await page.waitForSelector('#loading',{state:'detached',timeout:90000});
 const data=await diag();
 assert.equal(data.mode,'orbit');assert.equal(data.room,'all');assert.ok(data.triangles>50000,'furnished geometry renders after reducing redundant decorative plants');assert.ok(data.meshes<350,'static batching keeps draw calls manageable');
 assert.ok(data.spawnChecks.every(r=>r.valid),'every room arrival point is collision-free');
 // Check the geometry's shared anchors against the supplied measurements,
 // including the user's confirmation that the 3.45 m includes the upper balcony.
 const {X,Z}=data.sizing.anchors,t=data.sizing.wallThickness;
 const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-6,`${label}: ${actual} vs ${expected}`);
 near(X.bathroomWest-X.guestWest-t,3.05,'guest clear width');
 near(X.studyEast-X.studyWest-t,2.75,'study clear width');
 near(Z.studySouth-Z.studyNorth-t,3.40,'study clear depth');
 near(X.diningWest-X.bathroomWest-t,1.65,'central bathroom clear width');
 near(Z.upperSouth-Z.north-t,3.70,'central bathroom clear depth');
 near(X.kitchenEast-X.livingEast-t,2.62,'kitchen clear width');
 near(Z.kitchenSouth-Z.north-t,2.44,'kitchen clear depth');
 near(Z.kitchenSouth-Z.upperBalconyNorth-t,3.45,'dining plus upper balcony');
 near(Z.studyNorth-Z.upperSouth-t,1.03,'public passage');
 near(Z.masterSouth-t/2-Z.masterSleepingNorth,3.35,'master sleeping depth');
 near(Z.livingStep-Z.kitchenSouth-t,4.60,'open living main depth');
 near(X.lowerAlcoveEast-X.studyEast-t,1.95,'lower alcove width');
 near(Z.livingSouth-Z.livingStep-t,1.80,'lower alcove depth');
 assert.equal(data.windows.some(w=>Math.abs(w.x1-w.x2)<1e-6 &&
   (Math.abs(w.x1-X.masterWest)<1e-6||Math.abs(w.x1-X.guestWest)<1e-6)),false,'both bedroom side windows must be absent');
 assert.ok(data.windows.some(w=>Math.abs(w.z1-Z.masterSouth)<1e-6 && Math.abs(w.z2-Z.masterSouth)<1e-6),'master bottom window remains');
 assert.ok(data.windows.some(w=>Math.abs(w.z1)<1e-6 && Math.abs(w.z2)<1e-6 && w.x1>X.guestWest && w.x2<X.bathroomWest),'guest top window remains');
 // Inspect walls created by the model, then exercise its actual collision geometry.
 assert.equal(data.layout.studyLivingWall.kind,'solid');
 assert.equal(data.layout.kitchen.kind,'open');
 assert.equal(data.layout.kitchen.slidingDoor,false);
 assert.equal('curtain' in data,false,'obsolete curtain diagnostic is removed');
 assert.equal(await page.locator('#curtain-btn').count(),0,'obsolete curtain control is removed');
 const tvWall=data.walls.find(w=>w.name==='solid-tv-backdrop');
 assert.ok(tvWall?.opaque,'former glazing is replaced by opaque wall material');
 near(tvWall.base,0,'TV wall starts at floor');near(tvWall.height,2.7,'TV wall is full height');
 near(tvWall.z1,data.layout.studyLivingWall.infillFrom,'TV wall fills original opening start');
 near(tvWall.z2,data.layout.studyLivingWall.infillTo,'TV wall fills original opening end');
 assert.ok(data.walls.some(w=>w.name==='bearing-wall-upper'),'upper existing solid segment remains');
 assert.ok(data.walls.some(w=>w.name==='bearing-wall-lower'),'lower existing solid segment remains');
 assert.equal(data.colliders.some(c=>['fixed glass','glass-sill','kitchen sliding door'].includes(c.name)),false,'glass and sliding-door obstacles removed');
 assert.equal(data.walls.some(w=>w.x1===X.livingEast&&w.x2===X.livingEast&&Math.max(w.z1,w.z2)>0&&Math.min(w.z1,w.z2)<Z.kitchenSouth),false,'kitchen dining-side partition absent');
 assert.equal(data.walls.some(w=>w.z1===Z.kitchenSouth&&w.z2===Z.kitchenSouth&&Math.min(w.x1,w.x2)<X.entranceEast),false,'kitchen entry-side partition absent');
 const exteriorReturn=data.walls.find(w=>w.name==='kitchen-exterior-return');
 near(exteriorReturn.x1,X.entranceEast,'retain southeast exterior wall start');near(exteriorReturn.x2,X.kitchenEast,'retain southeast exterior wall end');
 assert.ok(data.windows.some(w=>w.z1===0&&w.z2===0&&w.x1>X.livingEast),'kitchen top exterior window remains');
 assert.ok(data.windows.some(w=>w.x1===X.kitchenEast&&w.x2===X.kitchenEast),'kitchen right exterior window remains');
 const directWalk=(from,to,label)=>{
   assert.ok(canOccupy(from.x,from.z,data.outline,data.colliders),`${label} starts in free space`);
   const arrived=moveWithCollision(from,to.x-from.x,to.z-from.z,data.outline,data.colliders);
   assert.ok(Math.hypot(arrived.x-to.x,arrived.z-to.z)<1e-6,`${label} passes former partition directly`);
 };
 directWalk({x:9.4,z:1.2},{x:10.8,z:1.2},'dining to open kitchen');
 directWalk({x:11,z:3.3},{x:11,z:1.6},'entry to open kitchen');
 const appliance=(name)=>{const item=data.colliders.find(c=>c.name===name);assert.ok(item,`${name} exists in actual model`);return item;};
 const fridge=appliance('refrigerator'),washer=appliance('bathroom washer'),coffee=appliance('coffee sideboard');
 near(fridge.maxX-fridge.minX,.70,'true-size refrigerator width');
 near(fridge.maxZ-fridge.minZ,.70,'true-size refrigerator depth including doors');
 assert.ok(fridge.minX>11.8&&fridge.maxZ<.9,'refrigerator is tucked against northeast perimeter');
 assert.equal(data.colliders.some(c=>c.name==='laundry'),false,'former balcony laundry obstruction removed');
 near(washer.maxX-washer.minX,.69,'full-size washer depth with protruding door');
 near(washer.maxZ-washer.minZ,.60,'full-size washer width');
 assert.ok(washer.minX>X.bathroomWest&&washer.maxX<X.diningWest&&washer.minZ>2,'washer occupies bathroom beside basin');
 near(coffee.maxZ-coffee.minZ,1.5,'coffee sideboard length');
 near(coffee.maxX-coffee.minX,.5,'coffee sideboard counter depth');
 const aux=appliance('east kitchen prep cabinets');
 assert.ok(aux.minZ-data.layout.kitchen.refrigerator.doorSweepSouth>=.10,'refrigerator door sweep clears auxiliary counter');
 assert.ok(data.layout.kitchen.hood.x+data.layout.kitchen.hood.width/2<data.layout.kitchen.hood.northWindowStart,'hood stays fully on solid wall');
 directWalk({x:9.4,z:3.3},{x:9.4,z:-.1},'entry through dining to coffee balcony');
 directWalk({x:6.55,z:4.5},{x:6.55,z:2.32},'offset bathroom door to washer aisle');
 const machineFront={x:washer.maxX+.38,z:2.32};
 assert.ok(canOccupy(machineFront.x,machineFront.z,data.outline,data.colliders,.3),'washer front allows a standing adult');
 assert.ok(X.diningWest-.11-washer.maxX>.93,'washer front retains approximately 940 mm aisle');

 const blocked=moveWithCollision({x:X.studyEast-.5,z:7.2},1,0,data.outline,data.colliders);
 assert.ok(blocked.x<X.studyEast-.25,'solid TV backdrop blocks walking from study');
 for(let z=tvWall.z1;z<=tvWall.z2;z+=.1)assert.equal(canOccupy(X.studyEast,z,data.outline,data.colliders),false,'TV wall has no collision gaps');
 const tvConsole=data.colliders.find(c=>c.name==='TV console');
 near(tvConsole.maxX-tvConsole.minX,.42,'TV console product depth');
 near(tvConsole.maxZ-tvConsole.minZ,1.80,'TV console product length');
 // Flood-fill the actual runtime collision layout: every room must connect to the entrance.
 const {rooms,outline,colliders}=data,step=.08;
 const minX=Math.min(...outline.map(p=>p[0]))-.3,minZ=Math.min(...outline.map(p=>p[1]))-.3;
 const w=Math.ceil((Math.max(...outline.map(p=>p[0]))-minX+.3)/step)+1;
 const h=Math.ceil((Math.max(...outline.map(p=>p[1]))-minZ+.3)/step)+1;
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
 const moved=(await diag()).position;assert.ok(Math.hypot(moved.x-before.x,moved.z-before.z)>.05,'keyboard moves camera');assert.ok(moved.x<6.1,'solid TV wall blocks eastward walking');
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
 assert.match(await page.locator('#reference-image').getAttribute('src'),/dimensions.jpg$/);
 await page.waitForFunction(()=>document.querySelector('#reference-image').naturalWidth>0);
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
 console.log('PASS: calibrated dimensions, both side windows removed, original end windows retained, product scales preserved, all 9 rooms reachable, collision, keyboard/drag/touch, all views, lighting, solid TV wall, open kitchen paths, references, PNG export and mobile layout; no browser errors.');
} catch(error) { const d=await diag().catch(()=>null);console.error('Last browser state:',JSON.stringify(d&&{mode:d.mode,room:d.room,keys:d.keys,frame:d.frame,position:d.position}));throw error; } finally {await browser.close();}
