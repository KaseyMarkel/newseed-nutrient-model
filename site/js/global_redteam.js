// Red-team of the global model (2026-11-23): three independent reviews (rollout & reach; health effects;
// accounting & code), each quantified with engine runs. `levers` are the central adjustments the page can
// apply in one click ("Red-team central"); `findings` are shown on the page, including ones not yet modeled.
const ZN_GBD2017 = 2.6e6 / 28e6; // zinc anchor ratio vs the sheet's WHO 2002 figure

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
    { id: 'zn_anchor', label: 'Zinc burden: GBD 2017 (2.6M, not WHO 2002 28M)',
      apply: P => { P.zn_daly *= ZN_GBD2017; } },
    { id: 'zmult', label: 'Curt ceiling multiplier 1.5 (sheet 2, “awaiting Curt”)',
      apply: P => { P.zmult = 1.5; } },
    { id: 'horizon', label: 'Horizon to 2060 (benefits still rising in 2050; costs continue)',
      apply: P => { P.horizon = 2060; } },
    { id: 'fiber_gap', label: 'Fix sheet quirk Q2 (fiber adequacy)',
      apply: P => { P.fixes = { ...P.fixes, fiber_gap: true }; } }
  ],
  // [issue, direction, effect on Median (engine), control on this page]
  findings: [
    ['The headline assumes the research succeeds in all three crops. The note expects 2–20% of genes to work; the rice and wheat programs are unfunded; wheat is hexaploid.', 'worse', '×0.3–0.5 expected value', 'Probability of success'],
    ['Stunting (75% of DALYs) ignores the size of the protein edit and the 40% lab→field cut: it applies the full QPM growth effect (QPM ≈ doubles lysine; the pilot edit gave +15–18%).', 'worse', '×0.5–0.64', 'Stunting scaled by edit size'],
    ['Maize QPM evidence (Gunaratna 2010) applied to rice and wheat. Rice protein is far less lysine-limited; no growth trial of high-lysine rice; the Ethiopian QPM cluster RCT was null.', 'worse', '×0.65 with the transfer factors', 'QPM transfer by crop'],
    ['Approval year used as the planting year: rice and wheat edited seed in India in 2032 though their research is only being requested now; seed multiplication takes years.', 'worse', '+3 y for rice/wheat: ×0.71', 'Seed lag by crop'],
    ['2.8 DALYs per stunting case is above the literature standard (the note says so); the HAZ-shift method (v1.4) roughly doubled DALYs vs the note’s 3.24M.', 'worse', '1.0: ×0.52; 1.5: ×0.69', 'DALYs per stunting case; stunting method'],
    ['Zinc burden anchored on WHO 2002 (28M DALYs); GBD 2017 2.6M, GBD 2019 0.26M; and the burden is in under-5s, whose zinc inadequacy is much lower than all-ages.', 'worse', '×0.88', 'Zinc burden anchor'],
    ['Benefits stop at 2050 while still rising (609k/yr credited in 2050).', 'better', 'to 2060: +50% discounted; to 2070: +80%', 'Horizon'],
    ['Advocacy is ~half of discounted cost but moves no approval year in the model; all late-tier countries one tier earlier adds only ~9%.', 'better ($/DALY)', 'without advocacy: $4.28/DALY', 'Advocacy in costs'],
    ['Curt’s max CG share is doubled (×2, “awaiting Curt”).', 'worse', 'zmult 1: ×0.87', 'Curt ceiling multiplier'],
    ['Zinc and iron dose-response looks conservative under an intake-distribution (probit) model with absorption saturation, esp. Bangladesh; phytate knockouts not credited.', 'better', 'zinc ×1.5–3 (at WHO weights); phytate +13%', 'Gap closed per unit boost; phytate cut'],
    ['Population held at 2030: SSA grows 40–50% by 2050, India’s under-5s shrink.', 'better', '+5–15% (not yet modeled)', '—'],
    ['Wheat credited in import-dependent countries (Indonesia, Philippines, Nigeria, Bangladesh, Kenya…) where local adoption doesn’t change what people eat.', 'worse', '×0.95', '— (domestic-production share not yet modeled)'],
    ['India is 42% of DALYs: solid rules (2022 SDN-1/2 exemption) but old rice varieties (~28 y) and a pending legal challenge; upside via the public grain ration and editing existing popular varieties.', 'either', 'India→Mid tier: ×0.78', 'Approval year by tier'],
    ['Protein all-ages pathway (0.01 DALY/yr) is unsourced and overlaps under-5 stunting.', 'worse', '×0.93 if dropped', 'Protein DALYs per person-year'],
    ['Costs stop partner contracts in 2032 (stacking, rice/wheat, 20+ registrations continue); $1.2M for 2027–29 likely double-counted.', 'worse (small)', '$8.36 → ~$9.9', 'Program cost multiplier'],
    ['“People reached” sums calorie shares across crops: it is full-diet equivalents, not a headcount (707M vs the note’s 528M).', 'labeling', '—', '—'],
    ['The concept note (v1.0: 3.24M DALYs, $19/DALY, 40–66× GiveWell) doesn’t match the v1.4 sheet (7.0M, $8.36); the GiveWell rows use hard-coded constants.', 'either', '—', '—']
  ],
  monteCarlo: [
    ['The sheet’s own ranges', '1.6 / 3.3 / 6.4M', '$4 / $9 / $17'],
    ['+ stunting dose scaling + crop lags, with P(success)', '0.3 / 1.0 / 2.9M', '$10 / $27 / $82 (expected value $49)'],
    ['Full red-team (incl. 1.5 DALY/stunting case, zinc anchor, costs ×1–2), with P(success)', '0 / 0.2 / 1.2M', 'expected value ~$105']
  ]
};
