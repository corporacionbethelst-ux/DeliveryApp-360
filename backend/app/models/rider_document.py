# backend/app/models/rider_document.py
import uuid
from sqlalchemy import Column, String, Text, text, Enum, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum
import sqlalchemy as sa

class DocumentType(str, enum.Enum):
    LICENCIA = "LICENCIA"
    DOCUMENTO_IDENTIDAD = "DOCUMENTO_IDENTIDAD"
    REGISTRO_VEHICULO = "REGISTRO_VEHICULO"
    SEGURO = "SEGURO"

class DocumentStatus(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    APROBADO = "APROBADO"
    RECHAZADO = "RECHAZADO"

class RiderDocument(Base):
    __tablename__ = "rider_documents"

    id = Column(
        UUID(as_uuid=True), 
        primary_key=True, 
        index=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()")  # <-- Clave para que PG genere el ID
    )
    rider_id = Column(UUID(as_uuid=True), ForeignKey("riders.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(Enum(DocumentType), nullable=False)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.PENDIENTE, nullable=False)
    file_url = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # CORRECCIÓN AQUÍ: Usar server_default con texto SQL
    created_at = Column(DateTime(timezone=False), server_default=sa.text('NOW()'), nullable=True)
    updated_at = Column(DateTime(timezone=False), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=True)
    
    # Relaciones
    rider = relationship("Rider", back_populates="documents")