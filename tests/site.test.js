// Site check: every file the pages, the service worker and the manifest point to must exist.
// A missing file is what turns a working site into a blank page, and it is easy to miss when
// uploading to GitHub by hand, so this runs with the other tests (and on every push).
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
let n = 0, problems = [];
const t = (name, fn) => { try { fn(); n++; console.log('ok -', name); } catch (e) { problems.push(name + ': ' + e.message); console.log('NOT OK -', name, '\n   ' + e.message); } };
const exists = (rel) => fs.existsSync(path.join(root, rel));
const local = (ref) => ref && !/^(https?:|mailto:|tel:|data:|blob:|#|javascript:)/i.test(ref);
const clean = (ref) => decodeURIComponent(ref.split('#')[0].split('?')[0]);
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const refs = (html) => [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter(local).map(clean).filter(Boolean);

['index.html', 'app.html', 'statement.html'].forEach((page) => {
  t(`${page}: every script, stylesheet, image and link it uses exists`, () => {
    const missing = refs(read(page)).filter((r) => !exists(r));
    assert.deepEqual(missing, [], 'missing: ' + missing.join(', '));
  });
});
t('app.html loads engine.js before the files that use it, and app.js last', () => {
  const order = [...read('app.html').matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  ['audit.js', 'record.js', 'constitution.js', 'engine.js', 'governance.js', 'trust.js', 'meetings.js', 'safeguards.js', 'documents.js', 'design.js'].forEach((f) => assert(order.includes(f), f + ' is not loaded'));
  assert(order.indexOf('engine.js') < order.indexOf('governance.js'), 'engine.js must come before governance.js');
  assert.equal(order[order.length - 1], 'app.js', 'app.js must be the last script');
});
t('the service worker only lists files that exist', () => {
  const list = read('sw.js').match(/const ASSETS = \[([^\]]+)\]/)[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1)).filter((s) => s !== './');
  const missing = list.filter((f) => !exists(f));
  assert.deepEqual(missing, [], 'missing: ' + missing.join(', '));
});
t('every page and script the app needs is in the service worker list (so it works offline)', () => {
  const sw = read('sw.js'), scripts = [...read('app.html').matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  const notCached = ['app.html', 'index.html', 'statement.html', ...scripts].filter((f) => !sw.includes(`"${f}"`));
  assert.deepEqual(notCached, [], 'not cached: ' + notCached.join(', '));
});
t('the manifest and its icons exist', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  const missing = m.icons.map((i) => i.src).filter((f) => !exists(f));
  assert.deepEqual(missing, [], 'missing icons: ' + missing.join(', '));
  assert(exists(clean(m.start_url)), 'start_url page is missing');
});
t('the test workflow is where GitHub looks for it', () => {
  assert(exists('.github/workflows/test.yml'), 'create .github/workflows/test.yml (a test.yml at the top level does nothing)');
});
t('every screenshot the README shows exists', () => {
  const missing = [...read('README.md').matchAll(/\]\((docs\/[^)\s]+\.(?:png|jpg|svg))\)/g)].map((m) => m[1]).filter((f) => !exists(f));
  assert.deepEqual(missing, [], 'missing: ' + missing.join(', '));
});
if (problems.length) { console.log(`\n${problems.length} problem(s). Fix these before pushing, or the live site may break.`); process.exit(1); }
console.log(n + ' site checks passed');
