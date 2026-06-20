"""
Delivery360 - Modelo de Alerta (Alias de Notification para compatibilidad)
Las alertas operacionales se almacenan en la tabla de notificaciones con tipo específico.
"""
from datetime import datetime
from typing import Optional, Dict, Any
import uuid as uuid_pkg

from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, Enum as SQLEnum, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, Mapped, mapped_column
from enum import Enum

from app.core.database import Base


class AlertSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class AlertStatus(str, Enum):
    NUEVA = "NUEVA"
    EN_PROCESO = "EN_PROCESO"
    RESUELTA = "RESUELTA"
    DESCARTADA = "DESCARTADA"


class AlertType(str, Enum):
    RETRASO_SLA = "RETRASO_SLA"
    ENTREGA_FALLIDA = "ENTREGA_FALLIDA"
    INCIDENCIA_VEHICULO = "INCIDENCIA_VEHICULO"
    SISTEMA = "SISTEMA"
    PAGO = "PAGO"
    RIDER = "RIDER"


class Alert(Base):
    """Modelo de Alerta Operacional"""
    __tablename__ = "alerts"

    id: Mapped[uuid_pkg.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid_pkg.uuid4
    )

    # Tipo y Severidad
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # Contenido
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Estado
    status: Mapped[str] = mapped_column(String(20), default=AlertStatus.NUEVA.value, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Relaciones (Opcionales)
    order_id: Mapped[Optional[uuid_pkg.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True)
    rider_id: Mapped[Optional[uuid_pkg.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("riders.id"), nullable=True)
    user_id: Mapped[Optional[uuid_pkg.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Metadata extra (JSON)
    metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)

    # Fechas
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[Optional[uuid_pkg.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Relaciones ORM
    order = relationship("Order", back_populates="alerts")
    rider = relationship("Rider", back_populates="alerts")
    user = relationship("User", back_populates="alerts")