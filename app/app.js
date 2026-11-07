'use strict'; // ES2018 only: Chrome 79 has no ?. or ??
(function () {
  var $ = function (id) { return document.getElementById(id); };
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function icon(id) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#i-' + id); u.setAttribute('href', '#i-' + id); s.appendChild(u); return s; }
  var SVC = 'luna://com.sandman.home.service/';

  /* ---------- state (localStorage) ---------- */
  var KEY = 'home.v1', S = {name: '', hour12: true, unit: 'C', wall: 'auto', engine: 'youtube', city: '', favs: null, hist: [], wx: null, sess: 0, live: true, key: '', homeBtn: true, idle: 120, sounds: true, btAuto: true, btPreferred: ''};
  try { var saved = JSON.parse(localStorage.getItem(KEY) || '{}'); for (var k in saved) S[k] = saved[k]; } catch (e) { /* first run */ }
  if (typeof S.wall !== 'string') S.wall = 'auto'; // older versions stored an index
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full: settings just won't persist */ } }

  /* ---------- interface sounds: synthesised with Web Audio, no files; kept quiet because they ride on the TV volume ---------- */
  var AC = window.AudioContext || window.webkitAudioContext, ac = null, NOTES = [523.25, 587.33, 659.25, 783.99, 880, 987.77, 1046.5];
  function tone(f, t, dur, vol, type, to) {
    var o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function snd(kind, i) {
    if (!S.sounds || !AC) return;
    try {
      if (!ac) ac = new AC(); if (ac.state === 'suspended') ac.resume(); var t = ac.currentTime + 0.01;
      if (kind === 'tab') { var f = NOTES[(i || 0) % NOTES.length]; tone(f, t, 0.22, 0.05, 'sine'); tone(f * 2, t, 0.1, 0.018, 'sine'); tone(1800, t, 0.03, 0.012, 'triangle'); }     // a different pentatonic note per tab
      else if (kind === 'open') { tone(392, t, 0.28, 0.05, 'triangle'); tone(523.25, t + 0.07, 0.3, 0.05, 'triangle'); tone(783.99, t + 0.14, 0.45, 0.055, 'triangle', 790); }       // rising launch chime
      else if (kind === 'panel') { tone(330, t, 0.2, 0.04, 'sine', 440); }
      else if (kind === 'back') { tone(440, t, 0.18, 0.035, 'sine', 330); }
    } catch (e) { /* no audio available: stay silent */ }
  }
  var SCENES = {dawn: 'dawn.jpg', day: 'day.jpg', dusk: 'dusk.jpg', night: 'night.jpg'};
  var WALL_OPTS = ['auto', 'dawn', 'day', 'dusk', 'night'], IDLE_OPTS = [0, 60, 120, 300];
  var ENGINES = {youtube: {n: 'YouTube', u: 'https://www.youtube.com/results?search_query='}, google: {n: 'Google', u: 'https://www.google.com/search?q='}};
  var YR = new Date().getFullYear(), CHIPS = ['Indie Music', 'TV Series ' + YR, 'Sports', 'Study Music Live', 'News ' + YR];
  var VERB = {'netflix': 'Watch Now', 'youtube.leanback.v4': 'Watch Now', 'amazon': 'Watch Now', 'com.apple.appletv': 'Watch Now', 'org.jellyfin.webos': 'Watch Now',
    'spotify-beehive': 'Listen', 'com.webos.app.browser': 'Browse', 'com.webos.app.mediadiscovery': 'Play media'};
  var PINNED = ['netflix', 'spotify-beehive', 'youtube.leanback.v4', 'amazon', 'com.apple.appletv', 'org.jellyfin.webos'];
  var TITLES = {home: 'Your apps', tv: 'All apps', inputs: 'Inputs', music: 'Spotify', fav: 'Favorites', stats: 'Usage'}, ORDER = ['home', 'tv', 'inputs', 'music', 'fav', 'stats'];

  var apps = (window.APPS || []).map(function (a) { return {id: a.id, title: a.title.split(' - ')[0], icon: a.icon, color: a.color || '120,120,120', art: 'art/' + a.id.replace(/[^\w.-]/g, '_') + '.jpg'}; })
    .sort(function (a, b) {
      var pa = PINNED.indexOf(a.id), pb = PINNED.indexOf(b.id);
      if (pa >= 0 || pb >= 0) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
      return a.title.localeCompare(b.title);
    });
  function byId(id) { for (var i = 0; i < apps.length; i++) if (apps[i].id === id) return apps[i]; return null; }
  if (!S.favs) S.favs = ['netflix', 'spotify-beehive'].filter(byId);
  function isFav(id) { return S.favs.indexOf(id) >= 0; }

  /* ---------- luna (launch other apps, talk to our own service) ---------- */
  function call(uri, params) {
    return new Promise(function (ok, no) {
      if (typeof PalmServiceBridge === 'undefined') return no(new Error('not running on a TV'));
      var b = new PalmServiceBridge();
      b.onservicecallback = function (m) { try { ok(JSON.parse(m)); } catch (e) { no(e); } };
      b.call(uri, JSON.stringify(params || {}));
    });
  }
  var toastT;
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2600); }
  function launch(id, title, params) {
    call('luna://com.webos.applicationManager/launch', {id: id, params: params || {}}).then(function (m) {
      if (!m.returnValue) toast('Could not open ' + title + (m.errorText ? ': ' + m.errorText : ''));
    }, function (e) { toast('Could not open ' + title + ': ' + e.message); });
  }
  function open(a) { snd('open'); S.hist.push({id: a.id, t: Date.now()}); if (S.hist.length > 400) S.hist.shift(); save(); toast('Opening ' + a.title); launch(a.id, a.title); }
  function search(q) {
    q = (q || $('q').value).trim(); if (!q) return toast('Type something to search for');
    var e = ENGINES[S.engine]; toast('Searching ' + e.n + ' for "' + q + '"');
    launch('com.webos.app.browser', 'the browser', {target: e.u + encodeURIComponent(q)});
  }

  /* ---------- TV control API (the TV's own WebSocket on localhost; key was paired once from the Mac) ---------- */
  var tv = {ws: null, ready: null, n: 0, cb: {}};
  function tvConnect() {
    if (tv.ready) return tv.ready;
    tv.ready = new Promise(function (ok, no) {
      var w = new WebSocket('ws://127.0.0.1:3000'), done = false; tv.ws = w;
      w.onopen = function () {
        var pl = JSON.parse(JSON.stringify(window.PAIRING)), key = S.key || window.TV_KEY; if (key) pl['client-key'] = key;
        w.send(JSON.stringify({type: 'register', id: 'reg', payload: pl}));
      };
      w.onmessage = function (e) {
        var m = JSON.parse(e.data);
        if (m.type === 'registered') { if (m.payload && m.payload['client-key'] && m.payload['client-key'] !== S.key) { S.key = m.payload['client-key']; save(); } done = true; ok(); }
        else if (m.id === 'reg') toast('Accept the pairing prompt on your TV');
        else if (tv.cb[m.id]) tv.cb[m.id](m);
      };
      w.onclose = w.onerror = function () { tv.ready = null; tv.cb = {}; if (!done) no(new Error('TV control unavailable')); };
    });
    return tv.ready;
  }
  // req(uri, payload [, onUpdate]): resolves with the first reply; onUpdate keeps firing for subscriptions
  function req(uri, payload, onUpdate) {
    return tvConnect().then(function () {
      return new Promise(function (ok, no) {
        var id = 'q' + (++tv.n), first = true;
        tv.cb[id] = function (m) {
          if (m.type === 'error' || (m.payload && m.payload.returnValue === false)) { delete tv.cb[id]; return no(new Error((m.error || (m.payload && m.payload.errorText) || 'failed'))); }
          if (first) { first = false; ok(m.payload); } if (onUpdate) onUpdate(m.payload); else delete tv.cb[id];
        };
        tv.ws.send(JSON.stringify({type: 'request', id: id, uri: uri, payload: payload || {}}));
      });
    });
  }
  function fail(what) { return function (e) { toast(what + ': ' + e.message); }; }

  var inputs = null; // [{id,label,connected}] from the TV, null until loaded
  function loadInputs() {
    req('ssap://tv/getExternalInputList').then(function (p) {
      inputs = (p.devices || []).map(function (d) { return {id: d.id, label: d.label || d.id, connected: !!d.connected}; });
      if (view === 'inputs') render();
    }, function (e) { inputs = []; if (view === 'inputs') render(); toast('Inputs: ' + e.message); });
  }
  function inputCard(label, sub, art, on, run) {
    var d = h('div', 'card f'), c = h('div', 'cin'); d.style.setProperty('--c', on ? '48,200,110' : '140,150,160'); c.style.backgroundImage = 'url(art/' + art + '.jpg)';
    var g = h('div', 'ico glyph'); g.appendChild(icon('tv')); c.appendChild(g);
    if (sub === 'Connected') c.appendChild(h('span', 'badge ok', 'Signal'));
    c.appendChild(h('h3', '', label)); c.appendChild(h('p', '', sub)); d.appendChild(c); d.onclick = run; return d;
  }

  /* ---------- controls panel ---------- */
  var vol = {v: 0, mute: false};
  function paintVol() { $('c-volbar').style.width = vol.v + '%'; $('c-volval').textContent = vol.mute ? 'Muted' : vol.v; $('c-mute').textContent = vol.mute ? 'Unmute' : 'Mute'; }
  function volIn(p) { var s = p.volumeStatus || p; if (s.volume != null) vol.v = s.volume; if (s.muteStatus != null) vol.mute = s.muteStatus; else if (s.mute != null) vol.mute = s.mute; paintVol(); }
  var volT; function setVol(v) { vol.v = Math.max(0, Math.min(100, v)); paintVol(); clearTimeout(volT); volT = setTimeout(function () { req('ssap://audio/setVolume', {volume: vol.v}).catch(fail('Volume')); }, 120); }
  $('c-vol')._adj = function (d) { setVol(vol.v + d * 2); };
  function paintMVol() { var v = S.spVol == null ? 60 : S.spVol; $('c-mvolbar').style.width = v + '%'; $('c-mvolval').textContent = v; }
  $('c-mvol')._adj = function (d) { var v = Math.max(0, Math.min(100, (S.spVol == null ? 60 : S.spVol) + d * 5)); S.spVol = v; save(); paintMVol(); if (sp.player) sp.player.setVolume(v / 100); };
  $('c-mvol').onclick = function () { /* use left/right */ };
  $('c-vol').onclick = function () { /* OK does nothing; use left/right */ };
  $('c-mute').onclick = function () { req('ssap://audio/setMute', {mute: !vol.mute}).then(function () { vol.mute = !vol.mute; paintVol(); }, fail('Mute')); };
  $('c-screen').onclick = function () { req('ssap://com.webos.service.tvpower/power/turnOffScreen').then(function () { closePanel(); }, fail('Screen off')); };
  $('c-off').onclick = function () { toast('Turning the TV off'); req('ssap://system/turnOff').catch(fail('Power off')); };
  $('c-close').onclick = function () { closePanel(); };

  /* ---------- Bluetooth speaker: status chip + Sound panel (luna bluetooth2, allowed for this app) ---------- */
  var BTU = 'luna://com.webos.service.bluetooth2/', OUTS = {tv_speaker: 'TV speakers', bt_soundbar: 'Bluetooth speaker', external_arc: 'HDMI ARC', external_optical: 'Optical', headphone: 'Headphones', lineout: 'Line out', tv_external_speaker: 'TV + external speaker'};
  var bt = {adapter: '', list: [], out: 'tv_speaker', scan: {on: false, found: []}, prev: null, scanT: 0};
  function lc(uri, params, ms) { // a luna call that always resolves (errors and timeouts become {returnValue:false})
    return new Promise(function (ok) {
      var done = false, t = setTimeout(function () { if (!done) { done = true; ok({returnValue: false, errorText: 'timeout', timeout: true}); } }, ms || 8000);
      call(uri, params).then(function (m) { if (!done) { done = true; clearTimeout(t); ok(m); } }, function (e) { if (!done) { done = true; clearTimeout(t); ok({returnValue: false, errorText: e.message}); } });
    });
  }
  function isAudio(d) { return (((d.classOfDevice || 0) >> 8) & 31) === 4; }
  var btPending = null, btAgain = false, btSubs = {};
  function btWatch(uri, params) {
    if (btSubs[uri] || typeof PalmServiceBridge === 'undefined') return;
    var b = new PalmServiceBridge(), first = true; btSubs[uri] = b;
    b.onservicecallback = function (raw) {
      try { var m = JSON.parse(raw); if (m.returnValue === false) { b.cancel(); delete btSubs[uri]; return; } } catch (e) { return; }
      if (!first) btPoll(); first = false;
    };
    b.call(uri, JSON.stringify(Object.assign({subscribe: true}, params)));
  }
  function btPoll() {
    if (btPending) { btAgain = true; return btPending; }
    btWatch(BTU + 'device/getStatus', {});
    btWatch('luna://com.webos.service.settings/getSystemSettings', {category: 'sound', keys: ['soundOutput']});
    var p = bt.adapter ? Promise.resolve() : lc(BTU + 'adapter/getStatus', {}).then(function (m) { if (m.adapters && m.adapters[0]) bt.adapter = m.adapters[0].adapterAddress; });
    btPending = p.then(function () { return lc(BTU + 'device/getStatus', {}); }).then(function (m) {
      if (m.returnValue === false || !Array.isArray(m.devices)) throw new Error('Bluetooth status unavailable');
      var devs = (m.devices || []).filter(function (d) { return d.paired && isAudio(d) && d.name; });
      return Promise.all(devs.map(function (d) { return lc(BTU + 'a2dp/getStatus', {address: d.address, adapterAddress: bt.adapter}).then(function (s) { if (s.returnValue === false || typeof s.connected !== 'boolean') throw new Error('Speaker status unavailable'); return {name: d.name, address: d.address, connected: !!s.connected && (!Array.isArray(d.connectedProfiles) || d.connectedProfiles.indexOf('a2dp') >= 0), connecting: !!s.connecting}; }); }));
    }).then(function (list) { bt.list = list; return lc('luna://com.webos.service.settings/getSystemSettings', {category: 'sound', keys: ['soundOutput']}); })
      .then(function (m) {
        if (m.returnValue === false || !m.settings || !m.settings.soundOutput) throw new Error('Sound output unavailable');
        bt.stale = false; bt.out = m.settings.soundOutput;
        var c = bt.list.filter(function (x) { return x.connected; })[0], key = c ? c.name : '';
        if (bt.prev !== null && key !== bt.prev) toast(key ? key + ' connected' : bt.prev + ' disconnected'); // announce changes, not the first reading
        bt.prev = key; paintSnd(); btAutoConnect();
      }).then(function () {
        btPending = null; if (btAgain) { btAgain = false; return btPoll(); }
      }, function () { btPending = null; btAgain = false; bt.stale = true; paintSnd(); });
    return btPending;
  }
  function conn() { return bt.list.filter(function (x) { return x.connected; })[0]; }
  function outLabel() { return bt.out === 'bt_soundbar' ? (conn() ? conn().name : 'Bluetooth disconnected') : OUTS[bt.out] || 'TV speakers'; }
  function paintSnd() {
    var c = conn(), via = bt.out === 'bt_soundbar', busy = bt.list.some(function (x) { return x.connecting; });
    $('snd-t').textContent = bt.stale ? 'Sound status unavailable' : busy ? 'Connecting…' : via ? outLabel() : c ? c.name + ' connected' : outLabel();
    $('snd-i').firstChild.setAttribute('href', '#i-' + (c || busy ? 'bt' : 'speaker'));
    $('snd-d').className = 'dot' + (bt.stale ? ' warn' : via && c ? ' ok' : c || busy ? ' warn' : '');
    paintSndPanel();
  }
  function spkRow(name, status, ok, btn, k, fn) {
    var r = h('div', 'row'), g = h('span'), b = h('button', 'f opt' + (ok ? '' : ' go'), btn); b.setAttribute('data-k', k); b.onclick = fn;
    r.appendChild(h('label', '', name)); g.appendChild(h('span', 'st' + (ok ? ' ok' : ''), status)); g.appendChild(b); r.appendChild(g); return r;
  }
  function paintSndPanel() {
    if ($('snd').hidden) return;
    var keep = cur && $('snd').contains(cur) ? (cur.getAttribute('data-k') || cur.id) : null, L = $('sn-list'), F = $('sn-found'), busy = bt.list.some(function (x) { return x.connecting; });
    $('sn-now').textContent = bt.stale ? 'Sound status unavailable; checking again…' : outLabel(); L.innerHTML = ''; F.innerHTML = '';
    if (!bt.list.length) { var r0 = h('div', 'row'); r0.appendChild(h('label', '', 'No paired speakers yet')); L.appendChild(r0); }
    bt.list.forEach(function (d) { L.appendChild(spkRow(d.name, bt.stale ? 'Status unavailable' : d.connecting ? 'Connecting…' : d.connected ? (bt.out === 'bt_soundbar' ? 'Playing sound' : 'Connected') : 'Not connected', d.connected, d.connecting ? 'Connecting…' : d.connected ? 'Disconnect' : 'Connect', 'p' + d.address, function () { if (!d.connecting) (d.connected ? btDisconnect(d) : btConnect(d)); })); });
    bt.scan.found.forEach(function (d) { F.appendChild(spkRow(d.name, 'Found nearby', false, 'Pair', 'f' + d.address, function () { btPair(d); })); });
    $('sn-scan').textContent = bt.scan.on ? 'Searching…' : 'Search'; $('sn-tv').textContent = bt.out === 'tv_speaker' ? 'Using TV speakers' : 'Use TV speakers';
    $('sn-hint').textContent = bt.scan.on ? 'Looking for speakers in pairing mode…' : busy ? 'The TV keeps trying for about 30 seconds. Check the speaker is switched on and close by.' : S.btAuto ? 'Your speaker reconnects automatically when available. Use TV speakers to stop reconnecting.' : 'Choose Connect to enable automatic speaker reconnection.';
    if (keep) { var again = $('snd').querySelector('[data-k="' + keep + '"]') || $(keep); if (again && again !== cur) setFocus(again); }
  }
  function setOutput(o, attempt) {
    if ((o === 'bt_soundbar') !== !!S.btAuto) return Promise.resolve();
    return req('ssap://com.webos.service.apiadapter/audio/changeSoundOutput', {output: o}).then(function () {
      // The TV can reset its output while a Bluetooth connection settles.
      return new Promise(function (ok) { setTimeout(ok, 1000); });
    }).then(function () { return req('ssap://com.webos.service.apiadapter/audio/getSoundOutput'); }).then(function (m) {
      if (m.soundOutput !== o) {
        if ((attempt || 0) < 2) return setOutput(o, (attempt || 0) + 1);
        throw new Error('TV did not switch sound output; please try again');
      }
      bt.out = m.soundOutput; paintSnd();
    });
  }
  function btAutoConnect() {
    if (!S.btAuto || document.hidden || bt.autoBusy || Date.now() < (bt.nextAuto || 0)) return;
    var d = bt.list.filter(function (x) { return !S.btPreferred || x.address === S.btPreferred; })[0];
    if (!d || d.connecting) return;
    if (d.connected) {
      if (bt.out !== 'bt_soundbar') {
        bt.nextAuto = Date.now() + 45000;
        setOutput('bt_soundbar').catch(function () { /* retry on the next automatic attempt */ });
      }
      return;
    }
    if (bt.list.some(function (x) { return x.connected || x.connecting; })) return;
    bt.nextAuto = Date.now() + 45000; btConnect(d, true);
  }
  function btConnect(d, automatic) {
    if (bt.autoBusy) return;
    S.btPreferred = d.address; S.btAuto = true; save(); bt.autoBusy = true;
    d.connecting = true; paintSnd(); if (!automatic) toast('Connecting to ' + d.name + '…');
    return lc(BTU + 'a2dp/connect', {address: d.address, adapterAddress: bt.adapter}, 32000).then(function (m) {
      return btPoll().then(function () {
        var now = bt.list.filter(function (x) { return x.address === d.address; })[0];
        if (now && now.connected && S.btAuto) return (bt.out !== 'bt_soundbar' ? setOutput('bt_soundbar') : Promise.resolve()).then(function () { toast('Sound is playing through ' + d.name); }, fail('Output'));
        if (!automatic) toast(m.timeout ? 'Could not reach ' + d.name + '. Is it switched on and close by?' : 'Could not connect: ' + (m.errorText || 'unknown error'));
      });
    }).then(function () { bt.autoBusy = false; }, function () { bt.autoBusy = false; });
  }
  function btDisconnect(d) {
    S.btAuto = false; save();
    lc(BTU + 'a2dp/disconnect', {address: d.address, adapterAddress: bt.adapter}).then(function () { return setOutput('tv_speaker').catch(function () {}); }).then(function () { toast('Back to TV speakers'); btPoll(); });
  }
  function btPair(d) {
    toast('Pairing with ' + d.name + '…');
    lc(BTU + 'adapter/pair', {address: d.address, adapterAddress: bt.adapter}, 25000).then(function (m) {
      if (m.returnValue === false) return toast('Pairing failed: ' + (m.timeout ? 'the speaker did not answer' : m.errorText));
      bt.scan.found = bt.scan.found.filter(function (x) { return x.address !== d.address; });
      btPoll().then(function () { var n = bt.list.filter(function (x) { return x.address === d.address; })[0]; if (n) btConnect(n); });
    });
  }
  function btStopScan() { clearInterval(bt.scanT); bt.scan.on = false; lc(BTU + 'adapter/cancelDiscovery', {adapterAddress: bt.adapter}); paintSndPanel(); }
  function btScan() {
    if (bt.scan.on) return btStopScan();
    bt.scan = {on: true, found: []}; lc(BTU + 'adapter/startDiscovery', {adapterAddress: bt.adapter}); paintSndPanel(); var n = 0;
    bt.scanT = setInterval(function () {
      lc(BTU + 'device/getStatus', {}).then(function (m) { bt.scan.found = (m.devices || []).filter(function (d) { return !d.paired && isAudio(d) && d.name; }).map(function (d) { return {name: d.name, address: d.address}; }); paintSndPanel(); });
      if (++n >= 10) btStopScan();
    }, 2000);
  }
  function openSnd() { snd('panel'); opener = cur; $('snd').hidden = false; paintSndPanel(); setFocus($('snd').querySelector('[data-k]') || $('sn-scan')); btPoll().then(function () { if (cur && cur.id === 'sn-scan' && !bt.scan.on) { var b = $('snd').querySelector('[data-k]'); if (b) setFocus(b); } }); }
  $('sn-scan').onclick = btScan; $('sn-tv').onclick = function () { S.btAuto = false; save(); setOutput('tv_speaker').then(function () { toast('Using TV speakers'); }, fail('Output')); }; $('sn-close').onclick = function () { closePanel(); }; $('dv-close').onclick = function () { closePanel(); };

  /* ---------- Spotify (Web API; sign in once on the Mac with tools/spotify-auth.js) ---------- */
  var sp = {cfg: window.SPOTIFY, token: '', exp: 0, state: null, t: 0, playlists: null, devices: null, mock: false, shown: false};
  function spUsesNative() { return typeof PalmServiceBridge !== 'undefined'; } // on a TV the Spotify app always plays the music: the in-dashboard player cannot work on this TV's browser
  function spOn() { return sp.mock || !!(sp.cfg && sp.cfg.clientId && (S.spRefresh || sp.cfg.refreshToken)); }
  function spToken() {
    if (sp.token && Date.now() < sp.exp - 30000) return Promise.resolve(sp.token);
    return fetch('https://accounts.spotify.com/api/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(S.spRefresh || sp.cfg.refreshToken) + '&client_id=' + encodeURIComponent(sp.cfg.clientId)})
      .then(function (r) { if (!r.ok) { sp.authFail = true; throw new Error('sign-in expired (' + r.status + '), run npm run spotify again'); } sp.authFail = false; return r.json(); })
      .then(function (j) { sp.token = j.access_token; sp.exp = Date.now() + j.expires_in * 1000; if (j.refresh_token) { S.spRefresh = j.refresh_token; save(); } return sp.token; });
  }
  function spApi(method, path, body) {
    return spToken().then(function (t) {
      return fetch('https://api.spotify.com/v1' + path, {method: method, headers: body ? {Authorization: 'Bearer ' + t, 'Content-Type': 'application/json'} : {Authorization: 'Bearer ' + t}, body: body ? JSON.stringify(body) : undefined});
    }).then(function (r) {
      if (r.status === 429) { sp.backoff = Date.now() + (+r.headers.get('Retry-After') || 5) * 1000; throw new Error('rate'); } if (r.status === 204) return null; if (r.status === 401) { sp.token = ''; throw new Error('401'); } if (r.status === 403) throw new Error('premium'); if (r.status === 404) throw new Error('nodevice');
      if (!r.ok) throw new Error(String(r.status));
      // Playback commands can succeed with a plain-text acknowledgement.
      if (method !== 'GET') return null;
      return r.text().then(function (t) { if (!t.trim()) return null; try { return JSON.parse(t); } catch (e) { throw new Error('invalid response from Spotify; please try again'); } });
    });
  }
  function cover(imgs) { imgs = imgs || []; for (var i = imgs.length - 1; i >= 0; i--) if (imgs[i].width >= 300) return imgs[i].url; return imgs[0] ? imgs[0].url : ''; }
  function mmss(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
  function spFail(e) { toast(e.message === 'premium' ? 'Spotify Premium is needed to control playback' : e.message === 'nodevice' ? 'No Spotify device is awake. Open Spotify on your TV or phone first.' : e.message === 'notv' ? 'Spotify is not running on the TV yet. Press Open Spotify on TV first, or choose a device with Play on.' : 'Spotify: ' + e.message); setTimeout(spPoll, 300); }
  function spPoll() {
    if (sp.mock || !spOn() || document.hidden || Date.now() < (sp.backoff || 0)) return;
    spApi('GET', '/me/player').then(function (j) {
      sp.t = Date.now();
      sp.state = j && j.item ? {playing: !!j.is_playing, title: j.item.name, artist: (j.item.artists || []).map(function (a) { return a.name; }).join(', '), cover: cover(j.item.album && j.item.album.images), dur: j.item.duration_ms, prog: j.progress_ms || 0, device: j.device ? j.device.name : '', deviceType: j.device ? j.device.type : '', id: j.item.id, uri: j.item.uri, ctx: j.context ? j.context.uri : '', shuffle: !!j.shuffle_state, repeat: j.repeat_state || 'off'} : (sp.state && sp.state.device === LUMEN && Date.now() - (sp.sdkAt || 0) < 30000 ? sp.state : null); // a brief 204 while our own player is active is not 'nothing playing'
      spLikedCheck(); trackLast(); spPaint();
    }, function () { spPaint(); }); // a network blip or rate limit keeps the last known player instead of making it vanish
  }
  function spLikedCheck() { var st = sp.state; if (!st || st.id === sp.likedId) return; var id = st.id; sp.likedId = id; sp.liked = false; spApi('GET', '/me/library/contains?uris=' + encodeURIComponent(st.uri)).then(function (a) { if (sp.likedId === id) { sp.liked = !!(a && a[0]); spPaint(); } }, function () { /* heart just shows off */ }); }
  function trackLast() { // remember what was playing so the dashboard can offer Resume after the TV closes it
    var st = sp.state; if (!st || !st.playing || Date.now() - (sp.lastSave || 0) < 10000) return; sp.lastSave = Date.now();
    S.last = {ctx: st.ctx || '', uri: st.uri || '', pos: st.prog + (Date.now() - sp.t), title: st.title, artist: st.artist, cover: st.cover, dur: st.dur, device: st.device, at: Date.now()}; save();
  }
  /* the dashboard registers itself as a Spotify speaker ("Lumen TV") with the Web Playback SDK, so music plays inside this app and keeps playing while you browse */
  var LUMEN = 'Lumen TV'; sp.dev = {id: '', ready: false, err: ''}; sp.player = null; sp.sdkLoading = false;
  function spFromSdk(st) {
    if (!st || !st.track_window || !st.track_window.current_track) return; var t = st.track_window.current_track;
    sp.t = Date.now(); sp.sdkAt = Date.now(); sp.state = {playing: !st.paused, title: t.name, artist: (t.artists || []).map(function (a) { return a.name; }).join(', '), cover: cover(t.album && t.album.images), dur: st.duration, prog: st.position, device: LUMEN, id: t.id, uri: t.uri, ctx: st.context ? st.context.uri : '', shuffle: !!st.shuffle, repeat: ['off', 'context', 'track'][st.repeat_mode] || 'off'};
    spLikedCheck(); trackLast(); spPaint();
  }
  window.__splog = []; function splog(k, v) { window.__splog.push(Math.round(performance.now() / 1000) + 's ' + k + ' ' + (v || '')); if (window.__splog.length > 60) window.__splog.shift(); }
  function spInitPlayer() {
    if (spUsesNative() || sp.mock || !spOn() || sp.player || sp.sdkLoading || sp.authFail) return; sp.sdkLoading = true;
    window.onSpotifyWebPlaybackSDKReady = function () {
      var pl = new Spotify.Player({name: LUMEN, volume: (S.spVol == null ? 60 : S.spVol) / 100, getOAuthToken: function (cb) { spToken().then(cb, function () { /* paused until the sign-in works again */ }); }});
      sp.player = pl;
      pl.addListener('ready', function (d) { splog('ready', d.device_id.slice(0, 6)); sp.dev.id = d.device_id; sp.dev.ready = true; sp.dev.err = ''; });
      pl.addListener('not_ready', function () { splog('not_ready'); sp.dev.ready = false; });
      pl.addListener('initialization_error', function (e) { splog('init_error', e && e.message); sp.dev.err = 'init'; });
      pl.addListener('authentication_error', function (e) { splog('auth_error', e && e.message); sp.dev.err = 'auth'; });
      pl.addListener('account_error', function () { sp.dev.err = 'premium'; toast('Spotify Premium is needed to play on this TV'); });
      pl.addListener('player_state_changed', function (st) { splog('state', st ? (st.paused ? 'paused' : 'playing') + ' pos=' + Math.round(st.position / 1000) + 's ' + (st.track_window.current_track || {}).name + (st.loading ? ' LOADING' : '') : 'null'); spFromSdk(st); });
      pl.addListener('playback_error', function (e) { splog('playback_error', e && e.message); });
      pl.addListener('autoplay_failed', function () { splog('autoplay_failed', ''); toast('Press OK once to allow music to play'); });
      pl.connect();
    };
    var s = document.createElement('script'); s.src = 'https://sdk.scdn.co/spotify-player.js'; s.onerror = function () { sp.sdkLoading = false; sp.dev.err = 'offline'; if (s.parentNode) s.parentNode.removeChild(s); }; document.head.appendChild(s);
  }
  function spWhenReady(ms) { return new Promise(function (ok) { var t0 = Date.now(); (function w() { if (sp.dev.ready) return ok(sp.dev.id); if (Date.now() - t0 > ms || sp.dev.err) return ok(''); setTimeout(w, 250); })(); }); }
  function spLiked() { return spApi('GET', '/me/tracks?limit=50').then(function (j) { var u = ((j && j.items) || []).map(function (i) { return i.track.uri; }); if (!u.length) throw new Error('no liked songs yet'); return spPlay({uris: u}); }).catch(spFail); }
  function otherDev() { var l = (sp.devices || []).filter(function (d) { return !isTvDev(d) && !d.is_restricted; }); return l.filter(function (d) { return d.is_active; })[0] || l[0]; }
  function spDevRefresh() { if (sp.mock || !spOn() || Date.now() - (sp.devAt || 0) < 15000) return; sp.devAt = Date.now(); spApi('GET', '/me/player/devices').then(function (d) { sp.devices = (d && d.devices) || []; [].forEach.call(document.querySelectorAll('.np.idle'), fillNp); }, function () { /* offline */ }); }
  function spResumeOn(dev) { // keeps playing while you use the dashboard: the other device is the speaker, the dashboard is the remote
    var l = S.last; if (!l) return; var body = l.ctx ? {context_uri: l.ctx, offset: {uri: l.uri}, position_ms: Math.max(0, Math.round(l.pos))} : {uris: [l.uri], position_ms: Math.max(0, Math.round(l.pos))};
    spApi('PUT', '/me/player/play?device_id=' + encodeURIComponent(dev.id), body).then(function () { toast('Playing on ' + dev.name); setTimeout(spPoll, 800); }, spFail);
  }
  function spResume() { var l = S.last; if (!l) return spLiked(); return spPlay(l.ctx ? {context_uri: l.ctx, offset: {uri: l.uri}, position_ms: Math.max(0, Math.round(l.pos))} : {uris: [l.uri], position_ms: Math.max(0, Math.round(l.pos))}); }
  function ctl(ic, k, cls) { var b = h('button', 'f ctl ' + (cls || '')); b.appendChild(icon(ic)); b.onclick = function () { spCtl(k); }; return b; }
  function npCard() {
    var d = h('div', 'card np'), c = h('div', 'cin'), t = h('div', 't'), tm = h('div', 'tm'), bar = h('div', 'bar2'), ctls = h('div', 'ctls'), eq = h('span', 'eq on');
    d.style.setProperty('--c', '30,215,96'); for (var i = 0; i < 4; i++) eq.appendChild(h('i'));
    var p = {cin: c, cover: h('div', 'cover'), h3: h('h3'), ar: h('div', 'ar'), dv: h('div', 'dv'), eq: eq, bar: h('i'), t0: h('span'), t1: h('span'),
      open: h('button', 'f openbtn'), alt: h('button', 'f openbtn alt'), main: ctl('pause', 'toggle', 'main'), shuf: ctl('shuffle', 'shuffle', 'sm'), rep: ctl('repeat', 'repeat', 'sm'), heart: ctl('heart', 'heart', 'heart')};
    t.appendChild(p.h3); t.appendChild(p.ar); t.appendChild(p.dv);
    [p.shuf, ctl('prev', 'prev'), p.main, ctl('next', 'next'), p.rep].forEach(function (b) { ctls.appendChild(b); });
    p.open.appendChild(icon('play')); p.open.appendChild(document.createTextNode('Resume')); p.alt.appendChild(icon('speaker')); p.alt.appendChild(document.createTextNode('')); p.alt.hidden = true;
    bar.appendChild(p.bar); tm.appendChild(p.t0); tm.appendChild(p.t1);
    [p.cover, eq, t, p.heart, ctls, p.open, p.alt, bar, tm].forEach(function (e) { c.appendChild(e); }); d.appendChild(c); d._p = p; return d;
  }
  function fillNp(d) {
    var p = d._p, st = sp.state; if (!p) return; d.classList.toggle('idle', !st);
    if (!st) {
      var l = S.last, od = otherDev(); d.classList.toggle('haslast', !!l); spDevRefresh();
      p.h3.textContent = l ? l.title : 'Nothing playing'; p.ar.textContent = l ? l.artist : 'Pick a playlist to start.';
      p.dv.textContent = l ? 'Stopped' + (l.at ? ' · ' + ago(l.at) : '') : (spUsesNative() ? 'Plays in the TV’s Spotify app' : '');
      p.cover.style.backgroundImage = l && l.cover ? 'url(' + l.cover + ')' : ''; p.cin.style.backgroundImage = l && l.cover ? 'linear-gradient(rgba(9,11,13,.82),rgba(9,11,13,.94)), url(' + l.cover + ')' : '';
      if (l && l.dur) { p.bar.style.transform = 'scaleX(' + Math.min(1, l.pos / l.dur) + ')'; p.t0.textContent = mmss(l.pos); p.t1.textContent = mmss(l.dur); }
      p.open.lastChild.textContent = l ? 'Resume in Spotify' : 'Play in Spotify'; p.open.onclick = function () { snd('open'); spResume(); };
      p.alt.hidden = !(l && od); if (l && od) { p.alt.lastChild.textContent = 'Play on ' + (od.type === 'Computer' ? (/mac/i.test(od.name) ? 'Mac' : 'computer') : od.name.slice(0, 16)); p.alt.onclick = function () { snd('open'); spResumeOn(od); }; }
      return;
    }
    p.cover.style.backgroundImage = st.cover ? 'url(' + st.cover + ')' : ''; p.cin.style.backgroundImage = st.cover ? 'linear-gradient(rgba(9,11,13,.80),rgba(9,11,13,.93)), url(' + st.cover + ')' : '';
    p.h3.textContent = st.title; p.ar.textContent = st.artist; p.dv.textContent = st.device ? 'on ' + st.device : '';
    p.eq.className = 'eq' + (st.playing ? ' on' : ''); p.main.firstChild.firstChild.setAttribute('href', '#i-' + (st.playing ? 'pause' : 'play'));
    p.shuf.classList.toggle('on', !!st.shuffle); p.rep.classList.toggle('on', st.repeat && st.repeat !== 'off'); p.rep.classList.toggle('rt1', st.repeat === 'track'); p.heart.classList.toggle('on', !!sp.liked); spTick();
  }
  function spTick() {
    var st = sp.state; if (!st) return; var pr = Math.min(st.dur, st.prog + (st.playing ? Date.now() - sp.t : 0));
    [].forEach.call(document.querySelectorAll('.np'), function (d) { var p = d._p; if (!p) return; p.bar.style.transform = 'scaleX(' + (st.dur ? pr / st.dur : 0) + ')'; p.t0.textContent = mmss(pr); p.t1.textContent = mmss(st.dur); });
  }
  function spPaint() {
    var st = sp.state, has = !!st, pill = $('np-pill'), changed = has !== sp.shown; sp.shown = has;
    if (has) { $('np-txt').textContent = st.title + ' · ' + st.artist; $('np-th').style.backgroundImage = st.cover ? 'url(' + st.cover + ')' : ''; $('np-eq').className = 'eq' + (st.playing ? ' on' : ''); pill.hidden = false; if (!pill.classList.contains('show')) requestAnimationFrame(function () { requestAnimationFrame(function () { pill.classList.add('show'); }); }); }
    else if (!pill.hidden) { pill.classList.remove('show'); setTimeout(function () { if (!sp.state) pill.hidden = true; }, 700); }
    $('a-np').hidden = !has; if (has) { $('a-th').style.backgroundImage = st.cover ? 'url(' + st.cover + ')' : ''; $('a-t1').textContent = st.title; $('a-t2').textContent = st.artist; $('a-np').firstChild.nextSibling.firstChild.textContent = st.playing ? 'Now playing' : 'Paused'; }
    if (changed && (view === 'home' || view === 'music')) { var inShelf = cur && track.contains(cur); render(); if (inShelf) setFocus(first('.card, .act, .ctl')); }
    else [].forEach.call(document.querySelectorAll('.np'), fillNp);
  }
  function spCtl(k) {
    var st = sp.state; if (!st) return;
    if (k === 'heart') { if (!st.id) return; var on = !sp.liked; sp.liked = on; spPaint(); spApi(on ? 'PUT' : 'DELETE', '/me/library?uris=' + encodeURIComponent(st.uri)).then(function () { toast(on ? 'Added to Liked Songs' : 'Removed from Liked Songs'); }, function (e) { sp.liked = !on; spPaint(); toast(e.message === 'premium' ? 'Run npm run spotify again to allow saving songs' : 'Spotify: ' + e.message); }); return; }
    if (k === 'shuffle') { st.shuffle = !st.shuffle; spPaint(); return spApi('PUT', '/me/player/shuffle?state=' + st.shuffle).then(function () { setTimeout(spPoll, 500); }, spFail); }
    if (k === 'repeat') { st.repeat = st.repeat === 'off' ? 'context' : st.repeat === 'context' ? 'track' : 'off'; spPaint(); return spApi('PUT', '/me/player/repeat?state=' + st.repeat).then(function () { setTimeout(spPoll, 500); }, spFail); }
    if (k === 'toggle') { st.prog = Math.min(st.dur, st.prog + (st.playing ? Date.now() - sp.t : 0)); sp.t = Date.now(); st.playing = !st.playing; spPaint(); }
    if (spUsesNative() && isTvDev({type: st.deviceType, name: st.device})) return spTvJob(null, k === 'toggle' ? (st.playing ? 'play' : 'pause') : k === 'next' ? 'next' : 'previous').catch(spFail);
    return spApi(k === 'toggle' ? 'PUT' : 'POST', k === 'toggle' ? (st.playing ? '/me/player/play' : '/me/player/pause') : k === 'next' ? '/me/player/next' : '/me/player/previous').then(function () { setTimeout(spPoll, 500); }, spFail);
  }
  function isTvDev(d) { return d.type === 'TV' || /webos|\blg\b/i.test(d.name || ''); }
  function spRefresh() { return S.spRefresh || (sp.cfg && sp.cfg.refreshToken); }
  function spTvJob(body, action) {
    return call(SVC + 'playOnTv', {clientId: sp.cfg.clientId, refreshToken: spRefresh(), body: body, action: action || 'play', openApp: true, transferOnly: action === 'transfer'}).then(function (m) {
      if (!m.returnValue) throw new Error(m.errorText || 'the TV service is not running');
      toast('Opening Spotify on the TV…');
    });
  }
  function spPlayTvApp(body) { // fallback when the in-dashboard player is unavailable: the TV's own Spotify app (started by the on-TV service if needed)
    if (spUsesNative()) return spTvJob(body);
    return spApi('GET', '/me/player/devices').then(function (d) {
      var tvd = ((d && d.devices) || []).filter(isTvDev)[0];
      if (tvd) return spApi('PUT', '/me/player/play' + (tvd.is_active ? '' : '?device_id=' + encodeURIComponent(tvd.id)), body).then(function () { toast('Playing on the TV'); setTimeout(spPoll, 700); });
      return call(SVC + 'playOnTv', {clientId: sp.cfg.clientId, refreshToken: spRefresh(), body: body}).then(function (m) { if (!m.returnValue) throw new Error(m.errorText || 'the TV service is not running'); toast('Starting Spotify on the TV…'); });
    });
  }
  function spPlay(body) {
    if (spUsesNative()) return spPlayTvApp(body).catch(spFail);
    return spWhenReady(6000).then(function (id) {
      if (id) return spApi('PUT', '/me/player/play?device_id=' + encodeURIComponent(id), body).then(function () { toast('Playing on this TV'); setTimeout(spPoll, 700); });
      return spPlayTvApp(body);
    }).catch(spFail);
  }
  function spLoadPlaylists() {
    if (sp.mock) return; var had = sp.playlists; if (!had) sp.playlists = [];
    spApi('GET', '/me/playlists?limit=50').then(function (j) { sp.playlists = ((j && j.items) || []).filter(Boolean).map(function (p) { return {name: p.name, cover: cover(p.images), count: p.tracks && p.tracks.total, uri: p.uri}; }); sp.plNext = 0; if (view === 'music') render(); },
      function (e) { if (!had) { sp.playlists = null; sp.plNext = Date.now() + 30000; if (view === 'music') render(); } spFail(e); });
  }
  function glyphCard(title, sub, art, color, ic, fn) {
    var d = h('div', 'card f'), c = h('div', 'cin'), g = h('div', 'ico glyph'); d.style.setProperty('--c', color); c.style.backgroundImage = 'url(art/' + art + '.jpg)'; g.appendChild(icon(ic)); c.appendChild(g); c.appendChild(h('h3', '', title)); c.appendChild(h('p', '', sub)); d.appendChild(c); d.onclick = fn; return d;
  }
  function deviceCard() {
    return glyphCard(sp.state && sp.state.device || 'Play on…', 'Choose where music plays', 'spotify-beehive', '30,215,96', 'tv', openDev);
  }
  function likedCard() { return glyphCard('Liked Songs', 'Play your saved songs', 'liked', '110,80,235', 'star', spLiked); }
  function plCard(pl) {
    var d = h('div', 'card f pl'), c = h('div', 'cin'); d.style.setProperty('--c', '30,215,96'); if (pl.cover) c.style.backgroundImage = 'url(' + pl.cover + ')';
    c.appendChild(h('div', 'shade')); c.appendChild(h('h3', '', pl.name)); c.appendChild(h('p', '', pl.count != null ? pl.count + ' songs' : 'Playlist')); d.appendChild(c); d.onclick = function () { spPlay({context_uri: pl.uri}); }; return d;
  }
  function setupCard(expired) {
    var d = h('div', 'empty setup'); d.appendChild(h('b', '', expired ? 'Reconnect Spotify' : 'Connect Spotify'));
    (expired ? [['', 'Your Spotify sign-in expired.'], ['1', 'On your Mac run  npm run spotify -- <Client ID>'], ['2', 'Then run  npm run deploy']] : [['1', 'Create a free app at developer.spotify.com/dashboard, with redirect URI http://127.0.0.1:8888/callback'], ['2', 'On your Mac run  npm run spotify -- <Client ID>'], ['3', 'Then run  npm run deploy']]).forEach(function (s) { var p = h('div', '', (s[0] ? s[0] + '   ' : '') + s[1]); p.style.fontSize = '22px'; p.style.lineHeight = '1.35'; p.style.marginBottom = '6px'; d.appendChild(p); });
    return d;
  }
  var DT = {Computer: 'Computer', Smartphone: 'Phone', Speaker: 'Speaker', TV: 'TV', AVR: 'Receiver', CastAudio: 'Cast speaker', CastVideo: 'Chromecast', GameConsole: 'Console', Tablet: 'Tablet'}, dev = {list: []};
  function openDev() { snd('panel'); opener = cur; dev.list = sp.devices || []; $('dev').hidden = false; paintDev(); setFocus($('dev').querySelector('[data-k]') || $('dv-close')); devLoad(); }
  function devLoad() { spApi('GET', '/me/player/devices').then(function (d) { dev.list = (d && d.devices) || []; sp.devices = dev.list; paintDev(); }, spFail); }
  function paintDev() {
    if ($('dev').hidden) return; var L = $('dv-list'), keep = cur && $('dev').contains(cur) ? cur.getAttribute('data-k') : null; L.innerHTML = '';
    var rank = function (d) { return d.id === sp.dev.id ? 0 : isTvDev(d) ? 1 : 2; }, list = dev.list.slice().sort(function (a, b) { return rank(a) - rank(b); });
    list.forEach(function (d) { L.appendChild(spkRow(d.name, d.is_active ? 'Playing here' : d.id === sp.dev.id ? 'This dashboard' : isTvDev(d) ? 'TV Spotify app' : DT[d.type] || d.type, d.is_active, d.is_active ? 'Active' : 'Play here', 'd' + d.id, function () { if (!d.is_active) devMove(d); })); });
    if (!list.some(isTvDev) && !sp.dev.ready) L.appendChild(spkRow('This TV', 'Spotify is not open', false, 'Open Spotify', 'dtv', function () { snd('open'); toast('Opening Spotify on the TV…'); launch('spotify-beehive', 'Spotify'); }));
    $('dv-hint').textContent = spUsesNative() ? 'On this TV music plays in the Spotify app and stops when you leave it (a TV limit). Choose your phone or Mac to keep music playing while you use the dashboard.' : sp.dev.ready ? 'Playlists you start here play on this TV (Lumen TV) and keep going while you browse. Cast from your phone to Lumen TV any time.' : 'Starting the in-dashboard player…';
    if (keep) { var again = $('dev').querySelector('[data-k="' + keep + '"]'); if (again && again !== cur) setFocus(again); }
  }
  function devMove(d) { if (spUsesNative() && isTvDev(d)) return spTvJob(null, 'transfer').catch(spFail); spApi('PUT', '/me/player', {device_ids: [d.id], play: !!(sp.state && sp.state.playing)}).then(function () { toast('Playing on ' + d.name); setTimeout(function () { devLoad(); spPoll(); }, 900); }, spFail); }
  window.__sp = {feed: function (st, pls) { sp.mock = true; sp.state = st; sp.liked = !!(st && st.liked); sp.t = Date.now(); sp.playlists = pls || sp.playlists || []; spPaint(); if (view === 'music') render(); }}; // test hook: show the UI with sample data

  /* ---------- shelf views ---------- */
  var view = 'home', track = $('track'), shift = 0;
  function toggleFav(a) {
    var i = S.favs.indexOf(a.id); if (i >= 0) S.favs.splice(i, 1); else S.favs.push(a.id); save();
    toast(isFav(a.id) ? a.title + ' added to Favorites' : a.title + ' removed from Favorites');
    if (view === 'fav') { render(); setFocus(first('.card')); } else hint();
  }
  function appCard(a) {
    var d = h('div', 'card f'), c = h('div', 'cin'); d._app = a; d.style.setProperty('--c', a.color); c.style.backgroundImage = 'url(' + a.art + ')';
    if (a.icon) { var im = h('img', 'ico'); im.src = a.icon; im.alt = ''; c.appendChild(im); }
    c.appendChild(h('h3', '', a.title)); c.appendChild(h('p', '', VERB[a.id] || 'Open')); d.appendChild(c);
    d.onclick = function () { open(a); };
    return d;
  }
  function empty(title, text) { var d = h('div', 'empty'), pb = h('span', 'pb'); pb.appendChild(icon('play')); d.appendChild(pb); d.appendChild(h('b', '', title)); d.appendChild(document.createTextNode(text)); return d; }

  function ago(t) {
    var m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago';
  }
  function recent() { // most recent distinct apps that still exist
    var seen = [], out = [];
    for (var i = S.hist.length - 1; i >= 0; i--) { var e = S.hist[i]; if (seen.indexOf(e.id) < 0 && byId(e.id)) { seen.push(e.id); out.push({app: byId(e.id), t: e.t}); } }
    return out;
  }
  function continueCard() {
    var r = recent(); if (!r.length) return empty('Nothing to continue yet', 'Open an app and it will show up here.');
    var a = r[0].app, n = S.hist.filter(function (e) { return e.id === a.id; }).length;
    var d = h('div', 'card cont'), c = h('div', 'cin'); d.style.setProperty('--c', a.color); c.style.backgroundImage = 'url(' + a.art + ')';
    if (a.icon) { var im = h('img', 'ico'); im.src = a.icon; im.alt = ''; c.appendChild(im); }
    c.appendChild(h('h3', '', a.title));
    c.appendChild(h('div', 'meta', 'Opened ' + ago(r[0].t) + ' · ' + n + (n === 1 ? ' time' : ' times')));
    function act(ic, text, fn) { var b = h('button', 'f act'); b.appendChild(icon(ic)); b.appendChild(document.createTextNode(text)); b.onclick = fn; c.appendChild(b); }
    act('play', 'Open ' + a.title, function () { open(a); });
    if (r[1]) act('redo', 'Open ' + r[1].app.title + ' instead', function () { open(r[1].app); });
    act('x', 'Remove from Continue', function () { S.hist = S.hist.filter(function (e) { return e.id !== a.id; }); save(); render(); setFocus(first('.card, .act') || $('go')); });
    d.appendChild(c); return d;
  }
  function statCard(title, color, art) {
    var d = h('div', 'card stat f'), c = h('div', 'cin'); d.style.setProperty('--c', color); c.style.backgroundImage = 'url(art/' + art + '.jpg)'; c.appendChild(h('h4', '', title)); d.appendChild(c); d._c = c; return d;
  }
  function countUp(el, to) { var n = 0, steps = 22; if (!to) { el.textContent = '0'; return; } var iv = setInterval(function () { n++; el.textContent = String(Math.round(to * (1 - Math.pow(1 - n / steps, 3)))); if (n >= steps) clearInterval(iv); }, 32); }
  function bars(cls, vals, labels, w, step, hot, max) {
    var box = h('div', 'wk ' + cls), m = Math.max.apply(null, vals.concat([1]));
    vals.forEach(function (n, i) {
      var u = h('u', i === hot ? 'now' : ''), em = h('em', '', labels[i]); u.style.left = i * step + 'px'; u.style.width = w + 'px'; u.style.height = (n ? Math.max(8, Math.round((max || 100) * n / m)) : 4) + 'px'; u.style.animationDelay = (i * 70) + 'ms';
      em.style.left = (i * step - 8) + 'px'; em.style.width = (w + 16) + 'px'; box.appendChild(u); box.appendChild(em);
    });
    return box;
  }
  function statCards() {
    var counts = {}, days = [0, 0, 0, 0, 0, 0, 0], hrs = [0, 0, 0, 0, 0, 0, 0, 0], total = 0, today = new Date(); today.setHours(0, 0, 0, 0);
    S.hist.forEach(function (e) {
      counts[e.id] = (counts[e.id] || 0) + 1; var dd = Math.floor((today.getTime() - new Date(e.t).setHours(0, 0, 0, 0)) / 864e5);
      if (dd >= 0 && dd < 7) { days[6 - dd]++; total++; hrs[Math.floor(new Date(e.t).getHours() / 3)]++; }
    });
    var dl = days.map(function (n, i) { return new Date(today.getTime() - (6 - i) * 864e5).toLocaleDateString('en-US', {weekday: 'narrow'}); });
    var c1 = statCard('This week', '255,120,70', 'stat-week'), big = h('div', 'big', '0');
    c1._c.appendChild(big); c1._c.appendChild(h('div', 'cap', total ? (total === 1 ? 'open in the last 7 days' : 'opens in the last 7 days') : 'Fills in as you use the TV')); c1._c.appendChild(bars('days', days, dl, 38, 56, 6, 64)); setTimeout(function () { countUp(big, total); }, 250);
    var c2 = statCard('Most opened', '90,140,255', 'stat-top'), top = Object.keys(counts).filter(byId).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 4), mx = top.length ? counts[top[0]] : 1;
    if (!top.length) c2._c.appendChild(h('div', 'cap', 'Open an app and it ranks here'));
    top.forEach(function (id, i) {
      var a = byId(id), r = h('div', 'rk'), m = h('div', 'rm'), bar = h('div', 'rb'), f = h('i');
      if (a.icon) { var im = h('img'); im.src = a.icon; im.alt = ''; r.appendChild(im); }
      f.style.background = 'rgb(' + a.color + ')'; f.style.transform = 'scaleX(' + (counts[id] / mx) + ')'; f.style.animationDelay = (i * 90) + 'ms'; bar.appendChild(f);
      m.appendChild(h('div', 'rn', a.title)); m.appendChild(bar); r.appendChild(m); r.appendChild(h('div', 'rc', String(counts[id]))); c2._c.appendChild(r);
    });
    var PART = ['late at night', 'early mornings', 'mornings', 'late mornings', 'early afternoons', 'afternoons', 'evenings', 'late evenings'], pk = hrs.indexOf(Math.max.apply(null, hrs));
    var c3 = statCard('When you watch', '160,100,255', 'stat-when'); c3._c.appendChild(h('div', 'cap', total ? 'Mostly ' + PART[pk] : 'Fills in as you use the TV'));
    c3._c.appendChild(bars('hrs', hrs, ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'], 34, 46, total ? pk : -1, 120));
    var c4 = statCard('This TV', '48,200,110', 'input-on'), info = {}, kv = h('div', 'kv'); try { info = JSON.parse(window.PalmSystem.deviceInfo); } catch (e) { /* not on a TV */ }
    [['Model', info.modelName || '--'], ['Screen', info.screenWidth ? info.screenWidth + ' × ' + info.screenHeight : '--'], ['webOS build', info.platformVersion || '--'], ['Sound', outLabel()], ['Spotify', spOn() ? (sp.state ? 'Playing' : 'Connected') : 'Not connected'], ['Apps', String(apps.length)]].forEach(function (p) {
      var r = h('div'); r.appendChild(h('span', '', p[0])); r.appendChild(h('b', '', p[1])); kv.appendChild(r);
    });
    c4._c.appendChild(kv); return [c1, c2, c3, c4];
  }
  function stagger(dir) { [].forEach.call(track.children, function (c, i) { c.classList.add(dir ? 'slide' : 'rise'); if (dir) c.style.setProperty('--dx', dir * 90 + 'px'); c.style.animationDelay = (i * 55) + 'ms'; }); }
  function render(dir) {
    track.innerHTML = ''; shift = 0; track.style.transform = ''; cur = cur && document.body.contains(cur) ? cur : null; curCard = null;
    $('nav').style.setProperty('--ta', TAB_RGB[view] || '255,255,255'); var pill = $('navpill'), sb = document.querySelector('.navbtn[data-view="' + view + '"]'); if (sb) pill.style.transform = 'translateX(' + sb.offsetLeft + 'px)'; if (dir) { pill.classList.remove('go'); void pill.offsetWidth; pill.classList.add('go'); }
    [].forEach.call(document.querySelectorAll('.navbtn'), function (b) { b.classList.toggle('sel', b.getAttribute('data-view') === view); });
    var list, count = '';
    if (view === 'home') { S.favs.map(byId).filter(Boolean).slice(0, 2).forEach(function (a) { track.appendChild(appCard(a)); }); track.appendChild(spOn() && sp.state ? npCard() : continueCard()); }
    else if (view === 'music') {
      if (!spOn() || sp.authFail) track.appendChild(setupCard(sp.authFail));
      else { track.appendChild(npCard()); track.appendChild(deviceCard()); track.appendChild(likedCard()); (sp.playlists || []).forEach(function (pl) { track.appendChild(plCard(pl)); }); if (sp.playlists === null) { if (Date.now() > (sp.plNext || 0)) spLoadPlaylists(); else track.appendChild(empty('Playlists unavailable', 'Spotify did not answer. Retrying shortly.')); } }
    }
    else if (view === 'stats') statCards().forEach(function (c) { track.appendChild(c); });
    else if (view === 'inputs') {
      track.appendChild(inputCard('Live TV', 'Antenna / cable', 'live', false, function () { toast('Opening Live TV'); launch('com.webos.app.livetv', 'Live TV'); }));
      if (inputs === null) { loadInputs(); track.appendChild(empty('Reading inputs', 'Asking the TV which inputs have a signal.')); }
      else inputs.forEach(function (d) { track.appendChild(inputCard(d.label, d.connected ? 'Connected' : 'No signal', d.connected ? 'input-on' : 'input-off', d.connected, function () { toast('Switching to ' + d.label); req('ssap://tv/switchInput', {inputId: d.id}).catch(fail('Input')); })); });
    } else {
      list = view === 'tv' ? apps : S.favs.map(byId).filter(Boolean);
      count = list.length ? String(list.length) : '';
      if (!list.length) track.appendChild(view === 'tv' ? empty('No apps yet', 'Run  npm run sync  on your computer to list this TV’s apps here.') : empty('No favorites yet', 'Hold OK on any app in Smart TV to add it here.'));
      list.forEach(function (a) { track.appendChild(appCard(a)); });
    }
    $('sh-title').textContent = TITLES[view]; if (count) $('sh-title').appendChild(h('small', '', count));
    stagger(dir); [].forEach.call(track.querySelectorAll('.np'), fillNp); hint();
  }
  var TAB_RGB = {home: '170,200,255', tv: '90,150,255', inputs: '48,200,110', music: '30,215,96', fav: '255,196,70', stats: '255,120,70'}, swapT = 0;
  function setView(v) { // cards leave in the direction of travel, a light sweep crosses the shelf, the new cards arrive from the same side
    if (v === view) return; var dir = ORDER.indexOf(v) > ORDER.indexOf(view) ? 1 : -1; snd('tab', ORDER.indexOf(v)); view = v; clearTimeout(swapT);
    $('nav').style.setProperty('--ta', TAB_RGB[v] || '255,255,255');
    var sw = $('sweep'); sw.className = ''; void sw.offsetWidth; sw.className = dir > 0 ? 'go r' : 'go l';
    [].forEach.call(track.children, function (c, i) { c.style.animation = 'none'; c.style.transitionDelay = (i * 28) + 'ms'; c.classList.add(dir > 0 ? 'xl' : 'xr'); });
    var t = $('sh-title'); t.classList.remove('titlein'); t.classList.add('titleout');
    swapT = setTimeout(function () { render(dir); t.classList.remove('titleout'); void t.offsetWidth; t.classList.add('titlein'); }, 230);
  }
  function hint() {
    var a = cur && cur._app; $('sh-hint').textContent = a && cur.classList.contains('card') ? (isFav(a.id) ? 'Hold OK to remove from Favorites' : 'Hold OK to add to Favorites') : '';
  }

  /* ---------- spatial focus (D-pad) + Magic Remote hover ---------- */
  var cur = null, curCard = null, lastShelf = null, tabT = 0;
  function vis(e) { return e.offsetParent !== null; }
  function openP() { return !$('panel').hidden ? $('panel') : !$('ctl').hidden ? $('ctl') : !$('snd').hidden ? $('snd') : !$('dev').hidden ? $('dev') : null; }
  function pool() { var root = openP() || document; return [].filter.call(root.querySelectorAll('.f'), vis); }
  function first(sel) { var e = document.querySelector(sel); return e && vis(e) ? e : null; }
  function setFocus(e, viaKey) {
    if (!e) return;
    if (cur) cur.classList.remove('foc'); if (curCard) curCard.classList.remove('foc');
    cur = e; e.classList.add('foc'); curCard = e.closest ? e.closest('.card') : null; if (curCard) curCard.classList.add('foc');
    var c = e.closest ? e.closest('.card, .stat') : null;
    if (c && track.contains(c)) { // keep the focused card inside the shelf
      lastShelf = e; var l = c.offsetLeft, r = l + c.offsetWidth;
      if (r - shift > 1400) shift = r - 1400; if (l - shift < 40) shift = Math.max(0, l - 40);
      track.style.transform = 'translateX(' + (-shift) + 'px)';
    }
    if (viaKey && e.classList.contains('navbtn')) { clearTimeout(tabT); tabT = setTimeout(function () { setView(e.getAttribute('data-view')); }, 240); } // focus a tab to preview it
    hint();
  }
  function centre(e) { var r = e.getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; }
  function move(dx, dy) {
    if (!openP()) { // predictable vertical routing between the tab row and the shelf
      if (dy < 0 && cur && track.contains(cur)) { var s = document.querySelector('.navbtn.sel'); if (s) return setFocus(s, true); }
      if (dy > 0 && cur && cur.classList.contains('navbtn')) { var t = lastShelf && document.body.contains(lastShelf) && vis(lastShelf) ? lastShelf : first('.card, .act'); if (t) return setFocus(t, true); }
    }
    var a = centre(cur), best = null, bs = 1e9;
    pool().forEach(function (e) {
      if (e === cur) return; var b = centre(e), px = (b.x - a.x) * dx + (b.y - a.y) * dy, sx = Math.abs((b.x - a.x) * dy) + Math.abs((b.y - a.y) * dx);
      if (px < 6) return; var s2 = px + sx * 2.4; if (s2 < bs) { bs = s2; best = e; }
    });
    if (best) setFocus(best, true);
  }
  function activate(el) { var c = el.classList.contains('card') ? el : null; if (c) { c.classList.add('press'); setTimeout(function () { c.classList.remove('press'); }, 150); } el.click(); }

  /* ---------- clock screen after idle; any key or pointer movement wakes it ---------- */
  var idleT = 0, asleep = false, lastMove = 0;
  function wake() { asleep = false; document.body.classList.remove('ambient'); }
  function sleep() { if (openP() || (document.activeElement && document.activeElement.tagName === 'INPUT')) return bump(); asleep = true; document.body.classList.add('ambient'); }
  function bump() { clearTimeout(idleT); if (S.idle) idleT = setTimeout(sleep, S.idle * 1000); }
  document.addEventListener('mousemove', function () { var n = Date.now(); if (n - lastMove < 800) return; lastMove = n; if (asleep) wake(); bump(); });
  document.addEventListener('click', function () { if (asleep) wake(); bump(); });

  var mp = {x: -9, y: -9};
  document.addEventListener('mouseover', function (e) { // a real pointer move only: a stationary pointer must not steal focus when the content re-renders under it
    var moved = Math.abs(e.clientX - mp.x) + Math.abs(e.clientY - mp.y) > 3; mp.x = e.clientX; mp.y = e.clientY; if (!moved) return;
    var f = e.target.closest ? e.target.closest('.f') : null, p = openP(); if (f && vis(f) && (!p || p.contains(f))) setFocus(f);
  });
  var held = false, holdT = 0, held2 = false, lastOK = 0;
  document.addEventListener('keydown', function (e) {
    var k = e.keyCode, typing = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (asleep) { wake(); bump(); e.preventDefault(); return; } // the first key only wakes the screen
    bump();
    if (sp.state && !typing && (k === 415 || k === 19 || k === 417 || k === 412)) { spCtl(k === 417 ? 'next' : k === 412 ? 'prev' : 'toggle'); e.preventDefault(); return; } // remote's play/pause/skip keys
    if (typing) {
      if (k === 13) { if (document.activeElement.id === 'q') search(); document.activeElement.blur(); e.preventDefault(); return; }
      if (k === 461 || k === 27 || k === 38 || k === 40) { document.activeElement.blur(); if (k === 461 || k === 27) { e.preventDefault(); return; } } else return; // left/right/chars go to the field
    }
    if ((k === 37 || k === 39) && cur && cur._adj) { cur._adj(k === 37 ? -1 : 1); e.preventDefault(); return; }
    if (k === 37) move(-1, 0); else if (k === 39) move(1, 0); else if (k === 38) move(0, -1); else if (k === 40) move(0, 1);
    else if (k === 13) {
      var nowOK = Date.now(); if (held && nowOK - lastOK > 700) held = false; lastOK = nowOK; // a lost key-up must not leave OK stuck
      if (cur && cur.tagName === 'INPUT') { cur.focus(); cur.click(); }
      else if (cur && cur._app && cur.classList.contains('card')) { // OK opens; holding OK toggles the favourite
        if (!held) { held = true; held2 = false; holdT = setTimeout(function () { held2 = true; toggleFav(cur._app); }, 650); }
      } else if (cur) activate(cur);
    }
    else if (k === 461) { if (openP()) closePanel(); else if (view !== 'home') { setView('home'); setFocus(first('.navbtn.sel'), false); } else return; }
    else return;
    e.preventDefault();
  });
  document.addEventListener('keyup', function (e) {
    if (e.keyCode !== 13 || !held) return; held = false; clearTimeout(holdT);
    if (!held2 && cur && cur._app) activate(cur);
  });

  /* ---------- chrome: nav, chips, search, top bar ---------- */
  [].forEach.call(document.querySelectorAll('.navbtn'), function (b) { b.onclick = function () { clearTimeout(tabT); setView(b.getAttribute('data-view')); setFocus(b); }; });
  CHIPS.forEach(function (c) { var b = h('button', 'chip f', c); b.appendChild(icon('search')); b.onclick = function () { search(c); }; $('chips').appendChild(b); });
  $('go').onclick = function () { search(); };
  $('b-exit').onclick = function () { // pause the Home-button redirect first, or the service would bounce straight back here
    function go() { toast('Opening LG home'); launch('com.webos.app.home', 'LG home'); }
    call(SVC + 'pause', {ms: 90000}).then(go, go);
  };
  function paintUser() { $('uname').textContent = S.name || 'Settings'; $('avatar').textContent = (S.name || 'L').charAt(0).toUpperCase(); }
  function paintSearch() { $('q').placeholder = 'Search ' + ENGINES[S.engine].n; }
  $('user').onclick = openPanel; $('b-ctl').onclick = openCtl; $('b-snd').onclick = openSnd; $('np-pill').onclick = function () { setView('music'); setFocus(first('.navbtn.sel')); };

  /* ---------- settings panel ---------- */
  function sceneLabel(k) { return k.charAt(0).toUpperCase() + k.slice(1); }
  function paintPanel() {
    $('s-name').value = S.name; $('s-city').value = S.city;
    $('s-clock').textContent = S.hour12 ? '12-hour' : '24-hour'; $('s-unit').textContent = S.unit === 'C' ? 'Celsius' : 'Fahrenheit';
    $('s-wall').textContent = S.wall === 'auto' ? 'Auto: ' + sceneLabel(sceneFor()) : sceneLabel(S.wall);
    $('s-live').textContent = S.live ? 'On' : 'Off'; $('s-sounds').textContent = S.sounds ? 'On' : 'Off'; $('s-idle').textContent = S.idle ? S.idle / 60 + (S.idle === 60 ? ' minute' : ' minutes') : 'Off';
    $('s-home').textContent = S.homeBtn ? 'Return to dashboard' : 'Show LG launcher'; $('s-engine').textContent = ENGINES[S.engine].n;
    $('s-sess').textContent = S.sess ? 'Renewed ' + ago(S.sess) + ', keeps this app installed' : 'Not renewed yet';
  }
  var opener = null;
  function openPanel() { snd('panel'); paintPanel(); opener = cur; $('panel').hidden = false; setFocus($('s-name')); }
  function openCtl() { snd('panel'); opener = cur; $('ctl').hidden = false; $('c-mvol').parentNode.hidden = spUsesNative(); paintVol(); paintMVol(); setFocus($('c-vol')); req('ssap://audio/getVolume', {subscribe: true}, volIn).catch(fail('Volume')); }
  function closePanel() { snd('back'); if (bt.scan.on) btStopScan(); $('panel').hidden = true; $('ctl').hidden = true; $('snd').hidden = true; $('dev').hidden = true; setFocus(opener && vis(opener) ? opener : $('b-ctl')); }
  $('s-close').onclick = closePanel;
  $('s-name').oninput = function () { S.name = this.value; save(); paintUser(); tick(); };
  $('s-city').onchange = function () { S.city = this.value.trim(); S.wx = null; save(); weather(); };
  $('s-clock').onclick = function () { S.hour12 = !S.hour12; save(); paintPanel(); tick(); paintWeather(); };
  $('s-unit').onclick = function () { S.unit = S.unit === 'C' ? 'F' : 'C'; save(); paintPanel(); paintWeather(); };
  $('s-wall').onclick = function () { S.wall = WALL_OPTS[(WALL_OPTS.indexOf(S.wall) + 1) % WALL_OPTS.length]; save(); paintPanel(); wallpaper(); };
  $('s-home').onclick = function () { S.homeBtn = !S.homeBtn; save(); paintPanel(); call(SVC + 'enable', {on: S.homeBtn}); toast(S.homeBtn ? 'Home button now returns here (press it twice for the LG launcher)' : 'Home button shows the LG launcher'); };
  $('s-sounds').onclick = function () { S.sounds = !S.sounds; save(); paintPanel(); snd('panel'); };
  $('s-live').onclick = function () { S.live = !S.live; save(); paintPanel(); liveBg(); };
  $('s-idle').onclick = function () { S.idle = IDLE_OPTS[(IDLE_OPTS.indexOf(S.idle) + 1) % IDLE_OPTS.length]; save(); paintPanel(); bump(); };
  $('s-engine').onclick = function () { S.engine = S.engine === 'youtube' ? 'google' : 'youtube'; save(); paintPanel(); paintSearch(); };
  $('s-clear').onclick = function () { S.hist = []; save(); render(); toast('Usage history cleared'); };

  /* ---------- live background: focus glow, floating light, time-of-day wallpaper ---------- */
  (function () { // 22 soft lights, animated purely by CSS transforms (cheapest path on the TV's GPU)
    var box = $('motes');
    for (var i = 0; i < 22; i++) {
      var m = h('i', 'mote'), s = 8 + Math.random() * 20;
      m.style.cssText = 'left:' + Math.round(Math.random() * 1900) + 'px;width:' + s + 'px;height:' + s + 'px;animation-duration:' + (26 + Math.random() * 34).toFixed(1) + 's;animation-delay:-' + (Math.random() * 50).toFixed(1) + 's;--o:' + (.25 + Math.random() * .5).toFixed(2) + ';--sx:' + Math.round((Math.random() - .5) * 160) + 'px';
      box.appendChild(m);
    }
  })();
  function liveBg() { document.body.classList.toggle('still', !S.live); }

  function hours() { var d = new Date(); return d.getHours() + d.getMinutes() / 60; }
  function sceneFor() { // follows the real sunrise and sunset once the weather has loaded
    var t = hours(), r = S.wx && S.wx.rise != null ? S.wx.rise : 6, s = S.wx && S.wx.set != null ? S.wx.set : 18;
    return t >= r - .75 && t < r + 2.25 ? 'dawn' : t >= r + 2.25 && t < s - 1.25 ? 'day' : t >= s - 1.25 && t < s + .75 ? 'dusk' : 'night';
  }
  var wallCur = '', layer = 0;
  function wallpaper() {
    var key = S.wall === 'auto' ? sceneFor() : S.wall; if (key === wallCur) return;
    var im = new Image(); im.onload = function () { // fade to the new scene only once it is decoded
      var nxt = $('bg' + 'AB'.charAt(layer ^ 1)), prv = $('bg' + 'AB'.charAt(layer));
      nxt.style.backgroundImage = 'url(wallpapers/' + SCENES[key] + ')'; nxt.classList.add('on'); prv.classList.remove('on'); layer ^= 1; wallCur = key;
    };
    im.src = 'wallpapers/' + SCENES[key];
  }

  /* ---------- clock, weather, session ---------- */
  function fmtHM(dec) { var hh = Math.floor(dec), mm = Math.round((dec - hh) * 60); if (mm === 60) { hh++; mm = 0; } hh %= 24; return S.hour12 ? ((hh % 12) || 12) + ':' + (mm < 10 ? '0' : '') + mm + ' ' + (hh < 12 ? 'AM' : 'PM') : (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm; }
  function tick() {
    var d = new Date(), t = d.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: S.hour12}), i = t.indexOf(':'), hr = d.getHours();
    var big = t.slice(0, i) + '<i>:</i>' + t.slice(i + 1), date = d.toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'});
    $('clock').innerHTML = big; $('a-time').innerHTML = big; $('date').textContent = date; $('a-date').textContent = date;
    $('greet').textContent = (hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : hr < 21 ? 'Good evening' : 'Good night') + (S.name ? ', ' + S.name : '');
    wallpaper();
  }
  function wxText(c) {
    return c === 0 ? 'Clear' : c === 1 ? 'Mostly clear' : c === 2 ? 'Partly cloudy' : c === 3 ? 'Overcast' : c === 45 || c === 48 ? 'Fog' : c >= 51 && c <= 57 ? 'Drizzle' : c >= 61 && c <= 67 ? 'Rain'
      : c >= 71 && c <= 77 || c === 85 || c === 86 ? 'Snow' : c >= 80 && c <= 82 ? 'Showers' : c >= 95 ? 'Thunderstorm' : '';
  }
  function paintWeather() {
    var w = S.wx; if (!w) return;
    var conv = function (v) { return Math.round(S.unit === 'C' ? v : v * 9 / 5 + 32); }, c = w.code, tmp = conv(w.t) + '°' + S.unit;
    var night = w.rise != null && (hours() < w.rise || hours() >= w.set);
    var kind = c <= 1 ? (night ? 'moon' : 'sun') : c >= 51 && c <= 99 && !(c >= 71 && c <= 77) ? 'rain' : 'cloud';
    $('wx-t').textContent = tmp; $('wx-d').textContent = wxText(c);
    $('wx-i').firstChild.setAttribute('href', '#i-' + kind); $('wx-i').setAttribute('class', kind);
    $('sun').textContent = w.hi != null ? 'H ' + conv(w.hi) + '°  ·  L ' + conv(w.lo) + '°' + (w.set != null ? '  ·  Sunset ' + fmtHM(w.set) : '') : '';
    $('a-wx').textContent = tmp + '  ·  ' + wxText(c) + (w.hi != null ? '  ·  H ' + conv(w.hi) + '°  L ' + conv(w.lo) + '°' : '');
  }
  function json(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function dec(iso) { var p = iso.split('T')[1].split(':'); return +p[0] + (+p[1]) / 60; }
  function weather() {
    paintWeather();
    var loc = S.city
      ? json('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(S.city)).then(function (g) { if (!g.results) throw new Error('city not found'); return g.results[0]; })
      : json('https://ipwho.is/').then(function (g) { if (!g.success) throw new Error('no location'); return {latitude: g.latitude, longitude: g.longitude}; });
    loc.then(function (p) { return json('https://api.open-meteo.com/v1/forecast?current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=1&latitude=' + p.latitude + '&longitude=' + p.longitude); })
      .then(function (r) { S.wx = {t: r.current.temperature_2m, code: r.current.weather_code, hi: r.daily.temperature_2m_max[0], lo: r.daily.temperature_2m_min[0], rise: dec(r.daily.sunrise[0]), set: dec(r.daily.sunset[0])}; save(); paintWeather(); wallpaper(); })
      .catch(function (e) { if (S.city && !S.wx) toast('Weather: ' + e.message); }); // offline or unknown city: keep the last reading
  }
  function keepAlive() { // renew the Developer Mode session so the installed app doesn't expire (about every 50 h otherwise)
    if (!window.DEV_TOKEN || Date.now() - S.sess < 6 * 36e5) return;
    fetch('https://developer.lge.com/secure/ResetDevModeSession.dev?sessionToken=' + window.DEV_TOKEN, {mode: 'no-cors'})
      .then(function () { S.sess = Date.now(); save(); }, function () { /* offline: try again next launch */ });
  }

  /* ---------- coming back (Home button, redirect, relaunch): start fresh on Home ---------- */
  function fresh() {
    wake(); $('panel').hidden = true; $('ctl').hidden = true; $('snd').hidden = true; $('dev').hidden = true; bump(); tick(); spPoll(); btPoll();
    if (view !== 'home') { view = 'home'; render(); }
    setFocus(first('.card, .act') || $('go'));
  }
  document.addEventListener('webOSRelaunch', fresh);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) fresh(); });

  call(SVC + 'start', {}).then(function () { call(SVC + 'enable', {on: S.homeBtn}); }, function () { /* service not installed */ });
  paintUser(); paintSearch(); liveBg(); paintWeather(); tick(); setInterval(tick, 10000); weather(); setInterval(weather, 20 * 60000); keepAlive(); setInterval(keepAlive, 6 * 36e5);
  function boot() { document.body.classList.add('boot'); setTimeout(function () { document.body.classList.remove('boot'); }, 1600); }
  (function intro() { // logo animation on a cold start; skipped when we were open in the last 20 minutes (e.g. Home-button returns)
    var el = $('intro'), skip = Date.now() - (S.lastIntro || 0) < 20 * 60000; S.lastIntro = Date.now(); save();
    if (skip) { el.parentNode.removeChild(el); return boot(); }
    setTimeout(function () { el.classList.add('out'); boot(); setTimeout(function () { el.parentNode.removeChild(el); }, 900); }, 2800);
  })();
  spPoll(); setInterval(spPoll, 5000); setTimeout(spInitPlayer, 1500); setInterval(spInitPlayer, 60000); setInterval(function () { if (spOn() && !sp.mock) spLoadPlaylists(); }, 600000); setInterval(spTick, 1000); btPoll(); setInterval(btPoll, 10000);
  setInterval(function () { if (!$('snd').hidden || bt.list.some(function (x) { return x.connecting; })) btPoll(); }, 2500);
  render(); setFocus(first('.card, .act') || $('go')); bump(); setTimeout(function () { loadInputs(); }, 2500);
  window.__home = {audio: function () { return ac ? ac.state : 'none'; }, apps: apps.length, view: function () { return view; }, sleep: sleep, wake: wake, asleep: function () { return asleep; }, scene: function () { return wallCur; }};
})();
