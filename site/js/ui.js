// Shared UI helpers: DOM builder, header, banner, accordions, tiles, sidebar controls.
import { getState, setState } from './state.js';
import { tileTexts, econTexts } from './display.js';
import { DEPARTMENTS } from './mock_reference.js';
import { BOOSTS, PRESETS, boostsOf, cleanBoosts, isDefaultBoost } from './boosts.js';
const setBoosts = b => setState({ boosts: cleanBoosts(b) });

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const ICONS = {
  slider: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M8 6h13M3 18h13"/><circle cx="5" cy="6" r="2" fill="currentColor"/><circle cx="19" cy="18" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
  method: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M5 7h14M8 11h8"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h3.5a1.75 1.75 0 010 3.5H11a1.75 1.75 0 000 3.5h3.5"/></svg>',
  seed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21c-5 0-8-3-8-8 5 0 8 3 8 8zM12 21c5 0 8-3 8-8-5 0-8 3-8 8zM12 21V9M9 6a3 3 0 016 0c0 2-3 3-3 3s-3-1-3-3z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/></svg>',
  table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  chevron: '<svg class="chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>',
  columns: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M6 11l6 6 6-6M4 21h16"/></svg>'
};

export function icon(name, cls = 'ic') {
  const span = h('span', { class: 'ic-wrap' });
  span.innerHTML = ICONS[name] || '';
  const svg = span.firstElementChild;
  if (svg) { svg.classList.add(cls); return svg; }
  return span;
}

// Azahar's dashboard structure (the main navigation) and the extra tools (one small menu).
export const DASH_NAV = [
  { group: 'Nutrient Boosts', page: 'nutrients' },
  { group: 'Nutrition', items: [['stunting', 'Stunting'], ['iron', 'Iron'], ['zinc', 'Zinc'], ['protein', 'Protein'], ['energy', 'Energy'], ['consumption', 'Consumption']] },
  { group: 'Economics', items: [['production', 'Production']] },
  { group: 'Overview', items: [['overview', 'Department Table'], ['trends', 'KPI Trends']] },
  { group: 'Methodology', page: 'methodology' }
];
const TOOLS = [
  { href: 'lab.html', label: 'Scenario Lab', id: 'lab', sub: 'make seeds, subsidies and scenarios' },
  { href: 'compare.html', label: 'Compare', id: 'compare', sub: 'none vs baseline vs new seed' },
  { href: 'about.html', label: 'About', id: 'about', sub: 'how the model chains together' }
];

function closeMenus(except) {
  document.querySelectorAll('details.dd[open]').forEach(d => { if (d !== except) d.open = false; });
}
if (typeof document !== 'undefined' && !window._azrMenuClose) {
  window._azrMenuClose = true;
  document.addEventListener('click', e => { if (!e.target.closest('details.dd')) closeMenus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });
}
function dropdown(label, items, active, extraClass = '') {
  const d = h('details', { class: 'dd ' + extraClass + (active ? ' active' : '') },
    h('summary', {}, label, h('span', { class: 'caret', html: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 9l6 6 6-6"/></svg>' })),
    h('div', { class: 'dd-menu' }, items));
  d.addEventListener('toggle', () => { if (d.open) closeMenus(d); });
  d.addEventListener('click', e => { if (e.target.closest('a')) d.open = false; });
  return d;
}

// activeId: an Explorer page id ('stunting', ..., 'methodology') or a tool id ('lab', ...).
export function renderHeader(activeId) {
  const onExplorer = !TOOLS.some(t => t.id === activeId);
  const nav = h('nav', { class: 'page-nav', 'aria-label': 'Dashboard pages' }, DASH_NAV.map(g => {
    if (g.page) return h('a', { href: 'index.html#' + g.page, class: 'nav-link' + (activeId === g.page ? ' active' : '') }, g.group);
    const act = g.items.some(([id]) => id === activeId);
    return dropdown(g.group, g.items.map(([id, label]) => h('a', { href: 'index.html#' + id, class: id === activeId ? 'active' : '' }, label)), act);
  }));
  const tools = dropdown('Tools', TOOLS.map(t => h('a', { href: t.href, class: t.id === activeId ? 'active' : '' }, h('b', {}, t.label), h('small', {}, t.sub))), !onExplorer, 'tools');
  tools.querySelector('summary').setAttribute('title', 'Scenario Lab, Compare, About');
  const header = h('header', { class: 'app-header' },
    h('div', { class: 'bar' },
      h('a', { class: 'brand', href: 'index.html' },
        h('span', { class: 'logo', html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M12 21c-5 0-8-3-8-8 5 0 8 3 8 8zM12 21c5 0 8-3 8-8-5 0-8 3-8 8zM12 21V9M9 6a3 3 0 016 0c0 2-3 3-3 3s-3-1-3-3z"/></svg>New Seed' }),
        h('span', { class: 'title' }, 'Guatemala model · nutrient boosts')),
      nav, tools));
  return header;
}

export function renderBanner(info) {
  if (info.mode === 'real') {
    return document.createTextNode('');
  }
  return h('div', { class: 'banner mock' }, h('span', { class: 'dot' }),
    h('span', {}, h('strong', {}, 'Mock data'), ' — placeholder engine; numbers have the right shape and magnitude but are not the model. ',
      h('span', { class: 'detail' }, info.reason ? `Reason: ${info.reason}. ` : '', 'The real engine (engine/engine.js) plugs in automatically once site/data/bundle_econ.json and bundle_nutrition.json exist.')));
}

export function renderFooter() {
  return h('footer', { class: 'site' },
    'Replica of the ', h('a', { href: 'https://newseed.azahardata.com/app-guatemala/', target: '_blank', rel: 'noopener' }, 'New Seed dashboard'),
    ' built from the public ', h('a', { href: 'https://github.com/Azahar-Data-Insights/newseed-biofortification-guatemala-public', target: '_blank', rel: 'noopener' }, 'Azahar repository'),
    '.');
}

export function accordion(title, iconName, body, open = true) {
  const d = h('details', { class: 'acc', open: open ? true : null },
    h('summary', {}, icon(iconName), h('span', {}, title), h('span', { html: ICONS.chevron })),
    h('div', { class: 'acc-body' }, body));
  return d;
}

export function card(title, iconName, body, opts = {}) {
  const head = h('div', { class: 'card-head' }, iconName ? icon(iconName) : null, h('span', { class: 'ttl' }, title),
    opts.right ? h('span', { class: 'right' }, opts.right) : null);
  const c = h('div', { class: 'card' }, head, body);
  if (opts.foot) c.append(h('div', { class: 'card-foot' }, opts.foot));
  return c;
}

export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = h('div', { class: 'toast' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---- tiles ----
export function tile(label, valueText, opts = {}) {
  return h('div', { class: 'tile ' + (opts.tone || '') },
    h('div', { class: 'lab' }, label),
    h('div', { class: 'val' }, valueText, opts.unit ? h('small', {}, opts.unit) : null),
    opts.sub ? h('div', { class: 'sub' }, opts.sub) : null);
}

// Texts come from display.js (checked against the live dashboard by tests/redteam/site_display_parity.mjs).
export function summaryTiles(def, national, units) {
  return h('div', { class: 'tiles' }, tileTexts(def, national, units).map(t => tile(t.label, t.text)));
}

export function econList(national, units) {
  return h('ul', { class: 'econ-list' }, econTexts(national, units).map(item =>
    h('li', {}, h('span', { class: 'k' }, item.label), h('span', { class: 'v' }, item.text))));
}

// ---- sidebar controls ----
// opts: { page: 'stunting'|..., vizOptions: [{id,label}], seeds: [...], subsidies: [...], pathways: [...],
//         showViz, showDepartments, showTableGroups, showTrendKpis, extra: [nodes] }
export function buildSidebar(opts) {
  const st = getState();
  const wrap = h('div', { class: 'sidebar-inner' });
  wrap.append(h('div', { class: 'sidebar-head' }, h('h2', {}, opts.title || 'Controls'),
    h('button', { class: 'btn small drawer-close', onClick: () => closeDrawer() }, 'Close')));

  // Adoption scenario
  if (opts.showPenetration !== false) {
    const chip = h('span', { class: 'pen-chip' }, st.penetration + '%');
    const range = h('input', { type: 'range', class: 'pen', min: 0, max: 100, step: 10, value: st.penetration, 'aria-label': 'Share of national maize land planted with biofortified seed (%)' });
    range.addEventListener('input', () => { chip.textContent = range.value + '%'; });
    range.addEventListener('change', () => setState({ penetration: +range.value }));
    wrap.append(accordion('Adoption scenario', 'slider', [
      h('div', { class: 'lbl', title: 'Azahar call this the penetration level: the national share of maize land planted with biofortified seed.' }, 'Share of maize land biofortified (%)'),
      h('div', { class: 'pen-head' }, h('span', {}, '0%'), chip, h('span', {}, '100%')),
      range,
      h('div', { class: 'pen-ticks' }, [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => h('span', {}, v)))
    ]));
  }

  // Nutrient boosts (extension)
  if (opts.showBoosts !== false) wrap.append(boostAccordion(opts.openBoosts !== false));

  // Stunting methodology
  if (opts.showPathway !== false) {
    const sel = h('select', { 'aria-label': 'Stunting methodology' }, opts.pathways.map(p => h('option', { value: p.id, selected: p.id === st.pathway ? true : null }, p.label)));
    sel.addEventListener('change', () => setState({ pathway: sel.value }));
    const cmp = h('input', { type: 'checkbox', checked: st.compare ? true : null });
    cmp.addEventListener('change', () => setState({ compare: cmp.checked }));
    const body = [sel, h('label', { class: 'switch' }, cmp, h('span', {}, 'Compare pathways'))];
    if (st.compare) body.push(h('div', { class: 'note info' }, 'Dashed lines and lighter marks show the alternate pathway for comparison.'));
    wrap.append(accordion('Stunting methodology', 'method', body, !!opts.openPathway));
  }

  // Visualizations
  if (opts.vizOptions && opts.vizOptions.length) {
    const cur = st.viz[opts.page] || opts.vizOptions[0].id;
    const list = h('div', { class: 'radio-list' }, opts.vizOptions.map(v => {
      const inp = h('input', { type: 'radio', name: 'viz', value: v.id, checked: v.id === cur ? true : null });
      inp.addEventListener('change', () => setState({ viz: { ...getState().viz, [opts.page]: v.id } }));
      return h('label', {}, inp, v.label);
    }));
    const body = [list];
    if (opts.note) body.push(h('div', { class: 'note' }, h('strong', {}, 'Note: '), opts.note));
    wrap.append(accordion('Visualizations', 'chart', body, true));
  }
  if (opts.extra) for (const node of opts.extra) wrap.append(node);

  // Subsidy
  if (opts.showSubsidy !== false) {
    const sel = h('select', { 'aria-label': 'Subsidy regime' }, opts.subsidies.map(s => h('option', { value: s.id, selected: s.id === st.subsidy ? true : null }, s.label + (s.official ? '' : ' (custom)'))));
    sel.addEventListener('change', () => setState({ subsidy: sel.value }));
    const cur = opts.subsidies.find(s => s.id === st.subsidy) || opts.subsidies[0];
    const info = cur ? `New Seed pays Q${cur.newseed_subsidy_per_mz != null ? cur.newseed_subsidy_per_mz : '?'} per manzana; farmers pay Q${cur.seed_cost_biofortified ? Object.values(cur.seed_cost_biofortified)[0] : '?'} per manzana for biofortified seed.` : '';
    wrap.append(accordion('Subsidy cost', 'coin', [sel, h('div', { class: 'note info' }, info)], !!opts.openSubsidy));
  }

  // Seed & units
  if (opts.showSeed !== false) {
    const seedList = h('div', { class: 'radio-list' }, opts.seeds.map(s => {
      const inp = h('input', { type: 'radio', name: 'seed', value: s.id, checked: s.id === st.seed ? true : null });
      inp.addEventListener('change', () => setState({ seed: s.id }));
      return h('label', { title: (s.note ? s.note + ' ' : '') + 'Yield change: ' + Object.entries(s.yield_change || {}).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`).join(', ') }, inp, s.label + (s.official ? '' : ' ✦'));
    }));
    const modelSeeds = opts.seeds.filter(s => s.model && s.note);
    const unitSwitch = (key, a, b, label) => {
      const inp = h('input', { type: 'checkbox', checked: st.units[key] === b ? true : null, 'aria-label': label });
      const la = h('span', { class: st.units[key] === a ? 'on' : '' }, a);
      const lb = h('span', { class: st.units[key] === b ? 'on' : '' }, b);
      inp.addEventListener('change', () => {
        la.classList.toggle('on', !inp.checked); lb.classList.toggle('on', inp.checked);
        setState({ units: { ...getState().units, [key]: inp.checked ? b : a } });
      });
      return h('label', { class: 'switch' }, la, inp, lb);
    };
    wrap.append(accordion('Seed & units', 'seed', [
      h('div', { class: 'seed-units' },
        h('div', {}, h('div', { class: 'lbl' }, 'Seed variety'), seedList),
        h('div', {}, h('div', { class: 'lbl' }, 'Units'), h('div', { class: 'units' },
          unitSwitch('currency', 'USD', 'GTQ', 'Currency'), unitSwitch('area', 'ha', 'mz', 'Area'), unitSwitch('weight', 'mt', 'qq', 'Weight')))),
      h('div', { class: 'note info' }, 'Seed yields from New Seed’s public reports. All seeds share the same nutrient content and differ in yield.' + (opts.seeds.some(s => !s.official) ? ' ✦ = custom seed from the Scenario Lab.' : '')),
      ...modelSeeds.map(s => h('div', { class: 'note' }, h('strong', {}, (s.short || s.label) + ': '), s.note.replace(/ \(pipeline\/[^)]*\)/, '')))
    ], !!opts.openSeed));
  }

  // Departments
  if (opts.showDepartments) {
    const selected = new Set(st.departments || DEPARTMENTS);
    const chips = h('div', { class: 'chips' });
    const render = () => {
      chips.replaceChildren(...DEPARTMENTS.map(d => h('span', { class: 'chip ' + (selected.has(d) ? 'on' : ''), onClick: () => { if (selected.has(d)) selected.delete(d); else selected.add(d); commit(); } }, d)));
    };
    const commit = () => { render(); setState({ departments: selected.size === DEPARTMENTS.length ? null : [...selected] }); };
    render();
    wrap.append(accordion('Departments', 'pin', [
      h('div', { class: 'chip-tools' }, h('span', { class: 'lbl' }, 'Departments'),
        h('span', { class: 'btn-row' },
          h('button', { class: 'btn small', onClick: () => { DEPARTMENTS.forEach(d => selected.add(d)); commit(); } }, 'All'),
          h('button', { class: 'btn small', onClick: () => { selected.clear(); commit(); } }, 'None'))),
      chips,
      h('div', { class: 'note info' }, 'Click a department to include or exclude it from the charts and the Department Table. The map always shows all 22 departments and the tiles stay national, as in the live app.')
    ], !!opts.openDepartments));
  }

  return wrap;
}

// Four 0-100% sliders; the engine runs when a slider is released.
export function boostAccordion(open = true) {
  const b = boostsOf(getState());
  const rows = BOOSTS.map(x => {
    const chip = h('span', { class: 'boost-val' }, (x.id === 'va' ? '' : '+') + b[x.id] + '%');
    const range = h('input', { type: 'range', class: 'boost', min: 0, max: 100, step: 1, value: b[x.id], 'aria-label': `${x.label}: ${x.unit}`, style: { '--c': x.color } });
    range.addEventListener('input', () => { chip.textContent = (x.id === 'va' ? '' : '+') + range.value + '%'; });
    range.addEventListener('change', () => setBoosts({ ...boostsOf(getState()), [x.id]: +range.value }));
    const mark = h('span', { class: 'boost-def', title: `Replica value: ${x.def}%`, style: { left: `calc(${x.def}% + ${(8 - x.def * 0.16).toFixed(2)}px)` } });
    return h('div', { class: 'boost-row' + (x.extra ? ' extra' : '') },
      h('div', { class: 'boost-head' }, h('span', { class: 'boost-name' }, h('i', { style: { background: x.color } }), x.label, x.extra ? h('em', {}, 'new') : null), chip),
      h('div', { class: 'boost-track' }, range, x.def ? mark : null),
      h('div', { class: 'boost-hint' }, x.unit + ' · ' + x.hint));
  });
  const presets = h('div', { class: 'boost-presets' }, PRESETS.map(p => {
    const on = BOOSTS.every(x => p.b[x.id] === b[x.id]);
    return h('button', { class: 'btn small' + (on ? ' on' : ''), onClick: () => setBoosts(p.b) }, p.label);
  }));
  const note = h('div', { class: 'note info' }, isDefaultBoost(b)
    ? 'At the replica values every number equals the replica’s. Tick marks show those values.'
    : 'Boosts differ from the replica. Iron, zinc and protein change the existing KPIs; provitamin A has its own KPIs on the Nutrient Boosts page.');
  return accordion('Nutrient content boost', 'slider', [...rows, presets, note], open);
}

// Drawer behaviour for phones
export function setupDrawer(sidebarEl) {
  let scrim = document.querySelector('.scrim');
  if (!scrim) { scrim = h('div', { class: 'scrim', onClick: () => closeDrawer() }); document.body.append(scrim); }
  window._azrSidebar = sidebarEl;
}
export function openDrawer() {
  const s = window._azrSidebar; if (!s) return;
  s.classList.add('open'); document.querySelector('.scrim')?.classList.add('show');
}
export function closeDrawer() {
  const s = window._azrSidebar; if (!s) return;
  s.classList.remove('open'); document.querySelector('.scrim')?.classList.remove('show');
}
export function controlsButton() {
  return h('button', { class: 'btn controls-btn', onClick: () => openDrawer() }, icon('slider'), 'Controls');
}

export function scenarioCaption(seed, subsidy, pathway, penetration) {
  return `${penetration}% of maize land biofortified · ${seed ? seed.label : ''} · ${subsidy ? subsidy.label : ''} · ${pathway ? pathway.label : ''}`;
}

export function downloadText(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
