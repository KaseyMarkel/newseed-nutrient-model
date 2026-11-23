// =============================================================================
// engine.js: the API the site uses (CONTRACT.md "Engine API").
//
//   import { createEngine } from '../engine/engine.js';
//   const eng = createEngine(bundle);   // bundle = merged bundle_econ.json + bundle_nutrition.json
//   const res = eng.run(scenario);      // { national: {...}, departments: [{region, ...}] }
//   eng.defaults();                     // { seeds, subsidies, pathways, params, ... }
//
// run(): economics (econ.js) -> hand-off (departmental coverage_pct after
// gravity redistribution) -> nutrition (nutrition.js) -> merged rows whose keys
// are the 06_02 (departments) / 06_03 (national) column names (spec/kpis.md).
//
// Merge rule: economics keys come from econ.js; child-outcome keys from
// nutrition.js. The coverage-derived keys (coverage_pct, bio_consumed_mt,
// n_people_biofortified, iron/zinc_added_kg_year, population,
// consumption_fsi_mt) come from econ.js when it returns them (they then honour
// economics params such as consumption_fsi_kg); with params.coverage_override
// they come from nutrition.js so they match the overridden coverage.
//
// Nutrition params read from scenario.params: factor_fe, factor_zn, factor_prot
// (QPM content multipliers, defaults 1.19 / 1.38 / 1.94) and gunaratna_effect_size
// (0.09, pma only); coverage_override; include_quantiles.
//
// Extra entry points: runLevels(scenario, levels) for the 11 dashboard levels
// (shares the farmer ranking), and createEngine(bundle, { econ }) to inject an
// economics implementation with the same run() / handoff signature (tests).
// =============================================================================

import { createEcon } from './econ.js';
import { createNutrition, NUTRITION_KEYS, QUANTILE_KEYS, COVERAGE_KEYS } from './nutrition.js';
import { validateScenario } from './validate.js';

export const DASHBOARD_LEVELS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

const PATHWAY_LABELS = { pco: 'Covariate', pma: 'Meta-Analysis' };

function overrideHandoff(handoff, override, penetration) {
  const h = { ...(handoff || {}), penetration };
  const rows = (handoff && Array.isArray(handoff.departments)) ? handoff.departments.map((r) => ({ ...r })) : [];
  const byName = new Map(rows.map((r) => [r.departamento ?? r.region, r]));
  for (const [name, v] of Object.entries(override)) {
    const r = byName.get(name);
    if (r) r.coverage_pct = v; else rows.push({ departamento: name, coverage_pct: v });
  }
  h.departments = rows;
  delete h.national_coverage_pct; // recomputed from the overridden departments
  delete h.coverage_pct;
  return h;
}

// Azahar's last-child decision at exactly 100% coverage (pipeline/build_boundary_table.mjs).
// A department that gives away all its surplus ends at coverage 1 or 1 - 1 ulp depending on
// the last bit of R's arithmetic (its Windows exp()), and 06_02x's `weight_cumsum <=
// weight_target` then does or does not count its last child. For an unmodified official
// scenario, a department whose coverage is within 1e-9 of 100 takes the decision R made.
const JUST_BELOW_100 = 99.99999999999997; // the double R produced (100 - 2^-45)
const sameNums = (a, b) => a && b && Object.keys(b).every((k) => Number(a[k]) === Number(b[k]));

function boundaryDecisions(bundle, scenario, econDefaults) {
  const B = bundle && bundle.econ ? bundle.econ : bundle;
  const params0 = scenario.params || {};
  const bd = B && B.boundary_decisions;
  const tm = params0.travel_matrix || 'azahar_fit';
  const table = bd && (bd.by_travel ? bd.by_travel[tm] : (tm === 'azahar_fit' ? bd.decisions : null));
  if (!table || !scenario.seed || !scenario.subsidy) return null;
  const pen = Number(scenario.penetration), k = Math.round(pen * 10);
  if (Math.abs(pen - k / 10) > 1e-7) return null;
  const params = scenario.params || {};
  if (params.coverage_override) return null;
  for (const [key, v] of Object.entries(params)) { // any economics change makes it a new scenario
    if (key in econDefaults && key !== 'travel_matrix' && key !== 'factor_fe' && key !== 'factor_zn' && v !== null && v !== undefined && v !== econDefaults[key]) return null;
  }
  // the official variant with the same numbers, whatever the scenario calls it
  const seed = (B.variants.seeds || []).find((s) => sameNums(scenario.seed.yield_change, s.yield_change));
  const bcns = (u) => Number(u.bio_cost_no_subsidy_per_mz ?? B.variants.bio_cost_no_subsidy_per_mz);
  const sub = (B.variants.subsidies || []).find((u) =>
    Number(scenario.subsidy.newseed_subsidy_per_mz) === Number(u.newseed_subsidy_per_mz)
    && bcns(scenario.subsidy) === bcns(u)
    && sameNums(scenario.subsidy.seed_cost_conventional, u.seed_cost_conventional)
    && sameNums(scenario.subsidy.seed_cost_biofortified, u.seed_cost_biofortified));
  if (!seed || !sub) return null;
  return table[`${seed.id}|${sub.id}|${k}`] || null;
}

function applyBoundary(handoff, decisions) {
  let changed = false;
  const rows = handoff.departments.map((r) => {
    const d = decisions[r.departamento ?? r.region];
    if (!d || Math.abs(r.coverage_pct - 100) > 1e-9) return r;
    const v = d === 'at' ? 100 : JUST_BELOW_100;
    if (v === r.coverage_pct) return r;
    changed = true;
    return { ...r, coverage_pct: v };
  });
  if (!changed) return handoff;
  const h = { ...handoff, departments: rows };
  if (h.coverage_pct && typeof h.coverage_pct === 'object') {
    h.coverage_pct = Object.fromEntries(rows.map((r) => [r.departamento ?? r.region, r.coverage_pct]));
  }
  return h;
}

function mergeRow(econRow, nutRow, coverageFromNutrition) {
  const out = { ...(nutRow || {}) };
  if (econRow) {
    for (const [k, v] of Object.entries(econRow)) {
      if (k === 'departamento') continue;
      if (coverageFromNutrition && COVERAGE_KEYS.includes(k)) continue;
      if (NUTRITION_KEYS.includes(k) && !COVERAGE_KEYS.includes(k)) continue; // child KPIs are nutrition's
      out[k] = v;
    }
  }
  return out;
}

export function createEngine(bundle, opts = {}) {
  const econ = opts.econ || createEcon(bundle);
  const nut = createNutrition(bundle);
  const econDefaults = typeof econ.defaults === 'function' ? econ.defaults().params || {} : {};
  const B0 = bundle && bundle.econ ? bundle.econ : bundle;
  const vopts = { bioCostNoSubsidyDefault: B0 && B0.variants ? Number(B0.variants.bio_cost_no_subsidy_per_mz) : null };
  const validate = (s) => validateScenario(s, nut.departments, vopts);

  function combine(scenario, e, warnings = []) {
    const pathway = scenario.pathway || 'pco';
    const params = scenario.params || {};
    const penetration = Number(scenario.penetration);
    const override = params.coverage_override;
    let handoff = override ? overrideHandoff(e.handoff, override, penetration) : { ...e.handoff, penetration };
    const decisions = override ? null : boundaryDecisions(bundle, scenario, econDefaults);
    if (decisions && Array.isArray(handoff.departments)) handoff = applyBoundary(handoff, decisions);
    const factors = { fe: params.factor_fe, zn: params.factor_zn, prot: params.factor_prot,
      effect: params.gunaratna_effect_size, lt: params.lystrp_scale, va: params.va_fraction };
    const n = nut.run(pathway, handoff, { includeQuantiles: params.include_quantiles !== false, factors, extras: params.extra_nutrients });
    const econByRegion = new Map((e.departments || []).map((r) => [r.region ?? r.departamento, r]));
    const departments = n.departments.map((r) => mergeRow(econByRegion.get(r.region), r, !!override));
    const national = mergeRow(e.national, n.national, !!override);
    national.region = 'Guatemala Total';
    // R's 06_01x stops when the land-share grid misses the target by more than 0.25 pp
    const look = e.lookup || {};
    const gridErrorPp = Number.isFinite(look.error_pp) ? look.error_pp : null;
    if (penetration > 0 && gridErrorPp !== null && Math.abs(gridErrorPp) > 0.25) {
      throw new Error(`Land-share grid missed the ${(penetration * 100).toFixed(1)}% target by ${gridErrorPp.toFixed(3)} pp (Azahar's 06_01x stops above 0.25 pp); use a finer grid_n_intervals`);
    }
    const w = [...warnings];
    if (national.n_farmers_bio > 0 && national.income_per_farmer_adopter < 0) {
      w.push('adopting farmers lose money on average in this scenario; the model still assumes they plant the seed, because the share of land is an input');
    }
    return {
      national,
      departments,
      meta: {
        pathway, penetration,
        p_internal: e.p_internal,
        land_share_achieved_pct: Number.isFinite(look.land_pct_achieved) ? look.land_pct_achieved : null,
        land_share_error_pp: gridErrorPp,
        children_flagged: n.flagCounts,
        warnings: w,
      },
    };
  }

  return {
    run(scenario) {
      const { scenario: sc, warnings } = validate(scenario);
      return combine(sc, econ.run(sc), warnings);
    },
    runLevels(scenario, levels = DASHBOARD_LEVELS) {
      if (!Array.isArray(levels) || !levels.length) throw new Error('Invalid scenario: levels must be a non-empty array');
      const checked = levels.map((p) => validate({ ...scenario, penetration: p }));
      const sc = { ...checked[0].scenario }; delete sc.penetration;
      if (typeof econ.runLevels === 'function') {
        const es = econ.runLevels(sc, levels);
        return es.map((e, i) => combine({ ...sc, penetration: levels[i] }, e, checked[i].warnings));
      }
      return levels.map((p, i) => combine({ ...sc, penetration: p }, econ.run({ ...sc, penetration: p }), checked[i].warnings));
    },
    validate,
    defaults() {
      const d = typeof econ.defaults === 'function' ? econ.defaults() : {};
      const params = { ...(d.params || {}) };
      if (nut.pathways.every((p) => nut.canChangeFactors(p))) {
        // biofortification factors move child outcomes too (spec/nutrition.md section 11)
        const F = nut.defaultFactors;
        params.factor_fe = params.factor_fe ?? F.fe;
        params.factor_zn = params.factor_zn ?? F.zn;
        params.factor_prot = F.prot;
        params.gunaratna_effect_size = F.effect;
      }
      return {
        ...d,
        params,
        pathways: nut.pathways,
        pathway_labels: Object.fromEntries(nut.pathways.map((p) => [p, PATHWAY_LABELS[p] || p])),
        penetration_levels: d.penetration_levels || DASHBOARD_LEVELS,
        departments: nut.departments,
        kpi_keys: { nutrition: NUTRITION_KEYS, quantiles: QUANTILE_KEYS },
      };
    },
    nutrition: nut,
    econ,
  };
}
