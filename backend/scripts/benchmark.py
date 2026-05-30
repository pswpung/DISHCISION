#!/usr/bin/env python3
import os
import sys
import time
import ast
import numpy as np
import pandas as pd
import psutil

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.postgres_services import SessionLocal
from services.search_service import hybrid_search, get_embedding_model
from models.restaurant import Restaurant

# Let's define the mock attendee data for simulation
MOCK_ATTENDEE_DATAS = [
    {
        "user_id": "user_1",
        "is_key_person": True,
        "preference": {
            "price": "ต่ำกว่า 100 บาท",
            "category": ["อาหารจานเดียว", "สตรีทฟู้ด/รถเข็น"],
            "good_fors": ["จานด่วน", "ประหยัด!"],
            "parking": True,
            "alcohols": False,
            "lat": 13.720,
            "lng": 100.458,
            "priorities": [["Price", "Category"], ["Vibe"]],
            "free_text": "อยากกินโจ๊กราคาถูก แถวเพชรเกษม มีที่จอดรถ"
        }
    },
    {
        "user_id": "user_2",
        "is_key_person": False,
        "preference": {
            "price": "ต่ำกว่า 100 บาท",
            "category": ["อาหารจานเดียว"],
            "good_fors": ["ประหยัด!"],
            "parking": False,
            "alcohols": False,
            "lat": 13.722,
            "lng": 100.460,
            "priorities": [["Price"]],
            "free_text": "ข้าวราดแกงหรืออาหารจานเดียวราคาประหยัด"
        }
    }
]

def legacy_haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    return R * c

def run_legacy_benchmark(csv_path, iterations=10):
    print("\n--- Running Legacy Benchmarks (Pandas CSV) ---")
    start_mem = psutil.Process().memory_info().rss / 1024 / 1024
    
    latencies = []
    for i in range(iterations):
        t0 = time.time()
        
        # Load CSV (simulating loading for suggestion)
        restaurants_lists = pd.read_csv(csv_path)
        restaurants_lists = restaurants_lists.replace({np.nan: None})
        restaurants_lists = restaurants_lists.dropna(subset=['lat', 'lng'])
        
        # Calculate distance from center (using mean location)
        mean_lat = 13.721
        mean_lng = 100.459
        restaurants_lists['distance_km'] = restaurants_lists.apply(
            lambda row: legacy_haversine(mean_lat, mean_lng, row['lat'], row['lng']), 
            axis=1
        )
        
        # Filter <= 10km
        nearby = restaurants_lists[restaurants_lists['distance_km'] <= 10.0].copy()
        
        # Sort and select top (simple simulation of legacy scoring overhead)
        nearby = nearby.sort_values(by="rating", ascending=False)
        top_5 = nearby.head(5).to_dict(orient="records")
        
        t1 = time.time()
        latencies.append((t1 - t0) * 1000) # ms
        
    end_mem = psutil.Process().memory_info().rss / 1024 / 1024
    mem_used = end_mem - start_mem
    
    print(f"Legacy Memory Spiked: {mem_used:.2f} MB")
    print(f"Legacy Latency: Mean = {np.mean(latencies):.2f}ms, Min = {np.min(latencies):.2f}ms, Max = {np.max(latencies):.2f}ms")
    return np.mean(latencies), mem_used

def run_db_benchmark(iterations=10):
    print("\n--- Running Database Benchmarks (PostgreSQL + pgvector) ---")
    
    # Pre-load embedding model to separate loading time from search latency
    get_embedding_model()
    
    start_mem = psutil.Process().memory_info().rss / 1024 / 1024
    db = SessionLocal()
    
    latencies = []
    for i in range(iterations):
        t0 = time.time()
        
        # Simulate query from free_text preference
        query_text = "อยากกินโจ๊กราคาถูก แถวเพชรเกษม มีที่จอดรถ"
        
        # Run hybrid search
        results = hybrid_search(db, query_text, limit=5)
        
        t1 = time.time()
        latencies.append((t1 - t0) * 1000) # ms
        
    end_mem = psutil.Process().memory_info().rss / 1024 / 1024
    mem_used = end_mem - start_mem
    db.close()
    
    print(f"Database Memory Spiked: {mem_used:.2f} MB")
    print(f"Database Latency: Mean = {np.mean(latencies):.2f}ms, Min = {np.min(latencies):.2f}ms, Max = {np.max(latencies):.2f}ms")
    return np.mean(latencies), mem_used

def main():
    csv_path = "./statics/restaurants_lists.csv"
    if not os.path.exists(csv_path):
        csv_path = "../statics/restaurants_lists.csv"
        if not os.path.exists(csv_path):
            print("CSV file not found. Please verify paths.")
            sys.exit(1)
            
    print("Pre-warming up embedding model...")
    get_embedding_model()
    
    legacy_latency, legacy_mem = run_legacy_benchmark(csv_path, iterations=10)
    db_latency, db_mem = run_db_benchmark(iterations=10)
    
    print("\n--- Benchmark Summary ---")
    print(f"Legacy Latency: {legacy_latency:.2f} ms")
    print(f"Database Latency: {db_latency:.2f} ms")
    print(f"Latency Reduction: {(legacy_latency - db_latency):.2f} ms ({((legacy_latency - db_latency) / legacy_latency * 100):.1f}% speedup)")
    
    print(f"Legacy Memory Overhead: {legacy_mem:.2f} MB")
    print(f"Database Memory Overhead: {db_mem:.2f} MB")

if __name__ == "__main__":
    main()
