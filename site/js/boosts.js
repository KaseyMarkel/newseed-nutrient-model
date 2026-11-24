// Nutrient-boost sliders (extension of the replica; not part of Azahar's model).
//
// Each slider is the % increase of a nutrient in biofortified maize over conventional maize,
// 0-100%. Iron, zinc and protein quality map onto the engine's existing content multipliers
// (factor = 1 + boost/100), so the replica's own values (+19% Fe, +38% Zn, +94% protein
// quality) reproduce Azahar's numbers exactly. Provitamin A is a fourth nutrient: white maize
// has essentially none, so its slider is the % of the HarvestPlus breeding target reached.
//
// Protein quality drives stunting in both pathways, scaled linearly from Azahar's QPM:
//   covariate:     lysine + tryptophan term of the nutrition index x (boost / 94)
//   meta-analysis: Gunaratna growth effect 0.09 x (boost / 94)
// Imports only the dependency-free catalog: state.js depends on this module.
import { CATALOG } from './nutrient_catalog.js';

export const AZAHAR_QPM_BOOST = 94; // factor_prot 1.94
export const GUNARATNA_EFFECT = 0.09;

const CORE = [
  { id: 'fe', label: 'Iron', unit: '% more iron', def: 19, color: '#8e3129',
    hint: 'Replica / Azahar: +19% (27.1 → 32.2 mg/kg)',
    flag: { kind: 'gt', text: 'Guatemala: modeled (anemia 6.1%). Ethiopia: 18–30% of preschool children iron-deficient.' } },
  { id: 'zn', label: 'Zinc', unit: '% more zinc', def: 38, color: '#2f5f8f',
    hint: 'Replica / Azahar: +38% (22.1 → 30.5 mg/kg)',
    flag: { kind: 'gt', text: 'Guatemala: modeled. Ethiopia: 35% of preschool children zinc-deficient (Kenya 83%, unverified).' } },
  { id: 'prot', label: 'Protein quality (QPM)', unit: '% more utilizable protein', def: 94, color: '#c9963b',
    hint: 'Replica / Azahar: +94% (QPM; lysine ×1.98, tryptophan ×1.43)' },
  { id: 'va', label: 'Provitamin A', unit: '% of 15 µg/g target', def: 0, color: '#d97a1e', extra: true,
    hint: 'New nutrient. 0% = white maize; 100% = HarvestPlus target, 15 µg β-carotene eq./g',
    flag: { kind: 'gt', text: 'Guatemala: ~2% inadequate (fortified sugar), small gain. Zambia: 54% deficient, where supplements cut child deaths 12% (RR 0.88).' } },
  { id: 'fol', label: 'Folate', unit: '% more folate', def: 0, color: '#4f8a5b', extra: true, women: true,
    hint: 'New nutrient. White maize 0.25 µg/g; +100% = double (transgenic lines reach 2–4×). Acts through mothers: neural tube defects' }
];
for (const c of CORE) c.group = 'core';
export const BOOSTS = [...CORE, ...CATALOG.map(x => ({ ...x, def: 0, extra: true }))];
export const GROUPS = [
  { id: 'core', label: 'Modeled nutrients' },
  { id: 'gt', label: 'More nutrients: Guatemala shortfall', note: 'Exploratory. Baseline from Guatemalan intake surveys; health effect is a speculative central estimate (see each flag).' },
  { id: 'elsewhere', label: 'More nutrients: shortfall elsewhere', note: 'Shortfall data mostly from elsewhere. Modeled here with a Guatemala-adjusted prior and evidence from where it is common: speculative central estimates.' },
  { id: 'nomaize', label: 'More nutrients: no known route into maize', note: 'Hypothetical: no breeding, transgenic or fertilizer route found. Modeled as if one existed, with speculative central estimates.' }
];
// sliders that change the engine's child-level results (folate acts only in health.js)
export const ENGINE_BOOSTS = ['fe', 'zn', 'prot', 'va', ...CATALOG.filter(x => (x.model && x.model.p0 > 0) || x.absorption).map(x => x.id)];
// absorption levers (low phytate) multiply the effective zinc / iron content of biofortified maize
function leverMult(b, k) { let m = 1; for (const x of CATALOG) if (x.absorption && x.absorption[k] && b[x.id]) m *= 1 + x.absorption[k] * b[x.id] / 100; return m; }
export const BOOST_DEFAULTS = Object.freeze(Object.fromEntries(BOOSTS.map(b => [b.id, b.def])));

export function cleanBoosts(b) {
  const out = { ...BOOST_DEFAULTS };
  if (b && typeof b === 'object') for (const k of Object.keys(out)) {
    const v = Number(b[k]);
    if (Number.isFinite(v)) out[k] = Math.min(100, Math.max(0, Math.round(v)));
  }
  return out;
}
export const boostsOf = st => cleanBoosts(st && st.boosts);
export const isDefaultBoost = b => BOOSTS.every(x => b[x.id] === x.def);

// Engine params for a boost set. At the replica defaults it returns {} so the scenario is
// byte-identical to the replica's (same cache keys, same boundary decisions).
export function boostParams(b) {
  b = cleanBoosts(b);
  if (isDefaultBoost(b)) return {};
  const p = {};
  const mFe = leverMult(b, 'fe'), mZn = leverMult(b, 'zn');
  if (b.fe !== BOOST_DEFAULTS.fe || mFe !== 1) p.factor_fe = (1 + b.fe / 100) * mFe;
  if (b.zn !== BOOST_DEFAULTS.zn || mZn !== 1) p.factor_zn = (1 + b.zn / 100) * mZn;
  if (b.prot !== BOOST_DEFAULTS.prot) {
    p.factor_prot = 1 + b.prot / 100;
    p.lystrp_scale = b.prot / AZAHAR_QPM_BOOST;
    p.gunaratna_effect_size = GUNARATNA_EFFECT * b.prot / AZAHAR_QPM_BOOST;
  }
  if (b.va) p.va_fraction = b.va / 100;
  const ex = {};
  for (const x of CATALOG) if (b[x.id] && x.model && x.model.p0 > 0) {
    ex[x.id] = { add_per_g: x.model.per_g * b[x.id] / 100, p0: x.model.p0, ear: x.model.ear, sd_log: x.model.sd_log || 0.5 };
  }
  if (Object.keys(ex).length) p.extra_nutrients = ex;
  return p;
}

export function boostCaption(b) {
  b = cleanBoosts(b);
  const more = CATALOG.filter(x => b[x.id]).map(x => `${x.short || x.label} ${b[x.id]}%`);
  return `Fe +${b.fe}% · Zn +${b.zn}% · protein quality +${b.prot}%` + (b.va ? ` · provitamin A ${b.va}% of target` : '') + (b.fol ? ` · folate +${b.fol}%` : '') + (more.length ? ' · ' + more.join(' · ') : '');
}

// Presets offered under the sliders
const fill = v => Object.fromEntries(BOOSTS.map(x => [x.id, v]));
export const PRESETS = [
  { id: 'replica', label: 'Replica (Azahar)', b: { ...fill(0), fe: 19, zn: 38, prot: 94 } },
  { id: 'none', label: 'Conventional maize', b: fill(0) },
  { id: 'stack', label: 'Replica + provitamin A + folate', b: { ...fill(0), fe: 19, zn: 38, prot: 94, va: 100, fol: 100 } },
  { id: 'max', label: 'Everything +100%', b: fill(100) }
];

