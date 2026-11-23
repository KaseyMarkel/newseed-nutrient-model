// =============================================================================
// nutrition.js: nutrition side of the Azahar Guatemala ex-ante model, plain JS.
//
// From departmental biofortified-maize coverage (economics hand-off) to every
// child-outcome KPI of Module 06 (06_02x departmental, 06_03x national), for
// both pathways (pco = covariate GAM, pma = Gunaratna meta-analysis).
// Spec with file:line for every formula: spec/nutrition.md. KPI list:
// spec/kpis.md. Bundle layout: spec/bundle_schema.md, section "nutrition".
// No dependencies; ES module for browser and Node.
//
// API
//   const nut = createNutrition(bundle)       // bundle or bundle.nutrition
//   nut.run(pathway, handoff, opts)           // -> { national, departments }
//     handoff: { penetration,
//                departments: [{ departamento, coverage_pct (0..100), annual_consumption_qq? }]
//                  or coverage_pct: { <department>: pct } }
//     opts:    { includeQuantiles = true }
//   nut.baseline(pathway)                     // penetration-0 rows (cached)
//   nut.departments, nut.pathways
//
// Mechanism (spec/nutrition.md section 0): children of each department are
// stored in their fixed fill order (priority tier, then the set.seed(789)
// tie-breaker); the first children with cumulative weight <= coverage/100 x
// department total are flagged and take their QPM profile (06_02x:477-486,
// 595-713); then survey-weighted aggregation (06_02x:773-1213; 06_03x:785-993)
// and change/derived metrics (06_02x:1939-2149; 06_03x:1848-2058).
// =============================================================================

const QUANT_VARS = ['zinc', 'iron', 'iron_total', 'protein', 'maize_g', 'energy']; // 06_02x:2355-2371 order
const QUANT_GROUPS = ['under36', '36to59'];
const QUANT_PROBS = [0, 0.25, 0.5, 0.75, 1];
const QUANT_SUFFIX = ['q00', 'q25', 'q50', 'q75', 'q100'];
const TUKEY_VARS = new Set(['iron', 'iron_total', 'protein', 'maize_g', 'energy']); // not zinc (06_02x:1135-1210)

export const QUANTILE_KEYS = (() => {
  const out = [];
  for (const v of QUANT_VARS) for (const g of QUANT_GROUPS) for (const s of QUANT_SUFFIX) out.push(`${v}_${g}_${s}`);
  return out;
})();

// Nutrition-owned keys of the 06_02 / 06_03 outputs, in export order (06_02x:2167-2372)
export const NUTRITION_KEYS = [
  'coverage_pct', 'consumption_fsi_mt', 'bio_consumed_mt', 'iron_added_kg_year', 'zinc_added_kg_year',
  'population', 'n_people_biofortified',
  'maize_g_day_mean_baseline', 'maize_g_day_mean',
  'mean_energy_baseline', 'mean_energy', 'mean_energy_under36_baseline', 'mean_energy_under36',
  'mean_energy_36to59_baseline', 'mean_energy_36to59',
  'n_children', 'n_children_biofortified', 'children_coverage_pct',
  'stunting_pct_baseline', 'n_stunted_baseline', 'mean_zlen_baseline',
  'stunting_pct', 'n_stunted_scenario', 'mean_zlen',
  'stunting_change_pp', 'stunting_change_pct', 'n_stunting_averted', 'zlen_change',
  'mean_zinc_total_baseline', 'mean_zinc_total', 'mean_zinc_baseline', 'mean_zinc', 'zinc_change_pct',
  'zinc_inad_pct_baseline', 'zinc_inad_pct', 'zinc_inad_change_pp',
  'n_zinc_inad_baseline', 'n_zinc_inad_scenario', 'n_zinc_inad_averted',
  'zinc_inad_under12_pct', 'zinc_inad_12to35_pct', 'zinc_inad_36to59_pct',
  'mean_iron_total_baseline', 'mean_iron_total', 'mean_iron_baseline', 'mean_iron', 'iron_change_pct',
  'iron_inad_pct_baseline', 'iron_inad_pct', 'iron_inad_change_pp',
  'n_iron_inad_baseline', 'n_iron_inad_scenario', 'n_iron_inad_averted',
  'iron_inad_under36_pct', 'iron_inad_36to59_pct',
  'mean_protein_baseline', 'mean_protein', 'protein_change_pct',
  'protein_inad_pct_baseline', 'protein_inad_pct', 'protein_inad_change_pp',
  'n_protein_inad_baseline', 'n_protein_inad_scenario', 'n_protein_inad_averted',
  'protein_inad_under36_pct', 'protein_inad_36to59_pct',
];

// Keys that come from coverage x static department totals (06_02x:2117-2130; 06_03x:1501-1550, 2028-2032).
export const COVERAGE_KEYS = ['coverage_pct', 'consumption_fsi_mt', 'bio_consumed_mt', 'iron_added_kg_year',
  'zinc_added_kg_year', 'population', 'n_people_biofortified'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function f64(a, name) {
  if (!a) throw new Error(`nutrition: bundle lacks column ${name}`);
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] === null || a[i] === undefined ? NaN : a[i];
  return out;
}

// R accumulates sum() in 80-bit long double; LDAcc reproduces it bit for bit (engine/ldsum.js).
import { LDAcc } from './ldsum.js';
class Acc extends LDAcc {}

// Weighted mean accumulator: svymean(x, na.rm = TRUE) = sum(w x) / sum(w) over non-NA x
class Mean {
  constructor() { this.num = new Acc(); this.den = new Acc(); }
  add(x, w) { if (!Number.isNaN(x)) { this.num.add(w * x); this.den.add(w); } }
  value() { return this.num.value() / this.den.value(); }
}

// survey::svyquantile point estimate, qrule = "math" (survey 4.5, the srvyr
// 1.3.1 default). Verbatim logic of survey:::qrule_math / survey:::qs:
//   drop w == 0; ii <- order(x); cumw <- cumsum(w[ii]); W <- sum(w)
//   pos <- last(cumw <= p * W)   (last() returns 1 when none is TRUE)
//   posnext <- if (pos == n) pos else pos + 1
//   wlow <- p - cumw[pos] / W;  Q <- if (wlow <= 0) x[pos] else x[posnext]
// so q00 = min, q100 = max, and Q(p) is the first value whose cumulative
// weight share reaches p. NA x are dropped first (na.rm = TRUE).
function quantileMath(xs, ws, probs) {
  const n0 = xs.length;
  const idx = [];
  for (let i = 0; i < n0; i++) if (!Number.isNaN(xs[i]) && ws[i] !== 0 && !Number.isNaN(ws[i])) idx.push(i);
  const n = idx.length;
  if (!n) return probs.map(() => NaN);
  const Wacc = new Acc();
  for (const i of idx) Wacc.add(ws[i]);                 // sum(w) in data order
  const W = Wacc.value();
  const ord = idx.slice().sort((a, b) => xs[a] - xs[b]); // order(x): stable, ties in data order
  const cumw = new Float64Array(n);
  const acc = new Acc();
  for (let j = 0; j < n; j++) { acc.add(ws[ord[j]]); cumw[j] = acc.value(); }
  return probs.map((p) => {
    const t = p * W;
    let lo = 0, hi = n;                                  // first j with cumw[j] > t
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cumw[mid] <= t) lo = mid + 1; else hi = mid; }
    const pos = lo === 0 ? 0 : lo - 1;                   // last(cumw <= t), 1 if none
    const posnext = pos === n - 1 ? pos : pos + 1;
    const wlow = p - cumw[pos] / W;
    return wlow <= 0 ? xs[ord[pos]] : xs[ord[posnext]];
  });
}

// ---------------------------------------------------------------------------
// Bundle normalisation
// ---------------------------------------------------------------------------

function preparePathway(P, nd) {
  const C = P.cols;
  const n = P.n;
  const cols = {};
  for (const k of ['w', 'wcum', 'age', 'hfa_b', 'hfa_q', 'zlen_b', 'zlen_q', 'fe_b', 'fe_q', 'fea_b', 'fea_q',
    'zn_b', 'zn_q', 'taz_b', 'taz_q', 'prot_b', 'prot_q', 'ekm', 'ekt']) {
    cols[k] = f64(C[k], k);
    if (cols[k].length !== n) throw new Error(`nutrition: column ${k} length ${cols[k].length} != n ${n}`);
  }
  cols.ekt_q = C.ekt_q ? f64(C.ekt_q, 'ekt_q') : cols.ekt; // pma: total energy identical in both profiles
  const start = Int32Array.from(P.dept_start.map((v) => (v === null ? -1 : v)));
  const end = Int32Array.from(P.dept_end.map((v) => (v === null ? -1 : v)));
  const wtot = f64(P.weight_total, 'weight_total');
  if (start.length !== nd) throw new Error('nutrition: dept_start length != departments');
  // department index per child (for the national pass)
  const dept = new Int32Array(n).fill(-1);
  for (let d = 0; d < nd; d++) for (let i = start[d]; i >= 0 && i < end[d]; i++) dept[i] = d;
  let fi = null;
  if (P.factor_inputs && P.factor_inputs.cols) {
    const X = {};
    for (const [k, v] of Object.entries(P.factor_inputs.cols)) X[k] = f64(v, k);
    fi = { ...P.factor_inputs, cols: X };
    if (fi.gam_grid) fi.gam_grid = { ...fi.gam_grid, y: f64(fi.gam_grid.y, 'gam_grid.y') };
  }
  return { n, cols, start, end, wtot, dept, label: P.label, fi };
}

// ---------------------------------------------------------------------------
// Biofortification-factor overrides (spec/nutrition.md section 11)
// QPM value = baseline + maize part x (F - 1); Miller and 5 % iron absorption as
// in 04_08 C1/D1 and 05_04 D-G; HAZ: pco via the tabulated GAM smooth on the
// non-maize index (04_08 E), pma via the Gunaratna chain (05_05 B-D).
// With default factors the exported R columns are used unchanged.
// ---------------------------------------------------------------------------

export const DEFAULT_FACTORS = Object.freeze({ fe: 1.19, zn: 1.38, prot: 1.94, effect: 0.09 });

function millerTAZ(zn, age, M) {
  const a = M.a * Math.pow(age, M.e);
  const s = M.k_t + a + zn;
  return 0.5 * (s - Math.sqrt(s * s - 4 * a * zn));
}

function gridEval(G) {
  const dx = (G.x1 - G.x0) / (G.n - 1);
  const y = G.y, last = G.n - 2;
  return (v) => {
    if (Number.isNaN(v)) return NaN;
    const t = (v - G.x0) / dx;
    let i = Math.floor(t);
    if (i < 0) i = 0; else if (i > last) i = last; // linear extrapolation outside the grid
    return y[i] + (y[i + 1] - y[i]) * (t - i);
  };
}

function lmsZ(h, l, m, s) {
  let z;
  if (Math.abs(l - 1) < 0.001) z = (h - m) / (m * s);
  else if (l !== 0) z = (Math.pow(h / m, l) - 1) / (l * s);
  else z = Math.log(h / m) / s;
  return Math.max(-6, Math.min(6, z));
}

// force = true recomputes every QPM column even at default factors (validation)
function recomputeQpm(S, pathway, F, F0, K, force = false) {
  const c = S.cols, n = S.n;
  const X = S.fi && S.fi.cols;
  if (!X) throw new Error(`nutrition: bundle has no factor_inputs for ${pathway}; biofortification factors cannot be changed`);
  const M = K.miller, abs = K.iron_absorption;
  const sameFe = !force && F.fe === F0.fe, sameZn = !force && F.zn === F0.zn, sameProt = !force && F.prot === F0.prot;
  const out = {
    fe_q: sameFe ? c.fe_q : new Float64Array(n), fea_q: sameFe ? c.fea_q : new Float64Array(n),
    zn_q: sameZn ? c.zn_q : new Float64Array(n), taz_q: sameZn ? c.taz_q : new Float64Array(n),
    prot_q: sameProt ? c.prot_q : new Float64Array(n),
    zlen_q: c.zlen_q, hfa_q: c.hfa_q,
  };
  for (let i = 0; i < n; i++) {
    if (!sameFe) { out.fe_q[i] = c.fe_b[i] + X.fe_m[i] * (F.fe - 1); out.fea_q[i] = out.fe_q[i] * abs; }
    if (!sameZn) { out.zn_q[i] = c.zn_b[i] + X.zn_m[i] * (F.zn - 1); out.taz_q[i] = millerTAZ(out.zn_q[i], c.age[i], M); }
    if (!sameProt) out.prot_q[i] = c.prot_b[i] + X.pr_m[i] * (F.prot - 1);
  }
  let hazChanges;
  if (pathway === 'pco') hazChanges = force || !(F.fe === F0.fe && F.zn === F0.zn); // NI: Fe, Zn, Lys, Trp
  else hazChanges = force || !(F.prot === F0.prot && F.effect === F0.effect);      // Gunaratna: protein
  if (!hazChanges) return out;
  out.zlen_q = new Float64Array(n); out.hfa_q = new Float64Array(n);
  if (pathway === 'pco') {
    const P = S.fi.ni_params, s = gridEval(S.fi.gam_grid);
    const zfe = (fe) => (fe * abs - P.fe_absorbed_mean) / P.fe_absorbed_sd;
    const ztaz = (zn, age) => (millerTAZ(zn, age, M) - P.taz_mean) / P.taz_sd;
    for (let i = 0; i < n; i++) {
      const age = c.age[i];
      const dfe = zfe(X.fe_n[i] + X.fe_m[i] * (F.fe - 1)) - zfe(X.fe_n[i] + X.fe_m[i] * (F0.fe - 1));
      const dtaz = ztaz(X.zn_n[i] + X.zn_m[i] * (F.zn - 1), age) - ztaz(X.zn_n[i] + X.zn_m[i] * (F0.zn - 1), age);
      const niq = X.ni_q[i] + (dfe + dtaz) / 4;
      const z = c.zlen_b[i] + (s(niq) - s(X.ni_b[i]));
      out.zlen_q[i] = z; out.hfa_q[i] = Number.isNaN(z) ? NaN : (z < -2 ? 1 : 0);
    }
  } else {
    const g = S.fi.gunaratna || { adequacy_k: 8, adequacy_r0: 0.5 };
    const sig = (r) => 1 / (1 + Math.exp(-g.adequacy_k * (r - g.adequacy_r0)));
    const s0 = sig(0), s1 = sig(1);
    for (let i = 0; i < n; i++) {
      const r = out.prot_q[i] / X.har_prot[i];
      const A = Math.min(1, Math.max(0, (sig(r) - s0) / (s1 - s0)));
      const gv = X.gv[i];
      const dh = Number.isNaN(gv) ? 0 : gv * F.effect * A;
      const hb = X.h_end_b[i];
      const dz = lmsZ(hb + dh, X.l_end[i], X.m_end[i], X.s_end[i]) - lmsZ(hb, X.l_end[i], X.m_end[i], X.s_end[i]);
      const z = c.zlen_b[i] + dz;
      out.zlen_q[i] = z; out.hfa_q[i] = Number.isNaN(z) ? NaN : (z < -2 ? 1 : 0);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Aggregation of one group (a department or the nation)
// ---------------------------------------------------------------------------

function newGroup() {
  return {
    n: new Acc(), nbio: new Acc(),
    st: new Mean(), zlen: new Mean(),
    zn: new Mean(), fe: new Mean(), taz: new Mean(), fea: new Mean(), prot: new Mean(),
    maize: new Mean(), ene: new Mean(), ene36: new Mean(), ene59: new Mean(),
    zinad: new Mean(), feinad: new Mean(), prinad: new Mean(),
    zi12: new Mean(), zi35: new Mean(), zi59: new Mean(),
    fe36: new Mean(), fe59: new Mean(), pr36: new Mean(), pr59: new Mean(),
  };
}

function addChild(g, w, flag, age, hfa, zlen, fe, fea, zn, taz, prot, ekm, ekt, K) {
  g.n.add(w);                                   // survey_total(1)             02:828
  g.nbio.add(w * flag);                         // survey_total(flag)          02:829
  g.st.add(Number.isNaN(hfa) ? NaN : (hfa === 1 ? 1 : 0), w); // survey_mean(hfa == 1L) 02:818
  g.zlen.add(zlen, w);                          // 02:823
  g.zn.add(zn, w); g.fe.add(fe, w);             // 02:844-845
  g.taz.add(taz, w); g.fea.add(fea, w); g.prot.add(prot, w); // 02:847-849
  g.maize.add(ekm / K.maize_kcal_per_g, w);     // 02:851-854
  g.ene.add(ekt, w);                            // 02:856
  const lt36 = age < 36, ge36 = age >= 36;      // NA age -> neither (filter drops NA)
  if (lt36) g.ene36.add(ekt, w);                // 02:864-871
  if (ge36) g.ene59.add(ekt, w);                // 02:873-880
  // overall inadequacy (02:886-921): case_when -> NA conditions fall through to 0
  const zi = ((age < 12 && taz < K.zinc_thr[0]) || (age >= 12 && age < 36 && taz < K.zinc_thr[1]) ||
    (age >= 36 && taz < K.zinc_thr[2])) ? 1 : 0;
  g.zinad.add(zi, w);
  g.feinad.add(Number.isNaN(fea) ? NaN : (fea < K.iron_thr ? 1 : 0), w); // if_else -> NA kept, dropped by na.rm
  const pi = ((age < 36 && prot < K.prot_thr[0]) || (age >= 36 && prot < K.prot_thr[1])) ? 1 : 0;
  g.prinad.add(pi, w);
  // age-band inadequacy (02:928-1020): if_else -> NA when value NA
  const flagLt = (v, thr) => (Number.isNaN(v) ? NaN : (v < thr ? 1 : 0));
  if (age < 12) g.zi12.add(flagLt(taz, K.zinc_thr[0]), w);
  if (age >= 12 && age < 36) g.zi35.add(flagLt(taz, K.zinc_thr[1]), w);
  if (ge36) g.zi59.add(flagLt(taz, K.zinc_thr[2]), w);
  if (lt36) { g.fe36.add(flagLt(fea, K.iron_thr), w); g.pr36.add(flagLt(prot, K.prot_thr[0]), w); }
  if (ge36) { g.fe59.add(flagLt(fea, K.iron_thr), w); g.pr59.add(flagLt(prot, K.prot_thr[1]), w); }
}

function finishGroup(g) {
  return {
    stunting_pct: g.st.value() * 100,
    mean_zlen: g.zlen.value(),
    n_children: g.n.value(),
    n_children_biofortified: g.nbio.value(),
    mean_zinc_total: g.zn.value(),
    mean_iron_total: g.fe.value(),
    mean_zinc: g.taz.value(),
    mean_iron: g.fea.value(),
    mean_protein: g.prot.value(),
    maize_g_day_mean: g.maize.value(),
    mean_energy: g.ene.value(),
    mean_energy_under36: g.ene36.value(),
    mean_energy_36to59: g.ene59.value(),
    zinc_inad_pct: g.zinad.value() * 100,
    iron_inad_pct: g.feinad.value() * 100,
    protein_inad_pct: g.prinad.value() * 100,
    zinc_inad_under12_pct: g.zi12.value() * 100,
    zinc_inad_12to35_pct: g.zi35.value() * 100,
    zinc_inad_36to59_pct: g.zi59.value() * 100,
    iron_inad_under36_pct: g.fe36.value() * 100,
    iron_inad_36to59_pct: g.fe59.value() * 100,
    protein_inad_under36_pct: g.pr36.value() * 100,
    protein_inad_36to59_pct: g.pr59.value() * 100,
  };
}

// Quantiles of one department (02:1026-1100) and Tukey whisker ends (02:1135-1210)
function deptQuantiles(S, d, flagCount, K) {
  const { cols: c, start, end } = S;
  const out = {};
  const vals = {};
  for (const v of QUANT_VARS) for (const g of QUANT_GROUPS) vals[`${v}_${g}`] = { x: [], w: [] };
  const s = start[d], e = end[d];
  for (let i = s; i >= 0 && i < e; i++) {
    const q = (i - s) < flagCount;
    const age = c.age[i];
    const g = age < 36 ? 'under36' : (age >= 36 ? '36to59' : null);
    if (!g) continue;
    const w = c.w[i];
    const put = (v, x) => { const o = vals[`${v}_${g}`]; o.x.push(x); o.w.push(w); };
    put('zinc', q ? c.taz_q[i] : c.taz_b[i]);
    put('iron', q ? c.fea_q[i] : c.fea_b[i]);
    put('iron_total', q ? c.fe_q[i] : c.fe_b[i]);
    put('protein', q ? c.prot_q[i] : c.prot_b[i]);
    put('maize_g', c.ekm[i] / K.maize_kcal_per_g);
    put('energy', q ? c.ekt_q[i] : c.ekt[i]);
  }
  for (const v of QUANT_VARS) for (const g of QUANT_GROUPS) {
    const key = `${v}_${g}`;
    const qs = quantileMath(vals[key].x, vals[key].w, QUANT_PROBS);
    if (TUKEY_VARS.has(v)) {
      const iqr = qs[3] - qs[1];
      qs[0] = Math.max(qs[0], qs[1] - 1.5 * iqr);   // pmax(q00, q25 - 1.5 IQR)
      qs[4] = Math.min(qs[4], qs[3] + 1.5 * iqr);   // pmin(q100, q75 + 1.5 IQR)
      if (Number.isNaN(iqr)) { qs[0] = NaN; qs[4] = NaN; }
    }
    for (let k = 0; k < 5; k++) out[`${key}_${QUANT_SUFFIX[k]}`] = qs[k];
  }
  return out;
}

// One pass: flag prefix per department, aggregate by department and nationally
function aggregate(S, nd, flagCounts, K, includeQuantiles) {
  const { cols: c, start, end } = S;
  const groups = Array.from({ length: nd }, newGroup);
  const nat = newGroup();
  for (let d = 0; d < nd; d++) {
    const s = start[d], e = end[d];
    if (s < 0) continue;
    const k = flagCounts[d];
    for (let i = s; i < e; i++) {
      const q = (i - s) < k;
      const args = [c.w[i], q ? 1 : 0, c.age[i],
        q ? c.hfa_q[i] : c.hfa_b[i], q ? c.zlen_q[i] : c.zlen_b[i],
        q ? c.fe_q[i] : c.fe_b[i], q ? c.fea_q[i] : c.fea_b[i],
        q ? c.zn_q[i] : c.zn_b[i], q ? c.taz_q[i] : c.taz_b[i],
        q ? c.prot_q[i] : c.prot_b[i], c.ekm[i], q ? c.ekt_q[i] : c.ekt[i], K];
      addChild(groups[d], ...args);
      addChild(nat, ...args);
    }
  }
  const depts = groups.map((g, d) => {
    if (start[d] < 0) return null;
    const row = finishGroup(g);
    if (includeQuantiles) Object.assign(row, deptQuantiles(S, d, flagCounts[d], K));
    return row;
  });
  return { depts, national: finishGroup(nat) };
}

// Number of flagged children in a department: count of wcum <= target
// (wcum is non-decreasing, so the flagged set is a prefix) (02:477-486)
function prefixCount(wcum, s, e, target) {
  if (s < 0) return 0;
  if (!(target >= 0)) return 0; // NA coverage -> NA flags in R; treated as none here
  let lo = s, hi = e; // first index with wcum > target
  while (lo < hi) { const mid = (lo + hi) >> 1; if (wcum[mid] <= target) lo = mid + 1; else hi = mid; }
  return lo - s;
}

// Change metrics and derived counts (06_02x:1939-2149; 06_03x:1848-2058)
function withChanges(row, base) {
  const r = row;
  r.stunting_pct_baseline = base.stunting_pct;
  r.mean_zlen_baseline = base.mean_zlen;
  r.mean_zinc_total_baseline = base.mean_zinc_total;
  r.mean_iron_total_baseline = base.mean_iron_total;
  r.mean_zinc_baseline = base.mean_zinc;
  r.mean_iron_baseline = base.mean_iron;
  r.mean_protein_baseline = base.mean_protein;
  r.maize_g_day_mean_baseline = base.maize_g_day_mean;
  r.mean_energy_baseline = base.mean_energy;
  r.mean_energy_under36_baseline = base.mean_energy_under36;
  r.mean_energy_36to59_baseline = base.mean_energy_36to59;
  r.zinc_inad_pct_baseline = base.zinc_inad_pct;
  r.iron_inad_pct_baseline = base.iron_inad_pct;
  r.protein_inad_pct_baseline = base.protein_inad_pct;

  r.stunting_change_pp = r.stunting_pct_baseline - r.stunting_pct;
  r.stunting_change_pct = r.stunting_pct_baseline > 0
    ? (r.stunting_pct_baseline - r.stunting_pct) / r.stunting_pct_baseline * 100 : 0;
  r.zlen_change = r.mean_zlen - r.mean_zlen_baseline;
  r.zinc_change_pct = r.mean_zinc_baseline > 0 ? (r.mean_zinc - r.mean_zinc_baseline) / r.mean_zinc_baseline * 100 : 0;
  r.iron_change_pct = r.mean_iron_baseline > 0 ? (r.mean_iron - r.mean_iron_baseline) / r.mean_iron_baseline * 100 : 0;
  r.protein_change_pct = r.mean_protein_baseline > 0
    ? (r.mean_protein - r.mean_protein_baseline) / r.mean_protein_baseline * 100 : 0;
  r.zinc_inad_change_pp = r.zinc_inad_pct_baseline - r.zinc_inad_pct;
  r.iron_inad_change_pp = r.iron_inad_pct_baseline - r.iron_inad_pct;
  r.protein_inad_change_pp = r.protein_inad_pct_baseline - r.protein_inad_pct;

  r.children_coverage_pct = r.n_children > 0 ? r.n_children_biofortified / r.n_children * 100 : 0;
  r.n_stunted_baseline = r.n_children * (r.stunting_pct_baseline / 100);
  r.n_stunted_scenario = r.n_children * (r.stunting_pct / 100);
  r.n_stunting_averted = r.n_stunted_baseline - r.n_stunted_scenario;
  r.n_zinc_inad_baseline = r.n_children * (r.zinc_inad_pct_baseline / 100);
  r.n_zinc_inad_scenario = r.n_children * (r.zinc_inad_pct / 100);
  r.n_zinc_inad_averted = r.n_zinc_inad_baseline - r.n_zinc_inad_scenario;
  r.n_iron_inad_baseline = r.n_children * (r.iron_inad_pct_baseline / 100);
  r.n_iron_inad_scenario = r.n_children * (r.iron_inad_pct / 100);
  r.n_iron_inad_averted = r.n_iron_inad_baseline - r.n_iron_inad_scenario;
  r.n_protein_inad_baseline = r.n_children * (r.protein_inad_pct_baseline / 100);
  r.n_protein_inad_scenario = r.n_children * (r.protein_inad_pct / 100);
  r.n_protein_inad_averted = r.n_protein_inad_baseline - r.n_protein_inad_scenario;
  return r;
}

// Food-system KPIs from coverage (06_02x:2117-2130; 06_03x:1501-1550, 2028-2032)
function coverageDerived(r, K, F) {
  r.bio_consumed_mt = r.consumption_fsi_mt * (r.coverage_pct / 100);
  r.n_people_biofortified = r.population * (r.coverage_pct / 100);
  r.iron_added_kg_year = r.bio_consumed_mt * K.fe_mg_per_g_maize * (F.fe - 1);
  r.zinc_added_kg_year = r.bio_consumed_mt * K.zn_mg_per_g_maize * (F.zn - 1);
  return r;
}

function sumNaRm(a) { const acc = new Acc(); for (const v of a) if (!Number.isNaN(v)) acc.add(v); return acc.value(); }

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export function createNutrition(bundleIn) {
  // accepts the merged bundle ({nutrition: ...}), the file itself, or a double-wrapped
  // {nutrition: {nutrition: ...}} (site merge {...econ, ...nutritionFile, nutrition: nutritionFile})
  let B = bundleIn;
  for (let k = 0; k < 3 && B && !B.pathways && B.nutrition; k++) B = B.nutrition;
  if (!B || !B.pathways || !B.departments) throw new Error('nutrition: bundle lacks nutrition.pathways/departments');
  const depts = B.departments.slice();
  const nd = depts.length;
  const deptIndex = new Map(depts.map((d, i) => [d, i]));
  const K0 = B.constants || {};
  const K = {
    maize_kcal_per_g: K0.maize_kcal_per_g ?? 3.6,
    zinc_thr: K0.zinc_thr ?? [0.732, 1.074, 1.390],
    iron_thr: K0.iron_thr ?? 0.5,
    prot_thr: K0.prot_thr ?? [13, 19],
    fe_mg_per_g_maize: K0.fe_mg_per_g_maize ?? 2.71 / 100,
    zn_mg_per_g_maize: K0.zn_mg_per_g_maize ?? 2.21 / 100,
    factor_fe: K0.factor_fe ?? 1.19,
    factor_zn: K0.factor_zn ?? 1.38,
    factor_prot: K0.factor_prot ?? 1.94,
    iron_absorption: K0.iron_absorption ?? 0.05,
    miller: K0.miller ?? { k_t: 2.42, a: 0.633, e: 0.311 },
  };
  const F0 = { fe: K.factor_fe, zn: K.factor_zn, prot: K.factor_prot, effect: DEFAULT_FACTORS.effect };
  const ST = B.dept_static || {};
  const stat = {
    population: ST.population ? f64(ST.population, 'population') : new Float64Array(nd).fill(NaN),
    consumption_fsi_mt: ST.consumption_fsi_mt ? f64(ST.consumption_fsi_mt, 'consumption_fsi_mt') : new Float64Array(nd).fill(NaN),
    annual_consumption_qq: ST.annual_consumption_qq ? f64(ST.annual_consumption_qq, 'annual_consumption_qq') : new Float64Array(nd).fill(NaN),
  };
  const PW = {};
  for (const [pw, P] of Object.entries(B.pathways)) PW[pw] = preparePathway(P, nd);
  const baseCache = {};

  function resolveFactors(f) {
    const F = { ...F0 };
    if (f) for (const k of ['fe', 'zn', 'prot', 'effect']) {
      if (f[k] !== undefined && f[k] !== null && !Number.isNaN(Number(f[k]))) F[k] = Number(f[k]);
    }
    return F;
  }
  const factorCache = new Map();
  function factorState(pw, S, F) {
    if (F.fe === F0.fe && F.zn === F0.zn && F.prot === F0.prot && F.effect === F0.effect) return S;
    const key = `${pw}|${F.fe}|${F.zn}|${F.prot}|${F.effect}`;
    let st = factorCache.get(key);
    if (!st) {
      st = { ...S, cols: { ...S.cols, ...recomputeQpm(S, pw, F, F0, K) } };
      if (factorCache.size > 16) factorCache.delete(factorCache.keys().next().value);
      factorCache.set(key, st);
    }
    return st;
  }

  function baselineAgg(pw) {
    if (!baseCache[pw]) baseCache[pw] = aggregate(PW[pw], nd, new Int32Array(nd), K, true);
    return baseCache[pw];
  }

  // Read the hand-off into per-department arrays (bundle department order)
  function readHandoff(h) {
    const cov = new Float64Array(nd).fill(NaN);
    const acq = Float64Array.from(stat.annual_consumption_qq);
    const pop = Float64Array.from(stat.population);
    const cmt = Float64Array.from(stat.consumption_fsi_mt);
    if (h && Array.isArray(h.departments)) {
      for (const r of h.departments) {
        const name = r.departamento ?? r.region;
        const d = deptIndex.get(name);
        if (d === undefined) continue;
        if (r.coverage_pct !== undefined && r.coverage_pct !== null) cov[d] = r.coverage_pct;
        if (r.annual_consumption_qq !== undefined && r.annual_consumption_qq !== null) acq[d] = r.annual_consumption_qq;
        if (r.population !== undefined && r.population !== null) pop[d] = r.population;
        if (r.consumption_fsi_mt !== undefined && r.consumption_fsi_mt !== null) cmt[d] = r.consumption_fsi_mt;
      }
    }
    // keyed maps ({ <department>: value }), as econ.js also returns them
    const fromMap = (m, arr) => {
      if (!m || typeof m !== 'object' || Array.isArray(m)) return;
      for (const [name, v] of Object.entries(m)) {
        const d = deptIndex.get(name); if (d !== undefined && v !== null && v !== undefined) arr[d] = v;
      }
    };
    if (h && !Array.isArray(h.departments)) {
      fromMap(h.coverage_pct, cov);
      fromMap(h.annual_consumption_qq, acq);
      fromMap(h.population, pop);
      fromMap(h.consumption_fsi_mt, cmt);
    } else if (h) {
      fromMap(h.population, pop);
      fromMap(h.consumption_fsi_mt, cmt);
    }
    return { cov, acq, pop, cmt };
  }

  function run(pathway, handoff, opts = {}) {
    const S = PW[pathway];
    if (!S) throw new Error(`nutrition: unknown pathway ${pathway}`);
    const includeQuantiles = opts.includeQuantiles !== false;
    const F = resolveFactors(opts.factors);
    const SF = factorState(pathway, S, F);
    const penetration = handoff && handoff.penetration !== undefined ? Number(handoff.penetration) : NaN;
    const { cov, acq, pop, cmt } = readHandoff(handoff);
    if (penetration === 0) cov.fill(0); // 06_02x baseline path: flag 0, coverage 0 (02:1452, 1589)
    for (let d = 0; d < nd; d++) if (Number.isNaN(cov[d]) && S.start[d] >= 0) {
      throw new Error(`nutrition: hand-off lacks coverage_pct for ${depts[d]}`);
    }
    // 1. prefix lengths (02:479-486): target = (coverage_pct / 100) * weight_total
    const flagCounts = new Int32Array(nd);
    for (let d = 0; d < nd; d++) {
      const target = (cov[d] / 100) * S.wtot[d];
      flagCounts[d] = prefixCount(S.cols.wcum, S.start[d], S.end[d], target);
    }
    // 2. aggregate
    const base = baselineAgg(pathway);
    const agg = penetration === 0 ? base : aggregate(SF, nd, flagCounts, K, includeQuantiles);
    // 3. departments
    const departments = [];
    for (let d = 0; d < nd; d++) {
      const row = { region: depts[d], penetration };
      if (agg.depts[d]) {
        Object.assign(row, agg.depts[d]);
        if (!includeQuantiles) for (const k of QUANTILE_KEYS) delete row[k];
        withChanges(row, base.depts[d]);
      }
      row.coverage_pct = cov[d];
      row.population = pop[d];
      row.consumption_fsi_mt = cmt[d];
      coverageDerived(row, K, F);
      departments.push(row);
    }
    // 4. national (03:1501-1507 coverage; 03:785-993 children pooled)
    const national = { region: 'Guatemala Total', penetration };
    Object.assign(national, agg.national);
    withChanges(national, base.national);
    if (handoff && handoff.national_coverage_pct !== undefined && handoff.national_coverage_pct !== null) {
      national.coverage_pct = handoff.national_coverage_pct;
    } else if (penetration === 0) {
      national.coverage_pct = 0;
    } else {
      const num = new Acc(), den = new Acc();
      for (let d = 0; d < nd; d++) {
        const v = cov[d] * acq[d]; if (!Number.isNaN(v)) num.add(v);
        if (!Number.isNaN(acq[d])) den.add(acq[d]);
      }
      national.coverage_pct = num.value() / den.value();
    }
    national.population = sumNaRm(pop);
    national.consumption_fsi_mt = sumNaRm(cmt);
    coverageDerived(national, K, F);
    return { national, departments, flagCounts: Array.from(flagCounts) };
  }

  return {
    departments: depts,
    pathways: Object.keys(PW),
    constants: K,
    defaultFactors: { ...F0 },
    canChangeFactors(pathway) { return !!(PW[pathway] && PW[pathway].fi); },
    // every QPM column rebuilt from the factor inputs at the default factors (validation)
    recomputeAtDefaults(pathway) { return recomputeQpm(PW[pathway], pathway, { ...F0 }, F0, K, true); },
    rawColumns(pathway) { return PW[pathway].cols; },
    run,
    baseline(pathway) { return run(pathway, { penetration: 0, departments: [] }); },
    // children per department and pathway, for display ("who is reached first")
    info(pathway) {
      const S = PW[pathway];
      return { n: S.n, label: S.label, dept_n: depts.map((_, d) => (S.start[d] < 0 ? 0 : S.end[d] - S.start[d])) };
    },
  };
}

export const _internal = { quantileMath, prefixCount, Acc };
