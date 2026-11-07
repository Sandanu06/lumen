#!/usr/bin/env node
// npm run build   -> dist/<id>_<version>_all.ipk  (works on a fresh clone: missing per-user files become harmless empties)
// npm run deploy  -> build, install on the TV registered as "lgtv", and launch it
const fs = require('fs'), path = require('path'), {spawnSync} = require('child_process');
const root = path.join(__dirname, '..'), bin = n => path.join(root, 'node_modules', '.bin', n);
const run = (cmd, args) => { const r = spawnSync(cmd, args, {cwd: root, stdio: 'inherit'}); if (r.status !== 0) { console.error('\n\u2717 ' + path.basename(cmd) + ' failed'); process.exit(r.status || 1); } };
const deploy = process.argv.includes('--deploy');
const hasKey = fs.existsSync(path.join(root, '.lgtv-key'));
if (deploy && !hasKey) { console.error('No TV set up yet. Run:  npm run setup -- --ip <TV IP address>'); process.exit(1); }
run('node', ['tools/stub-config.js']);
run('node', ['tools/prep-service.js'].concat(hasKey ? [] : ['--allow-missing']));
fs.rmSync(path.join(root, 'dist'), {recursive: true, force: true});
run(bin('ares-package'), ['app', 'service', '-o', 'dist']);
const ipk = fs.readdirSync(path.join(root, 'dist')).find(f => f.endsWith('.ipk'));
console.log('\nBuilt dist/' + ipk);
if (deploy) { run(bin('ares-install'), ['-d', 'lgtv', path.join('dist', ipk)]); run(bin('ares-launch'), ['-d', 'lgtv', JSON.parse(fs.readFileSync(path.join(root, 'app/appinfo.json'), 'utf8')).id]); }
