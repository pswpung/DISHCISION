from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List
from services.postgres_services import get_db
from models import MeetingDetail
from schemas import MeetingBase, MeetingCreate, MeetingUpdate, MeetingResponse

router = APIRouter(prefix="/meetings", tags=["Meetings"])

# --- MEETING DETAILS CRUD ---

from services.line_services import push_message_creation_flex

@router.post("", response_model=MeetingResponse)
def create_meeting(meeting: MeetingCreate, db: Session = Depends(get_db)):
    new_meeting = MeetingDetail(**meeting.model_dump(exclude_none=True))
    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting) # Fetches auto-generated UUID and timestamps

    # Send Notification to LINE Group
    try:
        if new_meeting.group_id:
            meal_time = new_meeting.initial_data.get("meal_time", "Not specified")
            start_date = new_meeting.initial_data.get("start_date", "N/A")
            end_date = new_meeting.initial_data.get("end_date", "N/A")
            
            attendees = new_meeting.initial_data.get("attendees", [])
            # Only send "Let's Vote" if there are other attendees involved
            if len(attendees) > 1:
                push_message_creation_flex(
                    group_id=new_meeting.group_id,
                    meeting_id=str(new_meeting.meeting_id),
                    meeting_name=new_meeting.meeting_name,
                    meal_time=meal_time,
                    start_date=start_date,
                    end_date=end_date
                )
    except Exception as e:
        print(f"Failed to send LINE notification: {e}")

    return new_meeting

@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: UUID, db: Session = Depends(get_db)):
    db_meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return db_meeting

@router.get("/group/{group_id}", response_model=List[MeetingResponse])
def get_meetings_by_group(group_id: str, db: Session = Depends(get_db)):
    meetings = db.query(MeetingDetail).filter(MeetingDetail.group_id == group_id).all()
    return meetings

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
    return db_meeting

@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(meeting_id: UUID, db: Session = Depends(get_db)):
    db_meeting = db.query(MeetingDetail).filter(MeetingDetail.meeting_id == meeting_id).first()
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db.delete(db_meeting)
    db.commit()
    return None