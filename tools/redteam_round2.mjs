// Round-2 levers, each alone on top of the v1.5 red-team central, then all together.
import fs from 'fs';
import { run, defaults } from '../site/js/global_engine.js';
import { REDTEAM } from '../site/js/global_redteam.js';
const D = JSON.parse(fs.readFileSync(new URL('../site/data/global.json', import.meta.url)));
const r1 = REDTEAM.levers.filter(l => !l.round), r2 = REDTEAM.levers.filter(l => l.round === 2);
const mk = ls => { const P = defaults(D, 1); for (const l of ls) l.apply(P, D); return P; };
const b = run(D, mk(r1)).totals;
const f = t => `${(t.total / 1e6).toFixed(3)}M disc ${(t.disc / 1e6).toFixed(3)}M $${(t.per_daly_disc ?? 0).toFixed(1)} ×${(t.disc / b.disc).toFixed(2)} disc, ×${(b.per_daly_disc / t.per_daly_disc).toFixed(2)} cost-eff`;
console.log('v1.5 RT central', f(b));
for (const l of r2) console.log(l.id.padEnd(12), f(run(D, mk([...r1, l])).totals));
const all = run(D, mk(REDTEAM.levers)); console.log('ALL', f(all.totals));
const Ps = mk(REDTEAM.levers); Ps.p_success = [1, 1, 1]; console.log('ALL if success', f(run(D, Ps).totals));
console.log(Object.fromEntries(Object.entries(all.nutTotals).map(([k, v]) => [k, Math.round(v)])));
