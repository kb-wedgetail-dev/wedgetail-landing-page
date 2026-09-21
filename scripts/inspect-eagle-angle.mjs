import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/kyle/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 800 } });
  await page.goto('http://localhost:5173/');
  await page.waitForFunction(() => window.__eagle);
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { GLTFLoader } = await import('/node_modules/.vite/deps/three_addons_loaders_GLTFLoader__js.js');
    const { createEagleAnimator } = await import('/src/scene.js');
    const gltf = await new GLTFLoader().loadAsync('/models/wedgetail-eagle.glb');
    const model = gltf.scene;
    const animator = createEagleAnimator(model, gltf.animations);
    animator.sample(0);
    const scene = new THREE.Scene();
    const bird = new THREE.Group(); bird.add(model); scene.add(bird);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445577, 2));
    const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(-3, 5, 6); scene.add(light);
    model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => { m.transparent = false; m.alphaTest = m.name === 'feather' ? 0.45 : 0; m.side = THREE.DoubleSide; }); } });
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1500, 800); renderer.setClearColor(0x1818e8); renderer.setScissorTest(true);
    const camera = new THREE.OrthographicCamera(-0.48, 0.48, 0.64, -0.64, 0.1, 100); camera.position.z = 10;
    const overlay = document.createElement('div'); overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:#1818e8';
    overlay.append(renderer.domElement); document.body.append(overlay);
    [-2.05, -1.65, -1.25, -0.85, -0.45].forEach((yaw, i) => {
      bird.rotation.set(0.08, yaw, 0); bird.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(bird, true);
      camera.position.y = (box.max.y + box.min.y) / 2;
      renderer.setViewport(i * 300, 0, 300, 800); renderer.setScissor(i * 300, 0, 300, 800); renderer.render(scene, camera);
      const label = document.createElement('div'); label.textContent = 'yaw ' + yaw;
      label.style.cssText = 'position:absolute;top:16px;left:' + (i * 300 + 20) + 'px;color:white;font:20px sans-serif'; overlay.append(label);
    });
  });
  await page.screenshot({ path: fileURLToPath(new URL('../models/verification/angles.png', import.meta.url)) });
} finally { await browser.close(); }
