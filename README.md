# Wedgetail Technology — Coming Soon

Static coming-soon landing page for Wedgetail Technology, hosted on GitHub Pages.

Live: https://kb-wedgetail-dev.github.io/wedgetail-landing-page/

## Files

- `index.html` — the whole page: markup and CSS, no build step. Type is Space Grotesk from Google Fonts.
- `assets/logo-mark.svg` — circular eagle mark, white
- `assets/wordmark.svg` — "Wedgetail Technology" wordmark, white
- `assets/favicon.svg` — browser tab icon (mark on a blue rounded square)
- `assets/apple-touch-icon.png` — 180x180 home-screen icon
- `assets/og-image.png` — 1200x630 social share image
- `.nojekyll` — tells GitHub Pages to serve files as-is

Brand colour: `#1818e8`. Text: white.

## Deploying

GitHub Pages publishes from the `main` branch root. Every push to `main` goes live within a minute or two.

## Local preview

Open `index.html` in a browser, or run `python -m http.server 8080` and visit http://localhost:8080.

## Custom domain

If the site moves to its own domain, update the `og:url` and `og:image` meta tags in `index.html` and add a `CNAME` file containing the domain.
