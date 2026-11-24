// Every slider at 100% (others at replica values): change in DALYs/yr and stunting vs the replica.
import fs from 'fs';
import { createEngine } from '../engine/engine.js';
import { healthOutcomes, HEALTH_DEFAULTS } from '../site/js/health.js';
import { BOOSTS, boostParams, cleanBoosts } from '../site/js/boosts.js';
const R = new URL('..', import.meta.url).pathname;
const eng = createEngine({ ...JSON.parse(fs.readFileSync(R + 'site/data/bundle_econ.json')), ...JSON.parse(fs.readFileSync(R + 'site/data/bundle_nutrition.json')) });
const d = eng.defaults(); const sub = d.subsidies.find(s => s.id === 'sub00');
const seed = { id: 's30', label: '2030', year: '2030', yield_change: { OPV_Criollo: 0.705, Low: 0.705, Mid: 0.32, High: 0.078 } };
const go = b => { b = cleanBoosts(b); const res = eng.run({ seed, subsidy: sub, pathway: 'pco', penetration: 0.5, params: { ...boostParams(b), include_quantiles: false } }); return { res, h: healthOutcomes(res, b, HEALTH_DEFAULTS) }; };
const base = go({});
console.log(`replica: DALYs ${base.h.dalys.toFixed(0)} (range ${base.h.lo.toFixed(0)} to ${base.h.hi.toFixed(0)}), stunting averted ${base.res.national.n_stunting_averted.toFixed(0)}`);
let zero = [];
for (const x of BOOSTS) {
  const v = go({ [x.id]: 100 });
  const dD = v.h.dalys - base.h.dalys, dS = v.res.national.n_stunting_averted - base.res.national.n_stunting_averted;
  if (Math.abs(dD) < 1e-6) zero.push(x.id);
  console.log(`${x.label.padEnd(26)} 100%: DALYs ${dD >= 0 ? '+' : ''}${dD.toFixed(1).padStart(8)}   stunting ${dS >= 0 ? '+' : ''}${dS.toFixed(0)}`);
}
console.log('sliders with no DALY change:', zero.length ? zero.join(', ') : 'none');
const all = go(Object.fromEntries(BOOSTS.map(x => [x.id, 100])));
console.log(`everything 100%: DALYs ${all.h.dalys.toFixed(0)} (range ${all.h.lo.toFixed(0)} to ${all.h.hi.toFixed(0)})`);
