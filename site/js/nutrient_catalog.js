// Exploratory nutrients (extension): more options, to prune later. Each entry drives one slider.
//
// Every nutrient gets a CENTRAL (unbiased) speculative estimate, not zero: we should be as surprised by
// it working better as by it working worse. Where Guatemalan data exist they set the baseline; otherwise a
// generic low-income prior, shrunk where Guatemala has a known protection (iodized salt, sun, lime).
// Trial point estimates are used even when not significant, and shrunk where there is a known upward bias.
//
//  group: 'gt' Guatemalan shortfall data · 'elsewhere' shortfall mainly elsewhere · 'nomaize' no known route
//  flag.kind: 'gt' data-based here · 'spec' speculative here (prior + evidence elsewhere) · 'route' no route into maize
//  model: { per_g: added per g dry grain at 100% (after retention), in the units of `ear`,
//           ear: [<48 mo, >=48 mo] (EAR, or AI where no EAR exists), p0: baseline share below it, sd_log }
//  daly:  { per_child: DALYs averted per child-year moved above `ear` (central), range: [low, high] multipliers
//           (low may be negative: the evidence allows harm), outcome, how }
// IQ → DALY: 0.002 DALY per IQ point per child-year (derived: a 1-point mean shift raises IQ<70 prevalence
// ~0.5 pp; GBD mild intellectual disability weight ~0.031 (unverified); ~65 years; effect built over ~5 years).
const L = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
export const IQ_DALY = 0.002;
export const U5 = { deaths_per_child_year: 7745 / 1.7e6, yll: 71, lri_share: 0.12 }; // UNICEF 2024; ~1.7M under-5s

export const CATALOG = [
  // ---- Guatemalan shortfall data ----
  { id: 'vc', label: 'Vitamin C', short: 'vit C', group: 'gt', color: '#e0a800', pctOfTarget: true,
    unit: '% of transgenic level (0.107 mg/g)', hint: 'White maize ~0–0.02 mg/g; transgenic “multivitamin corn” 6× (Naqvi 2009). Assumes 30% survives nixtamalization (unverified)',
    flag: { kind: 'gt', text: 'Guatemala: 11–30% of children 2–5 y below the EAR. Speculative effect: slightly better iron absorption (~1%) and shorter colds (−14% duration in children, Hemilä). Transgenic only.' },
    model: { per_g: 0.107 * 0.3, ear: [13, 22], p0: 0.2, sd_log: 0.6 },
    daly: { per_child: 0.0002, range: [0, 5], outcome: 'Vitamin C: colds, iron absorption', how: '0.0002 DALY each (cold duration −14%, iron absorption +1%)' },
    src: `${L('https://doi.org/10.1186/s12889-025-24111-2', 'Mayan children 2–5 y')}; ${L('https://doi.org/10.1073/pnas.0901412106', 'Naqvi 2009')}; ${L('https://doi.org/10.1093/ajcn/71.4.937', 'Reddy 2000')}; Hemilä, Cochrane 2013 (CD000980)` },
  { id: 'cho', label: 'Choline', short: 'choline', group: 'gt', color: '#8a6d3b',
    unit: '% more choline', hint: 'Masa 0.086 mg/g (USDA). No known breeding or transgenic route',
    flag: { kind: 'gt', text: 'Guatemala: 42–71% of children 2–5 y below the AI. Speculative: +0.1 IQ point; could be harmful or several times larger (Malawi cohort: no benefit). No known route into maize.' },
    model: { per_g: 0.086, ear: [200, 250], p0: 0.55, sd_log: 0.4 },
    daly: { per_child: 0.1 * IQ_DALY, range: [-1, 5], outcome: 'Choline: cognition', how: '+0.1 IQ point × 0.002 DALY per point' },
    src: `${L('https://doi.org/10.1186/s12889-025-24111-2', 'Mayan children 2–5 y')}; ${L('https://doi.org/10.1111/mcn.13471', 'Bragg 2023')}` },
  { id: 'n3', label: 'Omega-3 (ALA)', short: 'omega-3', group: 'gt', color: '#3b8a8a',
    unit: '% more ALA', hint: 'Maize 0.65 mg ALA/g, no DHA. High-oil breeding adds mostly linoleic acid; SDA corn exists only in a patent',
    flag: { kind: 'gt', text: 'Guatemala: ~90% of children below the ALA AI. Speculative: child omega-3 trials show ~0.05 SD on cognition (not significant), and little ALA becomes DHA: ~+0.15 IQ point.' },
    model: { per_g: 0.00065, ear: [0.7, 0.9], p0: 0.91, sd_log: 0.5 },
    daly: { per_child: 0.15 * IQ_DALY, range: [-0.5, 5], outcome: 'Omega-3: cognition', how: '+0.15 IQ point (0.05 SD × ~20% ALA→DHA credit) × 0.002 DALY per point' },
    src: `${L('https://doi.org/10.1186/s12889-025-24111-2', 'Mayan children 2–5 y')}; ${L('https://doi.org/10.1002/14651858.CD003402.pub3', 'Middleton 2018')}` },
  { id: 've', label: 'Vitamin E', short: 'vit E', group: 'gt', color: '#9c7a2b',
    unit: '% more vitamin E', hint: 'Maize 4.2 µg/g. Transgenic route: barley HGGT raised tocochromanols up to 6× (Cahoon 2003)',
    flag: { kind: 'spec', text: 'Guatemala: likely low in infants’ foods, no prevalence figure (prior 30%). No outcome trials in children; small speculative immune effect.' },
    model: { per_g: 0.0042, ear: [5, 6], p0: 0.3, sd_log: 0.5 },
    daly: { per_child: 0.0001, range: [0, 5], outcome: 'Vitamin E: infections', how: '0.0001 DALY each (no trial evidence; small prior)' },
    src: `${L('https://apjcn.qdu.edu.cn/27_5_10.pdf', 'Vossenaar 2018')}; ${L('https://doi.org/10.1038/nbt853', 'Cahoon 2003')}` },

  // ---- Shortfall mainly elsewhere ----
  { id: 'io', label: 'Iodine', short: 'iodine', group: 'elsewhere', color: '#6a5acd', pctOfTarget: true,
    unit: '% of a 10× fertilizer level (0.1 µg/g)', hint: 'Maize ~0.01 µg/g (unverified). Route: foliar iodine fertilizer, 5–10× in wheat (maize fold-change unverified)',
    flag: { kind: 'spec', text: 'Guatemala: iodized salt keeps most children adequate (prior 10% short). Where deficient (Ethiopia ~48%): +3 IQ points from correcting it in childhood (Zimmermann 2006 Albania ~0.19 SD, unverified; up to +12 in severe deficiency).' },
    model: { per_g: 0.1, ear: [65, 65], p0: 0.1, sd_log: 0.5 },
    daly: { per_child: 3 * IQ_DALY, range: [0.2, 3], outcome: 'Iodine: cognition', how: '+3 IQ points × 0.002 DALY per point' },
    src: `${L('https://doi.org/10.1017/s0007114525105205', 'Sivalogan 2025')}; ${L('https://doi.org/10.1007/s11104-017-3295-9', 'Cakmak 2017')}; Qian 2005 (PMID 15734706); Zimmermann 2006 (AJCN 83:108)` },
  { id: 'se', label: 'Selenium', short: 'selenium', group: 'elsewhere', color: '#7d8c3a', pctOfTarget: true,
    unit: '% of a fertilized level (+0.15 µg/g)', hint: 'Maize 0.02–0.15 µg/g, set by soil. Route: selenate fertilizer (Malawi trial: 0.06 → 0.16 µg/g)',
    flag: { kind: 'spec', text: 'No Guatemala data (prior 20% short). Malawi: 62.5% of women low; Se-fortified flour doubled children’s serum Se. Clinical benefit proven only for Keshan disease; small speculative immune effect.' },
    model: { per_g: 0.15, ear: [17, 23], p0: 0.2, sd_log: 0.5 },
    daly: { per_child: 0.0005, range: [0, 5], outcome: 'Selenium: infections', how: '0.0005 DALY each (immune function; no child outcome trial)' },
    src: `${L('https://pmc.ncbi.nlm.nih.gov/articles/PMC6484074', 'Phiri 2019')}; ${L('https://pubmed.ncbi.nlm.nih.gov/24908353/', 'Alfthan 2015')}` },
  { id: 'nia', label: 'Niacin', short: 'niacin', group: 'elsewhere', color: '#b35c1e',
    unit: '% more niacin', hint: 'Masa 0.016 mg/g; free niacin varies 9–22× across inbred lines. QPM tryptophan also adds niacin',
    flag: { kind: 'spec', text: 'Guatemala: lime frees niacin (prior 2% short). Malawi, where maize is not nixtamalized: pellagra in 63/1,000 refugees (1990), ~23/1,000 at Kasese (2015–16).' },
    model: { per_g: 0.016, ear: [5, 6], p0: 0.02, sd_log: 0.5 },
    daly: { per_child: 0.0005, range: [0.2, 5], outcome: 'Niacin: pellagra', how: '~1% pellagra risk per short child-year × weight ~0.05 (unverified)' },
    src: `${L('https://www.cdc.gov/mmwr/preview/mmwrhtml/00001945.htm', 'MMWR 1991')}; ${L('https://pmc.ncbi.nlm.nih.gov/articles/PMC5417224/', 'Kasese 2017')}` },
  { id: 'ca', label: 'Calcium', short: 'calcium', group: 'nomaize', color: '#8f8f8f', pctOfTarget: true,
    unit: '% of a hypothetical +1.4 mg/g', hint: 'Grain 0.03–0.07 mg/g; no breeding, transgenic or fertilizer route. 100% would double tortilla calcium',
    flag: { kind: 'route', text: 'No known route into the grain. Guatemala: lime helps, but over half of Mayan 4–5-year-olds fall short (prior 40%). Nigeria: calcium healed rickets in 61% vs 19%.' },
    model: { per_g: 1.4, ear: [500, 800], p0: 0.4, sd_log: 0.4 },
    daly: { per_child: 0.001, range: [0.1, 5], outcome: 'Calcium: rickets, bone', how: '~2% rickets risk per short child-year × weight ~0.05 (unverified)' },
    src: `${L('https://pmc.ncbi.nlm.nih.gov/articles/PMC4235459/', 'Joy 2014')}; Thacher 1999 NEJM (PMID 10451461); ${L('https://doi.org/10.1186/s12889-025-24111-2', 'Mayan children 2–5 y')}` },
  { id: 'rib', label: 'Riboflavin', short: 'riboflavin', group: 'elsewhere', color: '#c9b02e',
    unit: '% more riboflavin', hint: 'Maize 0.8 µg/g; varies 22–28× across inbred lines (breeding possible)',
    flag: { kind: 'spec', text: 'Guatemala: short only in worst-case diets (prior 20%). Côte d’Ivoire: 65% of schoolchildren deficient. Speculative: helps iron use, small anemia effect.' },
    model: { per_g: 0.0008, ear: [0.4, 0.5], p0: 0.2, sd_log: 0.5 },
    daly: { per_child: 0.0003, range: [0, 5], outcome: 'Riboflavin: anemia', how: '0.0003 DALY each (iron mobilization)' },
    src: `${L('https://doi.org/10.1017/S0007114507665180', 'Rohner 2007')}` },
  { id: 'b6', label: 'Vitamin B6', short: 'B6', group: 'elsewhere', color: '#a07cc5',
    unit: '% more vitamin B6', hint: 'Maize 3.7 µg/g; varies 6–7× across inbred lines',
    flag: { kind: 'spec', text: 'Guatemala: short only in worst-case diets (prior 10%). No prevalence or outcome evidence anywhere; small prior.' },
    model: { per_g: 0.0037, ear: [0.4, 0.5], p0: 0.1, sd_log: 0.5 },
    daly: { per_child: 0.0001, range: [0, 5], outcome: 'Vitamin B6: general', how: '0.0001 DALY each (no evidence; small prior)' },
    src: `${L('https://pmc.ncbi.nlm.nih.gov/articles/PMC9634661/', 'Frontiers Nutr 2022')}` },
  { id: 'thi', label: 'Thiamin', short: 'thiamin', group: 'elsewhere', color: '#5f7fa8',
    unit: '% more thiamin', hint: 'Maize ~3.9 µg/g; 1.1–26.5 µg/g across inbred lines (breeding possible)',
    flag: { kind: 'spec', text: 'No Guatemala data (prior 10% short). Laos/Cambodia: sick infants who are deficient die 6.4% vs 0.7%. Speculative: ~2% lower death risk in short children 6–59 mo.' },
    model: { per_g: 0.0039, ear: [0.4, 0.5], p0: 0.1, sd_log: 0.5 },
    daly: { per_child: 0.02 * U5.deaths_per_child_year * U5.yll, range: [0.1, 5], outcome: 'Thiamin: child deaths', how: '2% of 0.0046 deaths per child-year × 71 years' },
    src: `${L('https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3050987/', 'Laos infants')}; ${L('https://pmc.ncbi.nlm.nih.gov/articles/PMC8246599', 'Cambodia')}` },
  { id: 'mg', label: 'Magnesium', short: 'magnesium', group: 'elsewhere', color: '#b0a089',
    unit: '% more magnesium', hint: 'Maize 0.85 mg/g',
    flag: { kind: 'spec', text: 'Little shortfall anywhere (Africa <4%; prior 3% here). Near-zero speculative effect.' },
    model: { per_g: 0.85, ear: [65, 110], p0: 0.03, sd_log: 0.4 },
    daly: { per_child: 0.00005, range: [0, 5], outcome: 'Magnesium: general', how: '0.00005 DALY each (small prior)' },
    src: `${L('https://www.gov.uk/research-for-development-outputs/risk-of-dietary-magnesium-deficiency-is-low-in-most-african-countries-based-on-food-supply-data', 'Joy 2013')}` },
  { id: 'lp', label: 'Low phytate (absorption)', short: 'low phytate', group: 'elsewhere', color: '#6d8f6d', pctOfTarget: true, lever: true,
    unit: '% of lpa1 phytate cut (−60%)', hint: 'Not a nutrient: lowers phytate so zinc and iron absorb better. lpa1 mutants −60%, Nutridense LP −80%',
    flag: { kind: 'spec', text: 'Modeled as better zinc (+25%) and iron (+15%) absorption from maize, feeding stunting, anemia and diarrhea. Adults gained far more (zinc 0.28 vs 0.15, iron +49%) but a Guatemalan child trial found nothing, so shrunk.' },
    model: null, daly: null, absorption: { zn: 0.25, fe: 0.15 },
    src: `${L('https://doi.org/10.1093/ajcn/83.1.59', 'Guatemala trial 2006')}; Hambidge 2004 (PMID 15159236); ${L('https://doi.org/10.1093/ajcn/68.5.1123', 'Mendoza 1998')}` },

  // ---- No known route into maize (hypothetical) ----
  { id: 'b12', label: 'Vitamin B12', short: 'B12', group: 'nomaize', color: '#c0392b', pctOfTarget: true,
    unit: '% of a hypothetical 0.01 µg/g', hint: 'Plants make no B12. 100% would give ~1.5 µg/d from 150 g of maize, about 2× the EAR',
    flag: { kind: 'route', text: 'No known way into maize. If possible: ~19% of Guatemalan children are low. Cochrane 2026 point estimate +0.09 SD cognition (CI −0.10 to 0.28); anemia point estimate slightly worse.' },
    model: { per_g: 0.01, ear: [0.7, 1.0], p0: 0.19, sd_log: 0.6 },
    daly: { per_child: 1.25 * IQ_DALY, range: [-1, 4], outcome: 'B12: cognition', how: '+1.35 IQ points (0.09 SD) minus a small anemia penalty × 0.002 DALY per point' },
    src: `${L('https://doi.org/10.1016/j.cdnut.2023.101970', 'SIVESNU')}; ${L('https://doi.org/10.1002/14651858.cd015264.pub2', 'Cochrane 2026')}` },
  { id: 'vd', label: 'Vitamin D', short: 'vit D', group: 'nomaize', color: '#f0c419', pctOfTarget: true,
    unit: '% of a hypothetical 0.05 µg/g', hint: 'Maize has none; only a gene-edited tomato makes provitamin D3',
    flag: { kind: 'route', text: 'No known route into maize. Guatemala: sun keeps most children replete (prior 5% short). Deficient children: respiratory infections OR 0.30 (Martineau 2017), shrunk to −50% pneumonia deaths.' },
    model: { per_g: 0.05, ear: [10, 10], p0: 0.05, sd_log: 0.5 },
    daly: { per_child: 0.5 * U5.lri_share * U5.deaths_per_child_year * U5.yll, range: [0.1, 2], outcome: 'Vitamin D: pneumonia deaths', how: '50% of pneumonia deaths (12% of 0.0046 per child-year) × 71 years' },
    src: `${L('https://doi.org/10.1017/S1368980017001616', 'Robinson 2017')}; ${L('https://doi.org/10.1136/bmj.i6583', 'Martineau 2017')}` }
];
