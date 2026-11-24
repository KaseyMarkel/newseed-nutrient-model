// Red-team of the global model (2026-11-23): three independent reviews (rollout & reach; health effects;
// accounting & code), each quantified with engine runs; claims fact-checked 2026-11-24. v1.5 (2026-11-24)
// models the structural gaps the review found (population growth, domestic food share, per-country baseline).
// `levers` are the central adjustments the page applies in one click ("Red-team central");
// `findings` are shown on the page.
import { ZINC_ANCHORS } from './global_nutrients.js';
const ZN_GBD2017 = ZINC_ANCHORS.find(a => a.id === 'gbd2017').dalys / 28e6; // zinc anchor ratio vs the sheet's WHO 2002 figure

export const REDTEAM = {
  levers: [
    { id: 'p_success', label: 'Probability the edits work: maize 0.5, rice 0.35, wheat 0.35',
      apply: P => { P.p_success = [0.5, 0.35, 0.35]; } },
    { id: 'qpm_ref', label: 'Stunting scaled by edit size (QPM ≈ +80% lysine)',
      apply: P => { P.qpm_ref = 0.8; } },
    { id: 'qpm_transfer', label: 'QPM evidence transfer: rice 0.4, wheat 0.8',
      apply: P => { P.qpm_transfer = [1, 0.4, 0.8]; } },
    { id: 'crop_lag', label: 'Seed lag after approval: maize 1 y, rice 3 y, wheat 3 y',
      apply: P => { P.crop_lag = [1, 3, 3]; } },
    { id: 'stunt_daly', label: 'DALYs per stunting case 1.5 (sheet 2.8)',
      apply: P => { P.stunt_daly = 1.5; } },
    { id: 'zn_anchor', label: 'Zinc burden: GBD 2017 (2.58M, not WHO 2002 ~28M)',
      apply: P => { P.zn_daly *= ZN_GBD2017; } },
    { id: 'zmult', label: 'Curt ceiling multiplier 1.5 (sheet 2, “awaiting Curt”)',
      apply: P => { P.zmult = 1.5; } },
    { id: 'horizon', label: 'Horizon to 2060 (benefits still rising in 2050; costs continue)',
      apply: P => { P.horizon = 2060; } },
    { id: 'fiber_gap', label: 'Fix sheet quirk Q2 (fiber adequacy)',
      apply: P => { P.fixes = { ...P.fixes, fiber_gap: true }; } },
    { id: 'pop_growth', label: 'v1.5: population grows by year (UN WPP 2024)',
      apply: P => { P.pop_growth = true; } },
    { id: 'domestic', label: 'v1.5: credit only domestically grown grain (FAOSTAT)',
      apply: P => { P.domestic = true; } },
    { id: 'base_country', label: 'v1.5: baseline biofortification by country (2% floor; PAK/IND wheat ~50%)',
      apply: P => { P.base_mode = 'country'; P.base_floor = 0.02; } }
  ],
  // [issue, direction, effect on Median (engine), control on this page]
  findings: [
    ['The headline assumes the research succeeds in all three crops. The note expects 2–20% of genes to work; the rice and wheat programs are unfunded; wheat is hexaploid.', 'worse', '×0.3–0.5 expected value', 'Probability of success; Monte Carlo'],
    ['Stunting (75% of DALYs) ignores the size of the protein edit and the 40% lab→field cut: it applies the full QPM growth effect (QPM ≈ doubles lysine and tryptophan, confirmed; the pilot edit gave +15–18%).', 'worse', '×0.5–0.64', 'Stunting scaled by edit size'],
    ['Maize QPM evidence (Gunaratna 2010, Food Policy: +9% height, +12% weight gain) applied to rice and wheat. Milled rice protein scores ~0.70 for lysine vs ~0.53 for maize and wheat; no growth trial of high-lysine rice. (In Ethiopia, a cluster RCT that raised QPM consumption among QPM growers found no growth effect: Donato 2020.)', 'worse', '×0.76 with the transfer factors', 'QPM transfer by crop'],
    ['Approval year used as the planting year: rice and wheat edited seed in India in 2032 though their research is only being requested now; India’s seed chain alone takes ≥3 seasons and adoption lags release 5–10 years.', 'worse', '+3 y for rice/wheat: ×0.69', 'Seed lag by crop'],
    ['2.8 DALYs per stunting case is high: disability-only estimates are ~0.1–0.25 per case; 2.8 is defensible only if it bundles stunting-attributable deaths (the model has no separate mortality pathway, so no double count).', 'worse', '1.0: ×0.52; 1.5: ×0.65', 'DALYs per stunting case'],
    ['Zinc burden anchored on WHO 2002 (~800k deaths, 1.9% of DALYs ≈ 28M). GBD 2017: 2.58M; GBD 2019: 0.26M, after dropping pneumonia and cutting the diarrhoea RR from 1.90 to 1.14. Both GBD rounds count children 1–4 only, whose zinc inadequacy is far below the all-ages rate used here.', 'worse', 'GBD 2017: ×0.89', 'Zinc burden anchor'],
    ['Benefits stop at 2050 while still rising (609k/yr credited in 2050).', 'better', 'to 2060: ×1.51 discounted; to 2070: ×1.8', 'Horizon'],
    ['Population held at 2030 (now modeled): sub-Saharan Africa grows 46% 2030→2050, but India’s under-5s shrink 14%, and stunting is most of the DALYs.', 'small', 'modeled: ×1.01 (to 2050)', 'Population grows by year'],
    ['Imported grain credited as if edited (now modeled): wheat in Indonesia, Philippines, Nigeria, Kenya, Guatemala is almost all imported; imports assumed to go to feed first.', 'worse', 'modeled: ×0.92', 'Domestic grain only'],
    ['Flat 15% “already biofortified” counterfactual (now modeled by country): coverage of these traits is above 2% in only ~7 of 225 country-crops, but ~50% for Pakistan and India wheat (zinc).', 'better', 'modeled: ×1.12', 'Baseline by country'],
    ['Advocacy is ~half of discounted cost but moves no approval year in the model; all late-tier countries one tier earlier adds only ~9%.', 'better ($/DALY)', 'without advocacy: $4.28/DALY', 'Advocacy in costs'],
    ['Curt’s max CG share is doubled (×2, “awaiting Curt”).', 'worse', 'zmult 1: ×0.87', 'Curt ceiling multiplier'],
    ['Zinc and iron dose-response looks conservative under an intake-distribution (probit) model with absorption saturation, esp. Bangladesh; phytate knockouts not credited.', 'better', 'zinc ×1.5–3 (at WHO weights); phytate +13%', 'Gap closed per unit boost; phytate cut'],
    ['India is 42% of DALYs: the 2022 SDN-1/2 exemption holds, and two edited rice varieties were announced in May 2025 (seed reaching farmers 2026–27), but a Supreme Court contempt petition (Rodrigues) seeks to overturn the exemption; rainfed rice varieties average ~28 years old (wheat ~13).', 'either', 'India→Mid tier: ×0.78', 'Approval year by tier'],
    ['Protein all-ages pathway (0.01 DALY/yr) is unsourced and overlaps under-5 stunting.', 'worse', '×0.93 if dropped', 'Protein DALYs per person-year'],
    ['Costs stop partner contracts in 2032 (stacking, rice/wheat, 20+ registrations continue); $1.2M for 2027–29 likely double-counted.', 'worse (small)', '$8.36 → ~$9.9', 'Program cost multiplier'],
    ['“People reached” sums calorie shares across crops: it is full-diet equivalents, not a headcount (707M vs the note’s 528M).', 'labeling', '—', '—'],
    ['The concept note (v1.0: 3.24M DALYs, $19/DALY, 40–66× GiveWell) doesn’t match the v1.4 sheet (7.0M, $8.36). Reconciled: switching the v1.4 Median back to the growth-rate stunting method gives 3.45M and $17.01, so the HAZ-shift method (v1.4) explains ~95% of the gap. The GiveWell rows use hard-coded constants.', 'either', 'rate method: ×0.49', 'Stunting method']
  ]
};
