// Exploratory nutrients (extension): more options, to prune later. Each entry drives one slider.
//  group: 'gt'        Guatemala has a shortfall; the engine models inadequacy (no DALY unless an outcome is supported)
//         'elsewhere' little or no shortfall (or no data) in Guatemala; the flag gives the effect where it is common
//         'nomaize'   no known way to raise it in maize; the slider is hypothetical
//  flag.kind: 'gt' modeled here · 'none' no projected effect here · 'route' no known route into maize
//  model: null, or { per_g: amount added per g dry grain at 100% (after retention), in the units of `ear`,
//                    ear: [<48 mo, >=48 mo] (EAR, or AI where no EAR exists), p0: Guatemala share below it, sd_log }
//  daly:  null, or { per_child, outcome, conf, how } (none supported yet; see the flags)
// Sources: literature review 2026-11-23 (see `src`); "unverified" marks numbers not checked at the primary source.
const L = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

export const CATALOG = [
  // ---- Guatemala shortfall, modeled (inadequacy only) ----
  { id: 'vc', label: 'Vitamin C', short: 'vit C', group: 'gt', color: '#e0a800', pctOfTarget: true,
    unit: '% of transgenic level (0.107 mg/g)', hint: 'White maize ~0–0.02 mg/g; transgenic “multivitamin corn” 6× (Naqvi 2009). Assumes 30% survives nixtamalization (unverified)',
    flag: { kind: 'gt', text: 'Guatemala: 11–30% of children 2–5 y below the EAR; modeled. Its iron-absorption boost is tiny here (~1%: ×exp(0.0065·mg per meal), Reddy 2000). Transgenic only.' },
    model: { per_g: 0.107 * 0.3, ear: [13, 22], p0: 0.2, sd_log: 0.6 }, daly: null,
    src: `${L('https://doi.org/10.1186/s12889-025-24111-2', 'Mayan children 2–5 y')}; ${L('https://doi.org/10.1073/pnas.0901412106', 'Naqvi 2009')}; ${L('https://doi.org/10.1093/ajcn/71.4.937', 'Reddy 2000')}` },
  { id: 'cho', label: 'Choline', short: 'choline', group: 'gt', color: '#8a6d3b',
    unit: '% more choline', hint: 'Masa 0.086 mg/g (USDA). No known breeding or transgenic route',
    flag: { kind: 'gt', text: 'Guatemala: 42–71% of children 2–5 y below the AI (below an AI ≠ inadequate); modeled. No evidence correcting it helps children (Malawi: null). No known route into maize.' },
    model: { per_g: 0.086, ear: [200, 250], p0: 0.55, sd_log: 0.4 }, daly: null,
    src: `${L('https://doi.org/10.1186/s12889-025-24111-2', 'Mayan children 2–5 y')}; ${L('https://doi.org/10.1111/mcn.13471', 'Bragg 2023')}` },
  { id: 'n3', label: 'Omega-3 (ALA)', short: 'omega-3', group: 'gt', color: '#3b8a8a',
    unit: '% more ALA', hint: 'Maize 0.65 mg ALA/g, no DHA. High-oil breeding adds mostly linoleic acid; SDA corn exists only in a patent',
    flag: { kind: 'gt', text: 'Guatemala: ~90% of children below the ALA AI; modeled, but no child outcome evidence. If DHA could be put in maize: preterm birth RR 0.89 in pregnant women (Cochrane 2018).' },
    model: { per_g: 0.00065, ear: [0.7, 0.9], p0: 0.91, sd_log: 0.5 }, daly: null,
    src: `${L('https://doi.org/10.1186/s12889-025-24111-2', 'Mayan children 2–5 y')}; ${L('https://doi.org/10.1002/14651858.CD003402.pub3', 'Middleton 2018')}` },
  { id: 've', label: 'Vitamin E', short: 'vit E', group: 'gt', color: '#9c7a2b',
    unit: '% more vitamin E', hint: 'Maize 4.2 µg/g. Transgenic route: barley HGGT raised tocochromanols up to 6× (Cahoon 2003)',
    flag: { kind: 'none', text: 'Guatemala: likely low in infants’ complementary foods, but no prevalence figure and no outcome trial in children; not modeled.' },
    model: null, daly: null,
    src: `${L('https://apjcn.qdu.edu.cn/27_5_10.pdf', 'Vossenaar 2018')}; ${L('https://doi.org/10.1038/nbt853', 'Cahoon 2003')}` },

  // ---- Shortfall elsewhere, little or none in Guatemala ----
  { id: 'io', label: 'Iodine', short: 'iodine', group: 'elsewhere', color: '#6a5acd',
    unit: '% more iodine', hint: 'Maize ~0.01 µg/g (unverified). Route: foliar iodine fertilizer, 5–10× in wheat (maize fold-change unverified)',
    flag: { kind: 'none', text: 'No projected effect in Guatemala (iodized salt; women’s median urinary iodine 149 µg/L). Ethiopia (~48% low, unverified): +4.8 to 12.5 IQ points (Qian 2005).' },
    model: null, daly: null,
    src: `${L('https://doi.org/10.1017/s0007114525105205', 'Sivalogan 2025')}; ${L('https://doi.org/10.1007/s11104-017-3295-9', 'Cakmak 2017')}; Qian 2005 (PMID 15734706)` },
  { id: 'se', label: 'Selenium', short: 'selenium', group: 'elsewhere', color: '#7d8c3a',
    unit: '% more selenium', hint: 'Maize 0.02–0.15 µg/g, set by soil. Route: selenate fertilizer (Finland raised cereals ~15×)',
    flag: { kind: 'none', text: 'No Guatemala data. Malawi: 62.5% of women below the GPx3 cutoff; Se-fortified flour doubled children’s serum Se. Clinical benefit shown only for Keshan disease (China).' },
    model: null, daly: null,
    src: `${L('https://pmc.ncbi.nlm.nih.gov/articles/PMC6484074', 'Phiri 2019')}; ${L('https://pubmed.ncbi.nlm.nih.gov/24908353/', 'Alfthan 2015')}` },
  { id: 'nia', label: 'Niacin', short: 'niacin', group: 'elsewhere', color: '#b35c1e',
    unit: '% more niacin', hint: 'Masa 0.016 mg/g; free niacin varies 9–22× across inbred lines. QPM tryptophan also adds niacin',
    flag: { kind: 'none', text: 'No projected effect in Guatemala (lime frees niacin). Malawi (maize not nixtamalized): pellagra in 63/1,000 refugees (1990) and ~23/1,000 at Kasese (2015–16).' },
    model: null, daly: null,
    src: `${L('https://www.cdc.gov/mmwr/preview/mmwrhtml/00001945.htm', 'MMWR 1991')}; ${L('https://pmc.ncbi.nlm.nih.gov/articles/PMC5417224/', 'Kasese 2017')}` },
  { id: 'ca', label: 'Calcium', short: 'calcium', group: 'elsewhere', color: '#8f8f8f',
    unit: '% more calcium', hint: 'Grain 0.03–0.07 mg/g; no breeding, transgenic or fertilizer route. Lime gives tortillas ~20× more',
    flag: { kind: 'route', text: 'No projected effect in Guatemala (nixtamalization). Ethiopia 100%, Malawi 61% at risk of low intake; Nigeria: calcium healed rickets in 61% vs 19%. No known route into the grain.' },
    model: null, daly: null,
    src: `${L('https://pmc.ncbi.nlm.nih.gov/articles/PMC4235459/', 'Joy 2014')}; Thacher 1999 NEJM (PMID 10451461); ${L('https://pubmed.ncbi.nlm.nih.gov/30277579/', 'Hofmeyr 2018')}` },
  { id: 'rib', label: 'Riboflavin', short: 'riboflavin', group: 'elsewhere', color: '#c9b02e',
    unit: '% more riboflavin', hint: 'Maize 0.8 µg/g; varies 22–28× across inbred lines (breeding possible)',
    flag: { kind: 'none', text: 'Guatemala: a problem nutrient only in worst-case diets; no biomarker data. Côte d’Ivoire: 65% of schoolchildren deficient. No outcome trials.' },
    model: null, daly: null, src: `${L('https://doi.org/10.1017/S0007114507665180', 'Rohner 2007')}` },
  { id: 'b6', label: 'Vitamin B6', short: 'B6', group: 'elsewhere', color: '#a07cc5',
    unit: '% more vitamin B6', hint: 'Maize 3.7 µg/g; varies 6–7× across inbred lines',
    flag: { kind: 'none', text: 'Guatemala: worst-case diets only; no prevalence or outcome evidence anywhere.' },
    model: null, daly: null, src: `${L('https://pmc.ncbi.nlm.nih.gov/articles/PMC9634661/', 'Frontiers Nutr 2022')}` },
  { id: 'thi', label: 'Thiamin', short: 'thiamin', group: 'elsewhere', color: '#5f7fa8',
    unit: '% more thiamin', hint: 'Maize 1.1–26.5 µg/g across inbred lines (breeding possible)',
    flag: { kind: 'none', text: 'No Guatemala data. Burden is in rice-eating Laos and Cambodia: infant mortality 6.4% if deficient vs 0.7%.' },
    model: null, daly: null, src: `${L('https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3050987/', 'Laos infants')}` },
  { id: 'mg', label: 'Magnesium', short: 'magnesium', group: 'elsewhere', color: '#b0a089',
    unit: '% more magnesium', hint: 'Maize 0.85 mg/g',
    flag: { kind: 'none', text: 'No projected effect anywhere: risk of low intake is under 4% across Africa and none in Guatemala.' },
    model: null, daly: null, src: `${L('https://www.gov.uk/research-for-development-outputs/risk-of-dietary-magnesium-deficiency-is-low-in-most-african-countries-based-on-food-supply-data', 'Joy 2013')}` },
  { id: 'lp', label: 'Low phytate (absorption)', short: 'low phytate', group: 'elsewhere', color: '#6d8f6d',
    unit: '% of lpa1 phytate cut (−60%)', hint: 'Not a nutrient: lowers phytate so zinc and iron absorb better. lpa1 mutants −60%, Nutridense LP −80%', pctOfTarget: true,
    flag: { kind: 'none', text: 'No projected effect in Guatemala: a Guatemalan trial found no gain in children’s zinc absorption or growth. Adults: zinc absorption 0.28 vs 0.15, iron +49%.' },
    model: null, daly: null, src: `${L('https://doi.org/10.1093/ajcn/83.1.59', 'Guatemala trial 2006')}; Hambidge 2004 (PMID 15159236); ${L('https://doi.org/10.1093/ajcn/68.5.1123', 'Mendoza 1998')}` },

  // ---- No known route into maize (hypothetical) ----
  { id: 'b12', label: 'Vitamin B12', short: 'B12', group: 'nomaize', color: '#c0392b', pctOfTarget: true,
    unit: '% of a hypothetical 0.01 µg/g', hint: 'Plants make no B12. 100% would give ~1.5 µg/d from 150 g of maize, about 2× the EAR',
    flag: { kind: 'route', text: 'No known way into maize. If possible: ~19% of Guatemalan children are low (modeled), but trials show no clear benefit to cognition, anemia or growth (Cochrane 2026).' },
    model: { per_g: 0.01, ear: [0.7, 1.0], p0: 0.19, sd_log: 0.6 }, daly: null,
    src: `${L('https://doi.org/10.1016/j.cdnut.2023.101970', 'SIVESNU')}; ${L('https://doi.org/10.1002/14651858.cd015264.pub2', 'Cochrane 2026')}` },
  { id: 'vd', label: 'Vitamin D', short: 'vit D', group: 'nomaize', color: '#f0c419', pctOfTarget: true,
    unit: '% of a hypothetical 0.05 µg/g', hint: 'Maize has none; only a gene-edited tomato makes provitamin D3',
    flag: { kind: 'route', text: 'No projected effect in Guatemala (sun: 0% of children below 50 nmol/L). Mongolia: 41% deficient; respiratory infections OR 0.30 in the deficient (Martineau 2017). No known route into maize.' },
    model: null, daly: null, src: `${L('https://doi.org/10.1017/S1368980017001616', 'Robinson 2017')}; ${L('https://doi.org/10.1136/bmj.i6583', 'Martineau 2017')}` }
];
