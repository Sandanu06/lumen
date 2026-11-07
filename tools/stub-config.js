// Creates the optional per-user files the app loads, as harmless empties, so a fresh clone builds and runs.
// Never overwrites a file that already exists. Run automatically by `npm run build`.
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const put = (file, text) => { const f = path.join(root, file); if (!fs.existsSync(f)) { fs.writeFileSync(f, text); console.log('created', file); } };
put('app/apps.js', 'window.APPS = [];\n');                                   // filled by: npm run sync
put('app/session.js', 'window.DEV_TOKEN = "";\nwindow.TV_KEY = "";\n');          // filled by: npm run setup
put('app/spotify.js', 'window.SPOTIFY = null;\n');                             // filled by: npm run spotify
if (!fs.existsSync(path.join(root, 'app/pairing.js'))) {
  const p = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/lgtv2/pairing.json'), 'utf8')), m = p.manifest;
  delete m.signed; m.appVersion = '1.0'; m.permissions.push('CONTROL_INPUT_TEXT', 'CONTROL_MOUSE_AND_KEYBOARD');
  put('app/pairing.js', 'window.PAIRING = ' + JSON.stringify(p) + ';\n');
}
fs.mkdirSync(path.join(root, 'app/icons'), {recursive: true}); fs.mkdirSync(path.join(root, 'app/art'), {recursive: true});
