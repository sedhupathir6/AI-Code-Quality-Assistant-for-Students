from sqlalchemy import Column, String, Integer, Float, Date, ForeignKey, JSON
from core.database import Base
import uuid

class StudentGrowth(Base):
    __tablename__ = "student_growth"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    xp_points = Column(Integer, default=0)
    badges = Column(JSON, default=list)
    streak_days = Column(Integer, default=0)
    last_active = Column(Date)
    avg_complexity_score = Column(Float, default=0.0)
    thinking_gap_trend = Column(JSON, default=list)
    concept_mastery = Column(JSON, default=dict)
