import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/kyle/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = fileURLToPath(new URL('../.impeccable/review/', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:5173/eagle-playground/');
    await page.waitForFunction(() => window.__eaglePlayground);
    const snapshot = () => page.evaluate(() => window.__eaglePlayground.snapshot());
    const initial = await snapshot();
    assert.equal(initial.clips.length, 5);
    assert.equal(initial.selected, 'home');
    assert.ok(Number.isFinite(initial.state.zoom));
    // Scrubbing must change actual rig joints, including in reverse.
    await page.selectOption('#clip', { label: 'Takeoff' });
    const before = await snapshot();
    await page.locator('#time').fill('0.6');
    const scrubbed = await snapshot();
    assert.equal(scrubbed.state.time, 0.6);
    assert.notDeepEqual(before.bones, scrubbed.bones);
    await page.locator('#time').fill('0');
    assert.deepEqual((await snapshot()).bones, before.bones);
    await page.click('#play');
    await page.waitForFunction(() => window.__eaglePlayground.snapshot().state.time > 0.1);
    await page.click('#play');
    const paused = await snapshot();
    await page.waitForTimeout(180);
    assert.equal((await snapshot()).state.time, paused.state.time);
    await page.locator('#yaw-number').fill('-25');
    await page.locator('#x-number').fill('65');
    assert.equal((await snapshot()).state.yaw, -25);
    assert.equal((await snapshot()).state.x, 65);
    await page.locator('#notes').fill('Face towards the headline.');
    await page.click('#save');
    const saved = (await snapshot()).state;
    await page.selectOption('#section', 'security');
    await page.selectOption('#section', 'home');
    assert.deepEqual((await snapshot()).state, saved);
    await page.reload();
    await page.waitForFunction(() => window.__eaglePlayground);
    assert.deepEqual((await snapshot()).state, saved);
    await page.click('#copy');
    const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    assert.equal(copied.references.home.yaw, -25);
    const exportPromise = page.waitForEvent('download');
    await page.click('#export');
    const exported = await exportPromise;
    const jsonPath = out + `playground-${viewport.width}.json`;
    await exported.saveAs(jsonPath);
    assert.equal(JSON.parse(await readFile(jsonPath, 'utf8')).references.home.notes, saved.notes);
    await page.click('#reset');
    await page.locator('#import-file').setInputFiles(jsonPath);
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Imported'));
    assert.equal((await snapshot()).state.yaw, -25);
    await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"bad"}') });
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Import failed'));
    assert.equal((await snapshot()).state.yaw, -25);
    // Final screenshot shows a useful full eagle while reference exports prove WebGL pixels.
    await page.click('#reset');
    if (viewport.width < 600) {
      await page.click('[data-frame="390,844"]');
      await page.click('#reset');
    }
    const pngPromise = page.waitForEvent('download');
    await page.click('#download-image');
    const png = await pngPromise;
    await png.saveAs(out + `playground-reference-${viewport.width}.png`);
    assert.ok((await readFile(out + `playground-reference-${viewport.width}.png`)).length > 30000);
    await page.evaluate(() => { document.querySelector('.control-scroll').scrollTop = 0; scrollTo(0, 0); });
    await page.screenshot({ path: out + `playground-${viewport.width}.png`, fullPage: true });
    if (viewport.width < 600) {
      await page.locator('#yaw-number').scrollIntoViewIfNeeded();
      await page.screenshot({ path: out + 'playground-mobile-editing.png' });
      assert.equal(await page.locator('.workspace').evaluate(el => el.getBoundingClientRect().top), 0);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    // Shared scene refactor and fixed glass header must preserve homepage flight.
    await page.goto('http://localhost:5173/');
    await page.waitForFunction(() => window.__eagle);
    await page.evaluate(() => scrollTo({ top: 220, behavior: 'instant' }));
    await page.waitForFunction(() => Math.abs(window.__eagle.scroll - scrollY) < 0.1);
    const flight = await page.evaluate(() => window.__eagle.snapshot());
    assert.equal(flight.phase, 'fly_start_A'); assert.ok(flight.opaque);
    await page.evaluate(() => document.querySelector('#security').scrollIntoView({ behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('.site-header').classList.contains('is-scrolled'));
    const header = await page.locator('.site-header').evaluate(el => ({ y: el.getBoundingClientRect().top, position: getComputedStyle(el).position, blur: getComputedStyle(el).backdropFilter }));
    assert.equal(header.y, 0); assert.equal(header.position, 'fixed'); assert.ok(header.blur.includes('blur'));
    await page.screenshot({ path: out + `glass-header-${viewport.width}.png` });
    assert.deepEqual(errors, []);
    report.push({ viewport, clips: initial.clips.length, scrub: true, playback: true, persistence: true, png: true, json: true, header, errors });
    console.log(JSON.stringify(report.at(-1)));
    await context.close();
  }
  await writeFile(out + 'playground-report.json', JSON.stringify(report, null, 2));
} finally { await browser.close(); }
