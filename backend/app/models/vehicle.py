# app/models/vehicle.py
from sqlalchemy import Column, String, Integer, Date, Text, ForeignKey, DateTime, Enum as SQLEnum, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

# Importar los enums compartidos
from app.models.enums import VehicleType, VehicleStatus
# Importar Base desde database para mantener consistencia con el resto de modelos
from app.core.database import Base

def utc_now_naive():
    return datetime.now(timezone.utc).replace(tzinfo=None)

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Definición correcta de Enums en SQL: pasar los valores (.value) como argumentos
    type = Column(SQLEnum(*[e.value for e in VehicleType], name='vehicletype', create_type=True), nullable=False)
    status = Column(SQLEnum(*[e.value for e in VehicleStatus], name='vehiclestatus', create_type=True), nullable=False, default='ACTIVO')
    
    plate = Column(String(20), unique=True, index=True, nullable=False)
    model = Column(String(100), nullable=False)
    color = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False)
    
    insurance_expiry = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Clave foránea hacia Users (no hacia Riders directamente, ya que el vehículo lo posee la persona/usuario)
    rider_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("users.id", ondelete="SET NULL", use_alter=True), # use_alter ayuda con ciclos
        nullable=True
    )
    
    # Relación: Un vehículo pertenece a un Usuario (que puede ser repartidor)
    # ✅ CORRECCIÓN: Eliminar back_populates para evitar circularidad.
    # La relación es unidireccional desde Vehicle hacia User.
    rider = relationship("User", foreign_keys=[rider_id], lazy="select")

    created_at = Column(DateTime(timezone=False), default=utc_now_naive, nullable=False)
    updated_at = Column(DateTime(timezone=False), default=utc_now_naive, onupdate=utc_now_naive, nullable=True)

    # Índice compuesto útil para búsquedas
    __table_args__ = (
        Index('ix_vehicles_status_plate', 'status', 'plate'),
    )