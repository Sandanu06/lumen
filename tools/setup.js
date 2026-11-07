#!/usr/bin/env node
// One-command setup for a new TV:  npm run setup -- --ip 192.168.1.50 [--passphrase 123456]
//
// Safe to re-run: every step is skipped when it is already done.
//   1. checks the TV is reachable and Developer Mode is on
//   2. downloads the Developer Mode SSH key (Key Server must be ON in the TV's Developer Mode app) and registers the TV with ares-cli as "lgtv"
//   3. pairs with the TV's control API (accept the prompt on the TV once) and saves the key in .lgtv-key
//   4. writes app/session.js (Developer Mode session token + control key), app/pairing.js and the app list (npm run sync)
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net');
const {spawnSync} = require('child_process');
const cfg = require('./lib/config');

const args = process.argv.slice(2), opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; }, flag = n => args.includes('--' + n);
const ROOT = cfg.ROOT, SSH_DIR = path.join(os.homedir(), '.ssh'), KEY = path.join(SSH_DIR, 'webos_rsa');
const say = (m) => console.log(m), ok = m => console.log('  ✓ ' + m), warn = m => console.log('  ! ' + m);
const die = m => { console.error('\n✗ ' + m + '\n'); process.exit(1); };
const run = (cmd, a, o) => spawnSync(cmd, a, Object.assign({cwd: ROOT, encoding: 'utf8'}, o));
const bin = n => path.join(ROOT, 'node_modules', '.bin', n);

if (flag('help') || flag('h')) { say('Usage: npm run setup -- --ip <TV IP> [--passphrase <code shown in the TV Developer Mode app>] [--skip-sync]'); process.exit(0); }
if (Number(process.versions.node.split('.')[0]) < 18) die('Node 18 or newer is required (you have ' + process.version + ').');

const ip = opt('ip') || process.env.LUMEN_TV_IP || cfg.read().ip;
if (!ip) die('Tell me the TV address:  npm run setup -- --ip 192.168.1.50\n(TV: Settings > Network > your connection shows the IP address)');
if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) die('"' + ip + '" does not look like an IPv4 address.');
cfg.save({ip});

const port = (p, ms = 2500) => new Promise(res => { const s = net.connect({host: ip, port: p, timeout: ms}); s.on('connect', () => { s.destroy(); res(true); }); s.on('timeout', () => { s.destroy(); res(false); }); s.on('error', () => res(false)); });
const sshArgs = ['-i', KEY, '-p', '9922', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-o', 'IdentitiesOnly=yes', '-o', 'HostKeyAlgorithms=+ssh-rsa', '-o', 'PubkeyAcceptedAlgorithms=+ssh-rsa', 'prisoner@' + ip];

(async () => {
  say('\nLumen setup for the TV at ' + ip + '\n');

  say('1/4  Reaching the TV');
  if (!(await port(3000))) die('Cannot reach ' + ip + ':3000. Is the TV on, on the same network, and is the address right?');
  ok('TV control API reachable');
  if (!(await port(9922))) die('Developer Mode SSH (port 9922) is closed. On the TV: install "Developer Mode" from the LG Content Store, log in, switch Dev Mode ON, let it reboot, then switch Key Server ON and keep the app open.');
  ok('Developer Mode is on');

  say('\n2/4  Developer key and ares-cli');
  fs.mkdirSync(SSH_DIR, {recursive: true, mode: 0o700});
  if (!fs.existsSync(KEY)) {
    if (!(await port(9991))) die('Key Server (port 9991) is closed. Open the Developer Mode app on the TV, switch Key Server ON, keep the app open, and run setup again.');
    const r = await fetch('http://' + ip + ':9991/webos_rsa').catch(() => null);
    if (!r || !r.ok) die('Could not download the key from the TV (Key Server).');
    fs.writeFileSync(KEY, await r.text(), {mode: 0o600});
    const pass = opt('passphrase');
    if (pass) { const k = run('ssh-keygen', ['-p', '-P', pass, '-N', '', '-f', KEY]); if (k.status !== 0) die('The passphrase was rejected. Use the code shown in the TV\'s Developer Mode app.'); ok('key saved to ~/.ssh/webos_rsa (passphrase removed)'); }
    else warn('key saved encrypted. Re-run with --passphrase <code on the TV screen> so deploys do not prompt every time.');
  } else ok('key already at ~/.ssh/webos_rsa');

  const dev = ['-i', 'host=' + ip, '-i', 'port=9922', '-i', 'username=prisoner', '-i', 'privatekey=webos_rsa', '-i', 'default=true'];
  const listed = run(bin('ares-setup-device'), ['--list']).stdout || '';
  const r2 = run(bin('ares-setup-device'), [/^lgtv\b/m.test(listed) ? '--modify' : '--add', 'lgtv'].concat(dev));
  if (r2.status !== 0) die('ares-setup-device failed:\n' + (r2.stdout || '') + (r2.stderr || ''));
  ok('TV registered with ares-cli as "lgtv"');

  say('\n3/4  Pairing with the TV control API');
  const keyFile = path.join(ROOT, '.lgtv-key');
  const clientKey = await new Promise(res => {
    const tv = require('lgtv2')({url: 'ws://' + ip + ':3000', keyFile, timeout: 60000, reconnect: false});
    const t = setTimeout(() => { warn('no answer after 60 s'); res(null); }, 62000);
    tv.on('prompt', () => say('  >>> Look at the TV and press OK / Yes on the pairing prompt <<<'));
    tv.on('error', e => { clearTimeout(t); warn(e.message); res(null); });
    tv.on('connect', () => { clearTimeout(t); tv.disconnect(); res(true); });
  });
  if (!clientKey || !fs.existsSync(keyFile)) die('Pairing did not complete. Run setup again and accept the prompt on the TV.');
  ok('paired (key saved in .lgtv-key, which is never committed)');

  say('\n4/4  Writing app configuration');
  const t = run('ssh', sshArgs.concat(['cat /var/luna/preferences/devmode_enabled']));
  const token = (t.stdout || '').trim();
  if (t.status !== 0 || token.length < 20) warn('could not read the Developer Mode session token over SSH (' + ((t.stderr || '').trim().split('\n').pop() || 'unknown') + '). The app will not renew its own session; extend it in the TV\'s Developer Mode app every ~50 hours.');
  else ok('Developer Mode session token read (the app renews its own session)');
  const tvKey = fs.readFileSync(keyFile, 'utf8').trim();
  fs.writeFileSync(path.join(ROOT, 'app/session.js'), 'window.DEV_TOKEN = ' + JSON.stringify(token.length >= 20 ? token : '') + ';\nwindow.TV_KEY = ' + JSON.stringify(tvKey) + ';\n');
  run('node', ['tools/stub-config.js'], {stdio: 'ignore'});
  ok('app/session.js and app/pairing.js written (git-ignored where private)');

  if (!flag('skip-sync')) {
    const s = run('node', ['tools/sync-apps.js'], {stdio: 'inherit'});
    if (s.status !== 0) warn('app sync failed; run  npm run sync  later');
    else { const a = run('python3', ['tools/make-art.py'], {stdio: 'inherit'}); if (a.status !== 0) warn('card art needs Python 3 with Pillow (pip install pillow), then:  npm run art'); else ok('card art generated'); }
  }

  say('\nAll set. Next:\n  npm run deploy          install Lumen on the TV and open it\n  npm run spotify -- <Client ID>   (optional) connect Spotify, see docs/SPOTIFY.md\n');
  process.exit(0);
})().catch(e => die(e.message));
