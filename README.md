# Atlas

**Atlas** — a free desktop voice app for ER:LC roleplay; a replacement for Discord VCs.
You download it, not visit it. This repo holds the landing page (animated Gradient Blinds
hero, features, comparison, FAQ, download CTA) plus, over time, the app itself.

## Landing page

Static site — no build step, no dependencies.

```bash
# any static file server works, e.g.
npx serve .
# or
python -m http.server 8080
```

Then open http://localhost:8080 (or http://localhost:3000 for `serve`).

### Structure

- `index.html` — page markup (hero, marquee strip, features, comparison table, FAQ, download CTA, footer)
- `styles.css` — design system (black canvas, flame accent, panel cards)
- `gradient-blinds.js` — WebGL2 animated blind-slat hero background (vanilla port of the
  GradientBlinds React component; flame palette, mouse spotlight, sway, click ripples)
- `script.js` — FAQ accordion, mobile nav, scroll reveal
- `favicon.svg` — logo mark

## Releases

The app installer ships from [GitHub Releases](https://github.com/whoisbrzy/Atlas-Radio/releases).
The landing page's download buttons link there.

## Design

- Primary reference: [chirper.app](https://chirper.app) — black-canvas token system,
  flame (`#FF4A1C`) accent with ink button text, panel cards with inset top highlight,
  Geist type, trusted-by marquee, fade-up motion. Close in feel, not a clone: Atlas keeps
  its own name, logo mark, copy, and section set.
- Secondary reference: [melonly.com](https://melonly.com) (ER:LC landing-page rhythm).
- Hero typography: **Pacifico** script accent (via Google Fonts) over the **Geist** sans,
  with SF Pro first in the stack so Apple devices render SF Pro.
- Positioning: a free desktop voice app for ER:LC roleplay communities. Not affiliated
  with PRC, ER:LC, or Roblox Corporation.

## Deploy

Push to GitHub and enable GitHub Pages (root), or drop the folder into Vercel/Netlify —
no configuration needed.
