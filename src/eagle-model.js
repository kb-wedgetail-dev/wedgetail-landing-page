import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const HERO_ROTATION = new THREE.Euler(0.08, -1.25 + THREE.MathUtils.degToRad(25), 0);
export const FLIGHT_ROTATION = new THREE.Euler(0.7, -0.25, -0.12);
export const EAGLE_MODEL_URL = '/models/wedgetail-eagle-v2.glb';

/** Shared by the homepage and the reference editor so their materials match. */
export function createEagleScene(renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.55;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xeaf0ff, 0x343b65, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(-300, 500, 600);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbbd7ff, 1.7);
  rim.position.set(400, 100, -300);
  scene.add(rim);
  return { scene, environment };
}

export async function loadEagleModel(onProgress) {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(EAGLE_MODEL_URL, onProgress);
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    object.frustumCulled = false;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      if (material.name === 'feather') {
        material.alphaTest = 0.45;
        material.side = THREE.DoubleSide;
        material.forceSinglePass = true;
      }
    }
  });
  return gltf;
}
