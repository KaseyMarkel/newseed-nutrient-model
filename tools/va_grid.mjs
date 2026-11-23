import fs from 'fs';
import { createNutrition } from '../engine/nutrition.js';
const R = new URL('..', import.meta.url).pathname;
const B = JSON.parse(fs.readFileSync(R+'site/data/bundle_nutrition.json'));
for (const el of [0.25, 0.4, 0.5]) for (const sd of [0.45, 0.555]) {
  B.nutrition.constants.va = { kcal_elasticity: el, sd_log: sd };
  const n = createNutrition(B).baseline('pco').national;
  console.log(`elast ${el} sd ${sd}: all ${n.va_inad_pct.toFixed(2)}  <36 ${n.va_inad_under36_pct.toFixed(2)}  36-59 ${n.va_inad_36to59_pct.toFixed(2)}  mean ${n.mean_va.toFixed(0)}`);
}
