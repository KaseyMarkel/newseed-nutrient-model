// Engine values to compare with the Google Sheet mirror (Results rows 37-40 and the GiveWell block). Usage: node tools/sheet_check_values.mjs
import fs from 'fs';
import { run, defaults, burdenPools } from '../site/js/global_engine.js';
import { REDTEAM, GIVEWELL as G } from '../site/js/global_redteam.js';
const D = JSON.parse(fs.readFileSync(new URL('../site/data/global.json', import.meta.url)));
const rows = [0, 1, 2].map(s => [['Pessimistic', 'Median', 'Optimistic'][s], defaults(D, s)]);
const P = defaults(D, 1); for (const l of REDTEAM.levers) l.apply(P, D); rows.push(['Red-team central', P]);
for (const [n, Pp] of rows) {
  const r = run(D, Pp), t = r.totals;
  const nt = Object.entries(r.nutTotals), s = nt.reduce((a, [, v]) => a + v, 0), u = nt.reduce((a, [k, v]) => a + v * (G.uov[k] ?? G.uov.extra), 0) / s;
  console.log(JSON.stringify([n, t.total, t.disc, t.per_daly_disc, t.cost_disc, u, t.disc * u / t.cost_disc / G.gd_uov_per_dollar]));
}
console.log('burden pools (red-team central)', JSON.stringify(burdenPools(D, P)));
