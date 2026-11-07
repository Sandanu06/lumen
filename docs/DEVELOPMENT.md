# Development

## Contents
[Prerequisites](#prerequisites) · [Scripts](#scripts) · [Edit, deploy, look](#edit-deploy-look) · [Debugging on the TV](#debugging-on-the-tv) · [Tests](#tests) · [CI](#continuous-integration) · [Regenerating assets](#regenerating-assets) · [Regenerating the docs media](#regenerating-the-docs-media) · [Recipes](#recipes)

## Prerequisites

Node 18+, a TV set up with `npm run setup` (see [SETUP.md](SETUP.md)). Python 3 + Pillow only for artwork and media (`pip install pillow`). No TV is needed to run `npm run check` and `npm run build`.

## Scripts

| Command | What it does |
|---|---|
| `npm run setup -- --ip <TV>` | One-time TV setup. Idempotent. |
| `npm run build` | Writes `dist/<id>_<version>_all.ipk`. Works with no TV: missing per-user files become harmless empties. |
| `npm run deploy` | Build, install on the TV (`lgtv`), launch. |
| `npm run sync` | Re-read the TV's apps and icons into `app/apps.js` and `app/icons/`. |
| `npm run art` | Redraw card artwork (`app/art/`). Run after `sync`. |
| `npm run wallpapers` | Rebuild the four scenes from `tools/src-wallpapers`. |
| `npm run icons` | Redraw the launcher icon, large icon and launch splash. |
| `npm run spotify -- <Client ID>` | Spotify sign-in (PKCE) → `app/spotify.js`. |
| `npm run lint` | Syntax of every JS file, Chrome 79 rules for `app/`, no tracked secrets. |
| `npm test` | The test suite. |
| `npm run check` | `lint` then `test` (what CI runs). |
| `npm run docs:media` | Capture screenshots and the demo from a real TV. |

## Edit, deploy, look

```bash
# edit app/app.js, app/style.css, app/index.html
npm run check && npm run deploy
```

Deploy takes about 10 seconds. The app reopens on the TV. There is no hot reload; the loop is quick enough not to need one.

## Debugging on the TV

Chrome DevTools works against the app on the TV:

```bash
npx ares-inspect -d lgtv --app com.sandman.home
```

It prints a `http://localhost:<port>/devtools/inspector.html?ws=…` URL. Open it in Chrome for the Elements, Console and Network panels, running on the TV.

Handy console one-liners:

```js
// what the app believes
JSON.parse(localStorage.getItem('home.v1'))

// is the service alive, and what has it done?
new Promise(ok => { const b = new PalmServiceBridge(); b.onservicecallback = m => ok(JSON.parse(m)); b.call('luna://com.sandman.home.service/status', '{}') })

// frame rate for 3 seconds
new Promise(ok => { let n = 0, t = performance.now(); (function f() { n++; performance.now() - t < 3000 ? requestAnimationFrame(f) : ok(Math.round(n / 3)) })() })
```

Foreground app from your computer:

```bash
node -e "const tv=require('lgtv2')({url:'ws://<TV IP>:3000',keyFile:'.lgtv-key',reconnect:false});tv.on('connect',()=>tv.request('ssap://com.webos.applicationManager/getForegroundAppInfo',(e,r)=>{console.log(r.appId);process.exit()}))"
```

## Tests

`tests/*.test.js` use Node's built-in runner. The app and the service are plain scripts, so the tests slice the relevant section out of the source and run it in a `vm` sandbox with stubbed globals (no browser, no TV). They cover Spotify request handling (plain-text success replies, rate limits, expired tokens), the Bluetooth connect, retry and preferred-speaker logic, native-playback routing, and the service's control flow (supersede, busy replies, explicit device targeting).

When you change logic, add a test next to the nearest one and keep the section markers (`function spApi(` etc.) stable, because the tests find code by them.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request: `npm ci`, `npm run check`, then `npm run build` and uploads the validation `.ipk` (built with empty keys, for checking only) as an artifact.

## Regenerating assets

| Asset | Source | Command |
|---|---|---|
| Wallpapers | `tools/src-wallpapers/{morning,dolomites}.jpg` | `npm run wallpapers` |
| Card art | `app/apps.js`, `tools/brand.json` | `npm run art` |
| Launcher icon, splash | the mark drawn in `tools/make-icons.py` | `npm run icons` |
| Per-app brand colour overrides | `tools/brand.json` (RGB per app id) | edit, then `npm run sync && npm run art` |

## Regenerating the docs media

With the TV on and Lumen installed:

```bash
npm run docs:media                                              # screenshots + demo frames from the real TV
FFMPEG=/path/to/ffmpeg python3 tools/make-gif.py                # demo.mp4 + demo-hero.gif (ffmpeg optional)
python3 tools/make-banner.py                                    # banner.png (social preview) + scenes.jpg
```

`docs:media` loads a neutral demo profile (name "Alex", sample usage, a fictional track), takes the shots, records the tour, and **restores your real settings** at the end (also on Ctrl-C; a backup is kept in your temp directory).

## Recipes

**Add a tab.** Add a `<button class="f navbtn" data-view="x">` in `index.html`, a title in `TITLES` and `ORDER` and a colour in `TAB_RGB` in `app.js`, then a branch in `render()`. Keep `.navbtn` width and the `#nav` container width in sync in CSS.

**Add a setting.** Add a default to `S` in `app.js`, a `.row` in the settings panel in `index.html`, paint it in `paintPanel()` and bind its click.

**Add an app brand colour.** Put `"app.id": "r,g,b"` in `tools/brand.json`, then `npm run sync && npm run art`.

**Use a different app id.** Change it in `app/appinfo.json`, `service/services.json`, `service/package.json`, `service/service.js` (service name and `HOME`), `SVC` in `app/app.js`, the `HIDE` list in `tools/sync-apps.js`, and the commands in these docs. Changing the id installs a *new* app; remove the old one with `ares-install --remove`.
