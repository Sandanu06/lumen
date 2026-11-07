// Where is the TV? Order: LUMEN_TV_IP env var, then .lumen.json written by `npm run setup`.
const fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, '..', '..', '.lumen.json');
function read() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return {}; } }
function tvIp() {
  const ip = process.env.LUMEN_TV_IP || read().ip;
  if (!ip) { console.error('No TV address yet. Run:  npm run setup -- --ip <TV IP address>\n(or set LUMEN_TV_IP)'); process.exit(1); }
  return ip;
}
function save(patch) { fs.writeFileSync(FILE, JSON.stringify(Object.assign(read(), patch), null, 2) + '\n'); }
module.exports = {tvIp, read, save, FILE, ROOT: path.join(__dirname, '..', '..')};
