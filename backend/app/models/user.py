"""User model for authentication and authorization."""

import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from passlib.context import CryptContext

from app.core.database import Base

def utc_now_naive():
    """Devuelve la hora actual en UTC sin zona horaria (naive)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserRole(str, enum.Enum):
    SUPERADMIN = "SUPERADMIN"
    GERENTE = "GERENTE"
    OPERADOR = "OPERADOR"
    REPARTIDOR = "REPARTIDOR"
    CLIENTE = "CLIENTE"

class User(Base):
    __tablename__ = "users"
    
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4, 
        index=True, 
        server_default=text("gen_random_uuid()")
    )
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    role: Any = Column(SQLEnum(UserRole), default=UserRole.OPERADOR)
    avatar_url = Column(String(500))
    last_login = Column(DateTime)
    failed_login_attempts = Column(String, default="0")
    locked_until = Column(DateTime)
    
    reset_token = Column(String(500), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)

    def verify_password(self, password: str) -> bool:
        return pwd_context.verify(password, self.hashed_password)

    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
    
    # ------------------------------------------------------------------
    # RELACIONES
    # Nota: Las relaciones con clases que pueden causar circularidad
    # se configuran automáticamente por SQLAlchemy al importar todos los modelos.
    # ------------------------------------------------------------------

    # 1. Relación Uno-a-Uno con Rider (Perfil de repartidor)
    # Se mantiene uselist=False porque un usuario tiene máximo un perfil de rider.
    rider_profile = relationship("Rider", back_populates="user", uselist=False, foreign_keys="Rider.user_id")
    
    # 2. Relación Uno-a-Muchos con Notificaciones
    notifications = relationship("Notification", back_populates="user", foreign_keys="Notification.user_id")

    # 3. Relación Uno-a-Muchos con Vehicle (Flota de vehículos)
    # Un usuario (dueño) puede tener múltiples vehículos.
    # ✅ CORRECCIÓN: La relación se define completamente en Vehicle.rider
    # y se accede desde User a través de back_populates automático.
    # No es necesario definir 'vehicles' aquí si causa problemas de circularidad.
    # Si se necesita acceso explícito, se puede usar una consulta directa o
    # definir la relación después de que todos los modelos estén cargados.