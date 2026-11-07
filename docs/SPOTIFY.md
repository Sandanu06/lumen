# Spotify

Lumen shows and controls Spotify. This page covers connecting it, how playback works, and the limits of what a TV can do.

## Contents
[What you need](#what-you-need) · [Connect it](#connect-it) · [Using it](#using-it) · [How playback works](#how-playback-works) · [Why music stops when you go Home](#why-music-stops-when-you-go-home) · [Keeping music playing](#keeping-music-playing-while-you-use-lumen) · [Permissions](#permissions-requested) · [Troubleshooting](#troubleshooting)

## What you need

* **Spotify Premium.** Spotify only allows remote playback control for Premium accounts.
* A free Spotify developer app (two minutes, below). It is *your* app, so your usage counts against your own limits only.
* The Spotify app installed on the TV (it is on the LG Content Store).

## Connect it

1. Go to https://developer.spotify.com/dashboard and **Create app**.
   * *Redirect URI*: `http://127.0.0.1:8888/callback` (exactly this)
   * *APIs used*: **Web API**
2. Copy the app's **Client ID**. You do **not** need the Client Secret: Lumen uses the PKCE flow, which is designed for apps that cannot keep a secret.
3. On your computer:
   ```bash
   npm run spotify -- <your Client ID>
   ```
   A browser opens. Approve the permissions. The terminal prints *Connected*.
4. Install again so the token is baked into the app:
   ```bash
   npm run deploy
   ```

The token is stored in `app/spotify.js`, which is git-ignored. To disconnect, delete that file (or revoke access at https://www.spotify.com/account/apps) and deploy again.

## Using it

* **Start music**: press a playlist, **Liked Songs**, or **Resume**. The TV opens its Spotify app and plays (about 10 seconds from a cold start).
* **Monitor**: while something plays, a pill in the header shows title and artist, the Home and Spotify tabs show the player card with cover, progress, play/pause, previous, next, shuffle, repeat and a heart to save to Liked Songs, and the clock screen shows what is playing.
* **Play on…** lists your Spotify devices (phone, computer, speakers). Choosing one moves playback there.
* **Resume** keeps your last song, position and cover. After you leave Spotify, the card shows *Stopped · 3 min ago* with a frozen progress bar, and **Resume in Spotify** continues from the same second. If another device is available there is also **Play on &lt;device&gt;**.

## How playback works

```
 you press a playlist
        │
        ▼
 Lumen app ──luna──► Lumen service (on the TV)
                          │ 1. opens the TV's Spotify app (brings it to the front)
                          │ 2. waits until the TV shows up as a Spotify device
                          │ 3. PUT /v1/me/player/play  (your playlist)
                          ▼
              Spotify app on the TV plays the music
```

The service does this work because Lumen itself is sent to the background the moment Spotify opens. A newer **play** request replaces an older one still waiting; a **pause / next / previous** that arrives while Spotify is still opening gets a clear "still opening" reply instead of silently cancelling playback.

## Why music stops when you go Home

This is the part people ask about most, so here is the evidence rather than a shrug.

**1. The TV closes its Spotify app the instant you leave it.** With music playing on the TV's Spotify app, switching to any other app (Lumen, or the stock launcher with the redirect off) made the TV disappear from Spotify's device list within about one second. Pressing Resume has to start the app again. This is how webOS treats apps on this TV, not something Lumen can change.

**2. Playing inside Lumen is not possible on this TV.** Spotify offers a Web Playback SDK that would let Lumen itself be the speaker (and keep playing while you browse). Lumen was tested with it. Spotify's player registers and the DRM handshake succeeds, but then Spotify's own player code fails:

```
TypeError: Failed to execute 'fetch' on 'Window': member signal is not of type AbortSignal.
LicenseError: License URL endpoint responded with invalid response
playback_error: Playback error
```

Spotify's code assumes a newer browser than the TV's Chrome 79. The code runs inside a cross-origin frame served by Spotify, so an app cannot patch it. The symptom is nasty: Spotify's server clock keeps counting, so the progress bar moves and the song looks like it is playing, but there is no sound after the first moments. Because of that, **Lumen never loads the embedded player on a TV**: it always uses the TV's native Spotify app.

## Keeping music playing while you use Lumen

Music keeps playing behind Lumen if the *speaker is another device*:

* **Your phone or computer** running Spotify: pick it in **Play on…** (or press **Play on Mac**), and Lumen becomes the remote and display.
* **An always-on Spotify Connect device** is the best answer: for example a Raspberry Pi running [Raspotify](https://github.com/dtcooper/raspotify) connected to your Bluetooth speaker. It appears in **Play on…** like any other device and does not depend on the TV at all.

## Permissions requested

| Scope | Why |
|---|---|
| `user-read-playback-state`, `user-read-currently-playing` | Show what is playing, on which device |
| `user-modify-playback-state` | Play, pause, skip, shuffle, repeat, move playback between devices |
| `playlist-read-private`, `playlist-read-collaborative` | Show your playlists |
| `user-library-read`, `user-library-modify` | Show and toggle the heart (Liked Songs) |
| `streaming`, `user-read-email`, `user-read-private` | Requested for the (disabled on TVs) embedded player |

## Troubleshooting

| Symptom | Fix |
|---|---|
| The Spotify tab says **Connect Spotify** | Run `npm run spotify -- <Client ID>` then `npm run deploy` |
| It says **Reconnect Spotify** | The token expired or access was revoked. Run `npm run spotify -- <Client ID>` again, then deploy |
| "Spotify Premium is needed" | Playback control requires Premium |
| Nothing plays after pressing a playlist | Wait ~10 s for the Spotify app to open. Make sure it is installed on the TV and you are signed in to the same account |
| Music stops when I press Home | Expected on the TV, see [above](#why-music-stops-when-you-go-home). Use Resume, or play on another device |
| The heart does nothing | Rerun `npm run spotify` to grant library access |
| Rate limited | Spotify answered 429; Lumen backs off by the delay Spotify gave |
