// =============================================================================
// validate.js: scenario checks for engine.js (red-team finding 10, tests/redteam/FINDINGS.md)
//
// validateScenario(scenario, departments) returns { scenario, warnings } with the seed's
// segment keys normalised (OPV/Criollo -> OPV_Criollo), or throws one Error listing every
// problem. The model itself (Azahar's R code) has no input checks; these ranges only reject
// values that are impossible or that make the arithmetic meaningless (negative areas, yields
// below -100%, non-numbers), so every plausible scenario still runs.
// =============================================================================

import { SEGMENTS, SEGMENT_KEYS } from './econ.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// [min, max, minExclusive] per numeric parameter; null = no bound
const NUM = {
  bio_cost_current_regime_per_mz: [0, 1e5], newseed_subsidy_current_per_mz: [0, 1e5],
  price_sale: [0, 1e5, true], mz_to_ha: [0, 10, true], qq_to_mt: [0, 1, true],
  consumption_fsi_kg: [0, 2000, true], kg_to_qq: [0, 1000, true],
  fe_mg_per_g_maize: [0, 1], zn_mg_per_g_maize: [0, 1],
  factor_fe: [0, 5], factor_zn: [0, 5], factor_prot: [0, 5], gunaratna_effect_size: [0, 1], lystrp_scale: [0, 5], va_fraction: [0, 1],
  gravity_tolerance: [0, 1e9, true], gravity_beta: [0, 10], bags_per_ha: [0, 100, true],
};
const INT = { gravity_max_iterations: [1, 1000], grid_n_intervals: [100, 1e7] };
const NULLABLE = new Set(['price_sale', 'consumption_fsi_kg', 'gravity_beta', 'adoption', 'coverage_override']);
export const TRAVEL_MATRICES = ['azahar_fit', 'osrm_2026'];

function segments(obj, name, problems, { min = -Infinity, max = Infinity } = {}) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { problems.push(`${name} must be an object with ${SEGMENT_KEYS.join(', ')}`); return null; }
  const out = {};
  for (const k of Object.keys(obj)) {
    const i = SEGMENT_KEYS.indexOf(k) >= 0 ? SEGMENT_KEYS.indexOf(k) : SEGMENTS.indexOf(k);
    if (i < 0) { problems.push(`${name} has an unknown segment "${k}" (expected ${SEGMENT_KEYS.join(', ')})`); continue; }
    const v = obj[k];
    if (!isNum(v)) problems.push(`${name}.${SEGMENT_KEYS[i]} must be a number, got ${JSON.stringify(v)}`);
    else if (v < min || v > max) problems.push(`${name}.${SEGMENT_KEYS[i]} = ${v} is outside [${min}, ${max}]`);
    out[SEGMENT_KEYS[i]] = v;
  }
  for (const k of SEGMENT_KEYS) if (!(k in out)) problems.push(`${name}.${k} is missing`);
  return out;
}

export function validateScenario(scenario, departments = [], { bioCostNoSubsidyDefault = null } = {}) {
  const problems = [], warnings = [];
  if (!scenario || typeof scenario !== 'object') throw new Error('Invalid scenario: not an object');
  const sc = { ...scenario };
  const pathway = sc.pathway ?? 'pco';
  if (pathway !== 'pco' && pathway !== 'pma') problems.push(`pathway must be "pco" or "pma", got ${JSON.stringify(pathway)}`);
  sc.pathway = pathway;
  if (!isNum(sc.penetration) || sc.penetration < 0 || sc.penetration > 1) {
    problems.push(`penetration (share of maize land) must be a number from 0 to 1, got ${JSON.stringify(sc.penetration)}`);
  }
  // seed: yield change versus conventional seed, by segment; -1 = no grain at all
  if (!sc.seed || typeof sc.seed !== 'object') problems.push('seed is missing');
  else {
    const y = segments(sc.seed.yield_change, 'seed.yield_change', problems, { min: -1, max: 20 });
    if (y) {
      sc.seed = { ...sc.seed, yield_change: y };
      if (Object.values(y).some((v) => isNum(v) && v < -0.5)) warnings.push('the seed loses more than half the yield for at least one farmer group');
    }
  }
  // subsidy: prices in GTQ per manzana
  if (!sc.subsidy || typeof sc.subsidy !== 'object') problems.push('subsidy is missing');
  else {
    const s = { ...sc.subsidy };
    if (!isNum(s.newseed_subsidy_per_mz) || s.newseed_subsidy_per_mz < 0) problems.push(`subsidy.newseed_subsidy_per_mz must be a number >= 0, got ${JSON.stringify(s.newseed_subsidy_per_mz)}`);
    if (s.bio_cost_no_subsidy_per_mz !== undefined && s.bio_cost_no_subsidy_per_mz !== null
      && (!isNum(s.bio_cost_no_subsidy_per_mz) || s.bio_cost_no_subsidy_per_mz <= 0)) problems.push(`subsidy.bio_cost_no_subsidy_per_mz must be a number > 0, got ${JSON.stringify(s.bio_cost_no_subsidy_per_mz)}`);
    const conv = segments(s.seed_cost_conventional, 'subsidy.seed_cost_conventional', problems, { min: 0 });
    const bio = segments(s.seed_cost_biofortified, 'subsidy.seed_cost_biofortified', problems, { min: 0 });
    if (conv) s.seed_cost_conventional = conv;
    if (bio) s.seed_cost_biofortified = bio;
    const bcns = isNum(s.bio_cost_no_subsidy_per_mz) ? s.bio_cost_no_subsidy_per_mz : bioCostNoSubsidyDefault;
    if (isNum(s.newseed_subsidy_per_mz) && isNum(bcns) && s.newseed_subsidy_per_mz > bcns) {
      problems.push(`New Seed's subsidy (Q${s.newseed_subsidy_per_mz}/mz) cannot exceed the unsubsidised seed price (Q${bcns}/mz)`);
    }
    sc.subsidy = s;
  }
  // params
  const params = sc.params ?? {};
  if (typeof params !== 'object' || Array.isArray(params)) problems.push('params must be an object');
  else {
    for (const [k, v] of Object.entries(params)) {
      if ((v === null || v === undefined) && (NULLABLE.has(k) || k in NUM || k in INT)) continue;
      if (k in NUM) {
        const [lo, hi, ex] = NUM[k];
        if (!isNum(v) || (ex ? v <= lo : v < lo) || v > hi) problems.push(`params.${k} must be a number ${ex ? '>' : '>='} ${lo} and <= ${hi}, got ${JSON.stringify(v)}`);
        else if (k.startsWith('factor_') && v < 1) warnings.push(`${k} below 1 means biofortified maize has less of that nutrient than ordinary maize`);
      } else if (k in INT) {
        const [lo, hi] = INT[k];
        if (!Number.isInteger(v) || v < lo || v > hi) problems.push(`params.${k} must be a whole number from ${lo} to ${hi}, got ${JSON.stringify(v)}`);
      } else if (k === 'travel_matrix') {
        if (!TRAVEL_MATRICES.includes(v)) problems.push(`params.travel_matrix must be one of ${TRAVEL_MATRICES.join(', ')}, got ${JSON.stringify(v)}`);
      } else if (k === 'include_quantiles') {
        if (typeof v !== 'boolean') problems.push('params.include_quantiles must be true or false');
      } else if (k === 'adoption') {
        if (typeof v !== 'object' || Array.isArray(v)) problems.push('params.adoption must be an object');
        else for (const [ak, av] of Object.entries(v)) if (!isNum(av)) problems.push(`params.adoption.${ak} must be a number`);
      } else if (k === 'coverage_override') {
        if (typeof v !== 'object' || Array.isArray(v)) problems.push('params.coverage_override must be an object {department: percent}');
        else for (const [dk, dv] of Object.entries(v)) {
          if (departments.length && !departments.includes(dk)) problems.push(`params.coverage_override has an unknown department "${dk}"`);
          if (!isNum(dv) || dv < 0 || dv > 100) problems.push(`params.coverage_override.${dk} must be a percent from 0 to 100, got ${JSON.stringify(dv)}`);
        }
      } else {
        problems.push(`params.${k} is not a model parameter`);
      }
    }
  }
  if (problems.length) throw new Error(`Invalid scenario: ${problems.join('; ')}`);
  return { scenario: sc, warnings };
}
