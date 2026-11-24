// Extra nutrients for the global model (extension of the BOTEC v1.4; not in the sheet).
// Same structure as the sheet's zinc block:
//   DALYs = (1−rM)^k · pop(group) · cropShare · prevalence (Passarelli 2024, by country) · daly · (boost · gap · lab→field) · retention_crop · VR · (1−base)
// `daly` = DALYs averted per inadequate person-year, CENTRAL estimate:
//   GBD burden ÷ people inadequate (Passarelli global) where GBD has a burden; otherwise a small speculative prior.
// `range` = [low, high] multipliers on `daly` (shown on the page). Retention priors per crop [maize, rice, wheat]
// are placeholders (milling and polishing remove bran nutrients; vitamins degrade in storage and cooking).
// `flag` says whether an edit route into CGIAR maize/rice/wheat is known.
export const GLOBAL_EXTRAS = [
  { id: 'va', label: 'Provitamin A', color: '#d97a1e', prevKey: 'Vitamin A', group: 'all', gap: 0.5,
    daly: 3.30e6 / 4.0e9, range: [0.2, 3], ret: [0.5, 0.5, 0.5], routeCrops: [1, 0, 0],
    unit: '% more provitamin A (bioavailable)', flagKind: 'spec',
    flag: 'Counted in maize only: editable there (crtRB1/lcyE alleles already bred by HarvestPlus). Rice and wheat make none in the grain and need transgenes (Golden Rice). Burden: GBD 2019 vitamin A risk 3.3M DALYs ÷ ~4.0B inadequate.' },
  { id: 'fol', label: 'Folate (via mothers)', color: '#4f8a5b', prevKey: 'Folate', group: 'w', wshare: 0.25, gap: 0.5,
    daly: (5.29e6 * 0.72) / (0.25 * 7.57e9 * 0.60), range: [0.3, 3], ret: [0.9, 0.5, 0.6], fort: 0.8,
    unit: '% more folate; women 15–49 (≈25% of population)', flagKind: 'route',
    flag: 'Only transgenic so far (multivitamin maize 2×, folate rice ~100×); no edit route known. Burden: neural tube defects 5.3M DALYs (GBD 2021) × ~72% preventable ÷ ~1.1B women inadequate; ×0.8 for existing flour fortification.' },
  { id: 'io', label: 'Iodine', color: '#6a5acd', prevKey: 'Iodine', group: 'all', gap: 0.5,
    daly: 2 * 2.25e6 / 5.4e9, range: [0.5, 4], ret: [0.7, 0.7, 0.7], fort: 0.3,
    unit: '% more iodine', flagKind: 'route',
    flag: 'No genetic route: iodine enters grain only via fertilizer sprays. Burden: GBD 2021 goitre 2.25M DALYs ÷ 5.4B inadequate, ×2 for uncounted cognitive loss. ×0.3 because Passarelli counts food only and iodized salt reaches ~88% of households.' },
  { id: 'ca', label: 'Calcium', color: '#8f8f8f', prevKey: 'Calcium', group: 'all', gap: 0.5,
    daly: 3.14e6 / 5.0e9, range: [0.3, 3], ret: [0.9, 0.4, 0.6],
    unit: '% more calcium', flagKind: 'route',
    flag: 'No known edit route; grain calcium barely varies. Burden: GBD 2019 “diet low in calcium” 3.1M DALYs (colorectal cancer, adults) ÷ 5.0B inadequate; rickets not in GBD.' },
  { id: 'b12', label: 'Vitamin B12', color: '#c0392b', prevKey: 'Vitamin B12', group: 'all', gap: 0.5,
    daly: 0.0003, range: [-1, 4], ret: [0.8, 0.8, 0.8],
    unit: '% of a hypothetical B12 level', flagKind: 'route',
    flag: 'Impossible: plants make no B12. If it were: speculative prior; Cochrane 2026 found no clear benefit to cognition, anemia or growth (point estimates small).' },
  { id: 'thi', label: 'Thiamin', color: '#5f7fa8', prevKey: 'Thiamin', group: 'all', gap: 0.5,
    daly: 0.0004, range: [0.1, 5], ret: [0.5, 0.2, 0.5],
    unit: '% more thiamin', flagKind: 'spec',
    flag: 'Natural variation 9–24× across maize lines (breeding or editing plausible). Polished rice loses most. Speculative prior; infant beriberi deaths in rice-eating SE Asia.' },
  { id: 'nia', label: 'Niacin', color: '#b35c1e', prevKey: 'Niacin', group: 'all', gap: 0.5,
    daly: 0.0004, range: [0.2, 5], ret: [0.6, 0.4, 0.6],
    unit: '% more niacin', flagKind: 'spec',
    flag: 'Free niacin varies 9–22× across maize lines; QPM tryptophan adds niacin. Matters where maize is not lime-treated (Malawi pellagra outbreaks). Speculative prior.' },
  { id: 'rib', label: 'Riboflavin', color: '#c9b02e', prevKey: 'Riboflavin', group: 'all', gap: 0.5,
    daly: 0.0002, range: [0, 5], ret: [0.8, 0.4, 0.6],
    unit: '% more riboflavin', flagKind: 'spec',
    flag: 'Varies 22–28× across maize lines. Deficiency common (65% in Côte d’Ivoire schoolchildren) but no outcome trials; small speculative prior.' },
  { id: 'b6', label: 'Vitamin B6', color: '#a07cc5', prevKey: 'Vitamin B6', group: 'all', gap: 0.5,
    daly: 0.0001, range: [0, 5], ret: [0.7, 0.4, 0.6],
    unit: '% more vitamin B6', flagKind: 'spec',
    flag: 'Varies 6–7× across maize lines; transgenic B6 rice exists. No outcome evidence; small prior.' },
  { id: 'se', label: 'Selenium', color: '#7d8c3a', prevKey: 'Selenium', group: 'all', gap: 0.5,
    daly: 0.0002, range: [0, 5], ret: [0.9, 0.7, 0.8],
    unit: '% more selenium', flagKind: 'route',
    flag: 'Set by soil; the route is selenate fertilizer (Finland, Malawi), not genetics. Benefit proven only for Keshan disease; small prior.' },
  { id: 'vc', label: 'Vitamin C', color: '#e0a800', prevKey: 'Vitamin C', group: 'all', gap: 0.5,
    daly: 0.0001, range: [0, 5], ret: [0.3, 0.3, 0.3],
    unit: '% of transgenic level', flagKind: 'route',
    flag: 'Cereal grain has almost none; transgenic maize reached 6×. Destroyed by cooking. Small prior (colds, iron absorption).' },
  { id: 've', label: 'Vitamin E', color: '#9c7a2b', prevKey: 'Vitamin E', group: 'all', gap: 0.5,
    daly: 0.00005, range: [0, 5], ret: [0.8, 0.3, 0.5],
    unit: '% more vitamin E', flagKind: 'spec',
    flag: 'Transgenic routes (HGGT, up to 6×); natural variation modest. No outcome trials; tiny prior.' },
  { id: 'mg', label: 'Magnesium', color: '#b0a089', prevKey: 'Magnesium', group: 'all', gap: 0.5,
    daly: 0.00003, range: [0, 5], ret: [0.9, 0.4, 0.6],
    unit: '% more magnesium', flagKind: 'spec',
    flag: 'Little shortfall where it matters (Africa <4%); near-zero prior.' }
];
// Zinc burden anchors for the sheet's zinc DALYs-per-case (= anchor ÷ 1.5B × recalibration).
export const ZINC_ANCHORS = [
  { id: 'who2002', label: 'WHO 2002: 28M DALYs (sheet)', dalys: 28e6 },
  { id: 'gbd2017', label: 'GBD 2017: 2.6M', dalys: 2.6e6 },
  { id: 'gbd2019', label: 'GBD 2019: 0.26M', dalys: 0.26e6 }
];
