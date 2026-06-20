"""Health check endpoints"""
from fastapi import APIRouter
from sqlalchemy import text
from app.core.database import engine

router = APIRouter()


@router.get("/check", tags=["Health"])
async def health_check():
    """Basic health check"""
    return {"status": "healthy", "service": "delivery360-api"}


@router.get("/ready", tags=["Health"])
async def readiness_check():
    """Readiness check with database connectivity"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return {"status": "not_ready", "database": "disconnected", "error": str(e)}


@router.get("/live", tags=["Health"])
async def liveness_check():
    """Liveness probe"""
    return {"status": "alive"}


# Alias for backward compatibility
health_router = router
health_check_router = router
