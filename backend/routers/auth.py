from fastapi import APIRouter

router = APIRouter()


@router.post("/login")
async def login():
    return {"access_token": "mock_demo_token", "token_type": "bearer"}


@router.post("/register")
async def register():
    return {"access_token": "mock_demo_token", "token_type": "bearer"}
