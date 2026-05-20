from fastapi import APIRouter, Query, HTTPException
import requests
from typing import Optional

router = APIRouter(prefix="/location", tags=["Location"])

# Nominatim requires a User-Agent. Using a descriptive one for our project.
HEADERS = {
    "User-Agent": "Dishcision-Bot/1.0 (Contact: pswpung@gmail.com)"
}

@router.get("/search")
def search_location(q: str = Query(...), limit: int = 5):
    """Proxy search requests to Nominatim."""
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": q,
        "format": "json",
        "countrycodes": "th",
        "limit": limit,
        "addressdetails": 1
    }
    try:
        response = requests.get(url, params=params, headers=HEADERS, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Location search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reverse")
def reverse_geocode(lat: float = Query(...), lng: float = Query(...)):
    """Proxy reverse geocoding requests to Nominatim."""
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "lat": lat,
        "lon": lng,
        "format": "json",
        "accept-language": "en"
    }
    try:
        response = requests.get(url, params=params, headers=HEADERS, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Reverse geocode failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
