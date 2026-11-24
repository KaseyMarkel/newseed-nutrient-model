"""FAOSTAT Food Balances -> self-sufficiency ratio SSR = production / domestic supply, per country and crop,
summed over the latest 3 years available (2021-2023). Domestic share of what people eat = min(1, SSR).
Usage: python3 -I fao_domestic_build.py <FoodBalanceSheets_E_All_Data_(Normalized).zip> <WPP2024_...Age5...csv.gz> <global.json> <out_csv>
Streams both files (low memory). FBS items: Maize and products 2514, Rice and products 2807, Wheat and products 2511.
Elements (1000 t): Production 5511, Import 5611, Export 5911, Domestic supply 5301, Food 5142, Feed 5521.
`dfs` (domestic food share, used by the model) assumes imports go to feed first: food from domestic grain =
min(food, max(0, production - exports - max(0, feed - imports))); dfs = that / food. M49 -> ISO3 from WPP LocID."""
import csv, gzip, io, json, sys, zipfile
src, wpp, gj, out = sys.argv[1:5]
want = {c['iso3'] for c in json.load(open(gj))['countries']}
loc = {}
with gzip.open(wpp, 'rt', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        if r['ISO3_code'] and r['LocID'] not in loc: loc[r['LocID']] = r['ISO3_code']
z = zipfile.ZipFile(src)
m49 = {}
with z.open('FoodBalanceSheets_E_AreaCodes.csv') as f:
    for r in csv.DictReader(io.TextIOWrapper(f, encoding='latin-1')): m49[r['Area Code']] = loc.get(str(int(r['M49 Code'].lstrip("'")))) if r['M49 Code'].lstrip("'").isdigit() else None
ITEMS = {'2514': 'maize', '2807': 'rice', '2511': 'wheat'}
EL = {'5511': 'prod', '5611': 'imp', '5911': 'exp', '5301': 'dom', '5142': 'food', '5521': 'feed'}
acc = {}
with z.open('FoodBalanceSheets_E_All_Data_(Normalized).csv') as f:
    for r in csv.DictReader(io.TextIOWrapper(f, encoding='latin-1')):
        if r['Item Code'] not in ITEMS or r['Element Code'] not in EL: continue
        iso = m49.get(r['Area Code'])
        if iso not in want or int(r['Year']) < 2021: continue
        a = acc.setdefault((iso, ITEMS[r['Item Code']]), {}).setdefault(int(r['Year']), {})
        a[EL[r['Element Code']]] = float(r['Value'] or 0)
rows, miss = [], []
for iso in sorted(want):
    for crop in ('maize', 'rice', 'wheat'):
        ys = acc.get((iso, crop))
        if not ys: miss.append((iso, crop)); rows.append([iso, crop] + [''] * 9); continue
        yrs = sorted(ys)[-3:]
        s = {k: sum(ys[y].get(k, 0) for y in yrs) for k in EL.values()}
        ssr = s['prod'] / s['dom'] if s['dom'] > 0 else ''
        dom_food = min(s['food'], max(0, s['prod'] - s['exp'] - max(0, s['feed'] - s['imp'])))
        dfs = dom_food / s['food'] if s['food'] > 0 else (min(1, ssr) if ssr != '' else 1)
        rows.append([iso, crop, f'{yrs[0]}-{yrs[-1]}', round(s['prod'], 1), round(s['imp'], 1), round(s['exp'], 1), round(s['dom'], 1), round(s['food'], 1), round(s['feed'], 1), round(ssr, 4) if ssr != '' else '', round(dfs, 4)])
with open(out, 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['iso3', 'crop', 'years', 'production_kt', 'import_kt', 'export_kt', 'domestic_supply_kt', 'food_kt', 'feed_kt', 'ssr', 'dfs']); w.writerows(rows)
print(len(rows), 'rows; missing:', miss)
