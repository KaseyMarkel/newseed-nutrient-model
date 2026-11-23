// KPI metadata. Keys are the column names of Azahar's Module 06 outputs
// (spec/kpis.md). `unit` drives formatting and the unit toggles:
//   pct, pp, count, people, ha (area toggle), mt (weight toggle), gtq (currency toggle),
//   gtq_per_farmer, mg, g, kcal, z, kg, mt_per_ha, ratio
// `good`: 'up' when a larger value is better, 'down' when smaller is better.

export const KPIS = {
  // Farmers
  n_farmers_total: { label: 'Maize farmers', unit: 'count', group: 'farmers' },
  n_farmers_bio: { label: 'Adopting farmers', short: 'Biofort. farmers', unit: 'count', group: 'farmers', good: 'up' },
  farmers_bio_pct: { label: 'Adopting farmers (%)', unit: 'pct', group: 'farmers', good: 'up' },
  n_farmers_hybrid: { label: 'Hybrid farmers', unit: 'count', group: 'farmers' },
  n_hybrid_bio: { label: 'Hybrid adopters', unit: 'count', group: 'farmers', good: 'up' },
  hybrid_bio_pct: { label: 'Hybrid adopters (%)', unit: 'pct', group: 'farmers', good: 'up' },
  n_farmers_opv: { label: 'Non-hybrid farmers', unit: 'count', group: 'farmers' },
  n_opv_bio: { label: 'Non-hybrid adopters', unit: 'count', group: 'farmers', good: 'up' },
  opv_bio_pct: { label: 'Non-hybrid adopters (%)', unit: 'pct', group: 'farmers', good: 'up' },
  // Land
  land_ha_total: { label: 'Maize land', unit: 'ha', group: 'land' },
  land_bio_mz: { label: 'Biofortified land (mz)', unit: 'mz', group: 'land', good: 'up' },
  land_bio_ha: { label: 'Biofortified area', unit: 'ha', group: 'land', good: 'up' },
  land_bio_pct: { label: 'Biofortified land (%)', unit: 'pct', group: 'land', good: 'up' },
  yield_increase_mt_ha: { label: 'Yield increase', unit: 'mt_per_ha', group: 'land', good: 'up', derived: true },
  // Economics
  production_increment_total: { label: 'Additional maize (qq)', unit: 'qq', group: 'economics', good: 'up' },
  production_increment_mt: { label: 'Additional maize', unit: 'mt', group: 'economics', good: 'up' },
  production_biofortified_total: { label: 'Biofortified production (qq)', unit: 'qq', group: 'economics', good: 'up' },
  production_biofortified_mt: { label: 'Biofortified production', unit: 'mt', group: 'economics', good: 'up' },
  income_increment_total: { label: 'Total additional income', short: 'Net income', unit: 'gtq', group: 'economics', good: 'up' },
  income_increment_median: { label: 'Median income increment per adopter', unit: 'gtq', group: 'economics', good: 'up' },
  income_per_farmer_total: { label: 'Income per farmer', unit: 'gtq', group: 'economics', good: 'up' },
  income_per_farmer_adopter: { label: 'Additional income per adopter', short: 'Income per adopter', unit: 'gtq', group: 'economics', good: 'up' },
  cost_seeds_increment_total: { label: 'Seed cost difference', unit: 'gtq', group: 'economics', good: 'down' },
  // Subsidy
  cost_seeds_bio_no_subsidy_total: { label: 'Bio seed cost, no subsidy', unit: 'gtq', group: 'subsidy' },
  cost_seeds_bio_current_regime_total: { label: 'Bio seed cost paid by farmers', unit: 'gtq', group: 'subsidy' },
  subsidy_amount_absolute_total: { label: 'Total subsidy', unit: 'gtq', group: 'subsidy' },
  newseed_subsidy_total: { label: 'Subsidy cost', short: 'New Seed subsidy', unit: 'gtq', group: 'subsidy', good: 'down' },
  producer_absorption_total: { label: 'Producer absorption', unit: 'gtq', group: 'subsidy' },
  subsidy_reduction_cost_total: { label: 'Farmer extra cost', unit: 'gtq', group: 'subsidy', good: 'down' },
  newseed_savings_vs_current_total: { label: 'New Seed savings vs current', unit: 'gtq', group: 'subsidy', good: 'up' },
  // Coverage
  coverage_pct: { label: 'Biofortified maize consumed (%)', short: 'Coverage', unit: 'pct', group: 'coverage', good: 'up' },
  consumption_fsi_mt: { label: 'Maize consumed', unit: 'mt', group: 'coverage' },
  bio_consumed_mt: { label: 'Biofortified maize consumed', unit: 'mt', group: 'coverage', good: 'up' },
  iron_added_kg_year: { label: 'Additional iron in the food system', unit: 'kg', group: 'coverage', good: 'up' },
  zinc_added_kg_year: { label: 'Additional zinc in the food system', unit: 'kg', group: 'coverage', good: 'up' },
  population: { label: 'Total population', unit: 'people', group: 'coverage' },
  n_people_biofortified: { label: 'People consuming biofortified maize', unit: 'people', group: 'coverage', good: 'up' },
  // Consumption and energy
  maize_g_day_mean_baseline: { label: 'Maize consumption, baseline', unit: 'g', group: 'consumption' },
  maize_g_day_mean: { label: 'Mean maize consumption', unit: 'g', group: 'consumption' },
  mean_energy_baseline: { label: 'Energy intake, baseline', unit: 'kcal', group: 'energy' },
  mean_energy: { label: 'Energy intake', unit: 'kcal', group: 'energy' },
  mean_energy_under36_baseline: { label: 'Energy intake 6-35 mo, baseline', unit: 'kcal', group: 'energy' },
  mean_energy_under36: { label: 'Energy intake children 6-35 mo', unit: 'kcal', group: 'energy' },
  mean_energy_36to59_baseline: { label: 'Energy intake 36-59 mo, baseline', unit: 'kcal', group: 'energy' },
  mean_energy_36to59: { label: 'Energy intake children 36-59 mo', unit: 'kcal', group: 'energy' },
  // Children
  n_children: { label: 'Children 6-59 months', unit: 'count', group: 'children' },
  n_children_biofortified: { label: 'Children reached', unit: 'count', group: 'children', good: 'up' },
  children_coverage_pct: { label: 'Child coverage', unit: 'pct', group: 'children', good: 'up' },
  // Stunting
  stunting_pct_baseline: { label: 'Stunting prevalence, baseline', unit: 'pct', group: 'stunting' },
  n_stunted_baseline: { label: 'Stunted children, baseline', unit: 'count', group: 'stunting' },
  mean_zlen_baseline: { label: 'Mean HAZ, baseline', unit: 'z', group: 'stunting' },
  stunting_pct: { label: 'Stunting prevalence', unit: 'pct', group: 'stunting', good: 'down' },
  n_stunted_scenario: { label: 'Stunted children', unit: 'count', group: 'stunting', good: 'down' },
  mean_zlen: { label: 'Mean HAZ', unit: 'z', group: 'stunting', good: 'up' },
  stunting_change_pp: { label: 'Stunting reduction', unit: 'pp', group: 'stunting', good: 'up' },
  stunting_change_pct: { label: 'Stunting averted (% of baseline)', unit: 'pct', group: 'stunting', good: 'up' },
  n_stunting_averted: { label: 'Stunting cases averted', unit: 'count', group: 'stunting', good: 'up' },
  zlen_change: { label: 'HAZ improvement', unit: 'z', group: 'stunting', good: 'up', signed: true },
  // Zinc
  mean_zinc_total_baseline: { label: 'Zinc intake, baseline', unit: 'mg', group: 'zinc' },
  mean_zinc_total: { label: 'Zinc intake', unit: 'mg', group: 'zinc', good: 'up' },
  mean_zinc_baseline: { label: 'Absorbed zinc, baseline', unit: 'mg', group: 'zinc' },
  mean_zinc: { label: 'Mean absorbed zinc intake', unit: 'mg', group: 'zinc', good: 'up' },
  zinc_change_pct: { label: 'Absorbed zinc change', unit: 'pct', group: 'zinc', good: 'up', signed: true },
  zinc_inad_pct_baseline: { label: 'Zinc inadequacy, baseline', unit: 'pct', group: 'zinc' },
  zinc_inad_pct: { label: 'Absorbed zinc inadequacy', unit: 'pct', group: 'zinc', good: 'down' },
  zinc_inad_change_pp: { label: 'Zinc inadequacy reduction', unit: 'pp', group: 'zinc', good: 'up' },
  n_zinc_inad_baseline: { label: 'Zinc inadequate, baseline', unit: 'count', group: 'zinc' },
  n_zinc_inad_scenario: { label: 'Zinc inadequate', unit: 'count', group: 'zinc', good: 'down' },
  n_zinc_inad_averted: { label: 'Zinc inadequacy averted', unit: 'count', group: 'zinc', good: 'up' },
  zinc_inad_under12_pct: { label: 'Zinc inadequacy < 12 mo', unit: 'pct', group: 'zinc', good: 'down' },
  zinc_inad_12to35_pct: { label: 'Zinc inadequacy 12-35 mo', unit: 'pct', group: 'zinc', good: 'down' },
  zinc_inad_36to59_pct: { label: 'Zinc inadequacy 36-59 mo', unit: 'pct', group: 'zinc', good: 'down' },
  // Iron
  mean_iron_total_baseline: { label: 'Iron intake, baseline', unit: 'mg', group: 'iron' },
  mean_iron_total: { label: 'Mean iron intake', unit: 'mg', group: 'iron', good: 'up' },
  mean_iron_baseline: { label: 'Absorbed iron, baseline', unit: 'mg', group: 'iron' },
  mean_iron: { label: 'Mean absorbed iron', unit: 'mg', group: 'iron', good: 'up' },
  iron_change_pct: { label: 'Absorbed iron change', unit: 'pct', group: 'iron', good: 'up', signed: true },
  iron_inad_pct_baseline: { label: 'Iron inadequacy, baseline', unit: 'pct', group: 'iron' },
  iron_inad_pct: { label: 'Iron inadequacy', unit: 'pct', group: 'iron', good: 'down' },
  iron_inad_change_pp: { label: 'Iron inadequacy reduction', unit: 'pp', group: 'iron', good: 'up' },
  n_iron_inad_baseline: { label: 'Iron inadequate, baseline', unit: 'count', group: 'iron' },
  n_iron_inad_scenario: { label: 'Iron inadequate', unit: 'count', group: 'iron', good: 'down' },
  n_iron_inad_averted: { label: 'Iron inadequacy averted', unit: 'count', group: 'iron', good: 'up' },
  iron_inad_under36_pct: { label: 'Iron inadequacy 6-35 mo', unit: 'pct', group: 'iron', good: 'down' },
  iron_inad_36to59_pct: { label: 'Iron inadequacy 36-59 mo', unit: 'pct', group: 'iron', good: 'down' },
  // Protein
  mean_protein_baseline: { label: 'Utilizable protein, baseline', unit: 'g', group: 'protein' },
  mean_protein: { label: 'Mean utilizable protein intake', unit: 'g', group: 'protein', good: 'up' },
  protein_change_pct: { label: 'Protein change', unit: 'pct', group: 'protein', good: 'up', signed: true },
  protein_inad_pct_baseline: { label: 'Protein inadequacy, baseline', unit: 'pct', group: 'protein' },
  protein_inad_pct: { label: 'Utilizable protein inadequacy', unit: 'pct', group: 'protein', good: 'down' },
  protein_inad_change_pp: { label: 'Protein inadequacy reduction', unit: 'pp', group: 'protein', good: 'up' },
  n_protein_inad_baseline: { label: 'Protein inadequate, baseline', unit: 'count', group: 'protein' },
  n_protein_inad_scenario: { label: 'Protein inadequate', unit: 'count', group: 'protein', good: 'down' },
  n_protein_inad_averted: { label: 'Protein inadequacy averted', unit: 'count', group: 'protein', good: 'up' },
  protein_inad_under36_pct: { label: 'Protein inadequacy 6-35 mo', unit: 'pct', group: 'protein', good: 'down' },
  protein_inad_36to59_pct: { label: 'Protein inadequacy 36-59 mo', unit: 'pct', group: 'protein', good: 'down' }
};

export function kpiLabel(key) {
  const k = KPIS[key];
  return k ? k.label : key;
}
export function kpiUnit(key) {
  const k = KPIS[key];
  return k ? k.unit : 'number';
}

// KPIs offered in the KPI Trends selectors (same list as the live app).
export const TREND_KPIS = [
  'stunting_pct', 'stunting_change_pp', 'mean_zlen', 'zlen_change', 'n_stunting_averted',
  'mean_iron_total', 'iron_inad_pct', 'iron_inad_change_pp', 'n_iron_inad_averted',
  'mean_zinc', 'zinc_inad_pct', 'zinc_inad_change_pp', 'n_zinc_inad_averted',
  'mean_protein', 'protein_inad_pct', 'protein_inad_change_pp', 'n_protein_inad_averted',
  'n_farmers_bio', 'land_bio_ha', 'production_biofortified_mt', 'coverage_pct',
  'income_increment_total', 'income_per_farmer_adopter', 'newseed_subsidy_total'
];

// Department Table column groups (Overview page), mirroring the live app.
export const TABLE_GROUPS = [
  { id: 'farmers', label: 'Farmers', cols: [
    { key: 'n_farmers_total', label: 'Maize farmers' },
    { key: 'n_farmers_bio', label: 'Biofort. farmers n (%)', pctKey: 'farmers_bio_pct' },
    { key: 'n_farmers_hybrid', label: 'Hybrid farmers' },
    { key: 'n_hybrid_bio', label: 'Hybrid biofort. n (%)', pctKey: 'hybrid_bio_pct' },
    { key: 'n_farmers_opv', label: 'Non-hybrid farmers' },
    { key: 'n_opv_bio', label: 'Non-hybrid biofort. n (%)', pctKey: 'opv_bio_pct' }
  ] },
  { id: 'land', label: 'Land & production', cols: [
    { key: 'land_ha_total', label: 'Maize land' },
    { key: 'land_bio_ha', label: 'Biofort. land n (%)', pctKey: 'land_bio_pct' },
    { key: 'yield_increase_mt_ha', label: 'Yield increase' },
    { key: 'production_increment_mt', label: 'Additional maize' },
    { key: 'consumption_fsi_mt', label: 'Maize consumed' },
    { key: 'bio_consumed_mt', label: 'Biofort. consumed n (%)', pctKey: 'coverage_pct' }
  ] },
  { id: 'economics', label: 'Economics', cols: [
    { key: 'income_increment_total', label: 'Net income' },
    { key: 'income_per_farmer_total', label: 'Income/farmer' },
    { key: 'income_per_farmer_adopter', label: 'Income/adopter' },
    { key: 'cost_seeds_increment_total', label: 'Seed cost diff.' },
    { key: 'newseed_subsidy_total', label: 'New Seed subsidy' }
  ] },
  { id: 'children', label: 'Children', cols: [
    { key: 'n_children', label: 'Children 6-59 mo' },
    { key: 'n_children_biofortified', label: 'Children reached n (%)', pctKey: 'children_coverage_pct' },
    { key: 'maize_g_day_mean', label: 'Maize g/day' },
    { key: 'mean_energy', label: 'Energy kcal/day' }
  ] },
  { id: 'stunting', label: 'Stunting', cols: [
    { key: 'n_stunted_baseline', label: 'Stunting before n (%)', pctKey: 'stunting_pct_baseline' },
    { key: 'n_stunted_scenario', label: 'Stunting after n (%)', pctKey: 'stunting_pct' },
    { key: 'n_stunting_averted', label: 'Stunting averted n (% of stunted before)', pctKey: 'stunting_change_pct' },
    { key: 'mean_zlen', label: 'Mean HAZ' },
    { key: 'zlen_change', label: 'HAZ change' }
  ] },
  { id: 'zinc', label: 'Zinc', cols: [
    { key: 'mean_zinc_baseline', label: 'Absorbed zinc before' },
    { key: 'mean_zinc', label: 'Absorbed zinc after' },
    { key: 'n_zinc_inad_baseline', label: 'Zinc inad. before n (%)', pctKey: 'zinc_inad_pct_baseline' },
    { key: 'n_zinc_inad_scenario', label: 'Zinc inad. after n (%)', pctKey: 'zinc_inad_pct' },
    { key: 'n_zinc_inad_averted', label: 'Zinc inad. averted n (pp)', pctKey: 'zinc_inad_change_pp', pctUnit: 'pp' }
  ] },
  { id: 'iron', label: 'Iron', cols: [
    { key: 'mean_iron_total_baseline', label: 'Iron intake before' },
    { key: 'mean_iron_total', label: 'Iron intake after' },
    { key: 'n_iron_inad_baseline', label: 'Iron inad. before n (%)', pctKey: 'iron_inad_pct_baseline' },
    { key: 'n_iron_inad_scenario', label: 'Iron inad. after n (%)', pctKey: 'iron_inad_pct' },
    { key: 'n_iron_inad_averted', label: 'Iron inad. averted n (pp)', pctKey: 'iron_inad_change_pp', pctUnit: 'pp' }
  ] },
  { id: 'protein', label: 'Protein', cols: [
    { key: 'mean_protein_baseline', label: 'Protein before' },
    { key: 'mean_protein', label: 'Protein after' },
    { key: 'n_protein_inad_baseline', label: 'Protein inad. before n (%)', pctKey: 'protein_inad_pct_baseline' },
    { key: 'n_protein_inad_scenario', label: 'Protein inad. after n (%)', pctKey: 'protein_inad_pct' },
    { key: 'n_protein_inad_averted', label: 'Protein inad. averted n (pp)', pctKey: 'protein_inad_change_pp', pctUnit: 'pp' }
  ] }
];

// The Explorer pages: each has visualization radios, a summary tile set, map colour scale.
export const PAGES = {
  stunting: {
    nav: 'Nutrition', title: 'Stunting', scale: 'red', population: 'Children aged 6-59 months',
    viz: [
      { id: 'prevalence', label: 'Stunting prevalence', key: 'stunting_pct', mapTitle: 'Stunting prevalence', legend: 'Prevalence (%)' },
      { id: 'reduction', label: 'Stunting reduction (pp)', key: 'stunting_change_pp', mapTitle: 'Stunting reduction', legend: 'Reduction (pp)' },
      { id: 'mean_haz', label: 'Mean HAZ', key: 'mean_zlen', mapTitle: 'Mean HAZ', legend: 'HAZ (z)' },
      { id: 'haz_improvement', label: 'HAZ improvement (Δz)', key: 'zlen_change', mapTitle: 'HAZ improvement', legend: 'Δ HAZ (z)' }
    ],
    summary: { title: 'Stunting summary', tiles: [
      { key: 'stunting_pct', label: 'Stunting prevalence (%)' },
      { key: 'stunting_change_pp', label: 'Stunting reduction (pp)' },
      { key: 'mean_zlen', label: 'Mean HAZ' },
      { key: 'zlen_change', label: 'HAZ improvement (Δz)' }
    ] },
    note: 'Stunting metrics refer to children aged 6-59 months. The economic table refers to maize-producing households.',
    chart: 'dumbbell'
  },
  iron: {
    nav: 'Nutrition', title: 'Iron', scale: 'ochre', population: 'Children aged 6-59 months',
    viz: [
      { id: 'intake', label: 'Iron intake', key: 'mean_iron_total', mapTitle: 'Mean iron intake', legend: 'Intake (mg/day)' },
      { id: 'inadequacy', label: 'Iron inadequacy (%)', key: 'iron_inad_pct', mapTitle: 'Iron inadequacy', legend: 'Inadequacy (%)' }
    ],
    summary: { title: 'Iron summary', tiles: [
      { key: 'iron_inad_pct', label: 'Iron inadequacy (%)' },
      { key: 'iron_inad_change_pp', label: 'Inadequacy reduction (pp)' },
      { key: 'mean_iron_total', label: 'Mean iron intake (mg/d)' },
      { key: 'mean_iron_total', label: 'Intake improvement (mg/d)', delta: 'mean_iron_total_baseline' }
    ] },
    note: 'Nutrient metrics refer to children aged 6-59 months. The economic table refers to maize-producing households.',
    chart: 'box', box: { prefix: 'iron_total', unit: 'mg/day', ear: 10, earText: 'EAR: 10 mg/day (assuming 5% absorption; Allen et al., 2020)', meanKey: 'mean_iron_total' }
  },
  zinc: {
    nav: 'Nutrition', title: 'Zinc', scale: 'ochre', population: 'Children aged 6-59 months',
    viz: [
      { id: 'intake', label: 'Absorbed zinc intake', key: 'mean_zinc', mapTitle: 'Mean absorbed zinc intake', legend: 'Intake (mg/day)' },
      { id: 'inadequacy', label: 'Absorbed zinc inadequacy (%)', key: 'zinc_inad_pct', mapTitle: 'Absorbed zinc inadequacy', legend: 'Inadequacy (%)' }
    ],
    summary: { title: 'Zinc summary', tiles: [
      { key: 'zinc_inad_pct', label: 'Absorbed zinc inadequacy (%)' },
      { key: 'zinc_inad_change_pp', label: 'Inadequacy reduction (pp)' },
      { key: 'mean_zinc', label: 'Mean absorbed zinc intake (mg/d)' },
      { key: 'mean_zinc', label: 'Intake improvement (mg/d)', delta: 'mean_zinc_baseline' }
    ] },
    note: 'Nutrient metrics refer to children aged 6-59 months. The economic table refers to maize-producing households.',
    chart: 'box', box: { prefix: 'zinc', unit: 'mg/day', ear: [1.0, 1.4], earText: ['EAR: 1.0 mg/day (IZiNCG, 2004)', 'EAR: 1.4 mg/day (IZiNCG, 2004)'], meanKey: 'mean_zinc' }
  },
  protein: {
    nav: 'Nutrition', title: 'Protein', scale: 'ochre', population: 'Children aged 6-59 months',
    viz: [
      { id: 'intake', label: 'Utilizable protein intake', key: 'mean_protein', mapTitle: 'Mean utilizable protein intake', legend: 'Intake (g/day)' },
      { id: 'inadequacy', label: 'Utilizable protein inadequacy (%)', key: 'protein_inad_pct', mapTitle: 'Utilizable protein inadequacy', legend: 'Inadequacy (%)' }
    ],
    summary: { title: 'Protein summary', tiles: [
      { key: 'protein_inad_pct', label: 'Utilizable protein inadequacy (%)' },
      { key: 'protein_inad_change_pp', label: 'Inadequacy reduction (pp)' },
      { key: 'mean_protein', label: 'Mean utilizable protein intake (g/d)', decimals: 2 },
      { key: 'mean_protein', label: 'Intake improvement (g/d)', delta: 'mean_protein_baseline', decimals: 2 }
    ] },
    note: 'Nutrient metrics refer to children aged 6-59 months. The economic table refers to maize-producing households.',
    chart: 'box', box: { prefix: 'protein', unit: 'g/day', ear: [13, 19], earText: ['EAR: 13 g/day of utilizable protein (WHO/FAO, 2007)', 'EAR: 19 g/day of utilizable protein (WHO/FAO, 2007)'], meanKey: 'mean_protein' }
  },
  energy: {
    nav: 'Nutrition', title: 'Energy', scale: 'ochre', population: 'Children aged 6-59 months',
    viz: [
      { id: 'intake', label: 'Energy intake', key: 'mean_energy', mapTitle: 'Mean energy intake', legend: 'Intake (kcal/day)' }
    ],
    summary: { title: 'Energy summary', tiles: [
      { key: 'mean_energy_under36', label: 'Energy intake children 6-35 mo (kcal/d)' },
      { key: 'mean_energy_36to59', label: 'Energy intake children 36-59 mo (kcal/d)' }
    ] },
    note: 'Nutrient metrics refer to children aged 6-59 months. Biofortification does not alter the energy content of maize.',
    chart: 'box', box: { prefix: 'energy', unit: 'kcal/day', meanKey: 'mean_energy' }
  },
  consumption: {
    nav: 'Nutrition', title: 'Consumption', scale: 'ochre', population: 'Children aged 6-59 months',
    viz: [
      { id: 'maize', label: 'Maize consumption', key: 'maize_g_day_mean', mapTitle: 'Mean maize consumption', legend: 'g/day' },
      { id: 'child_coverage', label: 'Child coverage', key: 'children_coverage_pct', mapTitle: 'Children consuming biofortified maize', legend: 'Children (%)' },
      { id: 'population_coverage', label: 'Population coverage', key: 'n_people_biofortified', mapTitle: 'People consuming biofortified maize', legend: 'People' },
      { id: 'additional_zinc', label: 'Additional zinc', key: 'zinc_added_kg_year', mapTitle: 'Additional zinc in the food system', legend: 'kg/year' },
      { id: 'additional_iron', label: 'Additional iron', key: 'iron_added_kg_year', mapTitle: 'Additional iron in the food system', legend: 'kg/year' }
    ],
    summary: { title: 'Consumption summary', tiles: [
      { key: 'maize_g_day_mean', label: 'Mean maize consumption (g/day)' },
      { key: 'children_coverage_pct', label: 'Child coverage (%)' },
      { key: 'zinc_added_kg_year', label: 'Additional zinc in the food system (kg/year)' },
      { key: 'iron_added_kg_year', label: 'Additional iron in the food system (kg/year)' }
    ] },
    note: 'Maize consumption and child coverage refer to children aged 6-59 months. Population coverage uses per-capita consumption of the whole population.',
    chart: 'box', box: { prefix: 'maize_g', unit: 'g/day', meanKey: 'maize_g_day_mean', horizontal: true }
  },
  production: {
    nav: 'Economics', title: 'Production', scale: 'ochre', population: 'Farmers adopting biofortified seed',
    viz: [
      { id: 'farmers', label: 'Adopting farmers', key: 'n_farmers_bio', mapTitle: 'Adopting farmers', legend: 'Adopting farmers' },
      { id: 'hectares', label: 'Hectares planted', key: 'land_bio_ha', mapTitle: 'Area planted', legend: 'Area' },
      { id: 'income_total', label: 'Total additional income', key: 'income_increment_total', mapTitle: 'Total additional income', legend: 'Income' },
      { id: 'income_farmer', label: 'Additional income/adopter', key: 'income_per_farmer_adopter', mapTitle: 'Additional income per adopter', legend: 'Income per adopter' }
    ],
    summary: { title: 'Production summary', tiles: [
      { key: 'n_farmers_bio', label: 'Adopting farmers' },
      { key: 'land_bio_ha', label: 'Hectares planted', labelMz: 'Manzanas planted' }, // the live app keeps 'Hectares' in mz mode
      { key: 'income_per_farmer_adopter', label: 'Additional income/adopter' },
      { key: 'income_increment_total', label: 'Total additional income' }
    ] },
    note: 'Metrics based on maize-producing households from ENCOVI 2023.',
    chart: 'lollipop'
  }
};

// Right-hand "Production & economic impact" list shown on every Explorer page.
export const ECON_LIST = [
  { key: 'land_bio_ha', label: 'Bags of seed subsidized (20kg)', asBags: true },
  { key: 'n_farmers_bio', label: 'Adopting farmers' },
  { key: 'land_bio_ha', label: 'Biofortified area' },
  { key: 'bio_consumed_mt', label: 'Biofortified maize consumed' },
  { key: 'income_per_farmer_adopter', label: 'Additional income/adopter' },
  { key: 'income_increment_total', label: 'Total additional income' },
  { key: 'newseed_subsidy_total', label: 'Subsidy cost' },
  { key: 'n_people_biofortified', label: 'People consuming biofortified maize' }
];
