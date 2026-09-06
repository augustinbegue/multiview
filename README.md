# Multiview

A Twitch multi-stream dashboard laid out like a broadcast control room: one program
view with the channel's chat beside it, and every other source running live in a
thumbnail strip below, each with a tally-style label bar.

Live at <https://multiview.keepalive.studio>.

## Usage

1. Open the app. If no channels are configured, the setup screen asks for a Twitch
   channel per slot (2 to 9 slots, 4 by default). Add or remove slots as needed.
2. Slot 1 goes on program. Click any source in the strip, or press its number key
   (`1`–`9`), to switch it to program. Slot numbers stay fixed per channel.
3. The program source plays with audio; everything else stays muted. "audio on /
   audio off" in the top bar mutes every source at once.
4. The gear button reopens the setup form to change channels.

Switching never remounts a player: all sources stay mounted and only move in the
CSS grid, so streams keep playing without reloading. Only the chat pane reloads.

## ZEVENT mode

`/zevent` is a self-configuring variant: it pulls <https://zevent.fr/api/>, keeps the
streamers that are `online`, sorts them by viewer count and puts the top 9 on the
grid. There is no setup screen and `?c=` is ignored.

- **refresh channels** in the top bar re-fetches the list. If the ordering is
  unchanged the button flashes "up to date"; otherwise the stage is rebuilt.
  A "last updated HH:MM:SS" stamp sits next to the button.
- Tile labels show the channel name plus its current viewer count.
- If zevent.fr can't be reached the top bar shows "zevent.fr unreachable" and the
  current stage is kept.
- State (program slot, mute) persists under `multiview.zevent.v1`, separate from the
  manual configuration, and `c=` is never written to the URL in this mode.
- "manual" in the top bar goes back to `/`; the setup screen links to `/zevent`.

The API sends no CORS header, so it is proxied same-origin at `/api/zevent` — by
`vite.config.ts` `server.proxy` in dev and by nginx in the image (with a 20 s
`proxy_cache` so refresh-spam doesn't hammer zevent.fr).

## URL parameters

The current setup is written to the URL, so a link is shareable and bookmarkable.
A URL with `?c=` wins over anything stored locally and skips the setup screen.

| Param  | Meaning                                            | Example          |
| ------ | -------------------------------------------------- | ---------------- |
| `c`    | Comma-separated channels, in slot order            | `?c=zerator,gotaga,squeezie` |
| `m`    | Slot number on program (1-based, defaults to 1)    | `&m=2`           |
| `mute` | `1` to start with all audio muted                  | `&mute=1`        |

State also persists to `localStorage` under `multiview.state.v1`.

## Pages, languages and SEO

The build is multi-page: four static HTML entries share one app bundle, each with its
own `<head>`, crawlable landing copy (h1, how-to, FAQ) and JSON-LD.

| URL          | Language | Entry file        | JSON-LD                                          |
| ------------ | -------- | ----------------- | ------------------------------------------------ |
| `/`          | en       | `index.html`      | WebApplication, WebSite, Person, WebPage, FAQPage |
| `/fr/`       | fr       | `fr/index.html`   | same, in French                                  |
| `/zevent`    | en       | `zevent.html`     | WebPage, BreadcrumbList, Event (ZEvent 2026), FAQPage |
| `/fr/zevent` | fr       | `fr/zevent.html`  | same, in French                                  |

- `pages/` holds the shared partials: `head.html` (title, description, canonical,
  hreflang en/fr/x-default, Open Graph, Twitter card, icons), `app.html` (the app
  markup) and `about-<lang>[-zevent].html` (the landing copy rendered under the app).
  `pages/strings.json` carries every static UI string and per-page metadata.
- `vite.config.ts` expands `<!--#include name-->` and `{{key}}` at build time and in
  dev, and rewrites the pretty URLs to the entry files on the dev server.
- Dynamic UI strings come from `src/i18n.ts`, keyed on `<html lang>`. The EN/FR
  button keeps the current `?c=` line-up.
- Multitwitch-style paths work as an alias of `?c=`: `/zerator/gotaga` and
  `/fr/zerator/gotaga`. They are normalised back to `?c=` so canonical stays `/`.
- `public/` ships `robots.txt` (everything allowed except `/api/`), `sitemap.xml` with
  hreflang alternates, `llms.txt`, `manifest.webmanifest`, `humans.txt`, the OG images
  (`og-*.png`, 1200x630), icons and the IndexNow key file.
- `scripts/indexnow.sh` pings IndexNow (Bing, Yandex, Naver, Seznam) for the four URLs
  after a deploy. Google ignores IndexNow: submit `sitemap.xml` in Search Console.
- nginx serves `/zevent` → `zevent.html`, redirects `*.html` and trailing-slash
  variants to the canonical URL (301), sets `Content-Language`, and marks `/api/zevent`
  `noindex`.

The ZEvent pages are labelled as an unofficial fan tool, use no ZEvent logo and send
donations to zevent.fr only.

## Development

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc strict + vite build into dist/
```

Twitch embeds require a `parent` domain that matches the page host. The app passes
`window.location.hostname`, so `localhost` and the deployed domain both work — but
an embed opened from a `file://` page or an unexpected host will be refused by Twitch.

## Docker

```sh
docker build -t multiview .
docker run --rm -p 8080:8080 multiview   # http://localhost:8080
```

The image serves the static build with unprivileged nginx on port 8080. Hashed
assets under `/assets/` get a one-year immutable cache; HTML is never cached.
Pushes to `main` publish `ghcr.io/augustinbegue/multiview`.
