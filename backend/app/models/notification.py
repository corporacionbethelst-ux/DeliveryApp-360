"""Notification and Alert models."""

import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
import sqlalchemy as sa

from app.core.database import Base

def utc_now_naive():
    """Devuelve la hora actual en UTC sin zona horaria (naive)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

class NotificationType(str, enum.Enum):
    ALERTA_OPERACIONAL = "ALERTA_OPERACIONAL"
    ASIGNACION_PEDIDO = "ASIGNACION_PEDIDO"
    ESTADO_ENTREGA = "ESTADO_ENTREGA"
    RECORDATORIO = "RECORDATORIO"
    LOGRO = "LOGRO"
    SISTEMA = "SISTEMA"
    URGENTE = "URGENTE"

class NotificationPriority(str, enum.Enum):
    BAJA = "BAJA"
    NORMAL = "NORMAL"
    ALTA = "ALTA"
    CRITICA = "CRITICA"

class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    READ = "READ"

class Notification(Base):
    """Tabla de notificaciones para usuarios y riders."""
    
    __tablename__ = "notifications"
    
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        index=True,
        default=uuid.uuid4,
        server_default=sa.text("gen_random_uuid()")
    )
    
    # Destinatarios (puede ser usuario, rider o ambos)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    rider_id = Column(UUID(as_uuid=True), ForeignKey("riders.id"), index=True)
    
    # Contenido
    notification_type: Any = Column(SQLEnum(NotificationType), nullable=False)
    priority: Any = Column(SQLEnum(NotificationPriority), default=NotificationPriority.NORMAL)
    
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    data = Column(sa.JSON) # Datos extra para la UI
    
    # Canales de envío
    channels = Column(String(100)) # Ej: "email,push,sms"
    sent_channels = Column(String(100))
    
    # Estado
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime)
    is_sent = Column(Boolean, default=False)
    sent_at = Column(DateTime)
    failed_channels = Column(String(100))
    error_message = Column(Text)
    
    # Acción asociada
    action_url = Column(String(500))
    action_type = Column(String(50))
    
    # Relación genérica a otros recursos
    related_type = Column(String(50))
    related_id = Column(String(100))
    
    # Programación
    scheduled_for = Column(DateTime)
    expires_at = Column(DateTime)
    
    created_at = Column(DateTime, default=utc_now_naive, index=True)
    
    # Relaciones
    user = relationship("User", back_populates="notifications")
    rider = relationship("Rider", back_populates="notifications")

    __table_args__ = (
        Index('idx_notifications_user_date', 'user_id', 'created_at'),
        Index('idx_notifications_rider_date', 'rider_id', 'created_at'),
    )

    def __repr__(self):
        return f"<Notification(id={self.id}, type={self.notification_type})>"


class Alert(Base):
    """Tabla de alertas operativas del sistema."""
    
    __tablename__ = "alerts"
    
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        index=True,
        default=uuid.uuid4,
        server_default=sa.text("gen_random_uuid()")
    )
    
    alert_type = Column(String(50), nullable=False)
    severity = Column(String(20)) # LOW, MEDIUM, HIGH, CRITICAL
    title = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Entidades relacionadas
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), index=True)
    delivery_id = Column(UUID(as_uuid=True), ForeignKey("deliveries.id"), index=True)
    rider_id = Column(UUID(as_uuid=True), ForeignKey("riders.id"), index=True)
    
    # Estado de resolución
    status = Column(String(20), default="OPEN") # OPEN, ACKNOWLEDGED, RESOLVED
    
    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    acknowledged_at = Column(DateTime)
    
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    resolved_at = Column(DateTime)
    resolution_notes = Column(Text)
    
    auto_resolve_at = Column(DateTime)
    auto_resolved = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=utc_now_naive, index=True)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)
    
    # Relaciones
    order = relationship("Order")
    delivery = relationship("Delivery")
    rider = relationship("Rider")
    user_ack = relationship("User", foreign_keys=[acknowledged_by])
    user_res = relationship("User", foreign_keys=[resolved_by])

    def __repr__(self):
        return f"<Alert(id={self.id}, type={self.alert_type}, status={self.status})>"