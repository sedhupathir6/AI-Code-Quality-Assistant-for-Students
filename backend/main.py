from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.database import engine, Base
from routers import auth, analyze, optimize, hints, stress_test, growth, instructor

app = FastAPI(title="Cognitive Code Evolution (CCE)", version="1.0.0")

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
app.include_router(stress_test.router, prefix="/api", tags=["stress_test"])
app.include_router(growth.router, prefix="/api", tags=["growth"])
app.include_router(instructor.router, prefix="/api", tags=["instructor"])


@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/")
def read_root():
    return {"message": "CCE API running."}
