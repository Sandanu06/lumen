// Copies the pairing manifest and the TV key into service/tv.json (git-ignored) before packaging.
// --allow-missing: write an empty key instead of failing (used by CI and `npm run build` on a machine with no TV).
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const keyFile = path.join(root, '.lgtv-key'), sandbox = {};
new Function('window', fs.readFileSync(path.join(root, 'app/pairing.js'), 'utf8'))(sandbox);
let key = '';
try { key = fs.readFileSync(keyFile, 'utf8').trim(); } catch (e) {
  if (!process.argv.includes('--allow-missing')) { console.error('No TV key yet (.lgtv-key). Run:  npm run setup -- --ip <TV IP address>'); process.exit(1); }
}
fs.writeFileSync(path.join(root, 'service/tv.json'), JSON.stringify({key, pairing: sandbox.PAIRING}));
