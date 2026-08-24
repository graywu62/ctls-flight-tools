(function(global) {
  'use strict';

  const STORAGE_KEY = 'ctls_flight_plan_v1';
  const SCHEMA_VERSION = 1;
  const MAX_AGE_MS = 48 * 60 * 60 * 1000;

  function finiteNonNegative(value) {
    return Number.isFinite(value) && value >= 0;
  }

  function read() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const plan = JSON.parse(raw);
      if (!plan || plan.schemaVersion !== SCHEMA_VERSION || !Number.isFinite(plan.updatedAt)) return null;
      const age = Date.now() - plan.updatedAt;
      if (age < 0 || age > MAX_AGE_MS) return null;
      return plan;
    } catch (error) {
      return null;
    }
  }

  function update(section, data) {
    try {
      const current = read() || { schemaVersion: SCHEMA_VERSION };
      const next = Object.assign({}, current, { schemaVersion: SCHEMA_VERSION, updatedAt: Date.now() });
      next[section] = Object.assign({}, data, { updatedAt: next.updatedAt });
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    } catch (error) {
      return null;
    }
  }

  function publishWeightBalance(data) {
    if (!data || !finiteNonNegative(data.towKg) || !finiteNonNegative(data.fuelOnBoardL)) return null;
    const next = update('weightBalance', {
      aircraftReg: String(data.aircraftReg || 'custom'),
      towKg: data.towKg,
      fuelOnBoardL: data.fuelOnBoardL
    });
    if (next && next.fuelPlan && Math.abs(next.fuelPlan.sourceFuelOnBoardL - data.fuelOnBoardL) > 0.1) {
      delete next.fuelPlan;
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    return next;
  }

  function publishFuelPlan(data) {
    if (!data || !finiteNonNegative(data.sourceFuelOnBoardL) ||
        !finiteNonNegative(data.groundOpKg) || !finiteNonNegative(data.tripKg)) return null;
    return update('fuelPlan', {
      sourceFuelOnBoardL: data.sourceFuelOnBoardL,
      groundOpKg: data.groundOpKg,
      tripKg: data.tripKg
    });
  }

  global.CTLSFlightPlanStore = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    storageKey: STORAGE_KEY,
    read,
    publishWeightBalance,
    publishFuelPlan
  });
})(window);
