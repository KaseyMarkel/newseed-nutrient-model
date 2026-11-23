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
  { nutrient: 'Folate (new)', color: '#4f8a5b', confidence: 'moderate', confidenceLabel: 'acts through mothers', extra: true,
    items: [
      ['In this model', `Women eat ~344 g/d of maize (${a('https://doi.org/10.1016/j.toxrep.2019.05.009', 'Guatemalan adults, median')}); white maize has 0.25 µg/g folate (USDA FDC), 90% kept through nixtamalization (native folate is stable; ${a('https://cerealsgrains.org/publications/cc/2010/September/Pages/87_5_434.aspx', 'Cereal Chem 2010')}). +100% adds ~77 µg DFE/d. Serum folate rises 0.94 ng/mL per 0.1 mg/d folic acid and each doubling halves neural tube defect risk (${a('https://doi.org/10.1016/S0140-6736(01)07104-5', 'Wald 2001')}). Exposure = each department’s share of maize eaten that is biofortified × its births.`],
      ['Burden', `47% of Guatemalan women have red-cell folate below the level that protects against neural tube defects (${a('https://doi.org/10.1002/bdra.23499', 'Rosenthal 2016')}); predicted NTD prevalence 14 per 10,000 births, 19 rural. Wheat flour and industrial maize flour are fortified, but ~95% of maize is home- or tortillería-nixtamalized and unfortified.`],
      ['Feasibility', `No released high-folate maize. Transgenic lines doubled (${a('https://doi.org/10.1073/pnas.0901412106', 'Naqvi 2009')}) to quadrupled (${a('https://doi.org/10.1093/jxb/ery453', 'JXB 2019')}) folate; conventional breeding is at the QTL stage.`],
      ['Reading', 'The per-woman gain is small (~4% lower NTD risk at +100%), but each NTD case carries ~55 DALYs, so folate can dominate the DALY total. Child folate intake is not in the survey data, so child folate status is not modeled.']
    ] },
  { nutrient: 'Outcomes beyond stunting', color: '#2e7d4f', confidence: 'moderate', confidenceLabel: 'how the links work',
    items: [
      ['Anemia (iron)', `Child anemia 6.1% (SIVESNU 2018/19, venous; the 32.4% from ENSMI 2014/15 uses capillary blood, which reads 9–31 pp high: ${a('https://pmc.ncbi.nlm.nih.gov/articles/PMC8327809', 'Whitehead 2019')}). 26.9% of preschool anemia in Latin America is due to iron deficiency (${a('https://doi.org/10.3390/nu8110693', 'Petry 2016')}). Iron-deficiency anemia falls with the share of iron-inadequate children made adequate.`],
      ['Diarrhea (zinc)', `~2.5 episodes per child-year (ENSMI 2-week prevalence 19.2%; facility data ${a('https://doi.org/10.1186/s12889-019-7720-2', 'Arvelo 2019')}). Zinc RR 0.91 applied to children moved above the zinc requirement, halved by default: daily 7–10 mg zinc had no effect on diarrhea in Laos (${a('https://doi.org/10.7189/jogh.10.010424', 'Laos trial, JoGH 2020')}).`],
      ['Low confidence', `Pneumonia (RR 0.87, ${a('https://doi.org/10.1002/14651858.CD005978.pub3', 'Cochrane')}), zinc deaths (LiST: −13% diarrhea, −15% pneumonia deaths, ${a('https://doi.org/10.1186/1471-2458-11-S3-S23', 'Yakoob 2011')}) and vitamin A deaths (RR 0.88) are shown but left out of the total unless you tick the box. GBD no longer links zinc to pneumonia.`],
      ['DALYs', 'GBD 2019 disability weights: anemia 0.004/0.052/0.149 (mild/moderate/severe; this model assumes 60/38/2%), diarrhea ~0.0014 DALY per episode, ~55 DALYs per NTD birth (75% die before age 5), ~71 years of life lost per child death. Undiscounted.']
    ] },
  { nutrient: 'Other nutrients considered and not added', color: '#9a918a', confidence: 'low', confidenceLabel: 'not modeled',
    items: [
      ['Calcium', 'Lime supplies ~95% of the calcium in tortillas (7 → 138 mg/100 g); breeding the grain barely changes it.'],
      ['Niacin', 'Nixtamalization already frees maize niacin and pellagra is no longer seen; QPM’s extra tryptophan adds niacin as a side effect.'],
      ['Riboflavin, vitamin B6', `Short in highland infants (${a('https://apjcn.qdu.edu.cn/27_5_10.pdf', 'Vossenaar 2018')}), but no maize breeding target and no outcome data.`],
      ['Vitamin E, selenium, iodine', 'No Guatemalan burden data; selenium follows soil, iodine comes from salt.'],
      ['Vitamin B12', '~19% of children are low, but plants contain no B12.'],
      ['Lutein / zeaxanthin', 'Comes with orange provitamin A maize; no deficiency measure for children.'],
      ['Low phytate', `Not a nutrient but an absorption lever; a Guatemalan trial found no gain in zinc absorption (${a('https://doi.org/10.1093/ajcn/83.1.59', 'AJCN 2006')}).`]
    ] }
];
