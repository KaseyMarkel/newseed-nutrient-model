// Evidence synthesis shown on the Nutrient Boosts page (literature review, 2026-11-23).
// Effect sizes are what trials of each nutrient found. The model itself only uses the
// mechanisms in "In this model"; the rest is context for judging the sliders.
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

export const EVIDENCE_NOTE = 'What each nutrient buys, according to trials and meta-analyses. Supplement trials give far larger doses than biofortified maize, so treat them as an upper bound on direction, not on size.';

export const EVIDENCE = [
  { nutrient: 'Zinc', color: '#2f5f8f', confidence: 'moderate', confidenceLabel: 'moderate evidence',
    items: [
      ['In this model', 'Absorbed zinc (Miller model) against the IZiNCG requirement → zinc inadequacy. In the covariate pathway, zinc is one of four terms of the nutrition index that predicts height-for-age.'],
      ['Growth', `Preventive zinc: height SMD <b>+0.12</b> (0.09–0.14), 74 trials (${a('https://doi.org/10.1002/14651858.CD009384.pub3', 'Cochrane 2023')}); +0.37 cm per 10 mg/d over 24 weeks (${a('https://doi.org/10.1186/1471-2458-11-S3-S22', 'Imdad &amp; Bhutta 2011')}). HAZ effect not significant overall (${a('https://doi.org/10.3390/nu10030377', 'Liu 2018')}).`],
      ['Morbidity & mortality', `Diarrhea RR <b>0.91</b> (0.90–0.93); all-cause mortality RR 0.93 (0.84–1.03, not significant) (${a('https://doi.org/10.1002/14651858.CD009384.pub3', 'Cochrane 2023')}).`],
      ['Biofortified crops', `Zinc wheat: −17% days with pneumonia, −40% days with vomiting, but no change in plasma zinc (${a('https://doi.org/10.1186/s12937-018-0391-5', 'Sazawal 2018')}). Zinc rice and wheat raise intake reliably; effects on status and growth are weak (${a('https://doi.org/10.1093/ajcn/nqab379', 'Jongstra 2022')}).`]
    ] },
  { nutrient: 'Iron', color: '#8e3129', confidence: 'moderate', confidenceLabel: 'good for anemia, none for growth',
    items: [
      ['In this model', 'Iron intake × 5% absorption against 0.5 mg/d absorbed → iron inadequacy. Covariate pathway: one of the four nutrition-index terms.'],
      ['Anemia', `Iron for ages 4–23 mo: anemia RR <b>0.61</b> (0.50–0.74), iron-deficiency anemia RR 0.14 (${a('https://doi.org/10.1016/S2214-109X(13)70046-9', 'Pasricha 2013')}). Ages 2–5: Hb +7 g/L (${a('https://doi.org/10.1542/peds.2012-2256', 'Thompson 2013')}).`],
      ['Growth', `No benefit; possible harm in iron-replete infants (length SMD −0.83, Pasricha 2013). The covariate pathway's iron → height-for-age link is therefore its least supported part.`],
      ['Biofortified crops', `Iron beans: Hb +3.8 g/L (${a('https://doi.org/10.3945/jn.115.224741', 'Haas 2016')}); iron pearl millet: iron-deficient children more likely to become replete, RR 1.64 (${a('https://doi.org/10.3945/jn.114.208009', 'Finkelstein 2015')}). Guatemala: anemia 9.4%, iron deficiency 8.9% at 6–59 mo (SIVESNU 2013).`]
    ] },
  { nutrient: 'Protein quality (QPM)', color: '#c9963b', confidence: 'low', confidenceLabel: 'contested',
    items: [
      ['In this model', 'Utilizable protein vs WHO/FAO 13/19 g/d → protein inadequacy. Stunting: meta-analysis pathway uses Gunaratna’s +9% height growth × (boost ÷ 94); covariate pathway scales the lysine + tryptophan term × (boost ÷ 94).'],
      ['Growth', `Gunaratna 2010 meta-analysis: height growth rate <b>+9%</b>, weight +12% (7–18%) (${a('https://doi.org/10.1016/j.foodpol.2009.11.003', 'doi')}). A later Ethiopian cluster RCT raised child QPM consumption 17 pp but found <b>no effect on HAZ or WAZ</b> (${a('https://doi.org/10.1136/bmjgh-2020-002705', 'Donato 2020')}).`],
      ['Reading', 'Treat the QPM growth effect as an optimistic upper bound; zero is plausible. It is also the single largest driver of stunting averted in both pathways (see the bar chart).']
    ] },
  { nutrient: 'Provitamin A (new)', color: '#d97a1e', confidence: 'high', confidenceLabel: 'clear evidence, small gain here', extra: true,
    items: [
      ['In this model', `Maize g/d × (slider × 15 µg/g β-carotene) × retention 0.475 ÷ 10 → µg RAE/d, added to each child’s non-maize vitamin A. Non-maize intake is calibrated to a median of ~850 µg RAE/d (CV 0.6) from a survey of Mayan children aged 2–5 (${a('https://doi.org/10.1186/s12889-025-24111-2', 'BMC Public Health 2025')}). Inadequacy = probability below the IOM requirement (210 / 275 µg RAE/d). Vitamin A does not enter the stunting model.`],
      ['Content & losses', `White maize ≈ 0; HarvestPlus target 15 µg/g; released hybrids 7.5–10 µg/g. Storage keeps ~50% (30–80%) (${a('https://doi.org/10.1021/jf501233f', 'Mugode 2014')}); nixtamalization and tortillas keep 85–100% (${a('https://doi.org/10.1021/acs.jafc.6b02951', 'Ortiz 2016')}). β-carotene:retinol ≈ 10:1 in children (${a('https://doi.org/10.3945/ajcn.114.087379', 'Gannon 2014')}).`],
      ['Efficacy', `Orange maize raised body vitamin A stores as much as a 400 µg supplement (+84 vs +98 µmol) (${a('https://doi.org/10.3945/ajcn.114.087379', 'Gannon 2014')}); serum β-carotene rose, serum retinol did not (${a('https://doi.org/10.3945/ajcn.116.132571', 'Palmer 2016')}). No trial has measured growth or mortality.`],
      ['Why the gain is small', `Guatemala fortifies sugar with retinol (since 1974). Low serum retinol in children is now 0.3–3.4% (ENSMI 2009; ${a('https://portal.siinsan.gob.gt/wp-content/uploads/SIVESNU-2013-COMPLETO-PARA-SESAN-2020-1.pdf', 'SIVESNU 2013')}), and only 1–3% of Mayan children 2–5 y eat below the requirement. Supplementation cuts child mortality (RR 0.88, ${a('https://doi.org/10.1002/14651858.CD008524.pub4', 'Imdad 2022')}) where deficiency is common, but not growth (${a('https://doi.org/10.1093/jn/134.10.2592', 'Ramakrishnan 2004')}). In Guatemala the benefit is mostly insurance for children whom sugar fortification misses.`]
    ] },
  { nutrient: 'Other candidates considered', color: '#9a918a', confidence: 'low', confidenceLabel: 'not modeled',
    items: [
      ['Folate', 'A real gap (33.5% low red-cell folate in preschoolers) but no released non-GM folate maize.'],
      ['Vitamin B12', '22.5% deficient, but plants cannot supply it.'],
      ['Low phytate', `A Guatemalan trial found no gain in zinc absorption (${a('https://doi.org/10.1093/ajcn/83.1.59', 'AJCN 2006')}), and the trait carries agronomic penalties.`],
      ['Calcium, vitamin E, selenium', 'Nixtamalization already adds calcium; no breeding target or Guatemalan evidence of burden for the others.']
    ] }
];
