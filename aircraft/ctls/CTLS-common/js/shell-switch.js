(function(){
  'use strict';

  /* ============================================================
     CTLS Shell Switcher
     - 在四个工具页 index.html 的 </body> 前通过 <script> 引入
     - 运行时向各工具自己的 .app-header 右侧注入：
         【工具下拉框】 【打印按钮】
     - 属于 Header 内部的普通 flex 子元素（非 position:fixed，不悬浮）
     - 下拉框切换：location.href 跳转到目标工具的 index.html
     - 打印按钮：window.print()（与各工具原打印逻辑一致，不修改原逻辑）
     - 不修改任何工具页面的现有 HTML / CSS / JS / 布局 / 尺寸 / 字号
     ============================================================ */

  var TARGETS = {
    wb:   '../CTLS-WB/index.html',
    fuel: '../CTLS-FUEL/index.html',
    tol:  '../CTLS-TOL/index.html',
    check:'../CTLS-CHECK/index.html',
    home: '../index.html',
    aircraft: '../../../index.html'
  };

  /* ----- 1) 注入下拉框 + 打印按钮样式（三个工具完全一致）----- */
  var css = [
    /* Header 右侧控件容器：普通 flex 子元素，不改变 Header 高度/宽度 */
    '.tool-switch{',
    '  flex:none;margin-left:auto;',
    '  display:flex;align-items:center;gap:8px;',
    '  position:relative;z-index:2;',
    '}',
    /* 下拉框 —— 三个工具尺寸完全一致 */
    '.tool-switch select{',
    '  appearance:none;-webkit-appearance:none;-moz-appearance:none;',
    '  height:26px;box-sizing:border-box;',
    '  background:rgba(255,255,255,.95);color:#0d3b66;',
    '  border:1px solid rgba(255,255,255,.6);border-radius:6px;',
    '  padding:0 22px 0 8px;font-size:11px;font-weight:600;',
    '  line-height:24px;cursor:pointer;font-family:inherit;',
    "  background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='%230d3b66' d='M5 6L0 0h10z'/></svg>\");",
    '  background-repeat:no-repeat;background-position:right 6px center;',
    '}',
    '.tool-switch select:focus{outline:2px solid #fff;outline-offset:1px}',
    /* 打印按钮 —— 三个工具尺寸完全一致 */
    '.tool-switch .tool-print{',
    '  height:26px;box-sizing:border-box;',
    '  display:inline-flex;align-items:center;gap:4px;',
    '  background:rgba(255,255,255,.95);color:#0d3b66;',
    '  border:1px solid rgba(255,255,255,.6);border-radius:6px;',
    '  padding:0 10px;font-size:11px;font-weight:600;',
    '  line-height:1;cursor:pointer;font-family:inherit;white-space:nowrap;',
    '}',
    '.tool-switch .tool-print:hover{background:#fff}',
    '.tool-switch .tool-print:focus{outline:2px solid #fff;outline-offset:1px}',
    '.tool-switch .tool-print svg{width:13px;height:13px;display:block}',
    /* 桌面 ≥600px：与 Header 同步略微放大字号（不改变 Header 高度基准）*/
    '@media (min-width:600px){',
    '  .tool-switch{gap:10px}',
    '  .tool-switch select{height:28px;line-height:26px;font-size:13px;padding:0 24px 0 10px}',
    '  .tool-switch .tool-print{height:28px;font-size:13px;padding:0 12px}',
    '  .tool-switch .tool-print svg{width:15px;height:15px}',
    '}',
    /* 打印时：保留蓝色 Header，但下拉框与打印按钮都不打印 */
    '@media print{',
    '  .tool-switch{display:none!important}',
    '}'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ----- 2) 仅在三个工具页的 Header 右侧注入控件 ----- */
  var header = document.querySelector('.app-header');
  if (!header) return;

  var wrap = document.createElement('div');
  wrap.className = 'tool-switch';

  /* 2a) 工具下拉框 */
  var sel = document.createElement('select');
  sel.setAttribute('aria-label', '工具');
  [
    { v: 'wb',   t: '载重平衡' },
    { v: 'fuel', t: '燃油计算' },
    { v: 'tol',  t: '起飞性能' },
    { v: 'check',t: '检查单' },
    { v: 'home', t: '返回首页' },
    { v: 'aircraft', t: '切换机型' }
  ].forEach(function(o){
    var op = document.createElement('option');
    op.value = o.v;
    op.textContent = o.t;
    sel.appendChild(op);
  });

  /* 根据当前 URL 自动选中 */
  var p = location.pathname;
  if (p.indexOf('CTLS-WB')   >= 0) sel.value = 'wb';
  else if (p.indexOf('CTLS-FUEL') >= 0) sel.value = 'fuel';
  else if (p.indexOf('CTLS-TOL')  >= 0) sel.value = 'tol';
  else if (p.indexOf('CTLS-CHECK') >= 0) sel.value = 'check';

  sel.addEventListener('change', function(e){
    var url = TARGETS[e.target.value];
    if (url) {
      if (window.CTLSToolDraftStore) window.CTLSToolDraftStore.save();
      location.href = url;
    }
  });

  /* 2b) 打印按钮（与各工具原打印逻辑一致：window.print）*/
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tool-print';
  btn.setAttribute('aria-label', '打印');
  btn.innerHTML =
    "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' " +
    "stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" +
    "<polyline points='6 9 6 2 18 2 18 9'></polyline>" +
    "<path d='M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2'></path>" +
    "<rect x='6' y='14' width='12' height='8'></rect></svg><span>打印</span>";
  btn.addEventListener('click', function(){ window.print(); });

  wrap.appendChild(sel);
  wrap.appendChild(btn);
  header.appendChild(wrap);
})();
