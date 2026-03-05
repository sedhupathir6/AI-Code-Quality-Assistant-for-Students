import redis.asyncio as aioredis
from core.config import settings

_redis = None

async def get_redis():
    global _redis
    if _redis is None:
        try:
            _redis = aioredis.from_url(settings.REDIS_URL)
        except Exception:
            _redis = FakeRedis()
    return _redis

class FakeRedis:
    """Fallback in-memory cache when Redis is not available."""
    def __init__(self):
        self._store = {}
    async def get(self, key):
        return self._store.get(key)
    async def setex(self, key, ttl, value):
        self._store[key] = value
    async def set(self, key, value):
        self._store[key] = value
