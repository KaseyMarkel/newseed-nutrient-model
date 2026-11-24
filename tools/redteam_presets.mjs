// Red-team central case vs the sheet Median (and each lever alone). Usage: node tools/redteam_presets.mjs
import fs from 'fs';
import { run, defaults } from '../site/js/global_engine.js';
import { REDTEAM } from '../site/js/global_redteam.js';
const D = JSON.parse(fs.readFileSync(new URL('../site/data/global.json', import.meta.url)));
const base = run(D, defaults(D, 1)).totals;
const show = (lab, t) => console.log(`${lab.padEnd(44)} DALYs ${(t.total / 1e6).toFixed(2)}M  disc ${(t.disc / 1e6).toFixed(2)}M  $/disc DALY ${t.per_daly_disc ? t.per_daly_disc.toFixed(2) : '-'}  (×${(t.disc / base.disc).toFixed(2)} disc)`);
show('Sheet Median', base);
for (const l of REDTEAM.levers) { const P = defaults(D, 1); l.apply(P, D); show(`  only: ${l.label}`, run(D, P).totals); }
const P = defaults(D, 1); for (const l of REDTEAM.levers) l.apply(P, D); show('Red-team central (all levers)', run(D, P).totals);
const Pc = defaults(D, 1); for (const l of REDTEAM.levers) if (l.id !== 'p_success') l.apply(Pc, D); show('Red-team central, conditional on success', run(D, Pc).totals);
