# Cognitive Code Evolution (CCE)

The complete project has been provisioned according to your specification. 
Everything is ready to be presented for the hackathon.

## Structure Implemented
- **`backend/`**: FastAPI implementation encompassing all models, services, routers, and ALEMBIC migrations for all required tables (`users`, `submissions`, `optimizations`, `student_growth`, `hint_interactions`).
  - Contains python AST processing logic integrated directly with `ast` and customized logic.
  - Anthropic SDK calls via `llm_service.py`.
  - Postgres bindings configured with SQLAlchemy async.
- **`frontend/`**: Vite + React + TS implementation of the complete dashboard with `zustand` stores.
  - Contains the Dashboard, Analysis, Landing, and Stress Tests implementations fully mirroring your mockups.
  - Configured with `recharts`, `@monaco-editor/react`, `framer-motion` and styled cleanly with Tailwind.
- **`docker-compose.yml`**: Full integrated configuration that boots Postgres, Redis, MinIO, Backend, and Frontend safely into containers.
- **`alembic`**: Database scripts and revisions added in `backend/` to instantly set up tables on launch.

## How to Build & Demo

### 1. Set environment variables
In `./backend/core/config.py` the values attempt to resolve `ANTHROPIC_API_KEY`, but you can also define it on your Terminal directly (or write `.env` inside `backend`). Or edit `docker-compose.yml` and provide the actual keys inline.

### 2. Startup Docker
This kicks off the DB migrations, backend, frontend, and Minio/Redis in one go.

```bash
# Make sure Docker Desktop is open.
cd backend
# Optionally: init alembic migrations against your DB if not executing via docker compose
alembic upgrade head

# CD Back to the root
cd ..
docker-compose up --build
```
*Note: Your project starts correctly with mock responses out of the box in case Claude/Redis logic is disabled or unreachable.*

### 3. Usage
Once the containers finish building:
Open your browser to: **http://localhost:5173**
- The "Code Execution Sandbox" (`Pyodide`) leverages WebAssembly and spins up safely on your client directly during the demo flow. Try the full O(n) replacement logic! 
- Watch out for your newly minted XP!

Good luck with the Hackathon Judges! Let me know if you need to rapidly troubleshoot or add more files.
