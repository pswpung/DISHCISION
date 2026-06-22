from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from utils.appointment_manager import Appointment_Manager
from datetime import datetime
from loguru import logger
import traceback
import pandas as pd
import numpy as np

router = APIRouter(
    prefix="/playground",
    tags=["Playground"]
)

class Preference(BaseModel):
    price: str
    category: List[str]
    avoid_categories: List[str] = []
    good_fors: List[str]
    parking: bool
    alcohols: bool
    priorities: List[Any]
    lat: float = 13.7563
    lng: float = 100.5018
    max_walk_distance: float = 1000.0
    preferred_restaurant: List[Dict] = []
    meal_time: str = "Any"

class Attendee(BaseModel):
    user_id: str
    is_key_person: bool
    preference: Preference

class RestaurantInput(BaseModel):
    name: str = "Test Restaurant"
    price: Optional[str] = "None"
    category: List[str] = []
    good_fors: List[str] = []
    parking: Optional[str] = "ไม่มีที่จอดรถ"
    alcohols: List[str] = []
    lat: float
    lng: float
    rating: Optional[float] = 0.0

class CalculationRequest(BaseModel):
    attendees: List[Attendee]
    restaurant: RestaurantInput
    center_location: Optional[Dict[str, float]] = None
    key_weight: Optional[float] = 0.7

@router.post("/calculate")
def calculate_playground_score(request: CalculationRequest):
    try:
        # 1. Initialize Appointment Manager
        attendee_ids = [a.user_id for a in request.attendees]
        attendee_datas = [a.dict() for a in request.attendees]
        
        # Ensure restaurant price is not None or "None"
        res_row = request.restaurant.dict()
        if not res_row.get('price') or res_row.get('price') == "None":
            # Default to the first available price from summary if possible, or fallback
            res_row['price'] = "101 - 250 บาท"
            logger.warning(f"RESTAURANT PRICE WAS NULL, FALLING BACK TO: {res_row['price']}")

        am = Appointment_Manager(
            key_person=[a.user_id for a in request.attendees if a.is_key_person],
            attendees=attendee_ids,
            start_date=datetime.now().strftime("%d/%m/%Y"),
            end_date=datetime.now().strftime("%d/%m/%Y"),
            meal_time="Lunch",
            key_weight=request.key_weight if request.key_weight is not None else 0.7
        )

        # 2. Convert attendees to dict format expected by am
        attendee_datas = [a.dict() for a in request.attendees]

        # 3. Calculate average weights for display
        avg_weights = {}
        for d in attendee_datas:
            pref = d.get('preference', {}) or {}
            priorities = pref.get('priorities', [])
            w = am._calculate_user_roc_weights(priorities)
            for k, val in w.items():
                avg_weights[k] = avg_weights.get(k, 0.0) + val
        if attendee_datas:
            for k in avg_weights:
                avg_weights[k] = round(avg_weights[k] / len(attendee_datas), 2)
        else:
            avg_weights = {f: 1.0/7.0 for f in ['Price', 'Category', 'Vibe', 'Station', 'Rating', 'Parking', 'Alcohol']}

        # 4. Filter Key and General Data
        key_persons_data = [d for d in attendee_datas if d.get('is_key_person', False)]
        general_persons_data = [d for d in attendee_datas if not d.get('is_key_person', False)]
        
        # 5. Prepare Restaurant Data
        res_row = request.restaurant.dict()
        
        # 6. Calculate Group Score
        final_score, combined_reason = am._calculate_weighted_score(
            res_row, 
            key_persons_data, 
            general_persons_data
        )
        print('-' * 50)
        print(res_row)
        print('-' * 50)

        # 7. Calculate Individual Scores for Detail
        individual_results = []
        for d in attendee_datas:
            pref = d.get('preference', {}) or {}
            priorities = pref.get('priorities', [])
            weights = am._calculate_user_roc_weights(priorities)
            p_score, p_reason = am.calculate_restaurant_score(pref, res_row, weights=weights)
            individual_results.append({
                "user_id": d["user_id"],
                "score": p_score,
                "breakdown": p_reason
            })

        key_summary = am._get_summary(key_persons_data, points_per_vote=10.0)
        general_summary = am._get_summary(general_persons_data, points_per_vote=5.0)

        return {
            "final_score": final_score,
            "dynamic_weights": avg_weights,
            "reason_breakdown": combined_reason,
            "individual_results": individual_results,
            "summaries": {
                "key": key_summary,
                "general": general_summary
            }
        }
    except Exception as e:
        error_msg = traceback.format_exc()
        logger.error(f"PLAYGROUND CALCULATION ERROR: {error_msg}")
        raise HTTPException(status_code=500, detail=str(e))
