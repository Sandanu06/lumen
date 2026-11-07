#!/usr/bin/env node
// Captures the README screenshots and the navigation demo from a REAL TV running Lumen.
//   npm run docs:media            (TV on, Lumen installed, "lgtv" registered by `npm run setup`)
// While it runs, the app shows a neutral DEMO profile (name "Alex", sample usage, a fictional track) so nothing personal is published.
// Your real settings are saved first and restored at the end (also on Ctrl-C). Output: docs/media/*.jpg and docs/media/frames/ for tools/make-gif.py.
const fs = require('fs'), os = require('os'), path = require('path'), {spawn, spawnSync} = require('child_process');
const root = path.join(__dirname, '..'), out = path.join(root, 'docs', 'media'), frames = path.join(out, 'frames');
const APP = JSON.parse(fs.readFileSync(path.join(root, 'app/appinfo.json'), 'utf8')).id;
const BACKUP = path.join(os.tmpdir(), 'lumen-docs-backup.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(out, {recursive: true}); fs.rmSync(frames, {recursive: true, force: true}); fs.mkdirSync(frames, {recursive: true});

function startInspector() {
  return new Promise((res, rej) => {
    const p = spawn(path.join(root, 'node_modules/.bin/ares-inspect'), ['-d', 'lgtv', '--app', APP], {cwd: root});
    const t = setTimeout(() => rej(new Error('ares-inspect did not start (is the TV on and Lumen installed?)')), 40000);
    const on = d => { const m = /localhost:(\d+)\/devtools/.exec(String(d)); if (m) { clearTimeout(t); res({port: m[1], proc: p}); } };
    p.stdout.on('data', on); p.stderr.on('data', on);
  });
}

(async () => {
  // make sure Lumen is the app on screen
  const lg = require('lgtv2')({url: 'ws://' + require('./lib/config').tvIp() + ':3000', keyFile: path.join(root, '.lgtv-key'), reconnect: false, timeout: 20000});
  await new Promise((r, j) => { lg.on('connect', r); lg.on('error', j); });
  await new Promise(r => lg.request('ssap://com.webos.applicationManager/launch', {id: APP}, () => r())); lg.disconnect(); await sleep(9000);

  const {port, proc} = await startInspector(); await sleep(2500);
  const list = await (await fetch('http://localhost:' + port + '/json')).json();
  const ws = new WebSocket(list[0].webSocketDebuggerUrl); let id = 0; const wait = {}, listeners = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (wait[d.id]) wait[d.id](d); else listeners.forEach(f => f(d)); };
  await new Promise(r => ws.onopen = r);
  const send = (method, params = {}) => new Promise(r => { wait[++id] = d => { delete wait[d.id]; r(d.result || d.error); }; ws.send(JSON.stringify({id, method, params})); });
  const ev = async expr => { const r = await send('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true}); return r && r.result ? r.result.value : undefined; };
  const quiet = async () => { for (let i = 0; i < 20; i++) { if (!(await ev("document.getElementById('toast').classList.contains('show')"))) break; await sleep(500); } await sleep(300); }; // never photograph a toast
  const shot = async (name, q = 90) => { await quiet(); const s = await send('Page.captureScreenshot', {format: 'jpeg', quality: q}); fs.writeFileSync(path.join(out, name), Buffer.from(s.data, 'base64')); console.log('  saved', name); };
  const key = c => ev(`document.dispatchEvent(new KeyboardEvent('keydown',{keyCode:${c},bubbles:true}));1`);
  const click = sel => ev(`document.querySelector(${JSON.stringify(sel)}).click();1`);
  const tab = v => click(`[data-view=${v}]`);

  const original = await ev("localStorage.getItem('home.v1')"); fs.writeFileSync(BACKUP, JSON.stringify({original}));
  let restored = false;
  const restore = async () => { if (restored) return; restored = true; try { await ev(`localStorage.setItem('home.v1', ${JSON.stringify(original || '{}')});location.reload();1`); await sleep(1500); } catch (e) { console.error('RESTORE FAILED, backup is at ' + BACKUP); } try { proc.kill(); } catch (e) { /* gone */ } };
  process.on('SIGINT', async () => { await restore(); process.exit(1); });

  try {
    // ---------- demo profile ----------
    const hist = []; const ids = ['netflix', 'netflix', 'netflix', 'spotify-beehive', 'spotify-beehive', 'youtube.leanback.v4', 'amazon', 'org.jellyfin.webos', 'netflix', 'spotify-beehive']; const now = Date.now();
    for (let i = 0; i < 52; i++) { const d = Math.floor(((i * 7) % 7)), hr = [20, 21, 19, 22, 18, 14, 9, 21, 20][i % 9]; const t = new Date(now - ((i * 5) % 7) * 864e5); t.setHours(hr, (i * 11) % 59); hist.push({id: ids[i % ids.length], t: t.getTime()}); }
    const demo = {name: 'Alex', hour12: true, unit: 'C', wall: 'dusk', engine: 'youtube', favs: ['netflix', 'spotify-beehive', 'youtube.leanback.v4', 'amazon'], hist, live: true, sounds: false, idle: 0, homeBtn: true, lastIntro: Date.now()};
    await ev(`localStorage.setItem('home.v1', ${JSON.stringify(JSON.stringify(demo))});location.reload();1`); await sleep(9000);
    const feed = `window.__sp.feed({playing:true,id:'demo',uri:'spotify:track:demo',title:'Blue Hour',artist:'The Lumen Ensemble',cover:'wallpapers/dusk.jpg',dur:214000,prog:87000,device:'LG webOS TV',shuffle:true,repeat:'context',liked:true},[{name:'Focus Flow',cover:'wallpapers/day.jpg',count:120,uri:'a'},{name:'Night Drive',cover:'wallpapers/night.jpg',count:64,uri:'b'},{name:'Sunday Morning',cover:'wallpapers/dawn.jpg',count:48,uri:'c'},{name:'Golden Hour',cover:'wallpapers/dusk.jpg',count:75,uri:'d'}]);1`;
    const refeed = async () => { await ev(feed); await sleep(2600); await ev(feed); await sleep(600); }; // a poll already in flight can overwrite the first feed; after the second, polling is off
    await refeed(); await sleep(1500);

    // ---------- screenshots ----------
    console.log('Screenshots');
    await tab('home'); await sleep(1500); await key(40); await sleep(1100); await shot('01-home.jpg');
    await tab('tv'); await sleep(1800); await shot('02-smart-tv.jpg');
    await tab('inputs'); await sleep(3500); await shot('03-inputs.jpg');
    await tab('music'); await sleep(2200); await shot('04-spotify.jpg');
    await tab('fav'); await sleep(1800); await shot('05-favorites.jpg');
    await tab('stats'); await sleep(2600); await shot('06-stats.jpg');
    await tab('home'); await sleep(1200);
    await click('#user'); await sleep(1500); await shot('07-settings.jpg'); await click('#s-close'); await sleep(700);
    await click('#b-snd'); await sleep(3500); await shot('08-sound.jpg'); await click('#sn-close'); await sleep(700);
    await click('#b-ctl'); await sleep(2500); await shot('09-controls.jpg'); await click('#c-close'); await sleep(700);
    await ev('window.__home.sleep();1'); await sleep(3200); await shot('10-clock.jpg'); await ev('window.__home.wake();1'); await sleep(900);
    // intro, caught mid-animation
    await ev("var s=JSON.parse(localStorage.getItem('home.v1'));s.lastIntro=0;localStorage.setItem('home.v1',JSON.stringify(s));location.reload();1"); await sleep(2300); await shot('11-intro.jpg', 85); await sleep(9000);
    await refeed();
    // the four time-of-day scenes
    for (const w of ['dawn', 'day', 'dusk', 'night']) { await ev(`var s=JSON.parse(localStorage.getItem('home.v1'));s.wall='${w}';localStorage.setItem('home.v1',JSON.stringify(s));location.reload();1`); await sleep(9500); await refeed(); await sleep(1500); await shot('scene-' + w + '.jpg', 84); }
    await ev(`var s=JSON.parse(localStorage.getItem('home.v1'));s.wall='dusk';localStorage.setItem('home.v1',JSON.stringify(s));location.reload();1`); await sleep(9500); await refeed();

    // ---------- navigation demo (screencast frames; assembled by tools/make-gif.py) ----------
    console.log('Recording the navigation demo');
    let n = 0; const meta = [];
    listeners.push(d => { if (d.method === 'Page.screencastFrame') { const f = String(n++).padStart(4, '0') + '.jpg'; fs.writeFileSync(path.join(frames, f), Buffer.from(d.params.data, 'base64')); meta.push({f, t: d.params.metadata.timestamp}); send('Page.screencastFrameAck', {sessionId: d.params.sessionId}); } });
    await ev("var s=JSON.parse(localStorage.getItem('home.v1'));s.lastIntro=0;localStorage.setItem('home.v1',JSON.stringify(s));1");
    await send('Page.startScreencast', {format: 'jpeg', quality: 70, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1});
    await ev('location.reload();1'); await sleep(5200);                 // cold start: the logo intro
    await refeed(); await sleep(400);
    await key(39); await sleep(900); await key(39); await sleep(900);   // browse the home shelf
    await key(38); await sleep(900); await key(39); await sleep(1700);  // up to the tabs, Smart TV
    await key(39); await sleep(1700); await key(39); await sleep(1900); // Inputs, Spotify
    await key(40); await sleep(900); await key(39); await sleep(900); await key(39); await sleep(1100); // down into the Spotify shelf
    await key(38); await sleep(900); await key(39); await sleep(1700); await key(39); await sleep(2100); // Favorites, Stats
    await click('#b-snd'); await sleep(2600); await click('#sn-close'); await sleep(900);               // Bluetooth / sound panel
    await click('#b-ctl'); await sleep(2000); await click('#c-close'); await sleep(900);                // TV controls
    await tab('home'); await sleep(1700);
    await ev('window.__home.sleep();1'); await sleep(3300); await ev('window.__home.wake();1'); await sleep(1600); // clock screen
    await send('Page.stopScreencast'); await sleep(300);
    fs.writeFileSync(path.join(frames, 'frames.json'), JSON.stringify(meta));
    console.log('  ' + meta.length + ' frames');
  } finally { await restore(); }
  console.log('\nRestored your real settings. Next: python3 tools/make-gif.py');
  process.exit(0);
})().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
