(function(){
  'use strict';
  var topbar = document.querySelector('.topbar');
  if (!topbar) return;
  var style = document.createElement('style');
  style.textContent = [
    '.aircraft-switch-link{margin-left:14px;height:30px;padding:0 13px;display:inline-flex;align-items:center;gap:6px;',
    'color:#e8f7ff;text-decoration:none;font-size:11px;font-weight:650;white-space:nowrap;',
    'border:1px solid rgba(255,255,255,.34);border-radius:8px;background:rgba(6,31,48,.52);backdrop-filter:blur(8px)}',
    '.aircraft-switch-link:hover{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.6)}',
    '.aircraft-switch-link:focus{outline:2px solid #fff;outline-offset:2px}',
    '@media(max-width:760px){.aircraft-switch-link{margin-left:auto;height:32px;padding:0 11px;font-size:10px}.topbar .status{display:none}}',
    '@media print{.aircraft-switch-link{display:none!important}}'
  ].join('');
  document.head.appendChild(style);
  var link = document.createElement('a');
  link.className = 'aircraft-switch-link';
  link.href = '../../index.html';
  link.setAttribute('aria-label','切换机型');
  link.innerHTML = '<span aria-hidden="true">⇄</span><span>切换机型</span>';
  topbar.appendChild(link);
})();
