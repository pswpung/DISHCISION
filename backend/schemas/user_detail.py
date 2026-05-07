from pydantic import BaseModel

class UserBase(BaseModel):
    user_id: str
    display_name: str
    pictureurl: str
    group_id: str | None = None

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    display_name: str | None = None
    pictureurl: str | None = None
    group_id: str | None = None

class UserResponse(UserBase):
    class Config:
        from_attributes = True