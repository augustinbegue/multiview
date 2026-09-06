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

## URL parameters

The current setup is written to the URL, so a link is shareable and bookmarkable.
A URL with `?c=` wins over anything stored locally and skips the setup screen.

| Param  | Meaning                                            | Example          |
| ------ | -------------------------------------------------- | ---------------- |
| `c`    | Comma-separated channels, in slot order            | `?c=zerator,gotaga,squeezie` |
| `m`    | Slot number on program (1-based, defaults to 1)    | `&m=2`           |
| `mute` | `1` to start with all audio muted                  | `&mute=1`        |

State also persists to `localStorage` under `multiview.state.v1`.

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
assets under `/assets/` get a one-year immutable cache; `index.html` is never cached.
Pushes to `main` publish `ghcr.io/augustinbegue/multiview`.
