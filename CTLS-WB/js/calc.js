function loadCustomProfiles() {
 try {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
 } catch (e) {
  return {};
 }
}

function saveCustomProfiles(map) {
 try {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
 } catch (e) {}
}

function loadProfiles() {
 const sel = document.getElementById('profile');
 const custom = loadCustomProfiles();
 sel.innerHTML = '<option value="custom">自定义 Custom</option>';
 Object.keys(DEFAULT_PROFILES).sort().forEach(n => {
  sel.innerHTML += `<option value="${n}">${n}</option>`;
 });
 Object.keys(custom).sort().forEach(n => {
  sel.innerHTML += `<option value="${n}">${n} ★</option>`;
 });
}

function loadProfile() {
 const n = document.getElementById('profile').value;
 if (n === 'custom') return;
 const p = DEFAULT_PROFILES[n] || loadCustomProfiles()[n];
 if (!p) return;
 document.getElementById('w_empty').value = p.empty;
 document.getElementById('arm_empty').value = p.arm;
 calc();
}

function saveProfile() {
 const sel = document.getElementById('profile');
 const current = sel.value;
 const reg = prompt('请输入飞机注册号 (如 B-10J9):\nEnter aircraft registration:', current !== 'custom' ? current : '');
 if (!reg) return;
 const name = reg.trim().toUpperCase();
 if (!name) return;
 if (Object.keys(DEFAULT_PROFILES).some(k => k.toUpperCase() === name)) {
  alert('注册号与内置预设重复，请使用其他名称。\nConflicts with built-in preset.');
  return;
 }
 const empty = parseFloat(document.getElementById('w_empty').value) || 0;
 const arm = parseFloat(document.getElementById('arm_empty').value) || 0;
 if (empty <= 0 || arm <= 0) {
  alert('空机重和力臂必须大于 0。\nEmpty weight & arm must be > 0.');
  return;
 }
 const custom = loadCustomProfiles();
 custom[name] = { empty: +empty.toFixed(1), arm: +arm.toFixed(3) };
 saveCustomProfiles(custom);
 loadProfiles();
 document.getElementById('profile').value = name;
 alert('已保存 ' + name + ' (共 ' + Object.keys(custom).length + ' 条自定义预设)\nSaved.');
}

function deleteProfile() {
 const sel = document.getElementById('profile');
 const name = sel.value;
 if (name === 'custom') {
  alert('无法删除"自定义"项。\nCannot delete "Custom".');
  return;
 }
 if (Object.keys(DEFAULT_PROFILES).some(k => k === name)) {
  alert('内置预设不可删除。\nCannot delete built-in preset.');
  return;
 }
 const custom = loadCustomProfiles();
 if (!custom[name]) {
  alert('未找到该预设。\nPreset not found.');
  return;
 }
 if (!confirm('确认删除 ' + name + '?\nDelete preset ' + name + '?')) return;
 delete custom[name];
 saveCustomProfiles(custom);
 loadProfiles();
 document.getElementById('profile').value = 'custom';
 alert('已删除 ' + name + '\nDeleted.');
}

function calc() {
 const liters = parseFloat(document.getElementById('v_fuel').value) || 0;
 const fuelKg = +(liters * FUEL_DENSITY).toFixed(1);

 const w = {
  empty: parseFloat(document.getElementById('w_empty').value) || 0,
  crew: parseFloat(document.getElementById('w_crew').value) || 0,
  baggage: parseFloat(document.getElementById('w_baggage').value) || 0,
  floor: parseFloat(document.getElementById('w_floor').value) || 0,
  fuel: fuelKg
 };
 const arm = {
  empty: parseFloat(document.getElementById('arm_empty').value) || 0,
  crew: ARM.crew,
  baggage: ARM.baggage,
  floor: ARM.floor,
  fuel: ARM.fuel
 };
 const m = {};
 for (const k of Object.keys(w)) m[k] = +(w[k] * arm[k]).toFixed(1);

 const zfw = +(w.empty + w.crew + w.baggage + w.floor).toFixed(1);
 const m_zfw = +(m.empty + m.crew + m.baggage + m.floor).toFixed(1);
 const arm_zfw = zfw > 0 ? +(m_zfw / zfw).toFixed(3) : 0;

 const tow = +(zfw + w.fuel).toFixed(1);
 const m_tow = +(m_zfw + m.fuel).toFixed(1);
 const arm_tow = tow > 0 ? +(m_tow / tow).toFixed(3) : 0;
 const cg_pct = ((arm_tow / MAC_LENGTH) * 100).toFixed(1);

 document.getElementById('w_fuel').value = fuelKg.toFixed(1);
 document.getElementById('w_zfw').value = zfw.toFixed(1);
 document.getElementById('m_zfw').value = m_zfw.toFixed(1);
 document.getElementById('arm_zfw').value = arm_zfw.toFixed(3);
 document.getElementById('w_tow').value = tow.toFixed(1);
 document.getElementById('m_tow').value = m_tow.toFixed(1);
 document.getElementById('arm_tow').value = arm_tow.toFixed(3);
 document.getElementById('m_empty').value = m.empty.toFixed(1);
 document.getElementById('m_crew').value = m.crew.toFixed(1);
 document.getElementById('m_baggage').value = m.baggage.toFixed(1);
 document.getElementById('m_floor').value = m.floor.toFixed(1);
 document.getElementById('m_fuel').value = m.fuel.toFixed(1);

 document.getElementById('disp_weight').textContent = tow.toFixed(1) + ' kg';
 document.getElementById('disp_cg').textContent = arm_tow.toFixed(3) + ' m';
 document.getElementById('disp_mac').textContent = cg_pct + ' %MAC';
 document.getElementById('disp_remain').textContent = (MAX_MASS - tow).toFixed(1) + ' kg';

 const dw = document.getElementById('disp_weight');
 const dc = document.getElementById('disp_cg');

 const fwd = CG_FWD, aft = CG_AFT;
 let html = '';
 const wOver = tow > MAX_MASS;
 const cgFwd = arm_tow < fwd;
 const cgAft = arm_tow > aft;
 const cgNear = !wOver && !cgFwd && !cgAft && (arm_tow < fwd + 0.020 || arm_tow > aft - 0.020);

 if (wOver) {
  html += '<div class="warning danger">⚠ 起飞总重 ' + tow.toFixed(1) + ' kg 超出 ' + MAX_MASS + ' kg 限制！<span class="en">TOW exceeds MTOW limit</span></div>';
  dw.className = 'val warn';
 } else if (tow > 570) {
  html += '<div class="warning caution">⚠ 总重接近上限（' + tow.toFixed(1) + '/' + MAX_MASS + ' kg）<span class="en">Weight approaching limit</span></div>';
  dw.className = 'val ok';
 } else {
  dw.className = 'val ok';
 }

 if (cgFwd) {
  html += '<div class="warning danger">⚠ 重心 ' + arm_tow.toFixed(3) + ' m 超出前限（' + fwd.toFixed(3) + ' m）<span class="en">CG exceeds forward limit</span></div>';
  dc.className = 'val warn';
 } else if (cgAft) {
  html += '<div class="warning danger">⚠ 重心 ' + arm_tow.toFixed(3) + ' m 超出后限（' + aft.toFixed(3) + ' m）<span class="en">CG exceeds aft limit</span></div>';
  dc.className = 'val warn';
 } else if (cgNear) {
  html += '<div class="warning caution">⚠ 重心接近边界，请确认分布合理<span class="en">CG near boundary, verify loading</span></div>';
  dc.className = 'val ok';
 } else {
  dc.className = 'val ok';
 }

 if (w.crew > LIMIT.crew.max) html += '<div class="warning danger">⚠ 前座载重超限（>' + LIMIT.crew.max + ' kg）<span class="en">Front seat load exceeds limit</span></div>';
 if (w.baggage > LIMIT.baggage.max) html += '<div class="warning danger">⚠ 行李超限（>' + LIMIT.baggage.max + ' kg）<span class="en">Baggage exceeds limit</span></div>';
 if (liters > LIMIT.fuel.max) html += '<div class="warning danger">⚠ 燃油体积超限（>' + LIMIT.fuel.max + ' L）<span class="en">Fuel volume exceeds limit</span></div>';

 if (!html) html = '<div class="warning success">✓ 载重平衡合格<span class="en">Weight &amp; balance within limits</span></div>';
 document.getElementById('warnings').innerHTML = html;

 drawChart(tow, arm_tow);
}