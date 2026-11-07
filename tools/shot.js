// Screenshot + page state from the app running on the TV, via the ares-inspect debug port.
const [port, out] = [process.argv[2], process.argv[3] || 'shot.png'];
const keys = (process.argv[4] || '').split(',').filter(Boolean); // e.g. 39,39,40
(async () => {
  const list = await (await fetch(`http://localhost:${port}/json`)).json();
  const ws = new WebSocket(list[0].webSocketDebuggerUrl); let id = 0; const wait = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (wait[d.id]) wait[d.id](d.result || d.error); };
  await new Promise(r => ws.onopen = r);
  const send = (method, params = {}) => new Promise(r => { wait[++id] = r; ws.send(JSON.stringify({id, method, params})); });
  for (const k of keys) { await send('Input.dispatchKeyEvent', {type: 'keyDown', windowsVirtualKeyCode: +k, key: 'x'}); await send('Input.dispatchKeyEvent', {type: 'keyUp', windowsVirtualKeyCode: +k}); await new Promise(r => setTimeout(r, 500)); }
  const st = await send('Runtime.evaluate', {returnByValue: true, expression: 'JSON.stringify({view: window.__home && window.__home.view(), scene: window.__home && window.__home.scene(), cards: document.querySelectorAll(".card").length, wx: document.getElementById("wx-t").textContent, clock: document.getElementById("clock").textContent})'});
  console.log(st.result && st.result.value);
  const s = await send('Page.captureScreenshot', {format: 'jpeg', quality: 92});
  require('fs').writeFileSync(out, Buffer.from(s.data, 'base64')); console.log('saved', out); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
