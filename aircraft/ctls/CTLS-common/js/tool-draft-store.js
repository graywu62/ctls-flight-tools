(function(global) {
  'use strict';

  var path = global.location.pathname;
  var moduleId = path.indexOf('CTLS-WB') >= 0 ? 'wb' :
    (path.indexOf('CTLS-FUEL') >= 0 ? 'fuel' :
      (path.indexOf('CTLS-TOL') >= 0 ? 'tol' : ''));
  if (!moduleId) return;

  var key = 'ctls_tool_draft_v1_' + moduleId;
  var sharedManagedIds = { fuel_on_board:true, to_tow:true, ld_ldw:true };
  var restoring = false;

  function fields() {
    return Array.prototype.filter.call(
      document.querySelectorAll('input[id],select[id],textarea[id]'),
      function(el) {
        var type = (el.type || '').toLowerCase();
        return !el.readOnly && !sharedManagedIds[el.id] &&
          type !== 'button' && type !== 'submit' && type !== 'reset' &&
          type !== 'hidden' && type !== 'file';
      }
    );
  }

  function save() {
    if (restoring) return;
    var values = {};
    fields().forEach(function(el) {
      values[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
    });
    try { global.localStorage.setItem(key, JSON.stringify({version:1, values:values})); } catch (e) {}
  }

  function restore() {
    var saved = null;
    try { saved = JSON.parse(global.localStorage.getItem(key)); } catch (e) {}
    if (!saved || saved.version !== 1 || !saved.values) return false;
    restoring = true;
    fields().forEach(function(el) {
      if (!Object.prototype.hasOwnProperty.call(saved.values, el.id)) return;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!saved.values[el.id];
      else el.value = saved.values[el.id];
    });
    restoring = false;
    return true;
  }

  restore();
  document.addEventListener('input', save);
  document.addEventListener('change', save);
  global.addEventListener('pagehide', save);
  global.CTLSToolDraftStore = Object.freeze({ save:save, restore:restore, moduleId:moduleId });
})(window);
