// Reads the TV's installed apps over its pairing API and writes app/apps.js + app/icons/*.
// First run: accept the pairing prompt on the TV. The client key is kept in .lgtv-key (git-ignored).
const fs = require('fs'), path = require('path'), {PNG} = require('pngjs');
// Saturation-weighted average of opaque pixels: the colour the card glows with.
const brand = JSON.parse(fs.readFileSync(path.join(__dirname, 'brand.json'), 'utf8'));
const dominant = b => { const im = PNG.sync.read(b); let r = 0, g = 0, bl = 0, w = 0;
  for (let i = 0; i < im.data.length; i += 4) { if (im.data[i + 3] < 200) continue; const R = im.data[i], G = im.data[i + 1], B = im.data[i + 2], sat = Math.max(R, G, B) - Math.min(R, G, B) + 8; r += R * sat; g += G * sat; bl += B * sat; w += sat; }
  return w ? [r, g, bl].map(v => Math.round(v / w)).join(',') : '120,120,120'; };
const out = path.join(__dirname, '..', 'app'); fs.mkdirSync(path.join(out, 'icons'), {recursive: true});
const {tvIp} = require('./lib/config');
const tv = require('lgtv2')({url: 'ws://' + tvIp() + ':3000', keyFile: path.join(__dirname, '..', '.lgtv-key'), timeout: 90000, reconnect: false});
tv.on('error', e => { console.error('tv error:', e.message); process.exit(1); });
tv.on('prompt', () => console.log('>>> accept the pairing prompt on the TV <<<'));
tv.on('connect', () => tv.request('ssap://com.webos.applicationManager/listLaunchPoints', async (err, r) => {
  if (err) { console.error(err); process.exit(1); }
  const HIDE = ['com.sandman.home','com.palmdts.devmode','com.webos.app.sportsteamsettings','com.webos.app.roomconnect','com.webos.app.discovery','com.webos.app.homeconnect'];
  const apps = [];
  for (const p of r.launchPoints.filter(p => !HIDE.includes(p.id))) {
    let icon = '', color = '120,120,120';
    try { const b = Buffer.from(await (await fetch(p.largeIcon || p.icon)).arrayBuffer());
      icon = 'icons/' + p.id.replace(/[^\w.-]/g, '_') + '.png'; fs.writeFileSync(path.join(out, icon), b); color = dominant(b); } catch (e) { /* no icon: tile shows name only */ }
    apps.push({id: p.id, title: p.title, icon, color: brand[p.id] || color});
  }
  // a script, not JSON: file:// fetch/XHR is unreliable on webOS, <script src> is not
  fs.writeFileSync(path.join(out, 'apps.js'), 'window.APPS = ' + JSON.stringify(apps, null, 1) + ';\n');
  console.log(apps.length + ' apps:\n' + apps.map(a => ' ' + a.id + '  ' + a.title + (a.icon ? '' : '  (no icon)')).join('\n'));
  process.exit(0);
}));
