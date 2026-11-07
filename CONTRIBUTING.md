# Contributing

Thanks for helping. Lumen is small on purpose, so changes are easy to review.

## Quick loop

```bash
git clone https://github.com/Sandanu06/lumen.git && cd lumen
npm install
npm run check          # lint (Chrome 79 rules, no secrets) + tests
npm run build          # builds dist/*.ipk with no TV attached
```

To try changes on a real TV: `npm run setup -- --ip <TV>` once, then `npm run deploy`. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for debugging on the TV and regenerating assets.

## The rules that matter

1. **The TV runs Chrome 79.** No `?.`, `??`, `Array.at`, `structuredClone`, `aspect-ratio`, `inset`, `color-mix()`, `:focus-visible`, flex `gap`. `npm run lint` enforces it.
2. **Animate `transform` and `opacity` only.** `box-shadow`, `border-color` and `filter` on moving elements cost 10 to 20 fps each on the TV. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#performance).
3. **Remote first.** Everything reachable with the D-pad; nothing that needs hover.
4. **No new dependencies in the app.** Tooling dependencies are fine when they earn their place.
5. **Never commit secrets or personal data.** `.lgtv-key`, `app/session.js`, `app/spotify.js`, `service/tv.json`, `.lumen.json` are git-ignored; keep it that way.
6. **Keep promises honest.** If the TV cannot do something, say so in the docs rather than faking it.

## Pull requests

* Keep them focused; describe what changed and how you checked it (screenshot for UI, TV model for hardware behaviour).
* Add or update a test when you change logic in `app/app.js` or `service/service.js` (`tests/`).
* Run `npm run check` first. CI runs the same.
* Update the docs and `CHANGELOG.md` for user-visible changes.

## Reporting a bug

Open an issue with the template. The most useful details: TV model and webOS version, what you pressed, what you expected, and the output of `npm run check`. For a service problem, the service log helps: open Lumen with `ares-inspect` and call `luna://com.sandman.home.service/status` (see Development).

## Compatibility reports

Lumen is tested on one TV. If it works (or does not) on yours, open an issue titled "Compatibility: <model>, webOS <version>". That helps everyone.
