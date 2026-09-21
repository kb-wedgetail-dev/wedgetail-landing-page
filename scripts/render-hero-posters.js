import * as THREE from 'three';
import { createEagleScene, loadEagleModel, HERO_ROTATION } from '/src/eagle-model.js';
import { createEagleAnimator } from '/src/scene.js';
import { MOBILE_EAGLE_REFERENCES } from '/src/eagle-references.js';
const button = document.querySelector('button');
button.onclick = async () => {
  button.disabled = true;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  const { scene } = createEagleScene(renderer);
  const gltf = await loadEagleModel();
  const eagle = new THREE.Group(); eagle.add(gltf.scene); scene.add(eagle);
  const animator = createEagleAnimator(gltf.scene, gltf.animations);
  animator.sample(0, 0); eagle.rotation.copy(HERO_ROTATION); eagle.updateMatrixWorld(true);
  const baseHeight = new THREE.Box3().setFromObject(eagle, true).getSize(new THREE.Vector3()).y;
  const output = { baseHeight, mobileReference: MOBILE_EAGLE_REFERENCES.home, variants: {} };
  for (const name of ['desktop', 'mobile']) {
    if (name === 'mobile') {
      const ref = MOBILE_EAGLE_REFERENCES.home;
      animator.sampleReference(ref);
      eagle.rotation.set(...[ref.pitch, ref.yaw, ref.roll].map(THREE.MathUtils.degToRad));
    } else { animator.sample(0, 0); eagle.rotation.copy(HERO_ROTATION); }
    eagle.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(eagle, true);
    const margin = baseHeight * .003;
    const bounds = { left: box.min.x - margin, right: box.max.x + margin, top: box.max.y + margin, bottom: box.min.y - margin };
    const w = bounds.right - bounds.left, h = bounds.top - bounds.bottom;
    renderer.setSize(Math.ceil(1200 * w / h), 1200);
    const camera = new THREE.OrthographicCamera(bounds.left, bounds.right, bounds.top, bounds.bottom, .1, 30000);
    camera.position.z = 10000;
    await renderer.compileAsync(scene, camera); renderer.render(scene, camera);
    output.variants[name] = { ...bounds, image: renderer.domElement.toDataURL('image/webp', .95) };
  }
  const response = await fetch('/__eagle/poster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(output) });
  document.querySelector('p').textContent = response.ok ? 'Hero posters saved.' : 'Export failed.';
};
