from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, Any

# --- Meeting Details ---
class MeetingBase(BaseModel):
    meeting_name: str
    initial_data: dict[str, Any]
    group_id: str
    suggestion_detail: Optional[dict[str, Any]] = None

class MeetingCreate(MeetingBase):
    # Optional in case you want to provide one, 
    # but the DB will auto-generate if missing
    meeting_id: Optional[UUID] = None 

class MeetingUpdate(BaseModel):
    # All fields are optional for partial updates (PATCH)
    meeting_name: Optional[str] = None
    initial_data: Optional[dict[str, Any]] = None
    group_id: Optional[str] = None
    suggestion_detail: Optional[dict[str, Any]] = None

class MeetingResponse(MeetingBase):
    meeting_id: UUID
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True