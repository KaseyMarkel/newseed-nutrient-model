// "Nutrient Boosts" page (extension): what the four sliders buy, nutrient by nutrient.
// Every number is an engine.run() at the sidebar's seed, subsidy, pathway and penetration.
import { h, card } from './ui.js';
import { fmtNum } from './units.js';
import { drawMap } from './map.js';
import { BOOSTS, BOOST_DEFAULTS, ENGINE_BOOSTS, boostParams, cleanBoosts, isDefaultBoost } from './boosts.js';
import { healthOutcomes, HEALTH_DEFAULTS } from './health.js';
import { CATALOG } from './nutrient_catalog.js';
import { EVIDENCE, EVIDENCE_NOTE } from './evidence.js';
import { yieldToUI } from './runner.js';

const CFG = { displayModeBar: false, responsive: true };
const FONT = { family: 'Segoe UI, system-ui, sans-serif', size: 12, color: '#262321' };
const SWEEP = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
// the inadequacy KPI that belongs to each slider
const INAD = { fe: 'iron_inad_pct', zn: 'zinc_inad_pct', prot: 'protein_inad_pct', va: 'va_inad_pct' };
const INAD_LABEL = { fe: 'Iron (absorbed)', zn: 'Zinc (absorbed)', prot: 'Utilizable protein', va: 'Vitamin A' };
for (const x of CATALOG) if (x.model && x.model.p0 > 0) { INAD[x.id] = `x_${x.id}_inad_pct`; INAD_LABEL[x.id] = x.label; }

export function buildNutrientsSkeleton(contentEl) {
  const sk = {};
  sk.intro = h('div', { class: 'card-body prose small' });
  sk.tiles = h('div', { class: 'tiles boost-tiles' });
  const top = card('National results at this boost', 'info', [sk.intro, h('div', { class: 'card-body' }, sk.tiles)]);
  sk.health = h('div', { class: 'card-body' });
  const hc = card('Health gains beyond stunting (per year)', 'list', sk.health,
    { foot: 'Annual, at full uptake of this scenario. DALYs = disability-adjusted life years averted, undiscounted.' });
  sk.contrib = h('div', { class: 'plot' });
  sk.inad = h('div', { class: 'plot' });
  const c1 = card('Stunting averted: each nutrient alone vs all together', 'chart', h('div', { class: 'card-body', style: { padding: '6px' } }, sk.contrib),
    { foot: 'Each bar re-runs the model with only that nutrient at its slider value and the others at 0%.' });
  const c2 = card('Inadequacy: before vs after, by nutrient', 'chart', h('div', { class: 'card-body', style: { padding: '6px' } }, sk.inad),
    { foot: 'Children aged 6-59 months. Before = no biofortified maize.' });
  sk.sweepStunt = h('div', { class: 'plot' });
  sk.sweepInad = h('div', { class: 'plot' });
  sk.sweepStatus = h('div', { class: 'note' });
  const c3 = card('Dose-response: stunting averted as one boost goes 0 → 100%', 'chart', h('div', { class: 'card-body', style: { padding: '6px' } }, sk.sweepStunt),
    { foot: 'One line per slider; the other sliders stay where they are. Dots = current setting.' });
  const c4 = card('Dose-response: inadequacy of each nutrient vs its own boost', 'chart', h('div', { class: 'card-body', style: { padding: '6px' } }, sk.sweepInad),
    { foot: 'Prevalence of inadequate intake (%), children 6-59 months.' });
  sk.vaMap = h('div', { class: 'plot map' });
  sk.vaTitle = h('span');
  const c5 = card('', 'map', h('div', { class: 'card-body', style: { padding: '6px' } }, sk.vaMap), { foot: 'Children aged 6-59 months. Probability-based estimate; see the evidence notes below.' });
  c5.querySelector('.ttl').textContent = 'Vitamin A inadequacy by department';
  sk.vaMapTitle = c5.querySelector('.ttl');
  sk.evidence = h('div', { class: 'card-body' });
  const c6 = card('What the research says each nutrient does', 'list', sk.evidence);
  sk.dalyBars = h('div', { class: 'plot' });
  const cD = card('DALYs averted per year, by nutrient', 'chart', h('div', { class: 'card-body', style: { padding: '6px' } }, sk.dalyBars),
    { foot: 'From the health table above; low-confidence pathways count only when ticked there.' });
  sk.sweepDaly = h('div', { class: 'plot' });
  const cDS = card('Dose-response: DALYs averted per year as one boost goes 0 → 100%', 'chart', h('div', { class: 'card-body', style: { padding: '6px' } }, sk.sweepDaly),
    { foot: 'One line per slider that changes DALYs; the other sliders stay where they are. Dots = current setting.' });
  contentEl.append(top, hc, h('div', { class: 'two-col' }, c1, cD), h('div', { class: 'two-col' }, c2, c5), sk.sweepStatus,
    h('div', { class: 'two-col' }, c3, cDS), h('div', { class: 'two-col' }, c4, c6));
  renderEvidence(sk.evidence);
  return sk;
}

function tile(label, value, sub, tone) {
  return h('div', { class: 'tile ' + (tone || '') }, h('div', { class: 'lab' }, label), h('div', { class: 'val' }, value), sub ? h('div', { class: 'sub' }, sub) : null);
}

const pp = v => (v >= 0 ? '−' : '+') + fmtNum(Math.abs(v), 1) + ' pp';

// opts: { runner, spec (without params), boosts, pathwayLabel, stale() }
export async function renderNutrients(sk, opts) {
  const { runner, spec, stale } = opts;
  const b = cleanBoosts(opts.boosts);
  const run = (bb, extra = {}) => runner.run({ ...spec, ...extra, params: boostParams(bb) });
  const res = run(b);
  const hp = opts.health || HEALTH_DEFAULTS;
  const health = healthOutcomes(res, b, hp);
  const rep = run(BOOST_DEFAULTS);
  const n = res.national, r0 = rep.national;
  const diff = !isDefaultBoost(b);
  const vsRep = (key, d = 0, sign = false) => diff ? `replica: ${sign ? (r0[key] >= 0 ? '+' : '') : ''}${fmtNum(r0[key], d)}` : null;

  sk.intro.replaceChildren(
    h('p', {}, h('b', {}, `${spec.penetration}% of maize land biofortified`), ` · ${opts.pathwayLabel} stunting pathway. `,
      'Sliders in the sidebar set how much more of each nutrient biofortified maize carries. ',
      diff ? h('span', { class: 'tag warn' }, 'boosts differ from the replica') : h('span', { class: 'tag ok' }, 'replica values: numbers match the replica exactly')),
    spec.pathway === 'pma'
      ? h('p', { class: 'muted' }, 'Meta-analysis pathway: only protein quality moves stunting (Gunaratna et al. 2010 QPM effect, scaled by the protein boost). Iron and zinc change inadequacy only. Switch to the covariate pathway to let iron and zinc move height-for-age.')
      : h('p', { class: 'muted' }, 'Covariate pathway: iron, zinc, lysine and tryptophan form the nutrition index that predicts height-for-age; the protein-quality slider scales the lysine + tryptophan part. Provitamin A is not in either stunting model.'));

  sk.tiles.replaceChildren(
    tile('Stunting cases averted', fmtNum(n.n_stunting_averted, 0), `${fmtNum(n.stunting_change_pp, 2)} pp` + (diff ? ` · replica: ${fmtNum(r0.n_stunting_averted, 0)}` : ''), 'hl'),
    tile('DALYs averted per year', fmtNum(health.dalys, 0), `range ${fmtNum(health.lo, 0)} to ${fmtNum(health.hi, 0)}` + (hp.stunting ? '' : ' · stunting excluded') + (hp.exclude_low ? ' · low-confidence excluded' : ''), 'hl'),
    tile('Iron inadequacy', fmtNum(n.iron_inad_pct, 1) + '%', `${pp(n.iron_inad_change_pp)} vs before` + (diff ? ` · ${vsRep('iron_inad_pct', 1)}%` : '')),
    tile('Zinc inadequacy', fmtNum(n.zinc_inad_pct, 1) + '%', `${pp(n.zinc_inad_change_pp)} vs before` + (diff ? ` · ${vsRep('zinc_inad_pct', 1)}%` : '')),
    tile('Protein inadequacy', fmtNum(n.protein_inad_pct, 1) + '%', `${pp(n.protein_inad_change_pp)} vs before` + (diff ? ` · ${vsRep('protein_inad_pct', 1)}%` : '')),
    tile('Vitamin A inadequacy', fmtNum(n.va_inad_pct, 1) + '%', `${pp(n.va_inad_change_pp)} vs before · ${fmtNum(n.n_va_inad_averted, 0)} children`, 'new'));

  renderHealth(sk.health, res, b, hp, opts.onHealth);
  // DALYs by nutrient
  const dn = BOOSTS.filter(x => (health.byNutrient[x.id] || 0) > 0).map(x => ({ lab: x.label, v: health.byNutrient[x.id], c: x.color }));
  if (health.byNutrient.stunt) dn.push({ lab: 'Stunting (child deaths)', v: health.byNutrient.stunt, c: '#2e7d4f' });
  dn.sort((a, c) => c.v - a.v);
  await Plotly.react(sk.dalyBars, [{ type: 'bar', orientation: 'h', y: dn.map(x => x.lab), x: dn.map(x => x.v), marker: { color: dn.map(x => x.c) },
    text: dn.map(x => fmtNum(x.v, 0)), textposition: 'auto', hovertemplate: '%{y}: %{x:,.0f} DALYs/yr<extra></extra>' }],
  { font: FONT, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 10, r: 20, t: 10, b: 45 }, height: 300,
    xaxis: { title: { text: 'DALYs averted per year' }, gridcolor: '#eee8e2', rangemode: 'tozero' }, yaxis: { automargin: true, autorange: 'reversed' },
    annotations: dn.length ? [] : [{ text: 'No DALYs at these settings', showarrow: false, xref: 'paper', yref: 'paper', x: 0.5, y: 0.5 }] }, CFG);
  if (stale()) return;

  // contribution bars
  const alone = BOOSTS.filter(x => ['fe', 'zn', 'prot'].includes(x.id)).map(x => {
    const bb = { fe: 0, zn: 0, prot: 0, va: 0, fol: 0, [x.id]: b[x.id] };
    return { x, v: run(bb).national.n_stunting_averted };
  });
  const sumAlone = alone.reduce((s, a) => s + a.v, 0);
  const bars = [...alone.map(a => ({ lab: `${a.x.label} alone (+${b[a.x.id]}%)`, v: a.v, c: a.x.color })),
    { lab: 'Sum of the three alone', v: sumAlone, c: '#c9c2bb' },
    { lab: 'All boosts together', v: n.n_stunting_averted, c: '#2e7d4f' }];
  if (diff) bars.push({ lab: 'Replica (19 / 38 / 94)', v: r0.n_stunting_averted, c: '#9a918a' });
  await Plotly.react(sk.contrib, [{ type: 'bar', orientation: 'h', y: bars.map(x => x.lab), x: bars.map(x => x.v), marker: { color: bars.map(x => x.c) },
    text: bars.map(x => fmtNum(x.v, 0)), textposition: 'auto', hovertemplate: '%{y}: %{x:,.0f} children<extra></extra>' }],
  { font: FONT, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 10, r: 20, t: 10, b: 45 }, height: 300,
    xaxis: { title: { text: 'Children with stunting averted' }, gridcolor: '#eee8e2', rangemode: 'tozero' }, yaxis: { automargin: true, autorange: 'reversed' } }, CFG);
  if (stale()) return;

  // inadequacy before / after
  const ids = ['fe', 'zn', 'prot', 'va', ...CATALOG.filter(x => INAD[x.id] && b[x.id] > 0).map(x => x.id)];
  const before = ids.map(id => n[INAD[id] + '_baseline']);
  const after = ids.map(id => n[INAD[id]]);
  const labs = ids.map(id => INAD_LABEL[id]);
  await Plotly.react(sk.inad, [
    { type: 'bar', name: 'Before (no biofortified maize)', x: labs, y: before, marker: { color: '#e8a39b' }, hovertemplate: '%{x}: %{y:.1f}%<extra>Before</extra>' },
    { type: 'bar', name: 'After, at these boosts', x: labs, y: after, marker: { color: ids.map(id => BOOSTS.find(x => x.id === id).color) }, hovertemplate: '%{x}: %{y:.1f}%<extra>After</extra>' }],
  { font: FONT, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', barmode: 'group', margin: { l: 50, r: 10, t: 30, b: 40 }, height: 300,
    yaxis: { title: { text: 'Inadequate intake (%)' }, ticksuffix: '%', gridcolor: '#eee8e2', rangemode: 'tozero' }, legend: { orientation: 'h', y: 1.12 } }, CFG);
  if (stale()) return;

  // vitamin A map
  sk.vaMapTitle.textContent = `Vitamin A inadequacy by department (provitamin A at ${b.va}% of target)`;
  await drawMap(sk.vaMap, {
    regions: res.departments.map(d => d.region), legend: 'Inadequacy (%)',
    z: res.departments.map(d => d.va_inad_pct),
    text: res.departments.map(d => `<b>${d.region}</b><br>Vitamin A inadequacy: ${fmtNum(d.va_inad_pct_baseline, 1)}% → ${fmtNum(d.va_inad_pct, 1)}%<br>Mean intake: ${fmtNum(d.mean_va_baseline, 0)} → ${fmtNum(d.mean_va, 0)} µg RAE/d`)
  }, { scale: 'ochre', zmin: 0 });
  if (stale()) return;

  // dose-response sweeps (44 runs, cached; drawn with a progress line)
  const lines = [];
  const SB = BOOSTS.filter(x => ENGINE_BOOSTS.includes(x.id));
  for (let k = 0; k < SB.length; k++) {
    const x = SB[k];
    sk.sweepStatus.textContent = `Running dose-response curves: ${x.label} (${k + 1} of ${SB.length})…`;
    sk.sweepStatus.style.display = '';
    await yieldToUI();
    if (stale()) return;
    const rs = SWEEP.map(v => runner.run({ ...spec, params: { ...boostParams({ ...b, [x.id]: v }), include_quantiles: false } }));
    lines.push({ x, ys: rs.map(r => r.national), dalys: rs.map((r, i) => healthOutcomes(r, { ...b, [x.id]: SWEEP[i] }, hp).dalys) });
  }
  sk.sweepStatus.style.display = 'none';
  const lay = (yt, suffix = '') => ({ font: FONT, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 60, r: 10, t: 30, b: 45 }, height: 320,
    xaxis: { title: { text: 'Boost (%)' }, ticksuffix: '%', gridcolor: '#eee8e2', range: [-2, 102] }, yaxis: { title: { text: yt }, ticksuffix: suffix, gridcolor: '#eee8e2', rangemode: 'tozero' },
    legend: { orientation: 'h', y: 1.14 }, hovermode: 'x unified' });
  const cur = (x, val) => ({ type: 'scatter', mode: 'markers', showlegend: false, x: [b[x.id]], y: [val], marker: { color: x.color, size: 11, line: { color: '#fff', width: 2 } }, hoverinfo: 'skip' });
  const stuntLines = lines.filter(l => ['fe', 'zn', 'prot'].includes(l.x.id));
  // DALY sweep: engine sweeps plus non-engine sliders (folate) on the current result
  const dl = lines.map(l => ({ x: l.x, y: l.dalys }));
  for (const x of BOOSTS.filter(z => !ENGINE_BOOSTS.includes(z.id))) dl.push({ x, y: SWEEP.map(v => healthOutcomes(res, { ...b, [x.id]: v }, hp).dalys) });
  const dlv = dl.filter(l => l.y.some(v => Math.abs(v - l.y[0]) > 1e-6));
  await Plotly.react(sk.sweepDaly, [
    ...dlv.map(l => ({ type: 'scatter', mode: 'lines', name: l.x.label, x: SWEEP, y: l.y, line: { color: l.x.color, width: 2.4 }, hovertemplate: '%{y:,.0f}' })),
    ...dlv.map(l => cur(l.x, health.dalys))], lay('DALYs averted per year'), CFG);
  if (stale()) return;
  await Plotly.react(sk.sweepStunt, [
    ...stuntLines.map(l => ({ type: 'scatter', mode: 'lines', name: l.x.label, x: SWEEP, y: l.ys.map(r => r.n_stunting_averted), line: { color: l.x.color, width: 2.4 }, hovertemplate: '%{y:,.0f}' })),
    ...stuntLines.map(l => cur(l.x, n.n_stunting_averted))], lay('Children with stunting averted'), CFG);
  if (stale()) return;
  await Plotly.react(sk.sweepInad, [
    ...lines.filter(l => INAD[l.x.id]).map(l => ({ type: 'scatter', mode: 'lines', name: INAD_LABEL[l.x.id], x: SWEEP, y: l.ys.map(r => r[INAD[l.x.id]]), line: { color: l.x.color, width: 2.4 }, hovertemplate: '%{y:.1f}%' })),
    ...lines.filter(l => INAD[l.x.id]).map(l => cur(l.x, n[INAD[l.x.id]]))], lay('Inadequate intake (%)', '%'), CFG);
}

function renderEvidence(el) {
  const rows = EVIDENCE.map(e => h('div', { class: 'ev' + (e.extra ? ' extra' : '') },
    h('div', { class: 'ev-head' }, h('i', { style: { background: e.color } }), h('b', {}, e.nutrient), h('span', { class: 'conf conf-' + e.confidence }, e.confidenceLabel)),
    h('dl', {}, ...e.items.flatMap(([k, v]) => [h('dt', {}, k), h('dd', { html: v })]))));
  el.replaceChildren(h('div', { class: 'note info' }, EVIDENCE_NOTE), ...rows);
}

const NUT_COLOR = Object.fromEntries(BOOSTS.map(x => [x.id, x.color]));
const NUT_NAME = { ...Object.fromEntries(BOOSTS.map(x => [x.id, x.label])), stunt: 'Stunting' };
NUT_COLOR.stunt = '#2e7d4f';
function renderHealth(el, res, b, hp, onHealth) {
  const out = healthOutcomes(res, b, hp);
  const fmtV = v => Math.abs(v) >= 100 ? fmtNum(v, 0) : fmtNum(v, 1);
  const fmtD = v => Math.abs(v) >= 10 ? fmtNum(v, 0) : fmtNum(v, 1);
  const row = r => h('tr', { class: (r.conf === 'low' ? 'spec' : '') + (r.included ? '' : ' off') },
    h('td', {}, h('span', { class: 'dot', style: { background: NUT_COLOR[r.nutrient] } }), r.outcome, h('div', { class: 'how' }, r.how)),
    h('td', { class: 'num' }, NUT_NAME[r.nutrient]),
    h('td', { class: 'num' }, fmtV(r.value)),
    h('td', { class: 'num' }, r.included ? fmtD(r.dalys) : h('span', { class: 'muted' }, 'excluded')),
    h('td', { class: 'num rng' }, `${fmtD(r.lo)} to ${fmtD(r.hi)}`),
    h('td', {}, h('span', { class: 'conf conf-' + r.conf }, r.conf)));
  const order = { moderate: 0, high: 0, low: 1 };
  const rows = out.rows.slice().sort((a, c) => order[a.conf] - order[c.conf] || c.dalys - a.dalys);
  const table = h('div', { class: 'table-wrap' }, h('table', { class: 'dt health' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Outcome averted'), h('th', { class: 'num' }, 'Nutrient'), h('th', { class: 'num' }, 'Cases / yr', h('div', { class: 'how' }, 'or children helped')),
      h('th', { class: 'num' }, 'DALYs / yr'), h('th', { class: 'num' }, 'Plausible range'), h('th', {}, 'Evidence'))),
    h('tbody', {}, ...rows.map(row),
      h('tr', { class: 'total' }, h('td', {}, 'Total DALYs averted per year'), h('td'), h('td'), h('td', { class: 'num' }, fmtNum(out.dalys, 0)),
        h('td', { class: 'num rng' }, `${fmtNum(out.lo, 0)} to ${fmtNum(out.hi, 0)}`), h('td')))));
  const set = patch => onHealth && onHealth({ ...hp, ...patch });
  const sel = h('select', { id: 'hp-anemia' }, [['sivesnu', 'SIVESNU 2018/19: 6.1% (venous blood)'], ['ensmi', 'ENSMI 2014/15: 32.4% (capillary blood)']]
    .map(([v, l]) => h('option', { value: v, selected: hp.anemia_baseline === v ? true : null }, l)));
  sel.addEventListener('change', () => set({ anemia_baseline: sel.value }));
  const disc = h('input', { id: 'hp-disc', type: 'range', min: 0, max: 1, step: 0.05, value: hp.zinc_food_discount });
  const discV = h('b', {}, hp.zinc_food_discount.toFixed(2));
  disc.addEventListener('input', () => { discV.textContent = (+disc.value).toFixed(2); });
  disc.addEventListener('change', () => set({ zinc_food_discount: +disc.value }));
  const fol = h('input', { id: 'hp-fol', type: 'number', min: 2, max: 40, step: 1, value: hp.serum_folate0 });
  fol.addEventListener('change', () => { const v = +fol.value; if (Number.isFinite(v)) set({ serum_folate0: Math.min(40, Math.max(2, v)) }); });
  const exl = h('input', { id: 'hp-exl', type: 'checkbox', checked: hp.exclude_low ? true : null });
  exl.addEventListener('change', () => set({ exclude_low: exl.checked }));
  const stu = h('input', { id: 'hp-stunt', type: 'checkbox', checked: hp.stunting ? true : null });
  stu.addEventListener('change', () => set({ stunting: stu.checked }));
  const controls = h('div', { class: 'hp-controls' },
    h('label', {}, h('span', {}, 'Child anemia baseline'), sel),
    h('label', {}, h('span', {}, 'Zinc: share of the trial effect a food keeps ', discV), disc),
    h('label', {}, h('span', {}, "Women's baseline serum folate (ng/mL)"), fol),
    h('label', { class: 'chk' }, stu, h('span', {}, 'Count stunting, through its link to child deaths')),
    h('label', { class: 'chk' }, exl, h('span', {}, 'Exclude low-confidence rows from the total')));
  const notes = h('div', { class: 'note info' },
    'Every row is a central estimate: as likely too high as too low. Low-confidence rows rest on generic evidence (a shortfall common in poor populations plus a trial elsewhere), not Guatemalan data. ',
    'The range assumes everything lands at its low or high end at once; a negative low end means the evidence allows harm. ',
    'No cost per DALY: New Seed’s subsidy also pays for yield and income gains.');
  el.replaceChildren(table, controls, notes);
}
