# Guatemala model · nutrient boosts

A copy of the New Seed Guatemala model replica (semillanueva.org/q7x4mv, itself a
browser port of Azahar Data Insights' model) with nutrient-content sliders.

Run: `python3 -m http.server 8765` here, open http://localhost:8765/site/index.html
(lands on the Nutrient Boosts page). Edit `engine/`, then `./sync-engine.sh`.
Tests: `node tools/test_boosts.mjs` (replica values reproduce the replica bit for bit;
all-zero boosts give zero effect), `node tools/va_age.mjs`.

## What the sliders do (0-100% each)
| Slider | Engine | Replica value |
|---|---|---|
| Iron | factor_fe = 1 + b/100 | +19% |
| Zinc | factor_zn = 1 + b/100 | +38% |
| Protein quality | factor_prot = 1 + b/100; lystrp_scale = b/94; gunaratna_effect_size = 0.09·b/94 | +94% |
| Provitamin A (new) | va_fraction = b/100 of 15 µg/g β-carotene | 0% |
| Folate (new) | not an engine param; health.js only (women → neural tube defects) | 0% |

- Covariate pathway: the lysine+tryptophan share of each child's nutrition-index change is
  backed out of Azahar's exported index (it is exactly proportional to maize protein,
  ratio 0.1856) and scaled by the protein slider. The replica kept it fixed.
- Vitamin A: per child, maize g/d × content × retention 0.475 ÷ 10 (β-carotene:retinol)
  added to non-maize intake (median 850 µg RAE/d × (non-maize kcal/418)^0.25, CV 0.6;
  calibrated to Mayan children 2-5 y: 1-3% below EAR). Inadequacy = P(intake < IOM EAR
  210/275). Not linked to stunting. Sources in site/js/evidence.js.

## Health outcomes beyond stunting (site/js/health.js)
Annual, from the engine's inadequacy changes: child anemia (iron; SIVESNU 6.1% × 26.9% iron-attributable),
diarrhea (zinc; RR 0.91 on children moved above the zinc requirement × 0.5 food discount), neural tube
defects (folate; Wald 2001 serum-folate model, births by department × biofortified share). Pneumonia and
child deaths (zinc, vitamin A) are shown but excluded from the DALY total unless toggled. No cost per DALY:
the subsidy also buys yield, income and stunting gains. Test: `node tools/test_health.mjs`.
Nutrients screened and not added (calcium, niacin, riboflavin, B6, vitamin E, selenium, iodine, B12,
lutein, low phytate): see site/js/evidence.js.

## Exploratory nutrients (site/js/nutrient_catalog.js)
15 more sliders, grouped: Guatemala shortfall (vitamin C, choline, omega-3 ALA modeled for inadequacy; vitamin E
flag only), shortfall elsewhere (iodine, selenium, niacin, calcium, riboflavin, B6, thiamin, magnesium, low
phytate: flag only), no route into maize (B12 modeled hypothetically, vitamin D flag only). Modeled ones use the
engine's generic `extra_nutrients` path (lognormal intake calibrated to Guatemalan prevalence). Each slider
carries a flag: modeled here / no projected effect here (effect elsewhere) / no known route into maize.
Stunting can be counted in DALYs (opt-in) via Olofin 2013 mortality HRs. Test: `node tools/test_extras.mjs`.

## Hosting
GitHub Pages via `.github/workflows/pages.yml` (publishes `site/` on every push to main):
https://kaseymarkel.com/newseed-nutrient-model/ . Pages carry `noindex`.

## Data
`site/data/bundle_*.json` is the replica's processed bundle (per-child and per-farmer
records derived from ENCOVI 2023 and SIVESNU 2018, no identifiers). Azahar's public repo
ships code only and does not distribute these files; they are public here by choice,
as they already are on the replica.
