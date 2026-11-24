// Monte Carlo from the command line (same code as the page). Usage: node tools/mc.mjs [n]
import fs from 'fs';
import { run, defaults } from '../site/js/global_engine.js';
import { REDTEAM } from '../site/js/global_redteam.js';
import { runMC } from '../site/js/global_mc.js';
const D = JSON.parse(fs.readFileSync(new URL('../site/data/global.json', import.meta.url)));
const n = +process.argv[2] || 2000;
const M = x => (x / 1e6).toFixed(2) + 'M';
const odd = a => a.filter((_, j) => j % 2 === 0);
const show = (lab, S) => console.log(lab.padEnd(50),
  'disc DALYs p5/p50/p95', odd(S.disc).map(M).join(' / '), ' mean', M(S.meanDisc),
  ' P(0)', (S.pZero * 100).toFixed(0) + '%', ' EV $/disc DALY', S.ev.toFixed(2),
  ' if >0 p5/p50/p95 $', odd(S.perDaly).map(v => v.toFixed(1)).join(' / $'));
const P1 = defaults(D, 1);
const P2 = defaults(D, 1); for (const l of REDTEAM.levers) l.apply(P2, D);
for (const [lab, P, mode] of [['Sheet Median, sheet ranges', P1, 'sheet'], ['Sheet Median + red-team uncertainty', P1, 'rt'], ['Red-team central + red-team uncertainty', P2, 'rt']]) {
  show(lab, await runMC(run, D, P, { n, mode, batch: n }));
}
