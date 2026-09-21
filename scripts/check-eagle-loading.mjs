import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/kyle/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ headless: true });
const url = 'http://localhost:5173/';
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/wedgetail-eagle.glb', async route => {
      await gate;
      await route.continue();
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('#eagle-scene').evaluate(el => getComputedStyle(el).opacity), '0');
    assert.equal(await page.locator('#motion-toggle').isVisible(), false);
    assert.equal(await page.locator('.hero h1').isVisible(), true);
    // A visitor can scroll before the download completes; reveal that pose.
    await page.evaluate(() => scrollTo({ top: document.querySelector('#security').offsetTop, behavior: 'instant' }));
    release();
    await page.waitForFunction(() => window.__eagle, null, { timeout: 60000 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#eagle-scene')).opacity === '1');
    const pose = await page.evaluate(() => ({ ...window.__eagle.snapshot(), y: scrollY }));
    assert.ok(Math.abs(pose.scroll - pose.y) < 1);
    assert.ok(Object.values(pose.bounds).every(Number.isFinite));
    assert.equal(pose.opaque, true);
    assert.equal(await page.locator('.fallback-eagle-idle').isVisible(), false);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForFunction(() => window.__eagle.scroll < 1);
    await page.screenshot({ path: `.impeccable/review/eagle-reveal-${width}.png` });
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`${width}px: hidden loading, usable content, current scroll pose, opaque model and reveal passed`);
  }
  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  await reduced.goto(url);
  await reduced.waitForFunction(() => window.__eagle);
  assert.equal(await reduced.locator('#eagle-scene').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  await reduced.close();
  const failed = await browser.newPage();
  await failed.route('**/wedgetail-eagle.glb', route => route.abort());
  await failed.goto(url);
  await failed.waitForSelector('#eagle-scene[data-renderer="fallback"] .fallback-eagle-idle', { state: 'visible' });
  assert.equal(await failed.locator('#motion-toggle').isVisible(), false);
  assert.equal(await failed.locator('.hero h1').isVisible(), true);
  await failed.close();
  console.log('Reduced motion and failed-download fallback passed');
} finally {
  await browser.close();
}
