"""Build site/data/global.json from the BOTEC extraction (scratchpad/botec) and Passarelli 2024.

Usage: python3 -I build_data.py <botec_dir> <passarelli_csv> <out_json>
Only inputs are copied: the JS engine (site/js/global_engine.js) recomputes everything.
"""
import csv, json, sys
botec, pcsv, out = sys.argv[1], sys.argv[2], sys.argv[3]
def load(t):
    d = json.load(open(f'{botec}/{t}.json'))
    return {c['a1']: c['value'] for row in d['cells'] for c in row}
I, K = load('Inputs_and_Summary'), load('Katie_Stunting')
rows = list(csv.DictReader(open(f'{botec}/countries.csv')))
curt = {(r['country'], r['crop']): (float(r['colZ_max_cg_pct_ha']), float(r['colAA_annual_pct_per_yr']))
        for r in csv.DictReader(open(f'{botec}/variety_replacement_curt.csv')) if r['colZ_max_cg_pct_ha'] not in ('', None)}
# Passarelli: iso3 + 15 nutrients
pas, pname = {}, {}
for r in csv.DictReader(open(pcsv)):
    pas.setdefault(r['iso3'], {})[r['nutrient']] = {'all': float(r['prevalence_all']), 'u5': float(r['prevalence_children']), 'w': float(r['prevalence_women_15_49'])}
    pname[r['country'].lower()] = r['iso3']
ALIAS = {"cote d'ivoire": 'CIV', "côte d'ivoire": 'CIV', 'dr congo': 'COD', 'democratic republic of the congo': 'COD', 'congo, dem. rep.': 'COD',
         'congo': 'COG', 'republic of the congo': 'COG', 'tanzania': 'TZA', 'vietnam': 'VNM', 'viet nam': 'VNM', 'laos': 'LAO', 'lao pdr': 'LAO',
         'bolivia': 'BOL', 'iran': 'IRN', 'syria': 'SYR', 'south sudan': 'SSD', 'north korea': 'PRK', 'south korea': 'KOR', 'russia': 'RUS',
         'turkey': 'TUR', 'türkiye': 'TUR', 'egypt': 'EGY', 'yemen': 'YEM', 'gambia': 'GMB', 'the gambia': 'GMB', 'eswatini': 'SWZ',
         'myanmar': 'MMR', 'kyrgyzstan': 'KGZ', 'venezuela': 'VEN', 'cape verde': 'CPV', 'cabo verde': 'CPV', 'timor-leste': 'TLS',
         'east timor': 'TLS', 'palestine': 'PSE', 'moldova': 'MDA', 'micronesia': 'FSM', 'sao tome and principe': 'STP', 'guinea-bissau': 'GNB'}
def iso(name):
    n = name.strip().lower()
    return ALIAS.get(n) or pname.get(n) or next((v for k, v in pname.items() if n in k or k in n), None)
f = lambda v: float(v) if v not in ('', None) else None
countries, miss = [], []
for r in rows:
    name = r['A_country']; code = iso(name)
    if not code or code not in pas: miss.append(name)
    countries.append({
        'name': name, 'iso3': code, 'region': r['B_region'], 'tier': r['E_adoption_tier'],
        'pop': f(r['C_pop_2030_millions']), 'pop5': f(r['D_pop_0to4_2030_millions']),
        'share': [f(r['W_maize_calorie_share']), f(r['Y_rice_calorie_share']), f(r['AC_wheat_calorie_share'])],
        'zn': f(r['AV_zinc_inadequacy_prev']), 'fe': f(r['S_iron_inadequacy_prev']), 'stunt': f(r['T_stunting_prev_protein_proxy']),
        'gdp': f(r['AX_gdp_per_capita']),
        'curt': [curt.get((name, c)) for c in ('maize', 'rice', 'wheat')],
        'ge_status': r['P_ge_status_2026'][:300], 'tier_note': r['O_recommended_tier_vetted_jun2026'][:120],
        'katieW': K[f'W{30 + len(countries)}'],
        'pas': pas.get(code),
    })
def lev(r): return [I[f'B{r}'], I[f'C{r}'], I[f'D{r}']]
data = {
    'source': 'Gene_editing_mainstreaming_BOTEC v1.4 (New Seed, private WIP), pulled 2026-11-23; Passarelli et al. 2024 Lancet Glob Health (cfree14/global_intake_inadequacies @6408f24d)',
    'scenarios': ['Pessimistic', 'Median', 'Optimistic'],
    'levers': {  # [pess, med, opt]
        'zn_boost': lev(6), 'fe_boost': lev(7), 'prot_boost': lev(8),
        'ceil': lev(24), 'yrs': lev(25), 'speed': lev(26), 'growth': lev(34), 'skew': lev(40), 'zmult': lev(41),
        'sec_stunt': lev(42), 'sec_micro': lev(43), 'fib_delta': lev(62), 'fib_rr': lev(63), 'fib_ax': lev(65), 'fib_adequate': lev(66),
    },
    'tiers': {I[f'A{r}']: lev(r) for r in range(17, 22)},
    'scalars': {'prot_daly': I['B30'], 'stunt_daly': I['B31'], 'base_cov': I['B32'], 'disc': I['B33'], 'att': I['B36'], 'stunt_inc': I['B37'],
                'ret_zn': [I['B46'], I['C46'], I['D46']], 'ret_fe': [I['B47'], I['C47'], I['D47']], 'tmrel': I['B64'], 'fib_gap_cell': I['B66'],
                'daly_gdp_mult': I['B53']},
    'fiber_regions': {I[f'A{r}']: [I[f'B{r}'], I[f'C{r}']] for r in range(69, 76)},
    'katie': {k: K[k] for k in ('B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14')},
    'katie_regions': {K[f'A{r}']: [K[f'B{r}'], K[f'C{r}']] for r in range(20, 27)},
    'costs': {'years': list(range(2026, 2051)), 'total': [I[f'{c}128'] for c in 'BCDEFGHIJKLMNOPQRSTUVWXYZ'], 'extra_2027_29': I['B109']},
    'countries': countries,
}
json.dump(data, open(out, 'w'), separators=(',', ':'))
print(len(countries), 'countries; unmatched to Passarelli:', miss)
