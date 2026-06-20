"""Shift model."""
import uuid
from datetime import datetime, timezone, time  # CORREGIDO
from typing import Any
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLEnum, Float, Time, Integer, Boolean, text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.core.database import Base

def utc_now_naive():
    """Devuelve la hora actual en UTC sin zona horaria para columnas TIMESTAMP WITHOUT TIME ZONE."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

class ShiftStatus(str, enum.Enum):
    PROGRAMADO = "PROGRAMADO"
    EN_CURSO = "EN_CURSO"
    COMPLETADO = "COMPLETADO"
    CANCELADO = "CANCELADO"
    INCOMPLETO = "INCOMPLETO"

class Shift(Base):
    __tablename__ = "shifts"
    
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True,
        server_default=text("gen_random_uuid()"))
    rider_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("riders.id", ondelete="CASCADE"), 
        nullable=False, 
        index=True)
    
    shift_date = Column(DateTime, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    
    check_in_at = Column(DateTime)
    check_out_at = Column(DateTime)
    
    status = Column(SQLEnum(ShiftStatus), default=ShiftStatus.PROGRAMADO)
    
    check_in_latitude = Column(Float)
    check_in_longitude = Column(Float)
    check_out_latitude = Column(Float)
    check_out_longitude = Column(Float)
    
    total_deliveries = Column(Integer, default=0)
    completed_deliveries = Column(Integer, default=0)
    total_earnings = Column(Float, default=0.0)
    
    notes = Column(String(500))
    cancellation_reason = Column(String(255))
    
    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)
    
    rider = relationship("Rider")
    check_ins = relationship("CheckInOut", back_populates="shift", cascade="all, delete-orphan")
    productivity_records = relationship("ProductivityRecord")

    def __repr__(self):
        return f"<Shift(id={self.id}, rider={self.rider_id}, date={self.shift_date})>"

class CheckInOut(Base):
    __tablename__ = "check_in_out"
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True,
        server_default=text("gen_random_uuid()"))
    rider_id = Column(UUID(as_uuid=True), ForeignKey("riders.id", ondelete="CASCADE"), nullable=False, index=True)
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="CASCADE"), nullable=True, index=True)
    check_type = Column(String(10), nullable=False)
    timestamp = Column(DateTime, default=utc_now_naive, nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)
    device_id = Column(String(255))
    ip_address = Column(String(45))
    notes = Column(String(500))
    created_at = Column(DateTime, default=utc_now_naive)
    
    rider = relationship("Rider")
    shift = relationship("Shift", back_populates="check_ins")

    def __repr__(self):
        return f"<CheckInOut(id={self.id}, rider={self.rider_id}, type={self.check_type})>"