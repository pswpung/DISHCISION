from services.postgres_services import Base
from sqlalchemy import Column, String, DateTime, JSON, text # Import text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

class MeetingDetail(Base):
    __tablename__ = "meeting_details"

    # server_default tells Postgres to run the function if the value is missing
    meeting_id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        server_default=text("gen_random_uuid()") 
    )
    meeting_name = Column(String, nullable=False)
    initial_data = Column(JSON, nullable=False)
    group_id = Column(String, nullable=False)
    suggestion_detail = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=False), server_default=func.now())
    updated_at = Column(DateTime(timezone=False), server_default=func.now(), onupdate=func.now())

    def to_dict(self):
        return {column.name: getattr(self, column.name) for column in self.__table__.columns}