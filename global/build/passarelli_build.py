"""Aggregate Passarelli et al. 2024 age-sex inadequacy rows to country x nutrient.
args: simple_csv national_csv out_csv"""
import sys, pandas as pd
sub_p, nat_p, out_p = sys.argv[1:4]
s = pd.read_csv(sub_p)
s = s[(s.gdd_type == "Reported") & (s.nutrient != "Vitamin D")]       # paper's scope
s = s.dropna(subset=["npeople", "ndeficient"])                         # drop groups lacking pop or estimate
k = ["iso3", "country", "nutrient"]
def agg(df):
    g = df.groupby(k)[["npeople", "ndeficient"]].sum()
    return g.ndeficient / g.npeople
wa = [f"{a}-{a+4} yrs" for a in range(15, 50, 5)]
out = pd.concat([agg(s).rename("prevalence_all"),
                 agg(s[s.age_range == "0-4 yrs"]).rename("prevalence_children"),
                 agg(s[(s.sex == "Females") & s.age_range.isin(wa)]).rename("prevalence_women_15_49")],
                axis=1).reset_index()
out.insert(4, "children_age_band", "0-4 yrs")
out["nutrient"] = out.nutrient.replace({"Vitamin A (RAE)": "Vitamin A"})
out = out.sort_values(k)
n = pd.read_csv(nat_p); n["nutrient"] = n.nutrient.replace({"Vitamin A (RAE)": "Vitamin A"})
m = out.merge(n[["iso3", "nutrient", "pdeficient"]], on=["iso3", "nutrient"], how="outer", indicator=True)
print(m._merge.value_counts().to_dict(), "max |diff| vs authors' national file:", (m.prevalence_all - m.pdeficient).abs().max())
out.to_csv(out_p, index=False, float_format="%.5f")
print(out.shape, "countries", out.iso3.nunique(), "nutrients", sorted(out.nutrient.unique()), "NA", out.isna().sum().to_dict())
print(out[out.iso3.isin(["IND", "ETH", "GTM", "NGA"]) & out.nutrient.isin(["Iron", "Zinc"])].round(3).to_string(index=False))
