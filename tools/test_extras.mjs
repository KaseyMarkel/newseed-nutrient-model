import fs from 'fs';
import { createEngine } from '../engine/engine.js';
const R = new URL('..', import.meta.url).pathname;
const eng = createEngine({ ...JSON.parse(fs.readFileSync(R + 'site/data/bundle_econ.json')), ...JSON.parse(fs.readFileSync(R + 'site/data/bundle_nutrition.json')) });
const d = eng.defaults(); const sub = d.subsidies.find(s => s.id === 'sub00');
const seed = { id: 's30', label: '2030', year: '2030', yield_change: { OPV_Criollo: 0.705, Low: 0.705, Mid: 0.32, High: 0.078 } };
const run = (params, pen = 0.5) => eng.run({ seed, subsidy: sub, pathway: 'pco', penetration: pen, params });
const base = run({});
for (const add of [0, 0.002, 0.01]) {
  const r = run({ extra_nutrients: { b12: { add_per_g: add, p0: 0.19, ear: [0.7, 1.0], sd_log: 0.6 } } });
  const n = r.national;
  console.log(`add ${add}/g: baseline ${n.x_b12_inad_pct_baseline.toFixed(2)}%  after ${n.x_b12_inad_pct.toFixed(2)}%  change ${n.x_b12_inad_change_pp.toFixed(2)} pp  | stunting averted ${n.n_stunting_averted.toFixed(0)} (no extras: ${base.national.n_stunting_averted.toFixed(0)})`);
}
const r0 = run({ extra_nutrients: { b12: { add_per_g: 0.01, p0: 0.19, ear: [0.7, 1.0] } } }, 0);
console.log('penetration 0:', r0.national.x_b12_inad_change_pp);
try { run({ extra_nutrients: { bad: { add_per_g: -1 } } }); } catch (e) { console.log('rejects bad spec:', e.message.slice(0, 90)); }
