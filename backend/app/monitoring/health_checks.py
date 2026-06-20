"""
Health Checks para monitoreo del sistema
"""
from fastapi import APIRouter
from sqlalchemy.ext.asyncio import create_async_engine
from typing import Dict, Any
import time
import redis
from app.core.config import settings

# Crear engine para health checks
if settings.DATABASE_URL.startswith("postgresql://"):
    ASYNC_DB_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    ASYNC_DB_URL = settings.DATABASE_URL

engine = create_async_engine(ASYNC_DB_URL, pool_pre_ping=True)

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/check")
async def health_check():
    """Health check básico - solo verifica que la app esté corriendo"""
    return {"status": "healthy", "timestamp": time.time()}


@router.get("/ready")
async def readiness_check():
    """
    Readiness check - verifica que la app esté lista para recibir tráfico
    Verifica conexión a base de datos y Redis
    """
    from sqlalchemy import text
    checks: Dict[str, Any] = {
        "database": False,
        "redis": False,
        "timestamp": time.time()
    }
    
    # Verificar base de datos
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception as e:
        checks["database_error"] = str(e)
    
    # Verificar Redis
    try:
        redis_client = redis.from_url(settings.REDIS_URL)
        redis_client.ping()
        checks["redis"] = True
    except Exception as e:
        checks["redis_error"] = str(e)
    
    all_healthy = all([checks["database"], checks["redis"]])
    
    return {
        "status": "ready" if all_healthy else "not_ready",
        "checks": checks
    }


@router.get("/live")
async def liveness_check():
    """
    Liveness check - verifica que la app no esté en deadlock
    Usado por Kubernetes para restart automático
    """
    return {
        "status": "alive",
        "timestamp": time.time(),
        "uptime_seconds": time.time() - start_time
    }


start_time = time.time()
