import fs from 'fs';
import { createEngine } from '../engine/engine.js';
import { healthOutcomes, HEALTH_DEFAULTS } from '../site/js/health.js';
import { boostParams, cleanBoosts } from '../site/js/boosts.js';
const R = new URL('..', import.meta.url).pathname;
const eng = createEngine({ ...JSON.parse(fs.readFileSync(R + 'site/data/bundle_econ.json')), ...JSON.parse(fs.readFileSync(R + 'site/data/bundle_nutrition.json')) });
const d = eng.defaults(); const sub = d.subsidies.find(s => s.id === 'sub00');
const seed = { id: 's30', label: '2030', year: '2030', yield_change: { OPV_Criollo: 0.705, Low: 0.705, Mid: 0.32, High: 0.078 } };
const show = (lab, b, pen = 0.5, hp = HEALTH_DEFAULTS) => {
  b = cleanBoosts(b);
  const res = eng.run({ seed, subsidy: sub, pathway: 'pco', penetration: pen, params: boostParams(b) });
  const h = healthOutcomes(res, b, hp);
  console.log(`\n${lab}  (pen ${pen * 100}%, subsidy $${Math.round(h.costUSD).toLocaleString()}, DALYs ${h.dalys.toFixed(0)}, $/DALY ${h.perDaly ? Math.round(h.perDaly).toLocaleString() : '-'})`);
  for (const r of h.rows) console.log(`  ${r.outcome.padEnd(26)} ${r.value.toFixed(1).padStart(9)}  DALYs ${r.dalys.toFixed(1).padStart(7)}${r.speculative ? (r.included ? '  [incl]' : '  [excluded]') : ''}`);
};
show('Replica', { fe: 19, zn: 38, prot: 94, va: 0, fol: 0 });
show('Replica + VA + folate', { fe: 19, zn: 38, prot: 94, va: 100, fol: 100 });
show('Everything 100, mortality on', { fe: 100, zn: 100, prot: 100, va: 100, fol: 100 }, 0.5, { ...HEALTH_DEFAULTS, mortality: true });
show('Replica, ENSMI anemia', { fe: 19, zn: 38, prot: 94 }, 0.5, { ...HEALTH_DEFAULTS, anemia_baseline: 'ensmi' });
show('All zero', { fe: 0, zn: 0, prot: 0, va: 0, fol: 0 });
show('Replica + stunting DALYs', { fe: 19, zn: 38, prot: 94 }, 0.5, { ...HEALTH_DEFAULTS, stunting_dalys: true });
{ const b = cleanBoosts({ fe: 19, zn: 38, prot: 94, vc: 100, cho: 100, n3: 100, b12: 100 });
  const r = eng.run({ seed, subsidy: sub, pathway: 'pco', penetration: 0.5, params: boostParams(b) }).national;
  for (const id of ['vc', 'cho', 'n3', 'b12']) console.log(id, 'inadequacy', r[`x_${id}_inad_pct_baseline`].toFixed(1), '->', r[`x_${id}_inad_pct`].toFixed(1), '%');
  console.log('stunting averted with extras', r.n_stunting_averted.toFixed(0)); }
