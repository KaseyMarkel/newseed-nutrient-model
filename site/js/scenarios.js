// Custom seeds, subsidy regimes and saved scenarios (Scenario Lab), persisted in
// localStorage with try/catch and exportable as JSON.
//
// A scenario bundles everything engine.run() needs except the penetration:
//   { id, name, seedId, subsidyId, pathway, params: {key: value}, notes, created }
// Seeds and subsidies are stored separately so a custom seed can be reused in the
// Explorer's seed selector and in several scenarios.

import { yieldProblems, subsidyProblems } from './validate.js';

const KEY = 'azr.custom.v1';

const empty = () => ({ seeds: [], subsidies: [], scenarios: [] });

let store = load();
// Another tab (Scenario Lab, Compare) may save or clear items: pick up its copy so a later save
// here does not write back deleted items or drop new ones.
try { window.addEventListener('storage', e => { if (e.key === KEY || e.key === null) store = load(); }); } catch (e) { /* no window */ }

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const arr = x => (Array.isArray(x) ? x.filter(i => i && typeof i === 'object' && i.id) : []);
      return { seeds: arr(s && s.seeds), subsidies: arr(s && s.subsidies), scenarios: arr(s && s.scenarios) };
    }
  } catch (e) { /* ignore */ }
  return empty();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
}

export function uid(prefix = 'c') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function getCustom() { return store; }

// ---- seeds ----
export function customSeeds() { return store.seeds; }
export function saveSeed(seed) {
  const s = { ...seed };
  if (!s.id) s.id = uid('seed');
  s.official = false;
  const i = store.seeds.findIndex(x => x.id === s.id);
  if (i >= 0) store.seeds[i] = s; else store.seeds.push(s);
  save();
  return s;
}
export function deleteSeed(id) {
  store.seeds = store.seeds.filter(s => s.id !== id);
  store.scenarios = store.scenarios.map(sc => sc.seedId === id ? { ...sc, seedId: null } : sc);
  save();
}

// ---- subsidies ----
export function customSubsidies() { return store.subsidies; }
export function saveSubsidy(sub) {
  const s = { ...sub };
  if (!s.id) s.id = uid('sub');
  s.official = false;
  const i = store.subsidies.findIndex(x => x.id === s.id);
  if (i >= 0) store.subsidies[i] = s; else store.subsidies.push(s);
  save();
  return s;
}
export function deleteSubsidy(id) {
  store.subsidies = store.subsidies.filter(s => s.id !== id);
  store.scenarios = store.scenarios.map(sc => sc.subsidyId === id ? { ...sc, subsidyId: null } : sc);
  save();
}

// ---- scenarios ----
export function scenarios() { return store.scenarios; }
export function saveScenario(sc) {
  const s = { ...sc };
  if (!s.id) s.id = uid('scn');
  if (!s.created) s.created = new Date().toISOString();
  const i = store.scenarios.findIndex(x => x.id === s.id);
  if (i >= 0) store.scenarios[i] = s; else store.scenarios.push(s);
  save();
  return s;
}
export function deleteScenario(id) {
  store.scenarios = store.scenarios.filter(s => s.id !== id);
  save();
}

// ---- combined lists (official + custom) ----
// Official items first; a stored custom item whose id equals an official one is hidden
// (it could never be selected: every lookup would return the official item).
export function allSeeds(defaults) {
  const ids = new Set(defaults.seeds.map(s => s.id));
  return [...defaults.seeds, ...store.seeds.filter(s => !ids.has(s.id))];
}
export function allSubsidies(defaults) {
  const ids = new Set(defaults.subsidies.map(s => s.id));
  return [...defaults.subsidies, ...store.subsidies.filter(s => !ids.has(s.id))];
}
export function findSeed(defaults, id) {
  return allSeeds(defaults).find(s => s.id === id) || null;
}
export function findSubsidy(defaults, id) {
  return allSubsidies(defaults).find(s => s.id === id) || null;
}

// Build the scenario object engine.run() expects.
export function buildRunScenario(defaults, { seedId, subsidyId, pathway, penetration, params }) {
  const seed = findSeed(defaults, seedId) || defaults.seeds[0];
  const subsidy = findSubsidy(defaults, subsidyId) || defaults.subsidies[0];
  const cleanSeed = { id: seed.id, label: seed.label, year: seed.year, yield_change: { ...seed.yield_change } };
  const cleanSub = { ...subsidy }; delete cleanSub.official;
  return { seed: cleanSeed, subsidy: cleanSub, pathway: pathway || 'pco', penetration: penetration, params: params || {} };
}

// ---- import / export ----
export function exportJSON() {
  return JSON.stringify({ format: 'azahar-replica-scenarios', version: 1, exported: new Date().toISOString(), ...store }, null, 2);
}
// Import a file written by exportJSON. `official` = { seeds: [...], subsidies: [...] } from the
// engine defaults: an imported item never replaces an official one (ids such as s28 or s30 are
// renamed), invalid items are skipped, and names that clash with a different item get " (imported)".
export function importJSON(text, { replace = false, official = { seeds: [], subsidies: [] } } = {}) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('the file is not valid JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not a scenarios file (expected an object with seeds, subsidies, scenarios)');
  const arr = x => (Array.isArray(x) ? x : []);
  const incoming = { seeds: arr(data.seeds), subsidies: arr(data.subsidies), scenarios: arr(data.scenarios) };
  if (!incoming.seeds.length && !incoming.subsidies.length && !incoming.scenarios.length) throw new Error('the file has no seeds, subsidy regimes or scenarios');
  if (replace) store = empty();
  const SEG = ['OPV_Criollo', 'Low', 'Mid', 'High'];
  const finiteSeg = o => o && typeof o === 'object' && SEG.every(k => Number.isFinite(o[k]));
  const okSeed = s => finiteSeg(s.yield_change) && !yieldProblems(s.yield_change).errors.length;
  const okSub = s => !subsidyProblems(s).errors.length;
  const remap = { seeds: new Map(), subsidies: new Map() };
  let skipped = 0, renamed = 0;
  const added = { seeds: 0, subsidies: 0, scenarios: 0 };
  const MAXLEN = 80; // as the Lab's name fields
  const merge = (kind, list, items, ok, offIds, offLabels, labelKey) => {
    for (const raw of items) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !raw.id || (ok && !ok(raw))) { skipped++; continue; }
      const it = { ...raw, id: String(raw.id).slice(0, 64), official: false };
      delete it.model; delete it.note; delete it.example;
      // only the four farmer segments reach the engine (an extra key makes it refuse the seed)
      if (kind === 'seeds') { it.yield_change = Object.fromEntries(SEG.map(k => [k, Number(raw.yield_change[k].toFixed(10))])); it.year = ['string', 'number'].includes(typeof raw.year) ? String(raw.year).slice(0, 12) : ''; }
      if (kind === 'scenarios') {
        if (!['pco', 'pma'].includes(it.pathway)) it.pathway = 'pco';
        if (typeof it.notes !== 'string') it.notes = '';
      }
      if (offIds.has(it.id)) { const nid = uid(kind === 'seeds' ? 'seed' : kind === 'subsidies' ? 'sub' : 'scn'); remap[kind]?.set(it.id, nid); it.id = nid; renamed++; }
      let name = String(it[labelKey] || '').replace(/\s+/g, ' ').trim() || 'Imported';
      if (name.length > MAXLEN) name = name.slice(0, MAXLEN - 1).trimEnd() + '…';
      const clash = n => offLabels.has(n.toLowerCase()) || list.some(x => x.id !== it.id && String(x[labelKey] || '').trim().toLowerCase() === n.toLowerCase());
      let n = name; for (let i = 1; clash(n); i++) n = `${name} (imported${i > 1 ? ' ' + i : ''})`;
      it[labelKey] = n;
      const i = list.findIndex(x => x.id === it.id);
      if (i >= 0) list[i] = it; else list.push(it);
      added[kind]++;
    }
  };
  const offSeedIds = new Set(official.seeds.map(s => s.id)), offSubIds = new Set(official.subsidies.map(s => s.id));
  merge('seeds', store.seeds, incoming.seeds, okSeed, offSeedIds, new Set(official.seeds.map(s => s.label.toLowerCase())), 'label');
  merge('subsidies', store.subsidies, incoming.subsidies, okSub, offSubIds, new Set(official.subsidies.map(s => s.label.toLowerCase())), 'label');
  const scns = incoming.scenarios.map(s => (s && typeof s === 'object' && !Array.isArray(s)) ? { ...s, params: (s.params && typeof s.params === 'object' && !Array.isArray(s.params)) ? s.params : {},
    seedId: remap.seeds.get(s.seedId) || s.seedId, subsidyId: remap.subsidies.get(s.subsidyId) || s.subsidyId } : s);
  merge('scenarios', store.scenarios, scns, null, new Set(), new Set(), 'name');
  save();
  return { ...added, skipped, renamed };
}
export function clearAll() { store = empty(); save(); }

// Helpers for the Lab's yield helpers.
// Multiplicative: (1 + y)(1 + x) - 1. Additive: y + x (x in percentage points / 100).
// Results are rounded to 10 decimals: (1 + 0.55) x 1.1 - 1 is 0.7050000000000003 in floating
// point, and that last bit changes the model's result (a department that ends at exactly 100%
// coverage counts its last child or not; 271 children in Petén at 50% for the 2030 seed). Rounded,
// the helper gives 0.705, the value Azahar's R code was run with.
const clean = v => Number(v.toFixed(10));
export function raiseYieldMultiplicative(yieldChange, x) {
  const out = {};
  for (const [k, y] of Object.entries(yieldChange)) out[k] = clean((1 + y) * (1 + x) - 1);
  return out;
}
export function raiseYieldAdditive(yieldChange, x) {
  const out = {};
  for (const [k, y] of Object.entries(yieldChange)) out[k] = clean(y + x);
  return out;
}
