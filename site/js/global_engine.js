// Global nutrient model engine: a JavaScript port of New Seed's "Gene_editing_mainstreaming_BOTEC v1.4"
// (Google Sheet, pulled 2026-11-23), extended with extra nutrients.
//
// Structure (per country i, crop c ∈ maize/rice/wheat, year y = 2030..2050, k = y − 2030):
//   approval year A_i from the country's tier; variety-replacement share VR_c[i,y] ramps up from A_i
//   Zn  = (1−rM)^k · pop · share_c · zincPrev · znDaly · effZn · retZn_c · VR · (1−base)
//   Fe  = (1−rM)^k · pop · share_c · ironPrev · feDaly · effFe · retFe_c · VR · (1−base)
//   PW  = (1−rS)^k · pop · share_c · stunting · protDaly · effP · VR · (1−base)                (protein, all ages)
//   PS  = (1−rS)^k · pop0-4 · share_c · stunting · stuntInc · stuntDaly · W_i · VR · (1−base)  (stunting, under-5)
//   Fib = pop · fiberDalyRate_i · VR_wheat · fibGap                                            (wheat only)
//   extra nutrient X (extension) = (1−rM)^k · popGroup · share_c · prev_X · dalyX · effX · retX_c · VR · (1−base)
//   headline = Σ × attribution − cross-crop cap × attribution
// Quirks of the sheet are reproduced by default and named Q1..Q10 as in SPEC.md; `fixes` switches them off.

export const YEARS = Array.from({ length: 21 }, (_, k) => 2030 + k);
export const CROPS = ['maize', 'rice', 'wheat'];
const S = ['Pessimistic', 'Median', 'Optimistic'];

// ---- normal distribution (Hart/West 2005 CDF, ~1e-14; inverse = Acklam + 2 Halley steps) ----
export function normCdf(x) {
  const a = Math.abs(x); let c;
  if (a > 37) c = 0;
  else {
    const e = Math.exp(-a * a / 2);
    if (a < 7.07106781186547) {
      let b = 3.52624965998911e-02 * a + 0.700383064443688;
      b = b * a + 6.37396220353165; b = b * a + 33.912866078383; b = b * a + 112.079291497871; b = b * a + 221.213596169931; b = b * a + 220.206867912376;
      c = e * b;
      b = 8.83883476483184e-02 * a + 1.75566716318264;
      b = b * a + 16.064177579207; b = b * a + 86.7807322029461; b = b * a + 296.564248779674; b = b * a + 637.333633378831; b = b * a + 793.826512519948; b = b * a + 440.413735824752;
      c = c / b;
    } else {
      let b = a + 0.65; b = a + 4 / b; b = a + 3 / b; b = a + 2 / b; b = a + 1 / b; c = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}
export function normInv(p) {
  if (!(p > 0 && p < 1)) throw new Error('normInv domain');
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pl = 0.02425; let x, q, r;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else { q = p - 0.5; r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  for (let it = 0; it < 2; it++) { const e = normCdf(x) - p; const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2); x = x - u / (1 + x * u / 2); }
  return x;
}
const ncdf = (x, m, s) => normCdf((x - m) / s);

// ---- parameters ----
// defaults(D, s): the sheet's preset for scenario s (0 Pessimistic, 1 Median, 2 Optimistic)
export function defaults(D, s = 1) {
  const L = D.levers, sc = D.scalars, pick = k => L[k][s];
  let atRisk = 0; for (const c of D.countries) atRisk += c.pop * 1e6 * c.zn;
  const recal = Math.min(1, 1.5e9 / atRisk); // Inputs!B48
  return {
    scenario: S[s],
    zn_boost: pick('zn_boost'), fe_boost: pick('fe_boost'), prot_boost: pick('prot_boost'),
    gap_zn: 0.5, gap_fe: 0.25, gap_prot: 0.5, lab_field: 0.6,          // effectiveness = boost × gap ratio × lab→field
    tiers: Object.fromEntries(Object.entries(D.tiers).map(([t, v]) => [t, v[s]])),
    ceil: pick('ceil'), yrs: pick('yrs'), speed: pick('speed'), skew: pick('skew'), zmult: pick('zmult'),
    growth: pick('growth'), sec_stunt: pick('sec_stunt'), sec_micro: pick('sec_micro'),
    fib_delta: pick('fib_delta'), fib_rr: pick('fib_rr'), fib_ax: pick('fib_ax'), fib_adequate: pick('fib_adequate'),
    zn_daly: 0.02 * recal, fe_daly: 0.025 / 3, prot_daly: sc.prot_daly, stunt_daly: sc.stunt_daly,
    base_cov: sc.base_cov, disc: sc.disc, att: sc.att, stunt_inc: sc.stunt_inc,
    ret_zn: sc.ret_zn.slice(), ret_fe: sc.ret_fe.slice(), tmrel: sc.tmrel, daly_gdp_mult: sc.daly_gdp_mult,
    stunting_method: 'haz', // 'haz' (HAZ shift, Katie W) | 'rate' (growth rate used directly)
    nutrients: { zn: true, fe: true, prot: true, stunt: true, fiber: true },
    crops: [true, true, true],
    fixes: { fiber_gap: false },  // Q2: true uses the active fiber-adequacy lever instead of the Pessimistic cell
    extras: {},                   // { id: { boost, gap, daly, prevKey, group, ret: [m,r,w] } } (extension)
    phytate: 0,                   // extension: share of the maximum phytate cut (edit knockouts); raises bioavailable Zn/Fe
    phyt_gain: { zn: 0.25, fe: 0.15 }, // absorption gain at the full cut (adult lpa trials far larger; Guatemalan child trial null: shrunk)
    cost_mult: 1,
    // ---- red-team levers (2026-11-23). Defaults reproduce the sheet exactly. ----
    p_success: [1, 1, 1],         // probability the edits work in maize / rice / wheat (1 = results conditional on success)
    qpm_ref: null,                // stunting dose: growth × min(1, prot_boost × lab_field / qpm_ref); null = sheet (full QPM effect)
    qpm_transfer: [1, 1, 1],      // share of the maize QPM growth evidence that carries to each crop
    crop_lag: [0, 0, 0],          // years from a country's approval to plantable edited seed, per crop
    horizon: 2050,                // last year counted (secular decline continues; costs continue at the 2050 rate)
    advocacy: true                // $1M/yr advocacy (2028 on) in costs; it does not move approval years in the model
  };
}
export const yearsTo = h => Array.from({ length: Math.max(1, h - 2029) }, (_, k) => 2030 + k);

// Katie Stunting tab: relative fall in stunting prevalence (W) and mortality DALYs per protected child (V)
export function katie(D, P, growth = P.growth) {
  const K = D.katie, sig = K.B9, dHAZ = K.B6 * growth * K.B7 / K.B8, rr = [1, K.B10, K.B11, K.B12];
  return D.countries.map(c => {
    let F; try { F = -2 - sig * normInv(c.stunt); } catch (e) { F = 0; }
    const H = F + dHAZ;
    const bins = m => [1 - ncdf(-1, m, sig), ncdf(-1, m, sig) - ncdf(-2, m, sig), ncdf(-2, m, sig) - ncdf(-3, m, sig), ncdf(-3, m, sig)];
    const b0 = bins(F), b1 = bins(H);
    const M = b0.reduce((s, v, j) => s + v * rr[j], 0), R = b1.reduce((s, v, j) => s + v * rr[j], 0);
    const [u5, le] = D.katie_regions[c.region];
    const V = (u5 * K.B14 / 1000) * (M === 0 ? 0 : 1 - R / M) * (le - K.B13);
    const W = b0[2] + b0[3] === 0 ? 0 : 1 - (b1[2] + b1[3]) / (b0[2] + b0[3]);
    return { W, V, dHAZ };
  });
}

// ---- main ----
export function run(D, P) {
  const YEARS = yearsTo(P.horizon || 2050);
  const N = D.countries.length;
  const ph = P.phytate || 0;
  const bZn = (1 + P.zn_boost) * (1 + P.phyt_gain.zn * ph) - 1, bFe = (1 + P.fe_boost) * (1 + P.phyt_gain.fe * ph) - 1; // bioavailable boost
  const effZn = bZn * P.gap_zn * P.lab_field, effFe = bFe * P.gap_fe * P.lab_field, effP = P.prot_boost * P.gap_prot * P.lab_field;
  const gap = 1 - P.base_cov;
  const kt = katie(D, P);
  // stunting growth effect per crop: dose (edit size vs QPM) × transferability of the maize QPM evidence
  const dose = P.qpm_ref ? Math.min(1, P.prot_boost * P.lab_field / P.qpm_ref) : 1;
  const gC = [0, 1, 2].map(ci => P.growth * dose * (P.qpm_transfer ? P.qpm_transfer[ci] : 1));
  const ktC = gC.map(g => (g === P.growth ? kt : katie(D, P, g)));
  const pS = P.p_success || [1, 1, 1], lag = P.crop_lag || [0, 0, 0];
  const fibGap = P.fixes.fiber_gap ? 1 - P.fib_adequate : 1 - D.scalars.fib_gap_cell; // Q2
  const extras = Object.entries(P.extras || {}).filter(([, x]) => x && x.boost > 0);
  const keys = ['zn', 'fe', 'prot', 'stunt', 'fiber', ...extras.map(([id]) => id)];
  const crop = YEARS.map(() => [0, 0, 0]), byNut = YEARS.map(() => Object.fromEntries(keys.map(k => [k, 0])));
  const cap = YEARS.map(() => 0), reached = YEARS.map(() => 0);
  const country = D.countries.map(() => ({ total: 0, crop: [0, 0, 0], nut: Object.fromEntries(keys.map(k => [k, 0])) }));
  const approval = D.countries.map(c => Math.max(2030, P.tiers[c.tier]));
  // fiber per-capita DALY rate at full adoption (Countries AL..AU)
  const fib = D.countries.map(c => {
    const [x0, rate] = D.fiber_regions[c.region]; const x1 = Math.min(P.tmrel, x0 + P.fib_delta * c.share[2]);
    const rr0 = Math.pow(P.fib_rr, (x0 - P.tmrel) / 7), rr1 = Math.pow(P.fib_rr, (x1 - P.tmrel) / 7);
    const paf0 = (rr0 - 1) / rr0, paf1 = (rr1 - 1) / rr1;
    return rate * (paf0 <= 0 ? 0 : (paf0 - paf1) / paf0) * P.fib_ax;
  });
  const vrOf = (ci, i, y) => {
    const A = approval[i] + (approval[i] < 2100 ? lag[ci] : 0); if (y < A || (P.crops && !P.crops[ci])) return 0;
    const n = y - A + 1, cu = D.countries[i].curt[ci];
    const v = cu ? Math.min(P.ceil, P.zmult * cu[0] / 100, (cu[1] / 100) * P.speed * n) : Math.min(P.ceil, (P.ceil / P.yrs) * P.speed * n);
    return v * P.skew;
  };
  const VR = YEARS.map(y => [0, 1, 2].map(ci => D.countries.map((_, i) => vrOf(ci, i, y))));
  YEARS.forEach((y, k) => {
    const secS = Math.pow(1 - P.sec_stunt, k), secM = Math.pow(1 - P.sec_micro, k);
    for (let i = 0; i < N; i++) {
      const c = D.countries[i], pop = c.pop * 1e6, pop5 = c.pop5 * 1e6;
      const sums = { zn: 0, fe: 0, prot: 0 };
      let reach = 0;
      for (let ci = 0; ci < 3; ci++) {
        const vr = VR[k][ci][i]; if (!vr) continue;
        const sh = c.share[ci], base = vr * gap;
        reach += sh * vr;
        const add = (key, v0) => { const v = v0 * pS[ci]; if (!v) return; crop[k][ci] += v; byNut[k][key] += v; country[i].crop[ci] += v; country[i].nut[key] += v; country[i].total += v; };
        const zn = P.nutrients.zn ? secM * pop * sh * c.zn * P.zn_daly * effZn * P.ret_zn[ci] * base : 0;
        const fe = P.nutrients.fe ? secM * pop * sh * c.fe * P.fe_daly * effFe * P.ret_fe[ci] * base : 0;
        const pw = P.nutrients.prot ? secS * pop * sh * c.stunt * P.prot_daly * effP * base : 0;
        const st = P.nutrients.stunt ? secS * pop5 * sh * c.stunt * P.stunt_inc * P.stunt_daly * (P.stunting_method === 'haz' ? ktC[ci][i].W : gC[ci]) * base : 0;
        add('zn', zn); add('fe', fe); add('prot', pw); add('stunt', st);
        sums.zn += zn * pS[ci]; sums.fe += fe * pS[ci]; sums.prot += pw * pS[ci];
        for (const [id, x] of extras) {
          const pv = c.pas && c.pas[x.prevKey] ? c.pas[x.prevKey][x.group || 'all'] : null;
          if (pv == null || (x.routeCrops && !x.routeCrops[ci])) continue;
          const grp = x.group === 'u5' ? pop5 : x.group === 'w' ? pop * (x.wshare || 0.25) : pop;
          add(id, secM * grp * sh * pv * x.daly * (x.fort ?? 1) * (x.boost * x.gap * P.lab_field) * (x.ret ? x.ret[ci] : 1) * base);
        }
        if (ci === 2 && P.nutrients.fiber) add('fiber', pop * fib[i] * vr * fibGap);
      }
      reached[k] += pop * gap * reach;
      // cross-crop cap (Q10): combined gap closure > 1 is capped
      const g = c.share[0] * VR[k][0][i] + c.share[1] * VR[k][1][i] + c.share[2] * VR[k][2][i];
      for (const [key, eff] of [['zn', effZn], ['fe', effFe], ['prot', effP]]) {
        const gg = eff * g; cap[k] += sums[key] * (1 - (gg === 0 ? 1 : Math.min(1, gg) / gg));
      }
    }
  });
  // headline rows (× attribution), discounting, value, costs
  const att = P.att;
  const rows = YEARS.map((y, k) => {
    const cr = crop[k].map(v => v * att);
    return { year: y, maize: cr[0], rice: cr[1], wheat: cr[2], total: cr[0] + cr[1] + cr[2] - cap[k] * att, df: 1 / Math.pow(1 + P.disc, y - 2026) };
  });
  const sum = f => rows.reduce((s, r) => s + f(r), 0);
  const totals = { maize: sum(r => r.maize), rice: sum(r => r.rice), wheat: sum(r => r.wheat), total: sum(r => r.total), disc: sum(r => r.total * r.df) };
  // value per DALY: crop-level DALY-weighted GDP per capita (pre-attribution lifetime sums), × multiple
  const gdpW = [0, 1, 2].map(ci => { let a = 0, b = 0; for (let i = 0; i < N; i++) { a += country[i].crop[ci] * D.countries[i].gdp; b += country[i].crop[ci]; } return b ? a / b : 0; });
  const vpd = gdpW.map(g => g * P.daly_gdp_mult);
  totals.value = sum(r => r.maize * vpd[0] + r.rice * vpd[1] + r.wheat * vpd[2]);
  totals.value_disc = sum(r => (r.maize * vpd[0] + r.rice * vpd[1] + r.wheat * vpd[2]) * r.df);
  // costs 2026..horizon: the sheet's grid, held at the 2050 rate beyond 2050; advocacy ($1M/yr from 2028) optional
  const cy = Array.from({ length: Math.max(25, (P.horizon || 2050) - 2025) }, (_, j) => 2026 + j);
  const cyc = cy.map((y, j) => (j < D.costs.total.length ? D.costs.total[j] : D.costs.total[D.costs.total.length - 1]) - (P.advocacy === false && y >= 2028 ? 1e6 : 0));
  const cost = cyc.reduce((s, v) => s + v, 0) * P.cost_mult + D.costs.extra_2027_29 * P.cost_mult;
  const costDisc = cyc.reduce((s, v, j) => s + v / Math.pow(1 + P.disc, j), 0) * P.cost_mult + D.costs.extra_2027_29 * P.cost_mult / Math.pow(1 + P.disc, 1.5);
  totals.cost = cost; totals.cost_disc = costDisc;
  totals.per_daly = totals.total > 0 ? cost / totals.total : null;
  totals.per_daly_disc = totals.disc > 0 ? costDisc / totals.disc : null;
  const nutTotals = Object.fromEntries(keys.map(key => [key, byNut.reduce((s, r) => s + r[key], 0) * att]));
  return { rows, totals, byNut: byNut.map(r => Object.fromEntries(Object.entries(r).map(([k2, v]) => [k2, v * att]))), nutTotals,
    country: country.map((c, i) => ({ ...c, total: c.total * att, crop: c.crop.map(v => v * att), nut: Object.fromEntries(Object.entries(c.nut).map(([k2, v]) => [k2, v * att])),
      name: D.countries[i].name, iso3: D.countries[i].iso3, approval: approval[i], region: D.countries[i].region })),
    reached: YEARS.map((y, k) => ({ year: y, people: reached[k] })), approval, vpd, katie: kt, keys, years: YEARS, dose, gC };
}
