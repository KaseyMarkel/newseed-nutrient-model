// Shared sidebar state, persisted in localStorage (wrapped in try/catch) so the
// Explorer, Compare and Lab pages agree on penetration, seed, subsidy, pathway and units.
import { DEFAULT_UNITS } from './units.js';
import { BOOST_DEFAULTS, cleanBoosts } from './boosts.js';

const KEY = 'nsb.state.v1'; // own key: the boost site never shares state with the replica

const DEFAULTS = {
  penetration: 50,
  pathway: 'pco',
  compare: false,
  subsidy: 'sub00',
  seed: 's30', // the 2030 model seed (config.js MODEL_SEEDS) is the default
  units: { ...DEFAULT_UNITS },
  departments: null, // null = all 22
  viz: { stunting: 'prevalence', iron: 'intake', zinc: 'intake', protein: 'intake', energy: 'intake', consumption: 'maize', production: 'farmers' },
  tableGroups: ['farmers', 'land', 'economics', 'stunting'],
  trendKpis: ['stunting_pct', 'iron_inad_pct', 'zinc_inad_pct', 'protein_inad_pct'],
  trendSeeds: null, // null = all official seeds
  compareBaseline: { seed: 's28', subsidy: 'sub00' },
  compareScenario: null, // id of a saved scenario, or null
  comparePenetration: 50,
  boosts: { ...BOOST_DEFAULTS },
  v: 2
};

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (!s || typeof s !== 'object') throw new Error('bad state');
      // v2 (2026-10-29): the 2030 seed becomes the default selection once; later choices are kept.
      if (!(s.v >= 2)) { s.seed = DEFAULTS.seed; s.compareScenario = null; s.v = 2; }
      const out = { ...structuredClone(DEFAULTS), ...s, units: { ...DEFAULTS.units, ...(s.units || {}) }, viz: { ...DEFAULTS.viz, ...(s.viz || {}) },
        compareBaseline: { ...DEFAULTS.compareBaseline, ...(s.compareBaseline || {}) } };
      // guard against hand-edited or corrupt values
      const pen = v => Number.isFinite(+v) ? Math.min(100, Math.max(0, Math.round(+v / 10) * 10)) : 50;
      out.penetration = pen(out.penetration); out.comparePenetration = pen(out.comparePenetration);
      out.boosts = cleanBoosts(out.boosts);
      if (!['USD', 'GTQ'].includes(out.units.currency)) out.units.currency = 'USD';
      if (!['ha', 'mz'].includes(out.units.area)) out.units.area = 'ha';
      if (!['mt', 'qq'].includes(out.units.weight)) out.units.weight = 'mt';
      if (!Array.isArray(out.tableGroups)) out.tableGroups = [...DEFAULTS.tableGroups];
      if (!Array.isArray(out.trendKpis) || out.trendKpis.length !== 4) out.trendKpis = [...DEFAULTS.trendKpis];
      if (out.departments != null && !Array.isArray(out.departments)) out.departments = null;
      if (out.trendSeeds != null && !Array.isArray(out.trendSeeds)) out.trendSeeds = null;
      return out;
    }
  } catch (e) { /* localStorage unavailable or corrupt: use defaults */ }
  return structuredClone(DEFAULTS);
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

export function getState() { return state; }

export function setState(patch, opts = {}) {
  state = { ...state, ...patch };
  save();
  if (!opts.silent) listeners.forEach(fn => { try { fn(state, patch); } catch (e) { console.error(e); } });
}

export function resetState() {
  state = structuredClone(DEFAULTS);
  save();
  listeners.forEach(fn => fn(state, {}));
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export const STATE_DEFAULTS = DEFAULTS;
