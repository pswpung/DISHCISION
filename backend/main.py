#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import uvicorn
from loguru import logger
from fastapi import FastAPI
from api.line_router import router as line_router
from api.query_user import router as query_user_router
from api.query_meeting_detail import router as query_meeting_detail
from api.query_meeting_attendee import router as query_meeting_attendee
from api.restaurant_suggestion import router as resturant_suggestion_router
from api.playground_router import router as playground_router
from api.location_router import router as location_router
from fastapi.middleware.cors import CORSMiddleware
from services.postgres_services import engine, Base
import models

# Create database tables if they do not exist
from sqlalchemy import text
with engine.connect() as connection:
    connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
    connection.execute(text("ALTER TABLE meeting_details ADD COLUMN IF NOT EXISTS voting_state JSONB DEFAULT NULL;"))
    connection.commit()

Base.metadata.create_all(bind=engine)

# Seed mock users for group-1 (local development / testing)
from services.postgres_services import SessionLocal
from models import UserDetail
db = SessionLocal()
try:
    mock_users = [
        {"user_id": "mock-user-id", "display_name": "Mock User (You)", "pictureurl": "https://via.placeholder.com/150", "group_id": "group-1"},
        {"user_id": "mock-friend-1", "display_name": "Angpao", "pictureurl": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80", "group_id": "group-1"},
        {"user_id": "mock-friend-2", "display_name": "Developer", "pictureurl": "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80", "group_id": "group-1"},
        {"user_id": "mock-friend-3", "display_name": "Budsakorn", "pictureurl": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80", "group_id": "group-1"}
    ]
    for mu in mock_users:
        exists = db.query(UserDetail).filter(UserDetail.user_id == mu["user_id"]).first()
        if not exists:
            db.add(UserDetail(**mu))
    db.commit()
    logger.info("Successfully seeded mock users for group-1")
except Exception as e:
    logger.error(f"Error seeding mock users: {e}")
    db.rollback()
finally:
    db.close()


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)
app.include_router(line_router)
app.include_router(query_user_router)
app.include_router(query_meeting_detail)
app.include_router(query_meeting_attendee)
app.include_router(resturant_suggestion_router)
app.include_router(playground_router)
app.include_router(location_router)

def main() -> None:
    """
        Entrypoint of the application.
    """
    try:
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8081,
            reload=True,
            factory=False,
        )
    except Exception as e:
        logger.error(f"FASTAPI INITIALIZATION ERROR: \n {e}")

if __name__ == "__main__":
    main()
