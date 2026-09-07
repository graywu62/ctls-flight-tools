const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const WORKSPACE = path.resolve(ROOT, '..');
function locateSource(name) {
  const direct = path.join(WORKSPACE, name);
  const grouped = path.join(WORKSPACE, 'CTLS TOOLS', name);
  return fs.existsSync(direct) ? direct : grouped;
}
const SOURCES = {
  ctls: locateSource('CTLS TOOLS V3.0'),
  ctlsi: locateSource('CTLSi TOOLS V2.0')
};
const COPIES = {
  ctls: path.join(ROOT, 'aircraft', 'ctls'),
  ctlsi: path.join(ROOT, 'aircraft', 'ctlsi')
};

function ok(value, message) {
  if (!value) throw new Error(message);
}

function text(file) {
  return fs.readFileSync(file, 'utf8');
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function walk(dir, rel = '') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const next = path.join(rel, entry.name);
    if (entry.isDirectory()) out.push(...walk(dir, next));
    else out.push(next.replace(/\\/g, '/'));
  }
  return out.sort();
}

function testRootNavigation() {
  const html = text(path.join(ROOT, 'index.html'));
  ok(html.includes('aircraft/ctls/index.html'), 'CTLS entry missing');
  ok(html.includes('aircraft/ctlsi/index.html'), 'CTLSi entry missing');
  ok((html.match(/class="model-option/g) || []).length === 2, 'root must show exactly two aircraft choices');
  ok(html.includes('assets/aircraft-ctls-line.png'), 'CTLS line-art preview missing');
  ok(html.includes('assets/aircraft-ctlsi-line.png'), 'CTLSi line-art preview missing');
  ok(fs.existsSync(path.join(ROOT, 'aircraft-selector.js')), 'aircraft selector behavior missing');
  ok(fs.existsSync(path.join(ROOT, 'assets', 'aircraft-ctls-line.png')), 'CTLS line-art asset missing');
  ok(fs.existsSync(path.join(ROOT, 'assets', 'aircraft-ctlsi-line.png')), 'CTLSi line-art asset missing');
}

function testSwitching() {
  const ctlsHome = text(path.join(COPIES.ctls, 'index.html'));
  const ctlsiHome = text(path.join(COPIES.ctlsi, 'index.html'));
  ok(ctlsHome.includes('../../hub-home-switch.js'), 'CTLS home switch missing');
  ok(ctlsiHome.includes('../../hub-home-switch.js'), 'CTLSi home switch missing');
  const ctlsShell = text(path.join(COPIES.ctls, 'CTLS-common/js/shell-switch.js'));
  const ctlsiShell = text(path.join(COPIES.ctlsi, 'CTLSi-common/js/shell-switch.js'));
  for (const shell of [ctlsShell, ctlsiShell]) {
    ok(shell.includes("aircraft: '../../../index.html'"), 'aircraft selector target missing');
    ok(shell.includes("{ v: 'aircraft', t: '切换机型' }"), 'aircraft selector option missing');
  }
}

function testStorageIsolation() {
  const ctlsStore = text(path.join(COPIES.ctls, 'CTLS-common/js/flight-plan-store.js'));
  const ctlsiStore = text(path.join(COPIES.ctlsi, 'CTLSi-common/js/flight-plan-store.js'));
  const ctlsCheck = text(path.join(COPIES.ctls, 'CTLS-CHECK/js/app.js'));
  const ctlsiCheck = text(path.join(COPIES.ctlsi, 'CTLSi-CHECK/js/app.js'));
  ok(ctlsStore.includes("'ctls_flight_plan_v1'"), 'CTLS flight plan key incorrect');
  ok(ctlsiStore.includes("'ctlsi_flight_plan_v1'"), 'CTLSi flight plan key incorrect');
  ok(ctlsCheck.includes("'ctls_checklist_rev24_v1'"), 'CTLS checklist key incorrect');
  ok(ctlsiCheck.includes("'ctlsi_checklist_v1'"), 'CTLSi checklist key incorrect');
}

function testCopiesPreserved() {
  const allowed = {
    ctls: new Set([
      'index.html',
      'CTLS-common/js/shell-switch.js',
      'CTLS-FUEL/js/script.js',
      'sw.js'
    ]),
    ctlsi: new Set([
      'index.html',
      'CTLSi-common/js/shell-switch.js',
      'CTLSi-FUEL/js/script.js',
      'sw.js'
    ])
  };
  for (const model of ['ctls', 'ctlsi']) {
    const sourceFiles = walk(SOURCES[model]);
    const copyFiles = walk(COPIES[model]);
    ok(JSON.stringify(sourceFiles) === JSON.stringify(copyFiles), `${model} copy file list differs from source`);
    for (const rel of sourceFiles) {
      if (allowed[model].has(rel)) continue;
      ok(hash(path.join(SOURCES[model], rel)) === hash(path.join(COPIES[model], rel)), `${model} unexpected modification: ${rel}`);
    }
  }
}

function testFuelStatusIcons() {
  const models = [
    ['CTLS', path.join(COPIES.ctls, 'CTLS-FUEL', 'js', 'script.js')],
    ['CTLSi', path.join(COPIES.ctlsi, 'CTLSi-FUEL', 'js', 'script.js')]
  ];

  for (const [label, file] of models) {
    const script = text(file);
    ok(script.includes("danger: 'M7 7 L17 17 M17 7 L7 17'"), `${label} danger cross icon missing`);
    ok(script.includes("caution: 'M12 5 V14 M12 18 V18.2'"), `${label} caution icon missing`);
    ok((script.match(/setStatusIcon\(bar, 'danger'\)/g) || []).length === 2, `${label} danger states must use the cross icon`);
    ok(script.includes("setStatusIcon(bar, 'caution')"), `${label} caution state must use the warning icon`);
    ok(script.includes("setStatusIcon(bar, 'ok')"), `${label} normal state must use the check icon`);
  }
}

const tests = [
  ['root aircraft navigation', testRootNavigation],
  ['aircraft switching', testSwitching],
  ['storage isolation', testStorageIsolation],
  ['source copies preserved', testCopiesPreserved],
  ['fuel status icons', testFuelStatusIcons]
];

for (const [name, fn] of tests) {
  fn();
  console.log(`PASS ${name}`);
}
console.log(`PASS ${tests.length} hub test groups`);
