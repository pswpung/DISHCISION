#!/usr/bin/env python3
import os
import sys
import ast
import numpy as np
import pandas as pd
from sqlalchemy import text

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.postgres_services import SessionLocal, engine
from models.restaurant import Restaurant

def construct_restaurant_text(row):
    name = row.get('name') or ''
    categories = row.get('category') or '[]'
    vibes = row.get('good_fors') or '[]'
    favourite_menus = row.get('favourite_menus') or '[]'
    price = row.get('price') or ''
    
    # Clean list strings
    try:
        categories_list = ast.literal_eval(categories) if isinstance(categories, str) and categories.startswith('[') else categories
        categories_str = ", ".join(categories_list) if isinstance(categories_list, list) else str(categories_list)
    except Exception:
        categories_str = str(categories)
        
    try:
        vibes_list = ast.literal_eval(vibes) if isinstance(vibes, str) and vibes.startswith('[') else vibes
        vibes_str = ", ".join(vibes_list) if isinstance(vibes_list, list) else str(vibes_list)
    except Exception:
        vibes_str = str(vibes)
        
    try:
        menus_list = ast.literal_eval(favourite_menus) if isinstance(favourite_menus, str) and favourite_menus.startswith('[') else favourite_menus
        if isinstance(menus_list, list):
            cleaned_menus = []
            for m in menus_list:
                parts = m.split(';')
                cleaned_menus.append(parts[0].strip())
            menus_str = ", ".join(cleaned_menus)
        else:
            menus_str = str(menus_list)
    except Exception:
        menus_str = str(favourite_menus)
        
    # Include subjective price expansions
    price_synonyms = ""
    if price:
        price_str = str(price)
        if "ต่ำกว่า 100" in price_str or "101 - 250" in price_str:
            price_synonyms = "ราคาประหยัด, ราคาถูก, ราคาเบาๆ, cheap, budget, fair price"
        elif "251 - 500" in price_str or "501 - 1,000" in price_str:
            price_synonyms = "ราคาเหมาะสม, ราคาปานกลาง, fair price, moderate price"
        elif "มากกว่า 1,000" in price_str:
            price_synonyms = "แพง, หรูหรา, พรีเมียม, expensive, premium, fine dining"
        
    return f"ชื่อร้าน: {name} | ประเภทอาหาร: {categories_str} | บรรยากาศ/เหมาะสำหรับ: {vibes_str} | เมนูแนะนำ: {menus_str} | ราคา: {price} ({price_synonyms})"

def main():
    csv_path = "./statics/restaurants_lists.csv"
    if not os.path.exists(csv_path):
        csv_path = "../statics/restaurants_lists.csv"
        if not os.path.exists(csv_path):
            csv_path = "/Users/pasawee.p/Second Brain/1. Projects/Restaurant Suggestion/dishcision-line-bot/backend/statics/restaurants_lists.csv"
            
    print(f"Loading CSV data from {csv_path}...")
    df = pd.read_csv(csv_path)
    df = df.replace({np.nan: None})
    df['price'] = df['price'].apply(lambda x: str(x).strip() if x else None)
    df = df.dropna(subset=['lat', 'lng'])
    df = df.drop_duplicates(subset=['id'])
    
    print(f"Total valid unique restaurants to load: {len(df)}")
    
    print("Enabling pgvector extension on database...")
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()
        
    # Recreate tables to ensure table structure is up to date
    from services.postgres_services import Base
    print("Recreating database tables if they do not exist...")
    Base.metadata.create_all(bind=engine)
    
    # Initialize sentence-transformers model
    print("Loading SentenceTransformer model 'paraphrase-multilingual-MiniLM-L12-v2'...")
    from sentence_transformers import SentenceTransformer
    import torch
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"Using device: {device}")
    model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2', device=device)
    
    print("Generating text descriptors for embeddings...")
    texts = df.apply(construct_restaurant_text, axis=1).tolist()
    
    print("Generating embeddings (this may take 1-2 minutes)...")
    embeddings = model.encode(texts, batch_size=128, show_progress_bar=True)
    
    session = SessionLocal()
    try:
        print("Clearing old records from 'restaurants' table...")
        session.query(Restaurant).delete()
        session.commit()
        
        print("Bulk inserting new records into 'restaurants' table...")
        restaurants = []
        for count, (idx, row) in enumerate(df.iterrows()):
            res_id = int(row['id'])
            
            # Normalize categories/lists to string representation for model compatibility
            category_val = row['category']
            if isinstance(category_val, list):
                category_val = str(category_val)
                
            res = Restaurant(
                id=res_id,
                name=str(row['name']),
                wongnai_link=str(row['wongnai_link']) if row['wongnai_link'] else None,
                lat=float(row['lat']),
                lng=float(row['lng']),
                price=str(row['price']) if row['price'] else None,
                category=str(category_val) if category_val else None,
                rating=float(row['rating']) if row['rating'] is not None else None,
                address=str(row['address']) if row['address'] else None,
                phone_number=str(row['phone_number']) if row['phone_number'] else None,
                line=str(row['line']) if row['line'] else None,
                instagram=str(row['instagram']) if row['instagram'] else None,
                top_favorites=str(row['top_favorites']) if row['top_favorites'] else None,
                opening_hours=str(row['opening_hours']) if row['opening_hours'] else None,
                parking=str(row['parking']) if row['parking'] else None,
                alcohols=str(row['alcohols']) if row['alcohols'] else None,
                breadcrumbs=str(row['breadcrumbs']) if row['breadcrumbs'] else None,
                good_fors=str(row['good_fors']) if row['good_fors'] else None,
                favourite_menus=str(row['favourite_menus']) if row['favourite_menus'] else None,
                is_pet_friendly=str(row['is_pet_friendly']) if row['is_pet_friendly'] else None,
                embedding=embeddings[count].tolist()
            )
            restaurants.append(res)
            
            # Flush periodically to manage memory
            if len(restaurants) >= 500:
                session.add_all(restaurants)
                session.commit()
                restaurants = []
                
        if restaurants:
            session.add_all(restaurants)
            session.commit()
            
        print("Database import completed successfully!")
        
        # Create an HNSW index manually for pgvector fast ANN search
        print("Creating index for fast vector searches...")
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS restaurant_embedding_hnsw_idx ON restaurants USING hnsw (embedding vector_cosine_ops);"))
            # FTS indexes
            conn.execute(text("CREATE INDEX IF NOT EXISTS restaurant_name_trgm_idx ON restaurants USING gin (name gin_trgm_ops);"))
            conn.commit()
        print("Index creation completed successfully!")
            
    except Exception as e:
        session.rollback()
        print(f"Error during database import: {e}")
        sys.exit(1)
    finally:
        session.close()

if __name__ == "__main__":
    main()
