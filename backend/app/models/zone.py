# app/models/zone.py
"""Zone model for delivery operating areas."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


def utc_now_naive() -> datetime:
    """Return the current UTC datetime without timezone info for DB consistency."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Zone(Base):
    """Operational delivery zone with pricing and display metadata."""

    __tablename__ = "zones"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
        index=True,
    )
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)

    delivery_fee_base = Column(Float, nullable=False, default=0.0)
    cost_per_km = Column(Float, nullable=False, default=0.0)
    estimated_time_min = Column(Float, nullable=False, default=30.0)

    is_priority = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    color_hex = Column(String(7), nullable=False, default="#6b7280")

    center_lat = Column(Float, nullable=True)
    center_lng = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=False), default=utc_now_naive, nullable=False)
    updated_at = Column(DateTime(timezone=False), default=utc_now_naive, onupdate=utc_now_naive, nullable=True)

    riders = relationship("Rider", back_populates="zone", foreign_keys="Rider.zone_id")

    __table_args__ = (
        Index("ix_zones_active_priority", "is_active", "is_priority"),
    )
