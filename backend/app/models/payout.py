"""Payout model for rider withdrawal requests."""

import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLEnum, Numeric, Text, text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.core.database import Base

def utc_now_naive():
    """Devuelve la hora actual en UTC sin zona horaria (naive)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

class PayoutStatus(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    PROCESADO = "PROCESADO"
    RECHAZADO = "RECHAZADO"
    CANCELADO = "CANCELADO"

class PayoutMethod(str, enum.Enum):
    TRANSFERENCIA = "TRANSFERENCIA"
    EFECTIVO = "EFECTIVO"
    BILLETERA_DIGITAL = "BILLETERA_DIGITAL"

class Payout(Base):
    __tablename__ = "payouts"

    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True, 
        server_default=text("gen_random_uuid()")
    )

    rider_id = Column(UUID(as_uuid=True), ForeignKey("riders.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Datos del retiro
    amount = Column(Numeric(10, 2), nullable=False)
    status: Any = Column(SQLEnum(PayoutStatus), default=PayoutStatus.PENDIENTE)
    method: Any = Column(SQLEnum(PayoutMethod), default=PayoutMethod.TRANSFERENCIA)
    
    # Información bancaria (opcional, podría venir de una tabla separada)
    bank_account_last4 = Column(String(10), nullable=True)
    reference_code = Column(String(50), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    idempotency_key = Column(String(100), unique=True, nullable=True, index=True)

    # Trazabilidad contable y de auditoría
    balance_before = Column(Numeric(10, 2), nullable=True)
    balance_after = Column(Numeric(10, 2), nullable=True)
    requested_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    processed_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    
    # Fechas
    requested_at = Column(DateTime, default=utc_now_naive)
    processed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)
    
    # Relación
    rider = relationship("Rider", back_populates="payouts")
    status_history = relationship("PayoutStatusHistory", back_populates="payout", cascade="all, delete-orphan", order_by="PayoutStatusHistory.created_at")

    def __repr__(self):
        return f"<Payout(id={self.id}, rider={self.rider_id}, amount={self.amount}, status={self.status})>"


class PayoutStatusHistory(Base):
    """Historial auditable de cambios de estado de retiros."""

    __tablename__ = "payout_status_history"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    payout_id = Column(UUID(as_uuid=True), ForeignKey("payouts.id", ondelete="CASCADE"), nullable=False, index=True)
    old_status = Column(String(30), nullable=True)
    new_status = Column(String(30), nullable=False)
    reason = Column(Text, nullable=True)
    changed_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    balance_before = Column(Numeric(10, 2), nullable=True)
    balance_after = Column(Numeric(10, 2), nullable=True)
    created_at = Column(DateTime, default=utc_now_naive, index=True)

    payout = relationship("Payout", back_populates="status_history")

    __table_args__ = (
        Index("idx_payout_status_history_payout_date", "payout_id", "created_at"),
    )

    def __repr__(self):
        return f"<PayoutStatusHistory(payout={self.payout_id}, new_status={self.new_status})>"
