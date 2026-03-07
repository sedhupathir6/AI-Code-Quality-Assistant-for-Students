# 🧠 Cognitive Code Evolution (CCE)

> **"We don't just optimize your code — we optimize your thinking."**

CCE is a full-stack AI-powered educational code assistant built for the **Kreative Genesis 2026 Hackathon**. It guides students from brute-force thinking to optimal problem-solving — without ever handing them the answer directly.

---

## 📸 What CCE Does

| Step | What Happens |
|------|-------------|
| 1️⃣ | Student pastes code in any language (Python / JS / Java / C++) |
| 2️⃣ | AST engine detects inefficiencies and calculates Big-O complexity |
| 3️⃣ | Thinking Gap Score shows how brute-force the student is thinking |
| 4️⃣ | Claude AI generates a fully working optimized solution in 3 levels |
| 5️⃣ | Monaco Diff shows exactly what changed — line by line |
| 6️⃣ | Hint Mentor asks a conceptual question before unlocking the next level |
| 7️⃣ | Pyodide stress test proves empirically that optimized code is faster |
| 8️⃣ | XP, badges, and Growth Dashboard track cognitive improvement over time |

---

## 🗂️ Project Structure

```
cce/
├── docker-compose.yml              # Boots all 6 services in one command
├── .env                            # API keys and config (see setup below)
├── .env.example                    # Template for environment variables
├── README.md
│
├── backend/                        # FastAPI (Python 3.11+)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                     # App entry point + CORS + router registration
│   │
│   ├── core/
│   │   ├── config.py               # Pydantic settings — reads from .env
│   │   ├── database.py             # Async SQLAlchemy engine + session
│   │   ├── redis.py                # Redis connection pool
│   │   └── security.py             # JWT creation + verification
│   │
│   ├── models/                     # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── submission.py
│   │   ├── optimization.py
│   │   ├── student_growth.py
│   │   └── hint_interaction.py
│   │
│   ├── schemas/                    # Pydantic request/response schemas
│   │   ├── user.py
│   │   ├── submission.py
│   │   ├── optimization.py
│   │   └── growth.py
│   │
│   ├── routers/                    # API route handlers
│   │   ├── auth.py                 # POST /auth/register, /auth/login
│   │   ├── analyze.py              # POST /api/analyze
│   │   ├── optimize.py             # POST /api/optimize
│   │   ├── hints.py                # POST /api/hint/answer
│   │   ├── stress_test.py          # POST /api/stress-test/run
│   │   ├── growth.py               # GET  /api/student/:id/growth
│   │   └── instructor.py           # GET  /api/instructor/:id/class-summary
│   │
│   ├── services/
│   │   ├── analyzers/
│   │   │   ├── base_analyzer.py    # Abstract base + get_analyzer() factory
│   │   │   ├── python_analyzer.py  # Python ast module + Radon
│   │   │   ├── javascript_analyzer.py  # Regex-based JS pattern detection
│   │   │   ├── java_analyzer.py    # Java pattern detection
│   │   │   └── cpp_analyzer.py     # C++ STL pattern detection
│   │   ├── llm_service.py          # Claude API calls + Redis caching + fallbacks
│   │   ├── optimization_engine.py  # 3-level optimization orchestration
│   │   ├── hint_engine.py          # Socratic question + answer validation
│   │   ├── gamification.py         # XP awards + badge unlock logic
│   │   ├── stress_test_service.py  # Judge0 API for Java/C++ execution
│   │   └── pdf_export.py           # WeasyPrint session report export
│   │
│   └── alembic/                    # Database migrations
│       ├── env.py
│       └── versions/
│           └── 001_initial_tables.py
│
└── frontend/                       # React 18 + TypeScript + Vite
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── tsconfig.json
    ├── index.html
    │
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        │
        ├── api/                    # Axios API layer
        │   ├── client.ts           # Axios instance + JWT interceptor
        │   ├── analyze.ts
        │   ├── optimize.ts
        │   ├── hints.ts
        │   ├── stressTest.ts
        │   └── growth.ts
        │
        ├── store/
        │   └── useStore.ts         # Zustand global state + demo code per language
        │
        ├── pages/
        │   ├── Landing.tsx         # Code input + language selector + Monaco Editor
        │   ├── Analysis.tsx        # Split panel — metrics + optimization + hints
        │   ├── StressTest.tsx      # Pyodide runner + Recharts scaling graph
        │   ├── Dashboard.tsx       # XP, badges, growth charts, mastery radar
        │   └── Instructor.tsx      # Class-level analytics + PDF export
        │
        ├── components/
        │   ├── layout/             # Navbar, Sidebar
        │   ├── editor/             # CodeEditor, DiffViewer, ComplexityOverlay
        │   ├── analysis/           # MetricsPanel, PatternList, ExplanationCard
        │   ├── hints/              # HintMentor, ConceptQuestion
        │   ├── stress/             # StressRunner, ScalingChart
        │   ├── dashboard/          # XPCounter, BadgeGrid, GrowthChart, MasteryRadar
        │   └── ui/                 # Button, Card, Spinner, Toast, LanguageBadge
        │
        └── types/
            └── index.ts            # Shared TypeScript interfaces
```

---

## 🔌 Port Reference

| Service | Port | URL |
|---------|------|-----|
| Frontend (React/Vite) | **5000** | http://localhost:5000 |
| Backend (FastAPI) | **5001** | http://localhost:5001 |
| Swagger API Docs | **5001** | http://localhost:5001/docs |
| PostgreSQL | **5002** | localhost:5002 |
| Redis | **5003** | localhost:5003 |
| MinIO API | **5004** | http://localhost:5004 |
| MinIO Console | **5005** | http://localhost:5005 |

---

## ⚙️ Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| API Framework | FastAPI (Python 3.11+) |
| AI / LLM | Anthropic Claude API (`claude-opus-4-6`) |
| AST Parsing | Python `ast` module, `tree-sitter`, Radon |
| Database | PostgreSQL + SQLAlchemy (async) + Alembic |
| Cache | Redis (aioredis) |
| Auth | JWT + Google OAuth |
| Code Execution | Judge0 API (Java + C++ stress tests) |
| File Storage | MinIO (S3-compatible) |
| PDF Export | WeasyPrint |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript + Vite |
| Code Editor | Monaco Editor (same engine as VS Code) |
| Styling | TailwindCSS |
| Charts | Recharts |
| Animation | Framer Motion |
| State | Zustand |
| Python Runtime | Pyodide (WebAssembly — runs Python in browser) |
| HTTP Client | Axios |

### Infrastructure
| Service | Technology |
|---------|-----------|
| Containers | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Cloud Deploy | Railway / Render |

---

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- An Anthropic API key → [console.anthropic.com](https://console.anthropic.com)
- A Judge0 RapidAPI key → [rapidapi.com/judge0](https://rapidapi.com/judge0-ce/api/judge0-ce) *(free tier, needed for Java + C++ stress tests)*

---

### Step 1 — Clone and Configure

```bash
git clone https://github.com/your-team/cce.git
cd cce
```

Create your `.env` file in the project root:

```env
# AI
ANTHROPIC_API_KEY=sk-ant-your-key-here
JUDGE0_API_KEY=your-rapidapi-key-here

# Auth
JWT_SECRET=cce_jwt_secret_minimum_32_characters_long

# Database
POSTGRES_USER=cce_user
POSTGRES_PASSWORD=cce_pass
POSTGRES_DB=cce_db
DATABASE_URL=postgresql+asyncpg://cce_user:cce_pass@postgres:5432/cce_db

# Cache
REDIS_URL=redis://redis:6379

# Frontend
VITE_API_URL=http://localhost:5001
```

---

### Step 2 — Run Database Migrations (first time only)

```bash
cd backend
alembic upgrade head
cd ..
```

---

### Step 3 — Start All Services

```bash
docker-compose up --build
```

<<<<<<< HEAD
### 3. Usage
Once the containers finish building:
Open your browser to: **http://localhost:5000**
- The "Code Execution Sandbox" (`Pyodide`) leverages WebAssembly and spins up safely on your client directly during the demo flow. Try the full O(n) replacement logic! 
- Watch out for your newly minted XP!
=======
This starts all 6 services simultaneously:
>>>>>>> 10a84d6d7e330b3da6217df88a3145ae1db78ec0

```
✅  postgres   → localhost:5002
✅  redis      → localhost:5003
✅  minio      → localhost:5004 / 5005
✅  backend    → localhost:5001
✅  frontend   → localhost:5000
```

---

### Step 4 — Open the App

```
http://localhost:5000
```

---

## 🗄️ Database Schema

```
users
  id (UUID PK) · name · email · role · oauth_provider · created_at

submissions
  id (UUID PK) · user_id (FK) · language · original_code
  time_complexity · space_complexity · thinking_gap_score
  cognitive_load · detected_patterns (JSONB) · submitted_at

optimizations
  id (UUID PK) · submission_id (FK) · level (1/2/3)
  optimized_code · explanation (JSONB)
  time_complexity_after · space_complexity_after · language

student_growth
  id (UUID PK) · user_id (FK UNIQUE) · xp_points · badges (JSONB)
  streak_days · last_active · thinking_gap_trend (JSONB)
  concept_mastery (JSONB)

hint_interactions
  id (UUID PK) · submission_id (FK) · user_id (FK)
  hint_level (1/2/3) · conceptual_question · student_answer
  passed · confidence_before · confidence_after
```

**Relationships:**
```
users ──< submissions ──< optimizations
                     └──< hint_interactions
users ──── student_growth (1:1)
```

---

## 🌐 API Endpoints

```
AUTH
  POST  /auth/register
  POST  /auth/login
  GET   /auth/google/callback

ANALYSIS
  POST  /api/analyze                     → AST + complexity + patterns
  POST  /api/optimize                    → Claude AI optimized solution
  POST  /api/hint/answer                 → Validate conceptual answer

STRESS TEST
  POST  /api/stress-test/run             → Pyodide (Python/JS) or Judge0 (Java/C++)
  POST  /api/stress-test/save            → Store results + detect scaling curve

GROWTH
  GET   /api/student/:user_id/growth     → XP, badges, trend charts
  POST  /api/student/:user_id/xp         → Award XP for an action

INSTRUCTOR
  GET   /api/instructor/:id/class-summary
  GET   /api/instructor/export-pdf/:user_id
```

Full interactive docs at: **http://localhost:5001/docs**

---

## 🧩 The 7 Core Modules

```
Module 1  ── Code Analysis Engine       AST parsing + pattern detection
Module 2  ── Optimization Engine        3-level optimized solution generator
Module 3  ── Explanation Generator      Claude AI 4-part structured explanation
Module 4  ── Before/After Diff Viewer   Monaco diff + inline complexity annotations
Module 5  ── Stress Test Simulator      Pyodide/Judge0 empirical Big-O proof
Module 6  ── Student Growth Tracker     XP, badges, streaks, Thinking Gap trend
Module 7  ── Adaptive Hint Mentor       Socratic gating — question before answer
```

---

## 🎮 Gamification

### XP Awards
| Action | XP |
|--------|----|
| First submission | +10 |
| Level 1 optimization | +20 |
| Level 2 optimization | +40 |
| Level 3 optimization | +80 |
| Correct conceptual answer | +15 |
| Stress test completed | +25 |
| O(n²) → O(n) improvement | **+100** |
| O(n) → O(log n) improvement | **+150** |
| 7-day streak bonus | +50 |

### Badges
| Badge | Condition |
|-------|-----------|
| 🗡️ Loop Slayer | First nested loop eliminated |
| 🗺️ Hash Map Hero | 3 hashmap optimizations applied |
| 🔄 Recursion Wizard | Memoization applied to recursive code |
| 📊 Big-O Believer | 10 total submissions analyzed |
| 🔥 Streak Master | 7 consecutive active days |
| 👑 Efficiency King | Average complexity at O(n) or better |
| 🧬 DNA Evolver | Thinking Gap Score improved by 50+ points |
| 🎯 Pattern Hunter | 5 different anti-patterns identified |

---

## 🔬 Language Support

| Language | AST Method | Stress Test | Detected Patterns |
|----------|-----------|-------------|-------------------|
| 🐍 Python | `ast` module + Radon | Pyodide (browser) | Nested loops, linear search, recursion without memo, list append in loop |
| ⚡ JavaScript | Regex pattern analysis | Browser `eval` sandbox | `indexOf` in loop, `var` usage, nested loops, push in loop |
| ☕ Java | Regex pattern analysis | Judge0 API | `List.contains()` in loop, String `+=` in loop, nested loops |
| ⚙️ C++ | Regex pattern analysis | Judge0 API | `std::find` in loop, pass-by-value containers, nested loops |

---

## 🎬 Demo Script (for Judges)

Paste this into the editor when Python is selected:

```python
def find_duplicates(arr):
    duplicates = []
    for i in range(len(arr)):
        for j in range(i + 1, len(arr)):
            if arr[i] == arr[j] and arr[i] not in duplicates:
                duplicates.append(arr[i])
    return duplicates
```

**Expected flow:**

```
Click "Analyze" →  O(n²) detected, Thinking Gap: 78/100, Cognitive Load: High
                   Nested loop highlighted in RED

Click "Get Hint" →  "What data structure gives O(1) lookup time?"
Type "hashmap"   →  Correct! Level 2 unlocked. +15 XP

Click Level 2    →  Claude returns set-based Python solution
                    Monaco diff shows exactly what changed
                    Complexity: O(n²) → O(n)

Run Stress Test  →  Pyodide runs both versions up to n=10,000
                    Chart shows original: steep curve | optimized: flat line

Dashboard        →  +100 XP awarded, "Loop Slayer" badge unlocked 🗡️
                    Thinking Gap drops: 78 → 45
```

---

## 🏆 What Makes CCE Different

| Tool | Approach | CCE's Difference |
|------|----------|-----------------|
| GitHub Copilot | Completes code for you | Never completes — always guides first |
| ESLint / Pylint | Flags style errors | Explains WHY and teaches the concept |
| LeetCode | Practice problems | Takes YOUR code and improves YOUR thinking |
| ChatGPT | Gives the answer | Gates the answer behind understanding |
| **CCE** | — | Measures **cognitive growth**, not just code quality |

---

## 📦 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | Claude API key from console.anthropic.com |
| `JUDGE0_API_KEY` | ⚠️ For Java/C++ | RapidAPI key for Judge0 code execution |
| `JWT_SECRET` | ✅ Yes | Min 32 character secret string |
| `DATABASE_URL` | ✅ Yes | PostgreSQL async connection string |
| `REDIS_URL` | ✅ Yes | Redis connection string |
| `VITE_API_URL` | ✅ Yes | Backend URL seen by the browser |

> **Note:** The project works out of the box with mock responses if `ANTHROPIC_API_KEY` is not set — useful for UI/UX demo without API costs.

---

## 🛠️ Useful Commands

```bash
# Start everything
docker-compose up --build

# Stop everything
docker-compose down

# View backend logs
docker-compose logs -f backend

# View frontend logs
docker-compose logs -f frontend

# Re-run migrations
docker-compose exec backend alembic upgrade head

# Open PostgreSQL shell
docker-compose exec postgres psql -U cce_user -d cce_db

# Flush Redis cache
docker-compose exec redis redis-cli FLUSHALL

# Rebuild only backend (after code change)
docker-compose up --build backend

# Rebuild only frontend
docker-compose up --build frontend
```

---

## 👥 Team

**Team ID:** KG-2026
**Team Name:** CCE Team
**Domain:** AI-Powered EdTech / Code Quality
**Hackathon:** Kreative Genesis 2026 — Checkpoint 1

---

## 📄 License

MIT License — built for Kreative Genesis 2026 Hackathon.

---

<div align="center">

**🧠 Cognitive Code Evolution**

*Existing AI tools optimize your code.*
*CCE optimizes your thinking.*

</div>
