import os

base = r"c:/Users/Sedhupathi/Desktop/technano/"

def write_file(path, content):
    full_path = os.path.join(base, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

write_file("docker-compose.yml", """version: '3.9'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: cce_db
      POSTGRES_USER: cce_user
      POSTGRES_PASSWORD: cce_pass
    ports: ["5432:5432"]
    volumes: ["postgres_data:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes: ["minio_data:/data"]

  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql+asyncpg://cce_user:cce_pass@postgres:5432/cce_db
      REDIS_URL: redis://redis:6379
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-dummy}
      JWT_SECRET: ${JWT_SECRET:-secret}
      MINIO_ENDPOINT: minio:9000
    depends_on: [postgres, redis, minio]
    volumes: ["./backend:/app"]

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    environment:
      VITE_API_URL: http://localhost:8000
    depends_on: [backend]
    volumes: ["./frontend:/app"]

volumes:
  postgres_data:
  minio_data:
""")

write_file("backend/Dockerfile", """FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
""")

write_file("frontend/Dockerfile", """FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
""")

write_file("backend/requirements.txt", """fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy[asyncio]==2.0.25
asyncpg==0.29.0
alembic==1.13.1
redis[asyncio]==5.0.1
anthropic==0.18.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
radon==6.0.1
tree-sitter==0.21.3
pydantic==2.5.3
pydantic-settings==2.1.0
weasyprint==60.2
httpx==0.26.0
psycopg2-binary
pytest
""")

write_file("backend/main.py", """from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, analyze, optimize, hints, stress_test, growth, instructor

app = FastAPI(title="CCE — Cognitive Code Evolution", version="1.0.0")

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(optimize.router, prefix="/api", tags=["optimize"])
app.include_router(hints.router, prefix="/api", tags=["hints"])
app.include_router(stress_test.router, prefix="/api", tags=["stress"])
app.include_router(growth.router, prefix="/api", tags=["growth"])
app.include_router(instructor.router, prefix="/api", tags=["instructor"])
""")

write_file("backend/core/config.py", """import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "dummy")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "secret")

settings = Settings()
""")

write_file("backend/core/database.py", """from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
""")

write_file("backend/core/redis.py", """import redis.asyncio as redis
from core.config import settings

async def get_redis():
    return redis.from_url(settings.REDIS_URL)
""")

write_file("backend/core/security.py", """from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
import uuid

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

class DummyUser:
    def __init__(self, id):
        self.id = id

async def get_current_user(token: str = Depends(oauth2_scheme)):
    # Mock auth for hackathon/demo
    return DummyUser(id="123e4567-e89b-12d3-a456-426614174000")
""")

# Models
write_file("backend/models/user.py", """from sqlalchemy import Column, String, DateTime, text
from core.database import Base
from sqlalchemy.dialects.postgresql import UUID
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
    created_at = Column(DateTime, server_default=text("NOW()"))
""")

write_file("backend/models/submission.py", """from sqlalchemy import Column, String, Float, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB
from core.database import Base
import uuid

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    language = Column(String, nullable=False)
    original_code = Column(String, nullable=False)
    time_complexity = Column(String)
    space_complexity = Column(String)
    thinking_gap_score = Column(Float, default=0.0)
    cognitive_load = Column(String)
    detected_patterns = Column(JSONB, default=list)
    submitted_at = Column(DateTime, server_default=text("NOW()"))
""")

write_file("backend/models/optimization.py", """from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB
from core.database import Base
import uuid

class Optimization(Base):
    __tablename__ = "optimizations"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String, ForeignKey("submissions.id", ondelete="CASCADE"))
    level = Column(Integer, nullable=False)
    optimized_code = Column(String, nullable=False)
    explanation = Column(JSONB, nullable=False)
    time_complexity_after = Column(String)
    space_complexity_after = Column(String)
    created_at = Column(DateTime, server_default=text("NOW()"))
""")

write_file("backend/models/student_growth.py", """from sqlalchemy import Column, String, Integer, Float, Date, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from core.database import Base
import uuid

class StudentGrowth(Base):
    __tablename__ = "student_growth"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    xp_points = Column(Integer, default=0)
    badges = Column(JSONB, default=list)
    streak_days = Column(Integer, default=0)
    last_active = Column(Date)
    avg_complexity_score = Column(Float, default=0.0)
    thinking_gap_trend = Column(JSONB, default=list)
    concept_mastery = Column(JSONB, default=dict)
""")

write_file("backend/models/hint_interaction.py", """from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, text
from core.database import Base
import uuid

class HintInteraction(Base):
    __tablename__ = "hint_interactions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String, ForeignKey("submissions.id", ondelete="CASCADE"))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    hint_level = Column(Integer, nullable=False)
    conceptual_question = Column(String)
    student_answer = Column(String)
    passed = Column(Boolean, default=False)
    confidence_before = Column(Integer)
    confidence_after = Column(Integer)
    created_at = Column(DateTime, server_default=text("NOW()"))
""")

write_file("backend/schemas/submission.py", """from pydantic import BaseModel
from typing import List, Optional, Any

class AnalyzeRequest(BaseModel):
    code: str
    language: str

class AnalyzeResponse(BaseModel):
    submission_id: str
    time_complexity: str
    space_complexity: str
    thinking_gap_score: float
    cognitive_load: str
    detected_patterns: List[Any]
    ast_summary: Any
""")

write_file("backend/routers/auth.py", """from fastapi import APIRouter
router = APIRouter()
@router.post("/login")
async def login():
    return {"access_token": "mock_token", "token_type": "bearer"}
""")

write_file("backend/routers/instructor.py", """from fastapi import APIRouter
router = APIRouter()
""")

print("Backend setup complete.")
