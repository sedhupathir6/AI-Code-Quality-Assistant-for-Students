from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, text
from core.database import Base
import uuid

class HintInteraction(Base):
    __tablename__ = "hint_interactions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String, ForeignKey("submissions.id", ondelete="CASCADE"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    hint_level = Column(Integer, nullable=False)
    conceptual_question = Column(Text)
    student_answer = Column(Text)
    passed = Column(Boolean, default=False)
    confidence_before = Column(Integer)
    confidence_after = Column(Integer)
    created_at = Column(DateTime, server_default=text("(datetime('now'))"))
