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
// No imports: state.js depends on this module.

export const AZAHAR_QPM_BOOST = 94; // factor_prot 1.94
export const GUNARATNA_EFFECT = 0.09;

export const BOOSTS = [
  { id: 'fe', label: 'Iron', unit: '% more iron', def: 19, color: '#8e3129',
    hint: 'Replica / Azahar: +19% (27.1 → 32.2 mg/kg)' },
  { id: 'zn', label: 'Zinc', unit: '% more zinc', def: 38, color: '#2f5f8f',
    hint: 'Replica / Azahar: +38% (22.1 → 30.5 mg/kg)' },
  { id: 'prot', label: 'Protein quality (QPM)', unit: '% more utilizable protein', def: 94, color: '#c9963b',
    hint: 'Replica / Azahar: +94% (QPM; lysine ×1.98, tryptophan ×1.43)' },
  { id: 'va', label: 'Provitamin A', unit: '% of 15 µg/g target', def: 0, color: '#d97a1e', extra: true,
    hint: 'New nutrient. 0% = white maize; 100% = HarvestPlus target, 15 µg β-carotene eq./g' },
  { id: 'fol', label: 'Folate', unit: '% more folate', def: 0, color: '#4f8a5b', extra: true, women: true,
    hint: 'New nutrient. White maize 0.25 µg/g; +100% = double (transgenic lines reach 2–4×). Acts through mothers: neural tube defects' }
];
// sliders that change the engine's child-level results (folate acts only in health.js)
export const ENGINE_BOOSTS = ['fe', 'zn', 'prot', 'va'];
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
  if (b.fe !== BOOST_DEFAULTS.fe) p.factor_fe = 1 + b.fe / 100;
  if (b.zn !== BOOST_DEFAULTS.zn) p.factor_zn = 1 + b.zn / 100;
  if (b.prot !== BOOST_DEFAULTS.prot) {
    p.factor_prot = 1 + b.prot / 100;
    p.lystrp_scale = b.prot / AZAHAR_QPM_BOOST;
    p.gunaratna_effect_size = GUNARATNA_EFFECT * b.prot / AZAHAR_QPM_BOOST;
  }
  if (b.va) p.va_fraction = b.va / 100;
  return p;
}

export function boostCaption(b) {
  b = cleanBoosts(b);
  return `Fe +${b.fe}% · Zn +${b.zn}% · protein quality +${b.prot}%` + (b.va ? ` · provitamin A ${b.va}% of target` : '') + (b.fol ? ` · folate +${b.fol}%` : '');
}

// Presets offered under the sliders
export const PRESETS = [
  { id: 'replica', label: 'Replica (Azahar)', b: { fe: 19, zn: 38, prot: 94, va: 0, fol: 0 } },
  { id: 'none', label: 'Conventional maize', b: { fe: 0, zn: 0, prot: 0, va: 0, fol: 0 } },
  { id: 'stack', label: 'Replica + provitamin A + folate', b: { fe: 19, zn: 38, prot: 94, va: 100, fol: 100 } },
  { id: 'max', label: 'Everything +100%', b: { fe: 100, zn: 100, prot: 100, va: 100, fol: 100 } }
];

