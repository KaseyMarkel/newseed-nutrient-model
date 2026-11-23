// Impact comparison shared by Compare and the Scenario Lab preview.
// For each headline KPI at one share of maize land it shows three worlds side by side:
//   none     = no biofortified seed (0% of maize land; the same for both seeds)
//   baseline = the baseline seed at the chosen share, and its impact versus none
//   custom   = the new seed / scenario at the same share, and its impact versus none
// and the change in impact (custom impact minus baseline impact, and as % of the
// baseline impact). "pp" is used for differences of percentages; "%" only for
// relative changes.
import { h } from './ui.js';
import { display, fmtRel } from './units.js';

export const perCase = n => (n && n.n_stunting_averted > 0.5 ? n.newseed_subsidy_total / n.n_stunting_averted : null);

// kind: 'reduce' = lower is the benefit (impact = none - level, shown as a fall);
//       'gain'   = higher is the benefit (impact = level - none);
//       'cost'   = a cost (impact = level - none; up is bad);
//       'ratio'  = cost per unit, no "none" value (change = custom - baseline; down is good).
export const IMPACT_ROWS = [
  { id: 'stunting', label: 'Stunting prevalence', key: 'stunting_pct', kind: 'reduce', decimals: 2, ppDecimals: 2,
    help: 'Share of children aged 6-59 months with height-for-age below -2 SD.' },
  { id: 'cases', label: 'Stunting cases averted', key: 'n_stunting_averted', kind: 'gain', levelIsImpact: true,
    help: 'Children who move from stunted to not stunted (cross HAZ = -2).' },
  { id: 'children', label: 'Children reached', key: 'n_children_biofortified', kind: 'gain', levelIsImpact: true,
    sub: n => n && n.n_children > 0 ? `${(n.n_children_biofortified / n.n_children * 100).toFixed(1)}% of children 6-59 mo` : '',
    help: 'Children aged 6-59 months who eat biofortified maize.' },
  { id: 'haz', label: 'Mean height-for-age (HAZ)', key: 'mean_zlen', kind: 'gain', decimals: 3, impactName: 'mean HAZ gain per child',
    help: 'Mean height-for-age z-score of all children 6-59 months; the gain is the average change per child.' },
  { id: 'coverage', label: 'Share of maize eaten that is biofortified', key: 'coverage_pct', kind: 'gain', decimals: 1, levelIsImpact: true },
  { id: 'farmers', label: 'Adopting farmers', key: 'n_farmers_bio', kind: 'gain', levelIsImpact: true },
  { id: 'area', label: 'Biofortified area', key: 'land_bio_ha', kind: 'gain', levelIsImpact: true },
  { id: 'income', label: 'Farmer income gain per year', key: 'income_increment_total', kind: 'gain', compact: true, levelIsImpact: true },
  { id: 'income_adopter', label: 'Income gain per adopting farmer per year', key: 'income_per_farmer_adopter', kind: 'gain', levelIsImpact: true, noNone: true },
  { id: 'subsidy', label: 'New Seed subsidy cost per year', key: 'newseed_subsidy_total', kind: 'cost', compact: true, levelIsImpact: true },
  { id: 'per_case', label: 'Subsidy per stunting case averted', key: 'newseed_subsidy_total', kind: 'ratio', value: perCase }
];

const valueOf = (row, n) => {
  if (!n) return null;
  const v = row.value ? row.value(n) : n[row.key];
  return v == null || !Number.isFinite(v) ? null : v;
};

// Impact of one world versus its own "none" world, signed so that positive = benefit
// (for 'cost' positive = more cost).
function impactOf(row, n, none) {
  const v = valueOf(row, n);
  if (v == null) return null;
  if (row.kind === 'ratio') return v;
  const z = row.noNone ? 0 : (valueOf(row, none) ?? 0);
  return row.kind === 'reduce' ? z - v : v - z;
}

export function computeImpact(row, none, b, c, noneC) {
  const nv = row.kind === 'ratio' || row.noNone ? null : valueOf(row, none);
  const bv = valueOf(row, b), cv = valueOf(row, c);
  const bi = impactOf(row, b, none), ci = impactOf(row, c, noneC || none);
  const d = bi == null || ci == null ? null : ci - bi;
  // tone of the change: good when the benefit grows or the cost falls
  let tone = 'zero';
  if (d != null && Math.abs(d) > 1e-9 * Math.max(1, Math.abs(bi))) {
    const up = d > 0;
    tone = (row.kind === 'cost' || row.kind === 'ratio') ? (up ? 'bad' : 'good') : (up ? 'good' : 'bad');
  }
  return { nv, bv, cv, bi, ci, d, tone, rel: fmtRel(d, bi) };
}

// ---- text helpers ----
export function levelText(row, v, units) {
  if (v == null) return '–';
  return display(row.key, v, units, { compact: row.compact, decimals: row.decimals }).text;
}
// Impact versus none, written as a change of the level (a fall in stunting shows as -4.31 pp).
export function impactVsNoneText(row, impact, units) {
  if (impact == null) return '';
  const levelChange = row.kind === 'reduce' ? -impact : impact;
  return display(row.key, levelChange, units, { signed: true, delta: true, compact: row.compact, decimals: row.ppDecimals ?? row.decimals }).text;
}
export function changeText(row, d, units) {
  if (d == null) return '–';
  // For 'reduce' rows the change in impact is in "size of the fall": +0.40 pp = a 0.40 pp larger fall.
  return display(row.key, d, units, { signed: true, delta: true, compact: row.compact, decimals: row.ppDecimals ?? (row.kind === 'reduce' ? 2 : row.decimals) }).text;
}
export function changeWords(row, d) {
  if (d == null || d === 0) return 'no change';
  const up = d > 0;
  switch (row.kind) {
    case 'reduce': return up ? 'larger fall' : 'smaller fall';
    case 'cost': return up ? 'more cost' : 'less cost';
    case 'ratio': return up ? 'more per case' : 'less per case';
    default: return up ? 'more' : 'less';
  }
}

// ---- side names ----
// Seeds can share a label (e.g. two custom seeds called "2030 Seed", or the same seed with two
// subsidies); add what differs so the reader never confuses the two columns.
export function sideNames(base, cust) {
  let b = base.seed.label, c = cust.seed.label;
  if (b === c || base.subsidy.id !== cust.subsidy.id) {
    if (base.subsidy.id !== cust.subsidy.id) { b += ` (${base.subsidy.label.toLowerCase()})`; c += ` (${cust.subsidy.label.toLowerCase()})`; }
  }
  if (b === c && cust.params && Object.keys(cust.params).length) c += ' + parameter changes';
  if (b === c) { b += ' (baseline)'; c += ' (custom)'; }
  return { b, c };
}

// ---- headline sentence (stunting first, then money) ----
// noneC: the custom scenario's own 0% world when its parameter overrides change it (as the table).
export function headlineSentences(none, b, c, names, pen, units, noneC) {
  const R = Object.fromEntries(IMPACT_ROWS.map(r => [r.id, r]));
  const st = computeImpact(R.stunting, none, b, c, noneC);
  const cs = computeImpact(R.cases, none, b, c, noneC);
  const ch = computeImpact(R.children, none, b, c, noneC);
  const inc = computeImpact(R.income, none, b, c, noneC);
  const sub = computeImpact(R.subsidy, none, b, c, noneC);
  const pc = computeImpact(R.per_case, none, b, c, noneC);
  const pct = v => display('stunting_pct', v, units, { decimals: 1 }).text;
  const pp = v => display('stunting_pct', Math.abs(v), units, { delta: true, decimals: 2 }).text;
  const n = v => display('n_stunting_averted', v, units).text;
  const money = (v, signed) => display('income_increment_total', v, units, { compact: true, signed }).text;
  const out = [];
  if (pen === 0) {
    out.push(`At 0% of maize land no biofortified seed is planted, so both scenarios equal the world without it: stunting ${pct(st.nv)}.`);
    return out;
  }
  const fall = (imp) => imp > 0.0005 ? `falls from ${pct(st.nv)} to` : imp < -0.0005 ? `rises from ${pct(st.nv)} to` : `stays at`;
  out.push(`With ${names.b} on ${pen}% of maize land, stunting ${fall(st.bi)} ${pct(st.bv)} (${pp(st.bi)}; ${n(cs.bv)} cases averted).`);
  const ownNone = noneC && Math.abs((noneC.stunting_pct ?? st.nv) - st.nv) > 1e-9 ? ` from its own ${pct(noneC.stunting_pct)} without biofortified seed` : '';
  out.push(`With ${names.c} it ${st.ci > 0.0005 ? 'falls' + (ownNone || '') + ' to' : st.ci < -0.0005 ? 'rises' + (ownNone || '') + ' to' : 'stays at'} ${pct(st.cv)} (${pp(st.ci)}; ${n(cs.cv)} cases averted).`);
  if (Math.abs(st.d) < 0.0005) {
    const moreKids = ch.d > 0.5 ? ` even though it reaches ${n(ch.d)} more children (see "Why cases averted move in steps" below)` : '';
    out.push(`The ${names.word || 'new scenario'} leaves the stunting impact unchanged${moreKids}.`);
  } else {
    out.push(`The ${names.word || 'new scenario'} ${st.d > 0 ? 'raises' : 'lowers'} the stunting impact by ${pp(st.d)}${st.rel ? ` (${st.rel} relative to the baseline's ${pp(st.bi)})` : ''}.`);
  }
  const subD = display('newseed_subsidy_total', sub.d, units, { signed: true, compact: true }).text;
  const subTxt = Math.abs(sub.d) < 0.5 ? `New Seed's subsidy cost is unchanged at ${money(sub.cv)}`
    : money(sub.bv) === money(sub.cv) ? `New Seed's subsidy cost is almost unchanged at ${money(sub.cv)} (${subD})`
    : `New Seed's subsidy cost goes from ${money(sub.bv)} to ${money(sub.cv)} (${subD})`;
  const pcTxt = pc.bv != null && pc.cv != null ? `; subsidy per case averted ${pc.d < 0 ? 'falls' : pc.d > 0 ? 'rises' : 'stays'} ${pc.d === 0 ? 'at' : 'from'} ${money(pc.bv)}${pc.d === 0 ? '' : ` to ${money(pc.cv)}`}` : '';
  out.push(`Farmer income gain goes from ${money(inc.bv)} to ${money(inc.cv)} a year (${money(inc.d, true)}${inc.rel ? `, ${inc.rel}` : ''}). ${subTxt}${pcTxt}.`);
  return out;
}

// ---- the side-by-side table (cards at phone width, see .impact in app.css) ----
export function impactTable(none, b, c, opts) {
  const { units, names, pen, rows = IMPACT_ROWS, noneC } = opts;
  const head = h('thead', {}, h('tr', {},
    h('th', { scope: 'col' }, 'Measure'),
    h('th', { scope: 'col' }, 'No biofortified seed', h('span', { class: 'u' }, '0% of maize land, same for both')),
    h('th', { scope: 'col' }, h('span', { class: 'sw base' }), names.b, h('span', { class: 'u' }, `${pen}% of maize land · level and impact vs none`)),
    h('th', { scope: 'col' }, h('span', { class: 'sw cust' }), names.c, h('span', { class: 'u' }, `${pen}% of maize land · level and impact vs none`)),
    h('th', { scope: 'col' }, 'Change in impact', h('span', { class: 'u' }, 'new minus baseline (as % of baseline impact)'))));
  const body = h('tbody', {}, rows.map(row => {
    const r = computeImpact(row, none, b, c, noneC);
    const cell = (label, main, sub, cls) => h('td', { 'data-label': label, class: cls || '' }, h('b', {}, main), sub ? h('small', {}, sub) : null);
    const vsNone = imp => (row.levelIsImpact || row.kind === 'ratio' || imp == null) ? '' : `${impactVsNoneText(row, imp, units)} vs none`;
    const subB = [vsNone(r.bi), row.sub ? row.sub(b) : ''].filter(Boolean).join(' · ');
    const subC = [vsNone(r.ci), row.sub ? row.sub(c) : ''].filter(Boolean).join(' · ');
    const chMain = changeText(row, r.d, units);
    const chSub = r.d == null ? '' : [r.rel, row.kind === 'reduce' || row.id === 'haz' ? (row.kind === 'reduce' ? changeWords(row, r.d) : 'gain per child') : ''].filter(Boolean).join(' · ');
    return h('tr', { 'data-row': row.id },
      h('th', { scope: 'row', title: row.help || '' }, row.impactName ? [row.label, h('small', {}, 'impact = ' + row.impactName)] : row.label),
      cell('No biofortified seed', row.kind === 'ratio' || row.noNone ? '–' : levelText(row, r.nv, units), ''),
      cell(names.b, levelText(row, r.bv, units), subB),
      cell(names.c, levelText(row, r.cv, units), subC),
      cell('Change in impact', chMain, chSub, 'chg ' + r.tone));
  }));
  return h('div', { class: 'impact-wrap' }, h('table', { class: 'impact' }, head, body));
}

// Is the "none" world the same for both sides? (parameter overrides such as consumption
// or nutrient factors can change it). Returns a list of differing labels.
export function noneDiffers(noneB, noneC) {
  const keys = [['stunting_pct', 'stunting'], ['mean_zlen', 'mean HAZ'], ['n_children', 'children'], ['n_stunted_baseline', 'stunted children']];
  return keys.filter(([k]) => noneB && noneC && Number.isFinite(noneB[k]) && Math.abs((noneB[k] - noneC[k])) > 1e-9 * Math.max(1, Math.abs(noneB[k]))).map(([, l]) => l);
}

// Why cases averted move in steps. `ex` is an optional example {pen, children, cases} found in the curve.
export function stepsNote(ex, names) {
  const exTxt = ex ? ` For example, at ${ex.pen}% of maize land ${names.c} reaches ${display('n_children_biofortified', ex.children).text} more children than ${names.b} but averts ${ex.sameCases ? `the same ${display('n_stunting_averted', ex.cases).text} cases` : `only ${display('n_stunting_averted', ex.dCases, undefined, { signed: true }).text} cases`}.` : '';
  return h('div', { class: 'note steps' }, h('strong', {}, 'Why cases averted move in steps. '),
    'Azahar’s model represents the 1.5 million children aged 6-59 months with about 4,000 survey profiles, each standing for a few hundred children. ',
    'A child counts as a stunting case averted only when its height-for-age z-score (HAZ) crosses -2. ',
    'A better seed reaches more children at every share of maize land and raises their HAZ, but at some shares none of the newly reached profiles crosses the line, so cases averted do not move, and at the next share several profiles cross at once.',
    exTxt, ' ', h('em', {}, 'Children reached'), ' and ', h('em', {}, 'mean HAZ gain'), ' move smoothly; read them next to cases averted.');
}

// Find a share where the custom side reaches more children but averts the same (or fewer) cases.
export function findStepExample(pens, bCurve, cCurve) {
  for (let i = 0; i < pens.length; i++) {
    const bn = bCurve[i].national, cn = cCurve[i].national;
    const dCh = cn.n_children_biofortified - bn.n_children_biofortified;
    const dCases = cn.n_stunting_averted - bn.n_stunting_averted;
    if (pens[i] > 0 && dCh > 1000 && dCases < 0.5) return { pen: pens[i], children: dCh, cases: cn.n_stunting_averted, dCases, sameCases: Math.abs(dCases) < 0.5 };
  }
  return null;
}
