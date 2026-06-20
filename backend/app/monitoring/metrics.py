"""Prometheus metrics endpoint"""
from fastapi import APIRouter, Response
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

metrics_router = APIRouter()


@metrics_router.get("", tags=["Metrics"])
async def metrics():
    """Expose Prometheus metrics"""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )
