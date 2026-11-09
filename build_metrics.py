"""Clean and aggregate the raw data into the summary tables the dashboard reads.

Outputs:
  summary CSVs          one CSV per dashboard table
  data.js                the same tables bundled for index.html (so it also opens from disk)

Headline KPIs compare the latest 3 months (Aug-Oct 2026) with the prior 3 months (May-Jul 2026).
Run from the repository root:  python build_metrics.py
"""
from pathlib import Path
import json
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent  # all files live in the repository root
RAW = ROOT
OUT = ROOT
CUR = ["2026-08", "2026-09", "2026-10"]
PRV = ["2026-05", "2026-06", "2026-07"]

# ---------- HR ----------
h=pd.read_csv(RAW / "hr_employees.csv",parse_dates=["hire_date","term_date"])
months=pd.date_range("2025-11-01","2026-10-01",freq="MS"); rows=[]
for m in months:
    e=m+pd.offsets.MonthEnd(0)
    act=h[(h.hire_date<=e)&(h.term_date.isna()|(h.term_date>e))]
    start=h[(h.hire_date<m)&(h.term_date.isna()|(h.term_date>=m))]
    hires=h[(h.hire_date>=m)&(h.hire_date<=e)]; terms=h[(h.term_date>=m)&(h.term_date<=e)]
    avg=(len(act)+len(start))/2
    rows.append(dict(month=m.strftime("%Y-%m"),headcount=len(act),hires=len(hires),separations=len(terms),
       voluntary=int((terms.term_type=="Voluntary").sum()),involuntary=int((terms.term_type=="Involuntary").sum()),
       turnover_pct=round(len(terms)/avg*100,2),avg_days_to_fill=round(hires.days_to_fill.mean(),1)))
hm=pd.DataFrame(rows); hm.to_csv(OUT / "hr_monthly.csv",index=False)
end=pd.Timestamp("2026-10-31"); act=h[h.term_date.isna()|(h.term_date>end)]
def win(ms):
    d=hm[hm.month.isin(ms)]; return d.separations.sum(), d.hires.sum(), (d.hires*d.avg_days_to_fill).sum()/d.hires.sum()
cs,ch,cf=win(CUR); ps,ph,pf=win(PRV)
avg_hc=hm.headcount.mean()
pd.DataFrame([dict(window="Aug–Oct 2026",compare="May–Jul 2026",headcount=len(act),headcount_chg=int(len(act)-hm.loc[hm.month=="2026-07","headcount"].iloc[0]),
  hires=int(ch),hires_chg_pct=round((ch/ph-1)*100,1),separations=int(cs),separations_chg_pct=round((cs/ps-1)*100,1),
  turnover_12m_pct=round(hm.separations.sum()/avg_hc*100,1),voluntary_share_pct=round(hm.voluntary.sum()/hm.separations.sum()*100,1),
  days_to_fill=round(cf,1),days_to_fill_chg=round(cf-pf,1),engagement=round(act.engagement.mean(),2))]).to_csv(OUT / "hr_kpis.csv",index=False)
yr=h[(h.term_date>="2025-11-01")&(h.term_date<=end)]
dept=act.groupby("department").agg(headcount=("employee_id","count"),avg_salary=("salary","mean"),engagement=("engagement","mean")).reset_index()
sep=yr.groupby("department").employee_id.count().rename("separations_12m")
dept=dept.merge(sep,left_on="department",right_index=True,how="left").fillna({"separations_12m":0})
dept["turnover_12m_pct"]=dept.separations_12m/dept.headcount*100
ttf=h[h.hire_date>="2025-11-01"].groupby("department").days_to_fill.mean().rename("avg_days_to_fill")
dept=dept.merge(ttf,left_on="department",right_index=True).sort_values("headcount",ascending=False)
dept.round({"avg_salary":-2,"engagement":2,"turnover_12m_pct":1,"avg_days_to_fill":1}).astype({"separations_12m":int,"avg_salary":int}).to_csv(OUT / "hr_departments.csv",index=False)
ten=((end-act.hire_date).dt.days/365.25)
b=pd.cut(ten,[-0.01,1,2,5,10,100],labels=["< 1 yr","1–2 yrs","2–5 yrs","5–10 yrs","10+ yrs"])
tb=b.value_counts().reindex(["< 1 yr","1–2 yrs","2–5 yrs","5–10 yrs","10+ yrs"]).reset_index(); tb.columns=["tenure_band","employees"]
tb["share_pct"]=(tb.employees/tb.employees.sum()*100).round(1); tb.to_csv(OUT / "hr_tenure.csv",index=False)


# Bundle tables for the dashboard page
DATASETS = {"kpis": "hr_kpis.csv", "monthly": "hr_monthly.csv", "departments": "hr_departments.csv", "tenure": "hr_tenure.csv"}
bundle = {k: (OUT / v).read_text() for k, v in DATASETS.items()}
(ROOT / "data.js").write_text("window.DASH_DATA = " + json.dumps(bundle, indent=1) + ";\n")
print("Processed tables written to", OUT)
