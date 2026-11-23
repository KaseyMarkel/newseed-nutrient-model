// Display text for the Explorer, written to match what the live Azahar dashboard shows
// (ground_truth/dashboard_values.csv): summary tiles, the "Production & economic impact" list,
// Department Table cells, map hover text and colour values, the chart under the map for every
// visualisation, box-plot hovers and KPI Trends hovers. Pure functions (no DOM, no Plotly), so
// tests/redteam/site_display_parity.mjs can check them in Node against all 198 dashboard states.
//
// Deliberate differences from the live app (all numbers agree at the live app's precision):
//   * "pp" where the live app writes "%" for a difference of two percentages (inadequacy averted
//     in the Department Table) and where it gives no unit (map hover "Stunting reduction: +8.8").
//   * Department Table intakes keep 2 decimals (the live table rounds 1.12 mg/d to "1").
//   * Before/after hovers on the stunting chart add a third line with the change.
import { display, fmtNum, CONV } from './units.js';
import { KPIS, ECON_LIST } from './kpis.js';

const n0 = v => fmtNum(Math.abs(v) < 0.5 ? 0 : v, 0); // no "-0" from float noise (21,668 - 21,668.0000001)
const plus = (v, txt) => (v >= 0 ? '+' : '') + txt; // R's sprintf("%+.1f"): "+0.0" for zero
const fixed = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : '–'); // no thousands separator, as R's sprintf
const area = (raw, units) => (units.area === 'mz' ? raw / CONV.HA_PER_MZ : raw);
const weight = (raw, units) => (units.weight === 'qq' ? raw / CONV.MT_PER_QQ : raw);
const money = (raw, units) => (units.currency === 'USD' ? raw / CONV.GTQ_PER_USD : raw);
const cur = units => (units.currency === 'USD' ? '$' : 'Q');

// ---------------------------------------------------------------- summary tiles and list
// One entry per tile of PAGES[page].summary: { label, text }.
export function tileTexts(def, national, units) {
  return def.tiles.map(t => {
    let raw = national[t.key];
    let signed = false;
    if (t.delta) { raw = national[t.key] - national[t.delta]; signed = true; }
    // full numbers, as the live dashboard shows them ($44,457,815, not $44.5 M)
    const d = display(t.key, raw, units, { signed, compact: false, decimals: t.decimals, delta: !!t.delta });
    let text = d.text;
    // the live app writes a zero improvement as "+0.00" (R's sprintf("%+.2f")); keep that
    if ((signed || (KPIS[t.key] || {}).signed) && /^[0.,]+(\s|$)/.test(text)) text = '+' + text;
    if (/\(.*\)/.test(t.label)) text = text.replace(/ (mg\/d|g\/d|kcal\/d|kg\/yr)$/, ''); // unit already in the label
    return { label: t.labelMz && units.area === 'mz' ? t.labelMz : t.label, text };
  });
}

// The "Production & economic impact" list: { label, text } per ECON_LIST item.
export function econTexts(national, units) {
  return ECON_LIST.map(item => {
    const raw = national[item.key];
    let text;
    // bags: the engine's bags_seed (1 bag of 20 kg per ha unless params.bags_per_ha says otherwise), whatever the area unit
    if (item.asBags) text = display('n_farmers_bio', Number.isFinite(national.bags_seed) ? national.bags_seed : raw * CONV.BAGS_PER_HA, units).text;
    else text = display(item.key, raw, units).text;
    let label = item.label;
    const meta = KPIS[item.key] || {};
    if (!item.asBags && (meta.unit === 'ha' || meta.unit === 'mt')) {
      label += ` (${display(item.key, raw, units).unitLabel})`;
      text = text.replace(/\s(ha|mz|mt|qq)$/, '');
    }
    return { label, text };
  });
}

// ---------------------------------------------------------------- Department Table
// Yield increase per hectare of biofortified land (mt/ha); the engine's yield_increase_mt_per_ha.
export function yieldIncrease(row) {
  if (Number.isFinite(row.yield_increase_mt_per_ha)) return row.yield_increase_mt_per_ha;
  return row.land_bio_ha > 0 ? row.production_increment_mt / row.land_bio_ha : 0;
}
export function tableCell(row, col, units) {
  let raw = row[col.key];
  if (col.key === 'yield_increase_mt_ha') raw = yieldIncrease(row);
  const meta = KPIS[col.key] || {};
  const dec = ['mg', 'g', 'z'].includes(meta.unit) ? 2 : (meta.unit === 'mt_per_ha' ? 1 : (['pct', 'pp'].includes(meta.unit) ? 1 : 0));
  let text = display(col.key, raw, units, { decimals: dec }).text;
  // units live in the column header, as in the live table ("Net income (USD)": 259,462,418)
  text = text.replace(/\s(ha|mz|mt|qq|mg\/d|g\/d|kcal\/d|kg\/yr|mt\/ha|qq\/mz|qq\/ha|mt\/mz)$/, '').replace(/^([-+]?)[$Q]/, '$1');
  if (col.pctKey) {
    const p = row[col.pctKey];
    text += ` (${display(col.pctKey, p, units, { decimals: 1 }).text.replace(' pp', col.pctUnit === 'pp' ? ' pp' : '')})`;
  }
  // red only for a value that is bad news: a negative gain (e.g. income loss). A negative
  // seed-cost difference is a saving and stays black.
  return { text, neg: raw < 0 && meta.good === 'up' };
}

// ---------------------------------------------------------------- maps
// What each visualisation colours the map by, its legend title and its hover text (live app).
const BA = (bKey, aKey, fmt) => d => `Before: ${fmt(d[bKey])}<br>After: ${fmt(d[aKey])}`;
const pct1 = v => `${fixed(v, 1)}%`, pct0 = v => `${fixed(v, 0)}%`;
const farmBlock = (d, units) => {
  const a = units.area === 'mz' ? 'mz' : 'ha';
  return `Biofortified farmers: ${n0(d.n_farmers_bio)}<br>Non-biofortified farmers: ${n0(d.n_farmers_total - d.n_farmers_bio)}` +
    `<br>Biofortified ${a}: ${n0(area(d.land_bio_ha, units))}<br>Non-biofortified ${a}: ${n0(area(d.land_ha_total - d.land_bio_ha, units))}`;
};
const moneyText = (raw, units) => `${raw < 0 ? '-' : ''}${cur(units)}${n0(Math.abs(money(raw, units)))} ${units.currency}`;

export const MAP_SPECS = {
  stunting: {
    prevalence: { key: 'stunting_pct', legend: () => 'Prevalence (%)', hover: () => BA('stunting_pct_baseline', 'stunting_pct', pct1) },
    reduction: { key: 'stunting_change_pp', legend: () => 'Reduction (pp)', hover: () => d => `Stunting reduction: ${plus(d.stunting_change_pp, fixed(d.stunting_change_pp, 1))} pp` },
    mean_haz: { key: 'mean_zlen', legend: () => 'HAZ', hover: () => BA('mean_zlen_baseline', 'mean_zlen', v => fixed(v, 2)) },
    haz_improvement: { key: 'zlen_change', legend: () => 'Δz', hover: () => d => `HAZ improvement (Δz): ${plus(d.zlen_change, fixed(d.zlen_change, 2))}` }
  },
  iron: {
    intake: { key: 'mean_iron_total', legend: () => 'Intake (mg/day)', hover: () => BA('mean_iron_total_baseline', 'mean_iron_total', v => `${fixed(v, 2)} mg/day`) },
    inadequacy: { key: 'iron_inad_pct', legend: () => 'Prevalence (% of children)', hover: () => BA('iron_inad_pct_baseline', 'iron_inad_pct', pct0) }
  },
  zinc: {
    intake: { key: 'mean_zinc', legend: () => 'Intake (mg/day)', hover: () => BA('mean_zinc_baseline', 'mean_zinc', v => `${fixed(v, 2)} mg/day`) },
    inadequacy: { key: 'zinc_inad_pct', legend: () => 'Prevalence (% of children)', hover: () => BA('zinc_inad_pct_baseline', 'zinc_inad_pct', pct0) }
  },
  protein: {
    intake: { key: 'mean_protein', legend: () => 'Intake (g/day)', hover: () => BA('mean_protein_baseline', 'mean_protein', v => `${fixed(v, 2)} g/day`) },
    inadequacy: { key: 'protein_inad_pct', legend: () => 'Prevalence (% of children)', hover: () => BA('protein_inad_pct_baseline', 'protein_inad_pct', pct0) }
  },
  energy: {
    intake: { key: 'mean_energy', legend: () => 'Intake (kcal/day)', hover: () => BA('mean_energy_baseline', 'mean_energy', v => `${fixed(v, 0)} kcal/day`) }
  },
  consumption: {
    maize: { key: 'maize_g_day_mean', legend: () => 'g/day', hover: () => d => `Maize intake (children): ${fixed(d.maize_g_day_mean, 1)} g/day` },
    child_coverage: { key: 'children_coverage_pct', legend: () => 'Child coverage (%)', hover: () => d => `Child coverage: ${fixed(d.children_coverage_pct, 1)}%` },
    population_coverage: { key: 'coverage_pct', legend: () => 'Coverage (%)', hover: () => d => `Coverage: ${fixed(d.coverage_pct, 1)}%<br>People reached: ${n0(d.n_people_biofortified)}<br>Total population: ${n0(d.population)}` },
    additional_zinc: { key: 'zinc_added_kg_year', legend: () => 'kg Zn / year', hover: () => d => `Zn added: ${fmtNum(d.zinc_added_kg_year, 1)} kg Zn / year` },
    additional_iron: { key: 'iron_added_kg_year', legend: () => 'kg Fe / year', hover: () => d => `Fe added: ${fmtNum(d.iron_added_kg_year, 1)} kg Fe / year` }
  },
  production: {
    farmers: { key: 'n_farmers_bio', legend: () => 'Adopting farmers', hover: units => d => farmBlock(d, units) },
    hectares: { key: 'land_bio_ha', legend: units => (units.area === 'mz' ? 'Manzanas planted (mz)' : 'Hectares planted (ha)'), hover: units => d => farmBlock(d, units) },
    income_total: { key: 'income_increment_total', legend: units => `Total additional income (${units.currency})`, hover: units => d => `Total additional income: ${moneyText(d.income_increment_total, units)}<br>${farmBlock(d, units)}` },
    income_farmer: { key: 'income_per_farmer_adopter', legend: units => `Additional income/adopter (${units.currency})`, hover: units => d => `Additional income/adopter: ${moneyText(d.income_per_farmer_adopter, units)}<br>${farmBlock(d, units)}` }
  }
};

// Map trace content: { key, regions, z (display units), text (hover), legend }.
export function mapSpec(pageId, vizId, deps, units) {
  const page = MAP_SPECS[pageId] || {};
  const s = page[vizId] || Object.values(page)[0];
  const hover = s.hover(units);
  return {
    key: s.key, legend: s.legend(units), regions: deps.map(d => d.region),
    z: deps.map(d => display(s.key, d[s.key], units).value),
    text: deps.map(d => `<b>${d.region}</b><br>${hover(d)}`)
  };
}

// ---------------------------------------------------------------- chart under the map
// kind 'dumbbell' (before/after), 'lollipop' (one value) or 'pair' (total and biofortified),
// rows [{ region, before?, value, text }], xTitle, and for 'pair' the second series.
const AGE_BANDS = {
  iron: [['iron_inad_under36_pct', '6-35mo'], ['iron_inad_36to59_pct', '36-59mo']],
  zinc: [['zinc_inad_12to35_pct', '12-35mo'], ['zinc_inad_36to59_pct', '36-59mo']],
  protein: [['protein_inad_under36_pct', '6-35mo'], ['protein_inad_36to59_pct', '36-59mo']]
};
export function auxSpec(pageId, vizId, deps, units) {
  if (pageId === 'stunting') {
    if (vizId === 'reduction') return { kind: 'lollipop', key: 'stunting_change_pp', xTitle: 'Stunting reduction (pp)', title: 'Stunting reduction',
      rows: deps.map(d => ({ region: d.region, value: d.stunting_change_pp, text: `${fixed(d.stunting_change_pp, 1)} pp` })) };
    if (vizId === 'haz_improvement') return { kind: 'lollipop', key: 'zlen_change', xTitle: 'HAZ improvement (Δz)', title: 'HAZ improvement (Δz)',
      rows: deps.map(d => ({ region: d.region, value: d.zlen_change, text: plus(d.zlen_change, fixed(d.zlen_change, 2)) })) };
    const haz = vizId === 'mean_haz';
    const [b, a] = haz ? ['mean_zlen_baseline', 'mean_zlen'] : ['stunting_pct_baseline', 'stunting_pct'];
    const f = haz ? v => fixed(v, 2) : pct1;
    return { kind: 'dumbbell', key: a, xTitle: haz ? 'Mean HAZ' : 'Stunting prevalence (%)', title: haz ? 'Mean HAZ' : 'Stunting prevalence', suffix: haz ? '' : '%',
      rows: deps.map(d => ({ region: d.region, before: d[b], value: d[a],
        text: `Before: ${f(d[b])}<br>After: ${f(d[a])}<br>Change: ${display(a, d[a] - d[b], units, { signed: true, delta: true, decimals: 2 }).text}` })) };
  }
  if (pageId === 'production') {
    const s = MAP_SPECS.production[vizId] || MAP_SPECS.production.farmers;
    const text = d => {
      if (vizId === 'hectares') return `${n0(area(d.land_bio_ha, units))} ${units.area}`;
      if (vizId === 'income_total') return moneyText(d.income_increment_total, units);
      if (vizId === 'income_farmer') return moneyText(d.income_per_farmer_adopter, units);
      return n0(d.n_farmers_bio);
    };
    const titles = { farmers: 'Adopting farmers', hectares: units.area === 'mz' ? 'Manzanas planted' : 'Hectares planted', income_total: 'Total additional income', income_farmer: 'Additional income/adopter' };
    return { kind: 'lollipop', key: s.key, xTitle: s.legend(units), title: titles[vizId] || titles.farmers,
      rows: deps.map(d => ({ region: d.region, value: display(s.key, d[s.key], units).value, text: text(d) })) };
  }
  if (pageId === 'consumption') {
    if (vizId === 'child_coverage') return { kind: 'lollipop', key: 'children_coverage_pct', xTitle: 'Child coverage (%)', title: 'Child coverage',
      rows: deps.map(d => ({ region: d.region, value: d.children_coverage_pct, text: `Child coverage: ${fixed(d.children_coverage_pct, 1)}%` })) };
    if (vizId === 'additional_zinc' || vizId === 'additional_iron') {
      const zn = vizId === 'additional_zinc', key = zn ? 'zinc_added_kg_year' : 'iron_added_kg_year';
      return { kind: 'lollipop', key, xTitle: zn ? 'kg Zn / year' : 'kg Fe / year', title: zn ? 'Additional zinc in the food system' : 'Additional iron in the food system',
        rows: deps.map(d => ({ region: d.region, value: d[key], text: `${zn ? 'Zn' : 'Fe'} added: ${fmtNum(d[key], 1)}` })) };
    }
    if (vizId === 'population_coverage') {
      const w = units.weight === 'qq' ? 'qq' : 'mt';
      return { kind: 'pair', key: 'bio_consumed_mt', xTitle: w, title: `National maize consumption (${w}/year)`, labels: ['Total', 'Biofortified'],
        rows: deps.map(d => ({ region: d.region, before: weight(d.consumption_fsi_mt, units), value: weight(d.bio_consumed_mt, units),
          textBefore: `Total: ${n0(weight(d.consumption_fsi_mt, units))}`, text: `Biofortified: ${n0(weight(d.bio_consumed_mt, units))}` })) };
    }
    return null; // maize: the live app shows only the box plots
  }
  return null;
}

// Inadequacy by age group (iron, zinc, protein pages in inadequacy mode): before = the same
// pathway at 0% of maize land (`deps0`), after = the scenario. Returns two dumbbell specs.
export function inadequacyByAge(pageId, deps, deps0) {
  const bands = AGE_BANDS[pageId];
  if (!bands) return null;
  const before = new Map((deps0 || []).map(d => [d.region, d]));
  return bands.map(([key, band]) => ({
    kind: 'dumbbell', key, band, xTitle: 'Prevalence (% of children)', suffix: '%',
    rows: deps.map(d => { const b = (before.get(d.region) || {})[key]; return { region: d.region, before: b, value: d[key], text: `Before: ${pct0(b)}<br>After: ${pct0(d[key])}` }; })
  }));
}

// Box plot hover (live app): Max / Q3 / Median / Q1 / Min of the department's children.
export const BOX_DECIMALS = { iron_total: 1, zinc: 1, protein: 1, energy: 0, maize_g: 1 };
export function boxRows(deps, prefix, band) {
  const dec = BOX_DECIMALS[prefix] ?? 1;
  return deps.map(d => {
    const q = k => d[`${prefix}_${band}_${k}`];
    const r = { region: d.region, min: q('q00'), q1: q('q25'), med: q('q50'), q3: q('q75'), max: q('q100') };
    r.text = `<b>${d.region}</b><br><br>Max: ${fixed(r.max, dec)}<br>Q3: ${fixed(r.q3, dec)}<br>Median: ${fixed(r.med, dec)}<br>Q1: ${fixed(r.q1, dec)}<br>Min: ${fixed(r.min, dec)}`;
    return r;
  });
}

// ---------------------------------------------------------------- KPI Trends
// Hover value of one trend point, with the live app's decimals and unit words.
const TREND_FMT = {
  stunting_pct: [1, ' %'], stunting_change_pp: [2, ' pp'], mean_zlen: [3, ' z-score'], zlen_change: [4, ' Δz'],
  n_stunting_averted: [0, ' Children (n)'], n_iron_inad_averted: [0, ' Children (n)'], n_zinc_inad_averted: [0, ' Children (n)'], n_protein_inad_averted: [0, ' Children (n)'],
  mean_iron_total: [3, ' mg/day'], mean_zinc: [3, ' mg/day'], mean_protein: [2, ' g/day'],
  iron_inad_pct: [1, ' %'], zinc_inad_pct: [1, ' %'], protein_inad_pct: [1, ' %'], coverage_pct: [1, ' %'],
  iron_inad_change_pp: [2, ' pp'], zinc_inad_change_pp: [2, ' pp'], protein_inad_change_pp: [2, ' pp'],
  n_farmers_bio: [0, ' Farmers (n)']
};
export function trendValueText(key, raw, units) {
  const f = TREND_FMT[key];
  if (f) return fmtNum(raw, f[0]) + f[1];
  const u = (KPIS[key] || {}).unit;
  const v = display(key, raw, units).value;
  if (u === 'gtq') return `${fmtNum(v, 0)} ${units.currency}`;
  if (u === 'ha' || u === 'mz') return `${fmtNum(v, 0)} ${units.area}`;
  if (u === 'mt' || u === 'qq') return `${fmtNum(v, 0)} ${units.weight}`;
  return display(key, raw, units).text;
}
