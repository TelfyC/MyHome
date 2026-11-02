import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});page.setDefaultTimeout(60000);
const base=process.env.BASE_URL||'http://localhost:5173';
const errors=[],standaloneRequests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(/\/room-views\//.test(r.url()))standaloneRequests.push(r.url());});
const ready=room=>page.waitForFunction(room=>window.__panoramaDiagnostics?.().loaded===room,room);
try{
 for(const [query,style,room] of [
  ['', 'forest','living'],
  ['?scene=room&design=japanese&room=guest','japanese','guest'],
  ['?scene=room&design=french&room=kitchen','french','kitchen'],
  ['?design=sunlit&room=study','sunlit','study'],
  ['?scene=room&design=cream&room=guest','forest','guest'],
 ]){
  await page.goto(new URL(query||'.',base.endsWith('/')?base:base+'/').href);await ready(room);
  const d=await page.evaluate(()=>window.__panoramaDiagnostics());
  assert.equal(d.scheme,style);assert.equal(d.room,room);
  const url=new URL(page.url());assert.equal(url.searchParams.get('scene'),'panorama');assert.equal(url.searchParams.get('design'),style);assert.equal(url.searchParams.get('room'),room);
  assert.equal(await page.locator('canvas.tour-canvas').count(),1,'the default and former room-image deep links all render 360');
  assert.equal(await page.locator('#room-photo,#tour-room-view-link').count(),0,'no separate still-image mode is offered');
  const model=new URL(await page.locator('#tour-details-model').getAttribute('href'),page.url());
  assert.equal(model.searchParams.get('view'),'model');assert.equal(model.searchParams.get('design'),style);assert.equal(model.searchParams.get('room'),room);
 }
 await page.reload();await ready('guest');assert.equal(await page.evaluate(()=>window.__panoramaDiagnostics().scheme),'forest','canonical panorama links survive reload');
 assert.deepEqual(standaloneRequests,[],'360 navigation does not download standalone room pictures');
 assert.deepEqual(errors,[]);
 console.log('PASS panorama entrances: default and former room-image deep links use 360, preserve style/room, canonicalize URLs and retain dimension-model links.');
}finally{await browser.close();}
