import pandas as pd
import numpy as np

datas = [
    {"user_id": "1", "preference": {"lat": 1.0, "lng": 2.0}},
    {"user_id": "2", "preference": {"lat": 3.0, "lng": 4.0}}
]

df = pd.DataFrame(datas)
try:
    expanded_cols = pd.json_normalize(df['preference'])
    print("Direct normalize success")
    print(expanded_cols)
except Exception as e:
    print(f"Direct normalize failed: {e}")

try:
    expanded_cols = pd.json_normalize(df['preference'].tolist())
    print("ToList normalize success")
    print(expanded_cols)
except Exception as e:
    print(f"ToList normalize failed: {e}")
