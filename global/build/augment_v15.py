"""v1.5 additions to site/data/global.json (run after build_data.py):
  popg  UN WPP 2024 medium-variant population relative to 2030, years 2030..2080 (5-year anchors, linear between): {all, u5, w} (w = women 15-49)
  dfs   FAOSTAT domestic food share per crop [maize, rice, wheat] (imports go to feed first; fao_domestic_build.py)
  base  counterfactual conventional biofortification by 2035, per crop: {zn, fe, prot} shares (baseline_coverage.csv)
Usage: python3 -I augment_v15.py <global.json> <wpp2024_medium.csv> <fao_self_sufficiency.csv> <baseline_coverage.csv>"""
import csv, json, sys
gj, wpp, fao, basef = sys.argv[1:5]
D = json.load(open(gj))
P = {}
for r in csv.DictReader(open(wpp)):
    P.setdefault(r['iso3'], {})[int(r['year'])] = (float(r['pop_all_k']), float(r['pop_u5_k']), float(r['pop_w15_49_k']))
F = {(r['iso3'], r['crop']): float(r['dfs']) for r in csv.DictReader(open(fao)) if r['dfs'] != ''}
B = {}
for r in csv.DictReader(open(basef)):
    B.setdefault(r['iso3'], [{}, {}, {}])[['maize', 'rice', 'wheat'].index(r['crop'])][r['trait']] = float(r['central'])
for c in D['countries']:
    p = P[c['iso3']]; b = p[2030]
    # 5-year anchors (ratio to 2030, 4 d.p.), linearly interpolated, so the Google Sheet mirror can reproduce them exactly
    anc = {k: [round(p[y][j] / b[j], 4) for y in range(2030, 2081, 5)] for j, k in enumerate(('all', 'u5', 'w'))}
    c['popg_anchor'] = anc
    c['popg'] = {k: [a[(y - 2030) // 5] + (a[min((y - 2030) // 5 + 1, 10)] - a[(y - 2030) // 5]) * ((y - 2030) % 5) / 5 for y in range(2030, 2081)] for k, a in anc.items()}
    c['wshare'] = round(b[2] / b[0], 4)
    c['dfs'] = [round(F.get((c['iso3'], cr), 1.0), 4) for cr in ('maize', 'rice', 'wheat')]
    if c['iso3'] in B: c['base'] = B[c['iso3']]
    else: c.pop('base', None)
D['source'] += '; UN WPP 2024 medium variant (population 2030-2080); FAOSTAT Food Balances 2022-2024 (domestic food share); baseline biofortification coverage (global/inputs/baseline_coverage.csv)'
json.dump(D, open(gj, 'w'), separators=(',', ':'))
print('augmented', len(D['countries']), 'countries; with baseline rows:', sum('base' in c for c in D['countries']))
