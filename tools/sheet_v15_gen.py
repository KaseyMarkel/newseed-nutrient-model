"""Generate the Google Sheet (BOTEC v1.5-WIP) payloads: one JSON file per write call."""
import json, os, sys
O = (sys.argv[1] if len(sys.argv) > 1 else "sheet_payloads") + "/"; os.makedirs(O, exist_ok=True)
F, T = False, True
# ---------------- Inputs ----------------
# (label, pess, med, opt, redteam, note)
L = [
 ('Zinc boost (bioavailable, vs conventional)', .1, .4, .8, .4, 'v1.4 F6. New Seed backcrossed maize about 40%'),
 ('Iron boost', .125, .3, .7, .3, 'v1.4 F7'),
 ('Protein-quality boost (lysine + tryptophan)', .2, .4, .8, .4, 'v1.4 F8'),
 ('Zinc gap closed per unit boost', .5, .5, .5, .5, 'v1.4 F12 factor'),
 ('Iron gap closed per unit boost', .25, .25, .25, .25, 'v1.4 F13 factor (phytate, food matrix)'),
 ('Protein gap closed per unit boost', .5, .5, .5, .5, 'v1.4 F14 factor'),
 ('Lab-to-field retention', .6, .6, .6, .6, 'v1.4: 40% lab-to-field loss'),
 ('Phytate cut (share of maximum, edit knockouts)', 0, 0, 0, 0, 'New. lpa-type knockouts cut phytate 60-80%'),
 ('Absorbed zinc gain at full phytate cut', .25, .25, .25, .25, 'New. Shrunk: adult gains far larger; Guatemalan child trial null'),
 ('Absorbed iron gain at full phytate cut', .15, .15, .15, .15, 'New. Same shrinkage'),
 ('Approval year: Already approved', 2034, 2032, 2030, 2032, 'v1.4 tier table. 2100 or later = never'),
 ('Approval year: Fast follower', 2038, 2034, 2030, 2034, ''),
 ('Approval year: Mid adopter', 2044, 2038, 2032, 2038, ''),
 ('Approval year: Late adopter', 2056, 2046, 2036, 2046, ''),
 ('Approval year: Late to never', 2200, 2100, 2051, 2100, ''),
 ('Max CG-derived share of crop area', .25, .5, .7, .5, 'v1.4 F24'),
 ('Years to reach the max (combos without Curt data)', 30, 20, 15, 20, 'v1.4 F25'),
 ('Adoption speed multiplier', .6, 1, 1.5, 1, 'v1.4 F26'),
 ('Adoption skew (area to at-risk eaters)', .7, .85, 1, .85, 'v1.4 F40'),
 ('Curt col-Z ceiling multiplier', 2, 2, 2, 1.5, 'v1.4 F41 (awaiting Curt: maybe 1). Red-team 1.5'),
 ('Stunting growth effect (Gunaratna 2010: +9% height growth)', .06, .09, .15, .09, 'v1.4 F34. Gunaratna et al. 2010, Food Policy 35:202, doi:10.1016/j.foodpol.2009.11.003'),
 ('Secular decline: stunting and child deaths (per year)', .03, .02, .01, .02, 'v1.4 F42'),
 ('Secular decline: micronutrient gaps (per year)', .02, .01, 0, .01, 'v1.4 F43'),
 ('Fiber added (g/day per wheat eater)', 1, 2, 3, 2, 'v1.4 F62'),
 ('Fiber RR per +7 g/day', .94, .91, .88, .91, 'v1.4 F63; Threapleton 2013'),
 ('Arabinoxylan vs total fiber', .3, .6, 1, .6, 'v1.4 F65'),
 ('Fiber-adequate share', .8, .5, .2, .5, 'v1.4 F66 (v1.4 always used the Pessimistic 0.8: quirk Q2)'),
 ('Fix Q2: use the active fiber-adequate share', F, F, F, T, 'FALSE reproduces v1.4'),
 ('Zinc burden anchor (million DALYs)', 28, 28, 28, 2.58, 'v1.4: WHO 2002 (~800k deaths, 1.9% of DALYs). GBD 2017: 2.58M; GBD 2019: 0.259M (Hess et al. 2021, doi:10.1017/S1368980021004821). Both GBD: ages 1-4 only'),
 ('Iron DALYs per person-year at risk', '=0.025/3', '=0.025/3', '=0.025/3', '=0.025/3', 'v1.4 B29'),
 ('Protein DALYs per person-year (all ages)', .01, .01, .01, .01, 'v1.4 B30 placeholder (unsourced)'),
 ('DALYs per stunting case averted', 2.8, 2.8, 2.8, 1.5, 'v1.4 B31. Disability-only estimates are about 0.1-0.25; 2.8 is defensible only if it bundles deaths'),
 ('Stunting incidence conversion', .2, .2, .2, .2, 'v1.4 B37'),
 ('Stunting method', 'HAZ shift', 'HAZ shift', 'HAZ shift', 'HAZ shift', 'HAZ shift or Growth rate (v1.0 concept note used the growth rate)'),
 ('Already biofortified anyway (flat)', .15, .15, .15, .15, 'v1.4 B32. Used when "baseline by country" is FALSE'),
 ('Discount rate', .043, .043, .043, .043, 'v1.4 B33'),
 ('Credit to New Seed (attribution)', .3, .3, .3, .3, 'v1.4 B36'),
 ('Value of a DALY (x GDP per capita)', 2.3, 2.3, 2.3, 2.3, 'v1.4 B53'),
 ('Program cost multiplier', 1, 1, 1, 1, 'Applies to the Costs tab'),
 ('Fiber TMREL (g/day)', 23.5, 23.5, 23.5, 23.5, 'v1.4 B64'),
 ('Zinc retention: maize', .9, .9, .9, .9, 'v1.4 B46'),
 ('Zinc retention: rice', .75, .75, .75, .75, 'v1.4 C46'),
 ('Zinc retention: wheat', .7, .7, .7, .7, 'v1.4 D46'),
 ('Iron retention: maize', .85, .85, .85, .85, 'v1.4 B47'),
 ('Iron retention: rice', .4, .4, .4, .4, 'v1.4 C47'),
 ('Iron retention: wheat', .6, .6, .6, .6, 'v1.4 D47'),
 ('Probability the edits work: maize', 1, 1, 1, .5, 'Red-team. 1 = results conditional on success. The concept note expects 2-20% of genes to be usable'),
 ('Probability the edits work: rice', 1, 1, 1, .35, 'Red-team. Rice program not yet funded'),
 ('Probability the edits work: wheat', 1, 1, 1, .35, 'Red-team. Wheat program not yet funded; hexaploid'),
 ('Scale stunting by edit size', F, F, F, T, 'Red-team. FALSE = v1.4 (full QPM growth effect at any protein boost)'),
 ('Lysine gain of the reference QPM', .8, .8, .8, .8, 'QPM roughly doubles lysine and tryptophan (+70-100%)'),
 ('QPM evidence transfer: maize', 1, 1, 1, 1, ''),
 ('QPM evidence transfer: rice', 1, 1, 1, .4, 'Red-team. Milled rice lysine score about 0.70 vs 0.53 for maize and wheat; no growth trial of high-lysine rice'),
 ('QPM evidence transfer: wheat', 1, 1, 1, .8, 'Red-team. Wheat is lysine-limited like maize'),
 ('Seed lag after approval: maize (years)', 0, 0, 0, 1, 'Red-team. v1.4 plants in the approval year'),
 ('Seed lag after approval: rice (years)', 0, 0, 0, 3, "Red-team. India's seed chain takes 3+ seasons; adoption lags release 5-10 years"),
 ('Seed lag after approval: wheat (years)', 0, 0, 0, 3, ''),
 ('Last year counted (2050 to 2060)', 2050, 2050, 2050, 2060, 'v1.4: 2050. Later years keep the secular decline; costs continue at the 2050 rate'),
 ('Include $1M/yr advocacy in costs', T, T, T, T, 'Advocacy moves no approval year in the model'),
 ('Population grows by year (UN WPP 2024)', F, F, F, T, 'v1.5. FALSE = v1.4 (2030 population held fixed)'),
 ('Credit only domestically grown grain', F, F, F, T, 'v1.5. FAOSTAT food balances 2022-24; imports assumed to go to feed first'),
 ('Already biofortified: by country', F, F, F, T, 'v1.5. Known programs on the Countries tab, cols X:AF; floor elsewhere'),
 ('Already biofortified: floor where no program is known', .02, .02, .02, .02, 'v1.5. Research 2026-11-24: about 2% (0.5-5%)'),
 ('Include maize', T, T, T, T, ''),
 ('Include rice', T, T, T, T, ''),
 ('Include wheat', T, T, T, T, ''),
]
R0 = 6
rows = [['Gene_editing_mainstreaming_BOTEC v1.5-WIP: inputs'] + [None] * 7,
        ['Pick a scenario in B3. Blue cells are inputs; column F (Custom) falls back to Median where blank; column G is what the model uses.'] + [None] * 7,
        ['Scenario', 'Median', None, None, None, None, None, None],
        [None] * 8,
        ['Input', 'Pessimistic', 'Median', 'Optimistic', 'Red-team central', 'Custom', 'Active', 'Note / source']]
for i, (lab, p, m, o, rt, note) in enumerate(L):
    r = R0 + i
    rows.append([lab, p, m, o, rt, None, f'=IF($B$3="Custom",IF(F{r}="",C{r},F{r}),INDEX(B{r}:E{r},MATCH($B$3,$B$5:$E$5,0)))', note])
ROW = {lab: R0 + i for i, (lab, *_r) in enumerate(L)}
def G(lab): return f'Inputs!$G${ROW[lab]}'
last = R0 + len(L) - 1
assert last == 71, last
der = [
 ('Derived (do not edit)', None, None),
 ('Zinc effectiveness', '=((1+G6)*(1+G14*G13)-1)*G9*G12', 'bioavailable boost x gap closed x lab-to-field'),
 ('Iron effectiveness', '=((1+G7)*(1+G15*G13)-1)*G10*G12', ''),
 ('Protein effectiveness', '=G8*G11*G12', ''),
 ('Zinc recalibration (1.5B at risk)', '=MIN(1,1.5E9/SUMPRODUCT(Countries!E5:E79*1E6,Countries!K5:K79))', 'v1.4 B48'),
 ('Zinc DALYs per person-year at risk', '=0.02*G77*G34/28', 'v1.4 B28 = 0.02 x recalibration, scaled by the burden anchor'),
 ('Stunting dose (edit size vs QPM)', '=IF(G55,MIN(1,G8*G12/G56),1)', ''),
 ('Growth effect: maize', '=G26*G79*G57', ''),
 ('Growth effect: rice', '=G26*G79*G58', ''),
 ('Growth effect: wheat', '=G26*G79*G59', ''),
 ('Fiber gap (not already adequate)', '=IF(G33,1-G32,1-B32)', 'v1.4 quirk Q2 when G33 is FALSE'),
]
rows.append([None] * 8)
for lab, f, note in der:
    rows.append([lab, None, None, None, None, None, f, note])
json.dump({'range': 'Inputs!A1', 'formulas': rows}, open(O + 'inputs.json', 'w'))
ND = 73  # derived header row
assert rows[ND - 1][0] == 'Derived (do not edit)'
# ---------------- Countries derived ----------------
cd = [['Share maize', 'Share rice', 'Share wheat', 'Approval year', 'Fiber intake x0 (g/day)', 'Fiber-attributable DALYs per capita', 'Fiber DALYs averted per capita at full adoption'],
      ['=ARRAYFORMULA(IF(H5:H79="",0,H5:H79/G5:G79))', '=ARRAYFORMULA(IF(I5:I79="",0,I5:I79/G5:G79))', '=ARRAYFORMULA(IF(J5:J79="",0,J5:J79/G5:G79))',
       '=ARRAYFORMULA(LET(v,VLOOKUP(D5:D79,Inputs!$A$16:$G$20,7,FALSE),IF(v<2030,2030,v)))',
       '=ARRAYFORMULA(VLOOKUP(C5:C79,$A$84:$C$90,2,FALSE))', '=ARRAYFORMULA(VLOOKUP(C5:C79,$A$84:$C$90,3,FALSE))',
       '=ARRAYFORMULA(LET(T,Inputs!$G$45,x0,AK5:AK79,a,x0+Inputs!$G$29*AI5:AI79,x1,IF(a<T,a,T),r0,Inputs!$G$30^((x0-T)/7),r1,Inputs!$G$30^((x1-T)/7),p0,(r0-1)/r0,p1,(r1-1)/r1,AL5:AL79*IF(p0<=0,0,(p0-p1)/p0)*Inputs!$G$31))']]
json.dump({'range': 'Countries!AG4', 'formulas': cd}, open(O + 'countries_derived.json', 'w'))
# ---------------- Population factors ----------------
interp = lambda a, sw: f'=MAKEARRAY(75,31,LAMBDA(r,c,IF(Inputs!$G$65,LET(k,c-1,j,INT(k/5),f,MOD(k,5)/5,a,INDEX({a},r,j+1),b,INDEX({a},r,MIN(j+2,7)),a+(b-a)*f),1)))'
pf = {'range': 'Population!Q3', 'formulas': [
  ['Factor vs 2030, all ages (1 when population growth is off)'] + [None] * 31 + ['Factor vs 2030, under-5'],
  ['=SEQUENCE(1,31,2030)'] + [None] * 31 + ['=SEQUENCE(1,31,2030)'],
  [interp('$B$5:$H$79', 1)] + [None] * 31 + [interp('$I$5:$O$79', 1)]]}
json.dump(pf, open(O + 'pop_formulas.json', 'w'))
# ---------------- Stunting HAZ ----------------
hz = {'range': 'Stunting HAZ!A1', 'formulas': [
  ['Stunting: HAZ-distribution shift (v1.4 Katie Stunting tab)', None, None, None, None, None],
  ['W = relative fall in stunting prevalence = 1 - NORM.DIST(-2, mu + dHAZ, sigma) / NORM.DIST(-2, mu, sigma), with mu set so that NORM.DIST(-2, mu, sigma) = stunting prevalence.', None, None, None, None, None],
  ['Baseline growth (cm/month)', 0.82, None, None, None, None],
  ['Months of exposure', 12, None, None, None, None],
  ['WHO reference SD (cm)', 2.8, None, None, None, None],
  ['Population HAZ SD (sigma)', 1.2, None, None, None, None],
  [None] * 6,
  ['dHAZ: maize', '=B3*Inputs!G80*B4/B5', None, None, None, None],
  ['dHAZ: rice', '=B3*Inputs!G81*B4/B5', None, None, None, None],
  ['dHAZ: wheat', '=B3*Inputs!G82*B4/B5', None, None, None, None],
  [None] * 6,
  ['Country', 'Stunting prevalence', 'Mean HAZ (mu)', 'W maize', 'W rice', 'W wheat'],
  ['=Countries!A5:A79', '=Countries!M5:M79', '=ARRAYFORMULA(IF(B13:B87>0,-2-$B$6*NORM.S.INV(B13:B87),0))',
   '=ARRAYFORMULA(IF(B13:B87>0,1-NORM.DIST(-2,C13:C87+$B$8,$B$6,TRUE)/NORM.DIST(-2,C13:C87,$B$6,TRUE),0))',
   '=ARRAYFORMULA(IF(B13:B87>0,1-NORM.DIST(-2,C13:C87+$B$9,$B$6,TRUE)/NORM.DIST(-2,C13:C87,$B$6,TRUE),0))',
   '=ARRAYFORMULA(IF(B13:B87>0,1-NORM.DIST(-2,C13:C87+$B$10,$B$6,TRUE)/NORM.DIST(-2,C13:C87,$B$6,TRUE),0))']]}
json.dump(hz, open(O + 'haz.json', 'w'))
# ---------------- Crop tabs ----------------
def col(n):
    s = ''
    while n: n, r = divmod(n - 1, 26); s = chr(65 + r) + s
    return s
blocks = ['VR', 'Zn', 'Fe', 'PW', 'ST', 'FB']
start = {b: 8 + 32 * i for i, b in enumerate(blocks)}  # H=8
rng = lambda b: f'{col(start[b])}5:{col(start[b] + 30)}79'
title = {'VR': 'Edited share of crop eaten (variety replacement x skew x domestic share)', 'Zn': 'Zinc DALYs (before attribution)', 'Fe': 'Iron DALYs',
         'PW': 'Protein quality, all ages: DALYs', 'ST': 'Stunting, under-5: DALYs', 'FB': 'Fiber to heart disease: DALYs (wheat only)'}
CR = ['maize', 'rice', 'wheat']; CAP = ['Maize', 'Rice', 'Wheat']
for ci, crop in enumerate(CR):
    sh = col(33 + ci)  # AG AH AI share
    Z, AA, dfs = col(15 + ci), col(18 + ci), col(21 + ci)  # O..Q, R..T, U..W
    bz, bf, bp = [col(24 + 3 * ci + j) for j in range(3)]  # X..AF
    pS = f'Inputs!$G${52 + ci}'
    vr = rng('VR')
    f = {}
    f['VR'] = (f'=ARRAYFORMULA(LET(yr,SEQUENCE(1,31,2030),ap,Countries!$AJ$5:$AJ$79,st,ap+IF(ap<2100,Inputs!$G${60 + ci},0),n,yr-st+1,'
               f'cz,Countries!${Z}$5:${Z}$79,ca,Countries!${AA}$5:${AA}$79,cl,Inputs!$G$21,sp,Inputs!$G$23,zc,Inputs!$G$25*cz/100,'
               f'lin,IF(cz="",cl/Inputs!$G$22*sp*n,ca/100*sp*n),cp,IF(cz="",cl,IF(cl<zc,cl,zc)),v,IF(lin<cp,lin,cp),'
               f'IF(n<1,0,v*Inputs!$G$24*Inputs!$G${69 + ci}*IF(Inputs!$G$66,Countries!${dfs}$5:${dfs}$79,1))))')
    base = f'Countries!$E$5:$E$79*1E6*Population!$Q$5:$AU$79*Countries!${sh}$5:${sh}$79'
    f['Zn'] = f'=ARRAYFORMULA((1-Inputs!$G$28)^SEQUENCE(1,31,0)*{base}*Countries!$K$5:$K$79*Inputs!$G$78*Inputs!$G$74*Inputs!$G${46 + ci}*{vr}*$B$5:$B$79*{pS})'
    f['Fe'] = f'=ARRAYFORMULA((1-Inputs!$G$28)^SEQUENCE(1,31,0)*{base}*Countries!$L$5:$L$79*Inputs!$G$35*Inputs!$G$75*Inputs!$G${49 + ci}*{vr}*$C$5:$C$79*{pS})'
    f['PW'] = f'=ARRAYFORMULA((1-Inputs!$G$27)^SEQUENCE(1,31,0)*{base}*Countries!$M$5:$M$79*Inputs!$G$36*Inputs!$G$76*{vr}*$D$5:$D$79*{pS})'
    f['ST'] = (f'=ARRAYFORMULA((1-Inputs!$G$27)^SEQUENCE(1,31,0)*Countries!$F$5:$F$79*1E6*Population!$AW$5:$CA$79*Countries!${sh}$5:${sh}$79'
               f'*Countries!$M$5:$M$79*Inputs!$G$38*Inputs!$G$37*$E$5:$E$79*{vr}*$D$5:$D$79*{pS})')
    if ci == 2:
        f['FB'] = f'=ARRAYFORMULA(Countries!$E$5:$E$79*1E6*Population!$Q$5:$AU$79*Countries!$AM$5:$AM$79*{vr}*Inputs!$G$83*{pS})'
    W = ['D', 'E', 'F'][ci]
    gap = lambda c: f'=ARRAYFORMULA(IF(Inputs!$G$67,1-IF(Countries!{c}5:{c}79>Inputs!$G$68,Countries!{c}5:{c}79,Inputs!$G$68),1-Inputs!$G$40))'
    sumblocks = '+'.join(rng(b) for b in (['Zn', 'Fe', 'PW', 'ST'] + (['FB'] if ci == 2 else [])))
    width = start['FB'] + 31 if ci == 2 else start['ST'] + 31
    grid = [[None] * (width - 1) for _ in range(3)]
    grid[0][0] = f'{CAP[ci]}: DALYs averted by country and year, before attribution. Each block is one array formula.'
    hdr = ['Country', 'Gap left: zinc', 'Gap left: iron', 'Gap left: protein', 'Stunting effect (W or growth)', 'Total DALYs, years counted']
    for j, x in enumerate(hdr): grid[1][j] = x
    grid[2][0] = '=ARRAYFORMULA(Countries!A5:A79)'; grid[2][1] = gap(bz); grid[2][2] = gap(bf); grid[2][3] = gap(bp)
    grid[2][4] = f'=ARRAYFORMULA(IF(Inputs!$G$39="HAZ shift",\'Stunting HAZ\'!{W}13:{W}87,Inputs!$G${80 + ci}))'
    grid[2][5] = f'=ARRAYFORMULA(MMULT({sumblocks},TRANSPOSE(--(SEQUENCE(1,31,2030)<=Inputs!$G$63))))'
    for b in blocks:
        if b == 'FB' and ci != 2: continue
        s = start[b] - 1
        grid[0][s] = title[b]; grid[1][s] = '=SEQUENCE(1,31,2030)'; grid[2][s] = f[b]
    # rows 3..5 of sheet: grid row0 -> row3, row1 -> row4, row2 -> row5
    json.dump({'range': f'{CAP[ci]}!A3', 'formulas': grid}, open(O + f'crop_{crop}.json', 'w'))
# ---------------- Results ----------------
yrs = 'B15:AF15'
def bycol(expr): return f'=ARRAYFORMULA(BYCOL({expr},LAMBDA(c,SUM(c)))*Inputs!$G$42*$B$16:$AF$16)'
blk = lambda tab, b: f'{tab}!{rng(b)}'
crop_sum = lambda tab, ci: '+'.join(blk(tab, b) for b in (['Zn', 'Fe', 'PW', 'ST'] + (['FB'] if ci == 2 else [])))
res = [[None] * 32 for _ in range(48)]
def put(r, c, v): res[r - 1][c - 1] = v
put(1, 1, 'Results: DALYs averted credited to New Seed, cost per DALY'); put(2, 1, '=CONCATENATE("Scenario: ",Inputs!B3,". Years 2030 to ",Inputs!G63,".")')
H = [('DALYs averted (credited, undiscounted)', '=SUM(B20:AF20)'), ('Discounted DALYs (2026 value)', '=SUM(B22:AF22)'),
     ('Program cost', '=Costs!B43'), ('Program cost, discounted (2026 value)', '=Costs!B44'),
     ('Cost per DALY', '=IF(B3>0,B5/B3,"")'), ('Cost per discounted DALY', '=IF(B4>0,B6/B4,"")'),
     ('Value of health gains, discounted', '=SUMPRODUCT((B17:AF17*B31+B18:AF18*B32+B19:AF19*B33)*B21:AF21)'),
     ('DALYs: maize', '=SUM(B17:AF17)'), ('DALYs: rice', '=SUM(B18:AF18)'), ('DALYs: wheat', '=SUM(B19:AF19)')]
for i, (a, b) in enumerate(H): put(3 + i, 1, a); put(3 + i, 2, b)
put(15, 1, 'Year'); put(15, 2, '=SEQUENCE(1,31,2030)')
put(16, 1, 'Counted (year <= last year)'); put(16, 2, f'=ARRAYFORMULA(--({yrs}<=Inputs!G63))')
for ci, cap in enumerate(CAP): put(17 + ci, 1, f'{cap} (credited)'); put(17 + ci, 2, bycol(crop_sum(cap, ci)))
put(20, 1, 'Total (credited)'); put(20, 2, '=ARRAYFORMULA(B17:AF17+B18:AF18+B19:AF19)')
put(21, 1, 'Discount factor to 2026'); put(21, 2, f'=ARRAYFORMULA(1/(1+Inputs!G41)^({yrs}-2026))')
put(22, 1, 'Total, discounted'); put(22, 2, '=ARRAYFORMULA(B20:AF20*B21:AF21)')
put(24, 1, 'By pathway (credited)')
for k, (lab, b) in enumerate([('Zinc', 'Zn'), ('Iron', 'Fe'), ('Protein quality, all ages', 'PW'), ('Stunting, under-5', 'ST')]):
    put(25 + k, 1, lab); put(25 + k, 2, bycol('+'.join(blk(t, b) for t in CAP)))
put(29, 1, 'Fiber to heart disease'); put(29, 2, bycol(blk('Wheat', 'FB')))
put(30, 1, 'Value per DALY by crop ($, DALY-weighted GDP per capita x multiple)')
for ci, cap in enumerate(CAP):
    put(31 + ci, 1, f'Value per DALY: {CR[ci]}'); put(31 + ci, 2, f'=IF(SUM({cap}!F5:F79)=0,0,SUMPRODUCT({cap}!F5:F79,Countries!N5:N79)/SUM({cap}!F5:F79)*Inputs!G43)')
json.dump({'range': 'Results!A1', 'formulas': res[:33]}, open(O + 'results.json', 'w'))
# totals per pathway in col D? keep compact: separate small block
pt = [['Pathway totals (credited)', None], *[[lab, f'=SUM(B{25 + k}:AF{25 + k})'] for k, lab in enumerate(['Zinc', 'Iron', 'Protein quality, all ages', 'Stunting, under-5', 'Fiber to heart disease'])]]
json.dump({'range': 'Results!D3', 'formulas': pt}, open(O + 'results_pathways.json', 'w'))
top = [['Top countries (credited DALYs)', None], ['=SORTN(HSTACK(Countries!A5:A79,(Maize!F5:F79+Rice!F5:F79+Wheat!F5:F79)*Inputs!G42),15,0,2,FALSE)', None]]
json.dump({'range': 'Results!AH3', 'formulas': top}, open(O + 'results_top.json', 'w'))
top_range='Results!AH3'
# ---------------- Costs ----------------
D = json.load(open(os.path.expanduser('~/newseed-nutrient-model/site/data/global.json')))
ct = D['costs']['total']
cr = [['Program costs (v1.4 cost grid totals, $)', None, None, None],
      ['v1.4 itemizes costs on its Inputs tab, rows 100-128; only the yearly totals are carried here. After 2050 the 2050 total is repeated.', None, None, None],
      [None] * 4,
      ['Year', 'v1.4 total cost', 'Cost counted', 'Discount factor']]
for j in range(35):
    r = 5 + j
    cr.append([2026 + j if j == 0 else f'=A{r - 1}+1', round(ct[j], 4) if j < 25 else '=$B$29',
               f'=IF(A{r}<=MAX(2050,Inputs!$G$63),(B{r}-IF(AND(NOT(Inputs!$G$64),A{r}>=2028),1000000,0))*Inputs!$G$44,0)', f'=1/(1+Inputs!$G$41)^(A{r}-2026)'])
cr += [[None] * 4, ['Extra 2027-29 (v1.4 B109)', D['costs']['extra_2027_29'], None, None], [None] * 4,
       ['Total program cost', '=SUM(C5:C39)+B41*Inputs!G44', None, None],
       ['Total program cost, discounted', '=SUMPRODUCT(C5:C39,D5:D39)+B41*Inputs!G44/(1+Inputs!G41)^1.5', None, None]]
json.dump({'range': 'Costs!A1', 'formulas': cr}, open(O + 'costs.json', 'w'))
hdr = ['Country', 'ISO3', 'Region', 'Regulatory tier', 'Population 2030 (M)', 'Population 0-4, 2030 (M)', 'Total kcal/capita/day', 'Maize kcal', 'Rice kcal', 'Wheat kcal',
       'Zinc inadequacy', 'Iron inadequacy', 'Stunting prevalence', 'GDP per capita ($)', 'Curt max CG %ha: maize', 'Curt max CG %ha: rice', 'Curt max CG %ha: wheat',
       'Curt %/yr: maize', 'Curt %/yr: rice', 'Curt %/yr: wheat', 'Domestic food share: maize', 'Domestic food share: rice', 'Domestic food share: wheat',
       'Already biofortified: maize zinc', 'maize iron', 'maize QPM', 'rice zinc', 'rice iron', 'rice QPM', 'wheat zinc', 'wheat iron', 'wheat QPM']
reg = [['Region lookups', None, None], ['Region', 'Fiber intake x0 (g/day)', 'Fiber-attributable DALYs per capita']] + [[k, v[0], v[1]] for k, v in D['fiber_regions'].items()]
json.dump({'hdr': {'range': 'Countries!A1', 'formulas': [['Countries: inputs (v1.4 Countries tab, plus v1.5 columns U:AF)'], ['Sources: see the Sources tab. Blank Curt cells use the generic ramp; blank biofortification cells use the floor.'], [None], hdr]},
           'reg': {'range': 'Countries!A82', 'formulas': reg}}, open(O + 'countries_hdr.json', 'w'))
ph = [['Population, UN WPP 2024 medium variant, ratio to 2030 (5-year anchors; the model interpolates linearly)'], [None], [None],
      ['Country'] + [f"'all ages {y}" for y in range(2030, 2061, 5)] + [f"'under-5 {y}" for y in range(2030, 2061, 5)]]
json.dump({'range': 'Population!A1', 'formulas': ph}, open(O + 'pop_hdr.json', 'w'))
for fn in sorted(os.listdir(O)):
    print(fn, os.path.getsize(O + fn))
