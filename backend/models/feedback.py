from sqlalchemy import Column, String, Integer, DateTime, JSON
from services.postgres_services import Base
import datetime

class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(String, index=True, nullable=True)
    user_id = Column(String, index=True, nullable=True)
    responses = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {column.name: getattr(self, column.name) for column in self.__table__.columns}
