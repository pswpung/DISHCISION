from fastapi import APIRouter, Depends, Request, HTTPException, status
from schemas import UserBase, UserCreate, UserUpdate, UserResponse
from models import UserDetail
from sqlalchemy.orm import Session
from typing import List
from services.postgres_services import get_db

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

# CREATE: Add a new user
@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(UserDetail).filter(UserDetail.user_id == user.user_id).first()
    if db_user:
        raise HTTPException(status_code=400, detail="User already registered")
    
    new_user = UserDetail(**user.model_dump())
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# READ: Get all users
@router.get("/", response_model=List[UserResponse])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(UserDetail).offset(skip).limit(limit).all()

# READ: Get specific user
@router.get("/{user_id}", response_model=UserResponse)
def read_user(user_id: str, db: Session = Depends(get_db)):
    db_user = db.query(UserDetail).filter(UserDetail.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

# READ: Get user's last attendee preference
@router.get("/{user_id}/last-preference")
def read_last_preference(user_id: str, db: Session = Depends(get_db)):
    from models import MeetingAttendee, MeetingDetail
    last_attendee = db.query(MeetingAttendee)\
        .join(MeetingDetail, MeetingAttendee.meeting_id == MeetingDetail.meeting_id)\
        .filter(MeetingAttendee.user_id == user_id)\
        .filter(MeetingAttendee.preference.isnot(None))\
        .order_by(MeetingDetail.created_at.desc())\
        .first()
    
    if not last_attendee:
        raise HTTPException(status_code=404, detail="No previous preference found for this user")
    
    return {
        "preference": last_attendee.preference,
        "avaliable_at": last_attendee.avaliable_at
    }


# READ: Get users by group
@router.get("/group/{group_id}", response_model=List[UserResponse])
def read_users_by_group(group_id: str, db: Session = Depends(get_db)):
    users = db.query(UserDetail).filter(UserDetail.group_id == group_id).all()
    return users

# UPDATE: Update user profile
@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, user_update: UserUpdate, db: Session = Depends(get_db)):
    db_user = db.query(UserDetail).filter(UserDetail.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_data = user_update.model_dump(exclude_unset=True)
    for key, value in user_data.items():
        setattr(db_user, key, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user

# DELETE: Remove user
@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, db: Session = Depends(get_db)):
    db_user = db.query(UserDetail).filter(UserDetail.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(db_user)
    db.commit()
    return None