// Live Monte Carlo for the global model (v1.5). Pure functions; the page runs draws in small batches.
//
// Mode 'sheet': every scenario lever is drawn around YOUR current value with the sheet's own spread
//   (Pessimistic = 5th percentile, Optimistic = 95th, two-piece normal). Levers in the same family share
//   part of their randomness (rho 0.5; approval years 0.8), so e.g. a bad regulatory draw delays every tier.
//   Edits succeed per crop with your current "probability the edits work" (correlated across crops, rho 0.5).
// Mode 'rt': as 'sheet', plus the red-team's uncertain inputs drawn from the distributions below
//   (these replace your current values for those inputs).
import { normCdf } from './global_engine.js';

export function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = r => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
const Z95 = 1.6448536269514722;
// value at standard-normal z, centred on cur, with the sheet's spread (lo at z = −1.645, hi at +1.645 when cur = mid)
const spread = (z, cur, lo, mid, hi) => cur + (z < 0 ? z * (mid - lo) : z * (hi - mid)) / Z95;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// [lever, family, min, max]
const SHEET_LEVERS = [
  ['zn_boost', 'tech', 0, 2], ['fe_boost', 'tech', 0, 2], ['prot_boost', 'tech', 0, 2], ['growth', 'tech', 0, 0.4],
  ['fib_delta', 'tech', 0, 6], ['fib_ax', 'tech', 0, 1],
  ['ceil', 'adopt', 0.02, 1], ['yrs', 'adopt', 3, 60], ['speed', 'adopt', 0.1, 4], ['skew', 'adopt', 0.2, 1],
  ['sec_stunt', 'trend', 0, 0.08], ['sec_micro', 'trend', 0, 0.08], ['fib_rr', 'own', 0.75, 1]
];
// red-team distributions (2026-11-23 review, central values = the "Red-team central" preset)
export const RT_DISTS = [
  ['P(edits work)', 'maize 0.5, rice 0.35, wheat 0.35; Bernoulli per crop, correlated (rho 0.5)'],
  ['Stunting dose (lysine gain of reference QPM)', 'uniform 0.6–1.0 (≈ +60–100% lysine)'],
  ['QPM evidence transfer', 'rice uniform 0.1–0.7; wheat uniform 0.5–1.0'],
  ['Seed lag after approval', 'maize 0–2 y; rice and wheat 1–5 y (uniform integers)'],
  ['DALYs per stunting case', 'two-piece lognormal, median 1.5, 5th–95th 0.4–2.8 (disability-only ≈ 0.1–0.25; 2.8 bundles deaths)'],
  ['Zinc burden', 'log-uniform between GBD 2019 (0.26M) and WHO 2002 (28M); median ≈ GBD 2017 (2.7M)'],
  ['Curt ceiling multiplier', 'uniform 1–2'],
  ['Program cost multiplier', 'uniform 1–2 (partner contracts beyond 2032, more registrations)']
];

export function sampleParams(D, P0, r, mode) {
  const P = structuredClone(P0);
  const fam = { tech: gauss(r), adopt: gauss(r), trend: gauss(r) };
  const L = D.levers;
  for (const [k, f, lo, hi] of SHEET_LEVERS) {
    const z = f === 'own' ? gauss(r) : Math.SQRT1_2 * fam[f] + Math.SQRT1_2 * gauss(r);
    P[k] = clamp(spread(z, P0[k], L[k][0], L[k][1], L[k][2]), lo, hi);
  }
  const zR = gauss(r);
  for (const [t, v] of Object.entries(D.tiers)) {
    const cur = P0.tiers[t];
    if (cur >= 2100) continue; // "never" stays never
    const z = Math.sqrt(0.8) * zR + Math.sqrt(0.2) * gauss(r);
    const y = Math.round(spread(z, cur, v[0], v[1], Math.min(v[2], 2100)));
    P.tiers[t] = y >= 2100 ? 2100 : Math.max(2028, y);
  }
  let p = P0.p_success.slice();
  if (mode === 'rt') {
    p = [0.5, 0.35, 0.35];
    P.qpm_ref = 0.6 + 0.4 * r();
    P.qpm_transfer = [1, 0.1 + 0.6 * r(), 0.5 + 0.5 * r()];
    P.crop_lag = [Math.floor(r() * 3), 1 + Math.floor(r() * 5), 1 + Math.floor(r() * 5)];
    const zs = gauss(r); P.stunt_daly = 1.5 * Math.exp(zs * Math.log(zs < 0 ? 1.5 / 0.4 : 2.8 / 1.5) / Z95); // two-piece lognormal
    P.zn_daly = P0.zn_daly_who * Math.exp(Math.log(0.259 / 28) * r()); // log-uniform 0.26M..28M relative to the WHO anchor
    P.zmult = 1 + r();
    P.cost_mult = (P0.cost_mult || 1) * (1 + r());
  }
  const z0 = gauss(r);
  const ok = p.map(pc => (normCdf(Math.SQRT1_2 * z0 + Math.SQRT1_2 * gauss(r)) < pc ? 1 : 0));
  P.p_success = ok;
  return P;
}

const q = (a, f) => { if (!a.length) return NaN; const x = (a.length - 1) * f, i = Math.floor(x); return a[i] + (a[Math.min(i + 1, a.length - 1)] - a[i]) * (x - i); };
export function summarize(draws) {
  const n = draws.length, mean = k => draws.reduce((s, d) => s + d[k], 0) / n;
  const disc = draws.map(d => d.disc).sort((a, b) => a - b), tot = draws.map(d => d.total).sort((a, b) => a - b);
  const pos = draws.filter(d => d.disc > 0).map(d => d.cost_disc / d.disc).sort((a, b) => a - b);
  const pct = a => [0.05, 0.25, 0.5, 0.75, 0.95].map(f => q(a, f));
  return {
    n, meanDisc: mean('disc'), meanTotal: mean('total'), meanCost: mean('cost_disc'),
    ev: mean('cost_disc') / mean('disc'), // expected cost ÷ expected discounted DALYs (cost is paid whether or not the edits work)
    disc: pct(disc), total: pct(tot), perDaly: pct(pos),
    pZero: draws.filter(d => d.disc <= 0).length / n,
    pUnder: t => draws.filter(d => d.disc > 0 && d.cost_disc / d.disc < t).length / n,
    allFail: draws.filter(d => d.p_success.every(v => !v)).length / n,
    raw: draws
  };
}
// run n draws in batches; onProgress(done, n); resolves to summarize(...)
export function runMC(run, D, P0, { n = 2000, mode = 'rt', seed = 20261124, batch = 100, onProgress } = {}) {
  const r = rng(seed), draws = [];
  return new Promise(resolve => {
    const step = () => {
      for (let j = 0; j < batch && draws.length < n; j++) {
        const P = sampleParams(D, P0, r, mode);
        const t = run(D, P).totals;
        draws.push({ total: t.total, disc: t.disc, cost_disc: t.cost_disc, p_success: P.p_success });
      }
      if (onProgress) onProgress(draws.length, n);
      if (draws.length < n) setTimeout(step, 0); else resolve(summarize(draws));
    };
    step();
  });
}
