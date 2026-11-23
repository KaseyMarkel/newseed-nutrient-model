// Explorer: replica of the Azahar dashboard. Every number comes from engine.run().
import { loadEngine, DEFAULT_SEED, seedShort, MODEL_SEEDS } from './config.js';
import { getState, setState, subscribe } from './state.js';
import { h, renderHeader, renderBanner, renderFooter, buildSidebar, setupDrawer, controlsButton, card, icon, accordion, summaryTiles, econList, toast, downloadText } from './ui.js';
import { tileTexts } from './display.js';
import { PAGES, TABLE_GROUPS, TREND_KPIS, KPIS, kpiLabel } from './kpis.js';
import { unitLabel } from './units.js';
import { drawMap } from './map.js';
import { dumbbell, boxByDepartment, lollipop, pairChart, trendChart, SEED_COLORS, esc } from './charts.js';
import { mapSpec, auxSpec, inadequacyByAge, boxRows, tableCell } from './display.js';
import { engineNotes } from './notes.js';
import { allSeeds, allSubsidies } from './scenarios.js';
import { Runner, PEN_STEPS, yieldToUI } from './runner.js';
import { boostsOf, boostParams, boostCaption, isDefaultBoost } from './boosts.js';
import { buildNutrientsSkeleton, renderNutrients } from './nutrients_page.js';

const PAGE_TITLES = { nutrients: 'Nutrient Boosts', overview: 'Department Table', trends: 'KPI Trends', methodology: 'Methodology' };
const EXTRA_PAGES = ['nutrients', 'overview', 'trends', 'methodology'];

let info, defaults, runner;
let page = pageFromHash();
let sidebarEl, contentEl, headerEl, layoutEl;
let skeleton = null; // DOM refs for the current page
let openAcc = new Set(['Adoption scenario', 'Nutrient content boost', 'Visualizations', 'Column groups', 'KPI selection']);

function pageFromHash() {
  const id = (location.hash || '#nutrients').slice(1);
  // own keys only: '#constructor' or '#toString' must not resolve to Object.prototype members
  return Object.prototype.hasOwnProperty.call(PAGES, id) || EXTRA_PAGES.includes(id) ? id : 'nutrients';
}

function seeds() { return allSeeds(defaults); }
function subsidies() { return allSubsidies(defaults); }
function pathwayObj(id) { return defaults.pathways.find(p => p.id === id) || defaults.pathways[0]; }
function altPathway(id) { const ps = defaults.pathways; const i = ps.findIndex(p => p.id === id); return ps[(i + 1) % ps.length] ? ps[(i + 1) % ps.length].id : id; }

function currentSpec(overrides = {}) {
  const st = getState();
  return { seedId: st.seed, subsidyId: st.subsidy, pathway: st.pathway, penetration: st.penetration, params: boostParams(boostsOf(st)), ...overrides };
}
function selectedDepartments(res) {
  const st = getState();
  if (!st.departments) return res.departments;
  const set = new Set(st.departments);
  return res.departments.filter(d => set.has(d.region));
}
function caption() {
  const st = getState();
  const seed = seeds().find(s => s.id === st.seed);
  const b = boostsOf(st);
  return `${st.penetration}% of maize land biofortified, ${seed ? seedShort(seed) : st.seed}` + (isDefaultBoost(b) ? '' : ` (${boostCaption(b)})`);
}
// A seed or subsidy chosen earlier may have been deleted (custom) or be unknown on this
// port; never fall back silently to another seed while the caption names the old one.
function repairState() {
  const st = getState();
  const patch = {};
  if (!seeds().some(s => s.id === st.seed)) patch.seed = DEFAULT_SEED;
  if (!subsidies().some(s => s.id === st.subsidy)) patch.subsidy = 'sub00';
  if (!defaults.pathways.some(p => p.id === st.pathway)) patch.pathway = defaults.pathways[0].id;
  if (Object.keys(patch).length) setState(patch, { silent: true });
  return patch;
}

// ---------------------------------------------------------------- sidebar
function rebuildSidebar() {
  const st = getState();
  layoutEl.classList.toggle('single', page === 'methodology');
  sidebarEl.style.display = page === 'methodology' ? 'none' : '';
  if (page === 'methodology') { sidebarEl.replaceChildren(); return; }
  // remember open accordions
  if (sidebarEl.firstChild) {
    sidebarEl.querySelectorAll('details.acc').forEach(d => { const t = d.querySelector('summary span')?.textContent; if (!t) return; if (d.open) openAcc.add(t); else openAcc.delete(t); });
  }
  // keep the sidebar's scroll position and opened nutrient groups across rebuilds
  const oldInner = sidebarEl.querySelector('.sidebar-inner');
  const keepScroll = oldInner ? oldInner.scrollTop : 0;
  const openGroups = new Set([...sidebarEl.querySelectorAll('details.boost-group[open] > summary')].map(x => x.firstChild && x.firstChild.textContent));
  const def = PAGES[page];
  const extra = [];
  if (page === 'overview') {
    const list = h('div', { class: 'check-list' }, TABLE_GROUPS.map(g => {
      const inp = h('input', { type: 'checkbox', checked: st.tableGroups.includes(g.id) ? true : null });
      inp.addEventListener('change', () => { const cur = new Set(getState().tableGroups); if (inp.checked) cur.add(g.id); else cur.delete(g.id); setState({ tableGroups: TABLE_GROUPS.map(x => x.id).filter(id => cur.has(id)) }); });
      return h('label', {}, inp, g.label);
    }));
    extra.push(accordion('Column groups', 'columns', [list, h('div', { class: 'note info' }, 'Select column groups to display in the table.')], true));
  }
  if (page === 'trends') {
    const panels = ['A (top-left)', 'B (top-right)', 'C (bottom-left)', 'D (bottom-right)'].map((lab, i) => {
      const sel = h('select', {}, TREND_KPIS.map(k => h('option', { value: k, selected: st.trendKpis[i] === k ? true : null }, kpiLabel(k))));
      sel.addEventListener('change', () => { const arr = [...getState().trendKpis]; arr[i] = sel.value; setState({ trendKpis: arr }); });
      return h('div', { class: 'field' }, h('label', {}, 'Panel ' + lab), sel);
    });
    const seedChecks = h('div', { class: 'check-list' }, seeds().map(s => {
      const on = st.trendSeeds ? st.trendSeeds.includes(s.id) : s.official; // default: Azahar's seeds + the 2030 seed
      const inp = h('input', { type: 'checkbox', checked: on ? true : null });
      inp.addEventListener('change', () => { const cur = new Set(getState().trendSeeds || seeds().filter(x => x.official).map(x => x.id)); if (inp.checked) cur.add(s.id); else cur.delete(s.id); setState({ trendSeeds: [...cur] }); });
      return h('label', {}, inp, s.label + (s.official ? '' : ' ✦'));
    }));
    extra.push(accordion('KPI selection', 'table', [...panels, h('div', { class: 'lbl' }, 'Seeds'), seedChecks, h('div', { class: 'note' }, h('strong', {}, 'Note: '), 'All nutrient metrics are national aggregates for children aged 6-59 months.')], true));
  }
  const sb = buildSidebar({
    title: def ? def.title : PAGE_TITLES[page],
    page,
    vizOptions: def ? def.viz : null,
    note: def ? def.note : null,
    seeds: seeds(), subsidies: subsidies(), pathways: defaults.pathways,
    showDepartments: page !== 'trends' && page !== 'nutrients',
    showPenetration: page !== 'trends',
    showSeed: page !== 'trends',
    showSubsidy: true,
    extra
  });
  sidebarEl.replaceChildren(sb);
  sb.querySelectorAll('details.acc').forEach(d => { const t = d.querySelector('summary span')?.textContent; if (t) d.open = openAcc.has(t); });
  sb.querySelectorAll('details.boost-group > summary').forEach(x => { if (openGroups.has(x.firstChild && x.firstChild.textContent)) x.parentElement.open = true; });
  sb.scrollTop = keepScroll;
}

// ---------------------------------------------------------------- content
function buildSkeleton() {
  contentEl.replaceChildren();
  const def = PAGES[page];
  const title = h('div', { class: 'page-title' }, h('h1', {}, def ? def.title : PAGE_TITLES[page]), h('span', { class: 'sub' }), controlsButton());
  const warn = h('div', { class: 'warn-list page-warn' });
  contentEl.append(title, warn);
  skeleton = { title, sub: title.querySelector('.sub'), warn };
  if (def) {
    const mapDiv = h('div', { class: 'plot map' });
    const mapCard = card('', 'map', h('div', { class: 'card-body', style: { padding: '6px' } }, mapDiv), { foot: def.population });
    const tilesWrap = h('div', { class: 'card-body' });
    const summaryCard = card(def.summary.title, 'info', tilesWrap);
    const econWrap = h('div', { class: 'card-body' });
    const econCard = card('Production & economic impact', 'chart', econWrap);
    contentEl.append(h('div', { class: 'grid-main' }, mapCard, h('div', { class: 'stack' }, summaryCard, econCard)));
    skeleton.mapDiv = mapDiv; skeleton.mapTitle = mapCard.querySelector('.ttl'); skeleton.tiles = tilesWrap; skeleton.econ = econWrap;
    // the chart under the map (dumbbell / lollipop, as the live app per visualisation); the
    // consumption page has one too (except for maize consumption) above its box plots
    if (def.chart === 'dumbbell' || def.chart === 'lollipop' || page === 'consumption') {
      const plot = h('div', { class: 'plot tall' });
      const c = card('', 'list', h('div', { class: 'card-body', style: { padding: '6px' } }, plot), { foot: def.population });
      contentEl.append(c);
      skeleton.chart = plot; skeleton.chartTitle = c.querySelector('.ttl'); skeleton.chartCard = c;
    }
    if (def.chart === 'box') {
      const p1 = h('div', { class: 'plot box' }), p2 = h('div', { class: 'plot box' });
      const f1 = h('span', {}), f2 = h('span', {});
      const c1 = card('', 'list', h('div', { class: 'card-body', style: { padding: '6px' } }, p1), { foot: f1 });
      const c2 = card('', 'list', h('div', { class: 'card-body', style: { padding: '6px' } }, p2), { foot: f2 });
      contentEl.append(h('div', { class: 'two-col' }, c1, c2));
      skeleton.box = [p1, p2]; skeleton.boxTitles = [c1.querySelector('.ttl'), c2.querySelector('.ttl')]; skeleton.boxFoots = [f1, f2];
    }
  } else if (page === 'nutrients') {
    Object.assign(skeleton, buildNutrientsSkeleton(contentEl));
  } else if (page === 'overview') {
    const search = h('input', { type: 'text', placeholder: 'Search department', 'aria-label': 'Search department' });
    const dl = h('button', { class: 'btn small' }, icon('download'), 'Download CSV');
    const status = h('span', { class: 'right' });
    const wrap = h('div', { class: 'table-wrap' });
    const c = card('', 'table', [h('div', { class: 'table-tools' }, search, dl, status), wrap]);
    contentEl.append(c);
    skeleton.tableTitle = c.querySelector('.ttl'); skeleton.tableWrap = wrap; skeleton.search = search; skeleton.status = status; skeleton.dl = dl;
    search.addEventListener('input', () => renderTable());
    dl.addEventListener('click', () => downloadTable());
  } else if (page === 'methodology') {
    title.querySelector('.controls-btn')?.remove();
    contentEl.append(methodologyCard());
  } else if (page === 'trends') {
    const plots = [0, 1, 2, 3].map(() => h('div', { class: 'plot trend' }));
    const cards = plots.map((p, i) => card('', 'chart', h('div', { class: 'card-body', style: { padding: '6px' } }, p)));
    contentEl.append(h('div', { class: 'two-col' }, cards[0], cards[1]), h('div', { class: 'two-col' }, cards[2], cards[3]));
    skeleton.trendPlots = plots; skeleton.trendTitles = cards.map(c => c.querySelector('.ttl'));
  }
}

function methodologyCard() {
  const step = (cls, t, body) => h('div', { class: 'step ' + cls }, h('b', {}, t), h('span', {}, body));
  const s30 = MODEL_SEEDS[0];
  return h('div', { class: 'card' }, h('div', { class: 'card-body prose' },
    h('p', {}, 'This dashboard reproduces Azahar’s ex-ante model of biofortified maize in Guatemala from their public code, and runs it in your browser. Every number comes from the same chain:'),
    h('div', { class: 'chain' },
      step('e', '1. Seed yield', 'Each seed changes yield by farmer segment: OPV/criollo, low, mid and high hybrid users.'),
      step('e', '2. Adoption', 'Farmers (ENCOVI 2023) are ranked by how likely they are to adopt. The slider sets the national share of maize land planted with biofortified seed.'),
      step('e', '3. Production and income', 'Converted land times the yield change gives extra maize; its value minus the seed-cost difference gives the income change. The subsidy regime sets who pays for the seed.'),
      step('e', '4. Distribution', 'Maize moves from where it is grown to where it is eaten (a gravity model on road travel times), giving each department’s share of maize eaten that is biofortified.'),
      step('n', '5. Children reached', 'In each department, children are flagged as eating biofortified maize until that share is met, farming households first.'),
      step('n', '6. Nutrients', 'Biofortified maize carries more iron, zinc and quality protein; intakes and inadequacy are recomputed child by child.'),
      step('n', '7. Stunting', 'Two pathways: a model of height-for-age on a nutrition index (covariate), or the Gunaratna et al. (2010) growth effect of quality-protein maize (meta-analysis). A child is stunted below -2 SD.')),
    h('h2', {}, 'The 2030 seed'),
    h('p', {}, s30.note),
    h('h2', {}, 'Full documentation'),
    h('p', {}, 'Azahar’s ', h('a', { href: 'https://newseed.azahardata.com/web-guatemala/index.html', target: '_blank', rel: 'noopener' }, 'methodological documentation'), ' explains every step, data source and assumption. The ', h('a', { href: 'about.html' }, 'About'), ' page (under Tools) covers units, how this replica was built and how it was checked.')));
}

// Any failure while drawing is shown on the page instead of an unhandled promise rejection.
async function updateContent() {
  try { await updateContentInner(); } catch (e) {
    console.error(e);
    if (skeleton && skeleton.warn) skeleton.warn.replaceChildren(h('div', { class: 'note err' }, `This page could not be drawn: ${e && e.message ? e.message : e}. Reload the page; if it happens again, reset the controls.`));
  }
}
async function updateContentInner() {
  // a custom seed or regime deleted in another tab (Scenario Lab) while this page is open:
  // switch to the default and say so, never run another seed under the old name
  const before = { ...getState() };
  const fixed = repairState();
  if (Object.keys(fixed).length) {
    rebuildSidebar();
    const what = [fixed.seed ? `seed "${before.seed}"` : '', fixed.subsidy ? `subsidy regime "${before.subsidy}"` : ''].filter(Boolean).join(' and ');
    const now = [fixed.seed ? 'the 2030 seed' : '', fixed.subsidy ? 'the current subsidy' : '', fixed.pathway ? 'the covariate pathway' : ''].filter(Boolean).join(' and ');
    toast(`The ${what || 'selection'} no longer exists (deleted in the Scenario Lab?); showing ${now}`);
  }
  const st = getState();
  const def = PAGES[page];
  if (page === 'methodology') { skeleton.sub.textContent = 'How the model works'; return; }
  skeleton.sub.textContent = page === 'trends' ? `${pathwayObj(st.pathway).label} · ${subsidies().find(s => s.id === st.subsidy)?.label || ''}` : caption();
  if (!def) renderToken++;
  if (def) await updateExplorerPage(def);
  else if (page === 'overview') renderTable();
  else if (page === 'trends') await renderTrends();
  else if (page === 'nutrients') await renderNutrientsPage();
}

let nutToken = 0;
async function renderNutrientsPage() {
  const token = ++nutToken;
  const st = getState();
  const spec = { seedId: st.seed, subsidyId: st.subsidy, pathway: st.pathway, penetration: st.penetration };
  const ok = runOrFail(() => runner.run({ ...spec, params: boostParams(boostsOf(st)) }));
  if (!ok) return;
  showNotes(ok);
  await renderNutrients(skeleton, { runner, spec, boosts: boostsOf(st), pathwayLabel: pathwayObj(st.pathway).label,
    health: st.health, onHealth: hp => setState({ health: hp }),
    stale: () => token !== nutToken || page !== 'nutrients' });
}

// Engine errors ("Invalid scenario: ...") and warnings (meta.warnings) are shown above the page;
// on an error the tiles, list and charts are cleared so no stale number stays on screen.
function runOrFail(fn) {
  try { return fn(); } catch (e) {
    console.warn(e); // handled: the message is shown on the page
    skeleton.warn.replaceChildren(h('div', { class: 'note err' }, `The model could not run this scenario: ${e && e.message ? e.message : e}. Pick another seed or fix it in the Scenario Lab.`));
    for (const el of [skeleton.mapDiv, skeleton.chart, ...(skeleton.box || []), ...(skeleton.trendPlots || [])]) if (el) { try { Plotly.purge(el); } catch (err) { /* not drawn */ } }
    if (skeleton.tiles) skeleton.tiles.replaceChildren(h('div', { class: 'note' }, 'No results.'));
    if (skeleton.econ) skeleton.econ.replaceChildren();
    if (skeleton.tableWrap) skeleton.tableWrap.replaceChildren(h('div', { class: 'note' }, 'No results.'));
    return null;
  }
}
function showNotes(...results) { const nm = seedShort(seeds().find(x => x.id === getState().seed)); skeleton.warn.replaceChildren(...engineNotes(results, results.map(() => nm))); }

// Every render gets a token; a render that resumes after a newer one started (rapid slider moves,
// switching page or seed while charts draw) stops instead of writing stale numbers or traces.
let renderToken = 0;
async function updateExplorerPage(def) {
  const token = ++renderToken;
  const stale = () => token !== renderToken;
  const st = getState();
  const units = st.units;
  const viz = def.viz.find(v => v.id === st.viz[page]) || def.viz[0];
  const inadMode = viz.id === 'inadequacy';
  const out = runOrFail(() => ({
    res: runner.run(currentSpec()),
    alt: st.compare ? runner.run(currentSpec({ pathway: altPathway(st.pathway) })) : null,
    res0: inadMode ? runner.run(currentSpec({ penetration: 0 })) : null
  }));
  if (!out) return;
  const { res, alt, res0 } = out;
  showNotes(res);
  const deps = selectedDepartments(res);
  if (!deps.length) skeleton.warn.append(h('div', { class: 'note' }, 'No departments selected: the charts below the map are empty. Pick departments under Departments; the map and the tiles always show every department and the national figures.'));
  const nat = res.national;
  const altLabel = alt ? pathwayObj(altPathway(st.pathway)).label.split(' ')[0] : '';

  // map: colour values, legend and hover text as the live app (display.js mapSpec)
  // the map always shows all 22 departments (as the live app); the department filter applies to
  // the charts below and the Department Table
  skeleton.mapTitle.textContent = `${viz.mapTitle} at ${caption()}`;
  await drawMap(skeleton.mapDiv, mapSpec(page, viz.id, res.departments, units), { scale: def.scale });
  if (stale()) return;

  // tiles
  const tilesEl = summaryTiles(def.summary, nat, units);
  if (alt) {
    const altTiles = tileTexts(def.summary, alt.national, units);
    [...tilesEl.children].forEach((t, i) => t.append(h('div', { class: 'sub' }, `${altLabel}: ${altTiles[i].text}`)));
  }
  skeleton.tiles.replaceChildren(tilesEl);
  skeleton.econ.replaceChildren(econList(nat, units));

  // chart under the map
  if (skeleton.chart) {
    const spec = auxSpec(page, viz.id, deps, units);
    skeleton.chartCard.style.display = spec ? '' : 'none';
    if (spec) {
      skeleton.chartTitle.textContent = `${spec.title} at ${caption()}`;
      if (spec.kind === 'dumbbell') await dumbbell(skeleton.chart, spec);
      else if (spec.kind === 'pair') await pairChart(skeleton.chart, spec);
      else await lollipop(skeleton.chart, spec);
      if (stale()) return;
      if (alt && page === 'stunting') {
        const a = auxSpec(page, viz.id, selectedDepartments(alt), units);
        await Plotly.addTraces(skeleton.chart, { type: 'scatter', mode: 'markers', name: `After (${altLabel})`,
          x: a.rows.map(r => r.value), y: a.rows.map(r => r.region), text: a.rows.map(r => `${r.text}<br>(${esc(altLabel)} pathway)`), hovertemplate: '<b>%{y}</b><br>%{text}<extra></extra>',
          marker: { symbol: 'circle-open', color: '#8e3129', size: 10, line: { width: 1.5 } } });
        if (stale()) return;
      }
    }
  }
  // box plots of intake by age group, or (iron, zinc, protein in inadequacy mode) inadequacy
  // before and after by age group, as the live app
  if (def.chart === 'box') {
    const b = def.box;
    const bands = ['under36', '36to59'];
    const inad = inadMode ? inadequacyByAge(page, deps, selectedDepartments(res0)) : null;
    const seedLabel = seedShort(seeds().find(s => s.id === st.seed)) || st.seed;
    for (let i = 0; i < 2; i++) {
      const months = inad ? inad[i].band.replace('mo', ' months') : (i === 0 ? '6-35 months' : '36-59 months');
      const ear = Array.isArray(b.ear) ? b.ear[i] : b.ear;
      const earText = Array.isArray(b.earText) ? b.earText[i] : b.earText;
      skeleton.box[i].classList.toggle('tall', !!inad);
      if (inad) {
        skeleton.boxTitles[i].textContent = `${viz.mapTitle} at ${caption()} (${inad[i].band})`;
        skeleton.boxFoots[i].textContent = `Children aged ${months}; before = no biofortified seed (0% of maize land)`;
        await dumbbell(skeleton.box[i], inad[i]);
        if (stale()) return;
      } else {
        skeleton.boxTitles[i].textContent = `${page === 'consumption' ? 'Maize consumption' : viz.mapTitle} (${i === 0 ? '6-35mo' : '36-59mo'}, ${seedLabel})`;
        skeleton.boxFoots[i].textContent = `Children aged ${months}` + (earText ? ` · ${earText}` : '');
        await boxByDepartment(skeleton.box[i], boxRows(deps, b.prefix, bands[i]), { unit: b.unit, ear, horizontal: !!b.horizontal });
        if (stale()) return;
      }
    }
  }
}

// ---- Department table ----
function tableColumns() {
  const st = getState();
  const cols = [];
  for (const g of TABLE_GROUPS) if (st.tableGroups.includes(g.id)) cols.push(...g.cols);
  return cols;
}
const cellValue = tableCell; // display.js (checked against the live Department Table)
function headerUnit(col, units) {
  const meta = KPIS[col.key] || {};
  const u = unitLabel(col.key, units);
  if (!u || meta.unit === 'count' || meta.unit === 'people') return '';
  return u;
}
function renderTable() {
  const st = getState();
  const units = st.units;
  const res = runOrFail(() => runner.run(currentSpec()));
  if (!res) return;
  showNotes(res);
  const q = (skeleton.search.value || '').trim().toLowerCase();
  const deps = selectedDepartments(res).filter(d => !q || d.region.toLowerCase().includes(q));
  const cols = tableColumns();
  skeleton.tableTitle.textContent = `Impact overview by department at ${caption()}`;
  skeleton.status.textContent = `${deps.length + 1} regions, ${cols.length} metrics`;
  const thead = h('thead', {}, h('tr', {}, h('th', {}, 'Region'), cols.map(c => h('th', {}, c.label, h('span', { class: 'u' }, headerUnit(c, units) || ' ')))));
  const rowEl = (row, cls) => h('tr', { class: cls }, h('td', {}, row.region), cols.map(c => { const v = cellValue(row, c, units); return h('td', { class: v.neg ? 'neg' : '' }, v.text); }));
  const tbody = h('tbody', {}, rowEl({ region: 'Guatemala Total', ...res.national }, 'total'), deps.map(d => rowEl(d, '')));
  skeleton.tableWrap.replaceChildren(h('table', { class: 'dt' }, thead, tbody));
}
function downloadTable() {
  const st = getState();
  const units = st.units;
  const res = runOrFail(() => runner.run(currentSpec()));
  if (!res) return;
  const cols = tableColumns();
  const rows = [{ region: 'Guatemala Total', ...res.national }, ...selectedDepartments(res)];
  const head = ['Region', ...cols.map(c => c.label + (headerUnit(c, units) ? ` (${headerUnit(c, units)})` : ''))];
  const lines = [head.join(',')];
  for (const r of rows) lines.push([`"${r.region}"`, ...cols.map(c => `"${cellValue(r, c, units).text}"`)].join(','));
  downloadText(`department_table_${st.seed}_${st.subsidy}_${st.pathway}_${st.penetration}pct.csv`, lines.join('\n'), 'text/csv');
  toast('CSV downloaded');
}

// ---- KPI trends ----
// Each line is 11 model runs (about 0.4 s); a new subsidy or pathway needs all of them, so the
// curves are computed one at a time with a progress line instead of freezing the page.
let trendToken = 0;
// hover names of the live app's KPI Trends (the y value follows display.js trendValueText)
const TREND_LABELS = { n_stunting_averted: 'Children with stunting averted', iron_inad_pct: 'Iron inadequacy prevalence', zinc_inad_pct: 'Zinc inadequacy prevalence',
  protein_inad_pct: 'Protein inadequacy prevalence', iron_inad_change_pp: 'Iron inadequacy reduction', zinc_inad_change_pp: 'Zinc inadequacy reduction',
  protein_inad_change_pp: 'Protein inadequacy reduction', mean_zinc: 'Mean zinc intake (absorbed)', mean_protein: 'Mean protein intake',
  coverage_pct: 'Population coverage', income_per_farmer_adopter: 'Income per adopter', production_biofortified_mt: 'Biofortified production' };
async function renderTrends() {
  const token = ++trendToken;
  const st = getState();
  const units = st.units;
  const seedList = seeds().filter(s => st.trendSeeds ? st.trendSeeds.includes(s.id) : s.official);
  const alt = altPathway(st.pathway);
  const altWord = pathwayObj(alt).label.split(' ')[0];
  const lines = [];
  seedList.forEach(s => {
    const params = boostParams(boostsOf(st));
    lines.push({ seed: s, spec: { seedId: s.id, subsidyId: st.subsidy, pathway: st.pathway, params }, label: seedShort(s) });
    if (st.compare) lines.push({ seed: s, spec: { seedId: s.id, subsidyId: st.subsidy, pathway: alt, params }, label: `${seedShort(s)} (${altWord})`, dash: true });
  });
  const missing = lines.filter(l => PEN_STEPS.some(p => !runner.cache.has(runner.keyOf(runner.scenarioFor({ ...l.spec, penetration: p })))));
  // a line the model refuses (e.g. a custom seed edited by hand) is left out with a note; the others still draw
  const errors = [];
  const sub = skeleton.sub;
  const base = sub.textContent;
  for (let i = 0; i < missing.length; i++) {
    sub.replaceChildren(h('span', { class: 'progress' }, `Running the model: line ${i + 1} of ${missing.length}…`));
    await yieldToUI();
    if (token !== trendToken || page !== 'trends') return;
    try { runner.curve(missing[i].spec); } catch (e) { missing[i].error = e && e.message ? e.message : String(e); console.warn(e); }
  }
  sub.textContent = base;
  if (token !== trendToken || page !== 'trends') return;
  for (const l of lines) {
    if (l.error) { errors.push(l); continue; }
    try { l.curve = runner.curve(l.spec); } catch (e) { l.error = e && e.message ? e.message : String(e); errors.push(l); }
  }
  const ok = lines.filter(l => l.curve);
  skeleton.warn.replaceChildren(
    ...errors.map(l => h('div', { class: 'note err' }, `${l.label}: the model could not run this seed (${l.error}); its line is left out.`)),
    ...engineNotes(ok.map(l => l.curve).flat(), ok.flatMap(l => l.curve.map(() => l.label)), { landShare: false }));
  st.trendKpis.forEach((key, i) => {
    const series = ok.map(l => ({ label: l.label, x: PEN_STEPS, y: l.curve.map(r => r.national[key]), color: SEED_COLORS[seeds().indexOf(l.seed) % SEED_COLORS.length], dash: !!l.dash }));
    skeleton.trendTitles[i].textContent = `${'ABCD'[i]}: ${kpiLabel(key)} by share of maize land biofortified`;
    trendChart(skeleton.trendPlots[i], series, key, units, { label: TREND_LABELS[key] });
  });
}

// ---------------------------------------------------------------- shell
function setPage(id) {
  page = id;
  const hd = renderHeader(page);
  headerEl.replaceWith(hd); headerEl = hd;
  rebuildSidebar();
  buildSkeleton();
  document.title = `${PAGES[page] ? PAGES[page].title : PAGE_TITLES[page]} · New Seed Guatemala model replica`;
  updateContent();
}

async function main() {
  const t0 = performance.now();
  info = await loadEngine();
  defaults = info.defaults;
  runner = new Runner(info.engine, defaults);
  const app = document.getElementById('app');
  sidebarEl = h('aside', { class: 'sidebar' });
  contentEl = h('main', { class: 'content' });
  headerEl = renderHeader(page);
  layoutEl = h('div', { class: 'layout' }, sidebarEl, contentEl);
  repairState();
  app.replaceChildren(headerEl, renderBanner(info), layoutEl, renderFooter());
  setupDrawer(sidebarEl);
  window.addEventListener('hashchange', () => setPage(pageFromHash()));
  // custom seeds and regimes saved or deleted in another tab: refresh the pickers and the page
  window.addEventListener('storage', e => { if (e.key === 'azr.custom.v1' || e.key === null) { rebuildSidebar(); updateContent(); } });
  subscribe((st, patch) => {
    if ('compare' in patch || 'subsidy' in patch || 'boosts' in patch) rebuildSidebar();
    updateContent();
  });
  setPage(page);
  console.info(`Explorer ready in ${(performance.now() - t0).toFixed(0)} ms (${info.mode} engine)`);
}

main().catch(err => {
  console.error(err);
  document.getElementById('app').replaceChildren(h('div', { class: 'empty' }, 'Failed to start: ' + err.message));
});
