import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});page.setDefaultTimeout(90000);
const base=process.env.BASE_URL||'http://localhost:5173';
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const diag=()=>page.evaluate(()=>window.__roomViewDiagnostics());
const ready=room=>page.waitForFunction(room=>window.__roomViewDiagnostics?.().loaded===room,room);
const rooms=['living','dining','master','study','guest','kitchen','bathroom'];
const references={forest:'axel-vervoordt.com',japanese:'normcph.com',french:'pierreyovanovitch.com',sunlit:'heju.fr'};
await fs.mkdir('artifacts/craft',{recursive:true});
try{
 await page.goto(base);await ready('living');
 assert.equal((await diag()).projection,'rectilinear');assert.equal((await diag()).scheme,'forest');
 assert.equal(await page.locator('canvas').count(),0,'new room views do not need WebGL');
 assert.equal(await page.locator('[data-scheme]').count(),4);assert.equal(await page.locator('[data-scheme=cream]').count(),0);
 for(const style of Object.keys(references)){
  await page.locator(`[data-scheme="${style}"]`).click();await ready('living');
  assert.match(await page.locator('#room-reference-link').getAttribute('href'),new RegExp(references[style]));
  for(const room of rooms){
   await page.locator(`.tour-nav[data-room="${room}"]`).click();await ready(room);
   const d=await diag();assert.equal(d.scheme,style);assert.ok(d.imageWidth>=1500&&d.imageHeight>=1000);
   assert.ok(Math.abs(d.imageWidth/d.imageHeight-1.5)<.03,'independent native perspective image');
   await page.locator('#room-details-open').click();
   assert.ok(await page.locator('#room-details-body section').count()>=7,'ritual placement and finish details are provided');
   assert.match(await page.locator('#room-details-source').getAttribute('href'),new RegExp(references[style]));
   if(room==='guest'){assert.match(await page.locator('#room-details-body').innerText(),/1.20 × 2.10 m/);assert.match(await page.locator('#room-details-body').innerText(),/2.30 × 0.65 m/);}
   if(room==='kitchen')assert.match(await page.locator('#room-details-body').innerText(),/五扇收窗边、四扇收右端/);
   await page.locator('#room-details-close').click();
  }
  await page.locator('.tour-nav[data-room="living"]').click();await ready('living');
  await page.screenshot({path:`artifacts/craft/${style}-living.png`});
 }
 await page.locator('#room-zoom-in').click();assert.ok((await diag()).scale>1);
 await page.locator('#room-reset').click();assert.equal((await diag()).scale,1);
 const download=page.waitForEvent('download');await page.locator('#room-save').click();assert.match((await download).suggestedFilename(),/空间效果\.jpg$/);
 await page.locator('#room-materials-open').click();assert.equal(await page.locator('#room-samples figure').count(),4);await page.locator('#room-materials-close').click();
 await page.locator('.tour-nav[data-room="guest"]').click();await ready('guest');
 assert.match(await page.locator('#room-panorama-link').getAttribute('href'),/scene=panorama&design=sunlit&room=guest/);
 await page.locator('#room-panorama-link').click();await page.waitForFunction(()=>window.__panoramaDiagnostics?.().loaded==='guest');
 assert.equal(await page.evaluate(()=>window.__panoramaDiagnostics().scheme),'sunlit');
 await page.locator('#tour-room-view-link').click();await ready('guest');assert.equal((await diag()).scheme,'sunlit');
 // A prior image request cannot replace the newest room.
 await page.route('**/room-views/sunlit/dining.jpg',async route=>{await new Promise(r=>setTimeout(r,500));await route.continue();});
 await page.locator('.tour-nav[data-room="dining"]').click();await page.locator('.tour-nav[data-room="living"]').click();await ready('living');await page.waitForTimeout(700);assert.equal((await diag()).loaded,'living');await page.unroute('**/room-views/sunlit/dining.jpg');
 await page.route('**/room-views/sunlit/dining.jpg',route=>route.abort());await page.locator('.tour-nav[data-room="dining"]').click();await page.locator('#room-error').waitFor({state:'visible'});
 await page.unroute('**/room-views/sunlit/dining.jpg');await page.locator('#room-retry').click();await ready('dining');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('.tour-thumb[data-room="guest"]').click();await ready('guest');await page.screenshot({path:'artifacts/craft/mobile-guest.png'});
 await page.locator('#room-details-mobile').click();await page.locator('#room-details-modal').waitFor({state:'visible'});await page.screenshot({path:'artifacts/craft/mobile-details.png'});await page.locator('#room-details-close').click();
 await page.goto(new URL('?design=cream&room=guest',base).href);await ready('guest');assert.equal((await diag()).scheme,'forest');
 assert.deepEqual(errors,[]);console.log('PASS room views: all 28 native images, four designer references, ritual/finish notes, zoom/reset, download, 360 roundtrip, latest request, retry, mobile and retired-style fallback.');
}finally{await browser.close();}
