from sqlalchemy import Column, String
from services.postgres_services import Base

class UserDetail(Base):
    __tablename__ = "user_details"

    user_id = Column(String, primary_key=True, index=True)
    display_name = Column(String, nullable=False)
    pictureurl = Column(String, nullable=False)
    group_id = Column(String, nullable=True)

    def to_dict(self):
        return {column.name: getattr(self, column.name) for column in self.__table__.columns}