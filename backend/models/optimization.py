from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, text, JSON
from core.database import Base
import uuid

class Optimization(Base):
    __tablename__ = "optimizations"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String, ForeignKey("submissions.id", ondelete="CASCADE"))
    level = Column(Integer, nullable=False)
    optimized_code = Column(Text, nullable=False)
    explanation = Column(JSON, nullable=False)
    time_complexity_after = Column(String)
    space_complexity_after = Column(String)
    created_at = Column(DateTime, server_default=text("(datetime('now'))"))
