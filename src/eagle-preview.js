// The editor embeds the real page. Only the pose is overridden; layout,
// lighting, model, camera and responsive styles remain the production code.
export const previewMode = window.parent !== window && new URLSearchParams(location.search).has('eagle-preview');
export let previewReference = null;
let sectionId;
export function alignPreview() {
  if (!previewMode || !sectionId) return;
  const section = document.getElementById(sectionId);
  if (!section) return;
  const inset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  scrollTo({ top: Math.max(0, section.getBoundingClientRect().top + scrollY - (sectionId === 'home' ? 0 : inset)), behavior: 'instant' });
}
if (previewMode) {
  addEventListener('message', event => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'eagle-pose') return;
    const { reference, section } = event.data;
    if (reference === null) { previewReference = null; return; }
    if (!reference || !['x','y','zoom','yaw','pitch','roll','time'].every(key => Number.isFinite(reference[key]))) return;
    previewReference = { ...reference, clip: String(reference.clip).split('|').at(-1) };
    if (section !== sectionId || event.data.align) { sectionId = section; alignPreview(); }
  });
  addEventListener('resize', () => requestAnimationFrame(alignPreview));
  document.fonts.ready.then(alignPreview);
}
