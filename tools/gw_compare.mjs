// GiveWell translation of the red-team central (round 1 + 2), deterministic and Monte Carlo. Usage: node tools/gw_compare.mjs [n]
import fs from 'fs';
import { run, defaults } from '../site/js/global_engine.js';
import { REDTEAM, GIVEWELL as G } from '../site/js/global_redteam.js';
import { runMC } from '../site/js/global_mc.js';
const D = JSON.parse(fs.readFileSync(new URL('../site/data/global.json', import.meta.url)));
const uovOf = r => { const nt = Object.entries(r.nutTotals).filter(([, v]) => v > 0), s = nt.reduce((a, [, v]) => a + v, 0); return nt.reduce((a, [k, v]) => a + v * (G.uov[k] ?? G.uov.extra), 0) / s; };
const mult = (disc, cost, u) => disc * u / cost / G.gd_uov_per_dollar;
const P = defaults(D, 1); for (const l of REDTEAM.levers) l.apply(P, D);
const r = run(D, P), u = uovOf(r);
console.log(`Red-team central: ${(r.totals.total / 1e6).toFixed(3)}M DALYs, disc ${(r.totals.disc / 1e6).toFixed(3)}M, $${r.totals.per_daly_disc.toFixed(1)}/disc DALY, UoV/DALY ${u.toFixed(2)}, ${mult(r.totals.disc, r.totals.cost_disc, u).toFixed(2)}x benchmark (bar ${G.bar_x}x = $${(u / G.bar_x / G.gd_uov_per_dollar).toFixed(0)}/disc DALY)`);
const Ps = structuredClone(P); Ps.p_success = [1, 1, 1]; const rs = run(D, Ps);
console.log(`If the edits work: $${rs.totals.per_daly_disc.toFixed(1)}/disc DALY, ${mult(rs.totals.disc, rs.totals.cost_disc, uovOf(rs)).toFixed(2)}x benchmark`);
const n = +process.argv[2] || 0;
if (n) {
  const S = await runMC(run, D, P, { n, mode: 'rt', batch: n });
  console.log(`MC (${n}): EV $${S.ev.toFixed(1)}/disc DALY = ${(u / S.ev / G.gd_uov_per_dollar).toFixed(2)}x benchmark; P(zero) ${(S.pZero * 100).toFixed(0)}%; P(beats ${G.bar_x}x bar) ${(S.pUnder(u / G.bar_x / G.gd_uov_per_dollar) * 100).toFixed(0)}%; $/DALY if >0 p5/p50/p95 ${[0, 2, 4].map(j => S.perDaly[j].toFixed(0)).join('/')}`);
}
