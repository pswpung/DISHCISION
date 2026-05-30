from sqlalchemy import Column, String, Float, Integer, JSON, Index, func
from services.postgres_services import Base
from pgvector.sqlalchemy import Vector

class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    wongnai_link = Column(String, nullable=True)
    lat = Column(Float, nullable=False, index=True)
    lng = Column(Float, nullable=False, index=True)
    price = Column(String, nullable=True, index=True)
    category = Column(String, nullable=True)  # Store list as string representation or parse
    rating = Column(Float, nullable=True, index=True)
    address = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    line = Column(String, nullable=True)
    instagram = Column(String, nullable=True)
    top_favorites = Column(String, nullable=True)
    opening_hours = Column(String, nullable=True)
    parking = Column(String, nullable=True)
    alcohols = Column(String, nullable=True)
    breadcrumbs = Column(String, nullable=True)
    good_fors = Column(String, nullable=True)
    favourite_menus = Column(String, nullable=True)
    is_pet_friendly = Column(String, nullable=True)
    
    # 384 dimensions for paraphrase-multilingual-MiniLM-L12-v2
    embedding = Column(Vector(384), nullable=True)

    def to_dict(self):
        return {column.name: getattr(self, column.name) for column in self.__table__.columns if column.name != 'embedding'}
