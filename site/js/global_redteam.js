// Red-team of the global model (2026-11-23): three independent reviews (rollout & reach; health effects;
// accounting & code), each quantified with engine runs; claims fact-checked 2026-11-24. v1.5 (2026-11-24)
// models the structural gaps the review found (population growth, domestic food share, per-country baseline).
// `levers` are the central adjustments the page applies in one click ("Red-team central");
// `findings` are shown on the page.
import { ZINC_ANCHORS } from './global_nutrients.js';
const ZN_GBD2017 = ZINC_ANCHORS.find(a => a.id === 'gbd2017').dalys / 28e6; // zinc anchor ratio vs the sheet's WHO 2002 figure

// GiveWell translation (round 2). Units of value (UoV): doubling one person's consumption for a year = 1.
// GiveWell moral weights (page updated Jul 2025): death at age 1–4 = 127 UoV; a year lived with disability = 2.3 UoV.
export const GIVEWELL = {
  uov: { zn: 1.5, fe: 2.3, prot: 2.0, stunt: 1.5, fiber: 1.8, extra: 2.0 },
  uov_note: 'Per DALY, by pathway: child deaths 127 UoV ÷ ~85 GBD years of life lost ≈ 1.5 (zinc, stunting); disability 2.3 per YLD (iron/anaemia); adult heart disease ≈ 1.8; protein and extras 2.0 (judgment). Weighted by this setting’s pathway mix.',
  gd_uov_per_dollar: 0.00333,
  gd_note: 'GiveWell’s legacy cash benchmark (≈ $300 per doubling of one person’s consumption for a year). Since Nov 2025 the benchmark is defined differently; GiveWell says it is similar in value.',
  bar_x: 6,
  bar_note: 'GiveWell: “As of May 2026, our bar for funding programs is 6x our benchmark” (8× in Nov 2025, 10× in 2024).',
  caveat: 'Health only. GiveWell also credits income effects of better child nutrition and less anaemia, which this model omits (upside). Closest comparator: GiveWell’s June 2025 grant to Semilla Nueva carried a rough 3–8× estimate.'
};
// GBD burden for the sanity check (global; the 75 modeled countries hold most of it)
export const GBD_CHECK = {
  st: { v: 33.0e6, src: 'Stunting ≈ 33M DALYs (GBD 2023 analysis); all child growth failure ≈ 75M (2.6% of DALYs, GBD 2021 risk factors, Lancet 2024)' },
  zn: { v: 0.26e6, src: 'Zinc deficiency 0.26M DALYs, ages 1–4 (GBD 2019; Hess et al. 2021)' },
  fe: { v: 33e6, src: 'Dietary iron deficiency ≈ 33M DALYs (GBD 2021: 423.7 per 100k, age-standardized; mostly anaemia YLD)' },
  prot: { v: null, src: 'GBD has no protein-quality risk factor' },
  fib: { v: null, src: 'Not checked' },
  note: 'Stunting at 1.5 DALYs per case (red-team) puts ~38M DALYs a year at stake vs GBD ~33M: consistent. At the sheet’s 2.8 it is ~72M, about twice GBD. Iron matches GBD. Zinc stays ~10× GBD 2019 even on the GBD 2017 anchor. The sheet’s protein pathway puts 14M DALYs a year at stake with no GBD counterpart. GBD figures are rounded; pull exact 75-country counts from the GBD Results Tool before publishing.'
};

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
      apply: P => { P.base_mode = 'country'; P.base_floor = 0.02; } },
    // ---- round 2 (2026-11-25): GiveWell-style review ----
    { id: 'growth_rep', round: 2, label: 'v1.6: replicability 35% on the QPM growth effect',
      apply: P => { P.growth_rep = 0.35; } },
    { id: 'prot', round: 2, label: 'v1.6: protein pathway over-5s only, 0.001 DALY/person-year (sheet 0.01, unsourced)',
      apply: P => { P.prot_over5 = true; P.prot_daly = 0.001; } },
    { id: 'trait_pen', round: 2, label: 'v1.6: trait penetration maize 60%, rice 70%, wheat 70%',
      apply: P => { P.trait_pen = [0.6, 0.7, 0.7]; } },
    { id: 'fib_causal', round: 2, label: 'v1.6: fiber causal adjustment 50% (cohort RR)',
      apply: P => { P.fib_causal = 0.5; } },
    { id: 'base_growth', round: 2, label: 'v1.6: conventional biofortification spreads (zinc +2%/yr, iron +1%, QPM +0.5%; ceiling 60%)',
      apply: P => { P.base_growth = [0.02, 0.01, 0.005]; P.base_cap = 0.6; } },
    { id: 'speedup', round: 2, label: 'v1.6: speed-up counterfactual (50% chance others deliver 6 y later) × 50% credit, replacing the flat 30%',
      apply: P => { P.cf_prob = 0.5; P.cf_delay = 6; P.att = 0.5; } },
    { id: 'cost_gate', round: 2, label: 'v1.6: go/no-go in 2031: later costs only if some crop works',
      apply: P => { P.cost_gate = 2031; } }
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
    ['The concept note (v1.0: 3.24M DALYs, $19/DALY, 40–66× GiveWell) doesn’t match the v1.4 sheet (7.0M, $8.36). Reconciled: switching the v1.4 Median back to the growth-rate stunting method gives 3.45M and $17.01, so the HAZ-shift method (v1.4) explains ~95% of the gap. The GiveWell rows use hard-coded constants.', 'either', 'rate method: ×0.49', 'Stunting method'],
    // ---- round 2 (2026-11-25, GiveWell-style). Effects are on the round-1 central, each alone. ----
    ['R2. The QPM growth effect rests on Gunaratna 2010: 9 small studies (48–486 children), only 2 peer-reviewed, 4 from one author, outcome a growth-rate ratio. The only modern trial (Donato 2020) found no growth effect, but it tested a consumption package among QPM growers, not QPM vs conventional maize. At the sheet Median the implied HAZ gain with all three crops edited is +0.08 to +0.22 (India 0.15, Bangladesh 0.22), above SQ-LNS, the best-evidenced food supplement (+0.14 LAZ; Dewey 2021, 14 RCTs). A GiveWell-style replicability adjustment of 35% leaves ≈ +0.03–0.05 at full QPM dose in a maize-dominant diet.', 'worse', '×0.78', 'Replicability of the QPM growth effect'],
    ['R2. The protein pathway is the sheet’s second-largest after the round-1 fixes (30%) and rests on an unsourced 0.01 DALY per person-year × stunting prevalence. GBD has no protein-quality risk factor, so this puts 14M DALYs a year at stake with no counterpart. The sheet labels it “age > 5” but multiplies by the whole population, so under-5s are counted again on top of stunting.', 'worse', 'over-5 only: ×0.98; and 0.001: ×0.73', 'Protein pathway switch; Protein DALYs per person-year'],
    ['R2. Every CG-derived variety released after approval is assumed to carry every edit. Opaque2-type lysine traits bring soft endosperm, ear rot and lower yield (modifier genes or zein edits are needed); strong low-phytate alleles hurt germination and yield; high-zinc wheat shows no penalty. Penetration is a central 60% maize, 70% rice and wheat.', 'worse', '×0.68', 'Trait penetration'],
    ['R2. The counterfactual is static, but conventional biofortification is spreading: CGIAR aims for every new variety to meet minimum nutrient standards within a decade (Nov 2025); India releases no rice below 20 ppm zinc; most CIMMYT elite wheat lines already carry extra zinc; Akbar-19 (zinc) is on ~50% of Pakistan’s wheat. Modeled as coverage rising +2%/yr for zinc, +1% iron, +0.5% QPM, to a 60% ceiling.', 'worse', '×0.89', 'Conventional biofortification added per year'],
    ['R2. The flat 30% credit is asserted. Made explicit: others deliver the same edits anyway with probability 50%, 6 years later (IRRI OsNAS2 promoter edit; LKR knockout doubles rice lysine; zein edits raise maize lysine without opaque2; CGIAR plans low-phytate and provitamin A edits; no one else is found mainstreaming nutrient edits into CG pipelines), and New Seed gets 50% of what remains, as one of the necessary contributors with CGIAR breeders and national programs. Equivalent to a flat ~36%.', 'better', '×1.20', 'Speed-up; Credit to New Seed'],
    ['R2. Costs run to 2060 even when every edit fails, though the program would stop. With a 2031 go/no-go, later costs are paid only if some crop works (P ≈ 0.79 under independence; the Monte Carlo uses correlated draws).', 'better ($/DALY)', 'cost ×0.85', 'Go/no-go year'],
    ['R2. Fiber → heart disease uses a cohort RR (Threapleton 2013), not trial evidence, and benefits accrue over decades. 50% causal adjustment.', 'worse', '×0.92', 'Fiber causal adjustment'],
    ['R2. Burden check: at 2.8 DALYs per stunting case the model puts ~72M DALYs a year at stake from stunting in 75 countries, about twice GBD’s ~33M; 1.5 per case (round 1) gives ~38M, consistent. Iron (36M vs ~33M) is consistent. Zinc stays ~10× GBD 2019 on the GBD 2017 anchor (the pathway is ~7% of the total, so it matters little).', 'checked', '—', 'Burden sanity check card'],
    ['R2. Exposure check: stunting is set in the first 1,000 days, when breast milk supplies much of the energy, so a child’s staple share is below the all-ages share used here. But the trial effect is applied at a 100% staple share, while trial children ate maize-dominant diets (~50–70%). The two roughly offset; no change.', 'checked', '—', '—'],
    ['R2. Not modeled (upside): income gains from better child growth and less anaemia, which GiveWell counts for nutrition programs; benefits after 2060.', 'better', 'not quantified', '—'],
    ['R2. GiveWell comparison: the concept note’s “40–66× GiveWell” uses hard-coded constants. Translated with GiveWell’s moral weights (death at 1–4 = 127 units of value; 2.3 per year lived with disability) against its benchmark (~0.0033 units per $), the round-2 central is ~2–2.5× the benchmark in expectation and ~5.5× if the edits work, vs a funding bar of 6× (May 2026). GiveWell’s own rough estimate for Semilla Nueva’s maize work was 3–8×.', 'either', '—', 'Against GiveWell’s bar card']
  ]
};
