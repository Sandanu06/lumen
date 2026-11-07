# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private reporting:
**Security → Report a vulnerability** on https://github.com/Sandanu06/lumen/security/advisories/new

Include what you found, how to reproduce it, and the impact you see. You will get an answer within a few days.

## What is sensitive in a Lumen install

| Item | Where | Risk if leaked |
|---|---|---|
| TV control pairing key | `.lgtv-key`, `app/session.js`, `service/tv.json`, inside the built `.ipk` | Someone on your network could control your TV |
| Developer Mode session token | `app/session.js` | Could extend or reset your Developer Mode session |
| Spotify refresh token | `app/spotify.js`, inside the built `.ipk` | Could control your Spotify playback and read your playlists until you revoke it at https://www.spotify.com/account/apps |
| Developer SSH key | `~/.ssh/webos_rsa` | Could install apps on your TV |

All of them are git-ignored and `npm run lint` fails if any is tracked. **Never share a `.ipk` you built for your own TV**: it contains your keys.

## If you pushed a secret by mistake

1. Revoke it (Spotify: account apps page; TV: delete `.lgtv-key` and run `npm run setup` again to re-pair; Developer Mode: switch Dev Mode off and on).
2. Remove it from git history (for example with `git filter-repo`) and force-push.
3. Assume it was seen and rotate it regardless.

## Supported versions

Only the latest release receives fixes.
