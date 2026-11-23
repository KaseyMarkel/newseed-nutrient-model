// Health outcomes beyond stunting (extension). Pure functions of an engine result
// (national + department rows, whose *_change_pp are vs no biofortified maize) and the boosts.
// Annual, steady-state figures. Sources in evidence.js; parameters below are editable on the page.

export const HEALTH_DEFAULTS = Object.freeze({
  anemia_baseline: 'sivesnu',  // 'sivesnu' 6.1% (venous, 2018/19) | 'ensmi' 32.4% (capillary, 2014/15)
  zinc_food_discount: 0.5,     // share of the supplement-trial effect a dietary gain keeps (0-1)
  serum_folate0: 10,           // women's baseline serum folate, ng/mL (assumed; Guatemala value not found)
  mortality: false             // include the low-confidence death pathways (zinc, vitamin A)
});

export const H = Object.freeze({
  anemia_prev: { sivesnu: 6.1, ensmi: 32.4 },  // % of children 6-59 mo
  frac_anemia_iron: 0.269,       // Latin America, Petry 2016
  dw_anemia: 0.0249,             // assumed 60% mild (0.004), 38% moderate (0.052), 2% severe (0.149), GBD 2019 weights
  diarrhea_inc: 2.5,             // episodes per child-year (range 1.6-3.8)
  zinc_rr_diarrhea: 0.91,        // Cochrane 2023
  dalys_per_diarrhea: 0.0014,    // GBD weights 0.074/0.188/0.247 split 64.8/28.9/6.9%, 4.3 days
  pneu_inc: 0.22, zinc_rr_pneu: 0.87,
  u5_deaths: 7745,               // UNICEF 2024
  cod_diarrhea: 0.07, cod_pneumonia: 0.12,
  zinc_mort_diar: 0.87, zinc_mort_pneu: 0.85, // LiST (Yakoob 2011)
  va_rr_mortality: 0.88,         // Imdad 2022
  yll_per_child_death: 71,       // life expectancy 72.6 minus ~1.6 y mean age at death, undiscounted
  // folate / neural tube defects
  births: 342694, ntd_per_10k: 14, dalys_per_ntd: 55,
  women_maize_g: 344, folate_ug_g: 0.25, folate_retention: 0.9,
  dfe_to_fa: 0.6,                // 1 µg food folate (DFE) = 0.6 µg folic acid with food
  wald_ng_per_100ug_fa: 0.94     // serum folate rise per 0.1 mg/d folic acid; doubling serum halves NTD risk
});

const USD = 7.8; // GTQ per USD (replica)

// res: engine result; boosts: cleaned boosts; p: HEALTH params
export function healthOutcomes(res, boosts, p = HEALTH_DEFAULTS) {
  const n = res.national;
  const kids = n.n_children;
  const rows = [];
  // Anemia: iron-deficiency anemia falls with the share of iron-inadequate children made adequate
  const anemiaPrev = H.anemia_prev[p.anemia_baseline] / 100;
  const ironFix = n.iron_inad_pct_baseline > 0 ? n.iron_inad_change_pp / n.iron_inad_pct_baseline : 0;
  const anemia = kids * anemiaPrev * H.frac_anemia_iron * ironFix;
  rows.push({ id: 'anemia', nutrient: 'fe', outcome: 'Child anemia cases', value: anemia, dalys: anemia * H.dw_anemia, conf: 'moderate',
    how: `${(anemiaPrev * 100).toFixed(1)}% anemic × 26.9% due to iron deficiency × ${(ironFix * 100).toFixed(1)}% of iron-inadequate children made adequate` });
  // Diarrhea: zinc trial effect applied to the children moved above the zinc requirement, discounted for food
  const zincFix = n.zinc_inad_change_pp / 100;
  const diar = kids * H.diarrhea_inc * zincFix * (1 - H.zinc_rr_diarrhea) * p.zinc_food_discount;
  rows.push({ id: 'diarrhea', nutrient: 'zn', outcome: 'Diarrhea episodes', value: diar, dalys: diar * H.dalys_per_diarrhea, conf: 'low',
    how: `2.5 episodes/child-yr × ${(zincFix * 100).toFixed(1)}% of children moved above the zinc requirement × 9% (RR 0.91) × ${p.zinc_food_discount} food discount` });
  // Neural tube defects: women eat the department's biofortified share of maize
  const addDFE = H.women_maize_g * H.folate_ug_g * H.folate_retention * (boosts.fol || 0) / 100;
  const dS = addDFE * H.dfe_to_fa / 100 * H.wald_ng_per_100ug_fa;
  const riskCut = 1 - p.serum_folate0 / (p.serum_folate0 + dS); // risk ∝ 1 / serum folate (Wald 2001)
  const pop = res.departments.reduce((s, d) => s + (d.population || 0), 0);
  let exposedBirths = 0;
  for (const d of res.departments) if (pop > 0) exposedBirths += H.births * (d.population / pop) * (d.coverage_pct || 0) / 100;
  const ntd = exposedBirths * H.ntd_per_10k / 1e4 * riskCut;
  rows.push({ id: 'ntd', nutrient: 'fol', outcome: 'Neural tube defects', value: ntd, dalys: ntd * H.dalys_per_ntd, conf: 'moderate',
    how: `${Math.round(exposedBirths).toLocaleString('en-US')} births to mothers eating biofortified maize × 14/10,000 × ${(riskCut * 100).toFixed(1)}% lower risk (+${addDFE.toFixed(0)} µg DFE/d)` });
  // Low-confidence mortality and pneumonia (opt-in)
  const vaFix = n.va_inad_change_pp / 100;
  const deathsZinc = H.u5_deaths * (H.cod_diarrhea * (1 - H.zinc_mort_diar) + H.cod_pneumonia * (1 - H.zinc_mort_pneu)) * zincFix * p.zinc_food_discount;
  const deathsVA = H.u5_deaths * (1 - H.va_rr_mortality) * vaFix;
  const pneu = kids * H.pneu_inc * zincFix * (1 - H.zinc_rr_pneu) * p.zinc_food_discount;
  const spec = [
    { id: 'pneumonia', nutrient: 'zn', outcome: 'Pneumonia episodes', value: pneu, dalys: 0, conf: 'low', how: '0.22 episodes/child-yr × same zinc share × 13% (RR 0.87) × food discount; no DALYs counted' },
    { id: 'deaths_zn', nutrient: 'zn', outcome: 'Child deaths (zinc)', value: deathsZinc, dalys: deathsZinc * H.yll_per_child_death, conf: 'low', how: '7,745 under-5 deaths × (7% diarrhea × 13% + 12% pneumonia × 15%) × zinc share × food discount' },
    { id: 'deaths_va', nutrient: 'va', outcome: 'Child deaths (vitamin A)', value: deathsVA, dalys: deathsVA * H.yll_per_child_death, conf: 'low', how: `7,745 under-5 deaths × 12% (RR 0.88) × ${(vaFix * 100).toFixed(2)}% of children moved above the vitamin A requirement` }
  ];
  for (const r of spec) { r.speculative = true; r.included = !!p.mortality; rows.push(r); }
  const dalys = rows.filter(r => !r.speculative || r.included).reduce((s, r) => s + r.dalys, 0);
  const costUSD = (n.newseed_subsidy_total || 0) / USD;
  return { rows, dalys, costUSD, perDaly: dalys > 0 && costUSD > 0 ? costUSD / dalys : null };
}
