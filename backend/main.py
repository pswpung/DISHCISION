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
Base.metadata.create_all(bind=engine)

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
