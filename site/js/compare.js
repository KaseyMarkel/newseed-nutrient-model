// Compare: a baseline seed versus a custom scenario at one share of maize land and
// across 0-100%. Every measure is shown three ways: the world with no biofortified seed
// (0% of maize land), the baseline seed and the custom scenario (each with its impact
// versus none), and the change in impact. "pp" = percentage points; "%" = relative change.
import { loadEngine, DEFAULT_SEED } from './config.js';
import { getState, setState } from './state.js';
import { h, renderHeader, renderBanner, renderFooter, card, toast } from './ui.js';
import { display } from './units.js';
import { kpiLabel } from './kpis.js';
import { scenarios, allSeeds, allSubsidies, findSeed, findSubsidy } from './scenarios.js';
import { curveChart, deltaBars, purge } from './charts.js';
import { Runner, PEN_STEPS, yieldToUI } from './runner.js';
import { scenarioProblems } from './validate.js';
import { engineWarnings, noteNodes } from './notes.js';
import { IMPACT_ROWS, computeImpact, impactTable, headlineSentences, sideNames, noneDiffers, stepsNote, findStepExample, perCase, levelText, changeText } from './impact.js';

const DEPT_KPIS = ['n_stunting_averted', 'stunting_change_pp', 'stunting_pct', 'n_children_biofortified', 'zlen_change', 'coverage_pct', 'income_increment_total', 'income_per_farmer_adopter', 'n_farmers_bio', 'land_bio_ha', 'newseed_subsidy_total', 'bio_consumed_mt', 'production_increment_mt'];
const CURVES = [
  { key: 'stunting_pct', title: 'Stunting prevalence (%)' },
  { key: 'n_stunting_averted', title: 'Stunting cases averted' },
  { key: 'n_children_biofortified', title: 'Children reached' },
  { key: 'zlen_change', title: 'Mean HAZ gain per child (z)' },
  { key: 'coverage_pct', title: 'Share of maize eaten that is biofortified (%)' },
  { key: 'n_farmers_bio', title: 'Adopting farmers' },
  { key: 'income_increment_total', title: 'Farmer income gain per year' },
  { key: 'newseed_subsidy_total', title: 'New Seed subsidy cost per year' },
  { key: 'newseed_subsidy_total', title: 'Subsidy per stunting case averted', value: perCase }
];
const R = Object.fromEntries(IMPACT_ROWS.map(r => [r.id, r]));
const ACROSS_GROUPS = {
  stunting: { label: 'Stunting and children', rows: [['stunting', ''], ['cases', 'cases averted'], ['children', 'children reached'], ['haz', 'mean HAZ']] },
  money: { label: 'Farmers and money', rows: [['income', 'farmer income'], ['subsidy', 'subsidy cost'], ['per_case', 'subsidy per case'], ['farmers', 'adopting farmers']] }
};

let info, defaults, runner, els = {};
let deptKpi = 'n_stunting_averted';
let acrossGroup = 'stunting';
let updateToken = 0;

// The new side is either a seed (official, the 2030 model seed, or custom) with the baseline's
// subsidy, or a saved Scenario Lab scenario (its own seed, subsidy and parameters).
const DEFAULT_CUSTOM = 'seed:' + DEFAULT_SEED;
function customOptions() {
  const seedOpts = allSeeds(defaults).map(s => ({ id: 'seed:' + s.id, group: 'Seeds (with the baseline subsidy)', label: s.label + (s.official ? '' : ' ✦'),
    scenario: { id: 'seed:' + s.id, name: s.label, seedId: s.id, subsidyId: null, pathway: null, params: {} } }));
  const scn = scenarios().map(s => ({ id: s.id, group: 'Saved scenarios (Scenario Lab)', label: s.name, scenario: s }));
  return [...seedOpts, ...scn];
}
// Resolve the custom side. Never silently substitute: anything missing is reported.
function resolveCustom(baseSubsidy) {
  const st = getState();
  const opts = customOptions();
  const warnings = [];
  const wanted = st.compareScenario === '__example_2030' ? DEFAULT_CUSTOM : st.compareScenario;
  let opt = opts.find(o => o.id === wanted);
  if (!opt) {
    if (wanted && wanted !== DEFAULT_CUSTOM) warnings.push('The scenario chosen earlier no longer exists (deleted, or saved on another port or computer); showing the 2030 seed instead.');
    opt = opts.find(o => o.id === DEFAULT_CUSTOM) || opts[opts.length - 1];
  }
  const sc = opt.scenario;
  let seed = findSeed(defaults, sc.seedId);
  if (!seed) { warnings.push(`The seed of scenario "${sc.name}" was deleted. Pick or create a seed for it in the Scenario Lab; until then the 2030 seed is shown in its place.`); seed = findSeed(defaults, DEFAULT_SEED) || defaults.seeds[defaults.seeds.length - 1]; }
  let subsidy = sc.subsidyId == null && sc.id.startsWith('seed:') ? baseSubsidy : findSubsidy(defaults, sc.subsidyId);
  if (!subsidy) { warnings.push(`The subsidy regime of scenario "${sc.name}" was deleted; showing the current subsidy in its place.`); subsidy = defaults.subsidies[0]; }
  return { opt, sc, seed, subsidy, params: sc.params || {}, warnings };
}
function resolveBaseline() {
  const st = getState();
  const warnings = [];
  let seed = findSeed(defaults, st.compareBaseline.seed);
  if (!seed) { warnings.push('The baseline seed chosen earlier no longer exists; using the 2028 seed.'); seed = defaults.seeds.find(s => s.id === 's28') || defaults.seeds[defaults.seeds.length - 1]; }
  let subsidy = findSubsidy(defaults, st.compareBaseline.subsidy);
  if (!subsidy) { warnings.push('The baseline subsidy regime chosen earlier no longer exists; using the current subsidy.'); subsidy = defaults.subsidies[0]; }
  return { seed, subsidy, warnings };
}
function scenarioFor(seed, subsidy, pathway, params) {
  const cleanSeed = { id: seed.id, label: seed.label, year: seed.year, yield_change: { ...seed.yield_change } };
  const cleanSub = { ...subsidy }; delete cleanSub.official;
  return { seed: cleanSeed, subsidy: cleanSub, pathway, params: params || {} };
}
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ------------------------------------------------------------- controls
function renderControls() {
  const st = getState();
  const seeds = allSeeds(defaults);
  const base = resolveBaseline();
  const cust = resolveCustom(base.subsidy);
  const subs = allSubsidies(defaults);
  const seedOpt = s => h('option', { value: s.id, selected: s.id === base.seed.id ? true : null }, s.label + (s.official ? '' : ' ✦') + (seeds.filter(x => x.label === s.label).length > 1 ? ` [${s.id.slice(-6)}]` : ''));
  const baseSeed = h('select', { 'aria-label': 'Baseline seed' }, seeds.map(seedOpt));
  baseSeed.addEventListener('change', () => { setState({ compareBaseline: { ...getState().compareBaseline, seed: baseSeed.value } }, { silent: true }); update(); });
  const baseSub = h('select', { 'aria-label': 'Baseline subsidy' }, subs.map(s => h('option', { value: s.id, selected: s.id === base.subsidy.id ? true : null }, s.label + (s.official ? '' : ' ✦'))));
  baseSub.addEventListener('change', () => { setState({ compareBaseline: { ...getState().compareBaseline, subsidy: baseSub.value } }, { silent: true }); update(); });
  const groups = new Map();
  for (const o of customOptions()) { if (!groups.has(o.group)) groups.set(o.group, []); groups.get(o.group).push(o); }
  const custSel = h('select', { 'aria-label': 'New seed or scenario' }, [...groups].map(([g, list]) => h('optgroup', { label: g }, list.map(o => h('option', { value: o.id, selected: o.id === cust.opt.id ? true : null }, o.label)))));
  custSel.addEventListener('change', () => {
    const o = customOptions().find(x => x.id === custSel.value);
    const patch = { compareScenario: custSel.value };
    if (o && o.scenario.pathway) patch.pathway = o.scenario.pathway; // compare in the pathway the scenario was saved with
    setState(patch, { silent: true }); renderControls(); update();
  });
  const pathSel = h('select', { 'aria-label': 'Stunting pathway' }, defaults.pathways.map(p => h('option', { value: p.id, selected: p.id === st.pathway ? true : null }, p.label)));
  pathSel.addEventListener('change', () => { setState({ pathway: pathSel.value }, { silent: true }); renderControls(); update(); });
  const chip = h('span', { class: 'pen-chip' }, st.comparePenetration + '%');
  const range = h('input', { type: 'range', class: 'pen', min: 0, max: 100, step: 10, value: st.comparePenetration, 'aria-label': 'Share of maize land planted with biofortified seed (%)' });
  range.addEventListener('input', () => { chip.textContent = range.value + '%'; });
  range.addEventListener('change', () => { setState({ comparePenetration: +range.value }, { silent: true }); update(); });
  const unitSwitch = (key, a, b) => {
    const inp = h('input', { type: 'checkbox', checked: st.units[key] === b ? true : null, 'aria-label': `${a} or ${b}` });
    inp.addEventListener('change', () => { setState({ units: { ...getState().units, [key]: inp.checked ? b : a } }, { silent: true }); renderControls(); update(); });
    return h('label', { class: 'switch' }, h('span', { class: st.units[key] === a ? 'on' : '' }, a), inp, h('span', { class: st.units[key] === b ? 'on' : '' }, b));
  };
  const yc = cust.seed.yield_change || {};
  const custMeta = h('div', { class: 'hint' }, `${cust.seed.label} · ${cust.subsidy.label}` + (Object.keys(cust.params).length ? ` · ${Object.keys(cust.params).length} parameter override(s)` : '') +
    ' · yield change vs conventional seed: ' + Object.entries(yc).map(([k, v]) => `${k.split('_')[0]} ${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`).join(', '));
  const pathNote = cust.sc.pathway && cust.sc.pathway !== st.pathway
    ? h('div', { class: 'hint', style: { color: 'var(--amber)' } }, `Saved with the ${(defaults.pathways.find(p => p.id === cust.sc.pathway) || {}).label || cust.sc.pathway} pathway; both sides are shown with the pathway chosen here.`) : null;
  els.controls.replaceChildren(h('div', { class: 'form-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' } },
    h('div', { class: 'field' }, h('label', {}, h('span', { class: 'sw base' }), 'Baseline seed'), baseSeed),
    h('div', { class: 'field' }, h('label', {}, 'Baseline subsidy'), baseSub),
    h('div', { class: 'field' }, h('label', {}, h('span', { class: 'sw cust' }), 'New seed or custom scenario'), custSel, custMeta, pathNote),
    h('div', { class: 'field' }, h('label', {}, 'Stunting pathway (both sides)'), pathSel),
    h('div', { class: 'field' }, h('label', {}, 'Share of maize land planted with biofortified seed'), h('div', { class: 'pen-head' }, h('span', {}, '0%'), chip, h('span', {}, '100%')), range),
    h('div', { class: 'field' }, h('label', {}, 'Units'), h('div', { class: 'units', style: { flexDirection: 'row', gap: '14px', flexWrap: 'wrap' } }, unitSwitch('currency', 'USD', 'GTQ'), unitSwitch('area', 'ha', 'mz'), unitSwitch('weight', 'mt', 'qq')))));
}

// ------------------------------------------------------------- results
// Any failure while computing or drawing is shown on the page (not an unhandled rejection).
async function update() {
  try { await updateInner(); } catch (e) {
    console.error(e);
    els.progress.replaceChildren(h('div', { class: 'note err' }, `Compare could not be drawn: ${e && e.message ? e.message : e}.`));
  }
}
// No stale numbers or curves from the previous scenario when this one cannot run.
function clearResults() {
  [els.headline, els.impact, els.impactFoot, els.across, els.stepsNote, els.warnings].forEach(x => x.replaceChildren());
  [...els.curves, els.deptPlot].forEach(purge);
  els.curveTitles.forEach(t => { t.textContent = ''; });
  els.deptTitle.textContent = '';
}
async function updateInner() {
  const token = ++updateToken;
  const st = getState();
  const units = st.units;
  const pen = st.comparePenetration;
  const base = resolveBaseline();
  const cust = resolveCustom(base.subsidy);
  const pathway = st.pathway;
  const pathLabel = (defaults.pathways.find(p => p.id === pathway) || {}).label || pathway;
  const bScn = scenarioFor(base.seed, base.subsidy, pathway, {});
  const cScn = scenarioFor(cust.seed, cust.subsidy, pathway, cust.params);
  const problems = scenarioProblems(cust.seed, cust.subsidy, cust.params);
  if (problems.length) {
    els.progress.replaceChildren(h('div', { class: 'note err' }, `The custom scenario "${cust.sc.name}" has values the model cannot use: ${problems.join(' ')} Fix it in the Scenario Lab.`));
    clearResults();
    return;
  }
  const cached = runner.cache.has(runner.keyOf(runner.scenarioFor({ scenario: cScn, penetration: 100 })));
  if (!cached) {
    els.progress.replaceChildren(h('div', { class: 'progress' }, 'Running the model for both scenarios at 11 shares of maize land…'));
    await yieldToUI(); await yieldToUI();
    if (token !== updateToken) return;
  }
  let bCurve, cCurve;
  try {
    bCurve = runner.curve({ scenario: bScn });
    cCurve = runner.curve({ scenario: cScn });
  } catch (e) {
    els.progress.replaceChildren(h('div', { class: 'note err' }, 'The model could not run this scenario: ' + (e && e.message ? e.message : e) + '. Check the seed, subsidy and parameter values in the Scenario Lab.'));
    clearResults();
    console.warn(e); return; // handled: the message is shown above
  }
  els.progress.replaceChildren();
  const iPen = PEN_STEPS.indexOf(pen);
  const bRes = iPen >= 0 ? bCurve[iPen] : runner.run({ scenario: bScn, penetration: pen });
  const cRes = iPen >= 0 ? cCurve[iPen] : runner.run({ scenario: cScn, penetration: pen });
  const none = bCurve[0].national, noneC = cCurve[0].national;
  const b = bRes.national, c = cRes.national;
  const names = { ...sideNames(base, { ...cust }), word: cust.opt.id.startsWith('seed:') ? 'new seed' : 'custom scenario' };

  // warnings: missing pieces, identical sides, different "none" worlds
  const warns = [...base.warnings, ...cust.warnings];
  if (sameJSON(bScn, cScn)) warns.push('The baseline and the custom scenario are identical (same seed yields, subsidy and parameters), so every change is zero. Pick a different baseline seed or scenario.');
  else if (sameJSON(bScn.seed.yield_change, cScn.seed.yield_change) && sameJSON(bScn.params, cScn.params) && !sameJSON(bScn.subsidy, cScn.subsidy)) warns.push('Both sides use the same seed yields; only the subsidy regime differs.');
  const diff = noneDiffers(none, noneC);
  if (diff.length) warns.push(`The custom scenario's parameter overrides change the world without biofortified seed too (${diff.join(', ')} differ at 0%). Its impact is measured against its own 0% world; the "No biofortified seed" column shows the baseline's.`);
  const minYield = Math.min(...Object.values(cust.seed.yield_change || {}));
  if (minYield <= -1) warns.push('The custom seed has a yield change of -100% or less in at least one farmer segment, which means no harvest; results for that segment are not meaningful.');
  els.warnings.replaceChildren(...warns.map(w => h('div', { class: 'note err' }, w)),
    // the engine's own warnings (meta.warnings) at the chosen share and anywhere on the curves
    ...noteNodes([...engineWarnings([bRes, cRes], [names.b, names.c]),
      ...engineWarnings([...bCurve, ...cCurve], [...bCurve.map(() => names.b), ...cCurve.map(() => names.c)], { landShare: false })]));

  // headline
  const sentences = headlineSentences(none, b, c, names, pen, units, noneC);
  els.headline.replaceChildren(
    h('div', {}, h('h2', {}, 'What changes'), ...sentences.map(s => h('p', {}, s)),
      h('p', { class: 'small' }, `Pathway: ${pathLabel}. Both sides run through the same engine at the same share of maize land. pp = percentage points; % in brackets = change relative to the baseline's impact.`)),
    h('div', { class: 'scn' }, h('span', { class: 'pill base' }, h('span', { class: 'sw base' }), names.b, names.b.includes(base.subsidy.label.toLowerCase()) ? '' : ' · ' + base.subsidy.label),
      h('span', { class: 'pill cust' }, h('span', { class: 'sw cust' }), names.c, names.c.includes(cust.subsidy.label.toLowerCase()) ? '' : ' · ' + cust.subsidy.label),
      h('button', { class: 'btn small', onClick: () => copySummary(sentences, none, b, c, names, pen, units, pathLabel, noneC) }, 'Copy summary')));

  // impact table at the chosen share
  els.impact.replaceChildren(impactTable(none, b, c, { units, names, pen, noneC }));
  const ex = findStepExample(PEN_STEPS, bCurve, cCurve);
  els.impactFoot.replaceChildren(
    h('span', {}, 'Impact vs none = change from the world without biofortified seed (0% of maize land). Change in impact = new minus baseline; in brackets, as % of the baseline impact. Green = more benefit or less cost; red = less benefit or more cost.'),
    ex ? h('span', {}, ' Cases averted move in steps; see the note under "Across shares of maize land".') : null);

  // department deltas
  const bMap = new Map(bRes.departments.map(d => [d.region, d]));
  const rows = cRes.departments.map(d => ({ region: d.region, delta: (d[deptKpi] || 0) - ((bMap.get(d.region) || {})[deptKpi] || 0) }));
  deltaBars(els.deptPlot, rows, deptKpi, units);
  els.deptTitle.textContent = `Change by department in ${kpiLabel(deptKpi).toLowerCase()} at ${pen}% of maize land (custom minus baseline)`;

  // curves
  CURVES.forEach((cv, i) => {
    const val = cv.value || (n => n[cv.key]);
    curveChart(els.curves[i], cv.key, PEN_STEPS, bCurve.map(r => val(r.national)), cCurve.map(r => val(r.national)), units, [names.b, names.c], { marker: pen, legend: i === 0 });
    els.curveTitles[i].textContent = cv.title;
  });

  // across shares
  els.stepsNote.replaceChildren(stepsNote(ex, names));
  renderAcross(bCurve, cCurve, names, pen, units);
}

function renderAcross(bCurve, cCurve, names, pen, units) {
  const group = ACROSS_GROUPS[acrossGroup];
  const head = h('thead', {}, h('tr', {},
    h('th', { scope: 'col' }, 'Share of maize land'),
    h('th', { scope: 'col', class: 'none' }, 'No biofortified seed', h('span', { class: 'u' }, 'same at every share')),
    h('th', { scope: 'col' }, h('span', { class: 'sw base' }), names.b, h('span', { class: 'u' }, 'level (impact vs none)')),
    h('th', { scope: 'col' }, h('span', { class: 'sw cust' }), names.c, h('span', { class: 'u' }, 'level (impact vs none)')),
    h('th', { scope: 'col' }, 'Change in impact', h('span', { class: 'u' }, 'new minus baseline (% of baseline impact)'))));
  const none = bCurve[0].national, noneC = cCurve[0].national;
  const body = h('tbody', {}, PEN_STEPS.map((p, i) => {
    const bn = bCurve[i].national, cn = cCurve[i].national;
    const noneLines = [], bLines = [], cLines = [], chLines = [];
    let step = false;
    for (const [id, word] of group.rows) {
      const row = R[id];
      const r = computeImpact(row, none, bn, cn, noneC);
      const lvl = v => levelText(row, v, units);
      const imp = x => (row.levelIsImpact || row.kind === 'ratio' || x == null) ? '' : ` (${display(row.key, row.kind === 'reduce' ? -x : x, units, { signed: true, delta: true, decimals: row.ppDecimals ?? row.decimals }).text})`;
      const k = word ? h('span', { class: 'k' }, word) : null;
      noneLines.push(h('span', { class: 'line' }, h('span', { class: 'v' }, row.kind === 'ratio' || row.noNone ? '–' : lvl(r.nv)), k));
      bLines.push(h('span', { class: 'line' }, h('span', { class: 'v' }, lvl(r.bv) + imp(r.bi)), word ? h('span', { class: 'k' }, word) : null));
      cLines.push(h('span', { class: 'line' }, h('span', { class: 'v' }, lvl(r.cv) + imp(r.ci)), word ? h('span', { class: 'k' }, word) : null));
      chLines.push(h('span', { class: 'line ' + r.tone }, h('span', { class: 'v' }, changeText(row, r.d, units) + (r.rel ? ` (${r.rel})` : '')), word ? h('span', { class: 'k' }, word) : null));
    }
    const dCh = cn.n_children_biofortified - bn.n_children_biofortified;
    const dCases = cn.n_stunting_averted - bn.n_stunting_averted;
    if (acrossGroup === 'stunting' && p > 0 && dCh > 1000 && Math.abs(dCases) < 0.5) step = true;
    if (step) chLines.push(h('small', { class: 'stepflag' }, 'step: more children reached, same cases averted'));
    return h('tr', { class: (p === pen ? 'hl ' : '') + (step ? 'step' : '') },
      h('th', { scope: 'row' }, p + '%'),
      h('td', { class: 'none', 'data-label': 'No biofortified seed' }, noneLines),
      h('td', { 'data-label': names.b }, bLines),
      h('td', { 'data-label': names.c }, cLines),
      h('td', { class: 'chg', 'data-label': 'Change in impact' }, chLines));
  }));
  els.across.replaceChildren(h('div', { class: 'impact-wrap' }, h('table', { class: 'impact across' }, head, body)));
}

function copySummary(sentences, none, b, c, names, pen, units, pathLabel, noneC) {
  const lines = [...sentences, '', `At ${pen}% of maize land (${pathLabel}). pp = percentage points; % = relative to the baseline's impact.`,
    `Measure | No biofortified seed | ${names.b} | ${names.c} | Change in impact`];
  for (const row of IMPACT_ROWS) {
    const r = computeImpact(row, none, b, c, noneC); // same numbers as the table on screen
    lines.push(`${row.label} | ${row.kind === 'ratio' || row.noNone ? '–' : levelText(row, r.nv, units)} | ${levelText(row, r.bv, units)} | ${levelText(row, r.cv, units)} | ${changeText(row, r.d, units)}${r.rel ? ` (${r.rel})` : ''}`);
  }
  lines.push(`Engine: ${info.mode}${info.mode === 'mock' ? ' (placeholder numbers)' : ''}. ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  const text = lines.join('\n');
  const fallback = () => { const ta = h('textarea', { style: { position: 'fixed', top: '-1000px' } }, text); document.body.append(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ } ta.remove(); toast(ok ? 'Summary copied' : 'Clipboard not available'); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => toast('Summary copied'), fallback);
  else fallback();
}

async function main() {
  info = await loadEngine();
  defaults = info.defaults;
  runner = new Runner(info.engine, defaults);
  const app = document.getElementById('app');
  els.controls = h('div', { class: 'card-body' });
  els.progress = h('div');
  els.warnings = h('div', { class: 'warn-list' });
  els.headline = h('div', { class: 'headline' });
  els.impact = h('div', { class: 'card-body', style: { padding: '4px 8px' } });
  els.impactFoot = h('div', { class: 'card-foot', style: { textAlign: 'left' } });
  const impactCard = h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('span', { class: 'ttl' }, 'Impact at the chosen share of maize land')), els.impact, els.impactFoot);
  els.deptPlot = h('div', { class: 'plot tall' });
  const deptSel = h('select', { style: { maxWidth: '320px' }, 'aria-label': 'Department metric' }, DEPT_KPIS.map(k => h('option', { value: k, selected: k === deptKpi ? true : null }, kpiLabel(k))));
  deptSel.addEventListener('change', () => { deptKpi = deptSel.value; update(); });
  const deptCard = card('', 'map', [h('div', { class: 'table-tools' }, h('span', { class: 'lbl' }, 'Metric'), deptSel), h('div', { class: 'card-body', style: { padding: '6px' } }, els.deptPlot)]);
  els.deptTitle = deptCard.querySelector('.ttl');
  els.curves = CURVES.map(() => h('div', { class: 'plot curve' }));
  const curveCards = els.curves.map(p => card('', 'chart', h('div', { class: 'card-body', style: { padding: '6px' } }, p)));
  els.curveTitles = curveCards.map(c => c.querySelector('.ttl'));
  els.across = h('div');
  els.stepsNote = h('div', { style: { padding: '10px 14px 0' } });
  const groupSel = h('select', { style: { maxWidth: '260px' }, 'aria-label': 'Measures shown' }, Object.entries(ACROSS_GROUPS).map(([id, g]) => h('option', { value: id, selected: id === acrossGroup ? true : null }, g.label)));
  groupSel.addEventListener('change', () => { acrossGroup = groupSel.value; update(); });
  const acrossCard = card('Across shares of maize land', 'table', [h('div', { class: 'table-tools' }, h('span', { class: 'lbl' }, 'Show'), groupSel), els.stepsNote, h('div', { class: 'card-body', style: { padding: '4px 8px' } }, els.across)]);
  app.replaceChildren(renderHeader('compare'), renderBanner(info),
    h('div', { class: 'layout single' }, h('main', { class: 'content' },
      h('div', { class: 'page-title' }, h('h1', {}, 'Compare'), h('span', { class: 'sub' }, 'No biofortified seed, the baseline seed and a new seed or scenario, side by side.')),
      card('Scenarios', 'slider', els.controls),
      els.progress,
      els.warnings,
      els.headline,
      impactCard,
      acrossCard,
      h('div', { class: 'two-col', style: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }, id: 'curves' }, curveCards),
      deptCard)),
    renderFooter());
  // stack curves on narrow screens
  const mq = window.matchMedia('(max-width: 1100px)');
  const applyMq = () => { document.getElementById('curves').style.gridTemplateColumns = mq.matches ? (window.innerWidth < 700 ? 'minmax(0,1fr)' : 'repeat(2, minmax(0,1fr))') : 'repeat(3, minmax(0, 1fr))'; };
  mq.addEventListener('change', applyMq); window.addEventListener('resize', applyMq); applyMq();
  renderControls();
  await update();
}

main().catch(err => { console.error(err); document.getElementById('app').replaceChildren(h('div', { class: 'empty' }, 'Failed to start: ' + err.message)); });
