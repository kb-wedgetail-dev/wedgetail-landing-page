import * as THREE from 'three';
import { createEagleScene, loadEagleModel, HERO_ROTATION, FLIGHT_ROTATION } from './eagle-model.js';
import { SAVED_EAGLE_REFERENCES, MOBILE_EAGLE_REFERENCES, loadLiveReferences, LIVE_REFERENCE_KEY } from './eagle-references.js';
import { previewMode, previewReference } from './eagle-preview.js';
import { referenceTime } from './eagle-timing.js';

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ease = (value) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };

/** One rig, with the supplied transition clips sampled in both scroll directions. */
export function createEagleAnimator(model, clips) {
  const mixer = new THREE.AnimationMixer(model);
  const names = ['idle_A0', 'fly_start_A', 'fly_A0', 'fly_A_to_gliding_A', 'gliding_A0'];
  const actions = names.map(name => {
    const clip = clips.find(item => item.name.split('|').at(-1) === name);
    if (!clip) throw new Error('Missing eagle animation: ' + name);
    const action = mixer.clipAction(clip);
    action.play();
    action.paused = true;
    return action;
  });
  const chest = model.getObjectByName('Spine003Chest') ||
    model.getObjectByName('Spine.003.Chest') || model.getObjectByName('Center');
  const center = new THREE.Vector3();
  let phase = 'idle';
  function finishPose(weights, times) {
    model.position.set(0, 0, 0);
    actions.forEach((action, i) => {
      action.setEffectiveWeight(weights[i]);
      const duration = action.getClip().duration;
      action.time = i === 1 || i === 3 ? Math.min(times[i], duration - 0.00001) : times[i] % duration;
    });
    mixer.update(0);
    model.updateMatrixWorld(true);
    if (chest) {
      model.worldToLocal(chest.getWorldPosition(center));
      model.position.copy(center).multiplyScalar(-1);
      model.updateMatrixWorld(true);
    }
    phase = names[weights.indexOf(Math.max(...weights))];
    return { phase, weights, times };
  }
  function sample(progress, elapsed = 0) {
    const p = Math.max(0, progress);
    // Each join interpolates joint transforms on the same skin. Materials stay
    // opaque. The authored takeoff opens the wings and tucks the legs.
    const takeoff = ease(p / 0.045);
    const flying = ease((p - 0.58) / 0.09);
    const settling = ease((p - 0.90) / 0.08);
    const gliding = ease((p - 1.13) / 0.08);
    const weights = [1 - takeoff, takeoff * (1 - flying),
      flying * (1 - settling), settling * (1 - gliding), gliding];
    const times = [
      elapsed * 0.35,
      clamp(p / 0.67, 0, 1) * actions[1].getClip().duration,
      Math.max(0, (p - 0.58) / 0.4) * actions[2].getClip().duration,
      clamp((p - 0.90) / 0.31, 0, 1) * actions[3].getClip().duration,
      Math.max(0, p - 1.13) * 2 + elapsed * 0.4,
    ];
    return finishPose(weights, times);
  }
  function sampleReference(reference) {
    const index = Math.max(0, names.indexOf(reference.clip));
    const weights = names.map((_, i) => i === index ? 1 : 0);
    const times = names.map((name, i) => i === index ? Math.max(0, reference.time || 0) : 0);
    return finishPose(weights, times);
  }
  function blendReferences(from, to, progress, elapsed = 0) {
    const a = from || to;
    const b = to || from;
    const ai = Math.max(0, names.indexOf(a.clip));
    const bi = Math.max(0, names.indexOf(b.clip));
    const t = clamp(progress, 0, 1);
    const weights = names.map((_, i) => (i === ai ? 1 - t : 0) + (i === bi ? t : 0));
    const times = names.map((_, i) => {
      if (i === ai && i === bi) return lerp(referenceTime(a, elapsed), referenceTime(b, elapsed), t);
      if (i === ai) return referenceTime(a, elapsed);
      if (i === bi) return referenceTime(b, elapsed);
      return 0;
    });
    return finishPose(weights, times);
  }
  function blendPose(from, to, progress, elapsed = 0) {
    const index = Math.max(0, names.indexOf(to.clip));
    const t = clamp(progress, 0, 1);
    const weights = from.weights.map((weight, i) => weight * (1 - t) + (i === index ? t : 0));
    const times = from.times.map((time, i) => time * (1 - t) + (i === index ? referenceTime(to, elapsed) * t : 0));
    return finishPose(weights, times);
  }
  return { sample, sampleReference, blendReferences, blendPose, mixer, get phase() { return phase; } };
}

export async function startEagle(container, toggle, sections) {
  toggle.hidden = true;
  const fallback = container.querySelector('.fallback-eagle-idle');
  container.querySelector('.fallback-eagle-flight')?.remove();
  const hero = sections[0];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let renderer;
  let animationFrame = 0;
  let paused = reduced.matches;
  let hidden = document.hidden;
  let width = innerWidth, height = innerHeight;
  let offset = scrollY, elapsed = 0, previousTime = performance.now();
  let anchors = [], heroAnchor, departureAnchor, heroFraming, heroSize, flightSize;
  let scrollInset = 0, maxScroll = 0;
  let contextLost = false;

  function fail(error) {
    console.error('Eagle scene could not start:', error);
    cancelAnimationFrame(animationFrame);
    container.classList.remove('webgl-ready');
    container.dataset.renderer = 'fallback';
    toggle.hidden = true;
    renderer?.dispose();
    renderer?.domElement.remove();
  }
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const { scene } = createEagleScene(renderer);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 30000);
    camera.position.z = 10000;
    const gltf = await loadEagleModel();
    const model = gltf.scene;
    const eagle = new THREE.Group();
    eagle.add(model);
    scene.add(eagle);
    const animator = createEagleAnimator(model, gltf.animations);
    const box = new THREE.Box3(), dimensions = new THREE.Vector3();
    animator.sample(0);
    eagle.rotation.copy(HERO_ROTATION);
    eagle.updateMatrixWorld(true);
    box.setFromObject(eagle, true).getSize(dimensions);
    const idleDimensions = dimensions.clone();
    const idleCenter = box.getCenter(new THREE.Vector3());
    const portraitCorner = new THREE.Vector3(box.min.x, box.max.y, 0);
    animator.sample(1.3);
    eagle.rotation.copy(FLIGHT_ROTATION);
    eagle.updateMatrixWorld(true);
    box.setFromObject(eagle, true).getSize(dimensions);
    const flightDimensions = dimensions.clone();
    const flightCenter = box.getCenter(new THREE.Vector3());

    let heroCopyBottom = 0;
    let portraitBoundsKey = '', portraitTop = 0;
    const referenceTransform = (reference, keepBelowHero = false) => {
      if (!reference) return null;
      const target = {
        x: width * reference.x / 100,
        y: height * reference.y / 100,
        scale: height / idleDimensions.y * reference.zoom / 100,
        rotation: new THREE.Euler(
          THREE.MathUtils.degToRad(reference.pitch),
          THREE.MathUtils.degToRad(reference.yaw),
          THREE.MathUtils.degToRad(reference.roll),
        ),
      };
      // Safari's changing viewport and wrapped copy need a content-based floor.
      // Apply the same floor in the playground's real homepage preview.
      if (width <= 600 && keepBelowHero) {
        const key = JSON.stringify([reference.clip, reference.time, reference.pitch, reference.yaw, reference.roll]);
        if (key !== portraitBoundsKey) {
          animator.sampleReference(reference);
          eagle.position.set(0, 0, 0);
          eagle.scale.setScalar(1);
          eagle.rotation.copy(target.rotation);
          eagle.updateMatrixWorld(true);
          portraitTop = box.setFromObject(eagle, true).max.y;
          portraitBoundsKey = key;
        }
        target.y = Math.max(target.y, heroCopyBottom + 40 + portraitTop * target.scale);
      }
      return target;
    };

    function measure() {
      loadLiveReferences();
      width = innerWidth;
      height = innerHeight;
      scrollInset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      maxScroll = Math.max(0, document.documentElement.scrollHeight - height);
      renderer.setSize(width, height);
      camera.left = -width / 2; camera.right = width / 2;
      camera.top = height / 2; camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      const mobile = width <= 600;
      const gutter = width * 0.07;
      const copy = hero.querySelector('.hero-copy').getBoundingClientRect();
      heroCopyBottom = copy.bottom + scrollY;
      const caption = hero.querySelector('.eagle-caption').getBoundingClientRect();
      const heroTop = hero.getBoundingClientRect().top + scrollY;
      heroFraming = idleCenter;
      if (mobile) {
        const top = copy.bottom + scrollY + 30;
        const bottom = caption.top + scrollY - 18;
        heroAnchor = { x: width * 0.5, y: (top + bottom) / 2 - heroTop };
        heroSize = Math.min(width * 0.72 / idleDimensions.x, Math.max(140, bottom - top) / idleDimensions.y);
      } else if (width > 1000) {
        // The reference is a portrait: place the beak and crown, and allow the
        // shoulder/body to extend beyond the bottom and right of the viewport.
        const titleRange = document.createRange();
        titleRange.selectNodeContents(hero.querySelector('h1'));
        const titleRight = Math.max(...[...titleRange.getClientRects()].map(rect => rect.right));
        heroAnchor = { x: Math.max(width * 0.5, titleRight + width * 0.035), y: hero.offsetHeight * 0.275 };
        heroSize = hero.offsetHeight * 1.15 / idleDimensions.y;
        heroFraming = portraitCorner;
      } else {
        heroAnchor = { x: width * 0.76, y: hero.offsetHeight * 0.48 };
        const availableWidth = 2 * Math.min(heroAnchor.x - copy.right - 24, width - 24 - heroAnchor.x);
        heroSize = Math.min(Math.min(width * 0.415, availableWidth) / idleDimensions.x,
          height * 0.66 / idleDimensions.y);
      }
      departureAnchor = width > 1000 ? { x: width * 0.76, y: hero.offsetHeight * 0.48 } : heroAnchor;
      hero.style.setProperty('--eagle-hero-x', departureAnchor.x + 'px');
      hero.style.setProperty('--eagle-hero-y', departureAnchor.y + 'px');
      anchors = sections.map((section, index) => {
        const rect = section.getBoundingClientRect();
        const content = section.querySelector('.wrap').getBoundingClientRect();
        const top = rect.top + scrollY;
        if (index === 0) return { ...heroAnchor, top, size: heroSize, section, reference: null };
        if (mobile) {
          return { x: width * 0.5, y: top + rect.height - 100, top,
            size: Math.min(width * 0.56 / flightDimensions.x, 140 / flightDimensions.y), section,
            reference: MOBILE_EAGLE_REFERENCES[section.id] || null };
        }
        const leftSpace = content.left - gutter;
        const rightSpace = width - gutter - content.right;
        const useLeft = leftSpace > rightSpace;
        const available = Math.max(65, useLeft ? leftSpace : rightSpace);
        return {
          x: useLeft ? gutter + available / 2 : content.right + available / 2,
          y: Math.min(height * 0.49, 440),
          top, section,
          size: Math.min(available * 0.83 / flightDimensions.x, height * 0.34 / flightDimensions.y),
          reference: SAVED_EAGLE_REFERENCES[section.id] || null,
        };
      });
      flightSize = anchors[1].size;
      if (fallback) {
        fallback.style.left = heroAnchor.x + 'px';
        fallback.style.top = heroAnchor.y + 'px';
      }
    }
    addEventListener('storage', event => { if (event.key === LIVE_REFERENCE_KEY) measure(); });
    addEventListener('eagle-poses-updated', measure);

    let lastPose;
    function draw(now, immediate = false, render = true) {
      const dt = Math.min(Math.max((now - previousTime) / 1000, 0), 0.05);
      previousTime = now;
      if (!paused) elapsed += dt;
      if (reduced.matches || immediate) offset = scrollY;
      else if (!paused) offset = THREE.MathUtils.damp(offset, scrollY, 10, dt);
      if (Math.abs(offset - scrollY) < 0.1) offset = scrollY;
      const mobile = width <= 600;
      const progress = Math.max(0, offset - anchors[0].top) / Math.max(1, hero.offsetHeight * 0.78);
      const animationTime = reduced.matches ? 0 : elapsed;
      // Anchor links stop below the fixed menu. Reach the reference there,
      // including the final section when the document cannot scroll any further.
      const poseTop = anchor => width > 1000
        ? Math.max(0, Math.min(anchor.top - scrollInset, maxScroll))
        : anchor.top;
      if (!paused || !lastPose || reduced.matches) {
        lastPose = animator.sample(reduced.matches ? 0 : progress, reduced.matches ? 0 : elapsed);
      }
      const launch = ease(progress / 0.5);
      const zoom = ease(progress / 0.28);
      let x, y, scale;
      let directReferencePlacement = false;
      let rotation = new THREE.Euler(
        lerp(HERO_ROTATION.x, FLIGHT_ROTATION.x, launch),
        lerp(HERO_ROTATION.y, FLIGHT_ROTATION.y, launch),
        lerp(0, FLIGHT_ROTATION.z + Math.sin(offset / Math.max(height, 1)) * 0.16, launch),
      );
      let sectionIndex = 0;
      if (mobile) {
        // On narrow screens the rig occupies the reserved space after the copy.
        // Switch to the next anchor only while both positions are offscreen.
        while (sectionIndex < anchors.length - 1 &&
          (sectionIndex === 0 ? heroAnchor.y : anchors[sectionIndex].y) - offset < -160) sectionIndex++;
        const anchor = anchors[sectionIndex];
        x = anchor.x;
        y = (sectionIndex === 0 ? heroAnchor.y : anchor.y) - offset;
        scale = sectionIndex === 0 ? lerp(heroSize, flightSize, zoom) : anchor.size;
        // Match the editor's chest-pivot portrait at scroll zero, then blend
        // into the existing takeoff path as the visitor scrolls.
        const heroReference = MOBILE_EAGLE_REFERENCES.home;
        if (sectionIndex === 0 && heroReference && zoom < 1) {
          const target = referenceTransform(heroReference, true);
          x -= lerp(heroFraming.x, flightCenter.x, launch) * scale;
          y += lerp(heroFraming.y, flightCenter.y, launch) * scale;
          x = lerp(target.x, x, zoom);
          y = lerp(target.y - offset, y, zoom);
          scale = lerp(target.scale, scale, zoom);
          rotation.set(lerp(target.rotation.x, rotation.x, launch), lerp(target.rotation.y, rotation.y, launch), lerp(target.rotation.z, rotation.z, launch));
          lastPose = animator.blendPose(lastPose, heroReference, 1 - launch, animationTime);
          directReferencePlacement = true;
        }
        // A phone reference uses the same viewport coordinates as the editor
        // when its section is aligned beneath the header. Keep it attached to
        // that section as the page scrolls, with a short approach into the pose.
        const referenceIndex = anchors.findIndex((item, index) => {
          if (!item.reference) return false;
          const start = Math.max(0, Math.min(item.top - scrollInset, maxScroll));
          const approach = Math.min(height * 0.18, (item.top - (anchors[index - 1]?.top || 0)) * 0.2);
          const end = anchors[index + 1]?.top - scrollInset;
          return offset >= start - approach && (!Number.isFinite(end) || offset < end);
        });
        if (referenceIndex >= 0) {
          const item = anchors[referenceIndex];
          const start = Math.max(0, Math.min(item.top - scrollInset, maxScroll));
          const approach = Math.min(height * 0.18, (item.top - (anchors[referenceIndex - 1]?.top || 0)) * 0.2);
          const t = approach > 0 ? ease((offset - start + approach) / approach) : 1;
          const target = referenceTransform(item.reference);
          // Convert the default bounds-centred position into a chest pivot
          // before blending, so enabling a reference cannot cause a jump.
          x -= lerp(heroFraming.x, flightCenter.x, launch) * scale;
          y += lerp(heroFraming.y, flightCenter.y, launch) * scale;
          x = lerp(x, target.x, t);
          y = lerp(y, target.y + start - offset, t);
          scale = lerp(scale, target.scale, t);
          rotation.set(lerp(rotation.x, target.rotation.x, t), lerp(rotation.y, target.rotation.y, t), lerp(rotation.z, target.rotation.z, t));
          lastPose = animator.blendPose(lastPose, item.reference, t, animationTime);
          directReferencePlacement = true;
        }
      } else if (offset < poseTop(anchors[1])) {
        const travel = ease((offset / anchors[1].top - 0.28) / 0.72);
        x = lerp(lerp(heroAnchor.x, departureAnchor.x, launch), anchors[1].x, travel);
        y = lerp(lerp(heroAnchor.y, departureAnchor.y, launch), anchors[1].y, travel);
        scale = lerp(heroSize, flightSize, zoom);
        const savedHero = SAVED_EAGLE_REFERENCES.home;
        if (width > 1000 && savedHero && zoom < 1) {
          const target = referenceTransform(savedHero);
          x -= lerp(heroFraming.x, flightCenter.x, launch) * scale;
          y += lerp(heroFraming.y, flightCenter.y, launch) * scale;
          x = lerp(target.x, x, zoom); y = lerp(target.y, y, zoom);
          scale = lerp(target.scale, scale, zoom);
          rotation.set(lerp(target.rotation.x, rotation.x, launch), lerp(target.rotation.y, rotation.y, launch), lerp(target.rotation.z, rotation.z, launch));
          lastPose = animator.blendPose(lastPose, savedHero, 1 - launch, animationTime);
          directReferencePlacement = true;
        }
        const nextReference = anchors[1].reference;
        const referenceBlend = nextReference ? ease((progress - 0.56) / 0.32) : 0;
        if (referenceBlend > 0) {
          directReferencePlacement = true;
          const target = referenceTransform(nextReference);
          x = lerp(x, target.x, referenceBlend);
          y = lerp(y, target.y, referenceBlend);
          scale = lerp(scale, target.scale, referenceBlend);
          rotation.x = lerp(rotation.x, target.rotation.x, referenceBlend);
          rotation.y = lerp(rotation.y, target.rotation.y, referenceBlend);
          rotation.z = lerp(rotation.z, target.rotation.z, referenceBlend);
          lastPose = animator.blendPose(lastPose, nextReference, referenceBlend, animationTime);
        }
      } else {
        while (sectionIndex < anchors.length - 1 && offset >= poseTop(anchors[sectionIndex + 1])) sectionIndex++;
        const a = anchors[sectionIndex], b = anchors[Math.min(sectionIndex + 1, anchors.length - 1)];
        const span = poseTop(b) - poseTop(a);
        // Keep the authored pose while reading. Blend only over the final part
        // of the section instead of changing its scale throughout the copy.
        const transition = width > 1000 ? Math.min(height * 0.22, span * 0.3) : span;
        const t = a === b || transition <= 0 ? 0 : ease((offset - (poseTop(b) - transition)) / transition);
        if (Math.abs(a.x - b.x) > width * 0.35) {
          // Cross above the reading area, then descend into the next gutter.
          const overhead = -Math.max(110, flightDimensions.y * Math.max(a.size, b.size));
          x = lerp(a.x, b.x, ease((t - 0.25) / 0.5));
          y = t < 0.5 ? lerp(a.y, overhead, ease(t / 0.3)) : lerp(overhead, b.y, ease((t - 0.7) / 0.3));
        } else {
          x = lerp(a.x, b.x, t);
          y = lerp(a.y, b.y, t);
        }
        scale = lerp(a.size, b.size, t);
        if (width > 1000 && (a.reference || b.reference)) {
          directReferencePlacement = true;
          const from = a.reference || b.reference;
          const to = b.reference || a.reference;
          const fromTransform = referenceTransform(from);
          const toTransform = referenceTransform(to);
          x = lerp(fromTransform.x, toTransform.x, t);
          y = lerp(fromTransform.y, toTransform.y, t);
          scale = lerp(fromTransform.scale, toTransform.scale, t);
          rotation.set(
            lerp(fromTransform.rotation.x, toTransform.rotation.x, t),
            lerp(fromTransform.rotation.y, toTransform.rotation.y, t),
            lerp(fromTransform.rotation.z, toTransform.rotation.z, t),
          );
          lastPose = animator.blendReferences(from, to, t, animationTime);
        }
      }
      if (reduced.matches) {
        // Reduced motion keeps a calm local sculpture, without takeoff or banking.
        y = heroAnchor.y - offset;
        x = heroAnchor.x;
        scale = heroSize;
      }
      const framing = reduced.matches ? 0 : launch;
      if (previewMode && previewReference) {
        const target = referenceTransform(previewReference, previewReference.section === 'home');
        x = target.x; y = target.y; scale = target.scale;
        rotation.copy(target.rotation);
        lastPose = animator.sampleReference(previewReference);
        directReferencePlacement = true;
      }
      if (directReferencePlacement) {
        eagle.position.set(x - width / 2, height / 2 - y, 0);
      } else {
        eagle.position.set(x - width / 2 - lerp(heroFraming.x, flightCenter.x, framing) * scale,
          height / 2 - y - lerp(heroFraming.y, flightCenter.y, framing) * scale, 0);
      }
      eagle.scale.setScalar(scale);
      eagle.rotation.copy(rotation);
      if (render) renderer.render(scene, camera);
      container.dataset.phase = lastPose.phase;
    }
    function frame(now) {
      if (hidden || contextLost) return;
      draw(now);
      if (!paused) animationFrame = requestAnimationFrame(frame);
    }
    function restart() {
      cancelAnimationFrame(animationFrame);
      previousTime = performance.now();
      if (hidden || contextLost) return;
      draw(previousTime, true);
      if (!paused) animationFrame = requestAnimationFrame(frame);
    }
    function updateToggle() {
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.setAttribute('aria-label', paused ? 'Resume eagle animation' : 'Pause eagle animation');
      toggle.querySelector('span').textContent = paused ? 'Resume flight' : 'Pause flight';
    }
    toggle.addEventListener('click', () => { paused = !paused; updateToggle(); restart(); });
    reduced.addEventListener('change', event => { paused = event.matches; updateToggle(); restart(); });
    document.addEventListener('visibilitychange', () => { hidden = document.hidden; restart(); });
    addEventListener('scroll', () => { if (paused) draw(performance.now(), true); }, { passive: true });
    addEventListener('resize', () => { measure(); restart(); });
    const observer = new ResizeObserver(() => { measure(); restart(); });
    observer.observe(document.querySelector('main'));
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); contextLost = true; cancelAnimationFrame(animationFrame);
      container.classList.remove('webgl-ready'); toggle.hidden = true;
      container.dataset.renderer = 'fallback';
    });
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      contextLost = false; container.classList.add('webgl-ready'); toggle.hidden = false;
      container.dataset.renderer = 'webgl'; restart();
    });
    await document.fonts.ready;
    measure();
    // Warm the actual skin/material shaders in the current viewport pose while
    // the canvas is hidden. Loading the GLB alone does not mean it is paint-ready.
    draw(performance.now(), true, false);
    await renderer.compileAsync(scene, camera);
    updateToggle();
    restart();
    // Commit a hidden frame before starting the CSS reveal, even on a warm cache.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    draw(performance.now(), true);
    if (contextLost) return;
    container.classList.add('webgl-ready');
    container.dataset.renderer = 'webgl';
    toggle.hidden = false;

    // Development-only evidence for browser checks: actual rig joints and
    // projected bounds, rather than assuming a successful build means motion.
    if (import.meta.env.DEV) {
      window.__eagle = {
        get scroll() { return offset; },
        snapshot() {
          eagle.updateMatrixWorld(true);
          const bounds = new THREE.Box3().setFromObject(eagle, true);
          const bones = [];
          let opaque = true;
          model.traverse(object => {
            if (object.isBone && /wing[R|L]00[235]|Head$/.test(object.name)) {
              bones.push({ name: object.name, rotation: object.quaternion.toArray() });
            }
            if (object.isMesh) {
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              opaque &&= materials.every(material => material.opacity === 1 && !material.transparent);
            }
          });
          return { renderer: container.dataset.renderer, phase: lastPose.phase,
            weights: lastPose.weights, bones, scroll: offset,
            opaque,
            bounds: { left: bounds.min.x + width / 2, right: bounds.max.x + width / 2,
              top: height / 2 - bounds.max.y, bottom: height / 2 - bounds.min.y },
            clips: gltf.animations.map(clip => clip.name),
            anchors: anchors.map(({ x, y, size, top }) => ({ x, y, size, top })) };
        },
      };
    }
  } catch (error) { fail(error); }
}
