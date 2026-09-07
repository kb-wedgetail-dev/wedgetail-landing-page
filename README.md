# Wedgetail Technology — Coming Soon

Static coming-soon landing page for Wedgetail Technology, hosted on GitHub Pages.

Live: https://wedgetail.tech/ (GitHub Pages URL https://kb-wedgetail-dev.github.io/wedgetail-landing-page/ redirects there)

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

`CNAME` holds `wedgetail.tech`; GitHub Pages reads it to serve the custom domain. DNS is at Cloudflare: four A records on the apex pointing at GitHub Pages IPs (185.199.108-111.153) and a `www` CNAME to `kb-wedgetail-dev.github.io`. Keep those records DNS-only (grey cloud) so GitHub can issue and renew the TLS certificate and enforce HTTPS.
