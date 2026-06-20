"""
Delivery360 - Main Application Entry Point
FastAPI application with full configuration
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from fastapi.staticfiles import StaticFiles
from typing import AsyncGenerator
from pathlib import Path
import logging

from app.core.config import settings
from app.core.database import engine, Base
from app.core.exception_handlers import register_exception_handlers
from app.api.v1 import (
    auth, users, roles, riders, orders, deliveries,
    shifts, productivity, financial, dashboard,
    routes, alerts, integrations, audit, settings as settings_router, payouts,
    vehicles, zones
)
from app.middleware import RateLimitMiddleware, AuditLogMiddleware
from app.monitoring.health_check import health_router
from app.monitoring.metrics import metrics_router

from geoalchemy2 import load_spatialite_gpkg

logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Gestor del ciclo de vida de la aplicación (startup/shutdown)."""
    logger.info("Starting Delivery360 API...")

    if settings.ENVIRONMENT == "development":
        logger.info("Creating database tables...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    logger.info("Delivery360 API started successfully")
    yield

    logger.info("Shutting down Delivery360 API...")
    await engine.dispose()
    logger.info("Database connections closed")


def create_app() -> FastAPI:
    """Factory para crear y configurar la aplicación FastAPI."""

    app = FastAPI(
        title="Delivery360 API",
        description="Sistema completo de gestión de entregas",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan
    )

    # --- SEGURIDAD Y MIDDLEWARES ---
    from app.middleware.cors_middleware import setup_cors_middleware, get_security_headers
    from fastapi.middleware.trustedhost import TrustedHostMiddleware

    setup_cors_middleware(app)

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        for header, value in get_security_headers().items():
            response.headers[header] = value
        return response

    if settings.ENVIRONMENT == "production":
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["api.delivery360.com", "*.delivery360.com", "localhost", "127.0.0.1"]
        )

    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(AuditLogMiddleware)

    # Configurar middleware de caché para optimización
    from app.middleware.cache_middleware import setup_cache_middleware
    setup_cache_middleware(app)

    register_exception_handlers(app)

    # --- REGISTRO DE ROUTERS ---
    app.include_router(auth.router, prefix="/api/v1", tags=["Auth"])
    # Routers without an internal prefix must be mounted under their resource path.
    # Otherwise their generic /{item_id} routes catch requests like /api/v1/vehicles.
    app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
    app.include_router(roles.router, prefix="/api/v1", tags=["Roles"])
    app.include_router(riders.router, prefix="/api/v1", tags=["Riders"])
    app.include_router(orders.router, prefix="/api/v1", tags=["Orders"])
    app.include_router(deliveries.router, prefix="/api/v1", tags=["Deliveries"])
    app.include_router(vehicles.router, prefix="/api/v1", tags=["Vehicles"])
    app.include_router(zones.router, prefix="/api/v1", tags=["Zones"])
    app.include_router(shifts.router, prefix="/api/v1/shifts", tags=["Shifts"])
    app.include_router(productivity.router, prefix="/api/v1/productivity", tags=["Productivity"])
    app.include_router(financial.router, prefix="/api/v1", tags=["Financial"])
    app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
    app.include_router(routes.router, prefix="/api/v1/routes", tags=["Routes"])
    app.include_router(alerts.router, prefix="/api/v1", tags=["Alerts"])
    app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["Integrations"])
    app.include_router(audit.router, prefix="/api/v1/audit", tags=["Audit"])
    app.include_router(settings_router.router, prefix="/api/v1", tags=["Settings"])
    app.include_router(health_router, prefix="/health", tags=["Health"])
    app.include_router(metrics_router, prefix="/metrics", tags=["Metrics"])
    app.include_router(payouts.router, prefix="/api/v1", tags=["Payouts"])

    # --- ARCHIVOS ESTÁTICOS (DOCUMENTOS E IMÁGENES) ---
    uploads_path = Path("uploads")
    uploads_path.mkdir(exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")
    logger.info(f"Archivos estáticos servidos desde: {uploads_path.absolute()}")

    # --- ENDPOINTS RAÍZ ---
    @app.get("/", tags=["Root"])
    async def root():
        return {
            "success": True,
            "message": "Bienvenido a Delivery360 API",
            "version": "1.0.0",
            "documentation": "/docs",
            "health": "/health/check",
            "metrics": "/metrics",
            "uploads": "/uploads"
        }

    @app.get("/ping", tags=["Root"])
    async def ping():
        return {"success": True, "message": "pong"}

    return app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower()
    )
