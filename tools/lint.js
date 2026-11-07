// Dependency-free checks that matter for this project. Exits non-zero on the first problem class found.
// 1. syntax of every JS file   2. the TV runs Chrome 79: no newer syntax or CSS in app/   3. no secrets or personal files tracked by git
const fs = require('fs'), path = require('path'), {spawnSync} = require('child_process'), root = path.join(__dirname, '..');
let bad = 0; const fail = m => { bad++; console.error('\u2717 ' + m); };
const walk = (d, out = []) => { for (const f of fs.readdirSync(d, {withFileTypes: true})) { if (['node_modules', '.git', 'dist', 'icons', 'art'].includes(f.name)) continue; const p = path.join(d, f.name); f.isDirectory() ? walk(p, out) : out.push(p); } return out; };
const files = walk(root).map(f => path.relative(root, f));

for (const f of files.filter(f => f.endsWith('.js') && !f.startsWith('app/apps.js'))) { const r = spawnSync(process.execPath, ['--check', f], {cwd: root, encoding: 'utf8'}); if (r.status) fail('syntax: ' + f + '\n' + r.stderr); }

// Chrome 79 (webOS 6): these parse fine in Node but break on the TV. Strip comments and strings first so prose does not trip them.
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, "''");
for (const f of ['app/app.js']) {
  const s = strip(fs.readFileSync(path.join(root, f), 'utf8'));
  for (const [re, why] of [[/\?\.(?![0-9])/, 'optional chaining (?.)'], [/\?\?(?!=)/, 'nullish coalescing (??)'], [/\.at\(/, 'Array.prototype.at'], [/structuredClone\(/, 'structuredClone'], [/\.replaceAll\(/, 'String.replaceAll'], [/Object\.hasOwn\(/, 'Object.hasOwn']]) if (re.test(s)) fail(f + ': ' + why + ' is not supported by the TV (Chrome 79)');
}
const css = strip(fs.readFileSync(path.join(root, 'app/style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));
for (const [re, why] of [[/aspect-ratio\s*:/, 'aspect-ratio'], [/(^|[{;\s])inset\s*:/, 'inset'], [/color-mix\(/, 'color-mix()'], [/overflow\s*:\s*clip/, 'overflow:clip'], [/:focus-visible/, ':focus-visible'], [/@container/, '@container'], [/:is\(|:where\(/, ':is()/:where()'], [/\bdisplay\s*:\s*flex[^}]*\bgap\s*:/, 'flex gap']]) if (re.test(css)) fail('app/style.css: ' + why + ' is not supported by the TV (Chrome 79)');

// secrets must never be tracked
const tracked = spawnSync('git', ['ls-files'], {cwd: root, encoding: 'utf8'}).stdout.split('\n').filter(Boolean);
for (const f of tracked) { if (/(^|\/)(session|spotify|apps)\.js$/.test(f) && f.startsWith('app/') && f !== 'app/spotify.js' && f !== 'app/session.js' && f !== 'app/apps.js') continue;
  if (['app/session.js', 'app/spotify.js', 'service/tv.json', '.lgtv-key', '.lumen.json'].includes(f) || /\.lgtv-key/.test(f)) fail('private file is tracked by git: ' + f); }
for (const f of tracked) { if (!/\.(js|json|md|html|css|py|yml|sh)$/.test(f) || !fs.existsSync(path.join(root, f))) continue; const s = fs.readFileSync(path.join(root, f), 'utf8');
  if (/refreshToken\s*[:=]\s*["']AQ[\w-]{40,}/.test(s) || /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s)) fail('possible secret in ' + f); }

console.log(bad ? '\n' + bad + ' problem(s)' : '\u2713 lint ok (' + files.filter(f => f.endsWith('.js')).length + ' JS files, Chrome 79 rules, no tracked secrets)');
process.exit(bad ? 1 : 0);
