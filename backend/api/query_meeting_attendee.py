from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from models import MeetingAttendee
from schemas import AttendeeBase, AttendeeCreate, AttendeeUpdate, AttendeeResponse
from services.postgres_services import get_db, SessionLocal
from sqlalchemy.orm.attributes import flag_modified

router = APIRouter(prefix="/attendee", tags=["Meeting Attendees"])

# Helper for Safe Background Execution
def background_generate_suggestion(meeting_id: UUID):
    db: Session = SessionLocal()
    try:
        from .restaurant_suggestion import generate_and_send_suggestion
        generate_and_send_suggestion(meeting_id, db, notify_type="summary")
    except Exception as e:
        import traceback
        print(f"Error triggering suggestion in background: {e}")
        traceback.print_exc()
    finally:
        db.close()

# --- CREATE: Add Attendee ---
@router.post("", response_model=AttendeeResponse, status_code=status.HTTP_201_CREATED)
def add_attendee(attendee: AttendeeCreate, db: Session = Depends(get_db)):
    # Check if they are already in the meeting
    existing = db.query(MeetingAttendee).filter(
        MeetingAttendee.meeting_id == attendee.meeting_id,
        MeetingAttendee.user_id == attendee.user_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="User is already an attendee of this meeting")
    
    new_attendee = MeetingAttendee(**attendee.model_dump())
    db.add(new_attendee)
    db.commit()
    db.refresh(new_attendee)
    return new_attendee

# --- READ: Get all attendees for one meeting ---
@router.get("/{meeting_id}", response_model=List[AttendeeResponse])
def get_meeting_attendees(meeting_id: UUID, db: Session = Depends(get_db)):
    return db.query(MeetingAttendee).filter(MeetingAttendee.meeting_id == meeting_id).all()

# --- UPDATE: Change group for an attendee ---
@router.patch("/{meeting_id}/{user_id}", response_model=AttendeeResponse)
def update_attendee_group(
    meeting_id: UUID, 
    user_id: str, 
    update_data: AttendeeUpdate, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    print('-' * 50)
    print(f"Update Attendee Group: {meeting_id} - {user_id}")
    print(f"Update Data : {update_data}")
    print('-' * 50)
    db_attendee = db.query(MeetingAttendee).filter(
        MeetingAttendee.meeting_id == meeting_id,
        MeetingAttendee.user_id == user_id
    ).first()
    
    if not db_attendee:
        raise HTTPException(status_code=404, detail="Attendee not found in this meeting")
    
    db_attendee.avaliable_at = update_data.avaliable_at
    db_attendee.preference = update_data.preference
    db_attendee.is_joined = update_data.is_joined
    
    # CRITICAL: Force SQLAlchemy to detect JSON changes
    flag_modified(db_attendee, "avaliable_at")
    flag_modified(db_attendee, "preference")
    
    db.commit()
    db.refresh(db_attendee)

    # Check if all attendees have voted
    all_attendees = db.query(MeetingAttendee).filter(MeetingAttendee.meeting_id == meeting_id, MeetingAttendee.is_joined == True).all()
    print(f"All Attendees : {all_attendees}")
    all_voted = True
    for attendee in all_attendees:
        print(f"    > Attendee {attendee.user_id} : preference={attendee.preference}")
        if attendee.preference is None:
            all_voted = False
            break
    
    if all_voted:
        print(f"All attendees voted for meeting {meeting_id}. Triggering suggestion...")
        background_tasks.add_task(background_generate_suggestion, meeting_id)
    else:
        print(f"Not all attendees voted for meeting {meeting_id}. Waiting for more votes...")

    return db_attendee

# --- DELETE: Remove attendee from meeting ---
@router.delete("/{meeting_id}/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_attendee(meeting_id: UUID, user_id: str, db: Session = Depends(get_db)):
    db_attendee = db.query(MeetingAttendee).filter(
        MeetingAttendee.meeting_id == meeting_id,
        MeetingAttendee.user_id == user_id
    ).first()
    
    if not db_attendee:
        raise HTTPException(status_code=404, detail="Attendee not found")
        
    db.delete(db_attendee)
    db.commit()
    return None