from pydantic import BaseModel
from uuid import UUID
from typing import Optional, Any

# --- Meeting Attendees ---
class AttendeeBase(BaseModel):
    meeting_id: UUID
    user_id: str
    group_id: str
    is_key_person : Optional[bool] = False
    avaliable_at: Optional[list[dict[str, Any]]] = None
    preference: Optional[dict[str, Any]] = None
    is_joined: Optional[bool] = None

class AttendeeCreate(AttendeeBase):
    """Schema for adding a new user to a meeting."""
    pass

class AttendeeUpdate(BaseModel):
    """Schema for updating a user's group within a meeting."""
    avaliable_at: Optional[list[dict[str, Any]]]
    preference: Optional[dict[str, Any]]
    is_joined: bool

class AttendeeResponse(AttendeeBase):
    """Schema for returning attendee data."""
    class Config:
        from_attributes = True