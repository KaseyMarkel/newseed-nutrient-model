"""UN WPP 2024 medium variant -> population growth factors vs 2030 for the model's countries.
Usage: python3 -I wpp_build.py <WPP2024_PopulationByAge5GroupSex_Medium.csv.gz> <global.json> <out_csv>
Streams the file (low memory). Output: iso3, year, pop_all, pop_u5, pop_w15_49 (thousands)."""
import csv, gzip, io, json, sys
src, gj, out = sys.argv[1:4]
want = {c['iso3'] for c in json.load(open(gj))['countries']}
W = {f'{a}-{a+4}' for a in range(15, 50, 5)}
acc = {}
with gzip.open(src, 'rt', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        iso = r['ISO3_code']
        if iso not in want: continue
        y = int(r['Time'])
        if y < 2030 or y > 2080: continue
        a = acc.setdefault((iso, y), [0.0, 0.0, 0.0])
        a[0] += float(r['PopTotal'])
        if r['AgeGrp'] == '0-4': a[1] += float(r['PopTotal'])
        if r['AgeGrp'] in W: a[2] += float(r['PopFemale'])
missing = want - {k[0] for k in acc}
with open(out, 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['iso3', 'year', 'pop_all_k', 'pop_u5_k', 'pop_w15_49_k'])
    for (iso, y), a in sorted(acc.items()): w.writerow([iso, y] + [round(v, 3) for v in a])
print(len(acc), 'rows; missing:', missing)
