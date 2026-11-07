# Third-party notices

Lumen's own code is MIT licensed ([LICENSE](LICENSE)). It bundles or depends on the following. Lumen is independent and is not affiliated with or endorsed by LG Electronics, Spotify or any company named here; their names and logos are trademarks of their owners.

## Wallpapers (`app/wallpapers`, `tools/src-wallpapers`)

Photographs of Lago di Braies, South Tyrol, from Wikimedia Commons. They were resized, blurred, darkened and dithered; one hiker was retouched out; the dusk and night scenes are colour-graded (night also has synthetic stars added). Regenerate with `tools/make-wallpapers.py`.

| Files | Original | Author | Licence |
|---|---|---|---|
| `dawn.jpg`, `dusk.jpg` | [Lago di Braies - Morning](https://commons.wikimedia.org/wiki/File:Lago_di_Braies_-_Morning.jpg) | Eric Kilby | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/). These two derivatives are therefore shared under **CC BY-SA 2.0**. |
| `day.jpg`, `night.jpg` | [Lago di Braies in the Dolomites](https://commons.wikimedia.org/wiki/File:Lago_di_Braies_in_the_Dolomites.jpg) | David Stewart | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |

The same credits appear in `app/wallpapers/CREDITS.md` and in the app's Settings panel.

## Font

**Inter** (variable, Latin subset), © The Inter Project Authors, licensed under the [SIL Open Font License 1.1](https://openfontlicense.org). https://rsms.me/inter

## Libraries (build and tooling only; none run on the TV)

| Package | Licence | Used for |
|---|---|---|
| [`@webos-tools/cli`](https://github.com/webos-tools/cli) | Apache-2.0 | Packaging and installing to the TV (`ares-*`) |
| [`lgtv2`](https://github.com/hobbyquaker/lgtv2) | MIT | Pairing with the TV's control API, syncing the app list |
| [`ws`](https://github.com/websockets/ws) | MIT | WebSocket client used by `lgtv2` |
| [`pngjs`](https://github.com/pngjs/pngjs) | MIT | Reading app icons to pick each card's colour |

## Services Lumen talks to

* [Open-Meteo](https://open-meteo.com) weather and geocoding (CC BY 4.0 data, free for non-commercial use, no key). Lumen shows weather from Open-Meteo.
* [Spotify Web API](https://developer.spotify.com/documentation/web-api), used only if you connect your own Spotify account, under Spotify's developer terms.
* [ipwho.is](https://ipwho.is) for approximate location when no city is set.

## Logos and icons

Lumen does not distribute other companies' logos. The per-app icons and artwork shown on the TV are downloaded from your own TV by `npm run sync` and generated locally; they are git-ignored. Screenshots in the documentation show those icons because they are screenshots of a real TV.
