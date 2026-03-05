from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, text, JSON
from core.database import Base
import uuid

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    language = Column(String, nullable=False)
    original_code = Column(Text, nullable=False)
    time_complexity = Column(String)
    space_complexity = Column(String)
    thinking_gap_score = Column(Float, default=0.0)
    cognitive_load = Column(String)
    detected_patterns = Column(JSON, default=list)
    submitted_at = Column(DateTime, server_default=text("(datetime('now'))"))
