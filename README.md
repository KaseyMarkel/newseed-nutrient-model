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

- Covariate pathway: the lysine+tryptophan share of each child's nutrition-index change is
  backed out of Azahar's exported index (it is exactly proportional to maize protein,
  ratio 0.1856) and scaled by the protein slider. The replica kept it fixed.
- Vitamin A: per child, maize g/d × content × retention 0.475 ÷ 10 (β-carotene:retinol)
  added to non-maize intake (median 850 µg RAE/d × (non-maize kcal/418)^0.25, CV 0.6;
  calibrated to Mayan children 2-5 y: 1-3% below EAR). Inadequacy = P(intake < IOM EAR
  210/275). Not linked to stunting. Sources in site/js/evidence.js.
