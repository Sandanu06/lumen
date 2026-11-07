# Features and settings

Everything Lumen does, screen by screen. Screenshots are in the [README](../README.md#screenshots).

## The header

| Item | What it does |
|---|---|
| **Logo** | Lumen. |
| **Now-playing pill** | Appears when Spotify is playing: cover, "title · artist" and animated equaliser bars. Press OK to open the Spotify tab. |
| **Sound chip** | Shows where sound goes: *TV speakers*, or your Bluetooth speaker with a green dot when it is playing (amber while connecting). Opens [Sound output](#sound-output). |
| **Sliders icon** | Opens [TV controls](#tv-controls). |
| **Exit icon** | Opens the stock LG launcher (it pauses the Home-button redirect for 90 s so the TV can get there). |
| **Your name** | Opens [Settings](#settings). |

## Search and chips

Type in the search box (the TV's on-screen keyboard opens) and press **Search**. The query opens in the TV's web browser on **YouTube** or **Google** (Settings → Search with). The chips below it are one-press searches.

## The six tabs

Move with ◀ ▶. Focusing a tab previews it; changing tabs slides the cards in from the direction you are moving.

### Home
Your first three favourites, then either the **Spotify player** (when something is playing) or the **Continue** card (the app you opened last, how long ago, how many times, with *Open*, *Open &lt;previous app&gt; instead* and *Remove*).

### Smart TV
Every app on the TV as a card in its own brand colour. Hold **OK** to add or remove a favourite. The list comes from `npm run sync`.

### Inputs
**Live TV** plus every external input the TV reports, with a green *Signal* badge on inputs that have a device connected. OK switches to it.

### Spotify
The player card, **Play on…** (device switcher), **Liked Songs** and your playlists (up to 50). See [SPOTIFY.md](SPOTIFY.md).

### Favorites
The apps you favourited. Empty until you hold OK on an app.

### Stats
Four cards, all computed on the TV from your own use:

* **This week**: opens in the last 7 days with a bar per day (today highlighted).
* **Most opened**: your top apps with bars in their brand colour.
* **When you watch**: opens by time of day, naming your peak ("Mostly evenings").
* **This TV**: model, screen, webOS build, sound output, Spotify state, number of apps.

## Sound output

Bluetooth speaker control, from the header chip.

* **Paired speakers** are listed with *Connect* / *Disconnect*. Connecting also switches the TV's sound to the speaker.
* **Search** scans for speakers in pairing mode; press **Pair** on the one you want (put it in pairing mode first).
* **Use TV speakers** switches back and stops automatic reconnecting.
* Lumen **remembers your speaker** and reconnects it automatically when it is available, and re-selects it as the output if the TV resets it.
* If a connection fails the TV keeps trying for about 30 seconds; the panel says so.

## TV controls

* **Volume**: ◀ ▶ change it by 2 while the bar is highlighted.
* **Sound**: mute / unmute.
* **Screen**: turns the screen off; press a button on the remote to wake it.
* **Power**: turn the TV off.

## The live background

* **Wallpaper by time of day**: dawn, day, dusk, night, chosen from your local sunrise and sunset (via your weather location). Crossfades over 2.6 s. Pin one in Settings → Wallpaper.
* **Motion**: a slow camera drift, a band of mist across the lake and 22 soft floating lights. Settings → Live background → Off makes it still.
* All motion uses `transform` and `opacity` only: it stays near 60 fps on the TV's GPU.

## The clock screen

After the idle time you choose (Settings → Clock screen after: Off, 1, 2 or 5 minutes) the interface fades to a large clock, the date, the weather and what is playing, over the live wallpaper. The first key press only wakes it.

## Sounds

Optional (Settings → Interface sounds). Synthesised with Web Audio, so there are no audio files: each tab plays its own note, opening an app plays a three-note chime, panels sweep open and closed. They are quiet and follow the TV volume.

## Settings

| Setting | Choices |
|---|---|
| Name | Used in the greeting and the header |
| City for weather | A city name, or empty for automatic (from your network) |
| Clock | 12-hour / 24-hour |
| Temperature | Celsius / Fahrenheit |
| Wallpaper | Auto, Dawn, Day, Dusk, Night |
| Interface sounds | On / Off |
| Live background | On / Off |
| Clock screen after | Off, 1, 2, 5 minutes |
| Home button | *Return to dashboard* or *Show LG launcher* |
| Search with | YouTube / Google |
| Developer session | Shows when Lumen last renewed its Developer Mode session |
| Usage history | Clear |

## Remote control reference

| Key | In Lumen |
|---|---|
| ◀ ▶ ▲ ▼ | Move focus (nearest neighbour). From the shelf, ▲ goes to the current tab; from a tab, ▼ returns to the last card. |
| OK | Activate. On an app card: open. **Hold** for 0.65 s to favourite or unfavourite. |
| Back | Closes a panel; from another tab returns to Home; on Home leaves Lumen. |
| Home (LG) | Returns to Lumen via the on-TV service. Twice within 6 s: stock launcher. |
| Play, Pause | Toggle Spotify when something is playing |
| FF / REW | Next / previous track |
| Magic Remote | Pointer hover moves focus, click activates. A still pointer never steals focus. |
| Colour buttons, numbers | Not used |

## The Home-button service

A small Node service installed with the app (`service/`). It starts when Lumen opens and:

1. Watches the foreground app through the TV's local control API.
2. When the stock LG launcher appears it reopens Lumen (with a short retry, because the TV can re-raise the launcher).
3. If you press Home **twice within 6 seconds** it stands down for two minutes so you can reach the real launcher.
4. Starts and controls Spotify on the TV on request (see [SPOTIFY.md](SPOTIFY.md)).

Turn the redirect off any time in Settings → Home button.
