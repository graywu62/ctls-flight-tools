const CG_FWD = 0.325;
const CG_AFT = 0.420;
const MIN_MASS = 300;
const MAX_MASS = 600;
const FUEL_DENSITY = 0.725;
const MAC_LENGTH = 1.280;

const ARM = {
 crew: 0.520,
 baggage: 1.140,
 floor: -0.340,
 wingFuel: 0.210,
 headerFuel: 1.470
};

const DEFAULT_PROFILES = {};

const LIMIT = {
 empty: { min: 300, max: 405 },
 crew: { max: 240 },
 baggage: { max: 50 },
 floor: { max: 5 },
 fuel: { min: 4, max: 130 }
};

const STORAGE_KEY = 'ctlsi_wb_custom_profiles';
