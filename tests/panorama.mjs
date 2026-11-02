import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('console',message=>{if(message.type()==='error'&&/THREE\.WebGLProgram|VALIDATE_STATUS|SHADER_INFO_LOG|GL_INVALID/.test(message.text()))errors.push(message.text());});
const diag=()=>page.evaluate(()=>window.__panoramaDiagnostics());
const ready=id=>page.waitForFunction(id=>window.__panoramaDiagnostics?.().loaded===id,id,{timeout:60000});
const base=process.env.BASE_URL||'http://localhost:5173';
await fs.mkdir('artifacts',{recursive:true});
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-5,`${message}: ${actual} vs ${expected}`);
async function resized(size,target=page){
 await target.setViewportSize(size);
 await target.waitForFunction(()=>{const d=window.__panoramaDiagnostics?.(),r=document.querySelector('#tour-stage')?.getBoundingClientRect();return d&&r&&Math.abs(d.aspect-r.width/r.height)<1e-6;});
}
async function assertView(target=page){
 const d=await target.evaluate(()=>window.__panoramaDiagnostics());
 const stage=await target.locator('#tour-stage').boundingBox();
 near(d.aspect,stage.width/stage.height,'camera follows the viewport aspect');
 const horizontal=2*Math.atan(Math.tan(d.fov*Math.PI/360)*d.aspect)*180/Math.PI;
 near(d.horizontalFov,horizontal,'horizontal angle derives from the actual camera');
 near(Math.max(horizontal,d.fov),d.longEdgeFov,'long-edge framing survives aspect changes');
 assert.ok(d.fov>0&&d.fov<=90+1e-5,'vertical field of view avoids excessive stretching');
 assert.ok(horizontal>0&&horizontal<=90+1e-5,'horizontal field of view avoids excessive stretching');
 assert.ok(d.longEdgeFov>=60-1e-5&&d.longEdgeFov<=90+1e-5,'zoom stays in the comfortable viewing range');
 assert.ok(Math.abs(d.pitch)*180/Math.PI+d.fov/2<=85+1e-5,'the view never crosses a panorama pole');
 assert.ok(d.canvasWidth*d.canvasHeight<=8_000_000,'drawing buffer respects the pixel budget');
 assert.ok(d.textureWidth>=1774&&d.textureHeight>=887,'full panorama is loaded');
 assert.equal(d.textureWidth,d.textureHeight*2,'texture retains its spherical proportions');
 return d;
}
try{
 await page.goto(new URL('?scene=panorama',base).href);await ready('living');
 const opening=await assertView();near(opening.longEdgeFov,86,'all rooms open with natural framing');
 assert.equal(await page.locator('#tour-room-view-link,#room-photo').count(),0,'panorama has no separate room-image entrance');
 assert.equal(new URL(page.url()).searchParams.get('scene'),'panorama');
 // Ship every full panorama AND thumbnail; a working first room must not hide missing rooms.
 for(const id of ['living','dining','master','study','guest','kitchen','bathroom']){
  for(const style of ['forest','japanese','french','sunlit']){
   const assets=await page.evaluate(async({id,style})=>{
    const inspect=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve([image.naturalWidth,image.naturalHeight]);image.onerror=()=>reject(new Error(`Missing ${style} asset: ${src}`));image.src=src;});
    return {
     full:await inspect(`panoramas/${style}/${id}.jpg`),
     detail:await inspect(`panoramas-native/${style}/${id}.jpg`),
     mobile:await inspect(`panoramas-native/${style}/${id}-mobile.jpg`),
     thumb:await inspect(`panoramas-native/${style}/${id}-thumb.jpg`),
    };
   },{id,style});
   assert.equal(assets.full[0],assets.full[1]*2,`${style}/${id}: panorama must be 2:1`);
   assert.deepEqual(assets.detail,[3840,1920]);
   assert.deepEqual(assets.mobile,[2560,1280]);
   assert.deepEqual(assets.thumb,[320,160]);
  }
 }
 assert.equal((await diag()).room,'living');
 assert.equal(await page.locator('[data-scheme]').count(),4);
 assert.equal(await page.locator('[data-scheme=cream]').count(),0);
 assert.equal((await diag()).scheme,'forest');
 await page.locator('[data-scheme="forest"]').click();await ready('living');
 assert.equal((await diag()).scheme,'forest');
 assert.match(page.url(),/design=forest/);
 assert.match(await page.locator('#tour-material').innerText(),/深樱桃木/);
 assert.match(await page.locator('.tour-thumb[data-room="living"] img').getAttribute('src'),/panoramas-native\/forest\/living-thumb\.jpg/);
 await page.locator('#tour-materials-open').click();await page.locator('#tour-material-modal').waitFor({state:'visible'});
 assert.match(await page.locator('#tour-material-modal').innerText(),/深色樱桃木/);await page.locator('#tour-materials-close').click();
 for(const [style,material] of [['japanese','胡桃木'],['french','蜂蜜'],['sunlit','木边白台面']]){
  await page.locator(`[data-scheme="${style}"]`).click();await ready('living');
  assert.equal((await diag()).scheme,style);
  assert.match(page.url(),new RegExp(`design=${style}`));
  assert.match(await page.locator('#tour-material').innerText(),new RegExp(material));
  assert.match(await page.locator('.tour-thumb[data-room="living"] img').getAttribute('src'),new RegExp(`panoramas-native/${style}/living-thumb\\.jpg`));
 }
 assert.equal(await page.locator('.tour-sidebar .tour-source-link').getAttribute('href'),'https://www.bilibili.com/video/BV1tm576NEwz/');
 await page.reload();await ready('living');assert.equal((await diag()).scheme,'sunlit','direct style link survives reload');
 await page.locator('.tour-nav[data-room="study"]').click();await ready('study');
 for(const style of ['forest','japanese','french','sunlit']){
  await page.locator(`[data-scheme="${style}"]`).click();await ready('study');
  assert.equal((await diag()).scheme,style);assert.equal((await diag()).yaw,0,'gaming room opens facing desk');
  assert.match(await page.locator('.tour-nav[data-room="study"]').innerText(),/电竞房/);
  assert.match(await page.locator('#tour-material').innerText(),/洞洞板/);
  assert.match(await page.locator('#tour-material').innerText(),/玻璃/);
  await page.screenshot({path:`artifacts/gaming-${style}.png`});
 }
 for(const id of ['dining','master','study','guest','kitchen','bathroom','living']){await page.locator(`.tour-nav[data-room="${id}"]`).click();await ready(id);assert.equal((await diag()).error,false);near((await assertView()).longEdgeFov,86,`${id} opens with natural framing`);}
 await page.locator('#tour-materials-open').click();
 assert.match(await page.locator('#tour-material-modal').innerText(),/延伸设计/);
 assert.equal(await page.locator('#tour-material-modal .tour-source-link').getAttribute('href'),'https://www.bilibili.com/video/BV1tm576NEwz/');
 await page.locator('#tour-materials-close').click();
 await page.locator('[data-scheme="forest"]').click();await ready('living');
 assert.equal((await diag()).scheme,'forest');
 assert.equal(await page.locator('.tour-sidebar .tour-source-link').isVisible(),false);
 assert.match(page.url(),/design=forest/);
 await page.locator('#tour-materials-open').click();await page.locator('#tour-material-modal').waitFor({state:'visible'});
 assert.match(await page.locator('#tour-material-modal').innerText(),/矿物感墙面/);await page.locator('#tour-materials-close').click();
 const homeView=await diag();
 await page.locator('#tour-stage').focus();const before=(await diag()).yaw;await page.keyboard.press('ArrowRight');assert.ok((await diag()).yaw>before);
 await page.locator('#tour-zoom-in').click();assert.ok((await diag()).longEdgeFov<homeView.longEdgeFov);
 const beforeDrag=(await diag()).pitch;
 await page.mouse.move(700,400);await page.mouse.down();await page.mouse.move(900,440,{steps:8});await page.mouse.up();assert.ok((await diag()).pitch>beforeDrag);
 await page.locator('#tour-auto').click();assert.equal((await diag()).auto,true);
 await page.locator('#tour-reset').click();
 const reset=await assertView();assert.equal(reset.auto,false,'reset pauses automatic rotation');
 near(reset.yaw,homeView.yaw,'reset restores room orientation');near(reset.pitch,homeView.pitch,'reset restores eye level');near(reset.longEdgeFov,86,'reset restores natural framing');
 for(let i=0;i<12;i++){const button=page.locator('#tour-zoom-in');if(await button.isDisabled())break;await button.click();}
 near((await assertView()).longEdgeFov,60,'zoom in stops before excessive enlargement');assert.equal(await page.locator('#tour-zoom-in').isDisabled(),true);
 for(let i=0;i<12;i++){const button=page.locator('#tour-zoom-out');if(await button.isDisabled())break;await button.click();}
 near((await assertView()).longEdgeFov,90,'zoom out stops before an ultra-wide view');assert.equal(await page.locator('#tour-zoom-out').isDisabled(),true);
 await page.locator('#tour-stage').focus();
 for(const direction of ['ArrowUp','ArrowDown']){for(let i=0;i<50;i++)await page.keyboard.press(direction);await assertView();}
 await page.locator('#tour-reset').click();
 await page.locator('#tour-zoom-in').click();const zoomedAngle=(await diag()).longEdgeFov;
 await resized({width:2560,height:720});
 const wide=await assertView();assert.ok(wide.aspect>2,'test covers an ultra-wide panorama stage');near(wide.longEdgeFov,zoomedAngle,'resizing preserves chosen zoom');
 await page.screenshot({path:'artifacts/panorama-ultrawide.png'});
 await resized({width:1440,height:960});near((await assertView()).longEdgeFov,zoomedAngle,'returning to desktop preserves zoom');
 await page.locator('#tour-reset').click();
 await page.locator('.tour-nav[data-room="dining"]').click();await ready('dining');
 await page.locator('#tour-map-open').click();assert.equal(await page.locator('#tour-map-modal').evaluate(el=>el.open),true);
 await page.locator('[data-map-room="living"]').first().click();await ready('living');
 // A delayed prior request may not overwrite the latest selected room.
 await page.route('**/panoramas/forest/dining.jpg',async route=>{await new Promise(r=>setTimeout(r,500));await route.continue();});
 await page.locator('.tour-nav[data-room="dining"]').click();await page.locator('.tour-nav[data-room="living"]').click();await ready('living');await page.waitForTimeout(900);assert.equal((await diag()).loaded,'living');
 await page.unroute('**/panoramas/forest/dining.jpg');
 // A failed image has a visible retry path that recovers without reloading the application.
 await page.route('**/panoramas/forest/dining.jpg',route=>route.abort());await page.locator('.tour-nav[data-room="dining"]').click();await page.locator('#tour-error').waitFor({state:'visible'});assert.equal((await diag()).error,true);await page.unroute('**/panoramas/forest/dining.jpg');await page.locator('#tour-retry').click();await ready('dining');
 await page.locator('.tour-nav[data-room="living"]').click();await ready('living');
 const download=page.waitForEvent('download');await page.locator('#tour-capture').click();assert.ok((await download).suggestedFilename().endsWith('.png'));
 await page.screenshot({path:'artifacts/panorama-desktop.png'});
 await resized({width:390,height:844});const portrait=await assertView();assert.ok(portrait.fov>portrait.horizontalFov,'portrait framing adapts to the taller screen');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 for(const style of ['japanese','french','sunlit']){await page.locator(`[data-scheme="${style}"]`).click();await ready('living');assert.equal((await diag()).scheme,style);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.locator('[data-scheme="forest"]').click();await ready('living');
 await page.locator('#tour-materials-mobile').click();await page.locator('#tour-materials-close').click();await page.locator('#tour-mobile-map').click();await page.locator('#tour-map-close').click();await page.locator('.tour-thumb[data-room="dining"]').click();await ready('dining');const cdp=await page.context().newCDPSession(page);
 const mobileYaw=(await diag()).yaw;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:120,y:350}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:220,y:390}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.notEqual((await diag()).yaw,mobileYaw,'touch drag rotates panorama');
 const mobileFov=(await diag()).fov;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:120,y:350},{x:220,y:350}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:90,y:350},{x:250,y:350}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.ok((await diag()).fov<mobileFov,'pinch out zooms in');
 await cdp.detach();
 await page.screenshot({path:'artifacts/panorama-mobile.png'});
 await resized({width:1440,height:960});await assertView();
 for(const id of ['master','study','guest','kitchen','bathroom']){await page.locator(`.tour-nav[data-room="${id}"]`).click();await ready(id);assert.equal((await diag()).error,false);await page.screenshot({path:`artifacts/panorama-${id}.png`});}
 // Every remaining style has a new secondary bedroom and room-specific design details.
 for(const style of ['forest','japanese','french','sunlit']){
  await page.locator(`[data-scheme="${style}"]`).click();await ready('bathroom');
  await page.locator('.tour-nav[data-room="guest"]').click();await ready('guest');
  assert.equal((await diag()).yaw,0,'bedroom opens toward window and center aisle');
  await page.locator('#tour-details-open').click();await page.locator('#tour-details-modal').waitFor({state:'visible'});
  assert.match(await page.locator('#tour-details-body').innerText(),/1.20 × 2.10 m/);
  assert.match(await page.locator('#tour-details-body').innerText(),/2.30 × 0.65 m/);
  assert.match(await page.locator('#tour-details-model').getAttribute('href'),new RegExp(`design=${style}`));
  await page.locator('#tour-details-close').click();
  await page.screenshot({path:`artifacts/secondary-bedroom-${style}.png`});
  await page.locator('.tour-nav[data-room="bathroom"]').click();await ready('bathroom');
 }
 await page.goto(new URL('?scene=panorama&design=cream&room=guest',base).href);await ready('guest');
 assert.equal((await diag()).scheme,'forest','retired style deep links fall back to forest');
 assert.match(page.url(),/design=forest/);
 assert.equal((await page.request.get(new URL('review/summary.md',base.endsWith('/')?base:base+'/').href)).ok(),true,'review summary must be deployed');
 const retina=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:2});
 retina.on('pageerror',e=>errors.push(e.message));
 try{
  await retina.goto(new URL('?scene=panorama&design=forest&room=guest',base).href);
  await retina.waitForFunction(()=>window.__panoramaDiagnostics?.().loaded==='guest');
  const d=await assertView(retina);near(d.pixelRatio,2,'retina canvas uses available display resolution');
  const box=await retina.locator('#tour-stage').boundingBox();
  assert.ok(Math.abs(d.canvasWidth-box.width*2)<=1&&Math.abs(d.canvasHeight-box.height*2)<=1,'retina drawing buffer is rendered at two device pixels per CSS pixel');
  await resized({width:3000,height:1800},retina);
  const budgeted=await assertView(retina);assert.ok(budgeted.pixelRatio<2,'large displays reduce pixel ratio to keep the drawing buffer within budget');
 }finally{await retina.close();}
 assert.deepEqual(errors,[]);
 console.log('PASS panorama: all assets, four styles, natural framing, zoom limits/reset, desktop/ultrawide/mobile/retina, pixel budget, room switching, race/retry, drag/pinch, keyboard, map and capture.');
}finally{await browser.close();}
