// Global nutrient model page: New Seed's gene-editing mainstreaming BOTEC (v1.4) in the browser,
// with every input as a control, plus extra nutrients (global_nutrients.js).
import { run, defaults, CROPS } from './global_engine.js';
import { REDTEAM } from './global_redteam.js';
import { runMC, RT_DISTS } from './global_mc.js';
import { GLOBAL_EXTRAS, ZINC_ANCHORS } from './global_nutrients.js';
import { h, renderHeader, renderFooter, card, accordion, setupDrawer, controlsButton } from './ui.js';
import { fmtNum, fmtCompact } from './units.js';

const KEY = 'nsg.state.v1';
const CFG = { displayModeBar: false, responsive: true };
const FONT = { family: 'Segoe UI, system-ui, sans-serif', size: 12, color: '#262321' };
const CROP_COLOR = ['#c9963b', '#4f8a5b', '#8e3129'];
const NUT = { zn: ['Zinc', '#2f5f8f'], fe: ['Iron', '#8e3129'], prot: ['Protein quality (all ages)', '#c9963b'], stunt: ['Stunting (protein, under-5)', '#2e7d4f'], fiber: ['Fiber → heart disease', '#7a4f9e'] };
for (const x of GLOBAL_EXTRAS) NUT[x.id] = [x.label, x.color];
const SHEET_MEDIAN = 7009199.90781109;

let D, st, out, ui = {}, mc = null, mcBusy = false;
const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') return s; } catch (e) { /* none */ } return null; };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };

// ---- parameters: scenario preset + overrides (dot paths) ----
function params() {
  const P = defaults(D, st.s);
  if (st.rt) for (const l of REDTEAM.levers) l.apply(P, D);
  for (const [path, v] of Object.entries(st.ov || {})) {
    const ks = path.split('.'); let o = P;
    for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = v;
  }
  P.extras = {};
  for (const x of GLOBAL_EXTRAS) {
    const b = (st.extras || {})[x.id] || 0;
    if (b > 0) P.extras[x.id] = { boost: b / 100, gap: x.gap, daly: x.daly, prevKey: x.prevKey, group: x.group, ret: x.ret, wshare: x.wshare, routeCrops: x.routeCrops, fort: x.fort };
  }
  return P;
}
const get = (P, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), P);
function setOv(path, v) { st.ov = { ...(st.ov || {}), [path]: v }; save(); refresh(); }
const isPristine = () => !st.rt && !Object.keys(st.ov || {}).length && !Object.values(st.extras || {}).some(v => v > 0);

// ---- sidebar ----
function slider(P, label, path, min, max, step, fmt, hint) {
  const v = get(P, path);
  const chip = h('span', { class: 'boost-val' }, fmt(v));
  const inp = h('input', { type: 'range', class: 'boost', id: 'g-' + path.replace(/\W/g, '-'), min, max, step, value: v, 'aria-label': label });
  inp.addEventListener('input', () => { chip.textContent = fmt(+inp.value); });
  inp.addEventListener('change', () => setOv(path, +inp.value));
  const changed = st.ov && path in st.ov;
  return h('div', { class: 'boost-row' + (changed ? ' changed' : '') },
    h('div', { class: 'boost-head' }, h('span', { class: 'boost-name' }, label), chip), inp, hint ? h('div', { class: 'boost-hint' }, hint) : null);
}
const pct = v => Math.round(v * 100) + '%';
const pct1 = v => (v * 100).toFixed(1) + '%';
const num = d => v => (+v).toFixed(d);
const yr = v => (v >= 2100 ? 'never' : String(v));

function extraRow(x) {
  const v = (st.extras || {})[x.id] || 0;
  const chip = h('span', { class: 'boost-val' }, v + '%');
  const inp = h('input', { type: 'range', class: 'boost', id: 'gx-' + x.id, min: 0, max: 100, step: 5, value: v, style: { '--c': x.color } });
  inp.addEventListener('input', () => { chip.textContent = inp.value + '%'; });
  inp.addEventListener('change', () => { st.extras = { ...(st.extras || {}), [x.id]: +inp.value }; save(); refresh(); });
  return h('div', { class: 'boost-row' },
    h('div', { class: 'boost-head' }, h('span', { class: 'boost-name' }, h('i', { style: { background: x.color } }), x.label), chip), inp,
    h('div', { class: 'boost-hint' }, x.unit),
    h('div', { class: 'boost-flag ' + (x.flagKind === 'route' ? 'fl-route' : x.flagKind === 'gt' ? 'fl-gt' : 'fl-spec') }, x.flag));
}

function zincAnchor(P) {
  const recal = defaults(D, st.s).zn_daly / 0.02;
  const cur = ZINC_ANCHORS.find(a => Math.abs(0.02 * a.dalys / 28e6 * recal - P.zn_daly) < 1e-12);
  const sel = h('select', { id: 'g-znanchor' }, [...ZINC_ANCHORS.map(a => h('option', { value: a.id, selected: cur && cur.id === a.id ? true : null }, a.label)),
    h('option', { value: 'custom', selected: cur ? null : true, disabled: true }, 'Custom value')]);
  sel.addEventListener('change', () => { const a = ZINC_ANCHORS.find(x => x.id === sel.value); if (a) setOv('zn_daly', 0.02 * a.dalys / 28e6 * recal); });
  return sel;
}

function redteamControls(P) {
  const qOn = h('input', { type: 'checkbox', id: 'g-qpmon', checked: P.qpm_ref ? true : null });
  qOn.addEventListener('change', () => setOv('qpm_ref', qOn.checked ? 0.8 : null));
  const adv = h('input', { type: 'checkbox', id: 'g-adv', checked: P.advocacy !== false ? true : null });
  adv.addEventListener('change', () => setOv('advocacy', adv.checked));
  const yrs = v => (+v === 0 ? '0 y' : '+' + v + ' y');
  return [
    h('div', { class: 'boost-gnote' }, 'Defaults reproduce the sheet. The “Red-team central” preset sets the reviewers’ central values.'),
    h('div', { class: 'lbl' }, 'Probability the edits work'),
    ...CROPS.map((c, i) => slider(P, c[0].toUpperCase() + c.slice(1), 'p_success.' + i, 0, 1, 0.05, pct, i === 0 ? '1 = results conditional on success. Note: 2–20% of genes expected usable.' : null)),
    h('label', { class: 'switch' }, qOn, h('span', {}, 'Scale stunting by edit size (sheet applies the full QPM effect)')),
    P.qpm_ref ? slider(P, 'Lysine gain of the reference QPM', 'qpm_ref', 0.3, 1.5, 0.05, pct, 'Effect = growth × min(1, protein boost × lab→field ÷ this). QPM roughly doubles lysine.') : null,
    slider(P, 'QPM evidence transfer: rice', 'qpm_transfer.1', 0, 1, 0.05, pct, 'Rice protein is far less lysine-limited than maize'),
    slider(P, 'QPM evidence transfer: wheat', 'qpm_transfer.2', 0, 1, 0.05, pct, 'Wheat is lysine-limited like maize'),
    h('div', { class: 'lbl' }, 'Seed lag after approval'),
    ...CROPS.map((c, i) => slider(P, c[0].toUpperCase() + c.slice(1), 'crop_lag.' + i, 0, 10, 1, yrs, null)),
    slider(P, 'Last year counted', 'horizon', 2040, 2080, 1, v => String(v), 'Sheet: 2050. Later years keep the secular decline; costs continue at the 2050 rate.'),
    h('label', { class: 'switch' }, adv, h('span', {}, 'Include $1M/yr advocacy in costs (it moves no approval year in the model)'))
  ].filter(Boolean);
}

function structureControls(P) {
  const sw = (id, path, label) => { const i = h('input', { type: 'checkbox', id, checked: get(P, path) ? true : null }); i.addEventListener('change', () => setOv(path, i.checked)); return h('label', { class: 'switch' }, i, h('span', {}, label)); };
  const bm = h('input', { type: 'checkbox', id: 'g-basec', checked: P.base_mode === 'country' ? true : null });
  bm.addEventListener('change', () => setOv('base_mode', bm.checked ? 'country' : 'flat'));
  return [
    h('div', { class: 'boost-gnote' }, 'New in v1.5; all off reproduces the v1.4 sheet. “Red-team central” turns all three on.'),
    sw('g-popg', 'pop_growth', 'Population grows by year (UN WPP 2024 medium; sheet holds 2030 fixed)'),
    h('div', { class: 'boost-hint' }, 'Sub-Saharan Africa +46% 2030→2050, but India’s under-5s −14%: net ×1.01 at the Median.'),
    sw('g-dom', 'domestic', 'Credit only domestically grown grain (FAOSTAT 2022–24; imports go to feed first)'),
    h('div', { class: 'boost-hint' }, 'Edited CG varieties reach only what a country grows: wheat in Indonesia, Philippines, Nigeria, Kenya, Guatemala ≈ all imported.'),
    h('label', { class: 'switch' }, bm, h('span', {}, 'Already-biofortified counterfactual by country (instead of a flat ' + Math.round(P.base_cov * 100) + '%)')),
    P.base_mode === 'country' ? slider(P, 'Floor where no program is known', 'base_floor', 0, 0.2, 0.005, pct1, 'Research 2026-11-24: 2% (0.5–5%). Known programs: Pakistan wheat zinc 55%, India wheat zinc 50% / iron 25%, Bangladesh wheat 35%, Ghana maize QPM 10%, Ethiopia maize QPM 5%, Indonesia rice zinc 4%, Bangladesh rice zinc 3%.') : null
  ].filter(Boolean);
}

function buildSidebar() {
  const P = params();
  const sc = h('div', { class: 'boost-presets' }, ['Pessimistic', 'Median', 'Optimistic'].map((n, s) =>
    h('button', { class: 'btn small' + (st.s === s && isPristine() ? ' on' : ''), onClick: () => { st = { ...st, s, rt: false, ov: {}, extras: {} }; save(); refresh(); } }, n)),
    h('button', { class: 'btn small rt' + (st.rt && !Object.keys(st.ov || {}).length ? ' on' : ''), title: 'Sheet Median plus the red-team central adjustments (see “Red-team review”)',
      onClick: () => { st = { ...st, s: 1, rt: true, ov: {}, extras: {} }; save(); refresh(); } }, 'Red-team central'));
  const nCh = Object.keys(st.ov || {}).length + Object.values(st.extras || {}).filter(v => v > 0).length;
  const status = isPristine()
    ? h('div', { class: 'note info' }, `Sheet preset “${P.scenario}”. ${st.s === 1 ? 'Numbers match the v1.4 sheet exactly.' : ''}`)
    : h('div', { class: 'note' }, h('b', {}, st.rt ? 'Red-team central' : 'Custom'), nCh ? `: ${nCh} change(s) on top of “${P.scenario}”${st.rt ? ' + red-team' : ''}. ` : ': sheet Median plus the red-team adjustments. ',
      h('button', { class: 'btn small', onClick: () => { st.ov = {}; st.extras = {}; st.rt = false; save(); refresh(); } }, 'Reset'));
  const crops = h('div', { class: 'boost-presets' }, CROPS.map((c, i) => {
    const on = P.crops[i];
    return h('button', { class: 'btn small' + (on ? ' on' : ''), onClick: () => { const cr = P.crops.slice(); cr[i] = !on; setOv('crops', cr); } }, c[0].toUpperCase() + c.slice(1));
  }));
  const tierRows = Object.keys(D.tiers).map(t => slider(P, t, 'tiers.' + t, 2030, 2060, 1, yr));
  const extras = GLOBAL_EXTRAS.length ? accordion('More nutrients (exploratory)', 'seed', [
    h('div', { class: 'boost-gnote' }, 'Not in the sheet. Each uses Passarelli et al. 2024 country inadequacy and a central (unbiased) DALY estimate; the flag says whether an edit route exists.'),
    ...GLOBAL_EXTRAS.map(extraRow)], !!Object.values(st.extras || {}).some(v => v > 0)) : null;
  const method = h('select', { id: 'g-method' }, [['haz', 'HAZ shift (sheet default)'], ['rate', 'Growth rate (legacy)']].map(([v, l]) => h('option', { value: v, selected: P.stunting_method === v ? true : null }, l)));
  method.addEventListener('change', () => setOv('stunting_method', method.value));
  const fixQ2 = h('input', { type: 'checkbox', id: 'g-fixq2', checked: P.fixes.fiber_gap ? true : null });
  fixQ2.addEventListener('change', () => setOv('fixes', { ...P.fixes, fiber_gap: fixQ2.checked }));
  const nodes = [
    h('div', { class: 'sidebar-head' }, h('h2', {}, 'Global model'), h('button', { class: 'btn small drawer-close', onClick: () => document.querySelector('.sidebar')?.classList.remove('open') }, 'Close')),
    accordion('Scenario', 'slider', [sc, status, h('div', { class: 'lbl' }, 'Crops included'), crops], true),
    accordion('Nutrient boosts (bioavailable, vs conventional)', 'chart', [
      slider(P, 'Zinc', 'zn_boost', 0, 1, 0.01, pct, 'Sheet: 10 / 40 / 80%. New Seed backcrossed maize ≈ 40%'),
      slider(P, 'Iron', 'fe_boost', 0, 1, 0.01, pct, 'Sheet: 12.5 / 30 / 70%'),
      slider(P, 'Protein quality', 'prot_boost', 0, 1, 0.01, pct, 'Sheet: 20 / 40 / 80% (lysine + tryptophan)'),
      slider(P, 'Fiber added (wheat)', 'fib_delta', 0, 5, 0.1, v => (+v).toFixed(1) + ' g/d', 'Ingested arabinoxylan fiber per wheat eater; sheet 1 / 2 / 3 g/day'),
      slider(P, 'Phytate cut (edit knockouts)', 'phytate', 0, 1, 0.05, pct, 'Not in the sheet. Share of the maximum cut (lpa-type, −60–80% phytate): raises absorbed zinc up to +25% and iron +15% (shrunk: adult gains were far larger, a Guatemalan child trial found none). The concept note names phytate knockouts as an edit target.')], true),
    extras,
    accordion('Red-team levers', 'info', redteamControls(P), !!st.rt),
    accordion('Structure (v1.5)', 'method', structureControls(P), !!(P.pop_growth || P.domestic || P.base_mode === 'country')),
    accordion('From boost to health', 'method', [
      slider(P, 'Zinc gap closed per unit boost', 'gap_zn', 0, 1, 0.05, num(2), 'Sheet: 0.5'),
      slider(P, 'Iron gap closed per unit boost', 'gap_fe', 0, 1, 0.05, num(2), 'Sheet: 0.25 (phytate, food matrix)'),
      slider(P, 'Protein gap closed per unit boost', 'gap_prot', 0, 1, 0.05, num(2), 'Sheet: 0.5'),
      slider(P, 'Lab → field retention', 'lab_field', 0, 1, 0.05, num(2), 'Sheet: 0.6 (40% lab-to-field loss)'),
      slider(P, 'Stunting growth effect (Gunaratna)', 'growth', 0, 0.3, 0.01, pct, 'Sheet: 6 / 9 / 15% faster linear growth'),
      h('div', { class: 'lbl' }, 'Stunting method'), method,
      slider(P, 'DALYs per stunting case averted', 'stunt_daly', 0, 5, 0.1, num(1), 'Sheet: 2.8 (New Seed draft post; above the literature standard)'),
      slider(P, 'Stunting incidence conversion', 'stunt_inc', 0, 1, 0.05, num(2), 'Sheet: 0.2 (avoids counting the same child each year)'),
      h('div', { class: 'lbl' }, 'Zinc burden anchor'), zincAnchor(P),
      slider(P, 'Zinc DALYs per person-year at risk', 'zn_daly', 0, 0.03, 0.00001, num(5), 'Sheet: 0.02 (≈ WHO 2002, 28M DALYs ÷ 1.5B) × recalibration 0.459 = 0.0092. GBD 2019 puts zinc deficiency at 0.26M DALYs, ~100× lower.'),
      slider(P, 'Iron DALYs per person-year at risk', 'fe_daly', 0, 0.03, 0.0005, num(4), 'Sheet: 0.025 ÷ 3 = 0.0083'),
      slider(P, 'Protein DALYs per person-year (age > 5)', 'prot_daly', 0, 0.05, 0.001, num(3), 'Sheet: 0.01 placeholder'),
      slider(P, 'Fiber RR per +7 g/day', 'fib_rr', 0.8, 1, 0.01, num(2), 'Threapleton 2013: 0.91'),
      slider(P, 'Arabinoxylan vs total fiber', 'fib_ax', 0, 1, 0.05, pct, 'Sheet: 30 / 60 / 100%')], false),
    accordion('Regulation & rollout', 'pin', [
      h('div', { class: 'boost-gnote' }, 'First year gene-edited crops are planted, by country tier (“never” = 2100+).'), ...tierRows,
      slider(P, 'Max CG-derived share of crop area', 'ceil', 0, 1, 0.05, pct, 'Sheet: 25 / 50 / 70%'),
      slider(P, 'Years to reach the max (uncovered combos)', 'yrs', 5, 40, 1, v => v + ' y', 'Sheet: 30 / 20 / 15'),
      slider(P, 'Adoption speed multiplier', 'speed', 0.2, 3, 0.1, v => '×' + (+v).toFixed(1), 'Sheet: 0.6 / 1 / 1.5'),
      slider(P, 'Adoption skew (area → at-risk eaters)', 'skew', 0, 1, 0.05, num(2), 'Sheet: 0.7 / 0.85 / 1'),
      slider(P, 'Curt col-Z ceiling multiplier', 'zmult', 0.5, 3, 0.1, v => '×' + (+v).toFixed(1), 'Sheet: 2 (awaiting Curt: maybe 1)')], false),
    accordion('Accounting', 'coin', [
      slider(P, 'Credit to New Seed (attribution)', 'att', 0, 1, 0.05, pct, 'Sheet: 30%'),
      slider(P, 'Already biofortified anyway', 'base_cov', 0, 0.8, 0.05, pct, 'Sheet: 15%'),
      slider(P, 'Discount rate', 'disc', 0, 0.1, 0.001, pct1, 'Sheet: 4.3%'),
      slider(P, 'Secular decline: stunting & child deaths', 'sec_stunt', 0, 0.05, 0.005, pct1, 'Sheet: 3 / 2 / 1% per year'),
      slider(P, 'Secular decline: micronutrient gaps', 'sec_micro', 0, 0.05, 0.005, pct1, 'Sheet: 2 / 1 / 0% per year'),
      slider(P, 'Value of a DALY (× GDP per capita)', 'daly_gdp_mult', 0, 5, 0.1, v => '×' + (+v).toFixed(1), 'Sheet: 2.3'),
      slider(P, 'Program cost multiplier', 'cost_mult', 0.25, 4, 0.05, v => '×' + (+v).toFixed(2), 'Sheet total $42.8M (2026–2050)'),
      h('label', { class: 'switch' }, fixQ2, h('span', {}, 'Fix Q2: use the active fiber-adequacy value (the sheet always uses 80%)'))], false)
  ].filter(Boolean);
  const inner = h('div', { class: 'sidebar-inner' }, ...nodes);
  const old = ui.side.querySelector('.sidebar-inner'); const keep = old ? old.scrollTop : 0;
  const open = new Set([...ui.side.querySelectorAll('details.acc[open] summary span')].map(s => s.textContent));
  ui.side.replaceChildren(inner);
  if (old) inner.querySelectorAll('details.acc').forEach(d => { const t = d.querySelector('summary span')?.textContent; d.open = open.has(t); });
  inner.scrollTop = keep;
}

// ---- content ----
function tile(label, value, sub, cls) { return h('div', { class: 'tile ' + (cls || '') }, h('div', { class: 'lab' }, label), h('div', { class: 'val' }, value), sub ? h('div', { class: 'sub' }, sub) : null); }
function buildContent() {
  ui.title = h('div', { class: 'page-title' }, h('h1', {}, 'Global nutrient model'), h('span', { class: 'sub' }), controlsButton());
  ui.tiles = h('div', { class: 'tiles boost-tiles' });
  ui.intro = h('div', { class: 'card-body prose small' });
  ui.yearly = h('div', { class: 'plot' }); ui.nut = h('div', { class: 'plot' }); ui.map = h('div', { class: 'plot map' }); ui.reach = h('div', { class: 'plot' });
  ui.table = h('div', { class: 'card-body' }); ui.compare = h('div', { class: 'card-body' });
  ui.yearlyMode = h('div', { class: 'boost-presets' });
  const top = card('If CGIAR puts nutrition edits into every new maize, rice and wheat variety', 'info', [ui.intro, h('div', { class: 'card-body' }, ui.tiles)]);
  const cY = card('DALYs averted per year', 'chart', [h('div', { class: 'card-body' }, ui.yearlyMode), h('div', { class: 'card-body', style: { padding: '6px' } }, ui.yearly)], { foot: 'Credited to New Seed (attribution applied), undiscounted.' });
  const cN = card('DALYs by nutrient pathway', 'chart', h('div', { class: 'card-body', style: { padding: '6px' } }, ui.nut));
  const cM = card('Where the DALYs are', 'map', h('div', { class: 'card-body', style: { padding: '6px' } }, ui.map), { foot: '75 modeled countries; grey = not modeled.' });
  const cR = card('People eating gene-edited biofortified grain', 'chart', h('div', { class: 'card-body', style: { padding: '6px' } }, ui.reach), { foot: 'Calorie-weighted eaters of CG-derived edited varieties, net of those already biofortified (sheet People Reached, block 1).' });
  const cT = card('Countries', 'table', ui.table);
  const cC = card('Scenarios side by side', 'list', ui.compare);
  ui.redteam = h('div', { class: 'card-body' });
  ui.mc = h('div', { class: 'card-body' }); ui.mcPlot = h('div', { class: 'plot' });
  const cMC = card('Uncertainty (live Monte Carlo)', 'chart', [ui.mc, h('div', { class: 'card-body', style: { padding: '6px' } }, ui.mcPlot)], { foot: 'Draws are seeded, so the same settings give the same result. Cost is paid whether or not the edits work, so the expected cost per DALY is expected cost ÷ expected DALYs.' });
  const cRT = card('Red-team review (three independent reviewers, 2026-11-23)', 'info', ui.redteam);
  const cMeth = card('How the model works', 'method', h('div', { class: 'card-body prose' }, methods()));
  ui.content.replaceChildren(ui.title, top, h('div', { class: 'two-col' }, cY, cN), cMC, h('div', { class: 'two-col' }, cM, cR), cRT, cT, h('div', { class: 'two-col' }, cC, cMeth));
}

function methods() {
  return [
    h('p', {}, 'A browser port of New Seed’s “Gene_editing_mainstreaming_BOTEC v1.4” (private working sheet). At the sheet’s presets every number matches the sheet; every input is a control here.'),
    h('ol', {},
      h('li', {}, h('b', {}, 'Approval: '), 'each country has a regulatory tier; the tier sets the first year edited crops are planted.'),
      h('li', {}, h('b', {}, 'Variety replacement: '), 'from that year the CG-derived share of crop area ramps up linearly to a ceiling (country-crop values from Curt where available, a generic ramp otherwise), × adoption skew.'),
      h('li', {}, h('b', {}, 'Who eats it: '), 'population × the crop’s share of national calories (FAO), net of 15% already biofortified.'),
      h('li', {}, h('b', {}, 'Health: '), 'zinc and iron = inadequacy prevalence × DALYs per person-year at risk × effectiveness (boost × gap ratio × 0.6 lab→field) × processing retention; protein = stunting prevalence × 0.01 for all ages, plus under-5 stunting cases averted (HAZ-distribution shift from the Gunaratna growth effect) × 2.8 DALYs; wheat fiber via the GBD fiber–CVD dose-response.'),
      h('li', {}, h('b', {}, 'Accounting: '), 'secular decline in gaps, × 30% credited to New Seed, minus a cross-crop cap; discounted at 4.3% to 2026; valued at 2.3 × GDP per capita.')),
    h('p', {}, h('b', {}, 'v1.5 additions (off by default): '), 'population by year from UN WPP 2024 (all ages, under-5, women 15–49); only domestically grown grain credited (FAOSTAT food balances 2022–24, imports assumed to go to feed first); the already-biofortified counterfactual by country, crop and trait (2% floor plus known zinc wheat, zinc rice and QPM programs); red-team levers; a live Monte Carlo.'),
    h('p', {}, h('b', {}, 'Differs from the concept note: '), 'the note (v1.0, Nov 6) quotes 3.24M DALYs and ~$19 per discounted DALY; the v1.4 sheet gives 7.0M and $8.36 (Median). Switching the stunting method back to the growth rate gives 3.45M and $17.01, so the v1.4 HAZ-shift method explains almost all of the gap.'),
    h('p', {}, h('b', {}, 'Sheet quirks reproduced (from the extraction): '),
      'Q2 fiber always uses the 80% “already adequate” cell (a switch fixes it); Q3 a sheet “Custom” scenario drops the ×0.6 lab→field loss (here it never does); Q4 approval years read the tier table, floor 2030; Q6 program costs stop partner contracts in 2032 and add $1.2M for 2027–29 on top of a grid that starts in 2026; population held at 2030 (v1.5 switch); the cross-crop cap is 0 at all presets.'),
    h('p', { class: 'muted' }, 'Sources: the BOTEC sheet (UN WPP 2024, FAO food balances, Passarelli 2024, JME stunting, World Bank GDP, Gunaratna 2010, Olofin 2013, Threapleton 2013, Wei 2024); extra nutrients: Passarelli et al. 2024 (Lancet Glob Health) country inadequacy.')
  ];
}

function render() {
  const P = params();
  out = run(D, P);
  const T = out.totals;
  ui.title.querySelector('.sub').textContent = `${P.scenario}${isPristine() ? '' : ' (custom)'} · ${P.crops.map((on, i) => on ? CROPS[i] : null).filter(Boolean).join(', ')}`;
  const r2050 = out.reached[out.reached.length - 1].people;
  ui.intro.replaceChildren(h('p', {}, `DALYs averted 2030–${P.horizon} credited to New Seed (${Math.round(P.att * 100)}% attribution). `,
    isPristine() && st.s === 1 ? h('span', { class: 'tag ok' }, 'matches the v1.4 sheet exactly') : h('span', { class: 'tag warn' }, `sheet Median: ${fmtNum(SHEET_MEDIAN, 0)}`)));
  ui.tiles.replaceChildren(
    tile(`DALYs averted 2030–${P.horizon}` + (P.p_success.every(v => v === 1) ? ' (if the edits work)' : ' (expected value)'), fmtCompact(T.total, 2), `maize ${fmtCompact(T.maize)} · rice ${fmtCompact(T.rice)} · wheat ${fmtCompact(T.wheat)}`, 'hl'),
    tile('Discounted DALYs (2026 value)', fmtCompact(T.disc, 2), `at ${(P.disc * 100).toFixed(1)}%`, 'hl'),
    tile(`Full-diet equivalents reached, ${out.years[out.years.length - 1]}`, fmtCompact(r2050, 1), 'people × share of calories from edited grain; if the edits work'),
    tile('Cost per DALY (discounted)', T.per_daly_disc ? '$' + T.per_daly_disc.toFixed(2) : '–', `undiscounted $${T.per_daly ? T.per_daly.toFixed(2) : '–'} · cost $${fmtCompact(T.cost_disc)} PV`),
    tile('Value of health gains (2026 value)', '$' + fmtCompact(T.value_disc, 2), `${P.daly_gdp_mult}× GDP per capita per DALY`),
    tile('Top country', topCountry(), 'share of all DALYs'));
  const ex = GLOBAL_EXTRAS.filter(x => (out.nutTotals[x.id] || 0) !== 0);
  if (ex.length) {
    const lo = ex.reduce((s, x) => s + out.nutTotals[x.id] * x.range[0], 0), hi = ex.reduce((s, x) => s + out.nutTotals[x.id] * x.range[1], 0), mid = ex.reduce((s, x) => s + out.nutTotals[x.id], 0);
    ui.intro.append(h('p', { class: 'muted' }, `Extra nutrients (not in the sheet) add ${fmtCompact(mid)} DALYs, plausible range ${fmtCompact(lo)} to ${fmtCompact(hi)}.`));
  }
  // yearly
  ui.yearlyMode.replaceChildren(...[['crop', 'By crop'], ['nut', 'By nutrient']].map(([m, l]) => h('button', { class: 'btn small' + ((st.ymode || 'crop') === m ? ' on' : ''), onClick: () => { st.ymode = m; save(); render(); } }, l)));
  const lay = (yt) => ({ font: FONT, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 60, r: 10, t: 30, b: 40 }, height: 320,
    xaxis: { gridcolor: '#eee8e2' }, yaxis: { title: { text: yt }, gridcolor: '#eee8e2', rangemode: 'tozero' }, legend: { orientation: 'h', y: 1.15 }, hovermode: 'x unified' });
  const traces = (st.ymode || 'crop') === 'crop'
    ? CROPS.map((c, i) => ({ type: 'scatter', mode: 'lines', stackgroup: 'a', name: c, x: out.years, y: out.rows.map(r => r[c]), line: { color: CROP_COLOR[i], width: 1 }, hovertemplate: '%{y:,.0f}' }))
    : out.keys.filter(k => out.nutTotals[k] > 0).map(k => ({ type: 'scatter', mode: 'lines', stackgroup: 'a', name: NUT[k][0], x: out.years, y: out.byNut.map(r => r[k]), line: { color: NUT[k][1], width: 1 }, hovertemplate: '%{y:,.0f}' }));
  Plotly.react(ui.yearly, traces, lay('DALYs averted per year'), CFG);
  // by nutrient
  const nk = out.keys.filter(k => out.nutTotals[k] > 0).sort((a, b) => out.nutTotals[b] - out.nutTotals[a]);
  Plotly.react(ui.nut, [{ type: 'bar', orientation: 'h', y: nk.map(k => NUT[k][0]), x: nk.map(k => out.nutTotals[k]), marker: { color: nk.map(k => NUT[k][1]) },
    text: nk.map(k => `${fmtCompact(out.nutTotals[k])} (${(out.nutTotals[k] / T.total * 100).toFixed(0)}%)`), textposition: 'auto', hovertemplate: '%{y}: %{x:,.0f}<extra></extra>' }],
  { font: FONT, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 10, r: 20, t: 10, b: 40 }, height: 320,
    xaxis: { title: { text: `DALYs 2030–${P.horizon}` }, gridcolor: '#eee8e2' }, yaxis: { automargin: true, autorange: 'reversed' } }, CFG);
  // map
  Plotly.react(ui.map, [{ type: 'choropleth', locationmode: 'ISO-3', locations: out.country.map(c => c.iso3), z: out.country.map(c => c.total),
    text: out.country.map(c => `<b>${c.name}</b><br>${fmtNum(c.total, 0)} DALYs<br>approval ${c.approval >= 2100 ? 'never' : c.approval}`), hoverinfo: 'text',
    colorscale: [[0, '#fbf4e1'], [0.3, '#e9b96a'], [0.7, '#b1443b'], [1, '#5c1d17']], marker: { line: { color: '#fff', width: 0.5 } },
    colorbar: { title: { text: 'DALYs' }, thickness: 12, len: 0.7 } }],
  { font: FONT, paper_bgcolor: 'rgba(0,0,0,0)', margin: { l: 0, r: 0, t: 0, b: 0 }, height: 340,
    geo: { projection: { type: 'natural earth' }, showframe: false, showcoastlines: false, showland: true, landcolor: '#ebe6e0', bgcolor: 'rgba(0,0,0,0)', lataxis: { range: [-40, 60] } } },
  { ...CFG, topojsonURL: 'vendor/' });
  // reached
  Plotly.react(ui.reach, [{ type: 'scatter', mode: 'lines', fill: 'tozeroy', x: out.years, y: out.reached.map(r => r.people), line: { color: '#2f5f8f' }, hovertemplate: '%{y:,.0f}<extra></extra>' }],
    { ...lay('People'), showlegend: false }, CFG);
  renderTable(); renderCompare(P); renderRedteam(); renderMC();
}

// ---- Monte Carlo ----
const mcKey = () => JSON.stringify([params(), st.mcMode || 'rt', st.mcN || 1000]);
function renderMC() {
  const mode = st.mcMode || 'rt', n = st.mcN || 1000;
  const sel = h('select', { id: 'g-mcmode', style: { width: 'auto' } }, [['rt', 'Sheet ranges + red-team uncertainty'], ['sheet', 'Sheet ranges only (Pessimistic/Optimistic = 5th/95th)']].map(([v, l]) => h('option', { value: v, selected: mode === v ? true : null }, l)));
  sel.addEventListener('change', () => { st.mcMode = sel.value; save(); renderMC(); });
  const ns = h('select', { id: 'g-mcn', style: { width: 'auto' } }, [500, 1000, 2000, 5000].map(v => h('option', { value: v, selected: n === v ? true : null }, v.toLocaleString() + ' draws')));
  ns.addEventListener('change', () => { st.mcN = +ns.value; save(); renderMC(); });
  const prog = h('span', { class: 'muted' });
  const btn = h('button', { class: 'btn small on', id: 'g-mcrun', disabled: mcBusy ? true : null, onClick: () => doMC(prog) }, mcBusy ? 'Running…' : 'Run');
  const stale = mc && mc.key !== mcKey();
  const head = h('div', { class: 'boost-presets', style: { alignItems: 'center', flexWrap: 'wrap', gap: '8px' } }, sel, ns, btn, prog);
  const body = [h('p', { class: 'small' }, 'Draws every scenario input around your current settings with the sheet’s own spread (related inputs move together), and draws whether the edits work in each crop. “Red-team uncertainty” also draws the red-team inputs below, replacing your values for those.'), head];
  if (!mc) body.push(h('div', { class: 'note info' }, 'Press Run (about 2 seconds per 1,000 draws).'));
  else {
    const S = mc.S, M = v => fmtCompact(v, 2), $ = v => (isFinite(v) ? '$' + (v >= 100 ? v.toFixed(0) : v.toFixed(2)) : '–');
    if (stale) body.push(h('div', { class: 'note' }, 'Settings changed since this run. Press Run to update.'));
    body.push(h('div', { class: 'tiles boost-tiles' },
      tile('Expected discounted DALYs', M(S.meanDisc), `median ${M(S.disc[2])} · 5th–95th ${M(S.disc[0])}–${M(S.disc[4])}`, 'hl'),
      tile('Expected cost per discounted DALY', $(S.ev), 'expected cost ÷ expected DALYs', 'hl'),
      tile('Chance of no DALYs', (S.pZero * 100).toFixed(0) + '%', 'the edits fail in every crop, or nothing is planted in time'),
      tile('$ per DALY when it works', $(S.perDaly[2]), `median of draws with DALYs; 5th–95th ${$(S.perDaly[0])}–${$(S.perDaly[4])}`),
      tile('Chance under $50 per DALY', (S.pUnder(50) * 100).toFixed(0) + '%', `under $100: ${(S.pUnder(100) * 100).toFixed(0)}%`),
      tile('Undiscounted DALYs', M(S.meanTotal), `expected; median ${M(S.total[2])}`)));
    body.push(h('p', { class: 'muted small' }, `${S.n.toLocaleString()} draws, ${mc.mode === 'rt' ? 'sheet ranges + red-team uncertainty' : 'sheet ranges only'}.`));
  }
  if (mode === 'rt') body.push(h('details', {}, h('summary', {}, 'Red-team distributions'), h('table', { class: 'dt' }, h('tbody', {}, RT_DISTS.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, b)))))));
  ui.mc.replaceChildren(...body);
  if (mc) {
    const x = mc.S.raw.map(d => d.disc);
    Plotly.react(ui.mcPlot, [{ type: 'histogram', x, nbinsx: 60, marker: { color: '#2f5f8f' }, hovertemplate: '%{x}: %{y} draws<extra></extra>' }],
      { font: FONT, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 50, r: 10, t: 10, b: 40 }, height: 240, bargap: 0.05,
        xaxis: { title: { text: 'Discounted DALYs (credited to New Seed)' }, gridcolor: '#eee8e2' }, yaxis: { title: { text: 'Draws' }, gridcolor: '#eee8e2' } }, CFG);
  } else Plotly.purge(ui.mcPlot);
}
async function doMC(prog) {
  if (mcBusy) return; mcBusy = true;
  const key = mcKey(), mode = st.mcMode || 'rt', n = st.mcN || 1000;
  document.getElementById('g-mcrun')?.setAttribute('disabled', '');
  const S = await runMC(run, D, params(), { n, mode, batch: 50, onProgress: (d, t) => { prog.textContent = `${d.toLocaleString()} / ${t.toLocaleString()}`; } });
  mc = { S, key, mode }; mcBusy = false; renderMC();
}
function topCountry() { const c = out.country.slice().sort((a, b) => b.total - a.total)[0]; return c && out.totals.total > 0 ? `${c.name} ${(c.total / out.totals.total * 100).toFixed(0)}%` : '–'; }
function renderTable() {
  const rows = out.country.filter(c => c.total > 0 || st.showAll).sort((a, b) => b.total - a.total);
  const tot = out.totals.total || 1;
  const t = h('table', { class: 'dt' },
    h('thead', {}, h('tr', {}, ['Country', 'Region', 'Tier', 'Edits from', 'Maize', 'Rice', 'Wheat', 'Total', 'Share', 'Biggest pathway'].map(x => h('th', {}, x)))),
    h('tbody', {}, rows.map(c => {
      const kk = Object.entries(c.nut).sort((a, b) => b[1] - a[1])[0];
      const src = D.countries.find(x => x.iso3 === c.iso3);
      return h('tr', {}, h('td', { title: src ? src.ge_status : '' }, c.name), h('td', {}, c.region), h('td', {}, src ? src.tier : ''), h('td', {}, c.approval >= 2100 ? 'never' : String(c.approval)),
        ...c.crop.map(v => h('td', { class: 'num' }, fmtNum(v, 0))), h('td', { class: 'num' }, h('b', {}, fmtNum(c.total, 0))), h('td', { class: 'num' }, (c.total / tot * 100).toFixed(1) + '%'),
        h('td', {}, kk && kk[1] > 0 ? NUT[kk[0]][0] : '–'));
    })));
  const all = h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: st.showAll ? true : null, onChange: e => { st.showAll = e.target.checked; save(); renderTable(); } }), h('span', {}, `Show all 75 countries (${out.country.filter(c => c.total === 0).length} have no edited crops before 2051)`));
  ui.table.replaceChildren(all, h('div', { class: 'table-wrap' }, t));
}
function renderRedteam() {
  const dirCls = d => (d.startsWith('worse') ? 'conf-low' : d.startsWith('better') ? 'conf-high' : 'conf-moderate');
  const t = h('table', { class: 'dt health rt-findings' },
    h('thead', {}, h('tr', {}, ['Finding', 'Direction', 'Effect on Median', 'Control here'].map(x => h('th', {}, x)))),
    h('tbody', {}, REDTEAM.findings.map(([f, d, e, c]) => h('tr', {}, h('td', {}, f), h('td', {}, h('span', { class: 'conf ' + dirCls(d) }, d)), h('td', { class: 'num' }, e), h('td', {}, c)))));
  const levers = (() => {
    const base = run(D, defaults(D, 1)).totals;
    return h('table', { class: 'dt' }, h('thead', {}, h('tr', {}, ['Red-team lever (alone, on the sheet Median)', 'Discounted DALYs', '× Median', '$/disc. DALY'].map(x => h('th', {}, x)))),
      h('tbody', {}, ...REDTEAM.levers.map(l => { const P = defaults(D, 1); l.apply(P, D); const t2 = run(D, P).totals;
        return h('tr', {}, h('td', {}, l.label), h('td', { class: 'num' }, fmtCompact(t2.disc, 2)), h('td', { class: 'num' }, '×' + (t2.disc / base.disc).toFixed(2)), h('td', { class: 'num' }, '$' + t2.per_daly_disc.toFixed(2))); }),
      (() => { const P = defaults(D, 1); for (const l of REDTEAM.levers) l.apply(P, D); const t2 = run(D, P).totals;
        return h('tr', { class: 'total' }, h('td', {}, 'All together (Red-team central)'), h('td', { class: 'num' }, fmtCompact(t2.disc, 2)), h('td', { class: 'num' }, '×' + (t2.disc / base.disc).toFixed(2)), h('td', { class: 'num' }, '$' + t2.per_daly_disc.toFixed(2))); })()));
  })();
  const Pa = defaults(D, 1); for (const l of REDTEAM.levers) l.apply(Pa, D); const ra = run(D, Pa).totals;
  const Pb = defaults(D, 1); for (const l of REDTEAM.levers) if (l.id !== 'p_success') l.apply(Pb, D); const rb = run(D, Pb).totals;
  ui.redteam.replaceChildren(
    h('p', {}, 'The sheet’s Median reads as a result ', h('b', {}, 'if the research succeeds'), `, with the full maize QPM growth effect applied to every crop. The reviewers’ central adjustments, plus the v1.5 structure (population growth, domestic grain only, baseline by country), bring it from 7.0M DALYs at $8.36 per discounted DALY to ${fmtCompact(ra.total, 2)} expected DALYs (2030–2060) at $${ra.per_daly_disc.toFixed(0)} per discounted DALY ($${rb.per_daly_disc.toFixed(0)} if the edits work).`),
    h('div', { class: 'table-wrap' }, levers), h('div', { class: 'table-wrap' }, t),
    h('p', { class: 'muted' }, 'Claims were fact-checked against primary sources on 2026-11-24 and corrected where needed (Gunaratna 2010 is in Food Policy: +9% height, +12% weight gain; the Ethiopian trial compared QPM growers with and without a consumption package; India’s edited rice seed reaches farmers 2026–27). The uncertainty card above replaces the reviewer’s offline Monte Carlo.'));
}
function renderCompare(P) {
  const rows = [0, 1, 2].map(s => ({ s, r: run(D, defaults(D, s)).totals }));
  const t = h('table', { class: 'dt' },
    h('thead', {}, h('tr', {}, ['Sheet preset', 'DALYs 2030–50', 'Discounted', '$/DALY (disc)'].map(x => h('th', {}, x)))),
    h('tbody', {}, ...rows.map(({ s, r }) => h('tr', {}, h('td', {}, ['Pessimistic', 'Median', 'Optimistic'][s]), h('td', { class: 'num' }, fmtNum(r.total, 0)), h('td', { class: 'num' }, fmtNum(r.disc, 0)), h('td', { class: 'num' }, '$' + r.per_daly_disc.toFixed(2)))),
      h('tr', { class: 'total' }, h('td', {}, 'Your settings'), h('td', { class: 'num' }, fmtNum(out.totals.total, 0)), h('td', { class: 'num' }, fmtNum(out.totals.disc, 0)), h('td', { class: 'num' }, out.totals.per_daly_disc ? '$' + out.totals.per_daly_disc.toFixed(2) : '–'))));
  ui.compare.replaceChildren(h('div', { class: 'table-wrap' }, t), h('div', { class: 'note info' }, 'Presets are the sheet’s; your settings start from the selected preset.'));
}

function refresh() { buildSidebar(); render(); }

async function main() {
  const r = await fetch('data/global.json' + new URL(import.meta.url).search);
  if (!r.ok) throw new Error('data/global.json: HTTP ' + r.status);
  D = await r.json();
  st = load() || { s: 1, ov: {}, extras: {} };
  if (![0, 1, 2].includes(st.s)) st.s = 1;
  ui.side = h('aside', { class: 'sidebar' }); ui.content = h('main', { class: 'content' });
  document.getElementById('app').replaceChildren(renderHeader('global'), h('div', { class: 'layout' }, ui.side, ui.content), renderFooter());
  setupDrawer(ui.side);
  buildContent(); refresh();
}
main().catch(e => { console.error(e); document.getElementById('app').replaceChildren(h('div', { class: 'empty' }, 'Failed to start: ' + e.message)); });
