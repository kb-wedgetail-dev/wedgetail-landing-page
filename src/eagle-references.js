// References captured in the Eagle playground. Coordinates use its orthographic
// viewport convention: x/y are the model pivot in percent, zoom is relative to
// the idle model height, and rotations are XYZ Euler degrees.
export const SAVED_EAGLE_REFERENCES = {
  security: { time: 0.2646000715, speed: 1, yaw: -13.3709924231, pitch: -21.6276576809, roll: -63.8, zoom: 23.6245873711, x: 21.883, y: 51.411, clip: 'fly_A_to_gliding_A' },
  ai: { time: 0, speed: 1, yaw: -14.324, pitch: 40.107, roll: -6.875, zoom: 8.691, x: 21.883, y: 51.411, clip: 'gliding_A0' },
  how: { time: 0.2221331823, speed: 1, yaw: -43.5950367029, pitch: -9.2974962447, roll: -47.2, zoom: 66.11955528863454, x: 101.1, y: 51.411, clip: 'fly_A0' },
  buyers: { time: 0, speed: 1, yaw: -14.324, pitch: 40.107, roll: -6.875, zoom: 8.691, x: 21.883, y: 51.411, clip: 'gliding_A0' },
  supply: { time: 0, speed: 1, yaw: -60.369643930047474, pitch: -22.795937735856302, roll: -6.875, zoom: 129.7, x: 98.89220339169984, y: 78.71299941363841, clip: 'idle_A0' },
  about: { time: 0, speed: 1, yaw: -14.324, pitch: 40.107, roll: -6.875, zoom: 8.691, x: 21.883, y: 51.411, clip: 'gliding_A0' },
  'how-to-buy': { time: 0, speed: 1, yaw: -42.1995779607, pitch: -16.5023366093, roll: -6.875, zoom: 40, x: 79.883, y: 51.411, clip: 'gliding_A0' },
  faq: { time: 0, speed: 1, yaw: -14.324, pitch: 40.107, roll: -6.875, zoom: 8.691, x: 21.883, y: 51.411, clip: 'gliding_A0' },
  contact: { time: 0, speed: 1, yaw: -9.1382491676, pitch: -2.26423597, roll: 1.3, zoom: 153.5, x: 79.8, y: 79.8, clip: 'idle_A0' },
};

// Phone compositions are independent of the desktop references above.
export const MOBILE_EAGLE_REFERENCES = {
  home: { time: 0, speed: 1, yaw: -49.9040741273496, pitch: 4.117070367597885, roll: 0, zoom: 77.08680529409851, x: 72.31472134202325, y: 81.41986634013253, clip: 'idle_A0' },
  contact: { time: 0, speed: 1, yaw: -9.138249167633596, pitch: -2.264235969957562, roll: 1.3, zoom: 68.97199599199348, x: 68.01104362774993, y: 88.74941634241246, clip: 'idle_A0' },
};

export const LIVE_REFERENCE_KEY = 'wedgetail-live-poses-v1';
let sharedReferences = {};
export async function refreshLiveReferences() {
  const response = await fetch('/eagle-poses.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load project eagle poses.');
  sharedReferences = await response.json();
  loadLiveReferences();
}
export async function saveLiveReference(section, reference) {
  const response = await fetch('/__eagle/save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section, reference }),
  });
  if (!response.ok) throw new Error('Project save failed. Run the local development server to save poses.');
  await refreshLiveReferences();
}
export function loadLiveReferences() {
  try {
    const data = sharedReferences;
    for (const [device, target] of [['mobile', MOBILE_EAGLE_REFERENCES], ['desktop', SAVED_EAGLE_REFERENCES]]) {
      for (const [id, value] of Object.entries(data[device] || {})) {
        if (!['x','y','zoom','yaw','pitch','roll','time'].every(key => Number.isFinite(value[key]))) continue;
        if (!['idle_A0','fly_start_A','fly_A0','fly_A_to_gliding_A','gliding_A0'].includes(value.clip)) continue;
        target[id] = value;
      }
    }
  } catch { /* Repository poses remain available if browser storage is blocked. */ }
}

