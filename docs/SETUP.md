# Setup guide

From a fresh clone to Lumen running on your TV. About ten minutes, once.

## Contents
[Compatibility](#compatibility) · [What you need](#what-you-need) · [1. Developer Mode](#1-turn-on-developer-mode-on-the-tv) · [2. Run setup](#2-run-the-setup) · [3. Install](#3-install-lumen) · [4. Spotify](#4-optional-connect-spotify) · [Updating](#updating) · [Uninstalling](#uninstalling) · [What setup did](#what-setup-created)

## Compatibility

| | |
|---|---|
| **Tested on** | LG 55UP7550PTC (2021, webOS 6, Chrome 79) |
| **Should work on** | webOS 6 and newer. The code only uses features Chrome 79 supports, and the linter enforces it. |
| **Unknown** | webOS 4 and 5 (Chrome 53 and 68). They may lack CSS grid features or ES2018 syntax Lumen uses. Reports welcome. |
| **Not supported** | Non-webOS TVs, and LG TVs that block Developer Mode |
| **Your computer** | macOS, Linux or Windows with Node 18+ and `ssh`. Python 3 with Pillow is optional (card artwork). |

## What you need

* The TV and your computer on the **same network**
* The TV's **IP address**: Settings → Network → (your connection). Give it a fixed address or a DHCP reservation in your router so it does not change.
* **Node.js 18 or newer** (`node -v`)
* A free **LG developer account** (https://webostv.developer.lge.com)
* Optional: Python 3 with `pip install pillow` for the per-app card artwork

## 1. Turn on Developer Mode on the TV

You only do this once.

1. On the TV open the **LG Content Store** and install **Developer Mode**.
2. Open it and sign in with your LG developer account.
3. Switch **Dev Mode Status** to **ON**. The TV restarts.
4. Open Developer Mode again. It now shows a **passphrase** (six characters) and a **Key Server** switch.
5. Switch **Key Server** to **ON** and **leave the app open** until setup has finished.

> Developer Mode sessions last about 50 hours. Lumen renews its own while the TV is used. If the TV sits unused for days the session can still lapse; open the Developer Mode app and press **Extend Session**.

## 2. Run the setup

```bash
git clone https://github.com/Sandanu06/lumen.git
cd lumen
npm install
npm run setup -- --ip 192.168.1.50 --passphrase A1B2C3
```

Replace the address and the passphrase with yours. Setup runs four steps and tells you what it is doing:

1. **Reaches the TV.** Checks the control port (3000) and the Developer Mode port (9922).
2. **Developer key.** Downloads the SSH key from the Key Server, removes its passphrase so later deploys do not prompt, and registers the TV with `ares-cli` under the name `lgtv`.
3. **Pairs.** A prompt appears on the TV: press **OK** or **Yes**. The key is saved in `.lgtv-key`.
4. **Writes your private configuration** (`app/session.js`), generates the pairing manifest, and reads the list of installed apps and their icons (`npm run sync`), then draws the card artwork (`npm run art`).

Setup is **idempotent**: run it again any time (for example after installing new apps on the TV) and it skips what is already done.

If something fails, the message says what to do. Common ones are in [Troubleshooting](TROUBLESHOOTING.md).

## 3. Install Lumen

```bash
npm run deploy
```

This builds `dist/<id>_<version>_all.ipk`, installs it on the TV and opens it. The first launch plays the logo intro. From now on:

* Lumen opens like any app, and the **Home** button returns to it.
* You can turn your computer off. Nothing runs on it.

## 4. Optional: connect Spotify

See [SPOTIFY.md](SPOTIFY.md). Short version: create a free Spotify app, run `npm run spotify -- <Client ID>`, then `npm run deploy` again.

## Updating

```bash
git pull
npm install
npm run deploy
```

Your settings (favourites, name, usage) live in the TV's local storage and survive updates.

To refresh the list of apps after installing or removing apps on the TV: `npm run sync && npm run art && npm run deploy`.

## Uninstalling

```bash
npx ares-install -d lgtv --remove com.sandman.home
```

This removes Lumen and its service. To delete the registered TV from `ares-cli`: `npx ares-setup-device --remove lgtv`. Remove `~/.ssh/webos_rsa` if you no longer want the developer key.

## What setup created

| File | Contains | Committed? |
|---|---|---|
| `.lumen.json` | The TV's IP address | No |
| `.lgtv-key` | The TV control API pairing key | **Never** |
| `app/session.js` | Developer Mode session token and the control key, baked into the app | **Never** |
| `service/tv.json` | The control key for the on-TV service (written at build time) | **Never** |
| `app/spotify.js` | Your Spotify client ID and refresh token (only after `npm run spotify`) | **Never** |
| `app/apps.js`, `app/icons/`, `app/art/` | Your installed apps and generated artwork | No (generated) |
| `~/.ssh/webos_rsa` | The Developer Mode SSH key (outside the repo) | n/a |

`npm run lint` fails if any private file is ever tracked by git.

## Next

[Features and settings](FEATURES.md) · [Troubleshooting](TROUBLESHOOTING.md)
