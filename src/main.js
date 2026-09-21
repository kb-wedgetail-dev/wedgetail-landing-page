import './style.css';
import { startEagle } from './scene.js';
import { previewMode, alignPreview } from './eagle-preview.js';
import { refreshLiveReferences } from './eagle-references.js';
const sections=[...document.querySelectorAll('main > section')];
const header = document.querySelector('.site-header');
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = [...header.querySelectorAll('nav a')];
const compactMenu = matchMedia('(max-width: 1400px)');
function closeMenu() {
  header.classList.remove('menu-open');
  menuToggle.setAttribute('aria-expanded', 'false');
}
menuToggle.addEventListener('click', () => {
  const open = header.classList.toggle('menu-open');
  menuToggle.setAttribute('aria-expanded', String(open));
});
navLinks.forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && header.classList.contains('menu-open')) {
    closeMenu(); menuToggle.focus();
  }
});
document.addEventListener('click', event => { if (!header.contains(event.target)) closeMenu(); });
compactMenu.addEventListener('change', closeMenu);
const headerSurfaces = [...document.querySelectorAll('main > section, .band, footer')].map(element => {
  const rgb = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number) || [24, 24, 232];
  return { element, light: rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 150 };
});
const updateHeader = () => {
  header.classList.toggle('is-scrolled', scrollY > 24);
  const midpoint = header.getBoundingClientRect().height / 2;
  const surface = headerSurfaces.find(({ element }) => {
    const rect = element.getBoundingClientRect();
    return rect.top <= midpoint && rect.bottom > midpoint;
  });
  header.classList.toggle('over-light', Boolean(surface?.light));
  // Follow the content beneath the fixed header, including direct anchor links.
  const readingLine = Math.max(header.getBoundingClientRect().height, parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) + 2;
  const current = [...sections].reverse().find(section => section.getBoundingClientRect().top <= readingLine);
  for (const link of navLinks) {
    if (link.hash === '#' + current?.id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
};
addEventListener('scroll', updateHeader, { passive: true });
addEventListener('resize', updateHeader);
updateHeader();
new ResizeObserver(updateHeader).observe(document.querySelector('main'));
document.fonts.ready.then(updateHeader);
document.querySelectorAll('#faq .buyer').forEach(item=>{
  const details=document.createElement('details'), summary=document.createElement('summary');
  summary.textContent=item.querySelector('h3').textContent;
  details.append(summary);
  item.querySelectorAll('p').forEach(p=>details.append(p));
  item.replaceWith(details);
});
refreshLiveReferences().catch(console.error).then(() => startEagle(document.querySelector('#eagle-scene'),document.querySelector('#motion-toggle'),sections));
const refreshPoses = () => refreshLiveReferences().then(() => dispatchEvent(new Event('eagle-poses-updated'))).catch(console.error);
addEventListener('focus', refreshPoses);
if (import.meta.hot) import.meta.hot.on('eagle-poses-updated', refreshPoses);
if (previewMode) {
  document.documentElement.style.scrollBehavior = 'auto';
  document.querySelector('#motion-toggle').style.display = 'none';
  new ResizeObserver(alignPreview).observe(document.querySelector('main'));
}
