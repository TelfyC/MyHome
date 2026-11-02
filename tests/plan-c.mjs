import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = new URL(process.env.BASE_URL || 'http://localhost:5173/');
const projectUrl = new URL('plan-c/project.json', base);
const response = await fetch(projectUrl);
assert.ok(response.ok, 'Export the Plan C project before running this check.');
const project = await response.json();
assert.ok(project.rooms?.length, 'The exported project needs real scene rooms.');
const stillRoom = project.rooms.find(room => room.still);
const panoRoom = project.rooms.find(room => room.panorama);
assert.ok(stillRoom, 'At least one actual Blender still must be exported.');
assert.ok(panoRoom, 'At least one actual Blender panorama must be exported.');
const url = new URL(base); url.search = new URLSearchParams({ view: 'plan-c', room: stillRoom.id });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(90000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
await fs.mkdir('artifacts/plan-c', { recursive: true });
const diagnostics = () => page.evaluate(() => window.__planCDiagnostics());
const screenshot = options => page.screenshot({ animations: 'disabled', ...options });
try {
  await page.goto(url.href);
  await page.waitForFunction(() => window.__planCDiagnostics?.().ready);
  assert.equal((await diagnostics()).revision, project.revision);
  assert.equal(await page.locator('.pc-room-nav [data-pc-room]').count(), project.rooms.length);
  assert.ok(await page.locator('#pc-hero-image').evaluate(image => image.naturalWidth >= 960), 'Gallery uses a real rendered still.');
  await screenshot({ path: 'artifacts/plan-c/desktop.png' });

  for (const room of project.rooms) {
    await page.locator(`.pc-room-nav [data-pc-room="${room.id}"]`).click();
    assert.equal((await diagnostics()).room, room.id);
    assert.equal(new URL(page.url()).searchParams.get('view'), 'plan-c');
    if (room.still) await page.waitForFunction(() => window.__planCDiagnostics().ready);
    else await page.locator('.pc-pending').waitFor();
  }
  await page.locator(`.pc-room-nav [data-pc-room="${panoRoom.id}"]`).click();
  await page.locator('.pc-viewbar [data-pc-mode="panorama"]').click();
  await page.waitForFunction(() => window.__planCDiagnostics().ready);
  assert.ok((await diagnostics()).actualPanoramaWidth >= 1024, 'Panorama diagnostics report the installed source dimensions.');
  assert.ok((await diagnostics()).actualPanoramaUrl, 'Panorama diagnostics report the actual loaded source URL.');
  await page.locator('#pc-panorama').focus();
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp');
  await page.locator('#pc-pano-in').click(); await page.locator('#pc-pano-reset').click();
  await page.locator('#pc-pano-auto').click(); assert.equal(await page.locator('#pc-pano-auto').getAttribute('aria-pressed'), 'true');
  await page.locator('#pc-pano-auto').click();
  assert.ok(await page.locator('.pc-pano-canvas').evaluate(canvas => canvas.width > 0 && canvas.height > 0));
  await screenshot({ path: 'artifacts/plan-c/panorama.png' });

  await page.locator('.pc-viewbar [data-pc-mode="floorplan"]').click();
  await page.locator('.pc-plan-drawing svg').waitFor();
  await page.locator('#pc-plan-source').click();
  await page.waitForFunction(() => { const image = document.querySelector('.pc-original-plan'); return image?.complete && image.naturalWidth > 0; });
  await page.locator('#pc-plan-model').click();
  await screenshot({ path: 'artifacts/plan-c/floorplan.png' });
  const hasModel = project.artifacts?.some(artifact => /(?:^|\/)scene\.glb(?:\?|$)/.test(artifact.path));
  if (hasModel) {
    await page.locator('#pc-plan-three').click();
    await page.waitForFunction(() => window.__planCDiagnostics().structureReady, null, { timeout: 120000 });
    assert.ok((await diagnostics()).structureObjectCount > 20, 'GLB contains actual furnished geometry.');
    await screenshot({ path: 'artifacts/plan-c/structure.png' });
    await page.locator('#pc-plan-source').click();
    assert.equal((await diagnostics()).structureReady, false, 'Three renderer is disposed when leaving its view.');
  } else assert.equal(await page.locator('#pc-plan-three').isDisabled(), true);
  await page.locator('.pc-viewbar [data-pc-mode="project"]').click();
  assert.equal(await page.locator('.pc-artifacts a').count(), project.artifacts?.length || 0);
  assert.equal(await page.locator('.pc-pipeline li').count(), project.pipeline?.length || 0);
  await screenshot({ path: 'artifacts/plan-c/project.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.pc-viewbar [data-pc-mode="gallery"]').click();
  await page.locator(`.pc-filmstrip [data-pc-room="${stillRoom.id}"]`).click();
  await page.waitForFunction(() => window.__planCDiagnostics().ready);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile has no horizontal overflow.');
  await screenshot({ path: 'artifacts/plan-c/mobile.png', fullPage: true });

  await page.locator(`.pc-filmstrip [data-pc-room="${panoRoom.id}"]`).click();
  await page.locator('.pc-viewbar [data-pc-mode="panorama"]').click();
  await page.waitForFunction(() => window.__planCDiagnostics().ready);
  const mobilePanorama = await diagnostics();
  assert.ok(mobilePanorama.actualPanoramaUrl.endsWith(panoRoom.panorama_mobile || panoRoom.panorama), 'Phones select the declared mobile panorama when available.');
  assert.ok(mobilePanorama.actualPanoramaWidth >= 1024);
  await screenshot({ path: 'artifacts/plan-c/mobile-panorama.png', fullPage: true });
  await page.locator('.pc-viewbar [data-pc-mode="gallery"]').click();
  await page.locator(`.pc-filmstrip [data-pc-room="${stillRoom.id}"]`).click();
  await page.waitForFunction(() => window.__planCDiagnostics().ready);

  // A missing image must reveal a retry state; it must never display an older AI tour image.
  await page.route('**/plan-c/renders/**', route => route.abort());
  await page.reload(); await page.locator('#pc-retry').waitFor();
  assert.equal(await page.locator('.tour-canvas').count(), 0);
  await page.unroute('**/plan-c/renders/**');
  await page.locator('#pc-retry').click(); await page.waitForFunction(() => window.__planCDiagnostics().ready);

  const legacyUrl = new URL(base); legacyUrl.searchParams.set('design', 'sunlit');
  await page.goto(legacyUrl.href); await page.locator('.tour-plan-c-mobile').waitFor({ state: 'visible' });
  const entry = await page.locator('.tour-plan-c-mobile').boundingBox(), stage = await page.locator('.tour-stage').boundingBox();
  assert.ok(entry.y + entry.height <= stage.y + 1, 'Mobile entry does not overlap the existing panorama.');
  assert.deepEqual(await page.locator('[data-scheme]').evaluateAll(elements => elements.map(element => element.dataset.scheme)), ['forest', 'japanese', 'french', 'sunlit']);
  await page.locator('.tour-plan-c-mobile').click(); await page.waitForFunction(() => window.__planCDiagnostics);
  assert.equal(new URL(page.url()).searchParams.get('view'), 'plan-c');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'PASS', project_id: project.project_id, revision: project.revision, rooms: project.rooms.length, stills: project.rooms.filter(room => room.still).length, panoramas: project.rooms.filter(room => room.panorama).length, glb: !!hasModel, screenshots: 'artifacts/plan-c/' }, null, 2));
} finally { await browser.close(); }
