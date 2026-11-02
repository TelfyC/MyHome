import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser=await chromium.launch({
 executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
 args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
const base=process.env.BASE_URL||'http://localhost:5173';
const output='artifacts/panorama-native-20261028';
const errors=[];
const url=query=>new URL(query,base.endsWith('/')?base:base+'/').href;
const diag=page=>page.evaluate(()=>window.__panoramaDiagnostics());
const isDetailRequest=request=>request.url().includes('/panoramas-native/')&&!new URL(request.url()).pathname.endsWith('-thumb.jpg');
const ready=(page,room='living')=>page.waitForFunction(room=>window.__panoramaDiagnostics?.().loaded===room,room);
const enhanced=page=>page.waitForFunction(()=>window.__panoramaDiagnostics?.().quality==='enhanced');
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-7,`${message}: ${a} vs ${b}`);
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
async function newPage(viewport={width:1440,height:960}){
 const page=await browser.newPage({viewport,deviceScaleFactor:1});
 page.setDefaultTimeout(90000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{
  if(message.type()==='error'&&/THREE\.WebGLProgram|VALIDATE_STATUS|SHADER_INFO_LOG|GL_INVALID/.test(message.text()))errors.push(message.text());
 });
 return page;
}
async function holdDetail(page){
 const started=deferred(),release=deferred();
 await page.route('**/panoramas-native/forest/living.jpg',async route=>{
  started.resolve();await release.promise;
  try{await route.continue();}catch(error){if(!page.isClosed())throw error;}
 });
 return {started:started.promise,release:release.resolve};
}
async function limitTextureSize(page,size){
 await page.addInitScript(maxTexture=>{
  for(const Context of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
   if(!Context)continue;
   const getParameter=Context.prototype.getParameter;
   Context.prototype.getParameter=function(parameter){
    return parameter===0x0D33?maxTexture:getParameter.call(this,parameter);
   };
  }
 },size);
}

await fs.mkdir(output,{recursive:true});
try{
 // The low-resolution original becomes usable before the optional detail loads.
 const desktop=await newPage(),detail=await holdDetail(desktop);
 try{
  await desktop.goto(url('?design=forest&room=living'),{waitUntil:'domcontentloaded'});
  await ready(desktop);await detail.started;
  assert.equal((await diag(desktop)).textureWidth,1774);
  assert.equal((await diag(desktop)).qualityLoading,true);
  assert.match(await desktop.locator('.tour-badge').innerText(),/高清载入中/);
  await desktop.locator('#tour-stage').focus();
  await desktop.keyboard.press('ArrowRight');await desktop.keyboard.press('ArrowUp');
  await desktop.locator('#tour-zoom-in').click();
  const before=await diag(desktop);
  await desktop.locator('#tour-stage').screenshot({path:`${output}/viewer-original.png`});
  detail.release();await enhanced(desktop);
  const after=await diag(desktop);
  assert.deepEqual([after.textureWidth,after.textureHeight],[3840,1920]);
  for(const key of ['yaw','pitch','fov','longEdgeFov'])near(after[key],before[key],`detail upgrade preserves ${key}`);
  assert.equal(after.auto,before.auto);assert.equal(after.qualityLoading,false);assert.equal(after.detailError,false);
  assert.equal(await desktop.locator('#tour-error').isVisible(),false);
  assert.match(await desktop.locator('.tour-disclosure').innerText(),/高清细节经 AI 生成/);
  assert.match(await desktop.locator('.tour-badge').innerText(),/AI 高清/);
  await desktop.locator('#tour-stage').screenshot({path:`${output}/viewer-enhanced.png`});
 }finally{detail.release();await desktop.close();}

 const rotating=await newPage(),rotatingDetail=await holdDetail(rotating);
 try{
  await rotating.goto(url('?design=forest&room=living'),{waitUntil:'domcontentloaded'});
  await ready(rotating);await rotatingDetail.started;
  await rotating.locator('#tour-auto').click();assert.equal((await diag(rotating)).auto,true);
  rotatingDetail.release();await enhanced(rotating);
  assert.equal((await diag(rotating)).auto,true,'the image upgrade does not pause automatic rotation');
 }finally{rotatingDetail.release();await rotating.close();}

 const original=await newPage();
 const detailRequests=[];original.on('request',request=>{if(isDetailRequest(request))detailRequests.push(request.url());});
 try{
  await original.goto(url('?design=forest&room=living&quality=original'));await ready(original);
  const d=await diag(original);
  assert.equal(d.quality,'original');assert.equal(d.textureWidth,1774);assert.equal(d.qualityLoading,false);
  assert.deepEqual(detailRequests,[],'the comparison URL never requests enhanced images');
 }finally{await original.close();}

 const mobile=await newPage({width:390,height:844});
 try{
  await mobile.goto(url('?design=forest&room=living'));await enhanced(mobile);
  const d=await diag(mobile);assert.deepEqual([d.textureWidth,d.textureHeight],[2560,1280]);
  assert.match(d.textureSource,/living-mobile\.jpg/,'mobile uses the smaller high-resolution image');
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await mobile.screenshot({path:`${output}/viewer-enhanced-mobile.png`});
 }finally{await mobile.close();}

 const limited=await newPage();
 try{
  await limitTextureSize(limited,2048);
  const requested=[];
  limited.on('request',request=>{if(isDetailRequest(request))requested.push(request.url());});
  await limited.goto(url('?design=forest&room=living'));await ready(limited);
  const before=await diag(limited);
  assert.equal(before.textureWidth,1774);assert.equal(before.quality,'original');
  assert.equal(before.qualityLoading,false);assert.equal(before.detailError,false);
  assert.deepEqual(requested,[],'devices below the smallest resource dimensions retain the original');
  await limited.locator('#tour-stage').focus();await limited.keyboard.press('ArrowRight');
  assert.ok((await diag(limited)).yaw>before.yaw,'the original remains interactive within device limits');
 }finally{await limited.close();}

 const intermediate=await newPage();
 try{
  await limitTextureSize(intermediate,3072);
  await intermediate.goto(url('?design=forest&room=living'));await enhanced(intermediate);
  const before=await diag(intermediate);
  assert.deepEqual([before.textureWidth,before.textureHeight],[2560,1280]);
  assert.match(before.textureSource,/living-mobile\.jpg/,'desktop devices with a lower texture limit use the compatible detail image');
  await intermediate.locator('#tour-stage').focus();await intermediate.keyboard.press('ArrowRight');
  assert.ok((await diag(intermediate)).yaw>before.yaw,'the compatible detail image remains interactive');
 }finally{await intermediate.close();}

 const wrongSize=await newPage();
 try{
  await wrongSize.route('**/panoramas-native/forest/living.jpg',route=>route.fulfill({
   path:'public/panoramas/forest/living.jpg',contentType:'image/jpeg',
  }));
  await wrongSize.goto(url('?design=forest&room=living'));await ready(wrongSize);
  await wrongSize.waitForFunction(()=>window.__panoramaDiagnostics?.().detailError===true);
  const before=await diag(wrongSize);
  assert.equal(before.quality,'original');assert.equal(before.textureWidth,1774);assert.equal(before.qualityLoading,false);
  assert.equal(await wrongSize.locator('#tour-error').isVisible(),false,'an image with unexpected dimensions does not hide the room');
  await wrongSize.locator('#tour-stage').focus();await wrongSize.keyboard.press('ArrowRight');
  assert.ok((await diag(wrongSize)).yaw>before.yaw,'rejecting the malformed detail image keeps the original interactive');
 }finally{await wrongSize.close();}

 const fallback=await newPage();
 try{
  await fallback.route('**/panoramas-native/**',route=>route.abort());
  await fallback.goto(url('?design=forest&room=living'));await ready(fallback);
  await fallback.waitForFunction(()=>window.__panoramaDiagnostics?.().detailError===true);
  const before=await diag(fallback);
  assert.equal(before.quality,'original');assert.equal(before.textureWidth,1774);assert.equal(before.qualityLoading,false);
  assert.equal(await fallback.locator('#tour-error').isVisible(),false,'an optional enhancement failure does not hide the room');
  assert.equal(await fallback.locator('.tour-badge').innerText(),'360° 全景');
  await fallback.locator('#tour-stage').focus();await fallback.keyboard.press('ArrowRight');
  assert.ok((await diag(fallback)).yaw>before.yaw,'the original remains interactive after an enhancement failure');
 }finally{await fallback.close();}

 // Slow enhancement responses may not replace a newly chosen room or style.
 for(const next of ['room','style']){
  const page=await newPage(),held=await holdDetail(page);
  try{
   await page.goto(url('?design=forest&room=living'),{waitUntil:'domcontentloaded'});
   await ready(page);await held.started;
   if(next==='room'){
    await page.locator('.tour-nav[data-room="dining"]').click();await ready(page,'dining');
   }else{
    await page.locator('[data-scheme="japanese"]').click();
    await page.waitForFunction(()=>{const d=window.__panoramaDiagnostics?.();return d?.loaded==='living'&&d.scheme==='japanese';});
   }
   const completed=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/panoramas-native/forest/living.jpg'));
   held.release();await completed;
   // Let the old image decode and its stale callback run.
   await page.waitForTimeout(600);
   const d=await diag(page);
   if(next==='room'){
    assert.equal(d.room,'dining');assert.equal(d.loaded,'dining');assert.match(d.textureSource,/\/forest\/dining(?:-mobile)?\.jpg/);
   }else{
    assert.equal(d.scheme,'japanese');assert.equal(d.loaded,'living');assert.match(d.textureSource,/\/japanese\/living(?:-mobile)?\.jpg/);
   }
  }finally{held.release();await page.close();}
 }
 assert.deepEqual(errors,[]);
 console.log('PASS panorama detail: desktop 3840px/mobile 2560px textures, progressive first view, orientation/zoom/rotation preserved, original comparison, device limits and compatible detail fallback, invalid dimensions, failure fallback and stale room/style responses.');
}finally{await browser.close();}
