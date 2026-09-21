import './playground.css';
import * as THREE from 'three';
import { createEagleScene, loadEagleModel, HERO_ROTATION, FLIGHT_ROTATION, EAGLE_MODEL_URL } from './eagle-model.js';
import homepageHTML from '../index.html?raw';
import { saveLiveReference, loadLiveReferences, refreshLiveReferences, SAVED_EAGLE_REFERENCES, MOBILE_EAGLE_REFERENCES } from './eagle-references.js';

const $ = id => document.getElementById(id);
const deg = THREE.MathUtils.radToDeg;
const rad = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;
const round = value => Math.round(value * 1000) / 1000;
const clone = value => structuredClone(value);
const STORAGE_KEY = 'wedgetail-eagle-playground-v1';
const clipLabels = { idle_A0: 'Idle / perched', fly_start_A: 'Takeoff', fly_A0: 'Flapping flight', fly_A_to_gliding_A: 'Flight to glide', gliding_A0: 'Gliding' };
const labels = { home: 'Homepage', security: 'Custom AI', ai: 'Grounded AI', how: 'How we work', buyers: 'Who we work with', supply: 'Licensing', about: 'About us', 'how-to-buy': 'How to buy', faq: 'FAQs', contact: 'Contact' };
const page = new DOMParser().parseFromString(homepageHTML, 'text/html');
const sections = [...page.querySelectorAll('main > section')].map(section => ({
  id: section.id,
  label: labels[section.id] || section.id,
  title: section.querySelector('h1,h2')?.textContent || '',
  blue: ['home', 'about', 'contact'].includes(section.id),
  background: ['home', 'contact'].includes(section.id) ? '#1818e8' : section.id === 'about' ? '#0f0fb9' : ['ai', 'faq'].includes(section.id) ? '#eceeff' : section.id === 'buyers' ? '#f7f8ff' : '#ffffff',
  copySide: ['home', 'how', 'supply', 'how-to-buy', 'contact'].includes(section.id) ? 'left' : 'right',
}));
const sectionOptions = sections.map(section => new Option(section.label, section.id));
$('section').append(...sectionOptions);

const definitions = [
  ['yaw', 'Turn left / right', -180, 180, 0.1, '°', 'rotation-controls'],
  ['pitch', 'Tilt up / down', -180, 180, 0.1, '°', 'rotation-controls'],
  ['roll', 'Bank sideways', -180, 180, 0.1, '°', 'rotation-controls'],
  ['zoom', 'Zoom', 5, 400, 0.1, '%', 'framing-controls'],
  ['x', 'Horizontal position', -100, 200, 0.1, '%', 'framing-controls'],
  ['y', 'Vertical position', -100, 200, 0.1, '%', 'framing-controls'],
];
for (const [id, label, min, max, step, unit, parent] of definitions) {
  const row = document.createElement('div');
  row.className = 'transform-control';
  row.innerHTML = `<label for="${id}">${label}</label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}"><div class="number-wrap"><input id="${id}-number" aria-label="${label} in ${unit === '°' ? 'degrees' : 'percent'}" type="number" min="${min}" max="${max}" step="${step}"><span aria-hidden="true">${unit}</span></div>`;
  $(parent).append(row);
}

let state, saved = {}, drafts = {}, selected = 'home', clips = [], playing = false;
let deviceDrafts = {};
const deviceKey = (id, width) => `${width <= 600 ? 'mobile' : 'desktop'}:${id}`;
function rememberDraft() { if (state) deviceDrafts[deviceKey(selected, state.width)] = clone(state); }
function matchingReference(id, width, height) {
  loadLiveReferences();
  const existing = deviceDrafts[deviceKey(id, width)] || [drafts[id], saved[id]].find(value => value && (value.width <= 600) === (width <= 600));
  if (existing) return { ...clone(existing), width, height };
  const defaultsValue = defaults(sections.find(section => section.id === id), width, height);
  const reference = (width <= 600 ? MOBILE_EAGLE_REFERENCES : SAVED_EAGLE_REFERENCES)[id];
  return reference ? { ...defaultsValue, ...reference, width, height, clip: clips.find(clip => clip.name.endsWith(reference.clip)).name } : defaultsValue;
}
let renderer, scene, camera, model, eagle, mixer, actions, chest, baseHeight;
let raf = 0, previousTime = 0, ready = false, contextLost = false, storageTimer;
const stage = $('stage'), well = $('stage-well'), backdrop = $('backdrop');
const websitePreview = document.createElement('iframe');
websitePreview.title = 'Actual website preview';
websitePreview.src = '/?eagle-preview=1';
websitePreview.className = 'website-preview';
stage.prepend(websitePreview);
let testingScroll = false;
function sendPreview() {
  if (!state) return;
  websitePreview.contentWindow?.postMessage({ type: 'eagle-pose', section: selected, reference: testingScroll ? null : clone(state) }, location.origin);
}
websitePreview.addEventListener('load', sendPreview);
$('test-scroll').addEventListener('click', () => {
  testingScroll = !testingScroll;
  websitePreview.style.pointerEvents = testingScroll ? 'auto' : 'none';
  $('test-scroll').textContent = testingScroll ? 'Return to positioning' : 'Test saved scrolling';
  pause(); sendPreview();
  if (!testingScroll) websitePreview.contentWindow.postMessage({ type: 'eagle-pose', section: selected, reference: clone(state), align: true }, location.origin);
  notify(testingScroll ? 'Scroll the real website here. This uses saved poses, not unsaved edits.' : 'Positioning the eagle against the real section layout.');
});
const center = new THREE.Vector3();
const box = new THREE.Box3();
const notify = message => { $('status').textContent = message; };
const currentSection = () => sections.find(section => section.id === selected);
const duration = () => clips.find(clip => clip.name === state.clip)?.duration || 1;

function validateReference(value) {
  if (!value || typeof value !== 'object') throw new Error('A reference is missing.');
  const valid = {};
  for (const [key, min, max] of [['width', 320, 3840], ['height', 320, 2160], ['time', 0, 600], ['speed', 0.25, 2], ...definitions.map(([key,, min,max]) => [key,min,max])]) {
    if (!Number.isFinite(value[key]) || value[key] < min || value[key] > max) throw new Error('Invalid ' + key + ' value.');
    valid[key] = value[key];
  }
  if (!clips.some(clip => clip.name === value.clip)) throw new Error('This file uses an unavailable animation.');
  if (!['section', '#1818e8', '#eceeff', '#ffffff', '#0b0b2e'].includes(value.background)) throw new Error('Invalid background.');
  Object.assign(valid, { clip: value.clip, background: value.background, notes: String(value.notes || '').slice(0, 2000), loop: value.loop !== false, guides: value.guides !== false });
  valid.width = Math.round(valid.width); valid.height = Math.round(valid.height);
  valid.time = Math.min(valid.time, clips.find(clip => clip.name === valid.clip).duration);
  return valid;
}

function restore() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (data?.version !== 1) return;
    for (const [key, value] of Object.entries(data.deviceDrafts || {})) deviceDrafts[key] = validateReference(value);
    for (const section of sections) {
      if (data.saved?.[section.id]) saved[section.id] = validateReference(data.saved[section.id]);
      if (data.drafts?.[section.id]) drafts[section.id] = validateReference(data.drafts[section.id]);
    }
    if (sections.some(section => section.id === data.selected)) selected = data.selected;
  } catch { notify('Stored references could not be fully restored. You can still create and export new references.'); }
}

function persist() {
  if (!state) return;
  rememberDraft();
  drafts[selected] = clone(state);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, selected, saved, drafts, deviceDrafts })); }
  catch { notify('Browser storage is unavailable. Download your references to keep them.'); }
}

function markChanged() {
  $('saved-indicator').textContent = saved[selected] ? (JSON.stringify(saved[selected]) === JSON.stringify(state) ? 'Saved reference' : 'Unsaved changes') : 'New reference';
  clearTimeout(storageTimer);
  storageTimer = setTimeout(persist, 250);
}

function pose() {
  model.position.set(0, 0, 0);
  for (const [name, action] of actions) {
    action.setEffectiveWeight(name === state.clip ? 1 : 0);
    if (name === state.clip) action.time = Math.min(state.time, action.getClip().duration - 0.000001);
  }
  mixer.update(0);
  model.updateMatrixWorld(true);
  if (chest) {
    model.worldToLocal(chest.getWorldPosition(center));
    model.position.copy(center).multiplyScalar(-1);
  }
  eagle.rotation.set(rad(state.pitch), rad(state.yaw), rad(state.roll));
}

function setTransform() {
  pose();
  const scale = state.height / baseHeight * state.zoom / 100;
  eagle.scale.setScalar(scale);
  eagle.position.set((state.x / 100 - 0.5) * state.width, (0.5 - state.y / 100) * state.height, 0);
}

function defaults(section, width = 1440, height = 1000) {
  const rotation = section.id === 'home' ? HERO_ROTATION : FLIGHT_ROTATION;
  state = { width, height, clip: clips.find(clip => clip.name.endsWith(section.id === 'home' ? 'idle_A0' : 'gliding_A0')).name,
    time: 0, speed: 1, loop: true, pitch: round(deg(rotation.x)), yaw: round(deg(rotation.y)), roll: round(deg(rotation.z)),
    zoom: 65, x: 50, y: 50, background: 'section', guides: true, notes: '' };
  pose(); eagle.position.set(0, 0, 0); eagle.scale.setScalar(1); eagle.updateMatrixWorld(true);
  box.setFromObject(eagle, true);
  const dimensions = box.getSize(new THREE.Vector3());
  const middle = box.getCenter(new THREE.Vector3());
  if (section.id === 'home' && width > 1000) {
    state.zoom = 115;
    const scale = height / baseHeight * 1.15;
    state.x = round((width * 0.51 - box.min.x * scale) / width * 100);
    state.y = round((height * 0.275 + box.max.y * scale) / height * 100);
  } else {
    const size = Math.min(width * (width <= 600 ? 0.68 : 0.25) / dimensions.x, height * 0.4 / dimensions.y);
    state.zoom = round(size * baseHeight / height * 100);
    const x = width <= 600 ? 0.5 : section.copySide === 'left' ? 0.8 : 0.22;
    const y = width <= 600 ? 0.77 : 0.5;
    state.x = round((width * x - middle.x * size) / width * 100);
    state.y = round((height * y + middle.y * size) / height * 100);
  }
  loadLiveReferences();
  const published = (width <= 600 ? MOBILE_EAGLE_REFERENCES : SAVED_EAGLE_REFERENCES)[section.id];
  if (published) Object.assign(state, published, { width, height, clip: clips.find(clip => clip.name.endsWith(published.clip)).name });
  return clone(state);
}

function drawWrapped(ctx, text, x, y, width, lineHeight, maxLines = 5) {
  const words = text.split(/\s+/); let line = '', count = 0;
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (line && ctx.measureText(next).width > width) {
      ctx.fillText(line, x, y); y += lineHeight; count++;
      if (count >= maxLines) return y;
      line = word;
    } else line = next;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineHeight;
}

function drawBackdrop() { sendPreview(); }

function render() {
  if (!ready || contextLost) return;
  setTransform();
  sendPreview();
}

function layout() {
  if (!state) return;
  const rect = well.getBoundingClientRect();
  const padding = document.fullscreenElement ? 48 : 2;
  const scale = Math.max(0.01, Math.min((rect.width - padding) / state.width, (rect.height - padding) / state.height));
  stage.style.width = state.width * scale + 'px';
  stage.style.height = state.height * scale + 'px';
  websitePreview.style.width = state.width + 'px';
  websitePreview.style.height = state.height + 'px';
  websitePreview.style.transform = 'scale(' + scale + ')';
}

function resizeFrame() {
  renderer.setSize(state.width, state.height, false);
  backdrop.width = state.width; backdrop.height = state.height;
  camera.left = -state.width / 2; camera.right = state.width / 2;
  camera.top = state.height / 2; camera.bottom = -state.height / 2;
  camera.updateProjectionMatrix();
  $('resolution').textContent = `${state.width} × ${state.height}`;
  layout(); drawBackdrop(); render();
}

function syncTime() {
  $('time').max = duration(); $('time').value = state.time;
  $('time-display').textContent = `${state.time.toFixed(2)} / ${duration().toFixed(2)} s`;
}

function syncControls() {
  $('section').value = selected;
  $('preview-title').textContent = currentSection().label;
  for (const key of ['width', 'height', 'clip', 'speed', 'background', 'notes']) $(key).value = state[key];
  for (const key of ['loop', 'guides']) $(key).checked = state[key];
  for (const [key] of definitions) { $(key).value = state[key]; $(key + '-number').value = round(state[key]); }
  syncTime(); markChanged();
}

function pause() {
  playing = false; cancelAnimationFrame(raf);
  $('play').textContent = 'Play animation'; $('play').setAttribute('aria-pressed', 'false');
  if (state) { syncTime(); markChanged(); }
}

function tick(now) {
  if (!playing || document.hidden || contextLost) return;
  const dt = Math.min((now - previousTime) / 1000, 0.1); previousTime = now;
  state.time += dt * state.speed;
  if (state.time >= duration()) {
    if (state.loop) state.time %= duration();
    else { state.time = duration(); pause(); }
  }
  syncTime(); render();
  if (playing) raf = requestAnimationFrame(tick);
}

function switchSection(id) {
  pause(); drafts[selected] = clone(state); rememberDraft();
  const { width, height } = state;
  selected = id;
  state = matchingReference(id, width, height);
  syncControls(); resizeFrame(); persist();
  notify(`Editing ${currentSection().label}. Save the pose when it looks right.`);
}

function referenceDocument(references) {
  return { format: 'wedgetail-eagle-references', version: 1, model: EAGLE_MODEL_URL,
    coordinates: { projection: 'orthographic', rotation: 'XYZ Euler in degrees; pitch=X, yaw=Y, roll=Z', position: 'Chest pivot in viewport percent; x=0 left, y=0 top', zoom: '100% = viewport height / idle portrait bounds height', baseHeight },
    references: Object.fromEntries(Object.entries(references).map(([id, value]) => [id, { ...clone(value), section: id, label: labels[id] }])) };
}

function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function downloadImage() {
  pause(); render();
  renderer.render(scene, camera);
  const output = document.createElement('canvas');
  const caption = Math.max(88, Math.round(state.width / 18));
  output.width = state.width; output.height = state.height + caption;
  const ctx = output.getContext('2d');
  ctx.drawImage(backdrop, 0, 0); ctx.drawImage(renderer.domElement, 0, 0);
  ctx.fillStyle = '#0b0b2e'; ctx.fillRect(0, state.height, state.width, caption);
  const font = Math.max(11, Math.min(24, state.width / 85));
  ctx.fillStyle = '#ffffff'; ctx.font = `500 ${font}px Manrope`; ctx.textBaseline = 'top';
  ctx.fillText(`Wedgetail · ${currentSection().label} · ${state.width} × ${state.height}`, 16, state.height + 12);
  ctx.fillStyle = '#d4d4ff'; ctx.font = `400 ${Math.max(10, font * 0.8)}px "DM Sans"`;
  const text = `${clipLabels[state.clip.split('|').at(-1)]} at ${state.time.toFixed(3)}s · Turn ${state.yaw.toFixed(1)}° · Tilt ${state.pitch.toFixed(1)}° · Bank ${state.roll.toFixed(1)}° · Zoom ${state.zoom.toFixed(1)}% · X ${state.x.toFixed(1)}% · Y ${state.y.toFixed(1)}%`;
  drawWrapped(ctx, text, 16, state.height + 18 + font, state.width - 32, Math.max(14, font), 3);
  const blob = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The image could not be created. Please try again.');
  download(blob, `wedgetail-${selected}-${state.width}x${state.height}.png`);
  notify('Eagle-only PNG downloaded. Use a screenshot of the live preview to capture the website layout.');
}

async function start() {
  try {
    await refreshLiveReferences();
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    ({ scene } = createEagleScene(renderer));
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 30000);
    camera.position.z = 10000;
    stage.insertBefore(renderer.domElement, $('loading'));
    const gltf = await loadEagleModel(progress => {
      if (progress.total) $('loading-detail').textContent = `Loading model · ${Math.round(progress.loaded / progress.total * 100)}%`;
    });
    model = gltf.scene; clips = gltf.animations;
    eagle = new THREE.Group(); eagle.add(model); scene.add(eagle);
    mixer = new THREE.AnimationMixer(model);
    actions = new Map(clips.map(clip => { const action = mixer.clipAction(clip); action.play(); action.paused = true; return [clip.name, action]; }));
    chest = model.getObjectByName('Spine003Chest') || model.getObjectByName('Spine.003.Chest') || model.getObjectByName('Center');
    $('clip').append(...clips.map(clip => new Option(clipLabels[clip.name.split('|').at(-1)] || clip.name, clip.name)));
    state = { clip: clips.find(clip => clip.name.endsWith('idle_A0')).name, time: 0, pitch: deg(HERO_ROTATION.x), yaw: deg(HERO_ROTATION.y), roll: 0 };
    pose(); eagle.updateMatrixWorld(true);
    baseHeight = box.setFromObject(eagle, true).getSize(new THREE.Vector3()).y;
    restore();
    state = clone(drafts[selected] || saved[selected] || defaults(currentSection()));
    await document.fonts.ready;
    ready = true;
    syncControls(); resizeFrame();
    $('loading').hidden = true; $('editor').disabled = false; $('fit').disabled = false;
    new ResizeObserver(layout).observe(well);
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); contextLost = true; pause();
      $('loading').hidden = false; $('loading').querySelector('strong').textContent = 'Preview interrupted';
      $('loading-detail').textContent = 'Your settings are kept. Try reloading the preview.'; $('retry').hidden = false;
    });
    renderer.domElement.addEventListener('webglcontextrestored', () => { contextLost = false; $('loading').hidden = true; drawBackdrop(); render(); });
    if (import.meta.env.DEV) window.__eaglePlayground = {
      snapshot: () => {
        model.updateMatrixWorld(true);
        const bones = []; model.traverse(object => { if (object.isBone && /wing[R|L]00[235]|Head$/.test(object.name)) bones.push(object.quaternion.toArray()); });
        return { state: clone(state), selected, playing, clips: clips.map(clip => clip.name), bones, saved: clone(saved), baseHeight };
      },
    };
  } catch (error) {
    console.error(error); $('loading').querySelector('strong').textContent = 'The eagle could not load';
    $('loading-detail').textContent = 'Check your connection and WebGL support, then try again. Your saved references are kept.';
    $('retry').hidden = false;
  }
}

for (const [key,,min,max] of definitions) {
  for (const input of [$(key), $(key + '-number')]) input.addEventListener('input', () => {
    if (!ready || input.value === '' || !Number.isFinite(input.valueAsNumber)) return;
    state[key] = clamp(input.valueAsNumber, min, max);
    $(key).value = state[key];
    if (input !== $(key + '-number')) $(key + '-number').value = round(state[key]);
    render(); markChanged();
  });
  $(key + '-number').addEventListener('change', () => { $(key + '-number').value = round(state[key]); });
}
$('section').addEventListener('change', event => switchSection(event.target.value));
$('clip').addEventListener('change', () => { pause(); state.clip = $('clip').value; state.time = 0; syncTime(); render(); markChanged(); });
$('play').addEventListener('click', () => {
  if (playing) { pause(); return; }
  if (state.time >= duration()) state.time = 0;
  playing = true; $('play').textContent = 'Pause animation'; $('play').setAttribute('aria-pressed', 'true');
  previousTime = performance.now(); raf = requestAnimationFrame(tick);
});
$('time').addEventListener('input', event => { const time = Number(event.target.value); pause(); state.time = time; syncTime(); render(); markChanged(); });
for (const [id, direction] of [['previous-frame', -1], ['next-frame', 1]]) $(id).addEventListener('click', () => {
  pause(); state.time = clamp(state.time + direction / 30, 0, duration()); syncTime(); render(); markChanged();
});
$('speed').addEventListener('change', () => { state.speed = Number($('speed').value); markChanged(); });
$('loop').addEventListener('change', () => { state.loop = $('loop').checked; markChanged(); });
$('guides').addEventListener('change', () => { if (!ready) return; state.guides = $('guides').checked; drawBackdrop(); markChanged(); });
$('background').addEventListener('change', () => { state.background = $('background').value; drawBackdrop(); markChanged(); });
$('notes').addEventListener('input', () => { state.notes = $('notes').value; markChanged(); });
function changeFrame(width, height) {
  pause(); rememberDraft();
  const nextWidth = Math.round(clamp(width, 320, 3840)), nextHeight = Math.round(clamp(height, 320, 2160));
  if ((state.width <= 600) !== (nextWidth <= 600)) state = matchingReference(selected, nextWidth, nextHeight);
  else { state.width = nextWidth; state.height = nextHeight; }
  syncControls(); resizeFrame();
}
for (const key of ['width', 'height']) $(key).addEventListener('change', () => {
  const value = $(key).valueAsNumber;
  if (!Number.isFinite(value)) { $(key).value = state[key]; return; }
  changeFrame(key === 'width' ? value : state.width, key === 'height' ? value : state.height);
});
document.querySelectorAll('[data-frame]').forEach(button => button.addEventListener('click', () => changeFrame(...button.dataset.frame.split(',').map(Number))));
$('fit').addEventListener('click', () => {
  pause(); pose(); eagle.position.set(0, 0, 0); eagle.scale.setScalar(1); eagle.updateMatrixWorld(true);
  box.setFromObject(eagle, true); const dimensions = box.getSize(new THREE.Vector3()), middle = box.getCenter(new THREE.Vector3());
  const scale = Math.min(state.width * 0.8 / dimensions.x, state.height * 0.8 / dimensions.y);
  state.zoom = clamp(scale * baseHeight / state.height * 100, 5, 400);
  const actualScale = state.height / baseHeight * state.zoom / 100;
  state.x = 50 - middle.x * actualScale / state.width * 100;
  state.y = 50 + middle.y * actualScale / state.height * 100;
  syncControls(); render(); notify('The current pose is fitted and centred in the frame.');
});
$('reset').addEventListener('click', () => { pause(); state = defaults(currentSection(), state.width, state.height); syncControls(); resizeFrame(); notify('View reset. Previously saved references are still available in your exports.'); });
$('save').addEventListener('click', async () => {
  pause(); saved[selected] = clone(state); persist(); markChanged();
  $('save').disabled = true;
  try { await saveLiveReference(selected, state); notify(`${currentSection().label} saved to the project for ${state.width <= 600 ? 'mobile' : 'desktop'}. Chrome and other browsers now use this pose.`); }
  catch (error) { notify(error.message); }
  finally { $('save').disabled = false; }
});
$('download-image').addEventListener('click', () => downloadImage().catch(error => notify(error.message)));
$('copy').addEventListener('click', async () => {
  pause(); const text = JSON.stringify(referenceDocument({ [selected]: state }), null, 2);
  try { await navigator.clipboard.writeText(text); notify('Exact pose settings copied. Paste them into our conversation with your reference image.'); }
  catch { $('copy-fallback').hidden = false; $('copy-fallback').value = text; $('copy-fallback').focus(); $('copy-fallback').select(); notify('Select and copy the settings shown below the buttons.'); }
});
$('export').addEventListener('click', () => {
  pause(); const references = { ...saved, [selected]: clone(state) };
  download(new Blob([JSON.stringify(referenceDocument(references), null, 2)], { type: 'application/json' }), 'wedgetail-eagle-references.json');
  notify(`Exported ${Object.keys(references).length} section reference(s), including the current view.`);
});
$('view-references').addEventListener('click', () => {
  pause();
  $('copy-fallback').hidden = false;
  $('copy-fallback').value = JSON.stringify(referenceDocument(saved), null, 2);
  notify(`${Object.keys(saved).length} saved section reference(s) shown below. These are the saved poses, without unsaved drafts.`);
});
$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error('Choose a reference JSON file smaller than 1 MB.');
    const data = JSON.parse(await file.text());
    if (data.format !== 'wedgetail-eagle-references' || data.version !== 1 || !data.references) throw new Error('Choose an exported Wedgetail reference JSON file.');
    const imported = {};
    for (const [id, value] of Object.entries(data.references)) {
      if (!sections.some(section => section.id === id)) throw new Error('Unknown homepage section: ' + id);
      imported[id] = validateReference(value);
    }
    if (!Object.keys(imported).length) throw new Error('The file contains no section references.');
    pause(); saved = { ...saved, ...imported }; drafts = { ...drafts, ...imported };
    selected = Object.keys(imported)[0]; state = clone(imported[selected]);
    syncControls(); resizeFrame(); persist(); notify(`Imported ${Object.keys(imported).length} section reference(s).`);
  } catch (error) { notify('Import failed. ' + error.message); }
  event.target.value = '';
});
$('fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await well.requestFullscreen(); }
  catch { notify('Fullscreen is unavailable in this browser. The preview can still be adjusted with the controls.'); }
});
document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? 'Exit full screen' : 'Expand preview'; layout(); });
$('retry').addEventListener('click', () => location.reload());
document.addEventListener('visibilitychange', () => {
  cancelAnimationFrame(raf);
  if (document.hidden) persist();
  else if (playing) { previousTime = performance.now(); raf = requestAnimationFrame(tick); }
});
addEventListener('pagehide', persist);
let drag;
stage.addEventListener('pointerdown', event => {
  if (!ready || (event.pointerType === 'mouse' && ![0, 1].includes(event.button))) return;
  event.preventDefault(); stage.focus(); stage.setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, state: clone(state), move: event.shiftKey || event.button === 1 };
});
stage.addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  const rect = stage.getBoundingClientRect();
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (drag.move) { state.x = clamp(drag.state.x + dx / rect.width * 100, -100, 200); state.y = clamp(drag.state.y + dy / rect.height * 100, -100, 200); }
  else { state.yaw = clamp(drag.state.yaw + dx / rect.width * 180, -180, 180); state.pitch = clamp(drag.state.pitch + dy / rect.height * 180, -180, 180); }
  syncControls(); render();
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(eventName, () => { drag = null; });
stage.addEventListener('wheel', event => {
  if (!ready) return;
  event.preventDefault(); state.zoom = clamp(state.zoom * Math.exp(-event.deltaY * 0.001), 5, 400);
  syncControls(); render();
}, { passive: false });

start();

