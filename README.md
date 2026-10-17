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

## Desktop app

The separate desktop app project is in [`desktop-app/`](desktop-app/README.md).
It has its own code, UI, and assets; it does not import resources from the landing site.

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

The nav "Log in" button uses Discord OAuth2 authorization code + PKCE. Vercel
exchanges the code server-side and stores the Discord token in a signed,
HTTP-only session cookie. The browser never receives the client secret or token.

To enable it:

1. Create an application at <https://discord.com/developers/applications>.
2. In Vercel, set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` under
   **Project → Settings → Environment Variables**. Also set `DEVELOPER_IDS`
   if you use the developer panel. Redeploy after changing environment values.
3. In the Discord developer portal, add the exact callback URL
   `https://YOUR-VERCEL-DOMAIN/auth/callback` under **OAuth2 → Redirects**.
   Add a separate callback URL for each Vercel/custom domain you use.

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
   - `DISCORD_CLIENT_SECRET` — your Discord OAuth2 client secret (server-side only)
   - `DEVELOPER_IDS` — comma-separated Discord user IDs, e.g.
     `123456789012345678,987654321098765432`
   - `BLOCKED_COUNTRIES` (optional) — comma-separated ISO country codes, e.g. `CN,RU`
3. In the Discord developer portal (**OAuth2 → Redirects**), add the exact Vercel
   callback URL (e.g. `https://atlasvc.vercel.app/auth/callback`).

Local development: copy `.env.example` → `.env`, fill it in, and run `vercel dev`.
Add the matching local callback URL (typically `http://localhost:3000/auth/callback`)
to Discord's OAuth2 Redirects. Discord login requires the Vercel functions; a
plain static server serves the landing page but cannot complete sign-in.

The developer page is available at `/developer` to signed-in developer accounts.
Country access is enforced at Vercel's routing middleware using the incoming
`x-vercel-ip-country` header; update `BLOCKED_COUNTRIES` in Vercel and redeploy
to change the shared list.

The Vercel functions are required for Discord sign-in. Other static hosts can
serve the landing page, but will not provide authentication.

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
