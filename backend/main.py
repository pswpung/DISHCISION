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

Base.metadata.create_all(bind=engine)

# Create database tables if they do not exist
from sqlalchemy import text
with engine.connect() as connection:
    connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
    connection.execute(text("ALTER TABLE meeting_details ADD COLUMN IF NOT EXISTS voting_state JSONB DEFAULT NULL;"))
    
    # Migrate user_details table primary key to composite (user_id, group_id) cleanly and robustly
    try:
        connection.execute(text("UPDATE user_details SET group_id = '' WHERE group_id IS NULL;"))
    except Exception as e:
        print(f"Migration step 1 (update nulls) skipped/failed: {e}")
        
    try:
        connection.execute(text("ALTER TABLE user_details ALTER COLUMN group_id SET NOT NULL;"))
    except Exception as e:
        print(f"Migration step 2 (set not null) skipped/failed: {e}")
        
    try:
        connection.execute(text("ALTER TABLE user_details DROP CONSTRAINT IF EXISTS user_details_pkey CASCADE;"))
    except Exception as e:
        print(f"Migration step 3 (drop old constraint) skipped/failed: {e}")
        
    try:
        connection.execute(text("ALTER TABLE user_details DROP CONSTRAINT IF EXISTS user_details_pkey_composite CASCADE;"))
    except Exception as e:
        print(f"Migration step 4 (drop composite constraint) skipped/failed: {e}")
        
    try:
        connection.execute(text("ALTER TABLE user_details ADD CONSTRAINT user_details_pkey_composite PRIMARY KEY (user_id, group_id);"))
    except Exception as e:
        print(f"Migration step 5 (add composite constraint) skipped/failed: {e}")
        
    try:
        connection.execute(text("ALTER TABLE meeting_attendees DROP CONSTRAINT IF EXISTS fk_meeting_attendees_user_details CASCADE;"))
        connection.execute(text("ALTER TABLE meeting_attendees ADD CONSTRAINT fk_meeting_attendees_user_details FOREIGN KEY (user_id, group_id) REFERENCES user_details (user_id, group_id) ON DELETE CASCADE;"))
    except Exception as e:
        print(f"Migration step 6 (add composite foreign key) skipped/failed: {e}")
        
    connection.commit()


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
