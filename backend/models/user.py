from sqlalchemy import Column, String, DateTime, text
from core.database import Base
import uuid

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String)
    role = Column(String, default='student')
    oauth_provider = Column(String)
    avatar_url = Column(String)
    created_at = Column(DateTime, server_default=text("(datetime('now'))"))
