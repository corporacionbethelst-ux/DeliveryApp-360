"""Endpoints dedicados a telemetría y tiempo real de alta frecuencia."""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.rider import Rider, utc_now_naive
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.rider_location import HeartbeatRequest

router = APIRouter(prefix="/telemetry", tags=["Telemetría"])

@router.post("/riders/{rider_id}/heartbeat")
async def rider_heartbeat(
    rider_id: str,
    payload: HeartbeatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint optimizado para actualizaciones frecuentes de ubicación.
    Similar al existente en riders.py pero diseñado para alta concurrencia.
    """
    try:
        rider_uuid = uuid.UUID(rider_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de repartidor inválido")

    # Obtener rider
    result = await db.execute(select(Rider).where(Rider.id == rider_uuid))
    rider = result.scalar_one_or_none()

    if not rider:
        raise HTTPException(status_code=404, detail="Repartidor no encontrado")

    # Validar propiedad (solo el propio rider o admin pueden enviar datos)
    if current_user.role.value != "SUPERADMIN" and current_user.role.value != "GERENTE":
        if rider.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="No autorizado para actualizar este repartidor")

    # Actualizar datos críticos
    rider.last_lat = payload.lat
    rider.last_lng = payload.lng
    rider.last_location = func.ST_SetSRID(func.ST_MakePoint(payload.lng, payload.lat), 4326)
    rider.last_location_at = utc_now_naive()
    rider.is_online = True
    
    # Opcional: Guardar velocidad o dirección si tu modelo lo soporta en columnas separadas
    # rider.speed = payload.speed 

    await db.commit()

    return {"status": "ok", "timestamp": rider.last_location_at}