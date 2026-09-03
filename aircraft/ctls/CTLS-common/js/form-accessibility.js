(function() {
  'use strict';
  function clean(text) { return String(text || '').replace(/\s+/g, ' ').trim(); }
  function tableLabel(control) {
    var cell = control.closest('td,th'), row = control.closest('tr'), table = control.closest('table');
    if (!cell || !row || !table) return '';
    var firstCell = row.querySelector('th,td');
    var headers = table.querySelectorAll('thead th');
    var column = headers[cell.cellIndex];
    return clean((firstCell && firstCell !== cell ? firstCell.textContent : '') + ' ' + (column ? column.textContent : ''));
  }
  function inferLabel(control) {
    var wrap = control.closest('.fld,.input-card,.mob-field,.field-row,.sel-row');
    if (wrap) {
      var label = wrap.querySelector('label,.field-label,.input-label,.lbl,.card-title,.mob-field-label');
      if (label) return clean(label.textContent);
    }
    return tableLabel(control) || clean(control.id.replace(/_/g, ' '));
  }
  document.querySelectorAll('input[id],select[id],textarea[id]').forEach(function(control) {
    if (!control.getAttribute('aria-label') && !control.getAttribute('aria-labelledby') && !control.closest('label')) {
      var label = inferLabel(control);
      if (label) control.setAttribute('aria-label', label);
    }
    if (control.readOnly) control.setAttribute('aria-readonly', 'true');
  });
  var chartLabels = { cgChart:'重量与重心包线图', cgChartMob:'重量与重心包线图', 'takeoff-diagram':'起飞跑道距离示意图', 'ld-diagram':'着陆跑道距离示意图' };
  Object.keys(chartLabels).forEach(function(id) {
    var graphic = document.getElementById(id);
    if (graphic) { graphic.setAttribute('role', 'img'); graphic.setAttribute('aria-label', chartLabels[id]); }
  });
})();
