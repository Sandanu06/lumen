# Design system

The visual and interaction rules behind Lumen. For a TV read from the sofa, driven by a remote, in a dim room.

## Principles

1. **Legible from three metres.** Large type, strong contrast, nothing hidden behind hover.
2. **Remote first.** Every action reachable with the D-pad. The Magic Remote pointer is a bonus.
3. **Calm and alive.** A quiet glass interface over a slowly moving wallpaper. Motion explains change; it never decorates.
4. **Light on the TV.** About 450 MB free and a 2021 browser: every effect must earn its frames.
5. **Honest.** Say what the TV can and cannot do; no fake progress, no pretending.

## Foundations

| | |
|---|---|
| **Canvas** | 1920×1080 CSS px, fixed |
| **Ground** | A photograph (four scenes) with the dark scrim and a fine dither baked into the image. Never a runtime gradient layer. |
| **Glass** | `rgba(255,255,255,.085)` fill, 1 px `rgba(255,255,255,.15)` border, inset top highlight, `backdrop-filter: blur(26px)`. Radius 22 to 30 px. |
| **Ink** | `#fff`, secondary `rgba(255,255,255,.72)`, tertiary `.5`. |
| **Accent** | `#e5483d` for the favourite state and chart bars. Spotify green `#1ed760` only for Spotify. |
| **Brand colour** | Each app card glows in that app's colour (read from its icon by `npm run sync`, with overrides in `tools/brand.json`). |
| **Type** | Inter variable (self-hosted, Latin). Clock 84/700, section title 30/600, card title 42/600, body 24/500, small 21. |
| **Icons** | One consistent 24-unit stroke set (1.7 px, round caps), drawn as an inline SVG sprite. |

## Layout (1920×1080)

```
┌──────────────────────────────────────────────────────────────┐
│ logo  [now playing pill]            [sound chip][⚙][exit][name]│  header  y 0–120
│                     Good evening, Alex                         │  greeting y 146
│            ┌──── search ──────────────────┐                    │  search   y 224
│            [chip][chip][chip][chip][chip]                      │  chips    y 328
│        [Home][Smart TV][Inputs][Spotify][Favorites][Stats]     │  tabs     y 432
│  Your apps                                                      │  title    y 592
│  ┌ card ┐ ┌ card ┐ ┌ player ───────┐                 24°C      │  shelf    y 640
│  └──────┘ └──────┘ └───────────────┘                 04:45 AM  │  clock    bottom-right
└──────────────────────────────────────────────────────────────┘
```

The shelf is 1450 px wide with a fade at its right edge so cards never run under the clock.

## Focus language

Focus has to be unmistakable from across the room, and every control type has one treatment:

| Element | Focus treatment |
|---|---|
| App / content card | 3 px white ring, lift 12 px, scale 1.04, brand-coloured glow, one light sweep across the card |
| Tab | White ring around the tab; the pill under it slides and takes the tab's colour |
| Small buttons, chips, option rows, icon buttons | White fill with dark text |
| Text fields | Brighter field plus a 3 px white ring |
| Spotify controls | White ring |

## Motion

| Moment | What happens | Time |
|---|---|---|
| Launch | Logo outline draws, bars grow, wordmark rises, loading bar fills, zoom into the home screen | 2.8 s (skipped if open in the last 20 minutes) |
| Tab change | Cards exit in the direction of travel (28 ms stagger), a light sweep crosses the shelf, the title slides out and in, the pill squashes and stretches and takes the tab colour, new cards arrive from the same side (55 ms stagger) | ≈ 0.65 s |
| Focus move | Card lifts and scales; ring and glow fade in | 0.34 s, ease-out expo |
| Wallpaper | Crossfade between scenes | 2.6 s |
| Ambient | Camera drift (80 s), mist band (62 s), 22 floating lights (26 to 60 s each), blinking clock colon | continuous |
| Panels | Rise and scale in | 0.45 s |
| Toasts | Slide down from the top, fade | 0.45 s |

**The performance rule: animate `transform` and `opacity` only.** Measured on the TV, animating `box-shadow`, `border-color` or `filter` on a moving element costs 10 to 20 fps each. Static effects are baked into images. See [ARCHITECTURE.md](ARCHITECTURE.md#performance).

## Wallpapers

Four scenes (dawn, day, dusk, night) derived from two CC-licensed photographs by `tools/make-wallpapers.py`: resize, blur, grade (night is also darkened and given stars in the sky only), bake the scrim, add dither against banding. Auto mode picks the scene from the real sunrise and sunset. Credits: [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Card artwork

`tools/make-art.py` renders one card background per app: a near-black base, lit from the bottom right in the app's colour with a cooler counter-light, a soft diagonal sheen, and grain baked in so dark gradients do not band on a TV panel.

## Sound

Optional and quiet, synthesised with Web Audio (no files): each tab has its own note on a pentatonic scale, launching an app is a three-note rising chime, panels open and close with a short sweep.

## Accessibility

* Contrast: body text ≥ 4.5:1 on the glass, large text ≥ 3:1.
* Focus is always visible, never colour alone.
* Type is large by default for distance viewing.
* All actions have a non-pointer path; there are no hover-only affordances.
* Motion can be turned off (Settings → Live background); the interface still transitions, with fewer moving parts.
