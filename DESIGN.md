---
name: Wedgetail Technology
description: Electric blue and white with a sculptural eagle in flight.
colors:
  brand: "#1818e8"
  background: "#ffffff"
  alternate: "#eceeff"
  foreground: "#0b0b2e"
  muted: "#4a4d6b"
  focus: "#75dcca"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(64px, 7.6vw, 96px)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.75
rounded:
  control: "3px"
  motion-control: "20px"
spacing:
  gutter: "7%"
---

# Wedgetail visual system

## Overview

An electric blue and white world grounded in the existing wedgetail.tech identity. The original logo and wordmark are locally bundled. A rigged Golden Eagle from the supplied `_eagle` asset library is the signature scroll interaction, rendered in glossy white with the original feather cutouts and subtle normal detail. The desktop hero opens on a left-facing head-and-shoulders portrait, with the beak near the horizontal midpoint and the body intentionally cropped beyond the bottom and right edges. The eye and beak face the headline. Phone and tablet layouts retain a contained sculpture below or beside the copy. Scroll scrubs the supplied takeoff, flapping flight, flight-to-glide and glide clips on one opaque model while pulling back and travelling between sections. Scrolling back reverses the sequence.

## Colors
Brand blue anchors the hero, impact and contact sections. White and pale blue support reading, with dark ink and muted secondary text. Blue surfaces use white and pale lavender text. Deep blue #0f0fb9 grounds the ownership band and footer. Mint marks focus and selected hover accents.

## Typography
Locally bundled Manrope supplies headings and controls; locally bundled DM Sans supplies prose. Main headings use weight 500 and tracking -0.04em; smaller titles use 600. Body text is generally 14px, with 15px section introductions up to 72ch wide. Hero type is 76px up to 1000px and 61px up to 600px. Section headings use clamp(36px, 3.7vw, 58px), becoming 36px on phones.

## Layout
Section gutters are 7%, with a 1280px maximum inner wrapper and 88px desktop vertical padding outside the hero. Content determines section height rather than viewport minimums. Above 1550px, gutters expand around a 1380px frame. Header gutters are 5% on desktop and 7% on phones. Asymmetric desktop content widths reserve space for the eagle.

At 1000px service rows stack and commitments become two columns. At 600px content wrappers fill the available width, process and buyer grids become one column, and section padding becomes 75px. Extra bottom space reserves room for the eagle. Phone navigation retains the contact link.

The homepage header stays fixed as the page scrolls. Anchor destinations reserve 105px above their content, reduced to 88px at the homepage phone breakpoint. The eagle reference editor extends this system with a canvas and compact control sidebar; its responsive composition is recorded in [.impeccable/surfaces/eagle-playground.md](.impeccable/surfaces/eagle-playground.md).

## Elevation & Depth
The eagle loads in the background while page content remains available. Its canvas stays hidden until fonts, model, shader compilation and a correctly positioned first frame are ready, then fades in over 900ms. Reduced motion skips the fade. The static eagle is reserved for load or WebGL failure rather than displayed during loading.

Reading surfaces are flat, divided by fine rules. Depth comes from the lit sculpture and faint concentric hero rings rather than raised cards.

## Shapes
Content panels have square edges. Buttons use a 3px radius; the fixed motion control uses 20px. The eagle silhouette and hero circles supply organic forms.

## Components
Buttons have a 52px minimum height, with 17px 22px desktop padding. Blue buttons darken to #1010ac on hover; white buttons on blue turn #d6fff5. Links, buttons and summaries use a 3px mint focus outline offset by 6px.

FAQs become native disclosures through src/main.js. Contact links open email to hello@wedgetail.tech. Eagle positions derive from the actual content gutters and model bounds. The eagle crosses above the reading area when changing sides. On phones it occupies reserved space below section copy and leaves the viewport during long reading passages. Pause freezes the current animation; reduced motion presents a calm idle sculpture in the hero. A static preview appears only if the model fails to load or WebGL is unavailable. Animation stops while the document is hidden.

The fixed homepage navigation uses a subtle translucent blue surface over blue sections and a translucent white surface with dark ink logo and links over light sections. Backdrop blur softens the content beneath it; unsupported browsers receive a more opaque surface. The header becomes more compact after scrolling. Exact effects and state values live in the design sidecar.

The eagle reference editor reuses the existing type, palette, flat surfaces, fine rules and control radius. Its dense controls use a 38px minimum button height on desktop and 42px on phones, with a 44px primary export action and a mint focus outline offset by 3px. The preview retains the homepage eagle's glossy white material and lighting.

Desktop section poses are reached at the fixed-header anchor offset and held through the reading portion of each section. The final 30% of a section's scroll interval (capped at 22% of the viewport height) blends into the next pose. The final pose is reachable at the bottom of the page. Playground references are local to the browser used to edit them; use Copy settings for a current unsaved pose, and View saved settings only for saved references.

## Do's and Don'ts
- Do preserve the original locally bundled assets sourced from https://wedgetail.tech/assets/logo-mark.svg and https://wedgetail.tech/assets/wordmark.svg.
- Do reserve space for the eagle around readable content.
- Do retain visible keyboard focus and motion controls.
- Don't replace the established palette with the draft's visual styling.
