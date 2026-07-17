'use strict';

/* ============================================================
   CTLS Takeoff & Landing Performance
   AeroJones CTLS (Rotax 912 ULS)
   ------------------------------------------------------------
   起飞 / 着陆性能计算器（单页面双 Tab）
   全部性能数据 / 修正系数来自 POH §5
   ------------------------------------------------------------
   模块结构：
     1) 高度 / 风分量 / 修正系数 / 性能插值
     2) DOM 工具 / Tabs 切换
     3) calcTakeoff — 读 to_* → 算 → 渲染
     4) calcLanding — 读 ld_* → 算 → 渲染
     5) renderTakeoffDiagram / renderLandingDiagram — SVG
     6) calcAll 主入口 / 初始化
   ============================================================ */


/* ============================================================
   1) 基础数据 / 纯计算函数
   ============================================================ */
const MTOW = 600;
const MLW  = 600;

const FT_PER_M    = 3.28084;
const M_PER_FT    = 0.3048;
const MS_PER_KT   = 0.514444;

const QNH_STD         = 1013.25;
const PA_PER_HPA_M    = 30 * M_PER_FT;

const TAILWIND_LIMIT_MS            = 5 * MS_PER_KT;
const CROSSWIND_LIMIT_STRONG_MS    = 15 * MS_PER_KT;
const CROSSWIND_LIMIT_CAUTION_MS   = 10 * MS_PER_KT;

/* ----- 高度 ----- */
function pressureAltitudeM(elev_m, qnh_hpa) {
  return elev_m + (QNH_STD - qnh_hpa) * PA_PER_HPA_M;
}
function densityAltitudeM(pa_m, oat_c) {
  const isa = 15 - 0.0065 * pa_m;
  const deltaT = oat_c - isa;
  return pa_m + deltaT * 120 * M_PER_FT;
}

/* ----- 风分量 ----- */
function windComponents(wind_dir, rwy_hdg, wind_ms) {
  const rel = (wind_dir - rwy_hdg) * Math.PI / 180;
  const head  = wind_ms * Math.cos(rel);
  const cross = wind_ms * Math.sin(rel);
  return { headwind: Math.max(0, head), tailwind: Math.max(0, -head), crosswind: Math.abs(cross) };
}

/* ----- 顺风 / 顶风修正 ----- */
function tailwindFactor(tw_ms) {
  if (tw_ms <= 0) return 1;
  return Math.pow(1.2, tw_ms / 2.5);
}
function headwindFactor(hw_ms) {
  if (hw_ms <= 0) return 1;
  return Math.max(0.5, Math.pow(0.9, hw_ms / 2.5));
}

/* ----- 坡度修正 ----- */
function slopeFactorRoll(slope_pct) {
  if (slope_pct <= 0) return 1 - Math.abs(slope_pct) * 0.035;
  return 1 + slope_pct * 0.035;
}
function slopeFactorDist(slope_pct) {
  if (slope_pct <= 0) return 1 - Math.abs(slope_pct) * 0.03;
  return 1 + slope_pct * 0.03;
}

/* ----- 表面修正 ----- */
function surfaceFactors(surface) {
  const map = {
    paved_dry:   { roll: 1.00, dist: 1.00 },
    paved_wet:   { roll: 1.10, dist: 1.07 },
    grass_short: { roll: 1.10, dist: 1.05 },
    grass_long:  { roll: 1.20, dist: 1.17 },
    wet_grass:   { roll: 1.30, dist: 1.20 },
    wet_soil:    { roll: 1.16, dist: 1.10 }
  };
  return map[surface] || map.paved_dry;
}

/* ----- 起飞性能表 (POH §5.2.1) — DA 单位 ft (内部) ----- */
const TO_DATA = {
  0: [
    { mass:400, roll:[[0,120],[8000,300]], dist:[[0,200],[8000,520]] },
    { mass:450, roll:[[0,150],[8000,360]], dist:[[0,240],[8000,610]] },
    { mass:500, roll:[[0,180],[8000,440]], dist:[[0,290],[8000,720]] },
    { mass:550, roll:[[0,200],[8000,520]], dist:[[0,330],[8000,830]] },
    { mass:600, roll:[[0,211],[8000,610]], dist:[[0,340],[8000,950]] }
  ],
  15: [
    { mass:400, roll:[[0, 80],[8000,250]], dist:[[0,180],[8000,440]] },
    { mass:450, roll:[[0,100],[8000,300]], dist:[[0,210],[8000,520]] },
    { mass:500, roll:[[0,120],[8000,360]], dist:[[0,240],[8000,610]] },
    { mass:550, roll:[[0,140],[8000,420]], dist:[[0,260],[8000,700]] },
    { mass:600, roll:[[0,150],[8000,480]], dist:[[0,274],[8000,790]] }
  ]
};

/* ----- 着陆性能表 (POH §5.2.2) — DA 单位 ft (内部) ----- */
const LD_DATA = {
  15: [
    { mass:400, roll:[[0, 70],[8000,200]], dist:[[0,165],[8000,400]] },
    { mass:450, roll:[[0, 85],[8000,225]], dist:[[0,200],[8000,470]] },
    { mass:500, roll:[[0,100],[8000,250]], dist:[[0,250],[8000,540]] },
    { mass:550, roll:[[0,115],[8000,275]], dist:[[0,310],[8000,620]] },
    { mass:600, roll:[[0,128],[8000,300]], dist:[[0,393],[8000,710]] }
  ],
  30: [
    { mass:400, roll:[[0, 90],[8000,225]], dist:[[0,150],[8000,370]] },
    { mass:450, roll:[[0,105],[8000,255]], dist:[[0,180],[8000,440]] },
    { mass:500, roll:[[0,120],[8000,285]], dist:[[0,220],[8000,520]] },
    { mass:550, roll:[[0,138],[8000,310]], dist:[[0,290],[8000,600]] },
    { mass:600, roll:[[0,153],[8000,335]], dist:[[0,364],[8000,680]] }
  ]
};

function interpPerformance(data, mass, da_ft) {
  const masses = data.map(d => d.mass);
  const massC = Math.max(masses[0], Math.min(mass, masses[masses.length - 1]));
  const daC   = Math.max(0, Math.min(da_ft, 8000));

  let idx = 0;
  for (let i = 0; i < masses.length - 1; i++) {
    if (massC >= masses[i] && massC <= masses[i + 1]) { idx = i; break; }
  }
  const lo = data[idx];
  const hi = data[idx + 1] || data[idx];
  const mFrac = masses[idx + 1] && masses[idx + 1] !== masses[idx]
    ? (massC - masses[idx]) / (masses[idx + 1] - masses[idx]) : 0;

  const lerp = (a, b, t) => a + (b - a) * t;
  const t = daC / 8000;
  const rollLo = lerp(lo.roll[0][1], lo.roll[1][1], t);
  const rollHi = lerp(hi.roll[0][1], hi.roll[1][1], t);
  const distLo = lerp(lo.dist[0][1], lo.dist[1][1], t);
  const distHi = lerp(hi.dist[0][1], hi.dist[1][1], t);

  return { roll: lerp(rollLo, rollHi, mFrac), dist: lerp(distLo, distHi, mFrac) };
}
function takeoffDistance(flap, mass, da_ft) {
  return interpPerformance(TO_DATA[flap], mass, da_ft);
}
function landingDistance(flap, mass, da_ft) {
  return interpPerformance(LD_DATA[flap], mass, da_ft);
}

/* 失速速度 (POH §5.1.1 / §4) — 输出 kt
   重量修正公式：V = V_POH × √(Current Weight / Reference Weight)
   Reference Weight = 600 kg (MTOW)
   V_POH 表（IAS, kt, 参考重量 600 kg）：
     -6° = 49   0° = 47   15° = 44   30° = 42   35° = 42
*/
function stallSpeed(flap_deg, mass) {
  let vPoh;
  if (flap_deg >= 35)      vPoh = 42;
  else if (flap_deg >= 30) vPoh = 42;
  else if (flap_deg >= 15) vPoh = 44;
  else if (flap_deg >= 0)  vPoh = 47;
  else                     vPoh = 49;  /* -6° (full up) */
  return vPoh * Math.sqrt(mass / 600);
}


/* ============================================================
   2) DOM 工具 / Tabs 切换
   ============================================================ */
function $(id)        { return document.getElementById(id); }
function num(id, fb)  { const v = parseFloat($(id).value); return isNaN(v) ? fb : v; }
function setText(id, t){ const el = $(id); if (el) el.textContent = t; }
function setVal(id, v){ const el = $(id); if (el) el.value = v; }
function setHTML(id, h){ const el = $(id); if (el) el.innerHTML = h; }

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', ['to', 'ld'][i] === name);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === 'tab-' + name);
  });
}


/* ============================================================
   3) 起飞计算 calcTakeoff
   ============================================================ */
function calcTakeoff() {
  const elev_m = num('to_elev_m', 0);
  const qnh    = num('to_qnh', QNH_STD);
  const oat_c  = num('to_oat_c', 15);
  const tow    = num('to_tow', MTOW);

  const pa_m = pressureAltitudeM(elev_m, qnh);
  setVal('to_pa_m', Math.round(pa_m));

  const da_m = densityAltitudeM(pa_m, oat_c);
  setVal('to_da_m', Math.round(da_m));

  const flap  = parseInt($('to_flap').value);
  const surf  = $('to_surface').value;
  const slope = num('to_slope', 0);
  const surfF = surfaceFactors(surf);

  const wdir   = num('to_wind_dir', 0);
  const rwyhdg = num('to_rwy_hdg', 0);
  const wms    = num('to_wind_ms', 0);
  const wc = windComponents(wdir, rwyhdg, wms);
  setVal('to_crosswind_out', wc.crosswind.toFixed(1));

  const da_ft = da_m * FT_PER_M;
  const base = takeoffDistance(flap, tow, da_ft);
  const twF = wc.tailwind > 0 ? tailwindFactor(wc.tailwind) : headwindFactor(wc.headwind);
  const rollCorrected = base.roll * twF * slopeFactorRoll(slope) * surfF.roll;
  const distCorrected = base.dist * twF * slopeFactorDist(slope) * surfF.dist;

  setText('to_roll', Math.round(rollCorrected) + ' m');
  setText('to_dist', Math.round(distCorrected) + ' m');

  /* 警告 */
  let wHtml = '';
  if (tow > MTOW) wHtml += '<div class="warning danger">⚠ 起飞重量 ' + tow + ' kg 超出 MTOW ' + MTOW + ' kg！<span class="en">TOW exceeds limit</span></div>';
  if (wc.tailwind > TAILWIND_LIMIT_MS) wHtml += '<div class="warning danger">⚠ 顺风 ' + wc.tailwind.toFixed(1) + ' m/s 超出 POH 限制 (≈5 节)<span class="en">Tailwind exceeds 5 kt limit</span></div>';
  else if (wc.tailwind > 0) wHtml += '<div class="warning caution">⚠ 存在顺风 ' + wc.tailwind.toFixed(1) + ' m/s (POH 限制 ≈5 节)<span class="en">Tailwind present</span></div>';
  if (wc.crosswind > CROSSWIND_LIMIT_STRONG_MS) wHtml += '<div class="warning danger">⚠ 侧风 ' + wc.crosswind.toFixed(1) + ' m/s 较大，请参考 POH 演示数据<span class="en">Strong crosswind</span></div>';
  else if (wc.crosswind > CROSSWIND_LIMIT_CAUTION_MS) wHtml += '<div class="warning caution">⚠ 侧风 ' + wc.crosswind.toFixed(1) + ' m/s 较强<span class="en">Strong crosswind</span></div>';
  if (da_m > 2300) wHtml += '<div class="warning caution">⚠ 密度高度 ' + Math.round(da_m) + ' m 较高，性能显著下降<span class="en">High density altitude</span></div>';
  if (!wHtml) wHtml = '<div class="warning success">✓ 起飞参数符合限制<span class="en">Takeoff within limits</span></div>';
  setHTML('warnings_to', wHtml);

  /* 跑道分析 */
  const r = num('to_runway_avail', 0);
  if (r <= 0) {
    setText('a_to_roll_pct', '--%');
    setText('a_to_dist_pct', '--%');
    setText('a_to_remaining', '--');
    const remEl = $('a_to_remaining');
    if (remEl) remEl.className = 'val';
  } else {
    const rollPct = (rollCorrected / r) * 100;
    const distPct = (distCorrected / r) * 100;
    const remain  = r - distCorrected;
    setText('a_to_roll_pct', rollPct.toFixed(0) + '%');
    setText('a_to_dist_pct', distPct.toFixed(0) + '%');
    const remEl = $('a_to_remaining');
    if (remEl) {
      remEl.textContent = (remain >= 0 ? '+' : '') + Math.round(remain) + ' m';
      remEl.className = 'val ' + (remain >= 0 ? 'ok' : 'danger');
    }
  }

  /* 跑道示意图 */
  renderTakeoffDiagram(rollCorrected, distCorrected, num('to_runway_avail', 0));
}


/* ============================================================
   4) 着陆计算 calcLanding
   ============================================================ */
/* 着陆安全状态仅判断"Stop Point 是否超过 LDA"，不再设置安全余量阈值 */

function calcLanding() {
  const elev_m = num('ld_elev_m', 0);
  const qnh    = num('ld_qnh', QNH_STD);
  const oat_c  = num('ld_oat_c', 15);
  const ldw    = num('ld_ldw', MLW);

  const pa_m = pressureAltitudeM(elev_m, qnh);
  setVal('ld_pa_m', Math.round(pa_m));

  const da_m = densityAltitudeM(pa_m, oat_c);
  setVal('ld_da_m', Math.round(da_m));

  const flap  = parseInt($('ld_flap').value);
  const surf  = $('ld_surface').value;
  const slope = num('ld_slope', 0);
  const surfF = surfaceFactors(surf);

  const wdir   = num('ld_wind_dir', 0);
  const rwyhdg = num('ld_rwy_hdg', 0);
  const wms    = num('ld_wind_ms', 0);
  const wc = windComponents(wdir, rwyhdg, wms);
  setVal('ld_crosswind_out', wc.crosswind.toFixed(1));

  /* 速度：VS0 / VREF */
  const vs0Kt  = stallSpeed(flap, ldw);
  const vrefKt = vs0Kt * 1.3;
  setText('ld_vs0',  Math.round(vs0Kt)  + ' kt');
  setText('ld_vref', Math.round(vrefKt) + ' kt');

  const da_ft = da_m * FT_PER_M;
  const base = landingDistance(flap, ldw, da_ft);
  const twF = wc.tailwind > 0 ? tailwindFactor(wc.tailwind) : headwindFactor(wc.headwind);
  const rollCorrected = base.roll * twF * slopeFactorRoll(slope) * surfF.roll;
  const distCorrected = base.dist * twF * slopeFactorDist(slope) * surfF.dist;

  setText('ld_roll', Math.round(rollCorrected) + ' m');
  setText('ld_dist', Math.round(distCorrected) + ' m');

  /* Touchdown Offset (Advanced) */
  const tdOffset = Math.max(0, num('ld_td_offset', 0));
  const stopPoint = distCorrected + tdOffset;

  /* 警告 */
  let wHtml = '';
  if (ldw > MLW) wHtml += '<div class="warning danger">⚠ 着陆重量 ' + ldw + ' kg 超出 MLW ' + MLW + ' kg！<span class="en">LDW exceeds limit</span></div>';
  if (wc.tailwind > TAILWIND_LIMIT_MS) wHtml += '<div class="warning danger">⚠ 顺风 ' + wc.tailwind.toFixed(1) + ' m/s 超出 POH 限制 (≈5 节)<span class="en">Tailwind exceeds 5 kt limit</span></div>';
  else if (wc.tailwind > 0) wHtml += '<div class="warning caution">⚠ 存在顺风 ' + wc.tailwind.toFixed(1) + ' m/s (POH 限制 ≈5 节)<span class="en">Tailwind present</span></div>';
  if (wc.crosswind > CROSSWIND_LIMIT_STRONG_MS) wHtml += '<div class="warning danger">⚠ 侧风 ' + wc.crosswind.toFixed(1) + ' m/s 较大<span class="en">Strong crosswind</span></div>';
  else if (wc.crosswind > CROSSWIND_LIMIT_CAUTION_MS) wHtml += '<div class="warning caution">⚠ 侧风 ' + wc.crosswind.toFixed(1) + ' m/s 较强<span class="en">Strong crosswind</span></div>';
  if (da_m > 2300) wHtml += '<div class="warning caution">⚠ 密度高度 ' + Math.round(da_m) + ' m 较高，性能显著下降<span class="en">High density altitude</span></div>';
  if (!wHtml) wHtml = '<div class="warning success">✓ 着陆参数符合限制<span class="en">Landing within limits</span></div>';
  setHTML('warnings_ld', wHtml);

  /* 跑道分析 */
  const lda = num('ld_runway_avail', 0);
  const remEl = $('a_ld_remaining');
  if (lda <= 0) {
    setText('a_ld_roll_pct', '--%');
    setText('a_ld_dist_pct', '--%');
    if (remEl) { remEl.textContent = '--'; remEl.className = 'val'; }
  } else {
    const rollPct = (rollCorrected / lda) * 100;
    const distPct = (stopPoint    / lda) * 100;
    const remain  = lda - stopPoint;
    setText('a_ld_roll_pct', rollPct.toFixed(0) + '%');
    setText('a_ld_dist_pct', distPct.toFixed(0) + '%');
    if (remEl) {
      remEl.textContent = (remain >= 0 ? '+' : '') + Math.round(remain) + ' m';
      remEl.className = 'val ' + (remain >= 0 ? 'ok' : 'danger');
    }
  }

  /* 着陆安全状态 */
  const stEl = $('ld_status');
  if (stEl) {
    if (lda <= 0) {
      stEl.className = 'ld-status neutral';
      stEl.innerHTML = '<span class="icon">📏</span><span class="txt">请输入 LDA 后显示安全状态<span class="en">Enter LDA to display safety status</span></span>';
    } else if (stopPoint > lda) {
      const over = Math.round(stopPoint - lda);
      stEl.className = 'ld-status danger';
      stEl.innerHTML = '<span class="icon">🔴</span><span class="txt">着陆跑道超出！超界 ' + over + ' m<span class="en">Landing Runway Exceeded — Stop Point ' + Math.round(stopPoint) + ' m &gt; LDA ' + Math.round(lda) + ' m</span></span>';
    } else {
      const remain = Math.round(lda - stopPoint);
      stEl.className = 'ld-status ok';
      stEl.innerHTML = '<span class="icon">✅</span><span class="txt">跑道可用：剩余 ' + remain + ' m<span class="en">Landing Within LDA — ' + remain + ' m remaining</span></span>';
    }
  }

  /* 跑道示意图 */
  renderLandingDiagram(rollCorrected, distCorrected, lda, tdOffset);
}


/* ============================================================
   5) 跑道示意图 — Top-down SVG
      100% 长度 = TORA (起飞) / LDA (着陆)
   ============================================================ */

/* ----- 公共：顶部 TORA/LDA 量尺 ----- */
function svgTopRuler(W, padL, endX, total, totalLabel) {
  let s = '';
  s += '<line x1="' + padL + '" y1="20" x2="' + endX + '" y2="20" stroke="#0d3b66" stroke-width="1"/>';
  s += '<line x1="' + padL + '" y1="16" x2="' + padL + '" y2="24" stroke="#0d3b66" stroke-width="1"/>';
  s += '<line x1="' + endX  + '" y1="16" x2="' + endX  + '" y2="24" stroke="#0d3b66" stroke-width="1"/>';
  const cx = (padL + endX) / 2;
  const label = totalLabel + ' ' + Math.round(total) + ' m';
  s += '<rect x="' + (cx - 80) + '" y="10" width="160" height="16" fill="#fff"/>';
  s += '<text x="' + cx + '" y="22" text-anchor="middle" fill="#0d3b66" font-size="11" font-weight="600" font-family="\'PingFang SC\',sans-serif">' + label + '</text>';
  return s;
}

/* ----- 公共：Threshold 标记 ----- */
function svgThreshold(W, padL, rwyY, rwyTop, text) {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const ty = rwyTop + 3 + i * 7;
    s += '<line x1="' + (padL - 6) + '" y1="' + ty + '" x2="' + (padL - 1) + '" y2="' + (ty + 3) + '" stroke="#5a6a7c" stroke-width="1"/>';
  }
  s += '<text x="' + (padL - 9) + '" y="' + (rwyY + 3) + '" text-anchor="end" fill="#5a6a7c" font-size="10" font-family="\'PingFang SC\',sans-serif">' + text + '</text>';
  return s;
}

/* ----- 公共：剩余跑道 + 15m Obstacle 旗 ----- */
function svgRemainingAndObstacle(padL, endX, rwyTop, rwyBot, rwyY, labelText) {
  /* 旗杆 + 三角旗 */
  let s = '';
  const fx = padL;
  s += '<rect x="' + (fx - 3) + '" y="' + (rwyTop - 32) + '" width="5" height="' + (rwyBot - rwyTop + 32) + '" fill="#722ed1" stroke="#531dab" stroke-width="1"/>';
  s += '<polygon points="' + (fx + 2) + ',' + (rwyTop - 30) + ' ' + (fx + 18) + ',' + (rwyTop - 22) + ' ' + (fx + 2) + ',' + (rwyTop - 14) + '" fill="#722ed1" stroke="#531dab" stroke-width="1"/>';
  s += '<text x="' + (fx + 22) + '" y="' + (rwyY - 5) + '" text-anchor="start" fill="#531dab" font-size="10" font-weight="600" font-family="\'PingFang SC\',sans-serif">15 m</text>';
  s += '<text x="' + (fx + 22) + '" y="' + (rwyY + 7) + '" text-anchor="start" fill="#531dab" font-size="9" font-family="\'PingFang SC\',sans-serif">' + labelText + '</text>';
  return s;
}

/* ----- 公共：分割虚线 ----- */
function svgDashedLine(x, yTop, yBot, color) {
  return '<line x1="' + x + '" y1="' + yTop + '" x2="' + x + '" y2="' + yBot + '" stroke="' + color + '" stroke-width="1.2" stroke-dasharray="3 3"/>';
}

/* ----- 公共：飞机（小图标，侧视指向爬升方向，可旋转） ----- */
function svgPlane(x, y, color) {
  let s = '<g transform="translate(' + x + ',' + y + ') scale(1.05)" fill="' + color + '" stroke="#fff" stroke-width="0.7" stroke-linejoin="round">';
  s +=   '<ellipse cx="0" cy="-0.5" rx="9" ry="1.6"/>';
  s +=   '<path d="M 9 -1.6 L 12 -0.4 L 12 0.4 L 9 1.6 Z"/>';
  s +=   '<rect x="-5" y="1.6" width="9" height="1.4" rx="0.7"/>';
  s +=   '<path d="M -8 -1.8 L -5 -1.8 L -4 -6 L -9 -6 Z"/>';
  s +=   '<ellipse cx="4" cy="-0.8" rx="2.5" ry="0.9" fill="#fff" stroke="none"/>';
  s += '</g>';
  return s;
}


/* ----- 起飞示意图 ----- */
function renderTakeoffDiagram(roll, dist, tora) {
  const svg = $('takeoff-diagram');
  if (!svg) return;

  const W = 800, H = 180;
  const padL = 50, padR = 50;
  const rwyY = 95, rwyH = 40;
  const rwyTop = rwyY - rwyH / 2;
  const rwyBot = rwyY + rwyH / 2;
  const runwayW = W - padL - padR;
  const endX = padL + runwayW;

  if (!tora || tora <= 0 || !roll || !dist || roll <= 0 || dist <= 0) {
    svg.innerHTML = '<text x="' + (W / 2) + '" y="' + (H / 2) + '" text-anchor="middle" fill="#98a4b0" font-size="12" font-family="\'PingFang SC\',sans-serif">输入 TORA 后显示跑道示意图</text>';
    return;
  }

  const m2px = runwayW / tora;
  const rollPx = roll * m2px;
  const distPx = dist * m2px;
  const liftoffX = padL + rollPx;
  const obstacleX = padL + distPx;

  let s = '';
  s += svgTopRuler(W, padL, endX, tora, 'TORA');

  /* 跑道底色 */
  s += '<rect x="' + padL + '" y="' + rwyTop + '" width="' + runwayW + '" height="' + rwyH + '" fill="#f0f3f7" stroke="#cdd9e6" stroke-width="1"/>';

  /* Ground Roll 段 */
  const rollW = Math.min(rollPx, runwayW);
  s += '<rect x="' + padL + '" y="' + rwyTop + '" width="' + rollW + '" height="' + rwyH + '" fill="#1a5a92"/>';

  /* Airborne 段 */
  if (distPx > rollPx && obstacleX <= endX) {
    const airX = liftoffX;
    const airW = obstacleX - airX;
    s += '<rect x="' + airX + '" y="' + rwyTop + '" width="' + airW + '" height="' + rwyH + '" fill="#237804"/>';
  }

  /* Remaining 段 */
  if (obstacleX < endX) {
    const remX = obstacleX;
    const remW = endX - obstacleX;
    s += '<rect x="' + remX + '" y="' + rwyTop + '" width="' + remW + '" height="' + rwyH + '" fill="#bfbfbf"/>';
  }

  /* 超界警示 */
  if (obstacleX > endX) {
    s += '<rect x="' + padL + '" y="' + rwyTop + '" width="' + runwayW + '" height="' + rwyH + '" fill="url(#dangerPattern)" opacity="0.55"/>';
    s += '<defs><pattern id="dangerPattern" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">' +
         '<rect width="8" height="8" fill="#cf1322"/>' +
         '<line x1="0" y1="0" x2="0" y2="8" stroke="#fff" stroke-width="2"/>' +
         '</pattern></defs>';
  }

  /* 中心虚线 */
  s += '<line x1="' + padL + '" y1="' + rwyY + '" x2="' + endX + '" y2="' + rwyY + '" stroke="#fff" stroke-width="1.5" stroke-dasharray="6 4"/>';

  /* Threshold */
  s += svgThreshold(W, padL, rwyY, rwyTop, 'Threshold');

  /* Lift-off 分割线 + 飞机 */
  s += svgDashedLine(liftoffX, rwyTop - 8, rwyBot + 8, '#1a5a92');
  s += svgPlane(liftoffX, rwyY - 4, '#237804');

  /* Lift-off 标签 */
  s += '<text x="' + liftoffX + '" y="' + (rwyBot + 30) + '" text-anchor="middle" fill="#1a5a92" font-size="10" font-weight="600" font-family="\'PingFang SC\',sans-serif">Lift-off ' + Math.round(roll) + ' m</text>';

  /* 爬升轨迹 */
  const midX = (liftoffX + obstacleX) / 2;
  const peakY = rwyTop - 28;
  s += '<path d="M ' + (liftoffX + 6) + ' ' + (rwyY - 5) + ' Q ' + midX + ' ' + peakY + ' ' + (obstacleX - 8) + ' ' + (rwyTop - 18) + '" stroke="#237804" stroke-width="1.3" stroke-dasharray="3 2" fill="none"/>';

  /* 15m Obstacle */
  s += svgRemainingAndObstacle(obstacleX, endX, rwyTop, rwyBot, rwyY, 'Obstacle');
  s += '<text x="' + obstacleX + '" y="' + (rwyBot + 48) + '" text-anchor="middle" fill="#531dab" font-size="10" font-weight="600" font-family="\'PingFang SC\',sans-serif">Takeoff Dist ' + Math.round(dist) + ' m</text>';

  /* Ground Roll 段标签 */
  if (rollPx > 50) {
    const cx = padL + rollPx / 2;
    s += '<text x="' + cx + '" y="' + (rwyBot + 14) + '" text-anchor="middle" fill="#fff" font-size="10" font-weight="700" font-family="\'PingFang SC\',sans-serif">Ground Roll</text>';
  }
  /* Airborne 段标签 */
  if (distPx - rollPx > 40 && obstacleX <= endX) {
    const cx = (liftoffX + obstacleX) / 2;
    s += '<text x="' + cx + '" y="' + (rwyY + 4) + '" text-anchor="middle" fill="#fff" font-size="9" font-weight="700" font-family="\'PingFang SC\',sans-serif">AIRBORNE</text>';
  }
  /* Remaining 段标签 */
  if (endX - obstacleX > 60) {
    const cx = (obstacleX + endX) / 2;
    s += '<text x="' + cx + '" y="' + (rwyY + 4) + '" text-anchor="middle" fill="#5a6a7c" font-size="9" font-weight="600" font-family="\'PingFang SC\',sans-serif">Remaining</text>';
    s += '<text x="' + cx + '" y="' + (rwyBot + 14) + '" text-anchor="middle" fill="#5a6a7c" font-size="9" font-family="\'PingFang SC\',sans-serif">' + Math.round(endX - obstacleX) + ' m</text>';
  }

  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.innerHTML = s;
}


/* ----- 着陆示意图 -----
   设计：100% = LDA
   • 飞机图标固定在 Touchdown
   • 绿色轨迹从 Touchdown → Stop Point（Ground Roll）
   • Stop Point 标 "Landing Distance End / Stop Point"
   • 灰色 Remaining 从 Stop Point → Runway End
   • 无 15m Obstacle 旗、无进近飞行的弧线轨迹
*/
function renderLandingDiagram(roll, dist, lda, tdOffset) {
  const svg = $('ld-diagram');
  if (!svg) return;

  const W = 800, H = 180;
  const padL = 50, padR = 50;
  const rwyY = 95, rwyH = 40;
  const rwyTop = rwyY - rwyH / 2;
  const rwyBot = rwyY + rwyH / 2;
  const runwayW = W - padL - padR;
  const endX = padL + runwayW;

  if (!lda || lda <= 0 || !roll || !dist || roll <= 0 || dist <= 0) {
    svg.innerHTML = '<text x="' + (W / 2) + '" y="' + (H / 2) + '" text-anchor="middle" fill="#98a4b0" font-size="12" font-family="\'PingFang SC\',sans-serif">输入 LDA 后显示着陆示意图</text>';
    return;
  }

  tdOffset = tdOffset || 0;
  const m2px = runwayW / lda;
  const rollPx = roll * m2px;
  /* Stop Point = Landing Distance + Touchdown Offset */
  const stopX    = padL + (dist + tdOffset) * m2px;
  /* Touchdown = Stop Point − Ground Roll（Ground Roll 长度保持不变） */
  const touchX   = stopX - rollPx;

  let s = '';
  s += svgTopRuler(W, padL, endX, lda, 'LDA');

  /* 跑道底色 */
  s += '<rect x="' + padL + '" y="' + rwyTop + '" width="' + runwayW + '" height="' + rwyH + '" fill="#f0f3f7" stroke="#cdd9e6" stroke-width="1"/>';

  /* Ground Roll 段（Touchdown → Stop Point）— 绿色 */
  if (touchX < stopX) {
    const grX = Math.max(padL, Math.min(touchX, endX));
    const grEnd = Math.max(padL, Math.min(stopX, endX));
    const grW = grEnd - grX;
    if (grW > 0) {
      s += '<rect x="' + grX + '" y="' + rwyTop + '" width="' + grW + '" height="' + rwyH + '" fill="#237804"/>';
    }
  }
  /* Remaining 段（Stop Point → 跑道末端）— 灰色 */
  if (stopX < endX) {
    s += '<rect x="' + Math.max(padL, stopX) + '" y="' + rwyTop + '" width="' + (endX - Math.max(padL, stopX)) + '" height="' + rwyH + '" fill="#bfbfbf"/>';
  }

  /* 超界警示（Stop Point 在跑道之外） */
  if (stopX > endX) {
    s += '<rect x="' + padL + '" y="' + rwyTop + '" width="' + runwayW + '" height="' + rwyH + '" fill="url(#dangerPatternLD)" opacity="0.55"/>';
    s += '<defs><pattern id="dangerPatternLD" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">' +
         '<rect width="8" height="8" fill="#cf1322"/>' +
         '<line x1="0" y1="0" x2="0" y2="8" stroke="#fff" stroke-width="2"/>' +
         '</pattern></defs>';
  }

  /* 中心虚线 */
  s += '<line x1="' + padL + '" y1="' + rwyY + '" x2="' + endX + '" y2="' + rwyY + '" stroke="#fff" stroke-width="1.5" stroke-dasharray="6 4"/>';

  /* Threshold */
  s += svgThreshold(W, padL, rwyY, rwyTop, 'Threshold');

  /* Touchdown 分割线 + 飞机图标（位于 Touchdown） */
  if (touchX >= padL - 1 && touchX <= endX + 1) {
    s += svgDashedLine(touchX, rwyTop - 8, rwyBot + 8, '#1a5a92');
    s += svgPlane(touchX, rwyY - 4, '#237804');
    s += '<text x="' + touchX + '" y="' + (rwyBot + 30) + '" text-anchor="middle" fill="#237804" font-size="10" font-weight="600" font-family="\'PingFang SC\',sans-serif">Touchdown</text>';
  }

  /* Stop Point 标记 + 标签 */
  if (stopX >= padL - 1 && stopX <= endX + 1) {
    s += svgDashedLine(stopX, rwyTop - 8, rwyBot + 8, '#722ed1');
    s += '<text x="' + stopX + '" y="' + (rwyBot + 50) + '" text-anchor="middle" fill="#531dab" font-size="10" font-weight="600" font-family="\'PingFang SC\',sans-serif">Stop Point / Landing Distance End</text>';
    /* Stop Point 主标签：距离值 */
    const labelY = (rwyBot + 14);
    s += '<text x="' + stopX + '" y="' + labelY + '" text-anchor="middle" fill="#531dab" font-size="10" font-weight="700" font-family="\'PingFang SC\',sans-serif">' + Math.round(dist + tdOffset) + ' m</text>';
  } else if (stopX > endX) {
    /* Stop Point 跑到跑道外：把标签放到跑道末端内侧 */
    s += '<text x="' + (endX - 4) + '" y="' + (rwyBot + 50) + '" text-anchor="end" fill="#cf1322" font-size="10" font-weight="600" font-family="\'PingFang SC\',sans-serif">Stop Point 超出跑道 ' + Math.round(stopX - endX) + ' m</text>';
  }

  /* Ground Roll 段标签 */
  if (stopX - touchX > 40 && touchX >= padL && stopX <= endX) {
    const cx = touchX + (stopX - touchX) / 2;
    s += '<text x="' + cx + '" y="' + (rwyY + 4) + '" text-anchor="middle" fill="#fff" font-size="9" font-weight="700" font-family="\'PingFang SC\',sans-serif">GROUND ROLL</text>';
    s += '<text x="' + cx + '" y="' + (rwyBot + 14) + '" text-anchor="middle" fill="#fff" font-size="9" font-weight="600" font-family="\'PingFang SC\',sans-serif">' + Math.round(roll) + ' m</text>';
  }
  /* Remaining 段标签 */
  if (endX - stopX > 60) {
    const cx = stopX + (endX - stopX) / 2;
    s += '<text x="' + cx + '" y="' + (rwyY + 4) + '" text-anchor="middle" fill="#5a6a7c" font-size="9" font-weight="600" font-family="\'PingFang SC\',sans-serif">Remaining</text>';
    s += '<text x="' + cx + '" y="' + (rwyBot + 14) + '" text-anchor="middle" fill="#5a6a7c" font-size="9" font-family="\'PingFang SC\',sans-serif">' + Math.round(endX - stopX) + ' m</text>';
  }

  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.innerHTML = s;
}


/* ============================================================
   6) 主入口 / 初始化
   ============================================================ */
function calcAll() {
  calcTakeoff();
  calcLanding();
}

(function init() {
  function firstRun() {
    /* === 用户显式要求：跨表数据载入 ===
       - 起飞重量 ← 载重平衡页面发布的 ctls_tow
       - 着陆重量 = 起飞重量 − 燃油计划页面地面运转燃油重量 + 燃油计划页面航程油耗重量 */
    try {
      const tow = parseFloat(localStorage.getItem('ctls_tow'));
      const gop = parseFloat(localStorage.getItem('ctls_ground_op_kg'));
      const trp = parseFloat(localStorage.getItem('ctls_trip_kg'));
      if (isFinite(tow) && tow > 0) {
        const el = document.getElementById('to_tow');
        if (el) el.value = tow.toFixed(1);
      }
      if (isFinite(tow) && isFinite(gop) && isFinite(trp)) {
        const ldw = tow - gop - trp;
        const el = document.getElementById('ld_ldw');
        if (el && isFinite(ldw) && ldw > 0) el.value = ldw.toFixed(1);
      }
    } catch(e){}
    calcAll();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', firstRun);
  } else {
    firstRun();
  }
})();
