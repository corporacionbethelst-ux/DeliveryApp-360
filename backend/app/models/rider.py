"""Rider model for delivery personnel management."""

import uuid
from datetime import datetime, timezone
from typing import Any, Optional, List
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum as SQLEnum, Boolean, JSON, Integer, Text, text, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geometry
import enum

from app.core.database import Base
from app.models.payout import Payout 
from app.models.financial import Financial
from app.models.notification import Notification
from app.models.rider_document import RiderDocument

def utc_now_naive():
    """Devuelve la hora actual en UTC sin zona horaria (naive)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

class RiderStatus(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    ACTIVO = "ACTIVO"
    INACTIVO = "INACTIVO"
    OCUPADO = "OCUPADO"
    SUSPENDIDO = "SUSPENDIDO"

class VehicleType(str, enum.Enum):
    MOTO = "MOTO"
    BICICLETA = "BICICLETA"
    PATINETA = "PATINETA"
    AUTO = "AUTO"
    FURGONETA = "FURGONETA"

class Rider(Base):
    __tablename__ = "riders"

    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True, 
        server_default=text("gen_random_uuid()")
    )

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)

    vehicle_type: Any = Column(SQLEnum(VehicleType), default=VehicleType.MOTO)
    vehicle_plate = Column(String(20))
    vehicle_model = Column(String(100))
    operating_zone = Column(String(100))
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True)
    cpf = Column(String(14))
    cnh = Column(String(20))

    status: Any = Column(SQLEnum(RiderStatus), default=RiderStatus.PENDIENTE)
    is_online = Column(Boolean, default=False)
    last_location = Column(Geometry(geometry_type='POINT', srid=4326, spatial_index=True), nullable=True)
    
    current_order_id = Column(
        UUID(as_uuid=True), 
        ForeignKey('orders.id', ondelete='SET NULL'),
        nullable=True, 
        index=True
    )

    last_lat = Column(Float, nullable=True) 
    last_lng = Column(Float, nullable=True)
    last_location_at = Column(DateTime)

    level = Column(Integer, default=1)
    total_points = Column(Integer, default=0)
    badges = Column(JSON, default=list)
    notes = Column(Text)
    documents_metadata = Column(JSON)

    approved_at = Column(DateTime)
    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)

    wallet_balance = Column(Numeric(10, 2), default=0.00)
    pending_balance = Column(Numeric(10, 2), default=0.00)
    
    # RELACIONES
    user = relationship("User", back_populates="rider_profile")
    zone = relationship("Zone", back_populates="riders", foreign_keys=[zone_id])
    deliveries = relationship("Delivery", back_populates="rider", foreign_keys="Delivery.rider_id")
    documents = relationship("RiderDocument", back_populates="rider", cascade="all, delete-orphan")
    transactions = relationship("Financial", back_populates="rider", cascade="all, delete-orphan", foreign_keys="Financial.rider_id")
    payouts = relationship("Payout", back_populates="rider", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="rider")
    
    # ELIMINADA LA RELACIÓN DIRECTA CON VEHICLE PARA EVITAR CONFLICTOS CIRCULARES
    # La asignación se maneja ahora vía User.vehicles
    
    active_order = relationship(
        "Order", 
        foreign_keys=[current_order_id],
        uselist=False,
        viewonly=True
    )
    
    # Alias relacional de compatibilidad para código legacy que aún lee financial_transactions.
    financial_transactions = relationship(
        "Financial",
        foreign_keys="Financial.rider_id",
        viewonly=True,
        overlaps="rider,transactions",
    )
    
    # Relación inversa para productivity_metrics (sin back_populates para evitar conflicto, overlaps para silenciar warning)
    productivity_metrics = relationship("ProductivityRecord", foreign_keys="ProductivityRecord.rider_id", overlaps="rider")

    def __repr__(self):
        return f"<Rider(id={self.id}, status={self.status})>"