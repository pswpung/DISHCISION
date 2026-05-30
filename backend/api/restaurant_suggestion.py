from fastapi import APIRouter, Depends, Request, HTTPException, status
from typing import List
from uuid import UUID
from services.postgres_services import get_db
from models import MeetingDetail, MeetingAttendee, Restaurant, UserDetail
from workflows.suggestion_workflow import SuggestionWorkflows
from schemas import MeetingBase, MeetingCreate, MeetingUpdate, MeetingResponse, AttendeeBase, AttendeeCreate, AttendeeUpdate, AttendeeResponse
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np
import ast

router = APIRouter(
    prefix="/restaurant",
    tags=["Restaurant"]
)

def safe_literal_eval(val):
    if isinstance(val, str):
        return ast.literal_eval(val)
    return [] # Return an empty list so .explode() still works later

restaurant_lists = pd.read_csv("./statics/restaurants_lists.csv")
restaurant_lists = restaurant_lists.replace({np.nan: None})
restaurant_lists['price'] = restaurant_lists['price'].apply(lambda x : str(x).strip())
restaurant_lists['category'] = restaurant_lists['category'].apply(ast.literal_eval)

EXCLUDED_CATEGORIES = {
    "ชานมไข่มุก", 
    "เครื่องดื่ม/น้ำผลไม้", 
    "ร้านกาแฟ/ชา", 
    "ของหวาน", 
    "อาหารกล่อง/ข้าวกล่อง เดลิเวอรี", 
    "ร้านขายผลไม้", 
    "ร้านขายของชำ", 
    "อาหารแห้งและอาหารแปรรูป", 
    "ร้านอุปกรณ์ทำกาแฟและเครื่องดื่ม",
    "ตลาดสด",
    "ร้านไวน์",
    "ผลิตภัณฑ์จากนม",
    "เบเกอรี/เค้ก",
    "ไอศกรีม",
    "อื่นๆ",
    "คาเฟ่",
    "อาหารเช้า",
    "อาหารและสินค้าเพื่อสุขภาพ",
    "อาหารทะเลแช่แข็ง และอาหารทะเลสด"
}

restaurant_lists = restaurant_lists[
    ~restaurant_lists['category'].apply(lambda cats: any(c in EXCLUDED_CATEGORIES for c in cats))
]

cols = ["breadcrumbs", "alcohols", "good_fors"]
for col in cols:
    restaurant_lists[col] = restaurant_lists[col].apply(safe_literal_eval)

# Exclude restaurants that are good for "เดลิเวอรี"
restaurant_lists = restaurant_lists[
    ~restaurant_lists['good_fors'].apply(lambda x: "เดลิเวอรี" in x)
]



unique_category = pd.Series([item for sublist in restaurant_lists['category'] for item in sublist]).unique()

# Sort Price Logic
def get_price_sort_order(val):
    if not val or str(val) == 'None' or str(val) == 'nan' or str(val).lower() == 'null': return 999
    val = str(val).strip()
    # Thai Price Logic
    if "ต่ำกว่า 100 บาท" in val: return 1
    if "101" in val and "250" in val: return 2
    if "251" in val and "500" in val: return 3
    if "501" in val and "1,000" in val: return 4
    if "มากกว่า 1,000 บาท" in val: return 5
    
    # Fallback to English/Numeric if mixed data
    if '<' in val and '500' in val: return 1
    if '500' in val and '1000' in val: return 2
    if '1000' in val and '2000' in val: return 3
    if '>' in val and '2000' in val: return 4
    
    return 100 # Unknown ranges at the end

# Filter and Sort Prices
raw_prices = restaurant_lists["price"].unique().tolist()
valid_prices = [p for p in raw_prices if p and str(p) != 'None' and str(p) != 'nan' and str(p).lower() != 'null']
unique_price = sorted(valid_prices, key=get_price_sort_order)

unique_parking = restaurant_lists["parking"].unique()
unique_breadcrumbs = pd.Series([item for sublist in restaurant_lists['breadcrumbs'] for item in sublist]).unique()
unique_alcohols = pd.Series([item for sublist in restaurant_lists['alcohols'] for item in sublist]).unique()
unique_good_fors = pd.Series([item for sublist in restaurant_lists['good_fors'] for item in sublist]).unique()

@router.get("/config")
def get_restaurant_config():
    return {
        "totals" : restaurant_lists.shape[0], 
        
        # Convert all NumPy arrays to standard Python lists
        "category" : unique_category.tolist(),
        "price" : unique_price, # Already a sorted list
        "parking" : unique_parking.tolist(),
        # "breadcrumbs" : unique_breadcrumbs.tolist(),
        "alcohols" : unique_alcohols.tolist(),
        "good_fors" : unique_good_fors.tolist()
    }

# REFACTORED: Standalone function to be used by API and other triggers
def generate_and_send_suggestion(meeting_id: UUID, db: Session):
    from models import UserDetail # Import UserDetail

    # SECTION: QUERY DATA
    meeting_detail = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not meeting_detail:
        raise HTTPException(status_code=404, detail="Meeting not found")

    attendee_details = db.query(MeetingAttendee).filter(MeetingAttendee.meeting_id == meeting_id).all()
    if not attendee_details:
        raise HTTPException(status_code=404, detail="Attendees not found")

    # Fetch all user profiles for these attendees
    attendee_ids = [a.user_id for a in attendee_details]
    users = db.query(UserDetail).filter(UserDetail.user_id.in_(attendee_ids)).all()
    user_map = {u.user_id: {"picture": u.pictureurl, "name": u.display_name} for u in users}
    user_details = {u.user_id: u for u in users}

    # Check if all attendees have provided availability and preferences
    for attendee in attendee_details:
        if not attendee.avaliable_at and not attendee.preference:
            return {
                "status": "waiting",
                "message": "Please wait for others to add their preference"
            }

    suggestion_workflow = SuggestionWorkflows()
    result = suggestion_workflow.get_suggestion(
        meeting_detail = meeting_detail,
        attendance_details = attendee_details,
        restaurant_data = restaurant_lists,
        user_details = user_details
    )

    # Save suggestions to DB for caching
    meeting_detail.suggestion_detail = result
    db.commit()

    # Send Notification to LINE Group
    try:
        from services.line_services import push_message_result_flex

        # Preferred Restaurants
        preferred_restaurants = result.get("preferred_restaurants", [])
        
        # Flatten slots for sorting
        all_slots = []
        # Access the slot-based suggestions from the 'suggested_restaurants' key
        suggestions = result.get("suggested_restaurants", {})
        for date, times in suggestions.items():
            for time_slot, slot_data in times.items():
                if isinstance(slot_data, dict):
                    final_score = slot_data.get("final_score", 0)
                    restaurants = slot_data.get("restaurants", [])
                    attendees_ids_list = slot_data.get("attendees", [])
                    partial_join = slot_data.get("partial_join", [])
                else:
                    # Fallback
                    final_score = 0
                    restaurants = slot_data if isinstance(slot_data, list) else []
                    attendees_ids_list = []
                    partial_join = []
                
                # Map IDs to Picture URLs and Names
                attendee_images = []
                attendee_names = []
                for uid in attendees_ids_list:
                    if uid in user_map:
                        if user_map[uid]["picture"]:
                            attendee_images.append(user_map[uid]["picture"])
                        if user_map[uid]["name"]:
                            attendee_names.append(user_map[uid]["name"])

                if final_score > 0:
                    all_slots.append({
                        "date": date,
                        "time": time_slot,
                        "final_score": final_score,
                        "restaurants": restaurants,
                        "attendees": attendee_images,
                        "attendee_names": attendee_names,
                        "partial_join": partial_join
                    })

        # Sort by final score descending, then by attendee count descending, then by partial join count descending
        sorted_slots = sorted(all_slots, key=lambda x: (x['final_score'], len(x.get('attendees', [])), len(x.get('partial_join', []))), reverse=True)
        top_slots = sorted_slots[:10] # Top 10 for Carousel
        
        # Global Discovery Ranking
        all_scored_restaurants = result.get("all_scored_restaurants", [])

        if meeting_detail.group_id:
            # Extract info from initial_data based on timing mode
            initial_data = meeting_detail.initial_data or {}
            timing_mode = initial_data.get("timing_mode", "period")
            
            if timing_mode == "fixed":
                meal_time = f"{initial_data.get('fixed_start_time', '')} - {initial_data.get('fixed_end_time', '')}"
                start_date = initial_data.get("fixed_date", "")
                end_date = "" # Only one date for fixed mode
            else:
                meal_time = initial_data.get("meal_time", "Not specified")
                start_date = initial_data.get("start_date", "")
                end_date = initial_data.get("end_date", "")

            is_fixed_meeting = (timing_mode == "fixed" and len(initial_data.get("fixed_restaurants", [])) > 0)

            if is_fixed_meeting:
                from services.line_services import push_message_fixed_result_flex
                fixed_restaurant = initial_data.get("fixed_restaurants", [])[0]
                # In fixed mode, top_slots[0] contains the confirmed slot with attendees
                push_message_fixed_result_flex(
                    group_id=meeting_detail.group_id,
                    meeting_id=str(meeting_detail.meeting_id),
                    meeting_name=meeting_detail.meeting_name,
                    slot=top_slots[0] if top_slots else {},
                    fixed_restaurant=fixed_restaurant,
                    meal_time=meal_time,
                    start_date=start_date
                )
            else:
                # Push System Result Flex (Top Slots + Friend Recommends + Global Discovery)
                fixed_restaurant = initial_data.get("fixed_restaurants", [])[0] if initial_data.get("fixed_restaurants") else None
                push_message_result_flex(
                    group_id=meeting_detail.group_id,
                    meeting_id=str(meeting_detail.meeting_id),
                    meeting_name=meeting_detail.meeting_name,
                    top_slots=top_slots,
                    preferred_restaurants=preferred_restaurants,
                    all_scored_restaurants=all_scored_restaurants,
                    meal_time=meal_time,
                    start_date=start_date,
                    end_date=end_date,
                    fixed_restaurant=fixed_restaurant,
                    total_attendees=len(attendee_details)
                )
    except Exception as e:
        print(f"Failed to send Result notification: {e}")

    return result

@router.post("/suggest/{meeting_id}")
def suggestions(meeting_id: UUID, refresh: bool = False, db: Session = Depends(get_db)):
    # Check for cached suggestions if refresh is False
    if not refresh:
        meeting_detail = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
        if meeting_detail and meeting_detail.suggestion_detail:
            return meeting_detail.suggestion_detail
            
    return generate_and_send_suggestion(meeting_id, db)

@router.get("/search")
def search_restaurants(keyword: str, mode: str = "hybrid", price: str = None, db: Session = Depends(get_db)):
    if not keyword:
        return []
    
    if mode == "name":
        # Simple name lookup to make it super fast
        query = db.query(Restaurant).filter(
            Restaurant.name.ilike(f"%{keyword.strip()}%")
        )
        if price and price != "Any":
            query = query.filter(Restaurant.price == price)
        results = query.order_by(Restaurant.rating.desc()).limit(10).all()
        return [r.to_dict() for r in results]
        
    from services.search_service import hybrid_search
    results = hybrid_search(db, keyword, limit=10)
    return [r.to_dict() for r in results]