// Runs on the TV (Node 8). Watches the foreground app through the TV's own control API (the luna foreground call is denied to dev services).
// When LG's stock launcher appears it reopens the Home app. Press Home twice within 6 s to reach the real launcher (redirect pauses 2 min).
var Service = require('webos-service'), http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path');
var svc = new Service('com.sandman.home.service');
var HOME = 'com.sandman.home', LG = 'com.webos.app.home';
var cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'tv.json'), 'utf8')); // {key, pairing}, written by tools/prep-service.js
var on = true, last = '', lastRedirect = 0, pausedUntil = 0, sawHome = false, started = false, connected = false, events = [];
function note(m) { events.push(new Date().toISOString().slice(11, 19) + ' ' + m); if (events.length > 40) events.shift(); }

/* minimal WebSocket client (Node 8 has none): text frames only */
function ws(port, onOpen, onText, onClose) {
  var key = crypto.randomBytes(16).toString('base64');
  var req = http.request({host: '127.0.0.1', port: port, headers: {Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': key, 'Sec-WebSocket-Version': '13'}});
  req.on('upgrade', function (res, sock) {
    var buf = Buffer.alloc(0), text = '';
    function send(s, op) {
      var p = Buffer.from(s || ''), mask = crypto.randomBytes(4), n = p.length, h = n < 126 ? Buffer.from([0x80 | (op || 1), 0x80 | n]) : Buffer.from([0x80 | (op || 1), 0x80 | 126, n >> 8, n & 255]);
      var o = Buffer.alloc(n); for (var i = 0; i < n; i++) o[i] = p[i] ^ mask[i % 4]; sock.write(Buffer.concat([h, mask, o]));
    }
    sock.on('data', function (d) {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 2) {
        var op = buf[0] & 15, fin = buf[0] & 128, n = buf[1] & 127, o = 2;
        if (n === 126) { if (buf.length < 4) return; n = buf.readUInt16BE(2); o = 4; } else if (n === 127) { if (buf.length < 10) return; n = buf.readUInt32BE(6); o = 10; }
        if (buf.length < o + n) return;
        var pl = buf.slice(o, o + n); buf = buf.slice(o + n);
        if (op === 8) return sock.end(); if (op === 9) { send(pl.toString(), 10); continue; }
        if (op === 1 || op === 0) { text += pl.toString(); if (fin) { var t = text; text = ''; try { onText(t); } catch (e) { note('msg error ' + e.message); } } }
      }
    });
    sock.on('close', onClose); sock.on('error', function () {});
    onOpen(send);
  });
  req.on('error', function () { onClose(); }); req.end();
}

function connect() {
  ws(3000, function (send) {
    var pl = JSON.parse(JSON.stringify(cfg.pairing)); pl['client-key'] = cfg.key;
    send(JSON.stringify({type: 'register', id: 'reg', payload: pl}));
    connect.send = send;
  }, function (t) {
    var m = JSON.parse(t);
    if (m.type === 'registered') { connected = true; note('connected'); connect.send(JSON.stringify({type: 'subscribe', id: 'fg', uri: 'ssap://com.webos.applicationManager/getForegroundAppInfo'})); }
    else if (m.id === 'fg' && m.payload && m.payload.appId != null) onForeground(m.payload.appId);
  }, function () { if (connected) note('disconnected'); connected = false; last = ''; setTimeout(connect, 3000); });
}
var retries = 0;
function launchHome() { // same call that proved reliable from outside; the in-service luna launch sometimes loses to the launcher re-appearing
  if (connected && connect.send) return connect.send(JSON.stringify({type: 'request', id: 'go' + Date.now(), uri: 'ssap://system.launcher/launch', payload: {id: HOME}}));
  svc.call('luna://com.webos.applicationManager/launch', {id: HOME}, function (r) { if (!r.payload.returnValue) note('launch failed: ' + r.payload.errorText); }); }
function onForeground(id) {
  if (!id) return; // the TV reports an empty app mid-switch
  if (id === HOME) sawHome = true;
  if (id === LG && last !== LG && on && Date.now() > pausedUntil) {
    var now = Date.now(), since = now - lastRedirect;
    if (since < 2500 && retries < 3) { retries++; note('launcher came back: retry ' + retries); setTimeout(launchHome, 700); lastRedirect = now; } // the TV can re-raise the launcher right after we leave it
    else if (sawHome && since < 6000) { pausedUntil = now + 120000; note('double Home: paused 2 min'); } // a deliberate second press once the dashboard was visible
    else { lastRedirect = now; sawHome = false; retries = 0; note('launcher: reopening Home'); launchHome(); }
  }
  last = id;
}
svc.register('start', function (m) { if (!started) { started = true; svc.activityManager.create('keepAlive', function () {}); connect(); } m.respond({returnValue: true, started: started, connected: connected, on: on}); });
svc.register('pause', function (m) { pausedUntil = Date.now() + ((m.payload && m.payload.ms) || 90000); note('paused by the app'); m.respond({returnValue: true}); });
svc.register('enable', function (m) { on = !!m.payload.on; note('redirect ' + (on ? 'on' : 'off')); m.respond({returnValue: true, on: on}); });
svc.register('status', function (m) { m.respond({returnValue: true, started: started, connected: connected, on: on, events: events}); });

/* ---------- Spotify: play on the TV even when its Spotify app is not running yet ----------
   The dashboard is backgrounded as soon as Spotify opens, so this job lives here. Node 8 https only; tokens are never stored. */
var https = require('https');
function jreq(method, host, path, headers, body, cb) {
  var data = body == null ? null : (typeof body === 'string' ? body : JSON.stringify(body)), h = Object.assign({}, headers); if (data) h['Content-Length'] = Buffer.byteLength(data);
  var req = https.request({host: host, path: path, method: method, headers: h}, function (res) {
    var b = ''; res.on('data', function (d) { b += d; }); res.on('end', function () { var j = null; try { j = b ? JSON.parse(b) : null; } catch (e) { /* not json */ } cb(res.statusCode, j); });
  });
  req.on('error', function (e) { cb(0, {error: e.message}); }); req.setTimeout(10000, function () { req.abort(); }); if (data) req.write(data); req.end();
}
function spToken(p, cb) {
  jreq('POST', 'accounts.spotify.com', '/api/token', {'Content-Type': 'application/x-www-form-urlencoded'}, 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(p.refreshToken) + '&client_id=' + encodeURIComponent(p.clientId), function (s, j) { cb(s === 200 && j ? j.access_token : null); });
}
function isTv(d) { return d.type === 'TV' || /webos|\blg\b/i.test(d.name || ''); }
var gen = 0, activePlay = false; // a newer PLAY replaces an older one still waiting for the TV's Spotify app; a pause/next/previous that arrives meanwhile is told Spotify is still opening
svc.register('playOnTv', function (m) {
  var p = m.payload || {}; if (!p.clientId || !p.refreshToken) return m.respond({returnValue: false, errorText: 'Spotify is not set up'});
  var action = p.action || 'play';
  if (['play', 'pause', 'next', 'previous', 'transfer'].indexOf(action) < 0) return m.respond({returnValue: false, errorText: 'Unknown Spotify control'});
  var mustOpen = action === 'play' || action === 'transfer';
  if (!mustOpen && activePlay) return m.respond({returnValue: false, errorText: 'Spotify is still opening. Controls work once it is playing.'});
  var me = ++gen, live = function () { return me === gen; }; m.respond({returnValue: true}); activePlay = mustOpen;
  note('playOnTv ' + action + ': start'); var done = function (msg) { if (live()) activePlay = false; note(msg); };
  spToken(p, function (token) {
    if (!live()) return done('playOnTv ' + action + ': superseded');
    if (!token) return done('playOnTv: sign-in failed');
    var auth = {Authorization: 'Bearer ' + token}, find = function (cb) { jreq('GET', 'api.spotify.com', '/v1/me/player/devices', auth, null, function (s, j) { cb(((j && j.devices) || []).filter(isTv)[0]); }); };
    var go = function (d) {
      if (!live()) return done('playOnTv ' + action + ': superseded');
      var q = '?device_id=' + encodeURIComponent(d.id), json = Object.assign({'Content-Type': 'application/json'}, auth);
      if (p.transferOnly || action === 'transfer') return jreq('PUT', 'api.spotify.com', '/v1/me/player', json, {device_ids: [d.id], play: true}, function (s) { done('moved playback to ' + d.name + ' -> ' + s); });
      jreq(action === 'next' || action === 'previous' ? 'POST' : 'PUT', 'api.spotify.com', '/v1/me/player/' + action + q, json, action === 'play' ? p.body || {} : null, function (s) { done(action + ' on ' + d.name + ' -> ' + s); });
    };
    find(function (d) {
      if (!live()) return done('playOnTv ' + action + ': superseded');
      // Starting music always brings the Spotify app to the front (webOS stops Spotify within seconds of it leaving the foreground); simple controls act directly when the TV is already a device.
      if (d && !mustOpen) return go(d);
      svc.call('luna://com.webos.applicationManager/launch', {id: 'spotify-beehive'}, function (r) { if (!r.payload.returnValue) note('could not open Spotify: ' + r.payload.errorText); });
      var n = 0, busy = false, iv = setInterval(function () {
        if (!live()) { clearInterval(iv); return done('playOnTv ' + action + ': superseded'); }
        if (busy) return; busy = true;
        find(function (d2) {
          busy = false; if (!iv) return;
          if (d2) { clearInterval(iv); iv = null; setTimeout(function () { go(d2); }, 1200); }
          else if (++n >= 30) { clearInterval(iv); iv = null; done('playOnTv: the TV never appeared as a Spotify device'); }
        });
      }, 1500);
    });
  });
});
