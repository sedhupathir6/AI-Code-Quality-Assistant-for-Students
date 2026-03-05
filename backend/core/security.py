from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

class DummyUser:
    def __init__(self, id: str):
        self.id = id

async def get_current_user(token: str = Depends(oauth2_scheme)):
    return DummyUser(id="123e4567-e89b-12d3-a456-426614174000")
