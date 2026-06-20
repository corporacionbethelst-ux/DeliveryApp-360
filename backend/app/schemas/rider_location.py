"""Schemas para telemetría y ubicación de repartidores."""

from pydantic import BaseModel, Field
from typing import Optional

class LocationUpdate(BaseModel):
    """Actualización básica de coordenadas GPS."""
    lat: float = Field(..., ge=-90, le=90, description="Latitud")
    lng: float = Field(..., ge=-180, le=180, description="Longitud")

class HeartbeatRequest(LocationUpdate):
    """
    Payload completo para el heartbeat del repartidor.
    Incluye ubicación y metadatos del dispositivo.
    """
    accuracy: Optional[float] = Field(None, ge=0, description="Precisión en metros")
    speed: Optional[float] = Field(None, ge=0, description="Velocidad en m/s")
    battery_level: Optional[int] = Field(None, ge=0, le=100, description="Nivel de batería %")
    heading: Optional[float] = Field(None, ge=0, le=360, description="Dirección en grados")