// Engine selection. The real engine (ROOT/engine/engine.js) is used when its data
// bundle loads from site/data/; otherwise the mock engine runs and every page shows
// a "mock data" banner. Bundle discovery order:
//   1. data/bundle.json                               (CONTRACT.md)
//   2. data/bundle_econ.json + data/bundle_nutrition.json  (merged: {econ, nutrition, ...both})
// Set window.AZR_FORCE_MOCK = true before loading to force the mock (used for testing).

const PATHWAY_LABELS = { pco: 'Covariate prediction', pma: 'Meta-analysis (Gunaratna)' };

// Seeds the site adds next to Azahar's official ones. They behave like official seeds
// (every selector, map, table, KPI Trends line and download) and never depend on the
// browser's localStorage. The 2030 seed is New Seed's model scenario, not an Azahar seed:
// the 2028 seed with 10% more yield in every farmer segment, (1 + y2028) x 1.10 - 1.
export const MODEL_SEEDS = [
  {
    id: 's30', year: '2030', label: '2030 Seed (model scenario: 2028 +10% yield)', short: '2030 Seed (model)',
    yield_change: { OPV_Criollo: 0.705, Low: 0.705, Mid: 0.32, High: 0.078 },
    official: true, model: true,
    note: 'Not an Azahar seed: a model scenario, the 2028 seed with 10% more yield in every farmer segment (OPV/criollo +70.5%, low hybrid +70.5%, mid hybrid +32.0%, high hybrid +7.8%). Checked against Azahar’s own R code run with this seed: all 232,848 values equal.'
  }
];
export const DEFAULT_SEED = 's30';
export const seedShort = s => (s ? (s.short || s.label) : '');

async function fetchJSON(url) {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('json') && !url.endsWith('.json')) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

let _loaded = null;

// python -m http.server serves a directory index; use it to learn which files
// exist without provoking 404 errors in the console. Other servers: assume present.
let _dirList = null;
export async function dataFileExists(name) {
  if (_dirList === null) {
    try {
      const r = await fetch('data/', { cache: 'no-cache' });
      const t = r.ok ? await r.text() : ''; _dirList = t.includes('Directory listing for') ? t : false;
    } catch (e) { _dirList = false; }
  }
  if (_dirList === false) return true;
  return _dirList.includes(`href="${name}"`);
}
async function fetchData(name) {
  return (await dataFileExists(name)) ? fetchJSON('data/' + name) : null;
}

// Progress text in the page's loading placeholder (index/lab/compare/check .html).
function stage(msg) {
  try { const el = document.querySelector('#app > .empty.loading .progress'); if (el) el.textContent = msg; } catch (e) { /* no DOM */ }
}

export async function loadEngine() {
  if (_loaded) return _loaded;
  stage('Loading the model data (about 5 MB)…');
  let engine = null, mode = 'mock', reason = '', bundleInfo = null;
  if (!(typeof window !== 'undefined' && window.AZR_FORCE_MOCK)) {
    let bundle = await fetchData('bundle.json');
    if (bundle) bundleInfo = 'data/bundle.json';
    if (!bundle) {
      const [econ, nutrition] = await Promise.all([fetchData('bundle_econ.json'), fetchData('bundle_nutrition.json')]);
      if (econ && nutrition) {
        // spec/bundle_schema.md: bundle = Object.assign({}, econJson, nutritionJson)
        // (each file carries its own top-level key, `econ` and `nutrition`)
        bundle = Object.assign({}, econ, nutrition);
        bundleInfo = 'data/bundle_econ.json + data/bundle_nutrition.json';
      } else {
        reason = !econ && !nutrition ? 'no bundle in site/data/' : (!econ ? 'bundle_econ.json missing' : 'bundle_nutrition.json missing');
      }
    }
    if (bundle) {
      stage('Starting the model…');
      try {
        const mod = await import('../../engine/engine.js');
        if (typeof mod.createEngine !== 'function') throw new Error('engine.js has no createEngine export');
        engine = mod.createEngine(bundle);
        if (typeof engine.run !== 'function' || typeof engine.defaults !== 'function') throw new Error('engine lacks run()/defaults()');
        mode = 'real';
      } catch (e) {
        reason = 'engine/engine.js failed to load: ' + (e && e.message ? e.message : e);
        engine = null;
      }
    }
  } else {
    reason = 'forced by AZR_FORCE_MOCK';
  }
  if (!engine) {
    const mock = await import('./mock_engine.js');
    engine = mock.createEngine(null);
    mode = 'mock';
  }
  const defaults = normalizeDefaults(engine.defaults());
  for (const m of MODEL_SEEDS) {
    if (!defaults.seeds.some(s => s.id === m.id)) defaults.seeds.push({ ...m, yield_change: { ...m.yield_change } });
  }
  stage('Running the model…');
  _loaded = { engine, mode, reason, bundleInfo, defaults };
  return _loaded;
}

// Make the engine's defaults() uniform regardless of whether the engine returns
// arrays or id-keyed objects.
export function normalizeDefaults(d) {
  const toArray = (x, kind) => {
    if (!x) return [];
    if (Array.isArray(x)) return x.map((v, i) => typeof v === 'string' ? { id: v, label: kind === 'pathway' ? (PATHWAY_LABELS[v] || v) : v } : { id: v.id || v.suffix || v.seed_suffix || v.subsidy_suffix || ('item' + i), ...v });
    return Object.entries(x).map(([id, v]) => typeof v === 'string' ? { id, label: v } : { id: v.id || id, ...v });
  };
  const seeds = toArray(d.seeds, 'seed').map(s => ({
    id: s.id, label: s.label || s.seed_label || (s.year ? `${s.year} Seed` : s.id),
    year: String(s.year || s.seed_year || ''), yield_change: s.yield_change || {}, official: true
  }));
  const subsidies = toArray(d.subsidies, 'subsidy').map(s => ({ ...s, label: s.label || s.subsidy_label || s.id, official: true }));
  const pathways = toArray(d.pathways, 'pathway').map(p => ({ ...p, label: p.label || p.pathway_label || (d.pathway_labels && d.pathway_labels[p.id] && PATHWAY_LABELS[p.id]) || PATHWAY_LABELS[p.id] || p.id }));
  return { seeds, subsidies, pathways, params: d.params || {} };
}

// Describe engine params for the Scenario Lab editor. Accepts either
// { key: number }, { key: {value, label, min, max} } or { key: { seg: number } }.
export function describeParams(params) {
  const out = [];
  for (const [key, raw] of Object.entries(params || {})) {
    let value = raw, label = key, min, max, description;
    if (raw && typeof raw === 'object' && 'value' in raw) {
      value = raw.value; label = raw.label || key; min = raw.min; max = raw.max; description = raw.description;
    }
    if (typeof value === 'number') out.push({ key, label, value, min, max, description, kind: 'number' });
    else if (typeof value === 'boolean') out.push({ key, label, value, kind: 'boolean' });
    else if (value && typeof value === 'object' && Object.values(value).every(v => typeof v === 'number')) out.push({ key, label, value, description, kind: 'object' });
    else out.push({ key, label, value, description, kind: 'json' });
  }
  return out;
}
