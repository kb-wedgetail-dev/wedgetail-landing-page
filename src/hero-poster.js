import bounds from './hero-poster-bounds.json';
const image = document.querySelector('.eagle-loading-portrait');
const hero = document.querySelector('#home');
const copy = hero.querySelector('.hero-copy');
function placePoster() {
  const width = innerWidth, height = innerHeight;
  const rect = copy.getBoundingClientRect();
  const heroRect = hero.getBoundingClientRect();
  const mobile = width <= 600;
  const b = bounds.variants[mobile ? 'mobile' : 'desktop'];
  const margin = bounds.baseHeight * .003;
  const caption = hero.querySelector('.eagle-caption').getBoundingClientRect();
  hero.style.setProperty('--eagle-hero-x', `${width * (mobile ? .5 : .76)}px`);
  hero.style.setProperty('--eagle-hero-y', `${mobile
    ? (rect.bottom + caption.top + 12) / 2 - heroRect.top
    : hero.offsetHeight * .48}px`);
  let scale, left, top;
  if (mobile) {
    const ref = bounds.mobileReference;
    scale = height / bounds.baseHeight * ref.zoom / 100;
    const pivotY = Math.max(height * ref.y / 100, rect.bottom + scrollY + 40 + (b.top - margin) * scale);
    left = width * ref.x / 100 + b.left * scale;
    top = pivotY - b.top * scale;
  } else if (width > 1000) {
    const range = document.createRange(); range.selectNodeContents(hero.querySelector('h1'));
    const titleRight = Math.max(...[...range.getClientRects()].map(r => r.right));
    scale = hero.offsetHeight * 1.15 / bounds.baseHeight;
    left = Math.max(width * .5, titleRight + width * .035) - margin * scale;
    top = heroRect.top + scrollY + hero.offsetHeight * .275 - margin * scale;
  } else {
    const x = width * .76, y = hero.offsetHeight * .48;
    const modelWidth = b.right - b.left - 2 * margin;
    const availableWidth = 2 * Math.min(x - rect.right - 24, width - 24 - x);
    scale = Math.min(Math.min(width * .415, availableWidth) / modelWidth, height * .66 / bounds.baseHeight);
    left = x - (b.right - b.left) * scale / 2;
    top = heroRect.top + scrollY + y - (b.top - b.bottom) * scale / 2;
  }
  Object.assign(image.style, {
    left: `${left - rect.left}px`, top: `${top - rect.top - scrollY}px`,
    width: `${(b.right - b.left) * scale}px`, height: `${(b.top - b.bottom) * scale}px`,
  });
}
placePoster();
new ResizeObserver(placePoster).observe(copy);
addEventListener('resize', placePoster);
visualViewport?.addEventListener('resize', placePoster);
document.fonts.ready.then(placePoster);
