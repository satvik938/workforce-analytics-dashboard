"""Generate the synthetic raw data for the Workforce / HR Analytics dashboard.

All records are randomly generated with a fixed seed so results are reproducible.
No real company, customer or employee data is used.

Run from the repository root:  python generate_data.py
"""
from pathlib import Path
import numpy as np
import pandas as pd

RAW = Path(__file__).resolve().parent  # CSVs are written next to this script
rng = np.random.default_rng(11)
months = pd.date_range("2025-11-01", "2026-10-01", freq="MS")

# ---------- 3. Workforce / HR ----------
depts={"Operations":180,"Warehouse":140,"Sales":45,"Customer Service":38,"Finance":22,"IT":18,"HR":10}
emp=[];eid=1000
start=pd.Timestamp("2025-11-01")
for d,n in depts.items():
    for _ in range(n):
        hire=start-pd.Timedelta(days=int(rng.exponential(1100)))
        emp.append(dict(employee_id=f"E{eid}",department=d,hire_date=hire,term_date=pd.NaT,
           term_type=None,salary=0,engagement=0)); eid+=1
attr={"Operations":0.022,"Warehouse":0.031,"Sales":0.018,"Customer Service":0.026,"Finance":0.008,"IT":0.012,"HR":0.01}
sal={"Operations":(58000,8000),"Warehouse":(41000,5000),"Sales":(72000,14000),"Customer Service":(44000,5000),"Finance":(78000,12000),"IT":(92000,15000),"HR":(66000,9000)}
for m_i,m in enumerate(months):
    end=m+pd.offsets.MonthEnd(0)
    for e in emp:
        if e["hire_date"]<=m and pd.isna(e["term_date"]):
            p=attr[e["department"]]*(0.85 if m_i>6 else 1.0)
            if rng.random()<p:
                e["term_date"]=m+pd.Timedelta(days=int(rng.integers(0,27)))
                e["term_type"]=rng.choice(["Voluntary","Involuntary"],p=[.78,.22])
    for d in depts:
        active=sum(1 for e in emp if e["department"]==d and e["hire_date"]<=end and (pd.isna(e["term_date"]) or e["term_date"]>end))
        need=int(depts[d]*(1+0.004*m_i))-active
        for _ in range(max(0,need+int(rng.integers(0,3)))):
            emp.append(dict(employee_id=f"E{eid}",department=d,hire_date=m+pd.Timedelta(days=int(rng.integers(0,27))),
               term_date=pd.NaT,term_type=None,salary=0,engagement=0)); eid+=1
for e in emp:
    mu,sd=sal[e["department"]]; e["salary"]=int(round(rng.normal(mu,sd),-2))
    e["engagement"]=round(float(np.clip(rng.normal(3.8 if e["department"] not in("Warehouse","Customer Service") else 3.4,0.6),1,5)),1)
    e["days_to_fill"]=int(np.clip(rng.normal(34 if e["department"] in("IT","Finance") else 21,7),5,90)) if e["hire_date"]>=start else None
hr=pd.DataFrame(emp); hr["hire_date"]=hr.hire_date.dt.date; hr["term_date"]=hr.term_date.dt.date
hr.to_csv(RAW / "hr_employees.csv",index=False)
print("Raw data written to", RAW)
