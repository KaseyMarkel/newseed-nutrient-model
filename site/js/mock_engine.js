// Mock engine: implements the CONTRACT.md API (createEngine(bundle) -> { run, defaults })
// with placeholder numbers of the right magnitude. It is used only while the real
// engine (engine/engine.js + site/data/bundle*.json) is not available.
//
// The model is deliberately simple and transparent:
//   seed yield change (by segment) -> extra production per hectare
//   penetration (share of maize land) -> hectares, adopting farmers, income, subsidy
//   biofortified production / national consumption -> coverage
//   coverage -> nutrient and stunting outcomes, by interpolating the live
//   dashboard's KPI-trend curves (mock_reference.js)
// Official seeds reproduce the live curves exactly; custom seeds move along a
// coverage -> outcome table pooled from the three official seeds.

import {
  DEPARTMENTS, DEPT_TABLE_50, NATIONAL_50, DEPT_STUNTING_50, DEPT_MEDIANS_50, PEN_GRID, TRENDS
} from './mock_reference.js';

const OFFICIAL_SEEDS = [
  { id: 's22', label: '2022 Seed', year: '2022', yield_change: { OPV_Criollo: 0.316, Low: 0.256, Mid: 0.018, High: -0.138 } },
  { id: 's26', label: '2026 Seed', year: '2026', yield_change: { OPV_Criollo: 0.450, Low: 0.400, Mid: 0.100, High: -0.070 } },
  { id: 's28', label: '2028 Seed', year: '2028', yield_change: { OPV_Criollo: 0.550, Low: 0.550, Mid: 0.200, High: -0.020 } }
];

const CONV_SEED = { OPV_Criollo: 61, Low: 305, Mid: 488, High: 976 };
const OFFICIAL_SUBSIDIES = [
  { id: 'sub00', label: 'Current subsidy', reduction_pct: 0, newseed_subsidy_per_mz: 242, bio_cost_no_subsidy_per_mz: 547,
    seed_cost_conventional: { ...CONV_SEED }, seed_cost_biofortified: { OPV_Criollo: 305, Low: 305, Mid: 305, High: 305 } },
  { id: 'sub50', label: '50% subsidy reduction', reduction_pct: 50, newseed_subsidy_per_mz: 121, bio_cost_no_subsidy_per_mz: 547,
    seed_cost_conventional: { ...CONV_SEED }, seed_cost_biofortified: { OPV_Criollo: 366, Low: 366, Mid: 366, High: 366 } },
  { id: 'sub75', label: '75% subsidy reduction', reduction_pct: 75, newseed_subsidy_per_mz: 61, bio_cost_no_subsidy_per_mz: 547,
    seed_cost_conventional: { ...CONV_SEED }, seed_cost_biofortified: { OPV_Criollo: 396, Low: 396, Mid: 396, High: 396 } }
];

const PATHWAYS = [
  { id: 'pco', label: 'Covariate prediction', description: 'GAM stunting model on the synthetic child population (Script 04_08)' },
  { id: 'pma', label: 'Meta-analysis (Gunaratna)', description: 'Gunaratna et al. (2010) effect size on ENCOVI children (Script 05_06)' }
];

const SEGMENTS = ['OPV_Criollo', 'Low', 'Mid', 'High'];

const DEFAULT_PARAMS = {
  maize_price_gtq_per_qq: { value: 221, label: 'Maize farm-gate price (GTQ per quintal)', min: 50, max: 600 },
  adopter_baseline_yield_mt_per_ha: { value: 2.217, label: 'Baseline yield of adopting farmers (mt/ha)', min: 0.5, max: 6 },
  segment_land_share: { value: { OPV_Criollo: 0.75, Low: 0.10, Mid: 0.10, High: 0.05 }, label: 'Share of biofortified land by farmer segment' },
  segment_yield_mt_per_ha: { value: { OPV_Criollo: 2.0, Low: 2.6, Mid: 3.2, High: 4.4 }, label: 'Baseline yield by segment (mt/ha)' },
  consumption_fsi_mt: { value: 2999250, label: 'National maize consumption (mt/yr)', min: 1e6, max: 6e6 },
  population: { value: 17224000, label: 'Population (persons)', min: 1e7, max: 2.5e7 },
  n_children_pco: { value: 1522500, label: 'Children 6-59 months, covariate pathway', min: 1e6, max: 2e6 },
  n_children_pma: { value: 1481000, label: 'Children 6-59 months, meta-analysis pathway', min: 1e6, max: 2e6 },
  adoption_pool_exponent: { value: 2.39, label: 'Adoption pool shape (farmers enter faster than land converts)', min: 1, max: 5 },
  coverage_soft_cap_start: { value: 0.60, label: 'Coverage ratio where departmental saturation starts', min: 0.3, max: 1 },
  fe_mg_per_g_maize: { value: 0.0271, label: 'Iron in conventional maize (mg/g)', min: 0, max: 0.1 },
  zn_mg_per_g_maize: { value: 0.0221, label: 'Zinc in conventional maize (mg/g)', min: 0, max: 0.1 },
  factor_fe: { value: 1.19, label: 'Biofortification iron factor', min: 1, max: 2 },
  factor_zn: { value: 1.38, label: 'Biofortification zinc factor', min: 1, max: 2 },
  mz_to_ha: { value: 0.7, label: 'Hectares per manzana', min: 0.5, max: 1 },
  qq_to_mt: { value: 0.04536, label: 'Metric tons per quintal', min: 0.04, max: 0.05 }
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function interp(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

// Monotone pooled interpolation over unsorted (x, y) points.
function pooledInterp(points, x) {
  const pts = points.slice().sort((a, b) => a[0] - b[0]);
  // collapse near-duplicate x by averaging
  const xs = [], ys = [];
  for (const [px, py] of pts) {
    if (xs.length && Math.abs(px - xs[xs.length - 1]) < 1e-6) {
      ys[ys.length - 1] = (ys[ys.length - 1] + py) / 2;
    } else { xs.push(px); ys.push(py); }
  }
  return interp(xs, ys, x);
}

function resolveParams(overrides) {
  const out = {};
  for (const [k, def] of Object.entries(DEFAULT_PARAMS)) {
    const base = def.value;
    const ov = overrides && overrides[k];
    if (ov == null) { out[k] = typeof base === 'object' ? { ...base } : base; continue; }
    if (typeof base === 'object') {
      const o = { ...base };
      for (const s of Object.keys(o)) if (ov[s] != null && Number.isFinite(+ov[s])) o[s] = +ov[s];
      out[k] = o;
    } else {
      out[k] = Number.isFinite(+ov) ? +ov : base;
    }
  }
  return out;
}

export function createEngine(bundle) {
  const N = NATIONAL_50;
  const L = N.land_ha_total;
  const NF = N.n_farmers_total;
  const HYBRID_SHARE_OF_ADOPTERS = N.n_hybrid_bio / N.n_farmers_bio;
  const defaultsP = resolveParams(null);

  // Yield gain per hectare for a seed (mt/ha), calibrated so s26 gives the
  // live app's 0.759 mt/ha (438,815 mt over 578,122 ha at 50%).
  function rawGain(seed, P) {
    let g = 0;
    for (const s of SEGMENTS) {
      const yc = (seed.yield_change && seed.yield_change[s]) || 0;
      g += P.segment_land_share[s] * yc * P.segment_yield_mt_per_ha[s];
    }
    return g;
  }
  const CAL = (N.production_increment_mt / N.land_bio_ha) / rawGain(OFFICIAL_SEEDS[1], defaultsP);
  const gainPerHa = (seed, P) => CAL * rawGain(seed, P);

  function softCoverage(ratio, P) {
    const a = P.coverage_soft_cap_start;
    if (ratio <= a) return ratio;
    return 1 - (1 - a) * Math.exp(-(ratio - a) / (1 - a));
  }

  function coverageOf(seed, p, P) {
    if (p <= 0) return 0;
    const landHa = p * L;
    const prodBio = landHa * (P.adopter_baseline_yield_mt_per_ha + gainPerHa(seed, P));
    return softCoverage(prodBio / P.consumption_fsi_mt, P);
  }

  // Pooled coverage -> KPI tables for custom seeds (computed with default params).
  const pooled = {};
  function pooledTable(kpi, pathway) {
    const id = kpi + '|' + pathway;
    if (pooled[id]) return pooled[id];
    const pts = [];
    for (const seed of OFFICIAL_SEEDS) {
      const ys = TRENDS[kpi][pathway][seed.id];
      PEN_GRID.forEach((pen, i) => pts.push([coverageOf(seed, pen / 100, defaultsP), ys[i]]));
    }
    pooled[id] = pts;
    return pts;
  }

  function nutritionKpi(kpi, seed, pathway, p, coverage) {
    const isOfficial = OFFICIAL_SEEDS.some(s => s.id === seed.id &&
      SEGMENTS.every(k => Math.abs((s.yield_change[k] || 0) - ((seed.yield_change || {})[k] || 0)) < 1e-9));
    if (isOfficial) return interp(PEN_GRID, TRENDS[kpi][pathway][seed.id], p * 100);
    return pooledInterp(pooledTable(kpi, pathway), coverage);
  }

  function run(scenario) {
    const seed = scenario.seed || OFFICIAL_SEEDS[1];
    const sub = scenario.subsidy || OFFICIAL_SUBSIDIES[0];
    const pathway = TRENDS.stunting_pct[scenario.pathway] ? scenario.pathway : 'pco';
    const p = clamp(+scenario.penetration || 0, 0, 1);
    const P = resolveParams(scenario.params);

    // ---- economics (national) ----
    const land_bio_ha = p * L;
    const land_bio_mz = land_bio_ha / P.mz_to_ha;
    const poolShare = 1 - Math.pow(1 - p, P.adoption_pool_exponent);
    const n_farmers_bio = NF * poolShare;
    const n_hybrid_bio = Math.min(N.n_farmers_hybrid, n_farmers_bio * HYBRID_SHARE_OF_ADOPTERS);
    const n_opv_bio = n_farmers_bio - n_hybrid_bio;
    const gain = gainPerHa(seed, P);
    const production_increment_mt = land_bio_ha * gain;
    const production_increment_total = production_increment_mt / P.qq_to_mt;
    const production_biofortified_mt = land_bio_ha * (P.adopter_baseline_yield_mt_per_ha + gain);
    const production_biofortified_total = production_biofortified_mt / P.qq_to_mt;

    let seedDiffPerMz = 0, bioPricePerMz = 0;
    for (const s of SEGMENTS) {
      const bio = (sub.seed_cost_biofortified && sub.seed_cost_biofortified[s]) || 305;
      const conv = (sub.seed_cost_conventional && sub.seed_cost_conventional[s]) || CONV_SEED[s];
      seedDiffPerMz += P.segment_land_share[s] * (bio - conv);
      bioPricePerMz += P.segment_land_share[s] * bio;
    }
    const cost_seeds_increment_total = land_bio_mz * seedDiffPerMz;
    const income_increment_total = production_increment_total * P.maize_price_gtq_per_qq - cost_seeds_increment_total;
    const income_per_farmer_adopter = n_farmers_bio > 0 ? income_increment_total / n_farmers_bio : 0;
    const income_per_farmer_total = income_increment_total / NF;
    const income_increment_median = income_per_farmer_adopter * 0.62;

    const noSub = sub.bio_cost_no_subsidy_per_mz || 547;
    const nsPerMz = sub.newseed_subsidy_per_mz != null ? +sub.newseed_subsidy_per_mz : 242;
    const cost_seeds_bio_no_subsidy_total = land_bio_mz * noSub;
    const cost_seeds_bio_current_regime_total = land_bio_mz * bioPricePerMz;
    const newseed_subsidy_total = land_bio_mz * nsPerMz;
    const subsidy_reduction_cost_total = land_bio_mz * Math.max(0, bioPricePerMz - 305);
    const subsidy_amount_absolute_total = cost_seeds_bio_no_subsidy_total - cost_seeds_bio_current_regime_total - subsidy_reduction_cost_total;
    const producer_absorption_total = Math.max(0, subsidy_amount_absolute_total - newseed_subsidy_total);
    const newseed_savings_vs_current_total = land_bio_mz * (242 - nsPerMz);

    // ---- coverage ----
    const coverage = p > 0 ? softCoverage(production_biofortified_mt / P.consumption_fsi_mt, P) : 0;
    const coverage_pct = coverage * 100;
    const consumption_fsi_mt = P.consumption_fsi_mt;
    const bio_consumed_mt = consumption_fsi_mt * coverage;
    const iron_added_kg_year = bio_consumed_mt * P.fe_mg_per_g_maize * (P.factor_fe - 1);
    const zinc_added_kg_year = bio_consumed_mt * P.zn_mg_per_g_maize * (P.factor_zn - 1);
    const population = P.population;
    const n_people_biofortified = population * coverage;

    // ---- nutrition (national) ----
    const n_children = pathway === 'pco' ? P.n_children_pco : P.n_children_pma;
    const childCov = clamp(N.children_coverage_pct / 100 * (coverage / (N.bio_consumed_mt / N.consumption_fsi_mt)), 0, 1);
    const n_children_biofortified = n_children * childCov;
    const children_coverage_pct = childCov * 100;

    const stunting_pct_baseline = TRENDS.stunting_pct[pathway].s26[0];
    const stunting_pct = nutritionKpi('stunting_pct', seed, pathway, p, coverage);
    const stunting_change_pp = stunting_pct_baseline - stunting_pct;
    const stunting_change_pct = stunting_pct_baseline > 0 ? stunting_change_pp / stunting_pct_baseline * 100 : 0;
    const REF_STUNT_CHANGE = TRENDS.stunting_pct.pco.s26[0] - TRENDS.stunting_pct.pco.s26[5];
    const mean_zlen_baseline = N.mean_zlen_baseline;
    const zlen_change = (N.mean_zlen - N.mean_zlen_baseline) * stunting_change_pp / REF_STUNT_CHANGE;
    const mean_zlen = mean_zlen_baseline + zlen_change;
    const n_stunted_baseline = n_children * stunting_pct_baseline / 100;
    const n_stunted_scenario = n_children * stunting_pct / 100;
    const n_stunting_averted = n_stunted_baseline - n_stunted_scenario;

    const iron_inad_pct_baseline = TRENDS.iron_inad_pct[pathway].s26[0];
    const iron_inad_pct = nutritionKpi('iron_inad_pct', seed, pathway, p, coverage);
    const iron_inad_change_pp = iron_inad_pct_baseline - iron_inad_pct;
    const REF_IRON = TRENDS.iron_inad_pct.pco.s26[0] - TRENDS.iron_inad_pct.pco.s26[5];
    const ironRel = REF_IRON > 0 ? iron_inad_change_pp / REF_IRON : 0;
    const mean_iron_total_baseline = N.mean_iron_total_baseline;
    const mean_iron_total = mean_iron_total_baseline + (N.mean_iron_total - N.mean_iron_total_baseline) * ironRel;
    const mean_iron_baseline = N.mean_iron_baseline;
    const mean_iron = mean_iron_baseline + (N.mean_iron - N.mean_iron_baseline) * ironRel;
    const iron_change_pct = (mean_iron - mean_iron_baseline) / mean_iron_baseline * 100;

    const zinc_inad_pct_baseline = TRENDS.zinc_inad_pct[pathway].s26[0];
    const zinc_inad_pct = nutritionKpi('zinc_inad_pct', seed, pathway, p, coverage);
    const zinc_inad_change_pp = zinc_inad_pct_baseline - zinc_inad_pct;
    const REF_ZINC = TRENDS.zinc_inad_pct.pco.s26[0] - TRENDS.zinc_inad_pct.pco.s26[5];
    const zincRel = REF_ZINC > 0 ? zinc_inad_change_pp / REF_ZINC : 0;
    const mean_zinc_baseline = N.mean_zinc_baseline;
    const mean_zinc = mean_zinc_baseline + (N.mean_zinc - N.mean_zinc_baseline) * zincRel;
    const mean_zinc_total_baseline = N.mean_zinc_total_baseline;
    const mean_zinc_total = mean_zinc_total_baseline + (N.mean_zinc_total - N.mean_zinc_total_baseline) * zincRel;
    const zinc_change_pct = (mean_zinc - mean_zinc_baseline) / mean_zinc_baseline * 100;

    const protein_inad_pct_baseline = TRENDS.protein_inad_pct[pathway].s26[0];
    const protein_inad_pct = nutritionKpi('protein_inad_pct', seed, pathway, p, coverage);
    const protein_inad_change_pp = protein_inad_pct_baseline - protein_inad_pct;
    const REF_PROT = TRENDS.protein_inad_pct.pco.s26[0] - TRENDS.protein_inad_pct.pco.s26[5];
    const protRel = REF_PROT > 0 ? protein_inad_change_pp / REF_PROT : 0;
    const mean_protein_baseline = N.mean_protein_baseline;
    const mean_protein = mean_protein_baseline + (N.mean_protein - N.mean_protein_baseline) * protRel;
    const protein_change_pct = (mean_protein - mean_protein_baseline) / mean_protein_baseline * 100;

    const national = {
      n_farmers_total: NF, n_farmers_bio, farmers_bio_pct: n_farmers_bio / NF * 100,
      n_farmers_hybrid: N.n_farmers_hybrid, n_hybrid_bio, hybrid_bio_pct: n_hybrid_bio / N.n_farmers_hybrid * 100,
      n_farmers_opv: N.n_farmers_opv, n_opv_bio, opv_bio_pct: n_opv_bio / N.n_farmers_opv * 100,
      land_ha_total: L, land_bio_mz, land_bio_ha, land_bio_pct: p * 100,
      income_increment_total, income_increment_median, income_per_farmer_total, income_per_farmer_adopter,
      cost_seeds_increment_total, production_increment_total, production_increment_mt,
      production_biofortified_total, production_biofortified_mt,
      cost_seeds_bio_no_subsidy_total, cost_seeds_bio_current_regime_total, subsidy_amount_absolute_total,
      newseed_subsidy_total, producer_absorption_total, subsidy_reduction_cost_total, newseed_savings_vs_current_total,
      coverage_pct, consumption_fsi_mt, bio_consumed_mt, iron_added_kg_year, zinc_added_kg_year,
      population, n_people_biofortified,
      maize_g_day_mean_baseline: N.maize_g_day_mean_baseline, maize_g_day_mean: N.maize_g_day_mean,
      mean_energy_baseline: N.mean_energy, mean_energy: N.mean_energy,
      mean_energy_under36_baseline: N.mean_energy_under36, mean_energy_under36: N.mean_energy_under36,
      mean_energy_36to59_baseline: N.mean_energy_36to59, mean_energy_36to59: N.mean_energy_36to59,
      n_children, n_children_biofortified, children_coverage_pct,
      stunting_pct_baseline, n_stunted_baseline, mean_zlen_baseline, stunting_pct, n_stunted_scenario, mean_zlen,
      stunting_change_pp, stunting_change_pct, n_stunting_averted, zlen_change,
      mean_zinc_total_baseline, mean_zinc_total, mean_zinc_baseline, mean_zinc, zinc_change_pct,
      zinc_inad_pct_baseline, zinc_inad_pct, zinc_inad_change_pp,
      n_zinc_inad_baseline: n_children * zinc_inad_pct_baseline / 100,
      n_zinc_inad_scenario: n_children * zinc_inad_pct / 100,
      n_zinc_inad_averted: n_children * zinc_inad_change_pp / 100,
      zinc_inad_under12_pct: zinc_inad_pct * 0.62, zinc_inad_12to35_pct: zinc_inad_pct * 1.0, zinc_inad_36to59_pct: zinc_inad_pct * 1.12,
      mean_iron_total_baseline, mean_iron_total, mean_iron_baseline, mean_iron, iron_change_pct,
      iron_inad_pct_baseline, iron_inad_pct, iron_inad_change_pp,
      n_iron_inad_baseline: n_children * iron_inad_pct_baseline / 100,
      n_iron_inad_scenario: n_children * iron_inad_pct / 100,
      n_iron_inad_averted: n_children * iron_inad_change_pp / 100,
      iron_inad_under36_pct: iron_inad_pct * 1.08, iron_inad_36to59_pct: iron_inad_pct * 0.9,
      mean_protein_baseline, mean_protein, protein_change_pct,
      protein_inad_pct_baseline, protein_inad_pct, protein_inad_change_pp,
      n_protein_inad_baseline: n_children * protein_inad_pct_baseline / 100,
      n_protein_inad_scenario: n_children * protein_inad_pct / 100,
      n_protein_inad_averted: n_children * protein_inad_change_pp / 100,
      protein_inad_under36_pct: protein_inad_pct * 1.1, protein_inad_36to59_pct: protein_inad_pct * 0.88
    };

    // ---- departments ----
    const refCov = N.bio_consumed_mt / N.consumption_fsi_mt; // 0.574 at the snapshot
    const covScale = refCov > 0 ? coverage / refCov : 0;
    const totIncome50 = Object.values(DEPT_TABLE_50).reduce((a, r) => a + r[11], 0);
    const totSeed50 = Object.values(DEPT_TABLE_50).reduce((a, r) => a + r[14], 0);
    const totCons50 = Object.values(DEPT_TABLE_50).reduce((a, r) => a + r[9], 0);
    const totChildren50 = Object.values(DEPT_TABLE_50).reduce((a, r) => a + r[16] / (r[17] / 100), 0);

    // first pass: unnormalised land and farmers
    const rawLand = {}, rawFarm = {};
    let sumLand = 0, sumFarm = 0;
    for (const d of DEPARTMENTS) {
      const r = DEPT_TABLE_50[d];
      const landShare50 = r[7] / r[6];
      const farmShare50 = r[1] / r[0];
      const kL = Math.log(1 - Math.min(0.999, landShare50)) / Math.log(0.5);
      const kF = Math.log(1 - Math.min(0.999, farmShare50)) / Math.log(0.5);
      rawLand[d] = r[6] * (1 - Math.pow(1 - p, kL));
      rawFarm[d] = r[0] * (1 - Math.pow(1 - p, kF));
      sumLand += rawLand[d]; sumFarm += rawFarm[d];
    }
    const departments = DEPARTMENTS.map(d => {
      const r = DEPT_TABLE_50[d];
      const landHa = sumLand > 0 ? rawLand[d] / sumLand * land_bio_ha : 0;
      const landMz = landHa / P.mz_to_ha;
      const farmers = sumFarm > 0 ? rawFarm[d] / sumFarm * n_farmers_bio : 0;
      const hybShare = r[1] > 0 ? r[3] / r[1] : HYBRID_SHARE_OF_ADOPTERS;
      const hyb = Math.min(r[2], farmers * hybShare);
      const opv = farmers - hyb;
      const yieldFactor = r[7] > 0 ? (r[8] / r[7]) / (N.production_increment_mt / N.land_bio_ha) : 1;
      const prodInc = landHa * gain * yieldFactor;
      const prodBio = landHa * (P.adopter_baseline_yield_mt_per_ha + gain * yieldFactor);
      const landRel = (r[7] > 0 && land_bio_ha > 0) ? (landHa / r[7]) / (land_bio_ha / N.land_bio_ha) : 0;
      const income = income_increment_total * (r[11] / totIncome50) * landRel;
      const seedDiff = cost_seeds_increment_total * (r[14] / totSeed50) * landRel;
      const subsidyD = landMz * nsPerMz;
      const cons = r[9];
      const cov50 = r[10] / r[9];
      const covD = clamp(cov50 * covScale, 0, 1);
      const bioCons = cons * covD;
      const popD = population * (cons / totCons50);
      const kids = r[16] / (r[17] / 100);
      const kidsD = kids / totChildren50 * n_children;
      const stBefore = DEPT_STUNTING_50[d][0];
      const stAfter50 = DEPT_STUNTING_50[d][1];
      const stAfter = Math.max(0, stBefore - (stBefore - stAfter50) * (stunting_change_pp / REF_STUNT_CHANGE));
      const chg = stBefore - stAfter;
      const zlenBase = -(stBefore / stunting_pct_baseline) * Math.abs(mean_zlen_baseline);
      const zlenChg = (N.mean_zlen - N.mean_zlen_baseline) * (chg / REF_STUNT_CHANGE);
      const childCovD = clamp(childCov * (covD / Math.max(coverage, 1e-9)), 0, 1);
      const idx = DEPARTMENTS.indexOf(d);
      const nutr = {};
      const bands = [['under36', 0], ['36to59', 1]];
      const natRef = { iron_total: [N.mean_iron_total_baseline, N.mean_iron_total - N.mean_iron_total_baseline, ironRel],
        zinc: [N.mean_zinc_baseline, N.mean_zinc - N.mean_zinc_baseline, zincRel],
        protein: [N.mean_protein_baseline, N.mean_protein - N.mean_protein_baseline, protRel],
        energy: [N.mean_energy, 0, 0], maize_g: [N.maize_g_day_mean, 0, 0] };
      for (const [v, ref] of Object.entries(natRef)) {
        for (const [g] of bands) {
          const med50 = DEPT_MEDIANS_50[v + '_' + g][idx];
          const relCov50 = cov50 / refCov;
          const base = med50 - ref[1] * relCov50;
          const relCovNow = covD / Math.max(coverage, 1e-9);
          const val = base + ref[1] * ref[2] * relCovNow;
          const q50 = Math.max(0.01, val);
          nutr[`${v}_${g}_q00`] = q50 * 0.35; nutr[`${v}_${g}_q25`] = q50 * 0.72; nutr[`${v}_${g}_q50`] = q50;
          nutr[`${v}_${g}_q75`] = q50 * 1.35; nutr[`${v}_${g}_q100`] = q50 * 2.2;
          if (v === 'iron_total') { nutr[`iron_${g}_q00`] = q50 * 0.35 * 0.052; nutr[`iron_${g}_q25`] = q50 * 0.72 * 0.052; nutr[`iron_${g}_q50`] = q50 * 0.052; nutr[`iron_${g}_q75`] = q50 * 1.35 * 0.052; nutr[`iron_${g}_q100`] = q50 * 2.2 * 0.052; }
        }
      }
      const meanOf = (v) => (nutr[`${v}_under36_q50`] * 0.45 + nutr[`${v}_36to59_q50`] * 0.55);
      const inadFactor = (v, natMean) => clamp(Math.pow(natMean / Math.max(0.01, meanOf(v)), 0.8), 0.45, 1.7);
      const dIronInad = clamp(iron_inad_pct * inadFactor('iron_total', mean_iron_total), 0, 100);
      const dZincInad = clamp(zinc_inad_pct * inadFactor('zinc', mean_zinc), 0, 100);
      const dProtInad = clamp(protein_inad_pct * inadFactor('protein', mean_protein), 0, 100);
      const ironInadBase = clamp(iron_inad_pct_baseline * inadFactor('iron_total', mean_iron_total), 0, 100);
      const zincInadBase = clamp(zinc_inad_pct_baseline * inadFactor('zinc', mean_zinc), 0, 100);
      const protInadBase = clamp(protein_inad_pct_baseline * inadFactor('protein', mean_protein), 0, 100);
      const ironMean = meanOf('iron_total'), zincMean = meanOf('zinc'), protMean = meanOf('protein');
      const ironMeanBase = ironMean - (mean_iron_total - mean_iron_total_baseline) * (covD / Math.max(coverage, 1e-9));
      const zincMeanBase = zincMean - (mean_zinc - mean_zinc_baseline) * (covD / Math.max(coverage, 1e-9));
      const protMeanBase = protMean - (mean_protein - mean_protein_baseline) * (covD / Math.max(coverage, 1e-9));
      return {
        region: d,
        n_farmers_total: r[0], n_farmers_bio: farmers, farmers_bio_pct: farmers / r[0] * 100,
        n_farmers_hybrid: r[2], n_hybrid_bio: hyb, hybrid_bio_pct: r[2] > 0 ? hyb / r[2] * 100 : 0,
        n_farmers_opv: r[4], n_opv_bio: opv, opv_bio_pct: r[4] > 0 ? opv / r[4] * 100 : 0,
        land_ha_total: r[6], land_bio_mz: landMz, land_bio_ha: landHa, land_bio_pct: landHa / r[6] * 100,
        income_increment_total: income, income_increment_median: farmers > 0 ? income / farmers * 0.62 : 0,
        income_per_farmer_total: income / r[0], income_per_farmer_adopter: farmers > 0 ? income / farmers : 0,
        cost_seeds_increment_total: seedDiff,
        production_increment_total: prodInc / P.qq_to_mt, production_increment_mt: prodInc,
        production_biofortified_total: prodBio / P.qq_to_mt, production_biofortified_mt: prodBio,
        cost_seeds_bio_no_subsidy_total: landMz * noSub, cost_seeds_bio_current_regime_total: landMz * bioPricePerMz,
        subsidy_amount_absolute_total: landMz * (noSub - bioPricePerMz - Math.max(0, bioPricePerMz - 305)),
        newseed_subsidy_total: subsidyD, producer_absorption_total: landMz * Math.max(0, (noSub - bioPricePerMz - Math.max(0, bioPricePerMz - 305)) - nsPerMz),
        subsidy_reduction_cost_total: landMz * Math.max(0, bioPricePerMz - 305), newseed_savings_vs_current_total: landMz * (242 - nsPerMz),
        coverage_pct: covD * 100, consumption_fsi_mt: cons, bio_consumed_mt: bioCons,
        iron_added_kg_year: bioCons * P.fe_mg_per_g_maize * (P.factor_fe - 1),
        zinc_added_kg_year: bioCons * P.zn_mg_per_g_maize * (P.factor_zn - 1),
        population: popD, n_people_biofortified: popD * covD,
        maize_g_day_mean_baseline: meanOf('maize_g'), maize_g_day_mean: meanOf('maize_g'),
        mean_energy_baseline: meanOf('energy'), mean_energy: meanOf('energy'),
        mean_energy_under36_baseline: nutr.energy_under36_q50, mean_energy_under36: nutr.energy_under36_q50,
        mean_energy_36to59_baseline: nutr.energy_36to59_q50, mean_energy_36to59: nutr.energy_36to59_q50,
        n_children: kidsD, n_children_biofortified: kidsD * childCovD, children_coverage_pct: childCovD * 100,
        stunting_pct_baseline: stBefore, n_stunted_baseline: kidsD * stBefore / 100, mean_zlen_baseline: zlenBase,
        stunting_pct: stAfter, n_stunted_scenario: kidsD * stAfter / 100, mean_zlen: zlenBase + zlenChg,
        stunting_change_pp: chg, stunting_change_pct: stBefore > 0 ? chg / stBefore * 100 : 0,
        n_stunting_averted: kidsD * chg / 100, zlen_change: zlenChg,
        mean_zinc_total_baseline: zincMeanBase * 5, mean_zinc_total: zincMean * 5,
        mean_zinc_baseline: zincMeanBase, mean_zinc: zincMean, zinc_change_pct: zincMeanBase > 0 ? (zincMean - zincMeanBase) / zincMeanBase * 100 : 0,
        zinc_inad_pct_baseline: zincInadBase, zinc_inad_pct: dZincInad, zinc_inad_change_pp: zincInadBase - dZincInad,
        n_zinc_inad_baseline: kidsD * zincInadBase / 100, n_zinc_inad_scenario: kidsD * dZincInad / 100, n_zinc_inad_averted: kidsD * (zincInadBase - dZincInad) / 100,
        zinc_inad_under12_pct: dZincInad * 0.62, zinc_inad_12to35_pct: dZincInad, zinc_inad_36to59_pct: dZincInad * 1.12,
        mean_iron_total_baseline: ironMeanBase, mean_iron_total: ironMean,
        mean_iron_baseline: ironMeanBase * 0.052, mean_iron: ironMean * 0.052,
        iron_change_pct: ironMeanBase > 0 ? (ironMean - ironMeanBase) / ironMeanBase * 100 : 0,
        iron_inad_pct_baseline: ironInadBase, iron_inad_pct: dIronInad, iron_inad_change_pp: ironInadBase - dIronInad,
        n_iron_inad_baseline: kidsD * ironInadBase / 100, n_iron_inad_scenario: kidsD * dIronInad / 100, n_iron_inad_averted: kidsD * (ironInadBase - dIronInad) / 100,
        iron_inad_under36_pct: dIronInad * 1.08, iron_inad_36to59_pct: dIronInad * 0.9,
        mean_protein_baseline: protMeanBase, mean_protein: protMean,
        protein_change_pct: protMeanBase > 0 ? (protMean - protMeanBase) / protMeanBase * 100 : 0,
        protein_inad_pct_baseline: protInadBase, protein_inad_pct: dProtInad, protein_inad_change_pp: protInadBase - dProtInad,
        n_protein_inad_baseline: kidsD * protInadBase / 100, n_protein_inad_scenario: kidsD * dProtInad / 100, n_protein_inad_averted: kidsD * (protInadBase - dProtInad) / 100,
        protein_inad_under36_pct: dProtInad * 1.1, protein_inad_36to59_pct: dProtInad * 0.88,
        ...nutr
      };
    });

    return { national, departments };
  }

  function defaults() {
    return {
      seeds: OFFICIAL_SEEDS.map(s => ({ ...s, yield_change: { ...s.yield_change } })),
      subsidies: OFFICIAL_SUBSIDIES.map(s => JSON.parse(JSON.stringify(s))),
      pathways: PATHWAYS.map(p => ({ ...p })),
      params: JSON.parse(JSON.stringify(DEFAULT_PARAMS))
    };
  }

  return { run, defaults, isMock: true };
}
