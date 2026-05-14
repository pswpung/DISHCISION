import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

# If using the Docker Compose setup from earlier:
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:P%40ssw0rd@localhost:54321/postgres")

# Create the engine
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Create a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for your models to inherit from
Base = declarative_base()

# This is the function you were asking about!
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

