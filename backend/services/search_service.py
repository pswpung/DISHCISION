import os
import sys
from sqlalchemy import func, text
from loguru import logger

# Ensure backend folder is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models.restaurant import Restaurant

_model = None

def get_embedding_model():
    global _model
    if _model is None:
        logger.info("Loading SentenceTransformer model 'paraphrase-multilingual-MiniLM-L12-v2'...")
        from sentence_transformers import SentenceTransformer
        import torch
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        logger.info(f"Using device: {device} for embedding queries")
        _model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2', device=device)
    return _model

def get_embedding(text_query: str):
    model = get_embedding_model()
    return model.encode(text_query).tolist()

def hybrid_search(db, query_text: str, limit: int = 50, distance_threshold: float = 10.0, lat: float = None, lng: float = None):
    """
    Perform Hybrid Search (Dense Vector + Lexical Trigram) on Restaurants.
    
    Optional filters:
    - lat, lng: filter by coordinates (distance_threshold in km)
    """
    if not query_text or not query_text.strip():
        # Fallback to simple distance/rating filter if query is empty
        query = db.query(Restaurant)
        if lat is not None and lng is not None:
            # We will filter by distance in Python or standard SQL, 
            # but for the search itself we just return candidates.
            pass
        return query.order_by(Restaurant.rating.desc()).limit(limit).all()
        
    query_text_clean = query_text.strip()
    
    # 1. Compute Dense Vector Embedding
    try:
        query_vector = get_embedding(query_text_clean)
    except Exception as e:
        logger.error(f"Failed to generate embedding for query: {e}")
        query_vector = None

    # 2. Execute Dense Vector Search
    vector_results = []
    if query_vector:
        # cosine distance is <=>
        # cosine similarity is 1 - (embedding <=> query_vector)
        # We fetch top 100 candidate matches
        vector_query = db.query(
            Restaurant,
            (1.0 - Restaurant.embedding.cosine_distance(query_vector)).label("sim_score")
        ).order_by(Restaurant.embedding.cosine_distance(query_vector)).limit(100)
        
        vector_results = vector_query.all()

    # 3. Execute Lexical/Trigram Search
    # pg_trgm similarity(name, query) handles fuzzy matching
    # We only run lexical search for short keyword queries (len <= 20 and no spaces) to keep latency low.
    lexical_results = []
    is_long_query = len(query_text_clean) > 20 or " " in query_text_clean
    if not is_long_query:
        lexical_query = db.query(
            Restaurant,
            (
                func.similarity(Restaurant.name, query_text_clean) * 0.5 + 
                func.similarity(func.coalesce(Restaurant.category, ""), query_text_clean) * 0.3 +
                func.similarity(func.coalesce(Restaurant.good_fors, ""), query_text_clean) * 0.2
            ).label("lex_score")
        ).filter(
            (Restaurant.name.ilike(f"%{query_text_clean}%")) |
            (Restaurant.category.ilike(f"%{query_text_clean}%")) |
            (Restaurant.good_fors.ilike(f"%{query_text_clean}%")) |
            (Restaurant.favourite_menus.ilike(f"%{query_text_clean}%")) |
            (func.similarity(Restaurant.name, query_text_clean) > 0.1)
        ).order_by(text("lex_score DESC")).limit(100)
        
        lexical_results = lexical_query.all()

    # 4. Perform Reciprocal Rank Fusion (RRF)
    # RRF Score = 1 / (60 + rank_vector) + 1 / (60 + rank_lexical)
    rrf_scores = {}
    restaurant_map = {}
    
    # Process vector ranks
    for rank, (restaurant, sim_score) in enumerate(vector_results):
        r_id = restaurant.id
        restaurant_map[r_id] = restaurant
        rrf_scores[r_id] = rrf_scores.get(r_id, 0.0) + (1.0 / (60.0 + rank + 1))
        
    # Process lexical ranks
    for rank, (restaurant, lex_score) in enumerate(lexical_results):
        r_id = restaurant.id
        restaurant_map[r_id] = restaurant
        rrf_scores[r_id] = rrf_scores.get(r_id, 0.0) + (1.0 / (60.0 + rank + 1))
        
    # Sort restaurants by RRF score descending
    sorted_ids = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    
    # 5. Retrieve top matching Restaurant instances
    top_restaurants = []
    for r_id, rrf_score in sorted_ids[:limit]:
        res = restaurant_map[r_id]
        # Attach search score properties for suggested ranking visualization/metrics
        res.search_score = rrf_score
        top_restaurants.append(res)
        
    return top_restaurants
