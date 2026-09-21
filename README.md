# Wedgetail Technology

## Production deployment

This repository contains the Vite source for the full website. Build with `npm ci` then `npm run build`; Cloudflare Workers Static Assets serves `dist/` using `wrangler.jsonc`. Run `npm run deploy` from an account authorized for Wedgetail. Saved eagle poses in `public/eagle-poses.json` are included in the build.

The previous coming-soon site used GitHub Pages from the repository root. Do not use that root-publishing setting for this Vite source. Switch the domain to the verified Cloudflare deployment before merging the source replacement, then disable the old GitHub Pages deployment. The existing `CNAME` and legacy branding assets are retained for migration reference.

For Cloudflare Git integration, use build command `npm run build`, deploy command `npx wrangler deploy`, repository root, and production branch `main`.

A responsive business website with a rigged Golden Eagle asset that moves between sections as the visitor scrolls.

## Run

```sh
npm install
npm run dev
```

`npm run build` produces the deployable static site in `dist`. `npm run preview` serves that build.

## Eagle playground

Open `/eagle-playground/` to position the eagle over the actual homepage. The preview embeds the real page at the selected viewport dimensions, including its header, content, styles and Three.js renderer. Editing overrides the pose at the section's navigation anchor; it does not change the layout.

1. Choose the homepage section and reference frame size.
2. Select one of the five supplied animations. Play/pause, scrub the timeline, or step by 1/30 second to choose a pose.
3. Adjust turn, tilt, bank, zoom and position. Drag the preview to rotate, Shift-drag to move, or scroll over it to zoom. **Fit eagle in frame** recentres the complete current pose.
4. **Save section reference** writes the pose to `public/eagle-poses.json` through the local Vite server. All browsers load that same project file; focus or refresh the homepage to pick up changes. Applied mobile and desktop poses are stored separately. Working drafts survive reloads. **Test saved scrolling** releases the editor override so you can scroll the actual website, then return to positioning.
5. Take a screenshot for the complete website composition. **Eagle-only PNG** exports the model and a settings caption, without the HTML layout. Copy/export settings to share or publish; project saves are included in subsequent production builds. Saving requires the local development server; the deployed static site is read-only. **Export all settings** downloads saved sections plus the current view; **Import settings** restores that JSON.

Text guides indicate composition and can be hidden; they are not an exact rendering of the homepage layout. Exported coordinates describe the chest pivot in viewport percentages, XYZ Euler rotation in degrees and a scale relative to the idle model's bounds. Each JSON includes the frame dimensions, clip name, exact time and scale basis for reproduction.

`src/eagle-model.js` shares the model loading, feather materials and lighting between the playground and homepage. The playground is a separate Vite HTML entry at `eagle-playground/index.html`, included in production builds and marked `noindex`. Its local development endpoint validates and atomically saves pose data to the project; no save endpoint is included in a static production deployment.

When section references are ready, the captured values are committed to `src/eagle-references.js`. The homepage uses those rotations, clip names, clip times, scales and pivot positions at each desktop section, blending between adjacent saved poses while preserving the existing hero takeoff. A missing homepage reference keeps the established hero treatment.

The homepage menu stays fixed with a translucent backdrop. Its logo and navigation switch to dark ink over light sections, and anchor links account for the header height.

## Before publication

- Review the supplied placeholder claims in `draft/wedgetail-tech.html` before publication. Business copy has been carried across, not independently verified.
- Contact links open an email to the draft's `hello@wedgetail.tech` address.
- Choose hosting and configure the production domain. This project has not been deployed.

## Implementation

`src/scene.js` loads `public/models/wedgetail-eagle.glb`, exported from the supplied `_eagle/golden_eagle_blender/golden eagle_blender.blend` source. The desktop hero starts with a left-facing head-and-shoulders portrait: the crown sits around 27.5% down the hero, the beak begins near the horizontal midpoint, and the body crops beyond the bottom and right edges. The portrait pulls back to reveal the full rig during takeoff. Scroll scrubs the supplied `fly_start_A` takeoff, `fly_A0` flight and `fly_A_to_gliding_A` transition before continuing into `gliding_A0`. Reversing scroll reverses the sequence. Brief joint interpolation at clip boundaries keeps one opaque skinned model continuous; images and material opacity do not drive the animation. A chest-relative pivot removes source root travel, and framing is calculated from the model's bounds and the available space beside each section. Crossings between opposite gutters pass above the reading area. On phones the model stays in the reserved space after section copy.

The scene includes pause, reduced motion, hidden-tab suspension and context-loss handling. A single static idle preview is used only while loading or if WebGL fails. Fonts, the model and logo assets are bundled locally.

## Blender model

The purchased source remains under `_eagle`. `scripts/export_eagle_white.py` relinks the supplied texture files, retains the feather cutout masks and normal detail, makes the surfaces glossy white, and exports the rig with all five required clips. Texture maps are capped at 1024px. The current GLB is about 10 MB. Earlier Blender experiments remain under `models`; the export script and purchased source define the current runtime asset.

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' --background --factory-startup --python scripts/export_eagle_white.py
```

The original draft is untouched. `scripts/adapt-draft.mjs` adapts its section copy into the new shell; run it only when deliberately regenerating `index.html` from the draft.


## Animation verification

With the dev server running, `node scripts/check-eagle.mjs` checks an actual WebGL browser at desktop, wide desktop and phone sizes. It verifies skeletal movement, all five clips, opacity, reverse scrolling, section clearances, pause and reduced motion. It saves screenshots and a report under `models/verification`. The script uses the bundled Playwright runtime; set `PLAYWRIGHT_PATH` to use a different Playwright installation.

`node scripts/check-playground.mjs` checks desktop and phone editing: real bone changes while scrubbing, playback/pause, per-section persistence, PNG and JSON downloads, clipboard settings, import validation, homepage takeoff and fixed glass navigation. Its screenshots and report are saved under `.impeccable/review/`.

