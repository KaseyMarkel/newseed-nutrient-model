// Input parsing and guardrails for the Scenario Lab (and for scenarios imported from JSON).
import { validateScenario as engineValidate } from '../../engine/validate.js';
// The engine accepts almost any number and returns nonsense rather than failing
// (a -200% yield gives negative coverage, a fractional grid changes adoption, a zero
// consumption gives empty coverage), so the site checks inputs before running.

// Parse a typed number. Accepts "10.5", "10,5" (decimal comma), " -3 ", "+4".
// Thousands separators are not accepted ("1,000" is ambiguous); returns NaN for anything else.
export function parseNum(text) {
  if (typeof text === 'number') return text;
  let s = String(text ?? '').trim().replace(/\s/g, '').replace('−', '-');
  if (s === '') return NaN;
  if (/^[-+]?\d*,\d+$/.test(s)) s = s.replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

export const SEGMENTS = ['OPV_Criollo', 'Low', 'Mid', 'High'];
const SEG_NAME = { OPV_Criollo: 'OPV / criollo', Low: 'Low hybrid', Mid: 'Mid hybrid', High: 'High hybrid' };

// Yield change per segment as fractions (0.55 = +55%).
export function yieldProblems(yc) {
  const errors = [], warnings = [];
  for (const k of SEGMENTS) {
    const v = yc ? yc[k] : undefined;
    const n = SEG_NAME[k];
    if (v == null || !Number.isFinite(v)) errors.push(`${n}: yield change is missing or not a number.`);
    else if (v <= -1) errors.push(`${n}: a yield change of ${(v * 100).toFixed(1)}% means no harvest or less; it must be above -100%.`);
    else if (v > 10) errors.push(`${n}: ${(v * 100).toFixed(0)}% is above the +1000% limit.`);
    else if (v > 2) warnings.push(`${n}: +${(v * 100).toFixed(0)}% is far above Azahar's seeds (-14% to +55%).`);
  }
  return { errors, warnings };
}

export function subsidyProblems(sub) {
  const errors = [], warnings = [];
  if (!sub) return { errors: ['No subsidy regime.'], warnings };
  const ns = sub.newseed_subsidy_per_mz, nosub = sub.bio_cost_no_subsidy_per_mz ?? 547;
  if (!Number.isFinite(ns)) errors.push('New Seed subsidy is not a number.');
  else if (ns < 0) errors.push('New Seed subsidy cannot be negative.');
  if (!Number.isFinite(nosub)) errors.push('Unsubsidised seed price is not a number.');
  else if (nosub <= 0) errors.push('Unsubsidised seed price must be above 0.');
  for (const [name, obj] of [['Biofortified seed price', sub.seed_cost_biofortified], ['Conventional seed price', sub.seed_cost_conventional]]) {
    for (const k of SEGMENTS) {
      const v = obj ? obj[k] : undefined;
      if (v == null || !Number.isFinite(v)) errors.push(`${name}, ${SEG_NAME[k]}: missing or not a number.`);
      else if (v < 0) errors.push(`${name}, ${SEG_NAME[k]}: cannot be negative.`);
    }
  }
  if (!errors.length) {
    if (ns > nosub) errors.push(`New Seed subsidy (Q${ns}/mz) is above the unsubsidised seed price (Q${nosub}/mz).`);
    const bio = Object.values(sub.seed_cost_biofortified || {});
    const maxBio = Math.max(...bio), minBio = Math.min(...bio);
    if (maxBio > nosub) warnings.push(`Farmers would pay more than the unsubsidised price (Q${maxBio} > Q${nosub}/mz): a negative total subsidy.`);
    if (minBio + ns > nosub + 0.5) warnings.push(`Farmer price + New Seed subsidy (Q${minBio} + Q${ns} = Q${minBio + ns}) is above the unsubsidised price (Q${nosub}): the model then counts a negative "producer absorption".`);
    if (Math.abs(minBio + ns - nosub) > 0.5 && maxBio === minBio && minBio + ns < nosub) warnings.push(`Farmer price + New Seed subsidy (Q${minBio + ns}) is below the unsubsidised price (Q${nosub}); the seed producer absorbs the Q${nosub - minBio - ns} difference. In Azahar's regimes the two add up to Q547 (current) or the producer absorbs the rest (50% / 75% reductions).`);
  }
  return { errors, warnings };
}

// Plain-language names and ranges of the engine parameters the Lab exposes.
// kind 'nullnum': a number, or blank for the engine's default (null = computed from data).
// Hard limits (min / minExcl / max) are the engine's own (engine/validate.js); a value outside
// them is refused here with a plain message instead of failing when the model runs.
export const PARAM_INFO = {
  price_sale: { label: 'Farm-gate maize price (GTQ per quintal)', minExcl: 0, max: 100000, warnHi: 1000, warnLo: 50 },
  bio_cost_current_regime_per_mz: { label: 'Farmer price of biofortified seed in the current regime (GTQ/mz); used for "farmer extra cost"', min: 0, max: 100000 },
  newseed_subsidy_current_per_mz: { label: 'New Seed subsidy in the current regime (GTQ/mz); used for "New Seed savings"', min: 0, max: 100000 },
  consumption_fsi_kg: { label: 'Maize consumption per person (kg/year); blank = Azahar’s data', kind: 'nullnum', minExcl: 0, max: 2000, warnHi: 500 },
  factor_fe: { label: 'Iron in biofortified maize vs conventional (x)', minExcl: 0, max: 5, warnLo: 1 },
  factor_zn: { label: 'Zinc in biofortified maize vs conventional (x)', minExcl: 0, max: 5, warnLo: 1 },
  factor_prot: { label: 'Quality protein in biofortified maize vs conventional (x); meta-analysis pathway', minExcl: 0, max: 5, warnLo: 1 },
  gunaratna_effect_size: { label: 'Growth effect of QPM (Gunaratna 2010; meta-analysis pathway only)', min: 0, max: 1 },
  fe_mg_per_g_maize: { label: 'Iron in conventional maize (mg per g)', min: 0, max: 1 },
  zn_mg_per_g_maize: { label: 'Zinc in conventional maize (mg per g)', min: 0, max: 1 },
  gravity_beta: { label: 'Distance decay of maize trade between departments (blank = Azahar’s 1/t²)', kind: 'nullnum', min: 0, max: 10 },
  gravity_max_iterations: { label: 'Maize trade between departments, maximum rounds', integer: true, min: 1, max: 1000 },
  gravity_tolerance: { label: 'Maize trade between departments, stop when less than this many quintals move', minExcl: 0, max: 1e9 },
  travel_matrix: { label: 'Road travel times between departments', kind: 'choice', choices: { azahar_fit: 'Azahar’s run (recovered; matches the dashboard)', osrm_2026: 'OpenStreetMap 2026 (our R run)' } },
  grid_n_intervals: { label: 'Adoption lookup grid (intervals)', integer: true, min: 100, max: 10000000 },
  mz_to_ha: { label: 'Hectares per manzana', minExcl: 0, max: 10 },
  qq_to_mt: { label: 'Metric tons per quintal', minExcl: 0, max: 1 },
  kg_to_qq: { label: 'Kilograms per quintal', minExcl: 0, max: 1000 },
  bags_per_ha: { label: 'Seed bags per hectare', minExcl: 0, max: 100 },
  adoption: { label: 'Adoption model settings (advanced JSON; blank = Azahar’s)', kind: 'json' }
};

export function paramProblem(key, v) {
  const info = PARAM_INFO[key];
  if (!info) return ['include_quantiles', 'coverage_override'].includes(key) ? null : { error: `"${key}" is not a model parameter.` };
  if (v == null) return null;
  if (info.kind === 'choice') return Object.prototype.hasOwnProperty.call(info.choices, v) ? null : { error: `${key}: unknown value "${v}".` };
  if (info.kind === 'json') {
    if (typeof v !== 'object' || Array.isArray(v)) return { error: `${info.label}: must be a JSON object.` };
    const bad = Object.entries(v).filter(([, x]) => typeof x !== 'number' || !Number.isFinite(x)).map(([k]) => k);
    return bad.length ? { error: `${info.label}: every value must be a number (${bad.join(', ')} is not).` } : null;
  }
  if (!Object.prototype.hasOwnProperty.call(PARAM_INFO, key)) return { error: `${key} is not a model parameter.` };
  if (typeof v !== 'number' || !Number.isFinite(v)) return { error: `${info.label}: not a number.` };
  if (info.integer && !Number.isInteger(v)) return { error: `${info.label}: must be a whole number.` };
  if (info.min != null && v < info.min) return { error: `${info.label}: must be at least ${info.min}.` };
  if (info.minExcl != null && v <= info.minExcl) return { error: `${info.label}: must be above ${info.minExcl}.` };
  if (info.max != null && v > info.max) return { error: `${info.label}: must be at most ${info.max}.` };
  if (info.warnLo != null && v < info.warnLo) return { warning: `${info.label}: ${v} is below ${info.warnLo}.` };
  if (info.warnHi != null && v > info.warnHi) return { warning: `${info.label}: ${v} is unusually high.` };
  return null;
}

export function paramsProblems(params) {
  const errors = [], warnings = [];
  for (const [k, v] of Object.entries(params || {})) {
    const p = paramProblem(k, v);
    if (p && p.error) errors.push(p.error);
    if (p && p.warning) warnings.push(p.warning);
  }
  return { errors, warnings };
}

// All blocking problems of a scenario (seed, subsidy, params) as a list of messages. When the
// site's own checks pass, the engine's validator (engine/validate.js) has the last word, so a
// scenario the Lab accepts never fails with "Invalid scenario" when it runs.
export function scenarioProblems(seed, sub, params) {
  const own = [...yieldProblems(seed && seed.yield_change).errors, ...subsidyProblems(sub).errors, ...paramsProblems(params).errors];
  if (own.length || !seed || !sub) return own;
  try {
    const subsidy = { ...sub }; delete subsidy.official; delete subsidy.label; delete subsidy.reduction_pct;
    engineValidate({ seed: { id: seed.id, yield_change: seed.yield_change }, subsidy, pathway: 'pco', penetration: 0.5, params: params || {} });
    return [];
  } catch (e) {
    return String(e && e.message || e).replace(/^Invalid scenario: /, '').split('; ').map(m => `The model refuses this scenario: ${m}.`);
  }
}
export function scenarioWarnings(seed, sub, params) {
  return [...yieldProblems(seed && seed.yield_change).warnings, ...(sub && sub.official ? [] : subsidyProblems(sub).warnings), ...paramsProblems(params).warnings];
}
