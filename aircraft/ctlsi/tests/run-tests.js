'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function makeElement(value = '') {
  return {
    value: String(value),
    textContent: '',
    innerHTML: '',
    className: '',
    clientWidth: 700,
    width: 260,
    height: 280,
    parentElement: { getBoundingClientRect: () => ({ width: 300, height: 300 }) },
    children: [],
    setAttribute() {},
    replaceChildren() { this.children = []; },
    appendChild(child) { this.children.push(child); return child; },
    getAttribute() { return null; }
  };
}

function makeCanvasContext() {
  const target = { measureText: () => ({ width: 10 }) };
  return new Proxy(target, {
    get(object, key) { return key in object ? object[key] : () => {}; },
    set(object, key, value) { object[key] = value; return true; }
  });
}

function createTolHarness() {
  const scriptPath = path.join(ROOT, 'CTLSi-TOL', 'js', 'script.js');
  let source = fs.readFileSync(scriptPath, 'utf8');
  source = source.slice(0, source.indexOf('(function init()'));

  const defaults = {
    to_elev_m: 0, to_qnh: 1013.25, to_oat_c: 15, to_tow: 600,
    to_flap: 0, to_surface: 'paved_dry', to_slope: 0,
    to_wind_dir: 0, to_rwy_hdg: 0, to_wind_ms: 0, to_runway_avail: 800,
    ld_elev_m: 0, ld_qnh: 1013.25, ld_oat_c: 15, ld_ldw: 560,
    ld_flap: 30, ld_surface: 'paved_dry', ld_slope: 0,
    ld_wind_dir: 0, ld_rwy_hdg: 0, ld_wind_ms: 0,
    ld_runway_avail: 800, ld_td_offset: 0
  };
  const elements = {};
  function getElement(id) {
    if (!elements[id]) elements[id] = makeElement(defaults[id] ?? '');
    return elements[id];
  }
  const document = {
    getElementById: getElement,
    querySelectorAll: () => [],
    readyState: 'complete'
  };
  const context = {
    document,
    console,
    localStorage: { getItem: () => null },
    window: { addEventListener() {} }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: scriptPath });
  return { context, elements, getElement };
}

function createWbHarness() {
  const htmlPath = path.join(ROOT, 'CTLSi-WB', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'CTLSi-WB inline script not found');

  const defaults = {
    profile: 'custom', w_empty: 375.1, arm_empty: 0.363,
    w_crew: 160, w_baggage: 0, w_floor: 0, v_fuel: 40
  };
  const store = new Map();
  const elements = {};
  const canvasContext = makeCanvasContext();
  function getElement(id) {
    if (!elements[id]) {
      elements[id] = makeElement(defaults[id] ?? '');
      if (id === 'cgChart' || id === 'cgChartMob') {
        elements[id].getContext = () => canvasContext;
      }
    }
    return elements[id];
  }
  const document = { getElementById: getElement, querySelectorAll: () => [], createElement: () => makeElement('') };
  const localStorage = {
    getItem: key => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value))
  };
  const window = { localStorage, addEventListener() {} };
  const context = {
    document, localStorage, window, console,
    prompt: () => null, alert() {}, confirm: () => false,
    ResizeObserver: undefined
  };
  vm.createContext(context);
  vm.runInContext(match[1], context, { filename: htmlPath });
  return { context, elements, store, getElement };
}

function testTol() {
  const { context, elements, getElement } = createTolHarness();
  context.calcAll();
  assert.equal(elements.to_roll.textContent, '211 m');
  assert.equal(elements.to_dist.textContent, '340 m');
  assert.equal(elements.ld_roll.textContent, '141 m');
  assert.equal(elements.ld_dist.textContent, '305 m');
  assert.equal(context.tailwindFactor(5 * 0.514444, 'roll'), 1.2);
  assert.equal(context.tailwindFactor(5 * 0.514444, 'distance'), 1.25);
  assert.equal(context.headwindFactor(10), 1, 'POH does not publish a headwind credit');
  assert.equal(context.slopeFactorRoll(2), 1.10);
  assert.equal(context.slopeFactorDist(4), 1.12);

  assert.deepEqual(context.landingDistance(35, 600, 0), context.landingDistance(30, 600, 0));
  assert.equal(context.landingDistance(0, 600, 0), null);

  getElement('ld_flap').value = '35';
  context.calcLanding();
  assert.match(elements.warnings_ld.innerHTML, /35°按 POH 30°/);

  getElement('ld_flap').value = '0';
  context.calcLanding();
  assert.equal(elements.ld_dist.textContent, '--');
  assert.match(elements.warnings_ld.innerHTML, /未发布襟翼 0°的着陆距离图表/);
  getElement('ld_flap').value = '30';

  getElement('to_tow').value = '399';
  context.calcTakeoff();
  assert.equal(elements.to_dist.textContent, '--');
  assert.match(elements.warnings_to.innerHTML, /超出 POH 性能表范围/);

  getElement('to_tow').value = '600';
  getElement('to_elev_m').value = '3000';
  getElement('to_oat_c').value = '60';
  context.calcTakeoff();
  assert.equal(elements.to_dist.textContent, '--');
  assert.match(elements.warnings_to.innerHTML, /密度高度.*超出 POH/);

  getElement('ld_qnh').value = '';
  context.calcLanding();
  assert.equal(elements.ld_dist.textContent, '--');
  assert.match(elements.warnings_ld.innerHTML, /必须为有效数字/);
}

function testFuelPlanner() {
  const dataPath = path.join(ROOT, 'CTLSi-FUEL', 'data', 'pohData.js');
  const scriptPath = path.join(ROOT, 'CTLSi-FUEL', 'js', 'script.js');
  const window = {};
  const context = { window, console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(dataPath, 'utf8'), context, { filename:dataPath });
  let source = fs.readFileSync(scriptPath, 'utf8');
  source = source.slice(0, source.indexOf('/* ============================================================\n   6) 渲染'));
  vm.runInContext(source, context, { filename:scriptPath });

  assert.equal(window.POH_DATA.FUEL_DENSITY_KG_PER_L, 0.725);
  assert.equal(window.POH_DATA.TANK_CAPACITY_L, 130);
  assert.equal(context.parseHm('2:30'), 2.5);
  assert.equal(context.lookupCruisePerf(6000, '65%').rpm, 4450);
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.lookupCruisePerf(3000, '75%'))),
    { ias:99, cas:98, tas:104, rpm:4900, burn:21.2 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.lookupCruisePerf(9000, '50%'))),
    { ias:70, cas:69, tas:81, rpm:3850, burn:15 }
  );
  assert.equal(context.lookupCruisePerf(7500, '65%').rpm, 4350);
  assert.equal(context.lookupCruisePerf(2000, '65%').rpm, 4600, 'altitudes below range must use 3000 ft data');
  assert.equal(context.lookupCruisePerf(12000, '65%').rpm, 4250, 'altitudes above range must use 9000 ft data');
  const burn = context.getCruiseBurnLph('65%');
  assert.equal(context.calcRequiredFuelL(
    context.calcGroundOpFuelL(20 / 60),
    context.calcTripFuelL(2.5, burn),
    context.calcReserveFuelL(0.5, burn)
  ), 59.9);
}

function testWeightBalance() {
  const { context, elements, store, getElement } = createWbHarness();
  assert.match(elements.warnings.innerHTML, /未校验/);
  assert.match(elements.disp_zfw_cg.textContent, /^\d\.\d{3} m$/);

  // POH Rev.20 §6.3 worked example: empty 318 kg/107.1 kg·m,
  // crew 85 kg, baggage 12 kg, full 4 L header and 43 kg wing fuel.
  getElement('w_empty').value = '318';
  getElement('arm_empty').value = String(107.1 / 318);
  getElement('w_crew').value = '85';
  getElement('w_baggage').value = '12';
  getElement('w_floor').value = '0';
  getElement('v_fuel').value = String(4 + 43 / 0.725);
  context.calc();
  assert.equal(elements.w_tow.value, '460.9');
  assert.equal(elements.arm_tow.value, '0.387');

  store.set('ctlsi_ground_op_kg', '3.0');
  store.set('ctlsi_trip_kg', '12.0');
  context.calc();
  assert.match(elements.disp_ldg_cg.textContent, /^\d\.\d{3} m$/);
  assert.doesNotMatch(elements.warnings.innerHTML, /预计着陆重量和重心未校验/);

  store.set('ctlsi_trip_kg', '100.0');
  context.calc();
  assert.equal(elements.disp_ldg_cg.textContent, '未校验');
}

function testFlightPlanStore() {
  const scriptPath = path.join(ROOT, 'CTLSi-common', 'js', 'flight-plan-store.js');
  const source = fs.readFileSync(scriptPath, 'utf8');
  const store = new Map();
  const window = {
    localStorage: {
      getItem: key => store.has(key) ? store.get(key) : null,
      setItem: (key, value) => store.set(key, String(value))
    }
  };
  const context = { window, Date, console };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: scriptPath });
  const api = window.CTLSiFlightPlanStore;

  assert.equal(api.schemaVersion, 1);
  api.publishWeightBalance({ aircraftReg: 'TEST', towKg: 580, fuelOnBoardL: 40 });
  api.publishFuelPlan({ sourceFuelOnBoardL: 40, groundOpKg: 3, tripKg: 12 });
  assert.equal(api.read().fuelPlan.tripKg, 12);

  api.publishWeightBalance({ aircraftReg: 'TEST', towKg: 587.25, fuelOnBoardL: 50 });
  assert.equal(api.read().fuelPlan, undefined, 'changed fuel load must invalidate the old fuel plan');

  const saved = JSON.parse(store.get(api.storageKey));
  saved.updatedAt = Date.now() - 49 * 60 * 60 * 1000;
  store.set(api.storageKey, JSON.stringify(saved));
  assert.equal(api.read(), null, 'stale plans must not be returned');
}

function testToolDraftStore() {
  const scriptPath = path.join(ROOT, 'CTLSi-common', 'js', 'tool-draft-store.js');
  const source = fs.readFileSync(scriptPath, 'utf8');
  const store = new Map([[
    'ctlsi_tool_draft_v1_wb',
    JSON.stringify({ version: 1, values: { w_crew: '172.5', v_fuel: '63' } })
  ]]);
  const listeners = {};
  const fields = [
    { id:'w_crew', type:'number', value:'160', readOnly:false },
    { id:'v_fuel', type:'number', value:'40', readOnly:false },
    { id:'w_tow', type:'number', value:'0', readOnly:true }
  ];
  const document = {
    querySelectorAll: () => fields,
    addEventListener: (name, fn) => { listeners[name] = fn; }
  };
  const window = {
    location: { pathname:'/CTLSi-WB/index.html' }, document,
    localStorage: {
      getItem: key => store.has(key) ? store.get(key) : null,
      setItem: (key, value) => store.set(key, String(value))
    },
    addEventListener() {}
  };
  const context = { window, document, Object, JSON };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: scriptPath });

  assert.equal(fields[0].value, '172.5');
  assert.equal(fields[1].value, '63');
  fields[0].value = '180';
  listeners.input();
  assert.equal(JSON.parse(store.get('ctlsi_tool_draft_v1_wb')).values.w_crew, '180');
}

function testChecklistData() {
  const dataPath = path.join(ROOT, 'CTLSi-CHECK', 'data', 'checklistData.js');
  const window = {};
  const context = { window, Object };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(dataPath, 'utf8'), context, { filename:dataPath });
  const data = window.CTLS_CHECKLIST_DATA;
  assert.deepEqual(Array.from(data.categories, item => item.id), ['external', 'normal', 'emergency']);
  const counts = Object.fromEntries(data.categories.map(category => [
    category.id, category.groups.reduce((sum, group) => sum + group.items.length, 0)
  ]));
  assert.deepEqual(counts, { external:40, normal:85, emergency:158 });
  const content = JSON.stringify(data);
  assert.match(data.meta.source, /CTLSi_Flight_Checklist V1\.0/);
  assert.match(content, /LANE A\/B灯2-5秒亮后熄灭/);
  assert.match(content, /下降≤180 RPM/);
  assert.match(content, /A\/B差≤120 RPM/);
  assert.match(content, /2\.8-3\.2 bar/);
  assert.match(content, /低于4800停止起飞/);
  assert.match(content, /750 ft（250 m）以下发动机故障不得尝试返场/);
  assert.match(content, /59 \/ 65 \/ 71 KIAS/);
  assert.match(content, /缸盖温度保持低于150°C/);
  assert.match(content, /拉出3秒后重新按入/);
  assert.match(content, /保持RPM≥4800/);
  assert.match(content, /电压12\.8–15 V/);
  assert.match(content, /同时按住按钮1、2、5至少3秒/);
  assert.match(content, /旋转停止前不得向前推升降舵/);
  assert.match(content, /左翼向前向下/);
  assert.match(content, /AG 0430 0003 Rev\.20 CH0 第3章/);
  assert.doesNotMatch(content, /速度速查/);
}

const tests = [
  ['Takeoff and landing boundaries', testTol],
  ['Fuel planning data and boundaries', testFuelPlanner],
  ['Weight-balance flight states', testWeightBalance],
  ['Versioned cross-module storage', testFlightPlanStore],
  ['Per-tool input draft storage', testToolDraftStore],
  ['CTLSi checklist structure and controlled values', testChecklistData]
];

let failed = 0;
for (const [name, test] of tests) {
  try {
    test();
    console.log('PASS', name);
  } catch (error) {
    failed += 1;
    console.error('FAIL', name);
    console.error(error.stack || error.message);
  }
}

if (failed) process.exitCode = 1;
else console.log(`PASS ${tests.length} test groups`);
