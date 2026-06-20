"""Productivity models."""
import uuid
from datetime import datetime, timezone  # CORREGIDO
from typing import Any
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum as SQLEnum, Integer, text, Boolean, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
import sqlalchemy as sa
from app.core.database import Base

def utc_now_naive():
    """Devuelve la hora actual en UTC sin zona horaria (naive) para compatibilidad con PostgreSQL."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

class MetricType(str, enum.Enum):
    ENTREGAS_TOTAL = "ENTREGAS_TOTAL"
    TIEMPO_PROMEDIO = "TIEMPO_PROMEDIO"
    CALIFICACION = "CALIFICACION"
    DISTANCIA_TOTAL = "DISTANCIA_TOTAL"
    INGRESOS_TURNO = "INGRESOS_TURNO"


class ProductivityMetrics(Base):
    """Tabla de métricas de productividad consolidadas por rider y período."""
    
    __tablename__ = "productivity_metrics"
    
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        index=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    
    rider_id = Column(UUID(as_uuid=True), ForeignKey("riders.id", ondelete="CASCADE"), nullable=False, index=True)
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Métricas principales
    total_deliveries = Column(Integer, default=0)
    on_time_deliveries = Column(Integer, default=0)
    late_deliveries = Column(Integer, default=0)
    
    avg_delivery_time_minutes = Column(Float, default=0.0)
    total_distance_km = Column(Float, default=0.0)
    total_earnings = Column(Float, default=0.0)
    
    customer_rating_avg = Column(Float, default=0.0)
    customer_rating_count = Column(Integer, default=0)
    
    sla_compliance_rate = Column(Float, default=100.0)  # Porcentaje
    
    # Período
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    
    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)
    
    # Relaciones - Sin back_populates para evitar conflictos con Rider
    rider = relationship("Rider", foreign_keys=[rider_id])
    shift = relationship("Shift")
    
    __table_args__ = (
        Index('idx_productivity_metrics_rider_period', 'rider_id', 'period_start', 'period_end'),
    )
    
    def __repr__(self):
        return f"<ProductivityMetrics(id={self.id}, rider={self.rider_id}, deliveries={self.total_deliveries})>"


class SLARecord(Base):
    """Registro de cumplimiento de SLA por entrega."""
    
    __tablename__ = "sla_records"
    
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        index=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    
    rider_id = Column(UUID(as_uuid=True), ForeignKey("riders.id", ondelete="SET NULL"), nullable=True, index=True)
    delivery_id = Column(UUID(as_uuid=True), ForeignKey("deliveries.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # SLA targets
    promised_delivery_minutes = Column(Integer, nullable=False)
    actual_delivery_minutes = Column(Integer, nullable=True)
    
    # Resultado
    sla_met = Column(Boolean, default=True)
    delay_minutes = Column(Integer, default=0)
    
    # Timestamps
    promised_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=utc_now_naive)
    
    # Relaciones
    rider = relationship("Rider")
    delivery = relationship("Delivery")
    order = relationship("Order")
    
    __table_args__ = (
        Index('idx_sla_records_rider_date', 'rider_id', 'created_at'),
        Index('idx_sla_records_met', 'sla_met'),
    )
    
    def __repr__(self):
        return f"<SLARecord(id={self.id}, delivery={self.delivery_id}, sla_met={self.sla_met})>"


class ProductivityRecord(Base):
    __tablename__ = "productivity_records"
    
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        index=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()")  # <-- Clave para que PG genere el ID
    )
    rider_id = Column(UUID(as_uuid=True), ForeignKey("riders.id", ondelete="SET NULL"), nullable=False, index=True)
    shift_id = Column(UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="CASCADE"), nullable=True, index=True)
    
    metric_type: Any = Column(SQLEnum(MetricType), nullable=False)
    value = Column(Float, nullable=False)
    unit = Column(String(50))
    
    date = Column(DateTime, nullable=False)
    notes = Column(String(500))
    
    created_at = Column(DateTime, default=utc_now_naive)
    
    rider = relationship("Rider")
    shift = relationship("Shift")

    def __repr__(self):
        return f"<ProductivityRecord(id={self.id}, rider={self.rider_id}, type={self.metric_type})>"