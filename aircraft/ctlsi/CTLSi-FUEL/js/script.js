'use strict';

/* ============================================================
   CTLSi Fuel Planner — A4 Portrait 1:1 Logic
   - 时间：小时 + 分钟 双输入（无需输入冒号）
   - 巡航高度：手动填写，自动匹配 POH 性能表
   - 公式行动态展示
   - 状态条 OK / DANGER 切换
   ============================================================ */


/* ============================================================
   1) 时间格式化（仅用于 reserve_time 单输入框的解析）
   ============================================================ */

/** decimal hours → "h:mm"  */
function formatHm(hours) {
  if (!isFinite(hours) || hours < 0) return '0:00';
  const totalMin = Math.floor(hours * 60 + 1e-9);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h + ':' + String(m).padStart(2, '0');
}

/** "h:mm" / 纯数字 → decimal hours */
function parseHm(str) {
  if (str == null) return 0;
  const s = String(str).trim();
  if (!s) return 0;
  const m = s.match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const mm = Math.min(59, parseInt(m[2], 10));
    return h + mm / 60;
  }
  const v = parseFloat(s);
  return isNaN(v) || v < 0 ? 0 : v;
}

/** 同步 reserve_time：blur 后标准化为 "h:mm" */
function normalizeTimeInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = formatHm(parseHm(el.value));
}


/* ============================================================
   2) 双输入时间读取（小时 + 分钟 各自独立）
   ============================================================ */
function readSplitTime(hrId, minId) {
  const h = Math.max(0, parseInt(document.getElementById(hrId).value, 10) || 0);
  const m = Math.max(0, Math.min(59, parseInt(document.getElementById(minId).value, 10) || 0));
  return h + m / 60;
}


/* ============================================================
   3) POH 巡航性能 — 查表（精确 / 区间插值 / clamp）
   ============================================================ */
function getAltitudes() {
  return window.POH_DATA.ALTITUDES_FT.slice().sort((a, b) => a - b);
}

function clampAltitude(altitudeFt) {
  const alts = getAltitudes();
  if (altitudeFt <= alts[0]) return alts[0];
  if (altitudeFt >= alts[alts.length - 1]) return alts[alts.length - 1];
  let best = alts[0], bestDiff = Math.abs(altitudeFt - alts[0]);
  for (let i = 1; i < alts.length; i++) {
    const d = Math.abs(altitudeFt - alts[i]);
    if (d < bestDiff) { bestDiff = d; best = alts[i]; }
  }
  return best;
}

function lookupCruisePerf(altitudeFt, powerKey) {
  const perf = window.POH_DATA.CRUISE_PERFORMANCE;
  if (!perf) return null;
  const alts = getAltitudes();
  if (!Number.isFinite(altitudeFt)) return null;
  const clamped = clampAltitude(altitudeFt);

  // 精确命中
  if (clamped === altitudeFt && perf[clamped] && perf[clamped][powerKey]) {
    return Object.assign({}, perf[clamped][powerKey]);
  }

  // clamp 到边界
  if (clamped === alts[0] || clamped === alts[alts.length - 1]) {
    return perf[clamped] && perf[clamped][powerKey]
      ? Object.assign({}, perf[clamped][powerKey])
      : null;
  }

  // 区间内 → 线性插值
  for (let i = 0; i < alts.length - 1; i++) {
    const a0 = alts[i], a1 = alts[i + 1];
    if (altitudeFt >= a0 && altitudeFt <= a1) {
      const p0 = perf[a0][powerKey], p1 = perf[a1][powerKey];
      if (!p0 || !p1) return null;
      const t = (altitudeFt - a0) / (a1 - a0);
      return {
        ias:  Math.round(p0.ias  + (p1.ias  - p0.ias)  * t),
        tas:  Math.round(p0.tas  + (p1.tas  - p0.tas)  * t),
        rpm:  Math.round(p0.rpm  + (p1.rpm  - p0.rpm)  * t),
        burn: +(p0.burn + (p1.burn - p0.burn) * t).toFixed(1)
      };
    }
  }
  return perf[clamped] && perf[clamped][powerKey]
    ? Object.assign({}, perf[clamped][powerKey])
    : null;
}


/* ============================================================
   4) 纯计算函数
   ============================================================ */
function getCruiseBurnLph(powerKey) {
  const entry = window.POH_DATA.CRUISE_POWER[powerKey];
  return entry ? entry.fuelBurnLph : 0;
}

function calcGroundOpFuelL(groundOpHr) {
  return groundOpHr * window.POH_DATA.IDLE_BURN_LPH;
}
function calcTripFuelL(flightHr, burnLph) {
  return flightHr * burnLph;
}
function calcReserveFuelL(reserveHr, burnLph) {
  return reserveHr * burnLph;
}
function calcRequiredFuelL(g, t, r) { return g + t + r; }
function calcLandingFuelL(fob, requiredFuel) { return fob - requiredFuel; }
function calcEnduranceHr(landingFuelL, burnLph) {
  if (burnLph <= 0) return 0;
  return landingFuelL / burnLph;
}


/* ============================================================
   5) 输入读取
   ============================================================ */
function resolveReserveHr(mode, customHr) {
  const rm = window.POH_DATA.RESERVE_MODE[mode];
  if (!rm || rm.timeMin == null) return customHr;
  return rm.timeMin / 60;
}

function readInputs() {
  const cruisePower = document.getElementById('cruise_power').value;
  const reserveMode = document.getElementById('reserve_mode').value;
  const flightHr    = readSplitTime('flight_time_hr', 'flight_time_min');
  const groundOpHr  = readSplitTime('ground_op_hr',  'ground_op_min');
  const reserveHr   = resolveReserveHr(reserveMode, parseHm(document.getElementById('reserve_time').value));
  return {
    flightHr,
    groundOpHr,
    altitudeFt:   parseInt(document.getElementById('cruise_altitude').value, 10) || 0,
    cruisePower,
    reserveMode,
    reserveHr,
    fuelOnBoardL: parseFloat(document.getElementById('fuel_on_board').value) || 0
  };
}


/* ============================================================
   6) 渲染
   ============================================================ */
function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}
function fmtL(v)   { return v.toFixed(1); }
function fmtLhr(v) { return v.toFixed(1); }

function renderResults(input, c) {
  // 巡航设置（右上结果卡）
  setText('res_ref_rpm', c.perf ? c.perf.rpm : '—');
  setText('res_burn',    fmtLhr(c.burnLph));

  // 燃油计算三段（先 round 再展示，保证后续求和与参考图一致）
  const dGround = parseFloat(fmtL(c.groundOpFuelL));
  const dTrip   = parseFloat(fmtL(c.tripFuelL));
  const dRes    = parseFloat(fmtL(c.reserveFuelL));
  setText('res_ground_op', dGround.toFixed(1));
  setText('res_trip',      dTrip.toFixed(1));
  setText('res_reserve',   dRes.toFixed(1));

  /* 跨表数据发布（地面运转 / 航程 → kg，使用统一 AVGAS 密度常量） */
  try {
    const density = window.POH_DATA.FUEL_DENSITY_KG_PER_L;
    const groundOpKg = dGround * density;
    const tripKg = dTrip * density;
    localStorage.setItem('ctlsi_ground_op_kg', groundOpKg.toFixed(1));
    localStorage.setItem('ctlsi_trip_kg',      tripKg.toFixed(1));
    if (window.CTLSiFlightPlanStore) {
      window.CTLSiFlightPlanStore.publishFuelPlan({
        sourceFuelOnBoardL: input.fuelOnBoardL,
        groundOpKg,
        tripKg
      });
    }
  } catch(e){}

  // 公式行动态展示
  setText('fx_ground_op', fmtLhr(window.POH_DATA.IDLE_BURN_LPH) + ' L/hr × ' + formatHm(input.groundOpHr) + ' hr');
  setText('fx_trip',      fmtLhr(c.burnLph) + ' L/hr × ' + formatHm(input.flightHr)    + ' hr');
  setText('fx_reserve',   fmtLhr(c.burnLph) + ' L/hr × ' + formatHm(input.reserveHr) + ' hr');

  // 汇总（round 后求和 → 与参考图一致）
  const dispReq    = dGround + dTrip + dRes;
  const dispLand   = input.fuelOnBoardL - dispReq;
  const dispEndHr  = dispLand > 0 ? dispLand / c.burnLph : 0;
  setText('res_required',  dispReq.toFixed(1));
  setText('res_landing',   dispLand.toFixed(1));
  setText('res_endurance', formatHm(dispEndHr));
  setText('fx_endurance',  dispLand.toFixed(1) + ' L ÷ ' + fmtLhr(c.burnLph) + ' L/hr');

  // 可视化油量尺：仅呈现现有计算结果，不参与计算。
  const tankCapacity = window.POH_DATA.TANK_CAPACITY_L;
  const gaugeFill = document.getElementById('fuel_gauge_fill');
  const requiredMarker = document.getElementById('fuel_required_marker');
  if (gaugeFill) {
    const fuelPercent = Math.max(0, Math.min(100, input.fuelOnBoardL / tankCapacity * 100));
    gaugeFill.style.width = fuelPercent + '%';
  }
  if (requiredMarker) {
    const requiredPercent = Math.max(0, Math.min(100, dispReq / tankCapacity * 100));
    requiredMarker.style.left = requiredPercent + '%';
  }

  // 备用时间：VFR/IFR → 同步默认值并禁用；CUSTOM → 允许填写，保留用户输入
  const rt = document.getElementById('reserve_time');
  if (rt) {
    if (input.reserveMode !== 'CUSTOM') {
      rt.value = formatHm(input.reserveHr);
      rt.disabled = true;
    } else {
      // CUSTOM：保留用户输入值，仅启用
      rt.disabled = false;
    }
  }
}

function setStatusIcon(bar, state) {
  const path = bar.querySelector('.status-icon-circle path');
  if (!path) return;

  const iconPaths = {
    ok: 'M5 12 L10 17 L19 7',
    caution: 'M12 5 V14 M12 18 V18.2',
    danger: 'M7 7 L17 17 M17 7 L7 17'
  };

  path.setAttribute('d', iconPaths[state] || iconPaths.ok);
  path.setAttribute('stroke-width', state === 'caution' ? '3' : '3.5');
}

function renderStatus(c, input) {
  const bar = document.getElementById('fuel_status');
  if (!bar) return;

  if (input.fuelOnBoardL < 0 || input.fuelOnBoardL > window.POH_DATA.TANK_CAPACITY_L) {
    bar.className = 'status-bar status-danger';
    setStatusIcon(bar, 'danger');
    bar.querySelector('.status-title').textContent = '机上燃油超出范围';
    bar.querySelector('.status-title-en').textContent = 'INVALID FUEL LOAD';
    bar.querySelector('.status-desc').textContent = '机上可用燃油必须位于 0–130 L。';
    bar.querySelector('.status-desc-en').textContent = 'Usable fuel on board must be within 0–130 L.';
    return;
  }
  const ok = c.landingFuelL >= 0;
  const alts = getAltitudes();
  const altitudeOutside = input.altitudeFt < alts[0] || input.altitudeFt > alts[alts.length - 1];
  if (!ok) {
    bar.className = 'status-bar status-danger';
    setStatusIcon(bar, 'danger');
    bar.querySelector('.status-title').textContent    = '燃油不足';
    bar.querySelector('.status-title-en').textContent = 'NOT ENOUGH FUEL';
    const shortBy = Math.abs(c.landingFuelL).toFixed(1);
    bar.querySelector('.status-desc').textContent    = '当前机上燃油不足以完成本次飞行。';
    bar.querySelector('.status-desc-en').textContent = 'Short by ' + shortBy + ' L — Add fuel before flight.';
  } else if (altitudeOutside) {
    const appliedAltitude = clampAltitude(input.altitudeFt);
    bar.className = 'status-bar status-caution';
    setStatusIcon(bar, 'caution');
    bar.querySelector('.status-title').textContent = '已采用边界高度';
    bar.querySelector('.status-title-en').textContent = 'BOUNDARY ALTITUDE APPLIED';
    bar.querySelector('.status-desc').textContent = '燃油充足；性能数据已按 ' + appliedAltitude + ' ft 计算。';
    bar.querySelector('.status-desc-en').textContent = 'Fuel sufficient; performance calculated at ' + appliedAltitude + ' ft.';
  } else {
    bar.className = 'status-bar status-ok';
    setStatusIcon(bar, 'ok');
    bar.querySelector('.status-title').textContent    = '燃油充足';
    bar.querySelector('.status-title-en').textContent = 'FUEL OK';
    bar.querySelector('.status-desc').textContent    = '机上燃油满足本次飞行需求。';
    bar.querySelector('.status-desc-en').textContent = 'Fuel on board is sufficient for this flight.';
  }
}


/* ============================================================
   7) POH 表自动高亮（按当前功率 + 当前高度）
   ============================================================ */
function highlightPOHTable(powerKey, altitudeFt) {
  const table = document.getElementById('poh_table');
  if (!table) return;

  table.querySelectorAll('.cell-active').forEach(function(n){
    n.classList.remove('cell-active');
  });

  const powerNum = String(powerKey).replace('%', '');
  const clampedAlt = clampAltitude(altitudeFt);

  const tr = table.querySelector('tr[data-alt="' + clampedAlt + '"]');
  if (!tr) return;
  tr.querySelectorAll('td[data-power="' + powerNum + '"]').forEach(function(td){
    td.classList.add('cell-active');
  });
}


/* ============================================================
   8) 主循环
   ============================================================ */
function computeAll(input) {
  const burnLph       = getCruiseBurnLph(input.cruisePower);
  const groundOpFuelL = calcGroundOpFuelL(input.groundOpHr);
  const tripFuelL     = calcTripFuelL(input.flightHr, burnLph);
  const reserveFuelL  = calcReserveFuelL(input.reserveHr, burnLph);
  const requiredFuelL = calcRequiredFuelL(groundOpFuelL, tripFuelL, reserveFuelL);
  const landingFuelL  = calcLandingFuelL(input.fuelOnBoardL, requiredFuelL);
  const enduranceHr   = calcEnduranceHr(landingFuelL, burnLph);
  const perf          = lookupCruisePerf(input.altitudeFt, input.cruisePower);
  return { burnLph, groundOpFuelL, tripFuelL, reserveFuelL, requiredFuelL, landingFuelL, enduranceHr, perf };
}

function updateMobilePOH(powerKey, altitudeFt) {
  const perf = lookupCruisePerf(altitudeFt, powerKey);
  const clampedAlt = clampAltitude(altitudeFt);
  setText('mob_poh_power', powerKey + (powerKey === '50%' ? ' (Economy)' : powerKey === '65%' ? ' (Normal)' : ' (Fast)'));
  setText('mob_poh_alt', clampedAlt + ' ft');
  setText('mob_poh_ias', perf ? perf.ias : '--');
  setText('mob_poh_tas', perf ? perf.tas : '--');
  setText('mob_poh_rpm', perf ? perf.rpm : '--');
  setText('mob_poh_burn', perf ? perf.burn : '--');

  document.querySelectorAll('.mob-poh-alt-card').forEach(card => {
    card.classList.remove('active');
  });
  const activeCard = document.getElementById('mob_poh_alt_' + clampedAlt);
  if (activeCard) {
    activeCard.classList.add('active');
  }
}

function togglePOHDetail() {
  const detail = document.getElementById('mob_poh_detail');
  const toggle = document.getElementById('mob_poh_toggle');
  const icon = toggle ? toggle.querySelector('.mob-poh-toggle-icon') : null;
  const text = toggle ? toggle.querySelector('.mob-poh-toggle-text') : null;

  if (detail) {
    detail.classList.toggle('open');
    if (toggle) toggle.setAttribute('aria-expanded', String(detail.classList.contains('open')));
    if (icon) {
      icon.style.transform = detail.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
    }
    if (text) {
      text.textContent = detail.classList.contains('open') ? '收起' : '查看全部数据';
    }
  }
}

function updateAll() {
  const input    = readInputs();
  const computed = computeAll(input);
  renderResults(input, computed);
  highlightPOHTable(input.cruisePower, input.altitudeFt);
  updateMobilePOH(input.cruisePower, input.altitudeFt);
  renderStatus(computed, input);
}


/* ============================================================
   9) 初始化
   ============================================================ */
function applyDefaults() {
  const D = window.POH_DATA.DEFAULTS;
  const set = function(id, v){ const el = document.getElementById(id); if (el) el.value = v; };

  // 拆分：flightTimeHr → (h, m)
  const fh = Math.floor(D.flightTimeHr);
  const fm = Math.round((D.flightTimeHr - fh) * 60);
  set('flight_time_hr',  fh);
  set('flight_time_min', fm);

  // 拆分：taxiTimeMin → (h, m)
  const th = Math.floor(D.taxiTimeMin / 60);
  const tm = D.taxiTimeMin % 60;
  set('ground_op_hr',  th);
  set('ground_op_min', tm);

  set('cruise_altitude', D.altitudeFt);
  set('cruise_power',    D.cruisePower);
  set('reserve_mode',    D.reserveMode);

  // 备用时间默认值（仅 VFR/IFR 设置；CUSTOM 保留原值）
  if (D.reserveMode !== 'CUSTOM') {
    const rm = window.POH_DATA.RESERVE_MODE[D.reserveMode];
    set('reserve_time', formatHm(rm.timeMin / 60));
  }
  set('fuel_on_board', D.fuelOnBoardL);
}

function attachListeners() {
  const ids = [
    'flight_time_hr','flight_time_min',
    'ground_op_hr','ground_op_min',
    'cruise_altitude','cruise_power',
    'reserve_mode','reserve_time',
    'fuel_on_board'
  ];
  ids.forEach(function(id){
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', updateAll);
    el.addEventListener('change', updateAll);
  });

  // reserve_time blur 标准化为 "h:mm"
  const rt = document.getElementById('reserve_time');
  if (rt) {
    rt.addEventListener('blur', function(){
      normalizeTimeInput('reserve_time');
      updateAll();
    });
  }

  // minute 输入：限制 0-59（input 事件过滤）
  ['flight_time_min','ground_op_min'].forEach(function(id){
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', function(){
      const v = parseInt(el.value, 10);
      if (isNaN(v) || v < 0) el.value = 0;
      else if (v > 59) el.value = 59;
      updateAll();
    });
  });
}

function init() {
  const restoredDraft = window.CTLSiToolDraftStore && window.CTLSiToolDraftStore.restore();
  if (!restoredDraft) applyDefaults();
  /* === 用户显式要求：跨表数据载入（载重平衡页面发布的可用燃油 L） === */
  try {
    const plan = window.CTLSiFlightPlanStore && window.CTLSiFlightPlanStore.read();
    const v = plan && plan.weightBalance
      ? plan.weightBalance.fuelOnBoardL
      : parseFloat(localStorage.getItem('ctlsi_v_fuel'));
    const el = document.getElementById('fuel_on_board');
    if (el && isFinite(v) && v >= 0) el.value = v;
  } catch(e){}
  attachListeners();
  updateAll();
}


/* ============================================================
   DOM Ready
   ============================================================ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
