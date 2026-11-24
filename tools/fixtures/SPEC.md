# Gene_editing_mainstreaming_BOTEC v1.4: formula spec

Source: Google Sheet `1TB-mJFlZdXrVdn3Zq_1Dz8ykDCKJ0ANyGjsbLfNqDDg`, pulled 2026-11-23, active scenario = **Median**.
`Inputs` below means the tab `Inputs and Summary`. All cell values and formulas are in `<Tab>.json` in this folder.
`reference_impl.py` is a Python reimplementation of this spec, built only from the JSON inputs.
- It reproduces Inputs rows 80–83 (and Katie rows 179–181) to a relative error of 1e-10.
- With `USE_SHEET_W=True` the error drops to 6e-16. All remaining error comes from NORMSINV/NORMDIST (see Quirks §Q1).

## 0. Index conventions

- **Countries**: 75 countries. `i = 0..74`; `Countries` row = `4+i`. Every per-country block on every tab lists the same countries in the same order (checked by name), so row matching is **purely positional**:

| Tab / block | first row (i=0) | year cols |
|---|---|---|
| Countries | 4 | – |
| Variety Replacement maize / rice / wheat | 5 / 85 / 165 | D..X |
| Zinc, Iron maize / rice / wheat | 5 / 91 / 177 | D..X |
| Protein wasting maize / rice / wheat | 6 / 169 / 332 | D..X |
| Protein stunting maize / rice / wheat | 82 / 245 / 408 | D..X |
| Fiber (wheat only) | 4 | D..X |
| Combined Benefits | 5 | D..X |
| Cross-crop cap | 5 | **B..V** |
| Katie Stunting per-country table | 30 | – |
| People Reached blocks 1–5 | 7 / 86 / 165 / 244 / 323 | D..X |

- **Years**: `y = 2030..2050`, `k = y − 2030`. Year columns are D..X (col D = 2030) on the nutrient tabs and B..V (col B = 2030) on Inputs and Cross-crop cap.
  - The ramp formulas hard-code the year as a literal (e.g. `2030<$C5`).
  - The secular-trend exponent uses `COLUMN()-4`, which equals k only because the year block starts in column D.
- **Crops**: c ∈ {maize, rice, wheat}.
  - Calorie share `share_c[i]` = `Countries!W` / `Y` / `AC` = `V/U`, `X/U`, `AB/U`.
  - These are FAO kcal-per-capita ratios, already computed in the sheet.

## 1. Scenario selection (Inputs)

- `Inputs!B3` ∈ {Pessimistic, Median, Optimistic, Custom}.
- Each lever row has values in B (Pess), C (Med), D (Opt) and E (Custom), and the active value in F:
  `F{r} = IF(B3="Custom", IF(E{r}="",NA(),E{r}), INDEX(B{r}:E{r}, MATCH(B3, B$5:E$5, 0)))`
  - Header row 5 is used for every lever row except rows 17–21, which use header row 16.
- Rows that have an F (Active) formula: 6,7,8,9, 12,13,14, 17–21, 24,25,26, 34, 40–43, 62,63,65,66.
- Rows 12–14 use B..D = boost × constant. F picks from B..D, but **Custom uses E6/E7/E8 × 0.5/0.25/0.5 with no ×0.6** (Quirk Q3).

| Lever | cell (active) | Pess / Med / Opt | meaning |
|---|---|---|---|
| Zinc boost | F6 | 0.1 / 0.4 / 0.8 | fractional nutrient increase |
| Iron boost | F7 | 0.125 / 0.3 / 0.7 | |
| Protein-quality boost | F8 | 0.2 / 0.4 / 0.8 | |
| Fiber boost | F9 | 0.1 / 0.25 / 0.6 | **unused downstream** |
| Zinc effectiveness `effZn` | F12 | B6·0.5·0.6 → 0.03 / **0.12** / 0.24 | |
| Iron effectiveness `effFe` | F13 | B7·0.25·0.6 → 0.01875 / **0.045** / 0.105 | |
| Protein effectiveness `effP` | F14 | B8·0.5·0.6 → 0.06 / **0.12** / 0.24 | |
| Approval year per tier | F17..F21 | see §2 | |
| Ceiling `CEIL` | F24 | 0.25 / **0.5** / 0.7 | max GE share of crop area |
| Ramp years `YRS` | F25 | 30 / **20** / 15 | |
| Speed `SPD` | F26 | 0.6 / **1** / 1.5 | slope multiplier |
| Stunting growth effect `G` | F34 | 0.06 / **0.09** / 0.15 | Gunaratna |
| Adoption skew `SKEW` | F40 | 0.7 / **0.85** / 1 | |
| Col-Z multiplier `ZM` | F41 | 2 / 2 / 2 | |
| Secular decline, stunting/wasting/U5 mortality `rS` | F42 | 0.03 / **0.02** / 0.01 | |
| Secular decline, zinc/iron inadequacy `rM` | F43 | 0.02 / **0.01** / 0 | |
| Fiber Δ (g/day) | F62 | 1 / **2** / 3 | |
| Fiber RR per +7 g | F63 | 0.94 / **0.91** / 0.88 | |
| AX multiplier | F65 | 0.3 / **0.6** / 1 | |
| Fiber-adequate share | F66 | 0.8 / 0.5 / 0.2 | **F66 is unused; B66 = 0.8 is used** (Q2) |

Scalar inputs (no scenario):

| Input | cell | value |
|---|---|---|
| zinc DALY/case `B28` | B28 | `= 0.02 * B48` |
| iron DALY/case `B29` | B29 | `= 0.025/3` |
| protein DALY/case, age > 5 | B30 | 0.01 |
| DALYs per stunting case | B31 | 2.8 |
| baseline coverage `BASE` | B32 | 0.15 (gap = 1 − B32 = 0.85) |
| discount rate | B33 | 0.043 |
| attribution `ATT` | B36 | 0.3 |
| stunting incidence conversion | B37 | 0.2 |
| stunting method | B44 | text `"HAZ shift"` (anything else = Growth rate) |
| zinc retention, maize / rice / wheat | B46 / C46 / D46 | 0.9 / 0.75 / 0.7 |
| iron retention, maize / rice / wheat | B47 / C47 / D47 | 0.85 / 0.4 / 0.6 |
| fiber TMREL | B64 | 23.5 |
| value per DALY (× GDP per capita) | B53 | 2.3 |

- **Zinc recalibration**: `B48 = MIN(1, 1.5e9 / SUMPRODUCT(Countries!C4:C78*1e6, Countries!AV4:AV78))` = 0.45911793473647994. Therefore `B28 = 0.009182358694729598`.
- B48 depends only on the input columns C and AV. It does not depend on the scenario.

## 2. Approval year (Countries)

- `E` = tier text, one of Already approved / Fast follower / Mid adopter / Late adopter / Late to never.
- `F,G,H,I` = `VLOOKUP(E, Inputs!A17:E21, 2..5, FALSE)` (Pess, Med, Opt, Custom).
- `J = MAX(2030, IF(B3="Pessimistic",F, IF(B3="Median",G, IF(B3="Optimistic",H, I))))`. Note that J reads the B..E tier table directly, **not Inputs F17:F21**.
- Tier years (Pess / Med / Opt):

| Tier | Pess | Med | Opt |
|---|---|---|---|
| Already approved | 2034 | 2032 | 2030 |
| Fast follower | 2038 | 2034 | 2030 |
| Mid adopter | 2044 | 2038 | 2032 |
| Late adopter | 2056 | 2046 | 2036 |
| Late to never | 2200 | 2100 | 2051 |

- Median tier counts: 16 / 12 / 13 / 17 / 17.
- `K` (Already approved?) is deprecated and unused.

## 3. Variety replacement `VR_c[i,y]` (Variety Replacement tab)

- Row = block start + i. `C = Countries!J{4+i}` (approval year `A_i`).
- `Z` = Curt's "max CG-derived %ha", in percent. `AA` = Curt's annual %/yr. In every covered row, AA = Z/10.
- Covered rows: maize 28, rice 30, wheat 32. Uncovered rows have Z blank. The full list is in `variety_replacement_curt.csv`.

```
n = y − A_i + 1
if y < A_i:                VR = 0
elif Z blank (uncovered):  VR = SKEW * MIN(CEIL, (CEIL/YRS)*SPD*n)
else (covered):            VR = SKEW * MIN(CEIL, ZM*Z/100, (AA/100)*SPD*n)
```

- The maize and wheat blocks are written as `(...)*F40` and the rice block as `F40*(...)`. They are algebraically identical.
- `Y = MAX(D:X)` is display only.
- At Median: the uncovered slope is 0.025/yr up to 0.5, then × 0.85. The first nonzero year is `A_i` itself (n = 1).

## 4. Zinc / Iron (tabs Zinc, Iron)

Each cell is DALYs averted in year y, per country and crop. Units are DALYs, before attribution.

```
Zn_c[i,y] = (1−rM)^k * C_i*1e6 * share_c[i] * AV_i * B28 * effZn * retZn_c * VR_c[i,y] * (1−BASE)
Fe_c[i,y] = (1−rM)^k * C_i*1e6 * share_c[i] * S_i  * B29 * effFe * retFe_c * VR_c[i,y] * (1−BASE)
```

- `C_i` = `Countries!C` (2030 population in millions, held fixed for all years).
- `AV` = zinc-inadequacy prevalence. Its header says "Country-specific details…", but it is the zinc prevalence.
- `S` = iron intake-inadequacy prevalence (Passarelli).
- Tab col C = `Countries!C`.
- Total rows: Zinc/Iron rows 81 (maize), 167 (rice), 253 (wheat), each `= SUM` of its block.
- Rows 82–88, 168–174 and 254–260 are regional `SUMIF` subtotals (display only).
- Col Y holds the 2030–50 row sum.

## 5. Protein (tab Protein)

**Wasting / short-term**: whole population, all ages.

```
PW_c[i,y] = (1−rS)^k * C_i*1e6 * share_c[i] * T_i * B30 * effP * VR_c[i,y] * (1−BASE)
```

**Stunting**: under-5 only. Tab col C = `Countries!D` (population aged 0–4, in millions).

```
PS_c[i,y] = (1−rS)^k * D_i*1e6 * share_c[i] * T_i * B37 * B31 * STU_i * VR_c[i,y] * (1−BASE)
STU_i = IF(Inputs!B44="HAZ shift", 'Katie Stunting'!W{30+i}, F34)
```

- The W value is looked up as `INDEX(W30:W104, ROW()−81/−244/−407)`, i.e. positional.
- `T` = stunting prevalence, used as a proxy for protein inadequacy.
- **Retention is not applied to protein.** Maize uses F14 like the other crops (the v1.4 fix). `Countries!AW` (QPM gap) is now unused.
- Crop totals: rows 158 / 321 / 484 = `SUM(wasting block) + SUM(stunting block)`.

## 6. Katie Stunting tab

### Global parameters

| Parameter | cell | formula / value |
|---|---|---|
| growth effect | B5 | `=Inputs!F34` |
| baseline growth (cm/mo) | B6 | 0.82 |
| months of exposure | B7 | 12 |
| WHO reference SD (cm) | B8 | 2.8 |
| population HAZ SD `σ` | B9 | 1.2 |
| RR mild / moderate / severe | B10 / B11 / B12 | 1.46 / 2.28 / 5.48 |
| average age at death | B13 | 2 |
| U5MR window share | B14 | 1 |
| total extra height gain (cm) | B15 | `=B6*B5*B7` |
| ΔHAZ | B16 | `=B15/B8` (0.3162857142857143 at Median) |

- Regional U5MR per 1000 and life expectancy are in A20:C26.

### Per-country columns (row 30+i)

- `C = T_i`
- `D = VLOOKUP(region, A20:C26, 2)*B14`
- `E` = life expectancy (`VLOOKUP` col 3)
- `F = IFERROR(−2 − σ·NORMSINV(C), 0)` (baseline mean HAZ)
- `G = B16`
- `H = F + G`
- Bins at mean m, with σ: non-stunted `1−Φ(−1)`, mild `Φ(−1)−Φ(−2)`, moderate `Φ(−2)−Φ(−3)`, severe `Φ(−3)`, where `Φ(x) = NORMDIST(x, m, σ, TRUE)`.
  - I..L use m = F (baseline). N..Q use m = H (with biofortification). Each is wrapped in `IFERROR(...,0)`.
- `M` / `R` = Σ bin × RR, with RR = (1, B10, B11, B12) (average RR, baseline / biofortified).
- `S = IF(M=0, 0, 1−R/M)`
- `T = (D/1000)*S`
- `U = E − B13`
- `V = T*U` (mortality DALYs per protected child)
- **`W` (one ARRAYFORMULA in W30)**: `IF(K+L=0, 0, 1 − (P+Q)/(K+L))`. This is the relative fall in HAZ < −2 prevalence. It feeds Protein stunting under "HAZ shift".
- `AA/AB/AC = Countries!D*1e6 * share_{maize/rice/wheat} * B37 * (1−BASE) * V`
- Rows 106 / 107 / 108 (maize / rice / wheat), cols D..X:
  `(1−rS)^k * SUMPRODUCT(AA30:AA104, VR_maize[:,y])` (and AB / AC with the rice / wheat VR).
- These feed only the Katie-style summary (Inputs rows 179–188 and 203–208), **not the headline** rows 80–83.

## 7. Fiber → CVD (Countries AK..AU, Fiber tab; wheat only)

### Per country (Countries columns)

| Col | formula |
|---|---|
| AL `x0` | `VLOOKUP(region, Inputs!A69:C75, 2)` (regional intake, g/day) |
| AM `rate` | `VLOOKUP(region, Inputs!A69:C75, 3)` (fiber-attributable DALY rate per capita) |
| AN | `F62 * AC_i` (Δ g/day scaled by the wheat calorie share) |
| AO `x1` | `MIN(B64, AL + AN)` |
| AP `RR0` | `F63^((AL − B64)/7)` |
| AR `RR1` | `F63^((AO − B64)/7)` |
| AQ `PAF0` | `(AP−1)/AP` |
| AS `PAF1` | `(AR−1)/AR` |
| AT | `IF(AQ<=0, 0, (AQ−AS)/AQ)` |
| AU | `AM * AT * F65` |

- `AK` duplicates AL despite its "CVD DALY rate" label. It is unused.

### Fiber tab cell

```
Fib[i,y] = C_i*1e6 * AU_i * VR_wheat[i,y] * (1 − Inputs!B66)
```

- There is no secular factor, no attribution inside the cell, and no `(1−B32)` factor.
- Total row: row 80.

## 8. Cross-crop cap (tab Cross-crop cap; cols B..V = 2030..2050, row 5+i)

For each nutrient N ∈ {Zn: effZn, Fe: effFe, PW: effP}:

```
g_N = eff_N * (W_i*VR_m + Y_i*VR_r + AC_i*VR_w)        // combined gap-closure
overlap_N = (N_m + N_r + N_w) * (1 − IF(g_N=0, 1, MIN(1,g_N)/g_N))
cell = overlap_Zn + overlap_Fe + overlap_PW
```

- Row 81 = column sum.
- The cap is **all zeros in all three preset scenarios** (g never exceeds 1). It excludes retention, and excludes stunting and fiber.

## 9. Headline: Inputs "DALYs averted per year — Undiscounted"

Cols B..V are 2030..2050. Col W = `SUM(B:V)`.

```
row80 Maize = (Zinc!D81  + Iron!D81  + Protein!D158) * B36
row81 Rice  = (Zinc!D167 + Iron!D167 + Protein!D321) * B36
row82 Wheat = (Zinc!D253 + Iron!D253 + Protein!D484 + Fiber!D80) * B36
row83 Total = SUM(rows 80:82) − 'Cross-crop cap'!B81 * B36
```

- Results (Median): W80 = 885391.5033825694, W81 = 2775785.9459934775, W82 = 3348022.4584350428, **W83 = 7009199.90781109**.
- The Combined Benefits tab equals Σ(Zn+Fe+PW+PS)+Fib per country. Its pre-attribution column sum equals (row 83)/0.3 when the cap is 0. It is not referenced by the headline.

## 10. Downstream rows (Inputs)

### Discounting and value

- Value per DALY:
  - `B54/B55/B56 = SUMPRODUCT(Countries!AX, Countries!BA|BB|BC)/SUM(BA|BB|BC)`. This is the DALY-weighted GDP per capita.
  - `BA/BB/BC` = lifetime per-country sums over D..X of the Zn + Fe + PW + PS rows (plus Fiber for wheat), before attribution and cap.
  - `B57..B59 = B53 * B54..B56`
  - `B60 = (W87+W88+W89)/(W80+W81+W82)`
- Undiscounted value: rows 87–89 = rows 80–82 × B57 / B58 / B59. Row 90 = SUM. The cap is not subtracted from value.
- Discount factor: `B94 = 1/((1+B33)^(4 + B79 − $B$79))` = `1/1.043^(y−2026)`.
- Discounted DALYs: rows 95–97 = rows 80–82 × B94, and row 98 = row 83 × B94.
- Discounted value: row 102 = row 94. Rows 103–106 = rows 87–90 × row 102.

### Program costs (row 118 = years 2026..2050 in cols B..Z, AA = total)

| Row | Item | Formula |
|---|---|---|
| 119 | Payroll | `IF(y<=2032, B110*(1+B112)^(y−2026)*(1+B111), 0)`, with B110 = 140000, B112 = 0.05, B111 = 0.286 |
| 120–122 | Breeding partners | `IF(y<=2032, B113, 0)`, with B113 = 400000 (3 partners) |
| 123 | Advocacy | `IF(AND(y>=2028, y<=2050), B114, 0)`, with B114 = 1e6. The year is a **literal** in each cell. |
| 125–127 | Finance/Admin/HR, Fundraising, M&E | **Hard-coded** for 2030–2036 (cols F..L); `= $L*(1+B116)^(y−2036)` for 2037+; blank for 2026–29 |
| 124 | Remainder of org budget | `= SUM(125:127)` |
| 128 | Total | `= SUM(119:124)` |
| 129 | Discounted | `B128/(1+B33)^(y−2026)` |

- `AA128 = SUM(B128:Z128) + B109` (B109 = 1,200,000, "2027–2029", Q6) = 42849348.21560372.
- `AA129 = SUM(B129:Z129) + B109/(1.043^1.5)` = 28326257.49994266.

### Cost-effectiveness

| Cell | Formula | Value |
|---|---|---|
| B136 ($/DALY, undiscounted) | `AA128/W83` | 6.113300915822385 |
| B137 ($/DALY, discounted) | `AA129/W98` | 8.357200750988744 |

- Row 135 = cumulative $/DALY. Rows 132–133 = per-year and cumulative DALYs.
- GiveWell block (rows 143–163):
  - row 149 = 2.3 × row 83 (2.3 is hard-coded, not B145)
  - row 150 = cumulative units / cumulative cost from 2026
  - row 151 = /0.003 and row 152 = /6 (both hard-coded)
  - C155/C156 use the 1.4% / 4% rates
- Rows 165–171: ROI. Rows 179–188 and 203–208: Katie-style alternative. Each crop = (Zn + Fe + **wasting only** + Katie row 106/107/108 [+ Fiber for wheat]) × B36. The total row subtracts the cap.

## 11. People Reached (not in the DALY chain)

- Block 1 (rows 7–81): `C*1e6*(1−B32)*Σ_c share_c*VR_c` (eaters reached).
- Blocks 2–4: the same, × AV, × S and × T respectively.
- Block 5 (rows 323–397): `C*1e6*AC*VR_w*(1−B66)`. Its label says "B54", but the formula uses B66.
- Rows 82, 161, … are the sums.

## 12. Quirks and ambiguities

- **Q1 NORMSINV/NORMDIST.** Katie F, I..Q and W depend on the normal inverse CDF and normal CDF, so an exact bit match is impossible. With a good JS implementation (Acklam + Newton refinement, or AS241, plus an erf-based CDF accurate to ~1e-15), W matches to about 2e-10 and the headline to about 1e-10 relative. To match the sheet exactly, load `Katie Stunting!W30:W104` from `Katie_Stunting.json`.
- **Q2 Fiber coverage gap uses `Inputs!B66` (the Pessimistic column, 0.8), not the active `F66`.** The fiber gap is therefore 0.2 in every scenario. People Reached block 5 has the same issue. This is probably a bug, but it is required to reproduce the sheet.
- **Q3 Custom effectiveness.** F12/F13/F14 under "Custom" compute `E6*0.5`, `E7*0.25`, `E8*0.5` and drop the ×0.6 lab→field discount that B..D include. F12–F14 are wrapped in `ARRAY_CONSTRAIN(ARRAYFORMULA(...),1,1)`, which has no effect. Custom with a blank E → `#N/A` propagates everywhere.
- **Q4 Approval year ignores Inputs F17:F21.** It re-selects from Countries F..I by scenario name, with a floor of 2030. "Late to never" (2200/2100/2051) gives 0 within 2030–2050 in every preset, because even 2051 is after 2050.
- **Q5 Hard-coded constants.**
  - 0.5·0.6, 0.25·0.6 and 0.5·0.6 in rows 12–14
  - 0.02 in B28; 0.025/3 in B29; 1.5e9 in B48
  - 2.3 in row 149; 0.003 and 6 in rows 151–152
  - literal years in VR ramp formulas and row 123
  - `+4` in the discount exponent
  - `COLUMN()−4` for k
  - Rows 125–127 values for 2030–36 are typed numbers, not formulas.
- **Q6 Possible double-count of pre-2030 costs.** B109 ($1.2M, "2027–2029") is added on top of a grid that already starts in 2026. The narrative in G113 says partners are "held flat through 2050", but the formula stops at 2032. Payroll also stops at 2032.
- **Q7 Unused or mislabeled inputs.**
  - Unused: F9 (fiber boost); F17:F21 (see Q4); F66 (see Q2); Countries K, AG, AI (IFERROR CAGRs), AK (labeled CVD rate but returns intake), AJ/AZ (empty), AW (QPM gap; 12 blanks, unused since v1.4); VR col Y.
  - The Inputs label says iron prevalence is `Countries!AN`, but the formulas use `Countries!S` (AN is fiber Δ).
- **Q8 Population.** Population is fixed at 2030 values. Secular decline multiplies by `(1−r)^k` uniformly (no country variation). Fiber has no secular factor and no (1−B32) factor.
- **Q9 Stunting-method switch** is a text compare `B44="HAZ shift"`. Any other text (including a typo) silently selects the Growth-rate path (F34).
- **Q10 Cross-crop cap** uses unretained effectiveness and is 0 in all presets. It is the only place a nonlinear MIN acts across crops. Implement it anyway for Optimistic/Custom fidelity.
- **Q11 No circularities found.** BA..BC (Countries) read the nutrient tabs, and B54–B56 read BA..BC, but nothing upstream reads them back.
- **Q12 IFERRORs.** Countries AG/AI (unused) and Katie F, I–Q (→ 0) are wrapped in IFERROR. With current data no T is 0 or blank, so they never fire. If T = 0, F becomes 0 (mean HAZ 0), not "no stunting".
