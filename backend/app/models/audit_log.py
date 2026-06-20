"""AuditLog model for tracking system actions and compliance."""

from datetime import datetime, timezone
from typing import Any
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLEnum, Text, text, Boolean, JSON, Index, Float, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.core.database import Base

def utc_now_naive():
    """Devuelve la hora actual en UTC sin zona horaria (naive) para compatibilidad con PostgreSQL."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

# CORRECCIÓN CRÍTICA: Definir el ENUM antes de usarlo en la clase
class ActionType(str, enum.Enum):
    """Types of auditable actions."""
    LOGIN = "login"
    LOGOUT = "logout"
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    ASSIGN = "assign"
    REASSIGN = "reassign"
    STATUS_CHANGE = "status_change"
    PAYMENT = "payment"
    EXPORT = "export"
    IMPORT = "import"
    CONFIG_CHANGE = "config_change"
    ACCESS_DENIED = "access_denied"


class AuditLog(Base):
    """Audit log for tracking all system actions (LGPD compliance)."""
    
    __tablename__ = "audit_logs"
    
    # CORRECCIÓN: El ID debe ser UUID
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        index=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()")  # <-- Clave para que PG genere el ID
    )
    
    # Actor Information
    # CORRECCIÓN: user_id debe ser UUID para coincidir con users.id
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    
    user_email = Column(String(255))
    user_role = Column(String(50))
    
    # Action Details
    # Ahora ActionType ya está definido arriba
    action_type: Any = Column(SQLEnum(ActionType), nullable=False, index=True)
    resource_type = Column(String(50), index=True)
    
    # Resource ID genérico (String es más seguro si apunta a varias tablas)
    resource_id = Column(String(100), index=True) 

    description = Column(Text)
    old_values = Column(JSON)
    new_values = Column(JSON)
    changes_summary = Column(String(500))
    
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    request_method = Column(String(10))
    request_path = Column(String(255))
    
    latitude = Column(Float)
    longitude = Column(Float)
    
    status_code = Column(Integer)
    success = Column(Boolean, default=True)
    error_message = Column(Text)
    
    contains_personal_data = Column(Boolean, default=False)
    data_subject_id = Column(Integer)
    retention_until = Column(DateTime)
    
    # Timestamps con timezone
    created_at = Column(DateTime, default=utc_now_naive, index=True)
    
    # Relationships
    user = relationship("User")
    
    # Relación con AuditAction definida abajo
    actions = relationship("AuditAction", back_populates="audit_log", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_audit_resource', 'resource_type', 'resource_id'),
        Index('idx_audit_user_date', 'user_id', 'created_at'),
    )
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, action={self.action_type}, user={self.user_email})>"


class AuditAction(Base):
    __tablename__ = "audit_actions"
    
    # CORRECCIÓN: ID como UUID
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        index=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()")  # <-- Clave para que PG genere el ID
    )
    
    # CORRECCIÓN: audit_log_id como UUID para coincidir con audit_logs.id
    audit_log_id = Column(UUID(as_uuid=True), ForeignKey("audit_logs.id"), index=True)
    
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    change_type = Column(String(20))
    created_at = Column(DateTime, default=utc_now_naive, index=True)
    
    audit_log = relationship("AuditLog", back_populates="actions")

    def __repr__(self):
        return f"<AuditAction(audit={self.audit_log_id}, field={self.field_name})>"