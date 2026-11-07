# Changelog

All notable changes. Versions follow [semantic versioning](https://semver.org).

## 1.0.0 - 2026-11-08

First public release.

### Added
- Home screen with six tabs (Home, Smart TV, Inputs, Spotify, Favorites, Stats), spatial D-pad focus, Magic Remote support
- Live wallpaper that follows local sunrise and sunset (dawn, day, dusk, night), with drift, mist and floating lights
- Directional tab transitions, logo intro, idle clock screen, optional synthesised interface sounds
- Bluetooth speaker control: sound chip, connect, disconnect, search, pair, remembered speaker with automatic reconnect
- Spotify: playlists, Liked Songs, now-playing card and header pill, shuffle, repeat, heart, device switcher, resume
- Home-button service that returns to Lumen from the stock launcher (press Home twice for the real launcher)
- TV controls (volume, mute, screen off, power), real HDMI inputs with signal status
- Usage stats computed on the TV
- Weather from Open-Meteo; self-renewing Developer Mode session
- `npm run setup` (one-command TV setup), `build`, `deploy`, `sync`, `lint`, `test`, `docs:media`
- Test suite, CI, documentation

### Known limits
- The TV's Spotify app is closed by webOS when you leave it, and Spotify's embedded player cannot run on Chrome 79, so music cannot keep playing behind Lumen on the TV (see docs/SPOTIFY.md)
- Tested on one TV model (LG 55UP7550PTC, webOS 6)
