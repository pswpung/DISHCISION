from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
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
    good_fors: List[str]
    parking: bool
    alcohols: bool
    priorities: List[str]
    lat: float = 13.7563
    lng: float = 100.5018
    preferred_restaurant: List[Dict] = []

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
            meal_time="Lunch"
        )

        # 2. Convert attendees to dict format expected by am
        attendee_datas = [a.dict() for a in request.attendees]

        # 3. Calculate Dynamic Weights
        dynamic_weights = am._calculate_dynamic_weights(attendee_datas)

        # 4. Summarize Preferences for Key and General
        key_persons_data = [d for d in attendee_datas if d.get('is_key_person', False)]
        general_persons_data = [d for d in attendee_datas if not d.get('is_key_person', False)]
        
        key_summary = am._get_summary(key_persons_data, points_per_vote=10.0)
        general_summary = am._get_summary(general_persons_data, points_per_vote=5.0)
        # 5. Prepare Restaurant Data
        res_row = request.restaurant.dict()
        
        # 6. Calculate Group Score
        final_score, combined_reason = am._calculate_weighted_score(
            res_row, 
            key_summary, 
            general_summary, 
            weights=dynamic_weights
        )
        print('-' * 50)
        print(res_row)
        print('-' * 50)

        # 7. Calculate Individual Scores for Detail
        individual_results = []
        for d in attendee_datas:
            # Create a summary for just this one person
            single_summary = am._get_summary([d], points_per_vote=10.0)
            # Individual scores use the group's dynamic weights for consistency
            p_score, p_reason = am.calculate_restaurant_score(single_summary, res_row, weights=dynamic_weights)
            print(f"USER ID : {d['user_id']} | {single_summary} | {p_score} | {p_reason}")
            individual_results.append({
                "user_id": d["user_id"],
                "score": p_score,
                "breakdown": p_reason
            })

        return {
            "final_score": final_score,
            "dynamic_weights": dynamic_weights,
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
