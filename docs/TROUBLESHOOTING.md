# Troubleshooting

Find your symptom, try the fix. If it is not here, open an [issue](https://github.com/Sandanu06/lumen/issues/new/choose) with your TV model and webOS version.

## Contents
[Setup](#setup) · [Install and updates](#install-and-updates) · [Home button](#home-button) · [Spotify](#spotify) · [Bluetooth and sound](#bluetooth-and-sound) · [Display and performance](#display-and-performance) · [Data](#data-and-settings) · [Useful commands](#useful-commands)

## Setup

**`Cannot reach <ip>:3000`**
The TV is off, on another network, or the address is wrong. Check Settings → Network on the TV. Give it a fixed address or a DHCP reservation. Some routers isolate Wi-Fi from wired devices; put both on the same network.

**`Developer Mode SSH (port 9922) is closed`**
Developer Mode is not on. In the Developer Mode app switch **Dev Mode Status** ON, let the TV restart, open the app again. If the session expired, press **Extend Session**.

**`Key Server (port 9991) is closed`**
Open the Developer Mode app and switch **Key Server** ON. It must stay open while setup runs.

**`The passphrase was rejected`**
Use the code shown *now* in the Developer Mode app; it changes. You can also run setup without `--passphrase`: the key is saved encrypted and deploys will ask for the code each time.

**Pairing never completes**
The prompt appears on the TV for about a minute: press OK or Yes. If it does not appear, make sure the TV is on and not in a menu. To start clean: delete `.lgtv-key` and run `npm run setup -- --ip <TV>` again.

**Setup says it could not read the Developer Mode session token**
Your SSH key probably still has its passphrase, so `ssh` could not use it non-interactively. Run `ssh-keygen -p -f ~/.ssh/webos_rsa` and enter the passphrase, then an empty new one; or rerun setup with `--passphrase`.

## Install and updates

**`ares-install` fails, or "connection refused"**
The Developer Mode session expired (about 50 hours without use). Open the Developer Mode app and **Extend Session**, then deploy again.

**The app looks old after deploying**
Close Lumen and reopen it. Make sure `npm run deploy` printed *Success* twice (install, launch).

**`ares-package` or `npm run build` fails**
Run `npm run check` first; it points to syntax errors or Chrome 79 incompatibilities. On a fresh clone use `npm install` before building.

**I removed Lumen but the TV still shows it**
Remove with `npx ares-install -d lgtv --remove com.sandman.home`.

## Home button

**Pressing Home goes to the LG launcher, not Lumen**
The service starts when Lumen opens, so open Lumen once. Check Settings → Home button says *Return to dashboard*. Remember that pressing Home **twice within 6 seconds** deliberately reaches the LG launcher, and that the header's Exit button pauses the redirect for 90 seconds.

**I cannot get to the LG launcher**
Press Home twice quickly, use the Exit icon in the header, or set Settings → Home button to *Show LG launcher*.

**Check the service**
```js
// in ares-inspect's console
new Promise(ok => { const b = new PalmServiceBridge(); b.onservicecallback = m => ok(JSON.parse(m)); b.call('luna://com.sandman.home.service/status', '{}') })
```
`connected: true` means it is watching. `events` lists what it did.

## Spotify

**The Spotify tab says "Connect Spotify" or "Reconnect Spotify"**
`npm run spotify -- <Client ID>` then `npm run deploy`. See [SPOTIFY.md](SPOTIFY.md).

**Pressing a playlist opens Spotify and nothing plays**
Wait about 10 seconds. The TV's Spotify app must be installed and signed in to the same account as the token. Spotify Premium is required.

**Music stops when I press Home**
Expected on the TV: webOS closes the Spotify app when you leave it, and Spotify's embedded player cannot run on Chrome 79. Use **Resume**, or play on another device. Full explanation with evidence: [SPOTIFY.md](SPOTIFY.md#why-music-stops-when-you-go-home).

**The progress bar moves but there is no sound**
That is the signature of the embedded Spotify player, which Lumen deliberately never loads on a TV. If you see it, you are probably running a modified build. Check that `spUsesNative()` in `app/app.js` returns true on the TV.

**The heart does nothing / "Run npm run spotify again"**
Rerun `npm run spotify -- <Client ID>` to grant library access.

## Bluetooth and sound

**The sound chip says "TV speakers" but my speaker is on**
Open the chip → **Connect** next to your speaker. Put the speaker in pairing mode and use **Search** the first time.

**Connecting fails**
The TV tries for about 30 seconds. Check the speaker is on, close, and not connected to your phone. Lumen shows the TV's own error.

**It keeps reconnecting when I want TV speakers**
Choose **Use TV speakers** in the Sound output panel; that turns automatic reconnect off.

**Interface sounds are too loud or annoying**
Settings → Interface sounds → Off. They follow the TV volume.

## Display and performance

**Animations stutter**
Settings → Live background → Off removes the drift, mist and lights. With a video app running in the background the TV may also be short of memory; closing other apps helps.

**The wallpaper does not change with the time of day**
Auto mode needs weather data for your sunrise and sunset. Set **City for weather** in Settings, or check the TV has internet. Until then it assumes 6:00 and 18:00.

**Weather shows "--"**
No internet, or the city was not found. Set a city name in Settings.

**Cards show the name but no icon**
The icon files come from `npm run sync`. Run `npm run sync && npm run art && npm run deploy`.

**The clock screen appears too soon or never**
Settings → Clock screen after.

## Data and settings

**Stats are empty**
They fill in as you open apps from Lumen. Apps opened with the LG remote's shortcut buttons are not counted.

**The app list is out of date**
After installing or removing TV apps: `npm run sync && npm run art && npm run deploy`.

**Reset everything**
Settings → Usage history → Clear removes stats. To reset all settings, clear the app's local storage in `ares-inspect` (`localStorage.clear()`), or uninstall and reinstall.

## Useful commands

```bash
npm run check                      # lint + tests
npx ares-device -d lgtv -i         # TV model and webOS version
npx ares-install -d lgtv --list    # installed apps
npx ares-inspect -d lgtv --app com.sandman.home   # DevTools on the TV
```
