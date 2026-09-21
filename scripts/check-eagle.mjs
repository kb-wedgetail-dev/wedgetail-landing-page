import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ||
  'C:/Users/kyle/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ headless: true });
const output = new URL('../models/verification/', import.meta.url);
await mkdir(output, { recursive: true });
const report = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 2526, height: 1252 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); console.error(message.text()); } });
    await page.goto('http://localhost:5173/');
    await page.waitForFunction(() => window.__eagle && document.querySelector('#eagle-scene').dataset.renderer === 'webgl');
    const heroHeight = await page.locator('#home').evaluate(element => element.offsetHeight);
    for (const progress of [0, 0.23, 0.48, 0.78, 1.05, 1.3, 0]) {
      await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), progress * heroHeight * 0.78);
      await page.waitForFunction(() => Math.abs(window.__eagle.scroll - scrollY) < 0.1, null, { timeout: 15000 });
      const snapshot = await page.evaluate(() => window.__eagle.snapshot());
      assert.equal(snapshot.renderer, 'webgl');
      assert.equal(snapshot.clips.length, 5);
      assert.ok(snapshot.bones.length > 0, 'Must inspect actual rig bones');
      assert.equal(snapshot.opaque, true, 'The model must never fade');
      assert.ok(Math.abs(snapshot.weights.reduce((a, b) => a + b, 0) - 1) < 0.001);
      assert.equal(await page.locator('.fallback-eagle-idle').isVisible(), false);
      const name = `${viewport.width}-${progress}`;
      await page.screenshot({ path: fileURLToPath(new URL(name + '.png', output)) });
      report.push({ viewport, progress, ...snapshot });
    }
    const poses = report.filter(item => item.viewport.width === viewport.width);
    assert.equal(poses.at(-1).phase, 'idle_A0', 'Reverse scrolling restores idle');
    const resting = poses[0].bones.flatMap(bone => bone.rotation);
    const takingOff = poses[1].bones.flatMap(bone => bone.rotation);
    assert.ok(resting.some((value, index) => Math.abs(value - takingOff[index]) > 0.1), 'Scroll must deform the rig');
    if (viewport.width === 1440) {
      const targets = await page.locator('main > section').evaluateAll(elements => elements.slice(1).map(element => ({ id: element.id, y: element.offsetTop })));
      for (const target of targets) {
        await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), target.y);
        await page.waitForFunction(() => Math.abs(window.__eagle.scroll - scrollY) < 0.1);
        const bird = await page.evaluate(() => window.__eagle.snapshot());
        assert.ok([bird.bounds.left, bird.bounds.right, bird.bounds.top, bird.bounds.bottom].every(Number.isFinite),
          target.id + ': eagle bounds must remain measurable');
      }
      const beforePause = await page.evaluate(() => window.__eagle.snapshot());
      await page.locator('#motion-toggle').click();
      await page.waitForTimeout(150);
      const afterPause = await page.evaluate(() => window.__eagle.snapshot());
      assert.equal(afterPause.phase, beforePause.phase, 'Pause must not reset the animation');
      await page.waitForTimeout(150);
      assert.deepEqual((await page.evaluate(() => window.__eagle.snapshot())).bones, afterPause.bones);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(150);
      assert.equal((await page.evaluate(() => window.__eagle.snapshot())).phase, 'idle_A0');
    }
    assert.deepEqual(errors, [], 'Browser errors');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.close();
  }
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.map(({ viewport, progress, phase, bounds }) => ({ width: viewport.width, progress, phase, bounds })), null, 2));
} finally { await browser.close(); }
