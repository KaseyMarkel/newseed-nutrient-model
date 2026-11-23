// =============================================================================
// econ.js: economics side of the Azahar Guatemala ex-ante model, in plain JS.
//
// Reproduces, for one scenario (seed x subsidy x penetration, custom values
// allowed), the economic part of Azahar's R pipeline at commit a4b2f91:
//   02_04x  farmer-level economic impact (yield change, seed cost, income)
//   02_06x  likely-adopters score, ranking, p_entry, S/M/L profile
//   06_01x  land-share lookup (p_internal grid), departmental biofortified
//           production, gravity redistribution, saturation (coverage)
//   06_02x  departmental economic KPIs (+ coverage-derived KPIs)
//   06_03x  national economic KPIs
// Every formula cites file:line in spec/economics.md. No dependencies; runs in
// the browser and in Node (ES module).
//
// Public API (see spec/economics.md section 10 for the full contract):
//   createEcon(bundle)            bundle = bundle_econ.json (or a bundle with .econ)
//     .defaults()                 {seeds, subsidies, params}
//     .run(scenario)              {penetration, p_internal, national, departments, handoff}
//     .runLevels(scenario, levels)  array of run() results (shares the ranking)
//     .prepare(scenario)          cached farmer-level state (ranking etc.), for debugging
//   Scenario shape: CONTRACT.md. Penetration = national share of maize LAND.
// =============================================================================

export const SEGMENTS = ['OPV/Criollo', 'Low', 'Mid', 'High'];
export const SEGMENT_KEYS = ['OPV_Criollo', 'Low', 'Mid', 'High'];
const SEG_OPV = 0;

// ---------------------------------------------------------------------------
// Default constants (all overridable through scenario.params; keys documented
// in spec/bundle_schema.md, section "economics", table "params").
// ---------------------------------------------------------------------------
export const DEFAULT_PARAMS = Object.freeze({
  bio_cost_current_regime_per_mz: 305,   // 02_04x:1734
  newseed_subsidy_current_per_mz: 242,   // 02_04x:1740
  price_sale: null,                      // null = bundle value (02_04x:354)
  mz_to_ha: 0.7,                         // 06_02x:278, 2046
  qq_to_mt: 0.04536,                     // 06_02x:2047
  consumption_fsi_kg: null,              // null = bundle consumption (06_01x:561, 174)
  kg_to_qq: 45.36,                       // 06_01x:564
  fe_mg_per_g_maize: 2.71 / 100,         // 06_02x:2052
  zn_mg_per_g_maize: 2.21 / 100,         // 06_02x:2053
  factor_fe: 1.19,                       // 06_02x:2054
  factor_zn: 1.38,                       // 06_02x:2055
  gravity_max_iterations: 50,            // 00_functions.R:5472
  gravity_tolerance: 1,                  // 00_functions.R:5473
  gravity_beta: null,                    // null = bundle gravity_weight (06_00, beta = 2)
  travel_matrix: 'azahar_fit',           // 'azahar_fit' = matches the live dashboard; 'osrm_2026' = our R run
  grid_n_intervals: 10000,               // 06_01x:844
  bags_per_ha: 1,                        // NOT in R code: dashboard-only KPI, inferred (see spec 9)
  adoption: null,                        // optional overrides of model_config fields (departs from Azahar)
});

// ---------------------------------------------------------------------------
// R-faithful numeric helpers
// ---------------------------------------------------------------------------

const isNA = (x) => x === null || x === undefined || Number.isNaN(x);

// R's sum() and cumsum() accumulate in 80-bit long double (src/main/summary.c,
// cum.c); LDAcc reproduces that bit for bit (engine/ldsum.js). NaN propagates.
import { LDAcc } from './ldsum.js';
class Acc extends LDAcc {}

// sum(x, na.rm = TRUE)
export function sumR(arr) {
  const a = new Acc();
  for (let i = 0; i < arr.length; i++) { const x = arr[i]; if (!isNA(x)) a.add(x); }
  return a.value();
}

// R quantile(x, probs, na.rm = TRUE), type 7 (stats::quantile.default).
export function quantile7(x, probs) {
  const v = [];
  for (let i = 0; i < x.length; i++) if (!isNA(x[i])) v.push(x[i]);
  v.sort((a, b) => a - b);
  const n = v.length;
  return probs.map((p) => {
    if (n === 0) return NaN;
    const index = 1 + Math.max(n - 1, 0) * p;
    const lo = Math.floor(index), hi = Math.ceil(index);
    let qs = v[lo - 1];
    const xhi = v[hi - 1];
    if (index > lo && xhi !== qs) {
      const h = index - lo;
      qs = (1 - h) * qs + h * xhi;
    }
    return qs;
  });
}

// R median(x, na.rm = TRUE); mean of the two middle values as in mean.default.
export function medianR(x) {
  const v = [];
  for (let i = 0; i < x.length; i++) if (!isNA(x[i])) v.push(x[i]);
  const n = v.length;
  if (n === 0) return NaN;
  v.sort((a, b) => a - b);
  const half = Math.floor((n + 1) / 2);
  if (n % 2 === 1) return v[half - 1];
  return v[half - 1] / 2 + v[half] / 2;
}

// weighted.mean(x, w, na.rm = TRUE) (stats:::weighted.mean.default)
function weightedMeanR(x, w) {
  const num = new Acc(), den = new Acc();
  for (let i = 0; i < x.length; i++) {
    if (isNA(x[i])) continue;
    if (w[i] !== 0) num.add(x[i] * w[i]);
    den.add(w[i]);
  }
  return num.value() / den.value();
}

// Hmisc::wtd.var(x, weights, na.rm = TRUE), method "unbiased", normwt = FALSE
function wtdVarR(x, w) {
  const xs = [], ws = [];
  for (let i = 0; i < x.length; i++) {
    if (isNA(x[i] + w[i])) continue;
    xs.push(x[i]); ws.push(w[i]);
  }
  const sw = sumR(ws);
  const a = new Acc();
  for (let i = 0; i < xs.length; i++) a.add(ws[i] * xs[i]);
  const xbar = a.value() / sw;
  const b = new Acc();
  for (let i = 0; i < xs.length; i++) { const d = xs[i] - xbar; b.add(ws[i] * (d * d)); }
  return b.value() / (sw - 1);
}

// Stable ordering helpers (R order()/arrange() are stable; NA last)
function orderAsc(x) {
  const idx = Array.from(x, (_, i) => i);
  idx.sort((i, j) => {
    const a = x[i], b = x[j], na = isNA(a), nb = isNA(b);
    if (na || nb) return na === nb ? 0 : (na ? 1 : -1);
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return idx;
}
function orderDesc(x) { // arrange(desc(x))
  const idx = Array.from(x, (_, i) => i);
  idx.sort((i, j) => {
    const a = x[i], b = x[j], na = isNA(a), nb = isNA(b);
    if (na || nb) return na === nb ? 0 : (na ? 1 : -1);
    return a > b ? -1 : a < b ? 1 : 0;
  });
  return idx;
}

// 00_functions.R:5181 weighted_quantiles(); 5219 scale_p1_p99()
function weightedQuantiles(x, w, probs) {
  const o = orderAsc(x);
  const n = o.length;
  const cw = new Float64Array(n);
  const acc = new Acc();
  for (let k = 0; k < n; k++) { acc.add(w[o[k]]); cw[k] = acc.value(); }
  const tot = sumR(w);
  return probs.map((p) => {
    let best = -1, bestD = Infinity;
    for (let k = 0; k < n; k++) {
      const d = Math.abs(cw[k] / tot - p);
      if (d < bestD) { bestD = d; best = k; }
    }
    return best < 0 ? NaN : x[o[best]];
  });
}
function scaleP1P99(x, w) {
  const qs = weightedQuantiles(x, w, [0.01, 0.50, 0.99]);
  const half = (qs[2] - qs[0]) / 2;
  const out = new Float64Array(x.length);
  if (half <= 0) return out; // R: if (half_range <= 0) return(rep(0, length(x)))
  for (let i = 0; i < x.length; i++) out[i] = (x[i] - qs[1]) / half;
  return out;
}

// 00_functions.R:4895 add_dept_zscore()
function deptZscore(x, w, dept, nDept) {
  const groups = Array.from({ length: nDept }, () => []);
  for (let i = 0; i < x.length; i++) groups[dept[i]].push(i);
  const mu = new Float64Array(nDept), sd = new Float64Array(nDept);
  for (let d = 0; d < nDept; d++) {
    const g = groups[d];
    if (!g.length) { mu[d] = NaN; sd[d] = NaN; continue; }
    const xg = g.map((i) => x[i]), wg = g.map((i) => w[i]);
    mu[d] = weightedMeanR(xg, wg);
    sd[d] = Math.sqrt(wtdVarR(xg, wg));
    // Replica patch P3 (pipeline/PATCHES.md): a department with zero or undefined SD gets z = 0
    // instead of NaN. Azahar's code divides by zero here; no dashboard combination hits it, but
    // stronger seeds can (s30 x sub00: no El Progreso farmer loses income).
    if (!(Number.isFinite(sd[d]) && sd[d] > 0)) sd[d] = Infinity;
  }
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = (x[i] - mu[dept[i]]) / sd[dept[i]];
  return out;
}

// 00_functions.R:4738 sigmoid_curve()
export function sigmoidCurve(p, pEntry, floorVal, k) {
  const u = (p - pEntry) / Math.max(1 - pEntry, 1e-6);
  const raw = 1 / (1 + Math.exp(-k * (u - 0.5)));
  const raw0 = 1 / (1 + Math.exp(-k * (0 - 0.5)));
  const raw1 = 1 / (1 + Math.exp(-k * (1 - 0.5)));
  const scaled = floorVal + (1 - floorVal) * (raw - raw0) / (raw1 - raw0);
  if (Number.isNaN(pEntry) || Number.isNaN(p)) return NaN;
  return p < pEntry ? 0 : Math.min(1, Math.max(floorVal, scaled));
}

// ---------------------------------------------------------------------------
// Bundle normalisation
// ---------------------------------------------------------------------------

function toF64(a) {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] === null || a[i] === undefined ? NaN : a[i];
  return out;
}

function normalizeBundle(bundleIn) {
  const B = bundleIn && bundleIn.econ ? bundleIn.econ : bundleIn;
  if (!B || !B.farmers || !B.market_baseline) throw new Error('econ: bundle lacks farmers/market_baseline');
  const depts = B.departments.slice();
  const deptIndex = new Map(depts.map((d, i) => [d, i]));
  const F = B.farmers;
  const n = F.weight_calibrated.length;
  const segIdx = new Int32Array(n), deptIdx = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const s = typeof F.segment[i] === 'number' ? F.segment[i] : SEGMENTS.indexOf(F.segment[i]);
    if (s < 0) throw new Error(`econ: unknown segment ${F.segment[i]}`);
    segIdx[i] = s;
    const d = typeof F.dept[i] === 'number' ? F.dept[i] : deptIndex.get(F.dept[i]);
    if (d === undefined || d < 0) throw new Error(`econ: farmer department ${F.dept[i]} not in departments`);
    deptIdx[i] = d;
  }
  const num = (k) => {
    if (!(k in F)) throw new Error(`econ: bundle farmers lack column ${k}`);
    return toF64(F[k]);
  };
  const farmers = {
    n, seg: segIdx, dept: deptIdx,
    w: num('weight_calibrated'),
    land: num('land_wtcorn'),
    prod: num('total_production'),
    qhh: num('qty_household_qq'),
    qan: num('qty_animal_seed_qq'),
    revenue: num('revenue'),
    psc: num('price_self_consumption'),
    nonseed: num('exp_non_seed'),
    age: num('farmer_age'),
    expTot: num('exp_total_per_mz_annual'),
    yieldq: num('yield_wtcorn_qq'),
    vte: num('value_total_economic'),
  };
  const MB = B.market_baseline;
  const nd = depts.length;
  const mb = {};
  for (const k of ['population', 'n_farmers_total', 'n_farmers_hybrid', 'n_farmers_opv',
    'land_ha_total', 'consumption_fsi_qq', 'consumption_fsi_mt']) {
    if (!(k in MB)) throw new Error(`econ: market_baseline lacks ${k}`);
    mb[k] = toF64(MB[k]);
    if (mb[k].length !== nd) throw new Error(`econ: market_baseline.${k} length != departments`);
  }
  // travel table in its original row order, grouped by origin (row order kept)
  const groupByOrigin = (T) => {
    const byO = Array.from({ length: nd }, () => []);
    const tw = toF64(T.gravity_weight);
    const ttm = T.travel_time_min ? toF64(T.travel_time_min) : null;
    for (let r = 0; r < T.origin.length; r++) {
      const o = typeof T.origin[r] === 'number' ? T.origin[r] : deptIndex.get(T.origin[r]);
      const d = typeof T.destination[r] === 'number' ? T.destination[r] : deptIndex.get(T.destination[r]);
      if (o === undefined || d === undefined) continue; // unmatched names never match in R either
      byO[o].push({ dest: d, w: tw[r], t: ttm ? ttm[r] : NaN });
    }
    return byO;
  };
  // B.travel: travel times fitted to the live dashboard (pipeline/fit_travel_matrix.mjs);
  // B.travel_osrm_2026: our own OSRM run of 06_00 (what our R pipeline used).
  const byOrigin = groupByOrigin(B.travel);
  const byOriginOsrm = B.travel_osrm_2026 ? groupByOrigin(B.travel_osrm_2026) : null;
  return {
    raw: B, depts, deptIndex, farmers, mb, byOrigin, byOriginOsrm,
    deptOutputOrder: B.department_output_order || depts.slice().sort(cmpC),
    priceSale: B.prices.price_sale,
    mc: B.model_config,
    variants: B.variants || {},
  };
}

// dplyr arrange() on character uses the C locale (byte order of UTF-8)
function cmpC(a, b) {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  const n = Math.min(ea.length, eb.length);
  for (let i = 0; i < n; i++) if (ea[i] !== eb[i]) return ea[i] - eb[i];
  return ea.length - eb.length;
}

// ---------------------------------------------------------------------------
// Scenario resolution
// ---------------------------------------------------------------------------

function segVec(obj, name) {
  if (!obj) throw new Error(`econ: scenario lacks ${name}`);
  return SEGMENT_KEYS.map((k, i) => {
    const v = obj[k] ?? obj[SEGMENTS[i]];
    if (v === undefined || v === null) throw new Error(`econ: ${name}.${k} missing`);
    return Number(v);
  });
}

function resolveScenario(b, sc) {
  const params = { ...DEFAULT_PARAMS, ...(sc.params || {}) };
  const seed = sc.seed || {};
  const sub = sc.subsidy || {};
  const yieldF = segVec(seed.yield_change, 'seed.yield_change');
  const conv = segVec(sub.seed_cost_conventional, 'subsidy.seed_cost_conventional');
  const bio = segVec(sub.seed_cost_biofortified, 'subsidy.seed_cost_biofortified');
  const nsp = Number(sub.newseed_subsidy_per_mz);
  const bcns = Number(sub.bio_cost_no_subsidy_per_mz ?? b.variants.bio_cost_no_subsidy_per_mz);
  if (!Number.isFinite(nsp) || !Number.isFinite(bcns)) throw new Error('econ: subsidy needs newseed_subsidy_per_mz and bio_cost_no_subsidy_per_mz');
  const priceSale = params.price_sale ?? b.priceSale;
  const mc = mergeModelConfig(b.mc, params.adoption);
  return { params, yieldF, conv, bio, nsp, bcns, priceSale, mc };
}

function mergeModelConfig(mc, ov) {
  if (!ov) return mc;
  const out = JSON.parse(JSON.stringify(mc));
  const deep = (t, s) => { for (const k of Object.keys(s)) {
    if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && t[k] && typeof t[k] === 'object') deep(t[k], s[k]);
    else t[k] = s[k];
  } };
  deep(out, ov);
  return out;
}

function rankKey(r) { // non-finite numbers kept distinct (JSON.stringify would write them all as null)
  return JSON.stringify([r.yieldF, r.conv, r.bio, r.nsp, r.bcns, r.priceSale,
    r.params.bio_cost_current_regime_per_mz, r.params.newseed_subsidy_current_per_mz, r.params.adoption || null],
  (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v));
}

// ---------------------------------------------------------------------------
// Step 1. Farmer-level economics (02_04x) for one seed x subsidy
// ---------------------------------------------------------------------------

function farmerEconomics(b, r) {
  const F = b.farmers, n = F.n;
  const P = r.params;
  const out = {
    production_biofortified: new Float64Array(n),
    production_increment: new Float64Array(n),
    income_net_current: new Float64Array(n),
    income_net_projected: new Float64Array(n),
    income_increment: new Float64Array(n),
    cost_seeds_increment: new Float64Array(n),
    cost_seeds_bio_no_subsidy: new Float64Array(n),
    cost_seeds_bio_current_regime: new Float64Array(n),
    subsidy_amount_absolute: new Float64Array(n),
    newseed_subsidy: new Float64Array(n),
    producer_absorption: new Float64Array(n),
    subsidy_reduction_cost: new Float64Array(n),
    newseed_savings_vs_current: new Float64Array(n),
    // decomposition of income_increment (not Azahar columns): revaluation + yield value - seed cost increment
    income_price_revaluation: new Float64Array(n),
    income_yield_value: new Float64Array(n),
  };
  const priceSale = r.priceSale;
  // value of a production quantity under 02_04x's projected sales rule (sold at the national price,
  // retained for household and animals at the farmer's own price)
  const valueProjected = (q, i) => {
    const hh = Math.min(F.qhh[i], q);
    const an = Math.min(F.qan[i], Math.max(0, q - hh));
    return Math.max(0, q - hh - an) * priceSale + (hh + an) * F.psc[i];
  };
  for (let i = 0; i < n; i++) {
    const s = F.seg[i], land = F.land[i], psc = F.psc[i];
    // --- current situation (02_04x:946-986)
    const income_sales = F.revenue[i];
    const value_household = F.qhh[i] * psc;
    const value_animal = F.qan[i] * psc;
    const value_self_consumption = value_household + value_animal;
    const value_gross = income_sales + value_self_consumption;
    const cost_seeds_current = r.conv[s] * land;
    const cost_non_seed = F.nonseed[i];
    const cost_total_current = cost_seeds_current + cost_non_seed;
    const income_net_current = value_gross - cost_total_current;
    // --- projected (02_04x:1268-1320)
    const production_biofortified = F.prod[i] * (1 + r.yieldF[s]);
    const production_increment = production_biofortified - F.prod[i];
    const qty_household_projected = Math.min(F.qhh[i], production_biofortified);
    const qty_animal_projected = Math.min(F.qan[i], Math.max(0, production_biofortified - qty_household_projected));
    const qty_retained_projected = qty_household_projected + qty_animal_projected;
    const qty_sold_projected = Math.max(0, production_biofortified - qty_retained_projected);
    const income_sales_projected = qty_sold_projected * priceSale;
    const value_self_consumption_projected = qty_retained_projected * psc;
    const value_gross_projected = income_sales_projected + value_self_consumption_projected;
    const cost_seeds_projected = r.bio[s] * land;
    const cost_total_projected = cost_seeds_projected + cost_non_seed;
    const income_net_projected = value_gross_projected - cost_total_projected;
    // --- subsidy block (02_04x:1742-1805)
    const cost_seeds_bio_no_subsidy = r.bcns * land;
    const subsidy_amount_absolute = cost_seeds_bio_no_subsidy - cost_seeds_projected;
    const cost_seeds_bio_current_regime = P.bio_cost_current_regime_per_mz * land;
    const subsidy_reduction_cost = cost_seeds_projected - cost_seeds_bio_current_regime;
    const newseed_subsidy = r.nsp * land;
    const producer_absorption = subsidy_amount_absolute - newseed_subsidy;
    const newseed_savings_vs_current = (P.newseed_subsidy_current_per_mz - r.nsp) * land;
    // --- impact (02_04x:2161-2201)
    out.production_biofortified[i] = production_biofortified;
    out.production_increment[i] = production_increment;
    out.income_net_current[i] = income_net_current;
    out.income_net_projected[i] = income_net_projected;
    out.income_increment[i] = income_net_projected - income_net_current;
    // income_increment = (value of today's grain under the projected sales rule - value_gross today)
    //                  + (value of the extra grain) - (seed cost increment); exact up to rounding
    const value_current_projected_rule = valueProjected(F.prod[i], i);
    out.income_price_revaluation[i] = value_current_projected_rule - value_gross;
    out.income_yield_value[i] = value_gross_projected - value_current_projected_rule;
    out.cost_seeds_increment[i] = cost_seeds_projected - cost_seeds_current;
    out.cost_seeds_bio_no_subsidy[i] = cost_seeds_bio_no_subsidy;
    out.cost_seeds_bio_current_regime[i] = cost_seeds_bio_current_regime;
    out.subsidy_amount_absolute[i] = subsidy_amount_absolute;
    out.newseed_subsidy[i] = newseed_subsidy;
    out.producer_absorption[i] = producer_absorption;
    out.subsidy_reduction_cost[i] = subsidy_reduction_cost;
    out.newseed_savings_vs_current[i] = newseed_savings_vs_current;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Step 2. Likely-adopters score, ranking and p_entry (02_06x)
// ---------------------------------------------------------------------------

function makeScoreAge(peakCenter, peakWidth, profile) { // 00_functions.R:5116
  const peakLo = peakCenter - peakWidth, peakHi = peakCenter + peakWidth;
  const nearLoLo = peakLo - 10, farLoLo = peakLo - 20, nearHiHi = peakHi + 10, farHiHi = peakHi + 20;
  const P = {
    decreasing: [80, 60, 80, 60, 50],
    young_priority: [85, 70, 60, 40, 50],
    elder_priority: [60, 40, 85, 70, 50],
    neutral_edges: [70, 55, 70, 55, 50],
  }[profile];
  if (!P) throw new Error(`econ: unknown age profile ${profile}`);
  const [nb, fb, na, fa, ex] = P;
  return (a) => {
    if (a >= peakLo && a < peakHi) return 100;
    if (a >= nearLoLo && a < peakLo) return nb;
    if (a >= farLoLo && a < nearLoLo) return fb;
    if (a >= peakHi && a < nearHiHi) return na;
    if (a >= nearHiHi && a < farHiHi) return fa;
    return ex; // includes NA
  };
}

function adoptionRanking(b, r, econ) {
  const F = b.farmers, n = F.n, mc = r.mc;
  const es = mc.entry_size, sc = mc.scoring, rk = mc.risk;
  // A3 entry-size profile (02_06x:211-230). NB: profile uses entry_size cuts,
  // not mc.continuous cut_S_M/cut_M_L (those are unused by 02_06x).
  const profile = new Int8Array(n); // 0=S, 1=M, 2=L
  const landEntry = new Float64Array(n);
  const coefs = [es.coef_S, es.coef_M, es.coef_L];
  for (let i = 0; i < n; i++) {
    const L = F.land[i];
    const p = L < es.cut_S_M ? 0 : (L < es.cut_M_L ? 1 : 2); // NA -> "L" (case_when TRUE branch)
    profile[i] = p;
    landEntry[i] = L * coefs[p];
  }
  // B scoring (02_06x:310-398)
  const pts = sc.segment_points; // named: Low, OPV, Mid, High
  const segPts = [Math.trunc(pts.OPV), Math.trunc(pts.Low), Math.trunc(pts.Mid), Math.trunc(pts.High)];
  const inc = econ.income_increment;
  const qE = quantile7(inc, sc.heuristic_economic.breakpoints);
  const qI = quantile7(F.expTot, sc.heuristic_improvement.breakpoints);
  const qS = quantile7(landEntry, sc.heuristic_scale.breakpoints);
  const ha = sc.heuristic_age;
  const ageFn = makeScoreAge(ha.peak_center, ha.peak_width, ha.profile);
  const W = sc.component_weights;
  const scoreBase = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = inc[i];
    const sSeg = segPts[F.seg[i]];
    const sEco = x >= qE[2] ? 100 : x >= qE[1] ? 75 : x >= qE[0] ? 50 : x >= 0 ? 25 : 0;
    const e = F.expTot[i];
    const sImp = e <= qI[0] ? 100 : e <= qI[1] ? 75 : e <= qI[2] ? 50 : e <= qI[3] ? 25 : 0;
    const l = landEntry[i];
    const sSca = l >= qS[2] ? 100 : l >= qS[1] ? 75 : l >= qS[0] ? 50 : 25;
    const sAge = ageFn(F.age[i]);
    scoreBase[i] = sSeg * W.segment + sEco * W.economic + sImp * W.improvement + sSca * W.scale + sAge * W.age;
  }
  // C risk drivers (02_06x:496-578)
  const ratio = new Float64Array(n), landLog = new Float64Array(n), loss = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const proxy = Number.isNaN(F.vte[i]) ? NaN : Math.max(F.vte[i], 1e-3);
    ratio[i] = inc[i] / proxy;
    landLog[i] = Math.log1p(landEntry[i]);
    const x = inc[i];
    loss[i] = x < -500 ? 100 : x < -200 ? 75 : x < 0 ? 50 : 0;
  }
  let dY, dR, dL, dLoss;
  if (rk.variant === 'z') {
    const nd = b.depts.length;
    dY = deptZscore(F.yieldq, F.w, F.dept, nd);
    dR = deptZscore(ratio, F.w, F.dept, nd);
    dL = deptZscore(landLog, F.w, F.dept, nd);
    dLoss = deptZscore(loss, F.w, F.dept, nd);
  } else {
    dY = scaleP1P99(F.yieldq, F.w);
    dR = scaleP1P99(ratio, F.w);
    dL = scaleP1P99(landLog, F.w);
    dLoss = scaleP1P99(loss, F.w);
  }
  const adoptionScore = new Float64Array(n), riskPenalty = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const z = rk.alpha_yield * dY[i] + rk.alpha_ratio * dR[i] + rk.alpha_land * dL[i] + rk.alpha_loss * dLoss[i];
    const pen = 100 / (1 + Math.exp(-rk.beta * z));
    riskPenalty[i] = pen;
    adoptionScore[i] = scoreBase[i] - rk.w_R * pen;
  }
  // D1 ranking and p_entry (02_06x:656-668)
  const order = orderDesc(adoptionScore);
  const pEntry = new Float64Array(n); // in ranked order
  const basal = new Float64Array(n);
  for (let k = 0; k < n; k++) { const i = order[k]; basal[k] = F.prod[i] * F.w[i]; }
  const totalBasal = sumR(basal);
  const acc = new Acc();
  for (let k = 0; k < n; k++) {
    acc.add(basal[k]); // cumsum propagates NaN
    const cum = acc.value();
    const pe = (cum - basal[k]) / totalBasal;
    pEntry[k] = Number.isNaN(pe) ? NaN : Math.max(0, pe);
  }
  return { order, pEntry, profile, adoptionScore, riskPenalty, scoreBase, landEntry };
}

// ---------------------------------------------------------------------------
// Step 3. Prepared (ranked) state for a seed x subsidy; cached
// ---------------------------------------------------------------------------

function prepare(b, r) {
  const econ = farmerEconomics(b, r);
  const rank = adoptionRanking(b, r, econ);
  const F = b.farmers, n = F.n, ord = rank.order;
  // Ranked copies of every farmer-level column used downstream (02_06 parquet order)
  const take = (a) => { const o = new Float64Array(n); for (let k = 0; k < n; k++) o[k] = a[ord[k]]; return o; };
  const R = {
    n, pEntry: rank.pEntry,
    profile: Int8Array.from(ord, (i) => rank.profile[i]),
    seg: Int32Array.from(ord, (i) => F.seg[i]),
    dept: Int32Array.from(ord, (i) => F.dept[i]),
    w: take(F.w), land: take(F.land),
  };
  for (const k of Object.keys(econ)) R[k] = take(econ[k]);
  R.bioBase = new Float64Array(n); // 06_01x:1306 bio_base = production_biofortified * weight
  for (let k = 0; k < n; k++) R.bioBase[k] = R.production_biofortified[k] * R.w[k];
  const la = new Acc();
  for (let k = 0; k < n; k++) { const v = R.land[k] * R.w[k]; if (!Number.isNaN(v)) la.add(v); }
  R.landTotal = la.value(); // 06_01x:855
  return { r, econ, rank, R, lookup: new Map() };
}

function curveParams(mc) {
  const c = mc.continuous;
  return { floors: [c.floor_S, c.floor_M, c.floor_L], ks: [c.k_S, c.k_M, c.k_L] };
}

// land share at an internal adoption index (06_01x:858-889)
function landShareAt(state, pInt) {
  const R = state.R;
  if (!(pInt > 0)) return 0 / R.landTotal; // no farmer admitted; sum over empty = 0
  const { floors, ks } = curveParams(state.r.mc);
  const acc = new Acc();
  for (let k = 0; k < R.n; k++) {
    const pe = R.pEntry[k];
    if (!(pe <= pInt)) continue;
    const pr = R.profile[k];
    const ri = sigmoidCurve(pInt, pe, floors[pr], ks[pr]);
    const v = R.land[k] * ri * R.w[k];
    if (!Number.isNaN(v)) acc.add(v);
  }
  return acc.value() / R.landTotal;
}

// p_internal for a penetration target (06_01x:844-941). R evaluates a 10,001
// point grid and takes which.min(|land_share - target|) (first index on ties);
// land_share is non-decreasing in p_internal (each r_i is non-decreasing and
// admitted farmers form a growing set), so a bisection on the grid returns the
// same index. 0 and 1 are pinned (near()).
function pInternalFor(state, penetration) {
  const nInt = state.r.params.grid_n_intervals;
  const key = `${penetration}|${nInt}`;
  if (state.lookup.has(key)) return state.lookup.get(key);
  const NEAR = Math.sqrt(2.220446049250313e-16);
  let gi;
  const cache = new Map();
  const ls = (j) => { if (!cache.has(j)) cache.set(j, landShareAt(state, j / nInt)); return cache.get(j); };
  if (Math.abs(penetration - 0) < NEAR) gi = 0;
  else if (Math.abs(penetration - 1) < NEAR) gi = nInt;
  else {
    // first grid index with land_share >= target
    let lo = 0, hi = nInt;
    if (ls(nInt) < penetration) gi = nInt;
    else {
      while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (ls(mid) >= penetration) hi = mid; else lo = mid + 1; }
      const h = lo;
      if (h === 0) gi = 0;
      else {
        const dLo = Math.abs(ls(h - 1) - penetration), dHi = Math.abs(ls(h) - penetration);
        if (dLo <= dHi) {
          gi = h - 1;
          while (gi > 0 && ls(gi - 1) === ls(gi)) gi--; // first index of a plateau
        } else gi = h;
      }
    }
  }
  const res = {
    grid_index: gi + 1,
    p_internal: gi / nInt,
    land_share_achieved: gi === 0 ? 0 : ls(gi),
  };
  res.land_pct_achieved = res.land_share_achieved * 100;
  res.error_pp = (res.land_share_achieved - penetration) * 100;
  state.lookup.set(key, res);
  return res;
}

// ---------------------------------------------------------------------------
// Step 4. Gravity redistribution (00_functions.R:5470-5619)
// ---------------------------------------------------------------------------

export function redistributeGravity(bio0, annual, byOrigin, maxIter = 50, tol = 1) {
  const nd = bio0.length;
  const bio = Float64Array.from(bio0);
  const cov = new Float64Array(nd), exc = new Float64Array(nd);
  const recompute = () => { for (let j = 0; j < nd; j++) { cov[j] = bio[j] / annual[j]; exc[j] = Math.max(bio[j] - annual[j], 0); } };
  recompute();
  let iteration = 0;
  for (let it = 1; it <= maxIter; it++) {
    const donors = [], recv = new Set();
    for (let j = 0; j < nd; j++) { if (exc[j] > 0) donors.push(j); if (cov[j] < 1) recv.add(j); }
    if (donors.length === 0 || recv.size === 0) break;
    const totalBefore = sumR(exc);
    for (const d of donors) {
      const dex = exc[d]; // excess column is only refreshed after the pass
      if (dex <= 0) continue;
      const flows = [];
      for (const row of byOrigin[d]) {
        if (!recv.has(row.dest)) continue;
        const deficit = Math.max(annual[row.dest] - bio[row.dest], 0);
        if (deficit > 0 && row.w > 0) flows.push({ dest: row.dest, pull: row.w * deficit, deficit });
      }
      if (flows.length === 0) continue;
      const tot = sumR(flows.map((f) => f.pull));
      const alloc = flows.map((f) => Math.min(dex * (f.pull / tot), f.deficit));
      const totalDistributed = sumR(alloc);
      bio[d] = bio[d] - totalDistributed;
      for (let q = 0; q < flows.length; q++) bio[flows[q].dest] = bio[flows[q].dest] + alloc[q];
    }
    recompute();
    iteration = it;
    const totalAfter = sumR(exc);
    if (Math.abs(totalBefore - totalAfter) < tol) break;
  }
  return { bio_production: bio, coverage: cov, excess: exc, iterations: iteration };
}

function gravityTable(b, params) {
  const base = params.travel_matrix === 'osrm_2026' && b.byOriginOsrm ? b.byOriginOsrm : b.byOrigin;
  if (params.gravity_beta === null || params.gravity_beta === undefined) return base;
  const beta = params.gravity_beta; // 06_00: w = 1 / t^beta, diag 0, Inf -> 0
  return base.map((rows, o) => rows.map((row) => {
    let w = 1 / Math.pow(row.t, beta);
    if (row.dest === o || !Number.isFinite(w)) w = 0;
    return { dest: row.dest, w, t: row.t };
  }));
}

// ---------------------------------------------------------------------------
// Step 5. One penetration level: departmental + national KPIs and hand-off
// ---------------------------------------------------------------------------

const SUM_KEYS = [ // Σ x * r_i * w over adopters (06_02x:306-399)
  ['income_increment_total', 'income_increment'],
  ['production_increment_total', 'production_increment'],
  ['production_biofortified_total', 'production_biofortified'],
  ['cost_seeds_increment_total', 'cost_seeds_increment'],
  ['cost_seeds_bio_no_subsidy_total', 'cost_seeds_bio_no_subsidy'],
  ['cost_seeds_bio_current_regime_total', 'cost_seeds_bio_current_regime'],
  ['subsidy_amount_absolute_total', 'subsidy_amount_absolute'],
  ['newseed_subsidy_total', 'newseed_subsidy'],
  ['producer_absorption_total', 'producer_absorption'],
  ['subsidy_reduction_cost_total', 'subsidy_reduction_cost'],
  ['newseed_savings_vs_current_total', 'newseed_savings_vs_current'],
  ['income_yield_value_total', 'income_yield_value'],             // not an Azahar column
  ['income_price_revaluation_total', 'income_price_revaluation'], // not an Azahar column
];

export const ECON_KEYS = [
  'n_farmers_total', 'n_farmers_bio', 'farmers_bio_pct', 'n_farmers_hybrid', 'n_hybrid_bio', 'hybrid_bio_pct',
  'n_farmers_opv', 'n_opv_bio', 'opv_bio_pct', 'land_ha_total', 'land_bio_mz', 'land_bio_ha', 'land_bio_pct',
  'income_increment_total', 'income_increment_median', 'income_per_farmer_total', 'income_per_farmer_adopter',
  'cost_seeds_increment_total', 'production_increment_total', 'production_increment_mt',
  'production_biofortified_total', 'production_biofortified_mt',
  'cost_seeds_bio_no_subsidy_total', 'cost_seeds_bio_current_regime_total', 'subsidy_amount_absolute_total',
  'newseed_subsidy_total', 'producer_absorption_total', 'subsidy_reduction_cost_total',
  'newseed_savings_vs_current_total', 'coverage_pct', 'consumption_fsi_mt', 'bio_consumed_mt',
  'iron_added_kg_year', 'zinc_added_kg_year', 'population', 'n_people_biofortified',
];
// Extra keys that are not 06_02/06_03 columns (dashboard-derived; documented in spec 9)
export const EXTRA_KEYS = ['yield_increase_mt_per_ha', 'bags_seed', 'income_yield_value_total', 'income_price_revaluation_total'];

function emptyAgg() {
  const a = { n_farmers_bio: new Acc(), n_hybrid_bio: new Acc(), n_opv_bio: new Acc(), land_bio_mz: new Acc(), inc_r: [] };
  for (const [k] of SUM_KEYS) a[k] = new Acc();
  a.any = false;
  return a;
}

function finishAgg(a, mzToHa) {
  if (!a.any) { // department with no adopters: replace_na(0) (06_02x:1752-1768)
    const z = { n_farmers_bio: 0, n_hybrid_bio: 0, n_opv_bio: 0, land_bio_mz: 0, land_bio_ha: 0, income_increment_median: 0 };
    for (const [k] of SUM_KEYS) z[k] = 0;
    return z;
  }
  const o = {
    n_farmers_bio: a.n_farmers_bio.value(), n_hybrid_bio: a.n_hybrid_bio.value(), n_opv_bio: a.n_opv_bio.value(),
    land_bio_mz: a.land_bio_mz.value(),
  };
  o.land_bio_ha = o.land_bio_mz * mzToHa;
  const med = medianR(a.inc_r);
  o.income_increment_median = Number.isNaN(med) ? 0 : med;
  for (const [k] of SUM_KEYS) o[k] = a[k].value();
  return o;
}

function derived(row, P) { // 06_02x:2075-2131; 06_03x:1990-2035
  row.land_bio_pct = row.land_ha_total > 0 ? row.land_bio_ha / row.land_ha_total * 100 : 0;
  row.farmers_bio_pct = row.n_farmers_total > 0 ? row.n_farmers_bio / row.n_farmers_total * 100 : 0;
  row.hybrid_bio_pct = row.n_farmers_hybrid > 0 ? row.n_hybrid_bio / row.n_farmers_hybrid * 100 : 0;
  row.opv_bio_pct = row.n_farmers_opv > 0 ? row.n_opv_bio / row.n_farmers_opv * 100 : 0;
  row.production_increment_mt = row.production_increment_total * P.qq_to_mt;
  row.production_biofortified_mt = row.production_biofortified_total * P.qq_to_mt;
  row.income_per_farmer_total = row.n_farmers_total > 0 ? row.income_increment_total / row.n_farmers_total : 0;
  row.income_per_farmer_adopter = row.n_farmers_bio > 0 ? row.income_increment_total / row.n_farmers_bio : 0;
  row.bio_consumed_mt = row.consumption_fsi_mt * (row.coverage_pct / 100);
  row.n_people_biofortified = row.population * (row.coverage_pct / 100);
  row.iron_added_kg_year = row.bio_consumed_mt * P.fe_mg_per_g_maize * (P.factor_fe - 1);
  row.zinc_added_kg_year = row.bio_consumed_mt * P.zn_mg_per_g_maize * (P.factor_zn - 1);
  // extras (not in 06_02/06_03): 06_04x:326-330 overview "Yield Increase (MT/ha)"; dashboard bags
  row.yield_increase_mt_per_ha = row.land_bio_ha > 0 ? row.production_increment_mt / row.land_bio_ha : 0;
  row.bags_seed = row.land_bio_ha * P.bags_per_ha;
  return row;
}

function consumptionFsi(b, P) {
  const mb = b.mb;
  if (P.consumption_fsi_kg === null || P.consumption_fsi_kg === undefined) {
    return { qq: mb.consumption_fsi_qq, mt: mb.consumption_fsi_mt };
  }
  const qq = mb.population.map((pop) => pop * P.consumption_fsi_kg / P.kg_to_qq); // 06_01x:590
  const mt = qq.map((x) => x * 0.04536);                                            // 06_01x:591
  return { qq, mt };
}

function runLevel(b, state, penetration) {
  const P = state.r.params, R = state.R, nd = b.depts.length;
  const look = pInternalFor(state, penetration);
  const pInt = look.p_internal;
  const { floors, ks } = curveParams(state.r.mc);
  const dAgg = Array.from({ length: nd }, emptyAgg);
  const nAgg = emptyAgg();
  const bioAcc = Array.from({ length: nd }, () => new Acc());
  const adm = []; // admitted farmers (ranked index, r_i)
  if (pInt > 0) {
    for (let k = 0; k < R.n; k++) {
      const pe = R.pEntry[k];
      if (!(pe <= pInt)) continue; // filter(p_entry <= p_internal, p_internal > 0)
      const pr = R.profile[k];
      const ri = sigmoidCurve(pInt, pe, floors[pr], ks[pr]);
      adm.push(k);
      const d = R.dept[k], w = R.w[k];
      for (const A of [dAgg[d], nAgg]) {
        A.any = true;
        A.n_farmers_bio.add(w);
        A.n_hybrid_bio.add(R.seg[k] !== SEG_OPV ? w : 0);
        A.n_opv_bio.add(R.seg[k] === SEG_OPV ? w : 0);
        const lv = R.land[k] * ri * w; if (!Number.isNaN(lv)) A.land_bio_mz.add(lv);
        for (const [key, col] of SUM_KEYS) { const v = R[col][k] * ri * w; if (!Number.isNaN(v)) A[key].add(v); }
        A.inc_r.push(R.income_increment[k] * ri);
      }
      const bv = R.bioBase[k] * ri; // 06_01x:1326 bio_weighted_p = bio_base * r_i
      if (!Number.isNaN(bv)) bioAcc[d].add(bv);
    }
  }
  // --- 06_01x saturation: local production -> gravity -> cap (06_01x:1490-1541)
  const cons = consumptionFsi(b, P);
  const bioLocal = bioAcc.map((a) => a.value());
  let coveragePct, bioFinal, excess, iterations;
  if (pInt > 0) {
    const g = redistributeGravity(bioLocal, cons.qq, gravityTable(b, P), P.gravity_max_iterations, P.gravity_tolerance);
    coveragePct = Array.from(g.coverage, (c) => Math.min(c * 100, 100));
    bioFinal = Array.from(g.bio_production, (x, j) => Math.min(x, cons.qq[j]));
    excess = Array.from(g.excess); iterations = g.iterations;
  } else { // penetration 0: 06_02x baseline rows carry coverage_pct = 0 (06_02x:1589)
    coveragePct = new Array(nd).fill(0); bioFinal = new Array(nd).fill(0); excess = new Array(nd).fill(0); iterations = 0;
  }
  // --- departmental rows (06_02x)
  const depRows = [];
  for (let j = 0; j < nd; j++) {
    const row = {
      region: b.depts[j], departamento: b.depts[j], penetration,
      population: b.mb.population[j], n_farmers_total: b.mb.n_farmers_total[j],
      n_farmers_hybrid: b.mb.n_farmers_hybrid[j], n_farmers_opv: b.mb.n_farmers_opv[j],
      land_ha_total: b.mb.land_ha_total[j], consumption_fsi_mt: cons.mt[j],
      ...finishAgg(dAgg[j], P.mz_to_ha),
      coverage_pct: coveragePct[j],
    };
    depRows.push(derived(row, P));
  }
  const order = b.deptOutputOrder.map((d) => b.deptIndex.get(d));
  const departments = order.map((j) => depRows[j]);
  // --- national row (06_03x)
  const nat = {
    region: 'Guatemala Total', penetration,
    population: sumR(b.mb.population), n_farmers_total: sumR(b.mb.n_farmers_total),
    n_farmers_hybrid: sumR(b.mb.n_farmers_hybrid), n_farmers_opv: sumR(b.mb.n_farmers_opv),
    land_ha_total: sumR(b.mb.land_ha_total), consumption_fsi_mt: sumR(cons.mt),
    ...finishAgg(nAgg, P.mz_to_ha),
  };
  // national coverage = consumption-weighted mean of departmental coverage (06_03x:1501-1507)
  if (pInt > 0) {
    const num = new Acc();
    for (let j = 0; j < nd; j++) { const v = coveragePct[j] * cons.qq[j]; if (!Number.isNaN(v)) num.add(v); }
    nat.coverage_pct = num.value() / sumR(cons.qq);
  } else nat.coverage_pct = 0;
  const national = derived(nat, P);
  // --- hand-off to nutrition (what 06_02x/06_03x read from the 06_01 saturation file)
  const byName = (arr) => Object.fromEntries(b.depts.map((d, j) => [d, arr[j]]));
  const handoff = {
    penetration, p_internal: pInt, land_share_achieved: look.land_share_achieved,
    coverage_pct: byName(coveragePct),                 // {department: 0..100}, 06_01 saturation coverage_pct
    annual_consumption_qq: byName(cons.qq),            // weights for national coverage (06_03x:1501-1507)
    population: byName(Array.from(b.mb.population)),
    consumption_fsi_mt: byName(Array.from(cons.mt)),
    bio_production_qq: byName(bioFinal),
    departments: b.depts.map((d, j) => ({
      departamento: d,
      coverage_pct: coveragePct[j],            // 0..100, capped; drives child assignment
      bio_production_qq: bioFinal[j],          // after gravity, capped at consumption
      annual_consumption_qq: cons.qq[j],
      bio_production_local_qq: bioLocal[j],    // before redistribution
      excess_qq: excess[j],
    })),
    national_coverage_pct: national.coverage_pct,
    gravity_iterations: iterations,
    n_adopter_records: adm.length,
  };
  return { penetration, p_internal: pInt, lookup: look, national, departments, handoff };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

// R's levels are seq(0, 1, by = 0.1) = k * 0.1 (06_01x:911; 06_02x:1798), e.g.
// 0.30000000000000004. A user value within 1e-9 of a tenth is snapped to R's double.
export const R_LEVELS = Array.from({ length: 11 }, (_, k) => k * 0.1);
function snapPenetration(p) {
  const k = Math.round(p * 10);
  return Math.abs(p - k / 10) < 1e-7 ? k * 0.1 : p;
}

export function createEcon(bundle) {
  const b = normalizeBundle(bundle);
  const cache = new Map();
  const getState = (scenario) => {
    const r = resolveScenario(b, scenario);
    const key = rankKey(r);
    let st = cache.get(key);
    if (!st) {
      st = prepare(b, r);
      if (cache.size > 24) cache.delete(cache.keys().next().value);
      cache.set(key, st);
    }
    // params that do not affect the ranking may differ between calls
    if (st.r.params !== r.params) st = { ...st, r: { ...st.r, params: r.params } };
    return st;
  };
  return {
    defaults() {
      const v = b.variants;
      return {
        seeds: v.seeds || [], subsidies: v.subsidies || [],
        pathways: v.pathways || ['pco', 'pma'],
        penetration_levels: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        params: { ...DEFAULT_PARAMS, price_sale: b.priceSale },
        bio_cost_no_subsidy_per_mz: v.bio_cost_no_subsidy_per_mz,
      };
    },
    prepare(scenario) { return getState(scenario); },
    run(scenario) {
      const pen = Number(scenario.penetration);
      if (!(pen >= 0 && pen <= 1)) throw new Error('econ: penetration must be in [0, 1]');
      return runLevel(b, getState(scenario), snapPenetration(pen));
    },
    runLevels(scenario, levels = R_LEVELS) {
      const st = getState(scenario);
      return levels.map((p) => runLevel(b, st, snapPenetration(p)));
    },
    // farmer-level view for validation against the 02_06 parquet (bundle row order)
    farmerView(scenario) {
      const st = getState(scenario), n = b.farmers.n;
      const pEntry = new Float64Array(n), rankPos = new Int32Array(n);
      st.rank.order.forEach((i, k) => { pEntry[i] = st.rank.pEntry[k]; rankPos[i] = k; });
      return {
        income_increment: st.econ.income_increment, production_biofortified: st.econ.production_biofortified,
        adoption_score: st.rank.adoptionScore, risk_penalty: st.rank.riskPenalty, p_entry: pEntry, rank: rankPos,
      };
    },
  };
}

// Build a scenario from the bundle's variant tables (e.g. 's26', 'sub50').
export function scenarioFromVariants(bundle, seedSuffix, subsidySuffix, penetration, pathway = 'pco', params = {}) {
  const B = bundle && bundle.econ ? bundle.econ : bundle;
  const s = B.variants.seeds.find((x) => x.id === seedSuffix || x.seed_suffix === seedSuffix);
  const u = B.variants.subsidies.find((x) => x.id === subsidySuffix || x.subsidy_suffix === subsidySuffix);
  if (!s || !u) throw new Error(`econ: unknown variant ${seedSuffix}/${subsidySuffix}`);
  return {
    seed: { id: s.id, label: s.label, year: s.year, yield_change: s.yield_change },
    subsidy: {
      id: u.id, newseed_subsidy_per_mz: u.newseed_subsidy_per_mz,
      bio_cost_no_subsidy_per_mz: u.bio_cost_no_subsidy_per_mz ?? B.variants.bio_cost_no_subsidy_per_mz,
      seed_cost_conventional: u.seed_cost_conventional, seed_cost_biofortified: u.seed_cost_biofortified,
    },
    pathway, penetration, params: { ...params },
  };
}
