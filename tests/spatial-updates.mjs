import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser=await chromium.launch({
 executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
 args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
const base=process.env.BASE_URL||'http://localhost:5173';
const output='artifacts/spatial-updates-20261028';
const errors=[];
const url=query=>new URL(query,base.endsWith('/')?base:base+'/').href;
const diag=page=>page.evaluate(()=>window.__panoramaDiagnostics());
const ready=(page,room)=>page.waitForFunction(room=>window.__panoramaDiagnostics?.().loaded===room,room);
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,`${label}: ${a} vs ${b}`);
const focuses={
 living:{value:'relaxation',yaw:-.86*Math.PI,pitch:-.13,label:'转向窗边放松区'},
 kitchen:{value:'prep',yaw:.70*Math.PI,pitch:-.18,label:'转向主备餐台'},
};
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
async function newPage(viewport={width:1440,height:960}){
 const page=await browser.newPage({viewport,deviceScaleFactor:1});page.setDefaultTimeout(90000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{
  if(message.type()==='error'&&/THREE\.WebGLProgram|VALIDATE_STATUS|SHADER_INFO_LOG|GL_INVALID/.test(message.text()))errors.push(message.text());
 });
 return page;
}
async function assertFocus(page,room){
 const d=await diag(page),target=focuses[room];
 assert.equal(d.room,room);assert.equal(d.loaded,room);assert.equal(d.focus,target.value);
 near(d.yaw,target.yaw,`${room} focuses the intended side`);near(d.pitch,target.pitch,`${room} focus pitch`);
 near(d.longEdgeFov,86,'focus restores natural framing');assert.equal(d.auto,false,'focusing pauses automatic rotation');
 assert.equal(new URL(page.url()).searchParams.get('focus'),target.value);
 assert.equal(await page.locator('canvas.tour-canvas').count(),1);
 assert.equal(await page.locator('#room-photo,#tour-room-view-link').count(),0,'focus stays inside the current 360');
}

await fs.mkdir(output,{recursive:true});
try{
 const page=await newPage();
 try{
  const imageRequests=[];
  page.on('request',request=>{if(/\/panoramas\//.test(request.url()))imageRequests.push(request.url());});
  await page.goto(url('?design=forest&room=living&quality=original'));await ready(page,'living');
  const original=await diag(page);assert.equal(original.focus,null);
  near(original.yaw,-.5*Math.PI,'ordinary living links keep their previous orientation');
  assert.equal(await page.locator('#tour-zone-focus').innerText(),focuses.living.label);
  await page.locator('#tour-zoom-in').click();await page.locator('#tour-auto').click();
  const requestsBefore=imageRequests.length;
  await page.locator('#tour-zone-focus').click();await assertFocus(page,'living');
  assert.equal(imageRequests.length,requestsBefore,'the focus button rotates the current image without requesting another view');
  await page.locator('#tour-stage').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowUp');
  await page.locator('#tour-zoom-in').click();await page.locator('#tour-reset').click();await assertFocus(page,'living');
  for(const style of ['japanese','french','sunlit','forest']){
   await page.locator(`[data-scheme="${style}"]`).click();
   await page.waitForFunction(style=>{const d=window.__panoramaDiagnostics?.();return d?.scheme===style&&d.loaded==='living';},style);
   await assertFocus(page,'living');
  }
  await page.screenshot({path:`${output}/relaxation-desktop.png`});
  await page.locator('.tour-nav[data-room="dining"]').click();await ready(page,'dining');
  assert.equal(new URL(page.url()).searchParams.has('focus'),false,'leaving an incompatible room clears the deep-link focus');
  assert.equal((await diag(page)).focus,null);assert.equal(await page.locator('#tour-zone-focus').isVisible(),false);
  await page.locator('.tour-nav[data-room="living"]').click();await ready(page,'living');
  near((await diag(page)).yaw,-.5*Math.PI,'returning normally does not resurrect an old focus');

  const kitchenLink=page.locator('.tour-kitchen-update');
  assert.match(await kitchenLink.innerText(),/中式厨房 · 燃气灶＋备餐＋储物/);
  const target=new URL(await kitchenLink.getAttribute('href'),page.url());
  assert.equal(target.searchParams.get('room'),'kitchen');assert.equal(target.searchParams.get('focus'),'prep');
  assert.equal(target.searchParams.has('view'),false,'the kitchen effect entrance never opens the coarse model');
  await kitchenLink.click();await ready(page,'kitchen');await assertFocus(page,'kitchen');
  assert.equal(await page.locator('#tour-zone-focus').innerText(),focuses.kitchen.label);
  assert.match(await page.locator('#tour-details-model').innerText(),/查看原始尺寸与边界/);
  await kitchenLink.click();assert.equal(await page.locator('#tour-details-modal').evaluate(dialog=>dialog.open),true);
  await page.locator('#tour-details-close').click();
  await page.locator('#tour-stage').focus();await page.keyboard.press('ArrowLeft');
  await page.locator('#tour-zoom-in').click();await page.locator('#tour-zone-focus').click();await assertFocus(page,'kitchen');
  for(const style of ['japanese','french','sunlit','forest']){
   await page.locator(`[data-scheme="${style}"]`).click();
   await page.waitForFunction(style=>{const d=window.__panoramaDiagnostics?.();return d?.scheme===style&&d.loaded==='kitchen';},style);
   await assertFocus(page,'kitchen');
  }
  await page.locator('.tour-nav[data-room="living"]').click();await ready(page,'living');
  assert.equal(new URL(page.url()).searchParams.has('focus'),false,'prep focus is not valid in the living room');

  for(const room of ['living','kitchen']){
   const focus=focuses[room];
   await page.goto(url(`?design=forest&room=${room}&focus=${focus.value}&quality=original`));await ready(page,room);
   await assertFocus(page,room);
   await page.reload();await ready(page,room);await assertFocus(page,room);
  }
  await page.goto(url('?design=forest&room=kitchen&focus=relaxation&quality=original'));await ready(page,'kitchen');
  assert.equal((await diag(page)).focus,null);assert.equal(new URL(page.url()).searchParams.has('focus'),false);
  near((await diag(page)).yaw,0,'an invalid focus leaves ordinary kitchen framing intact');
 }finally{await page.close();}

 const mobile=await newPage({width:390,height:844});
 try{
  await mobile.goto(url('?design=forest&room=living&focus=relaxation&quality=original'));await ready(mobile,'living');
  await assertFocus(mobile,'living');
  const button=await mobile.locator('#tour-zone-focus').boundingBox(),stage=await mobile.locator('#tour-stage').boundingBox(),tools=await mobile.locator('.tour-tools').boundingBox();
  assert.ok(button.x>=stage.x&&button.y>=stage.y&&button.y+button.height<=stage.y+stage.height,'the mobile focus control remains in the panorama');
  assert.ok(button.x+button.width<tools.x,'the focus control does not cover the mobile tools');
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await mobile.screenshot({path:`${output}/relaxation-mobile.png`});
 }finally{await mobile.close();}

 // An optional high-resolution image upgrade cannot change the chosen zone.
 for(const room of ['living','kitchen']){
  const page=await newPage(),started=deferred(),release=deferred();
  try{
   await page.route(`**/panoramas-native/forest/${room}.jpg`,async route=>{
    started.resolve();await release.promise;
    try{await route.continue();}catch(error){if(!page.isClosed())throw error;}
   });
   await page.goto(url(`?design=forest&room=${room}&focus=${focuses[room].value}`),{waitUntil:'domcontentloaded'});
   await ready(page,room);await started.promise;await assertFocus(page,room);
   assert.equal((await diag(page)).qualityLoading,true);
   await page.locator('#tour-stage').focus();await page.keyboard.press('ArrowRight');
   await page.locator('#tour-zone-focus').click();await assertFocus(page,room);
   const before=await diag(page);
   release.resolve();await page.waitForFunction(()=>window.__panoramaDiagnostics?.().quality==='enhanced');
   await assertFocus(page,room);
   const after=await diag(page);
   for(const key of ['yaw','pitch','longEdgeFov'])near(after[key],before[key],`enhancement preserves ${room} ${key}`);
   assert.equal(after.textureWidth,3840);
  }finally{release.resolve();await page.close();}
 }
 assert.deepEqual(errors,[]);
 console.log('PASS spatial updates: 360-only focus button/deep links, four-style focus retention, reset, incompatible-room cleanup, kitchen panorama/detail entrance, mobile control layout and high-resolution focus preservation.');
}finally{await browser.close();}
