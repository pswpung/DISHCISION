from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional, Any
from services.postgres_services import get_db
from models import MeetingDetail, UserDetail, MeetingAttendee, Feedback
from schemas import MeetingBase, MeetingCreate, MeetingUpdate, MeetingResponse
import copy
import time
from pydantic import BaseModel

router = APIRouter(prefix="/meetings", tags=["Meetings"])

# --- HELPERS ---

def get_initialized_voting_state(meeting: MeetingDetail):
    state = meeting.voting_state
    if not state:
        state = {}
    
    # Ensure default keys exist
    if "time_votes" not in state:
        state["time_votes"] = {}
    if "restaurant_preferences" not in state:
        state["restaurant_preferences"] = {}
    if "restaurant_vetoes" not in state:
        state["restaurant_vetoes"] = {}
    if "ready_users" not in state:
        state["ready_users"] = []
    if "time_decision_method" not in state:
        state["time_decision_method"] = "majority"
    if "restaurant_decision_method" not in state:
        state["restaurant_decision_method"] = "list"
    if "wheel_state" not in state:
        state["wheel_state"] = {
            "status": "idle",
            "target_type": None,
            "spin_at": None,
            "landed_key": None,
            "stop_angle": None,
            "selected_keys": []
        }
    if "selected_restaurants" not in state:
        state["selected_restaurants"] = []
    if "selected_time_slots" not in state:
        state["selected_time_slots"] = []
    if "exclude_vetoed" not in state:
        state["exclude_vetoed"] = False
    
    return state

def sanitize_meeting_response(meeting: MeetingDetail, user_id: Optional[str] = None):
    meeting_dict = meeting.to_dict()
    if meeting_dict.get("voting_state"):
        # Make a copy to avoid mutating SQLAlchemy's state
        v_state = dict(meeting_dict["voting_state"])
        user_vetoed = []
        if "restaurant_vetoes" in v_state and isinstance(v_state["restaurant_vetoes"], dict):
            sanitized_vetoes = {}
            veto_users = {}
            for r_name, u_ids in v_state["restaurant_vetoes"].items():
                if isinstance(u_ids, list):
                    if user_id and user_id in u_ids:
                        user_vetoed.append(r_name)
                    sanitized_vetoes[r_name] = len(u_ids)
                    veto_users[r_name] = u_ids
                else:
                    sanitized_vetoes[r_name] = u_ids
                    veto_users[r_name] = []
            v_state["restaurant_vetoes"] = sanitized_vetoes
            v_state["restaurant_vetoes_users"] = veto_users
        v_state["user_vetoed"] = user_vetoed
        meeting_dict["voting_state"] = v_state
    return meeting_dict

# --- REQUEST SCHEMAS ---

class VoteTimeRequest(BaseModel):
    user_id: str
    slot_key: str

class RestaurantPreferenceRequest(BaseModel):
    user_id: str
    restaurant_name: str

class ToggleReadyRequest(BaseModel):
    user_id: str

class SetDecisionMethodRequest(BaseModel):
    target_type: str # "time" or "restaurant"
    method: str      # "majority", "wheel", "list"

class SpinWheelRequest(BaseModel):
    target_type: str # "time" or "restaurant"
    landed_key: str  # slot_key or restaurant_name
    stop_angle: float
    selected_keys: Optional[List[str]] = None

class SelectWheelRestaurantsRequest(BaseModel):
    restaurant_names: List[str]

class SelectWheelTimeSlotsRequest(BaseModel):
    slot_keys: List[str]

class ToggleExcludeVetoedRequest(BaseModel):
    user_id: str

class ConfirmFinalRequest(BaseModel):
    confirmed_time: str
    confirmed_restaurant: str

class FeedbackSubmitRequest(BaseModel):
    user_id: Optional[str] = None
    responses: dict

# --- MEETING DETAILS CRUD ---

from services.line_services import push_message_creation_flex, push_message_fixed_result_flex

@router.post("", response_model=MeetingResponse)
def create_meeting(meeting: MeetingCreate, db: Session = Depends(get_db)):
    new_meeting = MeetingDetail(**meeting.model_dump(exclude_none=True))
    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting) # Fetches auto-generated UUID and timestamps

    # Send Notification to LINE Group
    try:
        if new_meeting.group_id:
            initial_data = new_meeting.initial_data or {}
            timing_mode = initial_data.get("timing_mode", "period")
            
            # Extract Fixed Restaurant Name & URL
            fixed_restaurant_list = initial_data.get("fixed_restaurants", [])
            fixed_restaurant_obj = fixed_restaurant_list[0] if fixed_restaurant_list else None
            fixed_restaurant = fixed_restaurant_obj.get("name") if fixed_restaurant_obj else ""
            fixed_restaurant_url = fixed_restaurant_obj.get("url") or fixed_restaurant_obj.get("wongnai_url") if fixed_restaurant_obj else ""
            
            # Extract Fixed Location
            fixed_location = initial_data.get("fixLocation") or ""
            
            if timing_mode == "fixed":
                meal_time = f"{initial_data.get('fixed_start_time', '')} - {initial_data.get('fixed_end_time', '')}"
                start_date = initial_data.get("fixed_date", "N/A")
                end_date = "" # Indicate fixed time by empty end_date
            else:
                meal_time = initial_data.get("meal_time", "Not specified")
                start_date = initial_data.get("start_date", "N/A")
                end_date = initial_data.get("end_date", "N/A")
            
            attendees = initial_data.get("attendees", [])
            # Only send "Let's Vote" if there are other attendees involved
            if len(attendees) > 1:
                push_message_creation_flex(
                    group_id=new_meeting.group_id,
                    meeting_id=str(new_meeting.meeting_id),
                    meeting_name=new_meeting.meeting_name,
                    meal_time=meal_time,
                    start_date=start_date,
                    end_date=end_date,
                    fixed_restaurant=fixed_restaurant,
                    fixed_location=fixed_location,
                    fixed_restaurant_url=fixed_restaurant_url
                )
    except Exception as e:
        print(f"Failed to send LINE notification: {e}")

    return sanitize_meeting_response(new_meeting)

@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: UUID, user_id: Optional[str] = None, db: Session = Depends(get_db)):
    db_meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return sanitize_meeting_response(db_meeting, user_id)

@router.get("/group/{group_id}", response_model=List[MeetingResponse])
def get_meetings_by_group(group_id: str, db: Session = Depends(get_db)):
    meetings = db.query(MeetingDetail).filter(MeetingDetail.group_id == group_id).all()
    return [sanitize_meeting_response(m) for m in meetings]

@router.patch("/{meeting_id}", response_model=MeetingResponse)
def update_meeting(meeting_id: UUID, meeting_update: MeetingUpdate, db: Session = Depends(get_db)):
    db_meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Update only the fields provided in the request
    update_data = meeting_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_meeting, key, value)
    
    db.commit()
    db.refresh(db_meeting)
    return sanitize_meeting_response(db_meeting)

@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(meeting_id: UUID, db: Session = Depends(get_db)):
    db_meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db.delete(db_meeting)
    db.commit()
    return None

# --- NEW DECISION FLOW ENDPOINTS ---

@router.post("/{meeting_id}/vote-time", response_model=MeetingResponse)
def vote_time(meeting_id: UUID, req: VoteTimeRequest, db: Session = Depends(get_db)):
    meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    state = copy.deepcopy(get_initialized_voting_state(meeting))
    votes = state["time_votes"]
    
    if req.slot_key not in votes:
        votes[req.slot_key] = []
        
    if req.user_id in votes[req.slot_key]:
        votes[req.slot_key].remove(req.user_id)
    else:
        votes[req.slot_key].append(req.user_id)
        
    state["time_votes"] = votes
    meeting.voting_state = state
    db.commit()
    db.refresh(meeting)
    return sanitize_meeting_response(meeting, req.user_id)

@router.post("/{meeting_id}/tail-in", response_model=MeetingResponse)
def tail_in(meeting_id: UUID, req: RestaurantPreferenceRequest, db: Session = Depends(get_db)):
    meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    state = copy.deepcopy(get_initialized_voting_state(meeting))
    prefs = state["restaurant_preferences"]
    
    if req.restaurant_name not in prefs:
        prefs[req.restaurant_name] = []
        
    if req.user_id in prefs[req.restaurant_name]:
        prefs[req.restaurant_name].remove(req.user_id)
    else:
        prefs[req.restaurant_name].append(req.user_id)
        
    state["restaurant_preferences"] = prefs
    meeting.voting_state = state
    db.commit()
    db.refresh(meeting)
    return sanitize_meeting_response(meeting, req.user_id)

@router.post("/{meeting_id}/tail-out", response_model=MeetingResponse)
def tail_out(meeting_id: UUID, req: RestaurantPreferenceRequest, db: Session = Depends(get_db)):
    meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    state = copy.deepcopy(get_initialized_voting_state(meeting))
    vetoes = state["restaurant_vetoes"]
    
    if req.restaurant_name not in vetoes:
        vetoes[req.restaurant_name] = []
        
    if req.user_id in vetoes[req.restaurant_name]:
        vetoes[req.restaurant_name].remove(req.user_id)
    else:
        vetoes[req.restaurant_name].append(req.user_id)
        
    state["restaurant_vetoes"] = vetoes
    meeting.voting_state = state
    db.commit()
    db.refresh(meeting)
    return sanitize_meeting_response(meeting, req.user_id)

@router.post("/{meeting_id}/toggle-ready", response_model=MeetingResponse)
def toggle_ready(meeting_id: UUID, req: ToggleReadyRequest, db: Session = Depends(get_db)):
    meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    state = copy.deepcopy(get_initialized_voting_state(meeting))
    ready = state["ready_users"]
    
    if req.user_id in ready:
        ready.remove(req.user_id)
    else:
        ready.append(req.user_id)
        
    state["ready_users"] = ready
    meeting.voting_state = state
    db.commit()
    db.refresh(meeting)
    return sanitize_meeting_response(meeting, req.user_id)

@router.post("/{meeting_id}/set-decision-method", response_model=MeetingResponse)
def set_decision_method(meeting_id: UUID, req: SetDecisionMethodRequest, db: Session = Depends(get_db)):
    meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    state = copy.deepcopy(get_initialized_voting_state(meeting))
    if req.target_type == "time":
        state["time_decision_method"] = req.method
    elif req.target_type == "restaurant":
        state["restaurant_decision_method"] = req.method
        
    meeting.voting_state = state
    db.commit()
    db.refresh(meeting)
    return sanitize_meeting_response(meeting)

@router.post("/{meeting_id}/spin-wheel", response_model=MeetingResponse)
def spin_wheel(meeting_id: UUID, req: SpinWheelRequest, db: Session = Depends(get_db)):
    meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    state = copy.deepcopy(get_initialized_voting_state(meeting))
    state["wheel_state"] = {
        "status": "spinning",
        "target_type": req.target_type,
        "spin_at": int(time.time() * 1000),
        "landed_key": req.landed_key,
        "stop_angle": req.stop_angle,
        "selected_keys": req.selected_keys or []
    }
    
    meeting.voting_state = state
    db.commit()
    db.refresh(meeting)
    return sanitize_meeting_response(meeting)

@router.post("/{meeting_id}/select-wheel-restaurants", response_model=MeetingResponse)
def select_wheel_restaurants(meeting_id: UUID, req: SelectWheelRestaurantsRequest, db: Session = Depends(get_db)):
    meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    state = copy.deepcopy(get_initialized_voting_state(meeting))
    state["selected_restaurants"] = req.restaurant_names
    
    meeting.voting_state = state
    db.commit()
    db.refresh(meeting)
    return sanitize_meeting_response(meeting)

@router.post("/{meeting_id}/select-wheel-time-slots", response_model=MeetingResponse)
def select_wheel_time_slots(meeting_id: UUID, req: SelectWheelTimeSlotsRequest, db: Session = Depends(get_db)):
    meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    state = copy.deepcopy(get_initialized_voting_state(meeting))
    state["selected_time_slots"] = req.slot_keys
    
    meeting.voting_state = state
    db.commit()
    db.refresh(meeting)
    return sanitize_meeting_response(meeting)

@router.post("/{meeting_id}/toggle-exclude-vetoed", response_model=MeetingResponse)
def toggle_exclude_vetoed(meeting_id: UUID, req: ToggleExcludeVetoedRequest, db: Session = Depends(get_db)):
    meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    state = copy.deepcopy(get_initialized_voting_state(meeting))
    state["exclude_vetoed"] = not state.get("exclude_vetoed", False)
    
    meeting.voting_state = state
    db.commit()
    db.refresh(meeting)
    return sanitize_meeting_response(meeting, req.user_id)

@router.post("/{meeting_id}/confirm-final", response_model=MeetingResponse)
def confirm_final(meeting_id: UUID, req: ConfirmFinalRequest, db: Session = Depends(get_db)):
    meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    state = copy.deepcopy(get_initialized_voting_state(meeting))
    state["final_decision"] = {
        "time_slot": req.confirmed_time,
        "restaurant_id": req.confirmed_restaurant
    }
    meeting.voting_state = state
    
    # Close meeting status in initial_data
    initial = copy.deepcopy(meeting.initial_data) or {}
    initial["status"] = "closed"
    meeting.initial_data = initial
    
    db.commit()
    db.refresh(meeting)
    
    # Trigger LINE Flex Message notification
    try:
        if meeting.group_id:
            # 1. Fetch attendee user profiles
            attendees_db = db.query(MeetingAttendee).filter(MeetingAttendee.meeting_id == meeting_id).all()
            user_ids = [a.user_id for a in attendees_db]
            users = db.query(UserDetail).filter(UserDetail.user_id.in_(user_ids)).all()
            user_map = {u.user_id: u for u in users}
            
            # 2. Parse date and time from confirmed_time
            confirmed_date = ""
            confirmed_time_only = ""
            if "_" in req.confirmed_time:
                parts = req.confirmed_time.split("_", 1)
                confirmed_date = parts[0]
                confirmed_time_only = parts[1]
            else:
                confirmed_time_only = req.confirmed_time
                
            # 3. Find slot data in suggestion_detail if cached to fetch correct attendees subset
            attendee_pics = []
            if meeting.suggestion_detail and "suggested_restaurants" in meeting.suggestion_detail:
                sug_res = meeting.suggestion_detail["suggested_restaurants"]
                if confirmed_date in sug_res and confirmed_time_only in sug_res[confirmed_date]:
                    slot_data = sug_res[confirmed_date][confirmed_time_only]
                    joined_uids = []
                    if isinstance(slot_data, dict):
                        joined_uids = slot_data.get("full_join", []) + [pj.get("user_id") for pj in slot_data.get("partial_join", []) if isinstance(pj, dict)]
                    for uid in joined_uids:
                        if uid in user_map and user_map[uid].pictureurl:
                            attendee_pics.append(user_map[uid].pictureurl)
            
            # Fallback to all attendee pics if empty
            if not attendee_pics:
                attendee_pics = [u.pictureurl for u in users if u.pictureurl]
                
            slot_dict = {
                "attendees": attendee_pics,
                "time": confirmed_time_only or req.confirmed_time,
                "date": confirmed_date or meeting.initial_data.get("start_date", "")
            }
            
            # 4. Search for the restaurant's Wongnai link
            restaurant_url = ""
            if meeting.suggestion_detail:
                for r in meeting.suggestion_detail.get("preferred_restaurants", []):
                    if r.get("name") == req.confirmed_restaurant:
                        restaurant_url = r.get("wongnai_link") or r.get("url") or r.get("wongnai_url") or ""
                        break
                if not restaurant_url:
                    for r in meeting.suggestion_detail.get("all_scored_restaurants", []):
                        if r.get("name") == req.confirmed_restaurant:
                            restaurant_url = r.get("wongnai_link") or r.get("url") or r.get("wongnai_url") or ""
                            break
                            
            if restaurant_url and not restaurant_url.startswith("http"):
                restaurant_url = f"https://{restaurant_url}"
                
            fixed_restaurant_dict = {
                "name": req.confirmed_restaurant,
                "url": restaurant_url
            }
            
            push_message_fixed_result_flex(
                group_id=meeting.group_id,
                meeting_id=str(meeting.meeting_id),
                meeting_name=meeting.meeting_name,
                slot=slot_dict,
                fixed_restaurant=fixed_restaurant_dict,
                meal_time=slot_dict["time"],
                start_date=slot_dict["date"]
            )
    except Exception as e:
        print(f"Failed to send final LINE confirmation: {e}")
        
    return sanitize_meeting_response(meeting)

@router.post("/{meeting_id}/feedback", status_code=status.HTTP_201_CREATED)
def submit_feedback(meeting_id: UUID, req: FeedbackSubmitRequest, db: Session = Depends(get_db)):
    db_meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    new_feedback = Feedback(
        meeting_id=str(meeting_id),
        user_id=req.user_id,
        responses=req.responses
    )
    db.add(new_feedback)
    db.commit()
    db.refresh(new_feedback)
    return {"status": "success", "id": new_feedback.id}