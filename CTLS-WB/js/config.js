const CG_FWD = 0.325;
const CG_AFT = 0.420;
const MIN_MASS = 300;
const MAX_MASS = 600;
const FUEL_DENSITY = 0.725;
const MAC_LENGTH = 1.280;

const ARM = {
 crew: 0.330,
 baggage: 1.350,
 floor: 0.900,
 fuel: 0.430
};

const DEFAULT_PROFILES = {
 'B-10J9': { empty: 375.1, arm: 0.363 },
 'B-12LY': { empty: 390.5, arm: 0.360 },
 'B-133X': { empty: 360.0, arm: 0.334 }
};

const LIMIT = {
 empty: { min: 300, max: 405 },
 crew: { max: 240 },
 baggage: { max: 50 },
 floor: { max: 5 },
 fuel: { max: 126 }
};

const STORAGE_KEY = 'ctls_wb_custom_profiles';