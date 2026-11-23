import fs from 'fs';
import { createEngine } from '../engine/engine.js';
const R = new URL('..', import.meta.url).pathname;
const eng = createEngine({ ...JSON.parse(fs.readFileSync(R+'site/data/bundle_econ.json')), ...JSON.parse(fs.readFileSync(R+'site/data/bundle_nutrition.json')) });
const d = eng.defaults(); const sub = d.subsidies[0];
const seed = { id:'s30', label:'2030', year:'2030', yield_change:{ OPV_Criollo: 0.705, Low: 0.705, Mid: 0.32, High: 0.078 } };
for (const va of [0, 0.6, 1]) for (const pen of [0.5, 1]) {
  const n = eng.run({ seed, subsidy: sub, pathway: 'pco', penetration: pen, params: { va_fraction: va } }).national;
  console.log(`va=${va} pen=${pen}: all ${n.va_inad_pct.toFixed(2)}%  6-35mo ${n.va_inad_under36_pct.toFixed(2)}%  36-59mo ${n.va_inad_36to59_pct.toFixed(2)}%  averted ${n.n_va_inad_averted.toFixed(0)}  mean ${n.mean_va.toFixed(0)}`);
}
