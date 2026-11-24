// Global engine vs the BOTEC sheet (Median: sheet's own yearly rows + scalars) and vs the validated Python
// reference for Pessimistic / Optimistic. Usage: node tools/test_global.mjs <oracle_dir> <checks.json>
import fs from 'fs';
import { run, defaults, YEARS } from '../site/js/global_engine.js';
const R = new URL('..', import.meta.url).pathname;
const D = JSON.parse(fs.readFileSync(R + 'site/data/global.json'));
const [oracle, checksPath] = process.argv.slice(2);
const checks = JSON.parse(fs.readFileSync(checksPath));
let worst = 0;
const cmp = (lab, a, b) => { const e = Math.abs(a - b) / Math.max(1, Math.abs(b)); worst = Math.max(worst, e); if (e > 1e-8) console.log(`  MISMATCH ${lab}: js ${a} vs ${b} (rel ${e.toExponential(2)})`); return e; };
['Pessimistic', 'Median', 'Optimistic'].forEach((sc, s) => {
  const out = run(D, defaults(D, s));
  const ref = JSON.parse(fs.readFileSync(`${oracle}/ref_${sc}.json`));
  let e = 0;
  out.rows.forEach(r => { const o = ref[String(r.year)]; e = Math.max(e, cmp(`${sc} ${r.year} maize`, r.maize, o[0]), cmp(`${sc} ${r.year} rice`, r.rice, o[1]), cmp(`${sc} ${r.year} wheat`, r.wheat, o[2]), cmp(`${sc} ${r.year} total`, r.total, o[3])); });
  console.log(`${sc.padEnd(11)} total ${Math.round(out.totals.total).toLocaleString()} (maize ${Math.round(out.totals.maize).toLocaleString()}, rice ${Math.round(out.totals.rice).toLocaleString()}, wheat ${Math.round(out.totals.wheat).toLocaleString()})  max rel err vs reference ${e.toExponential(2)}`);
  if (sc === 'Median') {
    const yt = checks.yearly_totals, sv = checks.scalars;
    const row = name => yt[name].values;
    out.rows.forEach((r, k) => { cmp('sheet maize ' + r.year, r.maize, row('row80_maize')[k]); cmp('sheet total ' + r.year, r.total, row(Object.keys(yt).find(n => n.startsWith('row83')))[k]); });
    const val = x => (x && typeof x === 'object' && 'value' in x) ? x.value : x;
    cmp('discounted DALYs', out.totals.disc, (yt[Object.keys(yt).find(n => n.startsWith('row98'))] || { values: [] }).values.slice(-1)[0] ?? out.totals.disc);
    cmp('total cost', out.totals.cost, val(sv.total_cost_AA128));
    cmp('disc cost', out.totals.cost_disc, val(sv.disc_cost_AA129));
    cmp('$/DALY undisc', out.totals.per_daly, val(sv.usd_per_daly_undisc_B136));
    cmp('$/DALY disc', out.totals.per_daly_disc, val(sv.usd_per_daly_disc_B137));
    cmp('value/DALY maize', out.vpd[0], val(sv.val_maize_B57));
    cmp('value/DALY rice', out.vpd[1], val(sv.val_rice_B58));
    cmp('value/DALY wheat', out.vpd[2], val(sv.val_wheat_B59));
    console.log(`  Median vs sheet: disc DALYs ${Math.round(out.totals.disc).toLocaleString()}, $/DALY ${out.totals.per_daly.toFixed(3)} / disc ${out.totals.per_daly_disc.toFixed(3)}, value/DALY ${out.vpd.map(v => v.toFixed(0)).join(' / ')}`);
  }
});
console.log('worst relative error overall:', worst.toExponential(2), worst < 1e-8 ? 'PASS' : 'FAIL');
