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

- `index.html` — page markup (hero, marquee strip, reviews, pricing, comparison table, FAQ, download CTA, footer)
- `styles.css` — design system (black canvas, flame accent, panel cards)
- `faulty-terminal.js` — WebGL2 CRT terminal-digit hero background (vanilla port of the
  FaultyTerminal React component; flame phosphor tint, mouse glow, scanlines, click glitches)
- `bounce-cards.js` — fanned review-card deck (vanilla port of the BounceCards React
  component; staggered pop-in, hover spread, click bounce)
- `script.js` — Discord login, FAQ accordion, mobile nav, scroll reveal
- `favicon.svg` — logo mark

## Discord login

The nav "Log in" button runs Discord OAuth2 (implicit grant, `identify` scope) entirely
client-side — no backend, no secret. The token lives in `sessionStorage` only.

To enable it:

1. Create an application at <https://discord.com/developers/applications>.
2. Under **OAuth2 → Redirects**, add this site's URL(s), e.g. `http://localhost:8080/`
   and your production URL.
3. Paste the application's **Client ID** into `DISCORD_CLIENT_ID` at the top of `script.js`.

After sign-in, the button shows the user's avatar + display name; clicking it logs out.

## Developer panel & bans

Open with **Ctrl+Shift+D** (or append `#dev` to the URL). Access is tied to
**specific Discord accounts**: sign in with an account whose ID is in the
`DEVELOPER_IDS` list — everyone else sees a "not a developer" notice.

- **Ban** a Discord user by ID (with optional reason), **unban**, or ban the
  currently logged-in user with one click
- **Export** the ban list as JSON; paste it into `HARDCODED_BANNED_IDS` in
  `script.js` to ship a permanent, site-wide ban
- **Import** a JSON array of IDs on another machine
- Banned users who sign in with Discord get a full-screen restriction notice
  and are logged out automatically

> Client-side enforcement only: a static site can't truly prevent a
> determined user. For real enforcement, mirror the ban list in the desktop
> app's backend when it ships.

## Deploy on Vercel (recommended)

The site reads its Discord config at runtime from `/api/config`, a Vercel
serverless function in `api/config.js`, so there's no build step.

1. Import the repo in Vercel (zero config — static files + `api/` are picked up).
2. **Project → Settings → Environment Variables**, add:
   - `DISCORD_CLIENT_ID` — your Discord application's client ID
   - `DEVELOPER_IDS` — comma-separated Discord user IDs, e.g.
     `123456789012345678,987654321098765432`
3. In the Discord developer portal (**OAuth2 → Redirects**), add the Vercel
   URL (e.g. `https://atlas-radio.vercel.app/`) plus `http://localhost:8080/`
   for local work.

Local development: copy `.env.example` → `.env`, fill it in, and run
`vercel dev` (env vars from `.env` are injected into `/api/config`). A plain
static server also works — `script.js` then falls back to the hardcoded
`FALLBACK_CLIENT_ID` / `FALLBACK_DEVELOPER_IDS` at the top of the file.

GitHub Pages (or any host without functions) also works with those fallbacks —
Vercel is recommended so the values live in env vars instead of the repo.

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
