from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Boolean, ForeignKeyConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from services.postgres_services import Base
import uuid

class MeetingAttendee(Base):
    __tablename__ = "meeting_attendees"

    # Since there's no PK in your SQL, we use a composite PK for SQLAlchemy
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meeting_details.meeting_id"), primary_key=True)
    user_id = Column(String, primary_key=True)
    group_id = Column(String)
    avaliable_at = Column(JSON, nullable=True)
    preference = Column(JSON, nullable=True)
    is_key_person = Column(Boolean, default=False)
    is_joined = Column(Boolean, default=False)

    __table_args__ = (
        ForeignKeyConstraint(
            ['user_id', 'group_id'],
            ['user_details.user_id', 'user_details.group_id'],
            name="fk_meeting_attendees_user_details"
        ),
    )

    def to_dict(self):
        return {column.name: getattr(self, column.name) for column in self.__table__.columns}