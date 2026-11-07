// One-time Spotify sign-in for the TV app (Authorization Code + PKCE, so there is no client secret to keep).
//   1. https://developer.spotify.com/dashboard -> Create app. Redirect URI: http://127.0.0.1:8888/callback  (API: Web API)
//   2. node tools/spotify-auth.js <CLIENT_ID>      (or: npm run spotify -- <CLIENT_ID>)
//   3. npm run deploy
// Writes app/spotify.js (git-ignored; holds a refresh token). Playback control needs Spotify Premium.
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path'), {execSync} = require('child_process');
const b64u = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const challengeOf = v => b64u(crypto.createHash('sha256').update(v).digest());

if (process.argv[2] === '--selftest') { // RFC 7636 appendix B vector
  const got = challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
  if (got !== 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM') { console.error('PKCE self-test FAILED:', got); process.exit(1); }
  console.log('PKCE self-test ok'); process.exit(0);
}
const clientId = process.argv[2];
if (!clientId) { console.error('Usage: node tools/spotify-auth.js <CLIENT_ID>\nCreate the app first: https://developer.spotify.com/dashboard (redirect URI http://127.0.0.1:8888/callback)'); process.exit(1); }

const PORT = 8888, REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative user-library-read user-library-modify streaming user-read-email user-read-private';
const verifier = b64u(crypto.randomBytes(64)), state = b64u(crypto.randomBytes(12));
const url = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({client_id: clientId, response_type: 'code', redirect_uri: REDIRECT, code_challenge_method: 'S256', code_challenge: challengeOf(verifier), state, scope: SCOPES});

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, REDIRECT); if (u.pathname !== '/callback') { res.statusCode = 404; return res.end(); }
  const done = (code, msg) => { res.writeHead(code, {'Content-Type': 'text/html'}); res.end(`<body style="font:24px system-ui;padding:60px;background:#111;color:#fff">${msg}</body>`); };
  if (u.searchParams.get('error')) { done(400, 'Spotify said: ' + u.searchParams.get('error')); console.error('Denied:', u.searchParams.get('error')); return process.exit(1); }
  if (u.searchParams.get('state') !== state) return done(400, 'State mismatch, start again.');
  try {
    const r = await fetch('https://accounts.spotify.com/api/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({grant_type: 'authorization_code', code: u.searchParams.get('code'), redirect_uri: REDIRECT, client_id: clientId, code_verifier: verifier})});
    const j = await r.json(); if (!j.refresh_token) throw new Error(j.error_description || j.error || 'no refresh token');
    fs.writeFileSync(path.join(__dirname, '..', 'app', 'spotify.js'), `window.SPOTIFY = ${JSON.stringify({clientId, refreshToken: j.refresh_token})};\n`);
    done(200, 'Spotify is connected. You can close this tab and run <b>npm run deploy</b>.'); console.log('Connected. Now run: npm run deploy'); setTimeout(() => process.exit(0), 300);
  } catch (e) { done(500, 'Could not finish: ' + e.message); console.error('Failed:', e.message); process.exit(1); }
});
server.listen(PORT, '127.0.0.1', () => { console.log('Opening Spotify sign-in...\nIf the browser does not open, visit:\n' + url); try { execSync(`open "${url}"`); } catch (e) { /* not macOS */ } });
setTimeout(() => { console.error('Timed out after 30 minutes.'); process.exit(1); }, 1800000);
